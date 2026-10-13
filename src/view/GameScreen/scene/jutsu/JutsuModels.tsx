/* eslint-disable react/no-unknown-property, react/require-default-props */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  birdGeometry, boltGeometry, kunaiGeometry, plainKunaiGeometry, rasenshurikenGeometry,
  sandSpikesGeometry, sealInkGeometry, sealTagGeometry, splashDropGeometry, splashRingGeometry,
} from './jutsuGeometry';
import { lightningFork, rasenshurikenSpin } from './explosionPoses';

/**
 * The jutsu pieces that ride on bombs and enemy attacks: the Rasenshuriken's
 * wind blades, Minato's marked kunai, Deidara's clay bird, Chidori's sparks,
 * the rogue genin's kunai, sand spikes, a lightning strike and a water
 * clone's puddle. Geometry and materials are shared module-wide and use the
 * standard and basic programs every match already compiles (ShaderWarmup),
 * so mounting one never compiles a shader. Spins and crackles keep to the
 * beats in jutsuLooks and hold still under reduced motion.
 */

export const JUTSU_MATERIALS = {
  // The Rasenshuriken's blades: pale, see-through, lit from within.
  windBlade: new THREE.MeshStandardMaterial({
    color: '#f0f9ff', emissive: '#7dd3fc', emissiveIntensity: 0.9, transparent: true, opacity: 0.62, depthWrite: false,
  }),
  steel: new THREE.MeshStandardMaterial({
    color: '#cbd5e1', metalness: 0.55, roughness: 0.3, emissive: '#334155', emissiveIntensity: 0.15
  }),
  sealPaper: new THREE.MeshStandardMaterial({
    color: '#fef3c7', roughness: 0.8, emissive: '#fde68a', emissiveIntensity: 0.12
  }),
  sealInk: new THREE.MeshStandardMaterial({ color: '#7f1d1d', roughness: 0.8 }),
  clay: new THREE.MeshStandardMaterial({
    color: '#f5efe0', roughness: 0.55, emissive: '#ff8a00', emissiveIntensity: 0.1
  }),
  spark: new THREE.MeshBasicMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.9 }),
  strike: new THREE.MeshBasicMaterial({ color: '#dbeafe', transparent: true, opacity: 0.88 }),
  sand: new THREE.MeshStandardMaterial({
    color: '#d6a45d', roughness: 0.9, emissive: '#f59e0b', emissiveIntensity: 0.18
  }),
  water: new THREE.MeshStandardMaterial({
    color: '#67e8f9', emissive: '#22d3ee', emissiveIntensity: 0.45, transparent: true, opacity: 0.55, depthWrite: false,
  }),
} as const;

/** The Rasenshuriken's four wind blades, turning flat round the bomb. */
export function RasenshurikenBlades({
  reducedMotion, size = 0.62,
}: { reducedMotion: boolean; size?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = rasenshurikenSpin(clock.elapsedTime, 0, reducedMotion);
  });
  return (
    <mesh
      ref={ref}
      geometry={rasenshurikenGeometry()}
      material={JUTSU_MATERIALS.windBlade}
      scale={[size, 1, size]}
    />
  );
}

/** Minato's three-pronged kunai with its seal tag, driven into the floor at a lean. */
export function HiraishinKunai({ lean = 0.32, scale = 1 }: { lean?: number; scale?: number }) {
  return (
    <group rotation={[0, Math.PI / 5, lean]} scale={scale}>
      <mesh geometry={kunaiGeometry()} material={JUTSU_MATERIALS.steel} castShadow />
      <mesh geometry={sealTagGeometry()} material={JUTSU_MATERIALS.sealPaper} />
      <mesh geometry={sealInkGeometry()} material={JUTSU_MATERIALS.sealInk} />
    </group>
  );
}

/** One of Deidara's clay birds, wings spread, perched over its charge. */
export function ClayBird({ scale = 1 }: { scale?: number }) {
  return (
    <mesh geometry={birdGeometry()} material={JUTSU_MATERIALS.clay} scale={scale} castShadow />
  );
}

/** Chidori's crackle: three small bolts round the charge, re-forking a few times a second. */
export function ChidoriSparks({
  reducedMotion, size = 0.34,
}: { reducedMotion: boolean; size?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = lightningFork(clock.elapsedTime, reducedMotion) * 2.1;
  });
  return (
    <group ref={ref}>
      {[0, 2.1, 4.2].map((angle) => (
        <mesh
          key={angle}
          geometry={boltGeometry()}
          material={JUTSU_MATERIALS.spark}
          position={[Math.sin(angle) * 0.18, -0.12, Math.cos(angle) * 0.18]}
          rotation={[Math.cos(angle) * 0.5, angle, Math.sin(angle) * 0.5]}
          scale={size}
        />
      ))}
    </group>
  );
}

/** A rogue genin's thrown kunai: falling in on the warning, stuck in the floor when it hits. */
export function KunaiStrike({ active }: { active: boolean }) {
  return (
    <group position={[0, active ? 0.2 : 0.75, 0]} rotation={[0.35, 0.6, 0.25]}>
      <mesh
        geometry={plainKunaiGeometry()}
        material={JUTSU_MATERIALS.steel}
        scale={1.3}
        castShadow
      />
    </group>
  );
}

/** Sand spikes bursting from the floor: low while warned, full height when they hit. */
export function SandSpikes({ active }: { active: boolean }) {
  return (
    <mesh
      geometry={sandSpikesGeometry()}
      material={JUTSU_MATERIALS.sand}
      scale={[1, active ? 1 : 0.35, 1]}
      castShadow
    />
  );
}

/** A lightning strike from the sky: a short spark while warned, the full bolt when it lands. */
export function LightningStrike({ active }: { active: boolean }) {
  return (
    <mesh
      geometry={boltGeometry()}
      material={JUTSU_MATERIALS.strike}
      position={[0, active ? 0 : 1.15, 0]}
      scale={active ? [1.1, 1.6, 1.1] : [0.5, 0.35, 0.5]}
    />
  );
}

/** A water clone's puddle and droplets at its feet. */
export function WaterCloneSplash() {
  return (
    <group position={[0, -0.4, 0]}>
      <mesh geometry={splashRingGeometry()} material={JUTSU_MATERIALS.water} />
      <mesh geometry={splashDropGeometry()} material={JUTSU_MATERIALS.water} />
    </group>
  );
}
