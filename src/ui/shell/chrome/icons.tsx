/** Small inline icons for the shell (currentColor, 20×20 viewBox). */
import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export function CardsIcon(props: IconProps): ReactNode {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="11" height="15" rx="1.8" transform="rotate(-8 8.5 12.5)" />
      <rect x="10" y="4" width="11" height="15" rx="1.8" transform="rotate(8 15.5 11.5)" />
      <path d="M15.5 9.5l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BookIcon(props: IconProps): ReactNode {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
      <path d="M9 7h7M9 10.5h7" />
    </svg>
  );
}

export function FlaskIcon(props: IconProps): ReactNode {
  return (
    <svg {...base} {...props}>
      <path d="M9 3h6M10 3v6.2L4.6 18.3A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.7L14 9.2V3" />
      <path d="M7.5 15h9" />
    </svg>
  );
}

export function GearIcon(props: IconProps): ReactNode {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function SoundOnIcon(props: IconProps): ReactNode {
  return (
    <svg {...base} {...props}>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18.3 6a8.3 8.3 0 0 1 0 12" />
    </svg>
  );
}

export function SoundOffIcon(props: IconProps): ReactNode {
  return (
    <svg {...base} {...props}>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" stroke="none" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </svg>
  );
}

export function ChipIcon(props: IconProps): ReactNode {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" strokeDasharray="2.5 2" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}
