/**
 * useTableAnimation — plays a dealt hand back on the table.
 *
 * `GameSession.deal()` settles synchronously. The view therefore snapshots the session BEFORE dealing, lets the
 * engine deal, and then animates the returned `HandResult.steps` and settlement from a timeline while the previous
 * snapshot is "held": roads, bankroll, shoe and stats only move to the live state when the playback reaches the
 * settlement (`deriveView`).
 *
 * The animation state lives in a small external store read with `useSyncExternalStore`, like the session itself.
 * With a `useReducer` the two could tear: an update from a timer (auto-deal) lands in a different React lane than
 * the session store's, so one render saw the settled session with nothing held — the result leaked to the roads
 * and the history before a card was dealt.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Bets, Card, HandResult, HandSettlement, SessionState, SessionStats, ShoeInfo, TableRules } from '@/engine';
import type { SoundName } from '@/ui/shell';
import { FrameRunner } from './runner';
import { buildHandTimeline, buildShuffleTimeline, type ChipStacks } from './timeline';
import { emptyHand, type Frame, type FrameEvent, type HandDisplay, type LayoutDisplay, type Phase, type ShuffleDisplay } from './types';

export interface CurrentHand {
  result: HandResult;
  settlement: HandSettlement;
  newShoe: ShoeInfo | null;
}

export interface AnimState {
  phase: Phase;
  hand: HandDisplay;
  /** Chips as dealt / settled; null = show the live layout. */
  layout: LayoutDisplay | null;
  shuffle: ShuffleDisplay | null;
  /** Session snapshot taken before the deal, held while the hand plays (null = live). */
  held: SessionState | null;
  current: CurrentHand | null;
  /** The settlement has been revealed. */
  settled: boolean;
  /** Animated bankroll (null = live). */
  bankroll: number | null;
  /** Frames still pending. */
  running: boolean;
  announce: string;
}

export type AnimAction =
  | { type: 'begin'; held: SessionState | null; current: CurrentHand | null }
  | { type: 'frame'; frame: Frame }
  | { type: 'done' }
  | { type: 'dismissLayout' }
  | { type: 'reset'; message: string };

export function initialAnimState(message = 'Place your bets'): AnimState {
  return {
    phase: 'idle',
    hand: emptyHand(message),
    layout: null,
    shuffle: null,
    held: null,
    current: null,
    settled: false,
    bankroll: null,
    running: false,
    announce: '',
  };
}

export function animReducer(state: AnimState, action: AnimAction): AnimState {
  switch (action.type) {
    case 'begin':
      return { ...state, held: action.held, current: action.current, settled: false, running: true, announce: '' };
    case 'frame': {
      const f = action.frame;
      return {
        ...state,
        phase: f.phase ?? state.phase,
        hand: f.hand ?? state.hand,
        layout: f.layout !== undefined ? f.layout : state.layout,
        shuffle: f.shuffle !== undefined ? f.shuffle : state.shuffle,
        bankroll: f.bankroll !== undefined ? f.bankroll : state.bankroll,
        settled: state.settled || f.event === 'settled',
        announce: f.announce ?? state.announce,
      };
    }
    case 'done':
      return { ...state, held: null, bankroll: null, running: false, phase: state.phase === 'dealing' || state.phase === 'settling' || state.phase === 'shuffling' ? 'settled' : state.phase };
    case 'dismissLayout':
      return state.layout === null ? state : { ...state, layout: null, phase: state.phase === 'settled' ? 'idle' : state.phase };
    case 'reset':
      return initialAnimState(action.message);
  }
}

/** The animation state as an external store (one per table), so React reads it in step with the session store. */
export class AnimStore {
  private state: AnimState;
  private readonly listeners = new Set<() => void>();

  constructor(initial: AnimState = initialAnimState()) {
    this.state = initial;
  }

  readonly get = (): AnimState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly dispatch = (action: AnimAction): void => {
    const next = animReducer(this.state, action);
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  };
}

export interface StartHandInput {
  /** Snapshot taken before `session.deal()`. */
  prev: SessionState;
  stacks: ChipStacks;
  result: HandResult;
  settlement: HandSettlement;
  /** The new shoe when the deal ended the old one, else null. */
  newShoe: ShoeInfo | null;
  bankrollAfter: number;
  base: number;
  tips: boolean;
}

export interface TableAnimation extends AnimState {
  busy: boolean;
  /** Synchronous busy flag (true from `startHand`/`startShuffle` until the last frame), independent of renders. */
  isBusy: () => boolean;
  startHand: (input: StartHandInput) => void;
  startShuffle: (shoe: ShoeInfo, rules: TableRules, base: number) => void;
  /** Fast-forward whatever is playing. */
  skip: () => void;
  /** The user acted on the layout: show the live bets again. */
  dismissLayout: () => void;
  reset: (message?: string) => void;
}

export interface UseTableAnimationOptions {
  play: (name: SoundName) => void;
  onEvent?: (event: FrameEvent, current: CurrentHand | null) => void;
}

export function useTableAnimation({ play, onEvent }: UseTableAnimationOptions): TableAnimation {
  const storeRef = useRef<AnimStore | null>(null);
  if (storeRef.current === null) storeRef.current = new AnimStore();
  const store = storeRef.current;
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const playRef = useRef(play);
  const onEventRef = useRef(onEvent);
  const currentRef = useRef<CurrentHand | null>(null);
  playRef.current = play;
  onEventRef.current = onEvent;

  const busyRef = useRef(false);
  const runnerRef = useRef<FrameRunner | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = new FrameRunner({
      apply: (frame, instant) => {
        store.dispatch({ type: 'frame', frame });
        if (frame.sound && (!instant || frame.keySound)) playRef.current(frame.sound);
        if (frame.event === 'settled') onEventRef.current?.(frame.event, currentRef.current);
      },
      onDone: () => {
        busyRef.current = false;
        store.dispatch({ type: 'done' });
        onEventRef.current?.('done', currentRef.current);
      },
    });
  }
  const runner = runnerRef.current;

  useEffect(
    () => () => {
      runner.cancel();
      busyRef.current = false;
      store.dispatch({ type: 'reset', message: 'Place your bets' });
    },
    [runner, store],
  );

  const skip = useCallback(() => runner.skip(), [runner]);
  const isBusy = useCallback(() => busyRef.current, []);

  const startHand = useCallback(
    (input: StartHandInput) => {
      runner.skip();
      const current: CurrentHand = { result: input.result, settlement: input.settlement, newShoe: input.newShoe };
      currentRef.current = current;
      busyRef.current = true;
      store.dispatch({ type: 'begin', held: input.prev, current });
      runner.start(
        buildHandTimeline({
          result: input.result,
          settlement: input.settlement,
          rules: input.prev.rules,
          bets: input.prev.bets,
          stacks: input.stacks,
          bankrollBefore: input.prev.bankroll,
          bankrollAfter: input.bankrollAfter,
          base: input.base,
          tips: input.tips,
          newShoe: input.newShoe,
        }),
      );
    },
    [runner, store],
  );

  const startShuffle = useCallback(
    (shoe: ShoeInfo, rules: TableRules, base: number) => {
      runner.skip();
      currentRef.current = null;
      busyRef.current = true;
      store.dispatch({ type: 'begin', held: null, current: null });
      runner.start(buildShuffleTimeline(shoe, rules, base));
    },
    [runner, store],
  );

  const dismissLayout = useCallback(() => store.dispatch({ type: 'dismissLayout' }), [store]);
  const reset = useCallback(
    (message = 'Place your bets') => {
      runner.cancel();
      busyRef.current = false;
      currentRef.current = null;
      store.dispatch({ type: 'reset', message });
    },
    [runner, store],
  );

  return useMemo(
    () => ({ ...state, busy: state.running, isBusy, startHand, startShuffle, skip, dismissLayout, reset }),
    [state, isBusy, startHand, startShuffle, skip, dismissLayout, reset],
  );
}

/** Cards on the felt in dealing order (P1, B1, P2, B2, P3, B3). */
export function cardsOnFelt(hand: HandDisplay): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < 3; i++) {
    const p = hand.playerCards[i];
    const b = hand.bankerCards[i];
    if (p) out.push(p);
    if (b) out.push(b);
  }
  return out;
}

/** What the rest of the view (roads, bankroll, shoe, counts, stats) should show right now. */
export interface TableView {
  results: readonly HandResult[];
  bankroll: number;
  shoe: ShoeInfo;
  seenCards: readonly Card[];
  stats: SessionStats;
  rules: TableRules;
  lastBets: Bets;
  /** The live state is being shown (nothing held). */
  live: boolean;
}

export function deriveView(anim: AnimState, live: SessionState): TableView {
  const held = anim.held;
  const current = anim.current;
  if (!held || !current) {
    return {
      results: live.shoeHistory,
      bankroll: anim.bankroll ?? live.bankroll,
      shoe: live.shoe,
      seenCards: live.seenCards,
      stats: live.stats,
      rules: live.rules,
      lastBets: live.lastBets,
      live: true,
    };
  }
  const result = current.result;
  if (anim.phase === 'shuffling') {
    // The old shoe is complete; its final hand stays on the roads until the new shoe is ready.
    return {
      results: [...held.shoeHistory, result],
      bankroll: anim.bankroll ?? live.bankroll,
      shoe: live.shoe,
      seenCards: live.seenCards,
      stats: live.stats,
      rules: live.rules,
      lastBets: live.lastBets,
      live: false,
    };
  }
  const dealt = cardsOnFelt(anim.hand);
  const settled = anim.settled;
  const shoe: ShoeInfo = {
    ...held.shoe,
    cardsRemaining: held.shoe.cardsRemaining - dealt.length,
    cardsDealt: held.shoe.cardsDealt + dealt.length,
    cutCardReached: held.shoe.cutCardReached || anim.hand.cutCard,
    lastHandNext: held.shoe.lastHandNext || (settled && result.cutCardDrawn),
    handsDealt: held.shoe.handsDealt + (settled ? 1 : 0),
  };
  return {
    results: settled ? [...held.shoeHistory, result] : held.shoeHistory,
    bankroll: anim.bankroll ?? held.bankroll,
    shoe,
    seenCards: [...held.seenCards, ...dealt],
    stats: settled ? live.stats : held.stats,
    rules: live.rules,
    lastBets: live.lastBets,
    live: false,
  };
}
