/**
 * Build-time public flag. Direct `process.env` references so Next can inline
 * them into the client bundle.
 *
 * Default is DEMO ON. Until real accounts exist (Phase 2) a production build
 * with demo off is a globe with no members, groups or conversations, which
 * reads as broken rather than honest. The demo stays truthful because every
 * simulated surface carries `DEMO_LABEL` in the masthead and "Simulated for
 * review" on records. Set NEXT_PUBLIC_MERIDIAN_DEMO=0 to ship real mode.
 *
 * This was previously "off in production unless set" with the switch in a
 * committed .env.production; the first Vercel build did not apply that file
 * and shipped real mode. The default now lives in code so no host's env-file
 * semantics can change what production shows.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_MERIDIAN_DEMO !== '0';
}

export const DEMO_LABEL = 'Demo — simulated members and activity';
