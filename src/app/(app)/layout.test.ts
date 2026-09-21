import { describe, expect, it } from 'vitest';
import AppLayout from './layout';

describe('AppLayout', () => {
  it('mengekspor AppLayout sebagai fungsi', () => {
    expect(typeof AppLayout).toBe('function');
  });
});
