/* Миний маршрут — one rep, one fixture (data/fixture.js, built from data/demo by scripts/build_rep_route_fixture.py).
   «Маршрут»: a sample schedule (config; members = customers who purchased on a stated day). Sorting changes only what is shown
   first; the schedule № never changes. «Сүүлд очсон» comes from a demo visit history, never from purchases.
   «Харилцагчид»: every assigned customer with 12-month signals (measured), PM demo flags, filters/sorts, optional route scope.
   Full store reports open only for codes in the store-report registry (../store-report/data/registry.js).
   Team demo (Claude 31, ?demo=team&rep=SR-D0x, served by ui/team-control/serve.mjs on 8791): the same page for one of the five
   «Багийн хяналт» demo reps — their own DM customers (numbers = each one's mapped profile, the SR-073 customer it was copied from),
   a demo route/visits config (data/team-demo.js) and their assignments from the one team store (../team-control/assets/core.js).
   A demo choice, not a login: nothing else changes for SR-073.
   Published package (Claude 33): «Миний маршрут» in the workspace opens the team demo; a bare /rep-route/ (the bot's /route
   button) goes there too when ../rep-home/assets/deploy.js says route: 'team'. SR-073's route = ?rep=SR-073 or any route state. */
(function () {
  'use strict';
  var FX = window.REP_ROUTE_FIXTURE, REG = window.STORE_REPORT_REGISTRY || { stores: {} };
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');
  var P0 = new URLSearchParams(location.search), TEAM = P0.get('demo') === 'team', REP = TEAM ? (P0.get('rep') || '').trim() : '';
  var T = null, TK = null;   // team demo: window.TeamCore, and this rep's tasks per customer (refreshed on every render)
  // the package's default entry: a URL without any query opens the task demo (replace: no history entry, launch hash kept, no loop)
  if (!TEAM && !location.search.replace(/^\?/, '') && window.WS && window.WS.deploy.route === 'team' && window.WS.go(window.WS.href('route'), true)) return;

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
  var byCode = {}, W, R, VIS, days = [];
  function setData(fx) {
    FX = fx; W = FX.window; R = FX.rules; VIS = (FX.visits || {}).by_code || {};
    byCode = {}; FX.customers.forEach(function (c) { byCode[c.code] = c; });
    days = FX.routes.days.map(function (d) { return d.date; }).sort();
    state.day = FX.routes.default_day;
  }
  var FLAG = { declined: 'Буурсан', lapsed: 'Авалт тасарсан', never: 'Авч байгаагүй' };
  var has = function (c, f) { return c.flags.indexOf(f) >= 0; };
  var attention = function (c) { return has(c, 'declined') || has(c, 'lapsed'); };
  var hasReport = function (code) { return TEAM ? !!byCode[code] : !!(REG.stores && REG.stores[code]); };   // team: every DM customer has its window
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
  // t (team demo only): '' | 'task' = has active work (Хийх + Хянуулах) | 'reply' = has work to reply to (Хийх). Team default chip: Бүгд.
  var TFILTER = { task: 'Даалгавартай', reply: 'Хариу өгөх' };
  // team demo (Claude 34): the column headers sort — the first tap = the first listed direction, the next tap flips it ('' = 12 сар ↓) —
  // and two columns filter (funnel → one small popover). Буурсан / Авч байгаагүй = the existing flags; Суурьгүй = the row's own «Суурьгүй».
  var COLS = [
    { k: 'name', l: 'Харилцагч', s: [['name', 'ascending', 'А→Я'], ['name_desc', 'descending', 'Я→А']] },
    // Сарын дундаж = 12 бүтэн сарын дүн ÷ 12 (the drawer's own average): its order is the 12-month sum's order, so it sorts by t12
    { k: 'avg', l: 'Сарын дундаж', s: [['t12', 'descending', 'их→бага'], ['t12_asc', 'ascending', 'бага→их']] },
    { k: 'cur', l: 'Энэ сарын авалт', s: [['cur', 'descending', 'их→бага'], ['cur_asc', 'ascending', 'бага→их']] },
    { k: 'last', l: 'Сүүлийн авалт', s: [['last_new', 'descending', 'шинэ→хуучин'], ['last_old', 'ascending', 'хуучин→шинэ']], f: 'lf' }
  ];
  var HSORT = {}; COLS.forEach(function (col) { col.s.forEach(function (s) { HSORT[s[0]] = col; }); });   // an old change sort (pct_*) → the default
  var COLF = { lf: { l: 'Сүүлийн авалт', o: { d30: '30+ хоног аваагүй', never: 'Авч байгаагүй' } } };
  function inCol(c, k, v) { return !v || (v === 'd30' ? !!c.last && c.gap >= 30 : has(c, 'never')); }
  var curOf = function (c) { return typeof c.cur === 'number' ? money(c.cur) : '—'; };   // this month to the cutoff, as in the drawer
  var state = { tab: 'route', day: '', rs: '', rq: '', f: TEAM ? 'all' : 'attention', rec: 'all', aimag: '', type: '', q: '', sort: '', scope: '', t: '', lf: '' };
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
    if ((v = p.get('sort'))) { v = LEGACY_SORT[v] || v; if (TEAM ? HSORT.hasOwnProperty(v) : v in SORTS) state.sort = v; }
    if (p.get('scope') === 'route') state.scope = 'route';
    if (TEAM && TFILTER.hasOwnProperty(v = p.get('t'))) state.t = v;
    if (TEAM && COLF.lf.o.hasOwnProperty(v = p.get('lf'))) state.lf = v;   // an old change filter (cf=) is ignored: nothing hidden
  }
  function query() {
    var p = new URLSearchParams();
    if (TEAM) { p.set('demo', 'team'); p.set('rep', REP); }
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
    if (state.t) p.set('t', state.t);
    if (state.lf) p.set('lf', state.lf);
    return p.toString();
  }
  // the hash may carry Telegram's launch data (kept); the menu reopens this session's route state (workspace.js, validated).
  // The team demo is not SR-073's route, so it never overwrites that session memory.
  function writeUrl() { var q = '?' + query(); if (location.search !== q) history.replaceState(null, '', q + location.hash); if (window.WS) window.WS.remember(TEAM ? 'route' : 'legacy', q); }
  // team demo: the rep's own store window (?rep=&cust=), optionally on one assignment (a=) and straight at the task section (at=task)
  function reportUrl(code, aid, toTask) {
    if (!TEAM) return '../store-report/?store=' + encodeURIComponent(code) + '&from=route&ret=' + encodeURIComponent(query());
    return '../store-report/?rep=' + encodeURIComponent(REP) + '&cust=' + encodeURIComponent(code) + (aid ? '&a=' + encodeURIComponent(aid) : '') +
      (toTask ? '&at=task' : '') + '&from=route&ret=' + encodeURIComponent(query());
  }

  // ---------- init ----------
  function init() {
    readUrl();
    $('rep-label').textContent = FX.rep.label;
    if (TEAM) teamInit();
    $('asof').textContent = dDot(FX.cutoff) + '-ны байдлаар';
    $('count-roster').textContent = FX.portfolio.n;
    // the customers' change column names its real windows (last 3 full months vs the 3 before), not a vague «previous 3 months»
    var short = function (ms) { return ymDot(ms[0]) + '–' + ms[ms.length - 1].slice(5); };
    $('cu-head-chg').textContent = short(W.recent) + ' / ' + short(W.base);
    $('cu-head-chg').title = 'Сүүлийн 3 бүтэн сар (' + range(W.recent) + ') өмнөх 3 сартай (' + range(W.base) + ') харьцуулсан өөрчлөлт';
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
    if (TEAM) return '<p>' + esc(FX.routes.label) + '. ' + (d ? 'Энэ өдрийн ' + d.stops.length + ' дэлгүүр нь ' + esc(FX.rep.label.split(' · ')[0]) + '-ийн ' + FX.customers.length + ' харилцагчаас; бусад нь «Харилцагчид»-д. ' : '') +
      'Демо ажлын өдөр ' + dDot(FX.routes.default_day) + '; борлуулалтын тоо ' + dDot(FX.cutoff) + ' хүртэл.</p><p>«Сүүлд очсон» нь тусдаа жишиг очилтын бүртгэл: борлуулалтын огнооноос гаргаагүй, хариу илгээхэд бүртгэгдэхгүй. ' +
      '«Демо ХТ» сонголт нь нэвтрэлт, эрхийн систем биш: зөвхөн тухайн ХТ-ийн харилцагч, даалгаврыг шүүж харуулна.</p>';
    return '<p>' + (d ? 'Энэ өдрийн ' + d.stops.length + ' дэлгүүр нь ' + dDot(d.cohort.purchase_date) + '-нд авалт хийсэн харилцагчид (жишиг хуваарь, ' + esc(FX.routes.order_rule) + '). ' : '') +
      'Бодит очилт, GPS бүртгэл биш.</p><p>«Сүүлд очсон» нь жишиг очилтын бүртгэл: сонгосон өдрөөс хойших бүртгэлийг тооцохгүй; хоног = сонгосон өдөр − сүүлд очсон өдөр. «Сүүлийн авалт» нь борлуулалтын өгөгдөл.</p>';
  }

  // ---------- team demo (Claude 31): data, header, task marks ----------
  // the rep's own DM customers, each with its mapped profile's numbers (team-control/data/profiles.js; never matched by amounts),
  // the config's route for the one demo work day (only this rep's codes) and demo visits. Unknown rep → no data, no fallback.
  function teamFixture() {
    var TF = T.FX, PRO = window.TEAM_CONTROL_PROFILES, TD = window.REP_ROUTE_TEAM_DEMO, r = T.repBy.get(REP);
    if (!REP) return { fail: ['Демо ХТ сонгох', 'Багийн демогийн аль ХТ-ээр харахаа сонгоно уу. Энэ нь нэвтрэлт биш, демо сонголт.'] };
    if (!r) return { fail: ['Демо ХТ олдсонгүй', '«' + REP + '» кодтой демо ХТ алга. Өөр ХТ-ийн мэдээлэл харуулахгүй; доороос сонгоно уу.'] };
    var prof = {}; FX.customers.forEach(function (c) { prof[c.code] = c; });   // FX is still the SR-073 fixture here
    var cs = TF.customers.filter(function (c) { return c.rep === REP; }).map(function (c) {
      var p = PRO && PRO.customers[c.code], v = p && prof[p.profile];
      return v ? Object.assign({}, v, { code: c.code, name: c.name }) : null;
    });
    if (cs.indexOf(null) >= 0) return { fail: ['Мэдээлэл ачаалж чадсангүй', 'Харилцагчийн тоон профайл олдсонгүй.'] };
    var mine = {}; cs.forEach(function (c) { mine[c.code] = true; });
    var vis = {}; Object.keys(TD.visits).forEach(function (k) { if (mine[k]) vis[k] = TD.visits[k]; });
    var cnt = { declined: 0, lapsed: 0, never: 0, attention: 0 };
    cs.forEach(function (c) { c.flags.forEach(function (f) { cnt[f]++; }); if (attention(c)) cnt.attention++; });
    return Object.assign({}, FX, {
      rep: { code: REP, label: r.name + ' · ' + REP },
      routes: { label: TD.label, rep: REP, default_day: TD.work_day, order_rule: TD.order_rule,
        days: [{ date: TD.work_day, stops: (TD.routes[REP] || []).filter(function (k) { return mine[k]; }) }] },   // never another rep's store
      visits: { label: TD.visits_label, by_code: vis },
      portfolio: { n: cs.length, t12: cs.reduce(function (t, c) { return t + c.t12; }, 0) },
      counts: cnt, customers: cs
    });
  }
  function repState(title, text) {   // no rep / unknown rep: a short choice of the five demo reps, nothing else
    $('state-title').textContent = title; $('state-text').textContent = text;
    if (T) $('state').insertAdjacentHTML('beforeend', '<ul class="rr-reps">' + T.FX.reps.map(function (r) {
      return '<li><a class="btn-sec" data-ws-nav href="?demo=team&amp;rep=' + encodeURIComponent(r.code) + '">' + esc(r.name) + ' · ' + esc(r.code) + '</a></li>';
    }).join('') + '</ul>');
    $('state').hidden = false; app.setAttribute('aria-busy', 'false');
    if (window.WS) window.WS.page({});   // Telegram Back → «Миний ажил»
  }
  function teamInit() {
    // the demo rep choice lives in «Цэс» (the header keeps the title + «Цэс» on one line); no shared menu → the header keeps it
    var side = document.querySelector('.rr-side'), menu = document.querySelector('[data-ws-menu] .ws-pop');
    (menu || side).insertAdjacentHTML('beforeend', '<div class="rr-rep-sw"><p class="rr-rep-t">Демо ХТ солих</p><label class="sort rr-rep"><select id="demo-rep" aria-label="Демо ХТ солих (нэвтрэлт биш)">' +
      T.FX.reps.map(function (r) { return '<option value="' + esc(r.code) + '"' + (r.code === REP ? ' selected' : '') + '>' + esc(r.name) + ' · ' + esc(r.code) + '</option>'; }).join('') +
      '</select><svg class="ic chev" aria-hidden="true"><use href="#i-chev"/></svg></label></div>');
    var tabRow = document.createElement('div');   // the tablist keeps only its two tabs; the shortcut (route) / ⓘ periods (customers) beside it
    tabRow.className = 'rr-tabrow'; tabRow.id = 'rr-tabrow'; $('tabs').before(tabRow); tabRow.append($('tabs'));
    tabRow.insertAdjacentHTML('beforeend', '<button type="button" class="btn-sec rr-tkgo" id="tk-go" hidden></button>' +
      '<button type="button" class="icon-btn rr-info" id="cu-info-btn" popovertarget="cu-info" aria-label="Хугацааны тайлбар" title="Хугацаа" hidden>' +
      '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5.5M12 7.6v.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
      '<div class="rr-info-pop" id="cu-info" popover><dl><dt>Сарын дундаж</dt><dd>' + range(W.months) + ' · 12 бүтэн сарын дүн ÷ 12</dd>' +
      '<dt>Энэ сарын авалт</dt><dd>' + (FX.current ? dDot(FX.current.from) + '–' + FX.current.to.slice(8) : '—') + '</dd></dl></div>');
    document.querySelector('.day-pick .lbl').textContent = 'Ажлын өдөр';
    $('day').setAttribute('aria-label', 'Демо ажлын өдөр');
    // route (Claude 35): the customers' sticky block and header controls — tabs · ‹ day › + search · № | Харилцагч | Сүүлд очсон | store.
    // The schedule order menu is hidden (the headers sort); «Тайлбар» moves into the ⓘ popover beside the tabs.
    var pr = $('panel-route'), rh = pr.querySelector('.rt-head'), rtbl = document.createElement('div'), rstick = document.createElement('div');
    rtbl.setAttribute('role', 'table'); rtbl.setAttribute('aria-label', 'Маршрутыг баганаар эрэмбэлэх');
    rh.id = 'rt-head'; rh.setAttribute('role', 'row'); rh.removeAttribute('aria-hidden'); rtbl.append(rh);
    rstick.className = 'cu-stick'; rstick.id = 'rt-stick'; pr.prepend(rstick);
    rstick.append($('route-bar'), pr.querySelector('.route-tools'), rtbl);
    $('rt-sort').closest('.sort').hidden = true;
    tabRow.insertAdjacentHTML('beforeend', '<div class="rr-info-pop" id="rt-info" popover></div>');
    $('rt-info').append($('route-note')); pr.querySelector('.rr-rules').hidden = true;
    rh.addEventListener('click', function (e) {
      var s = e.target.closest('[data-rsort]'); if (!s) return;
      state.rs = s.dataset.rsort === 'no' ? '' : state.rs === 'visit_old' ? 'visit_new' : 'visit_old'; renderRoute();
    });
    // customers (Claude 32): the list is the main content. Always in view: search · «Шүүлт» · sort, then Бүгд | Даалгавартай |
    // Хариу өгөх and the shown count. The analytic chips, record/aimag/type, route scope and portfolio totals fold into «Шүүлт».
    var tools = document.querySelector('.cu-tools');
    tools.insertAdjacentHTML('afterend', '<div class="cu-panel" id="cu-panel" hidden></div><div class="cu-tbar" id="cu-tbar">' +
      '<div class="seg cu-tchips ws-seg" role="group" aria-label="Даалгавраар шүүх (харилцагчийн тоо)" id="cu-tchips"></div></div>');
    var panel = $('cu-panel');
    [$('cu-sum'), $('cu-chips')].concat([].slice.call(tools.querySelectorAll('.cu-sec')), [$('cu-scope')]).forEach(function (el) { panel.append(el); });
    $('cu-tbar').append($('cu-count'), $('cu-reset'));
    $('cu-reset').insertAdjacentHTML('beforebegin', '<span class="cu-fxs" id="cu-fxs"></span>');   // active column filters, each clearable
    $('cu-more').setAttribute('aria-controls', 'cu-panel');
    $('cu-reset').title = 'Хайлт, даалгаврын шүүлт, баганын болон нэмэлт шүүлтийг цэвэрлэнэ (эрэмбэ хэвээр)';
    // Claude 34: one sticky block = the tabs (moved in by selectTab) + search/«Шүүлт» + task choices + periods + column headers.
    // The headers sort (aria-sort; the old sort menu is hidden) and two of them filter through one popover inside the block.
    var pc = $('panel-customers'), head = pc.querySelector('.cu-head'), tbl = document.createElement('div');
    tbl.setAttribute('role', 'table'); tbl.setAttribute('aria-label', 'Харилцагчдыг баганаар эрэмбэлэх, шүүх');
    head.id = 'cu-head'; head.setAttribute('role', 'row'); head.removeAttribute('aria-hidden'); tbl.append(head);
    var stick = document.createElement('div'); stick.className = 'cu-stick'; stick.id = 'cu-stick'; pc.prepend(stick);
    stick.append(tools, panel, $('cu-tbar'), tbl);
    stick.insertAdjacentHTML('beforeend', '<div class="cu-pop" id="cu-pop" role="dialog" aria-labelledby="cu-pop-t" hidden></div>');
    $('cu-sort').closest('.sort').hidden = true;
    $('cu-head').addEventListener('click', function (e) {
      var f = e.target.closest('[data-filter]'), s = e.target.closest('[data-sort]');
      if (f) { if (pop.f === f.dataset.filter) closePop(); else openPop(f.dataset.filter); return; }
      if (!s) return;
      var col = COLS.filter(function (x) { return x.k === s.dataset.sort; })[0], cur = sortKey();
      var nx = cur === col.s[0][0] ? col.s[1][0] : col.s[0][0];
      state.sort = nx === 't12' ? '' : nx; closePop(); renderCustomers(); toListTop();
    });
    $('cu-pop').addEventListener('click', function (e) {
      var f = pop.f, o = e.target.closest('[data-v]');
      if (e.target.closest('[data-pop-close]')) { closePop(); focusFunnel(f); return; }
      if (!o) return;
      closePop(); state[f] = o.dataset.v; renderCustomers(); toListTop(); focusFunnel(f);
    });
    $('cu-fxs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-clear]'); if (!b) return;
      state[b.dataset.clear] = ''; renderCustomers(); focusFunnel(b.dataset.clear);
    });
    // light dismiss: a tap outside closes the popover and does nothing else (no row opens, no sort); Esc closes it too
    document.addEventListener('click', function (e) { if (pop.f && !e.target.closest('#cu-pop, [data-filter]')) { closePop(); e.preventDefault(); e.stopPropagation(); } }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop.f) { var f = pop.f; closePop(); focusFunnel(f); } });
    addEventListener('resize', function () { if (pop.f) placePop(); });
    $('demo-rep').addEventListener('change', function () {   // a fresh page for that rep (same webview, Telegram launch data kept)
      var u = '?demo=team&rep=' + encodeURIComponent(this.value);
      if (!(window.WS && window.WS.go(u))) location.assign(u);
    });
    $('tk-go').addEventListener('click', function () { taskFilter('reply', true); selectTab('customers'); $('cu-tchips').querySelector('[data-t="reply"]').focus(); });
    $('cu-tchips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return;
      taskFilter(b.dataset.t); toListTop();
      var nb = $('cu-tchips').querySelector('[data-t="' + b.dataset.t + '"]'); if (nb) nb.focus();
    });
  }
  // «Хариу өгөх: N харилцагч» next to the route tab: every assigned customer with work to reply to, in or out of today's route.
  // On the customers tab the same number is the «Хариу өгөх» filter itself, so the shortcut is not repeated there.
  function renderTaskGo() {
    var n = FX.customers.filter(function (c) { return (tasksOf(c.code) || {}).todo; }).length, b = $('tk-go');
    b.hidden = !n || state.tab === 'customers';
    b.innerHTML = ic('reply') + '<span class="rr-tkgo-t"><span>Харилцагчид:</span> хариу өгөх <b class="num">' + n + '</b></span>';
    b.setAttribute('aria-label', 'Бүх харилцагчаас ' + n + ' нь хариу өгөх ажилтай: Харилцагчид хэсэгт харах');
  }
  // the route tab's shortcut opens every assigned customer (all: chip, scope, extra filters and search reset). Choosing in the
  // list keeps the folded extra filters; the count line then says how many customers with that work they hide.
  function taskFilter(t, all) {
    state.t = t;
    if (all) { state.f = 'all'; state.scope = ''; state.rec = 'all'; state.aimag = ''; state.type = ''; state.q = ''; }
    renderCustomers();
  }
  var extraOn = function () { return (state.f !== 'all') + (state.rec !== 'all') + !!state.aimag + !!state.type + !!state.scope; };   // team: what «Шүүлт» folds
  // ---------- team demo (Claude 34): column headers (sort + funnel) and the one filter popover ----------
  var pop = { f: '' };
  function renderHead() {
    var cur = sortKey(), a = document.activeElement, keep = a && a.closest && a.closest('#cu-head') ? (a.dataset.sort ? '[data-sort="' + a.dataset.sort + '"]' : '[data-filter="' + a.dataset.filter + '"]') : '';
    $('cu-head').innerHTML = COLS.map(function (col) {
      var dir = HSORT[cur] === col ? col.s.filter(function (s) { return s[0] === cur; })[0] : null, f = col.f, fv = f ? state[f] : '';
      var next = dir && dir[0] === col.s[0][0] ? col.s[1] : col.s[0];
      return '<div role="columnheader" class="cu-hc cu-h-' + col.k + (dir ? ' is-on' : '') + '" aria-sort="' + (dir ? dir[1] : 'none') + '">' +
        (f ? '<button type="button" class="cu-hf' + (fv ? ' is-on' : '') + '" data-filter="' + f + '" aria-haspopup="dialog" aria-controls="cu-pop" aria-expanded="' + (pop.f === f) + '" aria-label="' +
          esc(col.l + ': шүүлт' + (fv ? ', одоо «' + COLF[f].o[fv] + '»' : '')) + '" title="Шүүх">' + ic('funnel') + '</button>' : '') +
        // the arrow stays on the label's last word, so a two-line label is no wider than its longest word
        '<button type="button" class="cu-hs" data-sort="' + col.k + '" title="' + esc('Эрэмбэлэх: ' + next[2]) + '"><span class="cu-hl">' + col.l.replace(/(\S+)$/, '<span class="nw">$1' +
          '<svg class="ic cu-ar' + (dir ? ' ' + dir[1].slice(0, 3) : '') + '" aria-hidden="true"><use href="#i-' + (dir ? 'arr' : 'sort') + '"/></svg></span>') + '</span></button></div>';
    }).join('');
    if (keep) $('cu-head').querySelector(keep).focus();
  }
  function popHint(f, v) {
    return { d30: 'Сүүлийн авалтаас 30+ хоног', never: dDot(FX.coverage.from) + '-аас хойш авалтгүй' }[v] || '';
  }
  function renderPop() {   // options count the customers the other filters already show
    var f = pop.f, el = $('cu-pop'), b = base(), a = document.activeElement, keep = a && a.closest && a.closest('#cu-pop [data-v]') ? a.dataset.v : null;
    el.innerHTML = '<div class="cu-pop-h"><b id="cu-pop-t">' + COLS.filter(function (c) { return c.f === f; })[0].l + ' · шүүлт</b>' +
      '<button type="button" class="icon-btn" data-pop-close aria-label="Хаах">' + ic('x') + '</button></div>' +
      [''].concat(Object.keys(COLF[f].o)).map(function (v) {
        var n = b.filter(function (c) { return pass(c, f) && inCol(c, f, v); }).length, h = popHint(f, v);
        return '<button type="button" class="cu-opt" data-v="' + v + '" aria-pressed="' + (state[f] === v) + '"><span>' + (COLF[f].o[v] || 'Бүгд') + (h ? '<small>' + esc(h) + '</small>' : '') + '</span><b class="num">' + n + '</b></button>';
      }).join('');
    el.hidden = false; placePop();
    if (keep !== null) el.querySelector('[data-v="' + keep + '"]').focus();
  }
  // inside the sticky block (it moves with the headers); right-aligned under its column, never past the screen edges.
  // Not enough room below → the page scrolls so the block sticks first; still short → the list of options scrolls.
  function placePop() {
    var el = $('cu-pop'), cell = $('cu-head').querySelector('[data-filter="' + pop.f + '"]').parentNode, w = Math.min(300, innerWidth - 24);
    el.style.width = w + 'px'; el.style.maxHeight = '';
    var r = cell.getBoundingClientRect(), need = r.bottom + 4 + el.offsetHeight + 12 - innerHeight;
    if (need > 0) { scrollBy(0, need); r = cell.getBoundingClientRect(); }
    var s = $('cu-stick').getBoundingClientRect(), x = Math.max(12, Math.min(r.right - w, innerWidth - 12 - w));
    el.style.left = (x - s.left) + 'px'; el.style.top = (r.bottom - s.top + 4) + 'px';
    el.style.maxHeight = Math.max(120, innerHeight - r.bottom - 16) + 'px';
  }
  function openPop(f) { pop.f = f; renderHead(); renderPop(); var o = $('cu-pop').querySelector('[aria-pressed="true"]'); if (o) o.focus(); }
  function closePop() { if (!pop.f) return; pop.f = ''; $('cu-pop').hidden = true; [].forEach.call($('cu-head').querySelectorAll('[data-filter]'), function (b) { b.setAttribute('aria-expanded', 'false'); }); }
  function focusFunnel(f) { var b = $('cu-head').querySelector('[data-filter="' + f + '"]'); if (b) b.focus(); }
  function toListTop() {   // a new order or filter starts at its first row (just under the sticky block), never mid-list
    var s = $('cu-stick'), y = $('cu-list').getBoundingClientRect().top + window.scrollY - s.offsetHeight - (parseFloat(getComputedStyle(s).top) || 0);
    if (window.scrollY > y) window.scrollTo(0, y);
  }
  var tasksOf = function (code) { return TK && TK.get(code) || null; };
  var ic = function (id) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; };
  function taskSay(t) {
    return [t.todo ? 'хариу өгөх ' + t.todo : '', t.back ? 'үүнээс буцаасан ' + t.back : '', t.review ? 'хянуулж байгаа ' + t.review : ''].filter(Boolean).join(', ');
  }
  // route row: the tags are status inside the row (as in the customer list); the shortcut to the task is its own 44px cell beside the
  // store button, so the row's name, code and centre always open the drawer. Its mark: returned work first, then work to reply to.
  function taskBtn(c) {
    var t = tasksOf(c.code);
    if (!t || !t.active) return '<span class="rt-win-none" aria-hidden="true"></span>';
    var k = t.back ? ['back', 'undo'] : t.todo ? ['need', 'reply'] : ['rev', 'review'];
    return '<a class="icon-btn rt-tkbtn tk-' + k[0] + '" href="' + esc(reportUrl(c.code, t.list[0].id, true)) + '" data-report="' + esc(c.code) + '" aria-label="' +
      esc(c.name + ': даалгавар ' + t.active + ' (' + taskSay(t) + '). Дэлгүүрийн цонхны даалгавар руу') + '" title="Даалгавар нээх">' + ic(k[1]) + '<b class="num">' + t.active + '</b></a>';
  }
  function renderRouteHead() {   // № = the schedule order; Сүүлд очсон flips удаан очоогүйгээс ↔ сүүлд очсоноос (the customers' header controls)
    var a = document.activeElement, keep = a && a.dataset && a.dataset.rsort, v = state.rs;
    var cell = function (k, l, dir, title) {
      return '<div role="columnheader" class="cu-hc rt-h-' + k + (dir ? ' is-on' : '') + '" aria-sort="' + (dir || 'none') + '"><button type="button" class="cu-hs" data-rsort="' + k + '" title="' + title + '">' +
        '<span class="cu-hl"><span class="nw">' + l + '<svg class="ic cu-ar' + (dir ? ' ' + dir.slice(0, 3) : '') + '" aria-hidden="true"><use href="#i-' + (dir ? 'arr' : 'sort') + '"/></svg></span></span></button></div>';
    };
    $('rt-head').innerHTML = cell('no', '№', v ? '' : 'ascending', 'Хуваарийн дараалал') + '<div role="columnheader" class="cu-hc rt-h-name">Харилцагч</div>' +
      cell('visit', 'Сүүлд очсон', v === 'visit_old' ? 'ascending' : v === 'visit_new' ? 'descending' : '', v === 'visit_old' ? 'Эрэмбэлэх: сүүлд очсоноос' : 'Эрэмбэлэх: удаан очоогүйгээс') +
      '<div role="columnheader" class="cu-hc rt-h-win" title="Даалгавар">' + ic('reply') + '<span class="sr-only">Даалгавар нээх</span></div>' +
      '<div role="columnheader" class="cu-hc rt-h-win" title="Дэлгүүрийн цонх">' + ic('store') + '<span class="sr-only">Дэлгүүр нээх</span></div>';
    if (keep) $('rt-head').querySelector('[data-rsort="' + keep + '"]').focus();
  }
  // customer row: compact status tags, only the non-zero ones (closed work is in the drawer and the store window)
  function taskTags(c) {
    var t = tasksOf(c.code); if (!t) return '';
    return (t.todo ? '<span class="tk tk-need">' + ic('reply') + 'Хариу өгөх ' + t.todo + '</span>' : '') +
      (t.back ? '<span class="tk tk-back">' + ic('undo') + 'Буцаасан ' + t.back + '</span>' : '') +
      (t.review ? '<span class="tk tk-rev">' + ic('review') + 'Хянуулж байгаа ' + t.review + '</span>' : '');
  }
  // drawer: active work in short (name, state, deadline) → the common store window on that assignment; no reply form here
  var TSTATE = function (a) { return T.returned(a) ? ['back', 'undo', 'Буцаасан'] : a.status === 'todo' ? ['need', 'reply', 'Хариу өгөх'] : a.status === 'review' ? ['rev', 'review', 'Хянуулж байгаа'] : [a.status, a.status, T.STATUS[a.status].t]; };
  function drawerTasks(c) {
    var t = tasksOf(c.code); if (!t) return '';
    var act = t.list.filter(function (a) { return a.status === 'todo' || a.status === 'review'; });
    return '<section class="pd-sec rr-tasks" id="dr-tasks"><h3>Даалгавар <span>одоо нээлттэй ' + t.active + '</span></h3>' +
      (act.length ? '<ul class="rr-tk-list">' + act.map(function (a) {
        var s = TSTATE(a), task = T.S.tasks.get(a.task);
        return '<li><a class="rr-tk" href="' + esc(reportUrl(c.code, a.id, true)) + '" data-report="' + esc(c.code) + '"><span class="tk tk-' + s[0] + '">' + ic(s[1]) + s[2] + '</span>' +
          '<span class="rr-tk-t">' + esc(task.title) + '</span><span class="rr-tk-d num">Хугацаа ' + T.short(task.due) + '</span>' + ic('right') + '</a></li>';
      }).join('') + '</ul>' : '<p class="rr-tk-none">Одоо нээлттэй даалгавар алга.</p>') +
      (t.done || t.failed ? '<p class="rr-tk-past">Өмнөх: Баталгаажсан <b>' + t.done + '</b> · Биелээгүй <b>' + t.failed + '</b></p>' : '') +
      '<a class="btn-sec rr-tk-all" href="' + esc(reportUrl(c.code, '', true)) + '" data-report="' + esc(c.code) + '">' + ic('store') + 'Даалгавар харах</a></section>';
  }
  // another tab gave, answered or decided a task: re-read (core) and redraw marks, counts, lists and an open drawer; filters stay
  function refresh() {
    var id = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-code], [data-report]');
    var key = id && (id.dataset.code ? '[data-code="' + id.dataset.code + '"]' : null);
    renderRoute(); renderCustomers();
    if ($('dr').open) { var s = $('dr-tasks'), html = drawerTasks(byCode[drawer.code]); if (s) s.outerHTML = html || ''; else if (html) $('dr-body').querySelector('.rr-cta, .rr-nocta').insertAdjacentHTML('afterend', html); }
    else if (key) { var el = document.querySelector('#panel-' + state.tab + ' ' + key); if (el) el.focus({ preventScroll: true }); }
  }

  // ---------- tabs ----------
  var TABS = ['route', 'customers'];
  var LOW = window.matchMedia('(max-height: 560px)');   // a low landscape tablet: the tabs sit above the sticky block and scroll away
  function placeTabs() { var st = $(state.tab === 'customers' ? 'cu-stick' : 'rt-stick'); if (LOW.matches) st.before($('rr-tabrow')); else st.prepend($('rr-tabrow')); }
  LOW.addEventListener('change', function () { if (TEAM) placeTabs(); });   // turning the tablet moves them back
  function selectTab(t, focus) {
    scrollY[state.tab] = window.scrollY;
    state.tab = t;
    if (TEAM) {   // the tabs head the active card: in the customers' sticky block, above the route bar (same place on both tabs)
      var tr = $('rr-tabrow'), fo = tr.contains(document.activeElement) ? document.activeElement : null;
      closePop(); placeTabs();
      $('cu-info-btn').hidden = false; $('cu-info-btn').setAttribute('popovertarget', t === 'customers' ? 'cu-info' : 'rt-info');   // ⓘ: this tab's own note
      $('cu-info-btn').setAttribute('aria-label', t === 'customers' ? 'Хугацааны тайлбар' : 'Маршрутын тайлбар');
      if (fo) fo.focus({ preventScroll: true });
    }
    TABS.forEach(function (k) {
      var on = k === t, b = $('tab-' + k);
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      $('panel-' + k).hidden = !on;
      if (on && focus) b.focus();
    });
    window.scrollTo(0, scrollY[t] || 0);   // each tab keeps its own scroll position
    if (TEAM) renderTaskGo();
    writeUrl();
  }

  // ---------- route (a plain daily list: №, store, last demo visit, report; attention lives in «Харилцагчид») ----------
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
    if (TEAM) { TK = T.repTasks(REP); renderTaskGo(); }
    $('day').value = state.day; $('day-val').textContent = dDot(state.day);
    $('day').setAttribute('aria-label', (TEAM ? 'Демо ажлын өдөр, ' : 'Маршрутын өдөр, ') + dDot(state.day));
    var prev = days.filter(function (x) { return x < state.day; }).pop(), next = days.filter(function (x) { return x > state.day; })[0];
    $('day-prev').setAttribute('aria-disabled', String(!prev)); $('day-next').setAttribute('aria-disabled', String(!next));
    $('day-prev').dataset.go = prev || ''; $('day-next').dataset.go = next || '';
    $('rt-sort').value = state.rs; if ($('rt-q').value !== state.rq) $('rt-q').value = state.rq;
    $('route-note').innerHTML = routeNote(d);
    var none = !d;
    document.querySelector('.route-tools').hidden = none;
    document.querySelector('.rt-head').hidden = none;
    $('count-route').textContent = d ? d.stops.length : '';
    if (none) {
      $('route-list').innerHTML = '';
      $('route-empty').hidden = false;
      emptyState('route-empty', dDot(state.day) + '-нд жишиг маршрут тохируулаагүй. Тохируулсан өдөр: ' + days.map(dDot).join(', ') + '.', dDot(FX.routes.default_day) + '-ны маршрут харах', 'day');
      writeUrl();
      return;
    }
    var stops = routeStops();
    $('route-count').innerHTML = '<b>' + stops.length + '</b> / ' + d.stops.length + ' харилцагч';
    $('route-count').hidden = !state.rq;   // the tab carries the route's count; while searching: shown / all of the route
    $('route-count').setAttribute('aria-label', 'Маршрутын ' + d.stops.length + ' харилцагчаас ' + stops.length + ' нь харагдаж байна');
    $('rt-clear').hidden = !state.rq;
    $('route-empty').hidden = stops.length > 0;
    emptyState('route-empty', '«' + state.rq + '» нэр, кодтой харилцагч энэ маршрутад алга.', 'Хайлтыг цэвэрлэх', 'rq');
    // one line name, one line code · type (aimag stays in the drawer); last visit = short date + days, or «Бүртгэлгүй»
    if (TEAM) renderRouteHead();
    $('route-list').innerHTML = stops.map(function (s) {
      var c = byCode[s.code], gap = s.lv ? daysBetween(s.lv, state.day) : null;
      return '<li class="rt-item"><button type="button" class="rt-row" data-code="' + esc(c.code) + '" aria-haspopup="dialog" aria-label="' +
        esc('№' + s.no + ', ' + c.name + ', ' + c.code + (TEAM ? '' : ', ' + c.type) + '. Сүүлд очсон: ' + (s.lv ? dDot(s.lv) + ', ' + gap + ' хоног' : 'бүртгэлгүй') +
          (TEAM && tasksOf(c.code) && tasksOf(c.code).active ? '. Даалгавар: ' + taskSay(tasksOf(c.code)) : '')) + '">' +
        '<span class="rt-no num" title="Хуваарьт дараалал">' + s.no + '</span>' +
        // team demo: the customer list's name, then its status tags + code (part of the row: they open the drawer too)
        (TEAM ? '<span class="rt-main"><b class="cu-n1">' + esc(c.name) + '</b><span class="cu-n2">' + taskTags(c) + '<span class="cu-meta">' + esc(c.code) + '</span></span></span>'
          : '<span class="rt-main"><b>' + esc(c.name) + '</b><span>' + esc(c.code + ' · ' + c.type) + '</span></span>') +
        '<span class="rt-visit num">' + (s.lv ? '<b>' + shortDate(s.lv) + '</b><span>' + gap + ' хоног</span>' : '<span class="muted-s">Бүртгэлгүй</span>') + '</span>' +
        (TEAM ? '</button>' + taskBtn(c) : '<svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button>') +
        (hasReport(c.code) ? '<a class="icon-btn rt-win" href="' + esc(reportUrl(c.code)) + '" data-report="' + esc(c.code) + '" aria-label="' + esc(c.name) + ': дэлгүүрийн цонх нээх" title="Дэлгүүрийн цонх">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-store"/></svg></a>' : '<span class="rt-win-none" aria-hidden="true"></span>') + '</li>';
    }).join('');
    writeUrl();
  }
  function setDay(v) { if (!v) return; state.day = v; renderRoute(); if (state.scope) renderCustomers(); }
  // an empty list says why and offers the one action that undoes it (clear the search / the filters, back to a route day)
  function emptyState(id, text, action, key) {
    $(id).innerHTML = '<span>' + esc(text) + '</span><button type="button" class="btn-sec" data-empty="' + key + '">' + esc(action) + '</button>';
  }
  function undoEmpty(key) {
    if (key === 'rq') { state.rq = ''; renderRoute(); $('rt-q').focus(); }
    else if (key === 'day') { setDay(FX.routes.default_day); $('day').focus(); }
    else if (key === 't') { state.t = ''; renderCustomers(); $('cu-q').focus(); }
    else $('cu-reset').click();
  }

  // ---------- customers ----------
  function inRoute(c) { var d = routeDay(state.day); return !!d && d.stops.indexOf(c.code) >= 0; }
  function base() {   // scope: secondary filters (+ the selected day's route); every chip count and the result total use it
    return FX.customers.filter(function (c) {
      return (state.rec === 'all' || c.record === state.rec) && (!state.aimag || c.aimag === state.aimag) && (!state.type || c.type === state.type) &&
        (state.scope !== 'route' || inRoute(c));
    });
  }
  function inChip(c, f) { return f === 'all' || (f === 'attention' ? attention(c) : has(c, f)); }
  function inTask(c, t) { var x = tasksOf(c.code); return !t || !!x && (t === 'reply' ? x.todo > 0 : x.active > 0); }   // team demo only
  function pass(c, skip) {   // everything on top of base(): chip, task, search, column filters (skip = leave one out: its popover's counts)
    var q = norm(state.q);
    return inChip(c, state.f) && inTask(c, state.t) && (!q || norm(c.name + ' ' + c.code).indexOf(q) >= 0) &&
      (skip === 'lf' || inCol(c, 'lf', state.lf));
  }
  var code = function (a, b) { return a.code.localeCompare(b.code); };
  var validB = function (c) { return c.b > 0; };
  var CMP = {   // real (unrounded) values; ties by a meaningful value, then code; no comparison base / never purchased always last
    decline: function (a, b) { return (validB(b) - validB(a)) || (validB(a) && validB(b) ? (a.r - a.b) - (b.r - b.b) || a.rate - b.rate : 0) || code(a, b); },
    pct_down: function (a, b) { return (validB(b) - validB(a)) || (validB(a) && validB(b) ? a.rate - b.rate || (a.r - a.b) - (b.r - b.b) : 0) || code(a, b); },
    pct_up: function (a, b) { return (validB(b) - validB(a)) || (validB(a) && validB(b) ? b.rate - a.rate || (b.r - b.b) - (a.r - a.b) : 0) || code(a, b); },
    last_new: function (a, b) { return (a.last === null) - (b.last === null) || (a.last > b.last ? -1 : a.last < b.last ? 1 : 0) || code(a, b); },
    last_old: function (a, b) { return (a.last === null) - (b.last === null) || (a.last < b.last ? -1 : a.last > b.last ? 1 : 0) || code(a, b); },
    t12: function (a, b) { return b.t12 - a.t12 || code(a, b); },
    t12_asc: function (a, b) { return a.t12 - b.t12 || code(a, b); },
    cur: function (a, b) { return (typeof a.cur !== 'number') - (typeof b.cur !== 'number') || b.cur - a.cur || code(a, b); },
    cur_asc: function (a, b) { return (typeof a.cur !== 'number') - (typeof b.cur !== 'number') || a.cur - b.cur || code(a, b); },
    name_desc: function (a, b) { return b.name.localeCompare(a.name, 'mn') || code(a, b); },
    lapsed: function (a, b) { return b.t12 - a.t12 || (b.gap || 0) - (a.gap || 0) || code(a, b); },
    name: function (a, b) { return a.name.localeCompare(b.name, 'mn') || code(a, b); }
  };
  var DEFAULT_SORT = { declined: 'decline', lapsed: 'lapsed', never: 'name', all: 't12' };
  // → [{ title|null, rows }]: default «Анхаарах» = lapsed first (12-month value), then the other declined (largest ₮ drop); any chosen sort = one list
  // team demo: always one list in the header's order (no groups), so the active column always says how it is sorted
  function sortKey() { return TEAM ? (HSORT[state.sort] ? state.sort : 't12') : state.sort || DEFAULT_SORT[state.f]; }
  function groups() {
    var list = base().filter(function (c) { return pass(c); });
    if (!TEAM && state.f === 'attention' && !state.sort) {
      var lap = list.filter(function (c) { return has(c, 'lapsed'); }).sort(CMP.lapsed);
      var dec = list.filter(function (c) { return !has(c, 'lapsed') && has(c, 'declined'); }).sort(CMP.decline);
      return [{ title: 'Авалт тасарсан', note: '12 сарын дүнгээр', rows: lap }, { title: 'Буурсан', note: 'бууралтын дүнгээр', rows: dec }].filter(function (g) { return g.rows.length; });
    }
    return [{ title: null, rows: list.sort(CMP[sortKey()]) }];
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
      // team demo: the name alone on its line (may wrap); task tags + code under it. Then monthly average · this month · last purchase.
      (TEAM ? '<span class="cu-name"><b class="cu-n1">' + esc(c.name) + '</b><span class="cu-n2">' + taskTags(c) + '<span class="cu-meta">' + esc(c.code) + '</span></span></span>' +
          '<span class="cu-t12 num">' + money(c.t12 / 12) + '</span><span class="cu-t12 cu-cur num">' + curOf(c) + '</span><span class="cu-last num">' + last + '</span></button></li>'
        : '<span class="cu-name"><span class="cu-n1"><b>' + esc(c.name) + '</b>' + badges(c) + '</span><span class="cu-n2">' + esc(c.code + ' · ' + c.aimag + ' · ' + c.type) + '</span></span>' +
      '<span class="cu-t12 num">' + money(c.t12) + '</span>' +
      '<span class="cu-chg num">' + chg + '</span>' +
      '<span class="cu-last num">' + last + '</span>' +
      '<span class="cu-spark">' + spark(c) + '</span></button></li>');
  }
  function ariaRow(c) {
    if (TEAM) return c.name + ', ' + c.code + '. Сарын дундаж ' + money(c.t12 / 12) + ', энэ сарын авалт ' + curOf(c) +
      (c.last ? ', сүүлд авсан ' + dDot(c.last) + ', ' + c.gap + ' хоног' : ', авч байгаагүй') + (tasksOf(c.code) && tasksOf(c.code).active ? '. Даалгавар: ' + taskSay(tasksOf(c.code)) : '');
    return c.name + ', ' + c.code + '. 12 сарын дүн ' + money(c.t12) + (c.b > 0 ? ', өмнөх 3 сараас ' + pctS(c.rate) : ', харьцуулах суурьгүй') +
      (c.last ? ', сүүлд авсан ' + dDot(c.last) + ', ' + c.gap + ' хоног' : ', авч байгаагүй') + (c.flags.length ? '. ' + c.flags.map(function (f) { return FLAG[f]; }).join(', ') : '') +
      (tasksOf(c.code) && tasksOf(c.code).active ? '. Даалгавар: ' + taskSay(tasksOf(c.code)) : '');
  }
  function renderCustomers() {
    if (TEAM) { TK = T.repTasks(REP); renderTaskGo(); }
    var b = base(), cnt = {};
    CHIPS.forEach(function (f) { cnt[f] = b.filter(function (c) { return inChip(c, f); }).length; });
    // team demo: active work counted in tasks («ажил»); the filter buttons below count customers, like every chip
    var all = TEAM ? FX.customers.reduce(function (t, c) { var x = tasksOf(c.code); if (x) { t.a += x.active; t.r += x.todo; } return t; }, { a: 0, r: 0 }) : null;
    $('cu-sum').innerHTML = '<span class="cu-sum-l">Нийт портфель</span><span><b>' + FX.portfolio.n + '</b> харилцагч</span><span>12 сарын дүн <b>' + money(FX.portfolio.t12) + '</b> <span class="muted-s">' + range(W.months) + '</span></span>' +
      '<span>Анхаарах <b>' + FX.counts.attention + '</b></span>' + (all ? '<span>Одоо нээлттэй ажил <b>' + all.a + '</b> (үүнээс хариу өгөх <b>' + all.r + '</b>)</span>' : '');
    if (TEAM) $('cu-tchips').innerHTML = [''].concat(Object.keys(TFILTER)).map(function (t) {
      return '<button type="button" class="seg-btn tk-f" data-t="' + t + '" aria-pressed="' + (state.t === t) + '">' + (TFILTER[t] || 'Бүгд') + ' <b class="num">' + b.filter(function (c) { return inTask(c, t); }).length + '</b></button>';
    }).join('');
    $('cu-chips').innerHTML = CHIPS.map(function (f) {
      // team demo: the folded analytic «all» is «Бүх ангилал», so it never reads like the task filter's «Бүгд»
      return '<button type="button" class="seg-btn" data-chip="' + f + '" aria-pressed="' + (state.f === f) + '">' + (TEAM && f === 'all' ? 'Бүх ангилал' : CHIP_LABEL[f]) + ' <b class="num">' + cnt[f] + '</b></button>';
    }).join('');
    if ($('cu-q').value !== state.q) $('cu-q').value = state.q;
    $('cu-rec').value = state.rec; $('cu-aimag').value = state.aimag; $('cu-type').value = state.type; $('cu-sort').value = state.sort;
    var d = routeDay(state.day);
    $('cu-scope').hidden = state.scope !== 'route';
    if (state.scope === 'route') $('cu-scope').innerHTML = 'Маршрут ' + dDot(state.day) + (d ? ' · ' + d.stops.length : ' · хуваарьгүй') + '<span aria-hidden="true"> ✕</span>';
    $('cu-scope').setAttribute('aria-label', 'Маршрутын хүрээг арилгах');
    var gs = groups(), rows = gs.reduce(function (t, g) { return t.concat(g.rows); }, []);
    var rowsT12 = money(rows.reduce(function (t, c) { return t + c.t12; }, 0)), sec = extraOn();
    if (TEAM) {   // the shown count; folded extra filters are named here, with how many customers with that work they hide
      var q0 = norm(state.q), hid = state.t && sec ? FX.customers.filter(function (c) {
        return inTask(c, state.t) && (!q0 || norm(c.name + ' ' + c.code).indexOf(q0) >= 0) && inCol(c, 'lf', state.lf);
      }).length - rows.length : 0;
      $('cu-fxs').innerHTML = ['lf'].filter(function (k) { return state[k]; }).map(function (k) {
        return '<button type="button" class="scope-chip cu-fx" data-clear="' + k + '" aria-label="' + esc(COLF[k].l + ': «' + COLF[k].o[state[k]] + '» шүүлтийг арилгах') + '">' +
          COLF[k].l + ': ' + COLF[k].o[state[k]] + '<span aria-hidden="true"> ✕</span></button>';
      }).join('');
      $('cu-count').innerHTML = '<b>' + rows.length + '</b>' + (rows.length !== FX.customers.length ? ' / ' + FX.customers.length : '') + ' харилцагч' + (sec ? ' · <span class="cu-tnow">нэмэлт шүүлт ' + sec + '</span>' : '') +
        (hid > 0 ? ' <span class="cu-hid">(' + hid + ' нь нэмэлт шүүлтэд нуугдсан)</span>' : '');
      $('cu-sum').insertAdjacentHTML('beforeend', '<span>Харагдаж буй ' + rows.length + ': <b>' + rowsT12 + '</b></span>');
    } else $('cu-count').innerHTML = '<span class="cu-res-l">Шүүлтийн үр дүн</span> <b>' + rows.length + '</b> харилцагч · 12 сарын дүн <b>' + rowsT12 + '</b>' +
      (b.length !== FX.portfolio.n ? ' <span class="muted-s">(хүрээ ' + b.length + ' харилцагч)</span>' : '');
    $('cu-list').innerHTML = gs.map(function (g) {
      return (g.title ? '<h3 class="cu-gh"><span>' + g.title + ' <b class="num">' + g.rows.length + '</b></span><span>' + g.note + '</span></h3>' : '') +
        '<ul class="cu-list">' + g.rows.map(row).join('') + '</ul>';
    }).join('');
    $('cu-empty').hidden = rows.length > 0;
    if (state.t && b.length === FX.portfolio.n && state.f === 'all' && !state.q && !state.lf) emptyState('cu-empty', state.t === 'reply' ? 'Хариу өгөх ажилтай харилцагч алга.' : 'Одоо нээлттэй даалгавартай харилцагч алга.', 'Бүх харилцагчийг харах', 't');
    else emptyState('cu-empty', (state.q ? '«' + state.q + '» нэр, кодтой' : 'Сонгосон шүүлтэд тохирох') + ' харилцагч алга.', 'Хайлт, шүүлтийг цэвэрлэх', 'cu');
    $('cu-reset').hidden = TEAM ? !(state.q || state.t || sec || state.lf) :!(state.q || state.rec !== 'all' || state.aimag || state.type || state.sort || state.scope);
    if (!TEAM) sec = (state.rec !== 'all') + !!state.aimag + !!state.type;   // phone: secondary filters fold behind «Шүүлт»
    $('cu-more-n').textContent = sec; $('cu-more-n').hidden = !sec;
    if (TEAM) { $('cu-more').setAttribute('aria-label', 'Шүүлт' + (sec ? ', ' + sec + ' идэвхтэй' : '') + ': ангилал, бүртгэл, аймаг, төрөл, нийлбэр'); renderHead(); if (pop.f) renderPop(); }
    writeUrl();
  }

  // ---------- detail drawer (every customer) ----------
  var drawer = { opener: null, y: 0, code: null, k: 11 };
  // the drawer's 12 full months on one money scale (zero line shared by +/− bars), one calm colour (the inspected month stands out),
  // and the monthly average = Σ of exactly these 12 months ÷ 12 drawn at its true height on the same scale
  function sayMillion(v) { return (v < 0 ? MINUS : '') + (Math.abs(v) / 1e6).toFixed(2) + ' сая ₮'; }
  function chart(c) {
    var vals = c.m, maxP = Math.max.apply(null, vals.concat([0])), maxN = Math.max.apply(null, vals.map(function (v) { return -v; }).concat([0]));
    var span = maxP + maxN || 1, zero = maxN / span * 100;   // % from the bottom
    var avg = c.t12 / 12, avgAt = zero + avg / span * 100;    // the average's position on the same scale (% from the bottom)
    return '<section class="pd-sec rr-chart"><h3>12 сарын татан авалт <span>' + range(W.months) + '</span></h3>' +
      '<p class="rc-legend"><i class="lg-avg" aria-hidden="true"></i>Дундаж · <b class="num">' + sayMillion(avg) + '</b></p>' +
      '<div class="rc-bars" role="group" aria-label="12 сарын татан авалт, сарын дундаж ' + esc(money(avg)) + '" style="--zero:' + zero.toFixed(2) + '%">' +
      '<span class="rc-avg" aria-hidden="true"><i style="bottom:' + avgAt.toFixed(3) + '%"></i></span>' + vals.map(function (v, k) {
        var ym = W.months[k], mm = ym.slice(5), yr = k === 0 || mm === '01' ? ym.slice(0, 4) : '';
        return '<button type="button" class="rc' + (yr && k ? ' yr-start' : '') + '" data-k="' + k + '" aria-label="' + esc(ymDot(ym) + ': ' + money(v)) + '">' +
          '<span class="rc-plot"><span class="rc-bar' + (v < 0 ? ' neg' : '') + '" style="height:' + (Math.abs(v) / span * 100).toFixed(3) + '%"></span></span>' +
          '<span class="rc-m num">' + mm + '</span><span class="rc-y num">' + yr + '</span></button>';
      }).join('') + '</div>' +
      '<div class="mini-nav"><button type="button" class="icon-btn step" data-step="-1" aria-label="Өмнөх сар"><svg class="ic" aria-hidden="true"><use href="#i-left"/></svg></button>' +
      '<p class="mini-read num" aria-live="polite" id="rc-read"></p>' +
      '<button type="button" class="icon-btn step" data-step="1" aria-label="Дараагийн сар"><svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button></div>' +
      '<details class="rc-list"><summary>Сар бүрийн дүн</summary><ul>' + vals.map(function (v, k) {
        return '<li><span class="num">' + ymDot(W.months[k]) + '</span><span class="num">' + money(v) + '</span></li>';
      }).join('') + '</ul></details></section>';
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
    var c = byCode[code], ready = hasReport(code), lv = lastVisit(code, state.day), CUR = FX.current;
    drawer.code = code; drawer.opener = opener || document.activeElement; drawer.y = window.scrollY;
    $('dr-kind').innerHTML = '<span>Харилцагч</span>';
    $('dr-title').textContent = c.name;
    $('dr-sub').textContent = [c.code, c.aimag, c.type, c.record === 'old' ? 'Хуучин бүртгэл' : 'Одоогийн бүртгэл'].join(' · ');
    // exactly four cards (2×2): 12 months, monthly average, this month to the fixed report cutoff, last demo visit as of the route day
    var card = function (k, l, v, s) { return '<div class="rr-kpi" data-k="' + k + '"><dt>' + l + '</dt><dd class="num">' + v + '</dd>' + (s ? '<p>' + s + '</p>' : '') + '</div>'; };
    var curRange = CUR ? dDot(CUR.from) + '–' + CUR.to.slice(8) : '';
    $('dr-body').innerHTML =
      (ready ? '<a class="btn rr-cta" id="dr-report" href="' + esc(reportUrl(code)) + '"><svg class="ic" aria-hidden="true"><use href="#i-store"/></svg>Дэлгүүрийн цонх нээх</a>'
        : '<p class="rr-nocta">Бүрэн дэлгүүрийн тайлан энэ демод бэлэн биш.</p>') + (TEAM ? drawerTasks(c) : '') +
      '<section class="pd-sec"><dl class="rr-kpis">' +
        card('t12', '12 сарын дүн', money(c.t12), range(W.months)) +
        card('avg', 'Сарын дундаж', money(c.t12 / 12), 'Өмнөх 12 бүтэн сар') +
        card('cur', 'Энэ сарын гүйцэтгэл', typeof c.cur === 'number' ? money(c.cur) : '—', curRange) +
        card('visit', 'Сүүлд очсон', lv ? dDot(lv) : 'Очсон бүртгэлгүй', lv ? daysBetween(lv, state.day) + ' хоног · ' + dDot(state.day) + '-ны байдлаар' : 'Жишиг очилтын бүртгэл') +
      '</dl></section>' +
      chart(c);
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
  // team demo: an open drawer (the customer the rep was looking at) is reopened too
  function rememberReturn(code) {
    var open = TEAM && $('dr').open ? drawer.code : '';
    try { sessionStorage.setItem('rr-return', JSON.stringify({ q: query(), y: open ? drawer.y : window.scrollY, code: code, open: open })); } catch (e) { /* private mode: URL state still restores */ }
  }
  function restoreReturn() {
    var r = null;
    try { r = JSON.parse(sessionStorage.getItem('rr-return') || 'null'); sessionStorage.removeItem('rr-return'); } catch (e) { r = null; }
    if (!r || r.q !== query()) return;
    requestAnimationFrame(function () {
      window.scrollTo(0, r.y);
      var el = document.querySelector('#panel-' + state.tab + ' [data-code="' + r.code + '"]');
      if (el) el.focus({ preventScroll: true });
      if (TEAM && r.open && byCode[r.open]) openDetail(r.open, el);
    });
  }

  // ---------- events ----------
  function keepCaret(inp, fn) { var s = inp.selectionStart, e = inp.selectionEnd, y = window.scrollY; fn(); if (document.activeElement !== inp) inp.focus(); try { inp.setSelectionRange(s, e); } catch (x) { /* type=search */ } window.scrollTo(0, y); }
  function bind() {
    TABS.forEach(function (t) { $('tab-' + t).addEventListener('click', function () { selectTab(t); }); });
    $('tabs').addEventListener('keydown', function (e) {
      var k = TABS.indexOf(state.tab), n = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: TABS.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault(); selectTab(TABS[(n + TABS.length) % TABS.length], true);
    });
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
      if ($('cu-panel')) $('cu-panel').hidden = !open;   // team demo: the folded extras (choices stay when it closes)
      var st = $('cu-stick');   // a low screen: the open block scrolls with the page (CSS); bring its top into view
      if (st) { st.classList.toggle('more', open); if (open && LOW.matches && st.getBoundingClientRect().top < 0) window.scrollBy(0, st.getBoundingClientRect().top); }
    });
    $('cu-reset').addEventListener('click', function () {
      state.q = ''; state.rec = 'all'; state.aimag = ''; state.type = ''; state.scope = ''; state.t = ''; state.lf = '';
      if (TEAM) state.f = 'all'; else state.sort = '';   // team demo: search, task filter and extra filters; the sort stays
      renderCustomers(); $('cu-q').focus();
    });
    document.addEventListener('click', function (e) {
      var r = e.target.closest('.rt-row, .cu-row'); if (r) { openDetail(r.dataset.code, r); return; }
      var u = e.target.closest('[data-empty]'); if (u) { undoEmpty(u.dataset.empty); return; }
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
    state: function () { return JSON.parse(JSON.stringify(state)); }, query: query, team: TEAM ? REP : null,
    visible: function () { return groups().map(function (g) { return { title: g.title, codes: g.rows.map(function (c) { return c.code; }) }; }); },
    route: function () { var s = routeStops(); return s && s.map(function (x) { return { no: x.no, code: x.code, lastVisit: x.lv }; }); },
    lastVisit: lastVisit, visitGap: visitGap,
    openDetail: function (code) { openDetail(code, null); }
  };
  // ---------- boot: SR-073 as before; the team demo first loads the team store and its config (same origin as «Багийн хяналт») ----------
  function failed(title, text) { $('state-title').textContent = title; $('state-text').textContent = text || ''; $('state').hidden = false; app.setAttribute('aria-busy', 'false'); }
  function legacyLinks() {   // an unknown rep on SR-073's route: the two demo routes, nothing else
    $('state').insertAdjacentHTML('beforeend', '<ul class="rr-reps"><li><a class="btn-sec" data-ws-nav href="?demo=team&amp;rep=SR-D02">Даалгаврын демо · SR-D02</a></li>' +
      '<li><a class="btn-sec" data-ws-nav href="?rep=SR-073">SR-073-ийн маршрут</a></li></ul>');
    if (window.WS) window.WS.page({});
  }
  if (!TEAM) {
    var want = (P0.get('rep') || '').trim();   // SR-073's route: ?rep= may only name SR-073 (never another person's route)
    if (!FX || !FX.customers) failed('Мэдээлэл ачаалж чадсангүй');
    else if (want && want.toUpperCase() !== FX.rep.code) { failed('Маршрут олдсонгүй', '«' + want.slice(0, 24) + '» кодтой ХТ-ийн маршрут энэ демод алга. Өөр хүний мэдээлэл харуулахгүй.'); legacyLinks(); }
    else { setData(FX); init(); }
    return;
  }
  document.documentElement.classList.add('team-demo');
  var v = function (u) { return window.WS ? window.WS.asset(u) : u; };   // the package's content versions (deploy.js)
  var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = v('../team-control/assets/tasks.css'); document.head.appendChild(css);
  var FILES = ['../team-control/data/fixture.js', '../team-control/data/profiles.js', '../team-control/assets/core.js', 'data/team-demo.js'];
  (function next(k) {
    if (k < FILES.length) {
      var s = document.createElement('script'); s.src = v(FILES[k]);
      s.onload = function () { next(k + 1); };
      s.onerror = function () { failed('Багийн демо ачаалж чадсангүй', 'Хуудсыг дахин ачаална уу.'); };
      document.head.appendChild(s); return;
    }
    T = window.TeamCore;
    if (!FX || !FX.customers || !T) { failed('Мэдээлэл ачаалж чадсангүй'); return; }
    var fx = teamFixture();
    if (fx.fail) { repState(fx.fail[0], fx.fail[1]); return; }
    T.ready.then(function () { setData(fx); init(); T.onChange(refresh); });   // the task store (IndexedDB) is open: marks and counts are real
  })(0);
})();
