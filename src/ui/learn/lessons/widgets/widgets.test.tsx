// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_RULES, RULE_PRESETS, cardValue, dealFromValues, isRank } from '@/engine';
import { DRAGON7_SYSTEM, PANDA8_SYSTEM } from '../countingData';
import { ROAD_EXAMPLES } from '../roadsLogic';
import { BonusOdds } from './BonusOdds';
import { CostCalculator } from './CostCalculator';
import { CountWalkthrough } from './CountWalkthrough';
import { MartingaleExplorer } from './MartingaleExplorer';
import { DerivationList, RoadExample } from './RoadExample';
import { explainStep } from './SampleHand';
import { TableTour } from './TableTour';
import { VariantComparison } from './VariantComparison';

afterEach(cleanup);

const SYSTEMS = { dragon7: DRAGON7_SYSTEM, panda8: PANDA8_SYSTEM };
const widget = (name: string): HTMLElement => document.querySelector(`[data-widget="${name}"]`) as HTMLElement;

describe('CountWalkthrough', () => {
  it('keeps the running and true count of the Dragon 7 system (RC +9 → TC +5.4 with two decks left)', () => {
    render(<CountWalkthrough systems={SYSTEMS} />);
    fireEvent.click(screen.getByRole('radio', { name: /two decks left/i }));
    fireEvent.click(screen.getByRole('button', { name: /deal all/i }));
    const w = widget('count-walkthrough');
    // Recompute the running count from the cards actually shown, with the system's own tags.
    const strip = w.querySelector('[aria-label="Cards dealt"]') as HTMLElement;
    const cards = Array.from(strip.querySelectorAll<HTMLElement>('[data-card]')).map((el) => el.dataset.card ?? '');
    expect(cards).toHaveLength(18);
    const rc = cards.reduce((sum, c) => {
      const rank = c.slice(0, -1);
      if (!isRank(rank)) throw new Error(`bad card ${c}`);
      return sum + DRAGON7_SYSTEM.tags[cardValue(rank)];
    }, 0);
    expect(rc).toBe(9);
    expect(w).toHaveTextContent(/Cards seen18/);
    expect(w).toHaveTextContent(/Running count\+9/);
    // 104 − 18 = 86 cards = 1.65 decks; 9 / 1.654 = +5.4 ≥ +4 → bet.
    expect(w).toHaveTextContent(/Decks remaining1\.6586 cards/);
    expect(w).toHaveTextContent(/True count\+5\.4/);
    expect(w).toHaveTextContent(/Bet Dragon 7\?Yes/);
    // The Panda 8 tags give −1 on the same cards: +1 +1 +1 −2 −2 −2 0 −1 −1 +2 for values 0..9.
    fireEvent.click(screen.getByRole('button', { name: /panda 8 count/i }));
    const rcPanda = cards.reduce((sum, c) => sum + PANDA8_SYSTEM.tags[cardValue(c.slice(0, -1) as 'A')], 0);
    expect(rcPanda).toBe(-1);
    expect(w).toHaveTextContent(/Running count-1/);
    expect(w).toHaveTextContent(/Bet Panda 8\?No/);
    // At the start of the shoe the same +9 is only true count +1.2 (398 cards ≈ 7.65 decks).
    fireEvent.click(screen.getByRole('button', { name: /dragon 7 count/i }));
    fireEvent.click(screen.getByRole('radio', { name: /start of the shoe/i }));
    expect(w).toHaveTextContent(/True count\+1\.2/);
    expect(w).toHaveTextContent(/Bet Dragon 7\?No/);
  });
});

describe('MartingaleExplorer', () => {
  it('lays out the doubling sequence inside the table maximum and prices the bust', () => {
    render(<MartingaleExplorer rules={DEFAULT_RULES} />);
    const w = widget('martingale-explorer');
    const pills = w.querySelector('[aria-label="Bet sequence"]') as HTMLElement;
    expect(pills).toHaveTextContent('$10');
    expect(pills).toHaveTextContent('$2,560');
    expect(pills).toHaveTextContent('next would be $5,120 — over the maximum');
    expect(w).toHaveTextContent(/Bets before the cap9/);
    expect(w).toHaveTextContent(/Cost of a bust\$5,110/);
    // q = P(Banker) / (P(Banker) + P(Player)) = 0.5068; q^9 = 0.22%.
    expect(w).toHaveTextContent(/A sequence busts0\.22%/);
    expect(w).toHaveTextContent(/Expected per sequence-\$1\.30/);
  });
});

describe('CostCalculator', () => {
  it('multiplies bet × hands × edge for the chosen bet', () => {
    render(<CostCalculator rules={DEFAULT_RULES} />);
    const w = widget('cost-calculator');
    expect(w).toHaveTextContent(/Hands140/);
    expect(w).toHaveTextContent(/Total wagered\$3,500/);
    expect(w).toHaveTextContent(/Expected loss\$35\.64/); // 3,500 × 1.0183%
    expect(w).toHaveTextContent(/Per hour\$17\.82/);
    expect(w).toHaveTextContent(/Finish ahead/);
    fireEvent.change(screen.getByLabelText(/^bet$/i), { target: { value: 'tie' } });
    expect(w).toHaveTextContent(/Expected loss\$502\.59/); // 3,500 × 14.3596%
    expect(w).not.toHaveTextContent(/Finish ahead/);
  });
});

describe('VariantComparison', () => {
  it('shows the SPEC Banker edges of the three presets and marks the active one', () => {
    render(<VariantComparison rules={DEFAULT_RULES} />);
    const edge = (id: string): string => document.querySelector(`[data-variant-edge="${id}"]`)?.textContent ?? '';
    expect(edge('ez')).toBe('1.02%');
    expect(edge('commission')).toBe('1.06%');
    expect(edge('super6')).toBe('1.46%');
    expect(screen.getByText(/your table/i).closest('th')).toHaveTextContent('EZ Baccarat');
  });
});

describe('RoadExample / DerivationList', () => {
  it('asks the roads: a Banker next adds red to all three, a Player adds blue', () => {
    render(<RoadExample title="Ask" sequence={ROAD_EXAMPLES.derived} roads={['big', 'bigEye', 'small', 'cockroach']} askable />);
    fireEvent.click(screen.getByRole('button', { name: /ask b/i }));
    const forecast = (): string => document.querySelector('[data-forecast]')?.textContent ?? '';
    expect(forecast()).toMatch(/Big Eye Boy adds red · Small Road adds red · Cockroach Pig adds red/);
    fireEvent.click(screen.getByRole('button', { name: /ask p/i }));
    expect(forecast()).toMatch(/Big Eye Boy adds blue · Small Road adds blue · Cockroach Pig adds blue/);
    fireEvent.click(screen.getByRole('button', { name: /ask p/i }));
    expect(document.querySelector('[data-forecast]')).not.toBeInTheDocument();
  });

  it('spells out the first entries with their colours', () => {
    render(<DerivationList sequence={ROAD_EXAMPLES.derived} kind="bigEye" limit={6} />);
    const items = Array.from(document.querySelectorAll('[data-derivation="bigEye"] li'));
    expect(items.map((li) => li.getAttribute('data-color'))).toEqual(['red', 'red', 'blue', 'blue', 'red', 'blue']);
    expect(document.body).toHaveTextContent('Big-road column depths: 1:2, 2:2, 3:1, 4:3, 5:1, 6:1, 7:2, 8:2, 9:4.');
  });
});

describe('BonusOdds', () => {
  it('reports frequency, fair odds and the expected result of a run of side bets', () => {
    render(<BonusOdds rules={DEFAULT_RULES} />);
    const d7 = document.querySelector('[data-bonus="dragon7"]') as HTMLElement;
    const p8 = document.querySelector('[data-bonus="panda8"]') as HTMLElement;
    expect(d7).toHaveTextContent('2.25%');
    expect(d7).toHaveTextContent('44.4 hands');
    expect(d7).toHaveTextContent('43.4:1');
    expect(d7).toHaveTextContent('40:1');
    expect(d7).toHaveTextContent('-$38.06'); // 100 hands × $5 × 7.61%
    expect(p8).toHaveTextContent('28.9 hands');
    expect(p8).toHaveTextContent('-$50.94');
    expect(widget('bonus-odds')).toHaveTextContent(/about one gap in 10 runs past 100 hands/);
  });
});

describe('TableTour pushes', () => {
  it('shows the push probability of both main bets', () => {
    render(<TableTour rules={DEFAULT_RULES} />);
    const desc = (): HTMLElement => document.querySelector('[data-tour-desc]') as HTMLElement;
    fireEvent.click(document.querySelector('[data-spot="player"]') as HTMLElement);
    expect(desc()).toHaveTextContent(/Pushes9\.52%on a tie/);
    cleanup();
    render(<TableTour rules={RULE_PRESETS.commission.rules} />);
    fireEvent.click(document.querySelector('[data-spot="banker"]') as HTMLElement);
    expect(desc()).toHaveTextContent(/Pushes9\.52%on a tie/);
  });
});

describe('explainStep result calls', () => {
  it('says that Banker bets push on a Dragon 7 at an EZ table and pay half on a Super 6 Banker 6', () => {
    const dragon = dealFromValues([2, 3, 'A'], [3, 'K', 4], DEFAULT_RULES);
    const result = dragon.steps.find((s) => s.type === 'result');
    expect(result).toBeDefined();
    expect(explainStep(result!, dragon, DEFAULT_RULES)).toMatch(/Banker bets are a push/);
    expect(explainStep(result!, dragon, RULE_PRESETS.commission.rules)).toMatch(/paid 1 to 1 less the 5% commission/);
    const six = dealFromValues([2, 3, 'K'], [3, 3], RULE_PRESETS.super6.rules);
    expect(six.bankerWinOn6).toBe(true);
    expect(explainStep(six.steps.find((s) => s.type === 'result')!, six, RULE_PRESETS.super6.rules)).toMatch(/paid only half/);
    expect(explainStep(six.steps.find((s) => s.type === 'result')!, six, DEFAULT_RULES)).toMatch(/Banker bets are paid 1 to 1;/);
  });
});
