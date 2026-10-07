# Changelog

## 1.14.0 (2026-10-07)

Three shipping lanes with a third dock, a mezzanine that became a sortation deck, shipping bays at every dock, three more halls, six upgrade tiers, staff options and a plant page.

**Three lanes**
- Every client ships by sea, land or air, and every order wears its lane on the board, in the log and on the dock consoles. Sea leaves by OUT 1, land by OUT 2, air by the new OUT 3 at the north end of the east wall. An order is due at the next truck of its own lane; each dock has two truck windows a day (sea 10:30 and 17:00, land 09:00 and 16:00, air 13:00 and 19:00).
- A parcel loaded out of the wrong door still ships, for a 25% forwarding fee, and the consoles count it as misrouted. Air orders pay half as much again. Sea trucks carry a container, air trucks wear a carrier band, and the haulier on the trailer names the lane. The packer only loads a parcel into the truck of its lane.
- OUT 3 is cut into the wall from the start and opens with the sortation deck. Its landing and driver route sit on the north side because the hall corner is there; its console is on the north wall beside the door.

**The mezzanine** (shop, level 6, after the gantry pickers)
- A steel deck over the receiving strip at 4.6 m, reached by a stair along the north wall and a goods lift by IN 1. Set a pallet in the lift with a jack or the forklift and it goes up by itself, rolls onto the feed belt and is racked in the upper row. The upper crane sends boxes the bench needs down a chute into the south pick belt. The crew never go up.

**The sortation deck** (shop, level 6, after the mezzanine)
- Every parcel off the pack line shelf rides a spiral conveyor up beside the pack line and an overhead run onto the deck. A scanner arch reads its lane. The spine carries it past three cells: the sea cell crates it, the land cell straps it, the air cell bags it. A finished parcel rides a parcel lift beside its cell up to a bridge belt onto the overhead collector, which runs along the north wall and south to the spiral well. The air gate drops air parcels down a spiral through the deck into the OUT 3 shipping bay, the sea gate sends sea parcels out over the deck edge and down a spiral in the OUT 1 apron into the OUT 1 bay, and land parcels ride on down the east lane and down a third spiral into the OUT 2 bay. A parcel whose cell is full waits on a turntable and goes round again. The sortation panel on the scanner arch shows what was read and what each cell is doing; its dial drives every deck belt.
- The deck is built to walk: the collector and the parcel run ride two metres overhead where you walk, a corridor runs along the north wall past the cells, and two step-overs cross the upper pick belt and the spine's east end. Deck belts are solid only to a metre up, so the step-over platforms clear them.
- The crate, strap or bag look stays with the parcel wherever it goes: in your hand, on the floor, on the cart, on the shelf, in a worker's arms, in a bay, in a truck.
- Three deck accounts start ordering once the deck stands (Meridian Exports by sea, Nordwind Parcels by air, Continental Retail by land): two to four lines, up to eight of each, a third more pay. Their trucks and contracts come with them.
- **Deck night shift** (shop, after the deck): while you sleep, every parcel on the shelf and on the deck is sorted into the shipping bays, so the morning trucks find them full.

**Shipping bays**
- Every outbound dock has a three-lane gravity flow rack beside its loader that holds nine parcels. The spirals end in the bays, and so does the shipping belt (at the OUT 2 bay, a flow rack that comes with that upgrade now). The loader only ever takes from its bay, one parcel every second and a bit, while a truck of its lane is docked with the door up, and a bay never stops a belt waiting for a truck. A parcel in a bay can be taken by hand.

**Three more halls** (shop, from level 7, each needing the one before)
- Hall 2 stands east of the production wing with two rack rows of seven bays. Hall 3 stands west of it with two rows of five and a third inbound dock, IN 3, on its west wall, so a third truck a day docks straight into the new rows. Hall 4 sits behind the wing, reached through the wing's north wall. Each has its floor, roof, skylights, high bays and a doorway cut into the wall it opens off, shuttered until bought. The new rows are storage for the forklift, the AGV, the receivers and the pickers; the cranes stay over the main rows, and the main rows fill first. The silo moves out of Hall 3's footprint when the hall is bought.

**Tiers on what you own**
- Powered pallet truck (both jacks at full speed loaded), high-lift stacker (the jacks reach the second rack level and pull pallets out of it), AGV fast drive and AGV floor sweep (it fetches any pallet on the hall floor, clear of you and the crew's claims), plant tune-up (every dial to 300%, pack line jams halved) and the plant automation suite (the pack line never jams and starts any order the bench can complete by itself; an AUTO switch sits on the bench terminal).

**Staff options and the plant page**
- Per worker on both staff panels: a training course (walks a fifth faster, task steps a third sooner), a raise (10% more an hour and on time for good), a shift pattern (day 08:00 to 18:00, early 06:00 to 16:00, late 12:00 to 22:00, two hours more on overtime) and a second role they cover when their own queue is empty. From level 7 the crew grows from five to eight.
- A Plant page on the office PC and a Plant tab on the panel list every machine with its status, its dial and the button it has on its own screen. The inbound dock consoles sign the delivery note for a docked truck.

**Also**
- The order board turns pages of seven, a wheel turn holds a page for a while, and every row carries its lane chip. A strip of clerestory windows runs along the top of the walls.
- Pulling the last boxes out of a rack slot takes the wooden pallet with it. A refused delivery costs reputation by the pallet. A late order costs one point, a cancelled one three.
- The boot-time parcel check knows every place a parcel can be, the bays included, so a launch never refills the bench. Jack 2's bay moves to the north wall once the deck stands. The wing's compressor moved beside the wing door to clear the way to Hall 4.

## 1.13.7 (2026-10-06)

A carried belt piece can be placed any way round: R walks the snap points near your aim, then the four free headings.

**Conveyors from parts**
- A carried piece took the single nearest snap point within two metres of your aim, and R did nothing while it was snapped, because the snap rewrote the heading every frame. Near a dock door or a busy junction that locked the piece onto the wrong anchor the wrong way round, with no way to turn it. R now walks every snap point near the aim, nearest first (the prompt says which of how many), then the four free headings with the piece following your aim, then back to the first snap. The catalogue help says so.

## 1.13.6 (2026-10-06)

Launching the game no longer refills the bench and reopens shipped orders, parcels sit on the shipping belt again, and the bench, the parcel shelf and the cart hold more.

**Fixes**
- At every launch the game reopened every packed order whose parcel it could not find and put the order's boxes back on the bench, with no cap. The lookup did not know a parcel can ride a belt, sit on the cart or wait at the pack line's outlet, so a save with nine parcels queueing on the shipping belt reopened all nine orders and grew a tower of 73 boxes on a 16-box bench. The lookup covers those places now, and a loaded order (on a truck that may already have left) is never reopened.
- Parcels on the shipping belt's long leg floated 0.7 m beside the belt since 1.13.1: that release moved the leg toward the wall in the belt's model but the belt registry kept its own copy of the old path, so the items still followed the old centreline. One path now.
- Boxes and parcels stranded on a belt piece that no longer exists (a removal that crashed before 1.13.5 left them) are set down on the receiving floor when the save loads.

**Room**
- The packing bench holds 24 boxes (three layers) instead of 16. The parcel shelf holds 12 instead of 8, four more stacked on its back rows.
- The picking cart is 1.7 m long with three shelves of four: twelve boxes or parcels instead of six.

## 1.13.5 (2026-10-06)

Removing a belt piece with items on it no longer crashes the game, and a piece you are carrying is not a belt yet.

**Conveyors from parts**
- Removing a bought belt piece that had boxes or parcels riding it crashed the game: the piece's record was dropped before the items were set down, so setting them down asked a prop that no longer existed where it stood. The items are set down first now (at your feet if the record is already gone), and a removed piece is also struck from the belt registry, which closes a second way the moulding line's outlet lookup could trip over it.
- A piece you are carrying in build mode takes nothing and moves nothing. Feeders used to load it while you walked it past them. The inbound dock door and the parcel shelf now take a box or a parcel off the pallet or the shelf only once it is actually on the belt, so a refused push loses nothing.

## 1.13.4 (2026-10-06)

The crew works the morning after a clock-out.

**The crew**
- A worker who clocked out the night before clocked in the next morning and then stood at the time clock all day. The flag that marks them as leaving was set at every shift end since 1.4.0 and never cleared, and the morning work gate read it. It never showed before 1.13.3 because the crew could not finish a clock-out at all (they bounced in the lobby doorway); once they could, the next morning exposed it. The gate now reads the clock: on the clock and inside the shift. The flag is cleared on each new day. Saves heal on load.

## 1.13.3 (2026-10-06)

Rack row A is gone and the receiving side is open floor, nobody stands in the lobby doorway all evening any more, and the receiver leaves his jack behind when he is off the floor.

**The hall**
- Five rack rows instead of six: the old row A at z -17.5 is removed and rows B to F are now A to E, so the receiving side between the inbound docks and the north wall is open floor. Saves migrate on first load: slot contents, crane states and any moved rack shift down one row, the stock of the old row A goes into free slots of the rows kept (what does not fit goes onto floor pallets along the old row for the forklift driver), and a sixth row owned is refunded.
- The pick belts follow: rows A to C feed the south belt, D and E the north one. The office PC's upgrade list reads row ownership the same way the menu does; it only knew rows three and four.

**The crew**
- The walk to the clock at the end of a shift was planned again every tick. A re-plan from a cell the nav grid counts as blocked, a door jamb the walker had just clipped, sends them one step back out and the next step takes them back in; two receivers stood in the lobby door from 18:00 to past 21:00 in a 1.13.2 save. The walk is planned once, and a straight run between waypoints may no longer cut the corner of a blocked cell.
- The receiver parks the pallet jack where he stands when he heads for a break, the clock or home, and it stays in the hall overnight. When work starts he walks back to it before anything else. A pallet still on the jack at the end of the shift is set down where the jack stands rather than going home with him.

## 1.13.2 (2026-10-06)

The driver sits on the seat with his hands on the wheel, nobody walks through the pick belt legs any more, and the cranes and the pickers stop fetching the same box.

**The crew**
- The forklift driver sits on the seat: hips on the cushion, back to the backrest, feet on the plate, hands on the wheel rim. The figure rig writes its base height every frame and the staff tick never set one, so every staff figure sat at floor height inside the truck, with the arms up in the air where the wheel is not.
- The gatehouse guards stand on the gatehouse floor for the same reason; they floated a metre above it.
- The cranes and the pickers read one ledger of what is already on its way to the bench: boxes on the pick belts and the merge, a crane's grab, a picker's carried box, and a picker's claim while walking to the slot. The crane used to ignore a walking picker and the picker ignored the belts and the cranes, so the same box got fetched twice.

**The hall**
- The two pick belts hang from the roof end to end, like the merge run. They stood on floor legs every 1.5 m right at the rack ends, where every route turns the corner, and a leg under a high belt had no collision at all, so staff walked straight through the poles. Any future high belt with legs gets a floor solid under each leg.

## 1.13.1 (2026-10-06)

The pack terminal on its own stand, room round the bench, a bench top you can read, and a receiver who holds the jack.

**The bench terminal**
- The terminal is off the bench. It stands on its own floor stand at the near east corner, a 0.9 m screen at head height turned to face you along the working side, drawn at three times the old resolution. The old arm over the bench top, where two layers of boxes hid it, is gone.
- Looking at a screen now always focuses the screen, never the hit box of the thing it belongs to. The bench used to take the prompt from its own terminal.

**Room round the bench**
- The pick merge belt hangs high until its last 1.6 m and comes down 0.6 m further from the bench, so the working side is open from end to end and straight on past the bench end.
- The shipping belt's long run sits against the east wall, 0.7 m further out than before: the slot between the bench and the belt is 1.7 m instead of 1.0 m. It still ends at the OUT 2 loader.
- The damaged-goods bin and the broom moved to the west side of the merge belt's foot; the fire extinguisher moved up the wall past the belt's start.

**The bench top**
- The kit sits at the two ends where the box stacks never cover it: a platform scale with its readout turned to you, a tape gun and spare rolls, a parts tray with the cutter, a marker and a roll of labels, the label printer at the corner, a roll of bubble wrap on brackets at the far end, and flat cardboard on the shelf below.

**The receiver's jack**
- With a pallet on: the jack is pushed ahead with the tiller lowered and both hands on the grip, and the pallet rides on its forks.
- Empty and walking: towed behind on one trailing arm. Standing: parked behind them with the tiller sprung up. The handle used to pass through the body and float in front of the chest.

**Fixes**
- The terminal could read "NaN / 16 on the bench" after a short pack: taking a box of a kind the bench never held turned the count into NaN.
- A receiver's jack no longer stays visible at the ramp after they have gone home.

## 1.13.0 (2026-10-05)

The look, the crew and the lines, all at once: Depot Co. gets the pass Grow Co. had.

**The look**
- People are rigged properly: eased limbs with knees and elbows, shoes with soles and laces, a shirt with a collar, buttons, a pocket and a belt, hair with a fringe, sideburns and a nape (or long, or a bun), a modelled nose and ears, and a 256 px face that blinks and looks at you. Hats sit on the brows. Drivers, guards and staff all use it.
- Every box in the game has its edges eased on all twelve edges (the old bevel did eight), and every cylinder has eased rims and enough sides to read as round.
- The hall is lined: a painted blockwork dado to 2.4 m under a steel capping, I-section columns every 8 m with bump guards, two girts above the openings, a cable tray round every wall.
- The rooms have their own floors: carpet tiles in the office, vinyl in the lobby and the break room, skirting on the plaster walls, recessed troffers, and a bin by the desk.
- Lighting: a light budget keeps the nearest sixteen lamps live so a lamp can go wherever one belongs. The high bays are real fixtures (conduit, ballast box, spun reflector, lens) over warmer, pooled light, and they flicker up over a couple of seconds when the power comes on. The dock beacons throw real amber on the apron while a truck is on its way. The bench has a task lamp and the desk a desk lamp. The three rooms' lamps hang in their rooms again (they had been left in the open hall when the hall grew). Yard lamps, dock shelters and the gatehouses light the yard at night.
- The shadow map follows what moves: redrawn four times a second, at once when a door or a prop moves, and every frame while the forklift, a truck or the AGV is moving near you. It used to redraw every four seconds.
- Signs on the house slate are enamelled plates: shaded, with a hairline inset, stood off the wall on four studs. Posters sit on a white mount behind a sheet of glass. The painted name on the north wall stays paint.
- Rain is a thin grey streak, not a white blob.
- The yard: tyre marks and oil at the aprons, pallets stacked by the inbound docks, a skip by the dumpster, a drop trailer on its legs at the far side, weeds along every fence line. The fence panels stood across their runs; they run with them now.

**Orders and the bench**
- An order only asks for stock that is on site (racks, bench, floor, cart, and the pallets on a signed truck) and not already claimed by another open order. Two orders can no longer want the same six tins when you hold four, and a pick is never surplus the moment it is made. The first order waits for stock.
- The bench has no menu. A box on the bench is a thing you look at: E takes it back into your hand, or onto the cart. The prompt says whether an open order wants it.
- The cart at the bench: E unloads only the boxes the open orders still want and, in the same press, loads the bench's surplus onto the cart to go back on the racks.
- A picker with nothing to pick walks surplus boxes back to the racks, one at a time.
- The scanner's orders page ends with one pick list for every open order together, less what the bench holds, and the surplus count.

**Conveyors from parts**
- The catalogue (C in build mode) has a Conveyors group: 2 m and 4 m straights, quarter-turn curves left and right, inclines up and down a metre, and a 4 m high run hung from the roof. A carried piece snaps to the nearest free belt end, machine outlet, parcel shelf or inbound dock door (its start goes there), or to the nearest free belt start, machine inlet, outbound dock door or rack bay (its end goes there), turning and climbing to match. Dropped, it says what it takes from and what it feeds. Removing a piece sets what rode it on the floor.
- Everything is ready for a belt: the bench takes boxes from any side, a rack bay takes boxes off a belt that ends at it, an outbound door with a truck in takes parcels off a belt that ends at it, an inbound door with a signed truck in feeds boxes off its pallets onto a belt that starts at it, and the parcel shelf feeds any belt laid at its take-off. The pack line's outfeed drops to the shelf and never onto a belt.

**The crew**
- A forklift driver (level 5, needs the forklift, $95 a day): puts the pallets left on the hall floor away on any level, the top shelf included, and parks the forklift back in its bay. Keeps clear of the AGV's square, the wrapper, and you. You cannot take the forklift while they are on it; they do not take it while you are next to it.
- A receiver has a pallet jack of their own, pushed under the pallet while they carry one and towed behind them the rest of the time.

## 1.12.19 (2026-10-04)

- A drop marker: while you hold a box or a parcel, a translucent ghost of it with a ring on the floor shows exactly where G will set it down. Green on good floor, red where it would land at your feet instead. It hides on the forklift, in build mode and at the PC.

## 1.12.18 (2026-10-04)

- The picking cart carries parcels. E with the cart at the parcel shelf loads a parcel, E in a docked outbound trailer unloads every parcel aboard at once, and G at the parked cart moves a parcel between the cart and your hands. Boxes and parcels share the cart's six places; the HUD and prompts show both.

## 1.12.17 (2026-10-04)

- The installer puts a Depot Co shortcut on the Desktop on every install, not only the first one (createDesktopShortcut: always).
- G at the parked picking cart takes the top box into your hand; with a box in hand, G puts it on the cart.
- Test runner: the test tick refreshes world matrices so raycasts see props where the tick put them.

## 1.12.16 (2026-10-03)

- The picking cart unloads onto pallets. E with the cart at a pallet puts every box of the pallet's line from the cart onto it, up to twelve; at an empty pallet it unloads the line it carries most of. With nothing matching aboard the cart picks from the pallet as before.

## 1.12.15 (2026-10-03)

- Empty pallets come off the stack: with an empty jack, E on the empty pallet stack takes one. Set it down and loose boxes of one line go on it by hand; the pallet then stores on a rack like any other, and a racked empty pallet takes boxes by hand and adopts their line.
- The bin by the bench writes off a whole pallet load brought on the jack, at half value per box, leaving the pallet empty.
- Fixed: lifting a floor or truck pallet with jack 2 put it on jack 1, and stacking an empty from jack 2 cleared jack 1.

## 1.12.14 (2026-10-03)

- The two overhead pick belts meet above the east lane and feed one merge belt, which ramps down to bench height at the north-west corner of the packing bench. Picked boxes arrive in a single stream at one spot.

## 1.12.13 (2026-10-03)

- The hall is 72 x 48 m: the east and west walls moved out 6 m each. Everything that stood against them follows: docks, consoles, dock loader and shipping belt, bench and pack line, AGV dock, jack bays, stage squares, office, lobby and break room. The racks, cranes and pick belts stay where they were, so the east lane is now about 7 m clear between the crane columns and the bench, and the west lane about 9 m between the columns and the wall.
- The pick belts cross the east lane overhead, hung from the roof on rods instead of standing on legs, and ramp down beside the bench to two inlets. Nothing of theirs stands in the drive lane.
- Twelve hall lights instead of nine, so the new strips are lit.
- Saves migrate once: layout moves, bought props, floor pallets, staff and tools follow the walls; docked trucks are sent away.
- Test suite: a check that the east lane at x 25.5 and the west lane at x -27.5 are clear for the forklift along the full rack length. A drive map tool (tools/drivemap.js) prints where the forklift can stand.

## 1.12.12 (2026-10-03)

- Crane and AGV screens take E again. The cabinet interaction box reached past the screen, so looking at a button focused the cabinet instead. A touchscreen now wins over any hit box within half a metre, and the crane and AGV cabinets use a box the size of the cabinet.
- The crane lamp stacks stand on the cabinet top instead of floating 10 cm above it.

## 1.12.11 (2026-10-03)

- Speed dials on every machine screen, 50 to 200 percent per machine: cranes, AGV, pack line, moulding line, baler, wrapper. Belts are set from the screen of the machine they feed (pick belts on the crane screens, the main belt on the palletiser, the shipping belt on the dock loader). A fast pack line jams more often.
- The crane control cabinets hang off the end columns again. 1.12.9 moved the columns inward and left the cabinets, screens, e-stops and lamps standing where the old columns were.
- The palletiser moved 1.1 m north, clear of row A after the row shift.

## 1.12.10 (2026-10-03)

- The rack rows moved one metre south (-17.5 to 15.5, still 6.6 m apart): 1.12.9 had left row F and its crane column 1.2 m from the office front. That corner is now 2.1 m clear, and row A still clears the break room. The suite checks both clearances.

## 1.12.9 (2026-10-03)

- Wider aisles: the rack rows sit 6.6 m apart instead of 6, and every crane column stands tight against the rack face on an outrigger, so the narrowest aisle is 4.8 m clear with all cranes up (it was 2.8 m at the row ends). The pick belts follow the rows.
- Two pallet jacks: jack 1 parks by the IN docks, jack 2 by the OUT docks. Each carries its own pallet. A jack left in the old bay moves on load.
- The AGV goes straight from a put-away to the next waiting pallet, and turns round on its way home if one appears. It only returns to the dock when there is nothing to fetch.
- The AGV dock cabinet carries a touchscreen with PAUSE/RESUME and DROP LOAD.
- The bench terminal scrolls: the mouse wheel or UP/DOWN buttons page through every open order.

## 1.12.8 (2026-10-03)

- The jack and cart bays moved to the west wall between rows D and E: a crane column stood in the old jack bay at the end of row D. Tools still parked in the old bays follow on load.
- Test suite: the row B crane check owns its only coffee stock, the AGV check accepts a second put-away in its window, and a new check keeps both tool bays clear of every solid with all six cranes up.

## 1.12.7 (2026-10-03)

- Every crane cabinet carries a touchscreen: status, what it is picking, where the trolley and hook are, what its row holds, how many boxes ride its belt, with PAUSE/RESUME and RESET JOB buttons. First of a round of interactive panels across the warehouse.

## 1.12.6 (2026-10-03)

- The gantry picker upgrade now puts a crane over every rack row you own, each with its own trolley, and buying a new row adds its crane. Rows A to D drop on the south pick belt, rows E and F on a north one; both end at the bench. Saves with three or four rows get exactly that many cranes and no north belt.
- Boxes and parcels riding any belt can be lifted off by hand, including the overhead pick belt.
- The east crane columns stand clear of the pick belt.

## 1.12.5 (2026-10-03)

- Drivers walked on the spot beside the cab since 1.12.2: a comment had swallowed the line that moves them along the route. They walk again, and the test suite now checks that a driver actually arrives.

## 1.12.4 (2026-10-03)

- An idle AGV that is not on its dock drives back to it, so a moved dock (or a save from before the move) no longer leaves it parked in the open.

## 1.12.3 (2026-10-03)

- The rack block sits 1.5 m further west: fifteen bays still, but the packing side of the hall is 9 m wide now instead of 7.5. The AGV dock and the gantry end moved with it.

## 1.12.2 (2026-10-03)

- Belts rebuilt: channel side frames with a painted lip, rollers under the bed and end drums, the return run underneath, guide rails on brackets instead of floating bars, a motor and gearbox hung off the drive drum, braced legs on levelling feet, photo-eye and reflector, a cable run.
- The dock loader rebuilt as a telescopic boom conveyor: a heavy base with its own belt section, a lifting frame with pivot and hydraulic cylinder, the boom with rollers, side guards, lip roller and bump bar, a canopy lamp, a light curtain at the door and an operator pedestal.
- The pack line taper rebuilt: a body on four legs with louvred side panels, service doors, a top housing with a window onto the tape head, a parcel exit flap, a nameplate, a cabinet on a pedestal with trunking back to the machine; the gravity shelf stands on a framed base.
- The PACKING sign is its own wall sign, so the bench can go anywhere while the sign stays on the wall.
- The office PC scrolls its lists with the mouse wheel.
- Outbound drivers wait on the dock landing instead of walking in; they have nothing to sign, and the inside spot is where the dock loader stands.

## 1.12.1 (2026-10-03)

- The dock consoles showed a black screen: the bezel plate from the polish sweep sat in the same plane as the screen and covered it. The bezel sits behind the screen now, on the consoles and the time clock.

## 1.12.0 (2026-10-03)

- You can jump over a belt: the jump is a little higher and a belt's collision box stops at its top surface.
- The OUT 2 dock console sits on the far side of its door, clear of the loader.
- A third automation upgrade: the gantry picker over row A (level 5, $5,000), a crane on two rails that watches the open orders, picks the boxes the bench still needs out of row A and sends them down the pick belt to the bench. With the pack line, the shipping belt and the dock loader, an order can go pick, pack, ship without a hand on it.
- The shipping belt runs straight down the east wall to a single dock loader at OUT 2, a full machine with a roller boom, light curtain and cabinet. OUT 1 stays a manual dock, so the morning truck is loaded by hand and the afternoon one by machine.
- Two automation upgrades in the shop. The shipping belt and dock loader (level 3, $1,800): parcels roll off the pack line shelf onto a belt down the east wall to OUT 1, where a dock loader with a telescopic boom pushes them into any docked truck with its door up. The AGV pallet mover (level 4, $3,200): a driverless truck that collects any pallet set on its pickup square by receiving, or dropped by the palletiser, puts it away on the racks and returns to its dock. Both stop in a power cut.
- The forklift lifts an empty pallet out of a rack slot. Wrap film follows a wrapped pallet onto the rack and back off it; taking a box by hand cuts the film.
- Polish: the break room chairs and table, the cot, the vending machine, the office desk, chair and filing cabinets, the time clock, the dock consoles and the breaker panel are rebuilt with bevelled bodies, proper frames and the small parts that make them read as the real thing.

## 1.11.1 (2026-10-03)

- Empty pallets exist everywhere now, not only at the hopper: the last box off a pallet leaves the empty pallet where it was (in the trailer or on the floor), a rack slot emptied of a pallet's boxes keeps the empty pallet, the jack lifts them, and the empties stack takes them (E with one on the jack). The receiver ignores them and a truck takes its own empties back without a penalty.
- More signs are props, so build mode moves them: STAFF, the big DEPOT CO. front sign, OFFICE, LOBBY, BREAK ROOM and both EXIT signs.

## 1.11.0 (2026-10-03)

- The clock runs at one game hour per 75 real seconds, half the old rate: a sixteen-hour day is twenty minutes. The big hall needs the walking time.
- An inbound truck waits four hours instead of three before it leaves with what you did not unload (first truck 07:30 to 11:30, second 13:30 to 17:30), and the driver walks in faster.
- Trailer rear doors hang on hinges: open flat against the sides while docked, closed across the back when the truck arrives and leaves.

## 1.10.8 (2026-10-03)

- A pallet on the jack can be set down on open floor: E with nothing in the crosshair lowers the forks and leaves it where the jack stands. Before, it could only go into a rack slot. The held-item label says so.

## 1.10.7 (2026-10-02)

- A new game starts at 06:00. The main menu showed the hall at 10:30 and the clock stayed there when you started, so the 07:30 truck the intro promises had already been missed.
- Nine high bays on a 20 by 15 m grid light the whole hall; the six lights laid out for the old 40 by 28 hall left the big hall dark in the morning.
- The first-aid box in the lobby hung over the window; it is beside the door now.
- The world keeps ticking at 20 Hz while the browser tab is hidden (the pause menu still stops it when the pointer is released).

## 1.10.6 (2026-10-02)

- The stretch wrapper wraps a pallet set down on its turntable (by forklift or jack), not only one still on the jack.

## 1.10.5 (2026-10-02)

- A 0.6 m slot between the hall floor edge and a docked trailer bed dropped to yard level, so you fell in with the jack and the forklift refused the trailer. Every dock has a leveller plate now, with a hinged lip and a hazard edge, and the floor treats a docked trailer as reaching the wall.

## 1.10.4 (2026-10-02)

- The forklift dash display sits on a stalk on top of the cowl, in a bezel, facing the seat; it was tucked under the cowl behind the wheel and facing away.

## 1.10.3 (2026-10-02)

- The forklift battery cover under the seat was a metre cube; it is a 0.9 by 0.7 deck now, with a latch, and the seat sits at the same height.

## 1.10.2 (2026-10-02)

- The forklift could not reverse away from the wrapper (or anything else it had nosed up to with a load): the collision test treated every move inside an obstacle's padding as a hit. An obstacle the truck is already inside can no longer block it, so it always backs out.
- The forklift beacon lens and both tail lights were built without the forklift as parent, so an amber lens floated at the hall origin at 2.5 m whenever you drove and two red lights sat on the floor there. A nesting-aware scan of every builder finds no other orphans.
- The traffic mirror at the production doorway is mounted on a wall bracket above the door, in a ring, tilted down the doorway.
- The overhead guard roof is four round cross tubes with two runners and a round beacon base, instead of thin rods and a loose square plate.

## 1.10.1 (2026-10-02)

- A dock door loaded open looked shut until it was toggled twice, so its console said open while the roller was down. The pose is applied every frame now.
- Rain and snow no longer spawn under the hall or wing roof for a frame, which read as drizzle indoors.
- The jack's contact shadow is the size of the jack.

## 1.10.0 (2026-10-02)

- Forklift gears: Shift cycles creep, normal and fast while driving. Fast is half again quicker, drinks the battery and throws unwrapped loads on the corners. The gear shows in the driving HUD.
- The dash cluster screen was the last forklift part floating at the hall origin; it rides in the cab now.

## 1.9.6 (2026-10-02)

- Nine more forklift parts (the chequer floor plate, mast rails, crossbars, chains, headlamps and a hook) were built without the forklift as parent and sat at the hall origin, which is open floor in the big hall and in the main menu view. All of them ride on the forklift now.

## 1.9.5 (2026-10-02)

- Rain and snow stop at the production wing's roof instead of falling through it.

## 1.9.4 (2026-10-02)

- The moulder discharges through an opening in its rear platen frame onto the belt; parts no longer appear through a wall.
- Saves from the first big-hall build (hall generation 2) get their layout reset once more and any docked truck evicted; a truck inside the building is evicted on every load.
- Floor paint redrawn for the big hall: the pedestrian walkway runs the whole south strip from the lobby to the office, then up the east side and along the north wall to the production door; the exit sign hangs over the fire exit again.
- Signs are props now, so build mode moves them: the PRODUCTION and WAREHOUSE door signs, the PPE sign, and the RECEIVING, SHIPPING, FINISHED GOODS and RAW GRANULATE floor paint. The catalogue gains a spare wall sign and a floor arrow.
- The wing's machines rebuilt properly: the hopper is a day bin on braced square legs with a ring girder, a butterfly valve and rotary feeder under the cone, a supported vacuum loader pipe, a caged ladder with a top rail, a level cabinet on a bracket and a kerbed tip point; the dryer is a desiccant cabinet with a door, display and E-stop under its drying hopper, with blower, filter and hoses; the chiller is a full unit with louvred panels, guarded fans, a pump end and piping to the floor manifold; the palletiser has a heavy frame on a base plate with a mesh back guard and a carriage-mounted pusher; the case taper is a solid body with a tunnel through it.

## 1.9.3 (2026-10-02)

- The moulding line is a real injection moulding machine: two-tone base on levelling feet, injection unit with a loader hopper and a slotted heater cover, fixed and moving platens on four tie bars with nuts, toggle links and a rear platen with its cylinder, mould halves that open and close with the cycle, a sliding safety gate with a window, a swing-arm operator panel with the touchscreen and E-stop, a hydraulic power unit, a water manifold with hoses to the mould, a cable chain and an outfeed chute to the belt. The hopper's feed pipe lands in its throat.

## 1.9.2 (2026-10-02)

- Parts of the forklift cab (pedals, belt buckle, switches, brake knob) sat at the hall origin between rows C and D instead of in the cab; they are children of the forklift now.
- The production wing is dressed: a quality bench with a station screen and sample parts, a maintenance bench with a vice and shadow board, a tool cabinet, a mould store, a spares shelf, a chiller with twin fans, a granulate dryer, a 400 V switchboard with cable drops, a shift board, a clock and a first-aid box. Floor wear on the forklift route, oil under the moulder, a drain channel, hazard borders round the machines, a crossing at the doorway with bollards and a convex mirror, a PPE sign, light shafts under the skylights, grime at the wall feet, a finished-goods square beside the palletiser, and gutters, downpipes and roof vents outside.

## 1.9.1 (2026-10-02)

- The baler works: binned boxes and packing offcuts fill its chamber, ten units make a bale (E, or the BALE button on its screen), and outbound trucks take the bales away at $18 each. Rebuilt on the machine kit with a chamber door, ram, power pack, cabinet with screen, lamp stack and E-stop, and the finished bales stacked beside it.
- The stretch wrapper is on the machine registry too: status lamps, a screen, and a film roll good for twenty pallets that you replace on the screen for $30 instead of paying $2 a wrap.
- The north wall's pilasters stand clear of the belt opening and the wing doorway (one stood through the belt).
- The moving parts of the wing machines (platen, fan, feeder) are out of the static bake so they actually move.

## 1.9.0 (2026-10-02)

- **The production wing**, bolted onto the north wall behind a strip curtain: a hopper you tip pallets of raw granulate into, a moulding line that turns granulate into own-brand boxes (crates, storage bins, planters), and a main belt that carries them through the wall into the hall, where a palletiser stacks eight to a pallet and drops it beside itself. A silo stands outside. Order granulate on the office PC's new Production app; it comes with the next inbound truck. Clients start ordering your own goods once they have seen them.
- **Packing is machinery now.** Pick an order on the bench terminal and the pack line feeds its boxes onto the infeed belt, a case taper closes them into one parcel, and the outfeed drops it on a gravity shelf. It jams now and then; E clears it.
- **A machine framework** under it all: every machine has an inlet, an outlet and a status lamp stack; belts carry items and hand them to whatever their end touches, so the pieces still work when you move them in build mode and pile up at a gap when they do not. Belts stop in a power cut.

## 1.8.1 (2026-10-02)

- Rack rows sit 6 m apart, so each aisle is 4.8 m wide and the forklift can turn into a bay.
- Leaving build mode no longer leaves a copy of the hand-held gear frozen in the world: the bake skips anything riding on the camera or hidden.

## 1.8.0 (2026-10-02)

- The hall is 60 by 48 metres, up from 40 by 28, with an 8 m roof. A rack row holds fifteen bays, there are six rows to buy (A to F), the docks sit further apart, and the forklift has room to turn. The office, lobby and break room moved to the new corners with everything in them.
- Saves from the smaller hall load: their build-mode overrides are cleared so nothing is stranded mid-floor, the tools park at the new spots, any docked truck is sent away and the crew is pulled inside the new walls.

## 1.7.4 (2026-10-02)

- The driver waits on the landing until the dock door panel is actually up, not merely switched on, so he no longer walks through a rising door.
- The intro, the in-game guide, the player guide and the README no longer send you outside to sign: the driver comes to you.
- The jack, cart and steering wheel easing run on real time, so they feel the same at any frame rate.
- Dead builders removed; the smoke test checks that the door panel rises.

## 1.7.3 (2026-10-02)

- The pallet jack is a hand pallet truck again. It never had a battery, so the jack charger, its cable and the plug prompt were decoration with nothing behind them; they are gone.

## 1.7.2 (2026-10-02)

- Forklift tyres are solid cushion tyres with fine tread, sidewall rings and a dished rim with a bolt circle, not gears.
- The yard asphalt has two-tone aggregate, wear blotches, cracks and tar repair lines at walking scale, with manhole covers, gully grates along the plinth, a kerb and wheel stops in the car park, and weeds along the fence.
- The sky is a dome with a zenith-to-horizon gradient and a haze band, following the time of day and the weather.
- The truck driver comes inside: he walks along the trailer, climbs the new dock steps, comes through the dock door and stands inside beside it with the paperwork. If the door is shut he waits on the landing and says so.
- The perimeter is a V-mesh security fence: square posts on concrete footings, a concrete gravel board, rigid mesh panels with the V-folds pressed in, top and bottom rails, and cranked arms with three strands of barbed wire.
- The held jack and cart trail behind you with an eased heading, so looking round no longer whips them about.
- The neighbours have a brick base, cladding ribs, dock canopies with hazard fascias, roof vents, and trailers backed onto some doors.

## 1.7.1 (2026-10-02)

- The forklift cab, done properly: a contoured seat on a suspension with bolsters, headrest and belt, armrests, a bank of three hydraulic levers with a label plate, the column with a shroud, a wheel with spokes and a spinner knob that turns with the steering, a direction lever, a moulded dash with the cluster, key switch, horn and a rocker, pedals and a parking brake. The driving camera sits at the operator's eyes with the wheel and dash in frame.
- Props redone: low-poly trees with jittered canopies in three greens and real limbs, parked cars with rounded bodies, tinted glass, wheel arches, rims, lights and plates, potted plants with leaves on stems in a thrown pot, a bean-to-cup coffee machine with a group head, portafilter, steam wand and drip tray.
- People: rounder torsos with shoulders and chest, vests with reflective bands, boots.
- The lobby, break room and office have painted plasterboard linings with skirting and a dado rail instead of bare cladding inside.
- The light shafts are narrow faded beams under the skylights, not two walls of haze across the hall.
- The empty pallet stack has a floor box and a post sign; the hazard bar in the air is gone.
- The smoking shelter is a real shelter: steel frame, solid roof, glazed back and side, slatted bench, column ashtray. The coffee counter has doors, a worktop, a sink and tap; the fridge and water cooler are remodelled.

## 1.7.0 (2026-10-02)

The look.

- Every surface has a normal map and most a roughness map, all generated: concrete with its slab joints and water marks, corrugated steel with ridges and rivets, roller-door ribs, asphalt, plaster, brick, wood grain, cardboard flaps and labels, chequer plate, rubber matting. Light catches texture now instead of flat colour.
- Painted machines (the forklift, the truck cabs) are clearcoated with scuffed roughness; metals reflect more of the studio.
- Contact shadows: a soft dark blob under every prop, vehicle, truck and person.
- Grime: a dark band at the foot of every wall, tyre scuffs at the dock aprons and in the aisles, oil where machines stand. Light shafts under the skylights with dust drifting in them, fading with the weather.
- The forklift remodelled again: rounded shells, treaded tyres with bolted rims, an I-section mast with chains and hydraulic hoses, a proper seat and column, a dashboard with gauges, the overhead guard as one bent tube, decals and plates.
- Trucks: wheel arches over every axle, mud flaps, marker lights along the trailer, wipers, a sun visor, air horns, dirt on the lower panels.
- A film post pass: a touch of chromatic spread at the edges, saturation and contrast grading, a vignette, grain heavier in the shadows. Off in Settings or on Low quality.

## 1.6.1 (2026-10-02)

- Charging is a thing you do: take the cable off the charging point, walk it to the forklift and press E to plug in. It charges only while plugged, driving off pulls the plug, and the cable hangs between the reel and the plug. The jack has its own small charger at its bay on the west wall. The charger display shows the state.
- Boxes on the packing bench no longer sit inside the terminal: the grid starts past it. Boxes, parcels and the crew follow the bench when it is turned in build mode.

## 1.6.0 (2026-10-02)

From Tyson's issues list.

- The guided intro follows the real flow: clock in, open IN 1, sign with the driver, unload, rack, scanner, order, pick, bench, pack, load, dispatch.
- Outside, nothing floats: props stand on the ground under them, the gate guard on the booth floor.
- Reset save works: the autosave on the way out of the page was writing the save straight back.
- The jack's tiller leans back over the pump. The empties are a stack of real pallets. The baler is a vertical baler with its loading door, bale door, ram and control box. The bench terminal stands on the bench. The order board hangs from the roof in front of the office instead of sitting on the window. Lockers and the coat stand remodelled. A proper charging point with cable reels, two plugs and the bay.
- The break room moved to the north-west corner above IN 1, with a door onto the hall and a window. The staff door opens into an entrance lobby with the time clock, lockers, hooks, notices and a bench seat.
- A dev console on F8: money, levels, the clock, weather, trucks, orders, stock, crew, teleports.

## 1.5.1 (2026-10-02)

- Consoles beside IN 1 and IN 2 as well: the door button, the docked truck, how many pallets are still on it, and whether the note is signed. The inbound docks had no panel after the button boxes went.

## 1.5.0 (2026-10-02)

- The office PC is a real screen. E at the desk sits you down in front of the monitor; its apps (desktop, orders, contracts, shop, staff, bank, stock, stats) are drawn on the screen and tapped with the crosshair. Esc or WASD stands up.
- The little push-button boxes beside the dock doors are gone: the control cabinet and the dock consoles do that now. A pull cord inside each door brings it down without the walk.

## 1.4.0 (2026-10-02)

- The time clock is a system. The crew walk in from the yard through the staff door, clock in at the reader, work, clock out at the end of the shift and leave the same way. Pay at 06:00 is the hours on the clock at the hourly rate, time and a half past ten. Each has a punctuality trait: some are early, some drift in late, and a word on the clock screen puts them right for a while. Overtime till 20:00, a day off tomorrow, and the odd sick call. Your own card too: clock in and out for a shift report and tracked hours. A timesheet page, and the crew on the office PC and the scanner.
- Everything moves in build mode: the rack rows (stock comes with them), the control cabinet, the time clock, the dock consoles, the breaker, the order board, the forklift charger and its bay, the aisle signs, the painted name, the lamp posts, the parked cars and every tree, on top of the furniture and machines. Lamp posts, cars and aisle signs can be bought.
- The yard lamp posts are out of the truck lanes.

## 1.3.0 (2026-10-02)

- Build mode, the same editor as Grow Co.: F2, then E grabs any prop and it follows your aim, R turns it a quarter, E puts it down, Esc drops it back, Backspace puts it back where it started, Del removes it. C opens the catalogue: removed pieces to bring back and extras to buy (chairs, tables, lockers, plants, coolers, cots, cabinets, bins, signs, bollards, extinguishers, clocks, notice boards, every poster, trees, bench seats, shelters, dumpsters). Bought extras sell back for half. The layout saves when you leave build mode; the bake comes apart for it and goes back together after.
- Fifty props across the break room, the office, the hall and the yard are movable: furniture, machines, the packing bench with its terminal, posters, clocks, extinguishers, the hose reel, the notice board, the flag, the shelter, the dumpster.
- The break room laid out properly: the way from the staff door to the hall stays clear, the cot is on the far wall, lockers and hooks by the door, the coffee counter, fridge and cooler on the north wall, the table out of the walkway.
- The main menu renders again after Quit (its body was never drawn when the splash was skipped).

## 1.2.0 (2026-10-02)

- The dock consoles and a new bench terminal are in-world touch screens: dispatch, open the door, pack an order by looking at the button and pressing E.
- Damaged goods: a box dropped mid-air or shed off the forklift may be damaged; it cannot be racked or packed and goes in the red bin by the bench at half its value.
- Client contracts from level 3: a run of orders on time inside three days for a bonus, a penalty for missing it.
- The bank: a $5,000 loan at 1.5% a day, and theft insurance at $40 a day that pays 80% of night losses.
- Sunday is really closed: no trucks and no orders.
- Pigeons on the trusses that take off when you walk under them.
- A props sweep: a real A-frame wet-floor sign, a wheelie bin for damaged goods, a broom with bristles, the stretch wrap as film with bands, the cot framed with a pillow and blanket, chairs with backs, the coffee machine with a drip tray and cup, the vending machine with glass and a coin panel, extinguishers with hoses and gauges, lockers with vents and numbers, the fridge handle, water-cooler taps, the office desk with drawers, keys, mouse and phone, a five-star chair, cabinet handles, poster frames, a coiled hose reel, a label printer and stool at the bench, pinned notes, dock door rails and chain hoists; outside, car bumpers and plates, a dumpster lid and wheels, a slatted bench and ashtray in the shelter, fence footings.

## 1.1.0 (2026-10-02)

The depth pass, built the same day after a playtest against Grow Co.

- Visuals: bevelled geometry, a baked reflection studio, far richer textures (water-marked concrete, rusted corrugated steel, labelled cardboard), eight safety posters, rooms with tile ceilings, racks with bracing, base plates and mesh decks.
- The hall is dressed: pilasters, cable trays, sprinkler mains, extractor fans, fire points, hose reel, first-aid box, aisle signs, rack end guards and load labels, dock lights that flash when a truck is docking, empties, a baler, a stretch wrapper, bins, a wet-floor sign, a time clock, coat hooks, a vending machine, a fridge, a radio, wall clocks with live hands, a calendar, an office whiteboard with live KPIs.
- Walls: the break room is a real room now, with a window and a door. Four hinged doors that open, close and lock; staff carry keys. A control cabinet with a touch screen for lights, docks and night mode.
- Machinery remodelled: pallet jack, picking cart, forklift (overhead guard, mast, carriage, beacon, number plate), trucks (lined trailers, ribs, mudguards, proper wheels, lit cabs, haulier signs).
- People: a jointed rig with procedural faces that blink and look at you, varied skin, hair and clothes, name tags, hard hats, carrying poses, speech bubbles, a voice per name, lunch breaks. Drivers climb out and need the delivery note signed. Gate guards in the booths.
- The yard: dock shelters, truck lanes with hatched aprons, a mesh fence with barrier gates that lift for trucks, gatehouses, a car park with cars, a smoking shelter, a dumpster, a flag, trees, neighbour facades, a road with traffic, sun and moon, drifting clouds.
- Weather and seasons: clear, overcast, rain with streaks and puddles, storms with lightning and thunder, snow that settles. Rain ambience. Sunday closed.
- A radio with three synthesized stations. A forklift battery with a charger. The stretch wrapper. A vending machine.
- The scanner is a handheld device with a live display, raised on Tab.
- Staff route on a grid pathfinder instead of walking through walls.
- A static-geometry bake brings the hall from about 1700 draws to under 500.
- A splash with motion and a main menu over the live hall.

## 1.0.0 (2026-10-02)

First release, built in one sitting as a sibling of Grow Co.

- A 40 by 28 metre hall with four rack rows, four dock bays, an office, a packing bench and a break room, on a dock above a yard with trucks that back in on a timetable.
- Receiving by hand, with the pallet jack, or with the forklift; put-away to 96 rack slots across three levels.
- Orders from six clients across twelve product lines in four tiers, with rush orders, short shipments and late penalties.
- The hand scanner (Tab), the office PC with six apps, the wall order board.
- Three staff roles with their own aisle routing.
- Power cuts, the safety inspector, the night prowler, coffee, sleep.
- Levels, reputation, the guided intro, three save slots, save export and import.
- A headless smoke test that plays a day through the real game.
