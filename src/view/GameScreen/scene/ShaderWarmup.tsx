import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  FIGHTER_TOON_RAMP, createFighterWarmupMaterials, createInkWarmupMaterial,
} from './fighterInk';
import { createTokenWarmupMaterial } from './inkedToken';
import { castMaterial, createCastWarmupMaterials } from './cast/castMaterial';

function instancedWarmup(material: THREE.Material): THREE.Material {
  const target = material;
  target.userData.warmInstanced = true;
  return target;
}

/**
 * The campaign boss's looks (scene/BossFigure): a tailed beast is cel-shaded
 * like the fighters (their toon and ink programs, compiled below for every
 * match), and its tails are an instanced toon mesh with an instanced ink
 * line. The whole figure turns see-through (transparent toon) while it would
 * hide a player or a telegraph and as it dissolves at the seal. The boss only
 * appears mid-mission, so these compile during the countdown of every
 * campaign match.
 */
export function createBossWarmupMaterials(): THREE.Material[] {
  return [
    instancedWarmup(new THREE.MeshToonMaterial({ gradientMap: FIGHTER_TOON_RAMP })),
    instancedWarmup(new THREE.MeshToonMaterial({
      gradientMap: FIGHTER_TOON_RAMP, transparent: true, depthWrite: false,
    })),
    instancedWarmup(createInkWarmupMaterial()),
  ];
}

/**
 * The village square's request marks (scene/VillageSquare): keepsakes are an
 * instanced token with an instanced ink line. Instancing is its own program,
 * and the keepsakes mount mid-mission as fog lifts, so every campaign match
 * compiles both in the countdown. The square's other pieces use the plain
 * token, ink, sprite and instanced see-through floor-mark programs.
 */
export function createVillageWarmupMaterials(): THREE.Material[] {
  return [
    instancedWarmup(createTokenWarmupMaterial()),
    instancedWarmup(createInkWarmupMaterial()),
  ];
}

/**
 * One material per shader variant that entities mount and unmount mid-match:
 * bombs, pickups, hazards, objective markers, warnings and text labels. three.js deletes
 * a program when the last material using it is disposed, so without a
 * long-lived user every re-entry of such an entity compiled the program again
 * (a campaign marker label scrolling in and out of view recompiled the sprite
 * shader each time). Explosions, tiles, the floor and players stay mounted
 * for the whole match and keep their own programs alive, but a fighter's
 * Ghost look (see-through cast toon) only shows mid-match, so the cast
 * looks, ink line included, are compiled here too.
 */
export function createWarmupMaterials(withBoss = false, withVillage = false): THREE.Material[] {
  const labelMap = new THREE.Texture();
  return [
    ...(withBoss ? createBossWarmupMaterials() : []),
    ...(withVillage ? createVillageWarmupMaterials() : []),
    new THREE.MeshStandardMaterial(),
    // Flat-shaded standard: monster and boss figures and the route puzzle
    // pieces (PuzzleMarkers), which mount as fog of war lifts.
    new THREE.MeshStandardMaterial({ flatShading: true }),
    new THREE.MeshStandardMaterial({ transparent: true }),
    // Transparent double-sided materials draw in two passes (back, then
    // front), and each pass has its own program.
    new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ transparent: true }),
    new THREE.SpriteMaterial({ map: labelMap, transparent: true, depthWrite: false }),
    // Instanced floor marks (hazard telegraph shapes) leave the render list
    // while empty, so their program must not depend on another instanced
    // layer staying up. Compiled on an InstancedMesh: instancing is its own
    // program.
    instancedWarmup(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })),
    // Every cast figure (fighters, enemies, guards, the square's people):
    // solid, and see-through for Ghost and water clones, which only show
    // mid-match; then their shared ink line.
    ...createCastWarmupMaterials(),
    ...createFighterWarmupMaterials(),
    // Pickups, villagers, structures and gates: toon bands with vertex
    // colours (inkedToken.ts). Their ink line is the fighters' ink above.
    createTokenWarmupMaterial(),
  ];
}

/**
 * The shadow pass draws every caster with three's shared depth material and
 * hands it the caster's texture map (WebGLShadowMap), so the cast figures'
 * painted atlas needs a depth program of its own. compileAsync never runs the
 * shadow pass: where no figure starts inside the key light's shadow camera
 * (a city arena has no versus monsters), the first one to walk into it
 * compiled that program mid-round. This caster wears the cast look and is
 * never culled, so the first shadow pass compiles it; it is one degenerate
 * triangle below the board, so it covers no pixel.
 */
function createShadowWarmCaster(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const caster = new THREE.Mesh(geometry, castMaterial());
  caster.castShadow = true;
  caster.frustumCulled = false;
  caster.position.set(0, -1, 0);
  return caster;
}

function warmObject(material: THREE.Material, geometry: THREE.BufferGeometry): THREE.Object3D {
  if (material instanceof THREE.SpriteMaterial) return new THREE.Sprite(material);
  if (material.userData.warmInstanced) return new THREE.InstancedMesh(geometry, material, 1);
  return new THREE.Mesh(geometry, material);
}

function disposeWarmupMaterials(materials: THREE.Material[]) {
  materials.forEach((material) => {
    if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
    material.dispose();
  });
}

/**
 * Compiles every transient material variant against the live scene's lights
 * while the round countdown runs, and keeps those programs referenced until
 * the scene unmounts. Mount it inside the LightPool, next to the scene lights,
 * so the light count it compiles against matches the one used to render.
 */
/* eslint-disable react/require-default-props -- defaulted in the signature */
export function ShaderWarmup({
  withBoss = false,
  withVillage = false,
}: {
  withBoss?: boolean;
  withVillage?: boolean;
}) {
/* eslint-enable react/require-default-props */
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const shadowWarm = useRef<{ caster: THREE.Mesh; drawn: boolean } | null>(null);

  // The cast figures' shadow program (createShadowWarmCaster): the caster
  // leaves the scene once a shadow pass has drawn it, so play never pays for it.
  useEffect(() => {
    const warm = { caster: createShadowWarmCaster(), drawn: false };
    warm.caster.onAfterShadow = () => { warm.drawn = true; };
    shadowWarm.current = warm;
    scene.add(warm.caster);
    return () => {
      warm.caster.removeFromParent();
      warm.caster.geometry.dispose();
      shadowWarm.current = null;
    };
  }, [scene]);
  useFrame(() => {
    const warm = shadowWarm.current;
    if (warm?.drawn && warm.caster.parent) warm.caster.removeFromParent();
  });

  useEffect(() => {
    const materials = createWarmupMaterials(withBoss, withVillage);
    const warmScene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
    materials.forEach((material) => warmScene.add(warmObject(material, geometry)));

    let cancelled = false;
    // Lights come from the target scene; only the warm objects are compiled.
    gl.compileAsync(warmScene, camera, scene).then(() => {
      if (cancelled) return;
      // Fetch link status and uniforms now, during the countdown, so the
      // first entity that uses a program does not stall on it.
      materials.forEach((material) => {
        const program = gl.properties.get(material)?.currentProgram;
        program?.getUniforms();
      });
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      disposeWarmupMaterials(materials);
      geometry.dispose();
    };
  }, [camera, gl, scene, withBoss, withVillage]);

  return null;
}
