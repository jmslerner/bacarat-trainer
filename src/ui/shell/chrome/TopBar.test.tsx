// @vitest-environment jsdom
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BankrollPill } from './TopBar';
import { resetSession } from '../hooks/useSession';
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
});
