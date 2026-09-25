import { describe, expect, it } from 'vitest';
import { containsPattern } from './like';

describe('containsPattern', () => {
  it('membungkus kata kunci dengan wildcard di kedua sisi', () => {
    expect(containsPattern('fiksi')).toBe('%fiksi%');
  });

  it('memperlakukan % dan _ dari pengguna secara harfiah', () => {
    expect(containsPattern('50%')).toBe('%50\\%%');
    expect(containsPattern('a_b')).toBe('%a\\_b%');
  });

  it('meng-escape garis miring terbalik', () => {
    expect(containsPattern('a\\b')).toBe('%a\\\\b%');
  });
});
