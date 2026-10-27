/**
 * Counting drill: cards flash one at a time at a chosen pace; keep the running count of the chosen system
 * (Dragon 7 or Panda 8) and enter it when the deal stops. The feedback shows every card's tag, the running
 * count after each card and the resulting true count against the system's betting threshold.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cardLabel, createRng } from '@/engine';
import { Button, PlayingCard, Select, Toggle, cx, useIsPhone, useSound } from '@/ui/shell';
import {
  COUNT_LENGTHS,
  COUNT_PACES,
  DRILL_COUNT_SYSTEMS,
  cardTagOf,
  countSystemById,
  cumulativeCounts,
  formatCount,
  generateCountingCards,
  paceMs,
  parseCountAnswer,
  runningCountOf,
  tagGroups,
  trueCountEstimate,
  valueLabel,
  type CountPaceId,
} from './counting';
import styles from './drills.module.css';
import { recordDrillAnswer } from './scores';
import { useQuestionSeries } from './seeds';
import { AnswerForm, DrillFrame, Feedback, verdictStatus } from './shared';
import type { DrillProps } from './types';
import { useDrillKeys } from './useDrillKeys';

type Phase = 'setup' | 'running' | 'answer' | 'done';

export interface CountingDrillProps extends DrillProps {
  /** Initial count system (default Dragon 7). */
  system?: 'dragon7' | 'panda8';
  /** Initial pace (default 'normal'). */
  pace?: CountPaceId;
  /** Initial number of cards (default 16). */
  cards?: number;
}

function tagClass(tag: number): string {
  return tag > 0 ? styles.tagPos : tag < 0 ? styles.tagNeg : styles.tagZero;
}

export function CountingDrill({ seed, onBack, className, system: initialSystem = 'dragon7', pace: initialPace = 'normal', cards: initialCards = 16 }: CountingDrillProps): JSX.Element {
  const [systemId, setSystemId] = useState<'dragon7' | 'panda8'>(initialSystem);
  const [paceId, setPaceId] = useState<CountPaceId>(initialPace);
  const [length, setLength] = useState<number>(COUNT_LENGTHS.includes(initialCards) ? initialCards : 16);
  const [assist, setAssist] = useState(false);
  const [phase, setPhase] = useState<Phase>('setup');
  const [shown, setShown] = useState(0);
  const [text, setText] = useState('');
  const [entered, setEntered] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const phone = useIsPhone();
  const { play } = useSound();

  const series = useQuestionSeries(seed);
  const system = countSystemById(systemId);
  const cards = useMemo(() => generateCountingCards(createRng(series.currentSeed), length), [series.currentSeed, length]);
  const expected = useMemo(() => runningCountOf(cards, system), [cards, system]);
  const running = useMemo(() => cumulativeCounts(cards, system), [cards, system]);

  // Flash the cards: one timer per card, cleared on stop/unmount.
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setTimeout(() => {
      if (shown + 1 < cards.length) setShown(shown + 1);
      else setPhase('answer');
    }, paceMs(paceId));
    return () => window.clearTimeout(timer);
  }, [phase, shown, cards.length, paceId]);

  useEffect(() => {
    if (phase === 'running') play('flip');
  }, [phase, shown, play]);

  useEffect(() => {
    if (phase === 'answer') inputRef.current?.focus({ preventScroll: true });
    if (phase === 'setup') startRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const start = useCallback(() => {
    setText('');
    setEntered(null);
    setShown(0);
    setPhase('running');
  }, []);
  const stop = useCallback(() => {
    setPhase('setup');
    setShown(0);
  }, []);
  const submit = useCallback(() => {
    if (phase !== 'answer') return;
    const n = parseCountAnswer(text);
    if (n === null) {
      inputRef.current?.focus();
      return;
    }
    const ok = n === expected;
    recordDrillAnswer('counting', ok);
    play(ok ? 'win' : 'lose');
    setEntered(n);
    setCorrect(ok);
    setPhase('done');
  }, [phase, text, expected, play]);
  const next = useCallback(() => {
    series.next();
    setText('');
    setEntered(null);
    setShown(0);
    setPhase('running');
  }, [series]);

  useDrillKeys((key) => {
    if (phase === 'setup' && (key === 'Enter' || key === ' ')) {
      start();
      return true;
    }
    if (phase === 'running' && key === 'Escape') {
      stop();
      return true;
    }
    if (phase === 'answer' && /^[0-9+-]$/.test(key)) {
      inputRef.current?.focus();
      return false;
    }
    if (phase === 'done' && (key === 'Enter' || key === ' ' || key === 'ArrowRight')) {
      next();
      return true;
    }
    return false;
  });

  const trueCount = trueCountEstimate(expected, cards.length);
  const headline = `Running count: ${formatCount(expected)}`;
  const favourable = trueCount >= system.threshold;
  const current = cards[Math.min(shown, cards.length - 1)];

  return (
    <DrillFrame id="counting" onBack={onBack} className={className} status={phase === 'done' ? verdictStatus(correct, headline) : ''}>
      <div className={styles.table}>
        <div className={styles.felt}>
          <div className={styles.dealerBar}>
            <span>{system.name}</span>
            <span className={styles.badge}>{COUNT_PACES.find((p) => p.id === paceId)?.label ?? 'Normal'}</span>
            <span className={styles.badge}>{length} cards</span>
          </div>

          {phase === 'setup' && (
            <>
              <div className={styles.controls}>
                <Select<'dragon7' | 'panda8'>
                  label="Count system"
                  value={systemId}
                  onChange={setSystemId}
                  options={DRILL_COUNT_SYSTEMS.map((s) => ({ value: s.id, label: s.name }))}
                  size="sm"
                />
                <Select<CountPaceId>
                  label="Pace"
                  value={paceId}
                  onChange={setPaceId}
                  options={COUNT_PACES.map((p) => ({ value: p.id, label: `${p.label} (${(p.ms / 1000).toFixed(1).replace(/\.0$/, '')} s)` }))}
                  hint={COUNT_PACES.find((p) => p.id === paceId)?.hint}
                  size="sm"
                />
                <Select<string>
                  label="Cards"
                  value={String(length)}
                  onChange={(v) => setLength(Number(v))}
                  options={COUNT_LENGTHS.map((n) => ({ value: String(n), label: `${n} cards` }))}
                  size="sm"
                />
                <Toggle checked={assist} onChange={setAssist} label="Show the count while cards flash" description="Training wheels — turn off when you can keep up" size="sm" />
              </div>
              <div className={styles.tagLegend} aria-label={`${system.name} tags`}>
                {tagGroups(system).map((g) => (
                  <span key={g.tag} className={styles.tagChip}>
                    <span className={cx(styles.tagValue, tagClass(g.tag))}>{formatCount(g.tag)}</span>
                    {g.values.map(valueLabel).join(', ')}
                  </span>
                ))}
              </div>
              <p className={styles.summary}>{system.description}</p>
              <div className={styles.options}>
                <Button ref={startRef} variant="primary" size="lg" kbd="Enter" onClick={start} data-testid="count-start">
                  Start dealing
                </Button>
              </div>
            </>
          )}

          {phase === 'running' && current && (
            <div className={styles.stage} aria-live="off">
              <div className={styles.flash} key={current.id}>
                <div className={styles.flashCard}>
                  <PlayingCard card={current} size={phone ? 'lg' : 'xl'} />
                </div>
                {assist && (
                  <span className={styles.assist} data-testid="count-assist">
                    {formatCount(running[shown])}
                  </span>
                )}
              </div>
              <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={shown + 1} aria-label="Cards dealt">
                <div className={styles.progressBar} style={{ width: `${((shown + 1) / cards.length) * 100}%` }} />
              </div>
              <span className={styles.counter} data-testid="count-progress">
                Card {shown + 1} of {cards.length}
              </span>
              <Button variant="ghost" size="sm" onClick={stop} kbd="Esc">
                Stop
              </Button>
            </div>
          )}

          {phase === 'answer' && (
            <div className={styles.stage}>
              <p className={styles.question} data-testid="drill-question">
                What is the running count?
              </p>
              <p className={styles.questionSub}>
                {cards.length} cards were dealt with the {system.name.toLowerCase()}.
              </p>
              <AnswerForm id="count-answer" label="Running count" value={text} onChange={setText} onSubmit={submit} placeholder="e.g. +3" inputMode="text" inputRef={inputRef} invalid={text.trim() !== '' && parseCountAnswer(text) === null} hint="A whole number: positive, negative or 0">
                <Button size="sm" variant="ghost" onClick={() => setText((t) => String((parseCountAnswer(t) ?? 0) - 1))} aria-label="Decrease by one">
                  −1
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setText('0')}>
                  0
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setText((t) => String((parseCountAnswer(t) ?? 0) + 1))} aria-label="Increase by one">
                  +1
                </Button>
              </AnswerForm>
            </div>
          )}

          {phase === 'done' && (
            <div className={styles.strip} data-testid="count-strip" aria-label="Cards dealt with their tags">
              {cards.map((c, i) => (
                <span key={c.id} className={styles.stripItem}>
                  <PlayingCard card={c} size="xs" />
                  <span className={cx(styles.stripTag, tagClass(cardTagOf(c, system)))}>{formatCount(cardTagOf(c, system))}</span>
                  <span className={styles.stripRun}>{formatCount(running[i])}</span>
                  <span className={styles.srOnly}>{cardLabel(c)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {phase === 'done' && (
        <Feedback
          correct={correct}
          headline={headline}
          onNext={next}
          nextLabel="Deal again"
          actions={
            <Button variant="ghost" onClick={stop}>
              Change settings
            </Button>
          }
        >
          {!correct && entered !== null && (
            <p className={styles.reason}>
              You entered {formatCount(entered)}; the cards add up to {formatCount(expected)} (you were off by {Math.abs(entered - expected)}).
            </p>
          )}
          <p className={styles.reason}>
            Each card’s tag is shown under it with the running count after that card. {cards.length} cards gone from an 8-deck shoe leaves about {((8 * 52 - cards.length) / 52).toFixed(1)} decks, so the true count is {formatCount(expected)} ÷{' '}
            {Math.max((8 * 52 - cards.length) / 52, 0.5).toFixed(1)} ≈ <strong>{trueCount >= 0 ? '+' : '−'}{Math.abs(trueCount).toFixed(1)}</strong>.
          </p>
          <p className={styles.tip}>
            <strong>{favourable ? 'Bet it:' : 'No bet:'}</strong> the {system.id === 'dragon7' ? 'Dragon 7' : 'Panda 8'} is worth betting at a true count of {formatCount(system.threshold)} or more
            {favourable ? ' — this count is there.' : ' — this count is not there yet; keep counting.'}
          </p>
        </Feedback>
      )}
    </DrillFrame>
  );
}
