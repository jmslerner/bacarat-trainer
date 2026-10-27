/**
 * Pieces shared by every drill: the frame (title, lesson link, score header, live status), the feedback panel,
 * the Player/Banker hands on felt and the free-text answer form.
 */
import { useEffect, useRef, type FormEvent, type ReactNode, type RefObject } from 'react';
import type { Card } from '@/engine';
import { Button, PlayingCard, cx, formatPercent, toHash, useIsPhone, type CardSize } from '@/ui/shell';
import styles from './drills.module.css';
import { accuracy, resetDrillScore, useDrillScore } from './scores';
import { drillMeta, type DrillId } from './types';

/* ---- score header ------------------------------------------------------- */

export function ScoreHeader({ id }: { id: DrillId }): JSX.Element {
  const score = useDrillScore(id);
  const meta = drillMeta(id);
  const acc = accuracy(score);
  return (
    <div className={styles.score} role="group" aria-label={`${meta.title} score`} data-testid="drill-score">
      <div className={styles.scoreStats}>
        <div className={cx(styles.scoreStat, styles.scoreGold)}>
          <span className={styles.scoreLabel}>Correct</span>
          <span className={styles.scoreValue} data-testid="score-correct">
            {score.correct}/{score.attempted}
          </span>
          <span className={styles.scoreSub}>{acc === null ? 'not played yet' : formatPercent(acc, 0)}</span>
        </div>
        <div className={cx(styles.scoreStat, score.streak >= 3 && styles.scoreGood)}>
          <span className={styles.scoreLabel}>Streak</span>
          <span className={styles.scoreValue} data-testid="score-streak">
            {score.streak}
          </span>
          <span className={styles.scoreSub}>in a row</span>
        </div>
        <div className={styles.scoreStat}>
          <span className={styles.scoreLabel}>Best</span>
          <span className={styles.scoreValue} data-testid="score-best">
            {score.best}
          </span>
          <span className={styles.scoreSub}>streak</span>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => resetDrillScore(id)} disabled={score.attempted === 0} aria-label={`Reset ${meta.title} score`}>
        Reset
      </Button>
    </div>
  );
}

/* ---- frame ---------------------------------------------------------------- */

export interface DrillFrameProps {
  id: DrillId;
  onBack?: () => void;
  className?: string;
  /** Announced through a persistent polite live region (the verdict after each answer). */
  status?: string;
  children: ReactNode;
}

export function DrillFrame({ id, onBack, className, status = '', children }: DrillFrameProps): JSX.Element {
  const meta = drillMeta(id);
  const titleId = `drill-${id}-title`;
  return (
    <section className={cx(styles.drill, className)} aria-labelledby={titleId} data-drill={id}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.crumbs}>
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} icon={<span aria-hidden="true">←</span>} data-testid="drill-back">
                All drills
              </Button>
            )}
            <span className={styles.skill}>Drill · {meta.skill}</span>
          </div>
          <h2 id={titleId} className={styles.title}>
            {meta.title}
          </h2>
          <p className={styles.blurb}>
            {meta.blurb}{' '}
            <a className={styles.lessonLink} href={toHash('learn', meta.lessonId)}>
              Review the lesson
            </a>
          </p>
        </div>
        <ScoreHeader id={id} />
      </header>
      <p className={styles.srOnly} role="status" aria-live="polite" data-testid="drill-status">
        {status}
      </p>
      {children}
    </section>
  );
}

/* ---- feedback ------------------------------------------------------------- */

export interface FeedbackProps {
  correct: boolean;
  headline: string;
  children?: ReactNode;
  onNext: () => void;
  nextLabel?: string;
  /** Extra actions next to the Next button. */
  actions?: ReactNode;
}

export function Feedback({ correct, headline, children, onNext, nextLabel = 'Next question', actions }: FeedbackProps): JSX.Element {
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className={cx(styles.feedback, correct ? styles.feedbackCorrect : styles.feedbackWrong)} data-testid="drill-feedback" data-correct={correct ? 'true' : 'false'}>
      <div className={styles.verdictRow}>
        <span className={styles.verdict}>{correct ? 'Correct' : 'Not quite'}</span>
        <h3 className={styles.headline}>{headline}</h3>
      </div>
      {children}
      <div className={styles.feedbackActions}>
        <Button ref={nextRef} variant="primary" onClick={onNext} kbd="Enter" data-testid="drill-next">
          {nextLabel}
        </Button>
        {actions}
      </div>
    </div>
  );
}

/* ---- hands on felt --------------------------------------------------------- */

export interface HandsProps {
  playerCards: readonly Card[];
  bankerCards: readonly Card[];
  playerTotal: number;
  bankerTotal: number;
  playerNote?: ReactNode;
  bankerNote?: ReactNode;
  /** Gold glow on the Player's third card (the card the Banker rule looks at). */
  highlightPlayerThird?: boolean;
  size?: CardSize;
}

function HandView({ side, cards, total, note, size, highlightThird }: { side: 'player' | 'banker'; cards: readonly Card[]; total: number; note?: ReactNode; size: CardSize; highlightThird?: boolean }): JSX.Element {
  const label = side === 'player' ? 'Player' : 'Banker';
  return (
    <div className={cx(styles.hand, styles[side])} data-hand={side}>
      <div className={styles.handTitle}>{label}</div>
      <div className={styles.cards} role="group" aria-label={`${label} cards`}>
        {cards.map((c, i) => (
          <PlayingCard key={c.id} card={c} size={size} rotated={i === 2} highlight={i === 2 && highlightThird} />
        ))}
      </div>
      <div className={styles.totalRow}>
        <span className={styles.total} aria-label={`${label} total ${total}`} data-testid={`${side}-total`}>
          {total}
        </span>
        {note}
      </div>
    </div>
  );
}

export function Hands({ playerCards, bankerCards, playerTotal, bankerTotal, playerNote, bankerNote, highlightPlayerThird, size }: HandsProps): JSX.Element {
  const phone = useIsPhone();
  const cardSize: CardSize = size ?? (phone ? 'sm' : 'md');
  return (
    <div className={styles.hands}>
      <HandView side="player" cards={playerCards} total={playerTotal} note={playerNote} size={cardSize} highlightThird={highlightPlayerThird} />
      <HandView side="banker" cards={bankerCards} total={bankerTotal} note={bankerNote} size={cardSize} />
    </div>
  );
}

/* ---- answer form ------------------------------------------------------------- */

export interface AnswerFormProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  invalid?: boolean;
  hint?: ReactNode;
  inputRef?: RefObject<HTMLInputElement>;
  submitLabel?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
  /** Quick-answer buttons rendered under the field. */
  children?: ReactNode;
}

export function AnswerForm({ id, label, value, onChange, onSubmit, placeholder, invalid, hint, inputRef, submitLabel = 'Check', inputMode = 'text', children }: AnswerFormProps): JSX.Element {
  const hintId = `${id}-hint`;
  const submit = (e: FormEvent): void => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <form className={styles.answerForm} onSubmit={submit} noValidate>
      <div className={styles.answerField}>
        <label className={styles.answerLabel} htmlFor={id}>
          {label}
        </label>
        <div className={styles.answerInputWrap}>
          <input
            ref={inputRef}
            id={id}
            className={styles.answerInput}
            type="text"
            inputMode={inputMode}
            autoComplete="off"
            spellCheck={false}
            value={value}
            placeholder={placeholder}
            aria-invalid={invalid ? 'true' : undefined}
            aria-describedby={hint ? hintId : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          <Button type="submit" variant="primary" kbd="Enter">
            {submitLabel}
          </Button>
        </div>
        {hint && (
          <p id={hintId} className={styles.answerHint}>
            {hint}
          </p>
        )}
        {children && <div className={styles.quick}>{children}</div>}
      </div>
    </form>
  );
}

/** "Correct. Banker draws." for the live region. */
export function verdictStatus(correct: boolean, headline: string): string {
  return `${correct ? 'Correct' : 'Not quite'}. ${headline}.`;
}
