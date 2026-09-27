import { RESORTS } from './resorts';

/**
 * The cold map: when the snow is usually good, by mountain region. Seasons are
 * the typical ski months for each region (openings and closings move with
 * each winter, and glacier and high resorts run longer), shown as typical,
 * never as this year's dates. Pure data.
 */
export type SnowRegion = 'rockies' | 'northeast' | 'alps' | 'japan' | 'south';
export type Season = { label: string; core: readonly number[]; peak: readonly number[]; shoulder: readonly number[] };

/** Months 1–12. */
export const SEASONS: Record<SnowRegion, Season> = {
  rockies: { label: 'Western North America: typically late November to mid-April, deepest January to March', core: [12, 1, 2, 3], peak: [1, 2, 3], shoulder: [11, 4] },
  northeast: { label: 'Northeastern US: typically December to March, best January and February', core: [12, 1, 2, 3], peak: [1, 2], shoulder: [11, 4] },
  alps: { label: 'The Alps: typically December to April, best February and March', core: [12, 1, 2, 3], peak: [2, 3], shoulder: [4] },
  japan: { label: 'Japan: typically December to March, the famous powder January and February', core: [12, 1, 2, 3], peak: [1, 2], shoulder: [4] },
  south: { label: 'Southern Hemisphere: typically June to September, best July and August', core: [6, 7, 8, 9], peak: [7, 8], shoulder: [10] },
};

export type SnowSpot = { name: string; country: string; lat: number; lon: number; region: SnowRegion };

// Resort towns outside the Alps and Japan. Coordinates are the town's GeoNames
// record (cities500, CC BY 4.0), checked 2026-09-27.
const MORE: readonly SnowSpot[] = [
  { name: 'Vail', country: 'United States', lat: 39.64, lon: -106.374, region: 'rockies' },
  { name: 'Aspen', country: 'United States', lat: 39.191, lon: -106.818, region: 'rockies' },
  { name: 'Breckenridge', country: 'United States', lat: 39.482, lon: -106.038, region: 'rockies' },
  { name: 'Telluride', country: 'United States', lat: 37.937, lon: -107.812, region: 'rockies' },
  { name: 'Steamboat Springs', country: 'United States', lat: 40.485, lon: -106.832, region: 'rockies' },
  { name: 'Crested Butte', country: 'United States', lat: 38.87, lon: -106.988, region: 'rockies' },
  { name: 'Winter Park', country: 'United States', lat: 39.892, lon: -105.763, region: 'rockies' },
  { name: 'Park City', country: 'United States', lat: 40.646, lon: -111.498, region: 'rockies' },
  { name: 'Jackson Hole', country: 'United States', lat: 43.48, lon: -110.762, region: 'rockies' },
  { name: 'Big Sky', country: 'United States', lat: 45.285, lon: -111.368, region: 'rockies' },
  { name: 'Sun Valley', country: 'United States', lat: 43.681, lon: -114.364, region: 'rockies' },
  { name: 'Taos', country: 'United States', lat: 36.407, lon: -105.573, region: 'rockies' },
  { name: 'Mammoth Lakes', country: 'United States', lat: 37.649, lon: -118.972, region: 'rockies' },
  { name: 'Lake Tahoe (Truckee)', country: 'United States', lat: 39.328, lon: -120.183, region: 'rockies' },
  { name: 'Alyeska (Girdwood)', country: 'United States', lat: 60.943, lon: -149.166, region: 'rockies' },
  { name: 'Whistler', country: 'Canada', lat: 50.118, lon: -122.954, region: 'rockies' },
  { name: 'Banff', country: 'Canada', lat: 51.176, lon: -115.57, region: 'rockies' },
  { name: 'Lake Louise', country: 'Canada', lat: 51.425, lon: -116.179, region: 'rockies' },
  { name: 'Revelstoke', country: 'Canada', lat: 50.997, lon: -118.195, region: 'rockies' },
  { name: 'Stowe', country: 'United States', lat: 44.465, lon: -72.685, region: 'northeast' },
  { name: 'Jindabyne (Thredbo, Perisher)', country: 'Australia', lat: -36.417, lon: 148.623, region: 'south' },
  { name: 'Queenstown', country: 'New Zealand', lat: -45.03, lon: 168.663, region: 'south' },
  { name: 'Wanaka', country: 'New Zealand', lat: -44.7, lon: 169.15, region: 'south' },
  { name: 'Bariloche', country: 'Argentina', lat: -41.146, lon: -71.308, region: 'south' },
];

const REGION_BY_COUNTRY: Record<string, SnowRegion> = { Japan: 'japan' };

export const SNOW_SPOTS: readonly SnowSpot[] = [
  ...RESORTS.map((resort) => ({ name: resort.name, country: resort.country, lat: resort.lat, lon: resort.lon, region: REGION_BY_COUNTRY[resort.country] ?? 'alps' })),
  ...MORE,
];

export type SnowLevel = 'peak' | 'season' | 'edge' | 'off';

/** How good a month usually is for a region: its best months, the season, the edges, or out of season. */
export function snowLevel(region: SnowRegion, month: number): SnowLevel {
  const season = SEASONS[region];
  if (season.peak.includes(month)) return 'peak';
  if (season.core.includes(month)) return 'season';
  if (season.shoulder.includes(month)) return 'edge';
  return 'off';
}
