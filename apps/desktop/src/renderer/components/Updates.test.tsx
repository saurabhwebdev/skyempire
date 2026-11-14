// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UpdateState } from '@skyempire/shared';
import { TooltipProvider } from '@skyempire/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseNotes, UpdateBanner, UpdateSection, useUpdates, WhatsNewAfterUpdate } from './Updates';

const base: UpdateState = { status: 'available', current: '0.2.0', version: '0.3.0', notes: '- **Photos** of every aircraft', canInstall: true, url: 'https://github.com/x' };
let api: { download: ReturnType<typeof vi.fn>; install: ReturnType<typeof vi.fn>; openPage: ReturnType<typeof vi.fn>; check: ReturnType<typeof vi.fn> };
let save: ReturnType<typeof vi.fn>;
const show = (s: Partial<UpdateState>) => act(() => useUpdates.getState().set({ ...base, ...s }));
const wrap = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe('update banner', () => {
  beforeEach(() => {
    useUpdates.setState({ state: null, dismissed: null });
    api = { download: vi.fn(async () => {}), install: vi.fn(), openPage: vi.fn(), check: vi.fn(async () => ({ ...base, status: 'none' })) };
    save = vi.fn(async () => {});
    window.game = { save, updates: api } as unknown as typeof window.game;
  });

  it('stays hidden until a newer version is known', () => {
    wrap(<UpdateBanner />);
    expect(screen.queryByRole('status', { name: 'Update available' })).toBeNull();
    show({ status: 'none', version: '0.2.0' });
    expect(screen.queryByRole('status', { name: 'Update available' })).toBeNull();
  });

  it('downloads when the player clicks Update now', async () => {
    const user = userEvent.setup();
    wrap(<UpdateBanner />);
    show({});
    expect(screen.getByText('SkyEmpire 0.3.0 is available')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Update now/ }));
    expect(api.download).toHaveBeenCalledOnce();
  });

  it('offers a download link when this build cannot update itself', async () => {
    const user = userEvent.setup();
    wrap(<UpdateBanner />);
    show({ canInstall: false });
    expect(screen.queryByRole('button', { name: /Update now/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Download/ }));
    expect(api.openPage).toHaveBeenCalledOnce();
  });

  it('shows download progress, then saves before restarting', async () => {
    const user = userEvent.setup();
    wrap(<UpdateBanner />);
    show({ status: 'downloading', percent: 42 });
    expect(screen.getByRole('progressbar', { name: 'Download progress' })).toHaveAttribute('aria-valuenow', '42');
    show({ status: 'ready', percent: 100 });
    await user.click(screen.getByRole('button', { name: /Restart now/ }));
    expect(save).toHaveBeenCalledOnce();
    expect(api.install).toHaveBeenCalledOnce();
    expect(save.mock.invocationCallOrder[0]!).toBeLessThan(api.install.mock.invocationCallOrder[0]!);
  });

  it('still installs when no game is running to save', async () => {
    const user = userEvent.setup();
    save.mockRejectedValueOnce(new Error('no game'));
    wrap(<UpdateBanner />);
    show({ status: 'ready' });
    await user.click(screen.getByRole('button', { name: /Restart now/ }));
    expect(api.install).toHaveBeenCalledOnce();
  });

  it('Later hides the banner for that version only', async () => {
    const user = userEvent.setup();
    wrap(<UpdateBanner />);
    show({});
    await user.click(screen.getByRole('button', { name: 'Later' }));
    await waitFor(() => expect(screen.queryByText('SkyEmpire 0.3.0 is available')).toBeNull());
    show({ version: '0.3.1' });
    expect(screen.getByText('SkyEmpire 0.3.1 is available')).toBeInTheDocument();
  });

  it('shows a failed download with a retry', async () => {
    const user = userEvent.setup();
    wrap(<UpdateBanner />);
    show({ status: 'error', error: 'The download failed. Check your connection and try again.' });
    expect(screen.getByText('The download failed. Check your connection and try again.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    expect(api.download).toHaveBeenCalledOnce();
  });

  it('shows release notes', async () => {
    const user = userEvent.setup();
    wrap(<UpdateBanner />);
    show({});
    await user.click(screen.getByRole('button', { name: 'What’s new' }));
    expect(screen.getByText('Photos')).toBeInTheDocument();
  });
});

describe('settings update row', () => {
  beforeEach(() => {
    useUpdates.setState({ state: { ...base, status: 'idle', version: undefined }, dismissed: '0.3.0' });
    api = { download: vi.fn(), install: vi.fn(), openPage: vi.fn(), check: vi.fn(async () => ({ ...base, status: 'none', version: '0.2.0' })) };
    window.game = { updates: api } as unknown as typeof window.game;
  });
  it('checks on demand and reports the result', async () => {
    const user = userEvent.setup();
    wrap(<UpdateSection />);
    expect(screen.getByText(/You have SkyEmpire 0.2.0/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(api.check).toHaveBeenCalledOnce();
    expect(screen.getByText(/You have the latest version/)).toBeInTheDocument();
  });
});

describe('what’s new after an update', () => {
  beforeEach(() => { localStorage.clear(); useUpdates.setState({ state: null, dismissed: null }); });
  it('does not show on a first install', () => {
    wrap(<WhatsNewAfterUpdate />);
    show({ current: '0.2.0', status: 'none' });
    expect(screen.queryByText(/Updated to SkyEmpire/)).toBeNull();
    expect(localStorage.getItem('se:lastVersion')).toBe('0.2.0');
  });
  it('shows once after the version changes', () => {
    localStorage.setItem('se:lastVersion', '0.1.0');
    wrap(<WhatsNewAfterUpdate />);
    show({ current: '0.2.0', status: 'none' });
    expect(screen.getByText('Updated to SkyEmpire 0.2.0')).toBeInTheDocument();
    expect(screen.getByText('Weather.')).toBeInTheDocument();
  });
});

describe('release notes', () => {
  it('renders bullets and bold text', () => {
    render(<ReleaseNotes md={'## Hi\n- **Bold** rest\n  - nested'} />);
    expect(screen.getByText('Bold').tagName).toBe('STRONG');
    expect(screen.getByText('nested')).toBeInTheDocument();
  });
});
