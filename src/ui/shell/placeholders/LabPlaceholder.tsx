/**
 * Placeholder for `<LabView />` (src/ui/lab). A static config form and result cards built from
 * the shell components. Swapped out in src/App.tsx.
 */
import { useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { NumberInput } from '../components/NumberInput';
import { Select } from '../components/Select';
import { Stat } from '../components/Stat';
import { formatMoney, formatPercent } from '../format';
import styles from './Placeholders.module.css';

const CURVE = [1000, 1010, 985, 1020, 1045, 1030, 990, 1005, 970, 955, 980, 1000, 960, 940, 965, 950, 920, 935, 905, 890];

export function LabPlaceholder(): ReactNode {
  const [selector, setSelector] = useState('alwaysBanker');
  const [system, setSystem] = useState('flat');
  const [trials, setTrials] = useState(1000);
  const [unit, setUnit] = useState(25);

  const w = 600;
  const h = 160;
  const min = Math.min(...CURVE);
  const max = Math.max(...CURVE);
  const pts = CURVE.map((v, i) => `${(i / (CURVE.length - 1)) * w},${h - ((v - min) / (max - min)) * (h - 20) - 10}`).join(' ');
  const startY = h - ((1000 - min) / (max - min)) * (h - 20) - 10;

  return (
    <div className={styles.view}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Strategy Lab</h1>
          <p className={styles.lede}>Monte Carlo simulation of bet selection and money-management systems mounts here.</p>
        </div>
        <span className={styles.note}>Lab view · placeholder</span>
      </div>

      <div className={styles.card}>
        <div className={styles.form}>
          <Select
            label="Bet selector"
            value={selector}
            onChange={setSelector}
            options={[
              { value: 'alwaysBanker', label: 'Always Banker' },
              { value: 'alwaysPlayer', label: 'Always Player' },
              { value: 'followLast', label: 'Follow the streak' },
            ]}
          />
          <Select
            label="Betting system"
            value={system}
            onChange={setSystem}
            options={[
              { value: 'flat', label: 'Flat' },
              { value: 'martingale', label: 'Martingale' },
              { value: 'paroli', label: 'Paroli' },
            ]}
          />
          <NumberInput label="Unit" value={unit} min={5} step={5} decimals={0} prefix="$" onChange={setUnit} />
          <NumberInput label="Trials" value={trials} min={100} max={100000} step={100} decimals={0} onChange={setTrials} />
          <Button variant="primary" size="lg">
            Run simulation
          </Button>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.card}>
          <h4 className={styles.cardTitle}>Sample bankroll curve</h4>
          <svg className={styles.chart} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Example bankroll curve">
            <line x1="0" x2={w} y1={startY} y2={startY} stroke="var(--gold-dark)" strokeDasharray="4 4" />
            <polyline points={pts} fill="none" stroke="var(--player-light)" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
        </div>
        <div className={styles.side}>
          <div className={styles.stats}>
            <Stat label="Mean final" value={formatMoney(890)} tone="negative" size="sm" />
            <Stat label="Realized edge" value={formatPercent(0.0102)} size="sm" />
            <Stat label="Risk of ruin" value={formatPercent(0.031)} size="sm" />
            <Stat label="P(profit)" value={formatPercent(0.41)} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
