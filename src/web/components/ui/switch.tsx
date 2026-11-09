import { Switch as SwitchPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/** 58×34 toggle with a 44 px tap area (via the wrapping label row). */
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-[34px] w-[58px] shrink-0 items-center rounded-full bg-track transition-colors disabled:opacity-45 data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[26px] translate-x-1 rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(.3,1.4,.5,1)] data-[state=checked]:translate-x-[28px]" />
    </SwitchPrimitive.Root>
  );
}
