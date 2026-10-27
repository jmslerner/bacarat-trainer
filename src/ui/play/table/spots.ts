/**
 * The betting spots of the EZ Baccarat layout, with the text printed on the felt for the active rules.
 */
import type { BetType, TableRules } from '@/engine';
import { isBetEnabled } from '@/engine';

export type SpotTone = 'player' | 'banker' | 'tie' | 'dragon' | 'panda' | 'pairPlayer' | 'pairBanker';

export interface SpotDef {
  bet: BetType;
  label: string;
  /** Short name for narrow screens. */
  short: string;
  tone: SpotTone;
  /** Keyboard shortcut (none for the pairs). */
  key?: string;
}

/** Bottom arc, left to right. */
export const ARC_SPOTS: readonly SpotDef[] = [
  { bet: 'playerPair', label: 'Player Pair', short: 'P Pair', tone: 'pairPlayer' },
  { bet: 'player', label: 'Player', short: 'Player', tone: 'player', key: 'P' },
  { bet: 'tie', label: 'Tie', short: 'Tie', tone: 'tie', key: 'T' },
  { bet: 'banker', label: 'Banker', short: 'Banker', tone: 'banker', key: 'B' },
  { bet: 'bankerPair', label: 'Banker Pair', short: 'B Pair', tone: 'pairBanker' },
];

/** Middle band. */
export const BAND_SPOTS: readonly SpotDef[] = [
  { bet: 'dragon7', label: 'Dragon 7', short: 'Dragon 7', tone: 'dragon', key: 'D' },
  { bet: 'panda8', label: 'Panda 8', short: 'Panda 8', tone: 'panda', key: 'N' },
];

export function spotDef(bet: BetType): SpotDef {
  return [...ARC_SPOTS, ...BAND_SPOTS].find((s) => s.bet === bet) as SpotDef;
}

function odds(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2)} to 1`;
}

/** Payout line printed under the spot name. */
export function spotPayout(bet: BetType, rules: TableRules): string {
  switch (bet) {
    case 'player':
      return 'pays 1 to 1';
    case 'banker':
      return 'pays 1 to 1';
    case 'tie':
      return `pays ${odds(rules.tiePays)}`;
    case 'dragon7':
      return `pays ${odds(rules.dragon7Pays)}`;
    case 'panda8':
      return `pays ${odds(rules.panda8Pays)}`;
    case 'playerPair':
    case 'bankerPair':
      return `pays ${odds(rules.pairPays)}`;
  }
}

/** Small print under the payout (the rule the spot plays by). */
export function spotNote(bet: BetType, rules: TableRules): string | null {
  switch (bet) {
    case 'banker':
      if (rules.bankerRule === 'ez') return 'no commission';
      if (rules.bankerRule === 'commission') return `${Math.round(rules.commissionRate * 100)}% commission`;
      return 'Banker 6 pays 1 to 2';
    case 'dragon7':
      return 'Banker wins with a 3-card 7';
    case 'panda8':
      return 'Player wins with a 3-card 8';
    case 'player':
      return 'push on tie';
    default:
      return null;
  }
}

export function offeredSpots(defs: readonly SpotDef[], rules: TableRules): SpotDef[] {
  return defs.filter((s) => isBetEnabled(s.bet, rules));
}
