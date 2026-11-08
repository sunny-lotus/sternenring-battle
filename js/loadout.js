// 開始前のスキル編成。試算モデルのルール：各キャラ装備コスト24まで。
// ナハトは自分の技とパッシブだけ。ほかの4人は自分の技・パッシブと共通の技。
var SR = window.SR || (window.SR = {});

SR.loadout = (function () {
  var KEY = 'sr-battle-loadout-v1';
  var ids = ['N', 'V', 'F', 'S', 'L'];
  function apOf(s) { return SR.skills[s] ? SR.skills[s].ap : SR.passives[s] ? SR.passives[s][1] : 0; }
  function pool(id) {
    var act = Object.keys(SR.skills).filter(function (s) {
      var o = SR.skills[s].owner;
      if (SR.statusSkill && SR.statusSkill[id] === s) return false; // 付与専用技は編成なしで使える
      return o === id || (id !== 'N' && o === 'common');
    });
    var pas = Object.keys(SR.passives).filter(function (s) { return SR.passives[s][0] === id; });
    return { act: act, pas: pas };
  }
  function used(list) { return list.reduce(function (n, s) { return n + apOf(s); }, 0); }
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && v.N) return v; } catch (e) {}
    return null;
  }
  function save(set) { try { localStorage.setItem(KEY, JSON.stringify(set)); } catch (e) {} }
  function fromKit(k) { var o = {}; ids.forEach(function (id) { o[id] = SR.kits[k][id].slice(); }); return o; }
  // 保存した編成を「自分で編成」構成として登録
  function apply(set) {
    SR.kits.custom = { name: '自分で編成', mode: 'balanced' };
    ids.forEach(function (id) { SR.kits.custom[id] = set[id].slice(); });
  }
  var saved = load();
  apply(saved || fromKit('standard'));
  return { ids: ids, apOf: apOf, pool: pool, used: used, load: load, save: save, fromKit: fromKit, apply: apply, cap: function () { return SR.C.ap; } };
})();
