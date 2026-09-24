#!/usr/bin/env node
/**
 * Writes responsive WebP copies of the reviewed editorial photographs.
 *
 *   node scripts/editorial-derivatives.mjs
 *
 * Input:  public/editorial/<name>.jpg (the reviewed, credited originals — unchanged)
 * Output: public/editorial/w<width>/<name>.webp for each standard width below the
 *         original, plus src/lib/place-media/editorial-derivatives.json, which
 *         src/lib/place-media/sources.ts reads to build srcset.
 *
 * The pixels are the same photograph, only resized and re-encoded, so the
 * credit, license and archive year recorded for the original still apply.
 * Static files cost nothing at request time (no image-optimization quota) and
 * are cached by the CDN like any other public asset. Re-run after adding a photo.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SOURCE = path.join(ROOT, 'public/editorial');
const MANIFEST = path.join(ROOT, 'src/lib/place-media/editorial-derivatives.json');
const WIDTHS = [480, 960, 1280];

const manifest = {};
const files = (await fs.readdir(SOURCE)).filter((file) => /\.jpe?g$/i.test(file)).sort();
let before = 0;
let after = 0;
for (const file of files) {
  const name = file.replace(/\.jpe?g$/i, '');
  const input = path.join(SOURCE, file);
  const { width } = await sharp(input).metadata();
  if (!width) continue;
  const widths = [...new Set([...WIDTHS.filter((w) => w < width), Math.min(width, WIDTHS.at(-1))])];
  for (const w of widths) {
    const dir = path.join(SOURCE, `w${w}`);
    await fs.mkdir(dir, { recursive: true });
    const out = path.join(dir, `${name}.webp`);
    await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }).toFile(out);
    if (w === widths.at(-1)) after += (await fs.stat(out)).size;
  }
  before += (await fs.stat(input)).size;
  manifest[name] = widths;
}
const lines = Object.entries(manifest).map(([name, widths]) => `  ${JSON.stringify(name)}: ${JSON.stringify(widths)}`);
await fs.writeFile(MANIFEST, `{\n${lines.join(',\n')}\n}\n`);
console.log(`${files.length} photos · largest-variant bytes ${Math.round(before / 1024)} KB JPEG → ${Math.round(after / 1024)} KB WebP`);
