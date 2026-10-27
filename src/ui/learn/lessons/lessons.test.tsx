// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_RULES, RULE_PRESETS, applyTableLevel, cloneRules } from '@/engine';
import { rulesStore } from '@/ui/shell';
import { BetsAndOddsLesson } from './bets-and-odds';
import { CasinoProcedureLesson } from './casino-procedure';
import { DragonPandaLesson } from './dragon-panda';
import { RoadsLesson } from './roads';

beforeEach(() => {
  window.localStorage.clear();
  rulesStore.reset();
});
afterEach(() => {
  cleanup();
  rulesStore.reset();
});

const body = (): string => document.body.textContent ?? '';

describe('lesson prose follows the active table rules', () => {
  it('bets-and-odds: every comparison is computed from the engine at the default EZ table', () => {
    render(<BetsAndOddsLesson />);
    expect(body()).toMatch(/A Banker bet costs \$1\.02 per hundred; a Panda 8 bet costs \$10\.19/);
    expect(body()).toMatch(/At 8:1 the Tie is about 14 times as expensive as the Banker bet/);
    expect(body()).toMatch(/about 4\.8 times the Banker bet/);
    // 8 vs 6 decks: (1.0183% − 1.0161%) × $25 × 70 hands ≈ 4 cents, not "less than a cent".
    expect(body()).toMatch(/changes the cost of an hour by about \$0\.04 — a few cents/);
    expect(screen.getByRole('heading', { level: 2, name: /why banker is the best bet/i })).toBeInTheDocument();
    expect(body()).toMatch(/Bet Banker because it is cheapest/);
    expect(body()).toMatch(/Banker, 5% commission/);
  });

  it('bets-and-odds: at a Super 6 table the Player bet is the cheaper one and the lesson says so', () => {
    rulesStore.set(RULE_PRESETS.super6.rules);
    render(<BetsAndOddsLesson />);
    expect(screen.getByRole('heading', { level: 2, name: /banker or player: which is cheaper here/i })).toBeInTheDocument();
    expect(body()).toMatch(/Player is the cheaper bet/);
    expect(body()).not.toMatch(/Bet Banker because it is cheapest/);
    expect(body()).toMatch(/A Banker bet costs \$1\.46 per hundred/);
  });

  it('dragon-panda: the side-bet section and the commission tiles follow the table', () => {
    rulesStore.set({ ...cloneRules(DEFAULT_RULES), dragon7Pays: 41, commissionRate: 0.04 });
    render(<DragonPandaLesson />);
    expect(screen.getByRole('heading', { level: 2, name: /the side bets: 41 to 1 and 25 to 1/i })).toBeInTheDocument();
    expect(body()).toMatch(/4% commission costs/);
    expect(body()).toMatch(/4% × 45\.86% Banker wins/);
  });

  it('casino-procedure: the table-levels section lists the five tiers and marks the current table', () => {
    rulesStore.set(applyTableLevel(DEFAULT_RULES, 'midi'));
    render(<CasinoProcedureLesson />);
    expect(screen.getByRole('heading', { level: 2, name: /table levels in las vegas/i })).toBeInTheDocument();
    const rows = Array.from(document.querySelectorAll('tr[data-level]'));
    expect(rows.map((r) => r.getAttribute('data-level'))).toEqual(['mini', 'floor', 'midi', 'high', 'private']);
    expect(rows.filter((r) => r.hasAttribute('data-active')).map((r) => r.getAttribute('data-level'))).toEqual(['midi']);
    expect(document.querySelector('tr[data-level="midi"]')).toHaveTextContent(/\$100 midi-baccarat · your table\$100–\$25,000\$100–\$5,000\$25–\$2,500The main baccarat pit/);
    expect(document.querySelector('tr[data-level="high"]')).toHaveTextContent(/\$500 high-limit salon\$500–\$100,000\$500–\$10,000\$100–\$5,000Salon play/);
    expect(body()).toMatch(/Your table\$100 midi-baccarat/);
    expect(body()).toMatch(/Posted maximums on the Strip top out around \$25,000 a hand/);
    expect(body()).toMatch(/Pick a table under Settings/);
    // The sections after the new one are renumbered (the number is decorative, the TOC spells it out).
    expect(screen.getByRole('link', { name: '7. Table levels in Las Vegas' })).toHaveAttribute('href', '#learn/casino-procedure/levels');
    expect(screen.getByRole('link', { name: '10. EZ, classic and Super 6' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'EZ, classic and Super 6' })).toBeInTheDocument();
  });

  it('roads: the ties example text describes the hands that actually tie', () => {
    render(<RoadsLesson />);
    expect(body()).toMatch(/The tie on hand 4 is slashed across the second Banker cell/);
    expect(body()).toMatch(/Hands 6 and 7 are two ties in a row/);
  });
});
