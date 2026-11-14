import { describe, expect, it } from 'vitest';
import { canSelfUpdate, changelogSection, isNewer, parseRelease } from './updateLogic';

describe('isNewer', () => {
  it('compares major, minor and patch numerically', () => {
    expect(isNewer('0.3.0', '0.2.0')).toBe(true);
    expect(isNewer('0.10.0', '0.9.9')).toBe(true);
    expect(isNewer('1.0.0', '0.99.99')).toBe(true);
    expect(isNewer('0.2.1', '0.2.0')).toBe(true);
  });
  it('is false for the same or an older version', () => {
    expect(isNewer('0.2.0', '0.2.0')).toBe(false);
    expect(isNewer('v0.2.0', '0.2.0')).toBe(false);
    expect(isNewer('0.1.9', '0.2.0')).toBe(false);
  });
  it('treats a pre-release as older than the release', () => {
    expect(isNewer('0.3.0', '0.3.0-beta.1')).toBe(true);
    expect(isNewer('0.3.0-beta.1', '0.3.0')).toBe(false);
  });
});

describe('parseRelease', () => {
  it('reads tag, notes and page from GitHub JSON', () => {
    expect(parseRelease({ tag_name: 'v0.3.0', body: '- New', html_url: 'https://x/y' })).toEqual({ version: '0.3.0', notes: '- New', url: 'https://x/y' });
  });
  it('ignores drafts, pre-releases, junk and odd tags', () => {
    expect(parseRelease({ tag_name: 'v0.3.0', draft: true })).toBeNull();
    expect(parseRelease({ tag_name: 'v0.3.0', prerelease: true })).toBeNull();
    expect(parseRelease({ tag_name: 'latest' })).toBeNull();
    expect(parseRelease({ message: 'API rate limit exceeded' })).toBeNull();
    expect(parseRelease(null)).toBeNull();
  });
});

describe('canSelfUpdate', () => {
  it('is only true for the installed Windows build', () => {
    expect(canSelfUpdate({ packaged: true, platform: 'win32', uninstallerExists: true })).toBe(true);
    expect(canSelfUpdate({ packaged: true, platform: 'win32', uninstallerExists: false })).toBe(false); // .zip
    expect(canSelfUpdate({ packaged: false, platform: 'win32', uninstallerExists: true })).toBe(false); // dev
    expect(canSelfUpdate({ packaged: true, platform: 'linux', uninstallerExists: true })).toBe(false);
  });
});

describe('changelogSection', () => {
  const md = '# Changelog\n\n## 0.3.0 — "Hangar"\n\n- Photos\n- Updates\n\n## 0.2.0 — "Living World"\n\n- Weather\n';
  it('returns one version without its heading', () => {
    expect(changelogSection(md, '0.3.0')).toBe('- Photos\n- Updates');
    expect(changelogSection(md, '0.2.0')).toBe('- Weather');
  });
  it('does not match a version prefix', () => {
    expect(changelogSection('## 0.3.10\n- x', '0.3.1')).toBe('');
    expect(changelogSection(md, '9.9.9')).toBe('');
  });
});
