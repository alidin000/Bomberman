import { CharacterDefinition, CharacterId } from './types';

export const CHARACTER_DEFINITIONS: CharacterDefinition[] = [
  {
    id: 'deidara',
    name: 'Deidara',
    title: 'Clay Art Shinobi',
    basicBomb: 'Clay Spider Bomb',
    ultimate: 'C3 Giant Bomb',
    passive: 'Art is an Explosion',
    description: 'Clay spiders fuse faster and reach farther. C3 creates a huge clay area blast.',
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
    description: 'Drops a shadow clone charge beside the first bomb. Rasenshuriken adds wide diagonal pressure.',
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
    description: 'Fast Chidori mines pierce boxes. Kirin strikes full lightning lines through the arena.',
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
    description: 'Sand Coffin traps beasts instead of simply clearing them. Sand Tsunami locks a wide area.',
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
    description: 'Thunder marks detonate quickly and hit blink points. Ultimate teleports after planting.',
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
    description: 'Crow clones spread diagonally and delay beasts. Tsukuyomi stuns a wide genjutsu zone.',
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
