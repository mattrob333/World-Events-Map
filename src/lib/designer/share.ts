import { normalizeProfile, type TravelerProfile } from './profile';

/**
 * A profile packed into a link fragment (`/moodboard/import#p=…`). Fragments
 * are never sent to the server, so an agent can hand a traveler their profile
 * without dope.travel storing it. Anything decoded is untrusted and goes
 * through normalizeProfile.
 */
export const MAX_SHARE_CHARS = 16_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeProfile(profile: TravelerProfile): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify({ v: 1, profile })));
}

export function decodeProfile(encoded: string): TravelerProfile | null {
  if (!encoded || encoded.length > MAX_SHARE_CHARS || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as { v?: number; profile?: unknown };
    return parsed?.v === 1 && parsed.profile ? normalizeProfile(parsed.profile) : null;
  } catch {
    return null;
  }
}

export function importUrl(origin: string, profile: TravelerProfile): string {
  return `${origin.replace(/\/$/, '')}/moodboard/import#p=${encodeProfile(profile)}`;
}
