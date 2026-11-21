// 状態アイコン（手描きのSVG。絵文字は使わない）
var SR = window.SR || (window.SR = {});

SR.statusSVG = {
  burn: '<path d="M10 1.5C11.6 5 16 7.4 15.4 12.6 15 16.2 12.6 18.5 10 18.5 6.8 18.5 4.6 16.2 4.6 12.8 4.6 10.2 6 8.6 7.2 7.2 7.4 9 8.2 10.3 9.3 10.8 8.8 7.6 9.2 4.4 10 1.5Z" fill="#ff7a3a" stroke="#5a1a05" stroke-width="1"/>' +
    '<path d="M10 9.5C11 11.4 12.6 12.4 12.3 14.6 12.1 16.2 11.1 17 10 17 8.7 17 7.8 16 7.8 14.7 7.8 13.4 8.7 12.6 9.3 11.8 9.4 12.9 9.9 13.5 10.3 13.6 10 12.4 9.8 11 10 9.5Z" fill="#ffe27a"/>',
  bleed: '<path d="M4 15.5L11 3.5M8 17L15.5 4.5M12.5 17.5L17 9.5" stroke="#5a0d16" stroke-width="3.6" stroke-linecap="round" fill="none"/>' +
    '<path d="M4 15.5L11 3.5M8 17L15.5 4.5M12.5 17.5L17 9.5" stroke="#ff5a6e" stroke-width="2" stroke-linecap="round" fill="none"/>',
  freeze: '<g stroke="#0b3550" stroke-width="3.4" stroke-linecap="round"><path d="M10 2v16M3.1 6l13.8 8M3.1 14l13.8-8"/></g>' +
    '<g stroke="#bfeeff" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M10 2v16M3.1 6l13.8 8M3.1 14l13.8-8"/>' +
    '<path d="M8 3.5l2 2 2-2M8 16.5l2-2 2 2M3.4 9l2.6.6-.8 2.6M16.6 9l-2.6.6.8 2.6"/></g>',
  daze: '<path d="M10 10.2c0-.9.9-1.4 1.6-.9 1 .7.7 2.3-.4 2.7-1.6.6-3.2-.6-3.3-2.2-.1-2.2 2-3.8 4.1-3.4 2.8.5 4.2 3.6 3.2 6.2-1.2 3.2-5 4.5-8 3-3.5-1.8-4.4-6.5-2.3-9.6" ' +
    'stroke="#4a3a05" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
    '<path d="M10 10.2c0-.9.9-1.4 1.6-.9 1 .7.7 2.3-.4 2.7-1.6.6-3.2-.6-3.3-2.2-.1-2.2 2-3.8 4.1-3.4 2.8.5 4.2 3.6 3.2 6.2-1.2 3.2-5 4.5-8 3-3.5-1.8-4.4-6.5-2.3-9.6" ' +
    'stroke="#ffe27a" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
    '<path d="M15.5 1.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="#fff6c0"/>',
  shock: '<path d="M11.5 1L3.8 11.2h5.1L7 19l9.2-11h-5.3L13.4 1z" fill="#c9a4ff" stroke="#2c1557" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M11.6 2.6L6.2 10h3.3" stroke="#fff" stroke-width=".9" fill="none" opacity=".8"/>',
  blind: '<path d="M1.8 10C4 6.2 7 4.6 10 4.6s6 1.6 8.2 5.4C16 13.8 13 15.4 10 15.4S4 13.8 1.8 10z" fill="#2a2d45" stroke="#0a0b18" stroke-width="1.2"/>' +
    '<circle cx="10" cy="10" r="2.6" fill="#9aa0c8"/>' +
    '<path d="M3 17L17 3" stroke="#0a0b18" stroke-width="3.6" stroke-linecap="round"/><path d="M3 17L17 3" stroke="#c9cbe6" stroke-width="1.8" stroke-linecap="round"/>',
};

// 状態アイコン。n があれば残りターン（または付けるターン数）を右下に出す
SR.statusIcon = function (id, n, extraClass) {
  var st = SR.statuses[id];
  return '<span class="sti ' + (extraClass || '') + '" title="' + st.name + (n ? '・' + n + 'ターン' : '') + '：' + st.fx + '">' +
    '<svg viewBox="0 0 20 20" aria-hidden="true">' + SR.statusSVG[id] + '</svg>' + (n ? '<b>' + n + '</b>' : '') + '</span>';
};
// アイコン＋名前
SR.statusChip = function (id, n) { return '<span class="stchip">' + SR.statusIcon(id, n) + SR.statuses[id].name + (n ? n : '') + '</span>'; };

// ---- 現象のアイコン（技の性質。丸い台の上に描く） ----
SR.phenSVG = {
  '炎': '<path d="M10 2C11.5 5.2 15.4 7.4 14.9 12 14.5 15.3 12.4 17.4 10 17.4 7.1 17.4 5.1 15.3 5.1 12.2 5.1 9.9 6.4 8.4 7.4 7.2 7.6 8.8 8.3 10 9.3 10.4 8.9 7.5 9.3 4.6 10 2Z" fill="#ff7a3a"/><path d="M10 10c.9 1.6 2.2 2.5 2 4.3-.2 1.3-1 2-2 2-1.1 0-1.9-.8-1.9-1.9 0-1.1.8-1.8 1.3-2.4.1.9.5 1.4.8 1.5-.3-1-.4-2.2-.2-3.5z" fill="#ffe27a"/>',
  '雷': '<path d="M11.5 1.5L4.5 11h4.6L7.3 18.5 15.5 8.4h-4.8L12.9 1.5z" fill="#ffe14a" stroke="#6a4a00" stroke-width="1" stroke-linejoin="round"/>',
  '冷気': '<g stroke="#bfeeff" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M10 2.5v15M3.5 6.2l13 7.6M3.5 13.8l13-7.6"/><path d="M8.2 4l1.8 1.8L11.8 4M8.2 16l1.8-1.8 1.8 1.8"/></g>',
  '光': '<path d="M10 1.8l1.7 6.5 6.5 1.7-6.5 1.7L10 18.2l-1.7-6.5L1.8 10l6.5-1.7z" fill="#fff6c8"/><circle cx="10" cy="10" r="2.2" fill="#fff"/>',
  '衝撃': '<path d="M10 1.5l1.8 4.6 4.6-1.8-1.8 4.6 4.6 1.8-4.6 1.8 1.8 4.6-4.6-1.8L10 18.5l-1.8-4.6-4.6 1.8 1.8-4.6L.8 10.1l4.6-1.8-1.8-4.6 4.6 1.8z" fill="#ffb043" stroke="#6a3200" stroke-width=".8"/>',
  '斬撃': '<path d="M3 16.5C7.5 14 12.5 9 16.5 2.5 15.5 8 11.5 13.5 4.6 17.6z" fill="#e8f1ff" stroke="#3a4a7a" stroke-width=".8"/>',
  '貫通': '<path d="M2 10h11" stroke="#e8f1ff" stroke-width="2.2" stroke-linecap="round"/><path d="M11.5 5.5L18 10l-6.5 4.5z" fill="#e8f1ff" stroke="#3a4a7a" stroke-width=".8"/>',
  '強撃': '<rect x="3.5" y="3" width="10" height="6" rx="1" fill="#d8c08a" stroke="#4a3608" stroke-width=".9" transform="rotate(-30 8.5 6)"/><path d="M10.4 8.8l4.6 8.2" stroke="#8a6a3a" stroke-width="2.4" stroke-linecap="round"/>'
};
SR.phenIcon = function (p, extra) {
  var svg = SR.phenSVG[p]; if (!svg) return '<span class="badge b-sys">' + p + '</span>';
  return '<span class="phi ' + (extra || '') + '" title="' + p + '"><svg viewBox="0 0 20 20" aria-hidden="true">' + svg + '</svg></span>';
};

// ---- しるしのアイコン（ブレイク・防御など） ----
SR.markSVG = {
  brk: '<path d="M10 1.5L18.5 10 10 18.5 1.5 10z" fill="#5cc8f0" stroke="#0b3550" stroke-width="1"/><path d="M10 2.5L8.4 8l3 1.6L9 17.5" stroke="#0b1a30" stroke-width="1.6" fill="none"/>',
  push: '<path d="M10 1.5L18.5 10 10 18.5 1.5 10z" fill="#ff5a64" stroke="#4a0810" stroke-width="1"/><path d="M10 5.5v5.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="10" cy="14.2" r="1.4" fill="#fff"/>',
  charge: '<path d="M4 13l6-6 6 6" stroke="#ffb043" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 8.5l6-6 6 6" stroke="#ffe08a" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/><path d="M6 18h8" stroke="#ffb043" stroke-width="2" stroke-linecap="round"/>',
  big: '<circle cx="10" cy="10" r="8.3" fill="#c8323c" stroke="#3a0408" stroke-width="1"/><path d="M10 4.5v7" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="10" cy="14.8" r="1.5" fill="#fff"/>',
  open: '<circle cx="10" cy="10" r="7.5" fill="none" stroke="#ffd27a" stroke-width="1.8"/><circle cx="10" cy="10" r="3.6" fill="none" stroke="#ffd27a" stroke-width="1.8"/><circle cx="10" cy="10" r="1.2" fill="#fff"/>',
  press: '<path d="M3 4h14M10 4v12M5.5 11.5L10 16l4.5-4.5" stroke="#c9a4ff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  shield: '<path d="M10 1.8l7 2.8v4.8c0 4.2-3 7.4-7 8.8-4-1.4-7-4.6-7-8.8V4.6z" fill="#8aa0d8" stroke="#1a2450" stroke-width="1"/>',
  guard: '<path d="M10 1.8l7 2.8v4.8c0 4.2-3 7.4-7 8.8-4-1.4-7-4.6-7-8.8V4.6z" fill="#ffd27a" stroke="#4a3608" stroke-width="1"/><path d="M10 6.5v7M6.5 10h7" stroke="#4a3608" stroke-width="2" stroke-linecap="round"/>',
  kguard: '<path d="M10 1.8l7 2.8v4.8c0 4.2-3 7.4-7 8.8-4-1.4-7-4.6-7-8.8V4.6z" fill="#5cc8f0" stroke="#0b3550" stroke-width="1"/><path d="M10 5.8L13.4 10 10 14.2 6.6 10z" fill="#e8fbff"/>',
  exposed: '<path d="M10 1.8l7 2.8v4.8c0 4.2-3 7.4-7 8.8-4-1.4-7-4.6-7-8.8V4.6z" fill="#7a3a42" stroke="#2a0810" stroke-width="1"/><path d="M11 2.5L8.4 8.5l3 1.8-2.6 7.4" stroke="#ff7b80" stroke-width="1.8" fill="none"/>',
  ember: '<path d="M10 4c1 2 3.6 3.4 3.2 6.4-.3 2.2-1.6 3.6-3.2 3.6-1.9 0-3.2-1.4-3.2-3.4 0-1.5.9-2.5 1.5-3.3.2 1 .6 1.8 1.2 2-.3-1.9-.2-3.8.5-5.3z" fill="#6a6a7a"/><path d="M4 18h12" stroke="#4a4a58" stroke-width="2" stroke-linecap="round"/>',
  pray: '<path d="M10 2v16M4 7h12" stroke="#fff3c4" stroke-width="2.2" stroke-linecap="round"/><circle cx="10" cy="7" r="2.6" fill="none" stroke="#ffd27a" stroke-width="1.4"/>',
  aim: '<circle cx="10" cy="10" r="6.5" fill="none" stroke="#ff7b80" stroke-width="1.8"/><path d="M10 1.5v5M10 13.5v5M1.5 10h5M13.5 10h5" stroke="#ff7b80" stroke-width="1.8" stroke-linecap="round"/>',
  all: '<circle cx="4" cy="12" r="2.6" fill="#ff9aa0"/><circle cx="10" cy="8" r="2.6" fill="#ff9aa0"/><circle cx="16" cy="12" r="2.6" fill="#ff9aa0"/><path d="M2 17.5h16" stroke="#ff9aa0" stroke-width="1.6" stroke-linecap="round"/>',
  star: '<path d="M10 1.5l2.5 5.3 5.8.7-4.3 4 1.1 5.8L10 14.5l-5.1 2.8 1.1-5.8-4.3-4 5.8-.7z" fill="#ffd27a" stroke="#6a4a00" stroke-width=".9"/>',
  down: '<path d="M10 3v12M5 10.5L10 16l5-5.5" stroke="#9aa0c8" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  unk: '<circle cx="10" cy="10" r="8.3" fill="#2a2d45" stroke="#9aa0c8" stroke-width="1"/><path d="M7.4 7.6c0-1.6 1.2-2.6 2.7-2.6s2.6 1 2.6 2.4c0 1.8-2.4 2.1-2.4 4" stroke="#e8ecff" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="10.3" cy="14.6" r="1.2" fill="#e8ecff"/>'
};
SR.markIcon = function (id, title, extra) {
  return '<span class="mki ' + (extra || '') + '" title="' + (title || '') + '"><svg viewBox="0 0 20 20" aria-hidden="true">' + SR.markSVG[id] + '</svg></span>';
};
// 文字の札をアイコンに置きかえる（戦闘画面用）
SR.MARK_OF = { '全体': 'all', 'ブレイク': 'brk', 'ブレイク可': 'brk', 'あと一押し': 'push', '溜め': 'charge', '大技': 'big', 'すき': 'open', '重圧': 'press', '防御': 'shield', '防護': 'guard', '気力防護': 'kguard', '無防備': 'exposed', '燃え尽き': 'ember', '守りの祈り': 'pray', '照準': 'aim', '弱点を突ける': 'star', 'よく効く相手がいる': 'star', '急所を突ける': 'star', '今が狙い目': 'star', '効きにくい': 'down', '？': 'unk' };
SR.iconizeTags = function (html) {
  return (html || '').replace(/<span class="badge ([^"]*)"( title="[^"]*")?>([^<]*)<\/span>/g, function (all, cls, ttl, txt) {
    if (/b-sys/.test(cls)) return txt.split('・').map(function (p) { return SR.phenIcon(p); }).join('');
    if (/b-weak/.test(cls) && SR.phenSVG[txt]) return SR.phenIcon(txt, 'kp" title="' + (ttl ? ttl.slice(8, -1) : txt + 'が急所'));
    if (SR.typeLabel && Object.keys(SR.typeLabel).some(function (k) { return SR.typeLabel[k] === txt; })) return '';   // 種類は札の色でわかる
    var m = SR.MARK_OF[txt]; if (!m) return '<span class="badge ' + cls + '"' + (ttl || '') + '><span>' + txt + '</span></span>';
    return SR.markIcon(m, ttl ? ttl.slice(8, -1) : txt, cls.replace(/badge/, '').trim());
  });
};
