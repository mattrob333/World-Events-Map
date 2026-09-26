import { describe, expect, it } from 'vitest';
import { initialsFor } from './AccountMenu';

describe('initialsFor', () => {
  it('uses first and last initials, then a single name, then the email', () => {
    expect(initialsFor('Matt Roberson', undefined)).toBe('MR');
    expect(initialsFor('Matt', undefined)).toBe('M');
    expect(initialsFor(undefined, 'matt@example.com')).toBe('M');
    expect(initialsFor(undefined, undefined)).toBe('');
  });
});
