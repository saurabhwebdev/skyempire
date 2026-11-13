import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

test('app launches with the SkyEmpire window', async () => {
  const app = await electron.launch({ args: [join(import.meta.dirname, '..', 'out', 'main', 'index.js')], env: { ...process.env, SKYEMPIRE_E2E: '1' } });
  const win = await app.firstWindow();
  await expect(win).toHaveTitle('SkyEmpire');
  await expect(win.getByText('SkyEmpire').first()).toBeVisible();
  await app.close();
});

test('the game API starts a career and advances days', async () => {
  const app = await electron.launch({ args: [join(import.meta.dirname, '..', 'out', 'main', 'index.js')] });
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
