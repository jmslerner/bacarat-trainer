/**
 * Modal — portal dialog with focus trap, Escape/backdrop close, scroll lock and focus restore.
 */
import { useCallback, useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx';
import styles from './Modal.module.css';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Small text under the title. */
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  /** Element to focus when the dialog opens (defaults to the first focusable control). */
  initialFocusRef?: RefObject<HTMLElement>;
  hideCloseButton?: boolean;
  className?: string;
  /** Extra content on the header's right (before the close button). */
  headerExtra?: ReactNode;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

let openCount = 0;

export function Modal({ open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true, closeOnEscape = true, initialFocusRef, hideCloseButton, className, headerExtra }: ModalProps): ReactNode {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Focus management + scroll lock while open.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    openCount += 1;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = initialFocusRef?.current ?? focusables(panel).find((el) => !el.hasAttribute('data-modal-close')) ?? panel;
      try {
        target.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = prevOverflow;
      const el = restoreRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) {
        try {
          el.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
    };
  }, [open, initialFocusRef]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = focusables(panelRef.current);
      if (items.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    },
    [closeOnEscape, onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onKeyDown]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }} data-testid="modal-backdrop">
      <div
        ref={panelRef}
        className={cx(styles.frame, styles[size], className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div className={styles.panel}>
          {(title || !hideCloseButton || headerExtra) && (
            <header className={styles.header}>
              <div className={styles.headings}>
                {title && (
                  <h2 id={titleId} className={styles.title}>
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className={styles.description}>
                    {description}
                  </p>
                )}
              </div>
              {headerExtra}
              {!hideCloseButton && (
                <button type="button" className={styles.close} onClick={onClose} aria-label="Close dialog" data-modal-close>
                  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                  </svg>
                </button>
              )}
            </header>
          )}
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
