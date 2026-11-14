/** Pure helpers for in-app updates (no Electron imports, so they unit-test). */

export const RELEASES_API = 'https://api.github.com/repos/saurabhwebdev/skyempire/releases/latest';
export const RELEASES_PAGE = 'https://github.com/saurabhwebdev/skyempire/releases/latest';

/** True when version `a` is newer than `b` (both "x.y.z", optional leading "v"; pre-release tags count as older). */
export function isNewer(a: string, b: string): boolean {
  const parse = (v: string) => {
    const [core = '', pre] = v.trim().replace(/^v/i, '').split('-', 2);
    return { nums: core.split('.').map((n) => Number.parseInt(n, 10) || 0), pre: pre !== undefined };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return !x.pre && y.pre;
}

export interface LatestRelease {
  version: string;
  notes: string;
  url: string;
}

/** Reads GitHub's "latest release" JSON. Drafts and pre-releases are ignored. */
export function parseRelease(json: unknown): LatestRelease | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as { tag_name?: unknown; body?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown };
  if (typeof r.tag_name !== 'string' || r.draft === true || r.prerelease === true) return null;
  if (!/^v?\d+\.\d+\.\d+/.test(r.tag_name)) return null;
  return {
    version: r.tag_name.replace(/^v/i, ''),
    notes: typeof r.body === 'string' ? r.body : '',
    url: typeof r.html_url === 'string' ? r.html_url : RELEASES_PAGE,
  };
}

/**
 * Only the Setup .exe install can update itself: the NSIS installer leaves an uninstaller next to the app.
 * The .zip build, Linux and dev runs get a download link instead.
 */
export function canSelfUpdate(opts: { packaged: boolean; platform: string; uninstallerExists: boolean }): boolean {
  return opts.packaged && opts.platform === 'win32' && opts.uninstallerExists;
}

/** The CHANGELOG section for one version ("## 0.3.0 — …" up to the next "## "), without its heading. */
export function changelogSection(md: string, version: string): string {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^##\\s+v?${version.replace(/\./g, '\\.')}(\\s|$)`).test(l));
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}
