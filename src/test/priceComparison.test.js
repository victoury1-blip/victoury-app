import { describe, it, expect } from 'vitest';

describe('price comparison logic', () => {
  function pricesEqual(a, b) {
    return Number(a) === Number(b);
  }

  it('350.00 and 350 should be considered equal', () => {
    expect(pricesEqual(350.00, 350)).toBe(true);
  });

  it('349.99 and 350 should be different', () => {
    expect(pricesEqual(349.99, 350)).toBe(false);
  });

  it('handles 0 values', () => {
    expect(pricesEqual(0, 0)).toBe(true);
    expect(pricesEqual(0, 1)).toBe(false);
  });

  it('handles string number comparison', () => {
    expect(pricesEqual('350.00', 350)).toBe(true);
    expect(pricesEqual('350', '350.00')).toBe(true);
  });
});
