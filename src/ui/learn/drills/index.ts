/**
 * Learn-mode drills (SPEC §5.6): `<DrillsHub/>` plus the five drills, their pure question generators and the
 * persisted score store (`bt:drills`). The lessons view renders `<DrillsHub/>`; everything else is optional.
 */
export { DrillsHub, DRILL_COMPONENTS, drillHash, parseDrillHash } from './DrillsHub';
export type { DrillsHubProps } from './DrillsHub';
export { ThirdCardDrill } from './ThirdCardDrill';
export { PayoutDrill } from './PayoutDrill';
export { BestBetDrill } from './BestBetDrill';
export { RoadDrill } from './RoadDrill';
export { CountingDrill } from './CountingDrill';
export type { CountingDrillProps } from './CountingDrill';

export { DRILLS, DRILL_IDS, isDrillId, drillMeta } from './types';
export type { DrillId, DrillMeta, DrillProps, DrillScore, DrillScores } from './types';

export {
  DRILL_SCORES_KEY,
  EMPTY_SCORE,
  drillScoresStore,
  emptyScores,
  sanitizeDrillScores,
  recordDrillAnswer,
  resetDrillScore,
  resetAllDrillScores,
  accuracy,
  useDrillScores,
  useDrillScore,
} from './scores';

export { questionSeed } from './seeds';

export { generateThirdCardQuestion, explainThirdCard, BANKER_TABLE, PLAYER_RULE } from './thirdCard';
export type { ThirdCardQuestion, ThirdCardAsk, ThirdCardExplanation, BankerTableRow } from './thirdCard';
export { generatePayoutQuestion, explainSettlement, describeOutcome, outcomeBadges, parseNetAnswer, isNetCorrect, signedMoney, LAYOUT_ORDER } from './payout';
export type { PayoutQuestion, PayoutScenario } from './payout';
export { generateBestBetQuestion, explainBestBet, betPaysLabel, formatEdge } from './bestBet';
export type { BestBetQuestion, BestBetOption, BestBetMode } from './bestBet';
export { generateRoadQuestion, explainRoadEntry, randomRoadResults } from './road';
export type { RoadQuestion, RoadExplanation } from './road';
export {
  DRAGON7_COUNT,
  PANDA8_COUNT,
  DRILL_COUNT_SYSTEMS,
  COUNT_PACES,
  COUNT_LENGTHS,
  generateCountingCards,
  runningCountOf,
  cumulativeCounts,
  cardTagOf,
  trueCountEstimate,
  formatCount,
  parseCountAnswer,
} from './counting';
export type { DrillCountSystem, CountPaceId } from './counting';
