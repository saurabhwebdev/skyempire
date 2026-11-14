import { catalog } from '../src/testing';
import { newGame } from '../src/newGame';
import { applyCommand } from '../src/commands/apply';
import { tick } from '../src/tick';
for (const seed of [1, 2, 3]) {
  let s = newGame({ seed, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR', startYear: 2026, airline: { name: 'Diag Air', code: 'D1G', colors: { primary: '#123456', secondary: '#ffffff' }, logoShape: 'circle' } }, catalog);
  applyCommand(s, s.playerId, { type: 'leaseAircraft', typeId: 'A20N', cabin: { economy: 194, premium: 0, business: 0 } }, catalog);
  const ac = Object.values(s.aircraft).find((a) => a.ownerId === s.playerId)!.id;
  console.log(applyCommand(s, s.playerId, { type: 'openRoute', from: 'LHR', to: 'MAD', fares: { economy: 120, premium: 220, business: 420 }, assignments: [{ aircraftId: ac, roundTripsPerWeek: 14 }] }, catalog));
  const times: number[] = [];
  for (let d = 0; d < 12; d++) {
    const t = performance.now();
    const r = tick(s, [], catalog);
    times.push(Math.round(performance.now() - t));
    s = r.state;
    for (const n of r.summary.notifications) if (n.level === 'major') console.log('  day', s.day, 'MAJOR', n.title);
  }
  console.log('seed', seed, 'tick ms', times.join(' '));
}
