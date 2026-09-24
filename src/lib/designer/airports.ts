import { homeAirport } from './itinerary';

/**
 * Main international airport for well-known travel cities, matched on the
 * city name exactly (so "Rome, Georgia" is not Rome, Italy only by accident
 * of region; callers pass the region-free name). Unknown places get no
 * airport, and the canvas says fares need one.
 */
const CITY_AIRPORTS: Record<string, string> = {
  lisbon: 'LIS', lisboa: 'LIS', porto: 'OPO', madrid: 'MAD', barcelona: 'BCN', seville: 'SVQ', malaga: 'AGP',
  ibiza: 'IBZ', mallorca: 'PMI', rome: 'FCO', milan: 'MXP', florence: 'FLR', venice: 'VCE', naples: 'NAP',
  amsterdam: 'AMS', berlin: 'BER', munich: 'MUC', vienna: 'VIE', prague: 'PRG', budapest: 'BUD', copenhagen: 'CPH',
  stockholm: 'ARN', oslo: 'OSL', reykjavik: 'KEF', dublin: 'DUB', edinburgh: 'EDI', london: 'LHR', paris: 'CDG',
  nice: 'NCE', zurich: 'ZRH', geneva: 'GVA', athens: 'ATH', santorini: 'JTR', mykonos: 'JMK', istanbul: 'IST',
  dubrovnik: 'DBV', split: 'SPU', marrakech: 'RAK', 'cape town': 'CPT', nairobi: 'NBO', cairo: 'CAI', dubai: 'DXB',
  tokyo: 'HND', kyoto: 'KIX', osaka: 'KIX', seoul: 'ICN', bangkok: 'BKK', bali: 'DPS', singapore: 'SIN',
  'hong kong': 'HKG', sydney: 'SYD', melbourne: 'MEL', auckland: 'AKL', honolulu: 'HNL', maui: 'OGG',
  cancun: 'CUN', tulum: 'CUN', 'mexico city': 'MEX', 'cabo san lucas': 'SJD', 'puerto vallarta': 'PVR',
  'san juan': 'SJU', havana: 'HAV', 'buenos aires': 'EZE', 'rio de janeiro': 'GIG', lima: 'LIM', cartagena: 'CTG',
  medellin: 'MDE', toronto: 'YYZ', montreal: 'YUL', vancouver: 'YVR', 'new york': 'JFK', 'los angeles': 'LAX',
  'las vegas': 'LAS', 'new orleans': 'MSY', nashville: 'BNA', austin: 'AUS', miami: 'MIA', chicago: 'ORD',
  'san francisco': 'SFO', seattle: 'SEA', denver: 'DEN', boston: 'BOS', aspen: 'ASE', vail: 'EGE',
  'salt lake city': 'SLC', 'park city': 'SLC', 'jackson hole': 'JAC', 'san diego': 'SAN', portland: 'PDX',
  atlanta: 'ATL', orlando: 'MCO', 'washington': 'IAD', philadelphia: 'PHL', charlotte: 'CLT', dallas: 'DFW',
  houston: 'IAH', phoenix: 'PHX', 'st. louis': 'STL', 'st louis': 'STL', 'kansas city': 'MCI', detroit: 'DTW',
  minneapolis: 'MSP', savannah: 'SAV', charleston: 'CHS', 'key west': 'EYW', 'monte carlo': 'NCE', monaco: 'NCE',
  niseko: 'CTS', 'male': 'MLE', maldives: 'MLE',
};

export function cityAirport(name?: string): string | undefined {
  if (!name) return undefined;
  const city = name.split(',')[0].trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return CITY_AIRPORTS[city];
}

/** The traveler's home airport: the hometown helper first, then the city table. */
export function originAirport(hometown?: string): string | undefined {
  return homeAirport(hometown) ?? cityAirport(hometown);
}
