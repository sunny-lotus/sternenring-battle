// 戦闘の3Dの舞台（2026-11-21 HD-2D風・手元の試作）。
// 床・円柱の壁・天井（まん中が空いていて夜空と星環が見える）は3Dで、模様はここで描く（外の絵は使わない）。
// キャラと敵は2Dの絵の板を立てる。画面の名札やボタンは ui.js が手前に重ねる。
// three.js は外のサイト（jsdelivr）から読み込む（index.html の importmap）。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SR = window.SR || (window.SR = {});
let renderer, scene, camera, composer, bokeh, canvas, running = false, onFrame = null;
const units = {}, loader = new THREE.TextureLoader(), clock = new THREE.Clock();
const lite = Math.min(innerWidth, innerHeight * 16 / 9) < 1000;   // スマホなどは軽くする

function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  t.anisotropy = 8; return t;
}
function rnd(s) { let x = s; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; }

function build() {
  canvas = document.getElementById('stage3d');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite });
  renderer.setPixelRatio(lite ? 1 : Math.min(2, devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x0b0e24, 0.022);
  camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 200);

  // 床：古い石だたみ
  const floorTex = tex(512, 512, (g, w, h) => {
    const r = rnd(11); g.fillStyle = '#2a2d3e'; g.fillRect(0, 0, w, h); const s = 64;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const off = (y / s) % 2 ? s / 2 : 0, v = 40 + r() * 26;
      g.fillStyle = `rgb(${v},${v + 3},${v + 16})`; g.fillRect(x + off + 2, y + 2, s - 4, s - 4);
      for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(0,0,0,${r() * .18})`; g.fillRect(x + off + r() * s, y + r() * s, 2 + r() * 6, 2 + r() * 6); }
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.strokeRect(x + off + 1, y + 1, s - 2, s - 2);
    }
  }, [10, 10]);
  // 壁：石組み、柱の影、蔦
  const wallTex = tex(1024, 512, (g, w, h) => {
    const r = rnd(7), grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#1a1d33'); grd.addColorStop(1, '#2e3150'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const bh = 40;
    for (let y = 0; y < h; y += bh) { let x = -((y / bh) % 2) * 40; while (x < w) { const bw = 60 + r() * 50, v = 30 + r() * 22; g.fillStyle = `rgb(${v},${v + 2},${v + 14})`; g.fillRect(x + 2, y + 2, bw - 4, bh - 4); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3; g.strokeRect(x + 1, y + 1, bw - 2, bh - 2); x += bw; } }
    for (let i = 0; i < 8; i++) { const x = i * w / 8, pg = g.createLinearGradient(x, 0, x + 50, 0); pg.addColorStop(0, 'rgba(0,0,0,.35)'); pg.addColorStop(.5, 'rgba(80,84,120,.25)'); pg.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = pg; g.fillRect(x, 0, 50, h); }
    g.fillStyle = 'rgba(30,60,40,.35)'; for (let i = 0; i < 260; i++) g.fillRect(r() * w, r() * h * .5, 3 + r() * 5, 6 + r() * 30);
  }, [3, 1]);
  // 天井：木の梁と石の板（まん中は丸く空いている）
  const ceilTex = tex(1024, 1024, (g, w, h) => {
    const r = rnd(3); g.fillStyle = '#1c1a24'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const v = 26 + r() * 16; g.fillStyle = `rgb(${v + 8},${v + 4},${v})`; g.fillRect(0, i * 40 + 3, w, 34); }
    g.fillStyle = 'rgba(0,0,0,.5)'; for (let i = 0; i < 26; i++) g.fillRect(0, i * 40, w, 3);
    for (let x = 0; x < w; x += 128) { g.fillStyle = '#3a2a1a'; g.fillRect(x, 0, 18, h); g.fillStyle = 'rgba(255,200,120,.08)'; g.fillRect(x + 2, 0, 4, h); }
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 400; i++) g.fillRect(r() * w, r() * h, 2 + r() * 10, 1 + r() * 3);
  }, [4, 4]);
  // 空：夜空と星、星環のゆるい弧の帯（天井の穴から見える）
  const skyTex = tex(2048, 1024, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#05061a'); grd.addColorStop(.5, '#141a45'); grd.addColorStop(1, '#2a3172'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const r = rnd(5); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${.2 + r() * .7})`; g.fillRect(r() * w, r() * h * .7, r() < .1 ? 2 : 1, r() < .1 ? 2 : 1); }
    for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(255,244,214,${k ? .25 : .55})`; g.lineWidth = k ? 1.5 : 3; g.beginPath(); g.moveTo(0, h * .3 + k * 6); g.quadraticCurveTo(w / 2, h * .12 + k * 6, w, h * .3 + k * 6); g.stroke(); }
  });
  const blob = tex(128, 128, (g) => { const rg = g.createRadialGradient(64, 64, 4, 64, 64, 62); rg.addColorStop(0, 'rgba(0,0,0,.75)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); });
  SR._blob = blob;
  // 足元の魔法陣（狙える敵・番のキャラ）
  SR._rune = tex(512, 512, (g, w) => {
    const c = w / 2; g.translate(c, c); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8;
    const ring = (r, lw, dash) => { g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
    ring(240, 6); ring(222, 2); ring(150, 3); ring(132, 1.5, [10, 8]); ring(70, 2);
    g.setLineDash([]);
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, l = i % 4 ? 8 : 18; g.lineWidth = i % 4 ? 2 : 3; g.beginPath(); g.moveTo(Math.cos(a) * 222, Math.sin(a) * 222); g.lineTo(Math.cos(a) * (222 - l), Math.sin(a) * (222 - l)); g.stroke(); }
    for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(0, -246); g.lineTo(12, -231); g.lineTo(0, -216); g.lineTo(-12, -231); g.closePath(); g.fill(); g.restore(); }
    g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * Math.PI * 4 / 6 - Math.PI / 2; const x = Math.cos(a) * 150, y = Math.sin(a) * 150; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * Math.PI * 4 / 6 + Math.PI / 2; const x = Math.cos(a) * 150, y = Math.sin(a) * 150; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 186, Math.sin(a) * 186, 5, 0, Math.PI * 2); g.fill(); }
  });

  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ map: floorTex, roughness: .95 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 7, 64, 1, true), new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 1, emissive: new THREE.Color(0x9aa0d0), emissiveMap: wallTex, emissiveIntensity: .55 }));
  wall.position.y = 3.5; scene.add(wall);
  const ceil = new THREE.Mesh(new THREE.RingGeometry(6.5, 16, 64, 1), new THREE.MeshStandardMaterial({ map: ceilTex, side: THREE.DoubleSide, roughness: 1, emissive: new THREE.Color(0x6a5a50), emissiveMap: ceilTex, emissiveIntensity: .5 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 7; scene.add(ceil);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(6.5, .12, 8, 64), new THREE.MeshStandardMaterial({ color: 0xc8a060, emissive: 0x403020, roughness: .6 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 6.95; scene.add(rim);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })));

  scene.add(new THREE.HemisphereLight(0x9aa6ff, 0x202030, 1.0));
  const warm = new THREE.PointLight(0xffc98a, 22, 18, 1.6); warm.position.set(3.5, 3, 2.5); scene.add(warm);
  const red = new THREE.PointLight(0xff5070, 2.5, 12, 1.6); red.position.set(-4, 2.2, 1); scene.add(red); SR._red = red;   // 2026-11-22 新しい敵の色が見えるよう弱めた（6→2.5）
  const tl = new THREE.PointLight(0xffa860, 25, 14, 1.4); tl.position.set(-7, 3.5, -12); scene.add(tl);
  const tr = new THREE.PointLight(0xffa860, 25, 14, 1.4); tr.position.set(8, 3.5, -11); scene.add(tr);
  const moon = new THREE.DirectionalLight(0xaabbff, .6); moon.position.set(-3, 8, 6); scene.add(moon);
  const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: lite ? 240 : 600 }, () => (Math.random() - .5) * 20), 3)),
    new THREE.PointsMaterial({ color: 0xffe2a0, size: .05, transparent: true, opacity: .7 }));
  motes.position.y = 3; scene.add(motes); SR._motes = motes;

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .22, .4, .93));   // にじみは弱め（キャラが見えにくくならないように）
  if (!lite) { bokeh = new BokehPass(scene, camera, { focus: 13.4, aperture: .00035, maxblur: .0035 }); composer.addPass(bokeh); }   // ピントはキャラの立つ位置。ぼかしは奥の壁に少しだけ
  composer.addPass(new OutputPass());
  addEventListener('resize', resize); resize();
}
function resize() {
  if (!renderer) return;
  const r = canvas.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
  renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ---- キャラと敵の板 ----
function slotsFor(n) {
  return [[[-3.3, 0]], [[-4.6, -.6], [-2.0, 1.4]], [[-5.2, -.4], [-1.5, -1.9], [-3.1, 2.0]],
    [[-4.8, -.9], [-2.4, -2.2], [-2.6, 1.6], [-5.0, 1.8]], [[-4.8, -.9], [-2.4, -2.2], [-2.4, 1.7], [-5.2, 1.9], [-1.4, -.1]]][Math.min(5, n) - 1];
}
const HERO_SLOT = [[1.6, 1.4], [2.9, -.4], [4.2, 1.2]];
function setup(list) {
  if (!scene) build();
  Object.keys(units).forEach(k => { scene.remove(units[k].m); scene.remove(units[k].sh); if (units[k].rn) scene.remove(units[k].rn); delete units[k]; });
  const enemies = list.filter(u => !u.hero), es = slotsFor(enemies.length || 1);
  list.forEach(u => {
    const p = u.hero ? HERO_SLOT[u.pos] : es[enemies.indexOf(u)];
    if (!p) return;
    const h = u.h || (u.hero ? 2.4 : 2.1);
    // atlas：ドット絵のコマ割り（cols×rows）。row の列を、frames コマ・fps でくり返す
    const at = u.atlas, cell = at ? h / at.fill : h;
    const t = loader.load(u.img, tt => { const ar = at ? 1 : tt.image.width / tt.image.height; m.scale.set(cell * ar, cell, 1); });
    if (at) { t.repeat.set(1 / at.cols, 1 / at.rows); t.offset.set(0, 1 - (at.row + 1) / at.rows); }
    t.colorSpace = THREE.SRGBColorSpace; if (u.pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; }
    const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: .4, roughness: 1 });
    if (!u.hero) { mat.emissiveMap = t; mat.emissiveIntensity = .5; }   // 2026-11-22 敵は絵の色が照明に負けないよう、少し自分で光る
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.geometry.translate(0, .5, 0); m.position.set(p[0], 0, p[1]); m.scale.set(h * .6, h, 1); scene.add(m);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: SR._blob, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(p[0], .01, p[1]); sh.scale.set(h * .7, h * .32, 1); scene.add(sh);
    const rn = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: SR._rune, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: u.hero ? 0xffd27a : 0xff5a64, opacity: 0 }));
    rn.rotation.x = -Math.PI / 2; rn.position.set(p[0], .02, p[1]); rn.scale.setScalar(h * 1.15); scene.add(rn);
    units[u.id] = { m, sh, rn, h, at, yOff: at ? -cell * at.foot : 0, base: p, hero: u.hero, bob: u.hero ? 0 : .8 + Math.random() * .6, hitT: -9, state: {} };
  });
}
function sync(states) {
  Object.keys(states).forEach(id => {
    const u = units[id]; if (!u) return; const s = states[id]; u.state = s;
    u.m.visible = u.sh.visible = s.show !== false;
  });
}
// ---- 当たったときの演出：火花（光の尾つき）・やわらかい衝撃の輪・十字の光・カメラのゆれ ----
// 2026-11-22：技を出した人の色（SR.THEME）で光る。技を出すときは足もとに魔法陣
const SPN = 700;
let spk = null, streak = null, spkPos, spkCol, spkVel, spkLife, spkGrav, spkTail, stPos, stCol, spkHead = 0, rings = [], stars = [], circles = [], bolts = [], beams = [], arcs = [], flashL = null, shakeA = 0, introT0 = -1, introDur = 0;
function ensureFx() {
  if (spk || !scene) return;
  const g = new THREE.BufferGeometry();
  spkPos = new Float32Array(SPN * 3); spkCol = new Float32Array(SPN * 3); spkVel = new Float32Array(SPN * 3); spkLife = new Float32Array(SPN); spkGrav = new Float32Array(SPN); spkTail = new Float32Array(SPN);
  for (let i = 0; i < SPN; i++) spkPos[i * 3 + 1] = -99;
  g.setAttribute('position', new THREE.BufferAttribute(spkPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(spkCol, 3));
  const dot = tex(64, 64, (c, w) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(.18, 'rgba(255,255,255,.9)'); gr.addColorStop(.45, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, w); });
  spk = new THREE.Points(g, new THREE.PointsMaterial({ size: .26, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  spk.frustumCulled = false; scene.add(spk);
  // 光の尾：火花ごとに、いまの位置から少し前の位置まで線を引く（先は明るく、うしろは消える）
  const g2 = new THREE.BufferGeometry(); stPos = new Float32Array(SPN * 6); stCol = new Float32Array(SPN * 6);
  for (let i = 0; i < SPN; i++) { stPos[i * 6 + 1] = -99; stPos[i * 6 + 4] = -99; }
  g2.setAttribute('position', new THREE.BufferAttribute(stPos, 3)); g2.setAttribute('color', new THREE.BufferAttribute(stCol, 3));
  streak = new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  streak.frustumCulled = false; scene.add(streak);
  // やわらかい輪（ふちがぼけた光の輪）
  const ringT = tex(256, 256, (c, w) => { const gr = c.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.6, 'rgba(255,255,255,0)'); gr.addColorStop(.84, 'rgba(255,255,255,.75)'); gr.addColorStop(.9, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, w); });
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ringT, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    r.visible = false; scene.add(r); rings.push({ m: r, t: -9, dur: .6, max: 4 });
  }
  // 十字の光（当たった瞬間にきらっと）
  const starT = tex(256, 256, (c, w) => {
    c.globalCompositeOperation = 'lighter';
    const core = c.createRadialGradient(128, 128, 0, 128, 128, 56); core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = core; c.fillRect(0, 0, w, w);
    [[0, 1], [1, 0], [.7, .7], [.7, -.7]].forEach((d, k) => {
      const L = k < 2 ? 124 : 66, Wd = k < 2 ? 7 : 4; c.save(); c.translate(128, 128); c.rotate(Math.atan2(d[1], d[0]));
      const gr = c.createLinearGradient(-L, 0, L, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.beginPath(); c.moveTo(-L, 0); c.lineTo(0, -Wd); c.lineTo(L, 0); c.lineTo(0, Wd); c.closePath(); c.fill(); c.restore();
    });
  });
  for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starT, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); s.visible = false; scene.add(s); stars.push({ m: s, t: -9, dur: .35, max: 3, rot: 0 }); }
  // 技を出すときの足もとの魔法陣
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: SR._rune, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; scene.add(m); circles.push({ m, t: -9, dur: 1.1, max: 3 }); }
  // 稲妻（白い芯と色の外側の2本の線）
  for (let i = 0; i < 3; i++) {
    const mk = (col, op) => { const g3 = new THREE.BufferGeometry(); g3.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3)); const l = new THREE.Line(g3, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); l.frustumCulled = false; l.visible = false; scene.add(l); return l; };
    bolts.push({ core: mk(0xffffff, 1), glow: mk(0xc9a4ff, .9), t: -9, dur: .32 });
  }
  // 光の帯：まん中が明るく、ふちと両端が消える
  const beamT = tex(64, 256, (c, w, h) => {
    const im = c.createImageData(64, 256);
    for (let yy = 0; yy < 256; yy++) for (let xx = 0; xx < 64; xx++) {
      const dx = Math.abs(xx - 31.5) / 32, fy = yy / 255, end = Math.min(1, Math.min(fy, 1 - fy) / .18);
      const a = Math.max(0, Math.pow(1 - dx, 2.2)) * end, o = (yy * 64 + xx) * 4;
      im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = Math.round(a * 255);
    }
    c.putImageData(im, 0, 0);
  });
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: beamT, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.visible = false; scene.add(m); beams.push({ m, t: -9, dur: .5, w: 1, h: 5, rot: 0 }); }
  // 三日月の斬り跡
  const arcT = tex(256, 256, (c) => {
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let k = 0; k < 14; k++) {
      const f = k / 13; c.strokeStyle = 'rgba(255,255,255,' + (.08 + f * .5) + ')'; c.lineWidth = 2 + (1 - f) * 16;
      c.beginPath(); c.arc(128, 150, 96, Math.PI * (1.12 + f * .04), Math.PI * (1.88 - f * .04)); c.stroke();
    }
  });
  for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: arcT, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); s.visible = false; scene.add(s); arcs.push({ m: s, t: -9, dur: .3, size: 3, rot: 0 }); }
  flashL = new THREE.PointLight(0xffe6b0, 0, 14, 1.6); scene.add(flashL);
}
const tmpC = new THREE.Color();
// up があるときは「立ちのぼる光」：その幅に散らばって、ゆっくり上へ
// tail：光の尾の長さ（ふつう .05。氷のかけらは長め、火の粉は短め）／life：消えるまでの長さの倍率
function sparks(x, y, z, n, col, sp, grav, up, tail, life) {
  ensureFx(); if (!spk) return;
  for (let k = 0; k < n; k++) {
    const i = spkHead; spkHead = (spkHead + 1) % SPN;
    spkTail[i] = tail === undefined ? .05 : tail;
    spkPos[i * 3] = x + (up ? (Math.random() - .5) * up : 0); spkPos[i * 3 + 1] = y; spkPos[i * 3 + 2] = z + (up ? (Math.random() - .5) * up * .6 : 0);
    if (up) { spkVel[i * 3] = (Math.random() - .5) * .3; spkVel[i * 3 + 1] = sp * (.5 + Math.random() * .7); spkVel[i * 3 + 2] = (Math.random() - .5) * .3; }
    else {
      const a = Math.random() * Math.PI * 2, b = (Math.random() - .3) * Math.PI * .8, s = sp * (.4 + Math.random() * .8);
      spkVel[i * 3] = Math.cos(a) * Math.cos(b) * s; spkVel[i * 3 + 1] = Math.sin(b) * s + sp * .3; spkVel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
    }
    tmpC.set(Array.isArray(col) ? col[k % col.length] : col); spkCol[i * 3] = tmpC.r; spkCol[i * 3 + 1] = tmpC.g; spkCol[i * 3 + 2] = tmpC.b;
    spkLife[i] = ((up ? .8 : .45) + Math.random() * .5) * (life || 1); spkGrav[i] = grav === undefined ? 9 : grav;
  }
}
// ---- 現象ごとの形（2026-11-22）：稲妻・光の柱／突き抜ける筋・斬り跡 ----
function bolt(x, y, z, col) {   // 上から落ちる稲妻（ジグザグの線を2本：白い芯と色の外側）
  ensureFx(); const b = bolts.find(q => clock.getElapsedTime() - q.t > q.dur) || bolts[0];
  b.t = clock.getElapsedTime();
  [b.core, b.glow].forEach((ln, w) => {
    const p = ln.geometry.attributes.position.array, N = p.length / 3, top = y + 4.5, sx = x + (Math.random() - .5) * 1.6;
    for (let k = 0; k < N; k++) {
      const f = k / (N - 1), j = k === 0 || k === N - 1 ? 0 : (Math.random() - .5) * .55 * (1 - f * .4);
      p[k * 3] = sx + (x - sx) * f + j + (w ? .04 : 0); p[k * 3 + 1] = top + (y - top) * f; p[k * 3 + 2] = z + .35 + (w ? .02 : 0);
    }
    ln.geometry.attributes.position.needsUpdate = true; ln.visible = true;
  });
  b.glow.material.color.set(col);
}
function beam(x, y, z, col, w, h, rot, dur) {   // 光の帯：rot 0 なら縦の柱、PI/2 近くなら横に突き抜ける筋
  ensureFx(); const b = beams.find(q => clock.getElapsedTime() - q.t > q.dur) || beams[0];
  b.t = clock.getElapsedTime(); b.w = w; b.h = h; b.rot = rot; b.dur = dur; b.m.material.color.set(col); b.m.visible = true; b.m.position.set(x, y, z + .4);
}
function arc(x, y, z, col, size, dur) {   // 三日月の斬り跡
  ensureFx(); const a = arcs.find(q => clock.getElapsedTime() - q.t > q.dur) || arcs[0];
  a.t = clock.getElapsedTime(); a.size = size; a.dur = dur; a.rot = (Math.random() < .5 ? -1 : 1) * (.5 + Math.random() * .5); a.m.material.color.set(col); a.m.visible = true; a.m.position.set(x, y, z + .5);
}
// 現象ごとに、当たりの演出を足す
function phenFx(p, x, y, z, base, power) {
  const big = power >= 2 ? 1.35 : 1;
  if (p === '炎') {
    sparks(x, y * .4, z, Math.round(36 * big), ['#ff6a1a', '#ffb43c', '#ffe08a', '#ff3a1a'], 1.8, -2.2, 1.1, .025, 1.3);
    ring(x, z, '#ff7a2a', 2.6 * big, .5);
  } else if (p === '冷気') {
    sparks(x, y, z, Math.round(30 * big), ['#e8f8ff', '#9fe6ff', '#ffffff', '#6fb6e8'], 3.2, 2.5, 0, .14, 1.5);
    ring(x, z, '#bfefff', 3.2 * big, .8);
    star(x, y, z, '#d6f4ff', 2.6 * big, .45);
  } else if (p === '雷') {
    bolt(x, y, z, '#c9a4ff'); if (power >= 2) bolt(x, y, z, '#ffe27a');
    sparks(x, y, z, Math.round(26 * big), ['#ffffff', '#e8d8ff', '#ffe27a'], 6, 9, 0, .03, .7);
  } else if (p === '光') {
    beam(x, 2.6, z, '#fff3c0', 1.3 * big, 6, 0, .6);
    sparks(x, .2, z, Math.round(26 * big), ['#ffffff', '#fff3c0', '#ffe08a'], 2.4, -2, 1, .04, 1.1);
  } else if (p === '斬撃') {
    arc(x, y, z, lighten(base, .3), 2.8 * big, .3);
  } else if (p === '貫通') {
    beam(x, y, z, lighten(base, .4), .24 * big, 3.4, Math.PI / 2 + (Math.random() - .5) * .2, .3);
    sparks(x, y, z, Math.round(18 * big), [base, '#ffffff'], 5, 6, 0, .08, .6);
  } else if (p === '衝撃' || p === '強撃') {
    sparks(x, .15, z, Math.round(34 * big), ['#c8b090', '#8a7a64', '#e8dcc0', '#6a5a48'], 3.6, 14, 0, .03, 1);
    ring(x, z, '#d8c8a8', 3.6 * big, .6);
    shakeA = Math.max(shakeA, p === '強撃' ? .3 * big : .2 * big);
  }
}
function ring(x, z, col, max, dur, up, y) {
  ensureFx(); const r = rings.find(q => clock.getElapsedTime() - q.t > q.dur) || rings[0];
  r.t = clock.getElapsedTime(); r.max = max; r.dur = dur; r.m.material.color.set(col); r.m.visible = true;
  r.up = !!up; r.m.position.set(x, up ? (y || 1.2) : .05, z);
}
function star(x, y, z, col, max, dur) {
  ensureFx(); const s = stars.find(q => clock.getElapsedTime() - q.t > q.dur) || stars[0];
  s.t = clock.getElapsedTime(); s.max = max; s.dur = dur; s.rot = Math.random() * Math.PI; s.m.material.color.set(col); s.m.visible = true; s.m.position.set(x, y, z + .3);
}
function circle(x, z, col, max) {
  ensureFx(); const c = circles.find(q => clock.getElapsedTime() - q.t > q.dur) || circles[0];
  c.t = clock.getElapsedTime(); c.max = max; c.m.material.color.set(col); c.m.visible = true; c.m.position.set(x, .04, z);
}
const WHITE = new THREE.Color(1, 1, 1);
function lighten(hex, k) { tmpC.set(hex); tmpC.lerp(WHITE, k); return '#' + tmpC.getHexString(); }
// power 1 ふつう / 2 強い / 3 ブレイク・とどめ。tc＝技を出した味方の色
function hit(id, power, tc, phen) {
  const u = units[id]; if (!u) return; u.hitT = clock.getElapsedTime(); power = power || 1;
  const x = u.m.position.x, z = u.base[1], y = u.h * .55;
  const base = u.hero ? '#ff6a6a' : (tc || '#ffd27a');
  if (!u.hero && phen && phen.length) phen.slice(0, 2).forEach(p => phenFx(p, x, y, z, base, power));
  const col = u.hero ? ['#ff6a6a', '#ffb0a0', '#ffffff'] : power >= 3 ? ['#9fe6ff', '#ffffff', base, lighten(base, .5)] : [base, '#ffffff', lighten(base, .45)];
  sparks(x, y, z, power >= 3 ? 110 : power >= 2 ? 55 : 32, col, power >= 3 ? 7.5 : 5);
  star(x, y, z, power >= 3 ? '#e8f8ff' : lighten(base, .35), power >= 3 ? 4.2 : power >= 2 ? 3 : 2.2, power >= 3 ? .5 : .32);
  ring(x, z, power >= 3 ? '#9fe6ff' : base, power >= 3 ? 5 : 2.8, power >= 3 ? .75 : .45);
  ring(x, z, lighten(base, .4), power >= 3 ? 3.2 : power >= 2 ? 1.7 : 1.3, power >= 3 ? .55 : .3, true, y);
  if (power >= 3) ring(x, z, '#ffffff', 4.2, .6, true, y);
  if (flashL) { flashL.position.set(x, y + .6, z + .8); flashL.color.set(power >= 3 ? 0xbfefff : base); flashL.intensity = power >= 3 ? 95 : 45; }
  shakeA = Math.max(shakeA, power >= 3 ? .45 : power >= 2 ? .22 : .1);
}
function cast(id, tc) {   // 技を出す人：足もとに魔法陣が広がり、光の粒が立ちのぼる
  const u = units[id]; if (!u) return;
  const c = u.hero ? (tc || '#ffd27a') : '#ff5a64';
  circle(u.m.position.x, u.base[1], c, u.h * 1.5);
  sparks(u.m.position.x, .1, u.base[1], 34, [c, '#ffffff', lighten(c, .5)], 2.6, -1.5, .9);
  ring(u.m.position.x, u.base[1], c, 2.4, .55);
}
// カメラを手で回す（dx・dy はラジアン）。reset で元にもどす
let tYaw = 0, tPitch = 0, uYaw = 0, uPitch = 0; const dv = new THREE.Vector3();
function drag(dx, dy) { tYaw = Math.max(-1.4, Math.min(1.4, tYaw + dx)); tPitch = Math.max(-.35, Math.min(.6, tPitch + dy)); }
function resetView() { tYaw = 0; tPitch = 0; }
function intro(sec) { introT0 = clock.getElapsedTime(); introDur = sec || 3; }
function fxFrame(t, dt) {
  if (spk) {
    const dmp = Math.pow(.3, dt);
    for (let i = 0; i < SPN; i++) {
      if (spkLife[i] <= 0) continue;
      const j = i * 6;
      spkLife[i] -= dt; spkVel[i * 3 + 1] -= spkGrav[i] * dt; spkVel[i * 3] *= dmp; spkVel[i * 3 + 2] *= dmp;
      spkPos[i * 3] += spkVel[i * 3] * dt; spkPos[i * 3 + 1] = Math.max(.05, spkPos[i * 3 + 1] + spkVel[i * 3 + 1] * dt); spkPos[i * 3 + 2] += spkVel[i * 3 + 2] * dt;
      if (spkLife[i] <= 0) { spkPos[i * 3 + 1] = -99; stPos[j + 1] = -99; stPos[j + 4] = -99; continue; }
      if (spkLife[i] < .25) { spkCol[i * 3] *= .9; spkCol[i * 3 + 1] *= .9; spkCol[i * 3 + 2] *= .9; }
      const tl = spkTail[i];
      stPos[j] = spkPos[i * 3]; stPos[j + 1] = spkPos[i * 3 + 1]; stPos[j + 2] = spkPos[i * 3 + 2];
      stPos[j + 3] = spkPos[i * 3] - spkVel[i * 3] * tl; stPos[j + 4] = spkPos[i * 3 + 1] - spkVel[i * 3 + 1] * tl; stPos[j + 5] = spkPos[i * 3 + 2] - spkVel[i * 3 + 2] * tl;
      stCol[j] = spkCol[i * 3]; stCol[j + 1] = spkCol[i * 3 + 1]; stCol[j + 2] = spkCol[i * 3 + 2]; stCol[j + 3] = 0; stCol[j + 4] = 0; stCol[j + 5] = 0;
    }
    spk.geometry.attributes.position.needsUpdate = true; spk.geometry.attributes.color.needsUpdate = true;
    streak.geometry.attributes.position.needsUpdate = true; streak.geometry.attributes.color.needsUpdate = true;
    rings.forEach(r => {
      const k = (t - r.t) / r.dur; if (k > 1 || k < 0) { r.m.visible = false; return; }
      const s = .3 + (r.max - .3) * (1 - Math.pow(1 - k, 3)); r.m.scale.setScalar(s); r.m.material.opacity = (1 - k) * .95;
      if (r.up) r.m.quaternion.copy(camera.quaternion); else r.m.rotation.set(-Math.PI / 2, 0, 0);
    });
    stars.forEach(s => {
      const k = (t - s.t) / s.dur; if (k > 1 || k < 0) { s.m.visible = false; return; }
      const sc = s.max * (k < .2 ? .3 + .7 * k / .2 : 1 + (k - .2) * .25); s.m.scale.set(sc, sc, 1);
      s.m.material.opacity = k < .2 ? 1 : 1 - (k - .2) / .8; s.m.material.rotation = s.rot + k * .5;
    });
    bolts.forEach(b => {   // 稲妻：ちかちか点滅して消える
      const k = (t - b.t) / b.dur, on = k >= 0 && k <= 1;
      b.core.visible = b.glow.visible = on && (k < .35 || Math.sin(k * 60) > -.2);
      if (on) { b.core.material.opacity = 1 - k * .6; b.glow.material.opacity = .9 * (1 - k); }
    });
    beams.forEach(b => {
      const k = (t - b.t) / b.dur; if (k > 1 || k < 0) { b.m.visible = false; return; }
      const env = k < .2 ? k / .2 : 1 - (k - .2) / .8;
      b.m.quaternion.copy(camera.quaternion); b.m.rotateZ(b.rot); b.m.scale.set(b.w * (.4 + .6 * env), b.h * (b.rot ? .7 + .3 * Math.min(1, k * 5) : 1), 1); b.m.material.opacity = env;
    });
    arcs.forEach(a => {
      const k = (t - a.t) / a.dur; if (k > 1 || k < 0) { a.m.visible = false; return; }
      const sc = a.size * (.75 + .35 * Math.min(1, k * 3)); a.m.scale.set(sc, sc, 1);
      a.m.material.rotation = a.rot + k * .35; a.m.material.opacity = k < .15 ? 1 : 1 - (k - .15) / .85;
    });
    circles.forEach(c => {
      const k = (t - c.t) / c.dur; if (k > 1 || k < 0) { c.m.visible = false; return; }
      const s = c.max * (.35 + .65 * (1 - Math.pow(1 - Math.min(1, k * 2.2), 3))); c.m.scale.set(s, s, 1);
      c.m.material.opacity = (k < .12 ? k / .12 : 1 - (k - .12) / .88) * .95; c.m.rotation.set(-Math.PI / 2, 0, k * 2.4);
    });
    if (flashL) flashL.intensity *= Math.pow(.004, dt);
  }
  shakeA *= Math.pow(.01, dt);
}
const v = new THREE.Vector3();
// 板の画面上の四角（canvas の左上から、CSSの px）
function rect(id) {
  const u = units[id]; if (!u || !u.m.visible) return null;
  const r = canvas.getBoundingClientRect(), sx = u.m.scale.x;
  v.set(u.m.position.x, 0, u.m.position.z).project(camera); const bx = (v.x + 1) / 2 * r.width, by = (1 - v.y) / 2 * r.height;
  v.set(u.m.position.x, u.m.scale.y, u.m.position.z).project(camera); const ty = (1 - v.y) / 2 * r.height;
  v.set(u.m.position.x + sx / 2, 0, u.m.position.z).project(camera); const rx = (v.x + 1) / 2 * r.width;
  return { x: bx, y: ty, w: Math.abs(rx - bx) * 2, h: by - ty };
}
// ---- カメラ：場面ごとの構図へなめらかに動く ----
// wide   全体（ふだん）
// party  味方の背中ごしに敵を見る（味方の番で技を選ぶとき）
// target 敵に寄る（相手を選ぶとき）
// strike 横から敵に寄る（味方が技を出しているとき）
// enemy  敵の背中ごしに味方を見る（敵の番）
const SHOTS = {
  wide:   { p: [.6, 2.5, 13.5], l: [.4, 1.9, -2.5], sway: .5 },
  party:  { p: [8.2, 2.3, 8.2], l: [-2.6, 1.5, -.4], sway: .25 },
  target: { p: [-.9, 3.1, 9.2], l: [-.9, .1, -1], sway: .15 },
  strike: { p: [-1.2, 2.0, 9.4], l: [-1.0, 1.0, -.2], sway: .1 },   // 2026-11-22 攻撃中：敵を画面の左側に（右はカットイン）
  enemy:  { p: [-6.6, 2.7, 7.6], l: [3, .7, .4], sway: .25 },   // 2026-11-22 少し引いて見下ろし、味方が下の帯に隠れないように
};
let shotName = 'wide', camMode = 'auto', focusX = 0;
const camP = new THREE.Vector3(.6, 2.5, 13.5), camL = new THREE.Vector3(.4, 1.9, -2.5), tP = new THREE.Vector3(), tL = new THREE.Vector3();
function focus(id) { const u = units[id]; focusX = u ? u.base[0] * .12 : 0; }
function shot(name, id) { if (SHOTS[name]) shotName = name; focus(id); }
function setCamMode(m) { camMode = m; }

function frame() {
  if (!running) return;
  requestAnimationFrame(frame);
  if (!canvas.offsetParent) return;
  const t = clock.getElapsedTime();
  const S = SHOTS[camMode === 'fixed' ? 'wide' : shotName], fx = shotName === 'wide' ? focusX : 0;
  tP.set(S.p[0] + Math.sin(t * .12) * S.sway + fx, S.p[1] + Math.sin(t * .2) * .08, S.p[2]); tL.set(S.l[0] + fx, S.l[1], S.l[2]);
  const k = 1 - Math.pow(.02, Math.min(.05, Math.max(0, t - (SR._lastT || t))) * 2.2);
  SR._lastT = t;
  if (introT0 >= 0 && t - introT0 < introDur) {
    const q = (t - introT0) / introDur, e = q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2, a = (1 - e) * 2.4, R = 8.5 + 5 * e;
    camP.set(Math.sin(a) * R + .6 * e, 6.5 - 4 * e, Math.cos(a) * R); camL.set(-3 + 3.4 * e, 1.2 + .7 * e, -2.5 * e);
  } else { camP.lerp(tP, k); camL.lerp(tL, k); }
  // 手で回したぶん（左側のドラッグ）。見ている点のまわりを回る
  uYaw += (tYaw - uYaw) * .2; uPitch += (tPitch - uPitch) * .2;
  if (Math.abs(uYaw) > .001 || Math.abs(uPitch) > .001) {
    dv.copy(camP).sub(camL); var r = dv.length(), a = Math.atan2(dv.x, dv.z) + uYaw, el = Math.asin(Math.max(-.95, Math.min(.95, dv.y / r))) + uPitch;
    el = Math.max(.05, Math.min(1.1, el));
    camera.position.set(camL.x + Math.sin(a) * Math.cos(el) * r, camL.y + Math.sin(el) * r, camL.z + Math.cos(a) * Math.cos(el) * r);
  } else camera.position.copy(camP);
  camera.lookAt(camL);
  Object.keys(units).forEach((id, i) => {
    const u = units[id], s = u.state || {};
    u.m.quaternion.copy(camera.quaternion);
    let y = u.bob && !s.down ? Math.sin(t * 1.6 * u.bob + i) * .05 : 0, x = u.base[0];
    const dt = t - u.hitT; if (dt < .35) x += Math.sin(dt * 60) * .08 * (1 - dt / .35);
    if (s.brk) { u.m.rotateZ(u.hero ? -.12 : .12); }
    if (s.down) { u.m.material.opacity = .25; u.m.rotateZ(u.hero ? -1.2 : 1.2); y = .05; } else u.m.material.opacity = 1;
    u.m.material.color.setScalar(s.dim ? .55 : 1);
    u.m.material.emissive = u.m.material.emissive || new THREE.Color(); u.m.material.emissive.setHex(u.hero ? (s.active ? 0x161208 : s.target ? 0x200808 : 0x000000) : (s.target ? 0xffc0b8 : s.active ? 0xfff0d8 : 0xffffff));
    if (u.at) { const f = Math.floor(t * u.at.fps + i * .7) % u.at.frames; u.m.material.map.offset.x = f / u.at.cols; }
    u.m.position.set(x, y + (u.yOff || 0), u.base[1]);
    const want = s.down ? 0 : s.target ? .95 : s.active ? .55 : 0;
    u.rn.material.opacity += (want - u.rn.material.opacity) * .15; u.rn.visible = u.rn.material.opacity > .01 && u.m.visible;
    u.rn.rotation.z = t * (s.target ? .6 : .25) * (u.hero ? -1 : 1); u.rn.scale.setScalar(u.h * (1.15 + (s.target ? Math.sin(t * 4) * .05 : 0)));
  });
  ensureFx(); fxFrame(t, Math.min(.05, Math.max(0, t - (SR._fxT || t)))); SR._fxT = t;
  if (shakeA > .002) { camera.position.x += (Math.random() - .5) * shakeA; camera.position.y += (Math.random() - .5) * shakeA; }
  SR._motes.rotation.y = t * .02; SR._red.intensity = 2.5 + Math.sin(t * 3) * .6;
  composer.render();
  if (onFrame) onFrame();
}
function start() { if (!scene) build(); resize(); if (!running) { running = true; frame(); } }
function stop() { running = false; }
// 2026-11-22 画面が割れる演出用：いまの3D画面をその場で描いて、2Dのキャンバスに写し取る
function snap() {
  if (!composer || !canvas) return null;
  composer.render();
  const c = document.createElement("canvas"); c.width = canvas.width; c.height = canvas.height;
  c.getContext("2d").drawImage(canvas, 0, 0);
  return c;
}

SR.stage3d = { setup, sync, hit, cast, intro, drag, resetView, rect, focus, shot, setCamMode, start, stop, resize, snap, onFrame: (cb) => { onFrame = cb; } };
if (SR.stage3dReady) SR.stage3dReady();
