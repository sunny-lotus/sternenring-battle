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
