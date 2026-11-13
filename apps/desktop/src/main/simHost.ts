import { utilityProcess, type UtilityProcess } from 'electron';
import type { SimRequest, SimResponses } from '../worker/simHandler';

/** Talks to the simulation utility process with request/response promises. */
export class SimHost {
  private proc: UtilityProcess;
  private seq = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(workerPath: string) {
    this.proc = utilityProcess.fork(workerPath, [], { serviceName: 'SkyEmpire Simulation' });
    this.proc.on('message', (msg: { id: number; ok: boolean; data?: unknown; error?: string }) => {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.data);
      else p.reject(new Error(msg.error));
    });
    this.proc.on('exit', (code) => {
      for (const p of this.pending.values()) p.reject(new Error(`Simulation stopped (code ${code})`));
      this.pending.clear();
    });
  }

  request<R extends SimRequest>(req: R): Promise<SimResponses[R['kind']]> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.proc.postMessage({ id, req });
    });
  }

  kill(): void {
    this.proc.kill();
  }
}
