// Dev helper: network screen with a route, then the route editor.
import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [dir] = process.argv.slice(2);
const app = await electron.launch({ args: [join(import.meta.dirname, '..', 'out', 'main', 'index.js')], env: { ...process.env, SKYEMPIRE_USER_DATA: mkdtempSync(join(tmpdir(), 'se-shot-')) } });
const win = await app.firstWindow();
win.on('pageerror', (e) => console.log('[pageerror]', e.message));
await win.setViewportSize({ width: 1440, height: 900 });
await win.evaluate(async () => {
  await window.game.newGame({ seed: 4, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR', airline: { name: 'Albion Skyways', code: 'AS1', colors: { primary: '#2f6fed', secondary: '#ffffff' }, logoShape: 'wing' } });
  for (let i = 0; i < 3; i++) await window.game.command({ type: 'leaseAircraft', typeId: 'A20N', cabin: { economy: 194, premium: 0, business: 0 } });
  const v = await window.game.view();
  const legs = [['LHR', 'MAD', 14], ['LHR', 'FCO', 10], ['LHR', 'EDI', 21]];
  for (let i = 0; i < legs.length; i++) {
    const [from, to, rt] = legs[i];
    const cmd = { type: 'openRoute', from, to, fares: { economy: 1, premium: 1, business: 1 }, assignments: [{ aircraftId: v.aircraft[i].id, roundTripsPerWeek: rt }] };
    const p = await window.game.preview(cmd);
    await window.game.command({ ...cmd, fares: p.suggestedFares });
  }
  await new Promise((r) => { const off = window.game.onTick((p) => { if (p.view.day >= 6) { off(); window.game.setSpeed(0); r(); } }); window.game.setSpeed(8); });
});
await win.reload();
await win.waitForTimeout(1500);
await win.keyboard.press('1');
await win.waitForTimeout(600);
await win.screenshot({ path: join(dir, 'overview.png') });
await win.keyboard.press('2');
await win.waitForTimeout(400);
await win.getByText('LHR → MAD').click();
await win.waitForTimeout(1200);
await win.screenshot({ path: join(dir, 'network.png') });
await win.keyboard.press('Escape');
await win.keyboard.press('n');
await win.getByRole('combobox', { name: 'To', exact: true }).fill('dub');
await win.keyboard.press('Enter');
await win.waitForTimeout(800);
await win.screenshot({ path: join(dir, 'editor.png') });
await app.close();
