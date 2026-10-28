// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LearnView } from './LearnView';
import { LESSONS } from './lessons/registry';
// Every lesson module is loaded up front, so the routing test below measures routing and not the transform
// time of eight code-split chunks under a loaded parallel run (React.lazy then resolves from the module cache).
import './lessons/basics';
import './lessons/third-card';
import './lessons/bets-and-odds';
import './lessons/dragon-panda';
import './lessons/roads';
import './lessons/money';
import './lessons/counting';
import './lessons/casino-procedure';

function setHash(hash: string): void {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.scrollTo = vi.fn();
  window.location.hash = '#learn';
});
afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('LearnView', () => {
  it('shows the lesson index at #learn with every lesson and the drills', () => {
    render(<LearnView />);
    expect(screen.getByRole('heading', { level: 1, name: /learn baccarat/i })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: /lessons/i });
    for (const l of LESSONS) {
      expect(within(nav).getByRole('link', { name: l.short })).toHaveAttribute('href', `#learn/${l.id}`);
    }
    expect(within(nav).getByRole('link', { name: /drills/i })).toHaveAttribute('href', '#learn/drills');
    expect(within(nav).getByRole('link', { name: /^learn$/i })).toHaveAttribute('aria-current', 'page');
    // Index cards link to the lessons too.
    expect(screen.getAllByRole('link', { name: /lesson 1/i }).length).toBeGreaterThan(0);
  });

  it('routes #learn/<id> to each lesson and marks it current in the sidebar', async () => {
    render(<LearnView />);
    for (const l of LESSONS) {
      setHash(`#learn/${l.id}`);
      const heading = await screen.findByRole('heading', { level: 1, name: l.title }, { timeout: 30000 });
      expect(heading).toBeInTheDocument();
      expect(document.querySelector(`[data-lesson="${l.id}"]`)).toBeInTheDocument();
      const nav = screen.getByRole('navigation', { name: /lessons/i });
      const link = nav.querySelector(`[data-lesson-link="${l.id}"]`);
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
      // The title is set by the lesson's passive effect, which can land a tick after the heading under a loaded run.
      await waitFor(() => expect(document.title).toContain(l.title), { timeout: 5000 });
    }
  }, 120000);

  it('shows a not-found notice for an unknown lesson id', () => {
    render(<LearnView />);
    setHash('#learn/nonsense');
    expect(screen.getByText(/no lesson called/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /all lessons/i })).toHaveAttribute('href', '#learn');
  });

  it('renders the drills hub at #learn/drills without an error', async () => {
    render(<LearnView />);
    setHash('#learn/drills');
    const nav = screen.getByRole('navigation', { name: /lessons/i });
    expect(nav.querySelector('[data-lesson-link="drills"]')).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(screen.queryByText(/loading drills/i)).not.toBeInTheDocument(), { timeout: 15000 });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('[data-drills-unavailable]')).not.toBeInTheDocument();
    expect(document.title).toContain('Drills');
  }, 30000);

  it('links each lesson footer to its own drill under #learn/drills/<id>', async () => {
    render(<LearnView />);
    setHash('#learn/third-card');
    await screen.findByRole('heading', { level: 1, name: /third-card rules/i }, { timeout: 15000 });
    expect(document.querySelector('[data-lesson-drill]')).toHaveAttribute('href', '#learn/drills/third-card');
    setHash('#learn/basics');
    await screen.findByRole('heading', { level: 1, name: /the basics/i }, { timeout: 15000 });
    expect(document.querySelector('[data-lesson-drill]')).not.toBeInTheDocument();
    // The drills route also serves the deep link (the hub reads the third segment itself).
    setHash('#learn/drills/third-card');
    await waitFor(() => expect(screen.queryByText(/loading drills/i)).not.toBeInTheDocument(), { timeout: 15000 });
    expect(screen.getByRole('navigation', { name: /lessons/i }).querySelector('[data-lesson-link="drills"]')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }, 30000);

  it('links to the previous and next lessons from the footer', async () => {
    render(<LearnView />);
    setHash('#learn/third-card');
    await screen.findByRole('heading', { level: 1, name: /third-card rules/i }, { timeout: 15000 });
    const footer = screen.getByRole('navigation', { name: /lesson navigation/i });
    expect(within(footer).getByRole('link', { name: /previous.*the basics/i })).toHaveAttribute('href', '#learn/basics');
    expect(within(footer).getByRole('link', { name: /next.*bets, payouts/i })).toHaveAttribute('href', '#learn/bets-and-odds');
  }, 30000);

  it('persists "mark complete" under bt:learn:completed and shows it in the sidebar', async () => {
    render(<LearnView />);
    setHash('#learn/basics');
    await screen.findByRole('heading', { level: 1, name: /the basics/i }, { timeout: 15000 });
    fireEvent.click(screen.getByRole('button', { name: /mark lesson complete/i }));
    expect(JSON.parse(window.localStorage.getItem('bt:learn:completed') ?? '{}')).toEqual({ basics: true });
    const nav = screen.getByRole('navigation', { name: /lessons/i });
    expect(nav.querySelector('[data-lesson-link="basics"]')).toHaveTextContent('✓');
    expect(screen.getByText(/1 of 8 completed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /completed — click to undo/i }));
    expect(JSON.parse(window.localStorage.getItem('bt:learn:completed') ?? '{}')).toEqual({});
  }, 30000);
});
