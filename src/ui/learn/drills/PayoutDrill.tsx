/**
 * Payout drill: chips on the layout spots, a hand dealt by the engine, and the question "what is your net
 * result?" under the active table rules — pushes on a tie, the EZ Dragon 7 push, commission, Super 6 half pay,
 * pairs, 8:1 / 40:1 / 25:1 payouts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BET_LABELS, createRng, isBetEnabled } from '@/engine';
import type { BetType, Bets, TableRules } from '@/engine';
import { Button, ChipStack, cx, formatMoney, ruleSummary, useIsPhone, useSettings, useSound } from '@/ui/shell';
import { betPaysLabel } from './bestBet';
import styles from './drills.module.css';
import {
  LAYOUT_ORDER,
  describeOutcome,
  explainSettlement,
  generatePayoutQuestion,
  isNetCorrect,
  outcomeBadges,
  parseNetAnswer,
  settlementsInLayoutOrder,
  signedMoney,
  type PayoutQuestion,
} from './payout';
import { recordDrillAnswer } from './scores';
import { useQuestionSeries } from './seeds';
import { AnswerForm, DrillFrame, Feedback, Hands, verdictStatus } from './shared';
import type { DrillProps } from './types';
import { useDrillKeys } from './useDrillKeys';

interface Answered {
  question: PayoutQuestion;
  entered: number;
  correct: boolean;
}

/** Colour class for a bet name (casino conventions: Player blue, Banker red, Tie green, side bets gold). */
export function betClass(bet: BetType): string {
  if (bet === 'player' || bet === 'playerPair') return styles.betPlayer;
  if (bet === 'banker' || bet === 'bankerPair') return styles.betBanker;
  if (bet === 'tie') return styles.betTie;
  return styles.betSide;
}

/** Short payout caption for a layout spot. */
export function spotPays(bet: BetType, rules: TableRules): string {
  if (bet !== 'banker') return betPaysLabel(bet, rules);
  if (rules.bankerRule === 'commission') return `1:1 − ${Math.round(rules.commissionRate * 100)}%`;
  if (rules.bankerRule === 'super6') return '1:1 · 6 pays ½';
  return '1:1 · no commission';
}

const SPOT_CLASS: Readonly<Record<BetType, string>> = {
  player: 'spotPlayer',
  banker: 'spotBanker',
  tie: 'spotTie',
  dragon7: 'spotDragon7',
  panda8: 'spotPanda8',
  playerPair: 'spotPlayerPair',
  bankerPair: 'spotBankerPair',
};

function Spots({ bets, rules }: { bets: Bets; rules: TableRules }): JSX.Element {
  const phone = useIsPhone();
  return (
    <div className={styles.spots} role="list" aria-label="Bets on the layout">
      {LAYOUT_ORDER.filter((bet) => isBetEnabled(bet, rules)).map((bet) => {
        const amount = bets[bet];
        const placed = amount !== undefined && amount > 0;
        return (
          <div key={bet} role="listitem" className={cx(styles.spot, styles[SPOT_CLASS[bet]], placed && styles.spotActive)} data-spot={bet} data-amount={placed ? amount : 0}>
            <span className={styles.spotLabel}>{BET_LABELS[bet]}</span>
            <span className={styles.spotPays}>{spotPays(bet, rules)}</span>
            <div className={styles.spotChips}>
              {placed ? (
                <ChipStack amount={amount} denominations={rules.chipDenominations} size={phone ? 'xs' : 'sm'} label={`${formatMoney(amount)} on ${BET_LABELS[bet]}`} />
              ) : (
                <span className={styles.spotEmpty}>no bet</span>
              )}
            </div>
            {placed && <span className={styles.spotAmount}>{formatMoney(amount)}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function PayoutDrill({ seed, onBack, className }: DrillProps): JSX.Element {
  const { rules } = useSettings();
  const series = useQuestionSeries(seed);
  const question = useMemo(() => generatePayoutQuestion(createRng(series.currentSeed), rules), [series.currentSeed, rules]);
  const [text, setText] = useState('');
  const [state, setState] = useState<Answered | null>(null);
  const answered = state !== null && state.question === question ? state : null;
  const inputRef = useRef<HTMLInputElement>(null);
  const { play } = useSound();

  const parsed = parseNetAnswer(text);
  const invalid = text.trim() !== '' && parsed === null;
  const net = question.settlement.net;

  const submit = useCallback(() => {
    if (answered) return;
    const n = parseNetAnswer(text);
    if (n === null) {
      inputRef.current?.focus();
      return;
    }
    const correct = isNetCorrect(n, net);
    recordDrillAnswer('payout', correct);
    play(correct ? 'win' : 'lose');
    setState({ question, entered: n, correct });
  }, [answered, text, net, question, play]);

  const next = useCallback(() => {
    setText('');
    series.next();
  }, [series]);

  useDrillKeys((key) => {
    if (answered) {
      if (key === 'Enter' || key === ' ' || key === 'ArrowRight') {
        next();
        return true;
      }
      return false;
    }
    if (/^[0-9.+-]$/.test(key)) {
      inputRef.current?.focus();
      return false;
    }
    return false;
  });

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [question]);

  const { result, settlement } = question;
  const badges = outcomeBadges(result);
  const rows = settlementsInLayoutOrder(settlement);
  const headline = `Net result: ${signedMoney(net)}`;

  return (
    <DrillFrame id="payout" onBack={onBack} className={className} status={answered ? verdictStatus(answered.correct, headline) : ''}>
      <div className={styles.table}>
        <div className={styles.felt}>
          <div className={styles.dealerBar} data-testid="dealer-call">
            <span>{describeOutcome(result)}</span>
            {badges.map((b) => (
              <span key={b} className={styles.badge}>
                {b}
              </span>
            ))}
          </div>
          <Hands playerCards={result.playerCards} bankerCards={result.bankerCards} playerTotal={result.playerTotal} bankerTotal={result.bankerTotal} />
          <Spots bets={question.bets} rules={rules} />
          <p className={styles.question} data-testid="drill-question">
            What is your net result for this hand?
          </p>
          <p className={styles.questionSub}>
            {ruleSummary(rules)} · {formatMoney(settlement.totalWagered)} on the layout
          </p>
          {!answered && (
            <AnswerForm
              id="payout-answer"
              label="Your net result in dollars"
              value={text}
              onChange={setText}
              onSubmit={submit}
              placeholder="e.g. -25"
              invalid={invalid}
              inputMode="decimal"
              inputRef={inputRef}
              hint={
                <>
                  Winnings are positive, losses negative, a push is 0. <kbd>Enter</kbd> to check.
                </>
              }
            >
              <Button size="sm" variant="ghost" onClick={() => setText('0')}>
                Push ($0)
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setText((t) => (t.startsWith('-') ? t.slice(1) : `-${t.replace(/^[+]/, '')}`))} aria-label="Flip the sign">
                ± sign
              </Button>
            </AnswerForm>
          )}
        </div>
      </div>

      {answered && (
        <Feedback correct={answered.correct} headline={headline} onNext={next} nextLabel="Next hand">
          {!answered.correct && (
            <p className={styles.reason}>
              You answered {signedMoney(answered.entered)}; the hand settles for {signedMoney(net)}.
            </p>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.ruleTable} data-testid="settlement-table">
              <caption className={styles.srOnly}>Settlement of each bet</caption>
              <thead>
                <tr>
                  <th scope="col">Bet</th>
                  <th scope="col" className={styles.num}>
                    Wager
                  </th>
                  <th scope="col">Result</th>
                  <th scope="col" className={styles.num}>
                    Net
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.bet} data-bet={s.bet} data-result={s.result}>
                    <td className={betClass(s.bet)}>{BET_LABELS[s.bet]}</td>
                    <td className={styles.num}>{formatMoney(s.amount)}</td>
                    <td>
                      {s.result === 'win' ? 'wins' : s.result === 'push' ? 'push' : 'loses'}
                      {s.commission > 0 ? ` (commission ${formatMoney(s.commission)})` : ''}
                    </td>
                    <td className={cx(styles.num, s.net > 0 ? styles.pos : s.net < 0 ? styles.neg : styles.zero)}>{signedMoney(s.net)}</td>
                  </tr>
                ))}
                <tr className={styles.totalRowCell}>
                  <td>Total</td>
                  <td className={styles.num}>{formatMoney(settlement.totalWagered)}</td>
                  <td>{settlement.commission > 0 ? `commission ${formatMoney(settlement.commission)}` : ''}</td>
                  <td className={cx(styles.num, net > 0 ? styles.pos : net < 0 ? styles.neg : styles.zero)} data-testid="settlement-net">
                    {signedMoney(net)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className={styles.lines} data-testid="settlement-why">
            {rows.map((s) => (
              <li key={s.bet}>{explainSettlement(s, result, rules)}</li>
            ))}
          </ul>
        </Feedback>
      )}
    </DrillFrame>
  );
}
