/** Map errors from the main process to friendly copy (docs/ui-ux-design.md §8). */
export function saveErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('SaveLoadError:corrupt')) return 'This save can’t be opened — the file is damaged.';
  if (msg.includes('SaveLoadError:newerVersion')) return 'This save was made with a newer version of SkyEmpire. Update the game to open it.';
  if (msg.includes('SaveLoadError:missing')) return 'This save no longer exists.';
  return 'This save can’t be opened.';
}
