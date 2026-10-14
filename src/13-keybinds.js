//@ key bindings: every control can be rebound from Settings → Key bindings; a remap layer turns the key pressed into the key the code reads
  // ── Key bindings ──────────────────────────────────────────────────
  // Tyson (2026-10-14): "a new button that opens the keybind menu where the player can rebind ALL controls". The engine and the game
  // read physical key codes everywhere (e.code === 'KeyE', player.keys.KeyW), so nothing that reads a key changes: a capture-phase
  // listener on the window catches each key before the engine's document listeners, and when the player has rebound it, stops it and
  // dispatches the same event again with the code of the action it is bound to. A key whose action moved elsewhere is swallowed, a key
  // no action uses passes through untouched. Each action is the default key it stands for, so one action keeps every job that key
  // has in each context (E uses, pages the scanner up and grabs in build mode). Binding a key another action holds swaps the two.
  // Escape stays Escape (it is the way out of everything) and F11 stays F11 (the Electron shell takes it before the page sees it).
  var KB_KEY = 'depotco-keys';
  var KB_ACTIONS = [
    { id: 'fwd', code: 'KeyW', label: 'Move forward', sub: 'walk, drive, fly the photo camera' },
    { id: 'back', code: 'KeyS', label: 'Move back' },
    { id: 'left', code: 'KeyA', label: 'Move left', sub: 'steer left when driving' },
    { id: 'right', code: 'KeyD', label: 'Move right', sub: 'steer right when driving' },
    { id: 'run', code: 'ShiftLeft', also: ['ShiftRight'], label: 'Run', sub: 'the forklift gear; with Use, locks a door' },
    { id: 'jump', code: 'Space', label: 'Jump', sub: 'photo mode: up' },
    { id: 'use', code: 'KeyE', label: 'Use, pick up, put on', sub: 'scanner: next page; build mode: grab and drop' },
    { id: 'put', code: 'KeyG', label: 'Put down, let go', sub: 'build mode: put a piece back' },
    { id: 'scan', code: 'Tab', label: 'Hand scanner', sub: 'raise and lower it' },
    { id: 'scanPrev', code: 'KeyQ', label: 'Scanner: previous page' },
    { id: 'wayp', code: 'KeyF', label: 'Scanner: set a waypoint', sub: 'forklift: forks down' },
    { id: 'clear', code: 'KeyX', label: 'Clear the waypoint' },
    { id: 'scanAct', code: 'Enter', also: ['NumpadEnter'], label: 'Scanner: run the row’s action' },
    { id: 'forkUp', code: 'KeyR', label: 'Forklift: forks up', sub: 'build mode: turn a piece' },
    { id: 'build', code: 'F2', label: 'Build mode' },
    { id: 'cat', code: 'KeyC', label: 'Build mode: catalogue', sub: 'photo mode: down' },
    { id: 'reset', code: 'Backspace', label: 'Build mode: put back where it started' },
    { id: 'remove', code: 'Delete', label: 'Build mode: remove' },
    { id: 'photo', code: 'F9', label: 'Photo mode' },
    { id: 'shot', code: 'F12', label: 'Screenshot' },
    { id: 'fps', code: 'F3', label: 'Show FPS' }
  ];
  var KB_FIXED = [['Escape', 'Pause, close, cancel'], ['F11', 'Fullscreen'], ['Ctrl+Shift+D', 'Link the dev console']];
  var KB_BY = {}; KB_ACTIONS.forEach(function (a) { KB_BY[a.id] = a; });
  var kb = { map: {}, listen: null, inject: false };   // map: action id -> the physical code the player chose (absent: the default)
  try { var kbSaved = JSON.parse(localStorage.getItem(KB_KEY) || 'null'); if (kbSaved && typeof kbSaved === 'object') for (var kbi in kbSaved) if (KB_BY[kbi] && typeof kbSaved[kbi] === 'string') kb.map[kbi] = kbSaved[kbi]; } catch (e) {}
  function kbSave() { try { localStorage.setItem(KB_KEY, JSON.stringify(kb.map)); } catch (e) {} }
  function kbOf(id) { return kb.map[id] || KB_BY[id].code; }   // the physical key bound to an action
  function kbDefault(a) { return [a.code].concat(a.also || []); }
  // physical code -> the code the game reads; null swallows it; undefined passes it through
  function kbResolve(code) {
    var hit, isDefault = false;
    KB_ACTIONS.forEach(function (a) { if (hit) return; var cur = kb.map[a.id]; if (cur ? cur === code : kbDefault(a).indexOf(code) >= 0) hit = a; if (kbDefault(a).indexOf(code) >= 0) isDefault = true; });
    if (hit) return kb.map[hit.id] ? hit.code : code;   // a key still on its default keeps its own code (ShiftRight stays ShiftRight)
    return isDefault ? null : undefined;
  }
  function kbName(code) {
    if (!code) return '?';
    var N = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Alt', AltRight: 'Right Alt', Enter: 'Enter', NumpadEnter: 'Num Enter', Backspace: 'Backspace', Delete: 'Del', Tab: 'Tab', CapsLock: 'Caps Lock', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Insert: 'Ins', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn' };
    if (N[code]) return N[code];
    var m = /^Key([A-Z])$/.exec(code) || /^Digit(\d)$/.exec(code); if (m) return m[1];
    m = /^Numpad(.+)$/.exec(code); if (m) return 'Num ' + m[1];
    return code;
  }
  function kbLabel(id) { return kbName(kbOf(id)); }
  // a key label as the guide and the help write it ('E', 'Shift+E', 'WASD'), turned into the keys bound now
  var KB_TEXT = { W: 'fwd', S: 'back', A: 'left', D: 'right', Shift: 'run', Space: 'jump', E: 'use', G: 'put', Tab: 'scan', Q: 'scanPrev', F: 'wayp', X: 'clear', Enter: 'scanAct', R: 'forkUp', F2: 'build', C: 'cat', Backspace: 'reset', Del: 'remove', F9: 'photo', F12: 'shot', F3: 'fps' };
  function kbd(t) {
    if (t === 'WASD') { var w = ['fwd', 'left', 'back', 'right'].map(kbLabel); return '<kbd>' + (w.every(function (x) { return x.length === 1; }) ? (w[0] + w[1] + w[2] + w[3] === 'WASD' ? 'WASD' : w.join(' ')) : w.join(' ')) + '</kbd>'; }
    if (/^Ctrl\+Shift\+D$/.test(t)) return '<kbd>' + t + '</kbd>';
    return '<kbd>' + t.split('+').map(function (p) { return KB_TEXT[p] ? kbLabel(KB_TEXT[p]) : p; }).join('+') + '</kbd>';
  }
  function kbBind(id, code) {
    var a = KB_BY[id]; if (!a) return;
    var old = kbOf(id);
    KB_ACTIONS.forEach(function (o) { if (o.id !== id && (kb.map[o.id] ? kb.map[o.id] === code : kbDefault(o).indexOf(code) >= 0)) kb.map[o.id] = old; });   // the action that had this key takes the old one
    kb.map[id] = code;
    KB_ACTIONS.forEach(function (o) { if (kb.map[o.id] === o.code) delete kb.map[o.id]; });   // back on its own default: no entry
    kbSave(); kbRelease();
  }
  function kbResetAll() { kb.map = {}; kbSave(); kbRelease(); }
  function kbRelease() { if (player && player.keys) for (var k in player.keys) player.keys[k] = false; }   // a held key must not stay down under its old meaning
  function kbRemapped() { return Object.keys(kb.map).length > 0; }
  function kbOnKey(e) {
    if (kb.inject) return;   // our own re-dispatch
    if (kb.listen && e.type === 'keydown') {
      e.preventDefault(); e.stopImmediatePropagation();
      var id = kb.listen; kb.listen = null;
      if (e.code === 'Escape') { sfx('click'); kbRedraw(); return; }
      if (e.code === 'F11' || /^(Meta|OS)/.test(e.code) || !e.code) { toast(kbName(e.code) + ' cannot be bound.', 'bad'); kbRedraw(); return; }
      kbBind(id, e.code); sfx('click'); kbRedraw(); return;
    }
    if (kb.listen && e.type === 'keyup') { e.stopImmediatePropagation(); return; }
    if (!kbRemapped() || e.code === 'Escape' || (CO.editor && CO.editor.on)) return;
    var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    var to = kbResolve(e.code);
    if (to === undefined || to === e.code) return;
    e.stopImmediatePropagation();
    if (to === null) { if (e.type === 'keydown' && /^(Tab|F\d+|Backspace)$/.test(e.code)) e.preventDefault(); return; }   // a key that lost its job does nothing, and Tab does not move the focus
    var ev = new KeyboardEvent(e.type, { code: to, key: e.key, repeat: e.repeat, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, bubbles: true, cancelable: true });
    kb.inject = true; try { (t || document).dispatchEvent(ev); } finally { kb.inject = false; }
    if (ev.defaultPrevented || /^(Tab|F\d+)$/.test(to)) e.preventDefault();
  }
  window.addEventListener('keydown', kbOnKey, true);
  window.addEventListener('keyup', kbOnKey, true);
  // the prompt chip is the engine's and always reads E: show the key Use is bound to
  (function () { var p = document.getElementById('h-prompt'); if (!p || typeof MutationObserver === 'undefined') return; new MutationObserver(function () { var b = p.firstChild; if (b && b.tagName === 'B' && b.textContent === 'E' && kbOf('use') !== 'KeyE') b.textContent = kbLabel('use'); }).observe(p, { childList: true }); })();

  // ── The menu ──────────────────────────────────────────────────────
  function keybindsHtml() {
    var rows = KB_ACTIONS.map(function (a) {
      var on = kb.listen === a.id, moved = !!kb.map[a.id];
      return '<div class="dc-kb-row"><div class="dc-kb-name">' + esc(a.label) + (a.sub ? '<small>' + esc(a.sub) + '</small>' : '') + '</div>' +
        '<button class="dc-kb-key' + (on ? ' listening' : moved ? ' moved' : '') + '" data-menu="kb:' + a.id + '">' + (on ? 'Press a key…' : esc(kbLabel(a.id))) + '</button></div>';
    }).join('');
    var fixed = KB_FIXED.map(function (f) { return '<div class="dc-kb-row fixed"><div class="dc-kb-name">' + esc(f[1]) + '<small>fixed</small></div><span class="dc-kb-key">' + esc(f[0]) + '</span></div>'; }).join('');
    return '<div class="dc-menu-row" style="margin:0 0 10px"><button data-menu="settings">← Settings</button><button data-menu="kbReset"' + (kbRemapped() ? '' : ' disabled') + '>Reset all to default</button></div>' +
      '<p style="color:var(--muted);margin:0 0 8px">Click a key, then press the new one. A key another control uses swaps with it. Esc cancels.</p>' +
      '<div class="dc-kb-list">' + rows + fixed + '</div>';
  }
  function kbRedraw() { var b = document.getElementById('dc-menu-body'); if (b && !b.hidden && b.querySelector('.dc-kb-list')) { var sc = b.scrollTop; menuBody(keybindsHtml()); b.scrollTop = sc; } }   // menuBody rewrites the body: keep the place in the list
  function keybindsMenu(k) {
    if (k === 'keybinds') { kb.listen = null; menuBody(keybindsHtml()); return true; }
    if (k === 'kbReset') { kb.listen = null; kbResetAll(); kbRedraw(); toast('Every key is back on its default', 'good'); return true; }
    if (k.indexOf('kb:') === 0 && KB_BY[k.slice(3)]) { kb.listen = kb.listen === k.slice(3) ? null : k.slice(3); kbRedraw(); return true; }
    return false;
  }
  GAME.menu = function (k, b) { keybindsMenu(k, b); };
  // leaving the menu while a button waits for a key stops the wait
  hook('menuOpen', function () { kb.listen = null; });
