# Changelog

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
