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
  var state = { tab: 'route', day: '', rs: '', rq: '', f: TEAM ? 'all' : 'attention', rec: 'all', aimag: '', type: '', q: '', sort: '', scope: '', t: '' };
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
    if (TEAM && TFILTER.hasOwnProperty(v = p.get('t'))) state.t = v;
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
    if (TEAM) $('cu-head-chg').innerHTML = [W.recent, W.base].map(function (m) { return '<span class="yr">' + m[0].slice(0, 5).replace('-', '.') + '</span>' + m[0].slice(5) + '–' + m[m.length - 1].slice(5); }).join(' / ');   // the year folds on a tablet
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
      rep: { code: REP, label: r.name + ' · ' + REP + ' · Багийн демо · борлуулалт ' + dDot(FX.cutoff) + ' хүртэл' },
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
    var side = document.querySelector('.rr-side');
    side.insertAdjacentHTML('beforeend', '<label class="sort rr-rep"><span class="rr-rep-l">Демо ХТ</span><select id="demo-rep" aria-label="Демо ХТ сонгох (нэвтрэлт биш)">' +
      T.FX.reps.map(function (r) { return '<option value="' + esc(r.code) + '"' + (r.code === REP ? ' selected' : '') + '>' + esc(r.name) + ' · ' + esc(r.code) + '</option>'; }).join('') +
      '</select><svg class="ic chev" aria-hidden="true"><use href="#i-chev"/></svg></label>');
    var tabRow = document.createElement('div');   // the tablist keeps only its two tabs; the shortcut sits beside it
    tabRow.className = 'rr-tabrow'; $('tabs').before(tabRow); tabRow.append($('tabs'));
    tabRow.insertAdjacentHTML('beforeend', '<button type="button" class="btn-sec rr-tkgo" id="tk-go" hidden></button>');
    document.querySelector('.day-pick .lbl').textContent = 'Ажлын өдөр';
    $('day').setAttribute('aria-label', 'Демо ажлын өдөр');
    var h = document.querySelector('.rt-head');
    h.insertAdjacentHTML('beforeend', '<span>Даалгавар</span>');   // the column after the chevron's, above the task marks
    // customers (Claude 32): the list is the main content. Always in view: search · «Шүүлт» · sort, then Бүгд | Даалгавартай |
    // Хариу өгөх and the shown count. The analytic chips, record/aimag/type, route scope and portfolio totals fold into «Шүүлт».
    var tools = document.querySelector('.cu-tools');
    tools.insertAdjacentHTML('afterend', '<div class="cu-panel" id="cu-panel" hidden></div><div class="cu-tbar" id="cu-tbar">' +
      '<div class="seg cu-tchips" role="group" aria-label="Даалгавраар шүүх (харилцагчийн тоо)" id="cu-tchips"></div></div>');
    var panel = $('cu-panel');
    [$('cu-sum'), $('cu-chips')].concat([].slice.call(tools.querySelectorAll('.cu-sec')), [$('cu-scope')]).forEach(function (el) { panel.append(el); });
    $('cu-tbar').append($('cu-count'), $('cu-reset'));
    $('cu-more').setAttribute('aria-controls', 'cu-panel');
    $('cu-reset').title = 'Хайлт, даалгаврын шүүлт, нэмэлт шүүлтийг цэвэрлэнэ (эрэмбэ хэвээр)';
    $('demo-rep').addEventListener('change', function () {   // a fresh page for that rep (same webview, Telegram launch data kept)
      var u = '?demo=team&rep=' + encodeURIComponent(this.value);
      if (!(window.WS && window.WS.go(u))) location.assign(u);
    });
    $('tk-go').addEventListener('click', function () { taskFilter('reply', true); selectTab('customers'); $('cu-tchips').querySelector('[data-t="reply"]').focus(); });
    $('cu-tchips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return;
      taskFilter(b.dataset.t);
      var nb = $('cu-tchips').querySelector('[data-t="' + b.dataset.t + '"]'); if (nb) nb.focus();
    });
  }
  // «Хариу өгөх: N харилцагч» next to the route tab: every assigned customer with work to reply to, in or out of today's route.
  // On the customers tab the same number is the «Хариу өгөх» filter itself, so the shortcut is not repeated there.
  function renderTaskGo() {
    var n = FX.customers.filter(function (c) { return (tasksOf(c.code) || {}).todo; }).length, b = $('tk-go');
    b.hidden = !n || state.tab === 'customers';
    b.innerHTML = ic('reply') + 'Хариу өгөх: <b class="num">' + n + '</b> харилцагч';
    b.setAttribute('aria-label', 'Хариу өгөх ажилтай ' + n + ' харилцагч: бүх харилцагчаас харах');
  }
  // the route tab's shortcut opens every assigned customer (all: chip, scope, extra filters and search reset). Choosing in the
  // list keeps the folded extra filters; the count line then says how many customers with that work they hide.
  function taskFilter(t, all) {
    state.t = t;
    if (all) { state.f = 'all'; state.scope = ''; state.rec = 'all'; state.aimag = ''; state.type = ''; state.q = ''; }
    renderCustomers();
  }
  var extraOn = function () { return (state.f !== 'all') + (state.rec !== 'all') + !!state.aimag + !!state.type + !!state.scope; };   // team: what «Шүүлт» folds
  var tasksOf = function (code) { return TK && TK.get(code) || null; };
  var ic = function (id) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + id + '"/></svg>'; };
  function taskSay(t) {
    return [t.todo ? 'хариу өгөх ' + t.todo : '', t.back ? 'үүнээс буцаасан ' + t.back : '', t.review ? 'хянуулж байгаа ' + t.review : ''].filter(Boolean).join(', ');
  }
  // route row: one compact mark per customer with active work — «Даалгавар N» + the most urgent state; a separate link from the row
  function taskChip(c) {
    var t = tasksOf(c.code);
    if (!t || !t.active) return '<span class="rt-task-none" aria-hidden="true"></span>';
    var st = t.back ? ['back', 'undo', 'Буцаасан'] : t.todo ? ['need', 'reply', 'Хариу өгөх ' + t.todo] : ['rev', 'review', 'Хянуулж байна'];
    return '<a class="rt-task tk-' + st[0] + '" href="' + esc(reportUrl(c.code, t.list[0].id, true)) + '" data-report="' + esc(c.code) + '" aria-label="' +
      esc(c.name + ': даалгавар ' + t.active + ' (' + taskSay(t) + '). Дэлгүүрийн цонхны даалгавар руу') + '"><b>Даалгавар ' + t.active + '</b><span>' + ic(st[1]) + st[2] + '</span></a>';
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
    return '<section class="pd-sec rr-tasks" id="dr-tasks"><h3>Даалгавар <span>идэвхтэй ' + t.active + '</span></h3>' +
      (act.length ? '<ul class="rr-tk-list">' + act.map(function (a) {
        var s = TSTATE(a), task = T.S.tasks.get(a.task);
        return '<li><a class="rr-tk" href="' + esc(reportUrl(c.code, a.id, true)) + '" data-report="' + esc(c.code) + '"><span class="tk tk-' + s[0] + '">' + ic(s[1]) + s[2] + '</span>' +
          '<span class="rr-tk-t">' + esc(task.title) + '</span><span class="rr-tk-d num">Хугацаа ' + T.short(task.due) + '</span>' + ic('right') + '</a></li>';
      }).join('') + '</ul>' : '<p class="rr-tk-none">Идэвхтэй даалгавар алга.</p>') +
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
    if (none) {
      $('route-list').innerHTML = '';
      $('route-empty').hidden = false;
      $('route-empty').textContent = dDot(state.day) + '-нд жишиг маршрут тохируулаагүй. Тохируулсан өдөр: ' + days.map(dDot).join(', ') + '.';
      writeUrl();
      return;
    }
    var stops = routeStops();
    // team demo: + how many of this route's customers have work to reply to (customers, not tasks; none → nothing added)
    var need = TEAM ? d.stops.filter(function (k) { return (tasksOf(k) || {}).todo; }).length : 0;
    $('route-count').textContent = (state.rq ? stops.length + '/' + d.stops.length + ' дэлгүүр' : d.stops.length + ' дэлгүүр') + (need ? ' · хариу өгөх ' + need : '');
    $('route-count').setAttribute('aria-label', (state.rq ? d.stops.length + ' дэлгүүрээс ' + stops.length + ' нь харагдаж байна' : d.stops.length + ' дэлгүүр') +
      (need ? '; ' + need + ' харилцагч хариу өгөх ажилтай' : ''));
    $('rt-clear').hidden = !state.rq;
    $('route-empty').hidden = stops.length > 0;
    $('route-empty').textContent = '«' + state.rq + '» гэсэн дэлгүүр энэ маршрутад алга.';
    // one line name, one line code · type (aimag stays in the drawer); last visit = short date + days, or «Бүртгэлгүй»
    $('route-list').innerHTML = stops.map(function (s) {
      var c = byCode[s.code], gap = s.lv ? daysBetween(s.lv, state.day) : null;
      return '<li class="rt-item"><button type="button" class="rt-row" data-code="' + esc(c.code) + '" aria-haspopup="dialog" aria-label="' +
        esc('№' + s.no + ', ' + c.name + ', ' + c.code + ', ' + c.type + '. Сүүлд очсон: ' + (s.lv ? dDot(s.lv) + ', ' + gap + ' хоног' : 'бүртгэлгүй')) + '">' +
        '<span class="rt-no num" title="Хуваарьт дараалал">' + s.no + '</span>' +
        '<span class="rt-main"><b>' + esc(c.name) + '</b><span>' + esc(c.code + ' · ' + c.type) + '</span></span>' +
        '<span class="rt-visit num">' + (s.lv ? '<b>' + shortDate(s.lv) + '</b><span>' + gap + ' хоног</span>' : '<span class="muted-s">Бүртгэлгүй</span>') + '</span>' +
        '<svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button>' + (TEAM ? taskChip(c) : '') +
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
  function inTask(c, t) { var x = tasksOf(c.code); return !t || !!x && (t === 'reply' ? x.todo > 0 : x.active > 0); }   // team demo only
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
    var list = base().filter(function (c) { return inChip(c, state.f) && inTask(c, state.t) && (!q || norm(c.name + ' ' + c.code).indexOf(q) >= 0); });
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
      (TEAM ? '<span class="cu-name"><span class="cu-n1"><b>' + esc(c.name) + '</b>' + taskTags(c) + '</span><span class="cu-n2">' +
          esc([c.code, c.aimag, c.type].concat(c.flags.map(function (f) { return FLAG[f]; }), c.record === 'old' ? ['Хуучин бүртгэл'] : []).join(' · ')) + '</span></span>'
        : '<span class="cu-name"><span class="cu-n1"><b>' + esc(c.name) + '</b>' + badges(c) + '</span><span class="cu-n2">' + esc(c.code + ' · ' + c.aimag + ' · ' + c.type) + '</span></span>') +
      '<span class="cu-t12 num">' + money(c.t12) + '</span>' +
      '<span class="cu-chg num">' + chg + '</span>' +
      '<span class="cu-last num">' + last + '</span>' +
      '<span class="cu-spark">' + spark(c) + '</span></button></li>';
  }
  function ariaRow(c) {
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
      '<span>Анхаарах <b>' + FX.counts.attention + '</b></span>' + (all ? '<span>Идэвхтэй ажил <b>' + all.a + '</b> (хариу өгөх <b>' + all.r + '</b>)</span>' : '');
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
      var q0 = norm(state.q), hid = state.t && sec ? FX.customers.filter(function (c) { return inTask(c, state.t) && (!q0 || norm(c.name + ' ' + c.code).indexOf(q0) >= 0); }).length - rows.length : 0;
      $('cu-count').innerHTML = '<b>' + rows.length + '</b> харилцагч' + (sec ? ' · <span class="cu-tnow">нэмэлт шүүлт ' + sec + '</span>' : '') +
        (hid > 0 ? ' <span class="cu-hid">(' + hid + ' нь нэмэлт шүүлтэд нуугдсан)</span>' : '');
      $('cu-sum').insertAdjacentHTML('beforeend', '<span>Харагдаж буй ' + rows.length + ': <b>' + rowsT12 + '</b></span>');
    } else $('cu-count').innerHTML = '<span class="cu-res-l">Шүүлтийн үр дүн</span> <b>' + rows.length + '</b> харилцагч · 12 сарын дүн <b>' + rowsT12 + '</b>' +
      (b.length !== FX.portfolio.n ? ' <span class="muted-s">(хүрээ ' + b.length + ' харилцагч)</span>' : '');
    $('cu-list').innerHTML = gs.map(function (g) {
      return (g.title ? '<h3 class="cu-gh"><span>' + g.title + ' <b class="num">' + g.rows.length + '</b></span><span>' + g.note + '</span></h3>' : '') +
        '<ul class="cu-list">' + g.rows.map(row).join('') + '</ul>';
    }).join('');
    $('cu-empty').hidden = rows.length > 0;
    $('cu-empty').textContent = state.t && b.length === FX.portfolio.n && state.f === 'all' && !state.q ? (state.t === 'reply' ? 'Хариу өгөх ажилтай харилцагч алга.' : 'Идэвхтэй даалгавартай харилцагч алга.')
      : 'Тохирох харилцагч алга. Шүүлтээ цэвэрлэж үзнэ үү.';
    $('cu-reset').hidden = TEAM ? !(state.q || state.t || sec) : !(state.q || state.rec !== 'all' || state.aimag || state.type || state.sort || state.scope);
    if (!TEAM) sec = (state.rec !== 'all') + !!state.aimag + !!state.type;   // phone: secondary filters fold behind «Шүүлт»
    $('cu-more-n').textContent = sec; $('cu-more-n').hidden = !sec;
    if (TEAM) $('cu-more').setAttribute('aria-label', 'Шүүлт' + (sec ? ', ' + sec + ' идэвхтэй' : '') + ': ангилал, бүртгэл, аймаг, төрөл, нийлбэр');
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
        card('visit', 'Сүүлд очсон', lv ? dDot(lv) : 'Очсон бүртгэлгүй', lv ? daysBetween(lv, state.day) + ' хоног · ' + shortDate(state.day) + '-ны байдлаар' : 'Жишиг очилтын бүртгэл') +
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
    });
    $('cu-reset').addEventListener('click', function () {
      state.q = ''; state.rec = 'all'; state.aimag = ''; state.type = ''; state.scope = ''; state.t = '';
      if (TEAM) state.f = 'all'; else state.sort = '';   // team demo: search, task filter and extra filters; the sort stays
      renderCustomers(); $('cu-q').focus();
    });
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
