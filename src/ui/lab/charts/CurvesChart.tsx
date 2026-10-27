/**
 * Sample bankroll curves (SVG, hand-rolled): one thin line per sampled trial, coloured by whether it finished
 * above or below the starting bankroll, which is drawn as a dashed gold line. A crosshair follows the pointer
 * (or the arrow keys when the chart has focus) and reads the highest, median and lowest bankroll at that hand.
 */
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cx, formatMoney, formatMoneyCompact, formatNumber } from '@/ui/shell';
import { clamp, niceTicks, scaleLinear } from './scale';
import { useMeasuredWidth } from './useMeasuredWidth';
import styles from './Charts.module.css';

export interface CurvesChartProps {
  /** `SimResult.sampleCurves`: one series per sampled trial, all the same length. */
  curves: readonly (readonly number[])[];
  /** `SimResult.curveHands`: hands spanned by the x-axis. */
  curveHands: number;
  /** The starting bankroll of every trial. */
  start: number;
  title?: string;
  className?: string;
}

type Side = 'above' | 'below' | 'flat';
const LINE_CLASS: Record<Side, string> = { above: styles.lineAbove, below: styles.lineBelow, flat: styles.lineFlat };
const DOT_CLASS: Record<Side, string> = { above: styles.dotAbove, below: styles.dotBelow, flat: styles.dotFlat };
const MARGIN = { top: 26, right: 14, bottom: 32, left: 52 };

function sideOf(final: number, start: number): Side {
  return final > start + 1e-9 ? 'above' : final < start - 1e-9 ? 'below' : 'flat';
}

interface Readout {
  hand: number;
  highest: number;
  median: number;
  lowest: number;
  ahead: number;
}

export function CurvesChart({ curves, curveHands, start, title = 'Bankroll over the session', className }: CurvesChartProps): ReactNode {
  const id = useId();
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const height = width < 480 ? 220 : 260;
  const plotW = Math.max(10, width - MARGIN.left - MARGIN.right);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const baseline = MARGIN.top + plotH;
  const points = curves.length > 0 ? curves[0].length : 0;
  const last = Math.max(0, points - 1);

  const { lo, hi } = useMemo(() => {
    let min = Math.min(0, start);
    let max = start;
    for (const c of curves) for (const v of c) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { lo: min, hi: max };
  }, [curves, start]);
  const yTicks = useMemo(() => niceTicks(lo, hi, 5), [lo, hi]);
  const sy = useMemo(() => scaleLinear(yTicks.min, yTicks.max, baseline, MARGIN.top), [yTicks.min, yTicks.max, baseline]);
  const sx = useMemo(() => scaleLinear(0, last, MARGIN.left, MARGIN.left + plotW), [last, plotW]);
  const handAt = (index: number): number => (last === 0 ? 0 : Math.round((index * curveHands) / last));
  const xTicks = useMemo(() => niceTicks(0, Math.max(1, curveHands), 6).ticks.filter((h) => h <= curveHands), [curveHands]);
  const indexForHand = (hand: number): number => (curveHands === 0 ? 0 : (hand / curveHands) * last);

  const paths = useMemo(
    () =>
      curves.map((c) => {
        let d = '';
        for (let i = 0; i < c.length; i++) d += `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(c[i]).toFixed(1)}`;
        return { d, side: sideOf(c[c.length - 1], start) };
      }),
    [curves, sx, sy, start],
  );

  const readout: Readout | null = useMemo(() => {
    if (active === null || points === 0) return null;
    const values = curves.map((c) => c[Math.min(active, c.length - 1)]).sort((a, b) => a - b);
    const mid = values.length / 2;
    const median = values.length % 2 === 1 ? values[Math.floor(mid)] : (values[mid - 1] + values[mid]) / 2;
    return { hand: handAt(active), highest: values[values.length - 1], median, lowest: values[0], ahead: values.filter((v) => v > start).length };
  }, [active, curves, points, start]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    if (points === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < MARGIN.left - 6 || x > MARGIN.left + plotW + 6) {
      setActive(null);
      return;
    }
    setActive(clamp(Math.round(((x - MARGIN.left) / plotW) * last), 0, last));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (points === 0) return;
    const step = e.shiftKey ? Math.max(1, Math.round(last / 20)) : 1;
    let next: number | null | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp((active ?? -1) + step, 0, last);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp((active ?? last + 1) - step, 0, last);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') next = null;
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
  };

  const finals = curves.map((c) => c[c.length - 1]);
  const aheadTotal = finals.filter((f) => f > start).length;
  const summary =
    curves.length === 0
      ? 'No sample curves.'
      : `Bankroll of ${curves.length} sample trials over ${formatNumber(curveHands)} hands, starting at ${formatMoney(start)}; ${aheadTotal} finished above the start and ${curves.length - aheadTotal} at or below it.`;
  const readoutText = readout
    ? `Hand ${formatNumber(readout.hand)}: highest ${formatMoney(readout.highest)}, median ${formatMoney(readout.median)}, lowest ${formatMoney(readout.lowest)}; ${readout.ahead} of ${curves.length} ahead.`
    : '';
  const activeX = active !== null ? sx(active) : 0;
  const startY = clamp(sy(start), MARGIN.top, baseline);

  return (
    <figure className={cx(styles.figure, className)} aria-labelledby={`${id}-title`} data-testid="lab-curves">
      <figcaption className={styles.caption}>
        <span id={`${id}-title`} className={styles.captionTitle}>
          {title}
        </span>
        <span className={styles.captionSub}>{curves.length === 0 ? 'no sample trials' : `the first ${curves.length} trials, hand by hand`}</span>
      </figcaption>
      <div
        className={styles.frame}
        tabIndex={curves.length > 0 ? 0 : undefined}
        role={curves.length > 0 ? 'group' : undefined}
        aria-label={curves.length > 0 ? 'Bankroll curves; use the arrow keys to read values at each hand' : undefined}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <div ref={ref} className={styles.plot}>
          {curves.length === 0 ? (
            <p className={styles.empty}>No sample curves to show.</p>
          ) : (
            <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={summary} onPointerMove={onPointerMove} onPointerLeave={() => setActive(null)}>
              {yTicks.ticks.map((t) => (
                <g key={`y${t}`}>
                  <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={sy(t)} y2={sy(t)} className={t === 0 ? styles.axis : styles.grid} />
                  <text x={MARGIN.left - 6} y={sy(t) + 3.5} textAnchor="end" className={styles.tick}>
                    {formatMoneyCompact(t)}
                  </text>
                </g>
              ))}
              {yTicks.min !== 0 && <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={baseline} y2={baseline} className={styles.axis} />}
              {xTicks.map((h) => (
                <text key={`x${h}`} x={sx(indexForHand(h))} y={baseline + 16} textAnchor="middle" className={styles.tick}>
                  {formatNumber(h)}
                </text>
              ))}
              <text x={MARGIN.left + plotW} y={baseline + 28} textAnchor="end" className={styles.tick}>
                hands
              </text>
              {paths.map((p, i) => (
                <path key={i} d={p.d} className={cx(styles.line, LINE_CLASS[p.side])} data-curve={i} data-side={p.side} />
              ))}
              <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={startY} y2={startY} className={styles.startLine} />
              <text x={MARGIN.left + plotW} y={startY - 5} textAnchor="end" className={styles.startLabel}>
                Start {formatMoney(start)}
              </text>
              {active !== null && (
                <g data-crosshair>
                  <line x1={activeX} x2={activeX} y1={MARGIN.top - 4} y2={baseline} className={styles.crosshair} />
                  {curves.map((c, i) => (
                    <circle key={i} cx={activeX} cy={sy(c[Math.min(active, c.length - 1)])} r={3} className={cx(styles.dot, DOT_CLASS[paths[i].side])} />
                  ))}
                </g>
              )}
            </svg>
          )}
          {readout && (
            <div
              className={styles.tooltip}
              aria-hidden="true"
              style={{ left: clamp(activeX, 90, Math.max(90, width - 90)), top: MARGIN.top - 4, transform: 'translate(-50%, 0)' }}
            >
              <div className={styles.tooltipTitle}>Hand {formatNumber(readout.hand)}</div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipValue}>{formatMoney(readout.highest)}</span>
                <span>highest</span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipValue}>{formatMoney(readout.median)}</span>
                <span>median</span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipValue}>{formatMoney(readout.lowest)}</span>
                <span>lowest</span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipValue}>
                  {readout.ahead} of {curves.length}
                </span>
                <span>ahead</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className={styles.status} role="status" data-testid="lab-curves-readout">
        {readoutText}
      </p>
      <ul className={styles.legend} aria-label="Legend">
        <li>
          <span className={cx(styles.key, styles.keyAbove)} aria-hidden="true" /> Finished above the start
        </li>
        <li>
          <span className={cx(styles.key, styles.keyBelow)} aria-hidden="true" /> Finished at or below the start
        </li>
        <li>
          <span className={cx(styles.key, styles.keyStart)} aria-hidden="true" /> Starting bankroll {formatMoney(start)}
        </li>
      </ul>
      {curves.length > 0 && <p className={styles.hint}>Hover the chart, or focus it and use the arrow keys, to read the bankrolls at any hand.</p>}
      <details className={styles.details}>
        <summary>Show as a table</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">Sample trials: final, lowest and highest bankroll</caption>
            <thead>
              <tr>
                <th scope="col">Trial</th>
                <th scope="col">Final</th>
                <th scope="col">Lowest</th>
                <th scope="col">Highest</th>
              </tr>
            </thead>
            <tbody>
              {curves.map((c, i) => (
                <tr key={i}>
                  <td>Trial {i + 1}</td>
                  <td>{formatMoney(c[c.length - 1])}</td>
                  <td>{formatMoney(Math.min(...c))}</td>
                  <td>{formatMoney(Math.max(...c))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
