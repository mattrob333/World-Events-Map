import { beforeEach, describe, expect, it } from 'vitest';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';

const origin = { lat: 40.7, lon: -74.0 };
const destination = { lat: 48.86, lon: 2.35 };

describe('globe journeys', () => {
  beforeEach(() => {
    useGlobeStore.setState({
      flight: null,
      journey: null,
      flightSerial: 0,
      autoRotate: true,
    });
  });

  it('replays a card journey on repeated clicks even after the camera consumes its request', () => {
    const store = useGlobeStore.getState();
    store.travelTo(destination, origin);
    const first = useGlobeStore.getState();
    expect(first.journey).toMatchObject({ origin, target: destination, nonce: 1 });
    expect(first.flight).toMatchObject({ journey: true, origin, nonce: 1 });
    expect(first.autoRotate).toBe(false);

    first.consumeFlight();
    useGlobeStore.getState().travelTo(destination, origin);
    const replay = useGlobeStore.getState();
    expect(replay.flight?.nonce).toBe(2);
    expect(replay.journey?.nonce).toBe(2);
  });

  it('uses the current globe view when no verified starting location is supplied', () => {
    useGlobeStore.getState().travelTo(destination, null);
    expect(useGlobeStore.getState().journey?.origin).toBeNull();
    expect(useGlobeStore.getState().flight?.origin).toBeNull();
  });

  it('clears a route when the viewer chooses a region instead', () => {
    useGlobeStore.getState().travelTo(destination, origin);
    useGlobeStore.getState().flyTo({ lat: 0, lon: 23 }, 4.2);
    const state = useGlobeStore.getState();
    expect(state.journey).toBeNull();
    expect(state.flight).toMatchObject({ journey: false, nonce: 2 });
  });
});
