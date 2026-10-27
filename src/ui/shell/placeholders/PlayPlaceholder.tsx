/**
 * Placeholder for `<PlayView />` (src/ui/play). Renders a static table built from the shell's
 * components so the shell can be judged on its own. Swapped out in src/App.tsx.
 */
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { formatMoney } from '../format';
import { Button } from '../components/Button';
import { Chip, ChipStack } from '../components/Chip';
import { PlayingCard } from '../components/PlayingCard';
import { Plaque } from '../components/Plaque';
import { Stat, toneForNet } from '../components/Stat';
import { useSession } from '../hooks/useSession';
import { useIsPhone, useIsTablet } from '../hooks/useMediaQuery';
import styles from './Placeholders.module.css';

export function PlayPlaceholder(): ReactNode {
  const { state } = useSession();
  const { rules, bankroll, stats, shoe } = state;
  const chips = rules.chipDenominations;
  const selectedChip = chips.includes(25) ? 25 : chips[0];
  const phone = useIsPhone();
  const tablet = useIsTablet();
  const cardSize = phone ? 'sm' : tablet ? 'md' : 'lg';

  return (
    <div className={styles.view}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Table 1 — EZ Baccarat</h1>
          <p className={styles.lede}>
            Shell preview of the casino table. The live Play view (chips, dealing, roads and the Coach) mounts here.
          </p>
        </div>
        <span className={styles.note}>Play view · placeholder</span>
      </div>

      <div className={styles.layout}>
        <div className={styles.table}>
          <div className={styles.felt}>
            <div className={styles.hands}>
              <div className={cx(styles.hand, styles.player)}>
                <span className={styles.handTitle}>Player</span>
                <div className={styles.cards}>
                  <PlayingCard card={{ rank: '7', suit: 'H' }} size={cardSize} />
                  <PlayingCard card={{ rank: 'A', suit: 'S' }} size={cardSize} />
                  <PlayingCard card={{ rank: 'K', suit: 'D' }} size={cardSize} rotated highlight />
                </div>
                <span className={styles.total}>8</span>
              </div>
              <div className={styles.shoe}>
                <PlayingCard faceDown size="sm" />
                <span className={styles.shoeLabel}>Shoe {shoe.shoeNumber} · {shoe.cardsRemaining} left</span>
              </div>
              <div className={cx(styles.hand, styles.banker)}>
                <span className={styles.handTitle}>Banker</span>
                <div className={styles.cards}>
                  <PlayingCard card={{ rank: 'Q', suit: 'C' }} size={cardSize} />
                  <PlayingCard card={{ rank: '5', suit: 'D' }} size={cardSize} />
                  <PlayingCard card={{ rank: '2', suit: 'C' }} size={cardSize} rotated />
                </div>
                <span className={styles.total}>7</span>
              </div>
            </div>

            <div className={styles.dealerBar} aria-live="polite">
              Panda 8! Player wins, 8 over 7
            </div>

            <div className={styles.sideSpots}>
              <div className={cx(styles.spot, styles.spotDragon)}>
                Dragon 7 <span className={styles.spotOdds}>pays 40 to 1</span>
              </div>
              <div className={cx(styles.spot, styles.spotPanda)}>
                Panda 8 <span className={styles.spotOdds}>pays 25 to 1</span>
                <ChipStack chips={[5]} size="sm" showTotal />
              </div>
            </div>

            <div className={styles.spots}>
              <div className={cx(styles.spot, styles.spotPlayer)}>
                Player Pair <span className={styles.spotOdds}>11 to 1</span>
              </div>
              <div className={cx(styles.spot, styles.spotPlayer)}>
                Player <span className={styles.spotOdds}>1 to 1</span>
                <ChipStack chips={[25, 25, 5]} size="sm" showTotal />
              </div>
              <div className={cx(styles.spot, styles.spotTie)}>
                Tie <span className={styles.spotOdds}>8 to 1</span>
              </div>
              <div className={cx(styles.spot, styles.spotBanker)}>
                Banker <span className={styles.spotOdds}>no commission</span>
              </div>
              <div className={cx(styles.spot, styles.spotBanker)}>
                Banker Pair <span className={styles.spotOdds}>11 to 1</span>
              </div>
            </div>
          </div>

          <div className={styles.rail}>
            <div className={styles.tray} role="group" aria-label="Chip tray">
              {chips.map((v) => (
                <Chip key={v} value={v} size={phone ? 'sm' : 'md'} selected={v === selectedChip} onClick={() => undefined} />
              ))}
            </div>
            <Plaque size="sm" sub={`Tie ${formatMoney(rules.limits.tie.min)}–${formatMoney(rules.limits.tie.max)}`}>
              Min {formatMoney(rules.limits.main.min)} — Max {formatMoney(rules.limits.main.max)}
            </Plaque>
            <div className={styles.controls}>
              <Button variant="primary" size="lg" kbd="Space">
                Deal
              </Button>
              <Button kbd="R">Rebet</Button>
              <Button kbd="C">Clear</Button>
              <Button kbd="U">Undo</Button>
            </div>
          </div>
        </div>

        <aside className={styles.side} aria-label="Session">
          <div className={styles.card}>
            <h4 className={styles.cardTitle}>Session</h4>
            <div className={styles.stats}>
              <Stat label="Bankroll" value={formatMoney(bankroll)} tone="gold" size="sm" />
              <Stat label="Net" value={formatMoney(stats.net, { signed: true })} tone={toneForNet(stats.net)} size="sm" />
              <Stat label="Hands" value={stats.handsPlayed} size="sm" />
              <Stat label="Shoes" value={stats.shoesPlayed} size="sm" />
            </div>
          </div>
          <div className={styles.card}>
            <h4 className={styles.cardTitle}>Coach</h4>
            <ul className={styles.list}>
              <li>
                <span>Banker (EZ) house edge</span>
                <strong>1.02%</strong>
              </li>
              <li>
                <span>Player house edge</span>
                <strong>1.24%</strong>
              </li>
              <li>
                <span>Dragon 7 true count</span>
                <strong className="c-gold">+0.0</strong>
              </li>
              <li>
                <span>Panda 8 true count</span>
                <strong className="c-gold">+0.0</strong>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
