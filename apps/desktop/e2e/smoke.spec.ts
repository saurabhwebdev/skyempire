import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const launch = () =>
  electron.launch({
    args: [join(import.meta.dirname, '..', 'out', 'main', 'index.js')],
    env: { ...process.env, SKYEMPIRE_USER_DATA: mkdtempSync(join(tmpdir(), 'skyempire-e2e-')) },
  });

test('app launches with the SkyEmpire window', async () => {
  const app = await launch();
  const win = await app.firstWindow();
  await expect(win).toHaveTitle('SkyEmpire');
  await expect(win.getByText('SkyEmpire').first()).toBeVisible();
  await app.close();
});

test('the game API starts a career and advances days', async () => {
  const app = await launch();
  const win = await app.firstWindow();
  const view = await win.evaluate(() =>
    window.game.newGame({
      seed: 1, regionId: 'world', difficulty: 'normal', homeBaseId: 'LHR', aiCount: 3,
      airline: { name: 'E2E Test Air', code: 'E2E', colors: { primary: '#336699', secondary: '#ffffff' }, logoShape: 'circle' },
    }),
  );
  expect(view.player.name).toBe('E2E Test Air');
  const day = await win.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const off = window.game.onTick((p) => {
          if (p.view.day >= 2) {
            off();
            window.game.setSpeed(0);
            resolve(p.view.day);
          }
        });
        window.game.setSpeed(8);
      }),
  );
  expect(day).toBeGreaterThanOrEqual(2);
  await app.close();
});

test('saves and reloads a career', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'skyempire-e2e-'));
  const args = [join(import.meta.dirname, '..', 'out', 'main', 'index.js')];
  let app = await electron.launch({ args, env: { ...process.env, SKYEMPIRE_USER_DATA: userData } });
  let win = await app.firstWindow();
  await win.evaluate(() =>
    window.game.newGame({
      seed: 2, regionId: 'world', difficulty: 'normal', homeBaseId: 'FRA', aiCount: 2,
      airline: { name: 'Reload Test Air', code: 'R2T', colors: { primary: '#336699', secondary: '#ffffff' }, logoShape: 'circle' },
    }),
  );
  await app.close();
  app = await electron.launch({ args, env: { ...process.env, SKYEMPIRE_USER_DATA: userData } });
  win = await app.firstWindow();
  const saves = await win.evaluate(() => window.game.listSaves());
  expect(saves[0]?.airlineName).toBe('Reload Test Air');
  const view = await win.evaluate((id) => window.game.loadSave(id), saves[0]!.id);
  expect(view.player.name).toBe('Reload Test Air');
  await app.close();
});
