import type { CabinProduct, GameState, Ife, Meal } from '@skyempire/shared';
import { standardProduct } from './cabin';

export const CURRENT_SCHEMA = 5;

/** Real airlines in the catalogue that fly freighters as well as passengers. */
export const COMBINATION_CARRIERS = ['LH', 'EK', 'QR', 'CX', 'KE', 'CI', 'TK', 'SQ', 'ET', 'AF', 'CA', 'CZ', 'NH', 'JL'];

type Raw = Record<string, unknown>;

/** migrations[n] turns schema version n into n + 1. */
export const migrations: Record<number, (s: Raw) => Raw> = {
  // v0.1 → v0.2: real calendar (v0.1 careers start in 2026), weather and tensions.
  1: (s) => ({ ...s, schemaVersion: 2, world: { startYear: 2026, liveWeather: {}, tensions: [], preCancelled: {} } }),
  // v0.3 → v0.4: the airline-wide service level becomes a cabin product on every aircraft.
  2: (s) => {
    const airlines = s.airlines as Record<string, Raw>;
    const level = (id: unknown) => Number((airlines[String(id)] ?? {}).serviceLevel ?? 3);
    const aircraft = Object.fromEntries(Object.entries(s.aircraft as Record<string, Raw>).map(([id, ac]) => [id, { ...ac, product: productForLevel(level(ac.ownerId)), dense: false, refitDaysLeft: 0 }]));
    const next = Object.fromEntries(Object.entries(airlines).map(([id, al]) => {
      const { serviceLevel: _gone, ...rest } = al;
      return [id, { ...rest, cabinTemplates: [] }];
    }));
    return { ...s, schemaVersion: 3, airlines: next, aircraft };
  },
  // v0.4 → v0.5: multi-stop routes. Every new field is optional, so only the version changes.
  3: (s) => ({ ...s, schemaVersion: 4 }),
  // v0.5 → v0.6: airline types and belly cargo. Real combination carriers keep flying freighters.
  4: (s) => {
    const airlines = Object.fromEntries(Object.entries(s.airlines as Record<string, Raw>).map(([id, al]) => [id, {
      ...al, kind: !al.isPlayer && COMBINATION_CARRIERS.includes(String(al.code)) ? 'combination' : 'passenger',
      bellyCargo: al.personality !== 'budget' && al.personality !== 'expander', dgLicence: false,
    }]));
    const routes = Object.fromEntries(Object.entries(s.routes as Record<string, Raw>).map(([id, r]) => [id, { ...r, kind: 'passenger', belly: { mode: 'default' } }]));
    return { ...s, schemaVersion: 5, airlines, routes };
  },
};

/** The v0.3 service levels 1–5 as products. Seats keep the standard fit, so every cabin still fits. */
export function productForLevel(level: number): CabinProduct {
  const p = standardProduct();
  const [ife, meal]: [Ife, Meal] = ([['none', 'none'], ['none', 'buyOnBoard'], ['wifi', 'snack'], ['seatback', 'hot'], ['premium', 'hot']] as [Ife, Meal][])[Math.min(5, Math.max(1, level)) - 1]!;
  const top = level >= 4;
  return {
    economy: { ...p.economy, ife, meal },
    premium: { ...p.premium, ife, meal: level >= 4 ? 'dining' : 'hot', amenityKit: top },
    business: { ...p.business, ife, meal: level >= 3 ? 'dining' : 'hot', amenityKit: top, lounge: top },
  };
}

/** Upgrade a saved state of any older schema version to the current one. */
export function migrate(raw: unknown): GameState {
  let s = raw as Raw;
  const version = Number(s.schemaVersion);
  if (!Number.isInteger(version) || version < 1) throw new Error('Save has no schema version');
  if (version > CURRENT_SCHEMA) throw new Error('Save is from a newer version of SkyEmpire');
  for (let v = version; v < CURRENT_SCHEMA; v++) s = migrations[v]!(s);
  return s as unknown as GameState;
}
