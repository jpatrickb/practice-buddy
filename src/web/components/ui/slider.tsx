import { Slider as SliderPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Draw a small notch at the middle of the track (used where the default sits mid-slider). */
  notch?: boolean;
  /** Track thickness class, e.g. "h-2". */
  trackClass?: string;
  /** Fill (any CSS background, e.g. a gradient); defaults to the primary color. */
  fill?: string;
  /** Solid color for the thumb glow; defaults to `fill`. */
  glow?: string;
  'aria-valuetext'?: string;
};

/**
 * shadcn Slider restyled: 44 px tall hit area, 28 px thumb, colored fill.
 * The accessible name and value text go on the thumb (the element with role=slider).
 */
export function Slider({
  className,
  notch,
  trackClass = 'h-2',
  fill,
  glow,
  'aria-label': ariaLabel,
  'aria-valuetext': valueText,
  value,
  defaultValue,
  ...props
}: SliderProps) {
  const count = (value ?? defaultValue ?? [0]).length;
  return (
    <div className={cn('relative flex w-full items-center', className)}>
      {notch && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-muted-foreground/60"
        />
      )}
      <SliderPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        className="relative z-10 flex min-h-11 w-full touch-none items-center select-none data-[disabled]:opacity-45"
        style={
          fill ? ({ '--fill': fill, '--glow': glow ?? fill } as React.CSSProperties) : undefined
        }
        {...props}
      >
        <SliderPrimitive.Track
          className={cn('relative grow overflow-hidden rounded-full bg-track', trackClass)}
        >
          <SliderPrimitive.Range className="absolute h-full [background:var(--fill,var(--primary))]" />
        </SliderPrimitive.Track>
        {Array.from({ length: count }, (_, i) => (
          <SliderPrimitive.Thumb
            key={i}
            aria-label={ariaLabel}
            aria-valuetext={valueText}
            className="block size-7 rounded-full bg-white shadow-[0_2px_8px_rgb(0_0_0/0.45),0_0_0_4px_color-mix(in_srgb,var(--glow,var(--primary))_35%,transparent)] transition-transform active:scale-110 disabled:pointer-events-none"
          />
        ))}
      </SliderPrimitive.Root>
    </div>
  );
}
