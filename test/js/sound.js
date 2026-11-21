// 音。BGM はゲーム音楽フォルダの採用版ループ（星火の剣舞29／臨界の刃62）。
// 効果音は audio/se/ のファイル（OpenGameArt の CC0・CC BY 素材。audio/se/CREDITS.txt）。読めないときは合成音。
var SR = window.SR || (window.SR = {});

SR.sound = (function () {
  var KEY = 'sr-battle-sound-v1';
  var on = { bgm: true, se: true };
  try { var s = JSON.parse(localStorage.getItem(KEY)); if (s) on = Object.assign(on, s); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(on)); } catch (e) {} }

  // BGM の繰り返し方（ゲーム音楽/制作メモ/各曲ループ仕様/各曲の繰り返し方_AI引き継ぎ.md）
  // 星火の剣舞29：ファイルの先頭から末尾までを、すき間なく繰り返す。
  // 臨界の刃62：初回だけ全体（遅いテーマから）を1回。終わった時刻ちょうどに反復用WAVを始め、それを繰り返す。
  // つなぎは音声の時計（Web Audio）で予約する。フェードや無音は足さない。
  var TRACKS = {
    normal: { first: 'audio/seika-no-kenbu_29_loop.wav' },
    boss: { first: 'audio/rinkai-no-yaiba_62_loop.wav', repeat: 'audio/rinkai-no-yaiba_62_repeat.wav' },
    // メニュー：まなびクエストのメニュー曲「光のアルペジオ」（教材作成/manabiquest/音楽 の WAV と「光のアルペジオ_繰り返し方.txt」）。
    // 1周は (60 / 78 / 4) × 128.16 = 約24.646秒。ファイルの終わりを待たず、その周期で次の周を始め、前の周の余韻を次の頭に重ねる。
    menu: { first: 'audio/menu-hikari-no-arpeggio.wav', period: 60 / 78 / 4 * 128.16 }
  };
  var BGM_VOL = 0.45, bgmKind = null, bgmToken = 0, bgmSrcs = [], bgmGain = null, bgmEl = null, bufs = {};
  function loadBuf(url) {
    var c = ac(); if (!c) return Promise.reject();
    if (!bufs[url]) bufs[url] = fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
      return new Promise(function (res, rej) { c.decodeAudioData(ab, res, rej); });
    });
    return bufs[url];
  }
  // 完全な無音（0）だけの頭と末尾を見つける（音のある所は削らない）
  function edges(b) {
    var n = b.length, a = 0, z = n, ch = [];
    for (var c = 0; c < b.numberOfChannels; c++) ch.push(b.getChannelData(c));
    function silent(i) { for (var c = 0; c < ch.length; c++) if (Math.abs(ch[c][i]) > 1e-6) return false; return true; }
    var lim = Math.min(n, b.sampleRate);   // 頭は1秒まで
    while (a < lim && silent(a)) a++;
    while (z > n / 2 && silent(z - 1)) z--;   // 末尾は曲の後半まで見る
    return a < z ? [a, z] : [0, n];
  }
  function playBgm(kind) {
    bgmKind = kind;
    if (!on.bgm) return;
    stopBgm(true);
    var tr = TRACKS[kind], c = ac(), my = ++bgmToken;
    if (!c || !window.fetch) {   // 古い端末：ふつうの再生（全体を繰り返すだけ）
      bgmEl = new Audio(tr.first); bgmEl.loop = true; bgmEl.volume = BGM_VOL; bgmEl.play().catch(function () {}); return;
    }
    bgmGain = c.createGain(); bgmGain.gain.value = BGM_VOL; bgmGain.connect(c.destination);
    var g = bgmGain, pRep = tr.repeat ? loadBuf(tr.repeat) : null;
    loadBuf(tr.first).then(function (b1) {
      if (my !== bgmToken) return;
      var t0 = c.currentTime + 0.06, s1 = c.createBufferSource();
      s1.buffer = b1; s1.connect(g);
      if (tr.period) {   // 決まった周期で、同じ音源を重ねながら置いていく
        var next = t0, P = tr.period;
        (function sched() {
          if (my !== bgmToken) return;
          while (next < c.currentTime + 30) {   // 30秒先まで予約しておく（画面を切りかえてもとぎれにくい）
            var s = c.createBufferSource(); s.buffer = b1; s.connect(g); s.start(next); bgmSrcs.push(s);
            s.onended = function () { var i = bgmSrcs.indexOf(this); if (i >= 0) bgmSrcs.splice(i, 1); };
            next += P;
          }
          setTimeout(sched, 1000);
        })();
        return;
      }
      if (!pRep) {
        s1.loop = true; var off = 0;
        if (tr.trim) { var e = edges(b1); off = e[0] / b1.sampleRate; s1.loopStart = off; s1.loopEnd = e[1] / b1.sampleRate; }
        s1.start(t0, off); bgmSrcs.push(s1); return;
      }
      s1.start(t0); bgmSrcs.push(s1);
      var tEnd = t0 + b1.length / b1.sampleRate;
      pRep.then(function (b2) {
        if (my !== bgmToken) return;
        var s2 = c.createBufferSource(); s2.buffer = b2; s2.loop = true; s2.connect(g);
        s2.start(Math.max(tEnd, c.currentTime + 0.02)); bgmSrcs.push(s2);
      });
    }).catch(function () {});
  }
  function stopBgm(keepKind) {
    bgmToken++;
    bgmSrcs.forEach(function (s) { try { s.stop(); } catch (e) {} }); bgmSrcs = [];
    if (bgmGain) { try { bgmGain.disconnect(); } catch (e) {} bgmGain = null; }
    if (bgmEl) { bgmEl.pause(); bgmEl = null; }
    if (!keepKind) bgmKind = null;
  }
  function fadeBgm(ms) {
    if (bgmEl) { var el = bgmEl, v0 = el.volume, t0 = performance.now(); (function step(now) { var r = Math.min(1, (now - t0) / ms); el.volume = v0 * (1 - r); if (r < 1) requestAnimationFrame(step); else { el.pause(); if (bgmEl === el) bgmEl = null; } })(t0); return; }
    if (!bgmGain || !ctx) return;
    var g = bgmGain, srcs = bgmSrcs, t = ctx.currentTime; bgmToken++; bgmSrcs = []; bgmGain = null;
    g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + ms / 1000);
    setTimeout(function () { srcs.forEach(function (s) { try { s.stop(); } catch (e) {} }); try { g.disconnect(); } catch (e) {} }, ms + 50);
  }
  // 最初にさわったとき：メニュー画面ならメニュー曲を流し、ふつうの戦いの曲も先に読み込んでおく
  document.addEventListener('pointerdown', function pre() {
    document.removeEventListener('pointerdown', pre, true);
    var t = document.getElementById('title');
    if (!bgmKind && t && !t.classList.contains('hidden')) playBgm('menu');
    if (on.bgm) loadBuf(TRACKS.normal.first).catch(function () {});
  }, true);

  // ---- 効果音（合成） ----
  var ctx = null, master = null;
  function ac() {
    if (!ctx) {
      var A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      ctx = new A(); master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    var c = ac(); if (!c) return;
    var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  var noiseBuf = null;
  function noise(dur, vol, freq, delay, q) {
    var c = ac(); if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t = c.currentTime + (delay || 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 0.8;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.02);
  }
  var SE = {
    tick: function () { tone(1320, 0.035, 'square', 0.03); },
    ok: function () { tone(784, 0.05, 'square', 0.05); tone(1175, 0.07, 'square', 0.05, null, 0.045); },
    back: function () { tone(523, 0.07, 'square', 0.04, 392); },
    hit: function () { noise(0.12, 0.35, 2200, 0, 0.7); tone(180, 0.1, 'triangle', 0.25, 70); },
    hurt: function () { noise(0.18, 0.35, 700, 0, 0.6); tone(120, 0.2, 'sawtooth', 0.14, 50); },
    brk: function () {
      noise(0.4, 0.4, 5000, 0, 0.5);
      [2093, 1568, 1319, 988].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.16, null, 0.03 + i * 0.05); });
    },
    heal: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.18, 'sine', 0.14, null, i * 0.06); }); },
    support: function () { tone(988, 0.12, 'sine', 0.08); tone(1319, 0.14, 'sine', 0.07, null, 0.06); },
    boost: function () { tone(220, 0.25, 'sawtooth', 0.08, 660); },
    charge: function () { tone(110, 0.7, 'sawtooth', 0.1, 440); tone(165, 0.7, 'sawtooth', 0.06, 660); },
    big: function () { noise(0.7, 0.5, 400, 0, 0.5); tone(90, 0.8, 'sawtooth', 0.3, 30); },
    stop: function () { tone(1568, 0.1, 'square', 0.08); tone(2093, 0.25, 'square', 0.08, null, 0.08); },
    down: function () { tone(330, 0.45, 'triangle', 0.18, 70); },
    swap: function () { tone(660, 0.06, 'triangle', 0.08, 990); tone(990, 0.06, 'triangle', 0.08, 660, 0.07); },
    win: function () { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, i === 5 ? 0.6 : 0.14, 'square', 0.07, null, i * 0.13); }); },
    lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.35, 'triangle', 0.12, null, i * 0.28); }); },
  };
  // 効果音ファイル：audio/se/（出どころとライセンスは audio/se/CREDITS.txt）。読めないときは上の合成音。
  // [ファイル, 音量, 頭出し秒]
  var FILES = {
    tick: ['tick.mp3', 0.45, 0], ok: ['ok.ogg', 0.45, 0], back: ['back.ogg', 0.4, 0.04], swap: ['swap.ogg', 0.5, 0],
    hit: ['hit.ogg', 0.6, 0.05], hit2: ['hit2.ogg', 0.55, 0.04], hurt: ['hurt.ogg', 2.8, 0],
    brk: ['brk.mp3', 2.4, 0], stop: ['stop.ogg', 0.5, 0.03], big: ['big.mp3', 4, 0], charge: ['charge.mp3', 0.9, 0],
    down: ['down.ogg', 0.8, 0.08], win: ['win.mp3', 0.6, 0], lose: ['lose.mp3', 0.6, 0],
    heal: ['heal.mp3', 0.9, 0.05], support: ['support.ogg', 0.55, 0], boost: ['boost.ogg', 0.55, 0.02]
  };
  var bufs = {}, pool = {}, broken = {}, fileGain = null, loading = false;
  Object.keys(FILES).forEach(function (k) {
    try {
      var a = new Audio('audio/se/' + FILES[k][0]); a.preload = 'auto';
      a.addEventListener('error', function () { broken[k] = true; });
      pool[k] = a;
    } catch (e) { broken[k] = true; }
  });
  // 音を先に解読しておく（遅れが少なく、音量も1より上げられる）。file:// などで読めなければ Audio 要素で鳴らす。
  function loadBufs() {
    var c = ac(); if (!c || loading || !window.fetch) return; loading = true;
    Object.keys(FILES).forEach(function (k) {
      fetch('audio/se/' + FILES[k][0]).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, ng) { c.decodeAudioData(ab, ok, ng); }); })
        .then(function (b) { bufs[k] = b; }).catch(function () {});
    });
  }
  function playFile(name) {
    var f = FILES[name]; if (!f) return false;
    var c = ac(); loadBufs();
    if (c && bufs[name]) {
      if (!fileGain) { fileGain = c.createGain(); fileGain.gain.value = 0.8; fileGain.connect(c.destination); }
      var src = c.createBufferSource(), g = c.createGain();
      src.buffer = bufs[name]; g.gain.value = f[1]; src.connect(g); g.connect(fileGain); src.start(0, f[2] || 0);
      return true;
    }
    var base = pool[name]; if (!base || broken[name]) return false;
    var a = base.cloneNode(); a.volume = Math.min(1, f[1]);
    try { if (f[2]) a.currentTime = f[2]; } catch (e) {}
    var p = a.play(); if (p && p.catch) p.catch(function () {});
    return true;
  }
  function se(name) {
    if (!on.se) return;
    if (name === 'hit' && Math.random() < 0.5) name = 'hit2';
    if (playFile(name)) return;
    if (name === 'hit2') name = 'hit';
    if (SE[name]) try { SE[name](); } catch (e) {}
  }

  function toggle(which) {
    on[which] = !on[which]; save();
    if (which === 'bgm') { if (on.bgm && bgmKind) playBgm(bgmKind); else stopBgm(true); }
    return on[which];
  }
  return { playBgm: playBgm, stopBgm: stopBgm, fadeBgm: fadeBgm, se: se, toggle: toggle, state: function () { return on; } };
})();
