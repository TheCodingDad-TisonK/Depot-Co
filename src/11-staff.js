//@ people: the rig, procedural faces, variety, walking and idling, speech bubbles, the aisle router, the three staff roles and their voices
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
    for (var i = 0; i < S.pallets.length; i++) { var p = S.pallets[i]; if (p.place !== 'truck' || p.n <= 0) continue; var t = truckById(p.truck); if (!t || t.state !== 'docked' || !S.doors[t.dock] || !t.signed) continue; if (S.staff.some(function (o) { return o !== st && o.task && o.task.pallet === p.id; })) continue; pickP = p; break; }
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
