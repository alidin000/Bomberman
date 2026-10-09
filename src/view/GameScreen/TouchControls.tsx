import React, {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef,
} from 'react';
import { EngineSelector, EngineStore, useEngineSelector } from '../../hooks/engineStore';
import { TouchController } from '../../input/touchController';
import { TouchButtonId, TouchCircle, touchLayout } from '../../input/touchLayout';
import { sendTouchKey, useSafeArea } from '../../input/touchMode';
import { TouchPreferences, useTouchPreferences } from '../../input/touchPreferences';
import { useViewportSize } from './useViewportSize';
import {
  ActionButton,
  BombButton,
  PadKnob,
  PadRing,
  PadZone,
  TouchGuideList,
  TouchLayer,
  UltimateButton,
} from './TouchControls.styles';

/** A short buzz per press, where the browser has one (Android Chrome; not iOS). */
export const TOUCH_VIBRATE_MS = 10;

function vibrate(preferences: TouchPreferences): void {
  if (!preferences.vibration) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(TOUCH_VIBRATE_MS);
  } catch {
    // Some browsers refuse outside a user gesture; the press still counts.
  }
}

/** Whether this browser can vibrate at all (no iOS browser can). */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

type TouchKit = { alive: boolean; detonator: boolean; cover: boolean };
const NO_KIT: TouchKit = { alive: false, detonator: false, cover: false };

/** What the touch seat can do now; the same object until that changes. */
function createTouchKitSelector(slot: number): EngineSelector<TouchKit> {
  return (state, previous) => {
    const player = state?.players[slot];
    if (!player) return NO_KIT;
    const next = {
      alive: player.alive,
      detonator: player.powerUps.includes('Detonator'),
      cover: player.obstacles > 0,
    };
    if (
      previous
      && previous.alive === next.alive
      && previous.detonator === next.detonator
      && previous.cover === next.cover
    ) return previous;
    return next;
  };
}

const BombGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10" cy="14" r="7" />
    <path d="M14.5 8.2 17 5.7l1.4 1.4-2.5 2.5zM18.6 2.6l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" />
  </svg>
);

const StarGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
  </svg>
);

const BurstGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 1 2.2 6.1L20 4l-3.1 5.8L23 12l-6.1 2.2L20 20l-5.8-3.1L12 23l-2.2-6.1L4 20l3.1-5.8L1 12l6.1-2.2L4 4l5.8 3.1z" />
  </svg>
);

const WallGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2 5h9v4H2zm11 0h9v4h-9zM2 11h4v4H2zm6 0h8v4H8zm10 0h4v4h-4zM2 17h9v4H2zm11 0h9v4h-9z" />
  </svg>
);

type TouchControlsProps = {
  store: EngineStore;
  /** The seat the controls play: the first human seat. */
  slot: number;
  /** That seat's bindings: up, left, down, right, bomb, detonate, ultimate, cover. */
  keys: readonly string[];
  /** False while a menu or dialog is up: still drawn, but every press is let go. */
  enabled: boolean;
};

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

/**
 * Phone controls: a floating 4-way pad wherever the left thumb lands low on
 * the screen, and a 96 px bomb button with ultimate, detonate and cover
 * around it. They press the seat's bound keys (TouchController), so the
 * engine sees a keyboard. Dragging re-renders nothing: the ring and knob
 * move by transform, and keys go out only when the direction changes.
 */
export const TouchControls = React.memo(({
  store, slot, keys, enabled,
}: TouchControlsProps) => {
  const preferences = useTouchPreferences();
  const safe = useSafeArea();
  const viewport = useViewportSize();
  const width = Math.max(1, viewport.width - safe.left - safe.right);
  const height = Math.max(1, viewport.height - safe.top - safe.bottom);
  const layout = useMemo(
    () => touchLayout(width, height, preferences.size, preferences.leftHanded),
    [width, height, preferences.size, preferences.leftHanded]
  );
  const selectKit = useMemo(() => createTouchKitSelector(slot), [slot]);
  const kit = useEngineSelector(store, selectKit);

  const controllerRef = useRef<TouchController | null>(null);
  if (!controllerRef.current) controllerRef.current = new TouchController(keys, sendTouchKey);
  const controller = controllerRef.current;
  const layerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const ultimateRef = useRef<HTMLDivElement>(null);
  // Where the overlay box starts on screen, read once per touch.
  const originRef = useRef({ left: 0, top: 0 });
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const placeRing = useCallback((x: number, y: number) => {
    const { ring } = layoutRef.current.pad;
    const element = ringRef.current;
    if (element) element.style.transform = `translate3d(${x - ring / 2}px, ${y - ring / 2}px, 0)`;
  }, []);

  const placeKnob = useCallback((dx: number, dy: number) => {
    const { ring, knob } = layoutRef.current.pad;
    const reach = (ring - knob) / 2;
    const distance = Math.hypot(dx, dy);
    const scale = distance > reach ? reach / distance : 1;
    const element = knobRef.current;
    if (element) {
      element.style.transform = `translate3d(${dx * scale - knob / 2}px, ${dy * scale - knob / 2}px, 0)`;
    }
  }, []);

  const showDirection = useCallback(() => {
    const element = ringRef.current;
    if (!element) return;
    const held = controller.heldDirection;
    if (held) element.setAttribute('data-held', held);
    else element.removeAttribute('data-held');
  }, [controller]);

  const restPad = useCallback(() => {
    const { pad } = layoutRef.current;
    placeRing(pad.x, pad.y);
    placeKnob(0, 0);
    ringRef.current?.removeAttribute('data-active');
    showDirection();
  }, [placeKnob, placeRing, showDirection]);

  const releaseAll = useCallback(() => {
    controller.releaseAll();
    layerRef.current?.querySelectorAll('[data-pressed]').forEach((element) => {
      element.removeAttribute('data-pressed');
    });
    restPad();
  }, [controller, restPad]);

  // The pad rests where the layout puts it, and follows layout changes.
  useLayoutEffect(() => {
    if (!controller.padActive) restPad();
  }, [controller, layout, restPad]);

  useEffect(() => { controller.setKeys(keys); }, [controller, keys]);

  useEffect(() => {
    if (!enabled) releaseAll();
  }, [enabled, releaseAll]);

  // A held key outlives a lost touch, so let go of everything whenever the
  // page stops getting events: blur, a hidden tab, or unmount.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') releaseAll();
    };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', onVisibility);
      controller.releaseAll();
    };
  }, [controller, releaseAll]);

  // The ultimate's charge ring, written straight to the element: it changes
  // on most ticks while charging and must not re-render anything.
  useEffect(() => {
    let shown = -1;
    const update = () => {
      const player = store.getState()?.players[slot];
      const charge = player ? Math.round(player.ultimateCharge) : 0;
      if (charge === shown) return;
      shown = charge;
      const element = ultimateRef.current;
      if (!element) return;
      element.style.setProperty('--charge', String(charge));
      element.toggleAttribute('data-ready', charge >= 100);
    };
    update();
    return store.subscribe(update);
  }, [store, slot]);

  const toLocal = (event: React.PointerEvent) => ({
    x: event.clientX - originRef.current.left,
    y: event.clientY - originRef.current.top,
  });

  const capture = (event: React.PointerEvent) => {
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Capture is a nicety: without it the zone still sees moves over itself.
    }
  };

  const onPadDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabledRef.current) return;
    const box = layerRef.current?.getBoundingClientRect();
    originRef.current = { left: box?.left ?? 0, top: box?.top ?? 0 };
    const { x, y } = toLocal(event);
    if (!controller.padStart(event.pointerId, x, y)) return;
    event.preventDefault();
    capture(event);
    ringRef.current?.setAttribute('data-active', '');
    placeRing(x, y);
    placeKnob(0, 0);
  };

  const onPadMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!controller.isPadPointer(event.pointerId)) return;
    const { x, y } = toLocal(event);
    const before = controller.heldDirection;
    controller.padMove(event.pointerId, x, y);
    const { pad } = controller;
    placeRing(pad.originX, pad.originY);
    placeKnob(pad.offsetX, pad.offsetY);
    if (controller.heldDirection !== before) showDirection();
  };

  const onPadEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (controller.padEnd(event.pointerId)) restPad();
  };

  // The buttons share one set of handlers on the layer (presses bubble up
  // from them; the layer itself takes no hits).
  const buttonOf = (event: React.PointerEvent) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-touch-button]')
      : null;
    const button = target?.dataset.touchButton as TouchButtonId | undefined;
    return target && button ? { target, button } : null;
  };

  const onButtonDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const hit = buttonOf(event);
    if (!hit || !enabledRef.current) return;
    event.preventDefault();
    if (!controller.press(event.pointerId, hit.button)) return;
    try {
      hit.target.setPointerCapture?.(event.pointerId);
    } catch {
      // Without capture the release still arrives on the button itself.
    }
    hit.target.setAttribute('data-pressed', '');
    vibrate(preferencesRef.current);
  };

  const onButtonUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (controller.isPadPointer(event.pointerId)) return;
    if (!controller.release(event.pointerId)) return;
    buttonOf(event)?.target.removeAttribute('data-pressed');
  };

  const place = (circle: TouchCircle): React.CSSProperties => ({
    left: circle.x - circle.size / 2,
    top: circle.y - circle.size / 2,
    width: circle.size,
    height: circle.size,
  });
  const out = kit.alive ? undefined : '';

  const { zone, pad } = layout;
  return (
    <TouchLayer
      ref={layerRef}
      aria-hidden="true"
      data-touch-controls=""
      data-disabled={enabled ? undefined : ''}
      style={{ '--touch-rest': String(preferences.opacity / 100) } as React.CSSProperties}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={onButtonDown}
      onPointerUp={onButtonUp}
      onPointerCancel={onButtonUp}
      onLostPointerCapture={onButtonUp}
    >
      <PadZone
        data-touch-pad=""
        style={{
          left: zone.left, top: zone.top, width: zone.width, height: zone.height,
        }}
        onPointerDown={onPadDown}
        onPointerMove={onPadMove}
        onPointerUp={onPadEnd}
        onPointerCancel={onPadEnd}
        onLostPointerCapture={onPadEnd}
      />
      <PadRing ref={ringRef} style={{ width: pad.ring, height: pad.ring }}>
        {DIRECTIONS.map((direction) => <i key={direction} data-dir={direction} />)}
        <PadKnob ref={knobRef} style={{ width: pad.knob, height: pad.knob }} />
      </PadRing>
      <BombButton data-touch-button="bomb" data-out={out} style={place(layout.buttons.bomb)}>
        <BombGlyph />
        <span>Bomb</span>
      </BombButton>
      <UltimateButton
        ref={ultimateRef}
        data-touch-button="ultimate"
        data-out={out}
        style={place(layout.buttons.ultimate)}
      >
        <StarGlyph />
        <span>Ult</span>
      </UltimateButton>
      {/* Only while they can do something (Apple HIG: hide unavailable controls). */}
      {kit.detonator && (
        <ActionButton
          data-touch-button="detonate"
          data-out={out}
          style={place(layout.buttons.detonate)}
        >
          <BurstGlyph />
          <span>Det</span>
        </ActionButton>
      )}
      {kit.cover && (
        <ActionButton data-touch-button="cover" data-out={out} style={place(layout.buttons.cover)}>
          <WallGlyph />
          <span>Cover</span>
        </ActionButton>
      )}
    </TouchLayer>
  );
});
TouchControls.displayName = 'TouchControls';

/** The touch version of the controls guide, for the first match and the pause menu. */
export const TouchGuide = ({ leftHanded }: { leftHanded: boolean }) => {
  const padSide = leftHanded ? 'right' : 'left';
  const buttonSide = leftHanded ? 'left' : 'right';
  return (
    <TouchGuideList aria-label="touch controls">
      <li>
        <strong>Move:</strong>
        {` put your thumb down low on the ${padSide} and slide it. The pad starts wherever you touch.`}
      </li>
      <li>
        <strong>Bomb:</strong>
        {` the big round button on the ${buttonSide}.`}
      </li>
      <li>
        <strong>Ult:</strong>
        {' its ring fills as it charges; tap it when the ring is full.'}
      </li>
      <li>
        <strong>Det and Cover</strong>
        {' appear when you pick up a Detonator or a Barrier.'}
      </li>
      <li>
        <strong>Pause:</strong>
        {' the button at the top right. Size, opacity and side are in Settings.'}
      </li>
    </TouchGuideList>
  );
};
