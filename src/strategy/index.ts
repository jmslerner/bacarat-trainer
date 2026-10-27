/**
 * `@/strategy` — bet selectors, betting systems, counting systems and the Monte Carlo simulator (SPEC §5.3).
 * Pure TypeScript plus a Web Worker entry (`worker.ts`, used through `simulateInWorker`).
 */
export type {
  MainChoice,
  CountState,
  StrategyContext,
  BetSelector,
  SystemParamSpec,
  SystemState,
  BettingSystem,
  CountSystem,
  SideBetMode,
  SideBetPolicy,
  StrategyConfig,
  SimConfig,
  HistogramBin,
  SideBetSimStats,
  SimResult,
  CountEvRow,
} from './types';
export { BET_SELECTORS, getSelector, lastDecisiveOutcome, sideColumnStats, type SideColumnStats } from './selectors';
export { BETTING_SYSTEMS, getSystem, paramValue, fibonacci } from './systems';
export {
  CARDS_PER_DECK,
  DRAGON7_COUNT,
  PANDA8_COUNT,
  COUNT_SYSTEMS,
  cardTag,
  runningCount,
  decksRemaining,
  trueCount,
  countState,
  countStates,
  isCountFavourable,
} from './counting';
export {
  CARD_VALUE_LABELS,
  cardMultiplicities,
  shoeSum,
  isBalanced,
  bettingCorrelation,
  describeTagSet,
  formatTags,
  searchBalancedTagSets,
  type CardValue,
  type TagSetCandidate,
  type TagSearchOptions,
} from './eor';
export {
  DEFAULT_TC_EDGES,
  simulateCountEv,
  pooledStats,
  recommendThreshold,
  returnPerHundredHands,
  betFrequency,
  toCountEvRows,
  type SideBetKind,
  type CountEvSystemSpec,
  type CountEvBucket,
  type CountEvStats,
  type CountEvOptions,
  type PooledStats,
} from './countEv';
export { COUNT_EV_TABLE, COUNT_EV_META, countEvFrom, type CountEvAtThreshold } from './countEvTable';
export { runSimulation, validateSimConfig, buildHistogram, percentile, niceStep, DEFAULT_SAMPLE_CURVES, DEFAULT_CURVE_POINTS } from './simulate';
export { simulateInWorker, SimulationCancelledError, type WorkerSimulation } from './simulateInWorker';
export type { WorkerRequest, WorkerResponse } from './workerProtocol';
export { describeStrategy } from './describe';
