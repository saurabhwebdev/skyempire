import { useEffect } from 'react';
import { SECTIONS, SPEEDS, useUi } from './store';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Global keyboard shortcuts (docs/ui-ux-design.md §7). Returns true when handled. */
export function handleShortcut(e: KeyboardEvent): boolean {
  const ui = useUi.getState();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    void window.game?.save();
    return true;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return false;
  if (ui.screen !== 'game') return false;

  const idx = Number(e.key);
  if (Number.isInteger(idx) && idx >= 1 && idx <= SECTIONS.length) ui.setSection(SECTIONS[idx - 1]!);
  else if (e.key === ' ') ui.setSpeed(ui.speed === 0 ? ui.lastSpeed : 0);
  else if (e.key === '+' || e.key === '=') ui.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(ui.speed) + 1)]!);
  else if (e.key === '-') ui.setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(ui.speed) - 1)]!);
  else if (e.key.toLowerCase() === 'n') ui.openRouteEditor({});
  else if (e.key.toLowerCase() === 't') ui.setTray(!ui.trayOpen);
  else if (e.key === '/') window.dispatchEvent(new CustomEvent('se:focus-search'));
  else if (e.key === '?') ui.setShortcuts(true);
  else if (e.key === 'Escape') {
    if (ui.routeEditor) ui.openRouteEditor(null);
    else if (ui.selection) ui.select(null);
    else ui.setMenu(!ui.menuOpen);
  } else return false;
  e.preventDefault();
  return true;
}

export function useShortcuts(): void {
  useEffect(() => {
    const on = (e: KeyboardEvent) => void handleShortcut(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}
