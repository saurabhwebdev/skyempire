/** Real Gregorian calendar: game day 0 is Jan 1 of the career's start year (UTC, no time zones). */
export const DAYS_PER_YEAR = 365;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MS_PER_DAY = 86_400_000;

export interface GameDate {
  year: number;
  month: number;
  dayOfMonth: number;
  dayOfYear: number;
  iso: string;
}

export function dateOf(day: number, startYear: number): GameDate {
  const d = new Date(Date.UTC(startYear, 0, 1) + day * MS_PER_DAY);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const dayOfMonth = d.getUTCDate();
  const dayOfYear = Math.round((d.getTime() - Date.UTC(year, 0, 1)) / MS_PER_DAY);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { year, month, dayOfMonth, dayOfYear, iso: `${year}-${pad(month)}-${pad(dayOfMonth)}` };
}

/** Game day of a real date in the career's calendar. */
export function dayOf(year: number, month: number, dayOfMonth: number, startYear: number): number {
  return Math.round((Date.UTC(year, month - 1, dayOfMonth) - Date.UTC(startYear, 0, 1)) / MS_PER_DAY);
}

export function isMonthStart(day: number, startYear: number): boolean {
  return dateOf(day, startYear).dayOfMonth === 1;
}

export function formatDate(day: number, startYear: number): string {
  const d = dateOf(day, startYear);
  return `${MONTHS[d.month - 1]} ${d.dayOfMonth}, ${d.year}`;
}

/** "Mar 2027" — month label for charts. */
export function formatMonth(day: number, startYear: number): string {
  const d = dateOf(day, startYear);
  return `${MONTHS[d.month - 1]} ${d.year}`;
}
