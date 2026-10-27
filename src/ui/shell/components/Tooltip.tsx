/**
 * Tooltip — hover/focus bubble rendered in a portal (position: fixed), keyboard dismissable.
 * The trigger (a single element child) receives aria-describedby when visible.
 */
import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: 'top' | 'bottom';
  /** Show delay in ms (hover only). */
  delay?: number;
  /** Max bubble width in px. */
  maxWidth?: number;
  className?: string;
  /** Force visible (controlled). */
  open?: boolean;
}

interface Pos {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

export function Tooltip({ content, children, placement = 'top', delay = 250, maxWidth = 260, className, open: forced }: TooltipProps): ReactNode {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const visible = forced ?? open;

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const half = maxWidth / 2;
    const left = Math.min(Math.max(r.left + r.width / 2, half + 8), Math.max(half + 8, vw - half - 8));
    let place = placement;
    if (place === 'top' && r.top < 64) place = 'bottom';
    if (place === 'bottom' && r.bottom > window.innerHeight - 64) place = 'top';
    setPos({ top: place === 'top' ? r.top - 8 : r.bottom + 8, left, placement: place });
  }, [maxWidth, placement]);

  const show = useCallback(
    (immediate: boolean) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      const go = (): void => {
        measure();
        setOpen(true);
      };
      if (immediate || delay <= 0) go();
      else timer.current = window.setTimeout(go, delay);
    },
    [delay, measure],
  );

  const hide = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') hide();
    };
    const onMove = (): void => measure();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [visible, hide, measure]);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (forced) measure();
  }, [forced, measure]);

  const described = visible ? id : undefined;
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-describedby': described,
        onFocus: (e: unknown) => {
          const orig = (children as ReactElement<Record<string, unknown>>).props.onFocus;
          if (typeof orig === 'function') orig(e);
          show(true);
        },
        onBlur: (e: unknown) => {
          const orig = (children as ReactElement<Record<string, unknown>>).props.onBlur;
          if (typeof orig === 'function') orig(e);
          hide();
        },
      })
    : children;

  const style: CSSProperties | undefined = pos
    ? { top: pos.top, left: pos.left, maxWidth, transform: pos.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }
    : undefined;

  return (
    <>
      <span ref={anchorRef} className={cx(styles.anchor, className)} onPointerEnter={() => show(false)} onPointerLeave={hide} onPointerDown={() => show(true)}>
        {child}
      </span>
      {visible && pos && typeof document !== 'undefined'
        ? createPortal(
            <div role="tooltip" id={id} className={cx(styles.bubble, styles[pos.placement])} style={style}>
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
