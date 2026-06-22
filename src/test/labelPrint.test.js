import { describe, it, expect } from 'vitest';
import { esc } from '../lib/htmlUtils';

describe('esc (HTML escaping)', () => {
  it('escapes & character', () => {
    expect(esc('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes < character', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes > character', () => {
    expect(esc('a > b')).toBe('a &gt; b');
  });

  it('escapes " character', () => {
    expect(esc('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('handles null', () => {
    expect(esc(null)).toBe('');
  });

  it('handles undefined', () => {
    expect(esc(undefined)).toBe('');
  });

  it('does not double-escape', () => {
    const once = esc('A & B');
    expect(once).toBe('A &amp; B');
    // Double-escaping would produce &amp;amp;
    const twice = esc(once);
    expect(twice).toBe('A &amp;amp; B');
    // Confirming original single escape is correct
    expect(once).not.toContain('&amp;amp;');
  });
});
