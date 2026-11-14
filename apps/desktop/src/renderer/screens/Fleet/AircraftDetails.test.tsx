// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { checkConfig, standardProduct } from '@skyempire/sim';
import { TooltipProvider } from '@skyempire/ui';
import { describe, expect, it } from 'vitest';
import { SeatMap } from '../../components/SeatMap';
import { cabinPresets, photoOf, rowShape } from '../../lib/aircraftMedia';
import { catalog } from '../../lib/catalog';
import { AircraftDetails } from './AircraftDetails';

describe('cabin presets', () => {
  it('always fit the aircraft and use full business rows', () => {
    for (const t of Object.values(catalog.aircraftTypes).filter((x) => x.kind !== 'freighter')) {
      for (const p of cabinPresets(t)) {
        const jRow = rowShape(t.abreast!, p.config.product).business.reduce((a, b) => a + b, 0);
        expect(checkConfig(p.config, t), `${t.id} ${p.id}`).toBeNull();
        expect(p.config.seats.economy, `${t.id} ${p.id}`).toBeGreaterThan(0);
        expect(p.config.seats.business % jRow, `${t.id} ${p.id}`).toBe(0);
      }
    }
  });
  it('keeps turboprops all-economy and gives widebodies three classes', () => {
    const atr = catalog.aircraftTypes.AT76!;
    expect(cabinPresets(atr).map((p) => p.id)).toEqual(['economy']);
    const b789 = catalog.aircraftTypes.B789!;
    const three = cabinPresets(b789).find((p) => p.id === 'three')!.config.seats;
    expect(three.business).toBeGreaterThan(0);
    expect(three.premium).toBeGreaterThan(0);
  });
  it('uses real seats-per-row', () => {
    const p = standardProduct();
    expect(rowShape(6, p).economy).toEqual([3, 3]);
    expect(rowShape(9, p).economy).toEqual([3, 3, 3]);
    expect(rowShape(10, p).business).toEqual([1, 2, 1]);
    expect(rowShape(9, { ...p, business: { ...p.business, seat: 'recliner' } }).business).toEqual([2, 3, 2]);
    expect(rowShape(6, { ...p, business: { ...p.business, seat: 'suite' } }).business).toEqual([1, 1]);
  });
});

describe('seat map', () => {
  it('draws one seat per passenger and labels the cabins', () => {
    const { container } = render(<SeatMap typeId="A20N" config={{ seats: { business: 12, premium: 0, economy: 150 }, product: standardProduct(), dense: false }} />);
    expect(container.querySelectorAll('rect')).toHaveLength(162);
    expect(screen.getByRole('img', { name: 'Cabin layout: 12 business, 0 premium, 150 economy seats' })).toBeInTheDocument();
    expect(screen.getByText('28 rows')).toBeInTheDocument(); // 3 rows of 2-2 business + 25 of 3-3 economy
  });
  it('shows an empty cabin without crashing', () => {
    render(<SeatMap typeId="A20N" config={{ seats: { business: 0, premium: 0, economy: 0 }, product: standardProduct(), dense: false }} />);
    expect(screen.getByText('No seats')).toBeInTheDocument();
  });
});

describe('aircraft page', () => {
  it('every type has a photo with a credit (6 freighters with no free photo use their silhouette)', () => {
    const noPhoto = ['A20F', 'A35F', 'B78F', 'DH4F', 'E90F', 'E95F'];
    for (const id of noPhoto) expect(photoOf(id), id).toBeNull();
    for (const id of Object.keys(catalog.aircraftTypes).filter((x) => !noPhoto.includes(x))) {
      const p = photoOf(id);
      expect(p, id).not.toBeNull();
      expect(p!.author.length, id).toBeGreaterThan(0);
    }
  });
  it('shows the photo credit, real specs and switches cabin layouts', async () => {
    const user = userEvent.setup();
    render(<TooltipProvider><AircraftDetails typeId="B789" open onOpenChange={() => {}} /></TooltipProvider>);
    expect(screen.getByRole('heading', { name: 'Boeing 787-9' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Boeing 787-9 in flight/ })).toBeInTheDocument();
    expect(screen.getByText(/Photo: /)).toBeInTheDocument();
    expect(screen.getByText('62.8 m')).toBeInTheDocument();
    expect(screen.getByText('Sep 2013')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Three class' }));
    expect(screen.getByRole('tab', { name: 'Three class' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('img', { name: /Cabin layout: \d+ business, [1-9]\d* premium/ })).toBeInTheDocument();
  });
});
