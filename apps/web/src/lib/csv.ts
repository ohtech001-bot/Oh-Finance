/** Prevent spreadsheet formulas while preserving signed numeric amounts. */
export function csvCell(value: string | number): string {
  const raw = String(value);
  const numeric = /^[+-]?\d+(?:\.\d+)?$/.test(raw);
  const safe = !numeric && /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
