// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Rank } from '@/engine';
import { PlayingCard, cardName, cardShortLabel, rankText, CARD_SIZES, isRedSuit } from './PlayingCard';

afterEach(cleanup);

describe('PlayingCard', () => {
  it('names cards for assistive tech', () => {
    expect(cardName({ rank: '7', suit: 'H' })).toBe('Seven of Hearts');
    expect(cardName({ rank: 'T', suit: 'S' })).toBe('Ten of Spades');
    expect(cardShortLabel({ rank: 'T', suit: 'S' })).toBe('10♠');
    expect(rankText('T')).toBe('10');
    expect(isRedSuit('D')).toBe(true);
    expect(isRedSuit('C')).toBe(false);
  });

  it('renders a face-up card with corner indices and the right number of pips', () => {
    const { container } = render(<PlayingCard card={{ rank: '7', suit: 'H' }} size="md" />);
    const svg = screen.getByRole('img', { name: 'Seven of Hearts' });
    expect(svg).toHaveAttribute('width', String(CARD_SIZES.md));
    expect(svg).toHaveAttribute('height', String(Math.round(CARD_SIZES.md * 1.4)));
    expect(svg).toHaveAttribute('data-card', '7H');
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(texts.filter((t) => t === '7')).toHaveLength(2);
    // 7 pips + 2 index pips = 9 heart paths
    const hearts = container.querySelectorAll('path[d^="M0 42"]');
    expect(hearts).toHaveLength(9);
  });

  it('shows "10" for tens and ten pips', () => {
    const { container } = render(<PlayingCard card={{ rank: 'T', suit: 'C' }} />);
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(texts.filter((t) => t === '10')).toHaveLength(2);
    // clubs are drawn as groups with circles: 10 pips + 2 index pips → 12 groups × 4 circles
    expect(container.querySelectorAll('circle')).toHaveLength(12 * 4);
  });

  it('draws the right number of pips for every numbered rank in every suit', () => {
    const expected: Record<string, number> = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10 };
    const pathPrefix = { H: 'M0 42', D: 'M0 -48', S: 'M0 -46' } as const;
    for (const suit of ['H', 'D', 'S'] as const) {
      for (const [rank, n] of Object.entries(expected)) {
        const { container, unmount } = render(<PlayingCard card={{ rank: rank as Rank, suit }} />);
        // n pips + the two corner-index pips
        expect(container.querySelectorAll(`path[d^="${pathPrefix[suit]}"]`).length, `${rank}${suit}`).toBe(n + 2);
        unmount();
      }
    }
    for (const [rank, n] of Object.entries(expected)) {
      const { container, unmount } = render(<PlayingCard card={{ rank: rank as Rank, suit: 'C' }} />);
      expect(container.querySelectorAll('circle').length, `${rank}C`).toBe((n + 2) * 4);
      unmount();
    }
    for (const rank of ['J', 'Q', 'K'] as const) {
      const { container, unmount } = render(<PlayingCard card={{ rank, suit: 'H' }} />);
      expect(container.querySelectorAll('path[d^="M0 42"]').length, rank).toBe(4); // two indices + two panel pips, no layout pips
      unmount();
    }
  });

  it('renders court cards with their letter and title', () => {
    const titles = { J: 'JACK', Q: 'QUEEN', K: 'KING' } as const;
    for (const rank of ['J', 'Q', 'K'] as const) {
      const { container, unmount } = render(<PlayingCard card={{ rank, suit: 'D' }} />);
      const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
      expect(texts.filter((t) => t === rank)).toHaveLength(3); // two indices + the court letter
      expect(texts).toContain(titles[rank]);
      unmount();
    }
  });

  it('renders a patterned back when face down and an outline when empty', () => {
    const { container, rerender } = render(<PlayingCard faceDown />);
    expect(screen.getByRole('img', { name: 'Face-down card' })).toHaveAttribute('data-face-down', 'true');
    expect(container.querySelector('pattern')).not.toBeNull();
    expect(container.querySelectorAll('text')).toHaveLength(0);
    rerender(<PlayingCard card={null} />);
    expect(screen.getByRole('img', { name: 'Empty card slot' })).toBeInTheDocument();
  });

  it('rotates third cards: swapped box and a 90° transform', () => {
    render(<PlayingCard card={{ rank: '2', suit: 'S' }} size={100} rotated />);
    const svg = screen.getByRole('img', { name: 'Two of Spades' });
    expect(svg).toHaveAttribute('width', '140');
    expect(svg).toHaveAttribute('height', '100');
    expect(svg).toHaveAttribute('viewBox', '0 0 140 100');
    expect(svg).toHaveAttribute('data-rotated', 'true');
    expect(svg.querySelector('g[transform="translate(140 0) rotate(90)"]')).not.toBeNull();
  });

  it('uses unique pattern ids per instance', () => {
    const { container } = render(
      <>
        <PlayingCard faceDown />
        <PlayingCard faceDown />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('pattern')).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^card-(hatch|back)-[A-Za-z0-9_-]+$/.test(id))).toBe(true);
  });
});
