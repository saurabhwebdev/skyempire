// Dev helper: start a career, run a few days, screenshot. Usage: node e2e/shot.mjs <out.png> [section]
import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [out, section = 'overview', days = '3'] = process.argv.slice(2);
const app = await electron.launch({ args: [join(import.meta.dirname, '..', 'out', 'main', 'index.js')], env: { ...process.env, SKYEMPIRE_USER_DATA: mkdtempSync(join(tmpdir(), 'se-shot-')) } });
const win = await app.firstWindow();
win.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 300)); });
win.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
await win.setViewportSize({ width: 1440, height: 900 });
await win.evaluate(async (days) => {
  await window.game.newGame({ seed: 4, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR', airline: { name: 'Albion Skyways', code: 'ALB', colors: { primary: '#2f6fed', secondary: '#ffffff' }, logoShape: 'wing' } });
  await window.game.command({ type: 'leaseAircraft', typeId: 'A20N', config: { seats: { economy: 194, premium: 0, business: 0 }, product: { economy: { seat: 'standard', ife: 'none', meal: 'snack', amenityKit: false, lounge: false }, premium: { seat: 'recliner', ife: 'none', meal: 'hot', amenityKit: false, lounge: false }, business: { seat: 'angled', ife: 'none', meal: 'dining', amenityKit: false, lounge: false } }, dense: false } });
  await new Promise((r) => { const off = window.game.onTick((p) => { if (p.view.day >= days) { off(); window.game.setSpeed(0); r(); } }); window.game.setSpeed(8); });
}, Number(days));
await win.reload();
await win.waitForTimeout(800);
if (section !== 'overview') await win.keyboard.press(String(['overview','network','fleet','finance','market','airline','news'].indexOf(section) + 1));
await win.waitForTimeout(500);
await win.waitForTimeout(2000);
console.log('[canvases]', JSON.stringify(await win.evaluate(() => [...document.querySelectorAll('canvas')].map((c) => [c.className, c.width, c.height, c.getBoundingClientRect().height]))));
await win.screenshot({ path: out });
await app.close();
