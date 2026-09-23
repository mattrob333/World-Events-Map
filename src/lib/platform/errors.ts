/**
 * Turns Supabase/PostgREST failures into sentences a partner or traveler can
 * act on. Raw constraint names and SQL never reach the UI (red team UFR-E09).
 */
export function explainPlatformError(cause: unknown): string {
  const error = (cause && typeof cause === 'object' ? cause : {}) as { code?: unknown; message?: unknown };
  const code = typeof error.code === 'string' ? error.code : '';
  const message = typeof error.message === 'string' ? error.message : '';
  // Supabase auth errors (rate limits, invalid email) carry messages written for people.
  const name = cause && typeof cause === 'object' && 'name' in cause ? String((cause as { name?: unknown }).name) : '';
  if (/^Auth\w*Error$/.test(name) && message) return message;
  switch (code) {
    case '23505':
      return 'This already exists. Refresh the studio to see it.';
    case '23514':
      return /website/i.test(message)
        ? 'Use a website address that starts with https://.'
        : 'One of the fields is not in an accepted format. Check it and try again.';
    case '23503':
      return 'This offer has traveler requests, so it cannot be deleted. Pause it instead.';
    case '42501':
      return 'Your account is not allowed to do that.';
    case 'P0001':
      // Raised by MERIDIAN's own database functions with human-written text.
      return message || 'That change is not allowed.';
    default:
      // Validation errors thrown by the app itself carry no code and are already human-written.
      if (!code && cause instanceof Error && message && !/violates|constraint|relation|syntax/i.test(message)) return message;
      return 'Unable to complete this action. Nothing was changed.';
  }
}
