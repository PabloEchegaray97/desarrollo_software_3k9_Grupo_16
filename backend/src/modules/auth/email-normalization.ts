/** Normaliza el email de acceso: sin espacios exteriores y en minúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
