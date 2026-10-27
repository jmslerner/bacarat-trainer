/**
 * Best-bet drill: three or four bets offered by the active table — which has the lowest (sometimes: highest)
 * house edge? The engine's `houseEdge` for the active rules is the oracle; the feedback ranks every option.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRng } from '@/engine';
import type { BetType } from '@/engine';
import { cx, ruleSummary, useSettings, useSound } from '@/ui/shell';
import { explainBestBet, formatEdge, generateBestBetQuestion, lossPer100, type BestBetQuestion } from './bestBet';
import { betClass } from './PayoutDrill';
import styles from './drills.module.css';
import { recordDrillAnswer } from './scores';
import { useQuestionSeries } from './seeds';
import { DrillFrame, Feedback, verdictStatus } from './shared';
import type { DrillProps } from './types';
import { useDrillKeys } from './useDrillKeys';

interface Answered {
  question: BestBetQuestion;
  choice: BetType;
  correct: boolean;
}

export function BestBetDrill({ seed, onBack, className }: DrillProps): JSX.Element {
  const { rules } = useSettings();
  const series = useQuestionSeries(seed);
  const question = useMemo(() => generateBestBetQuestion(createRng(series.currentSeed), rules), [series.currentSeed, rules]);
  const explanation = useMemo(() => explainBestBet(question, rules), [question, rules]);
  const [state, setState] = useState<Answered | null>(null);
  const answered = state !== null && state.question === question ? state : null;
  const firstRef = useRef<HTMLButtonElement>(null);
  const { play } = useSound();

  const answer = useCallback(
    (choice: BetType) => {
      if (answered) return;
      const correct = choice === question.answer;
      recordDrillAnswer('best-bet', correct);
      play(correct ? 'win' : 'lose');
      setState({ question, choice, correct });
    },
    [answered, question, play],
  );
  const next = useCallback(() => series.next(), [series]);

  useDrillKeys((key) => {
    if (!answered) {
      const n = Number(key);
      if (Number.isInteger(n) && n >= 1 && n <= question.options.length) {
        answer(question.options[n - 1].bet);
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
    firstRef.current?.focus({ preventScroll: true });
  }, [question]);

  const answerOption = question.options.find((o) => o.bet === question.answer);
  const headline = answerOption ? `${answerOption.label}: ${formatEdge(answerOption.edge)} house edge` : '';

  return (
    <DrillFrame id="best-bet" onBack={onBack} className={className} status={answered ? verdictStatus(answered.correct, headline) : ''}>
      <div className={styles.table}>
        <div className={styles.felt}>
          <div className={styles.dealerBar}>
            <span>Question {series.index + 1}</span>
            <span className={styles.badge}>{rules.bankerRule === 'ez' ? 'EZ Baccarat' : rules.bankerRule === 'commission' ? 'Classic 5%' : 'Super 6'}</span>
          </div>
          <p className={styles.question} data-testid="drill-question">
            Which of these bets has the {question.mode === 'lowest' ? 'LOWEST' : 'HIGHEST'} house edge?
          </p>
          <p className={styles.questionSub}>{ruleSummary(rules)}</p>
          <div className={styles.optionsGrid} role="group" aria-label="Bets">
            {question.options.map((o, i) => {
              const stateClass = answered ? (o.bet === question.answer ? styles.optionRight : o.bet === answered.choice ? styles.optionWrong : styles.optionDim) : undefined;
              return (
                <button
                  key={o.bet}
                  ref={i === 0 ? firstRef : undefined}
                  type="button"
                  className={cx(styles.optionCard, stateClass)}
                  onClick={() => answer(o.bet)}
                  disabled={answered !== null}
                  data-testid={`option-${o.bet}`}
                >
                  <span className={styles.optionTitle}>
                    <span className={styles.optionKey} aria-hidden="true">
                      {i + 1}
                    </span>
                    {o.label}
                  </span>
                  <span className={styles.optionDesc}>pays {o.pays}</span>
                </button>
              );
            })}
          </div>
          {!answered && (
            <p className={styles.hint}>
              Keys: <kbd>1</kbd>–<kbd>{question.options.length}</kbd> to pick a bet
            </p>
          )}
        </div>
      </div>

      {answered && (
        <Feedback correct={answered.correct} headline={headline} onNext={next}>
          <div className={styles.tableWrap}>
            <table className={styles.ruleTable} data-testid="edge-table">
              <caption className={styles.srOnly}>House edge of each listed bet</caption>
              <thead>
                <tr>
                  <th scope="col">Bet</th>
                  <th scope="col">Pays</th>
                  <th scope="col" className={styles.num}>
                    House edge
                  </th>
                  <th scope="col" className={styles.num}>
                    Expected loss per $100
                  </th>
                </tr>
              </thead>
              <tbody>
                {explanation.ranked.map((o) => (
                  <tr key={o.bet} className={cx(o.bet === question.answer && styles.rowAnswer)} data-bet={o.bet}>
                    <td className={betClass(o.bet)}>{o.label}</td>
                    <td>{o.pays}</td>
                    <td className={styles.num}>{formatEdge(o.edge)}</td>
                    <td className={styles.num}>{lossPer100(o.edge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={styles.lines}>
            {explanation.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Feedback>
      )}
    </DrillFrame>
  );
}
