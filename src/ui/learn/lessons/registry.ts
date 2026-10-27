/**
 * The lesson course: metadata, ordering and lazy component loaders.
 * Lessons live in ./<id>.tsx and are loaded on demand so each one (and its dependencies) is its own chunk.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type LessonId = 'basics' | 'third-card' | 'bets-and-odds' | 'dragon-panda' | 'roads' | 'money' | 'counting' | 'casino-procedure';

/** Drill routes under #learn/drills/<id> (the ids of the drills module, SPEC §5.6). */
export type LessonDrillId = 'third-card' | 'payout' | 'best-bet' | 'road' | 'counting';

export interface LessonMeta {
  id: LessonId;
  /** 1-based position in the course. */
  number: number;
  title: string;
  /** Short name for the sidebar. */
  short: string;
  blurb: string;
  /** Rough reading time in minutes. */
  minutes: number;
  /** The drill (under #learn/drills) that practises this lesson. */
  drill?: string;
  /** The drill to open from the lesson footer; without it the footer links to the drills hub. */
  drillId?: LessonDrillId;
}

/** Route id of the drills hub: #learn/drills. */
export const DRILLS_ID = 'drills';

/** The hash of the drills hub, or of one drill (`#learn/drills/<id>`; the hub falls back to its index for unknown ids). */
export function drillsHash(drillId?: LessonDrillId): string {
  return drillId ? `#learn/${DRILLS_ID}/${drillId}` : `#learn/${DRILLS_ID}`;
}

export const LESSONS: readonly LessonMeta[] = [
  {
    id: 'basics',
    number: 1,
    title: 'The Basics',
    short: 'Basics',
    blurb: 'The object of the game, a tour of the table, card values and a hand dealt step by step.',
    minutes: 8,
  },
  {
    id: 'third-card',
    number: 2,
    title: 'The Third-Card Rules',
    short: 'Third-card rules',
    blurb: 'When the Player draws, when the Banker draws, and an explorer that explains every case.',
    minutes: 10,
    drill: 'Third-card drill',
    drillId: 'third-card',
  },
  {
    id: 'bets-and-odds',
    number: 3,
    title: 'Bets, Payouts and the House Edge',
    short: 'Bets & odds',
    blurb: 'Every bet with its exact probability and house edge at your table, and what a session really costs.',
    minutes: 10,
    drill: 'Payout and best-bet drills',
    drillId: 'payout',
  },
  {
    id: 'dragon-panda',
    number: 4,
    title: 'Dragon 7 and Panda 8',
    short: 'Dragon 7 & Panda 8',
    blurb: 'How the Dragon 7 push replaces the commission, and what the two bonus bets really cost.',
    minutes: 8,
  },
  {
    id: 'roads',
    number: 5,
    title: 'Reading the Roads',
    short: 'Reading the roads',
    blurb: 'Bead plate, big road and the three derived roads, with live examples and the honest truth about patterns.',
    minutes: 14,
    drill: 'Road drill',
    drillId: 'road',
  },
  {
    id: 'money',
    number: 6,
    title: 'Money Management',
    short: 'Money management',
    blurb: 'Bankroll sizing, session swings, and every betting system with the way it fails.',
    minutes: 12,
  },
  {
    id: 'counting',
    number: 7,
    title: 'Counting the Side Bets',
    short: 'Counting',
    blurb: 'The Dragon 7 and Panda 8 counts: tags, running and true count, and what the count is worth.',
    minutes: 12,
    drill: 'Counting drill',
    drillId: 'counting',
  },
  {
    id: 'casino-procedure',
    number: 8,
    title: 'Casino Procedure and Etiquette',
    short: 'Casino procedure',
    blurb: 'Shoe, cut card, burn, commission, limits, the squeeze, and EZ versus classic versus Super 6.',
    minutes: 9,
  },
];

const BY_ID: ReadonlyMap<string, LessonMeta> = new Map(LESSONS.map((l) => [l.id, l]));

export function isLessonId(value: string | null | undefined): value is LessonId {
  return typeof value === 'string' && BY_ID.has(value);
}

export function lessonMeta(id: LessonId): LessonMeta {
  const meta = BY_ID.get(id);
  if (!meta) throw new RangeError(`Unknown lesson "${id}"`);
  return meta;
}

/** Previous and next lessons in course order. */
export function lessonNeighbours(id: LessonId): { prev: LessonMeta | null; next: LessonMeta | null } {
  const i = LESSONS.findIndex((l) => l.id === id);
  return { prev: i > 0 ? LESSONS[i - 1] : null, next: i >= 0 && i < LESSONS.length - 1 ? LESSONS[i + 1] : null };
}

type LessonModule = { default: ComponentType };

const LOADERS: Readonly<Record<LessonId, () => Promise<LessonModule>>> = {
  basics: () => import('./basics'),
  'third-card': () => import('./third-card'),
  'bets-and-odds': () => import('./bets-and-odds'),
  'dragon-panda': () => import('./dragon-panda'),
  roads: () => import('./roads'),
  money: () => import('./money'),
  counting: () => import('./counting'),
  'casino-procedure': () => import('./casino-procedure'),
};

/** Warms a lesson's chunk (e.g. on hover of its link). Failures are ignored; rendering reports them. */
export function preloadLesson(id: LessonId): void {
  LOADERS[id]().catch(() => undefined);
}

function lazyLesson(id: LessonId): LazyExoticComponent<ComponentType> {
  return lazy(LOADERS[id]);
}

export const LESSON_COMPONENTS: Readonly<Record<LessonId, LazyExoticComponent<ComponentType>>> = {
  basics: lazyLesson('basics'),
  'third-card': lazyLesson('third-card'),
  'bets-and-odds': lazyLesson('bets-and-odds'),
  'dragon-panda': lazyLesson('dragon-panda'),
  roads: lazyLesson('roads'),
  money: lazyLesson('money'),
  counting: lazyLesson('counting'),
  'casino-procedure': lazyLesson('casino-procedure'),
};
