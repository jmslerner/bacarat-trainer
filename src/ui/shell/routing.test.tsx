// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AppShell } from './AppShell';
import { parseHash, toHash, navigate, useHashRoute, MODES } from './routing';
import { Providers } from './Providers';

function PlayStub(): JSX.Element {
  return <div data-testid="view-play">PLAY VIEW</div>;
}
function LearnStub(): JSX.Element {
  const route = useHashRoute();
  return <div data-testid="view-learn">LEARN VIEW {route.lessonId ?? '(index)'}</div>;
}
function LabStub(): JSX.Element {
  return <div data-testid="view-lab">LAB VIEW</div>;
}
const views = { play: PlayStub, learn: LearnStub, lab: LabStub };

function setHash(hash: string): void {
  act(() => {
    window.location.hash = hash;
    // jsdom fires hashchange asynchronously; dispatch synchronously for deterministic tests.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('parseHash', () => {
  it('defaults to play for empty or unknown hashes', () => {
    expect(parseHash('')).toMatchObject({ mode: 'play', lessonId: null });
    expect(parseHash('#')).toMatchObject({ mode: 'play', lessonId: null });
    expect(parseHash('#nope')).toMatchObject({ mode: 'play', lessonId: null });
    expect(parseHash('#main')).toMatchObject({ mode: 'play', lessonId: null });
  });
  it('parses the three modes case-insensitively', () => {
    expect(parseHash('#play').mode).toBe('play');
    expect(parseHash('#Learn').mode).toBe('learn');
    expect(parseHash('#lab').mode).toBe('lab');
    expect(parseHash('lab').mode).toBe('lab');
    expect(parseHash('#/lab').mode).toBe('lab');
  });
  it('extracts a lesson id only under learn', () => {
    expect(parseHash('#learn/third-card')).toEqual({ mode: 'learn', lessonId: 'third-card', hash: '#learn/third-card' });
    expect(parseHash('#learn/').lessonId).toBeNull();
    expect(parseHash('#learn/bad id!').lessonId).toBeNull();
    expect(parseHash('#lab/third-card').lessonId).toBeNull();
    expect(parseHash('#learn/' + encodeURIComponent('dragon-panda')).lessonId).toBe('dragon-panda');
  });
  it('round-trips through toHash', () => {
    expect(toHash('play')).toBe('#play');
    expect(toHash('learn', 'roads')).toBe('#learn/roads');
    expect(toHash('learn', null)).toBe('#learn');
    for (const m of MODES) expect(parseHash(toHash(m.id)).mode).toBe(m.id);
  });
});

describe('AppShell routing', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = '';
  });
  afterEach(() => {
    cleanup();
    window.location.hash = '';
  });

  it('renders the Play view by default and switches with the hash', () => {
    render(
      <Providers>
        <AppShell views={views} />
      </Providers>,
    );
    expect(screen.getByTestId('view-play')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^play/i })).toHaveAttribute('aria-current', 'page');

    setHash('#learn/third-card');
    expect(screen.getByTestId('view-learn')).toHaveTextContent('LEARN VIEW third-card');
    expect(screen.getByRole('link', { name: /learn/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByTestId('view-play')).not.toBeInTheDocument();

    setHash('#lab');
    expect(screen.getByTestId('view-lab')).toBeInTheDocument();
    expect(document.title).toMatch(/Strategy Lab/);

    setHash('#garbage');
    expect(screen.getByTestId('view-play')).toBeInTheDocument();
  });

  it('mode tabs are links to the mode hashes', () => {
    render(
      <Providers>
        <AppShell views={views} />
      </Providers>,
    );
    const nav = screen.getByRole('navigation', { name: /mode/i });
    const links = nav.querySelectorAll('a');
    expect(Array.from(links).map((a) => a.getAttribute('href'))).toEqual(['#play', '#learn', '#lab']);
  });

  it('navigate() sets the hash', () => {
    navigate('learn', 'roads');
    expect(window.location.hash).toBe('#learn/roads');
    navigate('#lab');
    expect(window.location.hash).toBe('#lab');
    navigate('play');
    expect(window.location.hash).toBe('#play');
  });

  it('shows the bankroll pill, sound toggle and opens the settings dialog', () => {
    render(
      <Providers>
        <AppShell views={views} />
      </Providers>,
    );
    expect(screen.getByTestId('bankroll-pill')).toHaveTextContent('$1,000');
    const sound = screen.getByTestId('sound-toggle');
    expect(sound).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(sound);
    expect(sound).toHaveAttribute('aria-pressed', 'false');
    expect(JSON.parse(window.localStorage.getItem('bt:prefs') ?? '{}').sound).toBe(false);

    fireEvent.click(screen.getByTestId('settings-button'));
    expect(screen.getByRole('dialog', { name: /table settings/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bankroll-pill'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /bankroll/i })).toHaveAttribute('aria-selected', 'true');
  });
});
