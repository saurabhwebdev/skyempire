import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(import.meta.dirname, '..', 'out', 'main', 'index.js');

test('a cargo-only career: lease a freighter, open a cargo route, move tonnes', async () => {
  test.setTimeout(240_000);
  const app = await electron.launch({ args: [MAIN], env: { ...process.env, SKYEMPIRE_USER_DATA: mkdtempSync(join(tmpdir(), 'skyempire-cargo-')) } });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  await win.getByRole('button', { name: 'New career' }).click();
  await win.getByLabel('Airline name').fill('Freight Test Air');
  await win.getByRole('button', { name: 'Choose a hub' }).click();
  await win.getByLabel('Search airports').fill('LEJ');
  await win.keyboard.press('Enter');
  await win.getByRole('button', { name: 'Choose difficulty' }).click();
  await win.getByRole('radio', { name: /Cargo only/ }).click();
  await win.getByRole('button', { name: 'Found airline' }).click();
  await expect(win.getByText('Freight Test Air', { exact: true })).toBeVisible();

  // Tutorial step 1 for a cargo airline: lease a freighter.
  await expect(win.getByRole('heading', { name: 'Lease your first freighter' })).toBeVisible();
  await win.getByRole('button', { name: 'Browse aircraft' }).click();
  await win.getByRole('searchbox', { name: 'Search aircraft' }).fill('ATR 72-600F');
  await win.locator('article').filter({ hasText: 'ATR 72-600F' }).first().getByRole('button', { name: /^Lease for/ }).click();
  await win.getByRole('dialog').getByRole('button', { name: /^Lease for/ }).click();
  await expect(win.getByText(/ATR 72-600F added to your fleet/).first()).toBeVisible();
  await win.getByRole('button', { name: 'Close market' }).click();

  // A cargo route to Frankfurt with the suggested rate.
  await win.keyboard.press('2');
  await win.keyboard.press('n');
  await expect(win.getByRole('radiogroup', { name: 'Route type' })).toHaveCount(0); // cargo only: no choice
  await win.getByRole('combobox', { name: 'To', exact: true }).fill('FRA');
  await win.keyboard.press('Enter');
  await expect(win.getByText(/t cargo a day/)).toBeVisible();
  await win.getByRole('button', { name: 'Open route' }).click();
  await expect(win.getByRole('table').getByText('Cargo')).toBeVisible();

  // Fly a few days at 8× and check tonnes moved.
  await win.getByRole('button', { name: '8× speed' }).click();
  const fast = win.getByRole('button', { name: '8× speed' });
  await expect.poll(async () => {
    if ((await fast.getAttribute('aria-pressed')) !== 'true') await fast.click();
    const v = await win.evaluate(async () => (await window.game.view())!);
    return v.player.totals.cargoT ?? 0;
  }, { timeout: 90_000 }).toBeGreaterThan(0);
  await win.getByRole('button', { name: 'Pause' }).click();
  const v = await win.evaluate(async () => (await window.game.view())!);
  expect(v.player.kind).toBe('cargo');
  expect(v.routes.every((r) => r.kind === 'cargo')).toBe(true);
  await app.close();
});
