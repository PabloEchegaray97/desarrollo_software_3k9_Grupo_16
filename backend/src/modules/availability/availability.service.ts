import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import {
  TIPOS_EXCEPCION,
  evaluarIntervalo,
  horaLocalAUtc,
  validarTramosSemanal,
  type ResultadoEvaluacion,
  type TipoExcepcion,
} from './domain/availability-policy.js';
import { CONFIGURACION_UNICA_ID, ZONA_IANA } from './availability.constants.js';
import type { AvailabilityEvaluationPort, SolicitudEvaluacionPort } from './availability.port.js';
import {
  errorDeValidacion,
  excepcionNoEncontrada,
  rangosIncompatibles,
  versionConflicto,
} from './availability-errors.js';
import type {
  ConfiguracionPatchDto,
  ConfiguracionResponse,
  ExcepcionPostDto,
  ExcepcionResponse,
  SemanalesPutDto,
  SemanalesResponse,
  TramoResponse,
} from './dto/availability.dto.js';
import { ConfiguracionAgendaEntity } from './entities/configuracion-agenda.entity.js';
import { DisponibilidadSemanalEntity } from './entities/disponibilidad-semanal.entity.js';

interface ExcepcionFila {
  id: string;
  fecha: string;
  tipo: string;
  motivo: string;
  horaInicio: string | null;
  horaFin: string | null;
  activo: number;
}

/** Casos de uso de disponibilidad. NestJS es la única autoridad de la agenda. */
@Injectable()
export class AvailabilityService implements AvailabilityEvaluationPort {
  constructor(private readonly dataSource: DataSource) {}

  private async configuracion(): Promise<ConfiguracionAgendaEntity> {
    return this.dataSource
      .getRepository(ConfiguracionAgendaEntity)
      .findOneByOrFail({ id: CONFIGURACION_UNICA_ID });
  }

  async getConfiguracion(): Promise<ConfiguracionResponse> {
    const configuracion = await this.configuracion();
    return {
      intervaloGlobalMinutos: configuracion.intervaloGlobalMinutos,
      zonaHoraria: configuracion.zonaHoraria,
    };
  }

  async patchConfiguracion(input: ConfiguracionPatchDto): Promise<ConfiguracionResponse> {
    const configuracion = await this.configuracion();
    configuracion.intervaloGlobalMinutos = input.intervaloGlobalMinutos;
    await this.dataSource.getRepository(ConfiguracionAgendaEntity).save(configuracion);
    return this.getConfiguracion();
  }

  private aTramoResponse(entidad: DisponibilidadSemanalEntity): TramoResponse {
    return {
      diaSemana: entidad.diaSemana,
      horaInicio: entidad.horaInicio.slice(0, 5),
      horaFin: entidad.horaFin.slice(0, 5),
    };
  }

  private ordenar(tramos: readonly TramoResponse[]): TramoResponse[] {
    return [...tramos].sort(
      (a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio),
    );
  }

  private versionDe(tramos: readonly TramoResponse[]): string {
    const canonico = this.ordenar(tramos)
      .map((tramo) => `${tramo.diaSemana}|${tramo.horaInicio}|${tramo.horaFin}`)
      .join(';');
    return createHash('sha256').update(canonico).digest('hex').slice(0, 16);
  }

  private async leerSemanales(manager: EntityManager): Promise<SemanalesResponse> {
    const entidades = await manager.getRepository(DisponibilidadSemanalEntity).find({
      order: { diaSemana: 'ASC', horaInicio: 'ASC' },
    });
    const tramos = entidades.map((entidad) => this.aTramoResponse(entidad));
    return { tramos, version: this.versionDe(tramos) };
  }

  async getSemanales(): Promise<SemanalesResponse> {
    return this.leerSemanales(this.dataSource.manager);
  }

  async putSemanales(input: SemanalesPutDto): Promise<SemanalesResponse> {
    const validacion = validarTramosSemanal(input.tramos);
    if (validacion.estado === 'VALIDATION_ERROR') {
      throw errorDeValidacion(validacion.mensaje ?? 'Tramo semanal inválido');
    }
    if (validacion.estado === 'RANGOS_INCOMPATIBLES') {
      throw rangosIncompatibles();
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT id FROM configuracion_agenda WHERE id = ? FOR UPDATE', [
        CONFIGURACION_UNICA_ID,
      ]);
      if (input.version !== undefined) {
        const vigente = await this.leerSemanales(manager);
        if (input.version !== vigente.version) {
          throw versionConflicto();
        }
      }
      await manager.query('DELETE FROM disponibilidad_semanal');
      for (const tramo of input.tramos) {
        await manager.getRepository(DisponibilidadSemanalEntity).insert({
          id: randomUUID(),
          diaSemana: tramo.diaSemana,
          horaInicio: `${tramo.horaInicio}:00`,
          horaFin: `${tramo.horaFin}:00`,
        });
      }
      const tramos = this.ordenar(
        input.tramos.map((tramo) => ({
          diaSemana: tramo.diaSemana,
          horaInicio: tramo.horaInicio,
          horaFin: tramo.horaFin,
        })),
      );
      return { tramos, version: this.versionDe(tramos) };
    });
  }

  private aExcepcionResponse(fila: ExcepcionFila): ExcepcionResponse {
    return {
      id: fila.id,
      fecha: fila.fecha,
      tipo: fila.tipo,
      motivo: fila.motivo,
      horaInicio: fila.horaInicio,
      horaFin: fila.horaFin,
      activo: Boolean(fila.activo),
      inicioUtc:
        fila.horaInicio === null
          ? null
          : horaLocalAUtc(fila.fecha, fila.horaInicio, ZONA_IANA),
      finUtc:
        fila.horaFin === null ? null : horaLocalAUtc(fila.fecha, fila.horaFin, ZONA_IANA),
    };
  }

  /**
   * `DATE_FORMAT` evita que mysql2 convierta la fecha civil en un instante con zona;
   * los UTC se recalculan desde la hora local con la zona IANA configurada.
   */
  private async consultarExcepciones(
    sufijo: string,
    parametros: readonly unknown[],
  ): Promise<ExcepcionResponse[]> {
    const filas = (await this.dataSource.query(
      `SELECT id,
              DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
              tipo, motivo,
              TIME_FORMAT(hora_inicio, '%H:%i') AS horaInicio,
              TIME_FORMAT(hora_fin, '%H:%i') AS horaFin,
              activo
       FROM excepcion_disponibilidad
       ${sufijo}`,
      [...parametros],
    )) as ExcepcionFila[];
    return filas.map((fila) => this.aExcepcionResponse(fila));
  }

  async listExcepciones(): Promise<ExcepcionResponse[]> {
    return this.consultarExcepciones(
      'WHERE activo = TRUE ORDER BY fecha ASC, hora_inicio ASC',
      [],
    );
  }

  async getExcepcion(id: string): Promise<ExcepcionResponse> {
    const resultados = await this.consultarExcepciones('WHERE id = ?', [id]);
    const encontrada = resultados[0];
    if (encontrada === undefined) {
      throw excepcionNoEncontrada();
    }
    return encontrada;
  }

  async setExcepcionActivo(id: string, activo: boolean): Promise<ExcepcionResponse> {
    await this.getExcepcion(id);
    await this.dataSource.query(
      'UPDATE excepcion_disponibilidad SET activo = ? WHERE id = ?',
      [activo ? 1 : 0, id],
    );
    return this.getExcepcion(id);
  }

  private comoDatetime(iso: string | null): string | null {
    return iso === null ? null : `${iso.replace('T', ' ').replace('Z', '')}000`;
  }

  async createExcepcion(input: ExcepcionPostDto): Promise<ExcepcionResponse> {
    if (!TIPOS_EXCEPCION.includes(input.tipo as TipoExcepcion)) {
      throw errorDeValidacion('Tipo de excepción no admitido');
    }
    const motivo = input.motivo.trim();
    if (motivo.length === 0) {
      throw errorDeValidacion('El motivo es obligatorio');
    }
    const tieneInicio = input.horaInicio !== undefined;
    const tieneFin = input.horaFin !== undefined;
    if (tieneInicio !== tieneFin) {
      throw errorDeValidacion('El rango requiere hora de inicio y de fin');
    }
    if (tieneInicio && input.horaInicio !== undefined && input.horaFin !== undefined) {
      if (input.horaInicio >= input.horaFin) {
        throw errorDeValidacion('La hora de inicio debe ser menor que la de fin');
      }
    }
    const inicioUtc = tieneInicio && input.horaInicio !== undefined
      ? horaLocalAUtc(input.fecha, input.horaInicio, ZONA_IANA)
      : null;
    const finUtc = tieneFin && input.horaFin !== undefined
      ? horaLocalAUtc(input.fecha, input.horaFin, ZONA_IANA)
      : null;
    if (tieneInicio && (inicioUtc === null || finUtc === null)) {
      throw errorDeValidacion('La hora local no es válida para la fecha indicada');
    }

    const id = randomUUID();
    await this.dataSource.query(
      `INSERT INTO excepcion_disponibilidad
         (id, fecha, tipo, motivo, hora_inicio, hora_fin, inicio_utc, fin_utc, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        id,
        input.fecha,
        input.tipo,
        motivo,
        input.horaInicio === undefined ? null : `${input.horaInicio}:00`,
        input.horaFin === undefined ? null : `${input.horaFin}:00`,
        this.comoDatetime(inicioUtc),
        this.comoDatetime(finUtc),
      ],
    );
    return this.getExcepcion(id);
  }

  /** Evalúa contra la agenda vigente; nunca decide conflictos con turnos (C-05). */
  async evaluar(solicitud: SolicitudEvaluacionPort): Promise<ResultadoEvaluacion> {
    const [configuracion, semanales, excepciones] = await Promise.all([
      this.configuracion(),
      this.getSemanales(),
      this.listExcepciones(),
    ]);
    return evaluarIntervalo({
      fecha: solicitud.fecha,
      horaInicio: solicitud.horaInicio,
      duracionMinutos: solicitud.duracionMinutos,
      zonaHoraria: configuracion.zonaHoraria || ZONA_IANA,
      tramos: semanales.tramos,
      excepciones: excepciones.map((excepcion) => ({
        fecha: excepcion.fecha,
        tipo: excepcion.tipo as TipoExcepcion,
        motivo: excepcion.motivo,
        horaInicio: excepcion.horaInicio,
        horaFin: excepcion.horaFin,
        activo: excepcion.activo,
      })),
      intervaloPosteriorMinutos:
        solicitud.intervaloPosteriorMinutos ?? configuracion.intervaloGlobalMinutos,
    });
  }
}
