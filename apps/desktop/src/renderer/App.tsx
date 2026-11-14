import { Toaster, TooltipProvider } from '@skyempire/ui';
import { lazy, Suspense, useEffect } from 'react';
import { useGameBridge, useNotices } from './hooks/useGame';
import { UpdateBanner, useUpdateBridge, WhatsNewAfterUpdate } from './components/Updates';
import { applySettingsToDocument, SettingsHost } from './screens/Settings/Settings';
import { NewAirline } from './screens/NewAirline/NewAirline';
import { Title } from './screens/Title/Title';
import { useShortcuts } from './shortcuts';
import { useGameStore, useUi } from './store';

// Heavy screens (map, charts) load in their own chunks; start fetching them as soon as the title is up.
const loadGame = () => import('./shell/GameScreen');
const loadGameOver = () => import('./screens/GameOver/GameOver').then((m) => ({ default: m.GameOver }));
const GameScreen = lazy(loadGame);
const GameOver = lazy(loadGameOver);

function Loading() {
  return <div className="flex h-screen items-center justify-center text-muted">Loading…</div>;
}

function Root() {
  useGameBridge();
  useUpdateBridge();
  useNotices();
  useShortcuts();
  const screen = useUi((s) => s.screen);
  const settings = useGameStore((s) => s.settings);
  useEffect(() => applySettingsToDocument(settings), [settings]);
  useEffect(() => {
    const id = setTimeout(() => void loadGame().then(loadGameOver), 300);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      <Suspense fallback={<Loading />}>
        {screen === 'game' ? <GameScreen /> : screen === 'newAirline' ? <NewAirline /> : screen === 'gameOver' ? <GameOver /> : <Title />}
      </Suspense>
      <SettingsHost />
      <UpdateBanner />
      <WhatsNewAfterUpdate />
    </>
  );
}

export function App() {
  return (
    <TooltipProvider>
      <Toaster>
        <Root />
      </Toaster>
    </TooltipProvider>
  );
}
