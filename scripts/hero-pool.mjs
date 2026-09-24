#!/usr/bin/env node
/**
 * Builds the home hero's photo pool from reviewed Wikimedia Commons downloads.
 *
 *   node scripts/hero-pool.mjs <picks.json> <dir of 1920px JPEGs>
 *
 * Writes public/hero-pool/w800|w1600/<id>.webp and src/lib/hero/pool.json
 * (place label, credit, license, source page). Same photographs, resized and
 * re-encoded, so each credit and license still applies.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [picksFile, sourceDir] = process.argv.slice(2);
if (!picksFile || !sourceDir) throw new Error('Usage: node scripts/hero-pool.mjs <picks.json> <dir>');
const picks = JSON.parse(await fs.readFile(picksFile, 'utf8'));
const out = [];
let bytes = 0;
for (const pick of picks) {
  const source = path.join(sourceDir, `${pick.id}.jpg`);
  try {
    await fs.access(source);
  } catch {
    console.warn(`skip ${pick.id}: not downloaded`);
    continue;
  }
  for (const width of [800, 1600]) {
    const dir = path.join(ROOT, 'public/hero-pool', `w${width}`);
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${pick.id}.webp`);
    await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: width > 1000 ? 70 : 66 }).toFile(file);
    bytes += (await fs.stat(file)).size;
  }
  out.push({
    id: pick.id, scene: pick.scene, city: pick.city, region: pick.region, title: pick.title,
    credit: pick.credit, license: pick.license, licenseUrl: pick.licenseUrl, sourceUrl: pick.sourceUrl,
  });
}
await fs.writeFile(path.join(ROOT, 'src/lib/hero/pool.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log(`${out.length} photos, ${(bytes / 1024 / 1024).toFixed(1)} MB of WebP`);
