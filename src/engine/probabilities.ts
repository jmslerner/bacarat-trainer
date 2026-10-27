import type { BetType, TableRules } from './types';

/**
 * Exact probabilities from enumeration (tools/enumerate_probabilities.py → docs/probabilities.json).
 * All values are for a hand dealt from a full shoe; the Monte Carlo tests verify the engine against them.
 */
export interface ExactProbabilities {
  player: number;
  banker: number;
  tie: number;
  /** Banker WINS with a three-card total of 7. */
  dragon7: number;
  /** Player WINS with a three-card total of 8. */
  panda8: number;
  /** Banker wins with a total of 6 (Super 6 half pay). */
  bankerWin6: number;
  /** A natural 8 or 9 on one given side's first two cards (same for Player and Banker). */
  natural: number;
  /** One given side's first two cards share a rank. */
  pair: number;
  /** The hand uses 4 / 5 / 6 cards. */
  cards4: number;
  cards5: number;
  cards6: number;
}

export const EXACT_8_DECKS: ExactProbabilities = Object.freeze({
  player: 0.44624660934359683,
  banker: 0.458597422632763,
  tie: 0.0951559680236402,
  dragon7: 0.022533820860379795,
  panda8: 0.03454321839641487,
  bankerWin6: 0.05386371585776989,
  natural: 0.18943466172381834,
  pair: 0.0746987951807229, // = 31/415
  cards4: 0.37886849088028157,
  cards5: 0.3034441685477851,
  cards6: 0.3176873405719333,
});

export const EXACT_6_DECKS: ExactProbabilities = Object.freeze({
  player: 0.4462785698388768,
  banker: 0.4586527188253242,
  tie: 0.09506871133579899,
  dragon7: 0.022535075493314967,
  panda8: 0.03453562179451209,
  bankerWin6: 0.053844451097007265,
  natural: 0.18946326984912193,
  pair: 0.07395498392282958, // = 23/311
  cards4: 0.37892505239827506,
  cards5: 0.3035397935431469,
  cards6: 0.31753515405857796,
});

export function exactProbabilities(decks: 6 | 8): ExactProbabilities {
  return decks === 6 ? EXACT_6_DECKS : EXACT_8_DECKS;
}

/**
 * Effect of removal, 8 decks: change in a bet's EV (per unit wagered) when one card of that value
 * (index 0 = 10/J/Q/K, 1 = Ace, 2..9) is removed from a full shoe. Positive = the bet improves.
 */
export const EOR_8_DECKS: Record<'dragon7' | 'panda8', number[]> = Object.freeze({
  dragon7: Object.freeze([
    0.0008630144739532571, 0.0004980876406696669, -0.0008962596695870656, -0.0010760793845433906,
    -0.0026802927439946844, -0.00263479912915938, -0.003242200579712389, -0.0035837053244234538,
    0.005378160338775015, 0.004785030956162653,
  ]) as number[],
  panda8: Object.freeze([
    0.0012076012699502009, 0.0013216460091024982, 0.0014437500150553076, -0.0028609223419388996,
    -0.002536122830066035, -0.0026547395923905534, -0.0008915470435029645, -0.0009140717021280681,
    -0.002240565109323065, 0.004502167515390976,
  ]) as number[],
});

/** Effect of removal for the main bets (8 decks) — tiny compared with the side bets, which is why counting them is hopeless. */
export const EOR_8_DECKS_MAIN: Record<'bankerEz' | 'player' | 'tie8', number[]> = Object.freeze({
  bankerEz: Object.freeze([
    -3.2735019764591474e-6, 3.264992701533109e-5, 7.611570059537524e-5, 9.34442975860581e-5,
    1.8489228013465942e-4, -1.979653506634214e-5, -3.376350675307616e-5, 5.680523983258181e-6,
    -1.8447840046830426e-4, -1.416502791211229e-4,
  ]) as number[],
  player: Object.freeze([
    -1.7775631534595905e-5, -4.4798406056054666e-5, -5.4255708654227294e-5, -6.719845893865833e-5,
    -1.1951928637869152e-4, 8.405992846047336e-5, 1.1284156967289054e-4, 8.172692295389923e-5,
    5.3303758059157555e-5, 2.4942207019594758e-5,
  ]) as number[],
  tie8: Object.freeze([
    5.128780977404145e-4, 1.2925089357916875e-4, -2.3923964483724797e-4, -2.1406291949533802e-4,
    -2.923591624126165e-4, -2.6439953135182497e-4, -1.1595305073563882e-3, -1.0914061695660796e-3,
    6.542546775002524e-4, 4.259799729784161e-4,
  ]) as number[],
});

export interface BetOutcomeProbabilities {
  /** The bet is paid (for EZ Banker this excludes the Dragon 7 push). */
  win: number;
  /** The bet is returned. */
  push: number;
  /** The bet is lost. */
  lose: number;
}

/** Win / push / lose probabilities of a bet under the given rules. */
export function outcomeProbabilities(bet: BetType, rules: TableRules): BetOutcomeProbabilities {
  const p = exactProbabilities(rules.decks);
  switch (bet) {
    case 'player':
      return { win: p.player, push: p.tie, lose: p.banker };
    case 'banker':
      return rules.bankerRule === 'ez'
        ? { win: p.banker - p.dragon7, push: p.tie + p.dragon7, lose: p.player }
        : { win: p.banker, push: p.tie, lose: p.player };
    case 'tie':
      return { win: p.tie, push: 0, lose: 1 - p.tie };
    case 'dragon7':
      return { win: p.dragon7, push: 0, lose: 1 - p.dragon7 };
    case 'panda8':
      return { win: p.panda8, push: 0, lose: 1 - p.panda8 };
    case 'playerPair':
    case 'bankerPair':
      return { win: p.pair, push: 0, lose: 1 - p.pair };
  }
}

/** Probability that the bet is paid under the given rules. */
export function winProbability(bet: BetType, rules: TableRules): number {
  return outcomeProbabilities(bet, rules).win;
}

/**
 * Expected value per unit wagered (negative = the house's favour), computed from the exact probabilities and the
 * table's actual payouts, so custom tie / side-bet payouts and commission rates are honoured.
 */
export function expectedValuePerUnit(bet: BetType, rules: TableRules): number {
  const p = exactProbabilities(rules.decks);
  switch (bet) {
    case 'player':
      return p.player - p.banker;
    case 'banker':
      switch (rules.bankerRule) {
        case 'ez':
          return p.banker - p.dragon7 - p.player;
        case 'commission':
          return (1 - rules.commissionRate) * p.banker - p.player;
        case 'super6':
          return p.banker - 0.5 * p.bankerWin6 - p.player;
      }
      break;
    case 'tie':
      return rules.tiePays * p.tie - (p.player + p.banker);
    case 'dragon7':
      return rules.dragon7Pays * p.dragon7 - (1 - p.dragon7);
    case 'panda8':
      return rules.panda8Pays * p.panda8 - (1 - p.panda8);
    case 'playerPair':
    case 'bankerPair':
      return rules.pairPays * p.pair - (1 - p.pair);
  }
  return 0;
}

/** House edge as a POSITIVE fraction of the amount wagered, e.g. 0.010183 for EZ Banker (8 decks). */
export function houseEdge(bet: BetType, rules: TableRules): number {
  return -expectedValuePerUnit(bet, rules);
}

/** Expected change in bankroll for a bet of `amount`: negative = expected loss. */
export function expectedValue(bet: BetType, amount: number, rules: TableRules): number {
  return expectedValuePerUnit(bet, rules) * amount;
}
