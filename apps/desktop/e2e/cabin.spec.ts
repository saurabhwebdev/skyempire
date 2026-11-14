import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(import.meta.dirname, '..', 'out', 'main', 'index.js');
type Win = Awaited<ReturnType<Awaited<ReturnType<typeof electron.launch>>['firstWindow']>>;
const fleet = (win: Win) => win.evaluate(async () => (await window.game.view())!.aircraft);

test('design a cabin when leasing, refit it, and keep it after a reload', async () => {
  test.setTimeout(180_000);
  const userData = mkdtempSync(join(tmpdir(), 'skyempire-cabin-'));
  let app = await electron.launch({ args: [MAIN], env: { ...process.env, SKYEMPIRE_USER_DATA: userData } });
  let win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  // Found the airline through the screens (a page reload can briefly show the title screen).
  await win.getByRole('button', { name: 'New career' }).click();
  await win.getByLabel('Airline name').fill('Cabin Test Air');
  await win.getByRole('button', { name: 'Choose a hub' }).click();
  await win.getByLabel('Search airports').fill('LHR');
  await win.keyboard.press('Enter');
  await win.getByRole('button', { name: 'Choose difficulty' }).click();
  await win.getByRole('button', { name: 'Found airline' }).click();
  await expect(win.getByText('Cabin Test Air', { exact: true })).toBeVisible();
  await win.getByRole('button', { name: 'Skip tutorial' }).click();

  // Lease an A320neo with a two-class cabin, Wi-Fi and hot meals in economy, recliners up front.
  await win.keyboard.press('3');
  await win.getByRole('button', { name: 'Get aircraft' }).click();
  await win.getByRole('searchbox', { name: 'Search aircraft' }).fill('A320neo');
  await win.locator('article').filter({ hasText: 'Airbus A320neo' }).getByRole('button', { name: /^Lease for/ }).click();
  const dialog = win.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Two class' }).click();
  await dialog.getByRole('radio', { name: /Wi-Fi streaming/ }).click();
  await dialog.getByRole('radio', { name: /Hot meal/ }).click();
  await dialog.getByRole('tab', { name: /Business/ }).click();
  await dialog.getByRole('radio', { name: /^Recliner/ }).click();
  await dialog.getByRole('button', { name: 'Fit economy seats' }).click();
  await dialog.getByRole('button', { name: /^Lease for/ }).click();
  await expect(win.getByText('Airbus A320neo added to your fleet').first()).toBeVisible();
  await win.getByRole('button', { name: 'Close market' }).click();
  let [ac] = await fleet(win);
  expect(ac!.product.economy).toMatchObject({ ife: 'wifi', meal: 'hot' });
  expect(ac!.product.business.seat).toBe('recliner');
  expect(ac!.cabin.business).toBeGreaterThan(0);

  // Refit: full-flat beds up front take the aircraft out for 5 days.
  await win.getByRole('row', { name: /A320neo/ }).click();
  await win.getByRole('button', { name: 'Design cabin' }).click();
  await dialog.getByRole('tab', { name: /Business/ }).click();
  await dialog.getByRole('radio', { name: /Full-flat bed/ }).click();
  await dialog.getByRole('button', { name: 'Fit economy seats' }).click();
  await expect(dialog.getByText(/out of service for 5 days/)).toBeVisible();
  await dialog.getByRole('button', { name: /^Start refit/ }).click();
  await expect(win.getByText('Refit · 5d').first()).toBeVisible();

  // Save, relaunch, continue: the cabin and the refit are still there.
  await win.keyboard.press('Control+s');
  await app.close();
  app = await electron.launch({ args: [MAIN], env: { ...process.env, SKYEMPIRE_USER_DATA: userData } });
  win = await app.firstWindow();
  await win.getByRole('button', { name: /Continue/ }).click();
  await expect(win.getByText('Cabin Test Air', { exact: true })).toBeVisible();
  [ac] = await fleet(win);
  expect(ac!.product.business.seat).toBe('flat');
  expect(ac!.refitDaysLeft).toBe(5);
  await app.close();
});
