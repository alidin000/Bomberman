import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createFighterWarmupMaterials } from './fighterInk';

function instancedWarmup(material: THREE.Material): THREE.Material {
  const target = material;
  target.userData.warmInstanced = true;
  return target;
}

/**
 * One material per shader variant that entities mount and unmount mid-match:
 * bombs, pickups, hazards, markers, warnings and text labels. three.js deletes
 * a program when the last material using it is disposed, so without a
 * long-lived user every re-entry of such an entity compiled the program again
 * (a campaign marker label scrolling in and out of view recompiled the sprite
 * shader each time). Explosions, tiles, the floor and players stay mounted
 * for the whole match and keep their own programs alive, but a fighter's
 * Ghost look (see-through toon) only shows mid-match, so the fighter looks,
 * ink line included, are compiled here too.
 */
export function createWarmupMaterials(): THREE.Material[] {
  const labelMap = new THREE.Texture();
  return [
    new THREE.MeshStandardMaterial(),
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
    ...createFighterWarmupMaterials(),
  ];
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
export function ShaderWarmup() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const materials = createWarmupMaterials();
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
  }, [camera, gl, scene]);

  return null;
}

/**
 * Ghost switches a loaded model's materials between opaque and transparent,
 * which are different shader programs (and every GLB material is its own
 * variant). Compiles both looks of each material when the model mounts and
 * keeps them referenced while it stays mounted, so the first Ghost pickup, or
 * its end, does not compile model shaders mid-match.
 */
export function useTransparencyVariantWarmup(model: THREE.Object3D, enabled: boolean) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (!enabled) return undefined;
    const warmScene = new THREE.Scene();
    const variants: THREE.Material[] = [];
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
        [true, false].forEach((transparent) => {
          const variant = material.clone();
          variant.transparent = transparent;
          variants.push(variant);
          const skinned = mesh as THREE.SkinnedMesh;
          if (skinned.isSkinnedMesh) {
            const proxy = new THREE.SkinnedMesh(skinned.geometry, variant);
            proxy.bind(skinned.skeleton, skinned.bindMatrix);
            warmScene.add(proxy);
          } else {
            warmScene.add(new THREE.Mesh(mesh.geometry, variant));
          }
        });
      });
    });
    gl.compileAsync(warmScene, camera, scene).catch(() => undefined);
    return () => variants.forEach((variant) => variant.dispose());
  }, [camera, enabled, gl, model, scene]);
}
