/**
 * PlayingCard — a crisp SVG card (viewBox 100×140): corner indices, proper pip layouts for
 * A–10, court-card panels with lettering for J/Q/K, red/black suits drawn as paths (no font
 * dependency), a patterned face-down back, and `rotated` for sideways third cards.
 */
import { useId, type CSSProperties, type ReactNode } from 'react';
import type { Card, Rank, Suit } from '@/engine';
import { cx } from '../cx';
import styles from './PlayingCard.module.css';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Card widths in px by named size (height = width × 1.4). */
export const CARD_SIZES: Readonly<Record<CardSize, number>> = { xs: 40, sm: 54, md: 70, lg: 92, xl: 118 };
export const CARD_ASPECT = 1.4;

export const SUIT_NAMES: Readonly<Record<Suit, string>> = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
export const SUIT_SYMBOLS: Readonly<Record<Suit, string>> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const RANK_NAMES: Readonly<Record<Rank, string>> = {
  A: 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
  T: 'Ten', J: 'Jack', Q: 'Queen', K: 'King',
};

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

/** "10" for T, otherwise the rank letter/digit. */
export function rankText(rank: Rank): string {
  return rank === 'T' ? '10' : rank;
}

/** "Seven of Hearts" */
export function cardName(card: Pick<Card, 'rank' | 'suit'>): string {
  return `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}

/** Short label: "7♥", "10♠", "K♦". */
export function cardShortLabel(card: Pick<Card, 'rank' | 'suit'>): string {
  return `${rankText(card.rank)}${SUIT_SYMBOLS[card.suit]}`;
}

/* ---- suit shapes: each drawn in a 100×100 box centred on the origin --------------------- */

function SuitShape({ suit }: { suit: Suit }): ReactNode {
  switch (suit) {
    case 'H':
      return (
        <path d="M0 42 C-9 31 -48 10 -48 -16 C-48 -34 -35 -46 -22 -46 C-12 -46 -4 -40 0 -32 C4 -40 12 -46 22 -46 C35 -46 48 -34 48 -16 C48 10 9 31 0 42 Z" />
      );
    case 'D':
      return <path d="M0 -48 C9 -30 23 -14 38 0 C23 14 9 30 0 48 C-9 30 -23 14 -38 0 C-23 -14 -9 -30 0 -48 Z" />;
    case 'S':
      return (
        <path d="M0 -46 C8 -34 46 -10 46 14 C46 30 35 40 24 40 C15 40 7 35 3 27 C4 37 9 45 17 49 L-17 49 C-9 45 -4 37 -3 27 C-7 35 -15 40 -24 40 C-35 40 -46 30 -46 14 C-46 -10 -8 -34 0 -46 Z" />
      );
    case 'C':
    default:
      return (
        <g>
          <circle cx="0" cy="-26" r="20" />
          <circle cx="-22" cy="10" r="20" />
          <circle cx="22" cy="10" r="20" />
          <path d="M-5 -4 C-5 18 -11 38 -19 48 L19 48 C11 38 5 18 5 -4 Z" />
          <circle cx="0" cy="4" r="12" />
        </g>
      );
  }
}

function Pip({ suit, x, y, size, inverted }: { suit: Suit; x: number; y: number; size: number; inverted?: boolean }): ReactNode {
  const t = `translate(${x} ${y}) ${inverted ? 'rotate(180) ' : ''}scale(${(size / 100).toFixed(4)})`;
  return (
    <g transform={t}>
      <SuitShape suit={suit} />
    </g>
  );
}

/* ---- pip layouts (x column, t = 0..1 down the pip area; t > 0.5 is drawn inverted) ------- */

const L = 33;
const C = 50;
const R = 67;
const PIP_TOP = 27;
const PIP_SPAN = 86;
const yOf = (t: number): number => PIP_TOP + PIP_SPAN * t;

const PIP_LAYOUT: Readonly<Record<Rank, ReadonlyArray<readonly [number, number]>>> = {
  A: [[C, 0.5]],
  '2': [[C, 0], [C, 1]],
  '3': [[C, 0], [C, 0.5], [C, 1]],
  '4': [[L, 0], [R, 0], [L, 1], [R, 1]],
  '5': [[L, 0], [R, 0], [C, 0.5], [L, 1], [R, 1]],
  '6': [[L, 0], [R, 0], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  '7': [[L, 0], [R, 0], [C, 0.25], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  '8': [[L, 0], [R, 0], [C, 0.25], [L, 0.5], [R, 0.5], [C, 0.75], [L, 1], [R, 1]],
  '9': [[L, 0], [R, 0], [L, 1 / 3], [R, 1 / 3], [C, 0.5], [L, 2 / 3], [R, 2 / 3], [L, 1], [R, 1]],
  T: [[L, 0], [R, 0], [C, 1 / 6], [L, 1 / 3], [R, 1 / 3], [L, 2 / 3], [R, 2 / 3], [C, 5 / 6], [L, 1], [R, 1]],
  J: [],
  Q: [],
  K: [],
};

const COURT_TITLES: Readonly<Record<'J' | 'Q' | 'K', string>> = { J: 'JACK', Q: 'QUEEN', K: 'KING' };

function CourtPanel({ rank, suit, hatchId }: { rank: 'J' | 'Q' | 'K'; suit: Suit; hatchId: string }): ReactNode {
  return (
    <g className={styles.court}>
      <rect x="23" y="23" width="54" height="94" rx="3" className={styles.courtFrame} fill={`url(#${hatchId})`} />
      <rect x="26.5" y="26.5" width="47" height="87" rx="2" className={styles.courtInner} />
      <Pip suit={suit} x={33.5} y={35} size={10} />
      <Pip suit={suit} x={66.5} y={105} size={10} inverted />
      <text x="50" y="84" textAnchor="middle" className={styles.courtLetter}>
        {rank}
      </text>
      <text x="50" y="100" textAnchor="middle" className={styles.courtTitle}>
        {COURT_TITLES[rank]}
      </text>
      <path d="M38 44 H62 M50 40 V48" className={styles.courtOrnament} />
      <path d="M38 96 H62" className={styles.courtOrnament} />
    </g>
  );
}

function Face({ card, hatchId }: { card: Pick<Card, 'rank' | 'suit'>; hatchId: string }): ReactNode {
  const { rank, suit } = card;
  const red = isRedSuit(suit);
  const colorClass = red ? styles.red : styles.black;
  const text = rankText(rank);
  const isCourt = rank === 'J' || rank === 'Q' || rank === 'K';
  const pipSize = rank === 'A' ? 46 : 17;

  const index = (
    <g>
      <text x="13" y="22" textAnchor="middle" className={cx(styles.rank, text.length > 1 && styles.rankWide)}>
        {text}
      </text>
      <Pip suit={suit} x={13} y={34} size={12} />
    </g>
  );

  return (
    <g className={colorClass}>
      {index}
      <g transform="rotate(180 50 70)">{index}</g>
      {isCourt ? (
        <CourtPanel rank={rank} suit={suit} hatchId={hatchId} />
      ) : (
        PIP_LAYOUT[rank].map(([x, t], i) => <Pip key={i} suit={suit} x={x} y={yOf(t)} size={pipSize} inverted={t > 0.5} />)
      )}
    </g>
  );
}

function Back({ patternId }: { patternId: string }): ReactNode {
  return (
    <g>
      <rect x="5" y="5" width="90" height="130" rx="5" className={styles.backPlate} />
      <rect x="8" y="8" width="84" height="124" rx="4" fill={`url(#${patternId})`} className={styles.backLattice} />
      <rect x="8" y="8" width="84" height="124" rx="4" className={styles.backTrim} />
      <ellipse cx="50" cy="70" rx="22" ry="31" className={styles.backMedallion} />
      <ellipse cx="50" cy="70" rx="18" ry="26" className={styles.backMedallionInner} />
      <path d="M50 54 L60 70 L50 86 L40 70 Z" className={styles.backOrnament} />
      <circle cx="50" cy="70" r="3.2" className={styles.backOrnamentDot} />
    </g>
  );
}

export interface PlayingCardProps {
  /** The card to show. Omit/null with `faceDown` false renders an empty slot outline. */
  card?: Pick<Card, 'rank' | 'suit'> | null;
  faceDown?: boolean;
  /** Third cards are placed sideways (rotated 90° clockwise), as dealers do. */
  rotated?: boolean;
  /** Named size or an explicit width in px. */
  size?: CardSize | number;
  /** Gold glow (e.g. the card that made the Dragon 7). */
  highlight?: boolean;
  dimmed?: boolean;
  /** Accessible name override. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function PlayingCard({ card, faceDown = false, rotated = false, size = 'md', highlight, dimmed, label, className, style }: PlayingCardProps): ReactNode {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const hatchId = `card-hatch-${uid}`;
  const patternId = `card-back-${uid}`;

  const width = typeof size === 'number' ? size : CARD_SIZES[size];
  const height = Math.round(width * CARD_ASPECT);
  const w = rotated ? height : width;
  const h = rotated ? width : height;
  const viewBox = rotated ? '0 0 140 100' : '0 0 100 140';

  const empty = !faceDown && !card;
  const name = label ?? (faceDown ? 'Face-down card' : card ? cardName(card) : 'Empty card slot');

  const cssVars = { '--card-w': `${width}px` } as CSSProperties;

  return (
    <svg
      className={cx(styles.card, empty && styles.empty, faceDown && styles.faceDown, highlight && styles.highlight, dimmed && styles.dimmed, rotated && styles.rotated, className)}
      style={{ ...cssVars, ...style }}
      width={w}
      height={h}
      viewBox={viewBox}
      role="img"
      aria-label={name}
      data-card={card && !faceDown ? `${card.rank}${card.suit}` : undefined}
      data-face-down={faceDown || undefined}
      data-rotated={rotated || undefined}
    >
      <defs>
        <pattern id={hatchId} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <path d="M0 3 H6" className={styles.hatchLine} />
        </pattern>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="11" height="11" patternTransform="rotate(45)">
          <path d="M0 5.5 H11 M5.5 0 V11" className={styles.latticeLine} />
        </pattern>
      </defs>
      <g transform={rotated ? 'translate(140 0) rotate(90)' : undefined}>
        {empty ? (
          <rect x="1.5" y="1.5" width="97" height="137" rx="7" className={styles.slotOutline} />
        ) : (
          <>
            <rect x="0.75" y="0.75" width="98.5" height="138.5" rx="7" className={styles.paper} />
            {faceDown ? <Back patternId={patternId} /> : card ? <Face card={card} hatchId={hatchId} /> : null}
          </>
        )}
      </g>
    </svg>
  );
}
