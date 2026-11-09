import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-[transform,background,border-color,opacity] duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        glass: 'bg-card-strong border border-border hover:bg-white/15',
        outline: 'border-[1.5px] border-border bg-transparent hover:border-muted-foreground',
        ghost: 'hover:bg-white/10',
      },
      size: {
        default: 'min-h-11 px-5 text-[0.9375rem]',
        compact: 'min-h-11 px-2 text-[0.9375rem]',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
