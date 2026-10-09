//@ boot on Co Engine: the load repairs, the world build, the start screen, the per-frame extras and the test handle; CO.boot(GAME) runs the loop
  // ── Boot ──────────────────────────────────────────────────────────
  // CO.boot(GAME) loads the slot through freshState and migrateDepot, runs the steps below in order, applies the settings, bakes the
  // static geometry, fills the start screen, starts the frame loop and publishes window.DEPOT (Co Engine 90-boot).
  GAME.handle = 'DEPOT'; GAME.versionGlobal = 'DEPOT_VERSION';
  GAME.autoplay = false;    // menu.js reads the autoplay flag itself and presses Clock in
  GAME.editorEnter = function () {   // the Co Engine editor starts the game from the viewport: past the splash, the loaded slot's button on the main menu
    var sp = document.getElementById('dc-splash'); if (sp && !sp.hidden) sp.click();
    var b = document.querySelector('#dc-mainmenu .dc-slot.on [data-dc="slot"]'); if (b) b.click(); else enter();
  };
  GAME.weather = false;     // tickLife rolls the weather, in the frame and in T.run alike
  GAME.freshState = freshState; GAME.migrate = migrateDepot;
  GAME.afterLoad = function (loaded) {
    if (loaded) migrateReturnsHall();   // 1.17.0: Hall 2's rows are gone
    sorterSpots();   // a save that owns the sortation deck keeps jack 2 out from under the spirals
    if (loaded && S.site !== BOOT_STAGE) { S.site = BOOT_STAGE; if (S.siteDue < S.site) S.siteDue = S.site; stageFlags(S.up, S.site); }   // the page is laid out for the stage the raw save said: the state agrees with the walls
    // the walls moved overnight: the tools stand in the bays the new layout gives them, not where the old hall left them (jack 2 would be under the spirals)
    if (S.flags.rebuiltFrom !== undefined) { S.jack.x = SPOT.jack.x; S.jack.z = SPOT.jack.z; S.jack.rot = Math.PI / 2; if (S.jack2) { S.jack2.x = SPOT.jack2.x; S.jack2.z = SPOT.jack2.z; S.jack2.rot = S.up.sorter ? Math.PI : -Math.PI / 2; } S.cart.x = SPOT.cart.x; S.cart.z = SPOT.cart.z; S.cart.rot = 0; S.fork.x = SPOT.fork.x; S.fork.z = SPOT.fork.z; S.fork.yaw = Math.PI; S.fork.lift = 0.1; }
    if (S.flags.rebuiltFrom !== undefined) { var rbFrom = S.flags.rebuiltFrom; delete S.flags.rebuiltFrom; setTimeout(function () { toast('The builders were in: welcome to ' + stageName(S.site).toLowerCase() + '.', 'rare'); feedPush(LADDER_TIPS[STAGES[S.site].level] || ('The building grew from ' + stageName(rbFrom).toLowerCase() + '.'), 'good'); }, 1500); }
  };
  GAME.buildWorld = function () { buildWorld(); buildTools(); buildScanner(); S.trucks.forEach(buildTruckMesh); S.staff.forEach(buildStaffMesh); };
  GAME.afterBuild = function (loaded) {
    // a packed order whose parcel is nowhere (an old save, say) goes back to open with its boxes on the bench
    S.orders.forEach(function (o) { if ((o.state === 'packed' || o.state === 'loaded') && !parcelExists(o.id)) { o.state = 'open'; o.lines.forEach(function (l) { if (l.packed) benchAdd(l.sku, l.packed); l.packed = 0; }); } });
    // a return whose parcel is nowhere (a truck evicted by the load, say) is forgotten; the desk keeps only returns that exist
    S.returns = (S.returns || []).filter(function (r) { return returnPlace(r.id) !== null; }); rdesk().queue = rdesk().queue.filter(returnById); if (rdesk().cur && !returnById(rdesk().cur)) { rdesk().cur = null; rdesk().t = 0; }
    if (S.jack.pallet && !palletById(S.jack.pallet)) S.jack.pallet = null; if (S.jack2 && S.jack2.pallet && !palletById(S.jack2.pallet)) S.jack2.pallet = null;
    if (S.fork.pallet && !palletById(S.fork.pallet)) S.fork.pallet = null;
    updateHandMesh(); rebuildDyn(); drawBoard(); buildAgv();
    if (!loaded) S.time = 10.5;   // the menu backdrop shows mid-morning; the shift starts at 06:00 when you clock in
  };
  GAME.startStats = function (loaded) { return loaded ? ['Day ' + S.day, 'Level ' + S.level, stageName(S.site), money(S.bank), Math.round(S.rep) + ' rep', S.stats.shipped + ' shipped'] : ['New depot', 'The shed', money(ECON.start), 'one rack, one jack, a van']; };
  GAME.startNote = function (loaded) { return loaded ? 'Slot ' + BOOT_SLOT + ' · last saved ' + (S.savedAt ? new Date(S.savedAt).toLocaleString() : 'never') : 'Slot ' + BOOT_SLOT + ' · the first truck is due at 07:30'; };
  GAME.onEnter = function (loaded) {
    if (!loaded) { S.time = DAY_START; logEvent('Welcome to Depot Co. This is your shed. Open the roll door IN 1: the first truck is due at 07:30.', 'rare'); save(); }
    if (!/[?&]dev=1/.test(location.search)) logEvent('Back on shift. Day ' + S.day + ', ' + fmtTime(S.time) + '.');   // started with --dev-link: the engine links instead
  };

  // ── The frame ─────────────────────────────────────────────────────
  // the engine's frame (Co Engine 90-boot) ticks the world, the player, the light, the doors, the screens and build mode; the depot's
  // own presentation runs after, every frame: the roll doors, the tools, the instanced stock, the dressing, the yard, the living world
  function tickWorld(dt) { tickTime(dt); tickTrucks(dt); tickOrders(); tickReturns(dt); tickStaff(dt); tickEvents(dt); rebuildDyn(); }
  GAME.tick = tickWorld;
  GAME.present = function (dt) { doorAnim(dt); placeTools(dt); syncInstances(); tickDressing(dt); tickYard(dt); tickLife(dt); tickScanner(dt); tickTimeClock(dt); tickPc(dt); };
  // a hidden tab gets no animation frames; the world still ticks ten times a second so a docked truck does not wait on a tab switch
  GAME.hiddenTick = function (dt) { doorAnim(dt); placeTools(dt); syncInstances(); tickLife(dt); tickTimeClock(dt); };

  // ── The test handle: what the depot adds to window.DEPOT.T (the engine's part is in coHandle) ──
  GAME.T = {
    RET: RET, TRUCK_RET: TRUCK_RET, doorOwned: doorOwned, retFeedWorks: retFeedWorks, rdeskCap: rdeskCap, rdeskStations: rdeskStations, returnsHall: returnsHall, migrateReturnsHall: migrateReturnsHall, dockStepSide: dockStepSide, staffMeshes: staffMeshes, jackHome: jackHome, roomComfort: roomComfort, breakLen: breakLen, comfortText: comfortText, scanAct: scanAct, scanDev: scanDev, hasJack: hasJack, punctWord: punctWord, staffPrompt: staffPrompt,
    run: function (sec) { var n = Math.round(sec / 0.05); for (var i = 0; i < n; i++) { tickWorld(0.05); if (driving) updatePlayer(0.05); tickLife(0.05); doorAnim(0.05); placeTools(0.05); } syncInstances(); scene.updateMatrixWorld(true); },   // fresh world matrices, so a test raycast sees props where the tick put them
    setTime: function (h) { S.time = h; hudDirty = true; },
    spawnTruck: spawnTruck, signTruck: signTruck, truckById: truckById, truckAtDoor: truckAtDoor, truckMeshes: truckMeshes, doorPassable: doorPassable, doorPanelScale: function (i) { return doors[i].panel.scale.y; }, truckLeave: truckLeave, setDoor: setDoor,
    palletById: palletById, palletUse: palletUse, palletPrompt: palletPrompt, storePallet: storePallet, findSlotFor: findSlotFor, newPallet: newPallet,
    slotKey: slotKey, slotUse: slotUse, slotPrompt: slotPrompt, stockCount: stockCount, totalStock: totalStock,
    grabTool: grabTool, releaseTool: releaseTool, toolWorld: toolWorld,
    genOrder: genOrder, orderById: orderById, benchAdd: benchAdd, benchUse: benchUse, packOrder: packOrder, canPack: canPack, shelfUse: shelfUse, loadUse: loadUse, consoleUse: consoleUse, consolePrompt: consolePrompt,
    hireStaff: hireStaff, fireStaff: fireStaff, buyUpgrade: buyUpgrade, startDrive: startDrive, stopDrive: stopDrive, forkGearCycle: forkGearCycle, forkLook: forkLook, forkUse: forkUse, forkTip: forkTip,
    handSet: handSet, putDown: putDown, interact: updateFocus, useFocus: useFocus, focusText: function () { return focusText; },
    lookAt: function (x, y, z) { camera.position.set(player.x, player.y + 1.62, player.z); camera.lookAt(x, y, z); camera.updateMatrixWorld(true); player.yaw = Math.atan2(-(x - player.x), -(z - player.z)); player.pitch = Math.atan2(y - camera.position.y, Math.sqrt(dist2(x, z, player.x, player.z))); updateFocus(); return focusText; },
    openPanel: openPanel, closePanel: closePanel, renderPanel: renderPanel, scanToggle: scanToggle, panelHtml: function () { return $('dc-panel-body').innerHTML; },
    sleepNow: sleepNow, flipBreaker: flipBreaker, inspection: inspection, prowlerCheck: prowlerCheck, drawBoard: drawBoard, introIndex: introIndex, floorY: floorY, collides: collides, route: route,
    cableUse: cableUse, cablePlugInto: cablePlugInto,
    hopperUse: hopperUse, moulderUse: moulderUse, buildProp: buildProp, agvState: agvState, balerUse: balerUse, addWaste: addWaste, wrapperUse: wrapperUse, palletiserEject: palletiserEject, packUse: packUse, beltItems: beltItems, beltSink: beltSink, beltPoint: beltPoint, gantryNeed: gantryNeed, gantryState: gantryState, buildGantries: buildGantries, drawScreens: drawScreens, screenTap: screenTap, collides: collides, solids: solids, SPOT: SPOT, RACK: RACK, grabTool: grabTool, releaseTool: releaseTool, screens: screens, agvScreen: function () { return agvScreen; }, palletWorld: palletWorld, rackSlotPos: rackSlotPos, speedOf: speedOf, speedCycle: speedCycle, HALL: HALL, wallX: wallX, focusAlt: function () { if (focus && focus.alt) focus.alt(); }, shelfPrompt: shelfPrompt, loadPrompt: loadPrompt, cartParcels: cartParcels, dropMarker: dropMarker, updateDropMarker: updateDropMarker, dropPoint: dropPoint, BELTS: BELTS, MACH: MACH, inWing: inWing,
    openPc: openPc, closePc: closePc, pc: pc, load: load, save: save, state: function () { return S; }, parcelExists: parcelExists, speedCycle: speedCycle, UPPER: UPPER, liftState: liftState, upperSlotFor: upperSlotFor, buildUpper: buildUpper, buildSorter: buildSorter, sortState: sortState, orderMode: orderMode, MODES: MODES, TRUCK_OUT: TRUCK_OUT, SORT: SORT, floorYAt: floorY, stageOf: stageOf, deckNightRun: deckNightRun, walkoverY: walkoverY, HALLS: HALLS, buildHall: buildHall, returnSurplus: returnSurplus, surplusCount: surplusCount, scan: scan, scanGo: scanGo, scanClearNav: scanClearNav, scanScroll: scanScroll, scanPageRows: scanPageRows, scanRows: function () { return scanDev.rows; }, scanReadout: scanReadout, drawScanner: drawScanner, scanPage: scanPage, tickScanner: tickScanner, inAnnex: inAnnex, insideHall: insideHall, DOOR_MAP: DOOR_MAP, doorIndex: doorIndex, groundRows: groundRows, rowBays: rowBays, slotTotal: slotTotal, plantRows: plantRows, staffTrain: staffTrain, staffRaise: staffRaise, staffShiftCycle: staffShiftCycle, staffCrossCycle: staffCrossCycle, shiftStart: shiftStart, staffCap: staffCap, activeClients: activeClients,
    beltSnap: beltSnap, beltFeeder: beltFeeder, BELT_PIECES: BELT_PIECES, machinePoints: machinePoints, freeStock: freeStock, benchNeed: benchNeed, benchSurplus: benchSurplus, benchBoxUse: benchBoxUse,
    myClock: myClock, staffNewDay: staffNewDay, payStaffWages: payStaffWages, staffStatus: staffStatus, hourly: hourly,
    editToggle: editToggle, editGrab: editGrab, editDrop: editDrop, editRotate: editRotate, editReset: editReset, editRemove: editRemove, editRestore: editRestore, editBuy: editBuy, propInst: propInst, PROPS: PROPS, edit: edit, buildProp: buildProp,
    propWorld: propWorld, rdesk: rdesk, rdeskUse: rdeskUse, rdeskBoxUse: rdeskBoxUse, rdeskStart: rdeskStart, returnPlace: returnPlace, returnById: returnById, addReturn: addReturn, returnsPending: returnsPending, loadPrompt: loadPrompt, receivePallet: receivePallet,
    photo: photo, photoToggle: photoToggle, photoTick: photoTick, drawScanMap: drawScanMap, MAP_PAGE: MAP_PAGE, closeDay: closeDay, reportHtml: reportHtml, dayReportShown: function () { return !$('h-report').hidden; }, outNext: outNext, orderLate: orderLate, truckWarn: truckWarn,
    updateHud: updateHud, updatePlayer: updatePlayer, photoZoom: photoZoom, scanReturnsNav: scanReturnsNav, SET: SET, contractAccept: contractAccept, contractDecline: contractDecline, wallPlanes: depotWallPlanes, propWhere: propWhere, propSeed: propSeed, buff: buff, dress: dress,
    addXp: addXp, counts: function () { return { draws: (post.calls || renderer.info.render.calls), inter: inter.length, dyn: dyn.length, baked: baked.draws, hidden: baked.hidden }; },
    // 1.21.0: the ladder and the stages
    BOOT_STAGE: BOOT_STAGE, stageForOwned: stageForOwned, dockLabel: dockLabel, dockOwned: dockOwned, removePallet: removePallet, DOCKS: DOCKS, TRUCK_IN: TRUCK_IN, UPGRADES: UPGRADES, canPackShort: canPackShort, nextOutLeave: nextOutLeave, toolPrompt: toolPrompt, STAGES: STAGES, STAGE: STAGE, STAGE_LAST: STAGE_LAST, stageHas: stageHas, stageForLevel: stageForLevel, stageName: stageName, stageFlags: stageFlags, stageEarn: stageEarn, stageRebuild: stageRebuild, UNLOCK: UNLOCK, unlocked: unlocked, XP_TABLE: XP_TABLE, XP_FOR: XP_FOR, LEVEL_CAP: LEVEL_CAP, LEVEL_BONUS: LEVEL_BONUS, STAFF_CAPS: STAFF_CAPS, staffCapAt: staffCapAt, levelOpens: levelOpens, nextLevelText: nextLevelText, LADDER_NOTES: LADDER_NOTES, skuOpen: skuOpen, unlockedSkus: unlockedSkus, modeDock: modeDock, modeDoor: modeDoor, lanesOn: lanesOn, VAN: VAN, FIRE_X: FIRE_X, SHIP_PATH: SHIP_PATH, LOADER_DOORS: LOADER_DOORS, BAY: BAY, shelfCap: shelfCap, benchCapNow: benchCapNow, stageRent: stageRent, propStageOk: propStageOk, applyLevelUnlocks: applyLevelUnlocks, contractSlots: contractSlots, contractsAll: contractsAll, contractOffer: contractOffer, offerContract: offerContract, contractSettle: contractSettle, devCommand: devCommand, DEV_COMMANDS: DEPOT_COMMANDS, devLink: devLink, devLinkToggle: devLinkToggle, devState: devState, scanPageOpen: scanPageOpen, pcApps: pcApps, pcTabs: pcTabs, shopShows: shopShows, INTRO: INTRO, introText: introText, rowBays: rowBays, levelCardShown: function () { return !$('h-level').hidden; }, truckDockX: truckDockX, trailerBounds: trailerBounds, truckParcelPos: truckParcelPos, hdoors: hdoors, doors: doors, yard: yard, world: world, RACK_SLOTS: function () { return Object.keys(slotHits).length; }
  };
  var DEPOT = CO.boot(GAME);
  DEPOT.guideHtml = guideHtml;   // menu.js shows the guide before the game starts
