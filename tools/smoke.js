// The smoke test: `npm test`. Boots the real game (game/index.html) in a hidden Electron window and
// plays one day through the test handle: a truck docks, pallets are unloaded by hand and by jack,
// stock goes on the racks, an order is picked, packed, loaded and dispatched, staff work a shift,
// the forklift stores a pallet on the shelf level, and the save survives a reload. Any page error fails it.
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';   // the dev-mode CSP notice is not a game error
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'depotco-test-')));   // never the player's saves
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
if (process.env.CI) app.disableHardwareAcceleration();

const SCENARIO = `(async () => {
  const out = [], errs = [];
  const ok = (cond, msg) => { out.push((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) errs.push(msg); };
  const T = window.DEPOT.T, S = T.S;
  window.DEPOT.enter();
  ok(S.day === 1 && S.bank === 600, 'fresh save: day 1, $600');
  // the first truck
  T.setTime(7.2); T.run(30);
  const tin = T.truckAtDoor(0);
  ok(!!tin, 'inbound truck docked at IN 1');
  ok(tin && tin.pallets.length >= 2, 'truck carries pallets: ' + (tin && tin.pallets.length));
  S.flags.noEvents = 1;   // no random power cuts: the long automation runs need the mains
  T.setDoor(0, true); T.run(0.5); ok(!T.doorPassable(0), 'door panel still rising after half a second'); ok(T.floorY(-30.2, -14) === 0, 'the dock leveller bridges the slot between the floor edge and the bed'); ok(T.doorPanelScale(0) < 0.99, 'and the panel mesh has started to rise'); T.run(2.5); ok(T.doorPassable(0), 'door panel up after three seconds');
  ok(S.doors[0] === true, 'door IN 1 open');
  ok(/Sign the delivery note/.test(T.palletPrompt({ kind: 'pallet', id: tin.pallets[0] })), 'pallets wait for the signature: ' + T.palletPrompt({ kind: 'pallet', id: tin.pallets[0] }));
  T.signTruck(tin); ok(tin.signed === true, 'delivery note signed');
  const p0 = T.palletById(tin.pallets[0]);
  ok(T.palletPrompt({ kind: 'pallet', id: p0.id }) !== null, 'pallet on the truck has a prompt: ' + T.palletPrompt({ kind: 'pallet', id: p0.id }));
  const bank0 = S.bank;
  T.palletUse({ kind: 'pallet', id: p0.id });
  ok(S.hand && S.hand.kind === 'box' && S.hand.sku === p0.sku, 'took a box by hand');
  ok(S.bank === bank0 + 12, 'receiving fee paid once the pallet is touched');
  const k00 = T.slotKey(0, 0, 0);
  T.slotUse(k00);
  ok(!S.hand && S.slots[k00] && S.slots[k00].n === 1, 'box stored in A1 floor');
  // the jack
  T.grabTool('jack'); ok(T.player.tool === 'jack', 'grabbed the jack');
  T.palletUse({ kind: 'pallet', id: p0.id }); ok(S.jack.pallet === p0.id, 'jack lifted the pallet');
  const k01 = T.slotKey(0, 1, 0); const n = p0.n;
  T.slotUse(k01); ok(!S.jack.pallet && S.slots[k01] && S.slots[k01].n === n, 'jack stored the pallet in A2: ' + n + ' boxes');
  T.releaseTool(); ok(T.player.tool === null, 'released the jack');
  // the rest of the load, straight to the racks
  S.pallets.filter((p) => p.place === 'truck').forEach((p) => { const k = T.findSlotFor(p.sku, p.n, 1); ok(!!k, 'slot found for ' + p.sku); if (k) { T.palletUse({ kind: 'pallet', id: p.id }); T.handSet(null); const pl = T.palletById(p.id); if (pl) { pl.place = 'floor'; T.storePallet(pl, k); } } });
  T.run(30);
  ok(!T.truckAtDoor(0), 'emptied truck left the dock');
  ok(T.totalStock() > 0, 'stock on the racks: ' + T.totalStock());
  // an order, picked and packed the real way
  T.setTime(9); const o = T.genOrder(false); ok(!!o, 'order generated #' + (o && o.num));
  o.lines.forEach((l) => { while (T.stockCount(l.sku) < l.qty) { const k = T.findSlotFor(l.sku, 1, 1); S.slots[k] = S.slots[k] && S.slots[k].n ? S.slots[k] : { sku: l.sku, n: 0 }; S.slots[k].n += 1; } });
  const firstLine = o.lines[0]; const srcKey = Object.keys(S.slots).find((k) => S.slots[k].sku === firstLine.sku && S.slots[k].n > 0);
  T.player.x = 25.5; T.player.z = 5.2;
  T.slotUse(srcKey); ok(S.hand && S.hand.sku === firstLine.sku, 'picked one box for the order');
  T.benchUse(); ok(!S.hand && S.bench.boxes[firstLine.sku] === 1, 'box on the bench');
  o.lines.forEach((l, i) => { const need = l.qty - (i === 0 ? 1 : 0); for (let q = 0; q < need; q++) { const k = Object.keys(S.slots).find((kk) => S.slots[kk].sku === l.sku && S.slots[kk].n > 0); S.slots[k].n--; if (!S.slots[k].n) delete S.slots[k]; T.benchAdd(l.sku, 1); } });
  ok(T.canPack(o), 'order packable from the bench');
  ok(T.packOrder(o) && o.state === 'packing', 'order released to the pack line'); T.run(30); if (S.pack.jam) { T.packUse(); T.run(15); } ok(o.state === 'packed' && S.bench.parcels[0] === o.id, 'pack line made the parcel: on the shelf ' + JSON.stringify({ st: o.state, pack: S.pack, pi: T.beltItems('packIn').length, po: T.beltItems('packOut').length, inst: !!T.propInst.packline, sink: T.beltSink(T.BELTS.packIn) ? (T.beltSink(T.BELTS.packIn).machine || T.beltSink(T.BELTS.packIn).belt).id : null, power: S.events.power }));
  // ship it
  T.setTime(10.3); T.run(30);
  const tout = T.truckAtDoor(2); ok(!!tout, 'outbound truck docked at OUT 1');
  T.setDoor(2, true);
  T.shelfUse({ kind: 'shelf', order: o.id }); ok(S.hand && S.hand.kind === 'parcel', 'parcel in hand');
  T.loadUse(tout.id); ok(!S.hand && tout.parcels.length === 1 && o.state === 'loaded', 'parcel loaded');
  ok(/Dispatch/.test(T.consolePrompt(2)), 'console offers dispatch: ' + T.consolePrompt(2));
  const bank1 = S.bank; T.consoleUse(2);
  ok(tout.state === 'leaving', 'truck leaving');
  ok(S.bank > bank1 && S.shipped[0] && S.shipped[0].num === o.num, 'paid ' + (S.bank - bank1) + ' for order #' + o.num);
  T.run(15); ok(!S.trucks.some((t) => t.id === tout.id), 'outbound truck gone');
  // the office PC and the shop
  T.openPanel('pc', 'shop'); ok(/Picking cart/.test(T.panelHtml()), 'shop renders'); T.closePanel();
  S.bank += 5000; S.level = 3; T.buyUpgrade('cart'); ok(S.up.cart === true, 'bought the cart');
  T.buyUpgrade('fork'); ok(S.up.fork === true, 'bought the forklift');
  T.buyUpgrade('row3'); ok(S.up.rows === 3, 'bought the third row');
  // staff: a second truck, the receiver puts it away, the picker feeds the bench
  T.hireStaff('receiver'); T.hireStaff('picker'); ok(S.staff.length === 2, 'two staff hired');
  S.staff.forEach((st) => { st.arriveOff = 0; st.sick = false; st.dayOff = false; }); T.setTime(12.9); T.run(60);
  ok(S.staff.every((st) => st.clocked), 'both clocked in at the reader: ' + S.staff.map((st) => T.staffStatus(st)).join(' / '));
  T.setTime(13.3); T.run(30); const t2 = T.truckAtDoor(0); ok(!!t2, 'second inbound truck docked');
  T.setDoor(0, true); T.signTruck(t2);
  const putaway0 = S.stats.putaway; T.run(150);
  ok(S.staff[0].hoursToday > 0.5, 'hours accrue on the clock: ' + S.staff[0].hoursToday.toFixed(2));
  T.myClock(true); ok(S.clockedIn === true, 'you clocked in'); T.myClock(false); ok(S.clockedIn === false && S.stats.hoursWorked >= 0, 'you clocked out with a shift report');
  ok(S.stats.putaway > putaway0, 'receiver put pallets away: ' + (S.stats.putaway - putaway0) + ' boxes');
  const o2 = T.genOrder(false); ok(!!o2, 'second order #' + (o2 && o2.num));
  o2.lines.forEach((l) => { while (T.stockCount(l.sku) < l.qty) { const k = T.findSlotFor(l.sku, 1, 1); S.slots[k] = S.slots[k] && S.slots[k].n ? S.slots[k] : { sku: l.sku, n: 0 }; S.slots[k].n += 1; } });
  T.run(120); ok(Object.keys(S.bench.boxes).length > 0, 'picker brought boxes to the bench: ' + JSON.stringify(S.bench.boxes));
  // the forklift: lift a floor pallet and store it on the shelf level
  const fp = T.newPallet('paint', 8, { place: 'floor', x: 3.5, y: 0, z: 19.5, rot: 0 });
  S.fork.x = 2; S.fork.z = 19.5; S.fork.yaw = Math.PI / 2; S.fork.lift = 0.1;
  T.startDrive(); ok(T.ui && window.DEPOT.T.player, 'driving the forklift'); T.forkGearCycle(); T.forkGearCycle(); ok(S.fork.gear === 3, 'Shift cycled to gear 3'); T.forkGearCycle(); ok(S.fork.gear === 1, 'and back round to gear 1');
  T.forkUse(); ok(S.fork.pallet === fp.id, 'forks lifted the pallet');
  // nose up to the wrapper with the load, then back out: the obstacle you are already inside must not trap you
  const WP = T.propInst.wrapper.P; S.fork.x = WP.x; S.fork.z = WP.z + 1.6; S.fork.yaw = Math.PI; T.player.x = WP.x; T.player.z = WP.z + 2.8; T.startDrive(); T.player.keys.KeyS = true; T.run(1.5); T.player.keys.KeyS = false; T.stopDrive(); ok(S.fork.z > WP.z + 2.2, 'forklift backed out of the wrapper apron: z ' + S.fork.z.toFixed(2) + ' from ' + (WP.z + 1.6).toFixed(2));
  S.fork.x = -21; S.fork.z = -10.6; S.fork.yaw = 0; S.fork.lift = 1.55;
  const k10 = T.slotKey(1, 0, 1); delete S.slots[k10];
  T.forkUse(); ok(!S.fork.pallet && S.slots[k10] && S.slots[k10].n === 8, 'pallet stored on B1 shelf by forklift');
  T.stopDrive(); ok(!S.fork.pallet, 'got off the forklift');
  S.fork.x = 0; S.fork.z = 20.5; S.fork.batt = 0.4; T.player.x = 0; T.player.z = 22; T.cableUse('fork'); ok(T.player.tool === 'cable', 'took the charging cable'); T.cablePlugInto('fork'); ok(S.fork.plugged === true && T.player.tool === null, 'forklift plugged in'); const bt0 = S.fork.batt; T.run(20); ok(S.fork.batt > bt0, 'charging while plugged: ' + S.fork.batt.toFixed(2)); T.startDrive(); ok(S.fork.plugged === false, 'driving off pulled the plug'); T.stopDrive();
  // contracts, the bank, damaged goods
  S.level = 3; S.contract = null; S.nextOffer = S.day; T.setTime(9.05); T.run(2); ok(!!S.contract && !S.contract.accepted, 'contract offered');
  S.contract.accepted = true; S.contract.need = 1; const co = T.genOrder(false); co.client = S.contract.client; co.lines = [{ sku: 'bolts', qty: 1 }]; T.benchAdd('bolts', 1); T.packOrder(co); T.run(30); if (S.pack.jam) { T.packUse(); T.run(15); } ok(co.state === 'packed', 'contract order packed by the line');
  delete S.flags['out' + S.day + '-0']; S.trucks.filter((t) => t.dir === 'out').forEach((t) => { T.truckLeave(t, 'test'); }); T.run(20); T.setTime(10.4); T.run(30); const tc = T.truckAtDoor(2); ok(!!tc, 'outbound truck for the contract test'); T.setDoor(2, true); T.shelfUse({ kind: 'shelf', order: co.id }); T.loadUse(tc.id); T.consoleUse(2); ok(S.contract.done === 1, 'contract counts the on-time ship');
  const bank2 = S.bank; S.contract.until = T.S.day * 24 + T.S.time - 1; T.run(16); ok(S.contract === null && S.bank > bank2, 'contract paid out');
  S.staff.forEach((st) => { st.hoursToday = 8; }); S.loan = 5000; const b3 = S.bank; T.setTime(23.9); T.run(16); ok(S.day >= 2 && S.bank < b3 - 5000 * 0.015 + 1, 'loan interest charged at the day roll');
  ok(S.staff[0].sheet && S.staff[0].sheet[0] && S.staff[0].sheet[0].h === 8 && S.staff[0].sheet[0].pay === Math.round(T.hourly(S.staff[0]) * 8), 'wages paid from the timesheet: ' + JSON.stringify(S.staff[0].sheet[0]));
  S.level = 3; T.editToggle(); const rackP = T.propInst.rack0; ok(!!rackP, 'rack row A is a prop'); const sp = T.slotKey(0, 0, 0); if (!S.slots[sp] || !S.slots[sp].n) S.slots[sp] = { sku: 'bolts', n: 2 }; T.editGrab('rack0'); rackP.g.position.set(0.5, 0, -15); T.editDrop(false); ok(Math.abs(T.propInst.rack0.P.x - 0.5) < 0.01 && S.slots[sp] && S.slots[sp].n > 0, 'rack moved with its stock'); T.editReset('rack0'); T.editToggle();
  // the production wing: a pallet of granulate on the jack tips into the hopper, the moulder fills the belt, the palletiser drops a pallet
  ok(T.inWing(-4, -36) && !T.inWing(-4, -20) && T.floorY(-4, -36) === 0, 'the wing is inside');
  ok(T.beltSink(T.BELTS.moulderOut) && T.beltSink(T.BELTS.moulderOut).belt && T.beltSink(T.BELTS.moulderOut).belt.id === 'beltMain' && T.beltSink(T.BELTS.beltMain) && T.beltSink(T.BELTS.beltMain).machine && T.beltSink(T.BELTS.beltMain).machine.id === 'palletiser', 'moulder belt joins the main belt which ends at the palletiser');
  const rawP = T.newPallet('raw', 8, { place: 'jack' }); S.jack.pallet = rawP.id; T.player.tool = 'jack'; T.hopperUse(); ok(S.factory.raw === 40 && !S.jack.pallet, 'granulate tipped into the hopper: 40 units'); T.releaseTool();
  S.factory.product = 'dcbin'; T.moulderUse(); ok(S.factory.on, 'moulding line started'); T.run(20); ok(S.factory.made >= 1 && (T.beltItems('moulderOut').length + T.beltItems('beltMain').length) >= 1, 'a box came off the moulder onto the belt');
  T.run(140); if (S.factory.jam) { T.moulderUse(); T.run(80); } ok(S.pallets.some((p) => p.sku === 'dcbin' && p.place === 'floor' && p.n === 8), 'palletiser dropped a pallet of eight own-brand boxes: made ' + S.factory.made + ', hopper ' + S.factory.raw);
  S.factory.on = false;
  const WPP = T.propInst.wrapper.P, wpal = T.newPallet('paint', 4, { place: 'floor', x: WPP.x, z: WPP.z, y: 0, rot: 0 }); T.player.tool = null; T.player.x = WPP.x; T.player.z = WPP.z + 2.2; S.wrap.film = 5; T.wrapperUse(); T.run(6); ok(wpal.wrapped, 'a pallet set on the turntable gets wrapped');
  const sdP = T.newPallet('cereal', 3, { place: 'jack' }); S.jack.pallet = sdP.id; T.player.tool = 'jack'; T.player.x = -5; T.player.z = 0; T.lookAt(-5, 1.6, 20); T.useFocus(); ok(!S.jack.pallet && sdP.place === 'floor' && Math.abs(sdP.x - (-5)) < 2.5, 'E on open floor sets the jack pallet down'); T.releaseTool();
  // an emptied pallet stays empty; the jack takes it to the empties stack; a slot emptied of its pallet's boxes keeps the empty pallet
  const emP = T.newPallet('soap', 1, { place: 'floor', x: -8, z: -8, y: 0, rot: 0 }); T.player.tool = null; T.handSet(null); T.player.x = -8; T.player.z = -6.5; T.palletUse({ kind: 'pallet', id: emP.id }); ok(T.palletById(emP.id) && emP.n === 0 && !!S.hand, 'the last box off a pallet leaves an empty pallet'); T.handSet(null);
  T.player.tool = 'jack'; T.palletUse({ kind: 'pallet', id: emP.id }); ok(S.jack.pallet === emP.id, 'the jack lifts the empty pallet'); const EP = T.propInst.empties.P; T.player.x = EP.x + 2.0; T.player.z = EP.z; T.lookAt(EP.x, 0.8, EP.z); T.useFocus(); ok(!S.jack.pallet && !T.palletById(emP.id) && S.emptiesN === 1, 'the empties stack took it');
  const ek = T.slotKey(0, 3, 0); const sp2 = T.newPallet('toys', 1, { place: 'jack' }); S.jack.pallet = sp2.id; ok(T.storePallet(sp2, ek) && S.slots[ek].pal, 'a stored pallet marks its slot'); S.jack.pallet = null; T.player.tool = null; T.slotUse(ek); T.handSet(null); ok(S.slots[ek] && S.slots[ek].n === 0 && S.slots[ek].pal, 'the slot keeps the empty pallet after the last box'); T.player.tool = 'jack'; T.slotUse(ek); ok(!S.slots[ek] && S.jack.pallet && T.palletById(S.jack.pallet).n === 0, 'the jack pulls the empty pallet out of the slot'); T.releaseTool();
  // automation: the shipping belt feeds the dock loader, the AGV puts a pallet away
  S.up.shipbelt = true; T.buildProp('shipBelt'); T.buildProp('dockLoader2'); S.up.agv = true; T.buildProp('agvDock'); S.events.power = false;
  ok(T.beltSink(T.BELTS.shipBelt) && T.beltSink(T.BELTS.shipBelt).machine && T.beltSink(T.BELTS.shipBelt).machine.id === 'dockLoader2', 'the shipping belt ends at the OUT 2 dock loader');
  S.trucks.filter((t) => t.dir === 'out').forEach((t) => T.truckLeave(t, 'test')); T.run(20); const dl = T.spawnTruck('out', 1, 18); dl.x = 30.4; T.run(3); ok(dl.state === 'docked' && T.truckAtDoor(3) === dl, 'an outbound truck is at OUT 2 for the loader'); T.setDoor(3, true); T.run(4);
  const ao = T.genOrder(false); ao.lines = [{ sku: 'bolts', qty: 1 }]; T.benchAdd('bolts', 1); T.packOrder(ao); T.run(40); if (S.pack.jam) { T.packUse(); T.run(20); } T.run(90); ok(ao.state === 'loaded' || ao.state === 'shipped', 'the parcel rode the belt and the dock loader put it on the truck: ' + ao.state);
  const agvP = T.newPallet('cereal', 4, { place: 'floor', x: -24, z: -2.9, y: 0, rot: 0 }); const put0 = S.stats.agvPutaway || 0; T.run(90); ok((S.stats.agvPutaway || 0) === put0 + 1 && !T.palletById(agvP.id), 'the AGV put the pallet away: state ' + T.agvState().state);
  // the gantry picks a box the bench needs out of row A and the pick belt lands it on the bench
  S.up.gantry = true; T.buildProp('gantry'); T.buildProp('pickBelt'); ok(T.beltSink(T.BELTS.pickBelt) && T.beltSink(T.BELTS.pickBelt).machine && T.beltSink(T.BELTS.pickBelt).machine.id === 'benchIn', 'the pick belt ends at the bench');
  const gk = T.slotKey(0, 2, 0); S.slots[gk] = { sku: 'soap', n: 3, pal: true }; S.bench.boxes = {}; const go2 = T.genOrder(false); go2.lines = [{ sku: 'soap', qty: 1 }]; S.orders = S.orders.filter((o) => o === go2 || o.state !== 'open'); T.beltItems('pickBelt').length = 0; S.gantry.state = 'idle'; S.gantry.sku = null; const b0g = S.bench.boxes.soap || 0; T.run(110); ok((S.bench.boxes.soap || 0) >= b0g + 1 && S.slots[gk].n === 2, 'the gantry picked a soap box out of A3 and the belt put it on the bench: gantry ' + JSON.stringify({ st: T.S.gantry.state, x: +T.S.gantry.x.toFixed(2), lift: +T.S.gantry.lift.toFixed(2), sku: T.S.gantry.sku, belt: T.beltItems('pickBelt').length, slot: S.slots[gk] && S.slots[gk].n }));
  // film follows a wrapped pallet onto the rack and comes back with it; the forklift lifts an empty pallet out of a slot
  const wk = T.slotKey(0, 5, 0); delete S.slots[wk]; const wrP = T.newPallet('toys', 2, { place: 'floor', x: 0, z: 0, y: 0, rot: 0, wrapped: true }); ok(T.storePallet(wrP, wk) && S.slots[wk].wrapped, 'a wrapped pallet keeps its film on the rack'); S.fork.x = 0; S.fork.z = 0;
  S.slots[wk].n = 0; S.fork.lift = 0.1; S.fork.pallet = null; const sp0 = T.rackSlotPos ? null : null; T.player.x = -8; T.player.z = -16.6; S.fork.x = -6; S.fork.z = -16.6; S.fork.yaw = 0; T.startDrive(); T.forkUse(); T.stopDrive(); ok(S.fork.pallet && T.palletById(S.fork.pallet).n === 0 && !S.slots[wk], 'the forklift lifts the empty pallet out of a slot'); S.fork.pallet = null;
  const cardB = S.baler.card; T.addWaste(10); T.balerUse(); ok(S.baler.t > 0 && S.baler.card === cardB, 'baler started on ten cardboard (offcuts already in the chamber: ' + cardB + ')'); T.run(9); ok(S.baler.bales === 1, 'a bale came out');
  S.hand = { kind: 'box', sku: 'paint', damaged: true }; T.handSet(S.hand); T.player.x = 25; T.player.z = 2.6; const binned0 = S.binned || 0; T.lookAt(24.3, 0.45, 2.6); T.useFocus(); ok((S.binned || 0) === binned0 + 1 && !S.hand, 'damaged box binned');
  // the office PC: sit down, the screen draws, stand up
  T.openPc(); ok(T.pc.on === true, 'sat down at the PC'); T.run(1); ok(T.pc.screen && T.pc.screen.zones.length > 5, 'the PC screen has ' + (T.pc.screen ? T.pc.screen.zones.length : 0) + ' buttons'); T.closePc(); ok(T.pc.on === false, 'stood up from the PC');
  // build mode: grab the cot, move it, turn it, put it back, remove and restore, buy a chair
  T.player.x = -26; T.player.z = -21.5; T.player.y = 0; T.editToggle(); ok(T.edit.on === true, 'build mode on');
  const cot0 = { x: T.propInst.cot.P.x, z: T.propInst.cot.P.z };
  T.editGrab('cot'); ok(T.edit.grabbed === 'cot', 'grabbed the cot');
  T.propInst.cot.g.position.set(-16, 0, -11); T.editDrop(false); ok(S.layout.cot && Math.abs(S.layout.cot.x + 16) < 0.01, 'cot placed and saved: ' + JSON.stringify(S.layout.cot));
  T.editReset('cot'); ok(!S.layout.cot && Math.abs(T.propInst.cot.P.x - cot0.x) < 0.01, 'cot put back');
  T.propInst.cot.g; T.edit.grabbed = null; S.layout.cot = { hidden: true }; T.buildProp('cot'); ok(T.propInst.cot.g.children.length === 0, 'removed cot builds nothing');
  T.editRestore('cot'); ok(T.propInst.cot.g.children.length > 0, 'cot restored');
  const bank4 = S.bank; T.editBuy('xChair'); ok(S.custom.length === 1 && S.bank === bank4 - 25 && T.edit.grabbed === S.custom[0].id, 'bought a chair and carrying it');
  T.editDrop(false); ok(T.propInst[S.custom[0].id] && !T.edit.grabbed, 'chair placed'); T.edit.grabbed = null;
  T.editToggle(); ok(T.edit.on === false, 'build mode off, layout saved');
  // events
  T.flipBreaker(); S.events.power = true; T.flipBreaker(); ok(S.events.power === false, 'breaker resets a power cut');
  T.setDoor(1, true); S.events.prowled = false; const stock0 = T.totalStock(); T.setTime(22.9); T.run(10); ok(T.totalStock() < stock0, 'prowler took stock through the open door');
  T.setDoor(1, false); T.setDoor(0, false); T.setDoor(2, false);
  // a full day on the clock, then sleep
  T.run(620); ok(S.day >= 2, 'the clock rolled to day ' + S.day);
  T.setTime(19); const day0 = S.day; T.sleepNow(); ok(S.day === day0 + 1 && S.time === 6, 'slept to day ' + S.day);
  T.save(); const raw = JSON.parse(localStorage.getItem('depotco-slot1')); ok(raw && raw.day === S.day && raw.up.fork === true, 'save written');
  const c = T.counts(); out.push('info draws=' + c.draws + ' inter=' + c.inter + ' dyn=' + c.dyn);
  return { out, errs };
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 720, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true } });
  const pageErrors = [];
  win.webContents.on('console-message', (e, level, msg, line, src) => { if (level >= 2 && !/Electron Security Warning/.test(msg)) pageErrors.push(msg + ' @ ' + String(src).split('/').pop() + ':' + line); });
  win.webContents.on('render-process-gone', (e, d) => { pageErrors.push('renderer gone: ' + d.reason); });
  await win.loadFile(path.join(__dirname, '..', 'game', 'index.html'));
  await new Promise((r) => setTimeout(r, 1500));
  let result;
  try { result = await Promise.race([win.webContents.executeJavaScript(SCENARIO, true), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 180000))]); }
  catch (e) { result = { out: [], errs: ['scenario threw: ' + (e && e.message || e)] }; }
  result.out.forEach((l) => console.log('  ' + l));
  result.errs.filter((e) => /^scenario threw/.test(e)).forEach((l) => console.log('  ' + l));
  pageErrors.forEach((l) => console.log('  PAGE ' + l));
  const failed = result.errs.length + pageErrors.length;
  console.log(failed ? 'smoke: FAILED (' + failed + ')' : 'smoke: all ' + result.out.filter((l) => /^ok/.test(l)).length + ' checks passed');
  app.exit(failed ? 1 : 0);
});
