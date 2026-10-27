import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { CELL, cls } from './symbols';
import styles from './roads.module.css';

export interface RoadFrameProps {
  /** Columns visible at once; defines the scale (cell size = container width / cols). */
  cols: number;
  rows: number;
  /** Columns actually drawn (>= cols). Extra columns scroll horizontally. */
  totalCols: number;
  /** Accessible description of the road. */
  label: string;
  /** Any change scrolls the frame to the right end (the newest columns). */
  scrollKey: string | number;
  /** Identifies the road in the DOM (`data-road`). */
  road: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Scrollable SVG grid shared by all road views. The SVG scales with its container through `viewBox`; when the
 * road is wider than `cols`, the SVG grows beyond the frame and the frame auto-scrolls to the newest columns.
 */
export function RoadFrame({ cols, rows, totalCols, label, scrollKey, road, className, children }: RoadFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const overflows = totalCols > cols;

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.scrollLeft = el.scrollWidth;
  }, [scrollKey, totalCols, cols]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      el.scrollLeft = el.scrollWidth;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const width = totalCols * CELL;
  const height = rows * CELL;
  const lines: ReactNode[] = [];
  for (let c = 1; c < totalCols; c += 1) {
    lines.push(<line key={`v${c}`} x1={c * CELL} y1={0} x2={c * CELL} y2={height} vectorEffect="non-scaling-stroke" />);
  }
  for (let r = 1; r < rows; r += 1) {
    lines.push(<line key={`h${r}`} x1={0} y1={r * CELL} x2={width} y2={r * CELL} vectorEffect="non-scaling-stroke" />);
  }

  return (
    <div
      ref={ref}
      className={cls(styles.frame, className)}
      data-road={road}
      // A road wider than its frame scrolls sideways. Firefox and Safari do not let the keyboard reach a plain
      // scroll container, so make it focusable (with a name) only while it actually overflows.
      tabIndex={overflows ? 0 : undefined}
      role={overflows ? 'group' : undefined}
      aria-label={overflows ? `${label} (scrolls sideways)` : undefined}
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: `${(totalCols / cols) * 100}%` }}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={label}
        focusable="false"
      >
        <g className={styles.grid} shapeRendering="crispEdges">
          {lines}
        </g>
        {children}
      </svg>
    </div>
  );
}
