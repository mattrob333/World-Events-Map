/** Simulated members are opt-in. Real accounts use the Supabase platform. */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_MERIDIAN_DEMO === '1';
}
export const DEMO_LABEL = 'Demo — simulated members and activity';
