import { formatMoney } from '@/engine';
import { DRAGON7_COUNT, PANDA8_COUNT } from './counting';
import { getSelector } from './selectors';
import { getSystem, paramValue } from './systems';
import type { BettingSystem, CountSystem, SideBetMode, StrategyConfig } from './types';

function systemText(system: BettingSystem, params?: Record<string, number>): string {
  if (system.params.length === 0) return system.name;
  const settings = system.params.map((spec) => `${spec.label.toLowerCase()} ${paramValue(spec, params)}`);
  return `${system.name} (${settings.join(', ')})`;
}

function sideBetText(label: string, mode: SideBetMode, amount: number, count: CountSystem): string {
  switch (mode) {
    case 'always':
      return `${label} ${formatMoney(amount)} every hand`;
    case 'count':
      return `${label} ${formatMoney(amount)} at true count ${count.threshold}+`;
    default:
      return `no ${label}`;
  }
}

/** One readable sentence for a strategy, e.g. "Always Banker, flat betting, $10 unit; Dragon 7 $10 at true count 4+; no Panda 8." */
export function describeStrategy(config: StrategyConfig): string {
  const selector = getSelector(config.selectorId);
  const system = getSystem(config.systemId);
  const selectorPart = selector ? selector.name : `unknown selector "${config.selectorId}"`;
  const systemPart = system ? systemText(system, config.systemParams) : `unknown system "${config.systemId}"`;
  const unitPart = `${formatMoney(config.unit)} unit`;
  const sideAmount = config.sideBets.units * config.unit;
  const dragon = sideBetText('Dragon 7', config.sideBets.units > 0 ? config.sideBets.dragon7 : 'never', sideAmount, DRAGON7_COUNT);
  const panda = sideBetText('Panda 8', config.sideBets.units > 0 ? config.sideBets.panda8 : 'never', sideAmount, PANDA8_COUNT);
  return `${selectorPart}, ${systemPart}, ${unitPart}; ${dragon}; ${panda}.`;
}
