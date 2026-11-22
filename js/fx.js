// 演出（光・線・揺れ・数字の動きだけで作る。絵の素材は使わない）
window.SR = window.SR || {};
(function () {
  var css = [
    '#fxLayer{position:absolute;inset:0;pointer-events:none;z-index:7;overflow:hidden}',
    '#battle.hd>#fxLayer{z-index:6}',
    '#fxLayer>*{position:absolute}',
    // ---- 画面の揺れ ----
    '.quake1{animation:quake1 .25s}.quake2{animation:quake2 .4s}.quake3{animation:quake3 .65s}',
    '@keyframes quake1{0%,100%{translate:0 0}30%{translate:-4px 2px}70%{translate:4px -2px}}',
    '@keyframes quake2{0%,100%{translate:0 0}15%{translate:-9px 4px}35%{translate:8px -5px}55%{translate:-6px -3px}75%{translate:5px 4px}}',
    '@keyframes quake3{0%,100%{translate:0 0}10%{translate:-16px 7px}22%{translate:14px -9px}36%{translate:-12px -6px}50%{translate:11px 8px}64%{translate:-8px 4px}80%{translate:6px -4px}}',
    // ---- ダメージの数字 ----
    '.fxnum{font-weight:900;white-space:nowrap;transform:translate(-50%,-50%);text-shadow:0 3px 0 #000,0 0 8px #000,0 0 2px #000;animation:fxnum 1.15s cubic-bezier(.2,.9,.3,1) forwards;font-size:calc(var(--fs,1)*24px);color:#fff;letter-spacing:.5px}',
    '.fxnum.t2{font-size:calc(var(--fs,1)*31px);color:#fff3c9}.fxnum.t3{font-size:calc(var(--fs,1)*40px);color:#ffc24a;animation-duration:1.3s}',
    '.fxnum.t4{font-size:calc(var(--fs,1)*50px);color:#ff8a2a;animation-duration:1.45s;text-shadow:0 3px 0 #000,0 0 14px #ff5a00,0 0 3px #000}',
    '.fxnum.t5{font-size:calc(var(--fs,1)*62px);color:#ffe066;animation-duration:1.7s;text-shadow:0 4px 0 #6b3b00,0 0 18px #ffb300,0 0 40px #ff8800,0 0 3px #000}',
    '.fxnum.hurt{color:#ff8d8d}.fxnum.hurt.t3,.fxnum.hurt.t4,.fxnum.hurt.t5{color:#ff4d4d;text-shadow:0 3px 0 #000,0 0 14px #c00000}',
    '.fxnum.best{animation:fxnum 1.9s cubic-bezier(.2,.9,.3,1) forwards;color:#ffe9a8;text-shadow:0 3px 0 #3a2400,0 0 12px rgba(255,214,120,.75)}',   // 2026-11-22 虹色に回るのをやめて、落ち着いた金色に
    '.fxnum small{display:block;font-size:.34em;letter-spacing:2px;text-align:center;margin-bottom:-4px}',
    '@keyframes fxnum{0%{opacity:0;scale:2.6}10%{opacity:1;scale:.86}19%{scale:1.18}28%{scale:1}74%{opacity:1;margin-top:0}100%{opacity:0;margin-top:-46px}}',
    '@keyframes fxhue{to{filter:hue-rotate(360deg)}}',
    '.fxtotal{font-weight:900;white-space:nowrap;transform:translate(-50%,-50%);font-size:calc(var(--fs,1)*34px);color:#fff;padding:2px 16px;border-top:2px solid #ffd76a;border-bottom:2px solid #ffd76a;background:linear-gradient(90deg,transparent,#000c 20%,#000c 80%,transparent);text-shadow:0 2px 0 #000;animation:fxtotal 1.5s forwards}',
    '.fxtotal small{font-size:.5em;color:#ffd76a;margin-right:8px}.fxtotal.big{font-size:calc(var(--fs,1)*48px);color:#ffe066}',
    '@keyframes fxtotal{0%{opacity:0;scale:3 .2}12%{opacity:1;scale:1.12 1.12}20%{scale:1}80%{opacity:1}100%{opacity:0;scale:1.1}}',
    // ---- 光 ----
    '.fxflash{inset:0;background:#fff;animation:fxflash .5s forwards}.fxflash.red{background:#ff2a2a}.fxflash.gold{background:#ffe9a0}.fxflash.long{animation-duration:1.3s}',
    '@keyframes fxflash{0%{opacity:.7}100%{opacity:0}}',
    '.fxdark{inset:0;background:#000;animation:fxdark 1.3s forwards}@keyframes fxdark{0%{opacity:0}15%{opacity:.72}75%{opacity:.72}100%{opacity:0}}',
    // ---- ブレイク ----
    '.fxcrack{width:340px;height:340px;transform:translate(-50%,-50%);animation:fxfade 1.1s forwards}',
    '.fxcrack polyline{fill:none;stroke:#fff;stroke-width:3;stroke-linejoin:bevel;stroke-dasharray:260;stroke-dashoffset:260;animation:fxdraw .28s ease-out forwards;filter:drop-shadow(0 0 5px #9fe3ff)}',
    '@keyframes fxdraw{to{stroke-dashoffset:0}}@keyframes fxfade{0%,70%{opacity:1}100%{opacity:0}}',
    '.fxword{font-weight:900;font-style:italic;white-space:nowrap;transform:translate(-50%,-50%);font-size:calc(var(--fs,1)*58px);letter-spacing:3px;color:#fff;-webkit-text-stroke:2px #1c6dff;text-shadow:0 0 18px #4fc3ff,0 5px 0 #062a66;animation:fxword 1.15s forwards}',
    '.fxword.gold{-webkit-text-stroke:2px #b86a00;text-shadow:0 0 20px #ffcc33,0 5px 0 #5a3000}.fxword.red{-webkit-text-stroke:2px #a00000;text-shadow:0 0 20px #ff4444,0 5px 0 #400000}.fxword.sm{font-size:calc(var(--fs,1)*34px)}',
    '@keyframes fxword{0%{opacity:0;scale:4;rotate:-8deg}14%{opacity:1;scale:.9;rotate:-4deg}24%{scale:1.1}32%{scale:1}82%{opacity:1}100%{opacity:0;scale:1.25}}',
    '#field.brkmode{background:radial-gradient(ellipse at 50% 30%,#1f4a7a 0%,#122448 50%,#070b1c 100%)}',
    '#field.brkmode .enemy.brk>img.mon,#field.brkmode .enemy.brk>svg{transform:rotate(-9deg) translateY(6px);filter:saturate(.45) brightness(1.25) drop-shadow(0 0 12px #6fd0ff);animation:fxwobble 1.4s ease-in-out infinite}',
    '@keyframes fxwobble{50%{transform:rotate(-13deg) translateY(9px)}}',
    // ---- 溜めと大技 ----
    '#field::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:4;opacity:0;box-shadow:inset 0 0 70px 18px #ff2a1a}',
    '#field.chargemode::after{animation:fxvig 1.3s ease-in-out infinite}#field.bigmode::after{animation:fxvig2 .55s ease-in-out infinite}',
    '@keyframes fxvig{0%,100%{opacity:.15}50%{opacity:.6}}@keyframes fxvig2{0%,100%{opacity:.45}50%{opacity:1}}',
    '.fxdot{width:8px;height:8px;border-radius:50%;background:#ffd98a;box-shadow:0 0 10px 3px #ff8a3a;translate:var(--dx) var(--dy);animation:fxin .8s ease-in forwards;animation-delay:var(--dl)}',
    '@keyframes fxin{0%{opacity:0;translate:var(--dx) var(--dy);scale:1.6}25%{opacity:1}100%{opacity:0;translate:0 0;scale:.3}}',
    '.fxshard{width:12px;height:20px;background:linear-gradient(135deg,#fff,#ffb35a);clip-path:polygon(50% 0,100% 60%,40% 100%,0 40%);animation:fxout .9s ease-out forwards}',
    '.fxshard.blue{background:linear-gradient(135deg,#fff,#6fd0ff)}',
    '@keyframes fxout{0%{opacity:1;translate:0 0;rotate:0deg}100%{opacity:0;translate:var(--dx) var(--dy);rotate:var(--rt)}}',
    '.fxcut{left:0;right:0;top:34%;height:74px;display:flex;align-items:center;overflow:hidden;background:linear-gradient(180deg,transparent,#000e 14%,#000e 86%,transparent);border-top:2px solid var(--cc,#ffd76a);border-bottom:2px solid var(--cc,#ffd76a);animation:fxcut 1.25s forwards}',
    '.fxcut b{display:block;white-space:nowrap;font-size:calc(var(--fs,1)*36px);font-style:italic;font-weight:900;letter-spacing:6px;color:#fff;text-shadow:0 0 14px var(--cc,#ffd76a),0 3px 0 #000;animation:fxcutt 1.25s cubic-bezier(.1,.8,.2,1) forwards;padding-left:100%}',
    '.fxcut small{font-size:.5em;letter-spacing:2px;margin-right:14px;color:var(--cc,#ffd76a);font-style:normal}',
    '@keyframes fxcut{0%{scale:1 0;opacity:0}12%{scale:1 1;opacity:1}82%{scale:1 1;opacity:1}100%{scale:1 0;opacity:0}}',
    '@keyframes fxcutt{0%{translate:0 0}22%{translate:-62% 0}78%{translate:-70% 0}100%{translate:-160% 0}}',
    // ---- 終盤の大技 ----
    '.fxfire{inset:0;background:linear-gradient(0deg,#ff5a00 0%,#ff9a1a88 35%,#ffcf5a22 65%,transparent 100%);mix-blend-mode:screen;animation:fxfire 1.25s forwards;transform-origin:50% 100%}',
    '@keyframes fxfire{0%{opacity:0;scale:1 .2}18%{opacity:1;scale:1 1.15}30%{scale:1 .95}45%{scale:1 1.1}75%{opacity:.9}100%{opacity:0;scale:1 1.3}}',
    '.fxember{width:7px;height:7px;border-radius:50%;background:#ffd27a;box-shadow:0 0 8px 2px #ff6a00;animation:fxrise 1.2s ease-out forwards;animation-delay:var(--dl)}',
    '@keyframes fxrise{0%{opacity:0;translate:0 0}15%{opacity:1}100%{opacity:0;translate:var(--dx) var(--dy)}}',
    '.fxstar{width:5px;height:150px;border-radius:3px;background:linear-gradient(180deg,transparent,#9fd4ff 60%,#fff);box-shadow:0 0 12px 2px #7fb8ff;rotate:24deg;animation:fxfall .55s ease-in forwards;animation-delay:var(--dl);opacity:0}',
    '@keyframes fxfall{0%{opacity:0;translate:140px -340px}12%{opacity:1}92%{opacity:1}100%{opacity:0;translate:0 0}}',
    '.fxslash{left:-10%;width:120%;height:7px;background:linear-gradient(90deg,transparent,#fff 20%,#fff 80%,transparent);box-shadow:0 0 18px 5px var(--sc,#9fe3ff);rotate:var(--rt,-18deg);animation:fxslash .55s forwards;animation-delay:var(--dl,0s);opacity:0}',
    '@keyframes fxslash{0%{opacity:1;scale:0 1;transform-origin:0 50%}35%{opacity:1;scale:1 1}60%{opacity:1;scale:1 2.4}100%{opacity:0;scale:1 .1}}',
    // ---- ブースト・交代・倒れる・蘇生 ----
    '.unit.aura1{animation:fxaura .5s ease-in-out infinite alternate}.unit.aura2{animation:fxaura .32s ease-in-out infinite alternate}',
    '@keyframes fxaura{to{filter:brightness(1.3)}}',
    '.fxring{width:40px;height:40px;border-radius:50%;border:4px solid #ffd76a;transform:translate(-50%,-50%);animation:fxring .6s ease-out forwards}.fxring.r2{border-color:#ff7af0}',
    '@keyframes fxring{0%{opacity:1;scale:.4}100%{opacity:0;scale:5}}',
    '.unit.fxrush{animation:fxrush .5s cubic-bezier(.1,.9,.2,1)}@keyframes fxrush{0%{translate:-140px 0;opacity:0}60%{translate:10px 0;opacity:1}100%{translate:0 0}}',
    '.unit.fxsink{animation:fxsink .9s ease-in forwards}@keyframes fxsink{0%{translate:0 0;filter:brightness(2.2)}20%{translate:0 -6px}100%{translate:0 14px;filter:grayscale(1) brightness(.5)}}',
    '.enemy.fxburst{animation:fxburst .9s ease-in forwards}@keyframes fxburst{0%{filter:brightness(3);scale:1}30%{scale:1.14}100%{filter:brightness(6);scale:.5;opacity:0}}',
    '.fxpillar{width:90px;top:0;bottom:0;transform:translateX(-50%);background:linear-gradient(90deg,transparent,#d9ffe6cc 35%,#fff 50%,#d9ffe6cc 65%,transparent);mix-blend-mode:screen;animation:fxpillar 1.2s forwards}',
    '@keyframes fxpillar{0%{opacity:0;scale:.1 1}20%{opacity:1;scale:1.2 1}60%{opacity:1;scale:1 1}100%{opacity:0;scale:.2 1}}',
    // ---- 勝利 ----
    '.result .maxhit b{display:inline-block;font-size:1.9em;color:#ffe066;text-shadow:0 0 14px #ffb300,0 3px 0 #5a3000;animation:fxslam .7s cubic-bezier(.2,1.4,.4,1) .15s both}',
    '.result .maxhit .newbest{display:inline-block;animation:fxslam .6s cubic-bezier(.2,1.4,.4,1) .7s both;color:#ffe08a}',
    '@keyframes fxslam{0%{opacity:0;scale:5}60%{opacity:1;scale:.9}100%{scale:1}}',
    '@media (max-width:640px){.fxnum.t5{font-size:calc(var(--fs,1)*50px)}.fxnum.t4{font-size:calc(var(--fs,1)*42px)}.fxword{font-size:calc(var(--fs,1)*44px)}.fxcut b{font-size:calc(var(--fs,1)*28px)}.fxcut{height:60px}.fxtotal.big{font-size:calc(var(--fs,1)*38px)}.fxcrack{width:260px;height:260px}}',
    '@media (prefers-reduced-motion:reduce){.quake1,.quake2,.quake3{animation:none}.fxflash{display:none}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function field() { return document.getElementById('field'); }
  function layer() {
    var l = document.getElementById('fxLayer');
    if (!l) { l = document.createElement('div'); l.id = 'fxLayer'; }
    // 2026-11-22：戦闘画面（HD）では、カットイン・味方の帯・コマンドより手前に出す（戦場は画面いっぱいなので位置は同じ）
    var bt = document.getElementById('battle'), par = bt && bt.classList.contains('hd') ? bt : field();
    if (l.parentNode !== par) par.appendChild(l);
    return l;
  }
  function add(cls, html, ms, x, y, style) {
    var d = document.createElement('div'); d.className = cls; if (html) d.innerHTML = html;
    if (x !== undefined && x !== null) d.style.left = x + 'px';
    if (y !== undefined && y !== null) d.style.top = y + 'px';
    if (style) Object.keys(style).forEach(function (k) { d.style.setProperty(k, style[k]); });
    layer().appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, ms || 1200);
    return d;
  }
  // ユニットの中心（#field の中での位置）
  function at(el) {
    var f = field().getBoundingClientRect();
    if (!el) return { x: f.width / 2, y: f.height / 2, w: f.width, h: f.height };
    var pic = (el.classList.contains('enemy') && el.querySelector('img.mon, svg')) || el, r = pic.getBoundingClientRect();
    return { x: r.left - f.left + r.width / 2, y: r.top - f.top + r.height / 2, w: f.width, h: f.height };
  }
  function clampX(x, w, m) { return Math.max(m, Math.min(w - m, x)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function quake(n) {
    var f = field(); f.classList.remove('quake1', 'quake2', 'quake3'); void f.offsetWidth; f.classList.add('quake' + n);
    setTimeout(function () { f.classList.remove('quake' + n); }, 700);
  }
  function burst(p, n, cls, dist) {
    for (var i = 0; i < n; i++) {
      var a = Math.PI * 2 * i / n + rnd(-.3, .3), d = rnd(dist * .5, dist);
      add(cls, '', 1000, p.x, p.y, { '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px', '--rt': rnd(-540, 540) + 'deg' });
    }
  }
  function tier(v) { return v >= 10000 ? 5 : v >= 5000 ? 4 : v >= 2000 ? 3 : v >= 700 ? 2 : 1; }
  var slot = 0;

  SR.fx = {
    quake: quake,
    // ダメージの数字。大きいほど大きく、色も変わる
    num: function (el, v, o) {
      o = o || {};
      var p = at(el), t = tier(v), jx = [0, -34, 30, -16, 40, -44, 18][slot % 7], jy = [0, -22, 14, 30, -34, 6, -12][slot % 7]; slot++;
      // 味方の帯（下）に重なるときは、帯の上まで持ち上げる
      var hud = document.getElementById('partyHud'), fr = field().getBoundingClientRect();
      if (hud && hud.offsetParent) { var top = hud.getBoundingClientRect().top - fr.top - 18 - t * 8; if (p.y + jy - 10 > top) p.y = top - jy + 10; }
      // カットインが出ているときは、その絵より左に出す（絵と重ならないように）
      var ci = document.querySelector('#cutin:not(.hidden) img');
      if (ci && !o.hurt) { var cl = ci.getBoundingClientRect().left - fr.left + ci.getBoundingClientRect().width * .18, half = 40 + t * 22; if (p.x + jx + half > cl) p.x = cl - half - jx; }
      var cls = 'fxnum t' + t + (o.hurt ? ' hurt' : '') + (o.best ? ' best' : '');
      add(cls, (o.best ? '<small>自己ベスト！</small>' : '') + Math.round(v).toLocaleString(), 1900, clampX(p.x + jx, p.w, 30 + t * 14), Math.max(26, p.y + jy - 10));
      if (o.hurt) { if (t >= 3 || o.big) quake(o.big ? 3 : 2); }
      else if (t >= 5) { quake(3); add('fxflash gold', '', 500); }
      else if (o.best) quake(2);   // 自己ベストは、ゆれだけ（光らせない）
      else if (t >= 4) quake(2);
      else if (t >= 3) quake(1);
    },
    resetSlot: function () { slot = 0; },
    // 斬撃の線（当たったところに3本走る）
    slash: function (el, big, col) { var p = at(el); add('fxslash' + (big ? ' big' : ''), '<i></i><i></i><i></i>', 600, p.x, p.y, col ? { '--hc': col } : null); if (big) add('fxflash', '', 260); },   // col：技を出した人の色
    total: function (el, sum, n) {
      var p = at(el), big = sum >= 5000;
      add('fxtotal' + (big ? ' big' : ''), '<small>' + n + 'ヒット 合計</small>' + Math.round(sum).toLocaleString(), 1500, p.w / 2, Math.max(40, p.y - 70));
      if (big) quake(2);
    },
    // 2026-11-22 サニー：ブレイクした敵を中心に、画面全体がガラスのように割れて、破片が少しずつ傾く
    shatter: function (cx, cy) {
      if (!SR.stage3d || !SR.stage3d.snap) return;
      var snap = null; try { snap = SR.stage3d.snap(); } catch (e) {}
      var gl = document.querySelector('#battle canvas'); if (!snap || !gl) return;
      var L = layer(), lr = L.getBoundingClientRect(), gr = gl.getBoundingClientRect(), W = lr.width, H = lr.height, dpr = Math.min(2, window.devicePixelRatio || 1);
      var D = Math.max(W, H), n = 11, ang = [], i, k;
      for (i = 0; i < n; i++) ang.push(Math.PI * 2 * i / n + rnd(-.18, .18));
      var radii = [0, D * rnd(.1, .14), D * rnd(.3, .38), D * 1.6], P = radii.map(function (r, kk) {
        return ang.map(function (a) { var rr = kk === 0 ? 0 : r * rnd(.85, 1.15); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
      });
      var wrap = add('fxsh', '', 950, 0, 0); wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
      for (k = 0; k < 3; k++) for (i = 0; i < n; i++) {
        var j = (i + 1) % n, poly = k === 0 ? [[cx, cy], P[1][i], P[1][j]] : [P[k][i], P[k + 1][i], P[k + 1][j], P[k][j]];
        var c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.className = 'fxsh-pc';
        var g = c.getContext('2d'); g.scale(dpr, dpr);
        g.beginPath(); poly.forEach(function (q, m) { if (m) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); g.save(); g.clip();
        g.drawImage(snap, gr.left - lr.left, gr.top - lr.top, gr.width, gr.height);
        var sh = g.createLinearGradient(cx - D * .3, cy - D * .3, cx + D * .3, cy + D * .3);   // ガラスの照り
        sh.addColorStop(0, 'rgba(255,255,255,' + rnd(0, .14).toFixed(2) + ')'); sh.addColorStop(1, 'rgba(160,210,255,0)'); g.fillStyle = sh; g.fill();
        g.restore(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(235,248,255,.9)'; g.shadowColor = '#8fd8ff'; g.shadowBlur = 8; g.stroke();
        var mx = poly.reduce(function (s, q) { return s + q[0]; }, 0) / poly.length, my = poly.reduce(function (s, q) { return s + q[1]; }, 0) / poly.length;
        var out = 3 + k * 5, dx = mx - cx, dy = my - cy, dl = Math.hypot(dx, dy) || 1;
        c.style.transformOrigin = mx + 'px ' + my + 'px';
        c.style.setProperty('--tx', (dx / dl * out).toFixed(1) + 'px'); c.style.setProperty('--ty', (dy / dl * out).toFixed(1) + 'px');
        c.style.setProperty('--rz', rnd(-3.5, 3.5).toFixed(2) + 'deg'); c.style.setProperty('--rx', rnd(-9, 9).toFixed(1) + 'deg'); c.style.setProperty('--ry', rnd(-9, 9).toFixed(1) + 'deg');
        c.style.setProperty('--fy', (40 + k * 40 + rnd(0, 40)).toFixed(0) + 'px'); c.style.setProperty('--dl', (k * .03 + rnd(0, .04)).toFixed(2) + 's');
        wrap.appendChild(c);
      }
    },
    // ブレイク（2026-11-22 サニー：もっとかっこよく）：まわりが沈み、衝撃の輪・ひび・ガラスの破片。BREAK の文字が中央から開く
    breakHit: function (el, hero) {
      var p = at(el);
      if (hero) { add('fxflash red', '', 400); add('fxword red sm', 'BREAK', 1150, clampX(p.x, p.w, 70), p.y); quake(2); return; }
      SR.fx.shatter(p.x, p.y);   // 画面が割れる
      add('fxbk-dim', '', 1300);
      add('fxbk-core', '', 700, p.x, p.y);
      add('fxbk-ring', '', 900, p.x, p.y); add('fxbk-ring r2', '', 1100, p.x, p.y);
      var lines = '';
      for (var i = 0; i < 11; i++) {
        var a = Math.PI * 2 * i / 11 + rnd(-.25, .25), pts = '170,170', r = 0;
        for (var j = 0; j < 4; j++) { r += rnd(24, 44); var b = a + rnd(-.4, .4); pts += ' ' + (170 + Math.cos(b) * r).toFixed(0) + ',' + (170 + Math.sin(b) * r).toFixed(0); }
        lines += '<polyline points="' + pts + '" style="animation-delay:' + (i * 0.012).toFixed(3) + 's"/>';
      }
      add('fxcrack bk', '<svg viewBox="0 0 340 340" width="100%" height="100%">' + lines + '</svg>', 1100, p.x, p.y);
      for (var k = 0; k < 20; k++) {   // ガラスの破片：大きさ・形・回り方を少しずつ変える
        var ang = rnd(0, Math.PI * 2), d = rnd(110, 260), s = rnd(.6, 1.5);
        add('fxbk-shard s' + (k % 4), '', 1100, p.x, p.y, { '--dx': Math.cos(ang) * d + 'px', '--dy': Math.sin(ang) * d * .8 + rnd(20, 60) + 'px', '--rt': rnd(-720, 720) + 'deg', '--sc': s.toFixed(2), '--dl': rnd(0, .08).toFixed(2) + 's' });
      }
      add('fxbk-title', '<i class="ln"></i><b data-t="BREAK">BREAK</b><i class="ln"></i><small>守りが崩れた　順番が下がる</small>', 1500, p.w / 2, Math.max(70, Math.min(p.h * .42, p.y - 20)));
      try { if (SR.stage3d && SR.stage3d.hit && el && el.id) SR.stage3d.hit(el.id.replace(/^u-/, ''), 3, '#9fe0ff'); } catch (e) {}
      quake(3);
    },
    // 溜め：光が集まる
    charge: function (el) {
      var p = at(el);
      for (var i = 0; i < 22; i++) {
        var a = rnd(0, Math.PI * 2), d = rnd(120, 230);
        add('fxdot', '', 1500, p.x, p.y, { '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px', '--dl': rnd(0, .5).toFixed(2) + 's' });
      }
      add('fxflash red', '', 350); quake(1);
    },
    // 大技：暗くなって、名前が横切る
    big: function (name) {
      add('fxdark', '', 1300);
      add('fxcut', '<b><small>' + name + '</small>大技</b>', 1250, null, null, { '--cc': '#ff4a3a' });
      quake(2);
    },
    // 大技を止めた（2026-11-22 サニー：もっとかっこよく）：溜めた赤い光が一点に吸いこまれて、金の光で砕ける。斜めの帯に「大技を止めた」
    stop: function (el) {
      var p = at(el);
      add('fxst-dim', '', 1500);
      add('fxst-implode', '', 450, p.x, p.y);
      setTimeout(function () {
        add('fxflash gold', '', 420);
        add('fxbk-ring gold', '', 900, p.x, p.y); add('fxbk-ring gold r2', '', 1100, p.x, p.y);
        for (var k = 0; k < 22; k++) { var ang = rnd(0, Math.PI * 2), d = rnd(120, 280); add('fxbk-shard gold s' + (k % 4), '', 1100, p.x, p.y, { '--dx': Math.cos(ang) * d + 'px', '--dy': Math.sin(ang) * d * .8 + rnd(10, 50) + 'px', '--rt': rnd(-720, 720) + 'deg', '--sc': rnd(.5, 1.3).toFixed(2), '--dl': '0s' }); }
        add('fxst-band', '<div class="in"><small>INTERRUPT</small><b>大技を止めた</b></div>', 1500, null, null);
        quake(3);
      }, 330);
    },
    cutin: function (who, name, color) { add('fxcut', '<b><small>' + who + '</small>' + name + '</b>', 1250, null, null, { '--cc': color || '#ffd76a' }); },
    // 終盤の大技
    skill: function (id, who, targetEl) {
      var p = at(targetEl), i;
      if (id === '業火' || id === '灰燼') {
        SR.fx.cutin(who, SR.skillName(id), '#ff7a1a'); add('fxfire', '', 1250);
        for (i = 0; i < 26; i++) add('fxember', '', 1700, rnd(0, p.w), p.h - rnd(0, 40), { '--dx': rnd(-50, 50) + 'px', '--dy': -rnd(160, p.h) + 'px', '--dl': rnd(0, .5).toFixed(2) + 's' });
        setTimeout(function () { quake(3); }, 250);
      } else if (id === '星落とし') {
        SR.fx.cutin(who, SR.skillName(id), '#7fb8ff'); add('fxdark', '', 1300);
        for (i = 0; i < 16; i++) add('fxstar', '', 1400, rnd(p.w * .08, p.w * .92), rnd(p.h * .12, p.h * .5), { '--dl': (0.15 + i * 0.045).toFixed(2) + 's' });
        setTimeout(function () { quake(3); add('fxflash', '', 400); }, 800);
      } else if (id === '決死の一閃') {
        SR.fx.cutin(who, SR.skillName(id), '#fff');
        add('fxdark', '', 1000);
        add('fxslash', '', 1100, null, p.y, { '--dl': '.45s', '--rt': '-14deg', '--sc': '#fff' });
        setTimeout(function () { add('fxflash', '', 450); quake(3); }, 650);
      } else if (id === '捨て身斬り') {
        SR.fx.cutin(who, SR.skillName(id), '#ff4a4a');
        add('fxslash', '', 1000, null, p.y, { '--dl': '.35s', '--rt': '-28deg', '--sc': '#ff4a4a' });
        add('fxslash', '', 1100, null, p.y, { '--dl': '.5s', '--rt': '28deg', '--sc': '#ff4a4a' });
        setTimeout(function () { add('fxflash red', '', 400); quake(3); }, 600);
      } else SR.fx.cutin(who, id);
    },
    boost: function (el, n) {
      if (!el) return; el.classList.add('aura' + n);
      var p = at(el); add('fxring' + (n >= 2 ? ' r2' : ''), '', 600, p.x, p.y);
      if (n >= 2) setTimeout(function () { add('fxring r2', '', 600, p.x, p.y); }, 140);
    },
    rush: function (el) { if (el) { el.classList.add('fxrush'); var p = at(el); add('fxring', '', 600, p.x, p.y); } },
    down: function (el, hero) {
      if (!el) return;
      if (hero) { el.classList.add('fxsink'); add('fxflash red', '', 350); quake(2); }
      else { el.classList.remove('down'); el.classList.add('fxburst'); burst(at(el), 16, 'fxshard', 200); quake(2); }
    },
    revive: function (el) {
      var p = at(el); add('fxpillar', '', 1200, p.x, null); add('fxflash gold', '', 450);
      for (var i = 0; i < 12; i++) add('fxember', '', 1500, p.x + rnd(-30, 30), p.y + rnd(0, 40), { '--dx': rnd(-20, 20) + 'px', '--dy': -rnd(80, 180) + 'px', '--dl': rnd(0, .4).toFixed(2) + 's' });
    },
    // とどめ（2026-11-22 サニー：かっこよく）：時が止まったように色が抜け、画面を一閃が走る。光の筋が回り、金の輪と火の粉。「撃破」が筆のように現れる
    finale: function (el) {
      var A = at(), p = el ? at(el) : { x: A.w / 2, y: A.h * .45, w: A.w, h: A.h };
      add('fxflash', '', 260);
      add('fxfin-mono', '', 1000);
      add('fxfin-slash', '<i></i>', 700, p.x, p.y, { '--rz': rnd(-28, -14).toFixed(1) + 'deg' });
      quake(3);
      setTimeout(function () {
        add('fxfin-rays', '', 1600, p.x, p.y);
        add('fxbk-ring gold', '', 900, p.x, p.y); add('fxbk-ring gold r2', '', 1150, p.x, p.y);
        for (var i = 0; i < 26; i++) add('fxember', '', 1700, p.x + rnd(-60, 60), p.y + rnd(-10, 50), { '--dx': rnd(-80, 80) + 'px', '--dy': -rnd(120, 300) + 'px', '--dl': rnd(0, .5).toFixed(2) + 's' });
        try { if (SR.stage3d && SR.stage3d.hit && el && el.id) SR.stage3d.hit(el.id.replace(/^u-/, ''), 3, '#ffd27a'); } catch (e) {}
        add('fxfin-title', '<small>FINISH</small><b><span>撃</span><span>破</span></b><i class="ln"></i>', 1600, A.w / 2, Math.max(80, A.h * .4));
        quake(2);
      }, 220);
    },
    mood: function (brk, charge) {
      var f = field(); if (!f) return;
      f.classList.toggle('brkmode', !!brk);
      f.classList.toggle('chargemode', charge === 1 && !brk);
      f.classList.toggle('bigmode', charge === 2 && !brk);
    }
  };
})();
