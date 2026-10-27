// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Tabs } from './Tabs';

afterEach(cleanup);

function Harness(): JSX.Element {
  const [v, setV] = useState<'a' | 'b' | 'c'>('a');
  return (
    <Tabs
      items={[
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta', disabled: true },
        { id: 'c', label: 'Gamma' },
      ]}
      value={v}
      onChange={setV}
      label="Sections"
    >
      <p>panel {v}</p>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('wires tabs to the panel with a roving tabindex and moves with the keyboard, skipping disabled tabs', () => {
    render(<Harness />);
    const list = screen.getByRole('tablist', { name: 'Sections' });
    const alpha = screen.getByRole('tab', { name: 'Alpha' });
    const gamma = screen.getByRole('tab', { name: 'Gamma' });
    expect(alpha).toHaveAttribute('aria-selected', 'true');
    expect(alpha).toHaveAttribute('tabindex', '0');
    expect(gamma).toHaveAttribute('tabindex', '-1');
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', alpha.id);
    expect(alpha).toHaveAttribute('aria-controls', panel.id);

    alpha.focus();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(gamma).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(gamma);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel c');
    fireEvent.keyDown(list, { key: 'ArrowRight' }); // wraps around, skipping the disabled Beta
    expect(alpha).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 'End' });
    expect(gamma).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(alpha).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(gamma);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel c');
  });
});
