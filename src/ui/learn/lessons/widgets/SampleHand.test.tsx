// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_RULES, dealFromValues } from '@/engine';
import { SampleHand, explainStep } from './SampleHand';

afterEach(cleanup);

const bar = (): string => document.querySelector('[data-dealer-bar]')?.textContent ?? '';

describe('SampleHand', () => {
  it('steps through the dealer calls of an engine-dealt hand', () => {
    render(<SampleHand rules={DEFAULT_RULES} hands={[{ id: 'h', label: 'Hand', player: [3, 2, 4], banker: [5, 'K', 2] }]} />);
    expect(bar()).toMatch(/Place your bets/);
    const next = screen.getByRole('button', { name: /deal/i });
    fireEvent.click(next);
    expect(bar()).toMatch(/^Card to Player/);
    expect(document.querySelectorAll('[data-card]')).toHaveLength(1);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(document.querySelectorAll('[data-card]')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(bar()).toMatch(/Player shows 5, Banker shows 5/);
    expect(bar()).toMatch(/keep only the last digit/);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(bar()).toMatch(/Player draws/);
    expect(bar()).toMatch(/on 0–5 the Player draws/);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // deal P3
    expect(document.querySelector('[data-rotated]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(bar()).toMatch(/Banker draws/);
    expect(bar()).toMatch(/With 5, the Banker draws when the Player’s third card is 4–7/);
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // deal B3
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(bar()).toMatch(/Player wins, 9 over 7/);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(bar()).toMatch(/Card to Banker/);
    fireEvent.click(screen.getByRole('button', { name: /restart/i }));
    expect(bar()).toMatch(/Place your bets/);
  });

  it('explains bonus steps', () => {
    const dragon = dealFromValues([2, 3, 'A'], [3, 'K', 4], DEFAULT_RULES);
    expect(dragon.dragon7).toBe(true);
    const bonus = dragon.steps.find((s) => s.type === 'bonus');
    expect(bonus).toBeDefined();
    expect(explainStep(bonus!, dragon, DEFAULT_RULES)).toMatch(/THREE-card total of 7.*push.*pays 40 to 1/);
    const panda = dealFromValues([4, 'A', 3], [2, 4], DEFAULT_RULES);
    expect(panda.panda8).toBe(true);
    const natural = dealFromValues(['K', 8], [4, 3], DEFAULT_RULES);
    expect(explainStep(natural.steps.find((s) => s.type === 'natural')!, natural, DEFAULT_RULES)).toMatch(/natural/i);
  });
});
