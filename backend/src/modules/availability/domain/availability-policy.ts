/** Tipos y reglas puras de disponibilidad. Sin reloj del sistema ni acceso a base. */

export type EstadoEvaluacion =
  | 'DISPONIBLE'
  | 'FUERA_DE_DISPONIBILIDAD'
  | 'EXCEPCION_BLOQUEANTE'
  | 'DATOS_INVALIDOS';

export type TipoExcepcion = 'FERIADO' | 'VACACIONES' | 'BLOQUEO';

/** No existe habilitación extraordinaria: el override manual pertenece a C-05. */
export const TIPOS_EXCEPCION: readonly TipoExcepcion[] = [
  'FERIADO',
  'VACACIONES',
  'BLOQUEO',
];

export interface TramoSemanal {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface ExcepcionSemanal {
  fecha: string;
  tipo: TipoExcepcion;
  motivo: string;
  horaInicio?: string | null;
  horaFin?: string | null;
  activo?: boolean;
}

export interface SolicitudEvaluacion {
  /** Fecha local en formato YYYY-MM-DD. */
  fecha: string;
  /** Hora local en formato HH:mm. */
  horaInicio: string;
  duracionMinutos: number;
  zonaHoraria: string;
  tramos: readonly TramoSemanal[];
  excepciones?: readonly ExcepcionSemanal[];
  intervaloPosteriorMinutos?: number;
}

export interface ResultadoEvaluacion {
  estado: EstadoEvaluacion;
  requiereOverrideManual: boolean;
  motivoExcepcion: string | null;
  tipoExcepcion: TipoExcepcion | null;
  inicioUtc: string | null;
  finAtencionUtc: string | null;
  /** Informativo para C-05: incluye el intervalo posterior, sin afectar la contención. */
  finBloqueoUtc: string | null;
}

function resultado(estado: EstadoEvaluacion): ResultadoEvaluacion {
  return {
    estado,
    requiereOverrideManual: estado === 'FUERA_DE_DISPONIBILIDAD',
    motivoExcepcion: null,
    tipoExcepcion: null,
    inicioUtc: null,
    finAtencionUtc: null,
    finBloqueoUtc: null,
  };
}

function aMinutos(hora: string): number | null {
  const partes = /^(\d{2}):(\d{2})$/.exec(hora);
  if (partes === null) {
    return null;
  }
  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  if (horas > 23 || minutos > 59) {
    return null;
  }
  return horas * 60 + minutos;
}

/** 1 = lunes … 7 = domingo. Solo aritmética UTC de la fecha recibida. */
function diaSemanaDe(fecha: string): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (partes === null) {
    return null;
  }
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const valor = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    valor.getUTCFullYear() !== anio ||
    valor.getUTCMonth() !== mes - 1 ||
    valor.getUTCDate() !== dia
  ) {
    return null;
  }
  const domingo = valor.getUTCDay();
  return domingo === 0 ? 7 : domingo;
}

interface RangoMinutos {
  inicio: number;
  fin: number;
}

/** Intervalos `[inicio, fin)`: un extremo común significa continuidad, no una separación. */
function unirContiguos(rangos: readonly RangoMinutos[]): RangoMinutos[] {
  const ordenados = [...rangos].sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
  return ordenados.reduce<RangoMinutos[]>((unidos, actual) => {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo !== undefined && actual.inicio <= ultimo.fin) {
      return [
        ...unidos.slice(0, -1),
        { inicio: ultimo.inicio, fin: Math.max(ultimo.fin, actual.fin) },
      ];
    }
    return [...unidos, actual];
  }, []);
}

function rangosDelDia(tramos: readonly TramoSemanal[], dia: number): RangoMinutos[] {
  const rangos: RangoMinutos[] = [];
  for (const tramo of tramos) {
    if (tramo.diaSemana !== dia) {
      continue;
    }
    const inicio = aMinutos(tramo.horaInicio);
    const fin = aMinutos(tramo.horaFin);
    if (inicio !== null && fin !== null && inicio < fin) {
      rangos.push({ inicio, fin });
    }
  }
  return unirContiguos(rangos);
}

export type EstadoValidacionTramos = 'VALIDO' | 'VALIDATION_ERROR' | 'RANGOS_INCOMPATIBLES';

export interface ValidacionTramos {
  estado: EstadoValidacionTramos;
  codigo: string | null;
  mensaje: string | null;
}

/** Valida el conjunto completo sin mutarlo; los extremos compartidos son contiguos y válidos. */
export function validarTramosSemanal(tramos: readonly TramoSemanal[]): ValidacionTramos {
  const invalido = (mensaje: string): ValidacionTramos => ({
    estado: 'VALIDATION_ERROR',
    codigo: 'VALIDATION_ERROR',
    mensaje,
  });
  const porDia = new Map<number, RangoMinutos[]>();

  for (const tramo of tramos) {
    if (
      !Number.isInteger(tramo.diaSemana) ||
      tramo.diaSemana < 1 ||
      tramo.diaSemana > 7
    ) {
      return invalido('diaSemana debe estar entre 1 y 7');
    }
    const inicio = aMinutos(tramo.horaInicio);
    const fin = aMinutos(tramo.horaFin);
    if (inicio === null || fin === null) {
      return invalido('Formato de hora inválido');
    }
    if (inicio >= fin) {
      return invalido('horaInicio debe ser menor que horaFin');
    }
    const delDia = porDia.get(tramo.diaSemana) ?? [];
    delDia.push({ inicio, fin });
    porDia.set(tramo.diaSemana, delDia);
  }

  for (const rangos of porDia.values()) {
    const ordenados = [...rangos].sort((a, b) => a.inicio - b.inicio);
    for (let indice = 1; indice < ordenados.length; indice += 1) {
      const anterior = ordenados[indice - 1];
      const actual = ordenados[indice];
      if (anterior !== undefined && actual !== undefined && actual.inicio < anterior.fin) {
        return {
          estado: 'RANGOS_INCOMPATIBLES',
          codigo: 'RANGOS_INCOMPATIBLES',
          mensaje: 'Los tramos del mismo día comparten minutos',
        };
      }
    }
  }

  return { estado: 'VALIDO', codigo: null, mensaje: null };
}

/** Una excepción activa se evalúa antes que los tramos, incluso fuera del horario semanal. */
function excepcionAplicable(
  excepciones: readonly ExcepcionSemanal[],
  fecha: string,
  inicio: number,
  fin: number,
): ExcepcionSemanal | undefined {
  return excepciones.find((excepcion) => {
    if (excepcion.fecha !== fecha || excepcion.activo === false) {
      return false;
    }
    if (!TIPOS_EXCEPCION.includes(excepcion.tipo)) {
      return false;
    }
    if (
      excepcion.horaInicio === null || excepcion.horaInicio === undefined ||
      excepcion.horaFin === null || excepcion.horaFin === undefined
    ) {
      return true;
    }
    const inicioEx = aMinutos(excepcion.horaInicio);
    const finEx = aMinutos(excepcion.horaFin);
    return (
      inicioEx !== null &&
      finEx !== null &&
      inicioEx < finEx &&
      inicioEx < fin &&
      inicio < finEx
    );
  });
}

interface PartesLocales {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

/** Lee la hora civil de un instante en la zona IANA indicada, sin usar la zona del proceso. */
function partesEnZona(instante: Date, zona: string): PartesLocales | null {
  const formateador = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const partes = formateador.formatToParts(instante);
  const numero = (tipo: string): number | null => {
    const encontrada = partes.find((parte) => parte.type === tipo);
    return encontrada === undefined ? null : Number(encontrada.value);
  };
  const anio = numero('year');
  const mes = numero('month');
  const dia = numero('day');
  const hora = numero('hour');
  const minuto = numero('minute');
  if (anio === null || mes === null || dia === null || hora === null || minuto === null) {
    return null;
  }
  return { anio, mes, dia, hora, minuto };
}

function offsetMinutos(instante: Date, zona: string): number {
  const partes = partesEnZona(instante, zona);
  if (partes === null) {
    return 0;
  }
  const civilComoUtc = Date.UTC(
    partes.anio, partes.mes - 1, partes.dia, partes.hora, partes.minuto,
  );
  return Math.round((civilComoUtc - Math.floor(instante.getTime() / 60000) * 60000) / 60000);
}

/**
 * Convierte minutos locales desde la medianoche de `fecha` a un instante UTC ISO.
 * Devuelve null si la hora no existe o es ambigua según la base IANA de la zona.
 */
function minutosLocalesAUtc(
  fecha: string,
  minutosLocales: number | null,
  zona: string,
): string | null {
  if (minutosLocales === null || diaSemanaDe(fecha) === null) {
    return null;
  }
  const partesFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (partesFecha === null) {
    return null;
  }
  const anio = Number(partesFecha[1]);
  const mes = Number(partesFecha[2]);
  const dia = Number(partesFecha[3]);
  const diasExtra = Math.floor(minutosLocales / 1440);
  const minutoDelDia = ((minutosLocales % 1440) + 1440) % 1440;
  const fechaEfectiva = new Date(Date.UTC(anio, mes - 1, dia + diasExtra));
  const utcSupuesto = fechaEfectiva.getTime() + minutoDelDia * 60000;
  const offsets = new Set<number>([
    offsetMinutos(new Date(utcSupuesto - 12 * 3600000), zona),
    offsetMinutos(new Date(utcSupuesto + 12 * 3600000), zona),
  ]);

  const instantes = new Set<number>();
  for (const offset of offsets) {
    const candidato = utcSupuesto - offset * 60000;
    const locales = partesEnZona(new Date(candidato), zona);
    if (locales === null) {
      continue;
    }
    const coincide =
      locales.anio === fechaEfectiva.getUTCFullYear() &&
      locales.mes === fechaEfectiva.getUTCMonth() + 1 &&
      locales.dia === fechaEfectiva.getUTCDate() &&
      locales.hora * 60 + locales.minuto === minutoDelDia;
    if (coincide) {
      instantes.add(candidato);
    }
  }

  if (instantes.size !== 1) {
    return null;
  }
  const [unico] = [...instantes];
  return unico === undefined ? null : new Date(unico).toISOString();
}

export function horaLocalAUtc(fecha: string, hora: string, zona: string): string | null {
  return minutosLocalesAUtc(fecha, aMinutos(hora), zona);
}

function conInstantes(
  base: ResultadoEvaluacion,
  inicioUtc: string,
  finAtencionUtc: string,
  finBloqueoUtc: string,
): ResultadoEvaluacion {
  return { ...base, inicioUtc, finAtencionUtc, finBloqueoUtc };
}

export function evaluarIntervalo(solicitud: SolicitudEvaluacion): ResultadoEvaluacion {
  const dia = diaSemanaDe(solicitud.fecha);
  const inicio = aMinutos(solicitud.horaInicio);
  if (
    dia === null ||
    inicio === null ||
    !Number.isInteger(solicitud.duracionMinutos) ||
    solicitud.duracionMinutos <= 0
  ) {
    return resultado('DATOS_INVALIDOS');
  }

  const fin = inicio + solicitud.duracionMinutos;
  const inicioUtc = minutosLocalesAUtc(solicitud.fecha, inicio, solicitud.zonaHoraria);
  const finAtencionUtc = minutosLocalesAUtc(solicitud.fecha, fin, solicitud.zonaHoraria);
  const finBloqueoUtc = minutosLocalesAUtc(
    solicitud.fecha,
    fin + (solicitud.intervaloPosteriorMinutos ?? 0),
    solicitud.zonaHoraria,
  );
  if (inicioUtc === null || finAtencionUtc === null || finBloqueoUtc === null) {
    return resultado('DATOS_INVALIDOS');
  }

  const excepcion = excepcionAplicable(
    solicitud.excepciones ?? [],
    solicitud.fecha,
    inicio,
    fin,
  );
  if (excepcion !== undefined) {
    return conInstantes({
      ...resultado('EXCEPCION_BLOQUEANTE'),
      motivoExcepcion: excepcion.motivo,
      tipoExcepcion: excepcion.tipo,
    }, inicioUtc, finAtencionUtc, finBloqueoUtc);
  }

  const contenido = rangosDelDia(solicitud.tramos, dia).some(
    (rango) => rango.inicio <= inicio && fin <= rango.fin,
  );

  return conInstantes(
    resultado(contenido ? 'DISPONIBLE' : 'FUERA_DE_DISPONIBILIDAD'),
    inicioUtc,
    finAtencionUtc,
    finBloqueoUtc,
  );
}
