export const TILE_SIZE = 1;
export const MAP_OFFSET_X = -7;
export const MAP_OFFSET_Z = -4.5;

export function toWorld(x: number, y: number): [number, number, number] {
  return [(x + MAP_OFFSET_X) * TILE_SIZE, 0, (y + MAP_OFFSET_Z) * TILE_SIZE];
}
