import { net, protocol } from 'electron';
import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const APP_ORIGIN = 'app://skyempire';

/** Must run before app ready. A standard, secure scheme lets the renderer use module workers (MapLibre). */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
    { scheme: 'skyempire-logo', privileges: { standard: true, secure: true } },
  ]);
}

/** Serve files from the built renderer folder only (no path traversal). */
export function serveRenderer(rendererDir: string): void {
  const root = normalize(rendererDir + sep);
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = normalize(join(root, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)));
    if (!file.startsWith(root)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

/** Serve only `<logosDir>/<NAME>.png` for skyempire-logo://logo/<NAME>.png (names are airline codes). */
export function serveLogos(logosDir: string): void {
  protocol.handle('skyempire-logo', (req) => {
    const name = new URL(req.url).pathname.replace(/^\//, '');
    if (!/^[A-Za-z0-9_]{2,10}\.png$/.test(name)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(join(logosDir, name)).toString()).catch(() => new Response('Not found', { status: 404 }));
  });
}
