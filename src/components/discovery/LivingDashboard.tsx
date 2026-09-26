'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ActivityStream } from '@/components/activity/ActivityStream';
import { HotRightNow } from '@/components/heat/HotRightNow';
import { HomeMusicMap } from '@/components/designer/HomeMusicMap';
import { TravelSmarter } from './TravelSmarter';
import { FEATURES } from '@/lib/flags';
import { EVENTS } from '@/lib/data/events';
import { indexDestinations } from '@/lib/pulse';
import { addDays, useTimelineStore } from '@/lib/stores/useTimelineStore';
import styles from './living-dashboard.module.css';

export function LivingDashboard({ mode = 'feed' }: { mode?: 'intro' | 'feed' }) {
  const focus = useTimelineStore((state) => state.focus);
  const destinations = useMemo(() => indexDestinations(EVENTS, focus), [focus]);
  const windowIds = new Set(EVENTS.filter((event) => event.end >= focus && event.start <= addDays(focus, 45)).map((event) => event.id));
  const picks = destinations.pulses.filter((place) => place.eventIds.some((id) => windowIds.has(id))).slice(0, 6);

  return (
    <section className={styles.dashboard} aria-label="Travel discovery dashboard">
      {mode === 'intro' && <><header className={styles.intro}>
        <div>
          <span className={styles.kicker}><i /> THE WORLD IS AN INVITATION</span>
          <h1>Find your <em>next story.</em></h1>
          <p>The places. The people. The reason to just go.</p>
        </div>
        <a className={styles.mapLink} href="#world-map"><span aria-hidden="true">◎</span> Explore the globe <span aria-hidden="true">↗</span></a>
      </header>

      <div className={styles.storyHeading}><span>ON THE RADAR</span><small>Curated calendar · modeled demand</small></div>
      <nav className={styles.stories} aria-label="Destinations on the radar">
        {picks.map((place, index) => {
          const event = EVENTS.find((item) => place.eventIds.includes(item.id) && windowIds.has(item.id));
          return (
            <Link className={styles.story} data-tone={index % 6} href={`/destinations/${place.slug}`} key={place.id}>
              <span className={styles.storyArt} aria-hidden="true"><span>{place.countryCode}</span><i /></span>
              <span className={styles.storyText}><small>{event?.category ?? 'DISCOVER'}</small><strong>{place.name}</strong><span>{event?.name ?? 'Find your scene'}</span></span>
              <span className={styles.storyArrow} aria-hidden="true">↗</span>
            </Link>
          );
        })}
      </nav></>}

      {/* Pulse: the globe, then what's hot right now. The music map, Travel smarter and the
          activity stream are off the default view (NEXT_PUBLIC_FEATURE_HOME_EXTRAS brings them back). */}
      {mode === 'feed' && <><HotRightNow />{FEATURES.homeExtras && <><HomeMusicMap /><TravelSmarter /><ActivityStream /></>}</>}
    </section>
  );
}
