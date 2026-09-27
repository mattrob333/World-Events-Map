'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import { formatDateRange } from '@/components/ui/tokens';
import { forYou, HOME_DAYS, homeEvents } from '@/lib/discovery/home';
import { countryAt, countryFromCalendar, regionAround } from '@/lib/geo/homeCountry';
import { SEASONS, SNOW_SPOTS, snowLevel } from '@/lib/geo/snowSeasons';
import type { GeoPoint, WorldEvent } from '@/lib/types';
import type { Signal } from '@/lib/vibe/signals';
import styles from './home-map.module.css';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const FALLBACK_STYLE = { version: 8 as const, sources: {}, layers: [{ id: 'background', type: 'background' as const, paint: { 'background-color': '#0c0c0c' } }] };
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LEVEL_WORDS = { peak: 'Usually its best month', season: 'Usually in season', edge: 'Season’s edge: usually early or late snow', off: 'Usually out of season' } as const;

type Scored = WorldEvent & { buzz?: { score: number } };
type Picked = { kind: 'event'; id: string } | { kind: 'snow'; name: string } | null;

function eventFeatures(events: readonly Scored[], reasons: ReadonlyMap<string, string | null>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events.map((event) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [event.coords.lon, event.coords.lat] },
      properties: { id: event.id, name: event.name, mine: reasons.get(event.id) ? 1 : 0, size: 7 + Math.round(((event.buzz?.score ?? 50) / 100) * 9) },
    })),
  };
}

function snowFeatures(month: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: SNOW_SPOTS.map((spot) => {
      const level = snowLevel(spot.region, month);
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [spot.lon, spot.lat] }, properties: { name: spot.name, level, glow: level === 'peak' ? 1 : level === 'season' ? 0.7 : level === 'edge' ? 0.35 : 0 } };
    }).filter((feature) => feature.properties.glow > 0) as GeoJSON.Feature[],
  };
}

/**
 * Home: your own country on one screen, with what's on over the next few
 * months, the ones that fit your Vibe profile called out, and a cold map of
 * when the snow is usually good. Everything comes from the curated calendar
 * and the season table: no paid lookups. Where you are only frames the map
 * and never leaves the device.
 */
export function HomeMap({ events, signals, viewer, today, hrefFor }: { events: readonly Scored[]; signals: readonly Signal[]; viewer: GeoPoint; today: string; hrefFor: (eventId: string) => string }) {
  const box = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const youRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<Picked>(null);
  const [snow, setSnow] = useState(false);
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)));
  const country = useMemo(() => {
    const zone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
    return countryAt(viewer, zone) ?? countryFromCalendar(viewer, events);
  }, [viewer, events]);
  const bounds = useMemo(() => country?.bounds ?? regionAround(viewer), [country, viewer]);
  const list = useMemo(() => (country ? homeEvents(events, country.code, today) : []), [events, country, today]);
  const reasons = useMemo(() => new Map(list.map((event) => [event.id, forYou(event, signals)])), [list, signals]);
  const mine = list.filter((event) => reasons.get(event.id));
  const dataRef = useRef({ events: EMPTY, snow: EMPTY });

  useEffect(() => {
    let cancelled = false;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !box.current) return;
      const map = new maplibregl.Map({ container: box.current, style: STYLE_URL, bounds, fitBoundsOptions: { padding: 24 }, attributionControl: false, dragRotate: false, pitchWithRotate: false });
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'OpenFreeMap' }), 'top-right');
      mapRef.current = map;
      let styled = false;
      const fallBack = () => { if (!styled && !cancelled) map.setStyle(FALLBACK_STYLE); };
      const timer = window.setTimeout(fallBack, 8000);
      map.on('error', () => { if (!styled) fallBack(); });
      let wired = false;
      map.on('style.load', () => {
        styled = true;
        window.clearTimeout(timer);
        if (!map.getSource('home-events')) {
          map.addSource('home-snow', { type: 'geojson', data: dataRef.current.snow });
          map.addSource('home-events', { type: 'geojson', data: dataRef.current.events });
          map.addLayer({ id: 'home-snow-glow', type: 'circle', source: 'home-snow', paint: { 'circle-radius': ['*', 22, ['get', 'glow']], 'circle-color': '#bfe3ff', 'circle-opacity': ['*', 0.35, ['get', 'glow']], 'circle-blur': 0.9 } });
          map.addLayer({ id: 'home-snow-dot', type: 'circle', source: 'home-snow', paint: { 'circle-radius': 4, 'circle-color': '#eaf6ff', 'circle-opacity': ['get', 'glow'], 'circle-stroke-color': '#7cc4ff', 'circle-stroke-width': 1 } });
          map.addLayer({ id: 'home-events', type: 'circle', source: 'home-events', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['case', ['==', ['get', 'mine'], 1], '#e4577e', '#f7c548'], 'circle-opacity': 0.9, 'circle-stroke-color': '#fff', 'circle-stroke-width': ['case', ['==', ['get', 'mine'], 1], 2, 0.5] } });
          if (map.getStyle().glyphs) {
            map.addLayer({ id: 'home-labels', type: 'symbol', source: 'home-events', filter: ['==', ['get', 'mine'], 1], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-max-width': 9 }, paint: { 'text-color': '#f4f1ea', 'text-halo-color': '#050505', 'text-halo-width': 1.3 } });
          }
        }
        if (wired) return;
        wired = true;
        map.on('click', (event) => {
          const near = (layers: string[]) => map.queryRenderedFeatures([[event.point.x - 14, event.point.y - 14], [event.point.x + 14, event.point.y + 14]], { layers: layers.filter((layer) => map.getLayer(layer)) });
          const hit = near(['home-events'])[0];
          if (hit?.properties?.id) return setPicked({ kind: 'event', id: String(hit.properties.id) });
          const flake = near(['home-snow-dot', 'home-snow-glow'])[0];
          if (flake?.properties?.name) return setPicked({ kind: 'snow', name: String(flake.properties.name) });
          setPicked(null);
        });
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      youRef.current?.remove();
      youRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is made once; later frames move it (below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new home (they chose another city): frame it.
  useEffect(() => {
    if (ready) mapRef.current?.fitBounds(bounds, { padding: 24, duration: 900 });
  }, [bounds, ready]);

  useEffect(() => {
    dataRef.current.events = eventFeatures(list, reasons);
    (mapRef.current?.getSource('home-events') as GeoJSONSource | undefined)?.setData(dataRef.current.events);
  }, [list, reasons, ready]);

  useEffect(() => {
    dataRef.current.snow = snow ? snowFeatures(month) : EMPTY;
    (mapRef.current?.getSource('home-snow') as GeoJSONSource | undefined)?.setData(dataRef.current.snow);
  }, [snow, month, ready]);

  // The blue dot is them (on this device only).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let live = true;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (!live) return;
      youRef.current?.remove();
      const dot = document.createElement('span');
      dot.className = styles.you;
      dot.setAttribute('aria-label', 'You are here');
      youRef.current = new maplibregl.Marker({ element: dot }).setLngLat([viewer.lon, viewer.lat]).addTo(map);
    });
    return () => { live = false; };
  }, [viewer, ready]);

  const pickedEvent = picked?.kind === 'event' ? list.find((event) => event.id === picked.id) ?? null : null;
  const pickedSnow = picked?.kind === 'snow' ? SNOW_SPOTS.find((spot) => spot.name === picked.name) ?? null : null;
  const where = country?.name ?? 'your part of the world';

  return (
    <section className={styles.home} aria-label={`Home: ${where}`}>
      <div ref={box} className={styles.map} />
      <div className={styles.head}>
        <p className={styles.kicker}><i aria-hidden="true" /> HOME · {where.toUpperCase()}</p>
        <h2>{list.length ? `${list.length} ${list.length === 1 ? 'event' : 'events'} coming up` : 'Your country, at a glance'}</h2>
        <p className={styles.sub}>
          {mine.length ? `${mine.length} fit your Vibe profile, in pink.` : signals.length ? 'Next four months on the calendar.' : 'Set your vibe and the ones for you light up.'}
        </p>
      </div>

      <div className={styles.tools}>
        <button type="button" className={styles.chip} aria-pressed={snow} onClick={() => setSnow((on) => !on)}>❄ Snow season</button>
        {snow ? (
          <div className={styles.months} role="group" aria-label="Month">
            {MONTHS.map((label, index) => (
              <button key={label} type="button" className={styles.month} aria-pressed={month === index + 1} onClick={() => setMonth(index + 1)}>{label}</button>
            ))}
          </div>
        ) : null}
      </div>

      {pickedEvent ? (
        <article className={styles.card} aria-live="polite">
          <button type="button" className={styles.close} onClick={() => setPicked(null)} aria-label="Close">×</button>
          <p className={styles.cardKind}>{pickedEvent.category} · {pickedEvent.city}</p>
          <h3>{pickedEvent.name}</h3>
          <p className={styles.cardDates}>{formatDateRange(pickedEvent.start, pickedEvent.end)}</p>
          {reasons.get(pickedEvent.id) ? <p className={styles.why}>For you: {reasons.get(pickedEvent.id)}</p> : null}
          <p className={styles.tagline}>{pickedEvent.tagline}</p>
          <Link className="btn btn-primary btn-sm" href={hrefFor(pickedEvent.id)}>Open {pickedEvent.city} ↗</Link>
        </article>
      ) : pickedSnow ? (
        <article className={styles.card} aria-live="polite">
          <button type="button" className={styles.close} onClick={() => setPicked(null)} aria-label="Close">×</button>
          <p className={styles.cardKind}>❄ {pickedSnow.country}</p>
          <h3>{pickedSnow.name}</h3>
          <p className={styles.why}>{MONTHS[month - 1]}: {LEVEL_WORDS[snowLevel(pickedSnow.region, month)]}.</p>
          <p className={styles.tagline}>{SEASONS[pickedSnow.region].label}. Typical months, not this year’s dates: openings move with the snow, so check the resort.</p>
          <Link className="btn btn-ghost btn-sm" href={`/trips/designer?${new URLSearchParams({ place: pickedSnow.name, region: pickedSnow.country }).toString()}`}>Plan a trip here →</Link>
        </article>
      ) : null}

      {list.length ? (
        <ol className={styles.list} aria-label={`Coming up in ${where}`}>
          {[...mine, ...list.filter((event) => !reasons.get(event.id))].slice(0, 6).map((event) => (
            <li key={event.id}>
              <button type="button" onClick={() => { setPicked({ kind: 'event', id: event.id }); mapRef.current?.easeTo({ center: [event.coords.lon, event.coords.lat], duration: 700 }); }} data-mine={reasons.get(event.id) ? true : undefined}>
                <strong>{event.name}</strong>
                <small>{event.city} · {formatDateRange(event.start, event.end)}</small>
              </button>
            </li>
          ))}
        </ol>
      ) : country ? (
        <p className={styles.empty}>Nothing on the curated calendar in {where} for the next {Math.round(HOME_DAYS / 30)} months. Try World, or the snow map.</p>
      ) : null}

      <p className={styles.source}>{snow ? 'Snow glow: the typical ski season for each mountain region, brightest in its usual best months. ' : ''}Events from the curated calendar; dates need confirming with organizers.</p>
    </section>
  );
}
