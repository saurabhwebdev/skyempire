import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(import.meta.dirname, '..', 'out', 'main', 'index.js');

test('open a route with a stop, use free hours, and fly', async () => {
  test.setTimeout(180_000);
  const app = await electron.launch({ args: [MAIN], env: { ...process.env, SKYEMPIRE_USER_DATA: mkdtempSync(join(tmpdir(), 'skyempire-stops-')) } });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  await win.getByRole('button', { name: 'New career' }).click();
  await win.getByLabel('Airline name').fill('Stopover Test Air');
  await win.getByRole('button', { name: 'Choose a hub' }).click();
  await win.getByLabel('Search airports').fill('LHR');
  await win.keyboard.press('Enter');
  await win.getByRole('button', { name: 'Choose difficulty' }).click();
  await win.getByRole('button', { name: 'Found airline' }).click();
  await expect(win.getByText('Stopover Test Air', { exact: true })).toBeVisible();
  await win.getByRole('button', { name: 'Skip tutorial' }).click();
  // Two A320neos through the API (the market flow is covered by the cabin test).
  await win.evaluate(async () => {
    const p = { economy: { seat: 'standard', ife: 'none', meal: 'snack', amenityKit: false, lounge: false }, premium: { seat: 'recliner', ife: 'none', meal: 'hot', amenityKit: false, lounge: false }, business: { seat: 'angled', ife: 'none', meal: 'dining', amenityKit: false, lounge: false } } as const;
    for (let i = 0; i < 2; i++) await window.game.command({ type: 'leaseAircraft', typeId: 'A20N', config: { seats: { economy: 194, premium: 0, business: 0 }, product: p, dense: false } });
  });

  // London → Dubai → Singapore: too far nonstop for an A320neo, fine with a stop.
  await win.keyboard.press('2');
  await win.keyboard.press('n');
  await win.getByRole('combobox', { name: 'To', exact: true }).fill('SIN');
  await win.keyboard.press('Enter');
  await win.getByRole('button', { name: 'Add a stop' }).click();
  await win.getByRole('combobox', { name: 'Stop 1' }).fill('DXB');
  await win.keyboard.press('Enter');
  await expect(win.getByRole('table', { name: 'Fares by market' })).toBeVisible();
  await expect(win.getByText(/Expected load/)).toBeVisible();
  await win.getByRole('button', { name: 'Open route' }).click();
  await expect(win.getByText('Route LHR → DXB → SIN opened').first()).toBeVisible();
  await expect(win.getByRole('table').getByText('LHR → DXB → SIN')).toBeVisible();

  // The other aircraft is idle: fill it from the fleet page.
  await win.keyboard.press('3');
  await win.getByRole('button', { name: /Use free hours/ }).click();
  const dialog = win.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: /^Open .* with/ }).first()).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Open best for all' }).click();
  await expect(dialog.getByText(/^Opened \d+ routes?$/)).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Close' }).first().click();
  const routes = await win.evaluate(async () => (await window.game.view())!.routes);
  expect(routes.length).toBeGreaterThanOrEqual(2);
  expect(routes.find((r) => r.stops?.length)!.stops).toEqual(['DXB']);
  await app.close();
});
