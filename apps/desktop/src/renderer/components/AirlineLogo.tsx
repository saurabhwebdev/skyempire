import { useState } from 'react';
import { useGameStore } from '../store';

/** Readable text color on a brand color (WCAG relative luminance). */
function inkOn(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.35 ? '#11151c' : '#ffffff';
}

/**
 * Airline logo from the player's logo folder (downloaded pack or their own files).
 * Falls back to a badge: the airline code on its brand color.
 */
export function AirlineLogo({ code, name, color, size = 24, file }: { code: string; name: string; color: string; size?: 16 | 24 | 40 | 56; file?: string }) {
  const version = useGameStore((s) => s.logoVersion);
  const [failed, setFailed] = useState<string | null>(null);
  const src = `skyempire-logo://logo/${file ?? code}.png?v=${version}`;
  const box = { width: size, height: size };
  if (failed === src)
    return (
      <span role="img" aria-label={name} style={{ ...box, background: color, color: inkOn(color), fontSize: size <= 16 ? 7 : size <= 24 ? 9 : 13 }}
        className="inline-grid shrink-0 place-items-center rounded-md font-mono font-semibold leading-none">
        {code}
      </span>
    );
  return (
    <span className="inline-grid shrink-0 place-items-center overflow-hidden rounded-md bg-white p-0.5" style={box}>
      <img src={src} alt={name} width={size - 4} height={size - 4} className="max-h-full max-w-full object-contain" onError={() => setFailed(src)} />
    </span>
  );
}
