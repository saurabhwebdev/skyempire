import { _electron as electron, expect, test, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(import.meta.dirname, '..', 'out', 'main', 'index.js');
const dayOf = async (win: Page) => {
  const text = (await win.getByText(/^[A-Z][a-z]{2} \d{1,2} Y\d+$/).first().textContent()) ?? '';
  const [mon, d] = text.split(' ');
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(mon!) * 30 + Number(d) - 1;
};

test('a full first career: found, lease, fly, save, continue', async () => {
  test.setTimeout(240_000);
  const userData = mkdtempSync(join(tmpdir(), 'skyempire-career-'));
  let app = await electron.launch({ args: [MAIN], env: { ...process.env, SKYEMPIRE_USER_DATA: userData } });
  let win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });

  // Found an airline
  await win.getByRole('button', { name: 'New career' }).click();
  await win.getByLabel('Airline name').fill('Skyward Test Air');
  await win.getByRole('button', { name: 'Choose a hub' }).click();
  await win.getByLabel('Search airports').fill('LHR');
  await win.keyboard.press('Enter');
  await win.getByRole('button', { name: 'Choose difficulty' }).click();
  await win.getByRole('button', { name: 'Found airline' }).click();
  await expect(win.getByText('Skyward Test Air')).toBeVisible();

  // Lease an A320neo from the tutorial's first step
  await win.getByRole('button', { name: 'Browse aircraft' }).click();
  const card = win.locator('article').filter({ hasText: 'Airbus A320neo' });
  await card.getByRole('button', { name: /^Lease for/ }).click();
  await win.getByRole('dialog').getByRole('button', { name: /^Lease for/ }).click();
  await expect(win.getByText('Airbus A320neo added to your fleet')).toBeVisible();
  await win.getByRole('button', { name: 'Close market' }).click();

  // Open LHR–MAD with the suggested fare
  await win.keyboard.press('2');
  await win.keyboard.press('n');
  await win.getByRole('combobox', { name: 'To', exact: true }).fill('MAD');
  await win.keyboard.press('Enter');
  await expect(win.getByText(/Expected load/)).toBeVisible();
  await win.getByRole('button', { name: 'Open route' }).click();
  await expect(win.getByText('Route LHR–MAD opened')).toBeVisible();
  await expect(win.getByText('LHR → MAD')).toBeVisible();

  // Fly a week at 8×
  await win.getByRole('button', { name: '8× speed' }).click();
  await expect.poll(() => dayOf(win), { timeout: 60_000 }).toBeGreaterThanOrEqual(7);
  await win.getByRole('button', { name: 'Pause' }).click();

  // Finance shows revenue
  await win.keyboard.press('4');
  const revenue = win.locator('text=Revenue · 30d').locator('..');
  await expect(revenue).not.toContainText('$0');

  // Save, quit, relaunch, continue
  await win.keyboard.press('Control+s');
  const savedDay = await dayOf(win);
  await app.close();
  app = await electron.launch({ args: [MAIN], env: { ...process.env, SKYEMPIRE_USER_DATA: userData } });
  win = await app.firstWindow();
  await win.getByRole('button', { name: /Continue/ }).click();
  await expect(win.getByText('Skyward Test Air')).toBeVisible();
  expect(await dayOf(win)).toBeGreaterThanOrEqual(savedDay);
  await app.close();
});
