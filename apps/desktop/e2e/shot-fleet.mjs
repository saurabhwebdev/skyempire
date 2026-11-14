// Dev helper: fleet tray + aircraft market.
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
  await window.game.newGame({ seed: 4, regionId: 'world', difficulty: 'normal', homeBaseId: 'DEL', airline: { name: 'Saffron Air', code: 'S4F', colors: { primary: '#e08a1e', secondary: '#ffffff' }, logoShape: 'circle' } });
  await window.game.command({ type: 'leaseAircraft', typeId: 'A20N', config: { seats: { economy: 194, premium: 0, business: 0 }, product: { economy: { seat: 'standard', ife: 'none', meal: 'snack', amenityKit: false, lounge: false }, premium: { seat: 'recliner', ife: 'none', meal: 'hot', amenityKit: false, lounge: false }, business: { seat: 'angled', ife: 'none', meal: 'dining', amenityKit: false, lounge: false } }, dense: false } });
  await window.game.command({ type: 'leaseAircraft', typeId: 'AT76', config: { seats: { economy: 78, premium: 0, business: 0 }, product: { economy: { seat: 'standard', ife: 'none', meal: 'snack', amenityKit: false, lounge: false }, premium: { seat: 'recliner', ife: 'none', meal: 'hot', amenityKit: false, lounge: false }, business: { seat: 'angled', ife: 'none', meal: 'dining', amenityKit: false, lounge: false } }, dense: false } });
});
await win.reload();
await win.waitForTimeout(1200);
await win.keyboard.press('3');
await win.waitForTimeout(500);
await win.screenshot({ path: join(dir, 'fleet.png') });
await win.getByRole('button', { name: 'Get aircraft' }).click();
await win.waitForTimeout(600);
await win.screenshot({ path: join(dir, 'market.png') });
await app.close();
