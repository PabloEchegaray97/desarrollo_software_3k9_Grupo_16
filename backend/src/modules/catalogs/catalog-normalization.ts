/** Recorta extremos y colapsa espacios internos de un nombre de catálogo. */
export function normalizeCatalogName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Escapa los comodines de LIKE para buscar el texto literal ingresado. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function trimmedStringOrValue(value: unknown): unknown {
  return typeof value === 'string' ? normalizeCatalogName(value) : value;
}

export function parseBooleanQuery(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
