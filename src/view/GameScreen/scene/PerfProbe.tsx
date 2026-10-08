import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export type BombermanPerfSnapshot = {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  meshes: number;
  /** Max minus min camera height over the window; non-zero while shaking. */
  cameraYRange: number;
  avgFrameMs: number;
  maxFrameMs: number;
  frames: number;
  sampledAt: number;
};

declare global {
  interface Window {
    __bombermanPerf?: BombermanPerfSnapshot;
  }
}

// Read once at module load: in-app navigation drops the query string, so
// open the app as `/?perf` and the probe stays on for the whole session.
export const PERF_PROBE_ENABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('perf');

const SAMPLE_WINDOW_SECONDS = 1;

/**
 * Debug-only renderer probe. Mounted only when the page was opened with
 * `?perf`; publishes renderer.info and frame timing to `window.__bombermanPerf`
 * once per second. R3F resets renderer.info at the start of every render, so the
 * values read here describe the previous full frame, shadow pass included.
 */
export function PerfProbe() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const windowRef = useRef({
    frames: 0, elapsed: 0, maxFrame: 0, minCameraY: Infinity, maxCameraY: -Infinity
  });

  useFrame((_, delta) => {
    const sample = windowRef.current;
    sample.frames += 1;
    sample.elapsed += delta;
    sample.maxFrame = Math.max(sample.maxFrame, delta);
    sample.minCameraY = Math.min(sample.minCameraY, camera.position.y);
    sample.maxCameraY = Math.max(sample.maxCameraY, camera.position.y);
    if (sample.elapsed < SAMPLE_WINDOW_SECONDS) return;

    let meshes = 0;
    scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes += 1;
    });
    const { render, memory, programs } = gl.info;
    // eslint-disable-next-line no-underscore-dangle
    window.__bombermanPerf = {
      calls: render.calls,
      triangles: render.triangles,
      geometries: memory.geometries,
      textures: memory.textures,
      programs: programs?.length ?? 0,
      meshes,
      cameraYRange: sample.maxCameraY - sample.minCameraY,
      avgFrameMs: (sample.elapsed * 1000) / sample.frames,
      maxFrameMs: sample.maxFrame * 1000,
      frames: sample.frames,
      sampledAt: performance.now(),
    };
    sample.frames = 0;
    sample.elapsed = 0;
    sample.maxFrame = 0;
    sample.minCameraY = Infinity;
    sample.maxCameraY = -Infinity;
  });

  return null;
}
