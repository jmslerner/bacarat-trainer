/**
 * BonusMedallion — the inline SVG medallions of the two side bets: a red and gold disc with a gold serpentine
 * dragon curling over a large 7, and a panda face on a pearl disc with a bamboo-green badge 8. Drawn in a 120×120
 * box; gradient ids are unique per instance so several medallions can share a page (banner, history rows).
 */
import { useId, type ReactNode } from 'react';
import { cx } from '@/ui/shell';
import type { BonusKind } from '../animation/types';

export interface BonusMedallionProps {
  kind: BonusKind;
  /** Rendered width and height in px (default 96). */
  size?: number;
  className?: string;
  /** Accessible name; omitted = decorative. */
  title?: string;
}

/**
 * The dragon's spine, from the back of its head (upper left) down and around under the 7, up behind it and out to
 * the tail at the upper right. Drawn as three strokes of falling width so the body tapers toward the tail.
 */
const DRAGON_SPINE = [
  { d: 'M30 41 C16 46 10 60 20 72', width: 9.5 },
  { d: 'M20 72 C30 86 62 90 80 78', width: 7.5 },
  { d: 'M80 78 C94 68 96 50 86 38', width: 5.5 },
] as const;
const DRAGON_SHINE = 'M30 39 C18 44 13 58 22 70 C32 83 61 87 78 76 C91 67 93 51 85 40';

export function BonusMedallion({ kind, size = 96, className, title }: BonusMedallionProps): ReactNode {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string): string => `bm-${uid}-${name}`;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 120 120',
    className: cx(className),
    role: title ? 'img' : undefined,
    'aria-hidden': title ? undefined : true,
    'aria-label': title,
    'data-medallion': kind,
  } as const;

  if (kind === 'dragon7') {
    return (
      <svg {...common}>
        <defs>
          <radialGradient id={id('disc')} cx="50%" cy="38%" r="65%">
            <stop offset="0" stopColor="#c2222f" />
            <stop offset="0.55" stopColor="#8e1020" />
            <stop offset="1" stopColor="#3d060d" />
          </radialGradient>
          <linearGradient id={id('gold')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6cf" />
            <stop offset="0.45" stopColor="#f1d678" />
            <stop offset="0.72" stopColor="#d4af37" />
            <stop offset="1" stopColor="#8c6d1f" />
          </linearGradient>
          <linearGradient id={id('rim')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff3c4" />
            <stop offset="0.5" stopColor="#b08a24" />
            <stop offset="1" stopColor="#f6e2a0" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="58" fill={`url(#${id('rim')})`} />
        <circle cx="60" cy="60" r="53" fill={`url(#${id('disc')})`} />
        <circle cx="60" cy="60" r="48.5" fill="none" stroke={`url(#${id('gold')})`} strokeWidth="1.3" opacity="0.85" />
        <circle cx="60" cy="60" r="46" fill="none" stroke="#2a050a" strokeWidth="0.8" opacity="0.5" />
        {/* the dragon's body coils behind the 7: shadow, tapering body, the shine along its back, dorsal fins */}
        {DRAGON_SPINE.map((seg) => (
          <path key={`s-${seg.d}`} d={seg.d} fill="none" stroke="#2a050a" strokeWidth={seg.width + 3} strokeLinecap="round" opacity="0.5" />
        ))}
        {DRAGON_SPINE.map((seg) => (
          <path key={seg.d} d={seg.d} fill="none" stroke={`url(#${id('gold')})`} strokeWidth={seg.width} strokeLinecap="round" />
        ))}
        <path d={DRAGON_SHINE} fill="none" stroke="#fff6cf" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <path d="M14 58 l-8 -1 l6 -5 Z M15 72 l-8 3 l4 -8 Z M30 86 l-5 7 l-1 -9 Z M52 92 l-1 8 l-5 -7 Z M76 84 l4 8 l-8 -2 Z M94 66 l8 2 l-6 5 Z M94 50 l7 -4 l-2 8 Z" fill={`url(#${id('gold')})`} stroke="#2a050a" strokeWidth="0.8" strokeLinejoin="round" />
        {/* the tail: a flame-shaped fin */}
        <path d="M86 38 C90 30 98 26 106 28 C100 32 96 36 94 44 Z" fill={`url(#${id('gold')})`} stroke="#2a050a" strokeWidth="0.9" strokeLinejoin="round" />
        {/* the 7 in front of the coil, with a dark keyline so it reads on the red */}
        <text x="60" y="88" textAnchor="middle" fontFamily="Cinzel, 'Trajan Pro', 'Times New Roman', Georgia, serif" fontSize="56" fontWeight="800" fill={`url(#${id('gold')})`} stroke="#3a0710" strokeWidth="1.3" paintOrder="stroke">
          7
        </text>
        {/* the head, upper left, snout toward the pearl: mane, horns, upper head and open jaw, eye */}
        <path d="M30 30 L15 25 L26 36 Z M29 40 L14 40 L27 46 Z" fill={`url(#${id('gold')})`} stroke="#2a050a" strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M38 26 C34 19 26 15 18 17 M45 25 C44 16 38 10 31 10" fill="none" stroke="#2a050a" strokeWidth="4.4" strokeLinecap="round" opacity="0.5" />
        <path d="M38 26 C34 19 26 15 18 17 M45 25 C44 16 38 10 31 10" fill="none" stroke={`url(#${id('gold')})`} strokeWidth="3" strokeLinecap="round" />
        <path d="M28 30 C30 23 42 21 52 26 L64 32 C60 35 54 36 48 36 L32 38 C29 37 27 34 28 30 Z" fill={`url(#${id('gold')})`} stroke="#2a050a" strokeWidth="1" strokeLinejoin="round" />
        <path d="M33 39 L50 38 C56 38 61 41 63 45 C56 45 48 45 41 45 C36 45 33 43 33 39 Z" fill={`url(#${id('gold')})`} stroke="#2a050a" strokeWidth="1" strokeLinejoin="round" />
        <path d="M50 36 L52 38.5 M56 36.5 L57.5 39" stroke="#2a050a" strokeWidth="1" strokeLinecap="round" />
        <circle cx="42" cy="29.5" r="2.3" fill="#2a050a" />
        <circle cx="42.8" cy="28.8" r="0.8" fill="#fff6cf" />
        <path d="M64 33 C70 31 74 32 78 36 M63 44 C68 46 72 50 73 55" fill="none" stroke={`url(#${id('gold')})`} strokeWidth="1.6" strokeLinecap="round" />
        {/* the pearl it chases */}
        <circle cx="74" cy="24" r="8" fill="#fff8e1" opacity="0.2" />
        <circle cx="74" cy="24" r="4.2" fill="#fff8e1" />
        <circle cx="72.6" cy="22.6" r="1.4" fill="#ffffff" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <defs>
        <radialGradient id={id('pearl')} cx="50%" cy="35%" r="65%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#efeef4" />
          <stop offset="1" stopColor="#c5c4cf" />
        </radialGradient>
        <linearGradient id={id('rim')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#a3a3ae" />
          <stop offset="1" stopColor="#f6f5fa" />
        </linearGradient>
        <linearGradient id={id('leaf')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fd68e" />
          <stop offset="1" stopColor="#1c6b3b" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill={`url(#${id('rim')})`} />
      <circle cx="60" cy="60" r="53" fill={`url(#${id('pearl')})`} />
      <circle cx="60" cy="60" r="48.5" fill="none" stroke="#161616" strokeWidth="1" opacity="0.3" />
      {/* bamboo leaves behind the face */}
      <path d="M18 84 C24 70 38 65 52 70 C46 82 32 90 18 84 Z" fill={`url(#${id('leaf')})`} opacity="0.9" />
      <path d="M102 84 C96 70 82 65 68 70 C74 82 88 90 102 84 Z" fill={`url(#${id('leaf')})`} opacity="0.9" />
      <path d="M22 83 C30 76 40 72 50 71 M98 83 C90 76 80 72 70 71" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.5" />
      {/* ears */}
      <circle cx="37" cy="36" r="11.5" fill="#161616" />
      <circle cx="83" cy="36" r="11.5" fill="#161616" />
      <circle cx="37" cy="36" r="5" fill="#3a3a3a" opacity="0.7" />
      <circle cx="83" cy="36" r="5" fill="#3a3a3a" opacity="0.7" />
      {/* face */}
      <circle cx="60" cy="58" r="28" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1.2" />
      <ellipse cx="49" cy="56" rx="8.5" ry="10.5" transform="rotate(-20 49 56)" fill="#161616" />
      <ellipse cx="71" cy="56" rx="8.5" ry="10.5" transform="rotate(20 71 56)" fill="#161616" />
      <circle cx="50.5" cy="57.5" r="3.6" fill="#ffffff" />
      <circle cx="69.5" cy="57.5" r="3.6" fill="#ffffff" />
      <circle cx="51" cy="58" r="2" fill="#161616" />
      <circle cx="69" cy="58" r="2" fill="#161616" />
      <circle cx="51.9" cy="57.1" r="0.7" fill="#ffffff" />
      <circle cx="69.9" cy="57.1" r="0.7" fill="#ffffff" />
      <path d="M56 68.5 h8 l-4 4.5 Z" fill="#161616" />
      <path d="M60 73 v2.5 M60 75.5 q-4.5 4 -8 0.5 M60 75.5 q4.5 4 8 0.5" fill="none" stroke="#161616" strokeWidth="1.6" strokeLinecap="round" />
      {/* the green badge 8 */}
      <circle cx="90" cy="90" r="17.5" fill={`url(#${id('leaf')})`} stroke="#ffffff" strokeWidth="2.6" />
      <circle cx="90" cy="90" r="13.8" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.6" />
      <text x="90" y="97.5" textAnchor="middle" fontFamily="Cinzel, 'Trajan Pro', 'Times New Roman', Georgia, serif" fontSize="22" fontWeight="800" fill="#ffffff" stroke="#145a30" strokeWidth="0.6" paintOrder="stroke">
        8
      </text>
    </svg>
  );
}
