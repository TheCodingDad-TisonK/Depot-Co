//@ the catalogue, the clients, the ladder of levels, the six building stages, the layout numbers and the economy
  // ── Goods ─────────────────────────────────────────────────────────
  // lvl: the level at which clients start sending that line (1.21.0: the ladder spreads the sixteen lines over 25 levels). val: what one box is worth to the client.
  var SKUS = [
    { id: 'paint',  name: 'Paint tins',       col: '#d14a3a', val: 38,  tier: 1, lvl: 1 },
    { id: 'bolts',  name: 'Bolt boxes',       col: '#7b8794', val: 22,  tier: 1, lvl: 1 },
    { id: 'cereal', name: 'Cereal cases',     col: '#f0b94d', val: 18,  tier: 1, lvl: 1 },
    { id: 'lamps',  name: 'Desk lamps',       col: '#e8d9a0', val: 26,  tier: 1, lvl: 1 },
    { id: 'coffee', name: 'Coffee beans',     col: '#6b4423', val: 45,  tier: 2, lvl: 6 },
    { id: 'toys',   name: 'Toy robots',       col: '#3fa7d6', val: 30,  tier: 2, lvl: 3 },
    { id: 'soap',   name: 'Detergent',        col: '#5fd38d', val: 14,  tier: 2, lvl: 7 },
    { id: 'books',  name: 'Book cartons',     col: '#8e6bbf', val: 20,  tier: 2, lvl: 4 },
    { id: 'shoes',  name: 'Trainers',         col: '#f2f2f2', val: 55,  tier: 3, lvl: 8 },
    { id: 'drills', name: 'Cordless drills',  col: '#2f9e44', val: 95,  tier: 3, lvl: 9 },
    { id: 'tv',     name: '32" televisions',  col: '#1f2937', val: 180, tier: 4, lvl: 11 },
    { id: 'tyres',  name: 'Tyre sets',        col: '#111111', val: 120, tier: 4, lvl: 12 },
    // own-brand goods come off the moulding line in the production wing (level 10, with the wing); raw granulate feeds it and is never ordered by a client
    { id: 'dccrate',   name: 'Depot Co. crates',       col: '#2f6b9a', val: 42, tier: 1, lvl: 10, own: true },
    { id: 'dcbin',     name: 'Depot Co. storage bins', col: '#6b8e23', val: 36, tier: 1, lvl: 10, own: true },
    { id: 'dcplanter', name: 'Depot Co. planters',     col: '#b5651d', val: 50, tier: 2, lvl: 13, own: true },
    { id: 'raw',       name: 'Raw granulate',          col: '#9aa0a6', val: 0,  tier: 99, lvl: 10, raw: true }
  ];
  var SKU = {}; SKUS.forEach(function (s) { SKU[s.id] = s; });
  function skuName(id) { return SKU[id] ? SKU[id].name : id; }
  function skuOpen(s) { return !!s && !s.raw && S.level >= (s.lvl || 1); }   // a line the clients send at this level

  var CLIENTS = [
    // mode: the shipping lane the client's parcels leave by (sea at OUT 1, land at OUT 2, air at OUT 3 once the sortation deck opens it). lvl: when the client finds you
    { id: 'hardware', name: 'Kessler Hardware',  mode: 'sea',  lvl: 1,  likes: ['paint', 'bolts', 'drills', 'lamps', 'dccrate', 'dcbin'] },
    { id: 'grocer',   name: 'Northgate Grocers', mode: 'land', lvl: 1,  likes: ['cereal', 'coffee', 'soap', 'dccrate'] },
    { id: 'toyshop',  name: 'Little Wonders',    mode: 'sea',  lvl: 3,  likes: ['toys', 'books', 'dcbin'] },
    { id: 'sports',   name: 'Fairlane Sports',   mode: 'air',  lvl: 8,  likes: ['shoes', 'tyres'] },
    { id: 'electro',  name: 'Volt & Co.',        mode: 'air',  lvl: 11, likes: ['tv', 'lamps', 'drills'] },
    { id: 'office',   name: 'Pinecrest Offices', mode: 'land', lvl: 4,  likes: ['lamps', 'coffee', 'books', 'paint', 'dcbin', 'dcplanter'] },
    // the deck accounts: they only come once the sortation deck stands, order more lines and more of each, and pay a third more
    { id: 'meridian',    name: 'Meridian Exports',   mode: 'sea',  lvl: 15, deck: true, likes: ['tv', 'drills', 'shoes', 'coffee', 'dcplanter'] },
    { id: 'nordwind',    name: 'Nordwind Parcels',   mode: 'air',  lvl: 15, deck: true, likes: ['toys', 'books', 'lamps', 'soap', 'dcbin'] },
    { id: 'continental', name: 'Continental Retail', mode: 'land', lvl: 15, deck: true, likes: ['paint', 'bolts', 'cereal', 'tyres', 'dccrate'] }
  ];
  var DECK_RATE = 1.35;   // what a deck account pays over the rate card
  // the shipping lanes: what the deck's cell does to its parcels, and the pay. Which outbound dock a lane leaves by is the stage's business (modeDock, modeDoor)
  var MODES = {
    sea:  { name: 'Sea',  col: '#3fa7d6', form: 'crate', pack: 'export crating',  verb: 'crating',  haulier: 'OCEANIC LINES · PORT SHUTTLE' },
    land: { name: 'Land', col: '#5fd38d', form: 'strap', pack: 'strap and label', verb: 'strapping', haulier: 'DEPOT CO. FREIGHT' },
    air:  { name: 'Air',  col: '#ff6b5e', form: 'pouch', pack: 'air bagging',     verb: 'bagging',   haulier: 'SKYBRIDGE AIR CARGO' }
  };
  var MODE_FEE = 0.75, AIR_RATE = 1.5;   // a parcel out of the wrong door pays this share; an air order pays this much more
  var STAFF_NAMES = ['Jo', 'Mika', 'Sam', 'Ravi', 'Lena', 'Ada', 'Theo', 'Nour'];
  var DRIVER_NAMES = ['Big Pete', 'Marta', 'Dusty', 'Kofi', 'Hal', 'Yusra'];

  // ── The ladder ────────────────────────────────────────────────────
  // 1.21.0: 25 levels. What each opens is data: the level of every piece of kit, role, client, line and system is here, the
  // building stages are below, and the level-up card reads the lot (levelOpens, 14-events). Add a row to grow the game.
  var LEVEL_CAP = 25;
  // what a level costs to leave, by level. Set against the plan's 32-hour target and the XP a day the suite measures per stage;
  // the shed is quick, the annexes are the long haul.
  var XP_TABLE = [0, 60, 90, 130, 180, 260, 340, 440, 560, 700, 900, 1100, 1350, 1650, 2000, 2400, 2900, 3400, 4000, 4700, 5500, 6400, 7400, 8500, 9800, 9800];
  var XP_FOR = function (lvl) { return XP_TABLE[clamp(lvl, 1, LEVEL_CAP)]; };
  var XP = { box: 2, pallet: 8, pack: 10, ship: 15, truck: 6 };
  var LEVEL_BONUS = 100;   // the cash a level-up pays, times the level reached
  var UNLOCK = {
    // the shop
    cart: 3, lights: 5, sign: 5, row3: 6, fork: 6, jackPower: 7, row4: 8, jackLift: 9, shipbelt: 9, raw: 10, row5: 12, agv: 12, plantTune: 13, agvFast: 13, gantry: 14, deckNight: 15, agvSweep: 15, plantAuto: 16,
    beltsA: 17, beltsB: 18, seating: 18, deckTune: 19, yardCat: 19, deckTier2: 22, decor: 23, clock: 2,
    // the crew and its options
    picker: 3, receiver: 4, packer: 8, driver: 8, shifts: 7, training: 9, raise: 11, cross: 13,
    // systems
    pc: 5, build: 5, contracts: 5, power: 5, rush: 6, loan: 6, prowler: 7, insurance: 7, inspector: 8, returns: 8, comfort: 5,
    scanPutaway: 2, scanStock: 3, scanCrew: 3, scanDocks: 5, scanMap: 5, scanPlant: 10,
    contractsBig: 17, twoContracts: 21, longContract: 24
  };
  function unlocked(what) { return S.level >= (UNLOCK[what] || 1); }
  var STAFF_CAPS = [0, 0, 0, 1, 2, 2, 2, 3, 4, 4, 5, 5, 5, 5, 6, 6, 7, 7, 7, 7, 8];   // heads by level; eight from 20
  function staffCapAt(level) { return STAFF_CAPS[Math.min(level, STAFF_CAPS.length - 1)]; }
  // the one line a level promises on the HUD and the card ("Next: level N, ..."), and the first-time tips
  var LADDER_NOTES = {
    2: 'a second rack bay and the time clock', 3: 'a third bay, the picking cart, a picker to hire, Little Wonders', 4: 'a fourth bay, the coffee flask, a receiver to hire, Pinecrest Offices',
    5: 'the hall: proper docks, the office and the PC, the break room, the bench and pack line, the yard', 6: 'the forklift and a third rack row in the shop, the bank, coffee beans', 7: 'the powered pallet truck, shift patterns, a third head', 8: 'the fourth row, the packer and the forklift driver, returns, trainers',
    9: 'the high-lift stacker, the shipping belt, training', 10: 'the 60 by 48 hall: IN 2, OUT 2 and the sea lane, the production wing, the second jack, the car park and the road', 11: 'Volt and Co., televisions, the raise', 12: 'the fifth row and the AGV', 13: 'the plant tune-up, AGV fast drive, a second role', 14: 'the gantry pickers',
    15: 'the big hall: the mezzanine, the sortation deck, OUT 3 and the air lane, three deck accounts', 16: 'the plant automation suite', 17: 'conveyor pieces: straights and curves', 18: 'inclines and the high run, the comfort seating', 19: 'the deck dial to 300 percent, the yard catalogue',
    20: 'the returns hall and Hall 3 with IN 3, eight heads', 21: 'two contracts at once', 22: 'the deck runs half as fast again', 23: 'the last of the furniture', 24: 'the long contract', 25: 'Hall 4 and the full yard: the depot is complete'
  };
  var LADDER_TIPS = { 2: 'The time clock is on the wall: E clocks you in and keeps your hours.', 5: 'The office PC is on the desk: E sits you down. Orders, the shop, the crew and the bank are on it.', 6: 'The forklift is in the shop. It drives with WASD, lifts with R and F, and reaches the top shelf.', 10: 'Two outbound doors now: the board shows every order’s lane, and a parcel out of the wrong door pays a forwarding fee.', 15: 'Every parcel off the pack line rides up to the deck and down into the truck of its lane by itself.', 20: 'Returns go to the returns hall now: the truck brings them to its own dock and the belt takes them in.' };

  // ── Time ──────────────────────────────────────────────────────────
  var HOUR_SEC = 75;              // one game hour in real seconds, so a 16-hour working day is twenty minutes (37.5 until 2026-10-03: too fast for the big hall)
  var DAY_START = 6, DAY_END = 22;
  var NIGHT_SPEED = 4;            // the clock runs faster after closing unless you sleep
  var TRUCK_IN = [7.5, 13.5];     // inbound trucks dock at these hours
  var TRUCK_WAIT = 4;             // hours an inbound truck waits before it leaves with what you did not unload

  // ── Money ─────────────────────────────────────────────────────────
  var ECON = {
    start: 600, rent: 110, rawPrice: 120, receiveFee: 12, handling: 14, margin: 0.22, lateCut: 0.5, shortCut: 0.6,
    wage: { receiver: 85, picker: 85, packer: 75, driver: 95 },
    rowPrice: 950, cartPrice: 240, forkPrice: 2800, lightsPrice: 600, pcPrice: 0,
    palletCap: 8, slotCap: 12, cartCap: 12, benchCap: 24, tableCap: 8
  };
  // free: the stage that brings the piece for nothing (1.21.0): it stays in the list so its name and text are known, and leaves the shop
  var UPGRADES = [
    { id: 'cart',   name: 'Picking cart',        price: ECON.cartPrice,  lvl: UNLOCK.cart, desc: 'A trolley with three shelves that holds twelve boxes or parcels. Grab it, pick straight onto it from the racks, and empty it onto the bench in one go.' },
    { id: 'row3',   name: 'Third rack row',      price: ECON.rowPrice,   lvl: UNLOCK.row3, desc: 'Another row of hand-reachable slots and a top level for the forklift.' },
    { id: 'fork',   name: 'Forklift',            price: ECON.forkPrice,  lvl: UNLOCK.fork, desc: 'Drive it, lift whole pallets, and reach the top level of every rack. Parks at the south wall.' },
    { id: 'row4',   name: 'Fourth rack row',     price: ECON.rowPrice,   lvl: UNLOCK.row4, desc: 'Another row of bays across three levels.' },
    { id: 'row5',   name: 'Fifth rack row',      price: ECON.rowPrice,   lvl: UNLOCK.row5, desc: 'The last row in the main hall. The annex halls come at level 20.' },
    { id: 'lights', name: 'LED high bays',       price: ECON.lightsPrice, lvl: UNLOCK.lights, desc: 'Brighter hall, and the inspector likes a well-lit floor: fines are halved.' },
    { id: 'dock2',  name: 'Second inbound bay',  price: 1400,            lvl: 10, free: 2, desc: 'Two inbound trucks a day can dock at once, and clients send bigger loads. Comes with the hall at level 10.' },
    { id: 'sign',   name: 'Roadside sign',       price: 500,             lvl: UNLOCK.sign, desc: 'New clients find you sooner. Reputation grows a little faster.' },
    { id: 'shipbelt', name: 'Shipping belt and dock loader', price: 1800, lvl: UNLOCK.shipbelt, desc: 'Parcels roll off the pack line shelf onto a belt down the east wall into the OUT 2 shipping bay (OUT 1 before the hall grows), a flow rack that holds nine, and the dock loader beside it pushes them into any docked truck with its door up.' },
    { id: 'agv',    name: 'AGV pallet mover',    price: 3200,            lvl: UNLOCK.agv, desc: 'A driverless truck. Set a pallet on its pickup square (or let the palletiser drop one) and it puts it away on the racks by itself.' },
    { id: 'gantry', name: 'Gantry pickers over the racks', price: 5000, lvl: UNLOCK.gantry, desc: 'A crane over every rack row you own (new rows get theirs too). Each watches the orders, picks the boxes the bench still needs out of its row and sends them down the overhead pick belts to the bench.' },
    // tiers on what you already own (each needs the one before it)
    { id: 'jackPower', name: 'Powered pallet truck',   price: 1200, lvl: UNLOCK.jackPower, desc: 'An electric drive on the pallet jacks: you walk at full speed with a loaded pallet behind you.' },
    { id: 'jackLift',  name: 'High-lift stacker',      price: 2200, lvl: UNLOCK.jackLift, needs: 'jackPower', desc: 'The jacks lift to the second rack level: set pallets into the middle shelf and pull them out by hand. The top shelf stays forklift work.' },
    { id: 'agvFast',   name: 'AGV: fast drive',        price: 1800, lvl: UNLOCK.agvFast, needs: 'agv', desc: 'The AGV runs at 2.2 m/s instead of 1.3: a put-away in little over half the time.' },
    { id: 'agvSweep',  name: 'AGV: floor sweep',       price: 2400, lvl: UNLOCK.agvSweep, needs: 'agvFast', desc: 'The AGV fetches any pallet left anywhere on the hall floor, not only the ones on its square, keeping clear of you and of pallets the crew already have in hand.' },
    { id: 'plantTune', name: 'Plant tune-up',          price: 2000, lvl: UNLOCK.plantTune, desc: 'Every machine dial goes to 300% (250 and 300 join the steps), and the pack line jams half as often.' },
    { id: 'plantAuto', name: 'Plant automation suite', price: 3500, lvl: UNLOCK.plantAuto, needs: 'plantTune', desc: 'The pack line never jams, and it starts any order the bench can complete by itself, no terminal tap needed. An AUTO switch on the bench terminal turns that off and on.' },
    { id: 'upper',     name: 'Mezzanine level',        price: 6000, lvl: 15, free: 3, desc: 'A steel deck over the receiving strip with a goods lift by the IN docks, one rack row of two levels up there and a crane of its own. Comes with the big hall at level 15.' },
    { id: 'sorter',    name: 'Sortation deck and air dock', price: 7500, lvl: 15, free: 3, desc: 'Every parcel off the pack line rides a spiral up to the deck and along the sorter: a scanner reads its lane, three cells crate it for the sea, strap it for the land or bag it for the air, and spirals drop it into the right dock loader by itself. OUT 3 and the air clients come with it. Comes with the big hall at level 15.' },
    { id: 'deckNight', name: 'Deck night shift',       price: 1800, lvl: UNLOCK.deckNight, needs: 'sorter', desc: 'The deck keeps running while you sleep: every parcel on the shelf and on the deck belts is sorted by morning and staged beside the loader of its lane, and the first truck of each lane loads them from the bays by itself.' },
    // the annex halls, free with the stages
    { id: 'hall2', name: 'Returns hall (east annex)',      price: 9000, lvl: 20, free: 4, needs: 'fork',  desc: 'A second hall off the north wall, east of the production wing, given over to returns: a returns dock of its own with a truck twice a day, the belt to the intake, three inspection desks, the restock cage and a compactor. Comes at level 20.' },
    { id: 'hall3', name: 'Hall 3 (west annex) and IN 3',   price: 9500, lvl: 20, free: 4, needs: 'hall2', desc: 'A third hall west of the wing with two rows of five bays and a third inbound dock, IN 3, on its west wall. Comes at level 20.' },
    { id: 'hall4', name: 'Hall 4 (behind the wing)',       price: 9500, lvl: 25, free: 5, needs: 'hall3', desc: 'The back hall, through the north wall of the production wing: 24 by 20 metres and two more rows of seven bays. Comes at level 25.' }
  ];
  function upgradeName(id) { var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; return u ? u.name : id; }
  function upgradeDef(id) { return UPGRADES.filter(function (x) { return x.id === id; })[0] || null; }
  var STAFF_ROLES = {
    receiver: { name: 'Receiver', wage: ECON.wage.receiver, lvl: UNLOCK.receiver, desc: 'Walks pallets out of a docked inbound truck and puts them on the racks.' },
    picker:   { name: 'Picker',   wage: ECON.wage.picker,   lvl: UNLOCK.picker, desc: 'Takes boxes off the racks for open orders and brings them to the bench.' },
    packer:   { name: 'Packer',   wage: ECON.wage.packer,   lvl: UNLOCK.packer, desc: 'Packs complete orders at the bench and loads the parcels into a docked outbound truck.' },
    driver:   { name: 'Forklift driver', wage: ECON.wage.driver, lvl: UNLOCK.driver, needs: 'fork', desc: 'Drives the forklift: puts the pallets left on the hall floor away on any level, the top shelf included, and parks it back in its bay. Needs the forklift.' }
  };

  // ── The stages ────────────────────────────────────────────────────
  // Six building stages, each a rectangle inside the next, all in one world frame centred on the origin. The stage is read from
  // the save before anything is laid out (BOOT_STAGE, 01-head), so every table below is built once a page load for that stage;
  // a stage change is a reload at the day roll (stageRebuild, 14-events). The 40x28 and 60x48 numbers are the game's own, from
  // 1.7.4 and 1.12.12. inZ, outZ, retZ: the dock doors' z on the west, east and returns walls. fence: the yard's fence line.
  var STAGES = [
    { id: 'shed',  name: 'The shed',       level: 1,  hall: { x: 7, z: 5, h: 5 },    rows: [-3.8], bays: 4, x0: -6,   inZ: [0],        outZ: [],              retZ: [],    rent: 0,   maxOpen: 2,  pallets: [1, 3], skylights: [0],                   fence: { x: 24, z0: -16, z1: 16 } },
    { id: 'small', name: 'The small hall', level: 5,  hall: { x: 20, z: 14, h: 7 },  rows: [-6, -2, 2, 6], bays: 8, x0: -12, inZ: [-8], outZ: [-8],            retZ: [],    rent: 60,  maxOpen: 4,  pallets: [2, 4], skylights: [-7, 0, 7],           fence: { x: 50, z0: -40, z1: 40 } },
    { id: 'hall',  name: 'The hall',       level: 10, hall: { x: 30, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6], outZ: [-14, -6], retZ: [], rent: 110, maxOpen: 6,  pallets: [3, 6], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } },
    { id: 'big',   name: 'The big hall',   level: 15, hall: { x: 36, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6], outZ: [-14, -6, -21.6], retZ: [], rent: 110, maxOpen: 8, pallets: [4, 8], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } },
    { id: 'annex', name: 'The annexes',    level: 20, hall: { x: 36, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6, -34], outZ: [-14, -6, -21.6], retZ: [-34], rent: 160, maxOpen: 10, pallets: [4, 8], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } },
    { id: 'far',   name: 'The far end',    level: 25, hall: { x: 36, z: 24, h: 8 },  rows: [-10.9, -4.3, 2.3, 8.9, 15.5], bays: 15, x0: -24, inZ: [-14, -6, -34], outZ: [-14, -6, -21.6], retZ: [-34], rent: 160, maxOpen: 10, pallets: [4, 8], skylights: [-14, -7, 0, 7, 14], fence: { x: 84, z0: -68, z1: 60 } }
  ];
  var STAGE_LAST = STAGES.length - 1, STAGE = STAGES[BOOT_STAGE];   // STAGE_LAST, not STAGE_CAP: that name is the shipping bays' capacity in the sorter
  function stageForLevel(l) { var s = 0; for (var i = 0; i < STAGES.length; i++) if (l >= STAGES[i].level) s = i; return s; }
  // which stage a part of the site belongs to; stageHas asks about the stage this page was built for
  var STAGE_OF = { rooms: 1, docks: 1, bench: 1, yard: 1, gates: 1, wing: 2, jack2: 2, carpark: 2, road: 2, lanes: 2, deck: 3, neighbours: 3, hallDoors: 3, annex: 4, hall4: 5 };
  function stageHas(what) { return BOOT_STAGE >= (STAGE_OF[what] === undefined ? 0 : STAGE_OF[what]); }
  function stageName(i) { return STAGES[clamp(i, 0, STAGE_LAST)].name; }
  // the free structure a stage brings: the owned flags it turns on, so every "when" the game already has keeps working
  function stageFlags(up, stage) { if (stage >= 1 && (up.rows || 0) < 2) up.rows = 2; if (stage >= 2) up.dock2 = true; if (stage >= 3) { up.upper = true; up.sorter = true; } if (stage >= 4) { up.hall2 = true; up.hall3 = true; } if (stage >= 5) up.hall4 = true; return up; }   // the small hall opens with two rows
  var VAN = { cap: 8, len: 4, z: 8.2, x: -2, w: 2.0 };   // the shed's outbound: a van on the south side of the shed, parked along x with its rear at x -2 facing east; it comes and goes by the west lane at z 8.2 and nobody walks into it
  var FIRE_X = BOOT_STAGE >= 3 ? 23.5 : STAGES[BOOT_STAGE].hall.x - 6.5;   // the fire exit in the north wall: 23.5 in the hall since 1.12 and in the big halls; 6.5 m in from the east wall before that
  // outbound trucks: one dock a lane, two windows a day each; an order is due at the next departure of its lane's dock.
  // The shed has the van on the land lane; the small hall ships everything by OUT 1 on the land windows; the lanes come with OUT 2 at the hall
  var TRUCK_OUT = BOOT_STAGE === 0 ? [{ mode: 'land', van: true, windows: [{ arrive: 10.5, leave: 12 }, { arrive: 16, leave: 17.5 }] }]
    : BOOT_STAGE === 1 ? [{ mode: 'land', windows: [{ arrive: 9, leave: 10.5 }, { arrive: 16, leave: 18 }] }]
    : [
      { mode: 'sea',  windows: [{ arrive: 10.5, leave: 12 }, { arrive: 17, leave: 18.5 }] },
      { mode: 'land', windows: [{ arrive: 9, leave: 10.5 }, { arrive: 16, leave: 18 }] },
      { mode: 'air',  windows: [{ arrive: 13, leave: 14.5 }, { arrive: 19, leave: 20.25 }] }
    ];
  function modeDock(m) { for (var k = 0; k < TRUCK_OUT.length; k++) if (TRUCK_OUT[k].mode === m) return k; return TRUCK_OUT.length ? 0 : -1; }   // the outbound dock a lane leaves by at this stage; one dock takes every lane before the lanes exist
  function modeDoor(m) { var k = modeDock(m); return k < 0 ? -1 : doorIndex('out', k); }
  function lanesOn() { return TRUCK_OUT.length > 1; }   // more than one outbound dock: the board shows lanes and the wrong door costs a fee
  function outWindows(dock) { return TRUCK_OUT[dock] ? TRUCK_OUT[dock].windows : []; }
  function outNext(dock) { var ws = outWindows(dock); for (var k = 0; k < ws.length; k++) if (S.time < ws[k].leave - 0.3 && !S.flags['out' + S.day + '-' + dock + '-' + k]) return ws[k]; var w0 = ws[0] || { arrive: 0, leave: 0 }; return { arrive: w0.arrive, leave: w0.leave, tomorrow: true }; }   // the next window today whose truck has not been and gone, else tomorrow's first
  function outNextText(dock) { if (isSunday()) return 'closed Sunday'; var n = outNext(dock); return 'next at ' + fmtTime(n.arrive) + (n.tomorrow ? ' tomorrow' : ''); }
  function dockOwned(dock) { return dock < TRUCK_OUT.length && (dock < 2 || !!(S.up && S.up.sorter)); }   // OUT 3 opens with the sortation deck

  // ── Layout (metres; the hall floor is y = 0, the yard is y = -1.2) ─
  var STAFF_JACK = { push: 2.15, tow: 2.07, park: 1.45 };   // a receiver's pallet jack: metres from the figure to the jack's origin when pushed loaded ahead, towed empty behind, parked behind while they stand
  var HALL = { x: STAGE.hall.x, z: STAGE.hall.z, h: STAGE.hall.h };   // 40 x 28 until 2026-10-02, 60 x 48 until 2026-10-03, 72 x 48 since; 1.21.0: the stage's
  // the side walls moved from x 30 to x 36 on 2026-10-03. Anything authored against them follows: a hall position with |x| in the old wall zone
  // (22.1 up to the old wall) moves out by the growth; a yard position beside a side wall (|z| inside the hall) moves with it too. Nothing moves below the big hall.
  var WALL_SHIFT = Math.max(0, HALL.x - 30);
  function wallX(x, z, yard) { if (!WALL_SHIFT) return x; var ax = Math.abs(x); var move = yard ? (ax >= 22.1 && Math.abs(z) < HALL.z + 2) : (ax >= 22.1 && ax < 30.5); return move ? x + (x < 0 ? -WALL_SHIFT : WALL_SHIFT) : x; }
  // the two inverse rules the smaller stages use on things authored for the big halls: unwallX takes a 72-frame position back to the 60 frame, ungrown a 60-frame one back to the 40 frame
  function unwallX(v) { var a = Math.abs(v); return a >= 28.1 && a <= 36.5 ? v - (v < 0 ? -6 : 6) : v; }
  function ungrown(v) { return Math.abs(v) >= 18 ? v - (v < 0 ? -10 : 10) : v; }
  var RACK = { rows: STAGE.rows, bays: STAGE.bays, bayW: 3, x0: STAGE.x0, depth: 1.2, levels: [0, 1.55, 3.3], top: 2 };   // rows 6.6 m apart in the big halls, biased south so row E and its crane clear the office front; levels: the y of the pallet base; top is forklift-only
  var DOCKS = { in: STAGE.inZ.map(function (z) { return { z: z }; }), out: STAGE.outZ.map(function (z) { return { z: z }; }), ret: STAGE.retZ.map(function (z) { return { z: z }; }), w: 3.6, h: 4.2 };   // the returns dock (z -34) is in the returns hall's east wall; IN 3 (z -34) is in Hall 3's west wall
  // the dock doors by index, in the order the save keeps them: IN 1, IN 2, OUT 1, OUT 2, OUT 3 (1.14.0), IN 3 (1.14.0, Hall 3), RETURNS. Never i % 2 again.
  var DOOR_MAP = [{ dir: 'in', dock: 0 }, { dir: 'in', dock: 1 }, { dir: 'out', dock: 0 }, { dir: 'out', dock: 1 }, { dir: 'out', dock: 2 }, { dir: 'in', dock: 2 }, { dir: 'ret', dock: 0 }];   // 6: the returns dock, east wall of the returns hall
  function doorIndex(dir, dock) { for (var i = 0; i < DOOR_MAP.length; i++) if (DOOR_MAP[i].dir === dir && DOOR_MAP[i].dock === dock) return i; return -1; }   // OUT 3 (air) at the north end of the east wall, under the deck, since 1.14.0
  function doorBuilt(i) { var d = DOOR_MAP[i]; return !!(d && (d.dir === 'in' ? DOCKS.in[d.dock] : d.dir === 'out' ? DOCKS.out[d.dock] : DOCKS.ret[d.dock])); }   // the stage has a wall for this door
  var YARD_Y = -1.2;
  var SKYLIGHT_Z = STAGE.skylights;   // the roof lights and the shafts under them
  var TRAILER = { len: 12, w: 2.5, h: 2.7 };
  // the spots, authored for the 60 x 48 hall: the big hall moves the wall-side ones out (wallX), the small hall pulls them in (ungrown), the shed has its own
  var SPOT = {
    bench: { x: 26.6, z: 5.2 }, benchOut: { x: 26.6, z: 7.2 },
    stageIn: { x: -26, z: -10 }, stageOut: { x: 23, z: 0 },   // stageOut lands at x 29 after the wall shift: by OUT 2, between the land spiral and the bench (it sat under the sea spiral from 1.14 to 1.16)
    pc: { x: 27.5, z: 21.8 }, breaker: { x: 29.7, z: 19.6 },
    cot: { x: -27.2, z: 22.2 }, coffee: { x: -29.4, z: 19.3 },
    jack: { x: -27.8, z: -18.0 }, jack2: { x: 27.8, z: -18.0 }, cart: { x: -28.6, z: 9.2 }, fork: { x: 0, z: 21.2 },   // one jack by the IN docks, one by the OUT docks, the cart on the west wall
    spawn: { x: -28.6, z: 21.2 }, staffDoor: { x: -30, z: 22 }
  };
  var SPOT_SMALL = { jack: { x: -15, z: 4 }, jack2: { x: 15, z: 4 }, cart: { x: -15, z: 6.5 }, stageIn: { x: -15.5, z: -4 }, stageOut: { x: 15.5, z: -4 } };   // 1.7.4's bays, where ungrown would put a jack in front of IN 1
  var SPOT_SHED = { bench: { x: 4.6, z: 2.6 }, benchOut: { x: 4.6, z: 4.4 }, stageIn: { x: -3.0, z: 0.2 }, stageOut: { x: 3.5, z: -0.5 }, pc: { x: 5.5, z: -3.0 }, breaker: { x: 6.7, z: 2.0 }, cot: { x: -5.5, z: 4.45 }, coffee: { x: 4.6, z: 2.6 }, jack: { x: -2.4, z: 4.0 }, jack2: { x: 5.5, z: -1.0 }, cart: { x: 2.0, z: 4.3 }, fork: { x: 0, z: 3.9 }, spawn: { x: -5.8, z: 3.2 }, staffDoor: { x: -7, z: 3.5 } };   // the shed, 14 by 10: the rack along the north wall, the door and the receiving square on the west, the table and the cart along the south wall, the cot in the south-west corner
  for (var spk in SPOT) { if (BOOT_STAGE === 0) { if (SPOT_SHED[spk]) SPOT[spk] = SPOT_SHED[spk]; } else if (BOOT_STAGE === 1) { if (SPOT_SMALL[spk]) SPOT[spk] = SPOT_SMALL[spk]; else { SPOT[spk].x = ungrown(SPOT[spk].x); SPOT[spk].z = ungrown(SPOT[spk].z); } } else SPOT[spk].x = wallX(SPOT[spk].x, SPOT[spk].z, false); }
  function stageRent() { return STAGE.rent; }
  function benchCapNow() { return BOOT_STAGE === 0 ? ECON.tableCap : ECON.benchCap; }   // the shed's table holds eight, the bench 24
  // what a level brings, in words, for the card and the log: the shop, the roles, the lines, the clients, the systems, the heads, the building
  var UNLOCK_WORDS = { cart: 'the picking cart in the shop', lights: 'the LED high bays in the shop', sign: 'the roadside sign in the shop', row3: 'a third rack row in the shop', fork: 'the forklift in the shop', jackPower: 'the powered pallet truck in the shop', row4: 'a fourth rack row in the shop', jackLift: 'the high-lift stacker in the shop', shipbelt: 'the shipping belt and dock loader in the shop', raw: 'raw granulate on the Production app', row5: 'a fifth rack row in the shop', agv: 'the AGV in the shop', plantTune: 'the plant tune-up in the shop', agvFast: 'AGV fast drive in the shop', gantry: 'the gantry pickers in the shop', deckNight: 'the deck night shift in the shop', agvSweep: 'the AGV floor sweep in the shop', plantAuto: 'the plant automation suite in the shop',
    beltsA: 'conveyor straights and curves in the catalogue', beltsB: 'conveyor inclines and the high run in the catalogue', seating: 'the comfort seating in the catalogue', deckTune: 'the deck dial to 300 percent', yardCat: 'the yard catalogue', deckTier2: 'the deck belts half as fast again', decor: 'the last of the furniture in the catalogue',
    picker: 'a picker to hire', receiver: 'a receiver to hire', packer: 'a packer to hire', driver: 'a forklift driver to hire', shifts: 'shift patterns for the crew', training: 'training courses for the crew', raise: 'raises for the crew', cross: 'second roles for the crew',
    clock: 'the time clock', pc: 'the office PC', build: 'build mode and the catalogue', contracts: 'contracts from the clients', power: 'power cuts, and the breaker in the office', rush: 'rush orders', loan: 'the bank loan', prowler: 'the night prowler: lock up', insurance: 'theft insurance', inspector: 'the safety inspector', returns: 'returns on the outbound trucks, and the returns desk', comfort: 'break room comfort',
    scanPutaway: 'the Putaway page on the scanner', scanStock: 'the Stock page on the scanner', scanCrew: 'the Crew page on the scanner', scanDocks: 'the Docks page on the scanner', scanMap: 'the Map page on the scanner', scanPlant: 'the Plant page on the scanner',
    contractsBig: 'bigger contracts', twoContracts: 'two contracts at once', longContract: 'the long contract' };
  function levelOpens(level) {
    var out = [];
    if (level === 2) out.push('a second rack bay'); if (level === 3) out.push('a third rack bay'); if (level === 4) out.push('a fourth rack bay, the coffee flask');
    for (var k in UNLOCK) if (UNLOCK[k] === level && UNLOCK_WORDS[k]) out.push(UNLOCK_WORDS[k]);
    SKUS.forEach(function (s) { if (s.lvl === level && !s.raw && level > 1) out.push(s.name.toLowerCase() + (s.own ? ' off the moulding line' : ' from the clients')); });
    CLIENTS.forEach(function (c) { if (c.lvl === level && level > 1) out.push(c.name + (c.deck ? ', a deck account' : '') + ' finds you'); });
    if (staffCapAt(level) > staffCapAt(level - 1)) out.push('the crew grows to ' + staffCapAt(level));
    var st = stageForLevel(level); if (st > stageForLevel(level - 1)) out.unshift(STAGES[st].name.toLowerCase() + ': the builders come in the morning');
    return out;
  }
