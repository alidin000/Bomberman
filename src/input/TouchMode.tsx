import { useEffect } from 'react';
import { installTouchMode } from './touchMode';

/**
 * Brings the touch controls up on a touch screen or the first touch, and
 * puts them away when a keyboard or gamepad is used. Mounted once at the
 * app root, beside MenuPad.
 */
export const TouchMode = () => {
  useEffect(() => installTouchMode(window), []);
  return null;
};
