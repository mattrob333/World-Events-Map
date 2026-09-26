/**
 * How people say a place ("Flushing, Queens in New York") and how the map
 * search wants it ("Flushing, Queens, New York"): the phrase as said, then
 * simpler forms, at most three tries.
 */
export function placeVariants(q: string): string[] {
  const commas = q.replace(/\s+(?:in|near|around)\s+/gi, ', ').replace(/\s*,\s*/g, ', ').trim();
  const parts = commas.split(', ').filter(Boolean);
  const out = [q, commas, parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : '', parts[0] ?? ''];
  return [...new Set(out.map((value) => value.trim()).filter((value) => value.length >= 2))].slice(0, 3);
}
