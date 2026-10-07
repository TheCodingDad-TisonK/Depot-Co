//@ the scanner's map page: the site from above, with you, the crew, the trucks and the waypoint on it
  // ── The map page ──────────────────────────────────────────────────
  // 1.16.0. Page 9 on the scanner draws the whole site from above at the scale that fits what you own: the main hall with its
  // rack rows, docks and rooms, the production wing, the annex halls once bought (dashed outlines from level 7 until then), the
  // mezzanine, and the aprons. Live on it: you (the white arrow points the way you look), the crew, the forklift, the AGV, the
  // trucks at the docks, and the waypoint ring. North is up; the inbound docks are on the left.
  var MAP_PAGE = 8;
  function mapBounds() {
    var b = { x0: -HALL.x - 16, x1: HALL.x + 16, z0: WING.z0 - 2, z1: HALL.z + 3 };   // the hall, the wing, and the trucks on both aprons
    for (var h in HALLS) if (hallOwned(h) || S.level >= 7) { var H = HALLS[h]; b.x0 = Math.min(b.x0, H.x0 - (H.dockIn !== undefined ? 16 : 2)); b.x1 = Math.max(b.x1, H.x1 + 2); b.z0 = Math.min(b.z0, H.z0 - 2); }
    return b;
  }
  function drawScanMap(c, x, y, w, h) {
    var b = mapBounds(), s = Math.min(w / (b.x1 - b.x0), h / (b.z1 - b.z0)), ox = x + (w - (b.x1 - b.x0) * s) / 2, oz = y + (h - (b.z1 - b.z0) * s) / 2;
    var X = function (wx) { return ox + (wx - b.x0) * s; }, Z = function (wz) { return oz + (wz - b.z0) * s; };
    var rect = function (x0, x1, z0, z1, fill, stroke, dash) { c.beginPath(); c.rect(X(Math.min(x0, x1)), Z(Math.min(z0, z1)), Math.abs(x1 - x0) * s, Math.abs(z1 - z0) * s); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; if (dash) c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); } };
    var label = function (t, wx, wz, col, size, align) { c.fillStyle = col || '#a0acb8'; c.font = (size || 8) + 'px Bahnschrift, Arial, sans-serif'; c.textAlign = align || 'center'; c.fillText(t, X(wx), Z(wz)); c.textAlign = 'left'; };
    c.fillStyle = '#0f151b'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,255,255,0.035)'; c.fillRect(X(-HALL.x - 16), Z(-17), 16 * s, 14 * s); c.fillRect(X(HALL.x), Z(-25), 16 * s, 22 * s);   // the aprons the trucks back onto
    var FLOOR = 'rgba(120,140,160,0.13)', WALL = 'rgba(200,215,230,0.55)';
    rect(-HALL.x, HALL.x, -HALL.z, HALL.z, FLOOR, WALL);
    rect(WING.x0, WING.x1, WING.z0, WING.z1, FLOOR, WALL); label('WING', (WING.x0 + WING.x1) / 2, WING.z0 + 3.2, '#6b7784', 8);
    for (var hk in HALLS) { var H = HALLS[hk], own = hallOwned(hk); if (!own && S.level < 7) continue; rect(H.x0, H.x1, H.z0, H.z1, own ? FLOOR : null, own ? WALL : 'rgba(200,215,230,0.22)', !own); label(H.name.toUpperCase(), (H.x0 + H.x1) / 2, H.z0 + 3.2, own ? '#6b7784' : '#3d4652', 8); }
    rect(HALL.x - 7.5, HALL.x, 18.5, HALL.z, 'rgba(245,181,61,0.08)', 'rgba(245,181,61,0.35)'); label('OFFICE', HALL.x - 3.75, 21.8, '#f5b53d', 7);
    rect(-HALL.x, -HALL.x + 4.5, 18.5, HALL.z, null, 'rgba(200,215,230,0.3)'); label('LOBBY', -HALL.x + 2.25, 21.8, '#6b7784', 6);
    rect(-HALL.x, -HALL.x + 7, -HALL.z, -20.2, null, 'rgba(200,215,230,0.3)'); label('BREAK', -HALL.x + 3.5, -21.6, '#6b7784', 6);
    if (upperOwned()) { rect(-HALL.x, HALL.x, UPPER.z0, UPPER.z1, 'rgba(120,189,245,0.08)', 'rgba(120,189,245,0.3)'); label(sorterOwned() ? 'SORTATION DECK' : 'MEZZANINE', 0, UPPER.z1 - 1.0, '#78bdf5', 7); }
    // the rack rows you own, lettered, and the upper row
    groundRows().forEach(function (r) { var p0 = rackSlotPos(r, 0, 0), p1 = rackSlotPos(r, rowBays(r) - 1, 0), lo = Math.min(p0.x, p1.x) - RACK.bayW / 2, hi = Math.max(p0.x, p1.x) + RACK.bayW / 2; rect(lo, hi, p0.z - RACK.depth / 2, p0.z + RACK.depth / 2, 'rgba(245,181,61,0.55)', null); label(rowLetter(r), lo - 1.0, p0.z + 1.0, '#f5b53d', 7, 'right'); });
    // the docks: a notch on the wall in the lane colour, the label, and the truck when one is in
    DOOR_MAP.forEach(function (dm, i) { var d = doors[i]; if (!d) return; var lane = dockLane(i), col = lane ? lane.col : '#f5b53d', own = dm.dir === 'in' || dockOwned(dm.dock), wx = d.side * HALL.x;
      c.fillStyle = own ? col : 'rgba(255,255,255,0.15)'; c.fillRect(X(wx) - 2, Z(d.z - DOCKS.w / 2), 4, DOCKS.w * s); label(dockLabel(i), wx + d.side * 2.4, d.z + 1.4, own ? col : '#6b7784', 7, d.side < 0 ? 'right' : 'left');
      var t = truckAtDoor(i); if (t) { var tb = trailerBounds(t); rect(tb.x0, tb.x1, tb.z0, tb.z1, 'rgba(238,241,245,0.7)', null); var cx0 = t.x + t.side * TRAILER.len, cx1 = t.x + t.side * (TRAILER.len + 3.2); rect(cx0, cx1, t.z - 1.2, t.z + 1.2, col, null); } });
    // the things worth finding
    [['bench', 'BENCH'], ['returnsDesk', 'RETURNS'], ['palletiser', 'PALLETISER'], ['moulder', 'MOULDER'], ['agvDock', 'AGV DOCK'], ['timeclock', 'CLOCK'], ['cot', 'COT'], ['empties', 'EMPTIES'], ['wrapper', 'WRAP'], ['baler', 'BALER'], ['desk', 'PC']].forEach(function (p) { if (!propInst[p[0]] || propPlacement(p[0]).hidden) return; var P = propPlacement(p[0]); c.fillStyle = 'rgba(238,241,245,0.5)'; c.fillRect(X(P.x) - 2, Z(P.z) - 2, 4, 4); label(p[1], P.x, P.z - 1.2, '#a0acb8', 6); });
    // the forklift, the AGV, the crew
    if (S.up.fork) { c.fillStyle = '#f5b53d'; c.fillRect(X(S.fork.x) - 3, Z(S.fork.z) - 3, 6, 6); }
    if (S.up.agv && S.agv) { c.fillStyle = '#78bdf5'; c.fillRect(X(S.agv.x) - 2.5, Z(S.agv.z) - 2.5, 5, 5); }
    S.staff.forEach(function (st) { var m = staffMeshes[st.id]; if (!m || !m.visible) return; c.fillStyle = st.state === 'break' ? '#a0acb8' : '#5fd38d'; c.beginPath(); c.arc(X(st.x), Z(st.z), 3.5, 0, 6.3); c.fill(); c.fillStyle = '#0a0f13'; c.font = 'bold 6px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(st.name.slice(0, 1), X(st.x), Z(st.z) + 2.2); c.textAlign = 'left'; });
    // the waypoint, and you
    if (scan.nav) { c.strokeStyle = '#5fd38d'; c.lineWidth = 1.5; c.beginPath(); c.arc(X(scan.nav.x), Z(scan.nav.z), 5 + Math.sin(worldTime * 4) * 1.5, 0, 6.3); c.stroke(); }
    c.save(); c.translate(X(player.x), Z(player.z)); c.rotate(-player.yaw); c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 14, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); c.closePath(); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill(); c.restore();
    // the scale bar and north
    c.fillStyle = '#6b7784'; c.fillRect(x + 10, y + h - 9, 10 * s, 1.5); c.font = '7px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.fillText('10 m', x + 10, y + h - 12); c.textAlign = 'right'; c.fillText('N ↑', x + w - 8, y + 12); c.textAlign = 'left';
    c.fillStyle = '#5fd38d'; c.beginPath(); c.arc(x + w - 62, y + h - 8, 3, 0, 6.3); c.fill(); c.fillStyle = '#6b7784'; c.font = '7px Bahnschrift, Arial, sans-serif'; c.fillText('crew', x + w - 56, y + h - 5); c.fillStyle = '#f5b53d'; c.fillRect(x + w - 36, y + h - 11, 6, 6); c.fillStyle = '#6b7784'; c.fillText('fork', x + w - 27, y + h - 5);
  }
