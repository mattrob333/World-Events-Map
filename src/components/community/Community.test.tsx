import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../../../next.config';

const INVITE = '3f1e2d4c-5b6a-4789-8abc-def012345678';

async function render(features: { access: boolean; circles: boolean }, props: Record<string, string> = {}) {
  vi.resetModules();
  vi.doMock('@/lib/flags', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/flags')>()), FEATURES: { ...features, homeExtras: false } }));
  const { Community } = await import('./Community');
  return renderToStaticMarkup(createElement(Community, props));
}

afterEach(() => {
  vi.doUnmock('@/lib/flags');
  vi.unstubAllEnvs();
});

describe('Community with shelved features off', () => {
  it('hides the partner offers and requests tabs, even when a link asks for them', async () => {
    const html = await render({ access: false, circles: false }, { initialCircle: INVITE, initialTab: 'offers', initialOffer: 'offer-1' });
    expect(html).not.toContain('Partner offers');
    expect(html).not.toContain('Your requests');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('travel partners');
    expect(html).toContain('Your Circle invitation.');
  });

  it('keeps the circles directory and its composer out of an invite page', async () => {
    const html = await render({ access: false, circles: false }, { initialCircle: INVITE });
    expect(html).not.toContain('Make a plan worth sharing.');
    expect(html).not.toContain('One shared interest is all it takes.');
  });

  it('shows every tab again when the features are back on', async () => {
    const html = await render({ access: true, circles: true }, { initialTab: 'offers' });
    expect(html).toContain('Partner offers');
    expect(html).toContain('Your requests');
    expect(html).toContain('A good reason to go.');
  });
});

describe('/community redirect while Circles is off', () => {
  async function redirected(query: Record<string, string>): Promise<boolean> {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_CIRCLES', '');
    const { matchHas } = await import('next/dist/shared/lib/router/utils/prepare-destination');
    const rules = (await nextConfig.redirects!()).filter((rule) => rule.source === '/community');
    expect(rules).toHaveLength(1);
    const [rule] = rules;
    const req = { headers: {} } as Parameters<typeof matchHas>[0];
    return matchHas(req, query, rule.has, rule.missing) !== false;
  }

  it('sends a missing, empty or malformed circle to Trips', async () => {
    expect(await redirected({})).toBe(true);
    expect(await redirected({ circle: '' })).toBe(true);
    expect(await redirected({ circle: 'directory' })).toBe(true);
    expect(await redirected({ circle: `${INVITE}x` })).toBe(true);
    expect(await redirected({ circle: `x${INVITE}` })).toBe(true);
  });

  it('still opens a well-formed Circle invite', async () => {
    expect(await redirected({ circle: INVITE })).toBe(false);
    expect(await redirected({ circle: INVITE.toUpperCase() })).toBe(false);
  });
});
