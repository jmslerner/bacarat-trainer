import type { BetResult } from '@/engine';
import type { BettingSystem, SystemParamSpec, SystemState } from './types';

/** Reads a parameter, falling back to the spec's default when missing or invalid. */
export function paramValue(spec: SystemParamSpec, params?: Record<string, number>): number {
  const raw = params?.[spec.key];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return spec.default;
  const clamped = Math.min(spec.max, Math.max(spec.min, raw));
  return spec.step >= 1 ? Math.round(clamped) : clamped;
}

function spec(key: string, label: string, description: string, def: number, min: number, max: number, step = 1): SystemParamSpec {
  return { key, label, description, default: def, min, max, step };
}

const MAX_DOUBLINGS = spec('maxDoublings', 'Max doublings', 'The bet doubles at most this many times; when the biggest bet loses too, the progression gives up and restarts at one unit.', 8, 0, 20);
const WINS_TO_RESET = spec('winsToReset', 'Wins to reset', 'Take the profit and return to one unit after this many wins in a row.', 3, 1, 10);
const LINE_LENGTH = spec('length', 'Line length', 'The starting line is 1, 2, …, N units; each cycle aims to win their sum.', 4, 1, 12);
const MAX_STEPS = spec('maxSteps', 'Max steps', 'Highest Fibonacci step the progression may climb to before restarting.', 12, 1, 25);

class Flat implements SystemState {
  readonly progressionIndex = 0;
  constructor(private readonly unit: number) {}
  nextBet(): number {
    return this.unit;
  }
  record(): void {}
  reset(): void {}
}

class Martingale implements SystemState {
  private losses = 0;
  constructor(
    private readonly unit: number,
    private readonly maxDoublings: number,
    private readonly grand: boolean,
  ) {}
  get progressionIndex(): number {
    return this.losses;
  }
  nextBet(): number {
    const doubled = 2 ** this.losses;
    // Grand martingale: double AND add a unit after every loss → 1, 3, 7, 15, … units.
    return this.unit * (this.grand ? 2 * doubled - 1 : doubled);
  }
  record(result: BetResult): void {
    if (result === 'win') this.losses = 0;
    else if (result === 'lose') this.losses = this.losses >= this.maxDoublings ? 0 : this.losses + 1;
  }
  reset(): void {
    this.losses = 0;
  }
}

class Paroli implements SystemState {
  private wins = 0;
  constructor(
    private readonly unit: number,
    private readonly winsToReset: number,
  ) {}
  get progressionIndex(): number {
    return this.wins;
  }
  nextBet(): number {
    return this.unit * 2 ** this.wins;
  }
  record(result: BetResult): void {
    if (result === 'win') this.wins = this.wins + 1 >= this.winsToReset ? 0 : this.wins + 1;
    else if (result === 'lose') this.wins = 0;
  }
  reset(): void {
    this.wins = 0;
  }
}

const ONE_THREE_TWO_SIX = [1, 3, 2, 6] as const;

class OneThreeTwoSix implements SystemState {
  private step = 0;
  constructor(private readonly unit: number) {}
  get progressionIndex(): number {
    return this.step;
  }
  nextBet(): number {
    return this.unit * ONE_THREE_TWO_SIX[this.step];
  }
  record(result: BetResult): void {
    if (result === 'win') this.step = this.step === ONE_THREE_TWO_SIX.length - 1 ? 0 : this.step + 1;
    else if (result === 'lose') this.step = 0;
  }
  reset(): void {
    this.step = 0;
  }
}

/** 1, 1, 2, 3, 5, … (index 0 and 1 are both one unit). */
export function fibonacci(index: number): number {
  let a = 1;
  let b = 1;
  for (let i = 0; i < index; i++) {
    const next = a + b;
    a = b;
    b = next;
  }
  return a;
}

class Fibonacci implements SystemState {
  private step = 0;
  constructor(
    private readonly unit: number,
    private readonly maxSteps: number,
  ) {}
  get progressionIndex(): number {
    return this.step;
  }
  nextBet(): number {
    return this.unit * fibonacci(this.step);
  }
  record(result: BetResult): void {
    if (result === 'lose') this.step = this.step >= this.maxSteps ? 0 : this.step + 1;
    else if (result === 'win') this.step = Math.max(0, this.step - 2);
  }
  reset(): void {
    this.step = 0;
  }
}

class DAlembert implements SystemState {
  private level = 0;
  constructor(private readonly unit: number) {}
  get progressionIndex(): number {
    return this.level;
  }
  nextBet(): number {
    return this.unit * (this.level + 1);
  }
  record(result: BetResult): void {
    if (result === 'lose') this.level += 1;
    else if (result === 'win') this.level = Math.max(0, this.level - 1);
  }
  reset(): void {
    this.level = 0;
  }
}

class Labouchere implements SystemState {
  private readonly base: readonly number[];
  private line: number[];
  constructor(
    private readonly unit: number,
    length: number,
  ) {
    this.base = Array.from({ length }, (_, i) => i + 1);
    this.line = [...this.base];
  }
  /** Entries left in the current line (shrinks with wins, grows with losses); the base length when a cycle starts. */
  get progressionIndex(): number {
    return this.line.length;
  }
  private lineBet(): number {
    return this.line.length === 1 ? this.line[0] : this.line[0] + this.line[this.line.length - 1];
  }
  nextBet(): number {
    return this.unit * this.lineBet();
  }
  record(result: BetResult): void {
    if (result === 'win') {
      if (this.line.length <= 2) this.line = [...this.base]; // the line is cleared: cycle won, start again
      else this.line = this.line.slice(1, -1);
    } else if (result === 'lose') {
      this.line.push(this.lineBet());
    }
  }
  reset(): void {
    this.line = [...this.base];
  }
}

class OscarsGrind implements SystemState {
  private betUnits = 1;
  private cycleNet = 0;
  constructor(private readonly unit: number) {}
  /** Units bet this hand minus one (0 = base bet). */
  get progressionIndex(): number {
    return this.betUnits - 1;
  }
  nextBet(): number {
    return this.unit * this.betUnits;
  }
  record(result: BetResult): void {
    if (result === 'win') {
      this.cycleNet += this.betUnits;
      if (this.cycleNet >= 1) {
        this.reset();
      } else {
        // Raise by one unit, but never bet more than what closes the cycle at exactly +1 unit.
        this.betUnits = Math.min(this.betUnits + 1, 1 - this.cycleNet);
      }
    } else if (result === 'lose') {
      this.cycleNet -= this.betUnits;
    }
  }
  reset(): void {
    this.betUnits = 1;
    this.cycleNet = 0;
  }
}

const systems: BettingSystem[] = [
  {
    id: 'flat',
    name: 'Flat betting',
    description: 'The same amount every hand. The expected loss is simply the house edge times what you wager.',
    params: [],
    create: (unit) => new Flat(unit),
  },
  {
    id: 'martingale',
    name: 'Martingale',
    description: 'Double after every loss, back to one unit after a win. Wins one unit per cycle until a losing streak meets the table maximum or the bankroll.',
    params: [MAX_DOUBLINGS],
    create: (unit, params) => new Martingale(unit, paramValue(MAX_DOUBLINGS, params), false),
  },
  {
    id: 'grandMartingale',
    name: 'Grand martingale',
    description: 'Double and add one unit after every loss (1, 3, 7, 15, …), back to one unit after a win. Bigger wins per cycle, faster ruin.',
    params: [MAX_DOUBLINGS],
    create: (unit, params) => new Martingale(unit, paramValue(MAX_DOUBLINGS, params), true),
  },
  {
    id: 'paroli',
    name: 'Paroli',
    description: 'Let it ride: double after a win, back to one unit after a loss or after N wins in a row. Risks small amounts to chase streaks.',
    params: [WINS_TO_RESET],
    create: (unit, params) => new Paroli(unit, paramValue(WINS_TO_RESET, params)),
  },
  {
    id: 'oneThreeTwoSix',
    name: '1-3-2-6',
    description: 'Bet 1, 3, 2 then 6 units on consecutive wins; any loss (or completing the cycle) restarts at 1.',
    params: [],
    create: (unit) => new OneThreeTwoSix(unit),
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci',
    description: 'Move one step up the Fibonacci sequence (1, 1, 2, 3, 5, 8, …) after a loss and two steps back after a win.',
    params: [MAX_STEPS],
    create: (unit, params) => new Fibonacci(unit, paramValue(MAX_STEPS, params)),
  },
  {
    id: 'dAlembert',
    name: "d'Alembert",
    description: 'Add one unit after a loss, remove one after a win. A gentle progression that still loses the house edge on every unit.',
    params: [],
    create: (unit) => new DAlembert(unit),
  },
  {
    id: 'labouchere',
    name: 'Labouchere',
    description: 'Write a line of numbers; bet the first plus the last, cross both out on a win, add the lost amount to the end on a loss.',
    params: [LINE_LENGTH],
    create: (unit, params) => new Labouchere(unit, paramValue(LINE_LENGTH, params)),
  },
  {
    id: 'oscarsGrind',
    name: "Oscar's grind",
    description: 'Aim for one unit of profit per cycle: keep the bet after a loss, raise it one unit after a win, never bet more than needed to close the cycle.',
    params: [],
    create: (unit) => new OscarsGrind(unit),
  },
];

export const BETTING_SYSTEMS: readonly BettingSystem[] = Object.freeze(systems);

export function getSystem(id: string): BettingSystem | undefined {
  return BETTING_SYSTEMS.find((s) => s.id === id);
}
