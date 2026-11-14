/**
 * Builds src/holidays.json: public holidays per country (day-of-year, 0 = Jan 1) and festival anchor dates, 2026–2045.
 * Source: date-holidays (ISC, offline). Lunar New Year is a hardcoded table because date-holidays' Chinese calendar
 * fails in Node 22; the data test checks every date against the new moon.
 * Run: node packages/data/scripts/build-holidays.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const Holidays = require('date-holidays') as new (country?: string) => {
  getHolidays(year: number): { date: string; name: string; type: string }[];
};

const ROOT = join(import.meta.dirname, '..');
const YEARS = Array.from({ length: 20 }, (_, i) => 2026 + i);

const LUNAR_NEW_YEAR: Record<number, string> = {
  2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03',
  2031: '2031-01-23', 2032: '2032-02-11', 2033: '2033-01-31', 2034: '2034-02-19', 2035: '2035-02-08',
  2036: '2036-01-28', 2037: '2037-02-15', 2038: '2038-02-04', 2039: '2039-01-24', 2040: '2040-02-12',
  2041: '2041-02-01', 2042: '2042-01-22', 2043: '2043-02-10', 2044: '2044-01-30', 2045: '2045-02-17',
};

/** Festival anchors read from one country whose data is reliable for that festival. */
const ANCHORS: Record<string, { country: string; match: RegExp }> = {
  eidFitr: { country: 'TT', match: /Eid al-Fitr/ },
  eidAdha: { country: 'GY', match: /Eid Ul Adha/ },
  diwali: { country: 'TT', match: /Deepavali/ },
  easter: { country: 'GB', match: /^Easter Sunday$/ },
  thanksgiving: { country: 'US', match: /^Thanksgiving Day$/ },
};

/** Diwali (Lakshmi Puja) is the new moon (Amavasya) of Kartika: the new moon between Oct 17 and Nov 15 (IST).
 * Used where date-holidays has no data; Meeus mean new moon, accurate to about a day. */
function diwaliByNewMoon(year: number): string {
  const from = Date.UTC(year, 9, 17) / 86_400_000, to = Date.UTC(year, 10, 15) / 86_400_000;
  const k0 = Math.floor((year + 9.5 / 12 - 2000) * 12.3685) - 2;
  for (let k = k0; k < k0 + 5; k++) {
    const T = k / 1236.85;
    const jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T;
    const dayIst = Math.floor(jde - 2440587.5 + 0.5 + 5.5 / 24); // days since 1970, Indian time
    if (dayIst >= from && dayIst <= to) return new Date(dayIst * 86_400_000).toISOString().slice(0, 10);
  }
  throw new Error(`no Kartika new moon in ${year}`);
}

const doy = (iso: string) => {
  const y = +iso.slice(0, 4);
  return Math.round((Date.UTC(y, +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(y, 0, 1)) / 86_400_000);
};

const airports = JSON.parse(readFileSync(join(ROOT, 'src', 'airports.world.json'), 'utf8')) as { country: string }[];
const countries = [...new Set(airports.map((a) => a.country))].sort();

const pub: Record<string, Record<number, number[]>> = {};
const failed: string[] = [];
for (const c of countries) {
  try {
    const hd = new Holidays(c);
    const byYear: Record<number, number[]> = {};
    let any = false;
    for (const y of YEARS) {
      const list = [...new Set(hd.getHolidays(y).filter((h) => h.type === 'public').map((h) => doy(h.date.slice(0, 10))))].sort((a, b) => a - b);
      byYear[y] = list;
      if (list.length) any = true;
    }
    if (any) pub[c] = byYear;
  } catch {
    failed.push(c);
  }
}

const anchors: Record<string, Record<number, string>> = { lunarNewYear: LUNAR_NEW_YEAR };
for (const [id, { country, match }] of Object.entries(ANCHORS)) {
  const hd = new Holidays(country);
  anchors[id] = {};
  for (const y of YEARS) {
    const h = hd.getHolidays(y).find((x) => match.test(x.name));
    if (h) anchors[id][y] = h.date.slice(0, 10);
    else if (id === 'diwali') anchors[id][y] = diwaliByNewMoon(y);
    else throw new Error(`${id}: no match in ${country} ${y}`);
  }
}

writeFileSync(join(ROOT, 'src', 'holidays.json'), JSON.stringify({ years: YEARS, public: pub, anchors }) + '\n');
console.log(`Wrote holidays for ${Object.keys(pub).length} countries; date-holidays failed for ${failed.join(', ') || 'none'}`);
