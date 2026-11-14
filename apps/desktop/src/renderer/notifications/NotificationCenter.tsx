import { routeChain } from '../lib/routes';
import type { ClientView, Notification } from '@skyempire/shared';
import { Button, Modal, useToast } from '@skyempire/ui';
import { useEffect, useState } from 'react';
import { useGameStore, useUi } from '../store';

/** Should this notification interrupt the player with a toast? (Everything still lands in News.) */
export function isRelevant(n: Notification, view: ClientView | null): boolean {
  if (n.category === 'goal' || n.category === 'airline') return true;
  if (n.category === 'rival') return false;
  if (!view || !n.link || n.link.kind !== 'airport') return n.level !== 'info';
  const mine = new Set([...view.player.baseIds, ...view.routes.flatMap((r) => routeChain(r))]);
  return mine.has(n.link.id);
}

/** Turns tick notifications into toasts (minor) or an event modal (major). */
export function NotificationCenter() {
  const latest = useGameStore((s) => s.latest);
  const toast = useToast();
  const [modal, setModal] = useState<Notification | null>(null);
  useEffect(() => {
    const view = useGameStore.getState().view;
    for (const n of latest) {
      if (n.level === 'major') setModal(n);
      else if (isRelevant(n, view)) toast({ title: n.title, body: n.body, tone: n.level === 'warning' ? 'warning' : n.category === 'goal' ? 'success' : 'info' });
    }
  }, [latest, toast]);
  const details = () => {
    const link = modal?.link;
    setModal(null);
    if (!link) useUi.getState().setSection('news');
    else if (link.kind === 'route') useUi.setState({ section: 'network', selection: { kind: 'route', id: link.id } });
    else if (link.kind === 'aircraft') useUi.setState({ section: 'fleet', selection: { kind: 'aircraft', id: link.id } });
    else if (link.kind === 'airport') useUi.setState({ section: 'network', selection: { kind: 'airport', id: link.id } });
    else useUi.getState().setSection('airline');
  };
  return (
    <Modal open={!!modal} onOpenChange={(o) => !o && setModal(null)} title={modal?.title ?? ''} description={modal?.body}
      footer={<><Button variant="ghost" onClick={details}>View details</Button><Button variant="primary" onClick={() => { setModal(null); useUi.getState().setSpeed(useUi.getState().lastSpeed); }}>Resume</Button></>} />
  );
}
