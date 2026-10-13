// The people of each village hub and their short, branching talk: two of the
// anime's characters per village (animeCast.ts SQUARE_CAST) and Jiraiya on
// the road (WANDERER_CAST). The words are this game's own, written in
// character. Their hints at the three secrets are worked out from the map
// layout (villageSecrets.ts), so they stay true if a map is remapped. The
// invented villagers of earlier versions are the square's extras now.
import { StageId } from './types';
import { CAMPAIGN_VILLAGES, getNextCampaignStageId } from './campaign';
import { CAST } from './animeCast';
import type { SquareCastId } from './animeCast';
import type { ReputationTierId } from './villageSquare';
import { WANDERING_VILLAGER } from './villageSquare';
import { SECRET_SET_REWARD, secretHint } from './villageSecrets';

export interface HubDialogueChoice {
  id: string;
  prompt: string;
  reply: string;
}

export interface HubNpc {
  // An animeCast.ts id (SQUARE_CAST, or Jiraiya the wanderer).
  id: string;
  name: string;
  role: string;
  greeting: string;
  // Said once the village's mission has been cleared.
  clearedGreeting: string;
  choices: HubDialogueChoice[];
}

/** One of the square's extras: they walk about and say one line. */
export interface HubExtra {
  id: string;
  name: string;
  role: string;
  bark: string;
}

export interface HubVillageDefinition {
  stageId: StageId;
  blurb: string;
  // The travelling merchant's word in this village, above the shop.
  merchantLine: string;
  // The two cast members in the square, in SQUARE_CAST order.
  npcs: HubNpc[];
  // The village's extras (render-only walkers in the square).
  extras: HubExtra[];
}

export const HUB_MERCHANT = {
  name: 'Pell',
  role: 'Merchant of the Painted Cart',
} as const;

type Lines = Omit<HubNpc, 'id' | 'name' | 'role'>;

function person(id: SquareCastId, lines: Lines): HubNpc {
  return {
    id, name: CAST[id].name, role: CAST[id].role, ...lines,
  };
}

const hint = secretHint;

export const HUB_VILLAGES: HubVillageDefinition[] = [
  {
    stageId: 'hiddenLeaf',
    blurb: 'Lantern smoke drifts between the training logs. The gate is open, and the forest is not quiet.',
    merchantLine: 'First time in the village? Start small. A ward costs less than a bad morning.',
    npcs: [
      person('kakashi', {
        greeting: 'Yo. Sorry I am late, I got lost on the road of life. The forest past the gate is crawling with rogues, so keep your fuse short.',
        clearedGreeting: 'The gate held. That means I can finally get back to my book. Do not tell Lady Tsunade.',
        choices: [
          {
            id: 'hidden',
            prompt: 'Anything hidden nearby?',
            reply: `Look underneath the underneath. Someone sealed a scroll cache ${hint('hiddenLeaf', 'scroll')}.`,
          },
          {
            id: 'threat',
            prompt: 'Who is out there?',
            reply: 'Rogue genin who never finished the Academy, and worse. They hunt in pairs. Do not let them flank you, and never leave a teammate behind.',
          },
          {
            id: 'burrow',
            prompt: 'Anything I should avoid?',
            reply: `Something has been digging ${hint('hiddenLeaf', 'burrow')}. Go in ready for a fight.`,
          },
        ],
      }),
      person('sakura', {
        greeting: 'I set up a field clinic by the gate. Two villagers are still out there, so bring them back in one piece. Shannaro!',
        clearedGreeting: 'Everyone is home and patched up. You can stop flinching. I only punch rogue ninja.',
        choices: [
          {
            id: 'defend',
            prompt: 'How do I hold the Hokage Building?',
            reply: 'Stay close and keep the attackers off its walls. You only have to outlast them for twenty breaths. I will handle the bandages.',
          },
          {
            id: 'hidden',
            prompt: 'Are the Hokage records safe?',
            reply: `Not all of them. Lady Tsunade's archive lost a page, and it turned up ${hint('hiddenLeaf', 'fragment')}.`,
          },
          {
            id: 'boss',
            prompt: 'Any advice for Kurama?',
            reply: 'Do not trade blows with a tailed beast. Bomb, step aside, bomb again. Patience costs less than stitches.',
          },
        ],
      }),
    ],
    extras: [
      {
        id: 'wren', name: 'Wren', role: 'Gatewarden', bark: 'Keep your eyes up past the gate.',
      },
      {
        id: 'hobb', name: 'Old Hobb', role: 'Tea Seller', bark: 'Tea is on. The second cup is yours.',
      },
      {
        id: 'tamsin', name: 'Tamsin', role: 'Road Teller', bark: 'Every road starts at this gate.',
      },
    ],
  },
  {
    stageId: 'hiddenSand',
    blurb: 'Wind scours the sandstone. Every well has a guard, and every guard looks tired.',
    merchantLine: 'Sand gets into everything. Except the prices. Those stay put.',
    npcs: [
      person('temari', {
        greeting: 'You made it through the storm. Good. Shukaku is loose in the dunes and the wells are drying up, so do not slow me down.',
        clearedGreeting: 'The wells run clear and my brothers are safe. Not bad. You can stay for dinner.',
        choices: [
          {
            id: 'storm',
            prompt: 'How do I fight in a sandstorm?',
            reply: 'You will not see far. Keep a wall at your back and make them come to you. Then blow them away.',
          },
          {
            id: 'hidden',
            prompt: 'Seen anything strange?',
            reply: `The wind keeps howling through a hollow ${hint('hiddenSand', 'fragment')}. Someone sealed a room down there long ago.`,
          },
        ],
      }),
      person('chiyo', {
        greeting: 'Hmph. Another young one come to save us. In my day we sealed beasts with a puppet and a stern word.',
        clearedGreeting: 'The raccoon sleeps, and Kankuro remembers his own name. These old bones can rest.',
        choices: [
          {
            id: 'source',
            prompt: 'Where are the puppets coming from?',
            reply: 'Kankuro has shut himself behind the arena seal, and someone is pulling his strings. Break the puppets, not the boy.',
          },
          {
            id: 'hidden',
            prompt: 'Any old hiding places?',
            reply: `I hid armour scrolls ${hint('hiddenSand', 'scroll')} before you were born. And something has been burrowing ${hint('hiddenSand', 'burrow')}.`,
          },
        ],
      }),
    ],
    extras: [
      {
        id: 'saffi', name: 'Saffi', role: 'Well Digger', bark: 'Mind the drifts. The dunes move.',
      },
      {
        id: 'doru', name: 'Doru', role: 'Caravan Scout', bark: 'First caravan in weeks leaves at dawn.',
      },
    ],
  },
  {
    stageId: 'hiddenMist',
    blurb: 'Fog sits on the water like wet paper. Bridges creak somewhere you cannot see.',
    merchantLine: 'Damp crates, dry powder. I check every pouch twice.',
    npcs: [
      person('mei', {
        greeting: 'Welcome to the Mist. Do forgive the fog. Isobu stirred the lake, and now nobody can see the far shore.',
        clearedGreeting: 'The fog is lifting at last. You have my thanks, and perhaps a dinner invitation.',
        choices: [
          {
            id: 'hunter',
            prompt: 'Who guards the inner gate?',
            reply: 'Haku. Quiet, fast, and someone has convinced him his life depends on that gate. Do not chase him. Let him come through your blast.',
          },
          {
            id: 'hidden',
            prompt: 'Does the Mist keep secrets?',
            reply: `Plenty, darling. One of them is a scroll cache ${hint('hiddenMist', 'scroll')}.`,
          },
        ],
      }),
      person('chojuro', {
        greeting: 'Um, hello. Sorry. My nets, I mean the village nets, keep catching strange things. Last week, half a scroll case.',
        clearedGreeting: 'The nets are full of fish again. Real fish. Sorry, I am just very relieved.',
        choices: [
          {
            id: 'hidden',
            prompt: 'Where did the scroll case come from?',
            reply: `There is a wall ${hint('hiddenMist', 'fragment')} that sounds wrong. And scratching ${hint('hiddenMist', 'burrow')} at night. Please be ready when it opens.`,
          },
          {
            id: 'bearings',
            prompt: 'How do I find my way?',
            reply: 'Count the bridges. The defence point marks the centre of the village. Everything else is, um, a guess.',
          },
        ],
      }),
    ],
    extras: [
      {
        id: 'ondine', name: 'Ondine', role: 'Ferry Pilot', bark: 'Listen for the splash before you see them.',
      },
      {
        id: 'kell', name: 'Kell', role: 'Net Mender', bark: 'Real fish today. Real fish!',
      },
    ],
  },
  {
    stageId: 'hiddenCloud',
    blurb: 'Thunder rolls off the cliffs. The towers hum, and your hair stands up as you pass them.',
    merchantLine: 'Storm season means storm prices. Joking. Mostly.',
    npcs: [
      person('karui', {
        greeting: 'Took you long enough! Gyuki is thrashing the cliffs, and the Raikage wants it handled yesterday.',
        clearedGreeting: 'Gyuki is calm and the towers are standing. Fine. You are not useless. Happy now?',
        choices: [
          {
            id: 'lightning',
            prompt: 'How do I read the lightning?',
            reply: 'The ground glows before the strike lands. If it is glowing under you, move. Do not think, move!',
          },
          {
            id: 'hidden',
            prompt: 'Anything hidden around here?',
            reply: `A courier stashed a kunai satchel ${hint('hiddenCloud', 'scroll')} when the storm caught him. Go get it before Omoi worries it to death.`,
          },
        ],
      }),
      person('omoi', {
        greeting: 'What if the lightning hits the towers, and the towers fall on the bridges, and the bridges fall on us? Then there is no village.',
        clearedGreeting: 'Nobody fell off anything. I did not think that was possible. I need to sit down.',
        choices: [
          {
            id: 'guard',
            prompt: 'Any tips for the gate guard?',
            reply: 'Darui is holding the storm gate, and he is acting way too motivated. That is the scary part. Keep moving and let him tire himself out.',
          },
          {
            id: 'hidden',
            prompt: 'What else should I worry about?',
            reply: `Everything. But mostly a sealed room ${hint('hiddenCloud', 'fragment')}, and something digging ${hint('hiddenCloud', 'burrow')}.`,
          },
        ],
      }),
    ],
    extras: [
      {
        id: 'brisa', name: 'Brisa', role: 'Bell Ringer', bark: 'Two bells means lightning. Off the stone!',
      },
      {
        id: 'tobin', name: 'Tobin', role: 'Kite Maker', bark: 'Not a single spark on my kites today.',
      },
    ],
  },
  {
    stageId: 'hiddenStone',
    blurb: 'Boulders lean over every path. Lamplight winks from cave mouths high on the slopes.',
    merchantLine: 'Rock is cheap up here. Fuses are not. Choose well.',
    npcs: [
      person('onoki', {
        greeting: 'Ah, my back! Of all the days for Kokuo to shake the mountain. Well, do not just stand there, youngster.',
        clearedGreeting: 'The mountain is quiet, and my back only hurts a little. You have earned an old man\'s respect.',
        choices: [
          {
            id: 'guard',
            prompt: 'Who holds the quarry seal?',
            reply: 'Akatsuchi. Big lump of a lad, good heart. Someone has been whispering to him in the tunnels. Get past him and the seal opens.',
          },
          {
            id: 'hidden',
            prompt: 'What did the quarry dig up?',
            reply: `Old Tsuchikage records, sealed ${hint('hiddenStone', 'fragment')}. Writing older than me, if you can believe it.`,
          },
        ],
      }),
      person('kurotsuchi', {
        greeting: 'Grandpa, sit down before you break something. I will show our guest around. Watch the slopes, the rocks fall where the ground is marked.',
        clearedGreeting: 'Kokuo is calm and Akatsuchi is sorry. Not bad at all. Grandpa even smiled. Once.',
        choices: [
          {
            id: 'rockslide',
            prompt: 'How do I survive a rockslide?',
            reply: 'You do not stop it. You let it pass. Rocks fall where the ground is marked first, so do not stand there.',
          },
          {
            id: 'hidden',
            prompt: 'Any hidden caches?',
            reply: `Grandpa hid a scroll ${hint('hiddenStone', 'scroll')}, and he thinks I do not know. Also, something nests ${hint('hiddenStone', 'burrow')}.`,
          },
        ],
      }),
    ],
    extras: [
      {
        id: 'marl', name: 'Marl', role: 'Quarry Foreman', bark: 'Back to honest digging. Loud, dusty, honest.',
      },
      {
        id: 'ysolde', name: 'Ysolde', role: 'Lamp Miner', bark: 'Bring light if you go down the shafts.',
      },
    ],
  },
  {
    stageId: 'akatsukiHideout',
    blurb: 'Red lanterns burn without heat. The halls smell of ink and old ash.',
    merchantLine: 'I never ask where my customers come from. Here, I really never ask.',
    npcs: [
      person('yamato', {
        greeting: 'This is the hideout. Stay close, follow orders, and do not make me use my scary face.',
        clearedGreeting: 'The rituals are broken and the hideout is ours. Good work. I can put the scary face away.',
        choices: [
          {
            id: 'cult',
            prompt: 'How do I get past the cultists?',
            reply: 'They guard the rituals, not the halls. Go around, and they will come to you one at a time.',
          },
          {
            id: 'hidden',
            prompt: 'Where do they keep their plans?',
            reply: `Their clay cache is ${hint('akatsukiHideout', 'scroll')}. Their archive is ${hint('akatsukiHideout', 'fragment')}.`,
          },
        ],
      }),
      person('sai', {
        greeting: 'I read that a smile puts allies at ease. Captain Yamato\'s face does the opposite. I am smiling now. Is it working?',
        clearedGreeting: 'Matatabi is free. I believe this is the moment to say "well done". Well done.',
        choices: [
          {
            id: 'scout',
            prompt: 'What did your ink birds see?',
            reply: 'Three rituals, Konan in the inner hall, and a great many White Zetsu. I drew them all, if that helps.',
          },
          {
            id: 'hidden',
            prompt: 'Anything else down here?',
            reply: `A burrow ${hint('akatsukiHideout', 'burrow')}. My birds would not go near it. Birds made of ink are usually braver than that.`,
          },
        ],
      }),
    ],
    extras: [
      {
        id: 'ash', name: 'Ash', role: 'Escaped Scribe', bark: 'I remember every page they made me copy.',
      },
      {
        id: 'quill', name: 'Quill', role: 'Lookout', bark: 'Crows at the east window again.',
      },
    ],
  },
  {
    stageId: 'greatShinobiWar',
    blurb: 'Banners lie torn across the field. Every village fights here, side by side, for once.',
    merchantLine: 'Last stop on the road. Everything I have left, at fair prices.',
    npcs: [
      person('shikamaru', {
        greeting: 'What a drag. Masked clones in waves, and Obito holding the gate at the centre. Fine. Here is the plan.',
        clearedGreeting: 'It is over. Troublesome, all of it, but we pulled it off. I am going to watch clouds for a week.',
        choices: [
          {
            id: 'orders',
            prompt: 'What are the orders?',
            reply: 'Hold the command post until the seal completes. Then everyone pushes for the gate at once. Two hundred moves ahead, and every one ends with Kurama.',
          },
          {
            id: 'hidden',
            prompt: 'Any intelligence on the field?',
            reply: `Our scouts left a strategy scroll ${hint('greatShinobiWar', 'scroll')}. And something is digging in ${hint('greatShinobiWar', 'burrow')}.`,
          },
        ],
      }),
      person('tsunade', {
        greeting: 'I patch them up and send them back. Try not to be one of them. I have put my money on you, and for once I intend to win.',
        clearedGreeting: 'Every village is still standing. I won a bet. Somebody write that down.',
        choices: [
          {
            id: 'supplies',
            prompt: 'Any supplies to spare?',
            reply: 'A Second Wind Knot from the merchant has saved more of my patients than I have. Pack one if you can.',
          },
          {
            id: 'hidden',
            prompt: 'Anything lost on the field?',
            reply: `The war archive dropped a fragment ${hint('greatShinobiWar', 'fragment')}. Bring it back and it is yours.`,
          },
        ],
      }),
    ],
    extras: [
      {
        id: 'vey', name: 'Vey', role: 'Field Medic', bark: 'Try not to be my next patient.',
      },
      {
        id: 'nim', name: 'Nim', role: 'Banner Runner', bark: 'The orders today: hold.',
      },
    ],
  },
];

export function getHubVillage(stageId: StageId): HubVillageDefinition {
  return HUB_VILLAGES.find((village) => village.stageId === stageId) ?? HUB_VILLAGES[0];
}

// What each villager says once the story has moved past their village: the
// next village's mission is cleared too. The last village has no next one.
export const ONWARD_GREETINGS: Readonly<Partial<Record<SquareCastId, string>>> = {
  kakashi: 'Word from the Sand: the wells run clear again. You have been busy. I have been reading.',
  sakura: 'Temari sent a hawk to say thanks. Gaara even signed it. That never happens.',
  temari: 'The Mizukage sent a lantern across the desert to thank you. It is on my desk now.',
  chiyo: 'The mist road is open. Even an old woman can hear the caravans again.',
  mei: 'A kite from the Cloud cliffs landed on my balcony. A thank-you, I think. How sweet.',
  chojuro: 'Fishermen from the cliffs came down to trade. Um, that has not happened in years.',
  karui: 'Quarry dust on the wind, but no rockslides. The Stone sleeps easy. Thanks to you. Whatever.',
  omoi: 'The Stone is safe. So now I only worry about the hideout. Small mercies.',
  onoki: 'The red lanterns are out. I heard the quiet from here, and my back felt it too.',
  kurotsuchi: 'The hideout fell. Grandpa pretends he is not impressed. He is.',
  yamato: 'The war camp asked for our maps of the hideout. The old ink is finally useful.',
  sai: 'My ink birds flew to the battlefield and came back smiling. I drew them that way.',
};

/**
 * What a villager opens with: the onward line once the next village is
 * cleared, the cleared line once this one is, else the first greeting.
 */
export function villagerGreeting(
  npc: HubNpc,
  stageId: StageId,
  completedStages: readonly StageId[]
): string {
  const next = getNextCampaignStageId(stageId);
  const onward = ONWARD_GREETINGS[npc.id as SquareCastId];
  if (onward && next && completedStages.includes(next)) return onward;
  return completedStages.includes(stageId) ? npc.clearedGreeting : npc.greeting;
}

// Jiraiya the Toad Sage (WANDERING_VILLAGER) walks between the villages,
// researching his next book, and joins every square once standing reaches
// Known. His news follows the story, and he is the one who explains standing
// and the secrets.
export const ROAD_TELLER: HubNpc = {
  id: WANDERING_VILLAGER.id,
  name: WANDERING_VILLAGER.name,
  role: WANDERING_VILLAGER.role,
  greeting: 'Hold it right there! The gallant Jiraiya, Toad Sage of Mount Myoboku, has arrived. I am collecting stories for my next book. Got any?',
  clearedGreeting: 'Another village sleeping soundly. That is a fine chapter. Maybe two.',
  choices: [
    {
      id: 'standing',
      prompt: 'What is standing?',
      reply: 'Every village you help adds to how far your name carries. The further it carries, the more each square opens up to you. Trust me, I know a thing or two about fame.',
    },
    {
      id: 'secrets',
      prompt: 'What is the shrine for?',
      reply: `It keeps count of the village's three secrets. Find all three, then claim the set in the hub: ${SECRET_SET_REWARD.embers} Embers and a scarf in the village's colours. Every good story has a hidden chapter.`,
    },
  ],
};

// Jiraiya's road news, by how many villages are cleared (0 to 7).
export const ROAD_NEWS: readonly string[] = [
  'Nothing yet but rumours. The Leaf gate is where every good story starts.',
  'The Leaf is safe, and the desert road is open. The Sand wells need you next.',
  'Two villages cleared. The fog on the water is thickest just past the dunes.',
  'Three down. The Cloud bells have not rung for joy in a long time.',
  'Four villages. The Stone folk say the mountain itself is angry.',
  'Five. Everyone whispers about the hideout now, and nobody whispers loudly.',
  'Six. Every village is marching to the same field. So should you.',
  'All seven are safe. I will be writing this one for the rest of my life.',
];

export function roadNews(completedStages: readonly StageId[]): string {
  const cleared = CAMPAIGN_VILLAGES
    .filter((village) => completedStages.includes(village.stageId)).length;
  return ROAD_NEWS[Math.min(cleared, ROAD_NEWS.length - 1)];
}

/** The person a square's villager prop is: one of the village's two, or Jiraiya. */
export function getSquareVillager(stageId: StageId, villagerId: string | undefined): HubNpc | null {
  if (villagerId === ROAD_TELLER.id) return ROAD_TELLER;
  return getHubVillage(stageId).npcs.find((npc) => npc.id === villagerId) ?? null;
}

// What each standing tier brings to every village square.
export const STANDING_TIER_PERKS: Readonly<Record<ReputationTierId, string>> = {
  stranger: 'Two villagers, the first request on the board, and Pell\'s stall at full price.',
  known: `${WANDERING_VILLAGER.name}, ${WANDERING_VILLAGER.role}, joins every square, and the board offers a second request.`,
  trusted: 'Pell takes a fifth off the stall, and the board offers its hardest request.',
  honored: 'The ember-thread scarf: pick it in the hub and your shinobi wears it in every mission.',
};

// One line on what the Secrets are, for the hub and the square's shrine.
export const SECRETS_EXPLAINER = `Each village hides three secret rooms. Find all three for ${SECRET_SET_REWARD.embers} Embers and the village's scarf.`;
