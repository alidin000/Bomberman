import { CharacterDefinition, CharacterId } from './types';

export const CHARACTER_DEFINITIONS: CharacterDefinition[] = [
  {
    id: 'deidara',
    name: 'Deidara',
    title: 'Clay Art Shinobi',
    basicBomb: 'Clay Spider Bomb',
    ultimate: 'C3 Giant Bomb',
    passive: 'Art is an Explosion',
    description: 'Area bomber. Clay spiders fuse fast, pure clay blasts hit wide routes, and C3 is the biggest raw explosion.',
    primaryColor: '#f5efe0',
    secondaryColor: '#d92323',
    assetSlots: {},
    implemented: true,
  },
  {
    id: 'naruto',
    name: 'Naruto',
    title: 'Shadow Clone Shinobi',
    basicBomb: 'Shadow Clone Bomb',
    ultimate: 'Rasenshuriken',
    passive: 'Nine-Tails Chakra',
    description: 'Clone pressure. Shadow clone marks create extra pressure, while Rasengan-style blasts spread blue chakra swirls.',
    primaryColor: '#ff8a00',
    secondaryColor: '#1d4ed8',
    assetSlots: {},
    implemented: true,
  },
  {
    id: 'sasuke',
    name: 'Sasuke',
    title: 'Lightning Rogue',
    basicBomb: 'Chidori Mine',
    ultimate: 'Kirin',
    passive: 'Sharingan',
    description: 'Lightning control. Chidori and Kirin carve electric lanes with black Amaterasu-style burst accents.',
    primaryColor: '#1e293b',
    secondaryColor: '#60a5fa',
    assetSlots: {},
    implemented: true,
  },
  {
    id: 'gaara',
    name: 'Gaara',
    title: 'Sand Guardian',
    basicBomb: 'Sand Coffin Trap',
    ultimate: 'Sand Tsunami',
    passive: 'Automatic Sand Shield',
    description: 'Sand control. Sand Coffin slows enemies, Sand Tsunami locks space, and his shield can save one mistake.',
    primaryColor: '#b45309',
    secondaryColor: '#f59e0b',
    assetSlots: {},
    implemented: true,
  },
  {
    id: 'minato',
    name: 'Minato',
    title: 'Flying Thunder Shinobi',
    basicBomb: 'Flying Thunder Mark',
    ultimate: 'Instant Teleport',
    passive: 'Fastest Movement Speed',
    description: 'Speed and seals. Flying Thunder God marks detonate quickly, then his ultimate blinks through danger.',
    primaryColor: '#facc15',
    secondaryColor: '#2563eb',
    assetSlots: {},
    implemented: true,
  },
  {
    id: 'itachi',
    name: 'Itachi',
    title: 'Genjutsu Operative',
    basicBomb: 'Crow Clone',
    ultimate: 'Tsukuyomi',
    passive: 'Illusion Dodge',
    description: 'Genjutsu traps. Crow clones spread awkward angles, delay enemies, and Tsukuyomi creates a red illusion zone.',
    primaryColor: '#111827',
    secondaryColor: '#dc2626',
    assetSlots: {},
    implemented: true,
  },
];

export const DEFAULT_CHARACTER_ID: CharacterId = 'deidara';

export function getCharacterDefinition(id?: string): CharacterDefinition {
  return CHARACTER_DEFINITIONS.find((character) => character.id === id)
    ?? CHARACTER_DEFINITIONS[0];
}
