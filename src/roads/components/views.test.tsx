// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { seq } from '../testHelpers';
import type { RoadResult } from '../types';
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

  it('hides the hit pulse under prefers-reduced-motion (the medallion itself is the static state)', () => {
    const css = readFileSync(join(dirname(expect.getState().testPath ?? ''), 'roads.module.css'), 'utf8');
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).toMatch(/\.hitPulse\s*\{[^}]*animation:\s*roads-hit-pulse[^}]*\b3\b/);
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(withoutComments)?.[1] ?? '';
    expect(reduced).toMatch(/\.hitPulse\s*\{[^}]*display:\s*none/);
    expect(reduced).toMatch(/\.ghost\s*\{[^}]*animation:\s*none/);
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

describe('Dragon 7 / Panda 8 markers', () => {
  it('turns a hit bead into a medallion with an accessible name and pulses only the newest hit', () => {
    const results: RoadResult[] = [
      { outcome: 'banker', dragon7: true, bankerPair: true },
      ...seq('P'),
      { outcome: 'player', panda8: true, playerPair: true },
    ];
    const { container, getByRole } = render(<BeadPlateView results={results} />);
    const d7 = container.querySelector('[data-medallion="dragon7"]');
    expect(d7?.getAttribute('data-bead')).toBe('0');
    expect(d7?.getAttribute('data-bonus')).toBe('7');
    expect(getByRole('img', { name: 'Hand 1: Banker, Dragon 7' })).toBe(d7);
    expect(d7?.querySelector('title')?.textContent).toBe('Dragon 7 on hand 1 — Banker wins with a three-card 7');
    expect(d7?.querySelector('[data-pair="banker"]')).not.toBeNull(); // pair dots survive the medallion
    expect(d7?.querySelector('[data-hit-pulse]')).toBeNull(); // an older hit does not pulse

    const p8 = getByRole('img', { name: 'Hand 3: Player, Panda 8' });
    expect(p8.getAttribute('data-medallion')).toBe('panda8');
    expect(p8.getAttribute('data-bonus')).toBe('8');
    expect(p8.querySelector('[data-pair="player"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-hit-pulse]')).toHaveLength(1);
    expect(p8.querySelector('[data-hit-pulse="panda8"]')).not.toBeNull();

    // plain beads are unchanged: no role, no tooltip, just the letter
    const plain = container.querySelector('[data-bead="1"]');
    expect(plain?.hasAttribute('role')).toBe(false);
    expect(plain?.textContent).toBe('P');
  });

  it('does not pulse when the newest hand is not a hit', () => {
    const { container } = render(<BeadPlateView results={[{ outcome: 'banker', dragon7: true }, ...seq('T')]} />);
    expect(container.querySelector('[data-medallion="dragon7"]')).not.toBeNull();
    expect(container.querySelector('[data-hit-pulse]')).toBeNull();
  });

  it('badges the big-road cell and survives a dragon tail with ties and a pair on the cell', () => {
    // Eight Bankers on six rows: the 7th and 8th turn right along row 6. The 8th is a Dragon 7 with a Banker pair
    // and two ties follow it, so the cell carries every mark at once.
    const results: RoadResult[] = [
      ...seq('B'.repeat(7)),
      { outcome: 'banker', dragon7: true, bankerPair: true },
      ...seq('T T'),
    ];
    const { container, getByRole } = render(<BigRoadView results={results} />);
    const cell = getByRole('img', { name: 'Hand 8: Banker, Dragon 7' });
    expect(cell.getAttribute('data-hit')).toBe('dragon7');
    expect(cell.getAttribute('data-ties')).toBe('2');
    expect(cell.querySelector('title')?.textContent).toBe('Dragon 7 on hand 8 — Banker wins with a three-card 7');
    expect(cell.querySelector('[data-tie-mark="2"]')).not.toBeNull();
    expect(cell.querySelector('[data-pair="banker"]')).not.toBeNull();
    expect(cell.querySelector('[data-badge="dragon7"]')).not.toBeNull();
    // drawn last, so no other mark covers it (the newest hand is a tie: no pulse after it)
    expect(cell.lastElementChild?.getAttribute('data-badge')).toBe('dragon7');
    // the cell is the tail cell at (3, 6)
    const ring = cell.querySelector('circle');
    expect(ring?.getAttribute('cx')).toBe(String(2.5 * 20));
    expect(ring?.getAttribute('cy')).toBe(String(5.5 * 20));
    expect(container.querySelectorAll('[data-hit]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-big-cell]')).toHaveLength(8);
  });

  it('pulses the newest big-road hit and keeps the ghost cell plain', () => {
    const results: RoadResult[] = [...seq('P P'), { outcome: 'player', panda8: true }];
    const { container } = render(<BigRoadView results={results} prediction="player" />);
    const hit = container.querySelector('[data-hit="panda8"]');
    expect(hit?.getAttribute('aria-label')).toBe('Hand 3: Player, Panda 8');
    expect(hit?.querySelector('[data-badge="panda8"]')).not.toBeNull();
    expect(hit?.querySelector('[data-hit-pulse="panda8"]')).not.toBeNull();
    const ghost = container.querySelector('[data-ghost]');
    expect(ghost?.hasAttribute('data-hit')).toBe(false);
    expect(ghost?.querySelector('[data-badge]')).toBeNull();
    expect(ghost?.hasAttribute('role')).toBe(false);
  });
});
