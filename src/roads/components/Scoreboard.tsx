import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Side } from '@/engine';
import { predictNext } from '../derived';
import { roadStats } from '../stats';
import { DERIVED_KINDS, DERIVED_LABELS, type DerivedKind, type Prediction, type RoadColor, type RoadResult } from '../types';
import { BeadPlateView } from './BeadPlateView';
import { BigRoadView } from './BigRoadView';
import { DerivedRoadView } from './DerivedRoadView';
import { OUTCOME_LETTER, OUTCOME_NAME, cls } from './symbols';
import roadStyles from './roads.module.css';
import styles from './Scoreboard.module.css';

export interface ScoreboardProps {
  results: readonly RoadResult[];
  /**
   * Controlled "ask road" side: the side whose hypothetical next result is highlighted on the derived roads.
   * Omit it to let the Scoreboard manage the selection itself (the "Ask P" / "Ask B" buttons toggle it).
   */
  prediction?: Side | null;
  /** Called when an "Ask" button is pressed: the chosen side, or null when it is toggled off. */
  onPredict?: (side: Side | null) => void;
  /** Grid rows for every road (default 6). */
  rows?: number;
  /** Visible columns per road; by default chosen from the board's width. */
  beadCols?: number;
  roadCols?: number;
  derivedCols?: number;
  title?: string;
  className?: string;
}

type BoardSize = 'wide' | 'medium' | 'narrow';

const SIZE_COLS: Record<BoardSize, { bead: number; road: number; derived: number }> = {
  wide: { bead: 12, road: 30, derived: 16 },
  medium: { bead: 14, road: 24, derived: 12 },
  narrow: { bead: 12, road: 18, derived: 18 },
};

function sizeForWidth(width: number): BoardSize {
  if (width <= 0 || width >= 900) return 'wide';
  if (width >= 480) return 'medium';
  return 'narrow';
}

function useContainerWidth(): [RefObject<HTMLElement>, number] {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function colorWord(color: RoadColor | null): string {
  return color === null ? 'no entry' : color;
}

function describePrediction(prediction: Prediction): string {
  return DERIVED_KINDS.map((kind) => `${DERIVED_LABELS[kind]} ${colorWord(prediction[kind])}`).join(', ');
}

function Panel({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cls(roadStyles.panel, className)} role="group" aria-label={label}>
      <span className={roadStyles.panelLabel} aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Miniature derived-road symbol used next to the Ask buttons. */
function PredictionIcon({ kind, color }: { kind: DerivedKind; color: RoadColor | null }) {
  const stroke = color === null ? styles.predNone : color === 'red' ? roadStyles.banker : roadStyles.player;
  const fill = color === null ? styles.predNone : color === 'red' ? roadStyles.bankerFill : roadStyles.playerFill;
  return (
    <svg className={styles.askIcon} viewBox="0 0 14 14" aria-hidden="true" focusable="false" data-pred={kind} data-color={color ?? 'none'}>
      {kind === 'bigEye' && <circle className={stroke} cx={7} cy={7} r={4.6} fill="none" strokeWidth={2} />}
      {kind === 'small' && <circle className={fill} cx={7} cy={7} r={4.6} />}
      {kind === 'cockroach' && (
        <line className={stroke} x1={2.5} y1={11.5} x2={11.5} y2={2.5} strokeWidth={2.2} strokeLinecap="round" />
      )}
    </svg>
  );
}

interface AskButtonProps {
  side: Side;
  prediction: Prediction;
  pressed: boolean;
  onToggle: (side: Side) => void;
}

function AskButton({ side, prediction, pressed, onToggle }: AskButtonProps) {
  return (
    <button
      type="button"
      className={cls(styles.askBtn, side === 'player' ? styles.askPlayer : styles.askBanker)}
      aria-pressed={pressed}
      aria-label={`Ask ${OUTCOME_NAME[side]}: ${describePrediction(prediction)}`}
      onClick={() => onToggle(side)}
      data-ask={side}
    >
      <span className={styles.askLetter} aria-hidden="true">
        {OUTCOME_LETTER[side]}
      </span>
      <span aria-hidden="true">Ask {OUTCOME_LETTER[side]}</span>
      <span className={styles.askIcons} aria-hidden="true">
        {DERIVED_KINDS.map((kind) => (
          <PredictionIcon key={kind} kind={kind} color={prediction[kind]} />
        ))}
      </span>
    </button>
  );
}

interface CountItem {
  key: string;
  label: string;
  value: number;
  icon: ReactNode;
  abbr?: string;
}

/**
 * The casino display: bead plate left, big road top right, the three derived roads below it, a counts strip
 * (P/B/T, pairs, D7, P8, hand count) and "Ask P" / "Ask B" buttons that show what each derived road would get.
 */
export function Scoreboard({
  results,
  prediction,
  onPredict,
  rows = 6,
  beadCols,
  roadCols,
  derivedCols,
  title = 'Scoreboard',
  className,
}: ScoreboardProps) {
  const [ref, width] = useContainerWidth();
  const size = sizeForWidth(width);
  const cols = SIZE_COLS[size];

  const [internal, setInternal] = useState<Side | null>(null);
  const controlled = prediction !== undefined;
  const asked: Side | null = controlled ? prediction : internal;
  const toggle = (side: Side) => {
    const next = asked === side ? null : side;
    if (!controlled) setInternal(next);
    onPredict?.(next);
  };

  const stats = useMemo(() => roadStats(results), [results]);
  const predictions = useMemo(
    () => ({ player: predictNext(results, 'player'), banker: predictNext(results, 'banker') }),
    [results],
  );

  const counts: CountItem[] = [
    { key: 'player', label: 'Player', value: stats.player, icon: <span className={cls(styles.disc, styles.discPlayer)}>P</span> },
    { key: 'banker', label: 'Banker', value: stats.banker, icon: <span className={cls(styles.disc, styles.discBanker)}>B</span> },
    { key: 'tie', label: 'Tie', value: stats.tie, icon: <span className={cls(styles.disc, styles.discTie)}>T</span> },
    { key: 'playerPair', label: 'Player Pair', value: stats.playerPair, icon: <span className={cls(styles.pair, styles.pairPlayer)} />, abbr: 'PP' },
    { key: 'bankerPair', label: 'Banker Pair', value: stats.bankerPair, icon: <span className={cls(styles.pair, styles.pairBanker)} />, abbr: 'BP' },
    { key: 'dragon7', label: 'Dragon 7', value: stats.dragon7, icon: <span className={styles.badge}>7</span>, abbr: 'D7' },
    { key: 'panda8', label: 'Panda 8', value: stats.panda8, icon: <span className={styles.badge}>8</span>, abbr: 'P8' },
  ];

  const streak = stats.currentStreak;
  const streakText =
    streak.outcome === null ? 'Streak —' : `Streak ${OUTCOME_LETTER[streak.outcome]} × ${streak.length}`;
  const streakLabel =
    streak.outcome === null ? 'No streak yet' : `Current streak: ${OUTCOME_NAME[streak.outcome]} × ${streak.length}`;

  return (
    <section ref={ref} className={cls(styles.board, className)} data-size={size} aria-label={title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.hands} aria-label={`${stats.total} hands`}>
          Hand {stats.total}
        </span>
      </header>

      <div className={styles.layout}>
        <Panel label="Bead Plate" className={styles.beadPanel}>
          <BeadPlateView results={results} cols={beadCols ?? cols.bead} rows={rows} />
        </Panel>
        <div className={styles.right}>
          <Panel label="Big Road">
            <BigRoadView results={results} cols={roadCols ?? cols.road} rows={rows} prediction={asked} />
          </Panel>
          <div className={styles.derived}>
            {DERIVED_KINDS.map((kind) => (
              <Panel key={kind} label={DERIVED_LABELS[kind]}>
                <DerivedRoadView
                  results={results}
                  kind={kind}
                  cols={derivedCols ?? cols.derived}
                  rows={rows}
                  prediction={asked}
                />
              </Panel>
            ))}
          </div>
        </div>
        <footer className={styles.strip}>
          <ul className={styles.counts} aria-label="Shoe counts">
            {counts.map((item) => (
              <li key={item.key} className={styles.count} aria-label={`${item.label}: ${item.value}`} data-count={item.key}>
                <span aria-hidden="true">{item.icon}</span>
                {item.abbr !== undefined && (
                  <span className={styles.countAbbr} aria-hidden="true">
                    {item.abbr}
                  </span>
                )}
                <span aria-hidden="true">{item.value}</span>
              </li>
            ))}
            <li className={cls(styles.count, styles.streak)} aria-label={streakLabel} data-count="streak">
              <span aria-hidden="true">{streakText}</span>
            </li>
          </ul>
          <div className={styles.ask} role="group" aria-label="Ask the roads">
            <AskButton side="player" prediction={predictions.player} pressed={asked === 'player'} onToggle={toggle} />
            <AskButton side="banker" prediction={predictions.banker} pressed={asked === 'banker'} onToggle={toggle} />
          </div>
        </footer>
        <p className={styles.askStatus} aria-live="polite" data-ask-status="">
          {asked === null ? '' : `If ${OUTCOME_NAME[asked]} next: ${describePrediction(predictions[asked])}`}
        </p>
      </div>
    </section>
  );
}
