import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../components/PhoneChip';

describe('normalizePhone', () => {
  it('normalizes +212 prefix to 0', () => {
    expect(normalizePhone('+212612345678')).toBe('0612345678');
  });

  it('normalizes 00212 prefix to 0', () => {
    expect(normalizePhone('00212612345678')).toBe('0612345678');
  });

  it('normalizes 212 prefix to 0', () => {
    expect(normalizePhone('212612345678')).toBe('0612345678');
  });

  it('strips spaces and dashes', () => {
    expect(normalizePhone('06 12-34 56 78')).toBe('0612345678');
  });

  it('handles empty input', () => {
    expect(normalizePhone('')).toBe('');
  });

  it('handles null input', () => {
    expect(normalizePhone(null)).toBe('');
  });

  it('handles undefined input', () => {
    expect(normalizePhone(undefined)).toBe('');
  });
});
