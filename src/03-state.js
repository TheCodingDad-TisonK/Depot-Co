//@ the save state: defaults, load, save, migration
  // ── State ─────────────────────────────────────────────────────────
  function freshState() {
    return {
      ver: 1, day: 1, time: DAY_START, bank: ECON.start, xp: 0, level: 1, rep: 10,
      up: { rows: 2, cart: false, fork: false, lights: false, dock2: false, sign: false },
      slots: {},                 // "row,bay,level" -> { sku, n }
      pallets: [],               // { id, sku, n, place: 'truck'|'floor'|'jack'|'fork'|'staff', truck, idx, x, z, y, rot }
      floor: [],                 // loose boxes and parcels on the floor: { kind: 'box'|'parcel', sku|order, x, y, z, rot }
      bench: { boxes: {}, parcels: [] },
      cart: { boxes: [], x: SPOT.cart.x, z: SPOT.cart.z, rot: 0 },
      jack: { pallet: null, x: SPOT.jack.x, z: SPOT.jack.z, rot: Math.PI / 2 },
      fork: { x: SPOT.fork.x, z: SPOT.fork.z, yaw: Math.PI, lift: 0.1, pallet: null, batt: 1 },
      weather: null, radio: { on: false, station: 0 },
      loan: 0, insured: false, contract: null, nextOffer: 3, binned: 0,
      hand: null,                // { kind: 'box', sku } | { kind: 'parcel', order }
      orders: [], shipped: [],   // shipped keeps the last 40 for the ledger
      trucks: [], doors: [false, false, false, false],
      staff: [], nextStaffName: 0,
      intro: { step: 0, done: false, off: false },
      events: { power: false, powerUntil: 0, nextInspect: 4, inspected: false, prowled: false },
      seenSkus: ['paint', 'bolts', 'cereal', 'lamps'],
      stats: { received: 0, putaway: 0, picked: 0, packed: 0, shipped: 0, late: 0, earned: 0, spent: 0, fines: 0, days: 0, lost: 0 },
      ledger: [], log: [], sleptAt: 0, lastOrderAt: 0, orderSeq: 1, truckSeq: 1, flags: {}
    };
  }
  var S = freshState();
  function load() {
    try {
      var raw = localStorage.getItem(SAVE); if (!raw) return false;
      var s = JSON.parse(raw); if (!s || typeof s !== 'object') return false;
      var f = freshState();
      for (var k in f) if (!(k in s)) s[k] = f[k];
      for (var k2 in f.stats) if (!(k2 in s.stats)) s.stats[k2] = f.stats[k2];
      for (var k3 in f.up) if (!(k3 in s.up)) s.up[k3] = f.up[k3];
      for (var k4 in f.events) if (!(k4 in s.events)) s.events[k4] = f.events[k4];
      S = s; return true;
    } catch (e) { return false; }
  }
  var saveT = 0;
  function save() {
    try { S.savedAt = now(); localStorage.setItem(SAVE, JSON.stringify(S)); saveT = now(); } catch (e) {}
  }
  function wipe() { try { localStorage.removeItem(SAVE); } catch (e) {} }
  // the ledger and the lifetime stats
  function pay(n, why) { S.bank += n; if (n >= 0) S.stats.earned += n; else S.stats.spent += -n; S.ledger.unshift({ day: S.day, t: fmtTime(S.time), n: n, why: why }); if (S.ledger.length > 80) S.ledger.pop(); hudDirty = true; }
  function addXp(n) {
    S.xp += n; hudDirty = true;
    while (S.xp >= XP_FOR(S.level)) { S.xp -= XP_FOR(S.level); S.level++; onLevelUp(); }
  }
  function addRep(n) { S.rep = clamp(S.rep + n * (S.up.sign && n > 0 ? 1.25 : 1), 0, 100); hudDirty = true; }
  var hudDirty = true;
