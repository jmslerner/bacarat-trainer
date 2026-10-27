/**
 * The configuration form: presets, table, strategy (selector + system + params), money, run size, stops,
 * side-bet policy and the seed. Every control is one of the shell's labelled form components.
 */
import { useId, type ReactNode } from 'react';
import { RULE_PRESETS, randomSeed } from '@/engine';
import type { TableRules } from '@/engine';
import { BET_SELECTORS, BETTING_SYSTEMS, DRAGON7_COUNT, PANDA8_COUNT, getSelector, getSystem } from '@/strategy';
import type { SideBetMode } from '@/strategy';
import { Button, NumberInput, Select, formatMoney, ruleSummary } from '@/ui/shell';
import type { SelectOption } from '@/ui/shell';
import { LAB_LIMITS, LAB_PRESETS, RULES_CHOICES, SIDE_BET_LABELS, applyLabPreset, defaultSystemParams, matchLabPreset, rulesChoiceLabel } from '../config';
import type { LabConfig, RulesChoice } from '../config';
import styles from '../Lab.module.css';

export interface ConfigFormProps {
  config: LabConfig;
  /** The table rules the form currently points at (the Settings dialog's rules for the "current" choice). */
  rules: TableRules;
  disabled?: boolean;
  onChange(patch: Partial<LabConfig>): void;
  onReplace(config: LabConfig): void;
}

const SIDE_MODE_OPTIONS: readonly SelectOption<SideBetMode>[] = [
  { value: 'never', label: 'Never' },
  { value: 'always', label: 'Every hand' },
  { value: 'count', label: 'Only when the count says so' },
];

export function ConfigForm({ config, rules, disabled, onChange, onReplace }: ConfigFormProps): ReactNode {
  const id = useId();
  const activePreset = matchLabPreset(config);
  const selector = getSelector(config.selectorId);
  const system = getSystem(config.systemId);
  const main = rules.limits.main;
  const side = rules.limits.side;
  const sideAmount = config.sideUnits * config.unit;

  const rulesOptions: readonly SelectOption<RulesChoice>[] = RULES_CHOICES.map((choice) => ({
    value: choice,
    label: choice === 'current' ? `${rulesChoiceLabel(choice)} (Settings dialog)` : `Preset — ${RULE_PRESETS[choice].name}`,
  }));
  const rulesHint = `${ruleSummary(rules)} · main ${formatMoney(main.min)}–${formatMoney(main.max)} · side ${formatMoney(side.min)}–${formatMoney(side.max)}`;

  const sideHint = (bet: 'dragon7' | 'panda8'): string => {
    if (!rules.sideBets[bet]) return `${SIDE_BET_LABELS[bet]} is not dealt on this table`;
    const mode = config[bet];
    const threshold = bet === 'dragon7' ? DRAGON7_COUNT.threshold : PANDA8_COUNT.threshold;
    if (mode === 'count') return `Bet only when the true count is ${threshold} or more`;
    if (mode === 'always') return `${formatMoney(sideAmount)} on every hand`;
    return 'No bet';
  };

  return (
    <div className={styles.form}>
      <div>
        <div className={styles.legend} id={`${id}-presets`}>
          Presets
        </div>
        <div className={styles.presets} role="group" aria-labelledby={`${id}-presets`}>
          {LAB_PRESETS.map((preset) => {
            const active = activePreset?.id === preset.id;
            return (
              <Button key={preset.id} size="sm" variant={active ? 'primary' : 'secondary'} active={active} disabled={disabled} title={preset.blurb} data-testid={`lab-preset-${preset.id}`} onClick={() => onReplace(applyLabPreset(config, preset))}>
                {preset.name}
              </Button>
            );
          })}
        </div>
        <p className={styles.presetBlurb} data-testid="lab-preset-blurb">
          {activePreset ? activePreset.blurb : 'Custom strategy: pick a preset or build your own below.'}
        </p>
      </div>

      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend className={styles.legend}>Table</legend>
        <Select<RulesChoice> label="Table rules" value={config.rulesChoice} options={rulesOptions} onChange={(rulesChoice) => onChange({ rulesChoice })} hint={rulesHint} />
      </fieldset>

      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend className={styles.legend}>Strategy</legend>
        <Select label="Bet selector" value={config.selectorId} options={BET_SELECTORS.map((s) => ({ value: s.id, label: s.name }))} onChange={(selectorId) => onChange({ selectorId })} hint={selector?.description} />
        <Select
          label="Betting system"
          value={config.systemId}
          options={BETTING_SYSTEMS.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(systemId) => onChange({ systemId, systemParams: defaultSystemParams(systemId) })}
          hint={system?.description}
        />
        {system && system.params.length > 0 && (
          <div className={styles.grid2}>
            {system.params.map((spec) => (
              <NumberInput
                key={spec.key}
                label={spec.label}
                value={config.systemParams[spec.key] ?? spec.default}
                min={spec.min}
                max={spec.max}
                step={spec.step}
                decimals={spec.step >= 1 ? 0 : 2}
                hint={spec.description}
                onChange={(value) => onChange({ systemParams: { ...config.systemParams, [spec.key]: value } })}
              />
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend className={styles.legend}>Money</legend>
        <div className={styles.grid2}>
          <NumberInput label="Unit" value={config.unit} min={LAB_LIMITS.unit.min} max={LAB_LIMITS.unit.max} step={5} decimals={0} prefix="$" hint={`Base bet · table ${formatMoney(main.min)}–${formatMoney(main.max)}`} onChange={(unit) => onChange({ unit })} />
          <NumberInput label="Bankroll" value={config.bankroll} min={LAB_LIMITS.bankroll.min} max={LAB_LIMITS.bankroll.max} step={100} decimals={0} prefix="$" hint="Every trial starts with this" onChange={(bankroll) => onChange({ bankroll })} />
        </div>
        <div className={styles.grid2}>
          <NumberInput label="Stop loss" value={config.stopLoss} min={LAB_LIMITS.stop.min} max={LAB_LIMITS.stop.max} step={100} decimals={0} prefix="$" hint="Quit when down this much (0 = never)" onChange={(stopLoss) => onChange({ stopLoss })} />
          <NumberInput label="Stop win" value={config.stopWin} min={LAB_LIMITS.stop.min} max={LAB_LIMITS.stop.max} step={100} decimals={0} prefix="$" hint="Quit when up this much (0 = never)" onChange={(stopWin) => onChange({ stopWin })} />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend className={styles.legend}>Side bets</legend>
        <div className={styles.grid2}>
          <Select<SideBetMode> label="Dragon 7" value={config.dragon7} options={SIDE_MODE_OPTIONS} onChange={(dragon7) => onChange({ dragon7 })} disabled={disabled || !rules.sideBets.dragon7} hint={sideHint('dragon7')} />
          <Select<SideBetMode> label="Panda 8" value={config.panda8} options={SIDE_MODE_OPTIONS} onChange={(panda8) => onChange({ panda8 })} disabled={disabled || !rules.sideBets.panda8} hint={sideHint('panda8')} />
        </div>
        <NumberInput
          label="Side-bet size"
          value={config.sideUnits}
          min={LAB_LIMITS.sideUnits.min}
          max={LAB_LIMITS.sideUnits.max}
          step={1}
          decimals={0}
          suffix="units"
          hint={`${formatMoney(sideAmount)} a bet · table ${formatMoney(side.min)}–${formatMoney(side.max)}`}
          onChange={(sideUnits) => onChange({ sideUnits })}
        />
      </fieldset>

      <fieldset className={styles.fieldset} disabled={disabled}>
        <legend className={styles.legend}>Simulation</legend>
        <div className={styles.grid2}>
          <NumberInput label="Shoes per trial" value={config.shoesPerTrial} min={LAB_LIMITS.shoesPerTrial.min} max={LAB_LIMITS.shoesPerTrial.max} step={1} decimals={0} hint="One trial = one session" onChange={(shoesPerTrial) => onChange({ shoesPerTrial })} />
          <NumberInput label="Trials" value={config.trials} min={LAB_LIMITS.trials.min} max={LAB_LIMITS.trials.max} step={100} decimals={0} hint="Sessions to simulate" onChange={(trials) => onChange({ trials })} />
        </div>
        <div className={styles.seedRow}>
          <NumberInput label="Seed" value={config.seed} min={LAB_LIMITS.seed.min} max={LAB_LIMITS.seed.max} step={1} decimals={0} steppers={false} hint="Same seed, same cards: strategies can be compared fairly" onChange={(seed) => onChange({ seed })} />
          <Button size="md" variant="secondary" onClick={() => onChange({ seed: randomSeed() })} data-testid="lab-randomize">
            Randomize
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
