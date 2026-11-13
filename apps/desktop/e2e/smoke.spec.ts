import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

test('app launches with the SkyEmpire window', async () => {
  const app = await electron.launch({ args: [join(import.meta.dirname, '..', 'out', 'main', 'index.js')], env: { ...process.env, SKYEMPIRE_E2E: '1' } });
  const win = await app.firstWindow();
  await expect(win).toHaveTitle('SkyEmpire');
  await expect(win.getByText('SkyEmpire').first()).toBeVisible();
  await app.close();
});
