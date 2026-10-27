# Counting the Dragon 7 and the Panda 8

How the two card-counting systems in `src/strategy/counting.ts` were derived and validated, and what a player can
realistically expect from them. Everything here is reproducible with the exported functions (section 7).

## 1. Results at a glance

| | Dragon 7 count | Panda 8 count |
|---|---|---|
| Tags (card value 0 = 10/J/Q/K, then A, 2 … 9) | `0 0 0 0 −1 −1 −1 −1 +2 +2` | `+1 +1 +1 −2 −2 −2 0 −1 −1 +2` |
| In words | 4, 5, 6, 7 = −1; 8, 9 = +2; others 0 | 10/J/Q/K, A, 2 = +1; 3, 4, 5 = −2; 6 = 0; 7, 8 = −1; 9 = +2 |
| Balanced (sums to 0 over the shoe) | yes | yes |
| Betting correlation with the EOR table | 0.9642 | 0.9590 |
| Bet when the true count is | ≥ +4 | ≥ +8 |
| Hands on which you bet | 10.1 % | 5.9 % |
| Player edge on those hands | +7.7 % ± 0.3 % | +4.9 % ± 0.3 % |
| Units won per 100 hands dealt (1 unit per qualifying hand) | 0.78 | 0.29 |
| House edge when betting every hand | −7.61 % | −10.19 % |

The Dragon 7 count is the one published by Eliot Jacobson (SPEC §3); our exhaustive search rediscovers it as the best
balanced level-2 count for the bet, which is a good check of the method. The Panda 8 count is derived here.

True count = running count ÷ decks remaining, with the decks-remaining figure floored at half a deck
(`trueCount()` in `src/strategy/counting.ts`). The running count includes every face-up card: the exposed burn card
at the start of the shoe and all cards dealt since. Face-down burned cards are not counted (they still leave the shoe,
which the cards-remaining figure reflects).

## 2. Why the side bets can be counted and the main bets cannot

A long-odds bet pays off on a narrow set of card combinations, so its expectation moves a lot when the shoe's
composition drifts. The exact enumeration in `tools/enumerate_probabilities.py` (output in `docs/probabilities.json`,
embedded as `EOR_8_DECKS` / `EOR_8_DECKS_MAIN` in `@/engine`) gives the **effect of removal** (EOR): the change in a
bet's expectation, per unit wagered, when one card of a given value is removed from a full 8-deck shoe. Positive
means the bet gets better when that card leaves.

| Card value | 10/J/Q/K | A | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Dragon 7 EOR | +0.000863 | +0.000498 | −0.000896 | −0.001076 | −0.002680 | −0.002635 | −0.003242 | −0.003584 | +0.005378 | +0.004785 |
| Panda 8 EOR | +0.001208 | +0.001322 | +0.001444 | −0.002861 | −0.002536 | −0.002655 | −0.000892 | −0.000914 | −0.002241 | +0.004502 |
| EZ Banker EOR | −0.000003 | +0.000033 | +0.000076 | +0.000093 | +0.000185 | −0.000020 | −0.000034 | +0.000006 | −0.000184 | −0.000142 |
| Player EOR | −0.000018 | −0.000045 | −0.000054 | −0.000067 | −0.000120 | +0.000084 | +0.000113 | +0.000082 | +0.000053 | +0.000025 |

The largest Dragon 7 effect (0.0054 for an eight) is about 30 times the largest effect on the Banker bet (0.00018 for
a four). To turn a 1.02 % Banker disadvantage into an advantage, the shoe would have to be depleted by dozens of
specific cards, which does not happen before the cut card; for the Dragon 7 (7.6 % house edge) and Panda 8 (10.2 %)
it takes a handful of eights and nines being over-represented, which happens in a few percent of hands. Reading
the shoe is pointless for the main bets and marginally profitable for the side bets — that is the whole story.

Intuition for the tags: the Dragon 7 needs the Banker to draw a third card and land on exactly 7, so the shoe should be
rich in 8s and 9s (they complete 7 from the low two-card totals that draw) and poor in 4–7 (which either stop the draw
or make a 6-count win instead). The Panda 8 wants the Player to draw to a three-card 8: 9s and low cards (A, 2, and
the zero-value tens that keep two-card totals low) help, 3–5 and 8 hurt.

## 3. Method

### 3.1 Betting correlation

A counting system assigns an integer tag to each card value. The standard figure of merit is the **betting
correlation**: the Pearson correlation, across the physical cards of the shoe, between a card's tag and its EOR.
Because an 8-deck shoe holds 128 zero-value cards and 32 of every other value, the correlation is weighted by those
multiplicities (`cardMultiplicities()`), and both series are centred:

```
BC = Σᵥ nᵥ (tᵥ − t̄)(eᵥ − ē) / sqrt( Σᵥ nᵥ (tᵥ − t̄)² · Σᵥ nᵥ (eᵥ − ē)² ),   n₀ = 128, n₁…₉ = 32
```

BC = 1 means the tags are exactly proportional to the EORs (the best any *linear* count can do; the EOR itself is a
first-order approximation, so even BC = 1 does not capture everything). `bettingCorrelation()` implements this.

### 3.2 Candidate search

A count is **balanced** when its tags sum to zero over the shoe (`128·t₀ + 32·(t₁ + … + t₉) = 0`), so the running
count is zero at the start and the end of every shoe and the true count means the same thing at any depth.
`searchBalancedTagSets(eor, maxTag)` enumerates **every** balanced tag set with tags in `[−maxTag, +maxTag]`
((2·maxTag+1)⁹ combinations, since t₀ follows from the balance condition) and ranks them by betting correlation.

Selection rule, fixed before looking at the results:

1. balanced;
2. level ≤ 2 (no tag larger than 2 in magnitude) — a level-3 or level-4 count is not something a person can keep at
   a live table with a dealer calling the cards;
3. among those, the highest betting correlation;
4. then validated by simulation (3.3): the threshold is set from the simulated EV by true count, and the realized
   return is compared with the runners-up to make sure the correlation ranking holds up on real dealt cards.

### 3.3 Validation by simulation

`simulateCountEv()` deals whole shoes with the engine itself (`Shoe`, `dealHand`, `DEFAULT_RULES`: 8 decks, cut card
14 cards from the end, burn procedure on), keeps the running count of every candidate from all face-up cards, and
before each hand records the true count (running ÷ max(decks remaining, 0.5)). After the hand it credits the side
bet's return — +40 (Dragon 7) or +25 (Panda 8) on a hit, −1 otherwise — to that true-count bucket. All candidates
see the same cards, so comparisons between them are paired. Output per bucket: hands, share of all hands, hits, EV
per unit and its standard error.

The **threshold** of a count is the bucket edge that maximizes the units won per 100 hands dealt when betting one unit
on every hand at or above it (in the noiseless limit this is the lowest edge from which every bucket above is
profitable), subject to the pooled EV at and above it being more than two standard errors above zero
(`recommendThreshold()`).

Runs: a 200,000-shoe screening of all candidates (16.3 M hands, 1-wide buckets), then a 500,000-shoe final run
(40.7 M hands, seed 20261026) for the two chosen systems and the runners-up, from which `COUNT_EV_TABLE` is taken.
Each 500,000-shoe pass takes about 19 s in node (2.1 M hands/s including counting).

## 4. Dragon 7

Exhaustive search against the Dragon 7 EOR (betting correlation in brackets):

| Level | Best balanced tag set | BC |
|---|---|---|
| 1 | 6, 7 = −1; 8, 9 = +1 | 0.8739 |
| 2 | **4, 5, 6, 7 = −1; 8, 9 = +2** (Jacobson) | **0.9642** |
| 2, runner-up | A = +1; 4, 5, 6 = −1; 7 = −2; 8, 9 = +2 | 0.9400 |
| 3 | 10/J/Q/K = +1; 2, 3 = −1; 4, 5, 6, 7 = −2; 8, 9 = +3 | 0.9791 |

Jacobson's count is the best level-2 count by a clear margin, so it is kept as `DRAGON7_COUNT`.

Simulated EV by true count, 500,000 shoes (the `dragon7` rows of `COUNT_EV_TABLE`):

| True count | Hands | Share of hands | Hits | EV per unit | ± SE |
|---|---|---|---|---|---|
| below −2 | 7,929,705 | 19.46 % | 158,233 | −18.19 % | 0.20 % |
| [−2, 0) | 11,182,050 | 27.45 % | 246,141 | −9.75 % | 0.18 % |
| [0, 2) | 13,239,126 | 32.50 % | 303,575 | −5.99 % | 0.17 % |
| [2, 4) | 4,287,022 | 10.52 % | 101,858 | −2.59 % | 0.30 % |
| [4, 6) | 1,884,904 | 4.63 % | 47,115 | **+2.48 %** | 0.47 % |
| [6, 8) | 937,028 | 2.30 % | 24,434 | +6.91 % | 0.67 % |
| [8, 10) | 524,478 | 1.29 % | 14,233 | +11.26 % | 0.92 % |
| [10, 12) | 305,955 | 0.75 % | 8,567 | +14.80 % | 1.22 % |
| 12 and above | 450,387 | 1.11 % | 13,429 | +22.25 % | 1.04 % |

Finer view around the threshold (1-wide buckets, same run): [2, 3) −2.88 %, [3, 4) −2.09 % ± 0.50 %, [4, 5)
+1.52 % ± 0.58 %, [5, 6) +4.12 %, [6, 7) +7.12 %, [7, 8) +6.52 %, [8, 9) +10.37 %, [9, 10) +13.14 %, [10, 11)
+14.14 %, [11, 12) +16.35 %, [12, 13) +18.56 %, [13, 14) +15.84 %, [14, 15) +19.59 %, [15, 16) +17.49 %,
16 and above +30.22 % ± 1.85 %. The bet turns profitable between true counts 3 and 4.

Betting from a given true count (pooled over everything at or above it):

| Bet when TC ≥ | Share of hands | Player edge when betting | Units per 100 hands dealt |
|---|---|---|---|
| 2 | 20.59 % | +2.45 % ± 0.22 % | 0.504 |
| 3 | 13.96 % | +4.98 % ± 0.27 % | 0.695 |
| **4** | **10.07 %** | **+7.71 % ± 0.32 %** | **0.776** |
| 5 | 7.15 % | +10.23 % ± 0.39 % | 0.732 |
| 6 | 5.44 % | +12.14 % ± 0.45 % | 0.661 |
| 8 | 3.14 % | +15.97 % ± 0.60 % | 0.502 |
| 10 | 1.86 % | +19.24 % ± 0.79 % | 0.357 |
| 12 | 1.11 % | +22.25 % ± 1.04 % | 0.246 |

Threshold 4 maximizes the return, matching the SPEC and Jacobson's published trigger. `DRAGON7_COUNT.threshold = 4`.

## 5. Panda 8

### 5.1 Candidates

The Panda 8 EOR scaled so that a nine is +2 reads `+0.54 +0.59 +0.64 −1.27 −1.13 −1.18 −0.40 −0.41 −1.00 +2.00`
(10/J/Q/K, A, 2, 3, 4, 5, 6, 7, 8, 9): the ideal tags are nearly +½ for the three low-value groups, about −1¼ for
3/4/5, −½ for 6/7, −1 for 8 and +2 for 9. Rounding that to integers while staying balanced is the whole problem.

| Candidate | Tags (0, A, 2, 3, 4, 5, 6, 7, 8, 9) | Level | Non-zero | BC |
|---|---|---|---|---|
| Level-1 best | `+1 0 +1 −1 −1 −1 −1 −1 −1 +1` | 1 | 9 | 0.8652 |
| Level-1 second | `+1 +1 0 −1 −1 −1 −1 −1 −1 +1` | 1 | 9 | 0.8606 |
| Simplest level-1 (A, 2, 9 up; 3, 4, 5 down) | `0 +1 +1 −1 −1 −1 0 0 0 +1` | 1 | 6 | 0.8194 |
| "Classic" level-2 count (tens untagged) | `0 +1 +1 −1 −1 −1 0 0 −1 +2` | 2 | 7 | 0.9141 |
| **Level-2 best** | **`+1 +1 +1 −2 −2 −2 0 −1 −1 +2`** | **2** | **9** | **0.9590** |
| Level-2 second | `+1 +1 +1 −2 −2 −2 −1 0 −1 +2` | 2 | 9 | 0.9584 |
| Level-2 third | `+1 +1 +1 −2 −1 −2 −1 −1 −1 +2` | 2 | 10 | 0.9558 |
| Level-2 fourth (6, 7 = 0; 3, 4, 5, 8 = −2) | `+1 +1 +1 −2 −2 −2 0 0 −2 +2` | 2 | 8 | 0.9555 |
| Level-3 best | `+1 +1 +1 −2 −2 −2 −1 −1 −1 +3` | 3 | 10 | 0.9868 |
| Level-4 best (EOR rounded) | `+1 +1 +1 −2 −2 −2 −1 −1 −2 +4` | 4 | 10 | 0.9943 |

Tagging the zero-value cards matters: the classic count ignores 128 of the 416 cards, each of which carries a
Panda 8 EOR almost as large as an ace's, and that costs it 0.045 of correlation against the best level-2 set.

By the selection rule the Panda 8 count is the level-2 best: **10/J/Q/K, A, 2 = +1; 3, 4, 5 = −2; 6 = 0; 7, 8 = −1;
9 = +2** (BC 0.9590).

### 5.2 Screening by simulation (200,000 shoes, 16,296,380 hands, paired)

Units won per 100 hands dealt at each candidate's own best threshold:

| Candidate | BC | Best TC ≥ | Bets on | Units / 100 hands |
|---|---|---|---|---|
| Level-1 best | 0.8652 | 8 | 3.15 % | 0.207 |
| Level-1 second | 0.8606 | 8 | 3.15 % | 0.189 |
| Classic level-2 | 0.9141 | 6 | 4.60 % | 0.283 |
| **Level-2 best (chosen)** | **0.9590** | **8** | **5.89 %** | **0.291** |
| Level-2 second | 0.9584 | 8 | 5.88 % | 0.265 |
| Level-2 third | 0.9558 | 7 | 6.65 % | 0.263 |
| Level-2 fourth | 0.9555 | 8 | 6.26 % | 0.299 |
| Level-3 best | 0.9868 | 9–10 | 4.9–5.7 % | 0.270 |
| Level-4 best | 0.9943 | 12 | 4.52 % | 0.276 |

Two things stand out. First, every count from the classic one upward lands in the same 0.26–0.30 units per 100 hands
band; the standard error of each figure is about ±0.03, so the level-2 sets are statistically tied and the level-3/4
sets, despite higher correlation, are no better: the Panda 8's dependence on the shoe is not linear enough for
extra tag resolution to pay. Second, the level-1 counts are clearly worse (≈ 0.2). So the practical choice is
between level-2 counts, and the correlation ranking is confirmed rather than overturned by the realized returns.

### 5.3 Final run (500,000 shoes, 40,740,655 hands)

| Count | TC ≥ | Bets on | Player edge when betting | Units / 100 hands |
|---|---|---|---|---|
| **Level-2 best (chosen)** | **8** | **5.89 %** | **+4.85 % ± 0.33 %** | **0.286** |
| Level-2 fourth | 8 | 6.26 % | +4.28 % ± 0.32 % | 0.268 |
| Classic level-2 | 6 | 4.62 % | +5.87 % ± 0.37 % | 0.271 |

The chosen count has the best correlation and the best realized return (paired on the same cards; the margin over
the others is within noise, as expected from 5.2). Simulated EV by true count (the `panda8` rows of `COUNT_EV_TABLE`):

| True count | Hands | Share of hands | Hits | EV per unit | ± SE |
|---|---|---|---|---|---|
| below −2 | 10,362,006 | 25.43 % | 330,417 | −17.09 % | 0.14 % |
| [−2, 0) | 9,139,490 | 22.43 % | 312,017 | −11.24 % | 0.16 % |
| [0, 2) | 10,775,785 | 26.45 % | 375,982 | −9.28 % | 0.15 % |
| [2, 4) | 4,486,940 | 11.01 % | 160,702 | −6.88 % | 0.23 % |
| [4, 6) | 2,298,901 | 5.64 % | 84,460 | −4.48 % | 0.32 % |
| [6, 8) | 1,276,675 | 3.13 % | 48,154 | −1.93 % | 0.44 % |
| [8, 10) | 781,324 | 1.92 % | 30,415 | **+1.21 %** | 0.57 % |
| [10, 12) | 496,304 | 1.22 % | 19,484 | +2.07 % | 0.72 % |
| 12 and above | 1,123,230 | 2.76 % | 46,918 | +8.60 % | 0.49 % |

Finer view (1-wide buckets, same run): [6, 7) −2.01 %, [7, 8) −1.81 % ± 0.70 %, [8, 9) +0.39 % ± 0.72 %, [9, 10)
+2.55 %, [10, 11) +1.65 %, [11, 12) +2.81 %, [12, 13) +4.42 %, [13, 14) +3.73 %, [14, 15) +5.40 %, [15, 16)
+6.05 %, 16 and above +12.50 % ± 0.71 % (1.37 % of hands). The bet turns profitable at a true count of about 8.

Betting from a given true count:

| Bet when TC ≥ | Share of hands | Player edge when betting | Units per 100 hands dealt |
|---|---|---|---|
| 4 | 14.67 % | −0.19 % ± 0.20 % | −0.028 |
| 5 | 11.28 % | +1.11 % ± 0.23 % | 0.125 |
| 6 | 9.03 % | +2.49 % ± 0.26 % | 0.225 |
| 7 | 7.13 % | +3.70 % ± 0.30 % | 0.263 |
| **8** | **5.89 %** | **+4.85 % ± 0.33 %** | **0.286** |
| 9 | 4.71 % | +5.97 % ± 0.37 % | 0.281 |
| 10 | 3.98 % | +6.60 % ± 0.41 % | 0.262 |
| 12 | 2.76 % | +8.60 % ± 0.49 % | 0.237 |
| 16 | 1.37 % | +12.50 % ± 0.71 % | 0.172 |

Threshold 8 maximizes the return and the [8, 10) bucket is itself positive (2.1 standard errors), so
`PANDA8_COUNT.threshold = 8`. Note where the money is: 60 % of the Panda 8 profit (0.172 of the 0.286 units) comes
from hands at TC ≥ 16, which only occur in the last deck and a half of the shoe, when a running count of +8 or
more sits over the half-deck floor. Deep penetration matters even more for the Panda 8 than for the Dragon 7.

## 6. What to expect at the table

* **Rates.** At a full table dealing ~70 hands per hour, counting the Dragon 7 is worth 0.78 × 0.7 ≈ 0.54 side-bet
  units per hour and the Panda 8 ≈ 0.20; at a fast mini-bac table (~150 hands/hour) about double. With the default
  side-bet maximum of $500 that is roughly $270/hour for the Dragon 7 — betting $500 on one hand in ten.
* **Variance.** When the Dragon 7 count says bet, the hit rate is about 2.6 % (41 × 0.026 − 1 ≈ +7.7 %): the standard
  deviation of one bet is 6.6 units, so an hour's seven bets swing by ±17 units for an expected +0.5. It takes about
  7,300 bets (≈ 72,000 hands, ≈ 1,000 hours at a full table) before the expected profit equals one standard
  deviation. For the Panda 8 (hit rate ≈ 4.0 %, σ ≈ 5.1 units, edge 4.9 %) it is about 11,000 bets ≈ 190,000 hands.
  Bankroll for the side bets alone should be several hundred units.
* **Both counts at once.** They share no tags, so a solo player keeps two running counts; the Play mode's Coach panel
  and the Learn drills show both. Most players run only the Dragon 7 count.
* **Casino conditions.** The results above assume the default table: 8 decks, cut card 14 cards from the end and the
  burn procedure. A shallower cut (more cards behind the cut card) removes the richest hands and can halve the return;
  the Panda 8 count in particular lives in the last deck. Six-deck shoes behave the same per hand but end sooner.
  Side-bet maximums ($500 default) cap the profit, and betting a side bet only when the count is high is a visible
  pattern — casinos that watch for it will ask you to stop.
* **The main bets stay unbeatable.** Nothing above helps the Player or Banker bet: their EORs are two orders of
  magnitude smaller (section 2), and no realistic shoe depletion turns the 1.02 % Banker edge positive.

## 7. Reproducing the derivation

Everything used here is exported from `@/strategy` and runs in node (for example with `npx vite-node script.ts`
from the project root, which resolves the `@` alias):

```ts
import { EOR_8_DECKS } from '@/engine';
import { bettingCorrelation, searchBalancedTagSets, simulateCountEv, pooledStats, recommendThreshold,
         DRAGON7_COUNT, PANDA8_COUNT } from '@/strategy';

// 3.1–3.2: correlations and the exhaustive searches (level 2 is instant, level 3 takes ~0.5 s, level 4 ~6 s)
bettingCorrelation(DRAGON7_COUNT.tags, EOR_8_DECKS.dragon7);        // 0.9642
searchBalancedTagSets(EOR_8_DECKS.panda8, 2, { limit: 8 });         // [0] is PANDA8_COUNT.tags, BC 0.9590

// 3.3: EV by true-count bucket; 500,000 shoes ≈ 19 s. COUNT_EV_TABLE used exactly these arguments.
const [d7, p8] = simulateCountEv(
  [{ key: 'dragon7', bet: 'dragon7', tags: DRAGON7_COUNT.tags }, { key: 'panda8', bet: 'panda8', tags: PANDA8_COUNT.tags }],
  { shoes: 500000, seed: 20261026, edges: [-2, 0, 2, 4, 6, 8, 10, 12] },
);
recommendThreshold(d7.rows);   // 4
recommendThreshold(p8.rows);   // 8
pooledStats(p8.rows, 8);       // { frequency: 0.0589, ev: 0.0485, stdErr: 0.0033, returnPerHundredHands: 0.286, … }
```

The 1-wide tables in sections 4 and 5 use `edges: [-6, -5, …, 16]` with the same seed; the screening in 5.2 used
200,000 shoes with the same seed and the candidate tag sets listed there. `src/strategy/countEv.test.ts` re-runs a
smaller version (8,000 shoes) on every test run and checks it against the embedded table.
