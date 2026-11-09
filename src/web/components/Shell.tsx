import { useEffect, type ReactNode } from 'react';

/** Sets the blurred backdrop hues (from the current cover); resets on unmount. */
export function useBackdrop(hues: { h1: number; h2: number } | null) {
  const h1 = hues?.h1 ?? 236;
  const h2 = hues?.h2 ?? 272;
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--h1', String(h1));
    root.style.setProperty('--h2', String(h2));
    return () => {
      root.style.removeProperty('--h1');
      root.style.removeProperty('--h2');
    };
  }, [h1, h2]);
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="orbs pointer-events-none fixed inset-0 overflow-hidden">
        <i />
        <i />
        <i />
      </div>
      <div className="relative z-10">{children}</div>
    </>
  );
}
