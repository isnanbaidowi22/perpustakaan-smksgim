import { describe, expect, it } from 'vitest';
import { Topbar } from './topbar';

describe('Topbar', () => {
  it('mengekspor komponen Topbar sebagai fungsi', () => {
    expect(typeof Topbar).toBe('function');
  });
});
