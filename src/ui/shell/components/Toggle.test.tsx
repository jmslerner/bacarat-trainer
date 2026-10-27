// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Toggle } from './Toggle';
import { Select } from './Select';

afterEach(cleanup);

describe('Toggle', () => {
  it('is a labelled switch that reports its state and toggles on click', () => {
    const onChange = vi.fn();
    render(<Toggle label="Sound" description="Chips and cards" checked onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Sound' });
    expect(sw).toBeChecked();
    expect(sw).toHaveAccessibleDescription('Chips and cards');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
  });
  it('cannot be toggled when disabled', () => {
    const onChange = vi.fn();
    render(<Toggle label="Coach" checked={false} onChange={onChange} disabled />);
    const sw = screen.getByRole('switch', { name: 'Coach' });
    expect(sw).toBeDisabled();
    expect(sw).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Select', () => {
  it('is a labelled native select with hint/error wiring', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Select label="Decks" value="8" options={[{ value: '8', label: 'Eight' }, { value: '6', label: 'Six' }]} onChange={onChange} hint="Casinos deal eight" />,
    );
    const sel = screen.getByLabelText('Decks') as HTMLSelectElement;
    expect(sel.value).toBe('8');
    expect(sel).toHaveAccessibleDescription('Casinos deal eight');
    fireEvent.change(sel, { target: { value: '6' } });
    expect(onChange).toHaveBeenCalledWith('6');
    rerender(<Select label="Decks" value="8" options={[{ value: '8', label: 'Eight' }]} onChange={onChange} error="Not available" />);
    expect(sel).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Not available');
  });
});
