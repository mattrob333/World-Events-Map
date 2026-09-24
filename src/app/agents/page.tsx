import type { Metadata } from 'next';
import styles from '@/app/brand/brand.module.css';
import { eventSourceLabel, serverCapabilities, siteOrigin } from '@/lib/designer/capabilities';
import { CopyAddress } from './CopyAddress';

export const metadata: Metadata = {
  title: 'Bring your AI · dope.travel',
  description: 'Connect your own AI agent to dope.travel over MCP: it interviews you, builds your profile, and plans trips around your music, teams and crew.',
};

// Tool status is read from this server's configuration on every request.
export const dynamic = 'force-dynamic';

type Tool = { name: string; detail: string; live?: boolean };

export default function AgentsPage() {
  const caps = serverCapabilities();
  // Built from configured site URLs, never the request's Host header (UFR2-K12).
  const url = `${siteOrigin()}/api/mcp`;
  const events = caps.events ? eventSourceLabel(caps.eventSources) : '';
  const tools: Tool[] = [
    { name: 'dope_profile_guide', detail: 'The five-prompt opener and everything your AI listens for while you ramble. Also a quick way to check the connection.' },
    { name: 'dope_save_profile', detail: 'Turns the interview (including the artists you name) into your profile and hands you a private link to save it on your device.' },
    { name: 'dope_plan_trip', detail: 'A day-by-day trip anywhere, shaped by your crew’s food and music, with a private link that opens it as your trip.' },
    { name: 'dope_find_stays', detail: 'Airbnb, Vrbo, and Booking.com searches with your dates, party size, and kids’ ages filled in. Search links, not listings.' },
    { name: 'dope_curated_occasions', detail: 'The dope.travel calendar of occasions worth traveling for.' },
    caps.events
      ? { name: 'dope_find_events', detail: `Your artists on tour, festivals with them on the bill, tribute bands, and your team’s games, from ${events} listings.`, live: true }
      : { name: 'dope_find_events', detail: 'Search links for your artists’ tours and your teams’ schedules. Event listings aren’t set up on this server yet, so no listings.', live: false },
    caps.events
      ? { name: 'dope_trip_ideas', detail: 'Cities and dates where the things you love line up, favoring ones during something special.', live: true }
      : { name: 'dope_trip_ideas', detail: 'Ranks cities where your artists and teams line up. Needs event listings, which aren’t set up on this server yet.', live: false },
    caps.events
      ? { name: 'dope_live_music_scene', detail: `Your kind of night in any city: the rooms to look for and what’s listed on ${events} for your dates.`, live: true }
      : { name: 'dope_live_music_scene', detail: 'Your kind of night in any city: the rooms to look for, with map searches. No dated listings on this server yet.', live: false },
    caps.spotifyPlaylist
      ? { name: 'dope_read_playlist', detail: 'Paste a public Spotify playlist and it reads the artists, genres, and eras into your music profile.', live: true }
      : { name: 'dope_read_playlist', detail: 'Spotify isn’t connected on this server yet, so playlists can’t be read. Tell your AI your favorite artists instead.', live: false },
  ];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.h2}>For AI agents</p>
        <p className={styles.tagline}>
          Let your AI <span className="italic text-brass-bright">introduce you.</span>
        </p>
        <p className={styles.lede}>
          If you already have an AI assistant that knows you, it can connect to dope.travel, interview you in detail, and set up your profile. Then it can plan
          trips around your music, your teams, your food and your crew.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="connect">
        <h2 id="connect" className={styles.h2}>Connect</h2>
        <p className={styles.copy}>Add dope.travel as a custom connector (a remote MCP server) with this address:</p>
        <CopyAddress url={url} />

        <div className="mt-6 grid max-w-[900px] gap-4 md:grid-cols-2">
          <div className="rounded-[18px] bg-surface-2 p-5">
            <h3 className="font-display text-[20px] text-ink">Claude</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] leading-6 text-ink-muted">
              <li>Open Settings → Connectors.</li>
              <li>Choose Add custom connector.</li>
              <li>Name it dope.travel and paste the address. Leave the auth settings empty.</li>
              <li>In a new chat, turn on dope.travel from the tools menu.</li>
            </ol>
          </div>
          <div className="rounded-[18px] bg-surface-2 p-5">
            <h3 className="font-display text-[20px] text-ink">ChatGPT</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] leading-6 text-ink-muted">
              <li>Open Settings → Apps &amp; Connectors → Advanced settings and turn on Developer mode.</li>
              <li>Back in Apps &amp; Connectors, choose Create.</li>
              <li>Name it dope.travel, paste the address, and pick No authentication.</li>
              <li>In a new chat, add dope.travel from the + menu.</li>
            </ol>
          </div>
        </div>
        <p className={`${styles.copy} text-[13px]`}>Menu names move around between app versions; look for “connectors” or “custom MCP server”.</p>

        <p className={styles.pending}>
          <strong>Check it worked:</strong> ask your AI to “call dope_profile_guide”. If it shows you a welcome message with five prompts, you’re connected.
        </p>

        <p className={styles.copy}>Then say something like:</p>
        <p className={`font-display ${styles.specimenItalic}`}>“Set up my dope.travel profile.”</p>
        <p className={styles.copy}>
          Your AI opens with five prompts: an experience you loved, how you like to travel, food, music, and your best moment ever on a trip. Then you just ramble,
          typed or spoken, as long as you like. It picks out what matters, asks a follow-up or two at most, and hands you a private link to your profile. If you
          ask for a trip first, it just plans the trip. Some apps also list a <code>dope_start</code> prompt (in Claude, the + menu or “/”): pick it to open the
          five prompts yourself.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="tools">
        <h2 id="tools" className={styles.h2}>What your agent can do here</h2>
        <dl className={styles.voice}>
          {tools.map(({ name, detail, live }) => (
            <div key={name}>
              <dt style={{ fontFamily: 'var(--font-mono)', fontSize: 15 }}>{name}</dt>
              {live === false ? <dd className="mt-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Not set up yet</dd> : null}
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="privacy">
        <h2 id="privacy" className={styles.h2}>Privacy</h2>
        <p className={styles.copy}>
          When your AI saves your profile, dope.travel builds the link and doesn’t keep a copy. The profile rides inside the link (in the part browsers never send
          to a server); you open it and save it on your own device.{' '}
          {caps.events ? `Events come from ${events} listings. ` : 'Event listings aren’t connected here yet, so event tools give search links, never made-up shows. '}
          Nothing books or charges you.
        </p>
      </section>
    </main>
  );
}
