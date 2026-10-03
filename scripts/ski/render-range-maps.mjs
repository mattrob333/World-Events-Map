/**
 * Renders the map behind each mountain range card in the ski planner: the
 * range on a dark OpenFreeMap basemap with hillshaded relief from the open
 * Terrarium elevation tiles, and a glowing dot for every resort in it. Static files, so the planner never opens 14 live maps on a phone.
 *
 *   node scripts/ski/render-range-maps.mjs            # all ranges
 *   node scripts/ski/render-range-maps.mjs colorado   # one range
 *
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
const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const TERRAIN = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const WIDTH = 720;
const HEIGHT = 900;

const resorts = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'ski', 'resorts.json'), 'utf8'));
const rangeIds = [...new Set(resorts.map((resort) => resort.rangeId))];
const only = process.argv.slice(2);
const targets = only.length ? rangeIds.filter((id) => only.includes(id)) : rangeIds;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
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
await page.setContent(`<!doctype html><html><head><style>html,body,#map{margin:0;width:${WIDTH}px;height:${HEIGHT}px;background:#050505}</style></head><body><div id="map"></div></body></html>`);
await page.addStyleTag({ path: join(ROOT, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl.css') });
await page.addScriptTag({ path: join(ROOT, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl.js') });

for (const id of targets) {
  const points = resorts.filter((resort) => resort.rangeId === id).map((resort) => [resort.lng, resort.lat]);
  const lngs = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  // At least a couple of degrees across, so a tight cluster still shows the mountains around it.
  const padLng = Math.max(0.8, (Math.max(...lngs) - Math.min(...lngs)) * 0.1);
  const padLat = Math.max(0.6, (Math.max(...lats) - Math.min(...lats)) * 0.1);
  const bounds = [[Math.min(...lngs) - padLng, Math.min(...lats) - padLat], [Math.max(...lngs) + padLng, Math.max(...lats) + padLat]];
  await page.evaluate(
    ({ style, terrain, bounds, points }) =>
      new Promise((resolve, reject) => {
        document.getElementById('map').innerHTML = '';
        const map = new window.maplibregl.Map({
          container: 'map', style, bounds, attributionControl: false, interactive: false, fadeDuration: 0,
          // Keep the dots in the clear band the card leaves under its title (about 37% to 56% down).
          fitBoundsOptions: { padding: { top: 330, bottom: 400, left: 50, right: 50 } },
          preserveDrawingBuffer: true,
        });
        const timer = setTimeout(() => reject(new Error('map timed out')), 60000);
        map.on('load', () => {
          // Relief under the roads and labels, so the mountains read at a glance.
          const firstSymbol = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
          map.addSource('dem', { type: 'raster-dem', tiles: [terrain], encoding: 'terrarium', tileSize: 256, maxzoom: 12 });
          map.addLayer({ id: 'relief', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.85, 'hillshade-shadow-color': '#000000', 'hillshade-highlight-color': '#9fb4c8', 'hillshade-accent-color': '#1b2633', 'hillshade-illumination-direction': 315 } }, firstSymbol);
          map.addSource('resorts', { type: 'geojson', data: { type: 'FeatureCollection', features: points.map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates } })) } });
          map.addLayer({ id: 'glow', type: 'circle', source: 'resorts', paint: { 'circle-radius': 22, 'circle-color': '#F7C548', 'circle-opacity': 0.35, 'circle-blur': 1 } });
          map.addLayer({ id: 'dots', type: 'circle', source: 'resorts', paint: { 'circle-radius': 6, 'circle-color': '#F7C548', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
          map.once('idle', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        map.on('error', (event) => console.warn(String(event?.error?.message ?? event)));
      }),
    { style: STYLE_URL, terrain: TERRAIN, bounds, points },
  );
  const image = await page.screenshot({ type: 'jpeg', quality: 78 });
  writeFileSync(join(OUT, `${id}.jpg`), image);
  console.log(`${id}.jpg  ${(image.length / 1024).toFixed(0)} KB  ${points.length} resorts`);
}
await browser.close();
