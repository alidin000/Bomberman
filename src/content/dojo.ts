// The Inkstone Dojo: four short handcrafted rooms that teach the core loop
// by doing it. This is the catalog the menus need (names, order, where a
// room plays); the rooms themselves (maps, goals, the instructors' words)
// are in dojoRooms.ts, which only the match chunk loads. Every name here is
// original to this game.

export type DojoRoomId = 'lanternWalk' | 'fuseStep' | 'pillarShade' | 'scrollSentry';

export const DOJO_NAME = 'Inkstone Dojo';

/** The dojo's room list; each room plays at `/dojo/<room id>`. */
export const DOJO_PATH = '/dojo';

export interface DojoRoomInfo {
  id: DojoRoomId;
  order: number;
  name: string;
  /** What the room teaches, in two or three words. */
  skill: string;
  instructor: string;
}

export const DOJO_ROOMS: readonly DojoRoomInfo[] = [
  {
    id: 'lanternWalk', order: 1, name: 'Lantern Walk', skill: 'Moving', instructor: 'Old Willow',
  },
  {
    id: 'fuseStep', order: 2, name: 'Fuse Step', skill: 'Bombs', instructor: 'Ember',
  },
  {
    id: 'pillarShade', order: 3, name: 'Pillar Shade', skill: 'Reading blasts', instructor: 'Slate',
  },
  {
    id: 'scrollSentry',
    order: 4,
    name: 'Scroll and Sentry',
    skill: 'Power-ups and enemies',
    instructor: 'Thistle',
  },
];

export function dojoRoomPath(room: { id: DojoRoomId }): string {
  return `${DOJO_PATH}/${room.id}`;
}

export function isDojoRoomId(value: unknown): value is DojoRoomId {
  return typeof value === 'string' && DOJO_ROOMS.some((room) => room.id === value);
}

export function getDojoRoomInfo(id: DojoRoomId): DojoRoomInfo {
  return DOJO_ROOMS.find((room) => room.id === id) ?? DOJO_ROOMS[0];
}
