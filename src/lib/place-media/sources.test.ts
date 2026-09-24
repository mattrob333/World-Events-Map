import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMONS_STANDARD_WIDTHS, photoImageProps } from './sources';
import { curatedPhotoEntries } from './curated';
import { curatedPhotosForDestination } from './destinations';

const widthsIn = (srcSet = '') => srcSet.split(', ').map((entry) => Number(entry.split(' ')[1].replace('w', '')));

describe('photoImageProps', () => {
  it('serves every reviewed editorial photo with WebP sizes that exist on disk', () => {
    const photos = [...curatedPhotoEntries().map(([, photo]) => photo), ...curatedPhotosForDestination('aspen')];
    for (const photo of photos) {
      const props = photoImageProps(photo, 'hero');
      expect(props.src).toBe(photo.imageUrl);
      expect(props.srcSet, photo.imageUrl).toBeTruthy();
      for (const entry of props.srcSet!.split(', ')) {
        const file = entry.split(' ')[0];
        expect(fs.existsSync(path.join(process.cwd(), 'public', file)), file).toBe(true);
      }
    }
  });

  it('only names Wikimedia standard widths, on the thumbnail host, capped by the thumbnail', () => {
    const props = photoImageProps({
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Vegas_%2C_Sphere.jpg/1280px-Vegas_%2C_Sphere.jpg?utm_source=commons.wikimedia.org',
    }, 'card');
    expect(widthsIn(props.srcSet)).toEqual([330, 500, 960, 1280]);
    expect(props.srcSet).not.toContain('utm_');
    expect(props.src).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Vegas_%2C_Sphere.jpg/1280px-Vegas_%2C_Sphere.jpg');
    for (const w of widthsIn(props.srcSet)) expect(COMMONS_STANDARD_WIDTHS).toContain(w);
  });

  it('never hotlinks a small original; it requests the covering standard thumbnail', () => {
    const props = photoImageProps({
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Runway.jpg?utm_content=thumbnail_unscaled', width: 488,
    }, 'heroFrame');
    expect(widthsIn(props.srcSet)).toEqual([330, 500]);
    expect(props.src).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/Runway.jpg/500px-Runway.jpg');
    expect(props.srcSet).not.toContain('upload.wikimedia.org');
  });

  it('leaves unknown hosts and unparseable paths untouched', () => {
    expect(photoImageProps({ imageUrl: 'https://evil.test/a.jpg' }, 'hero')).toEqual({ src: 'https://evil.test/a.jpg' });
    expect(photoImageProps({ imageUrl: '/editorial/not-generated.jpg' }, 'hero')).toEqual({ src: '/editorial/not-generated.jpg' });
  });
});
