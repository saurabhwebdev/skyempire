// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGameStore } from '../../store';
import { fakeView } from '../../testing';
import { PeaksCard } from './PeaksCard';

describe('PeaksCard', () => {
  it('lists upcoming travel peaks with dates and size', () => {
    useGameStore.setState({ view: fakeView({}, { day: 360, upcomingPeaks: [{ name: 'Christmas & New Year', countries: ['GB', 'FR'], startDay: 353, endDay: 369, peak: 0.8 }] }) });
    render(<PeaksCard />);
    expect(screen.getByText('Christmas & New Year')).toBeInTheDocument();
    expect(screen.getByText('Dec 20 – Jan 5')).toBeInTheDocument();
    expect(screen.getByText('+80% leisure demand · GB, FR')).toBeInTheDocument();
    expect(screen.getByText('Now')).toBeInTheDocument();
  });
  it('has an empty state', () => {
    useGameStore.setState({ view: fakeView({}, { upcomingPeaks: [] }) });
    render(<PeaksCard />);
    expect(screen.getByText('No big travel peaks in the next 60 days.')).toBeInTheDocument();
  });
});
