import { AirportInspector } from '../screens/Network/AirportInspector';
import { RouteInspector } from '../screens/Network/RouteInspector';
import { AircraftInspector } from '../screens/Fleet/AircraftInspector';
import { RivalInspector } from '../screens/Market/RivalInspector';
import { useUi } from '../store';

export function InspectorContent() {
  const selection = useUi((s) => s.selection);
  if (!selection) return null;
  if (selection.kind === 'airport') return <AirportInspector id={selection.id} />;
  if (selection.kind === 'route') return <RouteInspector id={selection.id} />;
  if (selection.kind === 'aircraft') return <AircraftInspector id={selection.id} />;
  if (selection.kind === 'airline') return <RivalInspector id={selection.id} />;
  return null;
}
