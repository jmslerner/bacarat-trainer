import { useCallback, useSyncExternalStore } from 'react';

function query(q: string): MediaQueryList | null {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(q) : null;
  } catch {
    return null;
  }
}

/** True when the media query matches (false on the server / in jsdom). */
export function useMediaQuery(q: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = query(q);
      if (!mql) return () => undefined;
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [q],
  );
  return useSyncExternalStore(subscribe, () => query(q)?.matches ?? false, () => false);
}

/** Breakpoints shared by the shell's layouts. */
export const BREAKPOINTS = { phone: '(max-width: 640px)', tablet: '(max-width: 1000px)', reducedMotion: '(prefers-reduced-motion: reduce)' } as const;

export function useIsPhone(): boolean {
  return useMediaQuery(BREAKPOINTS.phone);
}
export function useIsTablet(): boolean {
  return useMediaQuery(BREAKPOINTS.tablet);
}
