//@ three.js setup: renderer, camera, lights, generated textures, materials, bevelled geometry, helpers
  // ── Three.js world ────────────────────────────────────────────────
  var canvas = $('dc-canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // the sun map is redrawn on a timer, not every frame
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb0d4);
  scene.fog = new THREE.Fog(0x8fb0d4, 70, 190);
  var camera = new THREE.PerspectiveCamera(SET.fov, 1, 0.08, 260);
  var shadowDirty = true, shadowT = 0;
  var worldTime = 0;   // seconds since boot, for anything that sways, spins or pulses

  function resize() { var w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize);

  // Reflections: a small studio (dark shell, a few bright troffers, one warm and one cool wall) is drawn once and baked into
  // the environment map. It is dim on purpose: it is there so chrome, glass and screens have something to reflect, not to light the hall.
  function buildEnvStudio() {
    var es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: 0x0b0d0f, side: THREE.BackSide })));
    function pane(w, h, col, k, x, y, z, rx, ry) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k) })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); es.add(m); }
    pane(24, 24, 0x14100c, 1, 0, -5.9, 0, -Math.PI / 2); pane(24, 24, 0x141517, 1, 0, 5.9, 0, Math.PI / 2);
    [[-5, -4], [5, -4], [-5, 4], [5, 4], [0, 0]].forEach(function (p) { pane(3.0, 1.1, 0xfff4e2, 1.1, p[0], 5.8, p[1], Math.PI / 2); });
    pane(6, 4, 0xcfe4ff, 1.2, 0, 1, -11.8, 0, 0); pane(5, 3.5, 0xffd9a8, 0.9, 11.8, 0.5, 2, 0, -Math.PI / 2);
    var pm = new THREE.PMREMGenerator(renderer); pm.compileEquirectangularShader();
    try { var rt = pm.fromScene(es, 0.04); scene.environment = rt.texture; } catch (e) { /* no env map on this GPU: materials fall back to the lights */ }
    pm.dispose();
  }
  buildEnvStudio();

  // lights: a sun through the skylights, a sky bounce, and the hall's high bays
  var hemi = new THREE.HemisphereLight(0xdfeaff, 0x5a4d40, 0.45); scene.add(hemi);
  // the shadow box covers the whole site since 1.16.0 (the annex halls and the wing used to get sun through their roofs); the sun aims at its target, which lighting() moves with it
  var sun = new THREE.DirectionalLight(0xfff0d8, 1.1); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70; sun.shadow.camera.near = 1; sun.shadow.camera.far = 230; sun.target.position.set(0, 0, -20); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);
  var hallLights = [];
  // nine high bays on a 20 x 15 m grid: the hall is 60 x 48 since 2026-10-02, and six lights on the old 20 x 10 grid left the edges dark
  [[-26, -15], [-9, -15], [9, -15], [26, -15], [-26, 0], [-9, 0], [9, 0], [26, 0], [-26, 15], [-9, 15], [9, 15], [26, 15]].forEach(function (p, i) {   // twelve since the 72 m hall
    // a shorter reach than the old 38 m: the floor under each bay is a pool and the aisle between two bays is a touch darker, the
    // way a real hall reads. Every third lamp is a slightly cooler tube, as a hall that has had its lamps replaced piecemeal is.
    var l = new THREE.PointLight(i % 3 === 2 ? 0xf3f0ff : 0xffeacc, 0.55, 28, 2); l.position.set(p[0], 7.3, p[1]); l.userData.warm = i % 3 !== 2; scene.add(l); hallLights.push(l);
  });
  // the three rooms' own lamps, under their troffers (they used to sit where the rooms were before the hall grew: in the open hall)
  var officeLight = new THREE.PointLight(0xfff8ea, 0.55, 9, 2); officeLight.position.set(32.5, 2.9, 21.2); scene.add(officeLight);
  var breakLight = new THREE.PointLight(0xffe9c8, 0.45, 8, 2); breakLight.position.set(-32.5, 2.9, -22.1); scene.add(breakLight);
  var lobbyLight = new THREE.PointLight(0xffe9c8, 0.4, 7, 2); lobbyLight.position.set(-33.7, 2.9, 21.2); scene.add(lobbyLight);
  var yardLights = [];   // filled by the lamp-post props
  // Three.js lights every pixel with every visible point light, whether or not the light can reach it, so thirty lamps mean thirty
  // evaluations per pixel. Every point light in the scene goes in one list and only the nearest few to the camera stay visible; the
  // rest are hidden. The visible count is held constant so the shaders are not recompiled when you walk from one end of the hall
  // to the other. A lamp inside a hidden group is left alone (the renderer skips it anyway). Lamps that are off sort last.
  var lightBudget = { n: 12, lights: null, scanT: 0, tickT: 0, tmp: new THREE.Vector3(), cam: new THREE.Vector3() };
  function updateLightBudget() {
    var t = worldTime;
    if (!lightBudget.lights || t - lightBudget.scanT > 2) { var list = []; scene.traverse(function (o) { if (o.isPointLight) list.push(o); }); lightBudget.lights = list; lightBudget.scanT = t; }
    if (t - lightBudget.tickT < 0.1) return; lightBudget.tickT = t;
    camera.getWorldPosition(lightBudget.cam);
    var cand = [];
    lightBudget.lights.forEach(function (l) {
      for (var p = l.parent; p; p = p.parent) if (p.visible === false) return;
      l.getWorldPosition(lightBudget.tmp); var d = lightBudget.tmp.distanceTo(lightBudget.cam);
      l.userData.budgetScore = (l.intensity > 0 ? 0 : 1e6) + Math.max(0, d - (l.distance || 40) * 0.25) - (l.visible ? 3 : 0); cand.push(l);   // a lamp already on keeps its place: two near-equal lamps at the cut used to swap every tick
    });
    cand.sort(function (a, b) { return a.userData.budgetScore - b.userData.budgetScore; });
    for (var i = 0; i < cand.length; i++) cand[i].visible = i < lightBudget.n;
  }

  // ── Textures: every one is drawn on a canvas at boot ──────────────
  function tex(w, h, draw, rx, ry) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; var ctx = c.getContext('2d'); draw(ctx, w, h);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function grain(ctx, w, h, n, alpha, dark) { for (var i = 0; i < n; i++) { var v = Math.floor(Math.random() * 255); ctx.fillStyle = 'rgba(' + (dark ? 0 : v) + ',' + (dark ? 0 : v) + ',' + (dark ? 0 : v) + ',' + alpha + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } }
  // soft blotches: water marks, oil, wear. Dark or light, a few big and many small.
  function blotches(ctx, w, h, n, rmin, rmax, dark, alpha) { for (var i = 0; i < n; i++) { var r = randf(rmin, rmax), x = Math.random() * w, y = Math.random() * h; var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + (dark ? '0,0,0,' : '255,255,255,') + alpha + ')'); g.addColorStop(1, 'rgba(' + (dark ? '0,0,0,0)' : '255,255,255,0)')); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } }
  function cracks(ctx, w, h, n, alpha) { for (var i = 0; i < n; i++) { ctx.strokeStyle = 'rgba(20,20,20,' + alpha + ')'; ctx.lineWidth = 1; ctx.beginPath(); var x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y); for (var k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; ctx.lineTo(x, y); } ctx.stroke(); } }
  var TEX = {
    concrete: tex(1024, 1024, function (c, w, h) {
      c.fillStyle = '#8b8d8e'; c.fillRect(0, 0, w, h); grain(c, w, h, 26000, 0.12); grain(c, w, h, 5000, 0.08, true);
      blotches(c, w, h, 30, 40, 160, true, 0.09); blotches(c, w, h, 16, 30, 110, false, 0.07); cracks(c, w, h, 10, 0.25);
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();   // the slab joints
      for (var i = 0; i < 6; i++) { c.strokeStyle = 'rgba(30,30,30,0.18)'; c.lineWidth = randf(6, 14); c.beginPath(); var x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.quadraticCurveTo(x + randf(-120, 120), y + randf(-120, 120), x + randf(-260, 260), y + randf(-260, 260)); c.stroke(); }   // tyre scuffs
    }, 5, 3.5),
    asphalt: tex(1024, 1024, function (c, w, h) { c.fillStyle = '#3d3f42'; c.fillRect(0, 0, w, h); grain(c, w, h, 50000, 0.16); grain(c, w, h, 12000, 0.12, true); for (var i = 0; i < 9000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(120,118,112,0.35)' : 'rgba(86,84,80,0.4)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } blotches(c, w, h, 10, 60, 260, true, 0.14); blotches(c, w, h, 6, 40, 160, false, 0.05); cracks(c, w, h, 16, 0.25); for (var s = 0; s < 4; s++) { c.strokeStyle = 'rgba(14,14,16,0.5)'; c.lineWidth = randf(3, 6); c.beginPath(); var x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (var k = 0; k < 8; k++) { x += randf(-60, 60); y += randf(-60, 60); c.lineTo(x, y); } c.stroke(); } }, 22, 22),
    corrugated: tex(512, 256, function (c, w, h) {
      c.fillStyle = '#9aa3ad'; c.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 16) { var g = c.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, '#7e8792'); g.addColorStop(0.5, '#b7bfc8'); g.addColorStop(1, '#7e8792'); c.fillStyle = g; c.fillRect(x, 0, 16, h); }
      grain(c, w, h, 2500, 0.06, true);
      for (var y = 24; y < h; y += 104) for (var rx = 8; rx < w; rx += 16) { c.fillStyle = 'rgba(40,45,50,0.5)'; c.beginPath(); c.arc(rx, y, 1.6, 0, 6.3); c.fill(); }   // rivet rows
      for (var i = 0; i < 8; i++) { var sx = Math.random() * w; var sg = c.createLinearGradient(0, h * 0.5, 0, h); sg.addColorStop(0, 'rgba(120,70,30,0)'); sg.addColorStop(1, 'rgba(110,60,25,0.35)'); c.fillStyle = sg; c.fillRect(sx, h * 0.5, randf(2, 6), h * 0.5); }   // rust streaks down from the fixings
    }, 8, 2),
    corrugatedDoor: tex(256, 256, function (c, w, h) { c.fillStyle = '#5d6771'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 20) { var g = c.createLinearGradient(0, y, 0, y + 20); g.addColorStop(0, '#4a535c'); g.addColorStop(0.5, '#7b858f'); g.addColorStop(1, '#4a535c'); c.fillStyle = g; c.fillRect(0, y, w, 20); } grain(c, w, h, 1500, 0.08, true); blotches(c, w, h, 6, 20, 60, true, 0.2); }, 2, 4),
    plaster: tex(256, 256, function (c, w, h) { c.fillStyle = '#e4e1d8'; c.fillRect(0, 0, w, h); grain(c, w, h, 2500, 0.05); blotches(c, w, h, 4, 20, 50, true, 0.05); }, 4, 2),
    wood: tex(256, 128, function (c, w, h) {
      c.fillStyle = '#b08a5a'; c.fillRect(0, 0, w, h);
      var drift = [randf(-6, 6), randf(-6, 6), randf(-6, 6)];
      for (var i = 0; i < 60; i++) { c.strokeStyle = 'rgba(80,50,20,' + (0.1 + Math.random() * 0.25) + ')'; c.lineWidth = 1 + Math.random() * 1.5; c.beginPath(); var y = Math.random() * h; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + drift[0] + randf(-3, 3), w * 0.65, y + drift[1] + randf(-3, 3), w + 4, y + drift[2]); c.stroke(); }
      for (var p = 0; p < 500; p++) { c.fillStyle = 'rgba(60,35,10,0.18)'; c.fillRect(Math.random() * w, Math.random() * h, randf(3, 10), 1); }
      c.fillStyle = 'rgba(0,0,0,0.3)'; [0.2, 0.5, 0.8].forEach(function (f) { c.fillRect(0, h * f, w, 2); });   // the slat gaps of a pallet deck
    }, 1, 1),
    pallet: null,
    crate: tex(256, 256, function (c, w, h) { c.fillStyle = '#c9a26b'; c.fillRect(0, 0, w, h); grain(c, w, h, 2500, 0.1); c.fillStyle = 'rgba(70,45,15,0.55)'; for (var k = 1; k < 5; k++) c.fillRect(k * w / 5 - 2, 0, 4, h); c.fillStyle = 'rgba(70,45,15,0.35)'; c.fillRect(0, h * 0.12, w, 5); c.fillRect(0, h * 0.86, w, 5); c.fillStyle = '#2b3b4e'; for (var n = 0; n < 10; n++) { c.beginPath(); c.arc(w * (0.1 + (n % 5) * 0.2), h * (n < 5 ? 0.14 : 0.88), 2.5, 0, 6.3); c.fill(); } c.fillStyle = '#1f4e79'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('SEA FREIGHT', w / 2, h * 0.5); c.font = 'bold 13px sans-serif'; c.fillText('THIS WAY UP  ▲▲', w / 2, h * 0.64); c.textAlign = 'left'; }, 1, 1),
    strapped: tex(256, 256, function (c, w, h) { c.fillStyle = '#b7905f'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.08); c.fillStyle = '#d9c4a0'; c.fillRect(0, h * 0.42, w, h * 0.16); c.fillStyle = '#17191c'; c.fillRect(w * 0.22, 0, w * 0.07, h); c.fillRect(w * 0.71, 0, w * 0.07, h); c.fillStyle = '#5fd38d'; c.fillRect(w * 0.36, h * 0.62, w * 0.28, h * 0.22); c.fillStyle = '#0d1b2a'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('LAND', w * 0.5, h * 0.77); c.textAlign = 'left'; }, 1, 1),
    airbox: tex(256, 256, function (c, w, h) { c.fillStyle = '#f2f4f6'; c.fillRect(0, 0, w, h); grain(c, w, h, 1500, 0.04); c.fillStyle = '#ff6b5e'; c.beginPath(); c.moveTo(0, h * 0.78); c.lineTo(w, h * 0.5); c.lineTo(w, h * 0.66); c.lineTo(0, h * 0.94); c.closePath(); c.fill(); c.fillStyle = '#3fa7d6'; c.fillRect(0, 0, w, h * 0.08); c.fillStyle = '#0d1b2a'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('AIR PRIORITY', w / 2, h * 0.3); c.font = '12px sans-serif'; c.fillText('SKYBRIDGE AIR CARGO', w / 2, h * 0.42); c.textAlign = 'left'; c.fillStyle = '#222'; for (var i = 0; i < 16; i++) c.fillRect(w * 0.6 + i * 5, h * 0.12, Math.random() < 0.5 ? 1.5 : 3, h * 0.1); }, 1, 1),
    returned: tex(256, 256, function (c, w, h) { c.fillStyle = '#b7905f'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.08); c.fillStyle = '#d9c4a0'; c.fillRect(0, h * 0.42, w, h * 0.16); c.fillStyle = '#ffffff'; c.fillRect(w * 0.55, h * 0.62, w * 0.36, h * 0.28); c.fillStyle = '#222'; for (var i = 0; i < 18; i++) c.fillRect(w * 0.57 + i * (w * 0.32 / 18), h * 0.66, Math.random() < 0.5 ? 2 : 4, h * 0.12); c.save(); c.translate(w * 0.5, h * 0.22); c.rotate(-0.18); c.fillStyle = '#c8342a'; c.fillRect(-w * 0.42, -h * 0.07, w * 0.84, h * 0.14); c.fillStyle = '#fff'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('RETURN TO SENDER', 0, 8); c.restore(); c.textAlign = 'left'; c.fillStyle = '#c8342a'; c.font = 'bold 12px sans-serif'; c.fillText('RETURNS DESK', w * 0.57, h * 0.87); }, 1, 1),
    parcel: tex(256, 256, function (c, w, h) { c.fillStyle = '#b7905f'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.08); c.fillStyle = '#d9c4a0'; c.fillRect(0, h * 0.42, w, h * 0.16); c.fillStyle = '#ffffff'; c.fillRect(w * 0.55, h * 0.62, w * 0.36, h * 0.28); c.fillStyle = '#222'; for (var i = 0; i < 18; i++) c.fillRect(w * 0.57 + i * (w * 0.32 / 18), h * 0.66, Math.random() < 0.5 ? 2 : 4, h * 0.12); c.font = 'bold 14px sans-serif'; c.fillText('DEPOT CO.', w * 0.57, h * 0.87); c.strokeStyle = '#333'; c.lineWidth = 2; c.strokeRect(w * 0.08, h * 0.08, w * 0.3, h * 0.22); c.font = 'bold 11px sans-serif'; c.fillText('FRAGILE', w * 0.1, h * 0.2); c.fillText('▲ THIS WAY UP', w * 0.1, h * 0.27); }, 1, 1),
    grass: tex(512, 512, function (c, w, h) { c.fillStyle = '#4f6a3a'; c.fillRect(0, 0, w, h); var cols = ['#3f6f2e', '#5c8f44', '#6f9a4a', '#45752f', '#7ea25a']; for (var i = 0; i < 3000; i++) { var x = Math.random() * w, y = Math.random() * h; c.strokeStyle = cols[i % 5]; c.lineWidth = randf(0.8, 1.6); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + randf(-4, 4), y - randf(4, 9), x + randf(-6, 6), y - randf(8, 16)); c.stroke(); } c.fillStyle = 'rgba(70,50,30,.16)'; for (var d = 0; d < 20; d++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, randf(14, 40), randf(8, 22), Math.random() * 3, 0, 6.29); c.fill(); } }, 30, 30),
    skylight: tex(64, 64, function (c, w, h) { c.fillStyle = '#eef6ff'; c.fillRect(0, 0, w, h); }, 1, 1),
    hazard: tex(128, 32, function (c, w, h) { c.fillStyle = '#f5b53d'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; for (var x = -32; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 16, 0); c.lineTo(x + 32, h); c.lineTo(x + 16, h); c.closePath(); c.fill(); } grain(c, w, h, 300, 0.1, true); }, 4, 1),
    noiseMetal: tex(128, 128, function (c, w, h) { c.fillStyle = '#9ea4aa'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.1); }, 1, 1),
    vmesh: tex(128, 256, function (c, w, h) { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(60,96,70,1)'; c.lineWidth = 2.2; for (var vx = 4; vx < w; vx += 10) { c.beginPath(); c.moveTo(vx, 0); c.lineTo(vx, h); c.stroke(); } for (var hy = 4; hy < h; hy += 28) { c.beginPath(); c.moveTo(0, hy); c.lineTo(w, hy); c.stroke(); } }, 2, 1),
    mesh: tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(70,75,80,0.95)'; c.lineWidth = 2; for (var i = 0; i <= w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 16, h); c.stroke(); c.beginPath(); c.moveTo(i + 16, 0); c.lineTo(i, h); c.stroke(); } }, 8, 2),
    brick: tex(256, 256, function (c, w, h) { c.fillStyle = '#c9c2b4'; c.fillRect(0, 0, w, h); var cols = ['#8a4a3a', '#95553f', '#7c4335', '#9a5c45', '#874836', '#a0634c']; var bw = w / 8, bh = h / 8; for (var r = 0; r < 8; r++) for (var k = -1; k < 9; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = pick(cols); c.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4); } grain(c, w, h, 6000, 0.2); }, 2, 0.6),
    paper: tex(128, 128, function (c, w, h) { c.fillStyle = '#f3efe4'; c.fillRect(0, 0, w, h); grain(c, w, h, 800, 0.05); }, 1, 1),
    cork: tex(256, 256, function (c, w, h) { c.fillStyle = '#b8905c'; c.fillRect(0, 0, w, h); grain(c, w, h, 8000, 0.25); blotches(c, w, h, 60, 3, 10, true, 0.3); }, 1, 1),
    fabric: tex(128, 128, function (c, w, h) { c.fillStyle = '#2f4a73'; c.fillRect(0, 0, w, h); grain(c, w, h, 4000, 0.12); }, 1, 1),
    cloth: tex(128, 128, function (c, w, h) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) { c.fillStyle = 'rgba(0,0,0,' + (((x + y) / 2) % 2 ? 0.14 : 0.04) + ')'; c.fillRect(x, y, 2, 2); } }, 6, 6),   // a white weave that takes whatever colour a shirt is given
    rubberMat: tex(128, 128, function (c, w, h) { c.fillStyle = '#1b1d20'; c.fillRect(0, 0, w, h); c.fillStyle = '#24272b'; for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { c.beginPath(); c.arc(x + 8, y + 8, 5, 0, 6.3); c.fill(); } }, 6, 6),
    // painted blockwork: four courses of 400 x 200 blocks in a sheet 1.6 by 0.8 m, grey paint over grey block, a few blocks a shade off
    block: tex(512, 256, function (c, w, h) { c.fillStyle = '#6e7276'; c.fillRect(0, 0, w, h); var bw = w / 4, bh = h / 4; for (var r = 0; r < 4; r++) for (var k = -1; k < 5; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = pick(['#9a9c9a', '#959895', '#9fa19e', '#929592', '#9c9e9b']); c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6); } grain(c, w, h, 5000, 0.08); blotches(c, w, h, 10, 20, 70, true, 0.08); for (var i = 0; i < 40; i++) { c.fillStyle = 'rgba(40,40,42,' + randf(0.05, 0.2) + ')'; c.fillRect(Math.random() * w, h * 0.7 + Math.random() * h * 0.3, randf(2, 10), randf(2, 5)); } }, 1, 1),
    // carpet tile for the office: half-metre tiles in a blue-grey loop pile, the joints just showing, laid chequerboard
    carpet: tex(256, 256, function (c, w, h) { c.fillStyle = '#3f4857'; c.fillRect(0, 0, w, h); for (var ty = 0; ty < 2; ty++) for (var tx = 0; tx < 2; tx++) { c.fillStyle = (tx + ty) % 2 ? '#404a5a' : '#3b4453'; c.fillRect(tx * 128 + 1, ty * 128 + 1, 126, 126); } grain(c, w, h, 14000, 0.1); for (var y = 0; y < h; y += 3) { c.fillStyle = 'rgba(255,255,255,0.025)'; c.fillRect(0, y, w, 1); } }, 1, 1),
    // vinyl sheet for the lobby and the break room: a pale speckled floor with a faint weld line every 1.5 m
    vinyl: tex(256, 256, function (c, w, h) { c.fillStyle = '#c9c6bd'; c.fillRect(0, 0, w, h); for (var i = 0; i < 9000; i++) { c.fillStyle = pick(['rgba(90,86,80,0.35)', 'rgba(255,255,255,0.3)', 'rgba(120,110,100,0.25)']); c.fillRect(Math.random() * w, Math.random() * h, randf(1, 3), randf(1, 3)); } blotches(c, w, h, 6, 30, 90, true, 0.05); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, h / 2 - 1, w, 2); }, 1, 1)
  };
  function cardboardTex(col, name) {
    return tex(256, 256, function (c, w, h) {
      c.fillStyle = '#c69c6d'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.08); blotches(c, w, h, 4, 20, 60, true, 0.06);
      c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(0, h * 0.48, w, 4);                       // the flap seam
      c.fillStyle = 'rgba(190,170,130,0.55)'; c.fillRect(w * 0.44, 0, w * 0.12, h);           // packing tape
      c.fillStyle = col; c.fillRect(0, h * 0.8, w, h * 0.09);                                 // the client's colour band
      c.fillStyle = '#fff'; c.fillRect(w * 0.08, h * 0.08, w * 0.34, h * 0.3);                // the label
      c.fillStyle = '#222'; for (var i = 0; i < 16; i++) c.fillRect(w * 0.1 + i * (w * 0.3 / 16), h * 0.11, Math.random() < 0.5 ? 2 : 3, h * 0.13);
      c.font = 'bold 11px sans-serif'; c.fillStyle = '#333'; c.fillText((name || '').toUpperCase().slice(0, 14), w * 0.1, h * 0.31); c.font = '9px sans-serif'; c.fillText('SKU ' + Math.floor(Math.random() * 90000 + 10000), w * 0.1, h * 0.36);
      c.strokeStyle = 'rgba(40,40,40,0.8)'; c.lineWidth = 2; c.strokeRect(w * 0.62, h * 0.1, w * 0.28, h * 0.28);   // the handling icons: this way up, keep dry
      c.fillStyle = 'rgba(40,40,40,0.8)'; c.font = 'bold 18px sans-serif'; c.fillText('▲▲', w * 0.67, h * 0.24); c.font = '9px sans-serif'; c.fillText('THIS WAY UP', w * 0.635, h * 0.34);
      c.beginPath(); c.moveTo(w * 0.76, h * 0.62); c.quadraticCurveTo(w * 0.68, h * 0.72, w * 0.76, h * 0.76); c.quadraticCurveTo(w * 0.84, h * 0.72, w * 0.76, h * 0.62); c.fill(); c.font = '8px sans-serif'; c.fillText('KEEP DRY', w * 0.66, h * 0.72);
    });
  }
  // a sign on the house slate (#1b232c) is an enamelled plate: the slate shades a little towards the bottom, a hairline of
  // light sits just in from the edge and a hairline of the sign's own colour inside that. opt.plate false turns that off (paint)
  function isPlate(opt) { return !!opt && opt.plate !== false && (opt.plate === true || opt.bg === '#1b232c'); }
  function textTex(lines, opt) {
    opt = opt || {}; var w = opt.w || 512, h = opt.h || 128, plate = isPlate(opt);
    return tex(w, h, function (c) {
      if (plate) { var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#222c38'); g.addColorStop(1, '#10161d'); c.fillStyle = g; c.fillRect(0, 0, w, h); var e = Math.max(2, Math.round(Math.min(w, h) * 0.02)); c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = e; c.strokeRect(e / 2, e / 2, w - e, h - e); c.strokeStyle = opt.fg || '#f5b53d'; c.globalAlpha = 0.5; c.lineWidth = Math.max(1, e * 0.6); c.strokeRect(e * 3, e * 3, w - e * 6, h - e * 6); c.globalAlpha = 1; }
      else { c.fillStyle = opt.bg || '#1b232c'; c.fillRect(0, 0, w, h); }
      if (opt.border) { c.strokeStyle = opt.border; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); }
      c.fillStyle = opt.fg || '#f5b53d'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var size = opt.size || Math.min(h * 0.6, w / (Math.max.apply(null, lines.map(function (l) { return l.length; })) * 0.6));
      c.font = (opt.weight || 'bold') + ' ' + Math.floor(size) + 'px ' + (opt.font || 'Bahnschrift, Arial, sans-serif');
      if (plate) { c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = Math.max(2, size * 0.08); c.shadowOffsetY = Math.max(1, size * 0.04); }
      lines.forEach(function (l, i) { c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15, w * 0.92); });   // never off the plate
      c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    });
  }
  // the safety posters and notices on the walls: each one drawn once
  function posterTex(kind) {
    return tex(256, 384, function (c, w, h) {
      var title = function (t, col, y, size) { c.fillStyle = col; c.font = 'bold ' + (size || 30) + 'px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(t, w / 2, y); };
      var small = function (t, y, col) { c.fillStyle = col || '#333'; c.font = '15px "Segoe UI", Arial, sans-serif'; c.textAlign = 'center'; c.fillText(t, w / 2, y, w - 40); };
      if (kind === 'forklift') { c.fillStyle = '#f5b53d'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.beginPath(); c.moveTo(w / 2, 40); c.lineTo(w - 24, h * 0.55); c.lineTo(24, h * 0.55); c.closePath(); c.fill(); c.fillStyle = '#f5b53d'; c.beginPath(); c.moveTo(w / 2, 70); c.lineTo(w - 48, h * 0.52); c.lineTo(48, h * 0.52); c.closePath(); c.fill(); c.fillStyle = '#111'; c.fillRect(w * 0.3, h * 0.33, 70, 36); c.fillRect(w * 0.3 + 70, h * 0.38, 40, 20); c.beginPath(); c.arc(w * 0.36, h * 0.47, 10, 0, 6.3); c.arc(w * 0.55, h * 0.47, 10, 0, 6.3); c.fill(); title('CAUTION', '#111', h * 0.68, 34); title('FORKLIFTS', '#111', h * 0.78, 28); small('Look both ways at the aisle ends', h * 0.9, '#111'); }
      else if (kind === 'lifting') { c.fillStyle = '#2c5f9e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(16, 16, w - 32, h - 32); c.fillStyle = '#2c5f9e'; c.beginPath(); c.arc(w / 2, h * 0.25, 18, 0, 6.3); c.fill(); c.fillRect(w / 2 - 12, h * 0.3, 24, 60); c.fillRect(w / 2 - 36, h * 0.42, 72, 14); c.fillRect(w / 2 - 14, h * 0.45, 10, 50); c.fillRect(w / 2 + 4, h * 0.45, 10, 50); title('LIFT WITH', '#2c5f9e', h * 0.72, 28); title('YOUR LEGS', '#2c5f9e', h * 0.8, 28); small('Bend your knees, keep your back straight', h * 0.9); }
      else if (kind === 'exit') { c.fillStyle = '#2f9e44'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(16, 16, w - 32, h - 32); c.fillStyle = '#2f9e44'; title('FIRE EXIT', '#2f9e44', h * 0.2, 34); c.fillRect(w * 0.2, h * 0.3, w * 0.6, 8); c.beginPath(); c.moveTo(w * 0.3, h * 0.6); c.lineTo(w * 0.7, h * 0.6); c.lineTo(w * 0.7, h * 0.5); c.lineTo(w * 0.86, h * 0.65); c.lineTo(w * 0.7, h * 0.8); c.lineTo(w * 0.7, h * 0.7); c.lineTo(w * 0.3, h * 0.7); c.closePath(); c.fill(); small('Keep this route clear at all times', h * 0.9); }
      else if (kind === 'nosmoking') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8342a'; c.lineWidth = 14; c.beginPath(); c.arc(w / 2, h * 0.38, 80, 0, 6.3); c.stroke(); c.fillStyle = '#333'; c.fillRect(w / 2 - 50, h * 0.37, 100, 12); c.strokeStyle = '#c8342a'; c.beginPath(); c.moveTo(w / 2 - 56, h * 0.38 - 56); c.lineTo(w / 2 + 56, h * 0.38 + 56); c.stroke(); title('NO SMOKING', '#c8342a', h * 0.75, 30); small('Shelter is outside, by the car park', h * 0.86); }
      else if (kind === 'stacking') { c.fillStyle = '#f3efe4'; c.fillRect(0, 0, w, h); title('PALLET RULES', '#1b232c', 46, 28); c.fillStyle = '#333'; c.font = '15px "Segoe UI", Arial, sans-serif'; c.textAlign = 'left'; ['1. One line per slot', '2. Twelve boxes, no more', '3. Heavy at the bottom', '4. Labels facing the aisle', '5. Nothing on the floor', '6. Wrap before it moves'].forEach(function (t, i) { c.fillText(t, 28, 90 + i * 34); }); c.fillStyle = '#f5b53d'; c.fillRect(28, h - 56, w - 56, 24); c.fillStyle = '#111'; c.font = 'bold 14px Bahnschrift, Arial'; c.textAlign = 'center'; c.fillText('THE INSPECTOR CHECKS', w / 2, h - 39); }
      else if (kind === 'rota') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); title('SHIFT ROTA', '#1b232c', 40, 26); c.strokeStyle = '#999'; c.lineWidth = 1; for (var r = 0; r < 8; r++) { c.strokeRect(20, 60 + r * 36, w - 40, 36); } c.fillStyle = '#333'; c.font = '14px "Segoe UI", Arial'; c.textAlign = 'left'; ['Mon  Jo · Mika', 'Tue  Sam · Jo', 'Wed  Mika · Ravi', 'Thu  Jo · Lena', 'Fri  Sam · Mika', 'Sat  Ada · Theo', 'Sun  closed', 'Breaks 12:00 to 12:30'].forEach(function (t, i) { c.fillText(t, 30, 84 + i * 36); }); }
      else if (kind === 'hands') { c.fillStyle = '#2c5f9e'; c.fillRect(0, 0, w, h); title('WASH YOUR', '#fff', h * 0.3, 30); title('HANDS', '#fff', h * 0.42, 30); c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h * 0.65, 50, 0, 6.3); c.fill(); c.fillStyle = '#2c5f9e'; c.beginPath(); c.arc(w / 2, h * 0.65, 36, 0, 6.3); c.fill(); small('Before you eat, after the yard', h * 0.9, '#fff'); }
      else { c.fillStyle = '#1b232c'; c.fillRect(0, 0, w, h); title('DEPOT CO.', '#f5b53d', h * 0.3, 34); title('SAFETY FIRST', '#fff', h * 0.42, 24); c.fillStyle = '#f5b53d'; c.fillRect(w * 0.2, h * 0.5, w * 0.6, 4); small('Days without an accident', h * 0.62, '#a0acb8'); title(String(randi(3, 180)), '#5fd38d', h * 0.78, 64); }
    });
  }
  var POSTER_KINDS = ['forklift', 'lifting', 'exit', 'nosmoking', 'stacking', 'rota', 'hands', 'safety'];
  // normal maps: a height field drawn on a canvas, turned into tangent-space normals with a Sobel filter. Linear, never sRGB.
  function normalTex(w, h, drawHeight, strength, rx, ry) {
    var hc = document.createElement('canvas'); hc.width = w; hc.height = h; var hx = hc.getContext('2d'); drawHeight(hx, w, h);
    var src = hx.getImageData(0, 0, w, h).data, out = hx.createImageData(w, h), o = out.data, s = strength || 1;
    var at = function (x, y) { x = (x + w) % w; y = (y + h) % h; return src[(y * w + x) * 4] / 255; };
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      var dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      var nx = -dx * s, ny = -dy * s, nz = 1, len = Math.sqrt(nx * nx + ny * ny + nz * nz), i = (y * w + x) * 4;
      o[i] = (nx / len * 0.5 + 0.5) * 255; o[i + 1] = (ny / len * 0.5 + 0.5) * 255; o[i + 2] = (nz / len * 0.5 + 0.5) * 255; o[i + 3] = 255;
    }
    hx.putImageData(out, 0, 0);
    var t = new THREE.CanvasTexture(hc); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 8; return t;
  }
  function heightNoise(c, w, h, base, n, amp) { c.fillStyle = base; c.fillRect(0, 0, w, h); for (var i = 0; i < n; i++) { var v = Math.floor(128 + (Math.random() - 0.5) * amp); c.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.6)'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 4), randf(1, 4)); } }
  var NRM = {
    concrete: normalTex(512, 512, function (c, w, h) { heightNoise(c, w, h, '#808080', 14000, 90); for (var i = 0; i < 20; i++) { var r = randf(20, 90), x = Math.random() * w, y = Math.random() * h, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(60,60,60,0.5)'); g.addColorStop(1, 'rgba(128,128,128,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } c.strokeStyle = '#303030'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); }, 1.6, 5, 3.5),
    corrugated: normalTex(256, 128, function (c, w, h) { for (var x = 0; x < w; x++) { var v = Math.floor(128 + Math.sin(x / 16 * Math.PI * 2) * 90); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(x, 0, 1, h); } for (var y = 12; y < h; y += 52) for (var rx = 8; rx < w; rx += 16) { c.fillStyle = '#404040'; c.beginPath(); c.arc(rx, y, 2.2, 0, 6.3); c.fill(); } }, 2.2, 8, 2),
    ribs: normalTex(128, 256, function (c, w, h) { for (var y = 0; y < h; y++) { var v = Math.floor(128 + Math.sin(y / 20 * Math.PI * 2) * 100); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(0, y, w, 1); } }, 2.0, 2, 4),
    asphalt: normalTex(512, 512, function (c, w, h) { heightNoise(c, w, h, '#808080', 40000, 120); }, 1.2, 22, 22),
    plaster: normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 3000, 40); }, 0.8, 4, 2),
    brick: normalTex(256, 256, function (c, w, h) { c.fillStyle = '#a0a0a0'; c.fillRect(0, 0, w, h); var bw = w / 8, bh = h / 8; for (var r = 0; r < 8; r++) for (var k = -1; k < 9; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = '#404040'; c.fillRect(x, r * bh, bw, bh); c.fillStyle = '#a8a8a8'; c.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4); } heightNoise(c, w, h, 'rgba(0,0,0,0)', 2000, 30); }, 1.8, 2, 0.6),
    wood: normalTex(256, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var i = 0; i < 70; i++) { var y = Math.random() * h; c.strokeStyle = 'rgba(40,40,40,' + randf(0.2, 0.6) + ')'; c.lineWidth = randf(1, 2); c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + randf(-4, 4), w * 0.7, y + randf(-4, 4), w, y); c.stroke(); } c.fillStyle = '#202020'; [0.2, 0.5, 0.8].forEach(function (f) { c.fillRect(0, h * f, w, 3); }); }, 1.2, 1, 1),
    cardboard: normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 2500, 30); c.fillStyle = '#505050'; c.fillRect(0, h * 0.48, w, 4); c.fillStyle = '#9a9a9a'; c.fillRect(w * 0.44, 0, w * 0.12, h); c.fillStyle = '#8c8c8c'; c.fillRect(w * 0.08, h * 0.08, w * 0.34, h * 0.3); for (var i = 0; i < h; i += 6) { c.fillStyle = 'rgba(100,100,100,0.25)'; c.fillRect(0, i, w, 1); } }, 1.0, 1, 1),
    chequer: normalTex(128, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 32) for (var x = 0; x < w; x += 32) { var d = ((x + y) / 32) % 2; c.save(); c.translate(x + 16, y + 16); c.rotate(d ? 0.5 : -0.5); c.fillStyle = '#c0c0c0'; c.fillRect(-10, -3, 20, 6); c.restore(); } }, 1.5, 3, 3),
    rubber: normalTex(128, 128, function (c, w, h) { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) { c.fillStyle = '#b0b0b0'; c.beginPath(); c.arc(x + 8, y + 8, 5, 0, 6.3); c.fill(); } }, 1.2, 6, 6),
    block: normalTex(512, 256, function (c, w, h) { c.fillStyle = '#505050'; c.fillRect(0, 0, w, h); var bw = w / 4, bh = h / 4; for (var r = 0; r < 4; r++) for (var k = -1; k < 5; k++) { var x = k * bw + (r % 2 ? bw / 2 : 0); c.fillStyle = '#9a9a9a'; c.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6); } heightNoise(c, w, h, 'rgba(0,0,0,0)', 3000, 30); }, 1.6, 1, 1),
    carpet: normalTex(256, 256, function (c, w, h) { heightNoise(c, w, h, '#808080', 6000, 50); c.fillStyle = '#606060'; c.fillRect(0, 127, w, 2); c.fillRect(127, 0, 2, h); }, 0.9, 1, 1)
  };
  function roughTex(w, h, base, amp, rx, ry) { var t = tex(w, h, function (c) { var v = Math.floor(base * 255); c.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; c.fillRect(0, 0, w, h); for (var i = 0; i < 4000; i++) { var k = Math.floor(v + (Math.random() - 0.5) * amp * 255); c.fillStyle = 'rgba(' + k + ',' + k + ',' + k + ',0.7)'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 6), randf(1, 6)); } for (var j = 0; j < 12; j++) { var r = randf(10, 50), x = Math.random() * w, y = Math.random() * h, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + Math.floor(v - amp * 120) + ',' + Math.floor(v - amp * 120) + ',' + Math.floor(v - amp * 120) + ',0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } }, rx, ry); t.encoding = THREE.LinearEncoding; return t; }
  var RGH = { floor: roughTex(256, 256, 0.9, 0.25, 5, 3.5), paint: roughTex(256, 256, 0.45, 0.35, 1, 1), metal: roughTex(256, 256, 0.5, 0.3, 1, 1) };

  // ── Materials ─────────────────────────────────────────────────────
  var std = function (o) { return new THREE.MeshStandardMaterial(o); };
  var MAT = {
    floor: std({ map: TEX.concrete, roughness: 0.92, metalness: 0.03, normalMap: NRM.concrete, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: RGH.floor }),
    yard: std({ map: TEX.asphalt, roughness: 0.95, normalMap: NRM.asphalt, normalScale: new THREE.Vector2(0.6, 0.6) }),
    grass: std({ map: TEX.grass, roughness: 1 }),
    wall: std({ map: TEX.corrugated, roughness: 0.55, metalness: 0.4, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(1, 1), roughnessMap: RGH.metal }),
    wallIn: std({ map: TEX.corrugated, roughness: 0.65, metalness: 0.3, color: 0xcfd6dd, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(1, 1) }),
    roof: std({ color: 0x3b4249, roughness: 0.9 }),
    roofIn: std({ color: 0x5c6670, roughness: 0.9 }),   // the plane is turned to face down, so its front is what you see from the floor
    door: std({ map: TEX.corrugatedDoor, roughness: 0.55, metalness: 0.4, normalMap: NRM.ribs, normalScale: new THREE.Vector2(1, 1) }),
    plaster: std({ map: TEX.plaster, roughness: 0.9, normalMap: NRM.plaster, normalScale: new THREE.Vector2(0.4, 0.4) }),
    brick: std({ map: TEX.brick, roughness: 0.95, normalMap: NRM.brick, normalScale: new THREE.Vector2(0.9, 0.9) }),
    block: std({ map: TEX.block, roughness: 0.9, normalMap: NRM.block, normalScale: new THREE.Vector2(0.8, 0.8) }),
    carpet: std({ map: TEX.carpet, roughness: 1, normalMap: NRM.carpet, normalScale: new THREE.Vector2(0.4, 0.4) }),
    vinyl: std({ map: TEX.vinyl, roughness: 0.45, metalness: 0.02 }),
    gunmetal: std({ color: 0x4a5058, roughness: 0.38, metalness: 0.85, map: TEX.noiseMetal }),
    rack: std({ color: 0xcf6417, roughness: 0.55, metalness: 0.3, roughnessMap: RGH.paint }),
    beam: std({ color: 0x2b5aa6, roughness: 0.5, metalness: 0.4 }),
    deck: std({ color: 0x6a737c, roughness: 0.7, metalness: 0.5 }),
    wood: std({ map: TEX.wood, roughness: 0.85, normalMap: NRM.wood, normalScale: new THREE.Vector2(0.6, 0.6) }),
    parcel: std({ map: TEX.parcel, roughness: 0.9, normalMap: NRM.cardboard, normalScale: new THREE.Vector2(0.5, 0.5) }),
    returned: std({ map: TEX.returned, roughness: 0.9, normalMap: NRM.cardboard, normalScale: new THREE.Vector2(0.5, 0.5) }),
    crate: std({ map: TEX.crate, roughness: 0.85, normalMap: NRM.wood, normalScale: new THREE.Vector2(0.5, 0.5) }),
    strapped: std({ map: TEX.strapped, roughness: 0.9, normalMap: NRM.cardboard, normalScale: new THREE.Vector2(0.5, 0.5) }),
    airbox: std({ map: TEX.airbox, roughness: 0.6 }),
    steel: std({ map: TEX.noiseMetal, roughness: 0.45, metalness: 0.6 }),
    steelDark: std({ color: 0x3a3f45, roughness: 0.5, metalness: 0.6 }),
    chrome: std({ color: 0xd8dde3, roughness: 0.18, metalness: 0.95 }),
    black: std({ color: 0x15171a, roughness: 0.8 }),
    plastic: std({ color: 0x2a2d33, roughness: 0.6 }),
    rubber: std({ color: 0x1d1f22, roughness: 0.95 }),
    rubberMat: std({ map: TEX.rubberMat, roughness: 0.95, normalMap: NRM.rubber, normalScale: new THREE.Vector2(0.8, 0.8) }),
    chequer: std({ color: 0x8e959c, roughness: 0.45, metalness: 0.7, normalMap: NRM.chequer, normalScale: new THREE.Vector2(1, 1) }),
    yellow: std({ color: 0xf5b53d, roughness: 0.6 }),
    yellowLine: new THREE.MeshBasicMaterial({ color: 0xd9a12c }),
    whiteLine: new THREE.MeshBasicMaterial({ color: 0xd8dbdf }),
    hazard: std({ map: TEX.hazard, roughness: 0.6 }),
    mesh: std({ map: TEX.mesh, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 }),
    red: std({ color: 0xc8342a, roughness: 0.6 }),
    green: std({ color: 0x2f9e44, roughness: 0.6 }),
    blue: std({ color: 0x2f6fb3, roughness: 0.6 }),
    white: std({ color: 0xf0f0f0, roughness: 0.6 }),
    grey: std({ color: 0x8c949c, roughness: 0.7 }),
    trim: std({ color: 0xf2efe6, roughness: 0.8 }),
    paper: std({ map: TEX.paper, roughness: 0.95 }),
    cork: std({ map: TEX.cork, roughness: 0.95 }),
    fabric: std({ map: TEX.fabric, roughness: 1 }),
    screen: new THREE.MeshBasicMaterial({ color: 0x0d1216 }),
    screenGlass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false }),
    skylight: new THREE.MeshBasicMaterial({ map: TEX.skylight }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff6e4 }),
    exit: new THREE.MeshBasicMaterial({ color: 0x5fd38d }),
    glass: std({ color: 0xa9c7e8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.3 }),
    forkYellow: new THREE.MeshPhysicalMaterial({ color: 0xf2b705, roughness: 0.42, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.25, roughnessMap: RGH.paint }),
    truckRed: new THREE.MeshPhysicalMaterial({ color: 0xb8322a, roughness: 0.4, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2, roughnessMap: RGH.paint }),
    truckBlue: new THREE.MeshPhysicalMaterial({ color: 0x2c5f9e, roughness: 0.4, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2, roughnessMap: RGH.paint }),
    trailer: std({ map: TEX.corrugated, color: 0xf0f2f4, roughness: 0.55, metalness: 0.25, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(0.8, 0.8) }),
    container: std({ map: TEX.corrugated, color: 0x1f4e79, roughness: 0.6, metalness: 0.3, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(1.0, 1.0) }),   // a sea truck's box
    trailerIn: std({ color: 0x9aa0a6, roughness: 0.8, side: THREE.BackSide }),
    skin: std({ color: 0xd9a98a, roughness: 0.8 }),
    hivis: std({ color: 0xf6c21b, roughness: 0.8 }),
    hivisOrange: std({ color: 0xf07a1a, roughness: 0.8 }),
    jeans: std({ color: 0x2e3f63, roughness: 0.95 }),
    hair: std({ color: 0x3a2a1c, roughness: 0.95 }),
    hit: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  };
  function glowMat(col, k) { var m = std({ color: 0x111111, emissive: col, emissiveIntensity: k || 1, roughness: 0.4 }); m.userData.glow = true; return m; }
  var CARD = {}; SKUS.forEach(function (s) { CARD[s.id] = std({ map: cardboardTex(s.col, s.name), roughness: 0.9, normalMap: NRM.cardboard, normalScale: new THREE.Vector2(0.45, 0.45) }); });
  // the environment map is for reflections only: every lit material takes very little light from it
  function dimEnv(m) { if (m && m.isMeshStandardMaterial) m.envMapIntensity = m.isMeshPhysicalMaterial ? 0.45 : (m.metalness > 0.5 ? 0.4 : 0.22); return m; }
  Object.keys(MAT).forEach(function (k) { dimEnv(MAT[k]); }); Object.keys(CARD).forEach(function (k) { dimEnv(CARD[k]); });
  var std0 = std; std = function (o) { return dimEnv(std0(o)); };
  // a ceiling tile for the rooms, and a plain lining for the inside of a trailer
  TEX.tile = tex(256, 256, function (c, w, h) { c.fillStyle = '#e9e9e4'; c.fillRect(0, 0, w, h); grain(c, w, h, 3000, 0.05, true); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); }, 6, 4);
  TEX.lining = tex(256, 256, function (c, w, h) { c.fillStyle = '#c9cdd1'; c.fillRect(0, 0, w, h); grain(c, w, h, 2500, 0.08); for (var y = 0; y < h; y += 64) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, y, w, 3); } for (var i = 0; i < 24; i++) { c.fillStyle = 'rgba(0,0,0,' + randf(0.05, 0.18) + ')'; c.fillRect(Math.random() * w, Math.random() * h, randf(10, 40), randf(2, 6)); } }, 6, 2);
  MAT.tile = std({ map: TEX.tile, roughness: 0.95 }); MAT.lining = std({ map: TEX.lining, roughness: 0.8, metalness: 0.15 }); MAT.trailerIn = MAT.lining;

  // ── Geometry helpers ──────────────────────────────────────────────
  var geoCache = {};
  function boxGeo(w, h, d) { var k = w + ',' + h + ',' + d; return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d)); }
  // A box with every edge eased: a dead sharp edge catches no light and reads as cardboard. The rows of vertices nearest each edge
  // are moved onto an arc, spaced so the corner turns in equal angles, and the normals follow; the texture keeps its scale (the
  // picture did not move, only the rows). Thinner than 30 mm or longer than 4 m stays sharp unless a radius is asked for.
  var BEVEL = { max: 0.012, faces: [['z', 'y', -1, -1], ['z', 'y', 1, -1], ['x', 'z', 1, 1], ['x', 'z', 1, -1], ['x', 'y', 1, -1], ['x', 'y', -1, -1]] };
  function bevelGeo(w, h, d, r, k) {
    var mn = Math.min(w, h, d), mx = Math.max(w, h, d);
    if (r === undefined) r = (mn < 0.03 || mx > 4) ? 0 : Math.min(BEVEL.max, mn * 0.22);
    if (!(r > 0) || !(mn > 0)) return boxGeo(w, h, d);
    r = Math.min(r, mn * 0.499); k = Math.max(1, Math.round(k || (r > 0.03 ? 3 : r > 0.015 ? 2 : 1)));   /* a big radius needs more than one step to read as round */
    var key = 'b' + w + ',' + h + ',' + d + ',' + r + ',' + k; if (geoCache[key]) return geoCache[key];
    var n = 2 * k + 1, per = (n + 1) * (n + 1), g = new THREE.BoxGeometry(w, h, d, n, n, n), pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, half = { x: w / 2, y: h / 2, z: d / 2 }, v = new THREE.Vector3(), c = new THREE.Vector3();
    function ax(p, hf) { var i = Math.round((p + hf) / (2 * hf) * n); return i <= k ? -hf + r - r * Math.tan((k - i) / k * Math.PI / 4) : hf - r + r * Math.tan((i - (n - k)) / k * Math.PI / 4); }
    for (var i = 0; i < pos.count; i++) {
      v.set(ax(pos.getX(i), half.x), ax(pos.getY(i), half.y), ax(pos.getZ(i), half.z));
      var fc = BEVEL.faces[Math.floor(i / per)]; uv.setXY(i, (v[fc[0]] * fc[2] + half[fc[0]]) / (2 * half[fc[0]]), 1 - (v[fc[1]] * fc[3] + half[fc[1]]) / (2 * half[fc[1]]));
      c.set(clamp(v.x, -half.x + r, half.x - r), clamp(v.y, -half.y + r, half.y - r), clamp(v.z, -half.z + r, half.z - r));
      v.sub(c); if (v.lengthSq() > 1e-12) { v.normalize(); nor.setXYZ(i, v.x, v.y, v.z); pos.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r); }
    }
    return (geoCache[key] = g);
  }
  // a body part cut from an eased box: narrower at one end than the other, the way a chest runs down to a waist. Give it a fresh geometry.
  function taperGeo(g, h, sx0, sz0) { var p = g.attributes.position; for (var i = 0; i < p.count; i++) { var t = clamp((p.getY(i) + h / 2) / h, 0, 1); p.setX(i, p.getX(i) * lerp(sx0, 1, t)); p.setZ(i, p.getZ(i) * lerp(sz0, 1, t)); } g.computeVertexNormals(); return g; }
  // The same for anything turned: a cylinder's rims are eased and it gets enough sides to read as round. Wires and rods are left alone.
  function roundCylGeo(rt, rb, h, seg) {
    var rmax = Math.max(rt, rb), rmin = Math.min(rt, rb), r = (rmax < 0.025 || h < 0.02) ? 0 : Math.min(BEVEL.max, h * 0.22, rmin * 0.3);
    seg = seg || 18; if (rmax >= 0.025) seg = Math.max(seg, rmax > 0.12 ? 32 : rmax > 0.05 ? 24 : 16);
    var key = 'c' + rt + ',' + rb + ',' + h + ',' + seg; if (geoCache[key]) return geoCache[key];
    if (!(r > 0.0012)) return (geoCache[key] = new THREE.CylinderGeometry(rt, rb, h, seg));
    var g = new THREE.CylinderGeometry(rt, rb, h, seg, 3), pos = g.attributes.position, nor = g.attributes.normal, row = seg + 1, torso = 4 * row, slope = (rb - rt) / h;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), top = pos.getY(i) > 0, len = Math.hypot(x, z) || 1, ux = x / len, uz = z / len, rad, y;
      if (i < torso) {
        var rw = Math.floor(i / row);
        if (rw === 0) { rad = rt - r; y = h / 2; } else if (rw === 1) { rad = rt + slope * r; y = h / 2 - r; } else if (rw === 2) { rad = rb - slope * r; y = -h / 2 + r; } else { rad = rb - r; y = -h / 2; }
        if (rw === 0 || rw === 3) { var ny = rw === 0 ? 0.7071 : -0.7071; nor.setXYZ(i, nor.getX(i) * 0.7071, ny, nor.getZ(i) * 0.7071); var nl = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)) || 1; nor.setXYZ(i, nor.getX(i) / nl, nor.getY(i) / nl, nor.getZ(i) / nl); }
        pos.setXYZ(i, ux * rad, y, uz * rad);
      } else if (len > 1e-6) { rad = (top ? rt : rb) - r; pos.setXYZ(i, ux * rad, pos.getY(i), uz * rad); }
    }
    return (geoCache[key] = g);
  }
  function box(w, h, d, mat, x, y, z, parent) {
    var m = new THREE.Mesh(mat.map ? boxGeo(w, h, d) : bevelGeo(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m;
  }
  function plane(w, h, mat, x, y, z, rx, ry, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.x = rx || 0; m.rotation.y = ry || 0; m.receiveShadow = true; (parent || scene).add(m); return m;
  }
  function cyl(r, h, mat, x, y, z, parent, seg, rb) { var m = new THREE.Mesh(roundCylGeo(r, rb === undefined ? r : rb, h, seg || 12), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || scene).add(m); return m; }
  function sphere(r, mat, x, y, z, parent) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); m.position.set(x, y, z); m.castShadow = true; (parent || scene).add(m); return m; }
  function sign(lines, w, h, x, y, z, ry, opt, parent) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(lines, opt) })); m.position.set(x, y, z); m.rotation.y = ry || 0; (parent || scene).add(m);
    // an enamelled plate is fixed to something: a sheet of dark metal a little bigger than the print behind it, and on a plate
    // big enough, four studs through the corners. Hung on the sign's own mesh, so whatever moves the sign moves its plate.
    if (isPlate(opt) && !(opt && opt.flat)) { var pl = new THREE.Mesh(bevelGeo(w + 0.03, h + 0.03, 0.014, 0.004), MAT.gunmetal); pl.position.z = -0.0085; pl.castShadow = true; m.add(pl); if (w >= 0.5 && h >= 0.12) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { var st = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 10), MAT.chrome); st.rotation.x = Math.PI / 2; st.position.set(s[0] * (w / 2 - 0.028), s[1] * (h / 2 - 0.028), 0.003); m.add(st); }); }
    return m;
  }
  function poster(kind, w, h, x, y, z, ry, parent) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: posterTex(kind), roughness: 0.95 })); m.position.set(x, y, z); m.rotation.y = ry || 0; (parent || scene).add(m); return m; }
  // a soft dark blob on the ground under anything that stands on it: the contact shadow the sun map cannot give
  var blobTex = tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  var blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 1 }); blobMat.userData.noBake = true;
  function groundBlob(w, d, x, z, parent, y) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blobMat); m.rotation.x = -Math.PI / 2; m.position.set(x, (y || 0) + 0.006, z); m.renderOrder = 1; m.receiveShadow = false; m.userData.noBake = true; (parent || scene).add(m); return m; }
  // things the player can look at and press E on
  var inter = [];
  function addInter(mesh, def) { mesh.userData.it = def; inter.push(mesh); return mesh; }
  function hitBox(w, h, d, x, y, z, def, parent) { var m = new THREE.Mesh(boxGeo(w, h, d), MAT.hit); m.position.set(x, y, z); (parent || scene).add(m); return addInter(m, def); }
  // things the player cannot walk through: axis-aligned boxes in world space
  var solids = [], dyn = [];
  function solid(x0, x1, z0, z1, y0, y1) { solids.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: y0 === undefined ? -5 : y0, y1: y1 === undefined ? 9 : y1 }); }
  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  // things that move every frame: { update: function (dt) }
  var animated = [];
  function animate(fn) { animated.push(fn); }
  // a short-lived burst of particles: sparks, dust, water, cardboard chips
  var bursts = [];
  function burst(x, y, z, col, n, mode) {
    n = n || 20; var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (var i = 0; i < n; i++) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; var a = Math.random() * 6.28, s = randf(0.6, 2.2); vel.push({ x: Math.cos(a) * s * (mode === 'up' ? 0.3 : 1), y: mode === 'up' ? randf(1.5, 3) : mode === 'down' ? -randf(0.5, 1.5) : randf(0.5, 2.5), z: Math.sin(a) * s * (mode === 'up' ? 0.3 : 1) }); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({ color: col, size: mode === 'smoke' ? 0.12 : 0.05, transparent: true, opacity: 0.9, depthWrite: false });
    var pts = new THREE.Points(geo, mat); scene.add(pts);
    bursts.push({ pts: pts, vel: vel, t: 0, life: mode === 'smoke' ? 2.4 : 1.1, mode: mode });
  }
  function tickBursts(dt) {
    for (var i = bursts.length - 1; i >= 0; i--) {
      var b = bursts[i]; b.t += dt; var p = b.pts.geometry.attributes.position.array;
      for (var k = 0; k < b.vel.length; k++) { var v = b.vel[k]; if (b.mode !== 'smoke') v.y -= 6 * dt; else v.y += 0.4 * dt; p[k * 3] += v.x * dt; p[k * 3 + 1] += v.y * dt; p[k * 3 + 2] += v.z * dt; if (p[k * 3 + 1] < 0.02 && b.mode !== 'smoke') { p[k * 3 + 1] = 0.02; v.y = -v.y * 0.4; v.x *= 0.6; v.z *= 0.6; } }
      b.pts.geometry.attributes.position.needsUpdate = true; b.pts.material.opacity = 0.9 * (1 - b.t / b.life);
      if (b.t >= b.life) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
    }
  }
