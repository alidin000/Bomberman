import { nearestInDirection } from '../view/ConfigScreen/menuNavigation';
import { PAD_CONTROL, PAD_CONTROL_COUNT, PadSnapshot } from './gamepad';
import type { PadMenu } from './padHub';

/**
 * Sent on window when a pad presses Start in a menu on the game screen.
 * Cancel it to take the press (the round result confirms); otherwise Start
 * backs out like Escape, which resumes from the pause menu.
 */
export const PAD_START_EVENT = 'shinobi-pad-start';

/** Marks an overlay pads treat as a menu of its own, beside the MUI dialogs. */
export const PAD_LAYER_ATTRIBUTE = 'data-pad-layer';

/**
 * Set on the element a pad focused. Script focus after a mouse click does
 * not match :focus-visible (so MUI shows no ring), hence an app-owned one.
 */
export const PAD_FOCUS_ATTRIBUTE = 'data-pad-focus';

// Hold a direction: one step, then repeats after a pause, like a console menu.
export const REPEAT_DELAY_MS = 350;
export const REPEAT_EVERY_MS = 110;
const MAX_PADS = 4;
const SCROLL_DEADZONE = 0.3;
const SCROLL_PX_PER_POLL = 18;
const RANGE_STEPS_PER_PRESS = 5;
// Right stick vertical, standard layout.
const SCROLL_AXIS = 3;

const LAYER_SELECTOR = `[${PAD_LAYER_ATTRIBUTE}], .MuiModal-root`;
const FOCUSABLE_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
  '[role="option"]',
  '[role="menuitem"]',
].join(',');

const DIRECTION_BY_CONTROL: (readonly [number, number] | null)[] = Array.from(
  { length: PAD_CONTROL_COUNT },
  () => null
);
DIRECTION_BY_CONTROL[PAD_CONTROL.UP] = [0, -1];
DIRECTION_BY_CONTROL[PAD_CONTROL.LEFT] = [-1, 0];
DIRECTION_BY_CONTROL[PAD_CONTROL.DOWN] = [0, 1];
DIRECTION_BY_CONTROL[PAD_CONTROL.RIGHT] = [1, 0];

/**
 * A layer is live unless something modal covers it (MUI hides the rest of
 * the page while a dialog is up) or it is fading out: a closing MUI dialog
 * stays mounted for its exit transition, with its fade children already set
 * to opacity 0.
 */
function isLiveLayer(layer: HTMLElement): boolean {
  if (layer.closest('[aria-hidden="true"], [inert]')) return false;
  for (let child = layer.firstElementChild; child; child = child.nextElementSibling) {
    if (child instanceof HTMLElement && child.style.opacity === '0') return false;
  }
  return true;
}

function isRange(element: HTMLElement): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === 'range';
}

/** Steps a slider the way a drag does, so React and MUI see a real change. */
function stepRange(input: HTMLInputElement, sign: number): void {
  const min = input.min === '' ? 0 : Number(input.min);
  const max = input.max === '' ? 100 : Number(input.max);
  const step = Number(input.step) || 1;
  const value = Number(input.value);
  const next = Math.min(max, Math.max(min, value + sign * step * RANGE_STEPS_PER_PRESS));
  if (next === value) return;
  // React keeps its own copy of the value; only the native setter updates
  // what it compares against, so the input event reads as a change.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, String(next));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

type VisibilityCheck = { checkVisibility?: () => boolean };

/**
 * Whether the browser draws the control: not under display:none or
 * visibility:hidden, and with a box. Without layout (jsdom) only the
 * attribute checks in `candidates` apply.
 */
function isRendered(element: HTMLElement): boolean {
  const { checkVisibility } = element as HTMLElement & VisibilityCheck;
  if (typeof checkVisibility !== 'function') return true;
  if (!checkVisibility.call(element)) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

/**
 * MUI draws switches and sliders around a transparent input, so the ring
 * goes on what players see: the whole labelled row, or the slider thumb.
 */
function ringHost(element: HTMLElement): HTMLElement {
  if (element.tagName !== 'INPUT') return element;
  return element.closest<HTMLElement>('.MuiFormControlLabel-root')
    ?? element.closest<HTMLElement>('.MuiSlider-thumb, .MuiSwitch-root')
    ?? element;
}

/**
 * The box a control is navigated by. A slider's input sits in its thumb,
 * which moves with the value, so it counts as the whole rail; a switch
 * counts as its labelled row.
 */
function navigationBox(element: HTMLElement): HTMLElement {
  if (element.tagName !== 'INPUT') return element;
  if (isRange(element)) return element.closest<HTMLElement>('.MuiSlider-root') ?? element;
  return element.closest<HTMLElement>('.MuiFormControlLabel-root') ?? element;
}

function canScroll(element: Element): boolean {
  if (element.scrollHeight <= element.clientHeight + 1) return false;
  const { overflowY } = getComputedStyle(element);
  return overflowY === 'auto' || overflowY === 'scroll';
}

/**
 * Drives menus from a pad: the d-pad or left stick moves focus to the
 * nearest control in that direction (the Mission Deck's arrow-key scoring),
 * A presses it, B backs out like Escape, and Start acts as A on menu screens
 * and as pause/resume or "continue" on the game screen. The right stick
 * scrolls long pages such as the manual.
 *
 * Pad events are synthetic, and the browser never lets an untrusted key
 * event press a button or move focus, so this works on the DOM directly:
 * `focus()` and `click()` are honoured from script.
 */
export class MenuPadNavigator implements PadMenu {
  private readonly repeatAt: number[] = new Array(MAX_PADS * PAD_CONTROL_COUNT).fill(Number.NaN);

  private lockedUntil = Number.NEGATIVE_INFINITY;

  // The pad was the last input, so focus moves (MUI autofocus, focus
  // restore) get the ring too. A real pointer or key press ends it.
  private padModality = false;

  private ringed: HTMLElement | null = null;

  private scrollCache: { layer: HTMLElement | null; box: Element | null } = {
    layer: null,
    box: null,
  };

  private readonly doc: Document;

  /** True when no game screen is up, so the whole page is one menu. */
  private readonly pageIsMenu: () => boolean;

  constructor(doc: Document, pageIsMenu: () => boolean) {
    this.doc = doc;
    this.pageIsMenu = pageIsMenu;
  }

  readonly control = (control: number, pressed: boolean, slot: number): void => {
    const index = slot * PAD_CONTROL_COUNT + control;
    if (!pressed) {
      if (index < this.repeatAt.length) this.repeatAt[index] = Number.NaN;
      return;
    }
    this.padModality = true;
    const now = performance.now();
    const direction = DIRECTION_BY_CONTROL[control];
    if (direction) {
      if (index < this.repeatAt.length) this.repeatAt[index] = now + REPEAT_DELAY_MS;
      this.move(direction);
      return;
    }
    if (now < this.lockedUntil) return;
    if (control === PAD_CONTROL.SOUTH) this.accept();
    else if (control === PAD_CONTROL.EAST) this.back();
    else if (control === PAD_CONTROL.START) this.start();
  };

  tick(pads: readonly (PadSnapshot | null)[], now: number): void {
    for (let i = 0; i < this.repeatAt.length; i += 1) {
      // NaN (not held) never compares true.
      if (this.repeatAt[i] <= now) {
        this.repeatAt[i] = now + REPEAT_EVERY_MS;
        const direction = DIRECTION_BY_CONTROL[i % PAD_CONTROL_COUNT];
        if (direction) this.move(direction);
      }
    }
    let scroll = 0;
    for (let i = 0; i < pads.length; i += 1) {
      const pad = pads[i];
      const y = pad && pad.connected ? pad.axes[SCROLL_AXIS] ?? 0 : 0;
      if (Math.abs(y) > Math.abs(scroll)) scroll = y;
    }
    if (Math.abs(scroll) >= SCROLL_DEADZONE) this.scrollLayer(scroll * SCROLL_PX_PER_POLL);
  }

  lock(untilMs: number): void {
    this.lockedUntil = untilMs;
  }

  reset(): void {
    this.repeatAt.fill(Number.NaN);
  }

  notePadInput(): void {
    this.padModality = true;
  }

  /** Listens for focus and real input to keep the ring honest. Returns the cleanup. */
  install(): () => void {
    const onFocusIn = (event: FocusEvent) => {
      const { target } = event;
      if (this.padModality && target instanceof HTMLElement && target.matches(FOCUSABLE_SELECTOR)) {
        this.ring(target);
      } else {
        this.clearRing();
      }
    };
    const onRealInput = (event: Event) => {
      if (!event.isTrusted) return;
      this.padModality = false;
      this.clearRing();
    };
    this.doc.addEventListener('focusin', onFocusIn, true);
    this.doc.addEventListener('pointerdown', onRealInput, true);
    this.doc.addEventListener('keydown', onRealInput, true);
    return () => {
      this.doc.removeEventListener('focusin', onFocusIn, true);
      this.doc.removeEventListener('pointerdown', onRealInput, true);
      this.doc.removeEventListener('keydown', onRealInput, true);
      this.clearRing();
    };
  }

  /**
   * The menu pads act on: the open layer that holds focus, else the newest
   * one, else (off the game screen) the page.
   */
  private layer(): HTMLElement | null {
    const layers = Array.from(this.doc.querySelectorAll<HTMLElement>(LAYER_SELECTOR))
      .filter(isLiveLayer);
    const active = this.doc.activeElement;
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      if (active && layers[i].contains(active)) return layers[i];
    }
    if (layers.length > 0) return layers[layers.length - 1];
    return this.pageIsMenu() ? this.doc.body : null;
  }

  private candidates(layer: HTMLElement): HTMLElement[] {
    const page = layer === this.doc.body;
    return Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
      if (element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true') return false;
      // MUI's focus-trap guards are tabbable but are not controls.
      if (element.dataset.testid?.startsWith('sentinel')) return false;
      const owner = element.closest(LAYER_SELECTOR);
      if (page ? owner !== null : owner !== layer) return false;
      const hidden = element.closest('[aria-hidden="true"], [inert], [hidden]');
      if (hidden && layer.contains(hidden)) return false;
      return isRendered(element);
    });
  }

  private focused(candidates: HTMLElement[]): HTMLElement | null {
    const active = this.doc.activeElement;
    return active instanceof HTMLElement && candidates.includes(active) ? active : null;
  }

  private move(direction: readonly [number, number]): void {
    const layer = this.layer();
    if (!layer) return;
    const candidates = this.candidates(layer);
    const current = this.focused(candidates);
    if (!current) {
      // Nothing of this menu has focus yet: the first press only shows where
      // the pad starts.
      if (candidates[0]) this.focus(candidates[0]);
      return;
    }
    if (direction[1] === 0 && isRange(current)) {
      stepRange(current, direction[0]);
      this.ring(current);
      return;
    }
    const boxes = candidates.map(navigationBox);
    const target = nearestInDirection(navigationBox(current), boxes, direction);
    if (target) this.focus(candidates[boxes.indexOf(target)]);
  }

  private accept(): void {
    const layer = this.layer();
    if (!layer) return;
    const candidates = this.candidates(layer);
    const current = this.focused(candidates);
    if (!current) {
      if (candidates[0]) this.focus(candidates[0]);
      return;
    }
    this.ring(current);
    current.click();
  }

  /** B: the same Escape a keyboard sends, from where focus is. */
  private back(): void {
    const layer = this.layer();
    const active = this.doc.activeElement;
    let target: HTMLElement = this.doc.body;
    if (layer && active instanceof HTMLElement && layer.contains(active)) target = active;
    else if (layer) target = layer;
    const init = {
      key: 'Escape', code: 'Escape', bubbles: true, cancelable: true,
    };
    target.dispatchEvent(new KeyboardEvent('keydown', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));
  }

  private start(): void {
    if (this.pageIsMenu()) {
      this.accept();
      return;
    }
    const view = this.doc.defaultView ?? window;
    const event = new CustomEvent(PAD_START_EVENT, { cancelable: true });
    view.dispatchEvent(event);
    if (!event.defaultPrevented) this.back();
  }

  private focus(element: HTMLElement): void {
    // Chrome 145+ and Firefox also draw their native ring for this.
    element.focus({ focusVisible: true } as FocusOptions);
    this.ring(element);
  }

  private ring(element: HTMLElement): void {
    const host = ringHost(element);
    if (this.ringed === host) return;
    this.clearRing();
    host.setAttribute(PAD_FOCUS_ATTRIBUTE, '');
    this.ringed = host;
  }

  private clearRing(): void {
    this.ringed?.removeAttribute(PAD_FOCUS_ATTRIBUTE);
    this.ringed = null;
  }

  private scrollLayer(deltaPx: number): void {
    const layer = this.layer();
    if (this.scrollCache.layer !== layer) {
      this.scrollCache = { layer, box: layer ? this.findScrollBox(layer) : null };
    }
    const { box } = this.scrollCache;
    if (box) box.scrollTop += deltaPx;
  }

  private findScrollBox(layer: HTMLElement): Element | null {
    const active = this.doc.activeElement;
    let node = active instanceof Element && layer.contains(active) ? active : null;
    for (; node; node = node.parentElement) {
      if (canScroll(node)) return node;
      if (node === layer) break;
    }
    const inside = Array.from(layer.querySelectorAll('*')).find(canScroll);
    return inside ?? this.doc.scrollingElement;
  }
}
