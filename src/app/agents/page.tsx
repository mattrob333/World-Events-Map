import type { Metadata } from 'next';
import { headers } from 'next/headers';
import styles from '@/app/brand/brand.module.css';

export const metadata: Metadata = {
  title: 'Bring your AI · dope.travel',
  description: 'Connect your own AI agent to dope.travel over MCP: it interviews you, builds your profile, and finds trips around your music and teams.',
};

const TOOLS = [
  ['dope_profile_guide', 'The interview your agent runs: who you travel with, your music and teams, how social you want to be, where you like to stay.'],
  ['dope_save_profile', 'Turns the interview into your profile and hands you a private link to save it on your device.'],
  ['dope_find_events', 'Your artists on tour, festivals with them on the bill, tribute bands, and your team’s games (away games flagged).'],
  ['dope_trip_ideas', 'Cities and dates where the things you love line up, favoring ones during something special.'],
  ['dope_live_music_scene', 'Your kind of night in any city: the rooms to look for and what’s listed on your dates.'],
  ['dope_curated_occasions', 'The dope.travel calendar of occasions worth traveling for.'],
];

export default async function AgentsPage() {
  const host = (await headers()).get('host') ?? 'dope.travel';
  const url = `${host.startsWith('localhost') ? 'http' : 'https'}://${host}/api/mcp`;
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.h2}>For AI agents</p>
        <p className={styles.tagline}>
          Let your AI <span className="golden-hour-text">introduce you.</span>
        </p>
        <p className={styles.lede}>
          If you already have an AI assistant that knows you, it can connect to dope.travel, interview you in detail, and set up your profile. Then it can find the
          trips built around your music, your teams, and the kind of people you want to meet.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="connect">
        <h2 id="connect" className={styles.h2}>Connect</h2>
        <p className={styles.copy}>In your AI app, add a custom MCP connector (remote server, Streamable HTTP) with this address:</p>
        <p className={styles.pending}>
          <code>{url}</code>
        </p>
        <p className={styles.copy}>Then say something like:</p>
        <p className={`font-display ${styles.specimenItalic}`}>
          “Connect to dope.travel and set up my travel profile. Interview me properly, then find trips around my music and teams.”
        </p>
      </section>

      <section className={styles.section} aria-labelledby="tools">
        <h2 id="tools" className={styles.h2}>What your agent can do</h2>
        <dl className={styles.voice}>
          {TOOLS.map(([name, detail]) => (
            <div key={name}>
              <dt style={{ fontFamily: 'var(--font-mono)', fontSize: 15 }}>{name}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="privacy">
        <h2 id="privacy" className={styles.h2}>Privacy</h2>
        <p className={styles.copy}>
          dope.travel doesn’t store the profile your agent builds. Your agent gets a private link with the profile inside it (in the part of a link browsers never
          send to a server); you open it and save the profile on your own device. Events come from Ticketmaster and SeatGeek listings; nothing is invented, and
          nothing books or charges you.
        </p>
      </section>
    </main>
  );
}
