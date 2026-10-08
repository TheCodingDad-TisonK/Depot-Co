//@ file header: the engine is set up here (the renderer, the save slot, the shell, the player); the building stage is read off the raw save
/* ============================================================
   Depot Co.: a first-person warehouse simulator in 3D, on Co Engine.
   Trucks bring pallets to the inbound dock, you put the stock on the
   racks, orders come in on the office PC, you pick, pack and ship them
   from the outbound dock. Rendering: three.js r128, everything generated.
   The engine's parts come first in the build (co.json names them); these
   are the game's. CO.setup runs here, CO.boot(GAME) in 15-boot.
   ============================================================ */
  // GAME carries the game's hooks for the engine (it is CO.game); every part adds its own, 15-boot the boot steps
  var GAME = {};
  CO.setup({ canvas: 'dc-canvas', save: 'depotco', game: GAME });
  // 1.21.0: the building stage is read off the slot before anything is laid out, because every layout table is built once a page
  // load for it (02-config). A save from 1.20 or earlier has no site field: it lived in the 72 m hall, so it gets the big hall at
  // least, the annexes if it owns a hall, the far end if it owns Hall 4 (stageForOwned). No save: the shed. BOOT_SAVE is the
  // engine's raw peek at the slot (Co Engine 40-state).
  function stageForOwned(up) { up = up || {}; return up.hall4 ? 5 : (up.hall2 || up.hall3) ? 4 : 3; }
  var BOOT_STAGE = BOOT_SAVE ? (typeof BOOT_SAVE.site === 'number' ? Math.max(0, Math.min(5, Math.floor(BOOT_SAVE.site))) : stageForOwned(BOOT_SAVE.up)) : 0;
