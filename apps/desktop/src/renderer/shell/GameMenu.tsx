import { Button, Modal, useToast } from '@skyempire/ui';
import { useUi } from '../store';
import { t } from '../strings/en';

export function GameMenu() {
  const { menuOpen, setMenu, setShortcuts, setScreen } = useUi();
  const toast = useToast();
  return (
    <Modal open={menuOpen} onOpenChange={setMenu} title="Menu">
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={() => setMenu(false)}>{t.menu.resume}</Button>
        <Button onClick={async () => { await window.game.save(); toast({ title: t.saved, tone: 'success' }); setMenu(false); }}>{t.menu.save}</Button>
        <Button onClick={() => { setMenu(false); useUi.getState().setSection('overview'); window.dispatchEvent(new CustomEvent('se:open-settings')); }}>{t.menu.settings}</Button>
        <Button onClick={() => { setMenu(false); setShortcuts(true); }}>{t.menu.shortcuts}</Button>
        <Button variant="ghost" onClick={async () => { await window.game.save(); setMenu(false); setScreen('title'); }}>{t.menu.quit}</Button>
      </div>
    </Modal>
  );
}

export function ShortcutSheet() {
  const { shortcutsOpen, setShortcuts } = useUi();
  return (
    <Modal open={shortcutsOpen} onOpenChange={setShortcuts} title={t.menu.shortcuts}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        {t.shortcuts.map(([k, d]) => (
          <div key={k} className="contents">
            <dt><kbd className="rounded border border-border-strong bg-surface-3 px-1.5 py-0.5 font-mono text-[12px]">{k}</kbd></dt>
            <dd className="text-muted">{d}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
