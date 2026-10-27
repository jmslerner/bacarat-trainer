import type { ReactNode } from 'react';
import { cx } from '../cx';
import { formatMoney, formatMoneyCompact } from '../format';
import { Plaque } from '../components/Plaque';
import { Button } from '../components/Button';
import { Tooltip } from '../components/Tooltip';
import { useSessionState } from '../hooks/useSession';
import { useDisplayedBankroll } from '../hooks/useDisplayedBankroll';
import { useIsPhone } from '../hooks/useMediaQuery';
import { useSound } from '../hooks/useSound';
import { MODES, type Mode, type Route } from '../routing';
import type { SettingsTab } from '../settings/SettingsDialog';
import { BookIcon, CardsIcon, FlaskIcon, GearIcon, SoundOffIcon, SoundOnIcon } from './icons';
import styles from './TopBar.module.css';

const MODE_ICONS: Record<Mode, ReactNode> = { play: <CardsIcon />, learn: <BookIcon />, lab: <FlaskIcon /> };

export interface TopBarProps {
  route: Route;
  onOpenSettings: (tab?: SettingsTab) => void;
}

/**
 * Bankroll pill: the bankroll with the session net, opens the buy-in tab. While the table is dealing a hand it
 * follows the figure the table displays (published by the Play view), so the pill never reveals the result
 * before the cards are out; otherwise it shows the live session.
 */
export function BankrollPill({ onClick }: { onClick: () => void }): ReactNode {
  const state = useSessionState();
  const displayed = useDisplayedBankroll();
  const phone = useIsPhone();
  const bankroll = displayed ? displayed.bankroll : state.bankroll;
  const net = displayed ? displayed.net : state.stats.net;
  const tone = Math.abs(net) < 0.005 ? 'flat' : net > 0 ? 'up' : 'down';
  const exact = formatMoney(bankroll);
  // Seven-figure bankrolls do not fit a 380px top bar: show them compact there (the exact figure stays in the accessible name).
  const compact = phone && Math.abs(bankroll) >= 1_000_000;
  return (
    <Tooltip content="Bankroll — click to buy in or reset" placement="bottom">
      <button type="button" className={styles.bankroll} onClick={onClick} data-testid="bankroll-pill" title={compact ? exact : undefined} data-value={bankroll}>
        <span className={styles.bankrollLabel}>Bankroll</span>
        {compact ? (
          <>
            <span className={styles.bankrollValue} aria-hidden="true">
              {formatMoneyCompact(bankroll)}
            </span>
            <span className="sr-only">{exact}</span>
          </>
        ) : (
          <span className={styles.bankrollValue}>{exact}</span>
        )}
        {tone !== 'flat' && (
          <span className={cx(styles.net, styles[tone])} aria-label={`Session net ${formatMoney(net, { signed: true })}`}>
            {formatMoney(net, { signed: true })}
          </span>
        )}
      </button>
    </Tooltip>
  );
}

export function TopBar({ route, onOpenSettings }: TopBarProps): ReactNode {
  const sound = useSound();
  return (
    <header className={styles.topbar}>
      <div className={styles.inner}>
        <a href="#play" className={styles.brand} aria-label="Baccarat Trainer — home">
          <Plaque size="sm" className={styles.plaque}>
            Baccarat Trainer
          </Plaque>
          <span className={styles.tagline}>EZ Baccarat · Dragon 7 · Panda 8</span>
        </a>

        <nav className={styles.nav} aria-label="Mode">
          {MODES.map((m) => {
            const active = route.mode === m.id;
            return (
              <a key={m.id} href={m.hash} className={cx(styles.tab, active && styles.tabActive)} aria-current={active ? 'page' : undefined} title={m.title} data-mode={m.id}>
                <span className={styles.tabIcon} aria-hidden="true">
                  {MODE_ICONS[m.id]}
                </span>
                <span className={styles.tabLabel}>{m.label}</span>
                <span className={styles.tabShort}>{m.shortLabel}</span>
              </a>
            );
          })}
        </nav>

        <div className={styles.actions}>
          <BankrollPill onClick={() => onOpenSettings('bankroll')} />
          <Tooltip content={sound.enabled ? 'Sound on' : 'Sound off'} placement="bottom">
            <Button
              variant="ghost"
              iconOnly
              className={styles.iconButton}
              icon={sound.enabled ? <SoundOnIcon /> : <SoundOffIcon />}
              aria-label={sound.enabled ? 'Turn sound off' : 'Turn sound on'}
              aria-pressed={sound.enabled}
              onClick={sound.toggle}
              data-testid="sound-toggle"
            />
          </Tooltip>
          <Tooltip content="Table settings" placement="bottom">
            <Button variant="ghost" iconOnly className={styles.iconButton} icon={<GearIcon />} aria-label="Open settings" onClick={() => onOpenSettings()} data-testid="settings-button" />
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
