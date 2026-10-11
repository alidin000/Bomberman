import { MutableRefObject, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDprRuntime, nextAdaptiveDpr } from './adaptiveResolution';

const WARM_UP_SECONDS = 4;
const SAMPLE_SECONDS = 2;

/** Adjusts WebGL resolution only after sustained performance evidence. */
export function AdaptiveResolution({
  active,
  targetDpr,
  runtimeRef,
  onDprChange,
}: {
  active: boolean;
  targetDpr: number;
  runtimeRef: MutableRefObject<AdaptiveDprRuntime>;
  onDprChange: (dpr: number) => void;
}) {
  const setDpr = useThree((state) => state.setDpr);
  const sampleRef = useRef({ elapsed: 0, frames: 0, warmUp: 0 });

  useLayoutEffect(() => {
    sampleRef.current = { elapsed: 0, frames: 0, warmUp: 0 };
    setDpr(runtimeRef.current.dpr);
  }, [runtimeRef, setDpr, targetDpr]);

  useFrame((_, delta) => {
    if (!active || document.hidden) {
      sampleRef.current.elapsed = 0;
      sampleRef.current.frames = 0;
      return;
    }

    const sample = sampleRef.current;
    // Count very slow frames, but cap giant resume/debugger gaps so one event
    // cannot force a quality change by itself.
    const measuredDelta = Math.min(delta, 0.25);
    if (sample.warmUp < WARM_UP_SECONDS) {
      sample.warmUp += measuredDelta;
      return;
    }

    sample.elapsed += measuredDelta;
    sample.frames += 1;
    if (sample.elapsed < SAMPLE_SECONDS) return;

    const averageFrameMs = (sample.elapsed * 1000) / sample.frames;
    const next = nextAdaptiveDpr(runtimeRef.current, averageFrameMs, targetDpr);
    if (next.dpr !== runtimeRef.current.dpr) {
      setDpr(next.dpr);
      onDprChange(next.dpr);
    }
    // Shared with the parent so Suspense remounts keep the learned DPR.
    // eslint-disable-next-line no-param-reassign
    runtimeRef.current = { ...runtimeRef.current, ...next };
    sample.elapsed = 0;
    sample.frames = 0;
  });

  return null;
}
