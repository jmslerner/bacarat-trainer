import { lazy, type ComponentType } from 'react';
import { AppShell, Providers, type Mode } from '@/ui/shell';
import { PlayView } from '@/ui/play';

/**
 * The views map, one component per mode. Views take no props: they read the route (mode / lessonId) with
 * `useHashRoute()` and the game with `useSession()` / `useSettings()` from '@/ui/shell'.
 *
 * Play is the default view and loads eagerly; Learn (lessons + drills) and the Strategy Lab are code-split
 * and load on first visit (the shell renders every view inside <Suspense> and an ErrorBoundary).
 */
const LearnView = lazy(() => import('@/ui/learn').then((m) => ({ default: m.LearnView })));
const LabView = lazy(() => import('@/ui/lab').then((m) => ({ default: m.LabView })));

export const VIEWS: Readonly<Record<Mode, ComponentType>> = {
  play: PlayView,
  learn: LearnView,
  lab: LabView,
};

export default function App(): JSX.Element {
  return (
    <Providers>
      <AppShell views={VIEWS} />
    </Providers>
  );
}
