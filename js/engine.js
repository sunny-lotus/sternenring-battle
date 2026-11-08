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
    return { id: id, name: SR.names[id], hero: true, hp: 560, maxHp: 560, k: 100, maxK: 100, until: 0, form: 'default',
      abilities: kit[id].filter(function (s) { var a = SR.skills[s]; return !a || !a.era || a.era <= (enc.era || 3); }), pos: formation.indexOf(id), aim: 0, analyzed: false, kProtect: 0, protect: 0,
      bp: tune.boost ? 1 : 0, boostUsed: 0, boostMul: 1 };
  });
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
          brave: i !== 1, fire: i === 0 ? 1.3 : 1, until: 0 };
      })
    : [{ id: 'B', name: enc.engine === '炎耐性ボス' ? '炎耐性ボス' : enc.config.alwaysAoe ? '全体攻撃ボス' : '加入期ボス',
        hp: 1450, maxHp: 1450, k: 240, maxK: 240, regen: 18, speed: 62, brave: true,
        fire: enc.engine === '炎耐性ボス' ? 0.55 : 1, until: 0 }];
  enemies.forEach(function (e, i) {
    Object.assign(e, enc.config); e.pressure = 0;
    if (!e.img) e.img = enc.imgs ? enc.imgs[i] : enc.img;
    if (enc.weaks) e.weak = enc.weaks[i];
    // 状態コンボのぶん、ボス級だけ体力を増やして長さと緊張感を保つ
    if (tune.status && tune.bossHp && (isBoss || e.type === 'twin')) { e.hp *= tune.bossHp; e.maxHp *= tune.bossHp; }
  });
  var S = SR.hpScale || 1;
  heroes.concat(enemies).forEach(function (u) { u.hp *= S; u.maxHp *= S; if (u.heal) u.heal *= S; });

  this.heroes = heroes; this.enemies = enemies; this.kit = kit; this.enc = enc; this.isBoss = isBoss;
  this.t = 0; this.events = []; this.stat = { breaks: 0, allyBreaks: 0, chases: 0, counters: 0, swaps: 0 };

  var t = 0, cover = null, taunt = null, chaseCount = 0, counterCount = 0;
  var outgoing = {}, supportActions = [];
  var stat = this.stat;

  function front() { return heroes.filter(function (u) { return u.pos < 3; }).sort(function (a, b) { return a.pos - b.pos; }); }
  function has(u, s) { return u.abilities && u.abilities.indexOf(s) >= 0; }
  function broken(u, tt) { return u.until >= (tt === undefined ? t : tt); }
  function living() { return enemies.filter(function (e) { return e.hp > 0; }); }
  function weakest() { return front().filter(function (u) { return u.hp > 0; }).sort(function (a, b) { return a.hp / a.maxHp - b.hp / b.maxHp; })[0]; }
  function unit(id) { return heroes.concat(enemies).find(function (u) { return u.id === id; }); }
  this.front = front; this.broken = function (u) { return broken(u); }; this.has = has; this.unit = unit; this.living = living;

  function snapshot() {
    var s = {};
    heroes.concat(enemies).forEach(function (u) { s[u.id] = { hp: u.hp, k: u.k, brk: broken(u), form: u.form, st: Object.assign({}, u.st), bp: u.bp || 0 }; });
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
    if (!u.hero && u.weak === s && !weakKnown(u)) { SR.weakMemo.add(weakKey(u)); emit('弱点だ！ ' + u.name + 'は' + SR.statuses[s].name + 'で崩れやすい', { target: u.id, weak: true }, 900); }
  }
  function hurtBy(u, ratio, why) {
    if (u.hp <= 0) return;
    var d = Math.max(1, Math.min((SR.statusFx.cap[why] || 999) * S, Math.round(u.maxHp * ratio)));
    u.hp = Math.max(0, u.hp - d);
    emit(u.name + '　' + why + '　体力-' + d, { target: u.id, dmg: d, kdmg: 0, statusTick: true }, 380);
    if (u.hp === 0) emit(u.name + ' は倒れた', { target: u.id, down: true }, 700);
  }
  function bleedOnAct(u) { if (hasSt(u, 'bleed')) hurtBy(u, SR.statusFx.bleed, '裂傷が開いた'); }
  function speedOf(u, base) { return base - (hasSt(u, 'shock') ? SR.statusFx.shock : 0); }
  function emit(text, fx, dur) { self.events.push({ text: text, fx: fx || null, dur: dur || 650, snap: snapshot() }); }
  this.snapshot = snapshot;

  function recover(u, amount) { if (!broken(u) && u.hp > 0) u.k = Math.min(u.maxK, u.k + amount); }

  function hit(src, dst, kd, hp, brave, o) {
    o = o || {};
    var fire = !!o.fire, aoe = !!o.aoe, pos = o.pos === undefined ? dst.pos : o.pos, label = o.label || '';
    if (dst.hp <= 0) return;
    if (hasSt(src, 'blind') && !o.label && random() < SR.statusFx.blind) {
      emit(src.name + 'の攻撃は外れた（暗闇）', { target: dst.id, miss: true }, 420);
      return;
    }
    var wasBroken = broken(dst), previous = dst.k, brokeNow = false;
    if (src.hero && fire) { kd *= dst.fire; hp *= dst.fire; }
    if (!dst.hero && dst.weak && hasSt(dst, dst.weak)) kd *= SR.statusFx.weakK;
    else if (!dst.hero && tune.bossK && (isBoss || dst.type === 'twin')) kd *= tune.bossK;   // ボス級は弱点の状態が付いていないと気力が減りにくい
    if (!wasBroken) {
      if (dst.hero && dst.id === 'N' && dst.form === 'brave') kd *= 1.25;
      if (dst.kProtect >= t) kd *= 0.65;
      if (dst.defend === t) kd *= SR.defendRate;
      if (dst.supportKGuard) kd = Math.max(0, kd - dst.supportKGuard);
      if (dst.barrier) { kd *= 0.35; dst.barrier = false; }
      dst.k = Math.max(0, dst.k - kd);
      if (dst.k === 0 && brave) {
        dst.until = t + 1; stat[dst.hero ? 'allyBreaks' : 'breaks']++; brokeNow = true;
        if (cover && dst === cover.protector) cover = null;
        if (src.hero && src.id === 'F' && has(src, '残熱回収') && src.reclaimTurn !== t) { recover(src, 12); src.reclaimTurn = t; }
        if (src.hero && src.id === 'N' && src.chasing && has(src, '勝機の一閃')) src.discount = true;
        if (!dst.hero && dst.charge) { dst.charge = 0; dst.stopped = true; }
      }
    }
    var dc = (dst.hero ? tune.heroDmg : tune.dmg) || { base: 0.25, slope: 0.75, broken: 1.5 };
    var amount = hp * (broken(dst) ? dc.broken : dc.base + dc.slope * (1 - dst.k / dst.maxK));
    if (!src.hero && aoe) amount *= [1.2, 1, 0.8][pos];
    if (dst.hero && dst.id === 'N' && dst.form === 'revenge' && !broken(dst)) amount *= 0.6;
    if (dst.exposed >= t) amount *= 2;
    if (dst.protect >= t) amount *= 0.7;
    if (dst.defend === t) amount *= SR.defendRate;
    if (dst.supportGuard) amount *= 0.96;
    if (hasSt(dst, 'freeze')) amount *= SR.statusFx.freeze;
    if (hasSt(src, 'daze')) amount *= SR.statusFx.daze;
    amount *= S;
    if (src.hero && amount > (stat.maxHit || 0)) { stat.maxHit = amount; stat.maxHitBy = src.name; }
    dst.hp = Math.max(0, dst.hp - amount);
    var kLoss = previous - dst.k;
    emit((label ? label + '　' : '') + dst.name + '　体力-' + Math.round(amount) + (kLoss > 0 ? '　気力-' + Math.round(kLoss) : ''),
      { target: dst.id, dmg: Math.round(amount), kdmg: Math.round(kLoss) }, 330);
    if (brokeNow) emit(dst.name + ' ブレイク！（' + (t + 1) + 'ターン目の終わりまで動けない）', { target: dst.id, broke: true }, 900);
    if (dst.stopped) { dst.stopped = false; stat.stops = (stat.stops || 0) + 1; emit('溜めが崩れた！ ' + dst.name + 'の大技を止めた', { target: dst.id, stop: true }, 1000); }
    if (dst.hp === 0) emit(dst.name + ' は倒れた', { target: dst.id, down: true }, 700);
    if (o.inflict && dst.hp > 0) addStatus(dst, o.inflict[0], o.inflict[1]);
    var n = heroes[0];
    if (src.hero && src !== n && !wasBroken && previous > 0 && dst.k === 0 && !broken(dst) && dst.hp > 0 && n.hp > 0 && n.pos < 3 &&
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
  function downFront() { return front().filter(function (v) { return v.hp <= 0; }); }
  this.downFront = downFront;
  function available(u, id) { if (skills[id] && skills[id].kind === 'revive' && !downFront().length) return false; return (id === 'basic' || id === 'scan' || id === 'wait' || id === 'light' || id === 'defend' || has(u, id) || id === statusSkillOf(u)) && u.k >= price(u, skills[id]); }
  this.price = function (u, id) { return price(u, skills[id]); };
  this.available = available;

  // 使える技の一覧（UI用）
  this.options = function (u) {
    var ss = statusSkillOf(u);
    var ids = ['basic'].concat(ss ? [ss] : [], u.abilities.filter(function (s) { return skills[s]; }), ['defend'], statusOn ? ['scan'] : []);
    return ids.map(function (id) { return { id: id, skill: skills[id], cost: price(u, skills[id]), ok: available(u, id) }; });
  };
  this.passivesOf = function (u) { return u.abilities.filter(function (s) { return SR.passives[s]; }); };

  // 技の対象の種類：enemy / ally / allyOther / none
  this.targetKind = function (u, id) {
    var a = skills[id];
    if (a.kind === 'attack') return a.all || a.scatter ? 'none' : 'enemy';
    if (a.kind === 'analyze' || a.kind === 'pressure' || a.kind === 'scan') return 'enemy';
    if (a.kind === 'cover') return 'allyOther';
    if (a.kind === 'aim') return has(u, '照準共有') ? 'ally' : 'none';
    if (a.kind === 'heal') return a.allies ? 'none' : 'ally';
    if (a.kind === 'revive') return 'allyDown';
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
      if (needy && available(u, '気力支援') && u.k >= 34) return choose(['気力支援'], needy);
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
      if (mode === 'counter' && heroes[0].kProtect < t && heroes[0].k < 65 && available(u, '気力防護')) return choose(['気力防護'], heroes[0]);
      var aimTarget = has(u, '照準共有') ? (front().find(function (v) { return v.id === 'F' && v.hp > 0 && !broken(v); }) || u) : u;
      if (available(u, '導機照準') && !aimTarget.aim && !broken(target) && u.k >= 35 && t % 3 === 1) return choose(['導機照準'], aimTarget);
      if (broken(target)) return choose(['連射', '分散連射', 'basic']);
      return choose(alive.length > 1 ? ['分散連射', '連射', '術式妨害', 'basic'] : ['術式妨害', '連射', '分散連射', 'basic']);
    }
    if (u.id === 'S') return choose(['連弾', 'basic']);
    if (u.id === 'L') {
      if ((target.alwaysAoe || t % 3 === 0) && front().some(function (v) { return v.k < 60 && v.kProtect < t; }) && available(u, '守勢の号令')) return choose(['守勢の号令']);
      return choose(broken(target) ? ['決着の一閃', '破陣剣', 'basic'] : ['破陣剣', 'basic']);
    }
    if (mode === 'counter' && heroes[0].kProtect < t && heroes[0].k < 55 && available(u, '気力防護')) return choose(['気力防護'], heroes[0]);
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
    if (a.allK) u.k = 0;
    if (a.teamRecoil) front().forEach(function (v) {      if (v.hp <= 0) return;
      if (v.ward >= t) { emit(v.name + 'は守りの祈りで反動を受けなかった', { target: v.id }, 500); return; }      var lost = Math.round(v.hp * (1 - a.teamRecoil)); v.hp = Math.max(1, v.hp - lost); v.recoilLost = (v.recoilLost || 0) + lost; v.recoilT = t;
      emit(v.name + '　' + (a.label || a.id) + 'の反動　体力-' + lost, { target: v.id, dmg: lost }, 400);
    });
    if (!(a.recoilTo || a.expose || a.exhaust)) return;
    if (u.ward >= t) { u.ward = 0; emit(u.name + 'は守りの祈りで反動を打ち消した', { target: u.id }, 700); return; }    var why = [];
    if (a.recoilTo) { var lost = Math.round(u.hp * (1 - a.recoilTo)); u.hp = Math.max(1, u.hp - lost); u.recoilLost = lost; u.recoilT = t; why.push('体力-' + lost); }    if (a.expose) { u.exposed = t + 1; why.push('次のターンの終わりまで無防備（受けるダメージ2倍・回復を受けつけない）'); }    if (a.exhaust) { u.exhausted = t + 1; why.push('次のターンは動けない'); }    emit(u.name + '　' + (a.label || a.id) + 'の反動　' + why.join('・'), { target: u.id, dmg: a.recoilTo ? u.recoilLost : 0 }, 800);  }
  function perform(u, a, target) {
    var tname = target ? target.name : '';
    emit(u.name + '：' + (a.label || a.id) + (u.boostN ? '（ブースト' + u.boostN + (a.id === 'basic' ? '・' + (1 + u.boostN) + '回攻撃' : '・威力×' + u.boostMul) + '）' : '') + (tname && SR_TARGETED(a) ? ' → ' + tname : ''), { actor: u.id, skill: a.id, boost: u.boostN || 0 }, 650);
    if (a.kind !== 'attack' && u.id === 'F') u.fireStreak = 0;
    if (a.kind === 'wait' || a.kind === 'defend') return;
    bleedOnAct(u);
    if (u.hp <= 0) return;
    if (a.kind === 'cover') { if (target.hp > 0) cover = { protector: u, target: target }; return; }
    if (a.kind === 'guard') { u.kProtect = t; return; }
    if (a.kind === 'heal') {
      (a.allies ? front().filter(function (v) { return v.hp > 0; }) : [target]).forEach(function (v) {
        if (v.hp > 0 && v.exposed >= t) { emit(v.name + 'は無防備で回復を受けつけない', { target: v.id }, 450); return; }
        if (v.hp > 0) { var b = v.hp; v.hp = Math.min(v.maxHp, v.hp + a.amount * S * u.boostMul); emit(v.name + '　体力+' + Math.round(v.hp - b), { target: v.id, heal: Math.round(v.hp - b) }, 380); }
      });
      return;
    }
    if (a.kind === 'ward') { target.ward = t + 1; target.exposed = 0; emit(target.name + 'に守りの祈り（次の反動・無防備・燃え尽きを打ち消す）', { target: target.id }, 600); return; }
    if (a.kind === 'rally') {
      var back = target.recoilT >= t - 1 ? target.recoilLost || 0 : 0; target.recoilLost = 0; target.exposed = 0; target.exhausted = 0;
      if (back) { var hb = target.hp; target.hp = Math.min(target.maxHp, target.hp + back); emit(target.name + 'を立て直した　体力+' + Math.round(target.hp - hb) + '（無防備も解けた）', { target: target.id, heal: Math.round(target.hp - hb) }, 600); }
      else emit(target.name + 'を立て直した（無防備・燃え尽きが解けた）', { target: target.id }, 600);
      return;
    }
    if (a.kind === 'scan') {
      if (!target || target.hero || target.hp <= 0) return;
      if (!target.weak) { emit(target.name + 'に弱点は見つからなかった', { target: target.id }, 700); return; }
      var first = !weakKnown(target); SR.weakMemo.add(weakKey(target));
      emit((first ? '弱点を見つけた！ ' : '') + target.name + 'は' + SR.statuses[target.weak].name + 'で崩れやすい', { target: target.id, weak: true }, 1000);
      return;
    }
    if (a.kind === 'revive') {
      if (!target || target.hp > 0 || target.pos >= 3) target = downFront()[0];
      if (!target) { emit('起こす相手がいなかった', null, 500); return; }
      target.hp = Math.min(target.maxHp, Math.round(target.maxHp * a.amount * u.boostMul)); target.k = Math.max(target.k, 40); target.st = {};
      emit(target.name + ' が起き上がった！　体力' + target.hp, { target: target.id, heal: target.hp, revive: true }, 900);
      return;
    }
    if (a.kind === 'energy') { var b = target.k; recover(target, a.amount * u.boostMul); emit(target.name + '　気力+' + Math.round(target.k - b), { target: target.id, kheal: Math.round(target.k - b) }, 380); return; }
    if (a.kind === 'protect') { target.protect = t + 1; return; }
    if (a.kind === 'kProtect') { target.kProtect = t + 1; return; }
    if (a.kind === 'teamKProtect') { front().forEach(function (v) { if (v.hp > 0) v.kProtect = t + 1; }); return; }
    if (a.kind === 'kBarrier') { target.barrier = true; return; }
    if (a.kind === 'pressure') { target.pressure = t + 1; return; }
    if (a.kind === 'analyze') { target.analyzed = true; return; }
    if (a.kind === 'aim') { target.aim = has(u, '照準維持') ? 2 : 1; return; }
    if (a.kind === 'power') { target.power = true; return; }
    if (a.kind === 'haste') { target.haste = true; return; }
    if (target.hp <= 0 && !a.all && !a.scatter) { emit('相手がもう倒れていたので不発', null, 500); return; }
    if (a.taunt) taunt = { u: u, target: target };
    var aimed = u.aim > 0;
    if (a.fire) u.fireStreak = (u.fireStreak || 0) + 1; else if (u.id === 'F') u.fireStreak = 0;
    var targets = a.all ? living() : [target], hits = (a.hits || 1) + (a.id === 'basic' ? (u.boostN || 0) : 0);
    var targetHits = new Map(), brokeInSeq = new Set();
    for (var h = 0; h < hits; h++) {
      var set = a.scatter ? [living()[h % Math.max(1, living().length)]] : targets;
      set.forEach(function (e) {
        if (!e || e.hp <= 0) return;
        var kd = a.kd, hp = a.hp;
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
        if (a.allK) hp *= 1 + u.k / u.maxK * 1.5;   // 決死の一閃：残りの気力が多いほど強い（撃つと気力0）
        if (u.power) hp *= 1.4;
        if (u.supportPower) hp *= 1.04;
        if (u.boostMul > 1 && a.id !== 'basic') { hp *= u.boostMul; if (boostCfg.kd) kd *= 1 + (u.boostMul - 1) * boostCfg.kd; }
        var willBreak = !broken(e) && a.brave && e.k <= kd * (a.fire ? e.fire : 1);
        if (a.breakBonus && willBreak) hp *= a.breakBonus;
        var before = broken(e);
        hit(u, e, kd, hp, !!a.brave, { fire: a.fire, inflict: a.inflict });
        if (!before && broken(e)) brokeInSeq.add(e);
        targetHits.set(e, (targetHits.get(e) || 0) + 1);
        if (a.id === '炎撃' && has(u, '残り火')) e.pressure = t + 1;
      });
    }
    applyRisk(u, a);
    if (aimed) u.aim--; u.power = false;
  }
  // ---- ブースト：1ターンに1たまる（最大2）。使ったターンの次はたまらない。威力だけ上がり、回数は増えない ----
  var boostCfg = tune.boost || null;
  this.boostCfg = boostCfg;
  function boostable(id) { var a = skills[id]; return !!boostCfg && !!a && (a.kind === 'attack' || a.kind === 'heal' || a.kind === 'energy' || a.kind === 'revive'); }
  this.boostable = boostable;

  function SR_TARGETED(a) { return !(a.all || a.scatter || a.kind === 'wait' || a.kind === 'defend' || a.kind === 'guard' || a.kind === 'teamKProtect' || (a.kind === 'heal' && a.allies)); }

  // ---- 1ターンの流れ ----
  this.beginTurn = function () {
    t = ++self.t; cover = null; taunt = null; chaseCount = 0; counterCount = 0; outgoing = {}; supportActions = []; paid = []; self.swapped = null;
    if (t > 1) {
      heroes.forEach(function (u) { recover(u, tune.recovery); });
      if (boostCfg) heroes.forEach(function (u) { if (u.hp > 0 && !broken(u) && u.boostUsed !== t - 1) u.bp = Math.min(boostCfg.max, u.bp + 1); });
      enemies.forEach(function (e) { if (e.hp > 0 && !broken(e)) e.k = Math.min(e.maxK, e.k + (e.pressure >= t ? e.regen * .4 : e.regen) * (e.weak && hasSt(e, e.weak) ? SR.statusFx.weakRegen : 1)); });
    }
    heroes.forEach(function (u) { u.supportEconomy = 0; u.supportPower = false; u.supportGuard = false; u.supportKGuard = 0; });
    self.aoe = !!enc.config.alwaysAoe || (!tune.charge && t % 3 === 0);
    // 溜め：溜めたターンは攻撃しない → 次のターンに大技。それまでにブレイクさせれば止まる。
    if (tune.charge) enemies.forEach(function (e, i) {
      if (e.hp <= 0 || broken(e)) { e.charge = 0; return; }
      if (e.charge === 1) e.charge = 2;
      else if (!e.noCharge && (isBoss ? t % 3 : (t + i) % 3) === 2) e.charge = 1;
    });
  };

  this.resetTurnFlags = function () { outgoing = {}; supportActions = []; self.supportPlan = []; paid = []; self.swapped = null; };

  // 交代は1ターン1組。行動開始までなら取り消せる。
  this.swapped = null;
  // 1ターンに1回：控えとの交代（前線1人⇔控え1人）か、前線同士の入れ替え。ブレイク中の人は動かせない。
  this.canSwap = function (id1, id2) {
    var a = unit(id1), b = unit(id2);
    if (self.swapped || !a || !b || a === b || !a.hero || !b.hero || broken(a) || broken(b)) return false;
    if (a.pos < 3 && b.pos < 3) return true;
    if (a.pos >= 3 && b.pos >= 3) return false;
    var res = a.pos >= 3 ? a : b;
    return res.hp > 0;
  };
  this.swap = function (id1, id2) {
    if (!self.canSwap(id1, id2)) return false;
    var a = unit(id1), b = unit(id2), p = a.pos, front2 = a.pos < 3 && b.pos < 3;
    if (!front2 && a.pos >= 3) { var tmp = a; a = b; b = tmp; p = a.pos; }
    a.pos = b.pos; b.pos = p;
    if (!front2) { outgoing[a.id] = true; stat.swaps++; }
    else stat.moves = (stat.moves || 0) + 1;
    self.swapped = { out: a.id, inn: b.id, front: front2 };
    self.planSupports();
    return true;
  };
  this.unswap = function () {
    if (!self.swapped) return false;
    var a = unit(self.swapped.out), b = unit(self.swapped.inn), p = a.pos;
    a.pos = b.pos; b.pos = p; outgoing = {};
    if (self.swapped.front) stat.moves--; else stat.swaps--;
    self.swapped = null;
    self.planSupports();
    return true;
  };

  // 支援の対象と消費を決める（試算モデルと同じ順番）。交代のたびに払い戻してから決め直す。
  var paid = [];
  this.planSupports = function () {
    paid.forEach(function (p) { p.u.k += p.cost; });
    paid = [];
    heroes.forEach(function (u) { u.supportEconomy = 0; });
    supportActions = []; self.supportPlan = [];
    heroes.filter(function (u) { return u.pos >= 3 && u.hp > 0; }).forEach(function (s) {
      if (outgoing[s.id]) { self.supportPlan.push(s.name + '：交代で下がったので支援は休み'); return; }
      if (broken(s)) { self.supportPlan.push(s.name + '：ブレイク中で支援できない'); return; }
      var cost = s.id === 'S' ? 10 : 8;
      if (s.k < cost) { self.supportPlan.push(s.name + '：気力が足りず支援できない'); return; }
      var targets = front().filter(function (u) { return u.hp > 0; });
      if (!targets.length) return;
      var target = s.id === 'S' ? targets.slice().sort(function (a, b) { return a.hp - b.hp; })[0] : targets.slice().sort(function (a, b) { return a.k - b.k; })[0];
      s.k -= cost; paid.push({ u: s, cost: cost });
      if (s.id === 'V') target.supportEconomy = 2;
      self.supportPlan.push(s.name + 'の支援 → ' + target.name + '（' + { N: '被ダメージ4%減', V: '技の消費-2', F: '攻撃4%強化', S: '体力' + 20 * S + '回復', L: '気力ダメージ-2' }[s.id] + '）');
      supportActions.push({ u: s, speed: 90, execute: function () {
        emit(s.name + '（支援）→ ' + target.name, { actor: s.id, support: true }, 450);
        if (target.hp <= 0) return;
        if (s.id === 'N') target.supportGuard = true;
        if (s.id === 'F') target.supportPower = true;
        if (s.id === 'S') { var b = target.hp; target.hp = Math.min(target.maxHp, target.hp + 20 * S); if (target.hp - b >= 0.5) emit(target.name + '　体力+' + Math.round(target.hp - b), { target: target.id, heal: Math.round(target.hp - b) }, 300); }
        if (s.id === 'L') target.supportKGuard = 2;
      } });
    });
  };

  // 行動順の見込み（resolve と同じ速さの決め方・同じ並べ方）。cmds は入力中のコマンド。
  this.previewOrder = function (commands) {
    var list = [];
    supportActions.forEach(function (s) { list.push({ id: s.u.id, name: s.u.name, kind: 'support', speed: 90, label: '支援' }); });
    self.actors().forEach(function (u) {
      var c = commands[u.id], a = skills[c ? c.skill : 'defend'];
      var speed = a.kind === 'cover' ? 100 : speedOf(u, 80 - u.pos * 20 + (u.haste ? 25 : 0));
      if (a.kind === 'aim') speed += 5;
      list.push({ id: u.id, name: u.name, kind: 'hero', speed: speed, label: c ? (a.label || a.id) : '未入力', todo: !c });
    });
    living().forEach(function (e) {
      if (broken(e)) return;
      if (e.charge === 1) { list.push({ id: e.id, name: e.name, kind: 'enemy', speed: speedOf(e, e.speed), label: '溜め' }); return; }
      if (e.k < 6) return;
      var counts = (e.released ? 2 : 1) + (tune.bossActs && (isBoss || e.type === 'twin') ? tune.bossActs - 1 : 0);
      for (var c = 0; c < counts; c++) list.push({ id: e.id, name: e.name, kind: 'enemy', speed: speedOf(e, e.speed) - c * 2,
        label: c === 0 && e.charge === 2 ? '大技' : e.heal ? '攻撃か回復' : (self.aoe || e.aoeAll) ? '全体攻撃' : '攻撃' });
    });
    list.sort(function (a, b) { return b.speed - a.speed; });
    return list;
  };

  this.actors = function () { return front().filter(function (u) { return u.hp > 0 && !broken(u) && !(u.exhausted >= t); }); };

  // commands: { heroId: { skill, target } }
  this.resolve = function (commands) {
    self.events = []; paid = [];
    var actions = supportActions.slice();
    self.actors().forEach(function (u) {
      var c = commands[u.id] || { skill: 'wait' };
      var a = skills[c.skill];
      if (!available(u, c.skill)) a = skills.wait;
      var target = c.target ? (typeof c.target === 'string' ? unit(c.target) : c.target) : null;
      if (!target) target = a.kind === 'attack' || a.kind === 'analyze' || a.kind === 'pressure' || a.kind === 'scan' ? living().slice().sort(function (x, y) { return x.k - y.k; })[0] : a.kind === 'revive' ? downFront()[0] : u;
      var cost = price(u, a); u.k -= cost; u.discount = false;
      if (a.form) u.form = a.form;
      if (a.kind === 'defend') u.defend = t;
      var speed = a.kind === 'cover' ? 100 : speedOf(u, 80 - u.pos * 20 + (u.haste ? 25 : 0)); u.haste = false;
      if (a.kind === 'aim') speed += 5;
      var bn = boostable(c.skill) && a !== skills.wait ? Math.max(0, Math.min(c.boost || 0, u.bp)) : 0;
      if (bn) { u.bp -= bn; u.boostUsed = t; }
      actions.push({ u: u, speed: speed, execute: function () {
        u.boostN = bn; u.boostMul = bn ? boostCfg.mult[bn] : 1;
        perform(u, a, target);
        u.boostN = 0; u.boostMul = 1;
      } });
    });
    // 交代は、入る人の行動の順番が来たときに入れ替わる（それまでは下がる人が前線で攻撃を受ける）
    if (tune.status && self.swapped && !self.swapped.front) {      var so = unit(self.swapped.out), si = unit(self.swapped.inn), sp = si.pos; si.pos = so.pos; so.pos = sp;      var inAct = actions.find(function (x) { return x.u === si; });      var doSwap = function () { var q = si.pos; si.pos = so.pos; so.pos = q; if (cover && cover.target === so) cover = null; emit('交代：' + so.name + ' → ' + si.name, { actor: si.id, swap: true }, 650); };      if (inAct) { var ex0 = inAct.execute; inAct.execute = function () { doSwap(); ex0(); }; } else actions.push({ u: si, speed: 60, execute: doSwap });    }
    var nums = isBoss ? tune.boss : tune.mob;
    living().forEach(function (e) {
      if (broken(e)) return;
      if (e.charge === 1) {
        actions.push({ u: e, speed: speedOf(e, e.speed), execute: function () {
          emit(e.name + 'は力を溜めている…（次のターンに大技。ブレイクさせれば止まる）', { actor: e.id, enemy: true, charge: true }, 900);
        } });
        return;
      }
      if (e.k < 6) return; e.k -= 6;
      var counts = (e.released ? 2 : 1) + (tune.bossActs && (isBoss || e.type === 'twin') ? tune.bossActs - 1 : 0); e.released = false;
      var alive = front().filter(function (u) { return u.hp > 0; });
      var roll = random(), idx = roll < .5 ? 0 : roll < .8 ? 1 : 2;
      if (!alive.length) return;
      var chosen = alive[Math.min(idx, alive.length - 1)], chosenPos = chosen.pos;
      for (var c = 0; c < counts; c++) (function (c) { actions.push({ u: e, speed: speedOf(e, e.speed) - c * 2, execute: function () {
        var big = c === 0 && e.charge === 2;
        if (big) e.charge = 0;
        // 癒し手：傷ついた仲間がいれば攻撃の代わりに回復
        if (e.heal && !big) {
          var hurt = living().filter(function (x) { return x.hp < x.maxHp * 0.8; }).sort(function (a, b) { return a.hp / a.maxHp - b.hp / b.maxHp; })[0];
          if (hurt) {
            var hb = hurt.hp; hurt.hp = Math.min(hurt.maxHp, hurt.hp + e.heal);
            emit(e.name + 'の回復 → ' + hurt.name + '　体力+' + Math.round(hurt.hp - hb), { actor: e.id, enemy: true, target: hurt.id, heal: Math.round(hurt.hp - hb) }, 750);
            return;
          }
        }
        bleedOnAct(e);
        if (e.hp <= 0) return;
        var aoe = big ? isBoss : (self.aoe || !!e.aoeAll);
        if (chosen.pos >= 3) chosen = front().find(function (u) { return u.pos === chosenPos && u.hp > 0; }) || chosen;
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
      } }); })(c);
    });
    actions.sort(function (a, b) { return b.speed - a.speed; });
    for (var i = 0; i < actions.length; i++) {
      var ac = actions[i];
      if (!living().length) break;
      if (ac.u.hp <= 0 || broken(ac.u)) { if (ac.u.hero && ac.u.pos < 3) emit(ac.u.name + 'は動けない', null, 450); continue; }
      ac.execute();
    }
    enemies.forEach(function (e) { if (e.charge === 2) e.charge = 0; });
    // ターンの終わり：控えで休んでいる人は体力が少し回復（緊張感ありのみ）
    if (tune.reserveRegen) heroes.forEach(function (u) {
      if (u.pos < 3 || u.hp <= 0 || broken(u) || u.hp >= u.maxHp) return;
      var b = u.hp; u.hp = Math.min(u.maxHp, u.hp + u.maxHp * tune.reserveRegen);
      emit(u.name + '（控えで休む）　体力+' + Math.round(u.hp - b), { target: u.id, heal: Math.round(u.hp - b), rest: true }, 300);
    });
    // ターンの終わり：燃焼で体力が減り、すべての状態が1ターン減る
    if (statusOn) heroes.concat(enemies).forEach(function (u) {
      if (u.hp > 0 && hasSt(u, 'burn')) hurtBy(u, SR.statusFx.burn, '燃焼');
      Object.keys(u.st).forEach(function (s) { u.st[s]--; if (u.st[s] <= 0 || u.hp <= 0) delete u.st[s]; });
    });
    heroes.concat(enemies).forEach(function (u) {
      if (u.until === t) { u.until = 0; u.k = u.maxK; u.released = true; if (u.hp > 0) emit(u.name + 'のブレイクが解けた（気力全回復' + (u.hero ? '' : '・次のターン2回行動') + '）', { target: u.id, recover: true }, 700); }
    });
    if (enemies.every(function (e) { return e.hp === 0; })) self.outcome = 'win';
    else if (heroes.every(function (u) { return u.hp === 0; })) self.outcome = 'lose';
    return self.events;
  };

  this.nextEnemyDouble = function (e) { return !!e.released; };
};
