import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';

export interface Column<T> {
  key: string;
  header: string;
  cell(row: T): ReactNode;
  sortValue?(row: T): number | string;
  numeric?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  getKey(row: T): string;
  onRowClick?(row: T): void;
  selectedKey?: string | null;
  rowClassName?(row: T): string | undefined;
  empty?: ReactNode;
  maxHeight?: number;
}

const ROW_H = 36;

/** Sortable table; virtualizes above 100 rows. Click a header: ascending, again: descending. */
export function DataTable<T>({ rows, columns, getKey, onRowClick, selectedKey, rowClassName, empty, maxHeight = 480 }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const x = col.sortValue!(a), y = col.sortValue!(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, columns, sort]);
  const scroller = useRef<HTMLDivElement>(null);
  const virtual = sorted.length > 100;
  const v = useVirtualizer({ count: sorted.length, getScrollElement: () => scroller.current, estimateSize: () => ROW_H, overscan: 8, enabled: virtual });
  const items = virtual ? v.getVirtualItems() : sorted.map((_, index) => ({ index, start: index * ROW_H, key: index }));

  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div ref={scroller} className="overflow-auto" style={{ maxHeight }}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface-1">
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const label = (
                <span className="inline-flex items-center gap-1">
                  {c.header}
                  {active && (sort!.dir === 1 ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />)}
                </span>
              );
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : undefined}
                  className={cn('label-caps h-9 border-b border-border px-3 font-semibold', c.numeric ? 'text-right' : 'text-left')}
                  style={{ width: c.width }}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      className="label-caps hover:text-text"
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                    >
                      {label}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {virtual && items[0] && <tr style={{ height: items[0].start }} aria-hidden />}
          {items.map(({ index }) => {
            const row = sorted[index]!;
            const key = getKey(row);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                aria-selected={selectedKey === key || undefined}
                className={cn(
                  'h-9 border-b border-border transition-colors duration-[var(--dur-1)]',
                  onRowClick && 'cursor-pointer hover:bg-surface-2',
                  selectedKey === key && 'bg-surface-2',
                  rowClassName?.(row),
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('truncate px-3', c.numeric && 'num text-right')}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
          {virtual && <tr style={{ height: Math.max(0, v.getTotalSize() - (items.at(-1)?.start ?? 0) - ROW_H) }} aria-hidden />}
        </tbody>
      </table>
    </div>
  );
}
