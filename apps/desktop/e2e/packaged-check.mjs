// Dev helper: launch the packaged app and start a career.
import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const app = await electron.launch({ executablePath: process.argv[2], env: { ...process.env, SKYEMPIRE_USER_DATA: mkdtempSync(join(tmpdir(), 'se-pkg-')) } });
const win = await app.firstWindow();
win.on('pageerror', (e) => console.log('[pageerror]', e.message));
const v = await win.evaluate(() => window.game.newGame({ seed: 1, regionId: 'world', difficulty: 'normal', homeBaseId: 'SIN', airline: { name: 'Packaged Test Air', code: 'P8K', colors: { primary: '#2f6fed', secondary: '#ffffff' }, logoShape: 'wing' } }));
console.log('[ok]', v.player.name, v.rivals.length, 'rivals');
await app.close();
