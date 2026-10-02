// Splash screen and main menu. The page sets window.DEPOT_MENU = { slots: 3 }.
// The game boots underneath as usual; this layer decides when to press its "Clock in" button.
(function () {
  'use strict';
  var CFG = window.DEPOT_MENU || {};
  var SLOTS = typeof CFG.slots === 'number' ? CFG.slots : 3;
  function $(id) { return document.getElementById(id); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(n) { return '$' + Math.round(n || 0).toLocaleString('en-US'); }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function active() { var n = +(ls('depotco-slot') || 1); return n >= 1 && n <= SLOTS ? n : 1; }
  function readSlot(n) { try { var raw = ls('depotco-slot' + n); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

  var NOTE = '<div class="dc-disclaimer"><b>NOT a Farming Simulator product.</b> This game has nothing to do with Farming Simulator, GIANTS Software, or any Farming Simulator mod. It is a separate, standalone hobby project that exists only because its author enjoyed making it.</div>';
  var splash = $('dc-splash');
  var menu = el('<div class="dc-front" id="dc-mainmenu" hidden><div class="dc-menu-card"><div class="dc-menu-head"><img src="logo-256.png" alt="Depot Co."><div><h1>Depot <span style="color:#f5b53d">Co.</span></h1><div class="dc-menu-sub">First-person warehouse simulator</div></div></div>' + NOTE + '<div id="dc-menu-main"></div><div class="dc-menu-foot">A game by TheCodingDad' + (window.DEPOT_VERSION ? ' · version ' + window.DEPOT_VERSION : '') + ' · <a href="https://github.com/TheCodingDad-TisonK/Depot-Co" target="_blank" style="color:inherit">github</a></div></div></div>');
  document.body.appendChild(menu);
  var startCard = $('dc-start'); if (startCard) startCard.hidden = true;   // the main menu is the start screen; the live hall shows behind it

  var flags = {}; try { ['depotco-skip-splash', 'depotco-autoplay'].forEach(function (k) { flags[k] = sessionStorage.getItem(k) === '1'; sessionStorage.removeItem(k); }); } catch (e) {}
  var splashDone = false;
  function endSplash() { if (splashDone) return; splashDone = true; menu.hidden = false; showMain(); splash.classList.add('fade'); setTimeout(function () { splash.hidden = true; }, 750); }
  if (flags['depotco-skip-splash']) { splash.hidden = true; splashDone = true; menu.hidden = false; }
  else { setTimeout(endSplash, 3400); splash.addEventListener('click', endSplash); window.addEventListener('keydown', function once() { window.removeEventListener('keydown', once); endSplash(); }); }

  function body(html) { $('dc-menu-main').innerHTML = html; }
  function line(s) { return 'Day ' + (s.day || 1) + ' · level ' + (s.level || 1) + ' · ' + money(s.bank) + ' · rep ' + Math.round(s.rep || 0) + ' · ' + (s.stats && s.stats.shipped || 0) + ' orders shipped'; }
  function slotRow(n) {
    var s = readSlot(n), on = n === active();
    return '<div class="dc-slot' + (on ? ' on' : '') + '"><div class="dc-slot-info"><b>Slot ' + n + (on ? ' · loaded' : '') + '</b><span>' + (s ? line(s) : 'Empty. A new depot starts with $600, two rack rows and a pallet jack.') + '</span></div>' +
      '<button class="' + (on ? 'primary' : '') + '" data-dc="slot" data-n="' + n + '">' + (s ? '▶ Continue' : '▶ Start') + '</button>' + (s ? '<button class="danger" data-dc="del" data-n="' + n + '" title="Delete this save">🗑</button>' : '') + '</div>';
  }
  function showMain() {
    var rows = ''; for (var n = 1; n <= SLOTS; n++) rows += slotRow(n);
    body('<div class="dc-slots">' + rows + '</div><div class="dc-menu-row"><button data-dc="how">📖 How to play</button><button data-dc="quit">⏏ Quit</button></div>');
  }
  function showHow() {
    body('<div class="dc-how">' + (window.DEPOT && window.DEPOT.guideHtml ? window.DEPOT.guideHtml() : '<p>The guide loads with the game.</p>') + '</div><div class="dc-menu-row"><button data-dc="back" class="primary">← Back</button></div>');
  }
  function play(n) {
    try { localStorage.setItem('depotco-slot', String(n)); } catch (e) {}
    if (n !== (window.DEPOT && window.DEPOT.bootSlot)) { try { sessionStorage.setItem('depotco-skip-splash', '1'); sessionStorage.setItem('depotco-autoplay', '1'); } catch (e) {} location.reload(); return; }
    menu.classList.add('fade'); setTimeout(function () { menu.hidden = true; menu.classList.remove('fade'); }, 500);
    if (window.DEPOT && window.DEPOT.enter) window.DEPOT.enter();
  }
  menu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-dc]'); if (!b) return;
    var k = b.getAttribute('data-dc'), n = +b.getAttribute('data-n');
    if (k === 'slot') play(n);
    else if (k === 'del') {
      if (b.getAttribute('data-sure') !== '1') { b.setAttribute('data-sure', '1'); b.textContent = 'Delete?'; setTimeout(function () { b.removeAttribute('data-sure'); b.textContent = '🗑'; }, 2500); return; }
      try { localStorage.removeItem('depotco-slot' + n); } catch (err) {}
      if (n === active()) { try { sessionStorage.setItem('depotco-skip-splash', '1'); } catch (err) {} location.reload(); } else showMain();
    }
    else if (k === 'how') showHow();
    else if (k === 'back') showMain();
    else if (k === 'quit') { window.close(); setTimeout(function () { body('<p style="color:#a0acb8">Close the window to quit.</p><div class="dc-menu-row"><button data-dc="back">← Back</button></div>'); }, 300); }
  });
  // the game's pause menu returns here
  window.DEPOT_MENU.show = function () { menu.hidden = false; showMain(); };
  if (flags['depotco-autoplay']) { var tries = 0; (function go() { if (window.DEPOT && window.DEPOT.enter) play(active()); else if (++tries < 100) setTimeout(go, 50); })(); }
})();
