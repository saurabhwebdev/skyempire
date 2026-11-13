import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';

export interface ComboboxProps<T> {
  label: string;
  items: T[];
  getKey(item: T): string;
  render(item: T): ReactNode;
  filter(item: T, query: string): boolean;
  /** Optional relevance for a query (lower = better), applied after recents. */
  rank?(item: T, query: string): number;
  onSelect(item: T): void;
  recentKeys?: string[];
  placeholder?: string;
  value?: T | null;
  renderValue?(item: T): string;
  limit?: number;
  autoFocus?: boolean;
}

/** Searchable select (ARIA combobox). Recent items first; type to filter. */
export function Combobox<T>({ label, items, getKey, render, filter, rank: relevance, onSelect, recentKeys = [], placeholder, value, renderValue, limit = 50, autoFocus }: ComboboxProps<T>) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q ? items.filter((i) => filter(i, q)) : items;
    const rank = (i: T) => {
      const r = recentKeys.indexOf(getKey(i));
      return r === -1 ? Infinity : r;
    };
    return [...matched].sort((a, b) => rank(a) - rank(b) || (q && relevance ? relevance(a, q) - relevance(b, q) : 0)).slice(0, limit);
  }, [items, query, recentKeys, filter, relevance, getKey, limit]);

  const choose = (item: T) => {
    onSelect(item);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-semibold text-muted">{label}</label>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
        autoFocus={autoFocus}
        placeholder={value && renderValue ? renderValue(value) : placeholder}
        className="h-10 rounded-md border border-border-strong bg-surface-1 px-3 text-text outline-none transition-colors duration-[var(--dur-1)] placeholder:text-muted focus:border-accent"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(results.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter' && open && results[active]) { e.preventDefault(); choose(results[active]!); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="se-enter absolute top-full z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface-2 p-1 shadow-overlay"
        >
          {results.map((item, i) => (
            <li
              key={getKey(item)}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn('cursor-pointer rounded-md px-3 py-2 text-sm', i === active ? 'bg-surface-3 text-text' : 'text-muted')}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
            >
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
