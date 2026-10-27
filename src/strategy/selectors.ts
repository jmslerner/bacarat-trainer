import type { HandResult, Outcome, Side } from '@/engine';
import type { BetSelector, MainChoice, StrategyContext } from './types';

/** Most recent non-tie outcome of the shoe, or null when there is none yet. */
export function lastDecisiveOutcome(history: readonly HandResult[]): Side | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const outcome = history[i].outcome;
    if (outcome !== 'tie') return outcome;
  }
  return null;
}

export interface SideColumnStats {
  /** Player / Banker cells on the big road (ties are marks, not cells). */
  cells: Record<Side, number>;
  /** Logical big-road columns (streaks) per side. */
  columns: Record<Side, number>;
  /** Average column length per side (0 without any column). */
  averageColumn: Record<Side, number>;
}

/** Big-road column statistics per side: identical to the logical columns of `bigRoad()` in `@/roads`. */
export function sideColumnStats(history: readonly HandResult[]): SideColumnStats {
  const cells: Record<Side, number> = { player: 0, banker: 0 };
  const columns: Record<Side, number> = { player: 0, banker: 0 };
  let current: Side | null = null;
  for (let i = 0; i < history.length; i++) {
    const outcome: Outcome = history[i].outcome;
    if (outcome === 'tie') continue;
    cells[outcome] += 1;
    if (outcome !== current) {
      columns[outcome] += 1;
      current = outcome;
    }
  }
  return {
    cells,
    columns,
    averageColumn: {
      player: columns.player === 0 ? 0 : cells.player / columns.player,
      banker: columns.banker === 0 ? 0 : cells.banker / columns.banker,
    },
  };
}

const other = (side: Side): Side => (side === 'player' ? 'banker' : 'player');

/** A fair coin from the context's RNG, or, without one, from the shuffled ids of the cards already dealt. */
function coin(ctx: StrategyContext): MainChoice {
  if (ctx.rng) return ctx.rng.next() < 0.5 ? 'player' : 'banker';
  const last = ctx.shoeHistory[ctx.shoeHistory.length - 1];
  if (!last) return 'banker';
  const cards = last.bankerCards;
  return (cards[cards.length - 1].id + ctx.handsPlayed) % 2 === 0 ? 'banker' : 'player';
}

const selectors: BetSelector[] = [
  {
    id: 'alwaysBanker',
    name: 'Always Banker',
    description: 'Bet Banker every hand: the lowest house edge on the layout.',
    select: () => 'banker',
  },
  {
    id: 'alwaysPlayer',
    name: 'Always Player',
    description: 'Bet Player every hand.',
    select: () => 'player',
  },
  {
    id: 'followLast',
    name: 'Follow the streak',
    description: 'Bet whatever won the last decisive hand (ties are ignored). Banker on the first hand of a shoe.',
    select: (ctx) => lastDecisiveOutcome(ctx.shoeHistory) ?? 'banker',
  },
  {
    id: 'betAgainstLast',
    name: 'Chop (bet against the last)',
    description: 'Bet the opposite of whatever won the last decisive hand. Banker on the first hand of a shoe.',
    select: (ctx) => {
      const last = lastDecisiveOutcome(ctx.shoeHistory);
      return last === null ? 'banker' : other(last);
    },
  },
  {
    id: 'followAfterN',
    name: 'Follow a streak of 3+',
    description: 'Sit out until one side has won three decisive hands in a row, then ride that side until it loses.',
    select: (ctx) => {
      const { outcome, length } = ctx.streak;
      return outcome !== null && outcome !== 'tie' && length >= 3 ? outcome : 'skip';
    },
  },
  {
    id: 'alternate',
    name: 'Alternate',
    description: 'Banker, Player, Banker, Player… regardless of results.',
    select: (ctx) => (ctx.handsPlayed % 2 === 0 ? 'banker' : 'player'),
  },
  {
    id: 'bigRoadTrend',
    name: 'Big road trend',
    description: 'Bet the side whose big-road columns are longer on average this shoe (Banker when level or empty).',
    select: (ctx) => {
      const { averageColumn } = sideColumnStats(ctx.shoeHistory);
      return averageColumn.player > averageColumn.banker ? 'player' : 'banker';
    },
  },
  {
    id: 'random',
    name: 'Random',
    description: 'Flip a coin between Player and Banker each hand (seeded, so runs are reproducible).',
    select: coin,
  },
];

export const BET_SELECTORS: readonly BetSelector[] = Object.freeze(selectors);

export function getSelector(id: string): BetSelector | undefined {
  return BET_SELECTORS.find((s) => s.id === id);
}
