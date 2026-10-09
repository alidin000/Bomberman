// Every periodic brightness, size or position change drawn in the arena, in
// cycles per second. WCAG 2.3.1 allows no more than three flashes in any one
// second above the general and red flash thresholds. Each of these stays at
// or under 3 Hz, so none of them can break that whatever area it covers, and
// each holds steady under reduced motion.
//
// Audit (production builds, frame by frame, 1366x768 and 390x844): two
// effects beat faster. The urgent bomb's swell ran at 3.8 Hz (24 rad/s), over
// a small area. The blast's screen shake ran at 13 and 11 Hz (83 and 71
// rad/s): shaking the whole view made every high-contrast edge on screen
// flicker, over half of a 10-degree field at the default shake setting, a
// general-flash failure.

/** No periodic effect may beat faster than this. */
export const MAX_FLASH_HZ = 3;

export const PULSE_HZ = {
  /** The whole bomb swelling over its last FUSE_URGENT_MS: "about to blow". */
  urgentBomb: 2.5,
  /** A bomb's core breathing for its whole fuse. */
  bombCore: 1.6,
  /** A bomb's pooled light flickering. */
  bombLight: 1.9,
  /** Sudden death: the ring over the next pressure block's cell. */
  pressureRing: 1.9,
  /** A shielded fighter's body blinking. */
  invincibleBlink: 1.6,
  /** A boss strike's effect breathing before it turns lethal. */
  hazardPulse: 1.27,
  /** The red pin bobbing over an enemy's target cell. */
  warningPin: 1.1,
  /**
   * Screen shake after a blast or a hit: one jolt that swings out and back.
   * Both axes share this beat, so no edge on screen crosses a pixel more
   * than twice a cycle. Off under reduced motion and with Screen shake at 0.
   */
  cameraShake: 2,
} as const;

/** Angular rate (radians per second) for `Math.sin(seconds * rate)` to beat at `hz`. */
export function pulseRate(hz: number): number {
  return hz * Math.PI * 2;
}
