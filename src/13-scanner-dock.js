//@ the scanner's battery and its wall dock: the charge drains in use, the device sits in a cradle on the wall to charge, a light on the cradle shows it
  // ── The scanner battery and its dock ──────────────────────────────
  // Tyson (2026-10-14): "a charging system behind the scanner ... a dock that sits on the wall where we can charge it ... see the
  // scanner sitting on the wall dock with a little charging light". The charge (S.scanner.batt, 0 to 1) drains slowly on your belt
  // and faster with the screen up; flat, Tab will not raise it. E at the dock puts the scanner in its cradle and takes it out again.
  // While it is docked the device itself (scanDev.g) leaves the camera and rides the cradle at true size, its screen shows the
  // charge, and the light on the cradle's lip pulses amber while it charges and shows steady green when it is full. No power, no charge.
  var SCAN_BATT = { open: 1200, idle: 7200, charge: 120, low: 0.15 };   // seconds: screen-up drain, on-the-belt drain, empty to full in the dock
  var scanDock = { anchor: null, led: null, scale: 1.2, lowSaid: false, drawT: 0 };
  function scanBatt() { if (!S.scanner) S.scanner = { batt: 1, docked: false }; if (typeof S.scanner.batt !== 'number') S.scanner.batt = 1; return S.scanner.batt; }
  function scanDocked() { return !!(S.scanner && S.scanner.docked); }
  function scanCharging() { return scanDocked() && powered() && scanBatt() < 1; }
  // the reason Tab cannot raise the scanner right now, or null when it can
  function scanBlocked() {
    if (scanDocked()) return 'The scanner is in its dock on the wall. E at the dock takes it.';
    if (scanBatt() <= 0) return 'Scanner battery flat. Put it in its dock on the wall to charge.';
    return null;
  }
  function scanDockUse() {
    if (driving) return;
    if (scanDocked()) { S.scanner.docked = false; sfx('pickup'); toast('Scanner taken · battery ' + Math.round(scanBatt() * 100) + '%', scanBatt() < SCAN_BATT.low ? 'bad' : 'good'); }
    else { if (ui.scanOpen) scanToggle(false); S.scanner.docked = true; scanDock.lowSaid = false; sfx('putdown'); toast(powered() ? 'Scanner in its dock: charging' : 'Scanner in its dock. No power: it will not charge.', powered() ? 'good' : 'bad'); }
    hudDirty = true; scanSeat();
  }
  function scanDockPrompt() {
    if (driving) return null; var pct = Math.round(scanBatt() * 100);
    if (scanDocked()) return 'Take the scanner · ' + (pct >= 100 ? 'full' : pct + '%' + (powered() ? ', charging' : ', no power'));
    return 'Put the scanner in its dock · battery ' + pct + '%';
  }
  // the device goes where it belongs: on the camera in your hand, or on the cradle at its true size
  function scanSeat() {
    var g = scanDev.g; if (!g) return;
    if (scanDocked() && scanDock.anchor) {
      if (g.parent !== scene) scene.add(g);
      scanDock.anchor.updateWorldMatrix(true, false); scanDock.anchor.matrixWorld.decompose(g.position, g.quaternion, g.scale); g.visible = true;
      if (scanDev.laser) scanDev.laser.material.opacity = 0;
    } else if (g.parent !== handGroup) { handGroup.add(g); scanDev.t = 0; g.visible = false; }
  }
  // the screen in the cradle: the charge, big
  function drawScanDocked() {
    var c = scanDev.ctx; if (!c) return; var w = SCAN_W, h = SCAN_H, b = scanBatt(), pct = Math.round(b * 100), on = powered(), full = b >= 1;
    c.setTransform(SCAN_RES, 0, 0, SCAN_RES, 0, 0); c.fillStyle = '#0a0f13'; c.fillRect(0, 0, w, h);
    var col = !on ? '#6b7784' : full ? '#5fd38d' : '#f5b53d';
    c.fillStyle = '#a0acb8'; c.font = 'bold 13px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText('DEPOT CO. · DT-8', w / 2, 34);
    var bw = 120, bh = 190, bx = (w - bw) / 2, by = 70;   // the battery: an outline, its cap, the fill
    c.strokeStyle = col; c.lineWidth = 5; c.strokeRect(bx, by, bw, bh); c.fillStyle = col; c.fillRect(bx + bw / 2 - 22, by - 14, 44, 12);
    var fh = Math.round((bh - 16) * b); c.globalAlpha = on && !full ? 0.55 + 0.45 * Math.abs(Math.sin(worldTime * 2)) : 1; c.fillRect(bx + 8, by + bh - 8 - fh, bw - 16, fh); c.globalAlpha = 1;
    if (on && !full) { c.fillStyle = '#0a0f13'; c.font = 'bold 54px Bahnschrift, Arial, sans-serif'; c.fillText('⚡', w / 2, by + bh / 2 + 20); }
    c.fillStyle = col; c.font = 'bold 34px Bahnschrift, Arial, sans-serif'; c.fillText(pct + '%', w / 2, by + bh + 50);
    c.fillStyle = '#a0acb8'; c.font = '13px Bahnschrift, Arial, sans-serif'; c.fillText(!on ? 'NO POWER' : full ? 'CHARGED' : 'CHARGING', w / 2, by + bh + 74); c.textAlign = 'left';
    scanDev.tex.needsUpdate = true;
  }
  // the cradle: a wall plate, a cup that takes the foot of the device, two contacts in the cup, the cable down to a socket, the light on the lip
  function scanDockBuild(c) {
    var plate = std({ color: 0x2b3038, roughness: 0.6, metalness: 0.1 }), cup = std({ color: 0x1d2126, roughness: 0.85 }), K = scanDock.scale;
    var rb = function (w, h, d, r, mat, x, y, z) { var m = new THREE.Mesh(bevelGeo(w, h, d, r, 2), mat); m.position.set(x, y, z); m.castShadow = true; c.group.add(m); return m; };
    var iw = 0.152 * K + 0.012, fy = 1.0, dep = 0.075 * K + 0.012;   // the cup's inner width, its floor, its depth off the plate
    rb(iw + 0.06, 0.52, 0.022, 0.008, plate, 0, 1.22, -0.011);   // the plate on the wall, its face at z 0
    [[-1, 1.46], [1, 1.46], [-1, 0.98], [1, 0.98]].forEach(function (s) { var sc = c.cyl(0.006, 0.004, MAT.chrome, s[0] * (iw / 2 + 0.012), s[1], 0.001, 10); sc.rotation.x = Math.PI / 2; });   // four screws
    rb(iw + 0.024, 0.022, dep, 0.006, cup, 0, fy - 0.011, dep / 2);   // the cup: its floor, its sides, its lip
    [-1, 1].forEach(function (s) { rb(0.012, 0.085, dep, 0.004, cup, s * (iw / 2 + 0.006), fy + 0.03, dep / 2); });
    rb(iw + 0.024, 0.05, 0.014, 0.005, cup, 0, fy + 0.014, dep + 0.007);
    [-0.025, 0.025].forEach(function (x) { c.box(0.014, 0.003, 0.012, std({ color: 0xc9a54a, roughness: 0.3, metalness: 0.9 }), x, fy + 0.0015, dep / 2); });   // the gold charging contacts
    scanDock.led = c.box(0.016, 0.009, 0.004, glowMat(0x5fd38d, 0), iw / 2 - 0.022, fy + 0.026, dep + 0.0145);   // the charging light on the lip
    c.box(0.03, 0.012, 0.003, MAT.black, iw / 2 - 0.022, fy + 0.026, dep + 0.0141);   // its little bezel
    var cab = c.cyl(0.005, fy - 0.38, MAT.black, iw / 2 - 0.01, (fy + 0.38) / 2 - 0.01, 0.006, 6); cab.castShadow = false;   // the lead down the wall to a socket
    c.box(0.07, 0.1, 0.03, std({ color: 0xe8e8e2, roughness: 0.5 }), iw / 2 - 0.01, 0.33, 0.015); c.box(0.028, 0.04, 0.02, MAT.black, iw / 2 - 0.01, 0.34, 0.036);
    c.sign(['SCANNER DOCK'], iw + 0.06, 0.05, 0, 1.52, 0.001, 0, { w: 256, h: 48, bg: '#1b232c', fg: '#5fd38d' });
    var a = new THREE.Object3D(); a.position.set(0, fy + 0.143 * K, 0.033 * K + 0.006); a.rotation.x = -0.05; a.scale.setScalar(K); c.group.add(a); scanDock.anchor = a;   // where the device sits: its foot on the cup floor, its back off the plate
    c.hit(iw + 0.1, 0.62, 0.22, 0, 1.22, 0.08, { prompt: function () { return scanDockPrompt(); }, use: function () { scanDockUse(); } });
    scanSeat();
  }
  defProp('scanDock', { label: 'scanner dock', cat: 'wall', wall: true, x: -16.2, z: 8.6, rot: 0, at: { 0: { x: 6.79, z: 0.4, rot: 3 } }, build: scanDockBuild });   // in the lobby with the time clock, on the north wall right of the notice board; in the shed on the east wall under the order board
  // every frame: the drain, the charge, the light, the seat, the docked screen
  function tickScanBattery(dt) {
    var b = scanBatt(), docked = scanDocked();
    if (docked && !propInst.scanDock) { S.scanner.docked = false; docked = false; }   // the dock was taken down: the scanner comes back to your hand
    if (docked) { if (powered()) S.scanner.batt = Math.min(1, b + dt / SCAN_BATT.charge); }
    else {
      S.scanner.batt = Math.max(0, b - dt / (ui.scanOpen ? SCAN_BATT.open : SCAN_BATT.idle));
      if (S.scanner.batt < SCAN_BATT.low && !scanDock.lowSaid) { scanDock.lowSaid = true; toast('Scanner battery low: ' + Math.round(S.scanner.batt * 100) + '%. Its dock is on the wall.', 'bad'); }
      if (S.scanner.batt <= 0 && ui.scanOpen) { scanToggle(false); sfx('bad'); toast('Scanner battery flat. Put it in its dock on the wall to charge.', 'bad'); }
    }
    if (scanDock.led) { var m = scanDock.led.material; if (!docked || !powered()) m.emissiveIntensity = 0; else if (S.scanner.batt >= 1) { m.emissive.setHex(0x5fd38d); m.emissiveIntensity = 1.4; } else { m.emissive.setHex(0xffa000); m.emissiveIntensity = 0.5 + 1.5 * (0.5 + 0.5 * Math.sin(worldTime * 3)); } }
    scanSeat();
    if (docked) { scanDock.drawT += dt; if (scanDock.drawT > 0.25) { scanDock.drawT = 0; drawScanDocked(); } }
  }
