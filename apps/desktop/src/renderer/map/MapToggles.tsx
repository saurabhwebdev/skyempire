import { cn } from '@skyempire/ui';
import { CloudSun, Users } from 'lucide-react';
import { useGameStore, useUi } from '../store';

/** Small on-map switches for optional layers. */
export function MapToggles() {
  const settings = useGameStore((s) => s.settings);
  const showRivals = useUi((s) => s.showRivals);
  const toggleWeather = async () => {
    const next = { ...settings, mapWeather: !settings.mapWeather };
    useGameStore.getState().setSettings(next);
    useGameStore.getState().setSettings(await window.game.setSettings({ mapWeather: next.mapWeather }));
  };
  const btn = (on: boolean) =>
    cn('flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent',
      on ? 'border-accent/60 bg-surface-3 text-text shadow-overlay' : 'border-border bg-surface-2 text-muted shadow-overlay hover:text-text');
  return (
    <div className="absolute top-3 left-3 z-10 flex gap-2" role="group" aria-label="Map layers">
      <button type="button" className={btn(showRivals)} aria-pressed={showRivals} onClick={() => useUi.getState().setShowRivals(!showRivals)}>
        <Users className="size-3.5" aria-hidden /> Rivals
      </button>
      <button type="button" className={btn(settings.mapWeather)} aria-pressed={settings.mapWeather} onClick={() => void toggleWeather()}>
        <CloudSun className="size-3.5" aria-hidden /> Weather
      </button>
    </div>
  );
}
