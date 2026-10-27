import type { Outcome } from '@/engine';
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

/** Bead plate symbol: solid disc with the letter; gold ring + badge for Dragon 7 / Panda 8. */
export function BeadSymbol({ cell }: { cell: BeadCell }) {
  const { cx, cy } = cellCenter(cell.col, cell.row);
  const bonus = cell.dragon7 ? '7' : cell.panda8 ? '8' : null;
  return (
    <g data-bead={cell.handIndex} data-outcome={cell.outcome} data-bonus={bonus ?? undefined}>
      {bonus !== null && <circle className={styles.goldStroke} cx={cx} cy={cy} r={9} fill="none" strokeWidth={1.1} />}
      <circle className={OUTCOME_FILL[cell.outcome]} cx={cx} cy={cy} r={7.5} />
      <text className={cls(styles.letter, styles.ivoryFill)} x={cx} y={cy + 0.4} fontSize={8.6}>
        {OUTCOME_LETTER[cell.outcome]}
      </text>
      <PairDots cx={cx} cy={cy} offset={6.1} playerPair={cell.playerPair} bankerPair={cell.bankerPair} />
      {bonus !== null && (
        <g>
          <circle className={styles.goldFill} cx={cx + 6.4} cy={cy - 6.4} r={3.4} />
          <text className={cls(styles.letter, styles.inkFill)} x={cx + 6.4} y={cy - 6.2} fontSize={5.2}>
            {bonus}
          </text>
        </g>
      )}
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
}

/** Big road symbol: hollow circle (red Banker / blue Player) with the letter inside, tie marks, pair dots. */
export function BigRoadSymbol({ cell, ties, ghost = false }: BigRoadSymbolProps) {
  const { cx, cy } = cellCenter(cell.col, cell.row);
  return (
    <g
      className={ghost ? styles.ghost : undefined}
      data-big-cell={ghost ? undefined : ''}
      data-ghost={ghost ? '' : undefined}
      data-outcome={cell.outcome}
      data-ties={ties}
    >
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
