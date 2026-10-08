// Scenario A: the shed (stage 0), a fresh save. Day one by hand: the truck at IN 1, the jack, the one rack row that grows a bay a
// level, the table and hand packing, the van, the clipboard office, the ladder from 1 to 5, the builders booked, the sleep that
// leaves the save at stage 1 for the next scenario.
'use strict';
module.exports = `
  window.DEPOT.enter();
  ok(S.day === 1 && S.bank === 600 && S.level === 1 && S.site === 0 && T.BOOT_STAGE === 0, 'fresh save: day 1, $600, level 1, the shed');
  ok(T.HALL.x === 7 && T.HALL.z === 5 && T.HALL.h === 5 && T.RACK.rows.length === 1 && S.up.rows === 1 && T.rowBays(0) === 1, 'the shed is 14 by 10 under a 5 m roof with one rack row of one bay');
  ok(!T.stageHas('rooms') && !T.stageHas('wing') && !T.propInst.desk && !T.propInst.cabinet && !T.propInst.packline && !T.propInst.breaker && !T.propInst.timeclock, 'no office, no wing, no PC, no cabinet, no pack line, no breaker, no time clock yet');
  ok(!!T.propInst.bench && !!T.propInst.board && !!T.propInst.cot && !!T.propInst.consoleIn0 && !!T.propInst.binDamaged && !!T.propInst.empties && !!T.propInst.firstAid && !!T.propInst.clockHall, 'the shed has its table, the board, the cot, the IN 1 console, the bin, the empties, the first-aid box and a clock');
  ok(T.doors[0] && !T.doors[1] && !T.doors[2] && !T.doors[3] && !T.doors[4] && T.DOCKS.in.length === 1 && T.DOCKS.out.length === 0 && T.DOCKS.in[0].z === 0, 'one dock door, IN 1 at z 0 in the west wall; no outbound door');
  ok(T.TRUCK_OUT.length === 1 && T.TRUCK_OUT[0].van && !T.lanesOn() && T.dockLabel(2) === 'the van' && T.modeDoor('sea') === 2 && T.modeDoor('air') === 2, 'the van is the one outbound, every lane goes by it, no lanes shown');
  ok(T.benchCapNow() === 8 && T.shelfCap() === 6 && T.stageRent() === 0 && T.STAGE.maxOpen === 2, 'the table holds eight boxes and six parcels, no rent, two open orders at most');
  ok(T.floorY(T.player.x, T.player.z) === 0 && T.insideHall(0, 0) && !T.insideHall(0, 8) && T.floorY(0, 8.2, 0) === T.floorY(-30, 0, 0), 'the player stands on the shed floor; the yard outside is the yard');
  { const clear = [[-3, 0.2], [0, 1], [4.6, 1.4]].filter((p) => T.collides(p[0], p[1])), solid = [[-4.5, -3.8], [4.6, 2.6]].filter((p) => !T.collides(p[0], p[1])); ok(!clear.length && !solid.length, 'the receiving square, the middle and the front of the table are clear; the rack and the table itself are solid' + (clear.length ? ' · blocked: ' + JSON.stringify(clear) + ' by ' + JSON.stringify(T.solids.filter((s) => clear.some((p) => p[0] > s.x0 - 0.4 && p[0] < s.x1 + 0.4 && p[1] > s.z0 - 0.4 && p[1] < s.z1 + 0.4)).map((s) => [s.prop || 'wall', s.x0, s.x1, s.z0, s.z1])) : '') + (solid.length ? ' · open: ' + JSON.stringify(solid) : '')); }
  ok(/Next: level 2, a second rack bay/.test(T.nextLevelText()) && !document.getElementById('h-next').hidden, 'the HUD promises the next level: ' + T.nextLevelText());
  ok(T.INTRO[0][0] === 'door' && T.INTRO[T.INTRO.length - 1][0] === 'levelup' && /shed/.test(T.introText()), 'the intro is written for the shed and starts at the door: ' + T.introText().replace(/<[^>]+>/g, '').slice(0, 60));
  ok(T.unlockedSkus().length === 4 && T.activeClients().length === 2, 'four lines and two clients at level 1');
  ok(T.scanPageOpen(0) && T.scanPageOpen(1) && T.scanPageOpen(2) && !T.scanPageOpen(3) && !T.scanPageOpen(5) && !T.scanPageOpen(8), 'the scanner has Home, Orders and Picks; Putaway, Docks and the Map wait for their levels');
  ok(T.pcTabs().map((t) => t[0]).join(',') === 'orders,shop,staff,stock,stats' && T.pcApps().map((a) => a[0]).indexOf('bank') < 0, 'Depot OS shows orders, the shop, the crew, stock and stats; no contracts, bank, production or plant yet');
  ok(!T.shopShows(T.UPGRADES.filter((u) => u.id === 'dock2')[0]) && !T.shopShows(T.UPGRADES.filter((u) => u.id === 'row3')[0]) && T.shopShows(T.UPGRADES.filter((u) => u.id === 'cart')[0]), 'the shop hides the free structure and the rows the shed has no room for, and lists the cart');
  // the first truck
  T.setTime(7.2); T.run(30);
  const tin = T.truckAtDoor(0); ok(!!tin && tin.pallets.length >= 1 && tin.pallets.length <= 3 && Math.abs(tin.x - -7.4) < 0.01, 'inbound truck docked at IN 1 with ' + (tin && tin.pallets.length) + ' pallets (one to three in the shed)');
  S.flags.noEvents = 1;
  T.setDoor(0, true); T.run(0.5); ok(!T.doorPassable(0), 'door panel still rising after half a second'); T.run(3); ok(T.floorY(-7.2, 0) === 0, 'the dock leveller bridges the slot'); T.run(2.5); ok(T.doorPassable(0), 'door panel up after three seconds');
  const mdr = T.truckMeshes[tin.id]; T.run(30); ok(mdr && mdr.drvD > 10, 'the driver walked in from the cab: ' + (mdr ? mdr.drvD.toFixed(1) : '?') + ' m');
  ok(/Sign the delivery note/.test(T.palletPrompt({ kind: 'pallet', id: tin.pallets[0] })), 'pallets wait for the signature');
  T.signTruck(tin); ok(tin.signed === true, 'delivery note signed');
  const p0 = T.palletById(tin.pallets[0]), bank0 = S.bank;
  T.palletUse({ kind: 'pallet', id: p0.id }); ok(S.hand && S.hand.kind === 'box' && S.hand.sku === p0.sku, 'took a box by hand'); ok(S.bank === bank0 + 12, 'receiving fee paid once the pallet is touched');
  const k00 = T.slotKey(0, 0, 0); T.slotUse(k00); ok(!S.hand && S.slots[k00] && S.slots[k00].n === 1, 'box stored in A1 floor, the one bay there is');
  ok(T.findSlotFor(p0.sku, 1, 1) === null || +T.findSlotFor(p0.sku, 1, 1).split(',')[1] === 0, 'no slot beyond the first bay is offered at level 1');
  // the jack
  T.grabTool('jack'); ok(T.player.tool === 'jack', 'grabbed the jack');
  ok(T.toolPrompt('jack2') === null, 'jack 2 is not a shed tool');
  T.palletUse({ kind: 'pallet', id: p0.id }); ok(S.jack.pallet === p0.id, 'jack lifted the pallet');
  const n = p0.n; T.slotUse(k00); ok(!S.jack.pallet && S.slots[k00] && S.slots[k00].n === n + 1, 'jack stored the pallet into A1 under the box already there: ' + (n + 1) + ' boxes (the jack reaches the floor level only)');
  T.releaseTool(); ok(T.player.tool === null, 'released the jack');
  // the rest of the load, straight to the racks (the top level too: the shed rack has three levels like any other)
  S.pallets.filter((p) => p.place === 'truck').forEach((p) => { const k = T.findSlotFor(p.sku, p.n, 2); if (k) { T.palletUse({ kind: 'pallet', id: p.id }); T.handSet(null); const pl = T.palletById(p.id); if (pl) { pl.place = 'floor'; T.storePallet(pl, k); } } else { const pl2 = T.palletById(p.id); if (pl2) { T.palletUse({ kind: 'pallet', id: p.id }); T.handSet(null); pl2.place = 'floor'; pl2.x = -3; pl2.z = 0.2; } } });
  T.run(30); ok(!T.truckAtDoor(0), 'emptied truck left the dock'); ok(T.totalStock() > 0, 'stock on the racks: ' + T.totalStock());
  // an order, picked and packed by hand at the table
  T.setTime(9); const o = T.genOrder(false); ok(!!o && o.lines.length <= 2 && !o.rush, 'order generated #' + (o && o.num) + ' with ' + (o && o.lines.length) + ' line(s), no rush yet');
  o.lines.forEach((l) => { while (T.stockCount(l.sku) < l.qty) { const k = T.findSlotFor(l.sku, 1, 2) || T.slotKey(0, 0, 2); S.slots[k] = S.slots[k] && S.slots[k].n ? S.slots[k] : { sku: l.sku, n: 0 }; S.slots[k].n += 1; } });
  const firstLine = o.lines[0], srcKey = Object.keys(S.slots).find((k) => S.slots[k].sku === firstLine.sku && S.slots[k].n > 0 && +k.split(',')[2] < 2);
  if (srcKey) { T.slotUse(srcKey); ok(S.hand && S.hand.sku === firstLine.sku, 'picked one box for the order'); } else { T.handSet({ kind: 'box', sku: firstLine.sku }); S.slots[Object.keys(S.slots).find((k) => S.slots[k].sku === firstLine.sku && S.slots[k].n > 0)].n--; ok(true, 'picked one box for the order (top level, by hand for the test)'); }
  T.player.x = 4.6; T.player.z = 1.3; T.benchUse(); ok(!S.hand && S.bench.boxes[firstLine.sku] === 1, 'box on the table');
  o.lines.forEach((l, i) => { const need = l.qty - (i === 0 ? 1 : 0); for (let q = 0; q < need; q++) { const k = Object.keys(S.slots).find((kk) => S.slots[kk].sku === l.sku && S.slots[kk].n > 0); S.slots[k].n--; if (!S.slots[k].n) delete S.slots[k]; T.benchAdd(l.sku, 1); } });
  ok(T.canPack(o) && !T.canPackShort(o), 'the order is packable and there are no short packs in the shed');
  T.benchUse(); T.run(0.1); ok(o.state === 'packing' && S.pack.job && S.pack.job.hand === true, 'E on the table starts packing by hand: ' + o.state + ' ' + JSON.stringify(S.pack.job));
  T.run(2); ok(o.state === 'packing', 'two seconds in, still packing'); T.run(2.5); ok(o.state === 'packed' && S.bench.parcels[0] === o.id, 'four seconds later the parcel is on the table');
  const shelfP = T.truckParcelPos; ok(!T.propInst.packline && S.bench.parcels.length === 1, 'the parcel stands on the table, no pack line');
  // the van
  T.setTime(10.3); T.run(40); const van = T.truckAtDoor(2);
  ok(!!van && van.van === true && Math.abs(van.x - T.VAN.x) < 0.01 && van.z === T.VAN.z && van.state === 'docked' && van.side === -1, 'the van parked at the shed front: x ' + (van && van.x.toFixed(1)) + ' z ' + (van && van.z));
  ok(T.floorY(van.x - 2, van.z, 0) < -0.5 && T.collides(van.x - 2, van.z), 'nobody walks into the van: its bed is not a floor and its body is solid');
  T.shelfUse({ kind: 'shelf', order: o.id }); ok(S.hand && S.hand.kind === 'parcel', 'parcel in hand');
  ok(/into the van/.test(T.loadPrompt(van.id) || ''), 'the van offers to take the parcel: ' + T.loadPrompt(van.id));
  T.loadUse(van.id); ok(!S.hand && van.parcels.length === 1 && o.state === 'loaded', 'parcel loaded into the van');
  const vp = T.truckParcelPos(van, 0); ok(vp.y < 0 && vp.y > -0.7 && vp.x < van.x, 'the parcel sits on the van bed, 0.6 m over the yard, inside the body');
  ok(/Dispatch/.test(T.consolePrompt(2)), 'the IN 1 console doubles for the van: ' + T.consolePrompt(2));
  const bank1 = S.bank; T.consoleUse(2); ok(van.state === 'leaving', 'the van is leaving'); T.run(2); ok(van.x < T.VAN.x - 5, 'and drives off west the way it came: x ' + van.x.toFixed(1));
  ok(S.bank > bank1 && S.shipped[0] && S.shipped[0].num === o.num && !S.shipped[0].wrong, 'paid ' + (S.bank - bank1) + ' for order #' + o.num + ', nothing misrouted');
  T.run(20); ok(!S.trucks.some((t) => t.id === van.id), 'the van is gone');
  // the van has a cap
  { T.setTime(15.9); T.run(40); const v2 = T.truckAtDoor(2); ok(!!v2 && v2.van, 'the afternoon van is in'); if (v2) { for (let i = 0; i < T.VAN.cap; i++) v2.parcels.push('x' + i); T.handSet({ kind: 'parcel', order: 'nope' }); ok(/full/.test(T.loadPrompt(v2.id) || ''), 'a full van says so: ' + T.loadPrompt(v2.id)); T.handSet(null); v2.parcels.length = 0; T.truckLeave(v2, 'test'); T.run(20); } }
  // the clipboard is the office
  T.openPanel('pc', 'orders'); ok(/Depot OS/.test(document.getElementById('dc-panel-title').textContent) && /paperwork/i.test(document.getElementById('dc-panel-title').textContent), 'the clipboard opens Depot OS: ' + document.getElementById('dc-panel-title').textContent); T.closePanel();
  // the ladder: level 2 brings a bay and the time clock, level 3 the cart and a picker, level 4 the flask and a receiver, level 5 books the builders
  S.level = 1; S.xp = 0; const bank2 = S.bank; T.addXp(T.XP_FOR(1));   /* the day earned XP of its own; the ladder is climbed from a known rung */ ok(S.level === 2 && S.bank === bank2 + 200, 'level 2: a $200 bonus (got ' + (S.bank - bank2) + ', intro ' + (S.intro.done ? 'done' : 'open') + ')');
  ok(T.rowBays(0) === 2 && Object.keys(T.PROPS).length > 0 && !!T.propInst.timeclock && T.levelCardShown(), 'level 2: a second bay, the time clock stands, the level card is up');
  ok(T.scanPageOpen(3) && !T.scanPageOpen(4), 'level 2: the Putaway page opens');
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true })); ok(!T.levelCardShown(), 'any key closes the level card');
  ok(T.staffCapAt(2) === 0 && T.staffCapAt(3) === 1 && T.staffCapAt(4) === 2 && T.staffCapAt(20) === 8, 'the crew caps climb the ladder: none at 2, one at 3, two at 4, eight at 20');
  climbTo(3); ok(S.level === 3 && T.rowBays(0) === 3 && T.unlocked('cart') && T.unlocked('picker') && T.unlockedSkus().indexOf('toys') >= 0 && T.activeClients().length === 3, 'level 3: a third bay, the cart and a picker in the shop, toy robots and Little Wonders');
  S.bank += 2000; T.buyUpgrade('cart'); ok(S.up.cart === true, 'bought the cart');
  T.hireStaff('picker'); ok(S.staff.length === 1 && S.staff[0].role === 'picker', 'hired the first head: a picker'); T.hireStaff('receiver'); ok(S.staff.length === 1, 'a receiver waits for level 4 (and the cap is one)');
  climbTo(4); ok(S.level === 4 && T.rowBays(0) === 4 && !!T.propInst.flask && T.unlocked('receiver'), 'level 4: the fourth bay, the coffee flask on the table, a receiver to hire');
  T.hireStaff('receiver'); ok(S.staff.length === 2, 'the receiver is hired, the crew is two');
  S.staff.forEach((st) => { st.arriveOff = 0; st.sick = false; st.dayOff = false; }); T.setTime(7.9); T.run(60); ok(S.staff.every((st) => st.clocked), 'both clocked in at the shed time clock: ' + S.staff.map((st) => T.staffStatus(st)).join(' / '));
  const jh = T.jackHome(S.staff[1]); ok(T.insideHall(jh.x, jh.z) && !T.collides(jh.x, jh.z), 'the receiver jack spot is inside the shed and clear: ' + jh.x + ',' + jh.z + (T.collides(jh.x, jh.z) ? ' blocked by ' + JSON.stringify(T.solids.filter((s) => jh.x > s.x0 - 0.4 && jh.x < s.x1 + 0.4 && jh.z > s.z0 - 0.4 && jh.z < s.z1 + 0.4).map((s) => [s.prop || 'wall', s.x0, s.x1, s.z0, s.z1])) : ''));
  { T.setTime(13.3); T.run(30); const t2 = T.truckAtDoor(0); ok(!!t2, 'second inbound truck docked'); if (t2) { T.setDoor(0, true); T.signTruck(t2); const put0 = S.stats.putaway; T.run(150); ok(S.stats.putaway > put0, 'the receiver put pallets away in the shed: ' + (S.stats.putaway - put0) + ' boxes'); } }
  ok(!T.unlocked('power') && !T.unlocked('contracts') && !T.unlocked('rush') && !T.unlocked('loan'), 'no power cuts, contracts, rush orders or loans before the hall');
  const siteDue0 = S.siteDue; climbTo(5); ok(S.level === 5 && S.siteDue === 1 && S.site === 0 && siteDue0 === 0, 'level 5 books the builders: the small hall is due, the shed stands until morning');
  T.updateHud(1); ok(/builders come in the morning/.test(document.getElementById('h-next').textContent), 'the HUD says the builders are booked: ' + document.getElementById('h-next').textContent);
  ok(T.unlocked('pc') && T.unlocked('build') && T.unlocked('contracts') && T.unlocked('power') && T.scanPageOpen(5) && T.scanPageOpen(8), 'level 5 opens the PC, build mode, contracts, power cuts, the Docks page and the map');
  ok(!T.stageHas('rooms') && !T.propInst.desk, 'but the shed has no office yet: the walls move at the day roll');
  T.scanToggle(true); T.scanPage(0); T.drawScanner(); ok(T.scanRows().some((r) => /builders are booked/.test(r.text)), 'the scanner Home page shows the builders alert'); T.scanToggle(false);
  // sleep: the builders come in (the page would reload; the runner does that)
  T.setTime(19); const d0 = S.day; T.sleepNow(); ok(S.day === d0 + 1 && S.site === 1 && S.siteDue === 1 && T.ui.rebuildPending === true, 'slept: the day rolled, the stage is 1 and the rebuild is pending for the reload');
  const raw = JSON.parse(localStorage.getItem('depotco-slot1')); ok(raw && raw.site === 1 && raw.level === 5 && raw.up.rows === 2, 'the save says stage 1 with two rows for the small hall');
`;
