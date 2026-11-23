import type { DuplicateCandidate } from './types'

interface DuplicateWarningProps {
  candidates: DuplicateCandidate[]
}

/** Advertencia no bloqueante (RN-PA-04): el usuario decide continuar o revisar. */
export function DuplicateWarning({ candidates }: DuplicateWarningProps) {
  return (
    <div className="adm-alert" role="alert">
      <p className="adm-alert__title">Posible paciente duplicado</p>
      <p>Ya hay un paciente registrado con el mismo nombre y teléfono. Revisá que no sea la misma persona antes de continuar.</p>
      {candidates.length > 0 ? (
        <ul aria-label="Pacientes coincidentes">
          {candidates.map((candidate) => (
            <li key={candidate.id}>{candidate.nombre}{candidate.activo ? '' : ' (inactivo)'}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
