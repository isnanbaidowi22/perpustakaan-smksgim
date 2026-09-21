import { describe, expect, it } from 'vitest';
import DashboardPage from './page';

describe('DashboardPage', () => {
  it('mengekspor DashboardPage sebagai fungsi', () => {
    expect(typeof DashboardPage).toBe('function');
  });
});
