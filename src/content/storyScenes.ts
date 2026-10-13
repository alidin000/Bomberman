// The story between the hub and the match: a short scene before each
// village's mission and one after its first win, spoken by the anime's
// characters (animeCast.ts) in this game's own words. Each plays once
// (StoryProgress.seenScenes) and can be replayed from the hub.
import type { StageId } from './types';
import type { CastId } from './animeCast';

export type StoryScenePart = 'before' | 'after';

export interface StoryLine {
  speaker: CastId;
  text: string;
}

export interface StoryScene {
  // Stable save id: `${stageId}:${part}`.
  id: string;
  stageId: StageId;
  part: StoryScenePart;
  title: string;
  lines: readonly StoryLine[];
}

type SceneText = { title: string; lines: StoryLine[] };

const line = (speaker: CastId, text: string): StoryLine => ({ speaker, text });

const SCENES: Record<StageId, Record<StoryScenePart, SceneText>> = {
  hiddenLeaf: {
    before: {
      title: 'The Seal Under the Leaf',
      lines: [
        line('kakashi', 'Yo. Bad news first: something cracked the seal under the village, and Kurama\'s chakra is leaking into the forest.'),
        line('sakura', 'Two villagers never came back from the training grounds. I am not leaving them out there.'),
        line('kakashi', 'Iruka is holding the forest gate with an evacuation seal. He will not open it for anyone who cannot get past him.'),
        line('sakura', 'Then we show him. Bring the villagers home, hold the Hokage Building, and get through that gate.'),
        line('kakashi', 'And keep your fuse short. Kurama does not play fair.'),
      ],
    },
    after: {
      title: 'Sand on the Kunai',
      lines: [
        line('sakura', 'Kurama is sealed again, and everyone is home. You were amazing out there!'),
        line('kakashi', 'Not bad. But those rogues carried Sand kunai. Someone wants the villages at each other\'s throats.'),
        line('sakura', 'Then the Sand is next. Temari will want to hear this.'),
      ],
    },
  },
  hiddenSand: {
    before: {
      title: 'Strings in the Storm',
      lines: [
        line('temari', 'You made it through the storm. Good. Shukaku is loose in the dunes, and the wells are drying up.'),
        line('chiyo', 'Hmph. In my day we sealed beasts like that with a puppet and a stern word.'),
        line('temari', 'Kankuro shut himself behind the arena seal with his puppets. Someone is pulling his strings, and it is not him.'),
        line('chiyo', 'Break the puppets, not the boy. Then deal with the raccoon.'),
      ],
    },
    after: {
      title: 'A Hawk to the Mist',
      lines: [
        line('chiyo', 'The raccoon is asleep, and the boy remembers his own name. These old bones can rest.'),
        line('temari', 'Kankuro says the strings came from the Mist. I am sending a hawk to the Mizukage.'),
      ],
    },
  },
  hiddenMist: {
    before: {
      title: 'The Hunter at the Gate',
      lines: [
        line('mei', 'Welcome to the Mist. Forgive the fog. Isobu stirred the lake, and now nobody can see the far shore.'),
        line('chojuro', 'Um, Lady Mizukage, the hunter-nin at the inner gate is not answering our signals. Sorry. It is not your fault.'),
        line('mei', 'Haku guards that gate as if his life depends on it. Someone has convinced him it does.'),
        line('chojuro', 'Please be careful. He is very fast. I would be terrified. I am terrified.'),
        line('mei', 'Clear the clones off the bridges and bring Haku back to his senses. Then the turtle is yours.'),
      ],
    },
    after: {
      title: 'The Masked Promise',
      lines: [
        line('mei', 'The fog is lifting, and Haku is with us again. You have my thanks, and perhaps a dinner invitation.'),
        line('chojuro', 'Haku says a masked man promised him a purpose. He pointed toward the Cloud cliffs.'),
      ],
    },
  },
  hiddenCloud: {
    before: {
      title: 'Storm Over the Cliffs',
      lines: [
        line('karui', 'Took you long enough! Gyuki is thrashing the cliffs, and the Raikage wants it handled yesterday.'),
        line('omoi', 'What if the lightning hits the towers, and the towers fall on the bridges, and the bridges fall on us?'),
        line('karui', 'Nothing is falling, Omoi! Darui is holding the storm gate, but he is acting strange. Way too motivated.'),
        line('omoi', 'That is the scary part. Darui is never motivated.'),
        line('karui', 'Watch the marked ground. If it glows under you, move.'),
      ],
    },
    after: {
      title: 'Orders from the Stone',
      lines: [
        line('omoi', 'Gyuki is calm, the towers are standing, and nobody fell off anything. I did not think that was possible.'),
        line('karui', 'Darui woke up asking for a nap, so he is back to normal. He says his orders came from the Stone.'),
      ],
    },
  },
  hiddenStone: {
    before: {
      title: 'The Mountain Shakes',
      lines: [
        line('onoki', 'Ah, my back! Of all the days for Kokuo to shake the mountain.'),
        line('kurotsuchi', 'Grandpa, sit down before you break something. I will show our guest the way.'),
        line('onoki', 'Akatsuchi is holding the quarry seal shut. Big lump of a lad, good heart. Someone has been whispering to him in the tunnels.'),
        line('kurotsuchi', 'Get past him and the seal opens. And watch for rockslides: the rocks fall where the ground is marked.'),
      ],
    },
    after: {
      title: 'Red Lanterns',
      lines: [
        line('kurotsuchi', 'Kokuo is calm, Akatsuchi is sorry, and Grandpa\'s back only hurts a little. Good work.'),
        line('onoki', 'The tunnels lead to a hideout lit by red lanterns. Akatsuki. I thought we had seen the last of those cloaks.'),
      ],
    },
  },
  akatsukiHideout: {
    before: {
      title: 'Into the Hideout',
      lines: [
        line('yamato', 'This is the hideout. Stay close, and do not make me use my scary face.'),
        line('sai', 'I read that a smile puts allies at ease. Captain Yamato\'s face does the opposite.'),
        line('yamato', 'Konan guards the inner hall with her paper. Matatabi is chained somewhere below.'),
        line('sai', 'My ink birds counted three rituals and a great many White Zetsu. I drew them, if that helps.'),
        line('yamato', 'Break the rituals, get past Konan, and free the cat. Then we leave before the ceiling does.'),
      ],
    },
    after: {
      title: 'A Paper Crane',
      lines: [
        line('sai', 'Matatabi is free and the rituals are broken. I believe this is the moment to say "well done".'),
        line('yamato', 'Konan left us a paper crane. A masked man is gathering every beast at the war front.'),
      ],
    },
  },
  greatShinobiWar: {
    before: {
      title: 'Side by Side',
      lines: [
        line('tsunade', 'Every village is on this field: Leaf, Sand, Mist, Cloud and Stone. For once we fight side by side.'),
        line('shikamaru', 'What a drag. Masked clones in waves, and Obito holding the gate at the centre.'),
        line('shikamaru', 'Here is the plan: hold the command post, break their line, then hit the gate the moment it opens.'),
        line('tsunade', 'And if you fall, get back up. I have put my money on you, and for once I intend to win.'),
        line('jiraiya', 'Kurama waits at the far end. Make it a good ending. I have a book to finish.'),
      ],
    },
    after: {
      title: 'The Last Chapter',
      lines: [
        line('tsunade', 'It is over. Every village is still standing, and I won a bet. Somebody write that down.'),
        line('jiraiya', 'Already on it. The finest tale of the gallant Jiraiya\'s favourite student. Well, one of them.'),
        line('shikamaru', 'Troublesome as it was... good work. Go home and get some sleep. I know I will.'),
      ],
    },
  },
};

// The save's scene key (story/progress.ts sceneKey makes the same ids).
export function storySceneId(stageId: StageId, part: StoryScenePart): string {
  return `${stageId}:${part}`;
}

export function getStoryScene(stageId: StageId, part: StoryScenePart): StoryScene {
  const scene = SCENES[stageId][part];
  return {
    id: storySceneId(stageId, part),
    stageId,
    part,
    title: scene.title,
    lines: scene.lines,
  };
}
