# Ten OSM-Inspired City Arenas for Bomberman

## Summary

Add ten compact, curated city arenas to Bomberman. Each arena uses a **35×35 grid** for movement, bombs, and collisions, plus a matching static 3D scene. The city data supplies the streets, building footprints, water, and parks; the game’s grid remains authoritative for play.

The ten arenas will be **Budapest, Berlin, New York, London, Paris, Rome, Tokyo, Barcelona, Istanbul, and Prague**. They will be selectable in local and online Arena matches. All ten must be ready for the first public city-map release; build and tune Budapest first as an internal prototype, then apply the finished pipeline to the other nine.

The visual target is one custom, recognizable landmark per city, surrounded by varied low-poly buildings. Bridges, buildings, and water stay static in this release. Campaign maps, full-city exploration, and live map-data requests are out of scope.

## Implementation changes

### Map content and conversion

- Create one curated arena around each location:
  - Budapest — Chain Bridge and the Danube
  - Berlin — Brandenburg Gate and Pariser Platz
  - New York — Times Square
  - London — Tower Bridge and the Thames
  - Paris — Arc de Triomphe and Place Charles de Gaulle
  - Rome — the Colosseum
  - Tokyo — Shibuya Crossing
  - Barcelona — Sagrada Família and the Eixample blocks
  - Istanbul — Galata Bridge and the Golden Horn waterfront
  - Prague — Charles Bridge and its Old Town bridgehead
- For each location, select a compact square extract centered on its landmark. Fit it to the existing 35×35 arena while preserving the landmark and the surrounding street pattern.
- Build an **offline** city-map converter. It reads a small OSM data extract, projects coordinates to a local metric space, simplifies shapes, and writes two coordinated outputs: a game grid and a static 3D scene. No map data is fetched while a match is running.
- Rasterize OSM features into the existing arena grid format: roads and plazas become playable floor; building footprints and water become hard walls; existing Bomberman box mechanics are placed in a curated pattern to preserve tactical play. Retain the existing arena edge and spawn rules.
- Use the same board coordinates for the grid and 3D scene, so roads, buildings, and landmarks align with the cells they represent. Include deterministic map-specific corrections so generation produces the same result each time.
- Generate varied extruded buildings from footprints. Use recorded height and level data where present, and deterministic neighborhood-based estimates where it is absent. Build one original, stylized landmark per city in the game’s existing low-poly style; use no unlicensed third-party models.
- Package each arena with its grid, optimized scene asset, preview image, and manifest. The manifest records the map ID, city and area names, OSM source/date, extract bounds, attribution, and asset version. Load only the selected city’s scene.

### Game and online integration

- Add a stable ArenaMapId for each city and a shared arena catalog containing its display name, preview, grid reference, scene asset, and source metadata. Keep existing non-city arena choices available.
- Add arenaMapId to Arena match configuration and the online room creation/selection flow. Keep campaign stageId separate.
- Have the server validate the selected ID against the catalog and send the selected map ID and authoritative grid in the game configuration. Local matches use the same catalog and grid-loading path.
- Update the online protocol version for the new selection field and deploy client and server changes together. Online clients render the scene associated with the validated map ID; the server-provided grid remains the source of gameplay truth.
- Add city cards to the existing Arena map picker, with city/area name and preview. Show OSM attribution in the picker or credits, with detailed license information available in the game’s credits.
- If a scene asset fails to load, retain the selected grid and use the existing arena rendering as a visual fallback so a client can still join the match.

### Research and reuse decisions

- Use [PAC-MAPS](https://github.com/ProfRino/pac-maps) as a reference for turning street layouts into playable routes. It is a 2D road-graph game, so its movement and map format do not fit Bomberman’s square grid.
- Use [3DA](https://github.com/Hennes617/3dcity-games) as a reference for building-footprint extrusion and missing-height estimates. Implement a small offline pipeline suited to Bomberman rather than adopting its live tile-loading architecture or its newer Three.js renderer wholesale. Its repository is MIT-licensed.
- Use the [Luxembourg Three.js city project](https://github.com/donmutti/city) as a reference for offline city building, merged geometry, and landmark treatment. Its repository has no clear code license, so do not copy its code or assets.
- Obtain OSM data extracts for the selected areas and retain their source and processing records. Do not use Google Maps geometry or bulk-download rendered OSM tiles. Provide readable OpenStreetMap contributor credit and ODbL license details; distribute OSM-derived data under the applicable ODbL terms.

### Delivery sequence

1. Build the converter and a Budapest arena as an internal vertical slice. Verify that the grid, scene, preview, and manifest are produced together and that the result is playable.
2. Tune the converter and the authoring rules on Budapest. Freeze those rules before generating the remaining nine maps.
3. Produce and curate the other nine arenas. Review each grid and scene together, correct awkward rasterization, and check the landmark is visible without obscuring active play.
4. Integrate all ten in local and online Arena selection. Verify server validation, protocol compatibility, and the missing-asset fallback.
5. Release the city pack only when all ten maps meet the acceptance checks below. Keep destructible bridges and buildings as a later gameplay feature requiring explicit simulation and network rules.

## Tests and acceptance

- The converter produces a valid 35×35 grid and a scene asset for every city; repeated builds from the same source and corrections produce identical gameplay grids.
- Every map passes the game’s existing spawn checks. Its playable cells connect according to the existing arena rules, with no building or water scene geometry misaligned over open cells.
- Each map retains Bomberman’s familiar destructible-box gameplay and has clear spawn areas and readable routes.
- Local matches load each city’s grid and scene. Online matches validate every city ID, reject unknown IDs, and deliver the same authoritative grid to all clients.
- Simulate a scene-load failure and confirm the match remains playable with the visual fallback.
- Review all ten previews and in-game scenes for landmark visibility, distinct city character, and unobstructed play.
- Use the existing performance probe to compare each selected city arena against the classic arena on supported devices. Merge repeated geometry, load only the selected scene, and keep performance within the project’s existing arena budget.
- Verify that each map manifest contains its source and attribution information, and that the game’s credits expose the OSM and ODbL notices.

## Assumptions and defaults

- The ten-city list above is the approved first release set; Berlin represents Germany.
- Each city gets one compact landmark-centered Arena, not a complete city or multiple neighborhoods.
- Maps are available in both local and online Arena modes; campaign content is unchanged.
- OSM-derived layouts guide the arena, while curated grid corrections protect Bomberman playability.
- City buildings, bridges, and water are static scenery and/or existing wall cells in this release. Destructible bridges, new terrain rules, traffic, interiors, and arbitrary-city generation are excluded.
