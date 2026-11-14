// Builds a realistic mid-game career for filming. Usage: node e2e/film/prepare.mjs <userDataDir>
import { _electron as electron } from '@playwright/test';
import { join } from 'node:path';
const [userData] = process.argv.slice(2);
const app = await electron.launch({ args: [join(import.meta.dirname, '..', '..', 'out', 'main', 'index.js')], env: { ...process.env, SKYEMPIRE_USER_DATA: userData } });
const win = await app.firstWindow();
const out = await win.evaluate(async () => {
  const g = window.game;
  await g.newGame({ seed: 21, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR', airline: { name: 'Albion Skyways', code: 'AS1', colors: { primary: '#2f6fed', secondary: '#ffffff' }, logoShape: 'wing' } });
  await g.setSettings({ tutorialDone: true });
  const fleet = ['A20N', 'A20N', 'A21N', 'A20N', 'AT76'];
  for (const t of fleet) {
    const seats = { A20N: 194, A21N: 244, AT76: 78 }[t];
    await g.command({ type: 'leaseAircraft', typeId: t, cabin: { economy: seats, premium: 0, business: 0 } });
  }
  const v = await g.view();
  const legs = [['MAD', 14], ['FCO', 12], ['BCN', 12], ['ATH', 7], ['EDI', 21]];
  for (let i = 0; i < legs.length; i++) {
    const cmd = { type: 'openRoute', from: 'LHR', to: legs[i][0], fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: v.aircraft[i].id, roundTripsPerWeek: legs[i][1] }] };
    const p = await g.preview(cmd);
    await g.command({ ...cmd, fares: p.suggestedFares });
  }
  await new Promise((r) => { const off = g.onTick((p) => { if (p.view.day >= 90) { off(); g.setSpeed(0); r(); } }); g.setSpeed(8); });
  await g.save();
  const logos = await g.logos.download();
  const end = await g.view();
  return { day: end.day, cash: end.player.cash, routes: end.routes.length, logos: logos.ok };
});
console.log(JSON.stringify(out));
await app.close();
