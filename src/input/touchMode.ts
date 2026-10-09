import { useMemo, useSyncExternalStore } from 'react';
import {
  HudDevice, NO_SAFE_AREA, SafeArea, touchBands, touchClusterHeight, touchOrientation,
} from './touchLayout';
import {
  getTouchPreferences, subscribeTouchPreferences, useTouchPreferences,
} from './touchPreferences';

// Whether the touch controls are up. They come up on a touch screen (a
// coarse primary pointer) or on the first touch anywhere, and go away as
// soon as a keyboard or a gamepad is used, without sniffing the user agent.
// <html data-touch="on"> lets the HUD and menus follow in CSS, with the
// controls' extent in --touch-bottom, --touch-side and --touch-corner.

let active: boolean | null = null;
let safeArea: SafeArea = NO_SAFE_AREA;
const listeners = new Set<() => void>();
// The key events the touch controls send, so they do not count as a keyboard.
const touchKeyEvents = new WeakSet<Event>();

function coarsePointer(): boolean {
  try {
    return typeof window !== 'undefined'
      && window.matchMedia?.('(pointer: coarse)').matches === true;
  } catch {
    return false;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function isTouchMode(): boolean {
  if (active === null) active = coarsePointer();
  return active;
}

export function setTouchMode(next: boolean): void {
  if (isTouchMode() === next) return;
  active = next;
  notify();
}

export function subscribeTouchMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useTouchMode(): boolean {
  return useSyncExternalStore(subscribeTouchMode, isTouchMode, isTouchMode);
}

const getSafeArea = () => safeArea;

export function useSafeArea(): SafeArea {
  return useSyncExternalStore(subscribeTouchMode, getSafeArea, getSafeArea);
}

/**
 * The touch controls at their size preset while they are up, and the
 * safe-area insets: what the camera and the HUD bands make room for.
 */
export function useHudDevice(): HudDevice {
  const touch = useTouchMode();
  const { size } = useTouchPreferences();
  const safe = useSafeArea();
  return useMemo(() => ({ touch: touch ? size : null, safe }), [touch, size, safe]);
}

/**
 * Presses or releases `key` for the touch controls through the window key
 * path keyboards and pads use, so bindings, held-direction stacking and
 * buffered turns behave exactly as they do on a keyboard.
 */
export function sendTouchKey(type: 'keydown' | 'keyup', key: string): void {
  const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
  touchKeyEvents.add(event);
  window.dispatchEvent(event);
}

/** A gamepad steered a menu (pad game presses arrive as key events). */
export function notePadUse(): void {
  setTouchMode(false);
}

function px(value: string): number {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function sameArea(a: SafeArea, b: SafeArea): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

/** env(safe-area-inset-*) in px; zero without viewport-fit=cover or a notch. */
function readSafeArea(doc: Document): SafeArea {
  if (!doc.body) return NO_SAFE_AREA;
  const probe = doc.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;'
    + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) '
    + 'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  doc.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const next = {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  };
  probe.remove();
  return next;
}

function syncDocument(win: Window): void {
  const root = win.document.documentElement;
  const on = isTouchMode();
  root.setAttribute('data-touch', on ? 'on' : 'off');
  const { size } = getTouchPreferences();
  const orientation = touchOrientation(win.innerWidth, win.innerHeight);
  const bands = on ? touchBands(size, orientation) : { bottom: 0, side: 0 };
  const corner = on ? touchClusterHeight(size, orientation) : 0;
  root.style.setProperty('--touch-bottom', `${bands.bottom}px`);
  root.style.setProperty('--touch-side', `${bands.side}px`);
  root.style.setProperty('--touch-corner', `${corner}px`);
}

/**
 * Listens for the first touch and for keyboard and pad use, measures the
 * safe area on every resize, and keeps <html> in step. Mounted once at the
 * app root (TouchMode.tsx). Returns the uninstall.
 */
export function installTouchMode(win: Window = window): () => void {
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch') setTouchMode(true);
  };
  // Pads press the bound keys as window key events too, so this hears both.
  const onKeyDown = (event: KeyboardEvent) => {
    if (!touchKeyEvents.has(event)) setTouchMode(false);
  };
  const sync = () => syncDocument(win);
  const onResize = () => {
    const next = readSafeArea(win.document);
    if (!sameArea(next, safeArea)) {
      safeArea = next;
      notify();
    }
    sync();
  };
  win.addEventListener('pointerdown', onPointerDown, true);
  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('resize', onResize);
  win.addEventListener('orientationchange', onResize);
  const unsubscribeMode = subscribeTouchMode(sync);
  const unsubscribePreferences = subscribeTouchPreferences(sync);
  onResize();
  return () => {
    win.removeEventListener('pointerdown', onPointerDown, true);
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('resize', onResize);
    win.removeEventListener('orientationchange', onResize);
    unsubscribeMode();
    unsubscribePreferences();
  };
}
