/**
 * Editorial idea cards for the trip designer. Every card is an idea, never a
 * booking, fare, or availability claim. Video and reel cards link to a live
 * YouTube search or Instagram hashtag — dope.travel does not host or scrape
 * those posts, so the card says where the link goes instead of faking a feed.
 */

export type SlotKind =
  | 'depart'
  | 'flight'
  | 'arrive'
  | 'morning'
  | 'lunch'
  | 'afternoon'
  | 'apres'
  | 'dinner'
  | 'late';

export type CardMedia = 'photo' | 'video' | 'reel' | 'poster';

export type DesignerCard = {
  id: string;
  destination: DestinationId | 'any' | 'custom';
  slots: SlotKind[];
  title: string;
  /** Short hype line, written as an idea. */
  blurb: string;
  media: CardMedia;
  image?: string;
  palette: [string, string];
  emoji: string;
  tags: string[];
  link?: { href: string; label: string };
};

export type DestinationId = 'st-moritz' | 'aspen' | 'courchevel' | 'maldives';

export type DestinationKind = 'ski' | 'beach' | 'city';

export type DesignerDestination = {
  id: DestinationId | 'custom';
  name: string;
  region: string;
  kind: DestinationKind;
  /** Curated destinations have an editorial hero; typed-in places use a gradient. */
  hero?: string;
  hashtag: string;
  palette: [string, string];
  gateway: { iata: string; airport: string; onward: string };
  tagline: string;
};

export const SLOT_META: Record<SlotKind, { label: string; time: string; emoji: string }> = {
  depart: { label: 'Leave home', time: 'Early', emoji: '🚗' },
  flight: { label: 'The flight', time: 'Travel', emoji: '✈️' },
  arrive: { label: 'Arrival & transfer', time: 'Arrive', emoji: '🛬' },
  morning: { label: 'Morning', time: '9:00', emoji: '🌅' },
  lunch: { label: 'Lunch', time: '12:30', emoji: '🍽️' },
  afternoon: { label: 'Afternoon', time: '14:30', emoji: '☀️' },
  apres: { label: 'Après', time: '16:30', emoji: '🥂' },
  dinner: { label: 'Dinner', time: '19:30', emoji: '🕯️' },
  late: { label: 'Late night', time: '22:30', emoji: '🌙' },
};

export const DESTINATIONS: DesignerDestination[] = [
  {
    id: 'st-moritz', name: 'St. Moritz', region: 'Engadin, Switzerland', kind: 'ski',
    hero: '/editorial/destination-st-moritz-lake.jpg', hashtag: 'stmoritz', palette: ['#1e3a8a', '#e0f2fe'],
    gateway: { iata: 'ZRH', airport: 'Zurich', onward: 'Rhaetian Railway to St. Moritz (about 3.5 h), or a car transfer' },
    tagline: 'Champagne air, frozen lakes, and the original winter resort.',
  },
  {
    id: 'aspen', name: 'Aspen', region: 'Colorado, USA', kind: 'ski',
    hero: '/editorial/destination-aspen-hero.jpg', hashtag: 'aspen', palette: ['#7c2d12', '#fde68a'],
    gateway: { iata: 'ASE', airport: 'Aspen/Pitkin County', onward: 'or fly into Denver and drive about 3.5 h over the pass' },
    tagline: 'Four mountains, one legendary town, and après that turns into a party.',
  },
  {
    id: 'courchevel', name: 'Courchevel', region: 'Les 3 Vallées, France', kind: 'ski',
    hero: '/editorial/destination-courchevel-village.jpg', hashtag: 'courchevel', palette: ['#831843', '#fbcfe8'],
    gateway: { iata: 'GVA', airport: 'Geneva', onward: 'car transfer to Courchevel (about 2.5 h)' },
    tagline: 'The biggest linked ski area on earth, with a very French idea of lunch.',
  },
  {
    id: 'maldives', name: 'Maldives', region: 'Baa Atoll', kind: 'beach',
    hero: '/editorial/hanifaru-manta-aggregation.jpg', hashtag: 'maldives', palette: ['#0e7490', '#a5f3fc'],
    gateway: { iata: 'MLE', airport: 'Malé Velana', onward: 'seaplane or domestic flight plus boat to your island' },
    tagline: 'House reefs off the deck, mantas in season, sandbanks at sunset.',
  },
];

export const DESTINATION_INDEX = new Map(DESTINATIONS.map((d) => [d.id, d]));

const yt = (query: string) => ({
  href: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  label: 'Watch on YouTube',
});
const ig = (tag: string) => ({ href: `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`, label: `#${tag} on Instagram` });
const maps = (query: string) => ({
  href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  label: 'Open in Maps',
});

type Seed = Omit<DesignerCard, 'id' | 'destination'> & { id: string };

function place(destination: DestinationId, seeds: Seed[]): DesignerCard[] {
  return seeds.map((seed) => ({ ...seed, id: `${destination}:${seed.id}`, destination }));
}

const ST_MORITZ = place('st-moritz', [
  { id: 'glacier-train', slots: ['arrive'], title: 'Scenic train up the Albula line', blurb: 'Viaducts, spiral tunnels, snow walls. The kids will film the whole way.', media: 'video', image: '/editorial/destination-st-moritz-lake.jpg', palette: ['#991b1b', '#fecaca'], emoji: '🚂', tags: ['kids', 'views'], link: yt('Albula line train St. Moritz winter') },
  { id: 'corviglia-first-tracks', slots: ['morning'], title: 'First chairs on Corviglia', blurb: 'Wide cruisers for the boys, groomers with lake views for you.', media: 'video', image: '/editorial/st-moritz-new-year-week.jpg', palette: ['#1e40af', '#bfdbfe'], emoji: '⛷️', tags: ['ski', 'kids', 'big-kids'], link: yt('Corviglia St. Moritz skiing') },
  { id: 'diavolezza', slots: ['morning', 'afternoon'], title: 'Diavolezza glacier descent', blurb: 'Big-mountain skiing with glacier views. Best for confident skiers.', media: 'video', palette: ['#0f172a', '#93c5fd'], emoji: '🏔️', tags: ['ski', 'active', 'views', 'big-kids'], link: yt('Diavolezza glacier run skiing') },
  { id: 'ski-school', slots: ['morning'], title: 'Swiss ski school for the kids', blurb: 'Half-day group lessons so the parents get a few runs alone.', media: 'poster', palette: ['#dc2626', '#fef2f2'], emoji: '🎿', tags: ['kids', 'little-kids', 'ski'], link: maps('Ski school St. Moritz') },
  { id: 'el-paradiso', slots: ['lunch'], title: 'El Paradiso on the slope', blurb: 'Sun-deck lunch above the valley with a view you will screenshot.', media: 'reel', palette: ['#b45309', '#fde68a'], emoji: '🍝', tags: ['food', 'views', 'nightlife'], link: ig('elparadisostmoritz') },
  { id: 'mathis', slots: ['lunch'], title: 'Mathis Food Affairs, Corviglia', blurb: 'Reto Mathis’s mountain restaurant at the top of Corviglia.', media: 'poster', palette: ['#7c3aed', '#ede9fe'], emoji: '🥘', tags: ['food'], link: maps('Mathis Food Affairs Corviglia') },
  { id: 'hanselmann', slots: ['afternoon', 'morning'], title: 'Hanselmann for Engadine nut cake', blurb: 'Classic café since 1894. Hot chocolate for the kids, nusstorte to go.', media: 'poster', palette: ['#be185d', '#fce7f3'], emoji: '☕', tags: ['kids', 'food'], link: maps('Hanselmann St. Moritz') },
  { id: 'cresta-run', slots: ['afternoon', 'morning'], title: 'Watch the Cresta Run', blurb: 'Head-first down natural ice at motorway speeds. Watching is wild.', media: 'video', image: '/editorial/cresta-run-season-st-moritz.jpg', palette: ['#0c4a6e', '#bae6fd'], emoji: '🛷', tags: ['sports', 'kids', 'big-kids'], link: yt('Cresta Run St. Moritz') },
  { id: 'bobsled', slots: ['afternoon'], title: 'Olympia Bob Run guest ride', blurb: 'The world’s only natural-ice bobsled track. Age limits apply.', media: 'video', palette: ['#1d4ed8', '#e0e7ff'], emoji: '🏎️', tags: ['sports', 'active', 'big-kids'], link: yt('Olympia Bob Run St. Moritz guest ride') },
  { id: 'white-turf', slots: ['afternoon'], title: 'White Turf races on the frozen lake', blurb: 'Horse racing on ice (February Sundays). Pure spectacle.', media: 'photo', image: '/editorial/white-turf-st-moritz.jpg', palette: ['#0369a1', '#e0f2fe'], emoji: '🐎', tags: ['sports', 'views'], link: ig('whiteturf') },
  { id: 'muottas', slots: ['afternoon', 'apres'], title: 'Funicular to Muottas Muragl at sunset', blurb: 'The Engadin lakes turn pink. Sledding run back down for the kids.', media: 'reel', palette: ['#c2410c', '#fed7aa'], emoji: '🌄', tags: ['views', 'kids'], link: ig('muottasmuragl') },
  { id: 'lake-walk', slots: ['afternoon'], title: 'Frozen-lake walk and snow polo field', blurb: 'Walk the lake, find the polo pitch, throw snowballs.', media: 'photo', image: '/editorial/destination-st-moritz-lake.jpg', palette: ['#0891b2', '#cffafe'], emoji: '❄️', tags: ['kids', 'little-kids', 'views'], link: ig('stmoritz') },
  { id: 'badrutts-apres', slots: ['apres'], title: "Afternoon tea at Badrutt's Palace", blurb: 'The Grand Hall, a fire, a pianist. Hot chocolate counts as tea.', media: 'reel', palette: ['#78350f', '#fef3c7'], emoji: '🫖', tags: ['kids', 'food'], link: ig('badruttspalace') },
  { id: 'sunny-bar', slots: ['apres', 'late'], title: 'Sunny Bar at the Kulm', blurb: 'The Cresta crowd, dark wood, stiff drinks.', media: 'poster', palette: ['#422006', '#fcd34d'], emoji: '🥃', tags: ['nightlife', 'sports'], link: maps('Sunny Bar Kulm Hotel St. Moritz') },
  { id: 'chesa-veglia', slots: ['dinner'], title: 'Chesa Veglia', blurb: 'Pizza by the fire downstairs, grill room upstairs. Easy win with kids.', media: 'poster', palette: ['#b91c1c', '#fee2e2'], emoji: '🍕', tags: ['kids', 'food', 'hearty'], link: maps('Chesa Veglia St. Moritz') },
  { id: 'fondue', slots: ['dinner'], title: 'Fondue night in a stübli', blurb: 'Pine walls, cheese, bread cubes, nobody fights about the menu.', media: 'poster', palette: ['#ca8a04', '#fef9c3'], emoji: '🫕', tags: ['kids', 'hearty', 'food'], link: maps('fondue St. Moritz') },
  { id: 'kings-club', slots: ['late'], title: "King's Club", blurb: 'Badrutt\'s Palace nightclub. Late and loud.', media: 'reel', palette: ['#6b21a8', '#f5d0fe'], emoji: '🪩', tags: ['nightlife', 'music'], link: ig('kingsclubstmoritz') },
  { id: 'sledding-night', slots: ['late', 'afternoon'], title: 'Night sledding at Preda', blurb: 'A long, lit toboggan run by train from St. Moritz. Check night-run dates.', media: 'video', palette: ['#1e3a8a', '#c7d2fe'], emoji: '🛷', tags: ['kids', 'active'], link: yt('Preda Bergün night sledding') },
]);

const ASPEN = place('aspen', [
  { id: 'free-shuttle', slots: ['arrive'], title: 'Land at ASE, free bus into town', blurb: 'One of the most dramatic approaches in American aviation. Window seat.', media: 'video', image: '/editorial/destination-aspen-hero.jpg', palette: ['#9a3412', '#ffedd5'], emoji: '🛬', tags: ['views'], link: yt('landing Aspen airport cockpit') },
  { id: 'buttermilk-kids', slots: ['morning'], title: 'Buttermilk for the kids', blurb: 'Gentle terrain, X Games pipe to gawk at, ski school base.', media: 'photo', image: '/editorial/x-games-aspen.jpg', palette: ['#ea580c', '#ffedd5'], emoji: '🎿', tags: ['kids', 'little-kids', 'ski'], link: yt('Buttermilk Aspen kids skiing') },
  { id: 'highland-bowl', slots: ['morning'], title: 'Hike Highland Bowl', blurb: 'The bootpack, the prayer flags, the payoff. Experts only.', media: 'video', palette: ['#1e293b', '#cbd5e1'], emoji: '🏔️', tags: ['ski', 'active', 'views'], link: yt('Highland Bowl hike Aspen') },
  { id: 'snowmass', slots: ['morning', 'afternoon'], title: 'Snowmass cruisers', blurb: 'Huge, sunny, and long. Everyone skis together here.', media: 'video', palette: ['#0369a1', '#e0f2fe'], emoji: '⛷️', tags: ['ski', 'kids', 'big-kids'], link: yt('Snowmass skiing') },
  { id: 'cloud-nine', slots: ['lunch'], title: 'Cloud Nine Alpine Bistro', blurb: 'The champagne-spraying lunch party at Highlands. Book early.', media: 'reel', palette: ['#be123c', '#ffe4e6'], emoji: '🍾', tags: ['nightlife', 'food', 'music'], link: ig('cloudnineaspen') },
  { id: 'bonnies', slots: ['lunch'], title: "Bonnie's on Ajax", blurb: 'Mid-mountain classic. Get the white bean chili.', media: 'poster', palette: ['#a16207', '#fef9c3'], emoji: '🥣', tags: ['kids', 'hearty'], link: maps("Bonnie's Aspen Mountain") },
  { id: 'town-walk', slots: ['afternoon'], title: 'Downtown Aspen stroll', blurb: 'Galleries, ski shops, the gondola plaza, people-watching.', media: 'photo', image: '/editorial/destination-aspen-street.jpg', palette: ['#b45309', '#fef3c7'], emoji: '🛍️', tags: ['shopping', 'culture'], link: ig('aspen') },
  { id: 'ice-skating', slots: ['afternoon'], title: 'Skate the Silver Circle rink', blurb: 'Outdoor skating at the base of Aspen Mountain.', media: 'poster', palette: ['#0891b2', '#cffafe'], emoji: '⛸️', tags: ['kids', 'little-kids'], link: maps('Silver Circle ice rink Aspen') },
  { id: 'ajax-tavern', slots: ['apres'], title: 'Ajax Tavern patio', blurb: 'Truffle fries at the bottom of the gondola. The classic.', media: 'reel', palette: ['#7c2d12', '#fed7aa'], emoji: '🍟', tags: ['food', 'kids', 'nightlife'], link: ig('ajaxtavern') },
  { id: 'chair-9', slots: ['apres', 'late'], title: 'Chair 9 at The Little Nell', blurb: 'Après that turns into a dance floor.', media: 'reel', palette: ['#4c1d95', '#ddd6fe'], emoji: '🪩', tags: ['nightlife', 'music'], link: ig('chair9') },
  { id: 'matsuhisa', slots: ['dinner'], title: 'Matsuhisa Aspen', blurb: 'Black cod miso in a Victorian house. Date-night energy.', media: 'poster', palette: ['#111827', '#fca5a5'], emoji: '🍣', tags: ['food'], link: maps('Matsuhisa Aspen') },
  { id: 'white-house', slots: ['dinner', 'lunch'], title: 'White House Tavern', blurb: 'Crispy chicken sandwich, cozy tiny room, always a line.', media: 'poster', palette: ['#991b1b', '#fee2e2'], emoji: '🥪', tags: ['kids', 'hearty'], link: maps('White House Tavern Aspen') },
  { id: 'belly-up', slots: ['late'], title: 'A show at Belly Up', blurb: 'Big names in a 450-cap room. Check who is playing your week.', media: 'video', palette: ['#831843', '#fbcfe8'], emoji: '🎤', tags: ['music', 'nightlife'], link: yt('Belly Up Aspen live') },
  { id: 'sleigh-dinner', slots: ['dinner'], title: 'Dinner out at Pine Creek Cookhouse', blurb: 'A cabin up the Castle Creek valley. Ask about getting there by sleigh.', media: 'photo', image: '/editorial/aspen-christmas-week.jpg', palette: ['#14532d', '#dcfce7'], emoji: '🛷', tags: ['kids', 'views', 'hearty'], link: maps('Pine Creek Cookhouse Aspen') },
]);

const COURCHEVEL = place('courchevel', [
  { id: 'altiport', slots: ['arrive'], title: 'Fly into the Altiport', blurb: 'A 537 m uphill runway. Or a gentler transfer from Geneva.', media: 'video', palette: ['#9f1239', '#ffe4e6'], emoji: '🛩️', tags: ['views'], link: yt('Courchevel altiport landing') },
  { id: 'saulire', slots: ['morning'], title: 'Saulire to the 3 Vallées', blurb: 'Ski over to Méribel and back before lunch.', media: 'video', image: '/editorial/courchevel-peak-week.jpg', palette: ['#1d4ed8', '#dbeafe'], emoji: '⛷️', tags: ['ski', 'big-kids', 'active'], link: yt('Saulire Courchevel skiing') },
  { id: 'esf', slots: ['morning'], title: 'ESF lessons for the kids', blurb: 'The famous red-jacket ski school. Médaille ceremony on Friday.', media: 'poster', palette: ['#dc2626', '#fee2e2'], emoji: '🏅', tags: ['kids', 'little-kids', 'ski'], link: maps('ESF Courchevel 1850') },
  { id: 'chalet-pierres', slots: ['lunch'], title: 'Le Chalet de Pierres', blurb: 'The terrace, the cheese trolley, the long lunch.', media: 'reel', palette: ['#b45309', '#fef3c7'], emoji: '🧀', tags: ['food', 'views'], link: ig('chaletdepierres') },
  { id: 'folie-douce', slots: ['lunch', 'apres'], title: 'La Folie Douce, Méribel', blurb: 'Cabaret, DJs on the roof, dancing in ski boots.', media: 'reel', palette: ['#c026d3', '#fae8ff'], emoji: '💃', tags: ['nightlife', 'music'], link: ig('lafoliedouce') },
  { id: 'aquamotion', slots: ['afternoon'], title: 'Aquamotion water park', blurb: 'Wave pool, slides, a lazy river, spa for the parents.', media: 'photo', palette: ['#0284c7', '#e0f2fe'], emoji: '🌊', tags: ['kids', 'little-kids', 'wellness'], link: maps('Aquamotion Courchevel') },
  { id: 'toboggan', slots: ['afternoon', 'late'], title: 'Toboggan run 1850 → 1550', blurb: 'Lit sledding track through the woods between villages.', media: 'video', palette: ['#1e3a8a', '#e0e7ff'], emoji: '🛷', tags: ['kids', 'active'], link: yt('Courchevel luge piste') },
  { id: 'village-1850', slots: ['afternoon'], title: 'Window-shop 1850', blurb: 'Rue du Rocher, hot chocolate, fur-hat spotting.', media: 'photo', image: '/editorial/destination-courchevel-village.jpg', palette: ['#9d174d', '#fce7f3'], emoji: '🛍️', tags: ['shopping'], link: ig('courchevel1850') },
  { id: 'cap-horn', slots: ['apres', 'lunch'], title: 'Le Cap Horn terrace', blurb: 'Sunshine, rosé, and the altiport runway in front of you.', media: 'reel', palette: ['#0f766e', '#ccfbf1'], emoji: '🥂', tags: ['nightlife', 'views', 'food'], link: ig('caphorncourchevel') },
  { id: 'crepes', slots: ['apres', 'afternoon'], title: 'Crêpes in the village', blurb: 'Nutella, sugar-lemon, repeat.', media: 'poster', palette: ['#a16207', '#fef9c3'], emoji: '🥞', tags: ['kids', 'little-kids', 'food'], link: maps('crêperie Courchevel 1850') },
  { id: 'savoyard', slots: ['dinner'], title: 'Savoyard night: raclette and tartiflette', blurb: 'Melted cheese at the table. The kids scrape their own.', media: 'poster', palette: ['#ca8a04', '#fefce8'], emoji: '🫕', tags: ['kids', 'hearty', 'food'], link: maps('raclette Courchevel') },
  { id: 'caves', slots: ['late'], title: 'Les Caves de Courchevel', blurb: 'The legendary club. Doors late, nights later.', media: 'reel', palette: ['#581c87', '#e9d5ff'], emoji: '🪩', tags: ['nightlife', 'music'], link: ig('lescavesdecourchevel') },
]);

const MALDIVES = place('maldives', [
  { id: 'seaplane', slots: ['arrive'], title: 'Seaplane over the atolls', blurb: 'Forty minutes of every blue there is.', media: 'video', palette: ['#0891b2', '#cffafe'], emoji: '🛩️', tags: ['views', 'kids', 'water'], link: yt('Maldives seaplane transfer') },
  { id: 'house-reef', slots: ['morning'], title: 'House-reef snorkel', blurb: 'Turtles and reef sharks off your own beach. Kids in vests.', media: 'video', palette: ['#0e7490', '#a5f3fc'], emoji: '🐢', tags: ['water', 'kids', 'big-kids'], link: yt('Maldives house reef snorkeling turtles') },
  { id: 'hanifaru', slots: ['morning', 'afternoon'], title: 'Hanifaru Bay mantas', blurb: 'Seasonal manta gatherings in the southwest monsoon. Guided, regulated snorkel only.', media: 'photo', image: '/editorial/hanifaru-manta-aggregation.jpg', palette: ['#1e3a8a', '#bfdbfe'], emoji: '🌊', tags: ['water', 'views', 'big-kids'], link: yt('Hanifaru Bay manta snorkel') },
  { id: 'kids-club', slots: ['morning', 'afternoon'], title: 'Kids club morning', blurb: 'Crab races, coconut painting, parents on a daybed.', media: 'poster', palette: ['#f97316', '#ffedd5'], emoji: '🦀', tags: ['kids', 'little-kids'], link: ig('maldiveskids') },
  { id: 'beach-lunch', slots: ['lunch'], title: 'Barefoot beach lunch', blurb: 'Grilled reef fish, fresh coconut, toes in the sand.', media: 'poster', palette: ['#65a30d', '#ecfccb'], emoji: '🥥', tags: ['kids', 'food'], link: ig('maldivesfood') },
  { id: 'paddle', slots: ['afternoon'], title: 'Clear kayak + paddleboard', blurb: 'See the reef through the hull.', media: 'reel', palette: ['#06b6d4', '#ecfeff'], emoji: '🛶', tags: ['water', 'kids', 'active'], link: ig('clearkayak') },
  { id: 'sandbank', slots: ['afternoon', 'apres'], title: 'Private sandbank picnic', blurb: 'A strip of sand, a parasol, nothing else.', media: 'reel', palette: ['#0ea5e9', '#f0f9ff'], emoji: '🏝️', tags: ['views', 'water'], link: ig('maldivessandbank') },
  { id: 'dolphin-dhoni', slots: ['apres'], title: 'Sunset dolphin cruise on a dhoni', blurb: 'Spinner dolphins, golden hour, cold drinks.', media: 'video', palette: ['#ea580c', '#fed7aa'], emoji: '🐬', tags: ['kids', 'views', 'water'], link: yt('Maldives sunset dolphin cruise') },
  { id: 'overwater-dinner', slots: ['dinner'], title: 'Over-water dinner', blurb: 'Glass floor, lights on the reef, reef sharks cruising under the table.', media: 'reel', palette: ['#1e1b4b', '#c7d2fe'], emoji: '🍷', tags: ['food', 'views'], link: ig('overwaterrestaurant') },
  { id: 'bbq-beach', slots: ['dinner'], title: 'Beach BBQ night', blurb: 'Lanterns in the sand, grill going, kids running around.', media: 'poster', palette: ['#b45309', '#fef3c7'], emoji: '🔥', tags: ['kids', 'hearty'], link: ig('maldivesbeachbbq') },
  { id: 'bioluminescence', slots: ['late'], title: 'Bioluminescent beach walk', blurb: 'On the right night, the waves glow blue. Not guaranteed, always magic.', media: 'video', palette: ['#0c4a6e', '#67e8f9'], emoji: '✨', tags: ['kids', 'views'], link: yt('Maldives bioluminescent beach') },
  { id: 'stargazing', slots: ['late'], title: 'Stargazing on the jetty', blurb: 'No light pollution. Bring the star app.', media: 'poster', palette: ['#0f172a', '#a5b4fc'], emoji: '🔭', tags: ['kids', 'views'], link: ig('maldivesnight') },
]);

/** Travel-day cards that fit any destination. Hometown-specific copy is filled in by the composer. */
const ANY: DesignerCard[] = [
  { id: 'any:car-to-airport', destination: 'any', slots: ['depart'], title: 'Car to the airport', blurb: 'Leave early. Snacks in the back seat.', media: 'poster', palette: ['#334155', '#e2e8f0'], emoji: '🚗', tags: ['kids'] },
  { id: 'any:lounge', destination: 'any', slots: ['depart'], title: 'Airport lounge warm-up', blurb: 'Breakfast, charge everything, the trip starts here.', media: 'poster', palette: ['#57534e', '#f5f5f4'], emoji: '🛋️', tags: ['food'] },
  { id: 'any:overnight-flight', destination: 'any', slots: ['flight'], title: 'Overnight flight', blurb: 'Movies, sleep, land ready to go.', media: 'poster', palette: ['#1e293b', '#94a3b8'], emoji: '✈️', tags: [] },
  { id: 'any:day-flight', destination: 'any', slots: ['flight'], title: 'Daytime flight', blurb: 'Window seats and a downloaded playlist.', media: 'poster', palette: ['#0369a1', '#e0f2fe'], emoji: '🛫', tags: ['kids'] },
  { id: 'any:rest', destination: 'any', slots: ['morning', 'afternoon'], title: 'Slow morning / rest block', blurb: 'Pool, pajamas, nothing scheduled. Protects everyone’s energy.', media: 'poster', palette: ['#9333ea', '#f3e8ff'], emoji: '😴', tags: ['kids', 'wellness'] },
  { id: 'any:spa', destination: 'any', slots: ['afternoon', 'apres'], title: 'Spa hour', blurb: 'Sauna, steam, massage while the kids are at club or lessons.', media: 'poster', palette: ['#0f766e', '#ccfbf1'], emoji: '🧖', tags: ['wellness'] },
  { id: 'any:room-service', destination: 'any', slots: ['dinner'], title: 'Room-service movie night', blurb: 'Jet lag cure. Everyone in bed by nine.', media: 'poster', palette: ['#4338ca', '#e0e7ff'], emoji: '🍿', tags: ['kids', 'little-kids'] },
  { id: 'any:early-night', destination: 'any', slots: ['late'], title: 'Early night', blurb: 'Tomorrow is a big day.', media: 'poster', palette: ['#1e1b4b', '#818cf8'], emoji: '🛌', tags: ['kids'] },
];

export const CATALOG: DesignerCard[] = [...ST_MORITZ, ...ASPEN, ...COURCHEVEL, ...MALDIVES, ...ANY];
export const CARD_INDEX = new Map(CATALOG.map((card) => [card.id, card]));

export function cardsFor(destination: DestinationId | 'custom'): DesignerCard[] {
  return CATALOG.filter((card) => card.destination === destination || card.destination === 'any');
}

export function searchLinks(destination: DesignerDestination, slot: SlotKind): { href: string; label: string }[] {
  const topic: Partial<Record<SlotKind, string>> = {
    morning: destination.kind === 'ski' ? 'skiing' : destination.kind === 'beach' ? 'snorkeling' : 'walking tour', lunch: 'lunch', afternoon: 'things to do',
    apres: destination.kind === 'ski' ? 'apres ski' : 'sunset', dinner: 'restaurants', late: 'nightlife',
  };
  const term = topic[slot];
  if (!term) return [];
  return [yt(`${destination.name} ${term}`), ig(`${destination.hashtag}${term.replace(/\s+/g, '')}`)];
}
