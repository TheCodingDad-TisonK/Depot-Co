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
  var HOUR_SEC = 37.5;            // one game hour in real seconds, so a 16-hour working day is ten minutes
  var DAY_START = 6, DAY_END = 22;
  var NIGHT_SPEED = 4;            // the clock runs faster after closing unless you sleep
  var TRUCK_IN = [7.5, 13.5];     // inbound trucks dock at these hours
  var TRUCK_OUT = [{ arrive: 10.5, leave: 12 }, { arrive: 16, leave: 18 }];   // outbound trucks wait at the dock between these hours
  var TRUCK_WAIT = 3;             // hours an inbound truck waits before it leaves with what you did not unload

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
    { id: 'sign',   name: 'Roadside sign',       price: 500,             lvl: 2, desc: 'New clients find you sooner. Reputation grows a little faster.' }
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
    spawn: { x: -28.6, z: 21.2 }, staffDoor: { x: -30, z: 22 }, console0: { x: 29.7, z: -11.5 }, console1: { x: 29.7, z: -3.5 }
  };
  // ── State ─────────────────────────────────────────────────────────
  function freshState() {
    return {
      ver: 1, day: 1, time: DAY_START, bank: ECON.start, xp: 0, level: 1, rep: 10,
      hall: 2,                   // the hall layout generation; 1 was the 40 x 28 hall
      up: { rows: 2, cart: false, fork: false, lights: false, dock2: false, sign: false },
      slots: {},                 // "row,bay,level" -> { sku, n }
      pallets: [],               // { id, sku, n, place: 'truck'|'floor'|'jack'|'fork'|'staff', truck, idx, x, z, y, rot }
      floor: [],                 // loose boxes and parcels on the floor: { kind: 'box'|'parcel', sku|order, x, y, z, rot }
      bench: { boxes: {}, parcels: [] },
      pack: { queue: [], job: null, jam: false, made: 0, feedT: 0, out: null },           // the pack line
      factory: { raw: 0, product: 'dccrate', on: false, made: 0, rawOrdered: 0, t: 0, jam: false },   // the moulding line and its hopper
      pal: { sku: null, n: 0 }, belts: {},
      baler: { card: 0, bales: 0, t: 0, made: 0 }, wrap: { film: 20, wrapped: 0 },                                                   // the palletiser's pallet, and what is on each belt
      cart: { boxes: [], x: SPOT.cart.x, z: SPOT.cart.z, rot: 0 },
      jack: { pallet: null, x: SPOT.jack.x, z: SPOT.jack.z, rot: Math.PI / 2 },
      fork: { x: SPOT.fork.x, z: SPOT.fork.z, yaw: Math.PI, lift: 0.1, pallet: null, batt: 1 },
      weather: null, radio: { on: false, station: 0 },
      loan: 0, insured: false, contract: null, nextOffer: 3, binned: 0,
      layout: {}, custom: [],
      hand: null,                // { kind: 'box', sku } | { kind: 'parcel', order }
      orders: [], shipped: [],   // shipped keeps the last 40 for the ledger
      trucks: [], doors: [false, false, false, false],
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
      var f = freshState(), oldHall = !('hall' in s) || s.hall < 2;
      for (var k in f) if (!(k in s)) s[k] = f[k];
      for (var k2 in f.stats) if (!(k2 in s.stats)) s.stats[k2] = f.stats[k2];
      if (oldHall) { s.hall = 2; s.layout = {}; s.custom = []; s.trucks = []; s.pallets = (s.pallets || []).filter(function (p) { return p.place !== 'truck'; }); (s.staff || []).forEach(function (st) { if (st.x !== undefined) { st.x = clamp(st.x, -HALL.x + 2, HALL.x - 2); st.z = clamp(st.z, -HALL.z + 2, HALL.z - 2); } }); s.jack.x = SPOT.jack.x; s.jack.z = SPOT.jack.z; s.cart.x = SPOT.cart.x; s.cart.z = SPOT.cart.z; s.fork.x = SPOT.fork.x; s.fork.z = SPOT.fork.z; s.fork.plugged = false; (s.pallets || []).forEach(function (p) { if (p.place === 'floor') { p.x = clamp(p.x, -HALL.x + 2, HALL.x - 2); p.z = clamp(p.z, -HALL.z + 2, HALL.z - 2); } }); }
      for (var k3 in f.up) if (!(k3 in s.up)) s.up[k3] = f.up[k3];
      for (var k4 in f.events) if (!(k4 in s.events)) s.events[k4] = f.events[k4];
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
  [[-10, -5], [0, -5], [10, -5], [-10, 5], [0, 5], [10, 5]].forEach(function (p) {
    var l = new THREE.PointLight(0xfff4e0, 0.55, 26, 2); l.position.set(p[0], 6.3, p[1]); scene.add(l); hallLights.push(l);
  });
  var officeLight = new THREE.PointLight(0xfff8ea, 0.5, 9, 2); officeLight.position.set(16.5, 3.2, 11); scene.add(officeLight);
  var breakLight = new THREE.PointLight(0xffe9c8, 0.35, 8, 2); breakLight.position.set(-16.5, 3.0, -12); scene.add(breakLight);
  var lobbyLight = new THREE.PointLight(0xffe9c8, 0.3, 7, 2); lobbyLight.position.set(-17.7, 3.0, 11.2); scene.add(lobbyLight);
  var yardLights = [];   // filled by the lamp-post props

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
    rubberMat: tex(128, 128, function (c, w, h) { c.fillStyle = '#1b1d20'; c.fillRect(0, 0, w, h); c.fillStyle = '#24272b'; for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { c.beginPath(); c.arc(x + 8, y + 8, 5, 0, 6.3); c.fill(); } }, 6, 6)
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
  function textTex(lines, opt) {
    opt = opt || {}; var w = opt.w || 512, h = opt.h || 128;
    return tex(w, h, function (c) {
      c.fillStyle = opt.bg || '#1b232c'; c.fillRect(0, 0, w, h);
      if (opt.border) { c.strokeStyle = opt.border; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); }
      c.fillStyle = opt.fg || '#f5b53d'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var size = opt.size || Math.min(h * 0.6, w / (Math.max.apply(null, lines.map(function (l) { return l.length; })) * 0.6));
      c.font = (opt.weight || 'bold') + ' ' + Math.floor(size) + 'px ' + (opt.font || 'Bahnschrift, Arial, sans-serif');
      lines.forEach(function (l, i) { c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15); });
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
    rubber: normalTex(128, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { c.fillStyle = '#b0b0b0'; c.beginPath(); c.arc(x + 8, y + 8, 5, 0, 6.3); c.fill(); } }, 1.2, 6, 6)
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
    rack: std({ color: 0xcf6417, roughness: 0.55, metalness: 0.3, roughnessMap: RGH.paint }),
    beam: std({ color: 0x2b5aa6, roughness: 0.5, metalness: 0.4 }),
    deck: std({ color: 0x6a737c, roughness: 0.7, metalness: 0.5 }),
    wood: std({ map: TEX.wood, roughness: 0.85, normalMap: NRM.wood, normalScale: new THREE.Vector2(0.6, 0.6) }),
    parcel: std({ map: TEX.parcel, roughness: 0.9, normalMap: NRM.cardboard, normalScale: new THREE.Vector2(0.5, 0.5) }),
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
  // a box with its edges rounded off: sharp edges read as cardboard, a 12 mm bevel catches the light like a real object
  function bevelGeo(w, h, d, r) {
    var mn = Math.min(w, h, d), mx = Math.max(w, h, d);
    if (r === undefined) r = (mn < 0.03 || mx > 4) ? 0 : Math.min(0.012, mn * 0.22);
    if (!(r > 0)) return boxGeo(w, h, d);
    var k = 'b' + w + ',' + h + ',' + d + ',' + r; if (geoCache[k]) return geoCache[k];
    var shape = new THREE.Shape(), x0 = -w / 2 + r, y0 = -h / 2 + r, x1 = w / 2 - r, y1 = h / 2 - r;
    shape.moveTo(x0, y0); shape.lineTo(x1, y0); shape.lineTo(x1, y1); shape.lineTo(x0, y1); shape.lineTo(x0, y0);
    var g = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 2 });
    g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals();
    return (geoCache[k] = g);
  }
  function box(w, h, d, mat, x, y, z, parent) {
    var m = new THREE.Mesh(mat.map ? boxGeo(w, h, d) : bevelGeo(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m;
  }
  function plane(w, h, mat, x, y, z, rx, ry, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.x = rx || 0; m.rotation.y = ry || 0; m.receiveShadow = true; (parent || scene).add(m); return m;
  }
  function cyl(r, h, mat, x, y, z, parent, seg, rb) { var m = new THREE.Mesh(new THREE.CylinderGeometry(r, rb === undefined ? r : rb, h, seg || 12), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m; }
  function sphere(r, mat, x, y, z, parent) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); m.position.set(x, y, z); m.castShadow = true; (parent || scene).add(m); return m; }
  function sign(lines, w, h, x, y, z, ry, opt, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(lines, opt) })); m.position.set(x, y, z); m.rotation.y = ry || 0; (parent || scene).add(m); return m;
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
  function rackSlotPos(r, b, l) { var P = PROPS['rack' + r] ? propPlacement('rack' + r) : { x: 0, z: RACK.rows[r], rot: 0 }, a = P.rot * Math.PI / 2, lx = RACK.x0 + RACK.bayW * (b + 0.5); return { x: P.x + lx * Math.cos(a), y: RACK.levels[l], z: P.z - lx * Math.sin(a), ry: a }; }
  function slotName(key) { var p = slotParse(key); return 'Row ' + 'ABCDEF'[p.r] + ', bay ' + (p.b + 1) + (p.l === 0 ? ', floor' : p.l === 1 ? ', shelf' : ', top'); }
  function rowName(r) { return 'Row ' + 'ABCDEF'[r]; }

  function buildWorld() {
    var X = HALL.x, Z = HALL.z, H = HALL.h;
    // the hall floor (the ground outside is the yard's job)
    var fl = plane(2 * X, 2 * Z, MAT.floor, 0, 0.001, 0, -Math.PI / 2); fl.receiveShadow = true;
    plane(2 * X - 0.4, 0.12, MAT.trim, 0, 0.06, -Z + 0.16, 0, 0); plane(2 * X - 0.4, 0.12, MAT.trim, 0, 0.06, Z - 0.16, 0, Math.PI);   // the skirting line where wall meets slab
    // walls: four, with the dock doors cut out of the west and east ones and a staff door on the west
    function wallX(x, side) {                                   // a wall along z at x, openings at the docks
      var openings = (side < 0 ? DOCKS.in : DOCKS.out).map(function (d) { return { z0: d.z - DOCKS.w / 2, z1: d.z + DOCKS.w / 2, h: DOCKS.h }; });
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
    var nOpen = [{ x0: WING.belt.x0, x1: WING.belt.x1, h: WING.belt.h }, { x0: WING.door.x0, x1: WING.door.x1, h: WING.door.h }, { x0: 23.4, x1: 24.6, h: 2.3 }], nx = -X - 0.15;
    nOpen.forEach(function (o) { if (o.x0 > nx) { box(o.x0 - nx, H, 0.3, MAT.wall, (nx + o.x0) / 2, H / 2, -Z); solid(nx, o.x0, -Z - 0.15, -Z + 0.15); } box(o.x1 - o.x0, H - o.h, 0.3, MAT.wall, (o.x0 + o.x1) / 2, o.h + (H - o.h) / 2, -Z); solid(o.x0, o.x1, -Z - 0.15, -Z + 0.15, o.h, 9); nx = o.x1; });
    box(X + 0.15 - nx, H, 0.3, MAT.wall, (nx + X + 0.15) / 2, H / 2, -Z); solid(nx, X + 0.15, -Z - 0.15, -Z + 0.15);
    box(2 * X + 0.3, H, 0.3, MAT.wall, 0, H / 2, Z); solid(-X - 0.15, X + 0.15, Z - 0.15, Z + 0.15);
    // roof with skylight strips, and the trusses under it
    box(2 * X + 0.6, 0.3, 2 * Z + 0.6, MAT.roof, 0, H + 0.15, 0);
    plane(2 * X, 2 * Z, MAT.roofIn, 0, H - 0.01, 0, Math.PI / 2);
    SKYLIGHT_Z.forEach(function (z) { var sk = plane(2 * X - 4, 1.6, MAT.skylight, 0, H - 0.02, z, Math.PI / 2); world.lampMeshes.push(sk); });
    for (var tx = -16; tx <= 16; tx += 8) { box(0.25, 0.6, 2 * Z - 0.4, MAT.steelDark, tx, H - 0.35, 0); }
    // high-bay lamps under the trusses
    hallLights.forEach(function (l) { var m = box(0.9, 0.12, 0.5, MAT.lamp, l.position.x, l.position.y + 0.3, l.position.z); world.lampMeshes.push(m); cyl(0.03, 0.4, MAT.steelDark, l.position.x, l.position.y + 0.55, l.position.z); });
    // floor markings: aisles, the walkway, the staging squares
    function lineX(x0, x1, z, w) { plane(x1 - x0, w || 0.1, MAT.yellowLine, (x0 + x1) / 2, 0.006, z, -Math.PI / 2); }
    function lineZ(z0, z1, x, w) { plane(w || 0.1, z1 - z0, MAT.yellowLine, x, 0.006, (z0 + z1) / 2, -Math.PI / 2); }
    function square(cx, cz, s) { lineX(cx - s / 2, cx + s / 2, cz - s / 2); lineX(cx - s / 2, cx + s / 2, cz + s / 2); lineZ(cz - s / 2, cz + s / 2, cx - s / 2); lineZ(cz - s / 2, cz + s / 2, cx + s / 2); }
    square(SPOT.stageIn.x, SPOT.stageIn.z, 3.4); square(SPOT.stageOut.x, SPOT.stageOut.z, 3.4);
    lineX(-X + 0.3, 12.2, 8.2); lineX(-X + 0.3, 12.2, 9.4);                       // the pedestrian walkway along the south strip
    lineZ(-Z + 0.3, Z - 0.3, RACK.x0 - 0.4); lineZ(-Z + 0.3, Z - 0.3, -RACK.x0 + 0.4);              // the rack block edges
    plane(2.6, 0.9, new THREE.MeshBasicMaterial({ map: textTex(['RECEIVING'], { w: 512, h: 128, bg: '#2a2f36', fg: '#f5b53d' }) }), SPOT.stageIn.x, 0.007, SPOT.stageIn.z + 2.2, -Math.PI / 2);
    plane(2.6, 0.9, new THREE.MeshBasicMaterial({ map: textTex(['SHIPPING'], { w: 512, h: 128, bg: '#2a2f36', fg: '#5fd38d' }) }), SPOT.stageOut.x, 0.007, SPOT.stageOut.z + 2.2, -Math.PI / 2);
    // dock doors
    DOCKS.in.forEach(function (d, i) { buildDoor(i, -1, d.z); });
    DOCKS.out.forEach(function (d, i) { buildDoor(2 + i, 1, d.z); });
    // the staff door: a frame, and a ramp down to the yard outside it
    box(0.1, 2.3, 0.08, MAT.steelDark, -X, 1.15, SPOT.staffDoor.z - 0.62); box(0.1, 2.3, 0.08, MAT.steelDark, -X, 1.15, SPOT.staffDoor.z + 0.62); box(0.1, 0.08, 1.3, MAT.steelDark, -X, 2.32, SPOT.staffDoor.z);
    var ramp = box(7.2, 0.2, 2, MAT.grey, -X - 3.6, -0.7, SPOT.staffDoor.z); ramp.rotation.z = Math.atan2(1.2, 7); ramp.position.y = -0.6 - 0.1;
    box(7.2, 0.9, 0.08, MAT.steelDark, -X - 3.6, -0.25, SPOT.staffDoor.z - 1).rotation.z = Math.atan2(1.2, 7); box(7.2, 0.9, 0.08, MAT.steelDark, -X - 3.6, -0.25, SPOT.staffDoor.z + 1).rotation.z = Math.atan2(1.2, 7);
    sign(['STAFF'], 1.2, 0.4, -X - 0.16, 2.7, SPOT.staffDoor.z, -Math.PI / 2, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' });
    // the sign on the road side, and the dock faces
    sign(['DEPOT CO.'], 12, 2.6, 0, 5, Z + 0.17, 0, { w: 1024, h: 224, bg: '#1b232c', fg: '#f5b53d', border: '#f5b53d' });
    sign(['3PL · STORAGE · FULFILMENT'], 10, 0.8, 0, 3.2, Z + 0.17, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8' });
    // the yard lamp posts (the lights themselves live in 05-three)
    // the pallet racks the player owns
    buildOffice(); buildBench(); buildBreakRoom(); buildWing();
    hingedDoor('office', 22.5, 19.45, false, 'the office door', { window: true, swing: 1 });
    hingedDoor('lobby', -25.5, 19.45, false, 'the lobby door', { window: true, swing: -1 });
    hingedDoor('break', -23, -22.95, false, 'the break room door', { window: true, swing: -1 });
    hingedDoor('staff', -X, SPOT.staffDoor.z - 0.5, false, 'the staff door', { mat: MAT.steelDark, swing: 1 });
    hingedDoor('exit', 23.5, -Z, true, 'the fire exit', { mat: MAT.steelDark, pushbar: true, swing: 1 });
    buildYard(); buildDressing(); buildControlCabinet(); buildProps();
  }

  function buildDoor(i, side, z) {
    var x = side * HALL.x;
    var panel = new THREE.Mesh(boxGeo(0.12, DOCKS.h, DOCKS.w), MAT.door); panel.castShadow = true; panel.receiveShadow = true;
    panel.position.set(x - side * 0.22, DOCKS.h / 2, z); scene.add(panel);
    var d = { i: i, side: side, z: z, panel: panel, anim: S.doors[i] ? 1 : 0 };
    addInter(panel, { prompt: function () { return S.doors[i] ? null : (S.events.power ? 'No power: the door motor is dead' : 'Open dock door ' + dockLabel(i) + ' · the cabinet and the consoles close it'); }, use: function () { if (!S.events.power) setDoor(i, true); else toast('No power. Flip the breaker in the office.', 'bad'); } });
    // a pull cord inside, to bring a door down without walking to the cabinet
    var cord = cyl(0.01, 1.2, MAT.red, x - side * 0.35, DOCKS.h - 0.6, z - DOCKS.w / 2 - 0.3, null, 4); var knob = box(0.08, 0.12, 0.08, MAT.red, x - side * 0.35, DOCKS.h - 1.25, z - DOCKS.w / 2 - 0.3);
    addInter(knob, { prompt: function () { return S.doors[i] ? 'Pull the cord: close dock door ' + dockLabel(i) : null; }, use: function () { if (S.doors[i]) setDoor(i, false); } });
    // bumpers, the number outside, the leveller plate, the sign inside
    box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z - DOCKS.w / 2 + 0.3); box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z + DOCKS.w / 2 - 0.3);
    sign([String(i % 2 + 1)], 1.2, 1.2, x + side * 0.17, DOCKS.h + 1.3, z, side < 0 ? -Math.PI / 2 : Math.PI / 2, { w: 128, h: 128, bg: '#f5b53d', fg: '#1a1205' });
    plane(1.6, DOCKS.w - 0.4, MAT.hazard, x - side * 0.8, 0.008, z, -Math.PI / 2);
    sign([i < 2 ? 'IN ' + (i % 2 + 1) : 'OUT ' + (i % 2 + 1)], 2.4, 0.7, x - side * 0.17, DOCKS.h + 0.6, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: i < 2 ? '#f5b53d' : '#5fd38d' });
    doors[i] = d;
  }
  function dockLabel(i) { return (i < 2 ? 'IN ' : 'OUT ') + (i % 2 + 1); }
  function setDoor(i, open) { if (S.doors[i] === open) return; S.doors[i] = open; sfx('roller'); logEvent('Dock door ' + dockLabel(i) + (open ? ' opened' : ' closed')); if (open && i < 2) introStep('door'); rebuildDyn(); }
  function doorAnim(dt) {
    doors.forEach(function (d) { var t = S.doors[d.i] ? 1 : 0; if (d.anim === t) return; d.anim = clamp(d.anim + (t ? dt : -dt) / 1.6, 0, 1); var sc = 1 - d.anim * 0.93; d.panel.scale.y = sc; d.panel.position.y = DOCKS.h - DOCKS.h * sc / 2; });
  }
  function doorPassable(i) { return doors[i].anim > 0.6; }

  function buildRack(r) { if (PROPS['rack' + r]) buildProp('rack' + r); }
  // a rack row as a prop: uprights with bracing and base plates, beams with end plates, mesh decks, bay labels, slot hit volumes, the end guards
  function rackBuild(r) {
    return function (c) {
      var x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05;
      for (var b = 0; b <= RACK.bays; b++) {
        var ux = x0 + b * bw;
        [-dz, dz].forEach(function (oz) { c.box(0.1, 5, 0.1, MAT.rack, ux, 2.5, oz); c.box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, oz); for (var hh = 0.3; hh < 4.9; hh += 0.35) c.box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, oz); });
        for (var br = 0; br < 5; br++) { var yb = 0.4 + br * 1.0; c.box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, 0); var dg = c.box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, 0); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
      }
      for (var l = 1; l < RACK.levels.length; l++) {
        var y = RACK.levels[l];
        c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, -dz); c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, dz);
        for (var bp = 0; bp <= RACK.bays; bp++) { c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, -dz); c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, dz); }
        for (var bb2 = 0; bb2 < RACK.bays; bb2++) { var dk = c.plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, 0, -Math.PI / 2, 0); dk.receiveShadow = false; c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, -0.3); c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, 0.3); }
      }
      for (var bb = 0; bb < RACK.bays; bb++) {
        var cx = x0 + (bb + 0.5) * bw, lbl = 'ABCDEF'[r] + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#f5b53d' });
        var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
        [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, 4.75, s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; c.add(p); });
        for (var ll = 0; ll < RACK.levels.length; ll++) (function (rr, b2, l2) {
          var key = slotKey(rr, b2, l2), hh2 = l2 === 2 ? 1.6 : 1.45;
          slotHits[key] = c.hit(bw - 0.2, hh2, RACK.depth, cx, RACK.levels[l2] + hh2 / 2, 0, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } });
        })(r, bb, ll);
      }
      c.solid(x0 - 0.1, x0 + RACK.bays * bw + 0.1, -RACK.depth / 2, RACK.depth / 2, 0, 5);
      [-1, 1].forEach(function (s) { var x = s > 0 ? x0 + RACK.bays * bw + 0.3 : x0 - 0.3; c.box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, 0); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, -RACK.depth / 2 - 0.1); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, RACK.depth / 2 + 0.1); c.sign(['MAX LOAD', '1000 kg / level', 'row ' + 'ABCDEF'[r]], 0.5, 0.5, x + s * 0.06, 1.6, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 34 }); });
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
    var x0 = 22.5, z0 = 18.5, X = HALL.x, Z = HALL.z, h = 3.2;
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
    var lamp = box(1.2, 0.08, 0.3, MAT.lamp, 26.5, h - 0.05, 21); world.officeLamp = lamp;
    sign(['OFFICE'], 1.4, 0.45, x0 - 0.09, 2.6, 9.95, -Math.PI / 2, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' });
  }

  function buildBench() {
    var bx = SPOT.bench.x, bz = SPOT.bench.z;
    // the two dock consoles by the outbound doors: dispatch a loaded truck early
  }

  // the entrance lobby (south-west corner) and the break room (north-west corner, above IN 1), both walled like the office
  function buildBreakRoom() {
    var X = HALL.x, Z = HALL.z, h = 3.2;
    // the lobby: x -30..-25.5, z 18.5..24; its door onto the hall at z 19.45..20.45 in the east wall, a window south of it
    var x0 = -25.5, z0 = 18.5;
    box(0.15, h, 0.8, MAT.plaster, x0, h / 2, z0 + 0.4); box(0.15, h - 2.2, 1.3, MAT.plaster, x0, 2.2 + (h - 2.2) / 2, 19.95);
    box(0.15, h, 0.6, MAT.plaster, x0, h / 2, 20.9); box(0.15, 1.1, 2.6, MAT.plaster, x0, 0.55, 22.5); box(0.15, h - 2.3, 2.6, MAT.plaster, x0, 2.3 + (h - 2.3) / 2, 22.5); box(0.04, 1.2, 2.6, MAT.glass, x0, 1.7, 22.5); box(0.15, h, 0.2, MAT.plaster, x0, h / 2, Z - 0.1);
    solid(x0 - 0.08, x0 + 0.08, z0, 19.3); solid(x0 - 0.08, x0 + 0.08, 20.6, Z);
    box(X + x0, h, 0.15, MAT.plaster, (-X + x0) / 2, h / 2, z0); solid(-X, x0, z0 - 0.08, z0 + 0.08);
    box(X + x0, 0.12, Z - z0, MAT.plaster, (-X + x0) / 2, h + 0.06, (z0 + Z) / 2);
    lineWall('x', -X, z0 + 0.1, Z - 0.1, h, LINING.lobby, [[SPOT.staffDoor.z - 0.65, SPOT.staffDoor.z + 0.65, 2.25]], 1); lineWall('z', Z, -X + 0.1, x0 - 0.1, h, LINING.lobby, [], -1); plane(X + x0 - 0.2, Z - z0 - 0.2, MAT.tile, (-X + x0) / 2, h - 0.01, (z0 + Z) / 2, Math.PI / 2);
    box(1.2, 0.08, 0.3, MAT.lamp, -27.7, h - 0.05, 21.2);
    for (var bl = 0; bl < 14; bl++) box(0.02, 0.05, 2.5, MAT.trim, x0 + 0.09, 2.26 - bl * 0.08, 22.5);
    sign(['LOBBY'], 1.2, 0.45, x0 + 0.09, 2.6, 19.95, Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
    // the break room: x -30..-23, z -24..-20.2; its door in the east wall at z -22.95..-21.95, a window in the south wall onto the hall
    var bx = -23, bz = -20.2;
    box(0.15, h, 1.05, MAT.plaster, bx, h / 2, -Z + 0.525); box(0.15, h - 2.2, 1.3, MAT.plaster, bx, 2.2 + (h - 2.2) / 2, -22.45); box(0.15, h, 1.6, MAT.plaster, bx, h / 2, bz - 0.8);
    solid(bx - 0.08, bx + 0.08, -Z, -22.95); solid(bx - 0.08, bx + 0.08, -21.95, bz);
    box(1.0, h, 0.15, MAT.plaster, -X + 0.5, h / 2, bz); box(1.2, h, 0.15, MAT.plaster, bx - 0.6, h / 2, bz);
    box(X + bx - 2.2, 1.1, 0.15, MAT.plaster, (-X + 1 + bx - 1.2) / 2, 0.55, bz); box(X + bx - 2.2, h - 2.3, 0.15, MAT.plaster, (-X + 1 + bx - 1.2) / 2, 2.3 + (h - 2.3) / 2, bz); box(X + bx - 2.2, 1.2, 0.04, MAT.glass, (-X + 1 + bx - 1.2) / 2, 1.7, bz);
    solid(-X, bx, bz - 0.08, bz + 0.08);
    box(X + bx, 0.12, Z + bz, MAT.plaster, (-X + bx) / 2, h + 0.06, (-Z + bz) / 2);
    lineWall('x', -X, -Z + 0.1, bz - 0.1, h, LINING.brk, [], 1); lineWall('z', -Z, -X + 0.1, bx - 0.1, h, LINING.brk, [], 1); plane(X + bx - 0.2, Z + bz - 0.2, MAT.tile, (-X + bx) / 2, h - 0.01, (-Z + bz) / 2, Math.PI / 2);
    box(1.2, 0.08, 0.3, MAT.lamp, -26.5, h - 0.05, -22.1);
    for (var bl2 = 0; bl2 < 14; bl2++) box(4.6, 0.05, 0.02, MAT.trim, -26.4, 2.26 - bl2 * 0.08, bz - 0.09);
    sign(['BREAK ROOM'], 1.6, 0.45, bx + 0.09, 2.6, -22.45, Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
  }
  // the order board on the office wall: redrawn when orders change
  function drawBoard() {
    var c = world.boardCtx; if (!c) return; var w = 768, h = 384;
    c.fillStyle = '#0d1b2a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f5b53d'; c.font = 'bold 30px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('OPEN ORDERS', 24, 44); c.font = '22px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8'; c.textAlign = 'right'; c.fillText('Day ' + S.day + '  ' + fmtTime(S.time), w - 24, 44);
    c.textAlign = 'left';
    var open = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed'; }).slice(0, 7);
    if (!open.length) { c.fillStyle = '#5fd38d'; c.font = '26px Bahnschrift, Arial, sans-serif'; c.fillText('Nothing waiting. Nice.', 24, 110); }
    open.forEach(function (o, i) {
      var y = 90 + i * 40; c.fillStyle = o.state === 'packed' ? '#5fd38d' : (o.rush ? '#ff6b5e' : '#eef1f5'); c.font = 'bold 24px Bahnschrift, Arial, sans-serif';
      c.fillText('#' + o.num + '  ' + clientName(o.client), 24, y);
      c.font = '20px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8';
      c.fillText(o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ').slice(0, 46), 330, y);
      c.textAlign = 'right'; c.fillStyle = o.state === 'packed' ? '#5fd38d' : '#f5b53d'; c.fillText(o.state === 'packed' ? 'PACKED' : 'due ' + fmtTime(o.due), w - 24, y); c.textAlign = 'left';
    });
    world.boardTex.needsUpdate = true;
  }

  // where the player stands: the hall floor, a docked trailer's floor, the ramp, or the yard
  function floorY(x, z) {
    if ((Math.abs(x) < HALL.x && Math.abs(z) < HALL.z) || inWing(x, z)) return 0;
    for (var i = 0; i < S.trucks.length; i++) { var t = S.trucks[i]; if (t.state !== 'docked') continue; var b = trailerBounds(t); if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return 0; }
    if (x <= -HALL.x && x > -HALL.x - 7.2 && Math.abs(z - SPOT.staffDoor.z) < 1) return lerp(0, YARD_Y, (-HALL.x - x) / 7);
    return YARD_Y;
  }
  function insideHall(x, z) { return (Math.abs(x) < HALL.x && Math.abs(z) < HALL.z) || inWing(x, z); }
  // ── Touch screens: a canvas drawn in the world, tapped where the crosshair points ─
  var screens = [];
  function touchScreen(o) {
    var c = document.createElement('canvas'); c.width = o.w; c.height = o.h; var ctx = c.getContext('2d');
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.pw, o.ph), new THREE.MeshBasicMaterial({ map: t })); mesh.position.set(o.x, o.y, o.z); mesh.rotation.y = o.ry || 0; (o.parent || scene).add(mesh);
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(o.pw, o.ph), MAT.screenGlass); glass.position.set(0, 0, 0.0015); glass.renderOrder = 2; mesh.add(glass);
    var sc = { w: o.w, h: o.h, ctx: ctx, tex: t, mesh: mesh, zones: [], draw: o.draw, cur: null, ripple: 0, title: o.title, dirty: true };
    addInter(mesh, { prompt: function () { var z = screenZone(sc); return z ? z.label : (o.title || 'Screen'); }, use: function () { screenTap(sc); } });
    screens.push(sc); return sc;
  }
  function screenZone(sc) { var h = ray.intersectObject(sc.mesh, false); if (!h.length || !h[0].uv) { sc.cur = null; return null; } var x = h[0].uv.x * sc.w, y = (1 - h[0].uv.y) * sc.h; sc.cur = { x: x, y: y }; for (var i = 0; i < sc.zones.length; i++) { var z = sc.zones[i]; if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z; } return null; }
  function screenTap(sc) { var z = screenZone(sc); sfx('click'); if (z && z.act) { z.act(); sc.ripple = 1; sc.dirty = true; } }
  function drawScreens(dt) { screens.forEach(function (sc) { if (sc.ripple > 0) { sc.ripple -= dt * 3; sc.dirty = true; } if (!sc.dirty) return; sc.dirty = false; sc.zones.length = 0; sc.draw(sc.ctx, sc); if (sc.cur && sc.ripple > 0) { sc.ctx.strokeStyle = 'rgba(255,255,255,' + sc.ripple + ')'; sc.ctx.lineWidth = 3; sc.ctx.beginPath(); sc.ctx.arc(sc.cur.x, sc.cur.y, (1 - sc.ripple) * 30 + 4, 0, 6.3); sc.ctx.stroke(); } sc.tex.needsUpdate = true; }); }
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
      doors.forEach(function (d, i) { scButton(sc, 16 + i * 98, 160, 90, 38, dockLabel(i) + (S.doors[i] ? ' open' : ' shut'), !!S.doors[i], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(i, !S.doors[i]); }); });
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
    // pilasters on the long walls, and bollards guarding every dock door
    [-12, -4, 4, 12].forEach(function (x) { box(0.4, H, 0.4, MAT.steelDark, x, H / 2, Z - 0.35); }); [-20, -12, 12, 20].forEach(function (x) { box(0.4, H, 0.4, MAT.steelDark, x, H / 2, -Z + 0.35); });   // the north wall's stand clear of the belt opening and the wing doorway
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
    exitSign(14, 2.6, -Z + 0.2, 0); exitSign(-X + 0.2, 2.6, SPOT.staffDoor.z, Math.PI / 2);
    [RACK.x0 - 1.1, -RACK.x0 + 1.1].forEach(function (x) { for (var z = RACK.rows[0] - 1; z <= RACK.rows[RACK.rows.length - 1] + 1; z += 0.7) plane(1.2, 0.35, MAT.whiteLine, x, 0.0065, z, -Math.PI / 2); });
    // dock lights beside every door, wheel chocks inside, guide rails and a chain hoist
    doors.forEach(function (d) {
      var x = d.side * (X - 0.3), z = d.z - DOCKS.w / 2 - 0.5;
      box(0.5, 0.06, 0.06, MAT.steelDark, x + d.side * -0.2, 4.6, z); var lamp = box(0.18, 0.18, 0.18, glowMat(0xffb020, 0.4), x - d.side * 0.5, 4.5, z); dress.dockLamps.push({ m: lamp, door: d.i });
      box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.3); box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.6);
      var rx = d.side * (X - 0.15); box(0.06, DOCKS.h, 0.06, MAT.steelDark, rx, DOCKS.h / 2, d.z - DOCKS.w / 2 - 0.05); box(0.06, DOCKS.h, 0.06, MAT.steelDark, rx, DOCKS.h / 2, d.z + DOCKS.w / 2 + 0.05); cyl(0.1, 0.3, MAT.steelDark, rx - d.side * 0.15, DOCKS.h + 0.3, d.z + DOCKS.w / 2 + 0.35, null, 10).rotation.x = Math.PI / 2; cyl(0.006, DOCKS.h - 0.6, MAT.chrome, rx - d.side * 0.15, DOCKS.h / 2 + 0.2, d.z + DOCKS.w / 2 + 0.35, null, 4);
    });
    // the forklift bay, the tool bays and the charger on the south wall
    var bay = function (cx, cz, w, d, label) { plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz - d / 2, -Math.PI / 2); plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz + d / 2, -Math.PI / 2); plane(0.08, d, MAT.yellowLine, cx - w / 2, 0.0062, cz, -Math.PI / 2); plane(0.08, d, MAT.yellowLine, cx + w / 2, 0.0062, cz, -Math.PI / 2); plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex([label], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), cx, 0.0066, cz + d / 2 - 0.3, -Math.PI / 2); };
    bay(SPOT.jack.x, SPOT.jack.z, 1.6, 2.2, 'JACK'); bay(SPOT.cart.x, SPOT.cart.z, 1.8, 1.4, 'CART');
    plane(1.4, 1.0, MAT.rubberMat, -X + 1.1, 0.004, SPOT.staffDoor.z, -Math.PI / 2); plane(1.0, 1.0, MAT.rubberMat, -24.9, 0.004, 19.95, -Math.PI / 2);
    // the office blinds and the crossing into it
    for (var bl2 = 0; bl2 < 14; bl2++) box(5.4, 0.05, 0.02, MAT.trim, 26.1, 2.26 - bl2 * 0.08, 18.58);
    plane(1.4, 0.08, MAT.yellowLine, -25.5, 0.0062, 19.95, -Math.PI / 2);
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
    [[SPOT.fork.x, SPOT.fork.z], [SPOT.jack.x, SPOT.jack.z], [-16, -4], [16, -4]].forEach(function (p) { var m = plane(2.2, 2.2, oilMat, p[0] + randf(-0.4, 0.4), 0.0046, p[1] + randf(-0.4, 0.4), -Math.PI / 2, randf(0, 3)); m.renderOrder = 1; m.userData.noBake = true; });
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
    dress.dockLamps.forEach(function (l) { var d = doors[l.door]; var coming = S.trucks.some(function (t) { return (t.dir === 'in' ? t.dock : 2 + t.dock) === d.i && (t.state === 'coming' || t.state === 'leaving'); }); l.m.material.emissiveIntensity = coming ? (Math.sin(worldTime * 8) > 0 ? 2.2 : 0.2) : (S.doors[d.i] ? 1.2 : 0.2); });
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
  var HALL_GROW = HALL.x - 20;
  function defProp(id, def) {
    if (!def.abs && typeof def.x === 'number') { def.x = grown(def.x); def.z = grown(def.z); } def.id = id; PROPS[id] = def; PROP_ORDER.push(id); }
  function propDef(id) { if (PROPS[id]) return PROPS[id]; var c = customById(id); return c ? PROPS[c.type] : null; }
  function customById(id) { return (S.custom || []).filter(function (c) { return c.id === id; })[0] || null; }
  function propPlacement(id) {
    var d = PROPS[id], c = customById(id), o = (S.layout && S.layout[id]) || {};
    if (c) return { x: typeof o.x === 'number' ? o.x : c.x, z: typeof o.z === 'number' ? o.z : c.z, rot: typeof o.rot === 'number' ? o.rot : (c.rot || 0), hidden: !!o.hidden, custom: true };
    return { x: typeof o.x === 'number' ? o.x : d.x, z: typeof o.z === 'number' ? o.z : d.z, rot: typeof o.rot === 'number' ? o.rot : (d.rot || 0), hidden: !!o.hidden, custom: false };
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
    for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1);
    delete propInst[id]; NAV.dirty = true;
  }
  function buildProp(id) {
    removePropInst(id);
    var def = propDef(id); if (!def) return null;
    var P = propPlacement(id), g = new THREE.Group(); g.userData.propId = id; g.position.set(P.x, propGroundY(P.x, P.z), P.z); g.rotation.y = P.rot * Math.PI / 2;
    var ctx = propCtx(g, id), inst = { id: id, g: g, P: P, ctx: ctx };
    propInst[id] = inst;
    if (!P.hidden) {
      def.build(ctx, P, inst);
      g.traverse(function (o) { if (o.isMesh) o.userData.propId = id; });
      ctx.obstacles.forEach(function (o) { var r = rotAABB(o, P.rot); solids.push({ x0: P.x + r.x0, x1: P.x + r.x1, z0: P.z + r.z0, z1: P.z + r.z1, y0: o.y0, y1: o.y1, prop: id }); });
      if (def.after) def.after(ctx, P, inst);
      if (!def.wall && ctx.obstacles.length) { var fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9; ctx.obstacles.forEach(function (o) { fx0 = Math.min(fx0, o.x0); fx1 = Math.max(fx1, o.x1); fz0 = Math.min(fz0, o.z0); fz1 = Math.max(fz1, o.z1); }); groundBlob((fx1 - fx0) * 1.5 + 0.3, (fz1 - fz0) * 1.5 + 0.3, (fx0 + fx1) / 2, (fz0 + fz1) / 2, g, 0); }
    }
    scene.add(g); NAV.dirty = true; shadowDirty = true;
    return inst;
  }
  function buildProps() { PROP_ORDER.forEach(function (id) { if (!PROPS[id].extra && (!PROPS[id].when || PROPS[id].when())) buildProp(id); }); (S.custom || []).forEach(function (c) { if (PROPS[c.type]) buildProp(c.id); }); }
  function propGroundY(x, z) { if (insideHall(x, z)) return 0; for (var i = 0; i < S.trucks.length; i++) { var t = S.trucks[i]; if (t.state === 'docked') { var b = trailerBounds(t); if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return 0; } } return YARD_Y; }
  function propIdOf(obj) { for (var o = obj; o; o = o.parent) if (o.userData && o.userData.propId) return o.userData.propId; return null; }

  // ── Build mode ────────────────────────────────────────────────────
  var edit = { on: false, grabbed: null, helper: null, snap: true, wallAim: null };
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
    WALLS.push({ a: 'x', v: 22.42, n: -1, z0: 18.5, z1: Z }, { a: 'x', v: 22.58, n: 1, z0: 18.5, z1: Z }, { a: 'z', v: 18.42, n: -1, x0: 22.5, x1: X }, { a: 'z', v: 18.58, n: 1, x0: 22.5, x1: X });
    WALLS.push({ a: 'x', v: -25.58, n: 1, z0: 18.5, z1: Z }, { a: 'x', v: -25.42, n: -1, z0: 18.5, z1: Z }, { a: 'z', v: 18.42, n: -1, x0: -X, x1: -25.5 }, { a: 'z', v: 18.58, n: 1, x0: -X, x1: -25.5 });
    WALLS.push({ a: 'x', v: -23.08, n: 1, z0: -Z, z1: -20.2 }, { a: 'x', v: -22.92, n: -1, z0: -Z, z1: -20.2 }, { a: 'z', v: -20.28, n: -1, x0: -X, x1: -23 }, { a: 'z', v: -20.12, n: 1, x0: -X, x1: -23 });
    return WALLS;
  }
  function editAim(def) {
    ray.setFromCamera(centre, camera);
    var dir = ray.ray.direction, o = ray.ray.origin, y = Math.max(YARD_Y, floorY(player.x, player.z)), pt;
    var t = (y - o.y) / dir.y;
    if (dir.y < -0.05 && t > 0 && t < 10) pt = o.clone().add(dir.clone().multiplyScalar(t));
    else { var flat = dir.clone(); flat.y = 0; flat.normalize(); pt = o.clone().add(flat.multiplyScalar(2.6)); pt.y = y; }
    var sn = function (v) { return edit.snap ? Math.round(v * 20) / 20 : v; };
    if (def.wall) {
      var best = null, bd = 2.5;
      wallPlanes().forEach(function (w) { var d = w.a === 'x' ? Math.abs(pt.x - w.v) : Math.abs(pt.z - w.v); var within = w.a === 'x' ? (pt.z > w.z0 && pt.z < w.z1) : (pt.x > w.x0 && pt.x < w.x1); if (within && d < bd) { bd = d; best = w; } });
      if (best) { if (best.a === 'x') return { x: best.v, z: sn(pt.z), rot: best.n > 0 ? 1 : 3, wall: true }; return { x: sn(pt.x), z: best.v, rot: best.n > 0 ? 0 : 2, wall: true }; }
    }
    var lim = def.yard ? 80 : HALL.x - 0.4, limz = def.yard ? 60 : HALL.z - 0.4;
    return { x: clamp(sn(pt.x), -lim, lim), z: clamp(sn(pt.z), -limz, limz), rot: null, wall: false };
  }
  function editTick() {
    if (!edit.on) return;
    if (edit.grabbed) {
      var inst = propInst[edit.grabbed]; if (!inst) { edit.grabbed = null; return; }
      var def = propDef(edit.grabbed), aim = editAim(def);
      inst.g.position.set(aim.x, propGroundY(aim.x, aim.z), aim.z); if (aim.rot !== null && def.wall) { inst.P.rot = aim.rot; inst.g.rotation.y = aim.rot * Math.PI / 2; }
      editHelper(inst.g, 0xf5b53d);
    } else if (focus && focus.editId && propInst[focus.editId]) editHelper(propInst[focus.editId].g, 0x5fd38d);
    else editHelper(null);
  }
  function editGrab(id) {
    if (edit.grabbed || !propInst[id]) return;
    var def = propDef(id); if (def.fixed) { toast('That one stays where it is.', 'bad'); return; }
    edit.grabbed = id; for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1); NAV.dirty = true;
    propInst[id].g.traverse(function (o) { if (o.isMesh && o.material && o.material.clone && !o.userData.ghosted) { o.userData.origMat = o.material; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.material.depthWrite = false; o.castShadow = false; o.userData.ghosted = true; } });
    sfx('pickup'); toast('Carrying the ' + propLabel(id) + ' · E places · R turns · Esc drops it back', '');
  }
  function editDrop(cancel) {
    var id = edit.grabbed; if (!id) return; edit.grabbed = null;
    var inst = propInst[id];
    if (!cancel && inst) { if (!S.layout) S.layout = {}; S.layout[id] = { x: Math.round(inst.g.position.x * 100) / 100, z: Math.round(inst.g.position.z * 100) / 100, rot: inst.P.rot }; sfx('putdown'); toast('Placed the ' + propLabel(id), 'good'); }
    buildProp(id); editHelper(null); save();
  }
  function editRotate(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id || !propInst[id]) return;
    var inst = propInst[id], def = propDef(id); if (def.wall && !edit.grabbed) { toast('Wall pieces face the wall.', ''); return; }
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
    if (c) { var def = PROPS[c.type]; S.custom.splice(S.custom.indexOf(c), 1); removePropInst(id); if (def && def.price) { pay(Math.round(def.price / 2), 'Sold back: ' + def.label); toast('Sold the ' + def.label + ' back for half', ''); } }
    else { if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = true; buildProp(id); toast('Removed the ' + propLabel(id) + ' (the catalogue brings it back)', ''); }
    editHelper(null); sfx('bad'); save();
  }
  function editRestore(id) { if (S.layout && S.layout[id]) { delete S.layout[id].hidden; } buildProp(id); sfx('ok'); toast('The ' + propLabel(id) + ' is back', 'good'); save(); }
  function editBuy(type) {
    var def = PROPS[type]; if (!def || !def.extra) return;
    if (def.price && S.bank < def.price) { toast('That costs ' + money(def.price) + ' and you have ' + money(S.bank), 'bad'); return; }
    if (def.price) pay(-def.price, 'Bought: ' + def.label);
    if (!S.custom) S.custom = [];
    var aim = editAim(def), c = { id: uid('cp'), type: type, x: aim.x, z: aim.z, rot: aim.rot || 0 }; S.custom.push(c);
    buildProp(c.id); closePanel(); editGrab(c.id); toast('Carrying the ' + def.label + ' · aim and press E', '');
  }
  // the catalogue (C): removed props to bring back, and extras to buy
  var CAT_GROUPS = [['room', '🛋 Break room and office'], ['hall', '🏭 The hall'], ['wall', '🖼 On the wall'], ['yard', '🌳 The yard']];
  function catalogueHtml() {
    var h = '<p>Build mode. Press <kbd>E</kbd> on a prop to carry it, <kbd>R</kbd> to turn it, <kbd>Backspace</kbd> to put it back where it started, <kbd>Del</kbd> to remove it. Bought extras sell back for half.</p>';
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
  function chairBuild(c) { c.box(0.42, 0.04, 0.42, CHAIR_RED, 0, 0.46, 0); c.box(0.42, 0.38, 0.03, CHAIR_RED, 0, 0.72, -0.2); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (l) { c.cyl(0.014, 0.46, MAT.chrome, l[0], 0.23, l[1], 6); }); c.cyl(0.014, 0.3, MAT.chrome, -0.18, 0.62, -0.2, 6); c.cyl(0.014, 0.3, MAT.chrome, 0.18, 0.62, -0.2, 6); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 0.5); }
  function tableBuild(c) { c.box(0.9, 0.06, 0.9, MAT.wood, 0, 0.75, 0); [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]].forEach(function (o) { c.cyl(0.025, 0.75, MAT.chrome, o[0], 0.375, o[1], 8); }); c.cyl(0.05, 0.1, MAT.white, 0.2, 0.83, -0.1, 10); c.box(0.14, 0.02, 0.2, MAT.paper, -0.2, 0.79, 0.2); c.cyl(0.04, 0.12, std({ color: 0xb8322a, roughness: 0.3, metalness: 0.4 }), 0.3, 0.84, 0.25, 10); c.solid(-0.47, 0.47, -0.47, 0.47, 0, 0.8); }
  function lockerBuild(c) {
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
    c.box(1.9, 0.12, 0.9, MAT.steelDark, 0, 0.3, 0); c.box(1.85, 0.18, 0.85, MAT.blue, 0, 0.45, 0); c.box(0.5, 0.12, 0.42, MAT.white, -0.62, 0.6, 0).rotation.z = 0.08; c.box(0.6, 0.1, 0.8, std({ color: 0x6b2b2b, roughness: 1 }), 0.55, 0.58, 0); c.box(0.6, 0.04, 0.8, std({ color: 0x5a2424, roughness: 1 }), 0.55, 0.65, 0);
    [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(function (o) { c.box(0.05, 0.3, 0.05, MAT.steelDark, o[0], 0.15, o[1]); });
    c.box(1.95, 0.05, 0.05, MAT.steelDark, 0, 0.5, -0.47); c.box(1.95, 0.05, 0.05, MAT.steelDark, 0, 0.5, 0.47); c.box(0.05, 0.4, 0.95, MAT.steelDark, -0.97, 0.45, 0); c.box(0.05, 0.6, 0.95, MAT.steelDark, 0.97, 0.55, 0);
    c.solid(-0.95, 0.95, -0.45, 0.45, 0, 0.7); c.hit(1.9, 0.6, 0.9, 0, 0.5, 0, { prompt: function () { return cotPrompt(); }, use: function () { sleepNow(); } });
  }
  function coffeeBuild(c) {
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
    c.box(0.95, 1.9, 0.8, MAT.blue, 0, 0.95, 0); c.plane(0.6, 1.1, glowMat(0x9ad0ff, 0.35), -0.1, 1.15, 0.41, 0, 0); for (var vr = 0; vr < 4; vr++) for (var vc = 0; vc < 3; vc++) c.box(0.12, 0.16, 0.08, [MAT.red, MAT.green, MAT.yellow, MAT.white][(vr + vc) % 4], -0.3 + vc * 0.2, 0.75 + vr * 0.25, 0.38);
    var gf = c.box(0.62, 1.14, 0.01, MAT.glass, -0.1, 1.15, 0.425); gf.userData.noBake = true; c.box(0.6, 0.02, 0.6, glowMat(0xdfe9ff, 0.5), -0.1, 1.72, 0.1); c.box(0.22, 0.4, 0.02, MAT.steelDark, 0.3, 1.25, 0.42); c.box(0.03, 0.06, 0.01, MAT.black, 0.3, 1.38, 0.432); for (var kp = 0; kp < 6; kp++) c.box(0.03, 0.03, 0.01, MAT.white, 0.24 + (kp % 3) * 0.05, 1.2 - Math.floor(kp / 3) * 0.05, 0.432); c.box(0.5, 0.2, 0.02, MAT.black, -0.1, 0.33, 0.425); c.box(0.44, 0.03, 0.02, MAT.chrome, -0.1, 0.42, 0.432);
    c.sign(['SNACKS'], 0.7, 0.2, -0.1, 1.8, 0.42, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' }); c.solid(-0.5, 0.5, -0.4, 0.4, 0, 2);
    dress.vending = c.hit(1.0, 1.9, 0.9, 0, 0.95, 0, { prompt: function () { return S.events.power ? 'The vending machine is dark' : 'Buy a snack ($3): walk faster for half an hour'; }, use: function () { buySnack(); } });
  }
  function fridgeBuild(c) {
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
  function posterBuild(kind, w, h) { return function (c) { c.poster(kind, w, h, 0, 2.0, 0.01, 0); var fw = w + 0.06, fh = h + 0.06; c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 + fh / 2, 0); c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 - fh / 2, 0); c.box(0.03, fh, 0.03, MAT.black, -fw / 2, 2.0, 0); c.box(0.03, fh, 0.03, MAT.black, fw / 2, 2.0, 0); }; }
  function extinguisherBuild(c) { c.cyl(0.08, 0.5, MAT.red, 0, 1.0, 0.12, 12); c.cyl(0.05, 0.08, MAT.black, 0, 1.28, 0.12, 10); c.box(0.03, 0.12, 0.1, MAT.black, 0, 1.36, 0.14); c.cyl(0.012, 0.42, MAT.black, 0.08, 1.0, 0.15, 6).rotation.z = 0.15; c.cyl(0.02, 0.07, MAT.black, 0.11, 0.79, 0.17, 8, 0.03); c.cyl(0.025, 0.02, MAT.white, 0.0, 1.3, 0.21, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.002, MAT.paper, 0, 1.0, 0.202); c.box(0.2, 0.04, 0.1, MAT.steelDark, 0, 0.72, 0.05); c.sign(['FIRE'], 0.3, 0.12, 0, 1.6, 0.04, 0, { w: 128, h: 48, bg: '#c8342a', fg: '#fff' }); }
  function firstAidBuild(c) { c.box(0.3, 0.3, 0.1, MAT.white, 0, 1.7, 0.05); c.box(0.18, 0.05, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.05, 0.18, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.12, 0.02, 0.02, MAT.chrome, 0, 1.87, 0.05); }
  function binPrompt() { if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'Bin the damaged box'; if (S.hand && S.hand.kind === 'box') return 'That box is fine: it belongs on a rack'; return 'The bin · ' + (S.binned || 0) + ' damaged boxes written off'; }
  function binUse() { if (!(S.hand && S.hand.kind === 'box' && S.hand.damaged)) { sfx('click'); return; } var sku = S.hand.sku; handSet(null); S.binned = (S.binned || 0) + 1; addWaste(2); var cost = Math.round(SKU[sku].val * 0.5); pay(-cost, 'Written off: a damaged box of ' + skuName(sku)); addRep(-0.5); sfx('crate'); toast('Binned. The client charges ' + money(cost) + ' for it.', 'bad'); logEvent('A damaged box of ' + skuName(sku) + ' went in the bin (' + money(cost) + ')', 'bad'); }
  function binBuild(c) { var bin = c.cyl(0.3, 0.85, MAT.red, 0, 0.47, 0, 4, 0.25); bin.rotation.y = Math.PI / 4; var lid = c.box(0.56, 0.05, 0.56, std({ color: 0x8e2420, roughness: 0.7 }), 0, 0.92, 0); lid.rotation.y = Math.PI / 4; c.box(0.08, 0.03, 0.5, MAT.black, 0.22, 0.95, 0); c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, -0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, 0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.015, 0.5, MAT.steelDark, -0.2, 0.09, 0, 6).rotation.x = Math.PI / 2; c.solid(-0.3, 0.3, -0.3, 0.3, 0, 1); c.hit(0.7, 0.9, 0.7, 0, 0.45, 0, { prompt: function () { return binPrompt(); }, use: function () { binUse(); } }); c.sign(['DAMAGED', 'GOODS'], 0.5, 0.3, 0, 1.1, 0.0, 0, { w: 256, h: 128, bg: '#c8342a', fg: '#fff' }); }
  function broomBuild(c) { var broom = c.cyl(0.014, 1.3, MAT.wood, 0.02, 0.72, 0, 6); broom.rotation.z = 0.22; c.box(0.3, 0.06, 0.06, MAT.plastic, 0.18, 0.1, 0); c.box(0.3, 0.06, 0.05, std({ color: 0x8a7a55, roughness: 1 }), 0.18, 0.04, 0); c.cyl(0.02, 0.04, MAT.red, -0.13, 1.36, 0, 8); }
  function wetFloorBuild(c) { var face = new THREE.MeshBasicMaterial({ map: textTex(['CAUTION', 'WET FLOOR'], { w: 192, h: 256, bg: '#f5b53d', fg: '#111', size: 34 }) }); [-1, 1].forEach(function (s) { var pg = new THREE.Group(); pg.position.set(0, 0.72, 0); pg.rotation.x = s * 0.32; c.add(pg); box(0.34, 0.72, 0.012, MAT.yellow, 0, -0.36, s * 0.006, pg); var f = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.6), face); f.position.set(0, -0.38, s * 0.014); f.rotation.y = s > 0 ? 0 : Math.PI; pg.add(f); box(0.02, 0.72, 0.02, MAT.black, -0.17, -0.36, s * 0.01, pg); box(0.02, 0.72, 0.02, MAT.black, 0.17, -0.36, s * 0.01, pg); box(0.34, 0.03, 0.02, MAT.black, 0, -0.72, s * 0.012, pg); }); c.cyl(0.012, 0.36, MAT.black, 0, 0.72, 0, 8).rotation.z = Math.PI / 2; c.box(0.1, 0.03, 0.02, MAT.black, 0, 0.75, 0); }
  // a real wooden pallet: three bearers, seven top boards with gaps, three bottom boards
  function palletModel(c, x, y, z, ry) { var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; c.add(g); [-0.5, 0, 0.5].forEach(function (bz) { box(1.2, 0.08, 0.1, MAT.wood, 0, 0.065, bz, g); box(1.2, 0.022, 0.1, MAT.wood, 0, 0.011, bz, g); }); for (var i = 0; i < 7; i++) box(i === 0 || i === 6 ? 0.14 : 0.1, 0.022, 1.0, MAT.wood, -0.53 + i * 0.1766, 0.116, 0, g); return g; }
  function emptiesBuild(c) {
    for (var i = 0; i < 9; i++) palletModel(c, randf(-0.015, 0.015), i * 0.128, randf(-0.015, 0.015), randf(-0.02, 0.02));
    var mk = std({ color: 0xf0b400, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }); c.plane(1.5, 0.05, mk, 0, 0.004, 0.7, -Math.PI / 2, 0); c.plane(1.5, 0.05, mk, 0, 0.004, -0.7, -Math.PI / 2, 0); c.plane(0.05, 1.45, mk, 0.75, 0.004, 0, -Math.PI / 2, 0); c.plane(0.05, 1.45, mk, -0.75, 0.004, 0, -Math.PI / 2, 0);
    c.cyl(0.02, 1.5, MAT.steel, 1.05, 0.75, 0.75, 8); c.cyl(0.14, 0.04, MAT.steel, 1.05, 0.02, 0.75, 14); c.sign(['EMPTY', 'PALLETS'], 0.5, 0.3, 1.05, 1.5, 0.75, 0, { w: 256, h: 150, bg: '#1b232c', fg: '#f0b400' }); c.sign(['EMPTY', 'PALLETS'], 0.5, 0.3, 1.05, 1.5, 0.75, Math.PI, { w: 256, h: 150, bg: '#1b232c', fg: '#f0b400' });
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
    c.box(2.2, 0.06, 0.8, MAT.wood, 0, 0.75, 0); [[-1, -0.3], [1, -0.3], [-1, 0.3], [1, 0.3]].forEach(function (o) { c.box(0.05, 0.75, 0.05, MAT.steelDark, o[0] * 1.05, 0.375, o[1]); }); c.solid(-1.1, 1.1, -0.4, 0.4, 0, 0.8);
    c.box(0.45, 0.6, 0.6, MAT.grey, -0.75, 0.3, 0); for (var dw = 0; dw < 3; dw++) c.box(0.03, 0.03, 0.2, MAT.chrome, -0.52, 0.12 + dw * 0.18, 0);
    c.box(0.3, 0.05, 0.25, MAT.steelDark, 0, 0.8, 0.2); c.cyl(0.03, 0.25, MAT.steelDark, 0, 0.9, 0.25, 8); c.box(0.8, 0.5, 0.04, MAT.black, 0, 1.25, 0.25);
    pc.screen = touchScreen({ w: 800, h: 500, pw: 0.74, ph: 0.46, x: 0, y: 1.25, z: 0.225, ry: Math.PI, parent: c.group, title: 'Office PC', draw: drawPc });
    c.box(0.6, 0.004, 0.4, std({ color: 0x1f2a36, roughness: 1 }), -0.1, 0.783, -0.15); for (var kr = 0; kr < 3; kr++) for (var kc = 0; kc < 10; kc++) c.box(0.03, 0.012, 0.03, std({ color: 0x4a515b, roughness: 0.6 }), -0.3 + kc * 0.042, 0.822, -0.22 + kr * 0.04);
    c.box(0.06, 0.03, 0.1, MAT.black, 0.5, 0.8, -0.18); c.box(0.2, 0.06, 0.16, MAT.black, -0.75, 0.81, 0.26); c.cyl(0.012, 0.18, MAT.black, -0.75, 0.9, 0.26, 6).rotation.z = Math.PI / 2; c.cyl(0.03, 0.09, MAT.black, 0.9, 0.82, -0.05, 8); c.cyl(0.004, 0.14, MAT.blue, 0.9, 0.9, -0.05, 4).rotation.z = 0.2; c.cyl(0.04, 0.09, MAT.white, 0.7, 0.82, -0.1, 10); c.box(0.2, 0.01, 0.28, MAT.paper, -0.75, 0.785, -0.1);
    c.hit(1.2, 0.9, 0.5, 0, 0.5, -0.1, { prompt: function () { return pc.on ? null : (S.events.power ? 'The PC is off: no power' : 'Sit down at the PC'); }, use: function () { openPc(); } });
  }
  function officeChairBuild(c) { c.box(0.5, 0.06, 0.5, MAT.fabric, 0, 0.53, 0); c.box(0.5, 0.5, 0.06, MAT.fabric, 0, 0.78, -0.25); c.cyl(0.04, 0.5, MAT.steelDark, 0, 0.25, 0, 8); for (var sp = 0; sp < 5; sp++) { var leg = c.box(0.04, 0.03, 0.28, MAT.black, Math.sin(sp / 5 * 6.283) * 0.14, 0.04, Math.cos(sp / 5 * 6.283) * 0.14); leg.rotation.y = sp / 5 * 6.283; c.cyl(0.03, 0.02, MAT.black, Math.sin(sp / 5 * 6.283) * 0.27, 0.03, Math.cos(sp / 5 * 6.283) * 0.27, 8).rotation.x = Math.PI / 2; } c.box(0.04, 0.3, 0.3, MAT.black, -0.26, 0.68, 0); c.box(0.04, 0.3, 0.3, MAT.black, 0.26, 0.68, 0); c.solid(-0.28, 0.28, -0.28, 0.28, 0, 0.6); }
  function cabinetsBuild(c) { [-0.3, 0.3].forEach(function (cx2) { c.box(0.5, 1.3, 0.6, MAT.grey, cx2, 0.65, 0); for (var cd = 0; cd < 3; cd++) { c.box(0.5, 0.36, 0.02, MAT.steelDark, cx2, 0.25 + cd * 0.4, 0.31); c.box(0.14, 0.03, 0.02, MAT.chrome, cx2, 0.33 + cd * 0.4, 0.32); c.box(0.16, 0.06, 0.003, MAT.paper, cx2, 0.2 + cd * 0.4, 0.32); } }); c.box(0.5, 0.25, 0.4, MAT.grey, 0.3, 1.42, 0); c.box(0.4, 0.03, 0.3, MAT.white, 0.3, 1.56, 0.05); c.solid(-0.6, 0.6, -0.35, 0.35, 0, 1.6); }
  function coatStandBuild(c) {
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
    c.box(0.25, 0.12, 0.12, MAT.red, -0.3, 1.0, -1.3); c.cyl(0.07, 0.1, MAT.white, -0.3, 1.02, -1.3, 10); c.box(0.3, 0.05, 0.3, MAT.steelDark, 0.25, 0.965, -1.35); c.plane(0.2, 0.1, MAT.screen, 0.25, 1.0, -1.2, -0.6, 0); c.cyl(0.02, 0.9, MAT.steelDark, -0.4, 1.4, 1.4, 8); c.box(0.3, 0.08, 0.15, MAT.lamp, -0.3, 1.85, 1.4);
    c.box(0.22, 0.14, 0.18, MAT.white, 0.25, 1.01, 0.6); c.box(0.18, 0.01, 0.1, MAT.paper, 0.25, 1.09, 0.72); c.box(0.12, 0.02, 0.03, MAT.yellow, -0.2, 0.955, 0.2).rotation.y = 0.4;
    c.hit(1.1, 1.2, 3.2, 0, 1.4, 0, { prompt: function () { return benchPrompt(); }, use: function () { benchUse(); } });
    c.sign(['PACKING'], 1.8, 0.5, 0.3, 2.6, 0, -Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' });
    // the terminal on an arm at the near end
    c.box(0.26, 0.03, 0.2, MAT.steelDark, 0.3, 0.955, -1.3); c.cyl(0.025, 0.5, MAT.steelDark, 0.3, 1.2, -1.3, 8); c.box(0.36, 0.04, 0.04, MAT.steelDark, 0.14, 1.45, -1.3); c.box(0.04, 0.4, 0.56, MAT.black, -0.02, 1.45, -1.3);
    var scr = touchScreen({ w: 400, h: 300, pw: 0.5, ph: 0.36, x: -0.045, y: 1.45, z: -1.3, ry: -Math.PI / 2, parent: c.group, title: 'Bench terminal', draw: benchScreenDraw }); scr.mesh.userData.propId = 'bench';
    // the stool
    c.cyl(0.17, 0.04, MAT.black, -1.0, 0.65, -0.4, 16); c.cyl(0.02, 0.6, MAT.chrome, -1.0, 0.32, -0.4, 8); c.cyl(0.2, 0.03, MAT.steelDark, -1.0, 0.03, -0.4, 16);
  }
  function benchScreenDraw(c, sc) {
    scBg(c, sc.w, sc.h); scHead(c, sc.w, 'PACKING', benchCount() + ' / ' + ECON.benchCap + ' on the bench');
    var os = openOrders().sort(function (a, b2) { return (b2.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b2.due; }).slice(0, 4), y = 56;
    if (!os.length) scText(c, 16, 76, 'No open orders.', '#a0acb8', 14);
    os.forEach(function (o) { var n = orderNeed(o); scText(c, 16, y + 12, '#' + o.num + ' ' + clientName(o.client).slice(0, 16) + (o.rush ? ' RUSH' : '') + (o.late ? ' LATE' : ''), o.late || o.rush ? '#ff6b5e' : '#eef1f5', 13); scText(c, 16, y + 28, o.lines.map(function (l) { return Math.min(l.qty, S.bench.boxes[l.sku] || 0) + '/' + l.qty + ' ' + skuName(l.sku).slice(0, 12); }).join(' · ').slice(0, 44), '#a0acb8', 11); var can = canPack(o), short = canPackShort(o); scButton(sc, 300, y + 4, 86, 32, can ? 'PACK' : short ? 'SHORT' : n.have + '/' + n.tot, can || short, function () { if (packOrder(o)) toast('Packed #' + o.num, 'good'); }, can ? '#5fd38d' : '#f5b53d'); y += 46; });
    scText(c, 16, 290, 'E on the bench with empty hands opens the full list', '#6b7784', 10);
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
    c.box(0.38, 0.5, 0.12, MAT.grey, 0, 1.5, 0); c.box(0.4, 0.04, 0.14, MAT.steelDark, 0, 1.76, 0); c.box(0.4, 0.04, 0.14, MAT.steelDark, 0, 1.24, 0);
    c.box(0.12, 0.03, 0.02, MAT.black, 0, 1.3, 0.07); tclock.lamp = c.box(0.03, 0.03, 0.02, glowMat(0x39d353, 1.2), 0.14, 1.68, 0.07);
    c.box(0.5, 0.5, 0.08, MAT.steelDark, 0.55, 1.5, -0.02); for (var k = 0; k < 6; k++) c.box(0.06, 0.14, 0.03, MAT.paper, 0.36 + Math.floor(k / 3) * 0.22, 1.62 - (k % 3) * 0.14, 0.04);
    c.sign(['CLOCK IN'], 0.6, 0.16, 0.3, 1.85, 0.0, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' });
    touchScreen({ w: 300, h: 320, pw: 0.3, ph: 0.32, x: 0, y: 1.5, z: 0.07, ry: 0, parent: c.group, title: 'Time clock', draw: drawTimeClock });
  }
  function consoleBuild(di) { return function (c) {
    var inbound = di < 2, k = di % 2;
    c.box(0.5, 0.6, 0.12, MAT.steelDark, 0, 1.45, 0); c.box(0.54, 0.04, 0.14, inbound ? MAT.hazard : MAT.yellow, 0, 1.77, 0); c.cyl(0.012, 1.0, MAT.black, 0, 0.65, -0.03, 6);
    touchScreen({ w: 320, h: 240, pw: 0.4, ph: 0.3, x: 0, y: 1.47, z: 0.065, ry: 0, parent: c.group, title: 'Dock console ' + dockLabel(di), draw: function (cc, sc) {
      scBg(cc, sc.w, sc.h, inbound ? 'rgba(245,181,61,0.16)' : 'rgba(95,211,141,0.16)'); scHead(cc, sc.w, 'DOCK ' + dockLabel(di));
      var t = truckAtDoor(di);
      if (inbound) {
        if (t) { var left = S.pallets.filter(function (q) { return q.place === 'truck' && q.truck === t.id; }).length; scText(cc, 16, 66, 'Truck docked · ' + t.driver + ' · ' + clientName(t.client), '#f5b53d', 14); scText(cc, 16, 86, left + ' of ' + t.pallets.length + ' pallets still on it · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scText(cc, 16, 106, t.signed ? 'Delivery note signed' : 'NOT SIGNED: see the driver outside', t.signed ? '#5fd38d' : '#ff6b5e', 13); }
        else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, 'Inbound slots: ' + TRUCK_IN.map(fmtTime).join(' and ') + (S.up.dock2 || k === 0 ? '' : ' (buy the second bay)'), '#eef1f5', 13); }
        scButton(sc, 16, 128, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
        var pending = S.pallets.filter(function (q) { return q.place === 'floor'; }).length; scButton(sc, 164, 128, 140, 40, pending + ' on the floor', false, function () { scanToggle(true); scanPage(1); });
      } else {
        var nxt = TRUCK_OUT[k];
        if (t) { scText(cc, 16, 66, 'Truck docked · ' + t.driver, '#5fd38d', 15); scText(cc, 16, 86, t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scButton(sc, 16, 104, 288, 44, t.parcels.length ? 'DISPATCH NOW' : 'nothing loaded', t.parcels.length > 0, function () { consoleUse(di); }, '#5fd38d'); }
        else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, 'Next: ' + fmtTime(nxt.arrive) + ' to ' + fmtTime(nxt.leave), '#eef1f5', 13); }
        scButton(sc, 16, 160, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
        var packed = S.orders.filter(function (o) { return o.state === 'packed'; }).length; scButton(sc, 164, 160, 140, 40, packed + ' packed waiting', false, function () { scanToggle(true); scanPage(0); });
      }
      scText(cc, 16, 226, S.events.power ? 'NO POWER' : 'mains ok', S.events.power ? '#ff6b5e' : '#5fd38d', 11);
    } });
    c.sign(['DOCK ' + dockLabel(di)], 0.7, 0.18, 0, 1.95, 0.0, 0, { w: 256, h: 64, bg: '#1b232c', fg: inbound ? '#f5b53d' : '#5fd38d' });
  }; }
  function breakerBuild(c) { var brk = c.box(0.4, 0.6, 0.12, MAT.grey, 0, 1.5, 0); c.box(0.06, 0.12, 0.03, MAT.red, 0, 1.5, 0.07); c.hit(0.5, 0.7, 0.2, 0, 1.5, 0.05, { prompt: function () { return S.events.power ? 'Reset the breaker' : 'Breaker panel (power is on)'; }, use: function () { flipBreaker(); } }); c.sign(['MAIN BREAKER'], 0.6, 0.15, 0, 1.9, 0.01, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' }); }
  function boardBuild(c) {
    var cv = document.createElement('canvas'); cv.width = 768; cv.height = 384; world.boardCtx = cv.getContext('2d');
    world.boardTex = new THREE.CanvasTexture(cv); world.boardTex.encoding = THREE.sRGBEncoding; world.boardMat = new THREE.MeshBasicMaterial({ map: world.boardTex });
    c.cyl(0.03, 2.8, MAT.steelDark, -1.0, 5.6, 0, 6); c.cyl(0.03, 2.8, MAT.steelDark, 1.0, 5.6, 0, 6); c.box(3.1, 0.06, 0.1, MAT.steelDark, 0, 4.2, 0);
    c.box(3.1, 1.6, 0.08, MAT.black, 0, 3.35, 0); var board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); board.position.set(0, 3.35, 0.05); c.add(board); var back = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); back.position.set(0, 3.35, -0.05); back.rotation.y = Math.PI; c.add(back); drawBoard();
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
  function lampPostBuild(c) { c.cyl(0.08, 7.5, MAT.steelDark, 0, 3.75, 0, 8, 0.11); c.box(0.6, 0.2, 0.3, MAT.steelDark, 0, 7.65, 0); var lens = c.box(0.5, 0.04, 0.24, glowMat(0xffd9a0, 0.2), 0, 7.53, 0); yard.lampLenses.push(lens); var l = new THREE.PointLight(0xffd9a0, 0.0, 30, 2); l.position.set(0, 7.7, 0); c.add(l); yardLights.push(l); c.box(0.3, 0.2, 0.3, MAT.grey, 0, 0.1, 0); c.solid(-0.15, 0.15, -0.15, 0.15, -2, 2); }
  function carBuild(k) { return function (c) { c.add(carMesh(typeof k === "number" ? CAR_COLS[k % CAR_COLS.length] : k)); c.solid(-2.2, 2.2, -1.0, 1.0, -2, 1.5); }; }
  function paintedBuild(c) { c.sign(['DEPOT CO.'], 9, 1.6, 0, 4.4, 0.01, 0, { w: 1024, h: 192, bg: '#1b232c', fg: '#f5b53d' }); c.sign(['RECEIVE · STORE · PICK · SHIP'], 7, 0.5, 0, 3.3, 0.01, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8' }); }
  function aisleSignBuild(text) { return function (c) { c.sign([text], 2.2, 0.5, 0, 5.4, 0, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign([text], 2.2, 0.5, 0, 5.4, 0, Math.PI, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.cyl(0.006, 1.3, MAT.steelDark, -0.9, 6.3, 0, 4); c.cyl(0.006, 1.3, MAT.steelDark, 0.9, 6.3, 0, 4); }; }

  // ── Default layout ────────────────────────────────────────────────
  for (var rr = 0; rr < RACK.rows.length; rr++) (function (r) { defProp('rack' + r, { label: 'rack row ' + 'ABCDEF'[r], cat: 'hall', abs: true, x: 0, z: RACK.rows[r], rot: 0, build: rackBuild(r), when: function () { return r < S.up.rows; } }); })(rr);
  defProp('timeclock', { label: 'time clock', cat: 'wall', wall: true, x: -19.74, z: 10.2, rot: 1, build: timeclockBuild });
  defProp('cabinet', { label: 'control cabinet', cat: 'wall', wall: true, x: 12.42, z: 12.6, rot: 3, build: cabinetBuild });
  defProp('consoleIn0', { label: 'dock console IN 1', cat: 'wall', wall: true, abs: true, x: -29.7, z: -11.5, rot: 1, build: consoleBuild(0) });
  defProp('consoleIn1', { label: 'dock console IN 2', cat: 'wall', wall: true, abs: true, x: -29.7, z: -3.5, rot: 1, build: consoleBuild(1) });
  defProp('console0', { label: 'dock console OUT 1', cat: 'wall', wall: true, abs: true, x: 29.7, z: -11.5, rot: 3, build: consoleBuild(2) });
  defProp('console1', { label: 'dock console OUT 2', cat: 'wall', wall: true, abs: true, x: 29.7, z: -3.5, rot: 3, build: consoleBuild(3) });
  defProp('breaker', { label: 'breaker panel', cat: 'wall', wall: true, x: 19.79, z: 9.6, rot: 3, build: breakerBuild });
  defProp('board', { label: 'order board', cat: 'hall', x: 16.2, z: 7.4, rot: 2, build: boardBuild });
  defProp('charger', { label: 'forklift charging point', cat: 'wall', wall: true, x: 0, z: 13.83, rot: 2, build: chargerBuild });
  defProp('painted', { label: 'painted name', cat: 'wall', wall: true, abs: true, x: 17, z: -23.83, rot: 0, build: paintedBuild });
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
  defProp('firstAid', { label: 'first-aid box', cat: 'wall', wall: true, x: -15.6, z: 13.0, rot: 3, build: firstAidBuild });
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
  defProp('binDamaged', { label: 'damaged-goods bin', cat: 'hall', x: 14.3, z: 2.6, rot: 0, build: binBuild });
  defProp('broom', { label: 'broom', cat: 'hall', x: 14.7, z: 3.3, rot: 0, build: broomBuild });
  defProp('wetFloor', { label: 'wet-floor sign', cat: 'hall', x: 13.4, z: 7.6, rot: 1, build: wetFloorBuild });
  defProp('empties', { label: 'stack of empty pallets', cat: 'hall', x: -11.2, z: -12.6, rot: 0, build: emptiesBuild });
  defProp('baler', { label: 'baler', cat: 'hall', x: -7.5, z: -13.2, rot: 0, build: balerBuild });
  defProp('wrapper', { label: 'stretch wrapper', cat: 'hall', abs: true, x: 14, z: -22.3, rot: 0, build: wrapperBuild });
  defProp('hose', { label: 'hose reel', cat: 'wall', wall: true, abs: true, x: -10.5, z: -23.83, rot: 0, build: hoseBuild });
  defProp('extNW', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: -12, rot: 1, build: extinguisherBuild });
  defProp('extNE', { label: 'fire extinguisher', cat: 'wall', wall: true, x: 19.83, z: -12, rot: 3, build: extinguisherBuild });
  defProp('extBench', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 29.83, z: 6.5, rot: 3, build: extinguisherBuild });
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
    box(wx + 0.3, h, 0.3, MAT.wall, cx, h / 2, W.z0); solid(W.x0 - 0.15, W.x1 + 0.15, W.z0 - 0.15, W.z0 + 0.15);
    box(wx + 0.6, 0.3, wz + 0.6, MAT.roof, cx, h + 0.15, cz); plane(wx, wz, MAT.roofIn, cx, h - 0.01, cz, Math.PI / 2);
    [-38, -31].forEach(function (z) { var sk = plane(wx - 4, 1.4, MAT.skylight, cx, h - 0.02, z, Math.PI / 2); world.lampMeshes.push(sk); });
    for (var tz = W.z0 + 4; tz < W.z1; tz += 6) box(wx - 0.4, 0.5, 0.22, MAT.steelDark, cx, h - 0.3, tz);
    world.wingLights = []; [[-8, -39], [4, -39], [-8, -29], [4, -29]].forEach(function (p) { var m = box(0.9, 0.12, 0.5, MAT.lamp, p[0], h - 0.6, p[1]); world.lampMeshes.push(m); cyl(0.03, 0.4, MAT.steelDark, p[0], h - 0.35, p[1]); var l = new THREE.PointLight(0xfff2dc, 0.9, 26, 2); l.position.set(p[0], h - 1.2, p[1]); scene.add(l); world.wingLights.push(l); });
    // the inside face of the shared wall gets a sign over the doorway, the strip curtain, and a steel frame round the belt opening
    sign(['PRODUCTION'], 2.6, 0.6, (W.door.x0 + W.door.x1) / 2, W.door.h + 0.7, W.z1 + 0.17, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#78bdf5' });
    sign(['WAREHOUSE'], 2.6, 0.6, (W.door.x0 + W.door.x1) / 2, W.door.h + 0.7, W.z1 - 0.17, Math.PI, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' });
    var strip = std({ color: 0xdfe8ee, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }); strip.userData.noBake = true;
    box(W.door.x1 - W.door.x0 + 0.3, 0.12, 0.4, MAT.steelDark, (W.door.x0 + W.door.x1) / 2, W.door.h - 0.05, W.z1);
    for (var sx = W.door.x0 + 0.15; sx < W.door.x1; sx += 0.3) { var st = plane(0.28, W.door.h - 0.15, strip, sx, (W.door.h - 0.15) / 2, W.z1 + (sx * 7 % 1) * 0.02 - 0.01, 0, 0); st.rotation.y = ((sx * 13) % 1 - 0.5) * 0.08; }
    box(0.12, W.belt.h + 0.12, 0.5, MAT.yellow, W.belt.x0 - 0.06, (W.belt.h + 0.12) / 2, W.z1); box(0.12, W.belt.h + 0.12, 0.5, MAT.yellow, W.belt.x1 + 0.06, (W.belt.h + 0.12) / 2, W.z1); box(W.belt.x1 - W.belt.x0 + 0.24, 0.12, 0.5, MAT.yellow, (W.belt.x0 + W.belt.x1) / 2, W.belt.h + 0.06, W.z1);
    // floor markings: the walkway down the east side, hazard borders round the machines, a square for raw pallets
    plane(0.1, wz - 1, MAT.yellowLine, W.x1 - 1.6, 0.006, cz, -Math.PI / 2); plane(0.1, wz - 1, MAT.yellowLine, W.x1 - 0.4, 0.006, cz, -Math.PI / 2);
    [[-9.5, -33, 2.0, 2.0]].forEach(function (q) { plane(q[2], 0.08, MAT.whiteLine, q[0], 0.006, q[1] - q[3] / 2, -Math.PI / 2); plane(q[2], 0.08, MAT.whiteLine, q[0], 0.006, q[1] + q[3] / 2, -Math.PI / 2); plane(0.08, q[3], MAT.whiteLine, q[0] - q[2] / 2, 0.006, q[1], -Math.PI / 2); plane(0.08, q[3], MAT.whiteLine, q[0] + q[2] / 2, 0.006, q[1], -Math.PI / 2); });
    sign(['RAW GRANULATE'], 1.6, 0.3, -9.5, 0.008, -31.6, 0, { w: 512, h: 96, bg: 'rgba(0,0,0,0)', fg: '#eef1f5' }).rotation.x = -Math.PI / 2;
    // the pipe rack along the west wall, the compressor in the corner, a cable tray under the roof
    [1.6, 1.9, 2.2].forEach(function (py, i) { var pipe = cyl(0.06 - i * 0.012, wz - 2, i === 1 ? MAT.blue : MAT.steel, W.x0 + 0.45, py + 2.2, cz, null, 10); pipe.rotation.x = Math.PI / 2; }); for (var bz = W.z0 + 2; bz < W.z1 - 1; bz += 3) { box(0.5, 0.06, 0.06, MAT.steelDark, W.x0 + 0.4, 4.0, bz); box(0.06, 0.9, 0.06, MAT.steelDark, W.x0 + 0.62, 4.0, bz); }
    var comp = new THREE.Group(); comp.position.set(7.2, 0, -41.8); scene.add(comp); box(1.6, 0.1, 0.8, MAT.steelDark, 0, 0.05, 0, comp); var tank = cyl(0.32, 1.5, std({ color: 0x3a5f9e, roughness: 0.4, metalness: 0.5 }), 0, 0.5, 0, comp, 16); tank.rotation.z = Math.PI / 2; box(0.5, 0.45, 0.4, MAT.steelDark, 0.2, 1.05, 0, comp); cyl(0.2, 0.3, MAT.black, -0.3, 1.0, 0, comp, 12).rotation.z = Math.PI / 2; cyl(0.05, 0.03, MAT.white, 0.45, 1.2, 0.22, comp, 10).rotation.x = Math.PI / 2; cyl(0.015, 1.2, MAT.black, 0.3, 0.9, 0.4, comp, 6).rotation.x = 0.4; solid(6.3, 8.1, -42.3, -41.3, 0, 1.4);
    sign(['COMPRESSOR · HEARING PROTECTION'], 1.3, 0.14, 7.2, 1.8, -41.2, 0, { w: 512, h: 56, bg: '#1b232c', fg: '#f5b53d' });
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
    var mir = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.05, metalness: 1.0 })); mir.position.set(W.door.x1 + 1.2, 3.0, W.z1 - 0.3); mir.rotation.x = Math.PI / 2; mir.rotation.z = -0.4; scene.add(mir); cyl(0.03, 0.5, MAT.steelDark, W.door.x1 + 1.2, 3.0, W.z1 - 0.1, null, 6).rotation.x = Math.PI / 2; box(0.08, 0.08, 0.6, MAT.black, W.door.x1 + 1.2, 3.0, W.z1 - 0.3);
    sign(['PPE BEYOND THIS POINT', 'ear defenders · safety boots · hi-vis'], 1.2, 0.5, W.door.x0 - 1.5, 2.3, W.z1 + 0.17, 0, { w: 512, h: 200, bg: '#1f4e8c', fg: '#eef1f5' });
    // the finished-goods square in the hall beside the palletiser, and the outside: gutters and downpipes on the wing
    [[-1.0, -22.3, 3.4, 0.08], [-1.0, -16.7, 3.4, 0.08]].forEach(function (l) { plane(l[2], l[3], MAT.yellowLine, l[0], 0.0063, l[1], -Math.PI / 2); }); plane(0.08, 5.6, MAT.yellowLine, 0.7, 0.0063, -19.5, -Math.PI / 2); plane(0.08, 5.6, MAT.yellowLine, -2.7, 0.0063, -19.5, -Math.PI / 2);
    sign(['FINISHED GOODS'], 1.8, 0.3, -1.0, 0.0068, -16.3, 0, { w: 512, h: 96, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }).rotation.x = -Math.PI / 2;
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
    opt = opt || {}; var len = z1 - z0, zc = (z0 + z1) / 2, y = BELT_Y;
    c.box(0.05, 0.1, len, MAT_MACH.frame, x - 0.34, y - 0.04, zc); c.box(0.05, 0.1, len, MAT_MACH.frame, x + 0.34, y - 0.04, zc);
    for (var lz = z0 + 0.3; lz < z1; lz += 1.2) { [-0.3, 0.3].forEach(function (lx) { c.box(0.05, y - 0.12, 0.05, MAT_MACH.frame, x + lx, (y - 0.12) / 2, lz); c.box(0.12, 0.02, 0.12, MAT_MACH.frame, x + lx, 0.01, lz); }); c.box(0.65, 0.04, 0.04, MAT_MACH.frame, x, y - 0.11, lz); }
    for (var rz = z0 + 0.12; rz < z1; rz += 0.24) { var r = c.cyl(0.035, 0.62, MAT_MACH.roller, x, y - 0.02, rz, 10); r.rotation.z = Math.PI / 2; }
    var bt = beltTexBase.clone(); bt.needsUpdate = true; bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, len / 0.5); var bm = std({ map: bt, roughness: 0.9 }); bm.userData.noBake = true;
    var top = c.plane(0.6, len, bm, x, y + 0.02, zc, -Math.PI / 2, 0); BELT_PLANES.push(top);
    c.box(0.03, 0.03, len, MAT_MACH.guard, x - 0.31, y + 0.12, zc); c.box(0.03, 0.03, len, MAT_MACH.guard, x + 0.31, y + 0.12, zc); for (var gz = z0 + 0.4; gz < z1; gz += 1.2) { c.box(0.03, 0.12, 0.03, MAT_MACH.guard, x - 0.31, y + 0.05, gz); c.box(0.03, 0.12, 0.03, MAT_MACH.guard, x + 0.31, y + 0.05, gz); }
    var mt = c.cyl(0.09, 0.22, MAT_MACH.blue, x + 0.48, y - 0.1, z1 - 0.25, 12); mt.rotation.z = Math.PI / 2; c.box(0.1, 0.12, 0.14, MAT.black, x + 0.6, y - 0.1, z1 - 0.25);
    if (!opt.noEye) { c.box(0.03, 0.4, 0.03, MAT_MACH.frame, x - 0.4, y + 0.2, z1 - 0.1); c.box(0.04, 0.05, 0.03, MAT.black, x - 0.4, y + 0.3, z1 - 0.1); c.box(0.02, 0.02, 0.005, glowMat(0xff3b2f, 1.2), x - 0.38, y + 0.3, z1 - 0.1); }
    c.solid(x - 0.4, x + 0.4, z0, z1, 0, 0.95);
  }
  function eStop(c, x, y, z) { c.box(0.12, 0.12, 0.03, MAT.yellow, x, y, z); c.cyl(0.035, 0.04, MAT.red, x, y, z + 0.03, 12).rotation.x = Math.PI / 2; }
  function cabinet(c, x, y, z, w, h, d) { c.box(w, h, d, MAT_MACH.panel, x, y, z); c.box(w + 0.02, 0.05, d + 0.02, MAT_MACH.frame, x, y + h / 2, z); c.box(w - 0.1, h - 0.12, 0.01, std({ color: 0xcfd4d9, roughness: 0.5 }), x, y, z + d / 2 + 0.004); c.box(0.025, 0.08, 0.02, MAT.chrome, x + w / 2 - 0.08, y, z + d / 2 + 0.015); }
  // ── The pack line prop: infeed belt, the case taper, outfeed belt, the gravity shelf
  function packLineBuild(c) {
    conveyorBuild(c, 0, 0, 2.0, { noEye: true });
    // the taper: two side frames, a bridge over the top carrying the taping head, side drive belts, flap folders at the infeed
    [-0.62, 0.62].forEach(function (x) { c.box(0.08, 1.7, 1.8, MAT_MACH.panel, x, 1.15, 2.9); c.box(0.1, 0.06, 1.84, MAT_MACH.frame, x, 0.32, 2.9); c.box(0.1, 0.06, 1.84, MAT_MACH.frame, x, 1.98, 2.9); c.box(0.1, 1.7, 0.06, MAT_MACH.frame, x, 1.15, 2.03); c.box(0.1, 1.7, 0.06, MAT_MACH.frame, x, 1.15, 3.77); });
    c.box(1.4, 0.5, 1.0, MAT_MACH.panel, 0, 2.05, 2.9); c.box(1.44, 0.04, 1.04, MAT_MACH.frame, 0, 1.82, 2.9);
    c.box(0.4, 0.5, 0.5, MAT_MACH.frame, 0, 1.55, 2.9); var roll = c.cyl(0.16, 0.08, MAT.white, 0, 1.62, 3.12, 16); roll.rotation.z = Math.PI / 2; c.cyl(0.03, 0.14, MAT.chrome, 0, 1.62, 3.12, 8).rotation.z = Math.PI / 2; var pr = c.cyl(0.04, 0.3, MAT_MACH.rubber, 0, 1.3, 2.6, 10); pr.rotation.z = Math.PI / 2; c.box(0.04, 0.3, 0.04, MAT_MACH.frame, 0, 1.45, 2.6);
    [-0.44, 0.44].forEach(function (x) { var sb = c.box(0.04, 0.3, 1.5, MAT_MACH.rubber, x, BELT_Y + 0.2, 2.9); for (var k = 0; k < 4; k++) c.cyl(0.05, 0.05, MAT_MACH.roller, x, BELT_Y + 0.2, 2.25 + k * 0.42, 10); });
    for (var rz = 2.1; rz < 3.7; rz += 0.2) { var r = c.cyl(0.035, 0.8, MAT_MACH.roller, 0, BELT_Y - 0.02, rz, 10); r.rotation.z = Math.PI / 2; }
    c.box(0.3, 0.02, 0.4, MAT_MACH.guard, -0.45, BELT_Y + 0.5, 2.15).rotation.z = 0.5; c.box(0.3, 0.02, 0.4, MAT_MACH.guard, 0.45, BELT_Y + 0.5, 2.15).rotation.z = -0.5;
    c.box(0.3, 0.2, 0.22, MAT_MACH.panel, 0.5, 1.2, 3.65); c.box(0.22, 0.01, 0.03, MAT.paper, 0.5, 1.12, 3.78);                         // the label printer at the outfeed
    c.box(1.0, 0.1, 0.05, MAT.hazard, 0, 0.9, 2.0); c.sign(['CASE TAPER 400', 'KEEP HANDS CLEAR OF THE INFEED'], 1.0, 0.2, 0, 1.6, 2.0, 0, { w: 512, h: 100, bg: '#1b232c', fg: '#eef1f5' });
    cabinet(c, 1.05, 1.0, 2.9, 0.5, 1.5, 0.3); c.box(0.5, 0.08, 0.3, MAT_MACH.frame, 1.05, 0.21, 2.9); var scr = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 1.05, y: 1.35, z: 3.06, ry: 0, parent: c.group, title: 'Pack line', draw: packScreenDraw }); scr.mesh.userData.propId = 'packline';
    eStop(c, 1.05, 0.95, 3.06); MACH.taper.lamps = lampStack(c, 1.05, 1.75, 2.9); c.cyl(0.02, 0.6, MAT.black, 1.05, 0.5, 2.75, 6);
    c.hit(1.4, 2.4, 1.8, 0, 1.2, 2.9, { prompt: function () { return packPrompt(); }, use: function () { packUse(); } });
    c.solid(-0.7, 0.7, 2.0, 3.8, 0, 2.4); c.solid(0.8, 1.3, 2.75, 3.05, 0, 1.8);
    conveyorBuild(c, 0, 3.8, 5.8, {});
    // the gravity shelf: a sloped roller bed with an end stop, where parcels wait to be picked up
    for (var sz = 5.9; sz < 7.0; sz += 0.12) { var sr = c.cyl(0.025, 0.7, MAT_MACH.roller, 0, 0.66 - (sz - 5.9) * 0.06, sz, 8); sr.rotation.z = Math.PI / 2; }
    [-0.38, 0.38].forEach(function (x) { var rail = c.box(0.04, 0.08, 1.2, MAT_MACH.frame, x, 0.64, 6.45); rail.rotation.x = 0.06; c.box(0.05, 0.55, 0.05, MAT_MACH.frame, x, 0.28, 5.95); c.box(0.05, 0.5, 0.05, MAT_MACH.frame, x, 0.25, 6.95); });
    c.box(0.8, 0.12, 0.03, MAT_MACH.guard, 0, 0.68, 7.02); c.sign(['PARCELS · TAKE FROM HERE'], 0.8, 0.12, 0, 0.5, 7.03, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#5fd38d' });
    c.solid(-0.45, 0.45, 5.8, 7.05, 0, 0.75);
  }
  // parcels on the shelf: local positions in the pack line's frame
  function shelfSlot(i) { return { lx: i % 2 ? 0.2 : -0.2, lz: 6.05 + Math.floor(i / 2) * 0.26, y: 0.66 - Math.floor(i / 2) * 0.016 + 0.2 }; }
  // ── The moulding line prop: hopper throat, heated barrel, clamp with a moving platen between tie bars, cooling fan, control cabinet, outfeed belt
  function moulderBuild(c) {
    c.box(2.4, 0.3, 4.4, MAT_MACH.frame, 0, 0.15, 0.2); c.box(2.5, 0.06, 4.5, MAT.hazard, 0, 0.33, 0.2);
    c.box(1.2, 0.8, 1.2, MAT_MACH.blue, 0, 0.75, -1.6); c.cyl(0.42, 0.5, MAT_MACH.frame, 0, 1.45, -1.6, 14, 0.2); c.cyl(0.22, 0.4, MAT_MACH.frame, 0, 1.9, -1.6, 12);     // the throat under the feed pipe
    var motor = c.cyl(0.3, 0.7, MAT_MACH.blue, 0, 0.95, -2.3, 14); motor.rotation.x = Math.PI / 2; var fan = c.cyl(0.26, 0.04, MAT.black, 0, 0.95, -2.7, 16); fan.rotation.x = Math.PI / 2;
    var barrel = c.cyl(0.24, 2.0, MAT_MACH.frame, 0, 1.0, -0.6, 16); barrel.rotation.x = Math.PI / 2; for (var hb = -1.4; hb <= 0.2; hb += 0.4) { var band = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 20), std({ color: 0x8a3b1e, roughness: 0.6, metalness: 0.4 })); band.position.set(0, 1.0, hb); c.group.add(band); }
    c.box(0.6, 0.6, 0.4, MAT_MACH.frame, 0.7, 0.75, -1.0); c.box(0.5, 0.12, 0.3, MAT.black, 0.7, 1.1, -1.0);
    // the clamp: a fixed platen at the front, a moving platen (the ram) on four tie bars, guards each side
    var tie = [[-0.55, 0.65], [0.55, 0.65], [-0.55, 1.55], [0.55, 1.55]]; tie.forEach(function (t) { var tb = c.cyl(0.04, 1.6, MAT.chrome, t[0], t[1], 1.2, 10); tb.rotation.x = Math.PI / 2; });
    c.box(1.4, 1.5, 0.22, MAT_MACH.blue, 0, 1.1, 1.95); c.box(1.4, 1.5, 0.22, MAT_MACH.blue, 0, 1.1, 0.45);
    var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn); var ram = box(1.2, 1.3, 0.3, MAT_MACH.panel, 0, 1.1, 1.0, dyn); box(0.6, 0.6, 0.1, MAT_MACH.frame, 0, 0, -0.15, ram); var mould = c.box(0.7, 0.7, 0.2, MAT_MACH.frame, 0, 1.1, 1.75);
    var GL = std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide }); [-0.9, 0.9].forEach(function (x) { c.plane(1.6, 1.4, GL, x, 1.2, 1.2, 0, Math.PI / 2); c.box(0.04, 1.5, 0.04, MAT_MACH.guard, x, 1.15, 0.4); c.box(0.04, 1.5, 0.04, MAT_MACH.guard, x, 1.15, 2.0); c.box(0.04, 0.04, 1.6, MAT_MACH.guard, x, 1.9, 1.2); });
    var wheel = cyl(0.3, 0.06, MAT.black, -1.0, 1.0, -0.6, dyn, 16); wheel.rotation.z = Math.PI / 2; for (var bl = 0; bl < 5; bl++) { var b2 = box(0.5, 0.02, 0.08, MAT_MACH.frame, 0, 0, 0, wheel); b2.rotation.y = bl * 1.257; } c.cyl(0.32, 0.02, MAT_MACH.frame, -1.03, 1.0, -0.6, 16).rotation.z = Math.PI / 2;
    [[-0.9, 0.5, 0.2], [0.9, 0.5, 0.0], [0.9, 0.9, 1.4]].forEach(function (p) { var hs = c.cyl(0.025, 0.9, MAT.black, p[0], p[1], p[2], 6); hs.rotation.x = 0.9; });
    // the outfeed chute from the mould to the belt, and the belt
    var chute = c.box(0.7, 0.03, 1.0, MAT_MACH.roller, 0, 0.95, 2.45); chute.rotation.x = 0.25; c.box(0.03, 0.14, 1.0, MAT_MACH.guard, -0.35, 1.0, 2.45).rotation.x = 0.25; c.box(0.03, 0.14, 1.0, MAT_MACH.guard, 0.35, 1.0, 2.45).rotation.x = 0.25;
    conveyorBuild(c, 0, 2.4, 4.4, {});
    cabinet(c, 1.6, 1.0, 0.2, 0.6, 1.8, 0.4); c.box(0.6, 0.1, 0.4, MAT_MACH.frame, 1.6, 0.15, 0.2); var scr = touchScreen({ w: 400, h: 260, pw: 0.44, ph: 0.29, x: 1.6, y: 1.45, z: 0.41, ry: 0, parent: c.group, title: 'Moulding line', draw: moulderScreenDraw }); scr.mesh.userData.propId = 'moulder';
    eStop(c, 1.6, 0.95, 0.41); MACH.moulder.lamps = lampStack(c, 1.6, 1.9, 0.2); var spin = cyl(0.08, 0.1, glowMat(0xf5b53d, 1.0), -1.1, 2.1, -1.6, dyn, 10); box(0.03, 0.12, 0.03, MAT.black, 0.05, 0, 0, spin); c.cyl(0.02, 0.6, MAT_MACH.frame, -1.1, 1.75, -1.6, 6);
    c.sign(['MOULDING LINE 1', 'HOT SURFACES · AUTOMATIC START'], 1.2, 0.24, 0, 1.8, -2.45, Math.PI, { w: 512, h: 100, bg: '#1b232c', fg: '#eef1f5' });
    MACH.moulder.anim = { ram: ram, wheel: wheel, spin: spin };
    c.hit(2.6, 2.4, 4.6, 0, 1.2, 0.1, { prompt: function () { return moulderPrompt(); }, use: function () { moulderUse(); } });
    c.solid(-1.3, 1.3, -2.8, 2.4, 0, 2.4); c.solid(1.3, 1.95, -0.05, 0.45, 0, 2.0);
  }
  // ── The hopper prop: a cone on legs with a ladder and cage, a vibrating feeder into the pipe that runs to the moulder, a level gauge
  function hopperBuild(c) {
    [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]].forEach(function (p) { c.box(0.1, 2.4, 0.1, MAT_MACH.frame, p[0], 1.2, p[1]); c.box(0.3, 0.02, 0.3, MAT_MACH.frame, p[0], 0.01, p[1]); }); c.box(1.9, 0.08, 0.08, MAT_MACH.frame, 0, 2.38, -0.85); c.box(1.9, 0.08, 0.08, MAT_MACH.frame, 0, 2.38, 0.85); c.box(0.08, 0.08, 1.9, MAT_MACH.frame, -0.85, 2.38, 0); c.box(0.08, 0.08, 1.9, MAT_MACH.frame, 0.85, 2.38, 0);
    var cone = c.cyl(1.05, 1.3, MAT_MACH.panel, 0, 2.95, 0, 20, 0.22); var drum = c.cyl(1.05, 1.4, MAT_MACH.panel, 0, 4.3, 0, 20); var rim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.04, 8, 28), MAT_MACH.frame); rim.position.y = 5.0; rim.rotation.x = Math.PI / 2; c.group.add(rim); c.cyl(0.9, 0.04, MAT_MACH.frame, 0, 5.02, 0, 20); c.box(1.6, 0.03, 0.3, MAT_MACH.frame, 0, 5.05, 0);
    for (var bb = 0; bb < 2; bb++) { var hb = new THREE.Mesh(new THREE.TorusGeometry(1.07, 0.03, 6, 28), MAT_MACH.frame); hb.position.y = 3.8 + bb * 0.8; hb.rotation.x = Math.PI / 2; c.group.add(hb); }
    c.cyl(0.2, 0.3, MAT_MACH.frame, 0, 2.2, 0, 12); var hdyn = new THREE.Group(); hdyn.userData.dynamic = true; c.group.add(hdyn); var feeder = box(0.7, 0.12, 0.4, MAT_MACH.blue, 0.45, 1.9, 0, hdyn); feeder.rotation.z = -0.15; c.box(0.3, 0.3, 0.3, MAT.black, 0.3, 1.6, 0.0);
    var pipe = c.cyl(0.14, 4.4, MAT.steel, 2.6, 1.3, 0, 12); pipe.rotation.z = Math.PI / 2; c.cyl(0.14, 0.8, MAT.steel, 0.65, 1.5, 0, 12).rotation.z = 0.6; var elbow = c.cyl(0.14, 0.6, MAT.steel, 4.8, 1.55, 0, 12); elbow.rotation.z = -0.5;
    // the ladder with its cage, on the +z side
    [-0.2, 0.2].forEach(function (x) { c.box(0.04, 4.6, 0.04, MAT_MACH.frame, x, 2.35, 1.15); }); for (var r = 0.3; r < 4.6; r += 0.3) c.box(0.44, 0.03, 0.03, MAT_MACH.frame, 0, r, 1.15); for (var cg = 2.4; cg < 4.8; cg += 0.6) { var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.02, 6, 16, Math.PI), MAT_MACH.guard); hoop.position.set(0, cg, 1.15); hoop.rotation.x = Math.PI / 2; hoop.rotation.z = 0; c.group.add(hoop); }
    cabinet(c, -1.1, 1.2, 0.95, 0.4, 0.6, 0.2); var scr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: -1.1, y: 1.3, z: 1.06, ry: 0, parent: c.group, title: 'Hopper', draw: hopperScreenDraw }); scr.mesh.userData.propId = 'hopper';
    c.sign(['TIP POINT · PALLETS OF RAW GRANULATE ONLY'], 1.6, 0.16, 0, 0.75, -1.0, Math.PI, { w: 512, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.box(1.6, 0.06, 0.05, MAT.hazard, 0, 0.62, -1.0);
    MACH.hopper.lamps = lampStack(c, -1.1, 1.55, 0.95); MACH.hopper.anim = { feeder: feeder, tipT: 0 };
    c.hit(2.4, 2.4, 2.6, 0, 1.2, 0, { prompt: function () { return hopperPrompt(); }, use: function () { hopperUse(); } });
    c.solid(-1.0, 1.0, -1.0, 1.3, 0, 2.3);
  }
  // ── The palletiser prop: a gantry over a roller cradle, the pusher on its ram, infeed rollers off the belt, a drop zone for the finished pallet
  function palletiserBuild(c) {
    [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]].forEach(function (p) { c.box(0.12, 3.0, 0.12, MAT_MACH.frame, p[0], 1.5, p[1]); c.box(0.3, 0.02, 0.3, MAT_MACH.frame, p[0], 0.01, p[1]); });
    c.box(2.24, 0.14, 0.14, MAT_MACH.frame, 0, 3.0, -1.0); c.box(2.24, 0.14, 0.14, MAT_MACH.frame, 0, 3.0, 1.0); c.box(0.14, 0.14, 2.24, MAT_MACH.frame, -1.0, 3.0, 0); c.box(0.14, 0.14, 2.24, MAT_MACH.frame, 1.0, 3.0, 0);
    c.box(0.3, 0.3, 2.0, MAT_MACH.blue, 0, 2.85, 0); c.cyl(0.08, 0.9, MAT.chrome, 0, 2.25, 0, 10); c.box(0.9, 0.12, 0.9, MAT_MACH.panel, 0, 1.8, 0); c.cyl(0.05, 0.5, MAT_MACH.frame, 0, 2.5, 0, 8);
    for (var rz = -0.75; rz <= 0.75; rz += 0.15) { var r = c.cyl(0.03, 1.5, MAT_MACH.roller, 0, 0.3, rz, 8); r.rotation.z = Math.PI / 2; } c.box(1.6, 0.06, 0.06, MAT_MACH.frame, 0, 0.33, -0.82); c.box(1.6, 0.06, 0.06, MAT_MACH.frame, 0, 0.33, 0.82); [-0.78, 0.78].forEach(function (x) { c.box(0.06, 0.3, 1.7, MAT_MACH.frame, x, 0.18, 0); });
    for (var iz = -1.6; iz < -0.9; iz += 0.12) { var ir = c.cyl(0.03, 0.62, MAT_MACH.roller, 0, BELT_Y - 0.02, iz, 8); ir.rotation.z = Math.PI / 2; } c.box(0.05, 0.1, 0.8, MAT_MACH.frame, -0.34, BELT_Y - 0.04, -1.25); c.box(0.05, 0.1, 0.8, MAT_MACH.frame, 0.34, BELT_Y - 0.04, -1.25); c.box(0.05, 0.7, 0.05, MAT_MACH.frame, -0.3, 0.35, -1.5); c.box(0.05, 0.7, 0.05, MAT_MACH.frame, 0.3, 0.35, -1.5);
    var slide = c.box(0.7, 0.03, 0.5, MAT_MACH.roller, 0, 0.55, -0.95); slide.rotation.x = -0.5;
    [-1.15, 1.15].forEach(function (x) { c.box(0.06, 1.6, 0.06, MAT.yellow, x, 0.8, -1.1); c.box(0.02, 1.4, 0.02, glowMat(0xff3b2f, 0.6), x, 0.8, -1.06); });
    cabinet(c, 1.4, 1.0, 0.6, 0.5, 1.5, 0.3); var scr = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 1.4, y: 1.35, z: 0.76, ry: 0, parent: c.group, title: 'Palletiser', draw: palletiserScreenDraw }); scr.mesh.userData.propId = 'palletiser';
    eStop(c, 1.4, 0.95, 0.76); MACH.palletiser.lamps = lampStack(c, 1.4, 1.75, 0.6);
    c.box(1.6, 0.012, 1.4, MAT.hazard, 2.2, 0.006, 0); c.sign(['PALLET DROP · KEEP CLEAR'], 1.4, 0.16, 2.2, 0.008, -0.8, 0, { w: 512, h: 56, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }).rotation.x = -Math.PI / 2;
    c.sign(['PALLETISER'], 1.6, 0.4, 0, 3.3, 0, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' });
    c.hit(2.4, 3.2, 2.4, 0, 1.6, 0, { prompt: function () { return palletiserPrompt(); }, use: function () { palletiserUse(); } });
    c.solid(-1.1, 1.1, -1.1, 1.1, 0, 3); c.solid(-0.4, 0.4, -1.7, -1.1, 0, 0.9); c.solid(1.15, 1.65, 0.45, 0.75, 0, 1.8);
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
    c.box(1.8, 1.6, 1.0, MAT_MACH.panel, 0, 0.85, 0); c.box(1.84, 0.1, 1.04, MAT_MACH.frame, 0, 0.05, 0); c.box(1.84, 0.06, 1.04, MAT_MACH.frame, 0, 1.68, 0);
    [-0.45, 0.45].forEach(function (x) { c.cyl(0.36, 0.05, MAT.black, x, 1.72, 0, 20); var fan = c.cyl(0.3, 0.03, MAT_MACH.frame, x, 1.75, 0, 20); for (var b = 0; b < 5; b++) { var bl = box(0.5, 0.01, 0.08, MAT.black, 0, 0, 0, fan); bl.rotation.y = b * 1.257; } c.cyl(0.05, 0.06, MAT.black, x, 1.78, 0, 10); });
    for (var g = -0.8; g < 0.8; g += 0.1) c.box(0.02, 1.3, 0.02, MAT.black, g, 0.85, 0.51); c.box(0.4, 0.3, 0.02, MAT_MACH.frame, 0.6, 1.3, 0.52); c.plane(0.24, 0.1, MAT.screen, 0.6, 1.32, 0.535, 0, 0);
    var p1 = c.cyl(0.06, 1.8, MAT.blue, -0.7, 0.6, -0.6, 10); p1.rotation.x = Math.PI / 2; var p2 = c.cyl(0.06, 1.8, MAT.red, -0.5, 0.6, -0.6, 10); p2.rotation.x = Math.PI / 2;
    c.sign(['CHILLER · 12 kW'], 0.8, 0.14, -0.4, 0.55, 0.52, 0, { w: 512, h: 72, bg: '#1b232c', fg: '#eef1f5' });
    c.solid(-0.95, 0.95, -0.55, 0.55, 0, 2.0);
  }
  function dryerBuild(c) {
    [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(function (p) { c.box(0.08, 1.6, 0.08, MAT_MACH.frame, p[0], 0.8, p[1]); }); c.box(1.2, 0.06, 1.2, MAT_MACH.frame, 0, 1.6, 0);
    c.cyl(0.55, 0.9, MAT_MACH.panel, 0, 2.1, 0, 18, 0.15); c.cyl(0.55, 1.4, MAT_MACH.panel, 0, 3.25, 0, 18); c.cyl(0.55, 0.3, MAT_MACH.panel, 0, 4.1, 0, 18, 0.2); c.cyl(0.12, 0.5, MAT_MACH.frame, 0, 4.5, 0, 10);
    c.box(0.6, 0.8, 0.5, MAT_MACH.frame, 0, 0.9, 0); c.cyl(0.18, 0.4, MAT.black, 0, 0.9, 0.35, 12).rotation.x = Math.PI / 2; var hose = c.cyl(0.05, 2.0, MAT.black, 0.9, 2.4, 0, 8); hose.rotation.z = 0.7;
    c.box(0.3, 0.4, 0.2, MAT_MACH.panel, 0.75, 1.3, 0.3); c.plane(0.2, 0.1, MAT.screen, 0.75, 1.38, 0.41, 0, 0); c.box(0.04, 0.04, 0.02, glowMat(0x5fd38d, 1.2), 0.68, 1.2, 0.41);
    c.sign(['GRANULATE DRYER', '80 °C'], 0.8, 0.3, 0, 3.2, 0.56, 0, { w: 512, h: 150, bg: '#1b232c', fg: '#eef1f5' });
    c.solid(-0.6, 0.6, -0.6, 0.6, 0, 2.0);
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
  // ── Defaults
  defProp('packline', { label: 'pack line', cat: 'hall', abs: true, x: 26.6, z: 7.2, rot: 0, build: packLineBuild });
  defProp('moulder', { label: 'moulding line', cat: 'factory', abs: true, x: -4, z: -37, rot: 0, build: moulderBuild });
  defProp('beltMain', { label: 'main belt', cat: 'factory', abs: true, x: -4, z: -32.5, rot: 0, build: beltMainBuild });
  defProp('palletiser', { label: 'palletiser', cat: 'hall', abs: true, x: -4, z: -19.5, rot: 0, build: palletiserBuild });
  defProp('hopper', { label: 'raw hopper', cat: 'factory', abs: true, x: -9.5, z: -37, rot: 0, build: hopperBuild });
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
  defProp('posterWing', { label: 'safety poster', cat: 'wall', wall: true, abs: true, x: 9.83, z: -36, rot: 3, build: posterBuild('safety', 0.7, 1.05) });
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
    doors.forEach(function (d) {
      // the steps: 6 risers from the yard to the landing at hall level, outside the dock door on its +z side, with a tube handrail
      var sx = side_(d.side), ST = std({ map: TEX.plaster, color: 0x9a9890, roughness: 0.95 }), HR = std({ color: 0xf5b53d, roughness: 0.5, metalness: 0.4 });
      for (var st = 0; st < 6; st++) { box(1.1, 0.2, (6 - st) * 0.3, ST, sx * (X + 0.85), YARD_Y + 0.1 + st * 0.2, d.z + 4.4 + (6 - st) * 0.15); }
      box(1.1, 1.2, 1.6, ST, sx * (X + 0.85), YARD_Y + 0.6, d.z + 3.6);
      [-0.5, 0.5].forEach(function (hx) { var px = sx * (X + 0.85 + hx); cyl(0.025, 1.0, HR, px, YARD_Y + 1.7, d.z + 3.0, null, 8); cyl(0.025, 1.0, HR, px, YARD_Y + 1.7, d.z + 4.3, null, 8); cyl(0.025, 1.0, HR, px, YARD_Y + 0.5, d.z + 6.1, null, 8); var rail = cyl(0.025, 1.5, HR, px, YARD_Y + 2.2, d.z + 3.65, null, 8); rail.rotation.x = Math.PI / 2; var rail2 = cyl(0.025, 2.2, HR, px, YARD_Y + 1.6, d.z + 5.2, null, 8); rail2.rotation.x = Math.PI / 2 + 0.58; });
      solid(sx * (X + 0.3), sx * (X + 1.4), d.z + 2.8, d.z + 6.3, YARD_Y, YARD_Y + 1.3);
      var side = d.side, x0 = side * (X + 1), x1 = side * 76, cx = (x0 + x1) / 2, len = Math.abs(x1 - x0);
      plane(len, 0.15, MAT.whiteLine, cx, YARD_Y + 0.012, d.z - 2.2, -Math.PI / 2); plane(len, 0.15, MAT.whiteLine, cx, YARD_Y + 0.012, d.z + 2.2, -Math.PI / 2);
      for (var x = side * (X + 8); Math.abs(x) < 74; x += side * 4) plane(2, 0.12, MAT.whiteLine, x, YARD_Y + 0.012, d.z, -Math.PI / 2);
      for (var k = 0; k < 6; k++) { var hp = plane(5, 0.14, MAT.yellowLine, side * (X + 3.5), YARD_Y + 0.013, d.z - 2 + k * 0.8, -Math.PI / 2); hp.rotation.z = side * 0.6; }
      sign([String(d.i % 2 + 1)], 2.4, 2.4, side * (X + 4), YARD_Y + 0.014, d.z - 1, 0, { w: 128, h: 128, bg: '#3b3d40', fg: '#d8dbdf' }).rotation.set(-Math.PI / 2, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      // the dock shelter and its lamp
      var sx = side * (X + 0.75); box(0.5, 0.6, DOCKS.w + 1.4, MAT.rubber, sx + side * 0.25, DOCKS.h + 0.5, d.z); box(1.0, DOCKS.h + 0.8, 0.5, MAT.rubber, sx, DOCKS.h / 2 + 0.4, d.z - DOCKS.w / 2 - 0.45); box(1.0, DOCKS.h + 0.8, 0.5, MAT.rubber, sx, DOCKS.h / 2 + 0.4, d.z + DOCKS.w / 2 + 0.45);
      plane(DOCKS.w + 1.4, 0.6, MAT.hazard, side * (X + 0.26), DOCKS.h + 0.5, d.z, 0, side > 0 ? Math.PI / 2 : -Math.PI / 2);
      box(0.08, 0.08, 0.6, MAT.steelDark, side * (X + 0.6), DOCKS.h + 1.0, d.z + DOCKS.w / 2 + 1.0); var lens = box(0.3, 0.2, 0.3, glowMat(0xfff2c0, 0.2), side * (X + 0.9), DOCKS.h + 0.95, d.z + DOCKS.w / 2 + 1.0); yard.lampLenses.push(lens);
    });
    // the fence: mesh panels between posts, with a sliding gate on each truck side and the gatehouse beside it
    var FPOST = std({ color: 0x2f5d3a, roughness: 0.5, metalness: 0.5 }), FMESH = std({ map: TEX.vmesh, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x3d6b48 }), FCONC = std({ map: TEX.plaster, color: 0x9a9890, roughness: 0.95 }), FWIRE = std({ color: 0x8e949a, roughness: 0.4, metalness: 0.8 });
    function fenceRun(x0, z0, x1, z1) {
      var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz), n = Math.round(len / 3), ang = Math.atan2(dx, dz), ux = dx / len, uz = dz / len, nx = uz, nz = -ux;
      for (var i = 0; i <= n; i++) {
        var t = i / n, px = x0 + dx * t, pz = z0 + dz * t;
        box(0.08, 2.5, 0.08, FPOST, px, YARD_Y + 1.25, pz); box(0.3, 0.25, 0.3, FCONC, px, YARD_Y + 0.12, pz); box(0.12, 0.03, 0.12, FPOST, px, YARD_Y + 2.52, pz);
        var arm = box(0.04, 0.6, 0.04, FPOST, px + nx * 0.2, YARD_Y + 2.72, pz + nz * 0.2); arm.rotation.set(0, ang, -0.7, 'YXZ'); arm.position.y += 0.1;
        if (i < n) {
          var mx = x0 + dx * (t + 0.5 / n), mz = z0 + dz * (t + 0.5 / n), seg = len / n;
          var mp = plane(seg - 0.1, 2.2, FMESH, mx, YARD_Y + 1.35, mz, 0, ang); mp.receiveShadow = false;
          [0.75, 1.65].forEach(function (vy) { var fold = box(seg - 0.1, 0.06, 0.03, FPOST, mx, YARD_Y + vy, mz); fold.rotation.y = ang; });
          var gb = box(seg, 0.3, 0.05, FCONC, mx, YARD_Y + 0.15, mz); gb.rotation.y = ang; var tr = box(seg, 0.03, 0.03, FPOST, mx, YARD_Y + 2.46, mz); tr.rotation.y = ang; var br = box(seg, 0.03, 0.03, FPOST, mx, YARD_Y + 0.32, mz); br.rotation.y = ang;
        }
      }
      [0, 1, 2].forEach(function (k) { var wy = YARD_Y + 2.62 + k * 0.17, wo = 0.22 + k * 0.14; var wire = cyl(0.006, len, FWIRE, (x0 + x1) / 2 + nx * wo, wy, (z0 + z1) / 2 + nz * wo, null, 4); wire.rotation.x = Math.PI / 2; wire.rotation.z = 0; wire.rotation.order = 'YXZ'; wire.rotation.y = ang; });
    }
    fenceRun(-84, -60, 84, -60); fenceRun(-84, 60, 84, 60);
    [-1, 1].forEach(function (side) {
      var gx = side * 84; fenceRun(gx, -60, gx, -11.5); fenceRun(gx, 3.5, gx, 60);
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
      sign(['GATE ' + (side < 0 ? 'WEST' : 'EAST')], 1.8, 0.4, hx, YARD_Y + 2.6, hz - 1.42, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' });
      sign(['STOP', 'REPORT TO THE GATE'], 1.0, 1.0, gx + side * 10, YARD_Y + 2.2, -4, side > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#c8342a', fg: '#fff', size: 52 }); cyl(0.04, 2.2, MAT.steelDark, gx + side * 10, YARD_Y + 1.1, -4, null, 6);
      var guard = makeHuman({ vest: MAT.hivis, cap: true, capMat: MAT.black, shirt: MAT.jeans }); guard.position.set(hx, YARD_Y + 0.2, hz - 0.2); guard.rotation.y = Math.PI; scene.add(guard); yard.guards.push({ g: guard, side: side });
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
    // the sky: a sun, a moon, clouds; the weather: puddles, rain, snow
    var sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(255,244,214,1)'), transparent: true, depthWrite: false, fog: false })); sunSp.scale.set(26, 26, 1); scene.add(sunSp); yard.sunDisc = sunSp;
    var moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(225,230,240,0.9)'), transparent: true, depthWrite: false, fog: false })); moonSp.scale.set(12, 12, 1); scene.add(moonSp); yard.moon = moonSp;
    var ct = cloudTex();
    for (var k = 0; k < 10; k++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.85, fog: false })); var s = randf(50, 90); sp.scale.set(s, s * 0.5, 1); sp.position.set(randf(-200, 200), randf(70, 100), randf(-200, 200)); scene.add(sp); yard.clouds.push({ sp: sp, v: randf(0.6, 1.4) }); }
    for (var p = 0; p < 12; p++) { var pm = new THREE.Mesh(new THREE.CircleGeometry(randf(1.2, 3.2), 18), std({ color: 0x151a22, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0 })); pm.rotation.x = -Math.PI / 2; pm.position.set(randf(-70, 70), YARD_Y + 0.02, randf(-50, 50)); pm.scale.x = randf(1, 2.2); scene.add(pm); yard.puddles.push(pm); }
    var streak = tex(16, 64, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(210,225,240,0)'); g.addColorStop(0.5, 'rgba(210,225,240,0.9)'); g.addColorStop(1, 'rgba(210,225,240,0)'); c.fillStyle = g; c.fillRect(6, 0, 4, h); });
    var flake = tex(32, 32, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    var mkPoints = function (n, size, map, range) { var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3); for (var i = 0; i < n; i++) { pos[i * 3] = randf(-range, range); pos[i * 3 + 1] = randf(0, 16); pos[i * 3 + 2] = randf(-range, range); } geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); var pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: map, size: size, transparent: true, opacity: 0.85, depthWrite: false, alphaTest: 0.05 })); pts.visible = false; pts.frustumCulled = false; scene.add(pts); return pts; };
    yard.rain = mkPoints(6000, 0.55, streak, 24); yard.snow = mkPoints(3000, 0.22, flake, 30);
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
    if (raining) { var p = yard.rain.geometry.attributes.position.array, px = player.x, pz = player.z; for (var r = 0; r < p.length; r += 3) { p[r + 1] -= (9 + (W.kind === 'storm' ? 4 : 0)) * dt; var inHall = Math.abs(p[r]) < HALL.x && Math.abs(p[r + 2]) < HALL.z, roofY = inHall ? HALL.h + 0.3 : YARD_Y; if (!inHall) for (var tk = 0; tk < S.trucks.length; tk++) { var tb = trailerBounds(S.trucks[tk]); if (p[r] > tb.x0 - 3.5 && p[r] < tb.x1 + 3.5 && p[r + 2] > tb.z0 - 0.4 && p[r + 2] < tb.z1 + 0.4) { roofY = TRAILER.h + 0.1; break; } } if (p[r + 1] < roofY || Math.abs(p[r] - px) > 26 || Math.abs(p[r + 2] - pz) > 26) { p[r] = px + randf(-24, 24); p[r + 1] = randf(6, 16); p[r + 2] = pz + randf(-24, 24); } } yard.rain.geometry.attributes.position.needsUpdate = true; }
    if (snowing) { var q = yard.snow.geometry.attributes.position.array, qx = player.x, qz = player.z; for (var s = 0; s < q.length; s += 3) { q[s + 1] -= 1.3 * dt; q[s] += Math.sin(yard.windT + s) * 0.4 * dt; var inH = Math.abs(q[s]) < HALL.x && Math.abs(q[s + 2]) < HALL.z; if (q[s + 1] < (inH ? HALL.h + 0.3 : YARD_Y) || Math.abs(q[s] - qx) > 32 || Math.abs(q[s + 2] - qz) > 32) { q[s] = qx + randf(-30, 30); q[s + 1] = randf(6, 16); q[s + 2] = qz + randf(-30, 30); } } yard.snow.geometry.attributes.position.needsUpdate = true; }
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
  var counts = {};
  function setInst(im, i, x, y, z, ry) { _e.set(0, ry || 0, 0); _q.setFromEuler(_e); _m4.compose(_v.set(x, y, z), _q, _s1); im.setMatrixAt(i, _m4); }
  function putBox(sku, x, y, z, ry, src) { var im = boxInst[sku]; if (!im) return; var i = counts[sku]++; if (i >= 1400) return; setInst(im, i, x, y, z, ry); instSrc.box[sku][i] = src; }
  function putPallet(x, y, z, ry, src) { var i = counts.pallet++; if (i >= 400) return; setInst(palletInst, i, x, y, z, ry); instSrc.pallet[i] = src; }
  function putParcel(x, y, z, ry, src) { var i = counts.parcel++; if (i >= 400) return; setInst(parcelInst, i, x, y, z, ry); instSrc.parcel[i] = src; }
  // boxes on a pallet: four to a layer, up to three layers
  function boxOffset(i, ry) { var layer = Math.floor(i / 4), k = i % 4, ox = k % 2 ? 0.29 : -0.29, oz = k < 2 ? -0.24 : 0.24; var c = Math.cos(ry || 0), s = Math.sin(ry || 0); return { x: ox * c + oz * s, z: -ox * s + oz * c, y: 0.14 + BOX.h / 2 + layer * BOX.h }; }
  function drawPalletWithBoxes(sku, n, x, y, z, ry, src) { putPallet(x, y + 0.07, z, ry, src); for (var i = 0; i < n; i++) { var o = boxOffset(i, ry); putBox(sku, x + o.x, y + o.y, z + o.z, ry, src); } }

  function palletWorld(p) {
    if (p.place === 'floor') return { x: p.x, y: p.y || 0, z: p.z, ry: p.rot || 0 };
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t) return null; return truckPalletPos(t, p.idx); }
    if (p.place === 'jack') { var jw = toolWorld('jack'); return { x: jw.x, y: 0.1, z: jw.z, ry: jw.ry }; }
    if (p.place === 'fork') { var fw = forkTip(); return { x: fw.x, y: fw.y, z: fw.z, ry: S.fork.yaw }; }
    if (p.place === 'staff') { var st = staffById(p.staff); if (!st) return null; return { x: st.x + Math.sin(st.yaw) * 0.95, y: 0.1, z: st.z + Math.cos(st.yaw) * 0.95, ry: st.yaw }; }
    return null;
  }
  function syncInstances() {
    SKUS.forEach(function (s) { counts[s.id] = 0; }); counts.pallet = 0; counts.parcel = 0;
    for (var key in S.slots) { var sl = S.slots[key]; if (!sl || !sl.n) continue; var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l); drawPalletWithBoxes(sl.sku, sl.n, sp.x, sp.y, sp.z, sp.ry || 0, { kind: 'slot', key: key }); }
    S.pallets.forEach(function (pl) { var w = palletWorld(pl); if (!w) return; drawPalletWithBoxes(pl.sku, pl.n, w.x, w.y, w.z, w.ry, { kind: 'pallet', id: pl.id, carried: pl.place !== 'floor' && pl.place !== 'truck' }); });
    // the bench and its shelf follow the bench prop: box positions are local to it, clear of the terminal at its near end
    var BP = PROPS.bench ? propPlacement('bench') : { x: SPOT.bench.x, z: SPOT.bench.z, rot: 0 }, ba = BP.rot * Math.PI / 2, bc = Math.cos(ba), bs = Math.sin(ba);
    var benchW = function (lx, lz) { return { x: BP.x + lx * bc + lz * bs, z: BP.z - lx * bs + lz * bc }; };
    var bi = 0; SKUS.forEach(function (s) { var n = S.bench.boxes[s.id] || 0; for (var i = 0; i < n; i++, bi++) { var w = benchW(bi % 2 ? 0.23 : -0.23, -0.72 + (Math.floor(bi / 2) % 4) * 0.6); putBox(s.id, w.x, 0.94 + BOX.h / 2 + Math.floor(bi / 8) * BOX.h, w.z, ba, { kind: 'bench', sku: s.id }); } });
    var LP = PROPS.packline ? propPlacement('packline') : BP, la = LP.rot * Math.PI / 2, lc = Math.cos(la), ls = Math.sin(la);
    S.bench.parcels.forEach(function (oid, i) { var s = shelfSlot(i); putParcel(LP.x + s.lx * lc + s.lz * ls, s.y, LP.z - s.lx * ls + s.lz * lc, la, { kind: 'shelf', order: oid }); });
    drawBeltItems();
    S.floor.forEach(function (f, i) { if (f.kind === 'box') { if (f.damaged) { var im = boxInst[f.sku]; if (im) { var ii = counts[f.sku]++; if (ii < 1400) { _e.set(0, f.rot, 0.35); _q.setFromEuler(_e); _v2.set(1, 0.72, 1.08); _m4.compose(_v.set(f.x, f.y + BOX.h * 0.36, f.z), _q, _v2); im.setMatrixAt(ii, _m4); instSrc.box[f.sku][ii] = { kind: 'floor', idx: i }; } } } else putBox(f.sku, f.x, f.y + BOX.h / 2, f.z, f.rot, { kind: 'floor', idx: i }); } else putParcel(f.x, f.y + 0.23, f.z, f.rot, { kind: 'floor', idx: i }); });
    var cw = toolWorld('cart'); S.cart.boxes.forEach(function (sku, i) { var c = Math.cos(cw.ry), s = Math.sin(cw.ry), lx = (i % 3 - 1) * 0.42, ly = i < 3 ? 0.3 : 0.82; putBox(sku, cw.x + lx * c, ly + BOX.h / 2, cw.z - lx * s, cw.ry, { kind: 'cart', idx: i }); });
    S.trucks.forEach(function (t) { if (t.dir !== 'out') return; t.parcels.forEach(function (oid, i) { var pp = truckParcelPos(t, i); putParcel(pp.x, pp.y + 0.23, pp.z, 0, { kind: 'truck' }); }); });
    S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') putBox(st.carry.sku, st.x + Math.sin(st.yaw) * 0.45, 1.05, st.z + Math.cos(st.yaw) * 0.45, st.yaw, { kind: 'carried' }); if (st.carry && st.carry.kind === 'parcel') putParcel(st.x + Math.sin(st.yaw) * 0.45, 1.05, st.z + Math.cos(st.yaw) * 0.45, st.yaw, { kind: 'carried' }); });
    SKUS.forEach(function (s) { var im = boxInst[s.id]; im.count = Math.min(counts[s.id], 1400); im.instanceMatrix.needsUpdate = true; });
    palletInst.count = Math.min(counts.pallet, 400); palletInst.instanceMatrix.needsUpdate = true;
    parcelInst.count = Math.min(counts.parcel, 400); parcelInst.instanceMatrix.needsUpdate = true;
  }
  function instSource(hit) { var o = hit.object; if (o.userData.sku) return instSrc.box[o.userData.sku][hit.instanceId]; if (o.userData.pallet) return instSrc.pallet[hit.instanceId]; if (o.userData.parcel) return instSrc.parcel[hit.instanceId]; return null; }

  // ── The hand ──────────────────────────────────────────────────────
  var handGroup = new THREE.Group(); handGroup.userData.dynamic = true; camera.add(handGroup); scene.add(camera);   // never baked: it rides on the camera
  var handBox = new THREE.Mesh(BOX_GEO, CARD.paint); handBox.position.set(0.38, -0.36, -0.72); handBox.rotation.set(0.15, -0.35, 0.05); handBox.visible = false; handGroup.add(handBox);
  var handParcel = new THREE.Mesh(PARCEL_GEO, MAT.parcel); handParcel.position.set(0.38, -0.36, -0.74); handParcel.rotation.set(0.15, -0.35, 0.05); handParcel.visible = false; handGroup.add(handParcel);
  var handPlug = new THREE.Group(); handPlug.position.set(0.34, -0.3, -0.6); handPlug.rotation.set(0.2, -0.3, 0); handPlug.visible = false; handGroup.add(handPlug);
  box(0.06, 0.06, 0.14, MAT.black, 0, 0, 0, handPlug); box(0.08, 0.08, 0.04, MAT.red, 0, 0, 0.09, handPlug); cyl(0.012, 0.3, MAT.black, 0, -0.1, -0.1, handPlug, 6).rotation.x = 0.8;
  function updateHandMesh() { var h = S.hand; handBox.visible = !!(h && h.kind === 'box'); handParcel.visible = !!(h && h.kind === 'parcel'); if (h && h.kind === 'box') handBox.material = CARD[h.sku] || CARD.paint; }
  function handSet(h) { S.hand = h; hudDirty = true; updateHandMesh(); }
  function handLabel() { var h = S.hand; if (!h) return null; if (h.kind === 'box') return { t: (h.damaged ? 'A damaged box of ' : 'A box of ') + skuName(h.sku), s: h.damaged ? 'bin it by the bench' : 'G puts it down' }; var o = orderById(h.order); return { t: 'Parcel #' + (o ? o.num : '?'), s: o ? 'for ' + clientName(o.client) + ' · G puts it down' : '' }; }

  // ── Rack slots ────────────────────────────────────────────────────
  function slotGet(key) { return S.slots[key] || null; }
  function slotSpace(key, sku) { var s = S.slots[key]; if (!s || !s.n) return ECON.slotCap; if (s.sku !== sku) return 0; return ECON.slotCap - s.n; }
  function slotAdd(key, sku, n) { var s = S.slots[key]; if (!s || !s.n) S.slots[key] = { sku: sku, n: n }; else s.n += n; }
  function slotTake(key, n) { var s = S.slots[key]; if (!s) return 0; var k = Math.min(n, s.n); s.n -= k; if (s.n <= 0) delete S.slots[key]; return k; }
  function slotOwned(key) { return slotParse(key).r < S.up.rows; }
  function stockCount(sku) { var n = 0; for (var k in S.slots) if (S.slots[k].sku === sku) n += S.slots[k].n; return n; }
  function totalStock() { var n = 0; for (var k in S.slots) n += S.slots[k].n; return n; }
  function stockSummary() { var m = {}; for (var k in S.slots) { var s = S.slots[k]; if (!s.n) continue; m[s.sku] = (m[s.sku] || 0) + s.n; } return m; }
  function slotsWith(sku) { var out = []; for (var k in S.slots) if (S.slots[k].sku === sku && S.slots[k].n > 0) out.push(k); out.sort(function (a, b) { return slotParse(a).l - slotParse(b).l; }); return out; }
  // the best slot for n boxes of a sku: a slot that already holds that sku and has the room, else an empty one; low levels first
  function findSlotFor(sku, n, maxLevel) {
    var best = null, bestScore = -1;
    for (var r = 0; r < S.up.rows; r++) for (var b = 0; b < RACK.bays; b++) for (var l = 0; l <= maxLevel; l++) {
      var key = slotKey(r, b, l), s = S.slots[key], space = slotSpace(key, sku); if (space < n) continue;
      var score = (s && s.n ? 100 : 50) - l * 10 - b;
      if (score > bestScore) { bestScore = score; best = key; }
    }
    return best;
  }
  function slotPrompt(key) {
    var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
    if (p.l === RACK.top && !driving) return has ? skuName(s.sku) + ' × ' + s.n + ' · top level: forklift only' : 'Top level: forklift only';
    if (tool === 'cart') { if (has && S.cart.boxes.length < ECON.cartCap) return 'Pick a box of ' + skuName(s.sku) + ' onto the cart (' + s.n + ' here)'; return has ? 'Cart is full' : null; }
    if (tool === 'jack') { var jp = jackPallet(); if (jp) return p.l === 0 ? (slotSpace(key, jp.sku) >= jp.n ? 'Set the pallet into the rack' : (has ? 'Slot holds ' + skuName(s.sku) + ': no room' : null)) : 'The jack only reaches the floor level'; return has && p.l === 0 ? 'Pull the pallet out (' + Math.min(s.n, ECON.palletCap) + ' boxes)' : null; }
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'A damaged box does not go on the rack: bin it';
    if (S.hand && S.hand.kind === 'box') return slotSpace(key, S.hand.sku) > 0 ? 'Put the box on the rack' + (has ? ' (' + s.n + ' here)' : '') : 'Slot holds ' + skuName(s.sku) + ': no room';
    if (S.hand) return null;
    return has ? 'Take a box of ' + skuName(s.sku) + ' (' + s.n + ' here)' : 'Empty slot · ' + slotName(key);
  }
  function slotUse(key) {
    var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
    if (p.l === RACK.top && !driving) { toast('Too high. Use the forklift.', 'bad'); return; }
    if (tool === 'cart') { if (has && S.cart.boxes.length < ECON.cartCap) { S.cart.boxes.push(s.sku); slotTake(key, 1); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); } return; }
    if (tool === 'jack') {
      var jp = jackPallet();
      if (jp) { if (p.l !== 0) { toast('The jack only reaches the floor level.', 'bad'); return; } if (storePallet(jp, key)) { S.jack.pallet = null; sfx('crate'); addXp(XP.pallet); toast('Pallet stored · ' + slotName(key), 'good'); introStep('putaway'); } else toast('No room in that slot.', 'bad'); return; }
      if (has && p.l === 0) { var np = pullPallet(key); if (np) { np.place = 'jack'; S.jack.pallet = np.id; sfx('jack'); } }
      return;
    }
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. The bin is by the bench.', 'bad'); return; }
    if (S.hand && S.hand.kind === 'box') { if (slotSpace(key, S.hand.sku) > 0) { slotAdd(key, S.hand.sku, 1); handSet(null); sfx('putdown'); S.stats.putaway++; addXp(XP.box); introStep('putaway'); } else toast('No room: that slot holds ' + skuName(s.sku) + '.', 'bad'); return; }
    if (S.hand) return;
    if (has) { slotTake(key, 1); handSet({ kind: 'box', sku: s.sku }); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); }
  }

  // ── Pallets ───────────────────────────────────────────────────────
  function palletById(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) return S.pallets[i]; return null; }
  function newPallet(sku, n, props) { var p = { id: uid('pl'), sku: sku, n: n, place: 'floor', x: 0, y: 0, z: 0, rot: 0 }; for (var k in props) p[k] = props[k]; S.pallets.push(p); return p; }
  function removePallet(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) { S.pallets.splice(i, 1); return; } }
  function storePallet(p, key) { if (!slotOwned(key) || slotSpace(key, p.sku) < p.n) return false; slotAdd(key, p.sku, p.n); S.stats.putaway += p.n; removePallet(p.id); return true; }
  function pullPallet(key) { var s = S.slots[key]; if (!s || !s.n) return null; var sku = s.sku, n = Math.min(s.n, ECON.palletCap); slotTake(key, n); return newPallet(sku, n, { place: 'floor' }); }
  function jackPallet() { return S.jack.pallet ? palletById(S.jack.pallet) : null; }
  function forkPallet() { return S.fork.pallet ? palletById(S.fork.pallet) : null; }
  function palletPrompt(src) {
    var p = palletById(src.id); if (!p || src.carried) return null;
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t || t.state !== 'docked') return null; if (!t.signed) return 'Sign the delivery note with ' + t.driver + ' first'; }
    if (player.tool === 'jack') return jackPallet() ? null : 'Lift the pallet with the jack (' + p.n + ' × ' + skuName(p.sku) + ')';
    if (player.tool === 'cart') return S.cart.boxes.length < ECON.cartCap ? 'Take a box of ' + skuName(p.sku) + ' onto the cart (' + p.n + ' left)' : 'Cart is full';
    if (S.hand && S.hand.kind === 'box' && S.hand.sku === p.sku && p.n < 12) return 'Put the box back on the pallet';
    if (S.hand) return null;
    return 'Take a box of ' + skuName(p.sku) + ' off the pallet (' + p.n + ' left)';
  }
  function palletUse(src) {
    var p = palletById(src.id); if (!p || src.carried) return;
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t || t.state !== 'docked') return; if (!t.signed) { toast('Sign the delivery note with the driver first. He is by the dock outside.', 'bad'); return; } }
    if (player.tool === 'jack') { if (!jackPallet()) { if (p.place === 'truck') { onPalletLeftTruck(p); } p.place = 'jack'; S.jack.pallet = p.id; sfx('jack'); introStep('unload'); } return; }
    var take = function () { if (p.place === 'truck') onPalletLeftTruck(p); p.n--; S.stats.picked++; addXp(XP.box); if (p.n <= 0) removePallet(p.id); introStep('unload'); };
    if (player.tool === 'cart') { if (S.cart.boxes.length < ECON.cartCap) { S.cart.boxes.push(p.sku); take(); sfx('pickup'); } return; }
    if (S.hand && S.hand.kind === 'box' && S.hand.sku === p.sku && p.n < 12) { p.n++; handSet(null); sfx('putdown'); return; }
    if (S.hand) return;
    handSet({ kind: 'box', sku: p.sku }); take(); sfx('pickup');
  }

  // ── The floor ─────────────────────────────────────────────────────
  function dropAhead(item) {
    var fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    var x = player.x - fx * 0.9, z = player.z - fz * 0.9;
    if (!insideHall(x, z) && floorY(x, z) < -0.5) { x = player.x; z = player.z; }
    item.x = x; item.z = z; item.y = floorY(x, z); item.rot = player.yaw; S.floor.push(item);
  }
  function floorPrompt(src) { var f = S.floor[src.idx]; if (!f) return null; if (f.kind === 'box') { if (player.tool === 'cart') return S.cart.boxes.length < ECON.cartCap && !f.damaged ? 'Put the box on the cart' : null; return S.hand || player.tool ? null : (f.damaged ? 'Pick up the damaged box (it goes in the bin)' : 'Pick up the box of ' + skuName(f.sku)); } var o = orderById(f.order); return S.hand || player.tool ? null : 'Pick up parcel #' + (o ? o.num : '?'); }
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
  function truckAtDoor(i) { var dir = i < 2 ? 'in' : 'out', dock = i % 2; for (var k = 0; k < S.trucks.length; k++) { var t = S.trucks[k]; if (t.dir === dir && t.dock === dock && t.state === 'docked') return t; } return null; }
  function truckPalletPos(t, i) { var r = Math.floor(i / 2), c = i % 2; return { x: t.x + t.side * (1.1 + r * 1.35), y: 0, z: t.z + (c ? 0.62 : -0.62), ry: 0 }; }
  function truckParcelPos(t, i) { var r = Math.floor(i / 6), c = i % 6, col = c % 3, layer = Math.floor(c / 3); return { x: t.x + t.side * (0.9 + r * 0.7), y: layer * 0.47, z: t.z + (col - 1) * 0.8 }; }
  function trailerBounds(t) { var a = t.x, b = t.x + t.side * TRAILER.len; return { x0: Math.min(a, b), x1: Math.max(a, b), z0: t.z - TRAILER.w / 2, z1: t.z + TRAILER.w / 2 }; }
  function tierFor(level) { return level >= 7 ? 4 : level >= 4 ? 3 : level >= 2 ? 2 : 1; }
  function nowAbs() { return S.day * 24 + S.time; }

  function truckWheel(g, x, y, z, r, w) { var ty = cyl(r, w, MAT.rubber, x, y, z, g, 20); ty.rotation.x = Math.PI / 2; for (var k = 0; k < 3; k++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.04, 0.012, 6, 24), MAT.black); ring.position.set(x, y, z + (k - 1) * w * 0.3); g.add(ring); } cyl(r * 0.58, w + 0.02, MAT.chrome, x, y, z, g, 14).rotation.x = Math.PI / 2; cyl(r * 0.2, w + 0.06, MAT.steelDark, x, y, z, g, 10).rotation.x = Math.PI / 2; }
  function buildTruckMesh(t) {
    var g = new THREE.Group(), side = t.side, L = function (x) { return x * side; }, len = TRAILER.len, w = TRAILER.w, h = TRAILER.h;
    g.userData.dynamic = true;
    var paint = t.color === 'red' ? MAT.truckRed : t.color === 'blue' ? MAT.truckBlue : MAT.green;
    // the trailer: floor, lined walls, ribbed outside, roof, rear frame with the doors folded back, chassis, wheels and guards
    box(len, 0.12, w, MAT.steelDark, L(len / 2), -0.06, 0, g); plane(len - 0.2, w - 0.2, MAT.wood, L(len / 2), 0.005, 0, -Math.PI / 2, 0, g);
    [-1, 1].forEach(function (s) { box(len, h, 0.06, MAT.trailer, L(len / 2), h / 2, s * (w / 2 + 0.03), g); var lin = plane(len - 0.1, h - 0.1, MAT.lining, L(len / 2), h / 2, s * (w / 2 - 0.005), 0, s > 0 ? Math.PI : 0, g); lin.receiveShadow = false; for (var rb = 1; rb < len; rb += 1.5) box(0.04, h - 0.2, 0.06, MAT.steelDark, L(rb), h / 2, s * (w / 2 + 0.06), g); });
    box(0.06, h, w + 0.12, MAT.trailer, L(len + 0.03), h / 2, 0, g); plane(w - 0.1, h - 0.1, MAT.lining, L(len - 0.005), h / 2, 0, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2, g);
    box(len, 0.06, w + 0.12, MAT.trailer, L(len / 2), h + 0.03, 0, g); plane(len - 0.1, w - 0.1, MAT.lining, L(len / 2), h - 0.005, 0, Math.PI / 2, 0, g);
    box(0.1, h + 0.1, 0.1, MAT.steelDark, L(0.05), h / 2, -(w / 2 + 0.05), g); box(0.1, h + 0.1, 0.1, MAT.steelDark, L(0.05), h / 2, w / 2 + 0.05, g); box(0.1, 0.1, w + 0.2, MAT.steelDark, L(0.05), h + 0.05, 0, g);
    [-1, 1].forEach(function (s) { var dr = box(0.05, h - 0.1, w / 2 - 0.05, MAT.trailer, L(0.9), h / 2, s * (w / 2 + 0.09 + (w / 2 - 0.05) / 2) * 0 + s * (w / 2 + 0.08), g); dr.rotation.y = 0; dr.position.set(L(0.4 + (w / 2 - 0.05) / 2), h / 2, s * (w / 2 + 0.09)); dr.rotation.y = Math.PI / 2; });   // the rear doors, swung open flat against the sides
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
    var cname = t.dir === 'in' ? clientName(t.client) : 'DEPOT CO. FREIGHT';
    if (!clientSignTex[cname]) clientSignTex[cname] = textTex([cname], { w: 1024, h: 160, bg: '#e6e8ea', fg: t.dir === 'in' ? '#2c5f9e' : '#1b232c', size: 80 });
    var sm = new THREE.MeshBasicMaterial({ map: clientSignTex[cname] });
    [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.25), sm); p.position.set(L(len / 2), 1.7, s * (w / 2 + 0.07)); p.rotation.y = s > 0 ? 0 : Math.PI; g.add(p); });
    [-1, 1].forEach(function (s) { sign([t.driver.toUpperCase() + ' HAULAGE'], 1.4, 0.3, L(len + 1.5), 0.4, s * 1.22, s > 0 ? 0 : Math.PI, { w: 512, h: 96, bg: '#1b232c', fg: '#eef1f5' }, g); });
    // the loading zone inside an outbound trailer
    if (t.dir === 'out') hitBox(3.0, 2.4, w - 0.2, L(1.8), 1.25, 0, { prompt: function () { return loadPrompt(t.id); }, use: function () { loadUse(t.id); } }, g);
    // the driver: climbs out when docked, walks to the dock with the paperwork, and waits there
    var drv = makeHuman({ cap: true, capMat: paint, vest: Math.random() < 0.5 ? MAT.hivis : null }); drv.position.set(L(len + 1.4), YARD_Y, -2.1); drv.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; drv.visible = false; g.add(drv);
    box(0.22, 0.3, 0.02, MAT.wood, 0.16, 1.05, 0.2, drv); box(0.2, 0.26, 0.01, MAT.paper, 0.16, 1.05, 0.215, drv);
    hitBox(0.7, 1.9, 0.7, 0, 0.95, 0, { prompt: function () { return driverPrompt(t.id); }, use: function () { driverUse(t.id); } }, drv);
    g.position.set(t.x, 0, t.z); scene.add(g);
    var route = [[L(len + 1.4), YARD_Y, 2.1], [L(2.4), YARD_Y, 4.6], [L(0.9), YARD_Y, 6.1], [L(0.9), 0, 4.4], [L(0.9), 0, 3.0], [L(-0.2), 0, 1.55], [L(-2.0), 0, 2.0], [L(-2.6), 0, 3.4]];
    truckMeshes[t.id] = { g: g, driver: drv, drvD: 0, route: route };
    shadowDirty = true;
  }
  function removeTruckMesh(id) { var m = truckMeshes[id]; if (!m) return; scene.remove(m.g); m.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); }); delete truckMeshes[id]; shadowDirty = true; }

  // what an inbound truck brings: lines the clients send, weighted toward what the open orders need and what is low
  function inboundLoad(t) {
    var tier = tierFor(S.level), cands = SKUS.filter(function (s) { return s.tier <= tier && !s.own; });
    var need = {}; S.orders.forEach(function (o) { if (o.state !== 'open') return; o.lines.forEach(function (l) { need[l.sku] = (need[l.sku] || 0) + l.qty; }); });
    var count = clamp(2 + Math.floor(S.level / 2) + (S.up.dock2 ? 1 : 0) + randi(-1, 1), 2, 8);
    var client = CLIENTS.filter(function (c) { return c.likes.some(function (s) { return SKU[s].tier <= tier; }); });
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
    var t = { id: uid('tr'), num: S.truckSeq++, dir: dir, dock: dock, side: side, z: z, x: side * 80, state: 'coming', arrived: 0, leave: leaveH, day: S.day, pallets: [], parcels: [], driver: pick(DRIVER_NAMES), color: pick(['red', 'blue', 'green']), unloaded: 0, doneAt: 0 };
    if (dir === 'in') inboundLoad(t);
    S.trucks.push(t); buildTruckMesh(t); sfx('truck');
    logEvent((dir === 'in' ? 'Inbound truck coming to ' : 'Outbound truck coming to ') + dockLabel(dir === 'in' ? dock : 2 + dock));
    return t;
  }
  function tickTrucks(dt) {
    // the schedule
    var inDocks = isSunday() ? [] : (S.up.dock2 ? [0, 1] : [0]);
    TRUCK_IN.forEach(function (h, k) { inDocks.forEach(function (dock) { var f = 'in' + S.day + '-' + k + '-' + dock; if (!S.flags[f] && S.time >= h - 0.25 && S.time < h + 1.5) { S.flags[f] = 1; if (!truckAtDoor(dock) && !S.trucks.some(function (t) { return t.dir === 'in' && t.dock === dock && t.state !== 'leaving'; })) spawnTruck('in', dock, h + TRUCK_WAIT); } }); });
    TRUCK_OUT.forEach(function (w, k) { var f = 'out' + S.day + '-' + k; if (isSunday()) return; if (!S.flags[f] && S.time >= w.arrive - 0.25 && S.time < w.leave - 0.3) { S.flags[f] = 1; if (!S.trucks.some(function (t) { return t.dir === 'out' && t.dock === k && t.state !== 'leaving'; })) spawnTruck('out', k, w.leave); } });
    // movement and waiting
    for (var i = S.trucks.length - 1; i >= 0; i--) {
      var t = S.trucks[i], m = truckMeshes[t.id]; if (!m) { buildTruckMesh(t); m = truckMeshes[t.id]; }
      if (t.state === 'coming') {
        var dx = truckDockX(t.side), dirn = dx > t.x ? 1 : -1; t.x += dirn * 7 * dt;
        if ((dirn > 0 && t.x >= dx) || (dirn < 0 && t.x <= dx)) { t.x = dx; t.state = 'docked'; t.arrived = S.time; sfx('airbrake'); if (t.dir === 'in') { toast('Truck at ' + dockLabel(t.dock) + ': ' + t.pallets.length + ' pallets from ' + clientName(t.client), 'rare'); logEvent(t.driver + ' docked at ' + dockLabel(t.dock) + ' with ' + t.pallets.length + ' pallets'); introStep('truck'); } else { toast('Outbound truck at ' + dockLabel(2 + t.dock) + ' · leaves ' + fmtTime(t.leave), 'rare'); logEvent('Outbound truck at ' + dockLabel(2 + t.dock) + ', leaves at ' + fmtTime(t.leave)); } rebuildBoardSoon(); }
      } else if (t.state === 'docked') {
        if (t.dir === 'in') {
          var left = S.pallets.some(function (p) { return p.place === 'truck' && p.truck === t.id; });
          if (!left) { if (!t.doneAt) t.doneAt = S.time; if (S.time >= t.doneAt + 0.25) truckLeave(t, 'done'); }
          else if (S.time >= t.leave) truckLeave(t, 'timeout');
        } else if (S.time >= t.leave) truckLeave(t, 'schedule');
      } else if (t.state === 'leaving') {
        t.x += t.side * 8 * dt;
        if (Math.abs(t.x) > 85) { removeTruckMesh(t.id); S.trucks.splice(i, 1); continue; }
      }
      m.g.position.x = t.x;
      if (m.driver) {
        var docked = t.state === 'docked', want = docked ? 1 : 0;
        m.driver.visible = docked; if (!docked) m.drvD = 0;
        // walk the route by distance; segment 4 (the landing) to 5 (the door) only once the dock door is open
        var R = m.route, doorOpen = doorPassable((t.dir === 'in' ? 0 : 2) + t.dock), segLen = function (k) { var a = R[k], b = R[k + 1]; return Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]) + (b[2] - a[2]) * (b[2] - a[2])); };
        var total = 0, landing = 0; for (var sk = 0; sk < R.length - 1; sk++) { if (sk === 4) landing = total; total += segLen(sk); }
        var cap = doorOpen ? total : landing; if (docked && m.drvD < cap) m.drvD = Math.min(cap, m.drvD + dt * 1.3);
        var rem = m.drvD, si = 0; while (si < R.length - 2 && rem > segLen(si)) { rem -= segLen(si); si++; } var A = R[si], B = R[si + 1], sl = segLen(si), fr = sl > 0 ? Math.min(1, rem / sl) : 1;
        m.driver.position.set(lerp(A[0], B[0], fr), lerp(A[1], B[1], fr), lerp(A[2], B[2], fr)); m.driver.userData.baseY = lerp(A[1], B[1], fr);
        var moving = docked && m.drvD < cap; if (moving) m.driver.rotation.y = Math.atan2(B[0] - A[0], B[2] - A[2]); else m.driver.rotation.y = t.side < 0 ? Math.PI / 2 : -Math.PI / 2;
        if (docked && !moving && !doorOpen && m.drvD < total - 0.01 && Math.random() < dt / 20) say(m.driver, pick(['Door is shut, mate.', 'Can someone open this door?', 'Standing out here like a lemon.', 'Any chance of the door?']), '#f5b53d');
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
      var left = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id; });
      if (left.length) { left.forEach(function (p) { removePallet(p.id); }); addRep(-2 * left.length); S.stats.lost += left.length; logEvent(left.length + ' pallet' + (left.length > 1 ? 's' : '') + ' went back on the truck unreceived', 'bad'); toast('Refused delivery: ' + left.length + ' pallet' + (left.length > 1 ? 's' : '') + ' went back', 'bad'); }
      else { logEvent(t.driver + ' left ' + dockLabel(t.dock) + ' empty', 'good'); }
    } else {
      if (t.parcels.length) { var n = t.parcels.length, sum = 0; t.parcels.forEach(function (oid) { var o = orderById(oid); if (o) sum += shipOrder(o); }); toast('Truck out with ' + n + ' parcel' + (n > 1 ? 's' : '') + ' · ' + money(sum), 'good'); logEvent('Outbound truck left ' + dockLabel(2 + t.dock) + ' with ' + n + ' parcels, ' + money(sum) + ' paid', 'good'); if (why === 'dispatched') addXp(XP.truck); }
      else logEvent('Outbound truck left ' + dockLabel(2 + t.dock) + ' empty');
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
    return 'Outbound trailer · ' + t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded · leaves ' + fmtTime(t.leave);
  }
  function loadUse(tid) {
    var t = truckById(tid); if (!t || t.state !== 'docked') return;
    if (!(S.hand && S.hand.kind === 'parcel')) return;
    var o = orderById(S.hand.order); if (!o) { handSet(null); return; }
    t.parcels.push(o.id); o.state = 'loaded'; handSet(null); sfx('crate'); addXp(XP.ship); introStep('load'); rebuildBoardSoon();
    feedPush('Parcel #' + o.num + ' loaded for ' + clientName(o.client), 'good');
  }
  function consolePrompt(i) {
    var t = truckAtDoor(i);
    if (!t) { var k = i - 2, nxt = TRUCK_OUT[k]; return 'Dock ' + dockLabel(i) + ' · no truck · next at ' + fmtTime(nxt.arrive); }
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
  function dueText(abs) { var day = Math.floor(abs / 24), t = abs % 24; return fmtTime(t) + (day > S.day ? ' tomorrow' : day < S.day ? ' (overdue)' : ''); }
  function nextOutLeave(minAbs) {
    for (var d = 0; d < 3; d++) for (var k = 0; k < TRUCK_OUT.length; k++) { var abs = (S.day + d) * 24 + TRUCK_OUT[k].leave; if (abs >= minAbs) return abs; }
    return minAbs + 24;
  }
  function genOrder(rush) {
    var avail = unlockedSkus().filter(function (s) { return S.seenSkus.indexOf(s) >= 0; }); if (!avail.length) avail = unlockedSkus();
    var inStock = avail.filter(function (s) { return stockCount(s) > 0; });
    var client = S.contract && S.contract.accepted && Math.random() < 0.5 ? CLIENTS.filter(function (c) { return c.id === S.contract.client; })[0] : pick(CLIENTS), pool = client.likes.filter(function (s) { return avail.indexOf(s) >= 0; }); if (!pool.length) { pool = avail; }
    var nLines = randi(1, Math.min(3, 1 + Math.floor(S.level / 2) + (Math.random() < 0.35 ? 1 : 0)));
    var lines = [], used = {};
    for (var i = 0; i < nLines; i++) {
      // what the client likes and you stock, else anything you stock, else (rarely, and never for the first line) what the client likes
      var likedStocked = pool.filter(function (s) { return inStock.indexOf(s) >= 0 && !used[s]; }), anyStocked = inStock.filter(function (s) { return !used[s]; }), liked = pool.filter(function (s) { return !used[s]; });
      var from = likedStocked.length ? likedStocked : anyStocked.length && (i === 0 || Math.random() < 0.85) ? anyStocked : liked;
      if (!from.length) break;
      var sku = pick(from); used[sku] = 1;
      lines.push({ sku: sku, qty: clamp(randi(1, 2 + Math.floor(S.level / 2)), 1, 6) });
    }
    if (!lines.length) return null;
    var value = 0; lines.forEach(function (l) { value += l.qty * SKU[l.sku].val; });
    var due = rush ? nowAbs() + 2 : nextOutLeave(nowAbs() + 1.5);
    var o = { id: uid('or'), num: S.orderSeq++, client: client.id, lines: lines, created: nowAbs(), due: due, state: 'open', pay: Math.round(value * ECON.margin + ECON.handling) * (rush ? 2 : 1), rush: !!rush, late: false, short: false };
    S.orders.push(o);
    logEvent('Order #' + o.num + ' from ' + client.name + ': ' + lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + (rush ? ' · RUSH, due ' + fmtTime(due) : ''), 'rare');
    sfx('chime'); rebuildBoardSoon(); introStep('order'); hudDirty = true;
    return o;
  }
  // contracts: every few days a client offers a run; every order of theirs shipped on time in the window counts
  function offerContract() {
    var client = pick(CLIENTS), need = 3 + Math.floor(S.level / 2), days = 3;
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
      if (S.day === 1 && !S.flags.firstOrder && S.time >= 8.5) { S.flags.firstOrder = 1; S.lastOrderAt = n; genOrder(false); }
      else if (openN < maxOpen && n - S.lastOrderAt >= gap) { S.lastOrderAt = n + randf(-0.3, 0.3); genOrder(Math.random() < 0.12 && S.level >= 3); }
    }
    for (var i = S.orders.length - 1; i >= 0; i--) {
      var o = S.orders[i];
      if ((o.state === 'open' || o.state === 'packing' || o.state === 'packed') && !o.late && n > o.due) { o.late = true; addRep(-2); logEvent('Order #' + o.num + ' is late', 'bad'); rebuildBoardSoon(); }
      if (o.state === 'open' && n > o.due + 30) { S.orders.splice(i, 1); addRep(-5); S.stats.late++; logEvent(clientName(o.client) + ' cancelled order #' + o.num, 'bad'); toast('Order #' + o.num + ' cancelled', 'bad'); rebuildBoardSoon(); }
    }
  }

  // ── The packing bench ─────────────────────────────────────────────
  function benchCount() { var n = 0; for (var k in S.bench.boxes) n += S.bench.boxes[k]; return n; }
  function benchAdd(sku, n) { S.bench.boxes[sku] = (S.bench.boxes[sku] || 0) + n; }
  function benchTake(sku, n) { var k = Math.min(n, S.bench.boxes[sku] || 0); S.bench.boxes[sku] -= k; if (S.bench.boxes[sku] <= 0) delete S.bench.boxes[sku]; return k; }
  function benchPrompt() {
    if (player.tool === 'cart') return S.cart.boxes.length ? 'Unload the cart onto the bench (' + S.cart.boxes.length + ' boxes)' : 'Packing bench';
    if (player.tool === 'jack') return null;
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'Damaged boxes do not ship: bin it';
    if (S.hand && S.hand.kind === 'box') return benchCount() < ECON.benchCap ? 'Put the box on the bench' : 'The bench is full';
    if (S.hand) return null;
    return 'Packing bench · ' + benchCount() + ' boxes · ' + openOrders().length + ' open orders';
  }
  function benchUse() {
    if (player.tool === 'cart') { var moved = 0; while (S.cart.boxes.length && benchCount() < ECON.benchCap) { benchAdd(S.cart.boxes.pop(), 1); moved++; } if (moved) { sfx('putdown'); introStep('bench'); } else if (S.cart.boxes.length) toast('The bench is full.', 'bad'); return; }
    if (player.tool === 'jack') return;
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. Bin it.', 'bad'); return; }
    if (S.hand && S.hand.kind === 'box') { if (benchCount() >= ECON.benchCap) { toast('The bench is full.', 'bad'); return; } benchAdd(S.hand.sku, 1); handSet(null); sfx('putdown'); introStep('bench'); return; }
    if (S.hand) return;
    openPanel('bench');
  }
  function orderNeed(o) { var tot = 0, have = 0; o.lines.forEach(function (l) { tot += l.qty; have += Math.min(l.qty, S.bench.boxes[l.sku] || 0); }); return { tot: tot, have: have }; }
  function canPack(o) { return o.state === 'open' && o.lines.every(function (l) { return (S.bench.boxes[l.sku] || 0) >= l.qty; }); }
  function canPackShort(o) { var n = orderNeed(o); return o.state === 'open' && n.have >= Math.ceil(n.tot / 2) && n.have < n.tot; }
  function shelfPrompt(src) { var o = orderById(src.order); if (S.hand || player.tool) return null; return 'Pick up parcel #' + (o ? o.num : '?') + (o ? ' for ' + clientName(o.client) : ''); }
  function shelfUse(src) { if (S.hand || player.tool) return; var k = S.bench.parcels.indexOf(src.order); if (k < 0) return; S.bench.parcels.splice(k, 1); handSet({ kind: 'parcel', order: src.order }); sfx('pickup'); }

  // ── Shipping ──────────────────────────────────────────────────────
  function shipOrder(o) {
    var late = nowAbs() > o.due, amount = Math.round(o.pay * (o.short ? ECON.shortCut : 1) * (late ? ECON.lateCut : 1));
    pay(amount, 'Order #' + o.num + ' shipped to ' + clientName(o.client) + (late ? ' (late)' : '') + (o.short ? ' (short)' : ''));
    if (!late && S.contract && S.contract.accepted && S.contract.client === o.client) { S.contract.done++; feedPush('Contract: ' + S.contract.done + ' of ' + S.contract.need, 'good'); }
    addRep(late ? -1 : o.rush ? 3 : 1.5); S.stats.shipped++; if (late) S.stats.late++; addXp(XP.ship);
    o.state = 'shipped'; o.shippedAt = nowAbs(); o.paid = amount;
    for (var i = 0; i < S.orders.length; i++) if (S.orders[i] === o) { S.orders.splice(i, 1); break; }
    S.shipped.unshift({ num: o.num, client: o.client, paid: amount, late: late, short: o.short, day: S.day }); if (S.shipped.length > 40) S.shipped.pop();
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
    return false;
  }
  // ── Tools you push: the jack and the cart ─────────────────────────
  var jackMesh = null, cartMesh = null, forkM = null, driving = false, forkSpeed = 0, forkLook = { yaw: 0, pitch: 0 };
  function toolWorld(tool) {
    if (player.tool === tool) return { x: player.x - Math.sin(player.yaw) * 1.15, z: player.z - Math.cos(player.yaw) * 1.15, ry: player.yaw + Math.PI };
    var t = S[tool]; return { x: t.x, z: t.z, ry: t.rot || 0 };
  }
  function buildTools() {
    // ── the pallet jack: forks either side of the origin (where the pallet sits), the pump body and the tiller behind (local -z)
    var j = new THREE.Group(); j.userData.dynamic = true; scene.add(j); jackMesh = j;
    var JO = std({ color: 0xe8701a, roughness: 0.45, metalness: 0.35 });
    [-0.3, 0.3].forEach(function (x) {
      box(0.16, 0.06, 1.1, JO, x, 0.095, 0.0, j); var tip = box(0.16, 0.06, 0.16, JO, x, 0.075, 0.62, j); tip.rotation.x = 0.35;
      cyl(0.035, 0.12, MAT.rubber, x, 0.04, 0.42, j, 10).rotation.z = Math.PI / 2; cyl(0.035, 0.12, MAT.rubber, x, 0.04, 0.12, j, 10).rotation.z = Math.PI / 2;
      box(0.16, 0.16, 0.08, JO, x, 0.16, -0.55, j);
    });
    box(0.5, 0.36, 0.3, JO, 0, 0.3, -0.66, j); box(0.54, 0.04, 0.34, MAT.steelDark, 0, 0.5, -0.66, j);
    cyl(0.055, 0.26, MAT.chrome, 0, 0.42, -0.6, j, 12); cyl(0.07, 0.1, MAT.steelDark, 0, 0.58, -0.6, j, 12);
    [-0.17, 0.17].forEach(function (x) { cyl(0.09, 0.07, MAT.rubber, x, 0.09, -0.76, j, 14).rotation.z = Math.PI / 2; cyl(0.05, 0.075, MAT.chrome, x, 0.09, -0.76, j, 10).rotation.z = Math.PI / 2; });
    var tiller = new THREE.Group(); tiller.position.set(0, 0.5, -0.78); tiller.rotation.x = -0.55; j.add(tiller);
    cyl(0.025, 1.0, MAT.steelDark, 0, 0.5, 0, tiller, 10); box(0.44, 0.06, 0.07, MAT.rubber, 0, 1.0, 0, tiller); box(0.05, 0.05, 0.05, MAT.rubber, -0.2, 1.0, 0, tiller); box(0.05, 0.05, 0.05, MAT.rubber, 0.2, 1.0, 0, tiller);
    box(0.08, 0.03, 0.1, MAT.red, 0, 0.95, 0.06, tiller); cyl(0.04, 0.08, MAT.steelDark, 0, 0.0, 0, tiller, 10);
    sign(['2500 kg'], 0.3, 0.1, 0, 0.3, -0.5, 0, { w: 256, h: 80, bg: '#1b232c', fg: '#f5b53d' }, j);
    groundBlob(1.3, 2.4, 0, -0.2, j, 0);
    hitBox(1.0, 1.3, 1.9, 0, 0.6, -0.25, { prompt: function () { return toolPrompt('jack'); }, use: function () { grabTool('jack'); } }, j);
    // ── the picking cart: a tubular frame, two mesh shelves, a push loop, four casters and a clipboard
    var c = new THREE.Group(); c.userData.dynamic = true; scene.add(c); cartMesh = c;
    [[-0.62, -0.3], [0.62, -0.3], [-0.62, 0.3], [0.62, 0.3]].forEach(function (o) { cyl(0.018, 0.96, MAT.chrome, o[0], 0.56, o[1], c, 8); box(0.05, 0.08, 0.05, MAT.steelDark, o[0], 0.1, o[1], c); var cw = cyl(0.045, 0.03, MAT.rubber, o[0], 0.045, o[1] + 0.03, c, 12); cw.rotation.z = Math.PI / 2; });
    [0.3, 0.82].forEach(function (y) { box(1.3, 0.025, 0.66, MAT.steelDark, 0, y - 0.012, 0, c); var m = plane(1.26, 0.62, MAT.mesh, 0, y + 0.002, 0, -Math.PI / 2, 0, c); m.receiveShadow = false; box(1.3, 0.05, 0.02, MAT.chrome, 0, y + 0.02, 0.32, c); box(1.3, 0.05, 0.02, MAT.chrome, 0, y + 0.02, -0.32, c); });
    cyl(0.018, 0.35, MAT.chrome, -0.62, 1.2, -0.3, c, 8); cyl(0.018, 0.35, MAT.chrome, 0.62, 1.2, -0.3, c, 8); cyl(0.02, 1.3, MAT.rubber, 0, 1.38, -0.3, c, 8).rotation.z = Math.PI / 2;
    box(0.22, 0.3, 0.02, MAT.plastic, 0.45, 1.1, -0.29, c); box(0.2, 0.26, 0.01, MAT.paper, 0.45, 1.1, -0.275, c);
    groundBlob(1.7, 1.1, 0, 0, c, 0);
    hitBox(1.4, 1.4, 0.8, 0, 0.7, 0, { prompt: function () { return toolPrompt('cart'); }, use: function () { grabTool('cart'); } }, c);
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
    rb(0.96, 0.52, 0.96, 0.04, FS, 0, 0.96, -0.35); rb(0.98, 0.04, 0.98, 0.01, MAT.plastic, 0, 1.22, -0.35); box(1.12, 0.03, 0.6, MAT.chequer, 0, 0.76, 0.3);
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
    var cl = plane(0.3, 0.1, new THREE.MeshBasicMaterial({ map: textTex(['24V ▮▮▮▮▮▮▯▯   0.0 km/h', '⏱ 0412.6 h   ⚠ ✓'], { w: 512, h: 160, bg: '#0d1216', fg: '#5fd38d', size: 30 }) }), 0, 1.27, 0.3, -1.2, 0); cl.userData.noBake = true;
    cyl(0.018, 0.02, MAT.chrome, -0.2, 1.24, 0.29, f, 10).rotation.x = -1.2; box(0.012, 0.03, 0.004, MAT.black, -0.2, 1.255, 0.285, f); cyl(0.022, 0.012, MAT.red, 0.2, 1.24, 0.29, f, 12).rotation.x = -1.2; box(0.03, 0.02, 0.01, FD, -0.12, 1.22, 0.3, f); box(0.03, 0.02, 0.01, MAT.green, -0.12, 1.2, 0.3, f);
    sign(['HORN'], 0.06, 0.016, 0.2, 1.21, 0.31, 0, { w: 128, h: 32, bg: '#1b232c', fg: '#eef1f5' }, f);
    // the floor: pedals and the parking brake
    box(0.12, 0.012, 0.08, MAT.rubber, 0.12, 0.78, 0.3, f).rotation.x = -0.35; box(0.12, 0.012, 0.08, MAT.rubber, -0.08, 0.78, 0.3, f).rotation.x = -0.35; var pb = cyl(0.01, 0.22, FD, -0.3, 0.88, 0.1, f, 6); pb.rotation.x = -0.5; box(0.05, 0.03, 0.06, MAT.red, -0.3, 0.98, 0.15, f);
    var guardPts = [[-0.52, 0.9, 0.5], [-0.52, 2.2, 0.5], [-0.52, 2.4, 0.3], [-0.52, 2.4, -0.85], [-0.52, 2.2, -1.05], [-0.52, 0.9, -1.05]];
    [-1, 1].forEach(function (s) { var pts = guardPts.map(function (p) { return new THREE.Vector3(p[0] * s, p[1], p[2]); }); var tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 40, 0.035, 8, false), FD); tube.castShadow = true; f.add(tube); });
    for (var cb = -0.95; cb <= 0.4; cb += 0.27) cyl(0.025, 1.04, FD, 0, 2.4, cb, f, 8).rotation.z = Math.PI / 2; box(0.22, 0.03, 0.22, FD, 0, 2.43, -0.3);
    cyl(0.07, 0.14, glowMat(0xffa000, 0.6), 0, 2.53, -0.3, f, 12); var beaconLens = box(0.03, 0.12, 0.14, glowMat(0xffd060, 2.5), 0.06, 2.53, -0.3);
    var iShape = new THREE.Shape(); iShape.moveTo(-0.05, -0.08); iShape.lineTo(0.05, -0.08); iShape.lineTo(0.05, -0.05); iShape.lineTo(0.015, -0.05); iShape.lineTo(0.015, 0.05); iShape.lineTo(0.05, 0.05); iShape.lineTo(0.05, 0.08); iShape.lineTo(-0.05, 0.08); iShape.lineTo(-0.05, 0.05); iShape.lineTo(-0.015, 0.05); iShape.lineTo(-0.015, -0.05); iShape.lineTo(-0.05, -0.05); iShape.closePath();
    var iGeo = new THREE.ExtrudeGeometry(iShape, { depth: 2.7, bevelEnabled: false }); iGeo.rotateX(-Math.PI / 2);
    [-0.5, 0.5].forEach(function (x) { var ch = new THREE.Mesh(iGeo, FS); ch.position.set(x, 0.1, 0.62); ch.castShadow = true; f.add(ch); box(0.08, 2.45, 0.1, MAT.chrome, x * 0.84, 1.5, 0.63); });
    box(1.1, 0.08, 0.16, FS, 0, 2.78, 0.62); box(1.1, 0.08, 0.16, FS, 0, 0.14, 0.62); cyl(0.05, 2.3, MAT.chrome, 0, 1.3, 0.56, f, 10);
    var chainTex = tex(16, 64, function (c, w, h) { c.fillStyle = '#2a2a2a'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a8a8a'; for (var y = 0; y < h; y += 8) c.fillRect(3, y + 1, 10, 5); }, 1, 20); var chainMat = std({ map: chainTex, roughness: 0.5, metalness: 0.7 });
    [-0.2, 0.2].forEach(function (x) { var cm = box(0.04, 2.4, 0.015, chainMat, x, 1.45, 0.7); cm.userData.noBake = true; });
    var hosePts = [new THREE.Vector3(0.3, 0.9, 0.4), new THREE.Vector3(0.5, 1.4, 0.5), new THREE.Vector3(0.52, 2.0, 0.62), new THREE.Vector3(0.35, 2.3, 0.7)]; var hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 20, 0.018, 6, false), MAT.rubber); f.add(hose); var hose2 = hose.clone(); hose2.scale.x = -1; f.add(hose2);
    var car = new THREE.Group(); f.add(car);
    rb(0.95, 0.5, 0.06, 0.02, FS, 0, 0.3, 0.72, car); for (var lb = -0.4; lb <= 0.4; lb += 0.2) cyl(0.015, 0.9, FS, lb, 0.95, 0.72, car, 6); box(0.95, 0.03, 0.03, FS, 0, 1.4, 0.72, car); box(0.95, 0.03, 0.03, FS, 0, 1.0, 0.72, car); box(0.95, 0.04, 0.04, MAT.hazard, 0, 1.42, 0.72, car);
    [-0.3, 0.3].forEach(function (x) { rb(0.12, 0.05, 1.15, 0.01, FS, x, 0.03, 1.33, car); rb(0.12, 0.42, 0.05, 0.01, FS, x, 0.26, 0.77, car); var ft = box(0.12, 0.05, 0.1, FS, x, 0.02, 1.92, car); ft.rotation.x = 0.3; });
    tyre(0.34, 0.26, -0.58, 0.34, 0.45); tyre(0.34, 0.26, 0.58, 0.34, 0.45); tyre(0.27, 0.2, -0.47, 0.27, -1.0); tyre(0.27, 0.2, 0.47, 0.27, -1.0);
    rb(0.5, 0.24, 0.1, 0.03, FD, -0.56, 0.72, 0.45); rb(0.5, 0.24, 0.1, 0.03, FD, 0.56, 0.72, 0.45); rb(0.4, 0.2, 0.1, 0.03, FD, -0.5, 0.6, -1.0); rb(0.4, 0.2, 0.1, 0.03, FD, 0.5, 0.6, -1.0);
    box(0.14, 0.1, 0.06, MAT.lamp, -0.45, 1.0, 0.72); box(0.14, 0.1, 0.06, MAT.lamp, 0.45, 1.0, 0.72); box(0.12, 0.08, 0.05, glowMat(0xff2a1a, 0.8), -0.4, 0.75, -1.5); box(0.12, 0.08, 0.05, glowMat(0xff2a1a, 0.8), 0.4, 0.75, -1.5);
    sign(['DC-01'], 0.3, 0.09, 0, 0.55, -1.51, Math.PI, { w: 256, h: 80, bg: '#f5f1e6', fg: '#1b232c' }, f); sign(['DEPOT CO.'], 0.6, 0.14, 0, 0.9, -1.51, Math.PI, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' }, f);
    sign(['2.5 t', 'max 3.3 m'], 0.3, 0.16, -0.57, 0.5, -0.4, -Math.PI / 2, { w: 256, h: 128, bg: '#1b232c', fg: '#f5b53d', size: 40 }, f); sign(['ELECTRIC'], 0.4, 0.08, 0.57, 0.5, -0.5, Math.PI / 2, { w: 256, h: 64, bg: '#f2b705', fg: '#1a1205' }, f);
    cyl(0.04, 0.3, MAT.red, 0.5, 1.4, -1.15, f, 10); box(0.03, 0.12, 0.1, MAT.chrome, -0.6, 1.9, 0.1); cyl(0.01, 0.3, FS, -0.6, 1.95, 0.05, f, 4).rotation.z = 0.3;
    groundBlob(2.0, 2.9, 0, -0.2, f, 0);
    hitBox(1.1, 1.4, 1.4, 0, 1.2, -0.3, { prompt: function () { if (!S.up.fork) return null; if (player.tool === 'cable') return 'Plug the forklift in'; if (S.fork.plugged) return 'Forklift on charge · unplug at the charger · E drives off anyway'; return S.hand || player.tool ? 'Hands full' : 'Drive the forklift'; }, use: function () { if (player.tool === 'cable') { cablePlugInto('fork'); return; } startDrive(); } }, f);
    forkM = { g: f, car: car, beacon: beaconLens, wheel: wheel };
    placeTools();
  }
  function toolPrompt(tool) { if (tool === 'cart' && !S.up.cart) return null; if (player.tool) return null; if (S.hand) return 'Hands full'; if (driving) return null; return tool === 'jack' ? 'Grab the pallet jack' : 'Grab the picking cart' + (S.cart.boxes.length ? ' (' + S.cart.boxes.length + ' boxes on it)' : ''); }
  function grabTool(tool) { if (player.tool || S.hand || driving) return; if (tool === 'cart' && !S.up.cart) return; player.tool = tool; sfx('pickup'); hudDirty = true; introStep(tool); }
  function releaseTool() { if (!player.tool) return; if (player.tool === 'cable') { player.tool = null; sfx('putdown'); toast('Cable hung back', ''); hudDirty = true; return; } var w = toolWorld(player.tool), tm = player.tool === 'jack' ? jackMesh : cartMesh; if (tm && tm.userData.towRy !== undefined) { w.ry = tm.userData.towRy; w.x = tm.position.x; w.z = tm.position.z; } var t = S[player.tool]; t.x = w.x; t.z = w.z; t.rot = w.ry; player.tool = null; sfx('putdown'); hudDirty = true; }
  function placeTools(dt) {
    var ease = 1 - Math.exp(-(dt || 1 / 60) * 6);
    // a towed tool trails the player: its heading eases toward the player's, so a look round does not whip it about
    var towed = function (tool, mesh) { var w = toolWorld(tool); if (player.tool === tool) { var cur = mesh.userData.towRy === undefined ? w.ry : mesh.userData.towRy, d = Math.atan2(Math.sin(w.ry - cur), Math.cos(w.ry - cur)); cur += d * ease; mesh.userData.towRy = cur; w.ry = cur; w.x = player.x + Math.sin(cur) * 1.15; w.z = player.z + Math.cos(cur) * 1.15; } else mesh.userData.towRy = undefined; mesh.position.set(w.x, floorY(w.x, w.z), w.z); mesh.rotation.y = w.ry; };
    towed('jack', jackMesh); towed('cart', cartMesh); cartMesh.visible = !!S.up.cart;
    forkM.g.position.set(S.fork.x, floorY(S.fork.x, S.fork.z), S.fork.z); forkM.g.rotation.y = S.fork.yaw; forkM.car.position.y = S.fork.lift; forkM.g.visible = !!S.up.fork; if (forkM.beacon) { forkM.beacon.visible = driving; forkM.beacon.rotation.y = worldTime * 6; } if (forkM.wheel) { var k2 = player.keys, steer2 = driving ? ((k2.KeyA ? 1 : 0) - (k2.KeyD ? 1 : 0)) : 0; forkM.wheel.rotation.y = lerp(forkM.wheel.rotation.y, steer2 * 1.4, ease * 2); }
  }

  // ── The forklift ──────────────────────────────────────────────────
  function forkTip() { return { x: S.fork.x + Math.sin(S.fork.yaw) * 1.5, y: S.fork.lift, z: S.fork.z + Math.cos(S.fork.yaw) * 1.5 }; }
  function startDrive() {
    if (!S.up.fork || S.hand || player.tool || driving) return;
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
  function forkCollides(x, z) {
    var r = 1.0;
    if (floorY(x, z) < -0.5) return true;
    var all = solids.concat(dyn);
    for (var i = 0; i < all.length; i++) { var s = all[i]; if (s.fork) continue; if (s.y0 > 2.5) continue; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return true; }
    return false;
  }
  function updateFork(dt) {
    var k = player.keys, F = S.fork;
    var throttle = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), batt = F.batt === undefined ? 1 : F.batt, cap = batt <= 0 ? 0.15 : batt < 0.15 ? 0.5 : 1;
    if (throttle) forkSpeed = clamp(forkSpeed + throttle * 3.2 * dt, -2.6 * cap, 4.2 * cap); else forkSpeed *= Math.max(0, 1 - 3 * dt);
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
    $('h-drive').innerHTML = '<b>W/S</b> drive · <b>A/D</b> steer · <b>R/F</b> forks at ' + F.lift.toFixed(1) + ' m · <b>E</b> ' + (p ? 'set the pallet down' : 'lift a pallet') + ' · <b>G</b> get off · battery <b>' + Math.round((F.batt === undefined ? 1 : F.batt) * 100) + '%</b>' + (p && !p.wrapped ? ' · <span style="color:var(--amber)">unwrapped load</span>' : '');
  }
  function forkUse() {
    var tip = forkTip(), F = S.fork, p = forkPallet();
    if (p) {
      var key = slotNear(tip.x, tip.z, F.lift);
      if (key) { if (storePallet(p, key)) { F.pallet = null; sfx('crate'); addXp(XP.pallet); toast('Pallet stored · ' + slotName(key), 'good'); introStep('putaway'); } else toast('No room in ' + slotName(key) + '.', 'bad'); return; }
      if (F.lift < 0.5) { if (floorY(tip.x, tip.z) < -0.5) { toast('Not over the edge.', 'bad'); return; } p.place = 'floor'; p.x = tip.x; p.z = tip.z; p.y = floorY(tip.x, tip.z); p.rot = F.yaw; F.pallet = null; sfx('crate'); return; }
      toast('Lower the forks, or line them up with a rack slot.', 'bad'); return;
    }
    // lift a pallet off the floor or out of a truck
    var best = null, bd = 1.3;
    S.pallets.forEach(function (q) { if (q.place !== 'floor' && q.place !== 'truck') return; var w = palletWorld(q); if (!w) return; if (q.place === 'truck') { var t = truckById(q.truck); if (!t || t.state !== 'docked' || !t.signed) return; } var d = Math.sqrt(dist2(w.x, w.z, tip.x, tip.z)); if (d < bd && Math.abs(w.y - F.lift) < 0.5) { bd = d; best = q; } });
    if (best) { if (best.place === 'truck') onPalletLeftTruck(best); best.place = 'fork'; F.pallet = best.id; sfx('hydraulic'); introStep('unload'); return; }
    var key2 = slotNear(tip.x, tip.z, F.lift);
    if (key2 && S.slots[key2] && S.slots[key2].n) { var np = pullPallet(key2); if (np) { np.place = 'fork'; F.pallet = np.id; sfx('hydraulic'); } return; }
    toast('Nothing on the forks. Line them up with a pallet at this height.', 'bad');
  }
  function slotNear(x, z, lift) {
    var best = null, bd = 1.2;
    for (var r = 0; r < S.up.rows; r++) for (var b = 0; b < RACK.bays; b++) for (var l = 0; l < RACK.levels.length; l++) {
      var sp = rackSlotPos(r, b, l); if (Math.abs(sp.y - lift) > 0.5) continue;
      var d = Math.sqrt(dist2(sp.x, sp.z, x, z)); if (d < bd) { bd = d; best = slotKey(r, b, l); }
    }
    return best;
  }
  // ── The human model ───────────────────────────────────────────────
  var SKINS = [0xf1d2b6, 0xe2b48f, 0xd9a98a, 0xb87b5a, 0x8d5a3c, 0x5c3a28];
  var HAIRS = [0x1d1510, 0x3a2a1c, 0x6b4a2b, 0xa8793f, 0xd9b36a, 0x8a8a8a, 0xb0352a, 0x2b2b35];
  var SHIRTS = [0x8c949c, 0x3b4b6b, 0x7b3f3f, 0x2f6f4f, 0xd9d9d9, 0x5a4b7b, 0x8a6a3a, 0x335b7b, 0x2a2d33];
  var PANTS = [0x2e3f63, 0x3a3a3a, 0x5b4b3a, 0x1f2a44, 0x6b6b6b];
  var faceCache = {};
  function faceTex(key, mood, skin, blink) {
    var k = key + mood + (blink ? 'b' : '');
    if (faceCache[k]) return faceCache[k];
    var t = tex(128, 128, function (c, w, h) {
      c.clearRect(0, 0, w, h);
      var eye = function (x) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, 58, 11, blink ? 1.5 : 7, 0, 0, 6.3); c.fill(); if (!blink) { c.fillStyle = key.charCodeAt(1) % 2 ? '#3a5a8a' : '#4a3221'; c.beginPath(); c.arc(x + (mood === 'shifty' ? 3 : 0), 59, 4.5, 0, 6.3); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(x + (mood === 'shifty' ? 3 : 0), 59, 2.2, 0, 6.3); c.fill(); c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(x - 1.5, 57, 1.2, 0, 6.3); c.fill(); } };
      eye(44); eye(84);
      c.strokeStyle = '#2a1d14'; c.lineWidth = 3.2; c.lineCap = 'round';
      var tilt = mood === 'angry' ? 5 : mood === 'tired' ? -3 : mood === 'happy' ? -2 : 0;
      c.beginPath(); c.moveTo(32, 44 + tilt); c.lineTo(54, 44 - tilt); c.stroke(); c.beginPath(); c.moveTo(74, 44 - tilt); c.lineTo(96, 44 + tilt); c.stroke();
      c.strokeStyle = 'rgba(80,40,30,0.7)'; c.lineWidth = 2.6; c.beginPath();
      if (mood === 'happy') { c.moveTo(48, 90); c.quadraticCurveTo(64, 104, 80, 90); } else if (mood === 'tired') { c.moveTo(50, 94); c.quadraticCurveTo(64, 88, 78, 94); } else if (mood === 'talk') { c.fillStyle = '#5a2a2a'; c.ellipse(64, 93, 8, 6, 0, 0, 6.3); c.fill(); } else { c.moveTo(52, 92); c.lineTo(76, 92); }
      c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(64, 74, 5, 8, 0, 0, 6.3); c.fill();   // the nose shadow
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; faceCache[k] = t; return t;
  }
  function makeHuman(opt) {
    opt = opt || {};
    var skinCol = opt.skin || pick(SKINS), hairCol = opt.hair || pick(HAIRS), style = opt.style || pick(['short', 'short', 'long', 'bun', 'bald', 'cap']);
    var skin = std({ color: skinCol, roughness: 0.85 }), shirt = opt.shirt || std({ color: pick(SHIRTS), roughness: 0.95 }), pants = std({ color: pick(PANTS), roughness: 0.95 }), hair = std({ color: hairCol, roughness: 0.95 });
    var g = new THREE.Group(), u = g.userData; u.dynamic = true;
    u.key = 'f' + Math.floor(Math.random() * 1000); u.mood = opt.mood || 'neutral'; u.blink = 0; u.blinkIn = randf(2, 6); u.walk = 0; u.idleT = Math.random() * 10; u.lookYaw = 0; u.lookPitch = 0;
    function leg(x) { var hip = new THREE.Group(); hip.position.set(x, 0.86, 0); cyl(0.075, 0.42, pants, 0, -0.21, 0, hip, 10); var knee = new THREE.Group(); knee.position.set(0, -0.42, 0); cyl(0.065, 0.4, pants, 0, -0.2, 0, knee, 10); var boot = new THREE.Mesh(bevelGeo(0.15, 0.1, 0.28, 0.03), MAT.black); boot.position.set(0, -0.41, 0.05); boot.castShadow = true; knee.add(boot); box(0.16, 0.03, 0.3, std({ color: 0x8a6a3a, roughness: 1 }), 0, -0.455, 0.05, knee); hip.add(knee); hip.userData.knee = knee; g.add(hip); return hip; }
    function arm(x) { var sh = new THREE.Group(); sh.position.set(x, 1.38, 0); sphere(0.065, shirt, 0, 0, 0, sh); cyl(0.052, 0.3, shirt, 0, -0.15, 0, sh, 8); var el = new THREE.Group(); el.position.set(0, -0.3, 0); sphere(0.05, shirt, 0, 0, 0, el); cyl(0.045, 0.26, skin, 0, -0.14, 0, el, 8); var hd = sphere(0.055, skin, 0, -0.3, 0.01, el); hd.scale.set(0.8, 1.1, 0.6); sh.add(el); sh.userData.elbow = el; g.add(sh); return sh; }
    u.legs = [leg(-0.12), leg(0.12)]; u.arms = [arm(-0.245), arm(0.245)];
    var torso = new THREE.Mesh(bevelGeo(0.4, 0.56, 0.24, 0.06), shirt); torso.position.set(0, 1.14, 0); torso.castShadow = true; g.add(torso); sphere(0.085, shirt, -0.17, 1.4, 0, g); sphere(0.085, shirt, 0.17, 1.4, 0, g); var chest = new THREE.Mesh(bevelGeo(0.42, 0.14, 0.26, 0.05), shirt); chest.position.set(0, 1.36, 0); g.add(chest);
    if (opt.vest) { var vest = new THREE.Mesh(bevelGeo(0.46, 0.46, 0.29, 0.05), opt.vest); vest.position.set(0, 1.15, 0); vest.castShadow = true; g.add(vest); var band = std({ color: 0xc9ced3, roughness: 0.3, metalness: 0.4 }); box(0.48, 0.035, 0.31, band, 0, 1.06, 0, g); box(0.48, 0.035, 0.31, band, 0, 1.22, 0, g); box(0.05, 0.3, 0.31, band, -0.15, 1.3, 0, g); box(0.05, 0.3, 0.31, band, 0.15, 1.3, 0, g); }
    if (opt.name) { var tag = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), new THREE.MeshBasicMaterial({ map: textTex([opt.name], { w: 128, h: 48, bg: '#fff', fg: '#1b232c' }) })); tag.position.set(0.1, 1.3, 0.145); g.add(tag); }
    cyl(0.05, 0.08, skin, 0, 1.47, 0, g, 8);
    var head = sphere(0.135, skin, 0, 1.6, 0, g); u.head = head; u.skinKey = skinCol.toString(16);
    var face = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: faceTex(u.key, u.mood, u.skinKey), transparent: true, alphaTest: 0.1 })); face.position.set(0, 1.6, 0.128); g.add(face); u.face = face;
    sphere(0.025, skin, -0.13, 1.6, 0, g); sphere(0.025, skin, 0.13, 1.6, 0, g);
    if (style !== 'bald') { var hs = sphere(0.14, hair, 0, 1.63, -0.015, g); hs.scale.set(1, 0.75, 1); }
    if (style === 'long') { box(0.2, 0.3, 0.1, hair, 0, 1.45, -0.1, g); } if (style === 'bun') { sphere(0.06, hair, 0, 1.7, -0.12, g); }
    if (style === 'cap' || opt.cap) { cyl(0.145, 0.07, opt.capMat || MAT.blue, 0, 1.71, 0, g, 16); box(0.18, 0.02, 0.14, opt.capMat || MAT.blue, 0, 1.69, 0.17, g); }
    if (opt.hardhat) { var hh = sphere(0.155, opt.hardhat, 0, 1.66, 0, g); hh.scale.set(1, 0.7, 1); cyl(0.19, 0.02, opt.hardhat, 0, 1.63, 0, g, 16); }
    if (Math.random() < 0.3 && !opt.noBeard) { var bd = sphere(0.1, hair, 0, 1.52, 0.06, g); bd.scale.set(1, 0.55, 0.8); }
    if (Math.random() < 0.25) { [-0.05, 0.05].forEach(function (x) { var ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 12), MAT.black); ring.position.set(x, 1.61, 0.13); g.add(ring); }); box(0.03, 0.005, 0.01, MAT.black, 0, 1.61, 0.13, g); }
    groundBlob(0.9, 0.9, 0, 0, g, 0.002);
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });
    return g;
  }
  function setMood(g, mood) { var u = g.userData; if (u.mood === mood) return; u.mood = mood; u.face.material.map = faceTex(u.key, mood, u.skinKey, u.blink > 0); }
  // mode: 'walk' | 'idle' | 'wait' | 'work'. look: a world point the head turns to, within reason. carry: arms forward.
  function animateHuman(g, dt, mode, speed, look, carry) {
    var u = g.userData; if (!u.legs) return;
    u.idleT += dt;
    if (mode === 'walk') u.walk += dt * (6 + speed * 1.5); else { var ph = u.walk % Math.PI; u.walk += (ph < Math.PI / 2 ? -ph : Math.PI - ph) * Math.min(1, 10 * dt); }
    var t = u.walk, sw = mode === 'walk' ? 0.55 : 0;
    u.legs[0].rotation.x = Math.sin(t) * sw; u.legs[1].rotation.x = -Math.sin(t) * sw;
    u.legs[0].userData.knee.rotation.x = Math.max(0, -Math.sin(t - 0.6)) * 1.0 * (sw ? 1 : 0); u.legs[1].userData.knee.rotation.x = Math.max(0, Math.sin(t - 0.6)) * 1.0 * (sw ? 1 : 0);
    if (carry) { u.arms[0].rotation.x = -0.9; u.arms[1].rotation.x = -0.9; u.arms[0].userData.elbow.rotation.x = -0.9; u.arms[1].userData.elbow.rotation.x = -0.9; u.arms[0].rotation.z = 0.25; u.arms[1].rotation.z = -0.25; }
    else if (mode === 'work') { u.arms[0].rotation.x = -0.6 + Math.sin(u.idleT * 6) * 0.25; u.arms[1].rotation.x = -0.6 - Math.sin(u.idleT * 6) * 0.25; u.arms[0].userData.elbow.rotation.x = -0.8; u.arms[1].userData.elbow.rotation.x = -0.8; u.arms[0].rotation.z = 0.1; u.arms[1].rotation.z = -0.1; }
    else { var drift = Math.sin(u.idleT * 1.1) * 0.05; u.arms[0].rotation.x = -Math.sin(t) * sw * 0.8 + drift; u.arms[1].rotation.x = Math.sin(t) * sw * 0.8 - drift; u.arms[0].userData.elbow.rotation.x = -Math.max(0, Math.sin(t)) * sw * 0.6 - 0.15; u.arms[1].userData.elbow.rotation.x = -Math.max(0, -Math.sin(t)) * sw * 0.6 - 0.15; u.arms[0].rotation.z = 0.08; u.arms[1].rotation.z = -0.08; }
    if (mode === 'wait') { u.legs[1].position.y = 0.86 + Math.max(0, Math.sin(u.idleT * 2.4)) * 0.04; } else u.legs[1].position.y = 0.86;
    g.children.forEach(function (c) { if (c === u.head || c === u.face) return; });
    var bob = mode === 'walk' ? Math.abs(Math.cos(t)) * 0.03 : Math.sin(u.idleT * 0.31) * 0.004;
    g.position.y = (g.userData.baseY || 0) + bob; g.rotation.z = mode === 'walk' ? Math.sin(t) * 0.03 : Math.sin(u.idleT * 0.31) * 0.007;
    // the head: looks at what it is given, else drifts; blinks now and then
    var wantYaw = 0, wantPitch = 0;
    if (look) { var dx = look.x - g.position.x, dz = look.z - g.position.z, d = Math.sqrt(dx * dx + dz * dz); if (d < 9) { var a = Math.atan2(dx, dz) - g.rotation.y; while (a > Math.PI) a -= 6.283; while (a < -Math.PI) a += 6.283; wantYaw = clamp(a, -1.3, 1.3); wantPitch = clamp(Math.atan2((look.y || 1.6) - 1.6, d), -0.3, 0.3); } }
    else wantYaw = Math.sin(u.idleT * 0.4) * 0.15;
    u.lookYaw += (wantYaw - u.lookYaw) * Math.min(1, 6 * dt); u.lookPitch += (wantPitch - u.lookPitch) * Math.min(1, 6 * dt);
    u.head.rotation.y = u.lookYaw; u.face.rotation.y = u.lookYaw; u.face.position.x = Math.sin(u.lookYaw) * 0.128; u.face.position.z = Math.cos(u.lookYaw) * 0.128; u.face.position.y = 1.6 - Math.sin(u.lookPitch) * 0.05;
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
  var NAV = { cell: 0.4, x0: -HALL.x - 14, z0: -HALL.z - 2, w: Math.round((2 * HALL.x + 28) / 0.4), h: Math.round((2 * HALL.z + 4) / 0.4), grid: null, dirty: true };
  function navBuild() {
    var g = new Uint8Array(NAV.w * NAV.h), c = NAV.cell, pad = 0.3;
    for (var j = 0; j < NAV.h; j++) for (var i = 0; i < NAV.w; i++) {
      var x = NAV.x0 + (i + 0.5) * c, z = NAV.z0 + (j + 0.5) * c, blocked = 0;
      if (Math.abs(x) >= HALL.x - 0.35 || Math.abs(z) >= HALL.z - 0.35) blocked = 2;   // outside: open only through a docked trailer
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
  function navLine(a, b) { var dx = b.x - a.x, dz = b.z - a.z, n = Math.ceil(Math.sqrt(dx * dx + dz * dz) / (NAV.cell * 0.5)) + 1; for (var k = 0; k <= n; k++) { var cl = navCell({ x: a.x + dx * k / n, z: a.z + dz * k / n }); if (!navOpen(cl.i, cl.j)) return false; } return true; }
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
    var name = STAFF_NAMES[S.nextStaffName++ % STAFF_NAMES.length];
    var st = { id: uid('st'), name: name, role: role, x: SPOT.spawn.x, z: SPOT.spawn.z, yaw: 0, state: 'home', path: [], timer: 0, carry: null, task: null, hiredDay: S.day, look: { skin: pick(SKINS), hair: pick(HAIRS), style: pick(['short', 'long', 'bun', 'bald', 'short']) }, said: 0, punct: randf(0.2, 1), arriveOff: 0, hoursToday: 0, sheet: [] };
    S.staff.push(st); buildStaffMesh(st); logEvent('Hired ' + name + ' as ' + def.name.toLowerCase() + '. Paid ' + money(def.wage / 10) + ' an hour from the time clock, time and a half past ten hours.', 'good'); hudDirty = true; if (S.time < 17 && !isSunday()) { st.state = 'home'; st.arriveOff = Math.round((S.time + 0.15 - SHIFT_START) * 60); }
  }
  function fireStaff(id) {
    var st = staffById(id); if (!st) return;
    staffDropAll(st); var m = staffMeshes[id]; if (m) { scene.remove(m); delete staffMeshes[id]; }
    S.staff.splice(S.staff.indexOf(st), 1); logEvent(st.name + ' let go'); hudDirty = true;
  }
  function buildStaffMesh(st) {
    var vest = st.role === 'receiver' ? MAT.hivisOrange : st.role === 'picker' ? MAT.hivis : MAT.green;
    var look = st.look || {};
    var g = makeHuman({ skin: look.skin, hair: look.hair, style: look.style, vest: vest, hardhat: st.role === 'receiver' ? MAT.white : null, name: st.name }); g.userData.dynamic = true; g.position.set(st.x, 0, st.z); scene.add(g); staffMeshes[st.id] = g;
  }
  function staffDropAll(st) {
    if (st.carry) { if (st.carry.kind === 'box') S.floor.push({ kind: 'box', sku: st.carry.sku, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); else S.floor.push({ kind: 'parcel', order: st.carry.order, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); st.carry = null; }
    S.pallets.forEach(function (p) { if (p.place === 'staff' && p.staff === st.id) { p.place = 'floor'; p.x = st.x + Math.sin(st.yaw) * 0.95; p.z = st.z + Math.cos(st.yaw) * 0.95; p.y = floorY(p.x, p.z); p.rot = st.yaw; } });
    st.task = null; st.state = 'idle'; st.path = [];
  }
  function staffGo(st, to, then) { st.path = route({ x: st.x, z: st.z }, to); st.state = 'walk'; st.then = then; }
  function staffWalk(st, dt) {
    if (!st.path.length) { st.state = st.then || 'idle'; st.then = null; return; }
    var t = st.path[0], dx = t.x - st.x, dz = t.z - st.z, d = Math.sqrt(dx * dx + dz * dz), sp = (st.carry || S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; }) ? 1.6 : 1.9) * dt;
    if (d <= sp) { st.x = t.x; st.z = t.z; st.path.shift(); if (!st.path.length) { st.state = st.then || 'idle'; st.then = null; } return; }
    st.x += dx / d * sp; st.z += dz / d * sp;
    var want = Math.atan2(dx, dz), diff = want - st.yaw; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI; st.yaw += diff * Math.min(1, 10 * dt);
  }
  function skuDemand(sku) {
    var need = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === sku) need += l.qty; }); });
    need -= (S.bench.boxes[sku] || 0);
    S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box' && st.carry.sku === sku) need--; if (st.task && st.task.kind === 'pick' && st.task.sku === sku && !st.carry) need--; });
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
        m.visible = false; st.x = RAMP_BOTTOM.x; st.z = RAMP_BOTTOM.z;
        if (!off && !st.clockedOutAt && S.time >= staffArrival(st) && S.time < end - 0.5) { st.state = 'walk'; st.then = 'clockin'; st.path = route({ x: st.x, z: st.z }, clockStand()); }
        return;
      }
      if (st.state === 'gone') { st.state = 'home'; m.visible = false; return; }
      m.visible = true;
      var carrying = !!st.carry || S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; });
      // the clock at both ends of the shift
      if (st.state === 'clockin') { staffWait(st, 1.4, function () { staffClockIn(st); st.state = 'idle'; }, true); st.state = 'wait'; st.yaw = clockFaceYaw(); }
      if (st.clocked && S.time >= end && st.state !== 'leaving' && st.state !== 'clockout' && !(st.state === 'wait' && st.leavingWait)) { staffDropAll(st); st.state = 'walk'; st.then = 'clockout'; st.path = route({ x: st.x, z: st.z }, clockStand()); st.leaving = true; }
      if (st.state === 'clockout') { st.leavingWait = true; staffWait(st, 1.2, function () { staffClockOut(st); st.leavingWait = false; st.state = 'walk'; st.then = 'gone'; st.path = route({ x: st.x, z: st.z }, RAMP_BOTTOM); st.leaving = true; }, true); st.state = 'wait'; st.yaw = clockFaceYaw(); }
      if (st.clocked) st.hoursToday = (st.hoursToday || 0) + dt / HOUR_SEC;
      var working = st.clocked && !st.leaving;
      if (working && brk && !carrying && st.state !== 'break' && st.state !== 'walk' && st.state !== 'wait') { st.task = null; staffSay(st, voice(st).brk, '#a0acb8'); staffGo(st, { x: -26.3 + randf(-1, 1), z: -21.2 + randf(-0.4, 0.4) }, 'break'); }
      if (!brk && st.state === 'break') st.state = 'idle';
      var mode = st.state === 'walk' ? 'walk' : st.state === 'wait' ? (st.working ? 'work' : 'wait') : 'idle';
      if (st.state === 'walk') staffWalk(st, dt);
      else if (st.state === 'wait') { st.timer -= dt; if (st.timer <= 0) { st.state = 'idle'; st.working = false; if (st.after) { var f = st.after; st.after = null; f(); } } }
      else if (st.state === 'break') { /* standing in the break room */ }
      else if (st.state === 'idle' && working) { if (st.role === 'receiver') receiverThink(st); else if (st.role === 'picker') pickerThink(st); else packerThink(st); }
      if ((st.state === 'idle' || st.state === 'break') && Math.random() < dt / 22 && S.time - (st.said || 0) > 0.4) { st.said = S.time; staffSay(st, pick(voice(st).idle), '#a0acb8'); }
      m.position.set(st.x, floorY(st.x, st.z), st.z); m.rotation.y = st.yaw;
      var near = dist2(st.x, st.z, player.x, player.z) < 36;
      animateHuman(m, dt, mode, 1.9, near && st.state !== 'walk' ? { x: player.x, y: player.y + 1.6, z: player.z } : null, carrying);
    });
  }
  function benchSide(lz) { var P = PROPS.bench ? propPlacement('bench') : { x: SPOT.bench.x, z: SPOT.bench.z, rot: 0 }, a = P.rot * Math.PI / 2, lx = -1.0; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a) }; }
  function clockStand() { var P = propPlacement('timeclock'), a = P.rot * Math.PI / 2; return { x: P.x + Math.sin(a) * 1.0, z: P.z + Math.cos(a) * 1.0 }; }
  function clockFaceYaw() { var P = propPlacement('timeclock'); return P.rot * Math.PI / 2 + Math.PI; }
  function staffWait(st, sec, after, working) { st.state = 'wait'; st.timer = sec; st.after = after; st.working = !!working; }
  function idleAt(st, spot) { if (dist2(st.x, st.z, spot.x, spot.z) > 1) { staffGo(st, spot, 'wait'); st.timer = 1.5; } else staffWait(st, 1.5 + Math.random()); }
  function receiverThink(st) {
    var carrying = S.pallets.filter(function (p) { return p.place === 'staff' && p.staff === st.id; })[0];
    if (carrying) {
      var key = findSlotFor(carrying.sku, carrying.n, 1);
      if (!key) { carrying.place = 'floor'; carrying.x = SPOT.stageIn.x + randf(-1, 1); carrying.z = SPOT.stageIn.z + randf(-1, 1); carrying.y = 0; carrying.rot = 0; staffSay(st, voice(st).nospace, '#ff6b5e'); logEvent(st.name + ' found no rack space: pallet left in receiving', 'bad'); st.task = null; return; }
      st.task = { kind: 'store', pallet: carrying.id, key: key };
      staffGo(st, slotStand(key), 'wait'); st.timer = 1.4; st.working = true; st.after = function () { var p = palletById(carrying.id); if (!p) return; if (!storePallet(p, key)) { var k2 = findSlotFor(p.sku, p.n, 1); if (!k2 || !storePallet(p, k2)) { p.place = 'floor'; p.x = st.x; p.z = st.z; p.y = 0; } } else { sfx('crate'); addXp(XP.pallet); } st.task = null; };
      return;
    }
    var pickP = null;
    for (var i = 0; i < S.pallets.length; i++) { var p = S.pallets[i]; if (p.place !== 'truck') continue; var t = truckById(p.truck); if (!t || t.state !== 'docked' || !S.doors[t.dock] || !t.signed) continue; if (S.staff.some(function (o) { return o !== st && o.task && o.task.pallet === p.id; })) continue; pickP = p; break; }
    if (!pickP) { idleAt(st, { x: SPOT.stageIn.x, z: SPOT.stageIn.z + 2.6 }); return; }
    var w = truckPalletPos(truckById(pickP.truck), pickP.idx), tr = truckById(pickP.truck);
    st.task = { kind: 'fetch', pallet: pickP.id }; if (Math.random() < 0.5) staffSay(st, voice(st).onit, '#5fd38d');
    staffGo(st, { x: w.x, z: w.z + (w.z > tr.z ? -1.0 : 1.0) }, 'wait'); st.timer = 1.4; st.working = true;
    st.after = function () { var p = palletById(pickP.id); if (!p || p.place !== 'truck') { st.task = null; return; } onPalletLeftTruck(p); p.place = 'staff'; p.staff = st.id; sfx('jack'); st.task = null; };
  }
  function pickerThink(st) {
    if (st.carry) {
      staffGo(st, benchSide(0), 'wait'); st.timer = 0.8; st.working = true;
      st.after = function () { if (!st.carry) return; if (benchCount() < ECON.benchCap) { benchAdd(st.carry.sku, 1); st.carry = null; sfx('putdown'); addXp(XP.box); } else { staffSay(st, voice(st).full, '#ff6b5e'); staffWait(st, 3); } st.task = null; };
      return;
    }
    var want = null;
    var orders = openOrders().slice().sort(function (a, b) { return (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b.due; });
    for (var i = 0; i < orders.length && !want; i++) orders[i].lines.forEach(function (l) { if (want) return; if (skuDemand(l.sku) > 0) { var keys = slotsWith(l.sku).filter(function (k) { return slotParse(k).l < RACK.top; }); if (keys.length) want = { sku: l.sku, key: keys[0] }; } });
    if (!want) { idleAt(st, { x: 24.6, z: 2.6 }); return; }
    st.task = { kind: 'pick', sku: want.sku, key: want.key };
    staffGo(st, slotStand(want.key), 'wait'); st.timer = 1.0; st.working = true;
    st.after = function () { var s = S.slots[want.key]; if (s && s.sku === want.sku && s.n > 0) { slotTake(want.key, 1); st.carry = { kind: 'box', sku: want.sku }; S.stats.picked++; sfx('pickup'); } st.task = null; };
  }
  function packerThink(st) {
    if (st.carry && st.carry.kind === 'parcel') {
      var t = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && S.doors[2 + x.dock]; })[0];
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
    var truck = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && S.doors[2 + x.dock]; })[0];
    if (truck && S.bench.parcels.length) {
      staffGo(st, benchSide(2.3), 'wait'); st.timer = 0.7; st.working = true;
      st.after = function () { var oid = S.bench.parcels.shift(); if (oid) { st.carry = { kind: 'parcel', order: oid }; sfx('pickup'); } };
      return;
    }
    idleAt(st, { x: 24.8, z: 7.4 });
  }
  // ── The time clock ────────────────────────────────────────────────
  // Nobody is paid a flat wage. The crew clock in at the reader by the staff door when they arrive and clock out when
  // they leave; the day's pay at 06:00 is their clocked hours at the hourly rate, with anything past ten hours at
  // time and a half. Punctuality is a trait: some are early, some drift in late, and a word puts them right for a while.
  var CLOCK_SPOT = { x: -29.0, z: 20.2 }, RAMP_BOTTOM = { x: -37.3, z: 22 }, SHIFT_START = 8;
  function hourly(st) { return STAFF_ROLES[st.role].wage / 10; }
  function shiftEnd(st) { return st.overtime ? 20 : 18; }
  function staffArrival(st) { return SHIFT_START + (st.arriveOff || 0) / 60; }
  function staffStatus(st) {
    if (isSunday()) return 'Sunday';
    if (st.sick) return 'called in sick'; if (st.dayOff) return 'day off';
    if (st.state === 'home' && S.time < staffArrival(st)) return 'due ' + fmtTime(staffArrival(st));
    if (st.state === 'home' && st.clockedOutAt) return 'clocked out ' + fmtTime(st.clockedOutAt);
    if (st.state === 'home') return 'not in';
    if (!st.clocked) return 'arriving';
    if (st.state === 'break') return 'on break';
    return 'in since ' + fmtTime(st.clockInAt || SHIFT_START) + (st.overtime ? ' · overtime' : '') + (st.lateToday ? ' · late' : '');
  }
  // the day's roll: who is sick, who is off, when each one will turn up
  function staffNewDay() {
    S.staff.forEach(function (st) {
      if (st.dayOffNext) { st.dayOff = true; st.dayOffNext = false; } else st.dayOff = false;
      st.sick = !st.dayOff && Math.random() < 0.04;
      if (st.punct === undefined) st.punct = randf(0.2, 1);
      var p = st.punct, r = Math.random();
      st.arriveOff = p > 0.75 ? randi(-12, -2) : p > 0.4 ? (r < 0.7 ? randi(-6, 4) : randi(6, 14)) : (r < 0.35 ? randi(-3, 3) : randi(8, 28));
      st.overtime = !!st.overtimeNext; st.overtimeNext = false;
      st.lateToday = false; st.hoursToday = 0; st.clockInAt = null; st.clockedOutAt = null; st.clocked = false; st.wordToday = false;
      if (st.sick) logEvent(st.name + ' called in sick', 'bad');
      if (st.dayOff) logEvent(st.name + ' has the day off');
      if (st.punct < 1) st.punct = clamp(st.punct - 0.01, 0.1, 1);   // a word wears off slowly
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
    if (S.time > SHIFT_START + 5 / 60) { st.lateToday = true; st.lateDays = (st.lateDays || 0) + 1; staffSay(st, pick(['Sorry, the ring road.', 'Late. I know. Sorry.', 'Overslept. Will not happen again.', 'Bus did not come.']), '#ff6b5e'); logEvent(st.name + ' clocked in late at ' + fmtTime(S.time), 'bad'); }
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
  function defMachine(id, m) { m.id = id; m.lamps = null; MACH[id] = m; }
  function defBelt(id, b) { b.id = id; BELTS[id] = b; }
  function propWorld(prop, lx, lz) { var P = propPlacement(prop), a = P.rot * Math.PI / 2; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), a: a }; }
  function beltLen(b) { var p = b.path, n = 0; for (var i = 1; i < p.length; i++) n += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return n; }
  function beltPoint(b, d) {   // the world point d metres along the belt
    var p = b.path, rem = d; for (var i = 1; i < p.length; i++) { var seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (rem <= seg || i === p.length - 1) { var t = seg > 0 ? clamp(rem / seg, 0, 1) : 0; var w = propWorld(b.prop, lerp(p[i - 1][0], p[i][0], t), lerp(p[i - 1][1], p[i][1], t)); w.ry = w.a + Math.atan2(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return w; } rem -= seg; }
    return propWorld(b.prop, p[0][0], p[0][1]);
  }
  function beltItems(id) { if (!S.belts) S.belts = {}; if (!S.belts[id]) S.belts[id] = []; return S.belts[id]; }
  function beltStartFree(id) { var it = beltItems(id); return !it.length || it[it.length - 1].d > BELT_GAP; }
  function beltPush(id, item) { if (!beltStartFree(id)) return false; item.d = 0; beltItems(id).push(item); return true; }
  // what sits at a belt's far end: another belt whose start is within reach, or a machine whose inlet is
  function beltSink(b) {
    var end = beltPoint(b, beltLen(b));
    for (var k in BELTS) { if (k === b.id) continue; var s = beltPoint(BELTS[k], 0); if (dist2(end.x, end.z, s.x, s.z) < REACH * REACH) return { belt: BELTS[k] }; }
    for (var m in MACH) { var mc = MACH[m]; if (!mc.inlet || !PROPS[mc.prop] || !propInst[mc.prop]) continue; var w = propWorld(mc.prop, mc.inlet[0], mc.inlet[1]); if (dist2(end.x, end.z, w.x, w.z) < REACH * REACH) return { machine: mc }; }
    return null;
  }
  function machineOutBelt(m) { if (!m.outlet) return null; var w = propWorld(m.prop, m.outlet[0], m.outlet[1]); for (var k in BELTS) { var s = beltPoint(BELTS[k], 0); if (dist2(w.x, w.z, s.x, s.z) < REACH * REACH) return BELTS[k]; } return null; }
  function powered() { return !S.events.power; }
  function tickBelts(dt) {
    for (var k in BELTS) {
      var b = BELTS[k]; if (!propInst[b.prop]) continue; var items = beltItems(k), L = beltLen(b), sink = beltSink(b);
      items.sort(function (p, q) { return q.d - p.d; });   // front of the belt first
      var ahead = Infinity;
      for (var i = 0; i < items.length; i++) {
        var it = items[i], max = Math.min(ahead - BELT_GAP, L);
        if (powered()) it.d = Math.min(it.d + BELT_SPEED * dt, max);
        if (it.d >= L - 0.001 && sink) {
          var taken = false;
          if (sink.belt) taken = beltPush(sink.belt.id, it); else if (sink.machine && sink.machine.accept) taken = sink.machine.accept(it);
          if (taken) { items.splice(i, 1); i--; continue; }
        }
        ahead = it.d;
      }
    }
    BELT_PLANES.forEach(function (pl) { if (powered()) pl.material.map.offset.y -= BELT_SPEED * dt / 0.5; });
  }
  // belt items are drawn with the instanced boxes and parcels, inside syncInstances
  function drawBeltItems() {
    for (var k in BELTS) { var b = BELTS[k]; if (!propInst[b.prop]) continue; beltItems(k).forEach(function (it) { var w = beltPoint(b, it.d); if (it.kind === 'parcel') putParcel(w.x, BELT_Y + 0.23, w.z, w.ry, { kind: 'belt' }); else putBox(it.sku, w.x, BELT_Y + BOX.h / 2, w.z, w.ry, { kind: 'belt' }); }); }
    if (S.pal && S.pal.n > 0 && propInst.palletiser) { var cw = propWorld('palletiser', 0, 0); drawPalletWithBoxes(S.pal.sku, S.pal.n, cw.x, 0.42, cw.z, cw.a, { kind: 'palletiser' }); }
  }
  function lampSet(m, status) { if (!m.lamps) return; m.lamps.g.visible = status === 'run'; m.lamps.a.visible = status === 'idle'; m.lamps.r.visible = status === 'jam' || status === 'off'; }

  // ── The pack line: the bench feeds boxes onto the infeed, the case taper closes the order into one parcel, the outfeed drops it on the shelf
  defBelt('packIn', { prop: 'packline', path: [[0, 0], [0, 2.0]] });
  defBelt('packOut', { prop: 'packline', path: [[0, 3.8], [0, 5.8]] });
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
    if (!P.job && P.queue.length) P.job = P.queue.shift();
    var j = P.job;
    if (j && !orderById(j.order)) { P.job = null; return; }
    if (powered() && !P.jam && j) {
      // feed the next box onto the infeed every 1.3 s
      P.feedT += dt; if (j.fed < j.boxes.length && P.feedT >= 1.3 && beltPush('packIn', { kind: 'box', sku: j.boxes[j.fed] })) { j.fed++; P.feedT = 0; }
      // every box in: the taper runs 3 s, then a parcel comes out on the outfeed
      if (j.inMach >= j.boxes.length) { j.t += dt; if (j.t >= 3 && !P.out) { if (Math.random() < 0.05) { P.jam = true; toast('The pack line has jammed. Press E on it to clear it.', 'bad'); sfx('bad'); return; } P.out = j.order; sfx('hydraulic'); P.job = null; } }
    }
    if (P.out && powered() && !P.jam && beltPush('packOut', { kind: 'parcel', order: P.out })) P.out = null;
    // the outfeed end: the parcel drops onto the shelf when there is room
    var outs = beltItems('packOut'), L = beltLen(BELTS.packOut);
    for (var i = outs.length - 1; i >= 0; i--) { if (outs[i].d >= L - 0.001 && S.bench.parcels.length < 8) { packFinish(outs[i].order); outs.splice(i, 1); } }
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
      F.t += dt;
      if (F.t >= FACTORY_RATE) { if (beltPush('moulderOut', { kind: 'box', sku: F.product })) { F.t = 0; F.raw--; F.made++; S.stats.made = (S.stats.made || 0) + 1; if (S.seenSkus.indexOf(F.product) < 0) S.seenSkus.push(F.product); if (Math.random() < 0.02) { F.jam = true; toast('The moulding line has jammed. Press E on it to clear it.', 'bad'); sfx('bad'); } } }
      if (F.raw <= 0) { F.on = false; toast('The hopper is empty: the moulding line stopped.', 'bad'); screenDirtyAll(); }
    }
    if (MACH.moulder.anim) { var a = MACH.moulder.anim, run = factoryStatus() === 'run'; a.ram.position.z = -0.2 + Math.sin(F.t / FACTORY_RATE * Math.PI * 2) * 0.22 * (run ? 1 : 0); a.wheel.rotation.z += (run ? 2.5 : 0) * dt; a.spin.rotation.y += (run ? 6 : 0) * dt; }
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
    scText(c, 16, 220, 'Made ' + F.made + ' · ' + FACTORY_RATE + ' s a box · one unit of granulate each', '#a0acb8', 12);
    scText(c, 16, 240, 'Boxes go down the belt to the palletiser in the hall.', '#6b7784', 11);
  }

  // ── The hopper: a pallet of raw granulate on the jack or the forks tips into it
  var RAW_PER_SACK = 5, HOPPER_CAP = 400;
  defMachine('hopper', { prop: 'hopper' });
  function rawPalletInHand() { var p = player.tool === 'jack' ? jackPallet() : driving ? forkPallet() : null; return p && p.sku === 'raw' ? p : null; }
  function hopperPrompt() { var p = rawPalletInHand(); if (p) return S.factory.raw >= HOPPER_CAP ? 'The hopper is full' : 'Tip the granulate into the hopper (+' + p.n * RAW_PER_SACK + ')'; return 'Raw hopper · ' + S.factory.raw + ' / ' + HOPPER_CAP + ' units' + (player.tool === 'jack' || driving ? ' · bring a pallet of raw granulate' : ''); }
  function hopperUse() {
    var p = rawPalletInHand(); if (!p) { sfx('bad'); return; } if (S.factory.raw >= HOPPER_CAP) { toast('The hopper is full.', 'bad'); return; }
    S.factory.raw = Math.min(HOPPER_CAP, S.factory.raw + p.n * RAW_PER_SACK);
    for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === p.id) { S.pallets.splice(i, 1); break; }
    if (S.jack.pallet === p.id) S.jack.pallet = null; if (S.fork.pallet === p.id) S.fork.pallet = null;
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
  function palletiserScreenDraw(c, sc) { var P = S.pal; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'PALLETISER', powered() ? (P.n ? 'STACKING' : 'READY') : 'OFF'); scText(c, 16, 70, P.n ? P.n + ' / 8 · ' + skuName(P.sku) : 'Empty pallet in the cradle', '#eef1f5', 16); for (var i = 0; i < 8; i++) { c.fillStyle = i < P.n ? '#5fd38d' : 'rgba(255,255,255,0.1)'; c.fillRect(16 + i * 30, 86, 24, 24); } scButton(sc, 16, 124, 120, 32, 'EJECT', P.n > 0, function () { palletiserUse(); }); scText(c, 16, 180, 'Pallets made: ' + (S.stats.palletised || 0), '#a0acb8', 12); lampSet(MACH.palletiser, powered() ? (P.n ? 'run' : 'idle') : 'off'); }

  // ── The baler: cardboard from binned boxes and packing offcuts fills the chamber; ten units make a bale; outbound trucks take the bales away for cash
  var BALE_NEED = 10, BALE_PRICE = 18;
  defMachine('baler', { prop: 'baler' });
  function balerStatus() { if (!powered()) return 'off'; return S.baler.t > 0 ? 'run' : 'idle'; }
  function addWaste(n) { if (!S.baler) S.baler = { card: 0, bales: 0, t: 0, made: 0 }; S.baler.card += n; screenDirtyAll(); }
  function balerPrompt() { var B = S.baler; if (B.t > 0) return 'Baling… ' + Math.ceil(B.t) + ' s'; if (!powered()) return 'Baler · no power'; return 'Baler · ' + B.card + ' / ' + BALE_NEED + ' cardboard in the chamber' + (B.card >= BALE_NEED ? ' · E makes a bale' : '') + (B.bales ? ' · ' + B.bales + ' bale' + (B.bales > 1 ? 's' : '') + ' waiting for a truck' : ''); }
  function balerUse() { var B = S.baler; if (B.t > 0 || !powered()) { sfx('bad'); return; } if (B.card < BALE_NEED) { toast('Not enough cardboard yet: ' + B.card + ' of ' + BALE_NEED + '. Binned boxes and packing offcuts fill it.', ''); sfx('bad'); return; } B.t = 8; B.card -= BALE_NEED; sfx('hydraulic'); addXp(3); screenDirtyAll(); }
  function tickBaler(dt) {
    if (!S.baler) S.baler = { card: 0, bales: 0, t: 0, made: 0 }; var B = S.baler;
    if (B.t > 0 && powered()) { B.t -= dt; if (B.t <= 0) { B.t = 0; B.bales++; B.made++; sfx('crate'); toast('Bale made. Outbound trucks take them away at ' + money(BALE_PRICE) + ' each.', 'good'); logEvent('The baler made a bale of cardboard'); screenDirtyAll(); } }
    var a = MACH.baler.anim; if (a) { a.ram.position.y = 3.6 - (B.t > 0 ? Math.abs(Math.sin((8 - B.t) / 8 * Math.PI * 2)) * 0.5 : 0); a.bales.forEach(function (bg, i) { bg.visible = i < B.bales; }); }
    lampSet(MACH.baler, balerStatus());
  }
  function balerScreenDraw(c, sc) { var B = S.baler; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'BALER', balerStatus().toUpperCase()); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, 46, sc.w - 32, 12); c.fillStyle = B.card >= BALE_NEED ? '#5fd38d' : '#f5b53d'; c.fillRect(16, 46, (sc.w - 32) * clamp(B.card / BALE_NEED, 0, 1), 12); scText(c, 16, 80, 'Chamber ' + B.card + ' / ' + BALE_NEED, '#eef1f5', 14); scText(c, 16, 100, 'Bales waiting ' + B.bales + ' · made ' + B.made, '#a0acb8', 12); scButton(sc, 16, 116, 110, 32, B.t > 0 ? Math.ceil(B.t) + ' s' : 'BALE', B.card >= BALE_NEED && !B.t, function () { balerUse(); }); scText(c, 16, 162, 'Trucks pay ' + money(BALE_PRICE) + ' a bale', '#6b7784', 11); }
  // the bales leave with every outbound truck
  function sellBales(t) { var B = S.baler; if (!B || !B.bales || t.dir !== 'out') return; var n = Math.min(4, B.bales); B.bales -= n; pay(n * BALE_PRICE, 'Cardboard bales collected, ' + n); logEvent(t.driver + ' took ' + n + ' bale' + (n > 1 ? 's' : '') + ' of cardboard: ' + money(n * BALE_PRICE), 'good'); screenDirtyAll(); }

  // ── The wrapper on the registry: status lamps, a screen, and a film roll that runs out
  var FILM_ROLL = 20, FILM_PRICE = 30;
  defMachine('wrapper', { prop: 'wrapper' });
  function wrapperStatus() { if (!powered()) return 'off'; if (!S.wrap || S.wrap.film <= 0) return 'jam'; return wrapperBusy() ? 'run' : 'idle'; }
  function wrapperScreenDraw(c, sc) { var W2 = S.wrap; scBg(c, sc.w, sc.h, 'rgba(120,189,245,0.18)'); scHead(c, sc.w, 'STRETCH WRAP', wrapperStatus().toUpperCase()); scText(c, 16, 70, wrapperBusy() ? 'Wrapping… ' + Math.ceil(wrapper.t) + ' s' : 'Bring a pallet on the jack', '#eef1f5', 14); scText(c, 16, 92, 'Film left: ' + W2.film + ' pallets · wrapped ' + W2.wrapped, W2.film > 3 ? '#a0acb8' : '#ff6b5e', 12); scButton(sc, 16, 110, 150, 32, 'NEW ROLL $' + FILM_PRICE, W2.film < FILM_ROLL && S.bank >= FILM_PRICE, function () { if (S.bank < FILM_PRICE) { sfx('bad'); return; } pay(-FILM_PRICE, 'Stretch film roll'); W2.film = FILM_ROLL; sfx('click'); toast('New film roll fitted', 'good'); }); }

  function tickMachines(dt) {
    if (!S.wrap) S.wrap = { film: FILM_ROLL, wrapped: 0 };
    tickBaler(dt); lampSet(MACH.wrapper, wrapperStatus());
    if (!S.pack) S.pack = { queue: [], job: null, jam: false, made: 0, feedT: 0, out: null };
    if (!S.factory) S.factory = { raw: 0, product: 'dccrate', on: false, made: 0, rawOrdered: 0, t: 0, jam: false };
    if (!S.pal) S.pal = { sku: null, n: 0 };
    tickBelts(dt); tickPack(dt); tickFactory(dt);
    if (MACH.hopper.anim && MACH.hopper.anim.tipT > 0) { var h = MACH.hopper.anim; h.tipT -= dt; h.feeder.position.x = Math.sin(worldTime * 40) * 0.01 * (h.tipT > 0 ? 1 : 0); }
    lampSet(MACH.palletiser, powered() ? (S.pal.n ? 'run' : 'idle') : 'off');
    if (world.wingLights) world.wingLights.forEach(function (l) { l.intensity = powered() ? 0.9 : 0; });
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
    if (player.tool !== 'jack' && player.tool !== 'cable' && jackPallet()) { /* a pallet on a parked jack is part of the jack: walk round it */ var jw = toolWorld('jack'); dyn.push({ x0: jw.x - 0.7, x1: jw.x + 0.7, z0: jw.z - 0.7, z1: jw.z + 0.7, y0: -1, y1: 1.5 }); }
  }
  function collides(x, z, ignoreFork) {
    var r = 0.32, y0 = player.y, y1 = player.y + 1.7;
    if (floorY(x, z) - player.y > 0.5) return true;
    for (var i = 0; i < solids.length; i++) { var s = solids[i]; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r && y0 < s.y1 && y1 > s.y0) return true; }
    for (var k = 0; k < dyn.length; k++) { var d = dyn[k]; if (d.fork && (driving || ignoreFork === 'fork')) continue; if (x > d.x0 - r && x < d.x1 + r && z > d.z0 - r && z < d.z1 + r && y0 < d.y1 && y1 > d.y0) return true; }
    return false;
  }
  function updatePlayer(dt) {
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
    var speed = 4.0 * (run ? 1.55 : 1) * (coffee ? 1.2 : 1) * (snack ? 1.1 : 1) * (player.tool === 'jack' && jackPallet() ? 0.78 : player.tool ? 0.92 : 1);
    var fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    var mx = 0, mz = 0;
    if (fwd || side) {
      var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
      mx = fx * fwd + rx * side; mz = fz * fwd + rz * side; var l = Math.sqrt(mx * mx + mz * mz); mx /= l; mz /= l;
      var nx = player.x + mx * speed * dt, nz = player.z + mz * speed * dt;
      if (!collides(nx, player.z)) player.x = nx;
      if (!collides(player.x, nz)) player.z = nz;
      player.stepT += speed * dt; player.bob += dt * (run ? 11 : 8);
      if (player.stepT > 2.1) { player.stepT = 0; sfx('step', floorY(player.x, player.z) < -0.5 ? 'outside' : insideHall(player.x, player.z) ? 'floor' : 'steel'); }
    } else player.bob *= Math.max(0, 1 - 8 * dt);
    var fy = floorY(player.x, player.z);
    if (k.Space && player.grounded && !player.jumped) { player.vy = 5.2; player.grounded = false; player.jumped = true; }
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
    return null;
  }
  function interact() {
    focus = null; focusText = '';
    if (!ui.started || ui.blocked() || driving) return;
    ray.setFromCamera(centre, camera);
    if (edit.on) {
      if (edit.grabbed) return;
      ray.far = 7; var ph = ray.intersectObjects(scene.children, true); ray.far = 3.4;
      for (var q = 0; q < ph.length; q++) { var pid = propIdOf(ph[q].object); if (!pid) continue; if (ph[q].object.userData.baked || !ph[q].object.visible) continue; var pdef = propDef(pid); if (!pdef) continue; focus = { editId: pid, prompt: function () { return ''; }, use: function () {} }; focusText = 'Grab the ' + pdef.label + '  ·  R turn · Backspace put back · Del remove'; return; }
      return;
    }
    var hits = ray.intersectObjects(inter.concat(instList), false);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], def = h.object.userData.it || srcDef(instSource(h));
      if (!def) continue;
      var txt = def.prompt(); if (!txt) continue;
      focus = def; focusText = txt; break;
    }
  }
  function useFocus() { if (edit.on) { if (edit.grabbed) editDrop(false); else if (focus && focus.editId) editGrab(focus.editId); return; } if (driving) { forkUse(); return; } if (focus) { focus.use(); sfx('click'); interact(); } }

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
    else if (e.code === 'KeyG') { if (driving) stopDrive(); else putDown(); }
  });
  document.addEventListener('keyup', function (e) { player.keys[e.code] = false; });
  document.addEventListener('wheel', function (e) { if (ui.scanOpen && !ui.blocked()) scanPage((scan.page + (e.deltaY > 0 ? 1 : 3)) % 4); }, { passive: true });
  window.addEventListener('blur', function () { player.keys = {}; });
  // ── The office PC ─────────────────────────────────────────────────
  var pc = { on: false, app: 'home', scroll: 0, saved: null, look: { yaw: 0, pitch: 0 }, screen: null };
  var PC_APPS = [['home', '🏠', 'Desktop'], ['orders', '📦', 'Orders'], ['contracts', '📝', 'Contracts'], ['shop', '🛒', 'Shop'], ['staff', '👷', 'Staff'], ['bank', '🏦', 'Bank'], ['stock', '🗄', 'Stock'], ['factory', '🏭', 'Production'], ['stats', '📊', 'Stats']];
  function openPc() {
    if (pc.on || driving) return;
    if (S.events.power) { toast('No power.', 'bad'); return; }
    pc.on = true; pc.app = pc.app || 'home'; pc.scroll = 0; pc.look.yaw = 0; pc.look.pitch = 0;
    pc.saved = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch };
    if (player.tool) releaseTool();
    sfx('click'); introStep('pc'); screenDirtyAll(); hudDirty = true;
    $('h-drive').hidden = false; $('h-drive').innerHTML = 'Office PC · aim at a button and <b>E</b> taps it · <b>Esc</b> or <b>WASD</b> stands up';
  }
  function closePc() { if (!pc.on) return; pc.on = false; $('h-drive').hidden = true; if (pc.saved) { player.x = pc.saved.x; player.z = pc.saved.z; player.yaw = pc.saved.yaw; player.pitch = pc.saved.pitch; } sfx('click'); hudDirty = true; }
  // where to sit: in front of the desk prop, facing the monitor
  function pcSeat() { var P = propPlacement('desk'), a = P.rot * Math.PI / 2, lx = 0, lz = -0.5; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), yaw: a + Math.PI }; }
  function pcCamera() { var s = pcSeat(); camera.position.set(s.x, 1.33, s.z); camera.rotation.set(-0.06 + pc.look.pitch, s.yaw + pc.look.yaw, 0, 'YXZ'); player.x = s.x; player.z = s.z; }
  function pcRows(sc, rows, y0, rowH) {
    var c = sc.ctx, maxRows = Math.floor((sc.h - y0 - 50) / rowH), start = clamp(pc.scroll, 0, Math.max(0, rows.length - maxRows)), y = y0;
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
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, h - 44, w, 44);
    PC_APPS.forEach(function (a, i) { scButton(sc, 8 + i * 98, h - 38, 92, 32, a[1] + ' ' + a[2], pc.app === a[0], function () { pc.app = a[0]; pc.scroll = 0; }, '#78bdf5'); });
    c.fillStyle = '#a0acb8'; c.font = '13px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText('Day ' + S.day + ' · ' + fmtTime(S.time), w - 10, h - 16); c.textAlign = 'left';
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
      var rows3 = UPGRADES.map(function (u) { var owned = u.id === 'row3' ? S.up.rows >= 3 : u.id === 'row4' ? S.up.rows >= 4 : !!S.up[u.id]; var needs = u.id === 'row4' && S.up.rows < 3 ? 'needs the third row' : S.level < u.lvl ? 'level ' + u.lvl : S.bank < u.price ? 'not enough money' : ''; return { text: u.name + (owned ? '  ·  owned' : ''), sub: u.desc, right: money(u.price), btn: owned ? null : { label: needs ? needs.toUpperCase().slice(0, 14) : 'BUY', on: !needs, act: function () { if (!needs) buyUpgrade(u.id); }, col: '#5fd38d' } }; });
      pcRows(sc, rows3, 60, 50);
    } else if (app === 'staff') {
      scHead(c, w, 'STAFF', S.staff.length + ' of 5');
      var rows4 = Object.keys(STAFF_ROLES).map(function (r) { var d = STAFF_ROLES[r], locked = S.level < d.lvl; return { text: 'Hire a ' + d.name.toLowerCase() + '  ·  ' + money(d.wage / 10) + '/h', sub: d.desc, btn: { label: locked ? 'LEVEL ' + d.lvl : S.staff.length >= 5 ? 'FULL' : 'HIRE', on: !locked && S.staff.length < 5, act: function () { if (!locked && S.staff.length < 5) { hireStaff(r); toast('Hired a ' + d.name.toLowerCase(), 'good'); } }, col: '#5fd38d' } }; });
      S.staff.forEach(function (st) { var sheet = st.sheet || [], hrs = sheet.reduce(function (a, r) { return a + r.h; }, 0), paid = sheet.reduce(function (a, r) { return a + r.pay; }, 0); rows4.push({ text: st.name + '  ·  ' + STAFF_ROLES[st.role].name + '  ·  ' + staffStatus(st), sub: 'today ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h · last 7 days ' + (Math.round(hrs * 10) / 10) + ' h, ' + money(paid) + ' · punctuality ' + Math.round((st.punct || 0.5) * 100) + '%' + (st.lateToday ? ' · late today' : ''), hi: !!st.clocked, btn: { label: 'LET GO', on: false, act: function () { fireStaff(st.id); }, col: '#ff6b5e' } }); });
      pcRows(sc, rows4, 60, 50);
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
      c.fillStyle = '#a0acb8'; c.font = '10px Bahnschrift, Arial'; c.fillText(used + ' / ' + (S.up.rows * RACK.bays * RACK.levels.length) + ' slots · ' + totalStock() + ' boxes', 12, y); y += 16;
      if (!keys.length) { c.fillStyle = '#6b7784'; c.font = '11px Bahnschrift, Arial'; c.fillText('The racks are empty.', 12, y + 10); }
      keys.slice(0, 8).forEach(function (k) { if (y > h - 20) return; y = scanRow(c, y, SKU[k].col, skuName(k), slotsWith(k).slice(0, 2).map(slotName).join(' · '), sum[k], true); });
    } else {
      c.fillStyle = '#a0acb8'; c.font = '10px Bahnschrift, Arial'; c.fillText('Day ' + S.day + ' · ' + SEASONS[season()] + (isSunday() ? ' · SUNDAY, closed' : '') + ' · ' + (S.weather ? S.weather.kind : 'clear'), 12, y); y += 16;
      y = scanRow(c, y, null, 'Inbound ' + TRUCK_IN.map(fmtTime).join(' & '), 'wait ' + TRUCK_WAIT + ' h · ' + (S.up.dock2 ? 'both bays' : 'IN 1'));
      y = scanRow(c, y, null, 'Outbound', TRUCK_OUT.map(function (w, i) { return 'OUT ' + (i + 1) + ' ' + fmtTime(w.arrive) + '-' + fmtTime(w.leave); }).join('  '));
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
    else if (player.tool) { held.hidden = false; held.innerHTML = (player.tool === 'jack' ? 'Pallet jack' + (jackPallet() ? ' · ' + jackPallet().n + ' × ' + skuName(jackPallet().sku) : ' (empty)') : 'Picking cart · ' + S.cart.boxes.length + ' / ' + ECON.cartCap + ' boxes') + '<small>G lets go</small>'; }
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
      var slotsTotal = S.up.rows * RACK.bays * RACK.levels.length, used = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length;
      h += '<div class="dc-sec">' + used + ' of ' + slotsTotal + ' slots in use · ' + totalStock() + ' boxes</div>';
      if (!keys.length) h += '<div class="dc-empty">The racks are empty.</div>';
      keys.forEach(function (k) { h += '<div class="dc-row">' + sw(k) + '<div class="n">' + esc(skuName(k)) + '<small>' + slotsWith(k).map(slotName).slice(0, 3).join(' · ') + (slotsWith(k).length > 3 ? ' +' + (slotsWith(k).length - 3) : '') + '</small></div><div class="q ok">' + sum[k] + '</div></div>'; });
    } else {
      h += '<div class="dc-sec">Day ' + S.day + ' · ' + fmtTime(S.time) + ' · level ' + S.level + ' · rep ' + Math.round(S.rep) + '</div>';
      h += '<div class="dc-row"><div class="n">Inbound trucks<small>' + TRUCK_IN.map(fmtTime).join(' and ') + (S.up.dock2 ? ' at both bays' : ' at IN 1') + ' · they wait ' + TRUCK_WAIT + ' hours</small></div></div>';
      h += '<div class="dc-row"><div class="n">Outbound trucks<small>' + TRUCK_OUT.map(function (w, i) { return 'OUT ' + (i + 1) + ': ' + fmtTime(w.arrive) + ' to ' + fmtTime(w.leave); }).join(' · ') + '</small></div></div>';
      S.trucks.forEach(function (t) { h += '<div class="dc-row hi"><div class="n">' + (t.dir === 'in' ? 'Inbound' : 'Outbound') + ' at ' + dockLabel(t.dir === 'in' ? t.dock : 2 + t.dock) + ' · ' + t.state + '<small>' + (t.dir === 'in' ? t.pallets.length + ' pallets from ' + esc(clientName(t.client)) : t.parcels.length + ' parcels loaded') + ' · leaves ' + fmtTime(t.leave) + '</small></div></div>'; });
      h += '<div class="dc-sec">Costs tonight</div><div class="dc-row"><div class="n">Rent<small>charged at 06:00</small></div><div class="q">' + money(ECON.rent) + '</div></div>';
      S.staff.forEach(function (st) { h += '<div class="dc-row"><div class="n">' + esc(st.name) + ' · ' + STAFF_ROLES[st.role].name + '<small>' + (staffOnShift() ? st.state : 'off shift, 08:00 to 18:00') + '</small></div><div class="q">' + money(STAFF_ROLES[st.role].wage) + '</div></div>'; });
    }
    $('dc-scan-body').innerHTML = h;
  }
  $('dc-scan-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-page]'); if (b) scanPage(+b.getAttribute('data-page')); });

  // ── Panels ────────────────────────────────────────────────────────
  var panel = { kind: null, tab: null };
  var PC_TABS = [['orders', 'Orders'], ['contracts', 'Contracts'], ['shop', 'Shop'], ['staff', 'Staff'], ['finance', 'Bank'], ['stock', 'Stock'], ['stats', 'Stats']];
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
        var needs = rowN && S.up.rows < rowN - 1 ? 'Needs the previous row first' : S.level < u.lvl ? 'Level ' + u.lvl : S.bank < u.price ? 'Not enough money' : '';
        h += '<div class="dc-card"><div class="body"><b>' + esc(u.name) + '</b><small>' + esc(u.desc) + '</small></div><div style="text-align:right"><div class="price">' + money(u.price) + '</div>' + (owned ? '<span class="dc-tag good">Owned</span>' : btn('buy', u.id, 'Buy', 'primary', !!needs) + (needs ? '<small style="display:block;color:var(--muted)">' + needs + '</small>' : '')) + '</div></div>';
      });
      h += '</div>';
    } else if (tab === 'staff') {
      h += '<p>Staff clock in at 08:00 and out at 18:00 (20:00 on overtime) and are paid at 06:00 for the hours on the clock, time and a half past ten. They need the dock doors opened for them: that stays your job.</p>';
      h += '<div class="dc-grid">' + Object.keys(STAFF_ROLES).map(function (r) { var d = STAFF_ROLES[r], locked = S.level < d.lvl, n = S.staff.filter(function (s) { return s.role === r; }).length; return '<div class="dc-card"><div class="body"><b>' + d.name + '</b>' + (n ? '<span class="dc-tag good">' + n + ' hired</span>' : '') + '<small>' + esc(d.desc) + '</small></div><div style="text-align:right"><div class="price">' + money(d.wage) + '/day</div>' + btn('hire', r, 'Hire', 'primary', locked || S.staff.length >= 5) + (locked ? '<small style="display:block;color:var(--muted)">Level ' + d.lvl + '</small>' : '') + '</div></div>'; }).join('') + '</div>';
      if (S.staff.length) h += '<h3>Your crew</h3>' + S.staff.map(function (st) { var sheet = st.sheet || [], hrs = sheet.reduce(function (a, r) { return a + r.h; }, 0), paid = sheet.reduce(function (a, r) { return a + r.pay; }, 0), lates = sheet.filter(function (r) { return r.late; }).length; return '<div class="dc-card"><div class="body"><b>' + esc(st.name) + '</b> · ' + STAFF_ROLES[st.role].name + ' · ' + money(hourly(st)) + '/h' + (st.lateToday ? ' <span class="dc-tag bad">late today</span>' : '') + (st.overtime ? ' <span class="dc-tag warn">overtime</span>' : '') + '<small>' + staffStatus(st) + ' · today ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h · last 7 days ' + (Math.round(hrs * 10) / 10) + ' h, ' + money(paid) + (lates ? ', late ×' + lates : '') + ' · punctuality ' + Math.round((st.punct || 0.5) * 100) + '%</small></div>' + btn('fire', st.id, 'Let go', 'danger') + '</div>'; }).join('');
      h += '<p>Hours come from the time clock by the staff door: nobody is paid for a day they did not clock in. Overtime, days off and a word about lateness are on the clock itself.</p>';
    } else if (tab === 'finance') {
      h += '<div class="dc-kpis"><div class="dc-kpi"><div class="k">Bank</div><div class="v" style="color:var(--cash)">' + money(S.bank) + '</div></div><div class="dc-kpi"><div class="k">Earned</div><div class="v">' + money(S.stats.earned) + '</div></div><div class="dc-kpi"><div class="k">Spent</div><div class="v">' + money(S.stats.spent) + '</div></div><div class="dc-kpi"><div class="k">Fines</div><div class="v">' + money(S.stats.fines) + '</div></div><div class="dc-kpi"><div class="k">Daily costs</div><div class="v">' + money(ECON.rent + S.staff.reduce(function (a, s) { return a + STAFF_ROLES[s.role].wage; }, 0)) + '</div></div></div>';
      h += '<h3>The bank</h3><div class="dc-grid"><div class="dc-card"><div class="body"><b>Loan</b><small>' + (S.loan > 0 ? money(S.loan) + ' outstanding · 1.5% a day (' + money(Math.round(S.loan * 0.015)) + ')' : 'Borrow $5,000 at 1.5% a day. Repay when you can.') + '</small></div>' + (S.loan > 0 ? btn('repay', '', 'Repay ' + money(Math.min(S.loan, Math.max(0, S.bank))), 'primary', S.bank <= 0) : btn('borrow', '', 'Borrow $5,000', 'primary', S.level < 2)) + '</div>' +
        '<div class="dc-card"><div class="body"><b>Theft insurance</b><small>$40 a day. Pays 80% of the value of anything that walks off at night.</small></div>' + btn('insure', '', S.insured ? 'Cancel' : 'Insure', S.insured ? '' : 'primary') + '</div></div>';
      h += '<table><tr><th>Day</th><th>Time</th><th>What</th><th class="r">Amount</th></tr>' + S.ledger.slice(0, 30).map(function (l) { return '<tr><td>' + l.day + '</td><td>' + l.t + '</td><td>' + esc(l.why) + '</td><td class="r" style="color:' + (l.n < 0 ? 'var(--red)' : 'var(--green)') + '">' + money(l.n) + '</td></tr>'; }).join('') + '</table>';
    } else if (tab === 'stock') {
      var sum = stockSummary(), keys = Object.keys(sum).sort();
      h += '<p>' + totalStock() + ' boxes on ' + S.up.rows + ' rows · ' + Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length + ' of ' + (S.up.rows * RACK.bays * RACK.levels.length) + ' slots used. A slot holds up to ' + ECON.slotCap + ' boxes of one line.</p>';
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
    h += '<h3>On the bench (' + benchCount() + ' / ' + ECON.benchCap + ')</h3>' + (keys.length ? keys.map(function (k) { return '<div class="dc-card"><div class="body">' + sw(k) + ' <b>' + esc(skuName(k)) + '</b> × ' + S.bench.boxes[k] + '</div>' + btn('takeback', k, 'Take one back', '', !!S.hand) + '</div>'; }).join('') : '<p>Nothing on the bench. Bring boxes from the racks, or unload a cart here.</p>');
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
    else if (a === 'tpIn') tp(-26.5, -14); else if (a === 'tpOut') tp(26.5, -14); else if (a === 'tpBench') tp(25.2, 5.2); else if (a === 'tpOffice') tp(25, 20.5); else if (a === 'tpBreak') tp(-26.5, -21.5); else if (a === 'tpYard') { tp(-30, 5); player.y = YARD_Y; } else if (a === 'tpGate') { tp(-72, -2); player.y = YARD_Y; }
    sfx('click'); hudDirty = true; rebuildBoardSoon(); screenDirtyAll(); if (ui.panelOpen) renderPanel();
  }
  function panelAct(act, arg) {
    if (act.indexOf('dev:') === 0) { devAct(act.slice(4)); return; }
    if (act === 'pack') { var o = orderById(arg); if (o && packOrder(o)) toast('Packed #' + o.num, 'good'); }
    else if (act === 'takeback') { if (!S.hand && benchTake(arg, 1)) { handSet({ kind: 'box', sku: arg }); sfx('pickup'); } }
    else if (act === 'buy' && panel.kind !== 'catalogue') buyUpgrade(arg);
    else if (act === 'hire') { var d = STAFF_ROLES[arg]; if (d && S.level >= d.lvl && S.staff.length < 5) { hireStaff(arg); toast('Hired a ' + d.name.toLowerCase(), 'good'); } }
    else if (act === 'fire') fireStaff(arg);
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
    if (owned || S.level < u.lvl || S.bank < u.price || (rowN && S.up.rows < rowN - 1)) { sfx('bad'); return; }
    pay(-u.price, 'Bought ' + u.name);
    if (rowN) { S.up.rows = rowN; buildRack(rowN - 1); } else S.up[id] = true;
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
    renderer.setPixelRatio(pr); renderer.shadowMap.enabled = SET.quality !== 'low'; sun.castShadow = SET.quality !== 'low';
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
      '<h3>Orders</h3><p>Orders arrive between 08:00 and 17:00 on the office PC, the wall board and the scanner. Each one lists lines and a due time, which is the departure of an outbound truck. Pick the boxes, put them on the packing bench, press E on the bench with empty hands and pack. The parcel appears on the shelf beside the bench.</p>' +
      '<h3>Shipping</h3><p>Outbound trucks wait at OUT 1 from 10:30 to 12:00 and OUT 2 from 16:00 to 18:00. Open the door, carry the parcel into the trailer and press E. Press E on the dock console to send a loaded truck early. You are paid when it leaves. Late orders pay half; a short order pays 60%.</p>' +
      '<h3>Doors and the cabinet</h3><p>The office, break room, staff entrance and fire exit have doors: <kbd>E</kbd> opens, <kbd>Shift+E</kbd> locks. The control cabinet by the office door switches the lights, every dock door, and night mode, which locks the lot. Unlocked at night means stock walks.</p>' +
      '<h3>Drivers</h3><p>Open the dock door and the driver walks in and waits beside it. Sign the delivery note (<kbd>E</kbd> on him) before anything comes off the truck. He will nag after two hours.</p>' +
      '<h3>The pack line and the production wing</h3><p>Boxes go on the bench as before, but packing is a machine now: pick an order on the bench terminal and the line feeds its boxes onto the infeed belt, the case taper closes them into one parcel, and the parcel rolls down the outfeed onto the shelf. It jams now and then: <kbd>E</kbd> on it clears the jam.</p><p>Through the strip curtain in the north wall is the production wing. Order pallets of raw granulate on the office PC (Production app); they come with the next inbound truck. Bring one on the jack to the hopper and <kbd>E</kbd> tips it in. Start the moulding line on its screen or with <kbd>E</kbd>, pick a product, and own-brand boxes come down the main belt into the hall, where the palletiser stacks them eight to a pallet and drops the pallet beside it. Rack it like any delivery. Clients start ordering your goods once they have seen them.</p>' +
      '<h3>Tools</h3><p>The pallet jack is yours from day one. The picking cart (shop) holds six boxes and picks straight off the racks. The forklift (shop, level 2) drives with WASD, lifts with R and F, and takes pallets to the top level. G gets off. It runs on a battery: take the cable off the charging point on the south wall, walk it to the forklift and E plugs it in; it charges only while plugged, and driving off pulls the plug. Flat, the forklift crawls. Wrap a pallet at the stretch wrapper before you drive it round corners, or it sheds boxes.</p>' +
      '<h3>Staff and the time clock</h3><p>From level 3 you can hire a receiver, a picker and a packer on the office PC. They walk in from the yard, clock in at the reader by the staff door, work, clock out at 18:00 and leave. Pay is their clocked hours at the hourly rate, time and a half past ten hours, paid at 06:00. Some drift in late: the clock screen lets you have a word, put them on overtime till 20:00, or give them tomorrow off. They call in sick now and then. You can clock in too: your hours are tracked and you get a shift report when you clock out. They will not open dock doors: that stays your job.</p>' +
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
  var lightT = 0;
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
    var power = !S.events.power, lamps = power && !S.flags.lightsOff ? (S.up.lights ? 0.8 : 0.55) : 0;
    hallLights.forEach(function (l) { l.intensity = lamps; });
    officeLight.intensity = power ? 0.5 : 0;
    MAT.lamp.color.setHex(power ? 0xfff6e4 : 0x3a3a3a); MAT.skylight.color.setHex(0xffffff); MAT.skylight.color.multiplyScalar(0.25 + day * 0.75);
    yardLights.forEach(function (l) { l.intensity = day < 0.5 && power && !S.flags.yardOff ? 0.6 : 0; });
    if (world.pcScreen) world.pcScreen.visible = power;
    shadowT += 0.1; if (shadowDirty || shadowT > 4) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowT = 0; }
  }

  // ── Events ────────────────────────────────────────────────────────
  var evT = 0;
  function tickEvents(dt) {
    evT += dt; if (evT < 1) return; var step = evT; evT = 0;
    if (S.events.power) { if (S.time >= S.events.powerUntil) { S.events.power = false; toast('The power is back.', 'good'); logEvent('Power restored by the grid'); sfx('breaker'); } }
    else if (S.level >= 2 && S.time >= 9 && S.time < 16 && Math.random() < step / HOUR_SEC * 0.05) { S.events.power = true; S.events.powerUntil = S.time + 1.5; toast('Power cut! The breaker is in the office.', 'bad'); logEvent('Power cut. Doors, PC and the coffee machine are dead until the breaker is reset.', 'bad'); sfx('power'); }
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
    ['load', 'Pick the parcel up, open dock <b>OUT 1</b> from its console, walk into the outbound trailer and press E. The truck waits there from 10:30 to 12:00.'],
    ['dispatch', 'Press E on the <b>DISPATCH</b> button of the OUT 1 console to send the truck now, or let it leave on schedule. You are paid when it goes.']
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
    if (driving && Math.abs(forkSpeed) > 0.1) { S.fork.batt = clamp(S.fork.batt - dt / 1500, 0, 1); if (S.fork.batt <= 0 && !S.flags.battDead) { S.flags.battDead = 1; toast('Forklift battery flat. Push it to the charger.', 'bad'); } }
    else if (forkCharging() && !S.events.power) { S.fork.batt = clamp(S.fork.batt + dt / 110, 0, 1); if (S.fork.batt >= 1 && S.flags.battDead) { S.flags.battDead = 0; toast('Forklift charged.', 'good'); } }
  }

  // ── The stretch wrapper ───────────────────────────────────────────
  // A wrapped pallet keeps its boxes on the forks round a fast corner; an unwrapped one sheds them. Wrap film is $2 a pallet.
  var wrapper = { t: 0, pallet: null };
  function wrapperBusy() { return wrapper.t > 0; }
  function wrapperPrompt() {
    if (wrapperBusy()) return 'Wrapping… ' + Math.ceil(wrapper.t) + ' s';
    if (S.events.power) return 'The wrapper is off: no power';
    if (S.wrap && S.wrap.film <= 0) return 'The film roll is finished: fit a new one on the screen';
    var p = jackPallet(); if (player.tool === 'jack' && p) return p.wrapped ? 'That pallet is already wrapped' : 'Wrap the pallet';
    return 'Stretch wrapper · bring a pallet on the jack';
  }
  function wrapperUse() {
    if (wrapperBusy() || S.events.power) return;
    var p = jackPallet(); if (!(player.tool === 'jack' && p) || p.wrapped) { sfx('bad'); return; }
    if (!S.wrap) S.wrap = { film: FILM_ROLL, wrapped: 0 }; if (S.wrap.film <= 0) { toast('The film roll is finished. Fit a new one on the wrapper screen.', 'bad'); sfx('bad'); return; }
    S.wrap.film--; S.wrap.wrapped++; wrapper.t = 5; wrapper.pallet = p.id; sfx('hydraulic'); addXp(3); screenDirtyAll();
  }
  var wrapInst = null;
  function tickWrapper(dt) {
    if (wrapper.t > 0) { wrapper.t -= dt; if (wrapper.t <= 0) { wrapper.t = 0; var p = palletById(wrapper.pallet); if (p) { p.wrapped = true; toast('Pallet wrapped', 'good'); sfx('tape'); if (dress.wrapper) burst(dress.wrapper.position.x, 1, dress.wrapper.position.z, 0xffffff, 10, 'out'); } } }
    if (!wrapInst) { var filmTex = tex(128, 256, function (c, w, h) { c.fillStyle = 'rgba(235,240,245,0.55)'; c.fillRect(0, 0, w, h); for (var i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,' + randf(0.05, 0.25) + ')'; c.fillRect(Math.random() * w, 0, randf(1, 4), h); } for (var y = 0; y < h; y += 34) { c.fillStyle = 'rgba(200,210,220,0.35)'; c.fillRect(0, y, w, 3); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(0, y + 4, w, 1); } }, 2, 1); wrapInst = new THREE.InstancedMesh(boxGeo(1.27, 1.0, 1.07), new THREE.MeshPhysicalMaterial({ map: filmTex, transparent: true, opacity: 0.55, roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1, depthWrite: false, side: THREE.DoubleSide }), 120); wrapInst.count = 0; wrapInst.frustumCulled = false; wrapInst.renderOrder = 1; scene.add(wrapInst); }
    var n = 0; S.pallets.forEach(function (p) { if (!p.wrapped || n >= 120) return; var w = palletWorld(p); if (!w) return; var hgt = Math.ceil(p.n / 4) * BOX.h + 0.02; _e.set(0, w.ry, 0); _q.setFromEuler(_e); _v2.set(1, hgt, 1); _m4.compose(_v.set(w.x, w.y + 0.14 + hgt / 2 - 0.01, w.z), _q, _v2); wrapInst.setMatrixAt(n++, _m4); });
    wrapInst.count = n; wrapInst.instanceMatrix.needsUpdate = true;
  }

  function tickLife(dt) {
    if (!ui.started || ui.blocked()) return;
    tickWeatherState(dt); tickRadio(); tickBattery(dt); tickWrapper(dt); tickCables(dt); tickMachines(dt);
  }
  // ── Boot ──────────────────────────────────────────────────────────
  var loaded = load();
  buildWorld(); buildTools(); buildScanner();
  S.trucks.forEach(buildTruckMesh); S.staff.forEach(buildStaffMesh);
  // a packed order whose parcel is nowhere (an old save, say) goes back to open with its boxes on the bench
  S.orders.forEach(function (o) { if ((o.state === 'packed' || o.state === 'loaded') && !parcelExists(o.id)) { o.state = 'open'; o.lines.forEach(function (l) { if (l.packed) benchAdd(l.sku, l.packed); l.packed = 0; }); } });
  if (S.jack.pallet && !palletById(S.jack.pallet)) S.jack.pallet = null;
  if (S.fork.pallet && !palletById(S.fork.pallet)) S.fork.pallet = null;
  updateHandMesh(); applySettings(); resize(); rebuildDyn(); drawBoard();
  if (!/nobake=1/.test(location.search)) bakeStatic();
  camera.position.set(12, 3.6, 0); camera.lookAt(0, 1.4, 0); if (!loaded) S.time = 10.5;
  $('dc-start-stats').innerHTML = loaded ? ['Day ' + S.day, 'Level ' + S.level, money(S.bank), Math.round(S.rep) + ' rep', S.stats.shipped + ' shipped'].map(function (s) { return '<span>' + s + '</span>'; }).join('') : ['New depot', money(ECON.start), '2 rack rows', 'a pallet jack'].map(function (s) { return '<span>' + s + '</span>'; }).join('');
  $('dc-start-note').textContent = loaded ? 'Slot ' + BOOT_SLOT + ' · last saved ' + (S.savedAt ? new Date(S.savedAt).toLocaleString() : 'never') : 'Slot ' + BOOT_SLOT + ' · the first truck is due at 07:30';

  function enter() {
    if (ui.started) return;
    ui.started = true; $('dc-start').hidden = true; $('dc-hud').hidden = false; hudDirty = true;
    lockPointer(); sfx('ok');
    if (!loaded) { logEvent('Welcome to Depot Co. Open dock IN 1: the first truck is due at 07:30.', 'rare'); save(); }
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
    doorAnim(dt); placeTools(dt); syncInstances(); lighting(dt); tickDressing(dt); tickYard(dt); tickLife(dt); tickBursts(dt); doorsTick(dt); drawScreens(dt); tickScanner(dt); editTick(); tickTimeClock(dt); tickPc(dt); for (var ai = 0; ai < animated.length; ai++) animated[ai](dt);
    interact(); updatePrompt(); updateHud(dt);
    renderFrame(dt);
    if (SET.fps) { fpsN++; fpsT += dt; if (fpsT >= 0.5) { $('h-fps').textContent = Math.round(fpsN / fpsT) + ' fps · ' + (post.calls || renderer.info.render.calls) + ' draws'; fpsN = 0; fpsT = 0; } }
  }
  requestAnimationFrame(frame);
  window.addEventListener('beforeunload', function () { if (ui.started) save(); });

  // ── The window handle: the main menu, and the smoke test ──────────
  window.DEPOT = {
    enter: enter, bootSlot: BOOT_SLOT, guideHtml: guideHtml, version: window.DEPOT_VERSION || 'dev',
    T: {
      get S() { return S; }, player: player, ui: ui, save: save,
      run: function (sec) { var n = Math.round(sec / 0.05); for (var i = 0; i < n; i++) { tickWorld(0.05); tickLife(0.05); doorAnim(0.05); placeTools(0.05); } syncInstances(); },
      setTime: function (h) { S.time = h; hudDirty = true; },
      spawnTruck: spawnTruck, signTruck: signTruck, truckById: truckById, truckAtDoor: truckAtDoor, truckMeshes: truckMeshes, doorPassable: doorPassable, truckLeave: truckLeave, setDoor: setDoor,
      palletById: palletById, palletUse: palletUse, palletPrompt: palletPrompt, storePallet: storePallet, findSlotFor: findSlotFor, newPallet: newPallet,
      slotKey: slotKey, slotUse: slotUse, slotPrompt: slotPrompt, stockCount: stockCount, totalStock: totalStock,
      grabTool: grabTool, releaseTool: releaseTool, toolWorld: toolWorld,
      genOrder: genOrder, orderById: orderById, benchAdd: benchAdd, benchUse: benchUse, packOrder: packOrder, canPack: canPack, shelfUse: shelfUse, loadUse: loadUse, consoleUse: consoleUse, consolePrompt: consolePrompt,
      hireStaff: hireStaff, fireStaff: fireStaff, buyUpgrade: buyUpgrade, startDrive: startDrive, stopDrive: stopDrive, forkUse: forkUse, forkTip: forkTip,
      handSet: handSet, putDown: putDown, interact: interact, useFocus: useFocus, focusText: function () { return focusText; },
      lookAt: function (x, y, z) { camera.position.set(player.x, player.y + 1.62, player.z); camera.lookAt(x, y, z); camera.updateMatrixWorld(true); player.yaw = Math.atan2(-(x - player.x), -(z - player.z)); player.pitch = Math.atan2(y - camera.position.y, Math.sqrt(dist2(x, z, player.x, player.z))); interact(); return focusText; },
      openPanel: openPanel, closePanel: closePanel, renderPanel: renderPanel, scanToggle: scanToggle, renderScan: renderScan, panelHtml: function () { return $('dc-panel-body').innerHTML; },
      sleepNow: sleepNow, flipBreaker: flipBreaker, inspection: inspection, prowlerCheck: prowlerCheck, drawBoard: drawBoard, introIndex: introIndex, floorY: floorY, collides: collides, route: route,
      cableUse: cableUse, cablePlugInto: cablePlugInto,
      hopperUse: hopperUse, moulderUse: moulderUse, balerUse: balerUse, addWaste: addWaste, palletiserEject: palletiserEject, packUse: packUse, beltItems: beltItems, beltSink: beltSink, BELTS: BELTS, MACH: MACH, inWing: inWing,
      openPc: openPc, closePc: closePc, pc: pc,
      myClock: myClock, staffNewDay: staffNewDay, payStaffWages: payStaffWages, staffStatus: staffStatus, hourly: hourly,
      editToggle: editToggle, editGrab: editGrab, editDrop: editDrop, editRotate: editRotate, editReset: editReset, editRemove: editRemove, editRestore: editRestore, editBuy: editBuy, propInst: propInst, PROPS: PROPS, edit: edit, buildProp: buildProp,
      addXp: addXp, counts: function () { return { draws: (post.calls || renderer.info.render.calls), inter: inter.length, dyn: dyn.length, baked: baked.draws, hidden: baked.hidden }; }
    }
  };
})();
