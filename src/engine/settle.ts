import { BET_TYPES } from './types';
import type { BetLimits, BetResult, BetSettlement, Bets, BetType, HandResult, HandSettlement, TableRules } from './types';

export const BET_LABELS: Readonly<Record<BetType, string>> = Object.freeze({
  player: 'Player',
  banker: 'Banker',
  tie: 'Tie',
  dragon7: 'Dragon 7',
  panda8: 'Panda 8',
  playerPair: 'Player Pair',
  bankerPair: 'Banker Pair',
});

/** Rounds to the cent, correcting binary float noise (0.575 → 0.58). */
export function roundCents(amount: number): number {
  const sign = amount < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(amount) * 100 + 1e-9)) / 100;
}

/** "$1,234.50" — whole dollars show no cents. */
export function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const text = abs.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-$${text}` : `$${text}`;
}

/** Which table limit applies to a bet: main (Player/Banker), tie, or side. */
export function limitsFor(bet: BetType, rules: TableRules): BetLimits {
  switch (bet) {
    case 'player':
    case 'banker':
      return rules.limits.main;
    case 'tie':
      return rules.limits.tie;
    default:
      return rules.limits.side;
  }
}

/** Whether the table offers this bet under the given rules. */
export function isBetEnabled(bet: BetType, rules: TableRules): boolean {
  switch (bet) {
    case 'dragon7':
      return rules.sideBets.dragon7;
    case 'panda8':
      return rules.sideBets.panda8;
    case 'playerPair':
    case 'bankerPair':
      return rules.sideBets.pairs;
    default:
      return true;
  }
}

/** Winnings per unit wagered: 1 for the main bets, tiePays, dragon7Pays, panda8Pays, pairPays. */
export function payoutMultiplier(bet: BetType, rules: TableRules): number {
  switch (bet) {
    case 'tie':
      return rules.tiePays;
    case 'dragon7':
      return rules.dragon7Pays;
    case 'panda8':
      return rules.panda8Pays;
    case 'playerPair':
    case 'bankerPair':
      return rules.pairPays;
    default:
      return 1;
  }
}

/** Sum of the amounts on the layout. */
export function totalOnLayout(bets: Bets): number {
  let total = 0;
  for (let i = 0; i < BET_TYPES.length; i++) {
    const amount = bets[BET_TYPES[i]];
    if (amount !== undefined && amount > 0) total += amount;
  }
  return total;
}

function settleOne(bet: BetType, amount: number, result: HandResult, rules: TableRules): BetSettlement {
  let outcome: BetResult;
  let net: number;
  let commission = 0;

  switch (bet) {
    case 'player':
      if (result.outcome === 'player') {
        outcome = 'win';
        net = amount;
      } else if (result.outcome === 'tie') {
        outcome = 'push';
        net = 0;
      } else {
        outcome = 'lose';
        net = -amount;
      }
      break;

    case 'banker':
      if (result.outcome === 'banker') {
        if (rules.bankerRule === 'ez' && result.dragon7) {
          // EZ Baccarat: the Banker bet is a push when Banker wins with a three-card 7.
          outcome = 'push';
          net = 0;
        } else if (rules.bankerRule === 'commission') {
          outcome = 'win';
          commission = roundCents(amount * rules.commissionRate);
          net = roundCents(amount - commission);
        } else if (rules.bankerRule === 'super6' && result.bankerTotal === 6) {
          outcome = 'win';
          net = roundCents(amount / 2);
        } else {
          outcome = 'win';
          net = amount;
        }
      } else if (result.outcome === 'tie') {
        outcome = 'push';
        net = 0;
      } else {
        outcome = 'lose';
        net = -amount;
      }
      break;

    case 'tie':
      if (result.outcome === 'tie') {
        outcome = 'win';
        net = roundCents(amount * rules.tiePays);
      } else {
        outcome = 'lose';
        net = -amount;
      }
      break;

    case 'dragon7':
      if (result.dragon7) {
        outcome = 'win';
        net = roundCents(amount * rules.dragon7Pays);
      } else {
        outcome = 'lose';
        net = -amount;
      }
      break;

    case 'panda8':
      if (result.panda8) {
        outcome = 'win';
        net = roundCents(amount * rules.panda8Pays);
      } else {
        outcome = 'lose';
        net = -amount;
      }
      break;

    case 'playerPair':
      if (result.playerPair) {
        outcome = 'win';
        net = roundCents(amount * rules.pairPays);
      } else {
        outcome = 'lose';
        net = -amount;
      }
      break;

    case 'bankerPair':
      if (result.bankerPair) {
        outcome = 'win';
        net = roundCents(amount * rules.pairPays);
      } else {
        outcome = 'lose';
        net = -amount;
      }
      break;
  }

  return { bet, amount, result: outcome, net, commission };
}

/**
 * Settles every bet on the layout against a hand, exactly per SPEC §2:
 * main bets push on a tie, EZ Banker pushes on the Dragon 7, classic Banker pays minus commission,
 * Super 6 Banker pays half on a winning 6, Tie / Dragon 7 / Panda 8 / Pair bets lose unless they hit.
 */
export function settleBets(bets: Bets, result: HandResult, rules: TableRules): HandSettlement {
  const settlements: BetSettlement[] = [];
  let net = 0;
  let commission = 0;
  let totalWagered = 0;
  for (let i = 0; i < BET_TYPES.length; i++) {
    const bet = BET_TYPES[i];
    const amount = bets[bet];
    if (amount === undefined || !(amount > 0)) continue;
    const s = settleOne(bet, amount, result, rules);
    settlements.push(s);
    net += s.net;
    commission += s.commission;
    totalWagered += amount;
  }
  return { settlements, net: roundCents(net), commission: roundCents(commission), totalWagered };
}

/** Placement-time check: the bet must be offered, the amount positive and within the table maximum. */
export function validateBet(bet: BetType, amount: number, rules: TableRules): string | null {
  if (!BET_TYPES.includes(bet)) return `Unknown bet "${String(bet)}"`;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return 'Bet amount must be a positive number';
  if (!isBetEnabled(bet, rules)) return `${BET_LABELS[bet]} is not offered at this table`;
  const { max } = limitsFor(bet, rules);
  if (amount > max) return `${BET_LABELS[bet]} bet cannot exceed the table maximum of ${formatMoney(max)}`;
  return null;
}

/** Deal-time check: at least one bet, every bet offered, within its maximum and at or above its minimum. */
export function validateLayout(bets: Bets, rules: TableRules): string[] {
  const problems: string[] = [];
  if (totalOnLayout(bets) <= 0) return ['Place a bet to deal'];
  for (let i = 0; i < BET_TYPES.length; i++) {
    const bet = BET_TYPES[i];
    const amount = bets[bet];
    if (amount === undefined || amount === 0) continue;
    const placement = validateBet(bet, amount, rules);
    if (placement !== null) {
      problems.push(placement);
      continue;
    }
    const { min } = limitsFor(bet, rules);
    if (amount < min) {
      problems.push(`${BET_LABELS[bet]} bet of ${formatMoney(amount)} is below the table minimum of ${formatMoney(min)}`);
    }
  }
  return problems;
}
