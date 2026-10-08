// Scenario F: the far end (stage 5), loaded from the annexes' save (level 25). Hall 4 stands behind the wing, the ladder is climbed:
// XP freezes, nothing else to earn, every piece of kit either owned or buyable, the shop empty of structure, the ladder data whole.
'use strict';
module.exports = `
  window.DEPOT.enter(); S.flags.noEvents = 1;
  ok(T.BOOT_STAGE === 5 && S.site === 5 && S.level === 25 && S.up.hall4 && !!T.propInst.hall4 && !!T.propInst.rack24 && T.insideHall(0, -54) && !T.collides(6.8, -44.0) && T.collides(2.0, -44.0), 'the far end: Hall 4 behind the wing, inside, its doorway open through the wing wall');
  ok(T.STAGE.name === 'The far end' && T.stageName(5) === 'The far end' && T.STAGE_LAST === 5, 'the last stage is the far end');
  // the cap
  const xp0 = S.xp, lv0 = S.level, b0 = S.bank; T.addXp(500); ok(S.level === 25 && S.xp === xp0 && S.bank === b0, 'XP freezes at the cap: no level 26, no bonus');
  ok(/top of the ladder/.test(T.nextLevelText()) && document.getElementById('h-xp').textContent === 'top', 'the HUD says the top of the ladder: ' + T.nextLevelText());
  // the ladder data is whole
  { const bad = []; for (const k in T.UNLOCK) if (T.UNLOCK[k] < 1 || T.UNLOCK[k] > 25) bad.push(k); ok(!bad.length, 'every unlock sits on the ladder (1 to 25)' + (bad.length ? ': ' + bad.join(' ') : ''));
    const notes = []; for (let l = 2; l <= 25; l++) if (!T.LADDER_NOTES[l]) notes.push(l); ok(!notes.length, 'every level from 2 to 25 has its promise' + (notes.length ? ': missing ' + notes.join(' ') : ''));
    const empty = []; for (let l = 2; l <= 25; l++) if (!T.levelOpens(l).length) empty.push(l); ok(!empty.length, 'no quiet levels: every level opens something' + (empty.length ? ', except ' + empty.join(' ') : ''));
    ok(T.XP_TABLE.length === 26 && T.XP_TABLE.slice(1, 25).every((v, i) => i === 0 || v >= T.XP_TABLE[i]), 'the XP table climbs without a dip: ' + T.XP_TABLE.slice(1, 6).join(' ') + ' ... ' + T.XP_TABLE[24]);
    const total = T.XP_TABLE.slice(1, 25).reduce((a, b) => a + b, 0); ok(total > 60000 && total < 90000, 'the whole ladder is ' + total + ' XP: about thirty hours at the measured pace');
    ok(T.STAGES.length === 6 && T.STAGES.every((s, i) => i === 0 || s.hall.x >= T.STAGES[i - 1].hall.x) && T.stageForLevel(1) === 0 && T.stageForLevel(5) === 1 && T.stageForLevel(10) === 2 && T.stageForLevel(15) === 3 && T.stageForLevel(20) === 4 && T.stageForLevel(25) === 5, 'six stages, each inside the next, one every fifth level'); }
  // the shop sells kit, never structure; everything left is buyable at 25
  { const shown = T.UPGRADES.filter(T.shopShows); ok(shown.every((u) => !u.free && u.lvl <= 25) && !shown.some((u) => /^hall|upper|sorter|dock2/.test(u.id)), 'the shop lists ' + shown.length + ' pieces of kit, no structure');
    S.bank += 100000; shown.forEach((u) => { const rowN = /^row(\\d)$/.test(u.id) ? +u.id.slice(3) : 0; if (rowN ? S.up.rows < rowN : !S.up[u.id]) T.buyUpgrade(u.id); }); shown.forEach((u) => { const rowN = /^row(\\d)$/.test(u.id) ? +u.id.slice(3) : 0; if (rowN ? S.up.rows < rowN : !S.up[u.id]) T.buyUpgrade(u.id); });
    const notOwned = shown.filter((u) => { const rowN = /^row(\\d)$/.test(u.id) ? +u.id.slice(3) : 0; return rowN ? S.up.rows < rowN : !S.up[u.id]; }); ok(!notOwned.length, 'at level 25 everything in the shop can be owned' + (notOwned.length ? ': not ' + notOwned.map((u) => u.id).join(' ') : '')); }
  ok(Object.keys(T.UNLOCK).every((k) => T.unlocked(k)) && T.scanPageOpen(6) && T.pcApps().length === 10 && T.pcTabs().length === 8, 'every system, scanner page, app and tab is open');
  ok(T.staffCapAt(25) === 8 && T.unlockedSkus().length === 15 && T.activeClients().length === 9 && T.contractSlots().length === 2, 'eight heads, fifteen lines, nine clients, two contracts');
  // the catalogue is whole
  { const locked = Object.keys(T.PROPS).filter((id) => T.PROPS[id].extra && typeof T.PROPS[id].lvl === 'number' && T.PROPS[id].lvl > 25); ok(!locked.length, 'every catalogue piece is reachable by 25'); T.editToggle(); ok(T.edit.on, 'build mode opens'); T.editToggle(); }
  // the yard is the full one
  ok(T.STAGE.fence.x === 84 && T.yard.traffic.length === 8 && !!T.propInst.tree0 && !!T.propInst.car0, 'the full yard: the 168 m fence, the road, the trees, the car park');
  // the day rolls and nothing is due any more
  T.setTime(19); const d0 = S.day; T.sleepNow(); ok(S.day === d0 + 1 && S.site === 5 && S.siteDue === 5 && T.ui.rebuildPending === false, 'a night at the far end: no builders booked, nothing more to grow');
  T.save(); const raw = JSON.parse(localStorage.getItem('depotco-slot1')); ok(raw.site === 5 && raw.level === 25, 'the save says stage 5, level 25');
`;
