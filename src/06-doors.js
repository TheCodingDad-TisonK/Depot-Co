//@ hinged doors with locks, the keyring, and the control cabinet with its touch screen
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
