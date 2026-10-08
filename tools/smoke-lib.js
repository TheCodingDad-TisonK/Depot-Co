// Shared head of every smoke scenario (tools/smoke-*.js). Each scenario file exports one template literal; the runner wraps it in
// this prologue, so every scenario has the same helpers: ok(), mkOrder(), quietDocks(), the T handle and the live S.
// One rule for the scenario text: no \' inside the literal. A check message that needs an apostrophe is reworded. The literal is
// evaluated by executeJavaScript at runtime, where \' breaks it, while node --check on this file passes.
'use strict';
exports.PROLOGUE = `
  const T = window.DEPOT.T; T.ui.testing = true;
  // S is the live state, whatever object the game holds now: T.load() replaces the game's state object, and a scenario that kept the
  // old one would read a dead copy from then on (the climb after the save round-trip never ended). Every read and write goes through T.S.
  const S = new Proxy({}, { get: (_, k) => T.S[k], set: (_, k, v) => { T.S[k] = v; return true; }, has: (_, k) => k in T.S, deleteProperty: (_, k) => { delete T.S[k]; return true; }, ownKeys: () => Reflect.ownKeys(T.S), getOwnPropertyDescriptor: (_, k) => { const d = Object.getOwnPropertyDescriptor(T.S, k); if (d) d.configurable = true; return d; } });
  const out = [], errs = []; window.__smoke = { out, errs };   // the runner reads this on a timeout to see how far the scenario got
  const ok = (cond, msg) => { out.push((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) errs.push(msg); };
  const info = (msg) => { out.push('info ' + msg); };
  const _run = T.run; T.run = (sec) => { const t0 = Date.now(); _run(sec); const ms = Date.now() - t0; if (ms > 60000) throw new Error('T.run(' + sec + ') took ' + ms + ' ms: the world is too slow here'); };   // a run that takes a minute real time is a hang in all but name
  // an order with its own stock when the free stock is spoken for: a slot of the first owned row is filled for it
  let mkN = 0; const mkOrder = () => { let o = T.genOrder(false); if (!o) { S.orders = S.orders.filter((x) => x.state !== 'open'); const sk = ['cereal', 'lamps', 'bolts', 'paint'][mkN % 4], bays = T.rowBays(0); S.slots[T.slotKey(0, (bays - 1 - (mkN % Math.max(1, bays - 1))), 0)] = { sku: sk, n: 12, pal: true }; mkN++; o = T.genOrder(false); } if (!o) throw new Error('mkOrder: no order even with fresh stock'); return o; };
  // no scheduled outbound truck docks while a test has its own truck at a door
  const quietDocks = () => { [0, 1, 2].forEach((d) => [0, 1].forEach((w) => { S.flags['out' + S.day + '-' + d + '-' + w] = 1; })); };
  const clearOut = () => { S.trucks.filter((t) => t.dir === 'out').forEach((t) => { if (t.state === 'docked') T.truckLeave(t, 'test'); else if (t.state === 'coming') { t.state = 'leaving'; t.x = t.side * 104; } }); T.run(20); };   // a truck still on its way is sent back too
  // a packed parcel into the hand, wherever the deck or the belts have carried it meanwhile
  const grabParcel = (oid) => { S.bench.parcels = S.bench.parcels.filter((id) => id !== oid); for (const k in (S.belts || {})) S.belts[k] = S.belts[k].filter((it) => it.order !== oid); for (const k in (S.stage || {})) S.stage[k] = S.stage[k].filter((id) => id !== oid); if (S.sort) { for (const ck in (S.sort.cells || {})) S.sort.cells[ck].q = S.sort.cells[ck].q.filter((j) => j.order !== oid); S.sort.table = (S.sort.table || []).filter((it) => it.order !== oid); } S.floor = S.floor.filter((f) => f.order !== oid); T.handSet({ kind: 'parcel', order: oid }); };
  // the crew out of a test and back: everyone home for the duration
  const crewOff = () => { const keep = S.staff.map((st) => [st, st.dayOff, st.state, st.clocked]); S.staff.forEach((st) => { st.task = null; st.carry = null; st.state = 'home'; st.clocked = false; st.dayOff = true; }); return () => { keep.forEach((k) => { k[0].dayOff = k[1]; }); }; };
  // the level, driven the way a game drives it: through addXp and onLevelUp, one level at a time
  const climbTo = (lv) => { S.flags.noLevelCard = 1; while (S.level < lv) { T.addXp(T.XP_FOR(S.level) - S.xp); } delete S.flags.noLevelCard; };
`;
exports.EPILOGUE = `
  const c = T.counts(); out.push('info draws=' + c.draws + ' inter=' + c.inter + ' dyn=' + c.dyn + ' level=' + S.level + ' site=' + S.site + '/' + S.siteDue + ' day=' + S.day + ' bank=' + S.bank);
  } catch (e) { errs.push('scenario threw: ' + (e && e.stack || e)); }
  return { out, errs, pending: !!T.ui.rebuildPending, save: localStorage.getItem('depotco-slot' + window.DEPOT.bootSlot) };
})()`;
exports.wrap = (body) => '(async () => {\n' + exports.PROLOGUE + '\n  try {\n' + body + '\n' + exports.EPILOGUE;
