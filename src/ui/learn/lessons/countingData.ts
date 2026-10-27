/**
 * The counting lesson's data from the strategy module. This file is the only place in Learn that depends on
 * `@/strategy`; the shapes below mirror SPEC §5.3 so the lesson is typed against the contract.
 */
import { COUNT_EV_TABLE, DRAGON7_COUNT, PANDA8_COUNT } from '@/strategy';

/** SPEC §5.3 `CountSystem`: tags are indexed by card VALUE (0 = 10/J/Q/K, 1 = Ace, 2..9). */
export interface CountSystemShape {
  id: string;
  name: string;
  description: string;
  tags: number[];
  threshold: number;
}

/** SPEC §5.3 `CountEvRow`: simulated EV of a side bet for hands with true count in [tcMin, tcMax). */
export interface CountEvRowShape {
  tcMin: number;
  tcMax: number;
  hands: number;
  frequency: number;
  ev: number;
}

export const DRAGON7_SYSTEM: CountSystemShape = DRAGON7_COUNT;
export const PANDA8_SYSTEM: CountSystemShape = PANDA8_COUNT;
export const COUNT_EV: Readonly<Record<'dragon7' | 'panda8', readonly CountEvRowShape[]>> = COUNT_EV_TABLE;
