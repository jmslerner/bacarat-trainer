/**
 * The Strategy Lab's form model (SPEC §5.7): what the user edits, how it becomes a `SimConfig`, the five presets,
 * validation (errors block a run, warnings do not) and the run-size estimate. Pure TypeScript.
 */
import { RULE_PRESETS, cloneRules, formatMoney, randomSeed, suggestedBuyIn } from '@/engine';
import type { TableRules } from '@/engine';
import { getSelector, getSystem, paramValue, validateSimConfig } from '@/strategy';
import type { SideBetMode, SimConfig } from '@/strategy';
import type { RulePresetId } from '@/ui/shell';

/** Which table to simulate: the rules from the Settings dialog, or one of the engine's presets. */
export type RulesChoice = 'current' | RulePresetId;
export const RULES_CHOICES: readonly RulesChoice[] = Object.freeze(['current', 'ez', 'commission', 'super6']);
export const SIDE_BET_MODES: readonly SideBetMode[] = Object.freeze(['never', 'always', 'count']);

export function isRulesChoice(value: unknown): value is RulesChoice {
  return typeof value === 'string' && (RULES_CHOICES as readonly string[]).includes(value);
}

export function isSideBetMode(value: unknown): value is SideBetMode {
  return typeof value === 'string' && (SIDE_BET_MODES as readonly string[]).includes(value);
}

export interface LabConfig {
  rulesChoice: RulesChoice;
  selectorId: string;
  systemId: string;
  /** Parameters of the selected betting system (normalised to the system's specs). */
  systemParams: Record<string, number>;
  /** Base bet in dollars. */
  unit: number;
  /** Starting bankroll of every trial. */
  bankroll: number;
  shoesPerTrial: number;
  trials: number;
  /** Dollars down from the start at which a trial stops (counted as ruin); 0 = no stop loss. */
  stopLoss: number;
  /** Dollars up from the start at which a trial stops; 0 = no stop win. */
  stopWin: number;
  dragon7: SideBetMode;
  panda8: SideBetMode;
  /** Side bets are placed at `sideUnits × unit`. */
  sideUnits: number;
  seed: number;
}

export const LAB_LIMITS = Object.freeze({
  unit: Object.freeze({ min: 1, max: 100_000 }),
  bankroll: Object.freeze({ min: 1, max: 10_000_000 }),
  shoesPerTrial: Object.freeze({ min: 1, max: 500 }),
  trials: Object.freeze({ min: 1, max: 100_000 }),
  stop: Object.freeze({ min: 0, max: 10_000_000 }),
  sideUnits: Object.freeze({ min: 0, max: 100 }),
  seed: Object.freeze({ min: 0, max: 4_294_967_295 }),
});

export const DEFAULT_UNIT = 10;
export const DEFAULT_SHOES_PER_TRIAL = 10;
export const DEFAULT_TRIALS = 1000;
export const DEFAULT_BANKROLL = 1000;
/** Runs above this many hands get a "this will take a while" warning (≈ 1.5 million hands per second). */
export const LONG_RUN_HANDS = 10_000_000;

export const SIDE_BET_LABELS: Readonly<Record<'dragon7' | 'panda8', string>> = Object.freeze({ dragon7: 'Dragon 7', panda8: 'Panda 8' });

/** The default of every parameter of a betting system (empty for systems without parameters). */
export function defaultSystemParams(systemId: string): Record<string, number> {
  const system = getSystem(systemId);
  const out: Record<string, number> = {};
  if (system) for (const spec of system.params) out[spec.key] = spec.default;
  return out;
}

/** Keeps only the parameters the system declares, each clamped to its spec (defaults when missing). */
export function normalizeSystemParams(systemId: string, params?: Record<string, number>): Record<string, number> {
  const system = getSystem(systemId);
  const out: Record<string, number> = {};
  if (system) for (const spec of system.params) out[spec.key] = paramValue(spec, params);
  return out;
}

export function defaultLabConfig(opts: { bankroll?: number; seed?: number; unit?: number } = {}): LabConfig {
  return {
    rulesChoice: 'current',
    selectorId: 'alwaysBanker',
    systemId: 'flat',
    systemParams: {},
    unit: opts.unit !== undefined && Number.isFinite(opts.unit) && opts.unit > 0 ? opts.unit : DEFAULT_UNIT,
    bankroll: opts.bankroll !== undefined && Number.isFinite(opts.bankroll) && opts.bankroll > 0 ? opts.bankroll : DEFAULT_BANKROLL,
    shoesPerTrial: DEFAULT_SHOES_PER_TRIAL,
    trials: DEFAULT_TRIALS,
    stopLoss: 0,
    stopWin: 0,
    dragon7: 'never',
    panda8: 'never',
    sideUnits: 1,
    seed: opts.seed !== undefined && Number.isFinite(opts.seed) ? Math.round(opts.seed) : randomSeed(),
  };
}

export interface LabMoneyDefaults {
  unit: number;
  bankroll: number;
}

/**
 * The money defaults for a table: the unit is the table's main minimum ($10 at the $10 table, $500 in the salon)
 * and the bankroll is `buyIn` when given (the Settings buy-in, which follows the table level), otherwise the
 * table's suggested buy-in (the level's, or 100 × the main minimum). Both are clamped to the Lab's limits.
 */
export function labMoneyDefaults(rules: TableRules, buyIn?: number): LabMoneyDefaults {
  const min = rules.limits.main.min;
  const unit = Number.isFinite(min) && min >= LAB_LIMITS.unit.min ? Math.min(min, LAB_LIMITS.unit.max) : DEFAULT_UNIT;
  const wanted = buyIn !== undefined && Number.isFinite(buyIn) && buyIn > 0 ? buyIn : suggestedBuyIn(rules);
  const bankroll = Math.min(Math.max(wanted, LAB_LIMITS.bankroll.min), LAB_LIMITS.bankroll.max);
  return { unit, bankroll };
}

/* ---- presets ------------------------------------------------------------------------------ */

export type LabPresetPatch = Pick<LabConfig, 'selectorId' | 'systemId' | 'systemParams' | 'dragon7' | 'panda8'> & Partial<Pick<LabConfig, 'sideUnits'>>;

export interface LabPreset {
  id: string;
  name: string;
  /** One line on what the preset demonstrates. */
  blurb: string;
  patch: LabPresetPatch;
}

const presets: LabPreset[] = [
  {
    id: 'flatBanker',
    name: 'Flat Banker',
    blurb: 'The baseline: the lowest-edge bet on the layout, the same amount every hand.',
    patch: { selectorId: 'alwaysBanker', systemId: 'flat', systemParams: {}, dragon7: 'never', panda8: 'never' },
  },
  {
    id: 'martingalePlayer',
    name: 'Martingale on Player',
    blurb: 'Double after every loss. Most sessions win a little; one long losing streak takes the whole bankroll.',
    patch: { selectorId: 'alwaysPlayer', systemId: 'martingale', systemParams: { maxDoublings: 8 }, dragon7: 'never', panda8: 'never' },
  },
  {
    id: 'countDragon7',
    name: 'Count Dragon 7',
    blurb: 'Flat Banker plus a Dragon 7 bet only when the true count reaches 4: the one real edge, thin and wild enough that a small bankroll often busts before it shows.',
    patch: { selectorId: 'alwaysBanker', systemId: 'flat', systemParams: {}, dragon7: 'count', panda8: 'never', sideUnits: 5 },
  },
  {
    id: 'paroliStreaks',
    name: 'Paroli on streaks',
    blurb: 'Follow the last winner and let winning bets ride up to three times.',
    patch: { selectorId: 'followLast', systemId: 'paroli', systemParams: { winsToReset: 3 }, dragon7: 'never', panda8: 'never' },
  },
  {
    id: 'oneThreeTwoSixBanker',
    name: '1-3-2-6 Banker',
    blurb: 'A positive progression on Banker: 1, 3, 2 then 6 units on consecutive wins.',
    patch: { selectorId: 'alwaysBanker', systemId: 'oneThreeTwoSix', systemParams: {}, dragon7: 'never', panda8: 'never' },
  },
];

export const LAB_PRESETS: readonly LabPreset[] = Object.freeze(presets);

export function getLabPreset(id: string): LabPreset | undefined {
  return LAB_PRESETS.find((p) => p.id === id);
}

/** `#lab/<presetId>`: the hash the lessons link to so the Lab opens with that preset applied. */
export function labPresetHash(id: string): string {
  return `#lab/${id}`;
}

/** The preset named by a `#lab/<presetId>` hash (see `labPresetHash`), or null for `#lab` and unknown ids. */
export function labPresetFromHash(hash: string): LabPreset | null {
  const m = /^#?\/?lab\/([A-Za-z0-9_-]+)/.exec(hash.trim());
  return m ? (getLabPreset(m[1]) ?? null) : null;
}

/** The preset's strategy over the rest of the configuration (unit, bankroll, run size and seed are kept). */
export function applyLabPreset(config: LabConfig, preset: LabPreset): LabConfig {
  return { ...config, ...preset.patch, systemParams: normalizeSystemParams(preset.patch.systemId, preset.patch.systemParams) };
}

/** The preset whose strategy the configuration currently matches, if any. */
export function matchLabPreset(config: LabConfig): LabPreset | null {
  for (const preset of LAB_PRESETS) {
    const { patch } = preset;
    if (config.selectorId !== patch.selectorId || config.systemId !== patch.systemId) continue;
    if (config.dragon7 !== patch.dragon7 || config.panda8 !== patch.panda8) continue;
    if (patch.sideUnits !== undefined && config.sideUnits !== patch.sideUnits) continue;
    const want = normalizeSystemParams(patch.systemId, patch.systemParams);
    const have = normalizeSystemParams(config.systemId, config.systemParams);
    if (Object.keys(want).some((key) => want[key] !== have[key])) continue;
    return preset;
  }
  return null;
}

/* ---- rules ------------------------------------------------------------------------------- */

/** A mutable copy of the table the form points at. */
export function resolveRules(choice: RulesChoice, currentRules: TableRules): TableRules {
  return cloneRules(choice === 'current' ? currentRules : RULE_PRESETS[choice].rules);
}

export function rulesChoiceLabel(choice: RulesChoice): string {
  return choice === 'current' ? 'Current table settings' : RULE_PRESETS[choice].name;
}

/* ---- SimConfig --------------------------------------------------------------------------- */

export function toSimConfig(form: LabConfig, currentRules: TableRules): SimConfig {
  const sim: SimConfig = {
    rules: resolveRules(form.rulesChoice, currentRules),
    strategy: {
      selectorId: form.selectorId,
      systemId: form.systemId,
      systemParams: normalizeSystemParams(form.systemId, form.systemParams),
      unit: form.unit,
      sideBets: { dragon7: form.dragon7, panda8: form.panda8, units: form.sideUnits },
    },
    bankroll: form.bankroll,
    shoesPerTrial: form.shoesPerTrial,
    trials: form.trials,
    seed: form.seed,
  };
  if (form.stopLoss > 0) sim.stopLoss = form.stopLoss;
  if (form.stopWin > 0) sim.stopWin = form.stopWin;
  return sim;
}

/** Average hands per shoe for a table: cards in play before the cut card, less the burn, at ~4.94 cards a hand, plus the final hand. */
export function handsPerShoe(rules: TableRules): number {
  const decks = rules.decks === 6 ? 6 : 8;
  const cut = Number.isFinite(rules.cutCardFromEnd) ? rules.cutCardFromEnd : 14;
  const burn = rules.burnProcedure ? 7.5 : 0;
  return Math.max(1, (decks * 52 - cut - burn) / 4.94 + 1);
}

/** Rough number of hands a run will deal. */
export function estimateHands(form: Pick<LabConfig, 'trials' | 'shoesPerTrial'>, rules: TableRules): number {
  return Math.round(form.trials * form.shoesPerTrial * handsPerShoe(rules));
}

/* ---- validation -------------------------------------------------------------------------- */

export interface LabValidation {
  sim: SimConfig;
  /** Problems that block the run. */
  errors: string[];
  /** Things worth knowing that do not block the run. */
  warnings: string[];
  /** Estimated hands the run will deal. */
  hands: number;
}

export function validateLabConfig(form: LabConfig, currentRules: TableRules): LabValidation {
  const sim = toSimConfig(form, currentRules);
  const rules = sim.rules;
  const errors = validateSimConfig(sim);
  const warnings: string[] = [];
  const int = (n: number): boolean => Number.isInteger(n);

  if (int(form.trials) && form.trials > LAB_LIMITS.trials.max) errors.push(`Trials must be at most ${LAB_LIMITS.trials.max.toLocaleString('en-US')}`);
  if (int(form.shoesPerTrial) && form.shoesPerTrial > LAB_LIMITS.shoesPerTrial.max) errors.push(`Shoes per trial must be at most ${LAB_LIMITS.shoesPerTrial.max}`);
  if (Number.isFinite(form.stopLoss) && form.stopLoss < 0) errors.push('Stop loss cannot be negative');
  if (Number.isFinite(form.stopWin) && form.stopWin < 0) errors.push('Stop win cannot be negative');

  const main = rules.limits.main;
  const side = rules.limits.side;
  if (errors.length === 0) {
    if (form.unit < main.min) warnings.push(`Unit ${formatMoney(form.unit)} is below the table minimum of ${formatMoney(main.min)}: main bets are placed at the minimum.`);
    if (form.unit > main.max) warnings.push(`Unit ${formatMoney(form.unit)} is above the table maximum of ${formatMoney(main.max)}: main bets are capped at the maximum.`);
    if (form.bankroll < main.min) warnings.push(`A bankroll of ${formatMoney(form.bankroll)} cannot cover the ${formatMoney(main.min)} table minimum: trials end in ruin as soon as a bet is wanted.`);
    if (form.stopLoss > 0 && form.stopLoss >= form.bankroll) warnings.push('The stop loss is not below the bankroll, so going bust comes first.');
    for (const bet of ['dragon7', 'panda8'] as const) {
      const mode = form[bet];
      if (mode === 'never') continue;
      const label = SIDE_BET_LABELS[bet];
      if (!rules.sideBets[bet]) {
        warnings.push(`${label} is not dealt on this table, so its policy is ignored.`);
        continue;
      }
      if (form.sideUnits <= 0) {
        warnings.push(`Side-bet size is 0 units, so no ${label} bets are placed.`);
        continue;
      }
      const amount = form.sideUnits * form.unit;
      if (amount < side.min) warnings.push(`${label} bets of ${formatMoney(amount)} are raised to the ${formatMoney(side.min)} side-bet minimum.`);
      if (amount > side.max) warnings.push(`${label} bets of ${formatMoney(amount)} are capped at the ${formatMoney(side.max)} side-bet maximum.`);
    }
  }
  const hands = estimateHands(form, rules);
  if (errors.length === 0 && hands > LONG_RUN_HANDS) {
    warnings.push(`About ${hands.toLocaleString('en-US')} hands to deal: expect this to take a while (roughly 1.5 million hands a second).`);
  }
  return { sim, errors, warnings, hands };
}

/* ---- sanitizing (saved runs, URL state, older versions) ---------------------------------- */

function num(value: unknown, fallback: number, limits: { min: number; max: number }, integer: boolean): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const rounded = integer ? Math.round(n) : n;
  return rounded < limits.min || rounded > limits.max ? fallback : rounded;
}

/** Coerces whatever was persisted into a valid form (unknown ids and out-of-range numbers fall back to `defaults`). */
export function sanitizeLabConfig(raw: unknown, defaults: LabConfig = defaultLabConfig()): LabConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...defaults, systemParams: { ...defaults.systemParams } };
  const r = raw as Record<string, unknown>;
  const selectorId = typeof r.selectorId === 'string' && getSelector(r.selectorId) ? r.selectorId : defaults.selectorId;
  const systemId = typeof r.systemId === 'string' && getSystem(r.systemId) ? r.systemId : defaults.systemId;
  const params = typeof r.systemParams === 'object' && r.systemParams !== null ? (r.systemParams as Record<string, number>) : undefined;
  return {
    rulesChoice: isRulesChoice(r.rulesChoice) ? r.rulesChoice : defaults.rulesChoice,
    selectorId,
    systemId,
    systemParams: normalizeSystemParams(systemId, params),
    unit: num(r.unit, defaults.unit, LAB_LIMITS.unit, false),
    bankroll: num(r.bankroll, defaults.bankroll, LAB_LIMITS.bankroll, false),
    shoesPerTrial: num(r.shoesPerTrial, defaults.shoesPerTrial, LAB_LIMITS.shoesPerTrial, true),
    trials: num(r.trials, defaults.trials, LAB_LIMITS.trials, true),
    stopLoss: num(r.stopLoss, defaults.stopLoss, LAB_LIMITS.stop, false),
    stopWin: num(r.stopWin, defaults.stopWin, LAB_LIMITS.stop, false),
    dragon7: isSideBetMode(r.dragon7) ? r.dragon7 : defaults.dragon7,
    panda8: isSideBetMode(r.panda8) ? r.panda8 : defaults.panda8,
    sideUnits: num(r.sideUnits, defaults.sideUnits, LAB_LIMITS.sideUnits, false),
    seed: num(r.seed, defaults.seed, LAB_LIMITS.seed, true),
  };
}
