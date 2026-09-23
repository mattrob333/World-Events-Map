#!/usr/bin/env node
/**
 * Generates dope.travel brand imagery with Treg's image models and writes
 * web-ready files plus a manifest the /brand page reads.
 *
 *   TREG_TOKEN=… node scripts/brand-assets.mjs            # all assets
 *   TREG_TOKEN=… node scripts/brand-assets.mjs hero-riviera
 *   node scripts/brand-assets.mjs --dry-run               # print prompts and cost ceiling
 *
 * Every call carries a per-call cost ceiling (X-Treg-Route-Max-Cost) and an
 * idempotency key, so a re-run never pays twice for the same prompt.
 * Output: public/brand/art/<id>.webp and src/lib/brand/assets.json.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.join(ROOT, 'public/brand/art');
const MANIFEST = path.join(ROOT, 'src/lib/brand/assets.json');
const MAX_COST_PER_CALL = '0.20';

// Two best-in-catalog models: GPT Image 2.5 for editorial photography,
// Gemini 3 Pro Image for graphic/poster work.
const PHOTO = 'reapi.image-gen.gpt-image-2-5';
const GRAPHIC = 'reapi.image-gen.gemini-3-pro-image';

const STYLE =
  'Premium editorial travel photography in the spirit of Slim Aarons and 1970s Riviera magazines: real people, candid and joyful, warm golden-hour light, ' +
  'subtle film grain, a faint prismatic sun haze in saffron, tangerine and dusk violet at the edges of the frame. Tasteful, expensive, fun. ' +
  'No text, no logos, no watermarks, no psychedelic tie-dye, no neon.';

export const ASSETS = [
  { id: 'hero-riviera', model: PHOTO, aspect: '3:2', use: 'Home and trip hero', alt: 'Friends laughing over drinks on a cliffside terrace above the sea at golden hour',
    prompt: `${STYLE} A cliffside terrace above the Mediterranean at golden hour. A man in his mid-forties in an open-collar linen shirt laughs with friends over negronis; a vintage wooden speedboat below in turquoise water.` },
  { id: 'apres-alpine', model: PHOTO, aspect: '3:2', use: 'Ski trips', alt: 'Friends in vintage ski sweaters toasting on a sunny alpine terrace',
    prompt: `${STYLE} A sun-drenched alpine terrace at après-ski time in St. Moritz. Friends in their forties in vintage ski sweaters and sunglasses toast with champagne; snowy peaks and a frozen lake behind; long late sun.` },
  { id: 'night-music', model: PHOTO, aspect: '4:5', use: 'Live music and nights out', alt: 'A band on a small stage in a warm, crowded bar, seen from the crowd',
    prompt: `${STYLE} Inside a warm, packed bar at night: a great rock cover band on a small stage, amber stage light with a hint of violet, a well-dressed crowd singing along, shot from the crowd.` },
  { id: 'family-sea', model: PHOTO, aspect: '3:2', use: 'Family and beach trips', alt: 'A father and two boys snorkeling off a wooden boat in clear turquoise water',
    prompt: `${STYLE} A father in his forties and two boys (about 8 and 12) jumping off a classic wooden boat into clear turquoise water near a small island; bright afternoon sun; pure joy.` },
  { id: 'poster-sun', model: GRAPHIC, aspect: '4:5', use: 'Brand poster and empty states', alt: 'A striped setting sun over a calm sea in a 1970s poster style',
    prompt: 'A minimal 1970s travel poster: a large setting sun cut by horizontal stripes sinking into a calm sea, colours saffron, tangerine, flamingo pink and dusk violet on warm near-black, subtle risograph grain, generous negative space, premium print quality. No text.' },
  { id: 'texture-waves', model: GRAPHIC, aspect: '16:9', use: 'Section backgrounds', alt: '',
    prompt: 'A seamless, subtle background texture: soft concentric wavy lines like a 1970s op-art ripple in bone and warm grey on near-black #0c0907, very low contrast, premium, minimal. No text.' },
];

const SIZE = { '3:2': [1536, 1024], '4:5': [1024, 1280], '16:9': [1792, 1008] };

function body(asset) {
  const [width, height] = SIZE[asset.aspect];
  // Field names differ slightly between models; send the common ones.
  return asset.model === PHOTO
    ? { prompt: asset.prompt, size: `${width}x${height}`, quality: 'high', n: 1 }
    : { prompt: asset.prompt, aspect_ratio: asset.aspect, resolution: '2K', n: 1 };
}

/** Finds the first image in a provider response: a URL or base64 payload, wherever it is nested. */
function findImage(value, depth = 0) {
  if (depth > 8 || value == null) return null;
  if (typeof value === 'string') {
    if (/^https:\/\/\S+\.(png|jpe?g|webp)(\?\S*)?$/i.test(value) || /^https:\/\/\S+\/(images?|files?|output)\//i.test(value)) return { url: value };
    if (value.startsWith('data:image/')) return { b64: value.split(',')[1] };
    if (value.length > 5000 && /^[A-Za-z0-9+/=\s]+$/.test(value.slice(0, 200))) return { b64: value };
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findImage(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const key of ['b64_json', 'image_base64', 'base64', 'url', 'image_url', 'images', 'data', 'output', 'result']) {
      if (key in value) {
        const hit = findImage(value[key], depth + 1);
        if (hit) return hit;
      }
    }
    for (const item of Object.values(value)) {
      const hit = findImage(item, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

async function generate(asset, token) {
  const payload = body(asset);
  const response = await fetch(`https://treg.to/call/${asset.model}`, {
    method: 'POST',
    headers: {
      'X-Treg-Token': token,
      'Idempotency-Key': createHash('sha256').update(`${asset.model}|${JSON.stringify(payload)}`).digest('hex'),
      'X-Treg-Route-Max-Cost': MAX_COST_PER_CALL,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000),
  });
  const cost = response.headers.get('x-treg-cost-micro');
  if (!response.ok) throw new Error(`${asset.id}: Treg returned ${response.status}`);
  const image = findImage(await response.json());
  if (!image) throw new Error(`${asset.id}: no image in the response`);
  const bytes = image.b64
    ? Buffer.from(image.b64, 'base64')
    : Buffer.from(await (await fetch(image.url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer());
  const [width] = SIZE[asset.aspect];
  const file = path.join(OUT_DIR, `${asset.id}.webp`);
  const info = await sharp(bytes).resize({ width: Math.min(width, 1600), withoutEnlargement: true }).webp({ quality: 82 }).toFile(file);
  return { costMicro: cost && /^\d+$/.test(cost) ? Number(cost) : null, width: info.width, height: info.height };
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const only = args.filter((arg) => !arg.startsWith('--'));
  const chosen = only.length ? ASSETS.filter((asset) => only.includes(asset.id)) : ASSETS;
  if (dry) {
    for (const asset of chosen) console.log(`${asset.id} [${asset.model}, ${asset.aspect}]\n  ${asset.prompt}\n`);
    console.log(`Ceiling: ${chosen.length} × $${MAX_COST_PER_CALL} = $${(chosen.length * Number(MAX_COST_PER_CALL)).toFixed(2)}`);
    return;
  }
  const token = process.env.TREG_TOKEN;
  if (!token) {
    console.error('Set TREG_TOKEN (Treg → Settings → API token) and run again.');
    process.exit(1);
  }
  await fs.mkdir(OUT_DIR, { recursive: true });
  let manifest = { generatedWith: 'treg.to', assets: [] };
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  } catch {
    // First run.
  }
  for (const asset of chosen) {
    process.stdout.write(`${asset.id}… `);
    try {
      const result = await generate(asset, token);
      manifest.assets = manifest.assets.filter((entry) => entry.id !== asset.id);
      manifest.assets.push({
        id: asset.id, src: `/brand/art/${asset.id}.webp`, alt: asset.alt, use: asset.use, model: asset.model,
        width: result.width, height: result.height, generatedAt: new Date().toISOString(), costMicro: result.costMicro,
      });
      console.log(`ok${result.costMicro !== null ? ` ($${(result.costMicro / 1e6).toFixed(3)})` : ''}`);
    } catch (error) {
      console.log(`failed: ${error.message}`);
    }
  }
  manifest.assets.sort((a, b) => ASSETS.findIndex((x) => x.id === a.id) - ASSETS.findIndex((x) => x.id === b.id));
  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${path.relative(ROOT, MANIFEST)} (${manifest.assets.length} assets).`);
}

main();
