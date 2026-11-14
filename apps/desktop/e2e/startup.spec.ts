import { _electron as electron, expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const main = join(import.meta.dirname, '..', 'out', 'main', 'index.js');

test('a second launch exits and brings the open game forward', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'skyempire-e2e-'));
  const env = { ...process.env, SKYEMPIRE_USER_DATA: userData };
  const app = await electron.launch({ args: [main], env });
  const win = await app.firstWindow();
  await expect(win.getByText('SkyEmpire').first()).toBeVisible();
  // Window is visible straight away, not hidden until loaded.
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible())).toBe(true);

  const electronPath = await app.evaluate(() => process.execPath);
  const second = spawn(electronPath, [main], { env });
  const code = await new Promise<number | null>((resolve) => second.on('exit', resolve));
  expect(code).toBe(0);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);

  const log = readFileSync(join(userData, 'logs', 'main.log'), 'utf8');
  expect(log).toMatch(/starting/);
  expect(log).toMatch(/game screen loaded/);
  await expect.poll(() => readFileSync(join(userData, 'logs', 'main.log'), 'utf8')).toMatch(/second launch/);
  await app.close();
});

test('the game screen reloads by itself after a crash', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'skyempire-e2e-'));
  const app = await electron.launch({ args: [main], env: { ...process.env, SKYEMPIRE_USER_DATA: userData } });
  const win = await app.firstWindow();
  await expect(win.getByText('SkyEmpire').first()).toBeVisible();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.forcefullyCrashRenderer());
  await expect.poll(() => readFileSync(join(userData, 'logs', 'main.log'), 'utf8'), { timeout: 15_000 }).toMatch(/game screen stopped: crashed[\s\S]*game screen loaded/);
  // Playwright's page handle dies with the crashed renderer, so read the reloaded page from the main process.
  await expect
    .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.executeJavaScript('document.body.innerText')))
    .toMatch(/SkyEmpire/);
  await app.close();
});
