/**
 * Shared types and metadata for the Learn-mode drills (SPEC §5.6).
 *
 * Every drill is a self-contained React component that generates seeded questions, scores the answers in the
 * persisted `bt:drills` store and explains the rule behind each answer. `DrillsHub` lists them.
 */

export type DrillId = 'third-card' | 'payout' | 'best-bet' | 'road' | 'counting';

export const DRILL_IDS: readonly DrillId[] = ['third-card', 'payout', 'best-bet', 'road', 'counting'];

export interface DrillMeta {
  id: DrillId;
  title: string;
  /** Short name for narrow screens / breadcrumbs. */
  shortTitle: string;
  /** One-line description shown on the hub card. */
  blurb: string;
  /** What the drill trains, shown as a small caption. */
  skill: string;
  /** The lesson (`#learn/<lessonId>`) that teaches the material. */
  lessonId: string;
  /** A glyph for the hub card (never the only signifier). */
  icon: string;
  /** Keyboard hint shown on the hub card. */
  keys: string;
}

export const DRILLS: readonly DrillMeta[] = [
  {
    id: 'third-card',
    title: 'Third-card rules',
    shortTitle: 'Third card',
    blurb: 'A legal two-card situation is dealt. Does Banker (or Player) draw? Answer, then see the rule row.',
    skill: 'Drawing rules',
    lessonId: 'third-card',
    icon: '3',
    keys: 'Y / N',
  },
  {
    id: 'payout',
    title: 'Payouts',
    shortTitle: 'Payouts',
    blurb: 'Chips on the layout, a hand is dealt. Work out your net result: pushes, commission, Dragon 7, pairs.',
    skill: 'Settlement',
    lessonId: 'bets-and-odds',
    icon: '$',
    keys: 'Type, Enter',
  },
  {
    id: 'best-bet',
    title: 'Best bet',
    shortTitle: 'Best bet',
    blurb: 'Three or four bets from the active table. Which one has the lowest house edge?',
    skill: 'House edge',
    lessonId: 'bets-and-odds',
    icon: '%',
    keys: '1 – 4',
  },
  {
    id: 'road',
    title: 'Reading the roads',
    shortTitle: 'Roads',
    blurb: 'A big road is shown. What colour will the next Big Eye Boy, Small Road or Cockroach Pig entry be?',
    skill: 'Derived roads',
    lessonId: 'roads',
    icon: '◯',
    keys: 'R / B',
  },
  {
    id: 'counting',
    title: 'Card counting',
    shortTitle: 'Counting',
    blurb: 'Cards flash at your pace. Keep the Dragon 7 or Panda 8 running count and enter it at the end.',
    skill: 'Running count',
    lessonId: 'counting',
    icon: '+2',
    keys: 'Type, Enter',
  },
];

export function isDrillId(value: unknown): value is DrillId {
  return typeof value === 'string' && (DRILL_IDS as readonly string[]).includes(value);
}

export function drillMeta(id: DrillId): DrillMeta {
  const meta = DRILLS.find((d) => d.id === id);
  if (!meta) throw new RangeError(`Unknown drill: ${id}`);
  return meta;
}

/** Props every drill accepts. */
export interface DrillProps {
  /**
   * Seed for the question generator: the same seed always produces the same sequence of questions
   * (question `i` is generated from `questionSeed(seed, i)`). Omitted → a random seed per mount.
   */
  seed?: number;
  /** Rendered as a "Back to drills" button when given. */
  onBack?: () => void;
  className?: string;
}

/** Saved score of one drill (persisted under `bt:drills`). */
export interface DrillScore {
  attempted: number;
  correct: number;
  /** Current run of correct answers. */
  streak: number;
  /** Longest run of correct answers. */
  best: number;
  /** Epoch ms of the last answer, null when never played. */
  updatedAt: number | null;
}

export type DrillScores = Record<DrillId, DrillScore>;
