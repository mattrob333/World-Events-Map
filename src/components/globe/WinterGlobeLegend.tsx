import type { Beacon } from '@/lib/types';
import styles from './winter-globe-legend.module.css';

export interface WinterGlobeLegendProps {
  beacons: readonly Beacon[];
}

/** A visual map key plus text equivalents for the canvas-only crystal marks. */
export function WinterGlobeLegend({ beacons }: WinterGlobeLegendProps) {
  const skiBeacons = beacons.filter((beacon) => beacon.category === 'ski');
  if (skiBeacons.length === 0) return null;

  return (
    <>
      <div className={styles.legend} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
          <path d="M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7" />
          <path d="m9.5 4.5 2.5 2.2 2.5-2.2M9.5 19.5l2.5-2.2 2.5 2.2M4.8 9.7l3.3-.6-.5-3.3M19.2 14.3l-3.3.6.5 3.3M4.8 14.3l3.3.6-.5 3.3M19.2 9.7l-3.3-.6.5-3.3" />
        </svg>
        <span>WINTER ATLAS</span>
        <i />
        <small>{skiBeacons.length} SKI {skiBeacons.length === 1 ? 'SCENE' : 'SCENES'}</small>
      </div>
      <div className="sr-only">
        <p>Snowflake markers show curated ski events. They do not indicate live snow or mountain conditions.</p>
        <ul aria-label="Ski events on the globe">
          {skiBeacons.map((beacon) => (
            <li key={beacon.eventId}>{beacon.label}, {beacon.city}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
