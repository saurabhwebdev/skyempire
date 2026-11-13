import { Slider as RSlider } from 'radix-ui';
import { useId } from 'react';

export interface SliderProps {
  label: string;
  value: number;
  onChange(v: number): void;
  min: number;
  max: number;
  step?: number;
  format?(v: number): string;
}

export function Slider({ label, value, onChange, min, max, step = 1, format = String }: SliderProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span id={id} className="text-[13px] font-semibold text-muted">{label}</span>
        <span className="num text-sm text-text">{format(value)}</span>
      </div>
      <RSlider.Root
        aria-labelledby={id}
        className="relative flex h-5 w-full touch-none items-center"
        value={[value]}
        min={min}
        max={Math.max(min, max)}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? min)}
      >
        <RSlider.Track className="relative h-1 grow rounded-full bg-surface-3">
          <RSlider.Range className="absolute h-full rounded-full bg-accent" />
        </RSlider.Track>
        <RSlider.Thumb
          aria-label={label}
          className="block size-4 rounded-full border-2 border-accent bg-bg shadow transition-transform duration-[var(--dur-1)] hover:scale-110"
        />
      </RSlider.Root>
    </div>
  );
}
