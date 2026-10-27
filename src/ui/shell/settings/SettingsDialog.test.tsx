// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_RULES, RULE_PRESETS } from '@/engine';
import { SettingsDialog, describeRuleProblems, ruleSummary } from './SettingsDialog';
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
