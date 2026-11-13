/** Electron utilityProcess entry: runs the simulation off the UI thread. */
import { loadCatalog } from '@skyempire/data';
import { createSimHandler, type SimRequest } from './simHandler';

interface ParentPort {
  on(event: 'message', cb: (e: { data: { id: number; req: SimRequest } }) => void): void;
  postMessage(msg: unknown): void;
}
const port = (process as unknown as { parentPort: ParentPort }).parentPort;
const handler = createSimHandler(loadCatalog('world'));

port.on('message', ({ data }) => {
  try {
    port.postMessage({ id: data.id, ok: true, data: handler.handle(data.req) });
  } catch (err) {
    port.postMessage({ id: data.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
