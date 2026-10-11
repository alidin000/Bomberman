export type ResolutionProfile = {
  maxDpr: number;
  pixelBudget: number;
};

export type AdaptiveDprState = {
  dpr: number;
  fastWindows: number;
};

export type AdaptiveDprRuntime = AdaptiveDprState & {
  targetDpr: number;
};

export const STANDARD_RESOLUTION_PROFILE: ResolutionProfile = {
  maxDpr: 2,
  pixelBudget: 2_200_000,
};

export const LOW_END_RESOLUTION_PROFILE: ResolutionProfile = {
  maxDpr: 1.5,
  pixelBudget: 1_100_000,
};

const DPR_STEP = 0.25;
const SLOW_FRAME_MS = 22;
const FAST_FRAME_MS = 18.5;
const FAST_WINDOWS_TO_RAISE = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Selects a sharp initial resolution without letting high-density screens
 * create an unbounded WebGL drawing buffer. Values are rounded down so the
 * selected DPR always remains inside the profile's pixel budget.
 */
export function initialCanvasDpr({
  width,
  height,
  deviceDpr,
  lowEnd,
}: {
  width: number;
  height: number;
  deviceDpr: number;
  lowEnd: boolean;
}): number {
  const profile = lowEnd ? LOW_END_RESOLUTION_PROFILE : STANDARD_RESOLUTION_PROFILE;
  const cssPixels = Math.max(1, width) * Math.max(1, height);
  const budgetDpr = Math.sqrt(profile.pixelBudget / cssPixels);
  const deviceLimit = clamp(
    Number.isFinite(deviceDpr) ? deviceDpr : 1,
    1,
    profile.maxDpr
  );
  return budgetDpr >= deviceLimit
    ? deviceLimit
    : Math.max(1, Math.floor(budgetDpr * 10) / 10);
}

/** Applies one sampled frame-time window, with hysteresis around 60 fps. */
export function nextAdaptiveDpr(
  state: AdaptiveDprState,
  averageFrameMs: number,
  targetDpr: number
): AdaptiveDprState {
  if (averageFrameMs > SLOW_FRAME_MS && state.dpr > 1) {
    return {
      dpr: Math.max(1, Math.round((state.dpr - DPR_STEP) * 100) / 100),
      fastWindows: 0,
    };
  }

  if (averageFrameMs < FAST_FRAME_MS && state.dpr < targetDpr) {
    const fastWindows = state.fastWindows + 1;
    if (fastWindows >= FAST_WINDOWS_TO_RAISE) {
      return {
        dpr: Math.min(targetDpr, Math.round((state.dpr + DPR_STEP) * 100) / 100),
        fastWindows: 0,
      };
    }
    return { ...state, fastWindows };
  }

  return { ...state, fastWindows: 0 };
}

/** Keeps learned quality across canvas child remounts, but resets after a resize. */
export function reconcileAdaptiveDpr(
  runtime: AdaptiveDprRuntime,
  targetDpr: number
): AdaptiveDprRuntime {
  return runtime.targetDpr === targetDpr
    ? runtime
    : { targetDpr, dpr: targetDpr, fastWindows: 0 };
}
