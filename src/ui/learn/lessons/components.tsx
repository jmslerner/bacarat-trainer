/**
 * Building blocks shared by every lesson: the page frame (header, table of contents, footer navigation),
 * sections, callouts, fact tiles, tables, widget panels, outcome badges and hands of cards.
 */
import { useEffect, type MouseEvent, type ReactNode } from 'react';
import type { Card, Outcome, Side } from '@/engine';
import { handTotal } from '@/engine';
import { Button, PlayingCard, cx, toHash, useLocalStorage, type CardSize } from '@/ui/shell';
import { DRILLS_ID, LESSONS, lessonMeta, lessonNeighbours, type LessonId } from './registry';
import styles from './Lesson.module.css';

/* ---- completion state (persisted under bt:learn:completed) ------------------------------------------------- */

export type CompletedMap = Readonly<Record<string, boolean>>;

const isCompletedMap = (v: unknown): v is CompletedMap =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v as Record<string, unknown>).every((x) => typeof x === 'boolean');

/** Which lessons the reader has marked complete; shared by the sidebar and the lesson footers. */
export function useCompletedLessons(): [CompletedMap, (id: LessonId, done: boolean) => void] {
  const [map, setMap] = useLocalStorage<CompletedMap>('learn:completed', {}, { sanitize: (raw, defaults) => (isCompletedMap(raw) ? raw : defaults) });
  const setDone = (id: LessonId, done: boolean): void => {
    setMap((prev) => {
      const next: Record<string, boolean> = { ...prev };
      if (done) next[id] = true;
      else delete next[id];
      return next;
    });
  };
  return [map, setDone];
}

/* ---- page frame -------------------------------------------------------------------------------------------- */

export interface SectionDef {
  id: string;
  title: string;
}

export interface LessonPageProps {
  id: LessonId;
  lede: ReactNode;
  sections: readonly SectionDef[];
  children: ReactNode;
}

/** Header (kicker, title, lede, table of contents), the sections, and the footer navigation. */
export function LessonPage({ id, lede, sections, children }: LessonPageProps): ReactNode {
  const meta = lessonMeta(id);
  const { prev, next } = lessonNeighbours(id);
  const [completed, setDone] = useCompletedLessons();
  const done = completed[id] === true;

  useEffect(() => {
    document.title = `${meta.title} — Learn — Baccarat Trainer`;
  }, [meta.title]);

  return (
    <article className={styles.lesson} aria-labelledby={`lesson-${id}-title`} data-lesson={id}>
      <header className={styles.header}>
        <div className={styles.kicker}>
          <span>
            Lesson {meta.number} of {LESSONS.length}
          </span>
          <span className={styles.kickerDot} aria-hidden="true">
            ·
          </span>
          <span>About {meta.minutes} min</span>
          {done && (
            <>
              <span className={styles.kickerDot} aria-hidden="true">
                ·
              </span>
              <span className="c-win">Completed</span>
            </>
          )}
        </div>
        <h1 id={`lesson-${id}-title`} className={styles.title}>
          {meta.title}
        </h1>
        <p className={styles.lede}>{lede}</p>
        <p className={styles.tocLabel} id={`lesson-${id}-toc`}>
          On this page
        </p>
        <ul className={styles.toc} aria-labelledby={`lesson-${id}-toc`}>
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#learn/${id}/${s.id}`} onClick={(e) => jumpTo(e, s.id)}>
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ul>
      </header>

      {children}

      <footer className={styles.footer}>
        <div className={styles.footerRow}>
          <div className={styles.footerDone}>
            <Button variant={done ? 'secondary' : 'primary'} size="sm" active={done} onClick={() => setDone(id, !done)}>
              {done ? 'Completed — click to undo' : 'Mark lesson complete'}
            </Button>
          </div>
          {meta.drill && (
            <a href={toHash('learn', DRILLS_ID)} className={styles.linkCard}>
              <span className={styles.linkCardKicker}>Practise</span>
              <span>{meta.drill}</span>
            </a>
          )}
        </div>
        <nav className={styles.navGrid} aria-label="Lesson navigation">
          {prev ? (
            <a href={toHash('learn', prev.id)} className={styles.navCard}>
              <span className={styles.navKicker}>Previous · Lesson {prev.number}</span>
              <span className={styles.navTitle}>{prev.title}</span>
            </a>
          ) : (
            <a href={toHash('learn')} className={styles.navCard}>
              <span className={styles.navKicker}>Start</span>
              <span className={styles.navTitle}>All lessons</span>
            </a>
          )}
          {next ? (
            <a href={toHash('learn', next.id)} className={cx(styles.navCard, styles.navNext)}>
              <span className={styles.navKicker}>Next · Lesson {next.number}</span>
              <span className={styles.navTitle}>{next.title}</span>
            </a>
          ) : (
            <a href={toHash('learn', DRILLS_ID)} className={cx(styles.navCard, styles.navNext)}>
              <span className={styles.navKicker}>Next</span>
              <span className={styles.navTitle}>Put it to the test in the drills</span>
            </a>
          )}
        </nav>
      </footer>
    </article>
  );
}

/** In-page jump that does not disturb the hash route. */
function jumpTo(e: MouseEvent<HTMLAnchorElement>, sectionId: string): void {
  const el = document.getElementById(sectionId);
  if (!el) return;
  e.preventDefault();
  if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' });
  el.focus({ preventScroll: true });
}

export interface SectionProps {
  id: string;
  title: ReactNode;
  number?: number;
  children: ReactNode;
  className?: string;
}

export function Section({ id, title, number, children, className }: SectionProps): ReactNode {
  return (
    <section id={id} className={cx(styles.section, className)} aria-labelledby={`${id}-title`} tabIndex={-1}>
      <h2 id={`${id}-title`} className={styles.sectionTitle}>
        {number !== undefined && (
          <span className={styles.sectionNo} aria-hidden="true">
            {number}.
          </span>
        )}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Flowing text: paragraphs, lists, small headings. */
export function Prose({ children, className }: { children: ReactNode; className?: string }): ReactNode {
  return <div className={cx(styles.prose, className)}>{children}</div>;
}

/* ---- callouts ---------------------------------------------------------------------------------------------- */

export type CalloutTone = 'tip' | 'warn' | 'math' | 'casino' | 'rule' | 'truth';

const CALLOUT_LABELS: Record<CalloutTone, string> = {
  tip: 'Tip',
  warn: 'Watch out',
  math: 'The math',
  casino: 'On the floor',
  rule: 'The rule',
  truth: 'Plain truth',
};

export interface CalloutProps {
  tone?: CalloutTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Callout({ tone = 'tip', title, children, className }: CalloutProps): ReactNode {
  return (
    <aside className={cx(styles.callout, styles[tone], className)} data-callout={tone}>
      <span className={styles.calloutLabel}>{CALLOUT_LABELS[tone]}</span>
      {title !== undefined && <p className={styles.calloutTitle}>{title}</p>}
      <div className={styles.calloutBody}>{children}</div>
    </aside>
  );
}

/* ---- fact tiles -------------------------------------------------------------------------------------------- */

export type FactTone = 'neutral' | 'gold' | 'banker' | 'player' | 'tie' | 'positive' | 'negative';

export interface FactItem {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: FactTone;
}

const FACT_TONE_CLASS: Record<FactTone, string | undefined> = {
  neutral: undefined,
  gold: styles.factGold,
  banker: styles.factBanker,
  player: styles.factPlayer,
  tie: styles.factTie,
  positive: styles.factPositive,
  negative: styles.factNegative,
};

export function Facts({ items, className }: { items: readonly FactItem[]; className?: string }): ReactNode {
  return (
    <dl className={cx(styles.facts, className)}>
      {items.map((f, i) => (
        <div key={i} className={cx(styles.fact, FACT_TONE_CLASS[f.tone ?? 'neutral'])}>
          <dt className={styles.factLabel}>{f.label}</dt>
          <dd className={styles.factValue}>{f.value}</dd>
          {f.sub !== undefined && <dd className={styles.factSub}>{f.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

/* ---- tables ------------------------------------------------------------------------------------------------ */

export interface TableProps {
  caption?: ReactNode;
  children: ReactNode;
  compact?: boolean;
  className?: string;
}

/** A horizontally scrollable table. Put <thead>/<tbody> inside; use `num` / `muted` / `dim` / `strong` classes. */
export function Table({ caption, children, compact, className }: TableProps): ReactNode {
  return (
    <div className={cx(styles.tableWrap, className)}>
      <table className={cx(styles.table, compact && styles.compact)}>
        {caption !== undefined && <caption>{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export const tableClass = { num: styles.num, muted: styles.muted, dim: styles.dim, strong: styles.strong };

/* ---- widget panel ------------------------------------------------------------------------------------------ */

export interface WidgetProps {
  title: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  'data-widget'?: string;
}

export function Widget({ title, hint, actions, children, className, bodyClassName, ...rest }: WidgetProps): ReactNode {
  return (
    <div className={cx(styles.widget, className)} data-widget={rest['data-widget']}>
      <div className={styles.widgetHead}>
        <div>
          <p className={styles.widgetTitle}>{title}</p>
          {hint !== undefined && <span className={styles.widgetHint}>{hint}</span>}
        </div>
        {actions !== undefined && <div className={styles.widgetActions}>{actions}</div>}
      </div>
      <div className={cx(styles.widgetBody, bodyClassName)}>{children}</div>
    </div>
  );
}

/* ---- outcome badges, side words, sequences ----------------------------------------------------------------- */

const OUTCOME_CLASS: Record<Outcome, string> = { player: styles.badgePlayer, banker: styles.badgeBanker, tie: styles.badgeTie };
const OUTCOME_LETTER: Record<Outcome, string> = { player: 'P', banker: 'B', tie: 'T' };
const OUTCOME_NAME: Record<Outcome, string> = { player: 'Player', banker: 'Banker', tie: 'Tie' };

export function OutcomeBadge({ outcome, small }: { outcome: Outcome; small?: boolean }): ReactNode {
  return (
    <span className={cx(styles.badge, small && styles.badgeSm, OUTCOME_CLASS[outcome])} role="img" aria-label={OUTCOME_NAME[outcome]}>
      {OUTCOME_LETTER[outcome]}
    </span>
  );
}

export function SideWord({ side, children }: { side: Side | 'tie'; children?: ReactNode }): ReactNode {
  const cls = side === 'player' ? styles.sidePlayer : side === 'banker' ? styles.sideBanker : styles.sideTie;
  return <span className={cx(styles.side, cls)}>{children ?? OUTCOME_NAME[side]}</span>;
}

/** A sequence of results as numbered badges (hand 1, 2, 3 …). */
export function ResultSequence({ outcomes, startAt = 1 }: { outcomes: readonly Outcome[]; startAt?: number }): ReactNode {
  return (
    <ol className={styles.sequence} aria-label="Hand results in order">
      {outcomes.map((o, i) => (
        <li key={i} className={styles.seqItem}>
          <OutcomeBadge outcome={o} small />
          <span className={styles.seqNo} aria-hidden="true">
            {startAt + i}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ---- hands of cards ---------------------------------------------------------------------------------------- */

export interface HandCardsProps {
  side: Side;
  /** Cards to show; the third (index 2) is placed sideways like a real third card. */
  cards: readonly Pick<Card, 'rank' | 'suit'>[];
  /** Show this total, or compute it from the cards (`'auto'`), or hide it (`null`). */
  total?: number | 'auto' | null;
  size?: CardSize;
  /** Highlight the card at this index (e.g. the third card that made a Dragon 7). */
  highlightIndex?: number;
  /** Empty slots to draw after the cards (e.g. 2 before any card is dealt). */
  slots?: number;
  label?: ReactNode;
}

export function HandCards({ side, cards, total = 'auto', size = 'md', highlightIndex, slots = 0, label }: HandCardsProps): ReactNode {
  const shown = total === 'auto' ? (cards.length > 0 ? handTotal(cards.map((c, i) => ({ ...c, id: i }))) : null) : total;
  const name = side === 'player' ? 'Player' : 'Banker';
  return (
    <div className={styles.hand} data-hand={side}>
      <span className={cx(styles.handLabel, side === 'player' ? styles.sidePlayer : styles.sideBanker)}>{label ?? name}</span>
      <div className={styles.handCards} role="group" aria-label={`${name} cards`}>
        {cards.map((c, i) => (
          <PlayingCard key={i} card={c} size={size} rotated={i === 2} highlight={highlightIndex === i} />
        ))}
        {Array.from({ length: Math.max(0, slots - cards.length) }, (_, i) => (
          <PlayingCard key={`slot-${i}`} size={size} />
        ))}
      </div>
      <span className={cx(styles.handTotal, shown === null && styles.handTotalEmpty)} aria-label={shown === null ? `${name} total not yet known` : `${name} total ${shown}`}>
        {shown === null ? '—' : shown}
      </span>
    </div>
  );
}

export function HandsRow({ children, three }: { children: ReactNode; three?: boolean }): ReactNode {
  return <div className={cx(styles.hands, three && styles.hands3)}>{children}</div>;
}

/* ---- links ------------------------------------------------------------------------------------------------- */

export function LessonLink({ to, children }: { to: LessonId; children?: ReactNode }): ReactNode {
  return (
    <a href={toHash('learn', to)} className={styles.inlineLink}>
      {children ?? lessonMeta(to).title}
    </a>
  );
}

export function LinkCard({ href, kicker, children }: { href: string; kicker: ReactNode; children: ReactNode }): ReactNode {
  return (
    <a href={href} className={styles.linkCard}>
      <span className={styles.linkCardKicker}>{kicker}</span>
      <span>{children}</span>
    </a>
  );
}

export function LinkRow({ children }: { children: ReactNode }): ReactNode {
  return <div className={styles.linkRow}>{children}</div>;
}

export const lessonStyles = styles;
