// Format a YYYY-MM-DD (or ISO) date string as a local-day string without
// timezone shift. Avoids `new Date('YYYY-MM-DD')` which is parsed as UTC.
export function formatYmdLocal(dateStr: string, locale = 'en-IN'): string {
  if (!dateStr) return '';
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(locale);
  }
  const [, y, mo, d] = m;
  return new Date(+y, +mo - 1, +d).toLocaleDateString(locale);
}
