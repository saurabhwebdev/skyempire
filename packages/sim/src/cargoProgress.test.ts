import { describe, expect, it } from 'vitest';
import { newGame } from './newGame';
import { objectivesView, updateProgression } from './progression';
import { catalog } from './testing';

const opts = { seed: 3, regionId: 'world' as const, difficulty: 'normal' as const, homeBaseId: 'LEJ', aiCount: 3,
  airline: { name: 'Freight Test Air', code: 'F7T', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' as const } };

describe('cargo-only careers', () => {
  it('start as the airline type the player chose', () => {
    expect(newGame({ ...opts, airlineKind: 'cargo' }, catalog).airlines.al_player!.kind).toBe('cargo');
    expect(newGame(opts, catalog).airlines.al_player!.kind).toBe('passenger');
  });
  it('grow by tonnes moved instead of passengers', () => {
    const s = newGame({ ...opts, airlineKind: 'cargo' }, catalog);
    const al = s.airlines.al_player!;
    al.totals.cargoT = 25_000;
    al.totals.revenue360 = Array(12).fill(0);
    for (let i = 0; i < 5; i++) s.aircraft[`x${i}`] = { ...Object.values(s.aircraft)[0]!, id: `x${i}`, ownerId: al.id };
    updateProgression(s, al.id, catalog);
    expect(al.tier).toBe('regional');
  });
  it('have cargo goals', () => {
    const s = newGame({ ...opts, airlineKind: 'cargo' }, catalog);
    const titles = objectivesView(s, 'al_player', catalog).map((o) => o.title);
    expect(titles[0]).toBe('Lease your first freighter');
    expect(titles).toContain('Open your first cargo route');
    const pax = objectivesView(newGame(opts, catalog), 'al_player', catalog).map((o) => o.title);
    expect(pax[0]).toBe('Lease your first aircraft');
  });
});
