// Scenario B: the small hall (stage 1), loaded from the shed scenario's save (level 5, two rows). The rooms, the docks, the bench
// and the pack line, the shop and the crew from the ladder, returns at 8, the shipping belt at 9 into the OUT 1 bay, the climb to 10.
'use strict';
module.exports = `
  window.DEPOT.enter();
  ok(T.BOOT_STAGE === 1 && S.site === 1 && S.level === 5 && S.up.rows === 2 && T.HALL.x === 20 && T.HALL.z === 14 && T.HALL.h === 7, 'the small hall: 40 by 28 under 7 m, stage 1 at level 5 with two rows');
  ok(T.stageHas('rooms') && !T.stageHas('wing') && !!T.propInst.desk && !!T.propInst.cabinet && !!T.propInst.breaker && !!T.propInst.charger && !!T.propInst.packline && !!T.propInst.timeclock && !!T.propInst.cot && !T.propInst.moulder && !T.propInst.car0 && !T.propInst.parkingSign, 'the office, the cabinet, the breaker, the charger, the pack line and the rooms stand; no wing, no car park');
  ok(!!T.doors[0] && !!T.doors[2] && !T.doors[1] && !T.doors[3] && T.DOCKS.in[0].z === -8 && T.DOCKS.out[0].z === -8 && T.floorY(-19.8, -8) === 0 && T.floorY(19.8, -8) === 0 && T.doors[0].z === -8, 'IN 1 and OUT 1 at z -8; no second docks yet');
  ok(!!T.propInst.consoleIn0 && !!T.propInst.console0 && !T.propInst.consoleIn1 && !T.propInst.console1 && !T.propInst.console2, 'a console at each of the two docks');
  ok(T.TRUCK_OUT.length === 1 && !T.TRUCK_OUT[0].van && !T.lanesOn() && T.dockLabel(2) === 'OUT 1' && T.modeDoor('sea') === 2 && T.modeDoor('land') === 2, 'one outbound dock takes every lane: no lanes yet');
  ok(Math.abs(T.SPOT.bench.x - 16.6) < 0.01 && Math.abs(T.SPOT.bench.z - -2.2) < 0.01 && !T.collides(15.0, 0.9) && T.collides(16.6, -2.2) && T.collides(16.6, 2.0), 'the bench stands on the east strip north of the office, the pack line past its end: ' + JSON.stringify(T.SPOT.bench));
  const pw = T.propWorld('packline', 0, 7.0); ok(pw.z > 6 && pw.z < 8.4 && pw.x > 16 && pw.x < 17.2, 'the parcel shelf is clear of the office front (z 8.5): ' + pw.x.toFixed(1) + ',' + pw.z.toFixed(1));
  ok(T.FIRE_X === 13.5 && !T.collides(13.5, -13.3) && T.collides(11.5, -13.9), 'the fire exit is cut 6.5 m in from the east wall' + (T.collides(13.5, -13.3) ? ' · blocked by ' + JSON.stringify(T.solids.filter((s) => 13.5 > s.x0 - 0.4 && 13.5 < s.x1 + 0.4 && -13.3 > s.z0 - 0.4 && -13.3 < s.z1 + 0.4).map((s) => [s.prop || 'wall', s.x0, s.x1, s.z0, s.z1, s.y0, s.y1])) : ''));
  ok(T.insideHall(-18, 11) && T.propWhere('timeclock') === 'lobby' && T.propWhere('desk') === 'office' && T.propWhere('cot') === 'break room', 'the lobby, the office and the break room are where the small hall put them');
  ok(T.stageRent() === 60 && T.STAGE.maxOpen === 4 && T.benchCapNow() === 24 && T.shelfCap() === 12, 'rent $60, four open orders, a 24-box bench, a shelf of twelve');
  ok(T.yard.gates.length === 2 && T.yard.guards.length === 2 && T.STAGE.fence.x === 50, 'a barrier and a gatehouse each side, the fence at 50 m');
  ok(T.unlocked('pc') && T.pcTabs().some((t) => t[0] === 'contracts') && !T.pcTabs().some((t) => t[0] === 'finance'), 'Depot OS has contracts now, the bank waits for level 6');
  ok(T.scanPageOpen(5) && T.scanPageOpen(8) && !T.scanPageOpen(6), 'the Docks and Map pages are open, Plant waits for the hall');
  // the pack line packs
  S.flags.noEvents = 1; S.events.power = false; T.setTime(9); const o = mkOrder(); o.lines = [{ sku: 'bolts', qty: 1 }]; T.benchAdd('bolts', 1);
  ok(T.packOrder(o) && o.state === 'packing', 'the order goes to the pack line'); T.run(0.1); ok(!!S.pack.job && !S.pack.job.hand, 'and the line, not a hand, packs it'); T.run(30); if (S.pack.jam) { T.packUse(); T.run(15); } ok(o.state === 'packed' && S.bench.parcels[0] === o.id, 'the pack line made the parcel');
  // the truck at OUT 1 takes it, due at the next OUT 1 window
  ok(T.modeDock('sea') === 0 && T.modeDock('air') === 0 && T.nextOutLeave(S.day * 24 + S.time, T.modeDock('sea')) === T.nextOutLeave(S.day * 24 + S.time, 0) && T.nextOutLeave(S.day * 24 + S.time, 0) > S.day * 24 + S.time, 'due times come from the one dock'); clearOut(); quietDocks(); const tout = T.spawnTruck('out', 0, 23); tout.x = T.HALL.x + 0.4; T.run(3); T.setDoor(2, true); T.run(4);
  ok(tout.state === 'docked' && tout.mode === 'land', 'the outbound truck at OUT 1 is a land truck');
  T.shelfUse({ kind: 'shelf', order: o.id }); T.loadUse(tout.id); const b0 = S.bank; T.consoleUse(2); ok(S.bank - b0 === o.pay && !(S.shipped[0] && S.shipped[0].wrong), 'paid in full out of the only door: no forwarding fee without lanes'); T.run(15);
  // the shop and the crew by the ladder
  S.bank += 20000; ok(T.shopShows(T.UPGRADES.filter((u) => u.id === 'row3')[0]) && T.shopShows(T.UPGRADES.filter((u) => u.id === 'row4')[0]) && !T.shopShows(T.UPGRADES.filter((u) => u.id === 'row5')[0]), 'rows 3 and 4 are in the shop, row 5 waits for the hall');
  T.buyUpgrade('fork'); ok(!S.up.fork, 'the forklift waits for level 6'); climbTo(6); ok(S.level === 6 && T.unlocked('fork') && T.unlocked('loan') && T.unlockedSkus().indexOf('coffee') >= 0, 'level 6: the forklift, the bank, coffee beans');
  T.buyUpgrade('fork'); T.buyUpgrade('row3'); ok(S.up.fork && S.up.rows === 3 && !!T.propInst.rack2, 'bought the forklift and the third row');
  ok(T.pcTabs().some((t) => t[0] === 'finance'), 'the Bank tab appeared');
  T.hireStaff('packer'); ok(!S.staff.some((st) => st.role === 'packer'), 'no packer before level 8');
  climbTo(7); ok(S.level === 7 && T.unlocked('prowler') && T.unlocked('shifts') && T.unlocked('insurance') && T.staffCapAt(7) === 3, 'level 7: the prowler, shift patterns, insurance, three heads');
  climbTo(8); ok(S.level === 8 && T.unlocked('returns') && !!T.propInst.returnsDesk && T.unlocked('packer') && T.unlocked('driver'), 'level 8: the returns desk stands up at once, the packer and the driver can be hired');
  const dw = T.propWorld('returnsDesk', 0, 1.1); ok(T.insideHall(dw.x, dw.z) && !T.collides(dw.x, dw.z) && dw.x < 16 && dw.x > 11, 'the returns desk stands west of the bench with room to work: ' + dw.x.toFixed(1) + ',' + dw.z.toFixed(1));
  T.hireStaff('packer'); ok(S.staff.some((st) => st.role === 'packer') && S.staff.length <= T.staffCapAt(8), 'hired the packer: ' + S.staff.length + ' on the crew of up to ' + T.staffCapAt(8));
  const offDuty = S.staff.map((st) => [st, st.dayOff]); S.staff.forEach((st) => { st.state = 'home'; st.clocked = false; st.dayOff = true; st.task = null; st.carry = null; });   /* the crew stays out of the returns test */
  { clearOut(); quietDocks(); const rt = T.spawnTruck('out', 0, 23); rt.x = T.HALL.x + 0.4; const rid = T.addReturn(rt, { num: 77, client: 'grocer', mode: 'land', lines: [{ sku: 'cereal', qty: 2 }], reason: 'unwanted' }); T.run(3); T.setDoor(2, true); T.run(4);
    T.player.tool = null; T.releaseTool(); T.handSet(null); T.loadUse(rt.id); ok(S.hand && S.hand.kind === 'return', 'a return comes off the OUT 1 truck'); S.events.power = false; const shelf0 = T.rdesk().shelf.length, done0 = T.rdesk().done || 0; T.player.x = dw.x; T.player.z = dw.z; T.rdeskUse(); T.rdeskUse(); for (let k = 0; k < 4 && (T.rdesk().done || 0) < done0 + 1; k++) T.run(4); ok(T.rdesk().shelf.length === shelf0 + 2 && (T.rdesk().done || 0) >= done0 + 1, 'the desk inspected it: two boxes on the shelf (' + (T.rdesk().shelf.length - shelf0) + ' added, done ' + T.rdesk().done + ')');   /* powered, counted from where the shelf stood, and up to 16 s: the CI runner saw this fail once at a fixed 6 */ T.rdesk().shelf.length = 0; T.truckLeave(rt, 'test'); T.run(15); offDuty.forEach((p) => { p[0].dayOff = p[1]; }); }
  // the shipping belt at 9 ends in the OUT 1 bay, and the loader loads the OUT 1 truck
  climbTo(9); ok(S.level === 9 && T.unlocked('shipbelt') && T.unlocked('jackLift') && T.unlocked('training'), 'level 9: the shipping belt, the stacker, training');
  T.buyUpgrade('shipbelt'); ok(S.up.shipbelt && !!T.propInst.shipBelt && !!T.propInst.dockLoader2 && !!T.propInst.bay2 && T.LOADER_DOORS.dockLoader2 === 2, 'the shipping belt, the loader and the bay stand, and the loader serves OUT 1');
  const sk = T.beltSink(T.BELTS.shipBelt); ok(sk && sk.machine && sk.machine.id === 'bay2' && T.BAY.at.dockLoader2.z0 === -6.1 && Math.abs(T.BAY.x0 - 17.4) < 0.01, 'the belt ends in the bay beside OUT 1: ' + JSON.stringify({ sink: sk && sk.machine && sk.machine.id, bay: [T.BAY.x0, T.BAY.at.dockLoader2.z0] }));
  { clearOut(); quietDocks(); const dl = T.spawnTruck('out', 0, 23); dl.x = T.HALL.x + 0.4; T.run(3); T.setDoor(2, true); T.run(4); const ao = mkOrder(); ao.lines = [{ sku: 'bolts', qty: 1 }]; T.benchAdd('bolts', 1); T.packOrder(ao); T.run(40); if (S.pack.jam) { T.packUse(); T.run(20); } T.run(90);
    ok(ao.state === 'loaded' || ao.state === 'shipped', 'the parcel rode the belt down the east wall and the loader put it on the OUT 1 truck: ' + ao.state + ' belt ' + T.beltItems('shipBelt').length + ' bay ' + T.stageOf('dockLoader2').length); T.truckLeave(dl, 'test'); T.run(15); }
  // the power cut and the breaker exist now
  S.events.power = true; T.flipBreaker(); ok(S.events.power === false && !!T.propInst.breaker, 'the breaker in the office resets a power cut');
  // level 10 books the hall
  climbTo(10); ok(S.level === 10 && S.siteDue === 2 && S.site === 1 && T.unlocked('raw') && T.unlocked('scanPlant'), 'level 10 books the builders for the hall; raw granulate and the Plant page open');
  ok(T.levelOpens(10).some((x) => /hall/.test(x)) && T.levelOpens(10).some((x) => /granulate/.test(x)), 'the level card says the hall and the granulate: ' + T.levelOpens(10).join('; '));
  T.setTime(19); const d0 = S.day; T.sleepNow(); ok(S.day === d0 + 1 && S.site === 2 && T.ui.rebuildPending === true, 'slept: the hall is due at the reload');
`;
