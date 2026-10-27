/**
 * The drills hub: lists every drill with its saved score and opens one. Self-contained — it keeps the open
 * drill in local state, or in the hash when it is shown at `#learn/drills` (then `#learn/drills/<id>` opens a
 * drill and the browser's Back button returns to the hub).
 */
import { useCallback, useState, type ComponentType } from 'react';
import { Button, cx, formatPercent, navigate, toHash, useHashRoute } from '@/ui/shell';
import { BestBetDrill } from './BestBetDrill';
import { CountingDrill } from './CountingDrill';
import styles from './DrillsHub.module.css';
import { PayoutDrill } from './PayoutDrill';
import { RoadDrill } from './RoadDrill';
import { ThirdCardDrill } from './ThirdCardDrill';
import { accuracy, resetAllDrillScores, useDrillScores } from './scores';
import { DRILLS, isDrillId, type DrillId, type DrillProps } from './types';

export const DRILL_COMPONENTS: Readonly<Record<DrillId, ComponentType<DrillProps>>> = {
  'third-card': ThirdCardDrill,
  payout: PayoutDrill,
  'best-bet': BestBetDrill,
  road: RoadDrill,
  counting: CountingDrill,
};

/** `#learn/drills/<id>` */
export function drillHash(id: DrillId): string {
  return `${toHash('learn', 'drills')}/${id}`;
}

/** The drill id in a `#learn/drills/<id>` hash, or null. */
export function parseDrillHash(hash: string): DrillId | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    path = raw;
  }
  const segments = path.replace(/^\/+/, '').split('/').map((s) => s.trim());
  if ((segments[0] ?? '').toLowerCase() !== 'learn' || (segments[1] ?? '').toLowerCase() !== 'drills') return null;
  const id = segments[2] ?? '';
  return isDrillId(id) ? id : null;
}

export interface DrillsHubProps {
  /** Drill to open at first render (ignored when the hash names one). */
  initialDrill?: DrillId | null;
  /** Seed handed to every drill (tests); omitted → random questions. */
  seed?: number;
  className?: string;
  onOpenChange?: (id: DrillId | null) => void;
}

export function DrillsHub({ initialDrill = null, seed, className, onOpenChange }: DrillsHubProps): JSX.Element {
  const route = useHashRoute();
  const routed = route.mode === 'learn' && route.lessonId === 'drills';
  const hashDrill = routed ? parseDrillHash(route.hash) : null;
  const [local, setLocal] = useState<DrillId | null>(initialDrill);
  const open = routed ? hashDrill : local;
  const scores = useDrillScores();

  const setOpen = useCallback(
    (id: DrillId | null) => {
      if (routed) navigate(id ? drillHash(id) : toHash('learn', 'drills'));
      else setLocal(id);
      onOpenChange?.(id);
    },
    [routed, onOpenChange],
  );

  if (open !== null) {
    const Drill = DRILL_COMPONENTS[open];
    return <Drill seed={seed} onBack={() => setOpen(null)} className={className} />;
  }

  let attempted = 0;
  let correct = 0;
  for (const d of DRILLS) {
    attempted += scores[d.id].attempted;
    correct += scores[d.id].correct;
  }

  return (
    <section className={cx(styles.hub, className)} aria-labelledby="drills-hub-title" data-testid="drills-hub">
      <div className={styles.header}>
        <div>
          <h2 id="drills-hub-title" className={styles.title}>
            Drills
          </h2>
          <p className={styles.lede}>Short, scored exercises. Every answer comes with the rule behind it; your scores and streaks are saved on this device.</p>
        </div>
        <div className={styles.overall}>
          {attempted > 0 ? (
            <span data-testid="drills-overall">
              {correct}/{attempted} correct overall ({formatPercent(correct / attempted, 0)})
            </span>
          ) : (
            <span data-testid="drills-overall">No answers yet</span>
          )}
          <Button variant="ghost" size="sm" onClick={resetAllDrillScores} disabled={attempted === 0} data-testid="drills-reset-all">
            Reset all scores
          </Button>
        </div>
      </div>
      <div className={styles.grid}>
        {DRILLS.map((d) => {
          const s = scores[d.id];
          const acc = accuracy(s);
          return (
            <article key={d.id} className={styles.card} aria-labelledby={`drill-card-${d.id}`} data-testid={`drill-card-${d.id}`}>
              <div className={styles.cardTop}>
                <span className={styles.icon} aria-hidden="true">
                  {d.icon}
                </span>
                <div>
                  <span className={styles.skill}>{d.skill}</span>
                  <h3 id={`drill-card-${d.id}`} className={styles.cardTitle}>
                    {d.title}
                  </h3>
                </div>
              </div>
              <p className={styles.blurb}>{d.blurb}</p>
              <p className={styles.keysHint}>Keys: {d.keys}</p>
              <div className={styles.scoreRow} role="group" aria-label={`${d.title} saved score`}>
                <div className={cx(styles.stat, styles.statGold)}>
                  <span className={styles.statLabel}>Correct</span>
                  <span className={styles.statValue} data-testid={`card-score-${d.id}`}>
                    {s.correct}/{s.attempted}
                  </span>
                </div>
                <div className={cx(styles.stat, s.streak >= 3 && styles.statGood)}>
                  <span className={styles.statLabel}>Streak</span>
                  <span className={styles.statValue}>{s.streak}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Best</span>
                  <span className={styles.statValue}>{s.best}</span>
                </div>
              </div>
              <div className={styles.footer}>
                {acc === null ? <span className={styles.unplayed}>Not played yet</span> : <span className={styles.keys}>{formatPercent(acc, 0)} accuracy</span>}
                <Button variant="primary" size="sm" onClick={() => setOpen(d.id)} data-testid={`open-${d.id}`}>
                  {s.attempted > 0 ? 'Continue' : 'Start'}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
