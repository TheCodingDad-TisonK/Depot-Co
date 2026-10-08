# Architecture

Depot Co. is one HTML page, one stylesheet, and one JavaScript closure built from the parts in `src/`. three.js r128 is vendored in `game/vendor/three`. There are no other dependencies at run time.

## Files

| Path | What |
|---|---|
| `game/index.html` | The page: splash, start card, HUD, scanner, panel, pause menu. Loads the scripts in order. |
| `game/depot.css` | Every style. Tokens at the top. |
| `game/depot.js` | **Generated** from `src/` by `tools/build-game.js`. Never edit it by hand. |
| `game/menu.js` | The splash and the main menu with the three save slots. Talks to the game through `window.DEPOT`. |
| `game/version.js` | **Generated** from `package.json` by `tools/sync-version.js`. |
| `game/logo-256.png`, `logo.png`, `wordmark.png` | **Generated** by `tools/render-brand.js` (a canvas drawing in a hidden Electron window). |
| `main.js` | The Electron shell: one window, no menu bar, screenshots to `Pictures\Depot Co`. |
| `tools/smoke.js` | `npm test`. Boots the real page headless and plays several days through the test handle: 317 checks, from the first truck to the sortation deck, the annex halls, the scanner, the returns desk and the day report. |

## The parts of `src/`

They join in file-name order into one function scope, so every `function` is hoisted and visible to every other part. The build refuses to join two top-level functions with the same name.

| Part | Holds |
|---|---|
| `01-head` | The closure, utilities, the save key for the active slot, the machine settings (`SET`). |
| `02-config` | The sixteen lines (`SKUS`), the nine clients, the three lanes, the clock, the economy, the upgrades, staff roles, and every layout number (`HALL`, `RACK`, `DOCKS`, `SPOT`). |
| `03-state` | `freshState()`, `load()`, `save()`, `pay()`, `addXp()`, `addRep()`. The state is the single object `S`. |
| `04-sound` | The feed, toasts, and every sound effect as a small Web Audio synth. |
| `05-three` | Renderer, camera, lights, every texture drawn on a canvas, every material, the `box`/`plane`/`sign`/`hitBox` helpers, the `inter` list and the `solids` list. |
| `06-building` | The hall, the dock doors, the racks (`buildRack`), the office, the bench, the break room, the order board, `floorY()`. |
| `06-doors` | The touch-screen kit (`touchScreen`, UV tap mapping), hinged doors with locks, the control cabinet. |
| `06-dressing` | Everything that makes the hall look worked in: clocks, fans, posters, fire points, the baler and wrapper, the break room and office props, the KPI board. |
| `06-yard` | The yard: lanes, dock shelters, fence, barrier gates, gatehouses and guards, car park, neighbours, the road and its traffic, sun, moon, clouds, puddles, rain and snow particles. |
| `07-items` | Boxes, pallets and parcels as three instanced meshes laid out from `S` every frame (`syncInstances`), the hand, the rack-slot logic, the floor. |
| `08-trucks` | The timetable, the truck mesh, docking, departure, the receiving fee, loading parcels, the dock consoles. |
| `09-orders` | Clients, order generation, lateness, the packing bench, packing, the parcel shelf, shipping and pay. |
| `09-returns` | Returns: the parcels customers send back ride in on the outbound trucks (and the returns truck), the inspection desks check them, the packer's returns work (1.16.0; stations since 1.17.0, so the returns hall's three desks share one queue). |
| `10-vehicles` | The jack and the cart you push, the forklift you drive. |
| `11-staff` | The human model, the aisle router, the receiver, the picker, the packer. |
| `12-player` | Movement, collision against `solids` and `dyn`, the centre raycast that sets `focus`, the keys. |
| `12-machines7-returns` | The returns hall (1.17.0): Hall 2 without its racks, the returns dock and its truck, the belt to the intake, three inspection desks, the restock cage, the compactor, the floor zones; `dockStepSide`, `doorOwned`, the row migration. |
| `12-photo` | Photo mode: F9 frees the camera, hides the HUD and holds the clock (1.16.0). |
| `13-scanner-device` | The handheld scanner in the hand and its canvas display. |
| `13-scanner-map` | The scanner's map page: the site from above with you, the crew, the trucks and the waypoint (1.16.0). |
| `13-ui` | HUD, the PC and bench panels, the pause menu, settings, the guide. (The HTML scanner that lived here until 1.16.0 is gone; the device in `13-scanner-device` is the scanner.) |
| `14-bake` | The static-geometry bake: every mesh that never moves is merged by material. Groups flagged `userData.dynamic`, glowing materials and anything interactive are left alone. |
| `14-events` | The clock, the day roll, lighting by the hour, sleep, coffee, power cuts, the inspector, the prowler, levels, the guided intro. |
| `14-life` | Seasons and weather, rain ambience and thunder, the radio sequencer, the forklift battery, the stretch wrapper. |
| `14-report` | The day report: the day closed off at every roll, the HUD card, the fortnight's table (1.16.0). |
| `15-boot` | Load, build, the frame loop, autosave, `window.DEPOT`. |

## How things relate

- **The save is the world.** Boxes, pallets and parcels have no meshes of their own. `syncInstances()` rebuilds three `InstancedMesh` objects from `S` every frame, and records for each instance where it came from (`instSrc`) so the raycast can say "that box is on pallet X on the floor". Nothing can drift out of sync with the save because there is no second copy.
- **Interaction is a raycast from the screen centre** against `inter` (hit meshes with a `userData.it` of `{ prompt(), use() }`) plus the three instanced meshes. The nearest hit whose `prompt()` returns text becomes `focus`. `E` calls `focus.use()`.
- **Collision is axis-aligned boxes.** `solids` is static (walls, racks, furniture). `dyn` is rebuilt every tick from pallets on the floor, docked trailers, closed doors, the forklift. The player is a circle of radius 0.32 moved one axis at a time. `floorY(x, z)` says whether the ground here is the hall (0), a docked trailer (0), the ramp, or the yard (-1.2); a rise of more than half a metre counts as a wall.
- **Time** runs at one game hour per 75 real seconds while open, four times that at night, and stops while a panel or the pause menu is open. Trucks spawn when the clock crosses their slot and a flag keyed by day keeps them from spawning twice.
- **The hall grew again** from 60 x 48 to 72 x 48 on 2026-10-03: the side walls moved from x 30 to x 36. The config defines wallX(x, z, yard): a hall position with |x| in the old wall zone (22.1 up to 30.5) moves out by 6 m, a yard position beside a side wall moves with it, and defProp applies it after grown(). The SPOT table is shifted the same way, the rooms are built from HALL.x, and a hall-3 save migrates its layout, custom props, floor pallets, staff and tools once (03-state). The pick belts cross the east corridor hung from the roof (a path point flagged hang draws rods instead of legs) and ramp down beside the bench to two inlets.
- **The hall grew** from 40 x 28 to 60 x 48 on 2026-10-02. Prop defaults authored for the small hall are shifted at `defProp` by the `grown()` rule in `06-props` (a coordinate with |v| >= 8 moves 10 m outward) unless the def says `abs: true`; everything newer is authored in the big hall with `abs: true`. The save carries `hall: 3` and `load()` in `03-state` migrates older generations (clears layout overrides, parks the tools, evicts any truck that would sit inside the walls).
- **Machines** (`12-machines`): a registry `MACH` of machines with an inlet and an outlet in their own prop frame, a status and a lamp stack, and `BELTS` with a path per prop. A belt hands an item at its end to whatever is within 1.3 m of that end, another belt or a machine, so moving the pieces in build mode keeps a line working and piles items up at a gap. Belt items are drawn with the instanced boxes and parcels. Animated parts of a machine live in a `userData.dynamic` subgroup so the static bake leaves them alone. The pack line owns `packOrder` (an order is in state `packing` while on it), the moulding line and hopper feed the main belt to the palletiser, and the baler and wrapper sit on the same registry. The production wing itself and the machine props are built in `06-props2-factory`.
- **Staff** walk through `route(a, b)`: A* on a 0.4 m grid built from the static solids, with cells outside the hall open only inside a docked trailer, then string-pulled. Hinged doors never block them (they carry keys).
- **The test handle** `window.DEPOT.T` exposes the state and the action functions so the smoke test can play without a mouse: `T.run(seconds)` advances the whole world in 50 ms steps.

## Adding a line, a client, an upgrade

- A line: add a row to `SKUS` in `02-config`. Its cardboard texture, colour band and label are generated from it.
- A client: add to `CLIENTS` with the lines it likes. The trailer sign is drawn from the name.
- An upgrade: add to `UPGRADES`, then handle its id in `buyUpgrade()` (13-ui) and wherever it changes play.
