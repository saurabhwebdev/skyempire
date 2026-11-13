import type { SaveInfo } from '@skyempire/shared';
import { Button, useToast } from '@skyempire/ui';
import { useEffect, useState } from 'react';
import { useGameStore, useUi } from '../../store';
import { LoadDialog } from './LoadDialog';
import { saveErrorMessage } from './saveErrors';

/** Slow ambient route arcs behind the title (static when motion is reduced). */
function Backdrop() {
  const arcs = [
    'M-20 520 Q 300 180 720 360', 'M140 640 Q 520 300 980 420', 'M400 700 Q 760 240 1300 300',
    'M600 120 Q 900 40 1460 220', 'M-40 260 Q 380 40 860 160', 'M820 760 Q 1100 420 1480 560',
  ];
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="arc" x1="0" x2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--accent)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {arcs.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="url(#arc)" strokeWidth="1.2" strokeDasharray="6 10" className="title-arc" style={{ animationDelay: `${i * -3}s` }} />
      ))}
    </svg>
  );
}

export function Title() {
  const setScreen = useUi((s) => s.setScreen);
  const toast = useToast();
  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [loadOpen, setLoadOpen] = useState(false);
  useEffect(() => void window.game.listSaves().then(setSaves), []);
  const latest = saves.find((s) => s.airlineName !== '(damaged)');

  const resume = async () => {
    if (!latest) return;
    try {
      const view = await window.game.loadSave(latest.id);
      useGameStore.getState().setView(view);
      useUi.setState({ section: 'overview', selection: null, speed: 0, screen: view.gameOver ? 'gameOver' : 'game' });
    } catch (e) {
      toast({ title: saveErrorMessage(e), tone: 'danger' });
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden">
      <Backdrop />
      <div className="se-enter relative flex w-[320px] flex-col items-stretch gap-3">
        <div className="mb-8 text-center">
          <div className="mb-3 text-[28px] text-accent" aria-hidden>◆</div>
          <h1 className="text-[48px] font-semibold leading-none tracking-[-0.03em]">SkyEmpire</h1>
          <p className="mt-3 text-muted">Start an airline. Beat the incumbents.</p>
        </div>
        {latest && (
          <Button variant="primary" onClick={resume}>
            Continue <span className="font-normal opacity-80">· {latest.airlineName}</span>
          </Button>
        )}
        <Button variant={latest ? 'secondary' : 'primary'} onClick={() => setScreen('newAirline')}>New career</Button>
        <Button onClick={() => setLoadOpen(true)} disabled={saves.length === 0}>Load career</Button>
        <Button variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent('se:open-settings'))}>Settings</Button>
        <Button variant="ghost" onClick={() => window.close()}>Quit</Button>
      </div>
      <LoadDialog open={loadOpen} onOpenChange={setLoadOpen} />
      <p className="absolute bottom-4 text-[12px] text-faint">Not affiliated with any airline or aircraft manufacturer. Names are used for identification only.</p>
    </main>
  );
}
