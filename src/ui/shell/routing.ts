/**
 * Hash routing: #play (default), #learn, #learn/<lessonId>, #lab.
 * Views read the route with `useHashRoute()`; navigation is a plain hash change (links work).
 */
import { useMemo, useSyncExternalStore } from 'react';

export type Mode = 'play' | 'learn' | 'lab';

export interface Route {
  mode: Mode;
  /** Only for #learn/<lessonId>. */
  lessonId: string | null;
  /** The raw hash this route was parsed from. */
  hash: string;
}

export interface ModeInfo {
  id: Mode;
  label: string;
  /** Short label for narrow screens. */
  shortLabel: string;
  hash: string;
  title: string;
}

export const MODES: readonly ModeInfo[] = [
  { id: 'play', label: 'Play', shortLabel: 'Play', hash: '#play', title: 'Play — the casino table' },
  { id: 'learn', label: 'Learn', shortLabel: 'Learn', hash: '#learn', title: 'Learn — lessons and drills' },
  { id: 'lab', label: 'Strategy Lab', shortLabel: 'Lab', hash: '#lab', title: 'Strategy Lab — simulate betting strategies' },
];

export const DEFAULT_MODE: Mode = 'play';

const MODE_IDS = new Set<string>(MODES.map((m) => m.id));
const LESSON_ID = /^[a-z0-9][a-z0-9_-]*$/i;

export function isMode(value: string): value is Mode {
  return MODE_IDS.has(value);
}

/** Parse a location hash (with or without '#'). Unknown hashes resolve to the default mode. */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    path = raw;
  }
  const segments = path.replace(/^\/+/, '').split('/').map((s) => s.trim());
  const first = (segments[0] ?? '').toLowerCase();
  if (!isMode(first)) return { mode: DEFAULT_MODE, lessonId: null, hash };
  const second = segments[1] ?? '';
  const lessonId = first === 'learn' && second !== '' && LESSON_ID.test(second) ? second : null;
  return { mode: first, lessonId, hash };
}

/** Build a hash for a mode (and lesson). */
export function toHash(mode: Mode, lessonId?: string | null): string {
  if (mode === 'learn' && lessonId) return `#learn/${encodeURIComponent(lessonId)}`;
  return `#${mode}`;
}

/** Navigate by changing the hash (adds a history entry). Accepts a mode or a full hash. */
export function navigate(target: Mode | string, lessonId?: string | null): void {
  if (typeof window === 'undefined') return;
  const hash = isMode(target) ? toHash(target, lessonId) : target.startsWith('#') ? target : `#${target}`;
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

const getHash = (): string => (typeof window === 'undefined' ? '' : window.location.hash);
const getServerHash = (): string => '';

/** The current route, re-rendering on hash changes. */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  return useMemo(() => parseHash(hash), [hash]);
}

export function modeInfo(mode: Mode): ModeInfo {
  return MODES.find((m) => m.id === mode) ?? MODES[0];
}
