// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_RULES } from '@/engine';
import { ThirdCardExplorer } from './ThirdCardExplorer';

afterEach(cleanup);

function pick(groupName: RegExp, value: number): void {
  const group = screen.getByRole('radiogroup', { name: groupName });
  fireEvent.click(within(group).getByRole('radio', { name: String(value) }));
}

describe('ThirdCardExplorer', () => {
  it('explains Banker 3 against a Player third card of 8 (stands) and 9 (draws)', () => {
    render(<ThirdCardExplorer rules={DEFAULT_RULES} />);
    pick(/player two-card total/i, 5);
    pick(/banker two-card total/i, 3);
    expect(screen.getByText(/Player draws — now pick/i)).toBeInTheDocument();
    pick(/value of the player’s third card/i, 8);
    expect(document.querySelector('[data-verdict]')).toHaveAttribute('data-verdict', 'stands');
    expect(screen.getByText(/so the Banker stands/i)).toBeInTheDocument();
    pick(/value of the player’s third card/i, 9);
    expect(document.querySelector('[data-verdict]')).toHaveAttribute('data-verdict', 'draws');
    expect(screen.getByText(/so the Banker draws/i)).toBeInTheDocument();
    // Finishing the hand deals it through the engine: 5+9 → 4 for Player, 3+4 → 7 for Banker: a Dragon 7.
    pick(/value of the banker’s third card/i, 4);
    const result = document.querySelector('[data-explorer-result]');
    expect(result).toHaveTextContent('Banker wins, 7 over 4');
    expect(result).toHaveTextContent('Dragon 7!');
  });

  it('handles the Player standing and naturals', () => {
    render(<ThirdCardExplorer rules={DEFAULT_RULES} />);
    pick(/player two-card total/i, 6);
    pick(/banker two-card total/i, 5);
    expect(document.querySelector('[data-verdict]')).toHaveTextContent('Player stands · Banker draws');
    expect(screen.queryByRole('radiogroup', { name: /player’s third card/i })).not.toBeInTheDocument();
    pick(/player two-card total/i, 8);
    expect(screen.getByText(/natural — both hands stand/i)).toBeInTheDocument();
  });

  it('resets', () => {
    render(<ThirdCardExplorer rules={DEFAULT_RULES} />);
    pick(/player two-card total/i, 2);
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByText(/pick the player and banker two-card totals/i)).toBeInTheDocument();
  });
});
