/**
 * Renders the map behind each mountain range card in the ski planner: a dark
 * relief map of the range (OpenFreeMap's basemap recolored dark with roads
 * taken off, strong hillshade from the open Terrarium elevation tiles so the
 * ridges read) and a mountain marker with the name of every resort in it. Static files, so the
 * planner never opens 14 live maps on a phone.
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/ski/render-range-maps.mjs            # all ranges
 *   NODE_USE_ENV_PROXY=1 node scripts/ski/render-range-maps.mjs colorado   # one range
 *   CHROMIUM_PATH=/path/to/chromium …                                       # a specific browser build
 *
 * NODE_USE_ENV_PROXY is only needed behind an HTTPS proxy.
 * Writes public/ski/ranges/<id>.jpg. Needs Playwright and network access to
 * tiles.openfreemap.org and the elevation tiles. Map data © OpenStreetMap
 * contributors; terrain from Mapzen Terrain Tiles (AWS Open Data). Credited on the card.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'ski', 'ranges');
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const TERRAIN = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const WIDTH = 720;
// The card's shape (340 x 600 on a phone), so the map fills it top to bottom.
const HEIGHT = 1270;

const resorts = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'ski', 'resorts.json'), 'utf8'));
const rangeIds = [...new Set(resorts.map((resort) => resort.rangeId))];
const only = process.argv.slice(2);
const targets = only.length ? rangeIds.filter((id) => only.includes(id)) : rangeIds;

/** "Jackson Hole Mountain Resort" → "Jackson Hole"; "Queenstown: Coronet Peak…" → "Queenstown". */
const shortName = (name) => name.split(':')[0].replace(/\s+(Mountain Resort|Alpine Resort|Ski Resort|Resort|Mountain)$/i, '').trim();

mkdirSync(OUT, { recursive: true });
// Playwright's own Chromium by default; CHROMIUM_PATH points at another build (e.g. a preinstalled one).
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
// Fetch tiles and fonts from Node, which trusts the machine's certificate setup
// (some sandboxes re-sign TLS with their own CA that the bundled browser doesn't know).
await page.route(/^https:\/\//, async (route) => {
  try {
    const response = await fetch(route.request().url());
    const headers = Object.fromEntries(response.headers);
    delete headers['content-encoding'];
    delete headers['content-length'];
    await route.fulfill({ status: response.status, headers: { ...headers, 'access-control-allow-origin': '*' }, body: Buffer.from(await response.arrayBuffer()) });
  } catch (error) {
    console.warn(`fetch failed: ${route.request().url()} ${error.cause?.code ?? error.message}`);
    await route.abort();
  }
});
await page.setContent(`<!doctype html><html><head><style>html,body,#map{margin:0;width:${WIDTH}px;height:${HEIGHT}px;background:#0b1218}</style></head><body><div id="map"></div></body></html>`);
await page.addStyleTag({ path: join(ROOT, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl.css') });
await page.addScriptTag({ path: join(ROOT, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl.js') });

for (const id of targets) {
  const inRange = resorts.filter((resort) => resort.rangeId === id);
  const points = inRange.map((resort) => ({ name: shortName(resort.name), coordinates: [resort.lng, resort.lat] }));
  const lngs = inRange.map((resort) => resort.lng);
  const lats = inRange.map((resort) => resort.lat);
  const padLng = Math.max(0.8, (Math.max(...lngs) - Math.min(...lngs)) * 0.1);
  const padLat = Math.max(0.6, (Math.max(...lats) - Math.min(...lats)) * 0.1);
  const bounds = [[Math.min(...lngs) - padLng, Math.min(...lats) - padLat], [Math.max(...lngs) + padLng, Math.max(...lats) + padLat]];
  await page.evaluate(
    ({ style, terrain, bounds, points }) =>
      new Promise((resolve, reject) => {
        document.getElementById('map').innerHTML = '';
        const map = new window.maplibregl.Map({
          container: 'map', style, bounds, attributionControl: false, interactive: false, fadeDuration: 0,
          // Keep the resorts in the clear window the card leaves between its title and its facts
          // (about 31% to 60% down; see .cardTop and .mapGap).
          fitBoundsOptions: { padding: { top: 400, bottom: 510, left: 110, right: 110 } },
          preserveDrawingBuffer: true,
        });
        const timer = setTimeout(() => reject(new Error('map timed out')), 90000);
        map.on('load', () => {
          // Dark relief: drop roads, rail, airports, buildings and small places; keep water, borders and big names.
          for (const layer of map.getStyle().layers) {
            if (/^(highway|road|railway|tunnel|aeroway|building|airport|label_other|label_village|waterway_line|water_name_line|park|landuse|landcover_wood)/.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
            else if (layer.type === 'symbol') {
              map.setPaintProperty(layer.id, 'text-color', '#9fb0bf');
              map.setPaintProperty(layer.id, 'text-halo-color', '#0b1218');
            } else if (layer.type === 'line' && layer.id.startsWith('boundary')) map.setPaintProperty(layer.id, 'line-color', '#3b4c5c');
            else if (layer.id === 'waterway') map.setPaintProperty(layer.id, 'line-color', '#1d4560');
          }
          map.setPaintProperty('background', 'background-color', '#0f1820');
          map.setPaintProperty('water', 'fill-color', '#0a2233');
          for (const id of ['landcover_ice_shelf', 'landcover_glacier']) if (map.getLayer(id)) map.setPaintProperty(id, 'fill-color', '#2a3a48');
          const firstSymbol = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
          map.addSource('dem', { type: 'raster-dem', tiles: [terrain], encoding: 'terrarium', tileSize: 256, maxzoom: 12 });
          map.addLayer({ id: 'relief', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 1, 'hillshade-shadow-color': '#000000', 'hillshade-highlight-color': '#c6d6e4', 'hillshade-accent-color': '#2e4356', 'hillshade-illumination-direction': 315 } }, firstSymbol);

          // A little mountain for each resort, like a ski-area poster.
          const size = 64;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(32, 8); ctx.lineTo(60, 56); ctx.lineTo(4, 56); ctx.closePath();
          ctx.fillStyle = '#7fb6d9'; ctx.fill();
          ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(32, 12); ctx.lineTo(42, 29); ctx.lineTo(36, 26); ctx.lineTo(32, 31); ctx.lineTo(27, 26); ctx.lineTo(22, 29); ctx.closePath();
          ctx.fillStyle = '#ffffff'; ctx.fill();
          map.addImage('peak', ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });

          map.addSource('resorts', { type: 'geojson', data: { type: 'FeatureCollection', features: points.map((point) => ({ type: 'Feature', properties: { name: point.name }, geometry: { type: 'Point', coordinates: point.coordinates } })) } });
          map.addLayer({
            id: 'resorts', type: 'symbol', source: 'resorts',
            layout: {
              'icon-image': 'peak', 'icon-size': 0.9, 'icon-allow-overlap': true, 'icon-anchor': 'bottom',
              'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 14,
              'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 1.1, 'text-justify': 'auto',
              'text-optional': true,
            },
            paint: { 'text-color': '#F7C548', 'text-halo-color': '#0b1218', 'text-halo-width': 2 },
          });
          map.once('idle', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        map.on('error', (event) => console.warn(String(event?.error?.message ?? event)));
      }),
    { style: STYLE_URL, terrain: TERRAIN, bounds, points },
  );
  const image = await page.screenshot({ type: 'jpeg', quality: 80 });
  writeFileSync(join(OUT, `${id}.jpg`), image);
  console.log(`${id}.jpg  ${(image.length / 1024).toFixed(0)} KB  ${points.length} resorts`);
}
await browser.close();
