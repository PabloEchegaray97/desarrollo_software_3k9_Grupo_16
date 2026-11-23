import {
  TIPOS_EXCEPCION,
  evaluarIntervalo,
  horaLocalAUtc,
  validarTramosSemanal,
  type SolicitudEvaluacion,
  type TramoSemanal,
} from './availability-policy.js';

const ZONA = 'America/Argentina/Buenos_Aires';
const LUNES = '2026-07-13';

function solicitud(con: Partial<SolicitudEvaluacion> = {}): SolicitudEvaluacion {
  return {
    fecha: LUNES,
    horaInicio: '10:00',
    duracionMinutos: 30,
    zonaHoraria: ZONA,
    tramos: [],
    ...con,
  };
}

describe('Política pura de disponibilidad', () => {
  describe('tramos múltiples y contigüidad', () => {
    const dosTramos: readonly TramoSemanal[] = [
      { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
      { diaSemana: 1, horaInicio: '16:00', horaFin: '20:00' },
    ];

    it('acepta dos tramos separados del mismo día', () => {
      const manana = evaluarIntervalo(solicitud({ tramos: dosTramos, horaInicio: '10:00' }));
      const tarde = evaluarIntervalo(solicitud({ tramos: dosTramos, horaInicio: '17:00' }));

      expect(manana.estado).toBe('DISPONIBLE');
      expect(tarde.estado).toBe('DISPONIBLE');
    });

    it('trata 10:00–12:00 y 12:00–13:00 como disponibilidad continua', () => {
      const contiguos: readonly TramoSemanal[] = [
        { diaSemana: 1, horaInicio: '10:00', horaFin: '12:00' },
        { diaSemana: 1, horaInicio: '12:00', horaFin: '13:00' },
      ];

      const cruza = evaluarIntervalo(solicitud({ tramos: contiguos, horaInicio: '11:45', duracionMinutos: 30 }));
      const segundo = evaluarIntervalo(solicitud({ tramos: contiguos, horaInicio: '12:30', duracionMinutos: 30 }));

      expect(cruza.estado).toBe('DISPONIBLE');
      expect(segundo.estado).toBe('DISPONIBLE');
    });
  });

  describe('validación de tramos semanales', () => {
    it('acepta tramos válidos y separados del mismo día', () => {
      const resultado = validarTramosSemanal([
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        { diaSemana: 1, horaInicio: '16:00', horaFin: '20:00' },
      ]);

      expect(resultado.estado).toBe('VALIDO');
      expect(resultado.codigo).toBeNull();
    });

    it('rechaza rangos compartidos del mismo día sin modificar la entrada', () => {
      const tramos: readonly TramoSemanal[] = [
        { diaSemana: 2, horaInicio: '10:00', horaFin: '12:00' },
        { diaSemana: 2, horaInicio: '11:30', horaFin: '13:00' },
      ];

      const resultado = validarTramosSemanal(tramos);

      expect(resultado.estado).toBe('RANGOS_INCOMPATIBLES');
      expect(resultado.codigo).toBe('RANGOS_INCOMPATIBLES');
      expect(tramos).toHaveLength(2);
      expect(tramos[1].horaInicio).toBe('11:30');
    });

    it('rechaza inicio igual o posterior al fin y día fuera de rango como VALIDATION_ERROR', () => {
      const invertido = validarTramosSemanal([
        { diaSemana: 1, horaInicio: '13:00', horaFin: '13:00' },
      ]);
      const posterior = validarTramosSemanal([
        { diaSemana: 1, horaInicio: '14:00', horaFin: '13:00' },
      ]);
      const diaInvalido = validarTramosSemanal([
        { diaSemana: 8, horaInicio: '09:00', horaFin: '10:00' },
      ]);

      expect(invertido.estado).toBe('VALIDATION_ERROR');
      expect(invertido.codigo).toBe('VALIDATION_ERROR');
      expect(posterior.estado).toBe('VALIDATION_ERROR');
      expect(diaInvalido.estado).toBe('VALIDATION_ERROR');
    });

    it('acepta tramos contiguos del mismo día como registros separados', () => {
      const resultado = validarTramosSemanal([
        { diaSemana: 2, horaInicio: '10:00', horaFin: '12:00' },
        { diaSemana: 2, horaInicio: '12:00', horaFin: '13:00' },
      ]);

      expect(resultado.estado).toBe('VALIDO');
    });
  });

  describe('excepciones bloqueantes', () => {
    const tramoLunes: readonly TramoSemanal[] = [
      { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
    ];

    it('bloquea el día completo con VACACIONES y devuelve el motivo', () => {
      const resultado = evaluarIntervalo(solicitud({
        tramos: tramoLunes,
        excepciones: [{
          fecha: LUNES,
          tipo: 'VACACIONES',
          motivo: 'Vacaciones ficticias',
        }],
      }));

      expect(resultado.estado).toBe('EXCEPCION_BLOQUEANTE');
      expect(resultado.motivoExcepcion).toBe('Vacaciones ficticias');
      expect(resultado.tipoExcepcion).toBe('VACACIONES');
      expect(resultado.requiereOverrideManual).toBe(false);
    });

    it('un BLOQUEO parcial deja disponible 10:00 y bloquea 11:30', () => {
      const excepciones = [{
        fecha: LUNES,
        tipo: 'BLOQUEO' as const,
        motivo: 'Mantenimiento ficticio',
        horaInicio: '11:00',
        horaFin: '12:00',
      }];

      const antes = evaluarIntervalo(solicitud({
        tramos: tramoLunes, horaInicio: '10:00', excepciones,
      }));
      const dentro = evaluarIntervalo(solicitud({
        tramos: tramoLunes, horaInicio: '11:30', excepciones,
      }));

      expect(antes.estado).toBe('DISPONIBLE');
      expect(antes.motivoExcepcion).toBeNull();
      expect(dentro.estado).toBe('EXCEPCION_BLOQUEANTE');
      expect(dentro.motivoExcepcion).toBe('Mantenimiento ficticio');
    });

    it('la excepción prevalece aunque no haya tramo que cubra la hora', () => {
      const resultado = evaluarIntervalo(solicitud({
        tramos: [],
        horaInicio: '18:00',
        excepciones: [{
          fecha: LUNES,
          tipo: 'FERIADO',
          motivo: 'Feriado ficticio',
        }],
      }));

      expect(resultado.estado).toBe('EXCEPCION_BLOQUEANTE');
      expect(resultado.motivoExcepcion).toBe('Feriado ficticio');
      expect(resultado.requiereOverrideManual).toBe(false);
    });

    it('una excepción inactiva no bloquea', () => {
      const resultado = evaluarIntervalo(solicitud({
        tramos: tramoLunes,
        excepciones: [{
          fecha: LUNES,
          tipo: 'FERIADO',
          motivo: 'Feriado ficticio cancelado',
          activo: false,
        }],
      }));

      expect(resultado.estado).toBe('DISPONIBLE');
    });

    it('solo existen tipos bloqueantes, sin habilitación extraordinaria', () => {
      expect(TIPOS_EXCEPCION).toEqual(['FERIADO', 'VACACIONES', 'BLOQUEO']);
      expect(TIPOS_EXCEPCION).not.toContain('HABILITACION');
    });
  });

  describe('conversiones local/UTC deterministas', () => {
    it('convierte 2026-07-15 09:00 local en el instante UTC correcto', () => {
      expect(horaLocalAUtc('2026-07-15', '09:00', ZONA)).toBe('2026-07-15T12:00:00.000Z');
    });

    it('aplica las reglas IANA a otra fecha sin guardar un offset fijo', () => {
      expect(horaLocalAUtc('2027-01-15', '09:00', ZONA)).toBe('2027-01-15T12:00:00.000Z');
      expect(horaLocalAUtc('2027-01-15', '09:00', ZONA)).not.toContain('-03:00');
    });

    it('rechaza horas locales inexistentes y ambiguas', () => {
      // Se elige una zona con DST para ejercitar la regla IANA sin depender del reloj del sistema.
      expect(horaLocalAUtc('2026-03-08', '02:30', 'America/New_York')).toBeNull();
      expect(horaLocalAUtc('2026-11-01', '01:30', 'America/New_York')).toBeNull();
    });

    it('devuelve DATOS_INVALIDOS ante fecha inexistente, duración cero u hora inexistente', () => {
      expect(evaluarIntervalo(solicitud({ fecha: '2026-02-30' })).estado).toBe('DATOS_INVALIDOS');
      expect(evaluarIntervalo(solicitud({ duracionMinutos: 0 })).estado).toBe('DATOS_INVALIDOS');
      expect(evaluarIntervalo(solicitud({
        zonaHoraria: 'America/New_York',
        fecha: '2026-03-08',
        horaInicio: '02:30',
      })).estado).toBe('DATOS_INVALIDOS');
    });

    it('expone los instantes UTC de la atención sin persistir el offset como zona', () => {
      const resultado = evaluarIntervalo(solicitud({
        fecha: '2026-07-15',
        horaInicio: '09:00',
        duracionMinutos: 30,
        tramos: [{ diaSemana: 3, horaInicio: '09:00', horaFin: '13:00' }],
      }));

      expect(resultado.estado).toBe('DISPONIBLE');
      expect(resultado.inicioUtc).toBe('2026-07-15T12:00:00.000Z');
      expect(resultado.finAtencionUtc).toBe('2026-07-15T12:30:00.000Z');
      expect(JSON.stringify(resultado)).not.toContain('-03:00');
    });
  });

  describe('límites de evaluación', () => {
    const tramoManana: readonly TramoSemanal[] = [
      { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
    ];

    it('acepta una atención que termina exactamente en el fin del tramo', () => {
      const resultado = evaluarIntervalo(solicitud({
        tramos: tramoManana, horaInicio: '12:00', duracionMinutos: 60,
      }));

      expect(resultado.estado).toBe('DISPONIBLE');
      expect(resultado.finAtencionUtc).toBe('2026-07-13T16:00:00.000Z');
    });

    it('rechaza una duración que excede el fin del tramo', () => {
      const resultado = evaluarIntervalo(solicitud({
        tramos: tramoManana, horaInicio: '12:45', duracionMinutos: 30,
      }));

      expect(resultado.estado).toBe('FUERA_DE_DISPONIBILIDAD');
      expect(resultado.requiereOverrideManual).toBe(true);
    });

    it('el intervalo posterior no altera la disponibilidad, solo el fin informativo', () => {
      const comun = {
        tramos: tramoManana, horaInicio: '12:00', duracionMinutos: 30,
      };
      const sinPosterior = evaluarIntervalo(solicitud({ ...comun, intervaloPosteriorMinutos: 0 }));
      const conPosterior = evaluarIntervalo(solicitud({ ...comun, intervaloPosteriorMinutos: 30 }));

      expect(sinPosterior.estado).toBe(conPosterior.estado);
      expect(sinPosterior.finAtencionUtc).toBe(conPosterior.finAtencionUtc);
      expect(sinPosterior.finBloqueoUtc).toBe('2026-07-13T15:30:00.000Z');
      expect(conPosterior.finBloqueoUtc).toBe('2026-07-13T16:00:00.000Z');
    });

    it('ignora datos de turnos aunque estén presentes en la entrada', () => {
      const entrada = {
        ...solicitud({ tramos: tramoManana, horaInicio: '10:00' }),
        turnos: [{ inicio: '10:00', fin: '11:00' }],
      };

      const resultado = evaluarIntervalo(entrada);

      expect(resultado.estado).toBe('DISPONIBLE');
      expect(Object.keys(resultado)).not.toContain('turnos');
    });
  });
});
