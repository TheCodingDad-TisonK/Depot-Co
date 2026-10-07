//@ people: the rig, procedural faces, variety, walking and idling, speech bubbles, the aisle router, the three staff roles and their voices
  // ── The human model ───────────────────────────────────────────────
  // A rigged person: hip and knee pivots, shoulder and elbow pivots, a torso that rolls with the stride and a head that turns to
  // look at you. Every limb is an eased cylinder, the shoes have soles and laces, the shirt has a collar, buttons, a pocket and a
  // belt, the hair is a cap with a fringe, sideburns and a nape (or long, or a bun), and the face is a 256 px decal that blinks.
  // Built at Grow Co.'s proportions and scaled to 1.8 m, so the hit boxes, speech bubbles and the camera that were set for the
  // old figure still fit. The API is the old one: makeHuman(opt), animateHuman(g, dt, mode, speed, look, carry), setMood, say.
  var SKINS = [0xf1d2b6, 0xe2b48f, 0xd9a98a, 0xb87b5a, 0x8d5a3c, 0x5c3a28];
  var HAIRS = [0x1d1510, 0x3a2a1c, 0x6b4a2b, 0xa8793f, 0xd9b36a, 0x8a8a8a, 0xb0352a, 0x2b2b35];
  var SHIRTS = [0x8c949c, 0x3b4b6b, 0x7b3f3f, 0x2f6f4f, 0xd9d9d9, 0x5a4b7b, 0x8a6a3a, 0x335b7b, 0x2a2d33];
  var PANTS = [0x2e3f63, 0x3a3a3a, 0x5b4b3a, 0x1f2a44, 0x6b6b6b];
  var EYES = ['#3a5a8a', '#4a3221', '#2a6a3a', '#5a4a2a', '#6a7a8a'];
  var faceCache = {};
  // what a face key decides, the same every time that key is drawn: eye colour, brow weight, freckles
  function faceSpec(key) { var n = 0; for (var i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0; return { eye: EYES[n % EYES.length], freckles: n % 5 === 0, brow: n % 3 === 0 ? '#1a1008' : '#2a1a10', thin: n % 4 === 1 }; }
  function faceTex(key, mood, skin, blink) {
    var k = key + mood + (blink ? 'b' : ''); if (faceCache[k]) return faceCache[k];
    var sp = faceSpec(key);
    var t = tex(256, 256, function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      var eyeY = 112, iris = sp.eye, closed = blink || mood === 'tired', squint = mood === 'happy' ? 12 : mood === 'angry' ? 12.5 : 15;
      [84, 172].forEach(function (x, i) {
        var sd = i ? 1 : -1, px = x + (mood === 'shifty' ? 8 : 0);
        if (closed) { ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 21, eyeY + 1); ctx.quadraticCurveTo(x, eyeY + 9, x + 21, eyeY + 1); ctx.stroke(); return; }
        ctx.save(); ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#fbf8f2'; ctx.fillRect(x - 24, eyeY - 18, 48, 36);
        var ig = ctx.createRadialGradient(px, eyeY + 1, 2, px, eyeY + 1, 11); ig.addColorStop(0, iris); ig.addColorStop(0.75, iris); ig.addColorStop(1, 'rgba(10,15,25,.9)'); ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(px, eyeY + 1, 10.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(px, eyeY + 1, 4.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(px + 4, eyeY - 4, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(px - 4, eyeY + 5, 1.6, 0, Math.PI * 2); ctx.fill();
        var lid = ctx.createLinearGradient(0, eyeY - squint, 0, eyeY - squint + 12); lid.addColorStop(0, 'rgba(40,20,10,.5)'); lid.addColorStop(1, 'rgba(40,20,10,0)'); ctx.fillStyle = lid; ctx.fillRect(x - 24, eyeY - squint, 48, 12);   /* the lid's shadow on the eye */
        ctx.restore();
        ctx.strokeStyle = '#2f2019'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(60,35,25,.45)'; ctx.beginPath(); ctx.ellipse(x, eyeY, 22, squint, 0, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#2f2019'; ctx.beginPath(); ctx.moveTo(x + sd * 21, eyeY - 3); ctx.lineTo(x + sd * 27, eyeY - 8); ctx.stroke();   /* one lash at the outer corner */
      });
      // brows: thick at the nose, fine at the temple; they tilt with the mood
      ctx.fillStyle = sp.brow; var tilt = mood === 'angry' ? 12 : mood === 'tired' ? -6 : mood === 'happy' ? -3 : 0, bt = sp.thin ? 0.6 : 1;
      [[58, 110], [198, 146]].forEach(function (b) { ctx.beginPath(); ctx.moveTo(b[0], 84 - tilt + 2); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 72, b[1], 84 + tilt - 4 * bt); ctx.lineTo(b[1], 84 + tilt + 5 * bt); ctx.quadraticCurveTo((b[0] + b[1]) / 2, 80, b[0], 84 - tilt + 4); ctx.closePath(); ctx.fill(); });
      // the nose is modelled: only the shadow under its tip is drawn
      ctx.fillStyle = 'rgba(70,35,20,.22)'; ctx.beginPath(); ctx.ellipse(128, 166, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a4536'; ctx.lineCap = 'round'; ctx.lineWidth = 4.5; ctx.beginPath();
      if (mood === 'happy') { ctx.fillStyle = '#4a1a1a'; ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.quadraticCurveTo(128, 194, 96, 186); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(102, 188.5); ctx.quadraticCurveTo(128, 196, 154, 188.5); ctx.quadraticCurveTo(128, 203, 102, 188.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(96, 186); ctx.quadraticCurveTo(128, 216, 160, 186); ctx.stroke(); }
      else if (mood === 'tired') { ctx.moveTo(100, 198); ctx.quadraticCurveTo(128, 186, 156, 198); ctx.stroke(); }
      else if (mood === 'angry') { ctx.moveTo(100, 196); ctx.quadraticCurveTo(128, 186, 156, 192); ctx.stroke(); }
      else if (mood === 'talk') { ctx.fillStyle = '#3a1a1a'; ctx.beginPath(); ctx.ellipse(128, 194, 16, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c0605a'; ctx.beginPath(); ctx.ellipse(128, 200, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.moveTo(104, 192); ctx.quadraticCurveTo(128, 199, 152, 192); ctx.stroke(); }
      if (mood !== 'talk' && mood !== 'happy') { ctx.strokeStyle = 'rgba(90,40,30,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(114, 205); ctx.quadraticCurveTo(128, 210, 142, 205); ctx.stroke(); }   /* the shade under the lower lip */
      ctx.fillStyle = 'rgba(255,110,110,' + (mood === 'happy' ? 0.26 : 0.12) + ')'; [62, 194].forEach(function (x) { var bl = ctx.createRadialGradient(x, 152, 2, x, 152, 22); bl.addColorStop(0, ctx.fillStyle); bl.addColorStop(1, 'rgba(255,110,110,0)'); ctx.save(); ctx.fillStyle = bl; ctx.beginPath(); ctx.arc(x, 152, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
      if (sp.freckles) { ctx.fillStyle = 'rgba(120,70,40,.5)'; for (var f = 0; f < 22; f++) { ctx.beginPath(); ctx.arc(60 + Math.random() * 136, 136 + Math.random() * 30, 1.6, 0, Math.PI * 2); ctx.fill(); } }
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; faceCache[k] = t; return t;
  }
  var HUMAN_GEO = {
    thigh: roundCylGeo(0.088, 0.068, 0.42, 18), shin: roundCylGeo(0.064, 0.046, 0.4, 18), knee: new THREE.SphereGeometry(0.068, 14, 10),
    shoe: bevelGeo(0.12, 0.085, 0.27, 0.036, 3), sole: bevelGeo(0.128, 0.03, 0.285, 0.012, 1), lace: bevelGeo(0.1, 0.02, 0.06, 0.006, 1),
    hips: bevelGeo(0.36, 0.18, 0.22, 0.08, 3), torso: taperGeo(bevelGeo(0.4, 0.5, 0.24, 0.1, 3).clone(), 0.5, 0.86, 0.9), chest: bevelGeo(0.44, 0.26, 0.26, 0.11, 3),
    belt: bevelGeo(0.38, 0.05, 0.24, 0.012, 1), buckle: bevelGeo(0.05, 0.04, 0.02, 0.005, 1), placket: bevelGeo(0.12, 0.05, 0.03, 0.008, 1), button: roundCylGeo(0.008, 0.008, 0.006, 8), pocket: bevelGeo(0.1, 0.1, 0.005, 0.002, 1),
    upperArm: roundCylGeo(0.054, 0.044, 0.3, 14), foreArm: roundCylGeo(0.044, 0.034, 0.3, 14), elbow: new THREE.SphereGeometry(0.047, 12, 10), shoulder: new THREE.SphereGeometry(0.072, 14, 10),
    hand: bevelGeo(0.075, 0.1, 0.036, 0.016, 2), thumb: roundCylGeo(0.012, 0.012, 0.05, 8), cuff: roundCylGeo(0.043, 0.04, 0.035, 14), hem: roundCylGeo(0.058, 0.056, 0.04, 16), collar: bevelGeo(0.085, 0.036, 0.012, 0.004, 1),
    neck: roundCylGeo(0.05, 0.062, 0.1, 14), head: new THREE.SphereGeometry(0.17, 28, 20), ear: new THREE.SphereGeometry(0.03, 10, 8), nose: new THREE.SphereGeometry(0.021, 12, 10),
    hairCap: new THREE.SphereGeometry(0.17, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hairLong: new THREE.SphereGeometry(0.17, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    vest: bevelGeo(0.47, 0.5, 0.29, 0.06, 3), band: bevelGeo(0.48, 0.04, 0.3, 0.012, 1), strap: bevelGeo(0.05, 0.28, 0.3, 0.012, 1),
    peak: bevelGeo(0.2, 0.015, 0.14, 0.005, 1)
  };
  // a beard follows the jaw and the chin and leaves the mouth alone; long hair falls behind the shoulders as one sheet
  HUMAN_GEO.beard = new THREE.SphereGeometry(0.17, 20, 8, -Math.PI * 0.1, Math.PI * 1.2, Math.PI * 0.7, Math.PI * 0.3); HUMAN_GEO.beard.scale(1.035, 1.15, 0.985);
  HUMAN_GEO.hairFall = new THREE.CylinderGeometry(0.178, 0.205, 0.4, 22, 3, true, Math.PI * 0.42, Math.PI * 1.16);
  HUMAN_GEO.ear.scale(0.5, 1.15, 0.85); HUMAN_GEO.nose.scale(0.82, 1.3, 1.05); HUMAN_GEO.head.scale(1, 1.12, 0.95);
  HUMAN_GEO.hairCap.scale(1.07, 1.2, 1.02); HUMAN_GEO.hairLong.scale(1.08, 1.21, 1.04);
  // curved patches that follow the skull: fringe over the forehead, sideburns, nape
  HUMAN_GEO.fringe = new THREE.SphereGeometry(0.17, 20, 8, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.2); HUMAN_GEO.fringe.scale(1.075, 1.205, 1.03);
  HUMAN_GEO.sideL = new THREE.SphereGeometry(0.17, 12, 8, Math.PI * 1.88, Math.PI * 0.24, Math.PI * 0.4, Math.PI * 0.22); HUMAN_GEO.sideL.scale(1.075, 1.205, 1.03);
  HUMAN_GEO.sideR = new THREE.SphereGeometry(0.17, 12, 8, Math.PI * 0.88, Math.PI * 0.24, Math.PI * 0.4, Math.PI * 0.22); HUMAN_GEO.sideR.scale(1.075, 1.205, 1.03);
  HUMAN_GEO.nape = new THREE.SphereGeometry(0.17, 16, 8, Math.PI * 1.2, Math.PI * 0.6, Math.PI * 0.4, Math.PI * 0.3); HUMAN_GEO.nape.scale(1.075, 1.205, 1.03);
  var HUMAN_SCALE = 0.93, BAND_M = std({ color: 0xc9ced3, roughness: 0.3, metalness: 0.4, emissive: 0x666666, emissiveIntensity: 0.25 }), LACE_M = std({ color: 0xf2f2f2, roughness: 0.9 }), BELT_M = std({ color: 0x3a2a1a, roughness: 0.5 }), SOLE_M = std({ color: 0xd8d4cc, roughness: 0.9 });
  function makeHuman(opt) {
    opt = opt || {};
    var skinCol = opt.skin || pick(SKINS), hairCol = opt.hair || pick(HAIRS), style = opt.style || pick(['short', 'short', 'long', 'bun', 'bald', 'cap']);
    var skin = std({ color: skinCol, roughness: 0.75 }), shirt = opt.shirt || std({ map: TEX.cloth, color: pick(SHIRTS), roughness: 0.92 }), pants = std({ map: TEX.cloth, color: pick(PANTS), roughness: 0.95 }), hair = std({ color: hairCol, roughness: 0.62 }), hairSide = hair.clone(); hairSide.side = THREE.DoubleSide;
    var shoeM = std({ color: pick([0x1e1a18, 0x3a2a1a, 0x4a3a2a, 0x2f2f33]), roughness: 0.6 }), shirtDark = shirt.clone(); if (shirtDark.color) shirtDark.color.multiplyScalar(0.85);
    var rolled = opt.rolled !== undefined ? !!opt.rolled : Math.random() < 0.4;
    var g = new THREE.Group(), u = g.userData; u.dynamic = true;
    u.key = 'f' + Math.floor(Math.random() * 100000); u.mood = opt.mood || 'neutral'; u.blink = 0; u.blinkIn = randf(2, 6); u.walk = 0; u.idleT = Math.random() * 10; u.lookYaw = 0; u.lookPitch = 0; u.skinKey = skinCol.toString(16); u.phase = Math.random() * 6.28;
    g.scale.setScalar(HUMAN_SCALE);
    function mesh(geo, mat, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; }
    // legs: hip pivot, thigh, knee pivot, shin, shoe on its sole
    function leg(side) {
      var hip = new THREE.Group(); hip.position.set(side * 0.1, 0.86, 0); g.add(hip);
      mesh(HUMAN_GEO.thigh, pants, 0, -0.21, 0, hip);
      var knee = new THREE.Group(); knee.position.set(0, -0.42, 0); hip.add(knee); hip.userData.knee = knee;
      mesh(HUMAN_GEO.knee, pants, 0, 0, 0, knee); mesh(HUMAN_GEO.shin, pants, 0, -0.2, 0, knee);
      mesh(HUMAN_GEO.shoe, shoeM, 0, -0.4, 0.05, knee); mesh(HUMAN_GEO.sole, SOLE_M, 0, -0.445, 0.05, knee); mesh(HUMAN_GEO.hem, pants, 0, -0.35, 0, knee); mesh(HUMAN_GEO.lace, LACE_M, 0, -0.36, 0.12, knee);
      return hip;
    }
    u.legs = [leg(-1), leg(1)];
    // torso: hips block, belt and buckle, shirt torso and chest, collar, placket, buttons, a pocket
    var torso = new THREE.Group(); torso.position.y = 0.86; g.add(torso); u.torso = torso;
    mesh(HUMAN_GEO.hips, pants, 0, 0.02, 0, torso); mesh(HUMAN_GEO.belt, BELT_M, 0, 0.1, 0, torso); mesh(HUMAN_GEO.buckle, MAT.chrome, 0, 0.1, 0.125, torso);
    mesh(HUMAN_GEO.torso, shirt, 0, 0.36, 0, torso); u.chest = mesh(HUMAN_GEO.chest, shirt, 0, 0.52, 0, torso);
    [-1, 1].forEach(function (sd) { var cl = mesh(HUMAN_GEO.collar, shirt, sd * 0.05, 0.648, 0.118, torso); cl.rotation.set(-0.35, sd * -0.25, sd * -0.62); });
    mesh(HUMAN_GEO.placket, shirt, 0, 0.62, 0.13, torso); for (var b = 0; b < 4; b++) mesh(HUMAN_GEO.button, LACE_M, 0, 0.2 + b * 0.11, 0.125, torso).rotation.x = Math.PI / 2; mesh(HUMAN_GEO.pocket, shirtDark, -0.11, 0.48, 0.125, torso);
    // the hi-vis vest over the shirt: two reflective bands round it and one over each shoulder
    if (opt.vest) { mesh(HUMAN_GEO.vest, opt.vest, 0, 0.33, 0, torso); mesh(HUMAN_GEO.band, BAND_M, 0, 0.22, 0, torso); mesh(HUMAN_GEO.band, BAND_M, 0, 0.38, 0, torso); mesh(HUMAN_GEO.strap, BAND_M, -0.15, 0.5, 0, torso); mesh(HUMAN_GEO.strap, BAND_M, 0.15, 0.5, 0, torso); }
    if (opt.name) { var tag = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), new THREE.MeshBasicMaterial({ map: textTex([opt.name], { w: 128, h: 48, bg: '#fff', fg: '#1b232c' }) })); tag.position.set(0.1, 0.46, opt.vest ? 0.152 : 0.132); torso.add(tag); }
    // arms: shoulder pivot, upper arm, elbow pivot, forearm, a cuff unless the sleeves are rolled, a hand with its thumb
    function arm(side) {
      var sh = new THREE.Group(); sh.position.set(side * 0.27, 0.6, 0); torso.add(sh);
      mesh(HUMAN_GEO.shoulder, shirt, 0, 0, 0, sh); mesh(HUMAN_GEO.upperArm, shirt, 0, -0.16, 0, sh);
      var el = new THREE.Group(); el.position.set(0, -0.31, 0); sh.add(el); sh.userData.elbow = el;
      mesh(HUMAN_GEO.elbow, shirt, 0, 0, 0, el); mesh(HUMAN_GEO.foreArm, rolled ? skin : shirt, 0, -0.15, 0, el);
      if (!rolled) mesh(HUMAN_GEO.cuff, shirt, 0, -0.285, 0, el); else mesh(HUMAN_GEO.cuff, shirt, 0, -0.03, 0, el);
      mesh(HUMAN_GEO.hand, skin, 0, -0.35, 0, el); var th = mesh(HUMAN_GEO.thumb, skin, side * 0.04, -0.33, 0.01, el); th.rotation.z = side * 0.6;
      return sh;
    }
    u.arms = [arm(-1), arm(1)];
    // head: neck, skull, nose, ears, hair, beard, the face decal, glasses, a cap or a hard hat
    var head = new THREE.Group(); head.position.set(0, 0.66, 0); torso.add(head); u.head = head;
    mesh(HUMAN_GEO.neck, skin, 0, 0.04, 0, head); mesh(HUMAN_GEO.head, skin, 0, 0.24, 0, head); mesh(HUMAN_GEO.nose, skin, 0, 0.222, 0.164, head);
    [-1, 1].forEach(function (s) { mesh(HUMAN_GEO.ear, skin, s * 0.165, 0.24, -0.01, head); });
    var hy = 0.24, capOn = style === 'cap' || !!opt.cap;
    if (style !== 'bald') {
      if (style === 'long') { mesh(HUMAN_GEO.hairLong, hair, 0, hy, 0, head); mesh(HUMAN_GEO.hairFall, hairSide, 0, hy - 0.16, -0.012, head); }
      else { mesh(HUMAN_GEO.hairCap, hair, 0, hy, 0, head); mesh(HUMAN_GEO.nape, hair, 0, hy, 0, head); }
      if (style === 'bun') mesh(new THREE.SphereGeometry(0.075, 12, 10), hair, 0, hy + 0.14, -0.14, head);
      mesh(HUMAN_GEO.fringe, hair, 0, hy, 0, head); mesh(HUMAN_GEO.sideL, hair, 0, hy, 0, head); mesh(HUMAN_GEO.sideR, hair, 0, hy, 0, head);
    }
    if (Math.random() < 0.3 && !opt.noBeard) mesh(HUMAN_GEO.beard, hairSide, 0, hy, 0, head);
    var face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: faceTex(u.key, u.mood, u.skinKey), transparent: true, depthWrite: false })); face.position.set(0, 0.245, 0.17); head.add(face); u.face = face;
    if (Math.random() < 0.22) { var fr = std({ color: 0x222222, roughness: 0.4, metalness: 0.5 }); [-0.06, 0.06].forEach(function (x) { mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 16), fr, x, 0.255, 0.178, head); }); mesh(bevelGeo(0.03, 0.006, 0.006, 0.002, 1), fr, 0, 0.26, 0.178, head); [-1, 1].forEach(function (s) { mesh(bevelGeo(0.006, 0.006, 0.16, 0.002, 1), fr, s * 0.1, 0.255, 0.085, head); }); }
    // hats sit on the brows (the eye line is at 0.26 in the head's frame, the brows at 0.29), never over the eyes
    if (capOn && !opt.hardhat) { var capM = opt.capMat || MAT.blue; mesh(new THREE.SphereGeometry(0.184, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, 0, 0.29, 0, head); var peak = mesh(HUMAN_GEO.peak, capM, 0, 0.3, 0.2, head); peak.rotation.x = 0.15; mesh(new THREE.SphereGeometry(0.02, 8, 6), capM, 0, 0.47, 0, head); }
    if (opt.hardhat) { mesh(new THREE.SphereGeometry(0.19, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), opt.hardhat, 0, 0.3, 0, head); mesh(roundCylGeo(0.212, 0.212, 0.016, 24), opt.hardhat, 0, 0.3, 0.0, head); var pk = mesh(bevelGeo(0.16, 0.012, 0.08, 0.004, 1), opt.hardhat, 0, 0.3, 0.245, head); pk.rotation.x = 0.12; }
    groundBlob(0.9, 0.9, 0, 0, g, 0.002);
    return g;
  }
  function setMood(g, mood) { var u = g.userData; if (u.mood === mood) return; u.mood = mood; u.face.material.map = faceTex(u.key, mood, u.skinKey, u.blink > 0); }
  // mode: 'walk' | 'idle' | 'wait' | 'work'. look: a world point the head turns to, within reason. carry: true holds a box out in front; 'jack' puts both hands down on the grip of a pallet jack pushed ahead; 'tow' trails one arm back to a jack pulled behind.
  // The feet stay planted: the torso rises and falls with the stride and rolls a little, and the head stays level over it.
  function animateHuman(g, dt, mode, speed, look, carry) {
    var u = g.userData; if (!u.legs) return;
    u.idleT += dt;
    if (mode === 'walk') u.walk += dt * (6 + speed * 1.5); else { var ph = u.walk % Math.PI; u.walk += (ph < Math.PI / 2 ? -ph : Math.PI - ph) * Math.min(1, 10 * dt); }
    var t = u.walk, sw = mode === 'walk' ? 0.55 : 0, s = Math.sin(t), L = u.legs[0], R = u.legs[1], lk = L.userData.knee, rk = R.userData.knee, la = u.arms[0], ra = u.arms[1], le = la.userData.elbow, re = ra.userData.elbow, T = u.torso;
    if (mode === 'sit') {   // on the forklift seat: thighs forward, shins down, hands on the wheel
      L.rotation.x = -1.45; R.rotation.x = -1.45; lk.rotation.x = 1.45; rk.rotation.x = 1.45; R.position.y = 0.86; la.rotation.x = -0.5; ra.rotation.x = -0.5; le.rotation.x = -0.15; re.rotation.x = -0.15; la.rotation.z = 0.18; ra.rotation.z = -0.18; T.position.set(0, 0.86, 0); T.rotation.set(0, 0, 0); u.head.rotation.z = 0;
    } else {
    L.rotation.x = s * sw; R.rotation.x = -s * sw;
    lk.rotation.x = Math.max(0, -Math.sin(t - 0.6)) * 1.0 * (sw ? 1 : 0); rk.rotation.x = Math.max(0, Math.sin(t - 0.6)) * 1.0 * (sw ? 1 : 0);
    if (carry === 'jack') { la.rotation.x = -0.8; ra.rotation.x = -0.8; le.rotation.x = -0.25; re.rotation.x = -0.25; la.rotation.z = 0.12; ra.rotation.z = -0.12; }   /* hands 0.53 m ahead at 1.02 m: the grip of a jack pushed at STAFF_JACK.push */
    else if (carry === 'tow') { ra.rotation.x = 0.56; re.rotation.x = 0; ra.rotation.z = -0.15; la.rotation.x = -s * sw * 0.8; le.rotation.x = -Math.max(0, s) * sw * 0.6 - 0.15; la.rotation.z = 0.08; }   /* one arm straight back to the grip 0.35 m behind at 0.85 m, the other swings */
    else if (carry) { la.rotation.x = -0.9; ra.rotation.x = -0.9; le.rotation.x = -0.9; re.rotation.x = -0.9; la.rotation.z = 0.25; ra.rotation.z = -0.25; }
    else if (mode === 'work') { la.rotation.x = -0.6 + Math.sin(u.idleT * 6) * 0.25; ra.rotation.x = -0.6 - Math.sin(u.idleT * 6) * 0.25; le.rotation.x = -0.8; re.rotation.x = -0.8; la.rotation.z = 0.1; ra.rotation.z = -0.1; }
    else { var drift = Math.sin(u.idleT * 1.1) * 0.05; la.rotation.x = -s * sw * 0.8 + drift; ra.rotation.x = s * sw * 0.8 - drift; le.rotation.x = -Math.max(0, s) * sw * 0.6 - 0.15; re.rotation.x = -Math.max(0, -s) * sw * 0.6 - 0.15; la.rotation.z = 0.08 + Math.sin(u.idleT * 0.7) * 0.03; ra.rotation.z = -0.08 - Math.sin(u.idleT * 0.7) * 0.03; }
    if (mode === 'wait') { R.position.y = 0.86 + Math.max(0, Math.sin(u.idleT * 2.4)) * 0.04; } else R.position.y = 0.86;
    if (mode === 'walk') { T.position.y = 0.86 + Math.abs(Math.cos(t)) * 0.03; T.position.x = 0; T.rotation.z = s * 0.03; T.rotation.y = s * 0.06; u.head.rotation.z = -s * 0.025; }
    else { T.position.y = 0.86 + Math.sin(u.idleT * 0.31) * 0.006; T.position.x = Math.sin(u.idleT * 0.31) * 0.007; T.rotation.z = Math.sin(u.idleT * 0.31) * 0.014; T.rotation.y = mode === 'wait' ? Math.sin(u.idleT * 0.35) * 0.12 : lerp(T.rotation.y, 0, Math.min(1, 4 * dt)); u.head.rotation.z = 0; }   /* the weight goes from one foot to the other */
    }
    if (u.chest) u.chest.scale.z = 1 + Math.sin(worldTime * 1.6 + u.phase) * 0.018;   /* breathing */
    g.position.y = u.baseY || 0;
    // the head: looks at what it is given, else drifts; blinks now and then
    var wantYaw = 0, wantPitch = 0;
    if (look) { var dx = look.x - g.position.x, dz = look.z - g.position.z, d = Math.sqrt(dx * dx + dz * dz); if (d < 9) { var a = Math.atan2(dx, dz) - g.rotation.y; while (a > Math.PI) a -= 6.283; while (a < -Math.PI) a += 6.283; wantYaw = clamp(a, -1.3, 1.3); wantPitch = clamp(Math.atan2((look.y || 1.6) - 1.6, d), -0.3, 0.3); } }
    else wantYaw = Math.sin(u.idleT * 0.4) * 0.15;
    u.lookYaw += (wantYaw - u.lookYaw) * Math.min(1, 6 * dt); u.lookPitch += (wantPitch - u.lookPitch) * Math.min(1, 6 * dt);
    u.head.rotation.y = u.lookYaw - (mode === 'walk' ? T.rotation.y : 0); u.head.rotation.x = -u.lookPitch;
    u.blinkIn -= dt; if (u.blinkIn <= 0 && u.blink <= 0) { u.blink = 0.12; u.face.material.map = faceTex(u.key, u.mood, u.skinKey, true); } if (u.blink > 0) { u.blink -= dt; if (u.blink <= 0) { u.blinkIn = randf(2, 6.5); u.face.material.map = faceTex(u.key, u.mood, u.skinKey, false); } }
    if (u.bubble) { u.bubble.t -= dt; if (u.bubble.t <= 0) { g.remove(u.bubble.sp); u.bubble = null; } }
  }
  // a line of speech above the head, for a few seconds
  function say(g, text, col) {
    var u = g.userData; if (!u || !u.head) return;
    if (u.bubble) { g.remove(u.bubble.sp); u.bubble = null; }
    var t = tex(512, 160, function (c, w, h) {
      c.clearRect(0, 0, w, h); c.font = '500 30px "Segoe UI", Arial, sans-serif'; var words = text.split(' '), lines = [], cur = '';
      words.forEach(function (wd) { var tr = cur ? cur + ' ' + wd : wd; if (c.measureText(tr).width > w - 60) { lines.push(cur); cur = wd; } else cur = tr; }); if (cur) lines.push(cur); lines = lines.slice(0, 3);
      var bw = Math.min(w - 20, Math.max.apply(null, lines.map(function (l) { return c.measureText(l).width; })) + 50), bh = lines.length * 36 + 26, bx = (w - bw) / 2, by = h - bh - 18;
      c.fillStyle = 'rgba(16,22,30,0.92)'; c.strokeStyle = col || '#f5b53d'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx + 14, by); c.lineTo(bx + bw - 14, by); c.quadraticCurveTo(bx + bw, by, bx + bw, by + 14); c.lineTo(bx + bw, by + bh - 14); c.quadraticCurveTo(bx + bw, by + bh, bx + bw - 14, by + bh); c.lineTo(w / 2 + 12, by + bh); c.lineTo(w / 2, h - 2); c.lineTo(w / 2 - 12, by + bh); c.lineTo(bx + 14, by + bh); c.quadraticCurveTo(bx, by + bh, bx, by + bh - 14); c.lineTo(bx, by + 14); c.quadraticCurveTo(bx, by, bx + 14, by); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#eef1f5'; c.textAlign = 'center'; c.textBaseline = 'middle'; lines.forEach(function (l, i) { c.fillText(l, w / 2, by + 20 + i * 36 + 4); });
    });
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(1.9, 0.6, 1); sp.position.set(0, 2.15, 0); sp.renderOrder = 5; g.add(sp);
    u.bubble = { sp: sp, t: 2.6 + text.length * 0.03 };
    setMood(g, 'talk'); setTimeout(function () { if (u.mood === 'talk') setMood(g, 'neutral'); }, 900);
  }

  // ── The route finder ──────────────────────────────────────────────
  // A 0.4 m grid over the hall and the dock aprons. A cell is blocked by any static solid (walls, racks, furniture) or,
  // outside the hall, unless it lies inside a docked trailer. Staff carry keys, so hinged doors never block them.
  // A* finds the path, then string-pulling drops every waypoint that a straight line can skip.
  var NAV = { cell: 0.4, x0: -HALL.x - 14, z0: -HALL.z - 42, w: Math.round((2 * HALL.x + 28) / 0.4), h: Math.round((2 * HALL.z + 44) / 0.4), grid: null, dirty: true };   // north to z -66: the annex halls and the wing
  function navBuild() {
    var g = new Uint8Array(NAV.w * NAV.h), c = NAV.cell, pad = 0.3;
    for (var j = 0; j < NAV.h; j++) for (var i = 0; i < NAV.w; i++) {
      var x = NAV.x0 + (i + 0.5) * c, z = NAV.z0 + (j + 0.5) * c, blocked = 0;
      if (!insideWalk(x, z)) blocked = 2;   // outside the halls you own: open only through a docked trailer
      else for (var k = 0; k < solids.length; k++) { var s = solids[k]; if (s.y0 > 1.6) continue; if (x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad) { blocked = 1; break; } }
      g[j * NAV.w + i] = blocked;
    }
    NAV.grid = g; NAV.dirty = false;
  }
  function navOpen(i, j) {
    if (i < 0 || j < 0 || i >= NAV.w || j >= NAV.h) return false;
    var b = NAV.grid[j * NAV.w + i]; if (b === 0) return true; if (b === 1) return false;
    var x = NAV.x0 + (i + 0.5) * NAV.cell, z = NAV.z0 + (j + 0.5) * NAV.cell;
    if (x <= -HALL.x + 0.6 && x > -HALL.x - 7.6 && Math.abs(z - SPOT.staffDoor.z) < 0.8) return true;
    for (var k = 0; k < S.trucks.length; k++) { var t = S.trucks[k]; if (t.state !== 'docked') continue; var tb = trailerBounds(t); if (x > tb.x0 - 0.3 && x < tb.x1 - 0.6 && z > tb.z0 + 0.3 && z < tb.z1 - 0.3) return true; if (Math.abs(z - t.z) < 1.0 && ((t.side < 0 && x < -HALL.x + 0.5 && x > tb.x0) || (t.side > 0 && x > HALL.x - 0.5 && x < tb.x1))) return true; }
    return false;
  }
  function navCell(p) { return { i: clamp(Math.floor((p.x - NAV.x0) / NAV.cell), 0, NAV.w - 1), j: clamp(Math.floor((p.z - NAV.z0) / NAV.cell), 0, NAV.h - 1) }; }
  function navNearestOpen(cl) { if (navOpen(cl.i, cl.j)) return cl; for (var r = 1; r < 8; r++) for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++) if (Math.abs(di) === r || Math.abs(dj) === r) if (navOpen(cl.i + di, cl.j + dj)) return { i: cl.i + di, j: cl.j + dj }; return cl; }
  function navLine(a, b) { var dx = b.x - a.x, dz = b.z - a.z, n = Math.ceil(Math.sqrt(dx * dx + dz * dz) / (NAV.cell * 0.5)) + 1, prev = null; for (var k = 0; k <= n; k++) { var cl = navCell({ x: a.x + dx * k / n, z: a.z + dz * k / n }); if (!navOpen(cl.i, cl.j)) return false; if (prev && cl.i !== prev.i && cl.j !== prev.j && (!navOpen(cl.i, prev.j) || !navOpen(prev.i, cl.j))) return false; prev = cl; } return true; }   // no corner cutting on the string-pulled runs either
  function route(a, b) {
    if (NAV.dirty || !NAV.grid) navBuild();
    var sc = navNearestOpen(navCell(a)), gc = navNearestOpen(navCell(b));
    if (sc.i === gc.i && sc.j === gc.j) return [b];
    var W = NAV.w, open = [], came = {}, gs = {}, key = function (c) { return c.j * W + c.i; }, h = function (c) { return Math.abs(c.i - gc.i) + Math.abs(c.j - gc.j); };
    var sk = key(sc); gs[sk] = 0; open.push({ c: sc, f: h(sc) }); var closed = {}, found = null, steps = 0;
    while (open.length && steps++ < 20000) {
      var bi = 0; for (var q = 1; q < open.length; q++) if (open[q].f < open[bi].f) bi = q;
      var cur = open.splice(bi, 1)[0], ck = key(cur.c); if (closed[ck]) continue; closed[ck] = 1;
      if (cur.c.i === gc.i && cur.c.j === gc.j) { found = cur.c; break; }
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        if (!di && !dj) continue; var ni = cur.c.i + di, nj = cur.c.j + dj; if (!navOpen(ni, nj)) continue;
        if (di && dj && (!navOpen(cur.c.i + di, cur.c.j) || !navOpen(cur.c.i, cur.c.j + dj))) continue;   // no corner cutting
        var nk = nj * W + ni, ng = gs[ck] + (di && dj ? 1.414 : 1);
        if (gs[nk] !== undefined && gs[nk] <= ng) continue;
        gs[nk] = ng; came[nk] = ck; open.push({ c: { i: ni, j: nj }, f: ng + h({ i: ni, j: nj }) });
      }
    }
    if (!found) return [b];
    var cells = [], k2 = key(found); while (k2 !== undefined && k2 !== sk) { cells.push({ x: NAV.x0 + ((k2 % W) + 0.5) * NAV.cell, z: NAV.z0 + (Math.floor(k2 / W) + 0.5) * NAV.cell }); k2 = came[k2]; }
    cells.reverse(); cells.push(b);
    // string-pulling
    var out = [], from = a, idx = 0;
    while (idx < cells.length) { var far = idx; for (var m = cells.length - 1; m > idx; m--) if (navLine(from, cells[m])) { far = m; break; } out.push(cells[far]); from = cells[far]; idx = far + 1; }
    return out;
  }
  function slotStand(key) { var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l), a = sp.ry || 0, nx = Math.sin(a), nz = Math.cos(a); var A = { x: sp.x + nx * 1.4, z: sp.z + nz * 1.4 }, B = { x: sp.x - nx * 1.4, z: sp.z - nz * 1.4 }; if (NAV.dirty || !NAV.grid) navBuild(); var ca = navCell(A), cb = navCell(B); if (navOpen(ca.i, ca.j)) return A; if (navOpen(cb.i, cb.j)) return B; return A; }

  // ── Staff ─────────────────────────────────────────────────────────
  var staffMeshes = {};
  var VOICE = {
    Jo:   { hi: 'Morning, boss. What have we got?', bye: 'That is me done. See you tomorrow.', onit: 'On it.', full: 'Bench is full, boss.', nospace: 'No rack space for this one.', idle: ['Quiet one today.', 'Did you see the game last night?', 'Coffee machine is on the blink again.', 'That truck driver never stops talking.'], brk: 'Lunch. Back in a bit.' },
    Mika: { hi: 'Right. Clocking in.', bye: 'Home time.', onit: 'Yep.', full: 'Bench. Full.', nospace: 'Nowhere to put it.', idle: ['Hm.', 'Could use a second jack.', 'Rain again.', 'Row C needs sorting.'], brk: 'Break.' },
    Sam:  { hi: 'Alright mate, what is the plan?', bye: 'Cheers, see you tomorrow mate.', onit: 'Leave it with me.', full: 'Bench is rammed, mate.', nospace: 'Racks are chocka, mate.', idle: ['Fancy a brew after this?', 'Those tyres weigh a ton.', 'Reckon it will rain?', 'New lad on the gate is alright.'], brk: 'Sarnie time.' },
    Ravi: { hi: 'Good morning. Ready when you are.', bye: 'Have a good evening.', onit: 'Certainly.', full: 'The bench cannot take any more.', nospace: 'There is no slot for this line.', idle: ['The orders are picking up.', 'I counted row A twice. It is right.', 'Lovely day for it.', 'The inspector is due soon, I think.'], brk: 'I will take my break now.' },
    Lena: { hi: 'Hey. Let us get it moving.', bye: 'Done for today. Night.', onit: 'Got it.', full: 'Bench is maxed.', nospace: 'Zero slots left for that.', idle: ['Forklift beeps are stuck in my head.', 'Who left the dock open?', 'I like the new sign.', 'Need more tape at the bench.'], brk: 'Lunch!' },
    Ada:  { hi: 'Morning all.', bye: 'Off home.', onit: 'Sure.', full: 'No room on the bench.', nospace: 'Racks are full for that line.', idle: ['Peaceful.', 'Trucks are late today.', 'Nice and tidy, that row.', 'I will sort the empties later.'], brk: 'Tea break.' },
    Theo: { hi: 'Yo. Clocking in.', bye: 'Peace.', onit: 'Say less.', full: 'Bench is packed out.', nospace: 'Nowhere for it, chief.', idle: ['Radio is decent today.', 'Who ordered forty lamps?', 'Yard is slippy.', 'Pigeons are back.'], brk: 'Food.' },
    Nour: { hi: 'Good morning. Shall we?', bye: 'Goodnight, everyone.', onit: 'Of course.', full: 'The bench is full, I am afraid.', nospace: 'No rack space for this pallet.', idle: ['The clients are happy this week.', 'I rewrote the pick list.', 'It is cold in here.', 'Nice work on that order.'], brk: 'Lunch time.' }
  };
  function voice(st) { return VOICE[st.name] || VOICE.Jo; }
  function staffSay(st, text, col) { var m = staffMeshes[st.id]; if (m && m.visible) say(m, text, col); }
  function staffById(id) { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].id === id) return S.staff[i]; return null; }
  function onBreak(st) { var b = shiftStart(st) + 4; return S.time >= b && S.time < b + 0.5; }   // half an hour, four hours into their own shift
  function hireStaff(role) {
    var def = STAFF_ROLES[role]; if (!def) return;
    if (def.needs && !S.up[def.needs]) { toast('Buy the forklift first: a driver needs something to drive.', 'bad'); return; }
    var used = S.staff.map(function (s) { return s.name; }), free = STAFF_NAMES.filter(function (n) { return used.indexOf(n) < 0; }), name = free.length ? free[S.nextStaffName++ % free.length] : STAFF_NAMES[S.nextStaffName++ % STAFF_NAMES.length];   // no two Jos
    var st = { id: uid('st'), name: name, role: role, x: SPOT.spawn.x, z: SPOT.spawn.z, yaw: 0, state: 'home', path: [], timer: 0, carry: null, task: null, hiredDay: S.day, look: { skin: pick(SKINS), hair: pick(HAIRS), style: pick(['short', 'long', 'bun', 'bald', 'short']) }, said: 0, punct: randf(0.2, 1), arriveOff: 0, hoursToday: 0, sheet: [] };
    S.staff.push(st); buildStaffMesh(st); logEvent('Hired ' + name + ' as ' + def.name.toLowerCase() + '. Paid ' + money(def.wage / 10) + ' an hour from the time clock, time and a half past ten hours.', 'good'); hudDirty = true; if (S.time < 17 && !isSunday()) { st.state = 'home'; st.arriveOff = Math.max(0, Math.round((S.time + 0.15 - SHIFT_START) * 60)); }   // hired before the shift: they come in at the start, not in the night
  }
  function fireStaff(id) {
    var st = staffById(id); if (!st) return;
    staffDropAll(st); var fh = st.hoursToday || 0; if (fh > 0.05 && st.clocked !== undefined) { var fpay = Math.round(hourly(st) * (Math.min(fh, 10.25) + Math.max(0, fh - 10.25) * 1.5)); if (fpay > 0) pay(-fpay, 'Final pay, ' + st.name + ' (' + (Math.round(fh * 10) / 10) + ' h)'); }   // the hours worked today are paid on the way out
    var m = staffMeshes[id]; if (m) { if (m.userData.jack) scene.remove(m.userData.jack); if (m.userData.hit) { var hi = inter.indexOf(m.userData.hit); if (hi >= 0) inter.splice(hi, 1); } scene.remove(m); delete staffMeshes[id]; }
    S.staff.splice(S.staff.indexOf(st), 1); logEvent(st.name + ' let go'); hudDirty = true;
  }
  function buildStaffMesh(st) {
    var vest = st.role === 'receiver' ? MAT.hivisOrange : st.role === 'picker' ? MAT.hivis : st.role === 'driver' ? MAT.hivis : MAT.green;
    var look = st.look || {};
    var g = makeHuman({ skin: look.skin, hair: look.hair, style: look.style, vest: vest, hardhat: st.role === 'receiver' || st.role === 'driver' ? (st.role === 'driver' ? MAT.yellow : MAT.white) : null, name: st.name }); g.userData.dynamic = true; g.position.set(st.x, 0, st.z); scene.add(g); staffMeshes[st.id] = g;
    if (hasJack(st) && jackModel) g.userData.jack = jackModel('staffjack', true);
    g.userData.hit = hitBox(0.7, 1.9, 0.7, 0, 0.95, 0, { staffId: st.id, prompt: function () { return staffPrompt(st); }, use: function () { staffUse(st); } }, g);   // look at a worker: name, job, status, timekeeping   // a receiver has a pallet jack of their own: pushed under the pallet, towed behind them when empty
  }
  // the receiver's jack. Loaded: pushed ahead with the tiller lowered to 31 degrees, so its grip meets both hands half a metre in
  // front at hip height. Empty and walking: towed behind on one trailing arm, tiller at 20 degrees, the grip in that hand just
  // behind the hip; its heading eases after the figure so a turn does not whip it round. Standing: parked behind them, tiller
  // sprung up. The distances are STAFF_JACK; the tiller is 1 m long on a pivot 0.78 m behind the jack's origin at 0.5 m.
  function jackFollow(st, m, onJack, dt, walking) {
    var j = m.userData.jack; if (!j) return; var u = j.userData, parked = !!(st.jackParked && st.jackAt), ease = 1 - Math.exp(-(dt || 1 / 60) * 6);
    j.visible = parked || m.visible;   // a parked jack stays in the hall while its owner is on a break, at the clock or at home
    var tilt = parked ? -0.3 : onJack ? -1.025 : walking ? -1.213 : -0.3;
    if (u.tilt === undefined) u.tilt = tilt; else u.tilt += (tilt - u.tilt) * ease; if (u.tiller) u.tiller.rotation.x = u.tilt;
    if (parked) { j.position.set(st.jackAt.x, floorY(st.jackAt.x, st.jackAt.z), st.jackAt.z); j.rotation.y = st.jackAt.ry || 0; return; }
    var fy = floorY(st.x, st.z);
    if (onJack) { u.towRy = undefined; u.towD = undefined; j.position.set(st.x + Math.sin(st.yaw) * STAFF_JACK.push, fy, st.z + Math.cos(st.yaw) * STAFF_JACK.push); j.rotation.y = st.yaw; }
    else {
      var want = walking ? STAFF_JACK.tow : STAFF_JACK.park, cur = u.towRy === undefined ? st.yaw : u.towRy, d = Math.atan2(Math.sin(st.yaw - cur), Math.cos(st.yaw - cur)); cur += d * ease; u.towRy = cur;
      u.towD = u.towD === undefined ? want : u.towD + (want - u.towD) * ease;
      j.position.set(st.x - Math.sin(cur) * u.towD, fy, st.z - Math.cos(cur) * u.towD); j.rotation.y = cur + Math.PI;
    }
    st.jackAt = { x: j.position.x, z: j.position.z, ry: j.rotation.y };   // where it would stay if they walked off now
  }
  function staffDriving() { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].state === 'drive') return S.staff[i]; return null; }
  function staffDropAll(st) {
    if (st.state === 'drive') driverDismount(st);
    S.pallets.forEach(function (p) { if (p.place === 'staff' && p.staff === st.id) { p.place = 'floor'; p.x = st.x; p.z = st.z; p.y = floorY(p.x, p.z); p.rot = st.yaw; p.staff = null; } });   // a pallet on the jack is set down where the worker stands (two metres ahead put it inside the rack they were facing)
    if (st.carry) {
      var cy = st.carry, bk = cy.kind === 'box' && !cy.damaged ? findSlotFor(cy.sku, 1, 1) : null;
      if (cy.kind === 'box') { if (bk) slotAdd(bk, cy.sku, 1); else S.floor.push({ kind: 'box', sku: cy.sku, damaged: !!cy.damaged, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); }
      else if (cy.kind === 'return') { if (rdesk().queue.length < rdeskCap()) rdesk().queue.push(cy.id); else S.floor.push({ kind: 'return', id: cy.id, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); }
      else if (orderById(cy.order) && S.bench.parcels.length < 12) S.bench.parcels.push(cy.order);
      else if (orderById(cy.order)) S.floor.push({ kind: 'parcel', order: cy.order, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw });
      st.carry = null;
    }
    st.task = null; st.state = 'idle'; st.path = [];
  }
  function staffGo(st, to, then) { st.path = route({ x: st.x, z: st.z }, to); st.state = 'walk'; st.then = then; }
  function staffWalk(st, dt) {
    if (!st.path.length) { st.state = st.then || 'idle'; st.then = null; return; }
    var t = st.path[0], dx = t.x - st.x, dz = t.z - st.z, d = Math.sqrt(dx * dx + dz * dz), sp = (st.carry || S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; }) ? 1.6 : 1.9) * (st.trained ? 1.2 : 1) * dt;   // a trained worker walks a fifth faster
    if (d <= sp) { st.x = t.x; st.z = t.z; st.path.shift(); if (!st.path.length) { st.state = st.then || 'idle'; st.then = null; } return; }
    st.x += dx / d * sp; st.z += dz / d * sp;
    var want = Math.atan2(dx, dz), diff = want - st.yaw; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI; st.yaw += diff * Math.min(1, 10 * dt);
  }
  // boxes already on their way to the bench, by SKU: on the pick belts and the merge, in a crane's grab, in a picker's hands, or
  // claimed by a picker walking to the slot. The cranes and the pickers both subtract this, so neither fetches a box the other
  // already has in hand. A box being carried back to the racks is not on its way to the bench.
  function pickInFlight() {
    var n = {}, add = function (sku) { n[sku] = (n[sku] || 0) + 1; };
    ['pickBelt', 'pickBelt2', 'pickMerge', 'upperPick', 'upperChute'].forEach(function (bid) { if (BELTS[bid]) beltItems(bid).forEach(function (it) { if (it.kind === 'box') add(it.sku); }); });
    if (S.up.gantry) gantryRows().forEach(function (r) { var G = gantryState(r); if (G.sku && G.state !== 'idle') add(G.sku); });
    S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') { if (!st.carry.back && !st.carry.bin) add(st.carry.sku); } else if (st.task && st.task.kind === 'pick') add(st.task.sku); });
    return n;
  }
  function skuDemand(sku) {
    var need = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === sku) need += l.qty; }); });
    need -= (S.bench.boxes[sku] || 0);
    need -= pickInFlight()[sku] || 0;
    return need;
  }
  function tickStaff(dt) {
    S.staff.forEach(function (st) {
      var m = staffMeshes[st.id]; if (!m) { buildStaffMesh(st); m = staffMeshes[st.id]; }
      if (st.punct === undefined) { st.punct = randf(0.2, 1); st.arriveOff = st.arriveOff || 0; }   // an old save: a value, not a new day (staffNewDay sent everyone home unpaid on the first tick)
      var brk = onBreak(st), off = isSunday() || st.sick || st.dayOff, end = shiftEnd(st);
      if (off && !st.clocked && st.state !== 'home' && st.state !== 'gone' && !(st.state === 'walk' && st.then === 'gone')) { staffDropAll(st); if (hasJack(st)) { st.jackParked = true; st.jackAt = jackHome(st); } st.state = 'walk'; st.then = 'gone'; st.path = route({ x: st.x, z: st.z }, RAMP_BOTTOM); return; }   // Tyson's save had two unclocked workers idling at their spots on a Sunday
      if (!off && !st.clocked && !st.clockedOutAt && st.state === 'idle' && S.time >= staffArrival(st) && S.time < end - 0.5) { st.state = 'walk'; st.then = 'clockin'; st.path = route({ x: st.x, z: st.z }, clockStand()); }
      // not here: at home until the arrival time, then the walk in from the yard to the clock
      if (st.state === 'home') {
        m.visible = false; jackFollow(st, m, false, dt, false); st.x = RAMP_BOTTOM.x; st.z = RAMP_BOTTOM.z;   // the jack stays parked in the hall overnight
        if (!off && !st.clockedOutAt && S.time >= staffArrival(st) && S.time < end - 0.5) { st.state = 'walk'; st.then = 'clockin'; st.path = route({ x: st.x, z: st.z }, clockStand()); }
        return;
      }
      if (st.state === 'gone') { st.state = 'home'; m.visible = false; return; }
      m.visible = true;
      var onJack = S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; }), carrying = !!st.carry || onJack;
      // the clock at both ends of the shift
      if (st.state === 'clockin') { staffWait(st, 1.4, function () { staffClockIn(st); st.state = 'idle'; }, true); st.state = 'wait'; st.yaw = clockFaceYaw(); }
      // a pallet being set into a rack finishes first, or it is dropped half through the rack face
      // planned once: a walker already on the way, at the clock, or in the clock-out wait is left alone (re-planning every tick from a clipped door jamb bounced them in the doorway for hours)
      if (st.clocked && S.time >= end && st.state !== 'clockout' && st.state !== 'parkJack' && st.state !== 'drive' && !(st.state === 'walk' && (st.then === 'clockout' || st.then === 'parkJack')) && !(st.state === 'wait' && st.leavingWait) && !(st.state === 'wait' && st.task && st.task.kind === 'store')) {
        staffDropAll(st); var jm0 = staffMeshes[st.id];
        if (jm0 && jm0.userData.jack && !st.jackParked) { st.state = 'walk'; st.then = 'parkJack'; st.path = route({ x: st.x, z: st.z }, jackHome(st)); }   // the jack goes to its slot by the wall first
        else { st.jackParked = true; st.state = 'walk'; st.then = 'clockout'; st.path = route({ x: st.x, z: st.z }, clockStand()); }
        st.leaving = true;
      }
      if (st.state === 'parkJack') { st.jackAt = jackHome(st); st.jackParked = true; st.state = 'walk'; st.then = 'clockout'; st.path = route({ x: st.x, z: st.z }, clockStand()); st.leaving = true; }
      if (st.state === 'clockout') { st.leavingWait = true; staffWait(st, 1.2, function () { staffClockOut(st); st.leavingWait = false; st.state = 'walk'; st.then = 'gone'; st.path = route({ x: st.x, z: st.z }, RAMP_BOTTOM); st.leaving = true; }, true); st.state = 'wait'; st.yaw = clockFaceYaw(); }
      if (st.clocked) st.hoursToday = (st.hoursToday || 0) + dt / HOUR_SEC;
      var working = st.clocked && S.time < end;   // on the clock and inside the shift. Not the old st.leaving flag: set at every shift end since 1.4.0 and never cleared, it kept a worker idle at the clock from their second morning on
      if (working && brk && !carrying && st.state !== 'break' && st.state !== 'walk' && st.state !== 'wait' && st.state !== 'drive') { st.task = null; st.jackParked = true; staffSay(st, voice(st).brk, '#a0acb8'); staffGo(st, { x: -HALL.x + 3.7 + randf(-1, 1), z: -21.2 + randf(-0.4, 0.4) }, 'break'); }
      if (!brk && st.state === 'break') st.state = 'idle';
      // the driver: at the forklift, climbs on; on it, the forklift does the walking and the figure sits on the seat
      if (st.state === 'mountFork') { if (!S.up.fork || driving || (staffDriving() && staffDriving() !== st) || dist2(player.x, player.z, S.fork.x, S.fork.z) < 6.5) { st.state = 'idle'; st.task = null; } else { if (S.fork.plugged) cableUnplugFork(st.name + ' drove off with the charger plugged in. The plug came out.'); st.jackParked = true; st.state = 'drive'; st.drive = { phase: st.task && st.task.park ? 'park' : st.task && st.task.held ? 'toSlot' : 'toPallet', path: null }; sfx('forklift'); } }   // a pallet already on the forks is the job
      if (st.state === 'drive') { driveTick(st, dt); var fy = floorY(S.fork.x, S.fork.z); m.position.set(S.fork.x - Math.sin(S.fork.yaw) * 0.42, fy + 0.56, S.fork.z - Math.cos(S.fork.yaw) * 0.42); m.userData.baseY = fy + 0.56; m.rotation.y = S.fork.yaw; st.x = S.fork.x - Math.sin(S.fork.yaw) * 1.7; st.z = S.fork.z - Math.cos(S.fork.yaw) * 1.7; st.yaw = S.fork.yaw; animateHuman(m, dt, 'sit', 0, null, false); jackFollow(st, m, false, dt, false); return; }
      var mode = st.state === 'walk' ? 'walk' : st.state === 'wait' ? (st.working ? 'work' : 'wait') : 'idle';
      if (st.state === 'walk') staffWalk(st, dt);
      else if (st.state === 'wait') { st.timer -= dt * (st.trained ? 1.5 : 1); if (st.timer <= 0) { st.state = 'idle'; st.working = false; if (st.after) { var f = st.after; st.after = null; f(); } } }
      else if (st.state === 'break') { /* standing in the break room */ }
      else if (st.state === 'idle' && working) roleThink(st);
      if ((st.state === 'idle' || st.state === 'break') && Math.random() < dt / 22 && S.time - (st.said || 0) > 0.4) { st.said = S.time; staffSay(st, pick(voice(st).idle), '#a0acb8'); }
      m.position.set(st.x, floorY(st.x, st.z), st.z); m.userData.baseY = m.position.y; m.rotation.y = st.yaw;
      var near = dist2(st.x, st.z, player.x, player.z) < 36;
      animateHuman(m, dt, mode, 1.9, near && st.state !== 'walk' ? { x: player.x, y: player.y + 1.6, z: player.z } : null, onJack ? 'jack' : carrying ? true : (m.userData.jack && mode === 'walk' ? 'tow' : false));
      jackFollow(st, m, onJack, dt, mode === 'walk');
    });
  }
  // which role's work a worker does now: their own, or their second role when their own queue is empty and the other has work
  var THINK = { receiver: receiverThink, picker: pickerThink, driver: driverThink, packer: packerThink };
  function roleHasWork(role) {
    if (role === 'receiver') return S.trucks.some(function (t) { return t.dir === 'in' && t.state === 'docked' && t.signed && S.doors[doorIndex('in', t.dock)] && S.pallets.some(function (p) { return p.place === 'truck' && p.truck === t.id && p.n > 0; }); });
    if (role === 'picker') { var need = benchNeed(); for (var k in need) if (need[k] > 0 && slotsWith(k).some(function (q) { var sp = slotParse(q); return sp.l < RACK.top && sp.r !== UPPER.row; })) return true; return false; }   // stock a walker can reach, not the top level or the upper row
    if (role === 'packer') { if (openOrders().some(canPack)) return true; var dk = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && S.doors[doorIndex('out', x.dock)]; }); if (dk.length && S.bench.parcels.some(function (oid) { var oo = orderById(oid); return oo && dk.some(function (x) { return MODES[orderMode(oo)].door === doorIndex('out', x.dock); }); })) return true; return !!returnsJob(null); }   // a parcel counts only with the truck of its lane in
    if (role === 'driver') return !!S.up.fork && !!driverJob();
    return false;
  }
  function roleThink(st) {
    // whatever is in hand finishes first, whichever role picked it up: a pallet on the jack is racked, a box or parcel goes where it was going
    if (S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; })) { receiverThink(st); return; }
    if (st.carry) { (st.carry.kind === 'parcel' || st.carry.kind === 'return' || st.carry.bin ? packerThink : pickerThink)(st); return; }
    var r = st.role; if (st.cross && THINK[st.cross] && !roleHasWork(r) && roleHasWork(st.cross)) r = st.cross;
    if (r !== 'receiver') { var jm = staffMeshes[st.id]; if (jm && jm.userData.jack && !st.jackParked && st.jackAt) st.jackParked = true; }   // the jack stays where it is while they do other work; receiverThink walks them back to it
    THINK[r](st);
  }
  // ── The forklift driver ───────────────────────────────────────────
  // Takes the pallets left on the hall floor (receiving, the palletiser drop, wherever you set one down) to a rack slot on any
  // level, the top shelf included, which nobody on foot can reach. Keeps clear of the AGV's square and of you: a pallet you are
  // standing by is yours, and the forklift is never taken while you are next to it or on it.
  function driverSpot() { return { x: SPOT.fork.x + 2.2, z: SPOT.fork.z + 1.2 }; }
  function driverJob() {
    var A = S.agv, pu = propInst.agvDock ? propWorld('agvDock', 0, 2.6) : null, wr = propInst.wrapper ? propWorld('wrapper', 0, 0) : null, best = null, bd = 1e9;
    S.pallets.forEach(function (p) {
      if (p.place !== 'floor' || p.n <= 0 || !insideHall(p.x, p.z) || (SKU[p.sku] && SKU[p.sku].raw)) return;
      if (A && A.target === p.id && A.state !== 'idle') return; if (pu && dist2(p.x, p.z, pu.x, pu.z) < 2.6) return; if (wr && dist2(p.x, p.z, wr.x, wr.z) < 2.6) return; if (dist2(p.x, p.z, player.x, player.z) < 9) return;
      if (S.staff.some(function (o) { return o.task && o.task.pallet === p.id; })) return;
      var key = findSlotFor(p.sku, p.n, 2); if (!key) return;
      var d = dist2(p.x, p.z, S.fork.x, S.fork.z); if (d < bd) { bd = d; best = { pallet: p, key: key }; }
    });
    return best;
  }
  function driverThink(st) {
    if (!S.up.fork) { if (Math.random() < 0.004) staffSay(st, 'Nothing to drive yet.', '#a0acb8'); idleAt(st, driverSpot()); return; }
    if (driving || staffDriving() || dist2(player.x, player.z, S.fork.x, S.fork.z) < 6.5) { idleAt(st, driverSpot()); return; }
    // a pallet you left on the forks is the first job: it goes to a rack, not under the next one
    var held = S.fork.pallet ? palletById(S.fork.pallet) : null;
    if (held) { var hk = held.n > 0 ? findSlotFor(held.sku, held.n, 2) : null; if (!hk) { st.task = { kind: 'drive', pallet: held.id, held: true, park: true }; staffGo(st, { x: S.fork.x - Math.sin(S.fork.yaw) * 1.6, z: S.fork.z - Math.cos(S.fork.yaw) * 1.6 }, 'mountFork'); return; } st.task = { kind: 'drive', pallet: held.id, key: hk, held: true }; staffGo(st, { x: S.fork.x - Math.sin(S.fork.yaw) * 1.6, z: S.fork.z - Math.cos(S.fork.yaw) * 1.6 }, 'mountFork'); return; }
    var job = driverJob(); if (!job) { idleAt(st, driverSpot()); return; }
    st.task = { kind: 'drive', pallet: job.pallet.id, key: job.key }; if (Math.random() < 0.5) staffSay(st, voice(st).onit, '#5fd38d');
    staffGo(st, { x: S.fork.x - Math.sin(S.fork.yaw) * 1.6, z: S.fork.z - Math.cos(S.fork.yaw) * 1.6 }, 'mountFork');
  }
  function forkFollow(D, dt) {
    if (!D.path || !D.path.length) return true;
    var t = D.path[0], dx = t.x - S.fork.x, dz = t.z - S.fork.z, d = Math.hypot(dx, dz), want = Math.atan2(dx, dz), diff = Math.atan2(Math.sin(want - S.fork.yaw), Math.cos(want - S.fork.yaw));
    S.fork.yaw = Math.atan2(Math.sin(S.fork.yaw + clamp(diff, -2.2 * dt, 2.2 * dt)), Math.cos(S.fork.yaw + clamp(diff, -2.2 * dt, 2.2 * dt))); if (Math.abs(diff) > 0.5) return false;   // turns on the spot before it moves off, the way a counterbalance truck is driven; the heading is kept wrapped
    var sp = 2.4 * dt; S.fork.batt = clamp((S.fork.batt === undefined ? 1 : S.fork.batt) - dt / 1500, 0, 1);   // the crew's driving drinks the battery like yours
    if (d <= sp) { S.fork.x = t.x; S.fork.z = t.z; D.path.shift(); return !D.path.length; }
    S.fork.x += dx / d * sp; S.fork.z += dz / d * sp; return false;
  }
  function forkTurnTo(want, dt) { var diff = Math.atan2(Math.sin(want - S.fork.yaw), Math.cos(want - S.fork.yaw)); if (Math.abs(diff) < 0.04) { S.fork.yaw = want; return true; } S.fork.yaw += clamp(diff, -2.2 * dt, 2.2 * dt); return false; }
  function driveTick(st, dt) {
    var D = st.drive, p = st.task ? palletById(st.task.pallet) : null;
    if (!D) { driverDismount(st); return; }
    if (D.phase === 'toPallet') {
      if (!p || p.place !== 'floor') { D.phase = 'park'; D.path = null; return; }
      if (!D.path) { var dx = p.x - S.fork.x, dz = p.z - S.fork.z, dl = Math.hypot(dx, dz) || 1; D.path = route({ x: S.fork.x, z: S.fork.z }, { x: p.x - dx / dl * 1.7, z: p.z - dz / dl * 1.7 }); }
      if (forkFollow(D, dt) && forkTurnTo(Math.atan2(p.x - S.fork.x, p.z - S.fork.z), dt)) { p.place = 'fork'; S.fork.pallet = p.id; S.fork.lift = 0.3; sfx('jack'); D.phase = 'toSlot'; D.path = null; }
    } else if (D.phase === 'toSlot') {
      if (!p || p.place !== 'fork') { D.phase = 'park'; D.path = null; return; }
      if (!D.path) D.path = route({ x: S.fork.x, z: S.fork.z }, slotStand(st.task.key));
      if (forkFollow(D, dt)) { var sp = slotParse(st.task.key), spos = rackSlotPos(sp.r, sp.b, sp.l); if (forkTurnTo(Math.atan2(spos.x - S.fork.x, spos.z - S.fork.z), dt)) { D.phase = 'lift'; D.liftTo = RACK.levels[sp.l] + 0.15; } }
    } else if (D.phase === 'lift') {
      S.fork.lift = Math.min(D.liftTo, S.fork.lift + 0.9 * dt);
      if (S.fork.lift >= D.liftTo - 0.001) {
        var ok = p && storePallet(p, st.task.key); if (!ok && p) { var k2 = findSlotFor(p.sku, p.n, 2); ok = k2 && storePallet(p, k2); }
        if (ok) { S.stats.putaway++; sfx('crate'); addXp(XP.pallet); } else if (p) { staffSay(st, voice(st).nospace, '#ff6b5e'); S.fork.lift = 0.3; D.phase = 'park'; D.path = null; return; }   // no room anywhere: the pallet rides back to the bay and is set down there, not inside the rack
        if (ok || p) S.fork.pallet = null; D.phase = 'lower';
      }
    } else if (D.phase === 'lower') {
      S.fork.lift = Math.max(0.1, S.fork.lift - 0.9 * dt);
      if (S.fork.lift <= 0.1001) { st.task = null; var job = !driving && dist2(player.x, player.z, S.fork.x, S.fork.z) > 6.5 ? driverJob() : null; if (job) { st.task = { kind: 'drive', pallet: job.pallet.id, key: job.key }; D.phase = 'toPallet'; D.path = null; } else { D.phase = 'park'; D.path = null; } }
    } else if (D.phase === 'park') {
      if (!D.path) D.path = route({ x: S.fork.x, z: S.fork.z }, { x: SPOT.fork.x, z: SPOT.fork.z });
      if (forkFollow(D, dt) && forkTurnTo(Math.PI, dt)) driverDismount(st);
    } else driverDismount(st);
  }
  function driverDismount(st) {
    var p = S.fork.pallet ? palletById(S.fork.pallet) : null;
    if (p && st.task && st.task.pallet === p.id) { var ft = forkTip(); p.place = 'floor'; p.x = ft.x; p.z = ft.z; p.y = 0; p.rot = S.fork.yaw; S.fork.pallet = null; }
    if (!S.fork.pallet) S.fork.lift = Math.min(S.fork.lift, 0.3);
    st.drive = null; st.task = null; st.state = 'idle'; st.x = S.fork.x - Math.sin(S.fork.yaw) * 1.7; st.z = S.fork.z - Math.cos(S.fork.yaw) * 1.7; st.yaw = S.fork.yaw;
  }
  function benchSide(lz) { var P = PROPS.bench ? propPlacement('bench') : { x: SPOT.bench.x, z: SPOT.bench.z, rot: 0 }, a = P.rot * Math.PI / 2, lx = -1.0; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a) }; }
  function clockStand() { var P = propPlacement('timeclock'), a = P.rot * Math.PI / 2; return { x: P.x + Math.sin(a) * 1.0, z: P.z + Math.cos(a) * 1.0 }; }
  function clockFaceYaw() { var P = propPlacement('timeclock'); return P.rot * Math.PI / 2 + Math.PI; }
  // a worker's place in their role's line-up, and an idle spot of their own from it: three receivers idling on the same point looked
  // like one figure with three jacks fanned out behind it (the jack parks behind its owner along their own heading)
  // the crew's jacks park in a row along the west wall north of the cart bay, one slot a jack by the owner's place in the line-up.
  // Until 1.18.0 a jack was left wherever its owner stood at clock-out, and three receivers' jacks ended up piled on one idle spot.
  var JACK_HOME = { x: -HALL.x + 1.3, z0: 11.4, step: 1.5 };
  function hasJack(st) { return st.role === 'receiver' || st.cross === 'receiver'; }
  function jackRank(st, list) { var n = 0; list = list || S.staff; for (var i = 0; i < list.length; i++) { var o = list[i]; if (o === st) return n; if (hasJack(o)) n++; } return n; }
  function jackHome(st, list) { var k = jackRank(st, list); return { x: JACK_HOME.x, z: JACK_HOME.z0 + k * JACK_HOME.step, ry: -Math.PI / 2 }; }   // pointing west: the owner's stand is east of it, on open floor
  // a worker can be looked at: who they are, what they are doing, how they keep time; E has a word with one who came in late
  function punctWord(st) { var p = st.punct === undefined ? 0.6 : st.punct; return p >= 0.75 ? 'reliable' : p >= 0.4 ? 'fair timekeeper' : 'poor timekeeper'; }
  function staffPrompt(st) { return st.name + ' · ' + STAFF_ROLES[st.role].name.toLowerCase() + (st.cross && STAFF_ROLES[st.cross] ? ' (and ' + STAFF_ROLES[st.cross].name.toLowerCase() + ')' : '') + ' · ' + staffStatus(st) + ' · ' + punctWord(st) + (st.lateToday && !st.wordToday ? ' · E: have a word about the time' : ''); }
  function staffUse(st) { if (st.lateToday && !st.wordToday) { staffWord(st); staffSay(st, pick(['Sorry, boss. Will not happen again.', 'Yes, I know. Sorry.', 'Alarm did not go off. Sorry.']), '#a0acb8'); return; } staffSay(st, pick(voice(st).idle), '#a0acb8'); sfx('click'); }
  function staffRank(st) { var n = 0; for (var i = 0; i < S.staff.length; i++) { var o = S.staff[i]; if (o === st) return n; if (o.role === st.role) n++; } return n; }
  function spreadSpot(st, base, step, row) { var k = staffRank(st), a = k % 3, b = Math.floor(k / 3); return { x: base.x + step.x * a + row.x * b, z: base.z + step.z * a + row.z * b }; }
  function staffWait(st, sec, after, working) { st.state = 'wait'; st.timer = sec; st.after = after; st.working = !!working; }
  function idleAt(st, spot) { if (dist2(st.x, st.z, spot.x, spot.z) > 1) { staffGo(st, spot, 'wait'); st.timer = 1.5; } else staffWait(st, 1.5 + Math.random()); }
  function receiverThink(st) {
    var carrying = S.pallets.filter(function (p) { return p.place === 'staff' && p.staff === st.id; })[0];
    // the jack was left somewhere (a break, the clock, overnight): walk back to where they stood with it before anything else
    if (st.jackParked && !carrying) { var ja = st.jackAt, stand = ja ? { x: ja.x - Math.sin(ja.ry || 0) * STAFF_JACK.park, z: ja.z - Math.cos(ja.ry || 0) * STAFF_JACK.park } : null; if (!stand || dist2(st.x, st.z, stand.x, stand.z) < 1.44) { st.jackParked = false; } else { st.task = { kind: 'jack' }; staffGo(st, stand, 'wait'); st.timer = 0.4; st.working = true; st.after = function () { st.jackParked = false; st.task = null; }; return; } }
    if (carrying) {
      var key = findSlotFor(carrying.sku, carrying.n, 1);
      if (!key) { carrying.place = 'floor'; carrying.x = SPOT.stageIn.x + randf(-1, 1); carrying.z = SPOT.stageIn.z + randf(-1, 1); carrying.y = 0; carrying.rot = 0; staffSay(st, voice(st).nospace, '#ff6b5e'); logEvent(st.name + ' found no rack space: pallet left in receiving', 'bad'); st.task = null; return; }
      st.task = { kind: 'store', pallet: carrying.id, key: key };
      staffGo(st, slotStand(key), 'wait'); st.timer = 1.4; st.working = true; st.after = function () { var p = palletById(carrying.id); if (!p) return; if (!storePallet(p, key)) { var k2 = findSlotFor(p.sku, p.n, 1); if (!k2 || !storePallet(p, k2)) { p.place = 'floor'; p.x = st.x; p.z = st.z; p.y = 0; } } else { sfx('crate'); addXp(XP.pallet); } st.task = null; };
      return;
    }
    var pickP = null;
    for (var i = 0; i < S.pallets.length; i++) { var p = S.pallets[i]; if (p.place !== 'truck' || p.n <= 0) continue; var t = truckById(p.truck); if (!t || t.state !== 'docked' || !S.doors[doorIndex('in', t.dock)] || !t.signed) continue; if (S.staff.some(function (o) { return o !== st && o.task && o.task.pallet === p.id; })) continue; pickP = p; break; }
    if (!pickP) { idleAt(st, spreadSpot(st, { x: SPOT.stageIn.x - 1.8, z: SPOT.stageIn.z + 2.6 }, { x: 1.8, z: 0 }, { x: 0, z: 1.6 })); return; }
    var w = truckPalletPos(truckById(pickP.truck), pickP.idx), tr = truckById(pickP.truck);
    st.task = { kind: 'fetch', pallet: pickP.id }; if (Math.random() < 0.5) staffSay(st, voice(st).onit, '#5fd38d');
    staffGo(st, { x: w.x, z: w.z + (w.z > tr.z ? -1.0 : 1.0) }, 'wait'); st.timer = 1.4; st.working = true;
    st.after = function () { var p = palletById(pickP.id); if (!p || p.place !== 'truck') { st.task = null; return; } onPalletLeftTruck(p); p.place = 'staff'; p.staff = st.id; sfx('jack'); st.task = null; };
  }
  // a box being taken back to the racks: to the slot chosen for it, and onto the rack (the picker's surplus, the packer's returns)
  function carryBack(st) {
    var bk = st.carry.back, bsku = st.carry.sku;
    staffGo(st, slotStand(bk), 'wait'); st.timer = 1.0; st.working = true;
    st.after = function () { if (!st.carry) return; var k = slotSpace(bk, bsku) > 0 ? bk : findSlotFor(bsku, 1, 1); if (k) { slotAdd(k, bsku, 1); st.carry = null; sfx('putdown'); S.stats.putaway++; } else { S.floor.push({ kind: 'box', sku: bsku, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); st.carry = null; staffSay(st, voice(st).nospace, '#ff6b5e'); } st.task = null; };
  }
  // a damaged box to the bin by the bench: no charge, the return was the customer's
  function carryToBin(st) { var w = binSpotFor(st); staffGo(st, { x: w.x, z: w.z }, 'wait'); st.timer = 0.6; st.working = true; st.after = function () { if (st.carry && st.carry.kind === 'box') { S.binned = (S.binned || 0) + 1; addWaste(2); st.carry = null; sfx('crate'); } st.task = null; }; }
  function pickerThink(st) {
    if (st.carry && st.carry.bin) { carryToBin(st); return; }
    if (st.carry && st.carry.back) { carryBack(st); return; }
    if (st.carry) {
      staffGo(st, benchSide(0), 'wait'); st.timer = 0.8; st.working = true;
      st.after = function () { if (!st.carry) return; if (benchCount() < ECON.benchCap) { benchAdd(st.carry.sku, 1); st.carry = null; sfx('putdown'); addXp(XP.box); } else { staffSay(st, voice(st).full, '#ff6b5e'); staffWait(st, 3); } st.task = null; };
      return;
    }
    var want = null;
    var orders = openOrders().slice().sort(function (a, b) { return (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b.due; });
    for (var i = 0; i < orders.length && !want; i++) orders[i].lines.forEach(function (l) { if (want) return; if (skuDemand(l.sku) > 0) { var keys = slotsWith(l.sku).filter(function (k) { var sp = slotParse(k); return sp.l < RACK.top && sp.r !== UPPER.row; });   /* the upper row is the upper crane's; the annex rows are a walker's since 1.17.0 */ if (keys.length) { keys.sort(function (a, b) { var A = slotStand(a), B = slotStand(b); return dist2(A.x, A.z, st.x, st.z) - dist2(B.x, B.z, st.x, st.z); }); want = { sku: l.sku, key: keys[0] }; } } });   // the nearest slot that holds it, not the first in rack order
    if (!want) {
      // nothing to pick: a box on the bench that no open order wants goes back on the racks, one at a time
      var sur = benchSurplus(), rsku = null; for (var sk in sur) if (sur[sk] > 0) { rsku = sk; break; }
      var rkey = rsku ? findSlotFor(rsku, 1, 1) : null;
      if (rkey && !S.staff.some(function (o) { return o !== st && o.task && o.task.kind === 'return'; })) { st.task = { kind: 'return', sku: rsku, key: rkey }; staffGo(st, benchSide(0), 'wait'); st.timer = 0.8; st.working = true; st.after = function () { if (benchTake(rsku, 1)) { st.carry = { kind: 'box', sku: rsku, back: rkey }; sfx('pickup'); } else st.task = null; }; return; }
      idleAt(st, spreadSpot(st, { x: SPOT.bench.x - 2.0, z: 2.6 }, { x: 0, z: -1.2 }, { x: -1.4, z: 0 })); return;
    }
    st.task = { kind: 'pick', sku: want.sku, key: want.key };
    staffGo(st, slotStand(want.key), 'wait'); st.timer = 1.0; st.working = true;
    st.after = function () { var s = S.slots[want.key]; if (s && s.sku === want.sku && s.n > 0) { slotTake(want.key, 1); st.carry = { kind: 'box', sku: want.sku }; S.stats.picked++; sfx('pickup'); } st.task = null; };
  }
  function packerThink(st) {
    if (st.carry && st.carry.kind === 'return') { packerReturns(st, { kind: 'rdesk' }); return; }
    if (st.carry && st.carry.kind === 'box') { if (st.carry.bin) carryToBin(st); else if (st.carry.back) carryBack(st); else pickerThink(st); return; }
    if (st.carry && st.carry.kind === 'parcel') {
      var co = orderById(st.carry.order), t = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && S.doors[doorIndex('out', x.dock)] && (!co || MODES[orderMode(co)].door === doorIndex('out', x.dock)); })[0];   // the truck of the parcel's lane, never the wrong door
      if (!t) { if (S.bench.parcels.length >= 12) { staffWait(st, 2); return; } staffGo(st, benchSide(2.3), 'wait'); st.timer = 0.7; st.working = true; st.after = function () { if (st.carry && st.carry.kind === 'parcel') { S.bench.parcels.push(st.carry.order); st.carry = null; sfx('putdown'); } }; return; }   // the truck has gone: back on the shelf, not held all shift
      staffGo(st, { x: t.x + t.side * 1.6, z: t.z }, 'wait'); st.timer = 0.9; st.working = true;
      st.after = function () { if (!st.carry) return; var tt = truckById(t.id); var o = orderById(st.carry.order); if (tt && tt.state === 'docked' && o) { tt.parcels.push(o.id); o.state = 'loaded'; sfx('crate'); addXp(XP.ship); rebuildBoardSoon(); st.carry = null; } else { staffWait(st, 2); } };
      return;
    }
    var packable = openOrders().filter(canPack).sort(function (a, b) { return a.due - b.due; })[0];
    if (packable) {
      staffGo(st, benchSide(0.8), 'wait'); st.timer = 2.8; st.working = true;
      st.after = function () { if (canPack(packable)) { packOrder(packable); } };
      return;
    }
    var docked = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && S.doors[doorIndex('out', x.dock)]; }), forLane = function (oid) { var oo = orderById(oid); return oo && docked.some(function (x) { return MODES[orderMode(oo)].door === doorIndex('out', x.dock); }); };
    var truck = docked.length && S.bench.parcels.some(forLane) ? docked[0] : null;
    if (truck && S.bench.parcels.length) {
      staffGo(st, benchSide(2.3), 'wait'); st.timer = 0.7; st.working = true;
      st.after = function () { var oid = S.bench.parcels.filter(forLane)[0]; if (oid) { S.bench.parcels.splice(S.bench.parcels.indexOf(oid), 1); st.carry = { kind: 'parcel', order: oid }; sfx('pickup'); } };
      return;
    }
    var rj = returnsJob(st); if (rj) { packerReturns(st, rj); return; }
    idleAt(st, spreadSpot(st, { x: SPOT.bench.x - 1.8, z: 7.4 }, { x: 0, z: 1.2 }, { x: -1.4, z: 0 }));
  }
