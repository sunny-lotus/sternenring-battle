// 音。BGM はゲーム音楽フォルダの採用版ループ（星火の剣舞29／臨界の刃62）。
// 効果音は Kenney（CC0）のファイル。魔法系の音とファイルが読めないときは合成音。
var SR = window.SR || (window.SR = {});

SR.sound = (function () {
  var KEY = 'sr-battle-sound-v1';
  var on = { bgm: true, se: true };
  try { var s = JSON.parse(localStorage.getItem(KEY)); if (s) on = Object.assign(on, s); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(on)); } catch (e) {} }

  var TRACKS = { normal: 'audio/seika-no-kenbu_29_loop.wav', boss: 'audio/rinkai-no-yaiba_62_loop.wav' };
  var bgmEl = null, bgmKind = null;
  function playBgm(kind) {
    bgmKind = kind;
    if (!on.bgm) return;
    if (bgmEl && bgmEl.dataset.kind === kind) { bgmEl.currentTime = 0; bgmEl.play().catch(function () {}); return; }
    stopBgm(true);
    bgmEl = new Audio(TRACKS[kind]);
    bgmEl.dataset.kind = kind; bgmEl.loop = true; bgmEl.volume = 0.45;
    bgmEl.play().catch(function () {});
  }
  function stopBgm(keepKind) {
    if (bgmEl) { bgmEl.pause(); bgmEl = null; }
    if (!keepKind) bgmKind = null;
  }
  function fadeBgm(ms) {
    var el = bgmEl; if (!el) return;
    var v0 = el.volume, t0 = performance.now();
    (function step(now) {
      var r = Math.min(1, (now - t0) / ms); el.volume = v0 * (1 - r);
      if (r < 1) requestAnimationFrame(step); else { el.pause(); if (bgmEl === el) bgmEl = null; }
    })(t0);
  }

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
    charge: function () { tone(110, 0.7, 'sawtooth', 0.1, 440); tone(165, 0.7, 'sawtooth', 0.06, 660); },
    big: function () { noise(0.7, 0.5, 400, 0, 0.5); tone(90, 0.8, 'sawtooth', 0.3, 30); },
    stop: function () { tone(1568, 0.1, 'square', 0.08); tone(2093, 0.25, 'square', 0.08, null, 0.08); },
    down: function () { tone(330, 0.45, 'triangle', 0.18, 70); },
    swap: function () { tone(660, 0.06, 'triangle', 0.08, 990); tone(990, 0.06, 'triangle', 0.08, 660, 0.07); },
    win: function () { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, i === 5 ? 0.6 : 0.14, 'square', 0.07, null, i * 0.13); }); },
    lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.35, 'triangle', 0.12, null, i * 0.28); }); },
  };
  // 効果音ファイル：Kenney（CC0）。audio/se/。魔法系（回復・支援・溜め）は合成音のまま。
  var FILES = { tick: 'tick', ok: 'ok', back: 'back', swap: 'swap', hit: 'hit', hit2: 'hit2', hurt: 'hurt',
    brk: 'brk', stop: 'stop', big: 'big', down: 'down', win: 'win', lose: 'lose' };
  var VOL = { tick: 0.4, ok: 0.5, back: 0.5, swap: 0.6, hit: 0.8, hit2: 0.8, hurt: 0.8, brk: 0.9, stop: 0.9, big: 1, down: 0.7, win: 0.7, lose: 0.7 };
  var pool = {}, broken = {};
  Object.keys(FILES).forEach(function (k) {
    try {
      var a = new Audio('audio/se/' + FILES[k] + '.ogg'); a.preload = 'auto';
      a.addEventListener('error', function () { broken[k] = true; });
      pool[k] = a;
    } catch (e) { broken[k] = true; }
  });
  function playFile(name) {
    var base = pool[name]; if (!base || broken[name]) return false;
    var a = base.cloneNode(); a.volume = VOL[name] || 0.7;
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
