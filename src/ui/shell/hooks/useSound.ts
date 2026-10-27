/**
 * useSound(): synthesized casino sounds that respect the "sound" preference and never throw.
 */
import { useCallback, useMemo } from 'react';
import { useStore } from './storage';
import { prefsStore } from './useSettings';
import { soundEngine, type SoundName } from './soundEngine';

export type { SoundName } from './soundEngine';
export { SOUND_NAMES } from './soundEngine';

/** Play a sound if sound is enabled. Safe to call from anywhere (no hooks needed). */
export function playSound(name: SoundName): void {
  try {
    if (!prefsStore.get().sound) return;
    soundEngine.play(name);
  } catch {
    /* never throw */
  }
}

export interface SoundApi {
  play(name: SoundName): void;
  enabled: boolean;
  setEnabled(on: boolean): void;
  toggle(): void;
}

export function useSound(): SoundApi {
  const prefs = useStore(prefsStore);
  const enabled = prefs.sound;
  const play = useCallback((name: SoundName) => playSound(name), []);
  const setEnabled = useCallback((on: boolean) => {
    prefsStore.set((p) => ({ ...p, sound: on }));
    if (on) {
      try {
        soundEngine.play('click');
      } catch {
        /* ignore */
      }
    }
  }, []);
  const toggle = useCallback(() => setEnabled(!prefsStore.get().sound), [setEnabled]);
  return useMemo(() => ({ play, enabled, setEnabled, toggle }), [play, enabled, setEnabled, toggle]);
}
