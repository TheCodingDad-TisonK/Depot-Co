//@ the pallet jack, the picking cart and the forklift
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
    hitBox(1.1, 1.4, 1.4, 0, 1.2, -0.3, { prompt: function () { if (!S.up.fork) return null; if (player.tool === 'cable') return 'Plug the forklift in'; if (S.fork.plugged) return 'Forklift on charge · unplug at the charger · E drives off anyway'; return S.hand || player.tool ? 'Hands full' : 'Drive the forklift'; }, use: function () { if (player.tool === 'cable') { cablePlugInto('fork'); return; } startDrive(); } }, f);
    forkM = { g: f, car: car, beacon: beaconLens };
    placeTools();
  }
  function toolPrompt(tool) { if (tool === 'cart' && !S.up.cart) return null; if (tool === 'jack' && player.tool === 'jcable') return 'Plug the jack in'; if (player.tool) return null; if (S.hand) return 'Hands full'; if (driving) return null; return tool === 'jack' ? 'Grab the pallet jack' : 'Grab the picking cart' + (S.cart.boxes.length ? ' (' + S.cart.boxes.length + ' boxes on it)' : ''); }
  function grabTool(tool) { if (tool === 'jack' && player.tool === 'jcable') { cablePlugInto('jack'); return; } if (tool === 'jack' && S.jack.plugged) { S.jack.plugged = false; toast('Jack unplugged', ''); } if (player.tool || S.hand || driving) return; if (tool === 'cart' && !S.up.cart) return; player.tool = tool; sfx('pickup'); hudDirty = true; introStep(tool); }
  function releaseTool() { if (!player.tool) return; if (player.tool === 'cable' || player.tool === 'jcable') { player.tool = null; sfx('putdown'); toast('Cable hung back', ''); hudDirty = true; return; } var w = toolWorld(player.tool); var t = S[player.tool]; t.x = w.x; t.z = w.z; t.rot = w.ry; player.tool = null; sfx('putdown'); hudDirty = true; }
  function placeTools() {
    var jw = toolWorld('jack'); jackMesh.position.set(jw.x, floorY(jw.x, jw.z), jw.z); jackMesh.rotation.y = jw.ry;
    var cw = toolWorld('cart'); cartMesh.position.set(cw.x, floorY(cw.x, cw.z), cw.z); cartMesh.rotation.y = cw.ry; cartMesh.visible = !!S.up.cart;
    forkM.g.position.set(S.fork.x, floorY(S.fork.x, S.fork.z), S.fork.z); forkM.g.rotation.y = S.fork.yaw; forkM.car.position.y = S.fork.lift; forkM.g.visible = !!S.up.fork; if (forkM.beacon) { forkM.beacon.visible = driving; forkM.beacon.rotation.y = worldTime * 6; }
  }

  // ── The forklift ──────────────────────────────────────────────────
  function forkTip() { return { x: S.fork.x + Math.sin(S.fork.yaw) * 1.5, y: S.fork.lift, z: S.fork.z + Math.cos(S.fork.yaw) * 1.5 }; }
  function startDrive() {
    if (!S.up.fork || S.hand || player.tool || driving) return;
    if (S.fork.plugged) cableUnplugFork('You drove off with the charger plugged in. The plug came out.');
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
