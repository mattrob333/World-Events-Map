/** Build-time public flag; use direct env references so Next can inline them. */
export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_MERIDIAN_DEMO === '1') return true;
  if (process.env.NEXT_PUBLIC_MERIDIAN_DEMO === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

export const DEMO_LABEL = 'Demo — simulated members and activity';
