/* ============================================================
   Depot Co.: a first-person warehouse simulator in 3D.
   Trucks bring pallets to the inbound dock, you put the stock on the
   racks, orders come in on the office PC, you pick, pack and ship them
   from the outbound dock. Rendering: three.js r128, everything generated.
   ============================================================ */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">three.js failed to load (vendor/three/three.min.js).</p>'; return; }

  // ── Utilities ─────────────────────────────────────────────────────
  var BOOT_SLOT = (function () { try { var sl = +(localStorage.getItem('depotco-slot') || 1); return sl >= 1 && sl <= 3 ? sl : 1; } catch (e) { return 1; } })();
  var SAVE = 'depotco-slot' + BOOT_SLOT;
  var SETTINGS_KEY = 'depotco-settings';
  var now = function () { return Date.now(); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var money = function (n) { return (n < 0 ? '-$' : '$') + Math.floor(Math.abs(n)).toLocaleString('en-US'); };
  var randi = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  var randf = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var fmtTime = function (h) { h = ((h % 24) + 24) % 24; var m = Math.floor((h % 1) * 60); return pad2(Math.floor(h)) + ':' + pad2(m); };
  var dist2 = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
  var uid = (function () { var n = 0; return function (p) { n++; return (p || 'id') + '-' + Date.now().toString(36) + '-' + n.toString(36); }; })();

  // ── Settings (not part of the save: they belong to the machine) ───
  var SET = { sens: 1, invertY: false, quality: 'high', sound: true, vol: 0.8, fps: false, fov: 75, film: true };
  try { var ss = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (ss) for (var sk in ss) if (sk in SET) SET[sk] = ss[sk]; } catch (e) {}
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SET)); } catch (e) {} }
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
  function outNext(dock) { var ws = outWindows(dock); for (var k = 0; k < ws.length; k++) if (S.time < ws[k].leave - 0.3) return ws[k]; return ws[0]; }   // the next window today, else tomorrow's first
  function dockOwned(dock) { return dock < 2 || !!(S.up && S.up.sorter); }   // OUT 3 opens with the sortation deck
  var TRUCK_WAIT = 4;             // hours an inbound truck waits before it leaves with what you did not unload

  // ── Money ─────────────────────────────────────────────────────────
  var ECON = {
    start: 600, rent: 110, rawPrice: 120, receiveFee: 12, handling: 14, margin: 0.22, lateCut: 0.5, shortCut: 0.6,
    wage: { receiver: 85, picker: 85, packer: 75, driver: 95 },
    rowPrice: 950, cartPrice: 240, forkPrice: 2800, lightsPrice: 600, pcPrice: 0,
    jackPallet: 8, palletCap: 8, slotCap: 12, cartCap: 12, benchCap: 24
  };
  var UPGRADES = [
    { id: 'cart',   name: 'Picking cart',        price: ECON.cartPrice,  lvl: 1, desc: 'A trolley with three shelves that holds twelve boxes or parcels. Grab it, pick straight onto it from the racks, and empty it onto the bench in one go.' },
    { id: 'row3',   name: 'Third rack row',      price: ECON.rowPrice,   lvl: 2, desc: 'Sixteen more hand-reachable slots and a top level for the forklift.' },
    { id: 'fork',   name: 'Forklift',            price: ECON.forkPrice,  lvl: 2, desc: 'Drive it, lift whole pallets, and reach the top level of every rack. Parks at the south wall.' },
    { id: 'row4',   name: 'Fourth rack row',     price: ECON.rowPrice,   lvl: 3, desc: 'Another fifteen bays across three levels.' },
    { id: 'row5',   name: 'Fifth rack row',      price: ECON.rowPrice,   lvl: 4, desc: 'The last rack row. The hall is full after this one.' },
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
    { id: 'hall2', name: 'Hall 2 (east annex)',            price: 9000, lvl: 7, needs: 'fork',  desc: 'A second hall off the north wall, east of the production wing: 26 by 20 metres, two rack rows of seven bays on three levels, its own roof lights. Storage for the forklift, the AGV and the crew; the cranes stay over the main rows. The doorway is already cut, this opens the shutter.' },
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
  var DOCKS = { in: [{ z: -14 }, { z: -6 }, { z: -34 }], out: [{ z: -14 }, { z: -6 }, { z: -21.6 }], w: 3.6, h: 4.2 };   // IN 3 (z -34) is in Hall 3's west wall and exists once Hall 3 does
  // the dock doors by index, in the order the save keeps them: IN 1, IN 2, OUT 1, OUT 2, OUT 3 (1.14.0), IN 3 (1.14.0, Hall 3). Never i % 2 again.
  var DOOR_MAP = [{ dir: 'in', dock: 0 }, { dir: 'in', dock: 1 }, { dir: 'out', dock: 0 }, { dir: 'out', dock: 1 }, { dir: 'out', dock: 2 }, { dir: 'in', dock: 2 }];
  function doorIndex(dir, dock) { for (var i = 0; i < DOOR_MAP.length; i++) if (DOOR_MAP[i].dir === dir && DOOR_MAP[i].dock === dock) return i; return -1; }   // OUT 3 (air) at the north end of the east wall, under the deck, since 1.14.0
  var YARD_Y = -1.2;
  var SKYLIGHT_Z = [-14, -7, 0, 7, 14];   // the roof lights and the shafts under them
  var TRAILER = { len: 12, w: 2.5, h: 2.7 };
  var SPOT = {
    bench: { x: 26.6, z: 5.2 }, benchOut: { x: 26.6, z: 7.2 },
    stageIn: { x: -26, z: -10 }, stageOut: { x: 26, z: -10 },
    pc: { x: 27.5, z: 21.8 }, breaker: { x: 29.7, z: 19.6 },
    cot: { x: -27.2, z: 22.2 }, coffee: { x: -29.4, z: 19.3 },
    jack: { x: -27.8, z: -18.0 }, jack2: { x: 27.8, z: -18.0 }, cart: { x: -28.6, z: 9.2 }, fork: { x: 0, z: 20.5 },   // one jack by the IN docks, one by the OUT docks, the cart on the west wall
    spawn: { x: -28.6, z: 21.2 }, staffDoor: { x: -30, z: 22 }, console0: { x: 29.7, z: -9.6 }, console1: { x: 29.7, z: -8.5 }, console2: { x: 34.6, z: -23.83 }
  };
  for (var spk in SPOT) SPOT[spk].x = wallX(SPOT[spk].x, SPOT[spk].z, false);   // authored against the 30 m walls
  // ── State ─────────────────────────────────────────────────────────
  function freshState() {
    return {
      ver: 1, day: 1, time: DAY_START, bank: ECON.start, xp: 0, level: 1, rep: 10,
      hall: 5,                   // the hall layout generation; 1 was the 40 x 28 hall, 2 the first big-hall build whose migration ran too late
      up: { rows: 2, cart: false, fork: false, lights: false, dock2: false, sign: false, shipbelt: false, agv: false, gantry: false, upper: false, sorter: false, hall2: false, hall3: false, hall4: false },
      gantries: {}, speed: {},
      agv: { x: 0, z: 0, yaw: 0, state: 'idle', pallet: null, path: [], placed: false },
      slots: {},                 // "row,bay,level" -> { sku, n }
      pallets: [],               // { id, sku, n, place: 'truck'|'floor'|'jack'|'fork'|'staff', truck, idx, x, z, y, rot }
      floor: [],                 // loose boxes and parcels on the floor: { kind: 'box'|'parcel', sku|order, x, y, z, rot }
      bench: { boxes: {}, parcels: [] },
      pack: { queue: [], job: null, jam: false, made: 0, feedT: 0, out: null },           // the pack line
      lift: { pallet: null, pos: 0, state: 'down' },                                      // the goods lift to the mezzanine (1.14.0)
      factory: { raw: 0, product: 'dccrate', on: false, made: 0, rawOrdered: 0, t: 0, jam: false },   // the moulding line and its hopper
      pal: { sku: null, n: 0 }, belts: {},
      baler: { card: 0, bales: 0, t: 0, made: 0 }, wrap: { film: 20, wrapped: 0 },                                                   // the palletiser's pallet, and what is on each belt
      cart: { boxes: [], parcels: [], x: SPOT.cart.x, z: SPOT.cart.z, rot: 0 },
      jack: { pallet: null, x: SPOT.jack.x, z: SPOT.jack.z, rot: Math.PI / 2 },
      jack2: { pallet: null, x: SPOT.jack2.x, z: SPOT.jack2.z, rot: -Math.PI / 2 },
      fork: { x: SPOT.fork.x, z: SPOT.fork.z, yaw: Math.PI, lift: 0.1, pallet: null, batt: 1 },
      weather: null, radio: { on: false, station: 0 },
      loan: 0, insured: false, contract: null, nextOffer: 3, binned: 0,
      layout: {}, custom: [],
      hand: null,                // { kind: 'box', sku } | { kind: 'parcel', order }
      orders: [], shipped: [],   // shipped keeps the last 40 for the ledger
      trucks: [], doors: [false, false, false, false, false, false],   // IN 1, IN 2, OUT 1, OUT 2, OUT 3, IN 3 (see DOOR_MAP)
      sort: null,                // the sortation deck's cells, turntable and counts (1.14.0)
      stage: {},                 // parcels staged beside each dock loader, by loader id
      staff: [], nextStaffName: 0,
      intro: { step: 0, done: false, off: false },
      events: { power: false, powerUntil: 0, nextInspect: 4, inspected: false, prowled: false },
      seenSkus: ['paint', 'bolts', 'cereal', 'lamps'],
      stats: { received: 0, putaway: 0, picked: 0, packed: 0, shipped: 0, late: 0, earned: 0, spent: 0, fines: 0, days: 0, lost: 0, made: 0, palletised: 0 },
      ledger: [], log: [], sleptAt: 0, lastOrderAt: 0, orderSeq: 1, truckSeq: 1, flags: {}
    };
  }
  var S = freshState();
  function load() {
    try {
      var raw = localStorage.getItem(SAVE); if (!raw) return false;
      var s = JSON.parse(raw); if (!s || typeof s !== 'object') return false;
      var f = freshState(), oldHall = !('hall' in s) || s.hall < 2, hall2 = s.hall === 2;
      for (var k in f) if (!(k in s)) s[k] = f[k];
      for (var k2 in f.stats) if (!(k2 in s.stats)) s.stats[k2] = f.stats[k2];
      // a save from the first big-hall build kept its old layout and any docked truck inside the new walls: the same clean-up again, once
      if (hall2) { s.hall = 3; s.layout = {}; s.custom = []; s.trucks = []; s.pallets = (s.pallets || []).filter(function (p) { return p.place !== 'truck'; }); }
      // any truck that would sit inside the building is evicted, whatever the save says
      s.trucks = (s.trucks || []).filter(function (t) { var inside = Math.abs(t.x) < HALL.x + 0.2; if (inside) s.pallets = (s.pallets || []).filter(function (p) { return !(p.place === 'truck' && p.truck === t.id); }); return !inside; });
      if (oldHall) { s.hall = 3; s.layout = {}; s.custom = []; s.trucks = []; s.pallets = (s.pallets || []).filter(function (p) { return p.place !== 'truck'; }); (s.staff || []).forEach(function (st) { if (st.x !== undefined) { st.x = clamp(st.x, -HALL.x + 2, HALL.x - 2); st.z = clamp(st.z, -HALL.z + 2, HALL.z - 2); } }); s.jack.x = SPOT.jack.x; s.jack.z = SPOT.jack.z; s.cart.x = SPOT.cart.x; s.cart.z = SPOT.cart.z; s.fork.x = SPOT.fork.x; s.fork.z = SPOT.fork.z; s.fork.plugged = false; (s.pallets || []).forEach(function (p) { if (p.place === 'floor') { p.x = clamp(p.x, -HALL.x + 2, HALL.x - 2); p.z = clamp(p.z, -HALL.z + 2, HALL.z - 2); } }); }
      for (var k3 in f.up) if (!(k3 in s.up)) s.up[k3] = f.up[k3];
      for (var k4 in f.events) if (!(k4 in s.events)) s.events[k4] = f.events[k4];
      // 1.12.8 moved the jack and cart bays off the row D end (a crane column stood in the old jack bay): tools still parked there follow
      if (!s.flags.toolBays2) { s.flags.toolBays2 = 1; var near = function (o, x, z) { return o && Math.abs(o.x - x) < 1.2 && Math.abs(o.z - z) < 1.6; }; if (near(s.jack, -25, 4)) { s.jack.x = SPOT.jack.x; s.jack.z = SPOT.jack.z; } if (near(s.cart, -25, 6.5)) { s.cart.x = SPOT.cart.x; s.cart.z = SPOT.cart.z; } }
      // 1.12.9 put the first jack by the IN docks and added a second by OUT: a jack still parked in the 1.12.8 bay follows
      if (!s.flags.toolBays3) { s.flags.toolBays3 = 1; if (s.jack && Math.abs(s.jack.x - -28.6) < 1.2 && Math.abs(s.jack.z - 6.0) < 1.6) { s.jack.x = SPOT.jack.x; s.jack.z = SPOT.jack.z; s.jack.rot = Math.PI / 2; } }
      // 2026-10-03, hall 4: the side walls went from x 30 to x 36. Anything a player left against them follows, once
      if (s.hall === 3) { s.hall = 4; var mv = function (o, yard) { if (o && typeof o.x === 'number') o.x = wallX(o.x, o.z || 0, !!yard); }; for (var lk in (s.layout || {})) mv(s.layout[lk], PROPS[lk] && PROPS[lk].yard); (s.custom || []).forEach(function (c) { mv(c, PROPS[c.type] && PROPS[c.type].yard); }); (s.pallets || []).forEach(function (p) { if (p.place === 'floor') mv(p, false); }); (s.staff || []).forEach(function (stf) { mv(stf, false); }); mv(s.fork, false); ['jack', 'jack2', 'cart'].forEach(function (tl) { if (s[tl]) { s[tl].x = SPOT[tl].x; s[tl].z = SPOT[tl].z; } }); s.trucks = []; s.pallets = (s.pallets || []).filter(function (p) { return p.place !== 'truck'; }); if (s.agv) s.agv.placed = false; }
      // 2026-10-06, hall 5: rack row A (z -17.5) is gone and the receiving side is open floor. Rows B to F are A to E: slot keys,
      // crane states and moved racks shift down one row. The stock of the old row A goes into free slots of the rows kept, what
      // does not fit onto floor pallets along the old row for the forklift driver; a sixth row owned is refunded.
      if (s.hall === 4) {
        s.hall = 5; var ns = {}, spill = [];
        for (var sk in (s.slots || {})) { var sp = slotParse(sk), sv = s.slots[sk]; if (!sv) continue; if (sp.r >= 1) ns[slotKey(sp.r - 1, sp.b, sp.l)] = sv; else if (sv.n > 0) spill.push({ sku: sv.sku, n: sv.n, b: sp.b }); }
        var rowsNow = Math.min(s.up.rows || 2, RACK.rows.length); if ((s.up.rows || 0) > RACK.rows.length) s.bank += ECON.rowPrice; s.up.rows = rowsNow;
        spill.forEach(function (it) { var put = false; for (var r = 0; r < rowsNow && !put; r++) for (var b = 0; b < RACK.bays && !put; b++) for (var l = 0; l < RACK.levels.length && !put; l++) { var k = slotKey(r, b, l); if (!ns[k] || !ns[k].n) { ns[k] = { sku: it.sku, n: it.n, pal: true }; put = true; } } if (!put) s.pallets.push({ id: 'pl-mig-' + it.b + '-' + Math.random().toString(36).slice(2, 7), sku: it.sku, n: it.n, place: 'floor', x: RACK.x0 + RACK.bayW * (it.b + 0.5), z: -17.5, y: 0, rot: 0 }); });
        s.slots = ns;
        var ng = {}; for (var gk in (s.gantries || {})) if (+gk >= 1) { var G = s.gantries[gk]; G.state = 'idle'; G.sku = null; G.key = null; ng[+gk - 1] = G; } s.gantries = ng;
        var nl = {}; for (var lk2 in (s.layout || {})) { var mm = /^(rack|gantry)(\d)$/.exec(lk2); if (!mm) nl[lk2] = s.layout[lk2]; else if (+mm[2] >= 1) nl[mm[1] + (+mm[2] - 1)] = s.layout[lk2]; } s.layout = nl;
        (s.staff || []).forEach(function (st) { st.task = null; if (st.carry && st.carry.back) delete st.carry.back; });
      }
      // 1.14.0: the lanes. Five dock doors; every order carries its lane; the upper pack line of the uncommitted step 2 is gone
      while ((s.doors || (s.doors = [])).length < 6) s.doors.push(false); if (!s.stage) s.stage = {};
      (s.orders || []).forEach(function (o) { if (o.state === 'upper') { o.state = 'open'; } if (!o.mode) { var cm = (CLIENTS.filter(function (c) { return c.id === o.client; })[0] || {}).mode || 'land'; o.mode = cm === 'air' && !s.up.sorter ? 'land' : cm; } });
      if (s.up.upperPack) { delete s.up.upperPack; } delete s.upack; delete s.udiv; if (s.belts) { delete s.belts.upackIn; delete s.belts.upackOut; }
      // belt items whose piece is gone (a removal that crashed before 1.13.5 left them behind): boxes and parcels go to the receiving floor
      if (s.belts) for (var bk in s.belts) { if (BELTS[bk] || (s.custom || []).some(function (c) { return c.id === bk; })) continue; (s.belts[bk] || []).forEach(function (it, n) { var fx = SPOT.stageIn.x - 0.9 + (n % 4) * 0.6, fz = SPOT.stageIn.z + 1.5 + Math.floor(n / 4) * 0.6; if (it.kind === 'box') s.floor.push({ kind: 'box', sku: it.sku, x: fx, y: 0, z: fz, rot: 0 }); else if (it.kind === 'parcel' && it.order) s.floor.push({ kind: 'parcel', order: it.order, x: fx, y: 0, z: fz, rot: 0 }); }); delete s.belts[bk]; }
      S = s; return true;
    } catch (e) { return false; }
  }
  var saveT = 0;
  function save() {
    if (wiped) return;
    try { S.savedAt = now(); localStorage.setItem(SAVE, JSON.stringify(S)); saveT = now(); } catch (e) {}
  }
  var wiped = false;
  function wipe() { wiped = true; try { localStorage.removeItem(SAVE); } catch (e) {} }
  // the ledger and the lifetime stats
  function pay(n, why) { S.bank += n; if (n >= 0) S.stats.earned += n; else S.stats.spent += -n; S.ledger.unshift({ day: S.day, t: fmtTime(S.time), n: n, why: why }); if (S.ledger.length > 80) S.ledger.pop(); hudDirty = true; }
  function addXp(n) {
    S.xp += n; hudDirty = true;
    while (S.xp >= XP_FOR(S.level)) { S.xp -= XP_FOR(S.level); S.level++; onLevelUp(); }
  }
  function addRep(n) { S.rep = clamp(S.rep + n * (S.up.sign && n > 0 ? 1.25 : 1), 0, 100); hudDirty = true; }
  var hudDirty = true;
  // ── Log / toast / sound ───────────────────────────────────────────
  function logEvent(msg, kind) {
    S.log.unshift({ day: S.day, t: fmtTime(S.time), msg: msg, kind: kind || '' });
    if (S.log.length > 60) S.log.pop();
    feedPush(msg, kind);
  }
  function feedPush(msg, kind) {
    var feed = $('h-feed'); if (!feed) return;
    var d = document.createElement('div'); d.className = kind || '';
    d.innerHTML = '<span class="t">' + fmtTime(S.time) + '</span>' + msg;
    feed.appendChild(d);
    while (feed.children.length > 6) feed.removeChild(feed.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 14000);
  }
  function toast(msg, kind) {
    var box = $('h-toasts'); if (!box) return;
    var d = document.createElement('div'); d.className = kind || ''; d.innerHTML = msg; box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2600);
    if (kind === 'bad') sfx('bad'); else if (kind === 'rare') sfx('rare'); else sfx('ok');
  }
  var AC = null, sfxBus = null;
  function audio() { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); sfxBus = AC.createGain(); sfxBus.gain.value = SET.vol; sfxBus.connect(AC.destination); } if (AC.state === 'suspended') AC.resume(); return AC; }
  // small synth helpers: everything is generated, no audio files
  function sTone(type, f0, t, dur, gain, opts) { opts = opts || {}; var o = AC.createOscillator(), gn = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (opts.f1) o.frequency.exponentialRampToValueAtTime(opts.f1, t + dur); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(gain, t + (opts.attack || 0.008)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); var dest = sfxBus; if (opts.lp) { var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; gn.connect(f); f.connect(dest); } else gn.connect(dest); o.connect(gn); o.start(t); o.stop(t + dur + 0.05); }
  function sNoise(t, dur, gain, opts) { opts = opts || {}; var len = Math.floor(AC.sampleRate * dur); var buf = AC.createBuffer(1, len, AC.sampleRate); var d = buf.getChannelData(0); for (var i = 0; i < len; i++) { var env = opts.shape === 'swell' ? Math.sin(i / len * Math.PI) : opts.shape === 'flat' ? 1 : (1 - i / len); d[i] = (Math.random() * 2 - 1) * env; } var src = AC.createBufferSource(); src.buffer = buf; var f = AC.createBiquadFilter(); f.type = opts.type || 'highpass'; f.frequency.value = opts.freq || 4000; if (opts.q) f.Q.value = opts.q; var gn = AC.createGain(); gn.gain.setValueAtTime(gain, t); if (opts.fade) gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(f); f.connect(gn); gn.connect(sfxBus); src.start(t); }
  function sThud(t, f, gain, dur) { sTone('sine', f, t, dur || 0.12, gain, { f1: f * 0.5 }); sNoise(t, 0.05, gain * 0.5, { type: 'lowpass', freq: 600 }); }
  function sBeep(t, f, dur, gain) { sTone('square', f, t, dur || 0.08, gain || 0.05, { lp: 3000 }); }
  var SFX = {
    ok:      function (t) { sTone('sine', 520, t, 0.07, 0.07); sTone('sine', 780, t + 0.07, 0.1, 0.07); },
    bad:     function (t) { sTone('sawtooth', 220, t, 0.14, 0.05, { lp: 1200 }); sTone('sawtooth', 160, t + 0.12, 0.16, 0.05, { lp: 1000 }); },
    rare:    function (t) { [660, 880, 1320, 1760].forEach(function (f, i) { sTone('sine', f, t + i * 0.07, 0.16, 0.07); }); },
    click:   function (t) { sTone('sine', 900, t, 0.03, 0.06); sNoise(t, 0.02, 0.05, { freq: 5000 }); },
    cash:    function (t) { [1175, 1568, 2093, 2637].forEach(function (f, i) { sTone('sine', f, t + i * 0.045, 0.14, 0.06); }); sNoise(t, 0.12, 0.08, { freq: 7000, fade: true }); },
    pickup:  function (t) { sNoise(t, 0.05, 0.08, { type: 'lowpass', freq: 1800 }); sTone('sine', 300, t, 0.08, 0.05, { f1: 200 }); },
    putdown: function (t) { sThud(t, 180, 0.09, 0.12); sNoise(t, 0.04, 0.05, { type: 'lowpass', freq: 1500 }); },
    crate:   function (t) { sThud(t, 120, 0.14, 0.18); sNoise(t + 0.02, 0.1, 0.08, { type: 'lowpass', freq: 900, fade: true }); },
    step:    function (t, o) { var f = o === 'steel' ? 200 : o === 'outside' ? 110 : 130; sThud(t, f, 0.035, 0.07); if (o === 'steel') sNoise(t, 0.03, 0.03, { freq: 3000 }); if (o === 'outside') sNoise(t, 0.06, 0.04, { type: 'bandpass', freq: 1200, q: 0.5 }); },
    roller:  function (t) { for (var i = 0; i < 14; i++) { sNoise(t + i * 0.085, 0.07, 0.07, { type: 'lowpass', freq: 500 + (i % 2) * 300 }); sTone('square', 60 + (i % 3) * 8, t + i * 0.085, 0.08, 0.02, { lp: 300 }); } sThud(t + 1.25, 90, 0.1, 0.15); },
    scan:    function (t) { sBeep(t, 2200, 0.06, 0.04); },
    tape:    function (t) { sNoise(t, 0.35, 0.12, { type: 'bandpass', freq: 2200, q: 0.8, shape: 'flat', fade: true }); sNoise(t + 0.4, 0.08, 0.1, { freq: 3000 }); },
    jack:    function (t) { for (var i = 0; i < 3; i++) { sTone('sawtooth', 140, t + i * 0.18, 0.12, 0.03, { f1: 110, lp: 500 }); sNoise(t + i * 0.18 + 0.1, 0.04, 0.05, { type: 'lowpass', freq: 800 }); } },
    forklift:function (t) { for (var i = 0; i < 12; i++) sTone('sawtooth', 70 + Math.sin(i * 0.9) * 5, t + i * 0.1, 0.12, 0.025, { lp: 260 }); },
    hydraulic:function (t) { sNoise(t, 0.5, 0.05, { type: 'bandpass', freq: 600, q: 1.2, shape: 'flat', fade: true }); sTone('sine', 90, t, 0.5, 0.03, { f1: 120 }); },
    truck:   function (t) { for (var i = 0; i < 30; i++) sTone('sawtooth', 48 + Math.sin(i * 0.6) * 5, t + i * 0.1, 0.12, 0.03, { lp: 200 }); sNoise(t, 3, 0.03, { type: 'lowpass', freq: 260, shape: 'flat' }); },
    airbrake:function (t) { sNoise(t, 0.7, 0.14, { freq: 3500, shape: 'flat', fade: true }); },
    horn:    function (t) { sTone('sawtooth', 220, t, 0.5, 0.05, { lp: 1200 }); sTone('sawtooth', 277, t, 0.5, 0.04, { lp: 1200 }); },
    bell:    function (t) { sTone('sine', 2093, t, 0.6, 0.06); sTone('sine', 2637, t + 0.005, 0.5, 0.04); sTone('sine', 3136, t + 0.01, 0.4, 0.02); },
    chime:   function (t) { [523, 659, 784, 1047].forEach(function (f, i) { sTone('sine', f, t + i * 0.16, 0.6, 0.05); }); },
    door:    function (t) { sTone('sawtooth', 180, t, 0.35, 0.02, { f1: 260, lp: 700 }); sThud(t + 0.38, 220, 0.07, 0.08); sNoise(t + 0.38, 0.03, 0.06, { freq: 3000 }); },
    coffee:  function (t) { sNoise(t, 0.9, 0.06, { type: 'bandpass', freq: 400, q: 0.8, shape: 'flat', fade: true }); sNoise(t + 1.0, 1.2, 0.07, { type: 'bandpass', freq: 3500, q: 0.4, shape: 'swell' }); sTone('sine', 1500, t + 2.2, 0.15, 0.04); },
    power:   function (t) { sTone('sawtooth', 120, t, 0.6, 0.05, { f1: 30, lp: 400 }); sNoise(t, 0.3, 0.06, { type: 'lowpass', freq: 500, fade: true }); },
    breaker: function (t) { sThud(t, 320, 0.08, 0.05); sTone('square', 60, t + 0.1, 0.4, 0.02, { lp: 200 }); sTone('sine', 1200, t + 0.5, 0.1, 0.03); },
    sleep:   function (t) { [440, 392, 349, 330].forEach(function (f, i) { sTone('sine', f, t + i * 0.3, 0.5, 0.04); }); },
    levelup: function (t) { [523, 659, 784, 1047, 1319].forEach(function (f, i) { sTone('triangle', f, t + i * 0.1, 0.4, 0.06); }); sNoise(t + 0.5, 0.4, 0.05, { freq: 6000, fade: true }); },
    siren:   function (t) { for (var i = 0; i < 4; i++) sTone('sine', i % 2 ? 640 : 860, t + i * 0.32, 0.31, 0.05); },
    gate:    function (t) { sTone('sawtooth', 320, t, 0.9, 0.02, { f1: 260, lp: 1200 }); sTone('sawtooth', 480, t + 0.05, 0.8, 0.012, { f1: 380, lp: 1500 }); sThud(t + 1.0, 400, 0.05, 0.06); },
    lock:    function (t) { sThud(t, 400, 0.06, 0.05); sNoise(t + 0.05, 0.04, 0.08, { freq: 3500 }); sTone('sine', 1800, t + 0.1, 0.08, 0.03); },
    unlock:  function (t) { sNoise(t, 0.05, 0.08, { freq: 3000 }); sThud(t + 0.08, 300, 0.07, 0.06); },
    flap:    function (t) { for (var i = 0; i < 6; i++) sNoise(t + i * 0.09, 0.05, 0.08, { type: 'bandpass', freq: 900 + i * 100, q: 0.8 }); },
    vend:    function (t) { sBeep(t, 1200, 0.05, 0.03); sTone('square', 80, t + 0.15, 0.25, 0.03, { lp: 400 }); sThud(t + 0.5, 140, 0.12, 0.15); sNoise(t + 0.5, 0.15, 0.08, { type: 'lowpass', freq: 1200, fade: true }); },
    thunder: function (t) { sNoise(t, 2.6, 0.5, { type: 'lowpass', freq: 220, shape: 'swell', fade: true }); sTone('sine', 45, t + 0.1, 2.0, 0.12, { f1: 28 }); sNoise(t + 0.6, 1.4, 0.2, { type: 'lowpass', freq: 400, fade: true }); },
    beepback:function (t) { sBeep(t, 1100, 0.14, 0.05); },
    fanfare: function (t) { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { sTone('triangle', f, t + i * 0.12, 0.3, 0.06); }); },
    glass:   function (t) { for (var i = 0; i < 8; i++) sTone('sine', 2400 + Math.random() * 2400, t + i * 0.03, 0.08, 0.03); sNoise(t, 0.2, 0.1, { freq: 5000, fade: true }); }
  };
  function sfx(kind, opt) {
    if (!SET.sound) return;
    try { audio(); if (sfxBus) sfxBus.gain.value = SET.vol; var fn = SFX[kind] || SFX.click; fn(AC.currentTime, opt); } catch (e) {}
  }
  // ── Post-processing ───────────────────────────────────────────────
  var post = { rt: null, quad: null, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), scene: new THREE.Scene(), on: true, t: 0 };
  post.mat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.42 }, uGrain: { value: 0.035 }, uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uLift: { value: 0.012 }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uSat, uContrast, uLift, uFlash; varying vec2 vUv;',
      'float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'void main() {',
      '  vec2 uv = vUv; vec2 d = uv - 0.5;',
      '  float ca = 0.0012 * dot(d, d) * 4.0;',                                   // a whisper of chromatic spread at the edges
      '  vec3 c; c.r = texture2D(tDiffuse, uv + d * ca).r; c.g = texture2D(tDiffuse, uv).g; c.b = texture2D(tDiffuse, uv - d * ca).b;',
      '  float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uSat);',   // saturation
      '  c = (c - 0.5) * uContrast + 0.5 + uLift;',                                 // contrast and a lifted black
      '  float v = smoothstep(0.95, 0.25, length(d) * 1.15); c *= mix(1.0 - uVignette, 1.0, v);',   // vignette
      '  c += (hash(uv * 1000.0 + fract(uTime)) - 0.5) * uGrain * (1.0 - l * 0.6);',  // grain, heavier in the shadows
      '  c += uFlash;',
      '  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);',
      '}'].join('\n'),
    depthTest: false, depthWrite: false
  });
  post.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.mat); post.scene.add(post.quad);
  function postResize() { var w = Math.floor(window.innerWidth * renderer.getPixelRatio()), h = Math.floor(window.innerHeight * renderer.getPixelRatio()); if (post.rt) post.rt.dispose(); post.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, encoding: THREE.sRGBEncoding }); post.rt.samples = 0; }
  function renderFrame(dt) {
    if (!post.on || SET.quality === 'low') { renderer.setRenderTarget(null); renderer.render(scene, camera); post.calls = renderer.info.render.calls; return; }
    if (!post.rt || post.rt.width !== Math.floor(window.innerWidth * renderer.getPixelRatio())) postResize();
    post.t += dt; post.mat.uniforms.uTime.value = post.t; post.mat.uniforms.tDiffuse.value = post.rt.texture; post.mat.uniforms.uFlash.value = typeof weatherFlash === 'number' ? weatherFlash * 0.25 : 0;
    renderer.setRenderTarget(post.rt); renderer.render(scene, camera); post.calls = renderer.info.render.calls;
    renderer.setRenderTarget(null); renderer.render(post.scene, post.cam);
  }
  // ── Three.js world ────────────────────────────────────────────────
  var canvas = $('dc-canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // the sun map is redrawn on a timer, not every frame
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb0d4);
  scene.fog = new THREE.Fog(0x8fb0d4, 70, 190);
  var camera = new THREE.PerspectiveCamera(SET.fov, 1, 0.08, 260);
  var shadowDirty = true, shadowT = 0;
  var worldTime = 0;   // seconds since boot, for anything that sways, spins or pulses

  function resize() { var w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize);

  // Reflections: a small studio (dark shell, a few bright troffers, one warm and one cool wall) is drawn once and baked into
  // the environment map. It is dim on purpose: it is there so chrome, glass and screens have something to reflect, not to light the hall.
  function buildEnvStudio() {
    var es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: 0x0b0d0f, side: THREE.BackSide })));
    function pane(w, h, col, k, x, y, z, rx, ry) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k) })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); es.add(m); }
    pane(24, 24, 0x14100c, 1, 0, -5.9, 0, -Math.PI / 2); pane(24, 24, 0x141517, 1, 0, 5.9, 0, Math.PI / 2);
    [[-5, -4], [5, -4], [-5, 4], [5, 4], [0, 0]].forEach(function (p) { pane(3.0, 1.1, 0xfff4e2, 1.1, p[0], 5.8, p[1], Math.PI / 2); });
    pane(6, 4, 0xcfe4ff, 1.2, 0, 1, -11.8, 0, 0); pane(5, 3.5, 0xffd9a8, 0.9, 11.8, 0.5, 2, 0, -Math.PI / 2);
    var pm = new THREE.PMREMGenerator(renderer); pm.compileEquirectangularShader();
    try { var rt = pm.fromScene(es, 0.04); scene.environment = rt.texture; } catch (e) { /* no env map on this GPU: materials fall back to the lights */ }
    pm.dispose();
  }
  buildEnvStudio();

  // lights: a sun through the skylights, a sky bounce, and the hall's high bays
  var hemi = new THREE.HemisphereLight(0xdfeaff, 0x5a4d40, 0.45); scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff0d8, 1.1); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -36; sun.shadow.camera.right = 36; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; sun.shadow.camera.near = 1; sun.shadow.camera.far = 140; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);
  var hallLights = [];
  // nine high bays on a 20 x 15 m grid: the hall is 60 x 48 since 2026-10-02, and six lights on the old 20 x 10 grid left the edges dark
  [[-26, -15], [-9, -15], [9, -15], [26, -15], [-26, 0], [-9, 0], [9, 0], [26, 0], [-26, 15], [-9, 15], [9, 15], [26, 15]].forEach(function (p, i) {   // twelve since the 72 m hall
    // a shorter reach than the old 38 m: the floor under each bay is a pool and the aisle between two bays is a touch darker, the
    // way a real hall reads. Every third lamp is a slightly cooler tube, as a hall that has had its lamps replaced piecemeal is.
    var l = new THREE.PointLight(i % 3 === 2 ? 0xf3f0ff : 0xffeacc, 0.55, 28, 2); l.position.set(p[0], 7.3, p[1]); l.userData.warm = i % 3 !== 2; scene.add(l); hallLights.push(l);
  });
  // the three rooms' own lamps, under their troffers (they used to sit where the rooms were before the hall grew: in the open hall)
  var officeLight = new THREE.PointLight(0xfff8ea, 0.55, 9, 2); officeLight.position.set(32.5, 2.9, 21.2); scene.add(officeLight);
  var breakLight = new THREE.PointLight(0xffe9c8, 0.45, 8, 2); breakLight.position.set(-32.5, 2.9, -22.1); scene.add(breakLight);
  var lobbyLight = new THREE.PointLight(0xffe9c8, 0.4, 7, 2); lobbyLight.position.set(-33.7, 2.9, 21.2); scene.add(lobbyLight);
  var yardLights = [];   // filled by the lamp-post props
  // Three.js lights every pixel with every visible point light, whether or not the light can reach it, so thirty lamps mean thirty
  // evaluations per pixel. Every point light in the scene goes in one list and only the nearest few to the camera stay visible; the
  // rest are hidden. The visible count is held constant so the shaders are not recompiled when you walk from one end of the hall
  // to the other. A lamp inside a hidden group is left alone (the renderer skips it anyway). Lamps that are off sort last.
  var lightBudget = { n: 12, lights: null, scanT: 0, tickT: 0, tmp: new THREE.Vector3(), cam: new THREE.Vector3() };
  function updateLightBudget() {
    var t = worldTime;
    if (!lightBudget.lights || t - lightBudget.scanT > 2) { var list = []; scene.traverse(function (o) { if (o.isPointLight) list.push(o); }); lightBudget.lights = list; lightBudget.scanT = t; }
    if (t - lightBudget.tickT < 0.1) return; lightBudget.tickT = t;
    camera.getWorldPosition(lightBudget.cam);
    var cand = [];
    lightBudget.lights.forEach(function (l) {
      for (var p = l.parent; p; p = p.parent) if (p.visible === false) return;
      l.getWorldPosition(lightBudget.tmp); var d = lightBudget.tmp.distanceTo(lightBudget.cam);
      l.userData.budgetScore = (l.intensity > 0 ? 0 : 1e6) + Math.max(0, d - (l.distance || 40) * 0.25); cand.push(l);
    });
    cand.sort(function (a, b) { return a.userData.budgetScore - b.userData.budgetScore; });
    for (var i = 0; i < cand.length; i++) cand[i].visible = i < lightBudget.n;
  }

  // ── Textures: every one is drawn on a canvas at boot ──────────────
  function tex(w, h, draw, rx, ry) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; var ctx = c.getContext('2d'); draw(ctx, w, h);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function grain(ctx, w, h, n, alpha, dark) { for (var i = 0; i < n; i++) { var v = Math.floor(Math.random() * 255); ctx.fillStyle = 'rgba(' + (dark ? 0 : v) + ',' + (dark ? 0 : v) + ',' + (dark ? 0 : v) + ',' + alpha + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } }
  // soft blotches: water marks, oil, wear. Dark or light, a few big and many small.
  function blotches(ctx, w, h, n, rmin, rmax, dark, alpha) { for (var i = 0; i < n; i++) { var r = randf(rmin, rmax), x = Math.random() * w, y = Math.random() * h; var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + (dark ? '0,0,0,' : '255,255,255,') + alpha + ')'); g.addColorStop(1, 'rgba(' + (dark ? '0,0,0,0)' : '255,255,255,0)')); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } }
  function cracks(ctx, w, h, n, alpha) { for (var i = 0; i < n; i++) { ctx.strokeStyle = 'rgba(20,20,20,' + alpha + ')'; ctx.lineWidth = 1; ctx.beginPath(); var x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y); for (var k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; ctx.lineTo(x, y); } ctx.stroke(); } }
  var TEX = {
    concrete: tex(1024, 1024, function (c, w, h) {
      c.fillStyle = '#8b8d8e'; c.fillRect(0, 0, w, h); grain(c, w, h, 26000, 0.12); grain(c, w, h, 5000, 0.08, true);
      blotches(c, w, h, 30, 40, 160, true, 0.09); blotches(c, w, h, 16, 30, 110, false, 0.07); cracks(c, w, h, 10, 0.25);
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();   // the slab joints
      for (var i = 0; i < 6; i++) { c.strokeStyle = 'rgba(30,30,30,0.18)'; c.lineWidth = randf(6, 14); c.beginPath(); var x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.quadraticCurveTo(x + randf(-120, 120), y + randf(-120, 120), x + randf(-260, 260), y + randf(-260, 260)); c.stroke(); }   // tyre scuffs
    }, 5, 3.5),
    asphalt: tex(1024, 1024, function (c, w, h) { c.fillStyle = '#3d3f42'; c.fillRect(0, 0, w, h); grain(c, w, h, 50000, 0.16); grain(c, w, h, 12000, 0.12, true); for (var i = 0; i < 9000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(120,118,112,0.35)' : 'rgba(86,84,80,0.4)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } blotches(c, w, h, 10, 60, 260, true, 0.14); blotches(c, w, h, 6, 40, 160, false, 0.05); cracks(c, w, h, 16, 0.25); for (var s = 0; s < 4; s++) { c.strokeStyle = 'rgba(14,14,16,0.5)'; c.lineWidth = randf(3, 6); c.beginPath(); var x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (var k = 0; k < 8; k++) { x += randf(-60, 60); y += randf(-60, 60); c.lineTo(x, y); } c.stroke(); } }, 22, 22),
    corrugated: tex(512, 256, function (c, w, h) {
      c.fillStyle = '#9aa3ad'; c.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 16) { var g = c.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, '#7e8792'); g.addColorStop(0.5, '#b7bfc8'); g.addColorStop(1, '#7e8792'); c.fillStyle = g; c.fillRect(x, 0, 16, h); }
      grain(c, w, h, 2500, 0.06, true);
      for (var y = 24; y < h; y += 104) for (var rx = 8; rx < w; rx += 16) { c.fillStyle = 'rgba(40,45,50,0.5)'; c.beginPath(); c.arc(rx, y, 1.6, 0, 6.3); c.fill(); }   // rivet rows
      for (var i = 0; i < 8; i++) { var sx = Math.random() * w; var sg = c.createLinearGradient(0, h * 0.5, 0, h); sg.addColorStop(0, 'rgba(120,70,30,0)'); sg.addColorStop(1, 'rgba(110,60,25,0.35)'); c.fillStyle = sg; c.fillRect(sx, h * 0.5, randf(2, 6), h * 0.5); }   // rust streaks down from the fixings
    }, 8, 2),
    corrugatedDoor: tex(256, 256, function (c, w, h) { c.fillStyle = '#5d6771'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 20) { var g = c.createLinearGradient(0, y, 0, y + 20); g.addColorStop(0, '#4a535c'); g.addColorStop(0.5, '#7b858f'); g.addColorStop(1, '#4a535c'); c.fillStyle = g; c.fillRect(0, y, w, 20); } grain(c, w, h, 1500, 0.08, true); blotches(c, w, h, 6, 20, 60, true, 0.2); }, 2, 4),
    plaster: tex(256, 256, function (c, w, h) { c.fillStyle = '#e4e1d8'; c.fillRect(0, 0, w, h); grain(c, w, h, 2500, 0.05); blotches(c, w, h, 4, 20, 50, true, 0.05); }, 4, 2),
    wood: tex(256, 128, function (c, w, h) {
      c.fillStyle = '#b08a5a'; c.fillRect(0, 0, w, h);
      var drift = [randf(-6, 6), randf(-6, 6), randf(-6, 6)];
      for (var i = 0; i < 60; i++) { c.strokeStyle = 'rgba(80,50,20,' + (0.1 + Math.random() * 0.25) + ')'; c.lineWidth = 1 + Math.random() * 1.5; c.beginPath(); var y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + drift[0] + randf(-3, 3), w * 0.65, y + drift[1] + randf(-3, 3), w + 4, y + drift[2]); c.stroke(); }
      for (var p = 0; p < 500; p++) { c.fillStyle = 'rgba(60,35,10,0.18)'; c.fillRect(Math.random() * w, Math.random() * h, randf(3, 10), 1); }
      c.fillStyle = 'rgba(0,0,0,0.3)'; [0.2, 0.5, 0.8].forEach(function (f) { c.fillRect(0, h * f, w, 2); });   // the slat gaps of a pallet deck
    }, 1, 1),
    pallet: null,
    crate: tex(256, 256, function (c, w, h) { c.fillStyle = '#c9a26b'; c.fillRect(0, 0, w, h); grain(c, w, h, 2500, 0.1); c.fillStyle = 'rgba(70,45,15,0.55)'; for (var k = 1; k < 5; k++) c.fillRect(k * w / 5 - 2, 0, 4, h); c.fillStyle = 'rgba(70,45,15,0.35)'; c.fillRect(0, h * 0.12, w, 5); c.fillRect(0, h * 0.86, w, 5); c.fillStyle = '#2b3b4e'; for (var n = 0; n < 10; n++) { c.beginPath(); c.arc(w * (0.1 + (n % 5) * 0.2), h * (n < 5 ? 0.14 : 0.88), 2.5, 0, 6.3); c.fill(); } c.fillStyle = '#1f4e79'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('SEA FREIGHT', w / 2, h * 0.5); c.font = 'bold 13px sans-serif'; c.fillText('THIS WAY UP  ▲▲', w / 2, h * 0.64); c.textAlign = 'left'; }, 1, 1),
    strapped: tex(256, 256, function (c, w, h) { c.fillStyle = '#b7905f'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.08); c.fillStyle = '#d9c4a0'; c.fillRect(0, h * 0.42, w, h * 0.16); c.fillStyle = '#17191c'; c.fillRect(w * 0.22, 0, w * 0.07, h); c.fillRect(w * 0.71, 0, w * 0.07, h); c.fillStyle = '#5fd38d'; c.fillRect(w * 0.36, h * 0.62, w * 0.28, h * 0.22); c.fillStyle = '#0d1b2a'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('LAND', w * 0.5, h * 0.77); c.textAlign = 'left'; }, 1, 1),
    airbox: tex(256, 256, function (c, w, h) { c.fillStyle = '#f2f4f6'; c.fillRect(0, 0, w, h); grain(c, w, h, 1500, 0.04); c.fillStyle = '#ff6b5e'; c.beginPath(); c.moveTo(0, h * 0.78); c.lineTo(w, h * 0.5); c.lineTo(w, h * 0.66); c.lineTo(0, h * 0.94); c.closePath(); c.fill(); c.fillStyle = '#3fa7d6'; c.fillRect(0, 0, w, h * 0.08); c.fillStyle = '#0d1b2a'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('AIR PRIORITY', w / 2, h * 0.3); c.font = '12px sans-serif'; c.fillText('SKYBRIDGE AIR CARGO', w / 2, h * 0.42); c.textAlign = 'left'; c.fillStyle = '#222'; for (var i = 0; i < 16; i++) c.fillRect(w * 0.6 + i * 5, h * 0.12, Math.random() < 0.5 ? 1.5 : 3, h * 0.1); }, 1, 1),
    parcel: tex(256, 256, function (c, w, h) { c.fillStyle = '#b7905f'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.08); c.fillStyle = '#d9c4a0'; c.fillRect(0, h * 0.42, w, h * 0.16); c.fillStyle = '#ffffff'; c.fillRect(w * 0.55, h * 0.62, w * 0.36, h * 0.28); c.fillStyle = '#222'; for (var i = 0; i < 18; i++) c.fillRect(w * 0.57 + i * (w * 0.32 / 18), h * 0.66, Math.random() < 0.5 ? 2 : 4, h * 0.12); c.font = 'bold 14px sans-serif'; c.fillText('DEPOT CO.', w * 0.57, h * 0.87); c.strokeStyle = '#333'; c.lineWidth = 2; c.strokeRect(w * 0.08, h * 0.08, w * 0.3, h * 0.22); c.font = 'bold 11px sans-serif'; c.fillText('FRAGILE', w * 0.1, h * 0.2); c.fillText('▲ THIS WAY UP', w * 0.1, h * 0.27); }, 1, 1),
    grass: tex(512, 512, function (c, w, h) { c.fillStyle = '#4f6a3a'; c.fillRect(0, 0, w, h); var cols = ['#3f6f2e', '#5c8f44', '#6f9a4a', '#45752f', '#7ea25a']; for (var i = 0; i < 3000; i++) { var x = Math.random() * w, y = Math.random() * h; c.strokeStyle = cols[i % 5]; c.lineWidth = randf(0.8, 1.6); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + randf(-4, 4), y - randf(4, 9), x + randf(-6, 6), y - randf(8, 16)); c.stroke(); } c.fillStyle = 'rgba(70,50,30,.16)'; for (var d = 0; d < 20; d++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, randf(14, 40), randf(8, 22), Math.random() * 3, 0, 6.29); c.fill(); } }, 30, 30),
    skylight: tex(64, 64, function (c, w, h) { c.fillStyle = '#eef6ff'; c.fillRect(0, 0, w, h); }, 1, 1),
    hazard: tex(128, 32, function (c, w, h) { c.fillStyle = '#f5b53d'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; for (var x = -32; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 16, 0); c.lineTo(x + 32, h); c.lineTo(x + 16, h); c.closePath(); c.fill(); } grain(c, w, h, 300, 0.1, true); }, 4, 1),
    noiseMetal: tex(128, 128, function (c, w, h) { c.fillStyle = '#9ea4aa'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.1); }, 1, 1),
    vmesh: tex(128, 256, function (c, w, h) { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(60,96,70,1)'; c.lineWidth = 2.2; for (var vx = 4; vx < w; vx += 10) { c.beginPath(); c.moveTo(vx, 0); c.lineTo(vx, h); c.stroke(); } for (var hy = 4; hy < h; hy += 28) { c.beginPath(); c.moveTo(0, hy); c.lineTo(w, hy); c.stroke(); } }, 2, 1),
    mesh: tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(70,75,80,0.95)'; c.lineWidth = 2; for (var i = 0; i <= w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 16, h); c.stroke(); c.beginPath(); c.moveTo(i + 16, 0); c.lineTo(i, h); c.stroke(); } }, 8, 2),
    brick: tex(256, 256, function (c, w, h) { c.fillStyle = '#c9c2b4'; c.fillRect(0, 0, w, h); var cols = ['#8a4a3a', '#95553f', '#7c4335', '#9a5c45', '#874836', '#a0634c']; var bw = w / 8, bh = h / 8; for (var r = 0; r < 8; r++) for (var k = -1; k < 9; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = pick(cols); c.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4); } grain(c, w, h, 6000, 0.2); }, 2, 0.6),
    paper: tex(128, 128, function (c, w, h) { c.fillStyle = '#f3efe4'; c.fillRect(0, 0, w, h); grain(c, w, h, 800, 0.05); }, 1, 1),
    cork: tex(256, 256, function (c, w, h) { c.fillStyle = '#b8905c'; c.fillRect(0, 0, w, h); grain(c, w, h, 8000, 0.25); blotches(c, w, h, 60, 3, 10, true, 0.3); }, 1, 1),
    fabric: tex(128, 128, function (c, w, h) { c.fillStyle = '#2f4a73'; c.fillRect(0, 0, w, h); grain(c, w, h, 4000, 0.12); }, 1, 1),
    cloth: tex(128, 128, function (c, w, h) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) { c.fillStyle = 'rgba(0,0,0,' + (((x + y) / 2) % 2 ? 0.14 : 0.04) + ')'; c.fillRect(x, y, 2, 2); } }, 6, 6),   // a white weave that takes whatever colour a shirt is given
    rubberMat: tex(128, 128, function (c, w, h) { c.fillStyle = '#1b1d20'; c.fillRect(0, 0, w, h); c.fillStyle = '#24272b'; for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { c.beginPath(); c.arc(x + 8, y + 8, 5, 0, 6.3); c.fill(); } }, 6, 6),
    // painted blockwork: four courses of 400 x 200 blocks in a sheet 1.6 by 0.8 m, grey paint over grey block, a few blocks a shade off
    block: tex(512, 256, function (c, w, h) { c.fillStyle = '#6e7276'; c.fillRect(0, 0, w, h); var bw = w / 4, bh = h / 4; for (var r = 0; r < 4; r++) for (var k = -1; k < 5; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = pick(['#9a9c9a', '#959895', '#9fa19e', '#929592', '#9c9e9b']); c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6); } grain(c, w, h, 5000, 0.08); blotches(c, w, h, 10, 20, 70, true, 0.08); for (var i = 0; i < 40; i++) { c.fillStyle = 'rgba(40,40,42,' + randf(0.05, 0.2) + ')'; c.fillRect(Math.random() * w, h * 0.7 + Math.random() * h * 0.3, randf(2, 10), randf(2, 5)); } }, 1, 1),
    // carpet tile for the office: half-metre tiles in a blue-grey loop pile, the joints just showing, laid chequerboard
    carpet: tex(256, 256, function (c, w, h) { c.fillStyle = '#3f4857'; c.fillRect(0, 0, w, h); for (var ty = 0; ty < 2; ty++) for (var tx = 0; tx < 2; tx++) { c.fillStyle = (tx + ty) % 2 ? '#404a5a' : '#3b4453'; c.fillRect(tx * 128 + 1, ty * 128 + 1, 126, 126); } grain(c, w, h, 14000, 0.1); for (var y = 0; y < h; y += 3) { c.fillStyle = 'rgba(255,255,255,0.025)'; c.fillRect(0, y, w, 1); } }, 1, 1),
    // vinyl sheet for the lobby and the break room: a pale speckled floor with a faint weld line every 1.5 m
    vinyl: tex(256, 256, function (c, w, h) { c.fillStyle = '#c9c6bd'; c.fillRect(0, 0, w, h); for (var i = 0; i < 9000; i++) { c.fillStyle = pick(['rgba(90,86,80,0.35)', 'rgba(255,255,255,0.3)', 'rgba(120,110,100,0.25)']); c.fillRect(Math.random() * w, Math.random() * h, randf(1, 3), randf(1, 3)); } blotches(c, w, h, 6, 30, 90, true, 0.05); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, h / 2 - 1, w, 2); }, 1, 1)
  };
  function cardboardTex(col, name) {
    return tex(256, 256, function (c, w, h) {
      c.fillStyle = '#c69c6d'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.08); blotches(c, w, h, 4, 20, 60, true, 0.06);
      c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(0, h * 0.48, w, 4);                       // the flap seam
      c.fillStyle = 'rgba(190,170,130,0.55)'; c.fillRect(w * 0.44, 0, w * 0.12, h);           // packing tape
      c.fillStyle = col; c.fillRect(0, h * 0.8, w, h * 0.09);                                 // the client's colour band
      c.fillStyle = '#fff'; c.fillRect(w * 0.08, h * 0.08, w * 0.34, h * 0.3);                // the label
      c.fillStyle = '#222'; for (var i = 0; i < 16; i++) c.fillRect(w * 0.1 + i * (w * 0.3 / 16), h * 0.11, Math.random() < 0.5 ? 2 : 3, h * 0.13);
      c.font = 'bold 11px sans-serif'; c.fillStyle = '#333'; c.fillText((name || '').toUpperCase().slice(0, 14), w * 0.1, h * 0.31); c.font = '9px sans-serif'; c.fillText('SKU ' + Math.floor(Math.random() * 90000 + 10000), w * 0.1, h * 0.36);
      c.strokeStyle = 'rgba(40,40,40,0.8)'; c.lineWidth = 2; c.strokeRect(w * 0.62, h * 0.1, w * 0.28, h * 0.28);   // the handling icons: this way up, keep dry
      c.fillStyle = 'rgba(40,40,40,0.8)'; c.font = 'bold 18px sans-serif'; c.fillText('▲▲', w * 0.67, h * 0.24); c.font = '9px sans-serif'; c.fillText('THIS WAY UP', w * 0.635, h * 0.34);
      c.beginPath(); c.moveTo(w * 0.76, h * 0.62); c.quadraticCurveTo(w * 0.68, h * 0.72, w * 0.76, h * 0.76); c.quadraticCurveTo(w * 0.84, h * 0.72, w * 0.76, h * 0.62); c.fill(); c.font = '8px sans-serif'; c.fillText('KEEP DRY', w * 0.66, h * 0.72);
    });
  }
  // a sign on the house slate (#1b232c) is an enamelled plate: the slate shades a little towards the bottom, a hairline of
  // light sits just in from the edge and a hairline of the sign's own colour inside that. opt.plate false turns that off (paint)
  function isPlate(opt) { return !!opt && opt.plate !== false && (opt.plate === true || opt.bg === '#1b232c'); }
  function textTex(lines, opt) {
    opt = opt || {}; var w = opt.w || 512, h = opt.h || 128, plate = isPlate(opt);
    return tex(w, h, function (c) {
      if (plate) { var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#222c38'); g.addColorStop(1, '#10161d'); c.fillStyle = g; c.fillRect(0, 0, w, h); var e = Math.max(2, Math.round(Math.min(w, h) * 0.02)); c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = e; c.strokeRect(e / 2, e / 2, w - e, h - e); c.strokeStyle = opt.fg || '#f5b53d'; c.globalAlpha = 0.5; c.lineWidth = Math.max(1, e * 0.6); c.strokeRect(e * 3, e * 3, w - e * 6, h - e * 6); c.globalAlpha = 1; }
      else { c.fillStyle = opt.bg || '#1b232c'; c.fillRect(0, 0, w, h); }
      if (opt.border) { c.strokeStyle = opt.border; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); }
      c.fillStyle = opt.fg || '#f5b53d'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var size = opt.size || Math.min(h * 0.6, w / (Math.max.apply(null, lines.map(function (l) { return l.length; })) * 0.6));
      c.font = (opt.weight || 'bold') + ' ' + Math.floor(size) + 'px ' + (opt.font || 'Bahnschrift, Arial, sans-serif');
      if (plate) { c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = Math.max(2, size * 0.08); c.shadowOffsetY = Math.max(1, size * 0.04); }
      lines.forEach(function (l, i) { c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15); });
      c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    });
  }
  // the safety posters and notices on the walls: each one drawn once
  function posterTex(kind) {
    return tex(256, 384, function (c, w, h) {
      var title = function (t, col, y, size) { c.fillStyle = col; c.font = 'bold ' + (size || 30) + 'px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(t, w / 2, y); };
      var small = function (t, y, col) { c.fillStyle = col || '#333'; c.font = '15px "Segoe UI", Arial, sans-serif'; c.textAlign = 'center'; c.fillText(t, w / 2, y); };
      if (kind === 'forklift') { c.fillStyle = '#f5b53d'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.beginPath(); c.moveTo(w / 2, 40); c.lineTo(w - 24, h * 0.55); c.lineTo(24, h * 0.55); c.closePath(); c.fill(); c.fillStyle = '#f5b53d'; c.beginPath(); c.moveTo(w / 2, 70); c.lineTo(w - 48, h * 0.52); c.lineTo(48, h * 0.52); c.closePath(); c.fill(); c.fillStyle = '#111'; c.fillRect(w * 0.3, h * 0.33, 70, 36); c.fillRect(w * 0.3 + 70, h * 0.38, 40, 20); c.beginPath(); c.arc(w * 0.36, h * 0.47, 10, 0, 6.3); c.arc(w * 0.55, h * 0.47, 10, 0, 6.3); c.fill(); title('CAUTION', '#111', h * 0.68, 34); title('FORKLIFTS', '#111', h * 0.78, 28); small('Look both ways at the aisle ends', h * 0.9, '#111'); }
      else if (kind === 'lifting') { c.fillStyle = '#2c5f9e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(16, 16, w - 32, h - 32); c.fillStyle = '#2c5f9e'; c.beginPath(); c.arc(w / 2, h * 0.25, 18, 0, 6.3); c.fill(); c.fillRect(w / 2 - 12, h * 0.3, 24, 60); c.fillRect(w / 2 - 36, h * 0.42, 72, 14); c.fillRect(w / 2 - 14, h * 0.45, 10, 50); c.fillRect(w / 2 + 4, h * 0.45, 10, 50); title('LIFT WITH', '#2c5f9e', h * 0.72, 28); title('YOUR LEGS', '#2c5f9e', h * 0.8, 28); small('Bend your knees, keep your back straight', h * 0.9); }
      else if (kind === 'exit') { c.fillStyle = '#2f9e44'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(16, 16, w - 32, h - 32); c.fillStyle = '#2f9e44'; title('FIRE EXIT', '#2f9e44', h * 0.2, 34); c.fillRect(w * 0.2, h * 0.3, w * 0.6, 8); c.beginPath(); c.moveTo(w * 0.3, h * 0.6); c.lineTo(w * 0.7, h * 0.6); c.lineTo(w * 0.7, h * 0.5); c.lineTo(w * 0.86, h * 0.65); c.lineTo(w * 0.7, h * 0.8); c.lineTo(w * 0.7, h * 0.7); c.lineTo(w * 0.3, h * 0.7); c.closePath(); c.fill(); small('Keep this route clear at all times', h * 0.9); }
      else if (kind === 'nosmoking') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8342a'; c.lineWidth = 14; c.beginPath(); c.arc(w / 2, h * 0.38, 80, 0, 6.3); c.stroke(); c.fillStyle = '#333'; c.fillRect(w / 2 - 50, h * 0.37, 100, 12); c.strokeStyle = '#c8342a'; c.beginPath(); c.moveTo(w / 2 - 56, h * 0.38 - 56); c.lineTo(w / 2 + 56, h * 0.38 + 56); c.stroke(); title('NO SMOKING', '#c8342a', h * 0.75, 30); small('Shelter is outside, by the car park', h * 0.86); }
      else if (kind === 'stacking') { c.fillStyle = '#f3efe4'; c.fillRect(0, 0, w, h); title('PALLET RULES', '#1b232c', 46, 28); c.fillStyle = '#333'; c.font = '15px "Segoe UI", Arial, sans-serif'; c.textAlign = 'left'; ['1. One line per slot', '2. Twelve boxes, no more', '3. Heavy at the bottom', '4. Labels facing the aisle', '5. Nothing on the floor', '6. Wrap before it moves'].forEach(function (t, i) { c.fillText(t, 28, 90 + i * 34); }); c.fillStyle = '#f5b53d'; c.fillRect(28, h - 56, w - 56, 24); c.fillStyle = '#111'; c.font = 'bold 14px Bahnschrift, Arial'; c.textAlign = 'center'; c.fillText('THE INSPECTOR CHECKS', w / 2, h - 39); }
      else if (kind === 'rota') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); title('SHIFT ROTA', '#1b232c', 40, 26); c.strokeStyle = '#999'; c.lineWidth = 1; for (var r = 0; r < 8; r++) { c.strokeRect(20, 60 + r * 36, w - 40, 36); } c.fillStyle = '#333'; c.font = '14px "Segoe UI", Arial'; c.textAlign = 'left'; ['Mon  Jo · Mika', 'Tue  Sam · Jo', 'Wed  Mika · Ravi', 'Thu  Jo · Lena', 'Fri  Sam · Mika', 'Sat  Ada · Theo', 'Sun  closed', 'Breaks 12:00 to 12:30'].forEach(function (t, i) { c.fillText(t, 30, 84 + i * 36); }); }
      else if (kind === 'hands') { c.fillStyle = '#2c5f9e'; c.fillRect(0, 0, w, h); title('WASH YOUR', '#fff', h * 0.3, 30); title('HANDS', '#fff', h * 0.42, 30); c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h * 0.65, 50, 0, 6.3); c.fill(); c.fillStyle = '#2c5f9e'; c.beginPath(); c.arc(w / 2, h * 0.65, 36, 0, 6.3); c.fill(); small('Before you eat, after the yard', h * 0.9, '#fff'); }
      else { c.fillStyle = '#1b232c'; c.fillRect(0, 0, w, h); title('DEPOT CO.', '#f5b53d', h * 0.3, 34); title('SAFETY FIRST', '#fff', h * 0.42, 24); c.fillStyle = '#f5b53d'; c.fillRect(w * 0.2, h * 0.5, w * 0.6, 4); small('Days without an accident', h * 0.62, '#a0acb8'); title(String(randi(3, 180)), '#5fd38d', h * 0.78, 64); }
    });
  }
  var POSTER_KINDS = ['forklift', 'lifting', 'exit', 'nosmoking', 'stacking', 'rota', 'hands', 'safety'];
  // normal maps: a height field drawn on a canvas, turned into tangent-space normals with a Sobel filter. Linear, never sRGB.
  function normalTex(w, h, drawHeight, strength, rx, ry) {
    var hc = document.createElement('canvas'); hc.width = w; hc.height = h; var hx = hc.getContext('2d'); drawHeight(hx, w, h);
    var src = hx.getImageData(0, 0, w, h).data, out = hx.createImageData(w, h), o = out.data, s = strength || 1;
    var at = function (x, y) { x = (x + w) % w; y = (y + h) % h; return src[(y * w + x) * 4] / 255; };
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      var dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      var nx = -dx * s, ny = -dy * s, nz = 1, len = Math.sqrt(nx * nx + ny * ny + nz * nz), i = (y * w + x) * 4;
      o[i] = (nx / len * 0.5 + 0.5) * 255; o[i + 1] = (ny / len * 0.5 + 0.5) * 255; o[i + 2] = (nz / len * 0.5 + 0.5) * 255; o[i + 3] = 255;
    }
    hx.putImageData(out, 0, 0);
    var t = new THREE.CanvasTexture(hc); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 8; return t;
  }
  function heightNoise(c, w, h, base, n, amp) { c.fillStyle = base; c.fillRect(0, 0, w, h); for (var i = 0; i < n; i++) { var v = Math.floor(128 + (Math.random() - 0.5) * amp); c.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.6)'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 4), randf(1, 4)); } }
  var NRM = {
    concrete: normalTex(512, 512, function (c, w, h) { heightNoise(c, w, h, '#808080', 14000, 90); for (var i = 0; i < 20; i++) { var r = randf(20, 90), x = Math.random() * w, y = Math.random() * h, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(60,60,60,0.5)'); g.addColorStop(1, 'rgba(128,128,128,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } c.strokeStyle = '#303030'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); }, 1.6, 5, 3.5),
    corrugated: normalTex(256, 128, function (c, w, h) { for (var x = 0; x < w; x++) { var v = Math.floor(128 + Math.sin(x / 16 * Math.PI * 2) * 90); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(x, 0, 1, h); } for (var y = 12; y < h; y += 52) for (var rx = 8; rx < w; rx += 16) { c.fillStyle = '#404040'; c.beginPath(); c.arc(rx, y, 2.2, 0, 6.3); c.fill(); } }, 2.2, 8, 2),
    ribs: normalTex(128, 256, function (c, w, h) { for (var y = 0; y < h; y++) { var v = Math.floor(128 + Math.sin(y / 20 * Math.PI * 2) * 100); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(0, y, w, 1); } }, 2.0, 2, 4),
    asphalt: normalTex(512, 512, function (c, w, h) { heightNoise(c, w, h, '#808080', 40000, 120); }, 1.2, 22, 22),
    plaster: normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 3000, 40); }, 0.8, 4, 2),
    brick: normalTex(256, 256, function (c, w, h) { c.fillStyle = '#a0a0a0'; c.fillRect(0, 0, w, h); var bw = w / 8, bh = h / 8; for (var r = 0; r < 8; r++) for (var k = -1; k < 9; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = '#404040'; c.fillRect(x, r * bh, bw, bh); c.fillStyle = '#a8a8a8'; c.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4); } heightNoise(c, w, h, 'rgba(0,0,0,0)', 2000, 30); }, 1.8, 2, 0.6),
    wood: normalTex(256, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var i = 0; i < 70; i++) { var y = Math.random() * h; c.strokeStyle = 'rgba(40,40,40,' + randf(0.2, 0.6) + ')'; c.lineWidth = randf(1, 2); c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + randf(-4, 4), w * 0.7, y + randf(-4, 4), w, y); c.stroke(); } c.fillStyle = '#202020'; [0.2, 0.5, 0.8].forEach(function (f) { c.fillRect(0, h * f, w, 3); }); }, 1.2, 1, 1),
    cardboard: normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 2500, 30); c.fillStyle = '#505050'; c.fillRect(0, h * 0.48, w, 4); c.fillStyle = '#9a9a9a'; c.fillRect(w * 0.44, 0, w * 0.12, h); c.fillStyle = '#8c8c8c'; c.fillRect(w * 0.08, h * 0.08, w * 0.34, h * 0.3); for (var i = 0; i < h; i += 6) { c.fillStyle = 'rgba(100,100,100,0.25)'; c.fillRect(0, i, w, 1); } }, 1.0, 1, 1),
    chequer: normalTex(128, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) { var d = ((x + y) / 32) % 2; c.save(); c.translate(x + 16, y + 16); c.rotate(d ? 0.5 : -0.5); c.fillStyle = '#c0c0c0'; c.fillRect(-10, -3, 20, 6); c.restore(); } }, 1.5, 3, 3),
    rubber: normalTex(128, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { c.fillStyle = '#b0b0b0'; c.beginPath(); c.arc(x + 8, y + 8, 5, 0, 6.3); c.fill(); } }, 1.2, 6, 6),
    block: normalTex(512, 256, function (c, w, h) { c.fillStyle = '#505050'; c.fillRect(0, 0, w, h); var bw = w / 4, bh = h / 4; for (var r = 0; r < 4; r++) for (var k = -1; k < 5; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = '#9a9a9a'; c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6); } heightNoise(c, w, h, 'rgba(0,0,0,0)', 3000, 30); }, 1.6, 1, 1),
    carpet: normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 6000, 50); c.fillStyle = '#606060'; c.fillRect(0, 127, w, 2); c.fillRect(127, 0, 2, h); }, 0.9, 1, 1)
  };
  function roughTex(w, h, base, amp, rx, ry) { var t = tex(w, h, function (c) { var v = Math.floor(base * 255); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(0, 0, w, h); for (var i = 0; i < 4000; i++) { var k = Math.floor(v + (Math.random() - 0.5) * amp * 255); c.fillStyle = 'rgba(' + k + ',' + k + ',' + k + ',0.7)'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 6), randf(1, 6)); } for (var j = 0; j < 12; j++) { var r = randf(10, 50), x = Math.random() * w, y = Math.random() * h, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + Math.floor(v - amp * 120) + ',' + Math.floor(v - amp * 120) + ',' + Math.floor(v - amp * 120) + ',0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } }, rx, ry); t.encoding = THREE.LinearEncoding; return t; }
  var RGH = { floor: roughTex(256, 256, 0.9, 0.25, 5, 3.5), paint: roughTex(256, 256, 0.45, 0.35, 1, 1), metal: roughTex(256, 256, 0.5, 0.3, 1, 1) };

  // ── Materials ─────────────────────────────────────────────────────
  var std = function (o) { return new THREE.MeshStandardMaterial(o); };
  var MAT = {
    floor: std({ map: TEX.concrete, roughness: 0.92, metalness: 0.03, normalMap: NRM.concrete, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: RGH.floor }),
    yard: std({ map: TEX.asphalt, roughness: 0.95, normalMap: NRM.asphalt, normalScale: new THREE.Vector2(0.6, 0.6) }),
    grass: std({ map: TEX.grass, roughness: 1 }),
    wall: std({ map: TEX.corrugated, roughness: 0.55, metalness: 0.4, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(1, 1), roughnessMap: RGH.metal }),
    wallIn: std({ map: TEX.corrugated, roughness: 0.65, metalness: 0.3, color: 0xcfd6dd, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(1, 1) }),
    roof: std({ color: 0x3b4249, roughness: 0.9 }),
    roofIn: std({ color: 0x5c6670, roughness: 0.9, side: THREE.BackSide }),
    door: std({ map: TEX.corrugatedDoor, roughness: 0.55, metalness: 0.4, normalMap: NRM.ribs, normalScale: new THREE.Vector2(1, 1) }),
    plaster: std({ map: TEX.plaster, roughness: 0.9, normalMap: NRM.plaster, normalScale: new THREE.Vector2(0.4, 0.4) }),
    brick: std({ map: TEX.brick, roughness: 0.95, normalMap: NRM.brick, normalScale: new THREE.Vector2(0.9, 0.9) }),
    block: std({ map: TEX.block, roughness: 0.9, normalMap: NRM.block, normalScale: new THREE.Vector2(0.8, 0.8) }),
    carpet: std({ map: TEX.carpet, roughness: 1, normalMap: NRM.carpet, normalScale: new THREE.Vector2(0.4, 0.4) }),
    vinyl: std({ map: TEX.vinyl, roughness: 0.45, metalness: 0.02 }),
    gunmetal: std({ color: 0x4a5058, roughness: 0.38, metalness: 0.85, map: TEX.noiseMetal }),
    rack: std({ color: 0xcf6417, roughness: 0.55, metalness: 0.3, roughnessMap: RGH.paint }),
    beam: std({ color: 0x2b5aa6, roughness: 0.5, metalness: 0.4 }),
    deck: std({ color: 0x6a737c, roughness: 0.7, metalness: 0.5 }),
    wood: std({ map: TEX.wood, roughness: 0.85, normalMap: NRM.wood, normalScale: new THREE.Vector2(0.6, 0.6) }),
    parcel: std({ map: TEX.parcel, roughness: 0.9, normalMap: NRM.cardboard, normalScale: new THREE.Vector2(0.5, 0.5) }),
    crate: std({ map: TEX.crate, roughness: 0.85, normalMap: NRM.wood, normalScale: new THREE.Vector2(0.5, 0.5) }),
    strapped: std({ map: TEX.strapped, roughness: 0.9, normalMap: NRM.cardboard, normalScale: new THREE.Vector2(0.5, 0.5) }),
    airbox: std({ map: TEX.airbox, roughness: 0.6 }),
    steel: std({ map: TEX.noiseMetal, roughness: 0.45, metalness: 0.6 }),
    steelDark: std({ color: 0x3a3f45, roughness: 0.5, metalness: 0.6 }),
    chrome: std({ color: 0xd8dde3, roughness: 0.18, metalness: 0.95 }),
    black: std({ color: 0x15171a, roughness: 0.8 }),
    plastic: std({ color: 0x2a2d33, roughness: 0.6 }),
    rubber: std({ color: 0x1d1f22, roughness: 0.95 }),
    rubberMat: std({ map: TEX.rubberMat, roughness: 0.95, normalMap: NRM.rubber, normalScale: new THREE.Vector2(0.8, 0.8) }),
    chequer: std({ color: 0x8e959c, roughness: 0.45, metalness: 0.7, normalMap: NRM.chequer, normalScale: new THREE.Vector2(1, 1) }),
    yellow: std({ color: 0xf5b53d, roughness: 0.6 }),
    yellowLine: new THREE.MeshBasicMaterial({ color: 0xd9a12c }),
    whiteLine: new THREE.MeshBasicMaterial({ color: 0xd8dbdf }),
    hazard: std({ map: TEX.hazard, roughness: 0.6 }),
    mesh: std({ map: TEX.mesh, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 }),
    red: std({ color: 0xc8342a, roughness: 0.6 }),
    green: std({ color: 0x2f9e44, roughness: 0.6 }),
    blue: std({ color: 0x2f6fb3, roughness: 0.6 }),
    white: std({ color: 0xf0f0f0, roughness: 0.6 }),
    grey: std({ color: 0x8c949c, roughness: 0.7 }),
    trim: std({ color: 0xf2efe6, roughness: 0.8 }),
    paper: std({ map: TEX.paper, roughness: 0.95 }),
    cork: std({ map: TEX.cork, roughness: 0.95 }),
    fabric: std({ map: TEX.fabric, roughness: 1 }),
    screen: new THREE.MeshBasicMaterial({ color: 0x0d1216 }),
    screenGlass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false }),
    skylight: new THREE.MeshBasicMaterial({ map: TEX.skylight }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff6e4 }),
    exit: new THREE.MeshBasicMaterial({ color: 0x5fd38d }),
    glass: std({ color: 0xa9c7e8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.3 }),
    forkYellow: new THREE.MeshPhysicalMaterial({ color: 0xf2b705, roughness: 0.42, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.25, roughnessMap: RGH.paint }),
    truckRed: new THREE.MeshPhysicalMaterial({ color: 0xb8322a, roughness: 0.4, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2, roughnessMap: RGH.paint }),
    truckBlue: new THREE.MeshPhysicalMaterial({ color: 0x2c5f9e, roughness: 0.4, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2, roughnessMap: RGH.paint }),
    trailer: std({ map: TEX.corrugated, color: 0xf0f2f4, roughness: 0.55, metalness: 0.25, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(0.8, 0.8) }),
    container: std({ map: TEX.corrugated, color: 0x1f4e79, roughness: 0.6, metalness: 0.3, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(1.0, 1.0) }),   // a sea truck's box
    trailerIn: std({ color: 0x9aa0a6, roughness: 0.8, side: THREE.BackSide }),
    skin: std({ color: 0xd9a98a, roughness: 0.8 }),
    hivis: std({ color: 0xf6c21b, roughness: 0.8 }),
    hivisOrange: std({ color: 0xf07a1a, roughness: 0.8 }),
    jeans: std({ color: 0x2e3f63, roughness: 0.95 }),
    hair: std({ color: 0x3a2a1c, roughness: 0.95 }),
    hit: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  };
  function glowMat(col, k) { var m = std({ color: 0x111111, emissive: col, emissiveIntensity: k || 1, roughness: 0.4 }); m.userData.glow = true; return m; }
  var CARD = {}; SKUS.forEach(function (s) { CARD[s.id] = std({ map: cardboardTex(s.col, s.name), roughness: 0.9, normalMap: NRM.cardboard, normalScale: new THREE.Vector2(0.45, 0.45) }); });
  // the environment map is for reflections only: every lit material takes very little light from it
  function dimEnv(m) { if (m && m.isMeshStandardMaterial) m.envMapIntensity = m.isMeshPhysicalMaterial ? 0.45 : (m.metalness > 0.5 ? 0.4 : 0.22); return m; }
  Object.keys(MAT).forEach(function (k) { dimEnv(MAT[k]); }); Object.keys(CARD).forEach(function (k) { dimEnv(CARD[k]); });
  var std0 = std; std = function (o) { return dimEnv(std0(o)); };
  // a ceiling tile for the rooms, and a plain lining for the inside of a trailer
  TEX.tile = tex(256, 256, function (c, w, h) { c.fillStyle = '#e9e9e4'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.05, true); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); }, 6, 4);
  TEX.lining = tex(256, 256, function (c, w, h) { c.fillStyle = '#c9cdd1'; c.fillRect(0, 0, w, h); grain(c, w, h, 2500, 0.08); for (var y = 0; y < h; y += 64) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, y, w, 3); } for (var i = 0; i < 24; i++) { c.fillStyle = 'rgba(0,0,0,' + randf(0.05, 0.18) + ')'; c.fillRect(Math.random() * w, Math.random() * h, randf(10, 40), randf(2, 6)); } }, 6, 2);
  MAT.tile = std({ map: TEX.tile, roughness: 0.95 }); MAT.lining = std({ map: TEX.lining, roughness: 0.8, metalness: 0.15 }); MAT.trailerIn = MAT.lining;

  // ── Geometry helpers ──────────────────────────────────────────────
  var geoCache = {};
  function boxGeo(w, h, d) { var k = w + ',' + h + ',' + d; return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d)); }
  // A box with every edge eased: a dead sharp edge catches no light and reads as cardboard. The rows of vertices nearest each edge
  // are moved onto an arc, spaced so the corner turns in equal angles, and the normals follow; the texture keeps its scale (the
  // picture did not move, only the rows). Thinner than 30 mm or longer than 4 m stays sharp unless a radius is asked for.
  var BEVEL = { max: 0.012, faces: [['z', 'y', -1, -1], ['z', 'y', 1, -1], ['x', 'z', 1, 1], ['x', 'z', 1, -1], ['x', 'y', 1, -1], ['x', 'y', -1, -1]] };
  function bevelGeo(w, h, d, r, k) {
    var mn = Math.min(w, h, d), mx = Math.max(w, h, d);
    if (r === undefined) r = (mn < 0.03 || mx > 4) ? 0 : Math.min(BEVEL.max, mn * 0.22);
    if (!(r > 0) || !(mn > 0)) return boxGeo(w, h, d);
    r = Math.min(r, mn * 0.499); k = Math.max(1, Math.round(k || (r > 0.03 ? 3 : r > 0.015 ? 2 : 1)));   /* a big radius needs more than one step to read as round */
    var key = 'b' + w + ',' + h + ',' + d + ',' + r + ',' + k; if (geoCache[key]) return geoCache[key];
    var n = 2 * k + 1, per = (n + 1) * (n + 1), g = new THREE.BoxGeometry(w, h, d, n, n, n), pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, half = { x: w / 2, y: h / 2, z: d / 2 }, v = new THREE.Vector3(), c = new THREE.Vector3();
    function ax(p, hf) { var i = Math.round((p + hf) / (2 * hf) * n); return i <= k ? -hf + r - r * Math.tan((k - i) / k * Math.PI / 4) : hf - r + r * Math.tan((i - (n - k)) / k * Math.PI / 4); }
    for (var i = 0; i < pos.count; i++) {
      v.set(ax(pos.getX(i), half.x), ax(pos.getY(i), half.y), ax(pos.getZ(i), half.z));
      var fc = BEVEL.faces[Math.floor(i / per)]; uv.setXY(i, (v[fc[0]] * fc[2] + half[fc[0]]) / (2 * half[fc[0]]), 1 - (v[fc[1]] * fc[3] + half[fc[1]]) / (2 * half[fc[1]]));
      c.set(clamp(v.x, -half.x + r, half.x - r), clamp(v.y, -half.y + r, half.y - r), clamp(v.z, -half.z + r, half.z - r));
      v.sub(c); if (v.lengthSq() > 1e-12) { v.normalize(); nor.setXYZ(i, v.x, v.y, v.z); pos.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r); }
    }
    return (geoCache[key] = g);
  }
  // a body part cut from an eased box: narrower at one end than the other, the way a chest runs down to a waist. Give it a fresh geometry.
  function taperGeo(g, h, sx0, sz0) { var p = g.attributes.position; for (var i = 0; i < p.count; i++) { var t = clamp((p.getY(i) + h / 2) / h, 0, 1); p.setX(i, p.getX(i) * lerp(sx0, 1, t)); p.setZ(i, p.getZ(i) * lerp(sz0, 1, t)); } g.computeVertexNormals(); return g; }
  // The same for anything turned: a cylinder's rims are eased and it gets enough sides to read as round. Wires and rods are left alone.
  function roundCylGeo(rt, rb, h, seg) {
    var rmax = Math.max(rt, rb), rmin = Math.min(rt, rb), r = (rmax < 0.025 || h < 0.02) ? 0 : Math.min(BEVEL.max, h * 0.22, rmin * 0.3);
    seg = seg || 18; if (rmax >= 0.025) seg = Math.max(seg, rmax > 0.12 ? 32 : rmax > 0.05 ? 24 : 16);
    var key = 'c' + rt + ',' + rb + ',' + h + ',' + seg; if (geoCache[key]) return geoCache[key];
    if (!(r > 0.0012)) return (geoCache[key] = new THREE.CylinderGeometry(rt, rb, h, seg));
    var g = new THREE.CylinderGeometry(rt, rb, h, seg, 3), pos = g.attributes.position, nor = g.attributes.normal, row = seg + 1, torso = 4 * row, slope = (rb - rt) / h;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), top = pos.getY(i) > 0, len = Math.hypot(x, z) || 1, ux = x / len, uz = z / len, rad, y;
      if (i < torso) {
        var rw = Math.floor(i / row);
        if (rw === 0) { rad = rt - r; y = h / 2; } else if (rw === 1) { rad = rt + slope * r; y = h / 2 - r; } else if (rw === 2) { rad = rb - slope * r; y = -h / 2 + r; } else { rad = rb - r; y = -h / 2; }
        if (rw === 0 || rw === 3) { var ny = rw === 0 ? 0.7071 : -0.7071; nor.setXYZ(i, nor.getX(i) * 0.7071, ny, nor.getZ(i) * 0.7071); var nl = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)) || 1; nor.setXYZ(i, nor.getX(i) / nl, nor.getY(i) / nl, nor.getZ(i) / nl); }
        pos.setXYZ(i, ux * rad, y, uz * rad);
      } else if (len > 1e-6) { rad = (top ? rt : rb) - r; pos.setXYZ(i, ux * rad, pos.getY(i), uz * rad); }
    }
    return (geoCache[key] = g);
  }
  function box(w, h, d, mat, x, y, z, parent) {
    var m = new THREE.Mesh(mat.map ? boxGeo(w, h, d) : bevelGeo(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m;
  }
  function plane(w, h, mat, x, y, z, rx, ry, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.x = rx || 0; m.rotation.y = ry || 0; m.receiveShadow = true; (parent || scene).add(m); return m;
  }
  function cyl(r, h, mat, x, y, z, parent, seg, rb) { var m = new THREE.Mesh(roundCylGeo(r, rb === undefined ? r : rb, h, seg || 12), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m; }
  function sphere(r, mat, x, y, z, parent) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); m.position.set(x, y, z); m.castShadow = true; (parent || scene).add(m); return m; }
  function sign(lines, w, h, x, y, z, ry, opt, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(lines, opt) })); m.position.set(x, y, z); m.rotation.y = ry || 0; (parent || scene).add(m);
    // an enamelled plate is fixed to something: a sheet of dark metal a little bigger than the print behind it, and on a plate
    // big enough, four studs through the corners. Hung on the sign's own mesh, so whatever moves the sign moves its plate.
    if (isPlate(opt) && !(opt && opt.flat)) { var pl = new THREE.Mesh(bevelGeo(w + 0.03, h + 0.03, 0.014, 0.004), MAT.gunmetal); pl.position.z = -0.0085; pl.castShadow = true; m.add(pl); if (w >= 0.5 && h >= 0.12) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { var st = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 10), MAT.chrome); st.rotation.x = Math.PI / 2; st.position.set(s[0] * (w / 2 - 0.028), s[1] * (h / 2 - 0.028), 0.003); m.add(st); }); }
    return m;
  }
  function poster(kind, w, h, x, y, z, ry, parent) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: posterTex(kind), roughness: 0.95 })); m.position.set(x, y, z); m.rotation.y = ry || 0; (parent || scene).add(m); return m; }
  // a soft dark blob on the ground under anything that stands on it: the contact shadow the sun map cannot give
  var blobTex = tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  var blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 1 }); blobMat.userData.noBake = true;
  function groundBlob(w, d, x, z, parent, y) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blobMat); m.rotation.x = -Math.PI / 2; m.position.set(x, (y || 0) + 0.006, z); m.renderOrder = 1; m.receiveShadow = false; m.userData.noBake = true; (parent || scene).add(m); return m; }
  // things the player can look at and press E on
  var inter = [];
  function addInter(mesh, def) { mesh.userData.it = def; inter.push(mesh); return mesh; }
  function hitBox(w, h, d, x, y, z, def, parent) { var m = new THREE.Mesh(boxGeo(w, h, d), MAT.hit); m.position.set(x, y, z); (parent || scene).add(m); return addInter(m, def); }
  // things the player cannot walk through: axis-aligned boxes in world space
  var solids = [], dyn = [];
  function solid(x0, x1, z0, z1, y0, y1) { solids.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: y0 === undefined ? -5 : y0, y1: y1 === undefined ? 9 : y1 }); }
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  // things that move every frame: { update: function (dt) }
  var animated = [];
  function animate(fn) { animated.push(fn); }
  // a short-lived burst of particles: sparks, dust, water, cardboard chips
  var bursts = [];
  function burst(x, y, z, col, n, mode) {
    n = n || 20; var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (var i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; var a = Math.random() * 6.28, s = randf(0.6, 2.2); vel.push({ x: Math.cos(a) * s * (mode === 'up' ? 0.3 : 1), y: mode === 'up' ? randf(1.5, 3) : mode === 'down' ? -randf(0.5, 1.5) : randf(0.5, 2.5), z: Math.sin(a) * s * (mode === 'up' ? 0.3 : 1) }); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({ color: col, size: mode === 'smoke' ? 0.12 : 0.05, transparent: true, opacity: 0.9, depthWrite: false });
    var pts = new THREE.Points(geo, mat); scene.add(pts);
    bursts.push({ pts: pts, vel: vel, t: 0, life: mode === 'smoke' ? 2.4 : 1.1, mode: mode });
  }
  function tickBursts(dt) {
    for (var i = bursts.length - 1; i >= 0; i--) {
      var b = bursts[i]; b.t += dt; var p = b.pts.geometry.attributes.position.array;
      for (var k = 0; k < b.vel.length; k++) { var v = b.vel[k]; if (b.mode !== 'smoke') v.y -= 6 * dt; else v.y += 0.4 * dt; p[k * 3] += v.x * dt; p[k * 3 + 1] += v.y * dt; p[k * 3 + 2] += v.z * dt; if (p[k * 3 + 1] < 0.02 && b.mode !== 'smoke') { p[k * 3 + 1] = 0.02; v.y = -v.y * 0.4; v.x *= 0.6; v.z *= 0.6; } }
      b.pts.geometry.attributes.position.needsUpdate = true; b.pts.material.opacity = 0.9 * (1 - b.t / b.life);
      if (b.t >= b.life) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
    }
  }
  // ── The building ──────────────────────────────────────────────────
  var doors = [];          // 0,1 inbound (west wall), 2,3 outbound (east wall): { side, z, panel, anim, control }
  var rackGroups = [null, null, null, null];
  var slotHits = {};       // key -> hit mesh
  var bayLabelTex = {};
  var world = { boardTex: null, boardCtx: null, boardMat: null, lampMeshes: [], officeLamp: null, cot: null, coffeeMachine: null, pcScreen: null };

  function slotKey(r, b, l) { return r + ',' + b + ',' + l; }
  function slotParse(key) { var p = key.split(',').map(Number); return { r: p[0], b: p[1], l: p[2] }; }
  function rackSlotPos(r, b, l) { var P = PROPS['rack' + r] ? propPlacement('rack' + r) : { x: 0, z: RACK.rows[r], rot: 0 }, a = P.rot * Math.PI / 2, lx = RACK.x0 + RACK.bayW * (b + 0.5); return { x: P.x + lx * Math.cos(a), y: RACK.levels[l] + (r === UPPER.row ? UPPER.y : 0), z: P.z - lx * Math.sin(a), ry: a }; }
  function slotName(key) { var p = slotParse(key); return rowName(p.r) + ', bay ' + (p.b + 1) + (p.l === 0 ? ', floor' : p.l === 1 ? ', shelf' : ', top'); }
  function rowName(r) { return r === UPPER.row ? 'Upper row' : isAnnexRow(r) ? HALLS[hallOfRow(r)].name + ' row ' + rowLetter(r) : 'Row ' + 'ABCDEF'[r]; }

  function buildWorld() {
    var X = HALL.x, Z = HALL.z, H = HALL.h;
    // the hall floor (the ground outside is the yard's job)
    var fl = plane(2 * X, 2 * Z, MAT.floor, 0, 0.001, 0, -Math.PI / 2); fl.receiveShadow = true;
    plane(2 * X - 0.4, 0.12, MAT.trim, 0, 0.06, -Z + 0.16, 0, 0); plane(2 * X - 0.4, 0.12, MAT.trim, 0, 0.06, Z - 0.16, 0, Math.PI);   // the skirting line where wall meets slab
    // walls: four, with the dock doors cut out of the west and east ones and a staff door on the west
    function wallX(x, side) {                                   // a wall along z at x, openings at the docks
      var openings = (side < 0 ? DOCKS.in : DOCKS.out).filter(function (d) { return Math.abs(d.z) < HALL.z - 1; }).map(function (d) { return { z0: d.z - DOCKS.w / 2, z1: d.z + DOCKS.w / 2, h: DOCKS.h }; });   // IN 3 is in Hall 3's wall, not this one
      if (side < 0) openings.push({ z0: SPOT.staffDoor.z - 0.6, z1: SPOT.staffDoor.z + 0.6, h: 2.3 });
      openings.sort(function (a, b) { return a.z0 - b.z0; });
      var z = -Z;
      openings.forEach(function (o) {
        if (o.z0 > z) { box(0.3, H, o.z0 - z, MAT.wall, x, H / 2, (z + o.z0) / 2); solid(x - 0.15, x + 0.15, z, o.z0); }
        box(0.3, H - o.h, o.z1 - o.z0, MAT.wall, x, o.h + (H - o.h) / 2, (o.z0 + o.z1) / 2); solid(x - 0.15, x + 0.15, o.z0, o.z1, o.h, 9);
        z = o.z1;
      });
      if (z < Z) { box(0.3, H, Z - z, MAT.wall, x, H / 2, (z + Z) / 2); solid(x - 0.15, x + 0.15, z, Z); }
    }
    wallX(-X, -1); wallX(X, 1);
    // the north wall has the fire exit cut out of it at x 23.4 to 24.6
    // the north wall: the belt opening and the doorway into the production wing, and the fire exit, cut out of it
    var nOpen = [{ x0: WING.belt.x0, x1: WING.belt.x1, h: WING.belt.h }, { x0: WING.door.x0, x1: WING.door.x1, h: WING.door.h }, { x0: 23.4, x1: 24.6, h: 2.3 }, { x0: HALLS.hall2.door.x0, x1: HALLS.hall2.door.x1, h: HALLS.hall2.door.h }, { x0: HALLS.hall3.door.x0, x1: HALLS.hall3.door.x1, h: HALLS.hall3.door.h }].sort(function (a, b) { return a.x0 - b.x0; }), nx = -X - 0.15;   // the doorways into Halls 2 and 3 are cut from the first day and shuttered until bought
    nOpen.forEach(function (o) { if (o.x0 > nx) { box(o.x0 - nx, H, 0.3, MAT.wall, (nx + o.x0) / 2, H / 2, -Z); solid(nx, o.x0, -Z - 0.15, -Z + 0.15); } box(o.x1 - o.x0, H - o.h, 0.3, MAT.wall, (o.x0 + o.x1) / 2, o.h + (H - o.h) / 2, -Z); solid(o.x0, o.x1, -Z - 0.15, -Z + 0.15, o.h, 9); nx = o.x1; });
    box(X + 0.15 - nx, H, 0.3, MAT.wall, (nx + X + 0.15) / 2, H / 2, -Z); solid(nx, X + 0.15, -Z - 0.15, -Z + 0.15);
    box(2 * X + 0.3, H, 0.3, MAT.wall, 0, H / 2, Z); solid(-X - 0.15, X + 0.15, Z - 0.15, Z + 0.15);
    // roof with skylight strips, and the trusses under it
    box(2 * X + 0.6, 0.3, 2 * Z + 0.6, MAT.roof, 0, H + 0.15, 0);
    plane(2 * X, 2 * Z, MAT.roofIn, 0, H - 0.01, 0, Math.PI / 2);
    SKYLIGHT_Z.forEach(function (z) { var sk = plane(2 * X - 4, 1.6, MAT.skylight, 0, H - 0.02, z, Math.PI / 2); world.lampMeshes.push(sk); });
    for (var tx = -16; tx <= 16; tx += 8) { box(0.25, 0.6, 2 * Z - 0.4, MAT.steelDark, tx, H - 0.35, 0); }
    // high-bay lamps under the trusses: a conduit drop off the truss, the ballast box, a spun reflector and the lens in its mouth
    hallLights.forEach(function (l) { highBay(l.position.x, l.position.y + 0.3, l.position.z); });
    buildHallLining();
    // floor markings: aisles, the walkway, the staging squares
    function lineX(x0, x1, z, w) { plane(x1 - x0, w || 0.1, MAT.yellowLine, (x0 + x1) / 2, 0.006, z, -Math.PI / 2); }
    function lineZ(z0, z1, x, w) { plane(w || 0.1, z1 - z0, MAT.yellowLine, x, 0.006, (z0 + z1) / 2, -Math.PI / 2); }
    function square(cx, cz, s) { lineX(cx - s / 2, cx + s / 2, cz - s / 2); lineX(cx - s / 2, cx + s / 2, cz + s / 2); lineZ(cz - s / 2, cz + s / 2, cx - s / 2); lineZ(cz - s / 2, cz + s / 2, cx + s / 2); }
    square(SPOT.stageIn.x, SPOT.stageIn.z, 3.4); square(SPOT.stageOut.x, SPOT.stageOut.z, 3.4);
    lineX(-X + 0.3, X - 7.8, 18.2); lineX(-X + 0.3, X - 7.8, 19.4);                      // the pedestrian walkway along the south strip, lobby to office
    lineZ(-Z + 1.6, 18.2, 24.4); lineZ(-Z + 1.6, 19.4, 25.6); lineX(WING.door.x1 + 0.4, 24.4, -Z + 1.6); lineX(WING.door.x1 + 0.4, 25.6, -Z + 2.8);   // up the east side and along the north wall to the production door

    lineZ(-Z + 0.3, Z - 0.3, RACK.x0 - 0.4); lineZ(-Z + 0.3, Z - 0.3, -RACK.x0 + 0.4);              // the rack block edges
    // dock doors
    DOCKS.in.forEach(function (d, i) { if (i === 2 && !S.up.hall3) return; buildDoor(doorIndex('in', i), -1, d.z); });   // IN 3 comes with Hall 3
    DOCKS.out.forEach(function (d, i) { buildDoor(doorIndex('out', i), 1, d.z); });
    // the staff door: a frame, and a ramp down to the yard outside it
    box(0.1, 2.3, 0.08, MAT.steelDark, -X, 1.15, SPOT.staffDoor.z - 0.62); box(0.1, 2.3, 0.08, MAT.steelDark, -X, 1.15, SPOT.staffDoor.z + 0.62); box(0.1, 0.08, 1.3, MAT.steelDark, -X, 2.32, SPOT.staffDoor.z);
    var ramp = box(7.2, 0.2, 2, MAT.grey, -X - 3.6, -0.7, SPOT.staffDoor.z); ramp.rotation.z = Math.atan2(1.2, 7); ramp.position.y = -0.6 - 0.1;
    box(7.2, 0.9, 0.08, MAT.steelDark, -X - 3.6, -0.25, SPOT.staffDoor.z - 1).rotation.z = Math.atan2(1.2, 7); box(7.2, 0.9, 0.08, MAT.steelDark, -X - 3.6, -0.25, SPOT.staffDoor.z + 1).rotation.z = Math.atan2(1.2, 7);
    // the sign on the road side, and the dock faces
    // the yard lamp posts (the lights themselves live in 05-three)
    // the pallet racks the player owns
    buildOffice(); buildBench(); buildBreakRoom(); buildWing();
    hingedDoor('office', X - 7.5, 19.45, false, 'the office door', { window: true, swing: 1 });
    hingedDoor('lobby', -X + 4.5, 19.45, false, 'the lobby door', { window: true, swing: -1 });
    hingedDoor('break', -X + 7, -22.95, false, 'the break room door', { window: true, swing: -1 });
    hingedDoor('staff', -X, SPOT.staffDoor.z - 0.5, false, 'the staff door', { mat: MAT.steelDark, swing: 1 });
    hingedDoor('exit', 23.5, -Z, true, 'the fire exit', { mat: MAT.steelDark, pushbar: true, swing: 1 });
    buildYard(); buildDressing(); buildControlCabinet(); buildProps();
  }

  function highBay(x, y, z) {
    cyl(0.025, HALL.h - 0.7 - y, MAT.steelDark, x, (HALL.h - 0.7 + y) / 2, z, null, 6);
    box(0.34, 0.22, 0.26, MAT.steelDark, x, y + 0.11, z); box(0.1, 0.06, 0.06, MAT.black, x + 0.2, y + 0.12, z);
    var refl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.14, 0.42, 20, 1, true), std({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide })); refl.position.set(x, y - 0.21, z); scene.add(refl);
    var lens = cyl(0.42, 0.03, MAT.lamp, x, y - 0.41, z, null, 20); lens.castShadow = false; world.lampMeshes.push(lens);
  }
  // a recessed troffer in a room's ceiling: a white frame and a prismatic lens that dims when the power is off
  function troffer(x, y, z, w, d) { box(w || 1.2, 0.05, d || 0.6, MAT.trim, x, y - 0.025, z).castShadow = false; var lens = box((w || 1.2) - 0.1, 0.02, (d || 0.6) - 0.1, MAT.lamp, x, y - 0.045, z); lens.castShadow = false; world.lampMeshes.push(lens); return lens; }
  // what a cladded hall looks like from inside: a painted blockwork dado to 2.4 m under a steel capping, I-section columns every
  // 8 m carrying the girts the cladding hangs on, two girts above every opening, and a cable tray round every wall. The rooms
  // have their own plaster lining, so the dado and the columns stop at their walls.
  function buildHallLining() {
    var X = HALL.x, Z = HALL.z, H = HALL.h, DH = 2.4, sd = SPOT.staffDoor.z;
    var cutZ = { '-1': [[-15.8, -12.2], [-7.8, -4.2], [sd - 0.65, sd + 0.65], [18.4, Z], [-Z, -20.1]], '1': [[-15.8, -12.2], [-7.8, -4.2], [DOCKS.out[2].z - DOCKS.w / 2, DOCKS.out[2].z + DOCKS.w / 2], [18.4, Z]] };   // the docks (OUT 3 since 1.14.2: the dado and a column stood in its doorway), the staff door, the lobby, the break room; the office
    var cutX = { '-1': [[WING.belt.x0 - 0.1, WING.belt.x1 + 0.1], [WING.door.x0 - 0.1, WING.door.x1 + 0.1], [23.3, 24.7], [-X, -28.9], [HALLS.hall2.door.x0 - 0.1, HALLS.hall2.door.x1 + 0.1], [HALLS.hall3.door.x0 - 0.1, HALLS.hall3.door.x1 + 0.1]], '1': [[X - 7.6, X], [-X, -31.4]] };   // the hall doorways too, since 1.14.1   // the belt opening, the wing door, the fire exit, the break room; the office, the lobby
    function segs(a0, a1, cuts) { var out = [[a0, a1]]; cuts.forEach(function (c) { var nx = []; out.forEach(function (s) { if (c[1] <= s[0] || c[0] >= s[1]) { nx.push(s); return; } if (c[0] > s[0]) nx.push([s[0], c[0]]); if (c[1] < s[1]) nx.push([c[1], s[1]]); }); out = nx; }); return out.filter(function (s) { return s[1] - s[0] > 0.3; }); }
    function dadoMat(len) { var m = MAT.block.clone(); m.map = MAT.block.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(len / 1.6, DH / 0.8); m.normalMap = MAT.block.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(len / 1.6, DH / 0.8); return m; }
    function wall(axis, side) {
      var at = (axis === 'x' ? X : Z) * side, inward = -side, cuts = axis === 'x' ? cutZ[String(side)] : cutX[String(side)], lim = axis === 'x' ? Z : X;
      var ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI), off = at + inward * 0.17;
      segs(-lim + 0.3, lim - 0.3, cuts).forEach(function (s) {
        var len = s[1] - s[0], mid = (s[0] + s[1]) / 2;
        if (axis === 'x') { plane(len, DH, dadoMat(len), off, DH / 2, mid, 0, ry); box(0.06, 0.05, len, MAT.steelDark, off + inward * 0.02, DH + 0.025, mid); }
        else { plane(len, DH, dadoMat(len), mid, DH / 2, off, 0, ry); box(len, 0.05, 0.06, MAT.steelDark, mid, DH + 0.025, off + inward * 0.02); }
      });
      // clerestory windows: a glazed strip between the two girts, a window every four metres, framed with a cross mullion (Tyson, 2026-10-06)
      var wy = 6.0, ww = 2.4, wh = 1.3, woff = at + inward * 0.2;
      for (var wp = -lim + (axis === 'x' ? 4 : 6); wp < lim - 2; wp += 4) {
        if (axis === 'z' && side < 0 && wp > -14.5 && wp < 10.5) continue;   // the production wing stands behind this stretch of the north wall
        if (axis === 'x') { box(0.04, wh + 0.12, ww + 0.12, MAT.steelDark, woff - inward * 0.02, wy, wp); plane(ww, wh, MAT.skylight, woff, wy, wp, 0, ry); box(0.05, wh, 0.05, MAT.steelDark, woff + inward * 0.01, wy, wp); box(0.05, 0.05, ww, MAT.steelDark, woff + inward * 0.01, wy, wp); }
        else { box(ww + 0.12, wh + 0.12, 0.04, MAT.steelDark, wp, wy, woff - inward * 0.02); plane(ww, wh, MAT.skylight, wp, wy, woff, 0, ry); box(0.05, wh, 0.05, MAT.steelDark, wp, wy, woff + inward * 0.01); box(ww, 0.05, 0.05, MAT.steelDark, wp, wy, woff + inward * 0.01); }
      }
      // the girts and the cable tray run the whole wall; a column every 8 m, set where no door, console or sign stands
      var full = 2 * lim - 0.6, c0 = 0, g = at + inward * 0.25;
      [5.2, 6.8].forEach(function (gy) { if (axis === 'x') box(0.06, 0.12, full, MAT.steelDark, g, gy, c0); else box(full, 0.12, 0.06, MAT.steelDark, c0, gy, g); });
      if (axis === 'x' || side > 0) { if (axis === 'x') { box(0.3, 0.08, full, MAT.steelDark, at + inward * 0.35, 5.6, c0); for (var ct = -lim + 1; ct < lim; ct += 2) box(0.3, 0.08, 0.04, MAT.steelDark, at + inward * 0.35, 5.6, ct); } else { box(full, 0.08, 0.3, MAT.steelDark, c0, 5.6, at + inward * 0.35); for (var ct2 = -lim + 1; ct2 < lim; ct2 += 2) box(0.04, 0.08, 0.3, MAT.steelDark, ct2, 5.6, at + inward * 0.35); } }
      var cols = axis === 'x' ? [-18, -10, -2, 6, 14] : side > 0 ? [-28, -20, -12, -4, 4, 12, 20] : [-24, -16, -8, 0, 10, 22, 30];
      cols.forEach(function (p) { if (cuts.some(function (c) { return p > c[0] - 0.3 && p < c[1] + 0.3; })) return; var cx = axis === 'x' ? at + inward * 0.42 : p, cz = axis === 'x' ? p : at + inward * 0.42; column(cx, cz, axis === 'x'); });
    }
    function column(x, z, alongZ) {
      var h = H - 0.3; box(alongZ ? 0.26 : 0.02, h, alongZ ? 0.02 : 0.26, MAT.steelDark, x, h / 2, z);
      [-0.12, 0.12].forEach(function (o) { box(alongZ ? 0.02 : 0.3, h, alongZ ? 0.3 : 0.02, MAT.steelDark, x + (alongZ ? o : 0), h / 2, z + (alongZ ? 0 : o)); });
      box(0.42, 0.03, 0.42, MAT.steelDark, x, 0.015, z); [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(function (b) { cyl(0.018, 0.03, MAT.chrome, x + b[0], 0.04, z + b[1], null, 6); });
      box(0.46, 0.5, 0.46, MAT.hazard, x, 0.28, z).castShadow = false;   // the bump guard every forklift hall paints on
      solid(x - 0.16, x + 0.16, z - 0.16, z + 0.16, 0, h);
    }
    wall('x', -1); wall('x', 1); wall('z', -1); wall('z', 1);
  }
  function buildDoor(i, side, z) {
    var x = side * HALL.x;
    var panel = new THREE.Mesh(boxGeo(0.12, DOCKS.h, DOCKS.w), MAT.door); panel.castShadow = true; panel.receiveShadow = true;
    panel.position.set(x - side * 0.22, DOCKS.h / 2, z); scene.add(panel);
    // the dock leveller: a plate from the hall edge out over the slot to the trailer bed, with a hinged lip and a hazard edge
    var lev = box(0.72, 0.05, 2.3, MAT.chequer, side * (HALL.x + 0.1), 0.0, z); lev.receiveShadow = true; box(0.2, 0.03, 2.3, MAT.hazard, side * (HALL.x + 0.5), 0.02, z).rotation.z = side * 0.12; box(0.06, 0.08, 2.3, MAT.steelDark, side * (HALL.x - 0.22), -0.02, z);
    var d = { i: i, side: side, z: z, panel: panel, anim: S.doors[i] ? 1 : 0 };
    addInter(panel, { prompt: function () { return S.doors[i] ? null : DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock) ? 'OUT 3 · air freight dock · opens with the sortation deck' : (S.events.power ? 'No power: the door motor is dead' : 'Open dock door ' + dockLabel(i) + (dockLane(i) ? ' (' + dockLane(i).name.toLowerCase() + ' lane)' : '') + ' · the cabinet and the consoles close it'); }, use: function () { if (!S.events.power) setDoor(i, true); else toast('No power. Flip the breaker in the office.', 'bad'); } });
    // a pull cord inside, to bring a door down without walking to the cabinet
    var cord = cyl(0.01, 1.2, MAT.red, x - side * 0.35, DOCKS.h - 0.6, z - DOCKS.w / 2 - 0.3, null, 4); var knob = box(0.08, 0.12, 0.08, MAT.red, x - side * 0.35, DOCKS.h - 1.25, z - DOCKS.w / 2 - 0.3);
    addInter(knob, { prompt: function () { return S.doors[i] ? 'Pull the cord: close dock door ' + dockLabel(i) : null; }, use: function () { if (S.doors[i]) setDoor(i, false); } });
    // bumpers, the number outside, the leveller plate, the sign inside
    box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z - DOCKS.w / 2 + 0.3); box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z + DOCKS.w / 2 - 0.3);
    sign([String(DOOR_MAP[i].dock + 1)], 1.2, 1.2, x + side * 0.17, DOCKS.h + 1.3, z, side < 0 ? -Math.PI / 2 : Math.PI / 2, { w: 128, h: 128, bg: '#f5b53d', fg: '#1a1205' });
    plane(1.6, DOCKS.w - 0.4, MAT.hazard, x - side * 0.8, 0.008, z, -Math.PI / 2);
    sign([dockLabel(i) + (dockLane(i) ? ' · ' + dockLane(i).name.toUpperCase() : '')], 2.4, 0.7, x - side * 0.17, DOCKS.h + 0.6, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: i < 2 ? '#f5b53d' : (dockLane(i) ? dockLane(i).col : '#5fd38d') });
    doors[i] = d;
  }
  function dockLabel(i) { var d = DOOR_MAP[i]; return d ? (d.dir === 'in' ? 'IN ' : 'OUT ') + (d.dock + 1) : '?'; }
  function dockLane(i) { var d = DOOR_MAP[i]; return d && d.dir === 'out' && TRUCK_OUT[d.dock] ? MODES[TRUCK_OUT[d.dock].mode] : null; }
  function setDoor(i, open) { if (S.doors[i] === open) return; if (open && DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock)) { toast('OUT 3 opens with the sortation deck (shop).', 'bad'); return; } S.doors[i] = open; sfx('roller'); logEvent('Dock door ' + dockLabel(i) + (open ? ' opened' : ' closed')); if (open && i < 2) introStep('door'); rebuildDyn(); }
  function doorAnim(dt) {
    // the pose is applied every frame, so a door loaded open looks open without waiting for a toggle
    doors.forEach(function (d) { var t = S.doors[d.i] ? 1 : 0; if (d.anim !== t) d.anim = clamp(d.anim + (t ? dt : -dt) / 1.6, 0, 1); var sc = 1 - d.anim * 0.93; d.panel.scale.y = sc; d.panel.position.y = DOCKS.h - DOCKS.h * sc / 2; });
  }
  function doorPassable(i) { return !!doors[i] && doors[i].anim > 0.6; }

  function buildRack(r) { if (PROPS['rack' + r]) buildProp('rack' + r); }
  // a rack row as a prop: uprights with bracing and base plates, beams with end plates, mesh decks, bay labels, slot hit volumes, the end guards
  function rackBuild(r) {
    return function (c) {
      var x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05, nb = rowBays(r);   // nb: the annex rows are shorter
      for (var b = 0; b <= nb; b++) {
        var ux = x0 + b * bw;
        [-dz, dz].forEach(function (oz) { c.box(0.1, 5, 0.1, MAT.rack, ux, 2.5, oz); c.box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, oz); for (var hh = 0.3; hh < 4.9; hh += 0.35) c.box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, oz); });
        for (var br = 0; br < 5; br++) { var yb = 0.4 + br * 1.0; c.box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, 0); var dg = c.box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, 0); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
      }
      for (var l = 1; l < RACK.levels.length; l++) {
        var y = RACK.levels[l];
        c.box(nb * bw, 0.12, 0.08, MAT.beam, x0 + nb * bw / 2, y - 0.06, -dz); c.box(nb * bw, 0.12, 0.08, MAT.beam, x0 + nb * bw / 2, y - 0.06, dz);
        for (var bp = 0; bp <= nb; bp++) { c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, -dz); c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, dz); }
        for (var bb2 = 0; bb2 < nb; bb2++) { var dk = c.plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, 0, -Math.PI / 2, 0); dk.receiveShadow = false; c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, -0.3); c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, 0.3); }
      }
      for (var bb = 0; bb < nb; bb++) {
        var cx = x0 + (bb + 0.5) * bw, lbl = rowLetter(r) + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#f5b53d' });
        var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
        [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, 4.75, s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; c.add(p); });
        for (var ll = 0; ll < RACK.levels.length; ll++) (function (rr, b2, l2) {
          var key = slotKey(rr, b2, l2), hh2 = l2 === 2 ? 1.6 : 1.45;
          slotHits[key] = c.hit(bw - 0.2, hh2, RACK.depth, cx, RACK.levels[l2] + hh2 / 2, 0, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } });
        })(r, bb, ll);
      }
      c.solid(x0 - 0.1, x0 + nb * bw + 0.1, -RACK.depth / 2, RACK.depth / 2, 0, 5);
      [-1, 1].forEach(function (s) { var x = s > 0 ? x0 + nb * bw + 0.3 : x0 - 0.3; c.box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, 0); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, -RACK.depth / 2 - 0.1); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, RACK.depth / 2 + 0.1); c.sign(['MAX LOAD', '1000 kg / level', 'row ' + rowLetter(r)], 0.5, 0.5, x + s * 0.06, 1.6, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 34 }); });
    };
  }
  // a painted lining on a room's outer walls: a plane just inside the cladding, skirting along the floor, a dado rail, with openings left for doors
  function lineWall(axis, at, a0, a1, h, mat, openings, inward) {
    var segs = [[a0, a1]]; (openings || []).forEach(function (o) { var out = []; segs.forEach(function (s) { if (o[1] <= s[0] || o[0] >= s[1]) { out.push(s); return; } if (o[0] > s[0]) out.push([s[0], o[0]]); if (o[1] < s[1]) out.push([o[1], s[1]]); }); segs = out; });
    var off = at + inward * 0.17, ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI);
    function strip(w, hh, y, mid, m) { if (axis === 'x') { plane(w, hh, m, off, y, mid, 0, ry); } else { plane(w, hh, m, mid, y, off, 0, ry); } }
    segs.forEach(function (s) { var w = s[1] - s[0], mid = (s[0] + s[1]) / 2; strip(w, h, h / 2, mid, mat); var sk = axis === 'x' ? box(0.03, 0.12, w, MAT.trim, off + inward * 0.012, 0.06, mid) : box(w, 0.12, 0.03, MAT.trim, mid, 0.06, off + inward * 0.012); sk.receiveShadow = true; if (axis === 'x') box(0.025, 0.05, w, MAT.trim, off + inward * 0.01, 0.95, mid); else box(w, 0.05, 0.025, MAT.trim, mid, 0.95, off + inward * 0.01); });
    (openings || []).forEach(function (o) { if (o[2] && o[2] < h) { var w = o[1] - o[0], mid = (o[0] + o[1]) / 2; strip(w, h - o[2], o[2] + (h - o[2]) / 2, mid, mat); } });
  }
  var LINING = { lobby: std({ map: TEX.plaster, color: 0xd9e3ea, roughness: 0.85, normalMap: NRM.plaster, normalScale: new THREE.Vector2(0.3, 0.3) }), brk: std({ map: TEX.plaster, color: 0xf0e6cf, roughness: 0.85, normalMap: NRM.plaster, normalScale: new THREE.Vector2(0.3, 0.3) }), office: std({ map: TEX.plaster, color: 0xe6e8e4, roughness: 0.85, normalMap: NRM.plaster, normalScale: new THREE.Vector2(0.3, 0.3) }) };
  function buildOffice() {
    var X = HALL.x, Z = HALL.z, x0 = X - 7.5, z0 = 18.5, h = 3.2;
    // the wall along x = x0 with a doorway, the wall along z = z0 with a window, and a ceiling
    box(0.15, h, 0.8, MAT.plaster, x0, h / 2, z0 + 0.4); box(0.15, h, Z - 20.6, MAT.plaster, x0, h / 2, 20.6 + (Z - 20.6) / 2); box(0.15, h - 2.2, 1.3, MAT.plaster, x0, 2.2 + (h - 2.2) / 2, 19.95);
    solid(x0 - 0.08, x0 + 0.08, z0, 19.3); solid(x0 - 0.08, x0 + 0.08, 20.6, Z);
    box(1.5, h, 0.15, MAT.plaster, x0 + 0.75, h / 2, z0); box(2, h, 0.15, MAT.plaster, X - 1, h / 2, z0);
    box(X - 1.5 - x0, 1.1, 0.15, MAT.plaster, (x0 + 1.5 + X - 2) / 2, 0.55, z0); box(X - 1.5 - x0, h - 2.3, 0.15, MAT.plaster, (x0 + 1.5 + X - 2) / 2, 2.3 + (h - 2.3) / 2, z0);
    box(X - 1.5 - x0, 1.2, 0.04, MAT.glass, (x0 + 1.5 + X - 2) / 2, 1.7, z0);
    solid(x0, X, z0 - 0.08, z0 + 0.08);
    box(X - x0, 0.12, Z - z0, MAT.plaster, (x0 + X) / 2, h + 0.06, (z0 + Z) / 2);
    lineWall('x', X, z0 + 0.1, Z - 0.1, h, LINING.office, [], -1); lineWall('z', Z, x0 + 0.1, X - 0.1, h, LINING.office, [], -1);
    plane(X - x0 - 0.2, Z - z0 - 0.2, MAT.tile, (x0 + X) / 2, h - 0.01, (z0 + Z) / 2, Math.PI / 2);
    world.officeLamp = troffer(X - 3.5, h, 21); troffer(x0 + 1.9, h, 22.5, 0.6, 0.6);
    // carpet tiles over the slab, skirting on the two plaster walls (the hall walls get theirs from lineWall), a bin by the desk
    roomFloor(MAT.carpet, x0 + 0.08, X - 0.16, z0 + 0.08, Z - 0.16, 1.0);
    [[z0, 19.3], [20.6, Z]].forEach(function (s) { box(0.03, 0.12, s[1] - s[0], MAT.trim, x0 + 0.09, 0.06, (s[0] + s[1]) / 2).castShadow = false; }); box(X - x0, 0.12, 0.03, MAT.trim, (x0 + X) / 2, 0.06, z0 + 0.09).castShadow = false;
    cyl(0.14, 0.3, std({ color: 0x2a2d33, roughness: 0.6 }), X - 1.2, 0.15, 19.4, null, 12, 0.12); box(0.16, 0.02, 0.16, MAT.paper, X - 1.2, 0.3, 19.4).rotation.y = 0.4;
  }
  // a room's own floor laid over the slab: the texture repeats in metres so a carpet tile is half a metre wherever it is
  function roomFloor(mat, x0, x1, z0, z1, per) {
    var m = mat.clone(); m.map = mat.map.clone(); m.map.needsUpdate = true; m.map.repeat.set((x1 - x0) / per, (z1 - z0) / per);
    if (mat.normalMap) { m.normalMap = mat.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set((x1 - x0) / per, (z1 - z0) / per); }
    var p = plane(x1 - x0, z1 - z0, m, (x0 + x1) / 2, 0.012, (z0 + z1) / 2, -Math.PI / 2); p.receiveShadow = true; return p;
  }

  function buildBench() {
    var bx = SPOT.bench.x, bz = SPOT.bench.z;
    // the two dock consoles by the outbound doors: dispatch a loaded truck early
  }

  // the entrance lobby (south-west corner) and the break room (north-west corner, above IN 1), both walled like the office
  function buildBreakRoom() {
    var X = HALL.x, Z = HALL.z, h = 3.2;
    // the lobby: x -30..-25.5, z 18.5..24; its door onto the hall at z 19.45..20.45 in the east wall, a window south of it
    var x0 = -X + 4.5, z0 = 18.5;
    box(0.15, h, 0.8, MAT.plaster, x0, h / 2, z0 + 0.4); box(0.15, h - 2.2, 1.3, MAT.plaster, x0, 2.2 + (h - 2.2) / 2, 19.95);
    box(0.15, h, 0.6, MAT.plaster, x0, h / 2, 20.9); box(0.15, 1.1, 2.6, MAT.plaster, x0, 0.55, 22.5); box(0.15, h - 2.3, 2.6, MAT.plaster, x0, 2.3 + (h - 2.3) / 2, 22.5); box(0.04, 1.2, 2.6, MAT.glass, x0, 1.7, 22.5); box(0.15, h, 0.2, MAT.plaster, x0, h / 2, Z - 0.1);
    solid(x0 - 0.08, x0 + 0.08, z0, 19.3); solid(x0 - 0.08, x0 + 0.08, 20.6, Z);
    box(X + x0, h, 0.15, MAT.plaster, (-X + x0) / 2, h / 2, z0); solid(-X, x0, z0 - 0.08, z0 + 0.08);
    box(X + x0, 0.12, Z - z0, MAT.plaster, (-X + x0) / 2, h + 0.06, (z0 + Z) / 2);
    lineWall('x', -X, z0 + 0.1, Z - 0.1, h, LINING.lobby, [[SPOT.staffDoor.z - 0.65, SPOT.staffDoor.z + 0.65, 2.25]], 1); lineWall('z', Z, -X + 0.1, x0 - 0.1, h, LINING.lobby, [], -1); plane(X + x0 - 0.2, Z - z0 - 0.2, MAT.tile, (-X + x0) / 2, h - 0.01, (z0 + Z) / 2, Math.PI / 2);
    troffer(-X + 2.3, h, 21.2);
    roomFloor(MAT.vinyl, -X + 0.16, x0 - 0.08, z0 + 0.08, Z - 0.16, 1.5);
    [[z0, 19.3], [20.6, Z]].forEach(function (s) { box(0.03, 0.12, s[1] - s[0], MAT.trim, x0 - 0.09, 0.06, (s[0] + s[1]) / 2).castShadow = false; }); box(X + x0, 0.12, 0.03, MAT.trim, (-X + x0) / 2, 0.06, z0 + 0.09).castShadow = false;
    for (var bl = 0; bl < 14; bl++) box(0.02, 0.05, 2.5, MAT.trim, x0 + 0.09, 2.26 - bl * 0.08, 22.5);
    // the break room: x -30..-23, z -24..-20.2; its door in the east wall at z -22.95..-21.95, a window in the south wall onto the hall
    var bx = -X + 7, bz = -20.2;
    box(0.15, h, 1.05, MAT.plaster, bx, h / 2, -Z + 0.525); box(0.15, h - 2.2, 1.3, MAT.plaster, bx, 2.2 + (h - 2.2) / 2, -22.45); box(0.15, h, 1.6, MAT.plaster, bx, h / 2, bz - 0.8);
    solid(bx - 0.08, bx + 0.08, -Z, -22.95); solid(bx - 0.08, bx + 0.08, -21.95, bz);
    box(1.0, h, 0.15, MAT.plaster, -X + 0.5, h / 2, bz); box(1.2, h, 0.15, MAT.plaster, bx - 0.6, h / 2, bz);
    box(X + bx - 2.2, 1.1, 0.15, MAT.plaster, (-X + 1 + bx - 1.2) / 2, 0.55, bz); box(X + bx - 2.2, h - 2.3, 0.15, MAT.plaster, (-X + 1 + bx - 1.2) / 2, 2.3 + (h - 2.3) / 2, bz); box(X + bx - 2.2, 1.2, 0.04, MAT.glass, (-X + 1 + bx - 1.2) / 2, 1.7, bz);
    solid(-X, bx, bz - 0.08, bz + 0.08);
    box(X + bx, 0.12, Z + bz, MAT.plaster, (-X + bx) / 2, h + 0.06, (-Z + bz) / 2);
    lineWall('x', -X, -Z + 0.1, bz - 0.1, h, LINING.brk, [], 1); lineWall('z', -Z, -X + 0.1, bx - 0.1, h, LINING.brk, [], 1); plane(X + bx - 0.2, Z + bz - 0.2, MAT.tile, (-X + bx) / 2, h - 0.01, (-Z + bz) / 2, Math.PI / 2);
    troffer(-X + 3.5, h, -22.1);
    roomFloor(MAT.vinyl, -X + 0.16, bx - 0.08, -Z + 0.16, bz - 0.08, 1.5);
    [[-Z, -22.95], [-21.95, bz]].forEach(function (s) { box(0.03, 0.12, s[1] - s[0], MAT.trim, bx - 0.09, 0.06, (s[0] + s[1]) / 2).castShadow = false; }); box(X + bx, 0.12, 0.03, MAT.trim, (-X + bx) / 2, 0.06, bz - 0.09).castShadow = false;
    for (var bl2 = 0; bl2 < 14; bl2++) box(4.6, 0.05, 0.02, MAT.trim, -X + 3.6, 2.26 - bl2 * 0.08, bz - 0.09);
  }
  // the order board on the office wall: redrawn when orders change
  function drawBoard(sc) {
    var c = world.boardCtx; if (!c) return; var w = 768, h = 384; sc = sc || world.boardScreen;
    c.fillStyle = '#0d1b2a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f5b53d'; c.font = 'bold 30px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('OPEN ORDERS', 24, 44); c.font = '22px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8'; c.textAlign = 'right'; c.fillText('Day ' + S.day + '  ' + fmtTime(S.time), w - 24, 44);
    c.textAlign = 'left';
    var all = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed'; }), per = 7, pages = Math.max(1, Math.ceil(all.length / per));
    // the page: the one you wheeled to, for a while after the wheel turn; otherwise the board turns its own pages every six seconds
    var page = sc && sc.userScrollAt && worldTime - sc.userScrollAt < 12 ? clamp(sc.scroll || 0, 0, pages - 1) : (pages > 1 ? Math.floor(worldTime / 6) % pages : 0);
    if (sc) { sc.scrollMax = pages - 1; sc.scroll = page; }
    var open = all.slice(page * per, page * per + per);
    if (!all.length) { c.fillStyle = '#5fd38d'; c.font = '26px Bahnschrift, Arial, sans-serif'; c.fillText('Nothing waiting. Nice.', 24, 110); }
    open.forEach(function (o, i) {
      var y = 90 + i * 40, lane = MODES[orderMode(o)];   // the lane chip: which door the parcel leaves by
      c.fillStyle = lane.col; c.beginPath(); if (c.roundRect) c.roundRect(24, y - 21, 62, 27, 6); else c.rect(24, y - 21, 62, 27); c.fill(); c.fillStyle = '#0d1b2a'; c.font = 'bold 17px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(lane.name.toUpperCase(), 55, y - 1); c.textAlign = 'left';
      c.fillStyle = o.state === 'packed' ? '#5fd38d' : (o.rush ? '#ff6b5e' : '#eef1f5'); c.font = 'bold 22px Bahnschrift, Arial, sans-serif';
      c.fillText('#' + o.num + '  ' + clientName(o.client), 98, y);
      c.font = '20px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8';
      c.fillText(o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ').slice(0, 46), 330, y);
      c.textAlign = 'right'; c.fillStyle = o.state === 'packed' ? '#5fd38d' : '#f5b53d'; c.fillText(o.state === 'packed' ? 'PACKED' : 'due ' + fmtTime(o.due), w - 24, y); c.textAlign = 'left';
    });
    if (pages > 1) { c.fillStyle = '#6b7784'; c.font = '18px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('page ' + (page + 1) + ' of ' + pages + ' · ' + all.length + ' orders · the wheel turns the page', w - 24, h - 16); c.textAlign = 'left'; }
    world.boardTex.needsUpdate = true;
  }

  // where the player stands: the hall floor, a docked trailer's floor, the ramp, or the yard
  function floorY(x, z, y) {   // y: how high the asker already is; the mezzanine deck counts only for someone up there
    var uy = upperFloorY(x, z, y); if (uy !== null) return uy;
    if ((Math.abs(x) < HALL.x && Math.abs(z) < HALL.z) || inWing(x, z) || inAnnex(x, z)) return 0;
    for (var i = 0; i < S.trucks.length; i++) { var t = S.trucks[i]; if (t.state !== 'docked') continue; var b = trailerBounds(t); if (x > b.x0 - 0.7 && x < b.x1 + 0.7 && z > b.z0 && z < b.z1) return 0; }
    if (x <= -HALL.x && x > -HALL.x - 7.2 && Math.abs(z - SPOT.staffDoor.z) < 1) return lerp(0, YARD_Y, (-HALL.x - x) / 7);
    return YARD_Y;
  }
  function insideHall(x, z) { return (Math.abs(x) < HALL.x && Math.abs(z) < HALL.z) || inWing(x, z) || !!inAnnex(x, z); }
  // ── Touch screens: a canvas drawn in the world, tapped where the crosshair points ─
  var screens = [];
  function touchScreen(o) {
    var res = o.res || 1, c = document.createElement('canvas'); c.width = o.w * res; c.height = o.h * res; var ctx = c.getContext('2d'); if (res !== 1) ctx.setTransform(res, 0, 0, res, 0, 0);   // res: canvas pixels per logical pixel; the layout and the tap zones stay in logical pixels
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.pw, o.ph), new THREE.MeshBasicMaterial({ map: t })); mesh.position.set(o.x, o.y, o.z); mesh.rotation.y = o.ry || 0; (o.parent || scene).add(mesh);
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(o.pw, o.ph), MAT.screenGlass); glass.position.set(0, 0, 0.0015); glass.renderOrder = 2; mesh.add(glass);
    var sc = { w: o.w, h: o.h, res: res, ctx: ctx, tex: t, mesh: mesh, zones: [], draw: o.draw, cur: null, ripple: 0, title: o.title, dirty: true }; mesh.userData.screen = sc;
    addInter(mesh, { prompt: function () { var z = screenZone(sc); return z ? z.label : (o.title || 'Screen'); }, use: function () { screenTap(sc); } });
    screens.push(sc); return sc;
  }
  function screenZone(sc) { var h = ray.intersectObject(sc.mesh, false); if (!h.length || !h[0].uv) { sc.cur = null; return null; } var x = h[0].uv.x * sc.w, y = (1 - h[0].uv.y) * sc.h; sc.cur = { x: x, y: y }; for (var i = 0; i < sc.zones.length; i++) { var z = sc.zones[i]; if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z; } return null; }
  function screenTap(sc) { var z = screenZone(sc); sfx('click'); if (z && z.act) { z.act(); sc.ripple = 1; sc.dirty = true; } }
  function drawScreens(dt) { screens.forEach(function (sc) { if (sc.autoPage) { var pg = Math.floor(worldTime / 6); if (sc.lastAuto !== pg) { sc.lastAuto = pg; sc.dirty = true; } } if (sc.ripple > 0) { sc.ripple -= dt * 3; sc.dirty = true; } if (!sc.dirty) return; sc.dirty = false; sc.zones.length = 0; if (sc.res && sc.res !== 1) sc.ctx.setTransform(sc.res, 0, 0, sc.res, 0, 0); sc.draw(sc.ctx, sc); if (sc.cur && sc.ripple > 0) { sc.ctx.strokeStyle = 'rgba(255,255,255,' + sc.ripple + ')'; sc.ctx.lineWidth = 3; sc.ctx.beginPath(); sc.ctx.arc(sc.cur.x, sc.cur.y, (1 - sc.ripple) * 30 + 4, 0, 6.3); sc.ctx.stroke(); } sc.tex.needsUpdate = true; }); }
  function screenDirtyAll() { screens.forEach(function (s) { s.dirty = true; }); }
  // drawing helpers in the house style
  function scBg(c, w, h, accent) { c.fillStyle = '#0d1216'; c.fillRect(0, 0, w, h); var g = c.createRadialGradient(0, 0, 10, 0, 0, w); g.addColorStop(0, accent || 'rgba(245,181,61,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.04)'; for (var y = 8; y < h; y += 16) for (var x = 8; x < w; x += 16) c.fillRect(x, y, 1.5, 1.5); }
  function scHead(c, w, title, sub) { c.fillStyle = '#f5b53d'; c.font = 'bold 22px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(title, 16, 30); c.fillStyle = '#a0acb8'; c.font = '14px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(sub || fmtTime(S.time), w - 16, 30); c.textAlign = 'left'; c.fillStyle = 'rgba(245,181,61,0.35)'; c.fillRect(16, 40, w - 32, 2); }
  function scButton(sc, x, y, w, h, label, on, act, col) { var c = sc.ctx; c.fillStyle = on ? (col || '#f5b53d') : 'rgba(255,255,255,0.08)'; c.strokeStyle = on ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.18)'; c.lineWidth = 1.5; c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, 8) : c.rect(x, y, w, h); c.fill(); c.stroke(); c.fillStyle = on ? '#1a1205' : '#eef1f5'; c.font = 'bold 15px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x + w / 2, y + h / 2); c.textBaseline = 'alphabetic'; c.textAlign = 'left'; sc.zones.push({ x: x, y: y, w: w, h: h, label: label, act: act }); }
  function scText(c, x, y, text, col, size) { c.fillStyle = col || '#eef1f5'; c.font = (size || 14) + 'px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.fillText(text, x, y); }

  // ── Hinged doors ──────────────────────────────────────────────────
  // Each door is a leaf on a hinge. E opens or closes it, Shift+E locks or unlocks it (you carry the keys).
  // Staff carry keys too: a door swings open for them as they come up to it and closes behind them.
  var hdoors = [];
  function hingedDoor(id, x, z, alongX, label, opt) {
    opt = opt || {};
    var g = new THREE.Group(); g.userData.dynamic = true; g.position.set(x, 0, z); scene.add(g);
    var w = 1.0, h = 2.15, t = 0.06, hinge = new THREE.Group(); g.add(hinge);
    var leaf = box(alongX ? w : t, h, alongX ? t : w, opt.mat || MAT.plaster, alongX ? w / 2 : 0, h / 2, alongX ? 0 : w / 2, hinge);
    var win = opt.window ? box(alongX ? 0.4 : t + 0.01, 0.5, alongX ? t + 0.01 : 0.4, MAT.glass, alongX ? w / 2 : 0, 1.55, alongX ? 0 : w / 2, hinge) : null;
    var handle = box(alongX ? 0.14 : 0.04, 0.03, alongX ? 0.04 : 0.14, MAT.chrome, alongX ? w - 0.15 : 0.06, 1.05, alongX ? 0.06 : w - 0.15, hinge); box(alongX ? 0.14 : 0.04, 0.03, alongX ? 0.04 : 0.14, MAT.chrome, alongX ? w - 0.15 : -0.06, 1.05, alongX ? -0.06 : w - 0.15, hinge);
    if (opt.pushbar) box(alongX ? 0.8 : 0.05, 0.05, alongX ? 0.05 : 0.8, MAT.chrome, alongX ? w / 2 : 0.07, 1.0, alongX ? 0.07 : w / 2, hinge);
    var led = box(0.03, 0.03, 0.03, glowMat(0x39d353, 1.2), alongX ? w - 0.1 : 0.05, 2.0, alongX ? 0.05 : w - 0.1, hinge);
    // the frame
    var fm = MAT.steelDark; if (alongX) { box(0.08, h + 0.1, t + 0.06, fm, -0.04, (h + 0.1) / 2, 0, g); box(0.08, h + 0.1, t + 0.06, fm, w + 0.04, (h + 0.1) / 2, 0, g); box(w + 0.16, 0.08, t + 0.06, fm, w / 2, h + 0.09, 0, g); } else { box(t + 0.06, h + 0.1, 0.08, fm, 0, (h + 0.1) / 2, -0.04, g); box(t + 0.06, h + 0.1, 0.08, fm, 0, (h + 0.1) / 2, w + 0.04, g); box(t + 0.06, 0.08, w + 0.16, fm, 0, h + 0.09, w / 2, g); }
    var d = { id: id, g: g, hinge: hinge, led: led, x: x, z: z, alongX: alongX, w: w, t: 0, label: label, swing: opt.swing || 1 };
    var hit = hitBox(alongX ? w : 0.4, h, alongX ? 0.4 : w, alongX ? w / 2 : 0, h / 2, alongX ? 0 : w / 2, { prompt: function () { return doorPrompt(d); }, use: function () { doorUse(d); }, alt: function () { doorLock(d); } }, g);
    d.hit = hit;
    if (!S.hdoors) S.hdoors = {}; if (!S.hdoors[id]) S.hdoors[id] = { open: !!opt.open, locked: false };
    d.t = S.hdoors[id].open ? 1 : 0; doorPose(d);
    hdoors.push(d); return d;
  }
  function hd(id) { return S.hdoors && S.hdoors[id] ? S.hdoors[id] : { open: false, locked: false }; }
  function doorPose(d) { d.hinge.rotation.y = (d.alongX ? -1 : 1) * d.swing * d.t * 1.65; d.led.material.emissive.setHex(hd(d.id).locked ? 0xff3b30 : 0x39d353); }
  function doorPrompt(d) { var s = hd(d.id); if (s.locked) return d.label + ' · locked · Shift+E unlocks'; return (s.open ? 'Close ' : 'Open ') + d.label + ' · Shift+E locks'; }
  function doorUse(d) { var s = hd(d.id); if (player.keys.ShiftLeft || player.keys.ShiftRight) { doorLock(d); return; } if (s.locked) { sfx('bad'); toast(d.label + ' is locked.', 'bad'); return; } s.open = !s.open; sfx('door'); if (!s.open) { } }
  function doorLock(d) { var s = hd(d.id); if (s.open) { s.open = false; } s.locked = !s.locked; sfx(s.locked ? 'lock' : 'unlock'); toast((s.locked ? '🔒 Locked ' : '🔓 Unlocked ') + d.label, s.locked ? '' : 'good'); doorPose(d); screenDirtyAll(); }
  function doorsTick(dt) {
    hdoors.forEach(function (d) {
      var s = hd(d.id);
      // staff with keys: the door opens for them when they are close and closes once they are through
      var staffNear = S.staff.some(function (st) { var m = staffMeshes[st.id]; if (!m || !m.visible) return false; var cx = d.alongX ? d.x + d.w / 2 : d.x, cz = d.alongX ? d.z : d.z + d.w / 2; return dist2(st.x, st.z, cx, cz) < 1.7 && st.state === 'walk'; });
      var want = s.open || staffNear ? 1 : 0;
      if (Math.abs(d.t - want) > 0.002) { d.t = lerp(d.t, want, 1 - Math.pow(0.006, dt)); if (Math.abs(d.t - want) < 0.004) d.t = want; doorPose(d); shadowDirty = true; }
    });
  }
  function doorSolids(out) { hdoors.forEach(function (d) { if (d.t > 0.5) return; if (d.alongX) out.push({ x0: d.x, x1: d.x + d.w, z0: d.z - 0.08, z1: d.z + 0.08, y0: -1, y1: 3 }); else out.push({ x0: d.x - 0.08, x1: d.x + 0.08, z0: d.z, z1: d.z + d.w, y0: -1, y1: 3 }); }); }
  function lockAll(lock) { hdoors.forEach(function (d) { var s = hd(d.id); if (lock) { s.open = false; s.locked = true; } else s.locked = false; doorPose(d); }); if (lock) doors.forEach(function (dk) { if (S.doors[dk.i]) setDoor(dk.i, false); }); sfx(lock ? 'lock' : 'unlock'); logEvent(lock ? 'Night mode: every door closed and locked' : 'Doors unlocked for the day'); screenDirtyAll(); }
  function anyDoorUnlockedAtNight() { return hdoors.some(function (d) { return !hd(d.id).locked; }); }

  // ── The control cabinet ───────────────────────────────────────────
  function buildControlCabinet() { }
  function cabinetBuild(c) {
    var g = c.group;
    box(0.9, 1.3, 0.22, MAT.grey, 0, 1.45, -0.11, g); box(0.9, 0.04, 0.26, MAT.steelDark, 0, 2.12, -0.1, g); box(0.9, 0.04, 0.26, MAT.steelDark, 0, 0.78, -0.1, g);
    box(0.04, 0.12, 0.03, MAT.black, 0.38, 1.0, 0.012, g); cyl(0.012, 0.6, MAT.black, 0.42, 0.45, -0.1, g, 6); cyl(0.012, 1.4, MAT.black, -0.42, 2.8, -0.1, g, 6);
    sign(['CONTROL'], 0.7, 0.14, 0, 2.02, 0.012, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#f5b53d' }, g);
    var lamps = [glowMat(0x39d353, 1.2), glowMat(0xf5b53d, 1.2), glowMat(0xff3b30, 1.2)];
    [-0.3, -0.1, 0.1].forEach(function (lx, i) { var l = cyl(0.025, 0.02, lamps[i], lx, 0.9, 0.012, g, 10); l.rotation.x = Math.PI / 2; });
    dress.cabLamps = g;
    touchScreen({ w: 420, h: 300, pw: 0.78, ph: 0.56, x: 0, y: 1.5, z: 0.012, parent: g, title: 'Control cabinet', draw: function (c, sc) {
      scBg(c, sc.w, sc.h); scHead(c, sc.w, 'DEPOT CONTROL', 'Day ' + S.day + ' · ' + fmtTime(S.time));
      var power = !S.events.power;
      scText(c, 16, 66, 'Mains ' + (power ? 'ON' : 'OFF: breaker tripped'), power ? '#5fd38d' : '#ff6b5e', 15);
      scText(c, 220, 66, 'Weather: ' + (S.weather ? S.weather.kind : 'clear'), '#a0acb8', 14);
      scButton(sc, 16, 80, 120, 40, 'Hall lights', !S.flags.lightsOff, function () { S.flags.lightsOff = !S.flags.lightsOff; }, '#5fd38d');
      scButton(sc, 148, 80, 120, 40, 'Yard lights', !S.flags.yardOff, function () { S.flags.yardOff = !S.flags.yardOff; }, '#5fd38d');
      scButton(sc, 280, 80, 124, 40, 'Night mode', !!S.flags.night, function () { S.flags.night = !S.flags.night; lockAll(S.flags.night); }, '#ff6b5e');
      scText(c, 16, 150, 'Dock doors', '#f5b53d', 14);
      doors.forEach(function (d, i) { scButton(sc, 16 + i * 66, 160, 62, 38, dockLabel(i).replace(' ', '') + (S.doors[i] ? ' ●' : ''), !!S.doors[i], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(i, !S.doors[i]); }); });
      scText(c, 16, 226, 'Doors', '#f5b53d', 14);
      hdoors.forEach(function (d, i) { var s = hd(d.id); scButton(sc, 16 + (i % 4) * 98, 236 + Math.floor(i / 4) * 44, 90, 36, d.label.replace(' door', '') + (s.locked ? ' 🔒' : s.open ? ' open' : ''), s.locked, function () { doorLock(d); }, '#ff6b5e'); });
    } });
    c.solid(-0.45, 0.45, -0.25, 0.05, 0, 2.2);
  }
  // ── Dressing ──────────────────────────────────────────────────────
  var dress = { fans: [], clocks: [], dockLamps: [], wrapper: null, turntable: null, wrapCarriage: null, kpiCtx: null, kpiTex: null, vending: null, radio: null, charger: null };

  function tickClocks() { dress.clocks.forEach(function (c) { c.h.rotation.z = -(S.time / 12) * 6.283; c.m.rotation.z = -(S.time % 1) * 6.283; }); }
  function kpiBoard() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 320; dress.kpiCtx = c.getContext('2d');
    dress.kpiTex = new THREE.CanvasTexture(c); dress.kpiTex.encoding = THREE.sRGBEncoding;
    drawKpi();
    return new THREE.MeshBasicMaterial({ map: dress.kpiTex });
  }
  function drawKpi() {
    var c = dress.kpiCtx; if (!c) return; var w = 512, h = 320;
    c.fillStyle = '#f4f4f2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2c5f9e'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#2c5f9e'; c.font = 'bold 30px "Segoe Print", "Comic Sans MS", cursive'; c.textAlign = 'left'; c.fillText('THIS WEEK', 24, 48);
    var tot = S.stats.shipped || 0, late = S.stats.late || 0, ontime = tot ? Math.round(100 * (tot - late) / tot) : 100;
    var rows = [['on time', ontime + '%'], ['shipped', String(tot)], ['received', (S.stats.received || 0) + ' pallets'], ['in stock', totalStock() + ' boxes'], ['rep', String(Math.round(S.rep))]];
    c.font = '26px "Segoe Print", "Comic Sans MS", cursive';
    rows.forEach(function (r, i) { c.fillStyle = i === 0 ? (ontime >= 90 ? '#2f9e44' : '#c8342a') : '#1b232c'; c.fillText(r[0], 30, 96 + i * 42); c.textAlign = 'right'; c.fillText(r[1], w - 30, 96 + i * 42); c.textAlign = 'left'; });
    c.strokeStyle = '#c8342a'; c.lineWidth = 3; c.beginPath(); c.moveTo(30, 60); c.lineTo(w - 30, 60); c.stroke();
    c.fillStyle = '#c8342a'; c.font = '20px "Segoe Print", "Comic Sans MS", cursive'; c.fillText('close the dock doors at night!!', 30, h - 24);
    dress.kpiTex.needsUpdate = true;
  }

  function buildDressing() {
    var X = HALL.x, Z = HALL.z, H = HALL.h;
    // bollards guarding every dock door (the columns along the walls are the hall lining's, in 06-building)
    doors.forEach(function (d) { [-1, 1].forEach(function (s) { var bx = d.side * (X - 1.0), bz = d.z + s * (DOCKS.w / 2 + 0.5); cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, null, 10); cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, null, 10); }); });
    // the north wall: cable tray, sprinkler main, extractor fans, the exit sign, the painted name
    box(2 * X - 1, 0.08, 0.3, MAT.steelDark, 0, 5.6, -Z + 0.35); for (var cx = -18; cx <= 18; cx += 2) box(0.04, 0.08, 0.3, MAT.steelDark, cx, 5.6, -Z + 0.35);
    [-9.5, 9.5].forEach(function (z) { var p = cyl(0.07, 2 * X - 2, MAT.red, 0, 6.45, z, null, 10); p.rotation.z = Math.PI / 2; for (var sx = -16; sx <= 16; sx += 4) { cyl(0.025, 0.18, MAT.steelDark, sx, 6.3, z, null, 6); sphere(0.03, MAT.chrome, sx, 6.2, z); } });
    [-15, 15].forEach(function (x) {
      var g = new THREE.Group(); g.userData.dynamic = true; g.position.set(x, 5.4, -Z + 0.4); scene.add(g);
      var housing = cyl(0.62, 0.3, MAT.steelDark, 0, 0, 0, g, 24); housing.rotation.x = Math.PI / 2;
      var hub = new THREE.Group(); hub.position.z = 0.17; g.add(hub); cyl(0.08, 0.12, MAT.plastic, 0, 0, 0, hub, 10).rotation.x = Math.PI / 2;
      for (var b = 0; b < 4; b++) { var bl = box(0.16, 0.5, 0.02, MAT.plastic, 0, 0.28, 0, hub); bl.rotation.z = b * Math.PI / 2; bl.position.set(Math.sin(b * Math.PI / 2) * -0.28, Math.cos(b * Math.PI / 2) * 0.28, 0); bl.rotation.y = 0.5; }
      for (var r = 0; r < 5; r++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(0.15 + r * 0.11, 0.008, 6, 24), MAT.steelDark); ring.position.z = 0.26; g.add(ring); }
      dress.fans.push(hub);
    });
    var exitSign = function (x, y, z, ry) { var m = sign(['EXIT'], 0.5, 0.2, x, y, z, ry, { w: 256, h: 96, bg: '#1f7a3a', fg: '#dfffe8' }); var b = box(0.54, 0.24, 0.04, MAT.exit, x, y, z + (ry ? 0 : 0.03), null); b.rotation.y = ry || 0; if (ry) b.position.x += ry > 0 ? -0.03 : 0.03; m.renderOrder = 1; };

    [RACK.x0 - 1.1, -RACK.x0 + 1.1].forEach(function (x) { for (var z = RACK.rows[0] - 1; z <= RACK.rows[RACK.rows.length - 1] + 1; z += 0.7) plane(1.2, 0.35, MAT.whiteLine, x, 0.0065, z, -Math.PI / 2); });
    // dock lights beside every door, wheel chocks inside, guide rails and a chain hoist
    doors.forEach(function (d) {
      var x = d.side * (X - 0.3), z = d.z - DOCKS.w / 2 - 0.5;
      box(0.5, 0.06, 0.06, MAT.steelDark, x + d.side * -0.2, 4.6, z); var lamp = box(0.18, 0.18, 0.18, glowMat(0xffb020, 0.4), x - d.side * 0.5, 4.5, z);
      var dl = new THREE.PointLight(0xffb020, 0, 9, 2); dl.position.set(x - d.side * 0.9, 4.3, z); scene.add(dl); dress.dockLamps.push({ m: lamp, l: dl, door: d.i });   // the beacon throws real amber on the apron while a truck is on its way
      box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.3); box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.6);
      var rx = d.side * (X - 0.15); box(0.06, DOCKS.h, 0.06, MAT.steelDark, rx, DOCKS.h / 2, d.z - DOCKS.w / 2 - 0.05); box(0.06, DOCKS.h, 0.06, MAT.steelDark, rx, DOCKS.h / 2, d.z + DOCKS.w / 2 + 0.05); cyl(0.1, 0.3, MAT.steelDark, rx - d.side * 0.15, DOCKS.h + 0.3, d.z + DOCKS.w / 2 + 0.35, null, 10).rotation.x = Math.PI / 2; cyl(0.006, DOCKS.h - 0.6, MAT.chrome, rx - d.side * 0.15, DOCKS.h / 2 + 0.2, d.z + DOCKS.w / 2 + 0.35, null, 4);
    });
    // the forklift bay, the tool bays and the charger on the south wall
    var bay = function (cx, cz, w, d, label) { plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz - d / 2, -Math.PI / 2); plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz + d / 2, -Math.PI / 2); plane(0.08, d, MAT.yellowLine, cx - w / 2, 0.0062, cz, -Math.PI / 2); plane(0.08, d, MAT.yellowLine, cx + w / 2, 0.0062, cz, -Math.PI / 2); plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex([label], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), cx, 0.0066, cz + d / 2 - 0.3, -Math.PI / 2); };
    bay(SPOT.jack.x, SPOT.jack.z, 1.6, 2.2, 'JACK 1'); bay(SPOT.jack2.x, SPOT.jack2.z, 1.6, 2.2, 'JACK 2'); bay(SPOT.cart.x, SPOT.cart.z, 1.8, 1.4, 'CART');
    plane(1.4, 1.0, MAT.rubberMat, -X + 1.1, 0.004, SPOT.staffDoor.z, -Math.PI / 2); plane(1.0, 1.0, MAT.rubberMat, -X + 5.1, 0.004, 19.95, -Math.PI / 2);
    // the office blinds and the crossing into it
    for (var bl2 = 0; bl2 < 14; bl2++) box(5.4, 0.05, 0.02, MAT.trim, X - 3.9, 2.26 - bl2 * 0.08, 18.58);
    plane(1.4, 0.08, MAT.yellowLine, -X + 4.5, 0.0062, 19.95, -Math.PI / 2);
    plane(1.4, 0.08, MAT.yellowLine, 12.5, 0.0062, 9.95, -Math.PI / 2);
    // grime: a dark gradient along the foot of every wall, tyre scuffs at the dock aprons and in the aisles, oil where machines stand
    var grimeTex = tex(64, 64, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, 'rgba(20,18,16,0.5)'); g.addColorStop(0.5, 'rgba(20,18,16,0.18)'); g.addColorStop(1, 'rgba(20,18,16,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); for (var i = 0; i < 60; i++) { c.fillStyle = 'rgba(10,10,10,' + randf(0.05, 0.2) + ')'; c.fillRect(Math.random() * w, h - Math.random() * 20, randf(1, 4), randf(1, 3)); } });
    var grimeMat = new THREE.MeshBasicMaterial({ map: grimeTex, transparent: true, depthWrite: false }); grimeMat.userData.noBake = true;
    var gw = function (w, h, x, y, z, ry) { var m = plane(w, h, grimeMat, x, y, z, 0, ry); m.renderOrder = 1; m.userData.noBake = true; grimeTex.repeat.set(1, 1); };
    gw(2 * X - 0.6, 0.7, 0, 0.35, -Z + 0.19, 0); gw(2 * X - 0.6, 0.7, 0, 0.35, Z - 0.19, Math.PI); gw(2 * Z - 0.6, 0.7, -X + 0.19, 0.35, 0, Math.PI / 2); gw(2 * Z - 0.6, 0.7, X - 0.19, 0.35, 0, -Math.PI / 2);
    var markTex = tex(256, 64, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 2; i++) { var g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(0,0,0,0.35)'); g.addColorStop(0.7, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 10 + i * 30, w, 12); } for (var k = 0; k < 400; k++) { c.fillStyle = 'rgba(0,0,0,' + randf(0.05, 0.25) + ')'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 3), randf(1, 2)); } });
    var markMat = new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false, opacity: 0.8 }); markMat.userData.noBake = true;
    doors.forEach(function (dk) { var m = plane(6, 1.3, markMat, dk.side * (X - 4.5), 0.0045, dk.z + randf(-0.3, 0.3), -Math.PI / 2, 0); m.rotation.z = randf(-0.08, 0.08); m.renderOrder = 1; m.userData.noBake = true; });
    [-12, -6, 0, 6, 12].forEach(function (z) { for (var mx = -20; mx <= 20; mx += 7) { var m = plane(5, 1.1, markMat, mx + randf(-1, 1), 0.0045, z + randf(-0.4, 0.4), -Math.PI / 2, 0); m.rotation.z = randf(-0.1, 0.1); m.renderOrder = 1; m.userData.noBake = true; } });
    var oilTex = tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 5; i++) { var r = randf(14, 40), x = randf(r, w - r), y = randf(r, h - r), g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(10,10,14,0.55)'); g.addColorStop(0.7, 'rgba(10,10,14,0.25)'); g.addColorStop(1, 'rgba(10,10,14,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } });
    var oilMat = new THREE.MeshBasicMaterial({ map: oilTex, transparent: true, depthWrite: false }); oilMat.userData.noBake = true;
    [[SPOT.fork.x, SPOT.fork.z], [SPOT.jack.x, SPOT.jack.z], [SPOT.jack2.x, SPOT.jack2.z], [-16, -4], [16, -4]].forEach(function (p) { var m = plane(2.2, 2.2, oilMat, p[0] + randf(-0.4, 0.4), 0.0046, p[1] + randf(-0.4, 0.4), -Math.PI / 2, randf(0, 3)); m.renderOrder = 1; m.userData.noBake = true; });
    // light shafts under the skylights, with dust drifting in them
    var shaftMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); shaftMat.userData.noBake = true; dress.shaftMat = shaftMat;
    var shaftTex = tex(32, 256, function (c, w, h) { var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); var g2 = c.createLinearGradient(0, 0, w, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.3, 'rgba(0,0,0,0)'); g2.addColorStop(0.7, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = g2; c.fillRect(0, 0, w, h); }); shaftMat.alphaMap = shaftTex; shaftMat.map = shaftTex;
    SKYLIGHT_Z.forEach(function (z) { for (var sx = -X + 5; sx <= X - 5; sx += 6) { for (var k = 0; k < 2; k++) { var sh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, H - 0.2), shaftMat); sh.position.set(sx + (k ? 0.3 : -0.3), H / 2 - 0.1, z); sh.rotation.y = k ? Math.PI / 2 + 0.25 : 0.25; sh.rotation.z = 0.08; sh.userData.noBake = true; sh.renderOrder = 2; scene.add(sh); } } });
    var dustGeo = new THREE.BufferGeometry(), dustPos = new Float32Array(600 * 3); for (var dp = 0; dp < 600; dp++) { dustPos[dp * 3] = randf(-X + 2, X - 2); dustPos[dp * 3 + 1] = randf(0.5, H - 0.2); dustPos[dp * 3 + 2] = pick(SKYLIGHT_Z) + randf(-0.8, 0.8); } dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dress.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff6e0, size: 0.03, transparent: true, opacity: 0.5, depthWrite: false })); dress.dust.frustumCulled = false; dress.dust.userData.noBake = true; scene.add(dress.dust);
    buildPigeons();
  }
  function buySnack() {
    if (S.events.power) { toast('No power.', 'bad'); return; }
    if (S.bank < 3) { toast('No change on you.', 'bad'); return; }
    pay(-3, 'Snack from the machine'); buff.snackDay = S.day; buff.snackUntil = S.time + 0.5; sfx('vend'); toast('Crisps. Faster for half an hour.', 'good');
    if (dress.vending) { var wp = new THREE.Vector3(); dress.vending.getWorldPosition(wp); burst(wp.x, 0.5, wp.z, 0xf5b53d, 8, 'down'); }
  }
  // pigeons: three on a truss, off in a flap when you walk under them, back on another truss a while later
  var pigeons = [];
  function buildPigeons() {
    for (var i = 0; i < 3; i++) {
      var g = new THREE.Group(); g.userData.dynamic = true; scene.add(g);
      var body = sphere(0.09, MAT.grey, 0, 0, 0, g); body.scale.set(1, 0.8, 1.4); sphere(0.055, std({ color: 0x4a5560, roughness: 0.9 }), 0, 0.07, 0.1, g); box(0.02, 0.02, 0.05, MAT.yellow, 0, 0.06, 0.16, g);
      var wl = box(0.16, 0.01, 0.12, MAT.grey, -0.12, 0.03, 0, g), wr2 = box(0.16, 0.01, 0.12, MAT.grey, 0.12, 0.03, 0, g);
      var perch = { x: -16 + i * 8 + randf(-2, 2), z: pick([-9.5, 9.5]) };
      pigeons.push({ g: g, wl: wl, wr: wr2, x: perch.x, z: perch.z, y: HALL.h - 0.7, state: 'perch', t: 0, from: null, to: null, flap: Math.random() * 6 });
      g.position.set(perch.x, HALL.h - 0.7, perch.z); g.rotation.y = Math.random() * 6.28;
    }
  }
  function tickPigeons(dt) {
    pigeons.forEach(function (p) {
      if (p.state === 'perch') {
        p.t += dt; p.g.rotation.y += Math.sin(p.t * 0.7) * 0.004; p.wl.rotation.z = 0; p.wr.rotation.z = 0;
        if (dist2(player.x, player.z, p.x, p.z) < 30 && insideHall(player.x, player.z) && Math.random() < dt * 2) { p.state = 'fly'; p.t = 0; p.from = { x: p.x, z: p.z }; p.to = { x: clamp(p.x + randf(-14, 14), -17, 17), z: p.z > 0 ? -9.5 : 9.5 }; sfx('flap'); p.g.rotation.y = Math.atan2(p.to.x - p.from.x, p.to.z - p.from.z); }
      } else {
        p.t += dt / 3.5; var k = Math.min(1, p.t);
        p.x = lerp(p.from.x, p.to.x, k); p.z = lerp(p.from.z, p.to.z, k); p.y = HALL.h - 0.7 - Math.sin(k * Math.PI) * 1.6;
        p.flap += dt * 24; p.wl.rotation.z = Math.sin(p.flap) * 0.9; p.wr.rotation.z = -Math.sin(p.flap) * 0.9;
        if (k >= 1) { p.state = 'perch'; p.t = 0; }
      }
      p.g.position.set(p.x, p.y, p.z);
    });
  }
  function tickDressing(dt) {
    tickPigeons(dt);
    var power = !S.events.power;
    dress.fans.forEach(function (f) { f.rotation.z += dt * (power ? 9 : 0.5); });
    if (dress.turntable) dress.turntable.rotation.y += dt * (wrapperBusy() ? 1.4 : 0);
    if (dress.wrapCarriage) dress.wrapCarriage.position.y = wrapperBusy() ? 0.5 + Math.abs(Math.sin(worldTime * 0.9)) * 1.0 : 1.0;
    dress.dockLamps.forEach(function (l) { var d = doors[l.door]; var coming = S.trucks.some(function (t) { return (t.dir === 'in' ? t.dock : 2 + t.dock) === d.i && (t.state === 'coming' || t.state === 'leaving'); }); var on = coming ? (Math.sin(worldTime * 8) > 0 ? 1 : 0.1) : (S.doors[d.i] ? 0.55 : 0.1); l.m.material.emissiveIntensity = 0.2 + on * 2.0; if (l.l) l.l.intensity = power ? on * 1.3 : 0; });
    if (dress.charger && dress.charger.material) dress.charger.material.emissiveIntensity = power ? (forkCharging() ? (Math.sin(worldTime * 3) > 0 ? 1.5 : 0.4) : 1) : 0;
    tickClocks();
    if (dress.dust) { var dpa = dress.dust.geometry.attributes.position.array; for (var di = 0; di < dpa.length; di += 3) { dpa[di] += Math.sin(worldTime * 0.3 + di) * 0.004; dpa[di + 1] -= 0.02 * dt; if (dpa[di + 1] < 0.4) dpa[di + 1] = HALL.h - 0.2; } dress.dust.geometry.attributes.position.needsUpdate = true; }
  }
  // ── The prop system ───────────────────────────────────────────────
  // A prop is built by defProp(id, { label, x, z, rot, cat, wall, price, build(ctx, P) }). Its placement is the default from the
  // definition unless S.layout[id] overrides it. Bought extras live in S.custom as { id, type, x, z, rot }. Rotation is in quarter
  // turns. Each prop builds into its own group, so moving it is: remove the instance, build it again at the new spot.
  var PROPS = {}, PROP_ORDER = [], propInst = {};
  // defaults were authored for the 40 x 28 hall; the hall grew by 10 m on every side, so anything near a wall follows its wall
  function grown(v) { return Math.abs(v) >= 8 ? v + (v < 0 ? -HALL_GROW : HALL_GROW) : v; }
  var HALL_GROW = 10;   // the first growth (40 to 60 m wide); the second is wallX in the config
  function defProp(id, def) {
    if (!def.abs && typeof def.x === 'number') { def.x = grown(def.x); def.z = grown(def.z); }
    if (typeof def.x === 'number' && !def.keep && !/^gantry/.test(id)) def.x = wallX(def.x, def.z, !!def.yard);   // the side walls moved out: wall-side props follow
    def.id = id; PROPS[id] = def; PROP_ORDER.push(id); }
  function propDef(id) { if (PROPS[id]) return PROPS[id]; var c = customById(id); return c ? PROPS[c.type] : null; }
  function customById(id) { return (S.custom || []).filter(function (c) { return c.id === id; })[0] || null; }
  function propPlacement(id) {
    var d = PROPS[id], c = customById(id), o = (S.layout && S.layout[id]) || {};
    if (c) return { x: typeof o.x === 'number' ? o.x : c.x, z: typeof o.z === 'number' ? o.z : c.z, rot: typeof o.rot === 'number' ? o.rot : (c.rot || 0), h: typeof o.h === 'number' ? o.h : (c.h || 0), hidden: !!o.hidden, custom: true };
    return { x: typeof o.x === 'number' ? o.x : d.x, z: typeof o.z === 'number' ? o.z : d.z, rot: typeof o.rot === 'number' ? o.rot : (d.rot || 0), h: o.h || 0, hidden: !!o.hidden, custom: false };
  }
  function propLabel(id) { var d = propDef(id); return d ? d.label : id; }
  function rotAABB(o, rot) {
    var pts = [[o.x0, o.z0], [o.x1, o.z0], [o.x0, o.z1], [o.x1, o.z1]], a = rot * Math.PI / 2, c = Math.cos(a), s = Math.sin(a), xs = [], zs = [];
    pts.forEach(function (p) { xs.push(p[0] * c + p[1] * s); zs.push(-p[0] * s + p[1] * c); });
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), z0: Math.min.apply(null, zs), z1: Math.max.apply(null, zs) };
  }
  function propCtx(g, id) {
    var obs = [];
    var ctx = {
      group: g, obstacles: obs,
      box: function (w, h, d, mat, x, y, z) { return box(w, h, d, mat, x, y, z, g); },
      cyl: function (r, h, mat, x, y, z, seg, rb) { return cyl(r, h, mat, x, y, z, g, seg, rb); },
      sphere: function (r, mat, x, y, z) { return sphere(r, mat, x, y, z, g); },
      plane: function (w, h, mat, x, y, z, rx, ry) { return plane(w, h, mat, x, y, z, rx, ry, g); },
      sign: function (lines, w, h, x, y, z, ry, opt) { return sign(lines, w, h, x, y, z, ry, opt, g); },
      poster: function (kind, w, h, x, y, z, ry) { return poster(kind, w, h, x, y, z, ry, g); },
      hit: function (w, h, d, x, y, z, def) { var m = hitBox(w, h, d, x, y, z, def, g); m.userData.propId = id; return m; },
      solid: function (x0, x1, z0, z1, y0, y1) { obs.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: y0 === undefined ? -1 : y0, y1: y1 === undefined ? 3 : y1 }); },
      add: function (m) { g.add(m); return m; }
    };
    return ctx;
  }
  function removePropInst(id) {
    var inst = propInst[id]; if (!inst) return;
    inst.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); if (o.isMesh && o.geometry && !o.userData.sharedGeo) { /* geometry from boxGeo is cached and shared: do not dispose */ } });
    scene.remove(inst.g);
    var inGroup = function (o) { for (var p = o; p; p = p.parent) if (p === inst.g) return true; return false; };
    yard.lampLenses = yard.lampLenses.filter(function (l) { return !inGroup(l); }); for (var yl = yardLights.length - 1; yl >= 0; yl--) if (inGroup(yardLights[yl])) yardLights.splice(yl, 1);
    dress.clocks = dress.clocks.filter(function (c) { return !c.group || !inGroup(c.group); }); screens.forEach(function (s, k) { if (inGroup(s.mesh)) screens.splice(k, 1); });
    BELT_PLANES = BELT_PLANES.filter(function (p) { return !inGroup(p); });
    for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1);
    delete propInst[id]; NAV.dirty = true; beltsChanged();
  }
  // a belt piece that is going for good: whatever rides it is set down on the floor where it was
  function beltSpill(id) {
    var b = BELTS[id]; if (!b) return; var placed = !!(customById(id) || PROPS[id]);   // no record any more: set them down at your feet rather than ask a missing prop where it stood
    beltItems(id).forEach(function (it) { var w = placed ? beltPoint(b, it.d) : { x: player.x, z: player.z, ry: player.yaw }; if (it.kind === 'box') S.floor.push({ kind: 'box', sku: it.sku, x: w.x, y: floorY(w.x, w.z), z: w.z, rot: w.ry }); else if (it.kind === 'parcel' && it.order) S.floor.push({ kind: 'parcel', order: it.order, x: w.x, y: floorY(w.x, w.z), z: w.z, rot: w.ry }); });
    beltItems(id).length = 0;
    delete S.belts[id]; delete BELTS[id]; beltsChanged();
  }
  function buildProp(id) {
    removePropInst(id);
    var def = propDef(id); if (!def) return null;
    var P = propPlacement(id), g = new THREE.Group(); g.userData.propId = id; g.position.set(P.x, propGroundY(P.x, P.z), P.z); g.rotation.y = P.rot * Math.PI / 2;
    var ctx = propCtx(g, id), inst = { id: id, g: g, P: P, ctx: ctx };
    propInst[id] = inst;
    if (!P.hidden) {
      def.build(ctx, P, inst);
      if (def.beltPath) { var bh = P.h || 0; BELTS[id] = { id: id, prop: id, path: def.beltPath.map(function (p) { return [p[0], p[1], (p[2] || 0) + bh, p[3]]; }), speedKey: 'belts', piece: true }; }
      g.traverse(function (o) { if (o.isMesh) o.userData.propId = id; });
      ctx.obstacles.forEach(function (o) { var r = rotAABB(o, P.rot); solids.push({ x0: P.x + r.x0, x1: P.x + r.x1, z0: P.z + r.z0, z1: P.z + r.z1, y0: o.y0, y1: o.y1, prop: id }); });
      if (def.after) def.after(ctx, P, inst);
      if (!def.wall && ctx.obstacles.length) { var fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9; ctx.obstacles.forEach(function (o) { fx0 = Math.min(fx0, o.x0); fx1 = Math.max(fx1, o.x1); fz0 = Math.min(fz0, o.z0); fz1 = Math.max(fz1, o.z1); }); groundBlob((fx1 - fx0) * 1.5 + 0.3, (fz1 - fz0) * 1.5 + 0.3, (fx0 + fx1) / 2, (fz0 + fz1) / 2, g, 0); }
    }
    scene.add(g); NAV.dirty = true; shadowDirty = true; beltsChanged();
    return inst;
  }
  function buildProps() { PROP_ORDER.forEach(function (id) { if (!PROPS[id].extra && (!PROPS[id].when || PROPS[id].when())) buildProp(id); }); (S.custom || []).forEach(function (c) { if (PROPS[c.type]) buildProp(c.id); }); }
  function propGroundY(x, z) { if (insideHall(x, z)) return 0; for (var i = 0; i < S.trucks.length; i++) { var t = S.trucks[i]; if (t.state === 'docked') { var b = trailerBounds(t); if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return 0; } } return YARD_Y; }
  function propIdOf(obj) { for (var o = obj; o; o = o.parent) if (o.userData && o.userData.propId) return o.userData.propId; return null; }

  // ── Build mode ────────────────────────────────────────────────────
  var edit = { on: false, grabbed: null, helper: null, snap: true, wallAim: null, snapCycle: 0, grabRot: 0 };   // snapCycle: which snap (or free heading) R has walked to for the carried belt piece
  function editToggle() {
    if (edit.grabbed) editDrop(true);
    edit.on = !edit.on;
    var eb = $('h-edit'); if (eb) { eb.hidden = !edit.on; }
    if (edit.on) { unbakeStatic(); focus = null; toast('🛠️ Build mode: aim at a prop and E grabs it · R turns · Backspace puts it back · Del removes · C is the catalogue · F2 done', ''); }
    else { if (edit.helper) { scene.remove(edit.helper); edit.helper = null; } bakeStatic(); save(); toast('Layout saved', 'good'); }
    sfx('click'); hudDirty = true;
  }
  function editHelper(obj, col) {
    if (!obj) { if (edit.helper) edit.helper.visible = false; return; }
    if (edit.helper && edit.helper.userData.col !== col) { scene.remove(edit.helper); edit.helper = null; }
    if (!edit.helper) { edit.helper = new THREE.BoxHelper(obj, col); edit.helper.userData.col = col; scene.add(edit.helper); }
    edit.helper.visible = true; edit.helper.setFromObject(obj);
  }
  // where the carried prop goes: the point on the floor the player aims at, or 2.6 m ahead; wall props sit on the nearest wall face
  var WALLS = [];
  function wallPlanes() {
    if (WALLS.length) return WALLS;
    var X = HALL.x, Z = HALL.z;
    WALLS.push({ a: 'x', v: -X + 0.17, n: 1, z0: -Z, z1: Z }, { a: 'x', v: X - 0.17, n: -1, z0: -Z, z1: Z }, { a: 'z', v: -Z + 0.17, n: 1, x0: -X, x1: X }, { a: 'z', v: Z - 0.17, n: -1, x0: -X, x1: X });
    WALLS.push({ a: 'x', v: X - 7.58, n: -1, z0: 18.5, z1: Z }, { a: 'x', v: X - 7.42, n: 1, z0: 18.5, z1: Z }, { a: 'z', v: 18.42, n: -1, x0: X - 7.5, x1: X }, { a: 'z', v: 18.58, n: 1, x0: X - 7.5, x1: X });
    WALLS.push({ a: 'x', v: -X + 4.42, n: 1, z0: 18.5, z1: Z }, { a: 'x', v: -X + 4.58, n: -1, z0: 18.5, z1: Z }, { a: 'z', v: 18.42, n: -1, x0: -X, x1: -X + 4.5 }, { a: 'z', v: 18.58, n: 1, x0: -X, x1: -X + 4.5 });
    WALLS.push({ a: 'x', v: -X + 6.92, n: 1, z0: -Z, z1: -20.2 }, { a: 'x', v: -X + 7.08, n: -1, z0: -Z, z1: -20.2 }, { a: 'z', v: -20.28, n: -1, x0: -X, x1: -X + 7 }, { a: 'z', v: -20.12, n: 1, x0: -X, x1: -X + 7 });
    return WALLS;
  }
  function editAim(def) {
    ray.setFromCamera(centre, camera);
    var dir = ray.ray.direction, o = ray.ray.origin, y = Math.max(YARD_Y, floorY(player.x, player.z)), pt;
    var t = (y - o.y) / dir.y;
    if (dir.y < -0.05 && t > 0 && t < 10) pt = o.clone().add(dir.clone().multiplyScalar(t));
    else { var flat = dir.clone(); flat.y = 0; flat.normalize(); pt = o.clone().add(flat.multiplyScalar(2.6)); pt.y = y; }
    var sn = function (v) { return edit.snap ? Math.round(v * 20) / 20 : v; };
    if (def.beltPath) { var bs = beltSnap(def, pt, edit.grabbed); edit.snapText = bs ? bs.text : ''; if (bs) return bs; }
    if (def.wall) {
      var best = null, bd = 2.5;
      wallPlanes().forEach(function (w) { var d = w.a === 'x' ? Math.abs(pt.x - w.v) : Math.abs(pt.z - w.v); var within = w.a === 'x' ? (pt.z > w.z0 && pt.z < w.z1) : (pt.x > w.x0 && pt.x < w.x1); if (within && d < bd) { bd = d; best = w; } });
      if (best) { if (best.a === 'x') return { x: best.v, z: sn(pt.z), rot: best.n > 0 ? 1 : 3, wall: true }; return { x: sn(pt.x), z: best.v, rot: best.n > 0 ? 0 : 2, wall: true }; }
    }
    var lim = def.yard ? 80 : HALL.x - 0.4, limz = def.yard ? 60 : HALL.z - 0.4;
    return { x: clamp(sn(pt.x), -lim, lim), z: clamp(sn(pt.z), -limz, limz), rot: null, wall: false };
  }
  // Where a carried belt piece snaps. Anchors are gathered fresh each time: free belt ends, machine outlets, the parcel shelf
  // and the inbound doors feed a piece (its start goes there); free belt starts, machine inlets, the outbound doors and the
  // rack bays take from a piece (its end goes there). The nearest anchor within two metres of the aim wins; the piece turns
  // to run with it, and climbs or drops to its height. A belt end that already feeds something, or a start already fed, is skipped.
  function beltSnap(def, pt, selfId) {
    var R2 = REACH * REACH, A = [], X = HALL.x, Z = HALL.z;
    for (var k in BELTS) { var b = BELTS[k]; if (k === selfId || !propInst[b.prop]) continue; var e = beltPoint(b, beltLen(b)), s = beltPoint(b, 0); if (!b.noSink && !beltSink(b)) A.push({ x: e.x, z: e.z, y: e.y, dir: e.ry, feeds: true, what: 'the ' + beltLabel(b) }); if (!beltFeeder(b)) A.push({ x: s.x, z: s.z, y: s.y, dir: s.ry, feeds: false, what: 'the ' + beltLabel(b) }); }
    for (var mk in MACH) { var mc = MACH[mk]; if (mc.door !== undefined) continue; machinePoints(mc, 'out').forEach(function (p) { A.push({ x: p.x, z: p.z, y: BELT_Y, dir: null, feeds: true, what: 'the ' + propLabel(mc.prop) }); }); if (mc.accept) machinePoints(mc, 'in').forEach(function (p) { A.push({ x: p.x, z: p.z, y: BELT_Y, dir: null, feeds: false, what: 'the ' + propLabel(mc.prop) }); }); }
    if (propInst.packline) { var sh = propWorld('packline', 0, 7.0); A.push({ x: sh.x, z: sh.z, y: BELT_Y, dir: sh.a, feeds: true, what: 'the parcel shelf' }); }
    for (var di = 0; di < DOOR_MAP.length; di++) { if (!doors[di]) continue; var at = doorInside(di); A.push({ x: at[0], z: at[1], y: BELT_Y, dir: Math.PI / 2, feeds: DOOR_MAP[di].dir === 'in', what: 'dock door ' + dockLabel(di) }); }
    var gRows = groundRows(); for (var gri = 0; gri < gRows.length; gri++) for (var bb = 0; bb < rowBays(gRows[gri]); bb++) { var r = gRows[gri], sp = rackSlotPos(r, bb, 0), a = sp.ry || 0; [-1, 1].forEach(function (f) { A.push({ x: sp.x + Math.sin(a) * f * 1.1, z: sp.z + Math.cos(a) * f * 1.1, y: BELT_Y, dir: f > 0 ? a + Math.PI : a, feeds: false, what: slotName(slotKey(r, bb, 0)) }); }); }
    // every anchor within 2.2 m of the aim, nearest first. R walks this list and then the four free headings, so a piece is never
    // stuck on the wrong anchor: it used to take the nearest only, and R did nothing while snapped (a piece into OUT 1 kept
    // landing the wrong way round, Tyson 2026-10-06).
    var near = A.filter(function (an) { return dist2(pt.x, pt.z, an.x, an.z) < 2.2 * 2.2; }).sort(function (p1, p2) { return dist2(pt.x, pt.z, p1.x, p1.z) - dist2(pt.x, pt.z, p2.x, p2.z); });
    var n = near.length, span = n + 4, pick = (((edit.snapCycle || 0) % span) + span) % span, sn = function (v) { return edit.snap ? Math.round(v * 20) / 20 : v; };
    if (pick >= n) { var fr = ((edit.grabRot || 0) + pick - n) % 4, lim = HALL.x - 0.4, limz = HALL.z - 0.4; return { x: clamp(sn(pt.x), -lim, lim), z: clamp(sn(pt.z), -limz, limz), rot: fr, wall: false, text: 'Free · runs ' + ['south', 'east', 'north', 'west'][fr] + ' · E places · R turns' + (n ? ', then snaps again' : '') }; }
    var best = near[pick], step = ' · E places · R: ' + (n > 1 ? 'snap ' + (pick + 1) + ' of ' + n + ', next, then free' : 'free placing');
    var path = def.beltPath, last = path[path.length - 1], prev = path[path.length - 2], endDir = Math.atan2(last[0] - prev[0], last[1] - prev[1]), cur = propInst[selfId] ? propInst[selfId].P.rot : 0, q = Math.PI / 2;
    function wrap4(k) { return ((Math.round(k) % 4) + 4) % 4; }
    if (best.feeds) { var rot = best.dir === null ? cur : wrap4(best.dir / q); return { x: best.x, z: best.z, rot: rot, h: Math.round((best.y - BELT_Y) * 100) / 100, wall: false, text: 'Snapped: takes from ' + best.what + step }; }
    var rot2 = best.dir === null ? cur : wrap4((best.dir - endDir) / q), a2 = rot2 * q, ex = last[0] * Math.cos(a2) + last[1] * Math.sin(a2), ez = -last[0] * Math.sin(a2) + last[1] * Math.cos(a2);
    return { x: best.x - ex, z: best.z - ez, rot: rot2, h: Math.round((best.y - BELT_Y - (last[2] || 0)) * 100) / 100, wall: false, text: 'Snapped: feeds ' + best.what + step };
  }
  function ghostProp(id) { propInst[id].g.traverse(function (o) { if (o.isMesh && o.material && o.material.clone && !o.userData.ghosted) { o.userData.origMat = o.material; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.material.depthWrite = false; o.castShadow = false; o.userData.ghosted = true; } }); }
  function editTick() {
    if (!edit.on) return;
    if (edit.grabbed) {
      var inst = propInst[edit.grabbed]; if (!inst) { edit.grabbed = null; return; }
      var def = propDef(edit.grabbed), aim = editAim(def);
      // a belt piece snapped at another height is rebuilt at that height, legs and all, while it is still being carried
      if (def.beltPath && typeof aim.h === 'number' && Math.abs((inst.P.h || 0) - aim.h) > 0.01) { var cc = customById(edit.grabbed); if (cc) cc.h = aim.h; if (S.layout && S.layout[edit.grabbed]) S.layout[edit.grabbed].h = aim.h; buildProp(edit.grabbed); inst = propInst[edit.grabbed]; inst.P.h = aim.h; for (var si = solids.length - 1; si >= 0; si--) if (solids[si].prop === edit.grabbed) solids.splice(si, 1); ghostProp(edit.grabbed); }
      inst.g.position.set(aim.x, propGroundY(aim.x, aim.z), aim.z); if (aim.rot !== null && (def.wall || def.beltPath)) { inst.P.rot = aim.rot; inst.g.rotation.y = aim.rot * Math.PI / 2; }
      editHelper(inst.g, 0xf5b53d);
    } else if (focus && focus.editId && propInst[focus.editId]) editHelper(propInst[focus.editId].g, 0x5fd38d);
    else editHelper(null);
  }
  function editGrab(id) {
    if (edit.grabbed || !propInst[id]) return;
    var def = propDef(id); if (def.fixed) { toast('That one stays where it is.', 'bad'); return; }
    edit.grabbed = id; edit.snapText = ''; edit.snapCycle = 0; edit.grabRot = propInst[id].P.rot || 0; for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1); NAV.dirty = true;
    ghostProp(id);
    sfx('pickup'); toast('Carrying the ' + propLabel(id) + ' · E places · R turns · Esc drops it back' + (def.beltPath ? ' · it snaps to belt ends, machines, doors and rack bays' : ''), '');
  }
  function editDrop(cancel) {
    var id = edit.grabbed; if (!id) return; edit.grabbed = null; edit.snapText = '';
    var inst = propInst[id], def = propDef(id);
    if (!cancel && inst) { if (!S.layout) S.layout = {}; S.layout[id] = { x: Math.round(inst.g.position.x * 100) / 100, z: Math.round(inst.g.position.z * 100) / 100, rot: inst.P.rot, h: inst.P.h || 0 }; sfx('putdown'); }
    buildProp(id); editHelper(null); save();
    if (!cancel && inst) { if (def && def.beltPath && BELTS[id]) { var fd = feederLabel(beltFeeder(BELTS[id])), sk = sinkLabel(beltSink(BELTS[id])); toast('Placed the ' + propLabel(id) + (fd ? ' · takes from ' + fd : ' · nothing feeds it yet') + (sk ? ' · feeds ' + sk : ' · ends in the open'), fd || sk ? 'good' : ''); } else toast('Placed the ' + propLabel(id), 'good'); }
  }
  function editRotate(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id || !propInst[id]) return;
    var inst = propInst[id], def = propDef(id); if (def.wall && !edit.grabbed) { toast('Wall pieces face the wall.', ''); return; }
    if (edit.grabbed && def.beltPath) { edit.snapCycle++; sfx('click'); return; }   // a carried belt piece: R walks the snaps near the aim, then the four free headings; beltSnap applies it
    inst.P.rot = (inst.P.rot + 1) % 4; inst.g.rotation.y = inst.P.rot * Math.PI / 2; sfx('click');
    if (!edit.grabbed) { if (!S.layout) S.layout = {}; S.layout[id] = { x: inst.g.position.x, z: inst.g.position.z, rot: inst.P.rot }; buildProp(id); save(); }
  }
  function editReset(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id) return;
    if (edit.grabbed) edit.grabbed = null;
    if (S.layout) delete S.layout[id]; buildProp(id); editHelper(null); sfx('ok'); toast('Put the ' + propLabel(id) + ' back where it started', 'good'); save();
  }
  function editRemove(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id) return;
    var c = customById(id);
    if (edit.grabbed) edit.grabbed = null;
    if (c) { var def = PROPS[c.type]; if (def && def.beltPath) beltSpill(id); S.custom.splice(S.custom.indexOf(c), 1); removePropInst(id); if (def && def.beltPath) { delete BELTS[id]; if (S.belts) delete S.belts[id]; } if (def && def.price) { pay(Math.round(def.price / 2), 'Sold back: ' + def.label); toast('Sold the ' + def.label + ' back for half', ''); } }
    else { if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = true; buildProp(id); toast('Removed the ' + propLabel(id) + ' (the catalogue brings it back)', ''); }
    editHelper(null); sfx('bad'); save();
  }
  function editRestore(id) { if (S.layout && S.layout[id]) { delete S.layout[id].hidden; } buildProp(id); sfx('ok'); toast('The ' + propLabel(id) + ' is back', 'good'); save(); }
  function editBuy(type) {
    var def = PROPS[type]; if (!def || !def.extra) return;
    if (def.price && S.bank < def.price) { toast('That costs ' + money(def.price) + ' and you have ' + money(S.bank), 'bad'); return; }
    if (def.price) pay(-def.price, 'Bought: ' + def.label);
    if (!S.custom) S.custom = [];
    var aim = editAim(def), c = { id: uid('cp'), type: type, x: aim.x, z: aim.z, rot: aim.rot || 0, h: aim.h || 0 }; S.custom.push(c);
    buildProp(c.id); closePanel(); editGrab(c.id); toast('Carrying the ' + def.label + ' · aim and press E', '');
  }
  // the catalogue (C): removed props to bring back, and extras to buy
  var CAT_GROUPS = [['belt', '🛤 Conveyors: lay a line from parts. A piece snaps to belt ends, machines, dock doors and rack bays as you carry it.'], ['room', '🛋 Break room and office'], ['hall', '🏭 The hall'], ['wall', '🖼 On the wall'], ['yard', '🌳 The yard']];
  function catalogueHtml() {
    var h = '<p>Build mode. Press <kbd>E</kbd> on a prop to carry it, <kbd>R</kbd> to turn it (a carried belt piece first walks through the snap points near your aim, then turns freely), <kbd>Backspace</kbd> to put it back where it started, <kbd>Del</kbd> to remove it. Bought extras sell back for half.</p>';
    var hidden = PROP_ORDER.filter(function (id) { return !PROPS[id].extra && propPlacement(id).hidden; });
    if (hidden.length) h += '<h3>Removed</h3><div class="dc-grid">' + hidden.map(function (id) { return '<div class="dc-card"><div class="body"><b>' + esc(PROPS[id].label) + '</b></div>' + btn('restore', id, 'Bring back', 'primary') + '</div>'; }).join('') + '</div>';
    CAT_GROUPS.forEach(function (gr) {
      var items = PROP_ORDER.filter(function (id) { return PROPS[id].extra && PROPS[id].cat === gr[0]; }); if (!items.length) return;
      h += '<h3>' + gr[1] + '</h3><div class="dc-grid">' + items.map(function (id) { var d = PROPS[id]; return '<div class="dc-card"><div class="body"><b>' + (d.ico || '') + ' ' + esc(d.label) + '</b><small>' + esc(d.desc || '') + '</small></div><div style="text-align:right"><div class="price">' + (d.price ? money(d.price) : 'free') + '</div>' + btn('buy', id, 'Add', 'primary', d.price > S.bank) + '</div></div>'; }).join('') + '</div>';
    });
    return h;
  }

  // ── Static bake: props are merged too, and come apart again for build mode ───
  function unbakeStatic() { baked.meshes.forEach(function (m) { scene.remove(m); m.geometry.dispose(); }); baked.meshes = []; baked.draws = 0; baked.hidden = 0; scene.traverse(function (o) { if (o.userData.bakedAway) { o.visible = true; o.userData.bakedAway = false; } }); }

  // ── The definitions ───────────────────────────────────────────────
  // Local coordinates: the prop's origin is on the floor at the middle of its footprint; +z is its front. rot turns it in quarters.
  var CHAIR_RED = std({ color: 0xc8342a, roughness: 0.6 });
  function chairBuild(c) {
    var shell = new THREE.Mesh(bevelGeo(0.44, 0.05, 0.44, 0.02), CHAIR_RED); shell.position.set(0, 0.46, 0); shell.castShadow = true; c.group.add(shell);
    var back = new THREE.Mesh(bevelGeo(0.42, 0.4, 0.04, 0.02), CHAIR_RED); back.position.set(0, 0.72, -0.2); back.rotation.x = -0.12; c.group.add(back);
    [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (l) { c.cyl(0.014, 0.44, MAT.chrome, l[0], 0.22, l[1], 8); c.cyl(0.02, 0.012, MAT.black, l[0], 0.006, l[1], 8); });
    c.cyl(0.012, 0.36, MAT.chrome, 0, 0.26, -0.18, 6).rotation.z = Math.PI / 2; c.cyl(0.012, 0.36, MAT.chrome, 0, 0.26, 0.18, 6).rotation.z = Math.PI / 2;
    c.cyl(0.012, 0.3, MAT.chrome, -0.18, 0.62, -0.2, 6); c.cyl(0.012, 0.3, MAT.chrome, 0.18, 0.62, -0.2, 6); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 0.5);
  }  function tableBuild(c) {
    var top = new THREE.Mesh(bevelGeo(1.0, 0.05, 1.0, 0.015), std({ color: 0xd7cbb0, roughness: 0.5, map: TEX.wood, normalMap: NRM.wood })); top.position.set(0, 0.75, 0); top.castShadow = true; c.group.add(top); c.box(1.02, 0.02, 1.02, MAT.black, 0, 0.72, 0);
    c.box(0.9, 0.05, 0.05, MAT_MACH.frame, 0, 0.69, -0.42); c.box(0.9, 0.05, 0.05, MAT_MACH.frame, 0, 0.69, 0.42); [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]].forEach(function (o) { c.box(0.05, 0.7, 0.05, MAT_MACH.frame, o[0], 0.35, o[1]); c.cyl(0.03, 0.01, MAT.black, o[0], 0.005, o[1], 8); });
    c.cyl(0.045, 0.1, MAT.white, 0.25, 0.83, -0.15, 12); c.cyl(0.035, 0.08, std({ color: 0x4a2c1a, roughness: 1 }), 0.25, 0.84, -0.15, 10); c.box(0.2, 0.012, 0.28, MAT.paper, -0.22, 0.785, 0.15); c.box(0.18, 0.004, 0.26, std({ color: 0xe8e2cc, roughness: 1 }), -0.2, 0.794, 0.17);
    c.cyl(0.04, 0.12, std({ color: 0xb8322a, roughness: 0.3, metalness: 0.4 }), 0.3, 0.84, 0.25, 10); c.box(0.12, 0.04, 0.08, std({ color: 0xf2b705, roughness: 0.6 }), -0.3, 0.8, -0.3); c.cyl(0.006, 0.14, MAT.black, 0.0, 0.78, 0.35, 6).rotation.z = Math.PI / 2;
    c.solid(-0.5, 0.5, -0.5, 0.5, 0, 0.8);
  }  function lockerBuild(c) {
    var LK = std({ color: 0x6f7b86, roughness: 0.5, metalness: 0.4 }), LD = std({ color: 0x5a6670, roughness: 0.5, metalness: 0.4 });
    c.box(1.24, 0.08, 0.5, MAT.black, 0, 0.04, 0); c.box(1.24, 1.82, 0.48, LK, 0, 0.99, -0.02); c.box(1.26, 0.04, 0.5, LK, 0, 1.92, -0.02);
    [-0.31, 0.31].forEach(function (lx, i) {
      c.box(0.56, 1.7, 0.03, LD, lx, 0.99, 0.23);
      for (var vv = 0; vv < 4; vv++) { c.box(0.34, 0.012, 0.015, MAT.black, lx, 1.68 - vv * 0.035, 0.245); c.box(0.34, 0.012, 0.015, MAT.black, lx, 0.42 - vv * 0.035, 0.245); }
      c.box(0.03, 0.1, 0.025, MAT.chrome, lx + 0.22, 1.0, 0.25); c.box(0.05, 0.03, 0.02, MAT.chrome, lx + 0.22, 1.1, 0.25); var hasp = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), MAT.chrome); hasp.position.set(lx + 0.22, 1.13, 0.26); c.add(hasp);
      c.box(0.2, 0.06, 0.012, MAT.white, lx, 1.8, 0.248); c.sign([String(i + 1)], 0.08, 0.05, lx, 1.8, 0.256, 0, { w: 64, h: 40, bg: '#ffffff', fg: '#1b232c' });
    });
    c.box(0.03, 1.7, 0.03, LK, 0, 0.99, 0.235);
    c.solid(-0.65, 0.65, -0.28, 0.28, 0, 2);
  }
  function cotBuild(c) {
    var FR = MAT_MACH.frame; [[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]].forEach(function (o) { c.box(0.05, 0.42, 0.05, FR, o[0], 0.21, o[1]); c.cyl(0.03, 0.012, MAT.black, o[0], 0.006, o[1], 8); });
    c.box(1.9, 0.05, 0.05, FR, 0, 0.42, -0.44); c.box(1.9, 0.05, 0.05, FR, 0, 0.42, 0.44); c.box(0.05, 0.05, 0.9, FR, -0.92, 0.42, 0); c.box(0.05, 0.05, 0.9, FR, 0.92, 0.42, 0); for (var sl = -0.8; sl <= 0.8; sl += 0.2) c.box(0.03, 0.02, 0.86, FR, sl, 0.43, 0);
    c.box(0.05, 0.5, 0.05, FR, -0.92, 0.65, -0.44); c.box(0.05, 0.5, 0.05, FR, -0.92, 0.65, 0.44); c.box(0.05, 0.05, 0.93, FR, -0.92, 0.9, 0); c.box(0.05, 0.3, 0.05, FR, 0.92, 0.55, -0.44); c.box(0.05, 0.3, 0.05, FR, 0.92, 0.55, 0.44); c.box(0.05, 0.05, 0.93, FR, 0.92, 0.7, 0);
    var mat = new THREE.Mesh(bevelGeo(1.84, 0.16, 0.84, 0.05), std({ color: 0x3c6ea6, roughness: 0.9 })); mat.position.set(0, 0.53, 0); mat.castShadow = true; c.group.add(mat); c.box(1.84, 0.01, 0.84, std({ color: 0x325c8a, roughness: 0.9 }), 0, 0.53, 0);
    var pil = new THREE.Mesh(bevelGeo(0.5, 0.12, 0.4, 0.05), MAT.white); pil.position.set(-0.6, 0.66, 0); pil.rotation.z = 0.06; c.group.add(pil);
    var bl = new THREE.Mesh(bevelGeo(0.7, 0.1, 0.8, 0.03), std({ color: 0x6b2b2b, roughness: 1 })); bl.position.set(0.5, 0.65, 0); c.group.add(bl); c.box(0.7, 0.012, 0.8, std({ color: 0x8a3b3b, roughness: 1 }), 0.5, 0.71, 0); c.box(0.02, 0.1, 0.8, std({ color: 0x5a2424, roughness: 1 }), 0.16, 0.65, 0);
    c.sign(['FIRST AID COT'], 0.6, 0.12, 0, 0.96, -0.47, 0, { w: 256, h: 56, bg: '#1b232c', fg: '#eef1f5' });
    c.hit(2.0, 1.0, 1.0, 0, 0.5, 0, { prompt: function () { return cotPrompt(); }, use: function () { sleepNow(); } });
    c.solid(-0.95, 0.95, -0.47, 0.47, 0, 0.9);
  }  function coffeeBuild(c) {
    var CAB = std({ color: 0xcfd5d2, roughness: 0.6 }), DOOR = std({ color: 0xbfc6c3, roughness: 0.55 }); c.box(1.36, 0.1, 0.52, MAT.black, 0, 0.05, -0.03); c.box(1.4, 0.8, 0.6, CAB, 0, 0.5, 0); [-0.47, 0, 0.47].forEach(function (dx) { var d = new THREE.Mesh(bevelGeo(0.42, 0.66, 0.02, 0.01), DOOR); d.position.set(dx, 0.5, 0.31); c.group.add(d); c.box(0.02, 0.12, 0.03, MAT.chrome, dx + 0.15, 0.7, 0.33); }); var top = new THREE.Mesh(bevelGeo(1.46, 0.04, 0.66, 0.012), std({ color: 0x3a3e45, roughness: 0.35 })); top.position.set(0, 0.92, 0); c.group.add(top); c.box(1.46, 0.08, 0.03, CAB, 0, 0.98, -0.31);
    c.box(0.34, 0.03, 0.3, MAT.chrome, 0.42, 0.935, -0.02); c.box(0.3, 0.12, 0.26, MAT.steel, 0.42, 0.88, -0.02); var tap = c.cyl(0.012, 0.22, MAT.chrome, 0.42, 1.02, -0.18, 8); var tap2 = c.cyl(0.01, 0.16, MAT.chrome, 0.42, 1.12, -0.11, 8); tap2.rotation.x = Math.PI / 2; c.box(0.05, 0.015, 0.03, MAT.chrome, 0.48, 1.0, -0.18); c.box(0.1, 0.06, 0.02, MAT.plastic, 0.42, 1.02, -0.3); c.cyl(0.03, 0.12, std({ color: 0x4caf50, roughness: 0.5 }), 0.62, 1.0, -0.2, 10);
    c.solid(-0.7, 0.7, -0.3, 0.3, 0, 1);
    var CM = new THREE.MeshPhysicalMaterial({ color: 0x1c1e22, roughness: 0.3, metalness: 0.4, clearcoat: 0.8 });
    var cm = new THREE.Mesh(bevelGeo(0.42, 0.42, 0.36, 0.03), CM); cm.position.set(-0.35, 1.15, -0.06); cm.castShadow = true; c.group.add(cm); c.box(0.44, 0.03, 0.38, MAT.chrome, -0.35, 1.37, -0.06); c.cyl(0.09, 0.16, MAT.glass, -0.35, 1.47, -0.12, 14); c.cyl(0.07, 0.12, std({ color: 0x4a2c1a, roughness: 1 }), -0.35, 1.45, -0.12, 12);
    c.box(0.3, 0.025, 0.16, MAT.chrome, -0.35, 0.955, 0.16); for (var dr = 0; dr < 6; dr++) c.box(0.26, 0.005, 0.01, MAT.black, -0.35, 0.97, 0.1 + dr * 0.024); c.cyl(0.03, 0.06, MAT.chrome, -0.35, 1.0, 0.1, 12); c.cyl(0.02, 0.12, MAT.chrome, -0.35, 0.97, 0.16, 8).rotation.x = Math.PI / 2; c.cyl(0.012, 0.07, MAT.black, -0.35, 0.97, 0.23, 8).rotation.x = Math.PI / 2;
    c.cyl(0.035, 0.09, MAT.white, -0.35, 0.995, 0.16, 12); c.cyl(0.015, 0.2, MAT.chrome, -0.14, 1.0, 0.1, 8).rotation.x = 0.6; c.plane(0.14, 0.08, MAT.screen, -0.35, 1.26, 0.125, 0, 0); c.box(0.03, 0.03, 0.01, MAT.green, -0.42, 1.18, 0.125); c.box(0.03, 0.03, 0.01, MAT.red, -0.28, 1.18, 0.125); c.box(0.06, 0.012, 0.012, MAT.chrome, -0.35, 1.08, 0.125);
    c.cyl(0.035, 0.08, MAT.white, -0.55, 1.41, -0.1, 10); c.cyl(0.035, 0.08, MAT.white, -0.47, 1.41, -0.14, 10); c.cyl(0.035, 0.08, MAT.white, -0.22, 1.41, -0.14, 10);
    c.hit(0.5, 0.6, 0.5, -0.35, 1.19, -0.05, { prompt: function () { return S.events.power ? 'The coffee machine is off' : (buff.coffeeUntil > S.time && buff.coffeeDay === S.day ? 'Coffee is still working' : 'Have a coffee (walk faster for an hour)'); }, use: function () { drinkCoffee(); } });
    c.cyl(0.08, 0.2, MAT.chrome, 0.1, 1.04, -0.1, 12); c.cyl(0.02, 0.1, MAT.chrome, 0.17, 1.07, -0.04, 6).rotation.z = -0.8; c.cyl(0.045, 0.1, MAT.white, 0.25, 0.99, 0.12, 10); c.cyl(0.045, 0.1, MAT.red, 0.35, 0.99, 0.02, 10);
    c.box(0.5, 0.3, 0.38, MAT.black, 0.42, 1.09, -0.08); c.plane(0.3, 0.16, MAT.glass, 0.42, 1.11, 0.115, 0, 0); c.box(0.06, 0.1, 0.02, MAT.black, 0.62, 1.09, 0.12);
    var rg = new THREE.Group(); rg.position.set(-0.05, 1.02, 0.1); c.add(rg); dress.radio = rg; rg.userData.worldOf = c.group;
    box(0.36, 0.16, 0.14, MAT.plastic, 0, 0, 0, rg); plane(0.12, 0.1, MAT.rubberMat, -0.09, 0.0, 0.071, 0, 0, rg); plane(0.12, 0.04, glowMat(0xf5b53d, 0.3), 0.09, 0.02, 0.071, 0, 0, rg); cyl(0.005, 0.35, MAT.chrome, 0.15, 0.22, 0, rg, 4).rotation.z = -0.3;
    c.hit(0.4, 0.2, 0.2, -0.05, 1.02, 0.1, { prompt: function () { return radioPrompt(); }, use: function () { radioUse(); } });
  }
  function vendingBuild(c) {
    var BODY = new THREE.MeshPhysicalMaterial({ color: 0x1f4e8c, roughness: 0.35, metalness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    var body = new THREE.Mesh(bevelGeo(0.96, 1.9, 0.8, 0.03), BODY); body.position.set(0, 0.97, 0); body.castShadow = true; c.group.add(body); c.box(0.98, 0.08, 0.82, MAT.black, 0, 0.04, 0); [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(function (f) { c.cyl(0.03, 0.03, MAT.black, f[0], 0.015, f[1], 8); });
    c.box(0.66, 1.2, 0.3, MAT.black, -0.1, 1.17, 0.26); c.plane(0.6, 1.1, glowMat(0x9ad0ff, 0.35), -0.1, 1.15, 0.405, 0, 0);
    for (var vr = 0; vr < 4; vr++) { c.box(0.6, 0.012, 0.28, MAT.chrome, -0.1, 0.7 + vr * 0.25, 0.27); for (var vc = 0; vc < 4; vc++) { var pm = std({ color: [0xd14a3a, 0x5fd38d, 0xf0b94d, 0x3fa7d6, 0xf2f2f2][(vr + vc) % 5], roughness: 0.5 }); c.box(0.09, 0.14, 0.08, pm, -0.33 + vc * 0.15, 0.78 + vr * 0.25, 0.3); c.cyl(0.015, 0.26, MAT.chrome, -0.26 + vc * 0.15, 0.72 + vr * 0.25, 0.3, 6).rotation.x = Math.PI / 2; } }
    var gf = c.box(0.64, 1.16, 0.01, MAT.glass, -0.1, 1.15, 0.415); gf.userData.noBake = true; c.box(0.6, 0.02, 0.3, glowMat(0xdfe9ff, 0.5), -0.1, 1.73, 0.26);
    c.box(0.22, 0.5, 0.02, MAT.black, 0.33, 1.3, 0.405); c.plane(0.16, 0.08, MAT.screen, 0.33, 1.48, 0.416, 0, 0); c.box(0.04, 0.06, 0.012, MAT.chrome, 0.33, 1.36, 0.414); c.box(0.03, 0.01, 0.012, MAT.black, 0.33, 1.36, 0.42);
    for (var kp = 0; kp < 12; kp++) c.box(0.035, 0.035, 0.01, MAT.white, 0.26 + (kp % 3) * 0.05, 1.26 - Math.floor(kp / 3) * 0.045, 0.416);
    c.box(0.56, 0.22, 0.04, MAT.black, -0.1, 0.33, 0.405); c.box(0.5, 0.16, 0.02, std({ color: 0x3a3e45, roughness: 0.4, metalness: 0.4 }), -0.1, 0.33, 0.425); c.box(0.44, 0.03, 0.02, MAT.chrome, -0.1, 0.44, 0.432);
    c.sign(['SNACKS'], 0.7, 0.2, -0.1, 1.82, 0.405, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' }); c.sign(['COLD DRINKS · CRISPS · BARS'], 0.76, 0.1, 0, 1.96, 0.405, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#eef1f5' }); c.plane(0.7, 1.4, std({ color: 0x163b6b, roughness: 0.5 }), 0.485, 1.0, 0, 0, Math.PI / 2);
    c.solid(-0.5, 0.5, -0.4, 0.4, 0, 2);
    dress.vending = c.hit(1.0, 1.9, 0.9, 0, 0.95, 0, { prompt: function () { return S.events.power ? 'The vending machine is dark' : 'Buy a snack ($3): walk faster for half an hour'; }, use: function () { buySnack(); } });
  }  function fridgeBuild(c) {
    var FW = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f0, roughness: 0.3, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2 }); var body = new THREE.Mesh(bevelGeo(0.7, 1.72, 0.68, 0.03), FW); body.position.set(0, 0.96, -0.02); body.castShadow = true; c.group.add(body);
    var dl = new THREE.Mesh(bevelGeo(0.66, 0.52, 0.03, 0.012), FW); dl.position.set(0, 1.56, 0.335); c.group.add(dl); var dl2 = new THREE.Mesh(bevelGeo(0.66, 1.1, 0.03, 0.012), FW); dl2.position.set(0, 0.72, 0.335); c.group.add(dl2); c.box(0.66, 0.01, 0.02, MAT.black, 0, 1.29, 0.345);
    c.box(0.025, 0.4, 0.03, MAT.chrome, -0.28, 1.56, 0.37); c.box(0.025, 0.8, 0.03, MAT.chrome, -0.28, 0.75, 0.37); c.box(0.7, 0.1, 0.02, MAT.black, 0, 0.05, 0.34); for (var gv = 0; gv < 6; gv++) c.box(0.08, 0.06, 0.01, MAT.plastic, -0.25 + gv * 0.1, 0.05, 0.345);
    c.box(0.12, 0.14, 0.004, MAT.paper, 0.15, 1.0, 0.355); c.cyl(0.015, 0.008, MAT.red, 0.15, 1.085, 0.357, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.004, std({ color: 0x3b7dd8, roughness: 0.6 }), -0.1, 0.9, 0.355); c.box(0.3, 0.05, 0.004, std({ color: 0x9aa4ad, roughness: 0.5, metalness: 0.5 }), 0, 1.75, 0.355);
    c.solid(-0.37, 0.37, -0.37, 0.37, 0, 2);
  }
  function coolerBuild(c) {
    var CW = std({ color: 0xe9ecef, roughness: 0.45 }); var cab = new THREE.Mesh(bevelGeo(0.38, 0.98, 0.38, 0.02), CW); cab.position.set(0, 0.49, 0); cab.castShadow = true; c.group.add(cab); c.box(0.4, 0.06, 0.4, std({ color: 0x5b6672, roughness: 0.6 }), 0, 1.01, 0); c.box(0.3, 0.02, 0.02, MAT.black, 0, 0.78, 0.19); c.box(0.26, 0.03, 0.12, MAT.plastic, 0, 0.72, 0.14); for (var dr = 0; dr < 5; dr++) c.box(0.24, 0.004, 0.012, MAT.black, 0, 0.74, 0.09 + dr * 0.022);
    c.box(0.03, 0.04, 0.03, MAT.blue, -0.06, 0.84, 0.2); c.box(0.03, 0.04, 0.03, MAT.red, 0.06, 0.84, 0.2); c.cyl(0.006, 0.03, MAT.black, -0.06, 0.835, 0.22, 6); c.cyl(0.006, 0.03, MAT.black, 0.06, 0.835, 0.22, 6);
    var WB = std({ color: 0xbfe3f2, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 }), WT = std({ color: 0x7fc4e8, roughness: 0.1, transparent: true, opacity: 0.6 }); c.cyl(0.13, 0.44, WB, 0, 1.28, 0, 16); c.cyl(0.124, 0.26, WT, 0, 1.19, 0, 16); c.cyl(0.08, 0.06, WB, 0, 1.53, 0, 14, 0.13); c.cyl(0.05, 0.04, MAT.blue, 0, 1.58, 0, 12); c.sphere(0.02, std({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.6 }), 0.04, 1.26, 0.03);
    c.box(0.08, 0.24, 0.08, CW, 0.23, 0.9, 0); c.cyl(0.03, 0.08, MAT.white, 0.23, 1.06, 0, 10); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 1.6);
  }
  function hooksBuild(c) { c.box(1.9, 0.04, 0.12, MAT.wood, 0, 1.82, 0); for (var hk = 0; hk < 4; hk++) { var hx = -0.68 + hk * 0.45; c.cyl(0.015, 0.1, MAT.chrome, hx, 1.75, 0.05, 6).rotation.x = Math.PI / 2; if (hk !== 2) { c.box(0.36, 0.5, 0.06, hk === 1 ? MAT.hivisOrange : MAT.hivis, hx, 1.45, 0.06); c.box(0.1, 0.06, 0.07, MAT.hivis, hx, 1.72, 0.06); } } }
  function noticeBuild(c) { c.box(1.6, 1.0, 0.04, MAT.wood, 0, 1.9, 0); c.plane(1.5, 0.9, MAT.cork, 0, 1.9, 0.025, 0, 0); c.sign(['TRUCKS', 'IN 07:30 · 13:30', 'OUT 10:30-12 · 16-18'], 0.9, 0.5, -0.25, 2.05, 0.03, 0, { w: 512, h: 320, bg: '#f5f1e6', fg: '#1b232c', size: 56 }); [[0.45, 1.75, -0.1], [-0.1, 1.6, 0.15], [0.55, 1.65, 0.05]].forEach(function (n) { var nb = c.box(0.22, 0.28, 0.004, MAT.paper, n[0], n[1], 0.03); nb.rotation.z = n[2]; c.cyl(0.01, 0.01, MAT.red, n[0], n[1] + 0.12, 0.035, 8).rotation.x = Math.PI / 2; }); }
  function calendarBuild(c) { c.box(0.4, 0.5, 0.02, MAT.paper, 0, 2.6, 0); c.sign(['OCTOBER', '', '1  2  3  4  5  6  7', '8  9 10 11 12 13 14'], 0.36, 0.44, 0, 2.6, 0.012, 0, { w: 256, h: 320, bg: '#f3efe4', fg: '#1b232c', size: 34 }); }
  function clockBuild(r) { return function (c) { var g = new THREE.Group(); g.position.set(0, 2.7, 0.02); c.add(g); var face = cyl(r, 0.03, MAT.white, 0, 0, 0, g, 32); face.rotation.x = Math.PI / 2; var rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 32), MAT.steelDark); g.add(rim); for (var i = 0; i < 12; i++) { var t = box(i % 3 ? 0.015 : 0.03, i % 3 ? 0.04 : 0.07, 0.01, MAT.black, Math.sin(i / 12 * 6.283) * (r - 0.07), Math.cos(i / 12 * 6.283) * (r - 0.07), 0.02, g); t.rotation.z = -i / 12 * 6.283; } var hh = new THREE.Group(), mh = new THREE.Group(); hh.position.z = 0.025; mh.position.z = 0.03; g.add(hh); g.add(mh); box(0.035, r * 0.55, 0.01, MAT.black, 0, r * 0.22, 0, hh); box(0.025, r * 0.85, 0.01, MAT.black, 0, r * 0.37, 0, mh); cyl(0.03, 0.02, MAT.red, 0, 0, 0.035, g, 10).rotation.x = Math.PI / 2; g.userData.dynamic = true; dress.clocks.push({ h: hh, m: mh, group: c.group }); }; }
  // a framed poster: the print on a white mount, a sheet of glass over it that catches the lamps at an angle, a black frame round the lot
  function posterBuild(kind, w, h) { return function (c) { c.box(w + 0.05, h + 0.05, 0.012, MAT.white, 0, 2.0, 0.002).castShadow = false; c.poster(kind, w - 0.04, h - 0.04, 0, 2.0, 0.01, 0); var gl = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.05, h + 0.05), MAT.screenGlass); gl.position.set(0, 2.0, 0.016); gl.renderOrder = 2; c.add(gl); var fw = w + 0.08, fh = h + 0.08; c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 + fh / 2, 0.004); c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 - fh / 2, 0.004); c.box(0.03, fh, 0.03, MAT.black, -fw / 2, 2.0, 0.004); c.box(0.03, fh, 0.03, MAT.black, fw / 2, 2.0, 0.004); }; }
  function extinguisherBuild(c) { c.cyl(0.08, 0.5, MAT.red, 0, 1.0, 0.12, 12); c.cyl(0.05, 0.08, MAT.black, 0, 1.28, 0.12, 10); c.box(0.03, 0.12, 0.1, MAT.black, 0, 1.36, 0.14); c.cyl(0.012, 0.42, MAT.black, 0.08, 1.0, 0.15, 6).rotation.z = 0.15; c.cyl(0.02, 0.07, MAT.black, 0.11, 0.79, 0.17, 8, 0.03); c.cyl(0.025, 0.02, MAT.white, 0.0, 1.3, 0.21, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.002, MAT.paper, 0, 1.0, 0.202); c.box(0.2, 0.04, 0.1, MAT.steelDark, 0, 0.72, 0.05); c.sign(['FIRE'], 0.3, 0.12, 0, 1.6, 0.04, 0, { w: 128, h: 48, bg: '#c8342a', fg: '#fff' }); }
  function firstAidBuild(c) { c.box(0.3, 0.3, 0.1, MAT.white, 0, 1.7, 0.05); c.box(0.18, 0.05, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.05, 0.18, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.12, 0.02, 0.02, MAT.chrome, 0, 1.87, 0.05); }
  function binPrompt() { var bp = isJack(player.tool) ? jackPallet() : null; if (bp && bp.n > 0) return 'Write off the whole pallet (' + bp.n + ' × ' + skuName(bp.sku) + ', ' + money(Math.round(SKU[bp.sku].val * 0.5 * bp.n)) + ')'; if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'Bin the damaged box'; if (S.hand && S.hand.kind === 'box') return 'That box is fine: it belongs on a rack'; return 'The bin · ' + (S.binned || 0) + ' damaged boxes written off'; }
  function binUse() { var bp = isJack(player.tool) ? jackPallet() : null; if (bp && bp.n > 0) { var n = bp.n, bsku = bp.sku, bcost = Math.round(SKU[bsku].val * 0.5 * n); bp.n = 0; bp.wrapped = false; S.binned = (S.binned || 0) + n; addWaste(2 * n); pay(-bcost, 'Written off: ' + n + ' × ' + skuName(bsku)); addRep(-0.5 * Math.min(n, 4)); sfx('crate'); toast('Pallet written off: ' + n + ' boxes, ' + money(bcost) + '. The pallet is empty again.', 'bad'); logEvent(n + ' boxes of ' + skuName(bsku) + ' went in the bin off a pallet (' + money(bcost) + ')', 'bad'); hudDirty = true; return; }
    if (!(S.hand && S.hand.kind === 'box' && S.hand.damaged)) { sfx('click'); return; } var sku = S.hand.sku; handSet(null); S.binned = (S.binned || 0) + 1; addWaste(2); var cost = Math.round(SKU[sku].val * 0.5); pay(-cost, 'Written off: a damaged box of ' + skuName(sku)); addRep(-0.5); sfx('crate'); toast('Binned. The client charges ' + money(cost) + ' for it.', 'bad'); logEvent('A damaged box of ' + skuName(sku) + ' went in the bin (' + money(cost) + ')', 'bad'); }
  function binBuild(c) { var bin = c.cyl(0.3, 0.85, MAT.red, 0, 0.47, 0, 4, 0.25); bin.rotation.y = Math.PI / 4; var lid = c.box(0.56, 0.05, 0.56, std({ color: 0x8e2420, roughness: 0.7 }), 0, 0.92, 0); lid.rotation.y = Math.PI / 4; c.box(0.08, 0.03, 0.5, MAT.black, 0.22, 0.95, 0); c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, -0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, 0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.015, 0.5, MAT.steelDark, -0.2, 0.09, 0, 6).rotation.x = Math.PI / 2; c.solid(-0.3, 0.3, -0.3, 0.3, 0, 1); c.hit(0.7, 0.9, 0.7, 0, 0.45, 0, { prompt: function () { return binPrompt(); }, use: function () { binUse(); } }); c.sign(['DAMAGED', 'GOODS'], 0.5, 0.3, 0, 1.1, 0.0, 0, { w: 256, h: 128, bg: '#c8342a', fg: '#fff' }); }
  function broomBuild(c) { var broom = c.cyl(0.014, 1.3, MAT.wood, 0.02, 0.72, 0, 6); broom.rotation.z = 0.22; c.box(0.3, 0.06, 0.06, MAT.plastic, 0.18, 0.1, 0); c.box(0.3, 0.06, 0.05, std({ color: 0x8a7a55, roughness: 1 }), 0.18, 0.04, 0); c.cyl(0.02, 0.04, MAT.red, -0.13, 1.36, 0, 8); }
  function wetFloorBuild(c) { var face = new THREE.MeshBasicMaterial({ map: textTex(['CAUTION', 'WET FLOOR'], { w: 192, h: 256, bg: '#f5b53d', fg: '#111', size: 34 }) }); [-1, 1].forEach(function (s) { var pg = new THREE.Group(); pg.position.set(0, 0.72, 0); pg.rotation.x = s * 0.32; c.add(pg); box(0.34, 0.72, 0.012, MAT.yellow, 0, -0.36, s * 0.006, pg); var f = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.6), face); f.position.set(0, -0.38, s * 0.014); f.rotation.y = s > 0 ? 0 : Math.PI; pg.add(f); box(0.02, 0.72, 0.02, MAT.black, -0.17, -0.36, s * 0.01, pg); box(0.02, 0.72, 0.02, MAT.black, 0.17, -0.36, s * 0.01, pg); box(0.34, 0.03, 0.02, MAT.black, 0, -0.72, s * 0.012, pg); }); c.cyl(0.012, 0.36, MAT.black, 0, 0.72, 0, 8).rotation.z = Math.PI / 2; c.box(0.1, 0.03, 0.02, MAT.black, 0, 0.75, 0); }
  // a real wooden pallet: three bearers, seven top boards with gaps, three bottom boards
  function palletModel(c, x, y, z, ry) { var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; c.add(g); [-0.5, 0, 0.5].forEach(function (bz) { box(1.2, 0.08, 0.1, MAT.wood, 0, 0.065, bz, g); box(1.2, 0.022, 0.1, MAT.wood, 0, 0.011, bz, g); }); for (var i = 0; i < 7; i++) box(i === 0 || i === 6 ? 0.14 : 0.1, 0.022, 1.0, MAT.wood, -0.53 + i * 0.1766, 0.116, 0, g); return g; }
  function emptiesBuild(c) {
    for (var i = 0; i < 9; i++) palletModel(c, randf(-0.015, 0.015), i * 0.128, randf(-0.015, 0.015), randf(-0.02, 0.02));
    var mk = std({ color: 0xf0b400, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }); c.plane(1.5, 0.05, mk, 0, 0.004, 0.7, -Math.PI / 2, 0); c.plane(1.5, 0.05, mk, 0, 0.004, -0.7, -Math.PI / 2, 0); c.plane(0.05, 1.45, mk, 0.75, 0.004, 0, -Math.PI / 2, 0); c.plane(0.05, 1.45, mk, -0.75, 0.004, 0, -Math.PI / 2, 0);
    c.cyl(0.02, 1.5, MAT.steel, 1.05, 0.75, 0.75, 8); c.cyl(0.14, 0.04, MAT.steel, 1.05, 0.02, 0.75, 14); c.sign(['EMPTY', 'PALLETS'], 0.5, 0.3, 1.05, 1.5, 0.75, 0, { w: 256, h: 150, bg: '#1b232c', fg: '#f0b400' }); c.sign(['EMPTY', 'PALLETS'], 0.5, 0.3, 1.05, 1.5, 0.75, Math.PI, { w: 256, h: 150, bg: '#1b232c', fg: '#f0b400' });
    c.hit(1.4, 1.6, 1.3, 0, 0.8, 0, { prompt: function () { var jp = isJack(player.tool) ? jackPallet() : null; if (jp && jp.n === 0) return 'Stack the empty pallet here (' + (S.emptiesN || 0) + ' stacked)'; if (isJack(player.tool) && !jp) return (S.emptiesN || 0) > 0 ? 'Take an empty pallet onto the jack (' + S.emptiesN + ' stacked)' : 'No empty pallets left on the stack'; return 'Empty pallets · ' + (S.emptiesN || 0) + ' stacked · bring empties here on the jack, or take one for loose boxes'; },
      use: function () { if (!isJack(player.tool)) { sfx('click'); return; } var tl = jackTool(), jp = jackPallet(); if (jp && jp.n === 0) { removePallet(jp.id); S[tl].pallet = null; S.emptiesN = (S.emptiesN || 0) + 1; sfx('putdown'); addXp(1); toast('Empty pallet stacked', ''); hudDirty = true; return; } if (!jp && (S.emptiesN || 0) > 0) { var np = newPallet(null, 0, { place: 'jack', jack: tl }); S[tl].pallet = np.id; S.emptiesN--; sfx('jack'); toast('Empty pallet on the jack: put loose boxes on it by hand', ''); hudDirty = true; return; } sfx('bad'); } });
    c.solid(-0.62, 0.62, -0.52, 0.52, 0, 1.2); c.solid(0.9, 1.2, 0.6, 0.9, 0, 1.7);
  }
  // a vertical baler: a tall steel cabinet, the loading door with its window at chest height, the bale door below with a
  // handle and hinges, the ram cylinder on top, a control box on the side, hazard stripes, and a strapped bale beside it
  function balerBuild(c) {
    var GRN = std({ color: 0x2f7a3a, roughness: 0.55, metalness: 0.3 }), DRK = MAT_MACH.frame, dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
    // the body: a vertical baler with a chamber door, a window, the ram head above, the power pack at the side
    c.box(1.3, 0.1, 1.0, DRK, 0, 0.05, 0); c.box(1.2, 2.6, 0.9, GRN, 0, 1.4, 0); c.box(1.3, 0.08, 1.0, DRK, 0, 2.74, 0);
    [-0.62, 0.62].forEach(function (x) { c.box(0.06, 2.7, 0.06, DRK, x, 1.4, 0.45); c.box(0.06, 2.7, 0.06, DRK, x, 1.4, -0.45); });
    c.box(1.2, 0.06, 0.06, DRK, 0, 1.6, 0.47); c.box(1.2, 0.06, 0.06, DRK, 0, 0.75, 0.47);
    var door = c.box(1.04, 0.78, 0.06, GRN, 0, 2.06, 0.47); var win = c.box(0.5, 0.3, 0.02, MAT.glass, 0, 2.12, 0.51); win.userData.noBake = true; c.box(0.1, 0.34, 0.05, MAT.chrome, 0.44, 2.06, 0.52); c.box(0.03, 0.1, 0.07, DRK, -0.5, 1.8, 0.5); c.box(0.03, 0.1, 0.07, DRK, -0.5, 2.3, 0.5);
    c.box(1.04, 0.78, 0.06, GRN, 0, 1.16, 0.47); c.box(0.5, 0.05, 0.07, MAT.chrome, 0.2, 1.4, 0.52); c.box(0.03, 0.1, 0.07, DRK, -0.5, 0.92, 0.5); c.box(0.03, 0.1, 0.07, DRK, -0.5, 1.4, 0.5); c.box(0.4, 0.04, 0.03, MAT.black, 0, 1.05, 0.51);
    c.box(1.1, 0.1, 0.05, MAT.hazard, 0, 1.6, 0.5); c.sign(['CRUSH HAZARD · KEEP HANDS CLEAR'], 0.9, 0.09, 0, 0.68, 0.5, 0, { w: 512, h: 48, bg: '#f5b53d', fg: '#1a1205' });
    c.cyl(0.18, 0.9, MAT.chrome, 0, 3.2, 0, 16); c.cyl(0.26, 0.3, DRK, 0, 2.9, 0, 16); var ram = cyl(0.12, 0.6, MAT.chrome, 0, 3.6, 0, dyn, 12); c.box(0.5, 0.06, 0.5, DRK, 0, 3.68, 0);
    c.box(0.5, 0.9, 0.5, DRK, -0.95, 0.5, -0.1); var pm = c.cyl(0.18, 0.5, MAT_MACH.blue, -0.95, 1.2, -0.1, 14); c.cyl(0.14, 0.4, DRK, -0.95, 1.5, -0.1, 12); [[-0.95, 2.6, 0.1, 0.5], [-0.8, 2.0, 0.3, -0.3]].forEach(function (h) { var hs = c.cyl(0.025, 1.4, MAT.black, h[0], h[1], h[2], 6); hs.rotation.x = h[3]; });
    c.cyl(0.05, 0.03, MAT.white, -0.72, 0.8, 0.16, 10).rotation.x = Math.PI / 2;
    // the control cabinet on the right: screen, lamp stack, E-stop
    cabinet(c, 0.88, 1.45, 0.05, 0.4, 0.9, 0.22); var scr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.88, y: 1.62, z: 0.17, ry: 0, parent: c.group, title: 'Baler', draw: balerScreenDraw }); scr.mesh.userData.propId = 'baler';
    eStop(c, 0.88, 1.2, 0.17); MACH.baler.lamps = lampStack(c, 0.88, 1.95, 0.05);
    c.sign(['BALER', 'cardboard only'], 0.8, 0.3, 0, 2.5, 0.5, 0, { w: 256, h: 96, bg: '#1b232c', fg: '#5fd38d', size: 34 });
    // the finished bales stack beside it: strapped cardboard blocks, shown by count
    var bales = []; for (var k = 0; k < 3; k++) { var bg = new THREE.Group(); bg.position.set(1.75, 0.4 + (k === 2 ? 0.82 : 0), k === 1 ? 0.95 : 0.05); bg.visible = false; dyn.add(bg); box(1.0, 0.8, 0.8, MAT.parcel, 0, 0, 0, bg); for (var s = 0; s < 3; s++) { box(1.02, 0.02, 0.03, MAT.steelDark, 0, 0.405, -0.3 + s * 0.3, bg); box(1.02, 0.02, 0.03, MAT.steelDark, 0, -0.405, -0.3 + s * 0.3, bg); box(0.03, 0.82, 0.03, MAT.steelDark, 0.505, 0, -0.3 + s * 0.3, bg); box(0.03, 0.82, 0.03, MAT.steelDark, -0.505, 0, -0.3 + s * 0.3, bg); } bales.push(bg); }
    MACH.baler.anim = { ram: ram, bales: bales };
    c.hit(1.4, 2.8, 1.0, 0, 1.4, 0, { prompt: function () { return balerPrompt(); }, use: function () { balerUse(); } });
    c.solid(-1.25, 0.7, -0.5, 0.55, 0, 2.8); c.solid(1.2, 2.3, -0.4, 1.4, 0, 1.0);
  }
  function wrapperBuild(c, P, inst) {
    var wg = c.group; wg.userData.dynamic = true; dress.wrapper = wg;
    var tt = c.cyl(0.95, 0.1, MAT.steelDark, 0, 0.05, 0, 32); dress.turntable = tt; plane(1.7, 1.7, MAT.rubberMat, 0, 0.101, 0, -Math.PI / 2, 0, tt); for (var tk = 0; tk < 8; tk++) box(0.04, 0.02, 0.5, MAT.yellow, Math.sin(tk / 8 * 6.283) * 0.7, 0.105, Math.cos(tk / 8 * 6.283) * 0.7, tt).rotation.y = tk / 8 * 6.283;
    var rp = c.box(1.2, 0.1, 0.9, MAT.steelDark, 0, 0.03, 1.35); rp.rotation.x = 0.11; c.box(0.35, 2.7, 0.35, MAT.blue, 0, 1.35, -1.15); c.box(0.45, 0.12, 0.45, MAT.steelDark, 0, 0.06, -1.15); c.box(0.1, 2.5, 0.05, MAT.chrome, -0.1, 1.4, -0.95); c.box(0.1, 2.5, 0.05, MAT.chrome, 0.1, 1.4, -0.95);
    var carr = new THREE.Group(); carr.position.set(0, 1.0, -0.8); wg.add(carr); dress.wrapCarriage = carr; box(0.5, 0.4, 0.3, MAT.steelDark, 0, 0, 0, carr); cyl(0.14, 0.52, MAT.white, 0.35, 0, 0.1, carr, 14); cyl(0.02, 0.6, MAT.chrome, 0.35, 0, 0.1, carr, 6); cyl(0.05, 0.3, MAT.rubber, -0.3, 0, 0.1, carr, 8);
    cabinet(c, 0.75, 1.45, -1.15, 0.4, 0.9, 0.22); var wscr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.75, y: 1.62, z: -1.03, ry: 0, parent: c.group, title: 'Stretch wrapper', draw: wrapperScreenDraw }); wscr.mesh.userData.propId = 'wrapper'; eStop(c, 0.75, 1.2, -1.03); MACH.wrapper.lamps = lampStack(c, 0.75, 1.95, -1.15); c.cyl(0.02, 0.5, MAT.black, 0.55, 1.1, -1.15, 6);
    c.sign(['STRETCH WRAP'], 1.2, 0.25, 0, 2.5, -0.9, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#78bdf5' }); c.solid(-1, 1, -1.4, 1.0, 0, 3);
    c.hit(1.0, 2.4, 0.8, 0, 1.2, -1.05, { prompt: function () { return wrapperPrompt(); }, use: function () { wrapperUse(); } });
  }
  function hoseBuild(c) { var reel = c.cyl(0.32, 0.12, MAT.red, 0, 1.5, 0.08, 24); reel.rotation.x = Math.PI / 2; c.cyl(0.05, 0.3, MAT.steelDark, 0, 1.5, 0.0, 8).rotation.x = Math.PI / 2; for (var hr = 0; hr < 5; hr++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(0.12 + hr * 0.035, 0.012, 6, 24), MAT.red); ring.position.set(0, 1.5, 0.16); c.add(ring); } c.cyl(0.015, 0.25, MAT.red, 0.3, 1.25, 0.08, 6).rotation.z = 0.4; c.cyl(0.03, 0.08, MAT.chrome, 0.38, 1.12, 0.08, 8, 0.018); c.sign(['HOSE REEL'], 0.7, 0.16, 0, 2.0, 0.01, 0, { w: 256, h: 64, bg: '#c8342a', fg: '#fff' }); }
  var leafTex = tex(64, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#2f6a2a'); g.addColorStop(1, '#8ad474'); c.fillStyle = g; c.beginPath(); c.moveTo(32, 128); c.quadraticCurveTo(0, 70, 32, 4); c.quadraticCurveTo(64, 70, 32, 128); c.fill(); c.strokeStyle = 'rgba(220,255,200,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(32, 124); c.lineTo(32, 10); c.stroke(); });
  var leafMat = std({ map: leafTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  function plantBuild(c) {
    var pot = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.11, 0), new THREE.Vector2(0.14, 0.02), new THREE.Vector2(0.17, 0.28), new THREE.Vector2(0.19, 0.3), new THREE.Vector2(0.17, 0.32), new THREE.Vector2(0.15, 0.3)], 16), std({ color: 0xa65e3a, roughness: 0.9 })); pot.castShadow = true; c.group.add(pot);
    c.cyl(0.15, 0.02, std({ color: 0x3a2a1c, roughness: 1 }), 0, 0.29, 0, 14);
    for (var i = 0; i < 11; i++) { var a = i / 11 * 6.283, lg = new THREE.Group(); lg.position.set(0, 0.3, 0); lg.rotation.y = a; c.group.add(lg); var st = cyl(0.006, 0.35 + (i % 3) * 0.12, MAT.green, 0, 0.17 + (i % 3) * 0.06, 0.03, lg, 5); st.rotation.x = 0.5 + (i % 2) * 0.2; var lf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.34), leafMat); lf.position.set(0, 0.42 + (i % 3) * 0.12, 0.2 + (i % 2) * 0.08); lf.rotation.x = -0.9 + (i % 3) * 0.2; lg.add(lf); }
    c.solid(-0.18, 0.18, -0.18, 0.18, 0, 0.5);
  }
  function deskBuild(c) {
    var top = new THREE.Mesh(bevelGeo(2.2, 0.05, 0.8, 0.015), std({ color: 0xd7cbb0, roughness: 0.5, map: TEX.wood, normalMap: NRM.wood })); top.position.set(0, 0.75, 0); top.castShadow = true; top.receiveShadow = true; c.group.add(top);
    c.box(2.1, 0.5, 0.03, std({ color: 0x9aa4ad, roughness: 0.6 }), 0, 0.45, -0.36); [[-1.0, 0.0], [1.0, 0.0]].forEach(function (o) { c.box(0.05, 0.72, 0.7, MAT_MACH.frame, o[0] * 1.05, 0.36, 0); }); c.cyl(0.03, 0.02, MAT.black, 0.6, 0.76, -0.3, 10);
    var ped = new THREE.Mesh(bevelGeo(0.45, 0.66, 0.6, 0.02), std({ color: 0xcfd4d9, roughness: 0.5 })); ped.position.set(-0.75, 0.37, 0); c.group.add(ped); for (var dw = 0; dw < 3; dw++) { c.box(0.4, 0.19, 0.012, std({ color: 0xbfc6cc, roughness: 0.5 }), -0.75, 0.15 + dw * 0.21, 0.31); c.box(0.12, 0.02, 0.025, MAT.chrome, -0.75, 0.22 + dw * 0.21, 0.32); }
    c.cyl(0.14, 0.02, MAT_MACH.frame, 0, 0.785, 0.2, 14); c.cyl(0.025, 0.3, MAT_MACH.frame, 0, 0.93, 0.22, 8); var bez = new THREE.Mesh(bevelGeo(0.82, 0.52, 0.03, 0.01), MAT.black); bez.position.set(0, 1.25, 0.25); c.group.add(bez);
    pc.screen = touchScreen({ w: 800, h: 500, pw: 0.74, ph: 0.46, x: 0, y: 1.25, z: 0.225, ry: Math.PI, parent: c.group, title: 'Office PC', draw: drawPc });
    c.box(0.62, 0.012, 0.42, std({ color: 0x1f2a36, roughness: 1 }), -0.1, 0.785, -0.15); for (var kr = 0; kr < 4; kr++) for (var kc = 0; kc < 12; kc++) c.box(0.032, 0.012, 0.03, std({ color: 0x4a515b, roughness: 0.6 }), -0.34 + kc * 0.044, 0.82, -0.26 + kr * 0.05);
    var mouse = new THREE.Mesh(bevelGeo(0.06, 0.03, 0.1, 0.012), MAT.black); mouse.position.set(0.5, 0.8, -0.18); c.group.add(mouse); c.box(0.2, 0.06, 0.16, MAT.black, -0.75, 0.81, 0.26); c.cyl(0.012, 0.18, MAT.black, -0.75, 0.9, 0.26, 6).rotation.z = Math.PI / 2;
    c.cyl(0.03, 0.09, MAT.black, 0.9, 0.82, -0.05, 8); c.cyl(0.004, 0.14, MAT.blue, 0.9, 0.9, -0.05, 4).rotation.z = 0.2; c.cyl(0.04, 0.09, MAT.white, 0.7, 0.82, -0.1, 10); c.box(0.2, 0.01, 0.28, MAT.paper, -0.75, 0.785, -0.1); c.box(0.18, 0.012, 0.26, MAT.paper, -0.72, 0.795, -0.08).rotation.y = 0.1;
    c.cyl(0.02, 0.4, MAT_MACH.frame, 0.95, 0.98, 0.25, 8).rotation.z = -0.3; c.cyl(0.07, 0.1, MAT_MACH.frame, 0.84, 1.17, 0.25, 12, 0.03); c.cyl(0.05, 0.02, glowMat(0xfff2c0, 0.6), 0.84, 1.12, 0.25, 12);
    var dl = new THREE.PointLight(0xfff2c0, 0.3, 3.5, 2); dl.position.set(0.84, 1.05, 0.25); c.add(dl);   // the desk lamp's pool on the desk
    c.sign(['DEPOT CO. · OFFICE'], 0.5, 0.06, -0.75, 0.56, 0.32, 0, { w: 512, h: 64, bg: '#eef1f5', fg: '#1b232c' });
    c.hit(1.2, 0.9, 0.5, 0, 0.5, -0.1, { prompt: function () { return pc.on ? null : (S.events.power ? 'The PC is off: no power' : 'Sit down at the PC'); }, use: function () { openPc(); } });
    c.solid(-1.1, 1.1, -0.4, 0.4, 0, 0.8);
  }  function officeChairBuild(c) {
    var seat = new THREE.Mesh(bevelGeo(0.5, 0.08, 0.5, 0.04), MAT.fabric); seat.position.set(0, 0.52, 0); seat.castShadow = true; c.group.add(seat);
    var back = new THREE.Mesh(bevelGeo(0.48, 0.52, 0.06, 0.03), MAT.fabric); back.position.set(0, 0.84, -0.26); back.rotation.x = -0.1; c.group.add(back); c.box(0.4, 0.4, 0.01, std({ color: 0x1f2630, roughness: 0.9 }), 0, 0.86, -0.22).rotation.x = -0.1; c.box(0.3, 0.14, 0.04, MAT.fabric, 0, 1.18, -0.3);
    c.cyl(0.03, 0.3, MAT.chrome, 0, 0.33, 0, 10); c.cyl(0.045, 0.2, MAT.black, 0, 0.18, 0, 10); c.box(0.3, 0.03, 0.3, MAT.black, 0, 0.47, 0); c.box(0.06, 0.03, 0.08, MAT.black, 0.18, 0.44, 0.1);
    for (var sp = 0; sp < 5; sp++) { var a = sp / 5 * 6.283, leg = c.box(0.05, 0.035, 0.3, MAT.black, Math.sin(a) * 0.15, 0.05, Math.cos(a) * 0.15); leg.rotation.y = a; var cs = c.cyl(0.03, 0.025, MAT.black, Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3, 8); cs.rotation.x = Math.PI / 2; cs.rotation.z = a; }
    [-0.28, 0.28].forEach(function (x) { c.box(0.04, 0.18, 0.04, MAT.black, x, 0.6, -0.05); c.box(0.06, 0.03, 0.3, MAT.black, x, 0.7, 0); });
    c.solid(-0.3, 0.3, -0.3, 0.3, 0, 0.6);
  }  function cabinetsBuild(c) {
    var CAB = std({ color: 0xcfd4d9, roughness: 0.5 }), DRW = std({ color: 0xbfc6cc, roughness: 0.5 });
    [-0.3, 0.3].forEach(function (cx2) { var body = new THREE.Mesh(bevelGeo(0.5, 1.3, 0.6, 0.02), CAB); body.position.set(cx2, 0.65, 0); body.castShadow = true; c.group.add(body); c.box(0.5, 0.06, 0.6, MAT.black, cx2, 0.03, 0); for (var cd = 0; cd < 3; cd++) { var d = new THREE.Mesh(bevelGeo(0.44, 0.36, 0.02, 0.01), DRW); d.position.set(cx2, 0.28 + cd * 0.4, 0.31); c.group.add(d); c.box(0.14, 0.025, 0.03, MAT.chrome, cx2, 0.4 + cd * 0.4, 0.33); c.box(0.16, 0.05, 0.004, MAT.paper, cx2, 0.2 + cd * 0.4, 0.323); c.box(0.17, 0.06, 0.002, MAT.chrome, cx2, 0.2 + cd * 0.4, 0.322); } c.box(0.02, 0.1, 0.02, MAT.chrome, cx2 + 0.2, 1.22, 0.31); });
    c.box(0.5, 0.25, 0.4, CAB, 0.3, 1.42, 0); c.box(0.4, 0.03, 0.3, MAT.white, 0.3, 1.56, 0.05); c.box(0.3, 0.02, 0.2, MAT.paper, 0.3, 1.58, 0.05); c.cyl(0.08, 0.1, std({ color: 0x4a7d33, roughness: 0.9 }), -0.3, 1.36, 0, 10, 0.06); c.sphere(0.12, std({ color: 0x5c8f44, roughness: 1, flatShading: true }), -0.3, 1.5, 0);
    c.solid(-0.6, 0.6, -0.35, 0.35, 0, 1.6);
  }  function coatStandBuild(c) {
    c.cyl(0.028, 1.75, MAT.steelDark, 0, 0.875, 0, 10); c.cyl(0.22, 0.03, MAT.steelDark, 0, 0.015, 0, 16); c.sphere(0.03, MAT.chrome, 0, 1.76, 0);
    for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2, hk = new THREE.Group(); hk.position.set(0, 1.62, 0); hk.rotation.y = a; c.add(hk); var arm = cyl(0.01, 0.2, MAT.chrome, 0, 0.04, 0.1, hk, 6); arm.rotation.x = Math.PI / 2 - 0.4; sphere(0.018, MAT.chrome, 0, 0.1, 0.18, hk); var low = cyl(0.01, 0.18, MAT.chrome, 0, -0.5, 0.09, hk, 6); low.rotation.x = Math.PI / 2 - 0.5; sphere(0.016, MAT.chrome, 0, -0.45, 0.16, hk); }
    var coat = c.box(0.38, 0.7, 0.12, MAT.jeans, 0.18, 1.3, 0.02); coat.rotation.y = 0.5; c.box(0.2, 0.08, 0.1, MAT.jeans, 0.3, 1.66, 0.12); var scarf = c.box(0.06, 0.5, 0.06, MAT.red, -0.1, 1.4, -0.16); scarf.rotation.y = -0.4;
    c.solid(-0.22, 0.22, -0.22, 0.22, 0, 1.8);
  }
  function kpiBuild(c) { var kb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), kpiBoard()); kb.position.set(0, 2.0, 0.03); c.add(kb); c.box(1.68, 1.08, 0.04, MAT.chrome, 0, 2.0, 0.0); }
  function certificateBuild(c) { c.box(0.3, 0.4, 0.02, MAT.wood, 0, 2.4, 0); c.sign(['CERTIFICATE', 'of registration', 'Depot Co. · 3PL'], 0.26, 0.36, 0, 2.4, 0.012, 0, { w: 192, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 22 }); }
  function benchBuild(c, P) {
    SPOT.bench = { x: P.x, z: P.z }; SPOT.benchOut = { x: P.x + Math.sin(P.rot * Math.PI / 2) * 2.0, z: P.z + Math.cos(P.rot * Math.PI / 2) * 2.0 };
    c.box(1.0, 0.08, 3.2, MAT.wood, 0, 0.9, 0); [[-0.45, -1.5], [0.45, -1.5], [-0.45, 1.5], [0.45, 1.5]].forEach(function (o) { c.box(0.06, 0.9, 0.06, MAT.steelDark, o[0], 0.45, o[1]); }); c.box(0.9, 0.04, 3.0, MAT.steelDark, 0, 0.3, 0); c.solid(-0.5, 0.5, -1.6, 1.6, 0, 1);
    // the kit lives at the two ends: the box stacks take local z -0.95 to 1.3, and anything under them was never seen
    var TAN = std({ color: 0xc9a46a, roughness: 0.8 }), CARD = std({ color: 0xb08a5a, roughness: 1 }), TRAY = std({ color: 0x3a4149, roughness: 0.6 });
    // near end: a platform scale with its readout turned to the worker
    c.box(0.3, 0.03, 0.3, MAT.steelDark, 0.28, 0.955, -1.2); c.box(0.26, 0.012, 0.26, std({ color: 0xcfd4d9, roughness: 0.4, metalness: 0.5 }), 0.28, 0.976, -1.2); c.box(0.04, 0.24, 0.04, MAT.steelDark, 0.42, 1.09, -1.2);
    var sgp = new THREE.Group(); sgp.position.set(0.4, 1.23, -1.2); sgp.rotation.order = 'YXZ'; sgp.rotation.y = -Math.PI / 2; sgp.rotation.x = -0.25; c.add(sgp); box(0.18, 0.09, 0.03, MAT.black, 0, 0, 0, sgp); sign(['0.00 kg'], 0.15, 0.06, 0, 0, 0.016, 0, { w: 192, h: 72, bg: '#0d1216', fg: '#5fd38d' }, sgp);
    // a tape gun standing on its head, two spare rolls beside it
    var tgn = new THREE.Group(); tgn.position.set(-0.2, 0.94, -1.12); tgn.rotation.y = 0.6; c.add(tgn); box(0.03, 0.11, 0.035, MAT.red, 0, 0.06, -0.05, tgn).rotation.x = 0.35; box(0.02, 0.09, 0.13, MAT.steelDark, 0.03, 0.1, 0.03, tgn); cyl(0.055, 0.05, TAN, 0.03, 0.1, 0.055, tgn, 16).rotation.z = Math.PI / 2; box(0.05, 0.02, 0.05, MAT.steelDark, 0.03, 0.01, 0.11, tgn); cyl(0.012, 0.05, MAT.rubber, 0.03, 0.012, 0.085, tgn, 8).rotation.z = Math.PI / 2;
    c.cyl(0.055, 0.048, TAN, 0.06, 0.964, -1.48, 16); c.cyl(0.055, 0.048, TAN, 0.08, 1.012, -1.47, 16).rotation.y = 0.4; c.cyl(0.03, 0.05, MAT.white, 0.06, 1.012, -1.48, 12);
    // a parts tray: box cutter, marker, a roll of labels
    c.box(0.26, 0.03, 0.18, TRAY, -0.3, 0.955, -1.45); c.box(0.23, 0.014, 0.15, MAT.black, -0.3, 0.972, -1.45); c.box(0.14, 0.02, 0.03, MAT.yellow, -0.33, 0.99, -1.48).rotation.y = 0.3; c.cyl(0.008, 0.14, MAT.black, -0.27, 0.988, -1.41, 8).rotation.z = Math.PI / 2; c.cyl(0.03, 0.04, MAT.white, -0.22, 1.0, -1.49, 12);
    // the label printer at the near corner, a strip of labels hanging out toward the worker
    c.box(0.2, 0.12, 0.16, MAT.white, 0.28, 1.0, -1.5); c.box(0.21, 0.02, 0.17, std({ color: 0x8b949c, roughness: 0.5 }), 0.28, 0.95, -1.5); c.box(0.004, 0.09, 0.07, MAT.paper, 0.17, 0.985, -1.5); c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.2, 1.05, -1.42);
    // far end: the task lamp and a roll of bubble wrap on a rod between two brackets
    c.cyl(0.02, 0.9, MAT.steelDark, -0.4, 1.4, 1.4, 8); c.box(0.3, 0.08, 0.15, MAT.lamp, -0.3, 1.85, 1.4);
    [-0.3, 0.3].forEach(function (bx) { c.box(0.03, 0.3, 0.03, MAT.steelDark, bx, 1.09, 1.5); c.box(0.08, 0.02, 0.08, MAT.steelDark, bx, 0.95, 1.5); }); c.cyl(0.012, 0.66, MAT.chrome, 0, 1.25, 1.5, 8).rotation.z = Math.PI / 2;
    c.cyl(0.11, 0.5, std({ color: 0xe6ecf2, roughness: 0.35, transparent: true, opacity: 0.85 }), 0, 1.25, 1.5, 18).rotation.z = Math.PI / 2; c.plane(0.48, 0.26, std({ color: 0xe6ecf2, roughness: 0.35, transparent: true, opacity: 0.7, side: THREE.DoubleSide }), 0, 1.07, 1.615, 0, 0);
    // the shelf below: flat cardboard and a bale of folded boxes
    c.box(0.7, 0.12, 0.8, CARD, 0, 0.38, -0.6); c.box(0.66, 0.02, 0.76, TAN, 0, 0.45, -0.6); c.box(0.6, 0.09, 0.7, CARD, 0.02, 0.365, 0.7).rotation.y = 0.05; c.box(0.02, 0.1, 0.72, MAT.black, -0.2, 0.37, 0.7); c.box(0.02, 0.1, 0.72, MAT.black, 0.2, 0.37, 0.7);
    var tl = new THREE.PointLight(0xfff0d0, 0.45, 5, 2); tl.position.set(-0.3, 1.7, 1.4); c.add(tl);   // the task lamp lights the far end of the bench
    c.hit(1.1, 1.2, 3.2, 0, 1.4, 0, { prompt: function () { return benchPrompt(); }, use: function () { benchUse(); } });
    // the terminal: a floor stand on the east corner past the near end, screen at 1.7 m turned to face the working side across the
    // end of the bench, so it clears the box stacks and never stands in the walkway. It used to hang over the bench top at 1.45 m,
    // where two layers of boxes hid it and the bench's own hit box took the focus.
    var tg = new THREE.Group(); tg.position.set(0.35, 0, -2.0); tg.rotation.y = -Math.PI * 3 / 8; c.add(tg);
    cyl(0.28, 0.03, MAT.steelDark, 0, 0.015, -0.04, tg, 20); cyl(0.24, 0.02, MAT.rubber, 0, 0.04, -0.04, tg, 20); cyl(0.035, 1.72, MAT.steelDark, 0, 0.89, -0.08, tg, 10); box(0.14, 0.2, 0.07, MAT.steelDark, 0, 1.75, -0.06, tg);
    box(1.0, 0.76, 0.03, MAT.black, 0, 1.75, -0.02, tg); box(0.5, 0.02, 0.14, MAT.steelDark, 0, 1.3, 0.02, tg); box(0.06, 0.04, 0.12, MAT.black, 0.14, 1.33, 0.02, tg); box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.46, 1.44, 0.0, tg);
    var scr = touchScreen({ w: 400, h: 300, res: 3, pw: 0.9, ph: 0.675, x: 0, y: 1.75, z: 0, ry: 0, parent: tg, title: 'Bench terminal', draw: benchScreenDraw }); scr.mesh.userData.propId = 'bench'; scr.scrollable = true; scr.scroll = 0;
    c.solid(0.1, 0.6, -2.25, -1.75, 0, 2.3);
    // the stool
    c.cyl(0.17, 0.04, MAT.black, -1.0, 0.65, -0.4, 16); c.cyl(0.02, 0.6, MAT.chrome, -1.0, 0.32, -0.4, 8); c.cyl(0.2, 0.03, MAT.steelDark, -1.0, 0.03, -0.4, 16);
  }
  function benchScreenDraw(c, sc) {
    var allO = openOrders().sort(function (a, b2) { return (b2.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b2.due; }); sc.scrollMax = Math.max(0, allO.length - 4); sc.scroll = clamp(sc.scroll || 0, 0, sc.scrollMax);
    scBg(c, sc.w, sc.h); scHead(c, sc.w, 'PACKING', benchCount() + ' / ' + ECON.benchCap + ' on the bench · ' + allO.length + ' open');
    var os = allO.slice(sc.scroll, sc.scroll + 4), y = 56;
    if (!os.length) scText(c, 16, 76, 'No open orders.', '#a0acb8', 14);
    os.forEach(function (o) { var n = orderNeed(o); scText(c, 16, y + 12, '#' + o.num + ' ' + clientName(o.client).slice(0, 16) + (o.rush ? ' RUSH' : '') + (o.late ? ' LATE' : ''), o.late || o.rush ? '#ff6b5e' : '#eef1f5', 13); scText(c, 16, y + 28, o.lines.map(function (l) { return Math.min(l.qty, S.bench.boxes[l.sku] || 0) + '/' + l.qty + ' ' + skuName(l.sku).slice(0, 12); }).join(' · ').slice(0, 44), '#a0acb8', 11); var can = canPack(o), short = canPackShort(o); scButton(sc, 300, y + 4, 86, 32, can ? 'PACK' : short ? 'SHORT' : n.have + '/' + n.tot, can || short, function () { if (packOrder(o)) toast('Packed #' + o.num, 'good'); }, can ? '#5fd38d' : '#f5b53d'); y += 46; });
    if (sc.scrollMax > 0) { scText(c, 16, 290, 'Orders ' + (sc.scroll + 1) + ' to ' + Math.min(allO.length, sc.scroll + 4) + ' of ' + allO.length + ' · wheel scrolls', '#6b7784', 10); scButton(sc, 300, 262, 40, 26, 'UP', sc.scroll > 0, function () { sc.scroll = Math.max(0, sc.scroll - 1); }, '#f5b53d'); scButton(sc, 346, 262, 40, 26, 'DOWN', sc.scroll < sc.scrollMax, function () { sc.scroll = Math.min(sc.scrollMax, sc.scroll + 1); }, '#f5b53d'); }
    else scText(c, 16, 290, 'Look at a box on the bench to take it back · the cart takes surplus', '#6b7784', 10);
    var surN = surplusCount(); scButton(sc, 116, 258, 118, 26, surN ? 'RETURN ' + surN + ' SURPLUS' : 'NO SURPLUS', surN > 0, function () { returnSurplus(); }, '#f5b53d');
    if (S.up.plantAuto) { var autoOn = !S.pack || S.pack.auto !== false; scButton(sc, 16, 258, 92, 26, 'AUTO ' + (autoOn ? 'ON' : 'OFF'), true, function () { if (!S.pack) return; S.pack.auto = autoOn ? false : true; toast('Pack line auto-start ' + (autoOn ? 'off' : 'on'), autoOn ? 'bad' : 'good'); }, autoOn ? '#5fd38d' : '#ff6b5e'); }
  }
  // yard props (the shelter, dumpster, flag and parking sign)
  function shelterBuild(c) {
    var FR = std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), GL = std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    [[-1.7, -2.2], [-1.7, 2.2], [1.7, -2.2], [1.7, 2.2]].forEach(function (p) { c.box(0.08, 2.5, 0.08, FR, p[0], 1.25, p[1]); c.box(0.2, 0.02, 0.2, FR, p[0], 0.01, p[1]); });
    c.box(3.6, 0.06, 4.6, FR, 0, 2.5, 0); c.box(3.8, 0.04, 4.8, std({ color: 0x2a2f35, roughness: 0.7 }), 0, 2.56, 0); c.box(3.8, 0.1, 0.06, FR, 0, 2.5, 2.4); c.box(3.8, 0.1, 0.06, FR, 0, 2.5, -2.4); c.box(0.06, 0.1, 4.8, FR, -1.9, 2.5, 0); c.box(0.06, 0.1, 4.8, FR, 1.9, 2.5, 0);
    c.plane(4.4, 2.3, GL, -1.7, 1.3, 0, 0, Math.PI / 2); c.plane(1.6, 2.3, GL, -0.9, 1.3, -2.2, 0, 0); c.plane(1.6, 2.3, GL, 0.9, 1.3, -2.2, 0, 0); c.box(0.08, 2.5, 0.08, FR, -1.7, 1.25, 0); c.box(0.06, 0.06, 4.4, FR, -1.7, 0.95, 0); c.box(3.4, 0.06, 0.06, FR, 0, 0.95, -2.2);
    for (var sl = 0; sl < 5; sl++) c.box(2.4, 0.04, 0.08, MAT.wood, 0, 0.46, -1.9 + sl * 0.095); for (var sb = 0; sb < 3; sb++) { var bb = c.box(2.4, 0.04, 0.09, MAT.wood, 0, 0.7 + sb * 0.12, -2.04 - sb * 0.04); bb.rotation.x = -0.2; } [-1.0, 1.0].forEach(function (bx) { c.box(0.05, 0.44, 0.44, FR, bx, 0.22, -1.72); c.box(0.05, 0.5, 0.06, FR, bx, 0.75, -2.08).rotation.x = -0.2; });
    c.cyl(0.11, 1.0, FR, 1.3, 0.5, 1.6, 12); c.cyl(0.13, 0.08, FR, 1.3, 1.02, 1.6, 12); c.cyl(0.1, 0.02, std({ color: 0x8a8a8a, roughness: 0.5 }), 1.3, 1.065, 1.6, 12); c.cyl(0.14, 0.02, FR, 1.3, 0.01, 1.6, 12);
    c.sign(['SMOKING AREA', 'please use the ashtray'], 0.9, 0.3, 0, 2.05, -2.17, 0, { w: 384, h: 128, bg: '#1b232c', fg: '#a0acb8' }); c.sign(['NO SMOKING', 'beyond this shelter'], 0.9, 0.3, -1.67, 2.05, 0, Math.PI / 2, { w: 384, h: 128, bg: '#1b232c', fg: '#a0acb8' });
    c.solid(-1.8, -1.6, -2.3, 2.3, 0, 2.6); c.solid(-1.8, 1.8, -2.3, -2.1, 0, 2.6); c.solid(-1.3, 1.3, -2.1, -1.5, 0, 1.0); c.solid(1.1, 1.5, 1.4, 1.8, 0, 1.1);
  }
  function dumpsterBuild(c) { c.box(1.8, 1.3, 1.2, std({ color: 0x2f5a3a, roughness: 0.7, metalness: 0.3 }), 0, 0.65, 0); var dl = c.box(1.9, 0.08, 1.3, MAT.black, 0, 1.52, -0.2); dl.rotation.x = -0.35; [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]].forEach(function (w) { c.cyl(0.08, 0.06, MAT.black, w[0], 0.08, w[1], 10).rotation.z = Math.PI / 2; }); c.box(0.1, 0.1, 0.4, MAT.steelDark, -0.95, 0.9, 0); c.box(0.1, 0.1, 0.4, MAT.steelDark, 0.95, 0.9, 0); c.sign(['CARDBOARD', 'ONLY'], 1.2, 0.5, 0, 0.9, -0.62, Math.PI, { w: 256, h: 128, bg: '#2f5a3a', fg: '#fff' }); c.solid(-0.95, 0.95, -0.65, 0.65, -2, 2); }
  function flagBuild(c) { c.cyl(0.05, 9, MAT.chrome, 0, 4.5, 0, 8, 0.07); c.sphere(0.1, MAT.yellow, 0, 9.05, 0); var fg = new THREE.Group(); fg.position.set(0, 8.3, 0); fg.userData.dynamic = true; c.add(fg); yard.flag = fg; var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 8, 2), new THREE.MeshStandardMaterial({ map: textTex(['DEPOT CO.'], { w: 256, h: 160, bg: '#f5b53d', fg: '#1b232c' }), side: THREE.DoubleSide, roughness: 0.9 })); flag.position.set(0.82, 0, 0); fg.add(flag); yard.flagMesh = flag; }
  function parkingSignBuild(c) { c.cyl(0.04, 2.4, MAT.steelDark, 0, 1.2, 0, 6); c.sign(['STAFF', 'PARKING'], 0.9, 0.6, 0, 2.5, 0, 0, { w: 256, h: 160, bg: '#2c5f9e', fg: '#fff' }); }
  // a low-poly tree: a tapered trunk with bark, two limbs, and a canopy of jittered icosahedra in three greens, flat shaded
  var BARK = std({ color: 0x5a4634, roughness: 1, normalMap: NRM.wood, normalScale: new THREE.Vector2(0.8, 0.8) });
  var LEAF = [std({ color: 0x3f6f2e, roughness: 1, flatShading: true }), std({ color: 0x5c8f44, roughness: 1, flatShading: true }), std({ color: 0x4a7d33, roughness: 1, flatShading: true })];
  function canopy(c, r, x, y, z, mat) { var g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position; for (var i = 0; i < p.count; i++) { var k = 1 + (Math.random() - 0.5) * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * (0.8 + Math.random() * 0.3), p.getZ(i) * k); } g.computeVertexNormals(); var m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; c.group.add(m); return m; }
  function treeBuild(c) {
    var s = randf(0.85, 1.25), lean = randf(-0.06, 0.06);
    var trunk = c.cyl(0.11 * s, 2.8 * s, BARK, 0, 1.4 * s, 0, 9, 0.2 * s); trunk.rotation.z = lean;
    var l1 = c.cyl(0.05 * s, 1.1 * s, BARK, 0.35 * s, 2.5 * s, 0.1 * s, 6, 0.09 * s); l1.rotation.z = -0.7; var l2 = c.cyl(0.05 * s, 0.9 * s, BARK, -0.3 * s, 2.7 * s, -0.2 * s, 6, 0.08 * s); l2.rotation.z = 0.8; l2.rotation.x = 0.4;
    canopy(c, 1.35 * s, 0, 3.4 * s, 0, LEAF[0]); canopy(c, 1.0 * s, 0.8 * s, 3.0 * s, 0.4 * s, LEAF[1]); canopy(c, 0.95 * s, -0.75 * s, 3.2 * s, -0.5 * s, LEAF[2]); canopy(c, 0.8 * s, 0.1 * s, 4.3 * s, 0.1 * s, LEAF[1]); canopy(c, 0.7 * s, -0.2 * s, 2.6 * s, 0.8 * s, LEAF[0]);
    c.solid(-0.2, 0.2, -0.2, 0.2, -2, 2);
  }
  function bollardBuild(c) { c.cyl(0.11, 1.0, MAT.yellow, 0, 0.5, 0, 10); c.cyl(0.14, 0.05, MAT.black, 0, 0.025, 0, 10); c.solid(-0.12, 0.12, -0.12, 0.12, -2, 1); }
  function benchSeatBuild(c) { for (var sl = 0; sl < 4; sl++) c.box(1.6, 0.04, 0.07, MAT.wood, 0, 0.45, -0.14 + sl * 0.09); c.box(1.6, 0.04, 0.3, MAT.wood, 0, 0.85, 0.16).rotation.x = -0.2; [[-0.65], [0.65]].forEach(function (p) { c.box(0.06, 0.45, 0.4, MAT.steelDark, p[0], 0.22, 0); c.box(0.06, 0.5, 0.06, MAT.steelDark, p[0], 0.65, 0.18); }); c.solid(-0.8, 0.8, -0.25, 0.25, -2, 1); }

  // stations and fabric that move too
  function timeclockBuild(c) {
    var LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), DG = MAT_MACH.frame;
    var hous = new THREE.Mesh(bevelGeo(0.4, 0.56, 0.12, 0.02), LG); hous.position.set(0, 1.5, 0); hous.castShadow = true; c.group.add(hous); c.box(0.42, 0.03, 0.14, DG, 0, 1.79, 0); c.box(0.42, 0.03, 0.14, DG, 0, 1.21, 0);
    c.box(0.34, 0.36, 0.01, MAT.black, 0, 1.52, 0.05); c.box(0.14, 0.012, 0.03, MAT.black, 0, 1.28, 0.07); c.box(0.12, 0.004, 0.01, MAT.chrome, 0, 1.283, 0.08); tclock.lamp = c.box(0.03, 0.03, 0.02, glowMat(0x39d353, 1.2), 0.15, 1.72, 0.065); c.box(0.03, 0.03, 0.02, glowMat(0xff3b2f, 0.3), -0.15, 1.72, 0.065);
    c.box(0.5, 0.56, 0.08, DG, 0.58, 1.5, -0.02); c.box(0.48, 0.02, 0.06, LG, 0.58, 1.75, 0.0); for (var k = 0; k < 8; k++) { c.box(0.07, 0.15, 0.03, MAT.paper, 0.4 + Math.floor(k / 4) * 0.12 + 0.06 * (k % 2 ? 0 : 0), 1.62 - (k % 4) * 0.13, 0.04); } c.box(0.5, 0.02, 0.03, DG, 0.58, 1.26, 0.03);
    c.sign(['CLOCK IN · CLOCK OUT'], 0.86, 0.14, 0.3, 1.9, 0.0, 0, { w: 384, h: 64, bg: '#1b232c', fg: '#eef1f5' }); c.sign(['CARDS'], 0.3, 0.08, 0.58, 1.19, 0.05, 0, { w: 128, h: 40, bg: '#f5b53d', fg: '#1a1205' });
    c.cyl(0.012, 0.6, MAT.black, 0.18, 1.0, 0.0, 6);
    touchScreen({ w: 300, h: 320, pw: 0.3, ph: 0.32, x: 0, y: 1.5, z: 0.07, ry: 0, parent: c.group, title: 'Time clock', draw: drawTimeClock });
  }  function consoleBuild(di) { return function (c) {
    var inbound = DOOR_MAP[di].dir === 'in', k = DOOR_MAP[di].dock, lane = inbound ? null : MODES[TRUCK_OUT[k].mode];
    var hous = new THREE.Mesh(bevelGeo(0.5, 0.62, 0.12, 0.02), std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 })); hous.position.set(0, 1.45, 0); hous.castShadow = true; c.group.add(hous); c.box(0.44, 0.34, 0.01, MAT.black, 0, 1.47, 0.05); c.box(0.54, 0.04, 0.14, inbound ? MAT.hazard : MAT.yellow, 0, 1.78, 0); c.box(0.54, 0.04, 0.14, MAT_MACH.frame, 0, 1.12, 0); c.cyl(0.012, 1.0, MAT.black, 0, 0.6, -0.03, 6); c.cyl(0.03, 0.03, MAT.red, -0.17, 1.22, 0.07, 10).rotation.x = Math.PI / 2; c.box(0.05, 0.05, 0.02, MAT.yellow, -0.17, 1.22, 0.06); c.box(0.03, 0.03, 0.02, glowMat(0x5fd38d, 1.0), 0.17, 1.22, 0.065); c.box(0.08, 0.06, 0.04, MAT_MACH.frame, 0, 1.08, -0.02);
    touchScreen({ w: 320, h: 240, pw: 0.4, ph: 0.3, x: 0, y: 1.47, z: 0.065, ry: 0, parent: c.group, title: 'Dock console ' + dockLabel(di), draw: function (cc, sc) {
      scBg(cc, sc.w, sc.h, inbound ? 'rgba(245,181,61,0.16)' : 'rgba(95,211,141,0.16)'); scHead(cc, sc.w, 'DOCK ' + dockLabel(di), lane ? lane.name.toUpperCase() + ' LANE' : undefined);
      var t = truckAtDoor(di);
      if (inbound) {
        if (t) { var left = S.pallets.filter(function (q) { return q.place === 'truck' && q.truck === t.id; }).length; scText(cc, 16, 66, 'Truck docked · ' + t.driver + ' · ' + clientName(t.client), '#f5b53d', 14); scText(cc, 16, 86, left + ' of ' + t.pallets.length + ' pallets still on it · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scText(cc, 16, 106, t.signed ? 'Delivery note signed' : 'NOT SIGNED: see the driver outside', t.signed ? '#5fd38d' : '#ff6b5e', 13); }
        else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, 'Inbound slots: ' + TRUCK_IN.map(fmtTime).join(' and ') + (S.up.dock2 || k === 0 ? '' : ' (buy the second bay)'), '#eef1f5', 13); }
        scButton(sc, 16, 128, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
        var pending = S.pallets.filter(function (q) { return q.place === 'floor'; }).length; scButton(sc, 164, 128, 140, 40, pending + ' on the floor', false, function () { scanToggle(true); scanPage(1); });
        if (t && !t.signed) scButton(sc, 16, 176, 288, 36, 'SIGN THE DELIVERY NOTE', true, function () { signTruck(t); var dm = truckMeshes[t.id]; if (dm && dm.driver) say(dm.driver, pick(DRIVER_LINES.signed), '#5fd38d'); }, '#5fd38d');   // from the console, no walk to the driver
      } else {
        var nxt = outNext(k);
        if (!dockOwned(k)) { scText(cc, 16, 66, 'Not in service', '#ff6b5e', 15); scText(cc, 16, 86, 'The air dock opens with the sortation deck (shop)', '#eef1f5', 13); }
        else if (t) { scText(cc, 16, 66, 'Truck docked · ' + t.driver, '#5fd38d', 15); scText(cc, 16, 86, t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scButton(sc, 16, 104, 288, 44, t.parcels.length ? 'DISPATCH NOW' : 'nothing loaded', t.parcels.length > 0, function () { consoleUse(di); }, '#5fd38d'); }
        else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, 'Next: ' + fmtTime(nxt.arrive) + ' to ' + fmtTime(nxt.leave) + ' · ' + outWindows(k).map(function (w) { return fmtTime(w.arrive); }).join(' and ') + ' daily', '#eef1f5', 13); }
        scButton(sc, 16, 160, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
        var packed = S.orders.filter(function (o) { return o.state === 'packed' && orderMode(o) === lane.id; }).length; scButton(sc, 164, 160, 140, 40, packed + ' ' + lane.name.toLowerCase() + ' packed', false, function () { scanToggle(true); scanPage(0); });
        scText(cc, 16, 212, (S.stats.misrouted || 0) + ' parcels out of the wrong door so far', '#a0acb8', 11);
      }
      scText(cc, 16, 226, S.events.power ? 'NO POWER' : 'mains ok', S.events.power ? '#ff6b5e' : '#5fd38d', 11);
    } });
    c.sign(['DOCK ' + dockLabel(di)], 0.7, 0.18, 0, 1.95, 0.0, 0, { w: 256, h: 64, bg: '#1b232c', fg: inbound ? '#f5b53d' : '#5fd38d' });
  }; }
  function breakerBuild(c) {
    var LG = std({ color: 0xb9bec4, roughness: 0.45, metalness: 0.3 }); var box2 = new THREE.Mesh(bevelGeo(0.46, 0.7, 0.14, 0.02), LG); box2.position.set(0, 1.5, 0); box2.castShadow = true; c.group.add(box2);
    c.box(0.4, 0.62, 0.012, std({ color: 0xcfd4d9, roughness: 0.5 }), 0, 1.5, 0.075); c.box(0.025, 0.08, 0.02, MAT.chrome, 0.16, 1.5, 0.085); c.box(0.4, 0.02, 0.016, MAT_MACH.frame, 0, 1.2, 0.075);
    c.box(0.1, 0.22, 0.03, MAT.black, 0, 1.52, 0.09); c.box(0.06, 0.12, 0.04, MAT.red, 0, 1.55, 0.11); c.box(0.03, 0.03, 0.02, glowMat(0x5fd38d, 1.0), -0.12, 1.7, 0.085); c.box(0.08, 0.06, 0.002, MAT.paper, 0.1, 1.7, 0.082);
    c.sign(['⚡ DANGER 400 V'], 0.3, 0.07, 0, 1.32, 0.085, 0, { w: 256, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.cyl(0.02, 0.5, MAT.black, -0.1, 2.1, -0.02, 6); c.cyl(0.02, 0.5, MAT.black, 0.1, 2.1, -0.02, 6);
    c.hit(0.5, 0.7, 0.2, 0, 1.5, 0.05, { prompt: function () { return S.events.power ? 'Reset the breaker' : 'Breaker panel (power is on)'; }, use: function () { flipBreaker(); } }); c.sign(['MAIN BREAKER'], 0.6, 0.15, 0, 1.95, 0.01, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' });
  }  function boardBuild(c) {
    var cv = document.createElement('canvas'); cv.width = 768; cv.height = 384; world.boardCtx = cv.getContext('2d');
    world.boardTex = new THREE.CanvasTexture(cv); world.boardTex.encoding = THREE.sRGBEncoding; world.boardMat = new THREE.MeshBasicMaterial({ map: world.boardTex });
    c.cyl(0.03, 2.8, MAT.steelDark, -1.0, 5.6, 0, 6); c.cyl(0.03, 2.8, MAT.steelDark, 1.0, 5.6, 0, 6); c.box(3.1, 0.06, 0.1, MAT.steelDark, 0, 4.2, 0);
    c.box(3.1, 1.6, 0.08, MAT.black, 0, 3.35, 0); var board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); board.position.set(0, 3.35, 0.05); c.add(board); var back = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); back.position.set(0, 3.35, -0.05); back.rotation.y = Math.PI; c.add(back);
    // on the screens list so the wheel pages it when you look up at it and it redraws itself as its pages turn; no buttons, so no E prompt
    world.boardScreen = { w: 768, h: 384, ctx: world.boardCtx, tex: world.boardTex, mesh: board, zones: [], draw: function (cx, sc) { drawBoard(sc); }, cur: null, ripple: 0, title: 'Order board', dirty: true, scrollable: true, scroll: 0, scrollMax: 0, autoPage: true }; screens.push(world.boardScreen);
    drawBoard();
  }
  function chargerBuild(c) {
    var CB = std({ color: 0x8b949c, roughness: 0.5, metalness: 0.4 });
    c.box(0.9, 1.1, 0.32, CB, 0, 1.55, -0.14); c.box(0.94, 0.04, 0.36, MAT.steelDark, 0, 2.12, -0.14); c.box(0.94, 0.04, 0.36, MAT.steelDark, 0, 0.98, -0.14);
    for (var vv = 0; vv < 6; vv++) c.box(0.3, 0.012, 0.02, MAT.black, -0.22, 1.9 - vv * 0.04, 0.03); for (var vw = 0; vw < 6; vw++) c.box(0.3, 0.012, 0.02, MAT.black, 0.22, 1.9 - vw * 0.04, 0.03);
    dress.charger = c.box(0.06, 0.06, 0.02, glowMat(0x5fd38d, 1.2), -0.35, 1.3, 0.03); 
    c.sign(['CHARGING POINT'], 0.8, 0.14, 0, 2.0, 0.03, 0, { w: 512, h: 96, bg: '#1b232c', fg: '#5fd38d' }); c.sign(['24 V · ISOLATE BEFORE SERVICE'], 0.8, 0.07, 0, 1.08, 0.03, 0, { w: 512, h: 48, bg: '#f5b53d', fg: '#1a1205' });
    [-0.28].forEach(function (rx) { var reel = c.cyl(0.14, 0.12, MAT.black, rx, 0.75, -0.1, 16); reel.rotation.x = Math.PI / 2; c.cyl(0.05, 0.14, MAT.steelDark, rx, 0.75, -0.1, 10).rotation.x = Math.PI / 2; var cab = c.cyl(0.018, 0.9, MAT.black, rx, 0.35, 0.3, 6); cab.rotation.x = 1.1; });
    c.box(0.18, 0.6, 0.18, MAT.steelDark, -0.5, 0.3, 0.55); c.box(0.22, 0.04, 0.22, MAT.yellow, -0.5, 0.62, 0.55); c.box(0.1, 0.08, 0.06, MAT.red, -0.5, 0.5, 0.65); c.box(0.1, 0.08, 0.06, MAT.blue, -0.5, 0.36, 0.65);
    c.sign(['FORKLIFT'], 0.2, 0.05, -0.5, 0.28, 0.65, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' });
    c.box(1.1, 0.03, 0.08, MAT.hazard, 0, 0.015, 0.2); c.solid(-0.5, 0.5, -0.3, 0.7, 0, 2.2);
    c.hit(1.0, 1.3, 0.5, 0, 1.5, 0.05, { prompt: function () { return cablePrompt('fork'); }, use: function () { cableUse('fork'); } });
    touchScreen({ w: 200, h: 80, pw: 0.4, ph: 0.16, x: 0.05, y: 1.3, z: 0.035, ry: 0, parent: c.group, title: 'Charger display', draw: function (cc, sc) { scBg(cc, sc.w, sc.h, 'rgba(95,211,141,0.2)'); var b = Math.round((S.fork.batt === undefined ? 1 : S.fork.batt) * 100); scText(cc, 10, 30, S.fork.plugged ? (b >= 100 ? 'FORKLIFT · FULL' : 'CHARGING · ' + b + '%') : 'FORKLIFT · ' + b + '% · unplugged', S.fork.plugged ? '#5fd38d' : '#f5b53d', 18); cc.fillStyle = 'rgba(255,255,255,0.12)'; cc.fillRect(10, 48, 180, 14); cc.fillStyle = b < 20 ? '#ff6b5e' : '#5fd38d'; cc.fillRect(10, 48, 1.8 * b, 14); } });
    var w = 2.6, d = 3.6, cz = 2.8; [[0, cz - d / 2, w, 0.08], [0, cz + d / 2, w, 0.08], [-w / 2, cz, 0.08, d], [w / 2, cz, 0.08, d]].forEach(function (ln) { c.plane(ln[2], ln[3], MAT.yellowLine, ln[0], 0.0062, ln[1], -Math.PI / 2, 0); }); c.plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex(['FORKLIFT'], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), 0, 0.0066, cz - d / 2 + 0.3, -Math.PI / 2, 0);
  }
  function lampPostBuild(c) { c.cyl(0.08, 7.5, MAT.steelDark, 0, 3.75, 0, 8, 0.11); c.box(0.6, 0.2, 0.3, MAT.steelDark, 0, 7.65, 0); var lens = c.box(0.5, 0.04, 0.24, glowMat(0xffd9a0, 0.2), 0, 7.53, 0); yard.lampLenses.push(lens); var l = new THREE.PointLight(0xffd9a0, 0.0, 36, 2); l.position.set(0, 7.4, 0); l.userData.k = 1.4; c.add(l); yardLights.push(l); c.box(0.3, 0.2, 0.3, MAT.grey, 0, 0.1, 0); c.solid(-0.15, 0.15, -0.15, 0.15, -2, 2); }
  function carBuild(k) { return function (c) { c.add(carMesh(typeof k === "number" ? CAR_COLS[k % CAR_COLS.length] : k)); c.solid(-2.2, 2.2, -1.0, 1.0, -2, 1.5); }; }
  function paintedBuild(c) { c.sign(['DEPOT CO.'], 9, 1.6, 0, 4.4, 0.01, 0, { w: 1024, h: 192, bg: '#1b232c', fg: '#f5b53d', plate: false }); c.sign(['RECEIVE · STORE · PICK · SHIP'], 7, 0.5, 0, 3.3, 0.01, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8', plate: false }); }
  function aisleSignBuild(text) { return function (c) { c.sign([text], 2.2, 0.5, 0, 5.4, 0, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign([text], 2.2, 0.5, 0, 5.4, 0, Math.PI, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.cyl(0.006, 1.3, MAT.steelDark, -0.9, 6.3, 0, 4); c.cyl(0.006, 1.3, MAT.steelDark, 0.9, 6.3, 0, 4); }; }

  // ── Default layout ────────────────────────────────────────────────
  for (var rr = 0; rr < RACK.rows.length; rr++) (function (r) { defProp('rack' + r, { label: 'rack row ' + 'ABCDEF'[r], cat: 'hall', abs: true, x: 0, z: RACK.rows[r], rot: 0, build: rackBuild(r), when: function () { return r < S.up.rows; } }); })(rr);
  defProp('timeclock', { label: 'time clock', cat: 'wall', wall: true, x: -19.74, z: 10.2, rot: 1, build: timeclockBuild });
  defProp('cabinet', { label: 'control cabinet', cat: 'wall', wall: true, x: 12.42, z: 12.6, rot: 3, build: cabinetBuild });
  defProp('consoleIn0', { label: 'dock console IN 1', cat: 'wall', wall: true, abs: true, x: -29.7, z: -11.5, rot: 1, build: consoleBuild(0) });
  defProp('consoleIn1', { label: 'dock console IN 2', cat: 'wall', wall: true, abs: true, x: -29.7, z: -3.5, rot: 1, build: consoleBuild(1) });
  defProp('console0', { label: 'dock console OUT 1', cat: 'wall', wall: true, abs: true, x: 29.7, z: -9.6, rot: 3, build: consoleBuild(2) });   // south of the OUT 1 shipping bay
  defProp('console1', { label: 'dock console OUT 2', cat: 'wall', wall: true, abs: true, x: 29.7, z: -8.5, rot: 3, build: consoleBuild(3) });
  defProp('console2', { label: 'dock console OUT 3', cat: 'wall', wall: true, abs: true, x: 34.6, z: -23.83, rot: 0, build: consoleBuild(4) });   // on the north wall by the OUT 3 door: the east wall there is behind the spirals and the loaders
  defProp('breaker', { label: 'breaker panel', cat: 'wall', wall: true, x: 19.79, z: 9.6, rot: 3, build: breakerBuild });
  defProp('board', { label: 'order board', cat: 'hall', x: 16.2, z: 7.4, rot: 2, build: boardBuild });
  defProp('charger', { label: 'forklift charging point', cat: 'wall', wall: true, x: 0, z: 13.83, rot: 2, build: chargerBuild });
  defProp('painted', { label: 'painted name', cat: 'wall', wall: true, abs: true, keep: true, x: 28.5, z: -23.83, rot: 0, build: paintedBuild });   // east of the Hall 2 doorway, which cut through it at x 17
  [['aisleAB', -12, 'AISLE  A · B'], ['aisleBC', -6, 'AISLE  B · C'], ['aisleCD', 0, 'AISLE  C · D'], ['aisleDE', 6, 'AISLE  D · E'], ['aisleEF', 12, 'AISLE  E · F']].forEach(function (a) { defProp(a[0], { label: 'aisle sign', cat: 'hall', abs: true, x: 0, z: a[1], rot: 0, build: aisleSignBuild(a[2]) }); });
  [[-30, -12], [-30, 10], [30, -12], [30, 10]].forEach(function (p, i) { defProp('lamp' + i, { label: 'lamp post', cat: 'yard', yard: true, x: p[0], z: p[1], rot: 0, build: lampPostBuild }); });
  [0, 1, 3, 4].forEach(function (k, i) { defProp('car' + i, { label: 'parked car', cat: 'yard', yard: true, abs: true, x: -27.65 + k * 2.7, z: 31.5, rot: 1, build: carBuild(k) }); });
  var treeN = 0; for (var tx = -56; tx <= 56; tx += 14) { defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: tx, z: -56, rot: 0, build: treeBuild }); defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: tx + 7, z: 56, rot: 0, build: treeBuild }); }
  defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: -30, z: 24, rot: 0, build: treeBuild }); defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: 30, z: 26, rot: 0, build: treeBuild });
  defProp('xLampPost', { extra: true, label: 'lamp post', ico: '💡', cat: 'yard', yard: true, price: 350, desc: 'Lights the yard at night.', build: lampPostBuild });
  defProp('xCar', { extra: true, label: 'parked car', ico: '🚗', cat: 'yard', yard: true, price: 0, desc: 'Somebody is in.', build: function (c) { carBuild(pick(CAR_COLS))(c); } });
  defProp('xAisleSign', { extra: true, label: 'aisle sign', ico: '🪧', cat: 'hall', price: 40, desc: 'Hangs from the roof.', build: aisleSignBuild('AISLE') });

  // The entrance lobby (x -30 to -25.5, z 18.5 to 24): the staff door on the west wall at z 22, the lobby door east at z 20.
  // The time clock, lockers and hooks live here. The break room is the north-west corner (x -30 to -23, z -24 to -20.2), above IN 1.
  defProp('lockers', { label: 'lockers', cat: 'room', x: -18.4, z: 13.55, rot: 0, build: lockerBuild });
  defProp('hooks', { label: 'coat hooks', cat: 'room', wall: true, x: -16.6, z: 13.83, rot: 2, build: hooksBuild });
  defProp('notice', { label: 'notice board', cat: 'wall', wall: true, x: -17.5, z: 8.59, rot: 0, build: noticeBuild });
  defProp('firstAid', { label: 'first-aid box', cat: 'wall', wall: true, abs: true, x: -25.6, z: 20.9, rot: 3, build: firstAidBuild });
  defProp('extBreak', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: 13.2, rot: 1, build: extinguisherBuild });
  defProp('posterRota', { label: 'rota poster', cat: 'wall', wall: true, x: -19.83, z: 9.2, rot: 1, build: posterBuild('rota', 0.6, 0.9) });
  defProp('posterSmoke', { label: 'no-smoking poster', cat: 'wall', wall: true, x: -15.6, z: 11.0, rot: 3, build: posterBuild('nosmoking', 0.6, 0.9) });
  defProp('lobbySeat', { label: 'bench seat', cat: 'room', x: -17.8, z: 9.1, rot: 0, build: benchSeatBuild });
  defProp('cot', { label: 'cot', cat: 'room', x: -15.0, z: -13.45, rot: 0, build: cotBuild });
  defProp('vending', { label: 'vending machine', cat: 'room', x: -13.6, z: -11.4, rot: 1, build: vendingBuild });
  defProp('coffee', { label: 'coffee counter', cat: 'room', x: -19.5, z: -12.2, rot: 1, build: coffeeBuild });
  defProp('fridge', { label: 'fridge', cat: 'room', x: -19.5, z: -13.5, rot: 1, build: fridgeBuild });
  defProp('cooler', { label: 'water cooler', cat: 'room', x: -19.6, z: -10.7, rot: 1, build: coolerBuild });
  defProp('table', { label: 'table', cat: 'room', x: -16.6, z: -11.6, rot: 0, build: tableBuild });
  defProp('chair1', { label: 'chair', cat: 'room', x: -17.35, z: -11.6, rot: 3, build: chairBuild });
  defProp('chair2', { label: 'chair', cat: 'room', x: -15.85, z: -11.6, rot: 1, build: chairBuild });
  defProp('chair3', { label: 'chair', cat: 'room', x: -16.6, z: -12.35, rot: 0, build: chairBuild });
  defProp('calendar', { label: 'calendar', cat: 'wall', wall: true, x: -17.6, z: -13.83, rot: 0, build: calendarBuild });
  defProp('clockBreak', { label: 'wall clock', cat: 'wall', wall: true, x: -18.4, z: -13.83, rot: 0, build: clockBuild(0.28) });
  defProp('posterHands', { label: 'wash-hands poster', cat: 'wall', wall: true, x: -16.5, z: -13.83, rot: 0, build: posterBuild('hands', 0.5, 0.75) });
  defProp('plantBreak', { label: 'potted plant', cat: 'room', x: -13.5, z: -13.5, rot: 0, build: plantBuild });
  // the office
  defProp('desk', { label: 'office desk', cat: 'room', x: 17.5, z: 12.4, rot: 0, build: deskBuild });
  defProp('officeChair', { label: 'office chair', cat: 'room', x: 17.5, z: 11.6, rot: 0, build: officeChairBuild });
  defProp('cabinets', { label: 'filing cabinets', cat: 'room', x: 19.3, z: 13.5, rot: 0, build: cabinetsBuild });
  defProp('plant', { label: 'potted plant', cat: 'room', x: 13.2, z: 13.4, rot: 0, build: plantBuild });
  defProp('coatStand', { label: 'coat stand', cat: 'room', x: 13.0, z: 9.0, rot: 0, build: coatStandBuild });
  defProp('kpi', { label: 'whiteboard', cat: 'wall', wall: true, x: 19.83, z: 11.5, rot: 3, build: kpiBuild });
  defProp('certificate', { label: 'certificate', cat: 'wall', wall: true, x: 19.83, z: 13.3, rot: 3, build: certificateBuild });
  defProp('posterSafety', { label: 'safety poster', cat: 'wall', wall: true, x: 16.5, z: 13.83, rot: 2, build: posterBuild('safety', 0.6, 0.9) });
  // the hall
  defProp('bench', { label: 'packing bench', cat: 'hall', x: 16.6, z: 5.2, rot: 0, build: benchBuild });
  defProp('binDamaged', { label: 'damaged-goods bin', cat: 'hall', x: 13.3, z: 2.4, rot: 0, build: binBuild });
  defProp('broom', { label: 'broom', cat: 'hall', x: 13.0, z: 3.0, rot: 0, build: broomBuild });
  defProp('wetFloor', { label: 'wet-floor sign', cat: 'hall', x: 13.4, z: 7.6, rot: 1, build: wetFloorBuild });
  defProp('empties', { label: 'stack of empty pallets', cat: 'hall', x: -11.2, z: -12.6, rot: 0, build: emptiesBuild });
  defProp('baler', { label: 'baler', cat: 'hall', x: -7.5, z: -13.2, rot: 0, build: balerBuild });
  defProp('wrapper', { label: 'stretch wrapper', cat: 'hall', abs: true, x: 14, z: -22.3, rot: 0, build: wrapperBuild });
  defProp('hose', { label: 'hose reel', cat: 'wall', wall: true, abs: true, x: -10.5, z: -23.83, rot: 0, build: hoseBuild });
  defProp('extNW', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: -12, rot: 1, build: extinguisherBuild });
  defProp('extNE', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 35.83, z: -16.4, rot: 3, build: extinguisherBuild });
  defProp('extBench', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 29.83, z: 16.5, rot: 3, build: extinguisherBuild });   // z 6.5 until 1.13.1: the shipping belt now runs along that stretch of wall
  defProp('clockHall', { label: 'hall clock', cat: 'wall', wall: true, abs: true, x: 12, z: -23.7, rot: 0, build: function (c) { var f = clockBuild(0.5); f(c); c.group.children[c.group.children.length - 1].position.y = 5.8 - 2.7 + 2.7; } });
  defProp('posterLift', { label: 'lifting poster', cat: 'wall', wall: true, abs: true, x: -29.83, z: 2, rot: 1, build: posterBuild('lifting', 0.7, 1.05) });
  defProp('posterFork', { label: 'forklift poster', cat: 'wall', wall: true, x: 2.2, z: 13.83, rot: 2, build: posterBuild('forklift', 0.7, 1.05) });
  defProp('posterStack', { label: 'pallet-rules poster', cat: 'wall', wall: true, x: -6, z: 13.83, rot: 2, build: posterBuild('stacking', 0.7, 1.05) });
  defProp('posterOffice', { label: 'safety poster', cat: 'wall', wall: true, x: 12.42, z: 11.5, rot: 3, build: posterBuild('safety', 0.7, 1.05) });
  defProp('posterExit', { label: 'fire-exit poster', cat: 'wall', wall: true, x: 15.2, z: -13.83, rot: 0, build: posterBuild('exit', 0.6, 0.9) });
  // the yard
  defProp('shelter', { label: 'smoking shelter', cat: 'yard', yard: true, x: -22.5, z: 19, rot: 0, build: shelterBuild });
  defProp('dumpster', { label: 'dumpster', cat: 'yard', yard: true, x: 24, z: 18, rot: 0, build: dumpsterBuild });
  defProp('flag', { label: 'flag pole', cat: 'yard', yard: true, x: 10, z: 19, rot: 0, build: flagBuild });
  defProp('parkingSign', { label: 'parking sign', cat: 'yard', yard: true, x: -2, z: 18.5, rot: 0, build: parkingSignBuild });
  // extras to buy from the catalogue
  defProp('xChair', { extra: true, label: 'chair', ico: '🪑', cat: 'room', price: 25, desc: 'A canteen chair.', build: chairBuild });
  defProp('xTable', { extra: true, label: 'table', ico: '🪵', cat: 'room', price: 60, desc: 'A square canteen table.', build: tableBuild });
  defProp('xLockers', { extra: true, label: 'lockers', ico: '🗄️', cat: 'room', price: 120, desc: 'Two more lockers.', build: lockerBuild });
  defProp('xPlant', { extra: true, label: 'potted plant', ico: '🌿', cat: 'room', price: 40, desc: 'Something green.', build: plantBuild });
  defProp('xCooler', { extra: true, label: 'water cooler', ico: '🥤', cat: 'room', price: 90, desc: 'Another cooler.', build: coolerBuild });
  defProp('xCot', { extra: true, label: 'cot', ico: '🛏️', cat: 'room', price: 150, desc: 'A second place to sleep.', build: cotBuild });
  defProp('xOfficeChair', { extra: true, label: 'office chair', ico: '💺', cat: 'room', price: 80, desc: 'Swivels.', build: officeChairBuild });
  defProp('xCabinets', { extra: true, label: 'filing cabinets', ico: '🗂️', cat: 'room', price: 110, desc: 'Paperwork storage.', build: cabinetsBuild });
  defProp('xBin', { extra: true, label: 'wheelie bin', ico: '🗑️', cat: 'hall', price: 20, desc: 'Takes damaged boxes too.', build: binBuild });
  defProp('xWetFloor', { extra: true, label: 'wet-floor sign', ico: '⚠️', cat: 'hall', price: 10, desc: 'For appearances.', build: wetFloorBuild });
  defProp('xEmpties', { extra: true, label: 'stack of empty pallets', ico: '🪵', cat: 'hall', price: 0, desc: 'Dressing.', build: emptiesBuild });
  defProp('xBollard', { extra: true, label: 'bollard', ico: '🟡', cat: 'hall', price: 30, desc: 'Guards a corner.', build: bollardBuild });
  defProp('xExt', { extra: true, label: 'fire extinguisher', ico: '🧯', cat: 'wall', wall: true, price: 60, desc: 'On the wall.', build: extinguisherBuild });
  defProp('xClock', { extra: true, label: 'wall clock', ico: '🕒', cat: 'wall', wall: true, price: 25, desc: 'Keeps game time.', build: clockBuild(0.32) });
  defProp('xNotice', { extra: true, label: 'notice board', ico: '📌', cat: 'wall', wall: true, price: 30, desc: 'Cork and pins.', build: noticeBuild });
  POSTER_KINDS.forEach(function (k) { defProp('xPoster_' + k, { extra: true, label: k + ' poster', ico: '🖼️', cat: 'wall', wall: true, price: 15, desc: 'Framed.', build: posterBuild(k, 0.6, 0.9) }); });
  defProp('xFirstAid', { extra: true, label: 'first-aid box', ico: '🩹', cat: 'wall', wall: true, price: 35, desc: 'The inspector likes one.', build: firstAidBuild });
  defProp('xTree', { extra: true, label: 'tree', ico: '🌳', cat: 'yard', yard: true, price: 80, desc: 'For the yard.', build: treeBuild });
  defProp('xBenchSeat', { extra: true, label: 'bench seat', ico: '🪑', cat: 'yard', yard: true, price: 70, desc: 'Slatted.', build: benchSeatBuild });
  defProp('xYardBollard', { extra: true, label: 'bollard', ico: '🟡', cat: 'yard', yard: true, price: 30, desc: 'Yellow steel.', build: bollardBuild });
  defProp('xShelter', { extra: true, label: 'smoking shelter', ico: '🚬', cat: 'yard', yard: true, price: 400, desc: 'Roof and a bench.', build: shelterBuild });
  defProp('xDumpster', { extra: true, label: 'dumpster', ico: '♻️', cat: 'yard', yard: true, price: 150, desc: 'Cardboard only.', build: dumpsterBuild });
  // ── The wing ──────────────────────────────────────────────────────
  // x -14..10, z -44..-24, under a 6 m roof. It shares the hall's north wall, which has a doorway with a strip curtain for people
  // and the forklift, and a low opening the main belt runs through.
  var WING = { x0: -14, x1: 10, z0: -HALL.z - 20, z1: -HALL.z, h: 6, door: { x0: 4, x1: 7.6, h: 4.2 }, belt: { x0: -5, x1: -3, h: 2.0 } };
  function inWing(x, z) { return x > WING.x0 && x < WING.x1 && z > WING.z0 && z < WING.z1; }
  function buildWing() {
    var W = WING, h = W.h, cx = (W.x0 + W.x1) / 2, cz = (W.z0 + W.z1) / 2, wx = W.x1 - W.x0, wz = W.z1 - W.z0;
    box(wx + 0.6, 1.2, wz + 0.3, MAT.grey, cx, YARD_Y + 0.6, cz - 0.15);                                   // the plinth it stands on
    plane(wx, wz, MAT.floor, cx, 0.001, cz, -Math.PI / 2);
    box(0.3, h, wz, MAT.wall, W.x0, h / 2, cz); solid(W.x0 - 0.15, W.x0 + 0.15, W.z0, W.z1);                 // west, east and north walls
    box(0.3, h, wz, MAT.wall, W.x1, h / 2, cz); solid(W.x1 - 0.15, W.x1 + 0.15, W.z0, W.z1);
    var hd = HALLS.hall4.door;   // the doorway into Hall 4, cut from the first day and shuttered until the hall is bought
    box(hd.x0 - (W.x0 - 0.15), h, 0.3, MAT.wall, (W.x0 - 0.15 + hd.x0) / 2, h / 2, W.z0); solid(W.x0 - 0.15, hd.x0, W.z0 - 0.15, W.z0 + 0.15);
    box(hd.x1 - hd.x0, h - hd.h, 0.3, MAT.wall, (hd.x0 + hd.x1) / 2, hd.h + (h - hd.h) / 2, W.z0); solid(hd.x0, hd.x1, W.z0 - 0.15, W.z0 + 0.15, hd.h, 9);
    box(W.x1 + 0.15 - hd.x1, h, 0.3, MAT.wall, (hd.x1 + W.x1 + 0.15) / 2, h / 2, W.z0); solid(hd.x1, W.x1 + 0.15, W.z0 - 0.15, W.z0 + 0.15);
    box(wx + 0.6, 0.3, wz + 0.6, MAT.roof, cx, h + 0.15, cz); plane(wx, wz, MAT.roofIn, cx, h - 0.01, cz, Math.PI / 2);
    [-38, -31].forEach(function (z) { var sk = plane(wx - 4, 1.4, MAT.skylight, cx, h - 0.02, z, Math.PI / 2); world.lampMeshes.push(sk); });
    for (var tz = W.z0 + 4; tz < W.z1; tz += 6) box(wx - 0.4, 0.5, 0.22, MAT.steelDark, cx, h - 0.3, tz);
    world.wingLights = []; [[-8, -39], [4, -39], [-8, -29], [4, -29]].forEach(function (p) { var m = box(0.9, 0.12, 0.5, MAT.lamp, p[0], h - 0.6, p[1]); world.lampMeshes.push(m); cyl(0.03, 0.4, MAT.steelDark, p[0], h - 0.35, p[1]); var l = new THREE.PointLight(0xfff2dc, 0.9, 26, 2); l.position.set(p[0], h - 1.2, p[1]); scene.add(l); world.wingLights.push(l); });
    // the inside face of the shared wall gets a sign over the doorway, the strip curtain, and a steel frame round the belt opening
    var strip = std({ color: 0xdfe8ee, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }); strip.userData.noBake = true;
    box(W.door.x1 - W.door.x0 + 0.3, 0.12, 0.4, MAT.steelDark, (W.door.x0 + W.door.x1) / 2, W.door.h - 0.05, W.z1);
    for (var sx = W.door.x0 + 0.15; sx < W.door.x1; sx += 0.3) { var st = plane(0.28, W.door.h - 0.15, strip, sx, (W.door.h - 0.15) / 2, W.z1 + (sx * 7 % 1) * 0.02 - 0.01, 0, 0); st.rotation.y = ((sx * 13) % 1 - 0.5) * 0.08; }
    box(0.12, W.belt.h + 0.12, 0.5, MAT.yellow, W.belt.x0 - 0.06, (W.belt.h + 0.12) / 2, W.z1); box(0.12, W.belt.h + 0.12, 0.5, MAT.yellow, W.belt.x1 + 0.06, (W.belt.h + 0.12) / 2, W.z1); box(W.belt.x1 - W.belt.x0 + 0.24, 0.12, 0.5, MAT.yellow, (W.belt.x0 + W.belt.x1) / 2, W.belt.h + 0.06, W.z1);
    // floor markings: the walkway down the east side, hazard borders round the machines, a square for raw pallets
    plane(0.1, wz - 1, MAT.yellowLine, W.x1 - 1.6, 0.006, cz, -Math.PI / 2); plane(0.1, wz - 1, MAT.yellowLine, W.x1 - 0.4, 0.006, cz, -Math.PI / 2);
    [[-9.5, -33, 2.0, 2.0]].forEach(function (q) { plane(q[2], 0.08, MAT.whiteLine, q[0], 0.006, q[1] - q[3] / 2, -Math.PI / 2); plane(q[2], 0.08, MAT.whiteLine, q[0], 0.006, q[1] + q[3] / 2, -Math.PI / 2); plane(0.08, q[3], MAT.whiteLine, q[0] - q[2] / 2, 0.006, q[1], -Math.PI / 2); plane(0.08, q[3], MAT.whiteLine, q[0] + q[2] / 2, 0.006, q[1], -Math.PI / 2); });
    // the pipe rack along the west wall, the compressor in the corner, a cable tray under the roof
    [1.6, 1.9, 2.2].forEach(function (py, i) { var pipe = cyl(0.06 - i * 0.012, wz - 2, i === 1 ? MAT.blue : MAT.steel, W.x0 + 0.45, py + 2.2, cz, null, 10); pipe.rotation.x = Math.PI / 2; }); for (var bz = W.z0 + 2; bz < W.z1 - 1; bz += 3) { box(0.5, 0.06, 0.06, MAT.steelDark, W.x0 + 0.4, 4.0, bz); box(0.06, 0.9, 0.06, MAT.steelDark, W.x0 + 0.62, 4.0, bz); }
    var comp = new THREE.Group(); comp.position.set(8.9, 0, -27.0);   // by the door into the main hall, clear of the way through to Hall 4 scene.add(comp); box(1.6, 0.1, 0.8, MAT.steelDark, 0, 0.05, 0, comp); var tank = cyl(0.32, 1.5, std({ color: 0x3a5f9e, roughness: 0.4, metalness: 0.5 }), 0, 0.5, 0, comp, 16); tank.rotation.z = Math.PI / 2; box(0.5, 0.45, 0.4, MAT.steelDark, 0.2, 1.05, 0, comp); cyl(0.2, 0.3, MAT.black, -0.3, 1.0, 0, comp, 12).rotation.z = Math.PI / 2; cyl(0.05, 0.03, MAT.white, 0.45, 1.2, 0.22, comp, 10).rotation.x = Math.PI / 2; cyl(0.015, 1.2, MAT.black, 0.3, 0.9, 0.4, comp, 6).rotation.x = 0.4; solid(6.3, 8.1, -42.3, -41.3, 0, 1.4);
    sign(['COMPRESSOR · HEARING PROTECTION'], 1.3, 0.14, 8.9, 1.8, -26.4, 0, { w: 512, h: 56, bg: '#1b232c', fg: '#f5b53d' });
    box(0.3, 0.04, wz - 2, MAT.steelDark, W.x1 - 1.0, h - 0.9, cz); for (var cz2 = W.z0 + 2; cz2 < W.z1; cz2 += 4) box(0.32, 0.08, 0.05, MAT.steelDark, W.x1 - 1.0, h - 0.86, cz2);
    // the ladder and the ledge up to the hopper's gauge, and the silo pipe coming in over the west wall
    var sp = cyl(0.14, 9.0, MAT.steel, -13.5, 5.6, -34, null, 12); sp.rotation.z = Math.PI / 2; cyl(0.14, 1.2, MAT.steel, -9.6, 5.0, -34, null, 12);
    // grime along the foot of every wall, and the light shafts under the two skylights
    var gTex = tex(64, 64, function (c2, w2, h2) { c2.clearRect(0, 0, w2, h2); var g = c2.createLinearGradient(0, h2, 0, 0); g.addColorStop(0, 'rgba(20,18,16,0.5)'); g.addColorStop(0.6, 'rgba(20,18,16,0.12)'); g.addColorStop(1, 'rgba(20,18,16,0)'); c2.fillStyle = g; c2.fillRect(0, 0, w2, h2); });
    var gMat = new THREE.MeshBasicMaterial({ map: gTex, transparent: true, depthWrite: false }); gMat.userData.noBake = true;
    plane(wz - 0.6, 0.7, gMat, W.x0 + 0.19, 0.35, cz, 0, Math.PI / 2); plane(wz - 0.6, 0.7, gMat, W.x1 - 0.19, 0.35, cz, 0, -Math.PI / 2); plane(wx - 0.6, 0.7, gMat, cx, 0.35, W.z0 + 0.19, 0, 0); plane(wx - 0.6, 0.7, gMat, cx, 0.35, W.z1 - 0.19, 0, Math.PI);
    var shTex = tex(32, 256, function (c2, w2, h2) { var g = c2.createLinearGradient(0, 0, 0, h2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c2.fillStyle = g; c2.fillRect(0, 0, w2, h2); var g2 = c2.createLinearGradient(0, 0, w2, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.3, 'rgba(0,0,0,0)'); g2.addColorStop(0.7, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); c2.globalCompositeOperation = 'destination-out'; c2.fillStyle = g2; c2.fillRect(0, 0, w2, h2); });
    var shMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0, map: shTex, alphaMap: shTex, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); shMat.userData.noBake = true; world.wingShaft = shMat;
    [-38, -31].forEach(function (z) { for (var sx = W.x0 + 4; sx <= W.x1 - 4; sx += 6) { for (var k = 0; k < 2; k++) { var sh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, h - 0.2), shMat); sh.position.set(sx + (k ? 0.3 : -0.3), h / 2 - 0.1, z); sh.rotation.y = k ? Math.PI / 2 + 0.25 : 0.25; sh.rotation.z = 0.08; sh.userData.noBake = true; sh.renderOrder = 2; scene.add(sh); } } });
    // floor wear: tyre scuffs on the forklift route from the doorway, oil under the moulder, a drain channel across the middle, hazard borders
    var scuffTex = tex(256, 64, function (c2, w2, h2) { c2.clearRect(0, 0, w2, h2); for (var i = 0; i < 2; i++) { var g = c2.createLinearGradient(0, 0, w2, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(10,10,12,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c2.fillStyle = g; c2.fillRect(0, 10 + i * 36, w2, 10); } });
    var scuffMat = new THREE.MeshBasicMaterial({ map: scuffTex, transparent: true, depthWrite: false }); scuffMat.userData.noBake = true;
    for (var mz = W.z1 - 3; mz > W.z0 + 3; mz -= 5) { var sm = plane(5, 1.1, scuffMat, (W.door.x0 + W.door.x1) / 2 + randf(-0.6, 0.6), 0.0045, mz, -Math.PI / 2, 0); sm.rotation.z = Math.PI / 2 + randf(-0.15, 0.15); }
    var oilTex = tex(128, 128, function (c2, w2, h2) { c2.clearRect(0, 0, w2, h2); for (var i = 0; i < 5; i++) { var r = randf(14, 40), x = randf(r, w2 - r), y = randf(r, h2 - r), g = c2.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(8,8,10,0.5)'); g.addColorStop(1, 'rgba(8,8,10,0)'); c2.fillStyle = g; c2.fillRect(0, 0, w2, h2); } });
    var oilMat = new THREE.MeshBasicMaterial({ map: oilTex, transparent: true, depthWrite: false }); oilMat.userData.noBake = true; plane(3.2, 3.2, oilMat, -3.2, 0.0046, -38.5, -Math.PI / 2); plane(2.4, 2.4, oilMat, 7.0, 0.0046, -40.5, -Math.PI / 2);
    box(wx - 3, 0.02, 0.3, std({ color: 0x2c2e31, roughness: 0.6, metalness: 0.5 }), cx, 0.012, -30.5); for (var dg = W.x0 + 2; dg < W.x1 - 1.5; dg += 0.5) box(0.4, 0.012, 0.025, MAT.black, dg, 0.03, -30.5); plane(wx - 3, 0.9, oilMat, cx, 0.0047, -30.5, -Math.PI / 2);
    [[-4, -37, 3.2, 5.4], [-9.5, -37, 2.8, 3.0]].forEach(function (q) { [[q[0], q[1] - q[3] / 2, q[2], 0.1], [q[0], q[1] + q[3] / 2, q[2], 0.1]].forEach(function (l) { plane(l[2], l[3], MAT.hazard, l[0], 0.0065, l[1], -Math.PI / 2); }); [[q[0] - q[2] / 2, q[1]], [q[0] + q[2] / 2, q[1]]].forEach(function (l) { plane(0.1, q[3], MAT.hazard, l[0], 0.0065, l[1], -Math.PI / 2).rotation.z = 0; }); });
    plane(1.2, 0.35, MAT.whiteLine, (W.door.x0 + W.door.x1) / 2, 0.0066, W.z1 + 0.5, -Math.PI / 2); for (var cw = W.door.x0 + 0.3; cw < W.door.x1; cw += 0.7) plane(0.35, 1.6, MAT.whiteLine, cw, 0.0066, W.z1, -Math.PI / 2);
    // the doorway: bollards both sides, a convex traffic mirror, a PPE sign
    [W.door.x0 - 0.6, W.door.x1 + 0.6].forEach(function (bx) { [W.z1 - 0.9, W.z1 + 0.9].forEach(function (bz) { cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, null, 10); cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, null, 10); }); });
    // the convex traffic mirror: a bracket off the wall above the doorway on the wing side, the dome on its end, tilted down the doorway
    var mx = W.door.x1 + 1.0, my = 3.3; box(0.14, 0.14, 0.04, MAT.steelDark, mx, my, W.z1 - 0.17); box(0.05, 0.05, 0.55, MAT.steelDark, mx, my, W.z1 - 0.44); var mring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 24), MAT_MACH.guard); mring.position.set(mx, my, W.z1 - 0.72); scene.add(mring); var mir = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.05, metalness: 1.0 })); mir.position.set(mx, my, W.z1 - 0.72); mir.rotation.x = -Math.PI / 2 - 0.35; mir.rotation.order = 'YXZ'; mir.rotation.y = -0.5; scene.add(mir);
    // the finished-goods square in the hall beside the palletiser, and the outside: gutters and downpipes on the wing
    [[-1.0, -22.3, 3.4, 0.08], [-1.0, -16.7, 3.4, 0.08]].forEach(function (l) { plane(l[2], l[3], MAT.yellowLine, l[0], 0.0063, l[1], -Math.PI / 2); }); plane(0.08, 5.6, MAT.yellowLine, 0.7, 0.0063, -19.5, -Math.PI / 2); plane(0.08, 5.6, MAT.yellowLine, -2.7, 0.0063, -19.5, -Math.PI / 2);
    box(wx + 0.4, 0.16, 0.16, MAT.steelDark, cx, h - 0.05, W.z0 - 0.25); [W.x0 + 1, W.x1 - 1].forEach(function (dx) { cyl(0.07, h + 1.1, MAT.steelDark, dx, (h - 1.2) / 2 + 0.05, W.z0 - 0.25, null, 8); }); box(0.16, 0.16, wz, MAT.steelDark, W.x0 - 0.25, h - 0.05, cz); cyl(0.07, h + 1.1, MAT.steelDark, W.x0 - 0.25, (h - 1.2) / 2 + 0.05, W.z0 + 2, null, 8);
    for (var vx = W.x0 + 3; vx < W.x1 - 1; vx += 6) { cyl(0.45, 0.6, MAT.steel, vx, h + 0.6, -40, null, 12); cyl(0.6, 0.15, MAT.steelDark, vx, h + 0.95, -40, null, 12); }
  }
  // ── Shared machine parts ──────────────────────────────────────────
  var MAT_MACH = { frame: std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), panel: std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), guard: std({ color: 0xf5b53d, roughness: 0.5, metalness: 0.3 }), blue: std({ color: 0x2f5f9e, roughness: 0.45, metalness: 0.4 }), roller: std({ color: 0x8d9298, roughness: 0.3, metalness: 0.8 }), rubber: std({ color: 0x1c1e22, roughness: 0.95 }) };
  var beltTexBase = tex(64, 64, function (c, w, h) { c.fillStyle = '#23262a'; c.fillRect(0, 0, w, h); c.fillStyle = '#2c3035'; for (var i = 0; i < 8; i++) c.fillRect(0, i * 8, w, 3); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 28, w, 4); grain(c, w, h, 300, 0.08); }, 1, 1);
  function lampStack(c, x, y, z) {
    c.cyl(0.02, 0.5, MAT_MACH.frame, x, y + 0.25, z, 6); var g = c.cyl(0.05, 0.08, glowMat(0x5fd38d, 1.4), x, y + 0.56, z, 10), a = c.cyl(0.05, 0.08, glowMat(0xf5b53d, 1.4), x, y + 0.65, z, 10), r = c.cyl(0.05, 0.08, glowMat(0xff3b2f, 1.4), x, y + 0.74, z, 10); c.cyl(0.055, 0.03, MAT.black, x, y + 0.8, z, 10);
    g.visible = false; a.visible = true; r.visible = false; return { g: g, a: a, r: r };
  }
  // a straight belt along local +z from z0 to z1 at x: frame, legs, rollers, a scrolling belt top, guide rails and a drive motor
  function conveyorBuild(c, x, z0, z1, opt) {
    opt = opt || {}; var len = z1 - z0, zc = (z0 + z1) / 2, y = BELT_Y, FR = MAT_MACH.frame, LG = std({ color: 0xcfd4d9, roughness: 0.45, metalness: 0.3 });
    // side frames: a channel profile (web plus top and bottom flanges) with a painted top lip
    [-0.36, 0.36].forEach(function (sx) { c.box(0.04, 0.16, len, LG, x + sx, y - 0.06, zc); c.box(0.1, 0.02, len, LG, x + sx + (sx < 0 ? 0.03 : -0.03), y + 0.02, zc); c.box(0.1, 0.02, len, LG, x + sx + (sx < 0 ? 0.03 : -0.03), y - 0.14, zc); c.box(0.05, 0.02, len, MAT_MACH.blue, x + sx, y + 0.035, zc); });
    for (var cb = z0 + 0.6; cb < z1; cb += 1.2) c.box(0.68, 0.04, 0.05, FR, x, y - 0.13, cb);                                               // cross stays under the bed
    // rollers under the belt, end drums, the belt itself
    for (var rz = z0 + 0.18; rz < z1 - 0.1; rz += 0.3) { var r = c.cyl(0.03, 0.66, MAT_MACH.roller, x, y - 0.02, rz, 10); r.rotation.z = Math.PI / 2; }
    [z0 + 0.06, z1 - 0.06].forEach(function (dz) { var dr = c.cyl(0.07, 0.68, MAT_MACH.roller, x, y - 0.03, dz, 14); dr.rotation.z = Math.PI / 2; });
    var bt = beltTexBase.clone(); bt.needsUpdate = true; bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, len / 0.5); var bm = std({ map: bt, roughness: 0.9 }); bm.userData.noBake = true;
    var top = c.plane(0.62, len - 0.04, bm, x, y + 0.025, zc, -Math.PI / 2, 0); top.userData.speedKey = c.group.userData.propId; BELT_PLANES.push(top); c.box(0.62, 0.012, len - 0.04, std({ color: 0x1c1f23, roughness: 0.95 }), x, y - 0.09, zc);   // the return run underneath
    // guide rails on brackets, not floating
    [-0.32, 0.32].forEach(function (gx) { c.box(0.03, 0.04, len - 0.1, MAT_MACH.guard, x + gx, y + 0.14, zc); for (var gz = z0 + 0.3; gz < z1; gz += 1.2) { c.box(0.03, 0.14, 0.03, FR, x + gx, y + 0.08, gz); c.box(0.08, 0.02, 0.03, FR, x + gx + (gx < 0 ? 0.03 : -0.03), y + 0.04, gz); } });
    // the drive: motor and gearbox hung off the far drum, a guard over the chain (one per run, not one per short segment of a curve)
    if (!opt.noMotor) { var mt = c.cyl(0.085, 0.26, MAT_MACH.blue, x + 0.5, y - 0.1, z1 - 0.2, 14); mt.rotation.z = Math.PI / 2; c.cyl(0.095, 0.02, MAT.black, x + 0.64, y - 0.1, z1 - 0.2, 14).rotation.z = Math.PI / 2; c.box(0.12, 0.16, 0.16, FR, x + 0.43, y - 0.1, z1 - 0.2); c.box(0.06, 0.26, 0.2, FR, x + 0.4, y - 0.05, z1 - 0.1); c.box(0.03, 0.02, 0.4, MAT.black, x + 0.43, y - 0.2, z1 - 0.4); }
    if (!opt.noLegs) for (var lz = z0 + 0.4; lz < z1; lz += 1.5) { [-0.3, 0.3].forEach(function (lx) { c.box(0.06, y - 0.14, 0.06, FR, x + lx, (y - 0.14) / 2, lz); c.box(0.14, 0.02, 0.14, FR, x + lx, 0.01, lz); c.cyl(0.02, 0.04, MAT.chrome, x + lx, 0.03, lz, 6); }); c.box(0.66, 0.05, 0.05, FR, x, 0.2, lz); var dg = c.box(0.04, Math.hypot(0.6, y - 0.4), 0.04, FR, x, (y - 0.14) / 2 + 0.05, lz); dg.rotation.z = Math.atan2(0.6, y - 0.4); }
    if (!opt.noEye) { c.box(0.03, 0.4, 0.03, FR, x - 0.42, y + 0.2, z1 - 0.3); c.box(0.05, 0.06, 0.04, MAT.black, x - 0.42, y + 0.32, z1 - 0.3); c.box(0.02, 0.02, 0.005, glowMat(0xff3b2f, 1.2), x - 0.395, y + 0.32, z1 - 0.3); c.box(0.03, 0.3, 0.03, FR, x + 0.42, y + 0.15, z1 - 0.3); c.box(0.03, 0.03, 0.02, MAT.white, x + 0.42, y + 0.32, z1 - 0.3); }
    c.box(0.04, 0.03, len - 0.6, MAT.black, x - 0.4, y - 0.18, zc); for (var cz = z0 + 0.5; cz < z1; cz += 2) c.box(0.06, 0.08, 0.04, FR, x - 0.4, y - 0.18, cz);   // the cable run
    c.solid(x - 0.4, x + 0.4, z0, z1, 0, 0.82);
  }  function conveyorPath(c, pts) {
    for (var i = 1; i < pts.length; i++) {
      var ax = pts[i - 1][0], az = pts[i - 1][1], ay = pts[i - 1][2] || 0, bx = pts[i][0], bz = pts[i][1], by = pts[i][2] || 0, run = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az), slope = Math.atan2(by - ay, run), len = Math.hypot(run, by - ay);
      var sg = new THREE.Group(); sg.position.set(ax, ay, az); sg.rotation.order = 'YXZ'; sg.rotation.y = ang; sg.rotation.x = -slope; sg.userData.propId = c.group.userData.propId; c.group.add(sg);   // the segments scroll with the prop's dial
      var sc = propCtx(sg, 'seg'); conveyorBuild(sc, 0, 0, len, { noEye: i < pts.length - 1, noLegs: true, noMotor: i < pts.length - 1 });
      // legs in the prop frame, the right height wherever the belt is, braced when tall; a curve's short segments share a leg every third one
      var ux = (bx - ax) / run, uz = (bz - az) / run, px = uz, pz = -ux;
      var hang = pts[i][3] === 'hang', spiral = pts[i][3] === 'spiral';   // a spiral segment hangs off the spiral's own column and guard: no legs, no hangers, no solid of its own
      if (spiral) { } else if (hang) { for (var hd = 0.6; hd < run; hd += 2.5) { var ht = BELT_Y + ay + (by - ay) * hd / run + 0.05, hx = ax + ux * hd, hz = az + uz * hd; [-0.3, 0.3].forEach(function (o) { c.cyl(0.025, HALL.h - 0.2 - ht, MAT_MACH.frame, hx + px * o, (HALL.h - 0.2 + ht) / 2, hz + pz * o, 6); }); var hb = c.box(0.8, 0.06, 0.06, MAT_MACH.frame, hx, ht, hz); hb.rotation.y = ang; var hp = c.box(0.9, 0.05, 0.3, MAT_MACH.frame, hx, HALL.h - 0.2, hz); hp.rotation.y = ang; } }
      else for (var d = run < 1 ? (i % 3 === 1 ? run / 2 : run + 1) : 0.5; d < run; d += 1.5) { var top = BELT_Y + ay + (by - ay) * d / run - 0.1, lx = ax + ux * d, lz = az + uz * d; [-0.3, 0.3].forEach(function (o) { c.box(0.06, top, 0.06, MAT_MACH.frame, lx + px * o, top / 2, lz + pz * o); c.box(0.14, 0.02, 0.14, MAT_MACH.frame, lx + px * o, 0.01, lz + pz * o); if (Math.min(ay, by) > 1.2) c.solid(lx + px * o - 0.1, lx + px * o + 0.1, lz + pz * o - 0.1, lz + pz * o + 0.1, 0, top); }); var cb = c.box(0.66, 0.05, 0.05, MAT_MACH.frame, lx, top - 0.02, lz); cb.rotation.y = ang; if (top > 1.5) { var br = c.box(0.66, 0.05, 0.05, MAT_MACH.frame, lx, top * 0.5, lz); br.rotation.y = ang; var dg = c.box(0.04, top * 0.95, 0.04, MAT_MACH.frame, lx, top / 2, lz); dg.rotation.order = 'YXZ'; dg.rotation.y = ang; dg.rotation.z = Math.atan2(0.6, top); } }
      // the solid: a level belt on the deck is a floor belt up there (solid from the deck to a metre up, so a step-over clears it); a high run carries only
      // a band round the belt; a slope is cut into metre-long pieces, each at its own height, so you can walk under the high end of an incline
      var lo = Math.min(ay, by), onDeck = Math.abs(lo - UPPER.y) < 0.25 && Math.abs(ay - by) < 0.25;
      if (!spiral) { var nch = Math.abs(ay - by) > 0.3 ? Math.max(1, Math.ceil(run / 1.0)) : 1; for (var ch = 0; ch < nch; ch++) { var t0 = ch / nch, t1 = (ch + 1) / nch, cy = Math.min(ay + (by - ay) * t0, ay + (by - ay) * t1), cx0 = ax + (bx - ax) * t0, cx1 = ax + (bx - ax) * t1, cz0 = az + (bz - az) * t0, cz1 = az + (bz - az) * t1, chigh = cy > 1.2, clow = BELT_Y + cy - 0.15; c.solid(Math.min(cx0, cx1) - 0.4, Math.max(cx0, cx1) + 0.4, Math.min(cz0, cz1) - 0.4, Math.max(cz0, cz1) + 0.4, onDeck ? cy : chigh ? clow : 0, onDeck ? cy + 0.9 : chigh ? clow + 1.2 : 0.82); } }
    }
  }  function shipBeltBuild(c) { conveyorPath(c, [[0, 0], [0, 0.5], [2.6, 0.5], [2.6, -15.3], [0.4, -15.3], [0.4, -17.1]]); c.sign(['TO THE OUT 2 BAY'], 0.8, 0.14, 2.6, 1.05, 4, Math.PI / 2, { w: 320, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
  // the dock loader: a fixed belt section that takes parcels off a belt end, and a boom that pushes them into the trailer when a truck
  // is docked with the door up. mirror: the inlet faces north instead of south (OUT 1's stands under the deck edge, fed from the north)
  function dockLoaderBuildFor(id, label, mirror) { return function (c) {
    var m = mirror ? -1 : 1, Z = function (z) { return z * m; }, door = LOADER_DOORS[id];
    var LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), DG = MAT_MACH.frame, BL = MAT_MACH.blue;
    var rbx = function (w, h, d, r, mat, x, y, z, parent) { var mm = new THREE.Mesh(bevelGeo(w, h, d, r), mat); mm.position.set(x, y, z); mm.castShadow = true; (parent || c.group).add(mm); return mm; };
    rbx(1.6, 0.26, 2.2, 0.03, DG, -0.2, 0.13, Z(0.6)); [[-0.9, -0.4], [0.5, -0.4], [-0.9, 1.6], [0.5, 1.6]].forEach(function (p) { c.cyl(0.07, 0.04, DG, p[0], 0.02, Z(p[1]), 10); c.box(0.12, 0.3, 0.12, DG, p[0], 0.3, Z(p[1])); });
    [-0.46, 0.26].forEach(function (sx) { c.box(0.04, 0.16, 1.9, LG, sx, BELT_Y - 0.06, Z(0.75)); c.box(0.05, 0.02, 1.9, BL, sx, BELT_Y + 0.035, Z(0.75)); });
    for (var rz = -0.1; rz < 1.6; rz += 0.3) { var r = c.cyl(0.03, 0.68, MAT_MACH.roller, -0.1, BELT_Y - 0.02, Z(rz), 10); r.rotation.z = Math.PI / 2; }
    var bt = beltTexBase.clone(); bt.needsUpdate = true; bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, 3.8); var bm = std({ map: bt, roughness: 0.9 }); bm.userData.noBake = true; var top = c.plane(0.62, 1.86, bm, -0.1, BELT_Y + 0.025, Z(0.75), -Math.PI / 2, m > 0 ? 0 : Math.PI); top.userData.speedKey = c.group.userData.propId; BELT_PLANES.push(top);
    [-0.42, 0.22].forEach(function (gx) { c.box(0.03, 0.04, 1.8, MAT_MACH.guard, gx, BELT_Y + 0.14, Z(0.75)); [0.0, 0.8, 1.5].forEach(function (gz) { c.box(0.03, 0.14, 0.03, DG, gx, BELT_Y + 0.08, Z(gz)); }); });
    [[-0.1, -0.1], [-0.1, 0.9]].forEach(function (p) { c.box(0.14, 1.9, 0.14, BL, 0.55, 0.95, Z(p[1])); }); c.box(0.16, 0.16, 1.2, BL, 0.55, 1.9, Z(0.4)); c.cyl(0.1, 0.9, DG, 0.55, 1.1, Z(0.4), 12).rotation.x = Math.PI / 2;
    var cylm = c.cyl(0.06, 1.0, MAT.chrome, 1.0, 0.5, Z(0.4), 10); cylm.rotation.z = -0.9; var cylb = c.cyl(0.08, 0.6, DG, 0.75, 0.3, Z(0.4), 10); cylb.rotation.z = -0.9;
    var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
    var boom = new THREE.Group(); boom.position.set(0.9, BELT_Y + 0.02, Z(0.4)); dyn.add(boom);
    box(1.6, 0.16, 0.76, LG, 0, 0, 0, boom); box(1.6, 0.03, 0.62, std({ color: 0x2c3035, roughness: 0.9 }), 0, 0.1, 0, boom); box(1.6, 0.05, 0.03, MAT_MACH.guard, 0, 0.16, 0.34, boom); box(1.6, 0.05, 0.03, MAT_MACH.guard, 0, 0.16, -0.34, boom);
    for (var bk = -0.6; bk <= 0.6; bk += 0.3) cyl(0.03, 0.62, MAT_MACH.roller, bk, 0.09, 0, boom, 8).rotation.x = Math.PI / 2;
    cyl(0.06, 0.66, MAT.rubber, 0.82, 0.02, 0, boom, 10).rotation.x = Math.PI / 2; box(0.12, 0.12, 0.8, MAT.yellow, 0.86, -0.08, 0, boom); box(0.14, 0.04, 0.8, MAT.black, 0.86, 0.0, 0, boom);
    box(1.4, 0.06, 0.1, DG, 0, -0.1, 0.42, boom); box(1.4, 0.06, 0.1, DG, 0, -0.1, -0.42, boom); box(0.3, 0.1, 0.5, DG, -0.6, -0.14, 0, boom);
    var pusher = box(0.08, 0.34, 0.56, BL, 0.2, 0.3, 0, boom); box(0.4, 0.05, 0.05, MAT.chrome, 0.0, 0.3, 0, boom); box(0.1, 0.1, 0.1, DG, -0.2, 0.3, 0, boom);
    c.box(0.08, 0.08, 0.08, DG, 0.55, 2.0, Z(0.4)); c.box(0.6, 0.08, 0.3, DG, 0.85, 2.05, Z(0.4)); c.box(0.5, 0.05, 0.22, MAT.lamp, 0.9, 1.99, Z(0.4));
    rbx(0.5, 1.3, 0.4, 0.03, LG, -1.1, 0.7, Z(1.6)); c.box(0.52, 0.16, 0.42, DG, -1.1, 0.08, Z(1.6)); var scr = touchScreen({ w: 300, h: 200, pw: 0.38, ph: 0.25, x: -1.1, y: 1.15, z: Z(1.81), ry: m > 0 ? 0 : Math.PI, parent: c.group, title: 'Dock loader ' + label, draw: function (cc, sc) { scBg(cc, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(cc, sc.w, 'DOCK LOADER ' + label, dockLoaderStatus(door).toUpperCase()); scText(cc, 16, 70, dockLoaderPrompt(door).split(' · ').slice(1, 2).join(''), '#eef1f5', 13); scText(cc, 16, 100, (dockLane(door) ? dockLane(door).name.toUpperCase() + ' lane · ' : '') + (S.stats.autoLoaded || 0) + ' loaded by machine', '#a0acb8', 12); speedButton(sc, 16, 150, 130, S.up.sorter ? 'sorter' : 'shipBelt', 'BELT'); } }); scr.mesh.userData.propId = id;
    eStop(c, -1.1, 0.6, Z(1.81)); MACH[id].lamps = lampStack(c, -1.1, 1.4, Z(1.6)); c.box(0.04, 1.1, 0.04, MAT.black, -1.3, 0.55, Z(1.4));
    [-0.2, 1.0].forEach(function (lz) { c.box(0.06, 1.7, 0.06, MAT.yellow, 1.55, 0.85, Z(lz)); c.box(0.02, 1.5, 0.02, glowMat(0xff3b2f, 0.6), 1.59, 0.85, Z(lz)); c.box(0.14, 0.03, 0.14, DG, 1.55, 0.015, Z(lz)); });
    c.sign(['DOCK LOADER', 'KEEP CLEAR OF THE BOOM'], 1.2, 0.24, -0.2, 1.0, Z(-0.56), m > 0 ? Math.PI : 0, { w: 512, h: 100, bg: '#1b232c', fg: '#eef1f5' }); c.sign([label + ' · AUTO' + (dockLane(door) ? ' · ' + dockLane(door).name.toUpperCase() : '')], 0.8, 0.14, 0.55, 2.12, Z(0.4), m > 0 ? 0 : Math.PI, { w: 320, h: 64, bg: '#1b232c', fg: dockLane(door) ? dockLane(door).col : '#5fd38d' });
    MACH[id].anim = { boom: boom, pusher: pusher, pushT: 0, ext: 0 };
    c.hit(2.0, 2.0, 2.4, 0, 1.0, Z(0.6), { prompt: function () { return dockLoaderPrompt(door); }, use: function () { sfx('click'); } });
    c.solid(-1.4, 0.7, Z(-0.5), Z(1.8), 0, 2.1);
  }; }
  var dockLoaderBuild = dockLoaderBuildFor('dockLoader2', 'OUT 2', false);
  function gantryBuild(r) { return function (c) {
    var DG = MAT_MACH.frame, YL = std({ color: 0xf5b53d, roughness: 0.5, metalness: 0.3 }), LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), GT = gantryTop(r), GD = GT - 5.0;   // GT: rail height; the upper crane is two metres lower
    // end columns stand clear of the racking at the row ends; the mid columns stand tight against the rack faces, out of the aisles
    // the east pair stands at 47.2, past the overhead pick belt that runs along the row ends at 46
    // every column stands tight against the rack face and reaches the rails on an outrigger, so nothing stands in the aisle
    [-0.4, 47.2].forEach(function (cx) { [-0.78, 0.78].forEach(function (cz) { c.box(0.26, 5.4 + GD, 0.26, YL, cx, 2.7 + GD / 2, cz); c.box(0.5, 0.03, 0.5, DG, cx, 0.015, cz); c.box(0.26, 0.2, 1.0, DG, cx, 5.45 + GD, cz * 1.5); c.box(0.3, 0.3, 0.3, DG, cx, 5.5 + GD, cz); }); c.box(0.2, 0.2, 3.5, DG, cx, 5.55 + GD, 0); });
    for (var cx = 7.67; cx < 46; cx += 7.67) { [-0.78, 0.78].forEach(function (cz) { c.box(0.2, 5.4 + GD, 0.2, YL, cx, 2.7 + GD / 2, cz); c.box(0.4, 0.03, 0.4, DG, cx, 0.015, cz); var ob = c.box(0.2, 0.2, 0.9, DG, cx, 5.45 + GD, cz * 1.5); }); c.box(0.2, 0.2, 3.5, DG, cx, 5.55 + GD, 0); }
    [-1.6, 1.6].forEach(function (rz) { c.box(48.2, 0.18, 0.2, DG, 23.4, 5.4 + GD, rz); c.box(48.2, 0.04, 0.06, MAT.chrome, 23.4, 5.5 + GD, rz); });
    var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
    var trolley = new THREE.Group(); trolley.position.set(46, GT, 0); dyn.add(trolley);
    box(1.0, 0.3, 3.6, YL, 0, 0.55, 0, trolley); box(1.1, 0.12, 0.5, DG, 0, 0.6, -1.6, trolley); box(1.1, 0.12, 0.5, DG, 0, 0.6, 1.6, trolley); [-0.4, 0.4].forEach(function (wx) { [-1.6, 1.6].forEach(function (wz) { cyl(0.1, 0.08, MAT.black, wx, 0.6, wz, trolley, 12).rotation.z = Math.PI / 2; }); });
    box(0.7, 0.5, 0.7, LG, 0, 0.95, 0, trolley); box(0.3, 0.3, 0.3, MAT_MACH.blue, 0.5, 0.95, 0, trolley); var beacon = cyl(0.05, 0.12, glowMat(0xffd060, 2.5), 0, 1.3, 0, trolley, 10); box(0.02, 0.1, 0.06, MAT.black, 0.03, 1.3, 0, beacon);
    var mast = box(0.28, GT - 1.0, 0.28, LG, 0, -(GT - 1.0) / 2, 0, trolley); mast.scale.y = 0.05; mast.position.y = 0;   // scaled from the trolley down to the gripper
    var grip = new THREE.Group(); grip.position.set(0, 0, 0); trolley.add(grip); box(0.5, 0.15, 0.5, DG, 0, 0.3, 0, grip); box(0.7, 0.06, 0.7, MAT.black, 0, 0.2, 0, grip); [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(function (s) { cyl(0.07, 0.06, MAT_MACH.rubber, s[0], 0.15, s[1], grip, 10); });
    var bx = new THREE.Mesh(BOX_GEO, CARD[SKUS[0].id]); bx.position.set(0, -0.05, 0); bx.visible = false; grip.add(bx);
    c.sign(['GANTRY PICKER · ROW ' + 'ABCDEF'[r], 'AUTOMATIC · KEEP CLEAR'], 2.0, 0.4, 44.5, 5.9 + GD, 1.75, 0, { w: 512, h: 100, bg: '#1b232c', fg: '#f5b53d' });
    // the control cabinet hangs off the south end column (at z -0.78) on two brackets; screen and e-stop face the aisle
    c.box(0.5, 1.0, 0.3, LG, 47.2, 1.4, -1.25); c.box(0.08, 0.3, 0.2, DG, 47.2, 1.1, -1.0); c.box(0.08, 0.3, 0.2, DG, 47.2, 1.75, -1.0); eStop(c, 47.2, 1.2, -1.41); MACH['gantry' + r].lamps = lampStack(c, 47.2, 1.9, -1.25);
    c.box(0.42, 0.3, 0.02, DG, 47.2, 1.6, -1.405); var gsc = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 47.2, y: 1.6, z: -1.418, ry: Math.PI, parent: c.group, title: 'Gantry ' + 'ABCDEF'[r], draw: gantryScreenDraw(r) }); gsc.mesh.userData.propId = 'gantry' + r; MACH['gantry' + r].screen = gsc;
    MACH['gantry' + r].anim = { trolley: trolley, mast: mast, grip: grip, box: bx, beacon: beacon };
    c.hit(0.5, 1.0, 0.3, 47.2, 1.4, -1.25, { prompt: function () { return gantryPrompt(r); }, use: function () { sfx('click'); } });
    [-0.4, 47.2].forEach(function (sx) { c.solid(sx - 0.15, sx + 0.15, -0.93, -0.63, 0, 5.5 + GD); c.solid(sx - 0.15, sx + 0.15, 0.63, 0.93, 0, 5.5 + GD); }); for (var sx2 = 7.67; sx2 < 46; sx2 += 7.67) { c.solid(sx2 - 0.12, sx2 + 0.12, -0.9, -0.66, 0, 5.5 + GD); c.solid(sx2 - 0.12, sx2 + 0.12, 0.66, 0.9, 0, 5.5 + GD); }
  }; }
  function pickBeltBuild(c) { conveyorPath(c, BELTS.pickBelt.path); c.sign(['TO THE BENCH'], 0.7, 0.14, 0, BELT_Y + 2.4 + 0.3, 8, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
  function pickMergeBuild(c) { conveyorPath(c, BELTS.pickMerge.path); c.sign(['TO THE BENCH'], 0.7, 0.14, 2.0, BELT_Y + 2.4 + 0.3, 0.45, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
  function pickBelt2Build(c) { conveyorPath(c, BELTS.pickBelt2.path); c.sign(['TO THE BENCH'], 0.7, 0.14, 0, BELT_Y + 2.4 + 0.3, -4, -Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }
  function agvDockBuild(c) {
    var DG = MAT_MACH.frame; c.box(1.2, 0.012, 1.8, MAT.hazard, 0, 0.006, 0); c.box(0.5, 0.9, 0.3, std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), 0, 0.45, -1.0); c.box(0.52, 0.06, 0.32, DG, 0, 0.03, -1.0); c.box(0.3, 0.08, 0.04, MAT.chrome, 0, 0.35, -0.83); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), -0.2, 0.76, -0.84); agvScreen = touchScreen({ w: 300, h: 200, pw: 0.33, ph: 0.22, x: 0, y: 0.57, z: -0.845, ry: 0, parent: c.group, title: 'AGV dock', draw: agvScreenDraw }); agvScreen.mesh.userData.propId = 'agvDock';
    c.sign(['AGV DOCK'], 0.5, 0.12, 0, 0.82, -0.84, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#f5b53d' });
    [[-1.0, 1.6], [1.0, 1.6], [-1.0, 3.6], [1.0, 3.6]].forEach(function (p) { c.cyl(0.04, 0.5, MAT.yellow, p[0], 0.25, p[1], 8); });
    [[0, 1.6, 2.0, 0.08], [0, 3.6, 2.0, 0.08]].forEach(function (l) { c.plane(l[2], l[3], MAT.yellowLine, l[0], 0.0065, l[1], -Math.PI / 2); }); c.plane(0.08, 2.0, MAT.yellowLine, -1.0, 0.0065, 2.6, -Math.PI / 2); c.plane(0.08, 2.0, MAT.yellowLine, 1.0, 0.0065, 2.6, -Math.PI / 2);
    var fs2 = c.sign(['AGV PICKUP', 'set a pallet here'], 1.6, 0.5, 0, 0.0068, 2.6, 0, { w: 512, h: 160, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }); fs2.rotation.x = -Math.PI / 2;
    c.hit(0.5, 0.9, 0.3, 0, 0.45, -1.0, { prompt: function () { return agvPrompt(); }, use: function () { sfx('click'); } });
    c.solid(-0.3, 0.3, -1.2, -0.85, 0, 1.0);
  }
  function eStop(c, x, y, z) { c.box(0.12, 0.12, 0.03, MAT.yellow, x, y, z); c.cyl(0.035, 0.04, MAT.red, x, y, z + 0.03, 12).rotation.x = Math.PI / 2; }
  function cabinet(c, x, y, z, w, h, d) { c.box(w, h, d, MAT_MACH.panel, x, y, z); c.box(w + 0.02, 0.05, d + 0.02, MAT_MACH.frame, x, y + h / 2, z); c.box(w - 0.1, h - 0.12, 0.01, std({ color: 0xcfd4d9, roughness: 0.5 }), x, y, z + d / 2 + 0.004); c.box(0.025, 0.08, 0.02, MAT.chrome, x + w / 2 - 0.08, y, z + d / 2 + 0.015); }
  // ── The pack line prop: infeed belt, the case taper, outfeed belt, the gravity shelf
  function packLineBuild(c) {
    var LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), DG = MAT_MACH.frame, BL = MAT_MACH.blue;
    var rbx = function (w, h, d, r, mat, x, y, z) { var mm = new THREE.Mesh(bevelGeo(w, h, d, r), mat); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; c.group.add(mm); return mm; };
    conveyorBuild(c, 0, 0, 2.0, { noEye: true });
    // the taper body on four legs: lower skirt, louvred side panels, a top housing with a window onto the tape head, service doors
    [[-0.6, 2.15], [0.6, 2.15], [-0.6, 3.65], [0.6, 3.65]].forEach(function (p) { c.box(0.1, 0.7, 0.1, DG, p[0], 0.35, p[1]); c.box(0.2, 0.03, 0.2, DG, p[0], 0.015, p[1]); });
    rbx(1.4, 0.16, 1.8, 0.02, DG, 0, 0.78, 2.9); rbx(1.4, 1.0, 1.8, 0.04, LG, 0, 1.36, 2.9); c.box(1.42, 0.04, 1.82, MAT.hazard, 0, 0.88, 2.9);
    [-0.71, 0.71].forEach(function (sx) { for (var lv = 0; lv < 8; lv++) c.box(0.015, 0.03, 1.3, DG, sx, 1.0 + lv * 0.08, 2.9); c.box(0.02, 0.5, 0.5, std({ color: 0xcfd4d9, roughness: 0.5 }), sx, 1.3, 2.3); c.box(0.03, 0.08, 0.02, MAT.chrome, sx + (sx < 0 ? -0.01 : 0.01), 1.3, 2.5); });
    c.box(0.9, 0.7, 0.1, MAT.black, 0, 1.2, 2.02); c.box(0.9, 0.7, 0.1, MAT.black, 0, 1.2, 3.78); var flap = c.box(0.86, 0.3, 0.02, std({ color: 0xd8dde3, roughness: 0.4, transparent: true, opacity: 0.6 }), 0, 1.4, 3.8); flap.rotation.x = -0.6; flap.userData.noBake = true;
    for (var rz = 2.1; rz < 3.7; rz += 0.2) { var r = c.cyl(0.035, 0.84, MAT_MACH.roller, 0, BELT_Y - 0.02, rz, 10); r.rotation.z = Math.PI / 2; }
    [-0.4, 0.4].forEach(function (x) { c.box(0.04, 0.28, 1.5, MAT_MACH.rubber, x, BELT_Y + 0.2, 2.9); });
    rbx(1.0, 0.5, 1.2, 0.05, LG, 0, 2.1, 2.9); c.box(1.04, 0.04, 1.24, DG, 0, 1.88, 2.9); c.plane(0.7, 0.3, std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.4 }), 0.0, 2.15, 3.51, 0, 0); c.box(0.74, 0.34, 0.02, DG, 0, 2.15, 3.5);
    c.box(0.36, 0.42, 0.5, DG, 0, 1.62, 2.9); var roll = c.cyl(0.16, 0.08, MAT.white, 0, 1.72, 3.15, 16); roll.rotation.z = Math.PI / 2; c.cyl(0.03, 0.14, MAT.chrome, 0, 1.72, 3.15, 8).rotation.z = Math.PI / 2; var pr = c.cyl(0.04, 0.3, MAT_MACH.rubber, 0, 1.45, 2.62, 10); pr.rotation.z = Math.PI / 2;
    c.box(0.3, 0.02, 0.4, MAT_MACH.guard, -0.42, BELT_Y + 0.5, 2.1).rotation.z = 0.5; c.box(0.3, 0.02, 0.4, MAT_MACH.guard, 0.42, BELT_Y + 0.5, 2.1).rotation.z = -0.5;
    c.box(0.3, 0.2, 0.24, LG, 0.5, 1.12, 3.74); c.box(0.22, 0.01, 0.03, MAT.paper, 0.5, 1.04, 3.88); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), 0.62, 1.2, 3.86);
    c.sign(['CASE TAPER 400', 'KEEP HANDS CLEAR OF THE INFEED'], 1.0, 0.2, 0, 1.6, 2.0, 0, { w: 512, h: 100, bg: '#1b232c', fg: '#eef1f5' }); c.sign(['DEPOT CO. PACK LINE 1'], 1.2, 0.14, -0.72, 1.7, 2.9, -Math.PI / 2, { w: 512, h: 60, bg: '#1b232c', fg: '#f5b53d' });
    // the cabinet on a pedestal, cable trunking back to the machine
    rbx(0.5, 1.2, 0.45, 0.03, LG, 1.05, 1.0, 2.9); c.box(0.52, 0.3, 0.47, DG, 1.05, 0.25, 2.9); c.box(0.05, 0.05, 0.25, MAT.black, 0.78, 0.5, 2.9); var scr = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 1.05, y: 1.3, z: 3.135, ry: 0, parent: c.group, title: 'Pack line', draw: packScreenDraw }); scr.mesh.userData.propId = 'packline';
    eStop(c, 1.05, 0.85, 3.135); MACH.taper.lamps = lampStack(c, 1.05, 1.62, 2.9); c.cyl(0.02, 0.5, MAT.black, 1.2, 0.5, 2.7, 6);
    c.hit(1.6, 2.4, 1.9, 0.1, 1.2, 2.9, { prompt: function () { return packPrompt(); }, use: function () { packUse(); } });
    c.solid(-0.75, 1.35, 2.0, 3.8, 0, 2.5);
    conveyorBuild(c, 0, 3.8, 5.8, {});
    // the gravity shelf: a sloped roller bed on a frame with an end stop and a take-from-here plate
    for (var sz = 5.9; sz < 7.0; sz += 0.12) { var sr = c.cyl(0.025, 0.7, MAT_MACH.roller, 0, 0.66 - (sz - 5.9) * 0.06, sz, 8); sr.rotation.z = Math.PI / 2; }
    [-0.38, 0.38].forEach(function (x) { var rail = c.box(0.04, 0.1, 1.2, DG, x, 0.64, 6.45); rail.rotation.x = 0.06; c.box(0.05, 0.55, 0.05, DG, x, 0.28, 5.95); c.box(0.05, 0.5, 0.05, DG, x, 0.25, 6.95); c.box(0.12, 0.02, 0.12, DG, x, 0.01, 5.95); c.box(0.12, 0.02, 0.12, DG, x, 0.01, 6.95); }); c.box(0.8, 0.04, 0.04, DG, 0, 0.3, 5.95); c.box(0.8, 0.04, 0.04, DG, 0, 0.3, 6.95);
    c.box(0.8, 0.12, 0.03, MAT_MACH.guard, 0, 0.68, 7.02); c.sign(['PARCELS · TAKE FROM HERE'], 0.8, 0.12, 0, 0.5, 7.03, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#5fd38d' });
    c.solid(-0.45, 0.45, 5.8, 7.05, 0, 0.75);
  }  function shelfSlot(i) { var k = i % 8, up = i >= 8 ? 0.27 : 0; return { lx: k % 2 ? 0.2 : -0.2, lz: 6.05 + Math.floor(k / 2) * 0.26, y: 0.66 - Math.floor(k / 2) * 0.016 + 0.2 + up }; }   // twelve: eight on the rails, four more stacked on the back two rows
  // ── The moulding line prop: hopper throat, heated barrel, clamp with a moving platen between tie bars, cooling fan, control cabinet, outfeed belt
  function moulderBuild(c) {
    var LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), DG = std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), BL = MAT_MACH.blue, CH = MAT.chrome;
    var rbx = function (w, h, d, r, mat, x, y, z, parent) { var mm = new THREE.Mesh(bevelGeo(w, h, d, r), mat); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; (parent || c.group).add(mm); return mm; };
    var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
    // the base: a dark skirt on levelling feet, a light bevelled bed, a hazard band, the cable chain down the operator side
    rbx(1.6, 0.34, 4.9, 0.03, DG, 0, 0.17, -0.55); rbx(1.5, 0.56, 4.9, 0.05, LG, 0, 0.62, -0.55); c.box(1.52, 0.04, 4.92, MAT.hazard, 0, 0.36, -0.55);
    [[-0.65, -2.8], [0.65, -2.8], [-0.65, -0.3], [0.65, -0.3], [-0.65, 1.7], [0.65, 1.7]].forEach(function (p) { c.cyl(0.08, 0.06, DG, p[0], 0.03, p[1], 10); c.cyl(0.03, 0.1, CH, p[0], 0.05, p[1], 8); });
    c.box(0.12, 0.08, 2.6, DG, 0.82, 0.95, 0.4); for (var cl = -0.8; cl < 1.6; cl += 0.16) c.box(0.14, 0.1, 0.03, MAT.black, 0.82, 0.95, cl);
    // the injection unit at the back: housing, loader hopper on the throat, the barrel in its slotted heater cover, the nozzle to the fixed platen
    rbx(1.2, 1.1, 1.7, 0.05, LG, 0, 1.45, -1.7); rbx(1.22, 0.3, 1.72, 0.03, BL, 0, 0.9, -1.7);
    c.cyl(0.14, 0.4, DG, 0, 2.2, -1.9, 12); c.cyl(0.32, 0.5, LG, 0, 2.6, -1.9, 16, 0.14); c.cyl(0.32, 0.5, LG, 0, 3.1, -1.9, 16); c.cyl(0.33, 0.04, DG, 0, 3.37, -1.9, 16); c.box(0.16, 0.14, 0.16, MAT.black, 0.25, 2.55, -1.9); c.cyl(0.04, 0.4, DG, 0.42, 2.8, -1.9, 8);
    c.box(0.26, 0.16, 0.3, DG, 0.5, 2.1, -1.5); var ib = c.cyl(0.18, 0.5, BL, 0, 1.3, -2.8, 14); ib.rotation.x = Math.PI / 2; c.cyl(0.2, 0.08, DG, 0, 1.3, -2.55, 14).rotation.x = Math.PI / 2;
    rbx(0.56, 0.56, 1.1, 0.06, LG, 0, 1.55, -0.3); for (var sl = -0.75; sl < 0.15; sl += 0.12) c.box(0.58, 0.03, 0.04, MAT.black, 0, 1.75, sl); for (var sl2 = -0.75; sl2 < 0.15; sl2 += 0.12) c.box(0.58, 0.03, 0.04, MAT.black, 0, 1.35, sl2);
    var nz = c.cyl(0.06, 0.4, CH, 0, 1.55, 0.35, 10); nz.rotation.x = Math.PI / 2; c.cyl(0.1, 0.1, DG, 0, 1.55, 0.25, 10).rotation.x = Math.PI / 2;
    // the clamp: fixed platen, four tie bars with nuts, the moving platen on the toggles, the rear platen and its cylinder
    rbx(1.5, 1.5, 0.25, 0.03, DG, 0, 1.3, 0.6);
    // the rear platen is an open frame standing on the floor: the finished part slides out through the opening onto the belt
    rbx(0.4, 2.05, 0.22, 0.03, DG, -0.55, 1.025, 2.5); rbx(0.4, 2.05, 0.22, 0.03, DG, 0.55, 1.025, 2.5); rbx(1.5, 0.4, 0.22, 0.03, DG, 0, 1.85, 2.5); c.box(0.5, 0.04, 0.5, DG, -0.55, 0.02, 2.5); c.box(0.5, 0.04, 0.5, DG, 0.55, 0.02, 2.5);
    c.box(0.74, 0.06, 0.06, MAT.hazard, 0, 1.62, 2.63); c.box(0.06, 1.62, 0.06, MAT.hazard, -0.38, 0.81, 2.63); c.box(0.06, 1.62, 0.06, MAT.hazard, 0.38, 0.81, 2.63); c.sign(['PARTS OUT'], 0.5, 0.12, 0, 1.72, 2.64, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' });
    c.cyl(0.14, 0.45, BL, 0, 1.85, 2.85, 14).rotation.x = Math.PI / 2; c.cyl(0.06, 0.4, CH, 0, 1.85, 3.05, 10).rotation.x = Math.PI / 2;
    [[-0.58, 0.72], [0.58, 0.72], [-0.58, 1.88], [0.58, 1.88]].forEach(function (t) { var tb = c.cyl(0.045, 2.2, CH, t[0], t[1], 1.55, 12); tb.rotation.x = Math.PI / 2; [0.42, 2.68].forEach(function (nz2) { c.cyl(0.09, 0.12, DG, t[0], t[1], nz2, 8).rotation.x = Math.PI / 2; }); });
    var ram = rbx(1.36, 1.36, 0.2, 0.03, DG, 0, 1.3, 1.25, dyn); rbx(0.64, 0.74, 0.16, 0.02, MAT_MACH.roller, 0, 0, -0.18, ram); c.box(0.06, 0.06, 0.06, MAT.black, 0, 0, 0, ram);
    rbx(0.64, 0.74, 0.16, 0.02, MAT_MACH.roller, 0, 1.3, 0.81); c.box(0.5, 0.06, 0.04, MAT.black, 0, 1.0, 0.9);
    [[-0.45, 1.0], [0.45, 1.0], [-0.45, 1.6], [0.45, 1.6]].forEach(function (l) { var lk = c.box(0.08, 0.06, 0.6, DG, l[0], l[1], 1.85, 0); lk.rotation.x = l[1] > 1.3 ? 0.5 : -0.5; var lk2 = c.box(0.08, 0.06, 0.6, DG, l[0], l[1], 2.15); lk2.rotation.x = l[1] > 1.3 ? -0.5 : 0.5; });
    c.cyl(0.05, 1.3, CH, 0, 1.3, 1.9, 8).rotation.z = Math.PI / 2;
    // the guards: a sliding gate with a window on the operator side, a fixed sheet with a window on the other, a top cover carrying the lamp stack
    var GL = std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    c.box(0.05, 1.7, 2.1, MAT_MACH.guard, 0.82, 1.35, 1.55); c.box(0.05, 1.7, 2.1, LG, 0.84, 1.35, 1.55); c.plane(1.3, 0.9, GL, 0.87, 1.45, 1.55, 0, Math.PI / 2); c.box(0.06, 0.08, 1.4, DG, 0.87, 0.95, 1.55); c.box(0.06, 0.08, 1.4, DG, 0.87, 1.95, 1.55); c.box(0.06, 1.0, 0.08, DG, 0.87, 1.45, 0.85); c.box(0.06, 1.0, 0.08, DG, 0.87, 1.45, 2.25); c.box(0.08, 0.3, 0.04, MAT.black, 0.9, 1.3, 2.1);
    c.box(0.05, 1.7, 2.1, LG, -0.84, 1.35, 1.55); c.plane(0.9, 0.6, GL, -0.87, 1.5, 1.55, 0, -Math.PI / 2); c.box(0.06, 0.06, 1.0, DG, -0.87, 1.2, 1.55); c.box(0.06, 0.06, 1.0, DG, -0.87, 1.8, 1.55);
    rbx(1.7, 0.06, 2.2, 0.02, LG, 0, 2.22, 1.55); c.box(1.7, 0.04, 0.1, DG, 0, 2.2, 0.5); c.box(1.7, 0.04, 0.1, DG, 0, 2.2, 2.6);
    MACH.moulder.lamps = lampStack(c, -0.5, 2.25, 0.7); var spin = cyl(0.07, 0.1, glowMat(0xf5b53d, 1.0), 0.5, 2.3, 0.7, dyn, 10); box(0.03, 0.12, 0.03, MAT.black, 0.05, 0, 0, spin); c.cyl(0.02, 0.1, DG, 0.5, 2.25, 0.7, 6);
    // the operator panel on a swing arm, with the touchscreen and the E-stop
    c.box(0.08, 0.5, 0.08, DG, 0.9, 1.25, -0.3); var arm = c.box(0.45, 0.06, 0.06, DG, 1.1, 1.5, -0.3); c.box(0.08, 0.4, 0.08, DG, 1.32, 1.3, -0.3);
    rbx(0.1, 0.62, 0.5, 0.02, LG, 1.37, 1.05, -0.3); var scr = touchScreen({ w: 400, h: 260, pw: 0.42, ph: 0.28, x: 1.43, y: 1.12, z: -0.3, ry: Math.PI / 2, parent: c.group, title: 'Moulding line', draw: moulderScreenDraw }); scr.mesh.userData.propId = 'moulder';
    c.box(0.04, 0.1, 0.1, MAT.yellow, 1.43, 0.8, -0.45); c.cyl(0.03, 0.03, MAT.red, 1.46, 0.8, -0.45, 10).rotation.z = Math.PI / 2; c.box(0.04, 0.03, 0.03, glowMat(0x5fd38d, 1.2), 1.43, 0.8, -0.2);
    // the hydraulic power unit behind, the water manifold with its hoses to the mould, the outfeed chute to the belt
    rbx(1.1, 0.7, 0.8, 0.04, DG, 0, 0.75, -2.95); var mot = c.cyl(0.2, 0.6, BL, -0.25, 1.4, -2.95, 14); mot.rotation.z = Math.PI / 2; c.cyl(0.22, 0.05, MAT.black, -0.58, 1.4, -2.95, 14).rotation.z = Math.PI / 2; rbx(0.4, 0.4, 0.5, 0.04, LG, 0.3, 1.3, -2.95); c.cyl(0.05, 0.03, MAT.white, 0.3, 1.5, -2.69, 10).rotation.x = Math.PI / 2; c.cyl(0.04, 0.3, MAT.black, 0.3, 1.1, -2.69, 8);
    [[0.3, 1.2, -2.4, 0.7], [-0.3, 1.0, -2.3, -0.6]].forEach(function (h) { var hs = c.cyl(0.03, 1.2, MAT.black, h[0], h[1], h[2], 6); hs.rotation.x = h[3]; });
    c.box(0.3, 0.2, 0.12, BL, -0.9, 0.95, 0.3); for (var hh = 0; hh < 4; hh++) { var wh = c.cyl(0.012, 1.0, hh % 2 ? MAT.red : MAT.blue, -0.85 + hh * 0.04, 1.0 + hh * 0.05, 0.75, 6); wh.rotation.x = Math.PI / 2 - 0.3; }
    var chute = c.box(0.62, 0.03, 1.5, MAT_MACH.roller, 0, 0.95, 1.65); chute.rotation.x = 0.2; c.box(0.03, 0.14, 1.5, MAT_MACH.guard, -0.31, 1.02, 1.65).rotation.x = 0.2; c.box(0.03, 0.14, 1.5, MAT_MACH.guard, 0.31, 1.02, 1.65).rotation.x = 0.2; c.box(0.6, 0.02, 0.3, MAT_MACH.roller, 0, 0.8, 2.45);
    conveyorBuild(c, 0, 2.4, 4.4, {});
    c.sign(['DC-IMM 180', 'MOULDING LINE 1'], 0.9, 0.3, -0.84, 1.75, -1.7, -Math.PI / 2, { w: 512, h: 170, bg: '#1b232c', fg: '#eef1f5' }); c.sign(['⚠ HOT SURFACE'], 0.5, 0.14, 0.61, 1.2, -1.2, Math.PI / 2, { w: 256, h: 72, bg: '#f5b53d', fg: '#1a1205' });
    MACH.moulder.anim = { ram: ram, wheel: mot, spin: spin };
    c.hit(2.6, 2.6, 6.0, 0.2, 1.3, -0.2, { prompt: function () { return moulderPrompt(); }, use: function () { moulderUse(); } });
    c.solid(-0.9, 0.9, -3.4, 2.4, 0, 2.6); c.solid(0.9, 1.5, -0.6, 0.0, 0, 2.0);
  }
  // ── The hopper prop: a cone on legs with a ladder and cage, a vibrating feeder into the pipe that runs to the moulder, a level gauge
  function hopperBuild(c) {
    var LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), DG = MAT_MACH.frame, hdyn = new THREE.Group(); hdyn.userData.dynamic = true; c.group.add(hdyn);
    // legs: square section with footplates and bolts, cross bracing on every face, a ring girder under the cone
    var L = 2.3; [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]].forEach(function (p) { c.box(0.16, L, 0.16, DG, p[0], L / 2, p[1]); c.box(0.36, 0.03, 0.36, DG, p[0], 0.015, p[1]); [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(function (b) { c.cyl(0.02, 0.05, MAT.chrome, p[0] + b[0], 0.04, p[1] + b[1], 6); }); });
    [[0, -0.85, 0], [0, 0.85, 0], [-0.85, 0, 1], [0.85, 0, 1]].forEach(function (f) { var d1 = c.box(0.06, 2.3, 0.02, DG, f[0], L / 2, f[1]); var d2 = c.box(0.06, 2.3, 0.02, DG, f[0], L / 2, f[1]); if (f[2]) { d1.rotation.y = Math.PI / 2; d2.rotation.y = Math.PI / 2; d1.rotation.x = 0.63; d2.rotation.x = -0.63; } else { d1.rotation.z = 0.63; d2.rotation.z = -0.63; } c.box(f[2] ? 0.08 : 1.86, 0.08, f[2] ? 1.86 : 0.08, DG, f[0], 1.0, f[1]); });
    c.box(1.9, 0.12, 0.12, DG, 0, L - 0.06, -0.85); c.box(1.9, 0.12, 0.12, DG, 0, L - 0.06, 0.85); c.box(0.12, 0.12, 1.9, DG, -0.85, L - 0.06, 0); c.box(0.12, 0.12, 1.9, DG, 0.85, L - 0.06, 0);
    // the bin: cone, drum with stiffening bands, a lid with a loader flange, a sight glass strip and a level gauge line
    c.cyl(1.05, 1.3, LG, 0, 2.95, 0, 24, 0.18); c.cyl(1.05, 1.5, LG, 0, 4.35, 0, 24); c.cyl(1.05, 0.08, LG, 0, 5.14, 0, 24); c.cyl(0.95, 0.2, DG, 0, 5.2, 0, 24, 0.3); c.cyl(0.25, 0.25, DG, 0, 5.38, 0, 12);
    [3.7, 4.3, 4.9].forEach(function (y) { var hb = new THREE.Mesh(new THREE.TorusGeometry(1.07, 0.035, 6, 32), DG); hb.position.y = y; hb.rotation.x = Math.PI / 2; c.group.add(hb); });
    c.box(0.12, 1.3, 0.02, MAT.glass, 0, 4.35, 1.06); c.box(0.16, 1.34, 0.01, DG, 0, 4.35, 1.05);
    // the discharge: a butterfly valve with a handle, the rotary feeder, the vacuum loader pipe up and over to the moulder
    c.cyl(0.2, 0.25, DG, 0, 2.18, 0, 12); c.cyl(0.26, 0.05, DG, 0, 2.08, 0, 12); c.cyl(0.26, 0.05, DG, 0, 1.96, 0, 12); c.box(0.35, 0.04, 0.04, MAT.red, 0.2, 2.02, 0.15); c.cyl(0.2, 0.2, DG, 0, 1.85, 0, 12);
    var feeder = box(0.6, 0.5, 0.5, MAT_MACH.blue, 0, 1.5, 0, hdyn); var fm = c.cyl(0.12, 0.3, DG, 0.45, 1.5, 0, 12); fm.rotation.z = Math.PI / 2; c.cyl(0.14, 0.05, MAT.black, 0.62, 1.5, 0, 12).rotation.z = Math.PI / 2;
    c.cyl(0.12, 0.5, MAT.steel, 0, 1.5, 0.45, 12).rotation.x = Math.PI / 2; var r1 = c.cyl(0.12, 1.1, MAT.steel, 0.3, 2.0, 0.9, 12); r1.rotation.set(0, 0, 0); c.cyl(0.14, 0.1, MAT.steel, 0.3, 1.5, 0.9, 12); c.cyl(0.14, 0.1, MAT.steel, 0.3, 2.5, 0.9, 12);
    var pipe = c.cyl(0.12, 5.2, MAT.steel, 2.9, 2.55, 0.9, 12); pipe.rotation.z = Math.PI / 2; c.cyl(0.13, 0.3, MAT.steel, 0.55, 2.55, 0.9, 12).rotation.z = Math.PI / 2; var drop = c.cyl(0.12, 0.9, MAT.steel, 5.5, 3.0, 0.9, 12); c.cyl(0.14, 0.1, MAT.steel, 5.5, 2.5, 0.9, 12);
    [1.8, 3.6].forEach(function (sx) { c.box(0.06, 0.4, 0.06, DG, sx, 2.25, 0.9); c.box(0.06, 0.06, 0.4, DG, sx, 2.05, 0.9); c.box(0.3, 0.06, 0.06, DG, sx, 2.72, 0.9); });
    // the caged ladder on the +z side, up to the lid
    [-0.22, 0.22].forEach(function (x) { c.box(0.05, 5.0, 0.05, DG, x, 2.55, 1.2); }); for (var r = 0.3; r < 5.1; r += 0.3) c.box(0.5, 0.03, 0.03, DG, 0, r, 1.2);
    for (var cg = 2.4; cg < 5.2; cg += 0.7) { var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 6, 16, Math.PI), MAT_MACH.guard); hoop.position.set(0, cg, 1.2); hoop.rotation.x = Math.PI / 2; c.group.add(hoop); } [-0.42, 0, 0.42].forEach(function (sx2) { c.box(0.04, 3.0, 0.03, MAT_MACH.guard, sx2, 3.8, 1.2 + (sx2 === 0 ? 0.42 : 0)); });
    c.box(0.6, 0.04, 0.5, DG, 0, 5.25, 1.3); c.box(0.03, 0.9, 0.03, DG, -0.3, 5.7, 1.55); c.box(0.03, 0.9, 0.03, DG, 0.3, 5.7, 1.55); c.box(0.64, 0.03, 0.03, DG, 0, 6.15, 1.55);
    // the level gauge cabinet on a bracket between two legs, the tip point in front: a steel kerb, hazard plate, the sign on a stand
    c.box(0.6, 0.06, 0.4, DG, -1.2, 1.0, 0.85); c.box(0.06, 1.0, 0.06, DG, -1.45, 0.5, 0.85); c.box(0.06, 1.0, 0.06, DG, -0.95, 0.5, 0.85);
    cabinet(c, -1.2, 1.35, 0.85, 0.44, 0.6, 0.22); var scr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: -1.2, y: 1.45, z: 0.965, ry: 0, parent: c.group, title: 'Hopper', draw: hopperScreenDraw }); scr.mesh.userData.propId = 'hopper';
    MACH.hopper.lamps = lampStack(c, -1.2, 1.7, 0.85);
    c.box(2.4, 0.012, 1.6, MAT.hazard, 0, 0.006, -1.9); c.box(2.4, 0.1, 0.1, MAT.yellow, 0, 0.05, -2.7); c.box(0.1, 0.1, 1.6, MAT.yellow, -1.2, 0.05, -1.9); c.box(0.1, 0.1, 1.6, MAT.yellow, 1.2, 0.05, -1.9);
    c.cyl(0.02, 1.3, DG, 1.5, 0.65, -1.2, 8); c.cyl(0.12, 0.03, DG, 1.5, 0.015, -1.2, 12); c.sign(['TIP POINT', 'raw granulate pallets only'], 0.7, 0.36, 1.5, 1.4, -1.2, Math.PI, { w: 384, h: 200, bg: '#f5b53d', fg: '#1a1205' });
    MACH.hopper.anim = { feeder: feeder, tipT: 0 };
    c.hit(2.6, 2.6, 4.0, 0, 1.3, -0.6, { prompt: function () { return hopperPrompt(); }, use: function () { hopperUse(); } });
    c.solid(-1.0, 1.0, -1.0, 1.4, 0, 2.3); c.solid(-1.5, -0.9, 0.7, 1.0, 0, 1.8);
  }

  // ── The palletiser prop: a gantry over a roller cradle, the pusher on its ram, infeed rollers off the belt, a drop zone for the finished pallet
  function palletiserBuild(c) {
    var LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), DG = MAT_MACH.frame;
    c.box(2.6, 0.08, 2.6, DG, 0, 0.04, 0); c.box(2.62, 0.03, 2.62, MAT.hazard, 0, 0.085, 0);
    [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(function (p) { c.box(0.2, 3.0, 0.2, MAT_MACH.blue, p[0], 1.5, p[1]); c.box(0.36, 0.04, 0.36, DG, p[0], 0.1, p[1]); });
    c.box(2.4, 0.2, 0.2, MAT_MACH.blue, 0, 3.0, -1.1); c.box(2.4, 0.2, 0.2, MAT_MACH.blue, 0, 3.0, 1.1); c.box(0.2, 0.2, 2.4, MAT_MACH.blue, -1.1, 3.0, 0); c.box(0.2, 0.2, 2.4, MAT_MACH.blue, 1.1, 3.0, 0);
    c.box(0.06, 2.6, 0.06, DG, -1.1, 1.5, 0); c.box(0.06, 0.06, 2.2, DG, -1.1, 2.0, 0); c.plane(2.2, 1.6, MAT.mesh, -1.12, 1.9, 0, 0, Math.PI / 2);
    // the pusher on its gantry: a carriage on two rails, a vertical ram, the plate
    c.box(0.12, 0.12, 2.3, DG, -0.5, 2.85, 0); c.box(0.12, 0.12, 2.3, DG, 0.5, 2.85, 0); c.box(1.2, 0.3, 0.6, LG, 0, 2.72, 0); c.cyl(0.09, 0.9, MAT.chrome, 0, 2.2, 0, 10); c.box(1.0, 0.1, 1.0, LG, 0, 1.75, 0); c.box(0.9, 0.04, 0.9, MAT_MACH.rubber, 0, 1.68, 0);
    for (var rz = -0.75; rz <= 0.75; rz += 0.15) { var r = c.cyl(0.03, 1.5, MAT_MACH.roller, 0, 0.3, rz, 8); r.rotation.z = Math.PI / 2; } c.box(1.6, 0.06, 0.06, DG, 0, 0.33, -0.82); c.box(1.6, 0.06, 0.06, DG, 0, 0.33, 0.82); [-0.78, 0.78].forEach(function (x) { c.box(0.06, 0.3, 1.7, DG, x, 0.18, 0); });
    for (var iz = -1.6; iz < -0.9; iz += 0.12) { var ir = c.cyl(0.03, 0.62, MAT_MACH.roller, 0, BELT_Y - 0.02, iz, 8); ir.rotation.z = Math.PI / 2; } c.box(0.05, 0.1, 0.8, DG, -0.34, BELT_Y - 0.04, -1.25); c.box(0.05, 0.1, 0.8, DG, 0.34, BELT_Y - 0.04, -1.25); c.box(0.05, 0.7, 0.05, DG, -0.3, 0.35, -1.5); c.box(0.05, 0.7, 0.05, DG, 0.3, 0.35, -1.5);
    var slide = c.box(0.7, 0.03, 0.5, MAT_MACH.roller, 0, 0.55, -0.95); slide.rotation.x = -0.5;
    [-1.3, 1.3].forEach(function (x) { c.box(0.08, 1.8, 0.08, MAT.yellow, x, 0.9, -1.25); c.box(0.02, 1.6, 0.02, glowMat(0xff3b2f, 0.6), x, 0.9, -1.2); });
    var cab = new THREE.Mesh(bevelGeo(0.5, 1.4, 0.4, 0.03), LG); cab.position.set(1.4, 0.8, 0.6); c.group.add(cab); c.box(0.52, 0.2, 0.42, DG, 1.4, 0.1, 0.6); var scr = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 1.4, y: 1.15, z: 0.81, ry: 0, parent: c.group, title: 'Palletiser', draw: palletiserScreenDraw }); scr.mesh.userData.propId = 'palletiser';
    eStop(c, 1.4, 0.75, 0.81); MACH.palletiser.lamps = lampStack(c, 1.4, 1.5, 0.6);
    c.box(1.6, 0.012, 1.4, MAT.hazard, 2.4, 0.006, 0); c.sign(['PALLET DROP · KEEP CLEAR'], 1.4, 0.16, 2.4, 0.008, -0.8, 0, { w: 512, h: 56, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }).rotation.x = -Math.PI / 2;
    c.sign(['PALLETISER'], 1.6, 0.4, 0, 3.3, 0, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' });
    c.hit(2.6, 3.2, 2.6, 0, 1.6, 0, { prompt: function () { return palletiserPrompt(); }, use: function () { palletiserUse(); } });
    c.solid(-1.2, 1.2, -1.2, 1.2, 0, 3); c.solid(-0.4, 0.4, -1.7, -1.2, 0, 0.9); c.solid(1.15, 1.65, 0.4, 0.8, 0, 1.8);
  }
  function beltMainBuild(c) { conveyorBuild(c, 0, 0, 11.2, {}); c.box(0.8, 0.03, 0.04, MAT.hazard, 0, 1.0, 8.5); }
  // the silo outside the west wall feeds the hopper through the pipe over the wall
  function siloBuild(c) {
    [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(function (p) { c.box(0.16, 3.2, 0.16, MAT_MACH.frame, p[0], 1.6, p[1]); c.box(0.5, 0.05, 0.5, MAT.grey, p[0], 0.02, p[1]); });
    c.cyl(1.5, 1.6, MAT_MACH.panel, 0, 4.0, 0, 24, 0.3); c.cyl(1.5, 5.2, MAT_MACH.panel, 0, 7.4, 0, 24); c.cyl(1.5, 0.6, MAT_MACH.panel, 0, 10.3, 0, 24, 0.2); c.cyl(0.25, 0.4, MAT_MACH.frame, 0, 10.8, 0, 12);
    for (var r = 4.9; r < 10; r += 1.3) { var ring = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.04, 6, 32), MAT_MACH.frame); ring.position.y = r; ring.rotation.x = Math.PI / 2; c.group.add(ring); }
    [-0.2, 0.2].forEach(function (x) { c.box(0.05, 10, 0.05, MAT_MACH.frame, x, 5.0, 1.62); }); for (var lr = 0.4; lr < 10; lr += 0.3) c.box(0.44, 0.03, 0.03, MAT_MACH.frame, 0, lr, 1.62); for (var cg = 3; cg < 10; cg += 0.6) { var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 16, Math.PI), MAT_MACH.guard); hoop.position.set(0, cg, 1.62); hoop.rotation.x = Math.PI / 2; c.group.add(hoop); }
    var out = c.cyl(0.16, 2.2, MAT.steel, 1.1, 2.4, 0, 12); out.rotation.z = -0.9; c.box(0.6, 0.5, 0.4, MAT_MACH.blue, 0, 2.6, 0); c.cyl(0.12, 0.06, MAT.white, 0.8, 5.5, 1.3, 12).rotation.x = Math.PI / 2;
    c.sign(['RAW GRANULATE · 40 t'], 2.0, 0.5, 0, 6.5, 1.52, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' }); c.box(1.2, 0.012, 1.2, MAT.hazard, 2.4, 0.006, 0);
    c.solid(-1.6, 1.6, -1.6, 1.8, -2, 12);
  }
  function qcBenchBuild(c) {
    c.box(1.6, 0.05, 0.7, std({ color: 0x3a3e45, roughness: 0.35 }), 0, 0.9, 0); [[-0.72, -0.28], [0.72, -0.28], [-0.72, 0.28], [0.72, 0.28]].forEach(function (p) { c.box(0.05, 0.9, 0.05, MAT_MACH.frame, p[0], 0.45, p[1]); }); c.box(1.5, 0.04, 0.6, MAT_MACH.frame, 0, 0.3, 0);
    c.box(0.04, 0.4, 0.56, MAT.black, 0.55, 1.18, -0.1); var scr = touchScreen({ w: 320, h: 220, pw: 0.5, ph: 0.34, x: 0.53, y: 1.2, z: -0.1, ry: -Math.PI / 2, parent: c.group, title: 'Quality station', draw: qcScreenDraw }); scr.mesh.userData.propId = 'qcBench'; c.box(0.2, 0.03, 0.2, MAT_MACH.frame, 0.55, 0.93, -0.1);
    c.box(0.34, 0.03, 0.14, MAT.black, -0.1, 0.94, 0.15); c.box(0.08, 0.02, 0.1, MAT.chrome, -0.5, 0.93, 0.2); c.cyl(0.01, 0.3, MAT.chrome, -0.5, 0.93, 0.05, 6).rotation.x = Math.PI / 2;
    c.box(0.26, 0.2, 0.26, std({ color: 0x2f6b9a, roughness: 0.6 }), -0.4, 1.03, -0.15); c.box(0.22, 0.14, 0.22, std({ color: 0x6b8e23, roughness: 0.6 }), -0.05, 1.0, -0.2); c.cyl(0.12, 0.12, std({ color: 0xb5651d, roughness: 0.6 }), 0.25, 0.99, -0.2, 12, 0.09);
    c.box(0.3, 0.02, 0.2, MAT.paper, 0.1, 0.93, 0.22); c.cyl(0.006, 0.14, MAT.black, 0.18, 0.95, 0.24, 6).rotation.x = Math.PI / 2;
    c.cyl(0.16, 0.04, std({ color: 0x1f2630, roughness: 0.9 }), 0, 0.62, 0.7, 14); c.cyl(0.02, 0.6, MAT_MACH.frame, 0, 0.3, 0.7, 8); c.cyl(0.2, 0.02, MAT_MACH.frame, 0, 0.01, 0.7, 14);
    c.sign(['QUALITY', 'first-off checks every batch'], 1.0, 0.3, 0, 1.9, -0.36, 0, { w: 512, h: 150, bg: '#1b232c', fg: '#eef1f5' });
    c.solid(-0.8, 0.8, -0.35, 0.35, 0, 1.0);
  }
  function qcScreenDraw(c, sc) { var F = S.factory; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'QUALITY', factoryStatus().toUpperCase()); scText(c, 16, 70, 'Product: ' + skuName(F.product), '#eef1f5', 15); scText(c, 16, 92, 'Made ' + F.made + ' · hopper ' + F.raw, '#a0acb8', 13); scText(c, 16, 114, 'Weight 412 g · wall 2.1 mm · OK', '#5fd38d', 13); scText(c, 16, 136, 'Shrink 0.4% · flash none', '#5fd38d', 13); scText(c, 16, 170, 'Last check day ' + S.day + ' ' + fmtTime(Math.floor(S.time)), '#6b7784', 11); }
  function toolCabBuild(c) {
    var RED = std({ color: 0xb3261e, roughness: 0.45, metalness: 0.3 }); var body = new THREE.Mesh(bevelGeo(0.9, 1.0, 0.5, 0.02), RED); body.position.set(0, 0.55, 0); body.castShadow = true; c.group.add(body); c.box(0.92, 0.04, 0.52, MAT.black, 0, 1.07, 0);
    for (var d = 0; d < 5; d++) { c.box(0.8, 0.14, 0.02, RED, 0, 0.22 + d * 0.17, 0.26); c.box(0.4, 0.02, 0.03, MAT.chrome, 0, 0.26 + d * 0.17, 0.28); } [-0.35, 0.35].forEach(function (x) { [-0.18, 0.18].forEach(function (z) { c.cyl(0.05, 0.04, MAT.black, x, 0.02, z, 10).rotation.x = Math.PI / 2; }); });
    c.box(0.3, 0.05, 0.3, MAT.black, -0.2, 1.12, 0); c.cyl(0.02, 0.3, MAT.chrome, 0.25, 1.24, 0.1, 6).rotation.z = 0.3; c.box(0.12, 0.04, 0.03, MAT.chrome, 0.2, 1.1, 0.12);
    c.solid(-0.5, 0.5, -0.3, 0.3, 0, 1.2);
  }
  function workbenchBuild(c) {
    c.box(2.0, 0.08, 0.8, MAT.wood, 0, 0.9, 0); [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]].forEach(function (p) { c.box(0.06, 0.9, 0.06, MAT_MACH.frame, p[0], 0.45, p[1]); }); c.box(1.9, 0.04, 0.7, MAT_MACH.frame, 0, 0.25, 0);
    c.box(0.3, 0.2, 0.2, MAT_MACH.frame, 0.6, 1.04, 0.2); c.box(0.08, 0.1, 0.24, MAT.chrome, 0.6, 1.1, 0.2); c.cyl(0.015, 0.3, MAT.chrome, 0.75, 1.08, 0.2, 6).rotation.z = Math.PI / 2;
    c.box(1.9, 1.0, 0.05, std({ color: 0xf0e6cf, roughness: 0.9 }), 0, 1.5, -0.4); for (var k = 0; k < 8; k++) { var tx = -0.8 + k * 0.23; c.cyl(0.01, 0.1, MAT.chrome, tx, 1.5, -0.33, 6).rotation.x = Math.PI / 2; c.box(0.04, 0.25 + (k % 3) * 0.08, 0.02, k % 2 ? MAT.black : MAT_MACH.frame, tx, 1.3, -0.33); }
    c.box(0.25, 0.1, 0.18, std({ color: 0x2f6b9a, roughness: 0.6 }), -0.6, 0.99, 0.1); c.box(0.2, 0.08, 0.12, MAT.yellow, -0.2, 0.98, 0.15); c.cyl(0.05, 0.14, MAT.white, 0.1, 1.01, -0.2, 10);
    c.sign(['MAINTENANCE'], 0.9, 0.22, 0, 2.2, -0.4, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
    c.solid(-1.0, 1.0, -0.45, 0.4, 0, 1.0);
  }
  function mouldRackBuild(c) {
    [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(function (p) { c.box(0.08, 2.0, 0.08, MAT_MACH.blue, p[0], 1.0, p[1]); }); [0.3, 1.0, 1.7].forEach(function (y) { c.box(1.9, 0.05, 0.9, MAT_MACH.frame, 0, y, 0); });
    [[-0.55, 0.3], [0.2, 0.3], [-0.5, 1.0], [0.3, 1.0], [-0.4, 1.7]].forEach(function (p, i) { c.box(0.6, 0.45, 0.6, MAT_MACH.roller, p[0], p[1] + 0.25, 0, 0); c.box(0.62, 0.04, 0.62, MAT_MACH.frame, p[0], p[1] + 0.49, 0); c.sign(['M-' + (i + 1)], 0.2, 0.08, p[0], p[1] + 0.25, 0.31, 0, { w: 128, h: 48, bg: '#f5b53d', fg: '#1a1205' }); });
    c.sign(['MOULD STORE'], 0.9, 0.22, 0, 2.15, 0.45, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#78bdf5' });
    c.solid(-1.0, 1.0, -0.5, 0.5, 0, 2.2);
  }
  function chillerBuild(c) {
    var LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), DG = MAT_MACH.frame;
    var body = new THREE.Mesh(bevelGeo(2.2, 1.9, 1.1, 0.04), LG); body.position.set(0, 1.05, 0); body.castShadow = true; c.group.add(body); c.box(2.24, 0.12, 1.14, DG, 0, 0.06, 0); c.box(2.24, 0.06, 1.14, DG, 0, 2.03, 0);
    for (var g = -0.95; g < 0.95; g += 0.075) { c.box(0.03, 1.4, 0.02, DG, g, 1.05, 0.56); c.box(0.03, 1.4, 0.02, DG, g, 1.05, -0.56); }
    [-0.55, 0.55].forEach(function (x) { c.cyl(0.42, 0.06, DG, x, 2.09, 0, 24); var fan = c.cyl(0.34, 0.03, MAT.black, x, 2.13, 0, 20); for (var b = 0; b < 6; b++) { var bl = box(0.6, 0.01, 0.1, DG, 0, 0, 0, fan); bl.rotation.y = b * 1.047; } c.cyl(0.06, 0.08, MAT.black, x, 2.17, 0, 10); var guard = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.015, 6, 24), DG); guard.position.set(x, 2.2, 0); guard.rotation.x = Math.PI / 2; c.group.add(guard); for (var sp = 0; sp < 4; sp++) { var spk = box(0.8, 0.01, 0.02, DG, 0, 0, 0, fan); spk.position.y = 0.07; spk.rotation.y = sp * 0.785; } });
    c.box(0.6, 0.5, 1.0, DG, 1.4, 0.5, 0); var pump = c.cyl(0.18, 0.5, MAT_MACH.blue, 1.4, 0.95, 0, 14); pump.rotation.z = Math.PI / 2; c.cyl(0.08, 0.3, DG, 1.4, 1.2, 0, 10);
    cabinet(c, -0.6, 1.3, 0.62, 0.5, 0.6, 0.12); c.plane(0.3, 0.14, MAT.screen, -0.6, 1.4, 0.69, 0, 0); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), -0.75, 1.15, 0.69); c.box(0.04, 0.04, 0.02, glowMat(0xf5b53d, 1.2), -0.68, 1.15, 0.69);
    [[-0.8, MAT.blue], [-0.6, MAT.red]].forEach(function (p) { var pp = c.cyl(0.05, 1.2, p[1], p[0], 0.5, -0.9, 10); pp.rotation.x = Math.PI / 2; var pd = c.cyl(0.05, 0.9, p[1], p[0], 0.45, -1.5, 10); c.cyl(0.07, 0.06, DG, p[0], 0.5, -1.5, 10); });
    c.box(0.7, 0.2, 0.3, MAT_MACH.blue, -0.7, 0.1, -1.5); c.sign(['CHILLER · 12 kW · 10 °C'], 1.1, 0.14, 0.3, 1.75, 0.57, 0, { w: 512, h: 72, bg: '#1b232c', fg: '#eef1f5' });
    c.solid(-1.15, 1.75, -0.6, 0.6, 0, 2.3);
  }
  function dryerBuild(c) {
    var LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), DG = MAT_MACH.frame;
    var cab = new THREE.Mesh(bevelGeo(1.2, 1.5, 0.9, 0.04), LG); cab.position.set(0, 0.85, 0); cab.castShadow = true; c.group.add(cab); c.box(1.24, 0.12, 0.94, DG, 0, 0.06, 0); c.box(1.24, 0.06, 0.94, DG, 0, 1.63, 0);
    c.box(0.5, 1.1, 0.02, std({ color: 0xcfd4d9, roughness: 0.5 }), -0.3, 0.85, 0.46); c.box(0.03, 0.12, 0.03, MAT.chrome, -0.1, 0.85, 0.48); c.plane(0.3, 0.16, MAT.screen, 0.3, 1.25, 0.465, 0, 0); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), 0.18, 1.0, 0.465); c.box(0.04, 0.04, 0.02, glowMat(0xf5b53d, 1.2), 0.28, 1.0, 0.465); eStop(c, 0.42, 0.95, 0.465);
    [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]].forEach(function (p) { c.box(0.1, 0.9, 0.1, DG, p[0], 2.1, p[1]); }); c.box(1.1, 0.08, 0.9, DG, 0, 2.55, 0);
    c.cyl(0.55, 0.7, LG, 0, 2.3, 0, 18, 0.14); c.cyl(0.55, 1.3, LG, 0, 3.3, 0, 18); [2.9, 3.5].forEach(function (y) { var b = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.03, 6, 24), DG); b.position.y = y; b.rotation.x = Math.PI / 2; c.group.add(b); });
    c.cyl(0.55, 0.06, LG, 0, 3.98, 0, 18); c.cyl(0.45, 0.2, DG, 0, 4.05, 0, 18, 0.3); c.cyl(0.14, 0.2, DG, 0, 4.2, 0, 12); c.box(0.4, 0.3, 0.3, MAT_MACH.blue, 0, 4.3, -0.5); c.box(0.08, 0.5, 0.08, DG, 0, 3.9, -0.5);
    c.box(0.5, 0.6, 0.5, DG, 0.95, 0.95, 0); c.cyl(0.2, 0.4, MAT.black, 0.95, 1.4, 0, 14); c.cyl(0.14, 0.5, LG, 0.95, 1.85, 0, 12); c.cyl(0.16, 0.05, DG, 0.95, 2.1, 0, 12);
    var h1 = c.cyl(0.05, 2.2, MAT.black, 0.75, 3.2, 0.3, 8); h1.rotation.z = 0.35; var h2 = c.cyl(0.05, 1.4, MAT.black, 0.6, 1.0, 0.5, 8); h2.rotation.z = -0.5;
    c.sign(['GRANULATE DRYER', 'desiccant · 80 °C'], 0.8, 0.26, -0.1, 1.5, 0.47, 0, { w: 512, h: 160, bg: '#1b232c', fg: '#eef1f5' });
    c.solid(-0.65, 1.25, -0.5, 0.5, 0, 2.0);
  }
  function switchboardBuild(c) {
    c.box(1.4, 1.8, 0.25, std({ color: 0xb9bec4, roughness: 0.45, metalness: 0.3 }), 0, 1.4, -0.12); c.box(1.42, 0.05, 0.27, MAT_MACH.frame, 0, 2.3, -0.12);
    [-0.35, 0.35].forEach(function (x) { c.box(0.62, 1.6, 0.02, std({ color: 0xcfd4d9, roughness: 0.5 }), x, 1.4, 0.01); c.box(0.03, 0.1, 0.03, MAT.chrome, x + 0.25, 1.4, 0.03); });
    for (var k = 0; k < 6; k++) { c.box(0.06, 0.1, 0.03, k < 4 ? MAT.black : MAT.red, -0.6 + k * 0.1, 2.05, 0.025); } c.box(0.14, 0.14, 0.05, MAT.red, 0.4, 2.05, 0.03); c.cyl(0.04, 0.04, MAT.black, 0.4, 2.05, 0.06, 10).rotation.x = Math.PI / 2; c.box(0.02, 0.08, 0.02, glowMat(0x5fd38d, 1.2), -0.5, 1.85, 0.03);
    c.sign(['⚡ 400 V · ISOLATE BEFORE OPENING'], 1.2, 0.14, 0, 0.9, 0.025, 0, { w: 512, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.sign(['PRODUCTION DB'], 0.8, 0.16, 0, 2.2, 0.025, 0, { w: 512, h: 72, bg: '#1b232c', fg: '#eef1f5' });
    for (var t = 0; t < 4; t++) c.cyl(0.03, 1.5, MAT.black, -0.4 + t * 0.25, 3.0, -0.1, 6);
    c.solid(-0.7, 0.7, -0.25, 0.05, 0, 2.4);
  }
  function partsShelfBuild(c) {
    [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]].forEach(function (p) { c.box(0.05, 2.0, 0.05, MAT_MACH.frame, p[0], 1.0, p[1]); }); [0.1, 0.6, 1.1, 1.6].forEach(function (y) { c.box(1.85, 0.03, 0.65, MAT_MACH.frame, 0, y, 0); });
    var cols = [0x2f6b9a, 0xb3261e, 0xf5b53d, 0x6b8e23, 0x3a4149]; for (var s = 0; s < 4; s++) for (var b = 0; b < 6; b++) { var bm = std({ color: cols[(s + b) % 5], roughness: 0.6 }); c.box(0.26, 0.2, 0.4, bm, -0.75 + b * 0.3, 0.1 + s * 0.5 + 0.12, 0.05); }
    c.sign(['SPARES'], 0.6, 0.18, 0, 2.15, 0.33, 0, { w: 256, h: 80, bg: '#1b232c', fg: '#eef1f5' });
    c.solid(-0.95, 0.95, -0.35, 0.35, 0, 2.1);
  }
  function shiftBoardBuild(c) { c.box(1.6, 1.0, 0.04, MAT.white, 0, 1.9, 0); c.box(1.64, 1.04, 0.02, MAT_MACH.frame, 0, 1.9, -0.015); var scr = touchScreen({ w: 400, h: 250, pw: 1.5, ph: 0.92, x: 0, y: 1.9, z: 0.025, ry: 0, parent: c.group, title: 'Shift board', draw: function (cc, sc) { cc.fillStyle = '#f7f7f4'; cc.fillRect(0, 0, sc.w, sc.h); cc.fillStyle = '#1b232c'; cc.font = 'bold 26px Bahnschrift, Arial'; cc.fillText('SHIFT OUTPUT · DAY ' + S.day, 16, 36); cc.font = '18px Bahnschrift, Arial'; cc.fillStyle = '#2f6b9a'; cc.fillText('Boxes moulded: ' + S.factory.made, 16, 80); cc.fillText('Pallets finished: ' + (S.stats.palletised || 0), 16, 108); cc.fillText('Hopper: ' + S.factory.raw + ' units', 16, 136); cc.fillStyle = '#b3261e'; cc.fillText('Jams: ' + (S.factory.jam ? 'LINE JAMMED' : 'none'), 16, 164); cc.fillStyle = '#6b7784'; cc.font = '14px Bahnschrift, Arial'; cc.fillText('Target 60 a day · keep the hopper above 40', 16, 220); } }); scr.mesh.userData.propId = 'shiftBoard'; c.box(0.4, 0.03, 0.06, MAT_MACH.frame, 0, 1.36, 0.03); c.cyl(0.01, 0.12, MAT.black, 0.1, 1.4, 0.05, 6).rotation.z = Math.PI / 2; }
  // ── Conveyor pieces: belts you build from parts ──
  // Every piece is a prop with a path in its own frame (it starts at the origin running along +z; heights are above BELT_Y, plus
  // the height the piece was snapped at) and is put on the belt list when it is built, so items ride it like any other belt. In
  // build mode a carried piece snaps its start to the nearest free belt end, machine outlet, parcel shelf or inbound dock door,
  // and its end to the nearest free belt start, machine inlet, outbound dock door or rack bay, within two metres. Dropped, it
  // says what it took from and what it feeds. A quarter turn is six short runs on a 1.5 m radius, so every joint stays square.
  function arcPath(dir) { var R = 1.5, pts = []; for (var k = 0; k <= 6; k++) { var a = k / 6 * Math.PI / 2; pts.push([dir * (R - R * Math.cos(a)), R * Math.sin(a), 0]); } return pts; }
  var BELT_PIECES = {
    beltS2: { label: 'belt, 2 m', ico: '➖', price: 120, desc: 'A straight run.', path: [[0, 0, 0], [0, 2, 0]] },
    beltS4: { label: 'belt, 4 m', ico: '➖', price: 200, desc: 'A longer straight run.', path: [[0, 0, 0], [0, 4, 0]] },
    beltCL: { label: 'belt, curve left', ico: '↰', price: 220, desc: 'A quarter turn to the left.', path: arcPath(1) },
    beltCR: { label: 'belt, curve right', ico: '↱', price: 220, desc: 'A quarter turn to the right.', path: arcPath(-1) },
    beltUp: { label: 'belt, incline up', ico: '⬈', price: 260, desc: 'Climbs a metre over three.', path: [[0, 0, 0], [0, 3, 1]] },
    beltDown: { label: 'belt, incline down', ico: '⬊', price: 260, desc: 'Drops a metre over three.', path: [[0, 0, 0], [0, 3, -1]] },
    beltHigh: { label: 'belt, high run', ico: '⤒', price: 240, desc: 'A 4 m run hung from the roof two metres up, for crossing a lane. Two inclines reach it.', path: [[0, 0, 2.0], [0, 4, 2.0, 'hang']] }
  };
  function beltPieceBuild(kind) { return function (c, P) { var h = P.h || 0, pts = BELT_PIECES[kind].path.map(function (p) { return [p[0], p[1], (p[2] || 0) + h, p[3]]; }); conveyorPath(c, pts); }; }
  Object.keys(BELT_PIECES).forEach(function (k) { var bp = BELT_PIECES[k]; defProp('x' + k.charAt(0).toUpperCase() + k.slice(1), { extra: true, label: bp.label, ico: bp.ico, cat: 'belt', price: bp.price, desc: bp.desc, beltPath: bp.path, build: beltPieceBuild(k) }); });
  // signs as props, so build mode can move them: a wall sign faces +z in its own frame, a floor painting lies flat
  function wallSignBuild(lines, w, h, y, opt) { return function (c) { var o = {}; for (var k in opt) o[k] = opt[k]; if (o.plate === undefined) o.plate = true; c.sign(lines, w, h, 0, y, 0.012, 0, o); }; }
  function floorSignBuild(lines, w, h, opt) { return function (c) { var m = c.sign(lines, w, h, 0, 0.008, 0, 0, opt); m.rotation.x = -Math.PI / 2; }; }
  // ── Defaults
  defProp('packline', { label: 'pack line', cat: 'hall', abs: true, x: 26.6, z: 7.2, rot: 0, build: packLineBuild });
  defProp('moulder', { label: 'moulding line', cat: 'factory', abs: true, x: -4, z: -37, rot: 0, build: moulderBuild });
  defProp('beltMain', { label: 'main belt', cat: 'factory', abs: true, x: -4, z: -32.5, rot: 0, build: beltMainBuild });
  defProp('palletiser', { label: 'palletiser', cat: 'hall', abs: true, x: -4, z: -20.6, rot: 0, build: palletiserBuild });
  defProp('hopper', { label: 'raw hopper', cat: 'factory', abs: true, x: -9.5, z: -37, rot: 0, build: hopperBuild });
  defProp('shipBelt', { label: 'shipping belt', cat: 'hall', abs: true, x: 26.6, z: 14.3, rot: 0, build: shipBeltBuild, when: function () { return !!S.up.shipbelt && !S.up.sorter; } });   // the sortation deck takes the shelf over
  defProp('dockLoader2', { label: 'dock loader OUT 2', cat: 'hall', abs: true, x: 28.6, z: -5.9, rot: 0, build: dockLoaderBuild, when: function () { return !!S.up.shipbelt || !!S.up.sorter; } });
  defProp('dockLoader1', { label: 'dock loader OUT 1', cat: 'hall', abs: true, keep: true, fixed: true, x: 34.6, z: -13.9, rot: 0, build: dockLoaderBuildFor('dockLoader1', 'OUT 1', false), when: function () { return !!S.up.sorter; } });   // under the deck edge; its bay stands south of it in the apron, fed by the sea spiral
  defProp('dockLoader3', { label: 'dock loader OUT 3', cat: 'hall', abs: true, keep: true, fixed: true, x: 34.6, z: -21.4, rot: 0, build: dockLoaderBuildFor('dockLoader3', 'OUT 3', false), when: function () { return !!S.up.sorter; } });
  defProp('agvDock', { label: 'AGV dock', cat: 'hall', abs: true, x: -26.5, z: -5.5, rot: 0, build: agvDockBuild, when: function () { return !!S.up.agv; } });
  for (var gr2 = 0; gr2 < RACK.rows.length; gr2++) (function (r) { defProp('gantry' + r, { label: 'gantry picker ' + 'ABCDEF'[r], cat: 'hall', abs: true, x: -24, z: RACK.rows[r], rot: 0, build: gantryBuild(r), when: function () { return !!S.up.gantry && r < S.up.rows; } }); })(gr2);
  defProp('pickBelt', { label: 'south pick belt', cat: 'hall', abs: true, x: 22.0, z: RACK.rows[0], rot: 0, build: pickBeltBuild, when: function () { return !!S.up.gantry; } });
  defProp('pickMerge', { keep: true, label: 'pick belt merge', cat: 'hall', abs: true, x: 26.6, z: 5.2, rot: 0, build: pickMergeBuild, when: function () { return !!S.up.gantry; } });
  defProp('pickBelt2', { label: 'north pick belt', cat: 'hall', abs: true, x: 22.0, z: RACK.rows[RACK.rows.length - 1], rot: 0, build: pickBelt2Build, when: function () { return !!S.up.gantry && S.up.rows > 3; } });
  defProp('silo', { label: 'silo', cat: 'yard', yard: true, abs: true, x: -17.5, z: -34, rot: 0, build: siloBuild });
  defProp('extWing', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 9.83, z: -30, rot: 3, build: extinguisherBuild });
  defProp('qcBench', { label: 'quality bench', cat: 'factory', abs: true, x: 6.5, z: -29, rot: 2, build: qcBenchBuild });
  defProp('workbench', { label: 'maintenance bench', cat: 'factory', abs: true, x: -12.8, z: -27.5, rot: 1, build: workbenchBuild });
  defProp('toolCab', { label: 'tool cabinet', cat: 'factory', abs: true, x: -13.2, z: -25.4, rot: 1, build: toolCabBuild });
  defProp('mouldRack', { label: 'mould store', cat: 'factory', abs: true, x: 2.5, z: -43.2, rot: 0, build: mouldRackBuild });
  defProp('partsShelf', { label: 'spares shelf', cat: 'factory', abs: true, x: -1.0, z: -43.3, rot: 0, build: partsShelfBuild });
  defProp('chiller', { label: 'chiller', cat: 'factory', abs: true, x: -11.5, z: -42.5, rot: 0, build: chillerBuild });
  defProp('dryer', { label: 'granulate dryer', cat: 'factory', abs: true, x: -6.0, z: -42.8, rot: 0, build: dryerBuild });
  defProp('switchboard', { label: 'switchboard', cat: 'wall', wall: true, abs: true, x: 9.8, z: -41, rot: 3, build: switchboardBuild });
  defProp('shiftBoard', { label: 'shift board', cat: 'wall', wall: true, abs: true, x: 9.83, z: -33, rot: 3, build: shiftBoardBuild });
  defProp('clockWing', { label: 'wing clock', cat: 'wall', wall: true, abs: true, x: 9.83, z: -27, rot: 3, build: function (c) { var f = clockBuild(0.4); f(c); c.group.children[c.group.children.length - 1].position.y = 3.6; } });
  defProp('firstAidWing', { label: 'first-aid box', cat: 'wall', wall: true, abs: true, x: 9.83, z: -25.5, rot: 3, build: firstAidBuild });
  function exitSignBuild(c) { var m = c.sign(['EXIT'], 0.5, 0.2, 0, 2.6, 0.03, 0, { w: 256, h: 96, bg: '#1f7a3a', fg: '#dfffe8' }); m.renderOrder = 1; c.box(0.54, 0.24, 0.04, MAT.exit, 0, 2.6, 0); }
  defProp('signStaff', { label: 'sign: STAFF', cat: 'wall', wall: true, abs: true, x: -30.17, z: 22, rot: 3, build: wallSignBuild(['STAFF'], 1.2, 0.4, 2.7, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' }) });
  defProp('signFront', { label: 'sign: DEPOT CO. (front)', cat: 'wall', wall: true, abs: true, x: 0, z: 24.17, rot: 0, build: function (c) { c.sign(['DEPOT CO.'], 12, 2.6, 0, 5, 0.01, 0, { w: 1024, h: 224, bg: '#1b232c', fg: '#f5b53d', border: '#f5b53d' }); c.sign(['3PL · STORAGE · FULFILMENT'], 10, 0.8, 0, 3.2, 0.01, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8' }); } });
  defProp('signOffice', { label: 'sign: OFFICE', cat: 'wall', wall: true, abs: true, x: 22.41, z: 19.95, rot: 3, build: wallSignBuild(['OFFICE'], 1.4, 0.45, 2.6, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' }) });
  defProp('signLobby', { label: 'sign: LOBBY', cat: 'wall', wall: true, abs: true, x: -25.41, z: 19.95, rot: 1, build: wallSignBuild(['LOBBY'], 1.2, 0.45, 2.6, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' }) });
  defProp('signBreak', { label: 'sign: BREAK ROOM', cat: 'wall', wall: true, abs: true, x: -22.91, z: -22.45, rot: 1, build: wallSignBuild(['BREAK ROOM'], 1.6, 0.45, 2.6, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' }) });
  defProp('exitNorth', { keep: true, label: 'exit sign (fire exit)', cat: 'wall', wall: true, abs: true, x: 24, z: -23.8, rot: 0, build: exitSignBuild });
  defProp('exitStaff', { label: 'exit sign (staff door)', cat: 'wall', wall: true, abs: true, x: -29.8, z: 22, rot: 1, build: exitSignBuild });
  defProp('signPacking', { label: 'sign: PACKING', cat: 'wall', wall: true, abs: true, x: 29.83, z: 5.2, rot: 3, build: wallSignBuild(['PACKING'], 1.8, 0.5, 2.6, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' }) });
  defProp('signProduction', { label: 'sign: PRODUCTION', cat: 'wall', wall: true, abs: true, x: 5.8, z: -23.83, rot: 0, build: wallSignBuild(['PRODUCTION'], 2.6, 0.6, 4.9, { w: 512, h: 128, bg: '#1b232c', fg: '#78bdf5' }) });
  defProp('signWarehouse', { label: 'sign: WAREHOUSE', cat: 'wall', wall: true, abs: true, x: 5.8, z: -24.17, rot: 2, build: wallSignBuild(['WAREHOUSE'], 2.6, 0.6, 4.9, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' }) });
  defProp('signPpe', { label: 'sign: PPE', cat: 'wall', wall: true, abs: true, x: 2.5, z: -23.83, rot: 0, build: wallSignBuild(['PPE BEYOND THIS POINT', 'ear defenders · safety boots · hi-vis'], 1.2, 0.5, 2.3, { w: 512, h: 200, bg: '#1f4e8c', fg: '#eef1f5' }) });
  defProp('paintReceiving', { label: 'floor paint: RECEIVING', cat: 'hall', abs: true, x: SPOT.stageIn.x, z: SPOT.stageIn.z + 2.2, rot: 0, build: floorSignBuild(['RECEIVING'], 2.6, 0.9, { w: 512, h: 128, bg: '#2a2f36', fg: '#f5b53d' }) });
  defProp('paintShipping', { label: 'floor paint: SHIPPING', cat: 'hall', abs: true, x: SPOT.stageOut.x, z: SPOT.stageOut.z + 2.2, rot: 0, build: floorSignBuild(['SHIPPING'], 2.6, 0.9, { w: 512, h: 128, bg: '#2a2f36', fg: '#5fd38d' }) });
  defProp('paintFinished', { label: 'floor paint: FINISHED GOODS', cat: 'hall', abs: true, x: -1.0, z: -16.3, rot: 0, build: floorSignBuild(['FINISHED GOODS'], 1.8, 0.3, { w: 512, h: 96, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }) });
  defProp('paintRaw', { label: 'floor paint: RAW GRANULATE', cat: 'factory', abs: true, x: -9.5, z: -31.6, rot: 0, build: floorSignBuild(['RAW GRANULATE'], 1.6, 0.3, { w: 512, h: 96, bg: 'rgba(0,0,0,0)', fg: '#eef1f5' }) });
  defProp('xWallSign', { extra: true, label: 'wall sign (DEPOT CO.)', ico: '🪧', cat: 'wall', wall: true, price: 30, desc: 'A spare sign for any wall.', build: wallSignBuild(['DEPOT CO.'], 1.2, 0.4, 2.4, { w: 512, h: 160, bg: '#1b232c', fg: '#f5b53d' }) });
  defProp('xFloorArrow', { extra: true, label: 'floor arrow', ico: '➡️', cat: 'hall', price: 10, desc: 'Points the way.', build: floorSignBuild(['➜'], 1.2, 0.6, { w: 256, h: 128, bg: 'rgba(0,0,0,0)', fg: '#f5b53d', size: 110 }) });
  defProp('posterWing', { label: 'safety poster', cat: 'wall', wall: true, abs: true, x: 9.83, z: -36, rot: 3, build: posterBuild('safety', 0.7, 1.05) });
  // ── The annex halls ───────────────────────────────────────────────
  // Tyson's third expansion ask, 2026-10-06: "3 new halls and everything that comes with it". They hang off the north side like the
  // production wing, so the docks on the east and west walls and the truck lanes stay where they are. Hall 2 stands east of the wing,
  // Hall 3 west of it with an inbound dock of its own (IN 3) on the west wall, Hall 4 behind the wing, reached through the wing's
  // north wall. Each is a steel-framed box with its floor, roof, skylights, high bays, two rack rows and a doorway into the hall it
  // opens off, cut into that wall from the first day and shuttered until the hall is bought. The rows are plain storage: pickers,
  // the forklift, the AGV and the receivers use them; the cranes stay over the main rows. Rows are numbered from 20 so the main
  // rows (0 to 4) and the deck row (5) keep their meaning.
  var HALLS = {
    hall2: { name: 'Hall 2', x0: 10.0, x1: HALL.x, z0: -44, z1: -HALL.z, door: { x0: 17.0, x1: 20.6, h: 4.2, z: -HALL.z }, rows: [20, 21], rowZ: [-30, -37], rowX0: 12.5, bays: 7, lights: [[15, -39], [23, -39], [31, -39], [15, -29], [23, -29], [31, -29]] },
    hall3: { name: 'Hall 3', x0: -HALL.x, x1: -14.0, z0: -44, z1: -HALL.z, door: { x0: -28.5, x1: -26.0, h: 3.6, z: -HALL.z }, rows: [22, 23], rowZ: [-29.5, -38.5], rowX0: -33.0, bays: 5, lights: [[-31, -39], [-23, -39], [-17, -39], [-31, -29], [-23, -29], [-17, -29]], dockIn: 2 },
    hall4: { name: 'Hall 4', x0: -14, x1: 10, z0: -64, z1: -44, door: { x0: 5.0, x1: 8.6, h: 4.2, z: -44 }, rows: [24, 25], rowZ: [-50.5, -57.5], rowX0: -12.5, bays: 7, lights: [[-8, -59], [0, -59], [8, -59], [-8, -49], [0, -49], [8, -49]] }
  };
  var HALL_OF_ROW = {}; for (var hk in HALLS) HALLS[hk].rows.forEach(function (r) { HALL_OF_ROW[r] = hk; });
  function hallOwned(id) { return !!(S.up && S.up[id]); }
  function hallOfRow(r) { return HALL_OF_ROW[r] || null; }
  function isAnnexRow(r) { return r >= 20; }
  function annexRowOwned(r) { var h = hallOfRow(r); return !!h && hallOwned(h); }
  function rowBays(r) { var h = hallOfRow(r); return h ? HALLS[h].bays : RACK.bays; }
  function rowLetter(r) { if (r === UPPER.row) return 'U'; if (isAnnexRow(r)) return 'HIJKLM'[r - 20]; return 'ABCDEF'[r]; }
  // the rows a walker, the forklift or the AGV can reach: the main rows you own and the rows of the halls you own
  function groundRows() { var out = []; for (var r = 0; r < S.up.rows; r++) out.push(r); for (var h in HALLS) if (hallOwned(h)) HALLS[h].rows.forEach(function (r) { out.push(r); }); return out; }
  function slotTotal() { var n = 0; groundRows().forEach(function (r) { n += rowBays(r) * RACK.levels.length; }); if (upperOwned()) n += RACK.bays * UPPER.levels; return n; }
  function inRectH(x, z, H) { return x > H.x0 && x < H.x1 && z > H.z0 && z < H.z1; }
  function inAnnex(x, z) { for (var h in HALLS) if (hallOwned(h) && inRectH(x, z, HALLS[h])) return h; return null; }
  function inAnyAnnexFootprint(x, z) { for (var h in HALLS) if (inRectH(x, z, HALLS[h])) return h; return null; }
  // where a walker may stand: the main hall, the halls you own, and the wing once Hall 4 opens behind it (all inset from their walls)
  function insideWalk(x, z) {
    var m = 0.35;
    if (Math.abs(x) < HALL.x - m && Math.abs(z) < HALL.z - m) return true;
    for (var h in HALLS) { var H = HALLS[h]; if (hallOwned(h) && x > H.x0 + m && x < H.x1 - m && z > H.z0 + m && z < H.z1 - m) return true; }
    if (hallOwned('hall4') && x > WING.x0 + m && x < WING.x1 - m && z > WING.z0 + m && z < WING.z1 - m) return true;
    return false;
  }
  // ── The build ─────────────────────────────────────────────────────
  // ── The build: a steel box dressed like the main hall ─────────────
  // Every inside face gets the main hall's lining: the block dado with its rail, the two girts, the cable tray, an I-beam column
  // with a bump guard every eight metres, a clerestory window every four on the outside walls. Over it the roof with its trusses,
  // skylights and vents; outside, the gutter and downpipes. The doorway gets jambs, a lintel, a strip curtain, the way-out sign.
  function hallSegs(a0, a1, cuts) { var out = [[a0, a1]]; cuts.forEach(function (cc) { var nx = []; out.forEach(function (s) { if (cc[1] <= s[0] || cc[0] >= s[1]) { nx.push(s); return; } if (cc[0] > s[0]) nx.push([s[0], cc[0]]); if (cc[1] < s[1]) nx.push([cc[1], s[1]]); }); out = nx; }); return out.filter(function (s) { return s[1] - s[0] > 0.3; }); }
  function hallDado(len, DH) { var m = MAT.block.clone(); m.map = MAT.block.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(len / 1.6, DH / 0.8); m.normalMap = MAT.block.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(len / 1.6, DH / 0.8); return m; }
  function hallColumn(c, x, z, alongZ) {
    var FR = MAT.steelDark, h = HALL.h - 0.3; c.box(alongZ ? 0.26 : 0.02, h, alongZ ? 0.02 : 0.26, FR, x, h / 2, z);
    [-0.12, 0.12].forEach(function (o) { c.box(alongZ ? 0.02 : 0.3, h, alongZ ? 0.3 : 0.02, FR, x + (alongZ ? o : 0), h / 2, z + (alongZ ? 0 : o)); });
    c.box(0.42, 0.03, 0.42, FR, x, 0.015, z); [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(function (b) { c.cyl(0.018, 0.03, MAT.chrome, x + b[0], 0.04, z + b[1], 6); });
    c.box(0.46, 0.5, 0.46, MAT.hazard, x, 0.28, z).castShadow = false; c.solid(x - 0.16, x + 0.16, z - 0.16, z + 0.16, 0, h);
  }
  // one inside face: axis 'x' is a wall along z standing at x = at; axis 'z' a wall along x at z = at; inward points into the hall
  function hallFace(c, axis, at, inward, a0, a1, cuts, opts) {
    var FR = MAT.steelDark, DH = 2.4, ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI), off = at + inward * 0.17, full = a1 - a0, c0 = (a0 + a1) / 2;
    hallSegs(a0 + 0.3, a1 - 0.3, cuts).forEach(function (s) { var len = s[1] - s[0], mid = (s[0] + s[1]) / 2; if (axis === 'x') { c.plane(len, DH, hallDado(len, DH), off, DH / 2, mid, 0, ry); c.box(0.06, 0.05, len, FR, off + inward * 0.02, DH + 0.025, mid); } else { c.plane(len, DH, hallDado(len, DH), mid, DH / 2, off, 0, ry); c.box(len, 0.05, 0.06, FR, mid, DH + 0.025, off + inward * 0.02); } });
    var g = at + inward * 0.22; [5.2, 6.8].forEach(function (gy) { if (axis === 'x') c.box(0.06, 0.12, full, FR, g, gy, c0); else c.box(full, 0.12, 0.06, FR, c0, gy, g); });
    if (opts.tray) { var ty = at + inward * 0.35; if (axis === 'x') { c.box(0.3, 0.08, full - 1, FR, ty, 5.6, c0); for (var t = a0 + 1; t < a1; t += 2) c.box(0.3, 0.08, 0.04, FR, ty, 5.6, t); } else { c.box(full - 1, 0.08, 0.3, FR, c0, 5.6, ty); for (var t2 = a0 + 1; t2 < a1; t2 += 2) c.box(0.04, 0.08, 0.3, FR, t2, 5.6, ty); } }
    for (var p = a0 + 4; p < a1 - 1; p += 8) { if (cuts.some(function (cc) { return p > cc[0] - 0.6 && p < cc[1] + 0.6; })) continue; hallColumn(c, axis === 'x' ? at + inward * 0.42 : p, axis === 'x' ? p : at + inward * 0.42, axis === 'x'); }
    if (opts.windows) { var wy = 6.0, ww = 2.4, wh = 1.3, woff = at + inward * 0.2; for (var wp = a0 + 4; wp < a1 - 2; wp += 4) { if (cuts.some(function (cc) { return wp > cc[0] - 1.5 && wp < cc[1] + 1.5; })) continue; if (axis === 'x') { c.box(0.04, wh + 0.12, ww + 0.12, FR, woff - inward * 0.02, wy, wp); c.plane(ww, wh, MAT.skylight, woff, wy, wp, 0, ry); c.box(0.05, wh, 0.05, FR, woff + inward * 0.01, wy, wp); c.box(0.05, 0.05, ww, FR, woff + inward * 0.01, wy, wp); } else { c.box(ww + 0.12, wh + 0.12, 0.04, FR, wp, wy, woff - inward * 0.02); c.plane(ww, wh, MAT.skylight, wp, wy, woff, 0, ry); c.box(0.05, wh, 0.05, FR, wp, wy, woff + inward * 0.01); c.box(ww, 0.05, 0.05, FR, wp, wy, woff + inward * 0.01); } } }
  }
  function hallBuild(id) { return function (c) {
    var H = HALLS[id], h = HALL.h, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2, wx = H.x1 - H.x0, wz = H.z1 - H.z0, FR = MAT.steelDark, D = H.door;
    var ownW = id !== 'hall2', ownE = id !== 'hall3';   // Hall 2 leans on the wing's east wall, Hall 3 on its west wall; those stand already
    c.box(wx + 0.6, 1.2, wz + 0.3, MAT.grey, cx, YARD_Y + 0.6, cz - 0.15);   // the plinth
    var fl = c.plane(wx, wz, MAT.floor, cx, 0.001, cz, -Math.PI / 2, 0); fl.receiveShadow = true;
    c.plane(wx - 0.4, 0.12, MAT.trim, cx, 0.06, H.z0 + 0.16, 0, 0);   // the skirting line along the far wall
    var wallSeg = function (axis, at, a0, a1, y0, y1) { var len = a1 - a0, mid = (a0 + a1) / 2, hh = y1 - y0; if (len <= 0.01 || hh <= 0.01) return; if (axis === 'x') { c.box(len, hh, 0.3, MAT.wall, mid, y0 + hh / 2, at); c.solid(a0, a1, at - 0.15, at + 0.15, y0 === 0 ? -1 : y0, y1 + 1); } else { c.box(0.3, hh, len, MAT.wall, at, y0 + hh / 2, mid); c.solid(at - 0.15, at + 0.15, a0, a1, y0 === 0 ? -1 : y0, y1 + 1); } };
    wallSeg('x', H.z0, H.x0 - 0.15, H.x1 + 0.15, 0, h);   // the far wall
    var dockCut = id === 'hall3' ? [DOCKS.in[2].z - DOCKS.w / 2, DOCKS.in[2].z + DOCKS.w / 2] : null;
    if (ownW) { if (dockCut) { wallSeg('z', H.x0, H.z0, dockCut[0], 0, h); wallSeg('z', H.x0, dockCut[0], dockCut[1], DOCKS.h, h); wallSeg('z', H.x0, dockCut[1], H.z1, 0, h); } else wallSeg('z', H.x0, H.z0, H.z1, 0, h); }
    if (ownE) wallSeg('z', H.x1, H.z0, H.z1, 0, h);
    // the roof: slab, inner face, three skylight strips, trusses along z, purlins across, two roof vents
    c.box(wx + 0.6, 0.3, wz + 0.6, MAT.roof, cx, h + 0.15, cz); c.plane(wx, wz, MAT.roofIn, cx, h - 0.01, cz, Math.PI / 2, 0);
    [H.z0 + 4.5, cz, H.z1 - 4.5].forEach(function (z) { var sk = c.plane(wx - 4, 1.4, MAT.skylight, cx, h - 0.02, z, Math.PI / 2, 0); world.lampMeshes.push(sk); });
    for (var tx = Math.ceil((H.x0 + 2) / 8) * 8; tx < H.x1 - 1; tx += 8) c.box(0.25, 0.6, wz - 0.4, FR, tx, h - 0.35, cz);
    for (var pz = H.z0 + 3; pz < H.z1 - 1; pz += 4) c.box(wx - 0.4, 0.12, 0.12, FR, cx, h - 0.1, pz);
    [cx - wx / 4, cx + wx / 4].forEach(function (vx) { c.cyl(0.45, 0.6, MAT.steel, vx, h + 0.6, cz, 12); c.cyl(0.6, 0.15, FR, vx, h + 0.95, cz, 12); });
    H.lights.forEach(function (p, i) { highBay(p[0], 7.0, p[1]); var l = new THREE.PointLight(i % 3 === 2 ? 0xf3f0ff : 0xffeacc, 0.55, 28, 2); l.position.set(p[0], 7.3, p[1]); l.userData.warm = i % 3 !== 2; scene.add(l); hallLights.push(l); });
    // the inside faces: the far wall with the tray and windows, the wall it opens off with the doorway cut, the two sides
    var dcut = [D.x0 - 0.1, D.x1 + 0.1];
    hallFace(c, 'z', H.z0, 1, H.x0, H.x1, [], { windows: true, tray: true });
    hallFace(c, 'z', H.z1, -1, H.x0, H.x1, [dcut], { windows: false });
    hallFace(c, 'x', H.x0, 1, H.z0, H.z1, dockCut ? [dockCut] : [], { windows: ownW });
    hallFace(c, 'x', H.x1, -1, H.z0, H.z1, [], { windows: ownE });
    // the doorway: jambs and a lintel, a strip curtain, the hall's name over it on both sides, the way out inside, bollards, hazard strips
    var dcx = (D.x0 + D.x1) / 2, dz = D.z, dw = D.x1 - D.x0, strip = std({ color: 0xdfe8ee, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }); strip.userData.noBake = true;
    [D.x0 - 0.1, D.x1 + 0.1].forEach(function (jx) { c.box(0.2, D.h, 0.5, FR, jx, D.h / 2, dz); }); c.box(dw + 0.4, 0.14, 0.5, FR, dcx, D.h - 0.04, dz);
    for (var sx2 = D.x0 + 0.15; sx2 < D.x1; sx2 += 0.3) { var st = c.plane(0.28, D.h - 0.2, strip, sx2, (D.h - 0.2) / 2, dz + (sx2 * 7 % 1) * 0.02 - 0.01, 0, 0); st.rotation.y = ((sx2 * 13) % 1 - 0.5) * 0.08; }
    c.sign([H.name.toUpperCase()], 2.0, 0.5, dcx, D.h + 0.55, dz + 0.3, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign(['WAY OUT  →  MAIN HALL'], 1.8, 0.4, dcx, D.h + 0.55, dz - 0.3, Math.PI, { w: 512, h: 112, bg: '#1e7a3a', fg: '#fff' });
    [D.x0 - 0.6, D.x1 + 0.6].forEach(function (bx) { [dz - 0.9, dz + 0.9].forEach(function (bz) { c.cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, 10); c.cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, 10); c.solid(bx - 0.12, bx + 0.12, bz - 0.12, bz + 0.12, 0, 1.0); }); });
    c.plane(dw, 1.6, MAT.hazard, dcx, 0.0065, dz - 0.9, -Math.PI / 2, 0); c.plane(dw, 1.6, MAT.hazard, dcx, 0.0065, dz + 0.9, -Math.PI / 2, 0);
    // floor markings: the rack block edges, the walkway along the wall you come in by, the hall's name painted at the doorway
    var rx0 = H.rowX0 - 0.4, rx1 = H.rowX0 + H.bays * RACK.bayW + 0.4; c.plane(0.1, wz - 1, MAT.yellowLine, rx0, 0.006, cz, -Math.PI / 2, 0); c.plane(0.1, wz - 1, MAT.yellowLine, rx1, 0.006, cz, -Math.PI / 2, 0);
    c.plane(wx - 1, 0.1, MAT.yellowLine, cx, 0.006, H.z1 - 1.6, -Math.PI / 2, 0); c.plane(wx - 1, 0.1, MAT.yellowLine, cx, 0.006, H.z1 - 2.8, -Math.PI / 2, 0);
    var lbl = new THREE.MeshBasicMaterial({ map: textTex([H.name.toUpperCase()], { w: 512, h: 128, bg: '#8b8d8e', fg: '#d9a12c' }) }); c.plane(2.2, 0.55, lbl, dcx, 0.0066, dz - 2.2, -Math.PI / 2, 0);
    if (id === 'hall3') { c.plane(1.6, DOCKS.w - 0.4, MAT.hazard, H.x0 + 0.8, 0.008, DOCKS.in[2].z, -Math.PI / 2, 0); [-1, 1].forEach(function (s) { var bz = DOCKS.in[2].z + s * (DOCKS.w / 2 + 0.5); c.cyl(0.11, 1.0, MAT.yellow, H.x0 + 1.0, 0.5, bz, 10); c.cyl(0.14, 0.05, MAT.black, H.x0 + 1.0, 0.025, bz, 10); }); }
    // outside: the gutter and downpipes on the far wall, gutters down the sides, the painted name high on the far wall inside
    c.box(wx + 0.4, 0.16, 0.16, FR, cx, h - 0.05, H.z0 - 0.25); [H.x0 + 1, H.x1 - 1].forEach(function (dx) { c.cyl(0.07, h + 1.1, FR, dx, (h - 1.2) / 2 + 0.05, H.z0 - 0.25, 8); });
    if (ownW) { c.box(0.16, 0.16, wz, FR, H.x0 - 0.25, h - 0.05, cz); c.cyl(0.07, h + 1.1, FR, H.x0 - 0.25, (h - 1.2) / 2 + 0.05, H.z1 - 2, 8); } if (ownE) { c.box(0.16, 0.16, wz, FR, H.x1 + 0.25, h - 0.05, cz); c.cyl(0.07, h + 1.1, FR, H.x1 + 0.25, (h - 1.2) / 2 + 0.05, H.z1 - 2, 8); }
    c.sign([H.name.toUpperCase(), 'DEPOT CO.'], 4.0, 1.2, cx, 4.3, H.z0 + 0.17, 0, { w: 512, h: 160, bg: '#1b232c', fg: '#f5b53d' });
  }; }
  // the shutter in a doorway the hall has not been bought for yet: a closed roller door and its sign
  function shutterBuild(id) { return function (c) {
    if (hallOwned(id)) return;
    var D = HALLS[id].door, w = D.x1 - D.x0, cx = (D.x0 + D.x1) / 2;
    c.box(w, D.h, 0.12, MAT.door, cx, D.h / 2, D.z); for (var y = 0.5; y < D.h; y += 0.5) c.box(w, 0.04, 0.14, MAT.steelDark, cx, y, D.z);
    c.sign([HALLS[id].name.toUpperCase(), 'in the shop'], 1.6, 0.5, cx, D.h / 2, D.z + 0.08, 0, { w: 448, h: 128, bg: '#1b232c', fg: '#a0acb8' }); c.sign([HALLS[id].name.toUpperCase()], 1.6, 0.5, cx, D.h / 2, D.z - 0.08, Math.PI, { w: 448, h: 128, bg: '#1b232c', fg: '#a0acb8' });
    c.solid(D.x0 - 0.1, D.x1 + 0.1, D.z - 0.2, D.z + 0.2, 0, D.h);
    c.hit(w, D.h, 0.5, cx, D.h / 2, D.z, { prompt: function () { var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; return HALLS[id].name + ' · ' + (u ? money(u.price) + ' in the shop' : 'not open') + (u && u.needs && !S.up[u.needs] ? ' · needs ' + upgradeName(u.needs).toLowerCase() : ''); }, use: function () { sfx('click'); } });
  }; }
  for (var hid in HALLS) (function (id) {
    var H = HALLS[id];
    defProp(id, { label: H.name, cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, build: hallBuild(id), when: function () { return hallOwned(id); } });
    defProp('shut' + id, { label: H.name + ' shutter', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, build: shutterBuild(id) });
    H.rows.forEach(function (r, k) { defProp('rack' + r, { label: H.name + ' rack row ' + 'HIJKLM'[r - 20], cat: 'hall', abs: true, keep: true, fixed: true, x: H.rowX0 - RACK.x0, z: H.rowZ[k], rot: 0, build: rackBuild(r), when: function () { return hallOwned(id); } }); });
  })(hid);
  for (var hfid in HALLS) (function (id) {
    var H = HALLS[id], when = function () { return hallOwned(id); }, cx = (H.x0 + H.x1) / 2, D = H.door;
    defProp('ext' + id, { label: H.name + ' extinguisher', cat: 'wall', wall: true, abs: true, keep: true, x: H.x1 - 2.5, z: H.z0 + 0.17, rot: 0, build: extinguisherBuild, when: when });
    defProp('posterExit' + id, { label: H.name + ' fire-exit poster', cat: 'wall', wall: true, abs: true, keep: true, x: D.x1 + 1.6, z: D.z - 0.17, rot: 2, build: posterBuild('exit', 0.6, 0.9), when: when });
    defProp('posterSmoke' + id, { label: H.name + ' no-smoking poster', cat: 'wall', wall: true, abs: true, keep: true, x: H.x0 + 2.5, z: H.z0 + 0.17, rot: 0, build: posterBuild('smoke', 0.6, 0.8), when: when });
    defProp('clock' + id, { label: H.name + ' clock', cat: 'wall', wall: true, abs: true, keep: true, x: cx + 3.2, z: H.z0 + 0.3, rot: 0, build: function (c) { var f = clockBuild(0.4); f(c); }, when: when });
    defProp('aisle' + id, { label: H.name + ' aisle sign', cat: 'hall', abs: true, keep: true, fixed: true, x: cx, z: (H.rowZ[0] + H.rowZ[1]) / 2, rot: 0, build: aisleSignBuild(H.name.toUpperCase() + ' · ' + 'HIJKLM'[H.rows[0] - 20] + ' / ' + 'HIJKLM'[H.rows[1] - 20]), when: when });
  })(hfid);
  defProp('consoleIn2', { label: 'dock console IN 3', cat: 'wall', wall: true, abs: true, x: -29.7, z: -31.5, rot: 1, build: consoleBuild(5), when: function () { return hallOwned('hall3'); } });
  // buying a hall: it stands, its rows stand, its shutter goes, Hall 3 gets its dock door and lane, the silo moves out of Hall 3's way
  function buildHall(id) {
    var H = HALLS[id];
    if (id === 'hall3') { var sp = propPlacement('silo'); if (inRectH(sp.x, sp.z, H) || (sp.x > H.x0 - 3 && sp.x < H.x1 + 3 && sp.z > H.z0 - 3 && sp.z < H.z1 + 3)) { S.layout.silo = { x: -26, z: -50, rot: 0 }; buildProp('silo'); } if (!doors[5]) { buildDoor(5, -1, DOCKS.in[2].z); if (yard.dock) yard.dock(doors[5]); } buildProp('consoleIn2'); }
    buildProp(id); H.rows.forEach(function (r) { buildProp('rack' + r); }); buildProp('shut' + id); ['ext', 'posterExit', 'posterSmoke', 'clock', 'aisle'].forEach(function (k) { buildProp(k + id); });
    NAV.dirty = true; shadowDirty = true; beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); }
    logEvent(H.name + ' is open: ' + H.rows.length + ' rack rows of ' + H.bays + ' bays' + (id === 'hall3' ? ', and IN 3 on its west wall' : ''), 'good');
  }
  // ── The yard ──────────────────────────────────────────────────────
  var yard = { gates: [], guards: [], traffic: [], clouds: [], sunDisc: null, moon: null, puddles: [], rain: null, snow: null, flag: null, lampLenses: [], windT: 0 };
  var CAR_COLS = [0xb8322a, 0x2c5f9e, 0xd8dbdf, 0x2a2d33, 0x7a8691, 0xe0a02a, 0x4f6a3a];
  function carMesh(col) {
    var g = new THREE.Group(), paint = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.35, metalness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.15 }), glass = std({ color: 0x2a3340, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.85 });
    var rbx = function (w, h, d, r, mat, x, yy, z) { var m = new THREE.Mesh(bevelGeo(w, h, d, r), mat); m.position.set(x, yy, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    rbx(4.3, 0.52, 1.82, 0.08, paint, 0, 0.6, 0); rbx(2.4, 0.56, 1.66, 0.1, paint, -0.25, 1.12, 0); rbx(1.0, 0.3, 1.6, 0.05, paint, 1.6, 0.9, 0).rotation.z = 0.0;
    var ws = rbx(0.06, 0.5, 1.5, 0.02, glass, 0.98, 1.1, 0); ws.rotation.z = -0.55; var rw = rbx(0.06, 0.5, 1.5, 0.02, glass, -1.45, 1.1, 0); rw.rotation.z = 0.5; rbx(2.1, 0.44, 0.04, 0.01, glass, -0.25, 1.12, 0.84); rbx(2.1, 0.44, 0.04, 0.01, glass, -0.25, 1.12, -0.84);
    [-1, 1].forEach(function (s) { box(0.02, 0.4, 0.02, MAT.black, -0.25, 1.12, s * 0.86, g); box(0.02, 0.4, 0.02, MAT.black, 0.5, 1.1, s * 0.86, g); box(0.14, 0.02, 0.03, MAT.chrome, -0.6, 0.78, s * 0.92, g); box(0.14, 0.02, 0.03, MAT.chrome, 0.3, 0.78, s * 0.92, g); box(0.12, 0.1, 0.16, paint, 0.6, 1.2, s * 1.0, g); });
    [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]].forEach(function (p) { var w = cyl(0.33, 0.22, MAT.rubber, p[0], 0.33, p[1], g, 20); w.rotation.x = Math.PI / 2; cyl(0.2, 0.23, MAT.chrome, p[0], 0.33, p[1], g, 14).rotation.x = Math.PI / 2; for (var sp = 0; sp < 5; sp++) { var spk = box(0.04, 0.26, 0.24, MAT.black, p[0], 0.33, p[1], g); spk.rotation.x = sp * 1.257; } var arch = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 14, Math.PI), paint); arch.position.set(p[0], 0.35, p[1] * 0.96); arch.rotation.y = Math.PI / 2; g.add(arch); });
    rbx(0.12, 0.2, 1.9, 0.03, MAT.plastic, 2.14, 0.42, 0); rbx(0.12, 0.2, 1.9, 0.03, MAT.plastic, -2.14, 0.42, 0);
    box(0.06, 0.16, 0.34, glowMat(0xfff2c0, 0.4), 2.16, 0.68, 0.62, g); box(0.06, 0.16, 0.34, glowMat(0xfff2c0, 0.4), 2.16, 0.68, -0.62, g); box(0.06, 0.14, 0.34, glowMat(0xff2a1a, 0.5), -2.16, 0.68, 0.62, g); box(0.06, 0.14, 0.34, glowMat(0xff2a1a, 0.5), -2.16, 0.68, -0.62, g);
    sign(['DC ' + randi(10, 99) + ' ' + pick(['AB', 'KH', 'NL', 'XY']) + randi(100, 999)], 0.44, 0.11, 2.2, 0.46, 0, Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' }, g); sign(['DC ' + randi(10, 99)], 0.44, 0.11, -2.2, 0.46, 0, -Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' }, g);
    box(0.5, 0.06, 1.0, MAT.black, -0.2, 1.42, 0, g); cyl(0.015, 0.3, MAT.black, -0.9, 1.5, 0.4, g, 4); box(0.3, 0.015, 0.02, MAT.black, 1.0, 1.0, -0.3, g).rotation.z = -0.55;
    return g;
  }
  function tree(x, z, s) {
    s = s || 1; cyl(0.12 * s, 2.6 * s, std({ color: 0x5b4634, roughness: 1 }), x, YARD_Y + 1.3 * s, z, null, 8, 0.18 * s);
    [[0, 3.2, 0, 1.3], [0.7, 2.7, 0.4, 0.9], [-0.6, 2.9, -0.5, 1.0], [0.1, 4.0, 0.2, 0.8]].forEach(function (b, i) { sphere(b[3] * s, std({ color: [0x3f6f2e, 0x5c8f44, 0x45752f, 0x6f9a4a][i], roughness: 1 }), x + b[0] * s, YARD_Y + b[1] * s, z + b[2] * s); });
  }
  function side_(s) { return s < 0 ? -1 : 1; }
  function cloudTex() { return tex(256, 128, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 14; i++) { var r = randf(18, 42), x = randf(r, w - r), y = randf(r * 0.6, h - r * 0.6); var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } }); }
  function discTex(col) { return tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, col); g.addColorStop(0.45, col); g.addColorStop(0.6, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }

  function buildYard() {
    var X = HALL.x, Z = HALL.z;
    // the ground: grass to the horizon, the asphalt yard, the plinth the hall stands on, a lighter apron round it
    plane(600, 600, MAT.grass, 0, YARD_Y - 0.03, 0, -Math.PI / 2);
    plane(170, 124, MAT.yard, 0, YARD_Y, 0, -Math.PI / 2);
    box(2 * X + 0.6, 1.2, 2 * Z + 0.6, MAT.grey, 0, YARD_Y + 0.6, 0);
    // street furniture in the slab: manhole covers, gully grates against the plinth, a kerb round the car park, wheel stops in the bays, weeds along the fence
    var IRON = std({ color: 0x2c2e31, roughness: 0.6, metalness: 0.5 });
    [[-30, -22], [8, 30], [34, 10], [-40, 26], [22, -30], [-10, 36]].forEach(function (p) { cyl(0.42, 0.02, IRON, p[0], YARD_Y + 0.012, p[1], null, 20); var ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.02, 6, 24), MAT.grey); ring.rotation.x = Math.PI / 2; ring.position.set(p[0], YARD_Y + 0.012, p[1]); scene.add(ring); for (var mb = 0; mb < 2; mb++) box(0.06, 0.012, 0.3, MAT.black, p[0] + (mb ? 0.18 : -0.18), YARD_Y + 0.03, p[1]); });
    [[-X - 1.0, -11], [-X - 1.0, 11], [X + 1.0, -11], [X + 1.0, 11], [0, Z + 1.0], [-10, Z + 1.0], [10, -Z - 1.0]].forEach(function (p) { box(0.5, 0.02, 0.35, IRON, p[0], YARD_Y + 0.012, p[1]); for (var gb = 0; gb < 6; gb++) box(0.5, 0.012, 0.025, MAT.black, p[0], YARD_Y + 0.03, p[1] - 0.14 + gb * 0.056); plane(1.2, 0.8, std({ color: 0x1e2024, roughness: 0.9, transparent: true, opacity: 0.35 }), p[0], YARD_Y + 0.011, p[1], -Math.PI / 2); });
    box(13.6, 0.12, 0.25, MAT.grey, -23.6, YARD_Y + 0.06, 34.6); box(0.25, 0.12, 6.2, MAT.grey, -30.5, YARD_Y + 0.06, 31.5); [0, 1, 2, 3, 4].forEach(function (k) { box(1.6, 0.1, 0.18, MAT.yellow, -27.65 + k * 2.7, YARD_Y + 0.05, 33.4); });
    var WEED = std({ color: 0x5d7a3a, roughness: 1, flatShading: true }); for (var wd = -70; wd <= 70; wd += randf(2.5, 5)) { var wg = new THREE.Mesh(new THREE.IcosahedronGeometry(randf(0.15, 0.35), 0), WEED); wg.position.set(wd, YARD_Y + 0.08, 56.6 + randf(-0.3, 0.3)); wg.scale.y = 0.6; scene.add(wg); }
    // the sky: a dome with a zenith-to-horizon gradient and a haze band at the horizon, driven by the time of day
    var skyMat = new THREE.ShaderMaterial({ uniforms: { top: { value: new THREE.Color(0x4f7fb8) }, mid: { value: new THREE.Color(0x8fb0d4) }, bot: { value: new THREE.Color(0xd6e2ec) } }, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vW; void main() { vW = normalize((modelMatrix * vec4(position, 1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vW; void main() { float h = clamp(vW.y, -0.05, 1.0); vec3 c = h < 0.12 ? mix(bot, mid, smoothstep(-0.05, 0.12, h)) : mix(mid, top, pow(smoothstep(0.12, 1.0, h), 0.6)); gl_FragColor = vec4(c, 1.0); }' });
    var dome = new THREE.Mesh(new THREE.SphereGeometry(230, 32, 16), skyMat); dome.position.y = YARD_Y; yard.dome = dome; dome.renderOrder = -10; dome.userData.noBake = true; dome.frustumCulled = false; scene.add(dome); yard.sky = skyMat;
    // truck lanes to every dock: edge lines, a centre dash, and a hatched keep-clear apron
    function yardDock(d) {
      // the steps: 6 risers from the yard to the landing at hall level, outside the dock door on its +z side, with a tube handrail
      var fz = d.i === 4 ? -1 : 1, sx = side_(d.side), ST = std({ map: TEX.plaster, color: 0x9a9890, roughness: 0.95 }), HR = std({ color: 0xf5b53d, roughness: 0.5, metalness: 0.4 });
      for (var st = 0; st < 6; st++) { box(1.1, 0.2, (6 - st) * 0.3, ST, sx * (X + 0.85), YARD_Y + 0.1 + st * 0.2, d.z + fz * 4.4 + (6 - st) * 0.15); }
      box(1.1, 1.2, 1.6, ST, sx * (X + 0.85), YARD_Y + 0.6, d.z + fz * 3.6);
      [-0.5, 0.5].forEach(function (hx) { var px = sx * (X + 0.85 + hx); cyl(0.025, 1.0, HR, px, YARD_Y + 1.7, d.z + fz * 3.0, null, 8); cyl(0.025, 1.0, HR, px, YARD_Y + 1.7, d.z + fz * 4.3, null, 8); cyl(0.025, 1.0, HR, px, YARD_Y + 0.5, d.z + fz * 6.1, null, 8); var rail = cyl(0.025, 1.5, HR, px, YARD_Y + 2.2, d.z + fz * 3.65, null, 8); rail.rotation.x = Math.PI / 2; var rail2 = cyl(0.025, 2.2, HR, px, YARD_Y + 1.6, d.z + fz * 5.2, null, 8); rail2.rotation.x = Math.PI / 2 + 0.58 * fz; });
      solid(sx * (X + 0.3), sx * (X + 1.4), d.z + fz * 2.8, d.z + fz * 6.3, YARD_Y, YARD_Y + 1.3);
      var side = d.side, x0 = side * (X + 1), x1 = side * 76, cx = (x0 + x1) / 2, len = Math.abs(x1 - x0);
      plane(len, 0.15, MAT.whiteLine, cx, YARD_Y + 0.012, d.z - 2.2, -Math.PI / 2); plane(len, 0.15, MAT.whiteLine, cx, YARD_Y + 0.012, d.z + 2.2, -Math.PI / 2);
      for (var x = side * (X + 8); Math.abs(x) < 74; x += side * 4) plane(2, 0.12, MAT.whiteLine, x, YARD_Y + 0.012, d.z, -Math.PI / 2);
      for (var k = 0; k < 6; k++) { var hp = plane(5, 0.14, MAT.yellowLine, side * (X + 3.5), YARD_Y + 0.013, d.z - 2 + k * 0.8, -Math.PI / 2); hp.rotation.z = side * 0.6; }
      sign([String(d.i % 2 + 1)], 2.4, 2.4, side * (X + 4), YARD_Y + 0.014, d.z - 1, 0, { w: 128, h: 128, bg: '#3b3d40', fg: '#d8dbdf' }).rotation.set(-Math.PI / 2, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      // the dock shelter and its lamp
      var sx = side * (X + 0.75); box(0.5, 0.6, DOCKS.w + 1.4, MAT.rubber, sx + side * 0.25, DOCKS.h + 0.5, d.z); box(1.0, DOCKS.h + 0.8, 0.5, MAT.rubber, sx, DOCKS.h / 2 + 0.4, d.z - DOCKS.w / 2 - 0.45); box(1.0, DOCKS.h + 0.8, 0.5, MAT.rubber, sx, DOCKS.h / 2 + 0.4, d.z + DOCKS.w / 2 + 0.45);
      plane(DOCKS.w + 1.4, 0.6, MAT.hazard, side * (X + 0.26), DOCKS.h + 0.5, d.z, 0, side > 0 ? Math.PI / 2 : -Math.PI / 2);
      box(0.08, 0.08, 0.6, MAT.steelDark, side * (X + 0.6), DOCKS.h + 1.0, d.z + DOCKS.w / 2 + 1.0); var lens = box(0.3, 0.2, 0.3, glowMat(0xfff2c0, 0.2), side * (X + 0.9), DOCKS.h + 0.95, d.z + DOCKS.w / 2 + 1.0); yard.lampLenses.push(lens);
      var dl2 = new THREE.PointLight(0xfff2c0, 0, 16, 2); dl2.position.set(side * (X + 2.2), DOCKS.h + 0.5, d.z + 0.8); dl2.userData.k = 1.0; scene.add(dl2); yardLights.push(dl2);   // the apron under the shelter lamp is lit at night
    }
    yard.dock = yardDock; doors.forEach(yardDock);
    // the fence: mesh panels between posts, with a sliding gate on each truck side and the gatehouse beside it
    var FPOST = std({ color: 0x2f5d3a, roughness: 0.5, metalness: 0.5 }), FMESH = std({ map: TEX.vmesh, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x3d6b48 }), FCONC = std({ map: TEX.plaster, color: 0x9a9890, roughness: 0.95 }), FWIRE = std({ color: 0x8e949a, roughness: 0.4, metalness: 0.8 });
    function fenceRun(x0, z0, x1, z1) {
      // ang turns a y-axis cylinder laid along z onto the run (the wires); rot turns an x-long box or plane onto it (panels, rails, boards). They differ by a quarter turn, and the panels used to take the wrong one and stand across the line
      var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz), n = Math.round(len / 3), ang = Math.atan2(dx, dz), ux = dx / len, uz = dz / len, nx = uz, nz = -ux, rot = Math.atan2(-uz, ux);
      for (var i = 0; i <= n; i++) {
        var t = i / n, px = x0 + dx * t, pz = z0 + dz * t;
        box(0.08, 2.5, 0.08, FPOST, px, YARD_Y + 1.25, pz); box(0.3, 0.25, 0.3, FCONC, px, YARD_Y + 0.12, pz); box(0.12, 0.03, 0.12, FPOST, px, YARD_Y + 2.52, pz);
        var arm = box(0.04, 0.6, 0.04, FPOST, px + nx * 0.2, YARD_Y + 2.72, pz + nz * 0.2); arm.rotation.set(0, ang, -0.7, 'YXZ'); arm.position.y += 0.1;
        if (i < n) {
          var mx = x0 + dx * (t + 0.5 / n), mz = z0 + dz * (t + 0.5 / n), seg = len / n;
          var mp = plane(seg - 0.1, 2.2, FMESH, mx, YARD_Y + 1.35, mz, 0, rot); mp.receiveShadow = false;
          [0.75, 1.65].forEach(function (vy) { var fold = box(seg - 0.1, 0.06, 0.03, FPOST, mx, YARD_Y + vy, mz); fold.rotation.y = rot; });
          var gb = box(seg, 0.3, 0.05, FCONC, mx, YARD_Y + 0.15, mz); gb.rotation.y = rot; var tr = box(seg, 0.03, 0.03, FPOST, mx, YARD_Y + 2.46, mz); tr.rotation.y = rot; var br = box(seg, 0.03, 0.03, FPOST, mx, YARD_Y + 0.32, mz); br.rotation.y = rot;
        }
      }
      [0, 1, 2].forEach(function (k) { var wy = YARD_Y + 2.62 + k * 0.17, wo = 0.22 + k * 0.14; var wire = cyl(0.006, len, FWIRE, (x0 + x1) / 2 + nx * wo, wy, (z0 + z1) / 2 + nz * wo, null, 4); wire.rotation.x = Math.PI / 2; wire.rotation.z = 0; wire.rotation.order = 'YXZ'; wire.rotation.y = ang; });
    }
    fenceRun(-84, -60, 84, -60); fenceRun(-84, 60, 84, 60);
    [-1, 1].forEach(function (side) {
      var gx = side * 84; if (side < 0) { fenceRun(gx, -60, gx, -36.6); fenceRun(gx, -31.4, gx, -11.5); } else fenceRun(gx, -60, gx, -11.5); fenceRun(gx, 3.5, gx, 60);   // a second gap in the west fence for the IN 3 lane
      // two barrier lanes, an island between them, and the gatehouse with the guard
      [[-8, 'IN'], [0, 'OUT']].forEach(function (lane) {
        var lz = lane[0], post = cyl(0.1, 1.2, MAT.steelDark, gx, YARD_Y + 0.6, lz + 3.2, null, 10); box(0.5, 0.9, 0.4, MAT.hazard, gx, YARD_Y + 0.45, lz + 3.2); box(0.3, 0.35, 0.3, MAT.steelDark, gx, YARD_Y + 1.1, lz + 3.2);
        var arm = new THREE.Group(); arm.userData.dynamic = true; arm.position.set(gx, YARD_Y + 1.05, lz + 3.0); scene.add(arm);
        var bar = box(0.1, 0.1, 6.2, MAT.white, 0, 0, -3.1, arm); for (var s = 0; s < 6; s += 2) box(0.102, 0.102, 0.95, MAT.red, 0, 0, -0.5 - s, arm); box(0.16, 0.6, 0.16, MAT.black, 0, -0.1, 0.1, arm); cyl(0.04, 0.5, MAT.steelDark, 0, -0.4, -5.9, arm, 8);
        yard.gates.push({ g: arm, side: side, z: lz, open: 0 });
        cyl(0.1, 1.2, MAT.steelDark, gx, YARD_Y + 0.6, lz - 3.2, null, 10); box(0.5, 0.9, 0.4, MAT.hazard, gx, YARD_Y + 0.45, lz - 3.2);
        for (var sb = 0; sb < 3; sb++) plane(1.6, 0.5, MAT.hazard, gx + side * (6 + sb * 2.5), YARD_Y + 0.013, lz, -Math.PI / 2);   // the speed bumps
        sign([lane[1]], 0.9, 0.5, gx + side * 2.5, YARD_Y + 2.6, lz, side > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 128, bg: '#1b232c', fg: '#f5b53d' }); cyl(0.04, 2.6, MAT.steelDark, gx + side * 2.5, YARD_Y + 1.3, lz - 0.5, null, 6);
      });
      box(0.6, 0.3, 4.2, MAT.grey, gx, YARD_Y + 0.15, -4); cyl(0.1, 1.0, MAT.yellow, gx, YARD_Y + 0.5, -2.2, null, 10); cyl(0.1, 1.0, MAT.yellow, gx, YARD_Y + 0.5, -5.8, null, 10);
      // the gatehouse: glazed on three sides, a counter, a door at the back, a roof with an overhang, the guard inside
      var hx = gx - side * 0.2, hz = 6.3;
      box(2.8, 0.2, 2.8, MAT.grey, hx, YARD_Y + 0.1, hz); box(2.8, 1.0, 0.12, MAT.plaster, hx, YARD_Y + 0.7, hz - 1.34); box(0.12, 1.0, 2.8, MAT.plaster, hx - side * 1.34, YARD_Y + 0.7, hz); box(0.12, 1.0, 2.8, MAT.plaster, hx + side * 1.34, YARD_Y + 0.7, hz); box(2.8, 2.6, 0.12, MAT.plaster, hx, YARD_Y + 1.5, hz + 1.34);
      [[0, -1.34, 0], [-1.34, 0, 1], [1.34, 0, 1]].forEach(function (wl) { var gl = box(wl[2] ? 0.04 : 2.6, 1.3, wl[2] ? 2.6 : 0.04, MAT.glass, hx + (wl[2] ? wl[0] * side : 0), YARD_Y + 1.85, hz + wl[1], null); gl.userData.noBake = true; });
      [[0, -1.34, 0], [-1.34, 0, 1], [1.34, 0, 1]].forEach(function (wl) { for (var c = -0.9; c <= 0.9; c += 0.9) cyl(0.025, 1.3, MAT.steelDark, hx + (wl[2] ? wl[0] * side : c), YARD_Y + 1.85, hz + (wl[2] ? c : wl[1]), null, 6); });
      [[-1.34, -1.34], [1.34, -1.34], [-1.34, 1.34], [1.34, 1.34]].forEach(function (cn) { box(0.12, 2.8, 0.12, MAT.steelDark, hx + cn[0] * side, YARD_Y + 1.4, hz + cn[1]); });
      box(3.6, 0.16, 3.6, MAT.roof, hx, YARD_Y + 2.88, hz); box(3.4, 0.08, 3.4, MAT.steelDark, hx, YARD_Y + 2.98, hz); box(0.9, 2.1, 0.08, MAT.steelDark, hx, YARD_Y + 1.05, hz + 1.36); box(0.08, 0.03, 0.14, MAT.chrome, hx + 0.3, YARD_Y + 1.05, hz + 1.42);
      box(2.2, 0.06, 0.5, MAT.wood, hx, YARD_Y + 1.1, hz - 0.9); box(0.3, 0.25, 0.04, MAT.black, hx - side * 0.5, YARD_Y + 1.28, hz - 0.95); box(0.12, 0.2, 0.06, MAT.black, hx + side * 0.6, YARD_Y + 1.25, hz - 0.9); cyl(0.04, 0.09, MAT.white, hx, YARD_Y + 1.17, hz - 0.8, null, 10);
      box(0.9, 0.04, 0.5, MAT.hazard, hx, YARD_Y + 3.1, hz - 1.6); var gl2 = box(0.25, 0.25, 0.25, glowMat(0xffa000, 0.8), hx, YARD_Y + 3.25, hz - 1.6); yard.lampLenses.push(gl2);
      var gll = new THREE.PointLight(0xffb040, 0, 14, 2); gll.position.set(hx, YARD_Y + 3.0, hz - 2.2); gll.userData.k = 0.9; scene.add(gll); yardLights.push(gll);
      sign(['GATE ' + (side < 0 ? 'WEST' : 'EAST')], 1.8, 0.4, hx, YARD_Y + 2.6, hz - 1.42, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' });
      sign(['STOP', 'REPORT TO THE GATE'], 1.0, 1.0, gx + side * 10, YARD_Y + 2.2, -4, side > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#c8342a', fg: '#fff', size: 52 }); cyl(0.04, 2.2, MAT.steelDark, gx + side * 10, YARD_Y + 1.1, -4, null, 6);
      var guard = makeHuman({ vest: MAT.hivis, cap: true, capMat: MAT.black, shirt: MAT.jeans }); guard.position.set(hx, YARD_Y + 0.2, hz - 0.2); guard.userData.baseY = YARD_Y + 0.2; guard.rotation.y = Math.PI; scene.add(guard); yard.guards.push({ g: guard, side: side });
    });
    // the staff car park, the smoking shelter, the dumpster, the flag
    for (var b = 0; b < 7; b++) plane(0.12, 5.5, MAT.whiteLine, -29 + b * 2.7, YARD_Y + 0.012, 31, -Math.PI / 2);
    plane(16.2, 0.12, MAT.whiteLine, -20.9, YARD_Y + 0.012, 28.25, -Math.PI / 2);
    // the neighbours across the fence, each with its own dock doors and a name
    [[-130, -30, 40, 9, 32, 'NORTHGATE LOGISTICS', 0], [128, -24, 44, 8, 30, 'VOLT & CO. DISTRIBUTION', 0], [-118, 70, 34, 7, 26, 'FAIRLANE FREIGHT', 1], [0, 150, 90, 12, 40, 'KESSLER WHOLESALE', 1], [136, 82, 40, 10, 30, 'PINECREST STORAGE', 1], [-44, -124, 50, 9, 28, 'LITTLE WONDERS DC', 0]].forEach(function (b) {
      var NB = std({ map: TEX.corrugated, color: pick([0xd8dcdf, 0xc9d3dc, 0xe2e0d8, 0xcfd6c9]), roughness: 0.5, metalness: 0.3, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(0.8, 0.8) }); box(b[2], b[3], b[4], NB, b[0], YARD_Y + b[3] / 2, b[1]); box(b[2] + 0.1, 1.4, b[4] + 0.1, MAT.brick, b[0], YARD_Y + 0.7, b[1]); box(b[2] + 0.12, 0.8, b[4] + 0.12, std({ color: pick([0x1f4e8c, 0xb3261e, 0x2f6b3a, 0xe0862a]), roughness: 0.5 }), b[0], YARD_Y + b[3] - 2.6, b[1]);
      for (var rib = -b[2] / 2; rib <= b[2] / 2; rib += 4) box(0.3, b[3] - 1.4, b[4] + 0.2, MAT.steelDark, b[0] + rib, YARD_Y + 1.4 + (b[3] - 1.4) / 2, b[1]);
      var face = b[6] ? -1 : 1, fz = b[1] - face * (b[4] / 2 + 0.05), fry = b[6] ? Math.PI : 0;
      for (var d = -b[2] / 2 + 6; d < b[2] / 2 - 4; d += 8) { var dr = plane(3.6, 4.2, MAT.door, b[0] + d, YARD_Y + 2.1, fz, 0, fry); dr.receiveShadow = false; box(4.4, 0.15, 1.6, MAT.steelDark, b[0] + d, YARD_Y + 4.6, fz - face * 0.8); box(4.4, 0.9, 0.2, MAT.hazard, b[0] + d, YARD_Y + 4.8, fz - face * 0.1); if (Math.random() < 0.45) { var tr = box(2.5, 2.7, 9, std({ color: pick([0xe9ecef, 0xc9ced3, 0xdfe3e6]), roughness: 0.5, metalness: 0.2 }), b[0] + d, YARD_Y + 2.1, fz - face * 5.2); box(2.5, 0.4, 9, MAT.steelDark, b[0] + d, YARD_Y + 0.6, fz - face * 5.2); [-0.9, 0.9].forEach(function (wx) { for (var tw = 0; tw < 2; tw++) { var tyreM = cyl(0.5, 0.3, MAT.rubber, b[0] + d + wx, YARD_Y + 0.5, fz - face * (8.2 + tw * 1.2), null, 16); tyreM.rotation.z = Math.PI / 2; } }); cyl(0.06, 1.0, MAT.steelDark, b[0] + d - 0.9, YARD_Y + 0.5, fz - face * 1.8, null, 6); cyl(0.06, 1.0, MAT.steelDark, b[0] + d + 0.9, YARD_Y + 0.5, fz - face * 1.8, null, 6); } }
      sign([b[5]], b[2] * 0.7, b[2] * 0.09, b[0], YARD_Y + b[3] - 1.2, fz, fry, { w: 1024, h: 128, bg: '#2a2f36', fg: '#d8dbdf' });
      for (var u = 0; u < 3; u++) box(2.5, 1.2, 2.5, MAT.grey, b[0] - b[2] / 3 + u * b[2] / 3, YARD_Y + b[3] + 0.6, b[1] + randf(-3, 3));
      box(b[2] + 0.4, 0.5, b[4] + 0.4, MAT.steelDark, b[0], YARD_Y + b[3] + 0.2, b[1]); for (var rv = -b[2] / 2 + 5; rv < b[2] / 2; rv += 10) { cyl(0.5, 1.0, MAT.steel, b[0] + rv, YARD_Y + b[3] + 0.9, b[1] - 4, null, 12); cyl(0.65, 0.2, MAT.steelDark, b[0] + rv, YARD_Y + b[3] + 1.45, b[1] - 4, null, 12); } box(b[2] * 0.3, 3.2, 0.3, MAT.brick, b[0] + b[2] * 0.3, YARD_Y + 1.6, fz - face * 0.1);
      for (var wn = -b[2] / 2 + 2; wn < b[2] / 2 - 2; wn += 3) { var wp = plane(1.6, 1.0, MAT.glass, b[0] + wn, YARD_Y + b[3] - 2.2, fz - face * 0.02, 0, fry); wp.userData.noBake = true; }
      var dr2 = plane(1.0, 2.1, MAT.door, b[0] + b[2] * 0.3, YARD_Y + 1.05, fz - face * 0.12, 0, fry); dr2.receiveShadow = false; box(0.3, 0.1, 0.3, MAT.steelDark, b[0] + b[2] * 0.3, YARD_Y + 2.5, fz - face * 0.3); var nl = box(0.3, 0.08, 0.2, glowMat(0xfff2c0, 0.2), b[0] + b[2] * 0.3, YARD_Y + 2.42, fz - face * 0.4); yard.lampLenses.push(nl);
      for (var bo = -b[2] / 2 + 3; bo < b[2] / 2; bo += 6) cyl(0.12, 1.0, MAT.yellow, b[0] + bo, YARD_Y + 0.5, fz - face * 1.2, null, 8);
    });
    // the road: two lanes, dashes, kerbs, lamp posts, and the traffic that uses it
    plane(260, 11, MAT.yard, 0, YARD_Y + 0.01, 75, -Math.PI / 2); box(260, 0.15, 0.3, MAT.grey, 0, YARD_Y + 0.07, 69.4); box(260, 0.15, 0.3, MAT.grey, 0, YARD_Y + 0.07, 80.6);
    for (var i = -120; i < 120; i += 6) plane(3, 0.2, MAT.whiteLine, i, YARD_Y + 0.02, 75, -Math.PI / 2);
    for (var lp = -110; lp <= 110; lp += 28) { cyl(0.06, 7, MAT.steelDark, lp, YARD_Y + 3.5, 81.5, null, 8, 0.09); box(0.08, 0.08, 1.4, MAT.steelDark, lp, YARD_Y + 6.9, 80.8); var ll = box(0.5, 0.14, 0.32, glowMat(0xfff2c0, 0.2), lp, YARD_Y + 6.85, 80.2); yard.lampLenses.push(ll); }
    for (var c = 0; c < 8; c++) { var cm = carMesh(pick(CAR_COLS)); var dir = c % 2 ? -1 : 1; cm.position.set(randf(-120, 120), YARD_Y, dir > 0 ? 72.5 : 77.5); cm.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(cm); yard.traffic.push({ g: cm, dir: dir, v: randf(9, 14) }); }
    // the yard, worked: tyre marks on the aprons where the trucks swing in and oil where they stand, pallets stacked by the inbound
    // docks, a skip by the dumpster, an empty trailer dropped on the far side, weeds along every fence line
    var yMarkTex = tex(256, 64, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 2; i++) { var g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(0,0,0,0.4)'); g.addColorStop(0.7, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 10 + i * 30, w, 12); } for (var k = 0; k < 400; k++) { c.fillStyle = 'rgba(0,0,0,' + randf(0.05, 0.25) + ')'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 3), randf(1, 2)); } });
    var yMarkMat = new THREE.MeshBasicMaterial({ map: yMarkTex, transparent: true, depthWrite: false, opacity: 0.75 }); yMarkMat.userData.noBake = true;
    var yOilTex = tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 5; i++) { var r = randf(14, 40), x = randf(r, w - r), y = randf(r, h - r), g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(6,6,8,0.55)'); g.addColorStop(0.7, 'rgba(6,6,8,0.25)'); g.addColorStop(1, 'rgba(6,6,8,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } });
    var yOilMat = new THREE.MeshBasicMaterial({ map: yOilTex, transparent: true, depthWrite: false }); yOilMat.userData.noBake = true;
    doors.forEach(function (d) {
      for (var k = 0; k < 3; k++) { var m = plane(9, 1.5, yMarkMat, d.side * (X + 6 + k * 7.5), YARD_Y + 0.014, d.z + randf(-0.6, 0.6), -Math.PI / 2, 0); m.rotation.z = randf(-0.05, 0.05); m.renderOrder = 1; m.userData.noBake = true; }
      var o = plane(2.6, 2.6, yOilMat, d.side * (X + 9), YARD_Y + 0.015, d.z + randf(-0.8, 0.8), -Math.PI / 2, 0); o.rotation.z = randf(0, 3); o.renderOrder = 1; o.userData.noBake = true;
    });
    var sceneCtx = { add: function (m) { scene.add(m); return m; } };
    [[-X - 2.6, 1.2, 5], [-X - 2.6, 2.6, 7], [X + 2.6, 1.3, 4]].forEach(function (p) { for (var i = 0; i < p[2]; i++) palletModel(sceneCtx, p[0] + randf(-0.02, 0.02), YARD_Y + i * 0.128, p[1] + randf(-0.02, 0.02), randf(-0.03, 0.03)); solid(p[0] - 0.65, p[0] + 0.65, p[1] - 0.55, p[1] + 0.55, YARD_Y, YARD_Y + 1.2); });
    // the skip: a steel box with sloped ends, lifting lugs, hazard stripes, the hire firm's name, cardboard showing over the lip
    (function () { var sx = X + 7, sz = 21, SK = std({ color: 0x9a8a2a, roughness: 0.6, metalness: 0.4 }); box(3.4, 1.5, 1.7, SK, sx, YARD_Y + 0.75, sz); [-1, 1].forEach(function (e) { var end = box(1.1, 1.5, 1.7, SK, sx + e * 1.95, YARD_Y + 0.75, sz); end.rotation.z = e * 0.35; [-0.6, 0.6].forEach(function (lz) { box(0.12, 0.3, 0.12, MAT.steelDark, sx + e * 1.6, YARD_Y + 1.6, sz + lz); }); }); plane(3.4, 0.25, MAT.hazard, sx, YARD_Y + 1.42, sz + 0.86, 0, 0); plane(3.4, 0.25, MAT.hazard, sx, YARD_Y + 1.42, sz - 0.86, 0, Math.PI); sign(['HILLSIDE SKIPS · 0800 300 300'], 2.2, 0.3, sx, YARD_Y + 0.95, sz + 0.86, 0, { w: 512, h: 72, bg: '#2a2d33', fg: '#eef1f5' }); for (var cb = 0; cb < 6; cb++) { var card = box(randf(0.5, 0.9), 0.1, randf(0.4, 0.7), MAT.parcel, sx + randf(-1.2, 1.2), YARD_Y + 1.45 + cb * 0.04, sz + randf(-0.5, 0.5)); card.rotation.y = randf(0, 3); card.rotation.z = randf(-0.3, 0.3); } solid(sx - 2.4, sx + 2.4, sz - 0.9, sz + 0.9, YARD_Y, YARD_Y + 1.6); })();
    // an empty trailer dropped on its landing legs at the far side of the yard, nose to the road
    (function () { var tx = 54, tz = 46, TR = std({ map: TEX.corrugated, color: 0xdfe3e6, roughness: 0.55, metalness: 0.25, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(0.8, 0.8) }); box(2.5, 2.7, 12, TR, tx, YARD_Y + 2.1, tz); box(2.5, 0.4, 12, MAT.steelDark, tx, YARD_Y + 0.6, tz); [-0.9, 0.9].forEach(function (wx) { for (var tw = 0; tw < 2; tw++) { var ty = cyl(0.5, 0.3, MAT.rubber, tx + wx, YARD_Y + 0.5, tz - 3.6 - tw * 1.3, null, 16); ty.rotation.z = Math.PI / 2; } }); cyl(0.06, 1.0, MAT.steelDark, tx - 0.9, YARD_Y + 0.5, tz + 3.8, null, 6); cyl(0.06, 1.0, MAT.steelDark, tx + 0.9, YARD_Y + 0.5, tz + 3.8, null, 6); box(2.5, 2.7, 0.08, MAT.steelDark, tx, YARD_Y + 2.1, tz + 6.0); sign(['DEPOT CO. · DROP TRAILER'], 2.0, 0.3, tx - 1.26, YARD_Y + 1.6, tz, -Math.PI / 2, { w: 512, h: 72, bg: '#1b232c', fg: '#a0acb8' }); box(0.3, 0.1, 0.3, MAT.yellow, tx - 1.0, YARD_Y + 0.05, tz - 4.9); solid(tx - 1.3, tx + 1.3, tz - 6, tz + 6.1, YARD_Y, YARD_Y + 3); })();
    for (var wd2 = -58; wd2 <= 58; wd2 += randf(2.5, 5)) { [[-83.4, wd2], [83.4, wd2]].forEach(function (p) { var wg = new THREE.Mesh(new THREE.IcosahedronGeometry(randf(0.15, 0.35), 0), WEED); wg.position.set(p[0] + randf(-0.3, 0.3), YARD_Y + 0.08, p[1]); wg.scale.y = 0.6; scene.add(wg); }); }
    for (var wd3 = -82; wd3 <= 82; wd3 += randf(2.5, 5)) { var wg2 = new THREE.Mesh(new THREE.IcosahedronGeometry(randf(0.15, 0.35), 0), WEED); wg2.position.set(wd3, YARD_Y + 0.08, -59.4 + randf(-0.3, 0.3)); wg2.scale.y = 0.6; scene.add(wg2); }
    // the sky: a sun, a moon, clouds; the weather: puddles, rain, snow
    var sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(255,244,214,1)'), transparent: true, depthWrite: false, fog: false })); sunSp.scale.set(26, 26, 1); scene.add(sunSp); yard.sunDisc = sunSp;
    var moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(225,230,240,0.9)'), transparent: true, depthWrite: false, fog: false })); moonSp.scale.set(12, 12, 1); scene.add(moonSp); yard.moon = moonSp;
    var ct = cloudTex();
    for (var k = 0; k < 10; k++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.85, fog: false })); var s = randf(50, 90); sp.scale.set(s, s * 0.5, 1); sp.position.set(randf(-200, 200), randf(70, 100), randf(-200, 200)); scene.add(sp); yard.clouds.push({ sp: sp, v: randf(0.6, 1.4) }); }
    for (var p = 0; p < 12; p++) { var pm = new THREE.Mesh(new THREE.CircleGeometry(randf(1.2, 3.2), 18), std({ color: 0x151a22, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0 })); pm.rotation.x = -Math.PI / 2; pm.position.set(randf(-70, 70), YARD_Y + 0.02, randf(-50, 50)); pm.scale.x = randf(1, 2.2); scene.add(pm); yard.puddles.push(pm); }
    var streak = tex(16, 64, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(210,225,240,0)'); g.addColorStop(0.5, 'rgba(210,225,240,0.9)'); g.addColorStop(1, 'rgba(210,225,240,0)'); c.fillStyle = g; c.fillRect(6, 0, 4, h); });
    var flake = tex(32, 32, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    var mkPoints = function (n, size, map, range) { var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3); for (var i = 0; i < n; i++) { pos[i * 3] = randf(-range, range); pos[i * 3 + 1] = randf(0, 16); pos[i * 3 + 2] = randf(-range, range); } geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); var pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: map, size: size, transparent: true, opacity: 0.85, depthWrite: false, alphaTest: 0.05 })); pts.visible = false; pts.frustumCulled = false; scene.add(pts); return pts; };
    yard.rain = mkPoints(7000, 0.26, streak, 24); yard.rain.material.opacity = 0.5; yard.rain.material.color.setHex(0xc7d3de); yard.snow = mkPoints(3000, 0.22, flake, 30);   // a drop is a thin grey streak, not a white blob
  }

  function tickYard(dt) {
    yard.windT += dt;
    // gates slide open while a truck is coming in or going out on that side
    yard.gates.forEach(function (g) { var want = S.trucks.some(function (t) { return t.side === g.side && Math.abs(t.z - g.z) < 2 && (t.state === 'coming' || t.state === 'leaving') && Math.abs(t.x) > 62 && Math.abs(t.x) < 100; }) ? 1 : 0; var was = g.open; g.open = lerp(g.open, want, 1 - Math.pow(0.03, dt)); if (want && was < 0.05 && g.open >= 0.05) sfx('gate'); g.g.rotation.x = -g.open * 1.35; });
    yard.guards.forEach(function (gd) { var near = dist2(player.x, player.z, gd.g.position.x, gd.g.position.z) < 64; animateHuman(gd.g, dt, 'idle', 0, near ? { x: player.x, y: player.y + 1.6, z: player.z } : null, false); });
    yard.traffic.forEach(function (c) { c.g.position.x += c.dir * c.v * dt; if (c.g.position.x > 130) c.g.position.x = -130; if (c.g.position.x < -130) c.g.position.x = 130; });
    if (yard.flagMesh) { var w = S.weather ? S.weather.wind : 0.4; yard.flag.rotation.y = Math.sin(yard.windT * 0.7) * 0.3 * w; var pos = yard.flagMesh.geometry.attributes.position; for (var i = 0; i < pos.count; i++) { var x = pos.getX(i); pos.setZ(i, Math.sin(yard.windT * 4 + x * 3) * 0.08 * (0.3 + w) * x); } pos.needsUpdate = true; }
    if (yard.dome) { yard.dome.position.x = camera.position.x; yard.dome.position.z = camera.position.z; }
    yard.clouds.forEach(function (c) { c.sp.position.x += c.v * dt * (S.weather ? 0.5 + S.weather.wind : 1); if (c.sp.position.x > 240) c.sp.position.x = -240; });
    // the sun and the moon ride opposite each other
    if (yard.sunDisc) { _v.copy(sun.position).normalize(); yard.sunDisc.position.copy(_v).multiplyScalar(200).add(camera.position); yard.sunDisc.material.opacity = clamp(_v.y * 4, 0, 1); yard.moon.position.copy(_v).multiplyScalar(-200).add(camera.position); yard.moon.position.y = Math.abs(yard.moon.position.y - camera.position.y) + camera.position.y + 20; yard.moon.material.opacity = clamp(-_v.y * 3 + 0.4, 0, 0.9); }
    // weather
    var W = S.weather || { kind: 'clear', wet: 0, snow: 0, wind: 0.4 };
    var raining = W.kind === 'rain' || W.kind === 'storm', snowing = W.kind === 'snow';
    yard.rain.visible = raining; yard.snow.visible = snowing;
    if (raining) { var p = yard.rain.geometry.attributes.position.array, px = player.x, pz = player.z; for (var r = 0; r < p.length; r += 3) { p[r + 1] -= (9 + (W.kind === 'storm' ? 4 : 0)) * dt; var inWg = inWing(p[r], p[r + 2]), inHall = (Math.abs(p[r]) < HALL.x && Math.abs(p[r + 2]) < HALL.z) || inWg, roofY = inWg ? WING.h + 0.3 : inHall ? HALL.h + 0.3 : YARD_Y; if (!inHall) for (var tk = 0; tk < S.trucks.length; tk++) { var tb = trailerBounds(S.trucks[tk]); if (p[r] > tb.x0 - 3.5 && p[r] < tb.x1 + 3.5 && p[r + 2] > tb.z0 - 0.4 && p[r + 2] < tb.z1 + 0.4) { roofY = TRAILER.h + 0.1; break; } } if (p[r + 1] < roofY || Math.abs(p[r] - px) > 26 || Math.abs(p[r + 2] - pz) > 26) { p[r] = px + randf(-24, 24); p[r + 2] = pz + randf(-24, 24); var rf = inWing(p[r], p[r + 2]) ? WING.h + 0.6 : (Math.abs(p[r]) < HALL.x && Math.abs(p[r + 2]) < HALL.z) ? HALL.h + 0.6 : 6; p[r + 1] = randf(rf, 16); } } yard.rain.geometry.attributes.position.needsUpdate = true; }
    if (snowing) { var q = yard.snow.geometry.attributes.position.array, qx = player.x, qz = player.z; for (var s = 0; s < q.length; s += 3) { q[s + 1] -= 1.3 * dt; q[s] += Math.sin(yard.windT + s) * 0.4 * dt; var inH = (Math.abs(q[s]) < HALL.x && Math.abs(q[s + 2]) < HALL.z) || inWing(q[s], q[s + 2]); if (q[s + 1] < (inWing(q[s], q[s + 2]) ? WING.h + 0.3 : inH ? HALL.h + 0.3 : YARD_Y) || Math.abs(q[s] - qx) > 32 || Math.abs(q[s + 2] - qz) > 32) { q[s] = qx + randf(-30, 30); q[s + 2] = qz + randf(-30, 30); var sf = inWing(q[s], q[s + 2]) ? WING.h + 0.6 : (Math.abs(q[s]) < HALL.x && Math.abs(q[s + 2]) < HALL.z) ? HALL.h + 0.6 : 6; q[s + 1] = randf(sf, 16); } } yard.snow.geometry.attributes.position.needsUpdate = true; }
    yard.puddles.forEach(function (pm) { pm.material.opacity = W.wet * 0.85; });
    var snowCol = 0xdfe4e9; MAT.yard.color.setHex(0xffffff).lerp(new THREE.Color(snowCol), W.snow * 0.9); MAT.grass.color.setHex(0xffffff).lerp(new THREE.Color(0xf4f6f8), W.snow);
    var overcast = raining ? 0.75 : snowing ? 0.6 : W.kind === 'overcast' ? 0.5 : 0;
    yard.clouds.forEach(function (c) { c.sp.material.color.setScalar(1 - overcast * 0.55); c.sp.material.opacity = 0.5 + overcast * 0.5; });
  }
  // ── Instanced goods ───────────────────────────────────────────────
  // Every box, pallet base and parcel in the world is one instance of three shared meshes, laid out again each
  // frame from the save state. Nothing is ever out of sync with the save because there is no second copy.
  var BOX = { w: 0.55, h: 0.42, d: 0.45 };
  var BOX_GEO = boxGeo(BOX.w, BOX.h, BOX.d), PARCEL_GEO = boxGeo(0.6, 0.46, 0.5), PALLET_GEO = boxGeo(1.2, 0.14, 1.0);
  var boxInst = {}, instSrc = { box: {}, pallet: [], parcel: [] }, instList = [];
  function mkInst(geo, mat, cap) { var im = new THREE.InstancedMesh(geo, mat, cap); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); instList.push(im); return im; }
  SKUS.forEach(function (s) { boxInst[s.id] = mkInst(BOX_GEO, CARD[s.id], 1400); boxInst[s.id].userData.sku = s.id; instSrc.box[s.id] = []; });
  var palletInst = mkInst(PALLET_GEO, MAT.wood, 400); palletInst.userData.pallet = true;
  var parcelInst = mkInst(PARCEL_GEO, MAT.parcel, 400); parcelInst.userData.parcel = true;
  // the sortation deck's forms: a sea crate, a strapped land parcel, an air bag; one instanced mesh each, looked at like any parcel
  var CRATE_GEO = boxGeo(0.72, 0.56, 0.6), FORM_INST = { crate: mkInst(CRATE_GEO, MAT.crate, 200), strap: mkInst(PARCEL_GEO, MAT.strapped, 200), pouch: mkInst(PARCEL_GEO, MAT.airbox, 200) };
  for (var fk in FORM_INST) { FORM_INST[fk].userData.parcelForm = fk; instSrc[fk] = []; }
  var counts = {};
  function setInst(im, i, x, y, z, ry) { _e.set(0, ry || 0, 0); _q.setFromEuler(_e); _m4.compose(_v.set(x, y, z), _q, _s1); im.setMatrixAt(i, _m4); }
  function putBox(sku, x, y, z, ry, src) { var im = boxInst[sku]; if (!im) return; var i = counts[sku]++; if (i >= 1400) return; setInst(im, i, x, y, z, ry); instSrc.box[sku][i] = src; }
  function putPallet(x, y, z, ry, src) { var i = counts.pallet++; if (i >= 400) return; setInst(palletInst, i, x, y, z, ry); instSrc.pallet[i] = src; }
  function putParcel(x, y, z, ry, src, form) { if (form && FORM_INST[form]) { var j = counts[form]++; if (j >= 200) return; setInst(FORM_INST[form], j, x, y + (form === 'crate' ? 0.05 : 0), z, ry); instSrc[form][j] = src; return; } var i = counts.parcel++; if (i >= 400) return; setInst(parcelInst, i, x, y, z, ry); instSrc.parcel[i] = src; }
  // boxes on a pallet: four to a layer, up to three layers
  function boxOffset(i, ry) { var layer = Math.floor(i / 4), k = i % 4, ox = k % 2 ? 0.29 : -0.29, oz = k < 2 ? -0.24 : 0.24; var c = Math.cos(ry || 0), s = Math.sin(ry || 0); return { x: ox * c + oz * s, z: -ox * s + oz * c, y: 0.14 + BOX.h / 2 + layer * BOX.h }; }
  function drawPalletWithBoxes(sku, n, x, y, z, ry, src) { putPallet(x, y + 0.07, z, ry, src); for (var i = 0; i < n; i++) { var o = boxOffset(i, ry); putBox(sku, x + o.x, y + o.y, z + o.z, ry, src); } }

  function palletWorld(p) {
    if (p.place === 'floor') return { x: p.x, y: p.y || 0, z: p.z, ry: p.rot || 0 };
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t) return null; return truckPalletPos(t, p.idx); }
    if (p.place === 'jack') { var jw = toolWorld(p.jack || 'jack'); return { x: jw.x, y: 0.1, z: jw.z, ry: jw.ry }; }
    if (p.place === 'fork') { var fw = forkTip(); return { x: fw.x, y: fw.y, z: fw.z, ry: S.fork.yaw }; }
    if (p.place === 'staff') { var st = staffById(p.staff); if (!st) return null; return { x: st.x + Math.sin(st.yaw) * STAFF_JACK.push, y: 0.1, z: st.z + Math.cos(st.yaw) * STAFF_JACK.push, ry: st.yaw }; }   /* on the forks of the jack they push, see jackFollow */
    if (p.place === 'lift') { var LL = liftState(); return { x: UPPER.lift.x, y: LL.pos * UPPER.y + 0.2, z: UPPER.lift.z, ry: 0 }; }
    if (p.place === 'agv') { var A = S.agv; if (!A) return null; return { x: A.x + Math.sin(A.yaw) * 1.0, y: 0.18, z: A.z + Math.cos(A.yaw) * 1.0, ry: A.yaw }; }
    return null;
  }
  function syncInstances() {
    SKUS.forEach(function (s) { counts[s.id] = 0; }); counts.pallet = 0; counts.parcel = 0; counts.crate = 0; counts.strap = 0; counts.pouch = 0;
    for (var key in S.slots) { var sl = S.slots[key]; if (!sl || (!sl.n && !sl.pal)) continue; var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l); drawPalletWithBoxes(sl.sku, sl.n, sp.x, sp.y, sp.z, sp.ry || 0, { kind: 'slot', key: key }); }
    S.pallets.forEach(function (pl) { var w = palletWorld(pl); if (!w) return; drawPalletWithBoxes(pl.sku, pl.n, w.x, w.y, w.z, w.ry, { kind: 'pallet', id: pl.id, carried: pl.place !== 'floor' && pl.place !== 'truck' }); });
    // the bench and its shelf follow the bench prop: box positions are local to it, clear of the terminal at its near end
    var BP = PROPS.bench ? propPlacement('bench') : { x: SPOT.bench.x, z: SPOT.bench.z, rot: 0 }, ba = BP.rot * Math.PI / 2, bc = Math.cos(ba), bs = Math.sin(ba);
    var benchW = function (lx, lz) { return { x: BP.x + lx * bc + lz * bs, z: BP.z - lx * bs + lz * bc }; };
    var bi = 0; SKUS.forEach(function (s) { var n = S.bench.boxes[s.id] || 0; for (var i = 0; i < n; i++, bi++) { var w = benchW(bi % 2 ? 0.23 : -0.23, -0.72 + (Math.floor(bi / 2) % 4) * 0.6); putBox(s.id, w.x, 0.94 + BOX.h / 2 + Math.floor(bi / 8) * BOX.h, w.z, ba, { kind: 'bench', sku: s.id }); } });
    var LP = PROPS.packline ? propPlacement('packline') : BP, la = LP.rot * Math.PI / 2, lc = Math.cos(la), ls = Math.sin(la);
    S.bench.parcels.forEach(function (oid, i) { var s = shelfSlot(i); putParcel(LP.x + s.lx * lc + s.lz * ls, s.y, LP.z - s.lx * ls + s.lz * lc, la, { kind: 'shelf', order: oid }, parcelForm(oid)); });
    drawBeltItems(); drawSorterItems();
    S.floor.forEach(function (f, i) { if (f.kind === 'box') { if (f.damaged) { var im = boxInst[f.sku]; if (im) { var ii = counts[f.sku]++; if (ii < 1400) { _e.set(0, f.rot, 0.35); _q.setFromEuler(_e); _v2.set(1, 0.72, 1.08); _m4.compose(_v.set(f.x, f.y + BOX.h * 0.36, f.z), _q, _v2); im.setMatrixAt(ii, _m4); instSrc.box[f.sku][ii] = { kind: 'floor', idx: i }; } } } else putBox(f.sku, f.x, f.y + BOX.h / 2, f.z, f.rot, { kind: 'floor', idx: i }); } else putParcel(f.x, f.y + 0.23, f.z, f.rot, { kind: 'floor', idx: i }, parcelForm(f.order)); });
    var cw = toolWorld('cart'), cartY = [0.3, 0.82, 1.34]; S.cart.boxes.forEach(function (sku, i) { var c = Math.cos(cw.ry), s = Math.sin(cw.ry), lx = (i % 4 - 1.5) * 0.4, ly = cartY[Math.floor(i / 4)] || 1.34; putBox(sku, cw.x + lx * c, ly + BOX.h / 2, cw.z - lx * s, cw.ry, { kind: 'cart', idx: i }); });
    (S.cart.parcels || []).forEach(function (oid, j) { var i = S.cart.boxes.length + j; if (i >= ECON.cartCap) return; var c = Math.cos(cw.ry), s = Math.sin(cw.ry), lx = (i % 4 - 1.5) * 0.4, ly = cartY[Math.floor(i / 4)] || 1.34; putParcel(cw.x + lx * c, ly + 0.2, cw.z - lx * s, cw.ry, { kind: 'cart', idx: i }, parcelForm(oid)); });
    S.trucks.forEach(function (t) { if (t.dir !== 'out') return; t.parcels.forEach(function (oid, i) { var pp = truckParcelPos(t, i), po = orderById(oid); putParcel(pp.x, pp.y + 0.23, pp.z, 0, { kind: 'truck' }, po && po.form); }); });
    S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') putBox(st.carry.sku, st.x + Math.sin(st.yaw) * 0.45, 1.05, st.z + Math.cos(st.yaw) * 0.45, st.yaw, { kind: 'carried' }); if (st.carry && st.carry.kind === 'parcel') putParcel(st.x + Math.sin(st.yaw) * 0.45, 1.05, st.z + Math.cos(st.yaw) * 0.45, st.yaw, { kind: 'carried' }, parcelForm(st.carry.order)); });
    SKUS.forEach(function (s) { var im = boxInst[s.id]; im.count = Math.min(counts[s.id], 1400); im.instanceMatrix.needsUpdate = true; });
    palletInst.count = Math.min(counts.pallet, 400); palletInst.instanceMatrix.needsUpdate = true;
    parcelInst.count = Math.min(counts.parcel, 400); parcelInst.instanceMatrix.needsUpdate = true;
    for (var fk2 in FORM_INST) { FORM_INST[fk2].count = Math.min(counts[fk2], 200); FORM_INST[fk2].instanceMatrix.needsUpdate = true; }
  }
  function instSource(hit) { var o = hit.object; if (o.userData.sku) return instSrc.box[o.userData.sku][hit.instanceId]; if (o.userData.pallet) return instSrc.pallet[hit.instanceId]; if (o.userData.parcel) return instSrc.parcel[hit.instanceId]; if (o.userData.parcelForm) return instSrc[o.userData.parcelForm][hit.instanceId]; return null; }

  // ── The hand ──────────────────────────────────────────────────────
  var handGroup = new THREE.Group(); handGroup.userData.dynamic = true; camera.add(handGroup); scene.add(camera);   // never baked: it rides on the camera
  var handBox = new THREE.Mesh(BOX_GEO, CARD.paint); handBox.position.set(0.38, -0.36, -0.72); handBox.rotation.set(0.15, -0.35, 0.05); handBox.visible = false; handGroup.add(handBox);
  var handParcel = new THREE.Mesh(PARCEL_GEO, MAT.parcel); handParcel.position.set(0.38, -0.36, -0.74); handParcel.rotation.set(0.15, -0.35, 0.05); handParcel.visible = false; handGroup.add(handParcel);
  var handPlug = new THREE.Group(); handPlug.position.set(0.34, -0.3, -0.6); handPlug.rotation.set(0.2, -0.3, 0); handPlug.visible = false; handGroup.add(handPlug);
  box(0.06, 0.06, 0.14, MAT.black, 0, 0, 0, handPlug); box(0.08, 0.08, 0.04, MAT.red, 0, 0, 0.09, handPlug); cyl(0.012, 0.3, MAT.black, 0, -0.1, -0.1, handPlug, 6).rotation.x = 0.8;
  function parcelForm(oid) { var o = oid ? orderById(oid) : null; return o && o.form || null; }   // the crate, strap or bag the deck gave it, kept on the order
  function formMat(f) { return f === 'crate' ? MAT.crate : f === 'strap' ? MAT.strapped : f === 'pouch' ? MAT.airbox : MAT.parcel; }
  function updateHandMesh() { var h = S.hand; handBox.visible = !!(h && h.kind === 'box'); handParcel.visible = !!(h && h.kind === 'parcel'); if (h && h.kind === 'box') handBox.material = CARD[h.sku] || CARD.paint; if (h && h.kind === 'parcel') handParcel.material = formMat(parcelForm(h.order)); }
  function handSet(h) { S.hand = h; hudDirty = true; updateHandMesh(); }
  function handLabel() { var h = S.hand; if (!h) return null; if (h.kind === 'box') return { t: (h.damaged ? 'A damaged box of ' : 'A box of ') + skuName(h.sku), s: h.damaged ? 'bin it by the bench' : 'G puts it down' }; var o = orderById(h.order); return { t: 'Parcel #' + (o ? o.num : '?'), s: o ? 'for ' + clientName(o.client) + ' · G puts it down' : '' }; }

  // ── Rack slots ────────────────────────────────────────────────────
  function slotGet(key) { return S.slots[key] || null; }
  function slotSpace(key, sku) { var s = S.slots[key]; if (!s || !s.n) return ECON.slotCap; if (s.sku !== sku) return 0; return ECON.slotCap - s.n; }
  function slotAdd(key, sku, n) { var s = S.slots[key]; if (!s || !s.n) S.slots[key] = { sku: sku, n: n, pal: !!(s && s.pal) }; else s.n += n; }
  function slotTake(key, n) { var s = S.slots[key]; if (!s) return 0; var k = Math.min(n, s.n); s.n -= k; if (s.n <= 0) { if (s.pal) s.n = 0; else delete S.slots[key]; } return k; }   // a slot that held a pallet keeps the empty pallet
  function slotOwned(key) { var r = slotParse(key).r; return r < S.up.rows || (r === UPPER.row && upperRowsOwned() > 0) || annexRowOwned(r); }
  function stockCount(sku) { var n = 0; for (var k in S.slots) if (S.slots[k].sku === sku) n += S.slots[k].n; return n; }
  function totalStock() { var n = 0; for (var k in S.slots) n += S.slots[k].n; return n; }
  function stockSummary() { var m = {}; for (var k in S.slots) { var s = S.slots[k]; if (!s.n) continue; m[s.sku] = (m[s.sku] || 0) + s.n; } return m; }
  function slotsWith(sku) { var out = []; for (var k in S.slots) if (S.slots[k].sku === sku && S.slots[k].n > 0) out.push(k); out.sort(function (a, b) { return slotParse(a).l - slotParse(b).l; }); return out; }
  // the best slot for n boxes of a sku: a slot that already holds that sku and has the room, else an empty one; low levels first
  function findSlotFor(sku, n, maxLevel) {
    var best = null, bestScore = -1;
    var rows = groundRows();   // the main rows you own and the rows of the halls you own; the main rows fill first
    for (var ri = 0; ri < rows.length; ri++) for (var b = 0; b < rowBays(rows[ri]); b++) for (var l = 0; l <= maxLevel; l++) {
      var r = rows[ri], key = slotKey(r, b, l), s = S.slots[key], space = slotSpace(key, sku); if (space < n) continue;
      var score = (s && s.n ? 100 : 50) - l * 10 - b - (isAnnexRow(r) ? 30 : 0);
      if (score > bestScore) { bestScore = score; best = key; }
    }
    return best;
  }
  function jackReach(l) { return l <= (S.up.jackLift ? 1 : 0); }   // the floor level by hand; the second level too with the high-lift stacker; the top is forklift work
  function jackReachText() { return S.up.jackLift ? 'The stacker reaches the second level, not the top' : 'The jack only reaches the floor level'; }
  function slotPrompt(key) {
    var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
    if (p.l === RACK.top && !driving) return has ? skuName(s.sku) + ' × ' + s.n + ' · top level: forklift only' : 'Top level: forklift only';
    if (tool === 'cart') { if (has && cartLoad() < ECON.cartCap) return 'Pick a box of ' + skuName(s.sku) + ' onto the cart (' + s.n + ' here)'; return has ? 'Cart is full' : null; }
    if (tool === 'jack') { var jp = jackPallet(); if (jp) return jackReach(p.l) ? (slotSpace(key, jp.sku) >= jp.n ? 'Set the pallet into the rack' : (has ? 'Slot holds ' + skuName(s.sku) + ': no room' : null)) : jackReachText(); return has && jackReach(p.l) ? 'Pull the pallet out (' + Math.min(s.n, ECON.palletCap) + ' boxes)' : (s && s.pal && jackReach(p.l) ? 'Take the empty pallet out' : null); }
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'A damaged box does not go on the rack: bin it';
    if (S.hand && S.hand.kind === 'box') return slotSpace(key, S.hand.sku) > 0 ? 'Put the box on the rack' + (has ? ' (' + s.n + ' here)' : '') : 'Slot holds ' + skuName(s.sku) + ': no room';
    if (S.hand) return null;
    return has ? 'Take a box of ' + skuName(s.sku) + ' (' + s.n + ' here)' : 'Empty slot · ' + slotName(key);
  }
  function slotUse(key) {
    var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
    if (p.l === RACK.top && !driving) { toast('Too high. Use the forklift.', 'bad'); return; }
    if (tool === 'cart') { if (has && cartLoad() < ECON.cartCap) { S.cart.boxes.push(s.sku); slotTake(key, 1); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); } return; }
    if (isJack(tool)) {
      var jp = jackPallet(tool);
      if (jp) { if (!jackReach(p.l)) { toast(jackReachText() + '.', 'bad'); return; } if (storePallet(jp, key)) { S[tool].pallet = null; sfx('crate'); addXp(XP.pallet); toast('Pallet stored · ' + slotName(key), 'good'); introStep('putaway'); } else toast('No room in that slot.', 'bad'); return; }
      if (has && jackReach(p.l)) { var np = pullPallet(key); if (np) { np.place = 'jack'; np.jack = tool; S[tool].pallet = np.id; sfx('jack'); } }
      else if (s && s.pal && jackReach(p.l)) { delete S.slots[key]; var ep = newPallet(s.sku, 0, { place: 'jack', jack: tool }); S[tool].pallet = ep.id; sfx('jack'); }
      return;
    }
    if (!S.hand && has && s.wrapped) s.wrapped = false;   // cutting the film to take a box
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. The bin is by the bench.', 'bad'); return; }
    if (S.hand && S.hand.kind === 'box') { if (slotSpace(key, S.hand.sku) > 0) { slotAdd(key, S.hand.sku, 1); handSet(null); sfx('putdown'); S.stats.putaway++; addXp(XP.box); introStep('putaway'); } else toast('No room: that slot holds ' + skuName(s.sku) + '.', 'bad'); return; }
    if (S.hand) return;
    if (has) { slotTake(key, 1); handSet({ kind: 'box', sku: s.sku }); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); }
  }

  // ── Pallets ───────────────────────────────────────────────────────
  function palletById(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) return S.pallets[i]; return null; }
  function newPallet(sku, n, props) { var p = { id: uid('pl'), sku: sku, n: n, place: 'floor', x: 0, y: 0, z: 0, rot: 0 }; for (var k in props) p[k] = props[k]; S.pallets.push(p); return p; }
  function removePallet(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) { S.pallets.splice(i, 1); return; } }
  function storePallet(p, key) { if (!slotOwned(key) || slotSpace(key, p.sku) < p.n) return false; slotAdd(key, p.sku, p.n); S.slots[key].pal = true; S.slots[key].wrapped = !!p.wrapped; S.stats.putaway += p.n; removePallet(p.id); return true; }
  function pullPallet(key) { var s = S.slots[key]; if (!s || !s.n) return null; var sku = s.sku, n = Math.min(s.n, ECON.palletCap), wrapped = !!s.wrapped; slotTake(key, n); if (S.slots[key] && S.slots[key].n <= 0) delete S.slots[key]; return newPallet(sku, n, { place: 'floor', wrapped: wrapped }); }   // the pallet under the boxes goes with them; an empty one used to stay behind, to be pulled again and again
  function jackPallet(tool) { var t = tool || jackTool(), js = S[t]; return js && js.pallet ? palletById(js.pallet) : null; }
  function forkPallet() { return S.fork.pallet ? palletById(S.fork.pallet) : null; }
  // what the cart could put on this pallet: boxes of the pallet's line, or of the line the cart holds most of when the pallet is empty
  function cartUnloadable(p) { var cb = S.cart.boxes; if (!cb.length || p.n >= 12) return { n: 0 }; var sku = p.sku; if (p.n === 0) { var cnt = {}; cb.forEach(function (s) { cnt[s] = (cnt[s] || 0) + 1; }); sku = null; for (var k in cnt) if (!sku || cnt[k] > cnt[sku]) sku = k; } var n = cb.filter(function (s) { return s === sku; }).length; return { n: Math.min(n, 12 - p.n), sku: sku }; }
  function palletPrompt(src) {
    var p = palletById(src.id); if (!p || src.carried) return null;
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t || t.state !== 'docked') return null; if (!t.signed) return 'Sign the delivery note with ' + t.driver + ' first'; }
    if (isJack(player.tool)) return jackPallet() ? null : (p.n > 0 ? 'Lift the pallet with the jack (' + p.n + ' × ' + skuName(p.sku) + ')' : 'Lift the empty pallet with the jack');
    if (player.tool === 'cart') { var cu = cartUnloadable(p); if (cu.n) return 'Unload ' + cu.n + ' × ' + skuName(cu.sku) + ' from the cart onto the pallet'; if (p.n === 0) return 'Empty pallet · boxes on the cart go onto it'; return cartLoad() < ECON.cartCap ? 'Take a box of ' + skuName(p.sku) + ' onto the cart (' + p.n + ' left)' : 'Cart is full'; }
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return p.n === 0 ? 'A damaged box does not go on a pallet: bin it' : null;
    if (S.hand && S.hand.kind === 'box' && (p.n === 0 || S.hand.sku === p.sku) && p.n < 12) return p.n === 0 ? 'Put the box on the empty pallet' : 'Put the box back on the pallet';
    if (S.hand) return null;
    if (p.n === 0) return 'Empty pallet' + (p.place === 'floor' ? ' · the jack lifts it, loose boxes go on it by hand' : '');
    return 'Take a box of ' + skuName(p.sku) + ' off the pallet (' + p.n + ' left)';
  }
  function palletUse(src) {
    var p = palletById(src.id); if (!p || src.carried) return;
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t || t.state !== 'docked') return; if (!t.signed) { toast('Sign the delivery note with the driver first. He is by the dock outside.', 'bad'); return; } }
    if (isJack(player.tool)) { if (!jackPallet()) { if (p.place === 'truck') { onPalletLeftTruck(p); } var jt = jackTool(); p.place = 'jack'; p.jack = jt; S[jt].pallet = p.id; sfx('jack'); introStep('unload'); } return; }
    var take = function () { if (p.place === 'truck') onPalletLeftTruck(p); p.n--; p.wrapped = false; S.stats.picked++; addXp(XP.box); if (p.n <= 0) { p.n = 0; if (p.place === 'truck') toast('That pallet is empty: take it out with the jack, or the truck takes it back', ''); } introStep('unload'); };
    if (player.tool === 'cart') { var cu2 = cartUnloadable(p); if (cu2.n) { for (var ci = S.cart.boxes.length - 1; ci >= 0 && p.n < 12; ci--) if (S.cart.boxes[ci] === cu2.sku) { S.cart.boxes.splice(ci, 1); p.sku = cu2.sku; p.n++; } sfx('putdown'); hudDirty = true; return; } if (p.n === 0) { sfx('click'); return; } if (cartLoad() < ECON.cartCap) { S.cart.boxes.push(p.sku); take(); sfx('pickup'); } return; }
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. The bin is by the bench.', 'bad'); return; }
    if (S.hand && S.hand.kind === 'box' && (p.n === 0 || S.hand.sku === p.sku) && p.n < 12) { if (p.n === 0) p.sku = S.hand.sku; p.n++; handSet(null); sfx('putdown'); return; }
    if (S.hand) return;
    if (p.n === 0) { sfx('click'); return; }
    handSet({ kind: 'box', sku: p.sku }); take(); sfx('pickup');
  }

  // ── The floor ─────────────────────────────────────────────────────
  // the drop marker: while you hold a box or a parcel, a ghost of it and a ring on the floor show where G will set it down
  var dropMarker = (function () { var g = new THREE.Group(); g.userData.dynamic = true; g.visible = false; scene.add(g); var mk = function (col) { return new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false }); }; var ok = mk(0x5fd38d), bad = mk(0xff6b5e); var box = new THREE.Mesh(BOX_GEO, ok); box.renderOrder = 3; g.add(box); var par = new THREE.Mesh(PARCEL_GEO, ok); par.renderOrder = 3; g.add(par); var ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 28), ok); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; ring.renderOrder = 3; g.add(ring); return { g: g, box: box, par: par, ring: ring, ok: ok, bad: bad }; })();
  function dropPoint() { var fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), x = player.x - fx * 0.9, z = player.z - fz * 0.9, good = true; if (!insideHall(x, z) && floorY(x, z) < -0.5) { x = player.x; z = player.z; good = false; } return { x: x, z: z, y: floorY(x, z), good: good }; }
  function updateDropMarker() { var h = S.hand, show = !!h && ui.started && !driving && !edit.on && !pc.on; dropMarker.g.visible = show; if (!show) return; var d = dropPoint(), m = d.good ? dropMarker.ok : dropMarker.bad, pulse = 0.28 + 0.12 * Math.sin(worldTime * 5); m.opacity = pulse; dropMarker.box.material = dropMarker.par.material = dropMarker.ring.material = m; dropMarker.box.visible = h.kind === 'box'; dropMarker.par.visible = h.kind === 'parcel'; dropMarker.g.position.set(d.x, d.y, d.z); dropMarker.g.rotation.y = player.yaw; dropMarker.box.position.y = BOX.h / 2; dropMarker.par.position.y = 0.2; }
  function dropAhead(item) {
    var d = dropPoint(); item.x = d.x; item.z = d.z; item.y = d.y; item.rot = player.yaw; S.floor.push(item);
  }
  function floorPrompt(src) { var f = S.floor[src.idx]; if (!f) return null; if (f.kind === 'box') { if (player.tool === 'cart') return cartLoad() < ECON.cartCap && !f.damaged ? 'Put the box on the cart' : null; return S.hand || player.tool ? null : (f.damaged ? 'Pick up the damaged box (it goes in the bin)' : 'Pick up the box of ' + skuName(f.sku)); } var o = orderById(f.order); return S.hand || player.tool ? null : 'Pick up parcel #' + (o ? o.num : '?'); }
  function floorUse(src) {
    var f = S.floor[src.idx]; if (!f) return;
    if (f.kind === 'box') { if (player.tool === 'cart') { if (f.damaged) { toast('Damaged: carry it to the bin by hand.', 'bad'); return; } if (S.cart.boxes.length >= ECON.cartCap) return; S.cart.boxes.push(f.sku); } else if (S.hand || player.tool) return; else handSet({ kind: 'box', sku: f.sku, damaged: !!f.damaged }); }
    else { if (S.hand || player.tool) return; handSet({ kind: 'parcel', order: f.order }); }
    S.floor.splice(src.idx, 1); sfx('pickup');
  }
  function putDown() {
    if (player.tool) { releaseTool(); return; }
    if (!S.hand) return;
    var h = S.hand; handSet(null);
    if (h.kind === 'box') { var dmg = h.damaged || (!player.grounded && Math.random() < 0.6); if (dmg && !h.damaged) { toast('That box landed badly.', 'bad'); burst(player.x, 0.4, player.z, 0xc69c6d, 10, 'out'); sfx('crate'); } dropAhead({ kind: 'box', sku: h.sku, damaged: dmg }); } else dropAhead({ kind: 'parcel', order: h.order });
    sfx('putdown');
  }
  // ── Trucks ────────────────────────────────────────────────────────
  var truckMeshes = {};
  var clientSignTex = {};
  function truckById(id) { for (var i = 0; i < S.trucks.length; i++) if (S.trucks[i].id === id) return S.trucks[i]; return null; }
  function truckDockX(side) { return side * (HALL.x + 0.4); }
  function truckAtDoor(i) { var dm = DOOR_MAP[i]; if (!dm) return null; var dir = dm.dir, dock = dm.dock; for (var k = 0; k < S.trucks.length; k++) { var t = S.trucks[k]; if (t.dir === dir && t.dock === dock && t.state === 'docked') return t; } return null; }
  function truckPalletPos(t, i) { var r = Math.floor(i / 2), c = i % 2; return { x: t.x + t.side * (1.1 + r * 1.35), y: 0, z: t.z + (c ? 0.62 : -0.62), ry: 0 }; }
  function truckParcelPos(t, i) { var r = Math.floor(i / 6), c = i % 6, col = c % 3, layer = Math.floor(c / 3); return { x: t.x + t.side * (0.9 + r * 0.7), y: layer * 0.47, z: t.z + (col - 1) * 0.8 }; }
  function trailerBounds(t) { var a = t.x, b = t.x + t.side * TRAILER.len; return { x0: Math.min(a, b), x1: Math.max(a, b), z0: t.z - TRAILER.w / 2, z1: t.z + TRAILER.w / 2 }; }
  function tierFor(level) { return level >= 7 ? 4 : level >= 4 ? 3 : level >= 2 ? 2 : 1; }
  function nowAbs() { return S.day * 24 + S.time; }

  function truckWheel(g, x, y, z, r, w) { var ty = cyl(r, w, MAT.rubber, x, y, z, g, 20); ty.rotation.x = Math.PI / 2; for (var k = 0; k < 3; k++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.04, 0.012, 6, 24), MAT.black); ring.position.set(x, y, z + (k - 1) * w * 0.3); g.add(ring); } cyl(r * 0.58, w + 0.02, MAT.chrome, x, y, z, g, 14).rotation.x = Math.PI / 2; cyl(r * 0.2, w + 0.06, MAT.steelDark, x, y, z, g, 10).rotation.x = Math.PI / 2; }
  function buildTruckMesh(t) {
    var g = new THREE.Group(), side = t.side, L = function (x) { return x * side; }, len = TRAILER.len, w = TRAILER.w, h = TRAILER.h;
    g.userData.dynamic = true;
    var paint = t.color === 'red' ? MAT.truckRed : t.color === 'blue' ? MAT.truckBlue : MAT.green, TRM = t.mode === 'sea' ? MAT.container : MAT.trailer, fz = t.dir === 'out' && t.dock === 2 ? -1 : 1;   // a sea truck carries a container; OUT 3 sits in the corner, so its landing and driver route mirror to the north side
    // the trailer: floor, lined walls, ribbed outside, roof, rear frame with the doors folded back, chassis, wheels and guards
    box(len, 0.12, w, MAT.steelDark, L(len / 2), -0.06, 0, g); plane(len - 0.2, w - 0.2, MAT.wood, L(len / 2), 0.005, 0, -Math.PI / 2, 0, g);
    [-1, 1].forEach(function (s) { box(len, h, 0.06, TRM, L(len / 2), h / 2, s * (w / 2 + 0.03), g); var lin = plane(len - 0.1, h - 0.1, MAT.lining, L(len / 2), h / 2, s * (w / 2 - 0.005), 0, s > 0 ? Math.PI : 0, g); lin.receiveShadow = false; for (var rb = 1; rb < len; rb += 1.5) box(0.04, h - 0.2, 0.06, MAT.steelDark, L(rb), h / 2, s * (w / 2 + 0.06), g); });
    box(0.06, h, w + 0.12, TRM, L(len + 0.03), h / 2, 0, g); plane(w - 0.1, h - 0.1, MAT.lining, L(len - 0.005), h / 2, 0, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2, g);
    box(len, 0.06, w + 0.12, TRM, L(len / 2), h + 0.03, 0, g); plane(len - 0.1, w - 0.1, MAT.lining, L(len / 2), h - 0.005, 0, Math.PI / 2, 0, g);
    box(0.1, h + 0.1, 0.1, MAT.steelDark, L(0.05), h / 2, -(w / 2 + 0.05), g); box(0.1, h + 0.1, 0.1, MAT.steelDark, L(0.05), h / 2, w / 2 + 0.05, g); box(0.1, 0.1, w + 0.2, MAT.steelDark, L(0.05), h + 0.05, 0, g);
    // the rear doors hang on hinge pivots at the corners: open flat against the sides while docked, closed across the back on the road
    var rearDoors = []; [-1, 1].forEach(function (s) { var piv = new THREE.Group(); piv.position.set(L(0.02), h / 2, s * (w / 2 + 0.03)); g.add(piv); var dr = box(0.05, h - 0.1, w / 2 - 0.05, TRM, 0, 0, -s * (w / 2 - 0.05) / 2, piv); box(0.02, 0.5, 0.06, MAT.steelDark, 0.03 * side, 0, -s * (w / 2 - 0.2), piv); box(0.02, h - 0.3, 0.03, MAT.steelDark, 0.03 * side, 0, -s * 0.12, piv); piv.userData.openRot = -side * s * Math.PI / 2; piv.rotation.y = piv.userData.openRot; rearDoors.push(piv); });
    box(len - 2.4, 0.5, 1.6, MAT.steelDark, L(len / 2 + 0.6), -0.45, 0, g); box(len - 3, 0.25, 0.08, MAT.hazard, L(len / 2), -0.25, -(w / 2 + 0.03), g); box(len - 3, 0.25, 0.08, MAT.hazard, L(len / 2), -0.25, w / 2 + 0.03, g);
    [1.9, 3.1].forEach(function (x) { [-1, 1].forEach(function (s) { truckWheel(g, L(x), -0.7, s * 1.0, 0.5, 0.36); }); });
    [-1, 1].forEach(function (s) { box(2.0, 0.08, 0.5, MAT.black, L(2.5), -0.14, s * 1.05, g); var f1 = box(0.5, 0.08, 0.5, MAT.black, L(1.35), -0.3, s * 1.05, g); f1.rotation.z = side * 0.6; var f2 = box(0.5, 0.08, 0.5, MAT.black, L(3.65), -0.3, s * 1.05, g); f2.rotation.z = -side * 0.6; box(0.06, 0.4, 0.06, MAT.steelDark, L(2.5), -0.35, s * 1.3, g); });
    box(0.08, 0.25, w + 0.3, MAT.steelDark, L(0.3), -0.95, 0, g); box(0.3, 0.12, 0.25, MAT.red, L(0.15), -0.35, -(w / 2 - 0.15), g); box(0.3, 0.12, 0.25, MAT.red, L(0.15), -0.35, w / 2 - 0.15, g);
    sign([t.dir === 'in' ? 'KH 19 ' + t.num : 'DC 20 ' + t.num], 0.5, 0.12, L(0.0), -0.6, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' }, g);
    cyl(0.05, 0.9, MAT.steelDark, L(len - 1.5), -0.65, -0.9, g, 8); cyl(0.05, 0.9, MAT.steelDark, L(len - 1.5), -0.65, 0.9, g, 8); box(0.3, 0.08, 0.3, MAT.steelDark, L(len - 1.5), -1.12, -0.9, g); box(0.3, 0.08, 0.3, MAT.steelDark, L(len - 1.5), -1.12, 0.9, g);
    for (var ml = 0; ml < 3; ml++) { box(0.08, 0.06, 0.12, glowMat(0xffa000, 0.8), L(0.05), h + 0.1, (ml - 1) * 0.9, g); }
    // the cab: body, roof, windscreen and side windows, grille, bumper, lights, mirrors, steps, fuel tank, exhaust
    box(2.6, 2.4, 2.4, paint, L(len + 1.7), 0.7, 0, g); box(2.4, 0.5, 2.2, paint, L(len + 1.6), 2.1, 0, g); box(0.6, 0.6, 2.2, paint, L(len + 0.5), 2.0, 0, g);
    box(0.05, 1.0, 2.1, MAT.glass, L(len + 3.02), 1.3, 0, g); box(0.9, 0.8, 0.05, MAT.glass, L(len + 2.0), 1.3, -1.23, g); box(0.9, 0.8, 0.05, MAT.glass, L(len + 2.0), 1.3, 1.23, g);
    box(0.06, 0.9, 1.6, MAT.black, L(len + 3.04), 0.4, 0, g); for (var gr = 0; gr < 4; gr++) box(0.08, 0.06, 1.5, MAT.chrome, L(len + 3.06), 0.1 + gr * 0.2, 0, g);
    box(0.12, 0.3, 2.5, MAT.steelDark, L(len + 3.05), -0.4, 0, g); box(0.1, 0.15, 0.3, MAT.lamp, L(len + 3.1), 0.05, -0.95, g); box(0.1, 0.15, 0.3, MAT.lamp, L(len + 3.1), 0.05, 0.95, g); box(0.06, 0.1, 0.2, glowMat(0xffa000, 0.6), L(len + 3.1), 0.25, -1.05, g); box(0.06, 0.1, 0.2, glowMat(0xffa000, 0.6), L(len + 3.1), 0.25, 1.05, g);
    sign(['DC ' + (10 + t.num)], 0.5, 0.12, L(len + 3.12), -0.2, 0, side < 0 ? -Math.PI / 2 : Math.PI / 2, { w: 256, h: 64, bg: '#f5f1e6', fg: '#1b232c' }, g);
    [-1, 1].forEach(function (s) { box(0.04, 0.5, 0.25, MAT.black, L(len + 2.9), 1.7, s * 1.45, g); box(0.1, 0.04, 0.3, MAT.steelDark, L(len + 2.8), 1.95, s * 1.3, g); box(0.5, 0.05, 0.4, MAT.steelDark, L(len + 1.7), -0.3, s * 1.25, g); box(0.5, 0.05, 0.4, MAT.steelDark, L(len + 1.7), -0.7, s * 1.25, g); box(0.05, 0.18, 0.05, MAT.chrome, L(len + 2.0), 0.9, s * 1.23, g); });
    var tank = cyl(0.3, 1.2, MAT.chrome, L(len + 1.0), -0.35, -1.05, g, 14); tank.rotation.z = Math.PI / 2; box(1.2, 0.05, 0.4, MAT.black, L(len + 1.0), -0.05, -1.05, g);
    [len + 0.9, len + 2.5].forEach(function (x) { [-1, 1].forEach(function (s) { truckWheel(g, L(x), -0.7, s * 1.05, 0.5, 0.36); }); });
    cyl(0.07, 1.4, MAT.chrome, L(len + 0.45), 2.4, -0.9, g, 10); cyl(0.09, 0.08, MAT.black, L(len + 0.45), 3.12, -0.9, g, 10);
    for (var rl = 0; rl < 5; rl++) box(0.06, 0.06, 0.1, glowMat(0xffa000, 0.8), L(len + 2.9), 2.37, (rl - 2) * 0.5, g);
    // wheel arches over every axle, mud flaps, marker lights along the trailer, wipers, a sun visor, air horns, dirt on the lower panels
    [[1.9], [3.1], [len + 0.9], [len + 2.5]].forEach(function (ax) { [-1, 1].forEach(function (s) { var arch = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 20, Math.PI), MAT.black); arch.position.set(L(ax[0]), -0.7, s * (ax[0] > len ? 1.2 : 1.15)); arch.rotation.y = Math.PI / 2; g.add(arch); }); });
    [-1, 1].forEach(function (s) { box(0.04, 0.4, 0.34, MAT.rubber, L(1.4), -0.95, s * 1.0, g); box(0.04, 0.4, 0.34, MAT.rubber, L(len + 0.4), -0.95, s * 1.05, g); });
    for (var ml2 = 1.5; ml2 < len; ml2 += 2.5) { [-1, 1].forEach(function (s) { box(0.1, 0.05, 0.06, glowMat(0xffa000, 0.7), L(ml2), 0.15, s * (w / 2 + 0.06), g); }); }
    box(0.5, 0.02, 0.03, MAT.black, L(len + 3.03), 0.95, -0.5, g).rotation.x = 0.3; box(0.5, 0.02, 0.03, MAT.black, L(len + 3.03), 0.95, 0.4, g).rotation.x = 0.3;
    box(0.2, 0.08, 2.3, paint, L(len + 3.0), 1.9, 0, g); cyl(0.05, 0.4, MAT.chrome, L(len + 1.0), 2.45, -0.5, g, 10).rotation.z = Math.PI / 2; cyl(0.05, 0.4, MAT.chrome, L(len + 1.0), 2.45, 0.5, g, 10).rotation.z = Math.PI / 2;
    var dirtTex = tex(64, 64, function (c, w2, h2) { c.clearRect(0, 0, w2, h2); var gr = c.createLinearGradient(0, h2, 0, 0); gr.addColorStop(0, 'rgba(60,50,40,0.45)'); gr.addColorStop(1, 'rgba(60,50,40,0)'); c.fillStyle = gr; c.fillRect(0, 0, w2, h2); }); var dirtMat = new THREE.MeshBasicMaterial({ map: dirtTex, transparent: true, depthWrite: false }); dirtMat.userData.noBake = true;
    [-1, 1].forEach(function (s) { var dp = plane(len, 0.6, dirtMat, L(len / 2), 0.3, s * (w / 2 + 0.065), 0, s > 0 ? 0 : Math.PI, g); dp.renderOrder = 1; var dc = plane(2.6, 0.6, dirtMat, L(len + 1.7), 0.0, s * 1.21, 0, s > 0 ? 0 : Math.PI, g); dc.renderOrder = 1; });
    groundBlob(len + 4, 3.4, L(len / 2 + 1.5), 0, g, YARD_Y);
    // the client's name on both sides of the trailer, and the haulier on the cab door
    var cname = t.dir === 'in' ? clientName(t.client) : (MODES[t.mode] || MODES.land).haulier;
    if (t.dir === 'out' && t.mode === 'sea') { [[0.1, -1], [len - 0.1, -1], [0.1, 1], [len - 0.1, 1]].forEach(function (p) { box(0.2, 0.2, 0.2, MAT.steelDark, L(p[0]), 0.1, p[1] * (w / 2 + 0.02), g); box(0.2, 0.2, 0.2, MAT.steelDark, L(p[0]), h - 0.1, p[1] * (w / 2 + 0.02), g); }); }   // a container's corner castings
    if (t.dir === 'out' && t.mode === 'air') { [-1, 1].forEach(function (s) { plane(len - 0.2, 0.22, std({ color: 0x3fa7d6, roughness: 0.5 }), L(len / 2), 2.45, s * (w / 2 + 0.075), 0, s > 0 ? 0 : Math.PI, g); plane(len - 0.2, 0.1, std({ color: 0xff6b5e, roughness: 0.5 }), L(len / 2), 2.25, s * (w / 2 + 0.075), 0, s > 0 ? 0 : Math.PI, g); }); }   // the air carrier's livery band
    if (!clientSignTex[cname]) clientSignTex[cname] = textTex([cname], { w: 1024, h: 160, bg: '#e6e8ea', fg: t.dir === 'in' ? '#2c5f9e' : '#1b232c', size: 80 });
    var sm = new THREE.MeshBasicMaterial({ map: clientSignTex[cname] });
    [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.25), sm); p.position.set(L(len / 2), 1.7, s * (w / 2 + 0.07)); p.rotation.y = s > 0 ? 0 : Math.PI; g.add(p); });
    [-1, 1].forEach(function (s) { sign([t.driver.toUpperCase() + ' HAULAGE'], 1.4, 0.3, L(len + 1.5), 0.4, s * 1.22, s > 0 ? 0 : Math.PI, { w: 512, h: 96, bg: '#1b232c', fg: '#eef1f5' }, g); });
    // the loading zone inside an outbound trailer
    if (t.dir === 'out') hitBox(3.0, 2.4, w - 0.2, L(1.8), 1.25, 0, { prompt: function () { return loadPrompt(t.id); }, use: function () { loadUse(t.id); } }, g);
    // the driver: climbs out when docked, walks to the dock with the paperwork, and waits there
    var drv = makeHuman({ cap: true, capMat: paint, vest: Math.random() < 0.5 ? MAT.hivis : null }); drv.position.set(L(len + 1.4), YARD_Y, -2.1 * fz); drv.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; drv.visible = false; g.add(drv);
    box(0.22, 0.3, 0.02, MAT.wood, 0.16, 1.05, 0.2, drv); box(0.2, 0.26, 0.01, MAT.paper, 0.16, 1.05, 0.215, drv);
    hitBox(0.7, 1.9, 0.7, 0, 0.95, 0, { prompt: function () { return driverPrompt(t.id); }, use: function () { driverUse(t.id); } }, drv);
    g.position.set(t.x, 0, t.z); scene.add(g);
    var route = [[L(len + 1.4), YARD_Y, 2.1], [L(2.4), YARD_Y, 4.6], [L(0.9), YARD_Y, 6.1], [L(0.9), 0, 4.4], [L(0.9), 0, 3.0], [L(-0.2), 0, 1.55], [L(-2.0), 0, 2.0], [L(-2.6), 0, 3.4]].map(function (p) { return [p[0], p[1], p[2] * fz]; });
    truckMeshes[t.id] = { g: g, driver: drv, drvD: 0, route: route, doors: rearDoors, doorA: t.state === 'docked' ? 1 : 0 };
    shadowDirty = true;
  }
  function removeTruckMesh(id) { var m = truckMeshes[id]; if (!m) return; scene.remove(m.g); m.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); }); delete truckMeshes[id]; shadowDirty = true; }

  // what an inbound truck brings: lines the clients send, weighted toward what the open orders need and what is low
  function inboundLoad(t) {
    var tier = tierFor(S.level), cands = SKUS.filter(function (s) { return s.tier <= tier && !s.own; });
    var need = {}; S.orders.forEach(function (o) { if (o.state !== 'open') return; o.lines.forEach(function (l) { need[l.sku] = (need[l.sku] || 0) + l.qty; }); });
    var count = clamp(2 + Math.floor(S.level / 2) + (S.up.dock2 ? 1 : 0) + randi(-1, 1), 2, 8);
    var client = activeClients().filter(function (c) { return c.likes.some(function (s) { return SKU[s].tier <= tier; }); });
    t.client = pick(client).id;
    for (var i = 0; i < count; i++) {
      var weights = cands.map(function (s) { var st = stockCount(s.id), n = need[s.id] || 0; var w = 1 + Math.max(0, n - st) * 0.8 + (st < 6 ? 1.6 : st > 30 ? -0.8 : 0) + (CLIENTS.filter(function (c) { return c.id === t.client; })[0].likes.indexOf(s.id) >= 0 ? 1.2 : 0); return Math.max(0.15, w); });
      var total = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * total, sku = cands[0].id;
      for (var k = 0; k < cands.length; k++) { r -= weights[k]; if (r <= 0) { sku = cands[k].id; break; } }
      var p = newPallet(sku, Math.random() < 0.25 ? 6 : 8, { place: 'truck', truck: t.id, idx: i, x: 0, z: 0 });
      t.pallets.push(p.id);
      if (S.seenSkus.indexOf(sku) < 0) S.seenSkus.push(sku);
    }
    while (S.factory && S.factory.rawOrdered > 0 && t.pallets.length < 8) { var rp = newPallet('raw', 8, { place: 'truck', truck: t.id, idx: t.pallets.length, x: 0, z: 0 }); t.pallets.push(rp.id); S.factory.rawOrdered--; }
  }
  function spawnTruck(dir, dock, leaveH) {
    var side = dir === 'in' ? -1 : 1, z = (dir === 'in' ? DOCKS.in : DOCKS.out)[dock].z;
    var t = { id: uid('tr'), num: S.truckSeq++, dir: dir, dock: dock, side: side, z: z, x: side * 80, state: 'coming', mode: dir === 'out' ? TRUCK_OUT[dock].mode : null, mode: dir === 'out' ? TRUCK_OUT[dock].mode : null, mode: dir === 'out' ? TRUCK_OUT[dock].mode : null, mode: dir === 'out' ? TRUCK_OUT[dock].mode : null, mode: dir === 'out' ? TRUCK_OUT[dock].mode : null, arrived: 0, leave: leaveH, day: S.day, pallets: [], parcels: [], driver: pick(DRIVER_NAMES), color: pick(['red', 'blue', 'green']), unloaded: 0, doneAt: 0 };
    if (dir === 'in') inboundLoad(t);
    S.trucks.push(t); buildTruckMesh(t); sfx('truck');
    logEvent((dir === 'in' ? 'Inbound truck coming to ' : 'Outbound truck coming to ') + dockLabel(doorIndex(dir, dock)));
    return t;
  }
  function tickTrucks(dt) {
    // the schedule
    var inDocks = isSunday() ? [] : [0].concat(S.up.dock2 ? [1] : []).concat(S.up.hall3 ? [2] : []);   // IN 3 with Hall 3
    TRUCK_IN.forEach(function (h, k) { inDocks.forEach(function (dock) { var f = 'in' + S.day + '-' + k + '-' + dock; if (!S.flags[f] && S.time >= h - 0.25 && S.time < h + 1.5) { S.flags[f] = 1; if (!truckAtDoor(dock) && !S.trucks.some(function (t) { return t.dir === 'in' && t.dock === dock && t.state !== 'leaving'; })) spawnTruck('in', dock, h + TRUCK_WAIT); } }); });
    TRUCK_OUT.forEach(function (dk, k) { if (isSunday() || !dockOwned(k)) return; dk.windows.forEach(function (w, wi) { var f = 'out' + S.day + '-' + k + '-' + wi; if (!S.flags[f] && S.time >= w.arrive - 0.25 && S.time < w.leave - 0.3) { S.flags[f] = 1; if (!S.trucks.some(function (t) { return t.dir === 'out' && t.dock === k && t.state !== 'leaving'; })) spawnTruck('out', k, w.leave); } }); });   // one lane a dock, two windows a day
    // movement and waiting
    for (var i = S.trucks.length - 1; i >= 0; i--) {
      var t = S.trucks[i], m = truckMeshes[t.id]; if (!m) { buildTruckMesh(t); m = truckMeshes[t.id]; }
      if (t.state === 'coming') {
        var dx = truckDockX(t.side), dirn = dx > t.x ? 1 : -1; t.x += dirn * 7 * dt;
        if ((dirn > 0 && t.x >= dx) || (dirn < 0 && t.x <= dx)) { t.x = dx; t.state = 'docked'; t.arrived = S.time; sfx('airbrake'); if (t.dir === 'in') { toast('Truck at ' + dockLabel(doorIndex('in', t.dock)) + ': ' + t.pallets.length + ' pallets from ' + clientName(t.client), 'rare'); logEvent(t.driver + ' docked at ' + dockLabel(doorIndex('in', t.dock)) + ' with ' + t.pallets.length + ' pallets'); introStep('truck'); } else { toast('Outbound ' + (MODES[t.mode] || MODES.land).name.toLowerCase() + ' truck at ' + dockLabel(doorIndex('out', t.dock)) + ' · leaves ' + fmtTime(t.leave), 'rare'); logEvent('Outbound ' + (MODES[t.mode] || MODES.land).name.toLowerCase() + ' truck at ' + dockLabel(doorIndex('out', t.dock)) + ', leaves at ' + fmtTime(t.leave)); } rebuildBoardSoon(); }
      } else if (t.state === 'docked') {
        if (t.dir === 'in') {
          var left = S.pallets.some(function (p) { return p.place === 'truck' && p.truck === t.id && p.n > 0; });
          if (!left) { if (!t.doneAt) t.doneAt = S.time; if (S.time >= t.doneAt + 0.25) truckLeave(t, 'done'); }
          else if (S.time >= t.leave) truckLeave(t, 'timeout');
        } else if (S.time >= t.leave) truckLeave(t, 'schedule');
      } else if (t.state === 'leaving') {
        t.x += t.side * 8 * dt;
        if (Math.abs(t.x) > 85) { removeTruckMesh(t.id); S.trucks.splice(i, 1); continue; }
      }
      m.g.position.x = t.x;
      var wantOpen = t.state === 'docked' ? 1 : 0; m.doorA = lerp(m.doorA === undefined ? wantOpen : m.doorA, wantOpen, Math.min(1, dt * 1.5)); m.doors.forEach(function (pv) { pv.rotation.y = pv.userData.openRot * m.doorA; });
      if (m.driver) {
        var docked = t.state === 'docked', want = docked ? 1 : 0;
        m.driver.visible = docked; if (!docked) m.drvD = 0;
        // walk the route by distance; segment 4 (the landing) to 5 (the door) only once the dock door is open
        var R = m.route, doorOpen = doorPassable(doorIndex(t.dir, t.dock)), segLen = function (k) { var a = R[k], b = R[k + 1]; return Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]) + (b[2] - a[2]) * (b[2] - a[2])); };
        var total = 0, landing = 0; for (var sk = 0; sk < R.length - 1; sk++) { if (sk === 4) landing = total; total += segLen(sk); }
        var cap = doorOpen && t.dir === 'in' ? total : landing;   // an outbound driver has nothing to sign: he waits on the landing, clear of the dock loader
        if (docked && m.drvD < cap) m.drvD = Math.min(cap, m.drvD + dt * 1.8);
        var rem = m.drvD, si = 0; while (si < R.length - 2 && rem > segLen(si)) { rem -= segLen(si); si++; } var A = R[si], B = R[si + 1], sl = segLen(si), fr = sl > 0 ? Math.min(1, rem / sl) : 1;
        m.driver.position.set(lerp(A[0], B[0], fr), lerp(A[1], B[1], fr), lerp(A[2], B[2], fr)); m.driver.userData.baseY = lerp(A[1], B[1], fr);
        var moving = docked && m.drvD < cap; if (moving) m.driver.rotation.y = Math.atan2(B[0] - A[0], B[2] - A[2]); else m.driver.rotation.y = t.side < 0 ? Math.PI / 2 : -Math.PI / 2;
        if (docked && !moving && !doorOpen && t.dir === 'in' && m.drvD < total - 0.01 && Math.random() < dt / 20) say(m.driver, pick(['Door is shut, mate.', 'Can someone open this door?', 'Standing out here like a lemon.', 'Any chance of the door?']), '#f5b53d');
        var lookWorld = { x: player.x - t.x, y: player.y + 1.6, z: player.z - t.z };
        animateHuman(m.driver, dt, moving ? 'walk' : (S.time > t.arrived + 2 && t.dir === 'in' && !t.doneAt ? 'wait' : 'idle'), 1.4, moving ? null : lookWorld, false);
        if (docked && !moving && t.dir === 'in' && !t.signed && Math.random() < dt / 25) say(m.driver, pick(DRIVER_LINES.sign), '#f5b53d');
        if (docked && !moving && S.time > t.arrived + 2.2 && !t.doneAt && !t.nagged) { t.nagged = true; say(m.driver, pick(DRIVER_LINES.late), '#ff6b5e'); }
      }
    }
  }
  var DRIVER_LINES = {
    sign: ['Sign here, chief.', 'Just the one signature and it is all yours.', 'Name and a squiggle, ta.', 'Delivery note. Sign the bottom.'],
    signed: ['Cheers. All yours.', 'Lovely. I will get the kettle on in the cab.', 'Ta. Mind the back ones, they are heavy.', 'Done. Give us a shout when it is empty.'],
    chat: ['Traffic was murder on the ring road.', 'Yard looks tidy, I will give you that.', 'Three more drops after this one.', 'Is the kettle on?', 'Mind the forks. I have seen things.', 'My last depot had a vending machine with actual food in it.', 'Weather is turning.', 'They want this lot back in Northgate by six.'],
    late: ['Any chance we can get a move on, mate?', 'I have got a slot to make.', 'Clock is ticking, chief.'],
    out: ['Load her up, I am ready when you are.', 'Anything for Fairlane goes at the front.', 'Shout when you want me gone.']
  };
  function driverPrompt(tid) { var t = truckById(tid); if (!t || t.state !== 'docked') return null; if (t.dir === 'in' && !t.signed) return 'Sign the delivery note · ' + t.pallets.length + ' pallets from ' + clientName(t.client); return 'Talk to ' + t.driver; }
  function driverUse(tid) { var t = truckById(tid), m = truckMeshes[tid]; if (!t || t.state !== 'docked' || !m) return; if (t.dir === 'in' && !t.signed) { signTruck(t); say(m.driver, pick(DRIVER_LINES.signed), '#5fd38d'); return; } say(m.driver, pick(t.dir === 'out' ? DRIVER_LINES.out : DRIVER_LINES.chat), '#a0acb8'); }
  function signTruck(t) { if (t.signed) return; t.signed = true; sfx('tape'); addXp(3); toast('Delivery note signed: ' + t.pallets.length + ' pallets from ' + clientName(t.client), 'good'); logEvent('Signed for ' + t.pallets.length + ' pallets from ' + clientName(t.client) + ' (' + t.driver + ')'); introStep('sign'); }
  function truckLeave(t, why) {
    if (t.state !== 'docked') return;
    sellBales(t);
    if (t.dir === 'in') {
      S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id && p.n <= 0; }).forEach(function (p) { removePallet(p.id); });   // empties go back with the truck, no harm done
      var left = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id; });
      if (left.length) { left.forEach(function (p) { removePallet(p.id); }); addRep(-Math.min(5, 0.5 * left.length)); S.stats.lost += left.length; logEvent(left.length + ' pallet' + (left.length > 1 ? 's' : '') + ' went back on the truck unreceived', 'bad'); toast('Refused delivery: ' + left.length + ' pallet' + (left.length > 1 ? 's' : '') + ' went back', 'bad'); }
      else { logEvent(t.driver + ' left ' + dockLabel(doorIndex('in', t.dock)) + ' empty', 'good'); }
    } else {
      if (t.parcels.length) { var n = t.parcels.length, sum = 0; t.parcels.forEach(function (oid) { var o = orderById(oid); if (o) sum += shipOrder(o, doorIndex('out', t.dock)); }); toast('Truck out with ' + n + ' parcel' + (n > 1 ? 's' : '') + ' · ' + money(sum), 'good'); logEvent('Outbound truck left ' + dockLabel(doorIndex('out', t.dock)) + ' with ' + n + ' parcels, ' + money(sum) + ' paid', 'good'); if (why === 'dispatched') addXp(XP.truck); }
      else logEvent('Outbound truck left ' + dockLabel(doorIndex('out', t.dock)) + ' empty');
      t.parcels = [];
    }
    // nobody rides along
    var b = trailerBounds(t);
    if (player.x > b.x0 - 0.3 && player.x < b.x1 + 0.3 && player.z > b.z0 - 0.3 && player.z < b.z1 + 0.3) { player.x = t.side * (HALL.x - 1.6); player.z = t.z; }
    if (driving && S.fork.x > b.x0 - 0.3 && S.fork.x < b.x1 + 0.3 && Math.abs(S.fork.z - t.z) < 1.5) { S.fork.x = t.side * (HALL.x - 2.5); S.fork.z = t.z; }
    t.state = 'leaving'; sfx('truck'); rebuildBoardSoon();
  }
  function onPalletLeftTruck(p) {
    var t = truckById(p.truck); p.place = 'floor'; p.truck = null;
    if (!t) return;
    t.unloaded++; S.stats.received++; pay(ECON.receiveFee, 'Receiving fee, pallet of ' + skuName(p.sku)); addXp(XP.pallet);
    feedPush('Received a pallet of ' + skuName(p.sku) + ' · +' + money(ECON.receiveFee), 'good');
  }
  function loadPrompt(tid) {
    var t = truckById(tid); if (!t || t.state !== 'docked') return null;
    if (S.hand && S.hand.kind === 'parcel') { var o = orderById(S.hand.order); return 'Load parcel #' + (o ? o.num : '?') + ' into the truck'; }
    if (player.tool === 'cart' && cartParcels().length) return 'Unload ' + cartParcels().length + ' parcel' + (cartParcels().length === 1 ? '' : 's') + ' from the cart into the truck';
    return 'Outbound trailer · ' + t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded · leaves ' + fmtTime(t.leave);
  }
  function loadUse(tid) {
    var t = truckById(tid); if (!t || t.state !== 'docked') return;
    if (player.tool === 'cart' && cartParcels().length) { var n = 0; cartParcels().slice().forEach(function (oid) { var oc = orderById(oid); if (oc) { t.parcels.push(oc.id); oc.state = 'loaded'; n++; addXp(XP.ship); laneWarn(oc, t); } }); cartParcels().length = 0; sfx('crate'); introStep('load'); rebuildBoardSoon(); feedPush(n + ' parcel' + (n === 1 ? '' : 's') + ' loaded from the cart', 'good'); hudDirty = true; return; }
    if (!(S.hand && S.hand.kind === 'parcel')) return;
    var o = orderById(S.hand.order); if (!o) { handSet(null); return; }
    t.parcels.push(o.id); o.state = 'loaded'; handSet(null); sfx('crate'); addXp(XP.ship); introStep('load'); rebuildBoardSoon();
    feedPush('Parcel #' + o.num + ' loaded for ' + clientName(o.client), 'good'); laneWarn(o, t);
  }
  // a parcel loaded out of the wrong door still ships, for a forwarding fee at departure; say so when it goes aboard
  function laneWarn(o, t) { var m = orderMode(o); if (MODES[m].door === doorIndex('out', t.dock)) return; feedPush('#' + o.num + ' is a ' + m.toUpperCase() + ' parcel: out of ' + dockLabel(doorIndex('out', t.dock)) + ' it pays a forwarding fee (' + Math.round((1 - MODE_FEE) * 100) + '%)', 'bad'); }
  function consolePrompt(i) {
    var t = truckAtDoor(i);
    if (!t) { var k = i - 2; if (!dockOwned(k)) return 'Dock ' + dockLabel(i) + ' · opens with the sortation deck'; var nxt = outNext(k); return 'Dock ' + dockLabel(i) + ' · ' + MODES[TRUCK_OUT[k].mode].name.toLowerCase() + ' lane · no truck · next at ' + fmtTime(nxt.arrive); }
    return t.parcels.length ? 'Dispatch the truck now (' + t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ')' : 'Dock ' + dockLabel(i) + ' · truck waiting, nothing loaded yet';
  }
  function consoleUse(i) {
    var t = truckAtDoor(i); if (!t) { sfx('bad'); return; }
    if (!t.parcels.length) { toast('Nothing loaded yet.', 'bad'); return; }
    sfx('horn'); introStep('dispatch'); truckLeave(t, 'dispatched');
  }
  var boardT = 0; function rebuildBoardSoon() { boardT = 0.01; }
  // ── Orders ────────────────────────────────────────────────────────
  function clientName(id) { for (var i = 0; i < CLIENTS.length; i++) if (CLIENTS[i].id === id) return CLIENTS[i].name; return id || 'Walk-in'; }
  function orderById(id) { for (var i = 0; i < S.orders.length; i++) if (S.orders[i].id === id) return S.orders[i]; return null; }
  function unlockedSkus() { var tier = tierFor(S.level); return SKUS.filter(function (s) { return s.tier <= tier; }).map(function (s) { return s.id; }); }
  function openOrders() { return S.orders.filter(function (o) { return o.state === 'open'; }); }
  function activeClients() { return CLIENTS.filter(function (c) { return !c.deck || sorterOwned(); }); }   // the deck accounts wait for the sortation deck
  function dueText(abs) { var day = Math.floor(abs / 24), t = abs % 24; return fmtTime(t) + (day > S.day ? ' tomorrow' : day < S.day ? ' (overdue)' : ''); }
  function nextOutLeave(minAbs, dock) {   // the next departure from one dock (the order's lane), or from any dock you own
    for (var d = 0; d < 4; d++) for (var k = 0; k < TRUCK_OUT.length; k++) { if ((dock !== undefined && k !== dock) || !dockOwned(k)) continue; var ws = TRUCK_OUT[k].windows; for (var w = 0; w < ws.length; w++) { var abs = (S.day + d) * 24 + ws[w].leave; if (abs >= minAbs) return abs; } }
    return minAbs + 24;
  }
  // What an order may ask for: stock on site (the racks, the bench, the floor, the cart, and the pallets on a signed truck) less
  // what the open orders already claim. An order is never written for boxes that are not here, and never for boxes another
  // order is still waiting on, so two orders cannot want the same six tins and a pick is never surplus the moment it is made.
  function freeStock() {
    var free = {}; function add(sku, n) { free[sku] = (free[sku] || 0) + n; }
    for (var k in S.slots) if (S.slots[k].n) add(S.slots[k].sku, S.slots[k].n);
    for (var b in S.bench.boxes) add(b, S.bench.boxes[b]);
    S.pallets.forEach(function (p) { if (p.n <= 0 || !p.sku || (SKU[p.sku] && SKU[p.sku].raw)) return; if (p.place === 'truck') { var t = truckById(p.truck); if (!t || t.state !== 'docked' || !t.signed) return; } add(p.sku, p.n); });
    S.floor.forEach(function (f) { if (f.kind === 'box' && !f.damaged) add(f.sku, 1); });
    (S.cart && S.cart.boxes || []).forEach(function (s) { add(s, 1); });
    S.orders.forEach(function (o) { if (o.state === 'open' || o.state === 'packing') o.lines.forEach(function (l) { add(l.sku, -(l.qty - (l.packed || 0))); }); });
    return free;
  }
  // what the open orders still want that is not on the bench yet, and what sits on the bench that no open order wants
  function benchNeed() { var need = {}; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { need[l.sku] = (need[l.sku] || 0) + l.qty; }); }); for (var k in S.bench.boxes) need[k] = (need[k] || 0) - S.bench.boxes[k]; for (var q in need) if (need[q] <= 0) delete need[q]; return need; }
  function benchSurplus() { var want = {}; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { want[l.sku] = (want[l.sku] || 0) + l.qty; }); }); var sur = {}; for (var k in S.bench.boxes) { var n = S.bench.boxes[k] - (want[k] || 0); if (n > 0) sur[k] = n; } return sur; }
  function genOrder(rush) {
    var free = freeStock(), avail = unlockedSkus().filter(function (s) { return (free[s] || 0) > 0; }); if (!avail.length) return null;
    var client = S.contract && S.contract.accepted && Math.random() < 0.5 ? CLIENTS.filter(function (c) { return c.id === S.contract.client; })[0] : pick(activeClients()), pool = client.likes.filter(function (s) { return avail.indexOf(s) >= 0; }); if (!pool.length) { pool = avail; }
    var nLines = client.deck ? randi(2, 4) : randi(1, Math.min(3, 1 + Math.floor(S.level / 2) + (Math.random() < 0.35 ? 1 : 0)));   // a deck account orders two to four lines
    var lines = [], used = {};
    for (var i = 0; i < nLines; i++) {
      // what the client likes and you have free, else anything you have free; never more of a line than is free
      var liked = pool.filter(function (s) { return !used[s] && free[s] > 0; }), any = avail.filter(function (s) { return !used[s] && free[s] > 0; });
      var from = liked.length && (i === 0 || Math.random() < 0.85) ? liked : any;
      if (!from.length) break;
      var sku = pick(from); used[sku] = 1;
      var qty = client.deck ? clamp(randi(2, 8), 1, Math.min(8, free[sku])) : clamp(randi(1, 2 + Math.floor(S.level / 2)), 1, Math.min(6, free[sku])); free[sku] -= qty;
      lines.push({ sku: sku, qty: qty });
    }
    if (!lines.length) return null;
    var value = 0; lines.forEach(function (l) { value += l.qty * SKU[l.sku].val; });
    var mode = clientMode(client.id), due = rush ? nowAbs() + 2 : nextOutLeave(nowAbs() + 1.5, MODES[mode].door - 2);   // due at the next truck of its own lane
    var o = { id: uid('or'), num: S.orderSeq++, client: client.id, mode: mode, lines: lines, created: nowAbs(), due: due, state: 'open', pay: Math.round((value * ECON.margin + ECON.handling) * (mode === 'air' ? AIR_RATE : 1) * (client.deck ? DECK_RATE : 1)) * (rush ? 2 : 1), rush: !!rush, late: false, short: false };
    S.orders.push(o);
    logEvent('Order #' + o.num + ' from ' + client.name + ' (' + MODES[mode].name.toUpperCase() + ' lane, ' + dockLabel(MODES[mode].door) + '): ' + lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + (rush ? ' · RUSH, due ' + fmtTime(due) : ''), 'rare');
    sfx('chime'); rebuildBoardSoon(); introStep('order'); hudDirty = true;
    return o;
  }
  // contracts: every few days a client offers a run; every order of theirs shipped on time in the window counts
  function offerContract() {
    var client = pick(activeClients()), need = 3 + Math.floor(S.level / 2), days = 3;
    S.contract = { client: client.id, need: need, done: 0, until: (S.day + days) * 24 + 18, bonus: need * 60 + S.level * 40, penalty: 150, accepted: false, offeredDay: S.day };
    logEvent(client.name + ' offers a contract: ' + need + ' orders on time in ' + days + ' days for a ' + money(S.contract.bonus) + ' bonus. Accept it on the office PC.', 'rare'); toast('Contract offer from ' + client.name + ' on the PC', 'rare'); sfx('chime');
  }
  function contractTick() {
    var c = S.contract; if (!c) { if (S.level >= 3 && S.day >= S.nextOffer && S.time >= 9 && S.time < 9.2 && !isSunday()) offerContract(); return; }
    if (!c.accepted && S.day > c.offeredDay) { S.contract = null; S.nextOffer = S.day + 2; logEvent('The contract offer from ' + clientName(c.client) + ' lapsed'); return; }
    if (c.accepted && nowAbs() > c.until) {
      if (c.done >= c.need) { pay(c.bonus, 'Contract bonus, ' + clientName(c.client)); addRep(6); toast('Contract complete: ' + money(c.bonus) + ' bonus', 'rare'); logEvent('Contract with ' + clientName(c.client) + ' complete: ' + money(c.bonus) + ' bonus', 'rare'); sfx('fanfare'); addXp(40); }
      else { pay(-c.penalty, 'Contract penalty, ' + clientName(c.client)); addRep(-4); toast('Contract missed: ' + c.done + ' of ' + c.need + '. Penalty ' + money(c.penalty), 'bad'); logEvent('Contract with ' + clientName(c.client) + ' missed (' + c.done + ' of ' + c.need + ')', 'bad'); }
      S.contract = null; S.nextOffer = S.day + randi(2, 4);
    }
  }
  function tickOrders() {
    var n = nowAbs();
    if (Math.floor(S.time * 5) !== S.flags.ctQ) { S.flags.ctQ = Math.floor(S.time * 5); contractTick(); }
    if (S.time >= 8 && S.time < 17 && !S.events.power && !isSunday()) {
      var openN = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed'; }).length;
      var maxOpen = 3 + S.level, gap = Math.max(0.8, 2.3 - S.level * 0.12);
      // the first order waits for stock: until something is on site and signed for there is nothing a client can order
      if (S.day === 1 && !S.flags.firstOrder) { if (S.time >= 8.5 && n - (S.flags.firstTry || 0) >= 0.1) { S.flags.firstTry = n; if (genOrder(false)) { S.flags.firstOrder = 1; S.lastOrderAt = n; } } }
      else if (openN < maxOpen && n - S.lastOrderAt >= gap && !S.flags.noOrders) { S.lastOrderAt = n + randf(-0.3, 0.3); genOrder(Math.random() < 0.12 && S.level >= 3); }
    }
    for (var i = S.orders.length - 1; i >= 0; i--) {
      var o = S.orders[i];
      if ((o.state === 'open' || o.state === 'packing' || o.state === 'packed') && !o.late && n > o.due) { o.late = true; addRep(-1); logEvent('Order #' + o.num + ' is late', 'bad'); rebuildBoardSoon(); }
      if (o.state === 'open' && n > o.due + 30) { S.orders.splice(i, 1); addRep(-3); S.stats.late++; logEvent(clientName(o.client) + ' cancelled order #' + o.num, 'bad'); toast('Order #' + o.num + ' cancelled', 'bad'); rebuildBoardSoon(); }
    }
  }

  // ── The packing bench ─────────────────────────────────────────────
  function benchCount() { var n = 0; for (var k in S.bench.boxes) n += S.bench.boxes[k] || 0; return n; }
  function benchAdd(sku, n) { S.bench.boxes[sku] = (S.bench.boxes[sku] || 0) + n; }
  function benchTake(sku, n) { var k = Math.min(n, S.bench.boxes[sku] || 0); if (!k) { delete S.bench.boxes[sku]; return 0; } S.bench.boxes[sku] -= k; if (S.bench.boxes[sku] <= 0) delete S.bench.boxes[sku]; return k; }   /* a SKU the bench never held used to go undefined minus zero, NaN, and the terminal read NaN / 16 */
  // what the cart would do at the bench: the boxes the orders still want come off it, and the bench's surplus goes onto it
  function cartAtBench() { var need = benchNeed(), off = 0, on = 0, room = ECON.benchCap - benchCount(); S.cart.boxes.forEach(function (sku) { if ((need[sku] || 0) > 0 && off < room) { need[sku]--; off++; } }); var sur = benchSurplus(); for (var k in sur) on += sur[k]; on = Math.min(on, ECON.cartCap - (cartLoad() - off)); return { off: off, on: Math.max(0, on) }; }
  function benchPrompt() {
    if (player.tool === 'cart') { var c = cartAtBench(); return (c.off ? 'Unload ' + c.off + ' wanted ' + (c.off === 1 ? 'box' : 'boxes') : '') + (c.off && c.on ? ', ' : '') + (c.on ? 'take ' + c.on + ' surplus back on the cart' : '') || 'Packing bench · nothing on the cart the orders want'; }
    if (isJack(player.tool)) return null;
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'Damaged boxes do not ship: bin it';
    if (S.hand && S.hand.kind === 'box') return benchCount() < ECON.benchCap ? 'Put the box on the bench' : 'The bench is full';
    if (S.hand) return null;
    var sur = benchSurplus(), sn = 0; for (var k in sur) sn += sur[k];
    return 'Packing bench · ' + benchCount() + ' boxes · ' + openOrders().length + ' open orders' + (sn ? ' · ' + sn + ' surplus (look at a box to take it back)' : '');
  }
  function benchUse() {
    if (player.tool === 'cart') {
      // the boxes the open orders still want come off the cart; the surplus on the bench goes onto the cart, to go back on the racks
      var need = benchNeed(), off = 0, on = 0;
      for (var i = S.cart.boxes.length - 1; i >= 0; i--) { var sku = S.cart.boxes[i]; if ((need[sku] || 0) > 0 && benchCount() < ECON.benchCap) { S.cart.boxes.splice(i, 1); benchAdd(sku, 1); need[sku]--; off++; } }
      var sur = benchSurplus(); for (var k in sur) while (sur[k] > 0 && cartLoad() < ECON.cartCap) { benchTake(k, 1); S.cart.boxes.push(k); sur[k]--; on++; }
      if (off || on) { sfx('putdown'); introStep('bench'); toast((off ? off + ' onto the bench' : '') + (off && on ? ' · ' : '') + (on ? on + ' surplus onto the cart' : ''), 'good'); hudDirty = true; }
      else if (S.cart.boxes.length) toast(benchCount() >= ECON.benchCap ? 'The bench is full.' : 'No open order wants what is on the cart. Put it back on the racks.', 'bad');
      else toast('Nothing surplus on the bench.', '');
      return;
    }
    if (isJack(player.tool)) return;
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. Bin it.', 'bad'); return; }
    if (S.hand && S.hand.kind === 'box') { if (benchCount() >= ECON.benchCap) { toast('The bench is full.', 'bad'); return; } benchAdd(S.hand.sku, 1); handSet(null); sfx('putdown'); introStep('bench'); return; }
    if (S.hand) return;
    sfx('click'); toast('Look at a box on the bench and press E to take it back. The terminal at the end packs the orders.', '');
  }
  // a box on the bench is a thing you look at: E takes it back into your hand (or onto the cart)
  function benchBoxPrompt(src) {
    var sku = src.sku, sur = benchSurplus()[sku] || 0, tag = sur ? ' · surplus, no order wants it' : ' · an open order wants it';
    if (player.tool === 'cart') return cartLoad() < ECON.cartCap ? 'Put the box of ' + skuName(sku) + ' on the cart' + tag : 'The cart is full';
    if (S.hand && S.hand.kind === 'box' && !S.hand.damaged) return benchCount() < ECON.benchCap ? 'Put the box on the bench' : 'The bench is full';
    if (S.hand || player.tool) return null;
    return 'Take the box of ' + skuName(sku) + ' off the bench' + tag;
  }
  function benchBoxUse(src) {
    var sku = src.sku;
    if (player.tool === 'cart') { if (cartLoad() >= ECON.cartCap) { sfx('bad'); return; } if (benchTake(sku, 1)) { S.cart.boxes.push(sku); sfx('pickup'); hudDirty = true; } return; }
    if (S.hand && S.hand.kind === 'box' && !S.hand.damaged) { benchUse(); return; }
    if (S.hand || player.tool) return;
    if (benchTake(sku, 1)) { handSet({ kind: 'box', sku: sku }); sfx('pickup'); }
  }
  // every surplus box on the bench, and every undamaged loose box on the hall floor, back onto the racks in one go (Tyson, 2026-10-07: a save
  // came back with a bench full of surplus and putting it back by hand was a chore)
  function returnSurplus() {
    var sur = benchSurplus(), moved = 0, floorN = 0;
    for (var sku in sur) { var left = sur[sku]; for (var guard = 0; left > 0 && guard < 40; guard++) { var key = findSlotFor(sku, 1, 1); if (!key) break; var room = Math.min(left, slotSpace(key, sku)); if (room <= 0) break; benchTake(sku, room); slotAdd(key, sku, room); left -= room; moved += room; } }
    for (var i = S.floor.length - 1; i >= 0; i--) { var f = S.floor[i]; if (f.kind !== 'box' || f.damaged || !insideHall(f.x, f.z)) continue; var k2 = findSlotFor(f.sku, 1, 1); if (!k2) continue; slotAdd(k2, f.sku, 1); S.floor.splice(i, 1); moved++; floorN++; }
    if (moved) { S.stats.putaway += moved; sfx('crate'); toast(moved + ' surplus box' + (moved > 1 ? 'es' : '') + ' back on the racks' + (floorN ? ' (' + floorN + ' off the floor)' : ''), 'good'); logEvent('Returned ' + moved + ' surplus boxes to the racks' + (floorN ? ', ' + floorN + ' of them off the floor' : ''), 'good'); hudDirty = true; screenDirtyAll(); if (ui.panelOpen) renderPanel(); }
    else toast('Nothing surplus to return.', '');
    return moved;
  }
  function surplusCount() { var sur = benchSurplus(), n = 0; for (var k in sur) n += sur[k]; S.floor.forEach(function (f) { if (f.kind === 'box' && !f.damaged && insideHall(f.x, f.z)) n++; }); return n; }
  function orderNeed(o) { var tot = 0, have = 0; o.lines.forEach(function (l) { tot += l.qty; have += Math.min(l.qty, S.bench.boxes[l.sku] || 0); }); return { tot: tot, have: have }; }
  function canPack(o) { return o.state === 'open' && o.lines.every(function (l) { return (S.bench.boxes[l.sku] || 0) >= l.qty; }); }
  function canPackShort(o) { var n = orderNeed(o); return o.state === 'open' && n.have >= Math.ceil(n.tot / 2) && n.have < n.tot; }
  function shelfPrompt(src) { var o = orderById(src.order); if (player.tool === 'cart') return cartLoad() < ECON.cartCap ? 'Load parcel #' + (o ? o.num : '?') + ' onto the cart (' + cartLoadText() + ')' : 'The cart is full'; if (S.hand || player.tool) return null; return 'Pick up parcel #' + (o ? o.num : '?') + (o ? ' for ' + clientName(o.client) : ''); }
  function shelfUse(src) { if (player.tool === 'cart') { if (cartLoad() >= ECON.cartCap) { sfx('bad'); return; } var kc = S.bench.parcels.indexOf(src.order); if (kc < 0) return; S.bench.parcels.splice(kc, 1); cartParcels().push(src.order); sfx('pickup'); hudDirty = true; return; } if (S.hand || player.tool) return; var k = S.bench.parcels.indexOf(src.order); if (k < 0) return; S.bench.parcels.splice(k, 1); handSet({ kind: 'parcel', order: src.order }); sfx('pickup'); }

  // ── Shipping ──────────────────────────────────────────────────────
  function shipOrder(o, door) {   // door: the outbound door the parcel left by; the wrong lane's door pays the forwarding fee
    var late = nowAbs() > o.due, m = orderMode(o), wrong = door !== undefined && MODES[m].door !== door, amount = Math.round(o.pay * (o.short ? ECON.shortCut : 1) * (late ? ECON.lateCut : 1) * (wrong ? MODE_FEE : 1));
    if (wrong) S.stats.misrouted = (S.stats.misrouted || 0) + 1;
    pay(amount, 'Order #' + o.num + ' shipped to ' + clientName(o.client) + (late ? ' (late)' : '') + (o.short ? ' (short)' : '') + (wrong ? ' (' + m + ' parcel out of ' + dockLabel(door) + ': forwarding fee)' : ''));
    if (!late && S.contract && S.contract.accepted && S.contract.client === o.client) { S.contract.done++; feedPush('Contract: ' + S.contract.done + ' of ' + S.contract.need, 'good'); }
    addRep(late ? -1 : o.rush ? 3 : 1.5); S.stats.shipped++; if (late) S.stats.late++; addXp(XP.ship);
    o.state = 'shipped'; o.shippedAt = nowAbs(); o.paid = amount;
    for (var i = 0; i < S.orders.length; i++) if (S.orders[i] === o) { S.orders.splice(i, 1); break; }
    S.shipped.unshift({ num: o.num, client: o.client, paid: amount, late: late, short: o.short, day: S.day, mode: m, wrong: wrong }); if (S.shipped.length > 40) S.shipped.pop();
    sfx('cash'); hudDirty = true;
    return amount;
  }
  // a packed order whose parcel was lost (dropped off the dock, say) is a short ship with nothing in it: never happens by design, but the save must not keep ghosts
  function parcelExists(oid) {
    if (S.bench.parcels.indexOf(oid) >= 0) return true;
    if (S.hand && S.hand.kind === 'parcel' && S.hand.order === oid) return true;
    if (S.floor.some(function (f) { return f.kind === 'parcel' && f.order === oid; })) return true;
    if (S.trucks.some(function (t) { return t.parcels.indexOf(oid) >= 0; })) return true;
    if (S.staff.some(function (st) { return st.carry && st.carry.kind === 'parcel' && st.carry.order === oid; })) return true;
    if ((S.cart.parcels || []).indexOf(oid) >= 0) return true;
    if (S.pack && S.pack.out === oid) return true;
    for (var bk in (S.belts || {})) if (S.belts[bk].some(function (it) { return it.kind === 'parcel' && it.order === oid; })) return true;   // riding any belt, built-in or a piece
    for (var sk in (S.stage || {})) if (S.stage[sk].indexOf(oid) >= 0) return true;   // staged beside a dock loader
    return false;
  }
  // ── Tools you push: the jack and the cart ─────────────────────────
  var jackMesh = null, jackMeshes = {}, cartMesh = null, forkM = null, driving = false, forkSpeed = 0, forkLook = { yaw: 0, pitch: 0 }, jackModel = null;
  function isJack(t) { return t === 'jack' || t === 'jack2'; }
  function jackTool() { return isJack(player.tool) ? player.tool : 'jack'; }
  function toolWorld(tool) {
    if (player.tool === tool) return { x: player.x - Math.sin(player.yaw) * 1.15, z: player.z - Math.cos(player.yaw) * 1.15, ry: player.yaw + Math.PI };
    var t = S[tool]; return { x: t.x, z: t.z, ry: t.rot || 0 };
  }
  function buildTools() {
    // ── the pallet jack: forks either side of the origin (where the pallet sits), the pump body and the tiller behind (local -z)
    var buildJack = function (tool, noHit) { var j = new THREE.Group(); j.userData.dynamic = true; scene.add(j); if (!noHit) jackMeshes[tool] = j;   /* noHit: a jack a receiver pushes, not one you can grab */
    var JO = std({ color: 0xe8701a, roughness: 0.45, metalness: 0.35 });
    [-0.3, 0.3].forEach(function (x) {
      box(0.16, 0.06, 1.1, JO, x, 0.095, 0.0, j); var tip = box(0.16, 0.06, 0.16, JO, x, 0.075, 0.62, j); tip.rotation.x = 0.35;
      cyl(0.035, 0.12, MAT.rubber, x, 0.04, 0.42, j, 10).rotation.z = Math.PI / 2; cyl(0.035, 0.12, MAT.rubber, x, 0.04, 0.12, j, 10).rotation.z = Math.PI / 2;
      box(0.16, 0.16, 0.08, JO, x, 0.16, -0.55, j);
    });
    box(0.5, 0.36, 0.3, JO, 0, 0.3, -0.66, j); box(0.54, 0.04, 0.34, MAT.steelDark, 0, 0.5, -0.66, j);
    cyl(0.055, 0.26, MAT.chrome, 0, 0.42, -0.6, j, 12); cyl(0.07, 0.1, MAT.steelDark, 0, 0.58, -0.6, j, 12);
    [-0.17, 0.17].forEach(function (x) { cyl(0.09, 0.07, MAT.rubber, x, 0.09, -0.76, j, 14).rotation.z = Math.PI / 2; cyl(0.05, 0.075, MAT.chrome, x, 0.09, -0.76, j, 10).rotation.z = Math.PI / 2; });
    var tiller = new THREE.Group(); tiller.position.set(0, 0.5, -0.78); tiller.rotation.x = -0.55; j.add(tiller); j.userData.tiller = tiller;
    cyl(0.025, 1.0, MAT.steelDark, 0, 0.5, 0, tiller, 10); box(0.44, 0.06, 0.07, MAT.rubber, 0, 1.0, 0, tiller); box(0.05, 0.05, 0.05, MAT.rubber, -0.2, 1.0, 0, tiller); box(0.05, 0.05, 0.05, MAT.rubber, 0.2, 1.0, 0, tiller);
    box(0.08, 0.03, 0.1, MAT.red, 0, 0.95, 0.06, tiller); cyl(0.04, 0.08, MAT.steelDark, 0, 0.0, 0, tiller, 10);
    sign(['2500 kg'], 0.3, 0.1, 0, 0.3, -0.5, 0, { w: 256, h: 80, bg: '#1b232c', fg: '#f5b53d' }, j);
    groundBlob(0.9, 1.7, 0, -0.1, j, 0);
    if (!noHit) hitBox(1.0, 1.3, 1.9, 0, 0.6, -0.25, { prompt: function () { return toolPrompt(tool); }, use: function () { grabTool(tool); } }, j); return j; };
    jackModel = buildJack; jackMesh = buildJack('jack'); buildJack('jack2');
    // ── the picking cart: a tubular frame, two mesh shelves, a push loop, four casters and a clipboard
    var c = new THREE.Group(); c.userData.dynamic = true; scene.add(c); cartMesh = c;
    // 1.13.6: 1.7 m long with three shelves of four, twelve boxes or parcels (it held six on two shelves)
    [[-0.82, -0.3], [0.82, -0.3], [-0.82, 0.3], [0.82, 0.3]].forEach(function (o) { cyl(0.018, 1.48, MAT.chrome, o[0], 0.82, o[1], c, 8); box(0.05, 0.08, 0.05, MAT.steelDark, o[0], 0.1, o[1], c); var cw = cyl(0.045, 0.03, MAT.rubber, o[0], 0.045, o[1] + 0.03, c, 12); cw.rotation.z = Math.PI / 2; });
    [0.3, 0.82, 1.34].forEach(function (y) { box(1.7, 0.025, 0.66, MAT.steelDark, 0, y - 0.012, 0, c); var m = plane(1.66, 0.62, MAT.mesh, 0, y + 0.002, 0, -Math.PI / 2, 0, c); m.receiveShadow = false; box(1.7, 0.05, 0.02, MAT.chrome, 0, y + 0.02, 0.32, c); box(1.7, 0.05, 0.02, MAT.chrome, 0, y + 0.02, -0.32, c); });
    cyl(0.018, 0.35, MAT.chrome, -0.82, 1.72, -0.3, c, 8); cyl(0.018, 0.35, MAT.chrome, 0.82, 1.72, -0.3, c, 8); cyl(0.02, 1.7, MAT.rubber, 0, 1.9, -0.3, c, 8).rotation.z = Math.PI / 2;
    box(0.22, 0.3, 0.02, MAT.plastic, 0.65, 1.62, -0.29, c); box(0.2, 0.26, 0.01, MAT.paper, 0.65, 1.62, -0.275, c);
    groundBlob(2.1, 1.1, 0, 0, c, 0);
    hitBox(1.8, 1.9, 0.8, 0, 0.95, 0, { prompt: function () { return toolPrompt('cart'); }, use: function () { grabTool('cart'); }, alt: function () { cartHandSwap(); } }, c);
    // ── the forklift: a counterbalance electric truck. Rounded shells, treaded tyres, an I-section mast with chains and
    // hoses, a proper seat and column, a dashboard with gauges, the overhead guard as one bent tube, decals and plates.
    var f = new THREE.Group(); f.userData.dynamic = true; scene.add(f);
    var FY = MAT.forkYellow, FD = MAT.black, FS = MAT.steelDark;
    var rb = function (w, h, d, r, mat, x, y, z, parent) { var m = new THREE.Mesh(bevelGeo(w, h, d, r), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || f).add(m); return m; };
    var tyre = function (r, w, x, y, z, parent) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.z = Math.PI / 2; (parent || f).add(g);
      var RUB = std({ color: 0x1a1b1d, roughness: 0.95 }), RIM = std({ color: 0x8d9298, roughness: 0.35, metalness: 0.7 }), GROOVE = std({ color: 0x0c0d0e, roughness: 1 });
      cyl(r, w, RUB, 0, 0, 0, g, 36); var sw1 = new THREE.Mesh(new THREE.TorusGeometry(r - 0.025, 0.012, 6, 36), RUB); sw1.position.y = w / 2 + 0.004; sw1.rotation.x = Math.PI / 2; g.add(sw1); var sw2 = sw1.clone(); sw2.position.y = -w / 2 - 0.004; g.add(sw2);
      for (var t = 0; t < 24; t++) { var a = t / 24 * 6.283, gr = box(0.014, w * 0.8, 0.02, GROOVE, 0, 0, 0, g); gr.position.set(Math.cos(a) * (r + 0.002), 0, Math.sin(a) * (r + 0.002)); gr.rotation.y = -a; gr.rotation.z = (t % 2 ? 0.35 : -0.35); }
      var cg = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 5, 36), GROOVE); cg.rotation.x = Math.PI / 2; g.add(cg);
      cyl(r * 0.62, w + 0.02, RIM, 0, 0, 0, g, 24); cyl(r * 0.5, w + 0.06, std({ color: 0x5f656b, roughness: 0.4, metalness: 0.7 }), 0, 0, 0, g, 24); cyl(r * 0.18, w + 0.09, FD, 0, 0, 0, g, 12);
      for (var n = 0; n < 6; n++) { var bx = Math.cos(n / 6 * 6.283) * r * 0.36, bz = Math.sin(n / 6 * 6.283) * r * 0.36; var bolt = cyl(0.014, w + 0.1, MAT.chrome, bx, 0, bz, g, 6); var bh = cyl(0.028, 0.012, std({ color: 0x3a3e44, roughness: 0.5, metalness: 0.6 }), bx, 0, bz, g, 8); bh.position.y = 0; }
      return g;
    };
    rb(1.12, 0.5, 1.95, 0.05, FY, 0, 0.5, -0.25); rb(1.1, 0.9, 0.62, 0.1, FD, 0, 0.62, -1.18); rb(0.9, 0.28, 0.5, 0.05, FY, 0, 1.2, -1.15);
    rb(0.9, 0.42, 0.7, 0.04, FS, 0, 0.97, -0.5); rb(0.92, 0.03, 0.72, 0.01, MAT.plastic, 0, 1.195, -0.5); rb(0.3, 0.05, 0.04, 0.01, MAT.chrome, 0, 1.0, -0.14); box(1.12, 0.03, 0.6, MAT.chequer, 0, 0.76, 0.3, f);
    rb(0.3, 0.03, 0.18, 0.01, FD, -0.2, 0.78, 0.25).rotation.x = -0.3; rb(0.3, 0.03, 0.18, 0.01, FD, 0.2, 0.78, 0.25).rotation.x = -0.3;
    // the operator's compartment: a contoured seat on a suspension with a belt, armrest and lever bank, the column with its
    // shroud and a wheel with spokes and a spinner knob, a moulded dash with the cluster, key switch, horn and direction lever,
    // pedals and a parking brake on the floor plate
    var SEAT = std({ color: 0x1f2630, roughness: 0.9 }), SEAT2 = std({ color: 0x2b3542, roughness: 0.9 });
    rb(0.5, 0.08, 0.5, 0.03, FS, 0, 1.22, -0.5); rb(0.3, 0.12, 0.3, 0.02, FD, 0, 1.15, -0.5);
    rb(0.5, 0.12, 0.5, 0.05, SEAT, 0, 1.32, -0.5); rb(0.1, 0.16, 0.5, 0.04, SEAT2, -0.22, 1.35, -0.5); rb(0.1, 0.16, 0.5, 0.04, SEAT2, 0.22, 1.35, -0.5);
    var bk = rb(0.5, 0.6, 0.12, 0.05, SEAT, 0, 1.66, -0.78); bk.rotation.x = -0.15; var bk2 = rb(0.12, 0.5, 0.14, 0.04, SEAT2, -0.2, 1.66, -0.77); bk2.rotation.x = -0.15; var bk3 = rb(0.12, 0.5, 0.14, 0.04, SEAT2, 0.2, 1.66, -0.77); bk3.rotation.x = -0.15; rb(0.3, 0.16, 0.12, 0.04, SEAT, 0, 2.02, -0.84);
    var belt = box(0.05, 0.7, 0.01, MAT.hivisOrange, 0.1, 1.6, -0.7, f); belt.rotation.z = 0.45; box(0.06, 0.04, 0.03, MAT.chrome, -0.16, 1.36, -0.45, f);
    rb(0.08, 0.05, 0.36, 0.02, FD, -0.34, 1.46, -0.5); rb(0.08, 0.05, 0.36, 0.02, FD, 0.34, 1.46, -0.5);
    // the lever bank on the right: lift, tilt and sideshift, with a label plate
    rb(0.16, 0.1, 0.32, 0.02, FS, -0.47, 1.26, -0.05); [-0.1, 0, 0.1].forEach(function (lz, i) { var lv = cyl(0.01, 0.2, MAT.chrome, -0.47, 1.4, lz, f, 6); lv.rotation.x = -0.25 + i * 0.1; sphere(0.02, i === 0 ? MAT.red : FD, -0.47, 1.49, lz - 0.05 + i * 0.02, f); });
    sign(['LIFT · TILT · SHIFT'], 0.26, 0.04, -0.47, 1.32, 0.12, 0, { w: 256, h: 40, bg: '#1b232c', fg: '#eef1f5' }, f);
    // the column: a shroud from the dash to the wheel, the wheel ahead of and below the eyes, tilted back to the driver
    var colGrp = new THREE.Group(); colGrp.position.set(0, 1.08, 0.2); colGrp.rotation.x = -0.62; f.add(colGrp);
    cyl(0.045, 0.42, FS, 0, 0.21, 0, colGrp, 12, 0.06); cyl(0.07, 0.1, FD, 0, 0.1, 0, colGrp, 12, 0.09);
    var wheel = new THREE.Group(); wheel.position.set(0, 0.44, 0); colGrp.add(wheel);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 10, 28), MAT.rubber); rim.rotation.x = Math.PI / 2; wheel.add(rim);
    [0, 1, 2].forEach(function (s) { var sp = box(0.26, 0.012, 0.03, FD, 0, 0, 0, wheel); sp.rotation.y = s * 1.05; }); cyl(0.045, 0.03, FD, 0, 0, 0, wheel, 10); cyl(0.012, 0.05, MAT.chrome, 0.11, 0.03, 0.08, wheel, 6); sphere(0.02, FD, 0.11, 0.06, 0.08, wheel);
    var dirLever = cyl(0.008, 0.14, FD, 0.08, 0.28, 0.0, colGrp, 6); dirLever.rotation.z = -1.2; sphere(0.014, FD, 0.17, 0.3, 0, colGrp);
    // the dash: a moulded cowl ahead of the column, the cluster, a key switch, the horn, a rocker, the hour meter
    rb(0.6, 0.2, 0.26, 0.05, FS, 0, 1.12, 0.42); var cowl = rb(0.56, 0.12, 0.22, 0.04, FD, 0, 1.25, 0.4); cowl.rotation.x = 0.3;
    rb(0.1, 0.16, 0.06, 0.01, FD, 0, 1.36, 0.5); var clg = new THREE.Group(); clg.position.set(0, 1.46, 0.52); clg.rotation.order = 'YXZ'; clg.rotation.y = Math.PI; clg.rotation.x = 0.3; f.add(clg); rb(0.36, 0.16, 0.05, 0.015, FD, 0, 0, -0.03, clg); var clMat = new THREE.MeshBasicMaterial({ map: textTex(['24V ▮▮▮▮▮▮▯▯   0.0 km/h', '⏱ 0412.6 h   ⚠ ✓'], { w: 512, h: 160, bg: '#0d1216', fg: '#5fd38d', size: 30 }), side: THREE.DoubleSide }); var cl = plane(0.3, 0.1, clMat, 0, 0, 0.001, 0, 0, clg); cl.userData.noBake = true;
    cyl(0.018, 0.02, MAT.chrome, -0.2, 1.24, 0.29, f, 10).rotation.x = -1.2; box(0.012, 0.03, 0.004, MAT.black, -0.2, 1.255, 0.285, f); cyl(0.022, 0.012, MAT.red, 0.2, 1.24, 0.29, f, 12).rotation.x = -1.2; box(0.03, 0.02, 0.01, FD, -0.12, 1.22, 0.3, f); box(0.03, 0.02, 0.01, MAT.green, -0.12, 1.2, 0.3, f);
    sign(['HORN'], 0.06, 0.016, 0.2, 1.21, 0.31, 0, { w: 128, h: 32, bg: '#1b232c', fg: '#eef1f5' }, f);
    // the floor: pedals and the parking brake
    box(0.12, 0.012, 0.08, MAT.rubber, 0.12, 0.78, 0.3, f).rotation.x = -0.35; box(0.12, 0.012, 0.08, MAT.rubber, -0.08, 0.78, 0.3, f).rotation.x = -0.35; var pb = cyl(0.01, 0.22, FD, -0.3, 0.88, 0.1, f, 6); pb.rotation.x = -0.5; box(0.05, 0.03, 0.06, MAT.red, -0.3, 0.98, 0.15, f);
    var guardPts = [[-0.52, 0.9, 0.5], [-0.52, 2.2, 0.5], [-0.52, 2.4, 0.3], [-0.52, 2.4, -0.85], [-0.52, 2.2, -1.05], [-0.52, 0.9, -1.05]];
    [-1, 1].forEach(function (s) { var pts = guardPts.map(function (p) { return new THREE.Vector3(p[0] * s, p[1], p[2]); }); var tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 40, 0.035, 8, false), FD); tube.castShadow = true; f.add(tube); });
    // the guard roof: four round cross tubes and two runners, a round base for the beacon
    [-0.95, -0.5, -0.05, 0.4].forEach(function (cb) { cyl(0.032, 1.06, FD, 0, 2.4, cb, f, 10).rotation.z = Math.PI / 2; }); [-0.3, 0.3].forEach(function (rx) { cyl(0.02, 1.4, FD, rx, 2.42, -0.27, f, 8).rotation.x = Math.PI / 2; }); cyl(0.09, 0.03, FD, 0, 2.44, -0.3, f, 14);
    cyl(0.07, 0.14, glowMat(0xffa000, 0.6), 0, 2.53, -0.3, f, 12); var beaconLens = box(0.03, 0.12, 0.14, glowMat(0xffd060, 2.5), 0.06, 2.53, -0.3, f);
    var iShape = new THREE.Shape(); iShape.moveTo(-0.05, -0.08); iShape.lineTo(0.05, -0.08); iShape.lineTo(0.05, -0.05); iShape.lineTo(0.015, -0.05); iShape.lineTo(0.015, 0.05); iShape.lineTo(0.05, 0.05); iShape.lineTo(0.05, 0.08); iShape.lineTo(-0.05, 0.08); iShape.lineTo(-0.05, 0.05); iShape.lineTo(-0.015, 0.05); iShape.lineTo(-0.015, -0.05); iShape.lineTo(-0.05, -0.05); iShape.closePath();
    var iGeo = new THREE.ExtrudeGeometry(iShape, { depth: 2.7, bevelEnabled: false }); iGeo.rotateX(-Math.PI / 2);
    [-0.5, 0.5].forEach(function (x) { var ch = new THREE.Mesh(iGeo, FS); ch.position.set(x, 0.1, 0.62); ch.castShadow = true; f.add(ch); box(0.08, 2.45, 0.1, MAT.chrome, x * 0.84, 1.5, 0.63, f); });
    box(1.1, 0.08, 0.16, FS, 0, 2.78, 0.62, f); box(1.1, 0.08, 0.16, FS, 0, 0.14, 0.62, f); cyl(0.05, 2.3, MAT.chrome, 0, 1.3, 0.56, f, 10);
    var chainTex = tex(16, 64, function (c, w, h) { c.fillStyle = '#2a2a2a'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a8a8a'; for (var y = 0; y < h; y += 8) c.fillRect(3, y + 1, 10, 5); }, 1, 20); var chainMat = std({ map: chainTex, roughness: 0.5, metalness: 0.7 });
    [-0.2, 0.2].forEach(function (x) { var cm = box(0.04, 2.4, 0.015, chainMat, x, 1.45, 0.7, f); cm.userData.noBake = true; });
    var hosePts = [new THREE.Vector3(0.3, 0.9, 0.4), new THREE.Vector3(0.5, 1.4, 0.5), new THREE.Vector3(0.52, 2.0, 0.62), new THREE.Vector3(0.35, 2.3, 0.7)]; var hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 20, 0.018, 6, false), MAT.rubber); f.add(hose); var hose2 = hose.clone(); hose2.scale.x = -1; f.add(hose2);
    var car = new THREE.Group(); f.add(car);
    rb(0.95, 0.5, 0.06, 0.02, FS, 0, 0.3, 0.72, car); for (var lb = -0.4; lb <= 0.4; lb += 0.2) cyl(0.015, 0.9, FS, lb, 0.95, 0.72, car, 6); box(0.95, 0.03, 0.03, FS, 0, 1.4, 0.72, car); box(0.95, 0.03, 0.03, FS, 0, 1.0, 0.72, car); box(0.95, 0.04, 0.04, MAT.hazard, 0, 1.42, 0.72, car);
    [-0.3, 0.3].forEach(function (x) { rb(0.12, 0.05, 1.15, 0.01, FS, x, 0.03, 1.33, car); rb(0.12, 0.42, 0.05, 0.01, FS, x, 0.26, 0.77, car); var ft = box(0.12, 0.05, 0.1, FS, x, 0.02, 1.92, car); ft.rotation.x = 0.3; });
    tyre(0.34, 0.26, -0.58, 0.34, 0.45); tyre(0.34, 0.26, 0.58, 0.34, 0.45); tyre(0.27, 0.2, -0.47, 0.27, -1.0); tyre(0.27, 0.2, 0.47, 0.27, -1.0);
    rb(0.5, 0.24, 0.1, 0.03, FD, -0.56, 0.72, 0.45); rb(0.5, 0.24, 0.1, 0.03, FD, 0.56, 0.72, 0.45); rb(0.4, 0.2, 0.1, 0.03, FD, -0.5, 0.6, -1.0); rb(0.4, 0.2, 0.1, 0.03, FD, 0.5, 0.6, -1.0);
    box(0.14, 0.1, 0.06, MAT.lamp, -0.45, 1.0, 0.72, f); box(0.14, 0.1, 0.06, MAT.lamp, 0.45, 1.0, 0.72, f); box(0.12, 0.08, 0.05, glowMat(0xff2a1a, 0.8), -0.4, 0.75, -1.5, f); box(0.12, 0.08, 0.05, glowMat(0xff2a1a, 0.8), 0.4, 0.75, -1.5, f);
    sign(['DC-01'], 0.3, 0.09, 0, 0.55, -1.51, Math.PI, { w: 256, h: 80, bg: '#f5f1e6', fg: '#1b232c' }, f); sign(['DEPOT CO.'], 0.6, 0.14, 0, 0.9, -1.51, Math.PI, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' }, f);
    sign(['2.5 t', 'max 3.3 m'], 0.3, 0.16, -0.57, 0.5, -0.4, -Math.PI / 2, { w: 256, h: 128, bg: '#1b232c', fg: '#f5b53d', size: 40 }, f); sign(['ELECTRIC'], 0.4, 0.08, 0.57, 0.5, -0.5, Math.PI / 2, { w: 256, h: 64, bg: '#f2b705', fg: '#1a1205' }, f);
    cyl(0.04, 0.3, MAT.red, 0.5, 1.4, -1.15, f, 10); box(0.03, 0.12, 0.1, MAT.chrome, -0.6, 1.9, 0.1, f); cyl(0.01, 0.3, FS, -0.6, 1.95, 0.05, f, 4).rotation.z = 0.3;
    groundBlob(2.0, 2.9, 0, -0.2, f, 0);
    hitBox(1.1, 1.4, 1.4, 0, 1.2, -0.3, { prompt: function () { if (!S.up.fork) return null; if (player.tool === 'cable') return 'Plug the forklift in'; if (S.fork.plugged) return 'Forklift on charge · unplug at the charger · E drives off anyway'; return S.hand || player.tool ? 'Hands full' : 'Drive the forklift'; }, use: function () { if (player.tool === 'cable') { cablePlugInto('fork'); return; } startDrive(); } }, f);
    forkM = { g: f, car: car, beacon: beaconLens, wheel: wheel };
    placeTools();
  }
  // the cart's load: boxes on it plus parcels on it, against one capacity
  function cartParcels() { if (!S.cart.parcels) S.cart.parcels = []; return S.cart.parcels; }
  function cartLoad() { return S.cart.boxes.length + cartParcels().length; }
  function cartLoadText() { var b = S.cart.boxes.length, p = cartParcels().length; return (b ? b + (b === 1 ? ' box' : ' boxes') : '') + (b && p ? ', ' : '') + (p ? p + (p === 1 ? ' parcel' : ' parcels') : '') || 'empty'; }
  // G at the parked cart: what you hold goes on it, empty hands take the top box (or parcel) off it
  function cartHandSwap() { if (player.tool || driving) return; if (S.hand) { if (S.hand.kind === 'parcel') { if (cartLoad() >= ECON.cartCap) { toast('The cart is full.', 'bad'); sfx('bad'); return; } cartParcels().push(S.hand.order); handSet(null); sfx('putdown'); hudDirty = true; return; } if (S.hand.kind !== 'box' || S.hand.damaged) { toast('Only good boxes ride the cart.', 'bad'); return; } if (cartLoad() >= ECON.cartCap) { toast('The cart is full.', 'bad'); sfx('bad'); return; } S.cart.boxes.push(S.hand.sku); handSet(null); sfx('putdown'); hudDirty = true; return; } if (S.cart.boxes.length) { handSet({ kind: 'box', sku: S.cart.boxes.pop() }); sfx('pickup'); hudDirty = true; return; } if (cartParcels().length) { handSet({ kind: 'parcel', order: cartParcels().pop() }); sfx('pickup'); hudDirty = true; return; } sfx('click'); }
  function toolPrompt(tool) { if (tool === 'cart' && !S.up.cart) return null; if (player.tool) return null; if (S.hand) return tool === 'cart' && ((S.hand.kind === 'box' && !S.hand.damaged) || S.hand.kind === 'parcel') ? (cartLoad() < ECON.cartCap ? 'G puts the ' + (S.hand.kind === 'parcel' ? 'parcel' : 'box') + ' on the cart (' + cartLoadText() + ')' : 'The cart is full') : 'Hands full'; if (driving) return null; return isJack(tool) ? 'Grab pallet jack ' + (tool === 'jack2' ? '2 (OUT)' : '1 (IN)') : 'Grab the picking cart' + (cartLoad() ? ' (' + cartLoadText() + ') · G takes one off' : ''); }
  function grabTool(tool) { if (player.tool || S.hand || driving) return; if (tool === 'cart' && !S.up.cart) return; player.tool = tool; sfx('pickup'); hudDirty = true; introStep(tool); }
  function releaseTool() { if (!player.tool) return; if (player.tool === 'cable') { player.tool = null; sfx('putdown'); toast('Cable hung back', ''); hudDirty = true; return; } var w = toolWorld(player.tool), tm = isJack(player.tool) ? jackMeshes[player.tool] : cartMesh; if (tm && tm.userData.towRy !== undefined) { w.ry = tm.userData.towRy; w.x = tm.position.x; w.z = tm.position.z; } var t = S[player.tool]; t.x = w.x; t.z = w.z; t.rot = w.ry; player.tool = null; sfx('putdown'); hudDirty = true; }
  function placeTools(dt) {
    var ease = 1 - Math.exp(-(dt || 1 / 60) * 6);
    // a towed tool trails the player: its heading eases toward the player's, so a look round does not whip it about
    var towed = function (tool, mesh) { var w = toolWorld(tool); if (player.tool === tool) { var cur = mesh.userData.towRy === undefined ? w.ry : mesh.userData.towRy, d = Math.atan2(Math.sin(w.ry - cur), Math.cos(w.ry - cur)); cur += d * ease; mesh.userData.towRy = cur; w.ry = cur; w.x = player.x + Math.sin(cur) * 1.15; w.z = player.z + Math.cos(cur) * 1.15; } else mesh.userData.towRy = undefined; mesh.position.set(w.x, floorY(w.x, w.z), w.z); mesh.rotation.y = w.ry; };
    towed('jack', jackMesh); towed('jack2', jackMeshes.jack2); towed('cart', cartMesh); cartMesh.visible = !!S.up.cart;
    forkM.g.position.set(S.fork.x, floorY(S.fork.x, S.fork.z), S.fork.z); forkM.g.rotation.y = S.fork.yaw; forkM.car.position.y = S.fork.lift; forkM.g.visible = !!S.up.fork; if (forkM.beacon) { forkM.beacon.visible = driving || !!staffDriving(); forkM.beacon.rotation.y = worldTime * 6; } if (forkM.wheel) { var k2 = player.keys, steer2 = driving ? ((k2.KeyA ? 1 : 0) - (k2.KeyD ? 1 : 0)) : 0; forkM.wheel.rotation.y = lerp(forkM.wheel.rotation.y, steer2 * 1.4, ease * 2); }
  }

  // ── The forklift ──────────────────────────────────────────────────
  function forkTip() { return { x: S.fork.x + Math.sin(S.fork.yaw) * 1.5, y: S.fork.lift, z: S.fork.z + Math.cos(S.fork.yaw) * 1.5 }; }
  function startDrive() {
    if (!S.up.fork || S.hand || player.tool || driving) return;
    var drv = staffDriving(); if (drv) { toast(drv.name + ' is on the forklift. They park it when the job is done.', 'bad'); sfx('bad'); return; }
    if (S.fork.plugged) cableUnplugFork('You drove off with the charger plugged in. The plug came out.');
    driving = true; forkSpeed = 0; forkLook.yaw = 0; forkLook.pitch = -0.14; sfx('forklift'); introStep('fork'); hudDirty = true;
    $('h-drive').hidden = false;
  }
  function stopDrive() {
    if (!driving) return;
    driving = false; forkSpeed = 0; $('h-drive').hidden = true; hudDirty = true;
    // step off on the left side; if that is blocked, the right side; if both, behind
    var c = Math.cos(S.fork.yaw), s = Math.sin(S.fork.yaw);
    var spots = [[-c * 1.4, s * 1.4], [c * 1.4, -s * 1.4], [-s * 2.2, -c * 2.2]];
    for (var i = 0; i < spots.length; i++) { var x = S.fork.x + spots[i][0], z = S.fork.z + spots[i][1]; if (!collides(x, z, true) && floorY(x, z) > -0.5) { player.x = x; player.z = z; player.y = floorY(x, z); player.yaw = S.fork.yaw + Math.PI; return; } }
    player.x = S.fork.x; player.z = S.fork.z;
  }
  // an obstacle the truck is already inside (it has to nose up to the wrapper, the racks and the docks) cannot block it, so it can always back out
  function forkCollides(x, z) {
    var r = 1.0, cx = S.fork.x, cz = S.fork.z;
    if (floorY(x, z) < -0.5) return true;
    var all = solids.concat(dyn);
    for (var i = 0; i < all.length; i++) { var s = all[i]; if (s.fork) continue; if (s.y0 > 2.5) continue; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) { var already = cx > s.x0 - r && cx < s.x1 + r && cz > s.z0 - r && cz < s.z1 + r; if (!already) return true; var dxn = Math.max(s.x0 - x, 0, x - s.x1), dzn = Math.max(s.z0 - z, 0, z - s.z1), dxc = Math.max(s.x0 - cx, 0, cx - s.x1), dzc = Math.max(s.z0 - cz, 0, cz - s.z1); if (dxn + dzn < dxc + dzc - 0.001) return true; } }
    return false;
  }
  var FORK_GEARS = [0.6, 1.0, 1.5];   // top-speed multipliers: creep, normal, fast
  function forkGearCycle() { var F = S.fork; F.gear = ((F.gear || 1) % 3) + 1; sfx('click'); toast('Gear ' + F.gear + (F.gear === 3 ? ': fast. Mind unwrapped loads on the corners.' : F.gear === 1 ? ': creep' : ''), ''); hudDirty = true; }
  function updateFork(dt) {
    var k = player.keys, F = S.fork;
    var throttle = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), batt = F.batt === undefined ? 1 : F.batt, cap = batt <= 0 ? 0.15 : batt < 0.15 ? 0.5 : 1;
    var gear = F.gear || 1, gm = FORK_GEARS[gear - 1];
    if (throttle) forkSpeed = clamp(forkSpeed + throttle * 3.2 * gm * dt, -2.6 * cap, 4.2 * gm * cap); else forkSpeed *= Math.max(0, 1 - 3 * dt);
    if (throttle && batt <= 0 && !forkLook.flatSaid) { forkLook.flatSaid = true; toast('Flat battery: crawl mode. Park it in its bay by the charger.', 'bad'); }
    // an unwrapped load sheds a box on a fast corner
    var p0 = forkPallet();
    if (p0 && !p0.wrapped && p0.n > 0 && (k.KeyA || k.KeyD) && Math.abs(forkSpeed) > 3.2 && Math.random() < dt * 0.9) { p0.n--; var tip0 = forkTip(); S.floor.push({ kind: 'box', sku: p0.sku, x: tip0.x + randf(-0.8, 0.8), y: floorY(tip0.x, tip0.z), z: tip0.z + randf(-0.8, 0.8), rot: Math.random() * 6, damaged: Math.random() < 0.5 }); sfx('crate'); burst(tip0.x, tip0.y + 0.5, tip0.z, 0xc69c6d, 10, 'out'); toast('A box fell off the load. Wrap pallets before you move them.', 'bad'); if (p0.n <= 0) { removePallet(p0.id); F.pallet = null; } }
    if (forkSpeed < -0.3 && Math.floor(worldTime * 2) !== forkLook.beepT) { forkLook.beepT = Math.floor(worldTime * 2); sfx('beepback'); }
    if (k.Space) forkSpeed *= Math.max(0, 1 - 8 * dt);
    if (Math.abs(forkSpeed) < 0.02) forkSpeed = 0;
    var steer = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
    if (steer && forkSpeed) F.yaw += steer * 1.5 * dt * clamp(forkSpeed / 1.5, -1, 1);
    var nx = F.x + Math.sin(F.yaw) * forkSpeed * dt, nz = F.z + Math.cos(F.yaw) * forkSpeed * dt;
    if (!forkCollides(nx, nz)) { F.x = nx; F.z = nz; } else forkSpeed = 0;
    var lift = (k.KeyR ? 1 : 0) - (k.KeyF ? 1 : 0);
    if (lift) { F.lift = clamp(F.lift + lift * 1.1 * dt, 0.1, 3.7); if (!forkLook.hyd) { forkLook.hyd = true; sfx('hydraulic'); } } else forkLook.hyd = false;
    if (forkSpeed && Math.random() < dt * 1.5) sfx('forklift');
    var p = forkPallet();
    $('h-drive').innerHTML = '<b>W/S</b> drive · <b>A/D</b> steer · <b>R/F</b> forks at ' + F.lift.toFixed(1) + ' m · <b>E</b> ' + (p ? 'set the pallet down' : 'lift a pallet') + ' · <b>G</b> get off · battery <b>' + Math.round((F.batt === undefined ? 1 : F.batt) * 100) + '%</b> · <b>Shift</b> gear <b>' + (F.gear || 1) + '</b>' + (p && !p.wrapped ? ' · <span style="color:var(--amber)">unwrapped load</span>' : '');
  }
  function forkUse() {
    var tip = forkTip(), F = S.fork, p = forkPallet();
    if (p) {
      var key = slotNear(tip.x, tip.z, F.lift);
      if (key) { if (storePallet(p, key)) { F.pallet = null; sfx('crate'); addXp(XP.pallet); toast('Pallet stored · ' + slotName(key), 'good'); introStep('putaway'); } else toast('No room in ' + slotName(key) + '.', 'bad'); return; }
      if (liftTakesFork(tip.x, tip.z, p)) return;
      if (F.lift < 0.5) { if (floorY(tip.x, tip.z) < -0.5) { toast('Not over the edge.', 'bad'); return; } p.place = 'floor'; p.x = tip.x; p.z = tip.z; p.y = floorY(tip.x, tip.z); p.rot = F.yaw; F.pallet = null; sfx('crate'); return; }
      toast('Lower the forks, or line them up with a rack slot.', 'bad'); return;
    }
    // lift a pallet off the floor or out of a truck
    var best = null, bd = 1.3;
    S.pallets.forEach(function (q) { if (q.place !== 'floor' && q.place !== 'truck') return; var w = palletWorld(q); if (!w) return; if (q.place === 'truck') { var t = truckById(q.truck); if (!t || t.state !== 'docked' || !t.signed) return; } var d = Math.sqrt(dist2(w.x, w.z, tip.x, tip.z)); if (d < bd && Math.abs(w.y - F.lift) < 0.5) { bd = d; best = q; } });
    if (best) { if (best.place === 'truck') onPalletLeftTruck(best); best.place = 'fork'; F.pallet = best.id; sfx('hydraulic'); introStep('unload'); return; }
    var key2 = slotNear(tip.x, tip.z, F.lift);
    if (key2 && S.slots[key2] && S.slots[key2].n) { var np = pullPallet(key2); if (np) { np.place = 'fork'; F.pallet = np.id; sfx('hydraulic'); } return; }
    if (key2 && S.slots[key2] && S.slots[key2].pal) { var s2 = S.slots[key2]; delete S.slots[key2]; var ep = newPallet(s2.sku, 0, { place: 'fork' }); F.pallet = ep.id; sfx('hydraulic'); return; }
    toast('Nothing on the forks. Line them up with a pallet at this height.', 'bad');
  }
  function slotNear(x, z, lift) {
    var best = null, bd = 1.2;
    var rows = groundRows(); for (var ri = 0; ri < rows.length; ri++) for (var b = 0; b < rowBays(rows[ri]); b++) for (var l = 0; l < RACK.levels.length; l++) {
      var r = rows[ri], sp = rackSlotPos(r, b, l); if (Math.abs(sp.y - lift) > 0.5) continue;
      var d = Math.sqrt(dist2(sp.x, sp.z, x, z)); if (d < bd) { bd = d; best = slotKey(r, b, l); }
    }
    return best;
  }
  // ── The human model ───────────────────────────────────────────────
  // A rigged person: hip and knee pivots, shoulder and elbow pivots, a torso that rolls with the stride and a head that turns to
  // look at you. Every limb is an eased cylinder, the shoes have soles and laces, the shirt has a collar, buttons, a pocket and a
  // belt, the hair is a cap with a fringe, sideburns and a nape (or long, or a bun), and the face is a 256 px decal that blinks.
  // Built at Grow Co.'s proportions and scaled to 1.8 m, so the hit boxes, speech bubbles and the camera that were set for the
  // old figure still fit. The API is the old one: makeHuman(opt), animateHuman(g, dt, mode, speed, look, carry), setMood, say.
  var SKINS = [0xf1d2b6, 0xe2b48f, 0xd9a98a, 0xb87b5a, 0x8d5a3c, 0x5c3a28];
  var HAIRS = [0x1d1510, 0x3a2a1c, 0x6b4a2b, 0xa8793f, 0xd9b36a, 0x8a8a8a, 0xb0352a, 0x2b2b35];
  var SHIRTS = [0x8c949c, 0x3b4b6b, 0x7b3f3f, 0x2f6f4f, 0xd9d9d9, 0x5a4b7b, 0x8a6a3a, 0x335b7b, 0x2a2d33];
  var PANTS = [0x2e3f63, 0x3a3a3a, 0x5b4b3a, 0x1f2a44, 0x6b6b6b];
  var EYES = ['#3a5a8a', '#4a3221', '#2a6a3a', '#5a4a2a', '#6a7a8a'];
  var faceCache = {};
  // what a face key decides, the same every time that key is drawn: eye colour, brow weight, freckles
  function faceSpec(key) { var n = 0; for (var i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0; return { eye: EYES[n % EYES.length], freckles: n % 5 === 0, brow: n % 3 === 0 ? '#1a1008' : '#2a1a10', thin: n % 4 === 1 }; }
  function faceTex(key, mood, skin, blink) {
    var k = key + mood + (blink ? 'b' : ''); if (faceCache[k]) return faceCache[k];
    var sp = faceSpec(key);
    var t = tex(256, 256, function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      var eyeY = 112, iris = sp.eye, closed = blink || mood === 'tired', squint = mood === 'happy' ? 12 : mood === 'angry' ? 12.5 : 15;
      [84, 172].forEach(function (x, i) {
        var sd = i ? 1 : -1, px = x + (mood === 'shifty' ? 8 : 0);
        if (closed) { ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 21, eyeY + 1); ctx.quadraticCurveTo(x, eyeY + 9, x + 21, eyeY + 1); ctx.stroke(); return; }
        ctx.save(); ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#fbf8f2'; ctx.fillRect(x - 24, eyeY - 18, 48, 36);
        var ig = ctx.createRadialGradient(px, eyeY + 1, 2, px, eyeY + 1, 11); ig.addColorStop(0, iris); ig.addColorStop(0.75, iris); ig.addColorStop(1, 'rgba(10,15,25,.9)'); ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(px, eyeY + 1, 10.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(px, eyeY + 1, 4.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(px + 4, eyeY - 4, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(px - 4, eyeY + 5, 1.6, 0, Math.PI * 2); ctx.fill();
        var lid = ctx.createLinearGradient(0, eyeY - squint, 0, eyeY - squint + 12); lid.addColorStop(0, 'rgba(40,20,10,.5)'); lid.addColorStop(1, 'rgba(40,20,10,0)'); ctx.fillStyle = lid; ctx.fillRect(x - 24, eyeY - squint, 48, 12);   /* the lid's shadow on the eye */
        ctx.restore();
        ctx.strokeStyle = '#2f2019'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(60,35,25,.45)'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#2f2019'; ctx.beginPath(); ctx.moveTo(x + sd * 21, eyeY - 3); ctx.lineTo(x + sd * 27, eyeY - 8); ctx.stroke();   /* one lash at the outer corner */
      });
      // brows: thick at the nose, fine at the temple; they tilt with the mood
      ctx.fillStyle = sp.brow; var tilt = mood === 'angry' ? 12 : mood === 'tired' ? -6 : mood === 'happy' ? -3 : 0, bt = sp.thin ? 0.6 : 1;
      [[58, 110], [198, 146]].forEach(function (b) { ctx.beginPath(); ctx.moveTo(b[0], 84 - tilt + 2); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 72, b[1], 84 + tilt - 4 * bt); ctx.lineTo(b[1], 84 + tilt + 5 * bt); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 80, b[0], 84 - tilt + 4); ctx.closePath(); ctx.fill(); });
      // the nose is modelled: only the shadow under its tip is drawn
      ctx.fillStyle = 'rgba(70,35,20,.22)'; ctx.beginPath(); ctx.ellipse(128, 166, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a4536'; ctx.lineCap = 'round'; ctx.lineWidth = 4.5; ctx.beginPath();
      if (mood === 'happy') { ctx.fillStyle = '#4a1a1a'; ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.quadraticCurveTo(128, 194, 96, 186); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(102, 188.5); ctx.quadraticCurveTo(128, 196, 154, 188.5); ctx.quadraticCurveTo(128, 203, 102, 188.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.stroke(); }
      else if (mood === 'tired') { ctx.moveTo(100, 198); ctx.quadraticCurveTo(128, 186, 156, 198); ctx.stroke(); }
      else if (mood === 'angry') { ctx.moveTo(100, 196); ctx.quadraticCurveTo(128, 186, 156, 192); ctx.stroke(); }
      else if (mood === 'talk') { ctx.fillStyle = '#3a1a1a'; ctx.beginPath(); ctx.ellipse(128, 194, 16, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c0605a'; ctx.beginPath(); ctx.ellipse(128, 200, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.moveTo(104, 192); ctx.quadraticCurveTo(128, 199, 152, 192); ctx.stroke(); }
      if (mood !== 'talk' && mood !== 'happy') { ctx.strokeStyle = 'rgba(90,40,30,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(114, 205); ctx.quadraticCurveTo(128, 210, 142, 205); ctx.stroke(); }   /* the shade under the lower lip */
      ctx.fillStyle = 'rgba(255,110,110,' + (mood === 'happy' ? 0.26 : 0.12) + ')'; [62, 194].forEach(function (x) { var bl = ctx.createRadialGradient(x, 152, 2, x, 152, 22); bl.addColorStop(0, ctx.fillStyle); bl.addColorStop(1, 'rgba(255,110,110,0)'); ctx.save(); ctx.fillStyle = bl; ctx.beginPath(); ctx.arc(x, 152, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
      if (sp.freckles) { ctx.fillStyle = 'rgba(120,70,40,.5)'; for (var f = 0; f < 22; f++) { ctx.beginPath(); ctx.arc(60 + Math.random() * 136, 136 + Math.random() * 30, 1.6, 0, Math.PI * 2); ctx.fill(); } }
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; faceCache[k] = t; return t;
  }
  var HUMAN_GEO = {
    thigh: roundCylGeo(0.088, 0.068, 0.42, 18), shin: roundCylGeo(0.064, 0.046, 0.4, 18), knee: new THREE.SphereGeometry(0.068, 14, 10),
    shoe: bevelGeo(0.12, 0.085, 0.27, 0.036, 3), sole: bevelGeo(0.128, 0.03, 0.285, 0.012, 1), lace: bevelGeo(0.1, 0.02, 0.06, 0.006, 1),
    hips: bevelGeo(0.36, 0.18, 0.22, 0.08, 3), torso: taperGeo(bevelGeo(0.4, 0.5, 0.24, 0.1, 3).clone(), 0.5, 0.86, 0.9), chest: bevelGeo(0.44, 0.26, 0.26, 0.11, 3),
    belt: bevelGeo(0.38, 0.05, 0.24, 0.012, 1), buckle: bevelGeo(0.05, 0.04, 0.02, 0.005, 1), placket: bevelGeo(0.12, 0.05, 0.03, 0.008, 1), button: roundCylGeo(0.008, 0.008, 0.006, 8), pocket: bevelGeo(0.1, 0.1, 0.005, 0.002, 1),
    upperArm: roundCylGeo(0.054, 0.044, 0.3, 14), foreArm: roundCylGeo(0.044, 0.034, 0.3, 14), elbow: new THREE.SphereGeometry(0.047, 12, 10), shoulder: new THREE.SphereGeometry(0.072, 14, 10),
    hand: bevelGeo(0.075, 0.1, 0.036, 0.016, 2), thumb: roundCylGeo(0.012, 0.012, 0.05, 8), cuff: roundCylGeo(0.043, 0.04, 0.035, 14), hem: roundCylGeo(0.058, 0.056, 0.04, 16), collar: bevelGeo(0.085, 0.036, 0.012, 0.004, 1),
    neck: roundCylGeo(0.05, 0.062, 0.1, 14), head: new THREE.SphereGeometry(0.17, 28, 20), ear: new THREE.SphereGeometry(0.03, 10, 8), nose: new THREE.SphereGeometry(0.021, 12, 10),
    hairCap: new THREE.SphereGeometry(0.17, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hairLong: new THREE.SphereGeometry(0.17, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    vest: bevelGeo(0.47, 0.5, 0.29, 0.06, 3), band: bevelGeo(0.48, 0.04, 0.3, 0.012, 1), strap: bevelGeo(0.05, 0.28, 0.3, 0.012, 1),
    peak: bevelGeo(0.2, 0.015, 0.14, 0.005, 1)
  };
  // a beard follows the jaw and the chin and leaves the mouth alone; long hair falls behind the shoulders as one sheet
  HUMAN_GEO.beard = new THREE.SphereGeometry(0.17, 20, 8, -Math.PI * 0.1, Math.PI * 1.2, Math.PI * 0.7, Math.PI * 0.3); HUMAN_GEO.beard.scale(1.035, 1.15, 0.985);
  HUMAN_GEO.hairFall = new THREE.CylinderGeometry(0.178, 0.205, 0.4, 22, 3, true, Math.PI * 0.42, Math.PI * 1.16);
  HUMAN_GEO.ear.scale(0.5, 1.15, 0.85); HUMAN_GEO.nose.scale(0.82, 1.3, 1.05); HUMAN_GEO.head.scale(1, 1.12, 0.95);
  HUMAN_GEO.hairCap.scale(1.07, 1.2, 1.02); HUMAN_GEO.hairLong.scale(1.08, 1.21, 1.04);
  // curved patches that follow the skull: fringe over the forehead, sideburns, nape
  HUMAN_GEO.fringe = new THREE.SphereGeometry(0.17, 20, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.2); HUMAN_GEO.fringe.scale(1.075, 1.205, 1.03);
  HUMAN_GEO.sideL = new THREE.SphereGeometry(0.17, 12, 8, Math.PI * 1.88, Math.PI * 0.24, Math.PI * 0.4, Math.PI * 0.22); HUMAN_GEO.sideL.scale(1.075, 1.205, 1.03);
  HUMAN_GEO.sideR = new THREE.SphereGeometry(0.17, 12, 8, Math.PI * 0.88, Math.PI * 0.24, Math.PI * 0.4, Math.PI * 0.22); HUMAN_GEO.sideR.scale(1.075, 1.205, 1.03);
  HUMAN_GEO.nape = new THREE.SphereGeometry(0.17, 16, 8, Math.PI * 1.2, Math.PI * 0.6, Math.PI * 0.4, Math.PI * 0.3); HUMAN_GEO.nape.scale(1.075, 1.205, 1.03);
  var HUMAN_SCALE = 0.93, BAND_M = std({ color: 0xc9ced3, roughness: 0.3, metalness: 0.4, emissive: 0x666666, emissiveIntensity: 0.25 }), LACE_M = std({ color: 0xf2f2f2, roughness: 0.9 }), BELT_M = std({ color: 0x3a2a1a, roughness: 0.5 }), SOLE_M = std({ color: 0xd8d4cc, roughness: 0.9 });
  function makeHuman(opt) {
    opt = opt || {};
    var skinCol = opt.skin || pick(SKINS), hairCol = opt.hair || pick(HAIRS), style = opt.style || pick(['short', 'short', 'long', 'bun', 'bald', 'cap']);
    var skin = std({ color: skinCol, roughness: 0.75 }), shirt = opt.shirt || std({ map: TEX.cloth, color: pick(SHIRTS), roughness: 0.92 }), pants = std({ map: TEX.cloth, color: pick(PANTS), roughness: 0.95 }), hair = std({ color: hairCol, roughness: 0.62 }), hairSide = hair.clone(); hairSide.side = THREE.DoubleSide;
    var shoeM = std({ color: pick([0x1e1a18, 0x3a2a1a, 0x4a3a2a, 0x2f2f33]), roughness: 0.6 }), shirtDark = shirt.clone(); if (shirtDark.color) shirtDark.color.multiplyScalar(0.85);
    var rolled = opt.rolled !== undefined ? !!opt.rolled : Math.random() < 0.4;
    var g = new THREE.Group(), u = g.userData; u.dynamic = true;
    u.key = 'f' + Math.floor(Math.random() * 100000); u.mood = opt.mood || 'neutral'; u.blink = 0; u.blinkIn = randf(2, 6); u.walk = 0; u.idleT = Math.random() * 10; u.lookYaw = 0; u.lookPitch = 0; u.skinKey = skinCol.toString(16); u.phase = Math.random() * 6.28;
    g.scale.setScalar(HUMAN_SCALE);
    function mesh(geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; }
    // legs: hip pivot, thigh, knee pivot, shin, shoe on its sole
    function leg(side) {
      var hip = new THREE.Group(); hip.position.set(side * 0.1, 0.86, 0); g.add(hip);
      mesh(HUMAN_GEO.thigh, pants, 0, -0.21, 0, hip);
      var knee = new THREE.Group(); knee.position.set(0, -0.42, 0); hip.add(knee); hip.userData.knee = knee;
      mesh(HUMAN_GEO.knee, pants, 0, 0, 0, knee); mesh(HUMAN_GEO.shin, pants, 0, -0.2, 0, knee);
      mesh(HUMAN_GEO.shoe, shoeM, 0, -0.4, 0.05, knee); mesh(HUMAN_GEO.sole, SOLE_M, 0, -0.445, 0.05, knee); mesh(HUMAN_GEO.hem, pants, 0, -0.35, 0, knee); mesh(HUMAN_GEO.lace, LACE_M, 0, -0.36, 0.12, knee);
      return hip;
    }
    u.legs = [leg(-1), leg(1)];
    // torso: hips block, belt and buckle, shirt torso and chest, collar, placket, buttons, a pocket
    var torso = new THREE.Group(); torso.position.y = 0.86; g.add(torso); u.torso = torso;
    mesh(HUMAN_GEO.hips, pants, 0, 0.02, 0, torso); mesh(HUMAN_GEO.belt, BELT_M, 0, 0.1, 0, torso); mesh(HUMAN_GEO.buckle, MAT.chrome, 0, 0.1, 0.125, torso);
    mesh(HUMAN_GEO.torso, shirt, 0, 0.36, 0, torso); u.chest = mesh(HUMAN_GEO.chest, shirt, 0, 0.52, 0, torso);
    [-1, 1].forEach(function (sd) { var cl = mesh(HUMAN_GEO.collar, shirt, sd * 0.05, 0.648, 0.118, torso); cl.rotation.set(-0.35, sd * -0.25, sd * -0.62); });
    mesh(HUMAN_GEO.placket, shirt, 0, 0.62, 0.13, torso); for (var b = 0; b < 4; b++) mesh(HUMAN_GEO.button, LACE_M, 0, 0.2 + b * 0.11, 0.125, torso).rotation.x = Math.PI / 2; mesh(HUMAN_GEO.pocket, shirtDark, -0.11, 0.48, 0.125, torso);
    // the hi-vis vest over the shirt: two reflective bands round it and one over each shoulder
    if (opt.vest) { mesh(HUMAN_GEO.vest, opt.vest, 0, 0.33, 0, torso); mesh(HUMAN_GEO.band, BAND_M, 0, 0.22, 0, torso); mesh(HUMAN_GEO.band, BAND_M, 0, 0.38, 0, torso); mesh(HUMAN_GEO.strap, BAND_M, -0.15, 0.5, 0, torso); mesh(HUMAN_GEO.strap, BAND_M, 0.15, 0.5, 0, torso); }
    if (opt.name) { var tag = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), new THREE.MeshBasicMaterial({ map: textTex([opt.name], { w: 128, h: 48, bg: '#fff', fg: '#1b232c' }) })); tag.position.set(0.1, 0.46, opt.vest ? 0.152 : 0.132); torso.add(tag); }
    // arms: shoulder pivot, upper arm, elbow pivot, forearm, a cuff unless the sleeves are rolled, a hand with its thumb
    function arm(side) {
      var sh = new THREE.Group(); sh.position.set(side * 0.27, 0.6, 0); torso.add(sh);
      mesh(HUMAN_GEO.shoulder, shirt, 0, 0, 0, sh); mesh(HUMAN_GEO.upperArm, shirt, 0, -0.16, 0, sh);
      var el = new THREE.Group(); el.position.set(0, -0.31, 0); sh.add(el); sh.userData.elbow = el;
      mesh(HUMAN_GEO.elbow, shirt, 0, 0, 0, el); mesh(HUMAN_GEO.foreArm, rolled ? skin : shirt, 0, -0.15, 0, el);
      if (!rolled) mesh(HUMAN_GEO.cuff, shirt, 0, -0.285, 0, el); else mesh(HUMAN_GEO.cuff, shirt, 0, -0.03, 0, el);
      mesh(HUMAN_GEO.hand, skin, 0, -0.35, 0, el); var th = mesh(HUMAN_GEO.thumb, skin, side * 0.04, -0.33, 0.01, el); th.rotation.z = side * 0.6;
      return sh;
    }
    u.arms = [arm(-1), arm(1)];
    // head: neck, skull, nose, ears, hair, beard, the face decal, glasses, a cap or a hard hat
    var head = new THREE.Group(); head.position.set(0, 0.66, 0); torso.add(head); u.head = head;
    mesh(HUMAN_GEO.neck, skin, 0, 0.04, 0, head); mesh(HUMAN_GEO.head, skin, 0, 0.24, 0, head); mesh(HUMAN_GEO.nose, skin, 0, 0.222, 0.164, head);
    [-1, 1].forEach(function (s) { mesh(HUMAN_GEO.ear, skin, s * 0.165, 0.24, -0.01, head); });
    var hy = 0.24, capOn = style === 'cap' || !!opt.cap;
    if (style !== 'bald') {
      if (style === 'long') { mesh(HUMAN_GEO.hairLong, hair, 0, hy, 0, head); mesh(HUMAN_GEO.hairFall, hairSide, 0, hy - 0.16, -0.012, head); }
      else { mesh(HUMAN_GEO.hairCap, hair, 0, hy, 0, head); mesh(HUMAN_GEO.nape, hair, 0, hy, 0, head); }
      if (style === 'bun') mesh(new THREE.SphereGeometry(0.075, 12, 10), hair, 0, hy + 0.14, -0.14, head);
      mesh(HUMAN_GEO.fringe, hair, 0, hy, 0, head); mesh(HUMAN_GEO.sideL, hair, 0, hy, 0, head); mesh(HUMAN_GEO.sideR, hair, 0, hy, 0, head);
    }
    if (Math.random() < 0.3 && !opt.noBeard) mesh(HUMAN_GEO.beard, hairSide, 0, hy, 0, head);
    var face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: faceTex(u.key, u.mood, u.skinKey), transparent: true, depthWrite: false })); face.position.set(0, 0.245, 0.17); head.add(face); u.face = face;
    if (Math.random() < 0.22) { var fr = std({ color: 0x222222, roughness: 0.4, metalness: 0.5 }); [-0.06, 0.06].forEach(function (x) { mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 16), fr, x, 0.255, 0.178, head); }); mesh(bevelGeo(0.03, 0.006, 0.006, 0.002, 1), fr, 0, 0.26, 0.178, head); [-1, 1].forEach(function (s) { mesh(bevelGeo(0.006, 0.006, 0.16, 0.002, 1), fr, s * 0.1, 0.255, 0.085, head); }); }
    // hats sit on the brows (the eye line is at 0.26 in the head's frame, the brows at 0.29), never over the eyes
    if (capOn && !opt.hardhat) { var capM = opt.capMat || MAT.blue; mesh(new THREE.SphereGeometry(0.184, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0, 0.29, 0, head); var peak = mesh(HUMAN_GEO.peak, capM, 0, 0.3, 0.2, head); peak.rotation.x = 0.15; mesh(new THREE.SphereGeometry(0.02, 8, 6), capM, 0, 0.47, 0, head); }
    if (opt.hardhat) { mesh(new THREE.SphereGeometry(0.19, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), opt.hardhat, 0, 0.3, 0, head); mesh(roundCylGeo(0.212, 0.212, 0.016, 24), opt.hardhat, 0, 0.3, 0.0, head); var pk = mesh(bevelGeo(0.16, 0.012, 0.08, 0.004, 1), opt.hardhat, 0, 0.3, 0.245, head); pk.rotation.x = 0.12; }
    groundBlob(0.9, 0.9, 0, 0, g, 0.002);
    return g;
  }
  function setMood(g, mood) { var u = g.userData; if (u.mood === mood) return; u.mood = mood; u.face.material.map = faceTex(u.key, mood, u.skinKey, u.blink > 0); }
  // mode: 'walk' | 'idle' | 'wait' | 'work'. look: a world point the head turns to, within reason. carry: true holds a box out in front; 'jack' puts both hands down on the grip of a pallet jack pushed ahead; 'tow' trails one arm back to a jack pulled behind.
  // The feet stay planted: the torso rises and falls with the stride and rolls a little, and the head stays level over it.
  function animateHuman(g, dt, mode, speed, look, carry) {
    var u = g.userData; if (!u.legs) return;
    u.idleT += dt;
    if (mode === 'walk') u.walk += dt * (6 + speed * 1.5); else { var ph = u.walk % Math.PI; u.walk += (ph < Math.PI / 2 ? -ph : Math.PI - ph) * Math.min(1, 10 * dt); }
    var t = u.walk, sw = mode === 'walk' ? 0.55 : 0, s = Math.sin(t), L = u.legs[0], R = u.legs[1], lk = L.userData.knee, rk = R.userData.knee, la = u.arms[0], ra = u.arms[1], le = la.userData.elbow, re = ra.userData.elbow, T = u.torso;
    if (mode === 'sit') {   // on the forklift seat: thighs forward, shins down, hands on the wheel
      L.rotation.x = -1.45; R.rotation.x = -1.45; lk.rotation.x = 1.45; rk.rotation.x = 1.45; R.position.y = 0.86; la.rotation.x = -0.5; ra.rotation.x = -0.5; le.rotation.x = -0.15; re.rotation.x = -0.15; la.rotation.z = 0.18; ra.rotation.z = -0.18; T.position.set(0, 0.86, 0); T.rotation.set(0, 0, 0); u.head.rotation.z = 0;
    } else {
    L.rotation.x = s * sw; R.rotation.x = -s * sw;
    lk.rotation.x = Math.max(0, -Math.sin(t - 0.6)) * 1.0 * (sw ? 1 : 0); rk.rotation.x = Math.max(0, Math.sin(t - 0.6)) * 1.0 * (sw ? 1 : 0);
    if (carry === 'jack') { la.rotation.x = -0.8; ra.rotation.x = -0.8; le.rotation.x = -0.25; re.rotation.x = -0.25; la.rotation.z = 0.12; ra.rotation.z = -0.12; }   /* hands 0.53 m ahead at 1.02 m: the grip of a jack pushed at STAFF_JACK.push */
    else if (carry === 'tow') { ra.rotation.x = 0.56; re.rotation.x = 0; ra.rotation.z = -0.15; la.rotation.x = -s * sw * 0.8; le.rotation.x = -Math.max(0, s) * sw * 0.6 - 0.15; la.rotation.z = 0.08; }   /* one arm straight back to the grip 0.35 m behind at 0.85 m, the other swings */
    else if (carry) { la.rotation.x = -0.9; ra.rotation.x = -0.9; le.rotation.x = -0.9; re.rotation.x = -0.9; la.rotation.z = 0.25; ra.rotation.z = -0.25; }
    else if (mode === 'work') { la.rotation.x = -0.6 + Math.sin(u.idleT * 6) * 0.25; ra.rotation.x = -0.6 - Math.sin(u.idleT * 6) * 0.25; le.rotation.x = -0.8; re.rotation.x = -0.8; la.rotation.z = 0.1; ra.rotation.z = -0.1; }
    else { var drift = Math.sin(u.idleT * 1.1) * 0.05; la.rotation.x = -s * sw * 0.8 + drift; ra.rotation.x = s * sw * 0.8 - drift; le.rotation.x = -Math.max(0, s) * sw * 0.6 - 0.15; re.rotation.x = -Math.max(0, -s) * sw * 0.6 - 0.15; la.rotation.z = 0.08 + Math.sin(u.idleT * 0.7) * 0.03; ra.rotation.z = -0.08 - Math.sin(u.idleT * 0.7) * 0.03; }
    if (mode === 'wait') { R.position.y = 0.86 + Math.max(0, Math.sin(u.idleT * 2.4)) * 0.04; } else R.position.y = 0.86;
    if (mode === 'walk') { T.position.y = 0.86 + Math.abs(Math.cos(t)) * 0.03; T.position.x = 0; T.rotation.z = s * 0.03; T.rotation.y = s * 0.06; u.head.rotation.z = -s * 0.025; }
    else { T.position.y = 0.86 + Math.sin(u.idleT * 0.31) * 0.006; T.position.x = Math.sin(u.idleT * 0.31) * 0.007; T.rotation.z = Math.sin(u.idleT * 0.31) * 0.014; T.rotation.y = mode === 'wait' ? Math.sin(u.idleT * 0.35) * 0.12 : lerp(T.rotation.y, 0, Math.min(1, 4 * dt)); u.head.rotation.z = 0; }   /* the weight goes from one foot to the other */
    }
    if (u.chest) u.chest.scale.z = 1 + Math.sin(worldTime * 1.6 + u.phase) * 0.018;   /* breathing */
    g.position.y = u.baseY || 0;
    // the head: looks at what it is given, else drifts; blinks now and then
    var wantYaw = 0, wantPitch = 0;
    if (look) { var dx = look.x - g.position.x, dz = look.z - g.position.z, d = Math.sqrt(dx * dx + dz * dz); if (d < 9) { var a = Math.atan2(dx, dz) - g.rotation.y; while (a > Math.PI) a -= 6.283; while (a < -Math.PI) a += 6.283; wantYaw = clamp(a, -1.3, 1.3); wantPitch = clamp(Math.atan2((look.y || 1.6) - 1.6, d), -0.3, 0.3); } }
    else wantYaw = Math.sin(u.idleT * 0.4) * 0.15;
    u.lookYaw += (wantYaw - u.lookYaw) * Math.min(1, 6 * dt); u.lookPitch += (wantPitch - u.lookPitch) * Math.min(1, 6 * dt);
    u.head.rotation.y = u.lookYaw - (mode === 'walk' ? T.rotation.y : 0); u.head.rotation.x = -u.lookPitch;
    u.blinkIn -= dt; if (u.blinkIn <= 0 && u.blink <= 0) { u.blink = 0.12; u.face.material.map = faceTex(u.key, u.mood, u.skinKey, true); } if (u.blink > 0) { u.blink -= dt; if (u.blink <= 0) { u.blinkIn = randf(2, 6.5); u.face.material.map = faceTex(u.key, u.mood, u.skinKey, false); } }
    if (u.bubble) { u.bubble.t -= dt; if (u.bubble.t <= 0) { g.remove(u.bubble.sp); u.bubble = null; } }
  }
  // a line of speech above the head, for a few seconds
  function say(g, text, col) {
    var u = g.userData; if (!u || !u.head) return;
    if (u.bubble) { g.remove(u.bubble.sp); u.bubble = null; }
    var t = tex(512, 160, function (c, w, h) {
      c.clearRect(0, 0, w, h); c.font = '500 30px "Segoe UI", Arial, sans-serif'; var words = text.split(' '), lines = [], cur = '';
      words.forEach(function (wd) { var tr = cur ? cur + ' ' + wd : wd; if (c.measureText(tr).width > w - 60) { lines.push(cur); cur = wd; } else cur = tr; }); if (cur) lines.push(cur); lines = lines.slice(0, 3);
      var bw = Math.min(w - 20, Math.max.apply(null, lines.map(function (l) { return c.measureText(l).width; })) + 50), bh = lines.length * 36 + 26, bx = (w - bw) / 2, by = h - bh - 18;
      c.fillStyle = 'rgba(16,22,30,0.92)'; c.strokeStyle = col || '#f5b53d'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx + 14, by); c.lineTo(bx + bw - 14, by); c.quadraticCurveTo(bx + bw, by, bx + bw, by + 14); c.lineTo(bx + bw, by + bh - 14); c.quadraticCurveTo(bx + bw, by + bh, bx + bw - 14, by + bh); c.lineTo(w / 2 + 12, by + bh); c.lineTo(w / 2, h - 2); c.lineTo(w / 2 - 12, by + bh); c.lineTo(bx + 14, by + bh); c.quadraticCurveTo(bx, by + bh, bx, by + bh - 14); c.lineTo(bx, by + 14); c.quadraticCurveTo(bx, by, bx + 14, by); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#eef1f5'; c.textAlign = 'center'; c.textBaseline = 'middle'; lines.forEach(function (l, i) { c.fillText(l, w / 2, by + 20 + i * 36 + 4); });
    });
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(1.9, 0.6, 1); sp.position.set(0, 2.15, 0); sp.renderOrder = 5; g.add(sp);
    u.bubble = { sp: sp, t: 2.6 + text.length * 0.03 };
    setMood(g, 'talk'); setTimeout(function () { if (u.mood === 'talk') setMood(g, 'neutral'); }, 900);
  }

  // ── The route finder ──────────────────────────────────────────────
  // A 0.4 m grid over the hall and the dock aprons. A cell is blocked by any static solid (walls, racks, furniture) or,
  // outside the hall, unless it lies inside a docked trailer. Staff carry keys, so hinged doors never block them.
  // A* finds the path, then string-pulling drops every waypoint that a straight line can skip.
  var NAV = { cell: 0.4, x0: -HALL.x - 14, z0: -HALL.z - 42, w: Math.round((2 * HALL.x + 28) / 0.4), h: Math.round((2 * HALL.z + 44) / 0.4), grid: null, dirty: true };   // north to z -66: the annex halls and the wing
  function navBuild() {
    var g = new Uint8Array(NAV.w * NAV.h), c = NAV.cell, pad = 0.3;
    for (var j = 0; j < NAV.h; j++) for (var i = 0; i < NAV.w; i++) {
      var x = NAV.x0 + (i + 0.5) * c, z = NAV.z0 + (j + 0.5) * c, blocked = 0;
      if (!insideWalk(x, z)) blocked = 2;   // outside the halls you own: open only through a docked trailer
      else for (var k = 0; k < solids.length; k++) { var s = solids[k]; if (s.y0 > 1.6) continue; if (x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad) { blocked = 1; break; } }
      g[j * NAV.w + i] = blocked;
    }
    NAV.grid = g; NAV.dirty = false;
  }
  function navOpen(i, j) {
    if (i < 0 || j < 0 || i >= NAV.w || j >= NAV.h) return false;
    var b = NAV.grid[j * NAV.w + i]; if (b === 0) return true; if (b === 1) return false;
    var x = NAV.x0 + (i + 0.5) * NAV.cell, z = NAV.z0 + (j + 0.5) * NAV.cell;
    if (x <= -HALL.x + 0.6 && x > -HALL.x - 7.6 && Math.abs(z - SPOT.staffDoor.z) < 0.8) return true;
    for (var k = 0; k < S.trucks.length; k++) { var t = S.trucks[k]; if (t.state !== 'docked') continue; var tb = trailerBounds(t); if (x > tb.x0 - 0.3 && x < tb.x1 - 0.6 && z > tb.z0 + 0.3 && z < tb.z1 - 0.3) return true; if (Math.abs(z - t.z) < 1.0 && ((t.side < 0 && x < -HALL.x + 0.5 && x > tb.x0) || (t.side > 0 && x > HALL.x - 0.5 && x < tb.x1))) return true; }
    return false;
  }
  function navCell(p) { return { i: clamp(Math.floor((p.x - NAV.x0) / NAV.cell), 0, NAV.w - 1), j: clamp(Math.floor((p.z - NAV.z0) / NAV.cell), 0, NAV.h - 1) }; }
  function navNearestOpen(cl) { if (navOpen(cl.i, cl.j)) return cl; for (var r = 1; r < 8; r++) for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++) if (Math.abs(di) === r || Math.abs(dj) === r) if (navOpen(cl.i + di, cl.j + dj)) return { i: cl.i + di, j: cl.j + dj }; return cl; }
  function navLine(a, b) { var dx = b.x - a.x, dz = b.z - a.z, n = Math.ceil(Math.sqrt(dx * dx + dz * dz) / (NAV.cell * 0.5)) + 1, prev = null; for (var k = 0; k <= n; k++) { var cl = navCell({ x: a.x + dx * k / n, z: a.z + dz * k / n }); if (!navOpen(cl.i, cl.j)) return false; if (prev && cl.i !== prev.i && cl.j !== prev.j && (!navOpen(cl.i, prev.j) || !navOpen(prev.i, cl.j))) return false; prev = cl; } return true; }   // no corner cutting on the string-pulled runs either
  function route(a, b) {
    if (NAV.dirty || !NAV.grid) navBuild();
    var sc = navNearestOpen(navCell(a)), gc = navNearestOpen(navCell(b));
    if (sc.i === gc.i && sc.j === gc.j) return [b];
    var W = NAV.w, open = [], came = {}, gs = {}, key = function (c) { return c.j * W + c.i; }, h = function (c) { return Math.abs(c.i - gc.i) + Math.abs(c.j - gc.j); };
    var sk = key(sc); gs[sk] = 0; open.push({ c: sc, f: h(sc) }); var closed = {}, found = null, steps = 0;
    while (open.length && steps++ < 20000) {
      var bi = 0; for (var q = 1; q < open.length; q++) if (open[q].f < open[bi].f) bi = q;
      var cur = open.splice(bi, 1)[0], ck = key(cur.c); if (closed[ck]) continue; closed[ck] = 1;
      if (cur.c.i === gc.i && cur.c.j === gc.j) { found = cur.c; break; }
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        if (!di && !dj) continue; var ni = cur.c.i + di, nj = cur.c.j + dj; if (!navOpen(ni, nj)) continue;
        if (di && dj && (!navOpen(cur.c.i + di, cur.c.j) || !navOpen(cur.c.i, cur.c.j + dj))) continue;   // no corner cutting
        var nk = nj * W + ni, ng = gs[ck] + (di && dj ? 1.414 : 1);
        if (gs[nk] !== undefined && gs[nk] <= ng) continue;
        gs[nk] = ng; came[nk] = ck; open.push({ c: { i: ni, j: nj }, f: ng + h({ i: ni, j: nj }) });
      }
    }
    if (!found) return [b];
    var cells = [], k2 = key(found); while (k2 !== undefined && k2 !== sk) { cells.push({ x: NAV.x0 + ((k2 % W) + 0.5) * NAV.cell, z: NAV.z0 + (Math.floor(k2 / W) + 0.5) * NAV.cell }); k2 = came[k2]; }
    cells.reverse(); cells.push(b);
    // string-pulling
    var out = [], from = a, idx = 0;
    while (idx < cells.length) { var far = idx; for (var m = cells.length - 1; m > idx; m--) if (navLine(from, cells[m])) { far = m; break; } out.push(cells[far]); from = cells[far]; idx = far + 1; }
    return out;
  }
  function laneFor(z) { var L = [-9.6, -4, 0, 4, 7.6], best = L[0]; for (var i = 1; i < L.length; i++) if (Math.abs(L[i] - z) < Math.abs(best - z)) best = L[i]; return best; }
  function slotStand(key) { var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l), a = sp.ry || 0, nx = Math.sin(a), nz = Math.cos(a); var A = { x: sp.x + nx * 1.4, z: sp.z + nz * 1.4 }, B = { x: sp.x - nx * 1.4, z: sp.z - nz * 1.4 }; if (NAV.dirty || !NAV.grid) navBuild(); var ca = navCell(A), cb = navCell(B); if (navOpen(ca.i, ca.j)) return A; if (navOpen(cb.i, cb.j)) return B; return A; }

  // ── Staff ─────────────────────────────────────────────────────────
  var staffMeshes = {};
  var VOICE = {
    Jo:   { hi: 'Morning, boss. What have we got?', bye: 'That is me done. See you tomorrow.', onit: 'On it.', full: 'Bench is full, boss.', nospace: 'No rack space for this one.', idle: ['Quiet one today.', 'Did you see the game last night?', 'Coffee machine is on the blink again.', 'That truck driver never stops talking.'], brk: 'Lunch. Back in a bit.' },
    Mika: { hi: 'Right. Clocking in.', bye: 'Home time.', onit: 'Yep.', full: 'Bench. Full.', nospace: 'Nowhere to put it.', idle: ['Hm.', 'Could use a second jack.', 'Rain again.', 'Row C needs sorting.'], brk: 'Break.' },
    Sam:  { hi: 'Alright mate, what is the plan?', bye: 'Cheers, see you tomorrow mate.', onit: 'Leave it with me.', full: 'Bench is rammed, mate.', nospace: 'Racks are chocka, mate.', idle: ['Fancy a brew after this?', 'Those tyres weigh a ton.', 'Reckon it will rain?', 'New lad on the gate is alright.'], brk: 'Sarnie time.' },
    Ravi: { hi: 'Good morning. Ready when you are.', bye: 'Have a good evening.', onit: 'Certainly.', full: 'The bench cannot take any more.', nospace: 'There is no slot for this line.', idle: ['The orders are picking up.', 'I counted row A twice. It is right.', 'Lovely day for it.', 'The inspector is due soon, I think.'], brk: 'I will take my break now.' },
    Lena: { hi: 'Hey. Let us get it moving.', bye: 'Done for today. Night.', onit: 'Got it.', full: 'Bench is maxed.', nospace: 'Zero slots left for that.', idle: ['Forklift beeps are stuck in my head.', 'Who left the dock open?', 'I like the new sign.', 'Need more tape at the bench.'], brk: 'Lunch!' },
    Ada:  { hi: 'Morning all.', bye: 'Off home.', onit: 'Sure.', full: 'No room on the bench.', nospace: 'Racks are full for that line.', idle: ['Peaceful.', 'Trucks are late today.', 'Nice and tidy, that row.', 'I will sort the empties later.'], brk: 'Tea break.' },
    Theo: { hi: 'Yo. Clocking in.', bye: 'Peace.', onit: 'Say less.', full: 'Bench is packed out.', nospace: 'Nowhere for it, chief.', idle: ['Radio is decent today.', 'Who ordered forty lamps?', 'Yard is slippy.', 'Pigeons are back.'], brk: 'Food.' },
    Nour: { hi: 'Good morning. Shall we?', bye: 'Goodnight, everyone.', onit: 'Of course.', full: 'The bench is full, I am afraid.', nospace: 'No rack space for this pallet.', idle: ['The clients are happy this week.', 'I rewrote the pick list.', 'It is cold in here.', 'Nice work on that order.'], brk: 'Lunch time.' }
  };
  function voice(st) { return VOICE[st.name] || VOICE.Jo; }
  function staffSay(st, text, col) { var m = staffMeshes[st.id]; if (m && m.visible) say(m, text, col); }
  function staffById(id) { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].id === id) return S.staff[i]; return null; }
  function staffOnShift() { return S.time >= 8 && S.time < 20 && !isSunday(); }
  function onBreak() { return S.time >= 12 && S.time < 12.5; }
  function hireStaff(role) {
    var def = STAFF_ROLES[role]; if (!def) return;
    if (def.needs && !S.up[def.needs]) { toast('Buy the forklift first: a driver needs something to drive.', 'bad'); return; }
    var name = STAFF_NAMES[S.nextStaffName++ % STAFF_NAMES.length];
    var st = { id: uid('st'), name: name, role: role, x: SPOT.spawn.x, z: SPOT.spawn.z, yaw: 0, state: 'home', path: [], timer: 0, carry: null, task: null, hiredDay: S.day, look: { skin: pick(SKINS), hair: pick(HAIRS), style: pick(['short', 'long', 'bun', 'bald', 'short']) }, said: 0, punct: randf(0.2, 1), arriveOff: 0, hoursToday: 0, sheet: [] };
    S.staff.push(st); buildStaffMesh(st); logEvent('Hired ' + name + ' as ' + def.name.toLowerCase() + '. Paid ' + money(def.wage / 10) + ' an hour from the time clock, time and a half past ten hours.', 'good'); hudDirty = true; if (S.time < 17 && !isSunday()) { st.state = 'home'; st.arriveOff = Math.round((S.time + 0.15 - SHIFT_START) * 60); }
  }
  function fireStaff(id) {
    var st = staffById(id); if (!st) return;
    staffDropAll(st); var m = staffMeshes[id]; if (m) { if (m.userData.jack) scene.remove(m.userData.jack); scene.remove(m); delete staffMeshes[id]; }
    S.staff.splice(S.staff.indexOf(st), 1); logEvent(st.name + ' let go'); hudDirty = true;
  }
  function buildStaffMesh(st) {
    var vest = st.role === 'receiver' ? MAT.hivisOrange : st.role === 'picker' ? MAT.hivis : st.role === 'driver' ? MAT.hivis : MAT.green;
    var look = st.look || {};
    var g = makeHuman({ skin: look.skin, hair: look.hair, style: look.style, vest: vest, hardhat: st.role === 'receiver' || st.role === 'driver' ? (st.role === 'driver' ? MAT.yellow : MAT.white) : null, name: st.name }); g.userData.dynamic = true; g.position.set(st.x, 0, st.z); scene.add(g); staffMeshes[st.id] = g;
    if (st.role === 'receiver' && jackModel) g.userData.jack = jackModel('staffjack', true);   // a receiver has a pallet jack of their own: pushed under the pallet, towed behind them when empty
  }
  // the receiver's jack. Loaded: pushed ahead with the tiller lowered to 31 degrees, so its grip meets both hands half a metre in
  // front at hip height. Empty and walking: towed behind on one trailing arm, tiller at 20 degrees, the grip in that hand just
  // behind the hip; its heading eases after the figure so a turn does not whip it round. Standing: parked behind them, tiller
  // sprung up. The distances are STAFF_JACK; the tiller is 1 m long on a pivot 0.78 m behind the jack's origin at 0.5 m.
  function jackFollow(st, m, onJack, dt, walking) {
    var j = m.userData.jack; if (!j) return; var u = j.userData, parked = !!(st.jackParked && st.jackAt), ease = 1 - Math.exp(-(dt || 1 / 60) * 6);
    j.visible = parked || m.visible;   // a parked jack stays in the hall while its owner is on a break, at the clock or at home
    var tilt = parked ? -0.3 : onJack ? -1.025 : walking ? -1.213 : -0.3;
    if (u.tilt === undefined) u.tilt = tilt; else u.tilt += (tilt - u.tilt) * ease; if (u.tiller) u.tiller.rotation.x = u.tilt;
    if (parked) { j.position.set(st.jackAt.x, floorY(st.jackAt.x, st.jackAt.z), st.jackAt.z); j.rotation.y = st.jackAt.ry || 0; return; }
    var fy = floorY(st.x, st.z);
    if (onJack) { u.towRy = undefined; u.towD = undefined; j.position.set(st.x + Math.sin(st.yaw) * STAFF_JACK.push, fy, st.z + Math.cos(st.yaw) * STAFF_JACK.push); j.rotation.y = st.yaw; }
    else {
      var want = walking ? STAFF_JACK.tow : STAFF_JACK.park, cur = u.towRy === undefined ? st.yaw : u.towRy, d = Math.atan2(Math.sin(st.yaw - cur), Math.cos(st.yaw - cur)); cur += d * ease; u.towRy = cur;
      u.towD = u.towD === undefined ? want : u.towD + (want - u.towD) * ease;
      j.position.set(st.x - Math.sin(cur) * u.towD, fy, st.z - Math.cos(cur) * u.towD); j.rotation.y = cur + Math.PI;
    }
    st.jackAt = { x: j.position.x, z: j.position.z, ry: j.rotation.y };   // where it would stay if they walked off now
  }
  function staffDriving() { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].state === 'drive') return S.staff[i]; return null; }
  function staffDropAll(st) {
    if (st.state === 'drive') driverDismount(st);
    S.pallets.forEach(function (p) { if (p.place === 'staff' && p.staff === st.id) { p.place = 'floor'; p.x = st.x + Math.sin(st.yaw) * STAFF_JACK.push; p.z = st.z + Math.cos(st.yaw) * STAFF_JACK.push; p.y = floorY(p.x, p.z); p.rot = st.yaw; p.staff = null; } });   // a pallet on the jack is set down where the jack stands
    if (st.carry) { if (st.carry.kind === 'box') S.floor.push({ kind: 'box', sku: st.carry.sku, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); else S.floor.push({ kind: 'parcel', order: st.carry.order, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); st.carry = null; }
    S.pallets.forEach(function (p) { if (p.place === 'staff' && p.staff === st.id) { p.place = 'floor'; p.x = st.x + Math.sin(st.yaw) * 0.95; p.z = st.z + Math.cos(st.yaw) * 0.95; p.y = floorY(p.x, p.z); p.rot = st.yaw; } });
    st.task = null; st.state = 'idle'; st.path = [];
  }
  function staffGo(st, to, then) { st.path = route({ x: st.x, z: st.z }, to); st.state = 'walk'; st.then = then; }
  function staffWalk(st, dt) {
    if (!st.path.length) { st.state = st.then || 'idle'; st.then = null; return; }
    var t = st.path[0], dx = t.x - st.x, dz = t.z - st.z, d = Math.sqrt(dx * dx + dz * dz), sp = (st.carry || S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; }) ? 1.6 : 1.9) * (st.trained ? 1.2 : 1) * dt;   // a trained worker walks a fifth faster
    if (d <= sp) { st.x = t.x; st.z = t.z; st.path.shift(); if (!st.path.length) { st.state = st.then || 'idle'; st.then = null; } return; }
    st.x += dx / d * sp; st.z += dz / d * sp;
    var want = Math.atan2(dx, dz), diff = want - st.yaw; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI; st.yaw += diff * Math.min(1, 10 * dt);
  }
  // boxes already on their way to the bench, by SKU: on the pick belts and the merge, in a crane's grab, in a picker's hands, or
  // claimed by a picker walking to the slot. The cranes and the pickers both subtract this, so neither fetches a box the other
  // already has in hand. A box being carried back to the racks is not on its way to the bench.
  function pickInFlight() {
    var n = {}, add = function (sku) { n[sku] = (n[sku] || 0) + 1; };
    ['pickBelt', 'pickBelt2', 'pickMerge', 'upperPick', 'upperChute'].forEach(function (bid) { if (BELTS[bid]) beltItems(bid).forEach(function (it) { if (it.kind === 'box') add(it.sku); }); });
    if (S.up.gantry) gantryRows().forEach(function (r) { var G = gantryState(r); if (G.sku && G.state !== 'idle') add(G.sku); });
    S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') { if (!st.carry.back) add(st.carry.sku); } else if (st.task && st.task.kind === 'pick') add(st.task.sku); });
    return n;
  }
  function skuDemand(sku) {
    var need = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === sku) need += l.qty; }); });
    need -= (S.bench.boxes[sku] || 0);
    need -= pickInFlight()[sku] || 0;
    return need;
  }
  function tickStaff(dt) {
    var brk = onBreak();
    S.staff.forEach(function (st) {
      var m = staffMeshes[st.id]; if (!m) { buildStaffMesh(st); m = staffMeshes[st.id]; }
      if (st.punct === undefined) staffNewDay();
      var off = isSunday() || st.sick || st.dayOff, end = shiftEnd(st);
      // not here: at home until the arrival time, then the walk in from the yard to the clock
      if (st.state === 'home') {
        m.visible = false; jackFollow(st, m, false, dt, false); st.x = RAMP_BOTTOM.x; st.z = RAMP_BOTTOM.z;   // the jack stays parked in the hall overnight
        if (!off && !st.clockedOutAt && S.time >= staffArrival(st) && S.time < end - 0.5) { st.state = 'walk'; st.then = 'clockin'; st.path = route({ x: st.x, z: st.z }, clockStand()); }
        return;
      }
      if (st.state === 'gone') { st.state = 'home'; m.visible = false; return; }
      m.visible = true;
      var onJack = S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; }), carrying = !!st.carry || onJack;
      // the clock at both ends of the shift
      if (st.state === 'clockin') { staffWait(st, 1.4, function () { staffClockIn(st); st.state = 'idle'; }, true); st.state = 'wait'; st.yaw = clockFaceYaw(); }
      // planned once: a walker already on the way, at the clock, or in the clock-out wait is left alone (re-planning every tick from a clipped door jamb bounced them in the doorway for hours)
      if (st.clocked && S.time >= end && st.state !== 'clockout' && !(st.state === 'walk' && st.then === 'clockout') && !(st.state === 'wait' && st.leavingWait)) { staffDropAll(st); st.jackParked = true; st.state = 'walk'; st.then = 'clockout'; st.path = route({ x: st.x, z: st.z }, clockStand()); st.leaving = true; }
      if (st.state === 'clockout') { st.leavingWait = true; staffWait(st, 1.2, function () { staffClockOut(st); st.leavingWait = false; st.state = 'walk'; st.then = 'gone'; st.path = route({ x: st.x, z: st.z }, RAMP_BOTTOM); st.leaving = true; }, true); st.state = 'wait'; st.yaw = clockFaceYaw(); }
      if (st.clocked) st.hoursToday = (st.hoursToday || 0) + dt / HOUR_SEC;
      var working = st.clocked && S.time < end;   // on the clock and inside the shift. Not the old st.leaving flag: set at every shift end since 1.4.0 and never cleared, it kept a worker idle at the clock from their second morning on
      if (working && brk && !carrying && st.state !== 'break' && st.state !== 'walk' && st.state !== 'wait' && st.state !== 'drive') { st.task = null; st.jackParked = true; staffSay(st, voice(st).brk, '#a0acb8'); staffGo(st, { x: -HALL.x + 3.7 + randf(-1, 1), z: -21.2 + randf(-0.4, 0.4) }, 'break'); }
      if (!brk && st.state === 'break') st.state = 'idle';
      // the driver: at the forklift, climbs on; on it, the forklift does the walking and the figure sits on the seat
      if (st.state === 'mountFork') { if (!S.up.fork || driving || (staffDriving() && staffDriving() !== st)) { st.state = 'idle'; st.task = null; } else { st.state = 'drive'; st.drive = { phase: 'toPallet', path: null }; sfx('forklift'); } }
      if (st.state === 'drive') { driveTick(st, dt); var fy = floorY(S.fork.x, S.fork.z); m.position.set(S.fork.x - Math.sin(S.fork.yaw) * 0.42, fy + 0.56, S.fork.z - Math.cos(S.fork.yaw) * 0.42); m.userData.baseY = fy + 0.56; m.rotation.y = S.fork.yaw; st.x = S.fork.x - Math.sin(S.fork.yaw) * 1.7; st.z = S.fork.z - Math.cos(S.fork.yaw) * 1.7; st.yaw = S.fork.yaw; animateHuman(m, dt, 'sit', 0, null, false); jackFollow(st, m, false, dt, false); return; }
      var mode = st.state === 'walk' ? 'walk' : st.state === 'wait' ? (st.working ? 'work' : 'wait') : 'idle';
      if (st.state === 'walk') staffWalk(st, dt);
      else if (st.state === 'wait') { st.timer -= dt * (st.trained ? 1.5 : 1); if (st.timer <= 0) { st.state = 'idle'; st.working = false; if (st.after) { var f = st.after; st.after = null; f(); } } }
      else if (st.state === 'break') { /* standing in the break room */ }
      else if (st.state === 'idle' && working) roleThink(st);
      if ((st.state === 'idle' || st.state === 'break') && Math.random() < dt / 22 && S.time - (st.said || 0) > 0.4) { st.said = S.time; staffSay(st, pick(voice(st).idle), '#a0acb8'); }
      m.position.set(st.x, floorY(st.x, st.z), st.z); m.userData.baseY = m.position.y; m.rotation.y = st.yaw;
      var near = dist2(st.x, st.z, player.x, player.z) < 36;
      animateHuman(m, dt, mode, 1.9, near && st.state !== 'walk' ? { x: player.x, y: player.y + 1.6, z: player.z } : null, onJack ? 'jack' : carrying ? true : (m.userData.jack && mode === 'walk' ? 'tow' : false));
      jackFollow(st, m, onJack, dt, mode === 'walk');
    });
  }
  // which role's work a worker does now: their own, or their second role when their own queue is empty and the other has work
  var THINK = { receiver: receiverThink, picker: pickerThink, driver: driverThink, packer: packerThink };
  function roleHasWork(role) {
    if (role === 'receiver') return S.trucks.some(function (t) { return t.dir === 'in' && t.state === 'docked' && t.signed && S.doors[doorIndex('in', t.dock)] && S.pallets.some(function (p) { return p.place === 'truck' && p.truck === t.id && p.n > 0; }); });
    if (role === 'picker') { var need = benchNeed(); for (var k in need) if (need[k] > 0 && stockCount(k) > 0) return true; return false; }
    if (role === 'packer') return openOrders().some(canPack) || S.bench.parcels.length > 0;
    if (role === 'driver') return !!S.up.fork && !!driverJob();
    return false;
  }
  function roleThink(st) { var r = st.role; if (st.cross && THINK[st.cross] && !roleHasWork(r) && roleHasWork(st.cross)) r = st.cross; THINK[r](st); }
  // ── The forklift driver ───────────────────────────────────────────
  // Takes the pallets left on the hall floor (receiving, the palletiser drop, wherever you set one down) to a rack slot on any
  // level, the top shelf included, which nobody on foot can reach. Keeps clear of the AGV's square and of you: a pallet you are
  // standing by is yours, and the forklift is never taken while you are next to it or on it.
  function driverSpot() { return { x: SPOT.fork.x + 2.2, z: SPOT.fork.z + 1.2 }; }
  function driverJob() {
    var A = S.agv, pu = propInst.agvDock ? propWorld('agvDock', 0, 2.6) : null, wr = propInst.wrapper ? propWorld('wrapper', 0, 0) : null, best = null, bd = 1e9;
    S.pallets.forEach(function (p) {
      if (p.place !== 'floor' || p.n <= 0 || !insideHall(p.x, p.z) || (SKU[p.sku] && SKU[p.sku].raw)) return;
      if (A && A.target === p.id && A.state !== 'idle') return; if (pu && dist2(p.x, p.z, pu.x, pu.z) < 2.6) return; if (wr && dist2(p.x, p.z, wr.x, wr.z) < 2.6) return; if (dist2(p.x, p.z, player.x, player.z) < 9) return;
      if (S.staff.some(function (o) { return o.task && o.task.pallet === p.id; })) return;
      var key = findSlotFor(p.sku, p.n, 2); if (!key) return;
      var d = dist2(p.x, p.z, S.fork.x, S.fork.z); if (d < bd) { bd = d; best = { pallet: p, key: key }; }
    });
    return best;
  }
  function driverThink(st) {
    if (!S.up.fork) { if (Math.random() < 0.004) staffSay(st, 'Nothing to drive yet.', '#a0acb8'); idleAt(st, driverSpot()); return; }
    if (driving || staffDriving() || dist2(player.x, player.z, S.fork.x, S.fork.z) < 6.5) { idleAt(st, driverSpot()); return; }
    var job = driverJob(); if (!job) { idleAt(st, driverSpot()); return; }
    st.task = { kind: 'drive', pallet: job.pallet.id, key: job.key }; if (Math.random() < 0.5) staffSay(st, voice(st).onit, '#5fd38d');
    staffGo(st, { x: S.fork.x - Math.sin(S.fork.yaw) * 1.6, z: S.fork.z - Math.cos(S.fork.yaw) * 1.6 }, 'mountFork');
  }
  function forkFollow(D, dt) {
    if (!D.path || !D.path.length) return true;
    var t = D.path[0], dx = t.x - S.fork.x, dz = t.z - S.fork.z, d = Math.hypot(dx, dz), want = Math.atan2(dx, dz), diff = Math.atan2(Math.sin(want - S.fork.yaw), Math.cos(want - S.fork.yaw));
    S.fork.yaw = Math.atan2(Math.sin(S.fork.yaw + clamp(diff, -2.2 * dt, 2.2 * dt)), Math.cos(S.fork.yaw + clamp(diff, -2.2 * dt, 2.2 * dt))); if (Math.abs(diff) > 0.5) return false;   // turns on the spot before it moves off, the way a counterbalance truck is driven; the heading is kept wrapped
    var sp = 2.4 * dt; if (d <= sp) { S.fork.x = t.x; S.fork.z = t.z; D.path.shift(); return !D.path.length; }
    S.fork.x += dx / d * sp; S.fork.z += dz / d * sp; return false;
  }
  function forkTurnTo(want, dt) { var diff = Math.atan2(Math.sin(want - S.fork.yaw), Math.cos(want - S.fork.yaw)); if (Math.abs(diff) < 0.04) { S.fork.yaw = want; return true; } S.fork.yaw += clamp(diff, -2.2 * dt, 2.2 * dt); return false; }
  function driveTick(st, dt) {
    var D = st.drive, p = st.task ? palletById(st.task.pallet) : null;
    if (!D) { driverDismount(st); return; }
    if (D.phase === 'toPallet') {
      if (!p || p.place !== 'floor') { D.phase = 'park'; D.path = null; return; }
      if (!D.path) { var dx = p.x - S.fork.x, dz = p.z - S.fork.z, dl = Math.hypot(dx, dz) || 1; D.path = route({ x: S.fork.x, z: S.fork.z }, { x: p.x - dx / dl * 1.7, z: p.z - dz / dl * 1.7 }); }
      if (forkFollow(D, dt) && forkTurnTo(Math.atan2(p.x - S.fork.x, p.z - S.fork.z), dt)) { p.place = 'fork'; S.fork.pallet = p.id; S.fork.lift = 0.3; sfx('jack'); D.phase = 'toSlot'; D.path = null; }
    } else if (D.phase === 'toSlot') {
      if (!p || p.place !== 'fork') { D.phase = 'park'; D.path = null; return; }
      if (!D.path) D.path = route({ x: S.fork.x, z: S.fork.z }, slotStand(st.task.key));
      if (forkFollow(D, dt)) { var sp = slotParse(st.task.key), spos = rackSlotPos(sp.r, sp.b, sp.l); if (forkTurnTo(Math.atan2(spos.x - S.fork.x, spos.z - S.fork.z), dt)) { D.phase = 'lift'; D.liftTo = RACK.levels[sp.l] + 0.15; } }
    } else if (D.phase === 'lift') {
      S.fork.lift = Math.min(D.liftTo, S.fork.lift + 0.9 * dt);
      if (S.fork.lift >= D.liftTo - 0.001) {
        var ok = p && storePallet(p, st.task.key); if (!ok && p) { var k2 = findSlotFor(p.sku, p.n, 2); ok = k2 && storePallet(p, k2); }
        if (ok) { S.stats.putaway++; sfx('crate'); addXp(XP.pallet); } else if (p) { var ft = forkTip(); p.place = 'floor'; p.x = ft.x; p.z = ft.z; p.y = 0; p.rot = S.fork.yaw; staffSay(st, voice(st).nospace, '#ff6b5e'); }
        S.fork.pallet = null; D.phase = 'lower';
      }
    } else if (D.phase === 'lower') {
      S.fork.lift = Math.max(0.1, S.fork.lift - 0.9 * dt);
      if (S.fork.lift <= 0.1001) { st.task = null; var job = !driving && dist2(player.x, player.z, S.fork.x, S.fork.z) > 6.5 ? driverJob() : null; if (job) { st.task = { kind: 'drive', pallet: job.pallet.id, key: job.key }; D.phase = 'toPallet'; D.path = null; } else { D.phase = 'park'; D.path = null; } }
    } else if (D.phase === 'park') {
      if (!D.path) D.path = route({ x: S.fork.x, z: S.fork.z }, { x: SPOT.fork.x, z: SPOT.fork.z });
      if (forkFollow(D, dt) && forkTurnTo(Math.PI, dt)) driverDismount(st);
    } else driverDismount(st);
  }
  function driverDismount(st) {
    var p = S.fork.pallet ? palletById(S.fork.pallet) : null;
    if (p && st.task && st.task.pallet === p.id) { var ft = forkTip(); p.place = 'floor'; p.x = ft.x; p.z = ft.z; p.y = 0; p.rot = S.fork.yaw; S.fork.pallet = null; }
    if (!S.fork.pallet) S.fork.lift = Math.min(S.fork.lift, 0.3);
    st.drive = null; st.task = null; st.state = 'idle'; st.x = S.fork.x - Math.sin(S.fork.yaw) * 1.7; st.z = S.fork.z - Math.cos(S.fork.yaw) * 1.7; st.yaw = S.fork.yaw;
  }
  function benchSide(lz) { var P = PROPS.bench ? propPlacement('bench') : { x: SPOT.bench.x, z: SPOT.bench.z, rot: 0 }, a = P.rot * Math.PI / 2, lx = -1.0; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a) }; }
  function clockStand() { var P = propPlacement('timeclock'), a = P.rot * Math.PI / 2; return { x: P.x + Math.sin(a) * 1.0, z: P.z + Math.cos(a) * 1.0 }; }
  function clockFaceYaw() { var P = propPlacement('timeclock'); return P.rot * Math.PI / 2 + Math.PI; }
  function staffWait(st, sec, after, working) { st.state = 'wait'; st.timer = sec; st.after = after; st.working = !!working; }
  function idleAt(st, spot) { if (dist2(st.x, st.z, spot.x, spot.z) > 1) { staffGo(st, spot, 'wait'); st.timer = 1.5; } else staffWait(st, 1.5 + Math.random()); }
  function receiverThink(st) {
    var carrying = S.pallets.filter(function (p) { return p.place === 'staff' && p.staff === st.id; })[0];
    // the jack was left somewhere (a break, the clock, overnight): walk back to where they stood with it before anything else
    if (st.jackParked && !carrying) { var ja = st.jackAt, stand = ja ? { x: ja.x - Math.sin(ja.ry || 0) * STAFF_JACK.park, z: ja.z - Math.cos(ja.ry || 0) * STAFF_JACK.park } : null; if (!stand || dist2(st.x, st.z, stand.x, stand.z) < 0.5) { st.jackParked = false; } else { st.task = { kind: 'jack' }; staffGo(st, stand, 'wait'); st.timer = 0.4; st.working = true; st.after = function () { st.jackParked = false; st.task = null; }; return; } }
    if (carrying) {
      var key = findSlotFor(carrying.sku, carrying.n, 1);
      if (!key) { carrying.place = 'floor'; carrying.x = SPOT.stageIn.x + randf(-1, 1); carrying.z = SPOT.stageIn.z + randf(-1, 1); carrying.y = 0; carrying.rot = 0; staffSay(st, voice(st).nospace, '#ff6b5e'); logEvent(st.name + ' found no rack space: pallet left in receiving', 'bad'); st.task = null; return; }
      st.task = { kind: 'store', pallet: carrying.id, key: key };
      staffGo(st, slotStand(key), 'wait'); st.timer = 1.4; st.working = true; st.after = function () { var p = palletById(carrying.id); if (!p) return; if (!storePallet(p, key)) { var k2 = findSlotFor(p.sku, p.n, 1); if (!k2 || !storePallet(p, k2)) { p.place = 'floor'; p.x = st.x; p.z = st.z; p.y = 0; } } else { sfx('crate'); addXp(XP.pallet); } st.task = null; };
      return;
    }
    var pickP = null;
    for (var i = 0; i < S.pallets.length; i++) { var p = S.pallets[i]; if (p.place !== 'truck' || p.n <= 0) continue; var t = truckById(p.truck); if (!t || t.state !== 'docked' || !S.doors[doorIndex('in', t.dock)] || !t.signed) continue; if (S.staff.some(function (o) { return o !== st && o.task && o.task.pallet === p.id; })) continue; pickP = p; break; }
    if (!pickP) { idleAt(st, { x: SPOT.stageIn.x, z: SPOT.stageIn.z + 2.6 }); return; }
    var w = truckPalletPos(truckById(pickP.truck), pickP.idx), tr = truckById(pickP.truck);
    st.task = { kind: 'fetch', pallet: pickP.id }; if (Math.random() < 0.5) staffSay(st, voice(st).onit, '#5fd38d');
    staffGo(st, { x: w.x, z: w.z + (w.z > tr.z ? -1.0 : 1.0) }, 'wait'); st.timer = 1.4; st.working = true;
    st.after = function () { var p = palletById(pickP.id); if (!p || p.place !== 'truck') { st.task = null; return; } onPalletLeftTruck(p); p.place = 'staff'; p.staff = st.id; sfx('jack'); st.task = null; };
  }
  function pickerThink(st) {
    // a box being taken back: to the slot chosen for it, and onto the rack
    if (st.carry && st.carry.back) {
      var bk = st.carry.back, bsku = st.carry.sku;
      staffGo(st, slotStand(bk), 'wait'); st.timer = 1.0; st.working = true;
      st.after = function () { if (!st.carry) return; var k = slotSpace(bk, bsku) > 0 ? bk : findSlotFor(bsku, 1, 1); if (k) { slotAdd(k, bsku, 1); st.carry = null; sfx('putdown'); S.stats.putaway++; } else { S.floor.push({ kind: 'box', sku: bsku, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); st.carry = null; staffSay(st, voice(st).nospace, '#ff6b5e'); } st.task = null; };
      return;
    }
    if (st.carry) {
      staffGo(st, benchSide(0), 'wait'); st.timer = 0.8; st.working = true;
      st.after = function () { if (!st.carry) return; if (benchCount() < ECON.benchCap) { benchAdd(st.carry.sku, 1); st.carry = null; sfx('putdown'); addXp(XP.box); } else { staffSay(st, voice(st).full, '#ff6b5e'); staffWait(st, 3); } st.task = null; };
      return;
    }
    var want = null;
    var orders = openOrders().slice().sort(function (a, b) { return (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b.due; });
    for (var i = 0; i < orders.length && !want; i++) orders[i].lines.forEach(function (l) { if (want) return; if (skuDemand(l.sku) > 0) { var keys = slotsWith(l.sku).filter(function (k) { var sp = slotParse(k); return sp.l < RACK.top && sp.r < UPPER.row; });   /* the upper row is the upper crane's */ if (keys.length) want = { sku: l.sku, key: keys[0] }; } });
    if (!want) {
      // nothing to pick: a box on the bench that no open order wants goes back on the racks, one at a time
      var sur = benchSurplus(), rsku = null; for (var sk in sur) if (sur[sk] > 0) { rsku = sk; break; }
      var rkey = rsku ? findSlotFor(rsku, 1, 1) : null;
      if (rkey && !S.staff.some(function (o) { return o !== st && o.task && o.task.kind === 'return'; })) { st.task = { kind: 'return', sku: rsku, key: rkey }; staffGo(st, benchSide(0), 'wait'); st.timer = 0.8; st.working = true; st.after = function () { if (benchTake(rsku, 1)) { st.carry = { kind: 'box', sku: rsku, back: rkey }; sfx('pickup'); } else st.task = null; }; return; }
      idleAt(st, { x: SPOT.bench.x - 2.0, z: 2.6 }); return;
    }
    st.task = { kind: 'pick', sku: want.sku, key: want.key };
    staffGo(st, slotStand(want.key), 'wait'); st.timer = 1.0; st.working = true;
    st.after = function () { var s = S.slots[want.key]; if (s && s.sku === want.sku && s.n > 0) { slotTake(want.key, 1); st.carry = { kind: 'box', sku: want.sku }; S.stats.picked++; sfx('pickup'); } st.task = null; };
  }
  function packerThink(st) {
    if (st.carry && st.carry.kind === 'parcel') {
      var co = orderById(st.carry.order), t = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && S.doors[doorIndex('out', x.dock)] && (!co || MODES[orderMode(co)].door === doorIndex('out', x.dock)); })[0];   // the truck of the parcel's lane, never the wrong door
      if (!t) { staffWait(st, 2); return; }
      staffGo(st, { x: t.x + t.side * 1.6, z: t.z }, 'wait'); st.timer = 0.9; st.working = true;
      st.after = function () { if (!st.carry) return; var tt = truckById(t.id); var o = orderById(st.carry.order); if (tt && tt.state === 'docked' && o) { tt.parcels.push(o.id); o.state = 'loaded'; sfx('crate'); addXp(XP.ship); rebuildBoardSoon(); st.carry = null; } else { staffWait(st, 2); } };
      return;
    }
    var packable = openOrders().filter(canPack).sort(function (a, b) { return a.due - b.due; })[0];
    if (packable) {
      staffGo(st, benchSide(0.8), 'wait'); st.timer = 2.8; st.working = true;
      st.after = function () { if (canPack(packable)) { packOrder(packable); } };
      return;
    }
    var docked = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && S.doors[doorIndex('out', x.dock)]; }), forLane = function (oid) { var oo = orderById(oid); return oo && docked.some(function (x) { return MODES[orderMode(oo)].door === doorIndex('out', x.dock); }); };
    var truck = docked.length && S.bench.parcels.some(forLane) ? docked[0] : null;
    if (truck && S.bench.parcels.length) {
      staffGo(st, benchSide(2.3), 'wait'); st.timer = 0.7; st.working = true;
      st.after = function () { var oid = S.bench.parcels.filter(forLane)[0]; if (oid) { S.bench.parcels.splice(S.bench.parcels.indexOf(oid), 1); st.carry = { kind: 'parcel', order: oid }; sfx('pickup'); } };
      return;
    }
    idleAt(st, { x: SPOT.bench.x - 1.8, z: 7.4 });
  }
  // ── The time clock ────────────────────────────────────────────────
  // Nobody is paid a flat wage. The crew clock in at the reader by the staff door when they arrive and clock out when
  // they leave; the day's pay at 06:00 is their clocked hours at the hourly rate, with anything past ten hours at
  // time and a half. Punctuality is a trait: some are early, some drift in late, and a word puts them right for a while.
  var CLOCK_SPOT = { x: -HALL.x + 1.0, z: 20.2 }, RAMP_BOTTOM = { x: -HALL.x - 7.3, z: 22 }, SHIFT_START = 8;
  // the staff options (1.14.0): a shift pattern, a training course, a raise that fixes timekeeping, a second role, a bigger crew at level 7
  var STAFF_SHIFTS = { early: { start: 6, end: 16 }, day: { start: 8, end: 18 }, late: { start: 12, end: 22 } }, TRAIN_PRICE = 400, CROSS_PRICE = 350, RAISE_PRICE = 250;
  function shiftOf(st) { return STAFF_SHIFTS[st.shift] || STAFF_SHIFTS.day; }
  function shiftStart(st) { return shiftOf(st).start; }
  function hourly(st) { return STAFF_ROLES[st.role].wage / 10 * (st.raise ? 1.1 : 1); }
  function shiftEnd(st) { var e = shiftOf(st).end; return st.overtime ? Math.min(DAY_END, e + 2) : e; }
  function staffArrival(st) { return shiftStart(st) + (st.arriveOff || 0) / 60; }
  function staffCap() { return S.level >= 7 ? 8 : 5; }
  function staffTrain(st) { if (st.trained) return; if (S.bank < TRAIN_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-TRAIN_PRICE, 'Training course, ' + st.name); st.trained = true; sfx('cash'); toast(st.name + ' is trained: quicker on their feet and at every task', 'good'); logEvent(st.name + ' finished the ' + STAFF_ROLES[st.role].name.toLowerCase() + ' course', 'good'); }
  function staffRaise(st) { if (st.raise) return; if (S.bank < RAISE_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-RAISE_PRICE, 'Raise for ' + st.name); st.raise = true; st.punct = 1; if ((st.arriveOff || 0) > 0) st.arriveOff = 0; sfx('cash'); staffSay(st, pick(['Cheers, boss.', 'I will not let you down.', 'Appreciated.']), '#5fd38d'); logEvent(st.name + ' got a raise: 10% more an hour, and on time from now on', 'good'); }
  function staffShiftCycle(st) { var order = ['day', 'early', 'late'], i = order.indexOf(st.shift || 'day'); st.shift = order[(i + 1) % 3]; sfx('click'); toast(st.name + ' moves to the ' + st.shift + ' shift from tomorrow (' + fmtTime(shiftStart(st)) + ' to ' + fmtTime(shiftOf(st).end) + ')', 'good'); logEvent(st.name + ' moves to the ' + st.shift + ' shift'); }
  function staffCrossCycle(st) {
    var roles = Object.keys(STAFF_ROLES).filter(function (r) { return r !== st.role && !(STAFF_ROLES[r].needs && !S.up[STAFF_ROLES[r].needs]); }); if (!roles.length) return;
    var i = roles.indexOf(st.cross || ''), next = i < 0 ? roles[0] : i + 1 < roles.length ? roles[i + 1] : null;
    if (next && !st.crossPaid) { if (S.bank < CROSS_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-CROSS_PRICE, 'Cross-training, ' + st.name); st.crossPaid = true; }
    st.cross = next; st.task = null; sfx('click'); toast(next ? st.name + ' also covers ' + STAFF_ROLES[next].name.toLowerCase() + ' work when their own queue is empty' : st.name + ' sticks to ' + STAFF_ROLES[st.role].name.toLowerCase() + ' work', 'good');
  }
  function staffStatus(st) {
    if (isSunday()) return 'Sunday';
    if (st.sick) return 'called in sick'; if (st.dayOff) return 'day off';
    if (st.state === 'home' && S.time < staffArrival(st)) return 'due ' + fmtTime(staffArrival(st));
    if (st.state === 'home' && st.clockedOutAt) return 'clocked out ' + fmtTime(st.clockedOutAt);
    if (st.state === 'home') return 'not in';
    if (!st.clocked) return 'arriving';
    if (st.state === 'break') return 'on break';
    return 'in since ' + fmtTime(st.clockInAt || shiftStart(st)) + (st.overtime ? ' · overtime' : '') + (st.lateToday ? ' · late' : '');
  }
  // the day's roll: who is sick, who is off, when each one will turn up
  function staffNewDay() {
    S.staff.forEach(function (st) {
      if (st.dayOffNext) { st.dayOff = true; st.dayOffNext = false; } else st.dayOff = false;
      st.sick = !st.dayOff && Math.random() < 0.04;
      if (st.punct === undefined) st.punct = randf(0.2, 1); if (st.raise) st.punct = 1;   // a raise keeps them on time for good
      var p = st.punct, r = Math.random();
      st.arriveOff = p > 0.75 ? randi(-12, -2) : p > 0.4 ? (r < 0.7 ? randi(-6, 4) : randi(6, 14)) : (r < 0.35 ? randi(-3, 3) : randi(8, 28));
      st.overtime = !!st.overtimeNext; st.overtimeNext = false;
      st.lateToday = false; st.hoursToday = 0; st.clockInAt = null; st.clockedOutAt = null; st.clocked = false; st.wordToday = false; st.leaving = false; st.leavingWait = false;
      if (st.sick) logEvent(st.name + ' called in sick', 'bad');
      if (st.dayOff) logEvent(st.name + ' has the day off');
      if (st.punct < 1 && !st.raise) st.punct = clamp(st.punct - 0.01, 0.1, 1);   // a word wears off slowly
    });
  }
  // pay for yesterday from the timesheet
  function payStaffWages() {
    S.staff.forEach(function (st) {
      var h = st.hoursToday || 0, base = Math.min(h, 10), ot = Math.max(0, h - 10), amount = Math.round(hourly(st) * (base + ot * 1.5));
      if (!st.sheet) st.sheet = []; st.sheet.unshift({ day: S.day - 1, h: Math.round(h * 10) / 10, late: !!st.lateToday, sick: !!st.sick, off: !!st.dayOff, ot: Math.round(ot * 10) / 10, pay: amount }); if (st.sheet.length > 7) st.sheet.pop();
      st.hoursTotal = (st.hoursTotal || 0) + h;
      if (amount > 0) pay(-amount, 'Wages, ' + st.name + ' (' + (Math.round(h * 10) / 10) + ' h' + (ot ? ', ' + (Math.round(ot * 10) / 10) + ' h overtime' : '') + ')');
    });
  }
  function staffClockIn(st) {
    st.clocked = true; st.clockInAt = S.time; sfx('scan');
    if (S.time > shiftStart(st) + 5 / 60) { st.lateToday = true; st.lateDays = (st.lateDays || 0) + 1; staffSay(st, pick(['Sorry, the ring road.', 'Late. I know. Sorry.', 'Overslept. Will not happen again.', 'Bus did not come.']), '#ff6b5e'); logEvent(st.name + ' clocked in late at ' + fmtTime(S.time), 'bad'); }
    else staffSay(st, voice(st).hi, '#5fd38d');
    screenDirtyAll();
  }
  function staffClockOut(st) { st.clocked = false; st.clockedOutAt = S.time; sfx('scan'); staffSay(st, voice(st).bye, '#a0acb8'); screenDirtyAll(); }
  function staffWord(st) {
    if (st.wordToday) { toast('You already had a word with ' + st.name + ' today.', ''); return; }
    st.wordToday = true; st.punct = clamp(st.punct + 0.35, 0, 1); sfx('click');
    staffSay(st, pick(['Understood, boss.', 'Fair enough. I will be on time.', 'Will not happen again.']), '#f5b53d'); logEvent('Had a word with ' + st.name + ' about timekeeping'); addRep(0.2);
  }

  // your own card
  function myClock(on) {
    if (on === !!S.clockedIn) return;
    if (on) { S.clockedIn = true; S.clockInAt = S.time; S.clockInDay = S.day; introStep('clockin'); S.shiftStart = { shipped: S.stats.shipped, received: S.stats.received, earned: S.stats.earned, spent: S.stats.spent }; sfx('scan'); toast('Clocked in at ' + fmtTime(S.time), 'good'); logEvent('You clocked in at ' + fmtTime(S.time)); if (S.time < 7.5) { addXp(5); toast('Early bird: +5 XP', 'rare'); } }
    else {
      var h = S.clockInDay === S.day ? S.time - S.clockInAt : (24 - S.clockInAt) + S.time, ss = S.shiftStart || S.stats;
      S.clockedIn = false; S.stats.hoursWorked = (S.stats.hoursWorked || 0) + h; sfx('scan');
      var rep = 'Shift: ' + (Math.round(h * 10) / 10) + ' h · ' + (S.stats.shipped - ss.shipped) + ' orders shipped · ' + (S.stats.received - ss.received) + ' pallets in · ' + money(S.stats.earned - ss.earned) + ' earned, ' + money(S.stats.spent - ss.spent) + ' spent';
      toast('Clocked out. ' + rep, 'good'); logEvent('You clocked out at ' + fmtTime(S.time) + '. ' + rep, 'rare'); if (h >= 8) addXp(10);
    }
    hudDirty = true; screenDirtyAll();
  }
  function myHours() { if (!S.clockedIn) return 0; return S.clockInDay === S.day ? S.time - S.clockInAt : (24 - S.clockInAt) + S.time; }

  // the reader on the wall: a touch screen with a card slot and a lamp
  var tclock = { page: 0 };
  function buildTimeClock() {
    var X = HALL.x, g = new THREE.Group(); g.position.set(-X + 0.26, 0, 10.2); scene.add(g);
    box(0.38, 0.5, 0.12, MAT.grey, 0, 1.5, 0, g); box(0.4, 0.04, 0.14, MAT.steelDark, 0, 1.76, 0, g); box(0.4, 0.04, 0.14, MAT.steelDark, 0, 1.24, 0, g);
    box(0.02, 0.03, 0.12, MAT.black, 0.07, 1.3, 0, g); var lamp = box(0.02, 0.03, 0.03, glowMat(0x39d353, 1.2), 0.07, 1.68, -0.14, g); tclock.lamp = lamp;
    box(0.08, 0.5, 0.5, MAT.steelDark, -0.02, 1.5, 0.55, g); for (var k = 0; k < 6; k++) box(0.03, 0.14, 0.06, MAT.paper, 0.04, 1.62 - (k % 3) * 0.14, 0.36 + Math.floor(k / 3) * 0.22, g);
    sign(['CLOCK IN'], 0.6, 0.16, -0.05, 1.85, 0.3, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' }, g);
    touchScreen({ w: 300, h: 320, pw: 0.3, ph: 0.32, x: 0.07, y: 1.5, z: 0, ry: Math.PI / 2, parent: g, title: 'Time clock', draw: drawTimeClock });
    tclock.g = g;
  }
  function drawTimeClock(c, sc) {
    scBg(c, sc.w, sc.h, 'rgba(120,189,245,0.16)'); scHead(c, sc.w, tclock.page ? 'TIMESHEET' : 'TIME CLOCK');
    scButton(sc, 230, 8, 60, 24, tclock.page ? 'now' : 'sheet', false, function () { tclock.page = tclock.page ? 0 : 1; });
    var y = 60;
    if (!tclock.page) {
      scText(c, 12, y, 'You · ' + (S.clockedIn ? 'in since ' + fmtTime(S.clockInAt) + ' (' + (Math.round(myHours() * 10) / 10) + ' h)' : 'not clocked in'), S.clockedIn ? '#5fd38d' : '#eef1f5', 13);
      scButton(sc, 12, y + 8, 276, 32, S.clockedIn ? 'CLOCK OUT' : 'CLOCK IN', !S.clockedIn, function () { myClock(!S.clockedIn); }, '#5fd38d'); y += 54;
      if (!S.staff.length) scText(c, 12, y + 10, 'No crew yet. Hire on the office PC.', '#6b7784', 12);
      S.staff.forEach(function (st) {
        if (y > sc.h - 30) return;
        scText(c, 12, y, st.name + ' · ' + STAFF_ROLES[st.role].name, '#eef1f5', 12); scText(c, 12, y + 14, staffStatus(st) + (st.hoursToday ? ' · ' + (Math.round(st.hoursToday * 10) / 10) + ' h' : ''), st.lateToday ? '#ff6b5e' : '#a0acb8', 10);
        scButton(sc, 196, y - 10, 28, 22, 'OT', !!(st.overtime || st.overtimeNext), function () { if (S.time < 18 && !st.sick && !st.dayOff && st.clocked) st.overtime = !st.overtime; else st.overtimeNext = !st.overtimeNext; toast(st.name + (st.overtime || st.overtimeNext ? ' works till 20:00 at time and a half' : ' goes home at 18:00'), ''); }, '#f5b53d');
        scButton(sc, 228, y - 10, 30, 22, 'OFF', !!st.dayOffNext, function () { st.dayOffNext = !st.dayOffNext; toast(st.name + (st.dayOffNext ? ' has tomorrow off' : ' is in tomorrow'), ''); }, '#78bdf5');
        if (st.lateToday && !st.wordToday) scButton(sc, 262, y - 10, 28, 22, '!', true, function () { staffWord(st); }, '#ff6b5e');
        y += 34;
      });
    } else {
      scText(c, 12, y, 'Last 7 days · hours (overtime) · pay', '#a0acb8', 11); y += 18;
      S.staff.forEach(function (st) {
        if (y > sc.h - 24) return;
        var tot = (st.sheet || []).reduce(function (a, r) { return a + r.pay; }, 0), hrs = (st.sheet || []).reduce(function (a, r) { return a + r.h; }, 0), lates = (st.sheet || []).filter(function (r) { return r.late; }).length;
        scText(c, 12, y, st.name + ' · ' + (Math.round(hrs * 10) / 10) + ' h · ' + money(tot) + (lates ? ' · late ×' + lates : ''), '#eef1f5', 12); y += 14;
        scText(c, 12, y, (st.sheet || []).slice(0, 7).map(function (r) { return r.sick ? 'sick' : r.off ? 'off' : r.h + (r.ot ? '+' + r.ot : ''); }).join('  ') || 'no days yet', '#a0acb8', 10); y += 20;
      });
      scText(c, 12, sc.h - 10, 'You: ' + (Math.round((S.stats.hoursWorked || 0) * 10) / 10) + ' h on the clock all time', '#6b7784', 10);
    }
  }
  function tickTimeClock(dt) {
    if (tclock.lamp) tclock.lamp.material.emissive.setHex(S.events.power ? 0x333333 : (S.clockedIn ? 0x39d353 : 0xf5b53d));
    if (Math.floor(S.time * 12) !== tclock.q) { tclock.q = Math.floor(S.time * 12); screenDirtyAll(); }
  }
  // ── Machines ──────────────────────────────────────────────────────
  // Every machine is a prop with an inlet point and an outlet point in its own frame, a status (off, idle, run, jam) and a lamp
  // stack. Belts are props with a path; an item that reaches the end of a belt goes into whatever has an inlet within reach of
  // that end, another belt or a machine. So the player can move a machine in build mode and the line still works if the pieces
  // still touch, and stops with a pile-up at the gap if they do not.
  var MACH = {}, BELTS = {}, BELT_PLANES = [];
  var BELT_SPEED = 0.5, BELT_GAP = 0.45, BELT_Y = 0.75, REACH = 1.3;
  // every machine has a speed dial on its screen: 50 to 200 percent, kept per machine in S.speed
  var SPEED_STEPS = [0.5, 0.75, 1, 1.5, 2];
  function speedOf(key) { var v = S.speed && S.speed[key]; return typeof v === 'number' ? v : 1; }
  function speedSteps() { return S.up.plantTune ? SPEED_STEPS.concat([2.5, 3]) : SPEED_STEPS; }   // the plant tune-up opens 250 and 300%
  function speedCycle(key) { if (!S.speed) S.speed = {}; var steps = speedSteps(), i = steps.indexOf(speedOf(key)); S.speed[key] = steps[(i + 1) % steps.length]; sfx('click'); screenDirtyAll(); }
  function speedButton(sc, x, y, w, key, label) { var pct = Math.round(speedOf(key) * 100) + '%'; scButton(sc, x, y, w, 30, w < 80 ? pct : (label || 'SPD') + ' ' + pct, true, function () { speedCycle(key); }, '#78bdf5'); }
  function beltSpeedKey(b) { return b.speedKey || b.prop; }
  function defMachine(id, m) { m.id = id; m.lamps = null; MACH[id] = m; }
  var PROP_SPEED = {};   // prop id -> the dial and the rate its belt planes scroll with (a curve's segments share the prop's)
  function defBelt(id, b) { b.id = id; BELTS[id] = b; PROP_SPEED[b.prop] = { key: b.speedKey || b.prop, rate: b.rate || 1 }; }
  function propWorld(prop, lx, lz) { var P = propPlacement(prop), a = P.rot * Math.PI / 2; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), a: a }; }
  function beltLen(b) { var p = b.path, n = 0; for (var i = 1; i < p.length; i++) n += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return n; }
  function beltPoint(b, d) {   // the world point d metres along the belt
    var p = b.path, rem = d; for (var i = 1; i < p.length; i++) { var seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (rem <= seg || i === p.length - 1) { var t = seg > 0 ? clamp(rem / seg, 0, 1) : 0; var w = propWorld(b.prop, lerp(p[i - 1][0], p[i][0], t), lerp(p[i - 1][1], p[i][1], t)); w.ry = w.a + Math.atan2(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); w.y = BELT_Y + lerp(p[i - 1][2] || 0, p[i][2] || 0, t); return w; } rem -= seg; }
    var w0 = propWorld(b.prop, p[0][0], p[0][1]); w0.y = BELT_Y + (p[0][2] || 0); w0.ry = w0.a + (p.length > 1 ? Math.atan2(p[1][0] - p[0][0], p[1][1] - p[0][1]) : 0); return w0;
  }
  function beltItems(id) { if (!S.belts) S.belts = {}; if (!S.belts[id]) S.belts[id] = []; return S.belts[id]; }
  function beltGapOf(it) { return it && it.kind === 'pallet' ? 1.3 : BELT_GAP; }   // a pallet is a metre and a bit long
  function beltStartFree(id) { var it = beltItems(id); return !it.length || it[it.length - 1].d > beltGapOf(it[it.length - 1]); }
  function beltPush(id, item) { var b = BELTS[id]; if (b && edit.grabbed === b.prop) return false; if (!beltStartFree(id)) return false; item.d = 0; beltItems(id).push(item); return true; }   // a piece being carried in build mode takes nothing
  // Where a machine takes items in and lets them out, in the world: its inlet points (one or several, in its own frame), or a
  // fixed place for a machine that is not a prop (a dock door). A machine whose prop is not built has no points.
  function machinePoints(mc, which) {
    var pts = [], list = which === 'in' ? (mc.inlets || (mc.inlet ? [mc.inlet] : [])) : (mc.outlets || (mc.outlet ? [mc.outlet] : []));
    if (mc.atFn && which === 'in') { var a = mc.atFn(); if (a) pts.push({ x: a[0], z: a[1] }); }
    if (mc.prop) { if (!PROPS[mc.prop] || !propInst[mc.prop]) return pts; list.forEach(function (p) { pts.push(propWorld(mc.prop, p[0], p[1])); }); }
    return pts;
  }
  // What sits at a belt's far end: a machine whose inlet is within reach, else another belt whose start is, else a rack slot the
  // end stops at (the box goes straight onto the rack). Worked out once and kept until a prop is built or removed, because a
  // belt end only moves when build mode moves something.
  var sinkCache = {}; function beltsChanged() { sinkCache = {}; }
  function beltSink(b) {
    if (sinkCache[b.id] !== undefined) return sinkCache[b.id];
    if (b.noSink) return (sinkCache[b.id] = null);
    var end = beltPoint(b, beltLen(b)), out = null, R2 = REACH * REACH;
    for (var mk in MACH) { var mc = MACH[mk]; if (!mc.accept) continue; var pts = machinePoints(mc, 'in'); for (var i = 0; i < pts.length; i++) if (dist2(end.x, end.z, pts[i].x, pts[i].z) < R2) { out = { machine: mc }; break; } if (out) break; }
    if (!out) for (var k in BELTS) { if (k === b.id) continue; var ob = BELTS[k]; if (!propInst[ob.prop]) continue; var s = beltPoint(ob, 0); if (dist2(end.x, end.z, s.x, s.z) < R2 && Math.abs(end.y - s.y) < 0.7) { out = { belt: ob }; break; } }
    if (!out) { var best = null, bd = R2; for (var r = 0; r < S.up.rows; r++) for (var bb = 0; bb < RACK.bays; bb++) for (var l = 0; l <= 1; l++) { var sp = rackSlotPos(r, bb, l), d = dist2(end.x, end.z, sp.x, sp.z); if (d < bd && Math.abs(end.y - (sp.y + 0.6)) < 1.6) { bd = d; best = slotKey(r, bb, l); } } if (best) out = { slot: best }; }
    sinkCache[b.id] = out || null; return out;
  }
  // what feeds a belt at its start: a belt whose end sinks into it, a machine outlet, the parcel shelf, or an inbound dock door
  function beltFeeder(b) {
    var s = beltPoint(b, 0), R2 = REACH * REACH;
    for (var k in BELTS) { if (k === b.id) continue; var ob = BELTS[k]; if (!propInst[ob.prop]) continue; var sk = beltSink(ob); if (sk && sk.belt === b) return { belt: ob }; }
    for (var mk in MACH) { var mc = MACH[mk]; var pts = machinePoints(mc, 'out'); for (var i = 0; i < pts.length; i++) if (dist2(s.x, s.z, pts[i].x, pts[i].z) < R2) return { machine: mc }; }
    if (propInst.packline) { var sh = propWorld('packline', 0, 7.0); if (dist2(s.x, s.z, sh.x, sh.z) < R2) return { shelf: true }; }
    for (var i2 = 0; i2 < DOOR_MAP.length; i2++) { if (DOOR_MAP[i2].dir !== 'in' || !doors[i2]) continue; var at = doorInside(i2); if (dist2(s.x, s.z, at[0], at[1]) < R2 * 1.5) return { door: i2 }; }
    return null;
  }
  function beltLabel(b) { return propLabel(b.prop); }
  function sinkLabel(sk) { if (!sk) return null; if (sk.belt) return 'the ' + beltLabel(sk.belt); if (sk.slot) return slotName(sk.slot); var mc = sk.machine; return mc.door !== undefined ? 'dock door ' + dockLabel(mc.door) : 'the ' + propLabel(mc.prop); }
  function feederLabel(fd) { if (!fd) return null; if (fd.belt) return 'the ' + beltLabel(fd.belt); if (fd.shelf) return 'the parcel shelf'; if (fd.door !== undefined) return 'dock door ' + dockLabel(fd.door); return 'the ' + propLabel(fd.machine.prop); }
  // ── The dock doors on the registry ──
  // An outbound door with a truck in takes parcels off a belt that ends at it. An inbound door with a signed truck in feeds the
  // boxes off its pallets onto a belt that starts at it, one every second or so. So a run of pieces from a rack bay to OUT 1 is a
  // loading line and a run from IN 2 to a rack bay is an unloading line, with nothing bought but the pieces.
  function doorInside(i) { var d = doors[i]; return d ? [d.side * (HALL.x - 1.2), d.z] : null; }
  for (var dmi = 0; dmi < DOOR_MAP.length; dmi++) (function (i) {
    defMachine('door' + i, { door: i, atFn: function () { return doorInside(i); }, accept: DOOR_MAP[i].dir === 'in' ? null : function (it) {
      if (it.kind !== 'parcel' || !powered()) return false;
      var t = truckAtDoor(i); if (!t || !S.doors[i] || !doorPassable(i)) return false;
      var o = orderById(it.order); if (!o) return true;
      t.parcels.push(o.id); o.state = 'loaded'; sfx('crate'); addXp(XP.ship); rebuildBoardSoon(); S.stats.autoLoaded = (S.stats.autoLoaded || 0) + 1; return true;
    } });
  })(dmi);
  var dockFeedT = {};
  function tickDockFeed(dt) {
    if (!powered()) return;
    for (var i = 0; i < DOOR_MAP.length; i++) {
      if (DOOR_MAP[i].dir !== 'in' || !doors[i]) continue; var t = truckAtDoor(i); if (!t || !t.signed || !S.doors[i] || !doorPassable(i)) continue;
      var at = doorInside(i), fed = null; if (!at) continue;
      for (var k in BELTS) { var b = BELTS[k]; if (!propInst[b.prop] || edit.grabbed === b.prop) continue; var s = beltPoint(b, 0); if (dist2(s.x, s.z, at[0], at[1]) < REACH * REACH * 1.5) { fed = b; break; } }
      if (!fed) continue;
      dockFeedT[i] = (dockFeedT[i] || 0) + dt; if (dockFeedT[i] < 1.2 / speedOf(beltSpeedKey(fed)) || !beltStartFree(fed.id)) continue;
      var p = null; for (var q = 0; q < S.pallets.length; q++) { var pp = S.pallets[q]; if (pp.place === 'truck' && pp.truck === t.id && pp.n > 0 && !(SKU[pp.sku] && SKU[pp.sku].raw)) { p = pp; break; } }
      if (!p) continue;
      if (!beltPush(fed.id, { kind: 'box', sku: p.sku })) continue;   // the box leaves the pallet only once it is on the belt
      if (!p.received) { p.received = true; t.unloaded++; S.stats.received++; pay(ECON.receiveFee, 'Receiving fee, pallet of ' + skuName(p.sku)); addXp(XP.pallet); feedPush('Received a pallet of ' + skuName(p.sku) + ' off the belt · +' + money(ECON.receiveFee), 'good'); }   // the fee is earned when the first box comes off; the pallet stays aboard until it is empty
      p.n--; p.wrapped = false; dockFeedT[i] = 0; S.stats.picked++;
      if (p.n <= 0) { p.n = 0; }
    }
  }
  function machineOutBelt(m) { if (!m.outlet) return null; var w = propWorld(m.prop, m.outlet[0], m.outlet[1]); for (var k in BELTS) { if (!propInst[BELTS[k].prop]) continue; var s = beltPoint(BELTS[k], 0); if (dist2(w.x, w.z, s.x, s.z) < REACH * REACH) return BELTS[k]; } return null; }
  function powered() { return !S.events.power; }
  function tickBelts(dt) {
    for (var k in BELTS) {
      var b = BELTS[k]; if (!propInst[b.prop] || edit.grabbed === b.prop) continue; var items = beltItems(k), L = beltLen(b), sink = beltSink(b);   // a carried piece stands still
      items.sort(function (p, q) { return q.d - p.d; });   // front of the belt first
      var ahead = Infinity;
      for (var i = 0; i < items.length; i++) {
        var it = items[i], max = Math.min(ahead - beltGapOf(it), L);
        if (powered()) it.d = Math.min(it.d + BELT_SPEED * (b.rate || 1) * speedOf(beltSpeedKey(b)) * dt, max);   // rate: the deck belts run three times a floor belt
        if (it.d >= L - 0.001 && sink) {
          var taken = false;
          if (sink.belt) taken = beltPush(sink.belt.id, it); else if (sink.machine && sink.machine.accept) taken = sink.machine.accept(it); else if (sink.slot && it.kind === 'box' && slotSpace(sink.slot, it.sku) > 0) { slotAdd(sink.slot, it.sku, 1); S.stats.putaway++; taken = true; }
          if (taken) { items.splice(i, 1); i--; continue; }
        }
        ahead = it.d;
      }
    }
    BELT_PLANES.forEach(function (pl) { if (!powered()) return; var pk = pl.userData.speedKey || '', ps = PROP_SPEED[pk]; pl.material.map.offset.y += BELT_SPEED * (ps ? ps.rate * speedOf(ps.key) : speedOf(/^pick/.test(pk) ? 'pickBelt' : pk)) * dt / 0.5; });   // stripes run with the items, towards local +z
  }
  // belt items are drawn with the instanced boxes and parcels, inside syncInstances
  function drawBeltItems() {
    for (var k in BELTS) { var b = BELTS[k]; if (!propInst[b.prop]) continue; beltItems(k).forEach(function (it) { var w = beltPoint(b, it.d); var src = { kind: 'belt', belt: k, item: it }; if (it.kind === 'parcel') putParcel(w.x, w.y + 0.23, w.z, w.ry, src, it.form); else if (it.kind === 'pallet') drawPalletWithBoxes(it.sku, it.n, w.x, w.y + 0.02, w.z, w.ry, src); else putBox(it.sku, w.x, w.y + BOX.h / 2, w.z, w.ry, src); }); }
    if (S.pal && S.pal.n > 0 && propInst.palletiser) { var cw = propWorld('palletiser', 0, 0); drawPalletWithBoxes(S.pal.sku, S.pal.n, cw.x, 0.42, cw.z, cw.a, { kind: 'palletiser' }); }
  }
  // a box or a parcel riding a belt can be lifted off by hand
  function beltItemPrompt(src) { if (S.hand) return null; var it = src.item; if (it.kind === 'pallet') return null; if (it.kind === 'box') return 'Take the box of ' + skuName(it.sku) + ' off the belt'; if (it.kind === 'parcel' && it.order) return 'Take the parcel off the belt'; return null; }
  function beltItemUse(src) { if (S.hand) return; var arr = beltItems(src.belt), i = arr.indexOf(src.item); if (i < 0) return; var it = arr[i]; if (it.kind === 'box') handSet({ kind: 'box', sku: it.sku }); else if (it.kind === 'parcel' && it.order) handSet({ kind: 'parcel', order: it.order }); else return; arr.splice(i, 1); sfx('pickup'); }
  function lampSet(m, status) { if (!m.lamps) return; m.lamps.g.visible = status === 'run'; m.lamps.a.visible = status === 'idle'; m.lamps.r.visible = status === 'jam' || status === 'off'; }

  // ── The pack line: the bench feeds boxes onto the infeed, the case taper closes the order into one parcel, the outfeed drops it on the shelf
  defBelt('packIn', { prop: 'packline', path: [[0, 0], [0, 2.0]] });
  defBelt('packOut', { prop: 'packline', path: [[0, 3.8], [0, 5.8]], noSink: true });   // its parcels drop onto the shelf, never onto a belt laid at the shelf
  defMachine('taper', { prop: 'packline', inlet: [0, 2.0], outlet: [0, 3.8],
    accept: function (it) { var j = S.pack.job; if (!j || it.kind !== 'box' || !powered() || S.pack.jam) return false; j.inMach++; sfx('click'); return true; } });
  function packStatus() { if (!powered()) return 'off'; if (S.pack.jam) return 'jam'; return S.pack.job ? 'run' : 'idle'; }
  function packOrder(o) {
    if (o.state !== 'open') return false;
    var n = orderNeed(o); if (n.have < Math.ceil(n.tot / 2)) return false;
    var boxes = []; o.lines.forEach(function (l) { l.packed = benchTake(l.sku, l.qty); for (var i = 0; i < l.packed; i++) boxes.push(l.sku); });
    o.short = n.have < n.tot; o.state = 'packing'; S.pack.queue.push({ order: o.id, boxes: boxes, fed: 0, inMach: 0, t: 0 });
    sfx('click'); rebuildBoardSoon(); logEvent('Order #' + o.num + ' released to the pack line' + (o.short ? ' (short)' : ''));
    return true;
  }
  function packFinish(oid) {
    var o = orderById(oid); if (!o) return;
    o.state = 'packed'; o.packedAt = nowAbs(); S.bench.parcels.push(o.id); S.pack.made++;
    S.stats.packed++; addXp(XP.pack); sfx('tape'); addWaste(1); rebuildBoardSoon(); introStep('pack'); logEvent('Packed order #' + o.num + (o.short ? ' (short)' : ''), 'good');
  }
  function tickPack(dt) {
    if (!S.pack) S.pack = { queue: [], job: null, jam: false, made: 0, feedT: 0, out: null };
    var P = S.pack;
    // the automation suite: with the line idle, any order the bench can complete is started by itself every couple of seconds
    if (S.up.plantAuto && P.auto !== false && powered() && !P.job && !P.queue.length && !P.jam && !P.out) { P.autoT = (P.autoT || 0) + dt; if (P.autoT > 2) { P.autoT = 0; var ao = openOrders().filter(canPack).sort(function (a, b) { return (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b.due; })[0]; if (ao && packOrder(ao)) toast('Pack line started #' + ao.num + ' by itself', ''); } }
    if (!P.job && P.queue.length) P.job = P.queue.shift();
    var j = P.job;
    if (j && !orderById(j.order)) { P.job = null; return; }
    if (powered() && !P.jam && j) {
      // feed the next box onto the infeed every 1.3 s
      P.feedT += dt; if (j.fed < j.boxes.length && P.feedT >= 1.3 && beltPush('packIn', { kind: 'box', sku: j.boxes[j.fed] })) { j.fed++; P.feedT = 0; }
      // every box in: the taper runs 3 s, then a parcel comes out on the outfeed
      if (j.inMach >= j.boxes.length) { j.t += dt * speedOf('packline'); if (j.t >= 3 && !P.out) { if (Math.random() < 0.05 * speedOf('packline') * (S.up.plantAuto ? 0 : S.up.plantTune ? 0.5 : 1)) { P.jam = true; toast('The pack line has jammed. Press E on it to clear it.', 'bad'); sfx('bad'); return; } P.out = j.order; sfx('hydraulic'); P.job = null; } }
    }
    if (P.out && powered() && !P.jam && beltPush('packOut', { kind: 'parcel', order: P.out })) P.out = null;
    // the outfeed end: the parcel drops onto the shelf when there is room
    var outs = beltItems('packOut'), L = beltLen(BELTS.packOut);
    for (var i = outs.length - 1; i >= 0; i--) { if (outs[i].d >= L - 0.001 && S.bench.parcels.length < 12) { packFinish(outs[i].order); outs.splice(i, 1); } }
    lampSet(MACH.taper, packStatus());
  }
  function packPrompt() { if (S.pack.jam) return 'Clear the jam on the pack line'; if (!powered()) return 'Pack line · no power'; var j = S.pack.job; return 'Pack line · ' + (j ? 'packing order #' + (orderById(j.order) || { num: '?' }).num + ' · ' + j.inMach + '/' + j.boxes.length : S.pack.queue.length ? S.pack.queue.length + ' waiting' : 'idle') + ' · ' + S.pack.made + ' parcels made'; }
  function packUse() { if (S.pack.jam) { S.pack.jam = false; sfx('hydraulic'); toast('Jam cleared', 'good'); addXp(2); screenDirtyAll(); return; } openPanel('bench'); }
  function packScreenDraw(c, sc) {
    var st = packStatus(); scBg(c, sc.w, sc.h, st === 'jam' ? 'rgba(255,107,94,0.25)' : 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'CASE TAPER', st.toUpperCase());
    var j = S.pack.job, o = j ? orderById(j.order) : null;
    scText(c, 16, 70, o ? 'Order #' + o.num + ' · ' + clientName(o.client) : 'No job', '#eef1f5', 16);
    scText(c, 16, 94, j ? 'Boxes in: ' + j.inMach + ' / ' + j.boxes.length + (j.inMach >= j.boxes.length ? ' · taping ' + Math.max(0, 3 - j.t).toFixed(1) + ' s' : '') : S.pack.queue.length + ' in the queue', '#a0acb8', 13);
    scText(c, 16, 118, 'Parcels made: ' + S.pack.made + ' · shelf ' + S.bench.parcels.length + '/8', '#a0acb8', 13);
    if (S.pack.jam) scButton(sc, 16, 140, 150, 34, 'CLEAR JAM', true, function () { packUse(); }, '#ff6b5e');
    speedButton(sc, 176, 142, 108, 'packline'); if (speedOf('packline') > 1) scText(c, 176, 188, 'fast: jams more', '#ff6b5e', 10);
  }

  // ── The moulding line: raw granulate from the hopper becomes own-brand boxes on the outfeed
  var FACTORY_RATE = 8;   // seconds per box
  function ownSkus() { return SKUS.filter(function (s) { return s.own; }); }
  defMachine('moulder', { prop: 'moulder', outlet: [0, 2.4] });
  defBelt('moulderOut', { prop: 'moulder', path: [[0, 2.4], [0, 4.4]] });
  defBelt('beltMain', { prop: 'beltMain', path: [[0, 0], [0, 11.2]] });   // from the wing through the north wall to the palletiser
  function factoryStatus() { var F = S.factory; if (!powered()) return 'off'; if (F.jam) return 'jam'; return F.on && F.raw > 0 ? 'run' : 'idle'; }
  function tickFactory(dt) {
    var F = S.factory; if (!F) return;
    if (!propInst.moulder) return;
    if (powered() && F.on && !F.jam && F.raw > 0) {
      F.t += dt * speedOf('moulder');
      if (F.t >= FACTORY_RATE) { if (beltPush('moulderOut', { kind: 'box', sku: F.product })) { F.t = 0; F.raw--; F.made++; S.stats.made = (S.stats.made || 0) + 1; if (S.seenSkus.indexOf(F.product) < 0) S.seenSkus.push(F.product); if (Math.random() < 0.02) { F.jam = true; toast('The moulding line has jammed. Press E on it to clear it.', 'bad'); sfx('bad'); } } }
      if (F.raw <= 0) { F.on = false; toast('The hopper is empty: the moulding line stopped.', 'bad'); screenDirtyAll(); }
    }
    if (MACH.moulder.anim) { var a = MACH.moulder.anim, run = factoryStatus() === 'run'; var open = run ? 0.5 + 0.5 * Math.cos(F.t / FACTORY_RATE * Math.PI * 2) : 1; a.ram.position.z = 1.0 + 0.45 * open; a.wheel.rotation.x += (run ? 9 : 0) * dt; a.spin.rotation.y += (run ? 6 : 0) * dt; }
    lampSet(MACH.moulder, factoryStatus());
  }
  function moulderPrompt() { var F = S.factory; if (F.jam) return 'Clear the jam on the moulding line'; return 'Moulding line · ' + (F.on ? 'running' : 'stopped') + ' · ' + skuName(F.product) + ' · hopper ' + F.raw + ' · made ' + F.made; }
  function moulderUse() { var F = S.factory; if (F.jam) { F.jam = false; sfx('hydraulic'); toast('Jam cleared', 'good'); addXp(2); screenDirtyAll(); return; } if (!powered()) { toast('No power.', 'bad'); return; } F.on = !F.on; sfx('click'); if (F.on && F.raw <= 0) { F.on = false; toast('The hopper is empty. Tip a pallet of raw granulate in first.', 'bad'); } screenDirtyAll(); }
  function moulderScreenDraw(c, sc) {
    var F = S.factory, st = factoryStatus(); scBg(c, sc.w, sc.h, st === 'jam' ? 'rgba(255,107,94,0.25)' : 'rgba(120,189,245,0.18)'); scHead(c, sc.w, 'MOULDING LINE', st.toUpperCase());
    scText(c, 16, 66, 'Hopper ' + F.raw + ' units · ' + (F.raw ? Math.floor(F.raw) + ' boxes left' : 'EMPTY'), F.raw ? '#eef1f5' : '#ff6b5e', 14);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, 76, sc.w - 32, 10); c.fillStyle = F.raw > 40 ? '#5fd38d' : '#f5b53d'; c.fillRect(16, 76, (sc.w - 32) * clamp(F.raw / 400, 0, 1), 10);
    scText(c, 16, 108, 'Product', '#6b7784', 11);
    ownSkus().forEach(function (s, i) { scButton(sc, 16 + i * 124, 116, 118, 30, s.name.replace('Depot Co. ', ''), F.product === s.id, function () { F.product = s.id; sfx('click'); }, '#78bdf5'); });
    scButton(sc, 16, 160, 110, 34, F.on ? 'STOP' : 'START', F.on, function () { moulderUse(); }, F.on ? '#ff6b5e' : '#5fd38d');
    if (F.jam) scButton(sc, 136, 160, 120, 34, 'CLEAR JAM', true, function () { moulderUse(); }, '#ff6b5e');
    speedButton(sc, 270, 162, 110, 'moulder');
    scText(c, 16, 220, 'Made ' + F.made + ' · ' + (FACTORY_RATE / speedOf('moulder')).toFixed(0) + ' s a box · one unit of granulate each · the dial also drives its belt', '#a0acb8', 12);
    scText(c, 16, 240, 'Boxes go down the belt to the palletiser in the hall.', '#6b7784', 11);
  }

  // ── The hopper: a pallet of raw granulate on the jack or the forks tips into it
  var RAW_PER_SACK = 5, HOPPER_CAP = 400;
  defMachine('hopper', { prop: 'hopper' });
  function rawPalletInHand() { var p = isJack(player.tool) ? jackPallet() : driving ? forkPallet() : null; return p && p.sku === 'raw' ? p : null; }
  function hopperPrompt() { var p = rawPalletInHand(); if (p) return S.factory.raw >= HOPPER_CAP ? 'The hopper is full' : 'Tip the granulate into the hopper (+' + p.n * RAW_PER_SACK + ')'; return 'Raw hopper · ' + S.factory.raw + ' / ' + HOPPER_CAP + ' units' + (isJack(player.tool) || driving ? ' · bring a pallet of raw granulate' : ''); }
  function hopperUse() {
    var p = rawPalletInHand(); if (!p) { sfx('bad'); return; } if (S.factory.raw >= HOPPER_CAP) { toast('The hopper is full.', 'bad'); return; }
    S.factory.raw = Math.min(HOPPER_CAP, S.factory.raw + p.n * RAW_PER_SACK);
    for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === p.id) { S.pallets.splice(i, 1); break; }
    if (S.jack.pallet === p.id) S.jack.pallet = null; if (S.jack2 && S.jack2.pallet === p.id) S.jack2.pallet = null; if (S.fork.pallet === p.id) S.fork.pallet = null;
    S.pallets.push(newPalletObj('empty')); sfx('hydraulic'); addXp(4); toast('Granulate tipped in: hopper at ' + S.factory.raw, 'good'); logEvent('Tipped a pallet of raw granulate into the hopper'); screenDirtyAll(); hudDirty = true;
    if (MACH.hopper.anim) MACH.hopper.anim.tipT = 1.5;
  }
  // the tipped pallet comes back empty: it lands beside the hopper as an empty pallet the jack can take away
  function newPalletObj(kind) { var w = propWorld('hopper', 1.8, 0.4); var p = { id: uid('pl'), sku: 'raw', n: 0, place: 'floor', x: w.x, y: 0, z: w.z, rot: w.a }; return p; }
  function hopperScreenDraw(c, sc) { var F = S.factory; scBg(c, sc.w, sc.h, 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'HOPPER', F.raw + ' / ' + HOPPER_CAP); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(20, 50, 40, 100); c.fillStyle = '#f5b53d'; var hh = 100 * clamp(F.raw / HOPPER_CAP, 0, 1); c.fillRect(20, 150 - hh, 40, hh); scText(c, 76, 80, 'Raw granulate', '#eef1f5', 14); scText(c, 76, 102, 'A pallet of 8 sacks is ' + 8 * RAW_PER_SACK + ' units.', '#a0acb8', 11); scText(c, 76, 120, 'Order pallets on the office PC.', '#a0acb8', 11); }

  // ── The palletiser: boxes off the main belt stack on a pallet; eight boxes, or a change of product, ejects it to the floor
  defMachine('palletiser', { prop: 'palletiser', inlet: [0, -1.6],
    accept: function (it) { if (it.kind !== 'box' || !powered()) return false; var P = S.pal; if (P.n > 0 && P.sku !== it.sku) { palletiserEject(); } if (P.n >= 8) return false; P.sku = it.sku; P.n++; sfx('click'); if (P.n >= 8) palletiserEject(); return true; } });
  function palletiserEject() {
    var P = S.pal; if (!P.n) return; var w = propWorld('palletiser', 2.2, 0);
    newPallet(P.sku, P.n, { place: 'floor', x: w.x, z: w.z, rot: w.a, y: 0 }); if (S.seenSkus.indexOf(P.sku) < 0) S.seenSkus.push(P.sku); S.stats.palletised = (S.stats.palletised || 0) + 1;
    logEvent('The palletiser finished a pallet of ' + P.n + ' × ' + skuName(P.sku), 'good'); sfx('hydraulic'); addXp(6); P.sku = null; P.n = 0; screenDirtyAll();
  }
  function palletiserPrompt() { var P = S.pal; return 'Palletiser · ' + (P.n ? P.n + ' × ' + skuName(P.sku) + ' on the pallet · E ejects it' : 'waiting for boxes'); }
  function palletiserUse() { if (S.pal.n) palletiserEject(); else sfx('bad'); }
  function palletiserScreenDraw(c, sc) { var P = S.pal; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'PALLETISER', powered() ? (P.n ? 'STACKING' : 'READY') : 'OFF'); scText(c, 16, 70, P.n ? P.n + ' / 8 · ' + skuName(P.sku) : 'Empty pallet in the cradle', '#eef1f5', 16); for (var i = 0; i < 8; i++) { c.fillStyle = i < P.n ? '#5fd38d' : 'rgba(255,255,255,0.1)'; c.fillRect(16 + i * 30, 86, 24, 24); } speedButton(sc, 148, 125, 136, 'beltMain', 'BELT'); scButton(sc, 16, 124, 120, 32, 'EJECT', P.n > 0, function () { palletiserUse(); }); scText(c, 16, 180, 'Pallets made: ' + (S.stats.palletised || 0), '#a0acb8', 12); lampSet(MACH.palletiser, powered() ? (P.n ? 'run' : 'idle') : 'off'); }

  // ── The baler: cardboard from binned boxes and packing offcuts fills the chamber; ten units make a bale; outbound trucks take the bales away for cash
  var BALE_NEED = 10, BALE_PRICE = 18;
  defMachine('baler', { prop: 'baler' });
  function balerStatus() { if (!powered()) return 'off'; return S.baler.t > 0 ? 'run' : 'idle'; }
  function addWaste(n) { if (!S.baler) S.baler = { card: 0, bales: 0, t: 0, made: 0 }; S.baler.card += n; screenDirtyAll(); }
  function balerPrompt() { var B = S.baler; if (B.t > 0) return 'Baling… ' + Math.ceil(B.t) + ' s'; if (!powered()) return 'Baler · no power'; return 'Baler · ' + B.card + ' / ' + BALE_NEED + ' cardboard in the chamber' + (B.card >= BALE_NEED ? ' · E makes a bale' : '') + (B.bales ? ' · ' + B.bales + ' bale' + (B.bales > 1 ? 's' : '') + ' waiting for a truck' : ''); }
  function balerUse() { var B = S.baler; if (B.t > 0 || !powered()) { sfx('bad'); return; } if (B.card < BALE_NEED) { toast('Not enough cardboard yet: ' + B.card + ' of ' + BALE_NEED + '. Binned boxes and packing offcuts fill it.', ''); sfx('bad'); return; } B.t = 8; B.card -= BALE_NEED; sfx('hydraulic'); addXp(3); screenDirtyAll(); }
  function tickBaler(dt) {
    if (!S.baler) S.baler = { card: 0, bales: 0, t: 0, made: 0 }; var B = S.baler;
    if (B.t > 0 && powered()) { B.t -= dt * speedOf('baler'); if (B.t <= 0) { B.t = 0; B.bales++; B.made++; sfx('crate'); toast('Bale made. Outbound trucks take them away at ' + money(BALE_PRICE) + ' each.', 'good'); logEvent('The baler made a bale of cardboard'); screenDirtyAll(); } }
    var a = MACH.baler.anim; if (a) { a.ram.position.y = 3.6 - (B.t > 0 ? Math.abs(Math.sin((8 - B.t) / 8 * Math.PI * 2)) * 0.5 : 0); a.bales.forEach(function (bg, i) { bg.visible = i < B.bales; }); }
    lampSet(MACH.baler, balerStatus());
  }
  function balerScreenDraw(c, sc) { var B = S.baler; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'BALER', balerStatus().toUpperCase()); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, 46, sc.w - 32, 12); c.fillStyle = B.card >= BALE_NEED ? '#5fd38d' : '#f5b53d'; c.fillRect(16, 46, (sc.w - 32) * clamp(B.card / BALE_NEED, 0, 1), 12); scText(c, 16, 80, 'Chamber ' + B.card + ' / ' + BALE_NEED, '#eef1f5', 14); scText(c, 16, 100, 'Bales waiting ' + B.bales + ' · made ' + B.made, '#a0acb8', 12); speedButton(sc, 134, 117, 90, 'baler'); scButton(sc, 16, 116, 110, 32, B.t > 0 ? Math.ceil(B.t) + ' s' : 'BALE', B.card >= BALE_NEED && !B.t, function () { balerUse(); }); scText(c, 16, 162, 'Trucks pay ' + money(BALE_PRICE) + ' a bale', '#6b7784', 11); }
  // the bales leave with every outbound truck
  function sellBales(t) { var B = S.baler; if (!B || !B.bales || t.dir !== 'out') return; var n = Math.min(4, B.bales); B.bales -= n; pay(n * BALE_PRICE, 'Cardboard bales collected, ' + n); logEvent(t.driver + ' took ' + n + ' bale' + (n > 1 ? 's' : '') + ' of cardboard: ' + money(n * BALE_PRICE), 'good'); screenDirtyAll(); }

  // ── The wrapper on the registry: status lamps, a screen, and a film roll that runs out
  var FILM_ROLL = 20, FILM_PRICE = 30;
  defMachine('wrapper', { prop: 'wrapper' });
  function wrapperStatus() { if (!powered()) return 'off'; if (!S.wrap || S.wrap.film <= 0) return 'jam'; return wrapperBusy() ? 'run' : 'idle'; }
  function wrapperScreenDraw(c, sc) { var W2 = S.wrap; scBg(c, sc.w, sc.h, 'rgba(120,189,245,0.18)'); scHead(c, sc.w, 'STRETCH WRAP', wrapperStatus().toUpperCase()); scText(c, 16, 70, wrapperBusy() ? 'Wrapping… ' + Math.ceil(wrapper.t) + ' s' : 'Bring a pallet on the jack', '#eef1f5', 14); scText(c, 16, 92, 'Film left: ' + W2.film + ' pallets · wrapped ' + W2.wrapped, W2.film > 3 ? '#a0acb8' : '#ff6b5e', 12); speedButton(sc, 172, 111, 56, 'wrapper'); scButton(sc, 16, 110, 150, 32, 'NEW ROLL $' + FILM_PRICE, W2.film < FILM_ROLL && S.bank >= FILM_PRICE, function () { if (S.bank < FILM_PRICE) { sfx('bad'); return; } pay(-FILM_PRICE, 'Stretch film roll'); W2.film = FILM_ROLL; sfx('click'); toast('New film roll fitted', 'good'); }); }

  function tickMachines(dt) {
    if (!S.wrap) S.wrap = { film: FILM_ROLL, wrapped: 0 };
    tickBaler(dt); lampSet(MACH.wrapper, wrapperStatus()); tickAutomation(dt);
    if (!S.pack) S.pack = { queue: [], job: null, jam: false, made: 0, feedT: 0, out: null };
    if (!S.factory) S.factory = { raw: 0, product: 'dccrate', on: false, made: 0, rawOrdered: 0, t: 0, jam: false };
    if (!S.pal) S.pal = { sku: null, n: 0 };
    tickBelts(dt); tickDockFeed(dt); tickPack(dt); tickFactory(dt); tickLift(dt); tickSorter(dt);
    if (MACH.hopper.anim && MACH.hopper.anim.tipT > 0) { var h = MACH.hopper.anim; h.tipT -= dt; h.feeder.position.x = Math.sin(worldTime * 40) * 0.01 * (h.tipT > 0 ? 1 : 0); }
    lampSet(MACH.palletiser, powered() ? (S.pal.n ? 'run' : 'idle') : 'off');
    if (world.wingLights) world.wingLights.forEach(function (l) { l.intensity = powered() ? 0.9 : 0; });
  }
  // ── The shipping belt and the dock loader ─────────────────────────
  // With the upgrade, parcels roll off the gravity shelf onto a belt that runs down the east wall to OUT 1, where the dock loader's
  // boom pushes them into the trailer whenever a truck is docked with the door up. Nothing loads otherwise; the parcels queue on the belt.
  // the run past OUT 2 climbs 2.2 m so the dock apron under it stays clear for people and the forklift
  // the shelf feeds the shipping belt, which runs down the east wall to the dock loader at OUT 2; OUT 1 stays a manual dock
  defBelt('shipBelt', { prop: 'shipBelt', path: [[0, 0], [0, 0.5], [2.6, 0.5], [2.6, -15.3], [0.4, -15.3], [0.4, -17.1]] });   // down the east wall, then in to the west face of the OUT 2 shipping bay (the build function carries the same path)
  // one loader a lane: OUT 2's comes with the shipping belt, OUT 1's and OUT 3's with the sortation deck (LOADER_DOORS is in the sorter part)
  function loaderAccept(id, door) { return function (it) {
    if (it.kind !== 'parcel' || !powered()) return false;
    var t = truckAtDoor(door), o = orderById(it.order); if (!o) return true;
    if (!t || !S.doors[door] || !doorPassable(door)) return stagePush(id, o.id);   // no truck at the door: the loader stages the parcel beside itself for the next one
    t.parcels.push(o.id); o.state = 'loaded'; laneWarn(o, t); sfx('crate'); addXp(XP.ship); rebuildBoardSoon(); S.stats.autoLoaded = (S.stats.autoLoaded || 0) + 1;
    if (MACH[id].anim) MACH[id].anim.pushT = 1.2;
    return true;
  }; }
  // the loaders take from their shipping bays (tickStaging in the sorter part); nothing feeds a loader straight off a belt any more
  defMachine('dockLoader1', { prop: 'dockLoader1' });
  defMachine('dockLoader2', { prop: 'dockLoader2' });
  defMachine('dockLoader3', { prop: 'dockLoader3' });
  function dockLoaderStatus(door) { if (!powered()) return 'off'; var t = truckAtDoor(door); return t && S.doors[door] ? 'run' : 'idle'; }
  function dockLoaderPrompt(door) { var t = truckAtDoor(door); return 'Dock loader ' + dockLabel(door) + ' · ' + (!powered() ? 'no power' : t && S.doors[door] ? 'loading, ' + t.parcels.length + ' aboard' : t ? 'open the door and it loads' : 'waiting for a truck at ' + dockLabel(door)) + ' · ' + (S.stats.autoLoaded || 0) + ' loaded by machine so far'; }
  function tickShipping(dt) {
    // a parcel on the shelf rolls onto whatever belt starts at the shelf's take-off: the shipping belt, or a piece laid there
    if (powered() && S.bench.parcels.length && propInst.packline) { var sp = propWorld('packline', 0, 7.0); for (var k in BELTS) { var b = BELTS[k]; if (!propInst[b.prop] || edit.grabbed === b.prop) continue; var s = beltPoint(b, 0); if (dist2(s.x, s.z, sp.x, sp.z) < REACH * REACH && beltStartFree(k)) { if (beltPush(k, { kind: 'parcel', order: S.bench.parcels[0] })) S.bench.parcels.shift(); break; } } }   /* the parcel leaves the shelf only once it is on the belt */
    for (var lid in LOADER_DOORS) { if (!propInst[lid]) continue; var M = MACH[lid], door = LOADER_DOORS[lid]; if (M.lamps) lampSet(M, dockLoaderStatus(door)); var a = M.anim; if (a) { if (a.pushT > 0) a.pushT -= dt; var t = truckAtDoor(door), out = t && S.doors[door] ? 1 : 0; a.ext = lerp(a.ext || 0, out, Math.min(1, dt * 1.5)); a.boom.position.x = 0.9 + a.ext * 1.6; a.boom.scale.x = 0.6 + a.ext * 1.0; a.pusher.position.x = (a.pushT > 0 ? Math.sin(a.pushT / 1.2 * Math.PI) * 0.5 : 0); } }
    tickStaging(dt);
  }

  // ── The AGV ───────────────────────────────────────────────────────
  // A pallet set down on the AGV pickup square, or dropped by the palletiser, is collected by the truck, taken to a free rack slot
  // and put away, and the truck returns to its dock. It follows the staff grid, so it goes round things.
  var AGV_SPEED = 1.3;
  var agvMesh = null;
  function agvState() { if (!S.agv) S.agv = { x: 0, z: 0, yaw: 0, state: 'idle', pallet: null, path: [], placed: false }; return S.agv; }
  function agvDockWorld() { return propInst.agvDock ? propWorld('agvDock', 0, 0) : null; }
  function agvPickupWorld() { return propInst.agvDock ? propWorld('agvDock', 0, 2.6) : null; }
  function agvCandidate() {
    var pu = agvPickupWorld(), pal = propInst.palletiser ? propWorld('palletiser', 2.2, 0) : null, best = null, bd = 1e9;
    var A = agvState();
    S.pallets.forEach(function (p) { if (p.place !== 'floor' || p.n <= 0) return; var d = 1e9; if (pu) d = Math.min(d, dist2(p.x, p.z, pu.x, pu.z)); if (pal) d = Math.min(d, dist2(p.x, p.z, pal.x, pal.z)); var want = d < 1.6 * 1.6;
      // the floor sweep: any pallet on the hall floor, ranked after the square, clear of you and of anything the crew has claimed
      if (!want && S.up.agvSweep && insideHall(p.x, p.z) && dist2(p.x, p.z, player.x, player.z) > 9 && !S.staff.some(function (o) { return o.task && o.task.pallet === p.id; })) { d = 10 + dist2(p.x, p.z, A.x, A.z); want = true; }
      if (want && d < bd) { bd = d; best = p; } });
    return best;
  }
  function agvGo(to, state) { var A = agvState(); A.path = route({ x: A.x, z: A.z }, to); A.state = state; }
  function agvWalk(dt) {
    var A = agvState(); if (!A.path.length) return true;
    var t = A.path[0], dx = t.x - A.x, dz = t.z - A.z, d = Math.sqrt(dx * dx + dz * dz), sp = (S.up.agvFast ? 2.2 : AGV_SPEED) * speedOf('agv') * dt;
    if (d <= sp) { A.x = t.x; A.z = t.z; A.path.shift(); return !A.path.length; }
    A.x += dx / d * sp; A.z += dz / d * sp;
    var want = Math.atan2(dx, dz), diff = want - A.yaw; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI; A.yaw += diff * Math.min(1, 6 * dt);
    return false;
  }
  function tickAgv(dt) {
    if (!S.up.agv || !propInst.agvDock) { if (agvMesh) agvMesh.visible = false; return; }
    var A = agvState(), dock = agvDockWorld();
    if (!A.placed && dock) { A.x = dock.x; A.z = dock.z; A.yaw = dock.a; A.placed = true; }
    if (!powered()) { if (agvMesh) agvMesh.visible = true; return; }
    if (agvShown !== A.state + (A.paused ? 'p' : '')) { agvShown = A.state + (A.paused ? 'p' : ''); if (agvScreen) agvScreen.dirty = true; }
    if (A.state === 'idle') { var p = A.paused ? null : agvCandidate(); if (!p && dock && dist2(A.x, A.z, dock.x, dock.z) > 0.3) { agvGo(dock, 'return'); } else if (p) { A.target = p.id; var ddx = p.x - A.x, ddz = p.z - A.z, dl = Math.hypot(ddx, ddz) || 1; agvGo({ x: p.x - ddx / dl * 1.15, z: p.z - ddz / dl * 1.15 }, 'toPickup'); } }   // stop a fork's length short, so the forks go under the pallet
    else if (A.state === 'toPickup') { var tp = palletById(A.target); if (!tp || tp.place !== 'floor') { A.state = 'idle'; A.target = null; } else if (agvWalk(dt)) { A.yaw = Math.atan2(tp.x - A.x, tp.z - A.z); tp.place = 'agv'; A.pallet = tp.id; sfx('jack'); var key = findSlotFor(tp.sku, tp.n, 1); if (key) { A.key = key; agvGo(slotStand(key), 'toSlot'); } else { tp.place = 'floor'; tp.x = A.x; tp.z = A.z; A.pallet = null; toast('The AGV found no rack space for ' + skuName(tp.sku), 'bad'); agvGo(dock, 'return'); } } }
    else if (A.state === 'toSlot') { if (agvWalk(dt)) { var cp = palletById(A.pallet); if (cp) { if (!storePallet(cp, A.key)) { var k2 = findSlotFor(cp.sku, cp.n, 1); if (!k2 || !storePallet(cp, k2)) { cp.place = 'floor'; cp.x = A.x + Math.sin(A.yaw) * 1.2; cp.z = A.z + Math.cos(A.yaw) * 1.2; cp.y = 0; cp.rot = A.yaw; } } else { S.stats.agvPutaway = (S.stats.agvPutaway || 0) + 1; sfx('crate'); } } A.pallet = null; A.state = 'idle'; } }   // idle looks for the next pallet first and only returns to the dock when there is none
    else if (A.state === 'return') { if (!A.paused && agvCandidate()) A.state = 'idle'; else if (agvWalk(dt)) { A.state = 'idle'; if (dock) A.yaw = dock.a; } }   // a pallet appearing on the way home turns it round
    if (agvMesh) { agvMesh.visible = true; agvMesh.position.set(A.x, 0, A.z); agvMesh.rotation.y = A.yaw; var busy = A.state !== 'idle'; agvMesh.userData.beacon.visible = busy; agvMesh.userData.beacon.material.emissiveIntensity = 1.2 + Math.sin(worldTime * 9) * 1.1; agvMesh.userData.forks.position.y = lerp(agvMesh.userData.forks.position.y, A.pallet ? 0.22 : 0.06, Math.min(1, dt * 3)); agvMesh.userData.strip.material.emissiveIntensity = busy ? 1.4 : 0.4; }
  }
  var agvScreen = null, agvShown = '';
  function agvScreenDraw(c, sc) {
    var A = agvState(), st = !powered() ? 'off' : A.paused && A.state === 'idle' ? 'paused' : A.state === 'idle' ? 'ready' : 'running', tp = A.pallet ? palletById(A.pallet) : null;
    scBg(c, sc.w, sc.h, st === 'running' ? 'rgba(95,211,141,0.18)' : st === 'paused' || st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'AGV-1', st.toUpperCase());
    scText(c, 16, 70, A.state === 'idle' ? (A.paused ? 'Held at the dock' : 'Watching the pickup square') : A.state === 'toPickup' ? 'Fetching a pallet' : A.state === 'toSlot' ? 'Putting away' + (A.key ? ' to ' + slotName(A.key) : '') : 'Returning to the dock', '#eef1f5', 16);
    scText(c, 16, 94, tp ? 'Load: ' + tp.n + ' x ' + skuName(tp.sku) : 'Forks empty', '#a0acb8', 13);
    scText(c, 16, 118, 'Put away: ' + (S.stats.agvPutaway || 0) + ' pallets · at ' + A.x.toFixed(1) + ', ' + A.z.toFixed(1), '#a0acb8', 13);
    scText(c, 16, 136, 'Pickup: set a pallet on the square, or let the palletiser drop one', '#6b7784', 11);
    speedButton(sc, 208, 152, 76, 'agv');
    scButton(sc, 16, 150, 80, 34, A.paused ? 'RESUME' : 'PAUSE', !A.paused, function () { A.paused = !A.paused; toast('AGV-1 ' + (A.paused ? 'will hold at the dock after this run' : 'running'), A.paused ? 'bad' : 'good'); }, A.paused ? '#5fd38d' : '#f5b53d');
    scButton(sc, 102, 150, 100, 34, 'DROP LOAD', !!tp, function () { var q = A.pallet ? palletById(A.pallet) : null; if (!q) return; q.place = 'floor'; q.x = A.x + Math.sin(A.yaw) * 0.6; q.z = A.z + Math.cos(A.yaw) * 0.6; q.y = 0; q.rot = A.yaw; A.pallet = null; A.key = null; var dk = agvDockWorld(); if (dk) agvGo(dk, 'return'); sfx('putdown'); toast('AGV-1 set its pallet down', ''); }, '#ff6b5e');
  }
  function agvPrompt() { var A = agvState(); return 'AGV-1 · ' + (!powered() ? 'no power' : A.state === 'idle' ? 'waiting at its dock' : A.state === 'toPickup' ? 'fetching a pallet' : A.state === 'toSlot' ? 'putting a pallet away' : 'returning') + ' · ' + (S.stats.agvPutaway || 0) + ' pallets put away'; }
  function buildAgv() {
    var g = new THREE.Group(); g.userData.dynamic = true; g.visible = false; scene.add(g); agvMesh = g;
    var OR = new THREE.MeshPhysicalMaterial({ color: 0xe8701a, roughness: 0.4, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }), DG = std({ color: 0x2a2f36, roughness: 0.6, metalness: 0.5 });
    var body = new THREE.Mesh(bevelGeo(0.95, 0.42, 1.5, 0.05), OR); body.position.set(0, 0.33, -0.1); body.castShadow = true; g.add(body);
    box(0.97, 0.08, 1.52, MAT.black, 0, 0.14, -0.1, g); box(0.6, 0.06, 0.08, MAT.black, 0, 0.3, 0.68, g); box(0.6, 0.06, 0.08, MAT.black, 0, 0.3, -0.88, g);
    [[-0.38, 0.45], [0.38, 0.45], [-0.38, -0.65], [0.38, -0.65]].forEach(function (w) { var wh = cyl(0.12, 0.08, MAT.rubber, w[0], 0.12, w[1], g, 14); wh.rotation.z = Math.PI / 2; });
    var strip = box(0.98, 0.03, 1.3, glowMat(0x3fa7ff, 0.6), 0, 0.52, -0.1, g); g.userData.strip = strip;
    cyl(0.1, 0.1, MAT.black, 0, 0.6, 0.55, g, 14); cyl(0.07, 0.06, glowMat(0x1a1a1a, 0.2), 0, 0.68, 0.55, g, 12); box(0.3, 0.12, 0.2, DG, 0, 0.6, -0.5, g); plane(0.26, 0.09, MAT.screen, 0, 0.6, -0.39, 0, 0, g);
    var beacon = cyl(0.05, 0.12, glowMat(0xffd060, 2.5), 0, 0.72, -0.5, g, 10); g.userData.beacon = beacon; cyl(0.055, 0.02, MAT.black, 0, 0.79, -0.5, g, 10);
    var forks = new THREE.Group(); forks.position.set(0, 0.06, 0); g.add(forks); g.userData.forks = forks; box(0.6, 0.5, 0.08, DG, 0, 0.3, 0.72, forks); [-0.22, 0.22].forEach(function (fx) { box(0.1, 0.04, 1.2, DG, fx, 0.02, 1.35, forks); });
    sign(['AGV-1'], 0.5, 0.14, 0.49, 0.36, -0.1, Math.PI / 2, { w: 256, h: 72, bg: '#1b232c', fg: '#f5b53d' }, g); sign(['AGV-1'], 0.5, 0.14, -0.49, 0.36, -0.1, -Math.PI / 2, { w: 256, h: 72, bg: '#1b232c', fg: '#f5b53d' }, g);
    hitBox(1.0, 0.8, 1.6, 0, 0.4, -0.1, { prompt: function () { return agvPrompt(); }, use: function () { sfx('click'); } }, g);
    groundBlob(1.0, 1.6, 0, -0.1, g, 0);
  }
  function tickAutomation(dt) { tickShipping(dt); tickAgv(dt); tickGantry(dt); }
  // ── The gantry pickers ────────────────────────────────────────────
  // Every rack row carries its own crane: two rails run the length of the row and a trolley with a telescoping mast and a gripper
  // rides them. Each crane looks at the open orders, takes a box the bench still needs out of its own row, lifts it clear of the
  // racking, runs to the east end and sets it on the overhead pick belt that passes there. Rows A to D drop on the south belt,
  // rows E and F on the north one; both belts end at the bench, so a picked box lands where a picker would have put it.
  var GANTRY_SPEED = 3.0, GANTRY_LIFT = 2.0, GANTRY_DROP_X = 46.0;
  // the pick belts run overhead at 2.4 m so the east aisle stays open, and come down to the bench at their ends
  var PICK_H = 2.4;
  // the south belt starts over row A, stays high past row D and drops to the bench; the north one starts over row F, passes row E and drops from the other side
  // both belts stay high along the row ends, cross the east corridor hung from the roof (no legs in the drive lane) and ramp down beside the bench:
  // the south one just past row D, ramping south to the bench's west inlet; the north one just past row E, ramping north to a second inlet
  // the two feeders stay high along the row ends, turn in past row D and row E and meet hung over the lane at the merge point (26.6, 5.2);
  // from there one merge belt crosses the rest of the lane on rods and ramps down to bench height at the bench's north-west corner
  var PICK_MERGE = { x: 26.6, z: 5.2 };
  var PB_S = (function () { var z0 = RACK.rows[0], yC = RACK.rows[2] - z0 + 0.8; return [[0, 0, PICK_H], [0, yC, PICK_H, 'hang'], [PICK_MERGE.x - 22, PICK_MERGE.z - z0, PICK_H, 'hang']]; })();   // hung from the roof end to end: no legs in the walk round the rack ends
  var PB_N = (function () { var z0 = RACK.rows[RACK.rows.length - 1], yC = RACK.rows[3] - z0 - 0.8; return [[0, 0, PICK_H], [0, yC, PICK_H, 'hang'], [PICK_MERGE.x - 22, PICK_MERGE.z - z0, PICK_H, 'hang']]; })();
  var PB_M = [[0, 0, PICK_H], [3.6, 0, PICK_H, 'hang'], [3.6, -1.6, 1.35, 'hang'], [3.6, -3.2, 0.2]];   // the drop is two runs: the upper one hangs high enough to walk under, so only its last 1.6 m stands on the floor beside the bench
  defBelt('pickMerge', { prop: 'pickMerge', path: PB_M, speedKey: 'pickBelt' });
  defBelt('pickBelt', { prop: 'pickBelt', path: PB_S });
  defBelt('pickBelt2', { prop: 'pickBelt2', path: PB_N, speedKey: 'pickBelt' });   // both pick belts share one dial
  function benchAccept(it) { if (it.kind !== 'box') return false; if (benchCount() >= ECON.benchCap) return false; benchAdd(it.sku, 1); sfx('putdown'); return true; }
  defMachine('benchIn', { prop: 'bench', inlets: [[-2.4, -3.2], [0, 2.3], [-1.1, 0], [1.1, 0.6], [1.1, -0.6]], accept: benchAccept });   // where the merge belt lands, and the bench's own ends and sides, so a run of pieces can feed it from any side
  for (var gr = 0; gr < RACK.rows.length; gr++) defMachine('gantry' + gr, { prop: 'gantry' + gr });
  function gantryBeltFor(r) { return r >= UPPER.row ? 'upperPick' : r >= 3 ? 'pickBelt2' : 'pickBelt'; }
  function gantryTop(r) { return r >= UPPER.row ? 3.0 : 5.0; }   // rail height in the crane's own frame: the upper crane runs under the roof
  function gantryDropLift(r) { return r >= UPPER.row ? BELT_Y + 0.6 : BELT_Y + PICK_H + 0.6; }   // the upper pick belt lies on the deck, the ground ones hang high   // rows A to C on the south belt, D and E on the north one
  function gantryRows() { var out = []; for (var r = 0; r < RACK.rows.length; r++) if (r < S.up.rows && propInst['gantry' + r]) out.push(r); if (S.up.upper && propInst.gantry5) out.push(UPPER.row); return out; }
  function gantryState(r) { r = r || 0; if (!S.gantries) S.gantries = {}; if (!S.gantries[r]) S.gantries[r] = { x: GANTRY_DROP_X, lift: 5.0, state: 'idle', sku: null, key: null, t: 0, picked: 0 }; return S.gantries[r]; }
  function gantryNeed(r) {
    var need = {}; S.orders.forEach(function (o) { if (o.state !== 'open') return; o.lines.forEach(function (l) { need[l.sku] = (need[l.sku] || 0) + l.qty; }); });
    for (var k in S.bench.boxes) need[k] = (need[k] || 0) - S.bench.boxes[k];
    var fl = pickInFlight(); for (var fk in fl) need[fk] = (need[fk] || 0) - fl[fk];   // the belts, the other cranes, the pickers' hands and their claims: see pickInFlight
    for (var sku in need) if (need[sku] > 0) { if (r === UPPER.row && groundStock(sku) > 0) continue; for (var key in S.slots) { var p = slotParse(key), s = S.slots[key]; if (p.r === r && s && s.sku === sku && s.n > 0) return { sku: sku, key: key, to: 'ground' }; } }   // the upper crane sends down only what the ground floor has none of
    return null;
  }
  function tickGantry(dt) {
    if (!S.up.gantry || !powered()) return;
    gantryRows().forEach(function (r) { tickGantryRow(r, dt); });
  }
  var gantryShown = {};
  function tickGantryRow(r, dt) {
    var G = gantryState(r), id = 'gantry' + r, belt = gantryBeltFor(r), top = gantryTop(r);
    if (gantryShown[r] !== G.state + (G.paused ? 'p' : '')) { gantryShown[r] = G.state + (G.paused ? 'p' : ''); if (MACH[id].screen) MACH[id].screen.dirty = true; }
    var spd = speedOf(id); var toX = function (lx, speed) { speed *= spd; var d = lx - G.x; if (Math.abs(d) <= speed * dt) { G.x = lx; return true; } G.x += Math.sign(d) * speed * dt; return false; };
    var toLift = function (y, speed) { speed *= spd; var d = y - G.lift; if (Math.abs(d) <= speed * dt) { G.lift = y; return true; } G.lift += Math.sign(d) * speed * dt; return false; };
    if (G.state === 'idle') { var job = G.paused ? null : gantryNeed(r); if (job) { G.sku = job.sku; G.key = job.key; G.to = job.to || 'ground'; var sp = slotParse(job.key); G.bayX = RACK.bayW * (sp.b + 0.5); G.level = RACK.levels[sp.l] + 0.9; G.state = 'toBay'; } else { toX(GANTRY_DROP_X, GANTRY_SPEED); toLift(top, GANTRY_LIFT); } }
    else if (G.state === 'toBay') { if (toX(G.bayX, GANTRY_SPEED)) G.state = 'down'; }
    else if (G.state === 'down') { if (toLift(G.level, GANTRY_LIFT)) { var s = S.slots[G.key]; if (s && s.sku === G.sku && s.n > 0) { slotTake(G.key, 1); s.wrapped = false; S.stats.picked++; G.state = 'up'; } else { G.sku = null; G.state = 'up'; } } }
    else if (G.state === 'up') { if (toLift(top, GANTRY_LIFT)) G.state = G.sku ? 'toDrop' : 'idle'; }
    else if (G.state === 'toDrop') { if (toX(GANTRY_DROP_X, GANTRY_SPEED)) G.state = 'lower'; }
    else if (G.state === 'lower') { if (toLift(gantryDropLift(r), GANTRY_LIFT)) G.state = 'drop'; }
    else if (G.state === 'drop') { if (propInst[BELTS[belt].prop] && beltPush(belt, { kind: 'box', sku: G.sku, to: G.to || 'ground' })) { G.picked++; S.stats.gantryPicked = (S.stats.gantryPicked || 0) + 1; sfx('click'); G.sku = null; G.state = 'up'; } }
    var m = MACH[id].anim; if (m) { m.trolley.position.x = G.x; m.mast.scale.y = Math.max(0.05, (top - G.lift) / (top - 1.0)); m.mast.position.y = -(top - G.lift) / 2; m.grip.position.y = -(top - G.lift); m.box.visible = !!G.sku && G.state !== 'toBay' && G.state !== 'down'; if (m.box.visible && G.sku) { m.box.material = CARD[G.sku] || m.box.material; } m.beacon.visible = G.state !== 'idle'; m.beacon.rotation.y = worldTime * 6; }
    lampSet(MACH[id], G.paused && G.state === 'idle' ? 'off' : G.state === 'idle' ? 'idle' : 'run');
  }
  // the control panel on each crane's cabinet: what it is doing, what its row holds, pause and reset
  function gantryRowStock(r) { var n = 0, slots = 0; for (var key in S.slots) { var p = slotParse(key), s = S.slots[key]; if (p.r === r && s && s.n > 0) { n += s.n; slots++; } } return { n: n, slots: slots }; }
  function gantryScreenDraw(r) { return function (c, sc) {
    var G = gantryState(r), st = !powered() ? 'off' : G.paused && G.state === 'idle' ? 'paused' : G.state === 'idle' ? 'ready' : 'running';
    scBg(c, sc.w, sc.h, st === 'running' ? 'rgba(95,211,141,0.18)' : st === 'paused' || st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'GANTRY ' + 'ABCDEF'[r], st.toUpperCase());
    var rs = gantryRowStock(r), pos = G.state === 'idle' ? 'parked at the belt' : G.state === 'toBay' ? 'running to bay ' + (Math.round(G.bayX / RACK.bayW - 0.5) + 1) : G.state === 'down' || G.state === 'up' ? 'at the rack' : G.state === 'toDrop' ? 'running to the belt' : 'setting down';
    scText(c, 16, 70, G.sku ? 'Picking ' + skuName(G.sku) : G.paused ? 'Held: finishing nothing' : 'Watching the orders', '#eef1f5', 16);
    scText(c, 16, 94, pos + ' · trolley ' + G.x.toFixed(1) + ' m · hook ' + G.lift.toFixed(1) + ' m', '#a0acb8', 13);
    scText(c, 16, 118, 'Row ' + 'ABCDEF'[r] + ': ' + rs.n + ' boxes in ' + rs.slots + ' slots · picked ' + G.picked, '#a0acb8', 13);
    scText(c, 16, 136, 'Belt ' + beltItems(gantryBeltFor(r)).length + ' · bench ' + benchCount() + '/' + ECON.benchCap, '#a0acb8', 13);
    speedButton(sc, 208, 152, 76, 'gantry' + r); scText(c, 212, 148, 'crane', '#6b7784', 9); speedButton(sc, 208, 116, 76, 'pickBelt'); scText(c, 212, 112, 'pick belt', '#6b7784', 9);
    scButton(sc, 16, 150, 80, 34, G.paused ? 'RESUME' : 'PAUSE', !G.paused, function () { G.paused = !G.paused; toast('Gantry ' + 'ABCDEF'[r] + (G.paused ? ' will hold after this pick' : ' running'), G.paused ? 'bad' : 'good'); }, G.paused ? '#5fd38d' : '#f5b53d');
    scButton(sc, 102, 150, 100, 34, 'RESET JOB', G.state !== 'idle', function () { if (G.state === 'idle') return; G.sku = null; G.key = null; G.state = 'up'; sfx('hydraulic'); toast('Gantry ' + 'ABCDEF'[r] + ' dropped its job and is coming home', 'good'); }, '#ff6b5e');
  }; }
  function gantryPrompt(r) { var G = gantryState(r); return 'Gantry picker ' + 'ABCDEF'[r] + ' · ' + (!powered() ? 'no power' : G.state === 'idle' ? 'watching the orders' : G.sku ? 'picking ' + skuName(G.sku) : 'working') + ' · ' + G.picked + ' boxes picked'; }
  // the crane props follow the rack rows: buying the gantry upgrade builds one over every row you own, buying a row adds its crane
  function buildGantries() { if (!S.up.gantry) return; for (var r = 0; r < RACK.rows.length; r++) if (r < S.up.rows) buildProp('gantry' + r); buildProp('pickBelt'); buildProp('pickMerge'); if (S.up.upper) { buildProp('gantry5'); buildProp('upperPick'); } if (S.up.rows > 4) buildProp('pickBelt2'); }
  // ── The upper level ───────────────────────────────────────────────
  // The deck sits over the open strip between the inbound docks and the north wall (z -24 to -13.5), the one part of the hall
  // with no crane above it, at 4.6 m: clear of the 4.2 m dock doors. A pallet set in the lift goes up by itself, rolls onto the
  // feed belt, and the row's intake racks it. The upper crane picks for orders onto the upper pick belt, which drops down a chute
  // into the south pick belt, so boxes from upstairs reach the merge and the bench like any other pick. The stair runs along the
  // north wall under the deck and comes up through it. Nothing up there needs a worker: the crew stay on the ground floor, and
  // slot row 5 is theirs to ignore (the picker's slot search filters it). Tyson's brief, 2026-10-06: "the automated floor gets its
  // orders via a lift near the IN side; I place the pallet in the lift and send it up; from there the automated part starts."
  var UPPER = { y: 4.6, z0: -HALL.z + 0.3, z1: -13.5, rowZ: -19.0, row: 5, levels: 2, rise: 8,
    lift: { x: -31.0, z: -15.5 }, shaft: { x0: -32.2, x1: -29.8, z0: -16.7, z1: -14.3 },   // on the deck's south edge by IN 1, east of the first jack's bay at (-33.8, -18); the north-west corner is the break room
    stair: { x0: -25.6, x1: -16.0, z0: -23.4, z1: -21.8 }, well: { x0: -25.6, x1: -20.8 } };   // the well: the part of the stair that comes up through the deck
  function upperOwned() { return !!(S.up && S.up.upper); }
  function inRect(x, z, r) { return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1; }
  function stairY(x) { return clamp((UPPER.stair.x1 - x) / (UPPER.stair.x1 - UPPER.stair.x0), 0, 1) * UPPER.y; }
  // the floor height the upper level gives a point, or null when it has nothing to say. The deck counts only for someone already
  // up there (y above 2.6), so the strip below it stays walkable; the stair counts for everyone, which keeps the crew off it.
  function upperFloorY(x, z, y) {
    if (!upperOwned() || !propInst.mezz) return null;
    if (inRect(x, z, UPPER.stair)) { if ((y || 0) > 2.6 && x > UPPER.well.x1) return UPPER.y; return stairY(x); }
    if ((y || 0) > 2.6) { var wo = walkoverY(x, z); if (wo !== null) return UPPER.y + wo; }   // the step-overs' stairs and platforms
    if ((y || 0) > 2.6 && Math.abs(x) < HALL.x - 0.2 && z > UPPER.z0 - 0.3 && z < UPPER.z1 && !inRect(x, z, UPPER.shaft) && !inSorterWell(x, z)) return UPPER.y;
    return null;
  }
  function isUpperRow(r) { return r === UPPER.row; }
  function upperRowsOwned() { return upperOwned() ? 1 : 0; }
  // the first upper slot with room: a part-filled slot of the same SKU first, then an empty one
  function upperSlotFor(sku, n) {
    for (var pass = 0; pass < 2; pass++) for (var r = UPPER.row; r < UPPER.row + upperRowsOwned(); r++) for (var l = 0; l < UPPER.levels; l++) for (var b = 0; b < RACK.bays; b++) {
      var k = slotKey(r, b, l), s = S.slots[k];
      if (pass === 0 ? (s && s.n > 0 && s.sku === sku && slotSpace(k, sku) >= n) : ((!s || !s.n) && slotSpace(k, sku) >= n)) return k;
    }
    return null;
  }
  // props raised onto the deck: the group goes up, and so do the solids the build registered
  function raiseToDeck(ctx, P, inst) { inst.g.position.y = UPPER.y; for (var i = 0; i < solids.length; i++) if (solids[i].prop === inst.id) { solids[i].y0 += UPPER.y; solids[i].y1 += UPPER.y; } }

  // ── The goods lift ────────────────────────────────────────────────
  var liftM = null, liftScreen = null, liftShown = '';
  function liftState() { if (!S.lift) S.lift = { pallet: null, pos: 0, state: 'down' }; return S.lift; }
  function liftPrompt() {
    var L = liftState(), jp = isJack(player.tool) ? jackPallet() : null, lp = L.pallet ? palletById(L.pallet) : null;
    if (!powered()) return 'Goods lift · no power';
    if (L.state !== 'down') return 'Goods lift · ' + (L.state === 'rising' ? 'going up' : L.state === 'up' ? 'unloading upstairs' : 'coming down');
    if (jp && !lp) return 'Set the pallet in the lift (it goes up by itself)';
    if (lp && !jp && isJack(player.tool)) return 'Take the pallet back out of the lift';
    return lp ? 'Goods lift · pallet of ' + lp.n + ' × ' + skuName(lp.sku) + (L.hold ? ' held at the floor' : ' about to go up') : 'Goods lift · empty, at the floor';
  }
  function liftUse() {
    var L = liftState(), jt = jackTool(), jp = isJack(player.tool) ? jackPallet() : null, lp = L.pallet ? palletById(L.pallet) : null;
    if (!powered() || L.state !== 'down') { sfx('bad'); return; }
    if (jp && !lp) { jp.place = 'lift'; S[jt].pallet = null; L.pallet = jp.id; L.wait = 1.5; sfx('crate'); toast('Pallet in the lift · it goes up by itself', 'good'); return; }
    if (lp && !jp && isJack(player.tool)) { lp.place = 'jack'; lp.jack = jt; S[jt].pallet = lp.id; L.pallet = null; sfx('jack'); return; }
    sfx('click');
  }
  // the forklift: forks over the lift floor with a pallet on them set it in (forkUse asks this before setting a pallet on the floor)
  function liftTakesFork(tipX, tipZ, p) {
    var L = liftState(); if (!upperOwned() || !propInst.lift || L.state !== 'down' || L.pallet || !powered()) return false;
    if (dist2(tipX, tipZ, UPPER.lift.x, UPPER.lift.z) > 1.3 * 1.3) return false;
    p.place = 'lift'; S.fork.pallet = null; L.pallet = p.id; L.wait = 1.5; sfx('crate'); toast('Pallet in the lift · it goes up by itself', 'good'); return true;
  }
  function tickLift(dt) {
    if (!upperOwned() || !propInst.lift) return;
    var L = liftState(), p = L.pallet ? palletById(L.pallet) : null; if (L.pallet && !p) L.pallet = null;
    if (powered()) {
      if (L.state === 'down') { if (p && !L.hold) { L.wait = (L.wait === undefined ? 1.5 : L.wait) - dt; if (L.wait <= 0) { L.state = 'rising'; sfx('hydraulic'); } } }
      else if (L.state === 'rising') { L.pos = Math.min(1, L.pos + dt / UPPER.rise); if (L.pos >= 1) L.state = 'up'; }
      else if (L.state === 'up') { if (!p) L.state = 'lowering'; else if (propInst.upperFeed && beltPush('upperFeed', { kind: 'pallet', sku: p.sku, n: p.n, wrapped: !!p.wrapped })) { removePallet(p.id); L.pallet = null; S.stats.lifted = (S.stats.lifted || 0) + 1; sfx('crate'); L.state = 'lowering'; } }
      else if (L.state === 'lowering') { L.pos = Math.max(0, L.pos - dt / UPPER.rise); if (L.pos <= 0) { L.state = 'down'; L.wait = 1.5; } }
    }
    if (liftM) liftM.position.y = L.pos * UPPER.y;
    if (liftScreen) { var key = L.state + '|' + (p ? p.id : '') + '|' + Math.round(L.pos * 20) + '|' + (L.hold ? 'h' : ''); if (liftShown !== key) { liftShown = key; liftScreen.dirty = true; } }
  }
  function liftScreenDraw(c, sc) {
    var L = liftState(), p = L.pallet ? palletById(L.pallet) : null, st = !powered() ? 'off' : L.state === 'down' ? (p ? (L.hold ? 'held' : 'loaded') : 'ready') : L.state;
    scBg(c, sc.w, sc.h, st === 'rising' || st === 'lowering' || st === 'up' ? 'rgba(95,211,141,0.18)' : st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'GOODS LIFT', st.toUpperCase());
    scText(c, 12, 62, p ? 'Pallet: ' + p.n + ' × ' + skuName(p.sku) : 'Platform empty', '#eef1f5', 14);
    scText(c, 12, 84, L.state === 'down' ? (p ? (L.hold ? 'Held at the floor' : 'Going up in a moment') : 'At the floor · a jack or the forklift sets a pallet in') : L.state === 'rising' ? 'Going up · ' + Math.round(L.pos * 100) + '%' : L.state === 'up' ? 'Upstairs · rolling it onto the feed belt' : 'Coming down · ' + Math.round((1 - L.pos) * 100) + '%', '#a0acb8', 11);
    scText(c, 12, 104, 'Lifted so far: ' + (S.stats.lifted || 0) + ' pallets · upstairs racked ' + (S.stats.upperIn || 0), '#a0acb8', 11);
    scButton(sc, 12, 122, 100, 30, 'SEND NOW', L.state === 'down' && !!p, function () { if (L.state === 'down' && p) { L.hold = false; L.state = 'rising'; sfx('hydraulic'); } }, '#5fd38d');
    scButton(sc, 124, 122, 100, 30, L.hold ? 'RELEASE' : 'HOLD', true, function () { L.hold = !L.hold; }, L.hold ? '#5fd38d' : '#f5b53d');
  }
  function liftBuild(c) {
    var FR = MAT_MACH.frame;
    // four posts and cross members, mesh guards on three sides, a gate bar across the open east side at the floor
    [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(function (p) { c.box(0.12, 5.6, 0.12, FR, p[0], 2.8, p[1]); c.box(0.3, 0.03, 0.3, FR, p[0], 0.015, p[1]); });
    [2.6, 5.5].forEach(function (y) { c.box(2.52, 0.1, 0.1, FR, 0, y, -1.2); c.box(2.52, 0.1, 0.1, FR, 0, y, 1.2); c.box(0.1, 0.1, 2.52, FR, -1.2, y, 0); if (y > 5) c.box(0.1, 0.1, 2.52, FR, 1.2, y, 0); });
    c.plane(2.4, 5.4, MAT.mesh, -1.19, 2.8, 0, 0, Math.PI / 2); c.plane(2.4, 5.4, MAT.mesh, 0, 2.8, -1.19, 0, 0); c.plane(2.4, 5.4, MAT.mesh, 0, 2.8, 1.19, 0, Math.PI);
    c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, 1.0, 0); c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, 0.5, 0);
    c.solid(-1.3, -1.1, -1.3, 1.3, 0, 5.6); c.solid(-1.3, 1.3, -1.3, -1.1, 0, 5.6); c.solid(-1.3, 1.3, 1.1, 1.3, 0, 5.6); c.solid(1.1, 1.3, -1.1, 1.1, 0, 1.3);
    // the platform: a plate on powered rollers, hazard-striped edges; it rides up to the deck
    var plat = new THREE.Group(); plat.userData.dynamic = true; c.add(plat); liftM = plat;
    box(2.2, 0.12, 2.2, MAT.steelDark, 0, 0.06, 0, plat); for (var rz = -0.8; rz <= 0.81; rz += 0.4) cyl(0.03, 2.0, MAT_MACH.roller, 0, 0.15, rz, plat, 8).rotation.z = Math.PI / 2;
    box(2.2, 0.04, 0.04, MAT.hazard, 0, 0.14, -1.08, plat); box(2.2, 0.04, 0.04, MAT.hazard, 0, 0.14, 1.08, plat); box(0.04, 0.04, 2.2, MAT.hazard, -1.08, 0.14, 0, plat);
    cyl(0.06, 5.6, FR, -1.0, 2.8, 0, c.group, 10); cyl(0.06, 5.6, FR, 1.0, 2.8, 0, c.group, 10);   // the guide rails the platform rides
    // the console on the south post, facing the hall side you walk up from; a lamp at the top
    cabinet(c, 0.9, 1.45, 1.21, 0.4, 0.6, 0.22); liftScreen = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.9, y: 1.5, z: 1.335, ry: 0, parent: c.group, title: 'Goods lift', draw: liftScreenDraw }); liftScreen.mesh.userData.propId = 'lift';
    c.box(0.06, 0.06, 0.06, glowMat(0xff3b2f, 1.5), 1.2, 5.3, 0);
    c.sign(['GOODS LIFT', 'pallets only · goes up by itself'], 1.2, 0.3, 1.22, 2.2, 0, Math.PI / 2, { w: 384, h: 96, bg: '#1b232c', fg: '#f5b53d' });
    c.hit(2.8, 2.6, 2.8, 0, 1.3, 0, { prompt: function () { return liftPrompt(); }, use: function () { liftUse(); } });
  }

  // ── The deck, the stair, the upper row and its belts ─────────────
  function railRun(c, a0, a1, at, axis, y, gaps) {
    if (gaps && gaps.length) { var cuts = gaps.slice().sort(function (p, q) { return p[0] - q[0]; }), s0 = a0; cuts.forEach(function (g) { if (g[0] > s0) railRun(c, s0, Math.min(g[0], a1), at, axis, y); s0 = Math.max(s0, g[1]); }); if (s0 < a1) railRun(c, s0, a1, at, axis, y); return; }   // gaps: where a belt crosses the rail
    var len = a1 - a0, mid = (a0 + a1) / 2; if (len < 0.3) return;
    for (var p = a0 + 0.2; p <= a1 - 0.1; p += 1.5) { if (axis === 'x') c.cyl(0.025, 1.1, MAT.chrome, p, y + 0.55, at, 8); else c.cyl(0.025, 1.1, MAT.chrome, at, y + 0.55, p, 8); }
    [0.55, 1.1].forEach(function (ry) { if (axis === 'x') c.box(len, 0.04, 0.04, MAT.chrome, mid, y + ry, at); else c.box(0.04, 0.04, len, MAT.chrome, at, y + ry, mid); });
    if (axis === 'x') { c.box(len, 0.12, 0.03, MAT.yellow, mid, y + 0.06, at); c.solid(a0, a1, at - 0.12, at + 0.12, y, y + 1.3); } else { c.box(0.03, 0.12, len, MAT.yellow, at, y + 0.06, mid); c.solid(at - 0.12, at + 0.12, a0, a1, y, y + 1.3); }
  }
  function mezzBuild(c) {
    var DK = std({ color: 0x5c656f, roughness: 0.55, metalness: 0.55 }), FR = MAT_MACH.frame, Y = UPPER.y, X = HALL.x - 0.2, z0 = UPPER.z0, z1 = UPPER.z1, sh = UPPER.shaft, stw = UPPER.stair, well = UPPER.well;
    var plate = function (x0, x1, za, zb) { if (x1 - x0 < 0.05 || zb - za < 0.05) return; c.box(x1 - x0, 0.12, zb - za, DK, (x0 + x1) / 2, Y - 0.06, (za + zb) / 2); };
    // plates: the deck rectangle in z bands at every hole edge, each band laid in x around the holes open in it (the shaft, the stairwell)
    var holes = [{ x0: sh.x0, x1: sh.x1, z0: sh.z0, z1: sh.z1 }, { x0: well.x0, x1: well.x1, z0: stw.z0, z1: stw.z1 }].concat(sorterHoles()), zs = [z0, z1]; holes.forEach(function (h) { zs.push(h.z0, h.z1); }); zs = zs.filter(function (v) { return v >= z0 && v <= z1; }).sort(function (p, q) { return p - q; });
    for (var bi = 0; bi + 1 < zs.length; bi++) { var za = zs[bi], zb = zs[bi + 1]; if (zb - za < 0.05) continue; var zm = (za + zb) / 2, xs = [-X, X]; holes.forEach(function (h) { if (zm > h.z0 && zm < h.z1) xs.push(h.x0, h.x1); }); xs.sort(function (p, q) { return p - q; }); for (var xi = 0; xi + 1 < xs.length; xi++) { var xm = (xs[xi] + xs[xi + 1]) / 2, inHole = holes.some(function (h) { return zm > h.z0 && zm < h.z1 && xm > h.x0 && xm < h.x1; }); if (!inHole) plate(xs[xi], xs[xi + 1], za, zb); } }
    // the edge beam, the south railing, and the railings round the stairwell
    c.box(2 * X, 0.4, 0.2, FR, 0, Y - 0.32, z1 + 0.1);
    railRun(c, -X, X, z1 - 0.12, 'x', Y, sorterEdgeGaps()); sorterWellRails(c); railRun(c, well.x0, well.x1, stw.z1 + 0.12, 'x', Y); railRun(c, stw.z0, stw.z1 + 0.24, well.x1 + 0.12, 'z', Y);
    // columns under the south edge every twelve metres, bump guards at the foot
    for (var cx = -24; cx <= 30; cx += 12) { c.box(0.35, Y - 0.12, 0.35, FR, cx, (Y - 0.12) / 2, z1 - 0.35); c.box(0.5, 0.5, 0.5, MAT.hazard, cx, 0.25, z1 - 0.35); c.solid(cx - 0.25, cx + 0.25, z1 - 0.6, z1 - 0.1, 0, Y); }
    // lamps under the deck, so the receiving strip is not a cave; a few on the deck
    [-24, 0, 24].forEach(function (lx) { var pl = new THREE.PointLight(0xfff0d0, 0.55, 11, 2); pl.position.set(lx, Y - 0.4, (z0 + z1) / 2); c.add(pl); c.box(0.5, 0.08, 0.5, MAT.lamp, lx, Y - 0.16, (z0 + z1) / 2); });
    // the stair: treads along the north wall rising westward, risers, two stringers, a handrail on the open side
    var n = 24, run = (stw.x1 - stw.x0) / n, rise = Y / n, zc = (stw.z0 + stw.z1) / 2, w = stw.z1 - stw.z0;
    for (var i = 0; i < n; i++) { var tx = stw.x1 - (i + 0.5) * run, ty = (i + 1) * rise; c.box(run, 0.06, w - 0.1, DK, tx, ty - 0.03, zc); c.box(0.04, rise, w - 0.1, FR, tx - run / 2 + 0.02, ty + rise / 2 - 0.03, zc); }
    var ang = Math.atan2(Y, stw.x1 - stw.x0), len = Math.hypot(Y, stw.x1 - stw.x0), mx = (stw.x0 + stw.x1) / 2;
    [stw.z0 + 0.05, stw.z1 - 0.05].forEach(function (sz) { c.box(len, 0.28, 0.06, FR, mx, Y / 2 - 0.08, sz).rotation.z = -ang; });
    c.box(len, 0.04, 0.04, MAT.chrome, mx, Y / 2 + 0.95, stw.z1 + 0.06).rotation.z = -ang;
    for (var hp = 1; hp < n; hp += 4) c.cyl(0.018, 0.95, MAT.chrome, stw.x1 - (hp + 0.5) * run, (hp + 1) * rise + 0.47, stw.z1 + 0.06, 6);
    c.solid(stw.x0, stw.x1, stw.z0, stw.z1, -3, -0.5);   // below the floor: the crew's grid sees it and routes round the stair, you never meet it
    c.solid(stw.x0, stw.x1 + 0.3, stw.z1, stw.z1 + 0.25, 0, Y + 1.0);   // the open side of the stair is railed from the floor up
    c.solid(-X, X, z0 - 0.4, z0, Y, Y + 3);   // the north wall at deck height
    c.sign(['MEZZANINE', 'stair · pallets go by the goods lift'], 1.4, 0.4, stw.x1 + 0.9, 2.2, stw.z1 + 0.14, 0, { w: 448, h: 128, bg: '#1b232c', fg: '#f5b53d' });
  }
  // the upper rack row: the ground row's build with two levels and uprights that stop under the roof (the group is raised by raiseToDeck)
  function upperRackBuild(c) {
    var x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05, H = 3.2, r = UPPER.row;
    for (var b = 0; b <= RACK.bays; b++) {
      var ux = x0 + b * bw;
      [-dz, dz].forEach(function (oz) { c.box(0.1, H, 0.1, MAT.rack, ux, H / 2, oz); c.box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, oz); for (var hh = 0.3; hh < H - 0.1; hh += 0.35) c.box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, oz); });
      for (var br = 0; br < 3; br++) { var yb = 0.4 + br * 1.0; c.box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, 0); var dg = c.box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, 0); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
    }
    var y = RACK.levels[1];
    c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, -dz); c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, dz);
    for (var bp = 0; bp <= RACK.bays; bp++) { c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, -dz); c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, dz); }
    for (var bb2 = 0; bb2 < RACK.bays; bb2++) { var dk = c.plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, 0, -Math.PI / 2, 0); dk.receiveShadow = false; }
    for (var bb = 0; bb < RACK.bays; bb++) {
      var cx = x0 + (bb + 0.5) * bw, lbl = 'U' + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#5fd38d' });
      var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
      [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, H - 0.3, s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; c.add(p); });
      for (var ll = 0; ll < UPPER.levels; ll++) (function (b2, l2) { var key = slotKey(r, b2, l2); slotHits[key] = c.hit(bw - 0.2, 1.45, RACK.depth, cx, RACK.levels[l2] + 0.725, 0, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } }); })(bb, ll);
    }
    c.solid(x0 - 0.1, x0 + RACK.bays * bw + 0.1, -RACK.depth / 2, RACK.depth / 2, 0, H);
    [-1, 1].forEach(function (s) { var x = s > 0 ? x0 + RACK.bays * bw + 0.3 : x0 - 0.3; c.box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, 0); c.sign(['UPPER ROW', 'automatic', 'keep clear'], 0.5, 0.5, x + s * 0.06, 1.6, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 26 }); });
  }
  defBelt('upperFeed', { prop: 'upperFeed', path: [[0, 0, UPPER.y], [3.4, 0, UPPER.y, 'hang'], [3.4, UPPER.rowZ - UPPER.lift.z, UPPER.y, 'hang']], speedKey: 'belts' });   // east off the lift head, then north to the row's west end
  defBelt('upperPick', { prop: 'upperPick', path: [[0, 0, UPPER.y], [0, 4.6, UPPER.y, 'hang']], speedKey: 'pickBelt' });   // along the row end to the chute at the deck edge
  defBelt('upperChute', { prop: 'upperChute', path: [[0, 0, UPPER.y], [0, 2.0, PICK_H, 'hang']], speedKey: 'pickBelt' });   // off the deck edge down into the south pick belt's start
  defMachine('gantry5', { prop: 'gantry5' });
  defMachine('upperIn', { prop: 'rack5', inlets: [[RACK.x0 - 1.4, 0]], accept: function (it) {   // where the feed belt ends, past the row's west end
    if (it.kind !== 'pallet') return false; var key = upperSlotFor(it.sku, it.n); if (!key) return false;
    slotAdd(key, it.sku, it.n); S.slots[key].pal = true; S.slots[key].wrapped = !!it.wrapped; S.stats.putaway += it.n; S.stats.upperIn = (S.stats.upperIn || 0) + 1; sfx('crate'); return true;
  } });
  defProp('mezz', { label: 'mezzanine', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, build: mezzBuild, when: upperOwned });
  defProp('lift', { label: 'goods lift', cat: 'hall', abs: true, keep: true, fixed: true, x: UPPER.lift.x, z: UPPER.lift.z, rot: 0, build: liftBuild, when: upperOwned });
  defProp('rack5', { label: 'upper rack row', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: UPPER.rowZ, rot: 0, build: upperRackBuild, after: raiseToDeck, when: upperOwned });
  defProp('gantry5', { label: 'upper gantry picker', cat: 'hall', abs: true, keep: true, fixed: true, x: -24, z: UPPER.rowZ, rot: 0, build: gantryBuild(UPPER.row), after: raiseToDeck, when: upperOwned });
  defProp('upperFeed', { label: 'lift feed belt', cat: 'hall', abs: true, keep: true, fixed: true, x: UPPER.lift.x + 1.4, z: UPPER.lift.z, rot: 0, build: function (c) { conveyorPath(c, BELTS.upperFeed.path); }, when: upperOwned });
  defProp('upperPick', { label: 'upper pick belt', cat: 'hall', abs: true, keep: true, fixed: true, x: 22.0, z: UPPER.rowZ, rot: 0, build: function (c) { conveyorPath(c, BELTS.upperPick.path); c.sign(['TO THE CHUTE'], 0.9, 0.14, 0.5, UPPER.y + 1.3, 2, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }, when: upperOwned });
  defProp('upperChute', { label: 'upper chute', cat: 'hall', abs: true, keep: true, fixed: true, x: 22.0, z: UPPER.z1 - 0.1, rot: 0, build: function (c) { conveyorPath(c, BELTS.upperChute.path); c.sign(['DOWN TO THE PICK LINE'], 0.9, 0.14, 0.5, UPPER.y + 1.0, 0.6, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }, when: upperOwned });

  function groundStock(sku) { var n = 0; for (var k in S.slots) { var s = S.slots[k]; if (s && s.n > 0 && s.sku === sku && slotParse(k).r !== UPPER.row) n += s.n; } return n; }
  function buildUpper() { ['mezz', 'lift', 'rack5', 'gantry5', 'upperFeed', 'upperPick', 'upperChute'].forEach(function (id) { buildProp(id); }); if (S.up.sorter) buildSorter(); else { beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); } } }
  // ── The sortation deck ────────────────────────────────────────────
  // Tyson's brief, 2026-10-06: OUT 1 ships by sea, OUT 2 by land and a third dock by air, with a proper system that sorts the
  // parcels by the three, and after the pack line every parcel goes up to the deck to be sorted and packed for its lane.
  // The parts, in the order a parcel meets them: the pack line shelf feeds a spiral conveyor up to deck height beside it; an
  // overhead run carries the parcel north along the east lane onto the deck; the scanner arch reads the order's lane; the spine
  // runs west along the north face of the upper row past three packing cells, one a lane: a cell takes a parcel of its lane off
  // the spine, crates it (sea), straps it (land) or bags it (air) and sets it on the collector, which runs east along the north
  // wall and turns south to the spiral well, where gates kick the air and the sea parcels down their spirals into the OUT 3 and
  // the OUT 1 loaders; the land parcels ride on over the deck edge, down the east wall and down a third spiral into the OUT 2
  // loader. A parcel that finds its cell full rides to the end of the spine, waits on the turntable there and goes round again.
  // Nothing up here needs a hand. The lanes exist without the deck (the dock consoles and the board say which door each order
  // wants, a parcel out of the wrong door pays a forwarding fee); the deck is what makes them run themselves, and it opens OUT 3.
  var SORT = {
    spineZ: -20.7, spineX0: 25.2, spineX1: -12.4,          // the spine: west along the upper row's north face
    collZ: -23.2, collX0: -7.0, collX1: 29.0, collX: 29.4, // the collector: east along the north wall, then south along x 29.4 past the well and over the deck edge, down the east lane
    cells: [{ mode: 'sea', x: 16.0 }, { mode: 'land', x: 6.0 }, { mode: 'air', x: -4.0 }], cellZ: -21.72, liftX: 1.25, liftT: 2.4,   // liftX: the parcel lift beside each cell (local x); liftT: seconds up to the collector   // against the spine, so the corridor along the wall stays 1.3 m clear
    table: { x: -13.4, z: -20.7 }, inX: 25.5, scanZ: -19.4, up: 2.0,                                         // up: how high the overhead runs ride above the deck
    walk: [{ id: 'walk1', x: 22.0, z: -17.2, rot: 0 }, { id: 'walk2', x: 23.35, z: -20.7, rot: 1 }],         // step-overs: over the upper pick belt, over the spine's east end
    well: { x0: 31.0, x1: 33.4, z0: -20.5, z1: -18.1 },    // the spiral well through the deck, railed: the air spiral comes down here
    spiral: { sea: { x: 31.6, z: -11.1 }, air: { x: 32.2, z: -19.3 }, land: { x: 30.4, z: -3.2 }, up: { x: 30.6, z: 14.3 }, r: 1.0 },   // sea: in the OUT 1 apron, south of the deck edge; air: through the well; land: by OUT 2
    gates: { air: -19.3, sea: -13.9 },                      // where on the collector's south run the gates kick east (the sea gate at the deck's last row, its bridge runs out over the edge)
    jack2: { x: 27.0, z: -23.0 },                           // jack 2's bay moves out from under the spirals to the north wall
    cellTime: { sea: 7, land: 4, air: 5 }
  };
  var LOADER_DOORS = { dockLoader1: 2, dockLoader2: 3, dockLoader3: 4 };
  function sorterOwned() { return !!(S.up && S.up.sorter && S.up.upper); }
  function sortState() { if (!S.sort) S.sort = { cells: {}, table: [], scanned: 0, sorted: 0, count: { sea: 0, land: 0, air: 0 }, last: null, tableT: 0 }; var Z = S.sort; SORT.cells.forEach(function (c) { if (!Z.cells[c.mode]) Z.cells[c.mode] = { q: [], t: 0, made: 0 }; }); if (!Z.count) Z.count = { sea: 0, land: 0, air: 0 }; return Z; }
  // the helix: points every 22.5 degrees from angle a0, dir +1 anticlockwise seen from above, y from yTop to yBot; flagged so the belt builder leaves off legs and hangers
  function spiralPts(cx, cz, r, a0, turns, dir, yTop, yBot) { var n = Math.max(4, Math.round(turns * 16)), pts = []; for (var k = 0; k <= n; k++) { var a = a0 + dir * Math.PI * 2 * turns * k / n; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, yTop + (yBot - yTop) * k / n, 'spiral']); } return pts; }
  function spiralDress(c, cx, cz, r, yTop, yBot) {
    var FR = MAT_MACH.frame, lo = Math.min(yTop, yBot), hi = Math.max(yTop, yBot);
    c.cyl(0.22, hi - lo + 1.2, FR, cx, lo + (hi - lo + 1.2) / 2, cz, 16); c.cyl(0.5, 0.08, FR, cx, lo + 0.04, cz, 20); c.cyl(0.26, 0.5, MAT_MACH.blue, cx, hi + 1.0, cz, 16);
    for (var k = 0; k < 32; k++) { var a = Math.PI * 2 * k / 32, ox = cx + Math.cos(a) * (r + 0.46), oz = cz + Math.sin(a) * (r + 0.46); var post = c.box(0.04, hi - lo + 1.2, 0.04, FR, ox, lo + (hi - lo + 1.2) / 2, oz); post.rotation.y = -a; if (k % 4 === 0) { c.box(0.06, 0.06, 0.06, MAT.yellow, ox, hi + 0.9, oz); } }
    c.plane(2 * r + 1.2, 2 * r + 1.2, MAT.hazard, cx, lo + 0.012, cz, -Math.PI / 2, 0).material = MAT.hazard;
    c.solid(cx - r - 0.5, cx + r + 0.5, cz - r - 0.5, cz + r + 0.5, lo, hi + 0.8);
  }
  // ── The paths ─────────────────────────────────────────────────────
  var Y = UPPER.y, R = SORT.spiral.r;
  var SORT_UP = [[32.6, 14.3, 0], [32.6, 15.3, 0]].concat(spiralPts(SORT.spiral.up.x, SORT.spiral.up.z, R, Math.PI / 2, 2, 1, 0, Y), [[26.1, 15.3, Y, 'hang'], [SORT.inX, 14.7, Y, 'hang'], [SORT.inX, -6.0, Y, 'hang'], [SORT.inX, -11.5, Y + SORT.up, 'hang'], [SORT.inX, -15.5, Y + SORT.up, 'hang'], [SORT.inX, -20.2, Y, 'hang']]);   // off the shelf, two turns up, west, north along the east lane, up again before the deck so it crosses the walkway overhead, and down onto the spine
  var SORT_SPINE = [[SORT.spineX0, SORT.spineZ, Y], [SORT.spineX1, SORT.spineZ, Y, 'hang']];
  var SORT_COLL = [[SORT.collX0, SORT.collZ, Y + SORT.up], [27.0, SORT.collZ, Y + SORT.up, 'hang'], [SORT.collX1, SORT.collZ, Y + 1.15, 'hang'], [SORT.collX, SORT.collZ + 0.4, Y + 1.0, 'hang'], [SORT.collX, -19.9, Y, 'hang'], [SORT.collX, SORT.spiral.land.z - R, Y, 'hang']]   // overhead along the wall (the corridor runs under it), down to deck level before the gates, then straight south along the east lane at deck height
    .concat(spiralPts(SORT.spiral.land.x, SORT.spiral.land.z, R, Math.PI, 2.5, -1, Y, 0).slice(1), [[33.0, SORT.spiral.land.z, 0, 'spiral']]);   // the land spiral is the collector's own end: two and a half turns down, then east into the OUT 2 shipping bay
  function gateSpiral(mode) {   // down into the shipping bay of the lane
    var sp = SORT.spiral[mode], z = SORT.gates[mode];
    if (mode === 'air') return [[SORT.collX + 0.4, z, Y], [sp.x - 0.9, z + R - 0.1, Y, 'hang']].concat(spiralPts(sp.x, sp.z, R, Math.PI / 2, 2.25, -1, Y, 0), [[sp.x + R, sp.z + 0.6, 0, 'spiral']]);   // through the well, two and a quarter turns, a step north into the OUT 3 bay
    return [[SORT.collX + 0.4, z, Y], [30.6, -12.9, Y, 'hang']].concat(spiralPts(sp.x, sp.z, R, -Math.PI / 2, 2, 1, Y, 0), [[33.0, -11.7, 0, 'spiral']]);   // out over the deck edge into the apron, two turns down, east into the OUT 1 bay
  }
  defBelt('sortUp', { prop: 'sortUp', path: SORT_UP, speedKey: 'sorter', rate: 3 });
  defBelt('spine', { prop: 'spine', path: SORT_SPINE, speedKey: 'sorter', rate: 3 });
  defBelt('collector', { prop: 'collector', path: SORT_COLL, speedKey: 'sorter', rate: 3 });
  defBelt('spiralSea', { prop: 'spiralSea', path: gateSpiral('sea'), speedKey: 'sorter', rate: 3 });
  defBelt('spiralAir', { prop: 'spiralAir', path: gateSpiral('air'), speedKey: 'sorter', rate: 3 });
  // ── The machines on the registry ──────────────────────────────────
  defMachine('sortTable', { prop: 'sortTable', inlets: [[0, 0]], accept: function (it) { var Z = sortState(); if (it.kind !== 'parcel' || Z.table.length >= 6 || !powered()) return false; Z.table.push({ kind: 'parcel', order: it.order, mode: it.mode, laps: (it.laps || 0) + 1 }); sfx('putdown'); return true; } });
  SORT.cells.forEach(function (cd) { defMachine('cell' + cd.mode, { prop: 'cell' + cd.mode }); });
  function orderMode(o) { if (!o) return 'land'; if (o.mode && MODES[o.mode]) return o.mode; return clientMode(o.client); }
  function clientMode(cid) { var c = CLIENTS.filter(function (x) { return x.id === cid; })[0], m = c && c.mode || 'land'; if (m === 'air' && !sorterOwned()) m = 'land'; return m; }
  function modeOfParcel(it) { if (it.mode && MODES[it.mode]) return it.mode; var o = it.order ? orderById(it.order) : null; return o ? orderMode(o) : 'land'; }
  function beltInsert(id, item, d) { var items = beltItems(id), gap = beltGapOf(item); for (var i = 0; i < items.length; i++) if (Math.abs(items[i].d - d) < gap) return false; item.d = d; items.push(item); return true; }
  function beltD(id, x, z) { var b = BELTS[id], L = beltLen(b), best = 0, bd = 1e9; for (var d = 0; d <= L; d += 0.1) { var w = beltPoint(b, d), q = dist2(w.x, w.z, x, z); if (q < bd) { bd = q; best = d; } } return best; }
  var sortD = null;
  function sortMeasure() { if (!propInst.spine || !propInst.collector) { sortD = null; return; } sortD = { cell: {}, coll: {}, gate: {} }; SORT.cells.forEach(function (c) { sortD.cell[c.mode] = beltD('spine', c.x, SORT.spineZ); sortD.coll[c.mode] = beltD('collector', c.x + SORT.liftX, SORT.collZ); }); for (var g in SORT.gates) sortD.gate[g] = beltD('collector', SORT.collX, SORT.gates[g]); }
  function tickSorter(dt) {
    if (!sorterOwned() || !propInst.spine || !propInst.collector) return;
    if (!sortD) sortMeasure();
    var Z = sortState(), spd = speedOf('sorter');
    // the scanner: a parcel coming onto the spine is read, and the board of the panel remembers it
    beltItems('spine').forEach(function (it) { if (it.kind === 'parcel' && !it.mode) { it.mode = modeOfParcel(it); Z.scanned++; var o = it.order ? orderById(it.order) : null; Z.last = { num: o ? o.num : '?', mode: it.mode, client: o ? clientName(o.client) : '' }; if (sortScreen) sortScreen.dirty = true; } });
    if (!powered()) return;
    var spine = beltItems('spine'), i, it;
    // the cells: take a parcel of their lane off the spine, work on it, set it on the collector
    SORT.cells.forEach(function (cd) {
      var cell = Z.cells[cd.mode], dC = sortD.cell[cd.mode];
      if (cell.q.length < 2) for (i = spine.length - 1; i >= 0; i--) { it = spine[i]; if (it.kind === 'parcel' && it.mode === cd.mode && Math.abs(it.d - dC) < 0.35) { spine.splice(i, 1); cell.q.push({ order: it.order, mode: it.mode, t: 0 }); sfx('click'); if (sortScreen) sortScreen.dirty = true; break; } }
      // the job: work for the lane's time, then the parcel rides the lift beside the cell up to the bridge belt, which runs it onto the collector
      if (cell.q.length) { var job = cell.q[0]; if (job.t < SORT.cellTime[cd.mode]) { job.t += dt * spd; if (job.t >= SORT.cellTime[cd.mode]) { var o = job.order ? orderById(job.order) : null; if (o) o.form = MODES[cd.mode].form; job.lift = 0; sfx('tape'); } }
        else { job.lift = (job.lift || 0) + dt * spd; if (job.lift >= SORT.liftT && beltPush('cellOut' + cd.mode, { kind: 'parcel', order: job.order, mode: cd.mode, form: MODES[cd.mode].form })) { cell.q.shift(); cell.made++; Z.sorted++; Z.count[cd.mode] = (Z.count[cd.mode] || 0) + 1; S.stats.sorted = (S.stats.sorted || 0) + 1; if (sortScreen) sortScreen.dirty = true; } } }
      var M = MACH['cell' + cd.mode]; if (M && M.liftPlat) { var j0 = cell.q[0], fr = j0 && j0.lift !== undefined ? Math.min(1, j0.lift / SORT.liftT) : 0; M.liftPlat.position.y = BELT_Y - 0.1 + SORT.up * fr; }
      // the bridge belt's end: onto the collector overhead, when there is a gap
      var ob = beltItems('cellOut' + cd.mode), obL = BELTS['cellOut' + cd.mode] ? beltLen(BELTS['cellOut' + cd.mode]) : 0; for (i = ob.length - 1; i >= 0; i--) { it = ob[i]; if (it.d >= obL - 0.01 && beltInsert('collector', { kind: 'parcel', order: it.order, mode: it.mode, form: it.form }, sortD.coll[cd.mode])) ob.splice(i, 1); }
      if (MACH['cell' + cd.mode]) lampSet(MACH['cell' + cd.mode], cell.q.length ? 'run' : 'idle');
    });
    // the gates: a parcel of the lane passing the gate goes down its spiral
    var coll = beltItems('collector');
    for (var g in SORT.gates) { var dG = sortD.gate[g], to = g === 'sea' ? 'spiralSea' : 'spiralAir'; if (!propInst[to]) continue; for (i = coll.length - 1; i >= 0; i--) { it = coll[i]; if (it.kind === 'parcel' && it.mode === g && Math.abs(it.d - dG) < 0.35) { if (beltPush(to, { kind: 'parcel', order: it.order, mode: it.mode, form: it.form })) { coll.splice(i, 1); sfx('click'); } break; } } }
    // the turntable at the end of the spine: whatever found its cell full goes round again
    if (Z.table.length) { Z.tableT += dt; if (Z.tableT > 2.5 && beltStartFree('spine')) { Z.tableT = 0; var back = Z.table.shift(); beltPush('spine', back); } }
    if (MACH.sortTable) lampSet(MACH.sortTable, Z.table.length ? 'run' : 'idle');
  }
  // the parcels inside the cells and on the turntable are drawn with the instanced parcels, from syncInstances
  function drawSorterItems() {
    drawStaged(); if (!sorterOwned()) return; var Z = sortState();
    SORT.cells.forEach(function (cd) { if (!propInst['cell' + cd.mode]) return; var cell = Z.cells[cd.mode]; cell.q.forEach(function (job, i) { var done = job.t >= SORT.cellTime[cd.mode]; if (i === 0 && done) { var fr = Math.min(1, (job.lift || 0) / SORT.liftT); putParcel(cd.x + SORT.liftX, Y + BELT_Y + 0.17 + SORT.up * fr, SORT.cellZ, 0, { kind: 'cell' }, MODES[cd.mode].form); } else putParcel(cd.x + (i ? -0.95 : 0), Y + 1.02, SORT.cellZ, 0, { kind: 'cell' }, null); }); });
    if (propInst.sortTable) Z.table.forEach(function (it, i) { var a = i * 1.05; putParcel(SORT.table.x + Math.cos(a) * 0.55, Y + 0.98, SORT.table.z + Math.sin(a) * 0.55, a, { kind: 'cell' }, it.form); });
  }
  // ── Staging at the loaders ────────────────────────────────────────
  // A loader with no truck at its door no longer stops its belt: it stages up to twelve parcels beside itself and pushes them into
  // the next truck of its lane that docks with the door up. The deck's night shift fills these stages while you sleep.
  // The shipping bays (Tyson, 2026-10-06: the parcels must not land in front of the door by magic; a place where they sit). One a dock:
  // a three-lane gravity flow rack beside the loader, nine parcels, with a painted bay round it. The spirals and the shipping belt end
  // in the bays, never in the loaders; the loader takes from its bay, one parcel every second and a bit, while a truck of its lane
  // is docked with the door up. A parcel in a bay can be taken by hand. The bays are keyed by their loader in the save (S.stage).
  var STAGE_CAP = 9, BAY = { x0: 33.4, len: 1.8, lanes: 3, deep: 3, pitch: 0.62, step: 0.6, h: 0.55, at: { dockLoader1: { prop: 'bay1', z0: -12.1 }, dockLoader2: { prop: 'bay2', z0: -4.1 }, dockLoader3: { prop: 'bay3', z0: -19.56 } } }, STAGE_AT = BAY.at, stageT = {};   // every bay on the open side of its loader
  function bayLoader(prop) { for (var id in BAY.at) if (BAY.at[id].prop === prop) return id; return null; }
  function stageOf(id) { if (!S.stage) S.stage = {}; if (!S.stage[id]) S.stage[id] = []; return S.stage[id]; }
  function stageSpot(id, i) { var a = BAY.at[id], lane = i % BAY.lanes, depth = Math.floor(i / BAY.lanes); return { x: BAY.x0 + BAY.len - 0.32 - depth * BAY.step, z: a.z0 + 0.31 + lane * BAY.pitch, y: BAY.h }; }
  function stagePush(id, oid) { var st = stageOf(id); if (st.length >= STAGE_CAP || st.indexOf(oid) >= 0) return false; st.push(oid); return true; }
  function stagePrompt(src) { var o = orderById(src.order); if (S.hand || player.tool) return null; return 'Take parcel #' + (o ? o.num : '?') + ' out of the ' + dockLabel(LOADER_DOORS[src.loader]) + ' shipping bay'; }
  function stageUse(src) { if (S.hand || player.tool) return; var st = stageOf(src.loader), i = st.indexOf(src.order); if (i < 0) return; st.splice(i, 1); handSet({ kind: 'parcel', order: src.order }); sfx('pickup'); }
  function drawStaged() { for (var id in BAY.at) { if (!propInst[BAY.at[id].prop]) continue; stageOf(id).forEach(function (oid, i) { var p = stageSpot(id, i), o = orderById(oid); putParcel(p.x, p.y + 0.23, p.z, 0, { kind: 'stage', loader: id, order: oid }, o && o.form); }); } }
  function bayBuild(id) { return function (c) {
    var DG = MAT_MACH.frame, L = BAY.len, W = BAY.lanes * BAY.pitch, lane = MODES[TRUCK_OUT[LOADER_DOORS[id] - 2].mode], LC = new THREE.Color(lane.col), PM = std({ color: LC, roughness: 0.5, metalness: 0.3 });
    [[0.05, 0.05], [L - 0.05, 0.05], [0.05, W - 0.05], [L - 0.05, W - 0.05]].forEach(function (p) { c.box(0.08, BAY.h + 0.5, 0.08, DG, p[0], (BAY.h + 0.5) / 2, p[1]); c.box(0.16, 0.02, 0.16, DG, p[0], 0.01, p[1]); });
    c.box(L, 0.05, 0.05, DG, L / 2, BAY.h - 0.1, 0.03); c.box(L, 0.05, 0.05, DG, L / 2, BAY.h - 0.1, W - 0.03); c.box(0.05, 0.05, W, DG, 0.03, BAY.h - 0.1, W / 2); c.box(0.05, 0.05, W, DG, L - 0.03, BAY.h - 0.1, W / 2);
    for (var k = 0; k < BAY.lanes; k++) { var lz = 0.31 + k * BAY.pitch; var bed = c.box(L - 0.1, 0.03, 0.5, MAT_MACH.roller, L / 2, BAY.h - 0.03, lz); bed.rotation.z = -0.04; for (var rx = 0.15; rx < L - 0.1; rx += 0.15) { var sk = c.cyl(0.03, 0.46, MAT.chrome, rx, BAY.h - 0.02 + (L / 2 - rx) * 0.04, lz, 8); sk.rotation.x = Math.PI / 2; } c.box(L - 0.1, 0.1, 0.02, MAT_MACH.guard, L / 2, BAY.h + 0.05, lz - 0.3); c.box(L - 0.1, 0.1, 0.02, MAT_MACH.guard, L / 2, BAY.h + 0.05, lz + 0.3); c.box(0.04, 0.2, 0.46, PM, L - 0.06, BAY.h + 0.06, lz); }
    c.box(0.06, 0.5, W, DG, L + 0.02, BAY.h + 0.7, W / 2); c.sign([lane.name.toUpperCase() + ' SHIPPING BAY', dockLabel(LOADER_DOORS[id]) + ' · ' + lane.haulier], W - 0.1, 0.42, L + 0.06, BAY.h + 0.7, W / 2, -Math.PI / 2, { w: 640, h: 128, bg: '#1b232c', fg: lane.col });
    c.plane(L + 0.8, 0.1, MAT.yellowLine, L / 2, 0.006, -0.3, -Math.PI / 2, 0); c.plane(L + 0.8, 0.1, MAT.yellowLine, L / 2, 0.006, W + 0.3, -Math.PI / 2, 0); c.plane(0.1, W + 0.7, MAT.yellowLine, -0.35, 0.006, W / 2, -Math.PI / 2, 0);
    var lbl = new THREE.MeshBasicMaterial({ map: textTex(['BAY ' + (LOADER_DOORS[id] - 1) + ' · ' + lane.name.toUpperCase()], { w: 512, h: 128, bg: '#3b3d40', fg: lane.col }) }); c.plane(1.6, 0.4, lbl, L / 2, 0.0066, -0.7, -Math.PI / 2, 0);
    MACH['bay' + (LOADER_DOORS[id] - 1)].lamps = lampStack(c, L + 0.02, BAY.h + 1.0, W - 0.1);
    c.hit(0.3, 1.6, W + 0.2, L + 0.1, 0.8, W / 2, { prompt: function () { var n = stageOf(id).length, t = truckAtDoor(LOADER_DOORS[id]); return lane.name + ' shipping bay ' + dockLabel(LOADER_DOORS[id]) + ' · ' + n + ' of ' + STAGE_CAP + ' parcels' + (t && S.doors[LOADER_DOORS[id]] ? ' · the loader is taking them aboard' : ' · waiting for the ' + lane.name.toLowerCase() + ' truck'); }, use: function () { sfx('click'); } });
    c.solid(-0.05, L + 0.1, -0.05, W + 0.05, 0, 1.1);
  }; }
  // the bays on the registry: a belt that ends at a bay's west face drops its parcel into the bay
  [['dockLoader1', 'bay1'], ['dockLoader2', 'bay2'], ['dockLoader3', 'bay3']].forEach(function (pr) { defMachine(pr[1], { prop: pr[1], inlets: [[0, 0.93]], accept: function (it) { if (it.kind !== 'parcel' || !powered()) return false; var o = orderById(it.order); if (!o) return true; if (!stagePush(pr[0], o.id)) return false; if (it.form && !o.form) o.form = it.form; sfx('putdown'); return true; } }); });
  defProp('bay1', { label: 'shipping bay OUT 1', cat: 'hall', abs: true, keep: true, fixed: true, x: BAY.x0, z: BAY.at.dockLoader1.z0, rot: 0, build: bayBuild('dockLoader1'), when: function () { return !!S.up.sorter; } });
  defProp('bay2', { label: 'shipping bay OUT 2', cat: 'hall', abs: true, keep: true, fixed: true, x: BAY.x0, z: BAY.at.dockLoader2.z0, rot: 0, build: bayBuild('dockLoader2'), when: function () { return !!S.up.shipbelt || !!S.up.sorter; } });
  defProp('bay3', { label: 'shipping bay OUT 3', cat: 'hall', abs: true, keep: true, fixed: true, x: BAY.x0, z: BAY.at.dockLoader3.z0, rot: 0, build: bayBuild('dockLoader3'), when: function () { return !!S.up.sorter; } });
  function tickStaging(dt) {
    for (var id in STAGE_AT) {
      var st = stageOf(id); if (!st.length || !propInst[id] || !powered()) { if (MACH[BAY.at[id].prop]) lampSet(MACH[BAY.at[id].prop], !powered() ? 'off' : st.length ? 'idle' : 'idle'); continue; } var door = LOADER_DOORS[id], t = truckAtDoor(door); if (MACH[BAY.at[id].prop]) lampSet(MACH[BAY.at[id].prop], t && S.doors[door] ? 'run' : 'idle'); if (!t || !S.doors[door] || !doorPassable(door)) continue;
      stageT[id] = (stageT[id] || 0) + dt; if (stageT[id] < 1.2) continue; stageT[id] = 0;
      var oid = st.shift(), o = orderById(oid); if (!o) continue; t.parcels.push(o.id); o.state = 'loaded'; laneWarn(o, t); sfx('crate'); addXp(XP.ship); rebuildBoardSoon(); S.stats.autoLoaded = (S.stats.autoLoaded || 0) + 1; if (MACH[id].anim) MACH[id].anim.pushT = 1.2;
    }
  }
  // the night shift: at bedtime every parcel on the shelf and on the deck is sorted and staged at the loader of its lane
  function deckNightRun() {
    if (!S.up.deckNight || !sorterOwned() || !propInst.spine || S.events.power) return 0;
    var Z = sortState(), list = [], n = { sea: 0, land: 0, air: 0 }, take = function (oid) { var o = orderById(oid); if (o) list.push(o); };
    S.bench.parcels.splice(0).forEach(take);
    ['sortUp', 'spine', 'collector', 'spiralSea', 'spiralAir'].forEach(function (b) { var items = beltItems(b); for (var i = items.length - 1; i >= 0; i--) if (items[i].kind === 'parcel') { if (items[i].order) take(items[i].order); items.splice(i, 1); } });
    SORT.cells.forEach(function (cd) { Z.cells[cd.mode].q.splice(0).forEach(function (j) { if (j.order) take(j.order); }); }); Z.table.splice(0).forEach(function (it) { if (it.order) take(it.order); });
    var left = [];
    list.forEach(function (o) { var m = orderMode(o), id = { sea: 'dockLoader1', land: 'dockLoader2', air: 'dockLoader3' }[m]; o.form = MODES[m].form; if (stagePush(id, o.id)) { n[m]++; Z.sorted++; Z.scanned++; Z.count[m] = (Z.count[m] || 0) + 1; S.stats.sorted = (S.stats.sorted || 0) + 1; } else left.push(o); });
    left.forEach(function (o) { if (S.bench.parcels.length < 12) S.bench.parcels.push(o.id); else S.floor.push({ kind: 'parcel', order: o.id, x: 31.2 + Math.random() * 0.8, y: 0, z: 16.4 + Math.random() * 0.8, rot: 0 }); });
    var tot = n.sea + n.land + n.air; if (tot) logEvent('Night shift on the deck: ' + tot + ' parcel' + (tot > 1 ? 's' : '') + ' sorted and waiting in the shipping bays (sea ' + n.sea + ', land ' + n.land + ', air ' + n.air + ')', 'good');
    return tot;
  }
  // ── The screens ───────────────────────────────────────────────────
  var sortScreen = null;
  function sortScreenDraw(c, sc) {
    var Z = sortState(), busy = SORT.cells.some(function (cd) { return Z.cells[cd.mode].q.length; }), st = !powered() ? 'off' : busy ? 'sorting' : 'ready';
    scBg(c, sc.w, sc.h, st === 'sorting' ? 'rgba(95,211,141,0.18)' : st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'SORTATION DECK', st.toUpperCase());
    scText(c, 16, 62, Z.last ? 'Last read: #' + Z.last.num + ' ' + Z.last.client.slice(0, 16) + ' → ' + MODES[Z.last.mode].name.toUpperCase() : 'Waiting for the first parcel up the spiral', '#eef1f5', 13);
    scText(c, 16, 82, 'Read ' + Z.scanned + ' · sorted ' + Z.sorted + ' · sea ' + Z.count.sea + ' · land ' + Z.count.land + ' · air ' + Z.count.air, '#a0acb8', 12);
    SORT.cells.forEach(function (cd, i) { var cell = Z.cells[cd.mode], j = cell.q[0], o = j && j.order ? orderById(j.order) : null; c.fillStyle = MODES[cd.mode].col; c.fillRect(16, 96 + i * 20, 8, 14); scText(c, 32, 108 + i * 20, MODES[cd.mode].name.toUpperCase() + ' cell · ' + (j ? (o ? '#' + o.num + ' ' : '') + MODES[cd.mode].verb + (cell.q.length > 1 ? ' · 1 waiting' : '') : 'free') + ' · ' + cell.made + ' done', j ? '#eef1f5' : '#a0acb8', 12); });
    scText(c, 16, 170, 'Turntable: ' + Z.table.length + ' going round again · spine ' + beltItems('spine').length + ' · collector ' + beltItems('collector').length, '#a0acb8', 11);
    speedButton(sc, 208, 182, 76, 'sorter'); scText(c, 212, 178, 'deck belts', '#6b7784', 9);
    scButton(sc, 16, 180, 120, 30, 'LANES', true, function () { toast('Sea goes out at OUT 1, land at OUT 2, air at OUT 3. The board shows each order\'s lane.', ''); }, '#78bdf5');
  }
  // ── The builds ────────────────────────────────────────────────────
  // ── Step-overs ───────────────────────────────────────────────────
  // A steel stair up, a chequer platform a metre over the belt, a stair down: the way across a deck belt. The platform is floor
  // (walkoverY feeds upperFloorY), the rails are solid, and a deck belt's own solid stops below the platform (conveyorPath).
  var WALKOVERS = {}, WO = { h: 1.0, pl: 1.6, pw: 1.6, run: 0.9 };
  function walkoverY(x, z) {
    for (var id in WALKOVERS) { var P = WALKOVERS[id], a = P.rot * Math.PI / 2, dx = x - P.x, dz = z - P.z, lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a); if (Math.abs(lz) > WO.pw / 2) continue; var ax = Math.abs(lx); if (ax <= WO.pl / 2) return WO.h; if (ax <= WO.pl / 2 + WO.run) return WO.h * (WO.pl / 2 + WO.run - ax) / WO.run; }
    return null;
  }
  function walkoverBuild(c) {
    var DG = MAT_MACH.frame, CH = MAT.chequer, H = WO.h, PW = WO.pw, PL = WO.pl, RUN = WO.run, slope = Math.atan2(H, RUN), sl = Math.hypot(RUN, H);
    c.box(PL, 0.06, PW, CH, 0, H - 0.03, 0); [-1, 1].forEach(function (q) { c.box(PL, 0.1, 0.05, MAT.hazard, 0, H - 0.08, q * (PW / 2 - 0.02)); });
    [-1, 1].forEach(function (s) {
      for (var k = 0; k < 2; k++) { var tx = s * (PL / 2 + 0.15 + k * 0.3), ty = H * (2 - k) / 3; c.box(0.3, 0.05, PW - 0.1, CH, tx, ty - 0.025, 0); c.box(0.04, H / 3, PW - 0.1, DG, tx - s * 0.15, ty + H / 6, 0); }
      c.box(0.04, H / 3, PW - 0.1, DG, s * (PL / 2 + 0.75), H / 6, 0);
      [-1, 1].forEach(function (q) { var st = c.box(sl, 0.16, 0.05, DG, s * (PL / 2 + RUN / 2), H / 2 - 0.05, q * (PW / 2 - 0.02)); st.rotation.z = -s * slope; c.cyl(0.02, 1.0, MAT.chrome, s * (PL / 2 + RUN), 0.5, q * PW / 2, 8); var hr = c.box(sl, 0.04, 0.04, MAT.chrome, s * (PL / 2 + RUN / 2), H / 2 + 1.0, q * PW / 2); hr.rotation.z = -s * slope; });
    });
    [[-PL / 2 + 0.1, -PW / 2 + 0.1], [PL / 2 - 0.1, -PW / 2 + 0.1], [-PL / 2 + 0.1, PW / 2 - 0.1], [PL / 2 - 0.1, PW / 2 - 0.1]].forEach(function (p) { c.box(0.06, H - 0.06, 0.06, DG, p[0], (H - 0.06) / 2, p[1]); c.box(0.14, 0.02, 0.14, DG, p[0], 0.01, p[1]); });
    [-1, 1].forEach(function (q) { c.cyl(0.02, 1.0, MAT.chrome, -PL / 2, H + 0.5, q * PW / 2, 8); c.cyl(0.02, 1.0, MAT.chrome, PL / 2, H + 0.5, q * PW / 2, 8); c.box(PL, 0.04, 0.04, MAT.chrome, 0, H + 1.0, q * PW / 2); c.box(PL, 0.04, 0.04, MAT.chrome, 0, H + 0.5, q * PW / 2); c.solid(-PL / 2 - RUN, PL / 2 + RUN, q * PW / 2 - 0.05, q * PW / 2 + 0.05, 0, H + 1.1); });
    c.sign(['STEP OVER'], 0.6, 0.12, 0, H + 1.12, PW / 2 + 0.01, 0, { w: 256, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.sign(['STEP OVER'], 0.6, 0.12, 0, H + 1.12, -PW / 2 - 0.01, Math.PI, { w: 256, h: 56, bg: '#f5b53d', fg: '#1a1205' });
  }
  function cellBuild(cd) { return function (c) {
    var LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), DG = MAT_MACH.frame, col = new THREE.Color(MODES[cd.mode].col), PM = std({ color: col, roughness: 0.5, metalness: 0.3 });
    [[-0.7, -0.55], [0.7, -0.55], [-0.7, 0.55], [0.7, 0.55]].forEach(function (p) { c.box(0.08, 0.7, 0.08, DG, p[0], 0.35, p[1]); c.box(0.18, 0.03, 0.18, DG, p[0], 0.015, p[1]); });
    c.box(1.6, 0.14, 1.3, DG, 0, 0.78, 0); for (var rx = -0.7; rx < 0.75; rx += 0.2) { var r = c.cyl(0.035, 1.2, MAT_MACH.roller, rx, BELT_Y - 0.02, 0, 10); r.rotation.x = Math.PI / 2; }
    var hood = new THREE.Mesh(bevelGeo(1.5, 0.9, 1.1, 0.04), LG); hood.position.set(0, 1.5, 0); hood.castShadow = true; c.group.add(hood); c.box(1.52, 0.06, 1.12, PM, 0, 1.97, 0); c.box(1.52, 0.04, 1.12, MAT.hazard, 0, 0.87, 0);
    c.plane(0.9, 0.4, std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.4 }), 0, 1.45, 0.56, 0, 0); c.plane(0.9, 0.4, std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.4 }), 0, 1.45, -0.56, 0, Math.PI);
    if (cd.mode === 'sea') { c.box(0.5, 0.5, 0.08, MAT.wood, 0.95, 1.3, 0); c.box(0.5, 0.5, 0.08, MAT.wood, 1.0, 1.3, 0.1); } else if (cd.mode === 'land') { var roll = c.cyl(0.14, 0.1, MAT.black, 0.95, 1.3, 0, 16); roll.rotation.x = Math.PI / 2; } else { c.box(0.4, 0.5, 0.06, MAT.white, 0.95, 1.3, 0); c.box(0.4, 0.06, 0.06, MAT.red, 0.95, 1.5, 0.01); }
    c.sign([MODES[cd.mode].name.toUpperCase() + ' CELL', MODES[cd.mode].pack], 1.3, 0.3, 0, 1.78, 0.57, 0, { w: 448, h: 100, bg: '#1b232c', fg: MODES[cd.mode].col }); c.sign([MODES[cd.mode].name.toUpperCase() + ' CELL'], 1.3, 0.2, 0, 1.78, -0.57, Math.PI, { w: 448, h: 64, bg: '#1b232c', fg: MODES[cd.mode].col });
    MACH['cell' + cd.mode].lamps = lampStack(c, 0.6, 1.98, 0.3);
    c.hit(1.8, 2.2, 1.5, 0, 1.1, 0, { prompt: function () { var cell = sortState().cells[cd.mode], j = cell.q[0], o = j && j.order ? orderById(j.order) : null; return MODES[cd.mode].name + ' cell · ' + (!powered() ? 'no power' : j ? (j.lift !== undefined ? 'lifting' : MODES[cd.mode].verb) + (o ? ' #' + o.num : '') : 'waiting for a ' + cd.mode + ' parcel') + ' · ' + cell.made + ' done'; }, use: function () { sfx('click'); } });
    // the parcel lift: two masts beside the cell, a platform that rides up to the bridge belt, a guard on the aisle side
    var LX = SORT.liftX, LH = SORT.up + BELT_Y + 0.3; [-0.38, 0.38].forEach(function (mz) { c.box(0.08, LH, 0.08, DG, LX + 0.3, LH / 2, mz); c.box(0.2, 0.02, 0.2, DG, LX + 0.3, 0.01, mz); }); c.box(0.1, 0.1, 0.9, DG, LX + 0.3, LH, 0); c.box(0.06, 0.06, 0.06, glowMat(0xf5b53d, 1.2), LX + 0.3, LH + 0.08, 0);
    var plat = new THREE.Group(); plat.userData.dynamic = true; plat.position.set(LX, BELT_Y - 0.1, 0); c.group.add(plat); box(0.7, 0.05, 0.7, MAT.chequer, 0, 0, 0, plat); box(0.08, 0.3, 0.7, DG, 0.33, 0.15, 0, plat); box(0.7, 0.04, 0.04, MAT.hazard, 0, 0.02, -0.35, plat); box(0.7, 0.04, 0.04, MAT.hazard, 0, 0.02, 0.35, plat); MACH['cell' + cd.mode].liftPlat = plat;
    c.plane(0.8, LH - 0.2, MAT.mesh, LX, LH / 2, 0.42, 0, 0); c.sign(['PARCEL LIFT'], 0.5, 0.1, LX, LH - 0.1, 0.43, 0, { w: 256, h: 56, bg: '#1b232c', fg: '#f5b53d' });
    c.solid(-0.8, 0.8, -0.65, 0.65, 0, 2.1); c.solid(LX - 0.4, LX + 0.4, -0.45, 0.45, 0, LH + 0.2);
  }; }
  function tableBuild(c) {
    var DG = MAT_MACH.frame; c.cyl(0.9, 0.08, DG, 0, BELT_Y - 0.06, 0, 32); c.cyl(0.86, 0.03, MAT_MACH.roller, 0, BELT_Y, 0, 32); c.cyl(0.25, BELT_Y - 0.1, DG, 0, (BELT_Y - 0.1) / 2, 0, 16);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.025, 8, 40), MAT_MACH.guard); ring.rotation.x = Math.PI / 2; ring.position.y = BELT_Y + 0.14; c.group.add(ring); for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2; if (k === 2) continue; c.box(0.03, 0.14, 0.03, DG, Math.cos(a) * 0.95, BELT_Y + 0.07, Math.sin(a) * 0.95); }
    c.box(0.3, 0.5, 0.2, DG, -1.1, 0.9, 0.0); MACH.sortTable.lamps = lampStack(c, -1.1, 1.15, 0); c.sign(['TURNTABLE', 'round again'], 0.6, 0.2, -1.26, 0.8, 0, -Math.PI / 2, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' });
    c.hit(2.0, 1.4, 2.0, 0, 0.7, 0, { prompt: function () { var Z = sortState(); return 'Turntable · ' + (Z.table.length ? Z.table.length + ' parcel' + (Z.table.length > 1 ? 's' : '') + ' waiting to go round again' : 'empty'); }, use: function () { sfx('click'); } });
    c.solid(-1.0, 1.0, -1.0, 1.0, 0, 1.0);
  }
  function scannerBuild(c) {
    var DG = MAT_MACH.frame, LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 });
    [-0.75, 0.75].forEach(function (x) { c.box(0.1, 2.3, 0.1, DG, x, 1.15, 0); c.box(0.24, 0.03, 0.24, DG, x, 0.015, 0); }); c.box(1.7, 0.16, 0.3, DG, 0, 2.3, 0);
    c.box(0.6, 0.12, 0.2, MAT.black, 0, 2.18, 0); c.box(0.5, 0.02, 0.02, glowMat(0xff3b2f, 1.6), 0, 2.11, 0); c.box(0.02, 1.3, 0.02, glowMat(0xff3b2f, 0.8), -0.72, 1.35, 0.06); c.box(0.02, 1.3, 0.02, glowMat(0xff3b2f, 0.8), 0.72, 1.35, 0.06);
    c.sign(['SCAN · LANE READ'], 1.0, 0.16, 0, 2.48, 0.16, 0, { w: 384, h: 64, bg: '#1b232c', fg: '#f5b53d' });
    cabinet(c, -1.25, 1.35, 0.0, 0.5, 0.7, 0.26); sortScreen = touchScreen({ w: 300, h: 220, pw: 0.42, ph: 0.31, x: -1.25, y: 1.42, z: 0.135, ry: 0, parent: c.group, title: 'Sortation deck', draw: sortScreenDraw }); sortScreen.mesh.userData.propId = 'scanner'; eStop(c, -1.05, 0.9, 0.135);
    c.hit(0.6, 1.6, 0.4, -1.25, 1.0, 0, { prompt: function () { return 'Sortation panel'; }, use: function () { sfx('click'); } });
    c.solid(-1.5, -1.0, -0.15, 0.15, 0, 1.9); c.solid(-0.82, -0.68, -0.08, 0.08, 0, 2.4); c.solid(0.68, 0.82, -0.08, 0.08, 0, 2.4);
  }
  function gateBuild(mode) { return function (c) {
    var DG = MAT_MACH.frame; c.box(0.3, 0.9, 0.3, DG, 0, 0.45, 0); c.box(0.5, 0.08, 0.5, DG, 0, 0.04, 0); var arm = c.box(0.9, 0.06, 0.06, MAT.yellow, 0.45, BELT_Y + 0.25, 0); arm.rotation.y = 0;
    c.box(0.06, 0.3, 0.5, std({ color: new THREE.Color(MODES[mode].col), roughness: 0.5 }), 0.9, BELT_Y + 0.25, 0); c.sign([MODES[mode].name.toUpperCase() + ' GATE'], 0.5, 0.14, 0, 1.05, 0.16, 0, { w: 256, h: 64, bg: '#1b232c', fg: MODES[mode].col });
    c.hit(0.5, 1.2, 0.5, 0, 0.6, 0, { prompt: function () { return MODES[mode].name + ' gate · kicks ' + mode + ' parcels down the spiral to ' + dockLabel(MODES[mode].door); }, use: function () { sfx('click'); } }); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 1.0);
  }; }
  // ── The props ─────────────────────────────────────────────────────
  var SF = { cat: 'hall', abs: true, keep: true, fixed: true, rot: 0, when: sorterOwned };
  function sdef(id, extra) { var d = { label: extra.label, cat: SF.cat, abs: SF.abs, keep: SF.keep, fixed: SF.fixed, rot: 0, when: SF.when, x: extra.x || 0, z: extra.z || 0, build: extra.build, after: extra.after }; defProp(id, d); }
  sdef('sortUp', { label: 'parcel spiral and overhead run', build: function (c) { conveyorPath(c, BELTS.sortUp.path); spiralDress(c, SORT.spiral.up.x, SORT.spiral.up.z, R, Y, 0); c.sign(['UP TO THE SORTER'], 0.9, 0.14, 31.4, 1.3, 15.9, 0, { w: 320, h: 64, bg: '#1b232c', fg: '#f5b53d' }); c.sign(['PARCELS · TO THE DECK'], 1.2, 0.18, SORT.inX + 0.5, Y + 1.5, 0, Math.PI / 2, { w: 384, h: 64, bg: '#1b232c', fg: '#f5b53d' }); } });
  sdef('spine', { label: 'sorter spine', build: function (c) { conveyorPath(c, BELTS.spine.path); c.sign(['SORTER SPINE · KEEP CLEAR'], 1.6, 0.2, 10, Y + 1.5, SORT.spineZ + 0.5, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#f5b53d' }); } });
  sdef('collector', { label: 'collector and land spiral', build: function (c) { conveyorPath(c, BELTS.collector.path); spiralDress(c, SORT.spiral.land.x, SORT.spiral.land.z, R, Y, 0); c.sign(['LAND · DOWN TO OUT 2'], 1.0, 0.14, 32.0, Y + 1.2, -12.0, Math.PI / 2, { w: 320, h: 64, bg: '#1b232c', fg: MODES.land.col }); c.sign(['COLLECTOR · TO THE DOCKS'], 1.4, 0.18, 10, Y + 1.5, SORT.collZ + 0.5, 0, { w: 448, h: 64, bg: '#1b232c', fg: '#5fd38d' }); } });
  sdef('spiralSea', { label: 'sea spiral', build: function (c) { conveyorPath(c, BELTS.spiralSea.path); spiralDress(c, SORT.spiral.sea.x, SORT.spiral.sea.z, R, Y, 0); c.sign(['SEA · DOWN TO OUT 1'], 0.9, 0.14, SORT.spiral.sea.x, 1.6, SORT.spiral.sea.z + R + 0.5, 0, { w: 320, h: 64, bg: '#1b232c', fg: MODES.sea.col }); } });
  sdef('spiralAir', { label: 'air spiral', build: function (c) { conveyorPath(c, BELTS.spiralAir.path); spiralDress(c, SORT.spiral.air.x, SORT.spiral.air.z, R, Y, 0); c.sign(['AIR · DOWN TO OUT 3'], 0.9, 0.14, 32.2, 1.6, SORT.spiral.air.z - R - 0.5, Math.PI, { w: 320, h: 64, bg: '#1b232c', fg: MODES.air.col }); } });
  SORT.cells.forEach(function (cd) { sdef('cell' + cd.mode, { label: cd.mode + ' packing cell', x: cd.x, z: SORT.cellZ, build: cellBuild(cd), after: raiseToDeck }); defBelt('cellOut' + cd.mode, { prop: 'cellOut' + cd.mode, path: [[SORT.liftX, 0, Y + SORT.up], [SORT.liftX, SORT.collZ - SORT.cellZ, Y + SORT.up, 'hang']], speedKey: 'sorter', rate: 2, noSink: true }); sdef('cellOut' + cd.mode, { label: cd.mode + ' cell bridge belt', x: cd.x, z: SORT.cellZ, build: function (c) { conveyorPath(c, BELTS['cellOut' + cd.mode].path); } }); });   // the bridge belt from the lift head to the collector, over the corridor
  sdef('sortTable', { label: 'sorter turntable', x: SORT.table.x, z: SORT.table.z, build: tableBuild, after: raiseToDeck });
  sdef('scanner', { label: 'scanner arch', x: SORT.inX, z: SORT.scanZ, build: scannerBuild, after: raiseToDeck });
  sdef('gateSea', { label: 'sea gate', x: SORT.collX - 0.7, z: SORT.gates.sea, build: gateBuild('sea'), after: raiseToDeck });
  sdef('gateAir', { label: 'air gate', x: SORT.collX - 0.7, z: SORT.gates.air, build: gateBuild('air'), after: raiseToDeck });
  SORT.walk.forEach(function (w) { defProp(w.id, { label: 'step-over', cat: 'hall', abs: true, keep: true, fixed: true, x: w.x, z: w.z, rot: w.rot, build: walkoverBuild, after: function (ctx, P, inst) { raiseToDeck(ctx, P, inst); WALKOVERS[inst.id] = P; }, when: sorterOwned }); });
  // the deck's hole for the spirals and the railing gaps the belts pass through, read by the mezzanine build
  function sorterHoles() { return sorterOwned() ? [{ x0: SORT.well.x0, x1: SORT.well.x1, z0: SORT.well.z0, z1: SORT.well.z1 }] : []; }
  function sorterEdgeGaps() { var g = [[22 - 0.7, 22 + 0.7]]; if (sorterOwned()) g.push([SORT.collX - 0.7, 32.3]); return g; }   // the collector and the sea bridge cross the railing; the parcel run clears it by two metres
  function sorterWellRails(c) {
    if (!sorterOwned()) return; var w = SORT.well;
    railRun(c, w.x0, w.x1, w.z0 - 0.12, 'x', Y); railRun(c, w.x0, w.x1, w.z1 + 0.12, 'x', Y); railRun(c, w.z0 - 0.12, w.z1 + 0.12, w.x1 + 0.12, 'z', Y);
    railRun(c, w.z0 - 0.12, w.z1 + 0.12, w.x0 - 0.12, 'z', Y, [[SORT.gates.air - 0.5, SORT.gates.air + 1.4]]);
    c.sign(['SPIRAL WELL', 'keep clear'], 0.9, 0.3, (w.x0 + w.x1) / 2, Y + 1.5, w.z0 - 0.2, Math.PI, { w: 320, h: 100, bg: '#1b232c', fg: '#ff6b5e' });
  }
  function inSorterWell(x, z) { return sorterOwned() && x > SORT.well.x0 && x < SORT.well.x1 && z > SORT.well.z0 && z < SORT.well.z1; }
  // jack 2's bay: out from under the spirals to the north wall, for a save that owns the deck
  function sorterSpots() { if (!S.up.sorter) return; var old = { x: SPOT.jack2.x, z: SPOT.jack2.z }; SPOT.jack2 = { x: SORT.jack2.x, z: SORT.jack2.z }; if (S.jack2 && Math.abs(S.jack2.x - old.x) < 3 && Math.abs(S.jack2.z - old.z) < 3) { S.jack2.x = SPOT.jack2.x; S.jack2.z = SPOT.jack2.z; S.jack2.rot = Math.PI; } }
  function buildSorter() {
    sorterSpots();
    // the shipping belt gives way: its parcels go back on the shelf, or the floor if the shelf is full
    if (propInst.shipBelt) { beltItems('shipBelt').forEach(function (it) { if (it.kind === 'parcel' && it.order) { if (S.bench.parcels.length < 12) S.bench.parcels.push(it.order); else S.floor.push({ kind: 'parcel', order: it.order, x: 31.5, y: 0, z: 16.5, rot: 0 }); } }); beltItems('shipBelt').length = 0; removePropInst('shipBelt'); }
    buildProp('mezz'); buildProp('upperPick');
    ['dockLoader1', 'dockLoader2', 'dockLoader3', 'bay1', 'bay2', 'bay3', 'sortUp', 'spine', 'collector', 'spiralSea', 'spiralAir', 'cellsea', 'cellland', 'cellair', 'cellOutsea', 'cellOutland', 'cellOutair', 'sortTable', 'scanner', 'gateSea', 'gateAir', 'walk1', 'walk2'].forEach(function (id) { buildProp(id); });
    if (!S.speed) S.speed = {}; if (S.speed.sorter === undefined) S.speed.sorter = 1;
    sortD = null; beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); } rebuildBoardSoon();
  }
  // ── Player ────────────────────────────────────────────────────────
  var player = { x: SPOT.spawn.x, y: 0, z: SPOT.spawn.z, yaw: -Math.PI / 2 - 0.4, pitch: 0, vy: 0, grounded: true, keys: {}, locked: false, tool: null, stepT: 0, bob: 0 };
  var ui = { started: false, menuOpen: false, panelOpen: false, scanOpen: false, blocked: function () { return ui.menuOpen || ui.panelOpen; } };
  var buff = { coffeeUntil: 0, coffeeDay: 0 };
  var focus = null, focusText = '';

  function rebuildDyn() {
    dyn.length = 0;
    S.pallets.forEach(function (p) { if (p.place !== 'floor') return; dyn.push({ x0: p.x - 0.65, x1: p.x + 0.65, z0: p.z - 0.65, z1: p.z + 0.65, y0: (p.y || 0) - 0.1, y1: (p.y || 0) + 0.3 + Math.ceil(p.n / 4) * BOX.h }); });
    S.trucks.forEach(function (t) {
      if (t.state === 'gone') return; var b = trailerBounds(t), cabX0 = Math.min(t.x + t.side * TRAILER.len, t.x + t.side * (TRAILER.len + 3.2)), cabX1 = Math.max(t.x + t.side * TRAILER.len, t.x + t.side * (TRAILER.len + 3.2));
      dyn.push({ x0: b.x0, x1: b.x1, z0: b.z0 - 0.12, z1: b.z0, y0: -2, y1: 3 }); dyn.push({ x0: b.x0, x1: b.x1, z0: b.z1, z1: b.z1 + 0.12, y0: -2, y1: 3 });
      var fx = t.x + t.side * TRAILER.len; dyn.push({ x0: fx - 0.08, x1: fx + 0.08, z0: b.z0, z1: b.z1, y0: -2, y1: 3 });
      dyn.push({ x0: cabX0, x1: cabX1, z0: t.z - 1.3, z1: t.z + 1.3, y0: -2, y1: 3 });
      if (t.state !== 'docked') dyn.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: -2, y1: 3 });
    });
    doors.forEach(function (d) { if (d.anim < 0.6) dyn.push({ x0: d.side * HALL.x - 0.3, x1: d.side * HALL.x + 0.3, z0: d.z - DOCKS.w / 2, z1: d.z + DOCKS.w / 2, y0: -2, y1: 9 }); });
    doorSolids(dyn);
    if (S.up.fork) dyn.push({ x0: S.fork.x - 1.0, x1: S.fork.x + 1.0, z0: S.fork.z - 1.0, z1: S.fork.z + 1.0, y0: -1, y1: 2.4, fork: true });
    ['jack', 'jack2'].forEach(function (jt) { if (player.tool !== jt && jackPallet(jt)) { /* a pallet on a parked jack is part of the jack: walk round it */ var jw = toolWorld(jt); dyn.push({ x0: jw.x - 0.7, x1: jw.x + 0.7, z0: jw.z - 0.7, z1: jw.z + 0.7, y0: -1, y1: 1.5 }); } });
  }
  function collides(x, z, ignoreFork) {
    var r = 0.32, y0 = player.y, y1 = player.y + 1.7;
    if (floorY(x, z, player.y) - player.y > 0.5) return true;
    for (var i = 0; i < solids.length; i++) { var s = solids[i]; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r && y0 < s.y1 && y1 > s.y0) return true; }
    for (var k = 0; k < dyn.length; k++) { var d = dyn[k]; if (d.fork && (driving || ignoreFork === 'fork')) continue; if (x > d.x0 - r && x < d.x1 + r && z > d.z0 - r && z < d.z1 + r && y0 < d.y1 && y1 > d.y0) return true; }
    return false;
  }
  function updatePlayer(dt) {
    updateDropMarker();
    if (pc.on) { pcCamera(); return; }
    if (driving) {
      updateFork(dt);
      camera.position.set(S.fork.x - Math.sin(S.fork.yaw) * 0.45, floorY(S.fork.x, S.fork.z) + 1.78, S.fork.z - Math.cos(S.fork.yaw) * 0.45);
      camera.rotation.set(forkLook.pitch, S.fork.yaw + Math.PI + forkLook.yaw, 0, 'YXZ');
      player.x = S.fork.x; player.z = S.fork.z; player.y = floorY(S.fork.x, S.fork.z);
      return;
    }
    var k = player.keys, run = k.ShiftLeft || k.ShiftRight;
    var coffee = buff.coffeeDay === S.day && buff.coffeeUntil > S.time, snack = buff.snackDay === S.day && buff.snackUntil > S.time;
    var speed = 4.0 * (run ? 1.55 : 1) * (coffee ? 1.2 : 1) * (snack ? 1.1 : 1) * (isJack(player.tool) ? (S.up.jackPower ? 1 : jackPallet() ? 0.78 : 0.92) : player.tool ? 0.92 : 1);   /* the powered truck walks at full speed, loaded or not */
    var fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    var mx = 0, mz = 0;
    if (fwd || side) {
      var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
      mx = fx * fwd + rx * side; mz = fz * fwd + rz * side; var l = Math.sqrt(mx * mx + mz * mz); mx /= l; mz /= l;
      var nx = player.x + mx * speed * dt, nz = player.z + mz * speed * dt;
      if (!collides(nx, player.z)) player.x = nx;
      if (!collides(player.x, nz)) player.z = nz;
      player.stepT += speed * dt; player.bob += dt * (run ? 11 : 8);
      if (player.stepT > 2.1) { player.stepT = 0; sfx('step', floorY(player.x, player.z) < -0.5 ? 'outside' : player.y > 2.6 ? 'steel' : insideHall(player.x, player.z) ? 'floor' : 'steel'); }
    } else player.bob *= Math.max(0, 1 - 8 * dt);
    var fy = floorY(player.x, player.z, player.y);
    if (k.Space && player.grounded && !player.jumped) { player.vy = 6.0; player.grounded = false; player.jumped = true; }
    if (!k.Space) player.jumped = false;
    player.vy -= 16 * dt; player.y += player.vy * dt;
    if (player.y <= fy) { if (!player.grounded && player.vy < -6) sfx('putdown'); player.y = fy; player.vy = 0; player.grounded = true; } else player.grounded = false;
    var bobY = (fwd || side) && player.grounded ? Math.sin(player.bob) * 0.03 : 0;
    camera.position.set(player.x, player.y + 1.62 + bobY, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }

  // ── Looking at things ─────────────────────────────────────────────
  var ray = new THREE.Raycaster(); ray.far = 3.4;
  var centre = new THREE.Vector2(0, 0);
  function srcDef(src) {
    if (!src) return null;
    if (src.kind === 'pallet') return { prompt: function () { return palletPrompt(src); }, use: function () { palletUse(src); } };
    if (src.kind === 'shelf') return { prompt: function () { return shelfPrompt(src); }, use: function () { shelfUse(src); } };
    if (src.kind === 'floor') return { prompt: function () { return floorPrompt(src); }, use: function () { floorUse(src); } };
    if (src.kind === 'belt') return { prompt: function () { return beltItemPrompt(src); }, use: function () { beltItemUse(src); } };
    if (src.kind === 'stage') return { prompt: function () { return stagePrompt(src); }, use: function () { stageUse(src); } };
    if (src.kind === 'bench') return { prompt: function () { return benchBoxPrompt(src); }, use: function () { benchBoxUse(src); } };
    return null;
  }
  function interact() {
    focus = null; focusText = '';
    if (!ui.started || ui.blocked() || driving) return;
    ray.setFromCamera(centre, camera);
    if (edit.on) {
      if (edit.grabbed) { if (edit.snapText) { focus = { prompt: function () { return edit.snapText; }, use: function () {} }; focusText = edit.snapText; } return; }
      ray.far = 7; var ph = ray.intersectObjects(scene.children, true); ray.far = 3.4;
      for (var q = 0; q < ph.length; q++) { var pid = propIdOf(ph[q].object); if (!pid) continue; if (ph[q].object.userData.baked || !ph[q].object.visible) continue; var pdef = propDef(pid); if (!pdef) continue; focus = { editId: pid, prompt: function () { return ''; }, use: function () {} }; focusText = 'Grab the ' + pdef.label + '  ·  R turn · Backspace put back · Del remove'; return; }
      return;
    }
    var hits = ray.intersectObjects(inter.concat(instList), false);
    // a touchscreen sits a few centimetres proud of its cabinet, whose hit box can reach past it: within 0.5 m the screen wins, and
    // the hit box of the screen's own prop (the bench round its terminal stand) never beats it at any range. Anything else in
    // front, a box stack say, keeps the focus. The boxes on the bench sit inside the bench's own hit box the same way: within
    // 0.8 m a box wins over the bench.
    for (var si = 1; si < hits.length; si++) {
      var hs = hits[si], isrc = hs.object.isInstancedMesh ? instSource(hs) : null, win = false;
      if (hs.object.userData.screen) { win = true; var spid = propIdOf(hs.object); for (var sj = 0; sj < si; sj++) { var ho = hits[sj].object; if (!(hs.distance - hits[sj].distance < 0.5 || (spid && ho.material === MAT.hit && propIdOf(ho) === spid))) { win = false; break; } } }
      else if (isrc && isrc.kind === 'bench' && hs.distance - hits[0].distance < 0.8) win = true;
      if (win) { hits.unshift(hits.splice(si, 1)[0]); break; }
    }
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], def = h.object.userData.it || srcDef(instSource(h));
      if (!def) continue;
      var txt = def.prompt(); if (!txt) continue;
      focus = def; focusText = txt; break;
    }
  }
  function useFocus() { if (edit.on) { if (edit.grabbed) editDrop(false); else if (focus && focus.editId) editGrab(focus.editId); return; } if (driving) { forkUse(); return; } if (focus) { focus.use(); sfx('click'); interact(); } else if (isJack(player.tool) && jackPallet()) jackSetDown(); }
  // E on open floor with a loaded jack lowers the forks and leaves the pallet where the jack stands
  function jackSetDown() { var p = jackPallet(); if (!p) return; var jt = jackTool(), jm = jackMeshes[jt], w = toolWorld(jt); if (jm && jm.userData.towRy !== undefined) { w.x = jm.position.x; w.z = jm.position.z; w.ry = jm.userData.towRy; } if (!insideHall(w.x, w.z) && floorY(w.x, w.z) < -0.5) { toast('Not out in the yard: set it down inside.', 'bad'); sfx('bad'); return; } p.place = 'floor'; p.x = w.x; p.z = w.z; p.y = floorY(w.x, w.z); p.rot = w.ry; S[jt].pallet = null; sfx('putdown'); toast('Pallet set down', ''); hudDirty = true; }

  // ── Input ─────────────────────────────────────────────────────────
  function lockPointer() { if (!ui.started || ui.blocked()) return; try { var r = canvas.requestPointerLock(); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
  canvas.addEventListener('click', function () { if (ui.started && !ui.blocked() && !player.locked) lockPointer(); });
  document.addEventListener('pointerlockchange', function () { player.locked = document.pointerLockElement === canvas; if (!player.locked) { player.keys = {}; if (ui.started && !ui.blocked() && !ui.suppressMenu) openMenu(); } ui.suppressMenu = false; });
  document.addEventListener('mousemove', function (e) {
    if (!player.locked || ui.blocked()) return;
    var sx = 0.0022 * SET.sens, iy = SET.invertY ? -1 : 1;
    if (pc.on) { pc.look.yaw = clamp(pc.look.yaw - e.movementX * sx, -0.5, 0.5); pc.look.pitch = clamp(pc.look.pitch - e.movementY * sx * iy, -0.35, 0.35); return; }
    if (driving) { forkLook.yaw = clamp(forkLook.yaw - e.movementX * sx, -2.4, 2.4); forkLook.pitch = clamp(forkLook.pitch - e.movementY * sx * iy, -1.2, 1.2); return; }
    player.yaw -= e.movementX * sx; player.pitch = clamp(player.pitch - e.movementY * sx * iy, -1.5, 1.5);
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'F12') { e.preventDefault(); if (ui.started) screenshot(); return; }
    if (e.code === 'F8') { e.preventDefault(); if (ui.started) { if (ui.panelOpen && panel.kind === 'dev') closePanel(); else openPanel('dev'); } return; }
    if (e.code === 'F3') { e.preventDefault(); SET.fps = !SET.fps; $('h-fps').hidden = !SET.fps; saveSettings(); return; }
    var typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
    if (typing && e.code !== 'Escape') return;
    if (!ui.started) return;
    if (e.code === 'Escape') { e.preventDefault(); if (pc.on) { closePc(); return; } if (edit.on && edit.grabbed) { editDrop(true); return; } if (ui.panelOpen) closePanel(); else if (ui.scanOpen) scanToggle(false); else if (ui.menuOpen) closeMenu(); else openMenu(); return; }
    if (ui.blocked()) return;
    if (e.code === 'F2') { e.preventDefault(); if (!driving && !pc.on) editToggle(); return; }
    if (edit.on) {
      if (e.code === 'KeyR') { editRotate(); return; }
      if (e.code === 'Backspace') { e.preventDefault(); editReset(); return; }
      if (e.code === 'Delete') { editRemove(); return; }
      if (e.code === 'KeyC') { openPanel('catalogue'); return; }
      if (e.code === 'KeyE' && !e.repeat) { if (edit.grabbed) editDrop(false); else if (focus && focus.editId) editGrab(focus.editId); return; }
      if (e.code === 'KeyG' && !e.repeat) { if (edit.grabbed) editDrop(true); return; }
    }
    if (e.code === 'Tab') { e.preventDefault(); if (!pc.on) scanToggle(!ui.scanOpen); return; }
    if (ui.scanOpen && /^Digit[1-4]$/.test(e.code)) { scanPage(+e.code.slice(5) - 1); return; }
    player.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyE') useFocus();
    else if (e.code === 'KeyG') { if (driving) stopDrive(); else if (focus && focus.alt) focus.alt(); else putDown(); }
    else if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && driving && !e.repeat) forkGearCycle();
  });
  document.addEventListener('keyup', function (e) { player.keys[e.code] = false; });
  document.addEventListener('wheel', function (e) { if (ui.scanOpen && !ui.blocked()) scanPage((scan.page + (e.deltaY > 0 ? 1 : 3)) % 4); else if (pc.on && pc.screen) { pc.scroll = Math.max(0, pc.scroll + (e.deltaY > 0 ? 1 : -1)); pc.screen.dirty = true; } else if (ui.started && !ui.blocked() && !driving) { var ssc = screenUnderCrosshair(); if (ssc && ssc.scrollable) { ssc.scroll = clamp((ssc.scroll || 0) + (e.deltaY > 0 ? 1 : -1), 0, ssc.scrollMax || 0); ssc.userScrollAt = worldTime; ssc.dirty = true; } } }, { passive: true });
  function screenUnderCrosshair() { for (var i = 0; i < screens.length; i++) { if (!screens[i].mesh.visible) continue; if (ray.intersectObject(screens[i].mesh, false).length) return screens[i]; } return null; }
  window.addEventListener('blur', function () { player.keys = {}; });
  // ── The office PC ─────────────────────────────────────────────────
  var pc = { on: false, app: 'home', scroll: 0, saved: null, look: { yaw: 0, pitch: 0 }, screen: null };
  var PC_APPS = [['home', '🏠', 'Desktop'], ['orders', '📦', 'Orders'], ['contracts', '📝', 'Contracts'], ['shop', '🛒', 'Shop'], ['staff', '👷', 'Staff'], ['bank', '🏦', 'Bank'], ['stock', '🗄', 'Stock'], ['factory', '🏭', 'Production'], ['plant', '⚙', 'Plant'], ['stats', '📊', 'Stats']];
  // every machine on one page: status, dial, and the one button each has on its own screen (pause, clear a jam, start, eject, bale, hold)
  function plantRows() {
    var rows = [], pct = function (key) { return Math.round(speedOf(key) * 100) + '%'; };
    var dialRow = function (name, key) { rows.push({ text: '   ' + name + ' dial', sub: 'tap to step the speed', right: pct(key), key: key, dialOnly: true, btn: { label: pct(key) + ' ▸', on: true, act: function () { speedCycle(key); }, col: '#78bdf5' } }); };
    var add = function (name, status, sub, key, action) { rows.push({ text: name + '  ·  ' + status, sub: sub, right: key ? pct(key) : '', key: key, hi: status === 'run' || status === 'running' || status === 'sorting', btnIsDial: !action && !!key, btn: action || (key ? { label: pct(key) + ' ▸', on: true, act: function () { speedCycle(key); }, col: '#78bdf5' } : null) }); if (action && key) dialRow(name, key); };
    if (propInst.packline) add('Pack line', packStatus(), packPrompt(), 'packline', S.pack.jam ? { label: 'CLEAR JAM', on: true, act: packUse, col: '#ff6b5e' } : S.up.plantAuto ? { label: S.pack.auto === false ? 'AUTO OFF' : 'AUTO ON', on: true, act: function () { S.pack.auto = S.pack.auto === false; sfx('click'); }, col: S.pack.auto === false ? '#f5b53d' : '#5fd38d' } : null);
    var surP = surplusCount(); if (surP) rows.push({ text: 'Bench surplus  ·  ' + surP + ' box' + (surP > 1 ? 'es' : ''), sub: 'boxes no open order wants, on the bench or loose on the floor', hi: true, btn: { label: 'RETURN ALL', on: true, act: function () { returnSurplus(); }, col: '#f5b53d' } });
    if (propInst.moulder) add('Moulding line', factoryStatus(), moulderPrompt(), 'moulder', { label: S.factory.jam ? 'CLEAR JAM' : S.factory.on ? 'STOP' : 'START', on: true, act: moulderUse, col: S.factory.jam ? '#ff6b5e' : S.factory.on ? '#f5b53d' : '#5fd38d' });
    if (propInst.palletiser) add('Palletiser', S.pal.n ? 'run' : 'idle', palletiserPrompt(), 'beltMain', { label: 'EJECT', on: S.pal.n > 0, act: palletiserUse, col: '#f5b53d' });
    if (propInst.baler) add('Baler', balerStatus(), balerPrompt(), 'baler', { label: 'BALE', on: S.baler.card >= BALE_NEED && !S.baler.t, act: balerUse, col: '#f5b53d' });
    if (propInst.wrapper) add('Stretch wrapper', wrapperStatus(), 'film ' + S.wrap.film + ' pallets · wrapped ' + S.wrap.wrapped, 'wrapper', null);
    if (S.up.agv && propInst.agvDock) { var A = agvState(); add('AGV-1', A.paused && A.state === 'idle' ? 'paused' : A.state, agvPrompt(), 'agv', { label: A.paused ? 'RESUME' : 'PAUSE', on: true, act: function () { A.paused = !A.paused; sfx('click'); }, col: A.paused ? '#5fd38d' : '#f5b53d' }); }
    if (S.up.gantry) { gantryRows().forEach(function (r) { var G = gantryState(r); add('Gantry ' + (r >= UPPER.row ? 'upper' : 'ABCDEF'[r]), G.paused && G.state === 'idle' ? 'paused' : G.state, gantryPrompt(r), 'gantry' + r, { label: G.paused ? 'RESUME' : 'PAUSE', on: true, act: function () { G.paused = !G.paused; sfx('click'); }, col: G.paused ? '#5fd38d' : '#f5b53d' }); }); dialRow('Pick belts', 'pickBelt'); }
    for (var lid in LOADER_DOORS) if (propInst[lid]) add('Dock loader ' + dockLabel(LOADER_DOORS[lid]), dockLoaderStatus(LOADER_DOORS[lid]), dockLoaderPrompt(LOADER_DOORS[lid]) + ' · ' + stageOf(lid).length + ' in the bay', null, null);
    if (S.up.shipbelt && propInst.shipBelt) dialRow('Shipping belt', 'shipBelt');
    if (upperOwned() && propInst.lift) { var L = liftState(); add('Goods lift', L.state, 'lifted ' + (S.stats.lifted || 0) + ' pallets · racked upstairs ' + (S.stats.upperIn || 0), null, { label: L.hold ? 'RELEASE' : 'HOLD', on: true, act: function () { L.hold = !L.hold; sfx('click'); }, col: L.hold ? '#5fd38d' : '#f5b53d' }); }
    if (sorterOwned() && propInst.spine) { var Z = sortState(); add('Sortation deck', SORT.cells.some(function (cd) { return Z.cells[cd.mode].q.length; }) ? 'sorting' : 'ready', 'read ' + Z.scanned + ' · sorted ' + Z.sorted + ' · turntable ' + Z.table.length + (S.up.deckNight ? ' · night shift on' : ''), 'sorter', null); }
    if (!rows.length) rows.push({ text: 'No machines yet', sub: 'the pack line comes with the bench; the rest is in the shop', col: '#a0acb8' });
    return rows;
  }
  function openPc() {
    if (pc.on || driving) return;
    if (S.events.power) { toast('No power.', 'bad'); return; }
    pc.on = true; pc.app = pc.app || 'home'; pc.scroll = 0; pc.look.yaw = 0; pc.look.pitch = 0;
    pc.saved = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch };
    if (player.tool) releaseTool();
    sfx('click'); introStep('pc'); screenDirtyAll(); hudDirty = true;
    $('h-drive').hidden = false; $('h-drive').innerHTML = 'Office PC · aim at a button and <b>E</b> taps it · mouse wheel scrolls a list · <b>Esc</b> or <b>WASD</b> stands up';
  }
  function closePc() { if (!pc.on) return; pc.on = false; $('h-drive').hidden = true; if (pc.saved) { player.x = pc.saved.x; player.z = pc.saved.z; player.yaw = pc.saved.yaw; player.pitch = pc.saved.pitch; } sfx('click'); hudDirty = true; }
  // where to sit: in front of the desk prop, facing the monitor
  function pcSeat() { var P = propPlacement('desk'), a = P.rot * Math.PI / 2, lx = 0, lz = -0.5; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), yaw: a + Math.PI }; }
  function pcCamera() { var s = pcSeat(); camera.position.set(s.x, 1.33, s.z); camera.rotation.set(-0.06 + pc.look.pitch, s.yaw + pc.look.yaw, 0, 'YXZ'); player.x = s.x; player.z = s.z; }
  function pcRows(sc, rows, y0, rowH) {
    var c = sc.ctx, maxRows = Math.floor((sc.h - y0 - 90) / rowH), start = clamp(pc.scroll, 0, Math.max(0, rows.length - maxRows)), y = y0;   // 90: the two-row taskbar
    pc.scroll = start;
    rows.slice(start, start + maxRows).forEach(function (r) {
      c.fillStyle = r.hi ? 'rgba(245,181,61,0.1)' : 'rgba(255,255,255,0.04)'; c.fillRect(16, y, sc.w - 32, rowH - 6);
      if (r.sw) { c.fillStyle = r.sw; c.fillRect(24, y + 10, 10, 10); }
      scText(c, r.sw ? 42 : 26, y + 19, String(r.text).slice(0, 70), r.col || '#eef1f5', 14); if (r.sub) scText(c, r.sw ? 42 : 26, y + 36, String(r.sub).slice(0, 96), '#a0acb8', 11);
      if (r.right !== undefined) { c.fillStyle = r.rcol || '#f5b53d'; c.font = 'bold 14px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(String(r.right), sc.w - (r.btn ? 130 : 26), y + 19); c.textAlign = 'left'; }
      if (r.btn) scButton(sc, sc.w - 118, y + 6, 96, rowH - 18, r.btn.label, !!r.btn.on, r.btn.act, r.btn.col);
      y += rowH;
    });
    if (rows.length > maxRows) { scButton(sc, sc.w - 60, y0 - 34, 20, 22, '▲', false, function () { pc.scroll = Math.max(0, pc.scroll - 1); }); scButton(sc, sc.w - 36, y0 - 34, 20, 22, '▼', false, function () { pc.scroll = pc.scroll + 1; }); c.fillStyle = '#6b7784'; c.font = '11px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText((start + 1) + '-' + Math.min(rows.length, start + maxRows) + ' of ' + rows.length, sc.w - 66, y0 - 18); c.textAlign = 'left'; }
    if (!rows.length) scText(c, 26, y0 + 24, 'Nothing here.', '#6b7784', 14);
  }
  function drawPc(c, sc) {
    var w = sc.w, h = sc.h;
    if (S.events.power) { c.fillStyle = '#05080a'; c.fillRect(0, 0, w, h); return; }
    scBg(c, w, h, 'rgba(120,189,245,0.18)');
    // the taskbar
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, h - 84, w, 84);   // two rows of five since the Plant app: ten in one row left the last one a sliver
    var perRow = Math.ceil(PC_APPS.length / 2), bw = Math.floor((w - 16 - 8 * (perRow - 1)) / perRow);
    PC_APPS.forEach(function (a, i) { var row = Math.floor(i / perRow), col = i % perRow; scButton(sc, 8 + col * (bw + 8), h - 80 + row * 40, bw, 34, a[1] + ' ' + a[2], pc.app === a[0], function () { pc.app = a[0]; pc.scroll = 0; }, '#78bdf5'); });
    c.fillStyle = '#a0acb8'; c.font = '12px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText('Day ' + S.day + ' · ' + fmtTime(S.time), w - 10, 14); c.textAlign = 'left';
    var app = pc.app;
    if (app === 'home') {
      scText(c, 24, 48, 'DEPOT OS', '#f5b53d', 34); scText(c, 24, 72, 'Depot Co. · ' + (S.weather ? S.weather.kind : 'clear') + ' · ' + SEASONS[season()] + (isSunday() ? ' · Sunday, closed' : ''), '#a0acb8', 14);
      var kp = [['Bank', money(S.bank)], ['Open orders', String(openOrders().length)], ['In stock', totalStock() + ' boxes'], ['Reputation', String(Math.round(S.rep))], ['Level', S.level + ' · ' + S.xp + '/' + XP_FOR(S.level)], ['Crew', S.staff.length + ' (' + S.staff.filter(function (s) { return s.clocked; }).length + ' on the clock)']];
      kp.forEach(function (k, i) { var x = 24 + (i % 3) * 250, y = 100 + Math.floor(i / 3) * 90; c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, y, 234, 76); scText(c, x + 14, y + 26, k[0].toUpperCase(), '#6b7784', 11); scText(c, x + 14, y + 58, k[1], '#eef1f5', 24); });
      var last = S.log.slice(0, 5); scText(c, 24, 300, 'RECENT', '#6b7784', 11); last.forEach(function (l, i) { scText(c, 24, 322 + i * 20, 'D' + l.day + ' ' + l.t + '  ' + l.msg.slice(0, 90), l.kind === 'bad' ? '#ff6b5e' : l.kind === 'good' ? '#5fd38d' : '#eef1f5', 12); });
    } else if (app === 'orders') {
      scHead(c, w, 'ORDERS', openOrders().length + ' open');
      var rows = S.orders.slice().sort(function (a, b) { return a.due - b.due; }).map(function (o) { return { text: '#' + o.num + '  ' + clientName(o.client) + (o.rush ? '  RUSH' : '') + (o.late ? '  LATE' : ''), sub: o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · due ' + dueText(o.due) + ' · ' + o.state, right: money(o.pay), col: o.late || o.rush ? '#ff6b5e' : '#eef1f5', hi: o.state !== 'open' }; });
      S.shipped.slice(0, 6).forEach(function (s) { rows.push({ text: 'shipped #' + s.num + '  ' + clientName(s.client) + (s.late ? '  late' : '') + (s.short ? '  short' : ''), sub: 'day ' + s.day, right: money(s.paid), rcol: '#5fd38d', col: '#a0acb8' }); });
      pcRows(sc, rows, 60, 46);
    } else if (app === 'contracts') {
      scHead(c, w, 'CONTRACTS'); var ct = S.contract, rows2 = [];
      if (!ct) rows2.push({ text: 'No offer on the table', sub: S.level < 3 ? 'Reach level 3 and the clients start asking.' : 'Next offer around day ' + S.nextOffer + '.' });
      else if (!ct.accepted) { rows2.push({ text: clientName(ct.client) + ' offers a contract', sub: ct.need + ' orders on time by ' + dueText(ct.until) + ' · bonus ' + money(ct.bonus) + ' · penalty ' + money(ct.penalty), btn: { label: 'ACCEPT', on: true, act: function () { ct.accepted = true; sfx('chime'); toast('Contract accepted', 'good'); logEvent('Accepted the contract from ' + clientName(ct.client), 'good'); }, col: '#5fd38d' }, hi: true }); rows2.push({ text: 'Decline', sub: 'The next offer comes in a couple of days.', btn: { label: 'DECLINE', on: false, act: function () { logEvent('Declined the contract from ' + clientName(ct.client)); S.contract = null; S.nextOffer = S.day + 2; } } }); }
      else rows2.push({ text: clientName(ct.client) + ' · ' + ct.done + ' of ' + ct.need + ' on time', sub: 'until ' + dueText(ct.until) + ' · bonus ' + money(ct.bonus) + ' · penalty ' + money(ct.penalty), right: Math.round(100 * ct.done / ct.need) + '%', hi: true });
      rows2.push({ text: 'How it works', sub: 'Every order of theirs shipped on time in the window counts. Miss the number and the penalty is taken. Contract clients order more while it runs.', col: '#a0acb8' });
      pcRows(sc, rows2, 60, 50);
    } else if (app === 'shop') {
      scHead(c, w, 'SHOP', money(S.bank) + ' · level ' + S.level);
      var rows3 = UPGRADES.map(function (u) { var rowN = /^row(\d)$/.test(u.id) ? +u.id.slice(3) : 0, owned = rowN ? S.up.rows >= rowN : !!S.up[u.id]; var needs = rowN && S.up.rows < rowN - 1 ? 'needs the previous row' : u.needs && !S.up[u.needs] ? 'needs ' + upgradeName(u.needs).toLowerCase() : S.level < u.lvl ? 'level ' + u.lvl : S.bank < u.price ? 'not enough money' : ''; return { text: u.name + (owned ? '  ·  owned' : ''), sub: u.desc, right: money(u.price), btn: owned ? null : { label: needs ? needs.toUpperCase().slice(0, 14) : 'BUY', on: !needs, act: function () { if (!needs) buyUpgrade(u.id); }, col: '#5fd38d' } }; });
      pcRows(sc, rows3, 60, 50);
    } else if (app === 'staff') {
      scHead(c, w, 'STAFF', S.staff.length + ' of ' + staffCap());
      var rows4 = Object.keys(STAFF_ROLES).map(function (r) { var d = STAFF_ROLES[r], locked = S.level < d.lvl || (d.needs && !S.up[d.needs]); return { text: 'Hire a ' + d.name.toLowerCase() + '  ·  ' + money(d.wage / 10) + '/h', sub: d.desc, btn: { label: locked ? (S.level < d.lvl ? 'LEVEL ' + d.lvl : 'NEEDS THE FORKLIFT') : S.staff.length >= staffCap() ? 'FULL' : 'HIRE', on: !locked && S.staff.length < staffCap(), act: function () { if (!locked && S.staff.length < staffCap()) { hireStaff(r); toast('Hired a ' + d.name.toLowerCase(), 'good'); } }, col: '#5fd38d' } }; });
      S.staff.forEach(function (st) { var sheet = st.sheet || [], hrs = sheet.reduce(function (a, r) { return a + r.h; }, 0), paid = sheet.reduce(function (a, r) { return a + r.pay; }, 0);
        rows4.push({ text: '   ' + st.name + ': ' + (st.shift || 'day') + ' shift' + (st.trained ? ' · trained' : '') + (st.raise ? ' · raised' : '') + (st.cross ? ' · also ' + STAFF_ROLES[st.cross].name.toLowerCase() : ''), sub: 'shift ' + fmtTime(shiftStart(st)) + ' to ' + fmtTime(shiftOf(st).end) + ' · course $' + TRAIN_PRICE + ' · raise $' + RAISE_PRICE + ' · second role $' + CROSS_PRICE, col: '#a0acb8', btn: { label: 'SHIFT ▸', on: true, act: function () { staffShiftCycle(st); }, col: '#78bdf5' } });
        rows4.push({ text: '   ' + st.name + ': ' + (st.trained ? 'trained' : 'training course'), sub: st.trained ? 'walks a fifth faster and finishes every task step a third sooner' : 'quicker on their feet and at every task', col: '#a0acb8', btn: { label: st.trained ? 'DONE' : 'TRAIN', on: !st.trained && S.bank >= TRAIN_PRICE, act: function () { staffTrain(st); }, col: '#5fd38d' } });
        rows4.push({ text: '   ' + st.name + ': ' + (st.raise ? 'on the raised rate' : 'a raise'), sub: st.raise ? money(hourly(st)) + ' an hour, on time every day' : '10% more an hour, and timekeeping stops being a problem', col: '#a0acb8', btn: { label: st.raise ? 'DONE' : 'RAISE', on: !st.raise && S.bank >= RAISE_PRICE, act: function () { staffRaise(st); }, col: '#5fd38d' } });
        rows4.push({ text: '   ' + st.name + ': second role' + (st.cross ? ' · ' + STAFF_ROLES[st.cross].name.toLowerCase() : ''), sub: 'covers the other job when their own queue is empty; tap to choose the role', col: '#a0acb8', btn: { label: st.cross ? 'NEXT ▸' : 'CHOOSE', on: st.crossPaid || S.bank >= CROSS_PRICE, act: function () { staffCrossCycle(st); }, col: '#78bdf5' } });
        rows4.push({ text: st.name + '  ·  ' + STAFF_ROLES[st.role].name + '  ·  ' + staffStatus(st), sub: 'today ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h · last 7 days ' + (Math.round(hrs * 10) / 10) + ' h, ' + money(paid) + ' · punctuality ' + Math.round((st.punct || 0.5) * 100) + '%' + (st.lateToday ? ' · late today' : ''), hi: !!st.clocked, btn: { label: 'LET GO', on: false, act: function () { fireStaff(st.id); }, col: '#ff6b5e' } }); });
      pcRows(sc, rows4, 60, 50);
    } else if (app === 'plant') {
      scHead(c, w, 'PLANT', powered() ? 'mains ok' : 'NO POWER');
      pcRows(sc, plantRows(), 60, 50);
    } else if (app === 'bank') {
      scHead(c, w, 'BANK', money(S.bank));
      var rows5 = [
        { text: 'Loan', sub: S.loan > 0 ? money(S.loan) + ' outstanding · 1.5% a day (' + money(Math.round(S.loan * 0.015)) + ')' : 'Borrow $5,000 at 1.5% a day from level 2. Repay when you can.', right: S.loan > 0 ? money(S.loan) : '', btn: S.loan > 0 ? { label: 'REPAY', on: S.bank > 0, act: function () { var amt = Math.min(S.loan, Math.max(0, S.bank)); if (amt > 0) { S.loan -= amt; pay(-amt, 'Loan repayment'); sfx('cash'); toast('Repaid ' + money(amt), 'good'); } }, col: '#5fd38d' } : { label: 'BORROW', on: S.level >= 2, act: function () { if (S.level >= 2 && S.loan <= 0) { S.loan = 5000; pay(5000, 'Bank loan'); sfx('cash'); toast('$5,000 in the bank. 1.5% a day.', 'good'); } }, col: '#f5b53d' } },
        { text: 'Theft insurance', sub: '$40 a day. Pays 80% of the value of anything that walks off at night.', right: S.insured ? 'insured' : '', btn: { label: S.insured ? 'CANCEL' : 'INSURE', on: !S.insured, act: function () { S.insured = !S.insured; toast(S.insured ? 'Insured from tonight' : 'Insurance cancelled', ''); }, col: '#78bdf5' } },
        { text: 'Earned ' + money(S.stats.earned) + '  ·  spent ' + money(S.stats.spent) + '  ·  fines ' + money(S.stats.fines), sub: 'daily costs: rent ' + money(ECON.rent) + ' + the crew by the hour' + (S.insured ? ' + $40 insurance' : '') + (S.loan ? ' + loan interest' : ''), col: '#a0acb8' }
      ];
      S.ledger.slice(0, 8).forEach(function (l) { rows5.push({ text: l.why, sub: 'day ' + l.day + ' · ' + l.t, right: money(l.n), rcol: l.n < 0 ? '#ff6b5e' : '#5fd38d', col: '#a0acb8' }); });
      pcRows(sc, rows5, 60, 48);
    } else if (app === 'stock') {
      var sum = stockSummary(), keys = Object.keys(sum).sort(); scHead(c, w, 'STOCK', totalStock() + ' boxes · ' + Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length + '/' + (S.up.rows * RACK.bays * RACK.levels.length) + ' slots');
      var rows6 = keys.map(function (k) { var need = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === k) need += l.qty; }); }); return { sw: SKU[k].col, text: skuName(k) + '  ·  ' + money(SKU[k].val) + ' each', sub: slotsWith(k).map(slotName).slice(0, 4).join(', '), right: sum[k] + (need ? '  (' + need + ' needed)' : ''), rcol: need > sum[k] ? '#ff6b5e' : '#f5b53d' }; });
      pcRows(sc, rows6, 60, 44);
    } else if (app === 'factory') {
      var F = S.factory; scHead(c, w, 'PRODUCTION', factoryStatus().toUpperCase());
      var rowsF = [
        { text: 'Hopper: ' + F.raw + ' / ' + HOPPER_CAP + ' units of raw granulate', sub: 'A pallet of 8 sacks is ' + 8 * RAW_PER_SACK + ' units, one unit a box. Tip pallets in at the hopper in the production wing.', right: F.rawOrdered ? F.rawOrdered + ' on order' : '', btn: { label: 'ORDER $' + ECON.rawPrice, on: S.bank >= ECON.rawPrice, act: function () { if (S.bank < ECON.rawPrice) { sfx('bad'); return; } pay(-ECON.rawPrice, 'Raw granulate, one pallet'); F.rawOrdered++; sfx('cash'); toast('A pallet of raw granulate comes with the next inbound truck', 'good'); } } },
        { text: 'Moulding line: ' + (F.on ? 'running' : 'stopped') + ' · ' + skuName(F.product), sub: FACTORY_RATE + ' s a box · made ' + F.made + ' so far · boxes go by belt to the palletiser in the hall', btn: { label: F.on ? 'STOP' : 'START', on: true, act: function () { moulderUse(); }, col: F.on ? '#ff6b5e' : '#5fd38d' } }
      ];
      ownSkus().forEach(function (s) { rowsF.push({ sw: s.col, text: s.name + ' · ' + money(s.val) + ' a box to the clients', sub: 'in stock ' + stockCount(s.id) + (s.tier > tierFor(S.level) ? ' · clients ask for it from level ' + (s.tier === 2 ? 2 : 4) : ''), btn: { label: F.product === s.id ? 'SELECTED' : 'SELECT', on: F.product !== s.id, act: function () { F.product = s.id; sfx('click'); } } }); });
      rowsF.push({ text: 'Baler: ' + S.baler.card + ' / ' + BALE_NEED + ' cardboard · ' + S.baler.bales + ' bales waiting · ' + S.baler.made + ' made', sub: 'Binned boxes and packing offcuts fill it. Outbound trucks take bales at ' + money(BALE_PRICE) + ' each. Wrapper film left: ' + S.wrap.film + '.', col: '#a0acb8' });
      rowsF.push({ text: 'Pallets finished by the palletiser: ' + (S.stats.palletised || 0) + ' · parcels off the pack line: ' + S.pack.made, sub: 'Finished pallets drop beside the palletiser; rack them like any delivery. Clients start ordering your own goods once they have seen them.', col: '#a0acb8' });
      pcRows(sc, rowsF, 60, 50);
    } else if (app === 'stats') {
      scHead(c, w, 'STATS', 'day ' + S.day); var st2 = S.stats;
      var rows7 = [['Pallets received', st2.received], ['Boxes put away', st2.putaway], ['Boxes picked', st2.picked], ['Orders packed', st2.packed], ['Orders shipped', st2.shipped], ['Late', st2.late], ['Pallets refused', st2.lost], ['Damaged boxes binned', S.binned || 0], ['Your hours on the clock', Math.round((st2.hoursWorked || 0) * 10) / 10], ['Reputation', Math.round(S.rep)], ['Level', S.level]].map(function (k) { return { text: k[0], right: String(k[1]) }; });
      pcRows(sc, rows7, 60, 34);
    }
  }
  function tickPc(dt) {
    if (!pc.on) return;
    pcCamera();
    if (pc.screen && Math.floor(worldTime * 2) !== pc.q) { pc.q = Math.floor(worldTime * 2); pc.screen.dirty = true; }
    var k = player.keys; if (k.KeyW || k.KeyA || k.KeyS || k.KeyD) closePc();
  }
  // ── The scanner device ────────────────────────────────────────────
  var scanDev = { g: null, canvas: null, ctx: null, tex: null, t: 0, redrawT: 0, laser: null, laserT: 0, lastFocusSlot: null };
  function buildScanner() {
    var g = new THREE.Group(); g.userData.dynamic = true; handGroup.add(g); scanDev.g = g;
    var body = std({ color: 0x2b3038, roughness: 0.55 }), rub = std({ color: 0x1b1e23, roughness: 0.95 });
    box(0.095, 0.21, 0.028, body, 0, 0, 0, g); box(0.1, 0.03, 0.03, rub, 0, 0.105, 0, g); box(0.1, 0.03, 0.03, rub, 0, -0.105, 0, g); box(0.012, 0.21, 0.03, rub, -0.05, 0, 0, g); box(0.012, 0.21, 0.03, rub, 0.05, 0, 0, g);
    box(0.06, 0.016, 0.02, glowMat(0xff2a1a, 0.5), 0, 0.118, 0.0, g);   // the scan window
    var grip = box(0.05, 0.12, 0.04, rub, 0, -0.1, -0.035, g); grip.rotation.x = 0.5; box(0.03, 0.02, 0.02, MAT.yellow, 0, -0.05, -0.05, g);   // the pistol grip and its trigger
    for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) box(0.016, 0.012, 0.006, c === 0 && r === 0 ? MAT.yellow : std({ color: 0x4a515b, roughness: 0.6 }), -0.03 + c * 0.02, -0.04 - r * 0.018, 0.016, g);
    var cv = document.createElement('canvas'); cv.width = 240; cv.height = 300; scanDev.canvas = cv; scanDev.ctx = cv.getContext('2d');
    var tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 8; scanDev.tex = tx;
    var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.1), new THREE.MeshBasicMaterial({ map: tx })); scr.position.set(0, 0.04, 0.015); g.add(scr);
    var gl = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.1), MAT.screenGlass); gl.position.set(0, 0.04, 0.0165); gl.renderOrder = 2; g.add(gl);
    var laser = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.004), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false })); laser.position.set(0, 0.16, 0.6); scanDev.laser = laser; g.add(laser);
    sign(['DEPOT CO.'], 0.06, 0.012, 0, -0.098, 0.015, 0, { w: 256, h: 48, bg: '#2b3038', fg: '#a0acb8' }, g);
    g.position.set(0.3, -0.62, -0.42); g.rotation.set(-0.45, -0.35, 0.1); g.scale.set(1.7, 1.7, 1.7); g.visible = false;
    drawScanner();
  }
  function scanRow(c, y, sw, text, sub, right, hi) {
    c.fillStyle = hi ? 'rgba(245,181,61,0.12)' : 'rgba(255,255,255,0.05)'; c.fillRect(8, y - 13, 224, sub ? 30 : 20);
    if (sw) { c.fillStyle = sw; c.fillRect(12, y - 8, 8, 8); }
    c.fillStyle = '#eef1f5'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.fillText(String(text).slice(0, 30), sw ? 26 : 12, y);
    if (sub) { c.fillStyle = '#a0acb8'; c.font = '9px Bahnschrift, Arial, sans-serif'; c.fillText(String(sub).slice(0, 44), sw ? 26 : 12, y + 11); }
    if (right !== undefined) { c.fillStyle = hi ? '#5fd38d' : '#f5b53d'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(String(right), 228, y); c.textAlign = 'left'; }
    return y + (sub ? 34 : 24);
  }
  function drawScanner() {
    var c = scanDev.ctx; if (!c) return; var w = 240, h = 300;
    c.fillStyle = '#0a0f13'; c.fillRect(0, 0, w, h); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(245,181,61,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f5b53d'; c.font = 'bold 13px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.fillText(SCAN_PAGES[scan.page].toUpperCase(), 10, 18);
    c.fillStyle = '#a0acb8'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(fmtTime(S.time) + '  ▮▮▮', 230, 18); c.textAlign = 'left';
    for (var p = 0; p < 4; p++) { c.fillStyle = p === scan.page ? '#f5b53d' : 'rgba(255,255,255,0.18)'; c.fillRect(10 + p * 56, 24, 50, 3); }
    var y = 46;
    if (scan.page === 0) {
      var os = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed' || o.state === 'loaded'; }).sort(function (a, b) { return a.due - b.due; });
      if (!os.length) { c.fillStyle = '#6b7784'; c.font = '11px Bahnschrift, Arial'; c.fillText('No orders. They arrive from 08:30.', 12, y + 10); }
      os.slice(0, 4).forEach(function (o) {
        c.fillStyle = o.late ? '#ff6b5e' : o.rush ? '#ff6b5e' : '#f5b53d'; c.font = 'bold 11px Bahnschrift, Arial'; c.fillText('#' + o.num + ' ' + clientName(o.client).slice(0, 18) + (o.state !== 'open' ? ' · ' + o.state.toUpperCase() : ''), 12, y); c.fillStyle = '#a0acb8'; c.font = '9px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText('due ' + fmtTime(o.due % 24), 228, y); c.textAlign = 'left'; y += 14;
        if (o.state === 'open') o.lines.forEach(function (l) { if (y > h - 20) return; var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0), where = slotsWith(l.sku).filter(function (k) { return slotParse(k).l < RACK.top; })[0]; y = scanRow(c, y, SKU[l.sku].col, skuName(l.sku), where ? slotName(where) : (stockCount(l.sku) ? 'top level only' : 'not in stock'), have + '/' + l.qty, have >= l.qty); });
        y += 4;
      });
      // one pick list for every open order together, less what the bench already holds, and the surplus the bench carries
      var need = benchNeed(), nk = Object.keys(need), sur = benchSurplus(), sn = 0; for (var sk in sur) sn += sur[sk];
      if ((nk.length || sn) && y < h - 34) { c.fillStyle = '#5fd38d'; c.font = 'bold 11px Bahnschrift, Arial'; c.fillText('STILL TO PICK', 12, y + 4); y += 16; nk.slice(0, 3).forEach(function (k) { if (y > h - 20) return; var where = slotsWith(k).filter(function (q) { return slotParse(q).l < RACK.top; })[0]; y = scanRow(c, y, SKU[k].col, need[k] + ' × ' + skuName(k), where ? slotName(where) : 'not on the racks'); }); if (!nk.length) y = scanRow(c, y, null, 'Nothing: the bench has every box', ''); if (sn && y <= h - 20) y = scanRow(c, y, null, sn + ' surplus on the bench', 'E on the bench with the cart'); }
    } else if (scan.page === 1) {
      var any = false;
      S.trucks.forEach(function (t) { if (t.dir !== 'in' || t.state !== 'docked') return; var ps = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id; }); any = true; c.fillStyle = '#f5b53d'; c.font = 'bold 11px Bahnschrift, Arial'; c.fillText(dockLabel(t.dock) + ' · ' + ps.length + ' pallets · leaves ' + fmtTime(t.leave), 12, y); y += 14; if (!t.signed) { c.fillStyle = '#ff6b5e'; c.font = '9px Bahnschrift, Arial'; c.fillText('Delivery note not signed', 12, y); y += 12; } ps.slice(0, 5).forEach(function (p) { if (y > h - 20) return; var k = findSlotFor(p.sku, p.n, 1); y = scanRow(c, y, SKU[p.sku].col, p.n + ' × ' + skuName(p.sku), k ? '→ ' + slotName(k) : 'no rack space', undefined, false); }); });
      var fl = S.pallets.filter(function (p) { return p.place === 'floor'; });
      if (fl.length) { any = true; c.fillStyle = '#f5b53d'; c.font = 'bold 11px Bahnschrift, Arial'; c.fillText('On the floor', 12, y); y += 14; fl.slice(0, 4).forEach(function (p) { if (y > h - 20) return; var k = findSlotFor(p.sku, p.n, 1); y = scanRow(c, y, SKU[p.sku].col, p.n + ' × ' + skuName(p.sku) + (p.wrapped ? ' (wrapped)' : ''), k ? '→ ' + slotName(k) : 'no rack space'); }); }
      if (S.floor.length) { any = true; y = scanRow(c, y, null, S.floor.length + ' loose on the floor', 'the inspector counts these'); }
      if (!any) { c.fillStyle = '#6b7784'; c.font = '11px Bahnschrift, Arial'; c.fillText('Nothing to put away.', 12, y + 10); c.fillText('Trucks: ' + TRUCK_IN.map(fmtTime).join(', '), 12, y + 26); }
    } else if (scan.page === 2) {
      var sum = stockSummary(), keys = Object.keys(sum).sort(function (a, b) { return sum[b] - sum[a]; });
      var used = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length;
      c.fillStyle = '#a0acb8'; c.font = '10px Bahnschrift, Arial'; c.fillText(used + ' / ' + (slotTotal()) + ' slots · ' + totalStock() + ' boxes', 12, y); y += 16;
      if (!keys.length) { c.fillStyle = '#6b7784'; c.font = '11px Bahnschrift, Arial'; c.fillText('The racks are empty.', 12, y + 10); }
      keys.slice(0, 8).forEach(function (k) { if (y > h - 20) return; y = scanRow(c, y, SKU[k].col, skuName(k), slotsWith(k).slice(0, 2).map(slotName).join(' · '), sum[k], true); });
    } else {
      c.fillStyle = '#a0acb8'; c.font = '10px Bahnschrift, Arial'; c.fillText('Day ' + S.day + ' · ' + SEASONS[season()] + (isSunday() ? ' · SUNDAY, closed' : '') + ' · ' + (S.weather ? S.weather.kind : 'clear'), 12, y); y += 16;
      y = scanRow(c, y, null, 'Inbound ' + TRUCK_IN.map(fmtTime).join(' & '), 'wait ' + TRUCK_WAIT + ' h · ' + (S.up.dock2 ? 'both bays' : 'IN 1'));
      y = scanRow(c, y, null, 'Outbound', TRUCK_OUT.filter(function (dk, i) { return dockOwned(i); }).map(function (dk, i) { return 'OUT ' + (i + 1) + ' ' + MODES[dk.mode].name.toLowerCase() + ' ' + dk.windows.map(function (w) { return fmtTime(w.arrive) + '-' + fmtTime(w.leave); }).join(' ' ); }).join('  '));
      S.trucks.forEach(function (t) { if (y > h - 40) return; y = scanRow(c, y, null, (t.dir === 'in' ? 'IN' : 'OUT') + ' · ' + dockLabel(t.dir === 'in' ? t.dock : 2 + t.dock) + ' · ' + t.state, (t.dir === 'in' ? t.pallets.length + ' pallets' : t.parcels.length + ' parcels') + ' · leaves ' + fmtTime(t.leave), undefined, t.state === 'docked'); });
      y = scanRow(c, y, null, 'Bank ' + money(S.bank), 'rent ' + money(ECON.rent) + ' + wages ' + money(S.staff.reduce(function (a, s) { return a + STAFF_ROLES[s.role].wage; }, 0)) + ' at 06:00', 'rep ' + Math.round(S.rep));
      S.staff.slice(0, 3).forEach(function (st2) { if (y < h - 40) y = scanRow(c, y, null, st2.name + ' · ' + staffStatus(st2), (Math.round((st2.hoursToday || 0) * 10) / 10) + ' h today', undefined, !!st2.clocked); });
      if (S.clockedIn && y < h - 40) y = scanRow(c, y, null, 'You: on the clock', 'since ' + fmtTime(S.clockInAt), (Math.round(myHours() * 10) / 10) + ' h', true);
      if (S.contract && S.contract.accepted && y < h - 40) y = scanRow(c, y, null, 'Contract: ' + clientName(S.contract.client).slice(0, 16), S.contract.done + ' of ' + S.contract.need + ' by ' + fmtTime(S.contract.until % 24) + ' · ' + money(S.contract.bonus), undefined, true);
      if (S.up.fork) y = scanRow(c, y, null, 'Forklift battery', forkCharging() ? 'charging' : S.fork.plugged ? 'plugged in, full' : 'not plugged in', Math.round((S.fork.batt === undefined ? 1 : S.fork.batt) * 100) + '%', (S.fork.batt || 1) > 0.3);
    }
    // the slot under the crosshair, if any
    if (focus && focus.slot && y < h - 30) { var sl = S.slots[focus.slot]; c.fillStyle = 'rgba(95,211,141,0.15)'; c.fillRect(0, h - 30, w, 30); c.fillStyle = '#5fd38d'; c.font = 'bold 10px Bahnschrift, Arial'; c.fillText('▶ ' + slotName(focus.slot), 10, h - 17); c.fillStyle = '#eef1f5'; c.font = '10px Bahnschrift, Arial'; c.fillText(sl && sl.n ? sl.n + ' × ' + skuName(sl.sku) : 'empty', 10, h - 5); }
    c.fillStyle = '#6b7784'; c.font = '8px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText('1-4 pages · Tab', 230, h - 5); c.textAlign = 'left';
    scanDev.tex.needsUpdate = true;
  }
  function tickScanner(dt) {
    if (!scanDev.g) return;
    var want = ui.scanOpen && !driving ? 1 : 0;
    scanDev.t = lerp(scanDev.t, want, 1 - Math.pow(0.002, dt));
    scanDev.g.visible = scanDev.t > 0.02;
    scanDev.g.position.set(0.26 - scanDev.t * 0.06, -0.62 + scanDev.t * 0.42, -0.42 + scanDev.t * 0.04); scanDev.g.rotation.set(-0.45 + scanDev.t * 0.3, -0.35 + scanDev.t * 0.15, 0.1);
    if (scanDev.laserT > 0) { scanDev.laserT -= dt; scanDev.laser.material.opacity = Math.max(0, scanDev.laserT * 3); }
    if (ui.scanOpen) { scanDev.redrawT += dt; var slotNow = focus && focus.slot ? focus.slot : null; if (scanDev.redrawT > 0.5 || slotNow !== scanDev.lastFocusSlot) { scanDev.redrawT = 0; scanDev.lastFocusSlot = slotNow; drawScanner(); if (slotNow && slotNow !== scanDev.lastBeep) { scanDev.lastBeep = slotNow; sfx('scan'); scanDev.laserT = 0.3; } } }
  }
  // ── HUD ───────────────────────────────────────────────────────────
  var hudT = 0, lastClock = '';
  function updateHud(dt) {
    hudT += dt; if (!hudDirty && hudT < 0.25) return; hudT = 0; hudDirty = false;
    $('h-cash').textContent = money(S.bank); $('h-cash').style.color = S.bank < 0 ? 'var(--red)' : '';
    var open = S.orders.filter(function (o) { return o.state === 'open'; }).length, packed = S.orders.filter(function (o) { return o.state === 'packed'; }).length;
    $('h-orders').textContent = open + (packed ? ' + ' + packed + ' packed' : '');
    $('h-stock').textContent = totalStock() + ' boxes';
    $('h-rep').textContent = Math.round(S.rep);
    $('h-lvl').textContent = 'Level ' + S.level; $('h-xp').textContent = S.xp + ' / ' + XP_FOR(S.level); $('h-xpbar').style.width = (100 * S.xp / XP_FOR(S.level)) + '%';
    $('h-day').textContent = 'Day ' + S.day + (S.time >= DAY_END || S.time < DAY_START ? ' · night' : ''); $('h-clock').textContent = fmtTime(S.time);
    var ev = $('h-event'); if (S.events.power) { ev.hidden = false; ev.textContent = '⚡ Power cut: reset the breaker in the office'; } else ev.hidden = true;
    var held = $('h-held'), hl = handLabel();
    if (player.tool === 'cable') { held.hidden = false; held.innerHTML = 'Charging cable (forklift)<small>E on the forklift plugs it in · G hangs it back</small>'; }
    else if (player.tool) { held.hidden = false; held.innerHTML = (isJack(player.tool) ? 'Pallet jack' + (jackPallet() ? ' · ' + jackPallet().n + ' × ' + skuName(jackPallet().sku) + '<small>E on a rack slot stores it · E on open floor sets it down · G lets go of the jack</small>' : ' (empty)') : 'Picking cart · ' + cartLoadText() + ' · ' + cartLoad() + ' / ' + ECON.cartCap) + '<small>G lets go</small>'; }
    else if (hl) { held.hidden = false; held.innerHTML = esc(hl.t) + '<small>' + esc(hl.s) + '</small>'; }
    else held.hidden = true;
    $('h-objective').innerHTML = introText();
  }
  function updatePrompt() {
    var p = $('h-prompt');
    if (driving || !focusText) { p.hidden = true; return; }
    p.hidden = false; p.innerHTML = '<b>E</b>' + esc(focusText);
  }

  // ── The hand scanner (Tab) ────────────────────────────────────────
  var scan = { page: 0 };
  var SCAN_PAGES = ['Orders', 'Putaway', 'Stock', 'Day'];
  function scanToggle(on) { if (on && driving) return; ui.scanOpen = on; if (on) { sfx('scan'); introStep('scanner'); drawScanner(); } }
  function scanPage(i) { scan.page = i; sfx('click'); drawScanner(); }
  function sw(sku) { return '<span class="sw" style="background:' + SKU[sku].col + '"></span>'; }
  function renderScan() {
    if (!ui.scanOpen || true) return;   // the HTML scanner is retired: the device in your hand draws its own display
    $('dc-scan-tabs').innerHTML = SCAN_PAGES.map(function (n, i) { return '<button class="' + (i === scan.page ? 'on' : '') + '" data-page="' + i + '">' + (i + 1) + ' ' + n + '</button>'; }).join('');
    $('dc-scan-title').textContent = 'Scanner · ' + SCAN_PAGES[scan.page];
    var h = '';
    if (scan.page === 0) {
      var os = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packing' || o.state === 'packed' || o.state === 'loaded'; }).sort(function (a, b) { return a.due - b.due; });
      if (!os.length) h = '<div class="dc-empty">No orders yet. They arrive from 08:30 on working days.</div>';
      os.forEach(function (o) {
        h += '<div class="dc-sec">#' + o.num + ' · ' + esc(clientName(o.client)) + ' · due ' + dueText(o.due) + (o.rush ? ' · <span style="color:var(--red)">RUSH</span>' : '') + (o.late ? ' · <span style="color:var(--red)">LATE</span>' : '') + ' · ' + money(o.pay) + (o.state !== 'open' ? ' · ' + o.state.toUpperCase() : '') + '</div>';
        if (o.state === 'open') o.lines.forEach(function (l) { var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0), where = slotsWith(l.sku).filter(function (k) { return slotParse(k).l < RACK.top; }).slice(0, 2).map(slotName).join(' · '); h += '<div class="dc-row' + (have >= l.qty ? ' done' : '') + '">' + sw(l.sku) + '<div class="n">' + esc(skuName(l.sku)) + '<small>' + (where || (stockCount(l.sku) ? 'only on the top level' : 'not in stock')) + '</small></div><div class="q' + (have >= l.qty ? ' ok' : '') + '">' + have + ' / ' + l.qty + '</div></div>'; });
      });
    } else if (scan.page === 1) {
      var any = false;
      S.trucks.forEach(function (t) { if (t.dir !== 'in' || t.state !== 'docked') return; var ps = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id; }); any = true; h += '<div class="dc-sec">Truck at ' + dockLabel(t.dock) + ' · ' + ps.length + ' pallets left · leaves ' + fmtTime(t.leave) + (S.doors[t.dock] ? '' : ' · <span style="color:var(--amber)">door closed</span>') + '</div>'; ps.forEach(function (p) { var k = findSlotFor(p.sku, p.n, 1); h += '<div class="dc-row">' + sw(p.sku) + '<div class="n">' + p.n + ' × ' + esc(skuName(p.sku)) + '<small>' + (k ? 'Suggested: ' + slotName(k) : 'No rack space for a whole pallet') + '</small></div></div>'; }); });
      var fl = S.pallets.filter(function (p) { return p.place === 'floor'; });
      if (fl.length) { any = true; h += '<div class="dc-sec">Pallets on the floor</div>'; fl.forEach(function (p) { var k = findSlotFor(p.sku, p.n, 1); h += '<div class="dc-row">' + sw(p.sku) + '<div class="n">' + p.n + ' × ' + esc(skuName(p.sku)) + '<small>' + (k ? 'Suggested: ' + slotName(k) : 'No rack space for a whole pallet') + '</small></div></div>'; }); }
      if (S.floor.length) { any = true; h += '<div class="dc-sec">Loose on the floor: ' + S.floor.length + ' item' + (S.floor.length > 1 ? 's' : '') + ' (the inspector counts these)</div>'; }
      if (!any) h = '<div class="dc-empty">Nothing waiting to be put away.<br>Inbound trucks dock at ' + TRUCK_IN.map(fmtTime).join(' and ') + '.</div>';
    } else if (scan.page === 2) {
      var sum = stockSummary(), keys = Object.keys(sum).sort(function (a, b) { return sum[b] - sum[a]; });
      var slotsTotal = slotTotal(), used = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length;
      h += '<div class="dc-sec">' + used + ' of ' + slotsTotal + ' slots in use · ' + totalStock() + ' boxes</div>';
      if (!keys.length) h += '<div class="dc-empty">The racks are empty.</div>';
      keys.forEach(function (k) { h += '<div class="dc-row">' + sw(k) + '<div class="n">' + esc(skuName(k)) + '<small>' + slotsWith(k).map(slotName).slice(0, 3).join(' · ') + (slotsWith(k).length > 3 ? ' +' + (slotsWith(k).length - 3) : '') + '</small></div><div class="q ok">' + sum[k] + '</div></div>'; });
    } else {
      h += '<div class="dc-sec">Day ' + S.day + ' · ' + fmtTime(S.time) + ' · level ' + S.level + ' · rep ' + Math.round(S.rep) + '</div>';
      h += '<div class="dc-row"><div class="n">Inbound trucks<small>' + TRUCK_IN.map(fmtTime).join(' and ') + (S.up.dock2 ? ' at both bays' : ' at IN 1') + ' · they wait ' + TRUCK_WAIT + ' hours</small></div></div>';
      h += '<div class="dc-row"><div class="n">Outbound trucks<small>' + TRUCK_OUT.map(function (dk, i) { return dockOwned(i) ? 'OUT ' + (i + 1) + ' (' + MODES[dk.mode].name.toLowerCase() + '): ' + dk.windows.map(function (w) { return fmtTime(w.arrive) + ' to ' + fmtTime(w.leave); }).join(', ') : 'OUT ' + (i + 1) + ' (air): opens with the sortation deck'; }).join(' · ') + '</small></div></div>';
      S.trucks.forEach(function (t) { h += '<div class="dc-row hi"><div class="n">' + (t.dir === 'in' ? 'Inbound' : 'Outbound') + ' at ' + dockLabel(t.dir === 'in' ? t.dock : 2 + t.dock) + ' · ' + t.state + '<small>' + (t.dir === 'in' ? t.pallets.length + ' pallets from ' + esc(clientName(t.client)) : t.parcels.length + ' parcels loaded') + ' · leaves ' + fmtTime(t.leave) + '</small></div></div>'; });
      h += '<div class="dc-sec">Costs tonight</div><div class="dc-row"><div class="n">Rent<small>charged at 06:00</small></div><div class="q">' + money(ECON.rent) + '</div></div>';
      S.staff.forEach(function (st) { h += '<div class="dc-row"><div class="n">' + esc(st.name) + ' · ' + STAFF_ROLES[st.role].name + '<small>' + (staffOnShift() ? st.state : 'off shift, 08:00 to 18:00') + '</small></div><div class="q">' + money(STAFF_ROLES[st.role].wage) + '</div></div>'; });
    }
    $('dc-scan-body').innerHTML = h;
  }
  $('dc-scan-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-page]'); if (b) scanPage(+b.getAttribute('data-page')); });

  // ── Panels ────────────────────────────────────────────────────────
  var panel = { kind: null, tab: null };
  var PC_TABS = [['orders', 'Orders'], ['contracts', 'Contracts'], ['shop', 'Shop'], ['staff', 'Staff'], ['plant', 'Plant'], ['finance', 'Bank'], ['stock', 'Stock'], ['stats', 'Stats']];
  function openPanel(kind, tab) {
    panel.kind = kind; panel.tab = tab || (kind === 'pc' ? 'orders' : null); ui.panelOpen = true; $('dc-panel').hidden = false; scanToggle(false);
    ui.suppressMenu = true; try { document.exitPointerLock(); } catch (e) {}
    renderPanel(); sfx('click');
  }
  function closePanel() { if (!ui.panelOpen) return; ui.panelOpen = false; $('dc-panel').hidden = true; panel.kind = null; hudDirty = true; lockPointer(); }
  function renderPanel() {
    if (!ui.panelOpen) return;
    var title = panel.kind === 'pc' ? 'Office PC · Depot OS' : panel.kind === 'catalogue' ? 'Catalogue · build mode' : panel.kind === 'dev' ? 'Dev console (F8)' : 'Packing bench';
    $('dc-panel-title').textContent = title;
    $('dc-panel-tabs').innerHTML = panel.kind === 'pc' ? PC_TABS.map(function (t) { return '<button class="' + (t[0] === panel.tab ? 'on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') : '';
    $('dc-panel-body').innerHTML = panel.kind === 'pc' ? pcHtml(panel.tab) : panel.kind === 'catalogue' ? catalogueHtml() : panel.kind === 'dev' ? devHtml() : benchHtml();
  }
  function btn(act, arg, label, cls, disabled) { return '<button class="dc-btn small ' + (cls || '') + '" data-act="' + act + '" data-arg="' + esc(arg == null ? '' : arg) + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>'; }
  function orderCard(o, withPack) {
    var n = orderNeed(o);
    var lines = o.lines.map(function (l) { var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0); return '<span class="dc-tag ' + (have >= l.qty ? 'good' : '') + '">' + l.qty + '× ' + esc(skuName(l.sku)) + (withPack ? ' · ' + have + '/' + l.qty : '') + '</span>'; }).join(' ');
    var tags = (o.rush ? '<span class="dc-tag bad">RUSH</span>' : '') + (o.late ? '<span class="dc-tag bad">LATE</span>' : '') + (o.state !== 'open' ? '<span class="dc-tag good">' + o.state.toUpperCase() + '</span>' : '');
    var acts = '';
    if (withPack && o.state === 'open') acts = canPack(o) ? btn('pack', o.id, '📦 Pack', 'primary') : canPackShort(o) ? btn('pack', o.id, 'Pack short (' + n.have + '/' + n.tot + ')', '') : '<span class="dc-tag warn">' + n.have + '/' + n.tot + ' on the bench</span>';
    return '<div class="dc-card' + (o.rush ? ' hi' : '') + '"><div class="body"><b>#' + o.num + ' · ' + esc(clientName(o.client)) + '</b> ' + tags + '<small>due ' + dueText(o.due) + ' · pays ' + money(o.pay) + '</small><div style="margin-top:4px">' + lines + '</div></div><div>' + acts + '</div></div>';
  }
  function pcHtml(tab) {
    var h = '';
    if (tab === 'orders') {
      var os = S.orders.slice().sort(function (a, b) { return a.due - b.due; });
      h += '<h3>Open orders (' + os.length + ')</h3>' + (os.length ? os.map(function (o) { return orderCard(o, false); }).join('') : '<p>Nothing open. Orders arrive between 08:00 and 17:00; more clients send more as your level rises.</p>');
      h += '<h3>Recently shipped</h3>' + (S.shipped.length ? '<table><tr><th>Order</th><th>Client</th><th>Day</th><th class="r">Paid</th></tr>' + S.shipped.slice(0, 12).map(function (s) { return '<tr><td>#' + s.num + (s.late ? ' <span class="dc-tag bad">late</span>' : '') + (s.short ? ' <span class="dc-tag warn">short</span>' : '') + '</td><td>' + esc(clientName(s.client)) + '</td><td>' + s.day + '</td><td class="r">' + money(s.paid) + '</td></tr>'; }).join('') + '</table>' : '<p>Nothing shipped yet.</p>');
    } else if (tab === 'contracts') {
      var c = S.contract;
      h += '<p>A client offers a run of orders. Ship every one of theirs on time inside the window and the bonus is yours; miss the count and there is a penalty. Offers come from level 3, every few days.</p>';
      if (!c) h += '<div class="dc-card"><div class="body"><b>No offer on the table</b><small>' + (S.level < 3 ? 'Reach level 3.' : 'Next offer around day ' + S.nextOffer + '.') + '</small></div></div>';
      else if (!c.accepted) h += '<div class="dc-card hi"><div class="body"><b>' + esc(clientName(c.client)) + '</b><small>' + c.need + ' orders on time by ' + dueText(c.until) + ' · bonus ' + money(c.bonus) + ' · penalty ' + money(c.penalty) + '</small></div>' + btn('accept', '', 'Accept', 'primary') + btn('decline', '', 'Decline', '') + '</div>';
      else h += '<div class="dc-card hi"><div class="body"><b>' + esc(clientName(c.client)) + ' · ' + c.done + ' of ' + c.need + '</b><small>until ' + dueText(c.until) + ' · bonus ' + money(c.bonus) + '</small><div class="dc-bar"><span style="width:' + Math.round(100 * c.done / c.need) + '%"></span></div></div></div>';
    } else if (tab === 'shop') {
      h += '<p>Bank: <b style="color:var(--cash)">' + money(S.bank) + '</b> · level ' + S.level + '. Everything is delivered and fitted at once.</p><div class="dc-grid">';
      UPGRADES.forEach(function (u) {
        var rowN = /^row(\d)$/.test(u.id) ? +u.id.slice(3) : 0, owned = rowN ? S.up.rows >= rowN : !!S.up[u.id];
        var needs = rowN && S.up.rows < rowN - 1 ? 'Needs the previous row first' : u.needs && !S.up[u.needs] ? 'Needs the ' + upgradeName(u.needs).toLowerCase() + ' first' : S.level < u.lvl ? 'Level ' + u.lvl : S.bank < u.price ? 'Not enough money' : '';
        h += '<div class="dc-card"><div class="body"><b>' + esc(u.name) + '</b><small>' + esc(u.desc) + '</small></div><div style="text-align:right"><div class="price">' + money(u.price) + '</div>' + (owned ? '<span class="dc-tag good">Owned</span>' : btn('buy', u.id, 'Buy', 'primary', !!needs) + (needs ? '<small style="display:block;color:var(--muted)">' + needs + '</small>' : '')) + '</div></div>';
      });
      h += '</div>';
    } else if (tab === 'staff') {
      h += '<p>Staff clock in at the start of their shift (day 08:00 to 18:00, early 06:00 to 16:00, late 12:00 to 22:00; two hours more on overtime) and are paid at 06:00 for the hours on the clock, time and a half past ten. They need the dock doors opened for them: that stays your job. A course makes a worker quicker, a raise keeps them on time for good, a second role lets them cover another job when their own queue is empty, and from level 7 the crew grows to eight. The Plant tab runs every machine from here.</p>';
      h += '<div class="dc-grid">' + Object.keys(STAFF_ROLES).map(function (r) { var d = STAFF_ROLES[r], locked = S.level < d.lvl || (d.needs && !S.up[d.needs]), n = S.staff.filter(function (s) { return s.role === r; }).length; return '<div class="dc-card"><div class="body"><b>' + d.name + '</b>' + (n ? '<span class="dc-tag good">' + n + ' hired</span>' : '') + '<small>' + esc(d.desc) + '</small></div><div style="text-align:right"><div class="price">' + money(d.wage) + '/day</div>' + btn('hire', r, 'Hire', 'primary', locked || S.staff.length >= staffCap()) + (locked ? '<small style="display:block;color:var(--muted)">Level ' + d.lvl + '</small>' : '') + '</div></div>'; }).join('') + '</div>';
      if (S.staff.length) h += '<h3>Your crew</h3>' + S.staff.map(function (st) { var sheet = st.sheet || [], hrs = sheet.reduce(function (a, r) { return a + r.h; }, 0), paid = sheet.reduce(function (a, r) { return a + r.pay; }, 0), lates = sheet.filter(function (r) { return r.late; }).length; return '<div class="dc-card"><div class="body"><b>' + esc(st.name) + '</b> · ' + STAFF_ROLES[st.role].name + ' · ' + money(hourly(st)) + '/h' + (st.lateToday ? ' <span class="dc-tag bad">late today</span>' : '') + (st.overtime ? ' <span class="dc-tag warn">overtime</span>' : '') + '<small>' + staffStatus(st) + ' · today ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h · last 7 days ' + (Math.round(hrs * 10) / 10) + ' h, ' + money(paid) + (lates ? ', late ×' + lates : '') + ' · punctuality ' + Math.round((st.punct || 0.5) * 100) + '%</small></div>' + btn('fire', st.id, 'Let go', 'danger') + ' ' + btn('train', st.id, st.trained ? 'Trained' : 'Train $' + TRAIN_PRICE, 'primary', !!st.trained) + ' ' + btn('raise', st.id, st.raise ? 'Raised' : 'Raise $' + RAISE_PRICE, '', !!st.raise) + ' ' + btn('shift', st.id, 'Shift: ' + (st.shift || 'day'), '') + ' ' + btn('cross', st.id, st.cross ? 'Also ' + STAFF_ROLES[st.cross].name.toLowerCase() : 'Second role' + (st.crossPaid ? '' : ' $' + CROSS_PRICE), '') + '</div>'; }).join('');
      h += '<p>Hours come from the time clock by the staff door: nobody is paid for a day they did not clock in. Overtime, days off and a word about lateness are on the clock itself.</p>';
    } else if (tab === 'plant') {
      h += '<p>Every machine on the floor, from the desk: what it is doing, its speed dial, and the button it has on its own screen.' + (S.events.power ? ' <b>No power.</b>' : '') + '</p>';
      h += '<table><tr><th>Machine</th><th>Status</th><th>Dial</th><th class="r"></th></tr>' + plantRows().filter(function (r) { return !r.dialOnly; }).map(function (r, i) { var parts = r.text.split('  ·  '); return '<tr><td><b>' + esc(parts[0].trim()) + '</b><br><small>' + esc((r.sub || '').slice(0, 110)) + '</small></td><td>' + esc(parts.slice(1).join(' · ')) + '</td><td>' + (r.key ? btn('dial', r.key, Math.round(speedOf(r.key) * 100) + '% ▸', '') : '') + '</td><td class="r">' + (r.btn && !r.btnIsDial ? btn('plant', i, r.btn.label, r.btn.on ? 'primary' : '', !r.btn.on) : '') + '</td></tr>'; }).join('') + '</table>';
    } else if (tab === 'finance') {
      h += '<div class="dc-kpis"><div class="dc-kpi"><div class="k">Bank</div><div class="v" style="color:var(--cash)">' + money(S.bank) + '</div></div><div class="dc-kpi"><div class="k">Earned</div><div class="v">' + money(S.stats.earned) + '</div></div><div class="dc-kpi"><div class="k">Spent</div><div class="v">' + money(S.stats.spent) + '</div></div><div class="dc-kpi"><div class="k">Fines</div><div class="v">' + money(S.stats.fines) + '</div></div><div class="dc-kpi"><div class="k">Daily costs</div><div class="v">' + money(ECON.rent + S.staff.reduce(function (a, s) { return a + STAFF_ROLES[s.role].wage; }, 0)) + '</div></div></div>';
      h += '<h3>The bank</h3><div class="dc-grid"><div class="dc-card"><div class="body"><b>Loan</b><small>' + (S.loan > 0 ? money(S.loan) + ' outstanding · 1.5% a day (' + money(Math.round(S.loan * 0.015)) + ')' : 'Borrow $5,000 at 1.5% a day. Repay when you can.') + '</small></div>' + (S.loan > 0 ? btn('repay', '', 'Repay ' + money(Math.min(S.loan, Math.max(0, S.bank))), 'primary', S.bank <= 0) : btn('borrow', '', 'Borrow $5,000', 'primary', S.level < 2)) + '</div>' +
        '<div class="dc-card"><div class="body"><b>Theft insurance</b><small>$40 a day. Pays 80% of the value of anything that walks off at night.</small></div>' + btn('insure', '', S.insured ? 'Cancel' : 'Insure', S.insured ? '' : 'primary') + '</div></div>';
      h += '<table><tr><th>Day</th><th>Time</th><th>What</th><th class="r">Amount</th></tr>' + S.ledger.slice(0, 30).map(function (l) { return '<tr><td>' + l.day + '</td><td>' + l.t + '</td><td>' + esc(l.why) + '</td><td class="r" style="color:' + (l.n < 0 ? 'var(--red)' : 'var(--green)') + '">' + money(l.n) + '</td></tr>'; }).join('') + '</table>';
    } else if (tab === 'stock') {
      var sum = stockSummary(), keys = Object.keys(sum).sort();
      h += '<p>' + totalStock() + ' boxes on ' + S.up.rows + ' rows · ' + Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length + ' of ' + (slotTotal()) + ' slots used. A slot holds up to ' + ECON.slotCap + ' boxes of one line.</p>';
      h += '<table><tr><th>Line</th><th>Value each</th><th>Slots</th><th class="r">Boxes</th><th class="r">Needed by orders</th></tr>' + (keys.length ? keys.map(function (k) { var need = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === k) need += l.qty; }); }); return '<tr><td>' + sw(k) + ' ' + esc(skuName(k)) + '</td><td>' + money(SKU[k].val) + '</td><td>' + slotsWith(k).map(slotName).join(', ') + '</td><td class="r">' + sum[k] + '</td><td class="r">' + need + '</td></tr>'; }).join('') : '<tr><td colspan="5">Empty racks.</td></tr>') + '</table>';
    } else {
      var st = S.stats;
      h += '<div class="dc-kpis">' + [['Days', st.days + 1], ['Pallets received', st.received], ['Boxes put away', st.putaway], ['Boxes picked', st.picked], ['Orders packed', st.packed], ['Orders shipped', st.shipped], ['Late', st.late], ['Pallets refused', st.lost], ['Reputation', Math.round(S.rep)], ['Level', S.level]].map(function (k) { return '<div class="dc-kpi"><div class="k">' + k[0] + '</div><div class="v">' + k[1] + '</div></div>'; }).join('') + '</div>';
      h += '<h3>Recent log</h3>' + S.log.slice(0, 20).map(function (l) { return '<div style="color:var(--muted);font-size:13px"><span style="color:var(--faint);font-family:var(--mono)">D' + l.day + ' ' + l.t + '</span> ' + esc(l.msg) + '</div>'; }).join('');
    }
    return h;
  }
  function benchHtml() {
    var h = '', os = openOrders().sort(function (a, b) { return (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b.due; });
    h += '<h3>Orders to pack</h3>' + (os.length ? os.map(function (o) { return orderCard(o, true); }).join('') : '<p>No open orders. Boxes you leave here stay on the bench.</p>');
    var keys = Object.keys(S.bench.boxes).filter(function (k) { return S.bench.boxes[k] > 0; });
    h += '<h3>On the bench (' + benchCount() + ' / ' + ECON.benchCap + ')</h3>' + (surplusCount() ? '<div class="dc-card"><div class="body"><b>' + surplusCount() + ' surplus</b><small>boxes no open order wants, on the bench or loose on the floor</small></div>' + btn('returnSurplus', '', 'Return all to the racks', 'primary') + '</div>' : '') + (keys.length ? keys.map(function (k) { return '<div class="dc-card"><div class="body">' + sw(k) + ' <b>' + esc(skuName(k)) + '</b> × ' + S.bench.boxes[k] + '</div>' + btn('takeback', k, 'Take one back', '', !!S.hand) + '</div>'; }).join('') : '<p>Nothing on the bench. Bring boxes from the racks, or unload a cart here.</p>');
    if (S.bench.parcels.length) h += '<h3>Parcels on the shelf</h3><p>' + S.bench.parcels.map(function (id) { var o = orderById(id); return o ? '#' + o.num + ' for ' + esc(clientName(o.client)) : ''; }).join(' · ') + '</p>';
    return h;
  }
  function devHtml() {
    var B = function (a, l) { return btn('dev:' + a, '', l, ''); };
    return '<p>For testing. Nothing here is hidden from the save.</p>' +
      '<h3>Money and progress</h3><div class="dc-menu-row">' + B('cash', '+ $1,000') + B('cash10', '+ $10,000') + B('level', '+1 level') + B('rep', 'Rep +20') + B('unlock', 'Unlock every upgrade') + B('intro', 'Finish the intro') + '</div>' +
      '<h3>Time and weather</h3><div class="dc-menu-row">' + B('t6', '06:00') + B('t7', '07:20') + B('t10', '10:20') + B('t13', '13:20') + B('t17', '17:00') + B('t22', '22:00') + B('day', 'Next day') + '</div><div class="dc-menu-row">' + B('clear', 'Clear') + B('rain', 'Rain') + B('storm', 'Storm') + B('snow', 'Snow') + B('power', 'Toggle power cut') + '</div>' +
      '<h3>Trucks and orders</h3><div class="dc-menu-row">' + B('truckin', 'Inbound truck now') + B('truckout', 'Outbound truck now') + B('order', 'New order') + B('rush', 'Rush order') + B('contract', 'Contract offer') + '</div>' +
      '<h3>Stock and crew</h3><div class="dc-menu-row">' + B('fill', 'Fill the racks') + B('clearfloor', 'Clear the floor') + B('hire', 'Hire the three') + B('fire', 'Let everyone go') + B('fork', 'Forklift here') + '</div>' +
      '<h3>Teleport</h3><div class="dc-menu-row">' + B('tpIn', 'IN 1') + B('tpOut', 'OUT 1') + B('tpBench', 'Bench') + B('tpOffice', 'Office') + B('tpBreak', 'Break room') + B('tpYard', 'Yard') + B('tpGate', 'West gate') + '</div>';
  }
  function devAct(a) {
    var tp = function (x, z) { closePanel(); player.x = x; player.z = z; player.y = floorY(x, z); player.vy = 0; };
    if (a === 'cash') pay(1000, 'Dev'); else if (a === 'cash10') pay(10000, 'Dev'); else if (a === 'level') addXp(XP_FOR(S.level) - S.xp); else if (a === 'rep') addRep(20);
    else if (a === 'unlock') { S.up.cart = S.up.fork = S.up.lights = S.up.dock2 = S.up.sign = true; while (S.up.rows < RACK.rows.length) { S.up.rows++; buildRack(S.up.rows - 1); } placeTools(); }
    else if (a === 'intro') { S.intro.done = true; }
    else if (a === 't6') S.time = 6; else if (a === 't7') S.time = 7.33; else if (a === 't10') S.time = 10.33; else if (a === 't13') S.time = 13.33; else if (a === 't17') S.time = 17; else if (a === 't22') S.time = 22;
    else if (a === 'day') { S.time = 6; newDay(); }
    else if (a === 'clear' || a === 'rain' || a === 'storm' || a === 'snow') { S.weather = { kind: a, wet: a === 'rain' || a === 'storm' ? 1 : 0, snow: a === 'snow' ? 1 : 0, wind: a === 'storm' ? 1 : 0.4, until: nowAbs() + 6 }; }
    else if (a === 'power') { S.events.power = !S.events.power; S.events.powerUntil = S.time + 2; }
    else if (a === 'truckin') { if (!truckAtDoor(0) && !S.trucks.some(function (t) { return t.dir === 'in' && t.dock === 0 && t.state !== 'leaving'; })) spawnTruck('in', 0, S.time + TRUCK_WAIT); }
    else if (a === 'truckout') { if (!S.trucks.some(function (t) { return t.dir === 'out' && t.dock === 0 && t.state !== 'leaving'; })) spawnTruck('out', 0, S.time + 1.5); }
    else if (a === 'order') genOrder(false); else if (a === 'rush') genOrder(true); else if (a === 'contract') { S.contract = null; S.level = Math.max(S.level, 3); offerContract(); }
    else if (a === 'fill') { for (var r = 0; r < S.up.rows; r++) for (var bb = 0; bb < RACK.bays; bb++) for (var l = 0; l < 2; l++) { var k = slotKey(r, bb, l); if (!S.slots[k] || !S.slots[k].n) { var s = pick(unlockedSkus()); S.slots[k] = { sku: s, n: 8 }; if (S.seenSkus.indexOf(s) < 0) S.seenSkus.push(s); } } }
    else if (a === 'clearfloor') { S.floor = []; }
    else if (a === 'hire') { S.level = Math.max(S.level, 4); ['receiver', 'picker', 'packer'].forEach(function (r) { if (!S.staff.some(function (s) { return s.role === r; })) hireStaff(r); }); }
    else if (a === 'fire') { S.staff.slice().forEach(function (s) { fireStaff(s.id); }); }
    else if (a === 'fork') { S.up.fork = true; S.fork.x = player.x - Math.sin(player.yaw) * 2.5; S.fork.z = player.z - Math.cos(player.yaw) * 2.5; S.fork.batt = 1; placeTools(); }
    else if (a === 'tpIn') tp(-HALL.x + 3.5, -14); else if (a === 'tpOut') tp(HALL.x - 3.5, -14); else if (a === 'tpBench') tp(SPOT.bench.x - 1.4, 5.2); else if (a === 'tpOffice') tp(HALL.x - 5, 20.5); else if (a === 'tpBreak') tp(-HALL.x + 3.5, -21.5); else if (a === 'tpYard') { tp(-HALL.x, 5); player.y = YARD_Y; } else if (a === 'tpGate') { tp(-72, -2); player.y = YARD_Y; }
    sfx('click'); hudDirty = true; rebuildBoardSoon(); screenDirtyAll(); if (ui.panelOpen) renderPanel();
  }
  function panelAct(act, arg) {
    if (act.indexOf('dev:') === 0) { devAct(act.slice(4)); return; }
    if (act === 'pack') { var o = orderById(arg); if (o && packOrder(o)) toast('Packed #' + o.num, 'good'); }
    else if (act === 'takeback') { if (!S.hand && benchTake(arg, 1)) { handSet({ kind: 'box', sku: arg }); sfx('pickup'); } }
    else if (act === 'returnSurplus') returnSurplus();
    else if (act === 'buy' && panel.kind !== 'catalogue') buyUpgrade(arg);
    else if (act === 'hire') { var d = STAFF_ROLES[arg]; if (d && S.level >= d.lvl && S.staff.length < staffCap()) { hireStaff(arg); toast('Hired a ' + d.name.toLowerCase(), 'good'); } }
    else if (act === 'fire') fireStaff(arg);
    else if (act === 'train') { var s1 = staffById(arg); if (s1) staffTrain(s1); }
    else if (act === 'raise') { var s2 = staffById(arg); if (s2) staffRaise(s2); }
    else if (act === 'shift') { var s3 = staffById(arg); if (s3) staffShiftCycle(s3); }
    else if (act === 'cross') { var s4 = staffById(arg); if (s4) staffCrossCycle(s4); }
    else if (act === 'dial') speedCycle(arg);
    else if (act === 'plant') { var pr = plantRows().filter(function (r) { return !r.dialOnly; })[+arg]; if (pr && pr.btn && pr.btn.on) pr.btn.act(); }
    else if (act === 'accept') { if (S.contract) { S.contract.accepted = true; sfx('chime'); toast('Contract accepted', 'good'); logEvent('Accepted the contract from ' + clientName(S.contract.client), 'good'); } }
    else if (act === 'decline') { if (S.contract) { logEvent('Declined the contract from ' + clientName(S.contract.client)); S.contract = null; S.nextOffer = S.day + 2; } }
    else if (act === 'borrow') { if (S.level >= 2 && S.loan <= 0) { S.loan = 5000; pay(5000, 'Bank loan'); sfx('cash'); toast('$5,000 in the bank. 1.5% a day.', 'good'); } }
    else if (act === 'repay') { var amt = Math.min(S.loan, Math.max(0, S.bank)); if (amt > 0) { S.loan -= amt; pay(-amt, 'Loan repayment'); sfx('cash'); toast('Repaid ' + money(amt), 'good'); } }
    else if (act === 'restore') { editRestore(arg); }
    else if (act === 'buy' && panel.kind === 'catalogue') { editBuy(arg); return; }
    else if (act === 'insure') { S.insured = !S.insured; toast(S.insured ? 'Insured from tonight' : 'Insurance cancelled', ''); }
    renderPanel(); hudDirty = true;
  }
  function buyUpgrade(id) {
    var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; if (!u) return;
    var rowN = /^row(\d)$/.test(id) ? +id.slice(3) : 0, owned = rowN ? S.up.rows >= rowN : !!S.up[id];
    if (owned || S.level < u.lvl || S.bank < u.price || (rowN && S.up.rows < rowN - 1) || (u.needs && !S.up[u.needs])) { sfx('bad'); return; }
    pay(-u.price, 'Bought ' + u.name);
    if (rowN) { S.up.rows = rowN; buildRack(rowN - 1); buildGantries(); } else { S.up[id] = true; if (id === 'shipbelt') { buildProp('shipBelt'); buildProp('dockLoader2'); buildProp('bay2'); } if (id === 'agv') buildProp('agvDock'); if (id === 'gantry') buildGantries(); if (id === 'upper') buildUpper(); if (id === 'sorter') buildSorter(); if (/^hall\d$/.test(id)) buildHall(id); }
    if (id === 'row3' || id === 'row4') { if (edit.on) {} else { unbakeStatic(); bakeStatic(); } }
    if (id === 'lights') hallLights.forEach(function (l) { l.distance = 30; });
    toast(u.name + ' bought', 'good'); logEvent('Bought ' + u.name + ' for ' + money(u.price), 'good'); sfx('cash'); save();
  }
  $('dc-panel-body').addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (!b || b.disabled) return; panelAct(b.getAttribute('data-act'), b.getAttribute('data-arg')); });
  $('dc-panel-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (!b) return; panel.tab = b.getAttribute('data-tab'); sfx('click'); renderPanel(); });
  $('dc-panel-close').addEventListener('click', closePanel);

  // ── Pause menu ────────────────────────────────────────────────────
  function openMenu() { if (ui.menuOpen) return; ui.menuOpen = true; $('dc-menu').hidden = false; $('dc-menu-body').hidden = true; scanToggle(false); ui.suppressMenu = true; try { document.exitPointerLock(); } catch (e) {} save(); }
  function closeMenu() { if (!ui.menuOpen) return; ui.menuOpen = false; $('dc-menu').hidden = true; lockPointer(); }
  function menuBody(html) { var b = $('dc-menu-body'); b.hidden = false; b.innerHTML = html; }
  $('dc-menu').addEventListener('click', function (e) {
    var b = e.target.closest('[data-menu]'); if (!b) return; var k = b.getAttribute('data-menu'); sfx('click');
    if (k === 'resume') closeMenu();
    else if (k === 'edit') { closeMenu(); if (!edit.on) editToggle(); }
    else if (k === 'settings') menuBody(settingsHtml());
    else if (k === 'guide') menuBody('<div class="dc-how">' + guideHtml() + '</div>');
    else if (k === 'stats') menuBody(pcHtml('stats'));
    else if (k === 'saves') menuBody('<p style="color:var(--muted)">This save as text. Copy it somewhere safe, or paste one in and load it.</p><textarea class="dc-ta" id="dc-save-ta">' + esc(JSON.stringify(S)) + '</textarea><div class="dc-menu-row"><button data-menu="download">⬇ Download .json</button><button data-menu="import" class="primary">Load what is pasted</button></div>');
    else if (k === 'download') { var blob = new Blob([JSON.stringify(S)], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'depot-co-slot' + BOOT_SLOT + '-day' + S.day + '.json'; a.click(); }
    else if (k === 'import') { try { var s = JSON.parse($('dc-save-ta').value); if (!s || typeof s.bank !== 'number') throw new Error('not a save'); localStorage.setItem(SAVE, JSON.stringify(s)); sessionStorage.setItem('depotco-skip-splash', '1'); sessionStorage.setItem('depotco-autoplay', '1'); location.reload(); } catch (err) { toast('That is not a Depot Co. save.', 'bad'); } }
    else if (k === 'reset') { if (b.getAttribute('data-sure') !== '1') { b.setAttribute('data-sure', '1'); b.textContent = 'Really reset slot ' + BOOT_SLOT + '? Click again'; setTimeout(function () { b.removeAttribute('data-sure'); b.textContent = '⟲ Reset this save'; }, 3000); return; } wipe(); try { sessionStorage.setItem('depotco-skip-splash', '1'); } catch (err) {} location.reload(); }
    else if (k === 'quit') { save(); try { sessionStorage.setItem('depotco-skip-splash', '1'); } catch (err) {} location.reload(); }
  });
  function settingsHtml() {
    return '<div class="dc-form">' +
      '<label><span>Mouse sensitivity</span><input type="range" min="0.3" max="2.5" step="0.1" value="' + SET.sens + '" data-set="sens"></label>' +
      '<label><span>Invert Y</span><input type="checkbox" ' + (SET.invertY ? 'checked' : '') + ' data-set="invertY"></label>' +
      '<label><span>Field of view</span><input type="range" min="60" max="100" step="1" value="' + SET.fov + '" data-set="fov"></label>' +
      '<label><span>Quality</span><select data-set="quality"><option value="high"' + (SET.quality === 'high' ? ' selected' : '') + '>High</option><option value="medium"' + (SET.quality === 'medium' ? ' selected' : '') + '>Medium</option><option value="low"' + (SET.quality === 'low' ? ' selected' : '') + '>Low (no shadows)</option></select></label>' +
      '<label><span>Sound</span><input type="checkbox" ' + (SET.sound ? 'checked' : '') + ' data-set="sound"></label>' +
      '<label><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="' + SET.vol + '" data-set="vol"></label>' +
      '<label><span>Film look (vignette, grain)</span><input type="checkbox" ' + (SET.film !== false ? 'checked' : '') + ' data-set="film"></label>' +
      '<label><span>Show FPS (F3)</span><input type="checkbox" ' + (SET.fps ? 'checked' : '') + ' data-set="fps"></label>' +
      '<label><span>Guided intro</span><input type="checkbox" ' + (!S.intro.off ? 'checked' : '') + ' data-set="intro"></label>' +
      '</div>';
  }
  $('dc-menu-body').addEventListener('input', function (e) {
    var el = e.target, k = el.getAttribute('data-set'); if (!k) return;
    if (k === 'intro') { S.intro.off = !el.checked; hudDirty = true; return; }
    SET[k] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : +el.value;
    saveSettings(); applySettings();
  });
  function applySettings() {
    camera.fov = SET.fov; camera.updateProjectionMatrix(); post.on = SET.film !== false;
    var pr = SET.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : SET.quality === 'medium' ? 1 : 0.75;
    renderer.setPixelRatio(pr); renderer.shadowMap.enabled = SET.quality !== 'low'; sun.castShadow = SET.quality !== 'low'; lightBudget.n = SET.quality === 'high' ? 16 : SET.quality === 'medium' ? 10 : 6;
    scene.traverse(function (o) { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
    shadowDirty = true; $('h-fps').hidden = !SET.fps; if (sfxBus) sfxBus.gain.value = SET.vol;
  }
  function screenshot() {
    try { renderFrame(0.016); canvas.toBlob(function (b) { if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'depot-co-' + Date.now() + '.png'; a.click(); toast('Screenshot saved', 'good'); }, 'image/png'); } catch (e) {}
  }

  // ── The guide ─────────────────────────────────────────────────────
  function guideHtml() {
    return '<h3>What you do</h3><p>You run a small third-party warehouse. Clients send stock on trucks, you store it on the racks, their customers order from it, and you pick, pack and ship those orders out again. You are paid a fee for every pallet you receive and a cut of every order you ship on time.</p>' +
      '<h3>Controls</h3><p><kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> use, pick up, put on · <kbd>G</kbd> put down or let go · <kbd>Tab</kbd> the hand scanner · <kbd>1</kbd>-<kbd>4</kbd> scanner pages · <kbd>Esc</kbd> pause · <kbd>F3</kbd> FPS · <kbd>F12</kbd> screenshot · <kbd>F11</kbd> fullscreen.</p>' +
      '<h3>Receiving</h3><p>Inbound trucks dock at IN 1 (and IN 2 once you buy the second bay) at 07:30 and 13:30. Open the dock door, walk into the trailer and take boxes off the pallets by hand, or grab the pallet jack and lift a whole pallet. A truck waits three hours; whatever is still on it goes back, unpaid, and the client remembers.</p>' +
      '<h3>Racks</h3><p>Every slot holds up to 12 boxes of one line. The floor and shelf levels are hand-reachable; the top level needs the forklift. Look at a slot and press E to put a box on or take one off. The jack sets a whole pallet into a floor-level slot.</p>' +
      '<h3>Orders</h3><p>Orders arrive between 08:00 and 17:00 on the office PC, the wall board and the scanner. Each one lists lines and a due time, which is the departure of an outbound truck. Pick the boxes and put them on the packing bench; the terminal at the end of the bench releases an order to the pack line, and the parcel rolls onto the shelf beside it. A box on the bench is a thing you look at: E takes it back, and the prompt says whether an order wants it. The cart at the bench unloads only what the orders want and takes the surplus back in the same press. An order only ever asks for stock that is on site and not already spoken for.</p>' +
      '<h3>Conveyors</h3><p>Build mode (F2), then C: the Conveyors group sells belts by the piece, straights, curves, inclines and a high run hung from the roof. A carried piece snaps to the nearest free belt end, machine outlet, parcel shelf or inbound dock door, or to the nearest belt start, machine inlet, outbound dock door or rack bay, and says what it connects when you drop it. A belt that ends at a rack bay racks the boxes; one that ends at an outbound door with a truck in loads the parcels; one that starts at an inbound door with a signed truck in takes the boxes off its pallets.</p>' +
      '<h3>Shipping and the three lanes</h3><p>Every client ships by one lane and every order wears it on the board: <b>SEA</b> leaves by OUT 1 (trucks 10:30 to 12:00 and 17:00 to 18:30), <b>LAND</b> by OUT 2 (09:00 to 10:30 and 16:00 to 18:00), <b>AIR</b> by OUT 3 (13:00 to 14:30 and 19:00 to 20:15), which opens with the sortation deck and brings the air clients, who pay half as much again. An order is due at the next departure of its own lane. Open the door, carry the parcel into the trailer and press E, or load the parcels off the shelf onto the picking cart (E with the cart at the shelf) and E in the trailer unloads them all. A parcel out of the wrong door still ships, for a 25% forwarding fee. Press E on the dock console to send a loaded truck early. You are paid when it leaves. Late orders pay half; a short order pays 60%.</p>' +
      '<h3>Doors and the cabinet</h3><p>The office, break room, staff entrance and fire exit have doors: <kbd>E</kbd> opens, <kbd>Shift+E</kbd> locks. The control cabinet by the office door switches the lights, every dock door, and night mode, which locks the lot. Unlocked at night means stock walks.</p>' +
      '<h3>Drivers</h3><p>Open the dock door and the driver walks in and waits beside it. Sign the delivery note (<kbd>E</kbd> on him) before anything comes off the truck. He will nag after two hours.</p>' +
      '<h3>The pack line and the production wing</h3><p>Boxes go on the bench as before, but packing is a machine now: pick an order on the bench terminal and the line feeds its boxes onto the infeed belt, the case taper closes them into one parcel, and the parcel rolls down the outfeed onto the shelf. It jams now and then: <kbd>E</kbd> on it clears the jam.</p><p>Through the strip curtain in the north wall is the production wing. Order pallets of raw granulate on the office PC (Production app); they come with the next inbound truck. Bring one on the jack to the hopper and <kbd>E</kbd> tips it in. Start the moulding line on its screen or with <kbd>E</kbd>, pick a product, and own-brand boxes come down the main belt into the hall, where the palletiser stacks them eight to a pallet and drops the pallet beside it. Rack it like any delivery. Clients start ordering your goods once they have seen them.</p>' +
      '<h3>Automation (shop)</h3><p>The <b>shipping belt</b> (level 3) takes parcels off the pack line shelf and runs them down the east wall to OUT 2, where the <b>dock loader</b> pushes them into any docked truck with its door up. OUT 1 stays a manual dock. The <b>AGV</b> (level 4) is a driverless pallet truck: set a pallet on its pickup square by the receiving area, or let the palletiser drop one, and it puts it away on the racks and comes back to its dock. The <b>sortation deck</b> (level 6, on the mezzanine) is where the lanes run themselves: every parcel off the pack line rides a spiral up to the deck, a scanner reads its lane, three cells crate, strap or bag it, and spirals drop it into the dock loader of its door; OUT 3 and the air clients come with it. The <b>gantry pickers</b> (level 5) put a crane over every rack row you own, and a new row brings its own crane: each one watches the open orders, takes the boxes the bench still needs out of its row and sets them on the overhead pick belts, which end at the bench. A whole order can go pick, pack, ship without a hand on it. Anything riding a belt can still be lifted off by hand. Every machine screen carries a <b>speed dial</b> (50 to 200 percent): the cranes, the AGV, the pack line, the moulding line, the baler, the wrapper, and the belts through the screen of the machine they feed. A fast pack line jams more often. All three stop in a power cut.</p>' +
      '<h3>Tools</h3><p>While you hold a box or a parcel, a green ghost of it with a ring on the floor shows where G will set it down; it turns red where there is no floor to drop onto.</p><p>Two pallet jacks are yours from day one: jack 1 lives by the IN docks, jack 2 by OUT. With an empty jack, E on the empty pallet stack takes a pallet; loose boxes of one line go on it by hand or off the picking cart (E with the cart at a pallet unloads the matching line; at the parked cart, G takes one box off into your hand or puts the box you hold onto it), and the pallet then goes on a rack like any other, or on the jack to the bin by the bench to write the whole load off. The picking cart (shop) holds six boxes and picks straight off the racks. The forklift (shop, level 2) drives with WASD, Shift cycles three gears (creep, normal, fast; fast drinks the battery and throws unwrapped loads on corners), lifts with R and F, and takes pallets to the top level. G gets off. It runs on a battery: take the cable off the charging point on the south wall, walk it to the forklift and E plugs it in; it charges only while plugged, and driving off pulls the plug. Flat, the forklift crawls. Wrap a pallet at the stretch wrapper before you drive it round corners, or it sheds boxes.</p>' +
      '<h3>Staff and the time clock</h3><p>From level 3 you can hire a receiver, a picker and a packer on the office PC, and from level 5, once you own the forklift, a forklift driver who puts the pallets left on the hall floor away on any level and parks the forklift back in its bay. A receiver pushes a pallet jack of their own; a picker with nothing to pick walks surplus boxes back off the bench. They walk in from the yard, clock in at the reader by the staff door, work, clock out at 18:00 and leave. Pay is their clocked hours at the hourly rate, time and a half past ten hours, paid at 06:00. Some drift in late: the clock screen lets you have a word, put them on overtime till 20:00, or give them tomorrow off. They call in sick now and then. You can clock in too: your hours are tracked and you get a shift report when you clock out. They will not open dock doors: that stays your job.</p>' +
      '<h3>Trouble</h3><p>Power cuts stop the doors, the PC and new orders until you reset the breaker in the office. An inspector drops in now and then and fines you for boxes left on the floor. Leave a dock door open at night with no truck in it and stock walks off. Sleep on the cot in the break room to skip to the next morning, which charges rent and wages.</p>' +
      '<h3>Weather and Sundays</h3><p>Seasons of seven days, rain, storms, snow. Sunday is closed: sleep through it. The break-room radio has three stations.</p>' +
      '<h3>Contracts and the bank</h3><p>From level 3 a client offers a contract now and then: a number of their orders on time inside a window, for a bonus; miss it and there is a penalty. The bank lends $5,000 at 1.5% a day from level 2, and theft insurance at $40 a day pays most of what walks off at night.</p>' +
      '<h3>Damaged goods</h3><p>A box dropped mid-air or shed off the forklift can be damaged. It cannot go on a rack or the bench: carry it to the bin by the packing bench and the client charges half its value.</p>' +
      '<h3>Build mode</h3><p><kbd>F2</kbd> is build mode. Aim at any piece of furniture, a machine, a poster or a sign and <kbd>E</kbd> grabs it; it follows your aim, <kbd>R</kbd> turns it a quarter, <kbd>E</kbd> puts it down, <kbd>Esc</kbd> drops it back. <kbd>Backspace</kbd> puts a piece back where it started, <kbd>Del</kbd> removes it. <kbd>C</kbd> opens the catalogue: removed pieces to bring back, and extras to buy. The layout saves when you leave build mode.</p>' +
      '<h3>Dev console</h3><p><kbd>F8</kbd> opens a cheat menu: money, levels, the clock, weather, trucks, orders, stock, crew, teleports. For testing; it writes straight into the save.</p>' +
      '<h3>Tips</h3><p>Keep one slot per line and the scanner tells you where everything is. Pack before the truck arrives, not after. Coffee makes you faster for an hour. Reputation brings more and bigger orders.</p>';
  }
  // ── Static bake ───────────────────────────────────────────────────
  // Thousands of small boxes (rack bracing, trims, props) each cost a draw call. After the world is built, everything
  // that cannot move or change is merged into one mesh per material. Anything interactive, animated, glowing, instanced,
  // or under a group flagged dynamic is left alone, so doors, trucks, people, lamps and screens behave as before.
  var baked = { meshes: [], hidden: 0, draws: 0 };
  function bakeable(o) {
    if (!o.isMesh || o.isInstancedMesh || o.isSprite || !o.visible) return false;
    var m = o.material; if (!m || Array.isArray(m) || m.userData.glow || m.userData.noBake || m.transparent || m === MAT.hit || m === MAT.lamp || m === MAT.skylight || m === MAT.screen || m === MAT.exit) return false;
    if (o.userData.it || inter.indexOf(o) >= 0) return false;
    if (!(o.geometry && o.geometry.attributes && o.geometry.attributes.position)) return false;
    for (var p = o; p; p = p.parent) { if (p.userData && p.userData.dynamic) return false; if (!p.visible) return false; if (p === camera) return false; }
    return true;
  }
  function bakeStatic() {
    scene.updateMatrixWorld(true);
    var byMat = {}, list = [];
    scene.traverse(function (o) { if (bakeable(o)) list.push(o); });
    list.forEach(function (o) { var k = o.material.uuid; (byMat[k] = byMat[k] || { mat: o.material, items: [] }).items.push(o); });
    Object.keys(byMat).forEach(function (k) {
      var grp = byMat[k]; if (grp.items.length < 2) return;
      var pos = [], nor = [], uv = [], hasUv = true;
      grp.items.forEach(function (o) {
        var g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        var pa = g.attributes.position.array, na = g.attributes.normal ? g.attributes.normal.array : null, ua = g.attributes.uv ? g.attributes.uv.array : null;
        for (var i = 0; i < pa.length; i++) pos.push(pa[i]);
        if (na) for (var j = 0; j < na.length; j++) nor.push(na[j]); else for (var j2 = 0; j2 < pa.length; j2++) nor.push(0);
        if (ua) for (var u = 0; u < ua.length; u++) uv.push(ua[u]); else hasUv = false;
        g.dispose();
      });
      var merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      if (hasUv && uv.length === pos.length / 3 * 2) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      var mesh = new THREE.Mesh(merged, grp.mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.userData.baked = true;
      scene.add(mesh); baked.meshes.push(mesh);
      grp.items.forEach(function (o) { o.visible = false; o.userData.bakedAway = true; baked.hidden++; });
      baked.draws++;
    });
    shadowDirty = true;
  }
  // ── Time ──────────────────────────────────────────────────────────
  function tickTime(dt) {
    var night = S.time >= DAY_END || S.time < DAY_START;
    var before = S.time;
    S.time += dt / HOUR_SEC * (night ? NIGHT_SPEED : 1);
    if (S.time >= 24) { S.time -= 24; newDay(); }
    if (Math.floor(before) !== Math.floor(S.time)) hudDirty = true;
    if (before < 23 && S.time >= 23) prowlerCheck();
  }
  function newDay() {
    S.day++; S.stats.days++;
    pay(-ECON.rent, 'Rent, day ' + S.day);
    payStaffWages(); staffNewDay(); if (S.clockedIn) { myClock(false); logEvent('The clock ran past midnight: you were clocked out automatically'); }
    if (S.loan > 0) { var interest = Math.round(S.loan * 0.015); pay(-interest, 'Loan interest (1.5%)'); }
    if (S.insured) pay(-40, 'Insurance premium');
    if (isSunday()) { toast('Sunday. The depot is closed: no trucks, no orders.', ''); logEvent('Sunday. Nothing moves today. A good day to sleep through.'); }
    for (var f in S.flags) if (/^(in|out)\d+-/.test(f) && +f.replace(/^(in|out)/, '').split('-')[0] < S.day - 1) delete S.flags[f];
    S.events.inspected = false; S.events.prowled = false;
    logEvent('Day ' + S.day + '. Rent and wages paid.', 'rare'); toast('Day ' + S.day, 'rare'); rebuildBoardSoon(); hudDirty = true; save();
    if (S.bank < -600) { toast('The bank is getting nervous: ' + money(S.bank), 'bad'); }
  }
  function cotPrompt() { return S.time >= 17 || S.time < DAY_START ? 'Sleep until morning (rent and wages are due)' : 'Too early to sleep: the cot is for after 17:00'; }
  function sleepNow() {
    if (!(S.time >= 17 || S.time < DAY_START)) { toast('Too early. Come back after 17:00.', 'bad'); return; }
    sfx('sleep'); logEvent('Slept in the break room');
    var nightN = deckNightRun(); if (nightN) toast('Night shift: ' + nightN + ' parcel' + (nightN > 1 ? 's' : '') + ' sorted into the shipping bays overnight', 'good');
    S.trucks.slice().forEach(function (t) { if (t.state === 'docked') truckLeave(t, 'night'); });
    S.trucks.slice().forEach(function (t) { removeTruckMesh(t.id); }); S.trucks = [];
    if (S.time >= 17) { S.time = DAY_START; newDay(); } else S.time = DAY_START;
    S.events.power = false; buff.coffeeUntil = 0;
    var fade = $('dc-start'); fade.classList.add('show'); fade.hidden = false; fade.style.opacity = '1'; fade.style.transition = 'none';
    setTimeout(function () { fade.style.transition = 'opacity .9s'; fade.style.opacity = '0'; setTimeout(function () { fade.hidden = true; fade.style.opacity = ''; fade.style.transition = ''; }, 900); }, 400);
  }
  function drinkCoffee() {
    if (S.events.power) { toast('No power.', 'bad'); return; }
    if (buff.coffeeDay === S.day && buff.coffeeUntil > S.time) { toast('You are already wired.', ''); return; }
    buff.coffeeDay = S.day; buff.coffeeUntil = S.time + 1; sfx('coffee'); toast('Coffee. Faster for an hour.', 'good');
  }

  // ── Lighting by the hour ──────────────────────────────────────────
  var skyNight = new THREE.Color(0x0b1020), skyDawn = new THREE.Color(0xd9916b), skyDay = new THREE.Color(0x8fb0d4), skyTmp = new THREE.Color();
  var lightT = 0, lightT2 = null;
  function lighting(dt) {
    lightT += dt; if (lightT < 0.1) return; lightT = 0;
    var t = S.time, day = clamp((t - 5.5) / 1.5, 0, 1) * clamp((21.5 - t) / 1.5, 0, 1), dawn = Math.max(0, 1 - Math.abs(t - 6.5) / 1.5) + Math.max(0, 1 - Math.abs(t - 20.5) / 1.5);
    var az = Math.PI * (t - 6) / 16, elev = Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1));
    var W = S.weather || { kind: 'clear' }, overcast = W.kind === 'overcast' ? 0.45 : W.kind === 'rain' ? 0.65 : W.kind === 'storm' ? 0.85 : W.kind === 'snow' ? 0.55 : 0;
    sun.position.set(Math.cos(az) * 60, 8 + elev * 80, 30 + Math.sin(az) * 20); sun.intensity = Math.max(0, elev) * 1.15 * (0.6 + 0.4 * day) * (1 - overcast * 0.8) + weatherFlash * 2.5;
    sun.color.setHSL(0.09, dawn * 0.6 * (1 - overcast), 0.95 - dawn * 0.15);
    skyTmp.copy(skyNight).lerp(skyDay, day); if (dawn > 0) skyTmp.lerp(skyDawn, dawn * 0.5 * (1 - day * 0.3));
    if (overcast) skyTmp.lerp(new THREE.Color(0x6b7482), overcast * day * 0.8); if (weatherFlash > 0.05) skyTmp.lerp(new THREE.Color(0xffffff), weatherFlash * 0.7);
    scene.background.copy(skyTmp); scene.fog.color.copy(skyTmp); if (yard.sky) { yard.sky.uniforms.top.value.copy(skyTmp).multiplyScalar(0.62 + overcast * 0.25); yard.sky.uniforms.mid.value.copy(skyTmp); yard.sky.uniforms.bot.value.copy(skyTmp).lerp(new THREE.Color(0xffffff), 0.4 * (1 - overcast * 0.5)); } scene.fog.near = 70 - overcast * 30; scene.fog.far = 190 - overcast * 90;
    hemi.intensity = 0.12 + day * 0.35 * (1 - overcast * 0.5) + weatherFlash;
    if (dress.shaftMat) { dress.shaftMat.opacity = 0.16 * day * (1 - overcast * 0.9); if (dress.dust) dress.dust.material.opacity = 0.15 + 0.4 * day * (1 - overcast * 0.6); }
    yard.lampLenses.forEach(function (l) { l.material.emissiveIntensity = day < 0.5 && !S.events.power && !S.flags.yardOff ? 1.6 : 0.15; });
    var power = !S.events.power, lamps = power && !S.flags.lightsOff ? (S.up.lights ? 1.05 : 0.8) : 0;
    // the tubes do not come on at once: when the power returns or the hall is switched on they flicker up over a couple of seconds, each on its own clock
    if (!lightT2) lightT2 = {}; hallLights.forEach(function (l, i) { var want = lamps; if (want > 0) { var k = lightT2[i] = Math.min(1, (lightT2[i] || 0) + 0.1 / (1.6 + (i % 4) * 0.5)); if (k < 1) want = lamps * (k < 0.3 ? (Math.random() < 0.5 ? 0.15 : 0.7) * k * 3 : k); } else lightT2[i] = 0; l.intensity = want; });
    officeLight.intensity = power ? 0.55 : 0; breakLight.intensity = power ? 0.45 : 0; lobbyLight.intensity = power ? 0.4 : 0;
    MAT.lamp.color.setHex(power ? 0xfff6e4 : 0x3a3a3a); MAT.skylight.color.setHex(0xffffff); MAT.skylight.color.multiplyScalar(0.25 + day * 0.75);
    yardLights.forEach(function (l) { l.intensity = day < 0.5 && power && !S.flags.yardOff ? (l.userData.k || 1.3) : 0; });
    if (world.pcScreen) world.pcScreen.visible = power;
  }
  // The sun's shadow map is a second full pass over every caster, so it is not redrawn every frame. It is redrawn four times a
  // second (a walking picker's shadow keeps up with their feet), at once when something flagged it dirty (a door moved, a prop
  // was placed), and every frame while something big is moving near you: the forklift under you, a truck on the apron, the AGV.
  function shadowTick(dt) {
    if (!renderer.shadowMap.enabled) return;
    shadowT += dt;
    var live = driving || (S.agv && S.agv.state !== 'idle' && S.up.agv) || S.trucks.some(function (t) { return (t.state === 'coming' || t.state === 'leaving') && dist2(t.x, t.z, player.x, player.z) < 60 * 60; });
    if (shadowDirty || live || shadowT > 0.25) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowT = 0; }
  }

  // ── Events ────────────────────────────────────────────────────────
  var evT = 0;
  function tickEvents(dt) {
    evT += dt; if (evT < 1) return; var step = evT; evT = 0;
    if (S.events.power) { if (S.time >= S.events.powerUntil) { S.events.power = false; toast('The power is back.', 'good'); logEvent('Power restored by the grid'); sfx('breaker'); } }
    else if (S.level >= 2 && S.time >= 9 && S.time < 16 && !S.flags.noEvents && Math.random() < step / HOUR_SEC * 0.05) { S.events.power = true; S.events.powerUntil = S.time + 1.5; toast('Power cut! The breaker is in the office.', 'bad'); logEvent('Power cut. Doors, PC and the coffee machine are dead until the breaker is reset.', 'bad'); sfx('power'); }
    if (!S.events.inspected && S.day >= S.events.nextInspect && S.time >= 10 && S.time < 10.5) inspection();
    if (boardT > 0) { boardT -= step; if (boardT <= 0) { boardT = 0; drawBoard(); } }
    if (S.time >= 8 && S.time < 18 && Math.floor(S.time * 4) !== S.flags.boardQ) { S.flags.boardQ = Math.floor(S.time * 4); drawBoard(); }
  }
  function flipBreaker() {
    if (S.events.power) { S.events.power = false; sfx('breaker'); toast('Power restored.', 'good'); logEvent('Breaker reset', 'good'); addXp(4); }
    else { sfx('click'); toast('The power is on. Leave it be.', ''); }
  }
  function inspection() {
    S.events.inspected = true; S.events.nextInspect = S.day + randi(4, 6);
    var loose = S.floor.length, openDoors = doors.filter(function (d) { return S.doors[d.i] && !truckAtDoor(d.i); }).length;
    var fine = (loose > 4 ? 150 + (loose - 4) * 20 : 0) + openDoors * 40;
    if (S.up.lights) fine = Math.round(fine / 2);
    if (fine) { pay(-fine, 'Safety inspection fine'); S.stats.fines += fine; addRep(-2); toast('Inspector: ' + (loose > 4 ? loose + ' things on the floor. ' : '') + (openDoors ? openDoors + ' door' + (openDoors > 1 ? 's' : '') + ' open with no truck. ' : '') + 'Fine ' + money(fine), 'bad'); logEvent('Safety inspection: fined ' + money(fine), 'bad'); sfx('siren'); }
    else { addRep(3); toast('Inspector: clean floor, tidy docks. Well done.', 'good'); logEvent('Safety inspection passed', 'good'); addXp(10); }
  }
  function prowlerCheck() {
    if (S.events.prowled) return; S.events.prowled = true;
    var open = doors.filter(function (d) { return S.doors[d.i] && !truckAtDoor(d.i); });
    if (!open.length) { var unl = hdoors.filter(function (d) { return (d.id === 'staff' || d.id === 'exit') && !hd(d.id).locked; }); if (unl.length && Math.random() < 0.5) { var keys2 = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }); if (!keys2.length) return; var key2 = pick(keys2), sku2 = S.slots[key2].sku, n2 = slotTake(key2, randi(1, 3)); S.stats.lost += n2; addRep(-2); sfx('glass'); toast('Someone slipped in through ' + unl[0].label + ' and took ' + n2 + ' boxes. Lock up at night.', 'bad'); logEvent(n2 + ' boxes of ' + skuName(sku2) + ' taken through the unlocked ' + unl[0].label + '. Shift+E locks a door; the control cabinet locks them all.', 'bad'); } return; }
    var keys = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }); if (!keys.length) return;
    var key = pick(keys), sku = S.slots[key].sku, n = slotTake(key, randi(2, 6));
    S.stats.lost += n; addRep(-3); sfx('glass');
    if (S.insured) { var refund = Math.round(n * SKU[sku].val * 0.8); pay(refund, 'Insurance payout, ' + n + ' boxes'); toast('Insurance paid ' + money(refund) + ' for the loss', 'good'); }
    toast('Someone walked off with ' + n + ' boxes through the open door at ' + dockLabel(open[0].i), 'bad'); logEvent(n + ' boxes of ' + skuName(sku) + ' stolen through the open door at ' + dockLabel(open[0].i) + '. Close the doors at night.', 'bad');
  }
  function onLevelUp() {
    sfx('levelup'); toast('Level ' + S.level + '!', 'rare');
    var what = S.level === 2 ? 'New lines from the clients; the forklift, a third rack row, the LED high bays and the roadside sign are in the shop.' : S.level === 3 ? 'You can hire a receiver and a picker on the office PC. Second inbound bay and fourth row in the shop. Rush orders start.' : S.level === 4 ? 'Packers for hire, and the clients send trainers and drills.' : S.level === 7 ? 'Televisions and tyre sets: the big-ticket lines.' : 'Bigger orders and bigger loads.';
    logEvent('Level ' + S.level + '. ' + what, 'rare');
  }

  // ── The guided intro ──────────────────────────────────────────────
  var INTRO = [
    ['clockin', 'You start in the entrance lobby. Press <b>E</b> on the <b>time clock</b> on the wall beside the staff door and clock in: it keeps your hours.'],
    ['door', 'Go through the lobby door into the hall and walk to dock <b>IN 1</b> on the west wall. Press E on the roll door, or use the console beside it. The first truck docks at 07:30.'],
    ['sign', 'When the truck is in and the dock door is up, the driver walks in and waits beside the door. Press <b>E</b> on him to sign the delivery note. Nothing comes off until you do.'],
    ['unload', 'Walk into the trailer. Take a box off a pallet with <b>E</b>, or grab the pallet jack from its bay by the receiving square and lift a whole pallet.'],
    ['putaway', 'Put it on a rack: look at a slot and press <b>E</b>. Row A, floor level, is nearest. A slot holds 12 boxes of one line.'],
    ['scanner', 'Press <b>Tab</b>. The scanner in your hand lists the orders, what is still on the truck, and where every line is stored.'],
    ['order', 'Orders arrive from 08:30 on the office PC (sit down at the desk), the wall board and the scanner. Wait for the first one.'],
    ['pick', 'Take the boxes the order needs off the rack (<b>E</b> on the slot). One box per trip until you buy the cart.'],
    ['bench', 'Carry them to the <b>packing bench</b> on the east side and press E to put them down.'],
    ['pack', 'With empty hands press <b>E</b> on the bench, or use the terminal on it, and pack the order. The parcel appears on the shelf beside it.'],
    ['load', 'Pick the parcel up and look at the board: a <b>SEA</b> order leaves by OUT 1 (truck from 10:30), a <b>LAND</b> order by OUT 2 (from 09:00). Open that dock from its console, walk into the outbound trailer and press E. The wrong door ships it too, for a forwarding fee.'],
    ['dispatch', 'Press E on the <b>DISPATCH</b> button of that dock console to send the truck now, or let it leave on schedule. You are paid when it goes.']
  ];
  function introStep(key) {
    if (!S.intro || S.intro.done) return;
    S.intro.did = S.intro.did || {};
    if (S.intro.did[key]) return;
    S.intro.did[key] = 1;
    var i = introIndex();
    if (i >= INTRO.length) { S.intro.done = true; pay(400, 'Intro bonus'); toast('Intro done: $400 bonus. The depot is yours.', 'rare'); logEvent('Guided intro finished. $400 bonus.', 'rare'); sfx('chime'); }
    else if (INTRO[i][0] !== key) { /* a step done out of order still counts */ }
    hudDirty = true;
  }
  function introIndex() { var d = S.intro.did || {}; for (var i = 0; i < INTRO.length; i++) if (!d[INTRO[i][0]]) return i; return INTRO.length; }
  function introText() {
    if (!S.intro || S.intro.done || S.intro.off) return '';
    var i = introIndex(); if (i >= INTRO.length) return '';
    return '<b>Step ' + (i + 1) + ' of ' + INTRO.length + '</b> · ' + INTRO[i][1];
  }
  // ── Seasons and weather ───────────────────────────────────────────
  var SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  function season() { return Math.floor(((S.day - 1) % 28) / 7); }
  function isSunday() { return S.day % 7 === 0; }
  var weatherFlash = 0;
  function pickWeather(first) {
    var s = season(), r = Math.random(), kind;
    if (s === 3) kind = r < 0.32 ? 'snow' : r < 0.62 ? 'overcast' : r < 0.9 ? 'clear' : 'rain';
    else if (s === 1) kind = r < 0.6 ? 'clear' : r < 0.78 ? 'overcast' : r < 0.9 ? 'rain' : 'storm';
    else kind = r < 0.42 ? 'clear' : r < 0.68 ? 'overcast' : r < 0.9 ? 'rain' : 'storm';
    var prev = S.weather ? S.weather.kind : null;
    S.weather = { kind: kind, wet: S.weather ? S.weather.wet : 0, snow: S.weather ? S.weather.snow : 0, wind: kind === 'storm' ? randf(0.8, 1.2) : kind === 'clear' ? randf(0.1, 0.4) : randf(0.3, 0.7), until: nowAbs() + randf(2.5, 8) };
    if (!first && prev !== kind) {
      var msg = kind === 'rain' ? 'Rain on the roof.' : kind === 'storm' ? 'A storm is rolling in. Mind the dock doors.' : kind === 'snow' ? 'Snow. The yard will be slow.' : kind === 'overcast' ? 'Clouds have come over.' : 'The sky has cleared.';
      logEvent(msg, kind === 'storm' ? 'bad' : '');
    }
  }
  function tickWeatherState(dt) {
    if (!S.weather) pickWeather(true);
    var W = S.weather;
    if (nowAbs() > W.until) pickWeather(false);
    var raining = W.kind === 'rain' || W.kind === 'storm';
    W.wet = clamp(W.wet + (raining ? dt / 50 : -dt / 260), 0, 1);
    W.snow = clamp(W.snow + (W.kind === 'snow' ? dt / 90 : season() === 3 ? -dt / 1200 : -dt / 200), 0, 1);
    if (W.kind === 'storm' && Math.random() < dt * 0.06) { weatherFlash = 1; var delay = randf(300, 1800); setTimeout(function () { sfx('thunder'); }, delay); }
    weatherFlash *= Math.max(0, 1 - 6 * dt);
    ambience(raining ? (insideHall(player.x, player.z) ? 0.05 : 0.14) * (W.kind === 'storm' ? 1.4 : 1) : 0);
  }
  // a looping band of filtered noise is the rain; its level follows whether you are under the roof
  var amb = { gain: null, src: null, want: 0 };
  function ambience(level) {
    amb.want = level;
    if (!AC) return;
    if (!amb.src) { var len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; var src = AC.createBufferSource(); src.buffer = buf; src.loop = true; var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; var g = AC.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(sfxBus); src.start(); amb.src = src; amb.gain = g; }
    amb.gain.gain.setTargetAtTime(SET.sound ? level : 0, AC.currentTime, 0.4);
  }

  // ── The radio ─────────────────────────────────────────────────────
  // Three stations, every note synthesized: a chord progression, a bass line, hats and a kick, at the station's tempo.
  var STATIONS = [
    { name: 'Depot FM', bpm: 92, wave: 'triangle', root: 220, chords: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], bass: [0, 0, 7, 5], hat: [1, 0, 1, 1, 1, 0, 1, 1], kick: [1, 0, 0, 0, 1, 0, 1, 0] },
    { name: 'Night Drive', bpm: 118, wave: 'sawtooth', root: 196, chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], bass: [0, 0, 0, 3], hat: [1, 1, 1, 1, 1, 1, 1, 1], kick: [1, 0, 0, 0, 1, 0, 0, 0] },
    { name: 'Country 101', bpm: 104, wave: 'square', root: 247, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], bass: [0, 7, 5, 7], hat: [0, 1, 0, 1, 0, 1, 0, 1], kick: [1, 0, 1, 0, 1, 0, 1, 0] }
  ];
  var radio = { next: 0, step: 0, gain: null, timer: null };
  function radioPrompt() { if (S.events.power) return 'The radio is off: no power'; return S.radio && S.radio.on ? 'Radio: ' + STATIONS[S.radio.station].name + ' · next station' : 'Switch the radio on'; }
  function radioUse() {
    if (S.events.power) { toast('No power.', 'bad'); return; }
    if (!S.radio) S.radio = { on: false, station: 0 };
    if (!S.radio.on) { S.radio.on = true; S.radio.station = 0; } else if (S.radio.station < STATIONS.length - 1) S.radio.station++; else S.radio.on = false;
    sfx('click'); toast(S.radio.on ? '📻 ' + STATIONS[S.radio.station].name : 'Radio off', ''); audio(); radioStart();
  }
  function radioStart() { if (!AC) return; if (!radio.gain) { radio.gain = AC.createGain(); radio.gain.gain.value = 0; radio.gain.connect(sfxBus); } if (!radio.timer) { radio.next = AC.currentTime + 0.1; radio.step = 0; radio.timer = setInterval(radioSchedule, 120); } }
  function radioSchedule() {
    if (!AC || !S.radio || !S.radio.on || S.events.power) { if (radio.gain) radio.gain.gain.setTargetAtTime(0, AC ? AC.currentTime : 0, 0.3); return; }
    var st = STATIONS[S.radio.station], beat = 60 / st.bpm, sixteenth = beat / 4;
    while (radio.next < AC.currentTime + 0.35) {
      var t = radio.next, i = radio.step, bar = Math.floor(i / 16) % st.chords.length, chord = st.chords[bar], semi = function (n) { return st.root * Math.pow(2, n / 12); };
      if (i % 8 === 0) chord.forEach(function (n, k) { rTone(st.wave, semi(n) * (k === 2 ? 1 : 1), t, sixteenth * 7.5, 0.05, 1800); });
      if (i % 4 === 0) rTone('sine', semi(st.bass[Math.floor(i / 4) % 4] - 24), t, beat * 0.9, 0.12, 400);
      if (st.hat[i % 8]) rNoise(t, 0.03, 0.04, 6000);
      if (st.kick[i % 8]) { rTone('sine', 110, t, 0.14, 0.18, null, 40); }
      if (i % 16 === 14 && Math.random() < 0.5) rTone(st.wave, semi(chord[1] + 12), t, sixteenth * 2, 0.04, 2400);
      radio.next += sixteenth; radio.step++;
    }
  }
  function rTone(type, f0, t, dur, gain, lp, f1) { var o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); var dest = radio.gain; if (lp) { var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); f.connect(dest); } else g.connect(dest); o.connect(g); o.start(t); o.stop(t + dur + 0.05); }
  function rNoise(t, dur, gain, freq) { var len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); var src = AC.createBufferSource(); src.buffer = buf; var f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq; var g = AC.createGain(); g.gain.value = gain; src.connect(f); f.connect(g); g.connect(radio.gain); src.start(t); }
  function tickRadio() {
    if (!AC || !radio.gain) return;
    var on = S.radio && S.radio.on && !S.events.power && SET.sound;
    var d = dress.radio ? Math.sqrt(dist2(player.x, player.z, dress.radio.position.x, dress.radio.position.z)) : 99;
    var g = on ? clamp(1 - d / 16, 0, 1) * 0.5 * (insideHall(player.x, player.z) ? 1 : 0.25) : 0;
    radio.gain.gain.setTargetAtTime(g, AC.currentTime, 0.2);
  }

  // ── Charging cables ───────────────────────────────────────────────
  // Each charger has a cable on a reel. E takes the plug; walk it to the forklift (or the jack) and E plugs it in. A tube hangs
  // between the reel and wherever the plug is. Charging happens only while plugged in; driving off pulls the plug.
  var cables = { fork: { tool: 'cable', prop: 'charger', mesh: null, plugged: function () { return !!S.fork.plugged; } } };
  var CABLE_REACH = 8;
  function cableReel(prop) { var P = PROPS[prop] ? propPlacement(prop) : null; if (!P) return null; var a = P.rot * Math.PI / 2, lx = prop === 'charger' ? -0.28 : 0, ly = prop === 'charger' ? 0.75 : 0.8, lz = -0.05; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), y: propGroundY(P.x, P.z) + ly, z: P.z - lx * Math.sin(a) + lz * Math.cos(a) }; }
  function cablePlugEnd(k) {
    var cb = cables[k];
    if (player.tool === cb.tool) return { x: player.x - Math.sin(player.yaw) * 0.35 + Math.cos(player.yaw) * 0.25, y: player.y + 1.0, z: player.z - Math.cos(player.yaw) * 0.35 - Math.sin(player.yaw) * 0.25 };
    if (cb.plugged()) return { x: S.fork.x - Math.sin(S.fork.yaw) * 1.0, y: floorY(S.fork.x, S.fork.z) + 0.95, z: S.fork.z - Math.cos(S.fork.yaw) * 1.0 };
    return null;
  }
  function cablePrompt(k) { var cb = cables[k], name = k === 'fork' ? 'forklift' : 'jack'; if (player.tool === cb.tool) return 'Hang the ' + name + ' cable back on the reel'; if (cb.plugged()) return 'Unplug the ' + name + ' (E)'; if (player.tool || S.hand) return 'Hands full'; return 'Take the ' + name + ' charging cable'; }
  function cableUse(k) {
    var cb = cables[k], name = k === 'fork' ? 'forklift' : 'jack';
    if (player.tool === cb.tool) { player.tool = null; sfx('putdown'); toast('Cable hung back', ''); hudDirty = true; return; }
    if (cb.plugged()) { S.fork.plugged = false; sfx('click'); toast(name.charAt(0).toUpperCase() + name.slice(1) + ' unplugged', ''); screenDirtyAll(); hudDirty = true; return; }
    if (player.tool || S.hand || driving) { toast('Hands full.', 'bad'); return; }
    player.tool = cb.tool; sfx('pickup'); toast('Carrying the cable · E on the ' + name + ' plugs it in · it reaches ' + CABLE_REACH + ' m', ''); hudDirty = true;
  }
  function cablePlugInto(k) {
    var cb = cables[k], reel = cableReel(cb.prop), name = k === 'fork' ? 'forklift' : 'jack'; if (player.tool !== cb.tool) return false;
    var tgt = { x: S.fork.x, z: S.fork.z };
    if (reel && Math.sqrt(dist2(reel.x, reel.z, tgt.x, tgt.z)) > CABLE_REACH) { toast('The cable does not reach. Bring the ' + name + ' nearer the charger.', 'bad'); return true; }
    S.fork.plugged = true;
    player.tool = null; sfx('click'); toast(name.charAt(0).toUpperCase() + name.slice(1) + ' plugged in' + (k === 'fork' ? ': charging' : ''), 'good'); addXp(2); screenDirtyAll(); hudDirty = true; return true;
  }
  function cableUnplugFork(why) { if (S.fork.plugged) { S.fork.plugged = false; toast(why || 'The charger plug came out', 'bad'); sfx('bad'); screenDirtyAll(); } }
  var cableMat = std({ color: 0x1a1c20, roughness: 0.9 });
  function tickCables(dt) {
    Object.keys(cables).forEach(function (k) {
      var cb = cables[k], reel = cableReel(cb.prop), end = reel ? cablePlugEnd(k) : null;
      if (player.tool === cb.tool && reel && Math.sqrt(dist2(reel.x, reel.z, player.x, player.z)) > CABLE_REACH + 0.5) { player.tool = null; toast('The cable only reaches ' + CABLE_REACH + ' m. It snapped back onto the reel.', 'bad'); sfx('bad'); hudDirty = true; end = null; }
      if (!end) { if (cb.mesh) { cb.mesh.visible = false; } return; }
      var mid = new THREE.Vector3((reel.x + end.x) / 2, Math.min(reel.y, end.y) - 0.35 - Math.sqrt(dist2(reel.x, reel.z, end.x, end.z)) * 0.06, (reel.z + end.z) / 2);
      var curve = new THREE.CatmullRomCurve3([new THREE.Vector3(reel.x, reel.y, reel.z), new THREE.Vector3(reel.x, reel.y - 0.3, reel.z), mid, new THREE.Vector3(end.x, end.y - 0.15, end.z), new THREE.Vector3(end.x, end.y, end.z)]);
      var geo = new THREE.TubeGeometry(curve, 24, 0.018, 6, false);
      if (!cb.mesh) { cb.mesh = new THREE.Mesh(geo, cableMat); cb.mesh.castShadow = true; cb.mesh.userData.dynamic = true; scene.add(cb.mesh); } else { cb.mesh.geometry.dispose(); cb.mesh.geometry = geo; }
      cb.mesh.visible = true;
    });
    handPlug.visible = player.tool === 'cable';
  }

  // ── The forklift battery ──────────────────────────────────────────
  function forkCharging() { return !!S.up.fork && !driving && !!S.fork.plugged && S.fork.batt < 1; }
  function tickBattery(dt) {
    if (!S.up.fork) return;
    if (S.fork.batt === undefined) S.fork.batt = 1;
    if (driving && Math.abs(forkSpeed) > 0.1) { S.fork.batt = clamp(S.fork.batt - dt / 1500 * (S.fork.gear === 3 ? 1.8 : S.fork.gear === 1 ? 0.7 : 1), 0, 1); if (S.fork.batt <= 0 && !S.flags.battDead) { S.flags.battDead = 1; toast('Forklift battery flat. Push it to the charger.', 'bad'); } }
    else if (forkCharging() && !S.events.power) { S.fork.batt = clamp(S.fork.batt + dt / 110, 0, 1); if (S.fork.batt >= 1 && S.flags.battDead) { S.flags.battDead = 0; toast('Forklift charged.', 'good'); } }
  }

  // ── The stretch wrapper ───────────────────────────────────────────
  // A wrapped pallet keeps its boxes on the forks round a fast corner; an unwrapped one sheds them. Wrap film is $2 a pallet.
  var wrapper = { t: 0, pallet: null };
  function wrapperBusy() { return wrapper.t > 0; }
  // the pallet the wrapper would wrap: the one on the jack you are holding, else a floor pallet sitting on the turntable
  function wrapperTarget() { var p = isJack(player.tool) ? jackPallet() : null; if (p) return p; var P = PROPS.wrapper ? propPlacement('wrapper') : null; if (!P) return null; var best = null, bd = 1.3 * 1.3; S.pallets.forEach(function (q) { if (q.place !== 'floor') return; var d = dist2(q.x, q.z, P.x, P.z); if (d < bd) { bd = d; best = q; } }); return best; }
  function wrapperPrompt() {
    if (wrapperBusy()) return 'Wrapping… ' + Math.ceil(wrapper.t) + ' s';
    if (S.events.power) return 'The wrapper is off: no power';
    if (S.wrap && S.wrap.film <= 0) return 'The film roll is finished: fit a new one on the screen';
    var p = wrapperTarget(); if (p) return p.wrapped ? 'That pallet is already wrapped' : 'Wrap the pallet' + (p.place === 'floor' ? ' on the turntable' : '');
    return 'Stretch wrapper · set a pallet on the turntable, or bring one on the jack';
  }
  function wrapperUse() {
    if (wrapperBusy() || S.events.power) return;
    var p = wrapperTarget(); if (!p || p.wrapped) { sfx('bad'); return; }
    if (!S.wrap) S.wrap = { film: FILM_ROLL, wrapped: 0 }; if (S.wrap.film <= 0) { toast('The film roll is finished. Fit a new one on the wrapper screen.', 'bad'); sfx('bad'); return; }
    S.wrap.film--; S.wrap.wrapped++; wrapper.t = 5; wrapper.pallet = p.id; sfx('hydraulic'); addXp(3); screenDirtyAll();
  }
  var wrapInst = null;
  function tickWrapper(dt) {
    if (wrapper.t > 0) { wrapper.t -= dt * speedOf('wrapper'); if (wrapper.t <= 0) { wrapper.t = 0; var p = palletById(wrapper.pallet); if (p) { p.wrapped = true; toast('Pallet wrapped', 'good'); sfx('tape'); if (dress.wrapper) burst(dress.wrapper.position.x, 1, dress.wrapper.position.z, 0xffffff, 10, 'out'); } } }
    if (!wrapInst) { var filmTex = tex(128, 256, function (c, w, h) { c.fillStyle = 'rgba(235,240,245,0.55)'; c.fillRect(0, 0, w, h); for (var i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,' + randf(0.05, 0.25) + ')'; c.fillRect(Math.random() * w, 0, randf(1, 4), h); } for (var y = 0; y < h; y += 34) { c.fillStyle = 'rgba(200,210,220,0.35)'; c.fillRect(0, y, w, 3); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(0, y + 4, w, 1); } }, 2, 1); wrapInst = new THREE.InstancedMesh(boxGeo(1.27, 1.0, 1.07), new THREE.MeshPhysicalMaterial({ map: filmTex, transparent: true, opacity: 0.55, roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1, depthWrite: false, side: THREE.DoubleSide }), 120); wrapInst.count = 0; wrapInst.frustumCulled = false; wrapInst.renderOrder = 1; scene.add(wrapInst); }
    var n = 0; S.pallets.forEach(function (p) { if (!p.wrapped || n >= 120) return; var w = palletWorld(p); if (!w) return; var hgt = Math.ceil(p.n / 4) * BOX.h + 0.02; _e.set(0, w.ry, 0); _q.setFromEuler(_e); _v2.set(1, hgt, 1); _m4.compose(_v.set(w.x, w.y + 0.14 + hgt / 2 - 0.01, w.z), _q, _v2); wrapInst.setMatrixAt(n++, _m4); });
    for (var wk in S.slots) { var ws = S.slots[wk]; if (!ws || !ws.wrapped || !ws.n || n >= 120) continue; var wp = slotParse(wk), wsp = rackSlotPos(wp.r, wp.b, wp.l), whg = Math.ceil(ws.n / 4) * BOX.h + 0.02; _e.set(0, wsp.ry || 0, 0); _q.setFromEuler(_e); _v2.set(1, whg, 1); _m4.compose(_v.set(wsp.x, wsp.y + 0.14 + whg / 2 - 0.01, wsp.z), _q, _v2); wrapInst.setMatrixAt(n++, _m4); }
    wrapInst.count = n; wrapInst.instanceMatrix.needsUpdate = true;
  }

  function tickLife(dt) {
    if (!ui.started || ui.blocked()) return;
    tickWeatherState(dt); tickRadio(); tickBattery(dt); tickWrapper(dt); tickCables(dt); tickMachines(dt);
  }
  // ── Boot ──────────────────────────────────────────────────────────
  var loaded = load(); sorterSpots();   // a save that owns the sortation deck keeps jack 2 out from under the spirals
  buildWorld(); buildTools(); buildScanner();
  S.trucks.forEach(buildTruckMesh); S.staff.forEach(buildStaffMesh);
  // a packed order whose parcel is nowhere (an old save, say) goes back to open with its boxes on the bench
  S.orders.forEach(function (o) { if (o.state === 'packed' && !parcelExists(o.id)) { o.state = 'open'; o.lines.forEach(function (l) { if (l.packed) benchAdd(l.sku, l.packed); l.packed = 0; }); } });
  if (S.jack.pallet && !palletById(S.jack.pallet)) S.jack.pallet = null; if (S.jack2 && S.jack2.pallet && !palletById(S.jack2.pallet)) S.jack2.pallet = null;
  if (S.fork.pallet && !palletById(S.fork.pallet)) S.fork.pallet = null;
  updateHandMesh(); applySettings(); resize(); rebuildDyn(); drawBoard();
  buildAgv();
  if (!/nobake=1/.test(location.search)) bakeStatic();
  camera.position.set(12, 3.6, 0); camera.lookAt(0, 1.4, 0); if (!loaded) S.time = 10.5;
  $('dc-start-stats').innerHTML = loaded ? ['Day ' + S.day, 'Level ' + S.level, money(S.bank), Math.round(S.rep) + ' rep', S.stats.shipped + ' shipped'].map(function (s) { return '<span>' + s + '</span>'; }).join('') : ['New depot', money(ECON.start), '2 rack rows', 'a pallet jack'].map(function (s) { return '<span>' + s + '</span>'; }).join('');
  $('dc-start-note').textContent = loaded ? 'Slot ' + BOOT_SLOT + ' · last saved ' + (S.savedAt ? new Date(S.savedAt).toLocaleString() : 'never') : 'Slot ' + BOOT_SLOT + ' · the first truck is due at 07:30';

  function enter() {
    if (ui.started) return;
    ui.started = true; $('dc-start').hidden = true; $('dc-hud').hidden = false; hudDirty = true;
    lockPointer(); sfx('ok');
    if (!loaded) { S.time = DAY_START; logEvent('Welcome to Depot Co. Open dock IN 1: the first truck is due at 07:30.', 'rare'); save(); }   // the menu backdrop showed 10:30; the shift starts at 06:00
    else logEvent('Back on shift. Day ' + S.day + ', ' + fmtTime(S.time) + '.');
  }
  $('dc-start-btn').addEventListener('click', enter);

  // ── The frame loop ────────────────────────────────────────────────
  var last = performance.now(), fpsN = 0, fpsT = 0, autosaveT = 0, scanT = 0;
  function tickWorld(dt) { tickTime(dt); tickTrucks(dt); tickOrders(); tickStaff(dt); tickEvents(dt); rebuildDyn(); }
  function frame(nowMs) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, Math.max(0.001, (nowMs - last) / 1000)); last = nowMs;
    if (!ui.started) { var ma = worldTime * 0.07; camera.position.set(Math.cos(ma) * 12, 3.6 + Math.sin(ma * 1.7) * 0.6, Math.sin(ma) * 9.5); camera.lookAt(Math.cos(ma + 1.2) * 4, 1.4, Math.sin(ma + 1.2) * 3); }
    if (ui.started && !ui.blocked()) { tickWorld(dt); updatePlayer(dt); autosaveT += dt; if (autosaveT > 30) { autosaveT = 0; save(); }  }
    worldTime += dt;
    doorAnim(dt); placeTools(dt); syncInstances(); lighting(dt); updateLightBudget(); shadowTick(dt); tickDressing(dt); tickYard(dt); tickLife(dt); tickBursts(dt); doorsTick(dt); drawScreens(dt); tickScanner(dt); editTick(); tickTimeClock(dt); tickPc(dt); for (var ai = 0; ai < animated.length; ai++) animated[ai](dt);
    interact(); updatePrompt(); updateHud(dt);
    renderFrame(dt);
    if (SET.fps) { fpsN++; fpsT += dt; if (fpsT >= 0.5) { $('h-fps').textContent = Math.round(fpsN / fpsT) + ' fps · ' + (post.calls || renderer.info.render.calls) + ' draws'; fpsN = 0; fpsT = 0; } }
  }
  requestAnimationFrame(frame);
  // a hidden tab gets no animation frames; the world still ticks ten times a second so a docked truck does not wait on a tab switch
  setInterval(function () { if (!document.hidden) return; var n = performance.now(), dt = Math.min(0.05, Math.max(0.001, (n - last) / 1000)); last = n; worldTime += dt; if (ui.started && !ui.blocked()) { tickWorld(dt); updatePlayer(dt); doorAnim(dt); placeTools(dt); syncInstances(); tickLife(dt); doorsTick(dt); tickTimeClock(dt); scene.updateMatrixWorld(true); interact(); updatePrompt(); } }, 50);
  window.addEventListener('beforeunload', function () { if (ui.started) save(); });

  // ── The window handle: the main menu, and the smoke test ──────────
  window.DEPOT = {
    enter: enter, bootSlot: BOOT_SLOT, guideHtml: guideHtml, version: window.DEPOT_VERSION || 'dev',
    T: {
      get S() { return S; }, player: player, ui: ui, save: save,
      run: function (sec) { var n = Math.round(sec / 0.05); for (var i = 0; i < n; i++) { tickWorld(0.05); if (driving) updatePlayer(0.05); tickLife(0.05); doorAnim(0.05); placeTools(0.05); } syncInstances(); scene.updateMatrixWorld(true); },   // fresh world matrices, so a test raycast sees props where the tick put them
      setTime: function (h) { S.time = h; hudDirty = true; },
      spawnTruck: spawnTruck, signTruck: signTruck, truckById: truckById, truckAtDoor: truckAtDoor, truckMeshes: truckMeshes, doorPassable: doorPassable, doorPanelScale: function (i) { return doors[i].panel.scale.y; }, truckLeave: truckLeave, setDoor: setDoor,
      palletById: palletById, palletUse: palletUse, palletPrompt: palletPrompt, storePallet: storePallet, findSlotFor: findSlotFor, newPallet: newPallet,
      slotKey: slotKey, slotUse: slotUse, slotPrompt: slotPrompt, stockCount: stockCount, totalStock: totalStock,
      grabTool: grabTool, releaseTool: releaseTool, toolWorld: toolWorld,
      genOrder: genOrder, orderById: orderById, benchAdd: benchAdd, benchUse: benchUse, packOrder: packOrder, canPack: canPack, shelfUse: shelfUse, loadUse: loadUse, consoleUse: consoleUse, consolePrompt: consolePrompt,
      hireStaff: hireStaff, fireStaff: fireStaff, buyUpgrade: buyUpgrade, startDrive: startDrive, stopDrive: stopDrive, forkGearCycle: forkGearCycle, forkLook: forkLook, forkUse: forkUse, forkTip: forkTip,
      handSet: handSet, putDown: putDown, interact: interact, useFocus: useFocus, focusText: function () { return focusText; },
      lookAt: function (x, y, z) { camera.position.set(player.x, player.y + 1.62, player.z); camera.lookAt(x, y, z); camera.updateMatrixWorld(true); player.yaw = Math.atan2(-(x - player.x), -(z - player.z)); player.pitch = Math.atan2(y - camera.position.y, Math.sqrt(dist2(x, z, player.x, player.z))); interact(); return focusText; },
      openPanel: openPanel, closePanel: closePanel, renderPanel: renderPanel, scanToggle: scanToggle, renderScan: renderScan, panelHtml: function () { return $('dc-panel-body').innerHTML; },
      sleepNow: sleepNow, flipBreaker: flipBreaker, inspection: inspection, prowlerCheck: prowlerCheck, drawBoard: drawBoard, introIndex: introIndex, floorY: floorY, collides: collides, route: route,
      cableUse: cableUse, cablePlugInto: cablePlugInto,
      hopperUse: hopperUse, moulderUse: moulderUse, buildProp: buildProp, agvState: agvState, balerUse: balerUse, addWaste: addWaste, wrapperUse: wrapperUse, palletiserEject: palletiserEject, packUse: packUse, beltItems: beltItems, beltSink: beltSink, beltPoint: beltPoint, gantryNeed: gantryNeed, gantryState: gantryState, buildGantries: buildGantries, drawScreens: drawScreens, screenTap: screenTap, collides: collides, solids: solids, SPOT: SPOT, RACK: RACK, grabTool: grabTool, releaseTool: releaseTool, screens: screens, agvScreen: function () { return agvScreen; }, palletWorld: palletWorld, rackSlotPos: rackSlotPos, speedOf: speedOf, speedCycle: speedCycle, HALL: HALL, wallX: wallX, focusAlt: function () { if (focus && focus.alt) focus.alt(); }, shelfPrompt: shelfPrompt, loadPrompt: loadPrompt, cartParcels: cartParcels, dropMarker: dropMarker, updateDropMarker: updateDropMarker, dropPoint: dropPoint, BELTS: BELTS, MACH: MACH, inWing: inWing,
      openPc: openPc, closePc: closePc, pc: pc, load: load, save: save, state: function () { return S; }, parcelExists: parcelExists, speedCycle: speedCycle, UPPER: UPPER, liftState: liftState, upperSlotFor: upperSlotFor, buildUpper: buildUpper, buildSorter: buildSorter, sortState: sortState, orderMode: orderMode, MODES: MODES, TRUCK_OUT: TRUCK_OUT, SORT: SORT, floorYAt: floorY, stageOf: stageOf, deckNightRun: deckNightRun, walkoverY: walkoverY, HALLS: HALLS, buildHall: buildHall, returnSurplus: returnSurplus, surplusCount: surplusCount, inAnnex: inAnnex, insideHall: insideHall, DOOR_MAP: DOOR_MAP, doorIndex: doorIndex, groundRows: groundRows, rowBays: rowBays, slotTotal: slotTotal, plantRows: plantRows, staffTrain: staffTrain, staffRaise: staffRaise, staffShiftCycle: staffShiftCycle, staffCrossCycle: staffCrossCycle, shiftStart: shiftStart, staffCap: staffCap, activeClients: activeClients,
      beltSnap: beltSnap, beltFeeder: beltFeeder, BELT_PIECES: BELT_PIECES, machinePoints: machinePoints, freeStock: freeStock, benchNeed: benchNeed, benchSurplus: benchSurplus, benchBoxUse: benchBoxUse,
      myClock: myClock, staffNewDay: staffNewDay, payStaffWages: payStaffWages, staffStatus: staffStatus, hourly: hourly,
      editToggle: editToggle, editGrab: editGrab, editDrop: editDrop, editRotate: editRotate, editReset: editReset, editRemove: editRemove, editRestore: editRestore, editBuy: editBuy, propInst: propInst, PROPS: PROPS, edit: edit, buildProp: buildProp,
      addXp: addXp, counts: function () { return { draws: (post.calls || renderer.info.render.calls), inter: inter.length, dyn: dyn.length, baked: baked.draws, hidden: baked.hidden }; }
    }
  };
})();
