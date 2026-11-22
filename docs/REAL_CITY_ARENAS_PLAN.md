# Ten OSM-Inspired City Arenas for Bomberman

## Summary

Add ten compact, curated city arenas to Bomberman. Each arena uses the existing **35×35 gameplay grid** for movement, bombs, collision, and match simulation, plus a matching static 3D environment. OpenStreetMap (OSM) data supplies the real street layout, building footprints, water, and parks; the game grid remains authoritative for all gameplay.

The first city pack contains **Budapest, Berlin, New York, London, Paris, Rome, Tokyo, Barcelona, Istanbul, and Prague**. All ten are intended for local and online Arena matches. Build Budapest first as an internal vertical slice, prove the complete pipeline, then use it to produce and curate the other nine.

The core product idea is not simply ten city-themed skins: **real-world geography should create recognizable, tactically interesting Bomberman arenas**. The content pipeline must therefore optimize both geographic character and gameplay quality.

### Release boundaries

- City arenas are a separate Arena content family. Existing village arenas and all campaign content remain available and unchanged.
- The first city release is **player-versus-player focused**. Do not add neutral city NPCs or map-specific enemy waves to the initial city pack. Existing human/CPU player slots remain supported.
- Buildings, bridges, roads, and water are static environment features and/or ordinary grid obstacles in the first release. No new destructible-building or bridge simulation is required.
- City-specific dynamic events (for example, Budapest tram hazards) are a post-release feature, not a dependency for shipping the ten static maps.
- No live map-data requests, full-city exploration, or arbitrary user-generated cities at runtime.

## Product and gameplay vision

A player should recognize the city from its landmark and street layout, while still getting a fair, readable Bomberman match. Each map should have its own tactical character without introducing city-specific rules that make the core game inconsistent.

The first release should answer three questions:
1. Can the player recognize the place from the landmark, streets, and surrounding architecture?
2. Does the generated grid produce fair, connected, varied Bomberman routes?
3. Does the scene remain readable and performant on supported desktop and mobile devices?

## City set

Create one curated landmark-centered arena per city:

| City | Signature area |
|---|---|
| Budapest | Chain Bridge and the Danube |
| Berlin | Brandenburg Gate and Pariser Platz |
| New York | Times Square |
| London | Tower Bridge and the Thames |
| Paris | Arc de Triomphe and Place Charles de Gaulle |
| Rome | Colosseum |
| Tokyo | Shibuya Crossing |
| Barcelona | Sagrada Família and the Eixample blocks |
| Istanbul | Galata Bridge and the Golden Horn waterfront |
| Prague | Charles Bridge and its Old Town bridgehead |

Each city receives one compact arena, not a complete city or multiple neighborhoods. Choose the geographic crop and scale to preserve the signature landmark and a useful surrounding street pattern inside the existing 35×35 board.

## Architecture

### 1. Separate arena identity from campaign identity

Introduce a typed ArenaMapId and a shared arena catalog for all Arena maps, including existing non-city maps and the ten city maps.

The catalog should own, at minimum:
- Stable map ID and display name.
- Map family/category (classic, village, city).
- Gameplay grid asset/reference.
- Optional static scene asset.
- Selection preview.
- Palette/theme and spawn profile.
- Source and attribution metadata where applicable.
- Asset/content version.

Keep campaign stageId separate. A city is not a campaign stage and must not be forced through the seven-village stage-look fallback.

Use one canonical arena map identity across local setup, GameConfig, lobby state, server room state, and rendering. Avoid allowing selectedMap and arenaMapId to disagree. If the existing selectedMap field must remain temporarily for engine compatibility, define one explicit migration/adapter boundary and test it; do not let two independently editable IDs become competing sources of truth.

Update the renderer to resolve Arena environment appearance from the arena catalog when the match is an Arena match. Preserve existing campaign stage rendering for campaign missions. A missing city scene must fall back to a safe existing arena appearance without changing the selected gameplay grid.

### 2. City Arena Lab: offline authoring pipeline

Build a small offline tool that converts a bounded OSM extract into coordinated game assets. It is an authoring tool, not a runtime service.

Recommended pipeline:

1. **Acquire and record source data.** Download a small extract for the selected landmark area. Record source URL/provider, extraction date, bounds, relevant OSM attribution, and processing version.
2. **Project and normalize.** Convert geographic coordinates into a local metric coordinate system, simplify geometries, normalize feature tags, and retain a reproducible transform from source coordinates to board coordinates.
3. **Generate candidate crops.** Produce several landmark-centered crop/scale candidates rather than assuming the first geographic square will make a good arena.
4. **Rasterize the grid.** Convert roads and plazas to playable floor; buildings and water to hard obstacles; retain the existing board boundary and spawn conventions. Place destructible boxes using a deterministic, curated gameplay pass rather than treating every building footprint as a crate.
5. **Generate the environment.** Build simplified static building geometry, water, parks, roads, and the custom landmark from the same transform used for the grid.
6. **Apply deterministic corrections.** Store map-specific authored corrections as data, not hidden one-off changes in converter code. Repeated builds from the same source, tool version, and corrections must produce the same gameplay grid.
7. **Validate and rank.** Run gameplay metrics and generate a visual overlay/report for each candidate. Let the author select and curate the best candidate.
8. **Package outputs.** Emit all map assets, metadata, and QA results together.

The authoring tool should provide a visual grid overlay on the geographic extract and a preview of the generated 3D scene. It should make it easy to inspect building/water masks, playable corridors, spawn areas, and landmark placement before accepting a map.

### 3. Gameplay validation and map quality report

Every generated candidate must produce a machine-readable QA report and a human-readable visual review.

Measure at least:
- Walkable/playable cell count and playable-area ratio.
- Reachability between spawn regions and overall connected components.
- Spawn safety and clear opening space.
- Corridor width and dead-end frequency.
- Chokepoints and alternative route diversity.
- Hard-obstacle and destructible-box density.
- Distribution of cover, open space, and tactical routes.
- Landmark visibility and obstruction of active play.
- Alignment between grid obstacles and 3D environment geometry.
- Board bounds and edge integrity.

Reject candidates that trap spawns, split the arena into unintended disconnected regions, create unreasonably narrow corridors, or obscure the landmark/player view. Thresholds should be calibrated on Budapest and then frozen as shared defaults, with documented per-map overrides only where geography genuinely requires them.

Use existing engine spawn checks as an additional safety net, not as a substitute for converter-level validation.

### 4. 3D scene layers and rendering

Keep the gameplay grid and visual environment separate, but derive both from the same geographic transform.

Use three conceptual layers:

- **City environment:** static buildings, landmark, skyline, bridge structures, riverbanks, parks, and distant scenery.
- **Gameplay grid:** the authoritative floor, walls, crates, collision, and all cell-based game objects.
- **Decorative details:** road markings, crosswalks, tram rails, pavements, street lights, and other non-colliding details.

Avoid rendering a full building mesh on top of a gameplay wall cell if the wall is already represented by the city environment. Define which layer owns each visual surface so the scene does not contain duplicated or z-fighting geometry.

Reuse the existing scene coordinate conversion (toWorld) for grid-to-world placement. Do not introduce a second independent coordinate convention for city assets.

Generate varied extruded buildings from OSM footprints. Use recorded height/level data when available and deterministic neighborhood-based estimates when absent. Build one original, stylized landmark per city in the project's existing low-poly style; do not copy unlicensed third-party models or assets.

Keep geometry static and optimized:
- Merge repeated geometry and use instancing where appropriate.
- Load only the selected city's scene.
- Keep optional scenery compatible with existing graphics preferences.
- Respect reduced-motion and high-contrast modes.
- Provide a lightweight fallback if a scene asset is unavailable.
- Compare each city against the existing arena performance budget on desktop and mobile.

### 5. Asset package

Each city should be packaged as a self-contained, versioned asset set:

| Output | Purpose |
|---|---|
| grid asset | Authoritative 35×35 gameplay cells |
| scene asset | Optimized static 3D city environment |
| preview image | Arena selection card |
| manifest | Stable ID, city/area, transform, bounds, source/date, attribution, versions, asset references |
| QA report | Gameplay metrics, validation results, warnings, and reviewed overrides |

The manifest should make it possible to identify exactly which source extract, converter version, corrections, and asset versions produced a map.

## Game and online integration

### Local Arena

- Add city cards to the existing Arena map picker, showing city/area name and preview.
- Keep existing non-city Arena choices available.
- Resolve local grid and scene assets through the shared arena catalog.
- Use the same loading and validation path for classic and city Arena maps where practical.
- Keep campaign selection and campaign map loading unchanged.

### Online Arena

- Add the canonical arena map ID to room creation, room state, lobby broadcasts, and match configuration.
- Validate the requested ID against the server-side catalog. Never accept a client-supplied arbitrary asset path or grid.
- The server loads and supplies the authoritative gameplay grid. Clients load the matching visual scene using the validated map ID.
- Update strict client/server message validation and protocol tests. Increment the online protocol version for the changed room/config contract and deploy compatible client and server changes together.
- If the simulation or deterministic gameplay rules change, review whether the simulation version must also change; a content-only scene change should not be treated as a simulation change.
- Test reconnect and resume flows to ensure the selected map identity remains stable.
- Unknown map IDs must be rejected cleanly. A missing client scene must not prevent joining if the authoritative grid is valid; use the visual fallback.

## City Pulse: post-release gameplay extension

After the static ten-city pack is stable, introduce a reusable, data-driven City Event system. The idea is that the city can periodically create a readable tactical threat, making each location feel distinct without building ten unrelated gameplay systems.

Potential future examples:
- Budapest: a tram hazard travels along marked tracks after a warning.
- Tokyo: timed crossing signals activate dangerous lanes.
- New York: marked subway vents release temporary steam.
- London: a bridge section temporarily changes route availability.

Do not implement these as part of the initial city-map release. First design one generic event definition and deterministic simulation flow, then prototype Budapest Tram Rush.

Any future event must:
- Be driven by the authoritative simulation, not client-side randomness.
- Be deterministic for all online clients using the match seed/state.
- Telegraph its affected cells and timing before activation.
- Respect spawn protection and provide a viable escape route.
- Reuse or extend the existing hazard/telegraph infrastructure where appropriate.
- Be covered by reducer, replay, and multiplayer determinism tests.
- Have an explicit balance and accessibility review.

Destructible bridges/buildings are a separate, later feature. They require explicit simulation, collision, replay, and network rules; they must not be smuggled into the static scenery implementation.

## OSM data, licensing, and references

Use OSM data extracts for the selected areas and retain source and processing records. Do not use Google Maps geometry or bulk-download rendered OSM tiles.

Provide readable OpenStreetMap contributor credit in the game and detailed license information in the credits/documentation. Include a project notice describing the source data, extraction date, processing pipeline, and applicable ODbL terms.

Do not assume every generated output has the same licensing classification. Review whether each distributed grid, scene, or other transformed output is a derivative database or a Produced Work under the applicable ODbL guidance. Retain the source extract and transformation records needed to meet the project's obligations, and obtain a licensing review before public distribution.

References:
- OpenStreetMap copyright and attribution: https://www.openstreetmap.org/copyright
- OSM Foundation attribution guidelines: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- OSM Foundation Produced Work guidance: https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline
- PAC-MAPS: https://github.com/ProfRino/pac-maps
- 3DA: https://github.com/Hennes617/3dcity-games
- Luxembourg Three.js city project: https://github.com/donmutti/city

Reuse decisions:
- Use PAC-MAPS as a reference for turning street layouts into playable routes. It is a 2D road-graph game, so its movement and map format do not fit Bomberman's square grid.
- Use 3DA as a reference for building-footprint extrusion and missing-height estimates. Implement a small offline pipeline suited to Bomberman rather than adopting its live tile-loading architecture or its newer Three.js renderer wholesale. Verify the repository's license before reusing any code.
- Use the Luxembourg Three.js city project only as visual/architectural inspiration unless a clear applicable code and asset license is established. Do not copy its code or assets without permission.

## Delivery sequence

1. **Architecture and catalog.** Define the typed arena identity, shared catalog, asset manifest, loading boundary, and campaign/Arena separation. Add tests proving campaign stage rendering remains unchanged.
2. **City Arena Lab prototype.** Build the offline OSM ingest, projection, candidate crop generation, grid rasterizer, deterministic corrections, scene generation, and QA report. Keep the first tool narrowly scoped to the ten approved cities.
3. **Budapest vertical slice.** Generate the grid, scene, preview, manifest, and QA report together. Review the geographic crop and playable layout. Integrate it into local Arena and verify rendering, collision alignment, spawn safety, and performance.
4. **Tune and freeze the pipeline.** Use Budapest to calibrate gameplay thresholds, visual layering, building simplification, and performance. Freeze shared defaults before producing the remaining maps.
5. **Produce the other nine cities.** Generate, curate, and review each city. Use different geographic characteristics to test the pipeline (riverfront, dense blocks, large plaza, landmark complex), not just nine similar street layouts.
6. **Online integration.** Add room/lobby selection, server catalog validation, authoritative grid loading, protocol updates, reconnect coverage, and scene fallback. Test with multiple clients.
7. **Release verification.** Run the complete acceptance suite for all ten maps and publish OSM attribution/licensing information with the city pack.
8. **Post-release City Pulse prototype.** Design the shared deterministic event model and prototype Budapest Tram Rush only after the static city release is stable.

## Tests and acceptance

### Converter and content
- Every city produces a valid 35×35 grid, scene asset, preview, manifest, and QA report.
- Repeated builds from identical source data, converter version, and corrections produce identical gameplay grids and stable manifests where timestamps are excluded or normalized.
- Every manifest records map ID, area, geographic bounds/transform, source/date, attribution, converter version, and asset versions.
- The QA report catches invalid dimensions, out-of-bounds cells, disconnected playable regions, unsafe spawns, excessive dead ends/chokepoints, and invalid obstacle density.

### Gameplay
- Every map passes existing game spawn checks and the new converter-level spawn-safety checks.
- Playable routes are connected according to the approved map rules; any intentional separation is explicitly documented and tested.
- Each map retains familiar destructible-box gameplay, clear spawn areas, readable routes, and balanced cover/open-space distribution.
- City maps do not accidentally spawn neutral monsters in the initial PvP-focused release.
- No city landmark or decorative geometry blocks active play or creates misleading collision expectations.

### Rendering and performance
- Grid and scene use the same coordinate transform; automated checks and visual overlays confirm that walls, water, roads, and building footprints align.
- City scenes do not duplicate gameplay wall geometry or produce visible z-fighting.
- Test scenery enabled/disabled, high contrast, reduced motion, and supported viewport sizes.
- Simulate a scene-load failure and confirm the match remains playable with the visual fallback and unchanged authoritative grid.
- Use the existing performance probe to compare each city arena against the classic arena on supported devices. Load only the selected scene, merge repeated geometry, and remain within the project's existing arena performance budget.

### Local and online
- Local matches load each city's grid and corresponding scene.
- Online rooms broadcast the same validated arena map ID to every participant.
- The server rejects unknown IDs and supplies the same authoritative grid to all clients.
- Reconnect/resume preserves the selected map and match state.
- Protocol tests cover valid and invalid city selection, unknown IDs, and compatibility/version rejection.
- Multiple clients observe identical simulation state; scene loading remains presentation-only.

### Licensing and release
- Every map package contains source and attribution metadata.
- Game credits expose readable OSM contributor credit and ODbL information.
- The distribution/licensing treatment of each derived output is reviewed before public release.
- All ten previews and in-game scenes are reviewed for landmark recognition, distinct city character, and unobstructed play.

## Assumptions and defaults

- The ten-city list above is the approved first release set; Berlin represents Germany.
- Each city gets one compact landmark-centered Arena, not a full city or multiple neighborhoods.
- City maps are available in local and online Arena modes; campaign content is unchanged.
- The first city pack is PvP-focused and does not add neutral NPCs or map-specific enemy waves.
- OSM-derived layouts guide the arena, while deterministic curated corrections protect Bomberman playability.
- The 35×35 grid remains authoritative for movement, bombs, collision, and simulation.
- City buildings, bridges, and water are static scenery and/or ordinary obstacle cells in the first release.
- City Pulse events, destructible bridges/buildings, traffic simulation, interiors, and arbitrary-city generation are explicitly deferred.
