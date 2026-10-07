//@ the catalogue, the clients, the layout numbers and the economy
  // ── Goods ─────────────────────────────────────────────────────────
  // tier: the level at which clients start sending that line. val: what one box is worth to the client.
  var SKUS = [
    { id: 'paint',  name: 'Paint tins',       col: '#d14a3a', val: 38,  tier: 1 },
    { id: 'bolts',  name: 'Bolt boxes',       col: '#7b8794', val: 22,  tier: 1 },
    { id: 'cereal', name: 'Cereal cases',     col: '#f0b94d', val: 18,  tier: 1 },
    { id: 'lamps',  name: 'Desk lamps',       col: '#e8d9a0', val: 26,  tier: 1 },
    { id: 'coffee', name: 'Coffee beans',     col: '#6b4423', val: 45,  tier: 2 },
    { id: 'toys',   name: 'Toy robots',       col: '#3fa7d6', val: 30,  tier: 2 },
    { id: 'soap',   name: 'Detergent',        col: '#5fd38d', val: 14,  tier: 2 },
    { id: 'books',  name: 'Book cartons',     col: '#8e6bbf', val: 20,  tier: 2 },
    { id: 'shoes',  name: 'Trainers',         col: '#f2f2f2', val: 55,  tier: 3 },
    { id: 'drills', name: 'Cordless drills',  col: '#2f9e44', val: 95,  tier: 3 },
    { id: 'tv',     name: '32" televisions',  col: '#1f2937', val: 180, tier: 4 },
    { id: 'tyres',  name: 'Tyre sets',        col: '#111111', val: 120, tier: 4 },
    // own-brand goods come off the moulding line in the production wing; raw granulate feeds it and is never ordered by a client
    { id: 'dccrate',   name: 'Depot Co. crates',       col: '#2f6b9a', val: 42, tier: 1, own: true },
    { id: 'dcbin',     name: 'Depot Co. storage bins', col: '#6b8e23', val: 36, tier: 1, own: true },
    { id: 'dcplanter', name: 'Depot Co. planters',     col: '#b5651d', val: 50, tier: 2, own: true },
    { id: 'raw',       name: 'Raw granulate',          col: '#9aa0a6', val: 0,  tier: 99, raw: true }
  ];
  var SKU = {}; SKUS.forEach(function (s) { SKU[s.id] = s; });
  function skuName(id) { return SKU[id] ? SKU[id].name : id; }

  var CLIENTS = [
    // mode: the shipping lane the client's parcels leave by (sea at OUT 1, land at OUT 2, air at OUT 3 once the sortation deck opens it)
    { id: 'hardware', name: 'Kessler Hardware',  mode: 'sea',  likes: ['paint', 'bolts', 'drills', 'lamps', 'dccrate', 'dcbin'] },
    { id: 'grocer',   name: 'Northgate Grocers', mode: 'land', likes: ['cereal', 'coffee', 'soap', 'dccrate'] },
    { id: 'toyshop',  name: 'Little Wonders',    mode: 'sea',  likes: ['toys', 'books', 'dcbin'] },
    { id: 'sports',   name: 'Fairlane Sports',   mode: 'air',  likes: ['shoes', 'tyres'] },
    { id: 'electro',  name: 'Volt & Co.',        mode: 'air',  likes: ['tv', 'lamps', 'drills'] },
    { id: 'office',   name: 'Pinecrest Offices', mode: 'land', likes: ['lamps', 'coffee', 'books', 'paint', 'dcbin', 'dcplanter'] },
    // the deck accounts: they only come once the sortation deck stands, order more lines and more of each, and pay a third more
    { id: 'meridian',    name: 'Meridian Exports',   mode: 'sea',  deck: true, likes: ['tv', 'drills', 'shoes', 'coffee', 'dcplanter'] },
    { id: 'nordwind',    name: 'Nordwind Parcels',   mode: 'air',  deck: true, likes: ['toys', 'books', 'lamps', 'soap', 'dcbin'] },
    { id: 'continental', name: 'Continental Retail', mode: 'land', deck: true, likes: ['paint', 'bolts', 'cereal', 'tyres', 'dccrate'] }
  ];
  var DECK_RATE = 1.35;   // what a deck account pays over the rate card
  // the shipping lanes: which outbound door each one leaves by, what the deck's cell does to its parcels, and the pay
  var MODES = {
    sea:  { name: 'Sea',  door: 2, col: '#3fa7d6', form: 'crate', pack: 'export crating',  verb: 'crating',  haulier: 'OCEANIC LINES · PORT SHUTTLE' },
    land: { name: 'Land', door: 3, col: '#5fd38d', form: 'strap', pack: 'strap and label', verb: 'strapping', haulier: 'DEPOT CO. FREIGHT' },
    air:  { name: 'Air',  door: 4, col: '#ff6b5e', form: 'pouch', pack: 'air bagging',     verb: 'bagging',   haulier: 'SKYBRIDGE AIR CARGO' }
  };
  var MODE_FEE = 0.75, AIR_RATE = 1.5;   // a parcel out of the wrong door pays this share; an air order pays this much more
  var STAFF_NAMES = ['Jo', 'Mika', 'Sam', 'Ravi', 'Lena', 'Ada', 'Theo', 'Nour'];
  var DRIVER_NAMES = ['Big Pete', 'Marta', 'Dusty', 'Kofi', 'Hal', 'Yusra'];

  // ── Time ──────────────────────────────────────────────────────────
  var HOUR_SEC = 75;              // one game hour in real seconds, so a 16-hour working day is twenty minutes (37.5 until 2026-10-03: too fast for the big hall)
  var DAY_START = 6, DAY_END = 22;
  var NIGHT_SPEED = 4;            // the clock runs faster after closing unless you sleep
  var TRUCK_IN = [7.5, 13.5];     // inbound trucks dock at these hours
  // outbound trucks: one dock a lane, two windows a day each; an order is due at the next departure of its lane's dock
  var TRUCK_OUT = [
    { mode: 'sea',  windows: [{ arrive: 10.5, leave: 12 }, { arrive: 17, leave: 18.5 }] },
    { mode: 'land', windows: [{ arrive: 9, leave: 10.5 }, { arrive: 16, leave: 18 }] },
    { mode: 'air',  windows: [{ arrive: 13, leave: 14.5 }, { arrive: 19, leave: 20.25 }] }
  ];
  function outWindows(dock) { return TRUCK_OUT[dock] ? TRUCK_OUT[dock].windows : []; }
  function outNext(dock) { var ws = outWindows(dock); for (var k = 0; k < ws.length; k++) if (S.time < ws[k].leave - 0.3 && !S.flags['out' + S.day + '-' + dock + '-' + k]) return ws[k]; var w0 = ws[0] || { arrive: 0, leave: 0 }; return { arrive: w0.arrive, leave: w0.leave, tomorrow: true }; }   // the next window today whose truck has not been and gone, else tomorrow's first
  function outNextText(dock) { if (isSunday()) return 'closed Sunday'; var n = outNext(dock); return 'next at ' + fmtTime(n.arrive) + (n.tomorrow ? ' tomorrow' : ''); }
  function dockOwned(dock) { return dock < 2 || !!(S.up && S.up.sorter); }   // OUT 3 opens with the sortation deck
  var TRUCK_WAIT = 4;             // hours an inbound truck waits before it leaves with what you did not unload

  // ── Money ─────────────────────────────────────────────────────────
  var ECON = {
    start: 600, rent: 110, rawPrice: 120, receiveFee: 12, handling: 14, margin: 0.22, lateCut: 0.5, shortCut: 0.6,
    wage: { receiver: 85, picker: 85, packer: 75, driver: 95 },
    rowPrice: 950, cartPrice: 240, forkPrice: 2800, lightsPrice: 600, pcPrice: 0,
    palletCap: 8, slotCap: 12, cartCap: 12, benchCap: 24
  };
  var UPGRADES = [
    { id: 'cart',   name: 'Picking cart',        price: ECON.cartPrice,  lvl: 1, desc: 'A trolley with three shelves that holds twelve boxes or parcels. Grab it, pick straight onto it from the racks, and empty it onto the bench in one go.' },
    { id: 'row3',   name: 'Third rack row',      price: ECON.rowPrice,   lvl: 2, desc: 'Thirty more hand-reachable slots and a top level for the forklift.' },
    { id: 'fork',   name: 'Forklift',            price: ECON.forkPrice,  lvl: 2, desc: 'Drive it, lift whole pallets, and reach the top level of every rack. Parks at the south wall.' },
    { id: 'row4',   name: 'Fourth rack row',     price: ECON.rowPrice,   lvl: 3, desc: 'Another fifteen bays across three levels.' },
    { id: 'row5',   name: 'Fifth rack row',      price: ECON.rowPrice,   lvl: 4, desc: 'The last row in the main hall. The annex halls come at level 7.' },
    { id: 'lights', name: 'LED high bays',       price: ECON.lightsPrice, lvl: 2, desc: 'Brighter hall, and the inspector likes a well-lit floor: fines are halved.' },
    { id: 'dock2',  name: 'Second inbound bay',  price: 1400,            lvl: 3, desc: 'Two inbound trucks a day can dock at once, and clients send bigger loads.' },
    { id: 'sign',   name: 'Roadside sign',       price: 500,             lvl: 2, desc: 'New clients find you sooner. Reputation grows a little faster.' },
    { id: 'shipbelt', name: 'Shipping belt and dock loader', price: 1800, lvl: 3, desc: 'Parcels roll off the pack line shelf onto a belt down the east wall into the OUT 2 shipping bay, a flow rack that holds nine, and the dock loader beside it pushes them into any docked truck with its door up. OUT 1 stays manual.' },
    { id: 'agv',    name: 'AGV pallet mover',    price: 3200,            lvl: 4, desc: 'A driverless truck. Set a pallet on its pickup square (or let the palletiser drop one) and it puts it away on the racks by itself.' },
    { id: 'gantry', name: 'Gantry pickers over the racks', price: 5000, lvl: 5, desc: 'A crane over every rack row you own (new rows get theirs too). Each watches the orders, picks the boxes the bench still needs out of its row and sends them down the overhead pick belts to the bench.' },
    // 1.14.0: tiers on what you already own (each needs the one before it)
    { id: 'jackPower', name: 'Powered pallet truck',   price: 1200, lvl: 3, desc: 'An electric drive on the pallet jacks: you walk at full speed with a loaded pallet behind you.' },
    { id: 'jackLift',  name: 'High-lift stacker',      price: 2200, lvl: 4, needs: 'jackPower', desc: 'The jacks lift to the second rack level: set pallets into the middle shelf and pull them out by hand. The top shelf stays forklift work.' },
    { id: 'agvFast',   name: 'AGV: fast drive',        price: 1800, lvl: 5, needs: 'agv', desc: 'The AGV runs at 2.2 m/s instead of 1.3: a put-away in little over half the time.' },
    { id: 'agvSweep',  name: 'AGV: floor sweep',       price: 2400, lvl: 6, needs: 'agvFast', desc: 'The AGV fetches any pallet left anywhere on the hall floor, not only the ones on its square, keeping clear of you and of pallets the crew already have in hand.' },
    { id: 'plantTune', name: 'Plant tune-up',          price: 2000, lvl: 4, desc: 'Every machine dial goes to 300% (250 and 300 join the steps), and the pack line jams half as often.' },
    { id: 'plantAuto', name: 'Plant automation suite', price: 3500, lvl: 6, needs: 'plantTune', desc: 'The pack line never jams, and it starts any order the bench can complete by itself, no terminal tap needed. An AUTO switch on the bench terminal turns that off and on.' },
    { id: 'upper',     name: 'Mezzanine level',        price: 6000, lvl: 6, needs: 'gantry', desc: 'A steel deck over the receiving strip with a goods lift by the IN docks, one rack row of two levels up there and a crane of its own. Set a pallet in the lift and it goes up, rolls onto the feed belt and is racked by itself; the crane picks for orders onto a belt that drops down a chute into the south pick belt. The stair runs along the north wall. The sortation deck builds on it.' },
    { id: 'sorter',    name: 'Sortation deck and air dock', price: 7500, lvl: 6, needs: 'upper', desc: 'Every parcel off the pack line rides a spiral up to the deck and along the sorter: a scanner reads its lane, three cells crate it for the sea, strap it for the land or bag it for the air, and spirals drop it into the right dock loader by itself: sea at OUT 1, land at OUT 2, air at the new OUT 3, which opens with this and brings the air-freight clients, who pay half as much again. No more forwarding fees for parcels out of the wrong door. Three deck accounts start ordering: bigger orders at a third more.' },
    { id: 'deckNight', name: 'Deck night shift',       price: 1800, lvl: 6, needs: 'sorter', desc: 'The deck keeps running while you sleep: every parcel on the shelf and on the deck belts is sorted by morning and staged beside the loader of its lane, and the first truck of each lane loads them from the bays by itself.' },
    // 1.14.0: the annex halls, bought one after another off the north side
    { id: 'hall2', name: 'Returns hall (east annex)',      price: 9000, lvl: 7, needs: 'fork',  desc: 'A second hall off the north wall, east of the production wing, given over to returns: a returns dock of its own on the east wall with a truck twice a day, the belt that carries the returns off the trailer to the intake, three inspection desks, the restock cage and a compactor for the damaged ones. The desk by the bench goes. The doorway is already cut, this opens the shutter.' },
    { id: 'hall3', name: 'Hall 3 (west annex) and IN 3',   price: 9500, lvl: 7, needs: 'hall2', desc: 'A third hall west of the wing with two rows of five bays and a third inbound dock, IN 3, on its west wall: a third truck a day, straight into the new rows. The silo moves out of its way.' },
    { id: 'hall4', name: 'Hall 4 (behind the wing)',       price: 9500, lvl: 8, needs: 'hall3', desc: 'The back hall, through the north wall of the production wing: 24 by 20 metres and two more rows of seven bays. The far end of the building.' }
  ];
  function upgradeName(id) { var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; return u ? u.name : id; }
  var STAFF_ROLES = {
    receiver: { name: 'Receiver', wage: ECON.wage.receiver, lvl: 3, desc: 'Walks pallets out of a docked inbound truck and puts them on the racks.' },
    picker:   { name: 'Picker',   wage: ECON.wage.picker,   lvl: 3, desc: 'Takes boxes off the racks for open orders and brings them to the bench.' },
    packer:   { name: 'Packer',   wage: ECON.wage.packer,   lvl: 4, desc: 'Packs complete orders at the bench and loads the parcels into a docked outbound truck.' },
    driver:   { name: 'Forklift driver', wage: ECON.wage.driver, lvl: 5, needs: 'fork', desc: 'Drives the forklift: puts the pallets left on the hall floor away on any level, the top shelf included, and parks it back in its bay. Needs the forklift.' }
  };
  var XP_FOR = function (lvl) { return Math.round(80 * Math.pow(1.45, lvl - 1)); };
  var XP = { box: 2, pallet: 8, pack: 10, ship: 15, truck: 6 };

  // ── Layout (metres; the hall floor is y = 0, the yard is y = -1.2) ─
  var STAFF_JACK = { push: 2.15, tow: 2.07, park: 1.45 };   // a receiver's pallet jack: metres from the figure to the jack's origin when pushed loaded ahead, towed empty behind, parked behind while they stand
  var HALL = { x: 36, z: 24, h: 8 };   // 40 x 28 until 2026-10-02, 60 x 48 until 2026-10-03, now 72 x 48: the east and west corridors needed 6 m more each for the forklift
  // the side walls moved from x 30 to x 36 on 2026-10-03. Anything authored against them follows: a hall position with |x| in the old wall zone
  // (22.1 up to the old wall) moves out by the growth; a yard position beside a side wall (|z| inside the hall) moves with it too.
  var WALL_SHIFT = HALL.x - 30;
  function wallX(x, z, yard) { var ax = Math.abs(x); var move = yard ? (ax >= 22.1 && Math.abs(z) < HALL.z + 2) : (ax >= 22.1 && ax < 30.5); return move ? x + (x < 0 ? -WALL_SHIFT : WALL_SHIFT) : x; }
  var RACK = { rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, bayW: 3, x0: -24, depth: 1.2, levels: [0, 1.55, 3.3], top: 2 };   // rows 6.6 m apart, biased south so row E and its crane clear the office front at z 18.5; a sixth row at z -17.5 stood here until 1.13.3 (Tyson wanted the receiving side open); levels: the y of the pallet base; top is forklift-only
  var DOCKS = { in: [{ z: -14 }, { z: -6 }, { z: -34 }], out: [{ z: -14 }, { z: -6 }, { z: -21.6 }], ret: [{ z: -34 }], w: 3.6, h: 4.2 };   // the returns dock (z -34) is in the returns hall's east wall and exists once that hall does   // IN 3 (z -34) is in Hall 3's west wall and exists once Hall 3 does
  // the dock doors by index, in the order the save keeps them: IN 1, IN 2, OUT 1, OUT 2, OUT 3 (1.14.0), IN 3 (1.14.0, Hall 3). Never i % 2 again.
  var DOOR_MAP = [{ dir: 'in', dock: 0 }, { dir: 'in', dock: 1 }, { dir: 'out', dock: 0 }, { dir: 'out', dock: 1 }, { dir: 'out', dock: 2 }, { dir: 'in', dock: 2 }, { dir: 'ret', dock: 0 }];   // 6: the returns dock, east wall of the returns hall
  function doorIndex(dir, dock) { for (var i = 0; i < DOOR_MAP.length; i++) if (DOOR_MAP[i].dir === dir && DOOR_MAP[i].dock === dock) return i; return -1; }   // OUT 3 (air) at the north end of the east wall, under the deck, since 1.14.0
  var YARD_Y = -1.2;
  var SKYLIGHT_Z = [-14, -7, 0, 7, 14];   // the roof lights and the shafts under them
  var TRAILER = { len: 12, w: 2.5, h: 2.7 };
  var SPOT = {
    bench: { x: 26.6, z: 5.2 }, benchOut: { x: 26.6, z: 7.2 },
    stageIn: { x: -26, z: -10 }, stageOut: { x: 23, z: 0 },   // stageOut lands at x 29 after the wall shift: by OUT 2, between the land spiral and the bench (it sat under the sea spiral from 1.14 to 1.16)
    pc: { x: 27.5, z: 21.8 }, breaker: { x: 29.7, z: 19.6 },
    cot: { x: -27.2, z: 22.2 }, coffee: { x: -29.4, z: 19.3 },
    jack: { x: -27.8, z: -18.0 }, jack2: { x: 27.8, z: -18.0 }, cart: { x: -28.6, z: 9.2 }, fork: { x: 0, z: 21.2 },   // one jack by the IN docks, one by the OUT docks, the cart on the west wall
    spawn: { x: -28.6, z: 21.2 }, staffDoor: { x: -30, z: 22 }
  };
  for (var spk in SPOT) SPOT[spk].x = wallX(SPOT[spk].x, SPOT[spk].z, false);   // authored against the 30 m walls
