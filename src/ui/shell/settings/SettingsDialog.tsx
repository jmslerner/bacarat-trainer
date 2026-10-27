/**
 * SettingsDialog — rule presets + the full rule editor, bankroll buy-in and preferences.
 * Rule edits are kept in a draft and only applied with "Apply" (which starts a new shoe).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { MIN_CUT_CARD_FROM_END, RULE_PRESETS, validateRules } from '@/engine';
import type { BankerRule, TableRules } from '@/engine';
import { cx } from '../cx';
import { formatMoney, formatOdds } from '../format';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Modal } from '../components/Modal';
import { NumberInput } from '../components/NumberInput';
import { Select } from '../components/Select';
import { Stat, toneForNet } from '../components/Stat';
import { Tabs } from '../components/Tabs';
import { Toggle } from '../components/Toggle';
import { useSession } from '../hooks/useSession';
import { DEAL_SPEEDS, matchPreset, rulesEqual, RULE_PRESET_IDS, sanitizeRules, STANDARD_CHIP_DENOMINATIONS, useSettings, type DealSpeed, type RulePresetId } from '../hooks/useSettings';
import { playSound } from '../hooks/useSound';
import styles from './SettingsDialog.module.css';

export type SettingsTab = 'rules' | 'bankroll' | 'preferences';

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

const TABS: ReadonlyArray<{ id: SettingsTab; label: string }> = [
  { id: 'rules', label: 'Rules' },
  { id: 'bankroll', label: 'Bankroll' },
  { id: 'preferences', label: 'Preferences' },
];

const BANKER_RULE_OPTIONS: ReadonlyArray<{ value: BankerRule; label: string }> = [
  { value: 'ez', label: 'EZ — no commission, Dragon 7 pushes' },
  { value: 'commission', label: 'Classic — 5% commission' },
  { value: 'super6', label: 'Super 6 — Banker 6 pays half' },
];

const QUICK_BUY_INS = [500, 1000, 2500, 5000, 10000];

/** Checks the engine does not make (its `validateRules` is authoritative; these complement it). */
export function localRuleProblems(r: TableRules): string[] {
  const out: string[] = [];
  const payout = (name: string, v: number): void => {
    if (v > 0 && v < 1) out.push(`${name} must pay at least 1:1`);
  };
  payout('Tie', r.tiePays);
  payout('Dragon 7', r.dragon7Pays);
  payout('Panda 8', r.panda8Pays);
  payout('Pairs', r.pairPays);
  if (Array.isArray(r.chipDenominations) && r.limits?.main && r.chipDenominations.some((c) => c > r.limits.main.max)) {
    out.push('Every chip in the tray must be no larger than the main bet maximum');
  }
  return out;
}

function engineProblems(r: TableRules): string[] {
  try {
    return validateRules(r);
  } catch (e) {
    return [`Rules could not be validated: ${e instanceof Error ? e.message : String(e)}`];
  }
}

/** Every problem with a rule set: the engine's `validateRules` plus the dialog's complementary checks. */
export function describeRuleProblems(r: TableRules): string[] {
  return Array.from(new Set([...engineProblems(r), ...localRuleProblems(r)]));
}

/** Cut-card depth the engine accepts for a deck count. */
export function cutCardRange(decks: 6 | 8): { min: number; max: number } {
  return { min: MIN_CUT_CARD_FROM_END, max: decks * 52 - 52 };
}

export function ruleSummary(r: TableRules): string {
  const banker = r.bankerRule === 'ez' ? 'EZ Baccarat' : r.bankerRule === 'commission' ? `Classic ${Math.round(r.commissionRate * 100)}% commission` : 'Super 6';
  const sides: string[] = [];
  if (r.sideBets.dragon7) sides.push(`D7 ${formatOdds(r.dragon7Pays)}`);
  if (r.sideBets.panda8) sides.push(`P8 ${formatOdds(r.panda8Pays)}`);
  if (r.sideBets.pairs) sides.push(`Pairs ${formatOdds(r.pairPays)}`);
  return [banker, `${r.decks} decks`, `Tie ${formatOdds(r.tiePays)}`, ...sides].join(' · ');
}

export function SettingsDialog({ open, onClose, initialTab = 'rules' }: SettingsDialogProps): ReactNode {
  if (!open) return null;
  return <SettingsDialogOpen onClose={onClose} initialTab={initialTab} />;
}

function SettingsDialogOpen({ onClose, initialTab }: { onClose: () => void; initialTab: SettingsTab }): ReactNode {
  const settings = useSettings();
  const { state, session } = useSession();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [draft, setDraft] = useState<TableRules>(() => settings.rules);
  const [buyIn, setBuyInDraft] = useState<number>(() => settings.buyIn);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  /** The buy-in the buttons act on: never negative or non-finite, whatever the field holds mid-edit. */
  const safeBuyIn = Number.isFinite(buyIn) && buyIn > 0 ? buyIn : 0;
  const dirty = !rulesEqual(draft, settings.rules);
  const problems = useMemo(() => describeRuleProblems(draft), [draft]);
  const preset = matchPreset(draft);
  const handsInShoe = state.shoeHistory.length;
  const betsOnLayout = Object.values(state.bets).some((v) => (v ?? 0) > 0);

  const patch = (p: Partial<TableRules>): void => setDraft((d) => ({ ...d, ...p }));
  const patchLimits = (which: 'main' | 'tie' | 'side', key: 'min' | 'max', value: number): void =>
    setDraft((d) => ({ ...d, limits: { ...d.limits, [which]: { ...d.limits[which], [key]: value } } }));
  const toggleChip = (value: number): void =>
    setDraft((d) => {
      const has = d.chipDenominations.includes(value);
      const next = has ? d.chipDenominations.filter((c) => c !== value) : [...d.chipDenominations, value].sort((a, b) => a - b);
      return { ...d, chipDenominations: next };
    });

  const apply = (): void => {
    if (!dirty || problems.length > 0) return;
    settings.setRules(sanitizeRules(draft));
    playSound('shuffle');
    onClose();
  };

  const setBankroll = (): void => {
    session.setBankroll(safeBuyIn);
    settings.setBuyIn(safeBuyIn);
    playSound('chip');
    setNotice(`Bankroll set to ${formatMoney(safeBuyIn)}`);
  };

  const resetSession = (): void => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    session.reset({ rules: settings.rules, bankroll: safeBuyIn });
    settings.setBuyIn(safeBuyIn);
    setConfirmReset(false);
    setNotice('Session reset — fresh shoe, stats and history cleared');
  };

  const footer =
    tab === 'rules' ? (
      <>
        <Button variant="ghost" size="sm" onClick={() => setDraft(sanitizeRules(RULE_PRESETS.ez.rules))} className={styles.footerLeft}>
          Reset to defaults
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={apply} disabled={!dirty || problems.length > 0} data-testid="apply-rules">
          {dirty ? 'Apply & new shoe' : 'Apply'}
        </Button>
      </>
    ) : (
      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    );

  return (
    <Modal open onClose={onClose} title="Table Settings" description={ruleSummary(settings.rules)} size="lg" footer={footer} className={styles.dialog}>
      <Tabs items={TABS} value={tab} onChange={setTab} label="Settings sections" variant="pill" fill size="sm" panelClassName={styles.panel}>
        {tab === 'rules' && (
          <div className={styles.rules}>
            <section className={styles.section} aria-labelledby="preset-heading">
              <h4 id="preset-heading" className={styles.heading}>
                Table preset
              </h4>
              <div className={styles.presets} role="radiogroup" aria-label="Rule preset">
                {RULE_PRESET_IDS.map((id: RulePresetId) => {
                  const p = RULE_PRESETS[id];
                  const active = preset === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={cx(styles.preset, active && styles.presetActive)}
                      onClick={() => setDraft(sanitizeRules(p.rules))}
                      data-testid={`preset-${id}`}
                    >
                      <span className={styles.presetName}>{p.name}</span>
                      <span className={styles.presetDesc}>{p.description}</span>
                    </button>
                  );
                })}
              </div>
              {preset === null && <p className={styles.custom}>Custom rules — edited from a preset.</p>}
            </section>

            <div className={styles.grid}>
              <section className={styles.section} aria-labelledby="shoe-heading">
                <h4 id="shoe-heading" className={styles.heading}>
                  Shoe & procedure
                </h4>
                <Select<'6' | '8'>
                  label="Decks"
                  value={String(draft.decks) as '6' | '8'}
                  options={[
                    { value: '8', label: '8 decks (416 cards)' },
                    { value: '6', label: '6 decks (312 cards)' },
                  ]}
                  onChange={(v) => patch({ decks: v === '6' ? 6 : 8 })}
                />
                <NumberInput label="Cut card from end" value={draft.cutCardFromEnd} min={cutCardRange(draft.decks).min} max={cutCardRange(draft.decks).max} step={1} decimals={0} suffix="cards" onChange={(v) => patch({ cutCardFromEnd: v })} hint="14 is typical. The hand in progress finishes, one more hand is dealt, then a new shoe." />
                <Toggle label="Burn procedure" description="Expose the first card and burn that many cards at the start of each shoe" checked={draft.burnProcedure} onChange={(v) => patch({ burnProcedure: v })} />
              </section>

              <section className={styles.section} aria-labelledby="banker-heading">
                <h4 id="banker-heading" className={styles.heading}>
                  Banker rule & payouts
                </h4>
                <Select<BankerRule> label="Banker pays" value={draft.bankerRule} options={BANKER_RULE_OPTIONS} onChange={(v) => patch({ bankerRule: v })} />
                {draft.bankerRule === 'commission' && (
                  <NumberInput label="Commission" value={Math.round(draft.commissionRate * 1000) / 10} min={0} max={25} step={0.5} decimals={1} suffix="%" onChange={(v) => patch({ commissionRate: v / 100 })} />
                )}
                <div className={styles.row}>
                  <NumberInput label="Tie pays" value={draft.tiePays} min={1} max={100} step={1} decimals={0} suffix=": 1" onChange={(v) => patch({ tiePays: v })} />
                  <NumberInput label="Pairs pay" value={draft.pairPays} min={1} max={100} step={1} decimals={0} suffix=": 1" onChange={(v) => patch({ pairPays: v })} />
                </div>
                <div className={styles.row}>
                  <NumberInput label="Dragon 7 pays" value={draft.dragon7Pays} min={1} max={100} step={1} decimals={0} suffix=": 1" onChange={(v) => patch({ dragon7Pays: v })} />
                  <NumberInput label="Panda 8 pays" value={draft.panda8Pays} min={1} max={100} step={1} decimals={0} suffix=": 1" onChange={(v) => patch({ panda8Pays: v })} />
                </div>
              </section>

              <section className={styles.section} aria-labelledby="side-heading">
                <h4 id="side-heading" className={styles.heading}>
                  Side bets offered
                </h4>
                <Toggle label="Dragon 7" description={`Banker wins with a three-card 7 — pays ${formatOdds(draft.dragon7Pays)}`} checked={draft.sideBets.dragon7} onChange={(v) => patch({ sideBets: { ...draft.sideBets, dragon7: v } })} />
                <Toggle label="Panda 8" description={`Player wins with a three-card 8 — pays ${formatOdds(draft.panda8Pays)}`} checked={draft.sideBets.panda8} onChange={(v) => patch({ sideBets: { ...draft.sideBets, panda8: v } })} />
                <Toggle label="Player / Banker Pair" description={`First two cards share a rank — pays ${formatOdds(draft.pairPays)}`} checked={draft.sideBets.pairs} onChange={(v) => patch({ sideBets: { ...draft.sideBets, pairs: v } })} />
              </section>

              <section className={styles.section} aria-labelledby="limits-heading">
                <h4 id="limits-heading" className={styles.heading}>
                  Table limits
                </h4>
                {(
                  [
                    ['main', 'Player / Banker'],
                    ['tie', 'Tie'],
                    ['side', 'Side bets'],
                  ] as const
                ).map(([which, label]) => (
                  <div key={which} className={styles.limitRow}>
                    <span className={styles.limitLabel}>{label}</span>
                    <NumberInput aria-label={`${label} minimum`} value={draft.limits[which].min} min={1} step={5} decimals={0} prefix="$" steppers={false} width={7} onChange={(v) => patchLimits(which, 'min', v)} />
                    <span className={styles.limitDash}>—</span>
                    <NumberInput aria-label={`${label} maximum`} value={draft.limits[which].max} min={1} step={100} decimals={0} prefix="$" steppers={false} width={8} onChange={(v) => patchLimits(which, 'max', v)} />
                  </div>
                ))}
              </section>
            </div>

            <section className={styles.section} aria-labelledby="chips-heading">
              <h4 id="chips-heading" className={styles.heading}>
                Chip tray
              </h4>
              <div className={styles.chips} role="group" aria-label="Chip denominations in the tray">
                {STANDARD_CHIP_DENOMINATIONS.map((value) => {
                  const on = draft.chipDenominations.includes(value);
                  return (
                    <Chip key={value} value={value} size="sm" selected={on} onClick={() => toggleChip(value)} label={`${formatMoney(value)} chip ${on ? 'in' : 'not in'} tray`} className={cx(!on && styles.chipOff)} />
                  );
                })}
              </div>
            </section>

            {problems.length > 0 && (
              <ul className={styles.problems} role="alert" data-testid="rule-problems">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {dirty && problems.length === 0 && (
              <p className={styles.warning} role="status" data-testid="new-shoe-warning">
                Applying these rules starts a <strong>new shoe</strong>
                {handsInShoe > 0 ? ` — the current shoe (${handsInShoe} ${handsInShoe === 1 ? 'hand' : 'hands'}) is discarded` : ''}
                {betsOnLayout ? ' and bets on the layout are cleared' : ''}. Your bankroll and session stats are kept.
              </p>
            )}
          </div>
        )}

        {tab === 'bankroll' && (
          <div className={styles.bankroll}>
            <div className={styles.statRow}>
              <Stat label="Bankroll" value={formatMoney(state.bankroll)} tone="gold" />
              <Stat label="Session net" value={formatMoney(state.stats.net, { signed: true })} tone={toneForNet(state.stats.net)} />
              <Stat label="Hands played" value={state.stats.handsPlayed} />
            </div>
            <NumberInput label="Buy-in amount" value={buyIn} min={0} step={100} decimals={2} prefix="$" onChange={setBuyInDraft} hint="Sets your bankroll to this amount. History and stats are kept." />
            <div className={styles.quick} role="group" aria-label="Quick buy-in amounts">
              {QUICK_BUY_INS.map((v) => (
                <Button key={v} size="sm" variant={buyIn === v ? 'primary' : 'secondary'} onClick={() => setBuyInDraft(v)}>
                  {formatMoney(v)}
                </Button>
              ))}
            </div>
            <div className={styles.actions}>
              <Button variant="primary" onClick={setBankroll} data-testid="set-bankroll">
                Set bankroll to {formatMoney(safeBuyIn)}
              </Button>
              <Button variant={confirmReset ? 'danger' : 'ghost'} onClick={resetSession} onBlur={() => setConfirmReset(false)}>
                {confirmReset ? 'Confirm: reset session' : 'Reset session'}
              </Button>
            </div>
            {notice && (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            )}
          </div>
        )}

        {tab === 'preferences' && (
          <div className={styles.prefs}>
            <Toggle label="Sound" description="Chips, cards, wins and losses — synthesized, no downloads" checked={settings.prefs.sound} onChange={(v) => settings.setPrefs({ sound: v })} />
            <Select<DealSpeed>
              label="Dealing speed"
              inline
              value={settings.prefs.dealSpeed}
              options={DEAL_SPEEDS.map((s) => ({ value: s.id, label: s.label }))}
              hint={DEAL_SPEEDS.find((s) => s.id === settings.prefs.dealSpeed)?.hint}
              onChange={(v) => settings.setPrefs({ dealSpeed: v })}
            />
            <Toggle label="Show the Coach" description="House edge, expected loss and the Dragon 7 / Panda 8 counts beside the table" checked={settings.prefs.showCoach} onChange={(v) => settings.setPrefs({ showCoach: v })} />
            <Toggle label="Beginner tips" description="A one-line explanation under every dealer call" checked={settings.prefs.beginnerTips} onChange={(v) => settings.setPrefs({ beginnerTips: v })} />
          </div>
        )}
      </Tabs>
    </Modal>
  );
}
