import { AirportInspector } from '../screens/Network/AirportInspector';
import { RouteInspector } from '../screens/Network/RouteInspector';
import { useUi } from '../store';

export function InspectorContent() {
  const selection = useUi((s) => s.selection);
  if (!selection) return null;
  if (selection.kind === 'airport') return <AirportInspector id={selection.id} />;
  if (selection.kind === 'route') return <RouteInspector id={selection.id} />;
  return null;
}
