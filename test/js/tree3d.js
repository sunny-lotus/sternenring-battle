// 技の書の3Dツリー（2026-11-21 手元の試作）。
// 四つの角柱＝四つの体系（構築・循環・観測・干渉）。高さ＝初級・中級・上級。
// 透明な部分＝本で上がった上限、色＝たまった経験値。色が星の高さを超えると覚える。
// 柱のあいだ・まん中に浮かぶ星は、関わる柱すべての色がその高さを超えると覚える（2〜4つの体系の組み合わせ）。
// ドラッグで回す・2本指やホイールでズーム・柱を押すとその柱に寄る。外部ライブラリは使わず、canvasで描く。
var SR = window.SR || (window.SR = {});

SR.tree3d = (function () {
  var yaw = -0.6, pitch = 0.3, zoom = 1, camX = 0, camZ = 0, camY = 1.9, focusSys = null, aim = null;
  var lastTap = { t: 0, x: 0, y: 0 }, cv = null, ctx = null, model = null, raf = 0, idleUntil = 0, drag = null, onPick = null, W = 0, H = 0, dpr = 1, pts = {}, pinch = null;
  var D = 2.3, PW = 0.3, U = 1.05, TOP = 3 * U + 0.15;   // U：一段（初級・中級・上級）の高さ
  // 柱の位置（正方形の四隅）。となりどうし：構築-循環-観測-干渉-構築
  var PIL = { 構築: [-D, -D], 循環: [D, -D], 観測: [D, D], 干渉: [-D, D] };
  var COL = { 構築: [232, 195, 114], 循環: [110, 210, 200], 観測: [150, 160, 255], 干渉: [235, 120, 120] };

  function proj(x, y, z) {
    x -= camX; z -= camZ;   // 見ている中心（柱に寄るとき動く）
    var cy = Math.cos(yaw), sy = Math.sin(yaw), x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    var yc = y - camY, cp = Math.cos(pitch), sp = Math.sin(pitch), y2 = yc * cp + z1 * sp, z2 = -yc * sp + z1 * cp;   // 上から見下ろす：奥ほど画面の上・小さく
    var f = 16, s = Math.min(W * 0.7, H * 1.2) * 0.11 * zoom * f / (f + z2);
    return { x: W / 2 + x1 * s, y: H * 0.42 - y2 * s, z: z2, s: s };
  }
  function Y(h) { return (SR.visH ? SR.visH(h) : h / 3) * 3 * U; }   // 高さ（段）→ 見た目の高さ。段の長さは経験値に比例
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  // 星の3D位置
  function layout(m) {
    var pos = {};
    SR.baseSystems.forEach(function (s) {
      var p = PIL[s], out = Math.atan2(p[1], p[0]);   // 外向き
      [1, 2, 3].forEach(function (t) {
        var col = m.nodes.filter(function (n) { return n.sys === s && n.tier === t && !n.combo; });
        col.forEach(function (n, i) {
          var spread = col.length > 1 ? (i - (col.length - 1) / 2) * 0.95 : 0, a = out + spread, r = PW + 0.3;
          pos[n.id] = [p[0] + Math.cos(a) * r, Y(n.h), p[1] + Math.sin(a) * r];
        });
      });
    });
    m.nodes.forEach(function (n) {
      if (!n.combo) return;
      var mx = 0, mz = 0; n.combo.forEach(function (s) { mx += PIL[s][0]; mz += PIL[s][1]; });
      mx /= n.combo.length; mz /= n.combo.length;
      var sc = n.combo.length === 2 ? 1.08 : 1;
      pos[n.id] = [mx * sc, Y(n.h), mz * sc];   // 関わる柱のまん中に置く
    });
    return pos;
  }

  function draw() {
    if (!cv || !model) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var g = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.5, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#1f2558'); g.addColorStop(1, '#080a1a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var pos = model.pos, items = [];
    // 台座の円
    ctx.strokeStyle = 'rgba(232,195,114,.25)'; ctx.lineWidth = 1; ctx.beginPath();
    for (var i = 0; i <= 48; i++) { var a = i / 48 * Math.PI * 2, q = proj(Math.cos(a) * 3.8, 0, Math.sin(a) * 3.8); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
    ctx.stroke();
    // 段の高さの目印
    [1, 2, 3].forEach(function (t) {
      var pp = ['構築', '循環', '観測', '干渉', '構築'].map(function (s) { var p = PIL[s]; return proj(p[0] * 1.32, Y(t), p[1] * 1.32); });
      ctx.strokeStyle = 'rgba(232,195,114,.18)'; ctx.setLineDash([4, 5]);
      ctx.beginPath(); pp.forEach(function (q, i) { i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke(); ctx.setLineDash([]);
    });
    // 柱
    SR.baseSystems.forEach(function (s) {
      var p = PIL[s], c = COL[s];
      var corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (k) { return [p[0] + k[0] * PW, p[1] + k[1] * PW]; });
      var capH = Y(model.cap[s] || 0), fillH = Y(model.fill[s] || 0), hot = focusSys === s;
      function face(a, b, y0, y1, kind) {
        var q = [proj(a[0], y0, a[1]), proj(b[0], y0, b[1]), proj(b[0], y1, b[1]), proj(a[0], y1, a[1])];
        var z = (q[0].z + q[1].z + q[2].z + q[3].z) / 4;
        items.push({ z: z + 0.6, fn: function () {
          ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); for (var i = 1; i < 4; i++) ctx.lineTo(q[i].x, q[i].y); ctx.closePath();
          if (kind === 'fill') {
            var gr = ctx.createLinearGradient(q[0].x, q[0].y, q[3].x, q[3].y);
            gr.addColorStop(0, rgba(c, .75)); gr.addColorStop(1, rgba(c, .45));
            ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = rgba(c, .9); ctx.lineWidth = 1; ctx.stroke();
          } else if (kind === 'glass') {
            ctx.fillStyle = 'rgba(210,225,255,' + (hot ? .1 : .06) + ')'; ctx.fill(); ctx.strokeStyle = 'rgba(210,225,255,' + (hot ? .7 : .45) + ')'; ctx.lineWidth = 1; ctx.stroke();
          } else { ctx.setLineDash([3, 5]); ctx.strokeStyle = rgba(c, .25); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
        } });
      }
      for (var f = 0; f < 4; f++) {
        var a = corners[f], b = corners[(f + 1) % 4];
        if (fillH > 0) face(a, b, 0, fillH, 'fill');
        if (capH > fillH) face(a, b, fillH, capH, 'glass');
        if (TOP > capH) face(a, b, capH, TOP, 'ghost');
      }
      // 本の上限の線
      var capq = corners.concat([corners[0]]).map(function (k) { return proj(k[0], capH, k[1]); });
      items.push({ z: capq[0].z + 0.5, fn: function () { ctx.strokeStyle = '#f2d48a'; ctx.lineWidth = 1.5; ctx.beginPath(); capq.forEach(function (q, i) { i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke(); } });
      // 台座の名前
      var base = proj(p[0] * 1.25, -0.05, p[1] * 1.25);
      items.push({ z: base.z - 5, fn: function () {
        ctx.font = '700 ' + Math.max(12, Math.min(26, base.s * 0.17)) + 'px "Shippori Mincho B1", serif'; ctx.textAlign = 'center';
        ctx.fillStyle = rgba(c, .95); ctx.fillText(s + (model.fav === s ? '（得意）' : ''), base.x, base.y + 14);
        ctx.font = Math.max(10, Math.min(18, base.s * 0.12)) + 'px sans-serif'; ctx.fillStyle = '#b9bfe0'; ctx.fillText(model.count[s], base.x, base.y + 28);
      } });
    });
    // 線：前の技→次の技、組み合わせの星へは柱から光の線
    model.nodes.forEach(function (n) {
      var b = pos[n.id], froms = n.req.map(function (r) { return { p: pos[r], lit: model.state[r] === 'got' && n.state === 'got' }; });
      if (n.combo) n.combo.forEach(function (s) { froms.push({ p: [PIL[s][0], Y(n.h), PIL[s][1]], lit: (model.fill[s] || 0) >= n.h, beam: true }); });
      if (!froms.length) froms.push({ p: [PIL[n.sys][0], 0, PIL[n.sys][1]], lit: n.state === 'got' });
      froms.forEach(function (fr) {
        if (!fr.p) return;
        var qa = proj(fr.p[0], fr.p[1], fr.p[2]), qb = proj(b[0], b[1], b[2]), lit = fr.lit;
        items.push({ z: (qa.z + qb.z) / 2 + 0.05, fn: function () {
          ctx.strokeStyle = lit ? 'rgba(242,212,138,.95)' : fr.beam ? 'rgba(143,224,208,.35)' : 'rgba(120,126,170,.45)'; ctx.lineWidth = lit ? 2.2 : 1.2;
          ctx.setLineDash(lit ? [] : [3, 4]); ctx.beginPath(); ctx.moveTo(qa.x, qa.y); ctx.lineTo(qb.x, qb.y); ctx.stroke(); ctx.setLineDash([]);
        } });
      });
    });
    // 星
    model.hits = [];
    model.nodes.forEach(function (n) {
      var p = pos[n.id], q = proj(p[0], p[1], p[2]);
      model.hits.push({ id: n.id, x: q.x, y: q.y, z: q.z, r: Math.max(14, q.s * 0.16) });
      items.push({ z: q.z - 0.1, fn: function () {
        var r = q.s * (n.stat ? 0.07 : 0.12), front = q.z < 0.2 || model.sel === n.id, got = n.state === 'got', can = n.state === 'can';
        var tw = can ? 0.5 + 0.5 * Math.sin(Date.now() / 260) : 0;
        ctx.save();
        ctx.globalAlpha = n.state === 'lock' ? 0.5 : 1;
        if (got || can) { ctx.shadowColor = got ? '#f2d48a' : '#ffd27a'; ctx.shadowBlur = got ? 14 : 6 + tw * 10; }
        ctx.fillStyle = got ? '#f2d48a' : can ? '#3a4a8a' : '#2b2f55';
        ctx.strokeStyle = got ? '#fff6dc' : can ? 'rgba(255,255,255,' + (0.7 + tw * 0.3) + ')' : '#6b6f90'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (n.stat) ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
        else { for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.3 : r; ctx.lineTo(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr); } ctx.closePath(); }
        ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
        if (n.combo) {   // 輪の数＝関わる体系の数-1
          ctx.strokeStyle = got ? '#f2d48a' : 'rgba(143,224,208,.85)'; ctx.lineWidth = 1.2;
          for (var k = 1; k < n.combo.length; k++) { ctx.beginPath(); ctx.arc(q.x, q.y, r * (1.2 + k * 0.3), 0, Math.PI * 2); ctx.stroke(); }
        }
        if (model.sel === n.id) { ctx.strokeStyle = '#8fb4ff'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(q.x, q.y, r * 2.2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        ctx.globalAlpha *= front ? 1 : (got || can ? 0.6 : 0.18);
        var fs = Math.max(11, Math.min(20, q.s * 0.12)), ty = q.y + r + fs + 1;
        ctx.font = (got ? '700 ' : '') + fs + 'px sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,26,.85)'; ctx.strokeText(n.id, q.x, ty);
        ctx.fillStyle = got ? '#f6e2a8' : can ? '#ffffff' : '#a9aed0'; ctx.fillText(n.id, q.x, ty);
        ctx.restore();
      } });
    });
    items.sort(function (a, b) { return b.z - a.z; });
    items.forEach(function (it) { it.fn(); });
    if (focusSys) {
      ctx.font = '700 15px "Shippori Mincho B1", serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#f6e2a8';
      ctx.fillText(focusSys + 'の柱（ダブルクリックで戻る）', 10, 20);
    }
  }

  function loop() {
    raf = 0;
    if (!cv || !document.body.contains(cv) || cv.offsetParent === null) return;
    if (aim) {   // 柱へ寄る・戻る動き
      var k = 0.14, dy = Math.atan2(Math.sin(aim.yaw - yaw), Math.cos(aim.yaw - yaw));
      yaw += dy * k; zoom += (aim.zoom - zoom) * k; camX += (aim.x - camX) * k; camZ += (aim.z - camZ) * k; camY += (aim.y - camY) * k;
      if (Math.abs(dy) < 0.002 && Math.abs(aim.zoom - zoom) < 0.01 && Math.abs(aim.x - camX) < 0.01) aim = null;
    } else if (!drag && !focusSys && Date.now() > idleUntil) yaw += 0.0035;
    draw();
    raf = requestAnimationFrame(loop);
  }
  // 柱を押した：その柱を正面に回して寄る
  function pickPillar(x, y) {
    var best = null;
    SR.baseSystems.forEach(function (s) {
      var p = PIL[s], a = proj(p[0], 0, p[1]), b = proj(p[0], TOP, p[1]);
      var vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1)));
      var d = Math.hypot(a.x + vx * t - x, a.y + vy * t - y), lim = Math.max(18, PW * a.s * 1.6);
      if (d <= lim && (!best || a.z < best.z)) best = { s: s, z: a.z };
    });
    return best && best.s;
  }
  function focusOn(s) {
    focusSys = s;
    if (!s) { aim = { yaw: yaw, zoom: 1, x: 0, z: 0, y: 1.9 }; return; }
    var p = PIL[s], th = Math.atan2(p[1], p[0]);
    aim = { yaw: -Math.PI / 2 - th, zoom: 2.4, x: p[0], z: p[1], y: 1.75 };
  }
  function pick(x, y) {
    var best = null;
    (model.hits || []).forEach(function (h) {
      var d = Math.hypot(h.x - x, h.y - y);
      if (d <= h.r && (!best || h.z < best.z)) best = h;
    });
    return best;
  }
  function size() {
    var r = cv.getBoundingClientRect(); dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function zoomBy(f) { zoom = Math.max(0.6, Math.min(3.5, zoom * f)); idleUntil = Date.now() + 5000; aim = null; }
  function mount(el, m, pickFn) {
    cv = el; ctx = cv.getContext('2d'); model = m; onPick = pickFn; pts = {}; pinch = null;
    model.pos = layout(m);
    model.state = {}; m.nodes.forEach(function (n) { model.state[n.id] = n.state; });
    size();
    cv.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = [e.clientX, e.clientY];
      var k = Object.keys(pts);
      if (k.length === 2) { drag = null; pinch = { d: Math.hypot(pts[k[0]][0] - pts[k[1]][0], pts[k[0]][1] - pts[k[1]][1]), z: zoom }; return; }
      drag = { x: e.clientX, y: e.clientY, yaw: yaw, pitch: pitch, moved: 0 };
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    });
    cv.addEventListener('pointermove', function (e) {
      if (pts[e.pointerId]) pts[e.pointerId] = [e.clientX, e.clientY];
      var k = Object.keys(pts);
      if (pinch && k.length === 2) { var d = Math.hypot(pts[k[0]][0] - pts[k[1]][0], pts[k[0]][1] - pts[k[1]][1]); zoom = Math.max(0.6, Math.min(3.5, pinch.z * d / pinch.d)); aim = null; idleUntil = Date.now() + 5000; return; }
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
      if (drag.moved > 4) aim = null;
      yaw = drag.yaw + dx * 0.01; pitch = Math.max(0.05, Math.min(0.9, drag.pitch + dy * 0.006));
    });
    function up(e) {
      var wasPinch = !!pinch; delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null;
      var d = drag; drag = null; idleUntil = Date.now() + 5000;
      if (wasPinch || !d || d.moved >= 8) return;
      var r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, h = pick(px, py);
      // ダブルクリック（ダブルタップ）でズーム：柱の上ならその柱に寄る、ほかは大きく／もとに戻す
      var now = Date.now(), dbl = now - lastTap.t < 380 && Math.hypot(px - lastTap.x, py - lastTap.y) < 30;
      lastTap = dbl ? { t: 0, x: 0, y: 0 } : { t: now, x: px, y: py };
      if (dbl) {
        var ps = pickPillar(px, py);
        if (ps && ps !== focusSys) focusOn(ps);
        else if (focusSys || zoom > 1.3) focusOn(null);
        else aim = { yaw: yaw, zoom: 1.9, x: camX, z: camZ, y: camY };
        return;
      }
      if (h && onPick) onPick(h.id);   // 1回押す：星を選ぶ
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', function (e) { delete pts[e.pointerId]; pinch = null; drag = null; });
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function turn(d) { yaw += d; idleUntil = Date.now() + 5000; aim = null; }
  window.addEventListener('resize', function () { if (cv && document.body.contains(cv)) size(); });
  return { mount: mount, turn: turn, zoomBy: zoomBy, focus: function (s) { focusOn(s); }, focused: function () { return focusSys; } };
})();
