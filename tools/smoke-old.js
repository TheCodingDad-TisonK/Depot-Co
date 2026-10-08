// Scenario G: a save from before the stages (1.20 or earlier: no site field, the 72 m hall, whatever it owned). Seeded by the
// runner into slot 1. It must come back in the big hall at least, the annexes if it owned a hall, with its stock and its crew.
'use strict';
module.exports = `
  window.DEPOT.enter();
  ok(T.BOOT_STAGE === 4 && S.site === 4 && S.siteDue === 4 && S.level === 9 && S.bank === 4000, 'a 1.20 save that owned the returns hall boots in the annexes at its own level and bank');
  ok(S.up.hall2 && S.up.hall3 === true && S.up.upper && S.up.sorter && S.up.rows === 4 && S.up.cart && S.up.fork, 'it keeps what it owned and gets what the stage brings (Hall 3) for nothing');
  ok(!!T.propInst.hall2 && !!T.propInst.hall3 && !!T.propInst.mezz && !!T.propInst.rack3 && !T.propInst.rack4 && T.HALL.x === 36, 'the halls, the deck and its four rows stand in the 72 m hall');
  ok(S.slots['0,3,0'] && S.slots['0,3,0'].sku === 'paint' && S.slots['0,3,0'].n === 7 && S.staff.length === 1 && S.staff[0].name === 'Jo', 'its stock and its crew came through');
  ok(T.stageForOwned({}) === 3 && T.stageForOwned({ hall2: true }) === 4 && T.stageForOwned({ hall3: true }) === 4 && T.stageForOwned({ hall4: true }) === 5, 'the rule: the big hall at least, the annexes with a hall, the far end with Hall 4');
  ok(S.intro && S.intro.done === true, 'a finished intro stays finished');
  ok(T.unlocked('returns') && !T.unlocked('raw') && T.pcApps().some((a) => a[0] === 'bank') && !T.pcApps().some((a) => a[0] === 'factory'), 'the ladder applies to it: returns and the bank at level 9, the Production app at 10');
  ok(!!T.propInst.returnsDesk === false && T.returnsHall(), 'the returns hall does the returns, as before');
  const o = mkOrder(); ok(!!o && T.MODES[o.mode], 'orders keep coming');
  S.flags.noLevelCard = 1; T.addXp(T.XP_FOR(S.level) - S.xp); ok(S.level === 10 && S.siteDue === 4, 'a level up on an old save does not shrink the building: stage 2 earned, stage 4 kept');
  T.setTime(19); const d0 = S.day; T.sleepNow(); ok(S.day === d0 + 1 && S.site === 4 && T.ui.rebuildPending === false, 'a night rolls with no rebuild');
`;
