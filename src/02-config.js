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
    { id: 'hardware', name: 'Kessler Hardware',  likes: ['paint', 'bolts', 'drills', 'lamps', 'dccrate', 'dcbin'] },
    { id: 'grocer',   name: 'Northgate Grocers', likes: ['cereal', 'coffee', 'soap', 'dccrate'] },
    { id: 'toyshop',  name: 'Little Wonders',    likes: ['toys', 'books', 'dcbin'] },
    { id: 'sports',   name: 'Fairlane Sports',   likes: ['shoes', 'tyres'] },
    { id: 'electro',  name: 'Volt & Co.',        likes: ['tv', 'lamps', 'drills'] },
    { id: 'office',   name: 'Pinecrest Offices', likes: ['lamps', 'coffee', 'books', 'paint', 'dcbin', 'dcplanter'] }
  ];
  var STAFF_NAMES = ['Jo', 'Mika', 'Sam', 'Ravi', 'Lena', 'Ada', 'Theo', 'Nour'];
  var DRIVER_NAMES = ['Big Pete', 'Marta', 'Dusty', 'Kofi', 'Hal', 'Yusra'];

  // ── Time ──────────────────────────────────────────────────────────
  var HOUR_SEC = 75;              // one game hour in real seconds, so a 16-hour working day is twenty minutes (37.5 until 2026-10-03: too fast for the big hall)
  var DAY_START = 6, DAY_END = 22;
  var NIGHT_SPEED = 4;            // the clock runs faster after closing unless you sleep
  var TRUCK_IN = [7.5, 13.5];     // inbound trucks dock at these hours
  var TRUCK_OUT = [{ arrive: 10.5, leave: 12 }, { arrive: 16, leave: 18 }];   // outbound trucks wait at the dock between these hours
  var TRUCK_WAIT = 4;             // hours an inbound truck waits before it leaves with what you did not unload

  // ── Money ─────────────────────────────────────────────────────────
  var ECON = {
    start: 600, rent: 110, rawPrice: 120, receiveFee: 12, handling: 14, margin: 0.22, lateCut: 0.5, shortCut: 0.6,
    wage: { receiver: 85, picker: 85, packer: 75 },
    rowPrice: 950, cartPrice: 240, forkPrice: 2800, lightsPrice: 600, pcPrice: 0,
    jackPallet: 8, palletCap: 8, slotCap: 12, cartCap: 6, benchCap: 16
  };
  var UPGRADES = [
    { id: 'cart',   name: 'Picking cart',        price: ECON.cartPrice,  lvl: 1, desc: 'A trolley that holds six boxes. Grab it, pick straight onto it from the racks, and empty it onto the bench in one go.' },
    { id: 'row3',   name: 'Third rack row',      price: ECON.rowPrice,   lvl: 2, desc: 'Sixteen more hand-reachable slots and a top level for the forklift.' },
    { id: 'fork',   name: 'Forklift',            price: ECON.forkPrice,  lvl: 2, desc: 'Drive it, lift whole pallets, and reach the top level of every rack. Parks at the south wall.' },
    { id: 'row4',   name: 'Fourth rack row',     price: ECON.rowPrice,   lvl: 3, desc: 'Another fifteen bays across three levels.' },
    { id: 'row5',   name: 'Fifth rack row',      price: ECON.rowPrice,   lvl: 4, desc: 'Another fifteen bays across three levels.' },
    { id: 'row6',   name: 'Sixth rack row',      price: ECON.rowPrice,   lvl: 5, desc: 'The last rack row. The hall is full after this one.' },
    { id: 'lights', name: 'LED high bays',       price: ECON.lightsPrice, lvl: 2, desc: 'Brighter hall, and the inspector likes a well-lit floor: fines are halved.' },
    { id: 'dock2',  name: 'Second inbound bay',  price: 1400,            lvl: 3, desc: 'Two inbound trucks a day can dock at once, and clients send bigger loads.' },
    { id: 'sign',   name: 'Roadside sign',       price: 500,             lvl: 2, desc: 'New clients find you sooner. Reputation grows a little faster.' },
    { id: 'shipbelt', name: 'Shipping belt and dock loader', price: 1800, lvl: 3, desc: 'Parcels roll off the pack line shelf onto a belt down the east wall to OUT 2, where the dock loader pushes them into any docked truck with its door up. OUT 1 stays manual.' },
    { id: 'agv',    name: 'AGV pallet mover',    price: 3200,            lvl: 4, desc: 'A driverless truck. Set a pallet on its pickup square (or let the palletiser drop one) and it puts it away on the racks by itself.' },
    { id: 'gantry', name: 'Gantry picker over row A', price: 5000,       lvl: 5, desc: 'A crane over row A that watches the orders, picks the boxes the bench still needs out of row A and sends them down the pick belt to the bench.' }
  ];
  var STAFF_ROLES = {
    receiver: { name: 'Receiver', wage: ECON.wage.receiver, lvl: 3, desc: 'Walks pallets out of a docked inbound truck and puts them on the racks.' },
    picker:   { name: 'Picker',   wage: ECON.wage.picker,   lvl: 3, desc: 'Takes boxes off the racks for open orders and brings them to the bench.' },
    packer:   { name: 'Packer',   wage: ECON.wage.packer,   lvl: 4, desc: 'Packs complete orders at the bench and loads the parcels into a docked outbound truck.' }
  };
  var XP_FOR = function (lvl) { return Math.round(80 * Math.pow(1.45, lvl - 1)); };
  var XP = { box: 2, pallet: 8, pack: 10, ship: 15, truck: 6 };

  // ── Layout (metres; the hall floor is y = 0, the yard is y = -1.2) ─
  var HALL = { x: 30, z: 24, h: 8 };   // grew from 40 x 28 on 2026-10-02 so a row holds 15 bays and the forklift has room
  var RACK = { rows: [-15, -9, -3, 3, 9, 15], bays: 15, bayW: 3, x0: -22.5, depth: 1.2, levels: [0, 1.55, 3.3], top: 2 };   // levels: the y of the pallet base; top is forklift-only
  var DOCKS = { in: [{ z: -14 }, { z: -6 }], out: [{ z: -14 }, { z: -6 }], w: 3.6, h: 4.2 };
  var YARD_Y = -1.2;
  var SKYLIGHT_Z = [-14, -7, 0, 7, 14];   // the roof lights and the shafts under them
  var TRAILER = { len: 12, w: 2.5, h: 2.7 };
  var SPOT = {
    bench: { x: 26.6, z: 5.2 }, benchOut: { x: 26.6, z: 7.2 },
    stageIn: { x: -26, z: -10 }, stageOut: { x: 26, z: -10 },
    pc: { x: 27.5, z: 21.8 }, breaker: { x: 29.7, z: 19.6 },
    cot: { x: -27.2, z: 22.2 }, coffee: { x: -29.4, z: 19.3 },
    jack: { x: -25, z: 4 }, cart: { x: -25, z: 6.5 }, fork: { x: 0, z: 20.5 },
    spawn: { x: -28.6, z: 21.2 }, staffDoor: { x: -30, z: 22 }, console0: { x: 29.7, z: -11.5 }, console1: { x: 29.7, z: -8.5 }
  };
