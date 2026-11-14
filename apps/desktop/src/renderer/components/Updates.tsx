import type { UpdateState } from '@skyempire/shared';
import { Button, Modal } from '@skyempire/ui';
import { Download, RefreshCw, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import changelog from '../../../../../CHANGELOG.md?raw';
import { changelogSection } from '../../main/updateLogic';

interface UpdateStore {
  state: UpdateState | null;
  dismissed: string | null;
  set(s: UpdateState): void;
  dismiss(version: string): void;
}
export const useUpdates = create<UpdateStore>((set) => ({
  state: null,
  dismissed: null,
  set: (state) => set({ state }),
  dismiss: (dismissed) => set({ dismissed }),
}));

/** Mount once: mirrors the main process's update state. */
export function useUpdateBridge(): void {
  useEffect(() => {
    void window.game.updates.get().then((s) => useUpdates.getState().set(s));
    return window.game.updates.onState((s) => useUpdates.getState().set(s));
  }, []);
}

/** Save, then quit, install silently and relaunch. */
async function restartAndUpdate() {
  try { await window.game.save(); } catch { /* no game running */ }
  window.game.updates.install();
}

/** Minimal Markdown for release notes: "#" headings, "-" bullets (nested by indent), **bold**. */
export function ReleaseNotes({ md }: { md: string }) {
  const inline = (t: string): ReactNode[] => t.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="text-text">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
  const lines = md.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return <p className="text-muted">No notes for this version.</p>;
  return (
    <div className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted">
      {lines.map((l, i) => {
        const bullet = /^(\s*)[-*]\s+(.*)$/.exec(l);
        if (bullet) return <p key={i} className="relative pl-4" style={{ marginLeft: Math.min(bullet[1]!.length, 8) * 6 }}><span aria-hidden className="absolute left-0">•</span>{inline(bullet[2]!)}</p>;
        const h = /^#+\s+(.*)$/.exec(l);
        if (h) return <p key={i} className="mt-2 font-semibold text-text">{inline(h[1]!)}</p>;
        return <p key={i}>{inline(l)}</p>;
      })}
    </div>
  );
}

/** Floating banner at the top of the window when a newer version exists. */
export function UpdateBanner() {
  const s = useUpdates((x) => x.state);
  const dismissed = useUpdates((x) => x.dismissed);
  const [notesOpen, setNotesOpen] = useState(false);
  const show = !!s?.version && ['available', 'downloading', 'ready'].includes(s.status) && !(s.status === 'available' && dismissed === s.version)
    || (s?.status === 'error' && !!s.version && dismissed !== s.version);
  return (
    <>
      <AnimatePresence>
        {show && s && (
          <motion.div role="status" aria-label="Update available"
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }} exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            className="fixed left-1/2 top-[52px] z-[60] w-[min(600px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-lg border border-accent/40 bg-surface-2 shadow-lg">
            <div className="flex items-center gap-3 px-4 py-3">
              <Sparkles className="size-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">
                  {s.status === 'ready' ? `SkyEmpire ${s.version} is ready to install`
                    : s.status === 'downloading' ? `Downloading SkyEmpire ${s.version}… ${s.percent ?? 0}%`
                    : s.status === 'error' ? 'Update failed'
                    : `SkyEmpire ${s.version} is available`}
                </p>
                <p className="truncate text-[12px] text-muted">
                  {s.status === 'ready' ? 'Your game is saved first, then SkyEmpire restarts.'
                    : s.status === 'downloading' ? 'Keep playing — we’ll tell you when it’s ready.'
                    : s.status === 'error' ? s.error
                    : s.canInstall ? `You have ${s.current}. Takes about a minute.` : `You have ${s.current}. Get the new installer from GitHub.`}
                </p>
              </div>
              {s.status !== 'downloading' && <Button size="sm" variant="ghost" onClick={() => setNotesOpen(true)}>What’s new</Button>}
              {s.status === 'ready' ? (
                <Button size="sm" variant="primary" onClick={() => void restartAndUpdate()}><RefreshCw className="size-4" /> Restart now</Button>
              ) : s.status === 'available' || s.status === 'error' ? (
                s.canInstall
                  ? <Button size="sm" variant="primary" onClick={() => void window.game.updates.download()}><Download className="size-4" /> {s.status === 'error' ? 'Try again' : 'Update now'}</Button>
                  : <Button size="sm" variant="primary" onClick={() => window.game.updates.openPage()}><Download className="size-4" /> Download</Button>
              ) : null}
              {(s.status === 'available' || s.status === 'error') && (
                <button type="button" aria-label="Later" title="Later" onClick={() => useUpdates.getState().dismiss(s.version!)}
                  className="rounded-md p-1 text-muted hover:bg-surface-3 hover:text-text"><X className="size-4" /></button>
              )}
            </div>
            {s.status === 'downloading' && (
              <div className="h-1 bg-surface-3" role="progressbar" aria-label="Download progress" aria-valuenow={s.percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${s.percent ?? 0}%` }} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <Modal open={notesOpen} onOpenChange={setNotesOpen} title={`What’s new in ${s?.version ?? ''}`}
        footer={<Button variant="ghost" onClick={() => setNotesOpen(false)}>Close</Button>}>
        <div className="max-h-[60vh] overflow-y-auto pr-1"><ReleaseNotes md={s?.notes || changelogSection(changelog, s?.version ?? '')} /></div>
      </Modal>
    </>
  );
}

const SEEN_KEY = 'se:lastVersion';

/** After an update, show this version's CHANGELOG section once. */
export function WhatsNewAfterUpdate() {
  const current = useUpdates((x) => x.state?.current);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!current) return;
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      localStorage.setItem(SEEN_KEY, current);
      if (!changelogSection(changelog, current) || seen === current) return;
      if (seen) setOpen(true);
      // v0.2 didn't record its version: an existing save means this is an upgrade, not a first install.
      else void window.game.listSaves().then((saves) => { if (saves.length) setOpen(true); }).catch(() => {});
    } catch { /* storage unavailable */ }
  }, [current]);
  if (!current) return null;
  return (
    <Modal open={open} onOpenChange={setOpen} title={`Updated to SkyEmpire ${current}`} description="Here’s what’s new."
      footer={<Button variant="primary" onClick={() => setOpen(false)}>Let’s fly</Button>}>
      <div className="max-h-[60vh] overflow-y-auto pr-1"><ReleaseNotes md={changelogSection(changelog, current)} /></div>
    </Modal>
  );
}

/** Settings row: version, manual check. */
export function UpdateSection() {
  const s = useUpdates((x) => x.state);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    try {
      const r = await window.game.updates.check();
      useUpdates.getState().set(r);
      if (r.version) useUpdates.getState().dismiss(''); // bring the banner back if it was hidden
    } finally { setBusy(false); }
  };
  const line = !s ? '' : s.status === 'none' ? 'You have the latest version.'
    : s.status === 'available' ? `Version ${s.version} is available.`
    : s.status === 'downloading' ? `Downloading ${s.version}… ${s.percent ?? 0}%`
    : s.status === 'ready' ? `Version ${s.version} is ready — restart to install.`
    : s.status === 'error' ? s.error ?? 'Update check failed.'
    : '';
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-semibold">Updates</p>
        <p className="text-[13px] text-muted">You have SkyEmpire {s?.current ?? '…'}.{line && ` ${line}`}</p>
      </div>
      {s?.status === 'ready'
        ? <Button size="sm" variant="primary" onClick={() => void restartAndUpdate()}>Restart now</Button>
        : <Button size="sm" loading={busy || s?.status === 'checking'} disabled={s?.status === 'downloading'} onClick={() => void check()}>Check for updates</Button>}
    </div>
  );
}
