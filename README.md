# Baccarat Trainer

A casino-faithful **EZ Baccarat** simulator and trainer with the **Dragon 7** and **Panda 8** side bets, in one
single-page app (Vite + React 18 + TypeScript, no UI framework): **Play** at a real-looking table, **Learn** the game
in eight lessons with scored drills, and prove in the **Strategy Lab** that no betting system beats the house edge —
and where the only real edge (counting the side bets) comes from.

## Modes

### Play — the casino table
* Felt layout with the EZ Baccarat spots: Player Pair · Player · Tie · Banker · Banker Pair along the bottom arc,
  Dragon 7 (40:1) and Panda 8 (25:1) in the middle band; Banker red, Player blue, Tie green, as on casino displays.
* Real chip denominations in US colours ($1 white, $5 red, $25 green, $100 black, $500 purple, $1,000 "pumpkin",
  $5,000 brown, $25,000 grey, $100,000 gold plaque), a bankroll, a limits plaque naming the table ("$10 mini-baccarat",
  "Min $10 — Max $5,000", Tie and side bets $5–$500), buy-in and rebuy.
* **Table levels**: five Las Vegas stakes tiers in Settings → Rules — $10 mini-baccarat, $25 main floor, $100
  midi-baccarat, $500 high-limit salon ($500–$100,000) and the $5,000 special limit ($5,000–$250,000) — each with its
  own Tie and side-bet limits and chip tray, plus custom limits. Switching tables resets the bankroll to the table's
  suggested buy-in (100 × the minimum) while the session stats carry on; the lessons and the Lab follow the table too.
  At a new table you pick up its base chip, and a rebet is only offered while the last bets are dealable there.
* Casino procedure: an 8-deck (or 6-deck) shoe with the cut card 14 cards from the end, the burn procedure (first card
  exposed, that many cards burned), card-by-card dealing with the dealer's calls ("Card to Player", "Player shows 5,
  Banker shows 3", "Player draws", "Banker wins, 7 over 5", "Dragon 7!"), third cards placed sideways, the
  "Last hand of the shoe" banner, and the shuffle / cut / burn sequence of every new shoe.
* Settlement animation: winners get their payout chips, losers are swept, pushes stay; the bankroll counts up or
  down; the top-bar pill follows the table so the result is never revealed early.
* The complete scoreboard — bead plate, big road, big eye boy, small road, cockroach pig — with "Ask P / Ask B"
  prediction, hand history with every card, session statistics and a Coach panel (house edge and expected loss of the
  bets on the layout, Dragon 7 and Panda 8 running/true counts with a recommendation, streak, realized edge,
  one-line "why" explanations of every dealer call).
* Rule variants in Settings: EZ (default), classic 5% commission (with a commission box), Super 6; 6 or 8 decks;
  Tie 8:1 or 9:1; side bets on/off; table level, limits, cut card, burn procedure and the chip tray are all editable.
* Keyboard: `1`–`9` select a chip, `P` `B` `T` place on Player / Banker / Tie, `D` Dragon 7, `N` Panda 8, `Space` deal
  (or fast-forward), `R` rebet, `C` clear, `U` undo, `A` auto-deal; `Tab` + `Enter` reach every control.

### Learn — lessons and drills
Eight lessons (`#learn/<id>`): basics, third-card rules, bets and odds, Dragon 7 & Panda 8, reading the roads, money
management, counting the side bets, casino procedure. Every figure is computed from the engine for the table rules
you have set; the examples are live widgets (table tour, step-through hands, third-card explorer, road examples with
"ask road", counting walkthrough, Martingale explorer, cost-of-play calculator). Five scored drills under
`#learn/drills`: third-card rules, payouts, best bet, reading the roads, card counting. Scores and completed lessons
are saved on the device.

### Strategy Lab
Monte Carlo simulation in a Web Worker: a bet selector (always Banker / Player, follow the streak, chop, big-road
trend, random, …), a betting system (flat, Martingale, grand Martingale, Paroli, 1-3-2-6, Fibonacci, Labouchere), unit, bankroll,
shoes per trial, trials, stop loss / stop win, a side-bet policy (never / every hand / only when the count says so)
and a seed. Results: summary cards in plain English, a histogram of final bankrolls, sample bankroll curves, side-bet
statistics, the outcome mix, the realized house edge against the exact edge, and a comparison table of up to six
saved runs. Presets: Flat Banker, Martingale on Player, Count Dragon 7, Paroli on streaks, 1-3-2-6 Banker (the
lessons link to them as `#lab/<presetId>`).

## Rules and exact house edges

Exact figures from the full enumeration in `tools/enumerate_probabilities.py` (`docs/probabilities.json`), embedded
in `src/engine/probabilities.ts` and verified by the engine's Monte Carlo tests.

| Bet | Pays | House edge, 8 decks | House edge, 6 decks |
|---|---|---|---|
| Player | 1:1 | 1.2351% | 1.2374% |
| Banker, classic 5% commission | 1:1 − 5% | 1.0579% | 1.0558% |
| Banker, EZ (push on Dragon 7) | 1:1 | 1.0183% | 1.0161% |
| Banker, Super 6 (6 pays half) | 1:1 / 1:2 | 1.4581% | 1.4548% |
| Tie 8:1 | 8:1 | 14.3596% | 14.4382% |
| Tie 9:1 | 9:1 | 4.8440% | 4.9313% |
| Dragon 7 | 40:1 | 7.6113% | 7.6062% |
| Panda 8 | 25:1 | 10.1876% | 10.2074% |
| Player / Banker Pair | 11:1 | 10.3614% | 11.2540% |

Outcome probabilities (8 decks): Player 44.62%, Banker 45.86%, Tie 9.52%; Dragon 7 2.25% (once per ~44 hands),
Panda 8 3.45% (once per ~29 hands).

A Dragon 7 is a Banker **win** with a **three-card** 7 (a two-card 7 or a 7–7 tie is not one); a Panda 8 is a Player
**win** with a **three-card** 8. At an EZ table a winning Banker bet pushes on the Dragon 7 — that push is what
replaces the commission. Commission is deducted from each winning Banker bet as it is paid (rounded to the cent).

## Card counting

* **Dragon 7** (Jacobson): 4, 5, 6, 7 count −1; 8, 9 count +2; bet at a true count of +4 or more — about 10% of
  hands, worth about +7.7% of a unit on those hands.
* **Panda 8**: 10/J/Q/K, Ace and 2 count +1; 3, 4, 5 count −2; 7, 8 count −1; 9 counts +2; bet at +8 or more —
  about 6% of hands, worth about +4.8%.
* True count = running count ÷ decks remaining (never less than half a deck); the exposed burn card counts, the
  face-down burned cards do not. The EV-by-true-count table (`src/strategy/countEvTable.ts`) comes from 500,000
  simulated shoes; the derivation is in `docs/COUNTING.md`.

## Run and test

Node 24 (any current LTS works), no network needed except for the Google Fonts (Cinzel + Inter; system fonts are the
fallback).

```
npm install
npm run dev          # Vite dev server
npm run typecheck    # tsc, no emit
npm test             # vitest (engine, roads, strategy, UI)
npm run build        # production build in dist/
npm run e2e          # Playwright smoke tests (builds, serves dist/ on :4173; BT_BASE_URL=http://localhost:5173 targets a dev server)
```

The engine's Monte Carlo tests deal more than two million hands and must agree with the exact probabilities; the
whole test suite runs in well under a minute.

## Project layout

```
src/engine      pure TypeScript: cards, shoe (cut card, burn), third-card rules, dealing with dealer calls,
                settlement, exact probabilities / house edges, GameSession (bankroll, chips, stats, roads history)
src/roads       bead plate, big road, derived roads (big eye boy, small road, cockroach pig), ask-road prediction,
                SVG scoreboard components
src/strategy    bet selectors, betting systems, count systems, EOR tables, Monte Carlo simulator + Web Worker
src/ui/shell    app chrome, routing (#play, #learn/<id>, #lab), settings, persisted stores, shared components
src/ui/play     the table: felt, spots, chips, animation timeline, coach, history, keyboard shortcuts
src/ui/learn    lessons (src/ui/learn/lessons) and drills (src/ui/learn/drills)
src/ui/lab      the Strategy Lab form, charts, results and saved runs
src/styles      design tokens and base styles (dark casino theme)
e2e             Playwright smoke tests
tools           enumerate_probabilities.py (exact enumeration)
docs            SPEC.md (product and architecture), COUNTING.md, probabilities.json
demo            baccarat-demo.html, a static design mock-up of the table (not part of the build)
```

## Persistence and privacy

Everything is stored locally in `localStorage` under `bt:`-prefixed keys (rules, preferences, buy-in, bankroll, drill
scores, saved Lab runs, completed lessons); every read and write is wrapped in try/catch and degrades to in-memory
state when storage is unavailable. Nothing leaves the browser.

## Accessibility

Every control is a real button, link, switch or select with an accessible name; the dealer's calls and settlement are
`aria-live` regions; the roads and charts carry text descriptions and keyboard access; the layout works from 380px
phones to wide desktops; reduced motion is respected.

## Deviations worth knowing

* EZ Banker pushes on a Dragon 7 (so the Banker bet pays full even money otherwise); Super 6 pays half on a Banker 6;
  commission is taken per hand rather than tallied in markers.
* The cut card ends the shoe after one more hand, as at the table; a shoe is also replaced if fewer than six cards
  remain.
* Sounds are synthesized with Web Audio and start after the first click or key press (browsers require a gesture).
