import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Panel({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('glass rounded-panel p-[18px]', className)}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
