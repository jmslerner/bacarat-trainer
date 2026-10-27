/**
 * Saved runs for the comparison table (SPEC §5.7): up to six per browser, persisted under `bt:lab`.
 * A saved run keeps the form that produced it (so it can be loaded back) and the summary figures of the result,
 * never the full curves, so six runs stay a few kilobytes.
 */
import { createPersistedStore, useStore } from '@/ui/shell';
import type { SideBetSimStats, SimResult } from '@/strategy';
import { sanitizeLabConfig, type LabConfig } from './config';
import type { EdgeRange } from './edge';

export const SAVED_RUNS_KEY = 'lab';
export const MAX_SAVED_RUNS = 6;

export interface RunSummary {
  trials: number;
  shoesPerTrial: number;
  bankroll: number;
  unit: number;
  seed: number;
  handsPlayed: number;
  handsBet: number;
  totalWagered: number;
  net: number;
  realizedEdge: number;
  expectedEdge: EdgeRange | null;
  meanFinal: number;
  medianFinal: number;
  stdFinal: number;
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  pProfit: number;
  pRuin: number;
  meanMaxDrawdown: number;
  worstDrawdown: number;
  sideBets: Record<'dragon7' | 'panda8', SideBetSimStats>;
  byOutcome: { player: number; banker: number; tie: number };
  elapsedMs: number;
}

export interface SavedRun {
  id: string;
  /** Epoch milliseconds. */
  savedAt: number;
  /** `describeStrategy` of the run. */
  name: string;
  /** Short description of the table rules the run used. */
  rulesSummary: string;
  form: LabConfig;
  summary: RunSummary;
}

export function summarizeResult(result: SimResult, expectedEdge: EdgeRange | null): RunSummary {
  const { config } = result;
  return {
    trials: result.trials,
    shoesPerTrial: config.shoesPerTrial,
    bankroll: config.bankroll,
    unit: config.strategy.unit,
    seed: config.seed,
    handsPlayed: result.handsPlayed,
    handsBet: result.handsBet,
    totalWagered: result.totalWagered,
    net: result.net,
    realizedEdge: result.realizedEdge,
    expectedEdge: expectedEdge ? { low: expectedEdge.low, high: expectedEdge.high } : null,
    meanFinal: result.meanFinal,
    medianFinal: result.medianFinal,
    stdFinal: result.stdFinal,
    percentiles: { ...result.percentiles },
    pProfit: result.pProfit,
    pRuin: result.pRuin,
    meanMaxDrawdown: result.meanMaxDrawdown,
    worstDrawdown: result.worstDrawdown,
    sideBets: { dragon7: { ...result.sideBets.dragon7 }, panda8: { ...result.sideBets.panda8 } },
    byOutcome: { ...result.byOutcome },
    elapsedMs: result.elapsedMs,
  };
}

/* ---- sanitizing ------------------------------------------------------------------------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sideStats(raw: unknown): SideBetSimStats | null {
  if (!isRecord(raw) || !finite(raw.bets) || !finite(raw.wins) || !finite(raw.wagered) || !finite(raw.net)) return null;
  return { bets: raw.bets, wins: raw.wins, wagered: raw.wagered, net: raw.net };
}

function sanitizeSummary(raw: unknown): RunSummary | null {
  if (!isRecord(raw)) return null;
  const keys = ['trials', 'shoesPerTrial', 'bankroll', 'unit', 'seed', 'handsPlayed', 'handsBet', 'totalWagered', 'net', 'realizedEdge', 'meanFinal', 'medianFinal', 'stdFinal', 'pProfit', 'pRuin', 'meanMaxDrawdown', 'worstDrawdown', 'elapsedMs'] as const;
  for (const key of keys) if (!finite(raw[key])) return null;
  const p = raw.percentiles;
  if (!isRecord(p) || !finite(p.p5) || !finite(p.p25) || !finite(p.p50) || !finite(p.p75) || !finite(p.p95)) return null;
  const side = raw.sideBets;
  if (!isRecord(side)) return null;
  const dragon7 = sideStats(side.dragon7);
  const panda8 = sideStats(side.panda8);
  if (!dragon7 || !panda8) return null;
  const by = raw.byOutcome;
  if (!isRecord(by) || !finite(by.player) || !finite(by.banker) || !finite(by.tie)) return null;
  const edge = raw.expectedEdge;
  const expectedEdge = isRecord(edge) && finite(edge.low) && finite(edge.high) ? { low: edge.low, high: edge.high } : null;
  const r = raw as Record<(typeof keys)[number], number> & Record<string, unknown>;
  return {
    trials: r.trials,
    shoesPerTrial: r.shoesPerTrial,
    bankroll: r.bankroll,
    unit: r.unit,
    seed: r.seed,
    handsPlayed: r.handsPlayed,
    handsBet: r.handsBet,
    totalWagered: r.totalWagered,
    net: r.net,
    realizedEdge: r.realizedEdge,
    expectedEdge,
    meanFinal: r.meanFinal,
    medianFinal: r.medianFinal,
    stdFinal: r.stdFinal,
    percentiles: { p5: p.p5, p25: p.p25, p50: p.p50, p75: p.p75, p95: p.p95 },
    pProfit: r.pProfit,
    pRuin: r.pRuin,
    meanMaxDrawdown: r.meanMaxDrawdown,
    worstDrawdown: r.worstDrawdown,
    sideBets: { dragon7, panda8 },
    byOutcome: { player: by.player, banker: by.banker, tie: by.tie },
    elapsedMs: r.elapsedMs,
  };
}

function sanitizeRun(raw: unknown): SavedRun | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id === '' || !finite(raw.savedAt)) return null;
  const summary = sanitizeSummary(raw.summary);
  if (!summary) return null;
  return {
    id: raw.id,
    savedAt: raw.savedAt,
    name: typeof raw.name === 'string' ? raw.name : 'Saved run',
    rulesSummary: typeof raw.rulesSummary === 'string' ? raw.rulesSummary : '',
    form: sanitizeLabConfig(raw.form),
    summary,
  };
}

/** Whatever is in storage becomes a list of valid runs (invalid entries dropped, never more than the limit). */
export function sanitizeSavedRuns(raw: unknown): SavedRun[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedRun[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const run = sanitizeRun(item);
    if (!run || seen.has(run.id)) continue;
    seen.add(run.id);
    out.push(run);
    if (out.length === MAX_SAVED_RUNS) break;
  }
  return out;
}

/* ---- store ------------------------------------------------------------------------------- */

export const savedRunsStore = createPersistedStore<SavedRun[]>(SAVED_RUNS_KEY, [], { sanitize: (raw) => sanitizeSavedRuns(raw) });

export function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

export interface SaveRunInput {
  name: string;
  rulesSummary: string;
  form: LabConfig;
  summary: RunSummary;
}

/** Prepends the run; when six are already stored the oldest is dropped. Returns the stored run. */
export function saveRun(input: SaveRunInput): SavedRun {
  const run: SavedRun = { id: newRunId(), savedAt: Date.now(), name: input.name, rulesSummary: input.rulesSummary, form: { ...input.form, systemParams: { ...input.form.systemParams } }, summary: input.summary };
  savedRunsStore.set((prev) => [run, ...prev].slice(0, MAX_SAVED_RUNS));
  return run;
}

export function removeRun(id: string): void {
  savedRunsStore.set((prev) => (prev.some((r) => r.id === id) ? prev.filter((r) => r.id !== id) : prev));
}

export function clearRuns(): void {
  savedRunsStore.reset();
}

export function useSavedRuns(): readonly SavedRun[] {
  return useStore(savedRunsStore);
}
