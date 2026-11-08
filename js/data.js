// バトル試作のデータ。
// 出典：OneDrive/ドキュメント/ChatGPT/物語/outputs/sr-battle-sandbox/ の
// trio-trial.cjs・five-trial.cjs・normal-encounter-presets.json（2026-11-07 相談用の仮値）。
// 数値は未採用の仮値。本番ゲーム・原作の設定ではない。
var SR = window.SR || (window.SR = {});

SR.C = { maxK: 100, recovery: 26, ap: 24, maxRounds: 24 };

// 難しさ。sandbox は試算の数値そのまま。tense は試作で足した調整（試算からの変更）。
// atk: 敵の通常攻撃 [気力削り, 威力]。big: 溜めのあとの大技。
SR.tunes = {
  sandbox: { name: '試算どおり', note: '相談の試算と同じ数値。溜め攻撃なし', recovery: 26, charge: false,
    boss: { single: [18, 52], aoe: [23, 82] }, mob: { single: [10, 24], aoe: [12, 38] } },
  tense: { name: '緊張感あり', note: '敵が力を溜めて大技を撃つ。ブレイクで止められる。気力回復20', recovery: 20, charge: true, status: true,
    boss: { single: [20, 56], aoe: [24, 86], aoeAlways: [18, 60], big: [55, 120] }, mob: { single: [24, 60], aoe: [16, 48], big: [90, 170] } },
};

SR.names = { N: 'ナハト', V: 'ヴォルト', F: 'フレア', S: 'セレナ', L: 'リヒト' };
SR.img = { N: 'nacht', V: 'volt', F: 'flare', S: 'serena', L: 'licht' };
SR.formNames = { default: '通常', brave: 'ブレイブ', revenge: 'リベンジ', assault: 'アサルト' };

SR.skills = {};
function skill(id, owner, ap, cost, props) { SR.skills[id] = Object.assign({ id: id, owner: owner, ap: ap, cost: cost }, props); }
skill('basic', 'all', 0, 8, { kind: 'attack', kd: 16, hp: 24, brave: true, label: '基本ブレイブ' });
skill('wait', 'all', 0, 0, { kind: 'wait', label: '待機' });
// 見やすさ版で足したコマンド（試算にはない。数値は仮）
skill('light', 'all', 0, 4, { kind: 'attack', kd: 12, hp: 28, label: '基本攻撃' });
skill('defend', 'all', 0, 0, { kind: 'defend', label: '防御' });
SR.defendRate = 0.5;
skill('崩し斬り', 'N', 4, 18, { kind: 'attack', kd: 30, hp: 32, form: 'brave' });
skill('かばう', 'N', 4, 14, { kind: 'cover', form: 'revenge' });
skill('踏み込み斬り', 'N', 4, 24, { kind: 'attack', kd: 10, hp: 90, form: 'assault' });
skill('返し斬り', 'N', 3, 16, { kind: 'attack', kd: 20, hp: 38, form: 'revenge' });
skill('誘い斬り', 'N', 4, 18, { kind: 'attack', kd: 22, hp: 38, form: 'revenge', taunt: true });
skill('断ち込み', 'N', 6, 30, { kind: 'attack', kd: 8, hp: 100, form: 'assault', finisher: 1.65 });
skill('見切りの構え', 'N', 4, 10, { kind: 'guard', form: 'revenge' });
skill('捨て身斬り', 'N', 7, 46, { kind: 'attack', kd: 8, hp: 132, form: 'assault', desperate: true });
skill('連射', 'V', 5, 24, { kind: 'attack', kd: 14, hp: 16, hits: 3 });
skill('解析', 'V', 3, 8, { kind: 'analyze' });
skill('導機照準', 'V', 4, 14, { kind: 'aim' });
skill('術式妨害', 'V', 5, 25, { kind: 'attack', kd: 28, hp: 25, antiSpell: true });
skill('分散連射', 'V', 6, 30, { kind: 'attack', kd: 12, hp: 15, hits: 6, scatter: true });
skill('火槍', 'F', 4, 24, { kind: 'attack', kd: 38, hp: 45, brave: true, fire: true });
skill('火の粉', 'F', 4, 22, { kind: 'attack', kd: 18, hp: 15, all: true, fire: true });
skill('炎撃', 'F', 5, 32, { kind: 'attack', kd: 10, hp: 108, fire: true });
skill('集中火力', 'F', 5, 40, { kind: 'attack', kd: 66, hp: 55, brave: true, fire: true });
skill('炎圧', 'F', 6, 34, { kind: 'attack', kd: 32, hp: 22, all: true, fire: true });
skill('収束火槍', 'F', 6, 32, { kind: 'attack', kd: 20, hp: 76, brave: true, fire: true, breakBonus: 1.5 });
skill('灰燼', 'F', 7, 44, { kind: 'attack', kd: 8, hp: 65, all: true, fire: true, finisher: 1.7 });
skill('小回復', 'common', 3, 14, { kind: 'heal', amount: 95 });
skill('中回復', 'common', 4, 25, { kind: 'heal', amount: 180 });
skill('気力支援', 'common', 4, 22, { kind: 'energy', amount: 32 });
skill('防護', 'common', 3, 14, { kind: 'protect' });
skill('気力防護', 'common', 4, 16, { kind: 'kProtect' });
skill('気力障壁', 'common', 4, 16, { kind: 'kBarrier' });
skill('衝撃', 'common', 3, 18, { kind: 'attack', kd: 32, hp: 12 });
skill('重圧', 'common', 4, 16, { kind: 'pressure' });
skill('加速', 'common', 4, 14, { kind: 'haste' });
skill('連環回復', 'common', 5, 28, { kind: 'heal', amount: 74, allies: true });
skill('衝撃波', 'common', 5, 30, { kind: 'attack', kd: 22, hp: 10, all: true });
skill('集中付与', 'common', 4, 14, { kind: 'power' });
skill('連弾', 'S', 5, 22, { kind: 'attack', kd: 12, hp: 14, hits: 3 });
skill('深癒', 'S', 6, 30, { kind: 'heal', amount: 300 });
skill('癒しの波', 'S', 7, 40, { kind: 'heal', amount: 150, allies: true });
skill('破陣剣', 'L', 5, 30, { kind: 'attack', kd: 52, hp: 52, brave: true });
skill('守勢の号令', 'L', 6, 28, { kind: 'teamKProtect' });
skill('決着の一閃', 'L', 6, 32, { kind: 'attack', kd: 10, hp: 90, finisher: 1.65 });

// ---- 状態付与（2026-11-08 相談で決定。効果は小さめ・数値は仮） ----
// 状態そのものは気力に関わらない。目的はコンボ（活かす技）と、敵ごとの弱点で気力を崩しやすくすること。
SR.statuses = {
  burn: { name: '燃焼', color: '#ff7a3a', fx: 'ターンの終わりに最大体力の3%が減る' },
  bleed: { name: '裂傷', color: '#e05a6a', fx: '行動するたびに最大体力の2%が減る' },
  freeze: { name: '凍結', color: '#7fd4ff', fx: '受けるダメージが1割増える' },
  daze: { name: '目眩', color: '#ffe27a', fx: '与えるダメージが1割減る' },
  shock: { name: '感電', color: '#c9a4ff', fx: '行動が遅くなる' },
  blind: { name: '暗闇', color: '#9aa0c8', fx: '攻撃が1割の確率で外れる' },
};
SR.statusOrder = ['burn', 'bleed', 'freeze', 'daze', 'shock', 'blind'];
SR.statusMax = 6;
SR.statusFx = { burn: 0.03, bleed: 0.02, freeze: 1.1, daze: 0.9, shock: 12, blind: 0.1, weakK: 1.5,
  cap: { '燃焼': 18, '裂傷が開いた': 12 } }; // 体力の多いボスで強くなりすぎないよう、1回の上限
// 技が付ける状態 [状態, ターン数] と、活かす状態 [状態, 倍率]
(function () {
  function s(id, inflict, exploit) { var a = SR.skills[id]; if (inflict) a.inflict = inflict; if (exploit) a.exploit = exploit; }
  // 2026-11-08「付与が多すぎる」→ 付けるのは各キャラの付与専用技（下の SR.statusSkill）だけ。
  // 今ある技は付与なし。活かす技（〇〇中に〜倍）は残す。例外：コモンの衝撃で暗闇。
  s('断ち込み', null, ['bleed', 1.6]); s('捨て身斬り', null, ['freeze', 1.6]);
  s('連射', null, ['shock', 1.5]);
  s('炎撃', null, ['burn', 1.6]); s('灰燼', null, ['burn', 1.7]);
  s('決着の一閃', null, ['daze', 1.6]);
  s('衝撃', ['blind', 2]);
  // 付与専用技（試作で追加・数値は仮）。緊張感ありのとき、編成コストなしで各キャラが使える
  skill('裂き払い', 'N', 0, 12, { kind: 'attack', kd: 10, hp: 22, inflict: ['bleed', 3] });
  skill('放電弾', 'V', 0, 14, { kind: 'attack', kd: 12, hp: 16, inflict: ['shock', 3] });
  skill('焼き付け', 'F', 0, 14, { kind: 'attack', kd: 8, hp: 18, fire: true, inflict: ['burn', 4] });
  skill('氷結弾', 'S', 0, 14, { kind: 'attack', kd: 10, hp: 16, inflict: ['freeze', 3] });
  skill('閃光', 'L', 0, 14, { kind: 'attack', kd: 8, hp: 14, inflict: ['daze', 3] });
  SR.statusSkill = { N: '裂き払い', V: '放電弾', F: '焼き付け', S: '氷結弾', L: '閃光' };
})();

SR.passives = {
  '追撃の冴え': ['N', 5, '無料追撃の威力が上がる（36→64）'],
  '追撃の極意': ['N', 9, '無料追撃が1ターンに2回まで'],
  '返し崩し': ['N', 8, '無料反撃で相手をブレイクできる'],
  '反攻の冴え': ['N', 6, '無料反撃の威力が上がる（34→62）'],
  '勝機の一閃': ['N', 5, '追撃でブレイクさせると次の技の消費が3割引'],
  '連撃調整': ['V', 6, '連撃の気力削り1.3倍、消費1.25倍'],
  '照準共有': ['V', 5, '導機照準を仲間にもかけられる'],
  '蓄積照準': ['V', 6, '同じ相手への連撃ほど気力削りが増える'],
  '急所観測': ['V', 5, '解析した相手への気力削り1.2倍'],
  '照準維持': ['V', 7, '照準が2回分続く'],
  '連撃継続': ['V', 7, '連撃中にブレイクさせた相手へ威力1.5倍'],
  '残り火': ['F', 5, '炎撃を当てた相手の気力回復を抑える'],
  '過熱': ['F', 7, '炎の威力1.4倍、消費1.25倍'],
  '火勢': ['F', 5, '炎技を続けるほど威力が上がる'],
  '残熱回収': ['F', 3, 'ブレイクさせると気力12回復'],
};

// 持ち込み構成（five-trial.cjs の kits）
SR.kits = {
  standard: { name: '標準', mode: 'balanced',
    N: ['崩し斬り', 'かばう', '断ち込み', '返し斬り', '追撃の冴え'],
    V: ['連射', '導機照準', '照準共有', '中回復', '気力支援'],
    F: ['火槍', '炎撃', '炎圧', '中回復', '気力支援'],
    S: ['連弾', '深癒', '癒しの波', '気力支援'],
    L: ['破陣剣', '守勢の号令', '決着の一閃', '中回復'] },
  counter: { name: '反撃', mode: 'counter',
    N: ['誘い斬り', 'かばう', '返し崩し', '反攻の冴え'],
    V: ['連射', '中回復', '気力防護', '気力支援', '重圧'],
    F: ['火槍', '炎撃', '中回復', '気力防護', '気力支援'],
    S: ['連弾', '深癒', '癒しの波', '気力支援'],
    L: ['破陣剣', '守勢の号令', '決着の一閃', '中回復'] },
  chase: { name: '追撃', mode: 'chase',
    N: ['崩し斬り', '断ち込み', '追撃の冴え', '追撃の極意'],
    V: ['連射', '蓄積照準', '連撃継続', '中回復'],
    F: ['炎圧', '火槍', '炎撃', '気力支援', '中回復'],
    S: ['連弾', '深癒', '癒しの波', '気力支援'],
    L: ['破陣剣', '守勢の号令', '決着の一閃', '中回復'] },
};

// 支援プリセット（five-trial の仮設定）
SR.supportText = {
  N: '気力の少ない前線一人の体力被ダメージを4%軽減（気力8）',
  V: '気力の少ない前線一人の、そのターンの技消費を2軽減（気力8）',
  F: '気力の少ない前線一人の、そのターンの体力への攻撃を4%強化（気力8）',
  S: '前線で体力の最も少ない一人を20回復（気力10）',
  L: '気力の少ない前線一人への、攻撃一発の気力ダメージを2軽減（気力8）',
};

// 敵の種類（試作で追加。数値は仮）。fire は炎の効き方（1より小さいと炎に強い）。atk は攻撃の強さの倍率。
SR.enemyTypes = {
  shell: { img: 'enemy028', name: '甲殻獣', hp: 230, k: 95, regen: 14, speed: 40, brave: false, fire: 1, atk: 0.8, color: '#7d8fa3', glow: '#d8f0ff', tags: ['硬い'], weak: 'shock' },
  beast: { img: 'enemy002', name: '星獣', hp: 150, k: 45, regen: 12, speed: 58, brave: true, fire: 1, atk: 1, color: '#8b6cd9', glow: '#ffe08a', tags: [], weak: 'bleed' },
  swift: { img: 'enemy022', name: '疾風獣', hp: 110, k: 35, regen: 12, speed: 88, brave: true, fire: 1.2, atk: 0.75, color: '#3fb39b', glow: '#e6fff4', tags: ['すばやい'], weak: 'freeze', inflict: ['bleed', 2] },
  ember: { img: 'enemy023', name: '炎獣', hp: 170, k: 50, regen: 12, speed: 56, brave: true, fire: 0.5, atk: 1.1, color: '#d9603a', glow: '#ffd27a', tags: [], weak: 'freeze', inflict: ['burn', 2] },
  frost: { img: 'enemy044e', name: '氷獣', hp: 170, k: 50, regen: 12, speed: 50, brave: true, fire: 1.6, atk: 1, color: '#6fb6e8', glow: '#ffffff', tags: [], weak: 'burn', inflict: ['freeze', 2] },
  caster: { img: 'enemy025', name: '術士', hp: 120, k: 60, regen: 16, speed: 66, brave: false, fire: 1, atk: 0.75, spell: true, aoeAll: true, color: '#b05ce0', glow: '#ffb8ff', tags: ['毎ターン全体攻撃', '術式妨害が効く'], weak: 'daze', inflict: ['blind', 1] },
  healer: { img: 'enemy008', name: '癒し手', hp: 130, k: 50, regen: 12, speed: 48, brave: false, fire: 1, atk: 0.7, heal: 60, color: '#4fae6a', glow: '#eaffd8', tags: ['仲間を回復'], weak: 'bleed' },
  pup: { img: 'enemy034', imgs: ['enemy034', 'enemy034a', 'enemy034b', 'enemy034', 'enemy034a'], name: '子獣', hp: 70, k: 25, regen: 8, speed: 62, brave: false, fire: 1, atk: 0.55, noCharge: true, color: '#a58ad9', glow: '#fff3b0', tags: [], weak: 'burn' },
  twin: { img: 'enemy044', imgs: ['enemy044', 'enemy044c'], name: '双子の大獣', hp: 600, k: 120, regen: 16, speed: 60, brave: true, fire: 1, atk: 1.0, color: '#5a4aa8', glow: '#ff9a7a', tags: [], weak: 'daze', inflict: ['bleed', 1] },
};

// 相手（five-trial の encounters と normal-encounter-presets.json の五人期通常戦）
SR.encounters = {
  normal: { imgs: ['enemy002a', 'enemy002', 'enemy002b'], weaks: ['burn', 'bleed', 'shock'], name: '通常戦（敵三体）', note: '五人期の調整候補：各HP150・気力45。目安3〜5ターン', engine: '集団',
    config: { hp: 150, maxHp: 150, k: 45, maxK: 45, regen: 12 } },
  boss: { img: 'boss004', name: '加入期ボス', note: 'HP1450・気力240。3ターンごとに全体攻撃', engine: '単体ボス', config: { weak: 'daze' } },
  aoe: { img: 'boss002', name: '全体攻撃ボス', note: 'HP1600・気力260。毎ターン全体攻撃の耐久戦', engine: '単体ボス',
    config: { hp: 1600, maxHp: 1600, k: 260, maxK: 260, alwaysAoe: true, weak: 'freeze' } },
  fireResist: { img: 'enemy044d', name: '炎耐性ボス', note: '炎の効果が0.55倍。フレア以外で崩す', engine: '炎耐性ボス', config: { weak: 'freeze' } },
  // ここから試作で追加した戦い（数値は仮）
  shellSwift: { name: '甲殻と疾風', note: '硬い甲殻獣と、前衛より先に動く疾風獣', engine: '集団', config: {}, party: ['shell', 'beast', 'swift'] },
  casters: { name: '術士の一団', note: '毎ターン全体攻撃の術士と、仲間を治す癒し手。どちらから倒す？', engine: '集団', config: {}, party: ['caster', 'healer', 'beast'] },
  elements: { name: '炎と氷', note: '炎に強い炎獣と、炎に弱い氷獣', engine: '集団', config: {}, party: ['ember', 'frost', 'ember'] },
  swarm: { name: '子獣の群れ', note: '弱いが5体。全体技の出番', engine: '集団', config: {}, party: ['pup', 'pup', 'pup', 'pup', 'pup'] },
  twins: { name: '双子の大獣', note: 'ボス級が2体。溜めの時期がずれる', engine: '集団', config: {}, party: ['twin', 'twin'], bgm: 'boss' },
  random: { name: 'おまかせ（ランダム）', note: '毎回ちがう相手と戦う', random: true },
};

// コマンドの分類：light=基本攻撃 / basic=ブレイブ攻撃 / スキル（攻撃・守り・回復補助）/ defend=防御
SR.category = function (id) {
  var a = SR.skills[id];
  if (id === 'light') return 'light';
  if (id === 'basic') return 'brave';
  if (id === 'defend') return 'defend';
  if (id === 'wait') return 'wait';
  if (['cover', 'guard', 'kProtect', 'teamKProtect', 'protect', 'kBarrier'].indexOf(a.kind) >= 0) return 'skillDef';
  return a.kind === 'attack' ? 'skillAtk' : 'skillSup';
};
SR.isSkill = function (id) { return /^skill/.test(SR.category(id)); };
// スキルの区分：ユニーク（そのキャラだけ）／コモン（ナハト以外の4人が使える）。ナハトのコモン枠は、のちに「リンク」が入る予定。
SR.isCommon = function (id) { return !!SR.skills[id] && SR.skills[id].owner === 'common'; };
SR.typeLabel = { skillAtk: '攻撃', skillDef: '守備', skillSup: '回復・補助' };
SR.typeBadge = function (id) {
  var c = SR.category(id), cls = c === 'skillAtk' ? 'b-fire' : c === 'skillDef' ? 'b-form' : 'b-buff';
  return SR.typeLabel[c] ? '<span class="badge ' + cls + '">' + SR.typeLabel[c] + '</span>' : '';
};

SR.describe = function (a) {
  if (!a) return '';
  if (a.kind === 'wait') return '何もしない。気力を温存する';
  if (a.kind === 'defend') return 'このターン、受けるダメージと気力ダメージが半分';
  if (a.kind === 'attack') {
    var p = [];
    p.push(a.all ? '敵全体' : a.scatter ? '敵にばらまく' : '敵一体');
    if (a.hits) p.push(a.hits + '連撃');
    p.push('気力削り' + a.kd);
    p.push('威力' + a.hp);
    if (a.brave) p.push('ブレイブ（気力0でブレイク）');
    if (a.fire) p.push('炎');
    if (a.finisher) p.push('ブレイク中の相手に' + a.finisher + '倍');
    if (a.breakBonus) p.push('この技でブレイクさせると威力' + a.breakBonus + '倍');
    if (a.desperate) p.push('自分の気力が少ないほど強い');
    if (a.taunt) p.push('相手の攻撃を自分へ引きつける');
    if (a.antiSpell) p.push('術を使う相手に気力削り2倍');
    return p.join('・');
  }
  return {
    cover: '前線の仲間一人をかばう（このターン）',
    guard: '自分への気力ダメージを0.65倍（このターン）',
    heal: a.allies ? '前線全員の体力を' + a.amount + '回復' : '仲間一人の体力を' + a.amount + '回復',
    energy: '仲間一人の気力を' + a.amount + '回復',
    protect: '仲間一人の被ダメージを0.7倍（2ターン）',
    kProtect: '仲間一人への気力ダメージを0.65倍（2ターン）',
    teamKProtect: '前線全員への気力ダメージを0.65倍（2ターン）',
    kBarrier: '仲間一人への次の気力ダメージを0.35倍',
    pressure: '敵一体の気力回復を4割に抑える（2ターン）',
    analyze: '敵一体を解析する（急所観測で効果）',
    aim: '次の攻撃の気力削り1.55倍',
    power: '仲間一人の次の攻撃の威力1.4倍',
    haste: '仲間一人を次のターン先に動かす',
  }[a.kind] || '';
};
