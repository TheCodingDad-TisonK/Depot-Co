//@ photo mode: F9 frees the camera, hides the HUD and holds the clock while you line up a shot
  // ── Photo mode ────────────────────────────────────────────────────
  // 1.16.0. F9 lets go of the player: the camera flies free (WASD, Space up, C down, Shift fast, the mouse looks), the HUD goes,
  // the world holds still, and F12 takes the picture. F9 or Esc puts you back where you were standing.
  var photo = { on: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, speed: 6 };
  function photoToggle(on) {
    if (on === undefined) on = !photo.on; if (on === photo.on) return;
    if (on) {
      if (!ui.started || ui.blocked() || driving || pc.on || edit.on) return;
      photo.on = true; photo.x = camera.position.x; photo.y = camera.position.y; photo.z = camera.position.z; photo.yaw = player.yaw; photo.pitch = player.pitch;
      scanToggle(false); $('dc-hud').hidden = true; dropMarker.g.visible = false; player.keys = {}; sfx('scan');
    } else { photo.on = false; $('dc-hud').hidden = false; hudDirty = true; player.keys = {}; sfx('click'); }
  }
  function photoTick(dt) {
    var k = player.keys, sp = photo.speed * (k.ShiftLeft || k.ShiftRight ? 3 : 1) * dt;
    var cp = Math.cos(photo.pitch), fx = -Math.sin(photo.yaw) * cp, fy = Math.sin(photo.pitch), fz = -Math.cos(photo.yaw) * cp, rx = Math.cos(photo.yaw), rz = -Math.sin(photo.yaw);
    var f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), u = (k.Space ? 1 : 0) - (k.KeyC || k.ControlLeft ? 1 : 0);
    photo.x += (fx * f + rx * r) * sp; photo.y = clamp(photo.y + (fy * f + u) * sp, -1.0, 70); photo.z += (fz * f + rz * r) * sp;
    camera.position.set(photo.x, photo.y, photo.z); camera.rotation.set(photo.pitch, photo.yaw, 0, 'YXZ');
  }
