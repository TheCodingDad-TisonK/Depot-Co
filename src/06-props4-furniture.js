//@ furniture (1.18.1): the rooms get a set of their own, a TV, a dartboard, a microwave, a standing fan, rugs, a bookshelf, a printer and pictures, with a sofa, an armchair, a padded chair and a round table in the shop; what stands in the rooms is the depot's comfort, and comfort shortens the crew's breaks
  // ── Furniture ─────────────────────────────────────────────────────
  // Tyson, 2026-10-08: "try to fit in more furniture stuff... a lot of the furniture can have some upgrades". Every piece here is a
  // prop like the rest (build mode moves it, the catalogue sells more), and the comfort they add up to is what the crew gets out
  // of a break: half an hour bare, a quarter of an hour at full comfort. The TV is a screen like the terminals: it runs the depot's
  // own news while the power is on.
  var FABRIC = std({ color: 0x4a5f7a, roughness: 0.92 }), FABRIC2 = std({ color: 0x8a6d4a, roughness: 0.9 }), OAK = std({ color: 0x9a7a52, roughness: 0.7 }), WALNUT = std({ color: 0x5b3f2a, roughness: 0.65 }), CREAM = std({ color: 0xe8e2d4, roughness: 0.6 }), DARKGREY = std({ color: 0x3a4149, roughness: 0.6, metalness: 0.2 });
  // what counts toward comfort: the pieces placed by default weigh less than what the shop sells, so buying furniture is worth something
  var COMFORT_PROPS = { tv: 1, dartboard: 1, microwave: 1, fanStand: 1, bookshelf: 0.5, rugLobby: 0.25, rugOffice: 0.25, pictureOffice: 0.25, pictureLobby: 0.25, printer: 0 };
  var COMFORT_TYPES = { xSofa: 2, xArmchair: 1, xRoundTable: 1, xPaddedChair: 0.5, xTv: 1, xDartboard: 1, xMicrowave: 1, xFan: 1, xRug: 0.5, xBookshelf: 0.5, xPicture: 0.5, xPrinter: 0, xPlant: 0.25, xCooler: 0.5, xCot: 0.5 };
  function roomComfort() { var n = 0; for (var id in COMFORT_PROPS) if (propInst[id] && !propPlacement(id).hidden) n += COMFORT_PROPS[id]; (S.custom || []).forEach(function (cp) { if (COMFORT_TYPES[cp.type] && propInst[cp.id]) n += COMFORT_TYPES[cp.type]; }); return Math.min(10, Math.round(n * 2) / 2); }
  function breakLen() { return Math.max(0.25, 0.5 - 0.025 * roomComfort()); }   // half an hour bare, a quarter of an hour at comfort 10
  function comfortText() { var cf = roomComfort(); return 'comfort ' + cf + '/10 · breaks ' + Math.round(breakLen() * 60) + ' min'; }
  // ── The TV: a flat screen on a wall bracket, running the depot's news ──
  var TV_LINES = ['Rates on the land lane hold for a third week', 'Sea freight: the port clears its backlog', 'Air parcels up a fifth on last month', 'The gatehouse union asks for a longer lunch', 'A rival depot opens two halls up the road', 'Returns are up across the trade: inspect everything', 'Forklift battery prices fall again', 'The weather desk says: bring a coat'];
  function tvDraw(cc, sc) {
    if (!powered()) { cc.fillStyle = '#05070a'; cc.fillRect(0, 0, sc.w, sc.h); scText(cc, 110, 96, 'NO SIGNAL', '#2a3340', 16); return; }
    cc.fillStyle = '#0b1a2b'; cc.fillRect(0, 0, sc.w, sc.h); var g = cc.createLinearGradient(0, 0, 0, sc.h); g.addColorStop(0, 'rgba(60,120,200,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); cc.fillStyle = g; cc.fillRect(0, 0, sc.w, sc.h);
    cc.fillStyle = '#c8342a'; cc.fillRect(0, 0, sc.w, 30); scText(cc, 12, 21, 'DEPOT NEWS · DAY ' + S.day, '#fff', 15);
    var d = (S.days || [])[0];
    scText(cc, 12, 58, d ? 'Yesterday: ' + (d.shipped || 0) + ' shipped, ' + (d.late || 0) + ' late, ' + money(d.net || 0) + ' net' : 'First day on air: no figures yet', '#eef1f5', 13);
    scText(cc, 12, 80, 'Weather: ' + (S.weather ? S.weather.kind : 'clear') + ' · ' + SEASONS[season()] + ' · bank ' + money(S.bank), '#a0acb8', 12);
    scText(cc, 12, 102, 'Crew: ' + S.staff.filter(function (w) { return w.clocked; }).length + ' on the clock of ' + S.staff.length + ' · ' + comfortText(), '#a0acb8', 12);
    cc.fillStyle = '#f5b53d'; cc.fillRect(0, sc.h - 28, sc.w, 28); var line = TV_LINES[(S.day + Math.floor(S.time / 2)) % TV_LINES.length]; scText(cc, 12, sc.h - 9, line, '#1a1205', 13);
  }
  function tvBuild(c, P, inst) {
    c.box(0.12, 0.3, 0.05, MAT.steelDark, 0, 1.95, 0.0); c.box(0.5, 0.06, 0.06, MAT.steelDark, 0, 1.95, 0.03);   // the wall bracket
    var bez = new THREE.Mesh(bevelGeo(1.14, 0.68, 0.035, 0.01), MAT.black); bez.position.set(0, 1.95, 0.065); bez.castShadow = true; c.group.add(bez);
    c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.5, 1.64, 0.085);
    var scr = touchScreen({ w: 320, h: 180, pw: 1.06, ph: 0.6, x: 0, y: 1.95, z: 0.084, ry: 0, parent: c.group, title: 'TV', draw: tvDraw }); scr.mesh.userData.propId = inst.id;
    c.sign(['DEPOT NEWS · the hall channel'], 0.5, 0.06, 0, 1.56, 0.07, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#a0acb8' });
    c.hit(1.2, 0.8, 0.2, 0, 1.95, 0.05, { prompt: function () { return powered() ? 'The TV · depot news' : 'The TV · no power'; }, use: function () { sfx('click'); screenDirtyAll(); } });
  }
  // ── The dartboard: a cabinet, the board with its rings and three darts in it ──
  function dartboardBuild(c) {
    c.box(0.64, 0.64, 0.05, OAK, 0, 1.73, 0.0); c.box(0.58, 0.58, 0.012, CREAM, 0, 1.73, 0.028);
    var rings = [[0.225, MAT.black], [0.2, CREAM], [0.17, MAT.red], [0.155, CREAM], [0.1, std({ color: 0x1e7a3a, roughness: 0.6 })], [0.088, CREAM], [0.04, std({ color: 0x1e7a3a, roughness: 0.6 })], [0.016, MAT.red]];
    rings.forEach(function (r, i) { var ring = c.cyl(r[0], 0.012 + i * 0.002, r[1], 0, 1.73, 0.04 + i * 0.001, 32); ring.rotation.x = Math.PI / 2; });
    for (var k = 0; k < 20; k++) { var a = k * Math.PI / 10; var wire = c.box(0.004, 0.19, 0.004, MAT.chrome, Math.sin(a) * 0.12, 1.73 + Math.cos(a) * 0.12, 0.06); wire.rotation.z = -a; }
    [[0.03, 1.76], [-0.05, 1.7], [0.09, 1.66]].forEach(function (d, i) { var dart = new THREE.Group(); dart.position.set(d[0], d[1], 0.06); dart.rotation.x = -0.25 - i * 0.08; dart.rotation.y = (i - 1) * 0.15; c.add(dart); cyl(0.004, 0.06, MAT.chrome, 0, 0, 0.03, dart, 6).rotation.x = Math.PI / 2; cyl(0.006, 0.05, std({ color: [0xd14a3a, 0x3fa7d6, 0xf0b94d][i], roughness: 0.5 }), 0, 0, 0.085, dart, 8).rotation.x = Math.PI / 2; box(0.02, 0.028, 0.03, MAT.white, 0, 0, 0.125, dart); });
    c.sign(['DARTS · best of three · loser makes the tea'], 0.56, 0.05, 0, 1.38, 0.03, 0, { w: 512, h: 48, bg: '#1b232c', fg: '#f5b53d' });
    c.hit(0.7, 0.8, 0.2, 0, 1.7, 0.03, { prompt: function () { return 'The dartboard · ' + (S.stats.darts || 0) + ' thrown'; }, use: function () { S.stats.darts = (S.stats.darts || 0) + 1; sfx('click'); toast(pick(['Treble twenty!', 'Just inside the wire.', 'The wall takes one.', 'Bull. Nobody saw it.']), ''); } });
  }
  // ── The microwave: on the coffee counter ──
  function microwaveBuild(c) {
    var body = new THREE.Mesh(bevelGeo(0.5, 0.3, 0.38, 0.012), CREAM); body.position.set(0, 0.15, 0); body.castShadow = true; c.group.add(body);
    c.box(0.3, 0.22, 0.01, MAT.black, -0.07, 0.15, 0.19); c.plane(0.26, 0.18, std({ color: 0x2a3340, roughness: 0.2, metalness: 0.3 }), -0.07, 0.15, 0.196, 0, 0);
    c.box(0.015, 0.2, 0.015, MAT.chrome, 0.1, 0.15, 0.2); c.box(0.1, 0.08, 0.005, MAT.black, 0.19, 0.2, 0.19); c.box(0.01, 0.01, 0.004, glowMat(0x5fd38d, 1.2), 0.19, 0.24, 0.193);
    for (var k = 0; k < 6; k++) c.box(0.02, 0.012, 0.004, DARKGREY, 0.165 + (k % 2) * 0.05, 0.1 - Math.floor(k / 2) * 0.025, 0.193);
    c.cyl(0.02, 0.01, MAT.black, -0.2, 0.005, -0.15, 8); c.cyl(0.02, 0.01, MAT.black, 0.2, 0.005, -0.15, 8); c.cyl(0.02, 0.01, MAT.black, -0.2, 0.005, 0.15, 8); c.cyl(0.02, 0.01, MAT.black, 0.2, 0.005, 0.15, 8);
    c.hit(0.55, 0.35, 0.42, 0, 0.15, 0, { prompt: function () { return powered() ? 'The microwave · two minutes on full' : 'The microwave · no power'; }, use: function () { if (!powered()) { sfx('bad'); return; } sfx('click'); toast('Two minutes on full.', ''); setTimeout(function () { if (powered() && ui.started) { sfx('chime'); toast('Ping.', ''); } }, 2200); } });   // the ping comes after the hum, not with the button
  }
  // ── The standing fan: the head turns while the power is on (its hub joins the ceiling fans' spin) ──
  function fanStandBuild(c) {
    c.cyl(0.24, 0.03, DARKGREY, 0, 0.015, 0, 24); c.cyl(0.02, 1.1, MAT.chrome, 0, 0.58, 0, 10); c.cyl(0.05, 0.12, DARKGREY, 0, 1.18, 0, 12);
    var head = new THREE.Group(); head.position.set(0, 1.24, 0.08); head.rotation.x = -0.15; head.userData.dynamic = true; c.add(head);
    box(0.14, 0.14, 0.16, DARKGREY, 0, 0, -0.1, head); var cage = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 6, 36), MAT.chrome); cage.position.set(0, 0, 0.04); head.add(cage); var cage2 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 6, 36), MAT.chrome); cage2.position.set(0, 0, -0.04); head.add(cage2);
    for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4, bar = box(0.004, 0.46, 0.004, MAT.chrome, 0, 0, 0.045, head); bar.rotation.z = a; }
    var hub = new THREE.Group(); hub.position.set(0, 0, 0); head.add(hub); cyl(0.03, 0.03, MAT.black, 0, 0, 0, hub, 10).rotation.x = Math.PI / 2;
    for (var b = 0; b < 3; b++) { var bl = new THREE.Mesh(bevelGeo(0.07, 0.19, 0.006, 0.01), std({ color: 0xdfe6ec, roughness: 0.4, metalness: 0.3 })); bl.position.set(Math.sin(b * 2.094) * 0.11, Math.cos(b * 2.094) * 0.11, 0); bl.rotation.z = -b * 2.094; bl.rotation.y = 0.5; hub.add(bl); }
    dress.fans.push(hub); dress.fanHeads = dress.fanHeads || []; dress.fanHeads.push(head);   // the hub spins with the ceiling fans; the head sweeps side to side in tickDressing
    c.solid(-0.25, 0.25, -0.25, 0.25, 0, 1.5);
    c.hit(0.5, 1.5, 0.5, 0, 0.75, 0, { prompt: function () { return powered() ? 'The fan · turning' : 'The fan · no power'; }, use: function () { sfx('click'); } });
  }
  // ── A rug: a bordered plane just above the floor ──
  function rugBuild(w, d, col, col2) { return function (c) {
    var t = tex(256, 256, function (cc, W, H) { cc.fillStyle = col; cc.fillRect(0, 0, W, H); cc.strokeStyle = col2; cc.lineWidth = 14; cc.strokeRect(14, 14, W - 28, H - 28); cc.lineWidth = 4; cc.strokeRect(34, 34, W - 68, H - 68); for (var i = 0; i < 400; i++) { cc.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.12) + ')'; cc.fillRect(Math.random() * W, Math.random() * H, 2, 2); } });
    var m = c.plane(w, d, std({ map: t, roughness: 0.95 }), 0, 0.022, 0, -Math.PI / 2, 0); m.receiveShadow = true;
    c.hit(w, 0.1, d, 0, 0.05, 0, { prompt: function () { return 'A rug'; }, use: function () { sfx('click'); } });
  }; }
  // ── The bookshelf: oak, four shelves, the books in runs of colour ──
  function bookshelfBuild(c) {
    var W = 1.2, H = 1.9, D = 0.34; c.box(0.03, H, D, OAK, -W / 2, H / 2, 0); c.box(0.03, H, D, OAK, W / 2, H / 2, 0); c.box(W, 0.03, D, OAK, 0, H - 0.015, 0); c.box(W, 0.03, D, OAK, 0, 0.05, 0); c.box(W, H, 0.015, WALNUT, 0, H / 2, -D / 2 + 0.008);
    [0.5, 0.95, 1.4].forEach(function (y) { c.box(W - 0.06, 0.025, D - 0.02, OAK, 0, y, 0); });
    if (!bookshelfBuild.mats) bookshelfBuild.mats = [0x9c2f2f, 0x2f5a9c, 0x3f8a4a, 0xd8b04a, 0x6b4a8a, 0xe6e2d8, 0x2a2d33, 0xc8742a].map(function (col) { return std({ color: col, roughness: 0.6 }); });   // eight materials for some eighty books, not eighty: the shelf bakes into eight draws
    var cols = bookshelfBuild.mats;
    [0.065, 0.515, 0.965, 1.415].forEach(function (y, row) { var x = -W / 2 + 0.06; while (x < W / 2 - 0.1) { var bw = 0.03 + Math.random() * 0.03, bh = 0.2 + Math.random() * 0.12, lean = Math.random() < 0.12; var bk = c.box(bw, bh, D - 0.08, cols[Math.floor(Math.random() * cols.length)], x + bw / 2, y + bh / 2, 0.01); if (lean) bk.rotation.z = 0.12; x += bw + 0.004; if (Math.random() < 0.08) x += 0.06; } });
    c.box(0.28, 0.26, 0.2, std({ color: 0x9a9890, roughness: 0.5 }), 0.35, H + 0.13, 0); c.cyl(0.06, 0.18, std({ color: 0x3f8a4a, roughness: 0.7 }), -0.35, H + 0.09, 0, 10);   // a box file and a vase on top
    c.solid(-W / 2 - 0.02, W / 2 + 0.02, -D / 2 - 0.02, D / 2 + 0.02, 0, H + 0.3);
    c.hit(W + 0.1, H + 0.4, D + 0.2, 0, H / 2 + 0.15, 0, { prompt: function () { return 'The bookshelf · manuals, ledgers and a thriller somebody left'; }, use: function () { sfx('click'); toast(pick(['"Warehouse Management, 4th ed." Riveting.', '"The Pallet Murders." Chapter three is missing.', 'Last year\'s ledger. Better not.', 'A manual for a forklift you do not own.']), ''); } });
  }
  // ── The printer: on a stand, with a tray of paper and a light that blinks when it has something to say ──
  function printerBuild(c, P, inst) {
    c.box(0.6, 0.04, 0.5, MAT.trim, 0, 0.68, 0); [[-0.27, -0.22], [0.27, -0.22], [-0.27, 0.22], [0.27, 0.22]].forEach(function (l) { c.box(0.03, 0.66, 0.03, MAT.steelDark, l[0], 0.33, l[1]); }); c.box(0.56, 0.02, 0.46, MAT.steelDark, 0, 0.3, 0); c.box(0.4, 0.05, 0.3, MAT.paper, 0, 0.335, 0);
    var body = new THREE.Mesh(bevelGeo(0.5, 0.24, 0.42, 0.015), std({ color: 0xd9dde2, roughness: 0.5 })); body.position.set(0, 0.82, 0); body.castShadow = true; c.group.add(body);
    c.box(0.46, 0.04, 0.2, DARKGREY, 0, 0.96, 0.05); c.box(0.4, 0.015, 0.22, MAT.paper, 0, 0.99, -0.08); c.box(0.36, 0.01, 0.3, MAT.paper, 0, 0.71, 0.3); c.box(0.44, 0.03, 0.02, DARKGREY, 0, 0.78, 0.22);
    c.box(0.14, 0.05, 0.01, MAT.black, 0.15, 0.9, 0.215); inst.led = c.box(0.012, 0.012, 0.005, glowMat(0x5fd38d, 1.0), 0.07, 0.9, 0.217);
    c.solid(-0.32, 0.32, -0.27, 0.27, 0, 1.1);
    c.hit(0.66, 1.1, 0.56, 0, 0.55, 0, { prompt: function () { return powered() ? 'The printer · prints the day report' : 'The printer · no power'; }, use: function () { if (!powered()) { sfx('bad'); return; } sfx('scan'); var d = (S.days || [])[0]; toast(d ? 'Printed: day ' + d.day + ', ' + (d.shipped || 0) + ' shipped, ' + money(d.net || 0) + ' net' : 'Printed a blank sheet: no day report yet', ''); } });
  }
  // ── A picture on the wall: the frame and a canvas drawn here ──
  function pictureTex(kind) {
    return tex(256, 192, function (cc, W, H) {
      if (kind === 'depot') { var g = cc.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f6a35b'); g.addColorStop(0.55, '#f3c777'); g.addColorStop(1, '#4b5566'); cc.fillStyle = g; cc.fillRect(0, 0, W, H); cc.fillStyle = '#ffe9b0'; cc.beginPath(); cc.arc(190, 70, 26, 0, 6.3); cc.fill(); cc.fillStyle = '#2b3440'; cc.fillRect(30, 95, 170, 60); cc.fillRect(20, 85, 190, 12); cc.fillStyle = '#f5b53d'; cc.fillRect(70, 112, 40, 28); cc.fillRect(130, 112, 40, 28); cc.fillStyle = '#1b232c'; cc.fillRect(0, 155, W, H - 155); cc.fillStyle = '#3d4652'; cc.fillRect(205, 125, 42, 24); cc.fillRect(235, 118, 16, 10); cc.fillStyle = '#111'; cc.beginPath(); cc.arc(214, 151, 5, 0, 6.3); cc.arc(240, 151, 5, 0, 6.3); cc.fill(); }
      else if (kind === 'mountains') { var g2 = cc.createLinearGradient(0, 0, 0, H); g2.addColorStop(0, '#5aa2e6'); g2.addColorStop(1, '#cfe6fb'); cc.fillStyle = g2; cc.fillRect(0, 0, W, H); cc.fillStyle = '#5b6f86'; cc.beginPath(); cc.moveTo(0, 150); cc.lineTo(80, 50); cc.lineTo(150, 140); cc.lineTo(200, 70); cc.lineTo(256, 150); cc.closePath(); cc.fill(); cc.fillStyle = '#eef4f8'; cc.beginPath(); cc.moveTo(62, 72); cc.lineTo(80, 50); cc.lineTo(98, 72); cc.closePath(); cc.fill(); cc.fillStyle = '#3f7fb8'; cc.fillRect(0, 150, W, 42); cc.fillStyle = '#2f6b3a'; cc.fillRect(0, 140, W, 14); }
      else { cc.fillStyle = '#eee9df'; cc.fillRect(0, 0, W, H); cc.strokeStyle = '#2b3440'; cc.lineWidth = 6; cc.strokeRect(70, 50, 116, 92); cc.beginPath(); cc.moveTo(70, 50); cc.lineTo(128, 20); cc.lineTo(186, 50); cc.stroke(); cc.fillStyle = '#f5b53d'; cc.fillRect(110, 86, 36, 56); cc.fillStyle = '#2b3440'; cc.font = 'bold 18px Bahnschrift, Arial, sans-serif'; cc.textAlign = 'center'; cc.fillText('SHIP IT', 128, 172); }
    });
  }
  function pictureBuild(kind) { return function (c) {
    var fw = 0.7, fh = 0.52; c.box(fw + 0.06, fh + 0.06, 0.03, WALNUT, 0, 1.7, 0.0); c.box(fw + 0.02, fh + 0.02, 0.01, CREAM, 0, 1.7, 0.02);
    var m = c.plane(fw - 0.04, fh - 0.04, std({ map: pictureTex(kind), roughness: 0.8 }), 0, 1.7, 0.028, 0, 0); m.receiveShadow = false;
    c.hit(0.8, 0.6, 0.12, 0, 1.7, 0.02, { prompt: function () { return kind === 'depot' ? 'A picture: the depot at sunset' : kind === 'mountains' ? 'A picture: mountains, for some reason' : 'A poster: SHIP IT'; }, use: function () { sfx('click'); } });
  }; }
  // ── Seating from the shop: a sofa, an armchair, a padded chair; and a round table ──
  function seatBuild(width, fabric) { return function (c) {
    var w = width, d = 0.85, armW = 0.12;
    c.box(w, 0.42, d, fabric, 0, 0.21, 0); [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]].forEach(function (l) { c.cyl(0.025, 0.1, WALNUT, l[0], 0.05, l[1], 8); });
    c.box(w, 0.5, 0.22, fabric, 0, 0.6, -d / 2 + 0.11);   // the back
    var seats = width > 1.3 ? 2 : 1, sw = (w - armW * 2 - 0.04) / seats;
    for (var k = 0; k < seats; k++) { var cx = -w / 2 + armW + 0.02 + sw * (k + 0.5); var cush = new THREE.Mesh(bevelGeo(sw - 0.03, 0.14, d - 0.3, 0.04), fabric); cush.position.set(cx, 0.49, 0.05); cush.castShadow = true; c.group.add(cush); var back = new THREE.Mesh(bevelGeo(sw - 0.03, 0.42, 0.12, 0.04), fabric); back.position.set(cx, 0.72, -d / 2 + 0.26); back.rotation.x = -0.1; back.castShadow = true; c.group.add(back); }
    [-1, 1].forEach(function (s) { var arm = new THREE.Mesh(bevelGeo(armW, 0.3, d - 0.05, 0.03), fabric); arm.position.set(s * (w / 2 - armW / 2), 0.57, 0); arm.castShadow = true; c.group.add(arm); });
    if (seats === 2) { var cushion = new THREE.Mesh(bevelGeo(0.3, 0.3, 0.08, 0.04), FABRIC2); cushion.position.set(w / 2 - 0.35, 0.76, -d / 2 + 0.33); cushion.rotation.z = 0.2; c.group.add(cushion); }
    c.solid(-w / 2, w / 2, -d / 2, d / 2, 0, 1.0);
    c.hit(w + 0.1, 1.0, d + 0.1, 0, 0.5, 0, { prompt: function () { return seats === 2 ? 'The sofa · the crew\'s favourite' : 'The armchair'; }, use: function () { sfx('click'); toast(pick(['Comfy.', 'Somebody left crumbs.', 'Five minutes. Then back to it.']), ''); } });
  }; }
  function paddedChairBuild(c) {
    var seat = new THREE.Mesh(bevelGeo(0.46, 0.08, 0.46, 0.03), FABRIC); seat.position.set(0, 0.47, 0); seat.castShadow = true; c.group.add(seat);
    var back = new THREE.Mesh(bevelGeo(0.44, 0.42, 0.07, 0.03), FABRIC); back.position.set(0, 0.75, -0.2); back.rotation.x = -0.12; back.castShadow = true; c.group.add(back);
    [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(function (l) { c.cyl(0.014, 0.44, MAT.chrome, l[0], 0.22, l[1], 8); c.cyl(0.02, 0.012, MAT.black, l[0], 0.006, l[1], 8); });
    c.box(0.4, 0.03, 0.03, MAT.chrome, 0, 0.42, -0.19); c.box(0.4, 0.03, 0.03, MAT.chrome, 0, 0.42, 0.19);
    c.solid(-0.24, 0.24, -0.24, 0.24, 0, 0.9);
  }
  function roundTableBuild(c) {
    c.cyl(0.65, 0.04, OAK, 0, 0.74, 0, 36); c.cyl(0.06, 0.7, MAT.steelDark, 0, 0.36, 0, 12); [0, 1, 2, 3].forEach(function (k) { var foot = c.box(0.5, 0.04, 0.06, MAT.steelDark, 0, 0.03, 0); foot.rotation.y = k * Math.PI / 2; foot.position.set(Math.sin(k * Math.PI / 2) * 0.25, 0.03, Math.cos(k * Math.PI / 2) * 0.25); });
    c.cyl(0.045, 0.1, MAT.white, 0.25, 0.81, 0.1, 12); c.cyl(0.045, 0.1, MAT.red, -0.3, 0.81, -0.15, 12); c.box(0.3, 0.012, 0.2, MAT.paper, 0.05, 0.766, -0.25);
    c.solid(-0.66, 0.66, -0.66, 0.66, 0, 0.8);
  }
  // ── The rooms' furniture, in place from the first day ──
  defProp('tv', { label: 'TV', cat: 'wall', wall: true, abs: true, keep: true, x: -31.0, z: -23.83, rot: 0, build: tvBuild });   // the break room's north wall, over the cot
  defProp('dartboard', { label: 'dartboard', cat: 'wall', wall: true, abs: true, keep: true, x: -30.6, z: -20.19, rot: 2, build: dartboardBuild });   // the break room's south wall, by the vending machine
  defProp('microwave', { label: 'microwave', cat: 'room', abs: true, keep: true, x: -35.5, z: -22.5, y: 0.95, rot: 1, build: microwaveBuild });   // on the coffee counter
  defProp('fanStand', { label: 'standing fan', cat: 'room', abs: true, keep: true, x: 29.8, z: 20.8, rot: 1, build: fanStandBuild });   // the office, by the coat stand
  defProp('rugLobby', { label: 'rug', cat: 'room', abs: true, keep: true, x: -33.6, z: 21.6, rot: 0, build: rugBuild(2.0, 2.4, '#6b3f3a', '#d9a12c') });
  defProp('rugOffice', { label: 'rug', cat: 'room', abs: true, keep: true, x: 32.2, z: 21.0, rot: 0, build: rugBuild(2.8, 2.2, '#2f4a5f', '#c9d3dc') });
  defProp('bookshelf', { label: 'bookshelf', cat: 'room', abs: true, keep: true, x: 31.2, z: 23.55, rot: 0, build: bookshelfBuild });   // the office's south wall
  defProp('printer', { label: 'printer', cat: 'room', abs: true, keep: true, x: 30.0, z: 22.6, rot: 2, build: printerBuild });
  defProp('pictureOffice', { label: 'picture', cat: 'wall', wall: true, abs: true, keep: true, x: 29.6, z: 23.83, rot: 2, build: pictureBuild('depot') });
  defProp('pictureLobby', { label: 'picture', cat: 'wall', wall: true, abs: true, keep: true, x: -35.0, z: 18.67, rot: 0, build: pictureBuild('mountains') });
  // ── The shop ──
  defProp('xSofa', { extra: true, label: 'sofa', ico: '🛋️', cat: 'room', price: 220, desc: 'Two seats and a cushion. Comfort +2.', build: seatBuild(1.7, FABRIC) });
  defProp('xArmchair', { extra: true, label: 'armchair', ico: '🪑', cat: 'room', price: 140, desc: 'One seat, deep. Comfort +1.', build: seatBuild(0.95, FABRIC2) });
  defProp('xPaddedChair', { extra: true, label: 'padded chair', ico: '🪑', cat: 'room', price: 45, desc: 'The canteen chair with a cushion. Comfort +0.5.', build: paddedChairBuild });
  defProp('xRoundTable', { extra: true, label: 'round table', ico: '🪵', cat: 'room', price: 90, desc: 'Seats six. Comfort +1.', build: roundTableBuild });
  defProp('xTv', { extra: true, label: 'TV', ico: '📺', cat: 'wall', wall: true, price: 300, desc: 'Depot news on a wall of your choosing. Comfort +1.', build: tvBuild });
  defProp('xDartboard', { extra: true, label: 'dartboard', ico: '🎯', cat: 'wall', wall: true, price: 35, desc: 'Comfort +1.', build: dartboardBuild });
  defProp('xMicrowave', { extra: true, label: 'microwave', ico: '🍱', cat: 'room', price: 110, desc: 'Sits on anything flat. Comfort +1.', build: microwaveBuild });
  defProp('xFan', { extra: true, label: 'standing fan', ico: '🌀', cat: 'room', price: 60, desc: 'Turns while the power is on. Comfort +1.', build: fanStandBuild });
  defProp('xRug', { extra: true, label: 'rug', ico: '🟫', cat: 'room', price: 70, desc: 'Two by two and a half. Comfort +0.5.', build: rugBuild(2.0, 2.5, '#5f3f2f', '#d9a12c') });
  defProp('xBookshelf', { extra: true, label: 'bookshelf', ico: '📚', cat: 'room', price: 130, desc: 'Oak, four shelves. Comfort +0.5.', build: bookshelfBuild });
  defProp('xPrinter', { extra: true, label: 'printer', ico: '🖨️', cat: 'room', price: 160, desc: 'Prints the day report. Comfort +0.', build: printerBuild });
  defProp('xPicture', { extra: true, label: 'picture', ico: '🖼️', cat: 'wall', wall: true, price: 50, desc: 'One of three. Comfort +0.5.', build: function (c, P, inst) { pictureBuild(['depot', 'mountains', 'ship'][Math.floor(propSeed(inst ? inst.id : 'pic', 1) * 3)])(c); } });   // the print is the picture's own: it used to change at every move and reload
