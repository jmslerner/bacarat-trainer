// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { seq } from '../testHelpers';
import { BeadPlateView } from './BeadPlateView';
import { BigRoadView } from './BigRoadView';
import { DerivedRoadView } from './DerivedRoadView';

let errorSpy: MockInstance;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

describe('BeadPlateView', () => {
  it('renders one bead per hand with its letter and an accessible label', () => {
    const { container, getByRole } = render(<BeadPlateView results={seq('PBTPP')} />);
    const beads = container.querySelectorAll('[data-bead]');
    expect(beads).toHaveLength(5);
    expect(Array.from(beads).map((b) => b.getAttribute('data-outcome'))).toEqual([
      'player',
      'banker',
      'tie',
      'player',
      'player',
    ]);
    expect(Array.from(beads).map((b) => b.textContent)).toEqual(['P', 'B', 'T', 'P', 'P']);
    expect(getByRole('img', { name: 'Bead plate: 5 hands' })).toBeTruthy();
  });

  it('marks pairs, Dragon 7 and Panda 8', () => {
    const { container } = render(
      <BeadPlateView
        results={[
          { outcome: 'banker', bankerPair: true, dragon7: true },
          { outcome: 'player', playerPair: true, panda8: true },
        ]}
      />,
    );
    expect(container.querySelectorAll('[data-pair="banker"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-pair="player"]')).toHaveLength(1);
    expect(container.querySelector('[data-bonus="7"]')).not.toBeNull();
    expect(container.querySelector('[data-bonus="8"]')).not.toBeNull();
  });

  it('scales with viewBox and grows beyond the visible columns when the shoe is long', () => {
    const { container } = render(<BeadPlateView results={seq('P'.repeat(60))} cols={6} rows={6} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe(`0 0 ${11 * 20} ${6 * 20}`); // 10 full columns + the next one
    expect(svg?.style.width).toBe(`${(11 / 6) * 100}%`);
  });
});

describe('BigRoadView', () => {
  it('renders Player/Banker cells with letters and tie marks', () => {
    const { container, getByRole } = render(<BigRoadView results={seq('P T T P B')} />);
    const cells = container.querySelectorAll('[data-big-cell]');
    expect(cells).toHaveLength(3);
    expect(Array.from(cells).map((c) => c.getAttribute('data-outcome'))).toEqual(['player', 'player', 'banker']);
    expect(cells[0].getAttribute('data-ties')).toBe('2');
    const marks = container.querySelectorAll('[data-tie-mark]');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('2'); // count shown when > 1
    expect(cells[0].textContent).toBe('P2');
    expect(cells[1].textContent).toBe('P');
    expect(getByRole('img', { name: 'Big road: 2 Player, 1 Banker, 2 Tie' })).toBeTruthy();
  });

  it('shows leading ties as a mark at (1,1) and lets the first cell carry the count', () => {
    const onlyTies = render(<BigRoadView results={seq('T T')} />);
    expect(onlyTies.container.querySelector('[data-leading-ties="2"]')).not.toBeNull();
    expect(onlyTies.container.querySelectorAll('[data-big-cell]')).toHaveLength(0);
    cleanup();

    const withCell = render(<BigRoadView results={seq('T T B T')} />);
    expect(withCell.container.querySelector('[data-leading-ties]')).toBeNull();
    const cell = withCell.container.querySelector('[data-big-cell]');
    expect(cell?.getAttribute('data-ties')).toBe('3');
  });

  it('draws a ghost cell for the asked side only when a prediction is set', () => {
    const plain = render(<BigRoadView results={seq('P P B')} />);
    expect(plain.container.querySelector('[data-ghost]')).toBeNull();
    cleanup();

    const asked = render(<BigRoadView results={seq('P P B')} prediction="banker" />);
    const ghost = asked.container.querySelector('[data-ghost]');
    expect(ghost).not.toBeNull();
    expect(ghost?.getAttribute('data-outcome')).toBe('banker');
    expect(asked.container.querySelectorAll('[data-big-cell]')).toHaveLength(3);
  });

  it('keeps the dragon tail and the next column inside the drawn grid', () => {
    const { container } = render(<BigRoadView results={seq('P'.repeat(40))} cols={10} />);
    // 40 Players: 6 down, then 34 to the right → width 35, plus one spare column
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(`0 0 ${36 * 20} ${6 * 20}`);
  });

  it('makes a road that overflows its frame reachable from the keyboard, and only then', () => {
    const long = render(<BigRoadView results={seq('P'.repeat(40))} cols={10} />);
    const frame = long.container.querySelector('[data-road="big"]');
    expect(frame?.getAttribute('tabindex')).toBe('0');
    expect(frame?.getAttribute('role')).toBe('group');
    expect(frame?.getAttribute('aria-label')).toBe('Big road: 40 Player, 0 Banker, 0 Tie (scrolls sideways)');
    cleanup();

    const short = render(<BigRoadView results={seq('P B')} />);
    const plain = short.container.querySelector('[data-road="big"]');
    expect(plain?.hasAttribute('tabindex')).toBe(false);
    expect(plain?.hasAttribute('role')).toBe(false);
  });
});

describe('road frame styling', () => {
  it('lets the SVG grow past its frame: the app\'s global `svg { max-width: 100% }` must not clamp it', () => {
    // Regression guard: with the clamp in place every column of a long shoe is squeezed into the frame and the
    // "auto-scroll to the newest columns" never happens (found with a 140-hand shoe at 380px).
    const css = readFileSync(join(dirname(expect.getState().testPath ?? ''), 'roads.module.css'), 'utf8');
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const svgRule = /\.svg\s*\{([^}]*)\}/.exec(withoutComments)?.[1] ?? '';
    expect(svgRule).toMatch(/max-width:\s*none/);
    // The focusable (overflowing) frame has its own box-shadow, which hides the app's focus ring: it needs one.
    const focusRule = /\.frame:focus-visible\s*\{([^}]*)\}/.exec(withoutComments)?.[1] ?? '';
    expect(focusRule).toMatch(/outline:\s*2px solid/);
  });
});

describe('DerivedRoadView', () => {
  const results = seq('B B P P B P P P B');

  it('renders the hand-derived big eye boy entries as hollow circles', () => {
    const { container } = render(<DerivedRoadView results={results} kind="bigEye" />);
    const cells = container.querySelectorAll('[data-derived-cell]');
    expect(Array.from(cells).map((c) => c.getAttribute('data-color'))).toEqual([
      'red',
      'red',
      'blue',
      'blue',
      'red',
      'blue',
    ]);
    expect(Array.from(cells).every((c) => c.tagName === 'circle' && c.getAttribute('fill') === 'none')).toBe(true);
  });

  it('renders the small road as solid dots and the cockroach pig as slashes', () => {
    const small = render(<DerivedRoadView results={results} kind="small" />);
    const dots = small.container.querySelectorAll('[data-derived-cell]');
    expect(Array.from(dots).map((c) => c.getAttribute('data-color'))).toEqual(['blue', 'red', 'blue', 'blue']);
    expect(Array.from(dots).every((c) => c.tagName === 'circle' && c.getAttribute('fill') === null)).toBe(true);
    cleanup();

    const cockroach = render(<DerivedRoadView results={results} kind="cockroach" />);
    const slashes = cockroach.container.querySelectorAll('[data-derived-cell]');
    expect(Array.from(slashes).map((c) => c.getAttribute('data-color'))).toEqual(['red', 'blue', 'blue']);
    expect(Array.from(slashes).every((c) => c.tagName === 'line')).toBe(true);
    expect(cockroach.getByRole('img', { name: 'Cockroach Pig: 3 entries, 1 red, 2 blue' })).toBeTruthy();
  });

  it('draws a ghost entry for the asked side, or nothing when no entry would be produced', () => {
    const would = render(<DerivedRoadView results={results} kind="bigEye" prediction="banker" />);
    const ghost = would.container.querySelector('[data-ghost]');
    expect(ghost?.getAttribute('data-color')).toBe('red'); // predictNext → bigEye red
    cleanup();

    const none = render(<DerivedRoadView results={seq('B')} kind="small" prediction="player" />);
    expect(none.container.querySelector('[data-ghost]')).toBeNull();
  });
});
