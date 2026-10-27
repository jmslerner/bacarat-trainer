// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Chip, ChipStack, amountToChips, chipColor, chipLabel, CHIP_SIZES } from './Chip';

afterEach(cleanup);

describe('chip helpers', () => {
  it('maps denominations to US casino colours', () => {
    expect(chipColor(1).name).toBe('white');
    expect(chipColor(5).name).toBe('red');
    expect(chipColor(25).name).toBe('green');
    expect(chipColor(100).name).toBe('black');
    expect(chipColor(500).name).toBe('purple');
    expect(chipColor(1000).name).toBe('pumpkin');
    expect(chipColor(5000).name).toBe('brown');
    expect(chipColor(37).name).toBe('gray');
  });
  it('labels values', () => {
    expect(chipLabel(25)).toBe('25');
    expect(chipLabel(2.5)).toBe('2.50');
    expect(chipLabel(1000)).toBe('1000');
  });
  it('breaks amounts into chips largest first', () => {
    expect(amountToChips(130, [1, 5, 25, 100, 500, 1000])).toEqual([100, 25, 5]);
    expect(amountToChips(1550, [1, 5, 25, 100, 500, 1000])).toEqual([1000, 500, 25, 25]);
    expect(amountToChips(0, [1, 5])).toEqual([]);
    expect(amountToChips(7.5, [5, 25])).toEqual([5, 5]); // remainder ≥ half the smallest chip
    expect(amountToChips(6, [5, 25])).toEqual([5]);
    expect(amountToChips(10, [])).toEqual([]);
  });
});

describe('Chip', () => {
  it('renders as an image by default with colour variables', () => {
    render(<Chip value={25} />);
    const chip = screen.getByRole('img', { name: '$25 chip' });
    expect(chip).toHaveTextContent('25');
    expect(chip.style.getPropertyValue('--chip-base')).toBe(chipColor(25).base);
    expect(chip.style.getPropertyValue('--chip-size')).toBe(`${CHIP_SIZES.md}px`);
  });
  it('forwards extra attributes on the image chip too', () => {
    render(<Chip value={5} data-testid="chip-5" title="five" />);
    expect(screen.getByTestId('chip-5')).toHaveAttribute('title', 'five');
    expect(screen.getByTestId('chip-5')).toHaveAttribute('role', 'img');
  });
  it('renders as a button when clickable and reports selection', () => {
    const onClick = vi.fn();
    render(<Chip value={100} selected onClick={onClick} size="lg" />);
    const btn = screen.getByRole('button', { name: '$100 chip' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn.style.getPropertyValue('--chip-size')).toBe(`${CHIP_SIZES.lg}px`);
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ChipStack', () => {
  it('stacks explicit chips and shows the total', () => {
    render(<ChipStack chips={[25, 25, 5]} showTotal />);
    const stack = screen.getByRole('img', { name: '$55 in chips' });
    expect(stack).toHaveAttribute('data-total', '55');
    expect(stack).toHaveAttribute('data-count', '3');
    expect(stack.querySelectorAll('[data-value]')).toHaveLength(3);
    expect(stack).toHaveTextContent('$55');
  });
  it('breaks an amount into chips and caps the visible count', () => {
    render(<ChipStack amount={1000} denominations={[5, 25, 100]} maxVisible={4} />);
    const stack = screen.getByRole('img', { name: '$1,000 in chips' });
    expect(stack).toHaveAttribute('data-count', '10');
    expect(stack.querySelectorAll('[data-value]')).toHaveLength(4);
  });
  it('renders an empty stack gracefully', () => {
    render(<ChipStack chips={[]} showTotal />);
    expect(screen.getByRole('img', { name: 'No chips' })).toBeInTheDocument();
  });
});
