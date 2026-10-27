/**
 * Explains the third-card rules (SPEC §2) for any situation, in the dealer's words. The decisions come from the
 * engine's own `playerDraws` / `bankerDraws`, so the explanation can never disagree with the table.
 */
import { bankerDraws, isNatural, playerDraws } from '@/engine';

export type HandAction = 'draws' | 'stands';

export interface ThirdCardExplanation {
  playerTotal: number;
  bankerTotal: number;
  /** Which side (if any) has a natural. */
  natural: 'player' | 'banker' | 'both' | null;
  playerAction: HandAction;
  /** The Banker's action; `null` while it still depends on an unknown Player third card. */
  bankerAction: HandAction | null;
  /** The Player's third-card value the explanation used, or null if the Player stood / it is unknown. */
  playerThird: number | null;
  /** True when the Banker's decision needs the Player's third card and none was given. */
  needsPlayerThird: boolean;
  /** Player third-card values on which the Banker draws (only when the Player draws). */
  bankerDrawsOn: number[];
  /** Dealer-style sentences, in order. */
  lines: string[];
  /** One-line rule the Banker's decision rests on. */
  bankerRule: string;
}

const PLAYER_THIRD_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** The Player third-card values on which a Banker with `bankerTotal` draws (after the Player drew). */
export function bankerDrawValues(bankerTotal: number): number[] {
  return PLAYER_THIRD_VALUES.filter((v) => bankerDraws(bankerTotal, v));
}

function list(values: readonly number[]): string {
  if (values.length === 0) return 'nothing';
  if (values.length === 1) return String(values[0]);
  const sorted = [...values];
  const contiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 2) return `${sorted[0]}–${sorted[sorted.length - 1]}`;
  return `${sorted.slice(0, -1).join(', ')} or ${sorted[sorted.length - 1]}`;
}

/** The sentence describing the Banker's rule for a given two-card total after the Player drew. */
export function bankerRuleText(bankerTotal: number): string {
  if (bankerTotal <= 2) return `With ${bankerTotal}, the Banker always draws.`;
  if (bankerTotal === 7) return 'With 7, the Banker always stands.';
  if (bankerTotal === 3) return 'With 3, the Banker draws unless the Player’s third card is an 8.';
  const drawsOn = bankerDrawValues(bankerTotal);
  const standsOn = PLAYER_THIRD_VALUES.filter((v) => !drawsOn.includes(v));
  return `With ${bankerTotal}, the Banker draws when the Player’s third card is ${list(drawsOn)} and stands on ${list(standsOn)}.`;
}

function checkTotal(name: string, total: number): void {
  if (!Number.isInteger(total) || total < 0 || total > 9) throw new RangeError(`${name} total must be an integer 0–9 (got ${total})`);
}

/**
 * Explains what happens after the first four cards. `playerThird` is the VALUE (0–9) of the Player's third card,
 * `null` when unknown or when the Player stands.
 */
export function explainThirdCard(playerTotal: number, bankerTotal: number, playerThird: number | null = null): ThirdCardExplanation {
  checkTotal('Player', playerTotal);
  checkTotal('Banker', bankerTotal);
  if (playerThird !== null) checkTotal('Player third card', playerThird);

  const lines: string[] = [];
  const pNat = isNatural(playerTotal);
  const bNat = isNatural(bankerTotal);
  if (pNat || bNat) {
    const natural = pNat && bNat ? 'both' : pNat ? 'player' : 'banker';
    const who = natural === 'both' ? `Player shows ${playerTotal} and Banker shows ${bankerTotal}` : natural === 'player' ? `Player shows ${playerTotal}` : `Banker shows ${bankerTotal}`;
    lines.push(`${who} — a natural. Both hands stand; no third card is dealt to either side.`);
    return {
      playerTotal,
      bankerTotal,
      natural,
      playerAction: 'stands',
      bankerAction: 'stands',
      playerThird: null,
      needsPlayerThird: false,
      bankerDrawsOn: [],
      lines,
      bankerRule: 'A natural 8 or 9 on either side ends the hand: nobody draws.',
    };
  }

  const playerAction: HandAction = playerDraws(playerTotal) ? 'draws' : 'stands';
  lines.push(
    playerAction === 'draws'
      ? `Player has ${playerTotal}: on 0–5 the Player draws a third card.`
      : `Player has ${playerTotal}: on 6 or 7 the Player stands.`,
  );

  if (playerAction === 'stands') {
    const bankerAction: HandAction = bankerDraws(bankerTotal, null) ? 'draws' : 'stands';
    const bankerRule = 'When the Player stands, the Banker follows the Player’s own rule: draw on 0–5, stand on 6 or 7.';
    lines.push(`The Player stood, so the Banker uses the simple rule: Banker has ${bankerTotal} and ${bankerAction === 'draws' ? 'draws (0–5)' : 'stands (6 or 7)'}.`);
    return { playerTotal, bankerTotal, natural: null, playerAction, bankerAction, playerThird: null, needsPlayerThird: false, bankerDrawsOn: [], lines, bankerRule };
  }

  const bankerDrawsOn = bankerDrawValues(bankerTotal);
  const bankerRule = bankerRuleText(bankerTotal);
  lines.push(`The Player drew, so the Banker’s decision depends on the Banker’s two-card total (${bankerTotal}) and the VALUE of the Player’s third card. ${bankerRule}`);

  if (playerThird === null) {
    lines.push('Pick the Player’s third card to see what the Banker does.');
    return { playerTotal, bankerTotal, natural: null, playerAction, bankerAction: null, playerThird: null, needsPlayerThird: true, bankerDrawsOn, lines, bankerRule };
  }

  const bankerAction: HandAction = bankerDraws(bankerTotal, playerThird) ? 'draws' : 'stands';
  const newPlayerTotal = (playerTotal + playerThird) % 10;
  lines.push(`The Player’s third card is a ${playerThird} (Player now has ${newPlayerTotal}), so the Banker ${bankerAction}.`);
  return { playerTotal, bankerTotal, natural: null, playerAction, bankerAction, playerThird, needsPlayerThird: false, bankerDrawsOn, lines, bankerRule };
}
