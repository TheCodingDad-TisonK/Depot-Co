//@ automation: the shipping belt that runs parcels from the pack line to the dock loader, and the AGV that puts pallets away by itself
  // ── The shipping belt and the dock loader ─────────────────────────
  // With the upgrade, parcels roll off the gravity shelf onto a belt that runs down the east wall to OUT 1, where the dock loader's
  // boom pushes them into the trailer whenever a truck is docked with the door up. Nothing loads otherwise; the parcels queue on the belt.
  // the run past OUT 2 climbs 2.2 m so the dock apron under it stays clear for people and the forklift
  // the shelf feeds the shipping belt, which runs down the east wall to the dock loader at OUT 2; OUT 1 stays a manual dock
  defBelt('shipBelt', { prop: 'shipBelt', path: [[0, 0], [0, 0.5], [1.9, 0.5], [1.9, -18.6]] });
  var LOADER_DOOR = 3;
  defMachine('dockLoader2', { prop: 'dockLoader2', inlet: [-0.1, 1.6],
    accept: function (it) {
      if (it.kind !== 'parcel' || !powered()) return false;
      var t = truckAtDoor(LOADER_DOOR); if (!t || !S.doors[LOADER_DOOR] || !doorPassable(LOADER_DOOR)) return false;
      var o = orderById(it.order); if (!o) return true;
      t.parcels.push(o.id); o.state = 'loaded'; sfx('crate'); addXp(XP.ship); rebuildBoardSoon(); S.stats.autoLoaded = (S.stats.autoLoaded || 0) + 1;
      if (MACH.dockLoader2.anim) MACH.dockLoader2.anim.pushT = 1.2;
      return true;
    } });
  function dockLoaderStatus() { if (!powered()) return 'off'; var t = truckAtDoor(LOADER_DOOR); return t && S.doors[LOADER_DOOR] ? 'run' : 'idle'; }
  function dockLoaderPrompt() { var t = truckAtDoor(LOADER_DOOR); return 'Dock loader OUT 2 · ' + (!powered() ? 'no power' : t && S.doors[LOADER_DOOR] ? 'loading, ' + t.parcels.length + ' aboard' : t ? 'open the door and it loads' : 'waiting for a truck at OUT 2') + ' · ' + (S.stats.autoLoaded || 0) + ' loaded by machine so far'; }
  function tickShipping(dt) {
    if (!S.up.shipbelt || !propInst.shipBelt) return;
    if (powered() && S.bench.parcels.length && beltStartFree('shipBelt')) { var oid = S.bench.parcels.shift(); beltPush('shipBelt', { kind: 'parcel', order: oid }); }
    var M = MACH.dockLoader2; if (M.lamps) lampSet(M, dockLoaderStatus()); var a = M.anim; if (a) { if (a.pushT > 0) a.pushT -= dt; var t = truckAtDoor(LOADER_DOOR), out = t && S.doors[LOADER_DOOR] ? 1 : 0; a.ext = lerp(a.ext || 0, out, Math.min(1, dt * 1.5)); a.boom.position.x = 0.9 + a.ext * 1.6; a.boom.scale.x = 0.6 + a.ext * 1.0; a.pusher.position.x = (a.pushT > 0 ? Math.sin(a.pushT / 1.2 * Math.PI) * 0.5 : 0); }
  }

  // ── The AGV ───────────────────────────────────────────────────────
  // A pallet set down on the AGV pickup square, or dropped by the palletiser, is collected by the truck, taken to a free rack slot
  // and put away, and the truck returns to its dock. It follows the staff grid, so it goes round things.
  var AGV_SPEED = 1.3;
  var agvMesh = null;
  function agvState() { if (!S.agv) S.agv = { x: 0, z: 0, yaw: 0, state: 'idle', pallet: null, path: [], placed: false }; return S.agv; }
  function agvDockWorld() { return propInst.agvDock ? propWorld('agvDock', 0, 0) : null; }
  function agvPickupWorld() { return propInst.agvDock ? propWorld('agvDock', 0, 2.6) : null; }
  function agvCandidate() {
    var pu = agvPickupWorld(), pal = propInst.palletiser ? propWorld('palletiser', 2.2, 0) : null, best = null, bd = 1e9;
    S.pallets.forEach(function (p) { if (p.place !== 'floor' || p.n <= 0) return; var d = 1e9; if (pu) d = Math.min(d, dist2(p.x, p.z, pu.x, pu.z)); if (pal) d = Math.min(d, dist2(p.x, p.z, pal.x, pal.z)); if (d < 1.6 * 1.6 && d < bd) { bd = d; best = p; } });
    return best;
  }
  function agvGo(to, state) { var A = agvState(); A.path = route({ x: A.x, z: A.z }, to); A.state = state; }
  function agvWalk(dt) {
    var A = agvState(); if (!A.path.length) return true;
    var t = A.path[0], dx = t.x - A.x, dz = t.z - A.z, d = Math.sqrt(dx * dx + dz * dz), sp = AGV_SPEED * dt;
    if (d <= sp) { A.x = t.x; A.z = t.z; A.path.shift(); return !A.path.length; }
    A.x += dx / d * sp; A.z += dz / d * sp;
    var want = Math.atan2(dx, dz), diff = want - A.yaw; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI; A.yaw += diff * Math.min(1, 6 * dt);
    return false;
  }
  function tickAgv(dt) {
    if (!S.up.agv || !propInst.agvDock) { if (agvMesh) agvMesh.visible = false; return; }
    var A = agvState(), dock = agvDockWorld();
    if (!A.placed && dock) { A.x = dock.x; A.z = dock.z; A.yaw = dock.a; A.placed = true; }
    if (!powered()) { if (agvMesh) agvMesh.visible = true; return; }
    if (agvShown !== A.state + (A.paused ? 'p' : '')) { agvShown = A.state + (A.paused ? 'p' : ''); if (agvScreen) agvScreen.dirty = true; }
    if (A.state === 'idle') { var p = A.paused ? null : agvCandidate(); if (!p && dock && dist2(A.x, A.z, dock.x, dock.z) > 0.3) { agvGo(dock, 'return'); } else if (p) { A.target = p.id; var ddx = p.x - A.x, ddz = p.z - A.z, dl = Math.hypot(ddx, ddz) || 1; agvGo({ x: p.x - ddx / dl * 1.15, z: p.z - ddz / dl * 1.15 }, 'toPickup'); } }   // stop a fork's length short, so the forks go under the pallet
    else if (A.state === 'toPickup') { var tp = palletById(A.target); if (!tp || tp.place !== 'floor') { A.state = 'idle'; A.target = null; } else if (agvWalk(dt)) { A.yaw = Math.atan2(tp.x - A.x, tp.z - A.z); tp.place = 'agv'; A.pallet = tp.id; sfx('jack'); var key = findSlotFor(tp.sku, tp.n, 1); if (key) { A.key = key; agvGo(slotStand(key), 'toSlot'); } else { tp.place = 'floor'; tp.x = A.x; tp.z = A.z; A.pallet = null; toast('The AGV found no rack space for ' + skuName(tp.sku), 'bad'); agvGo(dock, 'return'); } } }
    else if (A.state === 'toSlot') { if (agvWalk(dt)) { var cp = palletById(A.pallet); if (cp) { if (!storePallet(cp, A.key)) { var k2 = findSlotFor(cp.sku, cp.n, 1); if (!k2 || !storePallet(cp, k2)) { cp.place = 'floor'; cp.x = A.x + Math.sin(A.yaw) * 1.2; cp.z = A.z + Math.cos(A.yaw) * 1.2; cp.y = 0; cp.rot = A.yaw; } } else { S.stats.agvPutaway = (S.stats.agvPutaway || 0) + 1; sfx('crate'); } } A.pallet = null; A.state = 'idle'; } }   // idle looks for the next pallet first and only returns to the dock when there is none
    else if (A.state === 'return') { if (!A.paused && agvCandidate()) A.state = 'idle'; else if (agvWalk(dt)) { A.state = 'idle'; if (dock) A.yaw = dock.a; } }   // a pallet appearing on the way home turns it round
    if (agvMesh) { agvMesh.visible = true; agvMesh.position.set(A.x, 0, A.z); agvMesh.rotation.y = A.yaw; var busy = A.state !== 'idle'; agvMesh.userData.beacon.visible = busy; agvMesh.userData.beacon.material.emissiveIntensity = 1.2 + Math.sin(worldTime * 9) * 1.1; agvMesh.userData.forks.position.y = lerp(agvMesh.userData.forks.position.y, A.pallet ? 0.22 : 0.06, Math.min(1, dt * 3)); agvMesh.userData.strip.material.emissiveIntensity = busy ? 1.4 : 0.4; }
  }
  var agvScreen = null, agvShown = '';
  function agvScreenDraw(c, sc) {
    var A = agvState(), st = !powered() ? 'off' : A.paused && A.state === 'idle' ? 'paused' : A.state === 'idle' ? 'ready' : 'running', tp = A.pallet ? palletById(A.pallet) : null;
    scBg(c, sc.w, sc.h, st === 'running' ? 'rgba(95,211,141,0.18)' : st === 'paused' || st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'AGV-1', st.toUpperCase());
    scText(c, 16, 70, A.state === 'idle' ? (A.paused ? 'Held at the dock' : 'Watching the pickup square') : A.state === 'toPickup' ? 'Fetching a pallet' : A.state === 'toSlot' ? 'Putting away' + (A.key ? ' to ' + slotName(A.key) : '') : 'Returning to the dock', '#eef1f5', 16);
    scText(c, 16, 94, tp ? 'Load: ' + tp.n + ' x ' + skuName(tp.sku) : 'Forks empty', '#a0acb8', 13);
    scText(c, 16, 118, 'Put away: ' + (S.stats.agvPutaway || 0) + ' pallets · at ' + A.x.toFixed(1) + ', ' + A.z.toFixed(1), '#a0acb8', 13);
    scText(c, 16, 136, 'Pickup: set a pallet on the square, or let the palletiser drop one', '#6b7784', 11);
    scButton(sc, 16, 150, 120, 34, A.paused ? 'RESUME' : 'PAUSE', !A.paused, function () { A.paused = !A.paused; toast('AGV-1 ' + (A.paused ? 'will hold at the dock after this run' : 'running'), A.paused ? 'bad' : 'good'); }, A.paused ? '#5fd38d' : '#f5b53d');
    scButton(sc, 148, 150, 136, 34, 'DROP LOAD', !!tp, function () { var q = A.pallet ? palletById(A.pallet) : null; if (!q) return; q.place = 'floor'; q.x = A.x + Math.sin(A.yaw) * 0.6; q.z = A.z + Math.cos(A.yaw) * 0.6; q.y = 0; q.rot = A.yaw; A.pallet = null; A.key = null; var dk = agvDockWorld(); if (dk) agvGo(dk, 'return'); sfx('putdown'); toast('AGV-1 set its pallet down', ''); }, '#ff6b5e');
  }
  function agvPrompt() { var A = agvState(); return 'AGV-1 · ' + (!powered() ? 'no power' : A.state === 'idle' ? 'waiting at its dock' : A.state === 'toPickup' ? 'fetching a pallet' : A.state === 'toSlot' ? 'putting a pallet away' : 'returning') + ' · ' + (S.stats.agvPutaway || 0) + ' pallets put away'; }
  function buildAgv() {
    var g = new THREE.Group(); g.userData.dynamic = true; g.visible = false; scene.add(g); agvMesh = g;
    var OR = new THREE.MeshPhysicalMaterial({ color: 0xe8701a, roughness: 0.4, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }), DG = std({ color: 0x2a2f36, roughness: 0.6, metalness: 0.5 });
    var body = new THREE.Mesh(bevelGeo(0.95, 0.42, 1.5, 0.05), OR); body.position.set(0, 0.33, -0.1); body.castShadow = true; g.add(body);
    box(0.97, 0.08, 1.52, MAT.black, 0, 0.14, -0.1, g); box(0.6, 0.06, 0.08, MAT.black, 0, 0.3, 0.68, g); box(0.6, 0.06, 0.08, MAT.black, 0, 0.3, -0.88, g);
    [[-0.38, 0.45], [0.38, 0.45], [-0.38, -0.65], [0.38, -0.65]].forEach(function (w) { var wh = cyl(0.12, 0.08, MAT.rubber, w[0], 0.12, w[1], g, 14); wh.rotation.z = Math.PI / 2; });
    var strip = box(0.98, 0.03, 1.3, glowMat(0x3fa7ff, 0.6), 0, 0.52, -0.1, g); g.userData.strip = strip;
    cyl(0.1, 0.1, MAT.black, 0, 0.6, 0.55, g, 14); cyl(0.07, 0.06, glowMat(0x1a1a1a, 0.2), 0, 0.68, 0.55, g, 12); box(0.3, 0.12, 0.2, DG, 0, 0.6, -0.5, g); plane(0.26, 0.09, MAT.screen, 0, 0.6, -0.39, 0, 0, g);
    var beacon = cyl(0.05, 0.12, glowMat(0xffd060, 2.5), 0, 0.72, -0.5, g, 10); g.userData.beacon = beacon; cyl(0.055, 0.02, MAT.black, 0, 0.79, -0.5, g, 10);
    var forks = new THREE.Group(); forks.position.set(0, 0.06, 0); g.add(forks); g.userData.forks = forks; box(0.6, 0.5, 0.08, DG, 0, 0.3, 0.72, forks); [-0.22, 0.22].forEach(function (fx) { box(0.1, 0.04, 1.2, DG, fx, 0.02, 1.35, forks); });
    sign(['AGV-1'], 0.5, 0.14, 0.49, 0.36, -0.1, Math.PI / 2, { w: 256, h: 72, bg: '#1b232c', fg: '#f5b53d' }, g); sign(['AGV-1'], 0.5, 0.14, -0.49, 0.36, -0.1, -Math.PI / 2, { w: 256, h: 72, bg: '#1b232c', fg: '#f5b53d' }, g);
    hitBox(1.0, 0.8, 1.6, 0, 0.4, -0.1, { prompt: function () { return agvPrompt(); }, use: function () { sfx('click'); } }, g);
    groundBlob(1.0, 1.6, 0, -0.1, g, 0);
  }
  function tickAutomation(dt) { tickShipping(dt); tickAgv(dt); tickGantry(dt); }
