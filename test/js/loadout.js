// 開始前の編成。
// 2026-11-21（先生の決定・キングダムハーツのAP制に近い形）：
//   技はコストなし。覚えた技は全部、戦闘で使える（コモン＝技の書のツリー、ユニーク＝サブクエスト・イベント）。
//   パッシブだけコストで付ける。上限は時期で増える（SR.passiveCap）。
// ナハトは自分の技とパッシブだけ。ほかの4人は自分の技・パッシブと共通の技。
var SR = window.SR || (window.SR = {});

SR.loadout = (function () {
  var KEY = 'sr-battle-loadout-v2';   // 中身はパッシブだけ
  var ids = ['N', 'V', 'F', 'S', 'L'];
  function apOf(s) { return SR.skills[s] ? SR.skills[s].ap : SR.passives[s] ? SR.passives[s][1] : 0; }
  function pool(id) {
    var act = Object.keys(SR.skills).filter(function (s) {
      var o = SR.skills[s].owner;
      return o === id || (id !== 'N' && o === 'common') || (id === 'N' && o === 'link');
    });
    var pas = Object.keys(SR.passives).filter(function (s) { return SR.passives[s][0] === id; });
    return { act: act, pas: pas };
  }
  function used(list) { return list.reduce(function (n, s) { return n + (SR.passives[s] ? apOf(s) : 0); }, 0); }
  function cap() { return SR.passiveCap[SR.growth.era()] || SR.passiveCap[1]; }
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && v.N) return v; } catch (e) {}
    return null;
  }
  function save(set) { try { localStorage.setItem(KEY, JSON.stringify(set)); } catch (e) {} }
  // お手本の構成から、パッシブだけを持ってくる
  function fromKit(k) { var o = {}; ids.forEach(function (id) { o[id] = SR.kits[k][id].filter(function (s) { return SR.passives[s]; }); }); return o; }
  // パッシブ以外を外し、上限を超えた分は後ろから外す
  function prune(set) {
    ids.forEach(function (id) {
      set[id] = (set[id] || []).filter(function (s) { return SR.passives[s] && SR.passives[s][0] === id && SR.canLearn(null, id, s); });
      while (used(set[id]) > cap()) set[id].pop();
    });
  }
  function learnedActs(id) { return pool(id).act.filter(function (s) { return SR.canLearn(null, id, s); }); }
  // 「自分で編成」＝覚えた技すべて＋付けたパッシブ
  function apply(set) {
    SR.kits.custom = { name: '自分で編成', mode: 'balanced', growth: true };   // 能力の星が効く
    ids.forEach(function (id) { SR.kits.custom[id] = learnedActs(id).concat(set[id]); });
  }
  var saved = load() || fromKit('standard');
  prune(saved);
  apply(saved);
  return { ids: ids, apOf: apOf, pool: pool, used: used, load: load, save: save, fromKit: fromKit, apply: apply, prune: prune, cap: cap, learnedActs: learnedActs };
})();
