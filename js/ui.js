// 画面と操作（見やすさ版）。
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var ROLE = ['前衛', '中衛', '後衛'];
  var pick = { enc: 'normal', kit: 'standard', tune: 'tense' };
  var B = null, turnSave = null;
  // 状態：idle / menu / list / target / swap1 / swap2 / play / result
  var st = { mode: 'title', actor: null, list: null, skill: null, swapOut: null };
  var cmds = {};

  // ================= タイトル =================
  function kitNote(k) {
    return { standard: 'ナハトは崩し斬り・かばう・断ち込み。連携と回復のバランス型',
      counter: 'ナハトは誘い斬りで引きつけ、リベンジの反撃で崩す',
      chase: 'ナハトの追撃を1ターン2回まで。連撃で気力を削って追撃',
      custom: '5人のスキルを自分で選ぶ（装備コスト24まで）' }[k];
  }

  // ================= スキル編成 =================
  var lo = { who: 'N', set: null };
  function drawLoadout() {
    var box = $('loadout');
    if (pick.kit !== 'custom') { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    if (!lo.set) lo.set = SR.loadout.load() || SR.loadout.fromKit('standard');
    var L = SR.loadout, cap = L.cap(), set = lo.set, id = lo.who, mine = set[id], useAp = L.used(mine);
    var h = '<div class="lo-tabs">';
    L.ids.forEach(function (c) {
      h += '<button class="btn' + (c === id ? ' sel' : '') + '" data-nav data-lo="who" data-id="' + c + '">' + SR.names[c] +
        '<small>' + L.used(set[c]) + '/' + cap + '</small></button>';
    });
    h += '</div>';
    h += '<div class="lo-head"><b>' + SR.names[id] + 'の装備</b>　装備コスト <b>' + useAp + '</b> / ' + cap +
      '<div class="bar k" style="height:10px"><i style="width:' + (useAp / cap * 100) + '%"></i></div></div>';
    h += '<div class="lo-eq">' + (mine.length ? mine.map(function (s) {
      return '<button class="btn" data-nav data-lo="del" data-id="' + s + '">' + s + ' <small>' + L.apOf(s) + '</small> ×</button>';
    }).join('') : '<span class="small">まだ何も装備していない（ブレイブ攻撃・防御はいつでも使える）</span>') + '</div>';
    var p = L.pool(id);
    function item(s, passive) {
      var on = mine.indexOf(s) >= 0, ap = L.apOf(s), over = !on && useAp + ap > cap;
      var desc = passive ? SR.passives[s][2] : SR.describe(SR.skills[s]);
      var a = SR.skills[s], tags = a ? SR.typeBadge(s) : '';
      if (a && a.brave) tags += '<span class="badge b-brk">ブレイク可</span>';
      if (a && a.form) tags += '<span class="badge b-form">→' + SR.formNames[a.form] + '</span>';
      if (a && a.era > 1) tags += '<span class="badge b-charge">' + (a.era === 3 ? '終盤' : '中盤') + 'の技</span>';
      return '<button class="sk' + (on ? ' on' : '') + (a ? catClass(s) : ' t-pas') + '" data-nav data-lo="tog" data-id="' + s + '"' + (over ? ' disabled' : '') + '>' +
        '<b>' + s + '</b><span class="c">' + (on ? '装備中・' : '') + 'コスト' + ap + (a ? '／精神力' + a.cost : '') + '</span>' +
        (tags ? '<div>' + tags + '</div>' : '') + (a ? stLine(a, !!SR.tunes[pick.tune].status) : '') + '<span class="d">' + desc + '</span></button>';
    }
    var order = function (a, b) { return ['skillAtk', 'skillDef', 'skillSup'].indexOf(SR.category(a)) - ['skillAtk', 'skillDef', 'skillSup'].indexOf(SR.category(b)); };
    var uni = p.act.filter(function (s) { return !SR.isCommon(s); }).sort(order);
    var com = p.act.filter(function (s) { return SR.isCommon(s); }).sort(order);
    h += '<div class="grp">ユニーク（' + SR.names[id] + 'だけの技）</div><div class="list">' + uni.map(function (s) { return item(s, false); }).join('') + '</div>';
    if (com.length) h += '<div class="grp">コモン（みんなが使える技）</div><div class="list">' + com.map(function (s) { return item(s, false); }).join('') + '</div>';
    else if (id === 'N') h += '<div class="grp">コモン</div><div class="small">ナハトはコモンを使わない。この枠には、のちに「リンク」が入る予定。</div>';
    if (p.pas.length) h += '<div class="grp">パッシブ（常に効く）</div><div class="list">' + p.pas.map(function (s) { return item(s, true); }).join('') + '</div>';
    h += '<div class="row"><span class="small">元にする：</span>' + ['standard', 'counter', 'chase'].map(function (k) {
      return '<button class="btn" data-nav data-lo="tpl" data-id="' + k + '">' + SR.kits[k].name + '</button>';
    }).join('') + '<span class="small">選んだ内容は自動で保存されます</span></div>';
    box.innerHTML = h;
  }
  $('loadout').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-lo]'); if (!b || b.disabled) return;
    var act = b.getAttribute('data-lo'), id = b.getAttribute('data-id'), mine = lo.set[lo.who];
    if (act === 'who') lo.who = id;
    else if (act === 'del') mine.splice(mine.indexOf(id), 1);
    else if (act === 'tog') {
      var i = mine.indexOf(id);
      if (i >= 0) mine.splice(i, 1);
      else if (SR.loadout.used(mine) + SR.loadout.apOf(id) <= SR.loadout.cap()) mine.push(id);
    } else if (act === 'tpl') lo.set = SR.loadout.fromKit(id);
    SR.loadout.save(lo.set); SR.loadout.apply(lo.set);
    var keep = nav.idx; drawLoadout(); nav.idx = keep; nav.paint();
  });
  var DIFF = { normal: 1, swarm: 1, shellSwift: 2, casters: 2, elements: 2, boss: 3, fireResist: 4, aoe: 5, twins: 5 };
  function choiceButtons(box, list, key) {
    box.innerHTML = '';
    Object.keys(list).forEach(function (k) {
      var b = document.createElement('button');
      b.className = 'btn choice' + (pick[key] === k ? ' sel' : '');
      b.setAttribute('data-nav', '');
      b.innerHTML = '<b>' + list[k].name + '</b><span class="small">' + (key === 'kit' ? kitNote(k) : (list[k].era ? '【' + ['', '序盤', '中盤', '終盤'][list[k].era] + '】' : '') + list[k].note) + '</span>';
      if (key === 'enc') {
        var e = list[k], t0 = e.party && SR.enemyTypes[e.party[0]], img = e.img || (e.imgs && e.imgs[0]) || (e.config && e.config.img) || (t0 && t0.img);
        var d = DIFF[k] || 0, pips = '', best = 0;
        for (var i = 0; i < 5; i++) pips += '<i class="' + (i < d ? 'on' : '') + '"></i>';
        try { best = (JSON.parse(localStorage.getItem('sr-battle-best-v1')) || {})[e.name] || 0; } catch (x) {}
        b.className += ' enc';
        b.innerHTML = (img ? '<img class="th" src="img/enemies/' + img + '.png" alt="">' : '<span class="th">？</span>') +
          '<span class="tx"><b>' + e.name + '</b><span class="meta">' + (e.era ? '<span class="badge b-form">' + ['', '序盤', '中盤', '終盤'][e.era] + '</span>' : '') +
          (d ? '<span>難しさ<span class="dp">' + pips + '</span></span>' : '') + (best ? '<span class="bestd">自己ベスト ' + best.toLocaleString() + '</span>' : '') +
          '</span><span class="small">' + e.note + '</span></span>';
      }
      b.onclick = function () { pick[key] = k; drawTitle(); };
      box.appendChild(b);
    });
  }
  function drawTitle() {
    choiceButtons($('encChoices'), SR.encounters, 'enc');
    choiceButtons($('kitChoices'), SR.kits, 'kit');
    choiceButtons($('tuneChoices'), SR.tunes, 'tune');
    drawLoadout();
    nav.refresh();
  }
  $('startBtn').onclick = start;

  function start() {
    var encKey = pick.enc;
    if (encKey === 'random') { var keys = Object.keys(SR.encounters).filter(function (k) { return !SR.encounters[k].random; }); encKey = keys[Math.floor(Math.random() * keys.length)]; }
    B = new SR.Battle({ kit: pick.kit, encounter: encKey, tune: pick.tune, seed: (Date.now() & 0xffffffff) >>> 0 });
    $('title').classList.add('hidden'); $('battle').classList.remove('hidden');
    $('log').innerHTML = ''; lastCmds = null; prevBar = {};
    logLine(SR.encounters[encKey].name + '／' + SR.kits[pick.kit].name + '構成／' + SR.tunes[pick.tune].name, 's');
    SR.sound.playBgm(B.isBoss || SR.encounters[encKey].bgm === 'boss' ? 'boss' : 'normal');
    newTurn();
  }
  // 音のオン・オフ（タイトルと戦闘画面の両方）
  function drawSnd() {
    var s = SR.sound.state();
    document.querySelectorAll('[data-snd]').forEach(function (b) {
      var k = b.getAttribute('data-snd');
      b.textContent = (k === 'bgm' ? 'BGM ' : '効果音 ') + (s[k] ? 'オン' : 'オフ');
      b.classList.toggle('off', !s[k]);
    });
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-snd]'); if (!b) return;
    SR.sound.toggle(b.getAttribute('data-snd')); drawSnd();
  });
  drawSnd();
  // 全画面（できる端末では横向きに固定）。iPhone は全画面にできないのでボタンを隠す。
  (function () {
    var de = document.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen;
    var btns = document.querySelectorAll('[data-fs]');
    function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement; }
    function drawFs() { btns.forEach(function (b) { b.textContent = fsEl() ? '全画面をやめる' : '全画面'; }); }
    if (!req) { btns.forEach(function (b) { b.style.display = 'none'; }); return; }
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('[data-fs]')) return;
      if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      try {
        var p = req.call(de);
        var lock = function () { try { var q = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (q && q.catch) q.catch(function () {}); } catch (e) {} };
        if (p && p.then) p.then(lock).catch(function () {}); else lock();
      } catch (e) {}
    });
    document.addEventListener('fullscreenchange', drawFs); document.addEventListener('webkitfullscreenchange', drawFs);
  })();
  $('logBtn').onclick = function () { $('battle').setAttribute('data-log', getComputedStyle($('log')).display !== 'none' ? 'shut' : 'open'); };
  $('log').onclick = function () { if (getComputedStyle($('log')).position === 'absolute') $('battle').setAttribute('data-log', 'shut'); };

  // ================= 絵 =================
  // 敵の絵：ぴぽやのポップモンスター素材（img/enemies）。ない場合は仮の絵。
  function beastSVG(e) {
    if (e.img) return '<img class="mon" src="img/enemies/' + e.img + '.png" alt="">';
    return beastFallback(e);
  }
  function beastFallback(e) {
    var col = e.color || (e.fire < 1 ? '#5fb7c9' : e.fire > 1 ? '#d9774a' : '#8b6cd9');
    var glow = e.glow || (e.fire < 1 ? '#c8fbff' : '#ffe08a');
    return '<svg viewBox="0 0 300 170" aria-hidden="true">' +
      '<defs><radialGradient id="g' + e.id + '" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="' + col + '"/><stop offset="1" stop-color="#1a1430"/></radialGradient></defs>' +
      '<ellipse cx="150" cy="160" rx="110" ry="8" fill="#0008"/>' +
      '<path d="M60 150 C40 110 60 70 105 62 C120 40 180 40 196 62 C240 70 262 110 240 150 Z" fill="url(#g' + e.id + ')" stroke="#0007" stroke-width="3"/>' +
      '<path d="M112 64 L96 18 L130 55 Z M188 64 L204 18 L170 55 Z" fill="' + col + '" stroke="#0007" stroke-width="3"/>' +
      '<path d="M70 150 l10 -22 l10 22 M210 150 l10 -22 l10 22" stroke="#0007" stroke-width="5" fill="none"/>' +
      '<ellipse cx="128" cy="92" rx="11" ry="7" fill="' + glow + '"/><ellipse cx="172" cy="92" rx="11" ry="7" fill="' + glow + '"/>' +
      '<circle cx="128" cy="92" r="3" fill="#1a1430"/><circle cx="172" cy="92" r="3" fill="#1a1430"/>' +
      '<path d="M130 120 Q150 132 170 120" stroke="#0009" stroke-width="4" fill="none"/>' +
      '<path d="M150 40 l6 14 l15 2 l-11 10 l3 15 l-13 -8 l-13 8 l3 -15 l-11 -10 l15 -2 Z" fill="' + glow + '" opacity=".55"/>' +
      '</svg>';
  }

  // ================= 盤面の描画 =================
  function val(u, snap) { return snap && snap[u.id] ? snap[u.id] : { hp: u.hp, maxHp: u.maxHp, mp: u.mp, k: u.k, brk: B.broken(u), form: u.form, st: u.st, bp: u.bp || 0 }; }
  function stIcons(st) { var h = ''; if (!B.statusOn || !st) return h; SR.statusOrder.forEach(function (s) { if (st[s] > 0) h += SR.statusIcon(s, st[s]); }); return h; }
  function weakTag(e) {
    if (!B.statusOn || !e.weak) return '';
    return B.weakKnown(e) ? '<span class="badge b-weak" title="' + SR.statuses[e.weak].name + 'で崩れやすい">弱点' + SR.statusIcon(e.weak) + '</span>' : '<span class="badge b-weak unk">弱点？</span>';
  }
  function stLine(a, on) { if (on === undefined) on = B && B.statusOn; if (!on) return ''; var h = ''; if (a.inflict) h += '<span class="stline">' + SR.statusIcon(a.inflict[0], a.inflict[1]) + SR.statuses[a.inflict[0]].name + '+' + a.inflict[1] + 'ターン</span>'; if (a.exploit) h += '<span class="stline ex">' + SR.statusIcon(a.exploit[0]) + SR.statuses[a.exploit[0]].name + '中に' + a.exploit[1] + '倍' + '</span>'; return h ? '<div class="stl">' + h + '</div>' : ''; }
  function catClass(id) { var c = SR.category(id); return c === 'skillAtk' || c === 'brave' ? ' t-atk' : c === 'skillDef' || c === 'defend' || c === 'guard' ? ' t-def' : c === 'skillSup' ? ' t-sup' : ''; }
  function pct(a, b) { return Math.max(0, Math.min(100, a / b * 100)); }
  function hpColor(r) { return r > .5 ? 'var(--hp)' : r > .25 ? 'var(--hpLow)' : 'var(--hpCrit)'; }
  // 減った分は白く残って、少し遅れて消える
  var prevBar = {};
  function ghost(key, now, max) {
    var p = prevBar[key], t = Date.now(), from = !p ? now : (p.gT && t - p.gT < 800 ? Math.max(p.g, p.v) : p.v);
    prevBar[key] = { v: now, g: from, gT: p && now < p.v ? t : (p ? p.gT : 0) };
    return from > now ? '<b class="ghost" data-to="' + pct(now, max) + '" style="width:' + pct(from, max) + '%"></b>' : '';
  }
  function bars(u, v) {
    // ブレイクで削れた最大体力は、バーの右端に斜線で残す
    var mh = v.maxHp || u.maxHp, base = u.baseMaxHp || mh, mp = v.mp === undefined ? u.mp : v.mp;
    var cut = base - mh >= 1 ? '<s class="cut" style="width:' + pct(base - mh, base) + '%"></s>' : '';
    return '<div class="bar">' + ghost(u.id + 'h', v.hp, base) + '<i style="width:' + pct(v.hp, base) + '%;background:' + hpColor(v.hp / mh) + '"></i>' + cut + '</div>' +
      '<div class="bar k">' + ghost(u.id + 'k', v.k, u.maxK) + '<i style="width:' + pct(v.k, u.maxK) + '%"></i></div>' +
      (u.hero ? '<div class="bar m">' + ghost(u.id + 'm', mp, u.maxMp) + '<i style="width:' + pct(mp, u.maxMp) + '%"></i></div>' : '') +
      '<div class="nums"><span class="nh"><em>体力 </em>' + Math.round(v.hp) + (cut ? '<small>/' + Math.round(mh) + '</small>' : '') + '</span><span class="nk"><em>気力 </em>' + Math.round(v.k) + '</span>' +
      (u.hero ? '<span class="nmp"><em>精神 </em>' + Math.round(mp) + '</span>' : '') + '</div>';
  }
  function pickableIds() {
    if (st.mode === 'idle' || st.mode === 'menu' || st.mode === 'list') return B.actors().map(function (u) { return u.id; });
    if (st.mode === 'target') return targetCands().map(function (u) { return u.id; });
    if (st.mode === 'swap1') return swapOutCands().map(function (u) { return u.id; });
    if (st.mode === 'swap2') return swapInCands().map(function (u) { return u.id; });
    return [];
  }
  function onUnitClick(id) {
    if (st.mode === 'target') return chooseTarget(id);
    if (st.mode === 'swap1') { st.swapOut = id; st.mode = 'swap2'; return draw(); }
    if (st.mode === 'swap2') return doSwap(id);
    if (st.mode === 'idle' || st.mode === 'menu' || st.mode === 'list') return openMenu(B.unit(id));
  }

  function renderField(snap) {
    // 上の行：ターンと予告
    var tl = '<span class="turn">' + B.t + 'ターン目</span>';
    if (!B.outcome) {
      if (B.aoe) tl += '<span class="chip warn">敵の全体攻撃</span>';
      B.enemies.forEach(function (e) {
        if (e.hp <= 0) return;
        if (e.charge === 1) tl += '<span class="chip warn">' + e.name + '：溜め中（次のターン大技）</span>';
        if (e.charge === 2) tl += '<span class="chip warn hot">' + e.name + '：大技が来る！</span>';
        if (e.released) tl += '<span class="chip warn">' + e.name + '：2回行動</span>';
      });
    }
    $('topline').innerHTML = tl;
    var can = pickableIds();
    var showOrder = !snap && ["idle", "menu", "list", "target", "swap1", "swap2"].indexOf(st.mode) >= 0;
    var ord = showOrder ? B.previewOrder(cmds) : (st.mode === "play" && playOrder ? playOrder : []), ordNo = {};
    ord.forEach(function (o, i) { (ordNo[o.id] = ordNo[o.id] || []).push(i + 1); });
    renderOrder(ord);
    function addOrd() {}

    SR.fx.mood(B.enemies.some(function (e) { var v = val(e, snap); return v.brk && v.hp > 0; }),
      B.outcome ? 0 : playMood !== null ? playMood : B.enemies.reduce(function (m, e) { return e.hp > 0 && !B.broken(e) ? Math.max(m, e.charge || 0) : m; }, 0));
    var ea = $('enemyArea'); ea.innerHTML = '';
    B.enemies.forEach(function (e) {
      var v = val(e, snap), d = document.createElement('div');
      d.className = 'unit enemy' + (B.isBoss ? ' boss' : '') + (B.enemies.length > 3 ? ' many' : '') + (v.hp <= 0 ? ' down' : '') + (v.brk ? ' brk' : '') +
        (e.charge && !v.brk && v.hp > 0 ? ' charging' : '');
      d.id = 'u-' + e.id;
      var tags = '';
      if (v.brk) tags += '<span class="badge b-brk">ブレイク</span>';
      if (e.charge === 1 && !v.brk) tags += '<span class="badge b-charge">溜め</span>';
      if (e.charge === 2 && !v.brk) tags += '<span class="badge b-charge hot">大技</span>';
      if (e.fire < 1) tags += '<span class="badge b-fire">炎に強い</span>';
      if (e.fire > 1) tags += '<span class="badge b-fire">炎に弱い</span>';
      if (e.pressure >= B.t) tags += '<span class="badge b-buff">重圧</span>';
      (e.tags || []).forEach(function (tg) { tags += '<span class="badge b-form">' + tg + '</span>'; });
      tags += weakTag(e);
      var sti = stIcons(v.st);
      d.innerHTML = beastSVG(e) + '<div class="nm">' + e.name + '</div>' + (sti ? '<div class="sts">' + sti + '</div>' : '') + '<div>' + tags + '</div>' + bars(e, v);
      if (can.indexOf(e.id) >= 0) { d.classList.add('pickable'); d.onclick = function () { onUnitClick(e.id); }; }
      addOrd(d, e.id); ea.appendChild(d);
    });

    var pa = $('partyArea'), ra = $('reserveArea');
    pa.innerHTML = ''; ra.innerHTML = '<div class="lbl">控え（支援' + (B.tune.reserveRegen ? '・回復' : '') + '）</div>';
    B.heroes.slice().sort(function (a, b) { return a.pos - b.pos; }).forEach(function (u) {
      var v = val(u, snap), res = u.pos >= 3, d = document.createElement('div');
      d.className = 'unit ' + (res ? 'reserve' : 'hero') + (v.hp <= 0 ? ' down' : '') + (v.brk ? ' brk' : '');
      d.id = 'u-' + u.id;
      if (!res) d.setAttribute('data-pos', u.pos);
      var tags = '';
      if (u.id === 'N') tags += '<span class="badge b-form">' + SR.formNames[v.form] + '</span>';
      if (u.exposed >= B.t) tags += '<span class="badge b-charge">無防備</span>';
      if (u.exhausted >= B.t) tags += '<span class="badge b-charge">燃え尽き</span>';
      if (u.ward >= B.t) tags += '<span class="badge b-buff">守りの祈り</span>';
      if (v.brk) tags += '<span class="badge b-brk">ブレイク</span>';
      if (u.aim > 0) tags += '<span class="badge b-buff">照準</span>';
      if (u.kProtect >= B.t) tags += '<span class="badge b-buff">気力防護</span>';
      if (u.protect >= B.t) tags += '<span class="badge b-buff">防護</span>';
      if (u.defend === B.t) tags += '<span class="badge b-buff">防御</span>';
      tags += stIcons(v.st);
      if (B.boostCfg) tags += bpPips(v.bp !== undefined ? v.bp : u.bp, !snap && cmds[u.id] ? cmds[u.id].boost || 0 : 0);
      var role = '<span class="role r' + (res ? 3 : u.pos) + '">' + (res ? '控え' : ROLE[u.pos]) + '</span>';
      var cmdLine = '';
      if (!res && !snap && st.mode !== 'result') {
        var c = cmds[u.id];
        if (B.broken(u) || u.hp <= 0) cmdLine = '<div class="cmd todo">動けない</div>';
        else cmdLine = c ? '<div class="cmd done">' + cmdText(u, c) + '</div>' : '<div class="cmd todo">未入力</div>';
      }
      if (res) {
        d.innerHTML = '<div class="pic"><img class="st" src="img/' + SR.img[u.id] + '_stand.png" alt=""><img class="fc" src="img/' + SR.img[u.id] + '_serious.jpg" alt=""></div><div>' +
          '<div class="nm">' + role + u.name + '</div>' + tags + bars(u, v) + '</div>';
        addOrd(d, u.id); ra.appendChild(d);
      } else {
        d.innerHTML = '<div class="pic"><img class="st" src="img/' + SR.img[u.id] + '_stand.png" alt=""><img class="fc" src="img/' + SR.img[u.id] + '_serious.jpg" alt=""></div>' +
          '<div class="nm">' + role + u.name + '</div><div>' + tags + '</div>' + bars(u, v) + cmdLine;
        addOrd(d, u.id); pa.appendChild(d);
      }
      if (st.actor === u && (st.mode === 'menu' || st.mode === 'list' || st.mode === 'target')) d.classList.add('active');
      if (can.indexOf(u.id) >= 0 && !(st.mode !== 'target' && st.mode.indexOf('swap') < 0 && st.actor === u)) {
        d.classList.add('pickable'); d.onclick = function () { onUnitClick(u.id); };
      }
    });
    requestAnimationFrame(function () { document.querySelectorAll('#field .ghost').forEach(function (g) { g.style.width = g.getAttribute('data-to') + '%'; }); });
  }

  function cmdText(u, c) {
    var a = SR.skills[c.skill];
    var t = c.target ? B.unit(c.target) : null;
    return (a.label || a.id) + (c.boost ? '＋ブースト' + c.boost : '') + (t && B.targetKind(u, c.skill) !== 'none' ? ' → ' + t.name : '');
  }

  // ================= 行動順の帯 =================
  function renderOrder(ord) {
    var box = $('order');
    if (!ord.length) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    var curId = st.mode === 'play' ? playActor : (st.actor ? st.actor.id : null);
    box.innerHTML = '<span class="ol">はやい</span><div class="otrack">' + ord.map(function (o) {
      var icon, tag = '', tcls = 'ot';
      if (o.kind === 'enemy') {
        var e = B.unit(o.id);
        icon = beastSVG(e);
        tag = B.isBoss ? 'ボス' : e.name.replace('敵', '');
        if (o.label === '大技') { tag += ' 大技'; tcls += ' hot'; }
        else if (o.label === '溜め') { tag += ' 溜め'; tcls += ' warm'; }
        else if (o.label === '全体攻撃') tag += ' 全体';
      } else {
        icon = '<img src="img/' + SR.img[o.id] + '_serious.jpg" alt="">';
        tag = o.kind === 'support' ? '支援' : '';
      }
      var title = o.name + '：' + o.label;
      return '<div class="oc o-' + o.kind + (o.kind === 'enemy' && o.label === '大技' ? ' hotc' : o.kind === 'enemy' && o.label === '溜め' ? ' warmc' : '') + (o.todo ? ' todo' : '') + (curId === o.id ? ' cur' : '') + '" title="' + title + '">' +
        '<div class="oi">' + icon + '</div>' + (tag ? '<span class="' + tcls + '">' + tag + '</span>' : '') + '</div>';
    }).join('') + '</div><span class="ol slow">おそい</span>';
  }
  var playOrder = null, playActor = null;

  // ================= ログ =================
  function logLine(text, cls) {
    var d = document.createElement('div'); d.className = cls || ''; d.textContent = text;
    var lg = $('log'); lg.appendChild(d); lg.scrollTop = lg.scrollHeight;
  }

  // ================= ターン =================
  function newTurn() {
    B.beginTurn(); B.planSupports(); cmds = {};
    turnSave = snapshotAll();
    logLine('― ' + B.t + 'ターン目 ―', 't');
    B.enemies.forEach(function (e) {
      if (e.hp > 0 && e.charge === 2) logLine(e.name + 'の大技がこのターンに来る', 'e');
    });
    var first = B.actors()[0];
    if (first) openMenu(first); else { st.mode = 'idle'; st.actor = null; draw(); }
  }

  // ================= 候補 =================
  function targetCands() {
    var u = st.actor, tk = B.targetKind(u, st.skill);
    if (tk === 'enemy') return B.living();
    if (tk === 'allyDown') return B.downFront();
    return B.front().filter(function (v) { return v.hp > 0 && (tk !== 'allyOther' || v !== u); });
  }
  function byPos(a, b) { return a.pos - b.pos; }
  function swapOutCands() {
    return B.heroes.filter(function (u) { return B.heroes.some(function (v) { return B.canSwap(u.id, v.id); }); }).sort(byPos);
  }
  function swapInCands() { return B.heroes.filter(function (v) { return B.canSwap(st.swapOut, v.id); }).sort(byPos); }

  // ================= パネル =================
  function draw(snap) {
    renderField(snap);
    var p = $('panel'), h = '';
    var m = st.mode;
    if (m === 'idle') h = idleHTML();
    else if (m === 'menu') h = menuHTML();
    else if (m === 'list') h = listHTML();
    else if (m === 'target') h = targetHTML();
    else if (m === 'swap1' || m === 'swap2') h = swapHTML();
    else if (m === 'play') h = '<h3>行動中…</h3><div class="row"><button class="btn" data-nav data-act="fast">早送り</button></div>';
    else if (m === 'result') h = resultHTML();
    p.innerHTML = h;
    nav.refresh();
  }
  function supportLine() { return B.supportPlan && B.supportPlan.length ? '<div class="plan">' + B.supportPlan.join('　/　') + '</div>' : ''; }
  function commonButtons() {
    var s = B.swapped
      ? '<button class="btn" data-nav data-act="unswap">' + (B.swapped.front ? '並べ替え' : '交代') + 'を取り消す</button>'
      : '<button class="btn" data-nav data-act="swap"' + (swapOutCands().length ? '' : ' disabled') + '>交代<span class="lg">・並べ替え</span></button>';
    var left = B.actors().filter(function (u) { return !cmds[u.id]; }).length;
    return '<div class="row">' + s +
      (lastCmds ? '<button class="btn" data-nav data-act="repeat">前と同じ</button>' : '') +
      '<button class="btn" data-nav data-act="autoAll">全員おまかせ</button>' +
      '<button class="btn primary go" data-nav' + (left ? '' : ' data-first') + ' data-act="go">行動開始' + (left ? '<span class="lg">（未入力' + left + '人はブレイブ攻撃）</span><span class="sh">（未入力' + left + '）</span>' : '') + '</button></div>';
  }
  // 右側だけで人を切り替える札
  function actorTabs() {
    var h = '<div class="atabs">';
    B.actors().forEach(function (u) {
      var c = cmds[u.id], on = u === st.actor;
      h += '<button class="atab' + (on ? ' on' : '') + (c ? ' done' : '') + '" data-nav data-act="actor" data-id="' + u.id + '"><img src="img/' + SR.img[u.id] + '_serious.jpg" alt="">' +
        '<span><b>' + u.name + '</b><small>' + (on ? '精神力 ' + Math.round(u.mp) : c ? cmdText(u, c) : '未入力') + '</small></span></button>';
    });
    return h + '</div>';
  }
  // 気力がこの値以下になると、このターンのうちにブレイクされやすい
  function riskK() { return B.isBoss ? 40 : 15; }
  function costOf(u, id) { var o = B.options(u).find(function (x) { return x.id === id; }); return o ? o.cost || 0 : 0; }
  function warnHTML() {
    var w = [], acts = B.actors();
    if (B.enemies.some(function (e) { return e.hp > 0 && e.charge === 2 && !B.broken(e); })) {
      var nd = acts.filter(function (u) { return cmds[u.id] && cmds[u.id].skill !== 'defend'; });
      w.push('大技が来る！ ' + (nd.length ? nd.map(function (u) { return u.name; }).join('・') + 'は防御していない' : '防御するか、ブレイクさせて止める'));
    }
    acts.forEach(function (u) {
      var c = cmds[u.id]; if (!c || c.skill === 'defend') return;
      var left = u.k;
      if (left <= riskK()) w.push(u.name + 'は気力が残り' + Math.max(0, Math.round(left)) + '（ブレイクの危険。防御か交代を）');
    });
    return w.length ? '<div class="warnbox">' + w.map(function (x) { return '<div>' + x + '</div>'; }).join('') + '</div>' : '';
  }
  var lastCmds = null;
  function repeatLast() {
    B.actors().forEach(function (u) {
      var c = lastCmds[u.id]; if (!c || !B.available(u, c.skill)) return;
      var tg = c.target;
      if (B.targetKind(u, c.skill) !== 'none') {
        st.actor = u; st.skill = c.skill;
        var cands = targetCands(); if (!cands.length) return;
        if (!cands.some(function (v) { return v.id === tg; })) tg = cands[0].id;
      }
      cmds[u.id] = { skill: c.skill, target: tg, boost: B.boostable(c.skill) ? Math.min(c.boost || 0, u.bp) : 0 };
    });
    st.mode = 'idle'; st.actor = null; st.skill = null; draw();
  }
  function idleHTML() {
    var h = '<div class="phead"><h3>コマンドを入れる人を選ぶ</h3>' + commonButtons() + '</div>' + warnHTML() + '<div class="who">';
    var firstTodo = B.actors().find(function (u) { return !cmds[u.id]; });
    B.actors().forEach(function (u) {
      var c = cmds[u.id];
      h += '<button class="btn" data-nav' + (u === firstTodo ? ' data-first' : '') + ' data-act="actor" data-id="' + u.id + '"><span><span class="role r' + u.pos + '">' + ROLE[u.pos] + '</span>' + u.name + '</span>' +
        '<small>' + (c ? cmdText(u, c) : '未入力') + '</small></button>';
    });
    if (!B.actors().length) h += '<div class="small">前線で動ける人がいない。交代するか、そのまま行動開始。</div>';
    return h + '</div>' + supportLine();
  }
  function menuHTML() {
    var u = st.actor, opts = B.options(u);
    var brave = opts.find(function (o) { return o.id === 'basic'; });
    var nSkill = opts.filter(function (o) { return SR.isSkill(o.id); }).length;
    var defend = opts.find(function (o) { return o.id === 'defend'; });
    var scan = opts.find(function (o) { return o.id === 'scan'; });
    var h = actorTabs() + '<div class="phead">' + commonButtons() + '</div>' + warnHTML();
    h += boostRow(u);
    h += '<div class="menu4">' +
      '<button class="big t-atk" data-nav data-first data-act="skill" data-id="basic"' + (brave.ok ? '' : ' disabled') + '>ブレイブ攻撃<span class="c">' + (brave.cost ? '精神力' + brave.cost : '消費なし') + '</span><span class="d">気力を0にすればブレイク</span></button>' +
      '<button class="big" data-nav data-act="list" data-id="skill"' + (nSkill ? '' : ' disabled') + '>スキル<span class="c">' + nSkill + '</span><span class="d">ユニーク' + (u.id === 'N' ? '' : '・コモン') + '</span></button>' +
      '<button class="big t-def" data-nav data-act="skill" data-id="defend"' + (defend.ok ? '' : ' disabled') + '>防御<span class="c">消費なし</span><span class="d">このターン受けるダメージ半分</span></button>' +
      (scan ? '<button class="big" data-nav data-act="skill" data-id="scan"' + (scan.ok ? '' : ' disabled') + '>調べる<span class="c">' + (scan.cost ? '精神力' + scan.cost : '消費なし') + '</span><span class="d">敵の弱点が分かる</span></button>' : '') +
      '</div>';
    var pas = B.passivesOf(u);
    if (pas.length) h += '<div class="hint">常時：' + pas.map(function (s) { return s + '（' + SR.passives[s][2] + '）'; }).join('　') + '</div>';
    h += '<div class="row"><button class="btn" data-nav data-act="auto">おまかせ</button><button class="btn" data-nav data-back data-act="toIdle">一覧へ戻る</button></div>';
    return h;
  }
  // ブースト：たまっている数（最大2）から、この行動で使う数を選ぶ。威力だけ上がり、回数は同じ。
  function bpPips(n, use) {
    var max = B.boostCfg ? B.boostCfg.max : 0, h = '';
    for (var i = 0; i < max; i++) h += '<i class="' + (i < n - (use || 0) ? 'on' : i < n ? 'use' : '') + '"></i>';
    return '<span class="bp" title="ブースト ' + n + '">' + h + '</span>';
  }
  function boostRow(u) {
    if (!B.boostCfg) return '';
    var h = '<div class="boostrow"><span class="bl">ブースト ' + bpPips(u.bp, st.boost) + '</span>';
    [0, 1, 2].forEach(function (n) {
      var lab = n === 0 ? 'なし' : String(n);
      h += '<button class="btn bbtn' + (st.boost === n ? ' on' : '') + '" data-nav data-act="boost" data-id="' + n + '"' + (n > u.bp ? ' disabled' : '') + '>' + lab + '</button>';
    });
    return h + '<span class="small">' + boostHelp() + '</span></div>';
  }
  function boostHelp() { var m = B.boostCfg.mult; return 'ブレイブ攻撃は回数+1・+2。技は威力×' + m[1] + '・×' + m[2] + '（攻撃・回復・蘇生）'; }
  function boostNote() {
    return B.boostCfg && st.boost ? '　<span class="bnote">ブースト' + st.boost + '</span>' : '';
  }
  function skillButton(o) {
    var a = o.skill, h = '<button class="sk' + catClass(o.id) + '" data-nav data-act="skill" data-id="' + o.id + '"' + (o.ok ? '' : ' disabled') + '>';
    h += '<b>' + (a.label || a.id) + '</b><span class="c">' + (o.cost ? '精神力' + o.cost : '消費なし') + '</span>';
    var tags = SR.typeBadge(o.id), foes = B.living();
    if (B.statusOn && a.inflict && foes.some(function (e) { return e.weak === a.inflict[0] && B.weakKnown(e); })) tags = '<span class="badge b-hit">弱点を突ける</span>' + tags;
    if (B.statusOn && a.exploit && foes.some(function (e) { return e.st && e.st[a.exploit[0]] > 0; })) tags = '<span class="badge b-hit">今が狙い目</span>' + tags;
    if (a.brave) tags += '<span class="badge b-brk">ブレイク可</span>';
    if (a.all) tags += '<span class="badge b-form">全体</span>';
    if (a.hits) tags += '<span class="badge b-form">' + a.hits + '連撃</span>';
    if (a.fire) tags += '<span class="badge b-fire">炎</span>';
    if (a.form) tags += '<span class="badge b-form">→' + SR.formNames[a.form] + '</span>';
    if (tags) h += '<div>' + tags + '</div>';
    h += stLine(a);
    if (a.kind === 'attack') {
      var hits = a.hits || 1;
      h += '<div class="meter"><span>崩す力</span><div class="m"><i style="width:' + Math.min(100, a.kd * hits / 70 * 100) + '%;background:var(--k)"></i></div></div>' +
        '<div class="meter"><span>威力</span><div class="m"><i style="width:' + Math.min(100, a.hp * hits / 132 * 100) + '%;background:var(--pow)"></i></div></div>';
    }
    h += '<span class="d">' + SR.describe(a) + '</span></button>';
    return h;
  }
  function listHTML() {
    var u = st.actor, opts = B.options(u), h;
    h = actorTabs() + '<div class="row" style="margin-top:0"><button class="btn" data-nav data-act="toMenu">戻る</button></div>' + boostRow(u) +
      '<div class="catlegend"><span><i style="background:var(--catAtk)"></i>攻撃</span><span><i style="background:var(--catDef)"></i>守備</span><span><i style="background:var(--catSup)"></i>回復・補助</span></div>';
    var rank = function (o) { return ['skillAtk', 'skillDef', 'skillSup'].indexOf(SR.category(o.id)); };
    var sk = opts.filter(function (o) { return SR.isSkill(o.id); }).sort(function (a, b) { return rank(a) - rank(b); });
    var uni = sk.filter(function (o) { return !SR.isCommon(o.id); }), com = sk.filter(function (o) { return SR.isCommon(o.id); });
    if (uni.length) h += '<div class="grp">ユニーク</div><div class="list">' + uni.map(skillButton).join('') + '</div>';
    if (com.length) h += '<div class="grp">コモン</div><div class="list">' + com.map(skillButton).join('') + '</div>';
    if (!sk.length) h += '<div class="small">スキルを装備していない。</div>';
    return h + '<div class="row"><button class="btn" data-nav data-back data-act="toMenu">戻る</button></div>';
  }
  function targetHTML() {
    var u = st.actor, a = SR.skills[st.skill], tk = B.targetKind(u, st.skill);
    var h = '<h3>' + u.name + '：' + (a.label || a.id) + '　' + (tk === 'enemy' ? '相手を選ぶ' : '仲間を選ぶ') + '</h3>' + (B.boostable(st.skill) ? boostRow(u) : '') + '<div class="who">';
    targetCands().forEach(function (v) {
      var extra = v.hero ? '' : (v.charge === 1 ? '・溜め中' : v.charge === 2 ? '・大技' : '') + (B.broken(v) ? '・ブレイク中' : '');
      h += '<button class="btn" data-nav data-act="target" data-id="' + v.id + '"><span>' + v.name + '</span><small>体力' + Math.round(v.hp) + '・気力' + Math.round(v.k) + extra + '</small></button>';
    });
    return h + '</div><div class="hint">上の絵を押しても選べる</div><div class="row"><button class="btn" data-nav data-back data-act="toMenu">戻る</button></div>';
  }
  function roleTag(v) { return '<span class="role r' + (v.pos >= 3 ? 3 : v.pos) + '">' + (v.pos >= 3 ? '控え' : ROLE[v.pos]) + '</span>'; }
  function swapHTML() {
    var h, list;
    if (st.mode === 'swap1') { h = '<h3>交代・並べ替え：動かす人を選ぶ</h3>'; list = swapOutCands(); }
    else { h = '<h3>' + B.unit(st.swapOut).name + 'と入れ替える人を選ぶ</h3>'; list = swapInCands(); }
    h += '<div class="who">';
    list.forEach(function (v) {
      h += '<button class="btn" data-nav data-act="swapPick" data-id="' + v.id + '"><span>' + roleTag(v) + v.name + '</span><small>体力' + Math.round(v.hp) + '・気力' + Math.round(v.k) + '</small></button>';
    });
    return h + '</div><div class="hint">1ターンに1回、どちらか：<b>控えとの交代</b>（入った人はこのターンから動ける。下がった人はこのターンの支援を休む）／<b>前線同士の並べ替え</b>（前衛ほど先に動き、狙われやすい）。ブレイク中の人は動かせない。</div>' +
      '<div class="row"><button class="btn" data-nav data-back data-act="toIdle">やめる</button></div>';
  }
  function resultHTML() {
    var win = B.outcome === 'win', s = B.stat;
    if (B.bestNew === undefined) {
      B.bestNew = false;
      try { var best = JSON.parse(localStorage.getItem('sr-battle-best-v1')) || {}, key = B.enc.name; if ((s.maxHit || 0) > (best[key] || 0)) { B.bestNew = !!best[key] || s.maxHit > 0; best[key] = Math.round(s.maxHit); localStorage.setItem('sr-battle-best-v1', JSON.stringify(best)); } B.best = best[key] || 0; } catch (e) { B.best = 0; }
    }
    var mh = s.maxHit ? '<div class="maxhit">最大ダメージ <b>' + Math.round(s.maxHit).toLocaleString() + '</b>（' + s.maxHitBy + '）' + (B.bestNew ? '<span class="newbest">自己ベスト更新！</span>' : B.best ? '<span class="small">　自己ベスト ' + B.best.toLocaleString() + '</span>' : '') + '</div>' : '';
    return '<div class="result"><h2>' + (win ? '勝利' : '敗北') + '</h2>' + mh +
      '<div>' + B.t + 'ターン　ブレイク ' + s.breaks + '回' + (B.tune.charge ? '（大技を止めた ' + (s.stops || 0) + '回）' : '') +
      '　追撃 ' + s.chases + '回　反撃 ' + s.counters + '回　交代 ' + s.swaps + '回　並べ替え ' + (s.moves || 0) + '回　味方のブレイク ' + s.allyBreaks + '回</div>' +
      '<div class="row" style="justify-content:center"><button class="btn primary" data-nav data-act="again">もう一度</button>' +
      '<button class="btn" data-nav data-act="title">相手・構成を変える</button></div></div>';
  }

  // ================= 操作 =================
  function openMenu(u) { if (!u) return; st.actor = u; st.mode = 'menu'; st.list = null; st.skill = null; st.boost = cmds[u.id] ? cmds[u.id].boost || 0 : 0; draw(); }
  function boostFor(id) { return B.boostable(id) ? Math.min(st.boost || 0, st.actor.bp) : 0; }
  function nextActor() {
    var rest = B.actors().filter(function (u) { return !cmds[u.id]; });
    if (rest.length) openMenu(rest[0]); else { st.mode = 'idle'; st.actor = null; draw(); }
  }
  function chooseSkill(id) {
    var u = st.actor, tk = B.targetKind(u, id);
    if (tk === 'none') { cmds[u.id] = { skill: id, target: SR.skills[id].kind === 'aim' ? u.id : null, boost: boostFor(id) }; return nextActor(); }
    st.skill = id;
    var c = targetCands();
    if (c.length === 1) return chooseTarget(c[0].id);
    st.mode = 'target'; draw();
  }
  function chooseTarget(id) { cmds[st.actor.id] = { skill: st.skill, target: id, boost: boostFor(st.skill) }; nextActor(); }
  function doSwap(id2) {
    if (!B.swap(st.swapOut, id2)) { st.mode = 'idle'; return draw(); }
    var sw = B.swapped, out = B.unit(sw.out), inn = B.unit(sw.inn);
    if (sw.front) {
      logLine(out.name + 'が' + ROLE[out.pos] + '、' + inn.name + 'が' + ROLE[inn.pos] + 'に並べ替え', 's');
      checkCosts(); st.mode = 'idle'; st.actor = null; draw();
    } else {
      delete cmds[out.id];
      logLine(out.name + 'が下がり、' + inn.name + 'が' + ROLE[inn.pos] + 'に入る', 's');
      checkCosts(); openMenu(inn);
    }
  }
  function unswap() {
    var sw = B.swapped, inn = B.unit(sw.inn), out = B.unit(sw.out);
    B.unswap();
    if (sw.front) logLine('並べ替えを取り消した', 's');
    else { delete cmds[inn.id]; logLine('交代を取り消した（' + out.name + 'が戻る）', 's'); }
    checkCosts(); st.mode = 'idle'; st.actor = null; draw();
  }
  // 交代で支援の対象が変わり、気力が足りなくなったコマンドを外す
  function checkCosts() {
    Object.keys(cmds).forEach(function (id) {
      var u = B.unit(id);
      if (!B.available(u, cmds[id].skill)) { delete cmds[id]; logLine(u.name + 'のコマンドは精神力が足りなくなったので外した', 's'); }
    });
  }
  function setAuto(u) { var r = B.autoPick(u); cmds[u.id] = { skill: r.skill, target: r.target ? r.target.id : null, boost: r.boost || 0 }; }
  function cycleActor(dir) {
    var list = B.actors(); if (!list.length) return;
    var i = list.indexOf(st.actor);
    i = i < 0 ? 0 : (i + dir + list.length) % list.length;
    openMenu(list[i]);
  }
  function startSwap() { if (B.swapped) return unswap(); if (!swapOutCands().length) return; st.mode = 'swap1'; st.swapOut = null; draw(); }

  $('panel').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    SR.sound.se(b.hasAttribute('data-back') || act === 'unswap' ? 'back' : act === 'swapPick' && st.mode === 'swap2' ? 'swap' : 'ok');
    if (act === 'actor') openMenu(B.unit(id));
    else if (act === 'skill') chooseSkill(id);
    else if (act === 'list') { st.list = id; st.mode = 'list'; draw(); }
    else if (act === 'target') chooseTarget(id);
    else if (act === 'boost') { st.boost = +id; draw(); }
    else if (act === 'toMenu') { st.mode = 'menu'; draw(); }
    else if (act === 'toIdle') { st.mode = 'idle'; st.actor = null; draw(); }
    else if (act === 'auto') { setAuto(st.actor); nextActor(); }
    else if (act === 'repeat') repeatLast();
    else if (act === 'autoAll'){ B.actors().forEach(function (u) { if (!cmds[u.id]) setAuto(u); }); st.mode = 'idle'; st.actor = null; draw(); }
    else if (act === 'swap') startSwap();
    else if (act === 'unswap') unswap();
    else if (act === 'swapPick') onUnitClick(id);
    else if (act === 'go') run();
    else if (act === 'fast') speed = 0.25;
    else if (act === 'again') start();
    else if (act === 'title') location.reload();
  });

  // ================= 実行と再生 =================
  var speed = 1;
  function run() {
    B.actors().forEach(function (u) { if (!cmds[u.id]) cmds[u.id] = { skill: B.available(u, 'basic') ? 'basic' : 'defend', target: null }; });
    B.actors().forEach(function (u) { logLine(u.name + '：' + cmdText(u, cmds[u.id]), 'g'); });
    lastCmds = JSON.parse(JSON.stringify(cmds));
    st.mode = 'play'; st.actor = null; speed = 1; draw();
    playOrder = B.previewOrder(cmds); playActor = null;
    if (B.fxBest === undefined) { try { B.fxBest = (JSON.parse(localStorage.getItem('sr-battle-best-v1')) || {})[B.enc.name] || 0; } catch (e) { B.fxBest = 0; } B.fxTop = B.fxBest; }
    playMood = B.enemies.some(function (e) { return e.hp > 0 && e.charge === 2 && !B.broken(e); }) ? 2 : 0;
    var evs = B.resolve(cmds), i = 0;
    var banner = $('banner');
    fxs = { aura: null, big: false, sum: 0, n: 0 };
    (function step() {
      if (i >= evs.length) { banner.classList.add('hidden'); playMood = null; finishTurn(); return; }
      var ev = evs[i++], f = ev.fx || {};
      banner.textContent = ev.text; banner.classList.remove('hidden');
      logLine(ev.text, ev.fx && ev.fx.enemy ? 'e' : ev.fx && ev.fx.broke ? 'b' : '');
      if (f.actor) { playActor = f.actor; fxs.aura = f.boost ? { id: f.actor, n: Math.min(2, f.boost) } : null; fxs.big = !!f.big; fxs.sum = 0; fxs.n = 0; SR.fx.resetSlot(); }
      if (f.actor && bigDone) { playMood = 0; bigDone = false; }
      if (f.charge) playMood = 1; else if (f.big) { playMood = 2; bigDone = true; } else if (f.stop) playMood = 0;
      renderField(ev.snap);
      if (fxs.aura) { var ae = $('u-' + fxs.aura.id); if (ae) ae.classList.add('aura' + fxs.aura.n); }
      // この行動で、このあともう敵に当たらないなら合計を出す
      var last = true;
      for (var j = i; j < evs.length; j++) { var g = evs[j].fx; if (!g) continue; if (g.actor) break; if (g.dmg !== undefined && !g.statusTick && !B.unit(g.target).hero) { last = false; break; } }
      var extra = fx(ev, last);
      setTimeout(step, Math.max(ev.dur * speed, extra || 0));
    })();
  }
  var fxs = { aura: null, big: false, sum: 0, n: 0 }, playMood = null, bigDone = false;
  var SIGNATURE = { '業火': 1, '灰燼': 1, '星落とし': 1, '決死の一閃': 1, '捨て身斬り': 1 };
  // 演出。長く見せたいときは、その長さ（ミリ秒）を返す
  function fx(ev, last) {
    var f = ev.fx; if (!f) return 0;
    var snd = SR.sound.se, F = SR.fx, hold = 0;
    var allDown = B.enemies.every(function (e) { return val(e, ev.snap).hp <= 0; });
    if (f.actor) {
      var ael = $('u-' + f.actor);
      if (f.charge) F.charge(ael);
      else if (f.big) { F.big(B.unit(f.actor).name); hold = 1100; }
      else if (f.skill && SIGNATURE[f.skill]) { F.skill(f.skill, B.unit(f.actor).name, $('enemyArea')); hold = 1150; }
      if (f.boost) F.boost(ael, Math.min(2, f.boost));
      if (f.swap || (ev.text.indexOf('飛び出した') >= 0)) F.rush(ael);
    }
    if (f.charge) snd('charge');
    else if (f.big) snd('big');
    else if (f.support) snd('support');
    if (f.stop) { snd('stop'); F.stop($('u-' + f.target)); hold = 1000; }
    else if (f.broke) snd('brk');
    else if (f.down) snd('down');
    else if (f.dmg !== undefined) snd(B.unit(f.target).hero ? 'hurt' : 'hit');
    else if (f.heal || f.kheal) snd('heal');
    if (f.actor) { var a = $('u-' + f.actor); if (a) { a.classList.add('acting'); if (f.boost) popup(a, 'ブースト' + f.boost + '！', 'boost'); } }
    if (f.boost) snd('boost');
    if (!f.target) return hold;
    var el = $('u-' + f.target); if (!el) return hold;
    var hero = B.unit(f.target).hero;
    if (f.dmg !== undefined) {
      el.classList.add('shake');
      var best = !hero && !f.statusTick && B.fxBest > 0 && f.dmg > B.fxTop;
      if (!hero && f.dmg > B.fxTop) B.fxTop = f.dmg;
      F.num(el, f.dmg, { hurt: hero, big: hero && fxs.big, best: best });
      if (f.kdmg > 0) popup(el, '気力-' + f.kdmg, 'kd');
      if (!hero && !f.statusTick) {
        fxs.sum += f.dmg; fxs.n++;
        if (last && fxs.n >= 2) { var sm = fxs.sum, sn = fxs.n; setTimeout(function () { F.total($('enemyArea'), sm, sn); }, 260); hold = Math.max(hold, 900); fxs.sum = 0; fxs.n = 0; }
        if (allDown) hold = Math.max(hold, 900);   // とどめの一撃はゆっくり見せる
      }
    }
    if (f.heal) popup(el, '+' + f.heal, 'heal');
    if (f.kheal) popup(el, '気力+' + f.kheal, 'heal');
    if (f.mheal) popup(el, '精神力+' + f.mheal, 'mp');
    if (f.maxCut) popup(el, '最大体力-' + f.maxCut, 'kd');
    if (f.revive) { F.revive(el); hold = Math.max(hold, 1000); }
    if (f.broke) { F.breakHit(el, hero); hold = Math.max(hold, hero ? 800 : 1150); }
    if (f.down) {
      F.down(el, hero);
      if (!hero && allDown) { F.finale(); hold = 1800; } else hold = Math.max(hold, 800);
    }
    if (f.status) { var sp = document.createElement('div'); sp.className = 'pop stpop'; sp.innerHTML = SR.statusIcon(f.status) + SR.statuses[f.status].name; el.appendChild(sp); }
    if (f.miss) popup(el, 'ミス', 'kd');
    return hold;
  }
  function popup(el, text, cls) { var s = document.createElement('div'); s.className = 'pop ' + cls; s.textContent = text; el.appendChild(s); }
  function finishTurn() {
    playOrder = null; playActor = null;
    if (B.outcome) { SR.sound.fadeBgm(900); SR.sound.se(B.outcome === 'win' ? 'win' : 'lose'); st.mode = 'result'; logLine(B.outcome === 'win' ? '勝利！' : '全員倒れてしまった…', 't'); draw(); return; }
    newTurn();
  }
  function snapshotAll() {
    return { heroes: B.heroes.map(function (u) { return Object.assign({}, u); }), enemies: B.enemies.map(function (e) { return Object.assign({}, e); }) };
  }

  // ================= キーボード・コントローラー =================
  var nav = {
    idx: 0,
    items: function () {
      var scope = st.mode === 'title' || $('battle').classList.contains('hidden') ? $('title') : $('panel');
      return Array.prototype.filter.call(scope.querySelectorAll('[data-nav]'), function (b) { return !b.disabled; });
    },
    refresh: function () {
      var it = this.items();
      if (this.idx >= it.length) this.idx = 0;
      this.paint(it);
    },
    paint: function (it) {
      it = it || this.items();
      document.querySelectorAll('.focus').forEach(function (e) { e.classList.remove('focus'); });
      var el = it[this.idx]; if (el) { el.classList.add('focus'); if (document.body.classList.contains('kbd')) el.scrollIntoView({ block: 'nearest' }); }
    },
    move: function (d) { var it = this.items(); if (!it.length) return; this.idx = (this.idx + d + it.length) % it.length; this.paint(it); },
    // 見た目の位置で上下左右に動く。その方向に何もなければ一覧の順で前後へ。
    dir: function (name) {
      var it = this.items(); if (!it.length) return;
      var cur = it[this.idx]; if (!cur) { this.idx = 0; return this.paint(it); }
      var r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var best = -1, bestScore = Infinity;
      it.forEach(function (el, i) {
        if (el === cur) return;
        var q = el.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2;
        var main, side;
        if (name === 'up') { if (q.bottom > r.top + 2) return; main = r.top - q.bottom; side = Math.abs(x - cx); }
        else if (name === 'down') { if (q.top < r.bottom - 2) return; main = q.top - r.bottom; side = Math.abs(x - cx); }
        else if (name === 'left') { if (q.right > r.left + 2 || Math.abs(y - cy) > Math.max(r.height, q.height)) return; main = r.left - q.right; side = Math.abs(y - cy); }
        else { if (q.left < r.right - 2 || Math.abs(y - cy) > Math.max(r.height, q.height)) return; main = q.left - r.right; side = Math.abs(y - cy); }
        var score = Math.max(0, main) + side * 2;
        if (score < bestScore) { bestScore = score; best = i; }
      });
      if (best >= 0) { this.idx = best; this.paint(it); }
      else this.move(name === 'up' || name === 'left' ? -1 : 1);
    },
    press: function () { var el = this.items()[this.idx]; if (el) el.click(); },
    back: function () { var b = (st.mode === 'title' ? null : $('panel').querySelector('[data-back]')); if (b) b.click(); },
  };
  // 画面が変わったら最初の項目に合わせる
  var lastMode = null;
  var origRefresh = nav.refresh;
  nav.refresh = function () { var key = st.mode + (st.actor ? st.actor.id : '') + (st.list || ''); if (key !== lastMode) { var it0 = this.items(), f = it0.findIndex(function (e) { return e.hasAttribute('data-first') && !e.disabled; }); this.idx = f < 0 ? 0 : f; lastMode = key; } origRefresh.call(this); };

  function input(name) {
    document.body.classList.add('kbd');
    if (st.mode === 'play') { if (name === 'a' || name === 'start') speed = 0.25; return; }
    if (name === 'up' || name === 'down' || name === 'left' || name === 'right') { var before = nav.idx; nav.dir(name); if (nav.idx !== before) SR.sound.se('tick'); }
    else if (name === 'a') nav.press();
    else if (name === 'b') nav.back();
    else if (st.mode === 'title') { if (name === 'start') start(); }
    else if (st.mode === 'result') { if (name === 'start') start(); }
    else if (name === 'l') cycleActor(-1);
    else if (name === 'r') cycleActor(1);
    else if (name === 'x') startSwap();
    else if (name === 'start') run();
  }
  document.addEventListener('keydown', function (e) {
    var map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'a', ' ': 'a', z: 'a',
      Escape: 'b', Backspace: 'b', q: 'l', e: 'r', c: 'x', s: 'start' };
    var n = map[e.key]; if (!n) return;
    e.preventDefault(); input(n);
  });
  document.addEventListener('mousedown', function () { document.body.classList.remove('kbd'); });
  document.addEventListener('touchstart', function () { document.body.classList.remove('kbd'); }, { passive: true });

  // ゲームパッド（標準配置：0=A 1=B 2=X 4=L 5=R 9=START 12〜15=十字キー）
  var padPrev = {}, padHold = {};
  var padMap = { 0: 'a', 1: 'b', 2: 'x', 4: 'l', 5: 'r', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  (function poll() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var p = 0; p < pads.length; p++) {
      var gp = pads[p]; if (!gp) continue;
      var axUp = gp.axes[1] < -0.6, axDn = gp.axes[1] > 0.6, axL = gp.axes[0] < -0.6, axR = gp.axes[0] > 0.6;
      Object.keys(padMap).forEach(function (k) {
        var on = gp.buttons[k] && gp.buttons[k].pressed;
        if (k === '12') on = on || axUp; if (k === '13') on = on || axDn; if (k === '14') on = on || axL; if (k === '15') on = on || axR;
        var key = p + ':' + k, now = performance.now();
        if (on && !padPrev[key]) { input(padMap[k]); padHold[key] = now + 400; }
        else if (on && k >= 12 && now > padHold[key]) { input(padMap[k]); padHold[key] = now + 120; }
        padPrev[key] = on;
      });
    }
    requestAnimationFrame(poll);
  })();

  drawTitle();
})();
