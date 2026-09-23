import { describe, expect, it } from 'vitest';
import { EVENT_INDEX } from '@/lib/data/events';
import { approvedWikimediaUrl, isEventPhotoTitle, isRecentEventArchive, plainMetadata, selectCommonsPhotos } from './media';

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
  });

  it('excludes a century-old namesake fair while keeping a contemporary event archive', () => {
    const armory = EVENT_INDEX.get('armory-show-new-york')!;
    const base = { title: 'Armory Show exhibition', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg', credit: 'Contributor', license: 'CC BY 4.0', subject: 'event' as const };
    expect(isRecentEventArchive({ ...base, photographed: '1913' }, armory)).toBe(false);
    expect(isRecentEventArchive({ ...base, photographed: '2024-09-07' }, armory)).toBe(true);
  });

  it('requires the whole place name, so New York does not select New Delhi', () => {
    const newYork = EVENT_INDEX.get('new-york-fashion-week-ss27')!;
    const pages = {
      1: { title: 'File:New Delhi street.jpg', imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/a/a.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } }] },
      2: { title: 'File:New York skyline.jpg', imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/b/b.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:B.jpg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } }] },
    };
    expect(selectCommonsPhotos(pages, newYork, 'place').map((photo) => photo.title)).toEqual(['New York skyline']);
  });

  it('does not fill a city gallery with biological specimen plates', () => {
    const puertoAyora = EVENT_INDEX.get('galapagos-cool-season')!;
    const info = { mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/a/a.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } };
    const pages = {
      1: { title: 'File:Puerto Ayora harbor.jpg', imageinfo: [info] },
      2: { title: 'File:Erinnyis ello MHNT Puerto Ayora male dorsal.jpg', imageinfo: [info] },
    };
    expect(selectCommonsPhotos(pages, puertoAyora, 'place').map((photo) => photo.title)).toEqual(['Puerto Ayora harbor']);
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
