import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  BONUS_ABBR,
  BONUS_DESCRIPTION,
  BONUS_KINDS,
  BONUS_LABELS,
  bonusHistory,
  bonusHitTitle,
  bonusSinceText,
  type BonusKind,
} from '../bonus';
import type { RoadResult } from '../types';
import { BonusMedallion } from './BonusMedallion';
import { cls } from './symbols';
import styles from './Scoreboard.module.css';

export interface BonusStripProps {
  results: readonly RoadResult[];
  className?: string;
}

/** Whether the element's content is wider than the element (re-measured when it resizes). */
function useOverflows(ref: RefObject<HTMLElement>, key: number): boolean {
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, key]);
  return overflows;
}

function legendTitle(kind: BonusKind, expectedEvery: number): string {
  return `${BONUS_LABELS[kind]} — ${BONUS_DESCRIPTION[kind]} (about 1 in ${expectedEvery} hands)`;
}

/**
 * The shoe's Dragon 7 / Panda 8 history: every hit in order as a medallion chip with its hand number, how long ago
 * the last hit of each kind was against its expected frequency, and a legend while the shoe has no hit yet. The
 * chips scroll sideways inside the strip, never the page.
 */
export function BonusStrip({ results, className }: BonusStripProps) {
  const history = useMemo(() => bonusHistory(results), [results]);
  const listRef = useRef<HTMLDivElement>(null);
  const overflows = useOverflows(listRef, history.hits.length);

  // Keep the newest hit in view.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el !== null) el.scrollLeft = el.scrollWidth;
  }, [history.hits.length]);

  const empty = history.hits.length === 0;
  return (
    <section
      className={cls(styles.bonus, className)}
      aria-label="Dragon 7 and Panda 8 this shoe"
      data-testid="bonus-strip"
      data-latest={history.latest ?? undefined}
    >
      <div className={styles.bonusHead}>
        {BONUS_KINDS.map((kind) => (
          <span key={kind} className={styles.bonusKey} title={legendTitle(kind, history[kind].expectedEvery)}>
            <BonusMedallion kind={kind} size={13} />
            <span>{BONUS_LABELS[kind]}</span>
          </span>
        ))}
      </div>
      {empty ? (
        <p className={styles.bonusEmpty} data-testid="bonus-empty">
          No Dragon 7 or Panda 8 yet this shoe
        </p>
      ) : (
        <div
          ref={listRef}
          className={styles.bonusHits}
          data-testid="bonus-hits"
          role="list"
          aria-label={`${history.hits.length} ${history.hits.length === 1 ? 'hit' : 'hits'} this shoe, oldest first${overflows ? ' (scrolls sideways)' : ''}`}
          tabIndex={overflows ? 0 : undefined}
        >
          {history.hits.map((hit) => (
            <span
              key={hit.handIndex}
              role="listitem"
              className={cls(
                styles.bonusHit,
                hit.kind === 'dragon7' ? styles.bonusHitDragon : styles.bonusHitPanda,
                hit.hand === history.total && styles.bonusHitNew,
              )}
              data-testid="bonus-hit"
              data-kind={hit.kind}
              data-hand={hit.hand}
              title={bonusHitTitle(hit.kind, hit.hand)}
              aria-label={`${BONUS_LABELS[hit.kind]} on hand ${hit.hand}`}
            >
              <BonusMedallion kind={hit.kind} size={14} />
              <span aria-hidden="true">
                {BONUS_ABBR[hit.kind]} #{hit.hand}
              </span>
            </span>
          ))}
        </div>
      )}
      {empty ? (
        <p className={styles.bonusLegend} data-testid="bonus-legend">
          {BONUS_KINDS.map((kind) => (
            <span key={kind} className={styles.bonusLegendItem}>
              <BonusMedallion kind={kind} size={12} />
              <span>
                {BONUS_LABELS[kind]}: {BONUS_DESCRIPTION[kind]}, about 1 in {history[kind].expectedEvery} hands
              </span>
            </span>
          ))}
        </p>
      ) : (
        <p className={styles.bonusSince}>
          {BONUS_KINDS.map((kind) => (
            <span key={kind} data-testid={`bonus-since-${kind}`}>
              {bonusSinceText(history[kind])}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
