/** Recorta extremos y colapsa espacios internos. */
export function normalizePatientName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Dígitos del teléfono: base de la comparación de posibles duplicados y de la búsqueda. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Quita puntos, espacios y guiones; un DNI vacío equivale a no informado. */
export function normalizeDni(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;
  const normalized = value.replace(/[.\s-]/g, '');
  return normalized === '' ? null : normalized;
}

/** Email recortado y en minúsculas; vacío equivale a no informado. */
export function normalizeEmail(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  return normalized === '' ? null : normalized;
}

export function normalizeTextOrValue(value: unknown): unknown {
  return typeof value === 'string' ? normalizePatientName(value) : value;
}

/**
 * Dígitos a buscar en teléfono y DNI. Solo aplica si el texto contiene únicamente
 * dígitos y signos de formato (`5555-0001`, `30.000.001`); un texto mixto como
 * `Ficticio 1` busca solo por nombre para no devolver cualquier teléfono con un 1.
 */
export function digitSearchTerm(query: string): string | null {
  if (!/^[\d\s.+()-]+$/.test(query)) return null;
  const digits = phoneDigits(query);
  return digits === '' ? null : digits;
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function parseBooleanQuery(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
