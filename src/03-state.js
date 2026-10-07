//@ the save state: defaults, load, save, migration
  // ── State ─────────────────────────────────────────────────────────
  function freshState() {
    return {
      ver: 1, day: 1, time: DAY_START, bank: ECON.start, xp: 0, level: 1, rep: 10,
      hall: 5,                   // the hall layout generation; 1 was the 40 x 28 hall, 2 the first big-hall build whose migration ran too late
      up: { rows: 2, cart: false, fork: false, lights: false, dock2: false, sign: false, shipbelt: false, agv: false, gantry: false, upper: false, sorter: false, hall2: false, hall3: false, hall4: false },
      gantries: {}, speed: {},
      agv: { x: 0, z: 0, yaw: 0, state: 'idle', pallet: null, path: [], placed: false },
      slots: {},                 // "row,bay,level" -> { sku, n, pal (a pallet under the boxes), wrapped }
      pallets: [],               // { id, sku, n, place: 'truck'|'floor'|'jack'|'fork'|'staff'|'lift'|'agv', truck, idx, x, z, y, rot, wrapped, recv }
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
      trucks: [], doors: [false, false, false, false, false, false, false],   // IN 1, IN 2, OUT 1, OUT 2, OUT 3, IN 3, RETURNS (see DOOR_MAP)
      sort: null,                // the sortation deck's cells, turntable and counts (1.14.0)
      stage: {},                 // parcels staged beside each dock loader, by loader id
      staff: [], nextStaffName: 0,
      intro: { step: 0, done: false, off: false },
      events: { power: false, powerUntil: 0, nextInspect: 4, inspected: false, prowled: false },
      seenSkus: ['paint', 'bolts', 'cereal', 'lamps'],
      stats: { received: 0, putaway: 0, picked: 0, packed: 0, shipped: 0, late: 0, earned: 0, spent: 0, fines: 0, days: 0, lost: 0, stolen: 0, made: 0, palletised: 0, returns: 0 },
      returns: [], rdesk: { queue: [], cur: null, t: 0, shelf: [], done: 0 },   // returns in play, and the returns desk (1.16.0)
      days: [], dayStart: null,  // the day reports (1.16.0)
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
      while ((s.doors || (s.doors = [])).length < 7) s.doors.push(false); if (!s.stage) s.stage = {};
      (s.staff || []).forEach(function (st) { if (st.state === 'wait' && !st.clocked && !st.clockedOutAt) st.state = 'clockin'; if (hasJack(st) && st.state === 'home') { st.jackParked = true; st.jackAt = jackHome(st, s.staff); } });   // 1.18.0: a jack left on an idle spot overnight stands in the row by the wall instead   // saved in the clock-in wait: the wait's closure is gone, so they clock in again
      (s.orders || []).forEach(function (o) { if (o.state === 'upper') { o.state = 'open'; } if (!o.mode) { var cm = (CLIENTS.filter(function (c) { return c.id === o.client; })[0] || {}).mode || 'land'; o.mode = cm === 'air' && !s.up.sorter ? 'land' : cm; } });
      if (s.up.upperPack) { delete s.up.upperPack; } delete s.upack; delete s.udiv; if (s.belts) { delete s.belts.upackIn; delete s.belts.upackOut; }
      // belt items whose piece is gone (a removal that crashed before 1.13.5 left them behind): boxes and parcels go to the receiving floor
      if (s.belts) for (var bk in s.belts) { if (BELTS[bk] || (s.custom || []).some(function (c) { return c.id === bk; })) continue; (s.belts[bk] || []).forEach(function (it, n) { var fx = SPOT.stageIn.x - 0.9 + (n % 4) * 0.6, fz = SPOT.stageIn.z + 1.5 + Math.floor(n / 4) * 0.6; if (it.kind === 'box') s.floor.push({ kind: 'box', sku: it.sku, x: fx, y: 0, z: fz, rot: 0 }); else if (it.kind === 'parcel' && it.order) s.floor.push({ kind: 'parcel', order: it.order, x: fx, y: 0, z: fz, rot: 0 }); }); delete s.belts[bk]; }
      S = s; migrateReturnsHall(); return true;   // 1.17.0: Hall 2's rows are gone
    } catch (e) {
      // a save that will not load is kept beside the slot rather than lost: the fresh game that follows saves over the slot itself
      try { if (typeof console !== 'undefined') console.error('Depot Co.: the save in ' + SAVE + ' could not be loaded', e); var brokenRaw = localStorage.getItem(SAVE); if (brokenRaw) localStorage.setItem(SAVE + '-broken', brokenRaw); } catch (e2) {}
      return false;
    }
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
