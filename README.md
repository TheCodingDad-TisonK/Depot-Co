<p align="center"><img src="game/wordmark.png" width="520" alt="Depot Co."></p>

<p align="center"><b>A first-person warehouse simulator.</b><br>Trucks bring the stock, you rack it, orders come in, you pick, pack and ship them. Then hire a crew and buy a forklift.</p>

> [!IMPORTANT]
> **This is NOT a Farming Simulator product.**
> Depot Co. has nothing to do with Farming Simulator, GIANTS Software, or any Farming Simulator mod, including the Realistic Farming mods by the same author. It is a separate, standalone hobby project, a sibling of [Grow Co.](https://github.com/TheCodingDad-TisonK/Grow-Co), built the same way.

## What it is

You run a small third-party logistics depot. Six clients send stock on inbound trucks; you open the dock door, walk into the trailer, and move the pallets onto the racks by hand, with the pallet jack, or later with the forklift. Their customers order from that stock through the day. You pick the boxes off the racks, pack the order at the bench, carry the parcel into the outbound trailer and send the truck. You are paid a fee for every pallet you receive and a cut of every order that ships on time.

It is one HTML page and plain JavaScript on top of [three.js](https://threejs.org). No framework, no assets to download: every texture, the brand, and every sound is generated in code. The `game/` folder is committed ready to run, so playing or hosting it needs no build step. The desktop app is the same page inside Electron.

## Features

| | |
|---|---|
| **The loop** | Receive, put away, pick, pack, load, dispatch. Sixteen product lines across four tiers, three of them your own brand off the moulding line, six clients with their own tastes, rush orders, short orders, late penalties, contracts. |
| **The hall** | A 60 by 48 metre hall under an 8 metre roof with five rows of skylights: six rack rows of fifteen bays and three levels, two inbound and two outbound dock bays with roll-up doors, dock shelters and steps, a walled office with a real in-world PC, an order board, a KPI whiteboard and the breaker panel, an entrance lobby with the time clock and lockers, a walled break room with a cot, a coffee counter, a vending machine and a radio, a working baler and a stretch wrapper, a damaged-goods bin, and everything a worked-in hall has: cable trays, sprinkler mains, extractor fans, fire points, posters, clocks, floor paint and wear. Outside: a fenced yard with V-mesh security fencing, barrier gates and gatehouses with guards, marked truck lanes, a staff car park, a smoking shelter, a silo, named neighbours, and a road with traffic. |
| **Your hands** | Carry one box or one parcel. `E` takes, puts on or uses; `G` puts down. Everything you hold is physically in the world. |
| **Tools** | A pallet jack from day one. A picking cart that holds six boxes and picks straight off the racks. A forklift you drive, with a proper cab, three gears on Shift, a beacon, a reversing beeper, a battery you plug in by cable at the charging point, and forks that lift to the top rack level. A stretch wrapper: wrap a pallet before you move it fast, or it sheds boxes. |
| **Production** | A wing behind the north wall with a hopper, a moulding line that makes own-brand goods from raw granulate, and a belt into the hall where a palletiser stacks them. Packing is a machine too: infeed belt, case taper, outfeed, gravity shelf. |
| **Automation** | Shop upgrades that take the work out of your hands: a shipping belt and dock loader at OUT 2, an AGV that puts pallets away by itself, and a gantry picker over row A that feeds the bench by an overhead belt. Every machine is a prop you can move; belts hand items to whatever their end touches. |
| **Drivers** | Every truck has a driver who climbs out, comes in through the dock door with the delivery note, and waits beside it. Nothing comes off an inbound truck until you sign for it. They chat, and they nag when you keep them waiting. |
| **Doors and locks** | Hinged doors on the office, the break room, the staff entrance and the fire exit. E opens, Shift+E locks. A control cabinet by the office switches the hall and yard lights, every dock door, and a night mode that locks the whole place down. Leave something unlocked at night and stock walks. |
| **The scanner** | Tab raises a real handheld scanner into your hand. Its display shows the pick list with slot locations, what is still on the truck and where it should go, the stock, and the day. Point it at a rack slot and it reads the slot. |
| **Weather and seasons** | Four seasons of seven days. Rain, storms with lightning, overcast skies, and snow that settles on the yard. A radio in the break room with three synthesized stations. Sunday is closed. |
| **The office PC** | Orders, the shop (cart, rack rows, forklift, LED high bays, a second inbound bay, a roadside sign), staff, finance with a full ledger, stock, lifetime stats. |
| **Staff** | A receiver who empties trucks onto the racks, a picker who feeds the bench, a packer who releases orders to the pack line and loads the parcels. They arrive through the yard, clock in at the time clock, break at noon, and are paid by the hour from their timesheet with overtime after ten. They never open a dock door: that stays your job. |
| **Trouble** | Power cuts that kill the doors and the PC until you reset the breaker. A safety inspector who fines you for boxes left on the floor. A prowler who takes stock through a dock door left open at night. |
| **A day** | Sixteen working hours in twenty minutes. Trucks on a fixed timetable, a night that runs fast, a cot that skips to morning and charges rent and wages. |
| **Progress** | Levels unlock lines, upgrades and staff. Reputation brings more and bigger orders. A guided intro walks a new depot through its first truck and first shipment for a $400 bonus. |
| **Three save slots** | Three depots side by side, each deleted on its own. Any save exports as text or a `.json` file and loads back from the pause menu. |

## Install and play

**Windows:** the installer from the Releases page (`Depot-Co-Setup-<version>.exe`) puts it in your Start menu and on the desktop.

**Any browser:** clone the repo and run `node tools/serve.js`, then open `http://127.0.0.1:8430/`. Or point any static web server at the `game/` folder. Chrome, Edge and Firefox work; the game wants pointer lock, so it runs in a page you have clicked.

**From source with Electron:** `npm install` then `npm start`.

## Controls

| Key | Does |
|---|---|
| `W A S D` · `Shift` · `Space` | Move, run, jump |
| `E` | Use, pick up, put on the rack or the bench, lift with the jack, pack, load |
| `G` | Put down what you hold, let go of the jack or cart, get off the forklift |
| `Tab` · `1`-`4` | Hand scanner and its pages |
| `W S A D` · `R F` on the forklift | Drive, steer, raise and lower the forks |
| `Esc` | Pause menu: settings, guide, stats, save file |
| `F3` · `F12` · `F11` | FPS counter, screenshot, fullscreen |

## Building

```
npm run build       # joins src/ into game/depot.js and writes game/version.js
npm run check       # refuses to pass if game/depot.js is not what src/ builds
npm test            # the smoke test: boots the real game headless and plays a day through it
npm run brand       # redraws the logo and wordmark
npm run installer   # the NSIS installer in dist/ (needs the icon from npm run icon)
```

Never edit `game/depot.js` by hand: edit `src/` and build. See `docs/Architecture.md`.

## Licence

MIT. Made by TheCodingDad.
