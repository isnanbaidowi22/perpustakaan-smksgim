import { describe, expect, it } from 'vitest';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  it('mengekspor komponen Sidebar sebagai fungsi', () => {
    expect(typeof Sidebar).toBe('function');
  });
});
