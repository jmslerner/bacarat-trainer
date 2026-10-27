// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_RULES, RULE_PRESETS, applyTableLevel, tableLevelOf } from '@/engine';
import { SettingsDialog, describeRuleProblems, ruleSummary, tableChanged } from './SettingsDialog';
import { buyInStore, prefsStore, rulesStore } from '../hooks/useSettings';
import { getSession, resetSession } from '../hooks/useSession';

beforeEach(() => {
  window.localStorage.clear();
  rulesStore.reset();
  prefsStore.reset();
  buyInStore.reset();
  resetSession({ bankroll: 1000, seed: 7 });
});
afterEach(cleanup);

function openDialog(tab: 'rules' | 'bankroll' | 'preferences' = 'rules'): { onClose: () => void; closed: () => number } {
  let n = 0;
  const onClose = (): void => {
    n += 1;
  };
  render(<SettingsDialog open onClose={onClose} initialTab={tab} />);
  return { onClose, closed: () => n };
}

describe('describeRuleProblems', () => {
  it('accepts the presets', () => {
    for (const p of Object.values(RULE_PRESETS)) expect(describeRuleProblems(p.rules)).toEqual([]);
  });
  it('explains bad limits, payouts and procedure values', () => {
    const bad = { ...DEFAULT_RULES, limits: { ...DEFAULT_RULES.limits, main: { min: 100, max: 50 } }, tiePays: 0.5, cutCardFromEnd: 0, chipDenominations: [1, 5, 1000] };
    const problems = describeRuleProblems(bad);
    expect(problems).toEqual(
      expect.arrayContaining([expect.stringMatching(/Main bet maximum .*below the minimum/), expect.stringMatching(/Tie must pay at least 1:1/), expect.stringMatching(/Cut card/), expect.stringMatching(/chip in the tray/)]),
    );
    expect(new Set(problems).size).toBe(problems.length);
  });
  it('summarises rules', () => {
    expect(ruleSummary(DEFAULT_RULES)).toMatch(/EZ Baccarat · 8 decks · Tie 8:1 · D7 40:1 · P8 25:1 · Pairs 11:1/);
  });
});

describe('SettingsDialog', () => {
  it('starts on the requested tab with the current rules and a disabled Apply', () => {
    openDialog();
    expect(screen.getByRole('dialog', { name: /table settings/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /rules/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('preset-ez')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('apply-rules')).toBeDisabled();
    expect(screen.queryByTestId('new-shoe-warning')).not.toBeInTheDocument();
  });

  it('validates edits: an invalid limit shows a problem and blocks Apply', () => {
    openDialog();
    const maxInput = screen.getByLabelText('Player / Banker maximum');
    fireEvent.focus(maxInput);
    fireEvent.change(maxInput, { target: { value: '5' } });
    const problems = screen.getByTestId('rule-problems');
    expect(problems).toHaveTextContent(/Main bet maximum .*below the minimum/);
    expect(screen.getByTestId('apply-rules')).toBeDisabled();
    expect(rulesStore.get()).toEqual(DEFAULT_RULES); // nothing applied yet

    fireEvent.change(maxInput, { target: { value: '10000' } });
    expect(screen.queryByTestId('rule-problems')).not.toBeInTheDocument();
    expect(screen.getByTestId('new-shoe-warning')).toHaveTextContent(/new shoe/i);
    expect(screen.getByTestId('apply-rules')).toBeEnabled();
  });

  it('applies a preset, warns about the new shoe, and persists on Apply', () => {
    const { closed } = openDialog();
    fireEvent.click(screen.getByTestId('preset-commission'));
    expect(screen.getByTestId('preset-commission')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('new-shoe-warning')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('apply-rules'));
    expect(closed()).toBe(1);
    expect(rulesStore.get().bankerRule).toBe('commission');
    expect(getSession().getState().rules.bankerRule).toBe('commission');
    expect(JSON.parse(window.localStorage.getItem('bt:rules') ?? '{}').bankerRule).toBe('commission');
  });

  it('toggles side bets and chip denominations in the draft', () => {
    openDialog();
    fireEvent.click(screen.getByRole('switch', { name: /dragon 7/i }));
    fireEvent.click(screen.getByRole('button', { name: /\$5,000 chip not in tray/i }));
    fireEvent.click(screen.getByTestId('apply-rules'));
    expect(rulesStore.get().sideBets.dragon7).toBe(false);
    expect(rulesStore.get().chipDenominations).toEqual([1, 5, 25, 100, 500, 1000, 5000]);
  });

  it('sets the bankroll from the Bankroll tab', () => {
    openDialog('bankroll');
    expect(screen.getByRole('tab', { name: /bankroll/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: '$2,500' }));
    fireEvent.click(screen.getByTestId('set-bankroll'));
    expect(getSession().getState().bankroll).toBe(2500);
    expect(buyInStore.get()).toBe(2500);
    expect(screen.getByRole('status')).toHaveTextContent(/Bankroll set to \$2,500/);
  });

  it('a negative buy-in typed into the field never reaches the session', () => {
    openDialog('bankroll');
    const input = screen.getByLabelText('Buy-in amount') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '-250' } });
    expect(screen.getByTestId('set-bankroll')).toHaveTextContent('Set bankroll to $0');
    fireEvent.click(screen.getByTestId('set-bankroll'));
    expect(getSession().getState().bankroll).toBe(0);
    expect(buyInStore.get()).toBe(0);
  });

  it('dealing speed offers short labels with the hint for the current speed', () => {
    openDialog('preferences');
    const panel = screen.getByRole('tabpanel');
    const select = within(panel).getByLabelText(/dealing speed/i) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Slow', 'Normal', 'Fast', 'Instant']);
    expect(select).toHaveAccessibleDescription('Casino pace');
    fireEvent.change(select, { target: { value: 'slow' } });
    expect(select).toHaveAccessibleDescription(/every call lingers/i);
  });

  it('re-selecting the active preset is a no-op: Apply stays disabled and no shoe is discarded', () => {
    openDialog();
    const shoe = getSession().getState().shoe.shoeNumber;
    fireEvent.click(screen.getByTestId('preset-ez'));
    expect(screen.getByTestId('apply-rules')).toBeDisabled();
    expect(screen.queryByTestId('new-shoe-warning')).not.toBeInTheDocument();
    expect(getSession().getState().shoe.shoeNumber).toBe(shoe);
  });

  it('preferences apply immediately', () => {
    openDialog('preferences');
    const panel = screen.getByRole('tabpanel');
    fireEvent.click(within(panel).getByRole('switch', { name: /beginner tips/i }));
    expect(prefsStore.get().beginnerTips).toBe(false);
    fireEvent.change(within(panel).getByLabelText(/dealing speed/i), { target: { value: 'instant' } });
    expect(prefsStore.get().dealSpeed).toBe('instant');
  });

  it('closes on Escape and the close button', () => {
    const { closed } = openDialog();
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(closed()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(closed()).toBe(2);
  });
});

describe('tableChanged', () => {
  it('is true when the limits differ or a different tier is picked, and false for chip-tray-only edits', () => {
    const high = applyTableLevel(DEFAULT_RULES, 'high');
    expect(tableChanged(high, DEFAULT_RULES)).toBe(true);
    expect(tableChanged(DEFAULT_RULES, DEFAULT_RULES)).toBe(false);
    expect(tableChanged({ ...DEFAULT_RULES, limits: { ...DEFAULT_RULES.limits, main: { min: 10, max: 6000 } } }, DEFAULT_RULES)).toBe(true);
    const moreChips = { ...DEFAULT_RULES, chipDenominations: [...DEFAULT_RULES.chipDenominations, 5000] };
    expect(tableChanged(moreChips, DEFAULT_RULES)).toBe(false); // custom tray, same limits: the player stays at the table
    expect(tableChanged(DEFAULT_RULES, moreChips)).toBe(true); // picking the named tier again is a table switch
  });
});

describe('SettingsDialog — table levels', () => {
  it('lists the five tiers with the $10 mini-baccarat active; picking the salon patches limits and chips, keeps the variant and warns about the buy-in', () => {
    openDialog();
    expect(screen.getByRole('radiogroup', { name: 'Table level' })).toBeInTheDocument();
    expect(screen.getByTestId('level-mini')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('level-high')).toHaveTextContent('$500 high-limit salon');
    expect(screen.getByTestId('level-high')).toHaveTextContent('main $500–$100,000 · tie $500–$10,000 · side $100–$5,000');
    expect(screen.getByTestId('level-high')).toHaveTextContent('Buy-in $50,000');
    expect(screen.getByTestId('level-blurb')).toHaveTextContent(/most common table on and off the Strip/);
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/\$10 mini-baccarat/);

    fireEvent.click(screen.getByTestId('level-high'));
    expect(screen.getByTestId('level-high')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('level-mini')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('level-blurb')).toHaveTextContent(/Salon play with limits raised for rated players\. Suggested buy-in \$50,000/);
    expect((screen.getByLabelText('Player / Banker minimum') as HTMLInputElement).value).toBe('500');
    expect((screen.getByLabelText('Player / Banker maximum') as HTMLInputElement).value).toBe('100,000');
    expect((screen.getByLabelText('Tie maximum') as HTMLInputElement).value).toBe('10,000');
    expect((screen.getByLabelText('Side bets minimum') as HTMLInputElement).value).toBe('100');
    expect(screen.getByRole('button', { name: /\$100,000 chip in tray/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\$25,000 chip in tray/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\$1 chip not in tray/i })).toBeInTheDocument();
    expect(screen.getByTestId('preset-ez')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('rule-problems')).not.toBeInTheDocument();
    expect(screen.getByTestId('new-shoe-warning')).toHaveTextContent(/moves you to the \$500 high-limit salon table: your bankroll is reset to its suggested buy-in of \$50,000\. Session stats are kept/);
  });

  it('applies a level: rules and chips persist, the bankroll becomes the buy-in and the session stats carry on', () => {
    const session = getSession();
    session.placeBet('banker', 25);
    session.deal();
    const before = session.getState();
    expect(before.stats.handsPlayed).toBe(1);
    const { closed } = openDialog();
    fireEvent.click(screen.getByTestId('level-high'));
    fireEvent.click(screen.getByTestId('apply-rules'));
    expect(closed()).toBe(1);
    expect(tableLevelOf(rulesStore.get())).toBe('high');
    expect(rulesStore.get().chipDenominations).toEqual([100, 500, 1000, 5000, 25000, 100000]);
    const after = getSession().getState();
    expect(after.rules.limits.main).toEqual({ min: 500, max: 100000 });
    expect(after.bankroll).toBe(50000);
    expect(after.stats.handsPlayed).toBe(1);
    expect(after.stats.net).toBe(before.stats.net);
    expect(after.stats.startingBankroll).toBeCloseTo(50000 - before.stats.net, 6);
    expect(after.shoe.shoeNumber).toBe(before.shoe.shoeNumber + 1);
    expect(buyInStore.get()).toBe(50000);
    expect(JSON.parse(window.localStorage.getItem('bt:rules') ?? '{}').limits.main.min).toBe(500);
    expect(window.localStorage.getItem('bt:bankroll')).toBe('50000');
  });

  it('chip-tray-only edits keep the bankroll; editing a limit makes the level custom and buys in for 100 × the minimum', () => {
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: /\$5,000 chip not in tray/i }));
    expect(screen.getByTestId('level-mini')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('level-blurb')).toHaveTextContent(/Custom limits — edited below; the suggested buy-in is \$1,000/);
    expect(screen.getByTestId('new-shoe-warning')).toHaveTextContent(/Your bankroll and session stats are kept/);
    fireEvent.click(screen.getByTestId('apply-rules'));
    expect(getSession().getState().bankroll).toBe(1000);
    expect(buyInStore.get()).toBe(1000);
    expect(tableLevelOf(rulesStore.get())).toBe('custom');
    cleanup();

    openDialog();
    const minInput = screen.getByLabelText('Player / Banker minimum');
    fireEvent.focus(minInput);
    fireEvent.change(minInput, { target: { value: '50' } });
    expect(screen.getByTestId('level-blurb')).toHaveTextContent(/suggested buy-in is \$5,000/);
    expect(screen.getByTestId('new-shoe-warning')).toHaveTextContent(/moves you to a table with custom limits: your bankroll is reset to its suggested buy-in of \$5,000/);
    fireEvent.click(screen.getByTestId('apply-rules'));
    expect(rulesStore.get().limits.main.min).toBe(50);
    expect(getSession().getState().bankroll).toBe(5000);
    expect(buyInStore.get()).toBe(5000);
  });

  it('a variant preset keeps the table level and leaves the bankroll alone', () => {
    rulesStore.set(applyTableLevel(DEFAULT_RULES, 'high'));
    getSession().setBankroll(48000);
    buyInStore.set(50000);
    openDialog();
    expect(screen.getByTestId('level-high')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('preset-commission'));
    expect(screen.getByTestId('preset-commission')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('level-high')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('new-shoe-warning')).toHaveTextContent(/Your bankroll and session stats are kept/);
    fireEvent.click(screen.getByTestId('apply-rules'));
    expect(rulesStore.get().bankerRule).toBe('commission');
    expect(tableLevelOf(rulesStore.get())).toBe('high');
    expect(getSession().getState().bankroll).toBe(48000);
    expect(buyInStore.get()).toBe(50000);
  });

  it('the Bankroll tab offers the table’s suggested buy-in among the quick amounts', () => {
    rulesStore.set(applyTableLevel(DEFAULT_RULES, 'high'));
    openDialog('bankroll');
    const quick = (): HTMLElement => screen.getByRole('group', { name: 'Quick buy-in amounts' });
    expect(within(quick()).getAllByRole('button').map((b) => b.textContent)).toEqual(['$500', '$1,000', '$2,500', '$5,000', '$10,000', '$50,000']);
    fireEvent.click(within(quick()).getByRole('button', { name: '$50,000' }));
    fireEvent.click(screen.getByTestId('set-bankroll'));
    expect(getSession().getState().bankroll).toBe(50000);
    expect(buyInStore.get()).toBe(50000);
    cleanup();
    rulesStore.set(DEFAULT_RULES);
    openDialog('bankroll');
    expect(within(quick()).getAllByRole('button').map((b) => b.textContent)).toEqual(['$500', '$1,000', '$2,500', '$5,000', '$10,000']);
  });

  it('"Reset to defaults" returns to the $10 table and, on Apply, to its buy-in', () => {
    rulesStore.set(applyTableLevel(DEFAULT_RULES, 'private'));
    getSession().setBankroll(500000);
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect(screen.getByTestId('level-mini')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('new-shoe-warning')).toHaveTextContent(/\$10 mini-baccarat table: your bankroll is reset to its suggested buy-in of \$1,000/);
    fireEvent.click(screen.getByTestId('apply-rules'));
    expect(rulesStore.get()).toEqual(DEFAULT_RULES);
    expect(getSession().getState().bankroll).toBe(1000);
  });
});
