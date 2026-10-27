# Baccarat Trainer — Product & Architecture Specification

This is the single source of truth for everyone building the app. Read it fully before writing code.
The shared TypeScript contract lives in `src/engine/types.ts` — code against it; do not change its shapes.

## 1. Product

A browser app (Vite + React 18 + TypeScript, no UI framework, no new dependencies) that teaches, trains and
simulates **EZ Baccarat** with the **Dragon 7** and **Panda 8** side bets, as close to a real casino table as
we can get. Three modes in one single-page app:

1. **Play** — a casino-faithful table: felt layout with betting spots, real chip denominations, bankroll and
   table limits, an 8-deck shoe with cut card and burn procedure, card-by-card dealing with the dealer's calls,
   third-card rules applied automatically, settlement animation, the full set of casino roadmaps (bead plate,
   big road, big eye boy, small road, cockroach pig) with "ask road" prediction, hand history, session stats,
   and a Coach panel showing the math (house edge, expected loss, running/true counts for Dragon 7 and Panda 8).
   Rule variants: EZ (default), classic 5% commission, Super 6.
2. **Learn** — structured lessons with interactive examples, plus drills with scoring (third-card rules,
   payouts, best bet, reading roads, card counting).
3. **Strategy Lab** — Monte Carlo simulation of bet-selection strategies and money-management systems over many
   shoes, run in a Web Worker, with charts (bankroll curves, final-bankroll histogram), risk of ruin and realized
   house edge, so the player can SEE that no system beats the edge — and where the only real edge (counting the
   side bets) comes from.

Design direction: a real casino table. Deep green felt (`#0f5132`-ish gradient), mahogany rail, gold trim, ivory
text. Casino display conventions: **Banker = red, Player = blue, Tie = green**. Display font "Cinzel" (Google
Fonts) for headings/plaques, "Inter" for body (Google Fonts, with system fallbacks). Must work from 380px phones
to wide desktops and be keyboard accessible. Visually polished — this is the product.

## 2. Rules of the game (authoritative)

### Cards and totals
* Ace = 1, 2–9 = face value, 10/J/Q/K = 0. Hand total = sum mod 10. Suits are irrelevant to play.
* Shoe: 8 decks (416 cards) by default; 6 decks selectable.

### Dealing order and the third-card rules
1. Deal: Player card 1, Banker card 1, Player card 2, Banker card 2.
2. **Natural**: if either side's two-card total is 8 or 9, both stand; no more cards.
3. Otherwise **Player** acts first: total 0–5 → draws a third card; 6–7 → stands.
4. **Banker**:
   * If Player stood (did not draw): Banker draws on 0–5, stands on 6–7.
   * If Player drew, Banker's action depends on Banker's two-card total and the VALUE of Player's third card (P3):

   | Banker total | Draws when P3 is… | Stands when P3 is… |
   |---|---|---|
   | 0, 1, 2 | always draws | — |
   | 3 | 0,1,2,3,4,5,6,7,9 | 8 |
   | 4 | 2,3,4,5,6,7 | 0,1,8,9 |
   | 5 | 4,5,6,7 | 0,1,2,3,8,9 |
   | 6 | 6,7 | 0,1,2,3,4,5,8,9 |
   | 7 | — | always stands |

5. Highest total wins; equal totals are a **Tie**.

### Bets and payouts
| Bet | Wins when | Pays | Notes |
|---|---|---|---|
| Player | Player total > Banker total | 1:1 | push on a tie |
| Banker (EZ) | Banker total > Player total | 1:1, no commission | **push** (bet returned) when Banker wins with a three-card 7 (Dragon 7) |
| Banker (commission) | same | 1:1 minus 5% commission | push on a tie |
| Banker (Super 6) | same | 1:1, but a Banker win with a total of 6 pays 1:2 | push on a tie |
| Tie | totals equal | 8:1 (9:1 selectable) | |
| Dragon 7 | Banker WINS with a THREE-card total of 7 | 40:1 | a tie 7–7 is NOT a Dragon 7; a two-card Banker 7 is NOT a Dragon 7 |
| Panda 8 | Player WINS with a THREE-card total of 8 | 25:1 | a tie 8–8 is NOT a Panda 8; a two-card 8 (natural) is NOT a Panda 8 |
| Player Pair | Player's first two cards share a rank | 11:1 | resolved on the initial deal, independent of outcome |
| Banker Pair | Banker's first two cards share a rank | 11:1 | same |

Main bets (Player/Banker) push on a Tie. Tie, Dragon 7, Panda 8 and Pair bets are lost when they don't hit.
Commission (classic tables): deducted from the winnings of each winning Banker bet immediately (as at mini-bac
tables), tracked as `commissionPaid` and shown in a "commission box".

### Casino procedure
* **New shoe**: shuffle, cut, insert the cut card `cutCardFromEnd` (default 14) cards from the end.
  **Burn procedure** (when on): turn the first card face up; its value decides how many additional cards are
  burned face down — 2–9 face value, Ace = 1, 10/J/Q/K = 10. The exposed card is visible (counts for card
  counting); burned cards are not.
* **Cut card**: when the cut card comes out during a hand, that hand is completed normally, **one more hand** is
  dealt, and then the shoe ends (new shoe). `ShoeInfo.lastHandNext` tells the UI to show "Last hand of the shoe".
* Table limits: main bets `limits.main` (default $10–$5,000), Tie `limits.tie` (default $5–$500), side bets
  `limits.side` (default $5–$500). Minimums are enforced at DEAL time (a bet below min blocks dealing); maximums
  are enforced when placing chips. The total on the layout can never exceed the bankroll.
* Chips (US casino colours): $1 white, $5 red, $25 green, $100 black, $500 purple, $1,000 orange ("pumpkin"),
  $5,000 brown. Default tray: 1, 5, 25, 100, 500, 1000. Default bankroll $1,000.
* Third cards are placed **sideways** (rotated 90°) next to the first two cards, as dealers do.

## 3. Exact probabilities (ground truth)

Computed by exact enumeration (`tools/enumerate_probabilities.py`, output in `docs/probabilities.json`).
These must be embedded in `src/engine/probabilities.ts` and used by the Learn mode and the Coach, and the Monte
Carlo verification tests must agree with them within statistical tolerance.

**8 decks**

| Event | Probability |
|---|---|
| Player wins | 0.4462466093 |
| Banker wins | 0.4585974226 |
| Tie | 0.0951559680 |
| Dragon 7 (Banker wins with 3-card 7) | 0.0225338209 |
| Panda 8 (Player wins with 3-card 8) | 0.0345432184 |
| Banker wins with a 6 | 0.0538637159 |
| Natural 8/9 on Player (resp. Banker) two cards | 0.1894346617 each |
| Pair (first two cards of a side) | 0.0746987952 (= 31/415) |
| Hand uses 4 / 5 / 6 cards | 0.3788684909 / 0.3034441685 / 0.3176873406 |

| Bet (8 decks) | House edge |
|---|---|
| Player 1:1 | 1.2351% |
| Banker, 5% commission | 1.0579% |
| Banker, EZ (push on Dragon 7) | 1.0183% |
| Banker, Super 6 | 1.4581% |
| Tie 8:1 | 14.3596% |
| Tie 9:1 | 4.8440% |
| Dragon 7 at 40:1 | 7.6113% |
| Panda 8 at 25:1 | 10.1876% |
| Player/Banker Pair at 11:1 | 10.3614% |

**6 decks**: Player 0.4462785698, Banker 0.4586527188, Tie 0.0950687113, Dragon 7 0.0225350755, Panda 8
0.0345356218, Banker-6 0.0538444511, pair 0.0739549839 (= 23/311).
House edges: Player 1.2374%, Banker commission 1.0558%, Banker EZ 1.0161%, Super 6 1.4548%, Tie 8:1 14.4382%,
Tie 9:1 4.9313%, Dragon 7 7.6062%, Panda 8 10.2074%, Pair 11.2540%.

**Effect of removal (8 decks)** — change in the bet's EV (per unit wagered) when one card of that value is removed
from a full shoe. Positive = the bet gets better when that card leaves the shoe. (`docs/probabilities.json → decks_8.eor`)

| Card value | Dragon 7 | Panda 8 |
|---|---|---|
| 0 (10/J/Q/K) | +0.000863 | +0.001208 |
| 1 (Ace) | +0.000498 | +0.001322 |
| 2 | −0.000896 | +0.001444 |
| 3 | −0.001076 | −0.002861 |
| 4 | −0.002680 | −0.002536 |
| 5 | −0.002635 | −0.002655 |
| 6 | −0.003242 | −0.000892 |
| 7 | −0.003584 | −0.000914 |
| 8 | +0.005378 | −0.002241 |
| 9 | +0.004785 | +0.004502 |

Known card-counting system for the Dragon 7 (Jacobson): tags 4,5,6,7 = −1; 8,9 = +2; all others 0 (balanced);
bet Dragon 7 when the true count (running count ÷ decks remaining) is ≥ 4. The Panda 8 count must be DERIVED from
the EOR table (choose a balanced integer tag set with the best correlation to the EORs) and VALIDATED by
simulation (realized EV of the bet when the true count is at/above the threshold must be positive).

## 4. Architecture

```
src/
  engine/      pure TS game engine (no React). Owns types.ts (the contract).
  roads/       roadmap algorithms (pure TS) + SVG React components to draw them
  strategy/    bet selectors, betting systems, counting systems, Monte Carlo simulator + Web Worker
  ui/
    shell/     App chrome: nav, theme, settings, shared components (PlayingCard, Chip, Modal, ...), hooks
    play/      the casino table
    learn/     lessons (learn/lessons/*) and drills (learn/drills/*)
    lab/       Strategy Lab
  styles/      global.css (design tokens), fonts
  App.tsx, main.tsx
e2e/           Playwright smoke tests (Chromium is installed)
tools/         enumerate_probabilities.py (exact math)
docs/          SPEC.md (this), probabilities.json, COUNTING.md (written by the strategy module)
```

Conventions
* TypeScript strict. Named exports. Each module has an `index.ts` barrel; import other modules ONLY through
  `@/engine`, `@/roads`, `@/strategy`, `@/ui/shell` (alias `@` = `src`).
* Tests: Vitest, co-located `*.test.ts` / `*.test.tsx`. Pure TS tests run in node; React tests start with the
  comment `// @vitest-environment jsdom` and use `@testing-library/react`. Run a module's tests with
  `npx vitest run src/<dir>`. Type-check with `npx tsc -p tsconfig.app.json --noEmit`.
* Styling: CSS Modules (`Name.module.css`) + the global design tokens in `src/styles/global.css`.
  No inline-style theming beyond dynamic values (positions, sizes).
* **No new npm dependencies.** Charts are hand-rolled SVG. Sounds are synthesized with the Web Audio API.
* Determinism: everything random goes through the engine's seeded RNG so hands and simulations are reproducible.
* Accessibility: real `<button>`s, visible focus, `aria-live="polite"` for the dealer's calls, never colour alone
  (always a letter/label too: P / B / T).
* Persist user settings (rules, bankroll, preferences, drill scores, saved lab runs) in `localStorage` under
  keys prefixed `bt:`; wrap reads/writes in try/catch.

## 5. Module contracts

### 5.1 `src/engine` (pure TypeScript, no DOM)

Files: `types.ts` (given, do not modify), `cards.ts`, `rng.ts`, `shoe.ts`, `rules.ts`, `deal.ts`, `settle.ts`,
`session.ts`, `probabilities.ts`, `index.ts`.

```ts
// rng.ts
export interface Rng { readonly seed: number; next(): number /* [0,1) */; nextInt(maxExclusive: number): number }
export function createRng(seed?: number): Rng;        // mulberry32 or xoshiro; omitted seed → crypto random seed
export function randomSeed(): number;

// cards.ts
export const RANKS: readonly Rank[]; export const SUITS: readonly Suit[];
export function cardValue(rank: Rank): number;        // A=1, 2-9, T/J/Q/K=0
export function handTotal(cards: readonly Card[]): number;
export function cardLabel(card: Card): string;        // e.g. "A♠", "T♥"  (T shown as "10")
export function rankLabel(rank: Rank): string;        // "10" for T
export function buildDecks(decks: number): Card[];    // unshuffled, ids assigned after shuffle by Shoe

// rules.ts
export function playerDraws(playerTotal: number): boolean;                                 // total <= 5
export function bankerDraws(bankerTotal: number, playerThirdCardValue: number | null): boolean; // table in §2
export function isNatural(total: number): boolean;                                         // >= 8
export const DEFAULT_RULES: TableRules;   // 8 decks, 'ez', tie 8, D7 40, P8 25, pairs 11, all side bets on,
                                          // limits main 10–5000 / tie 5–500 / side 5–500, cut 14, burn on, chips [1,5,25,100,500,1000]
export const RULE_PRESETS: Record<'ez' | 'commission' | 'super6', { name: string; description: string; rules: TableRules }>;
export function validateRules(rules: TableRules): string[];   // human-readable problems, [] if ok

// shoe.ts
export class Shoe {
  constructor(rules: TableRules, rng: Rng, shoeNumber?: number);  // shuffles, places cut card, runs burn procedure
  readonly shoeNumber: number;
  readonly totalCards: number;
  readonly cutCardIndex: number;         // drawing the card at this index (or beyond) sets cutCardReached
  readonly exposedBurnCard: Card | null;
  readonly burnedCards: Card[];          // face-down burned cards (not "seen")
  cutCardReached: boolean;
  draw(): Card;                          // throws RangeError if empty
  cardsRemaining(): number;
  cardsDealt(): number;                  // includes exposed + burned
  info(handsDealt: number, lastHandNext: boolean): ShoeInfo;
}

// deal.ts
export interface DealOptions { withSteps?: boolean /* default true */ }
export function dealHand(shoe: Shoe, rules: TableRules, handNumber: number, opts?: DealOptions): HandResult;
//  - draws cards in casino order, applies §2 exactly, fills every HandResult field,
//  - steps order: deal P0, deal B0, deal P1, deal B1, (bonus playerPair/bankerPair), show,
//      then either natural, or [stand|draw player, (deal P2)], [stand|draw banker, (deal B2)],
//      result, (bonus dragon7 / panda8), (cutCard if cut card came out during this hand).
//  - messages are dealer calls: "Card to Player", "Player shows 5, Banker shows 3", "Natural 9 — Player",
//      "Player stands", "Player draws", "Banker draws", "Banker wins, 7 over 5", "Player wins, 8 over 3",
//      "Tie, 6 and 6", "Dragon 7!", "Panda 8!", "Player Pair", "Banker Pair",
//      "Cut card — one more hand, then a new shoe".
//  - withSteps:false must allocate as little as possible (used for millions of simulated hands).
export function evaluateHand(playerCards: Card[], bankerCards: Card[]): Pick<HandResult, 'playerTotal'|'bankerTotal'|'outcome'|'playerNatural'|'bankerNatural'|'dragon7'|'panda8'|'playerPair'|'bankerPair'|'bankerWinOn6'>;
//  - pure evaluator for already-dealt cards (used by Learn drills with hand-made cards)
export function dealFromValues(playerValues: number[], bankerValues: number[]): ... // optional helper for tests/drills

// settle.ts
export function settleBets(bets: Bets, result: HandResult, rules: TableRules): HandSettlement;   // §2 payouts exactly
export function payoutMultiplier(bet: BetType, rules: TableRules): number;                       // 1, tiePays, 40, 25, 11
export function validateBet(bet: BetType, amount: number, rules: TableRules): string | null;     // max / enabled checks
export function validateLayout(bets: Bets, rules: TableRules): string[];                         // min checks at deal time

// probabilities.ts  (constants from §3; both deck counts)
export interface ExactProbabilities { player: number; banker: number; tie: number; dragon7: number; panda8: number;
  bankerWin6: number; natural: number; pair: number; cards4: number; cards5: number; cards6: number }
export function exactProbabilities(decks: 6 | 8): ExactProbabilities;
export function houseEdge(bet: BetType, rules: TableRules): number;    // POSITIVE fraction, e.g. 0.010183 for EZ Banker
export function expectedValue(bet: BetType, amount: number, rules: TableRules): number;  // negative number = expected loss
export function winProbability(bet: BetType, rules: TableRules): number;
export const EOR_8_DECKS: Record<'dragon7' | 'panda8', number[]>;    // index = card value 0..9, from §3

// session.ts
export interface SessionOptions { rules?: TableRules; bankroll?: number; seed?: number }
export interface PlaceBetResult { ok: boolean; reason?: string }
export interface DealOutcome { result: HandResult; settlement: HandSettlement; newShoeStarted: boolean }
export class GameSession {
  constructor(opts?: SessionOptions);
  getState(): SessionState;                         // immutable snapshot; a NEW object after every mutation
  subscribe(listener: (s: SessionState) => void): () => void;   // for React useSyncExternalStore
  placeBet(bet: BetType, amount: number): PlaceBetResult;       // adds to existing amount; enforces max, enabled, bankroll
  removeChip(bet: BetType): void;                   // undo the last chip placed on that spot (keep a per-spot chip stack)
  undoLastChip(): void;                             // undo the most recent chip placed anywhere
  clearBets(): void;
  rebet(): PlaceBetResult;                          // restore lastBets if affordable
  canDeal(): { ok: boolean; reason?: string };      // needs ≥1 bet, all bets ≥ their minimum
  deal(): DealOutcome;                              // deals, settles, updates bankroll/stats/history, clears bets into lastBets,
                                                    // handles cut card → one more hand → new shoe automatically
  newShoe(): void;                                  // force a fresh shoe (between hands)
  setRules(rules: TableRules): void;                // between hands; starts a new shoe
  setBankroll(amount: number): void;                // "buy in" / reset; keeps history
  reset(opts?: SessionOptions): void;               // fresh session
}
```

Performance target: `dealHand(..., {withSteps:false})` ≥ 300,000 hands/second in node on a laptop.

Tests required (engine): every row of the third-card table; naturals; all payout rules per variant incl. Dragon 7
push on EZ Banker, Super 6 half pay, commission; pairs independent of outcome; tie pushes main bets; shoe
composition (416 unique ids, 32 of each rank); burn procedure counts; cut card → exactly one more hand → new
shoe; seeded reproducibility; limits/bankroll validation; stats bookkeeping; and a seeded **Monte Carlo test of
≥ 2,000,000 hands** asserting frequencies within ±0.1% absolute of Player/Banker/Tie and within ±0.05% of
Dragon 7 / Panda 8 / pair probabilities in §3.

### 5.2 `src/roads` (pure TS + SVG components)

```ts
export interface RoadResult { outcome: Outcome; playerPair?: boolean; bankerPair?: boolean; dragon7?: boolean; panda8?: boolean }
// HandResult satisfies RoadResult.

export interface BeadCell { col: number; row: number; outcome: Outcome; playerPair: boolean; bankerPair: boolean; dragon7: boolean; panda8: boolean; handIndex: number }
export function beadPlate(results: readonly RoadResult[], rows?: number /* 6 */): BeadCell[];   // column-major, top to bottom

export interface BigRoadCell { col: number; row: number; outcome: Side; ties: number; playerPair: boolean; bankerPair: boolean; handIndex: number; logicalCol: number; logicalRow: number }
export interface BigRoadColumn { outcome: Side; length: number; startCol: number }
export interface BigRoad { cells: BigRoadCell[]; columns: BigRoadColumn[]; leadingTies: number; width: number; rows: number }
export function bigRoad(results: readonly RoadResult[], rows?: number): BigRoad;

export type DerivedKind = 'bigEye' | 'small' | 'cockroach';
export type RoadColor = 'red' | 'blue';
export interface DerivedCell { col: number; row: number; color: RoadColor; index: number }
export interface DerivedRoad { kind: DerivedKind; entries: RoadColor[]; cells: DerivedCell[]; width: number; rows: number }
export function derivedEntries(columns: readonly BigRoadColumn[], kind: DerivedKind): RoadColor[];   // pure algorithm
export function derivedRoad(big: BigRoad, kind: DerivedKind, rows?: number): DerivedRoad;
export function predictNext(results: readonly RoadResult[], next: Side): Record<DerivedKind, RoadColor | null>;
export function roadStats(results: readonly RoadResult[]): { total: number; player: number; banker: number; tie: number;
  playerPair: number; bankerPair: number; dragon7: number; panda8: number; currentStreak: StreakInfo;
  longestPlayer: number; longestBanker: number };
```

Algorithms (must be exact — casinos' electronic displays follow these):

* **Bead plate**: every hand, in order, fills a 6-row grid column by column, top to bottom (P blue, B red, T green),
  with small pair markers (blue dot top-left = Player Pair, red dot bottom-right = Banker Pair).
* **Big road**: only Player/Banker results create cells; same outcome continues DOWN the current column, a change
  starts a new column at row 1. A **tie** does not create a cell: it is recorded as a tie mark (green slash) on the
  most recent cell (`ties` incremented); ties before any P/B are `leadingTies` (rendered as a green mark at col 1
  row 1 until the first cell overwrites it, carrying the count). **Dragon tail**: when the next cell down is off the
  grid (row > rows) OR already occupied, the cell goes RIGHT instead (same row, col + 1) and keeps going right. A new
  logical column starts at physical col = previous logical column's `startCol + 1`, row 1 (if occupied, keep moving
  right until free). `columns` holds the LOGICAL columns (full streak lengths, independent of tails).
* **Derived roads** (big eye boy k=1, small k=2, cockroach k=3) are computed from the LOGICAL columns, ties
  ignored. Let `L[c]` be the length of logical column `c` (1-based). Walk the big road cells in order; for the
  entry at logical (c, r):
  * `r === 1` (new column): requires `c >= k + 2`; colour = red if `L[c-1] === L[c-1-k]` else blue
    (compare the two columns that are 1 and 1+k to the left, using their lengths *as of that moment*, which are final).
  * `r >= 2`: requires `c >= k + 1`; look at column `c-k`: red if `L[c-k] >= r`; blue if `L[c-k] === r-1`;
    red if `L[c-k] <= r-2`.
  * The first entries therefore appear at big-road (2,2)/(3,1) for big eye boy, (3,2)/(4,1) small, (4,2)/(5,1) cockroach.
  * Entries are drawn like the big road: same colour continues down, colour change starts a new column, with the
    same dragon-tail rule.
* **predictNext**: append a hypothetical P or B result and return the colour of the NEW entry each derived road
  would get (null if none would be produced).

Components (`src/roads/components/`, SVG, scale with `viewBox`, auto-scroll to show the newest columns, props typed):
`<BeadPlateView results cols rows />`, `<BigRoadView results cols rows />`, `<DerivedRoadView results kind cols rows />`,
and `<Scoreboard results prediction? onPredict? />` — the casino display: bead plate left, big road top right, the
three derived roads below it, a counts strip (P/B/T, pairs, D7, P8, hand count) and "Ask P" / "Ask B" prediction
buttons that highlight what each derived road would show. Symbols as on real displays: big eye boy = hollow
circles, small road = solid dots, cockroach = slashes; big road = hollow circles (red B / blue P) with a letter
inside, tie = green diagonal stroke with a count when > 1, pairs = small dots.

Tests required (roads): hand-built sequences with known outputs for all three derived roads (derive them BY HAND
from the rules above and show the derivation in comments), tie handling, leading ties, dragon tail wrapping and
collisions, predictNext, and a property test that derived entries equal the first N entries when results are
truncated (prefix stability).

### 5.3 `src/strategy` (pure TS + Web Worker)

```ts
export type MainChoice = 'player' | 'banker' | 'skip';
export interface StrategyContext {
  shoeHistory: readonly HandResult[]; lastOutcome: Outcome | null; streak: StreakInfo;
  shoe: { cardsRemaining: number; decksRemaining: number; cutCardReached: boolean };
  counts: { dragon7: CountState; panda8: CountState };
  bankroll: number; unit: number; sessionNet: number; handsPlayed: number;
  lastMainResult: BetResult | null; rules: TableRules;
}
export interface CountState { running: number; trueCount: number }

export interface BetSelector { id: string; name: string; description: string; select(ctx: StrategyContext): MainChoice }
export const BET_SELECTORS: readonly BetSelector[];   // alwaysBanker, alwaysPlayer, followLast ("follow the streak"),
   // betAgainstLast ("chop"), followAfterN (follow a streak of ≥3, else skip), alternate, bigRoadTrend (bet the side
   // that has the longer average column), tieChaser? NO (tie is a main bet only via explicit config), random
export interface BettingSystem { id: string; name: string; description: string; create(unit: number, params?: Record<string, number>): SystemState }
export interface SystemState { nextBet(): number; record(result: BetResult): void; reset(): void; readonly progressionIndex?: number }
export const BETTING_SYSTEMS: readonly BettingSystem[];  // flat, martingale (maxDoublings), grandMartingale, paroli (winsToReset),
   // oneThreeTwoSix, fibonacci, dAlembert, labouchere (sequence), oscarsGrind

export interface CountSystem { id: string; name: string; description: string; tags: number[] /* [0..9] by card value */; threshold: number }
export const DRAGON7_COUNT: CountSystem;   // Jacobson tags (§3), threshold 4
export const PANDA8_COUNT: CountSystem;    // derived from EOR, validated; document in docs/COUNTING.md
export function runningCount(cards: readonly Card[], system: CountSystem): number;
export function trueCount(running: number, cardsRemaining: number): number;   // running / max(decksRemaining, 0.5)
export function countStates(seenCards: readonly Card[], cardsRemaining: number): { dragon7: CountState; panda8: CountState };

export interface SideBetPolicy { dragon7: 'never' | 'always' | 'count'; panda8: 'never' | 'always' | 'count'; units: number }
export interface StrategyConfig { selectorId: string; systemId: string; systemParams?: Record<string, number>; unit: number; sideBets: SideBetPolicy }
export interface SimConfig { rules: TableRules; strategy: StrategyConfig; bankroll: number; shoesPerTrial: number; trials: number;
  seed: number; stopLoss?: number; stopWin?: number; sampleCurves?: number /* default 20 */; curvePoints?: number /* default 200 */ }
export interface SimResult {
  config: SimConfig; trials: number; handsPlayed: number; handsBet: number; totalWagered: number; net: number;
  realizedEdge: number;            // -net / totalWagered
  meanFinal: number; medianFinal: number; stdFinal: number; percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  pProfit: number; pRuin: number;  // ruin = bankroll hit 0 (or stopLoss)
  meanMaxDrawdown: number; worstDrawdown: number;
  histogram: { binStart: number; binEnd: number; count: number }[];
  sampleCurves: number[][];        // first N trials, bankroll sampled at curvePoints evenly spaced hands
  sideBets: Record<'dragon7' | 'panda8', { bets: number; wins: number; wagered: number; net: number }>;
  byOutcome: { player: number; banker: number; tie: number };
  elapsedMs: number;
}
export function runSimulation(config: SimConfig, onProgress?: (done: number, total: number) => void): SimResult; // sync, deterministic
export function simulateInWorker(config: SimConfig, onProgress?: (done: number, total: number) => void): { promise: Promise<SimResult>; cancel(): void };
//  worker.ts: `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`
export function describeStrategy(config: StrategyConfig): string;

// Simulated side-bet EV by true-count bucket (from >= 50,000 shoes), used by the Learn mode and the Coach:
export interface CountEvRow { tcMin: number; tcMax: number /* exclusive, Infinity for the top bucket */; hands: number; frequency: number /* share of all hands */; ev: number /* per unit wagered, e.g. +0.03 */ }
export const COUNT_EV_TABLE: Record<'dragon7' | 'panda8', CountEvRow[]>;   // buckets like [-Inf,-2), [-2,0), [0,2), [2,4), [4,6), [6,8), [8,Inf)
```

The simulator MUST use `dealHand`/`settleBets` from `@/engine` (one code path for play and simulation) with
`withSteps:false`, and a seeded RNG (`createRng(seed + trial)`). Side bet `count` policy: bet `units × unit`
on Dragon 7 / Panda 8 only when that count's true count ≥ its system threshold (counts computed from all
face-up cards in the shoe, including the exposed burn card, exactly as a player at the table could).

Also: `docs/COUNTING.md` — derive the Panda 8 count from the EOR table (show correlation of candidate tag sets),
and report simulated EV per true-count bucket for both counts (≥ 50,000 shoes), choosing thresholds where the
realized EV is positive. Expose the per-bucket table as `COUNT_EV_TABLE` for the Learn mode.

Tests required (strategy): each system's progression on fixed win/lose sequences; selectors on fixed histories;
counts on fixed cards; simulation determinism (same seed → identical result); realized edge of always-Banker flat
betting over ≥ 200,000 hands within ±0.3% of the exact EZ Banker edge; martingale shows higher pRuin than flat.

### 5.4 `src/ui/shell`

* `App.tsx`: top bar (brand plaque "Baccarat Trainer", mode tabs Play / Learn / Strategy Lab, bankroll pill,
  settings gear, sound toggle), routes by `location.hash` (`#play`, `#learn`, `#learn/<lessonId>`, `#lab`).
* `src/styles/global.css`: design tokens as CSS variables (`--felt`, `--felt-deep`, `--rail`, `--gold`, `--ivory`,
  `--banker`, `--player`, `--tie`, `--card-bg`, `--shadow-*`, spacing/radius scale, font families) and base styles.
  Fonts via Google Fonts `<link>` in `index.html` (Cinzel + Inter). Dark casino theme only.
* Shared components in `src/ui/shell/components/`: `PlayingCard` (SVG card: rank + suit pips, red/black, face-down
  back pattern, `rotated` for third cards, sizes), `Chip` (CSS casino chip with denomination, colour by value,
  stacked chips `ChipStack`), `Button`, `Modal`, `Tabs`, `Stat`, `Plaque` (gold-framed label), `Toggle`,
  `NumberInput`, `Select`, `Tooltip`.
* Hooks in `src/ui/shell/hooks/`: `useSession()` (singleton `GameSession` via `useSyncExternalStore`),
  `useLocalStorage`, `useSettings()` (rules + prefs: sound on/off, dealing speed, show coach, beginner tips),
  `useSound()` (Web Audio synthesized: chip place, card deal, card flip, win, lose; never throws).
* `SettingsDialog`: rules preset + full rule editor (decks, banker rule, tie pays, side bets on/off, limits,
  cut card, burn procedure), bankroll buy-in, preferences. Changing rules starts a new shoe (warn).
* Export `src/ui/shell/index.ts` with all of the above.

### 5.5 `src/ui/play`

`<PlayView />` — the casino table, built on `useSession()` and `@/roads` `<Scoreboard/>`.
* Layout (desktop): left/centre = table; right column = scoreboard + hand history; collapsible Coach panel.
  Mobile: table on top, scoreboard below, Coach in a drawer.
* Table felt: card areas top ("PLAYER" left in blue, "BANKER" right in red) with totals shown; the shoe at top
  right with a cut-card indicator and cards remaining; betting spots along the bottom arc: PLAYER PAIR,
  PLAYER (1:1), TIE (8:1), BANKER (1:1 / "no commission"), BANKER PAIR; DRAGON 7 (40:1) and PANDA 8 (25:1) spots
  in the middle band. Limits plaque ("Min $10 — Max $5,000"). Commission box when the classic rule is active.
* Chip tray with denominations; click a chip to select, click a spot to add it; chips stack on the spot with the
  total; right-click/long-press or an "undo" button removes the last chip. Keyboard: 1–6 select chip, P/B/T place
  on Player/Banker/Tie, D Dragon 7, N Panda 8, Space deal, R rebet, C clear, U undo, A auto-deal.
* Dealing animation driven by `HandResult.steps`: cards slide from the shoe to their slot and flip, third cards
  sideways, each step's message shown in the dealer bar (`aria-live`), with per-step delays scaled by the speed
  setting (and an "instant" option). Then settlement: winning spots show the payout chips, losing chips are
  swept, pushes stay; bankroll animates to the new value. Then the result is pushed to the roads/history.
* New shoe sequence: "Shuffling…", cut card placed, exposed burn card shown with "Burning N cards", then play.
  Banner "Last hand of the shoe" when `lastHandNext`.
* Controls: DEAL (disabled with reason when `canDeal()` fails), REBET, CLEAR, UNDO, AUTO (auto-rebet and deal
  continuously until stopped or bankroll can't cover), speed selector, New shoe, Buy-in.
* Hand history list (newest first): hand #, P cards/total, B cards/total, outcome, bonuses, your net.
* Coach panel: each bet on the layout with house edge % and expected loss in $; Dragon 7 and Panda 8 running &
  true count with a recommendation ("True count 4.6 ≥ 4 — Dragon 7 is +EV now"); current streak; session stats
  (hands, net, wagered, realized edge); "beginner tips" toggle that adds a one-line explanation for each dealer call
  ("Player has 5, so Player draws").
* Session stats panel: wins/losses by bet type, biggest win, peak/low bankroll, commission paid.

### 5.6 `src/ui/learn`

`<LearnView />` with a lesson sidebar/list and `<Drill>` entry points. Lessons are data + components under
`src/ui/learn/lessons/` (ids: `basics`, `third-card`, `bets-and-odds`, `dragon-panda`, `roads`, `money`,
`counting`, `casino-procedure`), each with sections, callouts and interactive widgets:
* basics: table layout tour (uses the same spot names/colours), card values quiz-let, a step-through sample hand.
* third-card: the full table, an interactive explorer (choose totals + P3 → explanation of Banker's action).
* bets-and-odds: payout table with exact probabilities/house edges from `@/engine` for the active rules; "cost of
  play" calculator (bet × hands/hour × edge).
* dragon-panda: how the push makes EZ Banker commission-free; why 40:1 and 25:1 still carry 7.6% / 10.2% edges;
  frequency (once per ~44 / ~29 hands).
* roads: each road explained with live rendered examples (fixed sequences through `@/roads` components), the
  "ask road" idea, and the honest statement that roads describe the past and do not predict.
* money: bankroll sizing, betting systems explained with their failure mode, link into the Lab with presets.
* counting: Dragon 7 and Panda 8 counts (tags, running/true count, thresholds) with the simulated EV table from
  `@/strategy` `COUNT_EV_TABLE`, realistic expectations and casino constraints.
* casino-procedure: shoe, cut card, burn, commission, limits, squeeze, etiquette, EZ vs classic vs Super 6.

Drills under `src/ui/learn/drills/` with a score header (correct/attempted, streak) saved to localStorage:
`ThirdCardDrill` (random legal situation → "Does Banker draw?" / "Does Player draw?"), `PayoutDrill` (random
bets + result → enter net), `BestBetDrill` (which of these bets has the lowest house edge?), `RoadDrill` (given
a big road, what colour is the next big eye boy / small / cockroach entry for a P or B?), `CountingDrill`
(cards flash at a chosen pace; enter the running count).

### 5.7 `src/ui/lab`

`<LabView />`: a config form (rules preset, bet selector, betting system + params, unit, bankroll, shoes/trial,
trials, stop loss/win, side-bet policy, seed with "randomize"), Run/Cancel with a progress bar (worker), and
results: summary stats cards, an SVG histogram of final bankrolls, an SVG line chart of sample bankroll curves
(with the starting bankroll line), side-bet stats, realized edge vs. exact edge, and a "saved runs" comparison
table (localStorage) for up to 6 runs. Presets: "Flat Banker", "Martingale on Player", "Count Dragon 7",
"Paroli on streaks", "1-3-2-6 Banker".

## 6. Quality bar

* `npm run typecheck`, `npm test`, `npm run build` all pass. `npm run e2e` runs a Playwright smoke test that
  loads the app, places a bet, deals a hand, visits Learn and runs a Lab simulation.
* No console errors in the browser. No layout overflow at 380px, 768px, 1440px.
* The game is correct to the exact probabilities in §3 (verified by the Monte Carlo tests).
