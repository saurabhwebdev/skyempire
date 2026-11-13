import { Toaster, TooltipProvider } from '@skyempire/ui';
import { useEffect } from 'react';
import { useGameBridge } from './hooks/useGame';
import { BottomTray } from './shell/BottomTray';
import { GameMenu, ShortcutSheet } from './shell/GameMenu';
import { Inspector } from './shell/Inspector';
import { NavRail } from './shell/NavRail';
import { TopBar } from './shell/TopBar';
import { WorldMap } from './map/WorldMap';
import { NewAirline } from './screens/NewAirline/NewAirline';
import { Title } from './screens/Title/Title';
import { useShortcuts } from './shortcuts';
import { useGameStore, useUi } from './store';
import { t } from './strings/en';

function GameScreen() {
  const section = useUi((s) => s.section);
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main className="relative flex min-w-0 flex-1">
          <div className="relative min-w-0 flex-1 bg-[var(--map-water)]" id="map-area">
            <WorldMap />
            <BottomTray title={t.sections[section]}>
              <div className="p-4 text-muted">{t.sections[section]}</div>
            </BottomTray>
          </div>
          <Inspector>
            <div />
          </Inspector>
        </main>
      </div>
      <GameMenu />
      <ShortcutSheet />
    </div>
  );
}

function Root() {
  useGameBridge();
  useShortcuts();
  const screen = useUi((s) => s.screen);
  const settings = useGameStore((s) => s.settings);
  useEffect(() => {
    document.documentElement.toggleAttribute('data-reduce-motion', settings.reduceMotion);
    document.documentElement.toggleAttribute('data-performance', settings.performanceMode);
  }, [settings]);
  if (screen === 'game') return <GameScreen />;
  if (screen === 'newAirline') return <NewAirline />;
  return <Title />;
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
