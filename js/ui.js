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
      return '<button class="sk' + (on ? ' on' : '') + '" data-nav data-lo="tog" data-id="' + s + '"' + (over ? ' disabled' : '') + '>' +
        '<b>' + s + '</b><span class="c">' + (on ? '装備中・' : '') + 'コスト' + ap + (a ? '／気力' + a.cost : '') + '</span>' +
        (tags ? '<div>' + tags + '</div>' : '') + '<span class="d">' + desc + '</span></button>';
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
  function choiceButtons(box, list, key) {
    box.innerHTML = '';
    Object.keys(list).forEach(function (k) {
      var b = document.createElement('button');
      b.className = 'btn choice' + (pick[key] === k ? ' sel' : '');
      b.setAttribute('data-nav', '');
      b.innerHTML = '<b>' + list[k].name + '</b><span class="small">' + (key === 'kit' ? kitNote(k) : list[k].note) + '</span>';
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
    $('log').innerHTML = '';
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

  // ================= 絵 =================
  // 敵の絵：ぴぽやのポップモンスター素材（img/enemies）。ない場合は仮の絵。
  function beastSVG(e) {
    if (e.img) return '<img class="mon" src="img/enemies/pipo-' + e.img + '.png" alt="">';
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
  function val(u, snap) { return snap && snap[u.id] ? snap[u.id] : { hp: u.hp, k: u.k, brk: B.broken(u), form: u.form }; }
  function pct(a, b) { return Math.max(0, Math.min(100, a / b * 100)); }
  function hpColor(r) { return r > .5 ? 'var(--hp)' : r > .25 ? 'var(--hpLow)' : 'var(--hpCrit)'; }
  function bars(u, v) {
    return '<div class="bar"><i style="width:' + pct(v.hp, u.maxHp) + '%;background:' + hpColor(v.hp / u.maxHp) + '"></i></div>' +
      '<div class="bar k"><i style="width:' + pct(v.k, u.maxK) + '%"></i></div>' +
      '<div class="nums"><span>体力 ' + Math.round(v.hp) + '</span><span>気力 ' + Math.round(v.k) + '</span></div>';
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
      d.innerHTML = beastSVG(e) + '<div class="nm">' + e.name + '</div><div>' + tags + '</div>' + bars(e, v);
      if (can.indexOf(e.id) >= 0) { d.classList.add('pickable'); d.onclick = function () { onUnitClick(e.id); }; }
      addOrd(d, e.id); ea.appendChild(d);
    });

    var pa = $('partyArea'), ra = $('reserveArea');
    pa.innerHTML = ''; ra.innerHTML = '<div class="lbl">控え（支援）</div>';
    B.heroes.slice().sort(function (a, b) { return a.pos - b.pos; }).forEach(function (u) {
      var v = val(u, snap), res = u.pos >= 3, d = document.createElement('div');
      d.className = 'unit ' + (res ? 'reserve' : 'hero') + (v.hp <= 0 ? ' down' : '') + (v.brk ? ' brk' : '');
      d.id = 'u-' + u.id;
      if (!res) d.setAttribute('data-pos', u.pos);
      var tags = '';
      if (u.id === 'N') tags += '<span class="badge b-form">' + SR.formNames[v.form] + '</span>';
      if (v.brk) tags += '<span class="badge b-brk">ブレイク</span>';
      if (u.aim > 0) tags += '<span class="badge b-buff">照準</span>';
      if (u.kProtect >= B.t) tags += '<span class="badge b-buff">気力防護</span>';
      if (u.protect >= B.t) tags += '<span class="badge b-buff">防護</span>';
      if (u.defend === B.t) tags += '<span class="badge b-buff">防御</span>';
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
  }

  function cmdText(u, c) {
    var a = SR.skills[c.skill];
    var t = c.target ? B.unit(c.target) : null;
    return (a.label || a.id) + (t && B.targetKind(u, c.skill) !== 'none' ? ' → ' + t.name : '');
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
      return '<div class="oc o-' + o.kind + (o.todo ? ' todo' : '') + (curId === o.id ? ' cur' : '') + '" title="' + title + '">' +
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
      : '<button class="btn" data-nav data-act="swap"' + (swapOutCands().length ? '' : ' disabled') + '>交代・並べ替え</button>';
    var left = B.actors().filter(function (u) { return !cmds[u.id]; }).length;
    return '<div class="row">' + s +
      '<button class="btn" data-nav data-act="autoAll">全員おまかせ</button>' +
      '<button class="btn primary" data-nav' + (left ? '' : ' data-first') + ' data-act="go">行動開始' + (left ? '（未入力' + left + '人は防御）' : '') + '</button></div>';
  }
  function idleHTML() {
    var h = '<div class="phead"><h3>コマンドを入れる人を選ぶ</h3>' + commonButtons() + '</div><div class="who">';
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
    var h = '<div class="phead"><h3><span class="role r' + u.pos + '">' + ROLE[u.pos] + '</span>' + u.name + 'の行動　<span class="small">気力 ' + Math.round(u.k) + '</span></h3>' + commonButtons() + '</div>';
    h += '<div class="menu4">' +
      '<button class="big" data-nav data-first data-act="skill" data-id="basic"' + (brave.ok ? '' : ' disabled') + '>ブレイブ攻撃<span class="c">気力' + brave.cost + '</span><span class="d">気力を0にすればブレイク</span></button>' +
      '<button class="big" data-nav data-act="list" data-id="skill"' + (nSkill ? '' : ' disabled') + '>スキル<span class="c">' + nSkill + '</span><span class="d">ユニーク' + (u.id === 'N' ? '' : '・コモン') + '</span></button>' +
      '<button class="big" data-nav data-act="skill" data-id="defend"' + (defend.ok ? '' : ' disabled') + '>防御<span class="c">消費なし</span><span class="d">このターン受けるダメージ半分</span></button>' +
      '</div>';
    var pas = B.passivesOf(u);
    if (pas.length) h += '<div class="hint">常時：' + pas.map(function (s) { return s + '（' + SR.passives[s][2] + '）'; }).join('　') + '</div>';
    h += '<div class="row"><button class="btn" data-nav data-act="auto">おまかせ</button><button class="btn" data-nav data-back data-act="toIdle">一覧へ戻る</button></div>';
    return h;
  }
  function skillButton(o) {
    var a = o.skill, h = '<button class="sk" data-nav data-act="skill" data-id="' + o.id + '"' + (o.ok ? '' : ' disabled') + '>';
    h += '<b>' + (a.label || a.id) + '</b><span class="c">' + (o.cost ? '気力' + o.cost : '消費なし') + '</span>';
    var tags = SR.typeBadge(o.id);
    if (a.brave) tags += '<span class="badge b-brk">ブレイク可</span>';
    if (a.all) tags += '<span class="badge b-form">全体</span>';
    if (a.hits) tags += '<span class="badge b-form">' + a.hits + '連撃</span>';
    if (a.fire) tags += '<span class="badge b-fire">炎</span>';
    if (a.form) tags += '<span class="badge b-form">→' + SR.formNames[a.form] + '</span>';
    if (tags) h += '<div>' + tags + '</div>';
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
    h = '<h3>' + u.name + '：スキル　<span class="small">気力 ' + Math.round(u.k) + '</span></h3>';
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
    var h = '<h3>' + u.name + '：' + (a.label || a.id) + '　' + (tk === 'enemy' ? '相手を選ぶ' : '仲間を選ぶ') + '</h3><div class="who">';
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
    return '<div class="result"><h2>' + (win ? '勝利' : '敗北') + '</h2>' +
      '<div>' + B.t + 'ターン　ブレイク ' + s.breaks + '回' + (B.tune.charge ? '（大技を止めた ' + (s.stops || 0) + '回）' : '') +
      '　追撃 ' + s.chases + '回　反撃 ' + s.counters + '回　交代 ' + s.swaps + '回　並べ替え ' + (s.moves || 0) + '回　味方のブレイク ' + s.allyBreaks + '回</div>' +
      '<div class="row" style="justify-content:center"><button class="btn primary" data-nav data-act="again">もう一度</button>' +
      '<button class="btn" data-nav data-act="title">相手・構成を変える</button></div></div>';
  }

  // ================= 操作 =================
  function openMenu(u) { if (!u) return; st.actor = u; st.mode = 'menu'; st.list = null; st.skill = null; draw(); }
  function nextActor() {
    var rest = B.actors().filter(function (u) { return !cmds[u.id]; });
    if (rest.length) openMenu(rest[0]); else { st.mode = 'idle'; st.actor = null; draw(); }
  }
  function chooseSkill(id) {
    var u = st.actor, tk = B.targetKind(u, id);
    if (tk === 'none') { cmds[u.id] = { skill: id, target: SR.skills[id].kind === 'aim' ? u.id : null }; return nextActor(); }
    st.skill = id;
    var c = targetCands();
    if (c.length === 1) return chooseTarget(c[0].id);
    st.mode = 'target'; draw();
  }
  function chooseTarget(id) { cmds[st.actor.id] = { skill: st.skill, target: id }; nextActor(); }
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
      if (!B.available(u, cmds[id].skill)) { delete cmds[id]; logLine(u.name + 'のコマンドは気力が足りなくなったので外した', 's'); }
    });
  }
  function setAuto(u) { var r = B.autoPick(u); cmds[u.id] = { skill: r.skill, target: r.target ? r.target.id : null }; }
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
    else if (act === 'toMenu') { st.mode = 'menu'; draw(); }
    else if (act === 'toIdle') { st.mode = 'idle'; st.actor = null; draw(); }
    else if (act === 'auto') { setAuto(st.actor); nextActor(); }
    else if (act === 'autoAll') { B.actors().forEach(function (u) { if (!cmds[u.id]) setAuto(u); }); st.mode = 'idle'; st.actor = null; draw(); }
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
    B.actors().forEach(function (u) { if (!cmds[u.id]) cmds[u.id] = { skill: 'defend', target: null }; });
    B.actors().forEach(function (u) { logLine(u.name + '：' + cmdText(u, cmds[u.id]), 'g'); });
    st.mode = 'play'; st.actor = null; speed = 1; draw();
    playOrder = B.previewOrder(cmds); playActor = null;
    var evs = B.resolve(cmds), i = 0;
    var banner = $('banner');
    (function step() {
      if (i >= evs.length) { banner.classList.add('hidden'); finishTurn(); return; }
      var ev = evs[i++];
      banner.textContent = ev.text; banner.classList.remove('hidden');
      logLine(ev.text, ev.fx && ev.fx.enemy ? 'e' : ev.fx && ev.fx.broke ? 'b' : '');
      if (ev.fx && ev.fx.actor) playActor = ev.fx.actor;
      renderField(ev.snap); fx(ev);
      setTimeout(step, ev.dur * speed);
    })();
  }
  function fx(ev) {
    var f = ev.fx; if (!f) return;
    var snd = SR.sound.se;
    if (f.charge) snd('charge');
    else if (f.big) snd('big');
    else if (f.support) snd('support');
    if (f.stop) { snd('stop'); var se2 = $('u-' + f.target); if (se2) popup(se2, '大技を止めた！', 'brk'); }
    else if (f.broke) snd('brk');
    else if (f.down) snd('down');
    else if (f.dmg !== undefined) snd(B.unit(f.target).hero ? 'hurt' : 'hit');
    else if (f.heal || f.kheal) snd('heal');
    if (f.actor) { var a = $('u-' + f.actor); if (a) a.classList.add('acting'); }
    if (!f.target) return;
    var el = $('u-' + f.target); if (!el) return;
    if (f.dmg !== undefined) { el.classList.add('shake'); popup(el, '-' + f.dmg, 'dmg'); if (f.kdmg > 0) popup(el, '気力-' + f.kdmg, 'kd'); }
    if (f.heal) popup(el, '+' + f.heal, 'heal');
    if (f.kheal) popup(el, '気力+' + f.kheal, 'heal');
    if (f.broke) popup(el, 'BREAK', 'brk');
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
