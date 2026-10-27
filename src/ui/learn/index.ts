/**
 * `@/ui/learn` — the Learn mode: lessons (src/ui/learn/lessons) and the drills hub (src/ui/learn/drills).
 */
export { LearnView } from './LearnView';
export { LESSONS, DRILLS_ID, drillsHash, isLessonId, lessonMeta, lessonNeighbours, preloadLesson } from './lessons/registry';
export type { LessonId, LessonDrillId, LessonMeta } from './lessons/registry';
