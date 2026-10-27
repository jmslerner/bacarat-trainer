import type { BankerRule, BetLimits, TableRules } from './types';

/** Player draws a third card on a two-card total of 0–5 and stands on 6–7 (naturals never reach this). */
export function playerDraws(playerTotal: number): boolean {
  return playerTotal <= 5;
}

/** A two-card total of 8 or 9 is a natural: both sides stand. */
export function isNatural(total: number): boolean {
  return total >= 8;
}

/**
 * The Banker's third-card rule (SPEC §2).
 * `playerThirdCardValue` is the VALUE (0–9) of the Player's third card, or `null` when the Player stood.
 *
 * | Banker total | Draws when P3 is…       | Stands when P3 is…  |
 * |--------------|-------------------------|---------------------|
 * | 0, 1, 2      | always draws            | —                   |
 * | 3            | 0,1,2,3,4,5,6,7,9       | 8                   |
 * | 4            | 2,3,4,5,6,7             | 0,1,8,9             |
 * | 5            | 4,5,6,7                 | 0,1,2,3,8,9         |
 * | 6            | 6,7                     | 0,1,2,3,4,5,8,9     |
 * | 7            | —                       | always stands       |
 */
export function bankerDraws(bankerTotal: number, playerThirdCardValue: number | null): boolean {
  if (playerThirdCardValue === null) return bankerTotal <= 5;
  const p3 = playerThirdCardValue;
  switch (bankerTotal) {
    case 0:
    case 1:
    case 2:
      return true;
    case 3:
      return p3 !== 8;
    case 4:
      return p3 >= 2 && p3 <= 7;
    case 5:
      return p3 >= 4 && p3 <= 7;
    case 6:
      return p3 === 6 || p3 === 7;
    default:
      // 7 always stands; 8 and 9 are naturals and never consult this table.
      return false;
  }
}

export const BANKER_RULES: readonly BankerRule[] = ['ez', 'commission', 'super6'];

export const BANKER_RULE_LABELS: Readonly<Record<BankerRule, string>> = Object.freeze({
  ez: 'EZ Baccarat (no commission, Dragon 7 pushes)',
  commission: 'Classic (5% commission)',
  super6: 'Super 6 (Banker 6 pays half)',
});

function deepFreeze<T extends object>(value: T): T {
  for (const key of Object.keys(value)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) deepFreeze(child);
  }
  return Object.freeze(value);
}

/** The default table: 8-deck EZ Baccarat with every side bet offered. Deeply frozen; use `cloneRules` to edit. */
export const DEFAULT_RULES: TableRules = deepFreeze({
  decks: 8,
  bankerRule: 'ez',
  commissionRate: 0.05,
  tiePays: 8,
  dragon7Pays: 40,
  panda8Pays: 25,
  pairPays: 11,
  sideBets: { dragon7: true, panda8: true, pairs: true },
  limits: {
    main: { min: 10, max: 5000 },
    tie: { min: 5, max: 500 },
    side: { min: 5, max: 500 },
  },
  cutCardFromEnd: 14,
  burnProcedure: true,
  chipDenominations: [1, 5, 25, 100, 500, 1000],
});

/** A deep, mutable copy of a rule set (chip tray and limits included). */
export function cloneRules(rules: TableRules): TableRules {
  return {
    ...rules,
    sideBets: { ...rules.sideBets },
    limits: {
      main: { ...rules.limits.main },
      tie: { ...rules.limits.tie },
      side: { ...rules.limits.side },
    },
    chipDenominations: [...rules.chipDenominations],
  };
}

export const RULE_PRESETS: Record<'ez' | 'commission' | 'super6', { name: string; description: string; rules: TableRules }> =
  deepFreeze({
    ez: {
      name: 'EZ Baccarat',
      description:
        'Banker pays even money with no commission; a Banker win with a three-card 7 (the Dragon 7) is a push. ' +
        'Dragon 7, Panda 8 and Pair side bets are offered.',
      rules: DEFAULT_RULES,
    },
    commission: {
      name: 'Classic (5% commission)',
      description:
        'Traditional baccarat: winning Banker bets pay 1:1 minus a 5% commission, collected from the winnings ' +
        'as at a mini-baccarat table. Pair bets only; the EZ side bets are not dealt.',
      rules: {
        ...cloneRules(DEFAULT_RULES),
        bankerRule: 'commission',
        sideBets: { dragon7: false, panda8: false, pairs: true },
      },
    },
    super6: {
      name: 'Super 6',
      description:
        'No-commission variant: Banker pays 1:1, except that a Banker win with a total of 6 pays only half (1:2). ' +
        'Pair bets only; the EZ side bets are not dealt.',
      rules: {
        ...cloneRules(DEFAULT_RULES),
        bankerRule: 'super6',
        sideBets: { dragon7: false, panda8: false, pairs: true },
      },
    },
  });

/** The smallest cut-card depth that guarantees the hand in progress plus one more hand can always be completed. */
export const MIN_CUT_CARD_FROM_END = 12;

function isPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function checkLimits(name: string, limits: BetLimits | undefined, problems: string[]): void {
  if (!limits || typeof limits !== 'object') {
    problems.push(`${name} limits are missing`);
    return;
  }
  if (!isPositiveFinite(limits.min)) problems.push(`${name} minimum must be a positive number`);
  if (!isPositiveFinite(limits.max)) problems.push(`${name} maximum must be a positive number`);
  if (isPositiveFinite(limits.min) && isPositiveFinite(limits.max) && limits.max < limits.min) {
    problems.push(`${name} maximum (${limits.max}) is below the minimum (${limits.min})`);
  }
}

/** Human-readable problems with a rule set; an empty array means the rules are playable. */
export function validateRules(rules: TableRules): string[] {
  const problems: string[] = [];
  if (!rules || typeof rules !== 'object') return ['Rules are missing'];

  if (rules.decks !== 6 && rules.decks !== 8) problems.push('Decks must be 6 or 8');
  if (!BANKER_RULES.includes(rules.bankerRule)) problems.push('Banker rule must be "ez", "commission" or "super6"');
  if (typeof rules.commissionRate !== 'number' || !Number.isFinite(rules.commissionRate) || rules.commissionRate < 0 || rules.commissionRate > 0.25) {
    problems.push('Commission rate must be between 0% and 25%');
  }
  if (!isPositiveFinite(rules.tiePays)) problems.push('Tie payout must be a positive number');
  if (!isPositiveFinite(rules.dragon7Pays)) problems.push('Dragon 7 payout must be a positive number');
  if (!isPositiveFinite(rules.panda8Pays)) problems.push('Panda 8 payout must be a positive number');
  if (!isPositiveFinite(rules.pairPays)) problems.push('Pair payout must be a positive number');

  if (!rules.sideBets || typeof rules.sideBets !== 'object') {
    problems.push('Side bet settings are missing');
  } else {
    for (const key of ['dragon7', 'panda8', 'pairs'] as const) {
      if (typeof rules.sideBets[key] !== 'boolean') problems.push(`Side bet setting "${key}" must be on or off`);
    }
  }

  if (!rules.limits || typeof rules.limits !== 'object') {
    problems.push('Table limits are missing');
  } else {
    checkLimits('Main bet', rules.limits.main, problems);
    checkLimits('Tie bet', rules.limits.tie, problems);
    checkLimits('Side bet', rules.limits.side, problems);
  }

  const totalCards = (rules.decks === 6 ? 6 : 8) * 52;
  if (!Number.isInteger(rules.cutCardFromEnd) || rules.cutCardFromEnd < MIN_CUT_CARD_FROM_END) {
    problems.push(`Cut card must be placed at least ${MIN_CUT_CARD_FROM_END} cards from the end of the shoe`);
  } else if (rules.cutCardFromEnd > totalCards - 52) {
    problems.push(`Cut card must leave at least one deck in play (at most ${totalCards - 52} cards from the end)`);
  }

  if (typeof rules.burnProcedure !== 'boolean') problems.push('Burn procedure must be on or off');

  const chips = rules.chipDenominations;
  if (!Array.isArray(chips) || chips.length === 0) {
    problems.push('The chip tray needs at least one denomination');
  } else {
    for (let i = 0; i < chips.length; i++) {
      const c = chips[i];
      if (!Number.isInteger(c) || c <= 0) {
        problems.push(`Chip denomination ${String(c)} must be a positive whole number`);
        break;
      }
      if (i > 0 && chips[i - 1] >= c) {
        problems.push('Chip denominations must be ascending and unique');
        break;
      }
    }
  }

  return problems;
}
