import { Toaster, TooltipProvider } from '@skyempire/ui';
import { useEffect } from 'react';
import { useGameBridge, useNotices } from './hooks/useGame';
import { UpdateBanner, useUpdateBridge, WhatsNewAfterUpdate } from './components/Updates';
import { BottomTray } from './shell/BottomTray';
import { GameMenu, ShortcutSheet } from './shell/GameMenu';
import { Inspector } from './shell/Inspector';
import { InspectorContent } from './shell/InspectorContent';
import { NetworkTray } from './screens/Network/NetworkTray';
import { RouteEditor } from './screens/Network/RouteEditor';
import { AircraftMarket } from './screens/Fleet/AircraftMarket';
import { FleetTray } from './screens/Fleet/FleetTray';
import { Overview } from './screens/Overview/Overview';
import { Finance } from './screens/Finance/Finance';
import { Market } from './screens/Market/Market';
import { Airline } from './screens/Airline/Airline';
import { News } from './screens/News/News';
import { NotificationCenter } from './notifications/NotificationCenter';
import { Coachmarks } from './screens/Onboarding/Coachmarks';
import { GameOver } from './screens/GameOver/GameOver';
import { applySettingsToDocument, SettingsHost } from './screens/Settings/Settings';
import { Button } from '@skyempire/ui';
import { Plus } from 'lucide-react';
import { NavRail } from './shell/NavRail';
import { TopBar } from './shell/TopBar';
import { WorldMap } from './map/WorldMap';
import { NewAirline } from './screens/NewAirline/NewAirline';
import { Title } from './screens/Title/Title';
import { useShortcuts } from './shortcuts';
import { useGameStore, useUi } from './store';
import { t } from './strings/en';

function TrayContent() {
  const section = useUi((s) => s.section);
  if (section === 'network') return <NetworkTray />;
  if (section === 'fleet') return <FleetTray />;
  return <div className="p-4 text-muted">{t.sections[section]}</div>;
}

const FULL_PAGE: Partial<Record<string, () => React.ReactElement>> = {
  overview: () => <Overview />,
  finance: () => <Finance />,
  market: () => <Market />,
  airline: () => <Airline />,
  news: () => <News />,
};

function FullPage({ section }: { section: string }) {
  const Page = FULL_PAGE[section];
  if (!Page) return null;
  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-bg/85 backdrop-blur-sm">
      <div className="mx-auto max-w-[1200px] p-6">
        <h1 className="mb-4 text-[24px] font-semibold tracking-[-0.02em]">{t.sections[section as keyof typeof t.sections]}</h1>
        <Page key={section} />
      </div>
    </div>
  );
}

function GameScreen() {
  const section = useUi((s) => s.section);
  const editor = useUi((s) => s.routeEditor);
  const marketOpen = useUi((s) => s.marketOpen);
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main className="relative flex min-w-0 flex-1">
          <div className="relative min-w-0 flex-1 bg-[var(--map-water)]" id="map-area">
            <WorldMap />
            <Coachmarks />
            <FullPage section={section} />
            {!FULL_PAGE[section] && <BottomTray
              title={t.sections[section]}
              action={
                section === 'fleet' ? (
                  <Button size="sm" variant="primary" onClick={() => useUi.getState().setMarketOpen(true)}><Plus className="size-4" /> Get aircraft</Button>
                ) : (
                  <Button size="sm" variant="primary" onClick={() => useUi.getState().openRouteEditor({})}><Plus className="size-4" /> New route</Button>
                )
              }
            >
              <TrayContent />
            </BottomTray>}
            {editor && <RouteEditor key={editor.routeId ?? 'new'} />}
            {marketOpen && <AircraftMarket />}
          </div>
          <Inspector>
            <InspectorContent />
          </Inspector>
        </main>
      </div>
      <GameMenu />
      <ShortcutSheet />
      <NotificationCenter />
    </div>
  );
}

function Root() {
  useGameBridge();
  useUpdateBridge();
  useNotices();
  useShortcuts();
  const screen = useUi((s) => s.screen);
  const settings = useGameStore((s) => s.settings);
  useEffect(() => applySettingsToDocument(settings), [settings]);
  return (
    <>
      {screen === 'game' ? <GameScreen /> : screen === 'newAirline' ? <NewAirline /> : screen === 'gameOver' ? <GameOver /> : <Title />}
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
