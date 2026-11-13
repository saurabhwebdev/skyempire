export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = 360;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateOf(day: number): { year: number; month: number; dayOfMonth: number; dayOfYear: number } {
  const dayOfYear = day % DAYS_PER_YEAR;
  return {
    year: Math.floor(day / DAYS_PER_YEAR) + 1,
    month: Math.floor(dayOfYear / DAYS_PER_MONTH) + 1,
    dayOfMonth: (dayOfYear % DAYS_PER_MONTH) + 1,
    dayOfYear,
  };
}

export function isMonthStart(day: number): boolean {
  return day % DAYS_PER_MONTH === 0;
}

export function formatDate(day: number): string {
  const d = dateOf(day);
  return `${MONTHS[d.month - 1]} ${d.dayOfMonth} Y${d.year}`;
}
