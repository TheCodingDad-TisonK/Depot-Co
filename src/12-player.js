//@ the player on the engine: the dynamic blockers, the forklift seat and the office PC as overrides, what the crosshair hits, the keys
  // ── Player ────────────────────────────────────────────────────────
  // the engine owns the player record, the focus and the input (Co Engine 42-player); the depot stands them at the spawn spot and
  // answers the hooks: what blocks, who takes the frame, what the crosshair may hit, which keys are the depot's
  player.x = SPOT.spawn.x; player.z = SPOT.spawn.z; player.yaw = -Math.PI / 2 - 0.4;
  var buff = { coffeeUntil: 0, coffeeDay: 0 };

  function rebuildDyn() {
    dyn.length = 0;
    S.pallets.forEach(function (p) { if (p.place !== 'floor') return; dyn.push({ x0: p.x - 0.65, x1: p.x + 0.65, z0: p.z - 0.65, z1: p.z + 0.65, y0: (p.y || 0) - 0.1, y1: (p.y || 0) + 0.3 + Math.ceil(p.n / 4) * BOX.h }); });
    S.trucks.forEach(function (t) {
      if (t.state === 'gone') return; var b = trailerBounds(t); if (t.van) { dyn.push({ x0: b.x0 - 1.8, x1: b.x1 + 0.1, z0: b.z0 - 0.1, z1: b.z1 + 0.1, y0: -2, y1: 3 }); return; }   /* the van is one block: nobody walks into it */ var cabX0 = Math.min(t.x + t.side * TRAILER.len, t.x + t.side * (TRAILER.len + 3.2)), cabX1 = Math.max(t.x + t.side * TRAILER.len, t.x + t.side * (TRAILER.len + 3.2));
      dyn.push({ x0: b.x0, x1: b.x1, z0: b.z0 - 0.12, z1: b.z0, y0: -2, y1: 3 }); dyn.push({ x0: b.x0, x1: b.x1, z0: b.z1, z1: b.z1 + 0.12, y0: -2, y1: 3 });
      var fx = t.x + t.side * TRAILER.len; dyn.push({ x0: fx - 0.08, x1: fx + 0.08, z0: b.z0, z1: b.z1, y0: -2, y1: 3 });
      dyn.push({ x0: cabX0, x1: cabX1, z0: t.z - 1.3, z1: t.z + 1.3, y0: -2, y1: 3 });
      if (t.state !== 'docked') dyn.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: -2, y1: 3 });
    });
    doors.forEach(function (d) { if (d.anim < 0.6) dyn.push({ x0: d.side * HALL.x - 0.3, x1: d.side * HALL.x + 0.3, z0: d.z - DOCKS.w / 2, z1: d.z + DOCKS.w / 2, y0: -2, y1: 9 }); });
    doorSolids(dyn);
    if (S.up.fork) dyn.push({ x0: S.fork.x - 1.0, x1: S.fork.x + 1.0, z0: S.fork.z - 1.0, z1: S.fork.z + 1.0, y0: -1, y1: 2.4, skip: 'fork' });
    ['jack', 'jack2'].forEach(function (jt) { if (player.tool !== jt && jackPallet(jt)) { /* a pallet on a parked jack is part of the jack: walk round it */ var jw = toolWorld(jt); dyn.push({ x0: jw.x - 0.7, x1: jw.x + 0.7, z0: jw.z - 0.7, z1: jw.z + 0.7, y0: -1, y1: 1.5 }); } });
  }
  GAME.skipDyn = function (d) { return d.skip === 'fork' && driving; };   // the forklift is not in your own way while you drive it
  // the forklift seat and the office PC take the frame; otherwise the engine walks the player
  GAME.playerOverride = function (dt) {
    updateDropMarker();
    if (pc.on) { pcCamera(); return true; }
    if (driving) {
      updateFork(dt);
      camera.position.set(S.fork.x - Math.sin(S.fork.yaw) * 0.45, floorY(S.fork.x, S.fork.z) + 1.78, S.fork.z - Math.cos(S.fork.yaw) * 0.45);
      camera.rotation.set(forkLook.pitch, S.fork.yaw + Math.PI + forkLook.yaw, 0, 'YXZ');
      player.x = S.fork.x; player.z = S.fork.z; player.y = floorY(S.fork.x, S.fork.z);
      return true;
    }
    return false;
  };
  GAME.speedMul = function () {
    var coffee = buff.coffeeDay === S.day && buff.coffeeUntil > S.time, snack = buff.snackDay === S.day && buff.snackUntil > S.time;
    return (coffee ? 1.2 : 1) * (snack ? 1.1 : 1) * (isJack(player.tool) ? (S.up.jackPower ? 1 : jackPallet() ? 0.78 : 0.92) : player.tool ? 0.92 : 1);   /* the powered truck walks at full speed, loaded or not */
  };
  GAME.stepSurface = function (x, z, y) { return floorY(x, z) < -0.5 ? 'outside' : y > 2.6 ? 'steel' : insideHall(x, z) ? 'floor' : 'steel'; };

  // ── Looking at things ─────────────────────────────────────────────
  // the instanced boxes, pallets and parcels are not on the engine's list of things to look at: the depot adds them and resolves a hit
  function srcDef(src) {
    if (!src) return null;
    if (src.kind === 'pallet') return { prompt: function () { return palletPrompt(src); }, use: function () { palletUse(src); } };
    if (src.kind === 'shelf') return { prompt: function () { return shelfPrompt(src); }, use: function () { shelfUse(src); } };
    if (src.kind === 'floor') return { prompt: function () { return floorPrompt(src); }, use: function () { floorUse(src); } };
    if (src.kind === 'belt') return { prompt: function () { return beltItemPrompt(src); }, use: function () { beltItemUse(src); } };
    if (src.kind === 'stage') return { prompt: function () { return stagePrompt(src); }, use: function () { stageUse(src); } };
    if (src.kind === 'bench') return { prompt: function () { return benchBoxPrompt(src); }, use: function () { benchBoxUse(src); } };
    if (src.kind === 'rdesk') return { prompt: function () { return rdeskBoxPrompt(src); }, use: function () { rdeskBoxUse(src); } };
    if (src.kind === 'rdeskq') return { prompt: function () { return rdeskQueuePrompt(src); }, use: function () { rdeskUse(); } };
    if (src.kind === 'truckReturn') return { prompt: function () { var t = truckById(src.truck); return t && t.state === 'docked' ? loadPrompt(src.truck) : null; }, use: function () { loadUse(src.truck); } };
    return null;
  }
  GAME.hitObjects = function () { return instList; };
  GAME.hitDef = function (h) { var src = instSource(h), def = srcDef(src); if (def && h.object.isInstancedMesh && !def.src) def.src = src; return def; };   // the scanner reads def.src
  // the boxes on the bench sit inside the bench's own hit box: within 0.8 m a box wins over the bench
  GAME.hitPriority = function (hs, first) { var isrc = hs.object.isInstancedMesh ? instSource(hs) : null; return !!(isrc && isrc.kind === 'bench' && hs.distance - first.distance < 0.8); };
  GAME.focusOff = function () { return driving; };
  GAME.useOverride = function () { if (driving) { forkUse(); return true; } return false; };
  GAME.useFallback = function () { if (isJack(player.tool) && jackPallet()) jackSetDown(); };
  GAME.putDown = function () { putDown(); };
  // E on open floor with a loaded jack lowers the forks and leaves the pallet where the jack stands
  function jackSetDown() { var p = jackPallet(); if (!p) return; var jt = jackTool(), jm = jackMeshes[jt], w = toolWorld(jt); if (jm && jm.userData.towRy !== undefined) { w.x = jm.position.x; w.z = jm.position.z; w.ry = jm.userData.towRy; } if (!insideHall(w.x, w.z) && floorY(w.x, w.z) < -0.5) { toast('Not out in the yard: set it down inside.', 'bad'); sfx('bad'); return; } p.place = 'floor'; p.x = w.x; p.z = w.z; p.y = floorY(w.x, w.z); p.rot = w.ry; S[jt].pallet = null; sfx('putdown'); toast('Pallet set down', ''); hudDirty = true; }

  // ── Input ─────────────────────────────────────────────────────────
  GAME.mouseLook = function (e, sx, iy) {
    if (pc.on) { pc.look.yaw = clamp(pc.look.yaw - e.movementX * sx, -0.5, 0.5); pc.look.pitch = clamp(pc.look.pitch - e.movementY * sx * iy, -0.35, 0.35); return true; }
    if (driving) { forkLook.yaw = clamp(forkLook.yaw - e.movementX * sx, -2.4, 2.4); forkLook.pitch = clamp(forkLook.pitch - e.movementY * sx * iy, -1.2, 1.2); return true; }
    return false;
  };
  GAME.escape = function () { if (pc.on) { closePc(); return true; } return false; };
  GAME.editBlocked = function () { return driving || pc.on; };
  GAME.photoBlocked = function () { return driving || pc.on; };
  GAME.promptHidden = function () { return driving; };
  hook('photo', function (on) { if (on) dropMarker.g.visible = false; });
  GAME.scanToggle = function (on) { scanToggle(on); };
  // the depot's keys, before the engine's own: the scanner (Tab, the digits, F, X, Enter) and the forklift (G stops, Shift shifts)
  GAME.key = function (e) {
    if (e.code === 'Tab') { e.preventDefault(); if (!pc.on) scanToggle(!ui.scanOpen); return true; }
    if (ui.scanOpen && /^Digit[1-9]$/.test(e.code)) { scanPage(+e.code.slice(5) - 1); return true; }
    if (ui.scanOpen && e.code === 'KeyF') { e.preventDefault(); scanGo(); return true; }
    if (ui.scanOpen && e.code === 'KeyX') { e.preventDefault(); scanClearNav(); return true; }
    if (ui.scanOpen && (e.code === 'Enter' || e.code === 'NumpadEnter')) { e.preventDefault(); scanAct(); return true; }   // the selected row's action
    if (!ui.scanOpen && e.code === 'KeyX' && scan.nav && !pc.on) { scanClearNav(); return true; }
    if (driving && e.code === 'KeyG') { player.keys[e.code] = true; if (!e.repeat) stopDrive(); return true; }
    if (driving && (e.code === 'ShiftLeft' || e.code === 'ShiftRight')) { player.keys[e.code] = true; if (!e.repeat) forkGearCycle(); return true; }
    return false;
  };
  GAME.wheel = function (dir, e) {
    if (ui.scanOpen && !ui.blocked()) { scanScroll(dir); return true; }
    if (pc.on && pc.screen) { pc.scroll = Math.max(0, pc.scroll + dir); pc.screen.dirty = true; return true; }
    return driving;   // no screen scrolls from the forklift seat
  };
