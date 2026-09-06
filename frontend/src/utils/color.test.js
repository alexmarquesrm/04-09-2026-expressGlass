import { describe, expect, it } from 'vitest';
import { gradientFor, initials } from './color.js';

describe('gradientFor', () => {
  it('returns the same gradient for the same seed', () => {
    expect(gradientFor('Bruno Santos')).toBe(gradientFor('Bruno Santos'));
  });

  it('returns a linear-gradient string', () => {
    expect(gradientFor('Ana')).toMatch(/^linear-gradient\(135deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
  });

  it('handles numeric seeds coerced to string', () => {
    expect(() => gradientFor(42)).not.toThrow();
  });
});

describe('initials', () => {
  it('returns "?" for a missing name', () => {
    expect(initials('')).toBe('?');
    expect(initials(undefined)).toBe('?');
  });

  it('returns first+last initial for a full name', () => {
    expect(initials('Bruno Santos')).toBe('BS');
  });

  it('returns a single initial for a single-word name', () => {
    expect(initials('Ana')).toBe('A');
  });

  it('ignores repeated whitespace between names', () => {
    expect(initials('  Ana   Costa  ')).toBe('AC');
  });

  it('uses the first and the last name, not the middle ones', () => {
    expect(initials('Ana Maria Costa')).toBe('AC');
  });
});
