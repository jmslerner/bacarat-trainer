/**
 * PlayView — the casino table (SPEC §5.5): felt with the EZ Baccarat layout, chip tray and controls, the dealing
 * animation driven by `HandResult.steps`, settlement animation, new-shoe sequence, the roads `<Scoreboard/>`,
 * hand history, Coach and session stats. Desktop: table left, panels right. Phones: stacked, Coach in a drawer.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BetType, Bets, Side } from '@/engine';
import { BET_TYPES, totalOnLayout, type ChipPlacement } from '@/engine';
import { Scoreboard } from '@/roads';
import { Button, Modal, SettingsDialog, cx, dealSpeedMs, formatMoney, ruleSummary, useIsPhone, useIsTablet, useSession, useSettings, useSound, type DealSpeed } from '@/ui/shell';
import { autoPauseMs, dealDurationMs, type ChipStacks } from './animation/timeline';
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

/** Shoes whose shuffle / cut card / burn sequence has been shown (keyed by seed and shoe number). */
const shoesSeen = new Set<string>();

const NOTICE_MS = 3800;

function groupStacks(chips: readonly ChipPlacement[]): ChipStacks {
  const out: Partial<Record<BetType, number[]>> = {};
  for (const chip of chips) (out[chip.bet] ??= []).push(chip.amount);
  return out;
}

function defaultChip(denominations: readonly number[], minMain: number): number {
  if (denominations.includes(25)) return 25;
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
  const onEvent = useCallback(
    (event: FrameEvent, current: CurrentHand | null) => {
      if (event === 'settled' && current) {
        const s = session.getState();
        recordHand(current.result, current.settlement, s.totalHands, s.seed);
        setAsk(null);
      }
      if (event === 'done' && autoRef.current) scheduleAutoRef.current(autoPauseMs(baseRef.current));
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

  // A chip that left the tray (rules change) is no longer in hand.
  useEffect(() => {
    if (!live.rules.chipDenominations.includes(selectedChip)) setSelectedChip(defaultChip(live.rules.chipDenominations, live.rules.limits.main.min));
  }, [live.rules, selectedChip]);

  // A replaced session clears the felt.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    reset();
    setAutoMode(false);
  }, [session, reset, setAutoMode]);

  // A shoe the table has not seen yet (first mount, new rules, a reset session) plays the new-shoe procedure.
  const prevRules = useRef(live.rules);
  useEffect(() => {
    const rulesChanged = prevRules.current !== live.rules;
    prevRules.current = live.rules;
    const key = `${live.seed}:${live.shoe.shoeNumber}`;
    if (shoesSeen.has(key)) return;
    shoesSeen.add(key);
    if (rulesChanged) setAutoMode(false);
    if (live.shoe.handsDealt > 0 || isBusy()) return;
    reset(rulesChanged ? 'New rules — place your bets' : 'Place your bets');
    startShuffle(live.shoe, live.rules, baseRef.current);
  }, [live.seed, live.shoe, live.rules, reset, startShuffle, isBusy, setAutoMode]);

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
    if (newShoeStarted) shoesSeen.add(`${after.seed}:${after.shoe.shoeNumber}`);
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
      const handOver = anim.settled || anim.phase === 'settled' || anim.phase === 'shuffling';
      skip();
      if (!handOver) return;
    }
    startDeal();
  }, [isBusy, anim.settled, anim.phase, skip, startDeal]);

  const placeChip = useCallback(
    (bet: BetType) => {
      if (isBusy()) {
        notify('No more bets — the hand is in play', 'info');
        return;
      }
      stopAuto('Auto-deal stopped');
      dismissLayout();
      const r = session.placeBet(bet, selectedRef.current);
      if (!r.ok) {
        notify(r.reason ?? 'That bet cannot be placed');
        return;
      }
      setNotice(null);
      sound.play('chip');
    },
    [isBusy, session, sound, dismissLayout, notify, stopAuto],
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
    shoesSeen.add(`${s.seed}:${s.shoe.shoeNumber}`);
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
  const rebetAmount = totalOnLayout(live.lastBets);
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
              dealReason={dealCheck.ok ? null : dealCheck.reason ?? 'Cannot deal'}
              busy={anim.busy}
              phase={anim.phase}
              auto={auto}
              onToggleAuto={toggleAuto}
              speed={prefs.dealSpeed}
              onSpeed={(s: DealSpeed) => setPrefs({ dealSpeed: s })}
              rebetAmount={rebetAmount}
              hasBets={hasBets}
              onDeal={onDeal}
              onRebet={onRebet}
              onClear={onClear}
              onUndo={onUndo}
              onNewShoe={onNewShoe}
              onBuyIn={() => setBuyInOpen(true)}
              notice={notice}
              phone={phone}
            />
          </div>
          {!phone && (
            <p className={styles.shortcuts} aria-label="Keyboard shortcuts">
              <kbd>1</kbd>–<kbd>6</kbd> chips · <kbd>P</kbd> <kbd>B</kbd> <kbd>T</kbd> Player / Banker / Tie · <kbd>D</kbd> Dragon 7 · <kbd>N</kbd> Panda 8 · <kbd>Space</kbd> deal · <kbd>R</kbd> rebet · <kbd>C</kbd> clear · <kbd>U</kbd> undo · <kbd>A</kbd> auto · right-click or long-press a spot to take a chip back
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
        <>
          <Button variant="primary" size="sm" className={styles.coachFab} onClick={() => setDrawerOpen(true)} aria-haspopup="dialog" data-testid="coach-drawer-button">
            Coach
          </Button>
          <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Coach" size="md">
            <div className={styles.drawerBody}>{coach}</div>
          </Modal>
        </>
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
