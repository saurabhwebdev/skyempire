// Records filming clips from the prepared career. Usage: node e2e/film/record.mjs <profileDir> <outDir>
import { _electron as electron } from '@playwright/test';
import { cpSync, mkdtempSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [profile, outDir] = process.argv.slice(2);
const MAIN = join(import.meta.dirname, '..', '..', 'out', 'main', 'index.js');
const SIZE = { width: 1920, height: 1080 };

const CURSOR = `(() => {
  const c = document.createElement('div');
  c.innerHTML = '<svg width="44" height="44" viewBox="0 0 24 24"><path d="M4 2l15 10-7 1.4L8.6 21z" fill="#fff" stroke="#0b0f15" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, pointerEvents: 'none', transform: 'translate(-200px,-200px)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.5))', transition: 'transform 16ms linear' });
  document.body.appendChild(c);
  addEventListener('mousemove', (e) => (c.style.transform = 'translate(' + (e.clientX - 6) + 'px,' + (e.clientY - 4) + 'px)'), true);
  addEventListener('mousedown', () => (c.firstChild.style.transform = 'scale(.85)'), true);
  addEventListener('mouseup', () => (c.firstChild.style.transform = ''), true);
})()`;

async function session(name, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'se-film-'));
  cpSync(profile, dir, { recursive: true });
  const vids = mkdtempSync(join(tmpdir(), 'se-vid-'));
  const app = await electron.launch({ args: [MAIN], env: { ...process.env, SKYEMPIRE_USER_DATA: dir }, recordVideo: { dir: vids, size: SIZE } });
  const win = await app.firstWindow();
  await win.setViewportSize(SIZE);
  await win.evaluate(CURSOR);
  const t0 = Date.now();
  const marks = {};
  const mark = (k) => (marks[k] = (Date.now() - t0) / 1000);
  const move = async (x, y, steps = 25) => win.mouse.move(x, y, { steps });
  const clickOn = async (loc) => {
    const b = await loc.boundingBox();
    await move(b.x + b.width / 2, b.y + b.height / 2);
    await win.waitForTimeout(150);
    await loc.click();
  };
  await fn({ win, mark, move, clickOn });
  await app.close();
  const file = readdirSync(vids).find((f) => f.endsWith('.webm'));
  renameSync(join(vids, file), join(outDir, `${name}.webm`));
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(marks, null, 1));
  console.log(name, JSON.stringify(marks));
}

// A: title + founding an airline
await session('found', async ({ win, mark, move, clickOn }) => {
  await win.waitForTimeout(800);
  mark('title');
  await move(960, 700, 10);
  await win.waitForTimeout(2500);
  await clickOn(win.getByRole('button', { name: 'New career' }));
  mark('name');
  await win.getByLabel('Airline name').pressSequentially('Albion Skyways', { delay: 70 });
  await win.waitForTimeout(500);
  await clickOn(win.getByRole('radio', { name: 'Color #0f9d8a' }));
  await win.waitForTimeout(300);
  await clickOn(win.getByRole('radio', { name: 'Color #2f6fed' }));
  await win.waitForTimeout(700);
  await clickOn(win.getByRole('button', { name: 'Choose a hub' }));
  mark('hub');
  await win.getByLabel('Search airports').pressSequentially('London', { delay: 80 });
  await win.waitForTimeout(600);
  await win.keyboard.press('Enter');
  await win.waitForTimeout(900);
  await clickOn(win.getByRole('button', { name: 'Choose difficulty' }));
  mark('difficulty');
  await win.waitForTimeout(800);
  await clickOn(win.getByRole('button', { name: 'Found airline' }));
  mark('map');
  await win.waitForTimeout(3000);
  mark('end');
});

// B: the running game — map, route editor, overview, finance, rivals, market
await session('play', async ({ win, mark, move, clickOn }) => {
  await win.waitForTimeout(800);
  await clickOn(win.getByRole('button', { name: /Continue/ }));
  await win.waitForTimeout(1500);
  await win.keyboard.press('2');
  await win.waitForTimeout(1200);
  mark('map');
  // Pull back to see the world, then dive into Europe.
  await move(900, 500);
  for (let i = 0; i < 8; i++) { await win.mouse.wheel(0, 240); await win.waitForTimeout(90); }
  await win.waitForTimeout(1200);
  mark('world');
  for (let i = 0; i < 9; i++) { await win.mouse.wheel(0, -220); await win.waitForTimeout(90); }
  await win.waitForTimeout(1500);
  mark('routeClick');
  await clickOn(win.getByText('LHR → MAD'));
  await win.waitForTimeout(2500);
  mark('editor');
  await win.keyboard.press('Escape');
  await win.keyboard.press('n');
  await win.waitForTimeout(500);
  const to = win.getByRole('combobox', { name: 'To', exact: true });
  await clickOn(to);
  await to.pressSequentially('Dublin', { delay: 90 });
  await win.waitForTimeout(500);
  await win.keyboard.press('Enter');
  await win.waitForTimeout(1600);
  mark('preview');
  await win.waitForTimeout(1200);
  await clickOn(win.getByRole('button', { name: 'Open route' }));
  mark('opened');
  await win.waitForTimeout(2500);
  mark('play');
  await clickOn(win.getByRole('button', { name: '8× speed' }));
  await win.waitForTimeout(1500);
  await win.keyboard.press('1');
  mark('overview');
  await win.waitForTimeout(4000);
  await clickOn(win.getByRole('button', { name: 'Pause' }));
  await win.keyboard.press('4');
  mark('finance');
  await win.waitForTimeout(800);
  await move(700, 450);
  await win.waitForTimeout(3500);
  await win.keyboard.press('5');
  mark('rivals');
  await win.waitForTimeout(800);
  await move(500, 400);
  await win.mouse.wheel(0, 200);
  await win.waitForTimeout(3000);
  await win.keyboard.press('3');
  await win.waitForTimeout(600);
  await clickOn(win.getByRole('button', { name: 'Get aircraft' }));
  mark('aircraft');
  await win.waitForTimeout(800);
  await move(1200, 600);
  for (let i = 0; i < 6; i++) { await win.mouse.wheel(0, 160); await win.waitForTimeout(250); }
  await win.waitForTimeout(1500);
  mark('end');
});
