//@ the day report: what yesterday earned and cost, shown on the HUD at the day roll and kept for a fortnight on the office PC
  // ── The day report ────────────────────────────────────────────────
  // 1.16.0. At every day roll the counters are closed off for the day that ended: money in and out (the morning's rent and
  // wages included), orders shipped and late, pallets received, boxes picked, returns inspected, the reputation change and the
  // bank at the close. A card shows on the HUD for a while (any key dismisses it); the Stats app on the office PC and the pause
  // menu keep the last fourteen days as a table. The first report comes at the second day roll, when there is a day to compare.
  var DAY_KEEP = 14, reportT = 0;
  function daySnapshot() { return { day: S.day, earned: S.stats.earned, spent: S.stats.spent, shipped: S.stats.shipped, late: S.stats.late, received: S.stats.received, picked: S.stats.picked, putaway: S.stats.putaway, returns: S.stats.returns || 0, fines: S.stats.fines, misrouted: S.stats.misrouted || 0, lost: S.stats.lost, rep: S.rep, bank: S.bank }; }
  function closeDay() {   // from newDay, after the morning charges, with S.day already the new day
    var a = S.dayStart;
    if (a) {
      var r = { day: a.day, earned: S.stats.earned - a.earned, spent: S.stats.spent - a.spent, shipped: S.stats.shipped - a.shipped, late: S.stats.late - a.late, received: S.stats.received - a.received, picked: S.stats.picked - a.picked, putaway: S.stats.putaway - a.putaway, returns: (S.stats.returns || 0) - a.returns, fines: S.stats.fines - a.fines, misrouted: (S.stats.misrouted || 0) - a.misrouted, lost: S.stats.lost - a.lost, rep: Math.round((S.rep - a.rep) * 10) / 10, bank: S.bank };
      r.net = r.earned - r.spent; if (!S.days) S.days = []; S.days.unshift(r); if (S.days.length > DAY_KEEP) S.days.pop();
      showDayReport(r);
    }
    S.dayStart = daySnapshot();
  }
  function showDayReport(r) {
    logEvent('Day ' + r.day + ' closed: ' + money(r.earned) + ' in, ' + money(r.spent) + ' out, ' + r.shipped + ' shipped' + (r.late ? ' (' + r.late + ' late)' : '') + ', ' + r.received + ' pallets in', r.net >= 0 ? 'good' : 'bad');
    if (!ui.started) return; var el = $('h-report'); if (!el) return;
    var sign = function (n) { return (n >= 0 ? '+' : '') + n; };
    el.innerHTML = '<div class="rep-head"><b>Day ' + r.day + ' report</b><span class="' + (r.net >= 0 ? 'good' : 'bad') + '">' + (r.net >= 0 ? '+' : '') + money(r.net) + '</span></div>' +
      '<div class="rep-grid">' + [['Earned', money(r.earned)], ['Spent', money(r.spent)], ['Shipped', r.shipped + (r.late ? ' (' + r.late + ' late)' : '')], ['Pallets in', String(r.received)], ['Picked', r.picked + ' boxes'], ['Returns', String(r.returns)], ['Rep', sign(r.rep)], ['Bank', money(r.bank)]].map(function (k) { return '<i>' + k[0] + '</i><em>' + esc(k[1]) + '</em>'; }).join('') + '</div>' +
      '<small>Any key closes · the Stats app keeps a fortnight</small>';
    el.hidden = false; reportT = 20;
  }
  function hideDayReport() { var el = $('h-report'); if (el && !el.hidden) el.hidden = true; reportT = 0; }
  function tickReport(dt) { if (reportT > 0) { reportT -= dt; if (reportT <= 0) hideDayReport(); } }
  // the last fourteen days as a table: the PC's Stats tab and the pause menu
  function reportHtml() {
    var ds = S.days || []; if (!ds.length) return '<p>No day closed yet: the first report comes at the second day roll.</p>';
    return '<table><tr><th>Day</th><th class="r">Earned</th><th class="r">Spent</th><th class="r">Net</th><th class="r">Shipped</th><th class="r">Late</th><th class="r">Pallets</th><th class="r">Returns</th><th class="r">Rep</th><th class="r">Bank</th></tr>' + ds.map(function (r) { return '<tr><td>' + r.day + '</td><td class="r">' + money(r.earned) + '</td><td class="r">' + money(r.spent) + '</td><td class="r" style="color:' + (r.net >= 0 ? 'var(--green)' : 'var(--red)') + '">' + money(r.net) + '</td><td class="r">' + r.shipped + '</td><td class="r">' + r.late + '</td><td class="r">' + r.received + '</td><td class="r">' + (r.returns || 0) + '</td><td class="r">' + (r.rep >= 0 ? '+' : '') + r.rep + '</td><td class="r">' + money(r.bank) + '</td></tr>'; }).join('') + '</table>';
  }
  function reportRows() { return (S.days || []).slice(0, 7).map(function (r) { return { text: 'Day ' + r.day + '  ·  ' + r.shipped + ' shipped' + (r.late ? ' (' + r.late + ' late)' : '') + ' · ' + r.received + ' pallets in' + (r.returns ? ' · ' + r.returns + ' returns' : ''), sub: money(r.earned) + ' in, ' + money(r.spent) + ' out · rep ' + (r.rep >= 0 ? '+' : '') + r.rep + ' · bank ' + money(r.bank), right: (r.net >= 0 ? '+' : '') + money(r.net), rcol: r.net >= 0 ? '#5fd38d' : '#ff6b5e' }; }); }
