# Music

The game plays music in every match. By default it is generated in the
browser (`src/audio/music/`): an original theme per map, with no recordings.
You can replace it with recorded tracks of your own.

## Adding your own tracks

1. Put the audio files in `public/music/`. MP3 plays in every browser; OGG and
   Opus do not play in older Safari. Keep each file a clean loop (it repeats
   from the start) and about 1–4 MB.
2. List them in `public/music/tracks.json`, by map:

   ```json
   {
     "default": "battle.mp3",
     "hiddenLeaf": "leaf-village.mp3",
     "akatsukiHideout": "akatsuki.mp3",
     "rome": "rome.mp3"
   }
   ```

   The keys are the map ids: `hiddenLeaf`, `hiddenSand`, `hiddenMist`,
   `hiddenCloud`, `hiddenStone`, `akatsukiHideout`, `greatShinobiWar`, `rome`,
   `barcelona` and `budapest`. `default` plays on every map without its own
   track. A map with no track and no default keeps its generated theme. A value
   is a file name in `public/music/`, or an `https://` address on a host that
   allows cross-origin requests (otherwise the browser plays it silent).
3. Commit and push. Render serves `public/` as it is, so the tracks go live
   with the next deploy. Locally, `npm run build` then `npm run preview`.

In a match the track loops, follows the Music volume in Settings, dips under
blasts, plays 6% faster in sudden death and pauses with the game. If a file is
missing or will not play, the map's generated theme plays instead.

## Rights

The repository and the site are public: anything in `public/music/` can be
downloaded by anyone. Only add music you have the rights to publish, and add
its credit and licence to the Credits in `README.md`.
