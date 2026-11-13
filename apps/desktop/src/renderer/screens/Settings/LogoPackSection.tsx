import { Button } from '@skyempire/ui';
import { useEffect, useState } from 'react';
import { useGameStore } from '../../store';

export function LogoPackSection() {
  const [status, setStatus] = useState<{ have: number; total: number } | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => {
    void window.game.logos.status().then(setStatus);
    return window.game.logos.onProgress((d, t) => setProgress([d, t]));
  }, []);
  const run = async () => {
    setFailed([]);
    setProgress([0, status?.total ?? 0]);
    const res = await window.game.logos.download();
    setFailed(res.failed);
    setProgress(null);
    setStatus(await window.game.logos.status());
    useGameStore.getState().bumpLogos();
  };
  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Real airline logos</p>
          <p className="text-[13px] text-muted">Logos are downloaded from Wikimedia Commons for personal use. {status ? `${status.have} of ${status.total} installed.` : ''}</p>
        </div>
        {progress ? (
          <Button size="sm" variant="ghost" onClick={() => window.game.logos.cancel()}>Cancel</Button>
        ) : (
          <Button size="sm" variant="primary" onClick={run}>{failed.length ? 'Retry' : 'Download real logos'}</Button>
        )}
      </div>
      {progress && (
        <div aria-live="polite" className="num text-[13px] text-muted">
          {progress[0]} of {progress[1]}
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full w-full origin-left bg-accent transition-transform" style={{ transform: `scaleX(${progress[1] ? progress[0] / progress[1] : 0})` }} />
          </div>
        </div>
      )}
      {failed.length > 0 && <p className="text-[13px] text-warning">No logo found for {failed.length} airline{failed.length > 1 ? 's' : ''}: {failed.slice(0, 12).join(', ')}{failed.length > 12 ? '…' : ''}. They'll show a code badge.</p>}
      <p className="text-[12px] text-faint">You can also put your own PNG files (named by airline code, e.g. LH.png) in the game's logos folder.</p>
    </div>
  );
}
