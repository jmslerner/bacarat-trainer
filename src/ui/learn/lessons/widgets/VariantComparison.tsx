/**
 * EZ Baccarat vs classic commission vs Super 6, with the house edges computed from the engine for each preset.
 */
import type { ReactNode } from 'react';
import { RULE_PRESETS, houseEdge, type TableRules } from '@/engine';
import { cx, formatMoney, formatPercent, matchPreset } from '@/ui/shell';
import { Table, tableClass } from '../components';

const PRESET_IDS = ['ez', 'commission', 'super6'] as const;

const BANKER_PAYS: Record<(typeof PRESET_IDS)[number], string> = {
  ez: '1:1, no commission; push on a Dragon 7',
  commission: '1:1 less 5% commission',
  super6: '1:1; a Banker win with 6 pays 1:2',
};

export function VariantComparison({ rules }: { rules: TableRules }): ReactNode {
  const active = matchPreset(rules);
  return (
    <Table caption="The three Banker rules side by side (8 decks)">
      <thead>
        <tr>
          <th scope="col" />
          {PRESET_IDS.map((id) => (
            <th key={id} scope="col" className={cx(active === id && tableClass.strong)}>
              {RULE_PRESETS[id].name}
              {active === id && <span className={tableClass.muted}> · your table</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className={tableClass.strong}>Banker pays</td>
          {PRESET_IDS.map((id) => (
            <td key={id}>{BANKER_PAYS[id]}</td>
          ))}
        </tr>
        <tr>
          <td className={tableClass.strong}>Banker house edge</td>
          {PRESET_IDS.map((id) => (
            <td key={id} className={tableClass.num} data-variant-edge={id}>
              {formatPercent(houseEdge('banker', RULE_PRESETS[id].rules), 2)}
            </td>
          ))}
        </tr>
        <tr>
          <td className={tableClass.strong}>Player house edge</td>
          {PRESET_IDS.map((id) => (
            <td key={id} className={tableClass.num}>
              {formatPercent(houseEdge('player', RULE_PRESETS[id].rules), 2)}
            </td>
          ))}
        </tr>
        <tr>
          <td className={tableClass.strong}>Banker: house keeps per {formatMoney(100)} bet</td>
          {PRESET_IDS.map((id) => (
            <td key={id} className={tableClass.num}>
              {formatMoney(houseEdge('banker', RULE_PRESETS[id].rules) * 100, { cents: true })}
            </td>
          ))}
        </tr>
        <tr>
          <td className={tableClass.strong}>Dragon 7 / Panda 8 bets</td>
          {PRESET_IDS.map((id) => (
            <td key={id}>{RULE_PRESETS[id].rules.sideBets.dragon7 ? 'Dealt' : 'Not dealt (pairs only)'}</td>
          ))}
        </tr>
        <tr>
          <td className={tableClass.strong}>What to remember</td>
          <td>Nothing to pay at the end; a Banker three-card 7 is a push.</td>
          <td>Commission owed on every Banker win; settle it before you leave.</td>
          <td>A Banker 6 pays half — it happens on about 5.4% of hands.</td>
        </tr>
      </tbody>
    </Table>
  );
}
