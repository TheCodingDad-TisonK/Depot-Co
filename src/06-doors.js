//@ the doors' keyring (the engine's hinged doors and touch screens), and the control cabinet with its touch screen

  // ── Doors ─────────────────────────────────────────────────────────
  // the touch screens and the hinged doors are the engine's (Co Engine 21-doors). Staff carry keys: a door swings open for a
  // walking member of the crew; night mode closes the roll doors with the hinged ones
  GAME.doorOpeners = function () { var out = []; S.staff.forEach(function (st) { var m = staffMeshes[st.id]; if (m && m.visible && st.state === 'walk') out.push({ x: st.x, z: st.z }); }); return out; };
  hook('lockAll', function (lock) { if (lock) doors.forEach(function (dk) { if (S.doors[dk.i]) setDoor(dk.i, false); }); });

  // ── The control cabinet ───────────────────────────────────────────
  function buildControlCabinet() { }
  function cabinetBuild(c) {
    var g = c.group;
    box(0.9, 1.3, 0.22, MAT.grey, 0, 1.45, -0.11, g); box(0.9, 0.04, 0.26, MAT.steelDark, 0, 2.12, -0.1, g); box(0.9, 0.04, 0.26, MAT.steelDark, 0, 0.78, -0.1, g);
    box(0.04, 0.12, 0.03, MAT.black, 0.38, 1.0, 0.012, g); cyl(0.012, 0.6, MAT.black, 0.42, 0.45, -0.1, g, 6); cyl(0.012, 1.4, MAT.black, -0.42, 2.8, -0.1, g, 6);
    sign(['CONTROL'], 0.7, 0.14, 0, 2.02, 0.012, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#f5b53d' }, g);
    var lamps = [glowMat(0x39d353, 1.2), glowMat(0xf5b53d, 1.2), glowMat(0xff3b30, 1.2)];
    [-0.3, -0.1, 0.1].forEach(function (lx, i) { var l = cyl(0.025, 0.02, lamps[i], lx, 0.9, 0.012, g, 10); l.rotation.x = Math.PI / 2; });
    dress.cabLamps = g;
    touchScreen({ w: 420, h: 330, pw: 0.78, ph: 0.616, x: 0, y: 1.5, z: 0.012, parent: g, title: 'Control cabinet', draw: function (c, sc) {
      scBg(c, sc.w, sc.h); scHead(c, sc.w, 'DEPOT CONTROL', 'Day ' + S.day + ' · ' + fmtTime(S.time));
      var power = !S.events.power;
      scText(c, 16, 66, 'Mains ' + (power ? 'ON' : 'OFF: breaker tripped'), power ? '#5fd38d' : '#ff6b5e', 15);
      scText(c, 220, 66, 'Weather: ' + (S.weather ? S.weather.kind : 'clear'), '#a0acb8', 14);
      scButton(sc, 16, 80, 120, 40, 'Hall lights', !S.flags.lightsOff, function () { S.flags.lightsOff = !S.flags.lightsOff; }, '#5fd38d');
      scButton(sc, 148, 80, 120, 40, 'Yard lights', !S.flags.yardOff, function () { S.flags.yardOff = !S.flags.yardOff; }, '#5fd38d');
      scButton(sc, 280, 80, 124, 40, 'Night mode', !!S.flags.night, function () { S.flags.night = !S.flags.night; lockAll(S.flags.night); }, '#ff6b5e');
      scText(c, 16, 150, 'Dock doors', '#f5b53d', 14);
      doors.forEach(function (d, i) { scButton(sc, 10 + i * 58, 160, 54, 38, dockLabel(i).replace(' ', '').replace('RETURNS', 'RET') + (S.doors[i] ? ' ●' : ''), !!S.doors[i], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(i, !S.doors[i]); }); });
      scText(c, 16, 226, 'Doors', '#f5b53d', 14);
      hdoors.forEach(function (d, i) { var s = hd(d.id); scButton(sc, 16 + (i % 4) * 98, 236 + Math.floor(i / 4) * 44, 90, 36, d.label.replace(/^the | door$/g, '') + (s.locked ? ' 🔒' : s.open ? ' open' : ''), s.locked, function () { doorLock(d); }, '#ff6b5e'); });
    } });
    c.solid(-0.45, 0.45, -0.25, 0.05, 0, 2.2);
  }
