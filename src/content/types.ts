export type GameMode = 'solo' | 'local' | 'onlinePreview';

export type CharacterId =
  | 'deidara'
  | 'naruto'
  | 'sasuke'
  | 'gaara'
  | 'minato'
  | 'itachi';

export type BossId =
  | 'shukaku'
  | 'matatabi'
  | 'isobu'
  | 'sonGoku'
  | 'kokuo'
  | 'saiken'
  | 'chomei'
  | 'gyuki'
  | 'kurama';

export type StageId =
  | 'hiddenLeaf'
  | 'hiddenSand'
  | 'hiddenMist'
  | 'hiddenCloud'
  | 'hiddenStone'
  | 'akatsukiHideout'
  | 'greatShinobiWar';

export interface LicensedAssetSlots {
  portrait?: string;
  model?: string;
  icon?: string;
  audio?: string;
}

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  title: string;
  basicBomb: string;
  ultimate: string;
  passive: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  visionRadius: number;
  assetSlots: LicensedAssetSlots;
  implemented: boolean;
}

export interface BossDefinition {
  id: BossId;
  number: number;
  name: string;
  village: string;
  attacks: string[];
  reward: string;
  color: string;
  tails: number;
  assetSlots: LicensedAssetSlots;
  implemented: boolean;
}

export interface StageDefinition {
  id: StageId;
  name: string;
  mapId: string;
  theme: string;
  mechanic: string;
  bossId?: BossId;
  palette: {
    groundA: string;
    groundB: string;
    wall: string;
    crate: string;
    accent: string;
  };
  assetSlots: LicensedAssetSlots;
  implemented: boolean;
}

export interface PowerupDefinition {
  id: string;
  name: string;
  effect: string;
  color: string;
  assetSlots: LicensedAssetSlots;
}
