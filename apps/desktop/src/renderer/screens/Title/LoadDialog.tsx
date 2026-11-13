import type { SaveInfo } from '@skyempire/shared';
import { formatDate } from '@skyempire/sim';
import { EmptyState, Modal, Skeleton } from '@skyempire/ui';
import { FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGameStore, useUi } from '../../store';
import { saveErrorMessage } from './saveErrors';

export function LoadDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const [saves, setSaves] = useState<SaveInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaves(null);
    void window.game.listSaves().then(setSaves);
  }, [open]);

  const load = async (s: SaveInfo) => {
    setLoading(s.id);
    setError(null);
    try {
      const view = await window.game.loadSave(s.id);
      useGameStore.getState().setView(view);
      useUi.setState({ section: 'overview', selection: null, speed: 0, screen: view.gameOver ? 'gameOver' : 'game' });
      onOpenChange(false);
    } catch (e) {
      setError(saveErrorMessage(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Load a career">
      {error && <p role="alert" className="mb-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger">{error}</p>}
      {!saves ? (
        <div className="flex flex-col gap-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      ) : saves.length === 0 ? (
        <EmptyState icon={<FolderOpen />} text="No saved careers yet. Start a new one from the title screen." />
      ) : (
        <ul className="flex max-h-[50vh] flex-col gap-2 overflow-auto">
          {saves.map((s) => (
            <li key={s.id}>
              <button type="button" disabled={loading !== null} onClick={() => load(s)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-1 p-3 text-left hover:border-border-strong disabled:opacity-60">
                <span>
                  <span className="block font-semibold">{s.airlineName || s.name}</span>
                  <span className="text-[13px] text-muted">{s.name}</span>
                </span>
                <span className="num text-right text-[13px] text-muted">
                  {s.updatedAt ? formatDate(s.day) : ''}
                  <span className="block text-faint">{s.updatedAt ? new Date(s.updatedAt).toLocaleString() : ''}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
