const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Usually late Jul 2027": the third of the month a projected edition usually starts in. */
export function usualWindow(start: string): string {
  const d = new Date(`${start}T00:00:00Z`);
  const part = d.getUTCDate() <= 10 ? 'early' : d.getUTCDate() <= 20 ? 'mid' : 'late';
  return `Usually ${part} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
