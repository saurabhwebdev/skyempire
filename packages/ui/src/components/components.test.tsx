import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Button, Combobox, DataTable, KpiTile, ListToolbar, Modal, NoResults, NumberInput, Segmented } from '../index';

describe('Button', () => {
  it('shows a busy state without changing its label width', () => {
    render(<Button loading>Open route</Button>);
    const b = screen.getByRole('button', { name: /open route/i });
    expect(b).toHaveAttribute('aria-busy', 'true');
    expect(b).toBeDisabled();
    expect(screen.getByText('Open route')).toHaveStyle({ opacity: '0' }); // hidden visually, still named for screen readers
  });
});

describe('NumberInput', () => {
  function Harness() {
    const [v, setV] = useState(10);
    return <NumberInput label="Flights per week" value={v} onChange={setV} min={1} max={30} step={1} />;
  }
  it('steps with arrows, ×10 with Shift, and clamps to max', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Flights per week');
    await user.click(input);
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveValue('11');
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(input).toHaveValue('21');
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(input).toHaveValue('30');
  });
});

describe('Combobox', () => {
  const items = [
    { id: 'LHR', city: 'London' },
    { id: 'CDG', city: 'Paris' },
    { id: 'LGW', city: 'London' },
  ];
  it('filters by code or city and lists recent items first', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        label="To"
        items={items}
        getKey={(i) => i.id}
        render={(i) => `${i.id} ${i.city}`}
        filter={(i, q) => i.id.toLowerCase().includes(q) || i.city.toLowerCase().includes(q)}
        recentKeys={['LGW']}
        onSelect={() => {}}
      />,
    );
    const input = screen.getByLabelText('To');
    await user.click(input);
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('LGW');
    await user.type(input, 'par');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['CDG Paris']);
    await user.clear(input);
    await user.type(input, 'london');
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});

describe('KpiTile', () => {
  it('shows a falling delta with arrow and minus sign', () => {
    render(<KpiTile label="Profit" value="$1.2M" delta={-5} deltaLabel="−5%" />);
    expect(screen.getByText('▼')).toBeInTheDocument();
    expect(screen.getByText('−5%')).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  it('sorts a numeric column descending on the second click', async () => {
    const user = userEvent.setup();
    const rows = [{ id: 'a', profit: 5 }, { id: 'b', profit: 20 }, { id: 'c', profit: -3 }];
    render(<DataTable rows={rows} getKey={(r) => r.id} columns={[{ key: 'id', header: 'Route', cell: (r) => r.id }, { key: 'profit', header: 'Profit', cell: (r) => r.profit, sortValue: (r) => r.profit, numeric: true }]} />);
    const header = screen.getByRole('button', { name: /profit/i });
    await user.click(header);
    await user.click(header);
    const cells = screen.getAllByRole('row').slice(1).map((r) => r.querySelector('td')!.textContent);
    expect(cells).toEqual(['b', 'a', 'c']);
  });
});

describe('Modal', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Close route</button>
        <Modal open={open} onOpenChange={setOpen} title="Close LHR–CDG?" description="Its slots will be released.">
          <button>Confirm</button>
        </Modal>
      </>
    );
  }
  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Close route' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('ListToolbar', () => {
  function Harness() {
    const [q, setQ] = useState('');
    const [kind, setKind] = useState('all');
    const [sort, setSort] = useState('price');
    const items = ['Airbus A320neo', 'Boeing 737 MAX 8', 'ATR 72-600'].filter((x) => x.toLowerCase().includes(q.toLowerCase()) && (kind === 'all' || x.startsWith(kind)));
    return (
      <>
        <ListToolbar search={{ value: q, onChange: setQ, label: 'Search aircraft' }}
          sort={{ value: sort, onChange: setSort, options: [{ id: 'price', label: 'Price' }, { id: 'range', label: 'Range' }] }}
          shown={items.length} total={3} onClear={() => { setQ(''); setKind('all'); }}>
          <Segmented label="Maker" value={kind} onChange={setKind} options={[{ id: 'all', label: 'All' }, { id: 'Airbus', label: 'Airbus' }, { id: 'Boeing', label: 'Boeing' }]} />
        </ListToolbar>
        {items.length ? <ul>{items.map((x) => <li key={x}>{x}</li>)}</ul> : <NoResults onClear={() => { setQ(''); setKind('all'); }} />}
        <output>{sort}</output>
      </>
    );
  }
  it('searches, filters, sorts, counts and clears', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search aircraft' }), 'a');
    await user.click(screen.getByRole('radio', { name: 'Boeing' }));
    expect(screen.getByText('Showing 1 of 3')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'range');
    expect(screen.getByRole('status')).toHaveTextContent('range');
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('Nothing matches these filters.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
  it('Escape clears the search box', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('searchbox'), 'atr{Escape}');
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});
