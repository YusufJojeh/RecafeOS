import { describe, expect, it } from 'vitest';
import { canAccessRoute, canSeeNavPath } from './nav-permissions';

describe('nav-permissions', () => {
  it('requires tables.manage for floor', () => {
    expect(canAccessRoute('/floor', [])).toBe(false);
    expect(canAccessRoute('/floor', ['tables.manage'])).toBe(true);
  });

  it('allows menu page with menu.read', () => {
    expect(canAccessRoute('/menu', ['menu.read'])).toBe(true);
    expect(canAccessRoute('/menu', ['orders.create'])).toBe(true);
    expect(canAccessRoute('/menu', ['kitchen.view'])).toBe(false);
  });

  it('matches longer path prefix before shorter', () => {
    expect(canAccessRoute('/reports/shift-handoff', ['reports.view'])).toBe(true);
    expect(canAccessRoute('/reports/shift-handoff', ['kitchen.view'])).toBe(false);
    expect(canAccessRoute('/reports', ['reports.view'])).toBe(true);
  });

  it('canSeeNavPath mirrors canAccessRoute', () => {
    expect(canSeeNavPath('/stock', ['stock.manage'])).toBe(true);
    expect(canSeeNavPath('/stock', ['reports.view'])).toBe(false);
  });
});
