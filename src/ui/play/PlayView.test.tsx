// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_RULES, RULE_PRESETS, applyTableLevel, handTotal, totalOnLayout } from '@/engine';
import { buyInStore, cardName, DEFAULT_PREFS, getDisplayedBankroll, getSession, prefsStore, resetSession, rulesStore } from '@/ui/shell';
import { PlayView, defaultChip } from './PlayView';
import { dealDurationMs, revealMs } from './animation/timeline';
import { clearHistory } from './history/historyStore';

function setup(opts: { bankroll?: number; seed?: number } = {}) {
  const session = resetSession({ bankroll: opts.bankroll ?? 1000, seed: opts.seed ?? 42 });
  const utils = render(<PlayView />);
  return { session, ...utils };
}

// jsdom has no PointerEvent: a minimal one so `pointerType` / `button` reach the spot's pointer handlers.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? '';
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventShim }).PointerEvent = PointerEventShim;
}

const spot = (bet: string): HTMLButtonElement => document.querySelector(`[data-bet="${bet}"]`) as HTMLButtonElement;
const chip = (value: number): HTMLButtonElement => screen.getByTestId(`chip-${value}`) as HTMLButtonElement;
const dealButton = (): HTMLButtonElement => screen.getByTestId('deal-button') as HTMLButtonElement;
const liveSession = (): ReturnType<typeof getSession> => getSession();
const tableBankroll = (): string => (screen.getByTestId('table-bankroll').querySelector('[data-value]') as HTMLElement).textContent ?? '';

beforeEach(() => {
  window.localStorage.clear();
  rulesStore.reset();
  buyInStore.reset();
  prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'instant', sound: false });
  clearHistory();
  // jsdom has no canvas: the Dragon 7 / Panda 8 particle layer copes with a missing 2D context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.removeAttribute('data-celebrate');
});

describe('PlayView — betting', () => {
  it('renders the EZ layout, the chip tray and a disabled DEAL with its reason', () => {
    setup();
    for (const bet of ['playerPair', 'player', 'tie', 'banker', 'bankerPair', 'dragon7', 'panda8']) expect(spot(bet)).toBeTruthy();
    expect(spot('banker').textContent).toMatch(/no commission/i);
    expect(spot('dragon7').textContent).toMatch(/40 to 1/i);
    expect(spot('panda8').textContent).toMatch(/25 to 1/i);
    expect(spot('tie').textContent).toMatch(/8 to 1/i);
    for (const v of DEFAULT_RULES.chipDenominations) expect(chip(v)).toBeTruthy();
    expect(chip(25).getAttribute('aria-pressed')).toBe('true');
    expect(dealButton().disabled).toBe(true);
    expect(screen.getByTestId('deal-reason').textContent).toBe('Place a bet to deal');
    expect(screen.getByText(/Min \$10 — Max \$5,000/)).toBeTruthy();
    expect(screen.getByTestId('dealer-call').textContent).toMatch(/place your bets/i);
    expect(screen.queryByTestId('commission-box')).toBeNull();
  });

  it('the limits plaque names the table level, the tray shows the salon chips, and keys 7–9 reach a nine-chip tray', () => {
    rulesStore.set(applyTableLevel(DEFAULT_RULES, 'high'));
    setup({ bankroll: 50000 });
    const plaque = screen.getByTestId('table-limits');
    expect(plaque.textContent).toMatch(/\$500 high-limit salon/);
    expect(plaque.textContent).toMatch(/Min \$500 — Max \$100,000/);
    expect(plaque.textContent).toMatch(/Tie \$500–\$10,000 · Side \$100–\$5,000/);
    expect(plaque.getAttribute('data-level')).toBe('high');
    expect(plaque.getAttribute('title')).toMatch(/^\$500 high-limit salon — Salon play with limits raised for rated players\. Player and Banker \$500–\$100,000, Tie \$500–\$10,000/);
    for (const v of [100, 500, 1000, 5000, 25000, 100000]) expect(chip(v)).toBeTruthy();
    expect(screen.queryByTestId('chip-25')).toBeNull();
    expect(chip(100000).textContent).toBe('100K');
    expect(chip(100000).getAttribute('aria-label')).toBe('$100,000 chip');
    expect(chip(500).getAttribute('aria-pressed')).toBe('true'); // the first chip at or above the $500 minimum
    expect(tableBankroll()).toBe('$50,000');

    act(() => {
      rulesStore.set({ ...applyTableLevel(DEFAULT_RULES, 'high'), chipDenominations: [1, 5, 25, 100, 500, 1000, 5000, 25000, 100000] });
    });
    expect(screen.getByTestId('table-limits').textContent).toMatch(/Custom limits/);
    expect(screen.getByTestId('table-limits').getAttribute('data-level')).toBe('custom');
    fireEvent.keyDown(window, { key: '9' });
    expect(chip(100000).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: '7' });
    expect(chip(5000).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: '1' });
    expect(chip(1).getAttribute('aria-pressed')).toBe('true');
  });

  it('places chips on spots, stacks them with the total and enables DEAL', () => {
    const { session } = setup();
    fireEvent.click(spot('player'));
    expect(session.getState().bets).toEqual({ player: 25 });
    expect(spot('player').getAttribute('data-amount')).toBe('25');
    fireEvent.click(chip(5));
    fireEvent.click(spot('player'));
    fireEvent.click(spot('dragon7'));
    expect(session.getState().bets).toEqual({ player: 30, dragon7: 5 });
    expect(spot('player').querySelector('[data-total="30"][data-count="2"]')).toBeTruthy();
    expect(spot('player').textContent).toMatch(/\$30/);
    expect(dealButton().disabled).toBe(false);
    expect(screen.queryByTestId('deal-reason')).toBeNull();
    // Right-click takes the last chip back; undo and clear work from the rail.
    fireEvent.contextMenu(spot('player'));
    expect(session.getState().bets).toEqual({ player: 25, dragon7: 5 });
    fireEvent.click(screen.getByTestId('undo-button'));
    expect(session.getState().bets).toEqual({ player: 25 });
    fireEvent.click(screen.getByTestId('clear-button'));
    expect(session.getState().bets).toEqual({});
    expect(dealButton().disabled).toBe(true);
  });

  it('shows the table-limit and bankroll errors from the engine', () => {
    const { session } = setup({ bankroll: 1000 });
    fireEvent.click(chip(1000));
    fireEvent.click(spot('tie'));
    expect(screen.getByTestId('notice').textContent).toBe('Tie bet cannot exceed the table maximum of $500');
    expect(session.getState().bets).toEqual({});
    fireEvent.click(spot('banker'));
    expect(session.getState().bets).toEqual({ banker: 1000 });
    fireEvent.click(chip(25));
    fireEvent.click(spot('player'));
    expect(screen.getByTestId('notice').textContent).toBe('Not enough bankroll');
    expect(session.getState().bets).toEqual({ banker: 1000 });
    // A bet below the minimum blocks dealing with the engine's reason.
    fireEvent.click(screen.getByTestId('clear-button'));
    fireEvent.click(chip(5));
    fireEvent.click(spot('player'));
    expect(dealButton().disabled).toBe(true);
    expect(screen.getByTestId('deal-reason').textContent).toBe('Player bet of $5 is below the table minimum of $10');
  });

  it('a touch long press takes one chip back — and the context menu the browser adds to it does not take a second', () => {
    vi.useFakeTimers();
    const { session } = setup();
    fireEvent.click(spot('player'));
    fireEvent.click(spot('player'));
    fireEvent.click(spot('player'));
    expect(session.getState().bets).toEqual({ player: 75 });
    // Long press, then the synthesized contextmenu and the click that ends the press.
    fireEvent.pointerDown(spot('player'), { pointerType: 'touch', button: 0 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(session.getState().bets).toEqual({ player: 50 });
    fireEvent.contextMenu(spot('player'));
    fireEvent.pointerUp(spot('player'), { pointerType: 'touch' });
    fireEvent.click(spot('player'));
    expect(session.getState().bets).toEqual({ player: 50 });
    // The other order (contextmenu before the press timer fires): still exactly one chip.
    fireEvent.pointerDown(spot('player'), { pointerType: 'touch', button: 0 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.contextMenu(spot('player'));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.pointerUp(spot('player'), { pointerType: 'touch' });
    fireEvent.click(spot('player'));
    expect(session.getState().bets).toEqual({ player: 25 });
    // A mouse button held down is not a long press: the right button takes chips back with a mouse.
    fireEvent.pointerDown(spot('player'), { pointerType: 'mouse', button: 0 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.pointerUp(spot('player'), { pointerType: 'mouse' });
    expect(session.getState().bets).toEqual({ player: 25 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.contextMenu(spot('player'));
    expect(session.getState().bets).toEqual({});
  });

  it('Space deals even when a spot was just clicked with the mouse; after Tab it is left to the focused control', () => {
    const { session } = setup({ bankroll: 1000, seed: 42 });
    fireEvent.pointerDown(spot('player'));
    fireEvent.click(spot('player'));
    spot('player').focus();
    expect(session.getState().bets).toEqual({ player: 25 });
    act(() => {
      fireEvent.keyDown(spot('player'), { key: ' ' });
    });
    expect(session.getState().totalHands).toBe(1);
    expect(session.getState().bets).toEqual({});
    // Keyboard modality: a Tab-focused spot keeps its native Space (the browser presses it; jsdom does not).
    fireEvent.keyDown(window, { key: 'Tab' });
    spot('banker').focus();
    fireEvent.keyDown(window, { key: 'r' });
    expect(session.getState().bets).toEqual({ player: 25 });
    expect(fireEvent.keyDown(spot('banker'), { key: ' ' })).toBe(true);
    expect(session.getState().totalHands).toBe(1);
    fireEvent.pointerDown(document.body);
  });
});

describe('PlayView — table levels', () => {
  it('defaultChip picks $25 when it covers the main minimum, otherwise the smallest chip that does', () => {
    expect(defaultChip([1, 5, 25, 100, 500, 1000], 10)).toBe(25);
    expect(defaultChip([5, 25, 100, 500, 1000, 5000], 25)).toBe(25);
    expect(defaultChip([25, 100, 500, 1000, 5000, 25000], 100)).toBe(100);
    expect(defaultChip([100, 500, 1000, 5000, 25000, 100000], 500)).toBe(500);
    expect(defaultChip([1000, 5000, 25000, 100000], 5000)).toBe(5000);
    expect(defaultChip([1, 5], 10)).toBe(5);
    expect(defaultChip([], 10)).toBe(1);
  });

  it('a fresh seat at the $100 midi table holds a $100 chip, not the $25 that is also in its tray', () => {
    rulesStore.set(applyTableLevel(DEFAULT_RULES, 'midi'));
    setup({ bankroll: 10000 });
    expect(chip(25)).toBeTruthy();
    expect(chip(100).getAttribute('aria-pressed')).toBe('true');
    expect(chip(25).getAttribute('aria-pressed')).toBe('false');
  });

  it('moving tables hands you the new base chip and drops a rebet the table will not deal; a tray-only edit keeps the chip in hand', () => {
    vi.useFakeTimers();
    const { session } = setup({ bankroll: 1000, seed: 42 });
    /** Lets the new shoe's shuffle sequence (started by a rules change) play out. */
    const settle = (): void => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId('play-view').getAttribute('data-phase')).not.toBe('shuffling');
    };
    fireEvent.click(spot('banker')); // $25
    act(() => {
      fireEvent.click(dealButton());
    });
    expect(session.getState().lastBets).toEqual({ banker: 25 });
    expect(screen.getByTestId('deal-reason').textContent).toBe('Rebet (R) to play $25 again, or place chips');
    // → the $500 salon: the $25 Banker bet cannot be repeated there, so it is not offered and R places nothing.
    act(() => {
      rulesStore.set(applyTableLevel(DEFAULT_RULES, 'high'));
      session.setBankroll(50000);
    });
    settle();
    expect(chip(500).getAttribute('aria-pressed')).toBe('true');
    const rebet = screen.getByTestId('rebet-button') as HTMLButtonElement;
    expect(rebet.disabled).toBe(true);
    expect(rebet.textContent).not.toMatch(/\$25/);
    expect(rebet.getAttribute('title')).toBe('The last bets cannot be repeated at this table: Banker bet of $25 is below the table minimum of $500');
    expect(screen.getByTestId('deal-reason').textContent).toBe('Place a bet to deal');
    fireEvent.keyDown(window, { key: 'r' });
    expect(session.getState().bets).toEqual({});
    expect(totalOnLayout(session.getState().bets)).toBe(0);
    expect(dealButton().disabled).toBe(true);
    // → the $100 midi table: $25 is in its tray, but a new table hands you its base chip.
    act(() => {
      rulesStore.set(applyTableLevel(DEFAULT_RULES, 'midi'));
    });
    settle();
    expect(chip(25)).toBeTruthy();
    expect(chip(100).getAttribute('aria-pressed')).toBe('true');
    // A chip-tray-only edit is not a table move: the chip in hand stays.
    fireEvent.click(chip(25));
    act(() => {
      rulesStore.set({ ...applyTableLevel(DEFAULT_RULES, 'midi'), chipDenominations: [5, 25, 100, 500, 1000, 5000, 25000] });
    });
    settle();
    expect(chip(5)).toBeTruthy();
    expect(chip(25).getAttribute('aria-pressed')).toBe('true');
    // Back at the $10 table the old $25 Banker bet is repeatable again.
    act(() => {
      rulesStore.set(DEFAULT_RULES);
    });
    settle();
    expect(screen.getByTestId('rebet-button').textContent).toMatch(/\$25/);
    expect((screen.getByTestId('rebet-button') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('deal-reason').textContent).toBe('Rebet (R) to play $25 again, or place chips');
    fireEvent.keyDown(window, { key: 'r' });
    expect(session.getState().bets).toEqual({ banker: 25 });
  });

  it('a bankroll below the table minimum gets a buy-in hint when a chip is refused', () => {
    rulesStore.set(applyTableLevel(DEFAULT_RULES, 'high'));
    setup({ bankroll: 300 });
    fireEvent.click(chip(500));
    fireEvent.click(spot('banker'));
    expect(screen.getByTestId('notice').textContent).toBe('Not enough bankroll: only $300 left to bet — your bankroll is below the $500 table minimum; Buy-in to keep playing');
    expect(liveSession().getState().bets).toEqual({});
  });
});

describe('PlayView — dealing (instant)', () => {
  it('deals, shows the dealer calls and the cards, settles the bankroll and fills history and roads', () => {
    const { session } = setup({ bankroll: 1000, seed: 42 });
    fireEvent.click(spot('player'));
    fireEvent.click(spot('banker'));
    const before = session.getState().bankroll;
    act(() => {
      fireEvent.click(dealButton());
    });
    const state = session.getState();
    expect(state.totalHands).toBe(1);
    const last = state.lastHand!;
    const call = screen.getByTestId('dealer-call').textContent ?? '';
    expect(call).toMatch(/wins, \d over \d|Tie, \d and \d|Dragon 7!|Panda 8!/);
    expect(document.querySelectorAll('[data-card-id]')).toHaveLength(last.result.playerCards.length + last.result.bankerCards.length);
    const player = document.querySelector('[data-side="player"]')!;
    const banker = document.querySelector('[data-side="banker"]')!;
    expect(player.getAttribute('data-total')).toBe(String(last.result.playerTotal));
    expect(banker.getAttribute('data-total')).toBe(String(last.result.bankerTotal));
    if (last.result.playerCards.length === 3) expect(player.querySelector('[data-rotated]')).toBeTruthy();
    expect(tableBankroll()).toBe(`$${state.bankroll.toLocaleString('en-US')}`);
    expect(state.bankroll).toBe(before + last.settlement.net);
    expect(screen.getByTestId('settlement-status').textContent).toMatch(/You won|You lost|Push/);
    // Spots show the result of each bet.
    expect(spot('player').getAttribute('data-result')).toBe(last.settlement.settlements.find((s) => s.bet === 'player')!.result);
    expect(spot('banker').getAttribute('data-result')).toBe(last.settlement.settlements.find((s) => s.bet === 'banker')!.result);
    // History and scoreboard received the hand.
    expect(within(screen.getByTestId('hand-history')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Hand 1')).toBeTruthy();
    // The table is cleared; the hint points at REBET.
    expect(screen.getByTestId('deal-reason').textContent).toBe('Rebet (R) to play $50 again, or place chips');
    expect(dealButton().disabled).toBe(true);
  });

  it('REBET restores the previous layout, the keyboard shortcuts work and Space deals', () => {
    const { session } = setup({ bankroll: 1000, seed: 7 });
    fireEvent.keyDown(window, { key: '2' }); // $5 chip
    expect(chip(5).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.keyDown(window, { key: 'p' });
    fireEvent.keyDown(window, { key: 'u' });
    expect(session.getState().bets).toEqual({ banker: 10 });
    fireEvent.keyDown(window, { key: '3' }); // $25 chip
    fireEvent.keyDown(window, { key: 't' });
    fireEvent.keyDown(window, { key: 'd' });
    fireEvent.keyDown(window, { key: 'n' });
    expect(session.getState().bets).toEqual({ banker: 10, tie: 25, dragon7: 25, panda8: 25 });
    fireEvent.keyDown(window, { key: 'c' });
    expect(session.getState().bets).toEqual({});
    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.keyDown(window, { key: 'p' });
    act(() => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(session.getState().totalHands).toBe(1);
    expect(session.getState().bets).toEqual({});
    expect(session.getState().lastBets).toEqual({ banker: 25, player: 25 });
    expect(screen.getByTestId('rebet-button').textContent).toMatch(/\$50/);
    fireEvent.keyDown(window, { key: 'r' });
    expect(session.getState().bets).toEqual({ banker: 25, player: 25 });
    expect(spot('banker').getAttribute('data-result')).toBeNull();
    act(() => {
      fireEvent.click(screen.getByTestId('rebet-button'));
    });
    expect(session.getState().bets).toEqual({ banker: 25, player: 25 });
    act(() => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(session.getState().totalHands).toBe(2);
    expect(within(screen.getByTestId('hand-history')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the beginner tip for the current call and the Coach evaluates the layout', () => {
    const { session } = setup({ bankroll: 1000, seed: 5 });
    fireEvent.click(spot('banker'));
    fireEvent.click(chip(5));
    fireEvent.click(spot('dragon7'));
    const coach = screen.getByTestId('coach-panel');
    expect(within(coach).getByTestId('coach-bets').textContent).toMatch(/Banker.*\$25.*1\.02%/);
    expect(within(coach).getByTestId('coach-bets').textContent).toMatch(/Dragon 7.*\$5.*7\.61%/);
    expect(within(coach).getByTestId('count-dragon7').getAttribute('data-true-count')).toBeTruthy();
    act(() => {
      fireEvent.click(dealButton());
    });
    expect(screen.getByTestId('dealer-tip').textContent).toMatch(/Why/);
    const last = session.getState().lastHand!.result;
    if (last.outcome === 'banker') expect(screen.getByTestId('dealer-tip').textContent).toMatch(/Banker \d beats Player \d/);
    // With no live bets, the Coach lists the house edges with the best bet starred.
    expect(within(coach).getByTestId('coach-edges').textContent).toMatch(/Banker ★/);
  });

  it('AUTO repeats the bets and deals until the bankroll cannot cover them', () => {
    vi.useFakeTimers();
    const { session } = setup({ bankroll: 100, seed: 7 });
    fireEvent.click(chip(25));
    fireEvent.click(spot('player'));
    fireEvent.click(spot('player'));
    fireEvent.click(chip(5));
    fireEvent.click(spot('player'));
    fireEvent.click(spot('player'));
    expect(session.getState().bets).toEqual({ player: 60 });
    act(() => {
      fireEvent.keyDown(window, { key: 'a' });
    });
    expect(screen.getByTestId('auto-button').getAttribute('aria-pressed')).toBe('true');
    let hands = 0;
    for (let i = 0; i < 100 && screen.getByTestId('auto-button').getAttribute('aria-pressed') === 'true'; i++) {
      act(() => {
        vi.advanceTimersByTime(300);
      });
      hands = session.getState().totalHands;
    }
    expect(screen.getByTestId('auto-button').getAttribute('aria-pressed')).toBe('false');
    expect(hands).toBeGreaterThan(0);
    expect(session.getState().bankroll).toBeLessThan(60);
    expect(session.getState().bets).toEqual({});
    expect(screen.getByTestId('notice').textContent).toMatch(/Auto-deal stopped: Not enough bankroll/);
    expect(within(screen.getByTestId('hand-history')).getAllByRole('listitem')).toHaveLength(hands);
  });

  it('AUTO at an animated speed never leaks a hand into the roads, bankroll or history before it is dealt', () => {
    vi.useFakeTimers();
    prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'fast', sound: false });
    const { session } = setup({ bankroll: 1000, seed: 7 });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.click(spot('banker'));
    act(() => {
      fireEvent.keyDown(window, { key: 'a' });
    });
    const scoreboardHands = (): string => screen.getByText(/^Hand \d+$/).textContent ?? '';
    let dealt = 0;
    for (let i = 0; i < 3000 && session.getState().totalHands < 4; i++) {
      act(() => {
        vi.advanceTimersByTime(10);
      });
      const hands = session.getState().totalHands;
      if (hands > dealt) {
        // The engine has settled hand N; the table must still show hand N−1 everywhere until the cards are out.
        dealt = hands;
        expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('dealing');
        expect(scoreboardHands()).toBe(`Hand ${hands - 1}`);
        expect(tableBankroll()).toBe(`$${(session.getState().bankroll - session.getState().lastHand!.settlement.net).toLocaleString('en-US')}`);
        const list = screen.queryByTestId('hand-history');
        expect(list ? within(list).getAllByRole('listitem') : []).toHaveLength(hands - 1);
        expect(screen.getByTestId('history-panel').textContent).not.toMatch(new RegExp(`#${hands}\\b`));
      }
    }
    act(() => {
      fireEvent.keyDown(window, { key: 'a' });
    });
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    const total = session.getState().totalHands;
    expect(total).toBeGreaterThanOrEqual(4);
    const rows = within(screen.getByTestId('hand-history')).getAllByRole('listitem');
    expect(rows).toHaveLength(total);
    expect(new Set(rows.map((r) => r.getAttribute('aria-label'))).size).toBe(total);
    expect(scoreboardHands()).toBe(`Hand ${total}`);
  });

  it('publishes the bankroll it displays for the top bar: the pre-deal figure while the hand plays, the live figure after, nothing once unmounted', () => {
    vi.useFakeTimers();
    prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'fast', sound: false });
    const { session, unmount } = setup({ bankroll: 1000, seed: 7 });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(getDisplayedBankroll()).toEqual({ bankroll: 1000, net: 0 });
    fireEvent.click(spot('banker'));
    fireEvent.click(spot('dragon7'));
    fireEvent.click(dealButton());
    const settled = session.getState();
    expect(settled.totalHands).toBe(1);
    // The engine has settled; the table (and so the pill) still shows the pre-deal bankroll with no net.
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('dealing');
    expect(getDisplayedBankroll()).toEqual({ bankroll: 1000, net: 0 });
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(getDisplayedBankroll()).toEqual({ bankroll: settled.bankroll, net: settled.stats.net });
    expect(settled.bankroll).toBe(1000 + settled.stats.net);
    unmount();
    expect(getDisplayedBankroll()).toBeNull();
  });

  it('plays the whole shoe through the cut card into a new shoe with the banner and shuffle', () => {
    const { session } = setup({ bankroll: 100000, seed: 3 });
    fireEvent.click(chip(100));
    fireEvent.click(spot('banker'));
    const shoeBefore = session.getState().shoe.shoeNumber;
    let guard = 0;
    while (!session.getState().shoe.lastHandNext && guard++ < 120) {
      act(() => {
        fireEvent.click(dealButton());
      });
      fireEvent.keyDown(window, { key: 'r' });
    }
    expect(session.getState().shoe.lastHandNext).toBe(true);
    expect(screen.getByTestId('last-hand-banner')).toBeTruthy();
    expect(document.querySelector('[data-cut-out]')).toBeTruthy();
    act(() => {
      fireEvent.click(dealButton());
    });
    const state = session.getState();
    expect(state.shoe.shoeNumber).toBe(shoeBefore + 1);
    expect(state.shoeHistory).toHaveLength(0);
    expect(screen.queryByTestId('last-hand-banner')).toBeNull();
    expect(screen.getByTestId('dealer-call').textContent).toBe('New shoe — place your bets');
    expect(screen.getByText('Hand 0')).toBeTruthy();
    expect(document.querySelector('[data-shoe]')!.getAttribute('data-shoe-number')).toBe(String(shoeBefore + 1));
  });
});

describe('PlayView — settlement display', () => {
  it('shows the Dragon 7 as a push on the Banker and a Tie as pushes on the main bets', () => {
    const { session } = setup({ bankroll: 1000, seed: 267 });
    fireEvent.click(spot('banker'));
    fireEvent.click(spot('player'));
    fireEvent.click(chip(5));
    fireEvent.click(spot('dragon7'));
    fireEvent.click(spot('tie'));
    expect(session.getState().bets).toEqual({ banker: 25, player: 25, dragon7: 5, tie: 5 });
    act(() => {
      fireEvent.click(dealButton());
    });
    let last = session.getState().lastHand!;
    expect(last.result.dragon7).toBe(true);
    expect(screen.getByTestId('dealer-call').textContent).toMatch(/Dragon 7!/);
    expect(document.querySelector('[data-side="banker"] [data-tag="dragon7"]')).toBeTruthy();
    expect(document.querySelector('[data-side="banker"]')!.getAttribute('data-total')).toBe('7');
    expect(spot('banker').getAttribute('data-result')).toBe('push');
    expect(spot('dragon7').getAttribute('data-result')).toBe('win');
    expect(spot('player').getAttribute('data-result')).toBe('lose');
    expect(spot('tie').getAttribute('data-result')).toBe('lose');
    expect(spot('banker').textContent).toMatch(/Push/);
    expect(spot('dragon7').textContent).toMatch(/\+\$200/);
    // The pushed Banker chips stay on the felt; the losers have been swept.
    expect(spot('banker').querySelector('[data-total="25"]')).toBeTruthy();
    expect(spot('player').querySelector('[data-total]')).toBeNull();
    expect(screen.getByTestId('settlement-status').textContent).toBe('You won $170');
    expect(tableBankroll()).toBe('$1,170');
    expect(screen.getByTestId('dealer-tip').textContent).toMatch(/Banker bet is a push/);
    // Hand 2 of this seed is a Tie: the main bets push, Tie wins, Dragon 7 loses.
    fireEvent.keyDown(window, { key: 'r' });
    act(() => {
      fireEvent.click(dealButton());
    });
    last = session.getState().lastHand!;
    expect(last.result.outcome).toBe('tie');
    expect(screen.getByTestId('dealer-call').textContent).toMatch(/^Tie, 5 and 5/);
    expect(spot('player').getAttribute('data-result')).toBe('push');
    expect(spot('banker').getAttribute('data-result')).toBe('push');
    expect(spot('tie').getAttribute('data-result')).toBe('win');
    expect(spot('dragon7').getAttribute('data-result')).toBe('lose');
    expect(spot('tie').textContent).toMatch(/\+\$40/);
    expect(screen.getByTestId('settlement-status').textContent).toBe('You won $35');
    expect(tableBankroll()).toBe('$1,205');
    const rows = within(screen.getByTestId('hand-history')).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toMatch(/\+\$35/);
    expect(rows[1].textContent).toMatch(/D7/);
    expect(rows[1].textContent).toMatch(/\+\$170/);
  });

  it('the Dragon 7 moment: overlay, big call, glowing cards, pulsing spot, plaque and pill, tinted history row — all cleared by the next deal', () => {
    const { session } = setup({ bankroll: 1000, seed: 267 });
    fireEvent.click(spot('banker'));
    fireEvent.click(chip(5));
    fireEvent.click(spot('dragon7'));
    act(() => {
      fireEvent.click(dealButton());
    });
    expect(session.getState().lastHand!.result.dragon7).toBe(true);
    const overlay = screen.getByTestId('bonus-celebration');
    expect(overlay.getAttribute('data-kind')).toBe('dragon7');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('felt').contains(overlay)).toBe(true); // inside the felt, clipped by it
    expect(screen.getByText('DRAGON 7')).toBeTruthy();
    expect(screen.getByTestId('bonus-payout').textContent).toBe('Pays 40 to 1 · you won +$200 · Banker bet pushes');
    // The dealer bar sets the call large; the badge is not doubled while the call is the hit itself.
    const call = screen.getByTestId('dealer-call');
    expect(call.querySelector('[data-hit="dragon7"]')!.textContent).toBe('Dragon 7!');
    expect(call.textContent).toBe('Dragon 7!');
    // The three Banker cards glow, the third brightest; the spot, the plaque and the top bar's pill pulse.
    const glows = document.querySelectorAll('[data-side="banker"] [data-glow]');
    expect(glows).toHaveLength(3);
    expect(glows[2].getAttribute('data-glow')).toBe('strong');
    expect(glows[0].getAttribute('data-glow')).toBe('soft');
    expect(document.querySelectorAll('[data-side="player"] [data-glow]')).toHaveLength(0);
    expect(spot('dragon7').getAttribute('data-celebrate')).toBe('true');
    expect(spot('panda8').getAttribute('data-celebrate')).toBeNull();
    expect(screen.getByTestId('table-bankroll').getAttribute('data-celebrate')).toBe('dragon7');
    expect(document.body.getAttribute('data-celebrate')).toBe('dragon7');
    // Settlement went on as usual underneath.
    expect(screen.getByTestId('settlement-status').textContent).toBe('You won $200');
    expect(tableBankroll()).toBe('$1,200');
    // The history row carries the medallion and the tint; the stats counter pulses once.
    const row = within(screen.getByTestId('hand-history')).getAllByRole('listitem')[0];
    expect(row.getAttribute('data-hit')).toBe('dragon7');
    expect(row.querySelector('[data-medallion="dragon7"]')).toBeTruthy();
    expect(row.getAttribute('aria-label')).toMatch(/Dragon 7/);
    fireEvent.click(within(screen.getByTestId('stats-panel')).getByRole('button', { name: /Session stats/ }));
    expect(screen.getByTestId('stat-dragon7').textContent).toBe('1 D7');
    expect(screen.getByTestId('stat-dragon7').getAttribute('data-pulse')).toBeNull(); // the panel just opened: no pulse for an old figure
    // The next deal clears the moment at once (hand 2 of this seed is a Tie).
    fireEvent.keyDown(window, { key: 'r' });
    act(() => {
      fireEvent.click(dealButton());
    });
    expect(session.getState().lastHand!.result.outcome).toBe('tie');
    expect(screen.queryByTestId('bonus-celebration')).toBeNull();
    expect(document.body.hasAttribute('data-celebrate')).toBe(false);
    expect(screen.getByTestId('table-bankroll').getAttribute('data-celebrate')).toBeNull();
    expect(spot('dragon7').getAttribute('data-celebrate')).toBeNull();
    expect(document.querySelectorAll('[data-glow]')).toHaveLength(0);
    expect(screen.getByTestId('dealer-call').querySelector('[data-hit]')).toBeNull();
    expect(screen.getByTestId('stat-dragon7').textContent).toBe('1 D7');
  });

  it('a hit without the bet says so, and a fast-forward clears the moment', () => {
    vi.useFakeTimers();
    prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'fast', sound: false });
    const { session } = setup({ bankroll: 1000, seed: 267 });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.click(spot('player'));
    act(() => {
      fireEvent.click(dealButton());
    });
    expect(session.getState().lastHand!.result.dragon7).toBe(true);
    for (let i = 0; i < 400 && screen.queryByTestId('bonus-celebration') === null; i++) {
      act(() => {
        vi.advanceTimersByTime(25);
      });
    }
    expect(screen.getByTestId('bonus-celebration').getAttribute('data-kind')).toBe('dragon7');
    expect(screen.getByTestId('bonus-payout').textContent).toBe('Pays 40 to 1 · no Dragon 7 bet this hand');
    expect(screen.getByTestId('table-bankroll').getAttribute('data-celebrate')).toBeNull(); // no bet: no jackpot pulse
    expect(document.body.hasAttribute('data-celebrate')).toBe(false);
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('dealing'); // the moment holds before the settlement
    act(() => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(screen.queryByTestId('bonus-celebration')).toBeNull();
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('settled');
    expect(screen.getByTestId('settlement-status').textContent).toBe('You lost $25');
    expect(screen.getByTestId('dealer-call').querySelector('[data-hit="dragon7"]')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId('bonus-celebration')).toBeNull();
  });

  it('at normal speed the third Banker card of a Dragon 7 (the bet down) is squeezed, then turns; the stats counter pulses once it counts', () => {
    vi.useFakeTimers();
    prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'normal', sound: false });
    const { session } = setup({ bankroll: 1000, seed: 267 });
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    fireEvent.click(within(screen.getByTestId('stats-panel')).getByRole('button', { name: /Session stats/ }));
    expect(screen.getByTestId('stat-dragon7').textContent).toBe('0 D7');
    fireEvent.click(spot('banker'));
    fireEvent.click(chip(5));
    fireEvent.click(spot('dragon7'));
    act(() => {
      fireEvent.click(dealButton());
    });
    expect(session.getState().lastHand!.result.dragon7).toBe(true);
    const banker = (): Element => document.querySelector('[data-side="banker"]')!;
    for (let i = 0; i < 1000 && banker().querySelectorAll('[data-dealt]').length < 3; i++) {
      act(() => {
        vi.advanceTimersByTime(25);
      });
    }
    const third = banker().querySelectorAll('[data-dealt]')[2];
    expect(third.getAttribute('data-reveal')).toBe('true');
    expect(third.getAttribute('data-face-down')).toBe('true');
    expect(banker().getAttribute('data-total')).toBe(String(handTotal(session.getState().lastHand!.result.bankerCards.slice(0, 2)))); // the two-card total while it waits
    expect(screen.queryByTestId('bonus-celebration')).toBeNull();
    // The beginner tip (on by default) must not give the face-down card away before it turns.
    expect(screen.getByTestId('dealer-tip').textContent).toMatch(/Banker’s third card is squeezed: it could still make a Dragon 7\.$/);
    expect(screen.getByTestId('dealer-tip').textContent).not.toMatch(/third card is \S+ \(|→/);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(banker().getAttribute('data-total')).toBe('7');
    expect(third.hasAttribute('data-face-down')).toBe(false);
    expect(screen.getByTestId('dealer-tip').textContent).toMatch(/Banker’s third card is .* → 7\./);
    for (let i = 0; i < 400 && screen.queryByTestId('bonus-celebration') === null; i++) {
      act(() => {
        vi.advanceTimersByTime(25);
      });
    }
    expect(screen.getByTestId('bonus-celebration').getAttribute('data-stage')).toBe('in');
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('dealing');
    expect(screen.getByTestId('stat-dragon7').textContent).toBe('0 D7'); // not counted before the settlement
    act(() => {
      vi.advanceTimersByTime(2700);
    });
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).not.toBe('dealing');
    expect(screen.getByTestId('stat-dragon7').textContent).toBe('1 D7');
    expect(screen.getByTestId('stat-dragon7').getAttribute('data-pulse')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.queryByTestId('bonus-celebration')).toBeNull();
  });

  it('at normal speed every third card that could still make a side bet on the layout is squeezed — misses too — and nothing names it before it turns', () => {
    vi.useFakeTimers();
    prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'normal', sound: false });
    const { session } = setup({ bankroll: 1000, seed: 3 });
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    fireEvent.click(spot('banker'));
    fireEvent.click(chip(5));
    fireEvent.click(spot('dragon7'));
    fireEvent.click(spot('panda8'));
    act(() => {
      fireEvent.click(dealButton());
    });
    // Player 8 6 draws a 6 (4 → 0), Banker 10 6 draws a 5 (6 → 1): either third card could still make a side bet; neither does.
    const result = session.getState().lastHand!.result;
    expect(result).toMatchObject({ playerTotal: 0, bankerTotal: 1, outcome: 'banker', dragon7: false, panda8: false });
    expect(result.playerCards).toHaveLength(3);
    expect(result.bankerCards).toHaveLength(3);
    const area = (s: 'player' | 'banker'): HTMLElement => document.querySelector(`[data-side="${s}"]`) as HTMLElement;
    const dealt = (s: 'player' | 'banker'): HTMLElement[] => Array.from(area(s).querySelectorAll<HTMLElement>('[data-dealt]'));
    const call = (): string => screen.getByTestId('dealer-call').textContent ?? '';
    const tip = (): string => screen.getByTestId('dealer-tip').textContent ?? '';
    const coachTip = (): string => screen.getByTestId('coach-tip').textContent ?? '';
    const seen = (): number => Number(/\((\d+) seen/.exec(screen.getByTestId('coach-panel').textContent ?? '')?.[1]);
    const running = (): string => ['count-dragon7', 'count-panda8'].map((id) => /running (\S+)/.exec(screen.getByTestId(id).textContent ?? '')?.[1]).join(' ');
    const until = (done: () => boolean): void => {
      for (let i = 0; i < 1000 && !done(); i++) {
        act(() => {
          vi.advanceTimersByTime(25);
        });
      }
      expect(done()).toBe(true);
    };
    const names = (el: HTMLElement): string[] => within(el).queryAllByRole('img').map((img) => img.getAttribute('aria-label') ?? '');
    // What the felt's cards announce: every card image not inside an aria-hidden part, in dealing order per side.
    const announced = (): string[] =>
      Array.from(document.querySelectorAll<SVGElement>('[data-dealt] svg[role="img"]'))
        .filter((img) => img.closest('[aria-hidden="true"]') === null)
        .map((img) => img.getAttribute('aria-label') ?? '');
    const historyRows = (): number => screen.queryByTestId('hand-history')?.querySelectorAll('li').length ?? 0;

    until(() => call() === 'Player draws');
    const seenBefore = seen();
    const runningBefore = running();
    const rowsBefore = historyRows();
    expect(seenBefore).toBeGreaterThan(4);
    const [pA, pB, pC] = result.playerCards.map(cardName);
    const [bA, bB, bC] = result.bankerCards.map(cardName);

    // The Player's third card (Panda 8 bet): face down, announced as a face-down card, the totals held, not counted.
    until(() => dealt('player').length === 3);
    const p3 = dealt('player')[2];
    expect(p3.getAttribute('data-reveal')).toBe('true');
    expect(p3.getAttribute('data-face-down')).toBe('true');
    expect(names(p3)).toEqual(['Face-down card']);
    expect(announced()).toEqual([pA, pB, 'Face-down card', bA, bB]);
    expect(area('player').getAttribute('aria-label')).toBe('Player: 3 cards, the third face down, total 4');
    expect(area('player').getAttribute('data-total')).toBe('4');
    expect(call()).toBe('Card to Player');
    expect(tip()).toBe('WhyPlayer’s third card is squeezed: it could still make a Panda 8.');
    expect(coachTip()).toBe('Card to PlayerPlayer’s third card is squeezed: it could still make a Panda 8.');
    expect(seen()).toBe(seenBefore);
    expect(running()).toBe(runningBefore);
    expect(screen.getByTestId('settlement-status').textContent).toBe('');
    expect(historyRows()).toBe(rowsBefore);
    expect(screen.queryByTestId('bonus-celebration')).toBeNull();
    expect(document.querySelectorAll('[data-glow]')).toHaveLength(0);

    // It turns: named, counted, the total called — and nothing left of the squeeze but the finished turn.
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(p3.hasAttribute('data-face-down')).toBe(false);
    expect(names(p3)).toEqual([pC]);
    expect(announced()).toEqual([pA, pB, pC, bA, bB]);
    expect(area('player').getAttribute('aria-label')).toBe('Player: 3 cards, total 0');
    expect(area('player').getAttribute('data-total')).toBe('0');
    expect(tip()).toMatch(/^WhyPlayer’s third card is 6. \(6 counts 6\): 4 \+ 6 → 0\./);
    expect(seen()).toBe(seenBefore + 1);
    expect(document.querySelectorAll('[data-glow]')).toHaveLength(0);

    // The Banker's third card (Dragon 7 bet, Player 0): squeezed in its turn.
    until(() => dealt('banker').length === 3);
    const b3 = dealt('banker')[2];
    expect(b3.getAttribute('data-face-down')).toBe('true');
    expect(names(b3)).toEqual(['Face-down card']);
    expect(announced()).toEqual([pA, pB, pC, bA, bB, 'Face-down card']);
    expect(p3.getAttribute('data-reveal')).toBe('true'); // the Player's card keeps its finished turn
    expect(p3.hasAttribute('data-face-down')).toBe(false);
    expect(area('banker').getAttribute('aria-label')).toBe('Banker: 3 cards, the third face down, total 6');
    expect(area('banker').getAttribute('data-total')).toBe('6');
    expect(call()).toBe('Card to Banker');
    expect(tip()).toBe('WhyBanker’s third card is squeezed: it could still make a Dragon 7.');
    expect(seen()).toBe(seenBefore + 1);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(b3.hasAttribute('data-face-down')).toBe(false);
    expect(names(b3)).toEqual([bC]);
    expect(announced()).toEqual([pA, pB, pC, bA, bB, bC]);
    expect(area('banker').getAttribute('data-total')).toBe('1');
    expect(seen()).toBe(seenBefore + 2);
    expect(document.querySelectorAll('[data-face-down="true"][data-dealt]')).toHaveLength(0);

    // A miss settles like any hand: no moment, no glow, no hit in the history.
    until(() => screen.getByTestId('settlement-status').textContent !== '');
    expect(screen.getByTestId('settlement-status').textContent).toBe('You won $15'); // Banker +$25, both side bets −$5
    expect(screen.queryByTestId('bonus-celebration')).toBeNull();
    expect(document.querySelectorAll('[data-glow]')).toHaveLength(0);
    expect(screen.getByTestId('dealer-call').querySelector('[data-hit]')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(within(screen.getByTestId('hand-history')).getAllByRole('listitem')[0].hasAttribute('data-hit')).toBe(false);
  });

  it('without a Dragon 7 or Panda 8 bet nothing is squeezed: the same third cards land face up and are called at once', () => {
    vi.useFakeTimers();
    prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'normal', sound: false });
    setup({ bankroll: 1000, seed: 3 });
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    fireEvent.click(spot('banker'));
    act(() => {
      fireEvent.click(dealButton());
    });
    const area = (s: 'player' | 'banker'): HTMLElement => document.querySelector(`[data-side="${s}"]`) as HTMLElement;
    const dealt = (s: 'player' | 'banker'): HTMLElement[] => Array.from(area(s).querySelectorAll<HTMLElement>('[data-dealt]'));
    for (const [s, total] of [['player', '0'], ['banker', '1']] as const) {
      for (let i = 0; i < 1000 && dealt(s).length < 3; i++) {
        act(() => {
          vi.advanceTimersByTime(25);
        });
      }
      expect(dealt(s)).toHaveLength(3);
      expect(dealt(s)[2].hasAttribute('data-reveal')).toBe(false);
      expect(dealt(s)[2].hasAttribute('data-face-down')).toBe(false);
      expect(area(s).getAttribute('data-total')).toBe(total);
      expect(screen.getByTestId('dealer-tip').textContent).toMatch(/third card is \S+ \(/);
    }
    expect(document.querySelectorAll('[data-reveal]')).toHaveLength(0);
  });

  it('a speed change while a hand plays applies from the next hand: a squeezed card still turns just as its total is called', () => {
    vi.useFakeTimers();
    prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'normal', sound: false });
    setup({ bankroll: 1000, seed: 3 });
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    fireEvent.click(spot('banker'));
    fireEvent.click(chip(5));
    fireEvent.click(spot('dragon7'));
    fireEvent.click(spot('panda8'));
    act(() => {
      fireEvent.click(dealButton());
    });
    // Seed 3, hand 1: Player 8 6 draws a 6 (4 → 0), Banker 10 6 draws a 5 (6 → 1) — both third cards squeezed.
    const area = (s: 'player' | 'banker'): HTMLElement => document.querySelector(`[data-side="${s}"]`) as HTMLElement;
    const dealt = (s: 'player' | 'banker'): HTMLElement[] => Array.from(area(s).querySelectorAll<HTMLElement>('[data-dealt]'));
    let faceDownSeen = false;
    const until = (done: () => boolean): void => {
      for (let i = 0; i < 1000 && !done(); i++) {
        act(() => {
          vi.advanceTimersByTime(25);
        });
        if (document.querySelector('[data-dealt][data-face-down]')) faceDownSeen = true;
      }
      expect(done()).toBe(true);
    };
    const speed = (dealSpeed: 'slow' | 'fast'): void => {
      act(() => {
        prefsStore.set({ ...DEFAULT_PREFS, dealSpeed, sound: false });
      });
    };

    // Slow is chosen while the first cards are dealt: the Player's card still lands with the normal pace of its hand,
    // so it turns as the total is called, not 0.7 s later.
    speed('slow');
    until(() => dealt('player').length === 3);
    const p3 = dealt('player')[2];
    expect(p3.getAttribute('data-face-down')).toBe('true');
    expect(p3.style.getPropertyValue('--reveal-ms')).toBe(`${revealMs(650)}ms`);
    expect(p3.style.getPropertyValue('--deal-ms')).toBe(`${dealDurationMs(650)}ms`);
    act(() => {
      vi.advanceTimersByTime(revealMs(650) + 10);
    });
    expect(p3.hasAttribute('data-face-down')).toBe(false);
    expect(area('player').getAttribute('data-total')).toBe('0');

    // Fast is chosen while the Banker's card lies face down: it stays face down, its total held, until the call.
    until(() => dealt('banker').length === 3);
    const b3 = dealt('banker')[2];
    speed('fast');
    const waiting = (): void => {
      expect(b3.getAttribute('data-face-down')).toBe('true');
      expect(b3.getAttribute('data-reveal')).toBe('true');
      expect(within(b3).getAllByRole('img').filter((img) => img.closest('[aria-hidden="true"]') === null).map((img) => img.getAttribute('aria-label'))).toEqual(['Face-down card']);
      expect(area('banker').getAttribute('aria-label')).toBe('Banker: 3 cards, the third face down, total 6');
      expect(area('banker').getAttribute('data-total')).toBe('6');
    };
    waiting();
    act(() => {
      vi.advanceTimersByTime(revealMs(650) - 120);
    });
    waiting();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(b3.hasAttribute('data-face-down')).toBe(false);
    expect(area('banker').getAttribute('data-total')).toBe('1');

    // The next hand is dealt at the new speed: fast cards, nothing squeezed.
    until(() => /^Deal/.test(dealButton().textContent ?? ''));
    fireEvent.click(screen.getByTestId('rebet-button'));
    act(() => {
      fireEvent.click(dealButton());
    });
    faceDownSeen = false;
    until(() => dealt('player').length >= 1);
    expect(dealt('player')[0].style.getPropertyValue('--deal-ms')).toBe(`${dealDurationMs(300)}ms`);
    until(() => /^Deal/.test(dealButton().textContent ?? ''));
    expect(faceDownSeen).toBe(false);
    expect(document.querySelectorAll('[data-reveal]')).toHaveLength(0);
  });

  it('DEAL / Space while a hand plays fast-forwards it without complaining about a missing bet, and deals at once from a shuffle when chips are down', () => {
    vi.useFakeTimers();
    prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'fast', sound: false });
    const { session } = setup({ bankroll: 1000, seed: 42 });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('dealer-call').textContent).toBe('New shoe — place your bets');
    fireEvent.click(spot('banker'));
    act(() => {
      fireEvent.click(dealButton());
    });
    expect(dealButton().textContent).toMatch(/Fast forward/);
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('dealing');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    act(() => {
      fireEvent.keyDown(window, { key: ' ' });
    });
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('settled');
    expect(screen.queryByTestId('notice')).toBeNull();
    expect(session.getState().totalHands).toBe(1);
    expect(screen.getByTestId('settlement-status').textContent).toMatch(/You won|You lost|Push/);
    // Next hand: press DEAL once the settlement is revealed but before the sweep — no notice, no phantom deal.
    fireEvent.keyDown(window, { key: 'r' });
    act(() => {
      fireEvent.click(dealButton());
    });
    for (let i = 0; i < 200 && screen.getByTestId('play-view').getAttribute('data-phase') !== 'settling'; i++) {
      act(() => {
        vi.advanceTimersByTime(25);
      });
    }
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('settling');
    act(() => {
      fireEvent.click(dealButton());
    });
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('settled');
    expect(screen.queryByTestId('notice')).toBeNull();
    expect(session.getState().totalHands).toBe(2);
    // A shuffle with chips already on the layout: skipping it deals straight away.
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.click(screen.getByTestId('new-shoe-button'));
    fireEvent.click(screen.getByTestId('confirm-new-shoe'));
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('shuffling');
    expect(dealButton().textContent).toMatch(/Skip/);
    act(() => {
      fireEvent.click(dealButton());
    });
    expect(session.getState().totalHands).toBe(3);
    expect(session.getState().shoe.shoeNumber).toBe(2);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.queryByTestId('notice')).toBeNull();
  });

  it('a rules change while a hand plays finishes and records that hand, then shuffles the new shoe', () => {
    vi.useFakeTimers();
    prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'fast', sound: false });
    const { session } = setup({ bankroll: 1000, seed: 42 });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.click(spot('banker'));
    act(() => {
      fireEvent.click(dealButton());
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('dealing');
    act(() => {
      rulesStore.set(RULE_PRESETS.commission.rules);
    });
    expect(session.getState().rules.bankerRule).toBe('commission');
    expect(session.getState().shoe.shoeNumber).toBe(2);
    expect(within(screen.getByTestId('hand-history')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('shuffling');
    expect(screen.getByTestId('dealer-call').textContent).toBe('Shuffling shoe 2…');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('dealer-call').textContent).toBe('New shoe — place your bets');
    expect(screen.getByTestId('commission-box')).toBeTruthy();
    expect(spot('dragon7')).toBeNull();
    expect(screen.getByText('Hand 0')).toBeTruthy();
  });
});

describe('PlayView — table variants and controls', () => {
  it('shows the commission box for the classic rule and hides the EZ side bets', () => {
    rulesStore.set(RULE_PRESETS.commission.rules);
    setup({ bankroll: 1000, seed: 1 });
    expect(getSession().getState().rules.bankerRule).toBe('commission');
    expect(screen.getByTestId('commission-box').textContent).toMatch(/Commission 5%/);
    expect(spot('dragon7')).toBeNull();
    expect(spot('panda8')).toBeNull();
    expect(spot('banker').textContent).toMatch(/5% commission/i);
    expect(spot('player').textContent).toMatch(/push on tie/i);
  });

  it('a session reset while a hand is still playing records nothing for the old hand', () => {
    vi.useFakeTimers();
    prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'fast', sound: false });
    const { session } = setup({ bankroll: 1000, seed: 42 });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.click(spot('banker'));
    act(() => {
      fireEvent.click(dealButton());
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('play-view').getAttribute('data-phase')).toBe('dealing');
    act(() => {
      session.reset({ bankroll: 500, seed: 99 });
    });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(session.getState().totalHands).toBe(0);
    expect(screen.queryByTestId('hand-history')).toBeNull();
    expect(screen.getByText('Hand 0')).toBeTruthy();
    expect(tableBankroll()).toBe('$500');
    expect(screen.getByTestId('settlement-status').textContent).toBe('');
  });

  it('New shoe asks for confirmation once hands were dealt, then shuffles', () => {
    const { session } = setup({ bankroll: 1000, seed: 9 });
    fireEvent.click(screen.getByTestId('new-shoe-button'));
    expect(session.getState().shoe.shoeNumber).toBe(2);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(spot('banker'));
    act(() => {
      fireEvent.click(dealButton());
    });
    fireEvent.click(screen.getByTestId('new-shoe-button'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('confirm-new-shoe'));
    expect(session.getState().shoe.shoeNumber).toBe(3);
    expect(session.getState().shoeHistory).toHaveLength(0);
    expect(screen.getByTestId('dealer-call').textContent).toBe('New shoe — place your bets');
  });

  it('Buy-in opens the bankroll settings and the speed selector persists the preference', () => {
    setup();
    fireEvent.click(screen.getByTestId('buy-in-button'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTestId('set-bankroll')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.change(screen.getByLabelText('Dealing speed'), { target: { value: 'fast' } });
    expect(prefsStore.get().dealSpeed).toBe('fast');
    expect(totalOnLayout(getSession().getState().bets)).toBe(0);
  });
});
