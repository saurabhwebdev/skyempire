/**
 * Builds src/photos/<typeId>.webp and src/aircraft-photos.json: one real, freely licensed photo per aircraft type,
 * from Wikimedia Commons, with author and licence for the credit line (CC BY / CC BY-SA require it).
 * Files were picked by hand from Commons search and Wikidata (P18) images; this script downloads and resizes them.
 * Needs ffmpeg (WebP encoder). Run: node packages/data/scripts/build-aircraft-photos.ts [--keep-images] [typeId…]
 * --keep-images refreshes only the credits for images already on disk.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const UA = 'SkyEmpireBuild/1.0 (github.com/saurabhwebdev/skyempire)';
const WIDTH = 960;

/** Type id → Commons file name (without "File:"). */
export const PICKS: Record<string, string> = {
  AT46: 'ATR 42-600 ATR "House colors" F-WWLY - MSN 811 (9739866341).jpg',
  AT76: 'ATR 72-600 ATR house colors F-WWEY - MSN 98 retusche.jpg',
  DH8D: 'Porter Airlines (Dash8-400) 10.jpg',
  E175: 'SkyWest Airlines Embraer ERJ-175.jpg',
  E290: 'EGLF - Embraer E190-E2 - PR-ZGQ (42923565984).jpg',
  E295: 'Embraer E195-E2, Air Show 2019, Le Bourget (SIAE0873).jpg',
  CRJ9: 'Bombardier CRJ-900LR Lufthansa Cityline (LCL) D-ACKG - MSN 15084 - Named Glücksburg (3413607957).jpg',
  AJ27: 'A Transnusa Comac ARJ21-700 PK-TJA In Lombok international Airport indonesia.jpg',
  BCS1: 'Airbus A220-100 ‘HB-JBI’ Swiss International Air Lines (53751161228).jpg',
  BCS3: 'Frankfurt Airport airBaltic Airbus A220-300 YL-ABL (DSC09548).jpg',
  A319: 'Austrian Airlines, OE-LDB, Airbus A319-112 (44341899432).jpg',
  A320: 'Airbus A320-232 AirSERBIA YU-APH.JPG',
  A321: 'Lufthansa.a321-100.d-aire.arp.jpg',
  A19N: 'Airbus A319-151N, Airbus Industrie JP9105933.jpg',
  A20N: 'Airbus A320-271N NEO D-AVVA.jpg',
  A21N: 'Airbus Industrie A321neo D-AVXA (29428329122).jpg',
  A21X: 'F-WXLR, ILA 2024, Schoenefeld (ILA45378).jpg',
  B737: 'N730SW 737-7H4.jpg',
  B738: 'American Airlines, Boeing 737-823(WL), N969AN - LAX (22300501588).jpg',
  B38M: 'N8705Q - Boeing 737 MAX 8 - Southwest Airlines.jpg',
  B39M: 'Alaska 737-9 MAX N966AK on final approach to Boston Oct 2024 1.jpg',
  B3XM: 'N27751 B737 MAX 10, Boeing Field 09-15-26.jpg',
  C919: 'COMAC B-001A May 2017.jpg',
  B752: 'American Airlines Boeing 757-200 N605AA SJC.jpg',
  B763: 'Boeing 767-300ER (Japan Airlines) JA616J .jpg',
  A332: 'Turkish Airlines Airbus A330-200, SIN.jpg',
  A333: '9M-LFG - Batik Air Malaysia - Airbus A330-343 - MSN 1828 - VGHS.jpg',
  A339: 'Airbus A330neo first take-off (cropped).jpg',
  B788: 'Japan Airlines B787-8 (JA825J) @ NRT, July 2012.jpg',
  B789: 'Japan Airlines, Boeing 787-9 JA861J NRT (19455285040).jpg',
  B78X: 'United Airlines Boeing 787-10 on finals at Beijing Capital Airport.jpg',
  A359: 'EGLF - Airbus A350-941 - F-WZNW.jpg',
  A35K: 'G-XWBA LEMD 15-08-2019b.jpg',
  B772: 'Austrian Airlines B777-2Z9ER (OE-LPA) taxiing at Sydney Airport.jpg',
  B77W: 'Singapore Airlines Boeing 777-312ER 9V-SWK MUC 2015 03.jpg',
  B779: 'N779XX B777-9, Boeing, Boeing Field 09-15-26.jpg',
  A388: 'A6-EDY A380 Emirates 31 jan 2013 jfk (8442269364) (cropped).jpg',
  B748: 'Lufthansa Boeing 747-830 D-ABYL "Hessen" (29613598941).jpg',
};

export interface AircraftPhoto {
  file: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fetchOk(url: string): Promise<Response> {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return r;
      if (r.status !== 429 && r.status < 500) throw new Error(`${r.status} ${url}`);
    } catch (e) { if (i === 5) throw e; }
    await sleep(15000 * (i + 1));
  }
  throw new Error(`gave up: ${url}`);
}
const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

const keepImages = process.argv.includes('--keep-images');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const outPath = join(ROOT, 'src', 'aircraft-photos.json');
const existing = JSON.parse(readFileSync(outPath, 'utf8').trim() || '{}') as Record<string, AircraftPhoto>;
const photos: Record<string, AircraftPhoto> = only.length ? existing : {};
mkdirSync(join(ROOT, 'src', 'photos'), { recursive: true });
function save() {
  const sorted = Object.fromEntries(Object.entries(photos).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(outPath, JSON.stringify(sorted, null, 1) + '\n');
}
const tmp = mkdtempSync(join(tmpdir(), 'se-photos-'));

for (const [id, title] of Object.entries(PICKS)) {
  if (only.length && !only.includes(id)) continue;
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ action: 'query', format: 'json', titles: `File:${title}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(WIDTH * 2), iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|UsageTerms' })
    .forEach(([k, v]) => api.searchParams.set(k, v));
  const j = (await (await fetchOk(api.href)).json()) as { query: { pages: Record<string, { missing?: string; imageinfo?: { thumburl: string; descriptionurl: string; extmetadata: Record<string, { value: string }> }[] }> } };
  const page = Object.values(j.query.pages)[0]!;
  const info = page.imageinfo?.[0];
  if (!info) throw new Error(`${id}: missing on Commons: ${title}`);
  const license = info.extmetadata.LicenseShortName?.value ?? '';
  if (!/^(CC BY(-SA)? [\d.]+|CC0|Public domain)/i.test(license)) throw new Error(`${id}: licence not allowed: ${license}`);
  const out = join(ROOT, 'src', 'photos', `${id}.webp`);
  if (!(keepImages && existsSync(out))) {
    const src = join(tmp, `${id}.img`);
    writeFileSync(src, Buffer.from(await (await fetchOk(info.thumburl)).arrayBuffer()));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-vf', `scale=${WIDTH}:-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', '78', '-compression_level', '6', out]);
  }
  photos[id] = {
    file: `${id}.webp`,
    title,
    author: plain(info.extmetadata.Artist?.value ?? 'Unknown') || 'Unknown',
    license,
    licenseUrl: info.extmetadata.LicenseUrl?.value ?? '',
    source: info.descriptionurl,
  };
  console.log(id, license, '·', photos[id].author);
  save(); // keep progress if Commons rate-limits a later file
  await sleep(1500);
}
rmSync(tmp, { recursive: true, force: true });
save();
console.log(`Wrote ${Object.keys(photos).length} photos`);
