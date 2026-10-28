/**
 * BonusCelebration — the Dragon 7 / Panda 8 moment over the felt: a felt flash, a particle layer (embers for the
 * Dragon, confetti for the Panda), and a medallion banner with the title, the rule and the payout line. Purely
 * decorative (pointer-events none, aria-hidden — the dealer bar announces the call), clipped by the felt.
 *
 * The overlay drives its own lifetime from `celebration.holdMs` so instant speed (no timeline wait) and animated
 * speeds behave alike: enter, hold, fade, gone. Effects are keyed on `celebration.id`, so re-renders never restart
 * them; a new deal, a skip or a reset clears the celebration from the store and unmounts the overlay at once.
 * Reduced motion: no flash and no particles — the banner simply appears and goes.
 *
 * The banner is centred over the felt — over the part of it that is on screen: on a phone the felt is taller than
 * the viewport and the player has just tapped DEAL under it, so the plaque is placed over the visible middle rather
 * than over cards that are scrolled out of sight.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BREAKPOINTS, cx, formatMoney, useMediaQuery } from '@/ui/shell';
import type { BonusKind, Celebration } from '../animation/types';
import { BonusMedallion } from './BonusMedallion';
import { runParticles } from './particles';
import styles from './Felt.module.css';

export interface BonusCelebrationProps {
  celebration: Celebration | null;
  phone?: boolean;
  /** Overrides the prefers-reduced-motion query (tests). */
  reducedMotion?: boolean;
}

/** The banner fades over the last part of the hold. */
export const FADE_MS = 520;

export const BONUS_TITLE: Readonly<Record<BonusKind, string>> = { dragon7: 'DRAGON 7', panda8: 'PANDA 8' };
export const BONUS_RULE: Readonly<Record<BonusKind, string>> = { dragon7: 'Banker wins with a three-card 7', panda8: 'Player wins with a three-card 8' };
const BONUS_NAME: Readonly<Record<BonusKind, string>> = { dragon7: 'Dragon 7', panda8: 'Panda 8' };

/** The parts of the payout line: "Pays 40 to 1", "you won +$200" / "no Dragon 7 bet this hand", "Banker bet pushes". */
export function payoutParts(c: Celebration): Array<{ text: string; tone: 'odds' | 'won' | 'none' | 'push' }> {
  const parts: Array<{ text: string; tone: 'odds' | 'won' | 'none' | 'push' }> = [{ text: `Pays ${c.pays} to 1`, tone: 'odds' }];
  if (c.won > 0) parts.push({ text: `you won ${formatMoney(c.won, { signed: true })}`, tone: 'won' });
  else parts.push({ text: `no ${BONUS_NAME[c.kind]} bet this hand`, tone: 'none' });
  if (c.bankerPush) parts.push({ text: 'Banker bet pushes', tone: 'push' });
  return parts;
}

export function payoutLine(c: Celebration): string {
  return payoutParts(c)
    .map((p) => p.text)
    .join(' · ');
}

function ParticleCanvas({ kind, id, durationMs }: { kind: BonusKind; id: string; durationMs: number }): ReactNode {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return runParticles(canvas, kind, durationMs);
  }, [kind, id, durationMs]);
  return <canvas ref={ref} className={styles.fxCanvas} data-testid="bonus-particles" />;
}

type Stage = 'in' | 'leaving' | 'done';

/** The banner's vertical centre as a fraction of the felt's height: the middle of the felt's visible part, kept well inside it. */
export function bannerCentre(feltTop: number, feltHeight: number, viewportHeight: number): number {
  if (!(feltHeight > 0) || !(viewportHeight > 0)) return 0.46;
  const top = Math.max(0, feltTop);
  const bottom = Math.min(viewportHeight, feltTop + feltHeight);
  if (bottom - top < feltHeight * 0.35) return 0.46; // (almost) nothing of it on screen: the felt's own middle
  const centre = ((top + bottom) / 2 - feltTop) / feltHeight;
  return Math.min(0.72, Math.max(0.28, centre));
}

export function BonusCelebration({ celebration, phone = false, reducedMotion }: BonusCelebrationProps): ReactNode {
  const prefersReduced = useMediaQuery(BREAKPOINTS.reducedMotion);
  const reduced = reducedMotion ?? prefersReduced;
  const [stage, setStage] = useState<{ id: string; stage: Stage } | null>(null);
  const [centre, setCentre] = useState(0.46);
  const ref = useRef<HTMLDivElement>(null);
  const id = celebration?.id ?? null;
  const holdMs = celebration?.holdMs ?? 0;

  // Where the banner goes is measured once per moment, before it is painted.
  useLayoutEffect(() => {
    if (id === null) return;
    const el = ref.current;
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight || 0;
      setCentre(bannerCentre(rect.top, rect.height, viewport));
    } catch {
      setCentre(0.46);
    }
  }, [id]);

  useEffect(() => {
    if (id === null) return;
    setStage({ id, stage: 'in' });
    const fade = Math.min(FADE_MS, holdMs * 0.3);
    const leave = window.setTimeout(() => setStage({ id, stage: 'leaving' }), Math.max(0, holdMs - fade));
    const done = window.setTimeout(() => setStage({ id, stage: 'done' }), holdMs);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, [id, holdMs]);

  if (!celebration) return null;
  const current = stage !== null && stage.id === celebration.id ? stage.stage : 'in';
  if (current === 'done') return null;
  const kind = celebration.kind;
  const title = BONUS_TITLE[kind];

  return (
    <div
      ref={ref}
      className={cx(styles.fx, kind === 'dragon7' ? styles.fxDragon : styles.fxPanda, current === 'leaving' && styles.fxLeaving, reduced && styles.fxStatic, phone && styles.fxPhone)}
      style={{ '--fx-centre': `${(centre * 100).toFixed(1)}%` } as CSSProperties}
      data-testid="bonus-celebration"
      data-kind={kind}
      data-stage={current}
      aria-hidden="true"
    >
      {!reduced && <div className={styles.fxFlash} />}
      {!reduced && <ParticleCanvas kind={kind} id={celebration.id} durationMs={celebration.holdMs} />}
      <div className={styles.fxBanner} data-testid="bonus-banner">
        <BonusMedallion kind={kind} size={phone ? 68 : 96} className={styles.fxMedallion} />
        <div className={styles.fxTitle} data-text={title}>
          {title}
        </div>
        <div className={styles.fxRule}>{BONUS_RULE[kind]}</div>
        <div className={styles.fxPayout} data-testid="bonus-payout">
          {payoutParts(celebration).map((part, i) => (
            <Fragment key={part.tone}>
              {i > 0 && <span className={styles.fxSep}> · </span>}
              <span className={cx(part.tone === 'won' && styles.fxWon, part.tone === 'none' && styles.fxNoBet)}>{part.text}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
