export type GenericPower =
  | 'AddBomb'
  | 'BlastRangeUp'
  | 'Detonator'
  | 'RollerSkate'
  | 'Invincibility'
  | 'Ghost'
  | 'Obstacle';

export type SignaturePower =
  | 'ClaySpider'
  | 'Rasengan'
  | 'Sharingan'
  | 'FTGKunai'
  | 'CrowFeather'
  | 'SandArmor'
  | 'ChakraScroll'
  | 'CharacterFragment';

export type Power = GenericPower | SignaturePower;

export type BaseContent = 'Empty' | 'Box' | 'Wall';

export interface Obstacle {
  ownerId: string;
  coords: { x: number; y: number };
}

export interface Bomb {
  range: number;
  coords: { x: number; y: number };
  ownerId?: string; // if a player with Detonator power places the bomb, this stores the player's id
}

export type gameItem = BaseContent | Power | Obstacle | Bomb;

export type Explosion = 'Explosion'; // explosion type

export type GameMap = gameItem[][];

export const genericPowerUpOptions: GenericPower[] = [
  'AddBomb',
  'BlastRangeUp',
  'Detonator',
  'RollerSkate',
  'Invincibility',
  'Ghost',
  'Obstacle',
];

export const powerUpOptions: Power[] = [
  ...genericPowerUpOptions,
  'ClaySpider',
  'Rasengan',
  'Sharingan',
  'FTGKunai',
  'CrowFeather',
  'SandArmor',
  'ChakraScroll',
  'CharacterFragment',
];

export function randomPowerUpGenerator(): GenericPower {
  return genericPowerUpOptions[Math.floor(Math.random() * genericPowerUpOptions.length)];
}

export const isPower = (cell: gameItem): cell is Power => powerUpOptions.includes(cell as Power);

export function isBomb(item: gameItem): item is Bomb {
  return typeof item === 'object' && 'range' in item && 'coords' in item;
}

export function isObstacle(item: gameItem): item is Obstacle {
  return typeof item === 'object'
    && 'ownerId' in item
    && 'coords' in item
    && !('range' in item);
}
