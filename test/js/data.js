// バトル試作のデータ。
// 出典：OneDrive/ドキュメント/ChatGPT/物語/outputs/sr-battle-sandbox/ の
// trio-trial.cjs・five-trial.cjs・normal-encounter-presets.json（2026-11-07 相談用の仮値）。
// 数値は未採用の仮値。本番ゲーム・原作の設定ではない。
var SR = window.SR || (window.SR = {});

SR.C = { maxMp: 100, maxK: 100, recovery: 26, ap: 24, maxRounds: 24,
  ctBase: 1000, brkDelay: 0.5, releaseWeight: 0.6,
  weak2K: [1, 1.5, 2.5], openK: 1.3 };   // 弱点が二つのボス：片方1.5倍・両方2.5倍。大技・全体攻撃の直後のすき：1.3倍   // アクティブカウント：番の間隔＝ctBase÷素早さ。ブレイクで順番が半分下がる。ブレイク明けの敵は次の番が早い
// 2026-11-21 アクティブカウント：味方の素早さ（敵は enemyTypes の speed）
SR.heroSpeed = { N: 70, V: 66, F: 58, S: 54, L: 62 };
// 技の重さ：次の番までの間隔の倍率。軽い技ほど早く次の番が来る
SR.weight = function (a) {
  if (!a) return 1;
  if (a.kind === 'wait') return 0.6;
  if (a.kind === 'defend' || a.kind === 'scan') return 0.8;
  if (a.id === 'basic' || a.id === 'light') return 0.9;
  return 0.85 + (a.ap || 4) * 0.04;
};
SR.weightLabel = function (a) { var w = SR.weight(a); return w < 0.95 ? '次の番が早い' : w > 1.05 ? '次の番が遅い' : '次の番ふつう'; };

// 難しさ。sandbox は試算の数値そのまま。tense は試作で足した調整（試算からの変更）。
// atk: 敵の通常攻撃 [気力削り, 威力]。big: 溜めのあとの大技。
SR.tunes = {
  sandbox: { name: '試算どおり', note: '相談の試算と同じ数値。溜め攻撃なし', recovery: 26, mpRecovery: 18, breakMaxHp: 0.1, foeStack: { max: 3, k: 0.15, dmg: 0.15 }, charge: false,
    boss: { single: [18, 52], aoe: [23, 82] }, mob: { single: [10, 24], aoe: [12, 38] } },
  tense: { name: '緊張感あり', note: '敵が力を溜めて大技を撃つ。ブレイクで止められる。気力回復20・精神力回復14', recovery: 20, mpRecovery: 14, breakMaxHp: 0.1, foeStack: { max: 3, k: 0.15, dmg: 0.15 }, charge: true, status: true, reserveRegen: 0.05, boost: { max: 2, mult: [1, 1.5, 2], kd: 0 }, dmg: { base: 0.2, slope: 0.3, broken: 2 }, heroDmg: { base: 0.5, slope: 0.5, broken: 1.5 }, bossHp: 2.5, bossActs: 1, bossK: 0.8, bossKMul: 1, chargeK: 1.5,
    boss: { single: [23, 99], aoe: [29, 151], aoeAlways: [25, 97], big: [99, 323] }, mob: { single: [20, 69], aoe: [14, 55], big: [77, 196] } },
};

SR.names = { N: 'ナハト', V: 'ヴォルト', F: 'フレア', S: 'セレナ', L: 'リヒト' };
SR.img = { N: 'nacht', V: 'volt', F: 'flare', S: 'serena', L: 'licht' };
SR.formNames = { default: '通常', brave: 'ブレイブ', revenge: 'リベンジ', assault: 'アサルト' };

SR.skills = {};
function skill(id, owner, ap, cost, props) { SR.skills[id] = Object.assign({ id: id, owner: owner, ap: ap, cost: cost }, props); }
skill('basic', 'all', 0, 0, { kind: 'attack', kd: 16, hp: 24, brave: true, label: '基本ブレイブ' });
skill('wait', 'all', 0, 0, { kind: 'wait', label: '待機' });
// 見やすさ版で足したコマンド（試算にはない。数値は仮）
skill('light', 'all', 0, 0, { kind: 'attack', kd: 12, hp: 28, label: '基本攻撃' });
skill('defend', 'all', 0, 0, { kind: 'defend', label: '防御' });
skill('scan', 'all', 0, 0, { kind: 'scan', label: '調べる' });   // 2026-11-08 弱点は調べるまで分からない
// 見つけた弱点はこの端末に覚えておき、次の戦いからは最初からアイコンで見える
SR.weakMemo = (function () {
  var KEY = 'sr-battle-weak-v1', set = {};
  try { set = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  return { has: function (k) { return !!set[k]; }, add: function (k) { set[k] = 1; try { localStorage.setItem(KEY, JSON.stringify(set)); } catch (e) {} } };
})();
SR.defendRate = 0.5;
skill('崩し斬り', 'N', 4, 18, { kind: 'attack', kd: 30, hp: 32, form: 'brave' });
skill('かばう', 'N', 4, 14, { kind: 'cover', form: 'revenge' });
skill('踏み込み斬り', 'N', 4, 24, { kind: 'attack', kd: 10, hp: 90, form: 'assault' });
skill('返し斬り', 'N', 3, 16, { kind: 'attack', kd: 20, hp: 38, form: 'revenge' });
skill('誘い斬り', 'N', 4, 18, { kind: 'attack', kd: 22, hp: 38, form: 'revenge', taunt: true });
skill('断ち込み', 'N', 6, 30, { kind: 'attack', kd: 8, hp: 100, form: 'assault', finisher: 1.65 });
skill('見切りの構え', 'N', 4, 10, { kind: 'guard', form: 'revenge' });
skill('捨て身斬り', 'N', 7, 46, { kind: 'attack', kd: 8, hp: 132, form: 'assault', desperate: true, era: 3, recoilTo: 0.15, expose: true });
skill('連射', 'V', 5, 24, { kind: 'attack', kd: 14, hp: 16, hits: 3 });
skill('解析', 'V', 3, 8, { kind: 'analyze' });
skill('導機照準', 'V', 4, 14, { kind: 'aim' });
skill('術式妨害', 'V', 5, 25, { kind: 'attack', kd: 28, hp: 25, antiSpell: true });
skill('分散連射', 'V', 6, 30, { kind: 'attack', kd: 12, hp: 15, hits: 6, scatter: true, era: 2 });
skill('火槍', 'F', 4, 24, { kind: 'attack', kd: 38, hp: 45, brave: true, fire: true });
skill('火の粉', 'F', 4, 22, { kind: 'attack', kd: 18, hp: 15, all: true, fire: true });
skill('炎撃', 'F', 5, 32, { kind: 'attack', kd: 10, hp: 108, fire: true });
skill('集中火力', 'F', 5, 40, { kind: 'attack', kd: 66, hp: 55, brave: true, fire: true });
skill('炎圧', 'F', 6, 34, { kind: 'attack', kd: 32, hp: 22, all: true, fire: true });
skill('収束火槍', 'F', 6, 32, { kind: 'attack', kd: 20, hp: 76, brave: true, fire: true, breakBonus: 1.5, era: 2 });
skill('灰燼', 'F', 7, 44, { kind: 'attack', kd: 8, hp: 65, all: true, fire: true, finisher: 1.7, era: 3 });
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
// ---- 2026-11-08 時期（era）：1=序盤 2=中盤 3=終盤。相手の時期より後の技は、その戦いでは使えない ----
// 終盤の大技：次のターンに倒れるくらいのリスクと引きかえ。リスクは補助（守りの祈り・立て直し・かばう）で打ち消せる
skill('業火', 'F', 7, 48, { kind: 'attack', kd: 10, hp: 210, fire: true, era: 3, exhaust: true, expose: true });   // 撃った次のターンは動けず無防備
skill('決死の一閃', 'L', 7, 20, { kind: 'attack', kd: 40, hp: 120, brave: true, era: 3, allK: true, expose: true }); // 残りの気力を全部注ぐ
skill('星落とし', 'V', 7, 44, { kind: 'attack', kd: 24, hp: 95, all: true, era: 3, teamRecoil: 0.5 });          // 敵全体。前線の味方全員の体力も半分に
// リスクを打ち消す補助
skill('守りの祈り', 'S', 4, 20, { kind: 'ward', era: 2 });   // 次の反動・無防備・燃え尽きを打ち消す（2ターン）
skill('立て直し', 'L', 4, 22, { kind: 'rally', era: 2 });    // 反動で減った体力を戻し、無防備を解く
skill('深癒', 'S', 6, 30, { kind: 'heal', amount: 300 });
skill('癒しの波', 'S', 7, 40, { kind: 'heal', amount: 150, allies: true });
skill('蘇生', 'S', 5, 36, { kind: 'revive', amount: 0.4 });         // 2026-11-08 ボスを強くした分、倒れても立て直せるように
skill('気付け', 'common', 6, 46, { kind: 'revive', amount: 0.25 });   // だれでも持てるが重い蘇生
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
  shock: { name: '感電', color: '#c9a4ff', fx: '次の番が遅くなる（間隔1.3倍）' },
  blind: { name: '暗闇', color: '#9aa0c8', fx: '攻撃が1割の確率で外れる' },
};
SR.statusOrder = ['burn', 'bleed', 'freeze', 'daze', 'shock', 'blind'];
SR.statusMax = 6;
// 2026-11-08 数字が大きい方が気持ちいい → 体力・ダメージ・回復をまとめて10倍で表示（比率は同じなのでバランスは変わらない）
SR.hpScale = 10;
SR.statusFx = { burn: 0.03, bleed: 0.02, freeze: 1.1, daze: 0.9, shock: 12, shockDelay: 1.3, blind: 0.1, weakK: 2, weakRegen: 0,
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
  s('破陣剣', null, ['freeze', 1.4]);   // セレナが凍らせて、リヒトが叩く連携
  s('返し斬り', null, ['blind', 1.5]);  // 暗闇で外れた相手を返す
  s('衝撃', ['blind', 2]);
  // 付与専用技（試作で追加・数値は仮）。編成で選ぶふつうのスキル。
  // 2026-11-08「付与できるのは1個だけじゃない、バランスは任せる」→ 各キャラ2つ＋コモン2つ。
  // 方針：威力は弱め。単体は装備コスト3、全体は5で付与ターン短め。付けるだけでは得をしにくく、活かす技・弱点と組んで効く。
  skill('裂き払い', 'N', 3, 12, { kind: 'attack', kd: 10, hp: 22, inflict: ['bleed', 3] });
  skill('目潰し斬り', 'N', 3, 14, { kind: 'attack', kd: 12, hp: 18, inflict: ['blind', 2] });
  skill('放電弾', 'V', 3, 14, { kind: 'attack', kd: 12, hp: 16, inflict: ['shock', 3] });
  skill('閃光弾', 'V', 4, 16, { kind: 'attack', kd: 8, hp: 10, all: true, inflict: ['daze', 1] });
  skill('焼き付け', 'F', 3, 14, { kind: 'attack', kd: 8, hp: 18, fire: true, inflict: ['burn', 4] });
  skill('熱波', 'F', 5, 26, { kind: 'attack', kd: 10, hp: 12, all: true, fire: true, inflict: ['burn', 2] });
  skill('氷結弾', 'S', 3, 14, { kind: 'attack', kd: 10, hp: 16, inflict: ['freeze', 3] });
  skill('氷霧', 'S', 5, 26, { kind: 'attack', kd: 6, hp: 8, all: true, inflict: ['freeze', 1] });
  skill('閃光', 'L', 3, 14, { kind: 'attack', kd: 8, hp: 14, inflict: ['daze', 3] });
  skill('斬光', 'L', 3, 16, { kind: 'attack', kd: 14, hp: 20, inflict: ['bleed', 2] });
  skill('目くらまし', 'common', 3, 12, { kind: 'attack', kd: 6, hp: 8, inflict: ['blind', 3] });
  skill('痺れ針', 'common', 3, 14, { kind: 'attack', kd: 8, hp: 10, inflict: ['shock', 2] });
  SR.statusSkill = { N: '裂き払い', V: '放電弾', F: '焼き付け', S: '氷結弾', L: '閃光' };
})();

// ---- 2026-11-15 魔法の体系ツリーと、現象による削り方（手元の試作・相談中） ----
// 七体系は属性ではなく「操作」（構築＝形を作る・固定／循環＝流す／観測＝状態を知る／干渉＝既存の現象を変える）。
// コモンスキルは、体系を鍛えて必要な組み合わせを満たすと覚えられる（スキルツリー）。
// 因果・時環・星核は高度な領域で、能力は設定でまだ決まっていない → 名前だけ見せて鍛えられない。
// 体力の削り方は「現象」（炎・雷・冷気・光・衝撃）で変わる。気力の削り方は今までどおり状態の弱点。
// ナハトはツリーなし・技に現象なし（本人は剣術だと思っている。原初魔法《共鳴》は明かさない）。
SR.systems = ['構築', '循環', '観測', '干渉', '因果', '時環', '星核'];
SR.baseSystems = ['構築', '循環', '観測', '干渉'];
SR.sysNote = { 構築: '形を作る・固定する', 循環: '流す（魔力・熱・水・生命力）', 観測: '状態を知る', 干渉: 'すでにある現象を変える',
  因果: '高度な領域（まだ分からない）', 時環: '高度な領域（まだ分からない）', 星核: '高度な領域（まだ分からない）' };
// ---- 2026-11-21 技の覚え方（手元の試作・先生の決定） ----
// コモン：スキルツリー。戦いに勝つたびにポイントをもらい、時期ごとに手に入る本（〇〇の書・初級／中級／上級）の範囲で覚える。
// ユニーク：サブクエストやイベントで覚える（どのクエストかは物語に関わるので未定）。試作では「覚えたことにする」で試せる。
SR.tree = { start: { V: '観測', F: '干渉', S: '循環', L: '構築' } };   // 得意な体系（その枝の技は1ポイント安い）
SR.bookTier = ['', '初級', '中級', '上級'];
SR.passiveCap = [0, 8, 12, 16];   // パッシブのコスト上限（序盤・中盤・終盤）
SR.eraName = ['', '序盤', '中盤', '終盤'];
// コモンのツリー。sys：枝（主な体系）、books：必要な本の体系、tier：本の段階、req：前に覚える技
SR.ctree = [
  { id: '小回復', sys: '循環', books: ['循環', '観測'], tier: 1, req: [] },
  { id: '気力支援', sys: '循環', books: ['循環'], tier: 1, req: [] },
  { id: '中回復', sys: '循環', combo: ['循環', '観測'], books: ['循環', '観測'], tier: 2, req: ['小回復', '見極め'] },   // 観測を先に、循環を組む（第一巻の術学院の場面）
  { id: '集中付与', sys: '構築', combo: ['構築', '循環'], books: ['構築', '循環'], tier: 2, req: ['防護', '気力支援'] },
  { id: '加速', sys: '循環', books: ['循環'], tier: 2, req: ['気力支援'] },
  { id: '連環回復', sys: '循環', combo: ['循環', '観測'], books: ['循環', '観測'], tier: 3, req: ['中回復'] },
  { id: '気付け', sys: '観測', combo: ['循環', '観測', '干渉'], books: ['循環', '観測', '干渉'], tier: 3, req: ['中回復'] },   // 三つの体系を育てて覚える
  { id: '防護', sys: '構築', books: ['構築', '観測'], tier: 1, req: [] },
  { id: '気力障壁', sys: '構築', books: ['構築'], tier: 2, req: ['防護'] },
  { id: '気力防護', sys: '観測', books: ['観測'], tier: 2, req: ['見極め'] },
  { id: '衝撃', sys: '干渉', books: ['干渉'], tier: 1, req: [] },
  { id: '目くらまし', sys: '干渉', books: ['干渉'], tier: 1, req: [] },
  { id: '痺れ針', sys: '観測', combo: ['観測', '干渉'], books: ['観測', '干渉'], tier: 2, req: ['見極め', '衝撃'] },
  { id: '衝撃波', sys: '干渉', books: ['干渉'], tier: 2, req: ['衝撃'] },
  { id: '重圧', sys: '干渉', books: ['干渉'], tier: 3, req: ['衝撃波'] },
  // 2026-11-21 能力の星（FF10のスフィア盤・スカイリムの星座のような、技と技のあいだの小さな強化）
  { id: '気力の器', stat: { maxK: 10 }, fx: '最大気力+10', sys: '構築', books: ['構築'], tier: 1, req: [] },
  { id: '守りの型', stat: { guard: 0.05 }, fx: '受けるダメージ-5%', sys: '構築', books: ['構築'], tier: 2, req: ['防護'] },
  { id: '精神の流れ', stat: { mp: 2 }, fx: '番ごとの精神力回復+2', sys: '循環', books: ['循環'], tier: 1, req: [] },
  { id: '癒しの流れ', stat: { heal: 0.1 }, fx: '回復量+10%', sys: '循環', books: ['循環'], tier: 2, req: ['小回復'] },
  { id: '見極め', stat: { weakKd: 0.1 }, fx: '弱点の状態が付いた相手への気力削り+10%', sys: '観測', books: ['観測'], tier: 1, req: [] },
  { id: '先読み', stat: { spd: 3 }, fx: '素早さ+3（番が少し早く来る）', sys: '観測', books: ['観測'], tier: 2, req: ['見極め'] },
  { id: '崩しの手', stat: { kd: 0.05 }, fx: '気力削り+5%', sys: '干渉', books: ['干渉'], tier: 1, req: [] },
  { id: '押し込み', stat: { hp: 0.05 }, fx: '体力ダメージ+5%', sys: '干渉', books: ['干渉'], tier: 2, req: ['衝撃'] },
  // 四つの体系をすべて育てて覚える能力の星（四本の柱のまん中、上級の高さ）
  { id: '四系統の調和', stat: { maxK: 10, kd: 0.05, heal: 0.05 }, fx: '最大気力+10・気力削り+5%・回復量+5%', sys: '循環', combo: ['構築', '循環', '観測', '干渉'], books: ['構築', '循環', '観測', '干渉'], tier: 3, req: [] },
];
SR.ctreeNode = function (id) { return SR.ctree.find(function (n) { return n.id === id; }); };
// 覚えた能力の星の合計（自分で編成のときだけ戦闘に効く）
SR.growthBonus = function (who) {
  var b = { maxK: 0, guard: 0, mp: 0, heal: 0, weakKd: 0, spd: 0, kd: 0, hp: 0 };
  SR.ctree.forEach(function (n) { if (n.stat && SR.growth.has(who, n.id)) Object.keys(n.stat).forEach(function (k) { b[k] += n.stat[k]; }); });
  return b;
};
// ---- 2026-11-21 育ち方（先生の決定・2回目） ----
// ・本を買うと、その体系の柱の「透明な部分」の高さ上限が上がる（初級→中級→上級）。本は仲間みんなで使う。
// ・戦いでの自分の行動と、一人ひとつ選ぶ「重点」の体系に、少しずつ経験値がたまる。たまった分だけ柱に色がつく。
// ・柱の色が星の高さまで届くと、その技を覚える。となり合う二つの柱のあいだの星は、両方の色が届くと覚える。
// ・ユニーク技はサブクエスト・イベントで覚える（試作では「覚えたことにする」で試せる）。
// 育ちの数字（開発用に「設定」から変えられる。この端末に保存）
SR.growthDefaults = { exp1: 60, exp2: 120, exp3: 220, expSkill: 3, expBasic: 1, expDefend: 2, focusNormal: 10, focusBoss: 30, loseMul: 0.5, goldNormal: 50, goldBoss: 150, price2: 300, price3: 800 };
SR.growthLabels = { exp1: '初級の段の経験値（短め）', exp2: '中級の段の経験値', exp3: '上級の段の経験値（長め）', expSkill: '技を1回使ったときの経験値', expBasic: 'ブレイブ攻撃・基本攻撃の経験値', expDefend: '防御の経験値',
  focusNormal: '重点の経験値（通常戦）', focusBoss: '重点の経験値（ボス戦）', loseMul: '負けたときの経験値の倍率', goldNormal: '金貨（通常戦の勝ち）', goldBoss: '金貨（ボス戦の勝ち）', price2: '中級の本の値段', price3: '上級の本の値段' };
SR.growthCfg = (function () {
  var c = Object.assign({}, SR.growthDefaults);
  try { Object.assign(c, JSON.parse(localStorage.getItem('sr-battle-dev-v1')) || {}); } catch (e) {}
  return c;
})();
SR.applyGrowthCfg = function () { SR.bookPrice = [0, 0, SR.growthCfg.price2, SR.growthCfg.price3]; };
// 段ごとに必要な経験値（初級は短く、上級は長く）。柱の段の長さもこれに合わせる
SR.tierExp = function (t) { return Math.max(1, SR.growthCfg['exp' + t] || 1); };
// 高さ（0〜3。段の数＋その中の割合）→ そこまでに要る経験値
SR.cumExp = function (h) { var t = Math.floor(Math.min(3, Math.max(0, h))), e = 0; for (var i = 1; i <= t; i++) e += SR.tierExp(i); if (t < 3) e += (h - t) * SR.tierExp(t + 1); return e; };
// 経験値 → 高さ
SR.heightOf = function (e) { var h = 0; for (var t = 1; t <= 3; t++) { var c = SR.tierExp(t); if (e >= c) { e -= c; h++; } else return h + e / c; } return 3; };
// 見た目の高さ（0〜1）：段の長さが経験値に比例する
SR.visH = function (h) { return SR.cumExp(h) / SR.cumExp(3); };
SR.setGrowthCfg = function (k, v) {
  if (!(k in SR.growthDefaults) || !isFinite(v)) return;
  SR.growthCfg[k] = Math.max(0, v); if (/^exp[123]$/.test(k)) SR.growthCfg[k] = Math.max(1, v);
  try { localStorage.setItem('sr-battle-dev-v1', JSON.stringify(SR.growthCfg)); } catch (e) {}
  SR.applyGrowthCfg();
};
SR.resetGrowthCfg = function () { SR.growthCfg = Object.assign({}, SR.growthDefaults); try { localStorage.removeItem('sr-battle-dev-v1'); } catch (e) {} SR.applyGrowthCfg(); };
SR.applyGrowthCfg();
// 星の高さ（0〜3。1段＝1）。段の中で、前の技ほど下
(function () {
  function depth(n) { return n.req.length ? 1 + Math.max.apply(null, n.req.map(function (r) { var m = SR.ctreeNode(r); return m && m.tier === n.tier ? depth(m) : 0; })) : 0; }
  SR.baseSystems.forEach(function (s) {
    [1, 2, 3].forEach(function (t) {
      var col = SR.ctree.filter(function (n) { return n.sys === s && n.tier === t && !n.combo; })
        .sort(function (a, b) { return depth(a) - depth(b) || (a.stat ? 1 : 0) - (b.stat ? 1 : 0); });
      col.forEach(function (n, i) { n.h = t - 1 + (i + 1) / (col.length + 1); });
    });
  });
  SR.ctree.forEach(function (n) { if (n.combo) n.h = n.tier - 1 + [0, 0, 0.75, 0.85, 0.95][n.combo.length]; });   // 組み合わせの星：関わる柱すべての色がこの高さを超えたら覚える
})();
// 行動から、どの体系の経験値になるか
SR.actionExp = function (a) {
  if (!a || a.kind === 'wait') return null;
  var node = SR.ctreeNode(a.id);
  var C = SR.growthCfg;
  if (node) return [node.sys, C.expSkill];
  if (a.kind === 'defend') return ['構築', C.expDefend];
  if (['guard', 'protect', 'kProtect', 'teamKProtect', 'kBarrier', 'cover'].indexOf(a.kind) >= 0) return ['構築', C.expSkill];
  if (['heal', 'revive', 'energy', 'ward', 'rally', 'power', 'haste'].indexOf(a.kind) >= 0) return ['循環', C.expSkill];
  if (['scan', 'analyze', 'aim', 'pressure'].indexOf(a.kind) >= 0 || a.inflict) return ['観測', C.expSkill];
  if (a.kind === 'attack') return ['干渉', a.id === 'basic' || a.id === 'light' ? C.expBasic : C.expSkill];
  return null;
};
// 最初から覚えているユニーク技。ほかはサブクエスト・イベントで覚える
SR.uniqueStart = {
  N: ['崩し斬り', 'かばう', '返し斬り', '踏み込み斬り'],
  V: ['連射', '解析', '導機照準'],
  F: ['火槍', '火の粉', '炎撃'],
  S: ['連弾', '深癒', '蘇生'],
  L: ['破陣剣', '守勢の号令', '決着の一閃'],
};
// 最初から覚えているパッシブ。ほかはユニーク技と同じく、サブクエスト・イベントで覚える
SR.passiveStart = { N: ['追撃の冴え', '勝ち鬨'], V: ['照準共有', '集積回路'], F: ['残熱回収'], S: ['静心'], L: ['陣頭指揮'] };
// 育ち具合（この端末に保存）
SR.growth = (function () {
  var KEY = 'sr-battle-growth-v2', g;
  function z() { return { 構築: 0, 循環: 0, 観測: 0, 干渉: 0 }; }
  function fresh() {
    return { era: 1, gold: 0, books: { 構築: 1, 循環: 1, 観測: 1, 干渉: 1 },
      exp: { V: z(), F: z(), S: z(), L: z() }, focus: { V: SR.tree.start.V, F: SR.tree.start.F, S: SR.tree.start.S, L: SR.tree.start.L },
      uniq: { N: [], V: [], F: [], S: [], L: [] }, pas: { N: [], V: [], F: [], S: [], L: [] } };
  }
  try { g = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!g || !g.exp) g = fresh();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(g)); } catch (e) {} }
  var api = {
    data: function () { return g; },
    reset: function () { g = fresh(); save(); },
    era: function () { return g.era; },
    setEra: function (n) { g.era = n; save(); },
    gold: function () { return g.gold; },
    addGold: function (n) { g.gold += n; save(); },
    books: function (s) { return g.books[s] || 0; },
    hasBook: function (s, tier) { return (g.books[s] || 0) >= tier; },
    // 本屋：時期が来た段の本だけ売っている
    canBuy: function (s) { var t = (g.books[s] || 0) + 1; return t <= 3 && t <= g.era && g.gold >= SR.bookPrice[t]; },
    buy: function (s) { var t = (g.books[s] || 0) + 1; if (!api.canBuy(s)) return false; g.gold -= SR.bookPrice[t]; g.books[s] = t; save(); return true; },
    focus: function (who) { return g.focus[who]; },
    setFocus: function (who, s) { if (who !== 'N') { g.focus[who] = s; save(); } },
    exp: function (who, s) { return (g.exp[who] && g.exp[who][s]) || 0; },
    // 経験値を足す。本の上限を超えた分はたまらない
    addExp: function (who, s, n) {
      if (who === 'N' || !g.exp[who]) return 0;
      var cap = SR.cumExp(g.books[s] || 0), b = g.exp[who][s];
      g.exp[who][s] = Math.min(cap, b + n); save(); return g.exp[who][s] - b;
    },
    // 柱の色の高さ（0〜3）と、透明な部分の上限
    fill: function (who, s) { return Math.min(SR.heightOf(api.exp(who, s)), g.books[s] || 0); },
    has: function (who, id) {
      var n = SR.ctreeNode(id); if (!n || who === 'N') return false;
      if (n.combo) return n.combo.every(function (s) { return api.fill(who, s) >= n.h; });
      return api.fill(who, n.sys) >= n.h;
    },
    hasP: function (who, id) { return (SR.passiveStart[who] || []).indexOf(id) >= 0 || ((g.pas && g.pas[who]) || []).indexOf(id) >= 0; },
    togglePas: function (who, id) {
      if ((SR.passiveStart[who] || []).indexOf(id) >= 0) return;
      if (!g.pas) g.pas = {}; var l = g.pas[who] || (g.pas[who] = []), i = l.indexOf(id);
      if (i >= 0) l.splice(i, 1); else l.push(id); save();
    },
    hasU: function (who, id) { return SR.uniqueStart[who].indexOf(id) >= 0 || (g.uniq[who] || []).indexOf(id) >= 0; },
    // まだ覚えていない理由（覚えていれば空）
    why: function (who, id) {
      var n = SR.ctreeNode(id); if (!n) return '';
      if (who === 'N') return 'ナハトは魔法を使わない';
      if (api.has(who, id)) return '';
      var ss = n.combo || [n.sys], nb = ss.filter(function (s) { return !api.hasBook(s, n.tier); });
      if (nb.length) return nb.map(function (s) { return s + 'の書・' + SR.bookTier[n.tier]; }).join('・') + 'が必要';
      return ss.map(function (s) { var need = Math.ceil(SR.cumExp(n.h) - api.exp(who, s)); return need > 0 ? s + 'の経験値あと' + need : ''; }).filter(Boolean).join('・');
    },
    // 試し用：時期を終盤にし、本を上級まで、経験値を満タンに、ユニーク技を全部覚えたことにする
    unlockAll: function () {
      g.era = 3; SR.baseSystems.forEach(function (s) { g.books[s] = 3; });
      ['V', 'F', 'S', 'L'].forEach(function (w) { SR.baseSystems.forEach(function (s) { g.exp[w][s] = SR.cumExp(3); }); });
      Object.keys(SR.uniqueStart).forEach(function (w) { g.uniq[w] = Object.keys(SR.skills).filter(function (s) { return SR.skills[s].owner === w; }); });
      g.pas = {}; Object.keys(SR.uniqueStart).forEach(function (w) { g.pas[w] = Object.keys(SR.passives).filter(function (s) { return SR.passives[s][0] === w; }); });
      save();
    },
    toggleU: function (who, id) {
      if (SR.uniqueStart[who].indexOf(id) >= 0) return;
      var l = g.uniq[who] || (g.uniq[who] = []), i = l.indexOf(id);
      if (i >= 0) l.splice(i, 1); else l.push(id); save();
    },
  };
  return api;
})();
// 編成で使えるか（覚えているか）。パッシブはいつでも使える
SR.canLearn = function (tree, who, id) {
  var a = SR.skills[id]; if (!a) return SR.passives[id] ? SR.growth.hasP(who, id) : true;
  if (a.owner === 'common') return who !== 'N' && SR.growth.has(who, id);
  if (a.owner === 'link') return who === 'N' && SR.growth.hasLink(id);
  if (a.owner === who) return SR.growth.hasU(who, id);
  return true;
};
// 現象。技が起こす現象で、敵ごとに体力ダメージの効き方が変わる
SR.phenomena = ['炎', '雷', '冷気', '光', '衝撃'];
(function () {
  var S = SR.skills;
  Object.keys(S).forEach(function (id) {
    var a = S[id], o = a.owner;
    if (a.kind !== 'attack' || o === 'all' || o === 'N') return;
    a.phen = o === 'F' ? '炎' : o === 'V' ? '雷' : o === 'S' ? '冷気' : o === 'L' ? '光' : '衝撃';
  });
  S['閃光弾'].phen = '光'; S['目くらまし'].phen = '光'; S['痺れ針'].phen = '雷';
})();
// ---- 2026-11-21 武器と、斬撃・貫通（手元の試作・相談中） ----
// 武器は作画基準（manga-rules.md）どおり。特性は現実の剣の特徴をもとにしたバトル用の案で、作品の設定ではない。
SR.phenomena.push('斬撃', '貫通', '強撃');   // 強撃：重さで叩き潰す（ツヴァイハンダー）
SR.weapons = {
  N: { name: '刀', phen: '斬撃', note: '剣の技は斬撃' },
  V: { name: 'ケインソード', phen: '貫通', note: 'ブレイブ攻撃・基本攻撃は貫通。不意を突く突きで、気力削り1.2倍' },
  F: { name: 'フランベルジュ', phen: '斬撃', note: '斬撃の技は、裂傷中の相手に威力1.3倍（波打つ刃で傷が広がる）' },
  S: { name: 'レイピア', phen: '貫通', note: '貫通の技は、相手の「強い」を受けない（すき間を突く）' },
  L: { name: 'ツヴァイハンダー', phen: '強撃', note: '強撃の技は気力削り1.2倍。そのぶん次の番が少し遅い' },
};
(function () {
  var S = SR.skills;
  function set(ids, p) { ids.forEach(function (id) { if (S[id]) S[id].phen = p; }); }
  // ナハトの剣技＝斬撃（刀）
  Object.keys(S).forEach(function (id) { if (S[id].owner === 'N' && S[id].kind === 'attack') S[id].phen = '斬撃'; });
  // リヒトの剣技＝強撃（両手持ちの大剣で叩き潰す）、斬光は斬撃と光
  set(['破陣剣', '決着の一閃', '決死の一閃'], '強撃');
  set(['斬光'], ['斬撃', '光']);
  // フレアの焼き付け＝斬撃と炎（刃で焼き付ける）
  set(['焼き付け'], ['斬撃', '炎']);
})();
SR.phenList = function (p) { return !p ? [] : typeof p === 'string' ? [p] : p; };
SR.phenText = function (p) { return SR.phenList(p).join('・'); };
SR.affMul = function (e, phen, pierce) {
  var m = 1;
  SR.phenList(phen).forEach(function (s) { var v = e.aff && e.aff[s]; if (v && !(pierce && v < 1)) m *= v; });
  return m;
};
// 武器の現象：ブレイブ攻撃・基本攻撃は使う人の武器で決まる
SR.attackPhen = function (u, a) { return (a.id === 'basic' || a.id === 'light') && SR.weapons[u.id] ? SR.weapons[u.id].phen : a.phen; };

SR.passives = {
  '追撃の冴え': ['N', 5, '無料追撃の威力が上がる（36→64）'],
  '追撃の極意': ['N', 9, '無料追撃が1ターンに2回まで'],
  '返し崩し': ['N', 8, '無料反撃で相手をブレイクできる'],
  '反攻の冴え': ['N', 6, '無料反撃の威力が上がる（34→62）'],
  '勝機の一閃': ['N', 5, '追撃でブレイクさせると次の技の精神力消費が3割引'],
  '連撃調整': ['V', 6, '連撃の気力削り1.3倍、精神力消費1.25倍'],
  '照準共有': ['V', 5, '導機照準を仲間にもかけられる'],
  '蓄積照準': ['V', 6, '同じ相手への連撃ほど気力削りが増える'],
  '急所観測': ['V', 5, '解析した相手への気力削り1.2倍'],
  '照準維持': ['V', 7, '照準が2回分続く'],
  '連撃継続': ['V', 7, '連撃中にブレイクさせた相手へ威力1.5倍'],
  '残り火': ['F', 5, '炎撃を当てた相手の気力回復を抑える'],
  '過熱': ['F', 7, '炎の威力1.4倍、精神力消費1.25倍'],
  '火勢': ['F', 5, '炎技を続けるほど威力が上がる'],
  '残熱回収': ['F', 3, 'ブレイクさせると精神力12回復（1ターンに1回）'],
  '勝ち鬨': ['N', 4, '敵がブレイクすると精神力8回復（だれが崩してもよい・1ターンに1回）'],
  '集積回路': ['V', 3, 'ブレイクさせると精神力12回復（1ターンに1回）'],
  '静心': ['S', 4, '毎ターンの精神力回復+5'],
  '陣頭指揮': ['L', 5, 'ブレイクさせると前線の仲間の精神力8回復（1ターンに1回）'],
};

// 持ち込み構成（five-trial.cjs の kits）
SR.kits = {
  standard: { name: '標準', mode: 'balanced',
    N: ['崩し斬り', 'かばう', '断ち込み', '返し斬り', '追撃の冴え'],
    V: ['連射', '導機照準', '照準共有', '中回復', '気力支援'],
    F: ['火槍', '炎撃', '炎圧', '中回復', '気力支援'],
    S: ['連弾', '深癒', '癒しの波', '蘇生'],
    L: ['破陣剣', '守勢の号令', '決着の一閃', '中回復'] },
  counter: { name: '反撃', mode: 'counter',
    N: ['誘い斬り', 'かばう', '返し崩し', '反攻の冴え'],
    V: ['連射', '中回復', '気力防護', '気力支援', '重圧'],
    F: ['火槍', '炎撃', '中回復', '気力防護', '気力支援'],
    S: ['連弾', '深癒', '癒しの波', '蘇生'],
    L: ['破陣剣', '守勢の号令', '決着の一閃', '中回復'] },
  chase: { name: '追撃', mode: 'chase',
    N: ['崩し斬り', '断ち込み', '追撃の冴え', '追撃の極意'],
    V: ['連射', '蓄積照準', '連撃継続', '中回復'],
    F: ['炎圧', '火槍', '炎撃', '気力支援', '中回復'],
    S: ['連弾', '深癒', '癒しの波', '蘇生'],
    L: ['破陣剣', '守勢の号令', '決着の一閃', '中回復'] },
};

// 支援プリセット（five-trial の仮設定）
SR.supportText = {
  N: '気力の少ない前線一人の体力被ダメージを4%軽減（精神力8）',
  V: '気力の少ない前線一人の、そのターンの技消費を2軽減（精神力8）',
  F: '気力の少ない前線一人の、そのターンの体力への攻撃を4%強化（精神力8）',
  S: '前線で体力の最も少ない一人を200回復（精神力10）',
  L: '気力の少ない前線一人への、攻撃一発の気力ダメージを2軽減（精神力8）',
};

// 敵の種類（試作で追加。数値は仮）。aff は現象の効き方（1より小さいとその現象に強い・体力へのダメージだけ）。atk は攻撃の強さの倍率。
SR.enemyTypes = {
  shell: { aff: { 衝撃: 1.5, 貫通: 1.5, 強撃: 1.3, 冷気: 0.6, 斬撃: 0.6 }, img: 'js-golem', name: '甲殻獣', hp: 230, k: 95, regen: 14, speed: 40, brave: false, atk: 0.96, color: '#7d8fa3', glow: '#d8f0ff', tags: ['硬い'], weak: 'shock' },
  beast: { img: 'js-bolt', name: '星獣', hp: 150, k: 45, regen: 12, speed: 58, brave: true, atk: 1.2, color: '#8b6cd9', glow: '#ffe08a', tags: [], weak: 'bleed' },
  swift: { aff: { 雷: 1.3, 斬撃: 1.3 }, img: 'js-wind', name: '疾風獣', hp: 110, k: 35, regen: 12, speed: 88, brave: true, atk: 0.9, color: '#3fb39b', glow: '#e6fff4', tags: ['すばやい'], weak: 'freeze', inflict: ['bleed', 2] },
  ember: { aff: { 炎: 0.5, 冷気: 1.5 }, img: 'js-fire', name: '炎獣', hp: 170, k: 50, regen: 12, speed: 56, brave: true, atk: 0.9, color: '#d9603a', glow: '#ffd27a', tags: [], weak: 'freeze', inflict: ['burn', 2] },
  frost: { aff: { 炎: 1.6, 冷気: 0.5 }, img: 'js-ice', name: '氷獣', hp: 170, k: 50, regen: 12, speed: 50, brave: true, atk: 1.2, color: '#6fb6e8', glow: '#ffffff', tags: [], weak: 'burn', inflict: ['freeze', 2] },
  caster: { aff: { 光: 0.7, 雷: 1.3 }, img: 'js-eye', name: '術士', hp: 120, k: 60, regen: 16, speed: 66, brave: false, atk: 0.7, spell: true, aoeAll: true, color: '#b05ce0', glow: '#ffb8ff', tags: ['毎ターン全体攻撃', '術式妨害が効く'], weak: 'daze', inflict: ['blind', 1] },
  healer: { aff: { 炎: 1.3 }, img: 'js-angel', name: '癒し手', hp: 130, k: 50, regen: 12, speed: 48, brave: false, atk: 0.84, heal: 60, color: '#4fae6a', glow: '#eaffd8', tags: ['仲間を回復'], weak: 'bleed' },
  pup: { img: 'js-wolf', imgs: ['js-wolf', 'js-wolfg', 'js-wolf', 'js-wolfg', 'js-wolf'], name: '子獣', hp: 70, k: 25, regen: 8, speed: 62, brave: false, atk: 0.83, noCharge: true, color: '#a58ad9', glow: '#fff3b0', tags: [], weak: 'burn' },
  twin: { aff: { 雷: 0.7, 光: 1.3, 貫通: 1.3 }, kPhen: { 貫通: 1.3 }, lonelyK: 1.3, img: 'js-troll', imgs: ['js-troll', 'js-trollb'], name: '双子の大獣', hp: 600, k: 200, regen: 20, speed: 48, brave: true, atk: 1.5, color: '#5a4aa8', glow: '#ff9a7a', tags: [], weak: 'daze', inflict: ['bleed', 1] },
};

// 相手（five-trial の encounters と normal-encounter-presets.json の五人期通常戦）
SR.encounters = {
  normal: { era: 1, imgs: ['js-tree', 'js-mino', 'js-smoke'], weaks: ['burn', 'bleed', 'shock'], name: '通常戦（敵三体）', note: '五人期の調整候補：各HP1500・気力45。目安3〜5ターン', engine: '集団',
    config: { hp: 150, maxHp: 150, k: 45, maxK: 45, regen: 12 } },
  boss: { era: 1, img: 'js-prince', name: '加入期ボス', note: 'HP14500・気力240（緊張感ありは体力2.5倍の36250）。3ターンごとに全体攻撃', engine: '単体ボス', config: { weak: 'daze', weak2: 'shock', speed: 66 } },
  aoe: { era: 3, img: 'js-lord', name: '全体攻撃ボス', note: 'HP16000・気力260（緊張感ありは体力2.5倍の40000）。毎ターン全体攻撃の耐久戦', engine: '単体ボス',
    config: { hp: 1600, maxHp: 1600, k: 260, maxK: 260, alwaysAoe: true, weak: 'freeze', aff: { 冷気: 0.7, 光: 1.3 }, kPhen: { 光: 1.3 }, speed: 63 } },
  fireResist: { era: 2, img: 'js-demon', name: '炎に強いボス', note: '炎の技の体力ダメージが0.55倍。フレア以外の現象で削る（緊張感ありは体力2.5倍の36250）', engine: '炎耐性ボス', config: { weak: 'freeze', weak2: 'bleed', kPhen: { 貫通: 1.3 }, atk: 0.96, speed: 66 } },
  // ここから試作で追加した戦い（数値は仮）
  shellSwift: { era: 2, name: '甲殻と疾風', note: '硬い甲殻獣と、前衛より先に動く疾風獣', engine: '集団', config: {}, party: ['shell', 'beast', 'swift'] },
  casters: { era: 2, name: '術士の一団', note: '毎ターン全体攻撃の術士と、仲間を治す癒し手。どちらから倒す？', engine: '集団', config: {}, party: ['caster', 'healer', 'beast'] },
  elements: { era: 2, name: '炎と氷', note: '炎が効きにくく冷気に弱い炎獣と、その逆の氷獣', engine: '集団', config: {}, party: ['ember', 'frost', 'ember'] },
  swarm: { era: 1, name: '子獣の群れ', note: '弱いが5体。全体技の出番', engine: '集団', config: {}, party: ['pup', 'pup', 'pup', 'pup', 'pup'] },
  twins: { era: 3, name: '双子の大獣', note: 'ボス級が2体。溜めの時期がずれる（緊張感ありは体力2.5倍の各15000）', engine: '集団', config: {}, party: ['twin', 'twin'], bgm: 'boss' },
  random: { name: 'おまかせ（ランダム）', note: '毎回ちがう相手と戦う', random: true },
};

// コマンドの分類：light=基本攻撃 / basic=ブレイブ攻撃 / スキル（攻撃・守り・回復補助）/ defend=防御
SR.category = function (id) {
  var a = SR.skills[id];
  if (id === 'light') return 'light';
  if (id === 'basic') return 'brave';
  if (id === 'defend') return 'defend';
  if (id === 'scan') return 'scan';
  if (id === 'wait') return 'wait';
  if (['cover', 'guard', 'kProtect', 'teamKProtect', 'protect', 'kBarrier', 'ward', 'rally'].indexOf(a.kind) >= 0) return 'skillDef';
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
  if (a.kind === 'wait') return '何もしない。精神力を温存する';
  if (a.kind === 'defend') return 'このターン、受けるダメージと気力ダメージが半分';
  if (a.kind === 'scan') return '敵一体の弱点を調べる。分かった弱点は次の戦いからも見える';
  if (a.kind === 'attack') {
    var p = [];
    p.push(a.all ? '敵全体' : a.scatter ? '敵にばらまく' : '敵一体');
    if (a.hits) p.push(a.hits + '連撃');
    p.push('気力削り' + a.kd);
    p.push('威力' + a.hp * (SR.hpScale || 1));
    if (a.brave) p.push('ブレイク可（気力を0にするとブレイク）'); else if (a.kind === 'attack') p.push('気力は1（あと一押し）までしか減らせない');
    if (a.phen) p.push('現象：' + SR.phenText(a.phen));
    if (a.finisher) p.push('ブレイク中の相手に' + a.finisher + '倍');
    if (a.breakBonus) p.push('この技でブレイクさせると威力' + a.breakBonus + '倍');
    if (a.desperate) p.push('自分の気力が少ないほど強い');
    if (a.allK) p.push('残りの気力が多いほど強い（撃つと気力1）');
    if (a.recoilTo) p.push('反動で体力が今の' + Math.round(a.recoilTo * 100) + '%まで減る');
    if (a.teamRecoil) p.push('反動で前線の味方全員の体力が半分');
    if (a.exhaust) p.push('次のターンは動けない');
    if (a.expose) p.push('次のターンの終わりまで無防備（受けるダメージ2倍・回復を受けつけない）');
    if (a.taunt) p.push('相手の攻撃を自分へ引きつける');
    if (a.antiSpell) p.push('術を使う相手に気力削り2倍');
    return p.join('・');
  }
  return {
    cover: '前線の仲間一人をかばう（このターン）',
    guard: '自分への気力ダメージを0.65倍（このターン）',
    heal: a.allies ? '前線全員の体力を' + a.amount * (SR.hpScale || 1) + '回復' : '仲間一人の体力を' + a.amount * (SR.hpScale || 1) + '回復',
    revive: '倒れた前線の仲間一人を、体力' + Math.round(a.amount * 100) + '%で起こす',
    ward: '仲間一人に、次の反動・無防備・燃え尽きを打ち消す祈り（2ターン）。今の無防備も解く',
    rally: '仲間一人の、反動で減った体力を戻し、無防備・燃え尽きを解く',
    energy: '仲間一人の気力を' + a.amount + '回復',
    protect: '仲間一人の被ダメージを0.7倍（2ターン）',
    kProtect: '仲間一人への気力ダメージを0.65倍（2ターン）',
    teamKProtect: '前線全員への気力ダメージを0.65倍（2ターン）',
    kBarrier: '仲間一人への次の気力ダメージを0.35倍',
    pressure: '敵一体の気力回復を4割に抑える（2ターン）',
    analyze: '敵一体を解析する（急所観測で効果）',
    aim: '次の攻撃の気力削り1.55倍',
    power: '仲間一人の次の攻撃の威力1.4倍',
    haste: '仲間一人の次の番を早める（順番の帯で前に来る）',
  }[a.kind] || '';
};

// ---- 技の区分の呼び名（2026-11-21 先生：コモンは「魔法」、ユニークはキャラごと）----
// 「星律魔法」は物語のあとで出てくる言葉なので使わない
SR.COMMON_NAME = '魔法';
SR.UNIQUE_NAMES = { N: '刀剣術', V: '導機術', F: '黒魔術', S: '祈祷術', L: '大剣術' };   // 2026-11-21 先生が決定。フレアの黒魔術は「魔女の禁忌」から
SR.uniqueName = function (id) { return SR.UNIQUE_NAMES[id] || '固有技'; };

// ---- ナハトの連携技（2026-11-21 先生の設計）----
// ・4本の柱は仲間4人（ヴォルト・フレア・セレナ・リヒト）。それぞれとの親密度が経験値。
// ・その仲間に関するイベント／サブクエストで、はじめての連携技が使えるようになる（どのイベントかは未定）。
// ・連携技を使うたびに、いっしょに出した仲間との親密度が上がり、次の技や3人・4人・5人の連携技が開く。
// ・ほかのイベントやサブクエストでも親密度が上がることがある。連携技はもともと終盤に手に入る。
// ・二人で出す「合わせ技」（join）と、ナハトが仲間の力を借りる技（lend）がある。
// ・技の名前と数値は仮。ナハト自身は魔法を乗せない（刀の技）。仲間の力の色（現象）が乗る。
SR.LINK_NAME = '連携技';
SR.LINK_MATES = ['V', 'F', 'S', 'L'];
SR.bondLv = [0, 40, 100];   // 親密度の段：1＝イベントで開く／2＝40／3＝100（柱の目もり）
SR.BOND_PER_USE = 8;        // 1回使うと、いっしょに出した仲間それぞれ +8
function link(id, cost, need, join, props) { skill(id, 'link', 0, cost, Object.assign({ link: true, need: need, join: join, with: Object.keys(need) }, props)); }
// 二人（ナハト＋1人）。各仲間：段1で1つ、段2で2つ、段3で1つ
link('雷光斬り', 20, { V: 1 }, false, { kind: 'attack', kd: 26, hp: 60, phen: '雷' });
link('照準一閃', 26, { V: 2 }, true, { kind: 'attack', kd: 46, hp: 64, phen: ['斬撃', '雷'] });
link('雷鎖断ち', 28, { V: 2 }, false, { kind: 'attack', kd: 18, hp: 44, all: true, phen: '雷', inflict: ['shock', 2] });
link('迅雷三連', 34, { V: 3 }, true, { kind: 'attack', kd: 20, hp: 40, hits: 3, phen: ['斬撃', '雷'] });
link('焔纏い斬り', 22, { F: 1 }, false, { kind: 'attack', kd: 16, hp: 84, phen: '炎' });
link('炎嵐双撃', 32, { F: 2 }, true, { kind: 'attack', kd: 16, hp: 62, all: true, phen: ['斬撃', '炎'] });
link('紅蓮返し', 26, { F: 2 }, false, { kind: 'attack', kd: 10, hp: 96, phen: '炎', finisher: 1.5, inflict: ['burn', 2] });
link('灼刃十字', 38, { F: 3 }, true, { kind: 'attack', kd: 24, hp: 150, phen: ['斬撃', '炎'] });
link('氷刃', 20, { S: 1 }, false, { kind: 'attack', kd: 28, hp: 50, phen: '冷気', inflict: ['freeze', 2] });
link('守り刃', 28, { S: 2 }, true, { kind: 'heal', amount: 150, allies: true });
link('霜花の舞', 28, { S: 2 }, false, { kind: 'attack', kd: 20, hp: 40, all: true, phen: '冷気', inflict: ['freeze', 1] });
link('凍結一閃', 34, { S: 3 }, true, { kind: 'attack', kd: 62, hp: 58, phen: ['斬撃', '冷気'], inflict: ['freeze', 3] });
link('光刃', 22, { L: 1 }, false, { kind: 'attack', kd: 22, hp: 72, phen: '光' });
link('双剣交差', 30, { L: 2 }, true, { kind: 'attack', kd: 34, hp: 46, hits: 2, phen: ['斬撃', '強撃'] });
link('陣破り', 28, { L: 2 }, false, { kind: 'attack', kd: 48, hp: 40, brave: true, phen: '光' });
link('光輪大斬', 38, { L: 3 }, true, { kind: 'attack', kd: 30, hp: 96, all: true, phen: ['強撃', '光'] });
// 三人
link('雷炎の太刀', 34, { V: 2, F: 2 }, true, { kind: 'attack', kd: 30, hp: 120, phen: ['雷', '炎'] });
link('雷氷縛り', 32, { V: 2, S: 2 }, true, { kind: 'attack', kd: 44, hp: 60, phen: ['雷', '冷気'], inflict: ['shock', 2] });
link('光雷の陣', 32, { V: 2, L: 2 }, true, { kind: 'teamKProtect' });
link('氷炎二重', 34, { F: 2, S: 2 }, true, { kind: 'attack', kd: 26, hp: 110, phen: ['炎', '冷気'] });
link('炎光の柱', 36, { F: 2, L: 2 }, true, { kind: 'attack', kd: 22, hp: 80, all: true, phen: ['炎', '光'] });
link('白光の守り', 30, { S: 2, L: 2 }, true, { kind: 'heal', amount: 220, allies: true });
// 四人
link('四方斬り', 40, { V: 2, F: 2, L: 2 }, true, { kind: 'attack', kd: 24, hp: 90, all: true, phen: ['斬撃', '雷', '炎', '光'] });
link('天地の太刀', 42, { V: 3, S: 2, L: 2 }, true, { kind: 'attack', kd: 70, hp: 110, phen: ['斬撃', '雷', '冷気', '光'] });
link('三花の守り', 38, { F: 2, S: 3, L: 2 }, true, { kind: 'heal', amount: 300, allies: true });
link('嵐の四重奏', 44, { V: 2, F: 3, S: 2 }, true, { kind: 'attack', kd: 30, hp: 120, all: true, phen: ['雷', '炎', '冷気'] });
// 五人
link('五人の一太刀', 50, { V: 3, F: 3, S: 3, L: 3 }, true, { kind: 'attack', kd: 60, hp: 200, brave: true, phen: ['斬撃', '雷', '炎', '冷気', '光'] });
link('五人の誓い', 46, { V: 3, F: 3, S: 3, L: 3 }, true, { kind: 'heal', amount: 400, allies: true });
SR.isLink = function (id) { return !!SR.skills[id] && SR.skills[id].owner === 'link'; };

// 親密度と、イベントで開いたかどうか（この端末に保存）
(function () {
  var G = SR.growth, KEY = 'sr-battle-bond-v1', b;
  function fresh() { return { bond: { V: 0, F: 0, S: 0, L: 0 }, ev: { V: false, F: false, S: false, L: false } }; }
  try { b = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!b || !b.bond) b = fresh();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) {} }
  G.linkOpen = function () { return G.era() >= 3; };          // 連携技は終盤から
  G.bond = function (c) { return b.bond[c] || 0; };
  G.linkEv = function (c) { return !!b.ev[c]; };
  G.toggleLinkEv = function (c) { b.ev[c] = !b.ev[c]; save(); };
  G.addBond = function (c, n) { if (!b.ev[c]) return; b.bond[c] = Math.min(SR.bondLv[2] + 20, (b.bond[c] || 0) + n); save(); };
  // その仲間との段（0〜3）。イベントで1、親密度で2・3
  G.bondLvOf = function (c) { if (!b.ev[c]) return 0; var v = b.bond[c] || 0; return v >= SR.bondLv[2] ? 3 : v >= SR.bondLv[1] ? 2 : 1; };
  G.hasLink = function (id) {
    var a = SR.skills[id]; if (!a || !a.link || !G.linkOpen()) return false;
    return a.with.every(function (c) { return G.bondLvOf(c) >= a.need[c]; });
  };
  G.linkWhy = function (id) {
    var a = SR.skills[id]; if (!a) return '';
    if (!G.linkOpen()) return '終盤に手に入る';
    if (G.hasLink(id)) return '';
    return a.with.map(function (c) {
      var lv = G.bondLvOf(c), nd = a.need[c];
      if (lv >= nd) return '';
      if (!b.ev[c]) return SR.names[c] + 'のイベント';
      return SR.names[c] + 'との親密度あと' + Math.max(0, SR.bondLv[nd - 1] - (b.bond[c] || 0));
    }).filter(Boolean).join('・');
  };
  var ua = G.unlockAll, rs = G.reset;
  G.unlockAll = function () { ua(); SR.LINK_MATES.forEach(function (c) { b.ev[c] = true; b.bond[c] = SR.bondLv[2]; }); save(); };
  G.reset = function () { rs(); b = fresh(); save(); };
})();

// ---- 技の名前（2026-11-21 先生と決めた表示名）----
// 中のしくみ（保存データ・技どうしのつながり）は元の名前（id）のまま。画面に出すときだけ、この名前にする。
// 魔法は「〇〇法」、ヴォルトは横文字、ほかは雰囲気をそろえる。ナハトは魔法を乗せない純粋な剣の技。
SR.SKILL_NAMES = {
  // 魔法
  '小回復': '治癒法', '中回復': '快癒法', '連環回復': '巡癒法', '気力支援': '活気法', '防護': '防護法', '気力防護': '護気法', '気力障壁': '障壁法',
  '衝撃': '衝撃法', '衝撃波': '波動法', '重圧': '重圧法', '加速': '加速法', '集中付与': '集中法', '目くらまし': '眩光法', '痺れ針': '麻痺法', '気付け': '覚醒法',
  // ナハト（刀剣術）
  '断ち込み': '断ち斬り', '裂き払い': '裂き斬り', 'かばう': '庇いの構え',
  // ヴォルト（導機術）
  '連射': 'トリプルショット', '分散連射': 'スプレッドショット', '放電弾': 'スパークバレット', '閃光弾': 'フラッシュバン', '術式妨害': 'ジャミング',
  '解析': 'アナライズ', '導機照準': 'ロックオン', '星落とし': 'スターフォール',
  // フレア（黒魔術）：隠されたせいで禁忌と呼ばれただけ。邪悪な名前にしない（森の魔女の、少し不思議で明るい炎）
  '火槍': '焔槍', '収束火槍': '紅蓮の槍', '火の粉': 'ほたる火', '炎撃': '紅蓮撃', '集中火力': '烈火', '炎圧': '熱風',
  '焼き付け': '火の刻印', '熱波': '陽炎',
  // セレナ（祈祷術）
  '連弾': '清流の刺突', '氷結弾': '凍てつく雫', '氷霧': '白霜の帳', '深癒': '深き祈り', '癒しの波': '慈雨', '蘇生': '目覚めの鐘',
  // リヒト（大剣術）
  '閃光': '閃光剣', '斬光': '光裂き', '立て直し': '立て直しの号令'
};
Object.keys(SR.SKILL_NAMES).forEach(function (id) { if (SR.skills[id]) SR.skills[id].label = SR.SKILL_NAMES[id]; });
// パッシブの表示名（ヴォルトは技に合わせて横文字）
SR.PASSIVE_NAMES = { '連撃調整': 'コンボチューン', '照準共有': 'シェアロック', '蓄積照準': 'スタックエイム', '急所観測': 'ウィークポイント', '照準維持': 'ロックキープ', '連撃継続': 'コンボブースト', '集積回路': 'チャージサーキット' };
SR.skillName = function (id) { var a = SR.skills[id]; return (a && a.label) || SR.PASSIVE_NAMES[id] || id; };
// パッシブの説明に出てくる技の名前も、新しい名前にする（長い名前から順に）
(function () {
  var olds = Object.keys(SR.SKILL_NAMES).concat(Object.keys(SR.PASSIVE_NAMES)).sort(function (a, b) { return b.length - a.length; });
  Object.keys(SR.passives).forEach(function (p) {
    var d = SR.passives[p][2], out = '', i = 0;
    while (i < d.length) {
      var hit = olds.find(function (o) { return d.substr(i, o.length) === o; });
      if (hit) { out += SR.SKILL_NAMES[hit] || SR.PASSIVE_NAMES[hit]; i += hit.length; } else { out += d[i]; i++; }
    }
    SR.passives[p][2] = out;
  });
})();
