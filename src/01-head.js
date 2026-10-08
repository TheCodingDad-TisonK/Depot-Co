//@ file header, the closure, utilities, the save key and the settings
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
  // 1.21.0: the building stage is read off the slot before anything is laid out, because every layout table is built once a page
  // load for it (02-config). A save from 1.20 or earlier has no site field: it lived in the 72 m hall, so it gets the big hall at
  // least, the annexes if it owns a hall, the far end if it owns Hall 4 (stageForOwned). No save: the shed.
  var BOOT_SAVE = (function () { try { var raw = localStorage.getItem(SAVE), s = raw ? JSON.parse(raw) : null; return s && typeof s === 'object' ? s : null; } catch (e) { return null; } })();
  function stageForOwned(up) { up = up || {}; return up.hall4 ? 5 : (up.hall2 || up.hall3) ? 4 : 3; }
  var BOOT_STAGE = BOOT_SAVE ? (typeof BOOT_SAVE.site === 'number' ? Math.max(0, Math.min(5, Math.floor(BOOT_SAVE.site))) : stageForOwned(BOOT_SAVE.up)) : 0;
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
  var SET = { sens: 1, invertY: false, quality: 'high', sound: true, vol: 0.8, fps: false, fov: 75, film: true, bob: true };   // bob: the walking head bob, off for anyone it makes queasy
  try { var ss = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (ss) for (var sk in ss) if (sk in SET) SET[sk] = ss[sk]; } catch (e) {}
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SET)); } catch (e) {} }
