/** Multi-day travel peaks (v0.2 design §4). Peaks: 0.1 long weekend … 0.8 Chunyun / Christmas. */
export interface Festival {
  id: string;
  name: string;
  countries: readonly string[];
  /** A holidays.json anchor id, or a fixed month/day. */
  anchor: string | { month: number; day: number };
  /** Window = [anchor − before, anchor + after] days. */
  before: number;
  after: number;
  peak: number;
}

const EUROPE = ['AL', 'AD', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'SM', 'UA', 'GE', 'AM'];
const AMERICAS = ['AG', 'AR', 'BB', 'BO', 'BR', 'BS', 'BZ', 'CA', 'CL', 'CO', 'CR', 'CU', 'DM', 'DO', 'EC', 'GD', 'GT', 'GY', 'HN', 'HT', 'JM', 'KN', 'LC', 'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SR', 'SV', 'TT', 'US', 'UY', 'VC', 'VE'];
const CHRISTIAN_OTHER = ['AU', 'NZ', 'PH', 'ZA', 'NG', 'KE', 'GH', 'UG', 'TZ', 'ZM', 'ZW', 'AO', 'CD', 'CM', 'ET', 'MW', 'NA', 'BW', 'RW', 'MZ', 'MG', 'FJ', 'PG', 'TL'];
const CHRISTIAN = [...EUROPE, ...AMERICAS, ...CHRISTIAN_OTHER];
const MUSLIM = ['AE', 'AF', 'AZ', 'BD', 'BH', 'BN', 'DJ', 'DZ', 'EG', 'GM', 'GN', 'ID', 'IQ', 'IR', 'JO', 'KG', 'KM', 'KW', 'KZ', 'LB', 'LY', 'MA', 'MV', 'ML', 'MR', 'MY', 'NE', 'OM', 'PK', 'PS', 'QA', 'SA', 'SD', 'SN', 'SO', 'SY', 'TD', 'TJ', 'TM', 'TN', 'TR', 'UZ', 'YE'];

export const FESTIVALS: readonly Festival[] = [
  { id: 'christmas', name: 'Christmas & New Year', countries: CHRISTIAN, anchor: { month: 12, day: 24 }, before: 4, after: 12, peak: 0.8 },
  { id: 'lunar-new-year', name: 'Lunar New Year', countries: ['CN', 'TW', 'HK', 'MO', 'SG', 'VN', 'KR', 'MY'], anchor: 'lunarNewYear', before: 10, after: 10, peak: 0.8 },
  { id: 'diwali', name: 'Diwali', countries: ['IN', 'NP', 'TT', 'MU', 'FJ', 'GY', 'SR'], anchor: 'diwali', before: 3, after: 4, peak: 0.5 },
  { id: 'eid-al-fitr', name: 'Eid al-Fitr', countries: MUSLIM, anchor: 'eidFitr', before: 2, after: 4, peak: 0.5 },
  { id: 'eid-al-adha', name: 'Eid al-Adha', countries: MUSLIM, anchor: 'eidAdha', before: 2, after: 4, peak: 0.4 },
  { id: 'ramadan', name: 'Ramadan', countries: MUSLIM, anchor: 'eidFitr', before: 29, after: -1, peak: -0.15 },
  { id: 'easter', name: 'Easter', countries: CHRISTIAN, anchor: 'easter', before: 3, after: 2, peak: 0.3 },
  { id: 'golden-week-jp', name: 'Golden Week', countries: ['JP'], anchor: { month: 4, day: 29 }, before: 0, after: 7, peak: 0.5 },
  { id: 'golden-week-cn', name: 'National Day Golden Week', countries: ['CN'], anchor: { month: 10, day: 1 }, before: 0, after: 7, peak: 0.6 },
  { id: 'thanksgiving', name: 'Thanksgiving', countries: ['US'], anchor: 'thanksgiving', before: 1, after: 4, peak: 0.4 },
  { id: 'southern-summer', name: 'Summer holidays', countries: ['AU', 'NZ', 'ZA', 'AR', 'BR', 'CL', 'UY'], anchor: { month: 12, day: 20 }, before: 0, after: 40, peak: 0.2 },
];
