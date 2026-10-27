/**
 * Persisted settings: table rules (`bt:rules`), preferences (`bt:prefs`) and the default
 * buy-in (`bt:buyIn`). Stores are module singletons so non-React code (the GameSession
 * bridge in useSession.ts) can read and subscribe to them too.
 */
import { useCallback, useMemo } from 'react';
import { DEFAULT_RULES, RULE_PRESETS, TABLE_LEVELS, tableLevelOf, validateRules } from '@/engine';
import type { BankerRule, BetLimits, TableRules } from '@/engine';
import { createPersistedStore, useStore } from './storage';

export type DealSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export interface Prefs {
  /** Synthesized table sounds. */
  sound: boolean;
  /** Pace of the dealing animation. */
  dealSpeed: DealSpeed;
  /** Show the Coach panel (house edge, counts, recommendations). */
  showCoach: boolean;
  /** One-line explanation under each dealer call. */
  beginnerTips: boolean;
}

export const DEFAULT_PREFS: Prefs = { sound: true, dealSpeed: 'normal', showCoach: true, beginnerTips: true };
export const DEFAULT_BUY_IN = 1000;

export const DEAL_SPEEDS: ReadonlyArray<{ id: DealSpeed; label: string; stepMs: number; hint: string }> = [
  { id: 'slow', label: 'Slow', stepMs: 1100, hint: 'Every call lingers — good for learning' },
  { id: 'normal', label: 'Normal', stepMs: 650, hint: 'Casino pace' },
  { id: 'fast', label: 'Fast', stepMs: 300, hint: 'Quick hands' },
  { id: 'instant', label: 'Instant', stepMs: 0, hint: 'No animation' },
];

/** Base delay per dealing step for a speed setting (0 = instant). */
export function dealSpeedMs(speed: DealSpeed): number {
  return DEAL_SPEEDS.find((s) => s.id === speed)?.stepMs ?? 650;
}

export const SETTINGS_KEYS = {
  rules: 'bt:rules',
  prefs: 'bt:prefs',
  buyIn: 'bt:buyIn',
  bankroll: 'bt:bankroll',
} as const;

export type RulePresetId = keyof typeof RULE_PRESETS;
export const RULE_PRESET_IDS: readonly RulePresetId[] = ['ez', 'commission', 'super6'];

/** Standard US casino chip denominations offered by the rule editor ($25,000 and the $100,000 plaque for the salons). */
export const STANDARD_CHIP_DENOMINATIONS: readonly number[] = [1, 5, 25, 100, 500, 1000, 5000, 25000, 100000];

/** The rule fields that make a game variant; the table level (limits + chip tray) is the rest. */
export const VARIANT_KEYS = ['decks', 'bankerRule', 'commissionRate', 'tiePays', 'dragon7Pays', 'panda8Pays', 'pairPays', 'sideBets', 'cutCardFromEnd', 'burnProcedure'] as const;
export type RuleVariant = Pick<TableRules, (typeof VARIANT_KEYS)[number]>;

/* ---- sanitizers: whatever is in storage becomes a valid shape --------------------------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number, opts: { min?: number; max?: number; int?: boolean } = {}): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  let out = opts.int ? Math.round(n) : n;
  if (opts.min !== undefined && out < opts.min) out = fallback;
  if (opts.max !== undefined && out > opts.max) out = fallback;
  return out;
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function limits(v: unknown, fallback: BetLimits): BetLimits {
  if (!isRecord(v)) return { ...fallback };
  return { min: num(v.min, fallback.min, { min: 0 }), max: num(v.max, fallback.max, { min: 0 }) };
}

const BANKER_RULES: readonly BankerRule[] = ['ez', 'commission', 'super6'];

/** Deep-merge persisted rules over the defaults, coercing every field to a legal value. */
export function sanitizeRules(raw: unknown, defaults: TableRules = DEFAULT_RULES): TableRules {
  if (!isRecord(raw)) return { ...defaults };
  const side = isRecord(raw.sideBets) ? raw.sideBets : {};
  const lim = isRecord(raw.limits) ? raw.limits : {};
  const chips = Array.isArray(raw.chipDenominations)
    ? Array.from(new Set(raw.chipDenominations.filter((c): c is number => typeof c === 'number' && Number.isFinite(c) && c > 0))).sort((a, b) => a - b)
    : [];
  return {
    decks: raw.decks === 6 || raw.decks === 8 ? raw.decks : defaults.decks,
    bankerRule: BANKER_RULES.includes(raw.bankerRule as BankerRule) ? (raw.bankerRule as BankerRule) : defaults.bankerRule,
    commissionRate: num(raw.commissionRate, defaults.commissionRate, { min: 0, max: 1 }),
    tiePays: num(raw.tiePays, defaults.tiePays, { min: 0 }),
    dragon7Pays: num(raw.dragon7Pays, defaults.dragon7Pays, { min: 0 }),
    panda8Pays: num(raw.panda8Pays, defaults.panda8Pays, { min: 0 }),
    pairPays: num(raw.pairPays, defaults.pairPays, { min: 0 }),
    sideBets: {
      dragon7: bool(side.dragon7, defaults.sideBets.dragon7),
      panda8: bool(side.panda8, defaults.sideBets.panda8),
      pairs: bool(side.pairs, defaults.sideBets.pairs),
    },
    limits: {
      main: limits(lim.main, defaults.limits.main),
      tie: limits(lim.tie, defaults.limits.tie),
      side: limits(lim.side, defaults.limits.side),
    },
    cutCardFromEnd: num(raw.cutCardFromEnd, defaults.cutCardFromEnd, { min: 0, int: true }),
    burnProcedure: bool(raw.burnProcedure, defaults.burnProcedure),
    chipDenominations: chips.length > 0 ? chips : [...defaults.chipDenominations],
  };
}

export function sanitizePrefs(raw: unknown, defaults: Prefs = DEFAULT_PREFS): Prefs {
  if (!isRecord(raw)) return { ...defaults };
  const speed = DEAL_SPEEDS.some((s) => s.id === raw.dealSpeed) ? (raw.dealSpeed as DealSpeed) : defaults.dealSpeed;
  return {
    sound: bool(raw.sound, defaults.sound),
    dealSpeed: speed,
    showCoach: bool(raw.showCoach, defaults.showCoach),
    beginnerTips: bool(raw.beginnerTips, defaults.beginnerTips),
  };
}

export function sanitizeBuyIn(raw: unknown, defaults: number = DEFAULT_BUY_IN): number {
  return num(raw, defaults, { min: 0 });
}

/* ---- stores ------------------------------------------------------------------------------ */

export const rulesStore = createPersistedStore<TableRules>(SETTINGS_KEYS.rules, DEFAULT_RULES, { sanitize: sanitizeRules });
export const prefsStore = createPersistedStore<Prefs>(SETTINGS_KEYS.prefs, DEFAULT_PREFS, { sanitize: sanitizePrefs });
export const buyInStore = createPersistedStore<number>(SETTINGS_KEYS.buyIn, DEFAULT_BUY_IN, { sanitize: sanitizeBuyIn });

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = Object.keys(ra);
  if (keys.length !== Object.keys(rb).length) return false;
  return keys.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && deepEqual(ra[k], rb[k]));
}

/** Structural equality for rule objects, independent of key order (used to detect "dirty" edits). */
export function rulesEqual(a: TableRules, b: TableRules): boolean {
  return deepEqual(a, b);
}

/** Just the variant fields of a rule set (no limits, no chip tray). */
export function ruleVariant(rules: TableRules): RuleVariant {
  return {
    decks: rules.decks,
    bankerRule: rules.bankerRule,
    commissionRate: rules.commissionRate,
    tiePays: rules.tiePays,
    dragon7Pays: rules.dragon7Pays,
    panda8Pays: rules.panda8Pays,
    pairPays: rules.pairPays,
    sideBets: { ...rules.sideBets },
    cutCardFromEnd: rules.cutCardFromEnd,
    burnProcedure: rules.burnProcedure,
  };
}

/** Same game variant (Banker rule, payouts, side bets, shoe), whatever the table level. */
export function variantEqual(a: TableRules, b: TableRules): boolean {
  return deepEqual(ruleVariant(a), ruleVariant(b));
}

/**
 * Which preset (if any) the rule set's VARIANT matches. The presets are variant-only, so the table level
 * (limits and chip tray) never makes a rule set "custom" here — `tableLevelOf` answers that question.
 */
export function matchPreset(rules: TableRules): RulePresetId | null {
  for (const id of RULE_PRESET_IDS) {
    if (variantEqual(rules, RULE_PRESETS[id].rules)) return id;
  }
  return null;
}

/** The preset's variant over the given rules' table level: limits and chip tray are kept. */
export function applyRulePreset(rules: TableRules, id: RulePresetId): TableRules {
  return sanitizeRules({ ...RULE_PRESETS[id].rules, limits: rules.limits, chipDenominations: rules.chipDenominations });
}

/** "$500 high-limit salon", or "Custom limits" when the rules match no table level. */
export function tableLevelLabel(rules: TableRules): string {
  const id = tableLevelOf(rules);
  return id === 'custom' ? 'Custom limits' : TABLE_LEVELS[id].name;
}

/* ---- hook -------------------------------------------------------------------------------- */

export interface SettingsApi {
  rules: TableRules;
  prefs: Prefs;
  /** Default buy-in amount (the bankroll a fresh session / "buy in" starts with). */
  buyIn: number;
  /**
   * Persist new rules; the GameSession singleton picks them up and starts a new shoe.
   * Returns the engine's problems with the rules (nothing is persisted unless the list is empty).
   */
  setRules(rules: TableRules): string[];
  /** Switch the game variant; the table level (limits and chip tray) is kept. */
  applyPreset(id: RulePresetId): void;
  resetRules(): void;
  setPrefs(patch: Partial<Prefs>): void;
  togglePref(key: 'sound' | 'showCoach' | 'beginnerTips'): void;
  setBuyIn(amount: number): void;
  /** Everything back to defaults (rules, prefs, buy-in). */
  resetAll(): void;
}

export function useSettings(): SettingsApi {
  const rules = useStore(rulesStore);
  const prefs = useStore(prefsStore);
  const buyIn = useStore(buyInStore);

  const setRules = useCallback((next: TableRules): string[] => {
    const clean = sanitizeRules(next);
    const problems = validateRules(clean);
    if (problems.length === 0) rulesStore.set(clean);
    return problems;
  }, []);
  const applyPreset = useCallback((id: RulePresetId) => rulesStore.set((r) => applyRulePreset(r, id)), []);
  const resetRules = useCallback(() => rulesStore.reset(), []);
  const setPrefs = useCallback((patch: Partial<Prefs>) => prefsStore.set((p) => sanitizePrefs({ ...p, ...patch })), []);
  const togglePref = useCallback((key: 'sound' | 'showCoach' | 'beginnerTips') => prefsStore.set((p) => ({ ...p, [key]: !p[key] })), []);
  const setBuyIn = useCallback((amount: number) => buyInStore.set(sanitizeBuyIn(amount)), []);
  const resetAll = useCallback(() => {
    rulesStore.reset();
    prefsStore.reset();
    buyInStore.reset();
  }, []);

  return useMemo(
    () => ({ rules, prefs, buyIn, setRules, applyPreset, resetRules, setPrefs, togglePref, setBuyIn, resetAll }),
    [rules, prefs, buyIn, setRules, applyPreset, resetRules, setPrefs, togglePref, setBuyIn, resetAll],
  );
}
