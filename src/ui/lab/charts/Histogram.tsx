/**
 * Histogram of final bankrolls (SVG, hand-rolled). Bars are coloured by which side of the starting bankroll
 * they sit; the start is marked with a dashed gold line. Hover a bar (or focus the chart and use the arrow
 * keys) for its range and count, read out in a status line; every value is also in the table under the chart.
 */
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { HistogramBin } from '@/strategy';
import { cx, formatMoney, formatMoneyCompact, formatNumber, formatPercent } from '@/ui/shell';
import { clamp, niceTicks, scaleLinear } from './scale';
import { useMeasuredWidth } from './useMeasuredWidth';
import styles from './Charts.module.css';

export interface HistogramProps {
  bins: readonly HistogramBin[];
  /** The starting bankroll of every trial. */
  start: number;
  trials: number;
  title?: string;
  className?: string;
}

type Side = 'below' | 'above' | 'across';

function binSide(bin: HistogramBin, start: number): Side {
  if (bin.binEnd <= start && bin.binStart < start) return 'below';
  if (bin.binStart >= start) return 'above';
  return 'across';
}

const SIDE_CLASS: Record<Side, string> = { below: styles.barBelow, above: styles.barAbove, across: styles.barAcross };
const MARGIN = { top: 26, right: 12, bottom: 32, left: 46 };

function rangeLabel(bin: HistogramBin, single: boolean): string {
  return single ? formatMoney(bin.binStart) : `${formatMoney(bin.binStart)} to ${formatMoney(bin.binEnd)}`;
}

export function Histogram({ bins, start, trials, title = 'Final bankrolls', className }: HistogramProps): ReactNode {
  const id = useId();
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const height = width < 480 ? 210 : 250;
  const plotW = Math.max(10, width - MARGIN.left - MARGIN.right);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const baseline = MARGIN.top + plotH;

  const single = bins.length === 1 && bins[0].binEnd === bins[0].binStart;
  const d0 = bins.length === 0 ? 0 : single ? bins[0].binStart - 0.5 : bins[0].binStart;
  const d1 = bins.length === 0 ? 1 : single ? bins[0].binEnd + 0.5 : bins[bins.length - 1].binEnd;
  const sx = useMemo(() => scaleLinear(d0, d1, MARGIN.left, MARGIN.left + plotW), [d0, d1, plotW]);
  const maxCount = bins.reduce((m, b) => Math.max(m, b.count), 0);
  const yTicks = useMemo(() => niceTicks(0, Math.max(1, maxCount), 4), [maxCount]);
  const sy = useMemo(() => scaleLinear(0, yTicks.max, baseline, MARGIN.top), [yTicks.max, baseline]);

  const total = bins.reduce((n, b) => n + b.count, 0) || trials || 1;
  const below = bins.reduce((n, b) => (binSide(b, start) === 'below' ? n + b.count : n), 0);
  const hasAcross = bins.some((b) => binSide(b, start) === 'across');
  const summary =
    bins.length === 0
      ? 'No trials to show.'
      : `Final bankrolls of ${formatNumber(trials)} trials in ${bins.length} bins from ${formatMoney(d0 + (single ? 0.5 : 0))} to ${formatMoney(d1 - (single ? 0.5 : 0))}; ${formatPercent(below / total, 0)} finished below the ${formatMoney(start)} start.`;

  // x-axis labels on every k-th bin edge so they never collide.
  const edges = bins.map((b) => b.binStart).concat(bins.length ? [bins[bins.length - 1].binEnd] : []);
  const bandPx = bins.length ? plotW / bins.length : plotW;
  const every = Math.max(1, Math.ceil(64 / bandPx));

  const barGeometry = (bin: HistogramBin): { x: number; w: number } => {
    const x0 = single ? MARGIN.left : sx(bin.binStart);
    const x1 = single ? MARGIN.left + plotW : sx(bin.binEnd);
    const band = x1 - x0;
    const w = Math.max(2, Math.min(24, band - 2));
    return { x: x0 + (band - w) / 2, w };
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    if (bins.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < MARGIN.left || x > MARGIN.left + plotW) {
      setHovered(null);
      return;
    }
    if (single) {
      setHovered(0);
      return;
    }
    const value = d0 + ((x - MARGIN.left) / plotW) * (d1 - d0);
    const binWidth = (d1 - d0) / bins.length;
    setHovered(clamp(Math.floor((value - d0) / binWidth), 0, bins.length - 1));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (bins.length === 0) return;
    const last = bins.length - 1;
    let next: number | null | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp((hovered ?? -1) + 1, 0, last);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp((hovered ?? last + 1) - 1, 0, last);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') next = null;
    if (next === undefined) return;
    e.preventDefault();
    setHovered(next);
  };

  const startX = clamp(sx(start), MARGIN.left, MARGIN.left + plotW);
  const startLabelRight = startX > MARGIN.left + plotW * 0.6;
  const hoveredBin = hovered !== null ? bins[hovered] : null;
  const hoverGeom = hoveredBin ? barGeometry(hoveredBin) : null;
  const readoutText = hoveredBin ? `${rangeLabel(hoveredBin, single)}: ${formatNumber(hoveredBin.count)} trials (${formatPercent(hoveredBin.count / total, 1)}).` : '';

  return (
    <figure className={cx(styles.figure, className)} aria-labelledby={`${id}-title`} data-testid="lab-histogram">
      <figcaption className={styles.caption}>
        <span id={`${id}-title`} className={styles.captionTitle}>
          {title}
        </span>
        <span className={styles.captionSub}>{formatNumber(trials)} trials · how often each finishing bankroll came up</span>
      </figcaption>
      <div
        className={styles.frame}
        tabIndex={bins.length > 0 ? 0 : undefined}
        role={bins.length > 0 ? 'group' : undefined}
        aria-label={bins.length > 0 ? 'Final bankroll histogram; use the arrow keys to read each bin' : undefined}
        onKeyDown={onKeyDown}
        onBlur={() => setHovered(null)}
      >
        <div ref={ref} className={styles.plot}>
          {bins.length === 0 ? (
            <p className={styles.empty}>No trials to show.</p>
          ) : (
            <svg
              className={styles.svg}
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              role="img"
              aria-label={summary}
              onPointerMove={onPointerMove}
              onPointerLeave={() => setHovered(null)}
            >
              {yTicks.ticks.map((t) => (
                <g key={`y${t}`}>
                  <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={sy(t)} y2={sy(t)} className={t === 0 ? styles.axis : styles.grid} />
                  <text x={MARGIN.left - 6} y={sy(t) + 3.5} textAnchor="end" className={styles.tick}>
                    {formatNumber(t)}
                  </text>
                </g>
              ))}
              {edges.map((edge, i) =>
                i % every === 0 ? (
                  <text key={`x${i}`} x={single ? MARGIN.left + plotW / 2 : sx(edge)} y={baseline + 16} textAnchor={single ? 'middle' : 'middle'} className={styles.tick}>
                    {single && i === 1 ? '' : formatMoneyCompact(edge)}
                  </text>
                ) : null,
              )}
              {bins.map((bin, i) => {
                const { x, w } = barGeometry(bin);
                const yTop = sy(bin.count);
                const h = baseline - yTop;
                if (h <= 0) return null;
                const r = Math.min(4, w / 2, h);
                const d = `M${x},${baseline}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${baseline}Z`;
                return (
                  <path key={i} d={d} className={cx(styles.bar, SIDE_CLASS[binSide(bin, start)], hovered === i && styles.barHover)} data-bin={i} data-count={bin.count}>
                    <title>{`${rangeLabel(bin, single)}: ${formatNumber(bin.count)} trials (${formatPercent(bin.count / total, 1)})`}</title>
                  </path>
                );
              })}
              <line x1={startX} x2={startX} y1={MARGIN.top - 8} y2={baseline} className={styles.startLine} />
              <text x={startLabelRight ? startX - 5 : startX + 5} y={MARGIN.top - 10} textAnchor={startLabelRight ? 'end' : 'start'} className={styles.startLabel}>
                Start {formatMoney(start)}
              </text>
            </svg>
          )}
          {hoveredBin && hoverGeom && (
            <div
              className={styles.tooltip}
              aria-hidden="true"
              style={{ left: clamp(hoverGeom.x + hoverGeom.w / 2, 70, Math.max(70, width - 70)), top: Math.max(0, sy(hoveredBin.count) - 8), transform: 'translate(-50%, -100%)' }}
            >
              <div className={styles.tooltipTitle}>{rangeLabel(hoveredBin, single)}</div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipValue}>{formatNumber(hoveredBin.count)} trials</span>
                <span>{formatPercent(hoveredBin.count / total, 1)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className={styles.status} role="status" data-testid="lab-histogram-readout">
        {readoutText}
      </p>
      <ul className={styles.legend} aria-label="Legend">
        <li>
          <span className={cx(styles.swatch, styles.swatchBelow)} aria-hidden="true" /> Finished below the start
        </li>
        <li>
          <span className={cx(styles.swatch, styles.swatchAbove)} aria-hidden="true" /> Finished at or above the start
        </li>
        {hasAcross && (
          <li>
            <span className={cx(styles.swatch, styles.swatchAcross)} aria-hidden="true" /> Straddles the start
          </li>
        )}
        <li>
          <span className={cx(styles.key, styles.keyStart)} aria-hidden="true" /> Starting bankroll {formatMoney(start)}
        </li>
      </ul>
      {bins.length > 0 && <p className={styles.hint}>Hover a bar, or focus the chart and use the arrow keys, to read each bin.</p>}
      <details className={styles.details}>
        <summary>Show as a table</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">Final bankroll distribution</caption>
            <thead>
              <tr>
                <th scope="col">Final bankroll</th>
                <th scope="col">Trials</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {bins.map((bin, i) => (
                <tr key={i}>
                  <td>{rangeLabel(bin, single)}</td>
                  <td>{formatNumber(bin.count)}</td>
                  <td>{formatPercent(bin.count / total, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
