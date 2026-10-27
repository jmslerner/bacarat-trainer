/**
 * Drill scores, persisted under `bt:drills` through the shell's storage store (try/catch inside, degrades to
 * memory when storage is unavailable). One record per drill: correct / attempted, current streak, best streak.
 */
import { createPersistedStore, useStore } from '@/ui/shell';
import { DRILL_IDS, type DrillId, type DrillScore, type DrillScores } from './types';

/** Storage key (the store adds the `bt:` prefix → `bt:drills`). */
export const DRILL_SCORES_KEY = 'drills';

export const EMPTY_SCORE: Readonly<DrillScore> = Object.freeze({ attempted: 0, correct: 0, streak: 0, best: 0, updatedAt: null });

export function emptyScores(): DrillScores {
  const scores = {} as DrillScores;
  for (const id of DRILL_IDS) scores[id] = { ...EMPTY_SCORE };
  return scores;
}

function asCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function sanitizeScore(raw: unknown): DrillScore {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_SCORE };
  const r = raw as Record<string, unknown>;
  const attempted = asCount(r.attempted);
  const correct = Math.min(asCount(r.correct), attempted);
  const best = Math.min(asCount(r.best), correct);
  const streak = Math.min(asCount(r.streak), best);
  const updatedAt = typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : null;
  return { attempted, correct, streak, best, updatedAt };
}

/** Normalises whatever was persisted (possibly by an older version) into a full score table. */
export function sanitizeDrillScores(raw: unknown, defaults: DrillScores): DrillScores {
  const scores = emptyScores();
  for (const id of DRILL_IDS) scores[id] = { ...defaults[id] };
  if (typeof raw !== 'object' || raw === null) return scores;
  const r = raw as Record<string, unknown>;
  for (const id of DRILL_IDS) if (id in r) scores[id] = sanitizeScore(r[id]);
  return scores;
}

export const drillScoresStore = createPersistedStore<DrillScores>(DRILL_SCORES_KEY, emptyScores(), { sanitize: sanitizeDrillScores });

/** Records one answer and returns the drill's new score. */
export function recordDrillAnswer(id: DrillId, correct: boolean, now: number = Date.now()): DrillScore {
  let updated: DrillScore = { ...EMPTY_SCORE };
  drillScoresStore.set((prev) => {
    const s = prev[id] ?? EMPTY_SCORE;
    const streak = correct ? s.streak + 1 : 0;
    updated = {
      attempted: s.attempted + 1,
      correct: s.correct + (correct ? 1 : 0),
      streak,
      best: Math.max(s.best, streak),
      updatedAt: now,
    };
    return { ...prev, [id]: updated };
  });
  return updated;
}

export function resetDrillScore(id: DrillId): void {
  drillScoresStore.set((prev) => ({ ...prev, [id]: { ...EMPTY_SCORE } }));
}

export function resetAllDrillScores(): void {
  drillScoresStore.reset();
}

/** Fraction correct, or null before the first answer. */
export function accuracy(score: DrillScore): number | null {
  return score.attempted > 0 ? score.correct / score.attempted : null;
}

export function useDrillScores(): DrillScores {
  return useStore(drillScoresStore);
}

export function useDrillScore(id: DrillId): DrillScore {
  return useDrillScores()[id];
}
