// Scenario E: the annexes (stage 4), loaded from the big hall's save (level 20, the returns hall and Hall 3 owned). The halls stand
// from the first frame: the returns hall with its dock, belt and desks, Hall 3 with IN 3; two contracts at 21; the climb to 25.
'use strict';
module.exports = `
  window.DEPOT.enter(); S.flags.noEvents = 1; S.events.power = false; T.player.y = 0;
  ok(T.BOOT_STAGE === 4 && S.site === 4 && S.level === 20 && S.up.hall2 && S.up.hall3 && !S.up.hall4, 'the annexes: stage 4 at level 20, both halls owned, Hall 4 not yet');
  ok(!!T.propInst.hall2 && !!T.propInst.hall3 && !!T.propInst.rack22 && !!T.propInst.rack23 && !T.propInst.rack20 && T.insideHall(20, -34) && T.insideHall(-25, -34) && !T.insideHall(0, -54), 'the returns hall and Hall 3 stand with Hall 3 rows; Hall 4 behind the wing is not yet a place');
  ok(!T.collides(18.8, -24.0) && !T.collides(-27.2, -24.0) && !!T.propInst.shuthall4 && T.collides(6.8, -44.0), 'both doorways are open; Hall 4 stays shuttered in the wing wall');
  ok(!!T.propInst.retBelt && !!T.propInst.retIntake && !!T.propInst.retDesk0 && !!T.propInst.retDesk1 && !!T.propInst.retDesk2 && !!T.propInst.retCage && !!T.propInst.retCompactor && !!T.propInst.retPaint && !!T.propInst.retSign && !T.propInst.returnsDesk, 'the returns hall is fitted out and the desk by the bench has gone');
  ok(T.returnsHall() && T.rdeskStations() === 3 && T.rdeskCap() === 8 && T.rdesk().s.length === 3, 'three inspection stations share a queue of eight');
  ok(!!T.doors[5] && !!T.doors[6] && T.doorOwned(6) && T.doorOwned(5) && T.DOCKS.in[2].z === -34 && T.DOCKS.ret[0].z === -34 && T.collides(36.0, -30.0) && T.dockStepSide(6) === -1, 'IN 3 is cut into Hall 3 and the returns dock into the returns hall, both shut');
  ok(!!T.propInst.consoleIn2 && !!T.propInst.consoleRet && Math.abs(T.propWorld('consoleRet', 0, 0).x - (T.HALL.x - 0.3)) < 0.01, 'the IN 3 and returns dock consoles stand');
  ok(T.groundRows().indexOf(22) >= 0 && T.groundRows().indexOf(20) < 0 && T.slotTotal() === S.up.rows * 45 + 30 + 2 * 15, 'the ground rows are the main rows and Hall 3 rows; the returns hall has none: ' + T.slotTotal() + ' slots');
  ok(T.stageRent() === 160 && T.STAGE.maxOpen === 10, 'rent $160, ten open orders');
  ok(!!T.propInst.exthall2 && !!T.propInst.clockhall2 && !!T.propInst.firstAidhall2 && !!T.propInst.firstAidhall3 && !T.propInst.aislehall2 && !!T.propInst.aislehall3, 'the halls have their fixtures: extinguishers, clocks, first-aid boxes, an aisle sign for Hall 3 only');
  const wp = T.wallPlanes(); ok(wp.some((w) => w.a === 'z' && Math.abs(w.v - (-44 + 0.17)) < 0.01) && wp.some((w) => w.a === 'x' && Math.abs(w.v - (T.HALL.x - 0.17)) < 0.01 && w.z0 === -44), 'the returns hall walls take wall props');
  ok(!!T.scanReturnsNav() && T.scanReturnsNav().label === 'Returns intake' && /returns hall/.test(T.propWhere('retCage')), 'the returns waypoint points at the intake');
  ok(T.propInst.notice && !T.propInst.notice.P.hidden, 'the lobby notice board stands with the returns truck on its timetable');
  // the returns truck and the belt into the intake
  { quietDocks(); clearOut(); S.trucks.filter((t) => t.dir !== 'in').forEach((t) => T.truckLeave(t, 'test')); T.run(20); const frozen = S.staff.map((st) => ({ st, state: st.state, clocked: st.clocked, out: st.clockedOutAt })); S.staff.forEach((st) => { st.task = null; st.carry = null; st.clocked = false; st.state = 'home'; });
    const rt = T.spawnTruck('ret', 0, 23); rt.x = T.HALL.x + 0.4; T.run(3); ok(rt.state === 'docked' && T.truckAtDoor(6) === rt && rt.dir === 'ret', 'the returns truck docks at the returns dock');
    while (rt.returns.length < 3) T.addReturn(rt, { num: 90 + rt.returns.length, client: 'grocer', mode: 'land', lines: [{ sku: 'bolts', qty: 1 }], reason: 'unwanted' }); const nR = rt.returns.length, q0 = T.rdesk().queue.length;
    ok(!T.retFeedWorks(rt), 'the belt does not run with the dock door down'); T.setDoor(6, true); T.run(4); ok(T.retFeedWorks(rt), 'the dock door up and the power on: the belt runs');
    T.run(100); ok(rt.returns.length < nR && T.rdesk().queue.length >= q0 + 1, 'the belt took the returns off the trailer into the intake queue: ' + (nR - rt.returns.length) + ' gone, ' + T.rdesk().queue.length + ' waiting');
    const qid = T.rdesk().queue[0]; T.rdeskStart(1); ok(T.rdesk().s[1].cur === qid && T.returnPlace(qid) === 'inspecting', 'desk 2 took the next return off the shared queue'); T.run(6); ok(!T.rdesk().s[1].cur && T.rdesk().shelf.length >= 1, 'desk 2 finished: the boxes are in the restock cage');
    T.truckLeave(rt, 'test'); T.run(1); frozen.forEach((f) => { f.st.state = f.state; f.st.clocked = f.clocked; f.st.clockedOutAt = f.out; }); T.rdesk().shelf.length = 0; T.rdesk().queue.length = 0; S.returns.length = 0; }
  // IN 3 takes a truck and the receivers empty it into the Hall 3 rows
  { S.trucks.filter((t) => t.dir === 'in').forEach((t) => T.truckLeave(t, 'test')); T.run(20); const t3 = T.spawnTruck('in', 2, 23); t3.x = -T.HALL.x - 0.4; T.run(3); ok(t3.state === 'docked' && T.truckAtDoor(5) === t3, 'an inbound truck docks at IN 3');
    T.setDoor(5, true); T.run(4); T.signTruck(t3); const left0 = S.pallets.filter((p) => p.place === 'truck' && p.truck === t3.id && p.n > 0).length; S.pallets.filter((p) => p.place === 'truck' && p.truck === t3.id).forEach((p) => { const k = T.findSlotFor(p.sku, p.n, 2); if (k) { p.place = 'floor'; T.storePallet(p, k); } }); ok(left0 > 0 && S.pallets.filter((p) => p.place === 'truck' && p.truck === t3.id).length < left0, 'its pallets go onto the racks'); T.truckLeave(t3, 'test'); T.run(20); }
  // the old-save checks of the halls era: the Hall 2 doorway clear on both faces, no column in the OUT 3 doorway
  ok(!T.collides(18.8, -23.6) && !T.collides(18.8, -24.4), 'the Hall 2 doorway is clear on both faces of the wall');
  ok(!T.solids.some((s) => !s.prop && s.x0 > 35 && s.z1 > -23.4 && s.z0 < -19.8 && s.y0 < 1 && s.y1 > 5), 'no lining column stands in the OUT 3 doorway');
  // the ladder to 25: two contracts at 21, the deck belts at 22, the furniture at 23, the long contract at 24
  S.bank += 20000; climbTo(21); ok(S.level === 21 && T.contractSlots().length === 2, 'level 21: two contract slots');
  { S.contract = null; S.contract2 = null; const c1 = T.offerContract(); ok(!!c1 && S.contract === c1, 'an offer in the first slot'); T.contractAccept(); ok(c1.accepted, 'accepted'); const c2 = T.offerContract(); ok(!!c2 && S.contract2 === c2 && !c2.accepted && c2.need === c1.need, 'a second offer lands in the second slot while the first runs'); T.contractDecline(); ok(!S.contract2 && S.contract === c1, 'declining clears the second slot only'); S.contract = null; }
  climbTo(22); ok(S.level === 22 && T.unlocked('deckTier2'), 'level 22: the deck belts run half as fast again');
  { T.beltItems('spine').length = 0; T.beltItems('spine').push({ kind: 'parcel', order: 'x-speed', mode: 'land', d: 0 }); S.speed = {}; T.run(1); const d22 = T.beltItems('spine')[0] ? T.beltItems('spine')[0].d : 0; T.beltItems('spine').length = 0; ok(d22 > 2.0 && d22 < 2.6, 'a parcel on the spine rides 1.5 times the deck rate: ' + d22.toFixed(2) + ' m in a second'); }
  climbTo(23); ok(S.level === 23 && T.unlocked('decor') && T.PROPS.xPicture.lvl === 23 && T.PROPS.xSofa.lvl === 18, 'level 23: the last of the furniture; the seating came at 18');
  climbTo(24); ok(S.level === 24 && T.unlocked('longContract'), 'level 24: the long contract');
  { let longSeen = false; for (let k = 0; k < 40 && !longSeen; k++) { S.contract = null; const c = T.offerContract('contract'); if (c && c.long) longSeen = c.until - S.day * 24 > 4 * 24 && c.penalty === 300; } S.contract = null; ok(longSeen, 'a long contract comes now and then: five days, a bigger penalty'); }
  ok(T.staffCapAt(S.level) === 8 && T.unlockedSkus().length === 15 && T.activeClients().length === 9, 'eight heads, every line but the granulate, every client');
  climbTo(25); ok(S.level === 25 && S.siteDue === 5 && !S.up.hall4, 'level 25 books Hall 4 and the full yard; the builders come in the morning');
  ok(T.levelOpens(25).some((x) => /far end/.test(x)), 'the card says the far end: ' + T.levelOpens(25).join('; '));
  T.setTime(19); const d0 = S.day; T.sleepNow(); ok(S.day === d0 + 1 && S.site === 5 && S.up.hall4 === true && T.ui.rebuildPending === true, 'slept: the far end is due at the reload, Hall 4 owned');
`;
