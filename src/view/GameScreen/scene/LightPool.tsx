/* eslint-disable react/no-unknown-property, react/require-default-props */
import React, {
  createContext, forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef,
} from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  POOLED_POINT_LIGHT_COUNT,
  PooledLightHandle,
  PooledLightRequest,
  selectPooledLights,
} from './lightPoolSlots';

type LightPoolApi = {
  add: (request: PooledLightRequest) => void;
  remove: (request: PooledLightRequest) => void;
};

const LightPoolContext = createContext<LightPoolApi | null>(null);

/**
 * Owns a fixed set of point lights and hands them to the brightest-priority
 * `PooledPointLight` requests each frame. Unused slots stay mounted and
 * visible at intensity 0, which keeps the shader light count constant.
 */
export function LightPool({
  children,
  size = POOLED_POINT_LIGHT_COUNT,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  const requestsRef = useRef(new Set<PooledLightRequest>());
  const lightsRef = useRef<(THREE.PointLight | null)[]>([]);
  const selectedRef = useRef<PooledLightRequest[]>([]);
  const api = useMemo<LightPoolApi>(() => ({
    add: (request) => { requestsRef.current.add(request); },
    remove: (request) => { requestsRef.current.delete(request); },
  }), []);

  useFrame(() => {
    const selected = selectedRef.current;
    const used = selectPooledLights(requestsRef.current, size, selected);
    for (let index = 0; index < size; index += 1) {
      const light = lightsRef.current[index];
      const request = index < used ? selected[index] : undefined;
      if (light && request) {
        request.anchor.updateWorldMatrix(true, false);
        light.position.setFromMatrixPosition(request.anchor.matrixWorld);
        light.color.copy(request.color);
        light.intensity = request.intensity;
        light.distance = request.distance;
        light.decay = request.decay;
      } else if (light) {
        // Keep the light mounted and visible; only its contribution goes away.
        light.intensity = 0;
      }
    }
  });

  return (
    <LightPoolContext.Provider value={api}>
      {Array.from({ length: size }, (_, index) => (
        <pointLight
          // eslint-disable-next-line react/no-array-index-key
          key={`pooled-light-${index}`}
          ref={(light) => { lightsRef.current[index] = light; }}
          intensity={0}
        />
      ))}
      {children}
    </LightPoolContext.Provider>
  );
}

type PooledPointLightProps = {
  color?: THREE.ColorRepresentation;
  intensity?: number;
  distance?: number;
  decay?: number;
  position?: [number, number, number];
  priority: number;
};

/**
 * Drop-in for `<pointLight>` that borrows a slot from the nearest LightPool.
 * The ref exposes intensity/color/position so per-frame code can animate it.
 */
export const PooledPointLight = forwardRef<PooledLightHandle, PooledPointLightProps>(
  ({
    color = '#ffffff',
    intensity = 1,
    distance = 0,
    decay = 2,
    position,
    priority,
  }, ref) => {
    const pool = useContext(LightPoolContext);
    const request = useMemo<PooledLightRequest>(() => {
      const anchor = new THREE.Object3D();
      return {
        anchor,
        position: anchor.position,
        color: new THREE.Color(color),
        intensity,
        distance,
        decay,
        priority,
      };
      // Created once; prop changes are applied below like R3F applies props.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { request.color.set(color); }, [color, request]);
    useEffect(() => { request.intensity = intensity; }, [intensity, request]);
    useEffect(() => { request.distance = distance; }, [distance, request]);
    useEffect(() => { request.decay = decay; }, [decay, request]);
    useEffect(() => { request.priority = priority; }, [priority, request]);
    useImperativeHandle(ref, () => request, [request]);

    useEffect(() => {
      if (!pool) return undefined;
      pool.add(request);
      return () => pool.remove(request);
    }, [pool, request]);

    return <primitive object={request.anchor} position={position ?? [0, 0, 0]} />;
  }
);
PooledPointLight.displayName = 'PooledPointLight';
