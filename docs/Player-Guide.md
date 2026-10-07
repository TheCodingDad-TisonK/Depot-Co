# Player guide

## The building

The staff door on the west wall opens into the entrance lobby: the time clock, lockers, coat hooks and the notice board. Through the lobby door is the hall, 72 by 48 metres: five rack rows of fifteen bays with open floor on the receiving side, the docks on the west (IN) and east (OUT) walls, the pack line by the office. The break room is the north-west corner (cot, coffee, vending machine, radio), the office the south-east corner. Through the strip curtain in the north wall is the production wing, with its hopper, moulding line and the belt to the palletiser. `F8` opens a dev console for testing.

## Your first day

You clock in at 06:00 with $600, two rack rows and two pallet jacks. The intro in the bottom-left corner walks you through the first day; this is the same thing in full.

1. **07:30, the first truck.** Walk to dock **IN 1** on the west wall and open the door: `E` on the door itself or on the green button beside it. The truck backs in and the driver waits. It leaves at 11:30 whether you have emptied it or not, and anything still on it goes back unpaid.
2. **Unload.** Walk into the trailer. `E` on a pallet takes one box; carry it to a rack and `E` on a slot puts it there. Or grab the pallet jack from the receiving square, `E` on a pallet lifts the whole thing, and `E` on a floor-level slot sets it in. You are paid $12 the moment a pallet is touched.
3. **The racks.** A slot holds up to twelve boxes of one line. Floor and shelf levels are hand-reachable. The top level needs the forklift. The scanner (`Tab`, page 4, Putaway) suggests a slot for every pallet.
4. **The scanner.** `Tab` raises it. Nine pages on the number keys: Home with the day and the alerts, Orders with every line and the slot to pick it from (and the returns in play), Picks (one list for every open order, in walking order), Putaway (what is on the docked trucks and where each pallet should go), Stock, Docks (every door, its lane, its truck and its shipping bay), Plant (every machine, jams first), Crew, and the Map: the whole site from above, with you, the crew, the forklift, the trucks and your waypoint on it. The wheel moves the cursor down the page; `F` sets a waypoint on the highlighted row, a green ring and beam on the floor with the heading and the distance on the HUD, and it clears itself when you get there (`X` clears it sooner). Point the beam at a rack slot, a pallet, a box, a parcel, a truck or a machine and the bottom of the display reads it.
5. **08:30, the first order.** It shows on the office PC, the wall board above the office, and the scanner (page 2, Orders), with the lines, the due time and the pay. The due time is the departure of an outbound truck.
6. **Pick.** Walk to the slot the scanner names and `E` takes a box. Carry it to the **packing bench** on the east side and `E` puts it down. One box per trip until you buy the cart.
7. **Pack.** The terminal at the end of the bench lists the orders. Pick one and release it to the pack line: its boxes ride the infeed belt into the case taper, and the parcel rolls down the outfeed onto the gravity shelf at the end of the line. An order with at least half its boxes can be released short for 60% of the pay.
8. **Ship.** Look at the board: every order wears its lane. **SEA** orders leave by OUT 1 (trucks 10:30 to 12:00 and 17:00 to 18:30), **LAND** orders by OUT 2 (09:00 to 10:30 and 16:00 to 18:00), **AIR** orders by OUT 3 once the sortation deck opens it (13:00 to 14:30 and 19:00 to 20:15). An order is due at the next truck of its own lane. Open that dock, pick the parcel up, walk into the trailer and `E` loads it. The wrong door ships it too, for a 25% forwarding fee. `E` on the dock console sends the truck now; otherwise it leaves on time. You are paid when it goes.
9. **13:30, the second truck.** Same again. By 17:00 you can sleep on the cot in the break room, which skips to 06:00 and charges rent ($110) and wages.

## Doors, locks and the cabinet

The office, the break room, the staff entrance and the fire exit have doors. `E` opens or closes one, `Shift+E` locks or unlocks it. Staff carry keys, so a door swings open for them. The control cabinet beside the office door has a touch screen: hall lights, yard lights, every dock door, and **night mode**, which closes and locks everything at once. Leave a dock door open or a person door unlocked at 23:00 and stock goes missing.

## The pack line

Boxes go on the bench as before. Pick an order on the bench terminal and the line feeds its boxes onto the infeed belt; the case taper closes them into one parcel and the outfeed drops it onto the gravity shelf, where you or the packer pick it up for the truck. The line jams occasionally: `E` on it clears the jam. Nothing moves in a power cut.

## The production wing

Through the strip curtain in the north wall. Order pallets of raw granulate on the office PC (Production app, $120 a pallet); they come with the next inbound truck. Bring one on the jack to the hopper and press `E` to tip it in (40 units). Start the moulding line on its screen or with `E` and pick a product: Depot Co. crates, storage bins or planters. A box comes off every eight seconds and rides the main belt through the wall to the palletiser in the hall, which stacks eight to a pallet and drops the pallet beside it. Rack it like any delivery. Clients start ordering your own goods once they have seen them, at a better margin than anything a supplier sends.

## The baler and the wrapper

Every damaged box you bin and every order the pack line closes puts cardboard in the baler's chamber. At ten units, `E` on the baler (or BALE on its screen) presses a bale in eight seconds; outbound trucks take up to four bales away at $18 each. The stretch wrapper runs on a film roll good for twenty pallets; fit a new one on its screen for $30.

## Automation (shop)

Three upgrades, each a machine you can move in build mode. The **shipping belt and dock loader** (level 3) take parcels off the pack line shelf, down the east wall to OUT 2, and push them into a docked truck with its door up; OUT 1 stays manual, and a sea parcel on that belt pays the forwarding fee until the sortation deck takes over. The **AGV** (level 4) is a driverless pallet truck: set a pallet on its pickup square by receiving, or let the palletiser drop one, and it racks it and returns to its dock. The **gantry pickers** (level 5) put a crane on rails over every rack row you own, and a new row brings its own: each picks the boxes the bench still needs out of its row and sends them along the overhead pick belts, which merge above the east lane into one belt that ramps down to the bench. Any box or parcel riding a belt can be lifted off by hand. Every machine screen has a speed dial from 50 to 200 percent: tap it to step through. Belts are set from the screen of the machine they feed (pick belts on the crane screens, the main belt on the palletiser, the shipping belt on the dock loader). A fast pack line jams more often. Each crane has a touchscreen on its cabinet at the east end of its row: it shows what the crane is doing and what its row holds, PAUSE holds it after the current pick, RESET JOB drops a stuck job and brings it home. All of them stop in a power cut.

## Drivers and the delivery note

When a truck docks the driver climbs down, walks along the trailer, climbs the dock steps and, once the dock door is up, comes inside and waits beside it with the paperwork. Nothing comes off an inbound truck until you press `E` on the driver and sign. Talk to them afterwards if you like. They get impatient after two hours.

## The mezzanine and the sortation deck

The **mezzanine** (level 6, after the gantry pickers) is a steel deck over the receiving strip, reached by the stair along the north wall. A goods lift stands against the west wall by IN 1: set a pallet in it with a jack or the forklift and it goes up by itself, rolls onto the feed belt and is racked in the upper row. The upper crane watches the orders and sends boxes the bench needs down a chute into the south pick belt, so stock kept upstairs reaches the bench like any other pick. The crew never go up.

The **sortation deck** (level 6, on the mezzanine) is where the lanes run themselves. Every parcel off the pack line shelf rides a spiral conveyor up beside the pack line and an overhead run north along the east lane onto the deck. A scanner arch reads its lane. The spine carries it west past three cells: the sea cell crates it, the land cell straps it, the air cell bags it. The collector takes it back east along the north wall and south to the spiral well, where the air gate and the sea gate drop air and sea parcels down spirals into the OUT 3 and OUT 1 loaders; land parcels ride on over the deck edge, down the east wall and down a third spiral into the OUT 2 loader. A parcel whose cell is full goes to the turntable at the end of the spine and round again. The deck opens **OUT 3** and the air clients, who pay half as much again, and it ends the forwarding fees. The sortation panel on the scanner arch shows what was read and what each cell is doing; its dial drives every deck belt. Jack 2's bay moves to the north wall, out from under the spirals. The parcel run and the collector ride overhead where you walk; two **step-overs** cross the upper pick belt and the spine's east end; the corridor along the north wall runs past the cells. A finished parcel rides the **parcel lift** beside its cell up to a bridge belt onto the collector, so nothing jumps. Every dock has a **shipping bay**: a three-lane flow rack beside its loader that holds nine parcels; the spirals (and the shipping belt, before the deck) end in the bays, and the loader takes from its bay while a truck of its lane is docked with the door up. A parcel in a bay can be taken by hand. The **deck night shift** (shop, after the deck) sorts everything on the shelf and the deck while you sleep, so the morning trucks find the bays full. Three **deck accounts** (Meridian Exports by sea, Nordwind Parcels by air, Continental Retail by land) start ordering once the deck stands: two to four lines, up to eight of each, at a third more.

## The annex halls

From level 7 the building grows off its north side, one hall at a time in the shop. **Hall 2** stands east of the production wing and is the **returns hall** (no racks: see Returns below), **Hall 3** west of it (two rows of five) with **IN 3** on its west wall, so a third inbound truck a day docks straight into the new rows, and **Hall 4** sits behind the wing, reached through the wing's north wall. Their doorways are already cut and shuttered; buying the hall opens the shutter. The new rows in Halls 3 and 4 are plain storage for the forklift, the AGV, the receivers and the pickers; the cranes stay over the main rows. The main rows fill first.

## Staff options and the plant page

On the Staff tab (office PC or the panel) every worker has four options. A **training course** ($400) makes them walk a fifth faster and finish every task step a third sooner. A **raise** ($250) pays 10% more an hour and pins their punctuality at full for good. The **shift** cycles day (08:00 to 18:00), early (06:00 to 16:00) and late (12:00 to 22:00), two hours more on overtime. A **second role** ($350 once) lets them cover another job when their own queue is empty: a picker who packs, a packer who picks, a receiver who drives. From level 7 the crew grows from five to eight. The **Plant** app on the office PC lists every machine with its status, its speed dial and the button it has on its own screen (pause a crane or the AGV, clear a jam, start the moulder, eject a pallet, hold the lift, the pack line's AUTO switch), so the whole floor runs from the desk. The inbound dock consoles **sign the delivery note** for a docked truck, so the walk to the driver is optional.

## The forklift battery and the wrapper

The forklift runs down while it drives, faster in third gear (Shift cycles creep, normal and fast), and charges only while its cable is plugged in at the charging point on the south wall: take the cable off the reel, walk it to the truck, `E` plugs it in. Flat, it crawls. A pallet on the forks that is not wrapped sheds a box on a fast corner: bring the pallet to the stretch wrapper on the jack and press `E` ($2 of film).

## Weather, seasons and Sundays

Four seasons of seven days each. Rain and storms soak the yard, snow settles in winter, and lightning is only noise. Sunday is closed: no trucks, no orders, a good day to sleep through. The radio in the break room has three stations; the vending machine sells a snack that makes you faster.

## Contracts, the bank and damaged goods

From level 3 a client offers a **contract** on the office PC now and then: ship a number of their orders on time inside three days for a bonus, or pay a penalty. The **bank** lends $5,000 at 1.5% a day from level 2; **theft insurance** costs $40 a day and pays 80% of anything that walks off at night. A box dropped mid-air or shed off the forklift can be **damaged**: it will not go on a rack or the bench. Carry it to the red bin by the packing bench, and the client charges half its value.

The dock consoles and the bench terminal are touch screens: look at a button and press `E`.

## Build mode

`F2` is build mode. Aim at any piece of furniture, a machine, a poster, a clock or a sign and `E` grabs it; it follows your aim along the floor (wall pieces slide along the nearest wall), `R` turns it a quarter, `E` puts it down, `Esc` drops it back where it was. `Backspace` puts a piece back where it started, `Del` removes it. `C` opens the catalogue: anything you removed can come back, and there are extras to buy, which sell back for half. The layout saves when you leave build mode.

## Money

| | |
|---|---|
| Receiving fee | $12 per pallet, paid when you first touch it |
| Order pay | 22% of the goods' value plus $14 handling, doubled for a rush order |
| Late | half pay, and reputation drops |
| Short | 60% of pay |
| Rent | $110 a day, at the day roll |
| Wages | the crew's clocked hours at their hourly rate, time and a half past ten, at the day roll |
| Returns | $10 a return and $4 a box, paid when the desk has inspected it |
| Refused delivery | nothing, and reputation drops per pallet |

## The shop (office PC)

| Upgrade | Price | Level |
|---|---|---|
| Picking cart | $240 | 1 |
| Third rack row | $950 | 2 |
| Forklift | $2,800 | 2 |
| LED high bays (halves inspection fines) | $600 | 2 |
| Roadside sign (reputation grows faster) | $500 | 2 |
| Fourth rack row | $950 | 3 |
| Second inbound bay (two trucks per slot, bigger loads) | $1,400 | 3 |
| Shipping belt and dock loader | $1,800 | 3 |
| Powered pallet truck | $1,200 | 3 |
| Fifth rack row | $950 | 4 |
| AGV pallet mover | $3,200 | 4 |
| High-lift stacker (needs the powered truck) | $2,200 | 4 |
| Plant tune-up | $2,000 | 4 |
| Gantry pickers over the racks | $5,000 | 5 |
| AGV fast drive (needs the AGV) | $1,800 | 5 |
| AGV floor sweep (needs fast drive) | $2,400 | 6 |
| Plant automation suite (needs the tune-up) | $3,500 | 6 |
| Mezzanine level (needs the gantry pickers) | $6,000 | 6 |
| Sortation deck and air dock (needs the mezzanine) | $7,500 | 6 |
| Deck night shift (needs the deck) | $1,800 | 6 |
| Returns hall, east annex (needs the forklift) | $9,000 | 7 |
| Hall 3, west annex, and IN 3 (needs Hall 2) | $9,500 | 7 |
| Hall 4, behind the wing (needs Hall 3) | $9,500 | 8 |

## Staff and the time clock

The crew come in from the yard through the staff door and clock in at the reader beside it; from 18:00 (20:00 on overtime) they clock out and leave the same way. Pay at 06:00 is their clocked hours at the hourly rate (the daily wage divided by ten), time and a half past ten hours. Punctuality is a trait: the reader screen shows who is in, who is late and who called in sick, and lets you put someone on overtime, give them tomorrow off, or have a word about lateness. Your own card works too: clock in at the start and out at the end for a shift report.

## Staff

| Role | Wage | Level | Does |
|---|---|---|---|
| Receiver | $85 | 3 | Empties a docked inbound truck onto the racks, if its door is open |
| Picker | $85 | 3 | Takes boxes for open orders to the bench |
| Packer | $75 | 4 | Packs complete orders and loads parcels into a docked outbound truck, if its door is open |
| Forklift driver | $95 | 5 | Needs the forklift. Puts the pallets left on the hall floor away on any level, the top shelf included, and parks the forklift back in its bay. Will not take the forklift while you are on it or beside it |

They work their shift (day 08:00 to 18:00, early 06:00 to 16:00, late 12:00 to 22:00, a lunch break four hours in) and go home with nothing in their hands. Five at once, eight from level 7. A receiver pushes a pallet jack of their own. A picker with nothing to pick walks surplus boxes back from the bench to the racks.

## The bench, without a menu

A box on the bench is a thing you look at: `E` takes it back into your hand, or onto the cart, and the prompt says whether an open order wants it. The cart at the bench unloads only the boxes the open orders still want and, in the same press, takes the bench's surplus onto the cart to go back on the racks. The scanner's orders page ends with one pick list for every open order together, less what the bench already holds. An order only ever asks for stock that is on site (racks, bench, floor, cart, and the pallets on a signed truck) and not already claimed by another order.

## Conveyors from parts

Build mode (`F2`), then `C`: the Conveyors group sells belts by the piece, straights of 2 and 4 m, quarter-turn curves left and right, inclines up and down a metre, and a 4 m high run hung from the roof two metres up (two inclines reach it). A carried piece snaps to the nearest free belt end, machine outlet, parcel shelf or inbound dock door (its start goes there), or to the nearest free belt start, machine inlet, outbound dock door or rack bay (its end goes there), turning and climbing to match; when you drop it, it says what it takes from and what it feeds. A belt that ends at a rack bay puts its boxes on the rack. One that ends at an outbound door with a truck in loads the parcels. One that starts at an inbound door with a signed truck in takes the boxes off its pallets, a box a second. The parcel shelf feeds any belt laid at its take-off, and the bench takes boxes from any side. Remove a piece and whatever rode it is set down on the floor where it was.

## Lines and when they arrive

| Tier | Level | Lines |
|---|---|---|
| 1 | 1 | Paint tins, bolt boxes, cereal cases, desk lamps |
| 2 | 2 | Coffee beans, toy robots, detergent, book cartons |
| 3 | 4 | Trainers, cordless drills |
| 4 | 7 | 32" televisions, tyre sets |

## Trouble

- **Power cut** (from level 2): the dock doors, the PC, the coffee machine and new orders stop. Reset the breaker in the office, or wait 90 minutes for the grid.
- **Inspection** (every four to six days at 10:00): more than four things loose on the floor is a fine, and so is a dock door open with no truck in it. A clean floor earns reputation.
- **The prowler**: a dock door left open at 23:00 with no truck in it costs you a few boxes.
- **Cancelled orders**: an order left open thirty hours past its due time is cancelled by the client.

## Keys

`WASD` move · `Shift` run · `Space` jump · `E` use · `G` put down or let go · `Tab` scanner · `1`-`9` its pages, the wheel its cursor, `F` a waypoint, `X` clears it · `F9` photo mode · `Esc` pause · `F3` FPS · `F12` screenshot · `F11` fullscreen. Forklift: `W S` drive, `A D` steer, `R F` forks, `E` lift or set down, `G` get off.

## Returns

From level 3 an outbound truck now and then brings a parcel a customer sent back: unwanted, the wrong item, or damaged in transit. The truck's toast and the Docks page say so. With empty hands, `E` in the trailer takes the return off. Carry it to the **returns desk** between the bench and the office: `E` puts it on the desk (it holds four), `E` again starts the inspection, which runs by itself for a few seconds and needs power. The client pays $10 a return and $4 a box. The boxes come out on the desk's two shelves: good ones go back on a rack by hand or on the cart (`E` with the cart at the shelf takes one), damaged ones go in the bin by the bench at no charge. A return left lying for a day costs a point of reputation. A truck that leaves with a return still aboard has its driver set it down inside the door. The scanner's Home page counts the returns in play and the Orders page lists them with a waypoint to each; the office PC shows them under Orders. The packer fetches returns off the floor and the trucks, runs the desk, and racks or bins what comes off the shelf when the bench has nothing for them.

**The returns hall (level 7, in the shop as the east annex).** The day it is bought Hall 2 is given over to returns: its rack rows go (stock you had in them moves to other rows, or stands on pallets on its floor) and the hall gets a **returns dock** of its own on the east wall, in line with the OUT docks, a **belt** from inside the dock door to an **intake**, three **inspection desks**, a **restock cage** against the far wall and a **compactor** for the damaged boxes. The returns truck docks at 09:30 and 15:00 with three to six returns out of everything you have shipped; open its door (the door itself, the cabinet or the consoles) and, with the power on, the belt carries the returns off the trailer to the intake by itself. E on any desk inspects the next one in the queue (the queue holds eight; E on the intake with a return in hand queues it too). Good boxes land in the cage (it holds twenty-four): take them back to a rack by hand or on the cart. Damaged ones go in the compactor at no charge. The desk by the bench goes with the hall; the outbound trucks still bring the odd return back to their own doors, and those are carried to the hall. The packer covers the lot: fetches returns off the floor and the trucks, runs a free desk, racks and scraps what comes out of the cage.

## The map

Page 9 on the scanner draws the whole site from above at the scale that fits what you own: the main hall with its rack rows (lettered), the docks in their lane colours, the office, the lobby and the break room, the production wing, the annex halls (dashed until bought), the mezzanine. On it live: you (the white arrow points the way you look), the crew (green dots with their initials), the forklift, the AGV, the trucks at the docks and your waypoint. North is up and the inbound docks are on the left.

## The day report

At every day roll the day that ended is closed off: money in and out (the morning's rent and wages included), orders shipped and late, pallets received, boxes picked, returns inspected, the reputation change and the bank at the close. A card shows on the HUD for a while (any key closes it); the Stats app on the office PC and the pause menu's stats keep the last fortnight as a table. The first report comes at the second day roll, when there is a day to compare.

## Photo mode

`F9` frees the camera: `WASD` flies it, `Space` and `C` take it up and down, `Shift` is fast, the mouse looks. The HUD goes and the world holds still while you line up the shot; `F12` takes it. `F9` or `Esc` puts you back where you stood.

## Pallet jacks and empty pallets

Two pallet jacks come with the depot: jack 1 parks by the IN docks, jack 2 by the OUT docks (by the north wall once the sortation deck stands), and either one lifts a floor-level pallet. With an empty jack, E on the empty pallet stack takes a pallet off it; loose boxes of one line go on it by hand, and the loaded pallet stores on a rack like any other, or goes to the bin by the bench to write the whole load off. Empty pallets off the racks or the hopper go back on the stack the same way.

The picking cart carries parcels as well as boxes, twelve items in all on three shelves. E with the cart at the parcel shelf loads a parcel, E in a docked outbound trailer unloads every parcel aboard, and G at the parked cart moves one item between the cart and your hands.
