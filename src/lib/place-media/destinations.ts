import type { PlacePhoto } from './media';
import { curatedPhotoForEvent } from './curated';

export type DestinationPhoto = PlacePhoto & {
  caption: string;
  theme: 'landscape' | 'town' | 'experience';
};

type Scene = { eventId: string; caption: string; theme: DestinationPhoto['theme'] };

// These are locally stored, individually reviewed Commons photographs. A
// destination may show an earlier season; captions describe the pictured place
// or activity, never the upcoming calendar date or current conditions.
const EXTRA: Record<string, PlacePhoto> = {
  'aspen-hero': {
    title: 'Aspen panorama', imageUrl: '/editorial/destination-aspen-hero.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Aspen_panorama_(8552886075).jpg',
    credit: 'Sam Beebe', license: 'CC BY 2.0', photographed: '2013-03-12', subject: 'place',
  },
  'aspen-street': {
    title: 'Main Street in Aspen', imageUrl: '/editorial/destination-aspen-street.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Main_Street_in_Aspen.jpg',
    credit: 'Werdna', license: 'CC BY-SA 4.0', photographed: '2008-01-13', subject: 'place',
  },
  'courchevel-village': {
    title: 'Courchevel Village front de neige', imageUrl: '/editorial/destination-courchevel-village.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Courchevel_Village_front_de_neige.jpg',
    credit: 'DimiTalen', license: 'CC0', photographed: '2022-01-05', subject: 'place',
  },
  'gstaad-palace': {
    title: 'Gstaad Palace Hotel from the promenade', imageUrl: '/editorial/destination-gstaad-palace.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gstaad._Palace_Hotel_from_The_Promenade,_Switzerland_-_panoramio.jpg',
    credit: 'Николай Максимович', license: 'CC BY 3.0', photographed: '2009-01-01', subject: 'place',
  },
  'st-moritz-lake': {
    title: 'St Moritz winter evening and frozen lake', imageUrl: '/editorial/destination-st-moritz-lake.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:StMoritz.jpg',
    credit: 'Alps', license: 'Public domain', photographed: '2007-02-03', subject: 'place',
  },
  'niseko-yotei': {
    title: 'Mount Yōtei from Niseko Annupuri', imageUrl: '/editorial/destination-niseko-yotei.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mount_Y%C5%8Dtei_from_Niseko_Annupuri_(33253188670).jpg',
    credit: 'MIKI Yoshihito', license: 'CC BY 2.0', photographed: '2017-03-19', subject: 'place',
  },
  'teton-tram': {
    title: 'Jackson Hole aerial tram', imageUrl: '/editorial/destination-teton-tram.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Aerial_Tram.jpg',
    credit: 'Sirguh', license: 'CC BY-SA 4.0', photographed: '2022-04-08', subject: 'place',
  },
};

const DESTINATION_SCENES: Record<string, Scene[]> = {
  aspen: [
    { eventId: 'aspen-hero', caption: 'Aspen town from the ski slopes', theme: 'landscape' },
    { eventId: 'aspen-christmas-week', caption: 'Lift 1A climbing Aspen Mountain', theme: 'experience' },
    { eventId: 'aspen-street', caption: 'A snowy walk through Aspen', theme: 'town' },
    { eventId: 'x-games-aspen', caption: 'Big air at an earlier Aspen X Games', theme: 'experience' },
  ],
  courchevel: [
    { eventId: 'courchevel-peak-week', caption: 'Courchevel pistes above Bellecôte', theme: 'landscape' },
    { eventId: 'courchevel-village', caption: 'Courchevel Village in winter', theme: 'town' },
  ],
  gstaad: [
    { eventId: 'gstaad-new-year-week', caption: 'Gstaad village beneath the Bernese Alps', theme: 'landscape' },
    { eventId: 'gstaad-palace', caption: 'Gstaad’s snowy promenade, with the Palace above', theme: 'town' },
  ],
  'st-moritz': [
    { eventId: 'st-moritz-new-year-week', caption: 'Winter across the upper Engadin', theme: 'landscape' },
    { eventId: 'st-moritz-lake', caption: 'St. Moritz and its frozen lake', theme: 'town' },
    { eventId: 'cresta-run-season-st-moritz', caption: 'The historic Cresta Run ice track', theme: 'experience' },
  ],
  niseko: [
    { eventId: 'niseko-january-powder', caption: 'Niseko’s snowy slopes', theme: 'experience' },
    { eventId: 'niseko-yotei', caption: 'Mount Yōtei from Niseko Annupuri', theme: 'landscape' },
  ],
  'teton-village': [
    { eventId: 'jackson-hole-presidents-week', caption: 'Skiing the Jackson Hole terrain', theme: 'experience' },
    { eventId: 'teton-tram', caption: 'The Jackson Hole aerial tram', theme: 'experience' },
  ],
  verbier: [{ eventId: 'verbier-february-half-term', caption: 'Ski slopes above Verbier', theme: 'landscape' }],
  zermatt: [{ eventId: 'zermatt-march-high-season', caption: 'The Matterhorn above Zermatt’s ski terrain', theme: 'landscape' }],
  portillo: [{ eventId: 'portillo-august-weeks', caption: 'Laguna del Inca beside Portillo', theme: 'landscape' }],
  queenstown: [{ eventId: 'cardrona-queenstown-peak', caption: 'Cardrona ski terrain near Queenstown', theme: 'landscape' }],
};

/** Stable, place-accurate local photographs for a destination dossier. */
export function curatedPhotosForDestination(slug: string): DestinationPhoto[] {
  return (DESTINATION_SCENES[slug] ?? []).flatMap(({ eventId, caption, theme }) => {
    const photo = EXTRA[eventId] ?? curatedPhotoForEvent(eventId);
    return photo ? [{ ...photo, caption, theme }] : [];
  });
}
