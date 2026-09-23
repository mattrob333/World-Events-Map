import { describe, expect, it, vi } from 'vitest';
import { requestBrowserPosition } from '../browser-position';

function setup() {
  let success!: PositionCallback;
  let failure!: PositionErrorCallback;
  const geo = { getCurrentPosition: vi.fn<Geolocation['getCurrentPosition']>((ok, fail) => { success = ok; failure = fail!; }) };
  const onPosition = vi.fn();
  const onFailure = vi.fn();
  const cancel = requestBrowserPosition(geo, onPosition, onFailure);
  return { geo, onPosition, onFailure, cancel, success: (coords: Partial<GeolocationCoordinates> = {}, timestamp = Date.now()) => success({ coords: { latitude: 33.749, longitude: -84.388, accuracy: 50, ...coords }, timestamp } as GeolocationPosition), failure: (code: number) => failure({ code } as GeolocationPositionError) };
}

describe('fresh browser location', () => {
  it('requests a recent network-grade fix and rounds Atlanta to city-scale coordinates', () => {
    const request = setup();
    expect(request.geo.getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, timeout: 20_000, maximumAge: 120_000 });
    request.success();
    expect(request.onPosition).toHaveBeenCalledWith({ lat: 33.7, lon: -84.4 });
  });
  it('does not accept stale or continent-scale positions', () => {
    const request = setup();
    request.success({ accuracy: 150_000 });
    request.success({}, Date.now() - 900_000);
    expect(request.onPosition).not.toHaveBeenCalled();
    expect(request.onFailure).toHaveBeenCalledWith('unavailable');
  });
  it('ignores a delayed browser callback after the user chooses a city', () => {
    const request = setup();
    request.cancel();
    request.success({ latitude: 40.7, longitude: -74 });
    request.failure(1);
    expect(request.onPosition).not.toHaveBeenCalled();
    expect(request.onFailure).not.toHaveBeenCalled();
  });
  it('distinguishes permission denial from a timeout', () => {
    const request = setup();
    request.failure(1);
    expect(request.onFailure).toHaveBeenLastCalledWith('denied');
    request.failure(3);
    expect(request.onFailure).toHaveBeenLastCalledWith('unavailable');
  });
});
