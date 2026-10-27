// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_RULES, RULE_PRESETS, totalOnLayout } from '@/engine';
import { buyInStore, DEFAULT_PREFS, getSession, prefsStore, resetSession, rulesStore } from '@/ui/shell';
import { PlayView } from './PlayView';
import { clearHistory } from './history/historyStore';

function setup(opts: { bankroll?: number; seed?: number } = {}) {
  const session = resetSession({ bankroll: opts.bankroll ?? 1000, seed: opts.seed ?? 42 });
  const utils = render(<PlayView />);
  return { session, ...utils };
}

const spot = (bet: string): HTMLButtonElement => document.querySelector(`[data-bet="${bet}"]`) as HTMLButtonElement;
const chip = (value: number): HTMLButtonElement => screen.getByTestId(`chip-${value}`) as HTMLButtonElement;
const dealButton = (): HTMLButtonElement => screen.getByTestId('deal-button') as HTMLButtonElement;
const tableBankroll = (): string => (screen.getByTestId('table-bankroll').querySelector('[data-value]') as HTMLElement).textContent ?? '';

beforeEach(() => {
  window.localStorage.clear();
  rulesStore.reset();
  buyInStore.reset();
  prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: 'instant', sound: false });
  clearHistory();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
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

describe('PlayView — table variants and controls', () => {
  it('shows the commission box for the classic rule and hides the EZ side bets', () => {
    rulesStore.set(RULE_PRESETS.commission.rules);
    setup({ bankroll: 1000, seed: 1 });
    expect(getSession().getState().rules.bankerRule).toBe('commission');
    expect(screen.getByTestId('commission-box').textContent).toMatch(/Commission 5%/);
    expect(spot('dragon7')).toBeNull();
    expect(spot('panda8')).toBeNull();
    expect(spot('banker').textContent).toMatch(/5% commission/i);
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
