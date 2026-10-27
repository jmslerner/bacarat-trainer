/**
 * Placeholder for `<LearnView />` (src/ui/learn). Lists the lesson ids from the SPEC and
 * reflects #learn/<lessonId> from the route. Swapped out in src/App.tsx.
 */
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Button } from '../components/Button';
import { toHash, useHashRoute } from '../routing';
import styles from './Placeholders.module.css';

export const LESSON_IDS: ReadonlyArray<{ id: string; title: string; blurb: string }> = [
  { id: 'basics', title: 'Basics', blurb: 'Layout tour, card values and a step-through hand.' },
  { id: 'third-card', title: 'Third-card rules', blurb: 'The full table with an interactive explorer.' },
  { id: 'bets-and-odds', title: 'Bets & odds', blurb: 'Payouts, exact probabilities and house edges.' },
  { id: 'dragon-panda', title: 'Dragon 7 & Panda 8', blurb: 'Why EZ Banker is commission-free, and what the bonuses cost.' },
  { id: 'roads', title: 'Reading the roads', blurb: 'Bead plate, big road and the three derived roads.' },
  { id: 'money', title: 'Money management', blurb: 'Bankroll sizing and why systems fail.' },
  { id: 'counting', title: 'Counting the side bets', blurb: 'Dragon 7 and Panda 8 counts, thresholds and EV.' },
  { id: 'casino-procedure', title: 'Casino procedure', blurb: 'Shoe, cut card, burn, commission, etiquette.' },
];

export function LearnPlaceholder(): ReactNode {
  const route = useHashRoute();
  const active = LESSON_IDS.find((l) => l.id === route.lessonId) ?? null;
  return (
    <div className={styles.view}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Learn</h1>
          <p className={styles.lede}>
            {active ? `Lesson "${active.title}" (#learn/${active.id}) opens here.` : 'Lessons and drills mount here. Pick a lesson to see the route change.'}
          </p>
        </div>
        <span className={styles.note}>Learn view · placeholder</span>
      </div>
      <div className={styles.lessons}>
        {LESSON_IDS.map((l, i) => (
          <a key={l.id} href={toHash('learn', l.id)} className={cx(styles.lesson, route.lessonId === l.id && styles.lessonActive)} aria-current={route.lessonId === l.id ? 'page' : undefined}>
            <span className={styles.lessonNo}>Lesson {i + 1}</span>
            <span className={styles.lessonTitle}>{l.title}</span>
            <span className={styles.lessonDesc}>{l.blurb}</span>
          </a>
        ))}
      </div>
      {active && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => { window.location.hash = toHash('learn'); }}>
            ← All lessons
          </Button>
        </div>
      )}
    </div>
  );
}
