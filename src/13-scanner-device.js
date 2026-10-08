//@ the hand scanner: a real terminal raised into view on Tab, eight pages, a cursor, a go-to waypoint with a floor marker and a heading on the HUD, and a readout of whatever the beam lands on
  // ── The scanner device ────────────────────────────────────────────
  // 1.15.0 (Tyson: "a BIG BIG update to the hand scanner"). The device is a proper terminal now: a sharp 300 x 380 display drawn at
  // double resolution, nine pages picked with the number keys, the wheel walks a cursor down the page, F sets a waypoint on the
  // selected row, Enter does what the row offers (a door, a signature, a dispatch, a pack, a machine's button, a word with a
  // worker: 1.19.0), and the rest of the comment below stands as written in 1.15:
  // highlighted thing (a rack slot, a dock, a machine, a worker) and X clears it. The waypoint is a ring and a beam on the floor and
  // a heading with the distance on the HUD, and it clears itself when you get there. The bottom of the display reads whatever the
  // crosshair is on: a slot, a pallet, a box, a parcel, a truck, a machine, a worker. Every page is a list of rows; the rows carry
  // their own waypoint, so one F does the right thing on any page.
  var scanDev = { g: null, canvas: null, ctx: null, tex: null, t: 0, redrawT: 0, laser: null, laserT: 0, lastFocusKey: null, lastBeep: null, led: null, marker: null, rows: [], navShown: false };
  var SCAN_W = 300, SCAN_H = 380, SCAN_RES = 2;
  function buildScanner() {
    var g = new THREE.Group(); g.userData.dynamic = true; handGroup.add(g); scanDev.g = g;
    var body = std({ color: 0x2b3038, roughness: 0.55 }), rub = std({ color: 0x1b1e23, roughness: 0.95 }), key = std({ color: 0x4a515b, roughness: 0.6 });
    var shell = new THREE.Mesh(bevelGeo(0.12, 0.26, 0.03, 0.008), body); g.add(shell);
    box(0.126, 0.03, 0.034, rub, 0, 0.13, 0, g); box(0.126, 0.03, 0.034, rub, 0, -0.13, 0, g); box(0.012, 0.26, 0.034, rub, -0.063, 0, 0, g); box(0.012, 0.26, 0.034, rub, 0.063, 0, 0, g);
    box(0.07, 0.016, 0.02, glowMat(0xff2a1a, 0.5), 0, 0.146, 0.0, g);   // the scan window on the nose
    var grip = box(0.055, 0.13, 0.045, rub, 0, -0.12, -0.04, g); grip.rotation.x = 0.5; box(0.03, 0.02, 0.02, MAT.yellow, 0, -0.07, -0.058, g);   // the pistol grip and its trigger
    for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) box(0.018, 0.012, 0.006, c === 3 && r === 2 ? MAT.yellow : key, -0.036 + c * 0.024, -0.062 - r * 0.017, 0.017, g);
    scanDev.led = box(0.008, 0.008, 0.004, glowMat(0x5fd38d, 1.2), 0.05, 0.128, 0.017, g);   // the status LED: bright with a waypoint set
    var cv = document.createElement('canvas'); cv.width = SCAN_W * SCAN_RES; cv.height = SCAN_H * SCAN_RES; scanDev.canvas = cv; scanDev.ctx = cv.getContext('2d');
    var tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 8; scanDev.tex = tx;
    var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1267), new THREE.MeshBasicMaterial({ map: tx })); scr.position.set(0, 0.05, 0.016); g.add(scr);
    var gl = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1267), MAT.screenGlass); gl.position.set(0, 0.05, 0.0165); gl.renderOrder = 2; g.add(gl);
    var laser = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.004), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false })); laser.position.set(0, 0.18, 0.6); scanDev.laser = laser; g.add(laser);
    sign(['DEPOT CO. · DT-8'], 0.07, 0.012, 0, -0.118, 0.016, 0, { w: 256, h: 48, bg: '#2b3038', fg: '#a0acb8' }, g);
    g.position.set(0.3, -0.62, -0.42); g.rotation.set(-0.45, -0.35, 0.1); g.scale.set(1.9, 1.9, 1.9); g.visible = false;
    // the waypoint marker: a ring on the floor, a beam of light and a bobbing tip, pulsing
    var m = new THREE.Group(); m.userData.dynamic = true; m.visible = false; scene.add(m); scanDev.marker = m;
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 8, 40), glowMat(0x5fd38d, 1.4)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; m.add(ring);
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x5fd38d, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 3; m.add(beam);
    var tip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 4), glowMat(0x5fd38d, 1.2)); tip.position.y = 1.9; tip.rotation.x = Math.PI; m.add(tip); m.userData.tip = tip;
    drawScanner();
  }
  // ── The pages ─────────────────────────────────────────────────────
  // every page is rows: { text, sub, right, sw (a colour swatch), hi, col, nav: { x, z, y, label } | null, staff: id | null }
  function scanSlotNav(key, label) { var sp = slotStand(key), p = slotParse(key); return { x: sp.x, z: sp.z, y: p.r === UPPER.row ? UPPER.y : 0, label: label || slotName(key) }; }
  function scanPickSlot(sku) {   // the hand-reachable slot of a line nearest to you, floor and shelf levels only
    var best = null, bd = 1e9; slotsWith(sku).forEach(function (k) { var p = slotParse(k); if (p.l >= RACK.top || !slotOwned(k)) return; var sp = slotStand(k), d = dist2(sp.x, sp.z, player.x, player.z); if (d < bd) { bd = d; best = k; } }); return best;
  }
  function scanDoorNav(i) { var at = doorInside(i); return at ? { x: at[0] + (DOOR_MAP[i].dir === 'in' ? 2.0 : -2.0), z: at[1], y: 0, label: 'Dock ' + dockLabel(i) } : null; }
  function scanPropNav(prop, label) { if (!propInst[prop]) return null; var P = propPlacement(prop), a = P.rot * Math.PI / 2; return { x: P.x + Math.sin(a) * 1.6, z: P.z + Math.cos(a) * 1.6, y: prop === 'scanner' ? UPPER.y : 0, label: label || propLabel(prop) }; }   // in front of the prop, whichever way it faces; the sorter's arch is up on the deck
  function scanLane(o) { var m = MODES[orderMode(o)]; return { col: m.col, tag: m.name.toUpperCase() }; }
  function scanPageRows(page) {
    var rows = [];
    if (page === MAP_PAGE) return rows;   // the map draws itself
    if (page === 0) {   // HOME: the day at a glance, then the alerts
      var openN = S.orders.filter(function (o) { return o.state === 'open'; }).length, packedN = S.orders.filter(function (o) { return o.state === 'packed'; }).length, lateN = S.orders.filter(function (o) { return o.late && o.state !== 'shipped'; }).length;
      rows.push({ text: 'Day ' + S.day + ' · ' + fmtTime(S.time) + ' · ' + SEASONS[season()] + (isSunday() ? ' · SUNDAY' : ''), sub: (S.weather ? S.weather.kind : 'clear') + ' · level ' + S.level + ' · ' + S.xp + ' / ' + XP_FOR(S.level) + ' xp', right: money(S.bank), col: '#f5b53d' });
      rows.push({ text: openN + ' open · ' + packedN + ' packed · ' + lateN + ' late', sub: 'rep ' + Math.round(S.rep) + (S.contract && S.contract.accepted ? ' · contract ' + S.contract.done + '/' + S.contract.need : ''), right: 'orders' });
      var docked = S.trucks.filter(function (t) { return t.state === 'docked'; });
      rows.push({ text: docked.length ? docked.map(function (t) { return dockLabel(doorIndex(t.dir, t.dock)); }).join(' · ') + ' docked' : 'No truck at a door', sub: 'next in ' + TRUCK_IN.map(fmtTime).join(' / ') + ' · out ' + TRUCK_OUT.filter(function (dk, i) { return dockOwned(i); }).map(function (dk, i) { return MODES[dk.mode].name.slice(0, 1) + ' ' + fmtTime(outNext(i).arrive); }).join(' · '), right: 'trucks' });
      if (scan.nav) rows.push({ text: '⌖ ' + scan.nav.label, sub: Math.round(Math.sqrt(dist2(scan.nav.x, scan.nav.z, player.x, player.z))) + ' m away · X clears', hi: true, col: '#5fd38d' });
      var al = [];
      if (S.events.power) al.push(['NO POWER', 'reset the breaker in the office', scanPropNav('breaker', 'Breaker panel')]);
      S.trucks.forEach(function (t) { if (t.dir === 'in' && t.state === 'docked' && !t.signed) al.push(['Unsigned delivery at ' + dockLabel(doorIndex('in', t.dock)), 'the driver waits by the door · Enter signs it from here', scanDoorNav(doorIndex('in', t.dock)), scanSignAct(t)]); });
      if (S.pack && S.pack.jam) al.push(['Pack line jammed', 'Enter clears the jam from here', scanPropNav('packline', 'Pack line'), { label: 'CLEAR', run: function () { packUse(); } }]);
      if (S.factory && S.factory.jam) al.push(['Moulding line jammed', 'Enter clears the jam from here', scanPropNav('moulder', 'Moulding line'), { label: 'CLEAR', run: function () { moulderUse(); } }]);
      if (lateN) al.push([lateN + ' late order' + (lateN > 1 ? 's' : ''), 'half pay once shipped · cancelled after 30 h', null]);
      var surN = surplusCount(); if (surN) al.push([surN + ' surplus box' + (surN > 1 ? 'es' : ''), 'Enter puts them back on the racks', scanPropNav('bench', 'Packing bench'), { label: 'RETURN', run: function () { returnSurplus(); } }]);
      var rpn = returnsPending(); if (rpn.length) al.push([rpn.length + ' return' + (rpn.length > 1 ? 's' : '') + ' to inspect', rpn.map(function (r) { return '#' + r.num + ' ' + returnPlaceText(r); }).join(' · '), scanPropNav('returnsDesk', 'Returns desk')]);
      var loose = S.floor.filter(function (f) { return f.kind === 'parcel'; }).length; if (loose) al.push([loose + ' parcel' + (loose > 1 ? 's' : '') + ' on the floor', 'the inspector counts these', null]);
      if (S.up.fork && (S.fork.batt === undefined ? 1 : S.fork.batt) < 0.25) al.push(['Forklift battery ' + Math.round((S.fork.batt || 0) * 100) + '%', 'plug it in at the charger by the south wall', scanPropNav('charger', 'Charger')]);
      for (var id in (S.stage || {})) if (S.stage[id].length >= STAGE_CAP - 1 && LOADER_DOORS[id] !== undefined) al.push([dockLabel(LOADER_DOORS[id]) + ' shipping bay nearly full', S.stage[id].length + ' of ' + STAGE_CAP + ' · it empties when a truck of its lane docks', scanDoorNav(LOADER_DOORS[id])]);
      if (sorterOwned() && S.sort && S.sort.table.length >= 4) al.push(['Sorter turntable backing up', S.sort.table.length + ' parcels going round again', null]);
      if (!al.length) rows.push({ text: 'No alerts', sub: 'everything that needs a hand shows up here', col: '#5fd38d' });
      al.forEach(function (a) { rows.push({ text: '! ' + a[0], sub: a[1], col: '#ff6b5e', nav: a[2], act: a[3] || null }); });
    } else if (page === 1) {   // ORDERS: every open and packed order, oldest due first, its lines and where they are
      var os = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packing' || o.state === 'packed'; }).sort(function (a, b) { return a.due - b.due; });
      if (!os.length) rows.push({ text: 'No orders', sub: 'they arrive from 08:00 on working days', col: '#a0acb8' });
      os.forEach(function (o) {
        var ln = scanLane(o), first = null;
        if (o.state === 'open') o.lines.forEach(function (l) { if (first) return; var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0); if (have < l.qty) { var k = scanPickSlot(l.sku); if (k) first = scanSlotNav(k, skuName(l.sku) + ' for #' + o.num + ' · ' + slotName(k)); } });
        rows.push({ text: '#' + o.num + ' ' + clientName(o.client).slice(0, 18) + (o.rush ? ' RUSH' : ''), sub: ln.tag + ' · ' + dockLabel(MODES[orderMode(o)].door) + ' · due ' + dueText(o.due) + (o.late ? ' LATE' : '') + ' · ' + money(o.pay) + (o.state !== 'open' ? ' · ' + o.state.toUpperCase() : ''), right: o.state === 'open' ? o.lines.reduce(function (a, l) { return a + Math.min(l.qty, S.bench.boxes[l.sku] || 0); }, 0) + '/' + o.lines.reduce(function (a, l) { return a + l.qty; }, 0) : '', col: o.late || o.rush ? '#ff6b5e' : o.state === 'packed' ? '#5fd38d' : '#eef1f5', sw: ln.col, nav: first, hi: o.state === 'packed', act: o.state === 'open' ? { label: 'PACK', on: canPack(o) && powered(), why: !powered() ? 'No power.' : 'Not every box is on the bench yet.', run: function () { packOrder(o); } } : null });
        if (o.state === 'open') o.lines.forEach(function (l) { var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0), k = have < l.qty ? scanPickSlot(l.sku) : null; rows.push({ text: '   ' + skuName(l.sku), sub: '   ' + (have >= l.qty ? 'on the bench' : k ? slotName(k) : stockCount(l.sku) ? 'top level only: forklift' : 'not in stock'), right: have + '/' + l.qty, col: have >= l.qty ? '#5fd38d' : '#a0acb8', sw: SKU[l.sku].col, nav: k ? scanSlotNav(k, skuName(l.sku) + ' · ' + slotName(k)) : null }); });
      });
      var rts = returnsPending(); if (rts.length) { rows.push({ text: 'Returns · ' + rts.length, sub: 'to the returns desk by the bench · ' + money(RETURNS.fee) + ' a return and ' + money(RETURNS.perBox) + ' a box', col: '#f5b53d', nav: scanPropNav('returnsDesk', 'Returns desk') }); rts.forEach(function (r) { var pl = returnPlace(r.id), nav = null; if (pl === 'truck') { var tt = S.trucks.filter(function (x) { return (x.returns || []).indexOf(r.id) >= 0; })[0]; if (tt) nav = scanDoorNav(doorIndex('out', tt.dock)); } else if (pl === 'floor') { var ff = S.floor.filter(function (f) { return f.kind === 'return' && f.id === r.id; })[0]; if (ff) nav = { x: ff.x, z: ff.z, y: 0, label: 'Return #' + r.num }; } else if (pl === 'desk' || pl === 'inspecting') nav = scanPropNav('returnsDesk', 'Returns desk'); rows.push({ text: '   #' + r.num + ' ' + clientName(r.client).slice(0, 16), sub: '   ' + r.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · ' + r.why + ' · ' + returnPlaceText(r), right: pl === 'inspecting' ? 'INSPECTING' : '', col: r.late ? '#ff6b5e' : '#a0acb8', sw: MODES[r.mode] ? MODES[r.mode].col : null, nav: nav }); }); }
    } else if (page === 2) {   // PICKS: one list for every open order together, less the bench and what is already on its way, in walking order
      var need = benchNeed(), fl = pickInFlight(), items = [];
      for (var sku in need) { var n = need[sku] - (fl[sku] || 0); if (n <= 0) continue; var k2 = scanPickSlot(sku); items.push({ sku: sku, n: n, key: k2, p: k2 ? slotParse(k2) : null }); }
      items.sort(function (a, b) { if (!a.key) return 1; if (!b.key) return -1; return (a.p.r - b.p.r) || (a.p.b - b.p.b); });
      if (!items.length) rows.push({ text: 'Nothing to pick', sub: Object.keys(need).length ? 'the cranes and the crew have every box on its way' : 'the bench has every box the open orders want', col: '#5fd38d' });
      items.forEach(function (it, i) { rows.push({ text: it.n + ' × ' + skuName(it.sku), sub: it.key ? slotName(it.key) + (i === 0 ? ' · next' : '') : stockCount(it.sku) ? 'top level only: the forklift reaches it' : 'not on the racks', right: it.key ? rowName(it.p.r).replace('Row ', '') + ' ' + (it.p.b + 1) : '', sw: SKU[it.sku].col, hi: i === 0, nav: it.key ? scanSlotNav(it.key, it.n + ' × ' + skuName(it.sku) + ' · ' + slotName(it.key)) : null }); });
      var sur = benchSurplus(), sn = 0; for (var sk in sur) sn += sur[sk]; if (sn) rows.push({ text: sn + ' surplus on the bench', sub: 'Enter puts it back on the racks, or the cart takes it', col: '#f5b53d', nav: scanPropNav('bench', 'Packing bench'), act: { label: 'RETURN', run: function () { returnSurplus(); } } });
    } else if (page === 3) {   // PUTAWAY: what is on a docked truck and where it should go, pallets on the floor, loose boxes
      var any = false;
      S.trucks.forEach(function (t) { if (t.dir !== 'in' || t.state !== 'docked') return; any = true; var di = doorIndex('in', t.dock), ps = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id && p.n > 0; });
        rows.push({ text: dockLabel(di) + ' · ' + clientName(t.client).slice(0, 16), sub: ps.length + ' pallets aboard · leaves ' + fmtTime(t.leave) + (t.signed ? '' : ' · NOT SIGNED'), col: t.signed ? '#f5b53d' : '#ff6b5e', hi: !t.signed, nav: scanDoorNav(di), act: t.signed ? null : scanSignAct(t) });
        ps.forEach(function (p) { var k = findSlotFor(p.sku, p.n, 1); rows.push({ text: '   ' + p.n + ' × ' + skuName(p.sku), sub: '   ' + (k ? '→ ' + slotName(k) : 'no rack space on the hand levels'), sw: SKU[p.sku].col, col: '#a0acb8', nav: k ? scanSlotNav(k, p.n + ' × ' + skuName(p.sku) + ' → ' + slotName(k)) : null }); }); });
      var flp = S.pallets.filter(function (p) { return p.place === 'floor' && p.n > 0; });
      flp.forEach(function (p) { if (!any) { rows.push({ text: 'On the floor', sub: 'pallets set down and not racked', col: '#f5b53d' }); any = true; } var k = findSlotFor(p.sku, p.n, 1); rows.push({ text: p.n + ' × ' + skuName(p.sku) + (p.wrapped ? ' (wrapped)' : ''), sub: (k ? '→ ' + slotName(k) : 'no rack space') + ' · at ' + p.x.toFixed(0) + ', ' + p.z.toFixed(0), sw: SKU[p.sku].col, nav: { x: p.x, z: p.z, y: 0, label: 'Pallet of ' + skuName(p.sku) } }); });
      var lb = S.floor.filter(function (f) { return f.kind === 'box'; }); if (lb.length) { any = true; rows.push({ text: lb.length + ' loose box' + (lb.length > 1 ? 'es' : '') + ' on the floor', sub: 'the inspector counts these · RETURN SURPLUS racks the undamaged ones', col: '#ff6b5e', nav: { x: lb[0].x, z: lb[0].z, y: 0, label: 'Loose box of ' + skuName(lb[0].sku) }, act: { label: 'RETURN', run: function () { returnSurplus(); } } }); }
      if (!any) rows.push({ text: 'Nothing to put away', sub: 'inbound trucks at ' + TRUCK_IN.map(fmtTime).join(' and '), col: '#5fd38d' });
    } else if (page === 4) {   // STOCK: every line, most first, with its slots, what the orders want of it, and the low ones flagged
      var sum = stockSummary(), keys = Object.keys(sum).sort(function (a, b) { return sum[b] - sum[a]; }), used = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length;
      rows.push({ text: totalStock() + ' boxes · ' + used + ' / ' + slotTotal() + ' slots', sub: S.up.rows + ' main rows' + (upperOwned() ? ' · the deck' : '') + (groundRows().length > S.up.rows ? ' · ' + (groundRows().length - S.up.rows) + ' annex rows' : ''), col: '#f5b53d' });
      if (!keys.length) rows.push({ text: 'The racks are empty', sub: 'the first truck is due at ' + fmtTime(TRUCK_IN[0]), col: '#a0acb8' });
      keys.forEach(function (k) { var want = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === k) want += l.qty; }); }); var sl = slotsWith(k), first = sl.filter(function (q) { return slotParse(q).l < RACK.top; })[0] || sl[0]; rows.push({ text: skuName(k), sub: sl.slice(0, 3).map(slotName).join(' · ') + (sl.length > 3 ? ' +' + (sl.length - 3) : '') + (want ? ' · orders want ' + want : ''), right: String(sum[k]) + (sum[k] < 6 ? ' LOW' : ''), col: sum[k] < 6 ? '#ff6b5e' : '#eef1f5', sw: SKU[k].col, nav: first ? scanSlotNav(first, skuName(k) + ' · ' + slotName(first)) : null }); });
    } else if (page === 5) {   // DOCKS: every door, its lane, its truck, the next window, the shipping bays
      DOOR_MAP.forEach(function (dm, i) { if (!doors[i]) return; var t = truckAtDoor(i), lane = dockLane(i), own = doorOwned(i);
        var sub = !own ? 'opens with the sortation deck' : t ? (t.dir === 'in' ? t.pallets.length + ' pallets · ' + (t.signed ? 'signed' : 'NOT SIGNED') : t.dir === 'ret' ? (t.returns || []).length + ' returns aboard' : t.parcels.length + ' parcels aboard' + (t.returns && t.returns.length ? ' · ' + t.returns.length + ' return' + (t.returns.length > 1 ? 's' : '') : '')) + ' · leaves ' + fmtTime(t.leave) : dm.dir === 'in' ? 'next at ' + TRUCK_IN.map(fmtTime).join(' / ') : dm.dir === 'ret' ? 'returns truck · next at ' + TRUCK_RET.map(fmtTime).join(' / ') : outNextText(dm.dock) + (outNext(dm.dock).tomorrow ? '' : ' to ' + fmtTime(outNext(dm.dock).leave));
        var bayId = null; for (var lid in LOADER_DOORS) if (LOADER_DOORS[lid] === i) bayId = lid; if (bayId && propInst[BAY.at[bayId].prop]) sub += ' · bay ' + stageOf(bayId).length + '/' + STAGE_CAP;
        rows.push({ text: dockLabel(i) + (lane ? ' · ' + lane.name.toUpperCase() : ' · inbound') + ' · ' + (S.doors[i] ? 'OPEN' : 'shut'), sub: sub, right: t ? 'TRUCK' : '', sw: lane ? lane.col : '#f5b53d', hi: !!t, col: own ? '#eef1f5' : '#6b7784', nav: scanDoorNav(i), act: own ? { label: S.doors[i] ? 'CLOSE' : 'OPEN', on: !S.events.power, why: 'No power: the door motor is dead.', run: function () { setDoor(i, !S.doors[i]); } } : null });
        if (t) rows.push({ text: '   ' + (t.dir === 'in' ? 'Inbound' : t.dir === 'ret' ? 'Returns' : (MODES[t.mode] || MODES.land).name) + ' truck · ' + t.driver, sub: '   ' + (t.dir === 'in' ? (t.signed ? 'signed · ' + t.pallets.length + ' pallets' : 'NOT SIGNED') : t.dir === 'out' ? t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded' : (t.returns || []).length + ' returns aboard') + ' · leaves ' + fmtTime(t.leave), col: '#a0acb8', act: t.dir === 'in' ? (t.signed ? null : scanSignAct(t)) : t.dir === 'out' ? { label: 'DISPATCH', on: t.parcels.length > 0, why: 'Nothing loaded yet.', run: function () { consoleUse(i); } } : null }); });
      var packedBy = {}; S.orders.forEach(function (o) { if (o.state === 'packed') { var m = orderMode(o); packedBy[m] = (packedBy[m] || 0) + 1; } });
      rows.push({ text: 'Waiting to ship: sea ' + (packedBy.sea || 0) + ' · land ' + (packedBy.land || 0) + ' · air ' + (packedBy.air || 0), sub: 'wrong door pays a ' + Math.round((1 - MODE_FEE) * 100) + '% fee · misrouted so far ' + (S.stats.misrouted || 0), col: '#a0acb8' });
    } else if (page === 6) {   // PLANT: every machine, jams first
      var pr = plantRows().filter(function (r) { return !r.dialOnly; });
      pr.sort(function (a, b) { return (/jam|off/.test(b.text) ? 1 : 0) - (/jam|off/.test(a.text) ? 1 : 0); });
      pr.forEach(function (r) { var parts = r.text.split('  ·  '), name = parts[0].trim(), st = parts.slice(1).join(' '), prop = ({ 'Pack line': 'packline', 'Moulding line': 'moulder', 'Palletiser': 'palletiser', 'Baler': 'baler', 'Stretch wrapper': 'wrapper', 'AGV-1': 'agvDock', 'Goods lift': 'lift', 'Sortation deck': 'scanner', 'Bench surplus': 'bench' })[name] || (/^Gantry /.test(name) ? 'gantry' + (name === 'Gantry upper' ? 5 : 'ABCDEF'.indexOf(name.slice(7))) : /^Dock loader/.test(name) ? 'dockLoader' + (+name.slice(-1)) : null);
        rows.push({ text: name + (st ? ' · ' + st : ''), sub: String(r.sub || '').slice(0, 60), right: r.right || '', col: /jam|off|paused/.test(st) ? '#ff6b5e' : r.hi ? '#5fd38d' : '#eef1f5', hi: /jam/.test(st), nav: prop ? scanPropNav(prop, name) : null, act: r.btn ? { label: String(r.btn.label), on: r.btn.on !== false, why: 'Not now.', run: r.btn.act } : null }); });
      if (!pr.length) rows.push({ text: 'No machines yet', sub: 'the pack line comes with the bench', col: '#a0acb8' });
    } else {   // CREW: who is in, what they are at, and you
      if (!S.staff.length) rows.push({ text: 'No crew', sub: 'hire on the office PC from level 3', col: '#a0acb8' });
      S.staff.forEach(function (st) { var task = st.task ? (st.task.kind === 'pick' ? 'picking ' + skuName(st.task.sku) : st.task.kind === 'fetch' ? 'fetching a pallet' : st.task.kind === 'return' ? 'returning ' + skuName(st.task.sku) : st.task.kind === 'rdesk' ? 'taking a return to the desk' : /^ret/.test(st.task.kind) ? 'on the returns' : st.task.kind) : st.carry ? (st.carry.kind === 'box' ? 'carrying ' + skuName(st.carry.sku) : st.carry.kind === 'return' ? 'carrying a return' : 'carrying a parcel') : st.state === 'drive' ? 'on the forklift' : st.state === 'break' ? 'on break' : staffStatus(st);
        rows.push({ text: st.name + ' · ' + STAFF_ROLES[st.role].name + (st.cross ? ' +' + STAFF_ROLES[st.cross].name.toLowerCase() : ''), sub: task + ' · ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h today · ' + (st.shift || 'day') + ' shift' + (st.trained ? ' · trained' : '') + (st.lateToday ? ' · late' : ''), right: st.clocked ? 'IN' : '', hi: !!st.clocked, col: st.clocked ? '#eef1f5' : '#a0acb8', staff: st.id, nav: st.clocked ? { x: st.x, z: st.z, y: 0, label: st.name } : null, act: st.lateToday && !st.wordToday ? { label: 'WORD', run: function () { staffWord(st); } } : { label: 'SHIFT ▸', run: function () { staffShiftCycle(st); } } }); });
      rows.push({ text: S.clockedIn ? 'You · on the clock since ' + fmtTime(S.clockInAt) : 'You · not clocked in', sub: S.clockedIn ? (Math.round(myHours() * 10) / 10) + ' h this shift' : 'the time clock is by the staff door', right: '', col: S.clockedIn ? '#5fd38d' : '#f5b53d', nav: scanPropNav('timeclock', 'Time clock'), act: { label: S.clockedIn ? 'CLOCK OUT' : 'CLOCK IN', run: function () { myClock(!S.clockedIn); } } });
      if (S.up.fork) rows.push({ text: 'Forklift · battery ' + Math.round((S.fork.batt === undefined ? 1 : S.fork.batt) * 100) + '%', sub: forkCharging() ? 'charging' : S.fork.plugged ? 'plugged in, full' : 'not plugged in', col: (S.fork.batt === undefined ? 1 : S.fork.batt) > 0.3 ? '#eef1f5' : '#ff6b5e', nav: { x: S.fork.x, z: S.fork.z, y: 0, label: 'Forklift' } });
    }
    return rows;
  }
  // ── The readout of what the beam is on ────────────────────────────
  function scanReadout() {
    if (!focus) return null;
    if (focus.slot) { var sl = S.slots[focus.slot], want = 0, sk = sl && sl.sku; if (sk) S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === sk) want += l.qty; }); }); return { key: 'slot:' + focus.slot, head: slotName(focus.slot), body: sl && sl.n ? sl.n + ' × ' + skuName(sl.sku) + (sl.pal ? ' on a pallet' : '') + (want ? ' · orders want ' + want : '') : sl && sl.pal ? 'an empty pallet' : 'empty · ' + ECON.slotCap + ' boxes of one line fit' }; }
    var src = focus.src;
    if (src) {
      if (src.kind === 'truckReturn' || src.kind === 'rdeskq' || src.kind === 'rdeskcur' || (src.kind === 'floor' && S.floor[src.idx] && S.floor[src.idx].kind === 'return')) { var rid = src.kind === 'truckReturn' ? src.id : src.kind === 'rdeskq' ? rdesk().queue[src.idx] : src.kind === 'rdeskcur' ? rdesk().cur : S.floor[src.idx].id, rr = returnById(rid); if (rr) return { key: 'ret:' + rr.id, head: returnLabel(rr), body: rr.lines.map(function (l) { return l.qty + ' × ' + skuName(l.sku); }).join(', ') + ' · ' + rr.why + ' · ' + money(returnFee(rr)) + ' fee at the desk' }; }
      if (src.kind === 'pallet') { var p = palletById(src.id); if (p) { var k = p.n ? findSlotFor(p.sku, p.n, 1) : null; return { key: 'pal:' + p.id, head: p.n ? p.n + ' × ' + skuName(p.sku) : 'Empty pallet', body: (p.wrapped ? 'wrapped · ' : '') + (p.place === 'truck' ? 'on the truck' : p.place === 'floor' ? 'on the floor' : p.place) + (k ? ' · goes to ' + slotName(k) : '') }; } }
      var oid = src.kind === 'shelf' || src.kind === 'stage' ? src.order : src.kind === 'belt' && src.item && src.item.kind === 'parcel' ? src.item.order : src.kind === 'floor' && S.floor[src.idx] && S.floor[src.idx].kind === 'parcel' ? S.floor[src.idx].order : src.kind === 'cart' && src.idx >= S.cart.boxes.length ? (S.cart.parcels || [])[src.idx - S.cart.boxes.length] : null;
      var o = oid ? orderById(oid) : null;
      if (o) { var m = MODES[orderMode(o)]; return { key: 'par:' + o.id, head: 'Parcel #' + o.num + ' · ' + clientName(o.client).slice(0, 16), body: m.name.toUpperCase() + ' lane · out by ' + dockLabel(m.door) + ' · due ' + dueText(o.due) + (o.form ? ' · ' + o.form : '') + (o.late ? ' · LATE' : '') }; }
      var bsku = src.kind === 'bench' ? src.sku : src.kind === 'belt' && src.item && src.item.kind === 'box' ? src.item.sku : src.kind === 'floor' && S.floor[src.idx] && S.floor[src.idx].kind === 'box' ? S.floor[src.idx].sku : src.kind === 'cart' && src.idx < S.cart.boxes.length ? S.cart.boxes[src.idx] : src.kind === 'rdesk' && rdesk().shelf[src.idx] ? rdesk().shelf[src.idx].sku : null;
      if (bsku) { var w2 = 0; S.orders.forEach(function (o2) { if (o2.state === 'open') o2.lines.forEach(function (l) { if (l.sku === bsku) w2 += l.qty; }); }); return { key: 'box:' + bsku + ':' + src.kind, head: 'Box of ' + skuName(bsku), body: (src.kind === 'bench' ? 'on the bench' : src.kind === 'belt' ? 'riding the ' + beltLabel(BELTS[src.belt]) : src.kind === 'floor' ? 'loose on the floor' : src.kind === 'rdesk' ? (rdesk().shelf[src.idx].damaged ? 'a damaged return: for the bin' : 'a return: back on a rack') : 'on the cart') + (w2 ? ' · orders want ' + w2 : ' · no open order wants it') }; }
    }
    if (focus.truck) { var t = truckById(focus.truck); if (t) return { key: 'truck:' + t.id, head: (t.dir === 'in' ? 'Inbound' : (MODES[t.mode] || MODES.land).name + ' truck') + ' at ' + dockLabel(doorIndex(t.dir, t.dock)), body: (t.dir === 'in' ? t.pallets.length + ' pallets · ' + (t.signed ? 'signed' : 'not signed yet') : t.parcels.length + ' parcels aboard') + ' · leaves ' + fmtTime(t.leave) + ' · ' + t.driver }; }
    if (focus.staffId) { var st = staffById(focus.staffId); if (st) return { key: 'staff:' + st.id, head: st.name + ' · ' + STAFF_ROLES[st.role].name, body: staffStatus(st) + ' · ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h today' }; }
    if (focus.prop) { var pr = plantRows().filter(function (r) { return !r.dialOnly; }), lbl = propLabel(focus.prop), hit = pr.filter(function (r) { return r.key === focus.prop; })[0] || pr.filter(function (r) { return r.text.toLowerCase().indexOf(lbl.toLowerCase().split(' ')[0]) === 0; })[0]; return { key: 'prop:' + focus.prop, head: lbl.charAt(0).toUpperCase() + lbl.slice(1), body: hit ? hit.text.split('  ·  ').slice(1).join(' · ') + (hit.right ? ' · dial ' + hit.right : '') : (focusText || '').slice(0, 60) }; }
    return null;
  }
  // ── Drawing ───────────────────────────────────────────────────────
  var SCAN_ICONS = ['⌂', '≡', '✓', '▣', '▤', '⇄', '⚙', '☺', '⊞'];
  function scanFit(c, s, maxW) { s = String(s); if (c.measureText(s).width <= maxW) return s; var lo = 0, hi = s.length; while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (c.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1; } return s.slice(0, lo).replace(/[\s·]+$/, '') + '…'; }   // the longest prefix that fits with an ellipsis
  function drawScanner() {
    var c = scanDev.ctx; if (!c) return; var w = SCAN_W, h = SCAN_H; c.setTransform(SCAN_RES, 0, 0, SCAN_RES, 0, 0);
    c.fillStyle = '#0a0f13'; c.fillRect(0, 0, w, h); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(245,181,61,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f5b53d'; c.font = 'bold 15px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.fillText(SCAN_PAGES[scan.page].toUpperCase(), 12, 20);
    c.fillStyle = '#a0acb8'; c.font = '11px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(fmtTime(S.time) + '  ▮▮▮', w - 12, 20); c.textAlign = 'left';
    var tn = SCAN_PAGES.length, tw = Math.floor((w - 24 - (tn - 1) * 3) / tn);
    for (var p = 0; p < tn; p++) { var tx = 12 + p * (tw + 3); c.fillStyle = p === scan.page ? '#f5b53d' : 'rgba(255,255,255,0.08)'; c.fillRect(tx, 28, tw, 18); c.fillStyle = p === scan.page ? '#1a1205' : '#a0acb8'; c.font = 'bold 10px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText((p + 1) + ' ' + SCAN_ICONS[p], tx + tw / 2, 41); }
    c.textAlign = 'left';
    var footH = 52;
    if (scan.page === MAP_PAGE) { scanDev.rows = []; drawScanMap(c, 8, 54, w - 16, h - 54 - footH - 6); drawScanFoot(c, w, h, footH); scanDev.tex.needsUpdate = true; return; }
    var rows = scanPageRows(scan.page); scanDev.rows = rows; if (scan.sel >= rows.length) scan.sel = Math.max(0, rows.length - 1); if (scan.sel < 0) scan.sel = 0;
    var y0 = 56, rowH = 30, maxRows = Math.floor((h - y0 - footH - 10) / rowH);   // ten px kept for the page counter under the last row
    if (scan.sel < scan.scroll) scan.scroll = scan.sel; if (scan.sel >= scan.scroll + maxRows) scan.scroll = scan.sel - maxRows + 1; scan.scroll = clamp(scan.scroll, 0, Math.max(0, rows.length - maxRows));   // the view follows the cursor (this line sat inside a comment from 1.16.0 to 1.19.0, so long pages never scrolled)
    var y = y0;
    rows.slice(scan.scroll, scan.scroll + maxRows).forEach(function (r, i) {
      var idx = scan.scroll + i, sel = idx === scan.sel;
      c.fillStyle = sel ? 'rgba(245,181,61,0.22)' : r.hi ? 'rgba(95,211,141,0.1)' : 'rgba(255,255,255,0.04)'; c.fillRect(8, y, w - 16, rowH - 3);
      if (sel) { c.fillStyle = '#f5b53d'; c.fillRect(8, y, 3, rowH - 3); }
      var x = 14; if (r.sw) { c.fillStyle = r.sw; c.fillRect(x, y + 6, 8, 14); x += 14; }
      var rightW = 0; if (r.right) { c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; rightW = c.measureText(String(r.right)).width + 8; }
      c.fillStyle = r.col || '#eef1f5'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, r.text, w - 14 - x - rightW), x, y + 11);
      var al = r.act ? '⏎ ' + r.act.label : null, actW = 0; if (al) { c.font = 'bold 9px Bahnschrift, Arial, sans-serif'; actW = c.measureText(al).width + 14; }
      if (r.sub) { c.fillStyle = '#a0acb8'; c.font = '9px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, r.sub, w - 14 - x - (r.nav ? 16 : 0) - actW), x, y + 23); }
      if (al) { var aw = actW - 4, ax = w - 14 - aw - (r.nav ? 14 : 0), off = r.act.on === false; c.fillStyle = off ? 'rgba(255,255,255,0.08)' : sel ? '#f5b53d' : 'rgba(245,181,61,0.3)'; c.fillRect(ax, y + 15, aw, 12); c.fillStyle = off ? '#6b7784' : sel ? '#1a1205' : '#eef1f5'; c.font = 'bold 9px Bahnschrift, Arial, sans-serif'; c.fillText(al, ax + 5, y + 24); }
      if (r.right) { c.fillStyle = r.hi ? '#5fd38d' : '#f5b53d'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(String(r.right), w - 14, y + 11); c.textAlign = 'left'; }
      if (r.nav) { c.fillStyle = sel ? '#f5b53d' : 'rgba(255,255,255,0.25)'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('⌖', w - 14, y + 23); c.textAlign = 'left'; }
      y += rowH;
    });
    if (rows.length > maxRows) { c.fillStyle = '#6b7784'; c.font = '9px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText((scan.scroll + 1) + '-' + Math.min(rows.length, scan.scroll + maxRows) + ' of ' + rows.length + ' · wheel', w - 12, h - footH - 4); c.textAlign = 'left'; }
    drawScanFoot(c, w, h, footH);
    scanDev.tex.needsUpdate = true;
  }
  // the band at the foot of the display: the readout of what the beam is on, else the waypoint, else the key hints
  function drawScanFoot(c, w, h, footH) {
    var rd = scanReadout(), fy = h - footH;
    if (rd) { c.fillStyle = 'rgba(95,211,141,0.15)'; c.fillRect(0, fy, w, footH); c.fillStyle = '#5fd38d'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, '▶ ' + rd.head, w - 24), 12, fy + 16); c.fillStyle = '#eef1f5'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, rd.body, w - 24), 12, fy + 31); }
    else if (scan.nav) { var d = Math.sqrt(dist2(scan.nav.x, scan.nav.z, player.x, player.z)); c.fillStyle = 'rgba(245,181,61,0.14)'; c.fillRect(0, fy, w, footH); c.fillStyle = '#f5b53d'; c.font = 'bold 11px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, scanArrow() + ' ' + scan.nav.label, w - 24), 12, fy + 16); c.fillStyle = '#eef1f5'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.fillText(Math.round(d) + ' m · X clears the waypoint', 12, fy + 31); }
    else { c.fillStyle = '#6b7784'; c.font = '10px Bahnschrift, Arial, sans-serif'; c.fillText(scanFit(c, 'Point the beam at a slot, a pallet, a parcel, a truck or a machine', w - 24), 12, fy + 16); c.fillText(scanFit(c, '1-9 pages · wheel · F waypoint on ⌖ · Enter acts on ⏎ rows', w - 24), 12, fy + 31); }
    c.fillStyle = '#6b7784'; c.font = '8px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('Tab closes', w - 12, h - 6); c.textAlign = 'left';
  }
  // ── The waypoint ──────────────────────────────────────────────────
  function scanArrow() {
    if (!scan.nav) return ''; var yawTo = Math.atan2(-(scan.nav.x - player.x), -(scan.nav.z - player.z)), rel = yawTo - player.yaw; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
    var a = Math.abs(rel); return a < Math.PI / 8 ? '↑' : a < 3 * Math.PI / 8 ? (rel > 0 ? '↖' : '↗') : a < 5 * Math.PI / 8 ? (rel > 0 ? '←' : '→') : a < 7 * Math.PI / 8 ? (rel > 0 ? '↙' : '↘') : '↓';
  }
  // signing a delivery note from the scanner, the way the console does it
  function scanSignAct(t) { return { label: 'SIGN', run: function () { var tt = truckById(t.id); if (!tt || tt.state !== 'docked' || tt.signed) { sfx('bad'); return; } signTruck(tt); var dm = truckMeshes[tt.id]; if (dm && dm.driver) say(dm.driver, pick(DRIVER_LINES.signed), '#5fd38d'); } }; }
  // Enter: the selected row's action, when it has one (1.19.0: the scanner does things, not just shows them)
  function scanAct() {
    var r = scanDev.rows[scan.sel]; if (!r || !r.act) { sfx('bad'); toast('Nothing to do on that row. ⏎ marks the rows that act.', ''); return false; }
    if (r.act.on === false) { sfx('bad'); toast(r.act.why || 'Not now.', 'bad'); return false; }
    r.act.run(); sfx('click'); hudDirty = true; screenDirtyAll(); drawScanner(); return true;
  }
  function scanGo() {
    var r = scanDev.rows[scan.sel]; if (!r || !r.nav) { sfx('bad'); toast('Nothing to go to on that row.', ''); return; }
    scan.nav = { x: r.nav.x, z: r.nav.z, y: r.nav.y || 0, label: r.nav.label, staff: r.staff || null }; sfx('scan'); toast('Waypoint: ' + scan.nav.label, 'good'); drawScanner();
  }
  function scanClearNav(quiet) { if (!scan.nav) return; scan.nav = null; if (!quiet) { sfx('click'); toast('Waypoint cleared', ''); } if (scanDev.marker) scanDev.marker.visible = false; if (scanDev.navShown && !driving && !pc.on) { $('h-drive').hidden = true; scanDev.navShown = false; } drawScanner(); }
  function scanScroll(dir) { var n = scanDev.rows.length; if (!n) return; scan.sel = clamp(scan.sel + dir, 0, n - 1); drawScanner(); }
  function tickScanner(dt) {
    if (!scanDev.g) return;
    var want = ui.scanOpen && !driving ? 1 : 0;
    scanDev.t = lerp(scanDev.t, want, 1 - Math.pow(0.002, dt));
    scanDev.g.visible = scanDev.t > 0.02;
    scanDev.g.position.set(0.26 - scanDev.t * 0.06, -0.62 + scanDev.t * 0.42, -0.42 + scanDev.t * 0.04); scanDev.g.rotation.set(-0.45 + scanDev.t * 0.3, -0.35 + scanDev.t * 0.15, 0.1);
    if (scanDev.laserT > 0) { scanDev.laserT -= dt; scanDev.laser.material.opacity = Math.max(0, scanDev.laserT * 3); }
    if (scanDev.led) scanDev.led.material.emissiveIntensity = scan.nav ? 1.2 + Math.sin(worldTime * 6) * 0.6 : 0.15;
    if (scan.nav) {
      if (scan.nav.staff) { var st = staffById(scan.nav.staff); if (st) { scan.nav.x = st.x; scan.nav.z = st.z; } else { scanClearNav(true); return; } }   // a waypoint on someone let go goes with them
      var m = scanDev.marker, d = Math.sqrt(dist2(scan.nav.x, scan.nav.z, player.x, player.z));
      if (m) { m.visible = true; m.position.set(scan.nav.x, scan.nav.y || floorY(scan.nav.x, scan.nav.z, 0), scan.nav.z); var pulse = 1 + Math.sin(worldTime * 4) * 0.08; m.scale.set(pulse, 1, pulse); m.userData.tip.position.y = 1.9 + Math.sin(worldTime * 3) * 0.15; }
      if (!driving && !pc.on && ui.started) { $('h-drive').hidden = false; $('h-drive').innerHTML = scanArrow() + ' <b>' + esc(scan.nav.label) + '</b> · ' + Math.round(d) + ' m · X clears'; scanDev.navShown = true; }
      if (d < 1.6 && Math.abs((scan.nav.y || 0) - player.y) < 1.5) { toast('You are at ' + scan.nav.label, 'good'); sfx('scan'); scanClearNav(true); }
    } else if (scanDev.navShown && !driving && !pc.on) { $('h-drive').hidden = true; scanDev.navShown = false; }
    if (ui.scanOpen) {
      scanDev.redrawT += dt; var rd = scanReadout(), keyNow = rd ? rd.key : null;
      if (scanDev.redrawT > 0.5 || keyNow !== scanDev.lastFocusKey) { scanDev.redrawT = 0; scanDev.lastFocusKey = keyNow; drawScanner(); if (keyNow && keyNow !== scanDev.lastBeep) { scanDev.lastBeep = keyNow; sfx('scan'); scanDev.laserT = 0.3; } }
    }
  }
