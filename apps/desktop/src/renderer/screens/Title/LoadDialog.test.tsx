// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from '@skyempire/ui';
import { describe, expect, it, vi } from 'vitest';
import { LoadDialog } from './LoadDialog';

describe('LoadDialog', () => {
  it('shows a friendly message for a damaged save and stays open', async () => {
    const user = userEvent.setup();
    window.game = {
      listSaves: vi.fn().mockResolvedValue([{ id: 'c1', name: 'My career', airlineName: 'Albion Skyways', day: 40, updatedAt: 1 }]),
      loadSave: vi.fn().mockRejectedValue(new Error("Error invoking remote method 'game:loadSave': Error: SaveLoadError:corrupt")),
    } as unknown as typeof window.game;
    render(<Toaster><LoadDialog open onOpenChange={() => {}} /></Toaster>);
    await user.click(await screen.findByRole('button', { name: /Albion Skyways/ }));
    expect(await screen.findByText('This save can’t be opened — the file is damaged.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
