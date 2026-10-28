// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRef } from 'react';
import { cleanup, render, within } from '@testing-library/react';
import type { Card } from '@/engine';
import { DealtCard, type DealtCardProps } from './DealtCard';

afterEach(cleanup);

const six: Card = { rank: '6', suit: 'H', id: 12 };
const shoeRef = createRef<HTMLElement>();
const squeezed: DealtCardProps = { card: six, rotated: true, size: 60, shoeRef, dealMs: 442, revealMs: 1040, faceDown: true };
const announced = (root: HTMLElement): string[] => within(root).queryAllByRole('img').map((img) => img.getAttribute('aria-label') ?? '');
const has = (root: HTMLElement, name: string): boolean => root.className.split(/\s+/).some((c) => c.includes(`_${name}_`));

describe('DealtCard — the squeeze', () => {
  it('face down: only its back is announced and it wears the squeeze ring; turned: its face is announced and the ring is gone while the turn plays out', () => {
    const { container, rerender } = render(<DealtCard {...squeezed} />);
    const root = container.querySelector<HTMLElement>('[data-dealt]')!;
    expect(root.getAttribute('data-reveal')).toBe('true');
    expect(root.getAttribute('data-face-down')).toBe('true');
    expect(announced(root)).toEqual(['Face-down card']);
    expect(has(root, 'cardSuspense')).toBe(true);
    expect(has(root, 'cardFaceDown')).toBe(true);
    // The dealer calls the total: the card is named, the ring goes, the turn itself is not cut short.
    rerender(<DealtCard {...squeezed} faceDown={false} />);
    expect(root.hasAttribute('data-face-down')).toBe(false);
    expect(announced(root)).toEqual(['Six of Hearts']);
    expect(has(root, 'cardFaceDown')).toBe(false);
    expect(has(root, 'cardSuspense')).toBe(true);
    expect(root.hasAttribute('data-glow')).toBe(false);
  });

  it('keeps the timings it landed with, so a speed change mid-hand never turns it face down again', () => {
    const { container, rerender } = render(<DealtCard {...squeezed} />);
    const root = container.querySelector<HTMLElement>('[data-dealt]')!;
    rerender(<DealtCard {...squeezed} faceDown={false} dealMs={460} revealMs={1760} />);
    expect(root.style.getPropertyValue('--reveal-ms')).toBe('1040ms');
    expect(root.style.getPropertyValue('--deal-ms')).toBe('442ms');
  });

  it('a fast-forward snaps it face up and names it at once', () => {
    const { container, rerender } = render(<DealtCard {...squeezed} />);
    const root = container.querySelector<HTMLElement>('[data-dealt]')!;
    rerender(<DealtCard {...squeezed} revealMs={0} />);
    expect(root.hasAttribute('data-reveal')).toBe(false);
    expect(root.hasAttribute('data-face-down')).toBe(false);
    expect(has(root, 'cardSnapped')).toBe(true);
    expect(has(root, 'cardFaceDown')).toBe(false);
    expect(announced(root)).toEqual(['Six of Hearts']);
  });

  it('a card that lands face up (instant speed, or no squeeze) is never announced as face down', () => {
    for (const props of [{ ...squeezed, dealMs: 0, revealMs: 0 }, { ...squeezed, revealMs: 0 }, { ...squeezed, dealMs: 0 }]) {
      const { container, unmount } = render(<DealtCard {...props} />);
      const root = container.querySelector<HTMLElement>('[data-dealt]')!;
      expect(root.hasAttribute('data-face-down')).toBe(false);
      expect(announced(root)).toEqual(['Six of Hearts']);
      unmount();
    }
  });
});

describe('the squeeze’s stylesheet', () => {
  const css = readFileSync(join(dirname(expect.getState().testPath ?? ''), 'Felt.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  };

  it('rings a face-down card in its side’s colour only — gold for the Banker, pearl for the Player — and fades it out by the turn', () => {
    expect(rule('.banker')).toMatch(/--squeeze-rgb:\s*241, 214, 120/);
    expect(rule('.player')).toMatch(/--squeeze-rgb:\s*233, 228, 242/);
    const ring = rule('.cardFaceDown::before');
    expect(ring).toMatch(/rgba\(var\(--squeeze-rgb/);
    expect(ring).not.toMatch(/rgba\(\d/);
    expect(ring).toMatch(/animation:\s*cardWait var\(--reveal-ms\)/);
    expect(css).toMatch(/@keyframes cardWait \{[^\n]*100% \{ opacity: 0; \}/);
    // No ring tied to the squeeze itself: once the card turns, nothing is left on it.
    expect(rule('.cardSuspense::before')).toBe('');
  });
});
