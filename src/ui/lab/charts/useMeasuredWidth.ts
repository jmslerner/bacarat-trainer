import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * The rendered width of an element in CSS pixels, kept up to date with a ResizeObserver (window resize as a
 * fallback). The charts draw into a viewBox of this width so their text stays a constant pixel size.
 */
export function useMeasuredWidth<T extends HTMLElement>(fallback = 640): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : Math.round(w)));
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return [ref, width];
}
