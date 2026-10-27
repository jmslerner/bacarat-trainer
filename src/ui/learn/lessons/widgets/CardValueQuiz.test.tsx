// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { cardValue, isRank } from '@/engine';
import { CardValueQuiz } from './CardValueQuiz';

afterEach(cleanup);

function shownTotal(): number {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]')).map((el) => el.dataset.card ?? '');
  expect(cards.length).toBeGreaterThanOrEqual(2);
  return cards.reduce((sum, c) => {
    const rank = c.slice(0, -1);
    if (!isRank(rank)) throw new Error(`bad card ${c}`);
    return sum + cardValue(rank);
  }, 0) % 10;
}

describe('CardValueQuiz', () => {
  it('accepts the right total, rejects a wrong one, and keeps score', () => {
    render(<CardValueQuiz seed={7} />);
    const group = screen.getByRole('group', { name: /the total is/i });
    const total = shownTotal();
    fireEvent.click(within(group).getByRole('button', { name: String(total) }));
    expect(screen.getByRole('status')).toHaveTextContent('Correct.');
    expect(screen.getByText(/score/i).parentElement).toHaveTextContent('1 / 1');
    fireEvent.click(screen.getByRole('button', { name: /next cards/i }));
    const t2 = shownTotal();
    const wrong = (t2 + 1) % 10;
    fireEvent.click(within(screen.getByRole('group', { name: /the total is/i })).getByRole('button', { name: String(wrong) }));
    expect(screen.getByRole('status')).toHaveTextContent(`the total is ${t2}`);
    expect(screen.getByText(/score/i).parentElement).toHaveTextContent('1 / 2');
  });

  it('is reproducible with a seed', () => {
    render(<CardValueQuiz seed={3} />);
    const first = Array.from(document.querySelectorAll<HTMLElement>('[data-card]')).map((el) => el.dataset.card);
    cleanup();
    render(<CardValueQuiz seed={3} />);
    const again = Array.from(document.querySelectorAll<HTMLElement>('[data-card]')).map((el) => el.dataset.card);
    expect(again).toEqual(first);
  });
});
