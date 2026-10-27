// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RULE_PRESETS } from '@/engine';
import { runSimulation, validateSimConfig } from '@/strategy';
import { buyInStore, rulesStore } from '@/ui/shell';
import { LabView } from './LabView';
import { defaultLabConfig, toSimConfig, type LabConfig } from './config';
import { expectedEdge, formatEdgeRange } from './edge';
import { savedRunsStore, saveRun, summarizeResult } from './savedRuns';
import { fakeResult } from './testHelpers';

const SMALL: Partial<LabConfig> = { trials: 30, shoesPerTrial: 1, seed: 7 };

const field = (name: string | RegExp): HTMLInputElement => screen.getByLabelText(name) as HTMLInputElement;
const select = (name: string | RegExp): HTMLSelectElement => screen.getByLabelText(name) as HTMLSelectElement;

beforeEach(() => {
  window.localStorage.clear();
  rulesStore.reset();
  buyInStore.reset();
  savedRunsStore.reset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LabView — form', () => {
  it('starts from the settings (buy-in as bankroll, current rules) with the Flat Banker preset active and Run enabled', () => {
    buyInStore.set(2500);
    render(<LabView initialConfig={{ seed: 11 }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Strategy Lab' })).toBeInTheDocument();
    expect(field('Bankroll').value).toBe('2,500');
    expect(field('Unit').value).toBe('10');
    expect(field('Trials').value).toBe('1,000');
    expect(field('Shoes per trial').value).toBe('10');
    expect(field('Seed').value).toBe('11');
    expect(select('Table rules').value).toBe('current');
    expect(select('Table rules').selectedOptions[0].textContent).toBe('Current table settings (Settings dialog)');
    expect(select('Table rules')).toHaveAccessibleDescription('EZ Baccarat · 8 decks · Tie 8:1 · D7 40:1 · P8 25:1 · Pairs 11:1 · main $10–$5,000 · side $5–$500');
    expect(select('Bet selector').value).toBe('alwaysBanker');
    expect(select('Betting system').value).toBe('flat');
    expect(screen.getByTestId('lab-preset-flatBanker')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('lab-preset-martingalePlayer')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('lab-run')).toBeEnabled();
    expect(screen.getByTestId('lab-estimate')).toHaveTextContent(/≈ 8\d\d,\d{3} hands/);
    expect(screen.queryByTestId('lab-errors')).toBeNull();
    expect(screen.queryByTestId('lab-warnings')).toBeNull();
    expect(screen.getByTestId('lab-welcome')).toBeInTheDocument();
    expect(screen.getByTestId('lab-saved-runs')).toHaveTextContent(/No runs yet/);
  });

  it('applies presets, shows system parameters and marks edits as custom', () => {
    render(<LabView initialConfig={SMALL} />);
    fireEvent.click(screen.getByTestId('lab-preset-martingalePlayer'));
    expect(select('Bet selector').value).toBe('alwaysPlayer');
    expect(select('Betting system').value).toBe('martingale');
    expect(field('Max doublings').value).toBe('8');
    expect(screen.getByTestId('lab-preset-martingalePlayer')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('lab-preset-blurb')).toHaveTextContent(/Double after every loss/);
    fireEvent.change(field('Max doublings'), { target: { value: '5' } });
    expect(screen.getByTestId('lab-preset-martingalePlayer')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('lab-preset-blurb')).toHaveTextContent(/Custom strategy/);
    fireEvent.click(screen.getByTestId('lab-preset-countDragon7'));
    expect(select('Dragon 7').value).toBe('count');
    expect(field('Side-bet size').value).toBe('5');
    expect(screen.getByText(/Bet only when the true count is 4 or more/)).toBeInTheDocument();
    expect(screen.getByText(/\$50 a bet · table \$5–\$500/)).toBeInTheDocument();
    // Switching systems resets the parameters to that system's defaults.
    fireEvent.change(select('Betting system'), { target: { value: 'paroli' } });
    expect(field('Wins to reset').value).toBe('3');
  });

  it('validates the form: warnings do not block, errors disable Run and are listed', () => {
    const { unmount } = render(<LabView initialConfig={SMALL} />);
    fireEvent.change(select('Table rules'), { target: { value: 'commission' } });
    expect(screen.getByTestId('lab-table-note')).toHaveTextContent('Classic 5% commission · 8 decks · Tie 8:1 · Pairs 11:1');
    expect(select('Dragon 7')).toBeDisabled();
    expect(screen.getByText('Dragon 7 is not dealt on this table')).toBeInTheDocument();
    fireEvent.change(field('Unit'), { target: { value: '5' } });
    expect(screen.getByTestId('lab-warnings')).toHaveTextContent('Unit $5 is below the table minimum of $10: main bets are placed at the minimum.');
    expect(screen.getByTestId('lab-run')).toBeEnabled();
    unmount();
    render(<LabView initialConfig={{ ...SMALL, trials: 0 }} />);
    expect(screen.getByTestId('lab-errors')).toHaveTextContent('Trials must be a positive whole number');
    expect(screen.getByTestId('lab-run')).toBeDisabled();
  });

  it('randomizes the seed', () => {
    render(<LabView initialConfig={{ ...SMALL, seed: 5 }} />);
    expect(field('Seed').value).toBe('5');
    fireEvent.click(screen.getByTestId('lab-randomize'));
    expect(field('Seed').value).not.toBe('5');
    expect(Number(field('Seed').value.replace(/,/g, ''))).toBeGreaterThanOrEqual(0);
  });
});

describe('LabView — running', () => {
  it('runs the simulation and renders the results, charts, side bets and outcome mix without console errors', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LabView initialConfig={{ ...SMALL, dragon7: 'always', sideUnits: 1 }} />);
    fireEvent.click(screen.getByTestId('lab-run'));
    expect(screen.getByTestId('lab-cancel')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Simulation progress' })).toBeInTheDocument();
    const results = await screen.findByTestId('lab-results');
    expect(screen.queryByTestId('lab-progress')).toBeNull();
    expect(screen.getByTestId('lab-run')).toBeEnabled();

    // The figures on screen are exactly what runSimulation produces for the same config.
    const expected = runSimulation(toSimConfig({ ...defaultLabConfig({ bankroll: 1000 }), ...SMALL, dragon7: 'always', sideUnits: 1 }, rulesStore.get()));
    expect(validateSimConfig(expected.config)).toEqual([]);
    expect(screen.getByTestId('lab-strategy')).toHaveTextContent('Always Banker, Flat betting, $10 unit; Dragon 7 $10 every hand; no Panda 8.');
    expect(within(results).getByText('30 trials × 1 shoe')).toBeInTheDocument();
    const stats = screen.getByTestId('lab-stats');
    expect(stats).toHaveTextContent(`Mean final bankroll$${expected.meanFinal.toLocaleString('en-US')}`);
    expect(stats).toHaveTextContent(/Realized house edge/);
    const exact = expectedEdge(expected);
    expect(exact).not.toBeNull();
    expect(exact?.low).toBeGreaterThan(0.0102); // Banker edge blended with the 7.6% Dragon 7 edge
    expect(stats).toHaveTextContent(`Exact edge (Banker)${formatEdgeRange(exact as NonNullable<typeof exact>)}`);
    expect(stats).toHaveTextContent(`Hands dealt${expected.handsPlayed.toLocaleString('en-US')}`);
    expect(screen.getByTestId('lab-verdict')).toHaveTextContent(/^Over 30 sessions of one shoe, Always Banker with Flat betting/);
    expect(screen.getByTestId('lab-histogram').querySelectorAll('path[data-bin]').length).toBe(expected.histogram.filter((b) => b.count > 0).length);
    expect(screen.getByTestId('lab-curves').querySelectorAll('path[data-curve]')).toHaveLength(20);
    expect(screen.getByTestId('lab-side-dragon7')).toHaveTextContent(`Dragon 7every hand${expected.sideBets.dragon7.bets.toLocaleString('en-US')}${expected.sideBets.dragon7.wins} hit`);
    expect(screen.getByTestId('lab-side-dragon7')).toHaveTextContent(/math 2.25%/);
    expect(screen.getByTestId('lab-side-panda8')).toHaveTextContent(/Panda 8never00 hit—math 3.45%\$0/);
    expect(screen.getByTestId('lab-outcomes')).toHaveTextContent(/math 45.86%/);
    expect(errors).not.toHaveBeenCalled();
  });

  it('can be cancelled before it starts and reports it', async () => {
    render(<LabView initialConfig={{ ...SMALL, trials: 2000 }} />);
    fireEvent.click(screen.getByTestId('lab-run'));
    fireEvent.click(screen.getByTestId('lab-cancel'));
    expect(await screen.findByText(/Simulation cancelled after/)).toBeInTheDocument();
    expect(screen.queryByTestId('lab-results')).toBeNull();
    expect(screen.getByTestId('lab-run')).toBeEnabled();
  });

  it('saves a run to bt:lab, lists it for comparison, survives a remount, loads and removes it', async () => {
    const { unmount } = render(<LabView initialConfig={{ ...SMALL, unit: 15 }} />);
    fireEvent.click(screen.getByTestId('lab-run'));
    await screen.findByTestId('lab-results');
    expect(screen.getByTestId('lab-current-row')).toHaveTextContent(/This run/);
    fireEvent.click(screen.getByTestId('lab-save'));
    expect(screen.getByTestId('lab-save')).toBeDisabled();
    expect(screen.getByTestId('lab-save')).toHaveTextContent('Saved');
    expect(screen.queryByTestId('lab-current-row')).toBeNull();
    const row = screen.getByTestId('lab-saved-row');
    expect(row).toHaveTextContent(/Always Banker, Flat betting, \$15 unit/);
    expect(row).toHaveTextContent(/30 × 1/);
    const stored = JSON.parse(window.localStorage.getItem('bt:lab') ?? '[]') as Array<{ form: LabConfig; name: string }>;
    expect(stored).toHaveLength(1);
    expect(stored[0].form.unit).toBe(15);
    unmount();

    render(<LabView initialConfig={{ ...SMALL, unit: 40 }} />);
    expect(screen.getByTestId('lab-saved-row')).toHaveTextContent(/\$15 unit/);
    expect(field('Unit').value).toBe('40');
    fireEvent.click(screen.getByRole('button', { name: /Load the settings of/ }));
    expect(field('Unit').value).toBe('15');
    fireEvent.click(screen.getByRole('button', { name: /^Remove / }));
    expect(screen.queryByTestId('lab-saved-row')).toBeNull();
    expect(window.localStorage.getItem('bt:lab')).toBe('[]');
  });

  it('saves the form that produced the result on screen, not the form of a cancelled re-run', async () => {
    render(<LabView initialConfig={{ ...SMALL, unit: 15 }} />);
    fireEvent.click(screen.getByTestId('lab-run'));
    await screen.findByTestId('lab-results');
    // Edit the form, start a second run and cancel it before it starts: run A's result stays on screen.
    fireEvent.change(field('Unit'), { target: { value: '40' } });
    fireEvent.change(field('Trials'), { target: { value: '2000' } });
    fireEvent.click(screen.getByTestId('lab-run'));
    fireEvent.click(screen.getByTestId('lab-cancel'));
    await screen.findByText(/Simulation cancelled/);
    expect(screen.getByTestId('lab-strategy')).toHaveTextContent('$15 unit');
    fireEvent.click(screen.getByTestId('lab-save'));
    const stored = JSON.parse(window.localStorage.getItem('bt:lab') ?? '[]') as Array<{ form: LabConfig; summary: { unit: number; trials: number } }>;
    expect(stored).toHaveLength(1);
    expect(stored[0].summary).toMatchObject({ unit: 15, trials: 30 });
    expect(stored[0].form).toMatchObject({ unit: 15, trials: 30 });
    // Load brings back the settings of the saved result, not the edited ones.
    fireEvent.click(screen.getByRole('button', { name: /Load the settings of/ }));
    expect(field('Unit').value).toBe('15');
    expect(field('Trials').value).toBe('30');
  });

  it('marks the best figure per column and clears all saved runs', () => {
    const form = defaultLabConfig({ bankroll: 1000, seed: 1 });
    saveRun({ name: 'weak', rulesSummary: 'EZ', form, summary: summarizeResult(fakeResult({ meanFinal: 900, pRuin: 0.3 }), null) });
    saveRun({ name: 'strong', rulesSummary: 'EZ', form, summary: summarizeResult(fakeResult({ meanFinal: 990, pRuin: 0.1 }), null) });
    render(<LabView initialConfig={SMALL} />);
    const rows = screen.getAllByTestId('lab-saved-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('strong');
    expect(within(rows[0]).getAllByText(/\(best\)/).length).toBeGreaterThanOrEqual(2);
    expect(within(rows[1]).queryByText(/\(best\)/)).toBeNull();
    fireEvent.click(screen.getByTestId('lab-clear-runs'));
    expect(screen.queryAllByTestId('lab-saved-row')).toHaveLength(0);
    expect(screen.getByTestId('lab-saved-runs')).toHaveTextContent(/No runs yet/);
  });

  it('simulates the preset table the user picked, not the settings', async () => {
    render(<LabView initialConfig={SMALL} />);
    fireEvent.change(select('Table rules'), { target: { value: 'super6' } });
    fireEvent.click(screen.getByTestId('lab-run'));
    const results = await screen.findByTestId('lab-results');
    expect(within(results).getByText(RULE_PRESETS.super6.rules.bankerRule === 'super6' ? /Super 6 · 8 decks/ : /never/)).toBeInTheDocument();
    expect(screen.getByTestId('lab-stats')).toHaveTextContent('Exact edge (Banker)1.46%');
    expect(results).toHaveTextContent(/No side bets in this strategy/);
    expect(screen.queryByTestId('lab-side-dragon7')).toBeNull();
  });
});
