const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function circleInvitePath(id: string): string | null {
  return UUID.test(id) ? `/community?circle=${encodeURIComponent(id)}` : null;
}

export function circleInviteUrl(origin: string, id: string): string | null {
  const path = circleInvitePath(id);
  if (!path) return null;
  return new URL(path, origin).toString();
}
