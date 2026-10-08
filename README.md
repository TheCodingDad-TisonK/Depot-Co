<p align="center"><img src="game/wordmark.png" width="520" alt="Depot Co."></p>

<p align="center"><b>A first-person warehouse simulator that grows with you.</b><br>Start in a shed with one rack, one door and a van. Twenty-five levels later you run five halls, three shipping lanes, a sortation deck and a crew of eight.</p>

> [!IMPORTANT]
> **This is NOT a Farming Simulator product.**
> Depot Co. has nothing to do with Farming Simulator, GIANTS Software, or any Farming Simulator mod, including the Realistic Farming mods by the same author. It is a separate, standalone hobby project, a sibling of [Grow Co.](https://github.com/TheCodingDad-TisonK/Grow-Co), built the same way.

![Depot Co. main menu: three save slots in front of the racks](gallery/dcMainMenu.jpg)

More screenshots: the [gallery](gallery/README.md).

## What it is

You run a third-party logistics depot. Clients send stock on inbound trucks; you open the dock door, walk into the trailer and move the pallets onto the racks by hand, with the pallet jack, or later with a forklift. Their customers order from that stock through the day. You pick the boxes, pack the order and get the parcel onto the truck of its lane. You are paid a fee for every pallet you receive, a cut of every order that ships on time, and a bonus for every level you reach.

It is one HTML page and plain JavaScript on top of [three.js](https://threejs.org). No framework, no assets to download: every texture, the brand and every sound is generated in code. The `game/` folder is committed ready to run, so playing or hosting it needs no build step. The desktop app is the same page inside Electron.

## The ladder

Everything you do earns XP, and every level opens something: a rack bay, a tool, a client, a line, a page on the hand scanner, a role to hire, a system. Every fifth level the building itself grows, free, overnight. The HUD says what the next level promises; a card lists what the one you reached has brought.

| Level | The building | Some of what opens along the way |
|---|---|---|
| 1 to 4 | **The shed.** 14 by 10 metres: one roll door, one rack row that grows a bay a level, a trestle table you pack on by hand, a clipboard for an office, a van that parks at the shed front twice a day. No rent. | The time clock, the picking cart, the first hire, the coffee flask, two more clients |
| 5 to 9 | **The small hall.** 40 by 28: IN 1 and OUT 1, an office with a real PC, a lobby, a break room, the bench with its pack line, the breaker, a fenced yard with barriers and gatehouses. | Contracts, power cuts, build mode, the forklift, the bank, shift patterns, the prowler, insurance, the packer and the driver, returns, the inspector, the stacker, the shipping belt, training |
| 10 to 14 | **The hall.** 60 by 48: IN 2 and OUT 2, the three shipping lanes, the production wing with its moulding line, a second jack, the car park and the road. | Raw granulate and your own-brand lines, raises, a fifth row, the AGV, the plant tune-up, second roles, the gantry pickers |
| 15 to 19 | **The big hall.** The walls move out to 72 metres; the mezzanine and the sortation deck come with them, OUT 3 opens the air lane. | The deck accounts, the deck night shift, the automation suite, conveyors by the piece, bigger contracts, comfort seating, the deck dial, the yard catalogue |
| 20 to 24 | **The annexes.** The returns hall with a dock and a truck of its own, Hall 3 with a third inbound dock. | Eight heads, two contracts at once, faster deck belts, the last of the furniture, the long contract |
| 25 | **The far end.** Hall 4 behind the wing and the full yard. | The top of the ladder |

A save from before 1.21 keeps the big hall it lived in. The ladder is data (`XP_TABLE`, `UNLOCK`, `STAGES` in `src/02-config.js`) and extends by adding rows.

## What is in it

| | |
|---|---|
| **The loop** | Receive, put away, pick, pack, load, dispatch. Sixteen product lines, three of them your own brand off the moulding line, nine clients with their own tastes and lanes, rush orders, short orders, late penalties, contracts. |
| **Six buildings in one** | The shed and five halls, each inside the next, built from one set of numbers per stage: the rooms slide to their walls, the docks sit where that hall had them, and everything the game owns stands where the layout of that hall put it. |
| **Your hands** | Carry one box or one parcel. `E` takes, puts on or uses; `G` puts down. Everything you hold is physically in the world, and a box on the bench is a thing you look at and take, not a line in a menu. |
| **People** | Staff, drivers and guards are rigged figures with knees, elbows, shoes, collars, hair and a face that blinks and looks at you. |
| **Tools** | A pallet jack from day one, a second from the hall. A picking cart that holds twelve boxes or parcels. A forklift with three gears, a beacon, a reversing beeper, a battery you charge by cable, and forks that reach the top rack level. A stretch wrapper: wrap a pallet before you move it fast, or it sheds boxes. |
| **Production** | A wing behind the north wall with a hopper, a moulding line that makes own-brand goods from raw granulate, and a belt into the hall where a palletiser stacks them. Packing is a machine from the small hall on: infeed belt, case taper, outfeed, gravity shelf. |
| **The hand scanner** | A terminal in your hand on Tab that acts as well as shows (Enter fires the selected row: doors, signatures, dispatch, packing, machine buttons, the crew, your clock). Nine pages that the ladder opens one by one: home and alerts, orders and their slots, a pick list in walking order, put-away, stock, docks and bays, plant, crew, and a map of the whole site. F sets a waypoint on anything. |
| **Three lanes** | From the hall every client ships by sea, land or air, and every order wears its lane on the board: sea by OUT 1, land by OUT 2, air by OUT 3 once the deck opens it. A parcel out of the wrong door still ships, for a forwarding fee. Before the lanes, one door takes everything, and in the shed it is a van. |
| **The mezzanine and the sortation deck** | A steel deck over the receiving strip with a goods lift, an upper rack row and a crane of its own. The deck turns it into the parcel floor: every parcel rides a spiral up, a scanner reads its lane, three cells crate, strap or bag it, and spirals drop it into the loader of its door. Every dock has a shipping bay, and with the night shift the deck sorts while you sleep. |
| **The annex halls** | The returns hall east of the production wing, Hall 3 west of it with a third inbound dock, Hall 4 behind the wing: each a hall of its own with a doorway cut into the wall it opens off, shuttered until its level. |
| **Automation** | A shipping belt and dock loader, an AGV that puts pallets away by itself, gantry pickers over every rack row that feed the bench by overhead belts, and belts by the piece from the catalogue that snap to belt ends, machines, dock doors and rack bays as you carry them. Every machine is a prop you can move. |
| **Staff** | A picker, a receiver with a jack of their own, a packer, a forklift driver. They come in through the yard, clock in at the time clock, break at noon, and are paid by the hour from their timesheet. Courses, raises, shift patterns and second roles arrive on the ladder; the crew grows from one head to eight. They never open a dock door: that stays your job. |
| **Drivers, doors and locks** | Every truck has a driver who comes in with the delivery note and waits beside the door; nothing comes off until you sign. Hinged doors on the office, the break room, the staff entrance and the fire exit; a control cabinet with a night mode that locks the place down. Leave something open at night and stock walks. |
| **Returns** | From level 8 the outbound trucks bring the odd parcel back; the returns desk inspects it for a fee. At level 20 the returns hall takes it over: a dock and a truck of its own, a belt to the intake, three desks, a restock cage, a compactor. |
| **Trouble, one kind at a time** | Power cuts from level 5, the prowler from 7, the safety inspector from 8. |
| **Furniture and comfort** | The rooms come furnished and the catalogue sells more; comfort shortens the crew's breaks. |
| **Weather, seasons, Sundays** | Four seasons of seven days. Rain, storms, overcast skies, snow on the yard. A radio with three synthesized stations. Sunday is closed. |
| **The day report, photo mode** | Every day roll closes the day on a card and a fortnight's table. F9 frees the camera and hides the HUD. |
| **Three save slots** | Three depots side by side. Any save exports as text or a `.json` file and loads back from the pause menu. |

## Install and play

**Windows:** the installer from the Releases page (`Depot-Co-Setup-<version>.exe`) puts it in your Start menu and on the desktop.

**Any browser:** clone the repo and run `node tools/serve.js`, then open `http://127.0.0.1:8430/`. Or point any static web server at the `game/` folder. Chrome, Edge and Firefox work; the game wants pointer lock, so it runs in a page you have clicked.

**From source with Electron:** `npm install` then `npm start`.

## Controls

| Key | Does |
|---|---|
| `W A S D` · `Shift` · `Space` | Move, run, jump |
| `E` | Use, pick up, put on the rack or the table, lift with the jack, pack, load |
| `G` | Put down what you hold, let go of the jack or cart, get off the forklift |
| `Tab` · `1`-`9` | Hand scanner and its pages; the wheel moves its cursor, `F` sets a waypoint, `Enter` acts on the selected row, `X` clears the waypoint |
| `W S A D` · `R F` on the forklift | Drive, steer, raise and lower the forks |
| `F9` | Photo mode: a free camera with the HUD off; the wheel zooms the lens |
| `F2` · `C` | Build mode (from level 5), and its catalogue |
| `Ctrl+Shift+D` | Link the dev console (see below) |
| `Esc` | Pause menu: settings, guide, stats, save file |
| `F3` · `F12` · `F11` | FPS counter, screenshot, fullscreen |

## The dev console

For testing, a separate little program. `npm run devconsole` opens it in a window of its own: a live readout of the save and the cheats (money, levels, stage jumps, the clock, weather, trucks, orders, stock, crew, teleports). In the game, `Ctrl+Shift+D` links to it, or `npm run dev` starts the game linked. The HUD shows LINKED while it is connected. It writes straight into the save.

## Building

```
npm run build       # joins src/ into game/depot.js and writes game/version.js
npm run check       # refuses to pass if game/depot.js is not what src/ builds
npm test            # the dev console self test, then the smoke test: boots the real game headless and climbs the whole ladder across reloads
npm run devconsole  # the dev console window
npm run dev         # the game, linked to the dev console from the first frame
npm run brand       # redraws the logo and wordmark
npm run installer   # the NSIS installer in dist/ (needs the icon from npm run icon)
```

Never edit `game/depot.js` by hand: edit `src/` and build. See `docs/Architecture.md` for how the parts fit and `docs/Player-Guide.md` for the whole game in words.

## Licence

MIT. Made by TheCodingDad.
