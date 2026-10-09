import { KeyBindings } from '../constants/props';
import {
  GamepadPoller, KeySink, PadMenuSink, PadSnapshot,
} from './gamepad';
import { notePadUse } from './touchMode';

// One poll loop for every pad consumer: the match (pads press the bound
// keys) and the menus (pads move focus and press buttons). Both read the
// same snapshot through one GamepadPoller, so each press has one owner.

/** What the menu navigator needs from the loop. */
export interface PadMenu {
  /** A press or release of a control the menu owns. */
  readonly control: PadMenuSink;
  /** Once per poll while menus take presses, for hold-to-repeat. */
  tick(pads: readonly (PadSnapshot | null)[], now: number): void;
  /** Ignore activations until `untilMs`; play just handed the pad over. */
  lock(untilMs: number): void;
  /** Forget held controls without releases (window blur). */
  reset(): void;
  /** A pad pressed a game key: the pad is the input in use. */
  notePadInput(): void;
}

/**
 * How long menus ignore A, B and Start after play hands the pad to them.
 * Players mash bomb (A) as a round ends; this keeps a mashed press from
 * skipping the result they have not read yet.
 */
export const MENU_HANDOFF_LOCK_MS = 600;

const NO_PADS: readonly (PadSnapshot | null)[] = [];
const NO_BINDINGS: KeyBindings = {};

function readPads(): readonly (PadSnapshot | null)[] {
  return navigator.getGamepads?.() ?? NO_PADS;
}

function hasConnectedPad(pads: readonly (PadSnapshot | null)[]): boolean {
  for (let i = 0; i < pads.length; i += 1) {
    if (pads[i]?.connected) return true;
  }
  return false;
}

let poller = new GamepadPoller();
let gameplay: { readonly current: KeyBindings } | null = null;
let menu: PadMenu | null = null;
let surfaces = 0;
let claims = 0;
let frame: number | undefined;
let listening = false;
// Keyboard movement is dropped on blur; held pad controls press again once
// the window has focus back.
let suspended = false;
let menuHadPresses = false;

// Window key events, so the engine's keyboard handlers and the screen's
// Escape (pause) handler treat a pad exactly like the bound keys.
const sendKey: KeySink = (type, key) => {
  if (type === 'keydown') menu?.notePadInput();
  window.dispatchEvent(new KeyboardEvent(type, { key }));
};

const menuSink: PadMenuSink = (control, pressed, slot) => {
  // Game presses arrive as key events, which put the touch controls away;
  // a menu press does it here.
  if (pressed) notePadUse();
  menu?.control(control, pressed, slot);
};

/**
 * Menus take new presses on every screen without a live match, and on the
 * game screen while it claims the pad (paused, a dialog, the guide).
 */
function menuTakesPresses(): boolean {
  return menu !== null && (gameplay === null || claims > 0);
}

function poll(): void {
  frame = undefined;
  const pads = readPads();
  const now = performance.now();
  const toMenu = menuTakesPresses();
  if (toMenu && !menuHadPresses && gameplay !== null) {
    menu?.lock(now + MENU_HANDOFF_LOCK_MS);
  }
  menuHadPresses = toMenu;
  if (!suspended) {
    poller.poll(pads, gameplay?.current ?? NO_BINDINGS, sendKey, menu ? menuSink : null, toMenu);
    if (toMenu) menu?.tick(pads, now);
  }
  if (hasConnectedPad(pads)) frame = requestAnimationFrame(poll);
}

function start(): void {
  if (frame === undefined) frame = requestAnimationFrame(poll);
}

function handleBlur(): void {
  suspended = true;
  poller.reset();
  menu?.reset();
}

function handleFocus(): void {
  suspended = false;
}

// Costs nothing until the browser exposes a pad (the first button press);
// only then does a per-frame poll run, and it stops once every pad is gone.
function sync(): void {
  const wanted = gameplay !== null || menu !== null;
  if (wanted && !listening) {
    listening = true;
    window.addEventListener('gamepadconnected', start);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    // A pad already pressed on an earlier screen stays exposed.
    if (hasConnectedPad(readPads())) start();
  } else if (!wanted && listening) {
    listening = false;
    window.removeEventListener('gamepadconnected', start);
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('focus', handleFocus);
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    poller = new GamepadPoller();
    suspended = false;
    menuHadPresses = false;
  }
}

function padsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
}

/** Plays pads through `bindings` (read on every poll). Returns the unregister. */
export function registerGameplayPad(bindings: { readonly current: KeyBindings }): () => void {
  if (!padsSupported()) return () => undefined;
  gameplay = bindings;
  sync();
  return () => {
    if (gameplay === bindings) gameplay = null;
    sync();
  };
}

/** Lets pads drive the menus. Returns the unregister. */
export function registerMenuPad(next: PadMenu): () => void {
  if (!padsSupported()) return () => undefined;
  menu = next;
  sync();
  return () => {
    if (menu === next) menu = null;
    sync();
  };
}

/**
 * A game screen is mounted: menus use only its open overlays and dialogs,
 * never the page behind them. Returns the release.
 */
export function addPadGameSurface(): () => void {
  surfaces += 1;
  return () => {
    surfaces -= 1;
  };
}

/** Hands new pad presses to the menus until released. */
export function claimPadForMenus(): () => void {
  claims += 1;
  return () => {
    claims -= 1;
  };
}

/** Whether menus may treat the whole page as one menu (no game screen). */
export function padPageIsMenu(): boolean {
  return surfaces === 0;
}
