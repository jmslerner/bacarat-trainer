// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NumberInput } from './NumberInput';

afterEach(cleanup);

function Harness({ min, max, decimals, step, initial = 1000 }: { min?: number; max?: number; decimals?: number; step?: number; initial?: number }): JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberInput label="Amount" value={value} onChange={setValue} min={min} max={max} decimals={decimals} step={step} prefix="$" />
      <output data-testid="value">{String(value)}</output>
    </>
  );
}

describe('NumberInput', () => {
  it('shows a grouped value when idle and the raw number while editing', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    expect(input.value).toBe('1,000');
    fireEvent.focus(input);
    expect(input.value).toBe('1000');
    fireEvent.blur(input);
    expect(input.value).toBe('1,000');
  });

  it('never hands the parent a value outside [min, max] or with too many decimals while typing', () => {
    render(<Harness min={0} max={5000} decimals={2} />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '-5' } });
    expect(input.value).toBe('-5'); // free typing in the field…
    expect(screen.getByTestId('value')).toHaveTextContent(/^0$/); // …but the parent only sees the clamped value
    fireEvent.change(input, { target: { value: '12.346' } });
    expect(screen.getByTestId('value')).toHaveTextContent(/^12\.35$/);
    fireEvent.change(input, { target: { value: '99999' } });
    expect(screen.getByTestId('value')).toHaveTextContent(/^5000$/);
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByTestId('value')).toHaveTextContent(/^5000$/); // empty text keeps the last value
    fireEvent.blur(input);
    expect(input.value).toBe('5,000');
  });

  it('commits on blur and Enter, steps with the arrow keys and the ± buttons within the bounds', () => {
    render(<Harness min={10} max={50} step={5} decimals={0} initial={20} />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);
    expect(screen.getByTestId('value')).toHaveTextContent(/^10$/);
    expect(input.value).toBe('10');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getByTestId('value')).toHaveTextContent(/^15$/);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('value')).toHaveTextContent(/^10$/); // clamped at min
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(screen.getByTestId('value')).toHaveTextContent(/^15$/);
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeEnabled();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '48' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('value')).toHaveTextContent(/^48$/);
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(screen.getByTestId('value')).toHaveTextContent(/^50$/);
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled();
  });

  it('flags unparsable text as invalid while focused and wires the hint for assistive tech', () => {
    render(<NumberInput label="Odds" value={8} onChange={() => undefined} hint="8 is standard" />);
    const input = screen.getByLabelText('Odds') as HTMLInputElement;
    expect(input).toHaveAccessibleDescription('8 is standard');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.blur(input);
    expect(input.value).toBe('8');
    expect(input).not.toHaveAttribute('aria-invalid');
  });
});
