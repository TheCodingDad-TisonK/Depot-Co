// Scenario C: the hall (stage 2, 60 by 48), loaded from the small hall's save (level 10). The second docks and the lanes, the
// production wing, the car park and the road, the wrong-door fee, the AGV at 12, the gantry at 14, the climb to 15.
'use strict';
module.exports = `
  window.DEPOT.enter();
  ok(T.BOOT_STAGE === 2 && S.site === 2 && S.level === 10 && T.HALL.x === 30 && T.HALL.z === 24 && T.HALL.h === 8 && S.up.dock2 === true, 'the hall: 60 by 48 under 8 m, stage 2 at level 10, the second inbound bay free');
  ok(!!T.doors[0] && !!T.doors[1] && !!T.doors[2] && !!T.doors[3] && !T.doors[4] && T.DOCKS.in[1].z === -6 && T.DOCKS.out[1].z === -6, 'IN 2 and OUT 2 at z -6; no OUT 3');
  ok(T.TRUCK_OUT.length === 3 && T.lanesOn() && T.modeDoor('sea') === 2 && T.modeDoor('land') === 3 && T.modeDoor('air') === 4 && !T.dockOwned(2) && T.setDoor(4, true) === false, 'three lanes on three docks; OUT 3 waits for the deck');
  ok(T.stageHas('wing') && T.inWing(-4, -36) && !T.inWing(-4, -20) && T.floorY(-4, -36) === 0 && !!T.propInst.moulder && !!T.propInst.hopper && !!T.propInst.palletiser && !!T.propInst.silo, 'the production wing stands with its machines');
  ok(!!T.propInst.car0 && !!T.propInst.parkingSign && !!T.propInst.tree0 && T.yard.traffic.length === 8 && !!T.propInst.shuthall4 && !T.propInst.shuthall2, 'the car park, the trees, the road traffic; Hall 4 shuttered in the wing wall, the main hall doorways not yet cut');
  ok(Math.abs(T.SPOT.bench.x - 26.6) < 0.01 && Math.abs(T.SPOT.bench.z - 5.2) < 0.01 && T.FIRE_X === 23.5 && !!T.propInst.consoleIn1 && !!T.propInst.console1 && !!T.propInst.aisleDE, 'the 60-frame layout: the bench at 26.6, the fire exit at 23.5, four consoles, the D/E aisle sign');
  ok(T.propWorld('extNE', 0, 0).x > 29 && T.propWorld('returnsDesk', 0, 0).x < 24 && T.propWorld('tv', 0, 0).x < -24 && T.propWorld('dockLoader2', 0, 0).x < 29, 'the 72-frame props are pulled in to the 60 m walls');
  ok(T.stageRent() === 110 && T.STAGE.maxOpen === 6 && T.STAGE.pallets[0] === 3, 'rent $110, six open orders, three to six pallets a truck');
  ok(T.unlocked('scanPlant') && T.scanPageOpen(6) && T.pcApps().some((a) => a[0] === 'factory') && T.pcApps().some((a) => a[0] === 'plant'), 'the Plant page and the Production and Plant apps are open');
  S.flags.noEvents = 1; S.events.power = false;
  // the lanes: an order carries its lane; out of the wrong door it pays the fee
  { S.flags.noOrders = 1; T.setTime(15); quietDocks(); clearOut(); const lo = mkOrder(); ok(!!T.MODES[lo.mode] && lo.mode === T.orderMode(lo) && lo.mode !== 'air', 'an order carries its lane (' + lo.mode + ') and air waits for the deck');
    const wrongDoor = lo.mode === 'sea' ? 3 : 2; const wt = T.spawnTruck('out', wrongDoor - 2, 23); wt.x = T.HALL.x + 0.4; T.run(3); T.setDoor(wrongDoor, true); T.run(4);
    lo.state = 'packed'; S.bench.parcels.push(lo.id); T.handSet(null); T.shelfUse({ kind: 'shelf', order: lo.id }); ok(/wrong lane/.test(T.loadPrompt(wt.id) || ''), 'the trailer warns of the wrong lane: ' + T.loadPrompt(wt.id)); T.loadUse(wt.id);
    const payBefore = S.bank, mis0 = S.stats.misrouted || 0; T.consoleUse(wrongDoor); ok(S.bank - payBefore === Math.round(lo.pay * 0.75) && (S.stats.misrouted || 0) === mis0 + 1, 'the forwarding fee out of the wrong door, counted as misrouted'); T.run(15); S.flags.noOrders = 0; }
  // the wing works: granulate in, boxes out, a pallet dropped
  ok(T.beltSink(T.BELTS.moulderOut) && T.beltSink(T.BELTS.moulderOut).belt && T.beltSink(T.BELTS.moulderOut).belt.id === 'beltMain' && T.beltSink(T.BELTS.beltMain) && T.beltSink(T.BELTS.beltMain).machine && T.beltSink(T.BELTS.beltMain).machine.id === 'palletiser', 'moulder belt joins the main belt which ends at the palletiser');
  const rawP = T.newPallet('raw', 8, { place: 'jack' }); S.jack.pallet = rawP.id; T.player.tool = 'jack'; T.hopperUse(); ok(S.factory.raw === 40 && !S.jack.pallet, 'granulate tipped into the hopper: 40 units'); T.releaseTool();
  S.factory.product = 'dcbin'; T.moulderUse(); ok(S.factory.on, 'moulding line started'); T.run(160); if (S.factory.jam) { T.moulderUse(); T.run(80); } ok(S.pallets.some((p) => p.sku === 'dcbin' && p.place === 'floor' && p.n === 8), 'palletiser dropped a pallet of eight own-brand boxes: made ' + S.factory.made); S.factory.on = false;
  ok(T.unlockedSkus().indexOf('dcbin') >= 0 && T.unlockedSkus().indexOf('tv') < 0, 'own-brand bins are a line at 10; televisions wait for 11');
  // the ladder to 15
  S.bank += 30000; climbTo(11); ok(S.level === 11 && T.activeClients().some((c) => c.id === 'electro') && T.unlockedSkus().indexOf('tv') >= 0 && T.unlocked('raise'), 'level 11: Volt and Co., televisions, raises');
  climbTo(12); ok(S.level === 12 && T.unlocked('agv') && T.unlocked('row5') && T.shopShows(T.UPGRADES.filter((u) => u.id === 'row5')[0]), 'level 12: the AGV and the fifth row');
  T.buyUpgrade('row3'); T.buyUpgrade('row4'); T.buyUpgrade('row5'); ok(S.up.rows === 5 && !!T.propInst.rack4, 'bought the rows up to five: ' + S.up.rows);
  T.buyUpgrade('agv'); ok(S.up.agv && !!T.propInst.agvDock, 'bought the AGV: its dock stands');
  { const agvP = T.newPallet('cereal', 4, { place: 'floor', x: -26.5, z: -2.9, y: 0, rot: 0 }); const put0 = S.stats.agvPutaway || 0; T.run(60); for (let w = 0; w < 8 && T.palletById(agvP.id); w++) T.run(30); ok((S.stats.agvPutaway || 0) >= put0 + 1 && !T.palletById(agvP.id), 'the AGV put the pallet away: ' + JSON.stringify({ state: T.agvState().state, put: S.stats.agvPutaway })); }
  climbTo(14); ok(S.level === 14 && T.unlocked('gantry') && T.unlocked('plantTune') && T.unlocked('cross'), 'level 14: the gantry pickers (13 brought the tune-up and second roles)');
  T.buyUpgrade('gantry'); S.flags.noOrders = 1; ok(!!T.propInst.gantry0 && !!T.propInst.gantry4 && !!T.propInst.pickBelt && !!T.propInst.pickMerge, 'a crane over every row, the pick belts stand');
  ok(T.beltSink(T.BELTS.pickBelt) && T.beltSink(T.BELTS.pickBelt).belt && T.beltSink(T.BELTS.pickBelt).belt.id === 'pickMerge' && T.beltSink(T.BELTS.pickMerge) && T.beltSink(T.BELTS.pickMerge).machine && T.beltSink(T.BELTS.pickMerge).machine.id === 'benchIn', 'the pick belts hand over to the merge and the merge ends at the bench');
  const gk = T.slotKey(0, 2, 0); for (const k in S.slots) if (S.slots[k] && S.slots[k].sku === 'soap') delete S.slots[k]; S.pallets.forEach((p) => { if (p.sku === 'soap') p.sku = 'bolts'; }); S.staff.forEach((st) => { if (st.carry && st.carry.sku === 'soap') st.carry = null; st.task = null; }); S.slots[gk] = { sku: 'soap', n: 3, pal: true }; S.bench.boxes = {}; const go2 = mkOrder(); go2.lines = [{ sku: 'soap', qty: 1 }]; S.orders = S.orders.filter((o) => o === go2 || o.state !== 'open'); ['pickBelt', 'pickBelt2', 'pickMerge', 'upperPick', 'upperChute'].forEach((b) => { if (T.BELTS[b]) T.beltItems(b).length = 0; }); for (const gr in (S.gantries || {})) { S.gantries[gr].state = 'idle'; S.gantries[gr].sku = null; } const b0g = S.bench.boxes.soap || 0; T.run(110);
  ok((S.bench.boxes.soap || 0) >= b0g + 1 && S.slots[gk].n === 2, 'the gantry picked a soap box out of A3 and the belt put it on the bench: ' + JSON.stringify({ st: T.gantryState(0).state, slot: S.slots[gk] && S.slots[gk].n, bench: S.bench.boxes.soap }));
  S.orders = S.orders.filter((o) => o !== go2); S.flags.noOrders = 0;
  ok(!T.activeClients().some((c) => c.deck) && T.activeClients().length === 6, 'the deck accounts wait for the big hall');
  climbTo(15); ok(S.level === 15 && S.siteDue === 3 && T.unlocked('deckNight') && T.unlocked('agvSweep'), 'level 15 books the big hall; the deck night shift and the AGV sweep open');
  ok(!S.up.sorter && !S.up.upper && !T.propInst.mezz, 'the mezzanine and the deck come with the walls, in the morning');
  T.setTime(19); const d0 = S.day; T.sleepNow(); ok(S.day === d0 + 1 && S.site === 3 && S.up.upper === true && S.up.sorter === true && T.ui.rebuildPending === true, 'slept: the big hall is due, the deck and the mezzanine are owned for the reload');
`;
