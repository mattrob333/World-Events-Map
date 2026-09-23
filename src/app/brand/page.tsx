import type { Metadata } from 'next';
import manifest from '@/lib/brand/assets.json';
import styles from './brand.module.css';

export const metadata: Metadata = {
  title: 'Brand · dope.travel',
  description: 'The dope.travel logo, colours, type, voice, and imagery.',
};

const PALETTE = [
  { name: 'After Hours', hex: '#0C0907', note: 'Warm near-black. The room everything sits in.', ink: '#F4ECDD' },
  { name: 'Bone', hex: '#F4ECDD', note: 'Type and quiet surfaces.', ink: '#16110D' },
  { name: 'Saffron', hex: '#F7C548', note: 'Top of the sun. Highlights.', ink: '#16110D' },
  { name: 'Tangerine', hex: '#F26B2A', note: 'The house accent. Active states.', ink: '#16110D' },
  { name: 'Flamingo', hex: '#E4577E', note: 'Hype moments, sparingly.', ink: '#16110D' },
  { name: 'Dusk', hex: '#8E4DB8', note: 'The psychedelic hint. Gradient tails only.', ink: '#F4ECDD' },
];

const VOICE = [
  ['Confident, not loud', 'We know the spot. We don’t need to shout about it.'],
  ['Fun, not goofy', 'A wink, never a meme. One “dope” per page is plenty.'],
  ['Specific, not salesy', '“Rock cover band, Friday, two blocks from the hotel.” Not “unforgettable experiences.”'],
  ['Honest', 'Ideas are ideas, prices are “listed at”, and we say where things come from.'],
];

type Asset = { id: string; src: string; alt: string; use: string; model: string; width: number; height: number; generatedAt: string };

export default function BrandPage() {
  const assets = (manifest.assets ?? []) as Asset[];
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
        <img className={styles.lockup} src="/brand/dope-travel-lockup.svg" alt="dope.travel" />
        <p className={styles.tagline}>
          Trips worth <span className="golden-hour-text">talking about.</span>
        </p>
        <p className={styles.lede}>
          Premium first, with a wink. For people who have been everywhere and still want the night they’ll talk about for years: the right terrace, the right
          band, the right crew.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="logo">
        <h2 id="logo" className={styles.h2}>The mark</h2>
        <p className={styles.copy}>
          The “o” is a setting sun cut by horizon lines: golden hour, a 70s poster, the end of a great day. It works alone as the app icon.
        </p>
        <div className={styles.logoGrid}>
          <figure className={styles.tileDark}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
            <img src="/brand/dope-travel-lockup.svg" alt="Lockup on After Hours" />
            <figcaption>Lockup · on After Hours</figcaption>
          </figure>
          <figure className={styles.tileLight}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
            <img src="/brand/dope-travel-lockup-ink.svg" alt="Lockup on Bone" />
            <figcaption>Lockup · on Bone</figcaption>
          </figure>
          <figure className={styles.tileDark}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
            <img src="/brand/dope-mark.svg" alt="App icon" className={styles.icon} />
            <figcaption>App icon</figcaption>
          </figure>
        </div>
        <p className={styles.small}>
          Files: <a href="/brand/dope-travel-lockup.svg">lockup</a> · <a href="/brand/dope-travel-lockup-ink.svg">lockup (ink)</a> ·{' '}
          <a href="/brand/dope-wordmark.svg">wordmark</a> · <a href="/brand/dope-mark.svg">icon</a> · <a href="/brand/dope-sun.svg">sun</a>. All vector, drawn
          from Fraunces outlines.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="colour">
        <h2 id="colour" className={styles.h2}>Colour</h2>
        <div className={styles.golden} aria-hidden />
        <div className={styles.swatches}>
          {PALETTE.map((swatch) => (
            <div key={swatch.hex} className={styles.swatch} style={{ background: swatch.hex, color: swatch.ink }}>
              <strong>{swatch.name}</strong>
              <span className={styles.hex}>{swatch.hex}</span>
              <span className={styles.note}>{swatch.note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="type">
        <h2 id="type" className={styles.h2}>Type</h2>
        <p className={`font-display ${styles.specimen}`}>Go somewhere dope.</p>
        <p className={`font-display ${styles.specimenItalic}`}>Less itinerary, more legend.</p>
        <p className={styles.copy}>
          Fraunces with its soft, slightly wonky 70s cut for display; the system sans for everything you read quickly; mono for labels and data.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="voice">
        <h2 id="voice" className={styles.h2}>Voice</h2>
        <dl className={styles.voice}>
          {VOICE.map(([term, detail]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="imagery">
        <h2 id="imagery" className={styles.h2}>Imagery</h2>
        <p className={styles.copy}>
          Slim Aarons, not stock: real people mid-laugh, warm golden light, a little film grain, and a faint sun haze at the edges. Never neon, never tie-dye.
        </p>
        {assets.length ? (
          <div className={styles.art}>
            {assets.map((asset) => (
              <figure key={asset.id} className={styles.artItem}>
                {/* eslint-disable-next-line @next/next/no-img-element -- generated brand art, already web-sized */}
                <img src={asset.src} alt={asset.alt} width={asset.width} height={asset.height} loading="lazy" />
                <figcaption>
                  {asset.use} · AI-generated brand art ({asset.model.split('.').pop()})
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className={styles.pending}>
            Brand art is generated with Treg’s image models (GPT Image 2.5 and Gemini 3 Pro Image) by <code>npm run brand:assets</code> once{' '}
            <code>TREG_TOKEN</code> is set. Six pieces are planned: Riviera terrace, alpine après, a night of live music, family at sea, a sun poster, and a
            wave texture.
          </p>
        )}
      </section>
    </main>
  );
}
