import { expect, it } from 'vitest';
import { inPlace, parseInstagram, parseTikTok, parseTripadvisor, promoLevel } from './destinationSources';

const NOW = Date.UTC(2026, 8, 24, 4, 0, 0);
const recent = NOW / 1000 - 3600;

const ta = (id: string, title: string, location?: string) => ({
  place_type: 'ATTRACTION', title, place_id: id, location,
  link: `https://www.tripadvisor.com/Attraction_Review-g55229-d${id}`,
});

const nashville = {
  search_parameters: { engine: 'tripadvisor', q: 'Nashville, Tennessee' },
  places: [
    ta('1', 'Country Music Hall of Fame and Museum', 'Nashville, Tennessee'),
    ta('2', 'Ryman Auditorium', 'Nashville, Tennessee'),
    ta('3', 'Tennessee Aquarium', 'Chattanooga, Tennessee'),
    ta('4', 'The Parthenon', 'Nashville, Tennessee'),
    ta('5', 'Johnny Cash Museum', undefined),
  ],
};

it('drops a Tripadvisor sight that Tripadvisor places in another town (Chattanooga for Nashville)', () => {
  const names = parseTripadvisor(nashville).map((spot) => spot.name);
  expect(names).toEqual(['Country Music Hall of Fame and Museum', 'Ryman Auditorium', 'The Parthenon', 'Johnny Cash Museum']);
  expect(parseTripadvisor(nashville, 'Nashville').map((spot) => spot.name)).not.toContain('Tennessee Aquarium');
  // The listing keeps its location so the card can say where it is.
  expect(parseTripadvisor(nashville)[0].address).toBe('Nashville, Tennessee');
});

it('keeps Tripadvisor rows when it spells the place its own way (Lisbon for Lisboa)', () => {
  const lisboa = {
    search_parameters: { q: 'Lisboa, Portugal' },
    places: [ta('1', 'Alfama', 'Lisbon, Portugal'), ta('2', 'Bairro Alto', 'Lisbon, Portugal'), ta('3', 'Tram 28', 'Lisbon, Portugal'), ta('4', 'Pena Palace', 'Sintra, Portugal')],
  };
  expect(parseTripadvisor(lisboa).map((spot) => spot.name)).toEqual(['Alfama', 'Bairro Alto', 'Tram 28']);
});

it('is conservative about locality when it cannot tell', () => {
  expect(inPlace(undefined, 'Nashville')).toBe(true);
  expect(inPlace('Chattanooga, Tennessee', undefined)).toBe(true);
  expect(inPlace('New York, NY', 'New York City')).toBe(true);
  expect(inPlace('Chattanooga, Tennessee', 'Nashville')).toBe(false);
  expect(parseTripadvisor({ places: [ta('9', 'Tennessee Aquarium', 'Chattanooga, Tennessee')] })).toHaveLength(1);
});

it('flags lodging promos, giveaways and dated throwbacks, and demotes link-in-bio sales', () => {
  expect(promoLevel('executiveinngoodlettsville', 'Enjoy a comfortable stay at Executive Inn & Suites, Goodlettsville, minutes from Nashville', NOW)).toBe('drop');
  expect(promoLevel('thehermitagehotel', 'Book direct for our best rooms this fall in Nashville', NOW)).toBe('drop');
  expect(promoLevel('nashvillescene', 'GIVEAWAY: win two tickets to the Ryman in Nashville', NOW)).toBe('drop');
  expect(promoLevel('someone', 'Nashville, Feb 2020. Miss this view', NOW)).toBe('drop');
  expect(promoLevel('someone', '#tbt to Broadway in Nashville', NOW)).toBe('drop');
  expect(promoLevel('boot_shop', 'New boots just landed in Nashville, link in bio', NOW)).toBe('down');
  // Ordinary posts are left alone, including ones by accounts whose names contain "inn".
  expect(promoLevel('dinnerwithjo', 'Hot chicken in Nashville, worth the line', NOW)).toBeNull();
  expect(promoLevel('someone', 'Nashville in September 2026 is still hot', NOW)).toBeNull();
});

const igPost = (code: string, username: string, caption: string, createdUtc = recent) => ({
  url: `https://www.instagram.com/p/${code}/`, username, caption, createdUtc, locationName: 'Nashville, Tennessee', media: [],
});

it('drops Instagram promos and shows sales posts last', () => {
  const posts = parseInstagram({ output: { data: { posts: [
    igPost('A1', 'boot_shop', 'Boots for Nashville nights, link in bio', recent + 60),
    igPost('B2', 'executiveinngoodlettsville', 'Enjoy a comfortable stay at Executive Inn & Suites near Nashville'),
    igPost('C3', 'nashvillescene', 'Ticket giveaway! Tag a friend in Nashville'),
    igPost('D4', 'jo.travels', 'Sunset from the pedestrian bridge in Nashville', recent - 60),
    igPost('E5', 'old.pics', 'Nashville, Feb 2020 🎸'),
  ] } } }, 'Nashville', ['Nashville'], NOW);
  expect(posts.map((post) => post.author)).toEqual(['jo.travels', 'boot_shop']);
});

it('drops TikTok giveaways too', () => {
  const video = (id: string, caption: string) => ({ id, author: 'nash.eats', caption, createdUtc: recent });
  const posts = parseTikTok({ output: { data: { videos: [
    video('7412345678901234567', 'Best hot chicken in Nashville'),
    video('7412345678901234568', 'Nashville giveaway, follow to enter'),
  ] } } }, 'Nashville', ['Nashville'], NOW);
  expect(posts.map((post) => post.caption)).toEqual(['Best hot chicken in Nashville']);
});
