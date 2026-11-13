import type { Settings } from '@skyempire/shared';
import { cn, Modal } from '@skyempire/ui';
import { useEffect, useState } from 'react';
import { Switch } from '../../components/Switch';
import { useGameStore } from '../../store';

export function applySettingsToDocument(s: Settings) {
  document.documentElement.toggleAttribute('data-reduce-motion', s.reduceMotion);
  document.documentElement.toggleAttribute('data-performance', s.performanceMode);
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  const settings = useGameStore((s) => s.settings);
  const update = async (patch: Partial<Settings>) => {
    const optimistic = { ...settings, ...patch };
    useGameStore.getState().setSettings(optimistic);
    applySettingsToDocument(optimistic);
    const saved = await window.game.setSettings(patch);
    useGameStore.getState().setSettings(saved);
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Settings">
      <div className="flex flex-col divide-y divide-border">
        <Switch label="Reduce motion" hint="Removes route and panel animations." checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
        <Switch label="Performance mode" hint="Turns off blur and map animations on slower PCs." checked={settings.performanceMode} onChange={(v) => update({ performanceMode: v })} />
        <Switch label="Pause on major events" hint="Fuel spikes, recessions and strikes at your bases." checked={settings.autoPauseMajor} onChange={(v) => update({ autoPauseMajor: v })} />
        <Switch label="Color-blind friendly rivals" hint="Use a validated palette instead of airline brand colors on the map." checked={settings.colorBlindRivals} onChange={(v) => update({ colorBlindRivals: v })} />
        <div className="flex items-center justify-between py-3">
          <span className="font-semibold">Autosave every</span>
          <div role="radiogroup" aria-label="Autosave interval" className="flex rounded-md border border-border p-0.5">
            {([30, 60, 90] as const).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={settings.autosaveDays === d} onClick={() => update({ autosaveDays: d })}
                className={cn('h-8 rounded-[6px] px-3 text-[13px] font-semibold', settings.autosaveDays === d ? 'bg-surface-3 text-text' : 'text-muted')}>{d} days</button>
            ))}
          </div>
        </div>
        <div className="py-3 text-[13px] text-muted">
          <p className="font-semibold text-text">About SkyEmpire 0.1</p>
          <p>SkyEmpire is not affiliated with any airline or aircraft manufacturer. Names are used for identification only.</p>
          <p className="mt-1">Data: OurAirports, GeoNames, World Bank, Natural Earth, Wikidata, OpenFlights. See CREDITS.md.</p>
        </div>
      </div>
    </Modal>
  );
}

/** Settings dialog opened from anywhere via the `se:open-settings` event. */
export function SettingsHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener('se:open-settings', on);
    return () => window.removeEventListener('se:open-settings', on);
  }, []);
  return <SettingsDialog open={open} onOpenChange={setOpen} />;
}
