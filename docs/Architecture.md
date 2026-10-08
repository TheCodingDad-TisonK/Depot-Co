# Architecture

Depot Co. is one HTML page, one stylesheet, and one JavaScript closure built from two sets of parts: [Co Engine](https://github.com/TheCodingDad-TisonK/Co-Engine)'s (`node_modules/co-engine/engine/`: the renderer, the palette, props and build mode, doors and screens, people, the route finder, weather and light, the shell, the player, the save, the dev link, the boot) and the game's own in `src/`. The engine's parts go first, the game's after; a game part may use any engine name. three.js r128 is vendored in `game/vendor/three`. There are no other dependencies at run time. Since 1.22.0; before it the whole closure lived in `src/`.

## Files

| Path | What |
|---|---|
| `game/index.html` | The page: splash, start card, HUD, scanner, panel, pause menu. Loads the scripts in order. |
| `game/depot.css` | Every style. Tokens at the top. |
| `game/depot.js` | **Generated** from the engine's parts and `src/` by the engine's `tools/build-game.js` (`npm run build`). Never edit it by hand. |
| `game/menu.js` | The splash and the main menu with the three save slots. Talks to the game through `window.DEPOT`. |
| `game/version.js` | **Generated** from `package.json` by the engine's `tools/sync-version.js` (`co.json` names the global, `DEPOT_VERSION`). |
| `game/logo-256.png`, `logo.png`, `wordmark.png` | **Generated** by `tools/render-brand.js` (a canvas drawing in a hidden Electron window). |
| `main.js` | The Electron shell: one window, no menu bar, screenshots to `Pictures\Depot Co`. `--dev-link` starts the game linked to the dev console. |
| `tools/smoke.js` | `npm test`. Boots the real page headless and climbs the ladder across reloads: seven scenarios in `tools/smoke-*.js` (the shed, the small hall, the hall, the big hall, the annexes, the far end, a 1.20 save), each a template literal evaluated in the page with the shared prologue from `tools/smoke-lib.js`. A scenario ends by sleeping, which books the next building; the runner reloads the page the way the game would and the next scenario carries on with that save. A check message must not carry an escaped apostrophe (the literal eats the backslash and the quote closes early). |
| `tools/devconsole/` | The dev console (1.21.0): `main.js` an Electron window of its own, `server.js` a Node http server on 127.0.0.1:8432 (an event stream of commands to the game, the game's readout posted back, the page for the window), `index.html` the console page, `selftest.js` its round-trip test, `builder.json` the electron-builder config that packs it as one portable exe. `npm run devconsole` runs it, `npm run devconsole:exe` builds `dist/Depot-Co-DevConsole-<version>.exe`, and the release workflow attaches that exe beside the installer. |

## The parts of `src/`

They join in file-name order, after the engine's parts, into one function scope, so every `function` is hoisted and visible to every other part. The build refuses to join two top-level functions with the same name, on either side. The game talks to the engine through `GAME` (the hook object `CO.game`, made in `01-head`, filled by every part) and the hook bus (`hook(name, fn)`); `docs/ENGINE.md` in the engine repo is the contract. `co.json` at the repo root names the paths (the engine folder, `src/`, the output, the page, the version global).

| Part | Holds |
|---|---|
| `01-head` | `GAME`, `CO.setup` (the engine makes the renderer, reads the slot and the settings, binds the page, makes the player), `BOOT_STAGE` (the building stage read off the raw save before anything is laid out). |
| `02-config` | The sixteen lines (`SKUS`) and nine clients with the level each arrives at, the three lanes, the ladder (`LEVEL_CAP`, `XP_TABLE`, `UNLOCK`, `STAFF_CAPS`, `LADDER_NOTES`, `levelOpens`), the six building stages (`STAGES`, `STAGE`, `stageHas`, `stageFlags`), the clock, the economy, the upgrades (`free: <stage>` marks the structure a stage brings), staff roles, and every layout number for the stage the page booted at (`HALL`, `RACK`, `DOCKS`, `SPOT`, `TRUCK_OUT`, `VAN`). |
| `03-state` | `freshState()`, the save migrations (`migrateDepot`, run by the engine's `loadSave`), `addXp()`, `addRep()`. The state is the single object `S`; `save()` and `pay()` are the engine's. |
| `04-sound` | The depot's sound effects, added to the engine's table (`SFX`); the synth, the feed and the toasts are the engine's. |
| `05-three` | The hall's lights, the depot's own textures (the boxes, the posters) and materials over the engine's palette, `poster()`. |
| `06-building` | The hall for the stage (the shed and its lining, or the hall with its rooms slid to its walls), the dock doors, the racks (`buildRack`), the office, the bench, the break room, the order board, `floorY()`. |
| `06-doors` | The keyring (which members of the crew open the hinged doors), night mode's roll doors, the control cabinet. The touch-screen kit and the hinged doors are the engine's. |
| `06-dressing` | Everything that makes the hall look worked in: clocks, fans, posters, fire points, the baler and wrapper, the break room and office props, the KPI board. |
| `06-yard` | The yard: lanes, dock shelters, fence, barrier gates, gatehouses and guards, car park, neighbours, the road and its traffic, puddles, snow on the ground. The sky, the sun and the moon, the clouds, the rain and the snow are the engine's (`buildSky`). |
| `07-items` | Boxes, pallets and parcels as three instanced meshes laid out from `S` every frame (`syncInstances`), the hand, the rack-slot logic, the floor. |
| `08-trucks` | The timetable, the truck mesh, docking, departure, the receiving fee, loading parcels, the dock consoles. |
| `09-orders` | Clients, order generation, lateness, the packing bench, packing, the parcel shelf, shipping and pay. |
| `09-returns` | Returns: the parcels customers send back ride in on the outbound trucks (and the returns truck), the inspection desks check them, the packer's returns work (1.16.0; stations since 1.17.0, so the returns hall's three desks share one queue). |
| `10-vehicles` | The jack and the cart you push, the forklift you drive. |
| `11-staff` | The route finder's shape over the site (`navSetup`, `GAME.navPass`), the receiver, the picker, the packer. The human model and the router are the engine's. |
| `12-player` | The dynamic blockers (`rebuildDyn`), the forklift seat and the office PC as player overrides, the instanced stock as things the crosshair may hit, the depot's keys (the scanner, the forklift). Movement, collision, the raycast and the input are the engine's. |
| `12-machines7-returns` | The returns hall (1.17.0): Hall 2 without its racks, the returns dock and its truck, the belt to the intake, three inspection desks, the restock cage, the compactor, the floor zones; `dockStepSide`, `doorOwned`, the row migration. |
| `13-scanner-device` | The handheld scanner in the hand and its canvas display. |
| `13-scanner-map` | The scanner's map page: the site from above with you, the crew, the trucks and the waypoint (1.16.0). |
| `13-ui` | The HUD fields, the PC and bench panel contents, the dev commands, the pause menu's lines, the guide. The panel element, the pause menu, the settings and photo mode are the engine's. |
| `14-events` | The clock, the day roll, the hall's lamps by the hour (a `lighting` hook; the sun and the sky are the engine's), sleep, coffee, power cuts, the inspector, the prowler, the level-up engine (`onLevelUp`, the level card, `stageEarn`, `stageRebuild`), the guided intro. |
| `14-life` | The depot's weather words and roofs (the weather itself is the engine's), the radio sequencer, the forklift battery, the stretch wrapper. |
| `14-report` | The day report: the day closed off at every roll, the HUD card, the fortnight's table (1.16.0). |
| `15-boot` | The boot steps for the engine (`afterLoad`, `buildWorld`, `afterBuild`, the start screen, `tick`, `present`), the test handle, `CO.boot(GAME)`, which publishes `window.DEPOT`. The dev link (Ctrl+Shift+D, `?dev=1`, the auto-link in the desktop app) and the static bake are the engine's. |

## How things relate

- **The save is the world.** Boxes, pallets and parcels have no meshes of their own. `syncInstances()` rebuilds three `InstancedMesh` objects from `S` every frame, and records for each instance where it came from (`instSrc`) so the raycast can say "that box is on pallet X on the floor". Nothing can drift out of sync with the save because there is no second copy.
- **Interaction is a raycast from the screen centre** against `inter` (hit meshes with a `userData.it` of `{ prompt(), use() }`) plus the three instanced meshes. The nearest hit whose `prompt()` returns text becomes `focus`. `E` calls `focus.use()`.
- **Collision is axis-aligned boxes.** `solids` is static (walls, racks, furniture). `dyn` is rebuilt every tick from pallets on the floor, docked trailers, closed doors, the forklift. The player is a circle of radius 0.32 moved one axis at a time. `floorY(x, z)` says whether the ground here is the hall (0), a docked trailer (0), the ramp, or the yard (-1.2); a rise of more than half a metre counts as a wall.
- **The building stages (1.21.0).** Six rectangles in one world frame, each inside the next: the shed (14 x 10), the small hall (40 x 28), the hall (60 x 48), the big hall (72 x 48), the same with the annexes, the same with Hall 4. `BOOT_STAGE` is read off the raw save in `01-head` before `02-config` runs, so every layout table (`HALL`, `RACK`, `DOCKS`, `SPOT`, `TRUCK_OUT`) is built once a page load for that stage and nothing downstream needs a second code path. A level that earns a bigger stage marks it due (`S.siteDue`); at the day roll `stageRebuild` sets `S.site`, saves and reloads behind a fade. Prop defaults are laid out per stage in `defProp` (06-props): a 40-frame default is used raw in the small hall, grown in the hall and wall-shifted in the big halls; a 60-frame default (`abs`) is pulled in by `ungrown` for the small hall; a 72-frame default (`abs, keep`) first by `unwallX`; `at[stage]` names a spot outright; `stage` and `lvl` say when a prop stands, `shed` lets it stand in the shed. The save fields are `site` and `siteDue` (not `stage`: that word was the deck's shipping bays). A save without them boots in the big hall at least (`stageForOwned`).
- **Time** runs at one game hour per 75 real seconds while open, four times that at night, and stops while a panel or the pause menu is open. Trucks spawn when the clock crosses their slot and a flag keyed by day keeps them from spawning twice.
- **The hall grew again** from 60 x 48 to 72 x 48 on 2026-10-03: the side walls moved from x 30 to x 36. The config defines wallX(x, z, yard): a hall position with |x| in the old wall zone (22.1 up to 30.5) moves out by 6 m, a yard position beside a side wall moves with it, and defProp applies it after grown(). The SPOT table is shifted the same way, the rooms are built from HALL.x, and a hall-3 save migrates its layout, custom props, floor pallets, staff and tools once (03-state). The pick belts cross the east corridor hung from the roof (a path point flagged hang draws rods instead of legs) and ramp down beside the bench to two inlets.
- **The hall grew** from 40 x 28 to 60 x 48 on 2026-10-02. Prop defaults authored for the small hall are shifted at `defProp` by the `grown()` rule in `06-props` (a coordinate with |v| >= 8 moves 10 m outward) unless the def says `abs: true`; everything newer is authored in the big hall with `abs: true`. The save carries `hall: 3` and `load()` in `03-state` migrates older generations (clears layout overrides, parks the tools, evicts any truck that would sit inside the walls).
- **Machines** (`12-machines`): a registry `MACH` of machines with an inlet and an outlet in their own prop frame, a status and a lamp stack, and `BELTS` with a path per prop. A belt hands an item at its end to whatever is within 1.3 m of that end, another belt or a machine, so moving the pieces in build mode keeps a line working and piles items up at a gap. Belt items are drawn with the instanced boxes and parcels. Animated parts of a machine live in a `userData.dynamic` subgroup so the static bake leaves them alone. The pack line owns `packOrder` (an order is in state `packing` while on it), the moulding line and hopper feed the main belt to the palletiser, and the baler and wrapper sit on the same registry. The production wing itself and the machine props are built in `06-props2-factory`.
- **Staff** walk through `route(a, b)`: A* on a 0.4 m grid built from the static solids, with cells outside the hall open only inside a docked trailer, then string-pulled. Hinged doors never block them (they carry keys).
- **The test handle** `window.DEPOT.T` exposes the state and the action functions so the smoke test can play without a mouse: `T.run(seconds)` advances the whole world in 50 ms steps.

## Adding a line, a client, an upgrade

- A line: add a row to `SKUS` in `02-config`. Its cardboard texture, colour band and label are generated from it.
- A client: add to `CLIENTS` with the lines it likes. The trailer sign is drawn from the name.
- An upgrade: add to `UPGRADES` with its `lvl` from `UNLOCK`, then handle its id in `buyUpgrade()` (13-ui) and wherever it changes play.
- A level: add a row to `XP_TABLE`, raise `LEVEL_CAP`, give the level a line in `LADDER_NOTES` and put something on it in `UNLOCK`; `levelOpens` and the card read the tables. A stage: a row in `STAGES` with its hall size, rows, docks and fence, a `level`, and the `STAGE_OF` keys for what it brings.
