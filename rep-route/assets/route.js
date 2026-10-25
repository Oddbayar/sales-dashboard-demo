/* Миний маршрут — one rep, one fixture (data/fixture.js, built from data/demo by scripts/build_rep_route_fixture.py).
   «Маршрут»: a sample schedule (config; members = customers who purchased on a stated day). Sorting changes only what is shown
   first; the schedule № never changes. «Сүүлд очсон» comes from a demo visit history, never from purchases.
   «Харилцагчид»: every assigned customer with 12-month signals (measured), PM demo flags, filters/sorts, optional route scope.
   Full store reports open only for codes in the store-report registry (../store-report/data/registry.js). */
(function () {
  'use strict';
  var FX = window.REP_ROUTE_FIXTURE, REG = window.STORE_REPORT_REGISTRY || { stores: {} };
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');

  // ---------- formatting ----------
  var MINUS = '−';
  function fmt(n) { return (n < 0 ? MINUS : '') + Math.round(Math.abs(n)).toLocaleString('en-US'); }
  function money(n) { return fmt(n) + ' ₮'; }
  function signed(n) { return (n > 0 ? '+' : '') + money(n); }
  function pctS(x) { return (x > 0 ? '+' : x < 0 ? MINUS : '') + Math.abs(x).toFixed(1) + '%'; }
  function ymDot(ym) { return ym.replace('-', '.'); }
  function dDot(iso) { return iso.replace(/-/g, '.'); }
  function shortDate(iso) { return iso.slice(0, 4) === FX.cutoff.slice(0, 4) ? iso.slice(5).replace('-', '.') : dDot(iso); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }
  function range(ms) { return ymDot(ms[0]) + '–' + ymDot(ms[ms.length - 1]); }   // always both years: 2025.10–2026.09
  function daysBetween(a, b) { return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / 864e5); }

  // ---------- data ----------
  var byCode = {}, W = FX.window, R = FX.rules, VIS = (FX.visits || {}).by_code || {};
  FX.customers.forEach(function (c) { byCode[c.code] = c; });
  var FLAG = { declined: 'Буурсан', lapsed: 'Авалт тасарсан', never: 'Авч байгаагүй' };
  var has = function (c, f) { return c.flags.indexOf(f) >= 0; };
  var attention = function (c) { return has(c, 'declined') || has(c, 'lapsed'); };
  var hasReport = function (code) { return !!(REG.stores && REG.stores[code]); };
  var routeDay = function (d) { return FX.routes.days.filter(function (x) { return x.date === d; })[0] || null; };
  // last demo visit on or before the selected route day (a later event never counts); null = no record
  function lastVisit(code, day) { var v = VIS[code] || [], out = null; v.forEach(function (d) { if (d <= day && (!out || d > out)) out = d; }); return out; }
  function visitGap(code, day) { var lv = lastVisit(code, day); return lv ? daysBetween(lv, day) : null; }

  // ---------- state (URL keeps everything; the store report sends it back via ?ret=) ----------
  var CHIPS = ['attention', 'all', 'declined', 'lapsed', 'never'];
  var CHIP_LABEL = { attention: 'Анхаарах', all: 'Бүгд', declined: 'Буурсан', lapsed: 'Авалт тасарсан', never: 'Авч байгаагүй' };
  var SORTS = { '': 'Үндсэн эрэмбэ', decline: 'Бууралтын дүнгээр (₮)', pct_down: 'Их буурснаар (%)', pct_up: 'Их өссөнөөр (%)',
    last_new: 'Сүүлийн авалт: шинэ → хуучин', last_old: 'Сүүлийн авалт: хуучин → шинэ', t12: '12 сарын дүнгээр', name: 'Нэрээр' };
  var LEGACY_SORT = { gap: 'last_old' };   // Claude 15 deep links
  var RSORTS = ['', 'visit_old', 'visit_new'];
  var days = FX.routes.days.map(function (d) { return d.date; }).sort();
  var state = { tab: 'route', day: FX.routes.default_day, rs: '', rq: '', f: 'attention', rec: 'all', aimag: '', type: '', q: '', sort: '', scope: '' };
  var scrollY = { route: 0, customers: 0 };

  function readUrl() {
    var p = new URLSearchParams(location.search), v;
    if ((v = p.get('tab')) === 'customers' || v === 'route') state.tab = v;
    if ((v = p.get('day')) && /^\d{4}-\d{2}-\d{2}$/.test(v)) state.day = v;
    if (RSORTS.indexOf(v = p.get('rs')) >= 0 && v) state.rs = v;
    if ((v = p.get('rq'))) state.rq = v.slice(0, 40);
    if (CHIPS.indexOf(v = p.get('f')) >= 0) state.f = v;
    if (['all', 'current', 'old'].indexOf(v = p.get('rec')) >= 0) state.rec = v;
    if ((v = p.get('aimag')) && FX.customers.some(function (c) { return c.aimag === v; })) state.aimag = v;
    if ((v = p.get('type')) && FX.customers.some(function (c) { return c.type === v; })) state.type = v;
    if ((v = p.get('q'))) state.q = v.slice(0, 40);
    if ((v = p.get('sort'))) { v = LEGACY_SORT[v] || v; if (v in SORTS) state.sort = v; }
    if (p.get('scope') === 'route') state.scope = 'route';
  }
  function query() {
    var p = new URLSearchParams();
    p.set('tab', state.tab); p.set('day', state.day);
    if (state.rs) p.set('rs', state.rs);
    if (state.rq) p.set('rq', state.rq);
    p.set('f', state.f);
    if (state.rec !== 'all') p.set('rec', state.rec);
    if (state.aimag) p.set('aimag', state.aimag);
    if (state.type) p.set('type', state.type);
    if (state.q) p.set('q', state.q);
    if (state.sort) p.set('sort', state.sort);
    if (state.scope) p.set('scope', state.scope);
    return p.toString();
  }
  // the hash may carry Telegram's launch data (kept); the menu reopens this session's route state (workspace.js, validated)
  function writeUrl() { var q = '?' + query(); if (location.search !== q) history.replaceState(null, '', q + location.hash); if (window.WS) window.WS.remember('route', q); }
  function reportUrl(code) { return '../store-report/?store=' + encodeURIComponent(code) + '&from=route&ret=' + encodeURIComponent(query()); }

  // ---------- init ----------
  function init() {
    if (!FX || !FX.customers) { $('state-title').textContent = 'Мэдээлэл ачаалж чадсангүй'; $('state').hidden = false; return; }
    readUrl();
    $('rep-label').textContent = FX.rep.label;
    $('asof').textContent = dDot(FX.cutoff) + '-ны байдлаар';
    $('count-roster').textContent = FX.portfolio.n;
    $('attn-n').textContent = FX.counts.attention;
    // any date can be picked (unscheduled days show an empty state); previous/next jump between configured days
    var opts = function (vals, all) { return '<option value="">' + all + '</option>' + vals.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join(''); };
    var uniq = function (k) { return FX.customers.map(function (c) { return c[k]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a.localeCompare(b, 'mn'); }); };
    $('cu-aimag').innerHTML = opts(uniq('aimag'), 'Бүх аймаг');
    $('cu-type').innerHTML = opts(uniq('type'), 'Бүх төрөл');
    $('cu-sort').innerHTML = Object.keys(SORTS).map(function (k) { return '<option value="' + k + '">' + SORTS[k] + '</option>'; }).join('');
    $('rules-text').innerHTML = rulesHtml();
    bind();
    renderRoute();
    renderCustomers();
    selectTab(state.tab);
    $('head').hidden = false; $('tabs').hidden = false;
    app.setAttribute('aria-busy', 'false');
    restoreReturn();
  }

  function rulesHtml() {
    return '<p>12 сар: <b>' + range(W.months) + '</b>. Сүүлийн 3 сар <b>' + range(W.recent) + '</b>-ийг өмнөх 3 сар <b>' + range(W.base) + '</b>-тай харьцуулна. ' +
      dDot(FX.cutoff) + '-ны дутуу сарыг харьцуулалтад оруулаагүй.</p><ul>' +
      '<li><b>Буурсан</b>: одоогийн бүртгэл, өмнөх 3 сарын дүн 0-ээс их, сүүлийн 3 сар ' + R.declined.min_drop_pct + '% ба түүнээс их буурсан.</li>' +
      '<li><b>Авалт тасарсан</b>: одоогийн бүртгэл, 12 сард дор хаяж ' + R.lapsed.min_purchase_days + ' өдөр авсан, сүүлийн авалтаас ' + R.lapsed.min_gap_days + '+ хоног өнгөрсөн.</li>' +
      '<li><b>Авч байгаагүй</b>: ' + dDot(FX.coverage.from) + '-аас хойш авалт бүртгэгдээгүй.</li>' +
      '<li><b>Анхаарах</b>: Буурсан эсвэл Авалт тасарсан; хоёуланд нь орсон харилцагчийг нэг удаа тоолсон.</li></ul>' +
      '<p>' + esc(R.label) + '. Өөрчлөлт нь шалтгаан, алдагдал эсвэл ирээгүйн баталгаа биш. Түүх нь одоо хариуцаж буй харилцагчийн түүх.</p>';
  }
  function routeNote(d) {
    return '<p>' + (d ? 'Энэ өдрийн ' + d.stops.length + ' дэлгүүр нь ' + dDot(d.cohort.purchase_date) + '-нд авалт хийсэн харилцагчид (жишиг хуваарь, ' + esc(FX.routes.order_rule) + '). ' : '') +
      'Бодит очилт, GPS бүртгэл биш.</p><p>«Сүүлд очсон» нь жишиг очилтын бүртгэл: сонгосон өдрөөс хойших бүртгэлийг тооцохгүй; хоног = сонгосон өдөр − сүүлд очсон өдөр. «Сүүлийн авалт» нь борлуулалтын өгөгдөл.</p>';
  }

  // ---------- tabs ----------
  var TABS = ['route', 'customers'];
  function selectTab(t, focus) {
    scrollY[state.tab] = window.scrollY;
    state.tab = t;
    TABS.forEach(function (k) {
      var on = k === t, b = $('tab-' + k);
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      $('panel-' + k).hidden = !on;
      if (on && focus) b.focus();
    });
    window.scrollTo(0, scrollY[t] || 0);   // each tab keeps its own scroll position
    writeUrl();
  }

  // ---------- route ----------
  function reason(c) {   // one short attention reason per stop
    if (has(c, 'lapsed')) return ['lapsed', 'Авалт тасарсан · ' + c.gap + ' хоног'];
    if (has(c, 'declined')) return ['declined', 'Буурсан · ' + pctS(c.rate)];
    if (has(c, 'never')) return ['never', 'Авч байгаагүй'];
    return ['', '—'];
  }
  var RCMP = {   // visit dates compared as dates (ISO strings); no record last in both directions; ties keep the schedule №
    visit_old: function (a, b) { return (a.lv === null) - (b.lv === null) || (a.lv < b.lv ? -1 : a.lv > b.lv ? 1 : 0) || a.no - b.no; },
    visit_new: function (a, b) { return (a.lv === null) - (b.lv === null) || (a.lv > b.lv ? -1 : a.lv < b.lv ? 1 : 0) || a.no - b.no; }
  };
  function routeStops() {   // [{ no, code, lv }] in the requested display order, filtered by the route search
    var d = routeDay(state.day); if (!d) return null;
    var q = norm(state.rq);
    var list = d.stops.map(function (code, i) { return { no: i + 1, code: code, lv: lastVisit(code, state.day) }; })
      .filter(function (s) { return !q || norm(byCode[s.code].name + ' ' + s.code).indexOf(q) >= 0; });
    return state.rs ? list.sort(RCMP[state.rs]) : list;
  }
  function renderRoute() {
    var d = routeDay(state.day);
    $('day').value = state.day; $('day-val').textContent = dDot(state.day);
    $('day').setAttribute('aria-label', 'Маршрутын өдөр, ' + dDot(state.day));
    var prev = days.filter(function (x) { return x < state.day; }).pop(), next = days.filter(function (x) { return x > state.day; })[0];
    $('day-prev').setAttribute('aria-disabled', String(!prev)); $('day-next').setAttribute('aria-disabled', String(!next));
    $('day-prev').dataset.go = prev || ''; $('day-next').dataset.go = next || '';
    $('rt-sort').value = state.rs; if ($('rt-q').value !== state.rq) $('rt-q').value = state.rq;
    $('route-note').innerHTML = routeNote(d);
    var none = !d;
    ['route-tools', 'route-links'].forEach(function (cl) { document.querySelector('.' + cl).hidden = none; });
    document.querySelector('.rt-head').hidden = none;
    if (none) {
      $('route-list').innerHTML = '';
      $('route-empty').hidden = false;
      $('route-empty').textContent = dDot(state.day) + '-нд жишиг маршрут тохируулаагүй. Тохируулсан өдөр: ' + days.map(dDot).join(', ') + '.';
      writeUrl();
      return;
    }
    var stops = routeStops(), att = d.stops.filter(function (c) { return attention(byCode[c]); }).length;
    $('rt-attn-n').textContent = att; $('rt-all-n').textContent = d.stops.length;
    $('route-count').textContent = state.rq ? stops.length + '/' + d.stops.length + ' дэлгүүр харуулж байна' : d.stops.length + ' дэлгүүр';
    $('rt-clear').hidden = !state.rq;
    $('route-empty').hidden = stops.length > 0;
    $('route-empty').textContent = '«' + state.rq + '» гэсэн дэлгүүр энэ маршрутад алга.';
    $('route-list').innerHTML = stops.map(function (s) {
      var c = byCode[s.code], why = reason(c), gap = s.lv ? daysBetween(s.lv, state.day) : null;
      return '<li class="rt-item"><button type="button" class="rt-row" data-code="' + esc(c.code) + '" aria-haspopup="dialog">' +
        '<span class="rt-no num" title="Хуваарьт дараалал">' + s.no + '</span>' +
        '<span class="rt-main"><b>' + esc(c.name) + '</b><span>' + esc(c.code + ' · ' + c.aimag + ' · ' + c.type) + '</span></span>' +
        '<span class="rt-why' + (why[0] ? ' why-' + why[0] : '') + '">' + esc(why[1]) + '</span>' +
        '<span class="rt-visit num">' + (s.lv ? '<b>' + shortDate(s.lv) + '</b><span>' + gap + ' хоног</span>' : '<span class="muted-s">Очсон бүртгэлгүй</span>') + '</span>' +
        '<svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button>' +
        (hasReport(c.code) ? '<a class="icon-btn rt-win" href="' + esc(reportUrl(c.code)) + '" data-report="' + esc(c.code) + '" aria-label="' + esc(c.name) + ': дэлгүүрийн цонх нээх" title="Дэлгүүрийн цонх">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-store"/></svg></a>' : '<span class="rt-win-none" aria-hidden="true"></span>') + '</li>';
    }).join('');
    writeUrl();
  }
  function setDay(v) { if (!v) return; state.day = v; renderRoute(); if (state.scope) renderCustomers(); }

  // ---------- customers ----------
  function inRoute(c) { var d = routeDay(state.day); return !!d && d.stops.indexOf(c.code) >= 0; }
  function base() {   // scope: secondary filters (+ the selected day's route); every chip count and the result total use it
    return FX.customers.filter(function (c) {
      return (state.rec === 'all' || c.record === state.rec) && (!state.aimag || c.aimag === state.aimag) && (!state.type || c.type === state.type) &&
        (state.scope !== 'route' || inRoute(c));
    });
  }
  function inChip(c, f) { return f === 'all' || (f === 'attention' ? attention(c) : has(c, f)); }
  var code = function (a, b) { return a.code.localeCompare(b.code); };
  var validB = function (c) { return c.b > 0; };
  var CMP = {   // real (unrounded) values; ties by a meaningful value, then code; no comparison base / never purchased always last
    decline: function (a, b) { return (validB(b) - validB(a)) || (validB(a) && validB(b) ? (a.r - a.b) - (b.r - b.b) || a.rate - b.rate : 0) || code(a, b); },
    pct_down: function (a, b) { return (validB(b) - validB(a)) || (validB(a) && validB(b) ? a.rate - b.rate || (a.r - a.b) - (b.r - b.b) : 0) || code(a, b); },
    pct_up: function (a, b) { return (validB(b) - validB(a)) || (validB(a) && validB(b) ? b.rate - a.rate || (b.r - b.b) - (a.r - a.b) : 0) || code(a, b); },
    last_new: function (a, b) { return (a.last === null) - (b.last === null) || (a.last > b.last ? -1 : a.last < b.last ? 1 : 0) || code(a, b); },
    last_old: function (a, b) { return (a.last === null) - (b.last === null) || (a.last < b.last ? -1 : a.last > b.last ? 1 : 0) || code(a, b); },
    t12: function (a, b) { return b.t12 - a.t12 || code(a, b); },
    lapsed: function (a, b) { return b.t12 - a.t12 || (b.gap || 0) - (a.gap || 0) || code(a, b); },
    name: function (a, b) { return a.name.localeCompare(b.name, 'mn') || code(a, b); }
  };
  var DEFAULT_SORT = { declined: 'decline', lapsed: 'lapsed', never: 'name', all: 't12' };
  // → [{ title|null, rows }]: default «Анхаарах» = lapsed first (12-month value), then the other declined (largest ₮ drop); any chosen sort = one list
  function groups() {
    var q = norm(state.q);
    var list = base().filter(function (c) { return inChip(c, state.f) && (!q || norm(c.name + ' ' + c.code).indexOf(q) >= 0); });
    if (state.f === 'attention' && !state.sort) {
      var lap = list.filter(function (c) { return has(c, 'lapsed'); }).sort(CMP.lapsed);
      var dec = list.filter(function (c) { return !has(c, 'lapsed') && has(c, 'declined'); }).sort(CMP.decline);
      return [{ title: 'Авалт тасарсан', note: '12 сарын дүнгээр', rows: lap }, { title: 'Буурсан', note: 'бууралтын дүнгээр', rows: dec }].filter(function (g) { return g.rows.length; });
    }
    return [{ title: null, rows: list.sort(CMP[state.sort || DEFAULT_SORT[state.f]]) }];
  }
  function spark(c) {   // 12 bars from a shared zero line; negatives below it; the two compared quarters tinted
    var w = 6, gap = 2, h = 28, vals = c.m, maxP = Math.max.apply(null, vals.concat([0])), maxN = Math.max.apply(null, vals.map(function (v) { return -v; }).concat([0]));
    var span = maxP + maxN || 1, zero = h * maxP / span, nR = W.recent.length, nB = W.base.length, L = vals.length;
    return '<svg class="spark" width="' + (L * (w + gap) - gap) + '" height="' + h + '" viewBox="0 0 ' + (L * (w + gap) - gap) + ' ' + h + '" aria-hidden="true">' +
      '<line x1="0" x2="' + (L * (w + gap)) + '" y1="' + zero.toFixed(1) + '" y2="' + zero.toFixed(1) + '" class="sp-zero"/>' +
      vals.map(function (v, k) {
        var bh = Math.abs(v) / span * h, y = v >= 0 ? zero - bh : zero, cls = k >= L - nR ? 'sp-r' : k >= L - nR - nB ? 'sp-b' : 'sp-o';
        return v === 0 ? '' : '<rect x="' + k * (w + gap) + '" y="' + y.toFixed(1) + '" width="' + w + '" height="' + Math.max(1, bh).toFixed(1) + '" rx="1" class="' + cls + '"/>';
      }).join('') + '</svg>';
  }
  function badges(c) {
    return c.flags.map(function (f) { return '<span class="flag fl-' + f + '">' + FLAG[f] + '</span>'; }).join('') + (c.record === 'old' ? '<span class="flag fl-old">Хуучин бүртгэл</span>' : '');
  }
  function row(c) {
    var chg = c.b > 0 ? '<b class="' + (c.rate <= -R.declined.min_drop_pct ? 'neg' : c.rate < 0 ? 'down' : '') + '">' + pctS(c.rate) + '</b><span>' + signed(c.r - c.b) + '</span>'
      : '<span class="muted-s">Суурьгүй</span>';
    var last = c.last ? '<b>' + shortDate(c.last) + '</b><span>' + c.gap + ' хоног</span>' : '<span class="muted-s">Авч байгаагүй</span>';
    return '<li><button type="button" class="cu-row" data-code="' + esc(c.code) + '" aria-haspopup="dialog" aria-label="' + esc(ariaRow(c)) + '">' +
      '<span class="cu-name"><span class="cu-n1"><b>' + esc(c.name) + '</b>' + badges(c) + '</span><span class="cu-n2">' + esc(c.code + ' · ' + c.aimag + ' · ' + c.type) + '</span></span>' +
      '<span class="cu-t12 num">' + money(c.t12) + '</span>' +
      '<span class="cu-chg num">' + chg + '</span>' +
      '<span class="cu-last num">' + last + '</span>' +
      '<span class="cu-spark">' + spark(c) + '</span></button></li>';
  }
  function ariaRow(c) {
    return c.name + ', ' + c.code + '. 12 сарын дүн ' + money(c.t12) + (c.b > 0 ? ', өмнөх 3 сараас ' + pctS(c.rate) : ', харьцуулах суурьгүй') +
      (c.last ? ', сүүлд авсан ' + dDot(c.last) + ', ' + c.gap + ' хоног' : ', авч байгаагүй') + (c.flags.length ? '. ' + c.flags.map(function (f) { return FLAG[f]; }).join(', ') : '');
  }
  function renderCustomers() {
    var b = base(), cnt = {};
    CHIPS.forEach(function (f) { cnt[f] = b.filter(function (c) { return inChip(c, f); }).length; });
    $('cu-sum').innerHTML = '<span class="cu-sum-l">Нийт портфель</span><span><b>' + FX.portfolio.n + '</b> харилцагч</span><span>12 сарын дүн <b>' + money(FX.portfolio.t12) + '</b> <span class="muted-s">' + range(W.months) + '</span></span>' +
      '<span>Анхаарах <b>' + FX.counts.attention + '</b></span>';
    $('cu-chips').innerHTML = CHIPS.map(function (f) {
      return '<button type="button" class="seg-btn" data-chip="' + f + '" aria-pressed="' + (state.f === f) + '">' + CHIP_LABEL[f] + ' <b class="num">' + cnt[f] + '</b></button>';
    }).join('');
    if ($('cu-q').value !== state.q) $('cu-q').value = state.q;
    $('cu-rec').value = state.rec; $('cu-aimag').value = state.aimag; $('cu-type').value = state.type; $('cu-sort').value = state.sort;
    var d = routeDay(state.day);
    $('cu-scope').hidden = state.scope !== 'route';
    if (state.scope === 'route') $('cu-scope').innerHTML = 'Маршрут ' + dDot(state.day) + (d ? ' · ' + d.stops.length : ' · хуваарьгүй') + '<span aria-hidden="true"> ✕</span>';
    $('cu-scope').setAttribute('aria-label', 'Маршрутын хүрээг арилгах');
    var gs = groups(), rows = gs.reduce(function (t, g) { return t.concat(g.rows); }, []);
    $('cu-count').innerHTML = '<span class="cu-res-l">Шүүлтийн үр дүн</span> <b>' + rows.length + '</b> харилцагч · 12 сарын дүн <b>' + money(rows.reduce(function (t, c) { return t + c.t12; }, 0)) + '</b>' +
      (b.length !== FX.portfolio.n ? ' <span class="muted-s">(хүрээ ' + b.length + ' харилцагч)</span>' : '');
    $('cu-list').innerHTML = gs.map(function (g) {
      return (g.title ? '<h3 class="cu-gh"><span>' + g.title + ' <b class="num">' + g.rows.length + '</b></span><span>' + g.note + '</span></h3>' : '') +
        '<ul class="cu-list">' + g.rows.map(row).join('') + '</ul>';
    }).join('');
    $('cu-empty').hidden = rows.length > 0;
    $('cu-empty').textContent = 'Тохирох харилцагч алга. Шүүлтээ цэвэрлэж үзнэ үү.';
    $('cu-reset').hidden = !(state.q || state.rec !== 'all' || state.aimag || state.type || state.sort || state.scope);
    var sec = (state.rec !== 'all') + !!state.aimag + !!state.type;   // phone: secondary filters fold behind «Шүүлт»
    $('cu-more-n').textContent = sec; $('cu-more-n').hidden = !sec;
    writeUrl();
  }

  // ---------- detail drawer (every customer) ----------
  var drawer = { opener: null, y: 0, code: null, k: 11 };
  function chart(c) {
    var vals = c.m, maxP = Math.max.apply(null, vals.concat([0])), maxN = Math.max.apply(null, vals.map(function (v) { return -v; }).concat([0]));
    var span = maxP + maxN || 1, zero = maxN / span * 100;   // % from the bottom
    return '<section class="pd-sec rr-chart"><h3>12 сарын татан авалт <span>' + range(W.months) + '</span></h3>' +
      '<div class="rc-bars" role="group" aria-label="12 сарын татан авалт" style="--zero:' + zero.toFixed(2) + '%">' + vals.map(function (v, k) {
        var ym = W.months[k], mm = ym.slice(5), yr = k === 0 || mm === '01' ? ym.slice(0, 4) : '';
        var h = Math.abs(v) / span * 100, cls = k >= vals.length - W.recent.length ? ' r' : k >= vals.length - W.recent.length - W.base.length ? ' b' : '';
        return '<button type="button" class="rc' + cls + (yr && k ? ' yr-start' : '') + '" data-k="' + k + '" aria-label="' + esc(ymDot(ym) + ': ' + money(v)) + '">' +
          '<span class="rc-plot"><span class="rc-bar' + (v < 0 ? ' neg' : '') + '" style="height:' + h.toFixed(2) + '%"></span></span>' +
          '<span class="rc-m num">' + mm + '</span><span class="rc-y num">' + yr + '</span></button>';
      }).join('') + '</div>' +
      '<div class="mini-nav"><button type="button" class="icon-btn step" data-step="-1" aria-label="Өмнөх сар"><svg class="ic" aria-hidden="true"><use href="#i-left"/></svg></button>' +
      '<p class="mini-read num" aria-live="polite" id="rc-read"></p>' +
      '<button type="button" class="icon-btn step" data-step="1" aria-label="Дараагийн сар"><svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button></div>' +
      '<p class="rc-legend"><i class="lg-b"></i>Өмнөх 3 сар <i class="lg-r"></i>Сүүлийн 3 сар</p>' +
      '<details class="rc-list"><summary>Сар бүрийн дүн</summary><ul>' + vals.map(function (v, k) {
        return '<li><span class="num">' + ymDot(W.months[k]) + '</span><span class="num">' + money(v) + '</span></li>';
      }).join('') + '</ul></details></section>';
  }
  function headline(c) {   // the 1–2 lines that say why this customer matters, with the key number
    var out = [];
    if (has(c, 'lapsed')) out.push(['lapsed', c.gap + ' хоног авалтгүй · сүүлд ' + dDot(c.last)]);
    if (has(c, 'declined')) out.push(['declined', pctS(c.rate) + ' · ' + signed(c.r - c.b) + ' (сүүлийн 3 сар)']);
    if (has(c, 'never')) out.push(['never', dDot(FX.coverage.from) + '-аас хойш авалт бүртгэгдээгүй']);
    return out;
  }
  function pickBar(k) {
    var bars = Array.prototype.slice.call($('dr-body').querySelectorAll('.rc')), c = byCode[drawer.code];
    k = Math.max(0, Math.min(bars.length - 1, k));
    bars.forEach(function (b, i) { b.classList.toggle('is-insp', i === k); b.setAttribute('aria-pressed', String(i === k)); });
    $('rc-read').innerHTML = '<b>' + ymDot(W.months[k]) + '</b> · ' + money(c.m[k]) + (c.m[k] === 0 ? ' · авалтгүй' : '');
    var steps = $('dr-body').querySelectorAll('[data-step]');
    steps[0].setAttribute('aria-disabled', String(k <= 0)); steps[1].setAttribute('aria-disabled', String(k >= bars.length - 1));
    drawer.k = k;
  }
  function openDetail(code, opener) {
    var c = byCode[code], ready = hasReport(code), d = routeDay(state.day), no = d ? d.stops.indexOf(code) + 1 : 0, lv = lastVisit(code, state.day);
    drawer.code = code; drawer.opener = opener || document.activeElement; drawer.y = window.scrollY;
    $('dr-kind').innerHTML = '<span>Харилцагч</span>';
    $('dr-title').textContent = c.name;
    $('dr-sub').textContent = [c.code, c.aimag, c.type, c.record === 'old' ? 'Хуучин бүртгэл' : 'Одоогийн бүртгэл'].join(' · ');
    var fact = function (l, v, s) { return '<div><dt>' + l + '</dt><dd class="num">' + v + (s ? '<span>' + s + '</span>' : '') + '</dd></div>'; };
    var hl = headline(c);
    $('dr-body').innerHTML =
      (ready ? '<a class="btn rr-cta" id="dr-report" href="' + esc(reportUrl(code)) + '"><svg class="ic" aria-hidden="true"><use href="#i-store"/></svg>Дэлгүүрийн цонх нээх</a>'
        : '<p class="rr-nocta">Бүрэн дэлгүүрийн тайлан энэ демод бэлэн биш.</p>') +
      (hl.length ? '<section class="pd-sec rr-why">' + hl.map(function (w) { return '<p><span class="flag fl-' + w[0] + '">' + FLAG[w[0]] + '</span><b class="num">' + esc(w[1]) + '</b></p>'; }).join('') + '</section>' : '') +
      '<section class="pd-sec"><dl class="rr-facts">' +
        fact('12 сарын дүн', money(c.t12), range(W.months)) + fact('Сарын дундаж', money(c.t12 / 12)) +
        fact('Сүүлийн 3 сар', money(c.r), range(W.recent)) + fact('Өмнөх 3 сар', money(c.b), c.b > 0 ? range(W.base) : 'харьцуулах суурьгүй') +
        fact('Сүүлийн авалт', c.last ? dDot(c.last) : 'Авч байгаагүй', c.last ? c.gap + ' хоног · ' + c.days12 + ' өдөр авсан (12 сар)' : '') +
        fact('Сүүлд очсон', lv ? dDot(lv) : 'Очсон бүртгэлгүй', lv ? daysBetween(lv, state.day) + ' хоног (' + dDot(state.day) + '-ны байдлаар)' : '') + '</dl>' +
        (no ? '<p class="rr-route-info num">Маршрут ' + dDot(state.day) + ' · №' + no + '</p>' : '') + '</section>' +
      chart(c) +
      '<details class="rr-rules dr-calc"><summary>Тооцоолол</summary><p>12 сар ' + range(W.months) + '; сүүлийн 3 сар ' + range(W.recent) + ', өмнөх 3 сар ' + range(W.base) +
        '. Буурсан: ' + R.declined.min_drop_pct + '%+ бууралт; авалт тасарсан: 12 сард ' + R.lapsed.min_purchase_days + '+ өдөр авсан, ' + R.lapsed.min_gap_days + '+ хоног авалтгүй. ' +
        'Сүүлийн авалт нь ' + dDot(FX.cutoff) + ' хүртэлх борлуулалтаас; «Сүүлд очсон» нь жишиг очилтын бүртгэл (сонгосон өдрөөс хойших бүртгэлийг тооцохгүй).</p></details>';
    var dlg = $('dr');
    if (!dlg.open) { document.documentElement.classList.add('modal-open'); dlg.showModal(); }
    $('dr-body').scrollTop = 0;
    pickBar(c.m.length - 1);
    dlg.querySelector('[data-close]').focus();
  }
  function onClose() {
    document.documentElement.classList.remove('modal-open');
    window.scrollTo(0, drawer.y);
    var o = drawer.opener;
    if (o && !document.contains(o)) o = document.querySelector('#panel-' + state.tab + ' [data-code="' + drawer.code + '"]');
    if (o) o.focus({ preventScroll: true });
  }

  // returning from a store report: same tab/day/sorts/filters (URL) and the scroll position + row focus saved before leaving
  function rememberReturn(code) {
    try { sessionStorage.setItem('rr-return', JSON.stringify({ q: query(), y: window.scrollY, code: code })); } catch (e) { /* private mode: URL state still restores */ }
  }
  function restoreReturn() {
    var r = null;
    try { r = JSON.parse(sessionStorage.getItem('rr-return') || 'null'); sessionStorage.removeItem('rr-return'); } catch (e) { r = null; }
    if (!r || r.q !== query()) return;
    requestAnimationFrame(function () {
      window.scrollTo(0, r.y);
      var el = document.querySelector('#panel-' + state.tab + ' [data-code="' + r.code + '"]');
      if (el) el.focus({ preventScroll: true });
    });
  }

  // ---------- events ----------
  function keepCaret(inp, fn) { var s = inp.selectionStart, e = inp.selectionEnd, y = window.scrollY; fn(); if (document.activeElement !== inp) inp.focus(); try { inp.setSelectionRange(s, e); } catch (x) { /* type=search */ } window.scrollTo(0, y); }
  function toCustomers(f, scope) {   // shortcuts: a fresh, clearly scoped list
    state.f = f; state.scope = scope; state.rec = 'all'; state.aimag = ''; state.type = ''; state.q = ''; state.sort = '';
    scrollY.customers = 0; renderCustomers(); selectTab('customers'); window.scrollTo(0, 0); $('tab-customers').focus({ preventScroll: true });
  }
  function bind() {
    TABS.forEach(function (t) { $('tab-' + t).addEventListener('click', function () { selectTab(t); }); });
    $('tabs').addEventListener('keydown', function (e) {
      var k = TABS.indexOf(state.tab), n = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: TABS.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault(); selectTab(TABS[(n + TABS.length) % TABS.length], true);
    });
    $('attn-link').addEventListener('click', function () { toCustomers('attention', ''); });
    $('rt-attn').addEventListener('click', function () { toCustomers('attention', 'route'); });
    $('rt-all').addEventListener('click', function () { toCustomers('all', 'route'); });
    // date: the visible value is 2026.10.22; a transparent native date input covers it (keyboard segments, screen readers, mobile pickers)
    ['change', 'input'].forEach(function (ev) { $('day').addEventListener(ev, function () { if (/^\d{4}-\d{2}-\d{2}$/.test(this.value) && this.value !== state.day) setDay(this.value); }); });
    $('day').addEventListener('click', function () { try { this.showPicker(); } catch (e) { /* the browser's own picker behaviour */ } });
    ['day-prev', 'day-next'].forEach(function (id) {
      $(id).addEventListener('click', function () { if (this.getAttribute('aria-disabled') !== 'true') setDay(this.dataset.go); });
    });
    $('rt-sort').addEventListener('change', function () { state.rs = this.value; renderRoute(); });
    $('rt-q').addEventListener('input', function () { var inp = this; keepCaret(inp, function () { state.rq = inp.value.slice(0, 40); renderRoute(); }); });
    $('rt-clear').addEventListener('click', function () { state.rq = ''; renderRoute(); $('rt-q').focus(); });
    $('cu-chips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-chip]'); if (!b) return;
      state.f = b.dataset.chip; renderCustomers();
      var nb = $('cu-chips').querySelector('[data-chip="' + state.f + '"]'); if (nb) nb.focus();
    });
    $('cu-q').addEventListener('input', function () { var inp = this; keepCaret(inp, function () { state.q = inp.value.slice(0, 40); renderCustomers(); }); });
    [['cu-rec', 'rec'], ['cu-aimag', 'aimag'], ['cu-type', 'type'], ['cu-sort', 'sort']].forEach(function (p) {
      $(p[0]).addEventListener('change', function () { state[p[1]] = this.value; renderCustomers(); });
    });
    $('cu-scope').addEventListener('click', function () { state.scope = ''; renderCustomers(); $('cu-q').focus(); });
    $('cu-more').addEventListener('click', function () {
      var open = this.getAttribute('aria-expanded') !== 'true';
      this.setAttribute('aria-expanded', String(open)); document.querySelector('.cu-tools').classList.toggle('more', open);
    });
    $('cu-reset').addEventListener('click', function () { state.q = ''; state.rec = 'all'; state.aimag = ''; state.type = ''; state.sort = ''; state.scope = ''; renderCustomers(); $('cu-q').focus(); });
    document.addEventListener('click', function (e) {
      var r = e.target.closest('.rt-row, .cu-row'); if (r) { openDetail(r.dataset.code, r); return; }
      var a = e.target.closest('a[data-report], #dr-report');
      if (!a) return;
      rememberReturn(a.dataset.report || drawer.code);
      // same Mini App webview, Telegram launch data kept (without the shared script the link itself navigates)
      if (window.WS && !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && window.WS.go(a.getAttribute('href'))) e.preventDefault();
    });
    // Telegram Back (one handler, owned by workspace.js): an open drawer closes first; otherwise «Миний ажил»
    if (window.WS) window.WS.page({ back: function () { if (!dlg.open) return false; dlg.close(); return true; } });
    var dlg = $('dr');
    dlg.addEventListener('close', onClose);
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('[data-close]')) { dlg.close(); return; }
      var bar = e.target.closest('.rc'); if (bar) { pickBar(Number(bar.dataset.k)); return; }
      var st = e.target.closest('[data-step]'); if (st && st.getAttribute('aria-disabled') !== 'true') pickBar(drawer.k + Number(st.dataset.step));
    });
    dlg.addEventListener('keydown', function (e) {
      var bar = e.target.closest('.rc'); if (!bar) return;
      var n = { ArrowRight: drawer.k + 1, ArrowLeft: drawer.k - 1, Home: 0, End: 11 }[e.key];
      if (n === undefined) return;
      e.preventDefault(); pickBar(n); $('dr-body').querySelectorAll('.rc')[drawer.k].focus();
    });
  }

  window.RepRoute = {
    state: function () { return JSON.parse(JSON.stringify(state)); }, query: query,
    visible: function () { return groups().map(function (g) { return { title: g.title, codes: g.rows.map(function (c) { return c.code; }) }; }); },
    route: function () { var s = routeStops(); return s && s.map(function (x) { return { no: x.no, code: x.code, lastVisit: x.lv }; }); },
    lastVisit: lastVisit, visitGap: visitGap,
    openDetail: function (code) { openDetail(code, null); }
  };
  init();
})();
