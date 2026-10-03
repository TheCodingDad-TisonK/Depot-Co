# Changelog

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
