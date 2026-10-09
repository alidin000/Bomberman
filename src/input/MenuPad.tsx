import React, { useEffect, useLayoutEffect } from 'react';
import { GlobalStyles } from '@mui/material';
import { MenuPadNavigator, PAD_FOCUS_ATTRIBUTE } from './padNavigator';
import {
  addPadGameSurface, claimPadForMenus, padPageIsMenu, registerMenuPad,
} from './padHub';

// Ink ring with a paper halo, so it reads on the paper panels and on the
// dark title screen alike. Only while the marked control holds focus. A
// switch row spans its scrolling panel edge to edge, which would clip an
// outer ring, so rows get it inside their box.
const PAD_FOCUS_STYLES = {
  [`[${PAD_FOCUS_ATTRIBUTE}]:focus-within`]: {
    outline: '3px solid var(--anime-ink) !important',
    outlineOffset: '2px !important',
    boxShadow: '0 0 0 7px var(--anime-paper-light) !important',
  },
  [`.MuiFormControlLabel-root[${PAD_FOCUS_ATTRIBUTE}]:focus-within`]: {
    outlineOffset: '-3px !important',
    boxShadow: 'none !important',
  },
};

/**
 * Lets gamepads drive every screen and dialog. Mounted once at the app root.
 * The match itself keeps its own pad mapping (useGamepadInput); this only
 * takes presses when no match is live.
 */
export const MenuPad = () => {
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return undefined;
    }
    const navigatorForPads = new MenuPadNavigator(document, padPageIsMenu);
    const uninstall = navigatorForPads.install();
    const unregister = registerMenuPad(navigatorForPads);
    return () => {
      unregister();
      uninstall();
    };
  }, []);
  return <GlobalStyles styles={PAD_FOCUS_STYLES} />;
};

/**
 * For the game screen: pads steer only its overlays and dialogs, never the
 * page behind them, and they go to the menus while `menuActive` (paused, a
 * result, the controls guide) and to the match otherwise.
 */
export function usePadGameSurface(menuActive: boolean): void {
  useLayoutEffect(() => addPadGameSurface(), []);
  useLayoutEffect(() => (menuActive ? claimPadForMenus() : undefined), [menuActive]);
}
