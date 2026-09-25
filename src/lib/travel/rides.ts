import { originAirport } from '@/lib/designer/airports';

/**
 * Ride hand-offs to the airport: an Uber or Lyft link with the drop-off set
 * to the airport's exact coordinates and pickup left as "where you are", so
 * the app on the phone fills in the start. dope.travel books nothing.
 * Airports: OurAirports (public domain), scheduled-service airports with an
 * IATA code, in /geo/airports.txt as "IATA|name|lat|lon".
 */

export type Airport = { iata: string; name: string; lat: number; lon: number };

export function parseAirports(text: string): Map<string, Airport> {
  const out = new Map<string, Airport>();
  for (const line of text.split('\n')) {
    const [iata, name, lat, lon] = line.split('|');
    const la = Number(lat);
    const lo = Number(lon);
    if (!iata || !/^[A-Z0-9]{3}$/.test(iata) || !name || !Number.isFinite(la) || !Number.isFinite(lo)) continue;
    if (!out.has(iata)) out.set(iata, { iata, name, lat: la, lon: lo });
  }
  return out;
}

let loading: Promise<Map<string, Airport>> | null = null;

/** Fetched once per visit, only when a trip needs a ride card. */
export function loadAirports(): Promise<Map<string, Airport>> {
  loading ??= fetch('/geo/airports.txt')
    .then((response) => (response.ok ? response.text() : ''))
    .then(parseAirports)
    .catch(() => {
      loading = null;
      return new Map<string, Airport>();
    });
  return loading;
}

/** The airport they fly from: an explicit "(ATL)" in their hometown wins, then the city tables. */
export function homeIata(hometown?: string): string | undefined {
  const explicit = hometown?.match(/\(([A-Z]{3})\)/)?.[1];
  return explicit ?? originAirport(hometown);
}

export function rideLinks(airport: Airport): { uber: string; lyft: string } {
  const lat = airport.lat.toFixed(6);
  const lon = airport.lon.toFixed(6);
  const uber = new URL('https://m.uber.com/ul/');
  uber.searchParams.set('action', 'setPickup');
  uber.searchParams.set('pickup', 'my_location');
  uber.searchParams.set('dropoff[latitude]', lat);
  uber.searchParams.set('dropoff[longitude]', lon);
  uber.searchParams.set('dropoff[nickname]', `${airport.iata} airport`);
  uber.searchParams.set('dropoff[formatted_address]', airport.name);
  const lyft = new URL('https://lyft.com/ride');
  lyft.searchParams.set('id', 'lyft');
  lyft.searchParams.set('destination[latitude]', lat);
  lyft.searchParams.set('destination[longitude]', lon);
  return { uber: uber.toString(), lyft: lyft.toString() };
}
