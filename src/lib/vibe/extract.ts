import { fold, type Place } from './places';

/** Place names that are also everyday words or common elsewhere: they count only next to their country. */
const AMBIGUOUS = new Set(['nice', 'reading', 'bath', 'split', 'mobile', 'orange', 'victoria', 'kingston', 'male', 'lech', 'selva', 'huez', 'villars', 'yuzawa', 'como']);

type Needle = { text: string; place: Place; needsCountry: boolean };

export type PlaceMatcher = (text: string) => string[];

/**
 * Which places a story names: whole words, accents ignored, longest name
 * first (so "Val d'Isère" isn't also read as a shorter name inside it), at
 * most five per story. An ambiguous name counts only when the story also
 * names its country. Nothing is guessed.
 */
export function placeMatcher(places: readonly Place[]): PlaceMatcher {
  const needles: Needle[] = [];
  for (const place of places) {
    for (const name of place.names) {
      const text = fold(name);
      if (text.length < 3) continue;
      needles.push({ text, place, needsCountry: AMBIGUOUS.has(text) });
    }
  }
  needles.sort((a, b) => b.text.length - a.text.length);
  return (raw: string) => {
    let text = ` ${fold(raw)} `;
    const keys: string[] = [];
    for (const needle of needles) {
      if (keys.length >= 5) break;
      const at = text.indexOf(` ${needle.text} `);
      if (at === -1) continue;
      if (needle.needsCountry && !text.includes(` ${fold(needle.place.country)} `)) continue;
      // Blank the matched words so a shorter name inside them can't match too.
      text = `${text.slice(0, at + 1)}${' '.repeat(needle.text.length)}${text.slice(at + 1 + needle.text.length)}`;
      if (!keys.includes(needle.place.key)) keys.push(needle.place.key);
    }
    return keys;
  };
}
