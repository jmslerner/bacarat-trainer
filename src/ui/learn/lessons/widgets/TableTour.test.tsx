// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_RULES, RULE_PRESETS } from '@/engine';
import { TableTour } from './TableTour';

afterEach(cleanup);

const desc = (): HTMLElement => document.querySelector('[data-tour-desc]') as HTMLElement;

describe('TableTour', () => {
  it('describes a betting spot with its payout, limits and house edge', () => {
    render(<TableTour rules={DEFAULT_RULES} />);
    fireEvent.click(document.querySelector('[data-spot="banker"]') as HTMLElement);
    expect(desc()).toHaveTextContent('BANKER');
    expect(desc()).toHaveTextContent('no commission');
    expect(desc()).toHaveTextContent('1.02%');
    expect(desc()).toHaveTextContent('$10–$5,000');
    fireEvent.click(document.querySelector('[data-spot="dragon7"]') as HTMLElement);
    expect(desc()).toHaveTextContent('40:1');
    expect(desc()).toHaveTextContent('7.61%');
    expect(desc()).toHaveTextContent('$5–$500');
  });

  it('runs the guided tour in order', () => {
    render(<TableTour rules={DEFAULT_RULES} />);
    fireEvent.click(screen.getByRole('button', { name: /start tour/i }));
    expect(desc()).toHaveTextContent('PLAYER');
    expect(document.querySelector('[data-spot="playerArea"]')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(desc()).toHaveTextContent('BANKER');
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(desc()).toHaveTextContent('PLAYER');
  });

  it('marks bets the table does not deal', () => {
    render(<TableTour rules={RULE_PRESETS.commission.rules} />);
    fireEvent.click(document.querySelector('[data-spot="panda8"]') as HTMLElement);
    expect(desc()).toHaveTextContent('not dealt at this table');
    fireEvent.click(document.querySelector('[data-spot="commission"]') as HTMLElement);
    expect(desc()).toHaveTextContent('5% commission');
  });
});
