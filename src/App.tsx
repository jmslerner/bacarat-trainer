import type { ComponentType } from 'react';
import { AppShell, LabPlaceholder, LearnPlaceholder, PlayPlaceholder, Providers, type Mode } from '@/ui/shell';

// ─────────────────────────────────────────────────────────────────────────────────────────
// INTEGRATION POINT — the views map.
// Replace each placeholder with the real view when its module lands, e.g.
//
//   import { PlayView } from '@/ui/play';
//   import { LearnView } from '@/ui/learn';
//   import { LabView } from '@/ui/lab';
//   const VIEWS: ViewsMap = { play: PlayView, learn: LearnView, lab: LabView };
//
// Code-splitting works too (the shell renders views inside <Suspense>):
//   const LabView = lazy(() => import('@/ui/lab').then((m) => ({ default: m.LabView })));
//
// Views take no props: they read the route (mode / lessonId) with `useHashRoute()` and the
// game with `useSession()` / `useSettings()` from '@/ui/shell'.
// ─────────────────────────────────────────────────────────────────────────────────────────
export const VIEWS: Readonly<Record<Mode, ComponentType>> = {
  play: PlayPlaceholder,
  learn: LearnPlaceholder,
  lab: LabPlaceholder,
};

export default function App(): JSX.Element {
  return (
    <Providers>
      <AppShell views={VIEWS} />
    </Providers>
  );
}
