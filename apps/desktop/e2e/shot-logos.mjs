// Dev helper: download the real logo pack, then screenshot the Market screen.
import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [dir] = process.argv.slice(2);
const app = await electron.launch({ args: [join(import.meta.dirname, '..', 'out', 'main', 'index.js')], env: { ...process.env, SKYEMPIRE_USER_DATA: mkdtempSync(join(tmpdir(), 'se-shot-')) } });
const win = await app.firstWindow();
win.on('pageerror', (e) => console.log('[pageerror]', e.message));
await win.setViewportSize({ width: 1440, height: 900 });
const res = await win.evaluate(async () => {
  await window.game.newGame({ seed: 4, regionId: 'world', difficulty: 'normal', homeBaseId: 'DXB', airline: { name: 'Falcon Skies', code: 'F9K', colors: { primary: '#0f9d8a', secondary: '#ffffff' }, logoShape: 'wing' } });
  await new Promise((r) => { const off = window.game.onTick((p) => { if (p.view.day >= 20) { off(); window.game.setSpeed(0); r(); } }); window.game.setSpeed(8); });
  return window.game.logos.download();
});
console.log('[logos]', JSON.stringify({ ok: res.ok, failed: res.failed }));
await win.reload();
await win.waitForTimeout(1200);
await win.keyboard.press('5');
await win.waitForTimeout(1500);
await win.screenshot({ path: join(dir, 'logos.png') });
await app.close();
