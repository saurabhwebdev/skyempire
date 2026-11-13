import { Button } from '@skyempire/ui';
import { GraduationCap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useGameStore, useUi } from '../../store';

const STEPS = [
  { id: 'lease-first', title: 'Lease your first aircraft', text: 'Leasing needs only a one-month deposit. An A320neo or 737-8 is a solid start.', action: 'Browse aircraft', run: () => useUi.getState().setMarketOpen(true) },
  { id: 'open-first-route', title: 'Open your first route', text: 'Pick a busy destination 500–2,000 km from your hub. The editor suggests a fare.', action: 'New route', run: () => useUi.getState().openRouteEditor({}) },
  { id: 'first-day', title: 'Press Play', text: 'Time is paused. Press Space or the play button to start flying.', action: 'Play', run: () => useUi.getState().setSpeed(1) },
  { id: 'first-profit', title: 'Watch your first profit', text: 'Cash updates every day at the top. Check the Overview for alerts and goals.', action: 'Open Overview', run: () => useUi.getState().setSection('overview') },
];

/** Skippable first-run guide tied to the first four objectives. */
export function Coachmarks() {
  const view = useGameStore((s) => s.view);
  const settings = useGameStore((s) => s.settings);
  const section = useUi((s) => s.section);
  // Over the map (Network/Fleet) sit top-left; on full-page sections sit bottom-left, clear of titles.
  const onMap = section === 'network' || section === 'fleet';
  const done = view?.player.completedObjectives ?? [];
  const step = STEPS.find((s) => !done.includes(s.id));
  const finished = !step;
  useEffect(() => {
    if (finished && !settings.tutorialDone) void window.game.setSettings({ tutorialDone: true }).then((s) => useGameStore.getState().setSettings(s));
  }, [finished, settings.tutorialDone]);
  const skip = async () => {
    useGameStore.getState().setSettings({ ...settings, tutorialDone: true });
    const s = await window.game.setSettings({ tutorialDone: true });
    useGameStore.getState().setSettings(s);
  };
  const index = step ? STEPS.indexOf(step) : STEPS.length;
  return (
    <AnimatePresence>
      {!settings.tutorialDone && step && (
        <motion.aside
          key={step.id}
          aria-label="Tutorial"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          className={`absolute ${onMap ? 'top-3' : 'bottom-4'} left-3 z-20 w-[320px] rounded-xl border border-accent/40 bg-surface-1/95 p-4 shadow-overlay backdrop-blur-md`}
        >
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-accent">
            <GraduationCap className="size-4" /> Step {index + 1} of {STEPS.length}
          </div>
          <h2 className="text-[16px] font-semibold">{step.title}</h2>
          <p className="mt-1 text-[13px] text-muted">{step.text}</p>
          <div className="mt-3 flex items-center justify-between">
            <Button size="sm" variant="ghost" onClick={skip}>Skip tutorial</Button>
            <Button size="sm" variant="primary" onClick={step.run}>{step.action}</Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
