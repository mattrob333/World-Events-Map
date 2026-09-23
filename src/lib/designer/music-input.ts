import { isIsoDate } from './itinerary';
import type { TasteInput } from './scene';

/** Shared validation for the music routes. Every list is bounded and every string trimmed. */
export function textList(value: unknown, maxItems: number, maxLength = 80): string[] {
  const list = (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, maxLength));
  return [...new Set(list)].slice(0, maxItems);
}

export function readTaste(value: unknown): TasteInput {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const eras = (Array.isArray(source.eras) ? source.eras : [])
    .flatMap((raw) => {
      const era = raw as Record<string, unknown>;
      return typeof era?.decade === 'string' && /^\d{4}s$/.test(era.decade) && typeof era.share === 'number' && era.share >= 0 && era.share <= 1
        ? [{ decade: era.decade, share: era.share }]
        : [];
    })
    .slice(0, 5);
  return {
    genres: textList(source.genres, 16, 40).map((genre) => genre.toLowerCase()),
    topArtists: textList(source.topArtists, 10),
    eras,
    energy: source.energy === 'high' || source.energy === 'chill' || source.energy === 'mixed' ? source.energy : undefined,
  };
}

export function readWindow(body: Record<string, unknown>): { startDate?: string; endDate?: string } {
  const startDate = typeof body.startDate === 'string' && isIsoDate(body.startDate) ? body.startDate : undefined;
  const endDate = typeof body.endDate === 'string' && isIsoDate(body.endDate) ? body.endDate : undefined;
  return { startDate, endDate: startDate && endDate && endDate < startDate ? undefined : endDate };
}

export function listenerSummary(taste: TasteInput, extra: { listeningHours?: string; playlistHabits?: string[] } = {}) {
  return {
    topArtists: taste.topArtists ?? [],
    genres: taste.genres,
    eras: (taste.eras ?? []).map((era) => era.decade),
    ...extra,
  };
}
