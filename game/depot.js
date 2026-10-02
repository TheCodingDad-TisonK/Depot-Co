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
  var SET = { sens: 1, invertY: false, quality: 'high', sound: true, vol: 0.8, fps: false, fov: 75 };
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
    { id: 'tyres',  name: 'Tyre sets',        col: '#111111', val: 120, tier: 4 }
  ];
  var SKU = {}; SKUS.forEach(function (s) { SKU[s.id] = s; });
  function skuName(id) { return SKU[id] ? SKU[id].name : id; }

  var CLIENTS = [
    { id: 'hardware', name: 'Kessler Hardware',  likes: ['paint', 'bolts', 'drills', 'lamps'] },
    { id: 'grocer',   name: 'Northgate Grocers', likes: ['cereal', 'coffee', 'soap'] },
    { id: 'toyshop',  name: 'Little Wonders',    likes: ['toys', 'books'] },
    { id: 'sports',   name: 'Fairlane Sports',   likes: ['shoes', 'tyres'] },
    { id: 'electro',  name: 'Volt & Co.',        likes: ['tv', 'lamps', 'drills'] },
    { id: 'office',   name: 'Pinecrest Offices', likes: ['lamps', 'coffee', 'books', 'paint'] }
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
    start: 600, rent: 110, receiveFee: 12, handling: 14, margin: 0.22, lateCut: 0.5, shortCut: 0.6,
    wage: { receiver: 85, picker: 85, packer: 75 },
    rowPrice: 950, cartPrice: 240, forkPrice: 2800, lightsPrice: 600, pcPrice: 0,
    jackPallet: 8, palletCap: 8, slotCap: 12, cartCap: 6, benchCap: 16
  };
  var UPGRADES = [
    { id: 'cart',   name: 'Picking cart',        price: ECON.cartPrice,  lvl: 1, desc: 'A trolley that holds six boxes. Grab it, pick straight onto it from the racks, and empty it onto the bench in one go.' },
    { id: 'row3',   name: 'Third rack row',      price: ECON.rowPrice,   lvl: 2, desc: 'Sixteen more hand-reachable slots and a top level for the forklift.' },
    { id: 'fork',   name: 'Forklift',            price: ECON.forkPrice,  lvl: 2, desc: 'Drive it, lift whole pallets, and reach the top level of every rack. Parks at the south wall.' },
    { id: 'row4',   name: 'Fourth rack row',     price: ECON.rowPrice,   lvl: 3, desc: 'The last rack row. The hall is full after this one.' },
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
  var HALL = { x: 20, z: 14, h: 7 };
  var RACK = { rows: [-6, -2, 2, 6], bays: 8, bayW: 3, x0: -12, depth: 1.2, levels: [0, 1.55, 3.3], top: 2 };   // levels: the y of the pallet base; top is forklift-only
  var DOCKS = { in: [{ z: -8 }, { z: 0 }], out: [{ z: -8 }, { z: 0 }], w: 3.6, h: 4.2 };
  var YARD_Y = -1.2;
  var TRAILER = { len: 12, w: 2.5, h: 2.7 };
  var SPOT = {
    bench: { x: 16.6, z: 5.2 }, benchOut: { x: 16.6, z: 7.2 },
    stageIn: { x: -16, z: -4 }, stageOut: { x: 16, z: -4 },
    pc: { x: 17.5, z: 11.8 }, breaker: { x: 19.7, z: 9.6 },
    cot: { x: -17.2, z: 12.2 }, coffee: { x: -19.4, z: 9.3 },
    jack: { x: -15, z: 4 }, cart: { x: -15, z: 6.5 }, fork: { x: 0, z: 10.5 },
    spawn: { x: -18.6, z: 11.2 }, staffDoor: { x: -20, z: 12 }, console0: { x: 19.7, z: -5.5 }, console1: { x: 19.7, z: 2.5 }
  };
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
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -36; sun.shadow.camera.right = 36; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; sun.shadow.camera.near = 1; sun.shadow.camera.far = 140; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  var hallLights = [];
  [[-10, -5], [0, -5], [10, -5], [-10, 5], [0, 5], [10, 5]].forEach(function (p) {
    var l = new THREE.PointLight(0xfff4e0, 0.55, 26, 2); l.position.set(p[0], 6.3, p[1]); scene.add(l); hallLights.push(l);
  });
  var officeLight = new THREE.PointLight(0xfff8ea, 0.5, 9, 2); officeLight.position.set(16.5, 3.2, 11); scene.add(officeLight);
  var breakLight = new THREE.PointLight(0xffe9c8, 0.35, 8, 2); breakLight.position.set(-16.5, 3.0, 11); scene.add(breakLight);
  var yardLights = [];
  [[-30, -8], [-30, 4], [30, -8], [30, 4]].forEach(function (p) { var l = new THREE.PointLight(0xffd9a0, 0.0, 30, 2); l.position.set(p[0], 6.5, p[1]); scene.add(l); yardLights.push(l); });

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
    asphalt: tex(512, 512, function (c, w, h) { c.fillStyle = '#3b3d40'; c.fillRect(0, 0, w, h); grain(c, w, h, 14000, 0.14); grain(c, w, h, 3000, 0.1, true); blotches(c, w, h, 3, 30, 110, true, 0.12); cracks(c, w, h, 5, 0.22); }, 40, 40),
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

  // ── Materials ─────────────────────────────────────────────────────
  var std = function (o) { return new THREE.MeshStandardMaterial(o); };
  var MAT = {
    floor: std({ map: TEX.concrete, roughness: 0.9, metalness: 0.03 }),
    yard: std({ map: TEX.asphalt, roughness: 0.95 }),
    grass: std({ map: TEX.grass, roughness: 1 }),
    wall: std({ map: TEX.corrugated, roughness: 0.6, metalness: 0.35 }),
    wallIn: std({ map: TEX.corrugated, roughness: 0.7, metalness: 0.25, color: 0xcfd6dd }),
    roof: std({ color: 0x3b4249, roughness: 0.9 }),
    roofIn: std({ color: 0x5c6670, roughness: 0.9, side: THREE.BackSide }),
    door: std({ map: TEX.corrugatedDoor, roughness: 0.55, metalness: 0.4 }),
    plaster: std({ map: TEX.plaster, roughness: 0.9 }),
    brick: std({ map: TEX.brick, roughness: 0.95 }),
    rack: std({ color: 0xcf6417, roughness: 0.55, metalness: 0.3 }),
    beam: std({ color: 0x2b5aa6, roughness: 0.5, metalness: 0.4 }),
    deck: std({ color: 0x6a737c, roughness: 0.7, metalness: 0.5 }),
    wood: std({ map: TEX.wood, roughness: 0.85 }),
    parcel: std({ map: TEX.parcel, roughness: 0.9 }),
    steel: std({ map: TEX.noiseMetal, roughness: 0.45, metalness: 0.6 }),
    steelDark: std({ color: 0x3a3f45, roughness: 0.5, metalness: 0.6 }),
    chrome: std({ color: 0xd8dde3, roughness: 0.18, metalness: 0.95 }),
    black: std({ color: 0x15171a, roughness: 0.8 }),
    plastic: std({ color: 0x2a2d33, roughness: 0.6 }),
    rubber: std({ color: 0x1d1f22, roughness: 0.95 }),
    rubberMat: std({ map: TEX.rubberMat, roughness: 0.95 }),
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
    forkYellow: std({ color: 0xf2b705, roughness: 0.5, metalness: 0.3 }),
    truckRed: std({ color: 0xb8322a, roughness: 0.5, metalness: 0.3 }),
    truckBlue: std({ color: 0x2c5f9e, roughness: 0.5, metalness: 0.3 }),
    trailer: std({ map: TEX.corrugated, color: 0xf0f2f4, roughness: 0.6, metalness: 0.2 }),
    trailerIn: std({ color: 0x9aa0a6, roughness: 0.8, side: THREE.BackSide }),
    skin: std({ color: 0xd9a98a, roughness: 0.8 }),
    hivis: std({ color: 0xf6c21b, roughness: 0.8 }),
    hivisOrange: std({ color: 0xf07a1a, roughness: 0.8 }),
    jeans: std({ color: 0x2e3f63, roughness: 0.95 }),
    hair: std({ color: 0x3a2a1c, roughness: 0.95 }),
    hit: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  };
  function glowMat(col, k) { var m = std({ color: 0x111111, emissive: col, emissiveIntensity: k || 1, roughness: 0.4 }); m.userData.glow = true; return m; }
  var CARD = {}; SKUS.forEach(function (s) { CARD[s.id] = std({ map: cardboardTex(s.col, s.name), roughness: 0.9 }); });
  // the environment map is for reflections only: every lit material takes very little light from it
  function dimEnv(m) { if (m && m.isMeshStandardMaterial) m.envMapIntensity = 0.22; return m; }
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
  function rackSlotPos(r, b, l) { return { x: RACK.x0 + RACK.bayW * (b + 0.5), y: RACK.levels[l], z: RACK.rows[r] }; }
  function slotName(key) { var p = slotParse(key); return 'Row ' + 'ABCD'[p.r] + ', bay ' + (p.b + 1) + (p.l === 0 ? ', floor' : p.l === 1 ? ', shelf' : ', top'); }
  function rowName(r) { return 'Row ' + 'ABCD'[r]; }

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
    // the north wall has the fire exit cut out of it at x 13.4 to 14.6
    box(X + 13.4 + 0.15, H, 0.3, MAT.wall, (-X - 0.15 + 13.4) / 2, H / 2, -Z); solid(-X - 0.15, 13.4, -Z - 0.15, -Z + 0.15);
    box(X - 14.6 + 0.15, H, 0.3, MAT.wall, (14.6 + X + 0.15) / 2, H / 2, -Z); solid(14.6, X + 0.15, -Z - 0.15, -Z + 0.15);
    box(1.2, H - 2.3, 0.3, MAT.wall, 14, 2.3 + (H - 2.3) / 2, -Z); solid(13.4, 14.6, -Z - 0.15, -Z + 0.15, 2.3, 9);
    box(2 * X + 0.3, H, 0.3, MAT.wall, 0, H / 2, Z); solid(-X - 0.15, X + 0.15, Z - 0.15, Z + 0.15);
    // roof with skylight strips, and the trusses under it
    box(2 * X + 0.6, 0.3, 2 * Z + 0.6, MAT.roof, 0, H + 0.15, 0);
    plane(2 * X, 2 * Z, MAT.roofIn, 0, H - 0.01, 0, Math.PI / 2);
    [-7, 0, 7].forEach(function (z) { var sk = plane(2 * X - 4, 1.6, MAT.skylight, 0, H - 0.02, z, Math.PI / 2); world.lampMeshes.push(sk); });
    for (var tx = -16; tx <= 16; tx += 8) { box(0.25, 0.6, 2 * Z - 0.4, MAT.steelDark, tx, H - 0.35, 0); }
    // high-bay lamps under the trusses
    hallLights.forEach(function (l) { var m = box(0.9, 0.12, 0.5, MAT.lamp, l.position.x, l.position.y + 0.3, l.position.z); world.lampMeshes.push(m); cyl(0.03, 0.4, MAT.steelDark, l.position.x, l.position.y + 0.55, l.position.z); });
    // floor markings: aisles, the walkway, the staging squares
    function lineX(x0, x1, z, w) { plane(x1 - x0, w || 0.1, MAT.yellowLine, (x0 + x1) / 2, 0.006, z, -Math.PI / 2); }
    function lineZ(z0, z1, x, w) { plane(w || 0.1, z1 - z0, MAT.yellowLine, x, 0.006, (z0 + z1) / 2, -Math.PI / 2); }
    function square(cx, cz, s) { lineX(cx - s / 2, cx + s / 2, cz - s / 2); lineX(cx - s / 2, cx + s / 2, cz + s / 2); lineZ(cz - s / 2, cz + s / 2, cx - s / 2); lineZ(cz - s / 2, cz + s / 2, cx + s / 2); }
    square(SPOT.stageIn.x, SPOT.stageIn.z, 3.4); square(SPOT.stageOut.x, SPOT.stageOut.z, 3.4);
    lineX(-X + 0.3, 12.2, 8.2); lineX(-X + 0.3, 12.2, 9.4);                       // the pedestrian walkway along the south strip
    lineZ(-Z + 0.3, Z - 0.3, -12.9); lineZ(-Z + 0.3, Z - 0.3, 12.9);              // the rack block edges
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
    yardLights.forEach(function (l) { cyl(0.08, 7.5, MAT.steelDark, l.position.x, YARD_Y + 3.75, l.position.z, null, 8, 0.11); box(0.6, 0.2, 0.3, MAT.steelDark, l.position.x, l.position.y + 0.15, l.position.z); var lens = box(0.5, 0.04, 0.24, glowMat(0xffd9a0, 0.2), l.position.x, l.position.y + 0.03, l.position.z); yard.lampLenses.push(lens); });
    // the pallet racks the player owns
    for (var r = 0; r < 4; r++) if (r < S.up.rows) buildRack(r);
    buildOffice(); buildBench(); buildBreakRoom(); buildBreakCorner();
    hingedDoor('office', 12.5, 9.45, false, 'the office door', { window: true, swing: 1 });
    hingedDoor('break', -12.5, 9.45, false, 'the break room door', { window: true, swing: -1 });
    hingedDoor('staff', -X, SPOT.staffDoor.z - 0.5, false, 'the staff door', { mat: MAT.steelDark, swing: 1 });
    hingedDoor('exit', 13.5, -Z, true, 'the fire exit', { mat: MAT.steelDark, pushbar: true, swing: 1 });
    buildYard(); buildDressing(); buildControlCabinet();
  }

  function buildDoor(i, side, z) {
    var x = side * HALL.x;
    var panel = new THREE.Mesh(boxGeo(0.12, DOCKS.h, DOCKS.w), MAT.door); panel.castShadow = true; panel.receiveShadow = true;
    panel.position.set(x - side * 0.22, DOCKS.h / 2, z); scene.add(panel);
    var d = { i: i, side: side, z: z, panel: panel, anim: S.doors[i] ? 1 : 0 };
    addInter(panel, { prompt: function () { return S.doors[i] ? null : (S.events.power ? 'No power: the door motor is dead' : 'Open dock door ' + dockLabel(i)); }, use: function () { if (!S.events.power) setDoor(i, true); else toast('No power. Flip the breaker in the office.', 'bad'); } });
    // the push-button box beside the door
    var ctl = box(0.1, 0.3, 0.2, MAT.steelDark, x - side * 0.2, 1.3, z + DOCKS.w / 2 + 0.4);
    box(0.04, 0.08, 0.08, MAT.green, x - side * 0.26, 1.36, z + DOCKS.w / 2 + 0.4); box(0.04, 0.08, 0.08, MAT.red, x - side * 0.26, 1.24, z + DOCKS.w / 2 + 0.4);
    addInter(ctl, { prompt: function () { return S.events.power ? 'No power' : (S.doors[i] ? 'Close dock door ' + dockLabel(i) : 'Open dock door ' + dockLabel(i)); }, use: function () { if (S.events.power) { toast('No power. Flip the breaker in the office.', 'bad'); return; } setDoor(i, !S.doors[i]); } });
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

  function buildRack(r) {
    if (rackGroups[r]) return;
    var g = new THREE.Group(); scene.add(g); rackGroups[r] = g;
    var z = RACK.rows[r], x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05;
    for (var b = 0; b <= RACK.bays; b++) {
      var ux = x0 + b * bw;
      [-dz, dz].forEach(function (oz) { box(0.1, 5, 0.1, MAT.rack, ux, 2.5, z + oz, g); box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, z + oz, g); for (var hh = 0.3; hh < 4.9; hh += 0.35) box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, z + oz, g); });
      for (var br = 0; br < 5; br++) { var yb = 0.4 + br * 1.0; box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, z, g); var dg = box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, z, g); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
    }
    for (var l = 1; l < RACK.levels.length; l++) {
      var y = RACK.levels[l];
      box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, z - dz, g); box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, z + dz, g);
      for (var bp = 0; bp <= RACK.bays; bp++) { box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, z - dz, g); box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, z + dz, g); }
      for (var bb2 = 0; bb2 < RACK.bays; bb2++) { var dk = plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, z, -Math.PI / 2, 0, g); dk.receiveShadow = false; box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, z - 0.3, g); box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, z + 0.3, g); }
    }
    for (var bb = 0; bb < RACK.bays; bb++) {
      var cx = x0 + (bb + 0.5) * bw;
      var lbl = 'ABCD'[r] + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#f5b53d' });
      var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
      [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, 4.75, z + s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; g.add(p); });
      for (var ll = 0; ll < RACK.levels.length; ll++) (function (rr, b2, l2) {
        var key = slotKey(rr, b2, l2), sp = rackSlotPos(rr, b2, l2), hh = l2 === 2 ? 1.6 : 1.45;
        slotHits[key] = hitBox(bw - 0.2, hh, RACK.depth, sp.x, sp.y + hh / 2, sp.z, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } }, g);
      })(r, bb, ll);
    }
    solid(x0 - 0.1, x0 + RACK.bays * bw + 0.1, z - RACK.depth / 2, z + RACK.depth / 2);
    rackEnds(r); NAV.dirty = true;
    shadowDirty = true;
  }

  function buildOffice() {
    var x0 = 12.5, z0 = 8.5, X = HALL.x, Z = HALL.z, h = 3.2;
    // the wall along x = x0 with a doorway, the wall along z = z0 with a window, and a ceiling
    box(0.15, h, 0.8, MAT.plaster, x0, h / 2, z0 + 0.4); box(0.15, h, Z - 10.6, MAT.plaster, x0, h / 2, 10.6 + (Z - 10.6) / 2); box(0.15, h - 2.2, 1.3, MAT.plaster, x0, 2.2 + (h - 2.2) / 2, 9.95);
    solid(x0 - 0.08, x0 + 0.08, z0, 9.3); solid(x0 - 0.08, x0 + 0.08, 10.6, Z);
    box(1.5, h, 0.15, MAT.plaster, x0 + 0.75, h / 2, z0); box(2, h, 0.15, MAT.plaster, X - 1, h / 2, z0);
    box(X - 1.5 - x0, 1.1, 0.15, MAT.plaster, (x0 + 1.5 + X - 2) / 2, 0.55, z0); box(X - 1.5 - x0, h - 2.3, 0.15, MAT.plaster, (x0 + 1.5 + X - 2) / 2, 2.3 + (h - 2.3) / 2, z0);
    box(X - 1.5 - x0, 1.2, 0.04, MAT.glass, (x0 + 1.5 + X - 2) / 2, 1.7, z0);
    solid(x0, X, z0 - 0.08, z0 + 0.08);
    box(X - x0, 0.12, Z - z0, MAT.plaster, (x0 + X) / 2, h + 0.06, (z0 + Z) / 2);
    plane(X - x0 - 0.2, Z - z0 - 0.2, MAT.tile, (x0 + X) / 2, h - 0.01, (z0 + Z) / 2, Math.PI / 2);
    var lamp = box(1.2, 0.08, 0.3, MAT.lamp, 16.5, h - 0.05, 11); world.officeLamp = lamp;
    sign(['OFFICE'], 1.4, 0.45, x0 - 0.09, 2.6, 9.95, -Math.PI / 2, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' });
    // desk, chair, PC, cabinet
    box(2.2, 0.06, 0.8, MAT.wood, SPOT.pc.x, 0.75, SPOT.pc.z + 0.6); [[-1, -0.3], [1, -0.3], [-1, 0.3], [1, 0.3]].forEach(function (o) { box(0.05, 0.75, 0.05, MAT.steelDark, SPOT.pc.x + o[0] * 1.05, 0.375, SPOT.pc.z + 0.6 + o[1]); });
    solid(SPOT.pc.x - 1.1, SPOT.pc.x + 1.1, SPOT.pc.z + 0.2, SPOT.pc.z + 1);
    box(0.3, 0.05, 0.25, MAT.steelDark, SPOT.pc.x, 0.8, SPOT.pc.z + 0.8); cyl(0.03, 0.25, MAT.steelDark, SPOT.pc.x, 0.9, SPOT.pc.z + 0.85);
    var mon = box(0.8, 0.5, 0.04, MAT.black, SPOT.pc.x, 1.25, SPOT.pc.z + 0.85);
    world.pcScreen = plane(0.74, 0.44, new THREE.MeshBasicMaterial({ map: textTex(['DEPOT OS', 'press E'], { w: 256, h: 160, bg: '#0d1b2a', fg: '#78bdf5', size: 40 }) }), SPOT.pc.x, 1.25, SPOT.pc.z + 0.825, 0, Math.PI);
    box(0.45, 0.03, 0.15, MAT.steelDark, SPOT.pc.x - 0.1, 0.8, SPOT.pc.z + 0.45); box(0.1, 0.03, 0.06, MAT.steelDark, SPOT.pc.x + 0.5, 0.8, SPOT.pc.z + 0.45);
    hitBox(1.2, 1.0, 0.6, SPOT.pc.x, 1.1, SPOT.pc.z + 0.7, { prompt: function () { return S.events.power ? 'The PC is off: no power' : 'Use the office PC'; }, use: function () { if (S.events.power) { toast('No power.', 'bad'); return; } openPc(); } });
    box(0.5, 0.06, 0.5, MAT.black, SPOT.pc.x, 0.5, SPOT.pc.z - 0.2); cyl(0.04, 0.5, MAT.steelDark, SPOT.pc.x, 0.25, SPOT.pc.z - 0.2); box(0.5, 0.5, 0.06, MAT.black, SPOT.pc.x, 0.78, SPOT.pc.z - 0.45);
    box(0.5, 1.3, 0.6, MAT.grey, 19.6, 0.65, 13.5); box(0.5, 1.3, 0.6, MAT.grey, 19.0, 0.65, 13.5);
    solid(18.7, 19.9, 13.1, 14);
    // the breaker panel on the east wall
    var brk = box(0.12, 0.6, 0.4, MAT.grey, HALL.x - 0.21, 1.5, SPOT.breaker.z); box(0.03, 0.12, 0.06, MAT.red, HALL.x - 0.28, 1.5, SPOT.breaker.z);
    addInter(brk, { prompt: function () { return S.events.power ? 'Reset the breaker' : 'Breaker panel (power is on)'; }, use: function () { flipBreaker(); } });
    sign(['MAIN BREAKER'], 0.6, 0.15, HALL.x - 0.22, 1.9, SPOT.breaker.z, -Math.PI / 2, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' });
    // the order board: a wall screen the whole hall can read, on the office's north wall facing the floor
    var c = document.createElement('canvas'); c.width = 768; c.height = 384; world.boardCtx = c.getContext('2d');
    world.boardTex = new THREE.CanvasTexture(c); world.boardTex.encoding = THREE.sRGBEncoding; world.boardMat = new THREE.MeshBasicMaterial({ map: world.boardTex });
    box(3.1, 1.6, 0.08, MAT.black, 16.2, 2.1, z0 - 0.12);
    var board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); board.position.set(16.2, 2.1, z0 - 0.17); board.rotation.y = Math.PI; scene.add(board);
    drawBoard();
  }

  function buildBench() {
    var bx = SPOT.bench.x, bz = SPOT.bench.z;
    box(1.0, 0.08, 3.2, MAT.wood, bx, 0.9, bz); [[-0.45, -1.5], [0.45, -1.5], [-0.45, 1.5], [0.45, 1.5]].forEach(function (o) { box(0.06, 0.9, 0.06, MAT.steelDark, bx + o[0], 0.45, bz + o[1]); });
    box(0.9, 0.04, 3.0, MAT.steelDark, bx, 0.3, bz);
    solid(bx - 0.5, bx + 0.5, bz - 1.6, bz + 1.6);
    box(0.25, 0.12, 0.12, MAT.red, bx - 0.3, 1.0, bz - 1.3); cyl(0.07, 0.1, MAT.white, bx - 0.3, 1.02, bz - 1.3);   // tape gun
    box(0.3, 0.05, 0.3, MAT.steelDark, bx + 0.25, 0.965, bz - 1.35); plane(0.2, 0.1, MAT.screen, bx + 0.25, 1.0, bz - 1.2, -0.6);   // scale
    cyl(0.02, 0.9, MAT.steelDark, bx - 0.4, 1.4, bz + 1.4); box(0.3, 0.08, 0.15, MAT.lamp, bx - 0.3, 1.85, bz + 1.4);   // lamp
    hitBox(1.1, 1.2, 3.2, bx, 1.4, bz, { prompt: function () { return benchPrompt(); }, use: function () { benchUse(); } });
    sign(['PACKING'], 1.8, 0.5, bx + 0.3, 2.6, bz, -Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' });
    // the parcel shelf: packed orders wait here until they go out
    var ox = SPOT.benchOut.x, oz = SPOT.benchOut.z;
    box(1.0, 0.06, 1.5, MAT.steelDark, ox, 0.6, oz + 0.3); [[-0.45, -0.4], [0.45, -0.4], [-0.45, 1.0], [0.45, 1.0]].forEach(function (o) { box(0.05, 0.6, 0.05, MAT.steelDark, ox + o[0], 0.3, oz + o[1]); });
    solid(ox - 0.5, ox + 0.5, oz - 0.5, oz + 1.1);
    // the two dock consoles by the outbound doors: dispatch a loaded truck early
    [SPOT.console0, SPOT.console1].forEach(function (p, i) {
      box(0.1, 0.5, 0.4, MAT.steelDark, p.x, 1.4, p.z); var scr = plane(0.3, 0.2, MAT.screen, p.x - 0.06, 1.5, p.z, 0, -Math.PI / 2);
      hitBox(0.3, 0.6, 0.5, p.x - 0.05, 1.4, p.z, { prompt: function () { return consolePrompt(2 + i); }, use: function () { consoleUse(2 + i); } });
      sign(['DOCK ' + dockLabel(2 + i)], 0.7, 0.18, p.x - 0.12, 1.85, p.z, -Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' });
    });
  }

  // the break room: the south-west corner, walled off like the office, with a window onto the floor and a door
  function buildBreakRoom() {
    var x0 = -12.5, z0 = 8.5, X = HALL.x, Z = HALL.z, h = 3.2;
    box(0.15, h, 0.8, MAT.plaster, x0, h / 2, z0 + 0.4); box(0.15, h - 2.2, 1.3, MAT.plaster, x0, 2.2 + (h - 2.2) / 2, 9.95);
    box(0.15, h, 0.6, MAT.plaster, x0, h / 2, 10.9); box(0.15, 1.1, 2.6, MAT.plaster, x0, 0.55, 12.5); box(0.15, h - 2.3, 2.6, MAT.plaster, x0, 2.3 + (h - 2.3) / 2, 12.5); box(0.04, 1.2, 2.6, MAT.glass, x0, 1.7, 12.5); box(0.15, h, 0.2, MAT.plaster, x0, h / 2, Z - 0.1);
    solid(x0 - 0.08, x0 + 0.08, z0, 9.3); solid(x0 - 0.08, x0 + 0.08, 10.6, Z);
    box(X + x0, h, 0.15, MAT.plaster, (-X + x0) / 2, h / 2, z0); solid(-X, x0, z0 - 0.08, z0 + 0.08);
    box(X + x0, 0.12, Z - z0, MAT.plaster, (-X + x0) / 2, h + 0.06, (z0 + Z) / 2);
    plane(X + x0 - 0.2, Z - z0 - 0.2, MAT.tile, (-X + x0) / 2, h - 0.01, (z0 + Z) / 2, Math.PI / 2);
    box(1.2, 0.08, 0.3, MAT.lamp, -16.5, h - 0.05, 11);
    for (var bl = 0; bl < 14; bl++) box(0.02, 0.05, 2.5, MAT.trim, x0 + 0.09, 2.26 - bl * 0.08, 12.5);
    sign(['BREAK ROOM'], 1.6, 0.45, x0 + 0.09, 2.6, 9.95, Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
    box(0.7, 1.75, 0.7, MAT.white, -16, 0.875, 9.0); box(0.03, 0.4, 0.03, MAT.chrome, -16.3, 1.2, 9.37); box(0.03, 0.3, 0.03, MAT.chrome, -16.3, 0.5, 9.37); solid(-16.4, -15.6, 8.6, 9.4);
  }
  function buildBreakCorner() {
    // a cot, a coffee machine on a counter, a locker, a water cooler, a fire extinguisher by the door
    var c = SPOT.cot;
    box(1.9, 0.12, 0.9, MAT.steelDark, c.x, 0.3, c.z); box(1.85, 0.18, 0.85, MAT.blue, c.x, 0.45, c.z); box(0.5, 0.1, 0.4, MAT.white, c.x - 0.6, 0.6, c.z);
    [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(function (o) { box(0.05, 0.3, 0.05, MAT.steelDark, c.x + o[0], 0.15, c.z + o[1]); });
    solid(c.x - 0.95, c.x + 0.95, c.z - 0.45, c.z + 0.45);
    world.cot = hitBox(1.9, 0.6, 0.9, c.x, 0.5, c.z, { prompt: function () { return cotPrompt(); }, use: function () { sleepNow(); } });
    var k = SPOT.coffee;
    box(1.4, 0.9, 0.6, MAT.grey, k.x, 0.45, k.z); solid(k.x - 0.7, k.x + 0.7, k.z - 0.3, k.z + 0.3);
    box(0.35, 0.5, 0.35, MAT.black, k.x, 1.15, k.z); box(0.3, 0.08, 0.1, MAT.red, k.x, 1.3, k.z + 0.2); plane(0.12, 0.08, MAT.screen, k.x, 1.2, k.z + 0.18);
    world.coffeeMachine = hitBox(0.5, 0.6, 0.5, k.x, 1.15, k.z, { prompt: function () { return S.events.power ? 'The coffee machine is off' : (buff.coffeeUntil > S.time && buff.coffeeDay === S.day ? 'Coffee is still working' : 'Have a coffee (walk faster for an hour)'); }, use: function () { drinkCoffee(); } });
    box(0.5, 0.6, 0.5, MAT.white, k.x + 0.5, 1.1, k.z); cyl(0.12, 0.3, MAT.glass, k.x + 0.5, 1.5, k.z);   // water cooler
    box(0.6, 1.8, 0.5, MAT.grey, -18.4, 0.9, 13.6); box(0.6, 1.8, 0.5, MAT.grey, -17.7, 0.9, 13.6); solid(-18.7, -17.4, 13.3, 14);
    box(0.9, 0.06, 0.9, MAT.wood, -14.5, 0.75, 12.5); cyl(0.04, 0.75, MAT.steelDark, -14.5, 0.375, 12.5); [[-0.6, 0], [0.6, 0]].forEach(function (o) { box(0.4, 0.04, 0.4, MAT.red, -14.5 + o[0], 0.45, 12.5 + o[1]); cyl(0.03, 0.45, MAT.steelDark, -14.5 + o[0], 0.22, 12.5 + o[1]); });
    
    sign(['BREAK ROOM'], 1.6, 0.45, -19.78, 2.6, 11, Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
    // a notice board with the day's schedule
    box(1.6, 1.0, 0.04, MAT.wood, -16.5, 1.9, 13.78);
    sign(['TRUCKS', 'IN 07:30 · 13:30', 'OUT 10:30-12 · 16-18'], 1.5, 0.9, -16.5, 1.9, 13.75, Math.PI, { w: 512, h: 320, bg: '#f5f1e6', fg: '#1b232c', size: 56 });
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
    if (Math.abs(x) < HALL.x && Math.abs(z) < HALL.z) return 0;
    for (var i = 0; i < S.trucks.length; i++) { var t = S.trucks[i]; if (t.state !== 'docked') continue; var b = trailerBounds(t); if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return 0; }
    if (x <= -HALL.x && x > -HALL.x - 7.2 && Math.abs(z - SPOT.staffDoor.z) < 1) return lerp(0, YARD_Y, (-HALL.x - x) / 7);
    return YARD_Y;
  }
  function insideHall(x, z) { return Math.abs(x) < HALL.x && Math.abs(z) < HALL.z; }
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
  function buildControlCabinet() {
    var x = 12.42, z = 12.6, g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -Math.PI / 2; scene.add(g);
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
    hitBox(0.9, 1.4, 0.3, 0, 1.45, -0.1, { prompt: function () { return null; }, use: function () {} }, g);
  }
  // ── Dressing ──────────────────────────────────────────────────────
  var dress = { fans: [], clocks: [], dockLamps: [], wrapper: null, kpiCtx: null, kpiTex: null, vending: null, radio: null, flag: null, charger: null };

  function wallClock(x, y, z, ry, r) {
    r = r || 0.32; var g = new THREE.Group(); g.userData.dynamic = true; g.position.set(x, y, z); g.rotation.y = ry || 0; scene.add(g);
    var face = cyl(r, 0.03, MAT.white, 0, 0, 0, g, 32); face.rotation.x = Math.PI / 2;
    var rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 32), MAT.steelDark); g.add(rim);
    for (var i = 0; i < 12; i++) { var t = box(i % 3 ? 0.015 : 0.03, i % 3 ? 0.04 : 0.07, 0.01, MAT.black, Math.sin(i / 12 * 6.283) * (r - 0.07), Math.cos(i / 12 * 6.283) * (r - 0.07), 0.02, g); t.rotation.z = -i / 12 * 6.283; }
    var hh = new THREE.Group(), mh = new THREE.Group(); hh.position.z = 0.025; mh.position.z = 0.03; g.add(hh); g.add(mh);
    box(0.035, r * 0.55, 0.01, MAT.black, 0, r * 0.22, 0, hh); box(0.025, r * 0.85, 0.01, MAT.black, 0, r * 0.37, 0, mh);
    cyl(0.03, 0.02, MAT.red, 0, 0, 0.035, g, 10).rotation.x = Math.PI / 2;
    dress.clocks.push({ h: hh, m: mh });
  }
  function tickClocks() { dress.clocks.forEach(function (c) { c.h.rotation.z = -(S.time / 12) * 6.283; c.m.rotation.z = -(S.time % 1) * 6.283; }); }

  function fireExtinguisher(x, z, ry) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; scene.add(g);
    cyl(0.08, 0.5, MAT.red, 0, 1.0, 0, g, 12); cyl(0.05, 0.08, MAT.black, 0, 1.28, 0, g, 10); box(0.03, 0.12, 0.1, MAT.black, 0, 1.36, 0.02, g); cyl(0.01, 0.3, MAT.black, 0.06, 1.05, 0.06, g, 6).rotation.x = 0.4;
    box(0.2, 0.04, 0.1, MAT.steelDark, 0, 0.72, -0.07, g);
    sign(['FIRE'], 0.3, 0.12, 0, 1.6, -0.08, 0, { w: 128, h: 48, bg: '#c8342a', fg: '#fff' }, g);
  }
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
    [-12, -4, 4, 12].forEach(function (x) { box(0.4, H, 0.4, MAT.steelDark, x, H / 2, -Z + 0.35); box(0.4, H, 0.4, MAT.steelDark, x, H / 2, Z - 0.35); });
    doors.forEach(function (d) { [-1, 1].forEach(function (s) { var bx = d.side * (X - 1.0), bz = d.z + s * (DOCKS.w / 2 + 0.5); cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, null, 10); cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, null, 10); }); });
    // the north wall: cable tray, sprinkler main, extractor fans, the exit door, the big clock, the painted name
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
    exitSign(14, 2.6, -Z + 0.2, 0); exitSign(-X + 0.2, 2.6, SPOT.staffDoor.z, Math.PI / 2); poster('exit', 0.6, 0.9, 15.2, 1.9, -Z + 0.17, 0);
    wallClock(0, 5.8, -Z + 0.3, 0, 0.5);
    sign(['DEPOT CO.'], 9, 1.6, 0, 4.4, -Z + 0.17, 0, { w: 1024, h: 192, bg: '#1b232c', fg: '#f5b53d' });
    sign(['RECEIVE · STORE · PICK · SHIP'], 7, 0.5, 0, 3.3, -Z + 0.17, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8' });
    // the rack block: end guards, load labels, aisle signs hanging from the roof, the walkway crossings at both ends
    [[-4, 'AISLE  A · B'], [0, 'AISLE  B · C'], [4, 'AISLE  C · D']].forEach(function (a) {
      sign([a[1]], 2.2, 0.5, 0, 5.4, a[0], 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); sign([a[1]], 2.2, 0.5, 0, 5.4, a[0], Math.PI, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' });
      cyl(0.006, 1.3, MAT.steelDark, -0.9, 6.3, a[0], null, 4); cyl(0.006, 1.3, MAT.steelDark, 0.9, 6.3, a[0], null, 4);
    });
    [-13.6, 13.6].forEach(function (x) { for (var z = -7; z <= 7; z += 0.7) plane(1.2, 0.35, MAT.whiteLine, x, 0.0065, z, -Math.PI / 2); });
    // dock lights beside every door, a wheel-chock pair inside, the lifting poster between the inbound doors
    doors.forEach(function (d) {
      var x = d.side * (X - 0.3), z = d.z - DOCKS.w / 2 - 0.5;
      box(0.5, 0.06, 0.06, MAT.steelDark, x + d.side * -0.2, 4.6, z); var lamp = box(0.18, 0.18, 0.18, glowMat(0xffb020, 0.4), x - d.side * 0.5, 4.5, z); dress.dockLamps.push({ m: lamp, door: d.i });
      box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.3); box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.6);
    });
    poster('lifting', 0.7, 1.05, -X + 0.17, 2.0, -4, Math.PI / 2); poster('forklift', 0.7, 1.05, 2.2, 2.0, Z - 0.17, Math.PI); poster('stacking', 0.7, 1.05, -6, 2.0, Z - 0.17, Math.PI);
    poster('safety', 0.7, 1.05, 12.42, 1.9, 11.5, -Math.PI / 2); poster('nosmoking', 0.6, 0.9, -X + 0.17, 2.0, 9.2, Math.PI / 2);
    // fire points, the hose reel, the first-aid box
    fireExtinguisher(-X + 0.35, -12, Math.PI / 2); fireExtinguisher(X - 0.35, -12, -Math.PI / 2); fireExtinguisher(13.2, 6.5, -Math.PI / 2); fireExtinguisher(-X + 0.35, 13.2, Math.PI / 2);
    var reel = cyl(0.32, 0.12, MAT.red, 0, 1.5, -Z + 0.3, null, 24); reel.rotation.x = Math.PI / 2; cyl(0.05, 0.3, MAT.steelDark, 0, 1.5, -Z + 0.22, null, 8).rotation.x = Math.PI / 2; sign(['HOSE REEL'], 0.7, 0.16, 0, 2.0, -Z + 0.17, 0, { w: 256, h: 64, bg: '#c8342a', fg: '#fff' });
    box(0.3, 0.3, 0.1, MAT.white, -14.3, 1.7, Z - 0.22); box(0.18, 0.05, 0.02, MAT.green, -14.3, 1.7, Z - 0.28); box(0.05, 0.18, 0.02, MAT.green, -14.3, 1.7, Z - 0.28);
    // receiving: a stack of empties, the baler and a bale; shipping: the stretch wrapper, a bin, a broom, a wet-floor sign
    for (var i = 0; i < 9; i++) box(1.2, 0.14, 1.0, MAT.wood, -17.6 + (i % 2) * 0.03, 0.07 + i * 0.145, -11.6 + (i % 3) * 0.02);
    sign(['EMPTIES'], 1.2, 0.3, -17.6, 1.6, -11.0, 0, { w: 256, h: 64, bg: '#2a2f36', fg: '#a0acb8' });
    // the cardboard baler: a steel chamber on a frame, the loading door with its handle, the ram cylinder on top, a control box with lamps
    box(1.3, 2.2, 1.1, MAT.green, -8, 1.1, -12.9); box(1.4, 0.1, 1.2, MAT.steelDark, -8, 0.05, -12.9); box(1.4, 0.08, 1.2, MAT.steelDark, -8, 2.24, -12.9);
    box(0.9, 0.9, 0.06, MAT.steelDark, -8, 0.9, -12.32); box(0.08, 0.5, 0.05, MAT.chrome, -7.65, 0.9, -12.27); box(0.9, 0.06, 0.06, MAT.hazard, -8, 1.4, -12.32); box(0.9, 0.5, 0.06, MAT.plastic, -8, 1.75, -12.32);
    cyl(0.14, 0.7, MAT.chrome, -8, 2.6, -12.9, null, 14); cyl(0.2, 0.3, MAT.steelDark, -8, 2.4, -12.9, null, 14); cyl(0.06, 0.5, MAT.black, -7.6, 2.5, -13.2, null, 8).rotation.x = 0.4;
    box(0.32, 0.42, 0.12, MAT.grey, -7.15, 1.7, -12.36); [[0xff3b30, -0.08], [0x39d353, 0.08]].forEach(function (lp) { var l = cyl(0.025, 0.02, glowMat(lp[0], 1.2), -7.15 + lp[1], 1.82, -12.29, null, 10); l.rotation.x = Math.PI / 2; }); box(0.06, 0.06, 0.03, MAT.red, -7.15, 1.62, -12.29); box(0.06, 0.06, 0.03, MAT.green, -7.05, 1.62, -12.29);
    sign(['BALER', 'cardboard only'], 0.9, 0.3, -8, 2.05, -12.33, 0, { w: 256, h: 96, bg: '#1b232c', fg: '#5fd38d', size: 34 }); sign(['CRUSH HAZARD'], 0.8, 0.14, -8, 0.3, -12.33, 0, { w: 256, h: 48, bg: '#f5b53d', fg: '#1a1205' });
    solid(-8.7, -7.3, -13.5, -12.3); box(1.0, 0.8, 0.8, MAT.parcel, -6.2, 0.4, -12.8); solid(-6.7, -5.7, -13.2, -12.4);
    var wg = new THREE.Group(); wg.userData.dynamic = true; wg.position.set(8, 0, -12.3); scene.add(wg); dress.wrapper = wg;
    // the stretch wrapper: a turntable with a ramp and chequer plate, the mast with its carriage and film roll, the control box
    var tt = cyl(0.95, 0.1, MAT.steelDark, 0, 0.05, 0, wg, 32); dress.turntable = tt; plane(1.7, 1.7, MAT.rubberMat, 0, 0.101, 0, -Math.PI / 2, 0, tt); for (var tk = 0; tk < 8; tk++) box(0.04, 0.02, 0.5, MAT.yellow, Math.sin(tk / 8 * 6.283) * 0.7, 0.105, Math.cos(tk / 8 * 6.283) * 0.7, tt).rotation.y = tk / 8 * 6.283;
    var rp = box(1.2, 0.1, 0.9, MAT.steelDark, 0, 0.03, 1.35, wg); rp.rotation.x = 0.11; box(0.35, 2.7, 0.35, MAT.blue, 0, 1.35, -1.15, wg); box(0.45, 0.12, 0.45, MAT.steelDark, 0, 0.06, -1.15, wg); box(0.1, 2.5, 0.05, MAT.chrome, -0.1, 1.4, -0.95, wg); box(0.1, 2.5, 0.05, MAT.chrome, 0.1, 1.4, -0.95, wg);
    var carr = new THREE.Group(); carr.position.set(0, 1.0, -0.8); wg.add(carr); dress.wrapCarriage = carr; box(0.5, 0.4, 0.3, MAT.steelDark, 0, 0, 0, carr); cyl(0.14, 0.52, MAT.white, 0.35, 0, 0.1, carr, 14); cyl(0.02, 0.6, MAT.chrome, 0.35, 0, 0.1, carr, 6); cyl(0.05, 0.3, MAT.rubber, -0.3, 0, 0.1, carr, 8);
    box(0.32, 0.45, 0.15, MAT.grey, 0, 2.0, -0.86, wg); plane(0.2, 0.12, MAT.screen, 0, 2.1, -0.78, 0, 0, wg); box(0.05, 0.05, 0.03, MAT.green, -0.08, 1.88, -0.78, wg); box(0.05, 0.05, 0.03, MAT.red, 0.08, 1.88, -0.78, wg); sign(['START'], 0.12, 0.05, -0.08, 1.82, -0.78, 0, { w: 128, h: 48, bg: '#1b232c', fg: '#5fd38d' }, wg);
    sign(['STRETCH WRAP'], 1.2, 0.25, 0, 2.5, -0.9, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#78bdf5' }, wg); solid(7, 9, -13.7, -11.3);
    hitBox(1.0, 2.4, 0.8, 0, 1.2, -1.05, { prompt: function () { return wrapperPrompt(); }, use: function () { wrapperUse(); } }, wg);
    cyl(0.3, 0.8, MAT.grey, 14.3, 0.4, 2.6, null, 16); cyl(0.32, 0.05, MAT.black, 14.3, 0.82, 2.6, null, 16); solid(14, 14.6, 2.3, 2.9);
    var broom = cyl(0.015, 1.3, MAT.wood, 14.6, 0.7, 2.95, null, 6); broom.rotation.z = 0.25; box(0.25, 0.08, 0.05, MAT.plastic, 14.75, 0.08, 2.95);
    [[-1, 0.3], [1, 0.3]].forEach(function (o) { var p = plane(0.4, 0.7, new THREE.MeshBasicMaterial({ map: textTex(['WET', 'FLOOR'], { w: 128, h: 192, bg: '#f5b53d', fg: '#111', size: 44 }), side: THREE.DoubleSide }), 12.0 + o[0] * 0.12, 0.35, 10.6, 0, o[0] * 0.3); p.rotation.x = o[0] * -0.25; });
    // the forklift bay, the tool bays and the charger on the south wall
    var bay = function (cx, cz, w, d, label) { plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz - d / 2, -Math.PI / 2); plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz + d / 2, -Math.PI / 2); plane(0.08, d, MAT.yellowLine, cx - w / 2, 0.0062, cz, -Math.PI / 2); plane(0.08, d, MAT.yellowLine, cx + w / 2, 0.0062, cz, -Math.PI / 2); plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex([label], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), cx, 0.0066, cz + d / 2 - 0.3, -Math.PI / 2); };
    bay(SPOT.fork.x, SPOT.fork.z, 2.6, 3.6, 'FORKLIFT'); bay(SPOT.jack.x, SPOT.jack.z, 1.6, 2.2, 'JACK'); bay(SPOT.cart.x, SPOT.cart.z, 1.8, 1.4, 'CART');
    var chg = box(0.5, 1.2, 0.3, MAT.grey, 0, 0.6, Z - 0.35); dress.charger = box(0.06, 0.06, 0.04, glowMat(0x5fd38d, 1.2), 0, 1.0, Z - 0.52); cyl(0.02, 1.6, MAT.black, 0.3, 0.4, Z - 0.6, null, 6).rotation.x = 0.9; sign(['CHARGER'], 0.6, 0.16, 0, 1.35, Z - 0.52, Math.PI, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' });
    // by the staff door: the time clock, the card rack, a rubber mat, coat hooks with vests
    box(0.3, 0.4, 0.12, MAT.grey, -X + 0.26, 1.5, 10.2); plane(0.16, 0.08, MAT.screen, -X + 0.33, 1.58, 10.2, 0, Math.PI / 2); box(0.03, 0.03, 0.08, MAT.red, -X + 0.33, 1.4, 10.2);
    box(0.08, 0.5, 0.5, MAT.steelDark, -X + 0.24, 1.5, 10.75); for (var k = 0; k < 6; k++) box(0.03, 0.14, 0.06, MAT.paper, -X + 0.3, 1.62 - (k % 3) * 0.14, 10.56 + Math.floor(k / 3) * 0.22);
    sign(['CLOCK IN'], 0.6, 0.16, -X + 0.21, 1.85, 10.5, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' });
    plane(1.4, 1.0, MAT.rubberMat, -X + 1.1, 0.004, SPOT.staffDoor.z, -Math.PI / 2);
    for (var hk = 0; hk < 4; hk++) { var hx = -16.8 + hk * 0.45; cyl(0.015, 0.1, MAT.chrome, hx, 1.75, Z - 0.24, null, 6).rotation.x = Math.PI / 2; if (hk !== 2) { box(0.36, 0.5, 0.06, hk === 1 ? MAT.hivisOrange : MAT.hivis, hx, 1.45, Z - 0.3); box(0.1, 0.06, 0.07, MAT.hivis, hx, 1.72, Z - 0.3); } }
    box(1.9, 0.04, 0.12, MAT.wood, -16.1, 1.82, Z - 0.26);
    // the break room: vending machine, fridge, microwave and kettle, the radio, a wall clock, a calendar, posters
    var vg = new THREE.Group(); vg.position.set(-13.2, 0, 13.4); scene.add(vg);
    box(0.95, 1.9, 0.8, MAT.blue, 0, 0.95, 0, vg); plane(0.6, 1.1, glowMat(0x9ad0ff, 0.35), -0.1, 1.15, -0.41, 0, Math.PI, vg); for (var vr = 0; vr < 4; vr++) for (var vc = 0; vc < 3; vc++) box(0.12, 0.16, 0.08, [MAT.red, MAT.green, MAT.yellow, MAT.white][(vr + vc) % 4], -0.3 + vc * 0.2, 0.75 + vr * 0.25, -0.38, vg);
    box(0.25, 0.9, 0.04, MAT.black, 0.3, 1.1, -0.41, vg); box(0.5, 0.25, 0.04, MAT.black, -0.1, 0.35, -0.41, vg); solid(-13.7, -12.7, 13, 13.8);
    dress.vending = hitBox(1.0, 1.9, 0.9, 0, 0.95, 0, { prompt: function () { return S.events.power ? 'The vending machine is dark' : 'Buy a snack ($3): walk faster for half an hour'; }, use: function () { buySnack(); } }, vg);
    sign(['SNACKS'], 0.7, 0.2, -0.1, 1.8, -0.42, Math.PI, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' }, vg);
    box(0.5, 0.3, 0.38, MAT.black, SPOT.coffee.x + 0.9, 1.05, SPOT.coffee.z - 0.05); plane(0.14, 0.1, MAT.screen, SPOT.coffee.x + 0.9, 1.08, SPOT.coffee.z + 0.15, 0, 0); cyl(0.08, 0.2, MAT.chrome, SPOT.coffee.x - 0.5, 1.0, SPOT.coffee.z, null, 12); cyl(0.045, 0.1, MAT.white, SPOT.coffee.x - 0.3, 0.95, SPOT.coffee.z + 0.15, null, 10); cyl(0.045, 0.1, MAT.red, SPOT.coffee.x - 0.2, 0.95, SPOT.coffee.z + 0.05, null, 10);
    var rg = new THREE.Group(); rg.position.set(SPOT.coffee.x + 0.45, 0.98, SPOT.coffee.z - 0.1); scene.add(rg); dress.radio = rg;
    box(0.36, 0.16, 0.14, MAT.plastic, 0, 0, 0, rg); plane(0.12, 0.1, MAT.rubberMat, -0.09, 0.0, 0.071, 0, 0, rg); plane(0.12, 0.04, glowMat(0xf5b53d, 0.3), 0.09, 0.02, 0.071, 0, 0, rg); cyl(0.005, 0.35, MAT.chrome, 0.15, 0.22, 0, rg, 4).rotation.z = -0.3; cyl(0.02, 0.02, MAT.black, 0.09, -0.04, 0.072, rg, 8).rotation.x = Math.PI / 2;
    hitBox(0.4, 0.2, 0.2, 0, 0, 0, { prompt: function () { return radioPrompt(); }, use: function () { radioUse(); } }, rg);
    wallClock(-15.6, 2.7, Z - 0.3, Math.PI, 0.28);
    box(0.4, 0.5, 0.02, MAT.paper, -14.6, 2.6, Z - 0.26); sign(['OCTOBER', '', '1  2  3  4  5  6  7', '8  9 10 11 12 13 14'], 0.36, 0.44, -14.6, 2.6, Z - 0.28, Math.PI, { w: 256, h: 320, bg: '#f3efe4', fg: '#1b232c', size: 34 });
    poster('rota', 0.6, 0.9, -12.6, 2.0, 11.0, -Math.PI / 2); poster('hands', 0.5, 0.75, -18.6, 2.6, Z - 0.17, Math.PI);
    // the office: a plant, a printer, a coat stand, blinds, the whiteboard, a certificate, desk clutter
    cyl(0.16, 0.3, MAT.plastic, 13.2, 0.15, 13.4, null, 12, 0.13); [[0, 0.5, 0, 0.22], [0.12, 0.62, 0.08, 0.16], [-0.1, 0.66, -0.06, 0.14], [0.02, 0.78, 0.05, 0.12]].forEach(function (s) { sphere(s[3], MAT.green, 13.2 + s[0], s[1], 13.4 + s[2]); });
    box(0.5, 0.25, 0.4, MAT.grey, 19.3, 1.42, 13.5); box(0.4, 0.03, 0.3, MAT.white, 19.3, 1.56, 13.45); cyl(0.03, 1.7, MAT.steelDark, 13.0, 0.85, 9.0, null, 8); [0, 1, 2].forEach(function (k) { cyl(0.012, 0.25, MAT.steelDark, 13.0, 1.6, 9.0, null, 4).rotation.z = Math.PI / 2 + k * 2.09; }); box(0.4, 0.45, 0.1, MAT.jeans, 13.05, 1.3, 9.1);
    for (var bl = 0; bl < 14; bl++) box(5.4, 0.05, 0.02, MAT.trim, 16.1, 2.26 - bl * 0.08, 8.58);
    var kb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), kpiBoard()); kb.position.set(19.78, 2.0, 11.5); kb.rotation.y = -Math.PI / 2; scene.add(kb); box(0.04, 1.08, 1.68, MAT.chrome, 19.82, 2.0, 11.5);
    box(0.02, 0.4, 0.3, MAT.wood, 19.8, 2.4, 13.3); sign(['CERTIFICATE', 'of registration', 'Depot Co. · 3PL'], 0.26, 0.36, 19.78, 2.4, 13.3, -Math.PI / 2, { w: 192, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 22 });
    cyl(0.04, 0.09, MAT.white, SPOT.pc.x + 0.7, 0.82, SPOT.pc.z + 0.5, null, 10); box(0.2, 0.01, 0.28, MAT.paper, SPOT.pc.x - 0.75, 0.785, SPOT.pc.z + 0.5); box(0.18, 0.08, 0.12, MAT.black, SPOT.pc.x + 0.8, 0.82, SPOT.pc.z + 0.85); cyl(0.01, 0.2, MAT.black, SPOT.pc.x + 0.8, 0.93, SPOT.pc.z + 0.85, null, 6).rotation.x = 0.6;
    poster('safety', 0.6, 0.9, 16.5, 2.1, Z - 0.17, Math.PI);
    // the crossing where the walkway meets the dock aprons, and the pedestrian route into the office
    plane(1.4, 0.08, MAT.yellowLine, 12.5, 0.0062, 9.95, -Math.PI / 2);
  }
  function rackEnds(r) {
    var z = RACK.rows[r];
    [-1, 1].forEach(function (s) {
      var x = s > 0 ? RACK.x0 + RACK.bays * RACK.bayW + 0.3 : RACK.x0 - 0.3;
      box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, z); box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, z - RACK.depth / 2 - 0.1); box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, z + RACK.depth / 2 + 0.1);
      sign(['MAX LOAD', '1000 kg / level', 'row ' + 'ABCD'[r]], 0.5, 0.5, x + s * 0.06, 1.6, z, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 34 });
    });
  }
  function buySnack() {
    if (S.events.power) { toast('No power.', 'bad'); return; }
    if (S.bank < 3) { toast('No change on you.', 'bad'); return; }
    pay(-3, 'Snack from the machine'); buff.snackDay = S.day; buff.snackUntil = S.time + 0.5; sfx('vend'); toast('Crisps. Faster for half an hour.', 'good'); burst(dress.vending.parent.position.x, 0.5, dress.vending.parent.position.z - 0.5, 0xf5b53d, 8, 'down');
  }
  function tickDressing(dt) {
    var power = !S.events.power;
    dress.fans.forEach(function (f) { f.rotation.z += dt * (power ? 9 : 0.5); });
    if (dress.turntable) dress.turntable.rotation.y += dt * (wrapperBusy() ? 1.4 : 0);
    if (dress.wrapCarriage) dress.wrapCarriage.position.y = wrapperBusy() ? 0.5 + Math.abs(Math.sin(worldTime * 0.9)) * 1.0 : 1.0;
    dress.dockLamps.forEach(function (l) { var d = doors[l.door]; var coming = S.trucks.some(function (t) { return (t.dir === 'in' ? t.dock : 2 + t.dock) === d.i && (t.state === 'coming' || t.state === 'leaving'); }); l.m.material.emissiveIntensity = coming ? (Math.sin(worldTime * 8) > 0 ? 2.2 : 0.2) : (S.doors[d.i] ? 1.2 : 0.2); });
    if (dress.charger) dress.charger.material.emissiveIntensity = power ? (forkCharging() ? (Math.sin(worldTime * 3) > 0 ? 1.5 : 0.4) : 1) : 0;
    tickClocks();
  }
  // ── The yard ──────────────────────────────────────────────────────
  var yard = { gates: [], guards: [], traffic: [], clouds: [], sunDisc: null, moon: null, puddles: [], rain: null, snow: null, flag: null, lampLenses: [], windT: 0 };
  var CAR_COLS = [0xb8322a, 0x2c5f9e, 0xd8dbdf, 0x2a2d33, 0x7a8691, 0xe0a02a, 0x4f6a3a];
  function carMesh(col) {
    var g = new THREE.Group(), paint = std({ color: col, roughness: 0.35, metalness: 0.5 });
    box(4.2, 0.55, 1.8, paint, 0, 0.55, 0, g); box(2.3, 0.6, 1.65, paint, -0.2, 1.1, 0, g);
    box(0.05, 0.5, 1.5, MAT.glass, 0.98, 1.1, 0, g).rotation.z = -0.5; box(0.05, 0.5, 1.5, MAT.glass, -1.38, 1.1, 0, g).rotation.z = 0.5; box(2.0, 0.45, 0.04, MAT.glass, -0.2, 1.1, 0.83, g); box(2.0, 0.45, 0.04, MAT.glass, -0.2, 1.1, -0.83, g);
    [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]].forEach(function (p) { var w = cyl(0.33, 0.22, MAT.rubber, p[0], 0.33, p[1], g, 14); w.rotation.x = Math.PI / 2; cyl(0.18, 0.23, MAT.chrome, p[0], 0.33, p[1], g, 10).rotation.x = Math.PI / 2; });
    box(0.06, 0.14, 0.3, MAT.lamp, 2.1, 0.6, 0.6, g); box(0.06, 0.14, 0.3, MAT.lamp, 2.1, 0.6, -0.6, g); box(0.06, 0.12, 0.3, MAT.red, -2.1, 0.6, 0.6, g); box(0.06, 0.12, 0.3, MAT.red, -2.1, 0.6, -0.6, g);
    box(0.4, 0.08, 1.2, MAT.black, -1.0, 0.28, 0, g); cyl(0.02, 0.4, MAT.black, -0.9, 1.5, 0.3, g, 4);
    return g;
  }
  function tree(x, z, s) {
    s = s || 1; cyl(0.12 * s, 2.6 * s, std({ color: 0x5b4634, roughness: 1 }), x, YARD_Y + 1.3 * s, z, null, 8, 0.18 * s);
    [[0, 3.2, 0, 1.3], [0.7, 2.7, 0.4, 0.9], [-0.6, 2.9, -0.5, 1.0], [0.1, 4.0, 0.2, 0.8]].forEach(function (b, i) { sphere(b[3] * s, std({ color: [0x3f6f2e, 0x5c8f44, 0x45752f, 0x6f9a4a][i], roughness: 1 }), x + b[0] * s, YARD_Y + b[1] * s, z + b[2] * s); });
  }
  function cloudTex() { return tex(256, 128, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 14; i++) { var r = randf(18, 42), x = randf(r, w - r), y = randf(r * 0.6, h - r * 0.6); var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } }); }
  function discTex(col) { return tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, col); g.addColorStop(0.45, col); g.addColorStop(0.6, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }

  function buildYard() {
    var X = HALL.x, Z = HALL.z;
    // the ground: grass to the horizon, the asphalt yard, the plinth the hall stands on, a lighter apron round it
    plane(600, 600, MAT.grass, 0, YARD_Y - 0.03, 0, -Math.PI / 2);
    plane(170, 124, MAT.yard, 0, YARD_Y, 0, -Math.PI / 2);
    box(2 * X + 0.6, 1.2, 2 * Z + 0.6, MAT.grey, 0, YARD_Y + 0.6, 0);
    // truck lanes to every dock: edge lines, a centre dash, and a hatched keep-clear apron
    doors.forEach(function (d) {
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
    function fenceRun(x0, z0, x1, z1) { var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz), n = Math.round(len / 4), ang = Math.atan2(dx, dz); for (var i = 0; i <= n; i++) { var t = i / n, px = x0 + dx * t, pz = z0 + dz * t; cyl(0.05, 2.3, MAT.steelDark, px, YARD_Y + 1.15, pz, null, 6); if (i < n) { var mp = plane(len / n, 2.1, MAT.mesh, x0 + dx * (t + 0.5 / n), YARD_Y + 1.1, z0 + dz * (t + 0.5 / n), 0, ang); mp.receiveShadow = false; } } box(Math.abs(dx) || 0.05, 0.05, Math.abs(dz) || 0.05, MAT.steelDark, (x0 + x1) / 2, YARD_Y + 2.25, (z0 + z1) / 2); }
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
      var guard = makeHuman({ vest: MAT.hivis, cap: true, capMat: MAT.black, shirt: MAT.jeans }); guard.position.set(hx, YARD_Y, hz - 0.2); guard.rotation.y = Math.PI; scene.add(guard); yard.guards.push({ g: guard, side: side });
    });
    // the staff car park, the smoking shelter, the dumpster, the flag
    for (var b = 0; b < 7; b++) plane(0.12, 5.5, MAT.whiteLine, -19 + b * 2.7, YARD_Y + 0.012, 21, -Math.PI / 2);
    plane(16.2, 0.12, MAT.whiteLine, -10.9, YARD_Y + 0.012, 18.25, -Math.PI / 2);
    [0, 1, 3, 4].forEach(function (k) { var c = carMesh(CAR_COLS[k % CAR_COLS.length]); c.position.set(-17.65 + k * 2.7, YARD_Y, 21.5); c.rotation.y = Math.PI / 2 + randf(-0.04, 0.04); scene.add(c); });
    cyl(0.04, 2.4, MAT.steelDark, -2, YARD_Y + 1.2, 18.5, null, 6); sign(['STAFF', 'PARKING'], 0.9, 0.6, -2, YARD_Y + 2.5, 18.5, 0, { w: 256, h: 160, bg: '#2c5f9e', fg: '#fff' });
    [[-24, 17], [-24, 21], [-21, 17], [-21, 21]].forEach(function (p) { cyl(0.05, 2.4, MAT.steelDark, p[0], YARD_Y + 1.2, p[1], null, 6); });
    box(3.6, 0.06, 4.6, MAT.glass, -22.5, YARD_Y + 2.45, 19); box(1.8, 0.06, 0.4, MAT.wood, -22.5, YARD_Y + 0.45, 20.6); [[-23.2], [-21.8]].forEach(function (p) { box(0.06, 0.45, 0.4, MAT.steelDark, p[0], YARD_Y + 0.22, 20.6); });
    cyl(0.12, 0.9, MAT.steelDark, -24.3, YARD_Y + 0.45, 17.4, null, 10); sign(['SMOKING', 'AREA'], 0.8, 0.5, -22.5, YARD_Y + 2.2, 16.8, 0, { w: 256, h: 160, bg: '#1b232c', fg: '#a0acb8' });
    box(1.8, 1.3, 1.2, std({ color: 0x2f5a3a, roughness: 0.7, metalness: 0.3 }), 24, YARD_Y + 0.65, 18); box(1.9, 0.1, 1.3, MAT.black, 24, YARD_Y + 1.33, 18); sign(['CARDBOARD', 'ONLY'], 1.2, 0.5, 24, YARD_Y + 0.9, 17.38, Math.PI, { w: 256, h: 128, bg: '#2f5a3a', fg: '#fff' });
    cyl(0.05, 9, MAT.chrome, 10, YARD_Y + 4.5, 19, null, 8, 0.07); sphere(0.1, MAT.yellow, 10, YARD_Y + 9.05, 19);
    var fg = new THREE.Group(); fg.position.set(10, YARD_Y + 8.3, 19); scene.add(fg); yard.flag = fg;
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 8, 2), new THREE.MeshStandardMaterial({ map: textTex(['DEPOT CO.'], { w: 256, h: 160, bg: '#f5b53d', fg: '#1b232c' }), side: THREE.DoubleSide, roughness: 0.9 })); flag.position.set(0.82, 0, 0); fg.add(flag); yard.flagMesh = flag;
    for (var t = -56; t <= 56; t += 14) { tree(t, -56, randf(0.8, 1.2)); tree(t + 7, 56, randf(0.8, 1.2)); }
    tree(-30, 24, 1.1); tree(30, 26, 0.9);
    // the neighbours across the fence, each with its own dock doors and a name
    [[-130, -30, 40, 9, 32, 'NORTHGATE LOGISTICS', 0], [128, -24, 44, 8, 30, 'VOLT & CO. DISTRIBUTION', 0], [-118, 70, 34, 7, 26, 'FAIRLANE FREIGHT', 1], [0, 150, 90, 12, 40, 'KESSLER WHOLESALE', 1], [136, 82, 40, 10, 30, 'PINECREST STORAGE', 1], [-44, -124, 50, 9, 28, 'LITTLE WONDERS DC', 0]].forEach(function (b) {
      box(b[2], b[3], b[4], MAT.wall, b[0], YARD_Y + b[3] / 2, b[1]);
      var face = b[6] ? -1 : 1, fz = b[1] - face * (b[4] / 2 + 0.05), fry = b[6] ? Math.PI : 0;
      for (var d = -b[2] / 2 + 6; d < b[2] / 2 - 4; d += 8) { var dr = plane(3.6, 4.2, MAT.door, b[0] + d, YARD_Y + 2.1, fz, 0, fry); dr.receiveShadow = false; }
      sign([b[5]], b[2] * 0.7, b[2] * 0.09, b[0], YARD_Y + b[3] - 1.2, fz, fry, { w: 1024, h: 128, bg: '#2a2f36', fg: '#d8dbdf' });
      for (var u = 0; u < 3; u++) box(2.5, 1.2, 2.5, MAT.grey, b[0] - b[2] / 3 + u * b[2] / 3, YARD_Y + b[3] + 0.6, b[1] + randf(-3, 3));
      box(b[2] + 0.4, 0.5, b[4] + 0.4, MAT.steelDark, b[0], YARD_Y + b[3] + 0.2, b[1]); box(b[2] * 0.3, 3.2, 0.3, MAT.brick, b[0] + b[2] * 0.3, YARD_Y + 1.6, fz - face * 0.1);
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
    yard.rain = mkPoints(7000, 0.9, streak, 24); yard.snow = mkPoints(3000, 0.22, flake, 30);
  }

  function tickYard(dt) {
    yard.windT += dt;
    // gates slide open while a truck is coming in or going out on that side
    yard.gates.forEach(function (g) { var want = S.trucks.some(function (t) { return t.side === g.side && Math.abs(t.z - g.z) < 2 && (t.state === 'coming' || t.state === 'leaving') && Math.abs(t.x) > 62 && Math.abs(t.x) < 100; }) ? 1 : 0; var was = g.open; g.open = lerp(g.open, want, 1 - Math.pow(0.03, dt)); if (want && was < 0.05 && g.open >= 0.05) sfx('gate'); g.g.rotation.x = -g.open * 1.35; });
    yard.guards.forEach(function (gd) { var near = dist2(player.x, player.z, gd.g.position.x, gd.g.position.z) < 64; animateHuman(gd.g, dt, 'idle', 0, near ? { x: player.x, y: player.y + 1.6, z: player.z } : null, false); });
    yard.traffic.forEach(function (c) { c.g.position.x += c.dir * c.v * dt; if (c.g.position.x > 130) c.g.position.x = -130; if (c.g.position.x < -130) c.g.position.x = 130; });
    if (yard.flagMesh) { var w = S.weather ? S.weather.wind : 0.4; yard.flag.rotation.y = Math.sin(yard.windT * 0.7) * 0.3 * w; var pos = yard.flagMesh.geometry.attributes.position; for (var i = 0; i < pos.count; i++) { var x = pos.getX(i); pos.setZ(i, Math.sin(yard.windT * 4 + x * 3) * 0.08 * (0.3 + w) * x); } pos.needsUpdate = true; }
    yard.clouds.forEach(function (c) { c.sp.position.x += c.v * dt * (S.weather ? 0.5 + S.weather.wind : 1); if (c.sp.position.x > 240) c.sp.position.x = -240; });
    // the sun and the moon ride opposite each other
    if (yard.sunDisc) { _v.copy(sun.position).normalize(); yard.sunDisc.position.copy(_v).multiplyScalar(200).add(camera.position); yard.sunDisc.material.opacity = clamp(_v.y * 4, 0, 1); yard.moon.position.copy(_v).multiplyScalar(-200).add(camera.position); yard.moon.position.y = Math.abs(yard.moon.position.y - camera.position.y) + camera.position.y + 20; yard.moon.material.opacity = clamp(-_v.y * 3 + 0.4, 0, 0.9); }
    // weather
    var W = S.weather || { kind: 'clear', wet: 0, snow: 0, wind: 0.4 };
    var raining = W.kind === 'rain' || W.kind === 'storm', snowing = W.kind === 'snow';
    yard.rain.visible = raining; yard.snow.visible = snowing;
    if (raining) { var p = yard.rain.geometry.attributes.position.array, px = player.x, pz = player.z; for (var r = 0; r < p.length; r += 3) { p[r + 1] -= (9 + (W.kind === 'storm' ? 4 : 0)) * dt; var inHall = Math.abs(p[r]) < HALL.x && Math.abs(p[r + 2]) < HALL.z; if (p[r + 1] < (inHall ? HALL.h + 0.3 : YARD_Y) || Math.abs(p[r] - px) > 26 || Math.abs(p[r + 2] - pz) > 26) { p[r] = px + randf(-24, 24); p[r + 1] = randf(6, 16); p[r + 2] = pz + randf(-24, 24); } } yard.rain.geometry.attributes.position.needsUpdate = true; }
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
    for (var key in S.slots) { var sl = S.slots[key]; if (!sl || !sl.n) continue; var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l); drawPalletWithBoxes(sl.sku, sl.n, sp.x, sp.y, sp.z, 0, { kind: 'slot', key: key }); }
    S.pallets.forEach(function (pl) { var w = palletWorld(pl); if (!w) return; drawPalletWithBoxes(pl.sku, pl.n, w.x, w.y, w.z, w.ry, { kind: 'pallet', id: pl.id, carried: pl.place !== 'floor' && pl.place !== 'truck' }); });
    var bi = 0; SKUS.forEach(function (s) { var n = S.bench.boxes[s.id] || 0; for (var i = 0; i < n; i++, bi++) putBox(s.id, SPOT.bench.x + (bi % 2 ? 0.23 : -0.23), 0.94 + BOX.h / 2 + Math.floor(bi / 8) * BOX.h, SPOT.bench.z - 1.2 + (Math.floor(bi / 2) % 4) * 0.62, 0, { kind: 'bench', sku: s.id }); });
    S.bench.parcels.forEach(function (oid, i) { putParcel(SPOT.benchOut.x + (i % 2 ? 0.25 : -0.25), 0.63 + 0.23 + Math.floor(i / 4) * 0.47, SPOT.benchOut.z + (Math.floor(i / 2) % 2) * 0.6, 0, { kind: 'shelf', order: oid }); });
    S.floor.forEach(function (f, i) { if (f.kind === 'box') putBox(f.sku, f.x, f.y + BOX.h / 2, f.z, f.rot, { kind: 'floor', idx: i }); else putParcel(f.x, f.y + 0.23, f.z, f.rot, { kind: 'floor', idx: i }); });
    var cw = toolWorld('cart'); S.cart.boxes.forEach(function (sku, i) { var c = Math.cos(cw.ry), s = Math.sin(cw.ry), lx = (i % 3 - 1) * 0.42, ly = i < 3 ? 0.3 : 0.82; putBox(sku, cw.x + lx * c, ly + BOX.h / 2, cw.z - lx * s, cw.ry, { kind: 'cart', idx: i }); });
    S.trucks.forEach(function (t) { if (t.dir !== 'out') return; t.parcels.forEach(function (oid, i) { var pp = truckParcelPos(t, i); putParcel(pp.x, pp.y + 0.23, pp.z, 0, { kind: 'truck' }); }); });
    S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') putBox(st.carry.sku, st.x + Math.sin(st.yaw) * 0.45, 1.05, st.z + Math.cos(st.yaw) * 0.45, st.yaw, { kind: 'carried' }); if (st.carry && st.carry.kind === 'parcel') putParcel(st.x + Math.sin(st.yaw) * 0.45, 1.05, st.z + Math.cos(st.yaw) * 0.45, st.yaw, { kind: 'carried' }); });
    SKUS.forEach(function (s) { var im = boxInst[s.id]; im.count = Math.min(counts[s.id], 1400); im.instanceMatrix.needsUpdate = true; });
    palletInst.count = Math.min(counts.pallet, 400); palletInst.instanceMatrix.needsUpdate = true;
    parcelInst.count = Math.min(counts.parcel, 400); parcelInst.instanceMatrix.needsUpdate = true;
  }
  function instSource(hit) { var o = hit.object; if (o.userData.sku) return instSrc.box[o.userData.sku][hit.instanceId]; if (o.userData.pallet) return instSrc.pallet[hit.instanceId]; if (o.userData.parcel) return instSrc.parcel[hit.instanceId]; return null; }

  // ── The hand ──────────────────────────────────────────────────────
  var handGroup = new THREE.Group(); camera.add(handGroup); scene.add(camera);
  var handBox = new THREE.Mesh(BOX_GEO, CARD.paint); handBox.position.set(0.38, -0.36, -0.72); handBox.rotation.set(0.15, -0.35, 0.05); handBox.visible = false; handGroup.add(handBox);
  var handParcel = new THREE.Mesh(PARCEL_GEO, MAT.parcel); handParcel.position.set(0.38, -0.36, -0.74); handParcel.rotation.set(0.15, -0.35, 0.05); handParcel.visible = false; handGroup.add(handParcel);
  function updateHandMesh() { var h = S.hand; handBox.visible = !!(h && h.kind === 'box'); handParcel.visible = !!(h && h.kind === 'parcel'); if (h && h.kind === 'box') handBox.material = CARD[h.sku] || CARD.paint; }
  function handSet(h) { S.hand = h; hudDirty = true; updateHandMesh(); }
  function handLabel() { var h = S.hand; if (!h) return null; if (h.kind === 'box') return { t: 'A box of ' + skuName(h.sku), s: 'G puts it down' }; var o = orderById(h.order); return { t: 'Parcel #' + (o ? o.num : '?'), s: o ? 'for ' + clientName(o.client) + ' · G puts it down' : '' }; }

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
  function floorPrompt(src) { var f = S.floor[src.idx]; if (!f) return null; if (f.kind === 'box') { if (player.tool === 'cart') return S.cart.boxes.length < ECON.cartCap ? 'Put the box on the cart' : null; return S.hand || player.tool ? null : 'Pick up the box of ' + skuName(f.sku); } var o = orderById(f.order); return S.hand || player.tool ? null : 'Pick up parcel #' + (o ? o.num : '?'); }
  function floorUse(src) {
    var f = S.floor[src.idx]; if (!f) return;
    if (f.kind === 'box') { if (player.tool === 'cart') { if (S.cart.boxes.length >= ECON.cartCap) return; S.cart.boxes.push(f.sku); } else if (S.hand || player.tool) return; else handSet({ kind: 'box', sku: f.sku }); }
    else { if (S.hand || player.tool) return; handSet({ kind: 'parcel', order: f.order }); }
    S.floor.splice(src.idx, 1); sfx('pickup');
  }
  function putDown() {
    if (player.tool) { releaseTool(); return; }
    if (!S.hand) return;
    var h = S.hand; handSet(null);
    if (h.kind === 'box') dropAhead({ kind: 'box', sku: h.sku }); else dropAhead({ kind: 'parcel', order: h.order });
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
    [-1, 1].forEach(function (s) { var mg = cyl(0.62, 0.9, MAT.black, L(2.5), -0.55, s * 1.0, g, 16); mg.rotation.z = Math.PI / 2; mg.scale.set(1, 1, 0.55); mg.position.y = -0.45; });
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
    truckMeshes[t.id] = { g: g, driver: drv, drvT: 0, cab: { x: L(len + 1.4), z: -2.1 }, spot: { x: L(1.3), z: -2.6 } };
    shadowDirty = true;
  }
  function removeTruckMesh(id) { var m = truckMeshes[id]; if (!m) return; scene.remove(m.g); m.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); }); delete truckMeshes[id]; shadowDirty = true; }

  // what an inbound truck brings: lines the clients send, weighted toward what the open orders need and what is low
  function inboundLoad(t) {
    var tier = tierFor(S.level), cands = SKUS.filter(function (s) { return s.tier <= tier; });
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
    var inDocks = S.up.dock2 ? [0, 1] : [0];
    TRUCK_IN.forEach(function (h, k) { inDocks.forEach(function (dock) { var f = 'in' + S.day + '-' + k + '-' + dock; if (!S.flags[f] && S.time >= h - 0.25 && S.time < h + 1.5) { S.flags[f] = 1; if (!truckAtDoor(dock) && !S.trucks.some(function (t) { return t.dir === 'in' && t.dock === dock && t.state !== 'leaving'; })) spawnTruck('in', dock, h + TRUCK_WAIT); } }); });
    TRUCK_OUT.forEach(function (w, k) { var f = 'out' + S.day + '-' + k; if (!S.flags[f] && S.time >= w.arrive - 0.25 && S.time < w.leave - 0.3) { S.flags[f] = 1; if (!S.trucks.some(function (t) { return t.dir === 'out' && t.dock === k && t.state !== 'leaving'; })) spawnTruck('out', k, w.leave); } });
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
        if (docked && m.drvT < 1) m.drvT = Math.min(1, m.drvT + dt / 7); else if (!docked) m.drvT = 0;
        m.driver.visible = docked;
        var p = m.drvT, px = lerp(m.cab.x, m.spot.x, p), pz = lerp(m.cab.z, m.spot.z, p); m.driver.position.set(px, YARD_Y, pz);
        var moving = docked && p < 1; if (moving) m.driver.rotation.y = Math.atan2(m.spot.x - m.cab.x, m.spot.z - m.cab.z); else m.driver.rotation.y = t.side < 0 ? Math.PI / 2 : -Math.PI / 2;
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
    var client = pick(CLIENTS), pool = client.likes.filter(function (s) { return avail.indexOf(s) >= 0; }); if (!pool.length) { pool = avail; }
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
  function tickOrders() {
    var n = nowAbs();
    if (S.time >= 8 && S.time < 17 && !S.events.power) {
      var openN = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed'; }).length;
      var maxOpen = 3 + S.level, gap = Math.max(0.8, 2.3 - S.level * 0.12);
      if (S.day === 1 && !S.flags.firstOrder && S.time >= 8.5) { S.flags.firstOrder = 1; S.lastOrderAt = n; genOrder(false); }
      else if (openN < maxOpen && n - S.lastOrderAt >= gap) { S.lastOrderAt = n + randf(-0.3, 0.3); genOrder(Math.random() < 0.12 && S.level >= 3); }
    }
    for (var i = S.orders.length - 1; i >= 0; i--) {
      var o = S.orders[i];
      if ((o.state === 'open' || o.state === 'packed') && !o.late && n > o.due) { o.late = true; addRep(-2); logEvent('Order #' + o.num + ' is late', 'bad'); rebuildBoardSoon(); }
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
    if (S.hand && S.hand.kind === 'box') return benchCount() < ECON.benchCap ? 'Put the box on the bench' : 'The bench is full';
    if (S.hand) return null;
    return 'Packing bench · ' + benchCount() + ' boxes · ' + openOrders().length + ' open orders';
  }
  function benchUse() {
    if (player.tool === 'cart') { var moved = 0; while (S.cart.boxes.length && benchCount() < ECON.benchCap) { benchAdd(S.cart.boxes.pop(), 1); moved++; } if (moved) { sfx('putdown'); introStep('bench'); } else if (S.cart.boxes.length) toast('The bench is full.', 'bad'); return; }
    if (player.tool === 'jack') return;
    if (S.hand && S.hand.kind === 'box') { if (benchCount() >= ECON.benchCap) { toast('The bench is full.', 'bad'); return; } benchAdd(S.hand.sku, 1); handSet(null); sfx('putdown'); introStep('bench'); return; }
    if (S.hand) return;
    openPanel('bench');
  }
  function orderNeed(o) { var tot = 0, have = 0; o.lines.forEach(function (l) { tot += l.qty; have += Math.min(l.qty, S.bench.boxes[l.sku] || 0); }); return { tot: tot, have: have }; }
  function canPack(o) { return o.state === 'open' && o.lines.every(function (l) { return (S.bench.boxes[l.sku] || 0) >= l.qty; }); }
  function canPackShort(o) { var n = orderNeed(o); return o.state === 'open' && n.have >= Math.ceil(n.tot / 2) && n.have < n.tot; }
  function packOrder(o) {
    if (o.state !== 'open') return false;
    var n = orderNeed(o); if (n.have < Math.ceil(n.tot / 2)) return false;
    o.lines.forEach(function (l) { l.packed = benchTake(l.sku, l.qty); });
    o.short = n.have < n.tot; o.state = 'packed'; o.packedAt = nowAbs();
    if (S.bench.parcels.length < 8) S.bench.parcels.push(o.id); else S.floor.push({ kind: 'parcel', order: o.id, x: SPOT.benchOut.x - 1.2 + Math.random() * 0.6, y: 0, z: SPOT.benchOut.z + Math.random() * 1.2, rot: Math.random() });
    S.stats.packed++; addXp(XP.pack); sfx('tape'); rebuildBoardSoon(); introStep('pack');
    logEvent('Packed order #' + o.num + (o.short ? ' (short)' : ''), 'good');
    return true;
  }
  function shelfPrompt(src) { var o = orderById(src.order); if (S.hand || player.tool) return null; return 'Pick up parcel #' + (o ? o.num : '?') + (o ? ' for ' + clientName(o.client) : ''); }
  function shelfUse(src) { if (S.hand || player.tool) return; var k = S.bench.parcels.indexOf(src.order); if (k < 0) return; S.bench.parcels.splice(k, 1); handSet({ kind: 'parcel', order: src.order }); sfx('pickup'); }

  // ── Shipping ──────────────────────────────────────────────────────
  function shipOrder(o) {
    var late = nowAbs() > o.due, amount = Math.round(o.pay * (o.short ? ECON.shortCut : 1) * (late ? ECON.lateCut : 1));
    pay(amount, 'Order #' + o.num + ' shipped to ' + clientName(o.client) + (late ? ' (late)' : '') + (o.short ? ' (short)' : ''));
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
    var tiller = new THREE.Group(); tiller.position.set(0, 0.5, -0.78); tiller.rotation.x = 0.5; j.add(tiller);
    cyl(0.025, 1.0, MAT.steelDark, 0, 0.5, 0, tiller, 10); box(0.44, 0.06, 0.07, MAT.rubber, 0, 1.0, 0, tiller); box(0.05, 0.05, 0.05, MAT.rubber, -0.2, 1.0, 0, tiller); box(0.05, 0.05, 0.05, MAT.rubber, 0.2, 1.0, 0, tiller);
    box(0.08, 0.03, 0.1, MAT.red, 0, 0.95, 0.06, tiller); cyl(0.04, 0.08, MAT.steelDark, 0, 0.0, 0, tiller, 10);
    sign(['2500 kg'], 0.3, 0.1, 0, 0.3, -0.5, 0, { w: 256, h: 80, bg: '#1b232c', fg: '#f5b53d' }, j);
    hitBox(1.0, 1.3, 1.9, 0, 0.6, -0.25, { prompt: function () { return toolPrompt('jack'); }, use: function () { grabTool('jack'); } }, j);
    // ── the picking cart: a tubular frame, two mesh shelves, a push loop, four casters and a clipboard
    var c = new THREE.Group(); c.userData.dynamic = true; scene.add(c); cartMesh = c;
    [[-0.62, -0.3], [0.62, -0.3], [-0.62, 0.3], [0.62, 0.3]].forEach(function (o) { cyl(0.018, 0.96, MAT.chrome, o[0], 0.56, o[1], c, 8); box(0.05, 0.08, 0.05, MAT.steelDark, o[0], 0.1, o[1], c); var cw = cyl(0.045, 0.03, MAT.rubber, o[0], 0.045, o[1] + 0.03, c, 12); cw.rotation.z = Math.PI / 2; });
    [0.3, 0.82].forEach(function (y) { box(1.3, 0.025, 0.66, MAT.steelDark, 0, y - 0.012, 0, c); var m = plane(1.26, 0.62, MAT.mesh, 0, y + 0.002, 0, -Math.PI / 2, 0, c); m.receiveShadow = false; box(1.3, 0.05, 0.02, MAT.chrome, 0, y + 0.02, 0.32, c); box(1.3, 0.05, 0.02, MAT.chrome, 0, y + 0.02, -0.32, c); });
    cyl(0.018, 0.35, MAT.chrome, -0.62, 1.2, -0.3, c, 8); cyl(0.018, 0.35, MAT.chrome, 0.62, 1.2, -0.3, c, 8); cyl(0.02, 1.3, MAT.rubber, 0, 1.38, -0.3, c, 8).rotation.z = Math.PI / 2;
    box(0.22, 0.3, 0.02, MAT.plastic, 0.45, 1.1, -0.29, c); box(0.2, 0.26, 0.01, MAT.paper, 0.45, 1.1, -0.275, c);
    hitBox(1.4, 1.4, 0.8, 0, 0.7, 0, { prompt: function () { return toolPrompt('cart'); }, use: function () { grabTool('cart'); } }, c);
    // ── the forklift: counterbalance electric. Chassis, battery box, seat and column, overhead guard, mast, the carriage that lifts
    var f = new THREE.Group(); f.userData.dynamic = true; scene.add(f);
    var FY = MAT.forkYellow, FD = MAT.black;
    box(1.1, 0.5, 1.9, FY, 0, 0.5, -0.25, f); box(1.1, 0.78, 0.55, FD, 0, 0.62, -1.15, f); var cwt = cyl(0.55, 1.1, FD, 0, 0.95, -1.2, f, 16); cwt.rotation.z = Math.PI / 2; cwt.scale.set(0.5, 1, 1);
    box(0.95, 0.5, 0.95, MAT.steelDark, 0, 0.95, -0.35, f); box(0.97, 0.04, 0.97, MAT.plastic, 0, 1.2, -0.35, f);
    box(1.1, 0.04, 0.55, MAT.rubberMat, 0, 0.74, 0.3, f); box(0.3, 0.04, 0.2, FD, -0.2, 0.76, 0.25, f).rotation.x = -0.3; box(0.3, 0.04, 0.2, FD, 0.2, 0.76, 0.25, f).rotation.x = -0.3;
    box(0.52, 0.12, 0.5, MAT.fabric, 0, 1.27, -0.5, f); var bk = box(0.52, 0.52, 0.1, MAT.fabric, 0, 1.56, -0.78, f); bk.rotation.x = -0.15; box(0.08, 0.04, 0.3, FD, -0.3, 1.42, -0.55, f); box(0.08, 0.04, 0.3, FD, 0.3, 1.42, -0.55, f);
    var col = cyl(0.03, 0.55, MAT.steelDark, 0, 1.25, 0.0, f, 8); col.rotation.x = -0.6; var sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 20), MAT.rubber); sw.position.set(0, 1.5, 0.16); sw.rotation.x = -0.6 + Math.PI / 2; f.add(sw); cyl(0.04, 0.03, FD, 0, 1.5, 0.16, f, 8).rotation.x = -0.6 + Math.PI / 2;
    box(0.55, 0.26, 0.18, MAT.steelDark, 0, 1.06, 0.26, f); plane(0.3, 0.14, MAT.screen, 0, 1.1, 0.355, -0.4, 0, f); box(0.04, 0.12, 0.04, MAT.red, 0.2, 1.16, 0.3, f); box(0.04, 0.12, 0.04, MAT.green, -0.2, 1.16, 0.3, f);
    [[-0.52, 0.5], [0.52, 0.5], [-0.52, -1.0], [0.52, -1.0]].forEach(function (o) { cyl(0.035, 1.45, FD, o[0], 1.68, o[1], f, 8); });
    box(0.06, 0.06, 1.65, FD, -0.52, 2.4, -0.25, f); box(0.06, 0.06, 1.65, FD, 0.52, 2.4, -0.25, f); for (var cb = -0.95; cb <= 0.5; cb += 0.29) box(1.1, 0.04, 0.05, FD, 0, 2.42, cb, f);
    box(0.22, 0.03, 0.22, FD, 0, 2.45, -0.3, f); cyl(0.07, 0.14, glowMat(0xffa000, 0.6), 0, 2.53, -0.3, f, 12); var beaconLens = box(0.03, 0.12, 0.14, glowMat(0xffd060, 2.5), 0.06, 2.53, -0.3, f);
    [-0.5, 0.5].forEach(function (x) { box(0.1, 2.7, 0.16, MAT.steelDark, x, 1.45, 0.62, f); box(0.08, 2.45, 0.1, MAT.chrome, x * 0.84, 1.5, 0.63, f); });
    box(1.1, 0.08, 0.16, MAT.steelDark, 0, 2.78, 0.62, f); box(1.1, 0.08, 0.16, MAT.steelDark, 0, 0.14, 0.62, f); cyl(0.05, 2.3, MAT.chrome, 0, 1.3, 0.56, f, 10); box(0.02, 2.4, 0.02, MAT.black, -0.2, 1.45, 0.7, f); box(0.02, 2.4, 0.02, MAT.black, 0.2, 1.45, 0.7, f);
    var car = new THREE.Group(); f.add(car);
    box(0.95, 0.5, 0.06, MAT.steelDark, 0, 0.3, 0.72, car); for (var lb = -0.4; lb <= 0.4; lb += 0.2) box(0.03, 0.9, 0.03, MAT.steelDark, lb, 0.95, 0.72, car); box(0.95, 0.03, 0.03, MAT.steelDark, 0, 1.4, 0.72, car); box(0.95, 0.03, 0.03, MAT.steelDark, 0, 1.0, 0.72, car);
    [-0.3, 0.3].forEach(function (x) { box(0.12, 0.05, 1.15, MAT.steelDark, x, 0.03, 1.33, car); box(0.12, 0.42, 0.05, MAT.steelDark, x, 0.26, 0.77, car); var ft = box(0.12, 0.05, 0.1, MAT.steelDark, x, 0.02, 1.92, car); ft.rotation.x = 0.3; });
    [[-0.56, 0.45, 0.34, 0.26], [0.56, 0.45, 0.34, 0.26], [-0.46, -1.0, 0.27, 0.2], [0.46, -1.0, 0.27, 0.2]].forEach(function (w) { var ty = cyl(w[2], w[3], MAT.rubber, w[0], w[2], w[1], f, 18); ty.rotation.z = Math.PI / 2; cyl(w[2] * 0.6, w[3] + 0.01, MAT.chrome, w[0], w[2], w[1], f, 12).rotation.z = Math.PI / 2; cyl(w[2] * 0.2, w[3] + 0.03, FD, w[0], w[2], w[1], f, 8).rotation.z = Math.PI / 2; });
    box(0.5, 0.22, 0.08, FD, -0.55, 0.7, 0.45, f); box(0.5, 0.22, 0.08, FD, 0.55, 0.7, 0.45, f);
    box(0.14, 0.1, 0.06, MAT.lamp, -0.45, 1.0, 0.72, f); box(0.14, 0.1, 0.06, MAT.lamp, 0.45, 1.0, 0.72, f); box(0.12, 0.08, 0.05, MAT.red, -0.4, 0.75, -1.43, f); box(0.12, 0.08, 0.05, MAT.red, 0.4, 0.75, -1.43, f);
    sign(['DC-01'], 0.3, 0.09, 0, 0.55, -1.44, Math.PI, { w: 256, h: 80, bg: '#f5f1e6', fg: '#1b232c' }, f); sign(['2.5 t'], 0.3, 0.12, -0.56, 0.5, -0.4, -Math.PI / 2, { w: 256, h: 96, bg: '#1b232c', fg: '#f5b53d' }, f);
    cyl(0.04, 0.3, MAT.red, 0.5, 1.4, -1.1, f, 10); box(0.03, 0.12, 0.1, MAT.chrome, -0.6, 1.9, 0.1, f);
    hitBox(1.1, 1.4, 1.4, 0, 1.2, -0.3, { prompt: function () { return S.up.fork ? (S.hand || player.tool ? 'Hands full' : 'Drive the forklift') : null; }, use: function () { startDrive(); } }, f);
    forkM = { g: f, car: car, beacon: beaconLens };
    placeTools();
  }
  function toolPrompt(tool) { if (tool === 'cart' && !S.up.cart) return null; if (player.tool) return null; if (S.hand) return 'Hands full'; if (driving) return null; return tool === 'jack' ? 'Grab the pallet jack' : 'Grab the picking cart' + (S.cart.boxes.length ? ' (' + S.cart.boxes.length + ' boxes on it)' : ''); }
  function grabTool(tool) { if (player.tool || S.hand || driving) return; if (tool === 'cart' && !S.up.cart) return; player.tool = tool; sfx('pickup'); hudDirty = true; introStep(tool); }
  function releaseTool() { if (!player.tool) return; var w = toolWorld(player.tool); var t = S[player.tool]; t.x = w.x; t.z = w.z; t.rot = w.ry; player.tool = null; sfx('putdown'); hudDirty = true; }
  function placeTools() {
    var jw = toolWorld('jack'); jackMesh.position.set(jw.x, floorY(jw.x, jw.z), jw.z); jackMesh.rotation.y = jw.ry;
    var cw = toolWorld('cart'); cartMesh.position.set(cw.x, floorY(cw.x, cw.z), cw.z); cartMesh.rotation.y = cw.ry; cartMesh.visible = !!S.up.cart;
    forkM.g.position.set(S.fork.x, floorY(S.fork.x, S.fork.z), S.fork.z); forkM.g.rotation.y = S.fork.yaw; forkM.car.position.y = S.fork.lift; forkM.g.visible = !!S.up.fork; if (forkM.beacon) { forkM.beacon.visible = driving; forkM.beacon.rotation.y = worldTime * 6; }
  }

  // ── The forklift ──────────────────────────────────────────────────
  function forkTip() { return { x: S.fork.x + Math.sin(S.fork.yaw) * 1.5, y: S.fork.lift, z: S.fork.z + Math.cos(S.fork.yaw) * 1.5 }; }
  function startDrive() {
    if (!S.up.fork || S.hand || player.tool || driving) return;
    driving = true; forkSpeed = 0; forkLook.yaw = 0; forkLook.pitch = 0; sfx('forklift'); introStep('fork'); hudDirty = true;
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
    if (p0 && !p0.wrapped && p0.n > 0 && (k.KeyA || k.KeyD) && Math.abs(forkSpeed) > 3.2 && Math.random() < dt * 0.9) { p0.n--; var tip0 = forkTip(); S.floor.push({ kind: 'box', sku: p0.sku, x: tip0.x + randf(-0.8, 0.8), y: floorY(tip0.x, tip0.z), z: tip0.z + randf(-0.8, 0.8), rot: Math.random() * 6 }); sfx('crate'); burst(tip0.x, tip0.y + 0.5, tip0.z, 0xc69c6d, 10, 'out'); toast('A box fell off the load. Wrap pallets before you move them.', 'bad'); if (p0.n <= 0) { removePallet(p0.id); F.pallet = null; } }
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
    function leg(x) { var hip = new THREE.Group(); hip.position.set(x, 0.86, 0); cyl(0.075, 0.42, pants, 0, -0.21, 0, hip, 10); var knee = new THREE.Group(); knee.position.set(0, -0.42, 0); cyl(0.065, 0.4, pants, 0, -0.2, 0, knee, 10); box(0.16, 0.08, 0.27, MAT.black, 0, -0.42, 0.04, knee); hip.add(knee); hip.userData.knee = knee; g.add(hip); return hip; }
    function arm(x) { var sh = new THREE.Group(); sh.position.set(x, 1.38, 0); cyl(0.05, 0.3, shirt, 0, -0.15, 0, sh, 8); var el = new THREE.Group(); el.position.set(0, -0.3, 0); cyl(0.045, 0.28, shirt, 0, -0.14, 0, el, 8); sphere(0.05, skin, 0, -0.3, 0, el); sh.add(el); sh.userData.elbow = el; g.add(sh); return sh; }
    u.legs = [leg(-0.12), leg(0.12)]; u.arms = [arm(-0.27), arm(0.27)];
    box(0.4, 0.58, 0.23, shirt, 0, 1.14, 0, g); box(0.44, 0.1, 0.26, shirt, 0, 1.4, 0, g);
    if (opt.vest) { box(0.46, 0.46, 0.28, opt.vest, 0, 1.16, 0, g); box(0.48, 0.04, 0.3, MAT.chrome, 0, 1.08, 0, g); box(0.48, 0.04, 0.3, MAT.chrome, 0, 1.24, 0, g); }
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
  var NAV = { cell: 0.4, x0: -34, z0: -16, w: 170, h: 80, grid: null, dirty: true };
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
  function slotStand(key) { var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l); var up = laneFor(sp.z + 1.3), dn = laneFor(sp.z - 1.3); var z = Math.abs(up - sp.z) < Math.abs(dn - sp.z) ? up : dn; return { x: sp.x, z: z }; }

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
  function staffOnShift() { return S.time >= 8 && S.time < 18 && !isSunday(); }
  function onBreak() { return S.time >= 12 && S.time < 12.5; }
  function hireStaff(role) {
    var def = STAFF_ROLES[role]; if (!def) return;
    var name = STAFF_NAMES[S.nextStaffName++ % STAFF_NAMES.length];
    var st = { id: uid('st'), name: name, role: role, x: SPOT.spawn.x, z: SPOT.spawn.z, yaw: 0, state: 'home', path: [], timer: 0, carry: null, task: null, hiredDay: S.day, look: { skin: pick(SKINS), hair: pick(HAIRS), style: pick(['short', 'long', 'bun', 'bald', 'short']) }, said: 0 };
    S.staff.push(st); buildStaffMesh(st); logEvent('Hired ' + name + ' as ' + def.name.toLowerCase(), 'good'); hudDirty = true;
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
    var shift = staffOnShift(), brk = onBreak();
    S.staff.forEach(function (st) {
      var m = staffMeshes[st.id]; if (!m) { buildStaffMesh(st); m = staffMeshes[st.id]; }
      if (!shift) {
        if (st.state === 'leaving') { if (st.state === 'leaving' && !st.path.length) { st.state = 'home'; } }
        else if (st.state !== 'home') { staffDropAll(st); staffSay(st, voice(st).bye, '#a0acb8'); staffGo(st, { x: SPOT.spawn.x - 2, z: SPOT.spawn.z + 2.5 }, 'home'); st.state = 'walk'; st.then = 'home'; st.leaving = true; }
        if (st.state === 'walk') { staffWalk(st, dt); m.visible = true; m.position.set(st.x, floorY(st.x, st.z), st.z); m.rotation.y = st.yaw; animateHuman(m, dt, 'walk', 1.9, null, false); return; }
        m.visible = false; st.x = SPOT.spawn.x - 2; st.z = SPOT.spawn.z + 2.5; return;
      }
      if (st.state === 'home') { st.state = 'idle'; st.leaving = false; staffSay(st, voice(st).hi, '#5fd38d'); setMood(m, 'happy'); setTimeout(function () { setMood(m, 'neutral'); }, 2500); }
      m.visible = true;
      var carrying = !!st.carry || S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; });
      if (brk && !carrying && st.state !== 'break' && st.state !== 'walk') { st.task = null; staffSay(st, voice(st).brk, '#a0acb8'); staffGo(st, { x: -14.5 + randf(-1, 1), z: 11.3 + randf(-0.5, 0.5) }, 'break'); }
      if (!brk && st.state === 'break') st.state = 'idle';
      var mode = st.state === 'walk' ? 'walk' : st.state === 'wait' ? (st.working ? 'work' : 'wait') : st.state === 'break' ? 'idle' : 'idle';
      if (st.state === 'walk') staffWalk(st, dt);
      else if (st.state === 'wait') { st.timer -= dt; if (st.timer <= 0) { st.state = 'idle'; st.working = false; if (st.after) { var f = st.after; st.after = null; f(); } } }
      else if (st.state === 'break') { /* standing in the break room */ }
      else if (st.state === 'idle') { if (st.role === 'receiver') receiverThink(st); else if (st.role === 'picker') pickerThink(st); else packerThink(st); }
      if ((st.state === 'idle' || st.state === 'break') && Math.random() < dt / 22 && S.time - (st.said || 0) > 0.4) { st.said = S.time; staffSay(st, pick(voice(st).idle), '#a0acb8'); }
      m.position.set(st.x, floorY(st.x, st.z), st.z); m.rotation.y = st.yaw;
      var near = dist2(st.x, st.z, player.x, player.z) < 36;
      animateHuman(m, dt, mode, 1.9, near && st.state !== 'walk' ? { x: player.x, y: player.y + 1.6, z: player.z } : null, carrying);
    });
  }
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
      staffGo(st, { x: SPOT.bench.x - 1.0, z: SPOT.bench.z }, 'wait'); st.timer = 0.8; st.working = true;
      st.after = function () { if (!st.carry) return; if (benchCount() < ECON.benchCap) { benchAdd(st.carry.sku, 1); st.carry = null; sfx('putdown'); addXp(XP.box); } else { staffSay(st, voice(st).full, '#ff6b5e'); staffWait(st, 3); } st.task = null; };
      return;
    }
    var want = null;
    var orders = openOrders().slice().sort(function (a, b) { return (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b.due; });
    for (var i = 0; i < orders.length && !want; i++) orders[i].lines.forEach(function (l) { if (want) return; if (skuDemand(l.sku) > 0) { var keys = slotsWith(l.sku).filter(function (k) { return slotParse(k).l < RACK.top; }); if (keys.length) want = { sku: l.sku, key: keys[0] }; } });
    if (!want) { idleAt(st, { x: 14.6, z: 2.6 }); return; }
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
      staffGo(st, { x: SPOT.bench.x - 1.0, z: SPOT.bench.z + 0.8 }, 'wait'); st.timer = 2.8; st.working = true;
      st.after = function () { if (canPack(packable)) { packOrder(packable); } };
      return;
    }
    var truck = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && S.doors[2 + x.dock]; })[0];
    if (truck && S.bench.parcels.length) {
      staffGo(st, { x: SPOT.benchOut.x - 1.0, z: SPOT.benchOut.z + 0.3 }, 'wait'); st.timer = 0.7; st.working = true;
      st.after = function () { var oid = S.bench.parcels.shift(); if (oid) { st.carry = { kind: 'parcel', order: oid }; sfx('pickup'); } };
      return;
    }
    idleAt(st, { x: 14.8, z: 7.4 });
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
    if (player.tool !== 'jack' && jackPallet()) { /* a pallet on a parked jack is part of the jack: walk round it */ var jw = toolWorld('jack'); dyn.push({ x0: jw.x - 0.7, x1: jw.x + 0.7, z0: jw.z - 0.7, z1: jw.z + 0.7, y0: -1, y1: 1.5 }); }
  }
  function collides(x, z, ignoreFork) {
    var r = 0.32, y0 = player.y, y1 = player.y + 1.7;
    if (floorY(x, z) - player.y > 0.5) return true;
    for (var i = 0; i < solids.length; i++) { var s = solids[i]; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r && y0 < s.y1 && y1 > s.y0) return true; }
    for (var k = 0; k < dyn.length; k++) { var d = dyn[k]; if (d.fork && (driving || ignoreFork === 'fork')) continue; if (x > d.x0 - r && x < d.x1 + r && z > d.z0 - r && z < d.z1 + r && y0 < d.y1 && y1 > d.y0) return true; }
    return false;
  }
  function updatePlayer(dt) {
    if (driving) {
      updateFork(dt);
      camera.position.set(S.fork.x - Math.sin(S.fork.yaw) * 0.35, floorY(S.fork.x, S.fork.z) + 1.75, S.fork.z - Math.cos(S.fork.yaw) * 0.35);
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
    var hits = ray.intersectObjects(inter.concat(instList), false);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], def = h.object.userData.it || srcDef(instSource(h));
      if (!def) continue;
      var txt = def.prompt(); if (!txt) continue;
      focus = def; focusText = txt; break;
    }
  }
  function useFocus() { if (driving) { forkUse(); return; } if (focus) { focus.use(); sfx('click'); interact(); } }

  // ── Input ─────────────────────────────────────────────────────────
  function lockPointer() { if (!ui.started || ui.blocked()) return; try { var r = canvas.requestPointerLock(); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
  canvas.addEventListener('click', function () { if (ui.started && !ui.blocked() && !player.locked) lockPointer(); });
  document.addEventListener('pointerlockchange', function () { player.locked = document.pointerLockElement === canvas; if (!player.locked) { player.keys = {}; if (ui.started && !ui.blocked() && !ui.suppressMenu) openMenu(); } ui.suppressMenu = false; });
  document.addEventListener('mousemove', function (e) {
    if (!player.locked || ui.blocked()) return;
    var sx = 0.0022 * SET.sens, iy = SET.invertY ? -1 : 1;
    if (driving) { forkLook.yaw = clamp(forkLook.yaw - e.movementX * sx, -2.4, 2.4); forkLook.pitch = clamp(forkLook.pitch - e.movementY * sx * iy, -1.2, 1.2); return; }
    player.yaw -= e.movementX * sx; player.pitch = clamp(player.pitch - e.movementY * sx * iy, -1.5, 1.5);
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'F12') { e.preventDefault(); if (ui.started) screenshot(); return; }
    if (e.code === 'F3') { e.preventDefault(); SET.fps = !SET.fps; $('h-fps').hidden = !SET.fps; saveSettings(); return; }
    var typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
    if (typing && e.code !== 'Escape') return;
    if (!ui.started) return;
    if (e.code === 'Escape') { e.preventDefault(); if (ui.panelOpen) closePanel(); else if (ui.scanOpen) scanToggle(false); else if (ui.menuOpen) closeMenu(); else openMenu(); return; }
    if (ui.blocked()) return;
    if (e.code === 'Tab') { e.preventDefault(); scanToggle(!ui.scanOpen); return; }
    if (ui.scanOpen && /^Digit[1-4]$/.test(e.code)) { scanPage(+e.code.slice(5) - 1); return; }
    player.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyE') useFocus();
    else if (e.code === 'KeyG') { if (driving) stopDrive(); else putDown(); }
  });
  document.addEventListener('keyup', function (e) { player.keys[e.code] = false; });
  window.addEventListener('blur', function () { player.keys = {}; });
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
    if (player.tool) { held.hidden = false; held.innerHTML = (player.tool === 'jack' ? 'Pallet jack' + (jackPallet() ? ' · ' + jackPallet().n + ' × ' + skuName(jackPallet().sku) : ' (empty)') : 'Picking cart · ' + S.cart.boxes.length + ' / ' + ECON.cartCap + ' boxes') + '<small>G lets go</small>'; }
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
  function scanToggle(on) { ui.scanOpen = on; $('dc-scan').hidden = !on; if (on) { sfx('scan'); introStep('scanner'); renderScan(); } }
  function scanPage(i) { scan.page = i; sfx('click'); renderScan(); }
  function sw(sku) { return '<span class="sw" style="background:' + SKU[sku].col + '"></span>'; }
  function renderScan() {
    if (!ui.scanOpen) return;
    $('dc-scan-tabs').innerHTML = SCAN_PAGES.map(function (n, i) { return '<button class="' + (i === scan.page ? 'on' : '') + '" data-page="' + i + '">' + (i + 1) + ' ' + n + '</button>'; }).join('');
    $('dc-scan-title').textContent = 'Scanner · ' + SCAN_PAGES[scan.page];
    var h = '';
    if (scan.page === 0) {
      var os = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed' || o.state === 'loaded'; }).sort(function (a, b) { return a.due - b.due; });
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
  var PC_TABS = [['orders', 'Orders'], ['shop', 'Shop'], ['staff', 'Staff'], ['finance', 'Finance'], ['stock', 'Stock'], ['stats', 'Stats']];
  function openPanel(kind, tab) {
    panel.kind = kind; panel.tab = tab || (kind === 'pc' ? 'orders' : null); ui.panelOpen = true; $('dc-panel').hidden = false; scanToggle(false);
    ui.suppressMenu = true; try { document.exitPointerLock(); } catch (e) {}
    renderPanel(); sfx('click');
  }
  function openPc() { introStep('pc'); openPanel('pc'); }
  function closePanel() { if (!ui.panelOpen) return; ui.panelOpen = false; $('dc-panel').hidden = true; panel.kind = null; hudDirty = true; lockPointer(); }
  function renderPanel() {
    if (!ui.panelOpen) return;
    var title = panel.kind === 'pc' ? 'Office PC · Depot OS' : 'Packing bench';
    $('dc-panel-title').textContent = title;
    $('dc-panel-tabs').innerHTML = panel.kind === 'pc' ? PC_TABS.map(function (t) { return '<button class="' + (t[0] === panel.tab ? 'on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') : '';
    $('dc-panel-body').innerHTML = panel.kind === 'pc' ? pcHtml(panel.tab) : benchHtml();
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
    } else if (tab === 'shop') {
      h += '<p>Bank: <b style="color:var(--cash)">' + money(S.bank) + '</b> · level ' + S.level + '. Everything is delivered and fitted at once.</p><div class="dc-grid">';
      UPGRADES.forEach(function (u) {
        var owned = u.id === 'row3' ? S.up.rows >= 3 : u.id === 'row4' ? S.up.rows >= 4 : !!S.up[u.id];
        var needs = u.id === 'row4' && S.up.rows < 3 ? 'Needs the third row first' : S.level < u.lvl ? 'Level ' + u.lvl : S.bank < u.price ? 'Not enough money' : '';
        h += '<div class="dc-card"><div class="body"><b>' + esc(u.name) + '</b><small>' + esc(u.desc) + '</small></div><div style="text-align:right"><div class="price">' + money(u.price) + '</div>' + (owned ? '<span class="dc-tag good">Owned</span>' : btn('buy', u.id, 'Buy', 'primary', !!needs) + (needs ? '<small style="display:block;color:var(--muted)">' + needs + '</small>' : '')) + '</div></div>';
      });
      h += '</div>';
    } else if (tab === 'staff') {
      h += '<p>Staff work 08:00 to 18:00 and are paid at 06:00. They need the dock doors opened for them: that stays your job.</p>';
      h += '<div class="dc-grid">' + Object.keys(STAFF_ROLES).map(function (r) { var d = STAFF_ROLES[r], locked = S.level < d.lvl, n = S.staff.filter(function (s) { return s.role === r; }).length; return '<div class="dc-card"><div class="body"><b>' + d.name + '</b>' + (n ? '<span class="dc-tag good">' + n + ' hired</span>' : '') + '<small>' + esc(d.desc) + '</small></div><div style="text-align:right"><div class="price">' + money(d.wage) + '/day</div>' + btn('hire', r, 'Hire', 'primary', locked || S.staff.length >= 5) + (locked ? '<small style="display:block;color:var(--muted)">Level ' + d.lvl + '</small>' : '') + '</div></div>'; }).join('') + '</div>';
      if (S.staff.length) h += '<h3>Your crew</h3>' + S.staff.map(function (st) { return '<div class="dc-card"><div class="body"><b>' + esc(st.name) + '</b> · ' + STAFF_ROLES[st.role].name + '<small>' + (staffOnShift() ? 'On shift · ' + st.state : 'Off shift') + ' · hired day ' + st.hiredDay + '</small></div>' + btn('fire', st.id, 'Let go', 'danger') + '</div>'; }).join('');
    } else if (tab === 'finance') {
      h += '<div class="dc-kpis"><div class="dc-kpi"><div class="k">Bank</div><div class="v" style="color:var(--cash)">' + money(S.bank) + '</div></div><div class="dc-kpi"><div class="k">Earned</div><div class="v">' + money(S.stats.earned) + '</div></div><div class="dc-kpi"><div class="k">Spent</div><div class="v">' + money(S.stats.spent) + '</div></div><div class="dc-kpi"><div class="k">Fines</div><div class="v">' + money(S.stats.fines) + '</div></div><div class="dc-kpi"><div class="k">Daily costs</div><div class="v">' + money(ECON.rent + S.staff.reduce(function (a, s) { return a + STAFF_ROLES[s.role].wage; }, 0)) + '</div></div></div>';
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
  function panelAct(act, arg) {
    if (act === 'pack') { var o = orderById(arg); if (o && packOrder(o)) toast('Packed #' + o.num, 'good'); }
    else if (act === 'takeback') { if (!S.hand && benchTake(arg, 1)) { handSet({ kind: 'box', sku: arg }); sfx('pickup'); } }
    else if (act === 'buy') buyUpgrade(arg);
    else if (act === 'hire') { var d = STAFF_ROLES[arg]; if (d && S.level >= d.lvl && S.staff.length < 5) { hireStaff(arg); toast('Hired a ' + d.name.toLowerCase(), 'good'); } }
    else if (act === 'fire') fireStaff(arg);
    renderPanel(); hudDirty = true;
  }
  function buyUpgrade(id) {
    var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; if (!u) return;
    var owned = id === 'row3' ? S.up.rows >= 3 : id === 'row4' ? S.up.rows >= 4 : !!S.up[id];
    if (owned || S.level < u.lvl || S.bank < u.price || (id === 'row4' && S.up.rows < 3)) { sfx('bad'); return; }
    pay(-u.price, 'Bought ' + u.name);
    if (id === 'row3') { S.up.rows = 3; buildRack(2); } else if (id === 'row4') { S.up.rows = 4; buildRack(3); } else S.up[id] = true;
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
    camera.fov = SET.fov; camera.updateProjectionMatrix();
    var pr = SET.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : SET.quality === 'medium' ? 1 : 0.75;
    renderer.setPixelRatio(pr); renderer.shadowMap.enabled = SET.quality !== 'low'; sun.castShadow = SET.quality !== 'low';
    scene.traverse(function (o) { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
    shadowDirty = true; $('h-fps').hidden = !SET.fps; if (sfxBus) sfxBus.gain.value = SET.vol;
  }
  function screenshot() {
    try { renderer.render(scene, camera); canvas.toBlob(function (b) { if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'depot-co-' + Date.now() + '.png'; a.click(); toast('Screenshot saved', 'good'); }, 'image/png'); } catch (e) {}
  }

  // ── The guide ─────────────────────────────────────────────────────
  function guideHtml() {
    return '<h3>What you do</h3><p>You run a small third-party warehouse. Clients send stock on trucks, you store it on the racks, their customers order from it, and you pick, pack and ship those orders out again. You are paid a fee for every pallet you receive and a cut of every order you ship on time.</p>' +
      '<h3>Controls</h3><p><kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> use, pick up, put on · <kbd>G</kbd> put down or let go · <kbd>Tab</kbd> the hand scanner · <kbd>1</kbd>-<kbd>4</kbd> scanner pages · <kbd>Esc</kbd> pause · <kbd>F3</kbd> FPS · <kbd>F12</kbd> screenshot · <kbd>F11</kbd> fullscreen.</p>' +
      '<h3>Receiving</h3><p>Inbound trucks dock at IN 1 (and IN 2 once you buy the second bay) at 07:30 and 13:30. Open the dock door, walk into the trailer and take boxes off the pallets by hand, or grab the pallet jack and lift a whole pallet. A truck waits three hours; whatever is still on it goes back, unpaid, and the client remembers.</p>' +
      '<h3>Racks</h3><p>Every slot holds up to 12 boxes of one line. The floor and shelf levels are hand-reachable; the top level needs the forklift. Look at a slot and press E to put a box on or take one off. The jack sets a whole pallet into a floor-level slot.</p>' +
      '<h3>Orders</h3><p>Orders arrive between 08:00 and 17:00 on the office PC, the wall board and the scanner. Each one lists lines and a due time, which is the departure of an outbound truck. Pick the boxes, put them on the packing bench, press E on the bench with empty hands and pack. The parcel appears on the shelf beside the bench.</p>' +
      '<h3>Shipping</h3><p>Outbound trucks wait at OUT 1 from 10:30 to 12:00 and OUT 2 from 16:00 to 18:00. Open the door, carry the parcel into the trailer and press E. Press E on the dock console to send a loaded truck early. You are paid when it leaves. Late orders pay half; a short order pays 60%.</p>' +
      '<h3>Tools</h3><p>The pallet jack is yours from day one. The picking cart (shop) holds six boxes and picks straight off the racks. The forklift (shop, level 2) drives with WASD, lifts with R and F, and takes pallets to the top level. G gets off.</p>' +
      '<h3>Staff</h3><p>From level 3 you can hire a receiver, a picker and a packer on the office PC. They work 08:00 to 18:00 and are paid at 06:00. They will not open dock doors: that stays your job.</p>' +
      '<h3>Trouble</h3><p>Power cuts stop the doors, the PC and new orders until you reset the breaker in the office. An inspector drops in now and then and fines you for boxes left on the floor. Leave a dock door open at night with no truck in it and stock walks off. Sleep on the cot in the break room to skip to the next morning, which charges rent and wages.</p>' +
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
    for (var p = o; p; p = p.parent) if (p.userData && p.userData.dynamic) return false;
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
    S.staff.forEach(function (st) { pay(-STAFF_ROLES[st.role].wage, 'Wages, ' + st.name); });
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
    scene.background.copy(skyTmp); scene.fog.color.copy(skyTmp); scene.fog.near = 70 - overcast * 30; scene.fog.far = 190 - overcast * 90;
    hemi.intensity = 0.12 + day * 0.35 * (1 - overcast * 0.5) + weatherFlash;
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
    toast('Someone walked off with ' + n + ' boxes through the open door at ' + dockLabel(open[0].i), 'bad'); logEvent(n + ' boxes of ' + skuName(sku) + ' stolen through the open door at ' + dockLabel(open[0].i) + '. Close the doors at night.', 'bad');
  }
  function onLevelUp() {
    sfx('levelup'); toast('Level ' + S.level + '!', 'rare');
    var what = S.level === 2 ? 'New lines from the clients; the forklift, a third rack row, the LED high bays and the roadside sign are in the shop.' : S.level === 3 ? 'You can hire a receiver and a picker on the office PC. Second inbound bay and fourth row in the shop. Rush orders start.' : S.level === 4 ? 'Packers for hire, and the clients send trainers and drills.' : S.level === 7 ? 'Televisions and tyre sets: the big-ticket lines.' : 'Bigger orders and bigger loads.';
    logEvent('Level ' + S.level + '. ' + what, 'rare');
  }

  // ── The guided intro ──────────────────────────────────────────────
  var INTRO = [
    ['door', 'Walk to dock <b>IN 1</b> on the west wall and open the door (E on the door or the button beside it). The first truck docks at 07:30.'],
    ['unload', 'Walk into the trailer. Take a box off a pallet with <b>E</b>, or grab the pallet jack by the receiving square and lift a whole pallet.'],
    ['putaway', 'Put it on a rack: look at a slot and press <b>E</b>. Row A, floor level, is nearest. A slot holds 12 boxes of one line.'],
    ['scanner', 'Press <b>Tab</b>. The scanner lists the orders, what is still on the truck, and where every line is stored.'],
    ['order', 'Orders arrive from 08:30 on the office PC, the wall board and the scanner. Wait for the first one.'],
    ['pick', 'Take the boxes the order needs off the rack (<b>E</b> on the slot). One box per trip until you buy the cart.'],
    ['bench', 'Carry them to the <b>packing bench</b> on the east side and press E to put them down.'],
    ['pack', 'With empty hands press <b>E</b> on the bench and pack the order. The parcel appears on the shelf beside it.'],
    ['load', 'Pick the parcel up, open dock <b>OUT 1</b>, walk into the outbound trailer and press E. It waits there from 10:30 to 12:00.'],
    ['dispatch', 'Press E on the <b>dock console</b> by the door to send the truck now, or let it leave on schedule. You are paid when it goes.']
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

  // ── The forklift battery ──────────────────────────────────────────
  function forkCharging() { return !!S.up.fork && !driving && Math.abs(S.fork.x - SPOT.fork.x) < 1.6 && S.fork.z > SPOT.fork.z - 1.9 && S.fork.batt < 1; }
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
    var p = jackPallet(); if (player.tool === 'jack' && p) return p.wrapped ? 'That pallet is already wrapped' : 'Wrap the pallet ($2)';
    return 'Stretch wrapper · bring a pallet on the jack';
  }
  function wrapperUse() {
    if (wrapperBusy() || S.events.power) return;
    var p = jackPallet(); if (!(player.tool === 'jack' && p) || p.wrapped) { sfx('bad'); return; }
    if (S.bank < 2) { toast('No money for film.', 'bad'); return; }
    pay(-2, 'Stretch film'); wrapper.t = 5; wrapper.pallet = p.id; sfx('hydraulic'); addXp(3);
  }
  var wrapInst = null;
  function tickWrapper(dt) {
    if (wrapper.t > 0) { wrapper.t -= dt; if (wrapper.t <= 0) { wrapper.t = 0; var p = palletById(wrapper.pallet); if (p) { p.wrapped = true; toast('Pallet wrapped', 'good'); sfx('tape'); burst(dress.wrapper.position.x, 1, dress.wrapper.position.z, 0xffffff, 10, 'out'); } } }
    if (!wrapInst) { wrapInst = new THREE.InstancedMesh(boxGeo(1.24, 1.0, 1.04), std({ color: 0xffffff, transparent: true, opacity: 0.28, roughness: 0.15, metalness: 0.1, depthWrite: false }), 120); wrapInst.count = 0; wrapInst.frustumCulled = false; scene.add(wrapInst); }
    var n = 0; S.pallets.forEach(function (p) { if (!p.wrapped || n >= 120) return; var w = palletWorld(p); if (!w) return; var hgt = 0.14 + Math.ceil(p.n / 4) * BOX.h; _e.set(0, w.ry, 0); _q.setFromEuler(_e); _v2.set(1, hgt, 1); _m4.compose(_v.set(w.x, w.y + hgt / 2, w.z), _q, _v2); wrapInst.setMatrixAt(n++, _m4); });
    wrapInst.count = n; wrapInst.instanceMatrix.needsUpdate = true;
  }

  function tickLife(dt) {
    if (!ui.started || ui.blocked()) return;
    tickWeatherState(dt); tickRadio(); tickBattery(dt); tickWrapper(dt);
  }
  // ── Boot ──────────────────────────────────────────────────────────
  var loaded = load();
  buildWorld(); buildTools();
  S.trucks.forEach(buildTruckMesh); S.staff.forEach(buildStaffMesh);
  // a packed order whose parcel is nowhere (an old save, say) goes back to open with its boxes on the bench
  S.orders.forEach(function (o) { if ((o.state === 'packed' || o.state === 'loaded') && !parcelExists(o.id)) { o.state = 'open'; o.lines.forEach(function (l) { if (l.packed) benchAdd(l.sku, l.packed); l.packed = 0; }); } });
  if (S.jack.pallet && !palletById(S.jack.pallet)) S.jack.pallet = null;
  if (S.fork.pallet && !palletById(S.fork.pallet)) S.fork.pallet = null;
  updateHandMesh(); applySettings(); resize(); rebuildDyn(); drawBoard();
  if (!/nobake=1/.test(location.search)) bakeStatic();
  camera.position.set(11, 4.5, 12.5); camera.lookAt(-2, 1.2, -3);
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
    if (ui.started && !ui.blocked()) { tickWorld(dt); updatePlayer(dt); autosaveT += dt; if (autosaveT > 30) { autosaveT = 0; save(); } scanT += dt; if (ui.scanOpen && scanT > 1) { scanT = 0; renderScan(); } }
    worldTime += dt;
    doorAnim(dt); placeTools(); syncInstances(); lighting(dt); tickDressing(dt); tickYard(dt); tickLife(dt); tickBursts(dt); doorsTick(dt); drawScreens(dt); for (var ai = 0; ai < animated.length; ai++) animated[ai](dt);
    interact(); updatePrompt(); updateHud(dt);
    renderer.render(scene, camera);
    if (SET.fps) { fpsN++; fpsT += dt; if (fpsT >= 0.5) { $('h-fps').textContent = Math.round(fpsN / fpsT) + ' fps · ' + renderer.info.render.calls + ' draws'; fpsN = 0; fpsT = 0; } }
  }
  requestAnimationFrame(frame);
  window.addEventListener('beforeunload', function () { if (ui.started) save(); });

  // ── The window handle: the main menu, and the smoke test ──────────
  window.DEPOT = {
    enter: enter, bootSlot: BOOT_SLOT, guideHtml: guideHtml, version: window.DEPOT_VERSION || 'dev',
    T: {
      get S() { return S; }, player: player, ui: ui, save: save,
      run: function (sec) { var n = Math.round(sec / 0.05); for (var i = 0; i < n; i++) { tickWorld(0.05); doorAnim(0.05); placeTools(); } syncInstances(); },
      setTime: function (h) { S.time = h; hudDirty = true; },
      spawnTruck: spawnTruck, signTruck: signTruck, truckById: truckById, truckAtDoor: truckAtDoor, truckLeave: truckLeave, setDoor: setDoor,
      palletById: palletById, palletUse: palletUse, palletPrompt: palletPrompt, storePallet: storePallet, findSlotFor: findSlotFor, newPallet: newPallet,
      slotKey: slotKey, slotUse: slotUse, slotPrompt: slotPrompt, stockCount: stockCount, totalStock: totalStock,
      grabTool: grabTool, releaseTool: releaseTool, toolWorld: toolWorld,
      genOrder: genOrder, orderById: orderById, benchAdd: benchAdd, benchUse: benchUse, packOrder: packOrder, canPack: canPack, shelfUse: shelfUse, loadUse: loadUse, consoleUse: consoleUse, consolePrompt: consolePrompt,
      hireStaff: hireStaff, fireStaff: fireStaff, buyUpgrade: buyUpgrade, startDrive: startDrive, stopDrive: stopDrive, forkUse: forkUse, forkTip: forkTip,
      handSet: handSet, putDown: putDown, interact: interact, useFocus: useFocus, focusText: function () { return focusText; },
      lookAt: function (x, y, z) { camera.position.set(player.x, player.y + 1.62, player.z); camera.lookAt(x, y, z); camera.updateMatrixWorld(true); player.yaw = Math.atan2(-(x - player.x), -(z - player.z)); player.pitch = Math.atan2(y - camera.position.y, Math.sqrt(dist2(x, z, player.x, player.z))); interact(); return focusText; },
      openPanel: openPanel, closePanel: closePanel, renderPanel: renderPanel, scanToggle: scanToggle, renderScan: renderScan, panelHtml: function () { return $('dc-panel-body').innerHTML; },
      sleepNow: sleepNow, flipBreaker: flipBreaker, inspection: inspection, prowlerCheck: prowlerCheck, drawBoard: drawBoard, introIndex: introIndex, floorY: floorY, collides: collides, route: route,
      addXp: addXp, counts: function () { return { draws: renderer.info.render.calls, inter: inter.length, dyn: dyn.length, baked: baked.draws, hidden: baked.hidden }; }
    }
  };
})();
