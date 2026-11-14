import type { NewGameOptions } from '@skyempire/shared';
import { describe, expect, it } from 'vitest';
import { newGame } from './newGame';
import { catalog } from './testing';

const opts = (o: Partial<NewGameOptions> = {}): NewGameOptions => ({
  seed: 1,
  regionId: 'world',
  difficulty: 'normal',
  airline: { name: 'Skyward Test Air', code: 'S9X', colors: { primary: '#3366ff', secondary: '#ffffff' }, logoShape: 'wing' },
  homeBaseId: 'FRA',
  ...o,
});

describe('newGame', () => {
  it('is deterministic', () => expect(newGame(opts(), catalog)).toEqual(newGame(opts(), catalog)));
  it('creates 20 airlines with exactly one player', () => {
    const s = newGame(opts(), catalog);
    const all = Object.values(s.airlines);
    expect(all).toHaveLength(20);
    expect(all.filter((a) => a.isPlayer)).toHaveLength(1);
  });
  it('includes the local incumbent: Lufthansa at FRA', () => {
    const s = newGame(opts(), catalog);
    expect(Object.values(s.airlines).find((a) => a.name === 'Lufthansa')?.homeBaseId).toBe('FRA');
  });
  it('includes IndiGo when starting in Delhi', () => {
    const s = newGame(opts({ homeBaseId: 'DEL' }), catalog);
    expect(Object.values(s.airlines).some((a) => a.name === 'IndiGo')).toBe(true);
  });
  it('player starts with Normal cash and no aircraft', () => {
    const s = newGame(opts(), catalog);
    expect(s.airlines[s.playerId]!.cash).toBe(50_000_000);
    expect(Object.values(s.aircraft).filter((a) => a.ownerId === s.playerId)).toHaveLength(0);
  });
  it('AI airlines start with 6 aircraft on Normal', () => {
    const s = newGame(opts(), catalog);
    for (const al of Object.values(s.airlines).filter((a) => !a.isPlayer))
      expect(Object.values(s.aircraft).filter((a) => a.ownerId === al.id)).toHaveLength(6);
  });
  it('rival aircraft fly products that suit the airline', () => {
    const s = newGame(opts(), catalog);
    const fleetOf = (personality: string) => Object.values(s.aircraft).filter((a) => s.airlines[a.ownerId]!.personality === personality);
    expect(fleetOf('budget').every((a) => a.product.economy.seat === 'slimline' && a.product.economy.meal === 'buyOnBoard')).toBe(true);
    const gulfWide = fleetOf('gulf').filter((a) => catalog.aircraftTypes[a.typeId]!.class === 'widebody');
    expect(gulfWide.length).toBeGreaterThan(0);
    expect(gulfWide.every((a) => a.product.business.seat === 'suite' && a.cabin.business > 0)).toBe(true);
    expect(Object.values(s.airlines).every((a) => Array.isArray(a.cabinTemplates))).toBe(true);
  });
  it('rejects an unknown hub', () => expect(() => newGame(opts({ homeBaseId: 'XXX' }), catalog)).toThrow());
  it('rejects a malformed code', () =>
    expect(() => newGame(opts({ airline: { ...opts().airline, code: 'abcd' } }), catalog)).toThrow());
  it('rejects real airline names and codes', () => {
    expect(() => newGame(opts({ airline: { ...opts().airline, name: 'Lufthansa' } }), catalog)).toThrow(
      'That name belongs to a real airline — pick another',
    );
    expect(() => newGame(opts({ airline: { ...opts().airline, code: 'LH' } }), catalog)).toThrow();
  });
});
