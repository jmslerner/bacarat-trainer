/**
 * Third-card drill: a legal two-card situation is dealt (no natural; the Player's third card drawn or not) and
 * the question is "Does Banker draw?" — or, sometimes, "Does Player draw?". The answer reveals the rule row.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cardValue, createRng } from '@/engine';
import { Button, cx, useSound } from '@/ui/shell';
import styles from './drills.module.css';
import { recordDrillAnswer } from './scores';
import { useQuestionSeries } from './seeds';
import { DrillFrame, Feedback, Hands, verdictStatus } from './shared';
import { BANKER_TABLE, PLAYER_RULE, explainThirdCard, generateThirdCardQuestion, listValues, type ThirdCardQuestion } from './thirdCard';
import type { DrillProps } from './types';
import { useDrillKeys } from './useDrillKeys';

interface Answered {
  question: ThirdCardQuestion;
  choice: boolean;
  correct: boolean;
}

function BankerRuleTable({ row, p3, playerStood }: { row: number | null; p3: number | null; playerStood: boolean }): JSX.Element {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.ruleTable} data-testid="banker-table">
        <caption className={styles.srOnly}>Banker third-card table</caption>
        <thead>
          <tr>
            <th scope="col">Banker has</th>
            <th scope="col">Player stood</th>
            <th scope="col">Draws when Player’s third card is</th>
            <th scope="col">Stands when it is</th>
          </tr>
        </thead>
        <tbody>
          {BANKER_TABLE.map((r) => {
            const active = row === r.total;
            return (
              <tr key={r.total} className={cx(active && styles.rowActive, row !== null && !active && styles.rowDim)} aria-current={active ? 'true' : undefined} data-row={r.total}>
                <td className={styles.bankerNum}>{r.total}</td>
                <td>
                  <span className={cx(styles.value, r.total <= 5 ? styles.valueDraw : styles.valueStand, active && playerStood && styles.valueHit)}>{r.total <= 5 ? 'draws' : 'stands'}</span>
                </td>
                <td>
                  {r.draws.length === 10 ? (
                    <span className={cx(styles.value, styles.valueDraw, active && p3 !== null && styles.valueHit)}>always</span>
                  ) : r.draws.length === 0 ? (
                    '—'
                  ) : (
                    r.draws.map((v) => (
                      <span key={v} className={cx(styles.value, styles.valueDraw, active && p3 === v && styles.valueHit)}>
                        {v}
                      </span>
                    ))
                  )}
                </td>
                <td>
                  {r.stands.length === 10 ? (
                    <span className={cx(styles.value, styles.valueStand, active && p3 !== null && styles.valueHit)}>always</span>
                  ) : r.stands.length === 0 ? (
                    '—'
                  ) : (
                    r.stands.map((v) => (
                      <span key={v} className={cx(styles.value, styles.valueStand, active && p3 === v && styles.valueHit)}>
                        {v}
                      </span>
                    ))
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerRuleTable({ total }: { total: number }): JSX.Element {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.ruleTable} data-testid="player-table">
        <caption className={styles.srOnly}>Player third-card rule</caption>
        <thead>
          <tr>
            <th scope="col">Player has</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr className={cx(total <= 5 && styles.rowActive)}>
            <td>{listValues(PLAYER_RULE.draws)}</td>
            <td>
              <span className={cx(styles.value, styles.valueDraw, total <= 5 && styles.valueHit)}>draws</span>
            </td>
          </tr>
          <tr className={cx(total >= 6 && styles.rowActive)}>
            <td>{listValues(PLAYER_RULE.stands)}</td>
            <td>
              <span className={cx(styles.value, styles.valueStand, total >= 6 && styles.valueHit)}>stands</span>
            </td>
          </tr>
          <tr>
            <td>8 or 9</td>
            <td>natural — both sides stand</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ThirdCardDrill({ seed, onBack, className }: DrillProps): JSX.Element {
  const series = useQuestionSeries(seed);
  const question = useMemo(() => generateThirdCardQuestion(createRng(series.currentSeed)), [series.currentSeed]);
  const explanation = useMemo(() => explainThirdCard(question), [question]);
  const [state, setState] = useState<Answered | null>(null);
  const answered = state !== null && state.question === question ? state : null;
  const { play } = useSound();
  const yesRef = useRef<HTMLButtonElement>(null);

  const answer = useCallback(
    (choice: boolean) => {
      if (answered) return;
      const correct = choice === question.answer;
      recordDrillAnswer('third-card', correct);
      play(correct ? 'win' : 'lose');
      setState({ question, choice, correct });
    },
    [answered, question, play],
  );
  const next = useCallback(() => series.next(), [series]);

  useDrillKeys((key) => {
    if (!answered) {
      if (key === 'y' || key === 'Y' || key === '1') {
        answer(true);
        return true;
      }
      if (key === 'n' || key === 'N' || key === '2') {
        answer(false);
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
    yesRef.current?.focus({ preventScroll: true });
  }, [question]);

  const subject = question.ask === 'banker' ? 'Banker' : 'Player';
  const p3 = question.playerThird ? cardValue(question.playerThird.rank) : null;
  const playerShown = question.playerCards.reduce((t, c) => (t + cardValue(c.rank)) % 10, 0);
  const prompt =
    question.ask === 'player'
      ? `Player shows ${question.playerTotal}. Player acts first — Banker's hand does not matter yet.`
      : question.playerThird
        ? `Player drew a third card (value ${p3}). Banker shows ${question.bankerTotal}.`
        : `Player stood on ${question.playerTotal}. Banker shows ${question.bankerTotal}.`;

  const yesState = answered ? (question.answer ? styles.optionRight : answered.choice ? styles.optionWrong : styles.optionDim) : undefined;
  const noState = answered ? (!question.answer ? styles.optionRight : answered.choice ? styles.optionDim : styles.optionWrong) : undefined;

  return (
    <DrillFrame id="third-card" onBack={onBack} className={className} status={answered ? verdictStatus(answered.correct, explanation.headline) : ''}>
      <div className={styles.table}>
        <div className={styles.felt}>
          <div className={styles.dealerBar}>
            <span>Situation {series.index + 1}</span>
            {question.ask === 'banker' && question.playerThird === null && <span className={styles.badge}>Player stands</span>}
            {question.playerThird !== null && <span className={styles.badge}>Player drew</span>}
            <span className={styles.badge}>No naturals</span>
          </div>
          <Hands
            playerCards={question.playerCards}
            bankerCards={question.bankerCards}
            playerTotal={playerShown}
            bankerTotal={question.bankerTotal}
            highlightPlayerThird={answered !== null && question.playerThird !== null}
            playerNote={
              question.ask === 'banker' ? (
                question.playerThird ? (
                  <span className={cx(styles.note, styles.noteDraw)}>drew {p3}</span>
                ) : (
                  <span className={styles.note}>stands</span>
                )
              ) : undefined
            }
            bankerNote={question.ask === 'banker' ? <span className={styles.note}>to act</span> : undefined}
          />
          <p className={styles.question} data-testid="drill-question">
            Does {subject} draw a third card?
          </p>
          <p className={styles.questionSub}>{prompt}</p>
          <div className={styles.options}>
            <Button ref={yesRef} size="lg" variant="secondary" kbd="Y" className={cx(styles.optionButton, yesState)} onClick={() => answer(true)} disabled={answered !== null} data-testid="answer-yes">
              Yes — {subject} draws
            </Button>
            <Button size="lg" variant="secondary" kbd="N" className={cx(styles.optionButton, noState)} onClick={() => answer(false)} disabled={answered !== null} data-testid="answer-no">
              No — {subject} stands
            </Button>
          </div>
          {!answered && (
            <p className={styles.hint}>
              Keys: <kbd>Y</kbd> draws · <kbd>N</kbd> stands
            </p>
          )}
        </div>
      </div>

      {answered && (
        <Feedback correct={answered.correct} headline={explanation.headline} onNext={next}>
          <p className={styles.reason}>{explanation.reason}</p>
          {question.ask === 'banker' ? (
            <BankerRuleTable row={explanation.row} p3={explanation.p3} playerStood={question.playerThird === null} />
          ) : (
            <PlayerRuleTable total={question.playerTotal} />
          )}
          <p className={styles.tip}>
            <strong>Remember:</strong> {explanation.tip}
          </p>
        </Feedback>
      )}
    </DrillFrame>
  );
}
