const APPOINTMENTS_CHANGED_EVENT = 'odosoft:appointments-changed'

export function notifyAppointmentsChanged(): void {
  window.dispatchEvent(new Event(APPOINTMENTS_CHANGED_EVENT))
}

export function subscribeToAppointmentChanges(listener: () => void): () => void {
  window.addEventListener(APPOINTMENTS_CHANGED_EVENT, listener)
  return () => window.removeEventListener(APPOINTMENTS_CHANGED_EVENT, listener)
}
