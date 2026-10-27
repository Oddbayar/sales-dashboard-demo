/* Дэлгүүрийн тайлан — one store, one fixture (data/fixture.js).
   Report month state drives the cards, the 12-month chart (₮ or liters of l/ml-packed SKUs), the Бараа | Брэнд | Категори
   lists and every entity drawer. One right drawer (#dr) holds a view stack: product / brand (optionally inside a category) /
   category (→ brands → products) / product card (assortment) / programs. Rows never cross-filter the main lists. */
(function () {
  'use strict';
  var FX = window.STORE_REPORT_FIXTURE, REG = window.STORE_REPORT_REGISTRY, SC = window.StoreCodes;   // fixture, supported reports, code rules
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- formatting ----------
  function fmt(n) { var s = Math.round(Math.abs(n)).toLocaleString('en-US'); return (n < 0 ? '−' : '') + s; }
  function money(n) { return fmt(n) + ' ₮'; }   // no line break between the number and ₮
  function moneyBig(n) { return fmt(n) + '<span class="unit">₮</span>'; }
  function compactParts(n) {
    if (Math.abs(n) >= 1e6) return [(n / 1e6).toFixed(2), 'сая'];
    if (Math.abs(n) >= 1e3) return [String(Math.round(n / 1e3)), 'мян'];
    return [fmt(n), '₮'];
  }
  function compactText(n) { var c = compactParts(n); return c[0] + ' ' + c[1]; }
  function pct(x) { return x.toFixed(1) + '%'; }
  // liters: summed at full precision in the fixture, rounded to 0.1 л only here; never a currency formatter
  function liters(v) { return v == null ? '—' : (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' л'; }
  function ymDot(ym) { return ym.replace('-', '.'); }
  function md(iso) { return iso.slice(5).replace('-', '.'); }
  function dDot(iso) { return iso.replace(/-/g, '.'); }
  function ymAdd(ym, k) { var y = +ym.slice(0, 4), m = +ym.slice(5) + k; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return y + '-' + (m < 10 ? '0' : '') + m; }
  function chartMonths(ym) { var a = []; for (var k = 11; k >= 0; k--) a.push(ymAdd(ym, -k)); return a; } // selected month + previous 11
  function monthLabel(m) { return ymDot(m.ym) + (m.is_partial ? ' (1–' + Number(m.end.slice(8)) + ')' : ''); }
  var WD = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
  function weekday(iso) { var p = iso.split('-'); return WD[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sum(a, f) { return a.reduce(function (t, x) { return t + f(x); }, 0); }

  // ---------- labels & visuals (display only; fixture values untouched) ----------
  var LABEL = { 'Minimarket': 'Минимаркет', 'Supermarket': 'Супермаркет', 'Grosery A': 'Хүнсний дэлгүүр A', 'Grosery B': 'Хүнсний дэлгүүр B',
    'Region Customer': 'Орон нутгийн харилцагч', 'Pre Sales Customer': 'Урьдчилсан захиалгат харилцагч', 'Active': 'Идэвхтэй', 'Inactive Customer': 'Идэвхгүй' };
  function lbl(v) { return v == null || v === '' ? '—' : (LABEL[v] || v); }
  var CAT = { 'Аяга таваг угаах': ['dish', '#2563EB'], 'Хувийн ариун цэвэр': ['hygiene', '#0284C7'], 'Угаалгын бүтээгдэхүүн': ['laundry', '#0D9488'],
    'Цаасан бүтээгдэхүүн': ['paper', '#6366F1'], 'Гэр цэвэрлэгээ': ['clean', '#D97706'], 'Амны хөндийн арчилгаа': ['oral', '#DB2777'],
    'Гэр ахуйн хэрэгсэл': ['tools', '#475569'] };
  function catVis(name) { return CAT[name] || ['other', '#64748B']; }
  function catIcon(name, cls) {
    var v = catVis(name);
    return '<span class="cat-ic' + (cls ? ' ' + cls : '') + '" style="--c:' + v[1] + '"><svg aria-hidden="true"><use href="#c-' + v[0] + '"/></svg></span>';
  }
  function catDot(name) { return '<span class="cat-dot" style="--c:' + catVis(name)[1] + '"></span>'; }
  function brandShort(b) { return String(b || '—').replace(/^Демо\s+/, ''); }
  function brandIcon(b, cls) { return '<span class="brand-ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + esc(brandShort(b).charAt(0)) + '</span>'; }
  var UNIT = { l: 'л', ml: 'мл', g: 'г', kg: 'кг', pcs: 'ш', m: 'м' };
  function packText(m) { return m.pack_size == null ? null : (+m.pack_size).toLocaleString('en-US') + ' ' + (UNIT[m.pack_unit] || m.pack_unit || ''); }
  function meta(code) { return FX.product_meta[code] || {}; }

  // ---------- rules (demo conditions; pure, exposed for QA) ----------
  function tierFor(a) { var i = 0; for (var k = 0; k < FX.tiers.length; k++) if (a >= FX.tiers[k].min) i = k; return i; }
  function bonusFor(a) { return Math.round(Math.max(0, a) * FX.tiers[tierFor(a)].rate); } // the bracket's rate applies to the whole total
  function nextGap(a) { var i = tierFor(a); return i >= FX.tiers.length - 1 ? null : Math.max(0, FX.tiers[i + 1].min - a); }
  function rateText(i) { return Math.round(FX.tiers[i].rate * 100) + '%'; }
  function shortTier(i) { return i === 0 ? 'Суурь' : FX.tiers[i].name.split(' ')[0] + ' · ' + rateText(i); }
  // money-plan achievement: 'none' (no valid plan) | 'met' | 'sofar' (partial month already past the plan) | 'not'
  function planOf(ym) { var p = (FX.plans || {})[ym]; return p && p.plan > 0 ? p.plan : null; }
  function achState(amount, plan, partial) { return plan == null || !(plan > 0) ? 'none' : amount >= plan ? (partial ? 'sofar' : 'met') : 'not'; }
  var ACH = { met: 'Төлөвлөгөө биелсэн', sofar: 'Одоогоор биелсэн' };

  // ---------- aggregates (store scope; one SKU → one brand / category via catalog metadata) ----------
  var DIM = { brands: 'brand', categories: 'category' };
  function groupFor(ym, dim) {
    var by = {}, order = [];
    (FX.products[ym] || []).forEach(function (p) {
      var k = meta(p.code)[dim] || (dim === 'category' ? p.category : '—');
      if (!by[k]) { by[k] = { name: k, amount: 0, n: 0, last: '' }; order.push(k); }
      by[k].amount += p.amount; by[k].n += 1; if (p.last_date > by[k].last) by[k].last = p.last_date;
    });
    var total = byYm[ym].amount;
    return order.map(function (k) {
      var c = by[k];
      c.share = total > 0 && c.amount >= 0 ? c.amount / total * 100 : null; // net-negative entity or non-positive month: no share
      return c;
    }).sort(function (x, y) { return y.amount - x.amount || x.name.localeCompare(y.name, 'mn'); });
  }
  function categoriesFor(ym) { return groupFor(ym, 'category'); }
  // entity scope e = { dim: 'brand' | 'category', name, cat? } — a brand opened from a category is limited to that category
  function inScope(e, c) { var m = meta(c); return m[e.dim] === e.name && (!e.cat || m.category === e.cat); }
  function skusIn(e) { return Object.keys(FX.sku_months).filter(function (c) { return inScope(e, c); }); }
  function eMonth(e, ym) { return sum(skusIn(e), function (c) { return skuMonth(c, ym); }); }
  function skuMonth(code, ym) { var v = (FX.sku_months[code] || {})[ym]; return v ? v[0] : 0; }
  function avg12(valueOf, ym) { var ms = FX.averages[ym].months; return sum(ms, valueOf) / ms.length; } // previous 12 full months, zeros count
  // the selected month's group row for a scope (amount, SKUs bought, last date)
  function eGroup(e, ym) {
    var g = { amount: 0, n: 0, last: '' };
    (FX.products[ym] || []).forEach(function (p) { if (inScope(e, p.code)) { g.amount += p.amount; g.n += 1; if (p.last_date > g.last) g.last = p.last_date; } });
    return g;
  }

  // ---------- assortment (product card): current 30-day snapshot, independent of the report month ----------
  function asItems() {
    var A = FX.assortment || {}, min = (A.profile || {}).min_units || 1;
    return (A.items || []).map(function (i) {
      var need = !(i.q30 >= min);
      // net-return / partial cases: activity in the window but still below the 1+ rule → never called «Аваагүй»
      return { code: i.code, q30: i.q30, a30: i.a30, d30: i.d30 || 0, d90: i.d90, last: i.last, need: need, short: need && (i.d30 > 0 || i.q30 < 0) };
    });
  }
  function asCoverage() {
    var it = asItems(), have = it.filter(function (i) { return !i.need; }).length;
    return { n: it.length, have: have, need: it.length - have, pct: it.length ? have / it.length * 100 : null }; // no set → no percentage
  }
  function asBadge(c) { return c.have + '/' + c.n + ' · ' + pct(c.pct); }
  function asOrder(x, y) {
    // not met first (activity in the window, then most recent purchase, never bought last), then met by 30-day quantity
    return (y.need - x.need) || (x.need ? (y.short - x.short) || (y.last || '').localeCompare(x.last || '') : (y.q30 - x.q30)) ||
      (meta(x.code).name || '').localeCompare(meta(y.code).name || '', 'mn');
  }
  function asGroups(items) {
    var by = {}, order = [];
    items.slice().sort(asOrder).forEach(function (i) {
      var b = meta(i.code).brand || '—';
      if (!by[b]) { by[b] = { brand: b, items: [] }; order.push(b); }
      by[b].items.push(i);
    });
    return order.map(function (b) { return by[b]; }).sort(function (x, y) {
      var nx = x.items.filter(function (i) { return i.need; }).length, ny = y.items.filter(function (i) { return i.need; }).length;
      return (ny > 0) - (nx > 0) || ny - nx || brandShort(x.brand).localeCompare(brandShort(y.brand), 'mn');
    });
  }
  // the brand is the group header, so the row name drops the repeated brand prefix (variant and pack size stay)
  function nameInBrand(code) { var m = meta(code), n = m.name || code, b = m.brand || ''; return (b && n.indexOf(b + ' ') === 0 ? n.slice(b.length + 1) : n).replace(/(\d) (?=(ш|л|мл|г|кг)$)/, '$1 '); }
  function shortDate(iso) { return iso.slice(0, 4) === FX.cutoff.slice(0, 4) ? md(iso) : dDot(iso); }

  // ---------- state ----------
  var byYm = {};
  var state = { month: null, tab: 'products', q: '', sort: 'amount', showAll: false, inspect: null, metric: 'amount', fromLookup: false, ret: null, sv: null };
  var FIRST_ROWS = 8;

  function showState(title, text, linkText, href) {
    $('state-title').textContent = title;
    $('state-text').textContent = text;
    var a = $('state-link'); a.textContent = linkText; a.href = href;
    $('state').hidden = false;
    app.setAttribute('aria-busy', 'false');
    document.title = title + ' · Дэлгүүрийн тайлан';
  }

  // routes: ?view=lookup → code entry (wins over any other parameter; ?store only pre-fills the input);
  // ?store=<code>[&month=YYYY-MM][&from=lookup] → that report (code normalised like the bot: ST-13204, st-13204, 13204);
  // no parameters → the default report (local/standalone use).
  // ?sv=<team customer>[&a=<assignment>] → the supervisor's store window (Claude 30; see supervisor() below).
  // ?rep=<demo rep>&cust=<team customer>[&a=…][&at=task] → the same window for that demo rep's own tasks (Claude 31).
  function init() {
    var params = new URLSearchParams(location.search);
    document.addEventListener('click', function (e) {   // in-app links keep the Telegram launch data in the hash
      var a = e.target.closest('a[data-nav]');
      if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); nav(a.getAttribute('href'));
    });
    if (params.get('view') === 'lookup') { showLookup(params.get('store')); telegram(); return; }
    var failed = function () { showState('Мэдээлэл ачаалж чадсангүй', 'Хуудсыг дахин ачаална уу.', 'Дахин ачаалах', location.pathname + location.search); };
    if (params.get('sv') !== null || params.get('cust') !== null) { supervisor(params, failed); return; }
    if (!REG || !REG.stores) { failed(); return; }
    var want = (params.get('store') || '').trim();
    var code = want ? SC.normalize(want) : REG.default, entry = code && REG.stores[code];
    if (!entry) {   // only built reports open; another store's numbers are never substituted
      var ready = Object.keys(REG.stores);
      showState('Дэлгүүр олдсонгүй', '«' + want + '» кодтой дэлгүүрийн тайлан энэ демод алга. Бэлэн тайлан: ' + ready.join(', ') + '.',
        ready[0] + ' тайлан нээх', '?store=' + encodeURIComponent(ready[0]));
      telegram();
      return;
    }
    // each report has its own fixture file (registry path); it is loaded before anything renders
    loadScript(entry.fixture, function () {
      FX = window.STORE_REPORT_FIXTURE;
      if (!FX || !FX.months || FX.store.code !== code) { failed(); return; }
      start(params);
    }, failed);
  }
  function loadScript(src, done, failed) {
    var s = document.createElement('script');
    s.src = src; s.onerror = failed; s.onload = done;
    document.head.appendChild(s);
  }

  // ---------- supervisor context (Claude 30): opened from «Багийн хяналт» (ui/team-control) on the same origin ----------
  // The team page's scripts give the customer's identity and its report data profile (an explicit table, never matched by
  // amounts) and add the task section under the report. The report itself is this page, unchanged. Rep menus and the code
  // entry are hidden so the supervisor's work is not left by accident. Never loaded without ?sv= (or the rep demo's ?cust=).
  var SV = ['../team-control/data/fixture.js', '../team-control/data/profiles.js', '../team-control/assets/core.js', '../team-control/assets/store-panel.js'];
  function supervisor(params, failed) {
    document.documentElement.classList.add('sv-mode');
    if (params.get('sv') === null) document.documentElement.classList.add('rep-mode');
    Array.prototype.forEach.call(document.querySelectorAll('[data-ws-menu], #to-lookup, .state-alt'), function (el) { el.remove(); });
    var v = function (u) { return window.WS ? window.WS.asset(u) : u; };   // the published package's content versions
    if (window.WS) window.WS.page({ back: onTgBack });   // Telegram Back: drawer → the route / «Багийн хяналт» it came from
    (function next(k) {
      if (k < SV.length) { loadScript(v(SV[k]), function () { next(k + 1); }, failed); return; }
      window.TeamCore.ready.then(function () {   // the task store (IndexedDB) is open: assignments in links resolve against it
        var c = window.TeamStorePanel.resolve(params);
        if (c.fail) { showState.apply(null, c.fail); return; }   // unknown / another rep's customer: never another store's numbers
        loadScript(v(c.fixture), function () {
          FX = window.STORE_REPORT_FIXTURE;
          if (!FX || !FX.months || FX.store.code !== c.profile) { failed(); return; }
          FX.store = Object.assign({}, FX.store, c.store);   // the team customer's name, code and rep; the numbers stay the profile's
          state.sv = c;
          start(params);
        }, failed);
      });
    })(0);
  }

  function start(params) {
    state.fromLookup = !state.sv && params.get('from') === 'lookup';
    state.ret = (!state.sv || state.sv.role === 'rep') && params.get('from') === 'route' ? routeQuery(params.get('ret')) : null;
    if (state.ret !== null) { $('to-route').href = '../rep-route/' + (state.ret ? '?' + state.ret : ''); $('to-route').hidden = false; }
    FX.months.forEach(function (m) { byYm[m.ym] = m; });
    var m = params.get('month');
    state.month = FX.selectable_months.indexOf(m) >= 0 ? m : FX.selectable_months[0];
    renderStatic();
    bind();
    render();
    $('head').hidden = false; $('report').hidden = false;
    app.setAttribute('aria-busy', 'false');
    watchHeader();
    if (state.sv) window.TeamStorePanel.mount(FX); else telegram();
  }

  function nav(url, replace) { url += location.hash; if (replace) location.replace(url); else location.assign(url); }
  // «Миний маршрут» return state: only its own known keys with short plain values; the path is fixed (never an outside URL)
  var ROUTE_KEYS = ['tab', 'day', 'rs', 'rq', 'f', 'rec', 'aimag', 'type', 'q', 'sort', 'scope', 'demo', 'rep', 't'];   // demo/rep/t: the team demo (Claude 31)
  function routeQuery(raw) {
    var src = new URLSearchParams(raw || ''), out = new URLSearchParams();
    ROUTE_KEYS.forEach(function (k) { var v = src.get(k); if (v && v.length <= 60 && !/[<>:/\\]/.test(v)) out.set(k, v); });
    return out.toString();
  }

  // ---------- code entry (Telegram menu «Дэлгүүрийн цонх») ----------
  function showLookup(prefill) {
    var inp = $('lk-code'), msg = $('lk-msg'), sample = SC.sampleCode(REG);
    document.title = 'Дэлгүүрийн цонх · код оруулах';
    $('lk-sample').textContent = sample;
    if (prefill) inp.value = prefill;
    var say = function (t) { msg.textContent = t; msg.hidden = !t; inp.setAttribute('aria-invalid', String(!!t)); };
    $('lk-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var r = SC.resolve(inp.value, REG);
      if (r.status !== 'ok') { say(SC.message(r, REG, 'оруулна уу')); inp.focus(); return; }
      say('');
      nav(r.store.route + '&from=lookup');
    });
    inp.addEventListener('input', function () { if (!msg.hidden) say(''); });
    $('lk-sample').addEventListener('click', function () { inp.value = sample; say(''); inp.focus(); });
    $('lookup').hidden = false;
    app.setAttribute('aria-busy', 'false');
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) inp.focus();   // no surprise keyboard on touch
  }

  // ---------- Telegram Mini App (optional; only inside a Telegram client) ----------
  // The SDK setup and the ONE BackButton handler belong to the shared workspace script (../rep-home/assets/workspace.js),
  // so a single press never runs two handlers. It closes an open «Цэс» first, then asks this page for one step.
  function telegram() {
    if (window.WS) window.WS.page({ back: onTgBack });   // without the shared script the page is a plain website
  }
  // one step inside the drawer or dialog; a report returns to where it was opened from (the route's state, or the code entry).
  // false = the top of the store window (code entry, a report opened from chat, not-found): workspace.js then opens «Миний ажил».
  function onTgBack() {
    if ($('cd').open) $('cd').close();
    else if ($('dr').open) { if (drawer.stack.length > 1) popView(); else $('dr').close(); }
    else if (!$('report').hidden && (state.ret !== null || state.sv)) nav($('to-route').getAttribute('href'));   // team: the panel's way back
    else if (!$('report').hidden && state.fromLookup) nav('?view=lookup&store=' + encodeURIComponent(FX.store.code), true);
    else return false;
    return true;
  }
  function syncBack() { if (window.WS) window.WS.syncBack(); }

  function renderStatic() {
    var s = FX.store;
    document.title = s.name + ' · Дэлгүүрийн тайлан';
    $('store-name').textContent = s.name; $('bar-name').textContent = s.name;
    $('store-code').textContent = s.code; $('bar-code').textContent = s.code;
    $('store-sub').textContent = [s.aimag, lbl(s.sub_channel), 'Төлөөлөгч ' + s.rep_code].join(' · ');
    $('asof').textContent = FX.cutoff.replace(/-/g, '.') + '-ны байдлаар';
    var dl = [['Код', s.code], ['Аймаг', s.aimag], ['Суваг', lbl(s.sub_channel)], ['Харилцагчийн төрөл', lbl(s.sr_channel)],
      ['Төлөв', lbl(s.segment)], ['Төлөөлөгч', s.rep_code]];
    $('store-dl').innerHTML = dl.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('');
    var progN = currentPrograms().length;
    $('prog-count').textContent = progN; $('prog-count').hidden = progN === 0;
    $('prog-btn').setAttribute('aria-label', 'Харилцагчийн хөтөлбөр, ' + progN + ' хөтөлбөр');
    var cov = asCoverage();
    ['as-count', 'bar-as-count'].forEach(function (id) { $(id).textContent = cov.n ? asBadge(cov) : ''; $(id).hidden = cov.n === 0; });
    ['as-btn', 'bar-as'].forEach(function (id) {
      $(id).setAttribute('aria-label', 'Барааны карт' + (cov.n ? ', ' + cov.n + ' бараанаас ' + cov.have + ' авсан, ' + pct(cov.pct) : ''));
    });
    var opts = FX.selectable_months.map(function (ym) { return '<option value="' + ym + '">' + monthLabel(byYm[ym]) + '</option>'; }).join('');
    $('month').innerHTML = opts; $('month2').innerHTML = opts;
    $('cond-rows').innerHTML = FX.tiers.map(function (t, i) {
      var nx = FX.tiers[i + 1];
      var range = !nx ? '≥ ' + fmt(t.min) + ' ₮' : (i === 0 ? '< ' + fmt(nx.min) + ' ₮' : fmt(t.min) + ' – ' + fmt(nx.min - 1) + ' ₮');
      return '<tr data-i="' + i + '"><td class="num">' + range + '</td><td>' + esc(t.name) + '<span class="now-tag"></span></td><td class="r num">' + rateText(i) + '</td></tr>';
    }).join('');
  }

  // ---------- render ----------
  function render() {
    var mo = byYm[state.month];
    $('month').value = state.month; $('month2').value = state.month;
    var cats = groupFor(state.month, 'category'), brands = groupFor(state.month, 'brand');
    state.inspect = null;
    renderAmount(mo, cats, brands);
    renderTier(mo);
    renderHistory(mo);
    renderProducts();
    renderGroup('brands', brands);
    renderGroup('categories', cats);
    renderDays();
    if ($('dr').open) renderDrawer(true);   // an open drawer always shows the current month (never stale)
    var url = (state.sv ? state.sv.query : '?store=' + encodeURIComponent(FX.store.code)) + (state.month !== FX.selectable_months[0] ? '&month=' + state.month : '') + (state.fromLookup ? '&from=lookup' : '') +
      (state.ret !== null ? '&from=route' + (state.ret ? '&ret=' + encodeURIComponent(state.ret) : '') : '');
    if (location.search !== url) history.replaceState(null, '', url + location.hash);   // the hash may carry Telegram launch data
  }

  function renderAmount(mo, cats, brands) {
    var a = mo.amount, plan = FX.plans[mo.ym].plan;
    $('period').textContent = md(mo.start) + '–' + md(mo.end) + (mo.is_partial ? ' · ' + mo.days_in_period + '/' + mo.days_in_month + ' өдөр' : ' · бүтэн сар') +
      (mo.purchase_days ? ' · ' + mo.purchase_days + ' өдөр авалт' : '');
    $('amount').innerHTML = moneyBig(a);
    $('act-products').textContent = (FX.products[mo.ym] || []).length;
    $('act-brands').textContent = brands.length;
    $('act-categories').textContent = cats.length;
    $('plan').textContent = money(plan);
    var ach = plan > 0 ? a / plan * 100 : 0, st = achState(a, planOf(mo.ym), mo.is_partial);
    var track = $('plan-track');
    track.classList.toggle('done', a >= plan);
    track.setAttribute('aria-valuenow', String(Math.min(100, Math.max(0, Math.round(ach)))));
    track.setAttribute('aria-valuetext', pct(ach) + ' биелэлт');
    $('plan-fill').style.width = Math.min(100, Math.max(0, ach)) + '%';
    $('plan-pct').textContent = pct(ach) + ' биелэлт';
    $('plan-left').innerHTML = ACH[st]
      ? '<span class="done-note"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' + ACH[st] + '</span>'
      : '<span class="lbl">Үлдсэн</span> <span class="strong">' + money(Math.max(0, plan - a)) + '</span>';
  }

  function renderTier(mo) {
    var a = mo.amount, i = tierFor(a), gap = nextGap(a);
    var badge = $('tier-badge');
    badge.textContent = FX.tiers[i].name + ' · ' + rateText(i);
    badge.classList.toggle('base', i === 0);
    var anchor = $('anchor');
    anchor.classList.toggle('top', gap === null);
    if (gap === null) {
      anchor.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Дээд түвшинд хүрсэн';
    } else {
      var nx = FX.tiers[i + 1];
      anchor.innerHTML = '<span class="a-lbl">' + esc(nx.name) + 'д (' + rateText(i + 1) + ') хүрэхэд</span><strong>' + money(gap) + '</strong> ' + (mo.is_partial ? 'дутуу' : 'дутсан');
    }
    $('ladder').innerHTML = FX.tiers.map(function (t, k) {
      var cls = k < i ? 'past' : k === i ? 'now' : '';
      var seg = '';
      if (k === i) {
        var nx = FX.tiers[k + 1];
        var f = nx ? Math.min(1, Math.max(0, (a - t.min) / (nx.min - t.min))) : 1;
        seg = '<i style="width:' + (f * 100).toFixed(1) + '%"></i>' + (nx ? '<b style="left:' + (f * 100).toFixed(1) + '%"></b>' : '');
      }
      var min = k === 0 ? '0' : (t.min / 1e6) + ' сая' + (k === FX.tiers.length - 1 ? '+' : '');
      return '<li class="' + cls + '"' + (k === i ? ' aria-current="step"' : '') + '><span class="seg">' + seg + '</span><span class="t-name">' +
        esc(shortTier(k)) + '</span><span class="t-min num">' + min + '</span></li>';
    }).join('');
    $('bonus-lbl').textContent = mo.is_partial ? 'Одоогоор тооцсон урамшуулал' : 'Тооцсон урамшуулал';
    $('bonus').textContent = money(bonusFor(a));
    $('next-bonus').hidden = gap === null;
    if (gap !== null) {
      var nt = FX.tiers[i + 1];
      $('next-bonus-lbl').textContent = nt.name + 'д хүрвэл (' + (nt.min / 1e6) + ' сая × ' + rateText(i + 1) + ')';
      $('next-bonus-v').textContent = money(bonusFor(nt.min));
    }
    Array.prototype.forEach.call($('cond-rows').rows, function (tr) {
      var now = Number(tr.getAttribute('data-i')) === i;
      tr.classList.toggle('is-now', now);
      tr.querySelector('.now-tag').textContent = now ? ' · одоо' : '';
    });
  }

  // month axis label for 12 columns: 2-digit month; the first column and each January carry the year
  function axis(y, k) { var mm = y.slice(5); return { mm: mm, yr: (k === 0 || mm === '01') ? y.slice(0, 4) : '' }; }

  // main chart metric: money (₮) or liters of l/ml-packed SKUs; the money plan/tier cards never switch
  var METRIC = {
    amount: { value: function (m) { return m.amount; }, avg: function (av) { return av.avg; }, fmt: money, sub: 'мөнгөн дүн, ₮' },
    liters: { value: function (m) { return m.liters; }, avg: function (av) { return av.liters_avg; }, fmt: liters, sub: 'Л/мл савлагаатай бараа' }
  };
  function partText(m) { return '1–' + Number(m.end.slice(8)); }

  function renderHistory(mo) {
    var M = METRIC[state.metric], av = FX.averages[mo.ym], b = av.months, yms = chartMonths(mo.ym);
    $('trend-range').textContent = ymDot(yms[0]) + '–' + ymDot(yms[11]);
    $('metric-sub').textContent = M.sub;
    Array.prototype.forEach.call(document.querySelectorAll('[data-metric]'), function (x) { x.setAttribute('aria-pressed', String(x.dataset.metric === state.metric)); });
    $('lit-info').hidden = state.metric !== 'liters';
    if (state.metric !== 'liters') { $('lit-note').hidden = true; $('lit-info').setAttribute('aria-expanded', 'false'); }
    $('avg').textContent = M.fmt(M.avg(av));
    $('avg-months').textContent = ymDot(b[0]) + '–' + ymDot(b[b.length - 1]) + ', ' + b.length + ' бүтэн сар';
    var part = yms.map(function (y) { return byYm[y]; }).filter(function (m) { return m.is_partial; })[0];
    $('leg-part').hidden = !part;
    if (part) $('leg-part-t').textContent = partText(part) + ': ' + md(part.start) + '–' + md(part.end) + ', дутуу сар';
    var vals = yms.map(function (y) { return M.value(byYm[y]); });
    var max = Math.max.apply(null, vals.map(function (v) { return Math.max(0, v || 0); }).concat([M.avg(av) || 0, 1e-9])); // the average always fits
    $('cols').innerHTML = yms.map(function (y, k) {
      var m = byYm[y], v = vals[k], ax = axis(y, k), st = achState(m.amount, planOf(y), m.is_partial);
      var cls = 'col' + (y === mo.ym ? ' is-sel' : '') + (m.is_partial ? ' is-partial' : '') + (ax.yr && k > 0 ? ' yr-start' : '') + (ACH[st] ? ' ok' : '') + (v == null ? ' na' : '');
      var label = monthLabel(m) + (y === mo.ym ? ' (тайлангийн сар)' : '') + ': ' + (v == null ? 'мэдээ алга' : M.fmt(v)) + (ACH[st] ? ', мөнгөн ' + ACH[st].toLowerCase() : '');
      return '<button type="button" class="' + cls + '" data-ym="' + y + '" aria-pressed="false" aria-label="' + esc(label) + '">' +
        '<span class="plot"><span class="bar" style="height:' + (Math.max(0, v || 0) / max * 100).toFixed(2) + '%">' +
          (ACH[st] ? '<span class="okm" aria-hidden="true"><svg><use href="#i-check"/></svg></span>' : '') + '</span></span>' +
        '<span class="mon num">' + ax.mm + '</span>' +
        '<span class="yr num">' + (m.is_partial ? partText(m) : ax.yr) + '</span>' +
        '</button>';
    }).join('');
    renderInspect();
    placeAvgLine((M.avg(av) || 0) / max);
  }

  // the bars live in the plot's content box (top padding = room for the ✓ mark), so the line uses the same box
  function placeAvgLine(frac) {
    var line = $('avg-line'), chart = $('chart');
    var plot = chart.querySelector('.plot');
    if (!plot) return;
    line.dataset.frac = frac;
    var cs = getComputedStyle(plot), pt = parseFloat(cs.paddingTop), bb = parseFloat(cs.borderBottomWidth);
    var cr = chart.getBoundingClientRect(), pr = plot.getBoundingClientRect();
    line.style.top = (pr.bottom - bb - cr.top - frac * (pr.height - pt - bb)).toFixed(1) + 'px';
  }

  // inspecting a column never changes the report month; an explicit button does. One readout: value, tier, money plan.
  function renderInspect() {
    var other = !!state.inspect && state.inspect !== state.month;
    var ym = other ? state.inspect : state.month, yms = chartMonths(state.month), k = yms.indexOf(ym);
    var m = byYm[ym], i = tierFor(m.amount), M = METRIC[state.metric], v = M.value(m), plan = planOf(ym), st = achState(m.amount, plan, m.is_partial);
    Array.prototype.forEach.call($('cols').children, function (c) {
      c.classList.toggle('is-insp', other && c.getAttribute('data-ym') === ym);
      c.setAttribute('aria-pressed', String(c.getAttribute('data-ym') === ym));
    });
    $('inspect').classList.toggle('other', other);
    var SEP = ' · ';
    $('readout').innerHTML = '<span class="r1"><span class="tag">' + (other ? 'Харж буй сар' : 'Тайлангийн сар') + '</span><b>' + ymDot(ym) + '</b>' +
        (m.is_partial ? ' (' + partText(m) + ')' : '') + SEP + '<b class="v">' + (v == null ? 'мэдээ алга' : M.fmt(v)) + '</b>' + SEP + esc(FX.tiers[i].name) + ' (' + rateText(i) + ')</span>' +
      '<span class="r2">' + (plan == null
        ? 'Мөнгөн дүн ' + money(m.amount) + ' · <span class="no-plan">Төлөвлөгөө байхгүй</span>'
        : 'Мөнгөн гүйцэтгэл / төлөвлөгөө: ' + fmt(m.amount) + ' / ' + money(plan) + ' · <b>' + pct(m.amount / plan * 100) + '</b>' +
          (ACH[st] ? ' <span class="st st-active ach"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' + ACH[st] + '</span>' : '')) + '</span>';
    stepState($('insp-prev'), k <= 0); stepState($('insp-next'), k >= yms.length - 1);
    var c = m.liters_cov;
    $('lit-note').innerHTML = 'Литр = л/мл савлагаатай барааны ширхэг × савлагааны хэмжээ (мл ÷ 1000); буцаалт хасагдсан. Кг, г, ширхэгээр савласан бараа орохгүй.' +
      (c ? ' ' + ymDot(ym) + ': л/мл бараа мөнгөн дүнгийн ' + (m.amount > 0 ? pct(c.vol_amount / m.amount * 100) : '—') +
        (c.unknown_rows ? ' · ' + c.unknown_rows + ' мөрийн савлагаа тодорхойгүй (литрт ороогүй)' : '') + '.' : '');
    var btn = $('insp-open');
    var can = other && FX.selectable_months.indexOf(ym) >= 0;
    btn.hidden = !can;
    if (can) { btn.textContent = ymDot(ym) + '-ийн тайланг нээх'; btn.dataset.ym = ym; }
  }
  // edge state of a previous/next inspect control: stays focusable (aria-disabled) so keyboard focus is never lost
  function stepState(b, off) { b.setAttribute('aria-disabled', String(off)); }

  // ---------- main lists ----------
  function productList() {
    var list = (FX.products[state.month] || []).slice();
    var q = state.q.trim().toLowerCase();
    if (q) list = list.filter(function (p) { return (p.name + ' ' + p.code + ' ' + p.category + ' ' + (meta(p.code).brand || '')).toLowerCase().indexOf(q) >= 0; });
    var s = state.sort;
    list.sort(function (x, y) {
      if (s === 'name') return x.name.localeCompare(y.name, 'mn');
      if (s === 'last') return y.last_date.localeCompare(x.last_date) || y.amount - x.amount;
      return (y[s] - x[s]) || (y.amount - x.amount);
    });
    return list;
  }

  function renderProducts() {
    var all = FX.products[state.month] || [];
    var rows = productList();
    var searching = state.q.trim() !== '';
    var shown = searching || state.showAll ? rows : rows.slice(0, FIRST_ROWS);
    $('count-products').textContent = all.length;
    $('rows-products').innerHTML = shown.map(function (p) {
      return '<tr data-sku="' + esc(p.code) + '"><td><button type="button" class="pbtn" data-sku="' + esc(p.code) + '" aria-haspopup="dialog">' +
        '<span class="pname">' + esc(p.name) + '</span><span class="pcat">' + catDot(p.category) + esc(p.category) + '<span class="sku"> · ' + esc(p.code) + '</span></span></button></td>' +
        '<td class="r num">' + fmt(p.quantity) + '&nbsp;ш</td><td class="r num">' + money(p.amount) + '</td><td class="r num col-last">' + md(p.last_date) + '</td>' +
        '<td class="go"><svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></td></tr>';
    }).join('');
    var fsum = sum(rows, function (p) { return p.amount; });
    $('foot-products').innerHTML = (searching
      ? '<tr class="sub-total"><th scope="row">Хайлтын нийт · ' + rows.length + ' бараа</th><td></td><td class="r num" id="sum-filtered">' + money(fsum) + '</td><td class="col-last"></td><td></td></tr>' : '') +
      '<tr><th scope="row">Сарын нийт · ' + all.length + ' бараа</th><td></td><td class="r num strong" id="sum-amount">' + money(sum(all, function (p) { return p.amount; })) + '</td><td class="col-last"></td><td></td></tr>';
    var empty = $('empty-products');
    empty.hidden = rows.length > 0;
    empty.textContent = all.length === 0 ? 'Энэ сард авалт бүртгэгдээгүй.' : '«' + state.q.trim() + '» гэсэн бараа олдсонгүй.';
    $('tbl-products').hidden = rows.length === 0;
    $('shown-products').textContent = searching ? rows.length + ' бараа олдлоо' : shown.length + ' / ' + all.length + ' бараа';
    var tg = $('toggle-all');
    tg.hidden = searching || rows.length <= FIRST_ROWS;
    tg.textContent = state.showAll ? 'Хураах' : 'Бүгдийг харах (' + rows.length + ')';
    tg.setAttribute('aria-expanded', String(state.showAll));
  }

  // brand and category lists share one row design; a row opens that entity's drawer
  function renderGroup(kind, groups) {
    var isCat = kind === 'categories', total = byYm[state.month].amount;
    var listId = isCat ? 'cats' : 'brands';
    $('count-' + kind).textContent = groups.length;
    $(listId).innerHTML = groups.map(function (c) {
      var w = c.share != null && c.amount > 0 ? Math.min(100, c.share) : 0;
      var color = isCat ? catVis(c.name)[1] : 'var(--accent)';
      return '<li><button type="button" class="cat-btn" data-' + (isCat ? 'cat' : 'brand') + '="' + esc(c.name) + '" aria-haspopup="dialog" aria-label="' +
        esc(c.name + ': ' + money(c.amount) + ', ' + (c.share == null ? 'хувь тооцохгүй' : pct(c.share)) + ', ' + c.n + ' бараа. Дэлгэрэнгүй') + '">' +
        (isCat ? catIcon(c.name) : brandIcon(c.name)) +
        '<span class="cat-name"><b>' + esc(isCat ? c.name : brandShort(c.name)) + '</b><span>' + c.n + ' бараа</span></span>' +
        '<span class="cat-track" style="--c:' + color + '"><i style="width:' + w.toFixed(2) + '%"></i></span>' +
        '<span class="cat-amt num">' + money(c.amount) + '</span><span class="cat-share num">' + (c.share == null ? '—' : pct(c.share)) + '</span>' +
        '<svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button></li>';
    }).join('');
    $('empty-' + kind).hidden = groups.length > 0;
    $('sum-' + kind).textContent = money(sum(groups, function (c) { return c.amount; }));
    var rounded = sum(groups, function (c) { return c.share == null ? 0 : Number(c.share.toFixed(1)); });
    $(isCat ? 'cats-note' : 'brands-note').textContent = total <= 0 ? 'Сарын дүн 0 эсвэл сөрөг тул хувь тооцохгүй.'
      : Math.abs(rounded - 100) > 0.05 ? 'Хувийг 0.1 хүртэл бөөрөнхийлсөн (нийлбэр ' + rounded.toFixed(1) + '%).' : '';
  }

  function renderDays() {
    var days = FX.days[state.month] || [];
    $('count-days').textContent = days.length;
    $('days').innerHTML = days.map(function (d, k) {
      var id = 'day-' + k;
      return '<li><button type="button" class="day-btn" aria-expanded="false" aria-controls="' + id + '">' +
        '<span class="day-date num">' + md(d.date) + '<span class="day-wd">' + weekday(d.date) + '</span></span>' +
        '<span class="day-n">' + d.items.length + ' бараа</span><span class="day-amt num">' + money(d.amount) + '</span>' +
        '<svg class="ic" aria-hidden="true"><use href="#i-chev"/></svg></button>' +
        '<ul class="day-items" id="' + id + '" hidden>' + d.items.map(function (it) {
          return '<li><span>' + esc(it.name) + '</span><span class="q num">' + fmt(it.quantity) + '&nbsp;ш</span><span class="a num">' + money(it.amount) + '</span></li>';
        }).join('') + '</ul></li>';
    }).join('');
    $('days-foot').innerHTML = '<span></span><span class="num"><span class="muted">Сарын нийт</span> <b id="sum-days">' + money(sum(days, function (d) { return d.amount; })) + '</b></span>';
    var empty = $('empty-days');
    empty.hidden = days.length > 0;
    empty.textContent = 'Энэ сард авалт бүртгэгдээгүй.';
  }

  // ---------- drawer: shared pieces ----------
  // 12-month mini chart (selected month + previous 11); tap/focus a bar for its exact value
  function mini12(valueOf, title) {
    var yms = chartMonths(state.month);
    var vals = yms.map(valueOf), max = Math.max.apply(null, vals.map(function (v) { return Math.max(0, v); }).concat([1]));
    return '<section class="pd-sec dr-chart"><h3>' + esc(title) + ' <span>' + ymDot(yms[0]) + '–' + ymDot(yms[11]) + '</span></h3>' +
      '<div class="mini m12" role="group" aria-label="' + esc(title) + '">' + yms.map(function (y, k) {
        var v = vals[k], m = byYm[y], ax = axis(y, k);
        return '<button type="button" class="mc' + (y === state.month ? ' sel' : '') + (m.is_partial ? ' part' : '') + (ax.yr && k > 0 ? ' yr-start' : '') +
          '" data-ym="' + y + '" data-v="' + v + '" aria-label="' + esc(monthLabel(m) + ': ' + money(v)) + '">' +
          '<span class="mp"><span class="mb" style="height:' + (v > 0 ? Math.max(2, v / max * 100) : 0).toFixed(1) + '%"></span></span>' +
          '<span class="ml num">' + ax.mm + '</span><span class="my num">' + (m.is_partial ? '1–' + Number(m.end.slice(8)) : ax.yr) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="mini-nav"><button type="button" class="icon-btn step" data-step="-1" aria-label="Өмнөх сар" aria-disabled="false"><svg class="ic" aria-hidden="true"><use href="#i-left"/></svg></button>' +
      '<p class="mini-read num" aria-live="polite">' + readoutText(state.month, vals[11]) + '</p>' +
      '<button type="button" class="icon-btn step" data-step="1" aria-label="Дараагийн сар" aria-disabled="true"><svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button></div></section>';
  }
  function readoutText(ym, v) { return '<b>' + monthLabel(byYm[ym]) + '</b> · ' + money(v) + (v === 0 ? ' · авалтгүй' : ''); }
  // inspect one mini-chart bar (tap, focus, previous/next); never changes the report month
  function miniPick(c) {
    var bars = Array.prototype.slice.call(c.parentNode.children), k = bars.indexOf(c), sec = c.closest('.dr-chart');
    bars.forEach(function (x) { x.classList.toggle('is-insp', x === c); });
    sec.querySelector('.mini-read').innerHTML = readoutText(c.dataset.ym, Number(c.dataset.v));
    stepState(sec.querySelector('[data-step="-1"]'), k <= 0); stepState(sec.querySelector('[data-step="1"]'), k >= bars.length - 1);
  }
  function summaryBlock(label, amount, facts) {
    return '<section class="pd-sec" id="dr-month"><h3>' + label + '</h3><p class="pd-big num">' + money(amount) + '</p>' +
      (facts ? '<p class="pd-facts">' + facts + '</p>' : '') + '</section>';
  }
  function avgBlock(value) {
    var b = FX.averages[state.month].months;
    return '<section class="pd-sec" id="dr-avg"><div class="pd-avg"><h3>Өмнөх 12 сарын дундаж <span>' + ymDot(b[0]) + '–' + ymDot(b[b.length - 1]) + '</span></h3>' +
      '<span class="v num">' + money(value) + '</span></div></section>';
  }
  function itemRow(code, right, sub) {
    var m = meta(code);
    return '<li><button type="button" class="it-row" data-sku="' + esc(code) + '"><span class="it-main"><span class="pname">' + esc(m.name || code) + '</span>' +
      '<span class="pcat">' + catDot(m.category) + esc(sub) + '</span></span><span class="it-right num">' + right + '</span>' +
      '<svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button></li>';
  }
  // a known month value: 0 is a real zero (data covers the month) → «0 ₮», never «—» (reserved for missing data)
  function monthAmt(v) { return v ? money(v) : '<span class="zero">' + money(0) + '</span>'; }

  // ---------- drawer views ----------
  var VIEWS = {
    product: function (v) {
      var code = v.key, m = meta(code), hist = FX.sku_months[code] || {}, mo = byYm[state.month];
      var cur = hist[state.month] || [0, 0, 0, null];
      var chips = [['Брэнд', m.brand], ['Савлагаа', m.packet_type], ['Хэмжээ', packText(m)], ['Хайрцагт', m.units_per_case ? m.units_per_case + ' ш' : null]]
        .filter(function (c) { return c[1]; });
      var dayRows = (FX.days[state.month] || []).map(function (d) {
        var it = d.items.filter(function (x) { return x.code === code; })[0];
        return it ? { date: d.date, q: it.quantity, a: it.amount } : null;
      }).filter(Boolean);
      var a = v.from === 'assortment' ? asItems().filter(function (i) { return i.code === code; })[0] : null;
      var A = FX.assortment;
      return {
        kind: 'Бараа', title: m.name || code, sub: [code, m.category, m.sub_category].filter(Boolean).join(' · '),
        html: (a ? '<div class="from-card"><span>Барааны карт · ' + md(A.window30.from) + '–' + md(A.window30.to) + ' (30 хоног)</span><b class="num">' + fmt(a.q30) + ' ш</b>' +
            statusPill(a) + '<span class="fc-sub num">30 хоногт ' + a.d30 + ' өдөр · 90 хоногт ' + a.d90 + ' өдөр · ' +
            (a.last ? 'сүүлд ' + dDot(a.last) : 'өмнө нь аваагүй') + ' · ' + money(a.a30) + '</span></div>' : '') +
          (chips.length ? '<ul class="meta">' + chips.map(function (c) { return '<li><span>' + c[0] + '</span>' + esc(c[1]) + '</li>'; }).join('') + '</ul>' : '') +
          summaryBlock('Тайлангийн сар <span>' + monthLabel(mo) + '</span>', cur[0], cur[2]
            ? '<span><b class="num">' + fmt(cur[1]) + '</b> ш</span><span><b class="num">' + cur[2] + '</b> өдөр авсан</span><span>Сүүлд <b class="num">' + md(cur[3]) + '</b></span>'
            : '<span>Энэ сард энэ барааг аваагүй</span>') +
          avgBlock(avg12(function (y) { return skuMonth(code, y); }, state.month)) +
          mini12(function (y) { return skuMonth(code, y); }, '12 сарын түүх') +
          '<section class="pd-sec"><h3>Энэ сард авсан өдрүүд <span>' + ymDot(state.month) + '</span></h3>' +
            (dayRows.length ? '<ul class="pd-days">' + dayRows.map(function (d) {
              return '<li><span class="num"><b>' + md(d.date) + '</b> <span class="muted">' + weekday(d.date) + '</span></span><span class="q num">' + fmt(d.q) + '&nbsp;ш</span><span class="a num">' + money(d.a) + '</span></li>';
            }).join('') + '</ul>' : '<p class="muted">Энэ сард энэ барааг аваагүй.</p>') + '</section>' +
          '<p class="pd-note">Энэ дэлгүүрийн манай компаниас татан авсан дүн. Дэлгүүрийн зарсан дүн, үлдэгдэл биш.</p>'
      };
    },
    brand: function (v) { return entityView('brand', v.key, v.cat); },
    category: function (v) { return entityView('category', v.key); },
    assortment: function (v) {
      var A = FX.assortment, cov = asCoverage(), f = v.filter || 'all';
      var seg = function (k, t, n) { return '<button type="button" class="seg-btn" data-filter="' + k + '" aria-pressed="' + (f === k) + '">' + t + ' <b class="num">' + n + '</b></button>'; };
      return {
        kind: 'Барааны карт', title: A.profile ? A.profile.name : 'Барааны карт',
        sub: A.profile ? '30 хоног: ' + dDot(A.window30.from) + '–' + dDot(A.window30.to) + ' · ' + FX.store.name : FX.store.name,
        html: !A.profile || !cov.n ? '<p class="empty" id="as-empty">Энэ дэлгүүрт оноосон барааны карт алга.</p>' :
          '<div class="as-top"><p class="as-sum num" id="as-sum"><span><b>' + cov.n + '</b> бараа · Авсан <b>' + cov.have + '</b> · Аваагүй <b>' + cov.need + '</b></span>' +
            '<b class="as-pct">' + pct(cov.pct) + '</b></p>' +
            '<div class="as-bar" role="progressbar" aria-label="Сетийн хамралт" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + cov.pct.toFixed(1) + '"><i style="width:' + cov.pct.toFixed(2) + '%"></i></div></div>' +
          '<div class="as-tools"><div class="seg" role="group" aria-label="Шүүлт (сетийн нийт тоо)">' + seg('all', 'Бүгд', cov.n) + seg('need', 'Аваагүй', cov.need) + seg('have', 'Авсан', cov.have) + '</div>' +
            '<label class="search sm"><svg class="ic" aria-hidden="true"><use href="#i-search"/></svg><input type="search" id="as-q" placeholder="Нэр, код" aria-label="Сетээс нэр, кодоор хайх" autocomplete="off" value="' + esc(v.q || '') + '"></label></div>' +
          '<div id="as-results">' + asResults(v) + '</div>' +
          '<p class="as-note">Сүүлийн 30 хоногт дор хаяж ' + A.profile.min_units + ' ш татсан эсэх. Үлдэгдэл, тавиур, захиалгын тоо биш.</p>'
      };
    },
    programs: function () {
      var items = currentPrograms();
      return {
        kind: 'Харилцагчийн хөтөлбөр', title: 'Харилцагчийн хөтөлбөр', sub: FX.store.name + ' · ' + FX.cutoff.replace(/-/g, '.') + '-ны байдлаар',
        html: items.length
          ? '<p class="pg-label"><span class="pill-demo">' + esc(FX.programs.label) + '</span><span>' + items.length + ' хөтөлбөрт хамрагдсан</span></p>' +
            '<ul class="pg-list">' + items.map(function (p) {
              return '<li class="pg-card"><div class="pg-top"><h3>' + esc(p.name) + '</h3>' + progPill(p) + '</div>' +
                '<p class="pg-meta num">' + dDot(p.start) + '–' + dDot(p.end) + ' · ' + esc(p.enrollment.status) + '</p>' +
                '<p class="pg-scope">' + catIcon(p.categories[0]) + '<span>' + esc(p.categories.join(', ') + (p.skus.length ? ' · ' + p.skus.length + ' нэр төрөл' : '')) + '</span></p>' +
                '<button type="button" class="btn-sec pg-open" data-pg="' + esc(p.id) + '">Нөхцөл, дэлгэрэнгүй<svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button></li>';
            }).join('') + '</ul>'
          : '<p class="empty" id="pg-empty">Одоогоор хамрагдсан хөтөлбөр алга.</p>'
      };
    },
    program: function (v) {
      var p = currentPrograms().filter(function (x) { return x.id === v.key; })[0], e = p.enrollment;
      return {
        kind: 'Харилцагчийн хөтөлбөр', title: p.name, sub: FX.store.name + ' · ' + FX.cutoff.replace(/-/g, '.') + '-ны байдлаар',
        html: '<div class="pg-detail" data-id="' + esc(p.id) + '"><div class="pg-top">' + progPill(p) + '<span class="pg-meta num">' + dDot(p.start) + '–' + dDot(p.end) + '</span></div>' +
          '<section class="pd-sec"><h3>Зорилго</h3><p>' + esc(p.goal) + '</p></section>' +
          '<section class="pd-sec"><h3>Энэ дэлгүүрт тавигдах нөхцөл</h3><ul class="pg-bul">' + p.conditions.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></section>' +
          '<section class="pd-sec"><h3>Хамаарах ангилал, бараа</h3><p class="pg-cats">' + p.categories.map(function (c) { return '<span class="pg-cat">' + catIcon(c) + esc(c) + '</span>'; }).join('') + '</p>' +
            (p.skus.length ? '<ul class="pg-skus">' + p.skus.map(function (k) { return '<li><span>' + esc(k.name) + '</span><span class="muted num">' + esc(k.code) + '</span></li>'; }).join('') + '</ul>' : '') + '</section>' +
          '<section class="pd-sec"><h3>Дэмжлэг</h3><p>' + esc(p.support) + ' <span class="muted">· Материал: ' + esc(e.material) + '</span></p></section>' +
          '<section class="pd-sec pg-task"><h3>ХТ-ийн хийх ажил</h3><p>' + esc(p.rep_task) + '</p><p class="muted">Оролцоо: ' + esc(e.status) + ' · ' + dDot(e.since) + '-нд бүртгэсэн</p></section></div>'
      };
    }
  };
  function statusPill(i) { return i.need ? '<span class="st st-need">' + (i.short ? '1+ хангаагүй' : 'Аваагүй') + '</span>' : '<span class="st st-active">Авсан</span>'; }
  function asSub(i) {
    if (!i.need) return '30 хоногт ' + i.d30 + ' өдөр · сүүлд ' + shortDate(i.last);
    if (i.short) return '1+ шаардлага хангаагүй · цэвэр ' + fmt(i.q30) + ' ш · 30 хоногт ' + i.d30 + ' өдөр' + (i.last ? ' · сүүлд ' + shortDate(i.last) : '');
    return '1+ авах · ' + (i.last ? 'сүүлд ' + shortDate(i.last) : 'Өмнө нь аваагүй');
  }
  // card results only (summary, filters and the search input stay in place while typing)
  function asResults(v) {
    var f = v.filter || 'all', q = (v.q || '').trim().toLowerCase();
    var list = asItems().filter(function (i) {
      var m = meta(i.code);
      return (f === 'all' || (f === 'need') === i.need) && (!q || (m.name + ' ' + i.code + ' ' + m.brand + ' ' + m.category).toLowerCase().indexOf(q) >= 0);
    });
    var full = asGroups(asItems());
    return (q ? '<p class="as-found" id="as-found">Хайлт: <b class="num">' + list.length + '</b> бараа</p>' : '') +
      (list.length ? asGroups(list).map(function (g) {
        var all = full.filter(function (x) { return x.brand === g.brand; })[0].items, have = all.filter(function (i) { return !i.need; }).length;
        return '<section class="as-grp" data-brand-group="' + esc(g.brand) + '"><h3 class="as-gh"><span>' + esc(brandShort(g.brand)) + '</span><span class="num">' + have + '/' + all.length + ' авсан</span></h3>' +
          '<ul class="as-list">' + g.items.map(function (i) {
            return '<li><button type="button" class="as-row' + (i.need ? ' need' : '') + '" data-sku="' + esc(i.code) + '" data-from="assortment" aria-label="' +
                esc(meta(i.code).name + ': 30 хоногт ' + fmt(i.q30) + ' ш, ' + (i.need ? (i.short ? '1+ шаардлага хангаагүй' : 'аваагүй') : 'авсан') + '. ' + asSub(i)) + '">' +
              '<span class="as-name">' + esc(nameInBrand(i.code)) + '</span><span class="as-q num">' + fmt(i.q30) + ' ш</span>' + statusPill(i) +
              '<span class="as-sub num">' + esc(asSub(i)) + '</span></button></li>';
          }).join('') + '</ul></section>';
      }).join('') : '<p class="empty">Тохирох бараа алга.</p>');
  }

  // brand and category drawers: same structure — summary → 12-month chart → related list.
  // Category → its brands; brand → its products (inside the category when opened from one: e.cat).
  function entityView(dim, name, cat) {
    var e = { dim: dim, name: name, cat: cat }, mo = byYm[state.month], g = eGroup(e, state.month), yms = chartMonths(state.month), isCat = dim === 'category';
    var base = isCat || !cat ? mo.amount : eMonth({ dim: 'category', name: cat }, state.month);   // share of the month, or of the category
    var share = base > 0 && g.amount >= 0 ? g.amount / base * 100 : null;
    var lastIn = function (codes) { var last = ''; codes.forEach(function (c) { yms.forEach(function (y) { var v = (FX.sku_months[c] || {})[y]; if (v && v[3] > last) last = v[3]; }); }); return last; };
    var rows, related;
    if (isCat) {   // brands of this category with any purchase in the 12-month window; selected-month amounts sum to the category
      var brands = {};
      skusIn(e).forEach(function (c) { var b = meta(c).brand; (brands[b] = brands[b] || []).push(c); });
      rows = Object.keys(brands).map(function (b) {
        var cs = brands[b], sub = { dim: 'brand', name: b, cat: name };
        return { brand: b, cur: eMonth(sub, state.month), win: sum(yms, function (y) { return eMonth(sub, y); }), n: eGroup(sub, state.month).n, total: cs.length, last: lastIn(cs) };
      }).filter(function (r) { return r.win !== 0 || r.last; })
        .sort(function (x, y) { return y.cur - x.cur || y.win - x.win || brandShort(x.brand).localeCompare(brandShort(y.brand), 'mn'); });
      related = '<section class="pd-sec"><h3>Брэндүүд <span>12 сард ' + rows.length + '</span></h3>' +
        (rows.length ? '<div class="it-head"><span>Брэнд</span><span>' + ymDot(state.month) + '</span></div><ul class="it-list">' + rows.map(function (r) {
          return '<li><button type="button" class="it-row br-row" data-brand="' + esc(r.brand) + '" aria-label="' + esc(brandShort(r.brand) + ', ' + name + ': ' + money(r.cur)) + '">' +
            brandIcon(r.brand) + '<span class="it-main"><span class="pname">' + esc(brandShort(r.brand)) + '</span><span class="pcat">' +
            (r.n ? r.n + ' бараа авсан' : 'Энэ сард аваагүй') + (r.last ? ' · сүүлд ' + md(r.last) : '') + '</span></span>' +
            '<span class="it-right num">' + monthAmt(r.cur) + '</span><svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button></li>';
        }).join('') + '</ul>' : '<p class="muted">12 сард авалт алга.</p>') + '</section>';
    } else {
      rows = skusIn(e).map(function (c) {
        return { code: c, cur: skuMonth(c, state.month), win: sum(yms, function (y) { return skuMonth(c, y); }), last: lastIn([c]) };
      }).filter(function (s) { return s.win !== 0 || s.last; })
        .sort(function (x, y) { return y.cur - x.cur || y.win - x.win || meta(x.code).name.localeCompare(meta(y.code).name, 'mn'); });
      related = '<section class="pd-sec"><h3>' + (cat ? 'Энэ категорийн бараа' : 'Энэ дэлгүүрийн авсан бараа') + ' <span>12 сард ' + rows.length + '</span></h3>' +
        (rows.length ? '<div class="it-head"><span>Бараа</span><span>' + ymDot(state.month) + '</span></div><ul class="it-list">' + rows.map(function (s) {
          var m = meta(s.code);
          return itemRow(s.code, monthAmt(s.cur), (cat ? '' : m.category + ' · ') + s.code + (s.cur ? '' : ' · энэ сард аваагүй') + (s.last ? ' · сүүлд ' + md(s.last) : ''));
        }).join('') + '</ul>' : '<p class="muted">12 сард авалт алга.</p>') + '</section>';
    }
    var shareLbl = isCat || !cat ? 'сарын дүнгийн' : 'категорийн дүнгийн';
    return {
      kind: isCat ? 'Категори' : 'Брэнд', title: isCat ? name : brandShort(name),
      sub: isCat ? 'Категори · ' + FX.store.name : cat ? 'Зөвхөн «' + cat + '» категорид · ' + FX.store.name : name + ' · бүх категори · ' + FX.store.name,
      icon: isCat ? catIcon(name, 'lg') : brandIcon(name, 'lg'),
      html: summaryBlock('Тайлангийн сар <span>' + monthLabel(mo) + '</span>', g.amount,
          '<span><b class="num">' + (share == null ? '—' : pct(share)) + '</b> ' + shareLbl + '</span><span><b class="num">' + g.n + '</b> бараа авсан</span>' +
          (g.last ? '<span>Сүүлд <b class="num">' + md(g.last) + '</b></span>' : '')) +
        avgBlock(avg12(function (y) { return eMonth(e, y); }, state.month)) +
        mini12(function (y) { return eMonth(e, y); }, '12 сарын түүх') + related
    };
  }

  // ---------- customer programs (demo config; scope = fixed cutoff, not the report month) ----------
  var ST = { active: ['Идэвхтэй', 'st-active'], upcoming: ['Удахгүй эхэлнэ', 'st-upcoming'], ended: ['Дууссан', 'st-ended'] };
  function currentPrograms() { return ((FX.programs || {}).items || []).filter(function (p) { return p.status !== 'ended'; }); }
  function progPill(p) { var s = ST[p.status]; return '<span class="st ' + s[1] + '">' + s[0] + (p.status === 'upcoming' ? ' · ' + md(p.start) : '') + '</span>'; }

  // ---------- drawer stack ----------
  var drawer = { stack: [], opener: null, y: 0, keepFocus: false };
  var BACK = { brand: 'Брэнд рүү буцах', category: 'Категори руу буцах', assortment: 'Барааны карт руу буцах', programs: 'Жагсаалт руу буцах', product: 'Бараа руу буцах' };
  function current() { return drawer.stack[drawer.stack.length - 1]; }
  function renderDrawer(keepScroll) {
    var v = current(), r = VIEWS[v.type](v), body = $('dr-body'), prev = drawer.stack[drawer.stack.length - 2];
    var y = body.scrollTop;
    $('dr').dataset.view = v.type;
    $('dr-kind').innerHTML = (r.icon || '') + '<span>' + esc(r.kind) + '</span>';
    $('dr-title').textContent = r.title;
    $('dr-sub').textContent = r.sub;
    $('dr-back').hidden = !prev;
    if (prev) $('dr-back-lbl').textContent = BACK[prev.type] || 'Буцах';
    body.innerHTML = r.html;
    body.scrollTop = keepScroll ? y : 0;
  }
  function openDrawer(view, from) {
    closeOthers('dr');
    drawer.stack = [view];
    if (!$('dr').open) {
      drawer.opener = from || document.activeElement;
      drawer.y = window.scrollY;
      document.documentElement.classList.add('modal-open');
      $('dr').showModal();
    }
    renderDrawer();
    $('dr').querySelector('[data-close]').focus();
    syncBack();
  }
  function pushView(view, fromEl) {
    var cur = current();
    cur.scroll = $('dr-body').scrollTop;
    var k = fromEl && ['sku', 'pg', 'brand'].filter(function (x) { return fromEl.dataset[x]; })[0];
    cur.focusSel = k ? '[data-' + k + '="' + CSS.escape(fromEl.dataset[k]) + '"]' : null;
    drawer.stack.push(view);
    renderDrawer();
    $('dr-back').focus();
  }
  function popView() {
    if (drawer.stack.length < 2) return;
    drawer.stack.pop();
    var v = current();
    renderDrawer();
    $('dr-body').scrollTop = v.scroll || 0;
    var f = v.focusSel && $('dr-body').querySelector(v.focusSel);
    (f || $('dr').querySelector('[data-close]')).focus({ preventScroll: true });
  }
  function closeOthers(keep) {
    ['dr', 'cd'].forEach(function (id) { var d = $(id); if (id !== keep && d.open) { drawer.keepFocus = true; d.close(); } }); // never stack dialogs
  }
  function onClose() {
    if ($('dr').open || $('cd').open) return;
    document.documentElement.classList.remove('modal-open');
    window.scrollTo(0, drawer.y);
    syncBack();
    if (drawer.keepFocus) { drawer.keepFocus = false; return; }
    var o = drawer.opener;
    if (o && !document.contains(o) && o.dataset) {   // the list re-rendered: find the same row again
      var k = o.dataset.sku ? '.pbtn[data-sku="' + o.dataset.sku + '"]' : o.dataset.brand ? '[data-brand="' + o.dataset.brand + '"]' : o.dataset.cat ? '[data-cat="' + o.dataset.cat + '"]' : null;
      o = k && document.querySelector(k);
    }
    if (o && document.contains(o)) o.focus({ preventScroll: true });
  }
  function openCond(from) {
    closeOthers('cd');
    if (!$('cd').open) { drawer.opener = from; drawer.y = window.scrollY; document.documentElement.classList.add('modal-open'); $('cd').showModal(); }
    $('cd').querySelector('[data-close]').focus();
    syncBack();
  }

  // ---------- navigation ----------
  var TABS = ['products', 'brands', 'categories', 'days'];
  function selectTab(name, focus) {
    state.tab = name;
    TABS.forEach(function (t) {
      var on = t === name, tab = $('tab-' + t);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      $('panel-' + t).hidden = !on;
      if (on && focus) tab.focus({ preventScroll: true });
    });
  }
  function goSection(tab) {
    selectTab(tab);
    $('detail').scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    $('tab-' + tab).focus({ preventScroll: true });
  }
  function setMonth(ym) { state.month = ym; state.showAll = false; render(); }

  function watchHeader() {
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (en) { $('bar').hidden = en[0].isIntersecting; }, { threshold: 0 }).observe($('head'));
  }

  function bindBars(container, onPick) {
    container.addEventListener('click', function (e) { var c = e.target.closest('[data-ym]'); if (c) onPick(c); });
    container.addEventListener('focusin', function (e) { var c = e.target.closest('[data-ym]'); if (c) onPick(c); });
    container.addEventListener('keydown', function (e) {
      var c = e.target.closest('[data-ym]'); if (!c) return;
      var list = Array.prototype.slice.call(c.parentNode.children), k = list.indexOf(c);
      var n = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: list.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      list[Math.max(0, Math.min(list.length - 1, n))].focus();
    });
  }

  function bind() {
    $('month').addEventListener('change', function (e) { setMonth(e.target.value); });
    $('month2').addEventListener('change', function (e) { setMonth(e.target.value); });
    $('q').addEventListener('input', function (e) { state.q = e.target.value; renderProducts(); });
    $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderProducts(); });
    $('toggle-all').addEventListener('click', function () { state.showAll = !state.showAll; renderProducts(); });
    TABS.forEach(function (t) { $('tab-' + t).addEventListener('click', function () { selectTab(t); }); });
    document.querySelector('.tabs').addEventListener('keydown', function (e) {
      var k = TABS.indexOf(state.tab), n = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: TABS.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      selectTab(TABS[(n + TABS.length) % TABS.length], true);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) {
      b.addEventListener('click', function () { goSection(b.getAttribute('data-go')); });
    });
    $('to-top').addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); $('month').focus({ preventScroll: true }); });
    $('more-btn').addEventListener('click', function () {
      var open = this.getAttribute('aria-expanded') !== 'true';
      this.setAttribute('aria-expanded', String(open));
      $('store-dl').hidden = !open;
    });
    // main rows → drawer (never a cross-filter)
    $('rows-products').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-sku]'); if (tr) openDrawer({ type: 'product', key: tr.getAttribute('data-sku') }, tr.querySelector('.pbtn'));
    });
    $('brands').addEventListener('click', function (e) { var b = e.target.closest('[data-brand]'); if (b) openDrawer({ type: 'brand', key: b.getAttribute('data-brand') }, b); });
    $('cats').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (b) openDrawer({ type: 'category', key: b.getAttribute('data-cat') }, b); });
    ['as-btn', 'bar-as'].forEach(function (id) { $(id).addEventListener('click', function () { openDrawer({ type: 'assortment', filter: 'all', q: '' }, this); }); });
    $('prog-btn').addEventListener('click', function () { openDrawer({ type: 'programs' }, this); });
    $('cond-btn').addEventListener('click', function () { openCond(this); });
    $('days').addEventListener('click', function (e) {
      var btn = e.target.closest('.day-btn'); if (!btn) return;
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      $(btn.getAttribute('aria-controls')).hidden = !open;
    });
    // drawer interactions (delegated; views re-render their own body)
    $('dr-back').addEventListener('click', popView);
    var body = $('dr-body');
    body.addEventListener('click', function (e) {
      var row = e.target.closest('[data-sku]');
      if (row) { pushView({ type: 'product', key: row.dataset.sku, from: row.dataset.from || current().type }, row); return; }
      var br = e.target.closest('[data-brand]');   // category → brand inside that category
      if (br) { pushView({ type: 'brand', key: br.dataset.brand, cat: current().key }, br); return; }
      var pg = e.target.closest('[data-pg]');
      if (pg) { pushView({ type: 'program', key: pg.dataset.pg }, pg); return; }
      var step = e.target.closest('[data-step]');
      if (step) {
        if (step.getAttribute('aria-disabled') === 'true') return;
        var bars = Array.prototype.slice.call(step.closest('.dr-chart').querySelectorAll('.mc'));
        var at = bars.indexOf(bars.filter(function (x) { return x.classList.contains('is-insp'); })[0] || bars.filter(function (x) { return x.classList.contains('sel'); })[0]);
        miniPick(bars[Math.max(0, Math.min(bars.length - 1, at + Number(step.dataset.step)))]);
        return;
      }
      var seg = e.target.closest('[data-filter]');
      if (seg) {   // results only: the summary, filters and search input are never rebuilt
        current().filter = seg.dataset.filter;
        Array.prototype.forEach.call(body.querySelectorAll('[data-filter]'), function (b) { b.setAttribute('aria-pressed', String(b === seg)); });
        $('as-results').innerHTML = asResults(current());
      }
    });
    body.addEventListener('input', function (e) {
      if (e.target.id !== 'as-q') return;   // the input element stays put, so caret, selection and IME composition are untouched
      current().q = e.target.value;
      $('as-results').innerHTML = asResults(current());
    });
    bindBars(body, function (c) { if (c.classList.contains('mc')) miniPick(c); });
    ['dr', 'cd'].forEach(function (id) {
      var d = $(id);
      d.addEventListener('close', onClose);
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) d.close(); }); // backdrop or close
    });
    // overview chart: inspect a month; the report month changes only via the explicit button or month control
    bindBars($('cols'), function (c) { state.inspect = c.dataset.ym; renderInspect(); });
    ['insp-prev', 'insp-next'].forEach(function (id, k) {
      $(id).addEventListener('click', function () {   // inspect the previous/next chart month; report month and URL stay
        if (this.getAttribute('aria-disabled') === 'true') return;
        var yms = chartMonths(state.month), at = yms.indexOf(state.inspect || state.month);
        state.inspect = yms[Math.max(0, Math.min(11, at + (k ? 1 : -1)))];
        renderInspect();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-metric]'), function (b) {
      b.addEventListener('click', function () { state.metric = b.dataset.metric; renderHistory(byYm[state.month]); });   // inspect month kept
    });
    $('lit-info').addEventListener('click', function () {
      var open = this.getAttribute('aria-expanded') !== 'true';
      this.setAttribute('aria-expanded', String(open)); $('lit-note').hidden = !open;
    });
    $('insp-open').addEventListener('click', function () {
      setMonth(this.dataset.ym);
      var last = $('cols').lastElementChild; if (last) last.focus({ preventScroll: true });
    });
    var relayout = function () { var l = $('avg-line'); if (l.dataset.frac) placeAvgLine(Number(l.dataset.frac)); };
    window.addEventListener('resize', relayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  }

  window.StoreReport = {
    tierFor: tierFor, bonusFor: bonusFor, nextGap: nextGap, categoriesFor: categoriesFor, groupFor: groupFor,
    achState: achState, coverage: asCoverage, liters: liters, telegram: telegram,
    setMonth: setMonth,
    openProduct: function (sku) { openDrawer({ type: 'product', key: sku }, null); },
    openEntity: function (type, key) { openDrawer({ type: type, key: key }, null); },
    openAssortment: function () { openDrawer({ type: 'assortment', filter: 'all', q: '' }, $('as-btn')); },
    openPrograms: function () { openDrawer({ type: 'programs' }, $('prog-btn')); },
    snapshot: function () { return { month: state.month, tab: state.tab, q: state.q, inspect: state.inspect, metric: state.metric, url: location.search, fromLookup: state.fromLookup, ret: state.ret, tg: !!(window.WS && window.WS.isTelegram()),
      drawer: drawer.stack.map(function (v) { return v.type + ':' + (v.key || v.filter || '') + (v.cat ? '@' + v.cat : ''); }) }; },
  };
  init();
})();
