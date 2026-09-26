import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { researchDestination } = vi.hoisted(() => ({ researchDestination: vi.fn(async () => ({ place: 'Lisbon' })) }));
vi.mock('@/lib/research/destination', () => ({ researchCacheMisses: () => 3, researchDestination }));
// Signed-in member: this test is about the research switch, not sign-in.
vi.mock('@/lib/platform/server/member', () => ({ requireMember: async () => ({ id: 'member', email: null }) }));

import { resetDesignerLimitsForTests } from '@/lib/designer/server/guard';
import { POST } from '../designer/research/route';

const request = () => new Request('http://localhost/api/designer/research', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', 'x-vercel-forwarded-for': '203.0.113.9' },
  body: JSON.stringify({ name: 'Lisbon' }),
});

afterEach(() => { vi.unstubAllEnvs(); researchDestination.mockClear(); resetDesignerLimitsForTests(); });

it('keeps visitor research off on the live site until RESEARCH_PUBLIC=on', async () => {
  vi.stubEnv('TREG_TOKEN', 'test');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('RESEARCH_PUBLIC', '');
  const paused = await POST(request());
  expect(paused.status).toBe(503);
  expect(researchDestination).not.toHaveBeenCalled();

  vi.stubEnv('RESEARCH_PUBLIC', 'on');
  expect((await POST(request())).status).toBe(200);

  vi.stubEnv('RESEARCH_PUBLIC', '');
  vi.stubEnv('VERCEL_ENV', 'preview');
  expect((await POST(request())).status).toBe(200);
});
