/** dope.travel shows distances in miles (and feet up close). Data and providers stay metric. */
export const KM_PER_MILE = 1.609344;

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

/** Trip-scale distance: "4,600 mi", "85 mi", "6.2 mi". */
export function formatMiles(km: number): string {
  const miles = kmToMiles(km);
  if (miles >= 1000) return `${(Math.round(miles / 10) * 10).toLocaleString('en-US')} mi`;
  if (miles >= 10) return `${Math.round(miles).toLocaleString('en-US')} mi`;
  return `${miles.toFixed(1)} mi`;
}

/** Walking-scale distance from meters: "450 ft away", "0.8 mi away". */
export function formatNearby(meters: number): string {
  const miles = meters / 1000 / KM_PER_MILE;
  if (miles < 0.1) return `${Math.max(10, Math.round((meters * 3.28084) / 10) * 10)} ft away`;
  return `${miles.toFixed(1)} mi away`;
}
