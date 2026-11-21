// 画面と操作（見やすさ版）。
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var ROLE = ['前衛', '中衛', '後衛'];
  var pick = { enc: 'normal', kit: 'custom', tune: 'tense' };
  var B = null, turnSave = null;
  // 状態：idle / menu / list / target / swap1 / swap2 / play / result
  var st = { mode: 'title', actor: null, list: null, skill: null, swapOut: null };
  var cmds = {};

  // ================= タイトル =================
  function kitNote(k) {
    return { standard: 'ナハトは崩し斬り・かばう・断ち込み。連携と回復のバランス型',
      counter: 'ナハトは誘い斬りで引きつけ、リベンジの反撃で崩す',
      chase: 'ナハトの追撃を1ターン2回まで。連撃で気力を削って追撃',
      custom: '技の書で覚えた技は全部使える。パッシブだけコストで選ぶ（上限は時期で増える）' }[k];
  }

  // ================= スキル編成 =================
  var lo = { who: 'N', set: null, open: true };
  var SYSCOL = { 構築: '#e8c372', 循環: '#6ed2c8', 観測: '#96a0ff', 干渉: '#eb7878' };
  // 技の書（2026-11-21 一画面に収める形）：上に人・タブ・時期、下に中身。中身はスクロールしない
  //   コモン：左にツリー（3D／平面）、右に「詳細・重点・本屋・一覧」の切り替え
  //   ユニーク・パッシブ：小さな札を並べる。くわしい説明は長押し（カーソルを乗せる）で出る
  function bookHTML(id, charTabs) {
    var G = SR.growth, era = G.era();
    var tab = lo.btab || 'common'; if (id === 'N' && tab === 'common') tab = 'link'; if (id !== 'N' && tab === 'link') tab = 'common';
    var h = '<div class="bk-top">' + charTabs + '<div class="row btabs">' + (id === 'N' ? [['unique', SR.uniqueName(id)], ['link', SR.LINK_NAME], ['passive', 'パッシブ']] : [['common', SR.COMMON_NAME], ['unique', SR.uniqueName(id)], ['passive', 'パッシブ']]).map(function (b) {
      return '<button class="btn' + (tab === b[0] ? ' sel' : '') + '" data-nav data-lo="btab" data-id="' + b[0] + '">' + b[1] + '</button>';
    }).join('') + '</div><div class="row bk-era"><span class="small">時期</span>' + [1, 2, 3].map(function (n) {
      return '<button class="btn mini' + (era === n ? ' sel' : '') + '" data-nav data-lo="era" data-id="' + n + '">' + SR.eraName[n] + '</button>';
    }).join('') + '<span class="gold">金貨 <b>' + G.gold() + '</b></span></div></div>';
    h += '<div class="bk-main">';
    if (tab === 'common') {
      // ---- 左：ツリー ----
      var SYS = SR.baseSystems, CW = 230, W = CW * SYS.length, HT = 360, H = 40 + HT + 56, pos = {};
      function YB(hh) { return H - 56 - SR.visH(hh) * HT; }   // 段の長さは経験値に比例（初級は短く、上級は長く）
      SYS.forEach(function (s, ci) {
        [1, 2, 3].forEach(function (t) {
          var col = SR.ctree.filter(function (n) { return n.sys === s && n.tier === t && !n.combo; }).sort(function (a, b) { return a.h - b.h; });
          col.forEach(function (n, i) { pos[n.id] = { x: ci * CW + CW / 2 + (col.length > 1 ? (i % 2 ? 52 : -52) : 0), y: YB(n.h) }; });
        });
      });
      SR.ctree.forEach(function (n) { if (n.combo) { var mi = n.combo.reduce(function (t, s) { return t + SYS.indexOf(s); }, 0) / n.combo.length; pos[n.id] = { x: mi * CW + CW / 2, y: YB(n.h) }; } });
      var svg = '<svg class="cst one" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';
      [1, 2, 3].forEach(function (t) {
        var y0 = YB(t), y1 = YB(t - 1);
        svg += '<rect x="0" y="' + y0 + '" width="' + W + '" height="' + (y1 - y0) + '" class="band"/><text x="6" y="' + (y0 + 14) + '" class="bt">' + SR.bookTier[t] + '（経験値' + SR.tierExp(t) + '）</text>';
      });
      SYS.forEach(function (s, ci) {
        var x = ci * CW + CW / 2, yf = YB(G.fill(id, s)), yc = YB(G.books(s)), yb = H - 56;
        svg += '<rect x="' + (x - 10) + '" y="' + yc + '" width="20" height="' + (yb - yc) + '" class="glass"/><rect x="' + (x - 10) + '" y="' + yf + '" width="20" height="' + (yb - yf) + '" fill="' + SYSCOL[s] + '" opacity=".45"/>' +
          '<line x1="' + (x - 30) + '" x2="' + (x + 30) + '" y1="' + yc + '" y2="' + yc + '" class="capl"/>';
      });
      SYS.forEach(function (s, ci) {
        var x = ci * CW + CW / 2, fav = SR.tree.start[id] === s, n = SR.ctree.filter(function (m) { return m.sys === s; }), got = n.filter(function (m) { return G.has(id, m.id); }).length;
        svg += '<g class="root' + (fav ? ' fav' : '') + '"><path d="M' + (x - 46) + ' ' + (H - 6) + ' Q' + x + ' ' + (H - 40) + ' ' + (x + 46) + ' ' + (H - 6) + '"/>' +
          '<text x="' + x + '" y="' + (H - 26) + '" class="rn">' + s + (fav ? '・得意' : '') + '</text><text x="' + x + '" y="' + (H - 10) + '" class="rc">' + got + '/' + n.length + '</text></g>';
      });
      SR.ctree.forEach(function (n) {
        var b = pos[n.id], froms = n.req.map(function (r) { return { p: pos[r], lit: G.has(id, r) && G.has(id, n.id) }; });
        if (n.combo) n.combo.forEach(function (s) { froms.push({ p: { x: SYS.indexOf(s) * CW + CW / 2, y: YB(n.h) }, lit: G.fill(id, s) >= n.h, beam: true }); });
        if (!froms.length) froms.push({ p: { x: SYS.indexOf(n.sys) * CW + CW / 2, y: H - 40 }, lit: G.has(id, n.id) });
        froms.forEach(function (f) { if (!f.p) return; svg += '<line x1="' + f.p.x + '" y1="' + f.p.y + '" x2="' + b.x + '" y2="' + b.y + '" class="cl' + (f.lit ? ' lit' : '') + (f.beam ? ' beam' : '') + '"/>'; });
      });
      SR.ctree.forEach(function (n) {
        var p = pos[n.id], got = G.has(id, n.id), why = got ? '' : G.why(id, n.id), st = got ? 'got' : why ? 'lock' : 'can', sel = lo.sel === n.id;
        var shape = n.stat ? '<circle r="7"/>' : '<path d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z"/>';
        svg += '<g class="cn ' + st + (n.stat ? ' stat' : '') + (n.combo ? ' combo' : '') + (sel ? ' sel' : '') + '" transform="translate(' + p.x + ',' + p.y + ')" data-lo="sel" data-id="' + n.id + '">' +
          (n.combo ? [1, 2, 3].slice(0, n.combo.length - 1).map(function (k) { return '<circle class="cring" r="' + (13 + k * 4) + '"/>'; }).join('') : '') +
          '<circle class="hit" r="22"/>' + (sel ? '<circle class="ring" r="19"/>' : '') + shape + '<text y="' + (n.stat ? 19 : 26) + '">' + SR.skillName(n.id) + '</text></g>';
      });
      svg += '</svg>';
      var v3 = lo.view !== '2d';
      h += '<div class="bk-left"><div class="row t3bar">' +
        (v3 ? '<button class="btn mini" data-nav data-lo="rot" data-id="-1">左へ回す</button><button class="btn mini" data-nav data-lo="rot" data-id="1">右へ回す</button><button class="btn mini" data-nav data-lo="zoom" data-id="1.25">大きく</button><button class="btn mini" data-nav data-lo="zoom" data-id="0.8">小さく</button>' : '') +
        '<button class="btn mini" data-nav data-lo="view" data-id="' + (v3 ? '2d' : '3d') + '">' + (v3 ? '平面で見る' : '立体で見る') + '</button></div>' +
        (v3 ? '<div class="cbox t3"><canvas id="tree3d"></canvas></div>' : '<div class="cbox flat">' + svg + '</div>') + '</div>';
      // ---- 右：詳細・重点・本屋・一覧 ----
      var side = lo.side || 'detail';
      h += '<div class="bk-side"><div class="row stabs">' + [['detail', '詳細'], ['focus', '重点'], ['shop', '本屋'], ['list', '一覧']].map(function (b) {
        return '<button class="btn mini' + (side === b[0] ? ' sel' : '') + '" data-nav data-lo="side" data-id="' + b[0] + '">' + b[1] + '</button>';
      }).join('') + '</div><div class="sbody">';
      if (side === 'detail') {
        var sn = SR.ctreeNode(lo.sel);
        if (sn) {
          var sg = G.has(id, sn.id), sw = sg ? '' : G.why(id, sn.id);
          h += '<div class="cdet"><b>' + SR.skillName(sn.id) + '</b><span class="badge ' + (sn.stat ? 'b-buff' : 'b-sys') + '">' + (sn.stat ? '能力の星' : sn.combo ? sn.combo.join('と') + 'の組み合わせ' : '技') + '</span>' +
            '<div class="d">' + (sn.stat ? sn.fx : SR.describe(SR.skills[sn.id])) + '</div>' +
            '<span class="small">' + sn.books.join('・') + 'の書・' + SR.bookTier[sn.tier] + '／経験値' + Math.round(SR.cumExp(sn.h)) + 'で覚える' + (sn.req.length ? '／前に「' + sn.req.join('」「') + '」' : '') + '</span>' +
            (sg ? '<span class="st">覚えた</span>' : '<span class="why">' + sw + '</span>') + '</div>';
        } else h += '<div class="small">ツリーの星を押すと、ここにくわしく出る。<br>下の四つの体系から上へ育てていく。柱のあいだの輪のついた星は、二つ以上の体系を育てて覚える。<br>大きな星＝技、小さな星＝能力の星。<br>ダブルクリック（ダブルタップ）で柱に寄る。</div>';
      } else if (side === 'focus') {
        h += '<div class="small">重点を一つ選ぶ。戦うたびに経験値が入る（通常戦' + SR.growthCfg.focusNormal + '・ボス' + SR.growthCfg.focusBoss + '）。行動でも少しずつたまる。</div><div class="fsel">' +
          SR.baseSystems.map(function (s) {
            var e = G.exp(id, s), cap = SR.cumExp(G.books(s)), all = SR.cumExp(3), full = e >= cap;
            return '<button class="btn fx' + (G.focus(id) === s ? ' sel' : '') + '" data-nav data-lo="focus" data-id="' + s + '"><span style="color:' + SYSCOL[s] + '">' + s + (SR.tree.start[id] === s ? '・得意' : '') + '</span>' +
              '<span class="xb"><i style="width:' + Math.min(100, e / all * 100) + '%;background:' + SYSCOL[s] + '"></i><s style="left:' + (cap / all * 100) + '%"></s></span>' +
              '<small>' + e + ' / ' + cap + (full ? '（上限・本が必要）' : '') + '</small></button>';
          }).join('') + '</div>';
      } else if (side === 'shop') {
        h += '<div class="small">本を買うと、その体系の柱の上限が上がる（仲間みんな）。時期が進むと中級・上級が並ぶ。</div><div class="shop">' + SR.baseSystems.map(function (s) {
          var have = G.books(s), next = have + 1;
          if (next > 3) return '<span class="shopi"><b style="color:' + SYSCOL[s] + '">' + s + '</b>上級まで持っている</span>';
          var why = next > era ? SR.eraName[next] + 'から売られる' : G.gold() < SR.bookPrice[next] ? '金貨が足りない' : '';
          return '<span class="shopi"><b style="color:' + SYSCOL[s] + '">' + s + '</b>' + SR.bookTier[have] + 'まで' +
            '<button class="btn mini' + (why ? '' : ' primary') + '" data-nav data-lo="buy" data-id="' + s + '"' + (why ? ' disabled' : '') + '>' + SR.bookTier[next] + 'を買う（' + SR.bookPrice[next] + '）</button>' + (why ? '<small>' + why + '</small>' : '') + '</span>';
        }).join('') + '</div>';
      } else {
        var cs = SR.ctree.filter(function (n) { return SR.skills[n.id]; }).sort(function (a, b) { return a.tier - b.tier || SR.baseSystems.indexOf(a.sys) - SR.baseSystems.indexOf(b.sys); });
        h += '<div class="clist">' + cs.map(function (n) {
          var got = G.has(id, n.id);
          return '<div class="crow' + (got ? ' got' : '') + '" data-tip="' + n.id + '" data-tipwho="' + id + '" data-lo="sel" data-id="' + n.id + '"><b>' + SR.skillName(n.id) + '</b><span>' + (got ? '覚えた' : G.why(id, n.id)) + '</span></div>';
        }).join('') + '</div>';
      }
      h += '</div></div>';
    } else if (tab === 'unique') {
      var uni = Object.keys(SR.skills).filter(function (s) { return SR.skills[s].owner === id; });
      h += '<div class="bk-full"><div class="small">サブクエスト・イベントで増える（どのクエストかは未定）。長押し（カーソルを乗せる）でくわしく出る。</div><div class="bk-grid">' + uni.map(function (s) {
        var start = SR.uniqueStart[id].indexOf(s) >= 0, got = G.hasU(id, s);
        return '<div class="node' + (got ? ' got' : ' lock') + '" data-tip="' + s + '" data-tipwho="' + id + '"><b>' + SR.skillName(s) + '</b>' +
          (start ? '<span class="st">最初から</span>' : got ? '<button class="btn mini" data-nav data-lo="uniq" data-id="' + s + '">覚えた（試し）→外す</button>'
            : '<button class="btn mini" data-nav data-lo="uniq" data-id="' + s + '">イベント → 覚えたことにする</button>') + '</div>';
      }).join('') + '</div></div>';
    } else if (tab === 'link') {
      // ---- ナハトの連携技：魔法と同じ3Dの柱。4本の柱は仲間4人、色は親密度 ----
      var open = G.linkOpen(), lside = lo.lside || 'detail';
      h += '<div class="bk-left"><div class="row t3bar"><button class="btn mini" data-nav data-lo="rot" data-id="-1">左へ回す</button><button class="btn mini" data-nav data-lo="rot" data-id="1">右へ回す</button>' +
        '<button class="btn mini" data-nav data-lo="zoom" data-id="1.25">大きく</button><button class="btn mini" data-nav data-lo="zoom" data-id="0.8">小さく</button></div>' +
        '<div class="cbox t3"><canvas id="tree3d"></canvas></div></div>';
      h += '<div class="bk-side"><div class="row stabs">' + [['detail', '詳細'], ['bond', '親密度'], ['list', '一覧']].map(function (b) {
        return '<button class="btn mini' + (lside === b[0] ? ' sel' : '') + '" data-nav data-lo="lside" data-id="' + b[0] + '">' + b[1] + '</button>';
      }).join('') + '</div><div class="sbody">';
      if (!open) h += '<div class="lk-note">連携技は終盤に手に入る（上の「時期」を終盤にすると試せる）</div>';
      function faces(a) { return a.with.map(function (c) { return '<img src="img/' + SR.img[c] + '_serious.jpg" alt="' + SR.names[c] + '">'; }).join(''); }
      if (lside === 'detail') {
        var la = SR.skills[lo.sel];
        if (la && la.link) {
          var lg = G.hasLink(la.id);
          h += '<div class="cdet"><b>' + SR.skillName(la.id) + '</b><span class="lk-f">' + faces(la) + '</span><span class="badge b-sys">' + (la.with.length + 1) + '人・' + (la.join ? '合わせ技' : '力を借りる') + '</span>' +
            '<div class="d">' + SR.describe(la) + '</div>' +
            '<span class="small">' + la.with.map(function (c) { return SR.names[c] + 'との段' + la.need[c]; }).join('・') + 'で使える</span>' +
            (lg ? '<span class="st">使える</span>' : '<span class="why">' + G.linkWhy(la.id) + '</span>') + '</div>';
        } else h += '<div class="small">柱の星を押すと、ここにくわしく出る。<br>4本の柱は仲間4人。その仲間のイベントで1段目が開き、連携技を使うほど親密度がたまって柱に色がつく。<br>柱のあいだの輪のついた星は、3人以上の連携技。<br>ダブルクリック（ダブルタップ）で柱に寄る。</div>';
      } else if (lside === 'bond') {
        var MAXB = SR.bondLv[2] + 20;
        h += '<div class="lk-bonds">' + SR.LINK_MATES.map(function (c) {
          var v = G.bond(c), ev = G.linkEv(c), lv = G.bondLvOf(c);
          return '<div class="lk-b"><img src="img/' + SR.img[c] + '_serious.jpg" alt=""><b>' + SR.names[c] + '</b><span class="lk-lv">段' + lv + '</span>' +
            '<span class="xb"><i style="width:' + (ev ? Math.max(3, v / MAXB * 100) : 0) + '%"></i><s style="left:' + (SR.bondLv[1] / MAXB * 100) + '%"></s><s style="left:' + (SR.bondLv[2] / MAXB * 100) + '%"></s></span>' +
            '<small>' + (ev ? '親密度 ' + v : 'イベント未定') + '</small>' +
            '<button class="btn mini" data-nav data-lo="lev" data-id="' + c + '">' + (ev ? '開いた（試し）→戻す' : 'イベント → 開いたことにする') + '</button>' +
            (ev ? '<button class="btn mini" data-nav data-lo="lbond" data-id="' + c + '">+20（試し）</button>' : '') + '</div>';
        }).join('') + '</div><div class="small">段1：イベント／段2：親密度' + SR.bondLv[1] + '／段3：親密度' + SR.bondLv[2] + '。連携技を1回使うと、いっしょに出した仲間それぞれ+' + SR.BOND_PER_USE + '。</div>';
      } else {
        var lks = Object.keys(SR.skills).filter(function (s) { return SR.isLink(s); });
        h += '<div class="clist">' + lks.map(function (s) {
          var a = SR.skills[s], got = G.hasLink(s);
          return '<div class="crow' + (got ? ' got' : '') + '" data-tip="' + s + '" data-tipwho="N" data-lo="sel" data-id="' + s + '"><b>' + SR.skillName(s) + '</b><span class="lk-f">' + faces(a) + '</span><span>' + (got ? '使える' : G.linkWhy(s)) + '</span></div>';
        }).join('') + '</div>';
      }
      h += '</div></div>';
    } else {
      var L0 = SR.loadout, mine0 = (lo.set && lo.set[id]) || [], cap0 = L0.cap(), used0 = L0.used(mine0);
      h += '<div class="bk-full"><div class="row"><span class="small">付けているコスト <b>' + used0 + '</b> / ' + cap0 + '（序盤' + SR.passiveCap[1] + '・中盤' + SR.passiveCap[2] + '・終盤' + SR.passiveCap[3] + '）</span>' +
        '<span class="small">プリセット：</span>' + ['standard', 'counter', 'chase'].map(function (k) { return '<button class="btn mini" data-nav data-lo="tpl" data-id="' + k + '">' + SR.kits[k].name + '</button>'; }).join('') + '</div><div class="bk-grid">' +
        Object.keys(SR.passives).filter(function (s) { return SR.passives[s][0] === id; }).map(function (s) {
          var start = (SR.passiveStart[id] || []).indexOf(s) >= 0, got = G.hasP(id, s), on = mine0.indexOf(s) >= 0, ap = SR.passives[s][1], over = !on && used0 + ap > cap0;
          return '<div class="node' + (on ? ' got' : got ? ' can' : ' lock') + '" data-tip="' + s + '" data-tipwho="' + id + '"><b>' + SR.skillName(s) + '</b><span class="small">コスト' + ap + (start ? '・最初から' : got ? '・覚えた（試し）' : '・イベントで覚える') + '</span>' +
            (got ? '<button class="btn mini' + (on ? '' : ' primary') + '" data-nav data-lo="tog" data-id="' + s + '"' + (over ? ' disabled' : '') + '>' + (on ? '外す' : over ? 'コストが足りない' : '付ける') + '</button>' +
              (start ? '' : '<button class="btn mini" data-nav data-lo="pas" data-id="' + s + '">覚えていないことにする</button>')
              : '<button class="btn mini" data-nav data-lo="pas" data-id="' + s + '">覚えたことにする</button>') + '</div>';
        }).join('') + '</div></div>';
    }
    return h + '</div>';
  }
  // メニューの「技の書」に、覚えられる星があることを知らせる
  function bookBadge() {
    var any = SR.baseSystems.some(function (s) { return SR.growth.canBuy(s); });
    var b = document.querySelector('.mbtn[data-page="book"]'); if (b) b.classList.toggle('new', any);
  }
  function drawLoadout() {
    var box = $('loadout');
    if (!lo.set) { lo.set = SR.loadout.load() || SR.loadout.fromKit('standard'); SR.loadout.prune(lo.set); SR.loadout.apply(lo.set); }
    var L = SR.loadout, cap = L.cap(), set = lo.set, id = lo.who, mine = set[id], useAp = L.used(mine);
    var h = '<div class="lo-tabs">';
    L.ids.forEach(function (c) {
      h += '<button class="btn' + (c === id ? ' sel' : '') + '" data-nav data-lo="who" data-id="' + c + '">' + SR.names[c] +
        '<small>' + L.used(set[c]) + '/' + cap + '</small></button>';
    });
    h += '</div>'; var tabs = h;
    h += '<div class="lo-head"><b>' + SR.names[id] + 'のパッシブ</b>　コスト <b>' + useAp + '</b> / ' + cap + '<span class="small">（上限は時期で増える：序盤' + SR.passiveCap[1] + '・中盤' + SR.passiveCap[2] + '・終盤' + SR.passiveCap[3] + '）</span>' +
      '<div class="bar k" style="height:10px"><i style="width:' + Math.min(100, useAp / cap * 100) + '%"></i></div></div>';
    h += '<div class="lo-eq">' + (mine.length ? mine.map(function (s) {
      return '<button class="btn" data-nav data-lo="del" data-id="' + s + '">' + s + ' <small>' + L.apOf(s) + '</small> ×</button>';
    }).join('') : '<span class="small">パッシブを付けていない</span>') + '</div>';
    var p = L.pool(id);
    function item(s, passive) {
      var on = mine.indexOf(s) >= 0, ap = L.apOf(s), lock = !SR.canLearn(null, id, s), over = lock || (!on && useAp + ap > cap);
      if (!passive) {   // 技はコストなし：覚えていれば全部使える
        var a0 = SR.skills[s], t0 = SR.typeBadge(s);
        if (a0.brave) t0 += '<span class="badge b-brk">ブレイク可</span>';
        if (a0.form) t0 += '<span class="badge b-form">→' + SR.formNames[a0.form] + '</span>';
        if (a0.era > 1) t0 += '<span class="badge b-charge">' + (a0.era === 3 ? '終盤' : '中盤') + 'の技</span>';
        if (a0.phen) t0 += '<span class="badge b-sys">' + SR.phenText(a0.phen) + '</span>';
        if (lock) t0 += '<span class="badge b-risk">' + (SR.isCommon(s) ? '技の書のツリーで覚える' : 'サブクエスト・イベントで覚える') + '</span>';
        return '<div class="sk' + (lock ? ' locked' : ' on') + catClass(s) + '" data-tip="' + s + '" data-tipwho="' + id + '"><b>' + SR.skillName(s) + '</b><span class="c">' + (lock ? 'まだ使えない' : '使える') + '／精神力' + a0.cost + '</span>' +
          (t0 ? '<div>' + t0 + '</div>' : '') + stLine(a0, !!SR.tunes[pick.tune].status) + '<span class="d">' + SR.describe(a0) + '</span></div>';
      }
      var desc = passive ? SR.passives[s][2] : SR.describe(SR.skills[s]);
      if (passive && lock) desc = '<b style="color:#ffb38a">サブクエスト・イベントで覚える</b>　' + desc;
      var a = SR.skills[s], tags = a ? SR.typeBadge(s) : '';
      if (a && a.brave) tags += '<span class="badge b-brk">ブレイク可</span>';
      if (a && a.form) tags += '<span class="badge b-form">→' + SR.formNames[a.form] + '</span>';
      if (a && a.era > 1) tags += '<span class="badge b-charge">' + (a.era === 3 ? '終盤' : '中盤') + 'の技</span>';
      if (a && a.phen) tags += '<span class="badge b-sys">' + SR.phenText(a.phen) + '</span>';
      if (lock) tags += '<span class="badge b-risk">' + (SR.isCommon(s) ? '技の書のツリーで覚える' : 'サブクエスト・イベントで覚える') + '</span>';
      return '<button class="sk' + (on ? ' on' : '') + (lock ? ' locked' : '') + (a ? catClass(s) : ' t-pas') + '" data-nav data-lo="tog" data-id="' + s + '" data-tip="' + s + '" data-tipwho="' + id + '"' + (over ? ' disabled' : '') + '>' +
        '<b>' + SR.skillName(s) + '</b><span class="c">' + (on ? '装備中・' : '') + 'コスト' + ap + (a ? '／精神力' + a.cost : '') + '</span>' +
        (tags ? '<div>' + tags + '</div>' : '') + (a ? stLine(a, !!SR.tunes[pick.tune].status) : '') + '<span class="d">' + desc + '</span></button>';
    }
    var order = function (a, b) { return ['skillAtk', 'skillDef', 'skillSup'].indexOf(SR.category(a)) - ['skillAtk', 'skillDef', 'skillSup'].indexOf(SR.category(b)); };
    var uni = p.act.filter(function (s) { return !SR.isCommon(s); }).sort(order);
    var com = p.act.filter(function (s) { return SR.isCommon(s); }).sort(order);
    var known = function (x, y) { return SR.canLearn(null, id, y) - SR.canLearn(null, id, x); };
    uni.sort(known); com.sort(known);
    if (p.pas.length) h += '<div class="grp">パッシブ（常に効く・コストで付ける）</div><div class="list">' + p.pas.map(function (s) { return item(s, true); }).join('') + '</div>';
    h += '<div class="grp">使える技：' + SR.uniqueName(id) + '（覚えた技は全部、戦闘で使える）</div><div class="list">' + uni.map(function (s) { return item(s, false); }).join('') + '</div>';
    if (com.length) h += '<div class="grp">使える技：' + SR.COMMON_NAME + '（技の書のツリーで覚える）</div><div class="list">' + com.map(function (s) { return item(s, false); }).join('') + '</div>';
    else if (id === 'N') h += '<div class="grp">' + SR.COMMON_NAME + '</div><div class="small">ナハトは魔法を使わない。この枠には、のちに「リンク」が入る予定。</div>';
    h += '<div class="row"><span class="small">パッシブのプリセット：</span>' + ['standard', 'counter', 'chase'].map(function (k) {
      return '<button class="btn" data-nav data-lo="tpl" data-id="' + k + '">' + SR.kits[k].name + '</button>';
    }).join('') + '<span class="small">選んだ内容は自動で保存されます</span></div>';
    if (box) box.innerHTML = h;   // 編成のページはなくした（技の書に一本化）
    var bt = '<div class="lo-tabs">' + L.ids.map(function (c) { return '<button class="btn' + (c === id ? ' sel' : '') + '" data-nav data-lo="who" data-id="' + c + '">' + SR.names[c] + '<small>' + (c === 'N' ? '刀剣術のみ' : '重点：' + SR.growth.focus(c)) + '</small></button>'; }).join('') + '</div>';
    $('bookBox').innerHTML = bookHTML(id, bt);
    var c3 = document.getElementById('tree3d');
    if (c3 && lo.who === 'N') {
      var MATES = SR.LINK_MATES, lk = Object.keys(SR.skills).filter(function (s) { return SR.isLink(s); }), G2 = SR.growth;
      function bh(c) { if (!G2.linkEv(c)) return 0; var v = G2.bond(c); return v >= SR.bondLv[2] ? 3 : v >= SR.bondLv[1] ? 2 + (v - SR.bondLv[1]) / (SR.bondLv[2] - SR.bondLv[1]) : 1 + v / SR.bondLv[1]; }
      var lcnt = {}, lcap = {}, lfil = {}, LBL = {};
      MATES.forEach(function (c) { var ns = lk.filter(function (s) { return SR.skills[s].with.length === 1 && SR.skills[s].with[0] === c; }); lcnt[c] = ns.filter(function (s) { return G2.hasLink(s); }).length + '/' + ns.length; lcap[c] = G2.linkEv(c) && G2.linkOpen() ? 3 : 0; lfil[c] = G2.linkOpen() ? bh(c) : 0; LBL[c] = SR.names[c]; });
      SR.tree3d.mount(c3, { era: G2.era(), pillars: MATES, label: LBL, colors: { V: [255, 225, 74], F: [255, 122, 58], S: [127, 208, 255], L: [255, 243, 196] }, count: lcnt, cap: lcap, fill: lfil, sel: lo.sel, nodes: lk.map(function (s) {
        var a = SR.skills[s], mx = Math.max.apply(null, a.with.map(function (c) { return a.need[c]; }));
        return { id: s, label: SR.skillName(s), sys: a.with[0], tier: mx, h: mx - 0.15, req: [], combo: a.with.length > 1 ? a.with : null, stat: false, state: G2.hasLink(s) ? 'got' : 'lock' }; }) },
        function (id) { lo.sel = id; lo.lside = 'detail'; SR.sound.se('tick'); drawLoadout(); });
    } else     if (c3 && lo.who !== 'N') {
      var cnt = {}; SR.baseSystems.forEach(function (s) { var ns = SR.ctree.filter(function (n) { return n.sys === s; }); cnt[s] = ns.filter(function (n) { return SR.growth.has(lo.who, n.id); }).length + '/' + ns.length; });
      var cap = {}, fil = {}; SR.baseSystems.forEach(function (s) { cap[s] = SR.growth.books(s); fil[s] = SR.growth.fill(lo.who, s); });
      SR.tree3d.mount(c3, { era: SR.growth.era(), fav: SR.tree.start[lo.who], count: cnt, cap: cap, fill: fil, sel: lo.sel, nodes: SR.ctree.map(function (n) {
        return { id: n.id, label: SR.skillName(n.id), sys: n.sys, tier: n.tier, h: n.h, req: n.req, combo: n.combo, stat: !!n.stat, state: SR.growth.has(lo.who, n.id) ? 'got' : SR.growth.why(lo.who, n.id) ? 'lock' : 'can' }; }) },
        function (id) { lo.sel = id; lo.side = 'detail'; SR.sound.se('tick'); var pg = $('pg-book'), y = pg ? pg.scrollTop : 0; drawLoadout(); if (pg) pg.scrollTop = y; });
    }
    bookBadge();
  }
  $('title').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-lo]'); if (!b || b.disabled) return;
    var act = b.getAttribute('data-lo'), id = b.getAttribute('data-id'), mine = lo.set[lo.who];
    if (act === 'who') { lo.who = id; lo.branch = null; lo.sel = null; }
    else if (act === 'del') mine.splice(mine.indexOf(id), 1);
    else if (act === 'tog') {
      var i = mine.indexOf(id);
      if (i >= 0) mine.splice(i, 1);
      else if (SR.loadout.used(mine) + SR.loadout.apOf(id) <= SR.loadout.cap()) mine.push(id);
    } else if (act === 'sel') { lo.sel = id; lo.side = 'detail'; lo.lside = 'detail'; }
    else if (act === 'btab') lo.btab = id;
    else if (act === 'side') lo.side = id;
    else if (act === 'lside') lo.lside = id;
    else if (act === 'pas') SR.growth.togglePas(lo.who, id);
    else if (act === 'view') lo.view = id;
    else if (act === 'rot') { SR.tree3d.turn(+id * 0.6); return; }
    else if (act === 'zoom') { SR.tree3d.zoomBy(+id); return; }
    else if (act === 'branch') { lo.branch = id; lo.sel = null; }
    else if (act === 'focus') SR.growth.setFocus(lo.who, id);
    else if (act === 'buy') { if (SR.growth.buy(id)) SR.sound.se('ok'); }
    else if (act === 'gexp') ['V', 'F', 'S', 'L'].forEach(function (w) { SR.growth.addExp(w, SR.growth.focus(w), 50); });
    else if (act === 'ggold') SR.growth.addGold(500);
    else if (act === 'gall') SR.growth.unlockAll();
    else if (act === 'uniq') SR.growth.toggleU(lo.who, id);
    else if (act === 'lev') SR.growth.toggleLinkEv(id);
    else if (act === 'lbond') SR.growth.addBond(id, 20);
    else if (act === 'era') SR.growth.setEra(+id);
    else if (act === 'greset') SR.growth.reset();
    else if (act === 'tpl') lo.set = SR.loadout.fromKit(id);
    SR.loadout.prune(lo.set); SR.loadout.save(lo.set); SR.loadout.apply(lo.set);
    var keep = nav.idx; drawLoadout(); nav.idx = keep; nav.paint();
  });
  $('title').addEventListener('toggle', function (ev) { if (ev.target.classList && ev.target.classList.contains('book')) lo.open = ev.target.open; }, true);
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
    drawDev();
    var en = SR.encounters[pick.enc]; if ($('encNote')) $('encNote').textContent = en ? en.name + '：' + en.note + '（技の書で覚えた技と、付けたパッシブで戦う）' : '';
    requestAnimationFrame(fitPage);
    drawLoadout();
    nav.refresh();
  }
  $('startBtn').onclick = start;
  // 開発用：育ちの数字（設定ページ）
  function drawDev() {
    var box = $('devBox'); if (!box) return;
    box.innerHTML = Object.keys(SR.growthDefaults).map(function (k) {
      var v = SR.growthCfg[k], d = SR.growthDefaults[k];
      return '<label class="devi"><span>' + SR.growthLabels[k] + (v !== d ? '<small>（はじめ ' + d + '）</small>' : '') + '</span>' +
        '<input type="number" step="' + (k === 'loseMul' ? '0.1' : '1') + '" min="0" data-dev="' + k + '" value="' + v + '"></label>';
    }).join('') + '<div class="row"><button class="btn mini" data-nav data-devreset>はじめの数字に戻す</button></div>';
  }
  $('title').addEventListener('change', function (ev) {
    var t = ev.target; if (!t.hasAttribute || !t.hasAttribute('data-dev')) return;
    SR.setGrowthCfg(t.getAttribute('data-dev'), parseFloat(t.value)); drawDev(); bookBadge();
  });
  $('title').addEventListener('click', function (ev) { if (ev.target.closest('[data-devreset]')) { SR.resetGrowthCfg(); drawDev(); } });
  // ---- ページは画面に収める（スクロールしない）。どうしても入らないときだけ少し縮め、それでも無理ならスクロール ----
  function fitPage() {
    var p = $('title').getAttribute('data-page'), pg = document.getElementById('pg-' + p); if (!pg) return;
    var b = pg.querySelector('.mbody'); if (!b) return;
    b.style.zoom = ''; b.classList.remove('scroll');
    if (p === 'help') paginateHelp();
    var need = b.scrollHeight, have = b.clientHeight;
    if (need > have + 2) {
      var z = Math.max(0.72, have / need); b.style.zoom = z;
      if (b.scrollHeight * z > b.clientHeight * z + 2 && z === 0.72) b.classList.add('scroll');
    }
  }
  // 遊び方：項目を、画面に入る分ずつのページに分ける
  var helpPage = 0;
  // 遊び方：アイコンの説明一覧（現象・状態・しるし）。絵は戦闘と同じもの
  function buildIconHelp(box) {   // box：戦闘中の説明の窓（ページに分けない）
    var ul = box || document.querySelector('#pg-help .rules'); if (!ul || ul.querySelector('.ichelp')) return;
    function row(icon, name, fx) { return '<div class="ic"><span class="ici">' + icon + '</span><b>' + name + '</b>' + (fx ? '<small>' + fx + '</small>' : '') + '</div>'; }
    var PH = { '炎': '燃やす', '雷': '電気を走らせる', '冷気': '冷やす・凍らせる', '光': 'まぶしい光', '衝撃': 'ぶつける力', '斬撃': '刀や剣で斬る', '貫通': '突き通す', '強撃': '重い一撃' };
    var MK = [['brk', 'ブレイク', '気力が0になって崩れた／技の札ではブレイクできる技'], ['push', 'あと一押し', '気力が1。ブレイクできる技で崩せる'], ['charge', '溜め', '次の番に大技が来る'], ['big', '大技', '強い攻撃が来る。ブレイクで止められる'],
      ['open', 'すき', '大技のあと。気力が削れやすい'], ['press', '重圧', '気力の回復が少なくなる'], ['shield', '防御', '受けるダメージが半分'], ['guard', '防護', 'ダメージを減らす守り'], ['kguard', '気力防護', '気力ダメージを減らす守り'],
      ['exposed', '無防備', '受けるダメージ2倍・回復を受けない'], ['ember', '燃え尽き', '次の番は動けない'], ['pray', '守りの祈り', '反動や無防備を打ち消す'], ['aim', '照準', '次の攻撃の気力削りが増える'],
      ['star', 'ねらい目', '弱点を突ける・よく効く・急所を突ける'], ['down', '効きにくい', 'この相手には体力ダメージが少ない'], ['all', '全体', '敵全体（味方全体）に届く'], ['unk', '弱点？', 'まだ弱点がわからない（調べるでわかる）']];
    // 1ページに4つずつ（スマホの横画面でも読める大きさのまま）
    var h = '';
    function group(title, rows) {
      var per = box ? 99 : 4;
      for (var i = 0; i < rows.length; i += per) {
        var n = Math.ceil(rows.length / per), part = n > 1 ? '（' + (i / per + 1) + '/' + n + '）' : '';
        h += '<li class="ichelp"><b>' + title + part + '</b><div class="icgrid">' + rows.slice(i, i + per).join('') + '</div></li>';
      }
    }
    group('アイコン：現象', Object.keys(PH).map(function (p) { return row(SR.phenIcon(p), p, PH[p]); }));
    group('アイコン：状態', SR.statusOrder.map(function (s) { return row(SR.statusIcon(s), SR.statuses[s].name, SR.statuses[s].fx); }));
    group('アイコン：しるし', MK.map(function (m) { return row(SR.markIcon(m[0], m[1]), m[1], m[2]); }));
    group('アイコン：枠の色', [row('<span class="badge b-weak icw">' + SR.statusIcon('burn') + '</span>', '赤い枠の状態', 'その敵の弱点。この状態にすると気力が大きく削れる'),
      row(SR.phenIcon('炎', 'kp'), '赤い輪の現象', 'その敵の急所。この現象の技で気力が多く削れる'),
      row('<span class="stexp">' + SR.statusIcon('burn') + '</span>', '金の枠の状態', 'その状態の相手に、威力が上がる技（技の札）')]);
    ul.insertAdjacentHTML('beforeend', h);
  }
  function paginateHelp() {
    var ul = document.querySelector('#pg-help .rules'); if (!ul) return;
    buildIconHelp();
    var items = Array.prototype.slice.call(ul.children), pager = document.getElementById('hpager');
    if (!pager) { pager = document.createElement('div'); pager.id = 'hpager'; pager.className = 'hpager'; ul.parentNode.insertBefore(pager, ul.nextSibling); }
    items.forEach(function (li) { li.style.display = ''; });
    if (!pager.innerHTML) pager.innerHTML = '<button class="btn mini">前へ</button><span class="small">1 / 1</span><button class="btn mini">次へ</button>';   // 高さを先に決める
    var room = ul.clientHeight - 12, pages = [[]], hsum = 0;
    var top0 = items.length ? items[0].offsetTop : 0;
    items.forEach(function (li) { var bottom = li.offsetTop + li.offsetHeight - top0; if (pages[pages.length - 1].length && bottom > room) { pages.push([]); top0 = li.offsetTop; } pages[pages.length - 1].push(li); });
    helpPage = Math.max(0, Math.min(helpPage, pages.length - 1));
    items.forEach(function (li) { li.style.display = pages[helpPage].indexOf(li) >= 0 ? '' : 'none'; });
    pager.innerHTML = '<button class="btn mini" data-nav data-help="-1"' + (helpPage ? '' : ' disabled') + '>前へ</button><span class="small">' + (helpPage + 1) + ' / ' + pages.length + '</span><button class="btn mini" data-nav data-help="1"' + (helpPage < pages.length - 1 ? '' : ' disabled') + '>次へ</button>';
  }
  $('title').addEventListener('click', function (ev) { var b = ev.target.closest('[data-help]'); if (!b || b.disabled) return; helpPage += +b.getAttribute('data-help'); paginateHelp(); nav.refresh(); });
  window.addEventListener('resize', function () { if (!$('title').classList.contains('hidden')) fitPage(); });
  // ---- メニュー画面：ページの切り替え ----
  // ---- 開発者設定：レベル・お金・スキルの経験値・親密度 ----
  var devTab = 'lv';
  function drawDevMenu() {
    var box = $('devMenu'); if (!box) return;
    var G = SR.growth, O = ['N', 'V', 'F', 'S', 'L'], SYS = SR.baseSystems, MAXE = Math.round(SR.cumExp(3));
    function face(id) { return '<span class="dvf"><img src="img/' + SR.img[id] + '_serious.jpg" alt=""></span><b class="dvn">' + SR.names[id] + '</b>'; }
    var h = '<div class="row dvtabs">' + [['lv', 'レベル'], ['gold', 'お金'], ['exp', 'スキルの経験値'], ['bond', '親密度（連携技）']].map(function (t) {
      return '<button class="btn mini' + (devTab === t[0] ? ' sel' : '') + '" data-nav data-dv="tab" data-id="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div><div class="dvbody">';
    if (devTab === 'lv') {
      h += O.map(function (id) {
        var i = SR.level.info(id);
        return '<div class="dvr">' + face(id) + '<span class="dvl">Lv</span><input type="number" min="1" max="' + SR.LV_MAX + '" value="' + i.lv + '" data-dvi="lv" data-id="' + id + '">' +
          '<button class="btn mini" data-nav data-dv="lv" data-id="' + id + '" data-v="-1">-1</button><button class="btn mini" data-nav data-dv="lv" data-id="' + id + '" data-v="1">+1</button><button class="btn mini" data-nav data-dv="lv" data-id="' + id + '" data-v="10">+10</button>' +
          '<button class="btn mini" data-nav data-dv="lvset" data-id="' + id + '" data-v="1">Lv1に</button><button class="btn mini" data-nav data-dv="lvset" data-id="' + id + '" data-v="' + SR.LV_MAX + '">最大</button>' +
          '<small>次のLvまで ' + (i.next ? i.next - i.cur : '－') + '</small></div>';
      }).join('') + '<div class="row"><button class="btn mini" data-nav data-dv="lvall" data-v="1">全員 Lv1 に</button><button class="btn mini" data-nav data-dv="lvall" data-v="10">全員 Lv10 に</button><button class="btn mini" data-nav data-dv="lvall" data-v="' + SR.LV_MAX + '">全員 最大に</button></div>';
    } else if (devTab === 'gold') {
      h += '<div class="dvr"><b class="dvn">お金</b><input type="number" min="0" value="' + G.gold() + '" data-dvi="gold" class="wide">' +
        ['-1000', '+100', '+1000', '+10000'].map(function (v) { return '<button class="btn mini" data-nav data-dv="gold" data-v="' + v + '">' + v + '</button>'; }).join('') + '<button class="btn mini" data-nav data-dv="goldset" data-v="0">0にする</button></div>' +
        '<div class="small dvnote">いまのゲームの中では、お金は一種類（金貨）で数えている。本文（第一巻）では大銅貨・大銀貨が使われていて、金貨は出てこない。両替の割合は本文に書かれていない。</div>';
    } else if (devTab === 'exp') {
      h += '<div class="dvgrid"><span></span>' + SYS.map(function (s) { return '<b class="dvh">' + s + '<small>本：' + SR.bookTier[G.books(s)] + '</small></b>'; }).join('') + '<span></span>';
      ['V', 'F', 'S', 'L'].forEach(function (id) {
        h += '<span class="dvw">' + face(id) + '</span>' + SYS.map(function (s) {
          var e = G.exp(id, s);
          return '<span class="dvc"><input type="number" min="0" max="' + MAXE + '" step="10" value="' + e + '" data-dvi="exp" data-id="' + id + '" data-s="' + s + '"><i class="dvbar"><s style="width:' + Math.min(100, e / MAXE * 100) + '%"></s></i></span>';
        }).join('') + '<span class="dvb"><button class="btn mini" data-nav data-dv="exp0" data-id="' + id + '">0</button><button class="btn mini" data-nav data-dv="expmax" data-id="' + id + '">最大</button></span>';
      });
      h += '<span class="dvw"><b class="dvn">本</b></span>' + SYS.map(function (s) {
        return '<span class="dvc dvbk">' + [1, 2, 3].map(function (t) { return '<button class="btn mini' + (G.books(s) === t ? ' sel' : '') + '" data-nav data-dv="book" data-s="' + s + '" data-v="' + t + '">' + SR.bookTier[t] + '</button>'; }).join('') + '</span>';
      }).join('') + '<span></span></div><div class="small dvnote">経験値の最大は ' + MAXE + '（上級の終わり）。本の段より上の経験値は、本を持つまで柱に色がつかない。</div>';
    } else {
      h += SR.LINK_MATES.map(function (c) {
        var ev = G.linkEv(c);
        return '<div class="dvr">' + face(c) + '<button class="btn mini' + (ev ? ' sel' : '') + '" data-nav data-dv="lev" data-id="' + c + '">' + (ev ? 'イベント済み' : 'イベントまだ') + '</button>' +
          '<span class="dvl">親密度</span><input type="number" min="0" max="' + (SR.bondLv[2] + 20) + '" step="10" value="' + G.bond(c) + '" data-dvi="bond" data-id="' + c + '"><span class="dvl">段' + G.bondLvOf(c) + '</span>' +
          '<button class="btn mini" data-nav data-dv="bondset" data-id="' + c + '" data-v="' + SR.bondLv[1] + '">段2に</button><button class="btn mini" data-nav data-dv="bondset" data-id="' + c + '" data-v="' + SR.bondLv[2] + '">段3に</button></div>';
      }).join('') + '<div class="small dvnote">連携技は終盤から。時期は技の書の上で変えられる（いま：' + SR.eraName[G.era()] + '）。</div>';
    }
    box.innerHTML = h + '</div>';
  }
  $('title').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-dv]'); if (!b) return;
    var a = b.getAttribute('data-dv'), id = b.getAttribute('data-id'), v = +b.getAttribute('data-v'), s = b.getAttribute('data-s'), G = SR.growth;
    if (a === 'tab') devTab = id;
    else if (a === 'lv') SR.level.setLv(id, SR.level.lv(id) + v);
    else if (a === 'lvset') SR.level.setLv(id, v);
    else if (a === 'lvall') ['N', 'V', 'F', 'S', 'L'].forEach(function (w) { SR.level.setLv(w, v); });
    else if (a === 'gold') G.setGold(G.gold() + v);
    else if (a === 'goldset') G.setGold(v);
    else if (a === 'exp0') SR.baseSystems.forEach(function (x) { G.setExp(id, x, 0); });
    else if (a === 'expmax') SR.baseSystems.forEach(function (x) { G.setExp(id, x, SR.cumExp(3)); });
    else if (a === 'book') G.setBook(s, v);
    else if (a === 'lev') G.toggleLinkEv(id);
    else if (a === 'bondset') G.setBond(id, v);
    SR.sound.se('tick'); drawDevMenu(); nav.refresh();
  });
  $('title').addEventListener('change', function (ev) {
    var t = ev.target; if (!t.hasAttribute || !t.hasAttribute('data-dvi')) return;
    var k = t.getAttribute('data-dvi'), id = t.getAttribute('data-id'), v = +t.value, G = SR.growth;
    if (k === 'lv') SR.level.setLv(id, v);
    else if (k === 'gold') G.setGold(v);
    else if (k === 'exp') G.setExp(id, t.getAttribute('data-s'), v);
    else if (k === 'bond') G.setBond(id, v);
    drawDevMenu(); nav.refresh();
  });
  // 今の育ち・装備で戦いを始めたときの仲間（メニューとステータスで使う）
  function partyNow() {
    var key = Object.keys(SR.encounters).find(function (k) { return !SR.encounters[k].random; });
    var T = new SR.Battle({ kit: pick.kit, encounter: key, tune: pick.tune, seed: 1 }), O = ['N', 'V', 'F', 'S', 'L'];
    return { T: T, list: T.heroes.slice().sort(function (a, b) { return O.indexOf(a.id) - O.indexOf(b.id); }) };
  }
  function lvBar(id) {
    var i = SR.level.info(id);
    return '<span class="lvb"><i style="width:' + (i.next ? Math.round(i.cur / i.next * 100) : 100) + '%"></i></span><small>' + (i.next ? '次のLvまで ' + (i.next - i.cur) : 'Lv最大') + '</small>';
  }
  // メニュー：左に仲間、右にコマンド
  function drawMenu() {
    var box = $('menuParty'); if (!box) return;
    var P; try { P = partyNow(); } catch (e) { box.innerHTML = ''; return; }
    box.innerHTML = P.list.map(function (u) {
      var front = u.pos < 3;
      return '<div class="rpm' + (front ? '' : ' res') + '"><div class="rpf"><img src="img/' + SR.img[u.id] + '_serious.jpg" alt=""></div>' +
        '<div class="rpn"><b>' + u.name + '</b><span>' + SR.uniqueName(u.id) + (front ? '' : '・控え') + '</span></div>' +
        '<div class="rpl"><em>Lv</em><b>' + (u.lv || 1) + '</b></div>' +
        '<div class="rpx">' + lvBar(u.id) + '</div>' +
        '<div class="rps"><span class="hp">体力 <b>' + Math.round(u.maxHp) + '</b></span><span class="k">気力 <b>' + Math.round(u.maxK) + '</b></span><span class="m">精神力 <b>' + Math.round(u.maxMp) + '</b></span></div></div>';
    }).join('');
    var G = SR.growth, info = $('menuInfo');
    if (info) info.innerHTML = '<div><span>金貨</span><b>' + G.gold() + '</b></div><div><span>時期</span><b>' + SR.eraName[G.era()] + '</b></div>';
  }
  // ステータス：今の育ち・装備で戦いを始めたときの数字を見せる
  function drawStatus() {
    var box = $('statusBox'); if (!box) return;
    var key = Object.keys(SR.encounters).find(function (k) { return !SR.encounters[k].random; });
    var T; try { T = new SR.Battle({ kit: pick.kit, encounter: key, tune: pick.tune, seed: 1 }); } catch (e) { box.innerHTML = '<div class="small">読み込めなかった</div>'; return; }
    var G = SR.growth;
    box.innerHTML = T.heroes.slice().sort(function (a, b) { return ['N', 'V', 'F', 'S', 'L'].indexOf(a.id) - ['N', 'V', 'F', 'S', 'L'].indexOf(b.id); }).map(function (u) {
      var w = SR.weapons[u.id], own = Object.keys(SR.skills).filter(function (s) { return SR.skills[s].owner === u.id; });
      var nU = own.filter(function (s) { return G.hasU(u.id, s); }).length;
      var nM = u.id === 'N' ? 0 : SR.ctree.filter(function (n) { return SR.skills[n.id] && G.has(u.id, n.id); }).length;
      var nL = u.id === 'N' ? Object.keys(SR.skills).filter(function (s) { return SR.isLink(s) && G.hasLink(s); }).length : 0;
      var pas = T.passivesOf(u).map(SR.skillName);
      return '<div class="stc"><div class="sf"><img src="img/' + SR.img[u.id] + '_serious.jpg" alt=""></div><div class="sn">' + u.name + '</div>' +
        '<div class="slv"><em>Lv</em><b>' + (u.lv || 1) + '</b></div><div class="sxp">' + lvBar(u.id) + '</div><div class="sw">' + (w ? w.name + '・' + w.phen : '') + '</div><div class="sk2">' + SR.uniqueName(u.id) + '</div>' +
        '<dl><dt class="hp">体力</dt><dd>' + Math.round(u.maxHp) + '</dd><dt class="k">気力</dt><dd>' + Math.round(u.maxK) + '</dd><dt class="m">精神力</dt><dd>' + Math.round(u.maxMp) + '</dd><dt>素早さ</dt><dd>' + Math.round(u.speed || 0) + '</dd></dl>' +
        '<div class="sp"><b>' + SR.uniqueName(u.id) + '</b> ' + nU + '／' + own.length + (u.id === 'N' ? '　<b>' + SR.LINK_NAME + '</b> ' + nL : '　<b>' + SR.COMMON_NAME + '</b> ' + nM) + '<br><b>パッシブ</b> ' + (pas.length ? pas.join('・') : 'なし') + '</div><button class="btn mini" data-nav data-lvup="' + u.id + '">Lv+1（試し）</button></div>';
    }).join('');
  }
  function goPage(p) {
    $('title').setAttribute('data-page', p); var pgEl = document.getElementById('pg-' + p); if (pgEl) pgEl.scrollTop = 0;
    try { sessionStorage.setItem('sr-page', p); } catch (e) {}
    if (p === 'book') drawLoadout();
    if (p === 'settings') drawDev();
    if (p === 'status') drawStatus();
    if (p === 'menu') drawMenu();
    if (p === 'dev') drawDevMenu();
    requestAnimationFrame(fitPage);
    lastMode = null; nav.refresh();
  }
  $('title').addEventListener('click', function (ev) { var b = ev.target.closest('[data-lvup]'); if (!b) return; SR.level.up(b.getAttribute('data-lvup')); SR.sound.se('ok'); drawStatus(); nav.refresh(); });
  $('title').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-page]'); if (b && b.tagName === 'BUTTON') { SR.sound.se(b.hasAttribute('data-back') ? 'back' : 'ok'); goPage(b.getAttribute('data-page')); return; }
    if (ev.target.closest('[data-start]')) start();
  });
  (function () {   // 夜空の星（星環は空を横切る緩い弧の帯。輪や円にはしない）
    var g = document.querySelector('#title .stars'), h = '', r = 7;
    function rnd() { r = (r * 16807) % 2147483647; return r / 2147483647; }
    for (var i = 0; i < 140; i++) h += '<circle cx="' + (rnd() * 1200).toFixed(1) + '" cy="' + (rnd() * 520).toFixed(1) + '" r="' + (rnd() * 1.4 + .3).toFixed(2) + '" opacity="' + (rnd() * .7 + .2).toFixed(2) + '"/>';
    if (g) g.innerHTML = h;
    var p0 = null; try { p0 = sessionStorage.getItem('sr-page'); } catch (e) {}
    if (p0 && document.getElementById('pg-' + p0)) $('title').setAttribute('data-page', p0);
  })();

  function start() {
    var encKey = pick.enc;
    if (encKey === 'random') { var keys = Object.keys(SR.encounters).filter(function (k) { return !SR.encounters[k].random; }); encKey = keys[Math.floor(Math.random() * keys.length)]; }
    B = new SR.Battle({ kit: pick.kit, encounter: encKey, tune: pick.tune, seed: (Date.now() & 0xffffffff) >>> 0 });
    $('title').classList.add('hidden'); $('battle').classList.remove('hidden');
    $('log').innerHTML = ''; lastCmds = null; prevBar = {};
    logLine(SR.encounters[encKey].name + '／' + SR.tunes[pick.tune].name, 's');
    SR.sound.playBgm(B.isBoss || SR.encounters[encKey].bgm === 'boss' ? 'boss' : 'normal');
    st.mode = 'intro'; st.actor = null; draw();
    var io = $('intro'), en = SR.encounters[encKey].name;
    if (io && $('battle').classList.contains('hd')) {
      io.innerHTML = '<div class="lb t"></div><div class="lb b"></div><div class="ln"></div><div class="nm"><small>ENCOUNTER</small><b>' + en + '</b></div><div class="go">BATTLE START</div><div class="fl"></div>';
      io.classList.remove('hidden'); void io.offsetWidth; io.classList.add('on'); $('battle').classList.add('intro-on');
      if (SR.stage3d && SR.stage3d.intro) SR.stage3d.intro(3);
      setTimeout(function () { if (SR.sound.se) SR.sound.se('boost'); }, 2000);
      setTimeout(function () { io.classList.add('hidden'); io.classList.remove('on'); $('battle').classList.remove('intro-on'); newTurn(); }, 3000);
    } else newTurn();
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
    var col = e.color || '#8b6cd9';
    var glow = e.glow || '#ffe08a';
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
    if (!B.weakKnown(e)) return '<span class="badge b-weak unk">？</span>';
    var ws = [e.weak].concat(e.weak2 ? [e.weak2] : []);
    return '<span class="badge b-weak" title="' + ws.map(function (s) { return SR.statuses[s].name; }).join('・') + 'で崩れやすい' + (e.weak2 ? '（片方で1.5倍・両方で2.5倍）' : '') + '">' + ws.map(function (s) { return SR.statusIcon(s); }).join('') + '</span>' +
      (e.kPhen ? Object.keys(e.kPhen).map(function (p) { return '<span class="badge b-weak" title="' + p + 'の技で気力が' + e.kPhen[p] + '倍削れる">' + p + '</span>'; }).join('') : '');
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
  // 下の帯用：ラベル・バー・数字を1行ずつ
  function hudBars(u, v) {
    var mh = v.maxHp || u.maxHp, base = u.baseMaxHp || mh, mp = v.mp === undefined ? u.mp : v.mp;
    var cut = base - mh >= 1 ? '<s class="cut" style="width:' + pct(base - mh, base) + '%"></s>' : '';
    return '<div class="hr hp"><em>HP</em><div class="bar">' + ghost(u.id + 'h', v.hp, base) + '<i style="width:' + pct(v.hp, base) + '%;background:' + hpColor(v.hp / mh) + '"></i>' + cut + '</div><span>' + Math.round(v.hp) + '</span></div>' +
      '<div class="hr kk"><em>気力</em><div class="bar k">' + ghost(u.id + 'k', v.k, u.maxK) + '<i style="width:' + pct(v.k, u.maxK) + '%"></i></div></div>' +
      '<div class="hr mm"><em>精神</em><div class="bar m">' + ghost(u.id + 'm', mp, u.maxMp) + '<i style="width:' + pct(mp, u.maxMp) + '%"></i></div></div>';
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
    var tl = '<span class="turn">' + B.t + '手目</span>';
    if (!B.outcome) {
      B.enemies.forEach(function (e) {
        if (e.hp <= 0) return;
        if (e.charge === 1) tl += '<span class="chip warn">' + e.name + '：溜め中（次の番に大技）</span>';
        if (e.charge === 2) tl += '<span class="chip warn hot">' + e.name + '：大技が来る！</span>';
      });
    }
    $('topline').innerHTML = tl;
    var can = pickableIds();
    var showOrder = !snap && ["idle", "menu", "list", "target", "swap1", "swap2"].indexOf(st.mode) >= 0;
    var ord = showOrder ? B.previewOrder(8) : (st.mode === "play" && playOrder ? playOrder : []), ordNo = {};
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
      else if (v.hp > 0 && v.k <= 1) tags += '<span class="badge b-hit">あと一押し</span>';
      if (e.brkN) tags += '<span class="badge b-hit" title="ブレイクした回数。最大気力-' + Math.round(B.tune.foeStack.k * e.brkN * 100) + '%・受けるダメージ+' + Math.round(B.tune.foeStack.dmg * e.brkN * 100) + '%">崩れ' + e.brkN + (e.brkN >= B.tune.foeStack.max ? '（最大）' : '') + '</span>';
      if (e.charge === 1 && !v.brk) tags += '<span class="badge b-charge">溜め</span>';
      if (e.charge === 2 && !v.brk) tags += '<span class="badge b-charge hot">大技</span>';
      Object.keys(e.aff || {}).forEach(function (s) { var m = e.aff[s]; if (m !== 1) tags += '<span class="badge b-sys' + (m > 1 ? ' good' : '') + '" title="' + s + 'の現象の体力ダメージ' + m + '倍">' + s + (m > 1 ? 'に弱い' : 'に強い') + '</span>'; });
      if (e.pressure > 0) tags += '<span class="badge b-buff">重圧</span>';
      if (e.openK > 0) tags += '<span class="badge b-hit">すき</span>';
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
      if (u.exposed > 0) tags += '<span class="badge b-charge">無防備</span>';
      if (u.exhausted) tags += '<span class="badge b-charge">燃え尽き</span>';
      if (u.ward > 0) tags += '<span class="badge b-buff">守りの祈り</span>';
      if (v.brk) tags += '<span class="badge b-brk">ブレイク</span>';
      else if (v.hp > 0 && v.k <= 1) tags += '<span class="badge b-hit">あと一押し</span>';
      if (u.aim > 0) tags += '<span class="badge b-buff">照準</span>';
      if (u.kProtect > 0) tags += '<span class="badge b-buff">気力防護</span>';
      if (u.protect > 0) tags += '<span class="badge b-buff">防護</span>';
      if (u.defend > 0) tags += '<span class="badge b-buff">防御</span>';
      tags += stIcons(v.st);
      if (B.boostCfg) tags += bpPips(v.bp !== undefined ? v.bp : u.bp, !snap && cmds[u.id] ? cmds[u.id].boost || 0 : 0);
      var role = '<span class="role r' + (res ? 3 : u.pos) + '">' + (res ? '控え' : ROLE[u.pos]) + '</span>';
      var cmdLine = '';
      if (!res && st.mode !== 'result') {
        if (u.hp <= 0) cmdLine = '<div class="cmd todo">倒れている</div>';
        else if (B.broken(u)) cmdLine = '<div class="cmd todo">ブレイク中</div>';
        else if (u === B.cur && st.mode !== 'play') cmdLine = '<div class="cmd done">いまの番</div>';
        else if (ordNo[u.id]) cmdLine = '<div class="cmd">' + (ordNo[u.id][0] - 1) + '番あと</div>';
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
    box.innerHTML = '<span class="ol">いま</span><div class="otrack">' + ord.map(function (o, i) {
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
      if (o.label.indexOf('ブレイク明け') === 0) tag = '休み';
      else if (o.label === '動けない') tag = '休み';
      var title = o.name + '：' + o.label;
      return '<div class="oc o-' + o.kind + (o.kind === 'enemy' && o.label === '大技' ? ' hotc' : o.kind === 'enemy' && o.label === '溜め' ? ' warmc' : '') + (i === 0 ? ' cur' : '') + '" title="' + title + '">' +
        '<div class="oi">' + icon + '</div>' + (tag ? '<span class="' + tcls + '">' + tag + '</span>' : '') + '</div>';
    }).join('') + '</div><span class="ol slow">あと</span>';
  }
  var playOrder = null, playActor = null;

  // ================= ログ =================
  function logLine(text, cls) {
    var d = document.createElement('div'); d.className = cls || ''; d.textContent = text;
    var lg = $('log'); lg.appendChild(d); lg.scrollTop = lg.scrollHeight;
  }

  // ================= ターン =================
  // アクティブカウント：番が来た人だけが動く。敵・控えの番は自動で進む。
  function newTurn() {
    if (B.outcome) return finishTurn();
    cmds = {};
    var evs = B.next();
    playOrder = B.previewOrder(8);
    if (B.skip || B.outcome) return play(evs.slice(), newTurn);
    if (B.curKind !== 'hero') { var all = B.autoAct(); return play(all.slice(), newTurn); }
    var go = function () { if (st.auto) { setAuto(B.cur); run(); } else { speed = 1; openMenu(B.cur); } };
    if (evs.length) play(evs.slice(), go); else go();
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
    else if (m === 'play') h = '<h3>' + (B.cur ? B.cur.name + 'の番' : '行動中') + '…</h3><div class="row"><button class="btn" data-nav data-act="fast">早送り</button>' +
      (st.auto ? '<button class="btn primary" data-nav data-act="autoOff">自動をやめる（次の味方の番で止まる）</button>' : '') + '</div>';
    else if (m === 'result') h = resultHTML();
    p.innerHTML = h;
    nav.refresh();
  }
  function supportLine() { return B.supportPlan && B.supportPlan.length ? '<div class="plan">' + B.supportPlan.join('　/　') + '</div>' : ''; }
  function commonButtons() {
    var s = B.swapped
      ? '<button class="btn" data-nav data-act="unswap">' + (B.swapped.front ? '並べ替え' : '交代') + 'を取り消す</button>'
      : '<button class="btn" data-nav data-act="swap"' + ((st.actor && B.heroes.some(function (v) { return B.canSwap(st.actor.id, v.id); }) ? '' : ' disabled')) + '>交代<span class="lg">・並べ替え</span></button>';
    return '<div class="row">' + s +
      '<button class="btn" data-nav data-act="auto">おまかせ<span class="lg">（この番）</span></button>' +
      '<button class="btn" data-nav data-act="autoOn">自動で進める</button></div>';
  }
  // いまの番の人
  function actorTabs() {
    var u = st.actor; if (!u) return '';
    return '<div class="atabs"><div class="atab on"><img src="img/' + SR.img[u.id] + '_serious.jpg" alt="">' +
      '<span><b>' + u.name + 'の番</b><small>精神力 ' + Math.round(u.mp) + '・気力 ' + Math.round(u.k) + '</small></span></div></div>';
  }
  // 気力がこの値以下になると、このターンのうちにブレイクされやすい
  function riskK() { return B.isBoss ? 40 : 15; }
  function costOf(u, id) { var o = B.options(u).find(function (x) { return x.id === id; }); return o ? o.cost || 0 : 0; }
  function warnHTML() {
    var w = [], u = st.actor;
    var ord = B.previewOrder(8), bi = ord.findIndex(function (o) { return o.label === '大技'; }), mine = ord.findIndex(function (o, i) { return i > 0 && u && o.id === u.id; });
    if (bi > 0) w.push(ord[bi].name + 'の大技が' + bi + '番あとに来る' + (mine < 0 || mine > bi ? '（' + (u ? u.name : '') + 'の次の番より先。防御するか、それまでにブレイクさせて止める）' : '（次の番でも間に合う）'));
    if (u && u.k <= riskK()) w.push(u.name + 'は気力が残り' + Math.max(0, Math.round(u.k)) + '（ブレイクの危険。防御か交代を）');
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
    var nU = opts.filter(function (o) { return SR.isSkill(o.id) && !SR.isCommon(o.id) && !SR.isLink(o.id); }).length, nC = opts.filter(function (o) { return SR.isSkill(o.id) && SR.isCommon(o.id); }).length, nL = opts.filter(function (o) { return SR.isLink(o.id); }).length;
    var defend = opts.find(function (o) { return o.id === 'defend'; });
    var scan = opts.find(function (o) { return o.id === 'scan'; });
    var h = actorTabs() + '<div class="phead">' + commonButtons() + '</div>' + warnHTML();
    h += boostRow(u);
    h += '<div class="menu4">' +
      '<button class="big t-atk" data-nav data-first data-act="skill" data-id="basic" data-tip="basic"' + (brave.ok ? '' : ' disabled') + '>ブレイブ攻撃<span class="c">' + (brave.cost ? '精神力' + brave.cost : '消費なし') + '</span><span class="d">気力を0にすればブレイク・' + SR.weapons[u.id].name + '（' + SR.weapons[u.id].phen + '）</span></button>' +
      '<button class="big t-uni" data-nav data-act="list" data-id="unique"' + (nU ? '' : ' disabled') + '>' + SR.uniqueName(u.id) + '<span class="c">' + nU + '</span><span class="d">' + SR.names[u.id] + 'だけの技</span></button>' +
      (u.id === 'N' ? '' : '<button class="big t-com" data-nav data-act="list" data-id="common"' + (nC ? '' : ' disabled') + '>' + SR.COMMON_NAME + '<span class="c">' + nC + '</span><span class="d">技の書で覚えた技</span></button>') +
      '<button class="big t-def" data-nav data-act="skill" data-id="defend" data-tip="defend"' + (defend.ok ? '' : ' disabled') + '>防御<span class="c">消費なし</span><span class="d">次の番まで受けるダメージ半分・次の番が早い</span></button>' +
      (scan ? '<button class="big" data-nav data-act="skill" data-id="scan" data-tip="scan"' + (scan.ok ? '' : ' disabled') + '>調べる<span class="c">' + (scan.cost ? '精神力' + scan.cost : '消費なし') + '</span><span class="d">敵の弱点が分かる</span></button>' : '') +
      '</div>';
    var pas = B.passivesOf(u);
    h += '<div class="hint">武器：' + SR.weapons[u.id].name + '（' + SR.weapons[u.id].note + '）</div>';
    if (pas.length) h += '<div class="hint">常時：' + pas.map(function (s) { return s + '（' + SR.passives[s][2] + '）'; }).join('　') + '</div>';
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
  // ================= 技の詳しい説明（カーソルを乗せる・長押し） =================
  // 戦闘中は、いまの番の人がその技を使ったときの見込みを敵ごとに出す（気力・体力・ブレイク・倒せるか）
  // 戦闘中の技の説明：文字を少なく、バーとアイコンで見せる
  function tipBattle(a, u, id) {
    var cost = B.price(u, id) || 0, ph = SR.attackPhen ? SR.attackPhen(u, a) : a.phen;
    var h = '<div class="tbh"><b>' + (a.label || a.id) + '</b><span class="tcost">' + cost + '</span></div><div class="tbi">';
    if (a.link) h += '<span class="tchip"><span class="lkf">' + a.with.map(function (c) { return '<img src="img/' + SR.img[c] + '_serious.jpg" alt="">'; }).join('') + '</span>' + (a.join ? '合わせ技' : '力を借りる') + '</span>';
    if (a.kind === 'attack') {
      h += '<span class="tchip">' + SR.markIcon(a.all || a.scatter ? 'all' : 'aim', '') + (a.all ? '全体' : a.scatter ? 'ばらまき' : '一体') + (a.hits ? ' ×' + a.hits : '') + '</span>';
      SR.phenList(ph).forEach(function (p) { h += '<span class="tchip">' + SR.phenIcon(p) + p + '</span>'; });
      if (a.brave) h += '<span class="tchip brk">' + SR.markIcon('brk', '') + 'ブレイク可</span>';
    }
    if (a.inflict) h += '<span class="tchip">' + SR.statusIcon(a.inflict[0]) + SR.statuses[a.inflict[0]].name + '+' + a.inflict[1] + '</span>';
    if (a.exploit) h += '<span class="tchip"><span class="stexp">' + SR.statusIcon(a.exploit[0]) + '</span>' + SR.statuses[a.exploit[0]].name + 'の相手に×' + a.exploit[1] + '</span>';
    if (a.form) h += '<span class="tchip">→' + SR.formNames[a.form] + '</span>';
    var wl = SR.weightLabel(a); if (wl !== '次の番ふつう') h += '<span class="tchip">' + wl.replace('次の番', '次') + '</span>';
    h += '</div>';
    if (a.kind === 'attack') {
      var hits = a.hits || 1;
      h += '<div class="tbm"><span>崩す</span><i><s style="width:' + Math.min(100, a.kd * hits / 70 * 100) + '%"></s></i></div>' +
        '<div class="tbm p"><span>威力</span><i><s style="width:' + Math.min(100, a.hp * hits / 132 * 100) + '%"></s></i></div>';
      var ex = [];
      if (a.finisher) ex.push('ブレイク中に×' + a.finisher);
      if (a.breakBonus) ex.push('ブレイクさせると×' + a.breakBonus);
      if (a.desperate) ex.push('気力が少ないほど強い');
      if (a.allK) ex.push('気力が多いほど強い');
      if (a.recoilTo) ex.push('反動：体力' + Math.round(a.recoilTo * 100) + '%に');
      if (a.teamRecoil) ex.push('反動：前線の体力半分');
      if (a.exhaust) ex.push('次は動けない');
      if (a.expose) ex.push('しばらく無防備');
      if (a.taunt) ex.push('攻撃を引きつける');
      if (a.antiSpell) ex.push('術の相手に崩す×2');
      if (ex.length) h += '<div class="tbx">' + ex.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>';
      var foes = B.living();
      h += '<div class="tbe">';
      foes.forEach(function (e) {
        var r = B.estimate(u.id, id, e.id); if (!r) return;
        var kd = a.scatter ? r.kd / foes.length : r.kd, dmg = Math.round(a.scatter ? r.dmg / foes.length : r.dmg);
        var k0 = r.kNow, k1 = Math.max(0, r.brk ? k0 : k0 - kd), mk = e.maxK || 100;
        var mark = (r.breaks && !a.scatter ? SR.markIcon('brk', 'ブレイクできる') : '') + (r.kills && !a.scatter ? '<span class="ko">KO</span>' : '') +
          (r.aff > 1 ? '<span class="up">▲</span>' : r.aff < 1 ? '<span class="dn">▼</span>' : '');
        h += '<div class="tr"><span class="en">' + e.name + '</span><span class="kb"><i style="width:' + (k1 / mk * 100) + '%"></i><em style="left:' + (k1 / mk * 100) + '%;width:' + ((k0 - k1) / mk * 100) + '%"></em></span><span class="dm">-' + dmg.toLocaleString() + '</span><span class="mk">' + mark + '</span></div>';
      });
      h += '</div>';
    } else h += '<div class="tbd">' + SR.describe(a) + '</div>';
    return h;
  }
  function tipHTML(id, who) {
    var a = SR.skills[id], P = SR.passives[id];
    if (!a && P) return '<b>' + SR.skillName(id) + '</b><span class="tk">パッシブ・コスト' + P[1] + '</span><div>' + P[2] + '</div>';
    if (!a) {
      var nd = SR.ctreeNode(id);
      return nd ? '<b>' + id + '</b><span class="tk">能力の星</span><div>' + nd.fx + '</div>' : '';
    }
    var inBattle = B && st.mode !== 'title' && !$('battle').classList.contains('hidden');
    var u = inBattle && st.actor && (!who || who === st.actor.id) ? st.actor : null;
    if (u && $('battle').classList.contains('hd')) return tipBattle(a, u, id);
    var wid = u ? u.id : who, cat = SR.typeLabel[SR.category(id)] || ({ light: '基本攻撃', brave: 'ブレイブ攻撃', defend: '防御', scan: '調べる' })[SR.category(id)] || '';
    var cost = u ? B.price(u, id) : a.cost;
    var h = '<b>' + (a.label || a.id) + '</b><span class="tk">' + cat + '・精神力' + (cost || 0) + '・' + SR.weightLabel(a) + '</span>';
    h += '<div>' + SR.describe(a) + '</div>';
    if (a.link) h += '<div class="tl">' + a.with.map(function (c) { return SR.names[c] + '（段' + a.need[c] + '）'; }).join('・') + 'と・' + (a.join ? '合わせ技' : '力を借りる') + '</div><div class="tl">' + (SR.growth.hasLink(id) ? '使える' : SR.growth.linkWhy(id)) + '</div>';
    var ph = wid && SR.attackPhen ? SR.attackPhen({ id: wid }, a) : a.phen;
    if (a.kind === 'attack' && ph && SR.phenText(ph) !== SR.phenText(a.phen)) h += '<div class="tl">現象：' + SR.phenText(ph) + (wid && SR.weapons[wid] && (a.id === 'basic' || a.id === 'light') ? '（' + SR.weapons[wid].name + '）' : '') + '</div>';
    if (a.inflict) h += '<div class="tl">付ける状態：' + SR.statuses[a.inflict[0]].name + '（' + a.inflict[1] + 'ターン）・' + SR.statuses[a.inflict[0]].fx + '</div>';
    if (a.exploit) h += '<div class="tl">活かす状態：' + SR.statuses[a.exploit[0]].name + 'の相手に威力' + a.exploit[1] + '倍</div>';
    if (u && a.kind === 'attack') {
      var foes = B.living();
      h += '<div class="tl">見込み（' + (a.all ? '敵全体に当たる' : a.scatter ? '敵にばらまく・一体あたり' : '選んだ一体に当たる') + '）</div><table class="est">';
      foes.forEach(function (e) {
        var r = B.estimate(u.id, id, e.id); if (!r) return;
        var kd = Math.round(a.scatter ? r.kd / foes.length : r.kd), dmg = Math.round(a.scatter ? r.dmg / foes.length : r.dmg);
        var notes = [];
        if (r.brk) notes.push('ブレイク中');
        else if (r.breaks && !a.scatter) notes.push('<em>ブレイクできる</em>');
        else if (!a.brave && r.kNow - kd <= 1) notes.push('あと一押しにできる');
        if (r.kills && !a.scatter) notes.push('<em>倒せる</em>');
        if (r.aff > 1) notes.push('よく効く'); else if (r.aff < 1) notes.push('効きにくい');
        if (e.weak && B.weakKnown(e) && a.inflict && (a.inflict[0] === e.weak || a.inflict[0] === e.weak2)) notes.push('弱点の状態を付けられる');
        h += '<tr><td>' + e.name + '</td><td>気力 ' + Math.round(r.kNow) + '→' + Math.max(0, Math.round(r.kNow - (r.brk ? 0 : kd))) + '</td><td>体力 -' + dmg.toLocaleString() + '</td><td>' + notes.join('・') + '</td></tr>';
      });
      h += '</table><div class="tl sm">見込みはおおよそ。暗闇で外れることや、ブーストは入っていない</div>';
    }
    if (u && (a.kind === 'heal')) h += '<div class="tl">回復量 ' + Math.round(a.amount * (SR.hpScale || 1)) + (a.allies ? '（前線全員）' : '') + '</div>';
    if (who && !u && SR.ctreeNode(id) && SR.growth) {
      var gw = SR.growth.has(who, id) ? '覚えた' : SR.growth.why(who, id);
      h += '<div class="tl">' + SR.names[who] + '：' + gw + '</div>';
    }
    return h;
  }
  var tipEl = document.createElement('div'); tipEl.id = 'tip'; tipEl.className = 'hidden'; document.body.appendChild(tipEl);
  var tipFor = null, tipTimer = 0, tipSuppress = false;
  function showTip(el) {
    var html = tipHTML(el.getAttribute('data-tip'), el.getAttribute('data-tipwho')); if (!html) return;
    tipEl.innerHTML = html; tipEl.classList.remove('hidden'); tipFor = el;
    var r = el.getBoundingClientRect(), tw = Math.min(420, window.innerWidth - 16); tipEl.style.width = tw + 'px';
    var th = tipEl.offsetHeight, x = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    var y = r.top - th - 8; if (y < 8) y = Math.min(window.innerHeight - th - 8, r.bottom + 8);
    tipEl.style.left = x + 'px'; tipEl.style.top = Math.max(8, y) + 'px';
    tipEl.classList.toggle('hdtip', !!el.closest('#battle.hd'));
    if (el.closest('#battle.hd')) {   // 戦闘中は、左の決まった場所に出す（押す所や敵をかくさない）
      var br = $('battle').getBoundingClientRect();
      tw = Math.min(420, Math.max(240, br.width * .38)); tipEl.style.width = tw + 'px';
      tipEl.style.left = (br.left + br.width * .016) + 'px'; tipEl.style.top = (br.top + br.height * .13) + 'px';
      tipEl.style.maxHeight = (br.height * .66) + 'px';
    } else tipEl.style.maxHeight = '';
  }
  function hideTip() { tipEl.classList.add('hidden'); tipFor = null; document.querySelectorAll('#battle .armed').forEach(function (x) { x.classList.remove('armed'); }); }
  document.addEventListener('pointerover', function (e) { if (e.pointerType !== 'mouse') return; var el = e.target.closest && e.target.closest('[data-tip]'); if (el && el !== tipFor) showTip(el); else if (!el && tipFor) hideTip(); });
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    var el = e.target.closest && e.target.closest('[data-tip]'); clearTimeout(tipTimer); if (!el) { hideTip(); return; }
    var sx = e.clientX, sy = e.clientY;
    tipTimer = setTimeout(function () { showTip(el); tipSuppress = true; }, 450);   // 長押しで出す（そのときは押したことにしない）
    function cancel(ev) { if (ev.type === 'pointermove' && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 10) return; clearTimeout(tipTimer); document.removeEventListener('pointermove', cancel); document.removeEventListener('pointerup', cancel); document.removeEventListener('pointercancel', cancel); if (ev.type !== 'pointermove' && tipFor) setTimeout(function () { if (!document.querySelector('#battle .armed')) hideTip(); }, 1600); }
    document.addEventListener('pointermove', cancel); document.addEventListener('pointerup', cancel); document.addEventListener('pointercancel', cancel);
  });
  document.addEventListener('click', function (e) { if (tipSuppress) { tipSuppress = false; e.stopPropagation(); e.preventDefault(); } }, true);
  // タッチでは、技は1回目で説明、2回目で繰り出す（マウスはカーソルを乗せれば説明が出るので1回で出す）
  var lastPtr = 'mouse';
  document.addEventListener('pointerdown', function (e) { lastPtr = e.pointerType || 'mouse'; }, true);
  document.addEventListener('keydown', function () { lastPtr = 'key'; }, true);
  document.addEventListener('click', function (e) {
    if (lastPtr !== 'touch' && lastPtr !== 'pen') return;
    var el = e.target.closest && e.target.closest('#battle [data-act="skill"][data-tip]');
    if (!el || el.disabled) return;
    if (tipFor !== el) {
      e.stopPropagation(); e.preventDefault();
      document.querySelectorAll('#battle .armed').forEach(function (x) { x.classList.remove('armed'); });
      showTip(el); el.classList.add('armed');
      if (SR.sound && SR.sound.se) SR.sound.se('ok');
    } else { hideTip(); }
  }, true);
  document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('[data-tip]')) e.preventDefault(); });
  function skillButton(o) {
    var a = o.skill, h = '<button class="sk' + catClass(o.id) + '" data-nav data-act="skill" data-id="' + o.id + '" data-tip="' + o.id + '"' + (o.ok ? '' : ' disabled') + '>';
    var nm = a.label || a.id;
    h += '<b' + (nm.length > 6 ? ' class="nlong"' : '') + '>' + nm + '</b><span class="c">' + (o.cost ? o.cost : '0') + '</span>';
    if (a.link) h += '<span class="lkf">' + a.with.map(function (c) { return '<img src="img/' + SR.img[c] + '_serious.jpg" alt="' + SR.names[c] + '">'; }).join('') + '</span>';
    var tags = SR.typeBadge(o.id), foes = B.living();
    if (B.statusOn && a.inflict && foes.some(function (e) { return (e.weak === a.inflict[0] || e.weak2 === a.inflict[0]) && B.weakKnown(e); })) tags = '<span class="badge b-hit">弱点を突ける</span>' + tags;
    if (B.statusOn && a.exploit && foes.some(function (e) { return e.st && e.st[a.exploit[0]] > 0; })) tags = '<span class="badge b-hit">今が狙い目</span>' + tags;
    if (a.brave) tags += '<span class="badge b-brk">ブレイク可</span>';
    if (a.all) tags += '<span class="badge b-form">全体</span>';
    if (a.hits) tags += '<span class="badge b-form">' + a.hits + '連撃</span>';
    var who = st.actor, ph = who ? SR.attackPhen(who, a) : a.phen, pc = who && who.id === 'S' && SR.phenList(ph).indexOf('貫通') >= 0;
    if (ph && a.kind === 'attack') { var ms = foes.map(function (e) { return SR.affMul(e, ph, pc); }), am = ms.length ? Math.max.apply(null, ms) : 1, an = ms.length ? Math.min.apply(null, ms) : 1; tags += '<span class="badge b-sys">' + SR.phenText(ph) + '</span>'; if (am > 1) tags = '<span class="badge b-hit">よく効く相手がいる</span>' + tags; else if (an < 1 && foes.length === 1) tags += '<span class="badge b-risk">効きにくい</span>'; if (foes.some(function (e) { return e.kPhen && SR.phenList(ph).some(function (p) { return e.kPhen[p]; }); })) tags = '<span class="badge b-hit">急所を突ける</span>' + tags; }
    if (a.form) tags += '<span class="badge b-form">→' + SR.formNames[a.form] + '</span>';
    var wl = SR.weightLabel(a); if (wl !== '次の番ふつう') tags += '<span class="badge ' + (SR.weight(a) < 1 ? 'b-buff' : 'b-charge') + '">' + wl + '</span>';
    var stx = (B.statusOn && a.inflict ? '<span class="stinf" title="' + SR.statuses[a.inflict[0]].name + 'を付ける">' + SR.statusIcon(a.inflict[0]) + '</span>' : '') +
      (B.statusOn && a.exploit ? '<span class="stexp" title="' + SR.statuses[a.exploit[0]].name + 'の相手に威力×' + a.exploit[1] + '">' + SR.statusIcon(a.exploit[0]) + '</span>' : '');
    if (tags || stx) h += '<div class="sktags">' + SR.iconizeTags(tags) + stx + '</div>';
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
    h = actorTabs() + '<div class="row" style="margin-top:0">' + (u.id === 'N' ? ['unique'].concat(opts.some(function (o) { return SR.isLink(o.id); }) ? ['link'] : []) : ['unique', 'common']).map(function (k) { return '<button class="btn' + (st.list === k ? ' sel' : '') + '" data-nav data-act="list" data-id="' + k + '">' + (k === 'unique' ? SR.uniqueName(u.id) : k === 'link' ? SR.LINK_NAME : SR.COMMON_NAME) + '</button>'; }).join('') + '</div>' + boostRow(u) +
      '<div class="row cattabs">' + [['all', '全部'], ['skillAtk', '攻撃'], ['skillDef', '守備'], ['skillSup', '回復・補助']].map(function (c) { return '<button class="btn' + ((st.cat || 'all') === c[0] ? ' sel' : '') + '" data-nav data-act="cat" data-id="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>';
    var rank = function (o) { return ['skillAtk', 'skillDef', 'skillSup'].indexOf(SR.category(o.id)); };
    var sk = opts.filter(function (o) { return SR.isSkill(o.id) && (!st.cat || st.cat === 'all' || SR.category(o.id) === st.cat); }).sort(function (a, b) { return rank(a) - rank(b); });
    var uni = sk.filter(function (o) { return !SR.isCommon(o.id) && !SR.isLink(o.id); }), com = sk.filter(function (o) { return SR.isCommon(o.id); }), lnk = sk.filter(function (o) { return SR.isLink(o.id); });
    if (st.list === 'link') { uni = []; com = []; } else lnk = [];
    if (lnk.length) h += '<div class="grp">' + SR.LINK_NAME + '</div><div class="list">' + lnk.map(skillButton).join('') + '</div>';
    if (st.list !== 'common' && uni.length) h += '<div class="grp">' + SR.uniqueName(u.id) + '</div><div class="list">' + uni.map(skillButton).join('') + '</div>';
    if (st.list !== 'unique' && com.length) h += '<div class="grp">' + SR.COMMON_NAME + '</div><div class="list">' + com.map(skillButton).join('') + '</div>';
    if (!(st.list === 'link' ? lnk : st.list === 'common' ? com : st.list === 'unique' ? uni : sk).length) h += '<div class="small">この種類の技はまだない。</div>';
    return h + '<div class="row"><button class="btn" data-nav data-back data-act="toMenu">戻る</button></div>';
  }
  function targetHTML() {
    var u = st.actor, a = SR.skills[st.skill], tk = B.targetKind(u, st.skill);
    var h = '<div class="tghead">' + (a.label || a.id) + '</div>' + (B.boostable(st.skill) ? boostRow(u) : '') + '<div class="who">';
    targetCands().forEach(function (v) {
      var extra = v.hero ? '' : (v.charge === 1 ? '・溜め中' : v.charge === 2 ? '・大技' : '') + (B.broken(v) ? '・ブレイク中' : '');
      h += '<button class="btn tgt" data-nav data-act="target" data-id="' + v.id + '"><span>' + v.name + '</span>' + (extra ? '<small>' + extra.replace(/^・/, '').replace(/・/g, ' ') + '</small>' : '') + '</button>';
    });
    return h + '</div><div class="row"><button class="btn" data-nav data-back data-act="toMenu">戻る</button></div>';
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
    return h + '</div><div class="hint">味方の番に1回、どちらか：<b>控えとの交代</b>（いまの番の人を下げると、入った人がこの番に動く）／<b>前線同士の並べ替え</b>（前衛ほど狙われやすい）。ブレイク中の人は動かせない。</div>' +
      '<div class="row"><button class="btn" data-nav data-back data-act="toMenu">やめる</button></div>';
  }
  function resultHTML() {
    var win = B.outcome === 'win', s = B.stat;
    if (B.bestNew === undefined) {
      B.bestNew = false;
      try { var best = JSON.parse(localStorage.getItem('sr-battle-best-v1')) || {}, key = B.enc.name; if ((s.maxHit || 0) > (best[key] || 0)) { B.bestNew = !!best[key] || s.maxHit > 0; best[key] = Math.round(s.maxHit); localStorage.setItem('sr-battle-best-v1', JSON.stringify(best)); } B.best = best[key] || 0; } catch (e) { B.best = 0; }
    }
    var mh = s.maxHit ? '<div class="maxhit">最大ダメージ <b>' + Math.round(s.maxHit).toLocaleString() + '</b>（' + s.maxHitBy + '）' + (B.bestNew ? '<span class="newbest">自己ベスト更新！</span>' : B.best ? '<span class="small">　自己ベスト ' + B.best.toLocaleString() + '</span>' : '') + '</div>' : '';
    return '<div class="result"><h2>' + (win ? '勝利' : '敗北') + '</h2>' + mh + (B.grown ? '<div class="growres">' + B.grown.learned.map(function (l) { return '<div class="lrn">' + l + '</div>'; }).join('') + B.grown.lines.map(function (l) { return '<div>経験値　' + l + '</div>'; }).join('') + (B.grown.gold ? '<div>金貨 +' + B.grown.gold + '</div>' : '') + '</div>' : '') +
      '<div>' + B.t + '手　ブレイク ' + s.breaks + '回' + (B.tune.charge ? '（大技を止めた ' + (s.stops || 0) + '回）' : '') +
      '　追撃 ' + s.chases + '回　反撃 ' + s.counters + '回　交代 ' + s.swaps + '回　並べ替え ' + (s.moves || 0) + '回　味方のブレイク ' + s.allyBreaks + '回</div>' +
      '<div class="row" style="justify-content:center"><button class="btn primary" data-nav data-act="again">もう一度</button>' +
      '<button class="btn" data-nav data-act="title">相手・構成を変える</button></div></div>';
  }

  // ================= 操作 =================
  function openMenu(u) { if (!u) return; st.actor = u; st.mode = 'menu'; st.list = null; st.skill = null; st.boost = cmds[u.id] ? cmds[u.id].boost || 0 : 0; draw(); }
  function boostFor(id) { return B.boostable(id) ? Math.min(st.boost || 0, st.actor.bp) : 0; }
  function nextActor() { run(); }
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
    if (sw.front) logLine(out.name + 'が' + ROLE[out.pos] + '、' + inn.name + 'が' + ROLE[inn.pos] + 'に並べ替え', 's');
    else logLine(out.name + 'が下がり、' + inn.name + 'が' + ROLE[inn.pos] + 'に入る' + (B.cur === inn ? '（この番は' + inn.name + 'が動く）' : ''), 's');
    openMenu(B.cur);
  }
  function unswap() {
    var sw = B.swapped, out = B.unit(sw.out);
    B.unswap();
    logLine(sw.front ? '並べ替えを取り消した' : '交代を取り消した（' + out.name + 'が戻る）', 's');
    openMenu(B.cur);
  }
  // 交代で支援の対象が変わり、気力が足りなくなったコマンドを外す
  function checkCosts() {
    Object.keys(cmds).forEach(function (id) {
      var u = B.unit(id);
      if (!B.available(u, cmds[id].skill)) { delete cmds[id]; logLine(u.name + 'のコマンドは精神力が足りなくなったので外した', 's'); }
    });
  }
  function setAuto(u) {
    var sw = B.smartSwap(u);
    if (sw && B.swap(u.id, sw.id)) { logLine(u.name + 'が下がり、' + sw.name + 'が' + ROLE[sw.pos] + 'に入る（おまかせ）', 's'); u = B.cur; }
    var r = B.autoPick(u); cmds[u.id] = { skill: r.skill, target: r.target ? r.target.id : null, boost: r.boost || 0 };
  }
  function cycleActor(dir) {
    var list = B.actors(); if (!list.length) return;
    var i = list.indexOf(st.actor);
    i = i < 0 ? 0 : (i + dir + list.length) % list.length;
    openMenu(list[i]);
  }
  function startSwap() { if (B.swapped) return unswap(); if (!st.actor) return; st.swapOut = st.actor.id; if (!swapInCands().length) return; st.mode = 'swap2'; draw(); }

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
    else if (act === 'cat') { st.cat = id; draw(); }
    else if (act === 'toIdle') { st.mode = 'idle'; st.actor = null; draw(); }
    else if (act === 'auto') { setAuto(st.actor); nextActor(); }
    else if (act === 'autoOn') { st.auto = true; setAuto(st.actor); run(); }
    else if (act === 'autoOff') { st.auto = false; draw(); }
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
    var u = B.cur; if (!u) return;
    var c = cmds[u.id] || { skill: B.available(u, 'basic') ? 'basic' : 'defend', target: null };
    playOrder = B.previewOrder(8);
    var sa0 = SR.skills[c.skill]; playCut = u.hero && sa0 && (sa0.kind === 'attack' || c.skill === 'basic') ? u.id : null;
    var start = B.events.length;
    B.act(c);
    play(B.events.slice(start), newTurn);
  }
  // 出来事を順に見せて、終わったら done
  function play(evs, done) {
    st.mode = 'play'; st.actor = null; playActor = null; draw();
    if (B.fxBest === undefined) { try { B.fxBest = (JSON.parse(localStorage.getItem('sr-battle-best-v1')) || {})[B.enc.name] || 0; } catch (e) { B.fxBest = 0; } B.fxTop = B.fxBest; }
    playMood = B.enemies.some(function (e) { return e.hp > 0 && e.charge === 2 && !B.broken(e); }) ? 2 : 0;
    var i = 0;
    var banner = $('banner');
    fxs = { aura: null, big: false, sum: 0, n: 0 };
    (function step() {
      if (i >= evs.length) playCut = null;
      if (i >= evs.length) { banner.classList.add('hidden'); playMood = null; if (B.outcome) finishTurn(); else done(); return; }
      var ev = evs[i++], f = ev.fx || {};
      banner.textContent = ev.text; banner.classList.remove('hidden');
      logLine(ev.text, ev.fx && ev.fx.enemy ? 'e' : ev.fx && ev.fx.broke ? 'b' : '');
      if (f.actor) { var ua = B.unit(f.actor), sa = f.skill && SR.skills[f.skill]; playCut = ua && ua.hero && sa && (sa.kind === 'attack' || f.skill === 'basic') ? f.actor : null; }
      if (f.actor) { playActor = f.actor; fxs.aura = f.boost ? { id: f.actor, n: Math.min(2, f.boost) } : null; fxs.big = !!f.big; fxs.sum = 0; fxs.n = 0; SR.fx.resetSlot(); }
      if (f.actor && bigDone) { playMood = 0; bigDone = false; }
      if (f.charge) playMood = 1; else if (f.big) { playMood = 2; bigDone = true; } else if (f.stop) playMood = 0;
      renderField(ev.snap);
      drawCutin();
      if (fxs.aura) { var ae = $('u-' + fxs.aura.id); if (ae) ae.classList.add('aura' + fxs.aura.n); }
      // この行動で、このあともう敵に当たらないなら合計を出す
      var last = true;
      for (var j = i; j < evs.length; j++) { var g = evs[j].fx; if (!g) continue; if (g.actor) break; if (g.dmg !== undefined && !g.statusTick && !B.unit(g.target).hero) { last = false; break; } }
      var extra = fx(ev, last);
      setTimeout(step, Math.max(ev.dur * speed, extra || 0));
    })();
  }
  var fxs = { aura: null, big: false, sum: 0, n: 0 }, playMood = null, bigDone = false;
  var playCut = null;   // 攻撃のあいだだけ、カットインを出したままにする
  var SIGNATURE = { '業火': 1, '灰燼': 1, '星落とし': 1, '決死の一閃': 1, '捨て身斬り': 1 };
  // 演出。長く見せたいときは、その長さ（ミリ秒）を返す
  function fx(ev, last) {
    var f = ev.fx; if (!f) return 0;
    var snd = SR.sound.se, F = SR.fx, hold = 0;
    var allDown = B.enemies.every(function (e) { return val(e, ev.snap).hp <= 0; });
    if (f.actor) {
      var ael = $('u-' + f.actor);
      if (SR.stage3d && SR.stage3d.cast && !f.charge) SR.stage3d.cast(f.actor);
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
      el.classList.add('shake'); if (SR.stage3d && SR.stage3d.hit) SR.stage3d.hit(f.target, f.broke || (f.down && !hero) ? 3 : f.dmg >= 700 || (hero && fxs.big) ? 2 : 1);
      if (!hero && !f.statusTick) F.slash(el, f.dmg >= 700 || f.broke);
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
    playOrder = null; playActor = null; st.auto = false;
    if (B.outcome) {
      SR.sound.fadeBgm(900); SR.sound.se(B.outcome === 'win' ? 'win' : 'lose'); st.mode = 'result'; logLine(B.outcome === 'win' ? '勝利！' : '全員倒れてしまった…', 't');
      if (!B.grown) {   // 経験値・重点・金貨（勝ちは全部、負けは半分）
        var G = SR.growth, GC = SR.growthCfg, mult = B.outcome === 'win' ? 1 : GC.loseMul, big = B.isBoss || B.enemies.some(function (e) { return e.type === 'twin'; });
        var before = {}, res = { lines: [], learned: [], gold: 0 };
        ['V', 'F', 'S', 'L'].forEach(function (w) { before[w] = SR.ctree.filter(function (n) { return G.has(w, n.id); }).map(function (n) { return n.id; }); });
        ['V', 'F', 'S', 'L'].forEach(function (w) {
          var lg = Object.assign({}, B.expLog[w] || {}), f = G.focus(w), parts = [];
          lg[f] = (lg[f] || 0) + (big ? GC.focusBoss : GC.focusNormal);
          Object.keys(lg).forEach(function (s) { var got = G.addExp(w, s, Math.round(lg[s] * mult)); if (got > 0) parts.push(s + '+' + got + (s === f ? '（重点）' : '')); });
          if (parts.length) res.lines.push(SR.names[w] + '：' + parts.join('　'));
          SR.ctree.forEach(function (n) { if (G.has(w, n.id) && before[w].indexOf(n.id) < 0) res.learned.push(SR.names[w] + 'は「' + SR.skillName(n.id) + '」を覚えた！'); });
        });
        if (B.outcome === 'win') { res.gold = big ? GC.goldBoss : GC.goldNormal; G.addGold(res.gold); }
        if (SR.level) {   // レベルの経験値（全員・控えも）
          var lx = Math.round((big ? SR.lvExp.boss : SR.lvExp.normal) * (B.outcome === 'win' ? 1 : SR.lvExp.loseMul));
          res.lines.unshift('レベル経験値　全員+' + lx);
          ['N', 'V', 'F', 'S', 'L'].forEach(function (w) { if (SR.level.add(w, lx)) res.learned.unshift(SR.names[w] + 'は Lv' + SR.level.lv(w) + ' になった！'); });
        }
        B.grown = res;
        res.lines.forEach(function (l) { logLine('経験値　' + l, 's'); });
        res.learned.forEach(function (l) { logLine(l, 's'); });
        if (res.gold) logLine('金貨+' + res.gold, 's');
      }
      draw(); return;
    }
    newTurn();
  }
  function snapshotAll() {
    return { heroes: B.heroes.map(function (u) { return Object.assign({}, u); }), enemies: B.enemies.map(function (e) { return Object.assign({}, e); }) };
  }

  // ================= 2026-11-21 HD-2D風の戦闘画面（ここで前の描き方を上書きする） =================
  // 3Dの舞台（stage3d.js）にキャラと敵の絵を立て、名札・行動順・カットイン・吹き出しを手前に重ねる。
  // 3Dが読み込めないときは、名札の中の絵がそのまま見える（has3d が付かない）。
  var stageKey = '';
  function stageReady() { return !!(SR.stage3d && SR.stage3d.setup); }
  SR.stage3dReady = function () { stageKey = ''; if (B && !$('battle').classList.contains('hidden')) draw(); };
  var lastPos = {};   // 名札の前の位置（作り直したときに、左上から飛んでこないように）
  function placeUnits() {
    if (!stageReady()) return;
    document.querySelectorAll('#battle .hdu').forEach(function (el) {
      var r = SR.stage3d.rect(el.id.slice(2)); if (!r) return;
      el.style.width = Math.max(10, r.w) + 'px'; el.style.height = Math.max(10, r.h) + 'px';
      el.style.left = Math.round(r.x - r.w / 2) + 'px'; el.style.top = Math.round(r.y) + 'px';   // transform は揺れなどの動きに使うので、位置は left/top
      lastPos[el.id] = [el.style.width, el.style.height, el.style.left, el.style.top];
    });
  }
  function syncStage(snap) {
    if (!stageReady()) return;
    var bt = $('battle'); bt.classList.add('has3d');
    var front = B.heroes.filter(function (u) { return u.pos < 3; }).sort(function (a, b) { return a.pos - b.pos; });
    var key = B.enemies.map(function (e) { return e.id; }).join(',') + '|' + front.map(function (u) { return u.id + u.pos; }).join(',');
    if (key !== stageKey) {
      stageKey = key;
      SR.stage3d.setup(B.enemies.map(function (e) {
        var big = B.isBoss || e.type === 'twin', small = e.type === 'pup';
        return { id: e.id, img: 'img/enemies/' + e.img + '.png', pixel: true, h: big ? 3.2 : small ? 1.5 : 2.2 };
      }).concat(front.map(function (u) { return { id: u.id, hero: true, pos: u.pos, img: 'img/' + SR.img[u.id] + '_stand.png?v=clean3', h: 2.45 }; })));
      SR.stage3d.onFrame(placeUnits);
      SR.stage3d.start();
    }
    var states = {}, can = pickableIds();
    B.enemies.concat(front).forEach(function (u) {
      var v = val(u, snap);
      states[u.id] = { down: v.hp <= 0, brk: v.brk, active: u === B.cur && st.mode !== 'play', target: st.mode === 'target' && can.indexOf(u.id) >= 0 };
    });
    SR.stage3d.sync(states);
    var cu = B.cur, sh = 'wide';
    if (st.mode === 'target') sh = 'target';
    else if (cu && cu.hero && ['menu', 'list', 'swap1', 'swap2'].indexOf(st.mode) >= 0) sh = 'party';
    else if (cu && st.mode === 'play') sh = cu.hero ? 'strike' : 'enemy';
    SR.stage3d.shot(sh, cu && cu.hero && st.mode !== 'play' ? cu.id : null);
    SR.stage3d.setCamMode(camMode);
  }

  function renderField(snap) {
    var tl = '<span class="turnx"><b>' + B.t + '</b><span>TURN</span></span>';
    if (!B.outcome) B.enemies.forEach(function (e) {
      if (e.hp <= 0) return;
      if (e.charge === 1) tl += '<span class="chip warn">' + e.name + '：溜め中</span>';
      if (e.charge === 2) tl += '<span class="chip warn hot">' + e.name + '：大技！</span>';
    });
    $('topline').innerHTML = tl;
    var can = pickableIds();
    var showOrder = !snap && ['idle', 'menu', 'list', 'target', 'swap1', 'swap2'].indexOf(st.mode) >= 0;
    var ord = showOrder ? B.previewOrder(8) : (st.mode === 'play' && playOrder ? playOrder : []);
    renderOrder(ord);
    SR.fx.mood(B.enemies.some(function (e) { var v = val(e, snap); return v.brk && v.hp > 0; }),
      B.outcome ? 0 : playMood !== null ? playMood : B.enemies.reduce(function (m, e) { return e.hp > 0 && !B.broken(e) ? Math.max(m, e.charge || 0) : m; }, 0));
    var tgtSkill = st.mode === 'target' && st.actor && SR.skills[st.skill] && SR.skills[st.skill].kind === 'attack' ? st.skill : null;
    var ea = $('enemyArea'); ea.innerHTML = '';
    B.enemies.forEach(function (e) {
      var v = val(e, snap), d = document.createElement('div');
      d.className = 'unit enemy hdu' + (v.hp <= 0 ? ' down' : '') + (v.brk ? ' brk' : '') + (e.charge && !v.brk && v.hp > 0 ? ' charging' : '');
      d.id = 'u-' + e.id;
      var tags = '';
      if (v.brk) tags += '<span class="badge b-brk">ブレイク</span>';
      else if (v.hp > 0 && v.k <= 1) tags += '<span class="badge b-hit">あと一押し</span>';
      if (e.brkN) tags += '<span class="badge b-hit">崩れ' + e.brkN + '</span>';
      if (e.charge === 1 && !v.brk) tags += '<span class="badge b-charge">溜め</span>';
      if (e.charge === 2 && !v.brk) tags += '<span class="badge b-charge hot">大技</span>';
      if (st.mode === 'target') Object.keys(e.aff || {}).forEach(function (s) { var m = e.aff[s]; if (m !== 1) tags += '<span class="badge b-sys' + (m > 1 ? ' good' : '') + '">' + s + (m > 1 ? 'に弱い' : 'に強い') + '</span>'; });   // 相性は、相手を選ぶときだけ
      if (e.pressure > 0) tags += '<span class="badge b-buff">重圧</span>';
      if (e.openK > 0) tags += '<span class="badge b-hit">すき</span>';
      tags += weakTag(e);
      var sti = stIcons(v.st), est = '';
      if (tgtSkill && v.hp > 0) {
        var r = B.estimate(st.actor.id, tgtSkill, e.id);
        if (r) est = '<div class="est">' + Math.round(r.kNow) + '→' + Math.max(0, Math.round(r.kNow - (r.brk ? 0 : r.kd))) + (r.breaks ? ' <b>BREAK</b>' : '') + '　-' + Math.round(r.dmg).toLocaleString() + (r.kills ? ' <b>KO</b>' : '') + (r.aff > 1 ? ' ▲' : r.aff < 1 ? ' ▼' : '') + '</div>';
      }
      d.innerHTML = '<div class="spr">' + beastSVG(e) + '</div><div class="lab"><span class="nm">' + e.name + '</span>' + (sti ? '<div class="sts">' + sti + '</div>' : '') + bars(e, v) + '<div class="tgs">' + SR.iconizeTags(tags) + '</div>' + est + '</div>';
      var lp = lastPos[d.id]; if (lp) { d.style.width = lp[0]; d.style.height = lp[1]; d.style.left = lp[2]; d.style.top = lp[3]; }
      if (can.indexOf(e.id) >= 0) { d.classList.add('pickable'); d.onclick = function () { onUnitClick(e.id); }; }
      ea.appendChild(d);
    });
    var pa = $('partyArea'), ra = $('reserveArea');
    pa.innerHTML = ''; ra.innerHTML = '';
    var hud = '';
    B.heroes.slice().sort(function (a, b) { return a.pos - b.pos; }).forEach(function (u) {
      var v = val(u, snap), res = u.pos >= 3, d = document.createElement('div');
      d.id = 'u-' + u.id;
      var tags = '';
      if (u.id === 'N') tags += '<span class="badge b-form">' + SR.formNames[v.form] + '</span>';
      if (u.exposed > 0) tags += '<span class="badge b-charge">無防備</span>';
      if (u.exhausted) tags += '<span class="badge b-charge">燃え尽き</span>';
      if (v.brk) tags += '<span class="badge b-brk">ブレイク</span>';
      else if (v.hp > 0 && v.k <= 1) tags += '<span class="badge b-hit">あと一押し</span>';
      if (u.kProtect > 0) tags += '<span class="badge b-buff">気力防護</span>';
      if (u.protect > 0) tags += '<span class="badge b-buff">防護</span>';
      if (u.defend > 0) tags += '<span class="badge b-buff">防御</span>';
      tags += stIcons(v.st);
      if (res) {
        d.className = 'unit reserve' + (v.hp <= 0 ? ' down' : '');
        d.innerHTML = '<div class="pic"><img class="fc" src="img/' + SR.img[u.id] + '_serious.jpg" alt=""></div><div><div class="nm">' + u.name + '</div>' + bars(u, v) + '</div>';
        ra.appendChild(d);
      } else {
        d.className = 'unit hero hdu' + (v.hp <= 0 ? ' down' : '') + (v.brk ? ' brk' : '');
        var lq = lastPos[d.id]; if (lq) { d.style.width = lq[0]; d.style.height = lq[1]; d.style.left = lq[2]; d.style.top = lq[3]; }
        d.innerHTML = '<div class="spr"><img class="st" src="img/' + SR.img[u.id] + '_stand.png?v=clean3" alt=""></div><div class="lab"><span class="nm">' + u.name + '</span>' + '<div class="tgs">' + SR.iconizeTags(tags) + '</div></div>';
        pa.appendChild(d);
        hud += '<div class="hc' + (st.actor === u ? ' cur' : '') + (v.hp <= 0 ? ' down' : '') + (v.brk ? ' brk' : '') + '"><div class="hf"><img src="img/' + SR.img[u.id] + '_serious.jpg" alt=""></div><div class="hb"><div class="hn"><span class="rl r' + u.pos + '">' + ROLE[u.pos].charAt(0) + '</span>' + u.name + '<span class="lvt">Lv' + (u.lv || 1) + '</span>' + (u.id === 'N' ? ' <span class="fm f-' + v.form + '">' + SR.formNames[v.form] + '</span>' : '') + '</div>' + hudBars(u, v) + '</div></div>';
      }
      if (can.indexOf(u.id) >= 0 && !(st.mode !== 'target' && st.mode.indexOf('swap') < 0 && st.actor === u)) { d.classList.add('pickable'); d.onclick = function () { onUnitClick(u.id); }; }
    });
    if ($('partyHud')) $('partyHud').innerHTML = hud;
    syncStage(snap);
    placeUnits();
    requestAnimationFrame(function () { document.querySelectorAll('#battle .ghost').forEach(function (g) { g.style.width = g.getAttribute('data-to') + '%'; }); placeUnits(); });
  }

  function renderOrder(ord) {
    var box = $('order');
    if (!ord.length) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.innerHTML = '<div class="otrack">' + ord.map(function (o, i) {
      var icon, tag = '', hot = false;
      if (o.kind === 'enemy') {
        icon = beastSVG(B.unit(o.id));
        if (o.label === '大技') { tag = '大技'; hot = true; } else if (o.label === '溜め') { tag = '溜め'; hot = true; }
      } else { icon = '<img src="img/' + SR.img[o.id] + '_serious.jpg" alt="">'; tag = o.kind === 'support' ? '支援' : ''; }
      if (o.label.indexOf('ブレイク明け') === 0 || o.label === '動けない') tag = '休み';
      return '<div class="oc o-' + o.kind + (i === 0 ? ' cur' : '') + '" style="opacity:' + Math.max(.4, 1 - i * .08).toFixed(2) + '" title="' + o.name + '：' + o.label + '"><div class="oi">' + icon + '</div>' + (tag ? '<span' + (hot ? ' class="hot"' : '') + '>' + tag + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  // 番のキャラのカットイン（大きな姿・名前の帯・バー）
  function drawCutin() {
    var c = $('cutin'), u = st.actor;
    if (!u && st.mode === 'play' && playCut) u = B.unit(playCut);
    var show = u && u.hero && ['menu', 'list', 'target', 'swap1', 'swap2', 'play'].indexOf(st.mode) >= 0;
    if (!show) { c.classList.add('hidden'); c.removeAttribute('data-who'); return; }
    var v = val(u), w = SR.weapons && SR.weapons[u.id], fav = SR.tree && SR.tree.start && SR.tree.start[u.id];
    var again = c.getAttribute('data-who') === u.id && !c.classList.contains('hidden');
    c.classList.remove('hidden'); c.setAttribute('data-who', u.id);
    var html = '<img src="img/' + SR.img[u.id] + '_stand.png?v=clean3" alt=""' + (again ? ' style="animation:none"' : '') + '><div class="band"></div><div class="cname">' + u.name + '</div>' + (u.id === 'N' ? '<div class="cform f-' + val(u).form + '">' + SR.formNames[val(u).form] + '</div>' : '') +
      '';
    c.innerHTML = html;
  }

  // カメラ：場面ごとに動く／全体で固定（ためし用の切りかえ）
  var camMode = 'auto';
  try { if (localStorage.getItem('sr_cam') === 'fixed') camMode = 'fixed'; } catch (e) {}
  (function () {
    var b = $('icoBtn'), o = $('icovl'); if (!b || !o) return;
    $('battle').appendChild(b); $('battle').appendChild(o);
    b.onclick = function (e) { e.stopPropagation(); buildIconHelp(o.querySelector('.iob')); o.classList.toggle('hidden'); SR.sound.se(o.classList.contains('hidden') ? 'back' : 'ok'); };
    o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('#icoClose')) { o.classList.add('hidden'); SR.sound.se('back'); } });
  })();
  (function () {
    var m = $('mnuBtn'); if (!m) return;
    $('battle').appendChild(m.parentNode);   // 帯や吹き出しより前に出す
    m.onclick = function (e) { e.stopPropagation(); m.parentNode.classList.toggle('open'); };
    document.addEventListener('click', function (e) { if (!m.parentNode.contains(e.target)) m.parentNode.classList.remove('open'); });
  })();
  (function () {
    var b = $('camBtn'); if (!b) return;
    function lbl() { b.textContent = 'カメラ ' + (camMode === 'fixed' ? '固定' : '動く'); }
    lbl();
    b.onclick = function () { camMode = camMode === 'fixed' ? 'auto' : 'fixed'; try { localStorage.setItem('sr_cam', camMode); } catch (e) {} lbl(); if (SR.stage3d) SR.stage3d.setCamMode(camMode); };
  })();

  // ブースト：宝石をタップして力をこめる（こめた数だけ光る）
  function boostRow(u) {
    if (!B.boostCfg) return '';
    var max = B.boostCfg.max, n = st.boost || 0, m = B.boostCfg.mult, g = '';
    for (var i = 1; i <= max; i++) {
      var stt = i <= n ? 'lit' : i <= u.bp ? 'full' : 'empty';
      g += '<button class="gem ' + stt + '" data-nav data-act="boost" data-id="' + (n >= i ? i - 1 : i) + '"' + (i > u.bp ? ' disabled' : '') + ' aria-label="ブースト' + i + '"><i></i></button>';
    }
    var eff = n ? '<b>×' + m[n] + '</b>' : '';
    return '<div class="bst lv' + n + '"><span class="bt">ブースト</span><span class="gems">' + g + '</span><span class="be">' + eff + '</span></div>';
  }

  // 交代：番の人だけが、控えと入れ替わるか、前線の中で場所を入れ替える
  function swapHTML() {
    var u = B.unit(st.swapOut), list = swapInCands();
    var h = '<div class="tghead">' + u.name + '（' + ROLE[u.pos] + '）と入れ替え</div><div class="who">';
    list.forEach(function (v) {
      h += '<button class="btn tgt swp" data-nav data-act="swapPick" data-id="' + v.id + '"><span>' + roleTag(v) + v.name + '</span></button>';
    });
    return h + '</div><div class="swnote">前衛ほど狙われやすい</div><div class="row"><button class="btn" data-nav data-back data-act="toMenu">やめる</button></div>';
  }

  // 吹き出しの選択肢（右はし）
  function menuHTML() {
    var u = st.actor, opts = B.options(u);
    var nU = opts.filter(function (o) { return SR.isSkill(o.id) && !SR.isCommon(o.id) && !SR.isLink(o.id); }).length, nC = opts.filter(function (o) { return SR.isSkill(o.id) && SR.isCommon(o.id); }).length, nL = opts.filter(function (o) { return SR.isLink(o.id); }).length;
    var brave = opts.find(function (o) { return o.id === 'basic'; }), defend = opts.find(function (o) { return o.id === 'defend'; }), scan = opts.find(function (o) { return o.id === 'scan'; });
    var sw = B.swapped ? '<button class="btn" data-nav data-act="unswap">' + (B.swapped.front ? '並べ替え' : '交代') + 'を取り消す</button>' : '<button class="btn" data-nav data-act="swap"' + (swapOutCands().length ? '' : ' disabled') + '>交代</button>';
    var h = '<div class="hdrow">' + sw + '<button class="btn" data-nav data-act="auto">おまかせ</button><button class="btn" data-nav data-act="autoOn">自動</button></div>';
    var ord = B.previewOrder(8), bi = ord.findIndex(function (o) { return o.label === '大技'; }), ws = [];
    if (bi > 0) ws.push('大技まで' + bi);
    if (u.k <= riskK()) ws.push('気力危険');
    if (ws.length) h += '<div class="hdwarn">' + ws.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>';
    h += boostRow(u);
    function bub(cls, act, id, title, sub, n, ok, first) {
      return '<button class="bub ' + cls + '" data-nav' + (first ? ' data-first' : '') + ' data-act="' + act + '" data-id="' + id + '"' + (act === 'skill' ? ' data-tip="' + id + '"' : '') + (ok ? '' : ' disabled') + '>' + (n !== null ? '<span class="n">' + n + '</span>' : '') + '<b>' + title + '</b><small>' + sub + '</small></button>';
    }
    h += '<div class="bubs">' +
      bub('atk', 'skill', 'basic', '攻撃', (st.boost ? (1 + st.boost) + '回攻撃・' : 'ブレイブ攻撃・') + (brave.cost ? '精神力' + brave.cost : '消費なし'), null, brave.ok, true) +
      bub('', 'list', 'unique', SR.uniqueName(u.id), SR.names[u.id] + 'だけの技', nU, nU > 0) +
      (u.id === 'N' ? (nL ? bub('lnk', 'list', 'link', SR.LINK_NAME, '仲間と出す技', nL, nL > 0) : '') : bub('', 'list', 'common', SR.COMMON_NAME, '技の書で覚えた魔法', nC, nC > 0)) +
      bub('', 'skill', 'defend', '防御', '次の番まで受けるダメージ半分', null, defend.ok) +
      (scan ? bub('', 'skill', 'scan', '調べる', '敵の弱点がわかる', null, scan.ok) : '') + '</div>';
    return h;
  }

  function draw(snap) {
    renderField(snap);
    drawCutin();
    $('battle').classList.toggle('res', st.mode === 'result'); $('battle').classList.toggle('m-list', st.mode === 'list'); $('battle').classList.toggle('m-target', st.mode === 'target'); $('battle').classList.toggle('m-swap', st.mode === 'swap1' || st.mode === 'swap2'); $('battle').setAttribute('data-boost', st.mode === 'menu' || st.mode === 'list' || st.mode === 'target' ? st.boost || 0 : 0);
    var p = $('panel'), h = '', m = st.mode;
    if (m === 'idle') h = idleHTML();
    else if (m === 'menu') h = menuHTML();
    else if (m === 'list') h = listHTML();
    else if (m === 'target') h = targetHTML();
    else if (m === 'swap1' || m === 'swap2') h = swapHTML();
    else if (m === 'play') h = '<div class="hdrow"><button class="btn" data-nav data-act="fast">早送り</button>' + (st.auto ? '<button class="btn" data-nav data-act="autoOff">自動をやめる</button>' : '') + '</div>';
    else if (m === 'result') h = resultHTML();
    p.innerHTML = h;
    nav.refresh();
  }
  // ================= キーボード・コントローラー =================
  var nav = {
    idx: 0,
    items: function () {
      var scope = st.mode === 'title' || $('battle').classList.contains('hidden') ? $('title') : $('panel');
      return Array.prototype.filter.call(scope.querySelectorAll('[data-nav]'), function (b) { return !b.disabled && b.offsetParent !== null; });
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
    back: function () { var b = st.mode === 'title' ? Array.prototype.find.call(document.querySelectorAll('#title .mpage [data-back]'), function (x) { return x.offsetParent !== null; }) : $('panel').querySelector('[data-back]'); if (b && b.offsetParent !== null) b.click(); },
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
    else if (name === 'start') { st.auto = true; setAuto(st.actor); run(); }
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
