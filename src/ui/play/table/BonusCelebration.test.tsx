// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef, type ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { BonusCelebration, FADE_MS, bannerCentre, payoutLine } from './BonusCelebration';
import type { Celebration } from '../animation/types';

const dragonWon: Celebration = { id: 'dragon7-1', kind: 'dragon7', side: 'banker', pays: 40, won: 200, offered: true, hadBet: true, bankerPush: true, holdMs: 2600 };
const dragonNoBet: Celebration = { ...dragonWon, id: 'dragon7-2', won: 0, hadBet: false, bankerPush: false };
const dragonBankerOnly: Celebration = { ...dragonWon, id: 'dragon7-3', won: 0, hadBet: false, bankerPush: true };
const pandaWon: Celebration = { id: 'panda8-1', kind: 'panda8', side: 'player', pays: 25, won: 125, offered: true, hadBet: true, bankerPush: false, holdMs: 1200 };

let contexts = 0;
beforeEach(() => {
  contexts = 0;
  // jsdom has no canvas: the particle layer must cope with a missing 2D context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    contexts += 1;
    return null;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('bannerCentre', () => {
  it('centres the banner over the visible part of the felt, below the sticky top bar, and keeps it inside the felt', () => {
    // The whole felt on screen: its own middle.
    expect(bannerCentre(120, 600, 900)).toBeCloseTo(0.5, 2);
    // A phone, scrolled to the DEAL button: the felt starts 460px above the viewport and 140px of it show under a
    // 100px top bar — the banner hugs the visible bottom, no lower than 80% of the felt.
    expect(bannerCentre(-460, 700, 800, 100)).toBeCloseTo(0.8, 2);
    // Half scrolled: the visible part is 100..600 → its middle, 350, is 450px down a 700px felt.
    expect(bannerCentre(-100, 700, 800, 100)).toBeCloseTo(450 / 700, 3);
    // Nothing of it on screen (or nothing measurable): the felt's own middle.
    expect(bannerCentre(-750, 700, 800, 100)).toBe(0.46);
    expect(bannerCentre(0, 0, 800)).toBe(0.46);
    expect(bannerCentre(50, 700, 0)).toBe(0.46);
    // Only the top of the felt is above the fold: high, but no higher than 25%.
    expect(bannerCentre(600, 700, 800)).toBe(0.25);
  });

  it('with the banner measured, sits just below the cards, wholly on screen and inside the felt', () => {
    // A 1440×900 laptop at the top of the page: the felt runs from 140 past the fold, the cards end at 425 — the
    // 236px plaque goes right under them (top at 435), over the dealer's call.
    const desktop = bannerCentre(140, 760, 900, 64, 236, 425);
    expect(140 + desktop * 760 - 118).toBeCloseTo(435, 3);
    // Scrolled down to the DEAL button: 249px of the felt show between the 64px top bar and the felt's bottom (313).
    // The old placement (80% of the felt) put the plaque's top at 43, under the top bar; now it is centred on what
    // shows and stays inside the felt.
    const scrolled = bannerCentre(-447, 760, 900, 64, 236, -167);
    const top = -447 + scrolled * 760 - 118;
    expect(top).toBeGreaterThanOrEqual(64);
    expect(top + 236).toBeLessThanOrEqual(313);
    // A 380×800 phone at the top: the hands end at 480, the 166px plaque sits under them, clear of the cards.
    const phone = bannerCentre(175, 1100, 800, 100, 166, 480);
    expect(175 + phone * 1100 - 83).toBeCloseTo(490, 3);
    // The cards scrolled up under the top bar: the plaque comes down to just below the bar, not under it.
    const cardsGone = bannerCentre(-300, 1100, 800, 100, 166, 5);
    expect(-300 + cardsGone * 1100 - 83).toBeCloseTo(110, 3);
    // Cards near the bottom of the screen: the plaque is lifted so its bottom stays on screen.
    const low = bannerCentre(100, 1100, 800, 64, 166, 760);
    expect(100 + low * 1100 + 83).toBeCloseTo(790, 3);
    // No cards to go by: the middle of what is on screen.
    expect(bannerCentre(120, 600, 900, 0, 200)).toBeCloseTo(0.5, 3);
    // A felt shorter than the plaque: its own middle. None of the felt on screen: the felt's middle, as before.
    expect(bannerCentre(100, 150, 900, 0, 236, 120)).toBe(0.5);
    expect(bannerCentre(-900, 700, 800, 100, 236, -500)).toBe(0.46);
  });
});

describe('BonusCelebration', () => {
  it('renders the Dragon medallion, title, rule and the payout of a won bet with the EZ Banker push', () => {
    render(<BonusCelebration celebration={dragonWon} />);
    const overlay = screen.getByTestId('bonus-celebration');
    expect(overlay.getAttribute('data-kind')).toBe('dragon7');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.querySelector('[data-medallion="dragon7"]')).toBeTruthy();
    expect(screen.getByText('DRAGON 7')).toBeTruthy();
    expect(screen.getByText('Banker wins with a three-card 7')).toBeTruthy();
    expect(screen.getByTestId('bonus-payout').textContent).toBe('Pays 40 to 1 · you won +$200 · Banker bet pushes');
    expect(payoutLine(dragonWon)).toBe('Pays 40 to 1 · you won +$200 · Banker bet pushes');
    expect(screen.getByTestId('bonus-particles')).toBeTruthy();
    expect(contexts).toBe(1);
  });

  it('says so when there was no Dragon 7 bet, with or without a Banker bet pushing', () => {
    render(<BonusCelebration celebration={dragonNoBet} />);
    expect(screen.getByTestId('bonus-payout').textContent).toBe('Pays 40 to 1 · no Dragon 7 bet this hand');
    cleanup();
    render(<BonusCelebration celebration={dragonBankerOnly} />);
    expect(screen.getByTestId('bonus-payout').textContent).toBe('Pays 40 to 1 · no Dragon 7 bet this hand · Banker bet pushes');
  });

  it('at an EZ table without the Dragon 7 bet, only the Banker push is news — no odds for a bet that is not there', () => {
    render(<BonusCelebration celebration={{ ...dragonBankerOnly, id: 'dragon7-4', offered: false }} />);
    expect(screen.getByTestId('bonus-payout').textContent).toBe('Banker bet pushes');
    expect(payoutLine({ ...dragonNoBet, offered: false })).toBe('Banker bets push');
  });

  it('places the banner just below the cards it is given', () => {
    const rects: Record<string, { top: number; height: number }> = { 'bonus-celebration': { top: 140, height: 760 }, cards: { top: 200, height: 225 } };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const r = rects[this.dataset.testid ?? ''] ?? { top: 0, height: 0 };
      return { top: r.top, bottom: r.top + r.height, height: r.height, left: 0, right: 900, width: 900, x: 0, y: r.top, toJSON: () => ({}) } as DOMRect;
    });
    const offset = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === 'bonus-banner' ? 236 : 0;
    });
    const height = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
    function Table({ celebration }: { celebration: Celebration | null }): ReactNode {
      const cardsRef = useRef<HTMLDivElement>(null);
      return (
        <div>
          <div ref={cardsRef} data-testid="cards" />
          <BonusCelebration celebration={celebration} cardsRef={cardsRef} />
        </div>
      );
    }
    render(<Table celebration={dragonWon} />);
    // Cards end at 425: the plaque's centre is 425 + 10 + 118 = 553px, (553 − 140) / 760 of the felt.
    expect(screen.getByTestId('bonus-celebration').style.getPropertyValue('--fx-centre')).toBe(`${(((553 - 140) / 760) * 100).toFixed(1)}%`);
    expect(offset).toHaveBeenCalled();
    expect(height).toHaveBeenCalled();
  });

  it('a new moment while the last banner is still up is a new element, so its entrance plays again', () => {
    const { rerender } = render(<BonusCelebration celebration={dragonWon} />);
    const first = screen.getByTestId('bonus-celebration');
    rerender(<BonusCelebration celebration={dragonWon} />);
    expect(screen.getByTestId('bonus-celebration')).toBe(first); // a re-render keeps it
    rerender(<BonusCelebration celebration={{ ...dragonWon, id: 'dragon7-9' }} />);
    expect(screen.getByTestId('bonus-celebration')).not.toBe(first);
    expect(screen.getByTestId('bonus-celebration').getAttribute('data-stage')).toBe('in');
  });

  it('renders the Panda medallion and payout', () => {
    render(<BonusCelebration celebration={pandaWon} />);
    expect(screen.getByTestId('bonus-celebration').getAttribute('data-kind')).toBe('panda8');
    expect(screen.getByTestId('bonus-celebration').querySelector('[data-medallion="panda8"]')).toBeTruthy();
    expect(screen.getByText('PANDA 8')).toBeTruthy();
    expect(screen.getByText('Player wins with a three-card 8')).toBeTruthy();
    expect(screen.getByTestId('bonus-payout').textContent).toBe('Pays 25 to 1 · you won +$125');
  });

  it('with reduced motion there is no canvas and no flash, only the banner', () => {
    render(<BonusCelebration celebration={dragonWon} reducedMotion />);
    expect(screen.queryByTestId('bonus-particles')).toBeNull();
    expect(contexts).toBe(0);
    const overlay = screen.getByTestId('bonus-celebration');
    expect(overlay.childElementCount).toBe(1);
    expect(screen.getByTestId('bonus-banner')).toBeTruthy();
    expect(screen.getByText('DRAGON 7')).toBeTruthy();
  });

  it('honours the prefers-reduced-motion query by itself', () => {
    const mql = { matches: true, addEventListener: () => undefined, removeEventListener: () => undefined };
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...mql, matches: q.includes('reduced-motion') })) as unknown as typeof window.matchMedia;
    try {
      render(<BonusCelebration celebration={pandaWon} />);
      expect(screen.queryByTestId('bonus-particles')).toBeNull();
      expect(screen.getByText('PANDA 8')).toBeTruthy();
    } finally {
      window.matchMedia = original;
    }
  });

  it('fades at the end of the hold and is gone after it; a re-render does not restart it; clearing it unmounts at once', () => {
    vi.useFakeTimers();
    const { rerender } = render(<BonusCelebration celebration={dragonWon} />);
    expect(screen.getByTestId('bonus-celebration').getAttribute('data-stage')).toBe('in');
    act(() => {
      vi.advanceTimersByTime(2600 - FADE_MS);
    });
    expect(screen.getByTestId('bonus-celebration').getAttribute('data-stage')).toBe('leaving');
    // Same celebration object again (the felt re-rendered for a bankroll tick): nothing restarts.
    rerender(<BonusCelebration celebration={dragonWon} />);
    expect(screen.getByTestId('bonus-celebration').getAttribute('data-stage')).toBe('leaving');
    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });
    expect(screen.queryByTestId('bonus-celebration')).toBeNull();
    // Still the same object: it stays gone.
    rerender(<BonusCelebration celebration={dragonWon} />);
    expect(screen.queryByTestId('bonus-celebration')).toBeNull();
    // A new moment shows again; the next deal (null) removes it immediately.
    rerender(<BonusCelebration celebration={pandaWon} />);
    expect(screen.getByTestId('bonus-celebration').getAttribute('data-kind')).toBe('panda8');
    rerender(<BonusCelebration celebration={null} />);
    expect(screen.queryByTestId('bonus-celebration')).toBeNull();
  });
});
