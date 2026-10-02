//@ the hand scanner: a real device raised into view on Tab, with its own live display
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
      if (S.contract && S.contract.accepted && y < h - 40) y = scanRow(c, y, null, 'Contract: ' + clientName(S.contract.client).slice(0, 16), S.contract.done + ' of ' + S.contract.need + ' by ' + fmtTime(S.contract.until % 24) + ' · ' + money(S.contract.bonus), undefined, true);
      if (S.up.fork) y = scanRow(c, y, null, 'Forklift battery', forkCharging() ? 'charging' : 'in the bay to charge', Math.round((S.fork.batt === undefined ? 1 : S.fork.batt) * 100) + '%', (S.fork.batt || 1) > 0.3);
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
