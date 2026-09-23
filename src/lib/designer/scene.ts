/**
 * The live-music "scenes" a traveler would love in any city, inferred from
 * their taste (Spotify genres and eras, or music they mentioned). A scene is
 * a kind of night out, not a venue: "rock cover band in a lively bar",
 * "jazz in a listening room". Event providers and map searches are driven
 * from these, so the same taste works in Atlanta, Lisbon, or St. Moritz.
 */

import type { ListeningProfile } from './listening';

export type SceneKey =
  | 'rock-covers'
  | 'indie-alt'
  | 'hip-hop'
  | 'rnb-soul'
  | 'jazz'
  | 'blues'
  | 'country'
  | 'dance'
  | 'latin'
  | 'brazilian'
  | 'reggae'
  | 'afro'
  | 'pop'
  | 'heavy'
  | 'folk'
  | 'classical'
  | 'piano-bar';

export type Scene = {
  key: SceneKey;
  label: string;
  emoji: string;
  /** Why we think so, citing the taste signal. */
  why: string;
  /** Kinds of rooms to look for. */
  venues: string[];
  /** Map-search phrases ("rock cover band bar"). */
  searches: string[];
  /** Ticketmaster genre name, for city event search. */
  ticketmasterGenre?: string;
  /** Words that mark an event as this scene. */
  matches: RegExp;
  weight: number;
};

type Rule = Omit<Scene, 'why' | 'weight'> & { genres: RegExp };

const RULES: Rule[] = [
  { key: 'rock-covers', label: 'Rock cover bands', emoji: '🎸', genres: /classic rock|rock|album rock|soft rock|hard rock|southern rock|yacht rock|glam|arena/, venues: ['Live-music bar', 'Pub with a stage', 'Roadhouse'], searches: ['rock cover band bar', 'live rock music bar'], ticketmasterGenre: 'Rock', matches: /rock|cover band/i },
  { key: 'indie-alt', label: 'Indie & alt gigs', emoji: '🎧', genres: /indie|alternative|alt |shoegaze|post-punk|garage|britpop|emo/, venues: ['Small club', 'Record-store stage', 'Indie venue'], searches: ['indie live music venue', 'small concert venue'], ticketmasterGenre: 'Alternative', matches: /indie|alternative|alt\b/i },
  { key: 'hip-hop', label: 'Hip-hop nights', emoji: '🎤', genres: /hip hop|rap|trap|drill|grime|boom bap/, venues: ['Hip-hop club night', 'Lounge with a DJ'], searches: ['hip hop club night', 'hip hop bar DJ'], ticketmasterGenre: 'Hip-Hop/Rap', matches: /hip.?hop|rap\b/i },
  { key: 'rnb-soul', label: 'R&B and soul rooms', emoji: '🕺', genres: /r&b|rnb|soul|neo soul|motown|funk(?! carioca)|quiet storm/, venues: ['Supper club', 'Soul night', 'Live band lounge'], searches: ['soul music bar live', 'r&b night club'], ticketmasterGenre: 'R&B', matches: /soul|r&b|rnb|funk|motown/i },
  { key: 'jazz', label: 'Jazz in a listening room', emoji: '🎷', genres: /jazz|bebop|swing|big band|bossa nova/, venues: ['Jazz club', 'Hotel bar with a trio', 'Listening bar'], searches: ['jazz club live music', 'jazz bar'], ticketmasterGenre: 'Jazz', matches: /jazz|trio|quartet|swing/i },
  { key: 'blues', label: 'Blues joints', emoji: '🎺', genres: /blues|delta|chicago blues/, venues: ['Blues bar', 'Juke joint'], searches: ['blues bar live music'], ticketmasterGenre: 'Blues', matches: /blues/i },
  { key: 'country', label: 'Honky-tonks & country bars', emoji: '🤠', genres: /country|bluegrass|americana|red dirt|honky|outlaw/, venues: ['Honky-tonk', 'Dance hall', 'Saloon with a band'], searches: ['honky tonk live country music', 'country bar live band'], ticketmasterGenre: 'Country', matches: /country|bluegrass|americana|honky/i },
  { key: 'dance', label: 'DJ sets & dance floors', emoji: '🪩', genres: /house|techno|edm|electro|dance|disco|trance|drum and bass|dubstep|garage house|afro house/, venues: ['Club', 'Rooftop DJ set', 'Après or beach party'], searches: ['nightclub house music', 'rooftop DJ bar'], ticketmasterGenre: 'Dance/Electronic', matches: /dj|house|techno|disco|electronic|dance/i },
  { key: 'latin', label: 'Latin nights', emoji: '💃', genres: /reggaeton|latin|salsa|bachata|cumbia|merengue|urbano|banda|corrido/, venues: ['Salsa club', 'Latin night'], searches: ['latin night club salsa', 'reggaeton club'], ticketmasterGenre: 'Latin', matches: /latin|salsa|reggaeton|bachata|cumbia/i },
  { key: 'brazilian', label: 'Samba & Brazilian nights', emoji: '🥁', genres: /mpb|samba|pagode|sertanejo|forr|axé|axe|funk carioca|baile|brazil/, venues: ['Samba bar', 'Brazilian restaurant with live music', 'Roda de samba'], searches: ['samba live music bar', 'brazilian live music'], ticketmasterGenre: 'World', matches: /samba|brazil|bossa|mpb|pagode|forr/i },
  { key: 'reggae', label: 'Reggae & sound systems', emoji: '🌴', genres: /reggae|dancehall|dub|ska|rocksteady/, venues: ['Beach bar', 'Sound-system night'], searches: ['reggae bar live music'], ticketmasterGenre: 'Reggae', matches: /reggae|dancehall|dub\b|ska\b/i },
  { key: 'afro', label: 'Afrobeats & amapiano', emoji: '🌍', genres: /afrobeats|afropop|amapiano|highlife|afro/, venues: ['Afrobeats night', 'Lounge with a DJ'], searches: ['afrobeats club night'], ticketmasterGenre: 'World', matches: /afro|amapiano|highlife/i },
  { key: 'pop', label: 'Big pop shows & karaoke', emoji: '✨', genres: /(^|\s)pop($|\s)|dance pop|k-pop|teen pop|pop rock/, venues: ['Arena show', 'Karaoke bar', 'Piano bar'], searches: ['karaoke bar', 'pop concert'], ticketmasterGenre: 'Pop', matches: /pop|karaoke/i },
  { key: 'heavy', label: 'Metal & punk shows', emoji: '🤘', genres: /metal|punk|hardcore|thrash|grunge/, venues: ['Rock club', 'Dive bar with a stage'], searches: ['metal bar live music', 'punk rock bar'], ticketmasterGenre: 'Metal', matches: /metal|punk|hardcore/i },
  { key: 'folk', label: 'Acoustic & singer-songwriter', emoji: '🪕', genres: /folk|acoustic|singer-songwriter|celtic|irish/, venues: ['Pub session', 'Songwriter round', 'Wine bar with a guitarist'], searches: ['acoustic live music bar', 'irish pub live music'], ticketmasterGenre: 'Folk', matches: /folk|acoustic|songwriter|celtic|irish/i },
  { key: 'classical', label: 'Concert hall & opera', emoji: '🎻', genres: /classical|opera|orchestra|baroque|chamber/, venues: ['Concert hall', 'Opera house', 'Church concert'], searches: ['classical concert', 'opera house'], ticketmasterGenre: 'Classical', matches: /symphony|orchestra|opera|philharmonic|classical|quartet/i },
];

const PIANO_BAR: Omit<Scene, 'why' | 'weight'> = {
  key: 'piano-bar', label: 'Piano bars & sing-alongs', emoji: '🎹', venues: ['Dueling-piano bar', 'Piano lounge'], searches: ['piano bar sing along', 'dueling piano bar'], matches: /piano|sing.?along/i,
};

export type TasteInput = {
  genres: string[];
  eras?: ListeningProfile['eras'];
  energy?: ListeningProfile['energy'];
  topArtists?: string[];
};

export function tasteFrom(profile: { music: string[]; listening?: ListeningProfile }): TasteInput {
  const l = profile.listening;
  return {
    genres: [...(l?.genres ?? []), ...profile.music.map((m) => m.toLowerCase())],
    eras: l?.eras,
    energy: l?.energy,
    topArtists: l?.topArtists,
  };
}

/** Top scenes for a taste, strongest first. */
export function scenePlaybook(taste: TasteInput, limit = 5): Scene[] {
  const scored = new Map<SceneKey, { rule: Omit<Scene, 'why' | 'weight'>; weight: number; hits: string[] }>();
  taste.genres.forEach((raw, index) => {
    const genre = raw.toLowerCase();
    const weight = Math.max(1, 12 - index);
    for (const rule of RULES) {
      if (!rule.genres.test(genre)) continue;
      const entry = scored.get(rule.key) ?? { rule, weight: 0, hits: [] };
      entry.weight += weight;
      if (!entry.hits.includes(genre)) entry.hits.push(genre);
      scored.set(rule.key, entry);
    }
  });

  // Loving older music is the strongest cover-band signal there is.
  const retro = (taste.eras ?? []).filter((era) => Number(era.decade.slice(0, 4)) <= 1990).reduce((sum, era) => sum + era.share, 0);
  const rock = scored.get('rock-covers');
  if (rock && retro >= 0.3) rock.weight += 10;
  if (retro >= 0.4 && !scored.has('piano-bar')) scored.set('piano-bar', { rule: PIANO_BAR, weight: 4 + retro * 4, hits: [] });
  if (taste.energy === 'high') for (const key of ['dance', 'hip-hop', 'heavy'] as const) if (scored.has(key)) scored.get(key)!.weight += 3;
  if (taste.energy === 'chill') for (const key of ['jazz', 'folk', 'classical', 'rnb-soul'] as const) if (scored.has(key)) scored.get(key)!.weight += 3;

  return [...scored.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map(({ rule, weight, hits }) => ({
      ...rule,
      weight: Math.round(weight * 10) / 10,
      why:
        rule.key === 'rock-covers' && retro >= 0.3
          ? `${Math.round(retro * 100)}% of your top songs are from before 2000, and rock is in your mix.`
          : rule.key === 'piano-bar'
            ? 'You love the classics, and a room singing along to them is a great night.'
            : `Because you listen to ${hits.slice(0, 3).join(', ')}.`,
    }));
}

/** Map search links for a scene in a city: a real way in when no event feed has listings. */
export function sceneSearchLinks(scene: Pick<Scene, 'searches' | 'label'>, city: string): { label: string; href: string }[] {
  return scene.searches.slice(0, 2).map((phrase) => ({
    label: `${phrase[0].toUpperCase()}${phrase.slice(1)} in ${city}`,
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${phrase} ${city}`)}`,
  }));
}

function omit<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

/** A scene without its matcher, safe to send as JSON. */
export function publicScene(scene: Scene): Omit<Scene, 'matches'> {
  return omit(scene, 'matches');
}

export const SCENE_KEYS = [...RULES.map((rule) => rule.key), 'piano-bar'] as SceneKey[];
export const SCENE_RULES: Record<SceneKey, Omit<Scene, 'why' | 'weight'>> = Object.fromEntries(
  [...RULES.map((rule) => omit(rule, 'genres')), PIANO_BAR].map((rule) => [rule.key, rule]),
) as Record<SceneKey, Omit<Scene, 'why' | 'weight'>>;

/** One group taste from several travelers: interleaved so nobody's music drowns out the rest. */
export function mergeTastes(tastes: TasteInput[]): TasteInput | undefined {
  const withMusic = tastes.filter((taste) => taste.genres.length || taste.topArtists?.length);
  if (!withMusic.length) return undefined;
  const interleave = (lists: string[][], max: number) => {
    const out: string[] = [];
    for (let i = 0; out.length < max && lists.some((list) => i < list.length); i += 1) {
      for (const list of lists) if (list[i] && !out.includes(list[i])) out.push(list[i]);
    }
    return out.slice(0, max);
  };
  const energies = withMusic.map((taste) => taste.energy).filter(Boolean);
  return {
    genres: interleave(withMusic.map((taste) => taste.genres), 16),
    topArtists: interleave(withMusic.map((taste) => taste.topArtists ?? []), 10),
    eras: withMusic.find((taste) => taste.eras?.length)?.eras,
    energy: energies.length && energies.every((energy) => energy === energies[0]) ? energies[0] : 'mixed',
  };
}
