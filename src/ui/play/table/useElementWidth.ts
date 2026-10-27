import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export interface ElementBox {
  /** `clientWidth` in CSS pixels (0 until measured). */
  width: number;
  /** The element's computed column gap in CSS pixels. */
  gap: number;
}

/** The width (and flex/grid column gap) of an element, kept current with a ResizeObserver. */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T>, ElementBox] {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<ElementBox>({ width: 0, gap: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = (): void => {
      const width = el.clientWidth;
      let gap = 0;
      try {
        gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      } catch {
        /* ignore */
      }
      setBox((prev) => (prev.width === width && prev.gap === gap ? prev : { width, gap }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, box];
}
