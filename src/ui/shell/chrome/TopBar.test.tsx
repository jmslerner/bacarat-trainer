// @vitest-environment jsdom
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BankrollPill } from './TopBar';
import { resetSession } from '../hooks/useSession';
import { publishDisplayedBankroll } from '../hooks/useDisplayedBankroll';
import { buyInStore, prefsStore, rulesStore } from '../hooks/useSettings';

function mockMatchMedia(phone: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: phone && q.includes('640'),
      media: q,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  window.localStorage.clear();
  rulesStore.reset();
  prefsStore.reset();
  buyInStore.reset();
});
afterEach(() => {
  cleanup();
  publishDisplayedBankroll(null);
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('BankrollPill', () => {
  it('shows the exact bankroll on desktop', () => {
    mockMatchMedia(false);
    resetSession({ bankroll: 1234567.5, seed: 1 });
    render(<BankrollPill onClick={() => undefined} />);
    expect(screen.getByTestId('bankroll-pill')).toHaveTextContent('$1,234,567.50');
  });

  it('shows seven-figure bankrolls compact on phones while keeping the exact figure accessible', () => {
    mockMatchMedia(true);
    resetSession({ bankroll: 1234567.5, seed: 1 });
    render(<BankrollPill onClick={() => undefined} />);
    const pill = screen.getByTestId('bankroll-pill');
    expect(pill).toHaveTextContent('$1.23M');
    expect(pill).toHaveAttribute('title', '$1,234,567.50');
    expect(pill).toHaveAccessibleName(/\$1,234,567\.50/);
    expect(pill).not.toHaveAccessibleName(/1\.23M/);
  });

  it('keeps six-figure bankrolls exact on phones', () => {
    mockMatchMedia(true);
    resetSession({ bankroll: 123456.5, seed: 1 });
    render(<BankrollPill onClick={() => undefined} />);
    expect(screen.getByTestId('bankroll-pill')).toHaveTextContent('$123,456.50');
  });

  it('follows the figure the table displays while a hand plays, then the live session again', () => {
    mockMatchMedia(false);
    const session = resetSession({ bankroll: 1000, seed: 1 });
    render(<BankrollPill onClick={() => undefined} />);
    const pill = screen.getByTestId('bankroll-pill');
    expect(pill).toHaveTextContent('$1,000');
    expect(pill).not.toHaveTextContent(/[+-]\$/);

    // The table holds the pre-deal figure while it deals; the session has already settled the hand.
    act(() => publishDisplayedBankroll({ bankroll: 1000, net: 0 }));
    act(() => {
      session.placeBet('banker', 25);
      session.deal();
    });
    const settled = session.getState();
    expect(settled.lastHand).not.toBeNull();
    expect(pill).toHaveTextContent('$1,000');
    expect(pill).toHaveAttribute('data-value', '1000');
    expect(pill).not.toHaveTextContent(/[+-]\$/);

    // The count-up: the pill shows what the table shows, net included.
    act(() => publishDisplayedBankroll({ bankroll: 1012.5, net: 12.5 }));
    expect(pill).toHaveTextContent('$1,012.50');
    expect(pill).toHaveTextContent('+$12.50');

    // Nothing published (the table unmounted): back to the live session.
    act(() => publishDisplayedBankroll(null));
    expect(pill).toHaveAttribute('data-value', String(settled.bankroll));
    if (settled.stats.net !== 0) expect(pill).toHaveTextContent(settled.stats.net > 0 ? '+$' : '-$');
  });
});
