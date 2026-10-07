//@ trucks: the schedule, the meshes, docking, unloading fees, loading parcels, departure
  // ── Trucks ────────────────────────────────────────────────────────
  var truckMeshes = {};
  var clientSignTex = {};
  function truckById(id) { for (var i = 0; i < S.trucks.length; i++) if (S.trucks[i].id === id) return S.trucks[i]; return null; }
  function truckDockX(side) { return side * (HALL.x + 0.4); }
  function truckAtDoor(i) { var dm = DOOR_MAP[i]; if (!dm) return null; var dir = dm.dir, dock = dm.dock; for (var k = 0; k < S.trucks.length; k++) { var t = S.trucks[k]; if (t.dir === dir && t.dock === dock && t.state === 'docked') return t; } return null; }
  function truckPalletPos(t, i) { var r = Math.floor(i / 2), c = i % 2; return { x: t.x + t.side * (1.1 + r * 1.35), y: 0, z: t.z + (c ? 0.62 : -0.62), ry: 0 }; }
  function truckParcelPos(t, i) { var r = Math.floor(i / 6), c = i % 6, col = c % 3, layer = Math.floor(c / 3); return { x: t.x + t.side * (0.9 + r * 0.7), y: layer * 0.47, z: t.z + (col - 1) * 0.8 }; }
  function trailerBounds(t) { var a = t.x, b = t.x + t.side * TRAILER.len; return { x0: Math.min(a, b), x1: Math.max(a, b), z0: t.z - TRAILER.w / 2, z1: t.z + TRAILER.w / 2 }; }
  function tierFor(level) { return level >= 7 ? 4 : level >= 4 ? 3 : level >= 2 ? 2 : 1; }
  function nowAbs() { return S.day * 24 + S.time; }

  function truckWheel(g, x, y, z, r, w) { var ty = cyl(r, w, MAT.rubber, x, y, z, g, 20); ty.rotation.x = Math.PI / 2; for (var k = 0; k < 3; k++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.04, 0.012, 6, 24), MAT.black); ring.position.set(x, y, z + (k - 1) * w * 0.3); g.add(ring); } cyl(r * 0.58, w + 0.02, MAT.chrome, x, y, z, g, 14).rotation.x = Math.PI / 2; cyl(r * 0.2, w + 0.06, MAT.steelDark, x, y, z, g, 10).rotation.x = Math.PI / 2; }
  function buildTruckMesh(t) {
    var g = new THREE.Group(), side = t.side, L = function (x) { return x * side; }, len = TRAILER.len, w = TRAILER.w, h = TRAILER.h;
    g.userData.dynamic = true;
    var paint = t.color === 'red' ? MAT.truckRed : t.color === 'blue' ? MAT.truckBlue : MAT.green, TRM = t.mode === 'sea' ? MAT.container : MAT.trailer, fz = t.dir === 'out' && t.dock === 2 ? -1 : 1;   // a sea truck carries a container; OUT 3 sits in the corner, so its landing and driver route mirror to the north side
    // the trailer: floor, lined walls, ribbed outside, roof, rear frame with the doors folded back, chassis, wheels and guards
    box(len, 0.12, w, MAT.steelDark, L(len / 2), -0.06, 0, g); plane(len - 0.2, w - 0.2, MAT.wood, L(len / 2), 0.005, 0, -Math.PI / 2, 0, g);
    [-1, 1].forEach(function (s) { box(len, h, 0.06, TRM, L(len / 2), h / 2, s * (w / 2 + 0.03), g); var lin = plane(len - 0.1, h - 0.1, MAT.lining, L(len / 2), h / 2, s * (w / 2 - 0.005), 0, s > 0 ? Math.PI : 0, g); lin.receiveShadow = false; for (var rb = 1; rb < len; rb += 1.5) box(0.04, h - 0.2, 0.06, MAT.steelDark, L(rb), h / 2, s * (w / 2 + 0.06), g); });
    box(0.06, h, w + 0.12, TRM, L(len + 0.03), h / 2, 0, g); plane(w - 0.1, h - 0.1, MAT.lining, L(len - 0.005), h / 2, 0, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2, g);
    box(len, 0.06, w + 0.12, TRM, L(len / 2), h + 0.03, 0, g); plane(len - 0.1, w - 0.1, MAT.lining, L(len / 2), h - 0.005, 0, Math.PI / 2, 0, g);
    box(0.1, h + 0.1, 0.1, MAT.steelDark, L(0.05), h / 2, -(w / 2 + 0.05), g); box(0.1, h + 0.1, 0.1, MAT.steelDark, L(0.05), h / 2, w / 2 + 0.05, g); box(0.1, 0.1, w + 0.2, MAT.steelDark, L(0.05), h + 0.05, 0, g);
    // the rear doors hang on hinge pivots at the corners: open flat against the sides while docked, closed across the back on the road
    var rearDoors = []; [-1, 1].forEach(function (s) { var piv = new THREE.Group(); piv.position.set(L(0.02), h / 2, s * (w / 2 + 0.03)); g.add(piv); var dr = box(0.05, h - 0.1, w / 2 - 0.05, TRM, 0, 0, -s * (w / 2 - 0.05) / 2, piv); box(0.02, 0.5, 0.06, MAT.steelDark, 0.03 * side, 0, -s * (w / 2 - 0.2), piv); box(0.02, h - 0.3, 0.03, MAT.steelDark, 0.03 * side, 0, -s * 0.12, piv); piv.userData.openRot = -side * s * Math.PI / 2; piv.rotation.y = piv.userData.openRot; rearDoors.push(piv); });
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
    var cname = t.dir === 'in' ? clientName(t.client) : (MODES[t.mode] || MODES.land).haulier;
    if (t.dir === 'out' && t.mode === 'sea') { [[0.1, -1], [len - 0.1, -1], [0.1, 1], [len - 0.1, 1]].forEach(function (p) { box(0.2, 0.2, 0.2, MAT.steelDark, L(p[0]), 0.1, p[1] * (w / 2 + 0.02), g); box(0.2, 0.2, 0.2, MAT.steelDark, L(p[0]), h - 0.1, p[1] * (w / 2 + 0.02), g); }); }   // a container's corner castings
    if (t.dir === 'out' && t.mode === 'air') { [-1, 1].forEach(function (s) { plane(len - 0.2, 0.22, std({ color: 0x3fa7d6, roughness: 0.5 }), L(len / 2), 2.45, s * (w / 2 + 0.075), 0, s > 0 ? 0 : Math.PI, g); plane(len - 0.2, 0.1, std({ color: 0xff6b5e, roughness: 0.5 }), L(len / 2), 2.25, s * (w / 2 + 0.075), 0, s > 0 ? 0 : Math.PI, g); }); }   // the air carrier's livery band
    if (!clientSignTex[cname]) clientSignTex[cname] = textTex([cname], { w: 1024, h: 160, bg: '#e6e8ea', fg: t.dir === 'in' ? '#2c5f9e' : '#1b232c', size: 80 });
    var sm = new THREE.MeshBasicMaterial({ map: clientSignTex[cname] });
    [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.25), sm); p.position.set(L(len / 2), 1.7, s * (w / 2 + 0.07)); p.rotation.y = s > 0 ? 0 : Math.PI; g.add(p); });
    [-1, 1].forEach(function (s) { sign([t.driver.toUpperCase() + ' HAULAGE'], 1.4, 0.3, L(len + 1.5), 0.4, s * 1.22, s > 0 ? 0 : Math.PI, { w: 512, h: 96, bg: '#1b232c', fg: '#eef1f5' }, g); });
    // the loading zone inside an outbound trailer
    if (t.dir === 'out') hitBox(3.0, 2.4, w - 0.2, L(1.8), 1.25, 0, { truck: t.id, prompt: function () { return loadPrompt(t.id); }, use: function () { loadUse(t.id); } }, g);
    // the driver: climbs out when docked, walks to the dock with the paperwork, and waits there
    var drv = makeHuman({ cap: true, capMat: paint, vest: Math.random() < 0.5 ? MAT.hivis : null }); drv.position.set(L(len + 1.4), YARD_Y, -2.1 * fz); drv.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; drv.visible = false; g.add(drv);
    box(0.22, 0.3, 0.02, MAT.wood, 0.16, 1.05, 0.2, drv); box(0.2, 0.26, 0.01, MAT.paper, 0.16, 1.05, 0.215, drv);
    hitBox(0.7, 1.9, 0.7, 0, 0.95, 0, { truck: t.id, prompt: function () { return driverPrompt(t.id); }, use: function () { driverUse(t.id); } }, drv);
    g.position.set(t.x, 0, t.z); scene.add(g);
    var route = [[L(len + 1.4), YARD_Y, 2.1], [L(2.4), YARD_Y, 4.6], [L(0.9), YARD_Y, 6.1], [L(0.9), 0, 4.4], [L(0.9), 0, 3.0], [L(-0.2), 0, 1.55], [L(-2.0), 0, 2.0], [L(-2.6), 0, 3.4]].map(function (p) { return [p[0], p[1], p[2] * fz]; });
    truckMeshes[t.id] = { g: g, driver: drv, drvD: 0, route: route, doors: rearDoors, doorA: t.state === 'docked' ? 1 : 0 };
    shadowDirty = true;
  }
  function removeTruckMesh(id) { var m = truckMeshes[id]; if (!m) return; scene.remove(m.g); m.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); }); delete truckMeshes[id]; shadowDirty = true; }

  // what an inbound truck brings: lines the clients send, weighted toward what the open orders need and what is low
  function inboundLoad(t) {
    var tier = tierFor(S.level), cands = SKUS.filter(function (s) { return s.tier <= tier && !s.own; });
    var need = {}; S.orders.forEach(function (o) { if (o.state !== 'open') return; o.lines.forEach(function (l) { need[l.sku] = (need[l.sku] || 0) + l.qty; }); });
    var count = clamp(2 + Math.floor(S.level / 2) + (S.up.dock2 ? 1 : 0) + randi(-1, 1), 2, 8);
    var client = activeClients().filter(function (c) { return c.likes.some(function (s) { return SKU[s].tier <= tier; }); });
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
    var t = { id: uid('tr'), num: S.truckSeq++, dir: dir, dock: dock, side: side, z: z, x: side * 80, state: 'coming', mode: dir === 'out' ? TRUCK_OUT[dock].mode : null, mode: dir === 'out' ? TRUCK_OUT[dock].mode : null, mode: dir === 'out' ? TRUCK_OUT[dock].mode : null, mode: dir === 'out' ? TRUCK_OUT[dock].mode : null, mode: dir === 'out' ? TRUCK_OUT[dock].mode : null, arrived: 0, leave: leaveH, day: S.day, pallets: [], parcels: [], driver: pick(DRIVER_NAMES), color: pick(['red', 'blue', 'green']), unloaded: 0, doneAt: 0 };
    if (dir === 'in') inboundLoad(t);
    S.trucks.push(t); buildTruckMesh(t); sfx('truck');
    logEvent((dir === 'in' ? 'Inbound truck coming to ' : 'Outbound truck coming to ') + dockLabel(doorIndex(dir, dock)));
    return t;
  }
  function tickTrucks(dt) {
    // the schedule
    var inDocks = isSunday() ? [] : [0].concat(S.up.dock2 ? [1] : []).concat(S.up.hall3 ? [2] : []);   // IN 3 with Hall 3
    TRUCK_IN.forEach(function (h, k) { inDocks.forEach(function (dock) { var f = 'in' + S.day + '-' + k + '-' + dock; if (!S.flags[f] && S.time >= h - 0.25 && S.time < h + 1.5) { S.flags[f] = 1; if (!truckAtDoor(dock) && !S.trucks.some(function (t) { return t.dir === 'in' && t.dock === dock && t.state !== 'leaving'; })) spawnTruck('in', dock, h + TRUCK_WAIT); } }); });
    TRUCK_OUT.forEach(function (dk, k) { if (isSunday() || !dockOwned(k)) return; dk.windows.forEach(function (w, wi) { var f = 'out' + S.day + '-' + k + '-' + wi; if (!S.flags[f] && S.time >= w.arrive - 0.25 && S.time < w.leave - 0.3) { S.flags[f] = 1; if (!S.trucks.some(function (t) { return t.dir === 'out' && t.dock === k && t.state !== 'leaving'; })) spawnTruck('out', k, w.leave); } }); });   // one lane a dock, two windows a day
    // movement and waiting
    for (var i = S.trucks.length - 1; i >= 0; i--) {
      var t = S.trucks[i], m = truckMeshes[t.id]; if (!m) { buildTruckMesh(t); m = truckMeshes[t.id]; }
      if (t.state === 'coming') {
        var dx = truckDockX(t.side), dirn = dx > t.x ? 1 : -1; t.x += dirn * 7 * dt;
        if ((dirn > 0 && t.x >= dx) || (dirn < 0 && t.x <= dx)) { t.x = dx; t.state = 'docked'; t.arrived = S.time; sfx('airbrake'); if (t.dir === 'in') { toast('Truck at ' + dockLabel(doorIndex('in', t.dock)) + ': ' + t.pallets.length + ' pallets from ' + clientName(t.client), 'rare'); logEvent(t.driver + ' docked at ' + dockLabel(doorIndex('in', t.dock)) + ' with ' + t.pallets.length + ' pallets'); introStep('truck'); } else { toast('Outbound ' + (MODES[t.mode] || MODES.land).name.toLowerCase() + ' truck at ' + dockLabel(doorIndex('out', t.dock)) + ' · leaves ' + fmtTime(t.leave), 'rare'); logEvent('Outbound ' + (MODES[t.mode] || MODES.land).name.toLowerCase() + ' truck at ' + dockLabel(doorIndex('out', t.dock)) + ', leaves at ' + fmtTime(t.leave)); } rebuildBoardSoon(); }
      } else if (t.state === 'docked') {
        if (t.dir === 'in') {
          var left = S.pallets.some(function (p) { return p.place === 'truck' && p.truck === t.id && p.n > 0; });
          if (!left) { if (!t.doneAt) t.doneAt = S.time; if (S.time >= t.doneAt + 0.25) truckLeave(t, 'done'); }
          else if (S.time >= t.leave) truckLeave(t, 'timeout');
        } else if (S.time >= t.leave) truckLeave(t, 'schedule');
      } else if (t.state === 'leaving') {
        t.x += t.side * 8 * dt;
        if (Math.abs(t.x) > 85) { removeTruckMesh(t.id); S.trucks.splice(i, 1); continue; }
      }
      m.g.position.x = t.x;
      var wantOpen = t.state === 'docked' ? 1 : 0; m.doorA = lerp(m.doorA === undefined ? wantOpen : m.doorA, wantOpen, Math.min(1, dt * 1.5)); m.doors.forEach(function (pv) { pv.rotation.y = pv.userData.openRot * m.doorA; });
      if (m.driver) {
        var docked = t.state === 'docked', want = docked ? 1 : 0;
        m.driver.visible = docked; if (!docked) m.drvD = 0;
        // walk the route by distance; segment 4 (the landing) to 5 (the door) only once the dock door is open
        var R = m.route, doorOpen = doorPassable(doorIndex(t.dir, t.dock)), segLen = function (k) { var a = R[k], b = R[k + 1]; return Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]) + (b[2] - a[2]) * (b[2] - a[2])); };
        var total = 0, landing = 0; for (var sk = 0; sk < R.length - 1; sk++) { if (sk === 4) landing = total; total += segLen(sk); }
        var cap = doorOpen && t.dir === 'in' ? total : landing;   // an outbound driver has nothing to sign: he waits on the landing, clear of the dock loader
        if (docked && m.drvD < cap) m.drvD = Math.min(cap, m.drvD + dt * 1.8);
        var rem = m.drvD, si = 0; while (si < R.length - 2 && rem > segLen(si)) { rem -= segLen(si); si++; } var A = R[si], B = R[si + 1], sl = segLen(si), fr = sl > 0 ? Math.min(1, rem / sl) : 1;
        m.driver.position.set(lerp(A[0], B[0], fr), lerp(A[1], B[1], fr), lerp(A[2], B[2], fr)); m.driver.userData.baseY = lerp(A[1], B[1], fr);
        var moving = docked && m.drvD < cap; if (moving) m.driver.rotation.y = Math.atan2(B[0] - A[0], B[2] - A[2]); else m.driver.rotation.y = t.side < 0 ? Math.PI / 2 : -Math.PI / 2;
        if (docked && !moving && !doorOpen && t.dir === 'in' && m.drvD < total - 0.01 && Math.random() < dt / 20) say(m.driver, pick(['Door is shut, mate.', 'Can someone open this door?', 'Standing out here like a lemon.', 'Any chance of the door?']), '#f5b53d');
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
      S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id && p.n <= 0; }).forEach(function (p) { removePallet(p.id); });   // empties go back with the truck, no harm done
      var left = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id; });
      if (left.length) { left.forEach(function (p) { removePallet(p.id); }); addRep(-Math.min(5, 0.5 * left.length)); S.stats.lost += left.length; logEvent(left.length + ' pallet' + (left.length > 1 ? 's' : '') + ' went back on the truck unreceived', 'bad'); toast('Refused delivery: ' + left.length + ' pallet' + (left.length > 1 ? 's' : '') + ' went back', 'bad'); }
      else { logEvent(t.driver + ' left ' + dockLabel(doorIndex('in', t.dock)) + ' empty', 'good'); }
    } else {
      if (t.parcels.length) { var n = t.parcels.length, sum = 0; t.parcels.forEach(function (oid) { var o = orderById(oid); if (o) sum += shipOrder(o, doorIndex('out', t.dock)); }); toast('Truck out with ' + n + ' parcel' + (n > 1 ? 's' : '') + ' · ' + money(sum), 'good'); logEvent('Outbound truck left ' + dockLabel(doorIndex('out', t.dock)) + ' with ' + n + ' parcels, ' + money(sum) + ' paid', 'good'); if (why === 'dispatched') addXp(XP.truck); }
      else logEvent('Outbound truck left ' + dockLabel(doorIndex('out', t.dock)) + ' empty');
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
    if (player.tool === 'cart' && cartParcels().length) return 'Unload ' + cartParcels().length + ' parcel' + (cartParcels().length === 1 ? '' : 's') + ' from the cart into the truck';
    return 'Outbound trailer · ' + t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded · leaves ' + fmtTime(t.leave);
  }
  function loadUse(tid) {
    var t = truckById(tid); if (!t || t.state !== 'docked') return;
    if (player.tool === 'cart' && cartParcels().length) { var n = 0; cartParcels().slice().forEach(function (oid) { var oc = orderById(oid); if (oc) { t.parcels.push(oc.id); oc.state = 'loaded'; n++; addXp(XP.ship); laneWarn(oc, t); } }); cartParcels().length = 0; sfx('crate'); introStep('load'); rebuildBoardSoon(); feedPush(n + ' parcel' + (n === 1 ? '' : 's') + ' loaded from the cart', 'good'); hudDirty = true; return; }
    if (!(S.hand && S.hand.kind === 'parcel')) return;
    var o = orderById(S.hand.order); if (!o) { handSet(null); return; }
    t.parcels.push(o.id); o.state = 'loaded'; handSet(null); sfx('crate'); addXp(XP.ship); introStep('load'); rebuildBoardSoon();
    feedPush('Parcel #' + o.num + ' loaded for ' + clientName(o.client), 'good'); laneWarn(o, t);
  }
  // a parcel loaded out of the wrong door still ships, for a forwarding fee at departure; say so when it goes aboard
  function laneWarn(o, t) { var m = orderMode(o); if (MODES[m].door === doorIndex('out', t.dock)) return; feedPush('#' + o.num + ' is a ' + m.toUpperCase() + ' parcel: out of ' + dockLabel(doorIndex('out', t.dock)) + ' it pays a forwarding fee (' + Math.round((1 - MODE_FEE) * 100) + '%)', 'bad'); }
  function consolePrompt(i) {
    var t = truckAtDoor(i);
    if (!t) { var k = i - 2; if (!dockOwned(k)) return 'Dock ' + dockLabel(i) + ' · opens with the sortation deck'; var nxt = outNext(k); return 'Dock ' + dockLabel(i) + ' · ' + MODES[TRUCK_OUT[k].mode].name.toLowerCase() + ' lane · no truck · next at ' + fmtTime(nxt.arrive); }
    return t.parcels.length ? 'Dispatch the truck now (' + t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ')' : 'Dock ' + dockLabel(i) + ' · truck waiting, nothing loaded yet';
  }
  function consoleUse(i) {
    var t = truckAtDoor(i); if (!t) { sfx('bad'); return; }
    if (!t.parcels.length) { toast('Nothing loaded yet.', 'bad'); return; }
    sfx('horn'); introStep('dispatch'); truckLeave(t, 'dispatched');
  }
  var boardT = 0; function rebuildBoardSoon() { boardT = 0.01; }
