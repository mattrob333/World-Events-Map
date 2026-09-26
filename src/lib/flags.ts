/** Simulated members are opt-in. Real accounts use the Supabase platform. */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_MERIDIAN_DEMO === '1';
}
export const DEMO_LABEL = 'Demo — simulated members and activity';

/**
 * Shelved features (North Star spec): hidden from nav and search, their routes
 * redirect home, their code and tables stay. Turn one back on with its
 * NEXT_PUBLIC_ variable set to "1" (public so the nav can read it too).
 */
export const FEATURES = {
  /** Charter, aviation and partner offers: /access, /partners. */
  access: process.env.NEXT_PUBLIC_FEATURE_ACCESS === '1',
  /** The Circles directory and member matching: /circles (index), /community. Circle rooms stay on. */
  circles: process.env.NEXT_PUBLIC_FEATURE_CIRCLES === '1',
} as const;
