/**
 * PlayView — the casino table (SPEC §5.5): felt with the EZ Baccarat layout, chip tray and controls, the dealing
 * animation driven by `HandResult.steps`, settlement animation, new-shoe sequence, the roads `<Scoreboard/>`,
 * hand history, Coach and session stats. Desktop: table left, panels right. Phones: stacked, Coach in a drawer.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BetType, Bets, Side } from '@/engine';
import { BET_TYPES, limitsEqual, roundCents, totalOnLayout, validateLayout, type ChipPlacement, type GameSession } from '@/engine';
import { Scoreboard } from '@/roads';
import { Button, Modal, SettingsDialog, cx, dealSpeedMs, formatMoney, publishDisplayedBankroll, ruleSummary, useIsPhone, useIsTablet, useSession, useSettings, useSound, type DealSpeed } from '@/ui/shell';
import { autoPauseMs, dealDurationMs, revealMs, type ChipStacks } from './animation/timeline';
import type { FrameEvent } from './animation/types';
import { deriveView, useTableAnimation, type CurrentHand } from './animation/useTableAnimation';
import { historyExtremes, recordHand, syncHistory, useHistory } from './history/historyStore';
import { useShortcuts } from './keyboard/useShortcuts';
import { CoachPanel } from './panels/CoachPanel';
import { HandHistory } from './panels/HandHistory';
import { Panel } from './panels/Panel';
import { SessionStatsPanel } from './panels/SessionStatsPanel';
import { Rail, type Notice } from './rail/Rail';
import { Felt } from './table/Felt';
import styles from './PlayView.module.css';

export interface PlayViewProps {
  className?: string;
}

/**
 * Shoes whose shuffle / cut card / burn sequence has been shown, per session (keyed by seed and shoe number), so
 * leaving for Learn and coming back does not replay it while a replaced session starts afresh.
 */
const shoesSeenBySession = new WeakMap<GameSession, Set<string>>();
function shoesSeenOf(session: GameSession): Set<string> {
  let set = shoesSeenBySession.get(session);
  if (!set) {
    set = new Set();
    shoesSeenBySession.set(session, set);
  }
  return set;
}

const NOTICE_MS = 3800;

function groupStacks(chips: readonly ChipPlacement[]): ChipStacks {
  const out: Partial<Record<BetType, number[]>> = {};
  for (const chip of chips) (out[chip.bet] ??= []).push(chip.amount);
  return out;
}

/** The chip to pick up at a table: $25 when it covers the main minimum, otherwise the smallest chip that does (else the largest). */
export function defaultChip(denominations: readonly number[], minMain: number): number {
  if (denominations.includes(25) && 25 >= minMain) return 25;
  return denominations.find((d) => d >= minMain) ?? denominations[denominations.length - 1] ?? 1;
}

function tableName(bankerRule: string): string {
  return bankerRule === 'ez' ? 'EZ Baccarat' : bankerRule === 'commission' ? 'Baccarat · 5% commission' : 'Super 6 Baccarat';
}

export function PlayView({ className }: PlayViewProps = {}): ReactNode {
  const { state: live, session } = useSession();
  const { prefs, setPrefs } = useSettings();
  const sound = useSound();
  const phone = useIsPhone();
  const tablet = useIsTablet();
  const history = useHistory();

  const base = dealSpeedMs(prefs.dealSpeed);
  const baseRef = useRef(base);
  baseRef.current = base;
  const tipsRef = useRef(prefs.beginnerTips);
  tipsRef.current = prefs.beginnerTips;

  const [selectedChip, setSelectedChip] = useState(() => defaultChip(live.rules.chipDenominations, live.rules.limits.main.min));
  const selectedRef = useRef(selectedChip);
  selectedRef.current = selectedChip;
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const noticeId = useRef(0);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);
  const autoTimer = useRef<number | null>(null);
  const [ask, setAsk] = useState<Side | null>(null);
  const [buyInOpen, setBuyInOpen] = useState(false);
  const [newShoeOpen, setNewShoeOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);

  const notify = useCallback((text: string, tone: Notice['tone'] = 'error') => {
    noticeId.current += 1;
    setNotice({ id: noticeId.current, text, tone });
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const clearAutoTimer = useCallback(() => {
    if (autoTimer.current !== null) {
      window.clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
  }, []);
  const setAutoMode = useCallback(
    (on: boolean) => {
      autoRef.current = on;
      setAuto(on);
      if (!on) clearAutoTimer();
    },
    [clearAutoTimer],
  );
  const stopAuto = useCallback(
    (why?: string) => {
      if (autoRef.current && why) notify(why, 'info');
      setAutoMode(false);
    },
    [notify, setAutoMode],
  );
  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
      if (autoTimer.current !== null) window.clearTimeout(autoTimer.current);
    },
    [],
  );

  // The auto-deal loop is driven by the animation's "done" event (see onEvent), never by render timing.
  const scheduleAutoRef = useRef<(delay: number) => void>(() => undefined);
  /** Shoe whose new-shoe sequence is still playing (forgotten again if the view unmounts before it ends). */
  const pendingShuffle = useRef<string | null>(null);
  const onEvent = useCallback(
    (event: FrameEvent, current: CurrentHand | null) => {
      if (event === 'settled' && current) {
        const s = session.getState();
        // Only a hand the session still knows as its last one (a reset mid-animation has none to record).
        if (s.lastHand !== null && s.lastHand.result === current.result) recordHand(current.result, current.settlement, s.totalHands, s.seed);
        setAsk(null);
      }
      if (event === 'done') {
        pendingShuffle.current = null;
        if (autoRef.current) scheduleAutoRef.current(autoPauseMs(baseRef.current));
      }
    },
    [session],
  );
  const anim = useTableAnimation({ play: sound.play, onEvent });
  const { startHand, startShuffle, skip, dismissLayout, reset, isBusy } = anim;
  const view = useMemo(() => deriveView(anim, live), [anim, live]);

  // History: seeded from the session when the live state is shown (never while a hand is held back).
  useEffect(() => {
    if (!anim.held) syncHistory(live);
  }, [live, anim.held]);

  // The top bar's bankroll pill follows the table: the pre-deal figure while a hand plays, then the count-up
  // (the session itself already holds the settled amount). Back to the live session when the table unmounts.
  useEffect(() => {
    publishDisplayedBankroll({ bankroll: view.bankroll, net: roundCents(view.bankroll - view.stats.startingBankroll) });
  }, [view.bankroll, view.stats.startingBankroll]);
  useEffect(() => () => publishDisplayedBankroll(null), []);

  // A won Dragon 7 / Panda 8 is marked on <body> while its moment plays, so the top bar's bankroll pill (which
  // lives in the shell) pulses with the table's plaque (see PlayView.module.css).
  useEffect(() => {
    const c = anim.celebration;
    if (!c || c.won <= 0) return;
    try {
      document.body.setAttribute('data-celebrate', c.kind);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        document.body.removeAttribute('data-celebrate');
      } catch {
        /* ignore */
      }
    };
  }, [anim.celebration]);

  // A new table (the limits changed) hands you its base chip; a chip that left the tray is no longer in hand.
  const seenLimits = useRef(live.rules.limits);
  useEffect(() => {
    const moved = !limitsEqual(seenLimits.current, live.rules.limits);
    seenLimits.current = live.rules.limits;
    if (moved || !live.rules.chipDenominations.includes(selectedChip)) setSelectedChip(defaultChip(live.rules.chipDenominations, live.rules.limits.main.min));
  }, [live.rules, selectedChip]);

  // A replaced session clears the felt (keyed by identity so StrictMode's re-run of the effect is a no-op).
  const seenSession = useRef(session);
  useEffect(() => {
    if (seenSession.current === session) return;
    seenSession.current = session;
    reset();
    setAutoMode(false);
  }, [session, reset, setAutoMode]);

  // A shoe the table has not seen yet (first mount, new rules, a reset session) plays the new-shoe procedure.
  const prevRules = useRef(live.rules);
  useEffect(() => {
    const rulesChanged = prevRules.current !== live.rules;
    prevRules.current = live.rules;
    const key = `${live.seed}:${live.shoe.shoeNumber}`;
    const shoesSeen = shoesSeenOf(session);
    if (shoesSeen.has(key)) return;
    shoesSeen.add(key);
    if (rulesChanged) {
      setAutoMode(false);
      // A hand (or shuffle) still playing belongs to the old shoe: fast-forward it so its settlement is shown and
      // recorded, then shuffle the new shoe.
      if (isBusy()) skip();
    }
    if (live.shoe.handsDealt > 0 || isBusy()) return;
    reset(rulesChanged ? 'New rules — place your bets' : 'Place your bets');
    pendingShuffle.current = key;
    startShuffle(live.shoe, live.rules, baseRef.current);
    return () => {
      // Unmounted (or StrictMode's simulated unmount) before the sequence ended: play it again next time.
      if (pendingShuffle.current === key) {
        pendingShuffle.current = null;
        shoesSeen.delete(key);
      }
    };
  }, [session, live.seed, live.shoe, live.rules, reset, startShuffle, isBusy, skip, setAutoMode]);

  /* ---- actions ---------------------------------------------------------------------------- */

  const startDeal = useCallback((): boolean => {
    const check = session.canDeal();
    if (!check.ok) {
      notify(check.reason ?? 'Cannot deal');
      return false;
    }
    const prev = session.getState();
    const stacks = groupStacks(session.getChipStack());
    const { result, settlement, newShoeStarted } = session.deal();
    const after = session.getState();
    if (newShoeStarted) shoesSeenOf(session).add(`${after.seed}:${after.shoe.shoeNumber}`);
    setNotice(null);
    startHand({ prev, stacks, result, settlement, newShoe: newShoeStarted ? after.shoe : null, bankrollAfter: after.bankroll, base: baseRef.current, tips: tipsRef.current });
    return true;
  }, [session, startHand, notify]);

  const scheduleAuto = useCallback(
    (delay: number) => {
      clearAutoTimer();
      autoTimer.current = window.setTimeout(() => {
        autoTimer.current = null;
        if (!autoRef.current || isBusy()) return;
        const s = session.getState();
        if (totalOnLayout(s.bets) === 0) {
          const r = session.rebet();
          if (!r.ok) {
            setAutoMode(false);
            notify(`Auto-deal stopped: ${r.reason ?? 'the bets cannot be repeated'}`);
            return;
          }
          dismissLayout();
        }
        if (!startDeal()) setAutoMode(false);
      }, delay);
    },
    [clearAutoTimer, isBusy, session, setAutoMode, notify, dismissLayout, startDeal],
  );
  scheduleAutoRef.current = scheduleAuto;

  const onDeal = useCallback(() => {
    if (isBusy()) {
      // Fast-forward. A hand still being dealt is only skipped; once it is settled (or a shuffle is playing) and
      // chips are on the layout, the next hand follows at once — never a "place a bet" complaint for a skip.
      const handOver = anim.settled || anim.phase === 'settled' || anim.phase === 'shuffling';
      skip();
      if (!handOver || !session.canDeal().ok) return;
    }
    startDeal();
  }, [isBusy, anim.settled, anim.phase, skip, startDeal, session]);

  const placeChip = useCallback(
    (bet: BetType) => {
      if (isBusy()) {
        notify(anim.phase === 'shuffling' ? 'One moment — the shoe is being shuffled' : 'No more bets — the hand is in play', 'info');
        return;
      }
      stopAuto('Auto-deal stopped');
      dismissLayout();
      const r = session.placeBet(bet, selectedRef.current);
      if (!r.ok) {
        const { bankroll, rules } = session.getState();
        const short = r.reason?.startsWith('Not enough bankroll') && bankroll < rules.limits.main.min ? ` — your bankroll is below the ${formatMoney(rules.limits.main.min)} table minimum; Buy-in to keep playing` : '';
        notify(`${r.reason ?? 'That bet cannot be placed'}${short}`);
        return;
      }
      setNotice(null);
      sound.play('chip');
    },
    [isBusy, anim.phase, session, sound, dismissLayout, notify, stopAuto],
  );

  const removeChip = useCallback(
    (bet: BetType) => {
      if (isBusy()) return;
      stopAuto('Auto-deal stopped');
      dismissLayout();
      if ((session.getState().bets[bet] ?? 0) <= 0) return;
      session.removeChip(bet);
      sound.play('chip');
    },
    [isBusy, session, sound, dismissLayout, stopAuto],
  );

  const onUndo = useCallback(() => {
    if (isBusy()) return;
    stopAuto('Auto-deal stopped');
    dismissLayout();
    if (totalOnLayout(session.getState().bets) === 0) return;
    session.undoLastChip();
    sound.play('chip');
  }, [isBusy, session, sound, dismissLayout, stopAuto]);

  const onClear = useCallback(() => {
    if (isBusy()) return;
    stopAuto('Auto-deal stopped');
    dismissLayout();
    if (totalOnLayout(session.getState().bets) === 0) return;
    session.clearBets();
    sound.play('chip');
  }, [isBusy, session, sound, dismissLayout, stopAuto]);

  const onRebet = useCallback(() => {
    if (isBusy()) return;
    const r = session.rebet();
    if (!r.ok) {
      notify(r.reason ?? 'Cannot repeat the last bets');
      return;
    }
    dismissLayout();
    setNotice(null);
    sound.play('chip');
  }, [isBusy, session, sound, dismissLayout, notify]);

  const toggleAuto = useCallback(() => {
    if (autoRef.current) {
      stopAuto('Auto-deal stopped');
      return;
    }
    const s = session.getState();
    if (totalOnLayout(s.bets) === 0 && totalOnLayout(s.lastBets) === 0) {
      notify('Place a bet first — Auto repeats your bets and deals until you stop it or the bankroll runs short');
      return;
    }
    setAutoMode(true);
    notify('Auto-deal on — press A or Stop auto to stop', 'info');
    scheduleAuto(isBusy() ? autoPauseMs(baseRef.current) : 0);
  }, [session, notify, stopAuto, setAutoMode, scheduleAuto, isBusy]);

  const selectChipAt = useCallback(
    (index: number) => {
      const value = session.getState().rules.chipDenominations[index];
      if (value === undefined) return;
      setSelectedChip(value);
      sound.play('click');
    },
    [session, sound],
  );
  const selectChip = useCallback(
    (value: number) => {
      setSelectedChip(value);
      sound.play('click');
    },
    [sound],
  );

  const doNewShoe = useCallback(() => {
    setNewShoeOpen(false);
    if (isBusy()) return;
    stopAuto();
    session.newShoe();
    const s = session.getState();
    shoesSeenOf(session).add(`${s.seed}:${s.shoe.shoeNumber}`);
    reset();
    startShuffle(s.shoe, s.rules, baseRef.current);
  }, [isBusy, session, reset, startShuffle, stopAuto]);
  const onNewShoe = useCallback(() => {
    if (isBusy()) return;
    if (session.getState().shoeHistory.length > 0) setNewShoeOpen(true);
    else doNewShoe();
  }, [isBusy, session, doNewShoe]);

  useShortcuts({ selectChip: selectChipAt, place: placeChip, deal: onDeal, rebet: onRebet, clear: onClear, undo: onUndo, toggleAuto }, !buyInOpen && !newShoeOpen && !drawerOpen);

  /* ---- derived display ----------------------------------------------------------------------- */

  const liveStacks = useMemo(() => groupStacks(session.getChipStack()), [session, live.bets]);
  const dealCheck = useMemo(() => session.canDeal(), [session, live]);
  const betting = !anim.busy;
  // The last bets can be repeated only when this table deals them (offered, within the maximum and the minimum):
  // after a move to a table with higher minimums they are gone, not merely refused.
  const rebetProblem = useMemo(() => (totalOnLayout(live.lastBets) > 0 ? validateLayout(live.lastBets, live.rules)[0] ?? null : null), [live.lastBets, live.rules]);
  const rebetAmount = rebetProblem === null ? totalOnLayout(live.lastBets) : 0;
  const hasBets = totalOnLayout(live.bets) > 0;
  const inPlay = anim.phase === 'dealing' || anim.phase === 'settling';
  const coachBets: Bets = useMemo(() => {
    if (!inPlay || !anim.layout) return live.bets;
    const out: Bets = {};
    for (const bet of BET_TYPES) {
      const spot = anim.layout[bet];
      if (spot && spot.amount > 0) out[bet] = spot.amount;
    }
    return out;
  }, [inPlay, anim.layout, live.bets]);
  const commission = view.rules.bankerRule === 'commission' ? { thisHand: anim.current && anim.settled ? anim.current.settlement.commission : 0, session: view.stats.commissionPaid } : null;
  const extremes = useMemo(() => historyExtremes(history), [history]);
  const lastCall = anim.hand.step >= 0 ? { message: anim.hand.message, tip: anim.hand.tip } : null;

  const coach = (
    <CoachPanel rules={view.rules} bets={coachBets} seenCards={view.seenCards} shoe={view.shoe} stats={view.stats} streak={view.stats.currentStreak} beginnerTips={prefs.beginnerTips} onToggleTips={(on) => setPrefs({ beginnerTips: on })} lastCall={lastCall} />
  );

  return (
    <div className={cx(styles.view, className)} data-testid="play-view" data-phase={anim.phase}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{tableName(view.rules.bankerRule)}</h1>
          <p className={styles.subtitle}>{ruleSummary(view.rules)}</p>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.tableColumn}>
          <div className={cx(styles.table, phone && styles.tablePhone)} data-testid="table">
            <Felt
              rules={view.rules}
              hand={anim.hand}
              phase={anim.phase}
              shuffle={anim.shuffle}
              announce={anim.announce}
              shoe={view.shoe}
              dealMs={dealDurationMs(base)}
              revealMs={revealMs(base)}
              celebration={anim.celebration}
              layout={anim.layout}
              liveBets={live.bets}
              liveStacks={liveStacks}
              selectedChip={selectedChip}
              betting={betting}
              showTips={prefs.beginnerTips}
              commission={commission}
              phone={phone}
              tablet={tablet}
              onAdd={placeChip}
              onRemove={removeChip}
            />
            <Rail
              rules={view.rules}
              selectedChip={selectedChip}
              onSelectChip={selectChip}
              bankroll={view.bankroll}
              onLayout={totalOnLayout(live.bets)}
              dealReason={dealCheck.ok ? null : !hasBets && rebetAmount > 0 ? `Rebet (R) to play ${formatMoney(rebetAmount)} again, or place chips` : dealCheck.reason ?? 'Cannot deal'}
              busy={anim.busy}
              phase={anim.phase}
              auto={auto}
              onToggleAuto={toggleAuto}
              speed={prefs.dealSpeed}
              onSpeed={(s: DealSpeed) => setPrefs({ dealSpeed: s })}
              rebetAmount={rebetAmount}
              rebetProblem={rebetProblem}
              hasBets={hasBets}
              onDeal={onDeal}
              onRebet={onRebet}
              onClear={onClear}
              onUndo={onUndo}
              onNewShoe={onNewShoe}
              onBuyIn={() => setBuyInOpen(true)}
              onCoach={phone && prefs.showCoach ? () => setDrawerOpen(true) : undefined}
              notice={notice}
              phone={phone}
              celebration={anim.celebration}
            />
          </div>
          {!phone && (
            <p className={styles.shortcuts} aria-label="Keyboard shortcuts">
              <kbd>1</kbd>–<kbd>9</kbd> chips · <kbd>P</kbd> <kbd>B</kbd> <kbd>T</kbd> Player / Banker / Tie · <kbd>D</kbd> Dragon 7 · <kbd>N</kbd> Panda 8 · <kbd>Space</kbd> deal · <kbd>R</kbd> rebet · <kbd>C</kbd> clear · <kbd>U</kbd> undo · <kbd>A</kbd> auto · right-click or long-press a spot to take a chip back · <kbd>Tab</kbd> + <kbd>Enter</kbd> presses any control
            </p>
          )}
        </div>

        <aside className={styles.side} aria-label="Scoreboard, coach and history">
          <Scoreboard results={view.results} prediction={ask} onPredict={setAsk} />
          {!phone && prefs.showCoach && (
            <Panel title="Coach" open={coachOpen} onToggle={() => setCoachOpen((o) => !o)} testId="coach-panel">
              {coach}
            </Panel>
          )}
          <Panel title="Hand history" meta={history.length > 0 ? `${history.length} hands` : undefined} open={historyOpen} onToggle={() => setHistoryOpen((o) => !o)} testId="history-panel">
            <HandHistory entries={history} />
          </Panel>
          <Panel title="Session stats" meta={`${view.stats.handsPlayed} hands · ${formatMoney(view.stats.net, { signed: true })}`} open={statsOpen} onToggle={() => setStatsOpen((o) => !o)} testId="stats-panel">
            <SessionStatsPanel stats={view.stats} biggestWin={extremes.biggestWin} biggestLoss={extremes.biggestLoss} />
          </Panel>
        </aside>
      </div>

      {phone && prefs.showCoach && (
        <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Coach" size="md">
          <div className={styles.drawerBody}>{coach}</div>
        </Modal>
      )}

      <SettingsDialog open={buyInOpen} initialTab="bankroll" onClose={() => setBuyInOpen(false)} />

      <Modal
        open={newShoeOpen}
        onClose={() => setNewShoeOpen(false)}
        title="Shuffle a new shoe?"
        description={`Shoe ${live.shoe.shoeNumber} has ${live.shoeHistory.length} hands on the roads. They will be cleared.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewShoeOpen(false)}>
              Keep playing
            </Button>
            <Button variant="primary" onClick={doNewShoe} data-testid="confirm-new-shoe">
              New shoe
            </Button>
          </>
        }
      >
        <p>The cut card normally ends a shoe. Shuffling early is fine between hands — your bankroll and session stats are kept.</p>
      </Modal>
    </div>
  );
}
