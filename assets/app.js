(function () {
  'use strict';
  var D = window.DEMO;
  // Зөвхөн дэлгэцийн өнгө (өгөгдөл өөрчлөхгүй): хүйтэн, тайван ангиллын өнгө
  var CAT_HUE = { dish: '#2563EB', hygiene: '#0284C7', laundry: '#0D9488', paper: '#6366F1', clean: '#D97706', oral: '#DB2777', tools: '#64748B' };
  D.categories.forEach(function (c) { if (CAT_HUE[c.id]) c.color = CAT_HUE[c.id]; });
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var MINUS = '−';
  var NM = D.months.length;
  var Y2026 = D.months.indexOf('2026-01');

  /* ===== Формат ===== */
  function grp(n) { return Math.round(n).toLocaleString('en-US'); }
  function fmtFull(n, unit) { return n == null ? '—' : grp(n) + ' ' + unit; }
  function scaleFor(max) {
    if (max >= 1e9) return { k: 1e9, w: 'тэрбум' };
    if (max >= 1e6) return { k: 1e6, w: 'сая' };
    if (max >= 1e3) return { k: 1e3, w: 'мянга' };
    return { k: 1, w: '' };
  }
  function dec(v) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
  function fmtCompact(n, unit) {
    if (n == null) return '—';
    var s = scaleFor(Math.abs(n));
    return dec(n / s.k) + (s.w ? ' ' + s.w : '') + ' ' + unit;
  }
  function pct(cur, prev) { return (prev == null || prev === 0 || cur == null) ? null : (cur - prev) / prev * 100; }
  function fmtPct(p) {
    if (p == null) return '—';
    var r = Math.round(p * 10) / 10;
    return (r > 0 ? '+' : r < 0 ? MINUS : '') + Math.abs(r).toFixed(1) + '%';
  }
  function ym(i) { return D.months[i].replace('-', '.'); }
  function ymLong(i) { var p = D.months[i].split('-'); return p[0] + ' оны ' + (+p[1]) + '-р сар'; }
  function range(a) { return a.length ? (a.length === 1 ? ym(a[0]) : ym(a[0]) + '–' + ym(a[a.length - 1])) : '—'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(id, cls) { return '<svg class="' + (cls || 'ic-s') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function deltaHtml(p, neutral) {
    if (p == null) return '<span class="delta delta-na">харьцуулах боломжгүй</span>';
    var r = Math.round(p * 10) / 10;
    var dir = r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
    var cls = neutral || dir === 'flat' ? 'delta-flat' : 'delta-' + dir;
    var word = dir === 'up' ? 'өссөн' : dir === 'down' ? 'буурсан' : 'өөрчлөлтгүй';
    return '<span class="delta ' + cls + '">' + icon('i-' + dir) + fmtPct(p) + '<span class="sr-only"> ' + word + '</span></span>';
  }

  /* ===== Төлөв ===== */
  var DEFAULTS = { period: '12', compare: 'prev', aimag: '', cat: '' };
  var st = {
    period: '12', compare: 'prev', aimag: '', cat: '', metric: 'a', show: { cur: true, cmp: true },
    search: '', sort: { key: 'a', dir: 'desc' }, page: 0, selected: null, hover: null
  };
  var PAGE = 10;

  function periods() {
    var cur = [], cmp = [], i;
    if (st.period === 'ytd') { for (i = Y2026; i < NM; i++) cur.push(i); }
    else { var n = +st.period; for (i = NM - n; i < NM; i++) cur.push(i); }
    var shift = st.compare === 'yoy' ? 12 : cur.length;
    cmp = cur.map(function (x) { return x - shift; }).filter(function (x) { return x >= 0; });
    return { cur: cur, cmp: cmp };
  }
  var aimagIdx = function () { return st.aimag === '' ? null : +st.aimag; };
  var catIdx = function () { return st.cat === '' ? null : +st.cat; };

  // Нэг сарын нийлбэр. Шүүсэн аймгийн мэдээ ирээгүй бол null.
  function cellSum(m, ai, ci) {
    var q = 0, a = 0, missing = [], any = false;
    D.aimags.forEach(function (ag, x) {
      if (ai != null && x !== ai) return;
      var row = D.cells[m][x];
      D.categories.forEach(function (c, y) {
        if (ci != null && y !== ci) return;
        var v = row[y];
        if (!v) { if (missing.indexOf(ag.name) < 0) missing.push(ag.name); return; }
        any = true; q += v.q; a += v.a;
      });
    });
    return { q: any ? q : null, a: any ? a : null, missing: missing };
  }
  function total(months, ai, ci) {
    var q = 0, a = 0, miss = [];
    months.forEach(function (m) {
      var s = cellSum(m, ai, ci);
      if (s.missing.length) miss.push({ m: m, names: s.missing });
      if (s.q != null) { q += s.q; a += s.a; }
    });
    return { q: q, a: a, miss: miss };
  }

  /* ===== Шүүлтүүр ===== */
  var fPeriod = $('#f-period'), fCompare = $('#f-compare'), fAimag = $('#f-aimag'), fCat = $('#f-cat');
  D.aimags.forEach(function (a, i) { fAimag.add(new Option(a.name, String(i))); });
  D.categories.forEach(function (c, i) { fCat.add(new Option(c.name, String(i))); });

  function syncControls() {
    fPeriod.value = st.period; fCompare.value = st.compare; fAimag.value = st.aimag; fCat.value = st.cat;
  }
  [[fPeriod, 'period'], [fCompare, 'compare'], [fAimag, 'aimag'], [fCat, 'cat']].forEach(function (p) {
    p[0].addEventListener('change', function () { st[p[1]] = p[0].value; st.page = 0; renderAll(); });
  });
  $('#f-reset').addEventListener('click', function () {
    Object.keys(DEFAULTS).forEach(function (k) { st[k] = DEFAULTS[k]; });
    st.page = 0; syncControls(); renderAll(); fPeriod.focus();
  });

  function renderFilterStatus(P) {
    var active = [];
    if (st.period !== DEFAULTS.period) active.push(['period', 'Хугацаа', fPeriod.options[fPeriod.selectedIndex].text]);
    if (st.compare !== DEFAULTS.compare) active.push(['compare', 'Харьцуулах', fCompare.options[fCompare.selectedIndex].text]);
    if (st.aimag !== '') active.push(['aimag', 'Аймаг', D.aimags[+st.aimag].name]);
    if (st.cat !== '') active.push(['cat', 'Ангилал', D.categories[+st.cat].name]);
    $('#f-reset').disabled = active.length === 0;
    [[fPeriod, 'period'], [fCompare, 'compare'], [fAimag, 'aimag'], [fCat, 'cat']].forEach(function (p) { p[0].closest('.field').classList.toggle('is-set', st[p[1]] !== DEFAULTS[p[1]]); });
    $('#active-chips').innerHTML = active.map(function (a) {
      return '<li class="chip"><span>' + esc(a[1]) + ': ' + esc(a[2]) + '</span><button type="button" data-clear="' + a[0] + '" aria-label="' +
        esc(a[1]) + ' шүүлтүүр арилгах: ' + esc(a[2]) + '">' + icon('i-x') + '</button></li>';
    }).join('');
    $('#scope-text').textContent = range(P.cur) + ' (' + P.cur.length + ' сар) · харьцуулах ' + range(P.cmp);
  }
  $('#active-chips').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-clear]'); if (!b) return;
    st[b.dataset.clear] = DEFAULTS[b.dataset.clear]; st.page = 0; syncControls(); renderAll();
    var next = $('#active-chips button') || fPeriod; next.focus();
  });

  /* ===== KPI ===== */
  function renderKpis(P) {
    var ai = aimagIdx(), ci = catIdx();
    var c = total(P.cur, ai, ci), p = total(P.cmp, ai, ci);
    var cmpLbl = st.compare === 'yoy' ? 'Өмнөх он' : 'Өмнөх үе';
    var priceC = c.q ? c.a / c.q : null, priceP = p.q ? p.a / p.q : null;
    // 4 дэх карт: тэргүүлэх ангилал эсвэл сонгосон ангиллын эзлэх хувь
    var all = total(P.cur, ai, null), allP = total(P.cmp, ai, null), card4;
    if (ci == null) {
      var best = null;
      D.categories.forEach(function (cat, y) { var t = total(P.cur, ai, y); if (!best || t.a > best.a) best = { y: y, a: t.a }; });
      var bp = total(P.cmp, ai, best.y);
      var sh = all.a ? best.a / all.a * 100 : 0, shp = allP.a ? bp.a / allP.a * 100 : null;
      card4 = { ic: 'i-pie', label: 'Тэргүүлэх ангилал', value: '<span class="kpi-swatch" style="background:' + D.categories[best.y].color + '"></span>' + esc(D.categories[best.y].short),
        sub: 'Нийт дүнгийн ' + sh.toFixed(1) + '%', delta: shp == null ? null : sh - shp, pp: true };
    } else {
      var s1 = all.a ? c.a / all.a * 100 : 0, s0 = allP.a ? p.a / allP.a * 100 : null;
      card4 = { ic: 'i-pie', label: 'Ангиллын эзлэх хувь', value: s1.toFixed(1) + '<small>%</small>', sub: esc(D.categories[ci].short) + ' / бүх ангилал', delta: s0 == null ? null : s1 - s0, pp: true };
    }
    var cards = [
      { ic: 'i-wallet', label: 'Борлуулалтын дүн', value: compactParts(c.a, '₮'), title: fmtFull(c.a, '₮'), d: pct(c.a, p.a), prev: fmtCompact(p.a, '₮') },
      { ic: 'i-box', label: 'Борлуулсан тоо ширхэг', value: compactParts(c.q, 'ш'), title: fmtFull(c.q, 'ш'), d: pct(c.q, p.q), prev: fmtCompact(p.q, 'ш') },
      { ic: 'i-tag', label: 'Дундаж нэгж үнэ', value: grp(priceC || 0) + '<small>₮/ш</small>', title: fmtFull(priceC, '₮/ш'), d: pct(priceC, priceP), prev: fmtFull(priceP, '₮/ш'), neutral: true }
    ];
    var html = cards.map(function (k) {
      return '<article class="kpi" aria-label="' + esc(k.label) + '"><div class="kpi-top"><span class="kpi-ic">' + icon(k.ic, 'ic') + '</span><span class="kpi-label">' + k.label + '</span></div>' +
        '<span class="kpi-value" title="' + esc(k.title) + '">' + k.value + '</span>' +
        '<span class="kpi-cmp">' + deltaHtml(k.d, k.neutral) + '<span>' + esc(cmpLbl) + ': ' + esc(k.prev) + '</span></span></article>';
    }).join('');
    var d4r = card4.delta == null ? null : Math.round(card4.delta * 10) / 10;
    var d4 = d4r == null ? '<span class="delta delta-na">—</span>' :
      '<span class="delta delta-flat">' + icon(d4r > 0 ? 'i-up' : d4r < 0 ? 'i-down' : 'i-flat') +
      (d4r > 0 ? '+' : d4r < 0 ? MINUS : '') + Math.abs(d4r).toFixed(1) + ' н.х.<span class="sr-only"> (нэгж хувь, ' + esc(cmpLbl) + ')</span></span>';
    html += '<article class="kpi" aria-label="' + esc(card4.label) + '"><div class="kpi-top"><span class="kpi-ic">' + icon(card4.ic, 'ic') + '</span><span class="kpi-label">' + card4.label + '</span></div>' +
      '<span class="kpi-value">' + card4.value + '</span><span class="kpi-cmp">' + d4 + '<span>' + card4.sub + '</span></span></article>';
    $('#kpis').innerHTML = html;

    var miss = c.miss.concat(p.miss);
    var n = $('#data-notice');
    if (miss.length) {
      n.hidden = false;
      n.innerHTML = icon('i-warn') + '<span><strong>Мэдээ дутуу:</strong> ' + miss.map(function (x) { return esc(x.names.join(', ')) + ' — ' + ym(x.m); }).join('; ') +
        '. Энэ сарын мэдээ ирээгүй тул нийлбэрт ороогүй (0 гэж тооцоогүй). Харьцуулалтыг болгоомжтой уншина уу.</span>';
    } else { n.hidden = true; n.innerHTML = ''; }
  }
  function compactParts(n, unit) {
    var s = scaleFor(n);
    return dec(n / s.k) + '<small>' + (s.w ? s.w + ' ' : '') + unit + '</small>';
  }

  /* ===== Шугаман график ===== */
  var svg = $('#trend'), tip = $('#trend-tip'), trendData = null;
  function trendSeries(P) {
    var ai = aimagIdx(), ci = catIdx();
    return P.cur.map(function (m, k) {
      var c = cellSum(m, ai, ci), cm = P.cmp[k] != null ? P.cmp[k] : null;
      var p = cm != null ? cellSum(cm, ai, ci) : null;
      return { m: m, cm: cm, cur: c[st.metric], cmp: p ? p[st.metric] : null, miss: c.missing, missC: p ? p.missing : [] };
    });
  }
  // 4 тэнцүү алхамтай, уншихад хялбар дээд утга (0, 6, 12, 18, 24 гэх мэт)
  function niceMax(v) {
    if (!v) return 1;
    var raw = v / 4, e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e;
    var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < steps.length; i++) if (f <= steps[i] + 1e-9) return steps[i] * e * 4;
    return 40 * e;
  }
  function tick(v) { return String(+v.toFixed(2)); }
  function renderTrend(P) {
    var data = trendSeries(P); trendData = data;
    var unit = st.metric === 'a' ? '₮' : 'ш';
    var W = Math.max(280, svg.clientWidth || 600), H = svg.clientHeight || 300;
    var L = 40, R = 12, T = 24, B = 30, pw = W - L - R, ph = H - T - B;
    var vals = [];
    data.forEach(function (d) { if (st.show.cur && d.cur != null) vals.push(d.cur); if (st.show.cmp && d.cmp != null) vals.push(d.cmp); });
    var max = niceMax(Math.max.apply(null, vals.concat([0])) * 1.05);
    var sc = scaleFor(max);
    var n = data.length;
    var x = function (i) { return L + (n === 1 ? pw / 2 : pw * i / (n - 1)); };
    var y = function (v) { return T + ph - (v / max) * ph; };
    var out = [];
    out.push('<text x="0" y="12">' + (sc.w ? sc.w + ' ' : '') + unit + '</text>');
    for (var t = 0; t <= 4; t++) {
      var v = max * t / 4, yy = y(v);
      out.push('<line class="' + (t === 0 ? 'axis' : 'grid') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/>');
      out.push('<text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + tick(v / sc.k) + '</text>');
    }
    var every = Math.max(1, Math.ceil(n / Math.floor(pw / 64)));
    data.forEach(function (d, i) {
      if ((i % every && i !== n - 1) || (i !== n - 1 && x(n - 1) - x(i) < 84)) return;
      out.push('<text x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="' + (i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle') + '">' + ym(d.m) + '</text>');
    });
    function runs(key) {
      var all = [], cur = [];
      data.forEach(function (d, i) { if (d[key] == null) { if (cur.length) all.push(cur); cur = []; } else cur.push([x(i), y(d[key])]); });
      if (cur.length) all.push(cur); return all;
    }
    function path(key) { return runs(key).map(smooth).join(' '); }
    if (st.show.cur) out.push('<path class="area" d="' + runs('cur').map(function (r) { var a = r[0], b = r[r.length - 1];
      return smooth(r) + ' L' + b[0].toFixed(1) + ' ' + y(0) + ' L' + a[0].toFixed(1) + ' ' + y(0) + ' Z'; }).join(' ') + '"/>');
    if (st.show.cmp) out.push('<path class="l-cmp" d="' + path('cmp') + '"/>');
    if (st.show.cur) {
      out.push('<path class="l-cur" d="' + path('cur') + '"/>');
      data.forEach(function (d, i) {
        if (d.cur == null) out.push('<circle class="dot-missing" cx="' + x(i) + '" cy="' + y(0) + '" r="5"/><text x="' + x(i) + '" y="' + (y(0) - 10) + '" text-anchor="middle">мэдээ алга</text>');
        else if (d.miss.length) out.push('<circle class="dot-missing" cx="' + x(i) + '" cy="' + y(d.cur) + '" r="5"/>');
        else if (n <= 12) out.push('<circle class="dot-cur" cx="' + x(i) + '" cy="' + y(d.cur) + '" r="3"/>');
      });
      var last = data[n - 1];
      if (last.cur != null) out.push('<text class="lbl-end" x="' + Math.min(x(n - 1), W - R) + '" y="' + (y(last.cur) - 10) + '" text-anchor="end">' + dec(last.cur / sc.k) + '</text>');
    }
    if (!st.show.cur && !st.show.cmp) out.push('<text x="' + (L + pw / 2) + '" y="' + (T + ph / 2) + '" text-anchor="middle">Цуваа сонгогдоогүй. Доорх тайлбарын товчийг дарна уу.</text>');
    if (st.hover != null && st.hover < n) {
      var h = data[st.hover];
      out.push('<line class="cross" x1="' + x(st.hover) + '" x2="' + x(st.hover) + '" y1="' + T + '" y2="' + (T + ph) + '"/>');
      if (st.show.cur && h.cur != null) out.push('<circle class="hl" cx="' + x(st.hover) + '" cy="' + y(h.cur) + '" r="5"/>');
    }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = out.join('');
    var lastD = data[n - 1];
    svg.setAttribute('aria-label', 'Шугаман график: ' + (st.metric === 'a' ? 'борлуулалтын дүн' : 'тоо ширхэг') + ', ' + range(P.cur) +
      '. Сүүлийн сар ' + fmtCompact(lastD.cur, unit) + '. Хүснэгтэн хувилбар доор.');
    svg._x = x; svg._n = n; svg._W = W;
    $('#lg-missing').hidden = !data.some(function (d) { return d.cur == null || d.miss.length; });
    $('#trend-sub').textContent = (st.metric === 'a' ? 'Дүн, ₮' : 'Тоо ширхэг') + ' · ' + range(P.cur) + ' ба ' + range(P.cmp);
    $('#lg-cur').textContent = 'Сонгосон үе ' + range(P.cur);
    $('#lg-cmp').textContent = (st.compare === 'yoy' ? 'Өмнөх он ' : 'Өмнөх үе ') + range(P.cmp);
    renderTip();
    // Хүснэгтэн хувилбар
    $('#trend-table').innerHTML = '<thead><tr><th scope="col">Сар</th><th scope="col" class="num">Сонгосон үе, ' + unit + '</th><th scope="col">Харьцуулах сар</th><th scope="col" class="num">Харьцуулах, ' + unit +
      '</th><th scope="col" class="num">Өөрчлөлт</th><th scope="col">Тэмдэглэл</th></tr></thead><tbody>' + data.map(function (d) {
        var note = d.cur == null ? 'Мэдээ ирээгүй' : d.miss.length ? 'Дутуу: ' + d.miss.join(', ') : (d.cur === 0 ? 'Борлуулалт 0' : '');
        if (d.missC.length) note += (note ? '; ' : '') + 'Харьцуулах сард дутуу: ' + d.missC.join(', ');
        return '<tr><th scope="row">' + ym(d.m) + '</th><td class="num">' + (d.cur == null ? '—' : grp(d.cur)) + '</td><td>' + (d.cm != null ? ym(d.cm) : '—') +
          '</td><td class="num">' + (d.cmp == null ? '—' : grp(d.cmp)) + '</td><td class="num">' + fmtPct(pct(d.cur, d.cmp)) + '</td><td>' + esc(note) + '</td></tr>';
      }).join('') + '</tbody>';
  }
  // Монотон куб муруй (Fritsch–Butland): цэгүүдийн хооронд хэтрэлтгүй, бодит утгыг дайрна
  function smooth(p) {
    var f = function (v) { return v.toFixed(1); }, n = p.length, i, dx = [], m = [], t = [];
    if (n < 3) return p.map(function (q, k) { return (k ? 'L' : 'M') + f(q[0]) + ' ' + f(q[1]); }).join(' ');
    for (i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
    var s = 'M' + f(p[0][0]) + ' ' + f(p[0][1]);
    for (i = 0; i < n - 1; i++) { var h = dx[i] / 3; s += ' C' + f(p[i][0] + h) + ' ' + f(p[i][1] + t[i] * h) + ' ' + f(p[i + 1][0] - h) + ' ' + f(p[i + 1][1] - t[i + 1] * h) + ' ' + f(p[i + 1][0]) + ' ' + f(p[i + 1][1]); }
    return s;
  }
  function renderTip() {
    if (st.hover == null || !trendData || st.hover >= trendData.length) { tip.hidden = true; return; }
    var d = trendData[st.hover], unit = st.metric === 'a' ? '₮' : 'ш';
    var curTxt = d.cur == null ? 'мэдээ алга' : (d.cur === 0 ? '0 (борлуулалтгүй)' : fmtFull(d.cur, unit));
    var html = '<strong>' + ymLong(d.m) + '</strong>' +
      '<div class="row"><span>Сонгосон үе</span><span>' + curTxt + '</span></div>' +
      '<div class="row"><span>' + (d.cm != null ? ym(d.cm) : 'Харьцуулах') + '</span><span>' + (d.cmp == null ? '—' : fmtFull(d.cmp, unit)) + '</span></div>' +
      '<div class="row"><span>Өөрчлөлт</span><span>' + fmtPct(pct(d.cur, d.cmp)) + '</span></div>';
    if (d.miss.length && d.cur != null) html += '<div class="tip-warn">Дутуу мэдээ: ' + esc(d.miss.join(', ')) + '</div>';
    tip.innerHTML = html; tip.hidden = false;
    var wrapW = svg.parentNode.clientWidth, scale = svg.clientWidth / svg._W;
    var px = svg._x(st.hover) * scale, tw = tip.offsetWidth;
    var left = px + 12; if (left + tw > wrapW) left = px - tw - 12; if (left < 0) left = 0;
    tip.style.left = left + 'px'; tip.style.top = '8px';
  }
  function idxFromEvent(e) {
    var r = svg.getBoundingClientRect(), scale = r.width / svg._W, best = 0, bd = Infinity;
    for (var i = 0; i < svg._n; i++) { var dd = Math.abs(svg._x(i) * scale - (e.clientX - r.left)); if (dd < bd) { bd = dd; best = i; } }
    return best;
  }
  svg.addEventListener('pointermove', function (e) { st.hover = idxFromEvent(e); renderTrend(periods()); });
  svg.addEventListener('pointerdown', function (e) { st.hover = idxFromEvent(e); renderTrend(periods()); });
  svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && document.activeElement !== svg) { st.hover = null; renderTrend(periods()); } });
  svg.addEventListener('focus', function () { if (st.hover == null) { st.hover = svg._n - 1; renderTrend(periods()); } });
  svg.addEventListener('blur', function () { st.hover = null; renderTrend(periods()); });
  svg.addEventListener('keydown', function (e) {
    var k = e.key, n = svg._n, h = st.hover == null ? n - 1 : st.hover;
    if (k === 'ArrowRight') h = Math.min(n - 1, h + 1); else if (k === 'ArrowLeft') h = Math.max(0, h - 1);
    else if (k === 'Home') h = 0; else if (k === 'End') h = n - 1;
    else if (k === 'Escape') { st.hover = null; renderTrend(periods()); return; } else return;
    e.preventDefault(); st.hover = h; renderTrend(periods());
  });
  $$('.seg-btn[data-metric]').forEach(function (b) {
    b.addEventListener('click', function () {
      st.metric = b.dataset.metric;
      $$('.seg-btn[data-metric]').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      renderCharts(periods());
    });
  });
  $$('.legend-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      st.show[b.dataset.series] = !st.show[b.dataset.series];
      b.setAttribute('aria-pressed', String(st.show[b.dataset.series]));
      renderTrend(periods());
    });
  });
  if (window.ResizeObserver) new ResizeObserver(function () { if (!$('#view-overview').hidden) renderTrend(periods()); }).observe($('#trend-wrap'));

  /* ===== Хэвтээ багана ===== */
  function renderBars(P) {
    var ai = aimagIdx(), ci = catIdx(), unit = st.metric === 'a' ? '₮' : 'ш';
    var rows = D.categories.map(function (c, y) {
      return { y: y, c: c, cur: total(P.cur, ai, y)[st.metric], cmp: total(P.cmp, ai, y)[st.metric] };
    }).sort(function (a, b) { return b.cur - a.cur; });
    var sum = rows.reduce(function (s, r) { return s + r.cur; }, 0);
    var max = niceMax(Math.max.apply(null, rows.map(function (r) { return Math.max(r.cur, r.cmp); })));
    var sc = scaleFor(max);
    var ticks = [0, .25, .5, .75, 1].map(function (f) {
      return '<span style="left:' + (f * 100) + '%">' + tick(max * f / sc.k) + '</span>';
    }).join('');
    $('#bars').innerHTML = '<div class="hbar-axis" aria-hidden="true"><span>' + (sc.w ? sc.w + ' ' : '') + unit + '</span><div class="hbar-ticks">' + ticks + '</div></div>' +
      rows.map(function (r) {
        var pressed = ci === r.y, label = r.c.name + ': ' + fmtCompact(r.cur, unit) + ', харьцуулах үе ' + fmtCompact(r.cmp, unit) + ' (' + fmtPct(pct(r.cur, r.cmp)) + '). ' +
          (pressed ? 'Шүүлтүүр идэвхтэй, дарж арилгана.' : 'Дарж энэ ангиллаар шүүнэ.');
        return '<button type="button" class="hbar' + (ci != null && !pressed ? ' is-dim' : '') + '" data-cat="' + r.y + '" aria-pressed="' + pressed + '" aria-label="' + esc(label) + '">' +
          '<span class="hbar-name"><i style="background:' + r.c.color + '"></i>' + esc(r.c.short) + '</span>' +
          '<span class="hbar-track"><span class="hbar-plot"><span class="hbar-fill" style="width:' + (r.cur / max * 100) + '%;background:' + r.c.color + '"></span>' +
          (r.cmp ? '<span class="hbar-prev" style="left:' + (r.cmp / max * 100) + '%"></span>' : '') + '</span>' +
          '<span class="hbar-val">' + (r.cur / sc.k).toFixed(max / sc.k >= 10 ? 1 : 2) + '</span></span></button>';
      }).join('');
    $('#bars-sub').textContent = (st.metric === 'a' ? 'Дүн' : 'Тоо ширхэг') + ', ' + (sc.w ? sc.w + ' ' : '') + unit + ' · ' +
      (ai == null ? 'бүх аймаг' : D.aimags[ai].name);
    $('#bars-table').innerHTML = '<thead><tr><th scope="col">Ангилал</th><th scope="col" class="num">Сонгосон үе, ' + unit + '</th><th scope="col" class="num">Харьцуулах үе, ' + unit +
      '</th><th scope="col" class="num">Өөрчлөлт</th><th scope="col" class="num">Эзлэх хувь</th></tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><th scope="row"><span class="cat-dot" style="background:' + r.c.color + '"></span>' + esc(r.c.name) + '</th><td class="num">' + grp(r.cur) + '</td><td class="num">' + grp(r.cmp) +
          '</td><td class="num">' + fmtPct(pct(r.cur, r.cmp)) + '</td><td class="num">' + (sum ? (r.cur / sum * 100).toFixed(1) : '0.0') + '%</td></tr>';
      }).join('') + '</tbody>';
  }
  $('#bars').addEventListener('click', function (e) {
    var b = e.target.closest('.hbar'); if (!b) return;
    var y = b.dataset.cat; st.cat = st.cat === y ? '' : y; st.page = 0; syncControls(); renderAll();
    var again = $('.hbar[data-cat="' + y + '"]'); if (again) again.focus();
  });

  /* ===== Хүснэгт ===== */
  function rowMonth(r, m) { return { q: r.q[m], a: r.a[m] }; }
  function rowAgg(r, months) {
    var q = 0, a = 0, miss = [], last = null;
    months.forEach(function (m) { var v = rowMonth(r, m); if (!v) { miss.push(m); return; } q += v.q; a += v.a; if (v.q > 0) last = m; });
    return { q: q, a: a, miss: miss, last: last };
  }
  var COLS = [
    { k: 'store', t: 'Дэлгүүр' }, { k: 'name', t: 'Бараа' }, { k: 'cat', t: 'Ангилал' },
    { k: 'q', t: 'Тоо, ш', num: true }, { k: 'a', t: 'Дүн, ₮', num: true }, { k: 'p', t: 'Дундаж үнэ, ₮/ш', num: true },
    { k: 'd', t: 'Өөрчлөлт', num: true }, { k: 'last', t: 'Сүүлд зарсан' }, { k: null, t: 'Үйлдэл' }
  ];
  var tableRows = [];
  function buildRows(P) {
    var ai = aimagIdx(), ci = catIdx();
    return D.rows.filter(function (r) { return (ai == null || r.aimag === ai) && (ci == null || r.cat === ci); }).map(function (r) {
      var c = rowAgg(r, P.cur), p = rowAgg(r, P.cmp);
      return {
        r: r, id: r.id, store: r.store, aimagName: D.aimags[r.aimag].name, name: r.name, sku: r.sku, cat: D.categories[r.cat].name, color: D.categories[r.cat].color,
        q: c.q, a: c.a, p: c.q ? c.a / c.q : null, d: pct(c.q, p.q), last: c.last == null ? '' : ym(c.last) + '.' + String(r.lastDay).padStart(2, '0'), miss: c.miss
      };
    });
  }
  function visibleRows() {
    var q = st.search.trim().toLowerCase();
    var rows = !q ? tableRows : tableRows.filter(function (x) {
      return (x.store + ' ' + x.aimagName + ' ' + x.name + ' ' + x.sku + ' ' + x.cat).toLowerCase().indexOf(q) >= 0;
    });
    var k = st.sort.key, dir = st.sort.dir === 'asc' ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var va = a[k], vb = b[k];
      if (va == null || va === '') return 1; if (vb == null || vb === '') return -1;
      return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'mn')) * dir;
    });
  }
  function renderHead() {
    $('#sales-head').innerHTML = COLS.map(function (c) {
      if (!c.k) return '<th scope="col"><span class="sr-only">' + c.t + '</span></th>';
      var on = st.sort.key === c.k, arrow = on ? (st.sort.dir === 'asc' ? '▲' : '▼') : '↕';
      return '<th scope="col"' + (c.num ? ' class="num"' : '') + (on ? ' aria-sort="' + (st.sort.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') +
        '><button type="button" class="sort" data-sort="' + c.k + '">' + c.t + '<span class="sort-ico" aria-hidden="true">' + arrow + '</span></button></th>';
    }).join('');
  }
  function renderTable() {
    var rows = visibleRows(), pages = Math.max(1, Math.ceil(rows.length / PAGE));
    if (st.page >= pages) st.page = pages - 1;
    var slice = rows.slice(st.page * PAGE, st.page * PAGE + PAGE);
    renderHead();
    $('#sales-body').innerHTML = slice.map(function (x) {
      return '<tr data-id="' + esc(x.id) + '"' + (st.selected === x.id ? ' class="is-selected" aria-selected="true"' : '') + '>' +
        '<td><span class="cell-name">' + x.store + '</span><span class="cell-sub">' + esc(x.aimagName) + '</span></td>' +
        '<td><span class="cell-name" title="' + esc(x.name) + '">' + esc(x.name) + '</span><span class="cell-sub">' + x.sku + '</span></td>' +
        '<td class="cell-cat"><span class="cat-dot" style="background:' + x.color + '"></span>' + esc(x.cat) + '</td>' +
        '<td class="num">' + grp(x.q) + '</td><td class="num">' + grp(x.a) + '</td><td class="num">' + (x.p == null ? '—' : grp(x.p)) + '</td>' +
        '<td class="num">' + (x.d == null ? '<span class="delta delta-na">—</span>' : deltaHtml(x.d)) + '</td>' +
        '<td' + (x.miss.length ? ' class="missing"' : '') + '>' + (x.last ? x.last.replace(/-/g, '.') : '—') + (x.miss.length ? '<span class="cell-sub">' + x.miss.length + ' сарын мэдээ дутуу</span>' : '') + '</td>' +
        '<td><button type="button" class="btn btn-ghost btn-sm" data-detail="' + esc(x.id) + '">Дэлгэрэнгүй<span class="sr-only">: ' + x.store + ', ' + esc(x.name) + '</span></button></td></tr>';
    }).join('');
    $('#sales-table').hidden = rows.length === 0;
    $('#table-empty').hidden = rows.length !== 0;
    $('#table-empty-text').innerHTML = st.search ? '<strong>Хайлтад тохирох мөр олдсонгүй.</strong> Хайлтын үгээ өөрчлөх эсвэл шүүлтүүрээ цэвэрлэнэ үү.' :
      '<strong>Энэ шүүлтүүрт жишээ мөр алга.</strong> Мөр байхгүй гэсэн үг, борлуулалт 0 гэсэн үг биш. Аймаг эсвэл ангиллаа өөрчилнө үү.';
    $('#t-clear').hidden = !st.search;
    var from = rows.length ? st.page * PAGE + 1 : 0, to = Math.min(rows.length, (st.page + 1) * PAGE);
    var tq = 0, ta = 0; rows.forEach(function (x) { tq += x.q; ta += x.a; });
    $('#table-total').innerHTML = 'Бүх хуудасны нийт: <span id="tt-q">' + grp(tq) + ' ш</span> · <span id="tt-a">' + grp(ta) + ' ₮</span>' +
      (st.search ? ' (хайлтад тохирсон)' : '');
    $('#pager-info').textContent = grp(from) + '–' + grp(to) + ' / ' + grp(rows.length) + ' мөр' + (st.search ? ' (хайлтаар шүүсэн)' : '');
    $('#pager-page').textContent = (st.page + 1) + ' / ' + pages;
    $('#p-prev').disabled = st.page === 0;
    $('#p-next').disabled = st.page >= pages - 1;
  }
  $('#sales-head').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-sort]'); if (!b) return;
    var k = b.dataset.sort;
    st.sort = st.sort.key === k ? { key: k, dir: st.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: COLS.filter(function (c) { return c.k === k; })[0].num ? 'desc' : 'asc' };
    st.page = 0; renderTable();
    $('#sales-head button[data-sort="' + k + '"]').focus();
  });
  var searchTimer;
  $('#t-search').addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { st.search = e.target.value; st.page = 0; renderTable(); }, 120);
  });
  $('#t-clear').addEventListener('click', function () { $('#t-search').value = ''; st.search = ''; renderTable(); $('#t-search').focus(); });
  $('#p-prev').addEventListener('click', function () { if (st.page > 0) { st.page--; renderTable(); } });
  $('#p-next').addEventListener('click', function () { st.page++; renderTable(); });

  /* CSV */
  var exportStatus = document.createElement('span');
  exportStatus.className = 'hint'; exportStatus.id = 'export-status'; exportStatus.setAttribute('role', 'status');
  $('.table-tools').appendChild(exportStatus);
  function csvCell(v) { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  $('#t-export').addEventListener('click', function () {
    var P = periods(), rows = visibleRows();
    var head = ['Дэлгүүр', 'Аймаг', 'SKU', 'Бараа', 'Ангилал', 'Тоо_ш', 'Дүн_MNT', 'Дундаж_үнэ_MNT', 'Өөрчлөлт_хувь', 'Сүүлийн_борлуулалт', 'Хугацаа', 'Тэмдэглэл'];
    var lines = [head.join(',')].concat(rows.map(function (x) {
      return [x.store, x.aimagName, x.sku, x.name, x.cat, x.q, x.a, x.p == null ? '' : Math.round(x.p), x.d == null ? '' : x.d.toFixed(1),
        x.last.replace(/-/g, '.'), range(P.cur), 'Зохиомол демо жишээ'].map(csvCell).join(',');
    }));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'borluulalt_jishee_' + D.months[P.cur[0]] + '_' + D.months[P.cur[P.cur.length - 1]] + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    exportStatus.textContent = 'CSV татагдлаа: ' + grp(rows.length) + ' мөр.';
  });

  /* Дэлгэрэнгүй цонх */
  var dlg = $('#detail'), lastTrigger = null;
  function openDetail(id, trigger) {
    var x = tableRows.filter(function (t) { return t.id === id; })[0]; if (!x) return;
    st.selected = id; lastTrigger = trigger || null; renderTable();
    var P = periods(), unit = '₮';
    $('#detail-eyebrow').textContent = x.store + ' · ' + x.aimagName + ' · ' + x.sku;
    $('#detail-title').textContent = x.name;
    var months = P.cur.map(function (m) { var v = rowMonth(x.r, m); return '<tr><th scope="row">' + ym(m) + '</th><td class="num">' + (v ? grp(v.q) : '—') + '</td><td class="num">' +
      (v ? grp(v.a) : '—') + '</td><td>' + (v ? (v.q === 0 ? 'Борлуулалт 0' : '') : 'Мэдээ ирээгүй') + '</td></tr>'; }).join('');
    $('#detail-body').innerHTML =
      '<dl class="dl"><div><dt>Тоо, ш</dt><dd>' + grp(x.q) + '</dd></div><div><dt>Дүн, ' + unit + '</dt><dd>' + grp(x.a) + '</dd></div><div><dt>Дундаж үнэ, ₮/ш</dt><dd>' +
      (x.p == null ? '—' : grp(x.p)) + '</dd></div></dl>' +
      '<p class="card-sub">Ангилал: <span class="cat-dot" style="background:' + x.color + '"></span>' + esc(x.cat) + ' · Хугацаа: ' + range(P.cur) + ' · Өмнөх үетэй харьцуулахад тоо ширхэг ' + fmtPct(x.d) + '</p>' +
      '<div class="table-scroll small"><table class="tbl"><caption class="sr-only">Сар бүрийн задаргаа</caption><thead><tr><th scope="col">Сар</th><th scope="col" class="num">Тоо, ш</th><th scope="col" class="num">Дүн, ₮</th><th scope="col">Тэмдэглэл</th></tr></thead><tbody>' +
      months + '</tbody></table></div>';
    dlg.showModal();
    $('#detail-close').focus();
  }
  dlg.addEventListener('close', function () {
    var t = lastTrigger && document.body.contains(lastTrigger) ? lastTrigger : $('#sales-body button[data-detail="' + (st.selected || '') + '"]');
    if (t) t.focus();
  });
  $('#detail-close').addEventListener('click', function () { dlg.close(); });
  $('#detail-ok').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  $('#sales-body').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-detail]');
    if (b) { openDetail(b.dataset.detail, b); return; }
    var tr = e.target.closest('tr[data-id]');
    if (tr) openDetail(tr.dataset.id, tr.querySelector('button[data-detail]'));
  });

  /* ===== Нийт рендер ===== */
  function renderCharts(P) { renderTrend(P); renderBars(P); }
  function renderAll() {
    var P = periods();
    renderFilterStatus(P); renderKpis(P); renderCharts(P);
    tableRows = buildRows(P); renderTable();
  }

  /* ===== Токен хуудас ===== */
  function lum(hex) {
    var c = hex.replace('#', '').match(/../g).map(function (h) { var v = parseInt(h, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function renderTokens() {
    var cs = getComputedStyle(document.documentElement);
    var toks = [['--ink', 'Бэх'], ['--ink-2', 'Бэх 2'], ['--ink-3', 'Бэх 3 (туслах)'], ['--accent', 'Өргөлт'], ['--accent-strong', 'Өргөлт хүчтэй'], ['--accent-soft', 'Өргөлт зөөлөн'],
      ['--bg', 'Дэвсгэр'], ['--surface', 'Гадаргуу'], ['--surface-2', 'Гадаргуу 2'], ['--border', 'Хүрээ'], ['--border-strong', 'Хүрээ хүчтэй'],
      ['--pos', 'Өсөлт'], ['--neg', 'Бууралт / алдаа'], ['--warn', 'Анхааруулга']];
    $('#swatches').innerHTML = toks.map(function (t) {
      var hex = cs.getPropertyValue(t[0]).trim().toUpperCase();
      var onW = ratio(hex, '#FFFFFF'), onBg = ratio(hex, '#F6F7F9'), dark = lum(hex) < 0.3;
      var verdict = onW >= 4.5 ? 'Текстэд тохиромжтой' : onW >= 3 ? 'Том текст, хүрээ' : 'Зөвхөн дэвсгэр/хүрээ';
      return '<div class="swatch"><div class="swatch-chip" style="background:' + hex + ';color:' + (dark ? '#fff' : '#0F172A') + '">Аа</div><div class="swatch-meta"><strong>' + t[1] +
        '</strong><code>' + t[0] + '</code><code>' + hex + '</code><span class="ratio">Цагаан дээр ' + onW.toFixed(2) + ':1 · дэвсгэр дээр ' + onBg.toFixed(2) + ':1</span><span>' + verdict + '</span></div></div>';
    }).join('');
    $('#cat-swatches').innerHTML = D.categories.map(function (c) {
      return '<div class="swatch"><div class="swatch-chip" style="background:' + c.color + ';color:#fff">' + esc(c.short) + '</div><div class="swatch-meta"><strong>' + esc(c.name) +
        '</strong><code>' + c.color + '</code><span class="ratio">Цагаан дээр ' + ratio(c.color, '#FFFFFF').toFixed(2) + ':1</span></div></div>';
    }).join('');
    var ex = [
      ['Мөнгөн дүн (бүтэн)', 'Мянгатын таслал, ард нь зай + ₮', grp(28118025109) + ' ₮'],
      ['Мөнгөн дүн (товч)', 'KPI, тэнхлэгт. Бүтэн дүнг title/хүснэгтэд', fmtCompact(28118025109, '₮')],
      ['Тоо ширхэг', 'Нэгж: ш. Бутархайгүй', grp(3900623) + ' ш'],
      ['Нэгж үнэ', '₮/ш, бүхэл тоо', grp(7209) + ' ₮/ш'],
      ['Хувь өөрчлөлт', 'Тэмдэгтэй, 1 орон, жинхэнэ хасах тэмдэг', '+4.2% · ' + MINUS + '3.1%'],
      ['Эзлэх хувийн өөрчлөлт', 'Нэгж хувь', '+1.3 нэгж хувь'],
      ['Огноо', 'ОООО.СС.ӨӨ', '2026.10.31'],
      ['Сар', 'Богино / урт', '2026.10 · ' + ymLong(NM - 1)],
      ['Хугацааны муж', 'Дунд зураас (–)', '2026.08–2026.10'],
      ['Мэдээ алга / тэг', 'Хоёрыг ялгана', '— (мэдээ алга) · 0']
    ];
    $('#format-rows').innerHTML = ex.map(function (r) { return '<tr><th scope="row">' + r[0] + '</th><td>' + r[1] + '</td><td class="num">' + esc(r[2]) + '</td></tr>'; }).join('');
    $('#spacing').innerHTML = [['--s1', 4], ['--s2', 8], ['--s3', 12], ['--s4', 16], ['--s5', 24], ['--s6', 32], ['--s7', 48]].map(function (s) {
      return '<div class="space-row"><code>' + s[0] + '</code><span>' + s[1] + 'px</span><i style="width:' + s[1] * 3 + 'px"></i></div>';
    }).join('');
  }

  /* ===== Бүрэлдэхүүн хуудас ===== */
  document.addEventListener('click', function (e) {
    var solo = e.target.closest('.seg-solo');
    if (solo) { var on = solo.getAttribute('aria-pressed') !== 'true'; solo.setAttribute('aria-pressed', String(on)); solo.textContent = on ? 'Сонгосон' : 'Сонгоогүй'; return; }
    var b = e.target.closest('[data-demo-press]'); if (!b) return;
    var out = b.closest('.card').querySelector('.press-out');
    if (out) out.textContent = '«' + b.textContent.trim() + '» товч дарагдлаа. Жишээ тул юу ч хадгалагдаагүй.';
  });
  var dSel = $('#d-date');
  D.months.slice().reverse().forEach(function (m, i) { dSel.add(new Option(m.replace('-', '.'), m)); });
  dSel.value = '2026-08';
  var errBox = $('#err-demo'), errHtml = errBox.innerHTML;
  errBox.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'err-retry') {
      errBox.setAttribute('aria-busy', 'true');
      errBox.innerHTML = '<p class="status-line" role="status">Дахин ачаалж байна…</p><div class="skel"></div>';
      setTimeout(function () {
        errBox.removeAttribute('aria-busy');
        errBox.innerHTML = '<p class="status-line ok" role="status">' + icon('i-ok') + 'Жишээ: амжилттай ачааллаа.</p><button type="button" class="btn btn-secondary btn-sm" id="err-reset">Алдааг дахин харуулах</button>';
        $('#err-reset').focus();
      }, 700);
    } else if (b.id === 'err-reset') { errBox.innerHTML = errHtml; $('#err-retry').focus(); }
  });

  /* ===== Зарчим ===== */
  var PR = [
    ['Шатлал ба алхам алхмаар задлах', 'Эхлээд нийт дүн, дараа нь явц ба бүтэц, хамгийн сүүлд мөр түвшин. Дэлгэрэнгүйг хүссэн үед нь л нээнэ.',
      'Тойм: 4 KPI → шугаман ба баганан график → хүснэгт. Мөрийн сар бүрийн задаргаа зөвхөн «Дэлгэрэнгүй» цонхонд.',
      'Анхааруулгыг нуухгүй. Дутуу мэдээний мэдэгдэл KPI-ийн дээр шууд гарна.', 'overview', 'kpis'],
    ['Хикийн хууль: цөөн үндсэн сонголт', 'Ижил төстэй сонголт олон байх тусам шийдвэр удаашрана. Байнга хэрэглэх сонголтыг цөөн, бэлэн байлгана.',
      'Шүүлтүүр 4 л байна. Хугацаа нь 4 бэлэн муж, дурын огноо биш. Хэмжүүр 2 сонголттой: дүн / тоо.',
      '21 аймгийн жагсаалт урт ч танил, эрэмбэтэй. Хик гэдэг нь сонголтыг хэт хасах шалтгаан биш.', 'overview', 'filters'],
    ['Фиттсийн хууль: хүрэхэд хялбар бай', 'Том, ойр бай хурдан, алдаагүй дарагдана.',
      'Товч, сонголт, цэс, баганын мөр 44px өндөр. Чипийн жижиг «×» товч 44px хүрэх талбайтай. Шүүлтүүр дээд талд, гүйлгэхэд наалттай (ширээний дэлгэц).',
      '44px нь баримжаа (WCAG 2.5.5 болон платформын заавар). Нягт хүснэгтийн мөрийн товч 36px боловч хоорондоо зайтай.', 'components', 'h-btns'],
    ['Гештальт: ойрын байдал ба бүлэглэл', 'Хамааралтай зүйлсийг ойр, нэг хүрээнд; хамааралгүйг зайгаар салгана.',
      'KPI-ийн утга, өөрчлөлт, харьцуулах муж нэг картад. Тайлбар (legend) графикийн яг дээр. Шүүлтүүр нэг самбарт.',
      'Карт хэт олон бол бүлэг алдагдана. Сүүдэр биш, хүрээ ба зайгаар ялгана.', 'overview', 'h-trend'],
    ['Тууштай байдал ба Якобын хууль', 'Хэрэглэгч бусад системд дассан хэв маягаа энд ч хүлээнэ.',
      'Зүүн цэс, баруун тийш зэрэгцсэн тоо, толгой дээр дарж эрэмбэлэх, Esc-ээр цонх хаах. Нэг өнгө = нэг ангилал бүх графикт.',
      'Танил хэв маягийг эвдэхдээ тодорхой давуу талтай байх ёстой.', 'tokens', 'cat-swatches'],
    ['Санахаас илүү таних', 'Хэрэглэгч сонголтоо санах ёсгүй. Одоогийн төлөв дэлгэцэн дээр харагдана.',
      'Идэвхтэй шүүлтүүр чип хэлбэрээр, хугацааны муж текстээр бичигдэнэ. Нэгж нь баганын толгойд (₮, ш).',
      'Чип олширвол «Шүүлтүүр цэвэрлэх» нэг товчоор бүгдийг буцаана.', 'overview', 'scope-text'],
    ['Хариу ба төлөвийн мэдээлэл', 'Үйлдэл бүр харагдах хариутай. Мэдээ хэр шинэ болохыг тодорхой бичнэ.',
      'Шүүлтүүр солиход KPI, график, хүснэгт хамт шинэчлэгдэнэ. CSV татахад мөрийн тоо мэдэгдэнэ. «2026.10.31-ний байдлаар» шошго байнга харагдана.',
      'Хоосон, ачаалал, алдаа, эрхгүй, хуучирсан төлөв тус бүр өөр тексттэй. Хоосон хуудас харуулахгүй.', 'components', 'h-statesdemo'],
    ['Тодрол ба хүртээмж', 'Текст ≥ 4.5:1, фокус тод харагдана, бүх үйлдэл гараар хийгдэнэ.',
      'Өсөлт/бууралт = сум + тэмдэг + өнгө. Токен хуудсанд харьцааг шууд тооцоолсон. Графикийг ← → товчоор уншина.',
      'Харьцаа хангасан ч өнгөнд найдахгүй. Хөдөлгөөн багасгах тохиргоог дагана.', 'tokens', 'swatches'],
    ['Тодорхой харьцуулалт', 'Юуг юутай харьцуулж буйг үргэлж бичнэ.',
      'KPI бүр «Өмнөх үе 2026.05–2026.07: …» гэсэн утгатай. Харьцуулах үе тасархай шугам, баганын хар зураасаар.',
      'Жижиг суурь дээрх хувь хэт томорч харагдана. Үнэмлэхүй утгыг хамт харуулна.', 'overview', 'kpis'],
    ['Итгэл төрүүлэх хэмжүүр', 'Багана 0-ээс эхэлнэ. Тэнхлэгийг тасалбал тэмдэглэнэ. Дутуу мэдээ ба тэгийг ялгана.',
      'Энэ самбарын график бүгд 0-ээс эхэлнэ. Дутуу сар (хөндий тэмдэг, «мэдээ алга») ба тэгийг «Бүрэлдэхүүн» хуудасны шошготой жишээнд харуулсан; тойм хуудасны демо өгөгдөл бүрэн.',
      'Шугаман графикт 0-ээс эхлэх нь заавал биш. Харин тасалсан бол заавал тэмдэглэнэ.', 'components', 'h-chartpat']
  ];
  $('#principles-list').innerHTML = PR.map(function (p, i) {
    return '<article class="principle" aria-labelledby="pr-' + i + '"><h2 id="pr-' + i + '"><span class="pn">' + String(i + 1).padStart(2, '0') + '</span>' + p[0] + '</h2>' +
      '<p class="rule">' + p[1] + '</p><p class="ex"><strong>Энэ самбарт:</strong> ' + p[2] + '</p><p class="care"><strong>Анхаар:</strong> ' + p[3] + '</p>' +
      '<a class="link" href="#' + p[4] + '" data-goto="' + p[5] + '">Жишээг үзэх' + icon('i-chev') + '</a></article>';
  }).join('');

  /* ===== Чиглүүлэлт ===== */
  var VIEWS = ['overview', 'tokens', 'components', 'principles'], pendingGoto = null, firstRoute = true;
  function route() {
    var v = (location.hash || '#overview').slice(1);
    if (VIEWS.indexOf(v) < 0) v = 'overview';
    $$('.view').forEach(function (s) { s.hidden = s.dataset.view !== v; });
    $$('[data-nav]').forEach(function (a) { if (a.dataset.nav === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#crumb').textContent = $('a[data-nav="' + v + '"] .nav-long').textContent;
    $('#crumb-parent').textContent = v === 'overview' ? 'Шинжилгээ' : 'Загварын сан';
    document.title = $('#view-' + v + ' h1').textContent + ' · Борлуулалтын самбар';
    if (v === 'overview') renderTrend(periods());
    if (pendingGoto) {
      var el = document.getElementById(pendingGoto); pendingGoto = null;
      if (el) { if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT)$/.test(el.tagName)) el.setAttribute('tabindex', '-1'); el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); }
    } else if (!firstRoute) {
      var h = $('#view-' + v + ' h1'); h.setAttribute('tabindex', '-1'); window.scrollTo(0, 0); h.focus({ preventScroll: true });
    }
    firstRoute = false;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-goto]'); if (!a) return;
    pendingGoto = a.dataset.goto;
    if (location.hash === a.getAttribute('href')) { e.preventDefault(); route(); }
  });
  window.addEventListener('hashchange', route);

  renderTokens();
  renderAll();
  route();
  window.__dashboardReady = true;
})();
