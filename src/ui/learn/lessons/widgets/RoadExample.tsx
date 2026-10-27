/**
 * Live road examples: a fixed result sequence rendered through the real @/roads components, the derivation of
 * the first derived-road entries spelled out, and a full scoreboard with the "Ask" buttons.
 */
import { useMemo, useState, type ReactNode } from 'react';
import type { Side } from '@/engine';
import { BeadPlateView, BigRoadView, DERIVED_LABELS, DerivedRoadView, Scoreboard, bigRoad, predictNext, type DerivedKind, type RoadResult } from '@/roads';
import { Button, cx } from '@/ui/shell';
import { ResultSequence, Widget } from '../components';
import { deriveWithReasons, seq } from '../roadsLogic';
import styles from './Widgets.module.css';

export type RoadKind = 'bead' | 'big' | DerivedKind;

const ROAD_LABELS: Record<RoadKind, string> = {
  bead: 'Bead plate',
  big: 'Big road',
  bigEye: DERIVED_LABELS.bigEye,
  small: DERIVED_LABELS.small,
  cockroach: DERIVED_LABELS.cockroach,
};

export interface RoadExampleProps {
  title: ReactNode;
  hint?: ReactNode;
  /** 'P B B T …' */
  sequence: string;
  roads: readonly RoadKind[];
  /** Visible columns of the big road / derived roads (bead plate uses a quarter fewer). */
  cols?: number;
  rows?: number;
  /** Show "Ask P / Ask B" ghost cells. */
  askable?: boolean;
  children?: ReactNode;
}

export function RoadExample({ title, hint, sequence, roads, cols = 12, rows = 6, askable, children }: RoadExampleProps): ReactNode {
  const results = useMemo(() => seq(sequence), [sequence]);
  const [ask, setAsk] = useState<Side | null>(null);
  const prediction = askable ? ask : null;
  const forecast = prediction === null ? null : predictNext(results, prediction);
  const multi = roads.length > 1;
  return (
    <Widget
      title={title}
      hint={hint}
      data-widget="road-example"
      actions={
        askable ? (
          <div className={styles.choices} role="group" aria-label="Ask the roads">
            <Button size="sm" variant="player" active={ask === 'player'} onClick={() => setAsk(ask === 'player' ? null : 'player')}>
              Ask P
            </Button>
            <Button size="sm" variant="banker" active={ask === 'banker'} onClick={() => setAsk(ask === 'banker' ? null : 'banker')}>
              Ask B
            </Button>
          </div>
        ) : undefined
      }
    >
      <ResultSequence outcomes={results.map((r) => r.outcome)} />
      <div className={cx(multi && styles.roadGrid)}>
        {roads.map((kind) => (
          <div key={kind} className={cx(styles.roadBox, multi && styles.roadBoxWide)} data-road-example={kind}>
            <p className={styles.roadLabel}>{ROAD_LABELS[kind]}</p>
            {kind === 'bead' ? (
              <BeadPlateView results={results} cols={Math.max(6, Math.round(cols * 0.75))} rows={rows} />
            ) : kind === 'big' ? (
              <BigRoadView results={results} cols={cols} rows={rows} prediction={prediction} />
            ) : (
              <DerivedRoadView results={results} kind={kind} cols={cols} rows={rows} prediction={prediction} />
            )}
          </div>
        ))}
      </div>
      {forecast !== null && (
        <p className={styles.note} aria-live="polite" data-forecast>
          If the next hand is <strong>{prediction === 'player' ? 'Player' : 'Banker'}</strong>:{' '}
          {(['bigEye', 'small', 'cockroach'] as const).map((k, i) => (
            <span key={k}>
              {i > 0 && ' · '}
              {DERIVED_LABELS[k]} {forecast[k] === null ? 'adds nothing yet' : `adds ${forecast[k]}`}
            </span>
          ))}
          .
        </p>
      )}
      {children}
    </Widget>
  );
}

export interface DerivationListProps {
  sequence: string;
  kind: DerivedKind;
  /** How many entries to spell out. */
  limit?: number;
}

const DOT_CLASS: Record<DerivedKind, { red: string; blue: string }> = {
  bigEye: { red: styles.dotRed, blue: styles.dotBlue },
  small: { red: cx(styles.dotRed, styles.dotSolidRed), blue: cx(styles.dotBlue, styles.dotSolidBlue) },
  cockroach: { red: styles.dotRed, blue: styles.dotBlue },
};

/** The first entries of a derived road, each with the comparison that produced its colour. */
export function DerivationList({ sequence, kind, limit = 6 }: DerivationListProps): ReactNode {
  const results = useMemo(() => seq(sequence), [sequence]);
  const steps = useMemo(() => deriveWithReasons(results, kind, limit), [results, kind, limit]);
  const columns = useMemo(() => bigRoad(results).columns, [results]);
  return (
    <div data-derivation={kind}>
      <p className={styles.note}>
        Big-road column depths: {columns.map((c, i) => `${i + 1}:${c.length}`).join(', ')}.
      </p>
      <ol className={styles.derivation}>
        {steps.map((s) => (
          <li key={s.index} className={styles.derivationItem} data-color={s.color}>
            <span className={cx(styles.dot, DOT_CLASS[kind][s.color])} role="img" aria-label={s.color} />
            <span>
              <strong>
                Entry {s.index + 1} ({s.color}), from hand {s.handIndex + 1} at column {s.col}, cell {s.row}:
              </strong>{' '}
              {s.reason}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export interface ScoreboardDemoProps {
  sequence: string;
  title?: string;
}

/** The casino display, exactly as the Play view shows it, with working "Ask P" / "Ask B" buttons. */
export function ScoreboardDemo({ sequence, title = 'Example scoreboard' }: ScoreboardDemoProps): ReactNode {
  const results: RoadResult[] = useMemo(() => seq(sequence), [sequence]);
  return <Scoreboard results={results} title={title} />;
}
