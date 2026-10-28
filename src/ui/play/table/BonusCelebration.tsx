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
 * The banner sits just below the cards, over the dealer's call, so the hand that made the hit stays in sight — and
 * wholly on screen: on a phone, or a laptop scrolled down to the DEAL button, the felt is taller than what is visible,
 * so the plaque moves into the visible part of the felt (below the sticky top bar) rather than over cards that are
 * scrolled out of sight (see `bannerCentre`).
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
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
  /** The cards (the felt's hands row): the banner sits just below them so the winning hand stays in sight. */
  cardsRef?: RefObject<HTMLElement>;
}

/** The banner fades over the last part of the hold. */
export const FADE_MS = 520;

export const BONUS_TITLE: Readonly<Record<BonusKind, string>> = { dragon7: 'DRAGON 7', panda8: 'PANDA 8' };
export const BONUS_RULE: Readonly<Record<BonusKind, string>> = { dragon7: 'Banker wins with a three-card 7', panda8: 'Player wins with a three-card 8' };
const BONUS_NAME: Readonly<Record<BonusKind, string>> = { dragon7: 'Dragon 7', panda8: 'Panda 8' };

/**
 * The parts of the payout line: "Pays 40 to 1", "you won +$200" / "no Dragon 7 bet this hand", "Banker bet pushes".
 * At an EZ table with the Dragon 7 bet switched off only the push is news ("Banker bet pushes" / "Banker bets push").
 */
export function payoutParts(c: Celebration): Array<{ text: string; tone: 'odds' | 'won' | 'none' | 'push' }> {
  if (!c.offered) return [{ text: c.bankerPush ? 'Banker bet pushes' : 'Banker bets push', tone: 'push' }];
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

/** The particle layer; mounted once the banner has been placed, so the bursts leave from where it is. */
function ParticleCanvas({ kind, id, durationMs, originY }: { kind: BonusKind; id: string; durationMs: number; originY: number }): ReactNode {
  const ref = useRef<HTMLCanvasElement>(null);
  // Read when the particles start; a later value never restarts them.
  const origin = useRef(originY);
  origin.current = originY;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return runParticles(canvas, kind, durationMs, origin.current);
  }, [kind, id, durationMs]);
  return <canvas ref={ref} className={styles.fxCanvas} data-testid="bonus-particles" />;
}

type Stage = 'in' | 'leaving' | 'done';

/** Room kept between the banner and the cards above it, the screen edges and the felt's edges (px). */
const BANNER_GAP = 10;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * The banner's vertical centre as a fraction of the felt's height (viewport coordinates in, px).
 *
 * With the banner's height known, it sits just below the cards (`below`: the bottom of the hands), so the hand that
 * made the hit stays in sight, moved as little as needed to be wholly on screen — below the sticky top bar
 * (`topInset`), above the bottom of the viewport — and inside the felt that clips it. When the part of the felt on
 * screen is shorter than the banner, it is centred on that part. Without the cards' position it goes over the middle
 * of what is on screen; without the banner's height, that middle is kept between 25% and 80% of the felt. With none
 * of the felt on screen, or nothing measurable, the felt's own middle.
 */
export function bannerCentre(feltTop: number, feltHeight: number, viewportHeight: number, topInset = 0, bannerHeight = 0, below: number | null = null): number {
  if (!(feltHeight > 0) || !(viewportHeight > 0)) return 0.46;
  const feltBottom = feltTop + feltHeight;
  const top = Math.max(Math.max(0, topInset), feltTop);
  const bottom = Math.min(viewportHeight, feltBottom);
  if (bottom <= top) return 0.46;
  const middle = (top + bottom) / 2;
  if (!(bannerHeight > 0)) return clamp((middle - feltTop) / feltHeight, 0.25, 0.8);
  const half = bannerHeight / 2 + BANNER_GAP;
  let centre = below !== null && Number.isFinite(below) ? below + half : middle;
  centre = bottom - top >= 2 * half ? clamp(centre, top + half, bottom - half) : middle;
  centre = feltHeight >= 2 * half ? clamp(centre, feltTop + half, feltBottom - half) : feltTop + feltHeight / 2;
  return (centre - feltTop) / feltHeight;
}

/** The sticky top bar's height, from the shell's `--topbar-height` token (0 when unavailable). */
function topBarInset(): number {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--topbar-height');
    const px = parseFloat(raw);
    return Number.isFinite(px) ? px : 0;
  } catch {
    return 0;
  }
}

export function BonusCelebration({ celebration, phone = false, reducedMotion, cardsRef }: BonusCelebrationProps): ReactNode {
  const prefersReduced = useMediaQuery(BREAKPOINTS.reducedMotion);
  const reduced = reducedMotion ?? prefersReduced;
  const [stage, setStage] = useState<{ id: string; stage: Stage } | null>(null);
  // Where the banner goes, per moment: measured in a layout effect, i.e. after the first render but before paint.
  const [placement, setPlacement] = useState<{ id: string; centre: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const id = celebration?.id ?? null;
  const holdMs = celebration?.holdMs ?? 0;

  // Where the banner goes is measured once per moment, before it is painted (its layout height ignores the entry
  // animation's scale).
  useLayoutEffect(() => {
    if (id === null) return;
    const el = ref.current;
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight || 0;
      const cards = cardsRef?.current?.getBoundingClientRect() ?? null;
      setPlacement({ id, centre: bannerCentre(rect.top, rect.height, viewport, topBarInset(), bannerRef.current?.offsetHeight ?? 0, cards && cards.height > 0 ? cards.bottom : null) });
    } catch {
      setPlacement({ id, centre: 0.46 });
    }
  }, [id, cardsRef]);

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
  const placed = placement !== null && placement.id === celebration.id;
  const centre = placed ? placement.centre : 0.46;
  const kind = celebration.kind;
  const title = BONUS_TITLE[kind];

  return (
    <div
      // A new moment is a new element, so the flash, the banner's entrance and the shine play again even when the
      // previous banner is still up (two hits in a row at instant speed).
      key={celebration.id}
      ref={ref}
      className={cx(styles.fx, kind === 'dragon7' ? styles.fxDragon : styles.fxPanda, current === 'leaving' && styles.fxLeaving, reduced && styles.fxStatic, phone && styles.fxPhone)}
      style={{ '--fx-centre': `${(centre * 100).toFixed(1)}%` } as CSSProperties}
      data-testid="bonus-celebration"
      data-kind={kind}
      data-stage={current}
      aria-hidden="true"
    >
      {!reduced && <div className={styles.fxFlash} />}
      {!reduced && placed && <ParticleCanvas kind={kind} id={celebration.id} durationMs={celebration.holdMs} originY={centre} />}
      <div ref={bannerRef} className={styles.fxBanner} data-testid="bonus-banner">
        <BonusMedallion kind={kind} size={phone ? 68 : 96} className={styles.fxMedallion} />
        <div className={styles.fxTitle} data-text={title}>
          {title}
        </div>
        <div className={styles.fxRule}>{BONUS_RULE[kind]}</div>
        <div className={styles.fxPayout} data-testid="bonus-payout">
          {payoutParts(celebration).map((part, i) => (
            <Fragment key={part.tone}>
              {i > 0 && ' '}
              <span className={cx(styles.fxPart, part.tone === 'won' && styles.fxWon, part.tone === 'none' && styles.fxNoBet, part.tone === 'push' && styles.fxPush)}>
                {i > 0 && <span className={styles.fxSep}>· </span>}
                {part.text}
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
