/**
 * <LearnView/> — the Learn mode: a lesson sidebar, the lesson index at #learn, each lesson at #learn/<id> and
 * the drills hub at #learn/drills. Lessons are code-split and loaded on demand.
 */
import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Button, ErrorBoundary, cx, ruleSummary, toHash, useHashRoute, useSettings } from '@/ui/shell';
import { useCompletedLessons, type CompletedMap } from './lessons/components';
import { DRILLS_ID, LESSONS, LESSON_COMPONENTS, isLessonId, preloadLesson, type LessonId } from './lessons/registry';
import styles from './LearnView.module.css';

const DrillsHub = lazy(() => import('./drillsEntry'));

const DRILL_NAMES = ['Third-card rules', 'Payouts', 'Best bet', 'Reading roads', 'Card counting'];

function Loading({ what }: { what: string }): ReactNode {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.loadingDot} aria-hidden="true" />
      Loading {what}…
    </div>
  );
}

function LessonRoute({ id }: { id: LessonId }): ReactNode {
  const Lesson = LESSON_COMPONENTS[id];
  return (
    <ErrorBoundary key={id} label="this lesson">
      <Suspense fallback={<Loading what="lesson" />}>
        <Lesson />
      </Suspense>
    </ErrorBoundary>
  );
}

function DrillsRoute(): ReactNode {
  return (
    <ErrorBoundary
      label="the drills"
      fallback={(error, reset) => (
        <div className={styles.notice} role="alert" data-drills-unavailable>
          <h2>The drills could not be loaded</h2>
          <p>{error.message}</p>
          <div className={styles.noticeActions}>
            <Button size="sm" variant="primary" onClick={reset}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => (window.location.hash = toHash('learn'))}>
              Back to the lessons
            </Button>
          </div>
        </div>
      )}
    >
      <Suspense fallback={<Loading what="drills" />}>
        <DrillsHub />
      </Suspense>
    </ErrorBoundary>
  );
}

function NotFound({ id }: { id: string }): ReactNode {
  useEffect(() => {
    document.title = 'Lesson not found — Learn — Baccarat Trainer';
  }, []);
  return (
    <div className={styles.notice} data-lesson-missing>
      <h2>No lesson called &ldquo;{id}&rdquo;</h2>
      <p>Pick a lesson from the list, or start at the beginning.</p>
      <div className={styles.noticeActions}>
        <a href={toHash('learn')} className={styles.card}>
          <span className={styles.cardNo}>Learn</span>
          <span className={styles.cardTitle}>All lessons</span>
        </a>
        <a href={toHash('learn', 'basics')} className={styles.card}>
          <span className={styles.cardNo}>Lesson 1</span>
          <span className={styles.cardTitle}>The Basics</span>
        </a>
      </div>
    </div>
  );
}

function LearnIndex({ completed }: { completed: CompletedMap }): ReactNode {
  const { rules } = useSettings();
  const done = LESSONS.filter((l) => completed[l.id]).length;
  useEffect(() => {
    document.title = 'Learn — Baccarat Trainer';
  }, []);
  return (
    <div className={styles.index} data-learn-index>
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Learn baccarat</h1>
        <p className={styles.heroLede}>
          Eight short lessons take you from the layout to the maths of the side bets, with live examples that use the same engine, roads and
          probabilities as the table. Then prove it in the drills.
        </p>
        <span className={styles.heroNote}>
          <span>Numbers in the lessons use your table:</span>
          <strong>{ruleSummary(rules)}</strong>
          <span>· change it under Settings</span>
        </span>
      </div>
      <div className={styles.grid}>
        {LESSONS.map((l) => (
          <a key={l.id} href={toHash('learn', l.id)} className={styles.card} onMouseEnter={() => preloadLesson(l.id)} onFocus={() => preloadLesson(l.id)}>
            <span className={styles.cardNo}>Lesson {l.number}</span>
            <span className={styles.cardTitle}>{l.title}</span>
            <span className={styles.cardBlurb}>{l.blurb}</span>
            <span className={styles.cardMeta}>
              <span>About {l.minutes} min</span>
              {l.drill && <span>Drill: {l.drill}</span>}
            </span>
            {completed[l.id] && (
              <span className={styles.cardDone} aria-label="Completed">
                ✓ Done
              </span>
            )}
          </a>
        ))}
        <a href={toHash('learn', DRILLS_ID)} className={cx(styles.card, styles.drills)}>
          <span className={styles.cardNo}>Drills · {done} of {LESSONS.length} lessons completed</span>
          <span className={styles.cardTitle}>Practise with scoring</span>
          <span className={styles.cardBlurb}>Random situations, instant feedback and a streak counter; your scores are saved on this device.</span>
          <ul className={styles.drillsList} aria-label="Drills">
            {DRILL_NAMES.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </a>
      </div>
    </div>
  );
}

export function LearnView(): ReactNode {
  const route = useHashRoute();
  const lessonId = route.lessonId;
  const [completed] = useCompletedLessons();
  const isDrills = lessonId === DRILLS_ID;
  const current: LessonId | null = isLessonId(lessonId) ? lessonId : null;
  const unknown = lessonId !== null && !isDrills && current === null;
  const done = LESSONS.filter((l) => completed[l.id]).length;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [lessonId]);

  return (
    <div className={styles.view} data-learn-route={lessonId ?? 'index'}>
      <aside className={styles.sidebar}>
        <nav className={styles.nav} aria-label="Lessons">
          <a href={toHash('learn')} className={cx(styles.navLink, styles.navHome, lessonId === null && styles.navActive)} aria-current={lessonId === null ? 'page' : undefined}>
            Learn
          </a>
          <span className={styles.navDivider} aria-hidden="true" />
          <ol className={styles.navList}>
            {LESSONS.map((l) => (
              <li key={l.id}>
                <a
                  href={toHash('learn', l.id)}
                  className={cx(styles.navLink, current === l.id && styles.navActive)}
                  aria-current={current === l.id ? 'page' : undefined}
                  onMouseEnter={() => preloadLesson(l.id)}
                  onFocus={() => preloadLesson(l.id)}
                  data-lesson-link={l.id}
                >
                  <span className={styles.navNo} aria-hidden="true">
                    {l.number}
                  </span>
                  <span className={styles.navTitle}>{l.short}</span>
                  {completed[l.id] && (
                    <span className={styles.navDone} aria-label="completed">
                      ✓
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ol>
          <span className={styles.navDivider} aria-hidden="true" />
          <a href={toHash('learn', DRILLS_ID)} className={cx(styles.navLink, styles.navDrills, isDrills && styles.navActive)} aria-current={isDrills ? 'page' : undefined} data-lesson-link={DRILLS_ID}>
            <span className={styles.navNo} aria-hidden="true">
              D
            </span>
            <span className={styles.navTitle}>Drills</span>
          </a>
          <div className={styles.navProgress}>
            {done} of {LESSONS.length} completed
            <div className={styles.progressTrack} aria-hidden="true">
              <div className={styles.progressFill} style={{ width: `${(done / LESSONS.length) * 100}%` }} />
            </div>
          </div>
        </nav>
      </aside>
      <div className={styles.content}>
        {lessonId === null && <LearnIndex completed={completed} />}
        {current !== null && <LessonRoute id={current} />}
        {isDrills && <DrillsRoute />}
        {unknown && lessonId !== null && <NotFound id={lessonId} />}
      </div>
    </div>
  );
}
