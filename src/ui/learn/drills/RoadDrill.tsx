/**
 * Road drill: a big road is drawn; for a hypothetical next Player or Banker, what colour will the next
 * Big Eye Boy / Small Road / Cockroach Pig entry be? `predictNext` from @/roads is the oracle; the feedback
 * re-derives the entry and names the columns that were compared.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRng } from '@/engine';
import { BigRoadView, DERIVED_LABELS, DerivedRoadView } from '@/roads';
import type { RoadColor } from '@/roads';
import { cx, useIsPhone, useSound } from '@/ui/shell';
import styles from './drills.module.css';
import { ROAD_SYMBOL, SIDE_LABEL, explainRoadEntry, generateRoadQuestion, type RoadQuestion } from './road';
import { recordDrillAnswer } from './scores';
import { useQuestionSeries } from './seeds';
import { DrillFrame, Feedback, verdictStatus } from './shared';
import type { DrillProps } from './types';
import { useDrillKeys } from './useDrillKeys';

interface Answered {
  question: RoadQuestion;
  choice: RoadColor;
  correct: boolean;
}

const COLOR_LABEL: Readonly<Record<RoadColor, string>> = { red: 'Red', blue: 'Blue' };

export function RoadDrill({ seed, onBack, className }: DrillProps): JSX.Element {
  const series = useQuestionSeries(seed);
  const question = useMemo(() => generateRoadQuestion(createRng(series.currentSeed)), [series.currentSeed]);
  const explanation = useMemo(() => explainRoadEntry(question.results, question.kind, question.side), [question]);
  const [state, setState] = useState<Answered | null>(null);
  const answered = state !== null && state.question === question ? state : null;
  const redRef = useRef<HTMLButtonElement>(null);
  const phone = useIsPhone();
  const { play } = useSound();

  const answer = useCallback(
    (choice: RoadColor) => {
      if (answered) return;
      const correct = choice === question.answer;
      recordDrillAnswer('road', correct);
      play(correct ? 'win' : 'lose');
      setState({ question, choice, correct });
    },
    [answered, question, play],
  );
  const next = useCallback(() => series.next(), [series]);

  useDrillKeys((key) => {
    if (!answered) {
      if (key === 'r' || key === 'R' || key === '1') {
        answer('red');
        return true;
      }
      if (key === 'b' || key === 'B' || key === '2') {
        answer('blue');
        return true;
      }
      return false;
    }
    if (key === 'Enter' || key === ' ' || key === 'ArrowRight') {
      next();
      return true;
    }
    return false;
  });

  useEffect(() => {
    redRef.current?.focus({ preventScroll: true });
  }, [question]);

  const label = DERIVED_LABELS[question.kind];
  const sideLabel = SIDE_LABEL[question.side];
  const headline = `${label}: ${COLOR_LABEL[question.answer]}`;
  const hands = question.results.length;

  const optionClass = (color: RoadColor): string | undefined =>
    answered ? (color === question.answer ? styles.optionRight : color === answered.choice ? styles.optionWrong : styles.optionDim) : undefined;

  return (
    <DrillFrame id="road" onBack={onBack} className={className} status={answered ? verdictStatus(answered.correct, headline) : ''}>
      <div className={styles.table}>
        <div className={styles.felt}>
          <div className={styles.dealerBar}>
            <span>Shoe {series.index + 1}</span>
            <span className={styles.badge}>{hands} hands</span>
          </div>
          <div className={styles.roads}>
            <div className={cx(styles.roadBlock, styles.roadBig)}>
              <div className={styles.roadLabel}>
                Big road
                <span className={styles.legend}>
                  <span className={styles.legendItem}>
                    <span className={cx(styles.dot, styles.dotRed)} aria-hidden="true" /> B
                  </span>
                  <span className={styles.legendItem}>
                    <span className={cx(styles.dot, styles.dotBlue)} aria-hidden="true" /> P
                  </span>
                  <span className={styles.legendItem}>dashed = next {sideLabel}</span>
                </span>
              </div>
              <BigRoadView results={question.results} cols={phone ? 12 : 18} prediction={question.side} />
            </div>
            <div className={cx(styles.roadBlock, styles.roadDerived)}>
              <div className={styles.roadLabel}>
                {label} ({ROAD_SYMBOL[question.kind]})
              </div>
              <DerivedRoadView results={question.results} kind={question.kind} cols={phone ? 10 : 16} prediction={answered ? question.side : null} />
            </div>
          </div>
          <p className={styles.question} data-testid="drill-question">
            If the next hand is {sideLabel}, what colour is the next {label} entry?
          </p>
          <p className={styles.questionSub}>
            The dashed cell on the big road shows where a {sideLabel} would land. {label} is drawn with {ROAD_SYMBOL[question.kind]}.
          </p>
          <div className={styles.optionsGrid} role="group" aria-label="Colours">
            <button ref={redRef} type="button" className={cx(styles.optionCard, styles.colorButtonRed, optionClass('red'))} onClick={() => answer('red')} disabled={answered !== null} data-testid="answer-red">
              <span className={styles.optionTitle}>
                <span className={styles.optionKey} aria-hidden="true">
                  R
                </span>
                <span className={cx(styles.dot, styles.dotRed)} aria-hidden="true" />
                Red
              </span>
              <span className={styles.optionDesc}>the pattern repeats</span>
            </button>
            <button type="button" className={cx(styles.optionCard, styles.colorButtonBlue, optionClass('blue'))} onClick={() => answer('blue')} disabled={answered !== null} data-testid="answer-blue">
              <span className={styles.optionTitle}>
                <span className={styles.optionKey} aria-hidden="true">
                  B
                </span>
                <span className={cx(styles.dot, styles.dotBlue)} aria-hidden="true" />
                Blue
              </span>
              <span className={styles.optionDesc}>the pattern changes</span>
            </button>
          </div>
          {!answered && (
            <p className={styles.hint}>
              Keys: <kbd>R</kbd> red · <kbd>B</kbd> blue
            </p>
          )}
        </div>
      </div>

      {answered && (
        <Feedback correct={answered.correct} headline={headline} onNext={next} nextLabel="Next shoe">
          {explanation && (
            <ul className={styles.lines} data-testid="road-why">
              {explanation.text.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <p className={styles.tip}>
            <strong>The rule:</strong> a NEW column compares the two columns 1 and {1 + (question.kind === 'bigEye' ? 1 : question.kind === 'small' ? 2 : 3)} to its left — equal depth is red. Continuing a column looks{' '}
            {question.kind === 'bigEye' ? '1 column' : question.kind === 'small' ? '2 columns' : '3 columns'} to the left — a cell at the same row is red, a column that stopped exactly one row short is blue, one that stopped earlier is red. Roads describe the past; they never predict the next card.
          </p>
        </Feedback>
      )}
    </DrillFrame>
  );
}
