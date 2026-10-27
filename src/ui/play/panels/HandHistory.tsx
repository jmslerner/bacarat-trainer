/**
 * HandHistory — newest first: hand number, Player cards/total, Banker cards/total, outcome, bonuses, your net.
 */
import type { ReactNode } from 'react';
import type { Card } from '@/engine';
import { cardShortLabel, cx, formatMoney, isRedSuit } from '@/ui/shell';
import { HISTORY_LIMIT, type HistoryEntry } from '../history/historyStore';
import styles from './Panels.module.css';

export interface HandHistoryProps {
  entries: readonly HistoryEntry[];
  limit?: number;
}

function Cards({ cards }: { cards: readonly Card[] }): ReactNode {
  return (
    <span className={styles.historyCards}>
      {cards.map((c, i) => (
        <span key={c.id} className={isRedSuit(c.suit) ? styles.red : undefined}>
          {i > 0 ? ' ' : ''}
          {cardShortLabel(c)}
        </span>
      ))}
    </span>
  );
}

export function HandHistory({ entries, limit = HISTORY_LIMIT }: HandHistoryProps): ReactNode {
  if (entries.length === 0) return <p className={styles.empty}>No hands yet — place a bet and deal.</p>;
  return (
    <ol className={styles.history} aria-label="Hand history, newest first" data-testid="hand-history">
      {entries.slice(0, limit).map((e) => {
        const r = e.result;
        const letter = r.outcome === 'player' ? 'P' : r.outcome === 'banker' ? 'B' : 'T';
        const net = e.settlement?.net ?? null;
        const wagered = e.settlement?.totalWagered ?? 0;
        const netText = net === null ? '—' : wagered === 0 ? 'no bet' : Math.abs(net) < 0.005 ? 'push' : formatMoney(net, { signed: true });
        const netClass = net === null || wagered === 0 ? styles.historyNo : net > 0.004 ? styles.tdPositive : net < -0.004 ? styles.tdNegative : undefined;
        const outcomeName = r.outcome === 'player' ? 'Player wins' : r.outcome === 'banker' ? 'Banker wins' : 'Tie';
        return (
          <li key={e.key} className={styles.historyRow} aria-label={`Hand ${e.sessionHand}: ${outcomeName} ${r.playerTotal} to ${r.bankerTotal}${net !== null && wagered > 0 ? `, net ${formatMoney(net, { signed: true })}` : ''}`}>
            <span className={styles.historyNo} title={`Shoe ${e.shoeNumber}, hand ${e.handNumber}`}>
              #{e.sessionHand}
            </span>
            <span className={cx(styles.historyHand, styles.historyP)} title="Player">
              <span className={styles.historyTotal}>{r.playerTotal}</span>
              <Cards cards={r.playerCards} />
            </span>
            <span className={cx(styles.historyHand, styles.historyB)} title="Banker">
              <span className={styles.historyTotal}>{r.bankerTotal}</span>
              <Cards cards={r.bankerCards} />
            </span>
            <span className={cx(styles.outcome, styles[`outcome${letter}`])} aria-hidden="true">
              {letter}
            </span>
            <span className={styles.historyRight}>
              <span className={cx(styles.historyNet, netClass)}>{netText}</span>
              {(r.dragon7 || r.panda8 || r.playerPair || r.bankerPair || r.playerNatural || r.bankerNatural) && (
                <span className={styles.bonuses} aria-hidden="true">
                  {r.dragon7 && <span className={cx(styles.bonus, styles.bonusDragon)}>D7</span>}
                  {r.panda8 && <span className={cx(styles.bonus, styles.bonusPanda)}>P8</span>}
                  {r.playerPair && <span className={cx(styles.bonus, styles.bonusPair)}>PP</span>}
                  {r.bankerPair && <span className={cx(styles.bonus, styles.bonusPair)}>BP</span>}
                  {(r.playerNatural || r.bankerNatural) && <span className={cx(styles.bonus, styles.bonusNatural)}>NAT</span>}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
