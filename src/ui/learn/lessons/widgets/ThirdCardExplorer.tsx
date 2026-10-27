/**
 * Interactive third-card explorer: pick the two-card totals and (when needed) the third cards, and the Banker's
 * action is explained with the rule it rests on. The final hand is dealt by the engine from those values.
 */
import { useState, type ReactNode } from 'react';
import { dealFromValues, type CardSpec, type TableRules } from '@/engine';
import { Button, cx } from '@/ui/shell';
import { HandCards, HandsRow, Widget } from '../components';
import { bankerDrawValues, explainThirdCard } from '../thirdCardLogic';
import styles from './Widgets.module.css';

const VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

interface PickerProps {
  id: string;
  label: ReactNode;
  value: number | null;
  onChange: (v: number) => void;
  hint?: (v: number) => 'draw' | 'stand' | null;
}

function Picker({ id, label, value, onChange, hint }: PickerProps): ReactNode {
  return (
    <div className={styles.choiceGroup}>
      <span className={styles.choiceLabel} id={`${id}-label`}>
        {label}
      </span>
      <div className={styles.choices} role="radiogroup" aria-labelledby={`${id}-label`}>
        {VALUES.map((v) => {
          const h = hint?.(v) ?? null;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              className={cx(styles.choice, h === 'draw' && styles.choiceHint)}
              title={h === 'draw' ? 'Banker draws on this card' : h === 'stand' ? 'Banker stands on this card' : undefined}
              onClick={() => onChange(v)}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface ThirdCardExplorerProps {
  rules: TableRules;
}

export function ThirdCardExplorer({ rules }: ThirdCardExplorerProps): ReactNode {
  const [pt, setPt] = useState<number | null>(null);
  const [bt, setBt] = useState<number | null>(null);
  const [p3, setP3] = useState<number | null>(null);
  const [b3, setB3] = useState<number | null>(null);

  const ex = pt !== null && bt !== null ? explainThirdCard(pt, bt, p3) : null;
  const needsP3 = ex !== null && ex.playerAction === 'draws';
  const needsB3 = ex !== null && ex.bankerAction === 'draws';
  const complete = ex !== null && (!needsP3 || p3 !== null) && (!needsB3 || b3 !== null);

  const result =
    complete && pt !== null && bt !== null
      ? dealFromValues([pt, 0, ...(needsP3 && p3 !== null ? [p3] : [])] as CardSpec[], [bt, 0, ...(needsB3 && b3 !== null ? [b3] : [])] as CardSpec[], rules)
      : null;

  const verdict = (): ReactNode => {
    if (ex === null) return <span className={styles.verdict}>Pick the Player and Banker two-card totals.</span>;
    if (ex.natural !== null) return <span className={cx(styles.verdict, styles.verdictNatural)}>Natural — both hands stand</span>;
    if (ex.bankerAction === null) return <span className={styles.verdict}>Player draws — now pick the Player’s third card</span>;
    return (
      <span className={cx(styles.verdict, ex.bankerAction === 'draws' ? styles.verdictDraw : styles.verdictStand)} data-verdict={ex.bankerAction}>
        Player {ex.playerAction} · Banker {ex.bankerAction}
      </span>
    );
  };

  const reset = (): void => {
    setPt(null);
    setBt(null);
    setP3(null);
    setB3(null);
  };

  return (
    <Widget
      title="Third-card explorer"
      hint="Choose the totals after the first two cards; the explorer applies the rules and tells you why."
      data-widget="third-card-explorer"
      actions={
        <Button size="sm" variant="ghost" onClick={reset} disabled={pt === null && bt === null}>
          Reset
        </Button>
      }
    >
      <div className={styles.form} style={{ alignItems: 'start' }}>
        <Picker id="tce-player" label="Player two-card total" value={pt} onChange={(v) => { setPt(v); setP3(null); setB3(null); }} />
        <Picker id="tce-banker" label="Banker two-card total" value={bt} onChange={(v) => { setBt(v); setB3(null); }} />
      </div>
      {needsP3 && (
        <Picker
          id="tce-p3"
          label="Value of the Player’s third card (dashed = the Banker would draw on it)"
          value={p3}
          onChange={(v) => { setP3(v); setB3(null); }}
          hint={(v) => (bt !== null && bt <= 7 ? (bankerDrawValues(bt).includes(v) ? 'draw' : 'stand') : null)}
        />
      )}
      {needsB3 && <Picker id="tce-b3" label="Value of the Banker’s third card (to see the result)" value={b3} onChange={setB3} />}

      <div aria-live="polite" data-explorer-output>
        {verdict()}
        {ex !== null && (
          <ol className={styles.explain} style={{ marginTop: 10 }}>
            {ex.lines.map((line, i) => (
              <li key={i} className={styles.explainItem}>
                <span className={styles.explainNo} aria-hidden="true">
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {result !== null && (
        <div className={styles.felt} data-explorer-result>
          <HandsRow>
            <HandCards side="player" cards={result.playerCards} total={result.playerTotal} size="sm" />
            <HandCards side="banker" cards={result.bankerCards} total={result.bankerTotal} size="sm" />
          </HandsRow>
          <div className={styles.dealerBar}>
            <span className={cx(styles.dealerCall, (result.dragon7 || result.panda8) && styles.dealerCallBonus)}>
              {result.steps
                .filter((s) => s.type === 'result' || s.type === 'bonus')
                .map((s) => s.message)
                .join(' — ')}
            </span>
          </div>
        </div>
      )}
    </Widget>
  );
}
