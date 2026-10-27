/**
 * AppShell — top bar, hash-routed view area and the settings dialog.
 * App.tsx supplies the views map; views read the route themselves via useHashRoute().
 */
import { Suspense, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { TopBar } from './chrome/TopBar';
import { ErrorBoundary } from './ErrorBoundary';
import { SettingsDialog, type SettingsTab } from './settings/SettingsDialog';
import { modeInfo, useHashRoute, type Mode } from './routing';
import styles from './AppShell.module.css';

export type ViewsMap = Readonly<Record<Mode, ComponentType>>;

export interface AppShellProps {
  views: ViewsMap;
}

function ViewFallback(): ReactNode {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.loadingDot} />
      Loading…
    </div>
  );
}

export function AppShell({ views }: AppShellProps): ReactNode {
  const route = useHashRoute();
  const [settings, setSettings] = useState<{ open: boolean; tab: SettingsTab }>({ open: false, tab: 'rules' });
  const mainRef = useRef<HTMLElement>(null);
  const View = views[route.mode];

  useEffect(() => {
    document.title = `${modeInfo(route.mode).label} — Baccarat Trainer`;
  }, [route.mode]);

  const openSettings = useCallback((tab?: SettingsTab) => setSettings({ open: true, tab: tab ?? 'rules' }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);

  return (
    <div className={styles.app}>
      <a
        href="#main"
        className={styles.skip}
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      <TopBar route={route} onOpenSettings={openSettings} />
      <main id="main" ref={mainRef} className={styles.main} tabIndex={-1} data-mode={route.mode}>
        <ErrorBoundary label={`the ${modeInfo(route.mode).label} view`} key={route.mode}>
          <Suspense fallback={<ViewFallback />}>
            <View />
          </Suspense>
        </ErrorBoundary>
      </main>
      <SettingsDialog open={settings.open} initialTab={settings.tab} onClose={closeSettings} />
    </div>
  );
}
