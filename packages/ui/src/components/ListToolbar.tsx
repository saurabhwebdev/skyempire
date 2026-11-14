import { SearchX, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Button } from './Button';

export interface ListToolbarProps {
  search: { value: string; onChange(v: string): void; label: string; placeholder?: string };
  sort?: { value: string; onChange(v: string): void; options: { id: string; label: string }[] };
  /** Filters (Segmented, FilterSelect, checkboxes…). */
  children?: ReactNode;
  shown: number;
  total: number;
  /** Resets search and filters; shown when something is filtered out. */
  onClear(): void;
  className?: string;
}

/** Search box, filters, sort and a "Showing X of Y · Clear filters" line, for any list. */
export function ListToolbar({ search, sort, children, shown, total, onClear, className }: ListToolbarProps) {
  const filtered = shown < total;
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <label className="relative flex items-center">
        <span className="sr-only">{search.label}</span>
        <Search aria-hidden className="pointer-events-none absolute left-2.5 size-4 text-faint" />
        <input type="search" aria-label={search.label} value={search.value} placeholder={search.placeholder ?? 'Search'}
          onChange={(e) => search.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && search.value) { e.preventDefault(); e.stopPropagation(); search.onChange(''); }
          }}
          className="h-8 w-56 rounded-md border border-border bg-surface-2 pl-8 pr-2 text-[13px] text-text placeholder:text-faint focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:hidden" />
        {search.value && (
          <button type="button" aria-label="Clear search" onClick={() => search.onChange('')} className="absolute right-1.5 rounded p-0.5 text-faint hover:text-text">
            <X className="size-3.5" />
          </button>
        )}
      </label>
      {children}
      {sort && (
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Sort
          <select aria-label="Sort by" value={sort.value} onChange={(e) => sort.onChange(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface-2 px-2 text-[13px] text-text focus-visible:outline-2 focus-visible:outline-accent">
            {sort.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      )}
      {filtered && (
        <span className="ml-auto flex items-center gap-2 text-[12px] text-muted">
          <span className="num">Showing {shown} of {total}</span>
          <button type="button" onClick={onClear} className="font-semibold text-accent hover:underline">Clear filters</button>
        </span>
      )}
    </div>
  );
}

/** A small one-of-many filter (e.g. All · Flying · Idle). */
export function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange(v: NoInfer<T>): void; options: readonly { id: NoInfer<T>; label: string; count?: number }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={cn('flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-semibold transition-colors duration-150', value === o.id ? 'bg-surface-3 text-text' : 'text-muted hover:text-text')}>
          {o.label}{o.count !== undefined && <span className="num font-normal text-faint">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A labelled dropdown filter. */
export function FilterSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange(v: NoInfer<T>): void; options: readonly { id: NoInfer<T>; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted">
      {label}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}
        className="h-8 rounded-md border border-border bg-surface-2 px-2 text-[13px] text-text focus-visible:outline-2 focus-visible:outline-accent">
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Empty list because of filters: say so and offer a way back. */
export function NoResults({ onClear, text = 'Nothing matches these filters.' }: { onClear(): void; text?: string }) {
  return (
    <div className="se-enter flex flex-col items-center gap-3 px-6 py-10 text-center">
      <SearchX aria-hidden className="size-8 text-faint" />
      <p className="text-muted">{text}</p>
      <Button size="sm" onClick={onClear}>Clear filters</Button>
    </div>
  );
}
