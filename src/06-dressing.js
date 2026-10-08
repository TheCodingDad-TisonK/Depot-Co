//@ the hall's fixed dressing: what cannot be moved. Everything movable is a prop in 06-props
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
    c.fillStyle = '#2c5f9e'; c.font = 'bold 30px "Segoe Print", "Comic Sans MS", cursive'; c.textAlign = 'left'; c.fillText('SO FAR', 24, 48);
    var tot = S.stats.shipped || 0, late = S.stats.late || 0, ontime = tot ? Math.round(100 * (tot - late) / tot) : 100;
    var rows = [['on time', ontime + '%'], ['shipped', String(tot)], ['received', (S.stats.received || 0) + ' pallets'], ['in stock', totalStock() + ' boxes'], ['rep', String(Math.round(S.rep))]];
    c.font = '26px "Segoe Print", "Comic Sans MS", cursive';
    rows.forEach(function (r, i) { c.fillStyle = i === 0 ? (ontime >= 90 ? '#2f9e44' : '#c8342a') : '#1b232c'; c.fillText(r[0], 30, 96 + i * 42); c.textAlign = 'right'; c.fillText(r[1], w - 30, 96 + i * 42); c.textAlign = 'left'; });
    c.strokeStyle = '#c8342a'; c.lineWidth = 3; c.beginPath(); c.moveTo(30, 60); c.lineTo(w - 30, 60); c.stroke();
    c.fillStyle = '#c8342a'; c.font = '20px "Segoe Print", "Comic Sans MS", cursive'; c.fillText('close the dock doors at night!!', 30, h - 24);
    dress.kpiTex.needsUpdate = true;
  }

  // what every dock door gets inside the hall: two bollards, the amber beacon with its light, wheel chocks, guide rails and a chain hoist.
  // Called for every door at boot and for a door built when a hall is bought (until 1.17.0 those stood bare until the next reload).
  function dressDoor(d) {
    var X = HALL.x;
    [-1, 1].forEach(function (s) { var bx = d.side * (X - 1.0), bz = d.z + s * (DOCKS.w / 2 + 0.5); cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, null, 10); cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, null, 10); solid(bx - 0.12, bx + 0.12, bz - 0.12, bz + 0.12, 0, 1.0); });
      var x = d.side * (X - 0.3), nz = d.z - DOCKS.w / 2 - 0.5, z = nz < -HALL.z + 0.5 ? d.z + DOCKS.w / 2 + 0.5 : nz, ly = d.i < 6 && d.z < UPPER.z1 + 0.3 ? 4.25 : 4.6;   // OUT 3's beacon stood in the north wall and IN 1's in the deck plate until 1.18.0
      box(0.5, 0.06, 0.06, MAT.steelDark, x + d.side * -0.2, ly, z); var lamp = box(0.18, 0.18, 0.18, glowMat(0xffb020, 0.4), x - d.side * 0.5, ly - 0.1, z);
      var dl = new THREE.PointLight(0xffb020, 0, 9, 2); dl.position.set(x - d.side * 0.9, ly - 0.3, z); scene.add(dl); dress.dockLamps.push({ m: lamp, l: dl, door: d.i });   // the beacon throws real amber on the apron while a truck is on its way
      box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.3); box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.6);
      var rx = d.side * (X - 0.15); box(0.06, DOCKS.h, 0.06, MAT.steelDark, rx, DOCKS.h / 2, d.z - DOCKS.w / 2 - 0.05); box(0.06, DOCKS.h, 0.06, MAT.steelDark, rx, DOCKS.h / 2, d.z + DOCKS.w / 2 + 0.05); cyl(0.1, 0.3, MAT.steelDark, rx - d.side * 0.15, DOCKS.h + 0.3, d.z + DOCKS.w / 2 + 0.35, null, 10).rotation.x = Math.PI / 2; cyl(0.006, DOCKS.h - 0.6, MAT.chrome, rx - d.side * 0.15, DOCKS.h / 2 + 0.2, d.z + DOCKS.w / 2 + 0.35, null, 4);
    if (dress.apron) dress.apron(d);   // the tyre scuffs inside the door: at boot the dressing paints every door after this runs, so only a door built later takes this path
  }
  // a painted parking bay with its label; the meshes come back so a bay can be repainted elsewhere
  function paintBay(cx, cz, w, d, label) {
    var ms = [plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz - d / 2, -Math.PI / 2), plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz + d / 2, -Math.PI / 2), plane(0.08, d, MAT.yellowLine, cx - w / 2, 0.0062, cz, -Math.PI / 2), plane(0.08, d, MAT.yellowLine, cx + w / 2, 0.0062, cz, -Math.PI / 2)];
    ms.push(plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex([label], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), cx, 0.0066, cz + d / 2 - 0.3, -Math.PI / 2));
    return ms;
  }
  function repaintJack2Bay() { (dress.jack2Bay || []).forEach(function (m) { scene.remove(m); }); dress.jack2Bay = paintBay(SPOT.jack2.x, SPOT.jack2.z, 1.6, 2.2, 'JACK 2'); }
  function buildDressing() {
    var X = HALL.x, Z = HALL.z, H = HALL.h;
    // bollards guarding every dock door (the columns along the walls are the hall lining's, in 06-building)
    // the bollards of every door are in dressDoor, below, with the rest of the door kit
    // the north wall: cable tray, sprinkler main, extractor fans, the exit sign, the painted name
    [[-X + 0.5, -15.8], [-14.2, 15.2], [16.8, X - 0.5]].forEach(function (s) { box(s[1] - s[0], 0.08, 0.3, MAT.steelDark, (s[0] + s[1]) / 2, 5.6, -Z + 0.35); for (var cx = Math.ceil((s[0] + 0.5) / 2) * 2; cx <= s[1] - 0.5; cx += 2) box(0.04, 0.08, 0.3, MAT.steelDark, cx, 5.6, -Z + 0.35); });   // rungs the length of every tray run (they covered the middle 36 m of the old hall)
    [-9.5, 9.5].forEach(function (z) { var p = cyl(0.07, 2 * X - 2, MAT.red, 0, 6.45, z, null, 10); p.rotation.z = Math.PI / 2; for (var sx = -X + 3; sx <= X - 3; sx += 4) { cyl(0.025, 0.18, MAT.steelDark, sx, 6.3, z, null, 6); sphere(0.03, MAT.chrome, sx, 6.2, z); } });   // heads along the whole 70 m main, not the middle 32
    [-15, 16].forEach(function (x) {
      var g = new THREE.Group(); g.userData.dynamic = true; g.position.set(x, 6.0, -Z + 0.4); scene.add(g);   // above the girt and the tray, between the windows
      var housing = cyl(0.62, 0.3, MAT.steelDark, 0, 0, 0, g, 24); housing.rotation.x = Math.PI / 2;
      var hub = new THREE.Group(); hub.position.z = 0.17; g.add(hub); cyl(0.08, 0.12, MAT.plastic, 0, 0, 0, hub, 10).rotation.x = Math.PI / 2;
      for (var b = 0; b < 4; b++) { var bl = box(0.16, 0.5, 0.02, MAT.plastic, 0, 0.28, 0, hub); bl.rotation.z = b * Math.PI / 2; bl.position.set(Math.sin(b * Math.PI / 2) * -0.28, Math.cos(b * Math.PI / 2) * 0.28, 0); bl.rotation.y = 0.5; }
      for (var r = 0; r < 5; r++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(0.15 + r * 0.11, 0.008, 6, 24), MAT.steelDark); ring.position.z = 0.26; g.add(ring); }
      dress.fans.push(hub);
    });
    var exitSign = function (x, y, z, ry) { var m = sign(['EXIT'], 0.5, 0.2, x, y, z, ry, { w: 256, h: 96, bg: '#1f7a3a', fg: '#dfffe8' }); var b = box(0.54, 0.24, 0.04, MAT.exit, x, y, z + (ry ? 0 : 0.03), null); b.rotation.y = ry || 0; if (ry) b.position.x += ry > 0 ? -0.03 : 0.03; m.renderOrder = 1; };

    [RACK.x0 - 1.0, RACK.x0 + RACK.bays * RACK.bayW + 1.0].forEach(function (x) { for (var z = RACK.rows[0] - 1; z <= RACK.rows[RACK.rows.length - 1] + 1; z += 0.7) plane(1.2, 0.35, MAT.whiteLine, x, 0.0065, z, -Math.PI / 2); });   // the east hatch a metre past the block's end (x 22), not at x 25 where the old hall's block ended
    doors.forEach(dressDoor); dress.door = dressDoor;   // bollards, beacon, chocks, rails and hoist for every door standing at boot
    // the forklift bay, the tool bays and the charger on the south wall
    sorterSpots();   // jack 2 lives by the north wall once the sorter is in: paint its bay where the jack is, not where it was (the old bay sat under the OUT 3 shipping bay and the air spiral)
    paintBay(SPOT.jack.x, SPOT.jack.z, 1.6, 2.2, 'JACK 1'); dress.jack2Bay = paintBay(SPOT.jack2.x, SPOT.jack2.z, 1.6, 2.2, 'JACK 2'); paintBay(SPOT.cart.x, SPOT.cart.z, 1.8, 1.4, 'CART');
    plane(1.4, 1.0, MAT.rubberMat, -X + 1.1, 0.004, SPOT.staffDoor.z, -Math.PI / 2); plane(1.0, 1.0, MAT.rubberMat, -X + 5.1, 0.004, 19.95, -Math.PI / 2);
    plane(1.0, 1.0, MAT.rubberMat, -X + 7.6, 0.004, -22.45, -Math.PI / 2); plane(1.4, 0.08, MAT.yellowLine, -X + 7.0, 0.0062, -22.45, -Math.PI / 2);   // the break room door gets the mat and the crossing the lobby and office doors have
    // the office blinds and the crossing into it
    for (var bl2 = 0; bl2 < 14; bl2++) box(3.9, 0.05, 0.02, MAT.trim, X - 4, 2.26 - bl2 * 0.08, 18.58);
    plane(1.4, 0.08, MAT.yellowLine, -X + 4.5, 0.0062, 19.95, -Math.PI / 2);
    plane(0.08, 1.4, MAT.yellowLine, X - 8.1, 0.0062, 19.95, -Math.PI / 2);   // the crossing into the office door
    // grime: a dark gradient along the foot of every wall, tyre scuffs at the dock aprons and in the aisles, oil where machines stand
    var grimeTex = tex(64, 64, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, 'rgba(20,18,16,0.5)'); g.addColorStop(0.5, 'rgba(20,18,16,0.18)'); g.addColorStop(1, 'rgba(20,18,16,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); for (var i = 0; i < 60; i++) { c.fillStyle = 'rgba(10,10,10,' + randf(0.05, 0.2) + ')'; c.fillRect(Math.random() * w, h - Math.random() * 20, randf(1, 4), randf(1, 3)); } });
    var grimeMat = new THREE.MeshBasicMaterial({ map: grimeTex, transparent: true, depthWrite: false }); grimeMat.userData.noBake = true;
    var gw = function (w, h, x, y, z, ry) { var m = plane(w, h, grimeMat, x, y, z, 0, ry); m.renderOrder = 1; m.userData.noBake = true; grimeTex.repeat.set(1, 1); };
    var LC = world.liningCuts || { cutZ: { '-1': [], '1': [] }, cutX: { '-1': [], '1': [] } };   // one strip a wall segment, the openings left clean (a strip ran across every doorway until 1.18.0)
    hallSegs(-X + 0.3, X - 0.3, LC.cutX['-1']).forEach(function (sg) { gw(sg[1] - sg[0] - 0.2, 0.7, (sg[0] + sg[1]) / 2, 0.35, -Z + 0.19, 0); });
    hallSegs(-X + 0.3, X - 0.3, LC.cutX['1']).forEach(function (sg) { gw(sg[1] - sg[0] - 0.2, 0.7, (sg[0] + sg[1]) / 2, 0.35, Z - 0.19, Math.PI); });
    hallSegs(-Z + 0.3, Z - 0.3, LC.cutZ['-1']).forEach(function (sg) { gw(sg[1] - sg[0] - 0.2, 0.7, -X + 0.19, 0.35, (sg[0] + sg[1]) / 2, Math.PI / 2); });
    hallSegs(-Z + 0.3, Z - 0.3, LC.cutZ['1']).forEach(function (sg) { gw(sg[1] - sg[0] - 0.2, 0.7, X - 0.19, 0.35, (sg[0] + sg[1]) / 2, -Math.PI / 2); });
    var markTex = tex(256, 64, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 2; i++) { var g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(0,0,0,0.35)'); g.addColorStop(0.7, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 10 + i * 30, w, 12); } for (var k = 0; k < 400; k++) { c.fillStyle = 'rgba(0,0,0,' + randf(0.05, 0.25) + ')'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 3), randf(1, 2)); } });
    var markMat = new THREE.MeshBasicMaterial({ map: markTex, transparent: true, depthWrite: false, opacity: 0.8 }); markMat.userData.noBake = true;
    dress.apron = function (dk) { var m = plane(6, 1.3, markMat, dk.side * (X - 4.5), 0.0045, dk.z + randf(-0.3, 0.3), -Math.PI / 2, 0); m.rotation.z = randf(-0.08, 0.08); m.renderOrder = 1; m.userData.noBake = true; }; doors.forEach(dress.apron);   // kept on dress so a dock built mid-game (IN 3, the returns dock) gets its scuffs from dressDoor at once, not at the next reload
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
      pigeons.push({ g: g, wl: wl, wr: wr2, x: perch.x, z: perch.z, y: 6.6, state: 'perch', t: 0, from: null, to: null, flap: Math.random() * 6 });
      g.position.set(perch.x, 6.6, perch.z); g.rotation.y = Math.random() * 6.28;
    }
  }
  function tickPigeons(dt) {
    pigeons.forEach(function (p) {
      if (p.state === 'perch') {
        p.t += dt; p.g.rotation.y += Math.sin(p.t * 0.7) * 0.004; p.wl.rotation.z = 0; p.wr.rotation.z = 0;
        if (dist2(player.x, player.z, p.x, p.z) < 30 && insideHall(player.x, player.z) && Math.random() < dt * 2) { p.state = 'fly'; p.t = 0; p.from = { x: p.x, z: p.z }; p.to = { x: clamp(p.x + randf(-14, 14), -HALL.x + 3, HALL.x - 3), z: p.z > 0 ? -9.5 : 9.5 }; sfx('flap'); p.g.rotation.y = Math.atan2(p.to.x - p.from.x, p.to.z - p.from.z); }
      } else {
        p.t += dt / 3.5; var k = Math.min(1, p.t);
        p.x = lerp(p.from.x, p.to.x, k); p.z = lerp(p.from.z, p.to.z, k); p.y = 6.6 - Math.sin(k * Math.PI) * 1.6;
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
    if (power && dress.fanHeads) dress.fanHeads.forEach(function (h) { h.rotation.y = Math.sin(worldTime * 0.45) * 0.7; });   // the standing fan's head sweeps side to side, as its comment always said
    if (dress.turntable) dress.turntable.rotation.y += dt * (wrapperBusy() ? 1.4 : 0);
    if (dress.wrapCarriage) dress.wrapCarriage.position.y = wrapperBusy() ? 0.5 + Math.abs(Math.sin(worldTime * 0.9)) * 1.0 : 1.0;
    dress.dockLamps.forEach(function (l) { var d = doors[l.door]; var coming = S.trucks.some(function (t) { return doorIndex(t.dir, t.dock) === d.i && (t.state === 'coming' || t.state === 'leaving'); }); var on = coming ? (Math.sin(worldTime * 8) > 0 ? 1 : 0.1) : (S.doors[d.i] ? 0.55 : 0.1); l.m.material.emissiveIntensity = 0.2 + on * 2.0; if (l.l) l.l.intensity = power ? on * 1.3 : 0; });
    if (dress.charger && dress.charger.material) dress.charger.material.emissiveIntensity = power ? (forkCharging() ? (Math.sin(worldTime * 3) > 0 ? 1.5 : 0.4) : 1) : 0;
    tickClocks();
    dress.kpiT = (dress.kpiT || 0) + dt; if (dress.kpiT > 5) { dress.kpiT = 0; drawKpi(); }   // the whiteboard keeps up with the day
    if (dress.dust) { var dpa = dress.dust.geometry.attributes.position.array; for (var di = 0; di < dpa.length; di += 3) { dpa[di] += Math.sin(worldTime * 0.3 + di) * 0.24 * dt; dpa[di + 1] -= 0.02 * dt; if (dpa[di + 1] < 0.4) dpa[di + 1] = HALL.h - 0.2; } dress.dust.geometry.attributes.position.needsUpdate = true; }
  }
