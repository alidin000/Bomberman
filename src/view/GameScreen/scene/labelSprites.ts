import * as THREE from 'three';

/**
 * Reference-counted values with a bounded pool of idle (unused) entries.
 * An entry whose last user releases it stays cached until more than
 * `maxIdle` entries are idle; then the least recently released is disposed.
 */
export type RefCache<T> = {
  /** Returns the cached value, creating it (idle, unretained) if needed. */
  get: (key: string) => T;
  /**
   * Marks one user of `value`, re-adopting it if it was evicted between
   * `get` and `retain`. A value that was replaced in the meantime is not
   * tracked; its user keeps an evicted (disposed, still renderable) value.
   */
  retain: (key: string, value: T) => void;
  release: (key: string, value: T) => void;
  /** Disposes every entry that has no users. */
  disposeIdle: () => void;
  size: () => number;
};

export function createRefCache<T>(
  create: (key: string) => T,
  dispose: (value: T) => void,
  maxIdle: number
): RefCache<T> {
  const entries = new Map<string, { value: T; users: number }>();
  // Insertion order is release order, so the first key is the oldest idle one.
  const idle = new Set<string>();

  const evictIdle = (limit: number) => {
    while (idle.size > limit) {
      const oldest = idle.values().next().value as string;
      idle.delete(oldest);
      const entry = entries.get(oldest);
      entries.delete(oldest);
      if (entry) dispose(entry.value);
    }
  };

  return {
    get: (key) => {
      const existing = entries.get(key);
      if (existing) return existing.value;
      const value = create(key);
      // Make room first so the entry the caller is about to use survives.
      evictIdle(Math.max(0, maxIdle - 1));
      entries.set(key, { value, users: 0 });
      idle.add(key);
      return value;
    },
    retain: (key, value) => {
      const entry = entries.get(key);
      if (!entry) {
        entries.set(key, { value, users: 1 });
      } else if (entry.value === value) {
        entry.users += 1;
      } else {
        return;
      }
      idle.delete(key);
    },
    release: (key, value) => {
      const entry = entries.get(key);
      if (!entry || entry.value !== value || entry.users === 0) return;
      entry.users -= 1;
      if (entry.users > 0) return;
      idle.delete(key);
      idle.add(key);
      evictIdle(maxIdle);
    },
    disposeIdle: () => evictIdle(0),
    size: () => entries.size,
  };
}

export type LabelSprite = {
  texture: THREE.CanvasTexture;
  material: THREE.SpriteMaterial;
};

export function labelSpriteKey(text: string, color: string): string {
  return `${color}\n${text}`;
}

function drawLabelSprite(key: string): LabelSprite {
  const separator = key.indexOf('\n');
  const color = key.slice(0, separator);
  const text = key.slice(separator + 1);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '700 42px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0, 0, 0, 0.85)';
    context.shadowBlur = 10;
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2, 460);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  return { texture, material };
}

function disposeLabelSprite(sprite: LabelSprite) {
  sprite.material.dispose();
  sprite.texture.dispose();
}

/**
 * Name plates and warning labels share one canvas texture and material per
 * text and colour, so a label that leaves and re-enters view (fog of war,
 * repeated ability warnings) skips the canvas draw and the texture upload.
 */
export const LABEL_SPRITES = createRefCache(drawLabelSprite, disposeLabelSprite, 32);
