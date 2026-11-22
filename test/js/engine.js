// バトルの計算部分。sr-battle-sandbox/trio-trial.cjs の simulate() を、
// 人が1ターンずつ操作できる形に移したもの。計算式・数値は試算モデルと同じ。
var SR = window.SR || (window.SR = {});

SR.Battle = function (opts) {
  var C = SR.C, skills = SR.skills;
  var kit = SR.kits[opts.kit], enc = SR.encounters[opts.encounter];
  var tune = SR.tunes[opts.tune || 'sandbox'];
  this.tune = tune;
  var self = this;
  var rng = (opts.seed >>> 0) || 1;
  function random() { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; }

  var roster = ['N', 'V', 'F', 'S', 'L'];
  var formation = opts.formation || roster;
  var heroes = roster.map(function (id) {
    return { id: id, name: SR.names[id], hero: true, hp: 560, maxHp: 560, k: 100, maxK: 100, mp: C.maxMp, maxMp: C.maxMp, until: 0, brk: false, speed: SR.heroSpeed[id], at: 0, turns: 0, form: 'default',
      abilities: kit[id].filter(function (s) { var a = SR.skills[s]; return !a || !a.era || a.era <= (enc.era || 3); }), pos: formation.indexOf(id), aim: 0, analyzed: false, kProtect: 0, protect: 0,
      bp: tune.boost ? 1 : 0, boostUsed: 0, boostMul: 1 };
  });
  // 2026-11-21 技の書の能力の星（自分で編成のときだけ）
  heroes.forEach(function (u) { u.bonus = kit.growth && u.id !== 'N' ? SR.growthBonus(u.id) : {}; if (u.bonus.maxK) { u.maxK += u.bonus.maxK; u.k = u.maxK; } if (u.bonus.spd) u.speed += u.bonus.spd; });
  // レベル（自分で編成のときだけ）
  heroes.forEach(function (u) {
    if (!kit.growth || !SR.level) return;
    var lv = SR.level.lv(u.id), g = SR.lvGrowth, d = lv - 1; u.lv = lv; if (!d) return;
    u.maxHp = Math.round(u.maxHp * (1 + g.hp * d)); u.hp = u.maxHp; u.maxK += g.k * d; u.k = u.maxK; u.speed += (g.spd || 0) * d;
    u.bonus = Object.assign({}, u.bonus); u.bonus.hp = (u.bonus.hp || 0) + g.dmg * d; u.bonus.kd = (u.bonus.kd || 0) + g.kd * d;
  });
  function bon(u, k) { return (u && u.bonus && u.bonus[k]) || 0; }
  var isBoss = enc.engine !== '集団';
  var enemies = enc.party
    ? enc.party.map(function (type, i) {
        var d = SR.enemyTypes[type];
        var same = enc.party.filter(function (x) { return x === type; }).length > 1;
        var nth = enc.party.slice(0, i + 1).filter(function (x) { return x === type; }).length - 1;
        return Object.assign({ id: 'E' + i, type: type, maxHp: d.hp, maxK: d.k, until: 0 }, d,
          { name: d.name + (same ? 'ABCDEFG'[nth] : ''), speed: d.speed - i, tags: d.tags.slice(),
            img: d.imgs ? d.imgs[nth % d.imgs.length] : d.img });
      })
    : !isBoss
    ? [0, 1, 2].map(function (i) {
        return { id: 'E' + i, name: '敵' + 'ABC'[i], hp: 340, maxHp: 340, k: 95, maxK: 95, regen: 12, speed: 68 - i * 15,
          brave: i !== 1, aff: i === 0 ? { 炎: 1.3 } : {}, until: 0 };
      })
    : [{ id: 'B', name: enc.engine === '炎耐性ボス' ? '炎に強いボス' : enc.config.alwaysAoe ? '全体攻撃ボス' : '加入期ボス',
        hp: 1450, maxHp: 1450, k: 240, maxK: 240, regen: 18, speed: 62, brave: true,
        aff: enc.engine === '炎耐性ボス' ? { 炎: 0.55 } : {}, until: 0 }];
  enemies.forEach(function (e, i) {
    Object.assign(e, enc.config); e.pressure = 0;
    if (!e.img) e.img = enc.imgs ? enc.imgs[i] : enc.img;
    if (enc.weaks) e.weak = enc.weaks[i];
    // 状態コンボのぶん、ボス級だけHPを増やして長さと緊張感を保つ
    if (tune.status && tune.bossHp && (isBoss || e.type === 'twin')) { e.hp *= tune.bossHp; e.maxHp *= tune.bossHp; }
    if (tune.bossKMul && (isBoss || e.type === 'twin')) { e.k *= tune.bossKMul; e.maxK *= tune.bossKMul; }   // ボス級のブレイクゲージ（ブレイクまでの長さ）
  });
  var S = SR.hpScale || 1;
  // 2026-11-22 サニー：推奨Lvをそのまま敵のレベルに。Lvの倍率（SR.lvScale）でHP・ダメージ・回復が大きくなる（レベルを使わない編成では、みんなLv1あつかい）
  enemies.forEach(function (e) { e.lv = opts.enemyLv || (kit.growth && SR.recLv ? SR.recLv[opts.encounter] || 1 : 1); });   // コロシアムは enemyLv で指定
  heroes.concat(enemies).forEach(function (u) { u.gs = SR.lvScale ? SR.lvScale(u.lv || 1) : 1; u.limitBreak = !!(u.hero && kit.growth && SR.limitBreak && SR.limitBreak.has(u.id)); });
  function EG() { return (enemies[0] && enemies[0].gs) || 1; }
  function ETH() {   // 敵の一撃が味方に与える倍率（見込み用）
    var a = heroes.filter(function (v) { return v.pos < 3; }), eg = EG(), p = SR.LV_GAP_POW == null ? 1 : SR.LV_GAP_POW;
    if (!a.length) return eg;
    return a.reduce(function (s, v) { var g = v.gs || 1; return s + g * Math.pow(eg / g, p) * (v.hf || 1); }, 0) / a.length * (SR.enemyAtkMul || 1);
  }
  function HF() { var a = heroes.filter(function (v) { return v.pos < 3; }); return a.length ? a.reduce(function (s, v) { return s + (v.hf || 1); }, 0) / a.length : 1; }
  function capDmg(src, n) { return src && src.limitBreak ? n : Math.min(SR.DMG_CAP || 1e9, n); }
  heroes.concat(enemies).forEach(function (u) { var bz = isBoss || u.type === "twin", hs = !u.hero && SR.enemyHpScale ? SR.enemyHpScale(u.lv || 1, bz) * (bz ? 1 : SR.normalHpMul || 1) : u.gs; u.hp = Math.round(u.hp * S * hs); u.maxHp = Math.round(u.maxHp * S * hs); if (u.heal) u.heal *= S * u.gs; });
  heroes.forEach(function (u) { var h = Math.min(SR.HP_CAP || 9999, SR.heroHp ? SR.heroHp(u.lv || 1) : u.maxHp); u.hf = h / u.maxHp; u.maxHp = h; u.hp = h; });   // 味方のHPはゆるい伸び。受けるダメージ・回復も hf をかける
  // 2026-11-22 サニー：MPもLvで伸びる。ステータスのパッシブ（だれでも付けられる）
  heroes.forEach(function (u) {
    u.maxMp = C.maxMp + Math.round(((u.lv || 1) - 1) * (SR.lvGrowth.mp || 0)); u.mp = u.maxMp;
    var P = SR.statPassive || {}; u.bonus = Object.assign({}, u.bonus);
    u.abilities.forEach(function (s) { var p = P[s]; if (!p) return;
      if (p.hp) { u.maxHp = Math.round(u.maxHp * (1 + p.hp)); u.hp = u.maxHp; }
      if (p.mp) { u.maxMp += p.mp; u.mp = u.maxMp; }
      if (p.spd) u.speed += p.spd;
      if (p.k) { u.maxK += p.k; u.k = u.maxK; }
      if (p.dmg) u.bonus.hp = (u.bonus.hp || 0) + p.dmg;
      if (p.guard) u.bonus.guard = (u.bonus.guard || 0) + p.guard;
    });
  });
  heroes.concat(enemies).forEach(function (u) { u.baseMaxHp = u.maxHp; u.baseMaxK = u.maxK; u.brkN = 0; });
  // 2026-11-22 サニー：通常戦は連戦（前の戦いのHP・MP・倒れたままを引きつぐ）。ボス戦は回復してから（ここには来ない）
  if (opts.carry) {
    heroes.forEach(function (u) { var c = opts.carry[u.id]; if (!c) return;
      u.hp = c.down ? 0 : Math.max(1, Math.round(u.maxHp * Math.min(1, c.hp))); u.mp = Math.max(0, Math.min(u.maxMp, Math.round(c.mp))); });
    var fr = heroes.filter(function (v) { return v.pos < 3; });
    if (fr.length && fr.every(function (v) { return v.hp <= 0; })) {   // 前線が全員倒れているなら、元気な控えと入れかえて始める
      heroes.filter(function (v) { return v.pos >= 3 && v.hp > 0; }).sort(function (a, b) { return a.pos - b.pos; }).forEach(function (r, i) { var d = fr[i]; if (!d) return; var p = d.pos; d.pos = r.pos; r.pos = p; });
    }
    if (heroes.every(function (v) { return v.hp <= 0; })) heroes.forEach(function (v) { v.hp = v.maxHp; v.mp = v.maxMp; });
  }
  var breakCut = tune.breakMaxHp || 0;
  function gainMp(u, n) { if (!u.hero || u.hp <= 0 || n <= 0) return; var b = u.mp; u.mp = Math.min(u.maxMp, u.mp + n); if (u.mp - b >= 1) emit(u.name + '　MP+' + Math.round(u.mp - b), { target: u.id, mheal: Math.round(u.mp - b) }, 320); }
  function once(u, key) { if (u[key] === t) return false; u[key] = t; return true; }
  // ブレイクさせたときのMP回復（パッシブ。どれも1ターンに1回）
  function breakMp(dst, src) {
    if (dst.hero) return;
    if (src.hero) {
      if (has(src, '残熱回収') && once(src, 'reclaimTurn')) gainMp(src, 12);
      if (has(src, '集積回路') && once(src, 'circuitTurn')) gainMp(src, 12);
      if (has(src, '陣頭指揮') && once(src, 'leadTurn')) front().forEach(function (v) { if (v !== src) gainMp(v, 8); });
    }
    heroes.forEach(function (v) { if (v.pos < 3 && has(v, '勝ち鬨') && once(v, 'cryTurn')) gainMp(v, 8); });
  }

  this.heroes = heroes; this.enemies = enemies; this.kit = kit; this.enc = enc; this.isBoss = isBoss;
  this.expLog = {};
  this.bag = Object.assign({}, opts.bag || {}); this.bagStart = Object.assign({}, this.bag);   // 2026-11-22 持っていくアイテム
  this.t = 0; this.events = []; this.stat = { breaks: 0, allyBreaks: 0, chases: 0, counters: 0, swaps: 0 };

  var t = 0, cover = null, taunt = null, chaseCount = 0, counterCount = 0;
  var self_cur = null;
  var stat = this.stat;

  function front() { return heroes.filter(function (u) { return u.pos < 3; }).sort(function (a, b) { return a.pos - b.pos; }); }
  function has(u, s) { return u.abilities && u.abilities.indexOf(s) >= 0; }
  function broken(u) { return !!u.brk; }
  function living() { return enemies.filter(function (e) { return e.hp > 0; }); }
  function weakest() { return front().filter(function (u) { return u.hp > 0; }).sort(function (a, b) { return a.hp / a.maxHp - b.hp / b.maxHp; })[0]; }
  function unit(id) { return heroes.concat(enemies).find(function (u) { return u.id === id; }); }
  this.front = front; this.broken = function (u) { return broken(u); }; this.has = has; this.unit = unit; this.living = living;

  function snapshot() {
    var s = {};
    heroes.concat(enemies).forEach(function (u) { s[u.id] = { hp: u.hp, maxHp: u.maxHp, mp: u.mp, k: u.k, brk: broken(u), form: u.form, st: Object.assign({}, u.st), bp: u.bp || 0 }; });
    return s;
  }

  // ---- 状態（燃焼・裂傷・凍結・目眩・感電・暗闇）。「緊張感あり」でだけ働く ----
  var statusOn = !!tune.status;
  this.statusOn = statusOn;
  heroes.concat(enemies).forEach(function (u) { u.st = {}; });
  function hasSt(u, s) { return statusOn && u.st && u.st[s] > 0; }
  this.hasSt = hasSt;
  function addStatus(u, s, n) {
    if (!statusOn || !s || u.hp <= 0) return;
    if (!u.hero && (isBoss || u.type === 'twin')) n = Math.ceil(n / 2);   // ボス級は状態が早く解ける（付け直しのタイミングが勝負）
    var before = u.st[s] || 0;
    u.st[s] = Math.min(SR.statusMax, before + n);
    emit(u.name + '：' + SR.statuses[s].name + (before ? 'が延びた' : '') + '（残り' + u.st[s] + 'ターン）', { target: u.id, status: s }, 380);
    if (!u.hero && (u.weak === s || u.weak2 === s) && !weakKnown(u)) { SR.weakMemo.add(weakKey(u)); emit('弱点だ！ ' + u.name + 'は' + SR.statuses[s].name + 'で崩れやすい', { target: u.id, weak: true }, 900); }
  }
  function hurtBy(u, ratio, why) {
    if (u.hp <= 0) return;
    var d = Math.max(1, Math.min((SR.statusFx.cap[why] || 999) * S * (u.gs || 1) * (u.hf || 1), Math.round(u.maxHp * ratio)));
    u.hp = Math.max(0, u.hp - d);
    emit(u.name + '　' + why + '　HP-' + d, { target: u.id, dmg: d, kdmg: 0, statusTick: true }, 380);
    if (u.hp === 0) emit(u.name + ' は倒れた', { target: u.id, down: true }, 700);
  }
  function bleedOnAct(u) { if (hasSt(u, 'bleed')) hurtBy(u, SR.statusFx.bleed, '裂傷が開いた'); }
  function speedOf(u, base) { return base - (hasSt(u, 'shock') ? SR.statusFx.shock : 0); }
  function emit(text, fx, dur) { self.events.push({ text: text, fx: fx || null, dur: dur || 650, snap: snapshot() }); }
  this.snapshot = snapshot;

  function recover(u, amount) { if (!broken(u) && u.hp > 0) u.k = Math.min(u.maxK, Math.round(u.k + amount)); }

  function hit(src, dst, kd, hp, brave, o) {
    o = o || {};
    var fire = !!o.fire, aoe = !!o.aoe, pos = o.pos === undefined ? dst.pos : o.pos, label = o.label || '';
    if (dst.hp <= 0) return;
    if (hasSt(src, 'blind') && !o.label && random() < SR.statusFx.blind) {
      emit(src.name + 'の攻撃は外れた（暗闇）', { target: dst.id, miss: true }, 420);
      return;
    }
    var wasBroken = broken(dst), previous = dst.k, brokeNow = false;
    if (src.hero && o.phen) hp *= SR.affMul(dst, o.phen, o.pierce);   // 現象の相性：HPへのダメージだけ（レイピアの貫通は「強い」を受けない）
    var wn = dst.hero ? 0 : (dst.weak && hasSt(dst, dst.weak) ? 1 : 0) + (dst.weak2 && hasSt(dst, dst.weak2) ? 1 : 0);
    if (wn) kd *= dst.weak2 ? C.weak2K[wn] : SR.statusFx.weakK;   // 弱点が二つあるボスは、片方で1.5倍・両方で2.5倍
    else if (!dst.hero && tune.bossK && (isBoss || dst.type === 'twin')) kd *= tune.bossK;   // ボス級は弱点の状態が付いていないとブレイクゲージが減りにくい
    if (!dst.hero && dst.charge && tune.chargeK) kd *= tune.chargeK;   // 溜めているあいだはスキだらけ：ブレイクゲージが削れやすい
    if (!dst.hero && dst.openK > 0) kd *= C.openK;   // 大技・全体攻撃の直後のすき
    if (!dst.hero && dst.lonelyK && enemies.some(function (x) { return x !== dst && x.type === dst.type && x.hp <= 0; })) kd *= dst.lonelyK;   // 片方が倒れるとブレイクゲージがゆるむ
    if (src.hero && !dst.hero && dst.kPhen) SR.phenList(o.phen).forEach(function (p) { if (dst.kPhen[p]) kd *= dst.kPhen[p]; });   // 現象の急所：ブレイクゲージに効く
    if (src.hero && !dst.hero && dst.anaK > 0) kd *= 1.3;   // 2026-11-22 アナライズ：解析した相手は崩れやすい
    if (!wasBroken) {
      if (dst.hero && dst.id === 'N' && dst.form === 'brave') kd *= 1.25;
      if (dst.kProtect > 0) kd *= 0.65;
      if (dst.defend > 0) kd *= SR.defendRate;
      if (dst.supportKGuard) kd = Math.max(0, kd - dst.supportKGuard);
      if (dst.barrier) { kd *= 0.35; dst.barrier = false; }
      // 2026-11-21 ブレイクゲージ0は必ずブレイク。ブレイク可でない技はブレイクゲージを1（あと一押し）までしか減らさない
      kd = Math.round(kd);   // ブレイクゲージは整数で計算する（画面の数字どおりにブレイクする）
      dst.k = brave ? Math.max(0, dst.k - kd) : Math.max(Math.min(dst.k, 1), dst.k - kd);
      if (dst.k === 0 && brave) {
        dst.brk = true; if (dst !== self.cur) dst.at += iv(dst) * C.brkDelay; else dst.brkLate = true; stat[dst.hero ? 'allyBreaks' : 'breaks']++; brokeNow = true;
        if (cover && dst === cover.protector) cover = null;
        var fs = tune.foeStack; if (fs && !dst.hero && dst.brkN < fs.max) { dst.brkN++; dst.maxK = Math.round(dst.baseMaxK * (1 - fs.k * dst.brkN)); dst.stackNow = dst.brkN; }
        if (breakCut && dst.hero) { var cutBy = Math.min(dst.maxHp - dst.baseMaxHp * (tune.breakMaxHpFloor || .5), dst.baseMaxHp * breakCut); if (cutBy > 0) { dst.maxHp -= cutBy; dst.hp = Math.min(dst.hp, dst.maxHp); dst.cutNow = Math.round(cutBy); } }
        if (src.hero && src.id === 'N' && src.chasing && has(src, '勝機の一閃')) src.discount = true;
        if (!dst.hero && dst.charge) { dst.charge = 0; dst.stopped = true; }
      }
    }
    var dc = (dst.hero ? tune.heroDmg : tune.dmg) || { base: 0.25, slope: 0.75, broken: 1.5 };
    var amount = hp * (broken(dst) ? dc.broken : dc.base + dc.slope * (1 - dst.k / dst.maxK));
    if (!dst.hero && dst.brkN && tune.foeStack) amount *= 1 + tune.foeStack.dmg * dst.brkN;   // 崩れの蓄積：ブレイクした回数だけ、受けるダメージが増える
    if (!src.hero && aoe) amount *= [1.2, 1, 0.8][pos];
    if (dst.hero && dst.id === 'N' && dst.form === 'revenge' && !broken(dst)) amount *= 0.6;
    if (dst.exposed > 0) amount *= 2;
    if (dst.protect > 0) amount *= 0.7;
    if (dst.vuln > 0) amount *= 1.25;   // 2026-11-22 脆化法
    if (dst.defend > 0) amount *= SR.defendRate;
    if (dst.supportGuard) amount *= 0.96;
    if (dst.hero) amount *= 1 - bon(dst, 'guard');   // 守りの型
    if (hasSt(dst, 'freeze')) amount *= SR.statusFx.freeze;
    if (hasSt(src, 'daze')) amount *= SR.statusFx.daze;
    var gsD = dst.gs || 1, gap = Math.pow((src.gs || 1) / gsD, SR.LV_GAP_POW == null ? 1 : SR.LV_GAP_POW);
    amount = capDmg(src, amount * S * gsD * gap * (dst.hf || 1) * (src.hero ? 1 : SR.enemyAtkMul || 1));   // Lvの倍率（Lv差はゆるく）・上限9999
    if (src.hero && amount > (stat.maxHit || 0)) { stat.maxHit = amount; stat.maxHitBy = src.name; }
    dst.hp = Math.max(0, dst.hp - amount);
    var kLoss = previous - dst.k;
    emit((label ? label + '　' : '') + dst.name + '　HP-' + Math.round(amount) + (kLoss > 0 ? '　ブレイクゲージ-' + Math.round(kLoss) : ''),
      { target: dst.id, dmg: Math.round(amount), kdmg: Math.round(kLoss), by: src.id, phen: SR.phenList(o.phen) }, 330);   // by・phen：演出用（当てた人の色、現象ごとの形）
    if (brokeNow) { emit(dst.name + ' ブレイク！（順番が下がり、次の番は動けない' + (dst.cutNow ? '・最大HP-' + dst.cutNow : '') + (dst.stackNow ? '・崩れ' + dst.stackNow + '：最大ブレイクゲージ' + Math.round(dst.maxK) + '・受けるダメージ+' + Math.round(tune.foeStack.dmg * dst.stackNow * 100) + '%' : '') + '）', { target: dst.id, broke: true, maxCut: dst.cutNow || 0 }, 900); dst.cutNow = 0; dst.stackNow = 0; breakMp(dst, src); }
    if (dst.stopped) { dst.stopped = false; stat.stops = (stat.stops || 0) + 1; emit('溜めが崩れた！ ' + dst.name + 'の大技を止めた', { target: dst.id, stop: true }, 1000); }
    if (dst.hp === 0) emit(dst.name + ' は倒れた', { target: dst.id, down: true }, 700);
    if (o.inflict && dst.hp > 0) addStatus(dst, o.inflict[0], o.inflict[1]);
    // 2026-11-22 挟撃の策：仕掛けた相手に味方の攻撃が当たると、前線のもう一人が追い打ち（1回だけ）
    if (src.hero && !dst.hero && dst.flank && !o.label && dst.hp > 0) {
      dst.flank = false;
      var mate = front().filter(function (v) { return v !== src && v.hp > 0 && !broken(v); })[0];
      if (mate) {
        emit(mate.name + 'の挟撃！（無料の追い打ち）', { actor: mate.id, target: dst.id }, 700);
        hit(mate, dst, 16, 34, true, { label: '挟撃', phen: SR.weapons[mate.id] ? SR.weapons[mate.id].phen : null });
      }
    }
    var n = heroes[0];
    if (src.hero && src !== n && !wasBroken && previous > 1 && dst.k <= 1 && !broken(dst) && dst.hp > 0 && n.hp > 0 && n.pos < 3 &&
        !broken(n) && n.form === 'brave' && chaseCount < (has(n, '追撃の極意') ? 2 : 1)) {
      chaseCount++; stat.chases++; n.chasing = true;
      emit('ナハトの追撃！（無料のブレイブ攻撃）', { actor: 'N', target: dst.id }, 700);
      hit(n, dst, 0, has(n, '追撃の冴え') ? 64 : 36, true, { label: '追撃' }); n.chasing = false;
    }
    if (!src.hero && dst === n && n.hp > 0 && !broken(n) && n.form === 'revenge' && counterCount === 0 && src.hp > 0) {
      counterCount++; stat.counters++;
      emit('ナハトの反撃！（無料）', { actor: 'N', target: src.id }, 700);
      hit(n, src, 20, has(n, '反攻の冴え') ? 62 : 34, has(n, '返し崩し'), { label: '反撃' });
    }
  }

  function price(u, a) {
    var v = a.cost;
    if (u.id === 'V' && has(u, '連撃調整') && (a.hits || 1) > 1) v *= 1.25;
    if (u.id === 'F' && has(u, '過熱') && a.fire) v *= 1.25;
    if (u.discount) v *= 0.7;
    return Math.max(0, Math.ceil(v) - (u.supportEconomy || 0));
  }
  function statusSkillOf() { return null; } // 付与専用技は編成で選ぶ（自動では付かない）
  function weakKey(e) { return e.type || (opts.encounter + ':' + e.id); }
  function weakKnown(e) { return !!e.weak && SR.weakMemo.has(weakKey(e)); }
  this.weakKnown = weakKnown;
  function downFront() { return heroes.filter(function (v) { return v.hp <= 0; }).sort(function (a, b) { return a.pos - b.pos; }); }   // 倒れている仲間（前線が先）
  this.downFront = downFront;
  function linkReady(a) { return !a.link || a.with.every(function (c) { var v = unit(c); return v && v.hp > 0 && !broken(v); }); }
  this.linkReady = function (id) { return linkReady(skills[id] || {}); };
  // 二段構えの2回目は、技のMPが2倍
  function priceNow(u, a) { return price(u, a) * (u.twinSecond ? 2 : 1); }
  function itemUseful(a, v) {   // 2026-11-22 サニー：効き目がない相手には使えない（HP満タンに薬草など）
    if (!v || !v.hero || v.hp <= 0) return false;
    if (a.fx === 'hp') return v.hp < v.maxHp;
    if (a.fx === 'mp') return v.mp < v.maxMp;
    if (a.fx === 'cure') return Object.keys(v.st || {}).some(function (s) { return v.st[s] > 0; });
    return true;
  }
  this.itemUseful = function (id, v) { return itemUseful(skills[id], v); };
  function available(u, id) {
    var a = skills[id];
    if (a && a.item) return !!u.hero && (self.bag[id] || 0) > 0 && (a.kind === 'revive' ? downFront().length > 0 : front().some(function (v) { return itemUseful(a, v); }));   // アイテム（効き目のある相手がいるときだけ）
    if (a && !linkReady(a)) return false;
    if (a && a.kind === 'revive' && !downFront().length) return false;
    if (a && a.needBroken && !living().some(broken)) return false;   // ブレイクのあとの切り札
    if (a && a.kind === 'overclock' && !front().some(function (v) { return v !== u && v.hp > 0 && !broken(v); })) return false;
    return (id === 'basic' || id === 'scan' || id === 'wait' || id === 'light' || id === 'defend' || has(u, id) || id === statusSkillOf(u)) && u.mp >= priceNow(u, a);
  }
  this.price = function (u, id) { return priceNow(u, skills[id]); };
  this.available = available;

  // 使える技の一覧（UI用）
  this.options = function (u) {
    var ss = statusSkillOf(u);
    var ids = ['basic'].concat(ss ? [ss] : [], u.abilities.filter(function (s) { return skills[s]; }), ['defend'], statusOn ? ['scan'] : []);
    if (u.hero) ids = ids.concat(Object.keys(self.bagStart).filter(function (k) { return skills[k] && self.bagStart[k] > 0; }));
    return ids.map(function (id) { return { id: id, skill: skills[id], cost: priceNow(u, skills[id]), ok: available(u, id) }; });
  };
  this.passivesOf = function (u) { return u.abilities.filter(function (s) { return SR.passives[s]; }); };

  // 技の対象の種類：enemy / ally / allyOther / none
  this.targetKind = function (u, id) {
    var a = skills[id];
    if (a.kind === 'attack') return a.all || a.scatter ? 'none' : 'enemy';
    if (a.kind === 'analyze' || a.kind === 'pressure' || a.kind === 'scan') return 'enemy';
    if (['vuln', 'slow', 'seal', 'flank'].indexOf(a.kind) >= 0) return 'enemy';
    if (a.kind === 'bless') return 'ally';
    if (a.kind === 'cover' || a.kind === 'overclock') return 'allyOther';
    if (a.kind === 'aim') return has(u, '照準共有') ? 'ally' : 'none';
    if (a.kind === 'heal') return a.allies ? 'none' : 'ally';
    if (a.kind === 'revive') return 'allyDown';
    if (a.kind === 'item') return 'ally';
    if (a.kind === 'ward' || a.kind === 'rally') return 'ally';
    if (['energy', 'protect', 'kProtect', 'kBarrier', 'power', 'haste'].indexOf(a.kind) >= 0) return 'ally';
    return 'none';
  };

  // 試算モデルの自動方針（おまかせ）
  this.autoPick = function (u) {
    var alive = living(), target = alive.slice().sort(function (a, b) { return a.k - b.k; })[0], low = weakest();
    function choose(ids, to) {
      var id = ids.find(function (id) { return available(u, id); }) || 'wait';
      return { skill: id, target: (to === undefined ? target : to) };
    }
    if (u.id === 'S') {
      var wounded = front().filter(function (v) { return v.hp > 0 && v.hp < v.maxHp * .7; });
      if (wounded.length >= 2 && available(u, '癒しの波')) return choose(['癒しの波'], low);
      if (low.hp < low.maxHp * .68 && available(u, '深癒')) return choose(['深癒'], low);
    }
    if (u.id !== 'N') {
      var healer = front().find(function (v) { return v.id === 'S' && v.hp > 0 && !broken(v) && (available(v, '深癒') || available(v, '癒しの波')); });
      if (low.hp < low.maxHp * 0.56 && !healer && (u.id === 'V' || heroes[1].pos >= 3 || !available(heroes[1], '中回復') || heroes[1].hp <= 0 || broken(heroes[1]))) {
        var ids = front().filter(function (a) { return a.hp > 0 && a.hp < a.maxHp * .6; }).length >= 2 ? ['連環回復', '中回復', '小回復'] : ['中回復', '小回復'];
        if (ids.some(function (id) { return available(u, id); })) return choose(ids, low);
      }
      var needy = front().filter(function (a) { return a !== u && a.hp > 0 && !broken(a) && a.k < 46; }).sort(function (a, b) { return a.k - b.k; })[0];
      if (needy && available(u, '気力支援') && u.mp >= 34) return choose(['気力支援'], needy);
    }
    var mode = kit.mode;
    if (u.id === 'N') {
      if (mode === 'counter') {
        if (target.k < 35 && available(u, 'basic')) return choose(['basic']);
        if (low !== u && low.hp < low.maxHp * .5 && available(u, 'かばう')) return choose(['かばう'], low);
        return choose(['誘い斬り']);
      }
      if (broken(target)) return choose(['断ち込み', '捨て身斬り', '踏み込み斬り', 'basic']);
      if (low !== u && low.hp < low.maxHp * .4 && available(u, 'かばう')) return choose(['かばう'], low);
      return choose(['崩し斬り', 'basic']);
    }
    if (u.id === 'V') {
      if (mode === 'counter' && !(heroes[0].kProtect > 0) && heroes[0].k < 65 && available(u, '気力防護')) return choose(['気力防護'], heroes[0]);
      var aimTarget = has(u, '照準共有') ? (front().find(function (v) { return v.id === 'F' && v.hp > 0 && !broken(v); }) || u) : u;
      if (available(u, '導機照準') && !aimTarget.aim && !broken(target) && u.mp >= 35 && u.turns % 3 === 1) return choose(['導機照準'], aimTarget);
      if (broken(target)) return choose(['連射', '分散連射', 'basic']);
      return choose(alive.length > 1 ? ['分散連射', '連射', '術式妨害', 'basic'] : ['術式妨害', '連射', '分散連射', 'basic']);
    }
    if (u.id === 'S') return choose(['連弾', 'basic']);
    if (u.id === 'L') {
      if ((target.alwaysAoe || living().some(function (e) { return e.charge === 1; })) && front().some(function (v) { return v.k < 60 && !(v.kProtect > 0); }) && available(u, '守勢の号令')) return choose(['守勢の号令']);
      return choose(broken(target) ? ['決着の一閃', '破陣剣', 'basic'] : ['破陣剣', 'basic']);
    }
    if (mode === 'counter' && !(heroes[0].kProtect > 0) && heroes[0].k < 55 && available(u, '気力防護')) return choose(['気力防護'], heroes[0]);
    if (broken(target)) return choose(alive.length > 1 ? ['灰燼', '炎撃', '収束火槍', '火槍', 'basic'] : ['炎撃', '収束火槍', '灰燼', '火槍', 'basic']);
    if (alive.length > 1) return choose(['炎圧', '火の粉', '衝撃波', '火槍', 'basic']);
    var n = heroes[0];
    if (target.k < 32 && n.hp > 0 && n.pos < 3 && !broken(n) && n.form === 'brave' && available(u, '衝撃')) return choose(['衝撃']);
    return choose(['集中火力', '火槍', '衝撃', 'basic']);
  };

  // おまかせのブースト：ブレイク中の相手への攻撃は全部使う。たまり切っているときは1つ使う。
  var basePick = this.autoPick;
  this.autoPick = function (u) {
    var down = downFront(), rv = down.length && u.abilities.find(function (s) { return skills[s] && skills[s].kind === 'revive' && available(u, s); });
    var r = rv ? { skill: rv, target: down[0] } : basePick(u); r.boost = 0;
    if (tune.boost && u.bp > 0 && skills[r.skill] && ['attack', 'heal', 'energy'].indexOf(skills[r.skill].kind) >= 0) {
      if (skills[r.skill].kind === 'attack' && r.target && !r.target.hero && broken(r.target)) r.boost = u.bp;
      else if (u.bp >= tune.boost.max) r.boost = 1;
    }
    return r;
  };

  // 終盤の大技のリスク（緊張感ありのみ）。守りの祈りが掛かっていれば打ち消す
  function applyRisk(u, a) {    if (!statusOn || !(a.recoilTo || a.expose || a.exhaust || a.allK || a.teamRecoil)) return;
    if (a.allK) u.k = Math.min(u.k, 1);   // ブレイクゲージ0はブレイクだけ。決死の一閃は1まで注ぐ
    if (a.teamRecoil) front().forEach(function (v) {      if (v.hp <= 0) return;
      if (v.ward > 0) { emit(v.name + 'は守りの祈りで反動を受けなかった', { target: v.id }, 500); return; }      var lost = Math.round(v.hp * (1 - a.teamRecoil)); v.hp = Math.max(1, v.hp - lost); v.recoilLost = (v.recoilLost || 0) + lost; v.recoilLeft = 2;
      emit(v.name + '　' + (a.label || a.id) + 'の反動　HP-' + lost, { target: v.id, dmg: lost }, 400);
    });
    if (!(a.recoilTo || a.expose || a.exhaust)) return;
    if (u.ward > 0) { u.ward = 0; emit(u.name + 'は守りの祈りで反動を打ち消した', { target: u.id }, 700); return; }    var why = [];
    if (a.recoilTo) { var lost = Math.round(u.hp * (1 - a.recoilTo)); u.hp = Math.max(1, u.hp - lost); u.recoilLost = lost; u.recoilLeft = 2; why.push('HP-' + lost); }    if (a.expose) { u.exposed = 2; why.push('次の番が終わるまで無防備（受けるダメージ2倍・回復を受けつけない）'); }    if (a.exhaust) { u.exhausted = 1; why.push('次の番は動けない'); }    emit(u.name + '　' + (a.label || a.id) + 'の反動　' + why.join('・'), { target: u.id, dmg: a.recoilTo ? u.recoilLost : 0 }, 800);  }
  // 2026-11-22 コンボ：攻撃のときに効いている補助・弱体の数。2つ以上重なると威力が跳ね上がる（1つだけでは増えない）
  function comboN(u, e, aimed) {
    if (!u.hero || !e || e.hero) return 0;
    return (e.vuln > 0) + (e.anaK > 0) + (e.sealK > 0) + (weakOnCount(e) ? 1 : 0) + (u.might > 0) + (u.bless > 0) + (u.power ? 1 : 0) + (aimed ? 1 : 0);
  }
  var COMBO_MUL = [1, 1, 1.1, 1.3, 1.6, 2.0];
  function comboMul(n) { return COMBO_MUL[Math.min(5, n)]; }
  this.comboN = function (uid, eid) { var u = unit(uid), e = unit(eid); return comboN(u, e, u && u.aim > 0); };
  function perform(u, a, target) {
    var tname = target ? target.name : '';
    emit(u.name + '：' + (a.label || a.id) + (u.boostN ? '（ブースト' + u.boostN + (a.id === 'basic' ? '・' + (1 + u.boostN) + '回攻撃' : '・威力×' + u.boostMul) + '）' : '') + (tname && SR_TARGETED(a) ? ' → ' + tname : ''), { actor: u.id, skill: a.id, boost: u.boostN || 0 }, 650);
    if (a.kind !== 'attack' && u.id === 'F') u.fireStreak = 0;
    if (a.kind === 'wait' || a.kind === 'defend') return;
    bleedOnAct(u);
    if (u.hp <= 0) return;
    if (a.kind === 'cover') { if (target.hp > 0) cover = { protector: u, target: target }; return; }
    if (a.kind === 'guard') { u.kProtect = Math.max(u.kProtect || 0, 1); return; }
    if (a.kind === 'heal') {
      (a.allies ? front().filter(function (v) { return v.hp > 0; }) : [target]).forEach(function (v) {
        if (v.hp > 0 && v.exposed > 0) { emit(v.name + 'は無防備で回復を受けつけない', { target: v.id }, 450); return; }
        if (v.hp > 0) { var b = v.hp; v.hp = Math.min(v.maxHp, v.hp + a.amount * S * (u.gs || 1) * (v.hf || 1) * u.boostMul * (1 + bon(u, 'heal'))); emit(v.name + '　HP+' + Math.round(v.hp - b), { target: v.id, heal: Math.round(v.hp - b) }, 380); }
      });
      return;
    }
    if (a.kind === 'ward') {
      target.ward = 2; target.exposed = 0;
      var bad = Object.keys(target.st || {})[0]; if (bad) delete target.st[bad];   // 2026-11-22 悪い状態も1つ解く
      emit(target.name + 'に守りの祈り（次の反動・無防備・燃え尽きを打ち消す' + (bad ? '・' + SR.statuses[bad].name + 'が解けた' : '') + '）', { target: target.id }, 600); return;
    }
    if (a.kind === 'rally') {
      var back = target.recoilLeft > 0 ? target.recoilLost || 0 : 0; target.recoilLost = 0; target.exposed = 0; target.exhausted = 0;
      var kb = target.k; recover(target, 25); if (target.k > kb) emit(target.name + '　ブレイクゲージ+' + Math.round(target.k - kb), { target: target.id, kheal: Math.round(target.k - kb) }, 380);   // 2026-11-22
      if (back) { var hb = target.hp; target.hp = Math.min(target.maxHp, target.hp + back); emit(target.name + 'を立て直した　HP+' + Math.round(target.hp - hb) + '（無防備も解けた）', { target: target.id, heal: Math.round(target.hp - hb) }, 600); }
      else emit(target.name + 'を立て直した（無防備・燃え尽きが解けた）', { target: target.id }, 600);
      return;
    }
    if (a.kind === 'scan') {
      if (!target || target.hero || target.hp <= 0) return;
      if (!target.weak) { emit(target.name + 'に弱点は見つからなかった', { target: target.id }, 700); return; }
      var first = !weakKnown(target); SR.weakMemo.add(weakKey(target));
      emit((first ? '弱点を見つけた！ ' : '') + target.name + 'は' + SR.statuses[target.weak].name + (target.weak2 ? 'と' + SR.statuses[target.weak2].name : '') + 'で崩れやすい' + (target.kPhen ? '（' + Object.keys(target.kPhen).join('・') + 'もブレイクゲージに効く）' : ''), { target: target.id, weak: true }, 1000);
      return;
    }
    if (a.kind === 'revive') {
      if (!target || target.hp > 0) target = downFront()[0];
      if (!target) { emit('起こす相手がいなかった', null, 500); return; }
      target.hp = Math.min(target.maxHp, Math.round(target.maxHp * a.amount * u.boostMul)); target.k = Math.max(target.k, 40); target.st = {};
      emit(target.name + ' が起き上がった！　HP' + target.hp, { target: target.id, heal: target.hp, revive: true }, 900);
      return;
    }
    if (a.kind === 'energy') { var b = target.k; recover(target, a.amount * u.boostMul); emit(target.name + '　ブレイクゲージ+' + Math.round(target.k - b), { target: target.id, kheal: Math.round(target.k - b) }, 380); return; }
    if (a.kind === 'protect') { target.protect = 2; return; }
    if (a.kind === 'kProtect') { target.kProtect = 2; return; }
    if (a.kind === 'teamKProtect') { front().forEach(function (v) { if (v.hp > 0) v.kProtect = 2; }); return; }
    if (a.kind === 'kBarrier') { target.barrier = true; return; }
    if (a.kind === 'pressure') { target.pressure = 2; return; }
    if (a.kind === 'analyze') {   // 2026-11-22 弱点がわかり、2ターン崩れやすくなる
      target.analyzed = true; target.anaK = 2; if (target.weak) SR.weakMemo.add(weakKey(target));
      emit(target.name + 'を解析した（2ターン、ブレイクゲージ削り1.3倍' + (target.weak ? '・弱点は' + SR.statuses[target.weak].name : '') + '）', { target: target.id, weak: !!target.weak }, 800); return;
    }
    // ---- 2026-11-22 補助・弱体・2回続けて動く ----
    if (a.kind === 'vuln') { target.vuln = 2; emit(target.name + 'は脆くなった（2ターン、受けるダメージ1.25倍）', { target: target.id }, 600); return; }
    if (a.kind === 'slow') { target.at += iv(target) * 0.6; emit(target.name + 'の動きが鈍った（次の番が遅れる）', { target: target.id }, 600); return; }
    if (a.kind === 'seal') { target.sealK = 2; emit(target.name + 'に封じの聖印（2ターン、ブレイクゲージが回復しない）', { target: target.id }, 600); return; }
    if (a.kind === 'flank') { target.flank = true; emit(target.name + 'を挟み撃ちにする構え（次に攻撃が当たると追い打ち）', { target: target.id }, 600); return; }
    if (a.kind === 'might') { front().forEach(function (v) { if (v.hp > 0) v.might = 2; }); emit('陽だまりの加護（前線全員、2ターン威力1.15倍）', { actor: u.id }, 600); return; }
    if (a.kind === 'bless') { target.bless = 2; emit(target.name + 'に祝福（次の2回の攻撃の威力1.3倍）', { target: target.id }, 600); return; }
    if (a.kind === 'item') {   // 2026-11-22 アイテム
      if (!target || !target.hero || target.hp <= 0) target = u;
      if (a.fx === 'hp') { var ib = target.hp; target.hp = Math.min(target.maxHp, target.hp + Math.round(target.maxHp * a.v)); emit(u.name + 'は' + a.id + 'を使った　' + target.name + '　HP+' + Math.round(target.hp - ib), { target: target.id, heal: Math.round(target.hp - ib) }, 450); }
      else if (a.fx === 'mp') { var im = target.mp; target.mp = Math.min(target.maxMp, target.mp + a.v); emit(u.name + 'は' + a.id + 'を使った　' + target.name + '　MP+' + Math.round(target.mp - im), { target: target.id, mheal: Math.round(target.mp - im) }, 450); }
      else if (a.fx === 'cure') { target.st = {}; emit(u.name + 'は' + a.id + 'を使った　' + target.name + 'の悪い状態が治った', { target: target.id }, 450); }
      return;
    }
    if (a.kind === 'zanshin') { u.zanshin = true; emit(u.name + 'は残心の構え（次の番、刀剣術を2回続けて振る）', { target: u.id }, 600); return; }
    if (a.kind === 'twin') { u.twinNext = true; emit(u.name + 'は二段構え（次の番、2回続けて動ける）', { target: u.id }, 600); return; }
    if (a.kind === 'overclock') {
      if (!target || target === u || target.hp <= 0 || broken(target)) { emit('動かせる仲間がいなかった', null, 500); return; }
      target.at = now + 0.001; target.quick = true; self.lastWeight += 0.5;
      emit(target.name + 'をオーバークロック！（すぐもう一度動ける）', { target: target.id }, 700); return;
    }
    if (a.kind === 'aim') { target.aim = has(u, '照準維持') ? 2 : 1; return; }
    if (a.kind === 'power') { target.power = true; return; }
    if (a.kind === 'haste') { if (target === u) u.hasteSelf = true; else { target.at = now + Math.max(0, target.at - now) * 0.35; emit(target.name + 'の番が早まった', { target: target.id }, 450); } return; }
    if (target.hp <= 0 && !a.all && !a.scatter) { emit('相手がもう倒れていたので不発', null, 500); return; }
    if (a.taunt) taunt = { u: u, target: target };
    var aimed = u.aim > 0;
    if (a.fire) u.fireStreak = (u.fireStreak || 0) + 1; else if (u.id === 'F') u.fireStreak = 0;
    var targets = a.all ? living() : [target], hits = (a.hits || 1) + (a.id === 'basic' ? (u.boostN || 0) : 0);
    var targetHits = new Map(), brokeInSeq = new Set(), comboShown = false;
    for (var h = 0; h < hits; h++) {
      var set = a.scatter ? [living()[h % Math.max(1, living().length)]] : targets;
      set.forEach(function (e) {
        if (!e || e.hp <= 0) return;
        var kd = a.kd, hp = a.hp, ph = SR.attackPhen(u, a), pl = SR.phenList(ph);
        // 武器の特性（バトル用の案）
        if (u.id === 'V' && (a.id === 'basic' || a.id === 'light')) kd *= 1.2;            // ケインソード：不意を突く突き
        if (u.id === 'F' && pl.indexOf('斬撃') >= 0 && hasSt(e, 'bleed')) hp *= 1.3;   // フランベルジュ：傷が広がる
        kd *= 1 + bon(u, 'kd') + (weakOnCount(e) ? bon(u, 'weakKd') : 0); hp *= 1 + bon(u, 'hp');   // 技の書の能力の星
        if (u.id === 'L' && pl.indexOf('強撃') >= 0) kd *= 1.2;                          // ツヴァイハンダー：守りごと叩き潰す
        if (u.id === 'N' && u.form === 'assault') { kd *= 0.65; hp *= 1.3; }
        if (aimed) kd *= 1.55;
        if (has(u, '連撃調整') && hits > 1) kd *= 1.3;
        if (has(u, '蓄積照準') && hits > 1) kd *= 1 + (targetHits.get(e) || 0) * .2;
        if (has(u, '急所観測') && e.analyzed) kd *= 1.2;
        if (a.antiSpell && e.spell) kd *= 2;
        if (brokeInSeq.has(e) && has(u, '連撃継続')) hp *= 1.5;
        if (a.fire && has(u, '過熱')) hp *= 1.4;
        if (a.fire && has(u, '火勢')) hp *= 1 + Math.min(3, u.fireStreak - 1) * .15;
        if (a.finisher && broken(e)) hp *= a.finisher;
        if (a.exploit && hasSt(e, a.exploit[0])) hp *= a.exploit[1];
        if (a.desperate) hp *= 1 + (1 - u.k / u.maxK) * .45;
        if (a.allK) hp *= 1 + u.k / u.maxK * 1.5;   // 決死の一閃：残りのブレイクゲージが多いほど強い（撃つとブレイクゲージ0）
        if (u.power) hp *= 1.4;
        if (u.might > 0) hp *= 1.15;     // 陽だまりの加護
        if (u.bless > 0) hp *= 1.3;      // 祝福
        if (u.zanHalf) hp *= 0.7;        // 残心の2回目
        var cn = comboN(u, e, aimed);
        if (cn >= 2) {
          hp *= comboMul(cn); if (cn >= 3) kd *= 1.15;
          if (!comboShown) { comboShown = true; emit('コンボ×' + cn + '！ 威力' + comboMul(cn) + '倍', { target: e.id, combo: cn }, 600); }
        }
        if (u.supportPower) hp *= 1.04;
        if (u.limitBreak && hits === 1 && !a.all && !a.scatter) hp *= SR.LIMIT_BREAK.single || 1;   // 限界突破：1発の技が重い
        if (u.boostMul > 1 && a.id !== 'basic') { hp *= u.boostMul; if (boostCfg.kd) kd *= 1 + (u.boostMul - 1) * boostCfg.kd; }
        var willBreak = !broken(e) && a.brave && e.k <= kd;
        if (a.breakBonus && willBreak) hp *= a.breakBonus;
        var before = broken(e);
        hit(u, e, kd, hp, !!a.brave, { fire: a.fire, phen: ph, pierce: u.id === 'S' && pl.indexOf('貫通') >= 0, inflict: a.inflict });
        if (!before && broken(e)) brokeInSeq.add(e);
        targetHits.set(e, (targetHits.get(e) || 0) + 1);
        if (a.id === '炎撃' && has(u, '残り火')) e.pressure = 2;
      });
    }
    applyRisk(u, a);
    if (aimed) u.aim--; u.power = false;
    if (u.bless > 0) u.bless--;
  }
  // ---- ブースト：1ターンに1たまる（最大2）。使ったターンの次はたまらない。威力だけ上がり、回数は増えない ----
  var boostCfg = tune.boost || null;
  this.boostCfg = boostCfg;
  function boostable(id) { var a = skills[id]; return !!boostCfg && !!a && !a.item && (a.kind === 'attack' || a.kind === 'heal' || a.kind === 'energy' || a.kind === 'revive'); }
  this.boostable = boostable;

  function SR_TARGETED(a) { return !(a.all || a.scatter || a.kind === 'wait' || a.kind === 'defend' || a.kind === 'guard' || a.kind === 'teamKProtect' || a.kind === 'might' || a.kind === 'zanshin' || a.kind === 'twin' || (a.kind === 'heal' && a.allies)); }

  // ================= アクティブカウント（2026-11-21 手元の試作） =================
  // 1回の番で動くのは1人だけ。素早さが高いほど番が早く、何度も回ってくる。
  // 「〇ターン」はその人の番の数で数える（守り・無防備など：本人の番が始まるたびに1減る／状態：本人の番の終わりに1減る）。
  var now = 0;
  function iv(u) { return C.ctBase / Math.max(10, u.speed || 60) * (hasSt(u, 'shock') ? SR.statusFx.shockDelay : 1); }
  this.iv = iv;
  // はじめの順番：速い人ほど早い。同じなら味方が先
  heroes.concat(enemies).forEach(function (u, i) { u.at = iv(u) * 0.6 + i * 0.01; u.turns = u.turns || 0; });
  var TICK = ['kProtect', 'protect', 'defend', 'exposed', 'ward', 'recoilLeft', 'openK', 'vuln', 'anaK', 'sealK', 'might'];

  function queue() { return heroes.concat(enemies).filter(function (u) { return u.hp > 0; }); }
  function chargeDue(e, turns) { return !e.noCharge && (isBoss ? turns % 3 : (turns + enemies.indexOf(e)) % 3) === 2; }
  function kindOf(u) { return u.hero ? (u.pos < 3 ? 'hero' : 'support') : 'enemy'; }

  // 次に動く人を決めて、番の始まりの処理をする。動けない番（ブレイク明け・燃え尽き・溜め）はここで終わる。
  this.next = function () {
    self.events = [];
    var list = queue(); if (!list.length) return self.events;
    var u = list.slice().sort(function (a, b) { return a.at - b.at; })[0];
    now = u.at; self.now = now;
    t = ++self.t; self.cur = u; self.curKind = kindOf(u); self.skip = false; self.swapped = null;
    if (u.id === 'N') { chaseCount = 0; counterCount = 0; }
    if (cover && cover.protector === u) cover = null;
    if (taunt && taunt.u === u) taunt = null;
    // 2026-11-22 すぐもう一度動く番（オーバークロック・二段構え）は、回復も効き目の残りも進まない
    var quick = !!u.quick; u.quick = false;
    // ブレイクゲージ・MP・ブーストの回復（その人の番ごと）
    if (u.hero && !broken(u) && !quick) {
      if (u.turns > 0) { recover(u, tune.recovery); u.mp = Math.min(u.maxMp, u.mp + (tune.mpRecovery || 0) * (opts.mpRegenMul == null ? 1 : opts.mpRegenMul) + (has(u, '静心') ? 5 : 0) + bon(u, 'mp')); }
      if (boostCfg && u.turns > 0 && !u.boostLast) u.bp = Math.min(boostCfg.max, u.bp + 1);
      u.boostLast = false;
    }
    if (!u.hero && !broken(u) && !(u.sealK > 0)) u.k = Math.min(u.maxK, u.k + Math.round((u.pressure > 0 ? u.regen * .4 : u.regen) * ((u.weak && hasSt(u, u.weak)) || (u.weak2 && hasSt(u, u.weak2)) ? SR.statusFx.weakRegen : 1)));   // 封じの聖印のあいだは回復しない
    if (!quick) {
      if (u.pressure > 0) u.pressure--;
      TICK.forEach(function (k) { if (u[k] > 0) u[k]--; });
    }
    if (broken(u)) {   // ブレイク明け：この番は休み、ブレイクゲージが全回復
      u.brk = false; u.k = u.maxK;
      if (!u.hero) u.released = true;
      emit(u.name + 'のブレイクが解けた（この番は休み・ブレイクゲージ全回復' + (u.hero ? '' : '・次の番が早く来る') + '）', { target: u.id, recover: true }, 700);
      return endTurn(true);
    }
    u.turns++;
    if (u.exhausted) { u.exhausted = 0; emit(u.name + 'は燃え尽きて動けない', { target: u.id }, 600); return endTurn(true); }
    if (!u.hero && tune.charge) {
      if (u.charge === 1) u.charge = 2;
      else if (chargeDue(u, u.turns)) {
        u.charge = 1;
        emit(u.name + 'は力を溜めている…（次の番に大技。いまはブレイクゲージが1.5倍削れる。ブレイクさせれば止まる）', { actor: u.id, enemy: true, charge: true }, 900);
        return endTurn(true);
      }
    }
    return self.events;
  };

  // 番の終わり：状態が1減る（燃焼はここで効く）・次の番を決める・勝ち負け
  function endTurn(skipped) {
    var u = self.cur;
    if (skipped) self.skip = true;
    if (u.hero) { u.supportEconomy = 0; u.supportPower = false; u.supportGuard = false; u.supportKGuard = 0; }
    if (statusOn && u.hp > 0) {
      if (hasSt(u, 'burn')) hurtBy(u, SR.statusFx.burn, '燃焼');
      Object.keys(u.st).forEach(function (s) { u.st[s]--; if (u.st[s] <= 0 || u.hp <= 0) delete u.st[s]; });
    }
    var w = self.lastWeight || 1; self.lastWeight = 1;
    if (u.released && skipped) w = C.releaseWeight;   // ブレイク明けの敵は、次の番が早く来る
    else u.released = false;
    if (u.hasteSelf) { w *= 0.5; u.hasteSelf = false; }
    u.at = now + iv(u) * w;
    if (u.brkLate) { u.at += iv(u) * C.brkDelay; u.brkLate = false; }
    if (u.twinGo && u.hp > 0 && !broken(u)) {   // 2026-11-22 二段構え：続けてもう一度
      u.twinGo = false; u.at = now + 0.001; u.quick = true; u.twinSecond = true;
      emit(u.name + 'の二段構え！ 続けてもう一度動ける（技のMPは2倍）', { target: u.id }, 600);
    } else u.twinGo = false;
    // 前線が全員倒れたら、控えが飛び出す
    if (tune.status && heroes.filter(function (v) { return v.pos < 3; }).every(function (v) { return v.hp <= 0; })) {
      var downs = heroes.filter(function (v) { return v.pos < 3; }).sort(function (a, b) { return a.pos - b.pos; });
      heroes.filter(function (v) { return v.pos >= 3 && v.hp > 0; }).sort(function (a, b) { return a.pos - b.pos; }).forEach(function (r, i) {
        var d = downs[i], q = r.pos; r.pos = d.pos; d.pos = q;
        emit(r.name + 'が前線に飛び出した！', { actor: r.id }, 800);
      });
    }
    if (enemies.every(function (e) { return e.hp === 0; })) self.outcome = 'win';
    else if (heroes.every(function (v) { return v.hp === 0; })) self.outcome = 'lose';
    return self.events;
  }

  // 味方の番：コマンド { skill, target, boost }
  this.act = function (c) {
    var u = self.cur;
    c = c || { skill: 'wait' };
    var a = skills[c.skill];
    if (!available(u, c.skill)) a = skills.wait;
    var target = c.target ? (typeof c.target === 'string' ? unit(c.target) : c.target) : null;
    var foeKind = ['attack', 'analyze', 'pressure', 'scan', 'vuln', 'slow', 'seal', 'flank'].indexOf(a.kind) >= 0;
    if (!target) target = foeKind ? living().slice().sort(function (x, y) { return x.k - y.k; })[0] : a.kind === 'revive' ? downFront()[0] : a.kind === 'overclock' ? front().filter(function (v) { return v !== u && v.hp > 0 && !broken(v); })[0] : u;
    var second = !!u.twinSecond;
    var cost = priceNow(u, a); u.mp -= cost; u.discount = false; u.twinSecond = false;
    if (a.item) self.bag[a.id] = Math.max(0, (self.bag[a.id] || 0) - 1);   // アイテムを1つ使う
    if (a.form) u.form = a.form;
    if (a.kind === 'defend') u.defend = 1;
    var bn = boostable(a.id) && a !== skills.wait ? Math.max(0, Math.min(c.boost || 0, u.bp)) : 0;
    if (bn) { u.bp -= bn; u.boostLast = true; }
    self.lastWeight = SR.weight(a) + (u.id === 'L' && SR.phenList(SR.attackPhen(u, a)).indexOf('強撃') >= 0 ? 0.1 : 0);   // 大剣は重い
    u.boostN = bn; u.boostMul = bn ? boostCfg.mult[bn] : 1;
    var wasDown = downFront().slice();
    perform(u, a, target);
    // 2026-11-22 残心：刀剣術の攻撃を、続けてもう一太刀（2回目は威力0.7倍）
    if (u.zanshin && a.kind === 'attack' && (a.owner === 'N' || a.id === 'basic') && u.hp > 0 && living().length) {
      u.zanshin = false;
      var t2 = target && target.hp > 0 && !target.hero ? target : living().slice().sort(function (x, y) { return x.k - y.k; })[0];
      emit(u.name + 'の残心　もう一太刀！', { target: u.id }, 500);
      u.zanHalf = true; perform(u, a, t2); u.zanHalf = false;
    }
    // 二段構え：構えた次の番の行動が終わったら、続けてもう一度（2回目の行動では続かない）
    if (u.twinNext && a.kind !== 'twin' && !second) { u.twinNext = false; u.twinGo = true; }
    if (a.link) {
      a.with.forEach(function (c) {
        var v = unit(c); if (!v) return;
        if (a.join && v.pos < 3) v.at += iv(v) * 0.35;   // 合わせ技：いっしょに動いたぶん、次の番が少し遅い
        if (SR.growth && SR.growth.addBond) SR.growth.addBond(c, SR.BOND_PER_USE);
        var bl = self.bondLog || (self.bondLog = {}); bl[c] = (bl[c] || 0) + SR.BOND_PER_USE;
      });
    }
    if (u.id !== 'N') { var ex = SR.actionExp(a); if (ex) { var lg = self.expLog[u.id] || (self.expLog[u.id] = {}); lg[ex[0]] = (lg[ex[0]] || 0) + ex[1]; } }   // 行動で体系の経験値
    u.boostN = 0; u.boostMul = 1;
    // 起き上がった人は、少しあとに番が来る
    wasDown.forEach(function (v) { if (v.hp > 0) v.at = now + iv(v) * 0.5; });
    return endTurn(false);
  };

  // 敵・控えの番（自動）
  this.autoAct = function () {
    var u = self.cur;
    if (u.hero) supportTurn(u); else enemyTurn(u);
    return endTurn(false);
  };

  // 控えの番：支援と、休んで少し回復
  function supportTurn(s) {
    var cost = s.id === 'S' ? 10 : 8;
    var targets = front().filter(function (v) { return v.hp > 0; });
    if (broken(s)) emit(s.name + '（控え）：ブレイク中で支援できない', null, 400);
    else if (s.mp < cost) emit(s.name + '（控え）：MPが足りず支援できない', null, 400);
    else if (targets.length) {
      var target = s.id === 'S' ? targets.slice().sort(function (a, b) { return a.hp / a.maxHp - b.hp / b.maxHp; })[0] : targets.slice().sort(function (a, b) { return a.k - b.k; })[0];
      s.mp -= cost;
      emit(s.name + '（支援）→ ' + target.name + '（' + { N: '次の番まで被ダメージ4%減', V: '次の技の消費-2', F: '次の攻撃4%強化', S: 'HP' + Math.round(20 * S * (s.gs || 1) * (target.hf || 1)) + '回復', L: '次の番までブレイクゲージダメージ-2' }[s.id] + '）', { actor: s.id, support: true }, 450);
      if (s.id === 'N') target.supportGuard = true;
      if (s.id === 'V') target.supportEconomy = 2;
      if (s.id === 'F') target.supportPower = true;
      if (s.id === 'S') { var b = target.hp; target.hp = Math.min(target.maxHp, target.hp + 20 * S * (s.gs || 1) * (target.hf || 1)); if (target.hp - b >= 0.5) emit(target.name + '　HP+' + Math.round(target.hp - b), { target: target.id, heal: Math.round(target.hp - b) }, 300); }
      if (s.id === 'L') target.supportKGuard = 2;
    }
    if (tune.reserveRegen && !broken(s) && s.hp < s.maxHp) {
      var hb = s.hp; s.hp = Math.min(s.maxHp, s.hp + s.maxHp * tune.reserveRegen);
      emit(s.name + '（控えで休む）　HP+' + Math.round(s.hp - hb), { target: s.id, heal: Math.round(s.hp - hb), rest: true }, 300);
    }
  }

  var nums = isBoss ? tune.boss : tune.mob;
  function enemyTurn(e) {
    var big = e.charge === 2;
    if (!big && e.k < 6) { emit(e.name + 'は息切れして動けない', { actor: e.id, enemy: true }, 450); return; }
    if (!big) e.k -= 6;
    // 癒し手：傷ついた仲間がいれば攻撃の代わりに回復
    if (e.heal && !big) {
      var hurt = living().filter(function (x) { return x.hp < x.maxHp * 0.8; }).sort(function (a, b) { return a.hp / a.maxHp - b.hp / b.maxHp; })[0];
      if (hurt) {
        var hb = hurt.hp; hurt.hp = Math.min(hurt.maxHp, hurt.hp + e.heal);
        emit(e.name + 'の回復 → ' + hurt.name + '　HP+' + Math.round(hurt.hp - hb), { actor: e.id, enemy: true, target: hurt.id, heal: Math.round(hurt.hp - hb) }, 750);
        return;
      }
    }
    var alive = front().filter(function (u) { return u.hp > 0; });
    if (!alive.length) return;
    var roll = random(), idx = roll < .5 ? 0 : roll < .8 ? 1 : 2;
    var chosen = alive[Math.min(idx, alive.length - 1)];
    bleedOnAct(e);
    if (e.hp <= 0) return;
    var aoe = big ? isBoss : (!!enc.config.alwaysAoe || !!e.aoeAll || (!tune.charge && e.turns % 3 === 0));
    var victim = taunt && taunt.target === e && taunt.u.hp > 0 && !broken(taunt.u) ? taunt.u : chosen;
    var targets = aoe ? front().filter(function (u) { return u.hp > 0; }) : [victim];
    var who = aoe ? '' : ' → ' + victim.name + (victim !== chosen ? '（誘い斬りで引きつけ）' : '');
    emit(e.name + 'の' + (big ? '大技！' : aoe ? '全体攻撃！' : '攻撃') + who, { actor: e.id, enemy: true, big: big }, big ? 1000 : 700);
    var hits = big || aoe ? 1 : 2;
    var n = big ? nums.big : aoe ? (enc.config.alwaysAoe && nums.aoeAlways ? nums.aoeAlways : nums.aoe) : nums.single;
    targets.forEach(function (v) {
      if (v.hp <= 0) return;
      var rec = cover && cover.target === v && cover.protector.hp > 0 && !broken(cover.protector) ? cover.protector : v;
      if (rec !== v) emit('ナハトが' + v.name + 'をかばう', { target: 'N' }, 450);
      for (var h = 0; h < hits; h++) {
        if (rec.hp <= 0 || e.hp <= 0) break;
        var m = e.atk || 1;
        hit(e, rec, n[0] * m, n[1] * m, big || e.brave, { aoe: aoe, pos: v.pos, inflict: e.inflict });
      }
    });
    if (big) e.charge = 0;
    if (e.hp > 0 && !broken(e) && ((big && (isBoss || e.type === 'twin')) || (aoe && e.openAfterAoe))) { e.openK = 1; emit(e.name + 'にすきができた（次の番までブレイクゲージが' + C.openK + '倍削れる）', { target: e.id }, 650); }
  }

  // 交代：味方の番のあいだに1回。前線と控えの入れ替えか、前線同士の並べ替え。番の人が下がったら、入った人がこの番に動く。
  this.swapped = null;
  this.canSwap = function (id1, id2) {
    var a = unit(id1), b = unit(id2);
    if (self.curKind !== 'hero' || self.swapped || !a || !b || a === b || !a.hero || !b.hero || (broken(a) && a.hp > 0) || (broken(b) && b.hp > 0)) return false;
    if (a !== self.cur && b !== self.cur) return false;   // 交代・並べ替えは、番の人が入れ替わるときだけ
    if (a.pos < 3 && b.pos < 3) return true;
    if (a.pos >= 3 && b.pos >= 3) return false;
    var res = a.pos >= 3 ? a : b;
    return res.hp > 0;
  };
  this.swap = function (id1, id2) {
    if (!self.canSwap(id1, id2)) return false;
    var a = unit(id1), b = unit(id2), front2 = a.pos < 3 && b.pos < 3;
    if (!front2 && a.pos >= 3) { var tmp = a; a = b; b = tmp; }
    var p = a.pos; a.pos = b.pos; b.pos = p;
    self.swapped = { out: a.id, inn: b.id, front: front2, cur: self.cur, outAt: a.at };
    if (!front2) {
      stat.swaps++;
      if (self.cur === a) { self.cur = b; a.at = now + iv(a) * 0.5; }   // 下がった人は、控えとして少しあとに番が来る
    } else stat.moves = (stat.moves || 0) + 1;
    return true;
  };
  this.unswap = function () {
    var w = self.swapped; if (!w) return false;
    var a = unit(w.out), b = unit(w.inn), p = a.pos;
    a.pos = b.pos; b.pos = p; a.at = w.outAt; self.cur = w.cur;
    if (w.front) stat.moves--; else stat.swaps--;
    self.swapped = null;
    return true;
  };

  // これから先の順番（見込み）。いまの番の人が先頭。
  // plan＝{ skill, target }：いまの番の人がその技を使ったら、の見込み（2026-11-22 サニー：技を1回押したら未来の順番が見える）
  this.previewOrder = function (n, plan) {
    n = n || 8;
    var sim = queue().map(function (u) { return { u: u, at: u === self.cur ? -1 : u.at, brk: broken(u), ch: u.charge || 0, tn: u.turns, first: u === self.cur }; });
    var list = [], cu = self.cur, pw = null, pnow = false;
    if (plan && cu && cu.hero && skills[plan.skill]) {
      var a = skills[plan.skill], of = function (v) { return sim.filter(function (s) { return s.u === v; })[0]; };
      var tg = plan.target ? unit(plan.target) : null;
      if (!tg) tg = ['attack', 'analyze', 'pressure', 'scan', 'vuln', 'slow', 'seal', 'flank'].indexOf(a.kind) >= 0 ? living().slice().sort(function (x, y) { return x.k - y.k; })[0]
        : a.kind === 'overclock' ? front().filter(function (v) { return v !== cu && v.hp > 0 && !broken(v); })[0] : cu;
      pw = SR.weight(a) + (cu.id === 'L' && SR.phenList(SR.attackPhen(cu, a)).indexOf('強撃') >= 0 ? 0.1 : 0);
      var ts = tg && of(tg);
      if (a.kind === 'haste') { if (tg === cu) pw *= 0.5; else if (ts) ts.at = now + Math.max(0, ts.at - now) * 0.35; }
      if (a.kind === 'slow' && ts) ts.at += iv(tg) * 0.6;
      if (a.kind === 'overclock' && ts && tg !== cu && !broken(tg)) { ts.at = now + 0.0005; pw += 0.5; }
      if (cu.hasteSelf) pw *= 0.5;
      if (cu.twinNext && a.kind !== 'twin' && !cu.twinSecond) pnow = true;   // 二段構えの番：続けてもう一度
      if (a.link) a.with.forEach(function (c) { var v = unit(c), s = v && of(v); if (a.join && s && v.pos < 3) s.at += iv(v) * 0.35; });
      if (a.kind === 'attack') {   // ブレイクしそうな相手は、順番が下がる
        var hitE = a.all || a.scatter ? living() : tg && !tg.hero ? [tg] : [];
        hitE.forEach(function (e) { var r = self.estimate(cu.id, a.id, e.id), s = of(e); if (r && s && !r.brk && a.brave && r.kd >= e.k) { s.at += iv(e) * C.brkDelay; s.brk = true; } });
      }
    }
    list = [];
    for (var k = 0; k < n && sim.length; k++) {
      sim.sort(function (a, b) { return a.at - b.at; });
      var s = sim[0], u = s.u, label = '', w = 1;
      if (s.first) {
        label = !u.hero && u.charge === 2 ? '大技' : 'いま';
        s.first = false;
        w = u.hero ? 1 : 1;
      } else if (s.brk) { label = 'ブレイク明け（休み）'; s.brk = false; if (!u.hero) w = C.releaseWeight; }
      else if (u.hero) { s.tn++; label = u.exhausted && s.tn === u.turns + 1 ? '動けない' : ''; }
      else {
        s.tn++;
        if (s.ch === 1) { label = '大技'; s.ch = 0; }
        else if (tune.charge && chargeDue(u, s.tn)) { label = '溜め'; s.ch = 1; }
        else label = u.heal ? '攻撃か回復' : (enc.config.alwaysAoe || u.aoeAll) ? '全体攻撃' : '攻撃';
      }
      list.push({ id: u.id, name: u.name, kind: kindOf(u), label: label, cur: k === 0 });
      if (k === 0 && pw !== null) w = pw;
      s.at = (k === 0 ? now : s.at) + iv(u) * w;
      if (k === 0 && pnow) { s.at = now + 0.0001; s.tn--; pnow = false; }
    }
    return list;
  };

  // ================= 考えるおまかせ（2026-11-21 手元の試作） =================
  // 人が考えるように、できる行動を一つずつ見積もって点を付け、いちばん良いものを選ぶ。
  // 見るもの：順番の帯（大技が自分の次の番より先に来るか）・弱点の状態・現象の相性・急所・すき・
  // ブレイクできるか・倒しきれるか・仲間のHPとブレイクゲージ・MPの残り。少しだけ迷い（ゆらぎ）がある。
  var oldPick = this.autoPick;
  function bossish(e) { return isBoss || e.type === 'twin'; }
  function weakOnCount(e) { return (e.weak && hasSt(e, e.weak) ? 1 : 0) + (e.weak2 && hasSt(e, e.weak2) ? 1 : 0); }
  // 自分の次の番より先に動く敵と、その中に大技があるか
  function threat(u) {
    var ord = self.previewOrder(14), mine = -1, foes = [], big = false, aoe = false;
    for (var i = 1; i < ord.length; i++) {
      if (ord[i].id === u.id) { mine = i; break; }
      if (ord[i].kind === 'enemy' && ord[i].label.indexOf('ブレイク') < 0 && ord[i].label !== '溜め') {
        foes.push(ord[i]);
        if (ord[i].label === '大技') { big = true; if (isBoss) aoe = true; }
        if (ord[i].label === '全体攻撃') aoe = true;
      }
    }
    return { foes: foes, big: big, aoe: aoe, mine: mine };
  }
  // 攻撃の見込み（hit の計算をおおまかにまねる）
  function estimate(u, a, e) {
    var hits = (a.hits || 1), ph = SR.attackPhen(u, a), pl = SR.phenList(ph);
    var kd = a.kd * hits, hp = a.hp * hits;
    if (u.id === 'N' && u.form === 'assault') { kd *= 0.65; hp *= 1.3; }
    if (u.aim > 0) kd *= 1.55;
    if (u.id === 'V' && (a.id === 'basic' || a.id === 'light')) kd *= 1.2;
    if (u.id === 'L' && pl.indexOf('強撃') >= 0) kd *= 1.2;
    if (u.id === 'F' && pl.indexOf('斬撃') >= 0 && hasSt(e, 'bleed')) hp *= 1.3;
    if (a.antiSpell && e.spell) kd *= 2;
    if (has(u, '急所観測') && e.analyzed) kd *= 1.2;
    var wn = weakOnCount(e);
    if (wn) kd *= e.weak2 ? C.weak2K[wn] : SR.statusFx.weakK; else if (tune.bossK && bossish(e)) kd *= tune.bossK;
    if (e.charge && tune.chargeK) kd *= tune.chargeK;
    if (e.openK > 0) kd *= C.openK;
    if (e.kPhen) pl.forEach(function (p) { if (e.kPhen[p]) kd *= e.kPhen[p]; });
    hp *= SR.affMul(e, ph, u.id === 'S' && pl.indexOf('貫通') >= 0);
    if (a.finisher && broken(e)) hp *= a.finisher;
    if (a.exploit && hasSt(e, a.exploit[0])) hp *= a.exploit[1];
    if (u.power) hp *= 1.4;
    if (u.might > 0) hp *= 1.15; if (u.bless > 0) hp *= 1.3;           // 2026-11-22 補助
    if (e.anaK > 0) kd *= 1.3;
    if (u.zanshin && (a.owner === 'N' || a.id === 'basic')) hp *= 1.7;  // 残心：2回目（0.7倍）も見込む
    var cn = comboN(u, e, u.aim > 0); if (cn >= 2) { hp *= comboMul(cn); if (cn >= 3) kd *= 1.15; }
    var dc = tune.dmg || { base: 0.25, slope: 0.75, broken: 1.5 };
    var breaks = !broken(e) && !!a.brave && e.k <= kd;
    var mul = broken(e) || breaks ? dc.broken : dc.base + dc.slope * (1 - Math.max(0, e.k - kd / 2) / e.maxK);
    if (a.breakBonus && breaks) hp *= a.breakBonus;
    if (e.brkN && tune.foeStack) mul *= 1 + tune.foeStack.dmg * e.brkN;
    if (hasSt(e, 'freeze')) mul *= SR.statusFx.freeze;
    if (e.vuln > 0) mul *= 1.25;   // 脆化法
    if (u.limitBreak && hits === 1 && !a.all && !a.scatter) hp *= SR.LIMIT_BREAK.single || 1;   // 限界突破：1発の技が重い
    var dmg = capDmg(u, hp * mul * S * (e.gs || 1) * Math.pow((u.gs || 1) / (e.gs || 1), SR.LV_GAP_POW == null ? 1 : SR.LV_GAP_POW) / hits) * hits;   // 上限9999は1発ごと
    return { kd: kd, dmg: dmg, breaks: breaks, kills: dmg >= e.hp, phen: ph };
  }
  function scoreAttack(u, a, e, th) {
    var r = estimate(u, a, e), s = 0;
    s += Math.min(r.dmg, e.hp) / e.maxHp * (bossish(e) ? 340 : 90);   // 2026-11-22 ボスへの削りを少し重く見る（高Lvで連撃を選べるように）
    if (!broken(e)) s += Math.min(r.kd, e.k) / e.maxK * 45;
    if (r.breaks) s += 45 + (e.charge ? 70 : 0) + (bossish(e) ? 35 : 0);
    if (r.kills) s += 35 + (e.heal ? 15 : 0) + (e.aoeAll ? 15 : 0);
    if (broken(e)) s += 10;
    if (e.charge === 1 && !broken(e)) s += Math.min(r.kd, e.k) / e.maxK * 40;   // 大技を止めにいく
    // 付ける状態が弱点なら、ブレイクゲージを崩しやすくなる
    if (a.inflict && statusOn && !broken(e) && e.hp > r.dmg) {
      var st = a.inflict[0], weakHit = e.weak === st || e.weak2 === st;
      if (weakHit && !(e.st[st] > 0)) s += (bossish(e) ? 55 : 35) * (weakKnown(e) ? 1 : 0.4);
      else if (!(e.st[st] > 0)) s += 6;
    }
    return { s: s, r: r };
  }
  function riskPenalty(u, a) {
    if (!(a.recoilTo || a.expose || a.exhaust || a.teamRecoil || a.allK)) return 0;
    if (u.ward > 0) return 5;
    return a.teamRecoil ? 55 : a.exhaust || a.expose ? 40 : 20;
  }
  this.smartPick = function (u) {
    var alive = living(); if (!alive.length) return { skill: 'defend' };
    var th = threat(u), team = front().filter(function (v) { return v.hp > 0; });
    var bigN = (nums.big ? nums.big[1] : nums.aoe[1]) * S * ETH(), hitN = nums.single[1] * S * 2 * ETH();
    var cands = [];
    function add(skill, target, s, why) { cands.push({ skill: skill, target: target, s: s, why: why }); }
    self.options(u).forEach(function (o) {
      if (!o.ok || skills[o.id].item) return;   // おまかせはアイテムを使わない
      var a = skills[o.id], cost = o.cost || 0, mpPen = cost * 0.25 + (u.mp - cost < 20 ? 8 : 0), wPen = (SR.weight(a) - 1) * 20;
      if (a.kind === 'attack') {
        var targets = a.all || a.scatter ? [null] : alive;
        targets.forEach(function (e) {
          var s = 0;
          if (!e) alive.forEach(function (x) { s += scoreAttack(u, a, x, th).s * (a.scatter ? 1 / alive.length : 1); });
          else s = scoreAttack(u, a, e, th).s;
          if (a.taunt && th.foes.length) s += 8;
          add(o.id, e, s - mpPen - wPen - riskPenalty(u, a), 'attack');
        });
        return;
      }
      if (a.kind === 'heal') {
        var hs = 0, list = a.allies ? team : team;
        if (a.allies) team.forEach(function (v) { if (v.exposed > 0) return; hs += Math.min(a.amount * S * (u.gs || 1) * (v.hf || 1), v.maxHp - v.hp) / v.maxHp * 70; });
        var low = team.slice().sort(function (x, y) { return x.hp / x.maxHp - y.hp / y.maxHp; })[0];
        if (!a.allies) { if (low.exposed > 0) return; hs = Math.min(a.amount * S * (u.gs || 1) * (low.hf || 1), low.maxHp - low.hp) / low.maxHp * 90; if (low.hp < (th.big ? bigN : hitN)) hs += 45; if (low.hp < low.maxHp * 0.3) hs += 30; }
        else if (team.filter(function (v) { return v.hp < (th.aoe ? bigN : hitN); }).length) hs += 30;
        if (th.big || th.aoe) hs *= 1.25;
        add(o.id, a.allies ? null : low, hs - mpPen - wPen, 'heal');
        return;
      }
      if (a.kind === 'revive') { var d = downFront()[0]; if (d) add(o.id, d, 140 - mpPen, 'revive'); return; }
      if (a.kind === 'defend') {
        var ds = 2;
        if (th.big && (u.hp < bigN * 1.1 || u.k < 55)) ds += 70;
        else if (th.foes.length && u.k < 30) ds += 30;
        if (th.foes.length && u.hp < hitN) ds += 25;
        add('defend', null, ds, 'defend');
        return;
      }
      if (a.kind === 'scan') {
        var unk = alive.filter(function (e) { return e.weak && !weakKnown(e); })[0];
        if (unk && statusOn) add('scan', unk, (bossish(unk) ? 45 : 22), 'scan');
        return;
      }
      if (a.kind === 'energy') { var nk = team.filter(function (v) { return v !== u && !broken(v); }).sort(function (x, y) { return x.k - y.k; })[0]; if (nk && nk.k < 50) add(o.id, nk, (50 - nk.k) * (th.foes.length ? 1.3 : 0.8) - mpPen, 'energy'); return; }
      if (a.kind === 'teamKProtect') { if (th.big || th.aoe) add(o.id, null, 25 + team.filter(function (v) { return v.k < 70; }).length * 15 - mpPen, 'guard'); return; }
      if (a.kind === 'kProtect' || a.kind === 'kBarrier' || a.kind === 'protect') {
        var pv = team.filter(function (v) { return !(v[a.kind === 'protect' ? 'protect' : 'kProtect'] > 0); }).sort(function (x, y) { return a.kind === 'protect' ? x.hp - y.hp : x.k - y.k; })[0];
        if (pv && th.foes.length) add(o.id, pv, (th.big ? 40 : 14) + (a.kind === 'protect' ? (1 - pv.hp / pv.maxHp) * 20 : (1 - pv.k / pv.maxK) * 25) - mpPen, 'guard');
        return;
      }
      if (a.kind === 'cover') { var cv = team.filter(function (v) { return v !== u; }).sort(function (x, y) { return x.hp - y.hp; })[0]; if (cv && th.foes.length && cv.hp < (th.big ? bigN : hitN) && u.hp > cv.hp * 1.5) add(o.id, cv, 55 - mpPen, 'cover'); return; }
      if (a.kind === 'guard') { if (th.foes.length && u.k < 50) add(o.id, null, 20 + (50 - u.k) * 0.5 - mpPen, 'guard'); return; }
      if (a.kind === 'aim') { if (!u.aim && alive.some(function (e) { return !broken(e); })) add(o.id, u, 18 - mpPen, 'aim'); return; }
      if (a.kind === 'analyze') { var an = alive.filter(function (e) { return !(e.anaK > 0) && !broken(e); }).sort(function (x, y) { return (bossish(y) ? 1 : 0) - (bossish(x) ? 1 : 0); })[0]; if (an) add(o.id, an, 12 + (bossish(an) ? 18 : 0) + (an.weak && !weakKnown(an) ? 8 : 0) + (has(u, '急所観測') ? 6 : 0) - mpPen, 'analyze'); return; }
      // ---- 2026-11-22 補助・弱体・2回続けて動く：組み合わせの場面で点が上がる ----
      var anyBrk = alive.some(broken), boss = alive.some(bossish), strong = function (v) { return ['N', 'F', 'L'].indexOf(v.id) >= 0; };
      if (a.kind === 'vuln') { var vt = alive.filter(function (e) { return !(e.vuln > 0); }).sort(function (x, y) { return y.hp - x.hp; })[0]; if (vt) add(o.id, vt, 8 + (bossish(vt) ? 22 : 0) + (broken(vt) || vt.k < vt.maxK * .35 ? 16 : 0) - mpPen, 'vuln'); return; }
      if (a.kind === 'slow') { var sl = alive.filter(function (e) { return e.charge === 1 && !broken(e); })[0]; if (sl) add(o.id, sl, 30 - mpPen, 'slow'); return; }
      if (a.kind === 'seal') { var se = alive.filter(function (e) { return !broken(e) && !(e.sealK > 0) && e.k < e.maxK * .6; }).sort(function (x, y) { return x.k / x.maxK - y.k / y.maxK; })[0]; if (se) add(o.id, se, 16 + (bossish(se) ? 16 : 0) + (weakOnCount(se) ? 10 : 0) - mpPen, 'seal'); return; }
      if (a.kind === 'flank') { var fl = alive.filter(function (e) { return !e.flank && !broken(e); }).sort(function (x, y) { return x.k - y.k; })[0]; if (fl && team.length >= 3) add(o.id, fl, 18 + (bossish(fl) ? 10 : 0) - mpPen, 'flank'); return; }
      if (a.kind === 'might') { if (!team.some(function (v) { return v.might > 0; })) add(o.id, null, 6 + team.filter(strong).length * 7 + (boss ? 10 : 0) + (anyBrk ? 8 : 0) - mpPen, 'might'); return; }
      if (a.kind === 'bless') { var bl = team.filter(function (v) { return v !== u && strong(v) && !(v.bless > 0) && !broken(v); })[0]; if (bl) add(o.id, bl, 18 + (anyBrk ? 18 : 0) + (boss ? 8 : 0) - mpPen, 'bless'); return; }
      if (a.kind === 'zanshin') { if (!u.zanshin) add(o.id, null, 10 + (alive.some(function (e) { return broken(e) || e.k < e.maxK * .35; }) ? 22 : 0) - mpPen, 'zanshin'); return; }
      if (a.kind === 'twin') { if (!u.twinNext && u.mp >= 45) add(o.id, null, 20 + (anyBrk ? 16 : 0) + (boss ? 6 : 0) - mpPen, 'twin'); return; }
      if (a.kind === 'overclock') { var oc = team.filter(function (v) { return v !== u && strong(v) && !broken(v) && v.mp >= 30; }).sort(function (x, y) { return (y.bless || 0) + (y.power ? 1 : 0) - (x.bless || 0) - (x.power ? 1 : 0); })[0]; if (oc) add(o.id, oc, 14 + (anyBrk ? 30 : 0) + (oc.bless > 0 || oc.power ? 14 : 0) - mpPen, 'overclock'); return; }
      if (a.kind === 'pressure') { var pr = alive.filter(function (e) { return !broken(e) && !(e.pressure > 0); }).sort(function (x, y) { return x.k / x.maxK - y.k / y.maxK; })[0]; if (pr && bossish(pr)) add(o.id, pr, 18 - mpPen, 'pressure'); return; }
      if (a.kind === 'power') { var pw = team.filter(function (v) { return v !== u && !v.power && !broken(v); })[0]; if (pw && alive.some(broken)) add(o.id, pw, 22 - mpPen, 'power'); return; }
      if (a.kind === 'haste') { var hv = team.filter(function (v) { return v !== u && !broken(v); }).sort(function (x, y) { return y.maxK - x.maxK; })[0]; if (hv && (th.big || alive.some(broken))) add(o.id, hv, 20 - mpPen, 'haste'); return; }
      if (a.kind === 'ward') { var wv = team.filter(function (v) { return v.exposed > 0 || v.exhausted; })[0]; if (wv) { add(o.id, wv, 45 - mpPen, 'ward'); return; } var sv = team.filter(function (v) { return Object.keys(v.st || {}).length; })[0]; if (sv) add(o.id, sv, 16 + Object.keys(sv.st).length * 4 - mpPen, 'ward'); return; }
      if (a.kind === 'rally') { var rv = team.filter(function (v) { return v.recoilLeft > 0 || v.exposed > 0; })[0]; if (rv) { add(o.id, rv, 40 - mpPen, 'rally'); return; } var kv = team.filter(function (v) { return !broken(v) && v.k < v.maxK * .45; }).sort(function (x, y) { return x.k - y.k; })[0]; if (kv && th.foes.length) add(o.id, kv, 14 + (1 - kv.k / kv.maxK) * 20 - mpPen, 'rally'); return; }
    });
    if (!cands.length) return { skill: 'defend' };
    cands.forEach(function (c) { c.s *= 0.93 + random() * 0.14; });   // 人らしい迷い
    cands.sort(function (x, y) { return y.s - x.s; });
    var best = cands[0], a = skills[best.skill], boost = 0;
    if (tune.boost && u.bp > 0 && boostable(best.skill)) {
      if (a.kind === 'attack') {
        var tg = best.target || alive[0], r = estimate(u, a, tg);
        if (broken(tg) || r.breaks || (bossish(tg) && u.bp >= tune.boost.max)) boost = u.bp;
        else if (u.bp >= tune.boost.max) boost = 1;
      } else if (best.why === 'heal' || best.why === 'revive') boost = th.big || (best.target && best.target.hp < best.target.maxHp * 0.3) ? u.bp : 0;
    }
    return { skill: best.skill, target: best.target, boost: boost, why: best.why };
  };
  // 交代：HPが少なく、自分の次の番より先に攻撃が来るなら、元気な控えと替わる
  this.smartSwap = function (u) {
    if (self.swapped || !tune.status) return null;
    var th = threat(u), bigN = (nums.big ? nums.big[1] : nums.aoe[1]) * S * ETH(), hitN = nums.single[1] * S * 2 * ETH();
    if (!th.foes.length || u.hp > (th.big ? bigN : hitN) * 1.05) return null;
    var res = heroes.filter(function (v) { return v.pos >= 3 && v.hp > v.maxHp * 0.6 && !broken(v) && self.canSwap(u.id, v.id); }).sort(function (x, y) { return y.hp - x.hp; })[0];
    return res || null;
  };
  this.autoPick = function (u) { return self.smartPick(u); };
  // 画面の「技の詳細」用：この技をこの敵に使ったときの見込み（ブレイクゲージ・HP・ブレイク・倒せるか）
  this.estimate = function (uid, id, eid) {
    var u = unit(uid), e = unit(eid), a = skills[id]; if (!u || !e || !a || a.kind !== 'attack' || e.hp <= 0) return null;
    var r = estimate(u, a, e), pl = SR.phenList(r.phen);
    r.aff = SR.affMul(e, r.phen, u.id === 'S' && pl.indexOf('貫通') >= 0); r.kNow = e.k; r.brk = broken(e);
    if (!a.brave && !r.brk) r.kd = Math.min(r.kd, Math.max(0, e.k - 1));   // ブレイク可でない技はブレイクゲージ1で止まる
    return r;
  };
  this.simplePick = oldPick;
  this.actors = function () { return self.curKind === 'hero' && self.cur && self.cur.hp > 0 ? [self.cur] : []; };
  this.nextEnemyDouble = function (e) { return !!e.released; };
};
