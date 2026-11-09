import type { SVGProps } from 'react';

const base = { viewBox: '0 0 24 24', 'aria-hidden': true } as const;

export function Skip10({ dir, ...p }: { dir: 'back' | 'forward' } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={dir === 'forward' ? 'matrix(-1 0 0 1 24 0)' : undefined}
      >
        <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
        <path d="M4.2 3.5v4h4" />
      </g>
      <text
        x="12"
        y="15.2"
        fontSize="7.4"
        fontWeight="800"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="inherit"
      >
        10
      </text>
    </svg>
  );
}

export function PlayIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path
        d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PauseIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="currentColor" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="currentColor" />
    </svg>
  );
}
