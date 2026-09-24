import { describe, expect, it } from 'vitest';
import { EVENT_INDEX } from '@/lib/data/events';
import { approvedWikimediaUrl, isEventPhotoTitle, isPlacePhotoTitle, isRecentEventArchive, isSeasonalPlacePhoto, plainMetadata, selectCommonsPhotos } from './media';

const event = EVENT_INDEX.get('venice-biennale-arte')!;

describe('Wikimedia photo selection', () => {
  it('omits noncommercial and unknown image licenses', () => {
    const pages = ['CC BY-NC 4.0', 'Unknown', 'Fair use'].map((license) => ({
      title: 'File:Venice skyline.jpg', imageinfo: [{ mime: 'image/jpeg',
        thumburl: 'https://upload.wikimedia.org/wikipedia/commons/a/a.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
        extmetadata: { LicenseShortName: { value: license } },
      }],
    }));
    expect(selectCommonsPhotos(pages, event, 'place')).toEqual([]);
  });
  it('allows only fixed Wikimedia image and source hosts', () => {
    expect(approvedWikimediaUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/photo.jpg', 'image')).toBe(true);
    expect(approvedWikimediaUrl('https://thumb.wikimedia.org/wikipedia/commons/thumb/a/b/photo.jpg', 'image')).toBe(true);
    expect(approvedWikimediaUrl('https://upload.wikimedia.org.evil.test/wikipedia/commons/photo.jpg', 'image')).toBe(false);
    expect(approvedWikimediaUrl('http://upload.wikimedia.org/wikipedia/commons/photo.jpg', 'image')).toBe(false);
    expect(approvedWikimediaUrl('https://commons.wikimedia.org/wiki/File:Photo.jpg', 'source')).toBe(true);
    expect(approvedWikimediaUrl('https://commons.wikimedia.org@evil.test/wiki/File:Photo.jpg', 'source')).toBe(false);
  });

  it('does not call a loosely related city image an event photo', () => {
    expect(isEventPhotoTitle('File:Isabel Nolan at Venice Biennale Arte 2026.jpg', event)).toBe(true);
    expect(isEventPhotoTitle('File:Venice Grand Canal by night.jpg', event)).toBe(false);
    expect(isEventPhotoTitle('File:Kitzbühel Hahnenkamm Stadtpark Steinbock-Darstellung mit Schriftzug.jpg', EVENT_INDEX.get('hahnenkamm-kitzbuhel')!)).toBe(false);
    expect(isEventPhotoTitle('File:Kyoto Cherry Blossom 2014.jpg', EVENT_INDEX.get('kyoto-cherry-blossom')!)).toBe(false);
  });

  it('excludes a century-old namesake fair while keeping a contemporary event archive', () => {
    const armory = EVENT_INDEX.get('armory-show-new-york')!;
    const base = { title: 'Armory Show exhibition', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg', credit: 'Contributor', license: 'CC BY 4.0', subject: 'event' as const };
    expect(isRecentEventArchive({ ...base, photographed: '1913' }, armory)).toBe(false);
    expect(isRecentEventArchive({ ...base, photographed: '2024-09-07' }, armory)).toBe(true);
    expect(isRecentEventArchive({ ...base, photographed: null, title: 'Armory Show 2007 exhibition' }, armory)).toBe(false);
  });

  it('requires a scene cue as well as the right city, and keeps winter ski photos in season', () => {
    const london = EVENT_INDEX.get('laver-cup')!;
    expect(isPlacePhotoTitle('File:British Museum Great Court, London.jpg', london)).toBe(false);
    expect(isPlacePhotoTitle('File:London Wimbledon tennis court.jpg', london)).toBe(false);
    expect(isPlacePhotoTitle('File:London O2 Arena tennis court.jpg', london)).toBe(true);
    const stMoritz = EVENT_INDEX.get('st-moritz-new-year-week')!;
    expect(isPlacePhotoTitle('File:Solidarity Grid (St Moritz), Christchurch, New Zealand.jpg', stMoritz)).toBe(false);
    expect(isPlacePhotoTitle('File:St Moritz snow slopes.jpg', stMoritz)).toBe(true);
    expect(isPlacePhotoTitle('File:ISS065-E-486698 St Moritz ski slopes in October.jpg', stMoritz)).toBe(false);
    const cresta = EVENT_INDEX.get('cresta-run-season-st-moritz')!;
    expect(isPlacePhotoTitle('File:St Moritz ski slopes.jpg', cresta)).toBe(false);
    expect(isPlacePhotoTitle('File:Cresta Run St Moritz skeleton toboggan.jpg', cresta)).toBe(true);
    const aspen = EVENT_INDEX.get('aspen-christmas-week')!;
    const photo = { title: 'Skiing Aspen Mountain', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg', credit: 'Photographer', license: 'CC BY 4.0', subject: 'place' as const };
    expect(isSeasonalPlacePhoto({ ...photo, photographed: '2015-04-09' }, aspen)).toBe(false);
    expect(isSeasonalPlacePhoto({ ...photo, photographed: '2015-10-16' }, aspen)).toBe(false);
    expect(isSeasonalPlacePhoto({ ...photo, photographed: '2015-12-20' }, aspen)).toBe(true);
    expect(isSeasonalPlacePhoto({ ...photo, photographed: null, title: 'Aspen Mountain spring skiing' }, aspen)).toBe(false);
  });

  it('requires the whole place name, so New York does not select New Delhi', () => {
    const newYork = EVENT_INDEX.get('new-york-fashion-week-ss27')!;
    const pages = {
      1: { title: 'File:New Delhi Fashion Week runway.jpg', imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/a/a.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } }] },
      2: { title: 'File:New York Fashion Week runway.jpg', imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/b/b.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:B.jpg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } }] },
    };
    expect(selectCommonsPhotos(pages, newYork, 'place').map((photo) => photo.title)).toEqual(['New York Fashion Week runway']);
  });

  it('does not fill a city gallery with biological specimen plates', () => {
    const puertoAyora = EVENT_INDEX.get('galapagos-cool-season')!;
    const info = { mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/a/a.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } };
    const pages = {
      1: { title: 'File:Puerto Ayora sea lion harbor.jpg', imageinfo: [info] },
      2: { title: 'File:Erinnyis ello MHNT Puerto Ayora male dorsal.jpg', imageinfo: [info] },
    };
    expect(selectCommonsPhotos(pages, puertoAyora, 'place').map((photo) => photo.title)).toEqual(['Puerto Ayora sea lion harbor']);
  });

  it('does not duplicate the same Commons file within a gallery', () => {
    const london = EVENT_INDEX.get('laver-cup')!;
    const info = { mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/a/tennis.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:London_Tennis_Court.jpg',
      extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } };
    const pages = [{ title: 'File:London O2 Arena tennis court.jpg', imageinfo: [info] },
      { title: 'File:London O2 Arena tennis court copy.jpg', imageinfo: [info] }];
    expect(selectCommonsPhotos(pages, london, 'place')).toHaveLength(1);
  });

  it('strips metadata markup and rejects unlicensed or untrusted files', () => {
    expect(plainMetadata('<a href="evil">Jane &amp; Sam</a>')).toBe('Jane & Sam');
    const pages = {
      1: { title: 'File:Isabel Nolan at Venice Biennale Arte 2026.jpg', imageinfo: [{
        mime: 'image/jpeg',
        thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/photo.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Photo.jpg',
        extmetadata: { Artist: { value: '<b>Jane &amp; Sam</b>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, DateTimeOriginal: { value: '2026-05-01' } },
      }] },
      2: { title: 'File:Isabel Nolan at Venice Biennale Arte 2026.jpg', imageinfo: [{
        mime: 'image/jpeg', thumburl: 'https://evil.test/photo.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Photo2.jpg',
        extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } },
      }] },
    };
    const photos = selectCommonsPhotos(pages, event, 'event');
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({ subject: 'event', credit: 'Jane & Sam', license: 'CC BY-SA 4.0', photographed: '2026-05-01' });
  });
});

describe('Commons pixel size', () => {
  it('keeps the original width and height so the client can pick standard thumbnails', async () => {
    const { selectCommonsPhotos } = await import('./media');
    const { EVENT_INDEX } = await import('@/lib/data/events');
    const event = EVENT_INDEX.get('monaco-yacht-show')!;
    const [photo] = selectCommonsPhotos({ 1: {
      title: 'File:Monaco Yacht Show 2024.jpg',
      imageinfo: [{ mime: 'image/jpeg', width: 4000, height: 3000,
        thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/M.jpg/1280px-M.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Monaco_Yacht_Show_2024.jpg',
        extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } }],
    } }, event, 'event');
    expect(photo).toMatchObject({ width: 4000, height: 3000 });
  });
});
