//@ the player: movement, collision, looking at things, the keys
  // ── Player ────────────────────────────────────────────────────────
  var player = { x: SPOT.spawn.x, y: 0, z: SPOT.spawn.z, yaw: -Math.PI / 2 - 0.4, pitch: 0, vy: 0, grounded: true, keys: {}, locked: false, tool: null, stepT: 0, bob: 0 };
  var ui = { started: false, menuOpen: false, panelOpen: false, scanOpen: false, blocked: function () { return ui.menuOpen || ui.panelOpen; } };
  var buff = { coffeeUntil: 0, coffeeDay: 0 };
  var focus = null, focusText = '';

  function rebuildDyn() {
    dyn.length = 0;
    S.pallets.forEach(function (p) { if (p.place !== 'floor') return; dyn.push({ x0: p.x - 0.65, x1: p.x + 0.65, z0: p.z - 0.65, z1: p.z + 0.65, y0: (p.y || 0) - 0.1, y1: (p.y || 0) + 0.3 + Math.ceil(p.n / 4) * BOX.h }); });
    S.trucks.forEach(function (t) {
      if (t.state === 'gone') return; var b = trailerBounds(t), cabX0 = Math.min(t.x + t.side * TRAILER.len, t.x + t.side * (TRAILER.len + 3.2)), cabX1 = Math.max(t.x + t.side * TRAILER.len, t.x + t.side * (TRAILER.len + 3.2));
      dyn.push({ x0: b.x0, x1: b.x1, z0: b.z0 - 0.12, z1: b.z0, y0: -2, y1: 3 }); dyn.push({ x0: b.x0, x1: b.x1, z0: b.z1, z1: b.z1 + 0.12, y0: -2, y1: 3 });
      var fx = t.x + t.side * TRAILER.len; dyn.push({ x0: fx - 0.08, x1: fx + 0.08, z0: b.z0, z1: b.z1, y0: -2, y1: 3 });
      dyn.push({ x0: cabX0, x1: cabX1, z0: t.z - 1.3, z1: t.z + 1.3, y0: -2, y1: 3 });
      if (t.state !== 'docked') dyn.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: -2, y1: 3 });
    });
    doors.forEach(function (d) { if (d.anim < 0.6) dyn.push({ x0: d.side * HALL.x - 0.3, x1: d.side * HALL.x + 0.3, z0: d.z - DOCKS.w / 2, z1: d.z + DOCKS.w / 2, y0: -2, y1: 9 }); });
    doorSolids(dyn);
    if (S.up.fork) dyn.push({ x0: S.fork.x - 1.0, x1: S.fork.x + 1.0, z0: S.fork.z - 1.0, z1: S.fork.z + 1.0, y0: -1, y1: 2.4, fork: true });
    if (player.tool !== 'jack' && jackPallet()) { /* a pallet on a parked jack is part of the jack: walk round it */ var jw = toolWorld('jack'); dyn.push({ x0: jw.x - 0.7, x1: jw.x + 0.7, z0: jw.z - 0.7, z1: jw.z + 0.7, y0: -1, y1: 1.5 }); }
  }
  function collides(x, z, ignoreFork) {
    var r = 0.32, y0 = player.y, y1 = player.y + 1.7;
    if (floorY(x, z) - player.y > 0.5) return true;
    for (var i = 0; i < solids.length; i++) { var s = solids[i]; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r && y0 < s.y1 && y1 > s.y0) return true; }
    for (var k = 0; k < dyn.length; k++) { var d = dyn[k]; if (d.fork && (driving || ignoreFork === 'fork')) continue; if (x > d.x0 - r && x < d.x1 + r && z > d.z0 - r && z < d.z1 + r && y0 < d.y1 && y1 > d.y0) return true; }
    return false;
  }
  function updatePlayer(dt) {
    if (driving) {
      updateFork(dt);
      camera.position.set(S.fork.x - Math.sin(S.fork.yaw) * 0.35, floorY(S.fork.x, S.fork.z) + 1.75, S.fork.z - Math.cos(S.fork.yaw) * 0.35);
      camera.rotation.set(forkLook.pitch, S.fork.yaw + Math.PI + forkLook.yaw, 0, 'YXZ');
      player.x = S.fork.x; player.z = S.fork.z; player.y = floorY(S.fork.x, S.fork.z);
      return;
    }
    var k = player.keys, run = k.ShiftLeft || k.ShiftRight;
    var coffee = buff.coffeeDay === S.day && buff.coffeeUntil > S.time, snack = buff.snackDay === S.day && buff.snackUntil > S.time;
    var speed = 4.0 * (run ? 1.55 : 1) * (coffee ? 1.2 : 1) * (snack ? 1.1 : 1) * (player.tool === 'jack' && jackPallet() ? 0.78 : player.tool ? 0.92 : 1);
    var fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    var mx = 0, mz = 0;
    if (fwd || side) {
      var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
      mx = fx * fwd + rx * side; mz = fz * fwd + rz * side; var l = Math.sqrt(mx * mx + mz * mz); mx /= l; mz /= l;
      var nx = player.x + mx * speed * dt, nz = player.z + mz * speed * dt;
      if (!collides(nx, player.z)) player.x = nx;
      if (!collides(player.x, nz)) player.z = nz;
      player.stepT += speed * dt; player.bob += dt * (run ? 11 : 8);
      if (player.stepT > 2.1) { player.stepT = 0; sfx('step', floorY(player.x, player.z) < -0.5 ? 'outside' : insideHall(player.x, player.z) ? 'floor' : 'steel'); }
    } else player.bob *= Math.max(0, 1 - 8 * dt);
    var fy = floorY(player.x, player.z);
    if (k.Space && player.grounded && !player.jumped) { player.vy = 5.2; player.grounded = false; player.jumped = true; }
    if (!k.Space) player.jumped = false;
    player.vy -= 16 * dt; player.y += player.vy * dt;
    if (player.y <= fy) { if (!player.grounded && player.vy < -6) sfx('putdown'); player.y = fy; player.vy = 0; player.grounded = true; } else player.grounded = false;
    var bobY = (fwd || side) && player.grounded ? Math.sin(player.bob) * 0.03 : 0;
    camera.position.set(player.x, player.y + 1.62 + bobY, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }

  // ── Looking at things ─────────────────────────────────────────────
  var ray = new THREE.Raycaster(); ray.far = 3.4;
  var centre = new THREE.Vector2(0, 0);
  function srcDef(src) {
    if (!src) return null;
    if (src.kind === 'pallet') return { prompt: function () { return palletPrompt(src); }, use: function () { palletUse(src); } };
    if (src.kind === 'shelf') return { prompt: function () { return shelfPrompt(src); }, use: function () { shelfUse(src); } };
    if (src.kind === 'floor') return { prompt: function () { return floorPrompt(src); }, use: function () { floorUse(src); } };
    return null;
  }
  function interact() {
    focus = null; focusText = '';
    if (!ui.started || ui.blocked() || driving) return;
    ray.setFromCamera(centre, camera);
    if (edit.on) {
      if (edit.grabbed) return;
      ray.far = 7; var ph = ray.intersectObjects(scene.children, true); ray.far = 3.4;
      for (var q = 0; q < ph.length; q++) { var pid = propIdOf(ph[q].object); if (!pid) continue; if (ph[q].object.userData.baked || !ph[q].object.visible) continue; var pdef = propDef(pid); if (!pdef) continue; focus = { editId: pid, prompt: function () { return ''; }, use: function () {} }; focusText = 'Grab the ' + pdef.label + '  ·  R turn · Backspace put back · Del remove'; return; }
      return;
    }
    var hits = ray.intersectObjects(inter.concat(instList), false);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], def = h.object.userData.it || srcDef(instSource(h));
      if (!def) continue;
      var txt = def.prompt(); if (!txt) continue;
      focus = def; focusText = txt; break;
    }
  }
  function useFocus() { if (edit.on) { if (edit.grabbed) editDrop(false); else if (focus && focus.editId) editGrab(focus.editId); return; } if (driving) { forkUse(); return; } if (focus) { focus.use(); sfx('click'); interact(); } }

  // ── Input ─────────────────────────────────────────────────────────
  function lockPointer() { if (!ui.started || ui.blocked()) return; try { var r = canvas.requestPointerLock(); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
  canvas.addEventListener('click', function () { if (ui.started && !ui.blocked() && !player.locked) lockPointer(); });
  document.addEventListener('pointerlockchange', function () { player.locked = document.pointerLockElement === canvas; if (!player.locked) { player.keys = {}; if (ui.started && !ui.blocked() && !ui.suppressMenu) openMenu(); } ui.suppressMenu = false; });
  document.addEventListener('mousemove', function (e) {
    if (!player.locked || ui.blocked()) return;
    var sx = 0.0022 * SET.sens, iy = SET.invertY ? -1 : 1;
    if (driving) { forkLook.yaw = clamp(forkLook.yaw - e.movementX * sx, -2.4, 2.4); forkLook.pitch = clamp(forkLook.pitch - e.movementY * sx * iy, -1.2, 1.2); return; }
    player.yaw -= e.movementX * sx; player.pitch = clamp(player.pitch - e.movementY * sx * iy, -1.5, 1.5);
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'F12') { e.preventDefault(); if (ui.started) screenshot(); return; }
    if (e.code === 'F3') { e.preventDefault(); SET.fps = !SET.fps; $('h-fps').hidden = !SET.fps; saveSettings(); return; }
    var typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
    if (typing && e.code !== 'Escape') return;
    if (!ui.started) return;
    if (e.code === 'Escape') { e.preventDefault(); if (edit.on && edit.grabbed) { editDrop(true); return; } if (ui.panelOpen) closePanel(); else if (ui.scanOpen) scanToggle(false); else if (ui.menuOpen) closeMenu(); else openMenu(); return; }
    if (ui.blocked()) return;
    if (e.code === 'F2') { e.preventDefault(); if (!driving) editToggle(); return; }
    if (edit.on) {
      if (e.code === 'KeyR') { editRotate(); return; }
      if (e.code === 'Backspace') { e.preventDefault(); editReset(); return; }
      if (e.code === 'Delete') { editRemove(); return; }
      if (e.code === 'KeyC') { openPanel('catalogue'); return; }
      if (e.code === 'KeyE' && !e.repeat) { if (edit.grabbed) editDrop(false); else if (focus && focus.editId) editGrab(focus.editId); return; }
      if (e.code === 'KeyG' && !e.repeat) { if (edit.grabbed) editDrop(true); return; }
    }
    if (e.code === 'Tab') { e.preventDefault(); scanToggle(!ui.scanOpen); return; }
    if (ui.scanOpen && /^Digit[1-4]$/.test(e.code)) { scanPage(+e.code.slice(5) - 1); return; }
    player.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyE') useFocus();
    else if (e.code === 'KeyG') { if (driving) stopDrive(); else putDown(); }
  });
  document.addEventListener('keyup', function (e) { player.keys[e.code] = false; });
  document.addEventListener('wheel', function (e) { if (ui.scanOpen && !ui.blocked()) scanPage((scan.page + (e.deltaY > 0 ? 1 : 3)) % 4); }, { passive: true });
  window.addEventListener('blur', function () { player.keys = {}; });
