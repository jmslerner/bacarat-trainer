/**
 * Card-values quiz-let: two or three random cards, pick the baccarat total. Explains the arithmetic after every
 * answer. Deterministic with a `seed` (tests); random otherwise.
 */
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { RANKS, SUITS, cardValue, createRng, handTotal, type Card, type Rng } from '@/engine';
import { Button, PlayingCard, cardShortLabel, cx } from '@/ui/shell';
import { Widget } from '../components';
import styles from './Widgets.module.css';

interface Question {
  cards: Card[];
  total: number;
}

function makeQuestion(rng: Rng, serial: number): Question {
  const count = rng.next() < 0.35 ? 3 : 2;
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    cards.push({ rank: RANKS[rng.nextInt(RANKS.length)], suit: SUITS[rng.nextInt(SUITS.length)], id: serial * 3 + i });
  }
  return { cards, total: handTotal(cards) };
}

const TOTALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface CardValueQuizProps {
  seed?: number;
}

export function CardValueQuiz({ seed }: CardValueQuizProps): ReactNode {
  const rng = useMemo(() => createRng(seed), [seed]);
  const serial = useRef(0);
  const [question, setQuestion] = useState<Question>(() => makeQuestion(rng, serial.current++));
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, asked: 0, streak: 0, best: 0 });

  const correct = answer !== null && answer === question.total;
  const values = question.cards.map((c) => cardValue(c.rank));
  const sum = values.reduce((a, b) => a + b, 0);

  const choose = (n: number): void => {
    if (answer !== null) return;
    setAnswer(n);
    setScore((s) => {
      const ok = n === question.total;
      const streak = ok ? s.streak + 1 : 0;
      return { correct: s.correct + (ok ? 1 : 0), asked: s.asked + 1, streak, best: Math.max(s.best, streak) };
    });
  };
  const next = (): void => {
    setQuestion(makeQuestion(rng, serial.current++));
    setAnswer(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (/^[0-9]$/.test(e.key) && answer === null) {
      e.preventDefault();
      choose(Number(e.key));
    } else if (e.key === 'Enter' && answer !== null) {
      e.preventDefault();
      next();
    }
  };

  return (
    <Widget
      title="Card values quiz"
      hint="What is the baccarat total? Type a digit or click."
      data-widget="card-value-quiz"
      actions={
        <div className={styles.score} aria-live="polite">
          <span>
            Score <strong>{score.correct}</strong> / {score.asked}
          </span>
          <span>
            Streak <strong>{score.streak}</strong>
          </span>
          <span>
            Best <strong>{score.best}</strong>
          </span>
        </div>
      }
    >
      <div onKeyDown={onKeyDown}>
        <div className={styles.cardsCenter} role="group" aria-label="Cards">
          {question.cards.map((c, i) => (
            <PlayingCard key={c.id} card={c} size="md" rotated={i === 2} />
          ))}
        </div>
        <div className={styles.choiceGroup} style={{ marginTop: 12 }}>
          <span className={styles.choiceLabel} id="card-quiz-label">
            The total is…
          </span>
          <div className={styles.choices} role="group" aria-labelledby="card-quiz-label">
            {TOTALS.map((t) => (
              <button
                key={t}
                type="button"
                className={cx(styles.choice, answer !== null && t === question.total && styles.choiceCorrect, answer !== null && t === answer && t !== question.total && styles.choiceWrong)}
                aria-pressed={answer !== null && (t === answer || t === question.total)}
                disabled={answer !== null && t !== answer && t !== question.total}
                onClick={() => choose(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {answer !== null && (
          <div className={cx(styles.feedback, correct ? styles.feedbackGood : styles.feedbackBad)} style={{ marginTop: 12 }} role="status">
            <span className={styles.feedbackTitle}>{correct ? 'Correct.' : `Not quite — the total is ${question.total}.`}</span>
            {question.cards.map((c, i) => `${cardShortLabel(c)} = ${values[i]}`).join(', ')}. {values.join(' + ')} = {sum}
            {sum >= 10 ? ` → only the last digit counts → ${question.total}.` : '.'}
          </div>
        )}
        <div className={styles.controls} style={{ marginTop: 12 }}>
          <Button size="sm" variant="primary" onClick={next} disabled={answer === null} kbd="Enter">
            Next cards
          </Button>
        </div>
      </div>
    </Widget>
  );
}
