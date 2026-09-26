'use client';

import { memberFetch } from '@/lib/platform/memberFetch';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import { SourceLogo } from '@/components/brand/SourceLogo';
import { circleRing, closesLabel, PULSE_RADII, PULSE_RADIUS_METERS, pulseStyle, roundForSearch, type PulseResult, type PulseVenue, type PulseWhat } from '@/lib/now/pulse';
import { rankNowPicks } from '@/lib/now/nowPicks';
import { buildTonight } from '@/lib/now/tonight';
import { useActiveProfile } from '@/lib/designer/store';
import { allSignals } from '@/lib/vibe/signals';
import { TonightTimeline } from './TonightTimeline';
import { formatMiles } from '@/lib/units';
import styles from './nearby-pulse.module.css';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const STREET_ZOOM = 11.4; // about five miles across a phone screen
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
/** If the street style can't load, the pulses still show on a plain dark map. */
const FALLBACK_STYLE = { version: 8 as const, sources: {}, layers: [{ id: 'background', type: 'background' as const, paint: { 'background-color': '#0c0c0c' } }] };
const HEAT = ['interpolate', ['linear'], ['get', 'rank'], 0, '#f7c548', 0.6, '#f26b2a', 1, '#e4577e'] as unknown as string;

function addPulseLayers(map: MapLibreMap, labels: boolean) {
  if (map.getSource('pulse-points')) return;
  map.addSource('pulse-columns', { type: 'geojson', data: EMPTY });
  map.addSource('pulse-points', { type: 'geojson', data: EMPTY });
  map.addLayer({ id: 'pulse-halo', type: 'circle', source: 'pulse-points', paint: { 'circle-radius': ['get', 'radius'], 'circle-color': HEAT, 'circle-opacity': 0.35, 'circle-blur': 0.6, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'pulse-columns', type: 'fill-extrusion', source: 'pulse-columns', paint: { 'fill-extrusion-color': HEAT, 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.9 } });
  map.addLayer({ id: 'pulse-dots', type: 'circle', source: 'pulse-points', paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': HEAT, 'circle-stroke-width': 2 } });
  // Names need the street style's fonts; on the plain fallback the list names them instead.
  if (labels) {
    map.addLayer({
      id: 'pulse-labels',
      type: 'symbol',
      source: 'pulse-points',
      filter: ['==', ['get', 'top'], 1],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-max-width': 10 },
      paint: { 'text-color': '#f4f1ea', 'text-halo-color': '#050505', 'text-halo-width': 1.4 },
    });
  }
}

type Stage = 'spinning' | 'locating' | 'denied' | 'flying' | 'ready';
type Note = { tone: 'info' | 'warn'; text: string; retry?: boolean } | null;
type Here = { lat: number; lng: number };

function metersBetween(a: Here, b: Here): number {
  const r = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

const pretty = (category: string) => category.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function features(venues: readonly PulseVenue[]) {
  const busiest = venues[0]?.busyness ?? 0;
  const points: GeoJSON.Feature[] = [];
  const columns: GeoJSON.Feature[] = [];
  venues.forEach((venue, index) => {
    const look = pulseStyle(venue.busyness, busiest);
    const properties = { id: venue.id, name: venue.name, radius: look.radius, height: look.height, rank: look.rank, top: index < 5 ? 1 : 0 };
    points.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [venue.lng, venue.lat] }, properties });
    columns.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleRing(venue, 28 + 40 * look.rank)] }, properties });
  });
  return { points: { type: 'FeatureCollection', features: points } as GeoJSON.FeatureCollection, columns: { type: 'FeatureCollection', features: columns } as GeoJSON.FeatureCollection };
}

/**
 * Vibe Now: land somewhere, tap the sun. The globe finds you and dives to
 * street level; the places busy right now pulse, biggest where it's busiest
 * (BestTime foot traffic, within 2, 5 or 10 miles). Below the map, Tonight
 * shows each one on an hourly scale from now until it closes, ordered by your
 * Vibe profile. Tap one to see it on the map, then go.
 *
 * Your exact position stays on the phone: searches use a point rounded to
 * about a kilometer. Members only.
 */
export function NearbyPulse() {
  const box = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const youRef = useRef<Marker | null>(null);
  const [stage, setStage] = useState<Stage>('spinning');
  const [note, setNote] = useState<Note>(null);
  const [here, setHere] = useState<Here | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [venues, setVenues] = useState<PulseVenue[] | null>(null);
  const [basis, setBasis] = useState<'live' | 'forecast' | 'mixed'>('forecast');
  const [selected, setSelected] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [radius, setRadius] = useState<number>(PULSE_RADIUS_METERS);
  const [what, setWhat] = useState<PulseWhat>('surprise');
  const [now, setNow] = useState<Date | null>(null);
  const active = useActiveProfile();
  const pointsRef = useRef<GeoJSON.FeatureCollection>(EMPTY);
  const columnsRef = useRef<GeoJSON.FeatureCollection>(EMPTY);

  // The local clock, where they are (the phone follows the time zone when they land).
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  // The map: a spinning globe until we know where they are.
  useEffect(() => {
    let cancelled = false;
    let spin = 0;
    let pulse = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !box.current) return;
      const map = new maplibregl.Map({
        container: box.current,
        style: STYLE_URL,
        center: [-60, 25],
        zoom: 1.2,
        attributionControl: false,
      });
      // Credits up top, clear of the list.
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'OpenFreeMap' }), 'top-right');
      mapRef.current = map;
      let fellBack = false;
      const fallBack = () => {
        if (fellBack || cancelled) return;
        fellBack = true;
        map.setStyle(FALLBACK_STYLE);
      };
      // No street style within 8 seconds, or it failed: carry on without it.
      let styleReady = false;
      const styleTimer = window.setTimeout(() => { if (!styleReady) fallBack(); }, 8000);
      // Only a style that never loaded falls back; a stray tile error later keeps the street map.
      map.on('error', () => { if (!styleReady) fallBack(); });
      let wired = false;
      map.on('style.load', () => {
        styleReady = true;
        window.clearTimeout(styleTimer);
        map.setProjection({ type: 'globe' });
        addPulseLayers(map, !fellBack);
        (map.getSource('pulse-points') as GeoJSONSource | undefined)?.setData(pointsRef.current);
        (map.getSource('pulse-columns') as GeoJSONSource | undefined)?.setData(columnsRef.current);
        if (wired) return;
        wired = true;
        for (const layer of ['pulse-dots', 'pulse-columns']) {
          map.on('click', layer, (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === 'string') setSelected(id);
          });
        }
        setMapReady(true);
        // Breathing halos: bigger and brighter where it's busiest.
        if (!reduced) {
          const beat = (time: number) => {
            if (cancelled) return;
            const phase = (time % 1800) / 1800;
            if (map.getLayer('pulse-halo')) {
              map.setPaintProperty('pulse-halo', 'circle-radius', ['*', ['get', 'radius'], 1 + phase * 0.9]);
              map.setPaintProperty('pulse-halo', 'circle-opacity', 0.45 * (1 - phase));
            }
            pulse = requestAnimationFrame(beat);
          };
          pulse = requestAnimationFrame(beat);
        }
      });
      if (!reduced) {
        const turn = () => {
          if (cancelled || !mapRef.current || mapRef.current.getZoom() > 3) return;
          const center = map.getCenter();
          map.setCenter([center.lng + 0.12, center.lat]);
          spin = requestAnimationFrame(turn);
        };
        map.once('load', () => { spin = requestAnimationFrame(turn); });
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(spin);
      cancelAnimationFrame(pulse);
      youRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const locate = useCallback(() => {
    setNote(null);
    if (!('geolocation' in navigator)) {
      setNote({ tone: 'warn', text: 'This browser can’t share your location.' });
      return;
    }
    setStage('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => setHere({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => {
        setStage('denied');
        setNote({ tone: 'warn', text: 'Location is off. Allow it for this site to see what’s busy around you.', retry: true });
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 },
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(locate, 600);
    return () => window.clearTimeout(timer);
  }, [locate]);

  // Found them: dive to street level and drop the "you" dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!here || !map || !mapReady) return;
    let live = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (!live) return;
      youRef.current?.remove();
      const dot = document.createElement('span');
      dot.className = styles.you;
      dot.setAttribute('aria-label', 'You are here');
      youRef.current = new maplibregl.Marker({ element: dot }).setLngLat([here.lng, here.lat]).addTo(map);
    });
    setStage('flying');
    // Listen first: with reduced motion the move ends synchronously inside flyTo.
    map.once('moveend', () => { if (live) setStage('ready'); });
    map.flyTo({ center: [here.lng, here.lat], zoom: STREET_ZOOM, pitch: 55, bearing: -18, duration: reduced ? 0 : 5200, essential: true });
    return () => { live = false; };
  }, [here, mapReady]);

  // Where they are, in words ("Omaha, Nebraska"), from a point rounded to about a kilometer.
  useEffect(() => {
    if (!here) return;
    let live = true;
    const point = roundForSearch(here);
    memberFetch(`/api/geo/lookup?lat=${point.lat}&lng=${point.lng}`)
      .then(async (response) => (response.ok ? ((await response.json()) as { label?: string | null }) : null))
      .then((body) => { if (live) setPlaceLabel(body?.label ?? null); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [here]);

  // What's busy: again whenever they change the radius or what they're after.
  useEffect(() => {
    if (!here) return;
    let live = true;
    const miles = Math.round(radius / 1609);
    setVenues(null);
    setSelected(null);
    memberFetch('/api/now/pulse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: roundForSearch(here), what, radiusMeters: radius }) })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as Partial<PulseResult> & { code?: string; error?: string };
        if (!live) return;
        if (!response.ok) {
          setVenues([]);
          setNote({ tone: response.status === 503 && body.code === 'NOW_PROVIDER_NOT_CONFIGURED' ? 'info' : 'warn', text: body.code === 'NOW_PROVIDER_NOT_CONFIGURED' ? 'Foot traffic isn’t connected yet. The map is ready; the pulses arrive once BestTime is on.' : body.code === 'SIGN_IN_REQUIRED' || body.code === 'MEMBERS_ONLY' ? 'Vibe Now is members-only for now. Log in from the top right to see what’s busy.' : body.error ?? 'Foot traffic could not be checked. Try again shortly.' });
          return;
        }
        setNote(null);
        const list = (body.venues ?? []).map((venue) => ({ ...venue, distanceMeters: Math.round(metersBetween(here, venue)) })).filter((venue) => venue.distanceMeters <= radius * 1.05);
        setVenues(list);
        const kinds = new Set(list.map((venue) => venue.basis));
        setBasis(kinds.size > 1 ? 'mixed' : kinds.has('live') ? 'live' : 'forecast');
        if (!list.length) setNote({ tone: 'info', text: `Nothing within ${miles} miles has a foot-traffic reading this hour. Try a wider radius.` });
      })
      .catch(() => {
        if (!live) return;
        setVenues([]);
        setNote({ tone: 'warn', text: 'Foot traffic could not be checked. Check your connection and try again.', retry: true });
      });
    return () => { live = false; };
  }, [here, radius, what]);

  // Pulses on the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !venues) return;
    const { points, columns } = features(venues);
    pointsRef.current = points;
    columnsRef.current = columns;
    (map.getSource('pulse-points') as GeoJSONSource | undefined)?.setData(points);
    (map.getSource('pulse-columns') as GeoJSONSource | undefined)?.setData(columns);
  }, [venues, mapReady]);

  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : 0;
  // Busiest first (foot traffic is the point), nudged by their Vibe profile when they have one.
  const ranked = useMemo(() => {
    if (!venues?.length || !now) return [];
    const profile = active?.profile;
    return rankNowPicks(venues, { energy: 'lively', nowMinutes, signals: profile ? allSignals(profile) : [], dials: profile?.dials, limit: venues.length });
  }, [venues, now, nowMinutes, active]);
  const tonight = useMemo(() => (ranked.length ? buildTonight(ranked.slice(0, 20), nowMinutes) : null), [ranked, nowMinutes]);
  const winks = useMemo(() => new Map(ranked.map((pick) => [pick.id, pick.wink])), [ranked]);

  const focus = (venue: PulseVenue) => {
    setSelected(venue.id);
    mapRef.current?.flyTo({ center: [venue.lng, venue.lat], zoom: 14.5, pitch: 50, duration: 1600, essential: true });
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const picked = venues?.find((venue) => venue.id === selected) ?? null;
  const miles = Math.round(radius / 1609);
  const clock = now ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const status = stage === 'denied' ? 'Location is off' : stage === 'spinning' || stage === 'locating' ? 'Finding you…' : stage === 'flying' ? 'Diving in…' : venues === null ? 'Reading foot traffic…' : venues.length ? `${venues.length} places buzzing within ${miles} miles` : `Within ${miles} miles of you`;

  return (
    <main className={styles.page}>
      <section className={styles.stage} aria-label="Vibe Now: what’s busy around you">
        <div ref={box} className={styles.map} />
        <div className={styles.top}>
          <p className={styles.kicker}><i aria-hidden="true" /> VIBE NOW{placeLabel ? <span className={styles.where}> · {placeLabel}</span> : null}{clock ? <span className={styles.where}> · {clock}</span> : null}</p>
          <h1 className={styles.status} aria-live="polite">{status}</h1>
        </div>
        {note && (
          <div className={styles.note} data-tone={note.tone} role="status">
            <p>{note.text}</p>
            {note.retry && <button type="button" className="btn btn-primary btn-sm" onClick={locate}>Try again</button>}
          </div>
        )}
      </section>

      <div className={styles.below}>
        <div className={styles.controls}>
          <div className={styles.chips} role="group" aria-label="How far">
            {PULSE_RADII.map((choice) => (
              <button key={choice.miles} type="button" className={styles.chip} aria-pressed={radius === choice.meters} onClick={() => setRadius(choice.meters)}>{choice.miles} mi</button>
            ))}
          </div>
          <div className={styles.chips} role="group" aria-label="What you’re after">
            {WHATS.map((choice) => (
              <button key={choice.value} type="button" className={styles.chip} aria-pressed={what === choice.value} onClick={() => setWhat(choice.value)}>{choice.label}</button>
            ))}
          </div>
        </div>

        {picked && (
          <article className={styles.picked}>
            <button type="button" className={styles.close} onClick={() => setSelected(null)} aria-label="Close">×</button>
            <p className={styles.pickedKind}>{pretty(picked.category)}{picked.distanceMeters !== undefined ? ` · ${formatMiles(picked.distanceMeters / 1000)}` : ''}{picked.openAllNight ? ' · open all night' : closesLabel(picked.closesMinutes) ? ` · ${closesLabel(picked.closesMinutes)}` : ''}</p>
            <h2>{picked.name}</h2>
            <Meter venue={picked} />
            {winks.get(picked.id) ? <p className={styles.wink}>{winks.get(picked.id)}</p> : null}
            {picked.address && <p className={styles.address}>{picked.address}</p>}
            <div className={styles.pickedActions}>
              <a className="btn btn-primary btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${picked.name} ${picked.address ?? ''}`)}`} target="_blank" rel="noopener noreferrer">
                <SourceLogo source="google maps" size={14} className="mr-1.5" />Take me there ↗
              </a>
              <a className="btn btn-ghost btn-sm" href={picked.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${picked.name} ${picked.address ?? ''}`)}`} target="_blank" rel="noopener noreferrer">Look at the place ↗</a>
            </div>
          </article>
        )}

        {tonight && tonight.rows.length > 0 && <TonightTimeline tonight={tonight} selected={selected} onPick={focus} winks={winks} />}

        {venues && venues.length > 0 && (
          <p className={styles.source}>
            Foot traffic from BestTime · {basis === 'live' ? 'live now' : basis === 'mixed' ? 'live where marked, else the usual for this hour' : 'the usual for this hour'}. Closing times from BestTime’s venue hours{venues.some((venue) => venue.hoursFrom === 'google') ? ', else Google Places' : ''}; check before you go. {active ? 'Ordered by your Vibe profile.' : 'Set your vibe and this list orders itself around you.'} Your exact location stays on your phone.
          </p>
        )}
      </div>
    </main>
  );
}

const WHATS: { value: PulseWhat; label: string }[] = [
  { value: 'surprise', label: 'Anything' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'food', label: 'Food' },
  { value: 'music', label: 'Live music' },
];

function Meter({ venue, compact = false }: { venue: PulseVenue; compact?: boolean }) {
  return (
    <span className={compact ? styles.meterCompact : styles.meter}>
      <span className={styles.bar} aria-hidden="true"><i style={{ width: `${venue.busyness}%` }} /></span>
      <span className={styles.pct}>{venue.busyness}%{venue.basis === 'live' ? <em> live</em> : null}</span>
    </span>
  );
}
