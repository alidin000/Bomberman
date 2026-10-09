import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsScreen from './SettingsScreen';
import { DEFAULT_GAME_PREFERENCES } from '../gamePreferences';
import { setTouchMode } from '../../../input/touchMode';
import {
  TOUCH_PREFERENCES_KEY, loadTouchPreferences, reloadTouchPreferences,
} from '../../../input/touchPreferences';
import { createEngineStore } from '../../../hooks/engineStore';
import { TouchControls } from '../TouchControls';

const KEYS = ['w', 'a', 's', 'd', '2', '1', '3', '4'];

function openSettings() {
  return render(
    <MemoryRouter>
      <SettingsScreen
        open
        onClose={() => undefined}
        onRestart={() => undefined}
        onModifyControls={() => undefined}
        preferences={DEFAULT_GAME_PREFERENCES}
        onPreferencesChange={() => undefined}
      />
    </MemoryRouter>
  );
}

describe('Settings → Touch Controls', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadTouchPreferences();
    setTouchMode(true);
  });
  afterEach(() => setTouchMode(false));

  it('saves the size, opacity and side, and the next visit draws the controls that way', () => {
    const view = openSettings();
    fireEvent.click(screen.getByRole('button', { name: /large buttons/i }));
    fireEvent.click(screen.getByRole('button', { name: '100% opacity' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /left-handed/i }));
    expect(JSON.parse(localStorage.getItem(TOUCH_PREFERENCES_KEY) as string)).toMatchObject({
      size: 'large', opacity: 100, leftHanded: true,
    });
    view.unmount();

    // A new visit reads them back from storage.
    reloadTouchPreferences();
    expect(loadTouchPreferences()).toMatchObject({ size: 'large', opacity: 100, leftHanded: true });
    openSettings();
    expect(screen.getByRole('button', { name: /large buttons/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: /left-handed/i })).toBeChecked();

    const { container } = render(
      <TouchControls store={createEngineStore()} slot={0} keys={KEYS} enabled />
    );
    const layer = container.querySelector('[data-touch-controls]') as HTMLElement;
    const bomb = container.querySelector('[data-touch-button="bomb"]') as HTMLElement;
    const pad = container.querySelector('[data-touch-pad]') as HTMLElement;
    expect(bomb.style.width).toBe('112px');
    expect(layer.style.getPropertyValue('--touch-rest')).toBe('1');
    // Left-handed: the bomb on the left half, the pad zone on the right.
    expect(parseFloat(bomb.style.left)).toBeLessThan(window.innerWidth / 2);
    expect(parseFloat(pad.style.left)).toBeGreaterThan(0);
  });

  it('puts every touch option back with Reset Touch Layout', () => {
    openSettings();
    fireEvent.click(screen.getByRole('button', { name: /small buttons/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Touch Layout' }));
    expect(loadTouchPreferences()).toEqual({
      size: 'medium', opacity: 60, leftHanded: false, vibration: false,
    });
    expect(screen.getByRole('button', { name: /medium buttons/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('leaves the section out on a screen with no touch at all', () => {
    setTouchMode(false);
    openSettings();
    expect(screen.queryByRole('region', { name: /touch controls/i })).toBeNull();
    expect(screen.queryByText('Touch Controls')).toBeNull();
  });
});
