/**
 * The one GameSession for the whole app, exposed to React through useSyncExternalStore.
 *
 *  - created lazily with the persisted rules (`bt:rules`) and the persisted bankroll (`bt:bankroll`,
 *    falling back to the buy-in amount);
 *  - rule changes in the settings store are forwarded to `session.setRules()` (new shoe) — but only
 *    when they differ from the table's current rules, so re-saving identical rules never discards a
 *    shoe or clears the layout;
 *  - the bankroll is persisted after every state change so a reload keeps your money.
 */
import { useSyncExternalStore } from 'react';
import { DEFAULT_RULES, GameSession, validateRules } from '@/engine';
import type { SessionState, TableRules } from '@/engine';
import { readStorage, writeStorage } from './storage';
import { buyInStore, rulesEqual, rulesStore, sanitizeBuyIn, SETTINGS_KEYS } from './useSettings';

export interface SessionInit {
  rules?: TableRules;
  bankroll?: number;
  seed?: number;
}

let instance: GameSession | null = null;
let teardown: (() => void) | null = null;
const holderListeners = new Set<() => void>();

/** Bridges the settings store and storage to a session; returns the detach function. */
function attach(session: GameSession): () => void {
  const unsubRules = rulesStore.subscribe((rules) => {
    if (rulesEqual(rules, session.getState().rules)) return;
    try {
      session.setRules(rules);
    } catch {
      /* rules the engine rejects (e.g. a stale write from another tab) leave the table unchanged */
    }
  });
  const unsubState = session.subscribe((s: SessionState) => {
    writeStorage(SETTINGS_KEYS.bankroll, s.bankroll);
  });
  return () => {
    unsubRules();
    unsubState();
  };
}

/** Persisted rules can predate an engine change; never hand the engine something it rejects. */
function storedPlayableRules(): TableRules {
  const rules = rulesStore.get();
  try {
    if (validateRules(rules).length === 0) return rules;
  } catch {
    /* fall through */
  }
  rulesStore.reset();
  return DEFAULT_RULES;
}

function persistedBankroll(): number {
  const buyIn = buyInStore.get();
  const raw = readStorage<unknown>(SETTINGS_KEYS.bankroll, buyIn);
  return sanitizeBuyIn(raw, buyIn);
}

function install(session: GameSession): GameSession {
  teardown?.();
  instance = session;
  teardown = attach(session);
  return session;
}

/** The app-wide session (created on first use). */
export function getSession(): GameSession {
  return instance ?? install(new GameSession({ rules: storedPlayableRules(), bankroll: persistedBankroll() }));
}

/**
 * Replace the singleton with a fresh session (dev harnesses, tests, "reset session").
 * Explicit `rules` are used as given (the engine throws on invalid ones and nothing is swapped);
 * otherwise the persisted rules apply. Subscribed components re-render against the new instance.
 */
export function resetSession(opts: SessionInit = {}): GameSession {
  const session = new GameSession({
    rules: opts.rules ?? storedPlayableRules(),
    bankroll: opts.bankroll ?? buyInStore.get(),
    ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
  });
  install(session);
  for (const l of holderListeners) l();
  return session;
}

function subscribe(onChange: () => void): () => void {
  let unsubInstance = getSession().subscribe(onChange);
  const onSwap = (): void => {
    unsubInstance();
    unsubInstance = getSession().subscribe(onChange);
    onChange();
  };
  holderListeners.add(onSwap);
  return () => {
    unsubInstance();
    holderListeners.delete(onSwap);
  };
}

function getSnapshot(): SessionState {
  return getSession().getState();
}

export interface SessionHandle {
  /** Immutable snapshot; a new object after every mutation. */
  state: SessionState;
  /** The live session: placeBet / deal / rebet / newShoe / setBankroll … */
  session: GameSession;
}

/** Subscribe to the singleton GameSession. */
export function useSession(): SessionHandle {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { state, session: getSession() };
}

/** Just the state (same subscription, handy in small components). */
export function useSessionState(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
