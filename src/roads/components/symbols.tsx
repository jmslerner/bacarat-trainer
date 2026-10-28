import type { Outcome } from '@/engine';
import { BONUS_GLYPH, bonusHitLabel, bonusHitTitle, type BonusKind } from '../bonus';
import type { BeadCell, BigRoadCell, DerivedCell, DerivedKind, RoadColor } from '../types';
import styles from './roads.module.css';

/** Size of one grid cell in SVG user units. */
export const CELL = 20;

export function cls(...names: (string | false | null | undefined)[]): string | undefined {
  const out = names.filter((n): n is string => typeof n === 'string' && n.length > 0);
  return out.length > 0 ? out.join(' ') : undefined;
}

export function cellCenter(col: number, row: number): { cx: number; cy: number } {
  return { cx: (col - 0.5) * CELL, cy: (row - 0.5) * CELL };
}

export const OUTCOME_LETTER: Record<Outcome, string> = { player: 'P', banker: 'B', tie: 'T' };
export const OUTCOME_NAME: Record<Outcome, string> = { player: 'Player', banker: 'Banker', tie: 'Tie' };

const OUTCOME_STROKE: Record<Outcome, string> = { player: styles.player, banker: styles.banker, tie: styles.tie };
const OUTCOME_FILL: Record<Outcome, string> = {
  player: styles.playerFill,
  banker: styles.bankerFill,
  tie: styles.tieFill,
};
const COLOR_STROKE: Record<RoadColor, string> = { red: styles.banker, blue: styles.player };
const COLOR_FILL: Record<RoadColor, string> = { red: styles.bankerFill, blue: styles.playerFill };

interface PairDotsProps {
  cx: number;
  cy: number;
  offset: number;
  playerPair: boolean;
  bankerPair: boolean;
}

/** Small pair markers: blue dot top-left = Player Pair, red dot bottom-right = Banker Pair. */
export function PairDots({ cx, cy, offset, playerPair, bankerPair }: PairDotsProps) {
  if (!playerPair && !bankerPair) return null;
  return (
    <>
      {playerPair && (
        <circle
          className={cls(styles.playerFill, styles.pairDot)}
          cx={cx - offset}
          cy={cy - offset}
          r={2.2}
          data-pair="player"
        />
      )}
      {bankerPair && (
        <circle
          className={cls(styles.bankerFill, styles.pairDot)}
          cx={cx + offset}
          cy={cy + offset}
          r={2.2}
          data-pair="banker"
        />
      )}
    </>
  );
}

/* --- Dragon 7 / Panda 8 ------------------------------------------------------------------------------ */

export interface BonusBadgeProps {
  kind: BonusKind;
  cx: number;
  cy: number;
  r: number;
  /** Dark outline that separates the badge from whatever it sits on (default true; off for stand-alone icons). */
  outline?: boolean;
  /** A small highlight for a metallic look (icons only: it is noise at corner-badge size). */
  sheen?: boolean;
}

/**
 * Self-contained mini medallion: a gold disc with an ink "7" (Dragon 7) or a pearl-rimmed bamboo-green disc with a
 * pearl "8" (Panda 8). Used as the big-road corner badge, the counter icons and the bonus-history chips.
 */
export function BonusBadge({ kind, cx, cy, r, outline = true, sheen = false }: BonusBadgeProps) {
  return (
    <g className={kind === 'dragon7' ? styles.badgeDragon : styles.badgePanda} data-badge={kind}>
      {outline && <circle className={styles.badgeOutline} cx={cx} cy={cy} r={r + 0.9} />}
      <circle className={styles.badgeFace} cx={cx} cy={cy} r={r} />
      <circle className={styles.badgeRim} cx={cx} cy={cy} r={r * 0.9} fill="none" strokeWidth={r * 0.16} />
      {sheen && <ellipse className={styles.badgeSheen} cx={cx - r * 0.28} cy={cy - r * 0.42} rx={r * 0.4} ry={r * 0.18} />}
      <text className={cls(styles.letter, styles.badgeGlyph)} x={cx} y={cy + r * 0.08} fontSize={r * 1.45}>
        {BONUS_GLYPH[kind]}
      </text>
    </g>
  );
}

/** Expanding ring on the newest hit cell (three cycles; hidden under prefers-reduced-motion). */
export function HitPulse({ kind, cx, cy, r }: { kind: BonusKind; cx: number; cy: number; r: number }) {
  return (
    <circle
      className={cls(styles.hitPulse, kind === 'dragon7' ? styles.pulseDragon : styles.pulsePanda)}
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      strokeWidth={1.6}
      data-hit-pulse={kind}
      aria-hidden="true"
    />
  );
}

export interface BeadSymbolProps {
  cell: BeadCell;
  /** True for the newest hand: a Dragon 7 / Panda 8 then pulses. */
  latest?: boolean;
}

/**
 * Bead plate symbol: solid disc with the letter. A Dragon 7 turns the Banker bead into a medallion (amber ring and
 * halo, bold gold "7"); a Panda 8 gives the Player bead a pearl ring and a bold "8" on a bamboo-green badge. Pair
 * dots stay on top.
 */
export function BeadSymbol({ cell, latest = false }: BeadSymbolProps) {
  const { cx, cy } = cellCenter(cell.col, cell.row);
  const bonus: BonusKind | null = cell.dragon7 ? 'dragon7' : cell.panda8 ? 'panda8' : null;
  const pairs = <PairDots cx={cx} cy={cy} offset={6.1} playerPair={cell.playerPair} bankerPair={cell.bankerPair} />;
  if (bonus === null) {
    return (
      <g data-bead={cell.handIndex} data-outcome={cell.outcome}>
        <circle className={OUTCOME_FILL[cell.outcome]} cx={cx} cy={cy} r={7.5} />
        <text className={cls(styles.letter, styles.ivoryFill)} x={cx} y={cy + 0.4} fontSize={8.6}>
          {OUTCOME_LETTER[cell.outcome]}
        </text>
        {pairs}
      </g>
    );
  }
  const hand = cell.handIndex + 1;
  return (
    <g
      className={bonus === 'dragon7' ? styles.medalDragon : styles.medalPanda}
      data-bead={cell.handIndex}
      data-outcome={cell.outcome}
      data-bonus={BONUS_GLYPH[bonus]}
      data-medallion={bonus}
      role="img"
      aria-label={bonusHitLabel(bonus, hand)}
    >
      <title>{bonusHitTitle(bonus, hand)}</title>
      <circle className={styles.medalHalo} cx={cx} cy={cy} r={9.9} fill="none" strokeWidth={1.8} />
      <circle className={styles.medalRing} cx={cx} cy={cy} r={8.9} fill="none" strokeWidth={1.4} />
      <circle className={OUTCOME_FILL[cell.outcome]} cx={cx} cy={cy} r={7.5} />
      {bonus === 'dragon7' ? (
        <text className={cls(styles.letter, styles.medalGlyph, styles.glyphOutline)} x={cx} y={cy + 0.5} fontSize={10.4}>
          7
        </text>
      ) : (
        <>
          <circle className={styles.pandaBadge} cx={cx} cy={cy} r={5} />
          <text className={cls(styles.letter, styles.medalGlyph)} x={cx} y={cy + 0.4} fontSize={7.4}>
            8
          </text>
        </>
      )}
      {pairs}
      {latest && <HitPulse kind={bonus} cx={cx} cy={cy} r={9} />}
    </g>
  );
}

/** Green diagonal tie stroke with a count when > 1. */
export function TieMark({ cx, cy, count }: { cx: number; cy: number; count: number }) {
  return (
    <g data-tie-mark={count}>
      <line
        className={styles.tie}
        x1={cx - 6.4}
        y1={cy + 6.4}
        x2={cx + 6.4}
        y2={cy - 6.4}
        strokeWidth={2.3}
        strokeLinecap="round"
      />
      {count > 1 && (
        <text
          className={cls(styles.letter, styles.tieFill, styles.outlined)}
          x={cx + 6.4}
          y={cy - 6.4}
          fontSize={6.4}
        >
          {count}
        </text>
      )}
    </g>
  );
}

interface BigRoadSymbolProps {
  cell: Pick<BigRoadCell, 'col' | 'row' | 'outcome' | 'playerPair' | 'bankerPair'>;
  ties: number;
  ghost?: boolean;
  /** Dragon 7 / Panda 8 on this hand: a corner badge, bottom-left, clear of the pair dots and the tie count. */
  bonus?: BonusKind | null;
  /** 1-based hand number, for the hit's accessible name. */
  hand?: number;
  /** True for the newest hand: a hit then pulses. */
  latest?: boolean;
}

/** Big road symbol: hollow circle (red Banker / blue Player) with the letter inside, tie marks, pair dots, bonus badge. */
export function BigRoadSymbol({ cell, ties, ghost = false, bonus = null, hand = 0, latest = false }: BigRoadSymbolProps) {
  const { cx, cy } = cellCenter(cell.col, cell.row);
  const hit = ghost ? null : bonus;
  return (
    <g
      className={ghost ? styles.ghost : undefined}
      data-big-cell={ghost ? undefined : ''}
      data-ghost={ghost ? '' : undefined}
      data-outcome={cell.outcome}
      data-ties={ties}
      data-hit={hit ?? undefined}
      role={hit === null ? undefined : 'img'}
      aria-label={hit === null ? undefined : bonusHitLabel(hit, hand)}
    >
      {hit !== null && <title>{bonusHitTitle(hit, hand)}</title>}
      <circle
        className={OUTCOME_STROKE[cell.outcome]}
        cx={cx}
        cy={cy}
        r={7.1}
        fill="none"
        strokeWidth={2.2}
        strokeDasharray={ghost ? '3 2.2' : undefined}
      />
      <text className={cls(styles.letter, OUTCOME_FILL[cell.outcome])} x={cx} y={cy + 0.4} fontSize={7.8}>
        {OUTCOME_LETTER[cell.outcome]}
      </text>
      {ties > 0 && <TieMark cx={cx} cy={cy} count={ties} />}
      <PairDots cx={cx} cy={cy} offset={5.6} playerPair={cell.playerPair} bankerPair={cell.bankerPair} />
      {hit !== null && <BonusBadge kind={hit} cx={cx - 5.8} cy={cy + 5.8} r={4.5} />}
      {hit !== null && latest && <HitPulse kind={hit} cx={cx} cy={cy} r={8.4} />}
    </g>
  );
}

interface DerivedSymbolProps {
  kind: DerivedKind;
  cell: Pick<DerivedCell, 'col' | 'row' | 'color'>;
  ghost?: boolean;
}

/** Big eye boy = hollow circle, small road = solid dot, cockroach pig = slash. */
export function DerivedSymbol({ kind, cell, ghost = false }: DerivedSymbolProps) {
  const { cx, cy } = cellCenter(cell.col, cell.row);
  const common = {
    'data-derived-cell': ghost ? undefined : '',
    'data-ghost': ghost ? '' : undefined,
    'data-color': cell.color,
  };
  switch (kind) {
    case 'bigEye':
      return (
        <circle
          {...common}
          className={cls(COLOR_STROKE[cell.color], ghost && styles.ghost)}
          cx={cx}
          cy={cy}
          r={5.5}
          fill="none"
          strokeWidth={2.4}
          strokeDasharray={ghost ? '2.4 1.8' : undefined}
        />
      );
    case 'small':
      return (
        <circle {...common} className={cls(COLOR_FILL[cell.color], ghost && styles.ghost)} cx={cx} cy={cy} r={5.1} />
      );
    case 'cockroach':
      return (
        <line
          {...common}
          className={cls(COLOR_STROKE[cell.color], ghost && styles.ghost)}
          x1={cx - 5.4}
          y1={cy + 5.4}
          x2={cx + 5.4}
          y2={cy - 5.4}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeDasharray={ghost ? '2.4 1.8' : undefined}
        />
      );
  }
}
