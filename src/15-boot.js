//@ boot: load the save, build the world, the frame loop, autosave, the window handle
  // ── Boot ──────────────────────────────────────────────────────────
  var loaded = load();
  buildWorld(); buildTools(); buildScanner();
  S.trucks.forEach(buildTruckMesh); S.staff.forEach(buildStaffMesh);
  // a packed order whose parcel is nowhere (an old save, say) goes back to open with its boxes on the bench
  S.orders.forEach(function (o) { if ((o.state === 'packed' || o.state === 'loaded') && !parcelExists(o.id)) { o.state = 'open'; o.lines.forEach(function (l) { if (l.packed) benchAdd(l.sku, l.packed); l.packed = 0; }); } });
  if (S.jack.pallet && !palletById(S.jack.pallet)) S.jack.pallet = null;
  if (S.fork.pallet && !palletById(S.fork.pallet)) S.fork.pallet = null;
  updateHandMesh(); applySettings(); resize(); rebuildDyn(); drawBoard();
  buildAgv();
  if (!/nobake=1/.test(location.search)) bakeStatic();
  camera.position.set(12, 3.6, 0); camera.lookAt(0, 1.4, 0); if (!loaded) S.time = 10.5;
  $('dc-start-stats').innerHTML = loaded ? ['Day ' + S.day, 'Level ' + S.level, money(S.bank), Math.round(S.rep) + ' rep', S.stats.shipped + ' shipped'].map(function (s) { return '<span>' + s + '</span>'; }).join('') : ['New depot', money(ECON.start), '2 rack rows', 'a pallet jack'].map(function (s) { return '<span>' + s + '</span>'; }).join('');
  $('dc-start-note').textContent = loaded ? 'Slot ' + BOOT_SLOT + ' · last saved ' + (S.savedAt ? new Date(S.savedAt).toLocaleString() : 'never') : 'Slot ' + BOOT_SLOT + ' · the first truck is due at 07:30';

  function enter() {
    if (ui.started) return;
    ui.started = true; $('dc-start').hidden = true; $('dc-hud').hidden = false; hudDirty = true;
    lockPointer(); sfx('ok');
    if (!loaded) { S.time = DAY_START; logEvent('Welcome to Depot Co. Open dock IN 1: the first truck is due at 07:30.', 'rare'); save(); }   // the menu backdrop showed 10:30; the shift starts at 06:00
    else logEvent('Back on shift. Day ' + S.day + ', ' + fmtTime(S.time) + '.');
  }
  $('dc-start-btn').addEventListener('click', enter);

  // ── The frame loop ────────────────────────────────────────────────
  var last = performance.now(), fpsN = 0, fpsT = 0, autosaveT = 0, scanT = 0;
  function tickWorld(dt) { tickTime(dt); tickTrucks(dt); tickOrders(); tickStaff(dt); tickEvents(dt); rebuildDyn(); }
  function frame(nowMs) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, Math.max(0.001, (nowMs - last) / 1000)); last = nowMs;
    if (!ui.started) { var ma = worldTime * 0.07; camera.position.set(Math.cos(ma) * 12, 3.6 + Math.sin(ma * 1.7) * 0.6, Math.sin(ma) * 9.5); camera.lookAt(Math.cos(ma + 1.2) * 4, 1.4, Math.sin(ma + 1.2) * 3); }
    if (ui.started && !ui.blocked()) { tickWorld(dt); updatePlayer(dt); autosaveT += dt; if (autosaveT > 30) { autosaveT = 0; save(); }  }
    worldTime += dt;
    doorAnim(dt); placeTools(dt); syncInstances(); lighting(dt); tickDressing(dt); tickYard(dt); tickLife(dt); tickBursts(dt); doorsTick(dt); drawScreens(dt); tickScanner(dt); editTick(); tickTimeClock(dt); tickPc(dt); for (var ai = 0; ai < animated.length; ai++) animated[ai](dt);
    interact(); updatePrompt(); updateHud(dt);
    renderFrame(dt);
    if (SET.fps) { fpsN++; fpsT += dt; if (fpsT >= 0.5) { $('h-fps').textContent = Math.round(fpsN / fpsT) + ' fps · ' + (post.calls || renderer.info.render.calls) + ' draws'; fpsN = 0; fpsT = 0; } }
  }
  requestAnimationFrame(frame);
  // a hidden tab gets no animation frames; the world still ticks ten times a second so a docked truck does not wait on a tab switch
  setInterval(function () { if (!document.hidden) return; var n = performance.now(), dt = Math.min(0.05, Math.max(0.001, (n - last) / 1000)); last = n; worldTime += dt; if (ui.started && !ui.blocked()) { tickWorld(dt); updatePlayer(dt); doorAnim(dt); placeTools(dt); syncInstances(); tickLife(dt); doorsTick(dt); tickTimeClock(dt); scene.updateMatrixWorld(true); interact(); updatePrompt(); } }, 50);
  window.addEventListener('beforeunload', function () { if (ui.started) save(); });

  // ── The window handle: the main menu, and the smoke test ──────────
  window.DEPOT = {
    enter: enter, bootSlot: BOOT_SLOT, guideHtml: guideHtml, version: window.DEPOT_VERSION || 'dev',
    T: {
      get S() { return S; }, player: player, ui: ui, save: save,
      run: function (sec) { var n = Math.round(sec / 0.05); for (var i = 0; i < n; i++) { tickWorld(0.05); if (driving) updatePlayer(0.05); tickLife(0.05); doorAnim(0.05); placeTools(0.05); } syncInstances(); },
      setTime: function (h) { S.time = h; hudDirty = true; },
      spawnTruck: spawnTruck, signTruck: signTruck, truckById: truckById, truckAtDoor: truckAtDoor, truckMeshes: truckMeshes, doorPassable: doorPassable, doorPanelScale: function (i) { return doors[i].panel.scale.y; }, truckLeave: truckLeave, setDoor: setDoor,
      palletById: palletById, palletUse: palletUse, palletPrompt: palletPrompt, storePallet: storePallet, findSlotFor: findSlotFor, newPallet: newPallet,
      slotKey: slotKey, slotUse: slotUse, slotPrompt: slotPrompt, stockCount: stockCount, totalStock: totalStock,
      grabTool: grabTool, releaseTool: releaseTool, toolWorld: toolWorld,
      genOrder: genOrder, orderById: orderById, benchAdd: benchAdd, benchUse: benchUse, packOrder: packOrder, canPack: canPack, shelfUse: shelfUse, loadUse: loadUse, consoleUse: consoleUse, consolePrompt: consolePrompt,
      hireStaff: hireStaff, fireStaff: fireStaff, buyUpgrade: buyUpgrade, startDrive: startDrive, stopDrive: stopDrive, forkGearCycle: forkGearCycle, forkLook: forkLook, forkUse: forkUse, forkTip: forkTip,
      handSet: handSet, putDown: putDown, interact: interact, useFocus: useFocus, focusText: function () { return focusText; },
      lookAt: function (x, y, z) { camera.position.set(player.x, player.y + 1.62, player.z); camera.lookAt(x, y, z); camera.updateMatrixWorld(true); player.yaw = Math.atan2(-(x - player.x), -(z - player.z)); player.pitch = Math.atan2(y - camera.position.y, Math.sqrt(dist2(x, z, player.x, player.z))); interact(); return focusText; },
      openPanel: openPanel, closePanel: closePanel, renderPanel: renderPanel, scanToggle: scanToggle, renderScan: renderScan, panelHtml: function () { return $('dc-panel-body').innerHTML; },
      sleepNow: sleepNow, flipBreaker: flipBreaker, inspection: inspection, prowlerCheck: prowlerCheck, drawBoard: drawBoard, introIndex: introIndex, floorY: floorY, collides: collides, route: route,
      cableUse: cableUse, cablePlugInto: cablePlugInto,
      hopperUse: hopperUse, moulderUse: moulderUse, buildProp: buildProp, agvState: agvState, balerUse: balerUse, addWaste: addWaste, wrapperUse: wrapperUse, palletiserEject: palletiserEject, packUse: packUse, beltItems: beltItems, beltSink: beltSink, beltPoint: beltPoint, gantryNeed: gantryNeed, gantryState: gantryState, buildGantries: buildGantries, BELTS: BELTS, MACH: MACH, inWing: inWing,
      openPc: openPc, closePc: closePc, pc: pc,
      myClock: myClock, staffNewDay: staffNewDay, payStaffWages: payStaffWages, staffStatus: staffStatus, hourly: hourly,
      editToggle: editToggle, editGrab: editGrab, editDrop: editDrop, editRotate: editRotate, editReset: editReset, editRemove: editRemove, editRestore: editRestore, editBuy: editBuy, propInst: propInst, PROPS: PROPS, edit: edit, buildProp: buildProp,
      addXp: addXp, counts: function () { return { draws: (post.calls || renderer.info.render.calls), inter: inter.length, dyn: dyn.length, baked: baked.draws, hidden: baked.hidden }; }
    }
  };
})();
