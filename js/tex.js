// 2026-11-22 サニー：メニューを「冒険の書」に。革の表紙と、古い羊皮紙のページの手ざわりを、その場で描いて背景に貼る（外の画像は使わない）。
// つなぎ目が出ないように、くり返しても続く模様（周期のあるノイズ）で作る。
(function () {
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  // 周期 p のマス目の値をなめらかにつなぐノイズ（タイルしても切れ目が出ない）
  function noiseLayer(N, p, R) {
    var g = new Float32Array(p * p), out = new Float32Array(N * N), i, x, y;
    for (i = 0; i < g.length; i++) g[i] = R();
    var sm = function (t) { return t * t * (3 - 2 * t); };
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var fx = x / N * p, fy = y / N * p, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      var a = g[(y0 % p) * p + x0 % p], b = g[(y0 % p) * p + (x0 + 1) % p], c = g[((y0 + 1) % p) * p + x0 % p], d = g[((y0 + 1) % p) * p + (x0 + 1) % p];
      out[y * N + x] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
    }
    return out;
  }
  function fbm(N, R, periods, weights) {
    var acc = new Float32Array(N * N), tw = 0;
    periods.forEach(function (p, k) { var L = noiseLayer(N, p, R), w = weights[k]; tw += w; for (var i = 0; i < acc.length; i++) acc[i] += L[i] * w; });
    for (var i = 0; i < acc.length; i++) acc[i] /= tw;
    return acc;
  }
  function canvas(N) { var c = document.createElement('canvas'); c.width = c.height = N; return c; }

  // 革：こげ茶。大きなむら＋細かい「しぼ」（小さな粒）＋うすい擦れ
  function leather() {
    var N = 384, R = rng(77), c = canvas(N), g = c.getContext('2d'), im = g.createImageData(N, N), d = im.data;
    var big = fbm(N, R, [3, 6, 12], [1, .6, .35]), grain = fbm(N, R, [96, 192], [1, .8]), pebble = fbm(N, R, [128], [1]);
    for (var i = 0; i < N * N; i++) {
      var v = (big[i] - .5) * 34 + (grain[i] - .5) * 14 + (pebble[i] - .5) * 16;
      d[i * 4] = Math.max(0, Math.min(255, 62 + v)); d[i * 4 + 1] = Math.max(0, Math.min(255, 38 + v * .78)); d[i * 4 + 2] = Math.max(0, Math.min(255, 24 + v * .55)); d[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    g.globalAlpha = .06; g.strokeStyle = '#f0d8b0'; g.lineWidth = 1;   // 擦れ
    for (var k = 0; k < 40; k++) { var x = R() * N, y = R() * N, a = R() * Math.PI; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20 + 6, x + Math.cos(a) * 46, y + Math.sin(a) * 46); g.stroke(); }
    return c.toDataURL('image/png');
  }
  // 羊皮紙（こげ茶の古いページ）：雲のようなしみ＋紙の繊維＋細かい粒
  function vellum() {
    var N = 512, R = rng(2026), c = canvas(N), g = c.getContext('2d'), im = g.createImageData(N, N), d = im.data;
    var big = fbm(N, R, [2, 4, 8], [1, .7, .4]), mid = fbm(N, R, [16, 32], [1, .6]), fine = noiseLayer(N, 128, R);
    for (var i = 0; i < N * N; i++) {
      var v = (big[i] - .5) * 30 + (mid[i] - .5) * 12 + (fine[i] - .5) * 9;
      d[i * 4] = Math.max(0, Math.min(255, 52 + v)); d[i * 4 + 1] = Math.max(0, Math.min(255, 40 + v * .9)); d[i * 4 + 2] = Math.max(0, Math.min(255, 29 + v * .7)); d[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    g.lineWidth = .7;   // 紙の繊維
    for (var k = 0; k < 520; k++) {
      var x = R() * N, y = R() * N, a = R() * Math.PI * 2, L = 4 + R() * 16;
      g.strokeStyle = R() < .5 ? 'rgba(230,205,160,.07)' : 'rgba(10,6,2,.08)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
    for (k = 0; k < 7; k++) {   // うすいしみ
      var sx = R() * N, sy = R() * N, sr = 20 + R() * 50, gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      gr.addColorStop(0, 'rgba(20,12,4,.10)'); gr.addColorStop(.7, 'rgba(20,12,4,.05)'); gr.addColorStop(1, 'rgba(20,12,4,0)'); g.fillStyle = gr; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    return c.toDataURL('image/png');
  }
  // 金の飾りの角（左上の形。ほかの角は回して使う）
  function corner(rot) {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g transform="rotate(' + rot + ' 60 60)" fill="none" stroke="#d9b25e" stroke-width="2" stroke-linecap="round">' +
      '<path d="M8 112 L8 8 L112 8" stroke-width="2.4"/><path d="M16 104 L16 16 L104 16" stroke-width="1" opacity=".7"/>' +
      '<path d="M16 16 Q46 22 52 46 Q30 40 16 16 Z" fill="#d9b25e" fill-opacity=".25"/>' +
      '<path d="M24 60 Q36 44 24 30 M60 24 Q44 36 30 24" stroke-width="1.4"/><circle cx="22" cy="22" r="4" fill="#f2d48a"/>' +
      '<path d="M8 60 q6 -6 0 -12 M60 8 q-6 6 -12 0" stroke-width="1.6"/></g></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")';
  }
  try {
    var r = document.documentElement.style;
    r.setProperty('--tex-leather', 'url(' + leather() + ')');
    r.setProperty('--tex-page', 'url(' + vellum() + ')');
    r.setProperty('--orn-tl', corner(0)); r.setProperty('--orn-tr', corner(90)); r.setProperty('--orn-br', corner(180)); r.setProperty('--orn-bl', corner(270));
  } catch (e) {}
})();
