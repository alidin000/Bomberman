# Character Model Assets

Drop optimized `.glb` character files here to replace the procedural player meshes in the arena.

Recognized player model filenames:

- Deidara: `deidara.glb` when added; otherwise the game uses the procedural fallback.
- Naruto: `naruto_rigged.glb`, then `naruto.glb`, then `naruto_mode_kurama_free_fire.glb`.
- Sasuke: `sasuke_fortnite.glb`, then `sasuke.glb`.
- `gaara.glb`
- Minato: `freefire_new_3d_character_minato_namikaze.glb`, then `minato.glb`.
- Itachi: `itachi_uchiha_sharingan_akatsuki_amaterasu.glb`, then `itachi.glb`.

Recognized boss model filenames:

- Shukaku: `shukaku_naruto.glb`
- Kurama: `kurama__nine-tails.glb`

Guidelines:

- Keep each model under about 20,000 triangles for browser performance.
- Export as `.glb` with textures packed into the file.
- The renderer normalizes mixed source units automatically, but feet-at-origin and positive-Z facing are still best for future exports.
- Aim for a roughly 2-meter-tall source model when exporting your own files.
- Include clips named with words like `Idle`, `Walk`, or `Run` when possible. The renderer blends idle and movement clips automatically.
- If a model file is missing or fails to load, the game keeps using the current procedural character for that slot.
