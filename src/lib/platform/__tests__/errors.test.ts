import { describe, expect, it } from 'vitest';
import { explainPlatformError } from '../errors';

describe('platform error copy (UFR-E09)', () => {
  it('maps database codes to plain language', () => {
    expect(explainPlatformError({ code: '23503', message: 'update or delete on table "offers" violates foreign key constraint "inquiries_offer_id_fkey"' }))
      .toMatch(/Pause it instead/);
    expect(explainPlatformError({ code: '23514', message: 'new row violates check constraint "provider_orgs_website_check"' }))
      .toMatch(/https:\/\//);
    expect(explainPlatformError({ code: '23505', message: 'duplicate key value violates unique constraint "provider_orgs_owner_id_key"' }))
      .toMatch(/already exists/);
  });

  it('keeps the app’s own validation messages and hides raw SQL', () => {
    expect(explainPlatformError(new Error('Choose an expiry in the future.'))).toBe('Choose an expiry in the future.');
    expect(explainPlatformError(new Error('relation "x" does not exist'))).toMatch(/Nothing was changed/);
    expect(explainPlatformError(null)).toMatch(/Nothing was changed/);
  });
});
