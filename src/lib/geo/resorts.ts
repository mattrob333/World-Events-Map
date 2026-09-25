/**
 * Ski resorts people name when they say "the Alps" or "Japan": where they are,
 * so a ski request can consider places the event calendar has nothing on yet.
 * Coordinates and town elevations are the resort town's GeoNames record
 * (cities500, CC BY 4.0), checked 2026-09-25. Aliases cover linked areas and
 * the names people actually say ("Val Gardena" for Selva and Ortisei).
 */
export type Resort = {
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** Town (base) elevation in meters, from GeoNames; shown in feet. */
  baseM: number;
  aliases: string[];
};

export const RESORTS: readonly Resort[] = [
  // Switzerland
  { name: 'Zermatt', country: 'Switzerland', lat: 46.02, lon: 7.749, baseM: 1610, aliases: [] },
  { name: 'Verbier', country: 'Switzerland', lat: 46.1, lon: 7.227, baseM: 1515, aliases: ['4 Vallées', 'Four Valleys'] },
  { name: 'St. Moritz', country: 'Switzerland', lat: 46.499, lon: 9.843, baseM: 1845, aliases: ['St Moritz', 'Sankt Moritz', 'Engadin', 'Engadine'] },
  { name: 'Davos', country: 'Switzerland', lat: 46.804, lon: 9.837, baseM: 1560, aliases: ['Klosters', 'Davos Klosters'] },
  { name: 'Gstaad', country: 'Switzerland', lat: 46.472, lon: 7.287, baseM: 1055, aliases: [] },
  { name: 'Saas-Fee', country: 'Switzerland', lat: 46.108, lon: 7.927, baseM: 1792, aliases: ['Saas Fee'] },
  { name: 'Crans-Montana', country: 'Switzerland', lat: 46.313, lon: 7.479, baseM: 1547, aliases: ['Crans Montana'] },
  { name: 'Andermatt', country: 'Switzerland', lat: 46.636, lon: 8.594, baseM: 1441, aliases: [] },
  { name: 'Engelberg', country: 'Switzerland', lat: 46.821, lon: 8.401, baseM: 1001, aliases: ['Titlis'] },
  { name: 'Laax', country: 'Switzerland', lat: 46.805, lon: 9.258, baseM: 1011, aliases: ['Flims'] },
  { name: 'Arosa', country: 'Switzerland', lat: 46.778, lon: 9.676, baseM: 1801, aliases: ['Lenzerheide'] },
  { name: 'Grindelwald', country: 'Switzerland', lat: 46.624, lon: 8.036, baseM: 1047, aliases: ['Jungfrau', 'Jungfrau region'] },
  { name: 'Lauterbrunnen', country: 'Switzerland', lat: 46.593, lon: 7.909, baseM: 787, aliases: ['Wengen', 'Mürren', 'Murren'] },
  { name: 'Villars-sur-Ollon', country: 'Switzerland', lat: 46.298, lon: 7.056, baseM: 1273, aliases: ['Villars'] },
  // France
  { name: 'Chamonix', country: 'France', lat: 45.924, lon: 6.869, baseM: 1044, aliases: ['Chamonix-Mont-Blanc', 'Mont Blanc'] },
  { name: 'Courchevel', country: 'France', lat: 45.415, lon: 6.636, baseM: 1756, aliases: ['Courchevel 1850', '3 Vallées', 'Three Valleys'] },
  { name: 'Méribel', country: 'France', lat: 45.415, lon: 6.565, baseM: 1424, aliases: ['Meribel'] },
  { name: 'Val Thorens', country: 'France', lat: 45.298, lon: 6.584, baseM: 2333, aliases: [] },
  { name: "Val d'Isère", country: 'France', lat: 45.451, lon: 6.975, baseM: 1823, aliases: ["Val-d'Isère", 'Val d Isere', 'Val Disere'] },
  { name: 'Tignes', country: 'France', lat: 45.496, lon: 6.925, baseM: 1802, aliases: [] },
  { name: 'Megève', country: 'France', lat: 45.857, lon: 6.618, baseM: 1105, aliases: ['Megeve'] },
  { name: 'Morzine', country: 'France', lat: 46.181, lon: 6.707, baseM: 953, aliases: ['Avoriaz', 'Portes du Soleil'] },
  { name: 'Les Arcs', country: 'France', lat: 45.615, lon: 6.768, baseM: 834, aliases: ['Bourg-Saint-Maurice', 'Paradiski'] },
  { name: 'La Plagne', country: 'France', lat: 45.556, lon: 6.65, baseM: 678, aliases: ['Aime-la-Plagne'] },
  { name: "Alpe d'Huez", country: 'France', lat: 45.082, lon: 6.059, baseM: 1511, aliases: ['Alpe d Huez', 'Huez'] },
  { name: 'Les Deux Alpes', country: 'France', lat: 45.012, lon: 6.125, baseM: 1655, aliases: ['Deux Alpes'] },
  { name: 'Serre Chevalier', country: 'France', lat: 44.926, lon: 6.608, baseM: 1354, aliases: ['Briançon', 'Briancon'] },
  { name: 'La Clusaz', country: 'France', lat: 45.907, lon: 6.434, baseM: 1095, aliases: [] },
  // Austria
  { name: 'Kitzbühel', country: 'Austria', lat: 47.446, lon: 12.392, baseM: 751, aliases: ['Kitzbuhel', 'Kitzbuehel'] },
  { name: 'St. Anton', country: 'Austria', lat: 47.128, lon: 10.264, baseM: 1307, aliases: ['St Anton', 'Sankt Anton', 'St. Anton am Arlberg', 'Arlberg'] },
  { name: 'Lech', country: 'Austria', lat: 47.208, lon: 10.142, baseM: 1442, aliases: ['Zürs', 'Zurs', 'Lech Zürs'] },
  { name: 'Ischgl', country: 'Austria', lat: 47.013, lon: 10.292, baseM: 1378, aliases: [] },
  { name: 'Sölden', country: 'Austria', lat: 46.967, lon: 11.0, baseM: 1526, aliases: ['Solden', 'Ötztal', 'Otztal'] },
  { name: 'Obergurgl', country: 'Austria', lat: 46.878, lon: 11.034, baseM: 1887, aliases: ['Gurgl', 'Hochgurgl'] },
  { name: 'Mayrhofen', country: 'Austria', lat: 47.167, lon: 11.867, baseM: 641, aliases: ['Zillertal'] },
  { name: 'Saalbach', country: 'Austria', lat: 47.391, lon: 12.636, baseM: 1003, aliases: ['Saalbach-Hinterglemm'] },
  { name: 'Zell am See', country: 'Austria', lat: 47.323, lon: 12.798, baseM: 764, aliases: ['Kaprun'] },
  { name: 'Bad Gastein', country: 'Austria', lat: 47.115, lon: 13.135, baseM: 998, aliases: ['Gastein'] },
  { name: 'Obertauern', country: 'Austria', lat: 47.304, lon: 13.507, baseM: 1082, aliases: ['Untertauern'] },
  // Italy
  { name: "Cortina d'Ampezzo", country: 'Italy', lat: 46.537, lon: 12.139, baseM: 1205, aliases: ['Cortina'] },
  { name: 'Courmayeur', country: 'Italy', lat: 45.797, lon: 6.969, baseM: 1224, aliases: [] },
  { name: 'Cervinia', country: 'Italy', lat: 45.934, lon: 7.632, baseM: 2023, aliases: ['Breuil-Cervinia'] },
  { name: 'Madonna di Campiglio', country: 'Italy', lat: 46.227, lon: 10.826, baseM: 1514, aliases: ['Campiglio'] },
  { name: 'Livigno', country: 'Italy', lat: 46.536, lon: 10.133, baseM: 1819, aliases: [] },
  { name: 'Val Gardena', country: 'Italy', lat: 46.555, lon: 11.76, baseM: 1567, aliases: ['Selva', 'Selva di Val Gardena', 'Ortisei', 'Dolomiti Superski'] },
  { name: 'Alta Badia', country: 'Italy', lat: 46.55, lon: 11.873, baseM: 1532, aliases: ['Corvara', 'Corvara in Badia'] },
  { name: 'Bormio', country: 'Italy', lat: 46.467, lon: 10.37, baseM: 1204, aliases: [] },
  { name: 'Sestriere', country: 'Italy', lat: 44.959, lon: 6.878, baseM: 2041, aliases: ['Via Lattea', 'Milky Way'] },
  // Germany
  { name: 'Garmisch-Partenkirchen', country: 'Germany', lat: 47.492, lon: 11.096, baseM: 705, aliases: ['Garmisch', 'Zugspitze'] },
  { name: 'Oberstdorf', country: 'Germany', lat: 47.407, lon: 10.279, baseM: 819, aliases: [] },
  // Japan
  { name: 'Niseko', country: 'Japan', lat: 42.809, lon: 140.686, baseM: 103, aliases: ['Kutchan', 'Hirafu', 'Niseko United'] },
  { name: 'Rusutsu', country: 'Japan', lat: 42.734, lon: 140.873, baseM: 366, aliases: [] },
  { name: 'Furano', country: 'Japan', lat: 43.35, lon: 142.383, baseM: 170, aliases: [] },
  { name: 'Hakuba', country: 'Japan', lat: 36.698, lon: 137.862, baseM: 702, aliases: ['Happo-one', 'Happo'] },
  { name: 'Nozawa Onsen', country: 'Japan', lat: 36.921, lon: 138.446, baseM: 565, aliases: ['Nozawa'] },
  { name: 'Myoko', country: 'Japan', lat: 37.025, lon: 138.256, baseM: 79, aliases: ['Myoko Kogen'] },
  { name: 'Yuzawa', country: 'Japan', lat: 36.938, lon: 138.813, baseM: 343, aliases: ['Naeba', 'Gala Yuzawa'] },
];
