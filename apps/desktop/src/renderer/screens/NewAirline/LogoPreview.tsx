import type { LogoShape } from '@skyempire/shared';

/** Simple brand mark used for the player's airline (custom logos come via the logo pack, Task 32). */
export function LogoMark({ shape, primary, secondary, size = 40 }: { shape: LogoShape; primary: string; secondary: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="8" fill={primary} />
      {shape === 'circle' && <circle cx="20" cy="20" r="9" fill={secondary} />}
      {shape === 'square' && <rect x="12" y="12" width="16" height="16" rx="2" fill={secondary} />}
      {shape === 'diamond' && <path d="M20 9 31 20 20 31 9 20Z" fill={secondary} />}
      {shape === 'wing' && <path d="M8 26c8-1 15-6 24-14-2 9-8 15-16 17-3 .7-6 .2-8-3Z" fill={secondary} />}
    </svg>
  );
}

/** Tail fin preview with the airline's colors and mark. */
export function TailPreview({ shape, primary, secondary, code }: { shape: LogoShape; primary: string; secondary: string; code: string }) {
  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-[280px]" role="img" aria-label="Tail preview">
      <path d="M40 150 L110 20 Q118 8 132 10 L170 14 L150 150Z" fill={primary} />
      <path d="M150 150 L40 150 L60 112 L158 112Z" fill="#000" opacity="0.12" />
      <g transform="translate(108 52) scale(1.3)">
        <LogoMark shape={shape} primary={primary} secondary={secondary} size={40} />
      </g>
      <text x="96" y="140" fill={secondary} fontFamily="JetBrains Mono, monospace" fontWeight="600" fontSize="14">{code}</text>
      <rect x="0" y="150" width="240" height="10" rx="2" fill="var(--surface-3)" />
    </svg>
  );
}
