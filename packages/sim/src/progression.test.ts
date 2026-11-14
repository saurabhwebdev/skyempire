import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands/apply';
import { objectivesView, updateProgression } from './progression';
import { catalog, lease, playerGame } from './testing';

describe('progression', () => {
  it('a new player sees three open goals', () => {
    const s = playerGame();
    const v = objectivesView(s, s.playerId, catalog);
    expect(v.filter((o) => !o.done).map((o) => o.id)).toEqual(['lease-first', 'open-first-route', 'first-day']);
  });
  it('leasing completes the first goal', () => {
    const s = playerGame();
    applyCommand(s, s.playerId, lease('A20N'), catalog);
    const notes = updateProgression(s, s.playerId, catalog);
    expect(s.airlines[s.playerId]!.completedObjectives).toContain('lease-first');
    expect(notes.some((n) => n.title.includes('Lease your first aircraft'))).toBe(true);
    expect(objectivesView(s, s.playerId, catalog)[0]).toMatchObject({ id: 'lease-first', done: true });
  });
  it('promotes to Regional with 5 aircraft and 1.2M passengers', () => {
    const s = playerGame();
    for (let i = 0; i < 5; i++) applyCommand(s, s.playerId, lease('AT76'), catalog);
    s.airlines[s.playerId]!.totals.pax = 1_200_000;
    const notes = updateProgression(s, s.playerId, catalog);
    expect(s.airlines[s.playerId]!.tier).toBe('regional');
    expect(notes.find((n) => n.level === 'major')?.title).toBe('You’re now a Regional airline');
  });
  it('promotes a National airline to Global with 40 aircraft and 20M passengers', () => {
    const s = playerGame();
    const al = s.airlines[s.playerId]!;
    al.tier = 'national';
    al.cash = 1e10;
    for (let i = 0; i < 40; i++) applyCommand(s, s.playerId, lease('AT76'), catalog);
    al.totals.pax = 20_000_000;
    const notes = updateProgression(s, s.playerId, catalog);
    expect(al.tier).toBe('global');
    expect(notes.find((n) => n.level === 'major')?.title).toBe('You’re now a Global airline');
  });
  it('never demotes', () => {
    const s = playerGame();
    s.airlines[s.playerId]!.tier = 'national';
    updateProgression(s, s.playerId, catalog);
    expect(s.airlines[s.playerId]!.tier).toBe('national');
  });
});
