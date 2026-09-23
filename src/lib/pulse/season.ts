import type { WeatherContext, WeatherContextProvider } from './types';

/**
 * Honest stand-in until a weather vendor is chosen.
 * Returns seasonal calendar context only — never a live observation.
 */
export const calendarSeasonProvider: WeatherContextProvider = {
  async getDestinationContext(destinationId, window): Promise<WeatherContext> {
    return {
      destinationId,
      seasonLabel: 'Calendar season',
      windowLabel: `${window.start} → ${window.end}`,
      note: 'No live weather provider is connected. This is the curated event window only.',
      provenance: 'seasonal_calendar',
    };
  },
};
