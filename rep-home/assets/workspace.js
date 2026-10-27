/* «Миний ажил» workspace glue, shared by the pages (rep-home, store-report, rep-route, rep-performance, team-control):
   - the compact «Цэс» menu: the home page plus the four windows, the active one marked;
   - same-window navigation that keeps Telegram's launch data (URL hash) on internal moves, same origin only;
   - per-session memory of where the user was in a module (e.g. the route's day and filters), keyed by module and
     re-validated before use (allowlisted keys, short plain values, fixed paths: never an outside URL);
   - the Telegram Mini App setup and ONE BackButton handler per page:
     open menu → the page's own step (drawer, return to route/lookup/team) → «Миний ажил». Hidden on the home page;
   - asset(): the published package's content versions for files a page loads at run time (../rep-home/assets/deploy.js,
     written only by scripts/package_workspace.mjs; absent in the source tree, where URLs stay as they are).
   «Миний маршрут» is the task demo route of one team demo rep (SR-D02 unless another demo rep was picked this session): a demo
   choice, not a login. SR-073's original route stays at rep-route/?rep=SR-073 (the «legacy» entry on the home page).
   Classic script. It works without the Telegram SDK (plain browser) and without storage (private mode). */
(function () {
  'use strict';
  var script = document.currentScript;
  var BASE = new URL('../../', script ? script.src : location.href).href;   // the folder holding rep-home/, store-report/, …
  var REP = 'SR-073';   // the demo's original representative (synthetic data); a default, not an identity or a permission
  var TEAM_REP = 'SR-D02', TEAM_NAME = 'С.Сараа';   // the task demo's default rep (ui/team-control/data/fixture.js)
  var DEP = window.WS_DEPLOY || {};   // package only: { route, release, v: { site path → sha256[:10] } }
  var MODULE = document.documentElement.getAttribute('data-ws-module') || '';
  if (MODULE === 'route' && new URLSearchParams(location.search).get('demo') !== 'team') MODULE = 'legacy';   // SR-073's own route
  var MOD = {
    home: { path: 'rep-home/', label: 'Миний ажил' },
    route: { path: 'rep-route/', label: 'Миний маршрут', sub: 'Даалгаврын демо', icon: 'route' },
    team: { path: 'team-control/', label: 'Багийн хяналт', sub: 'Supervisor', icon: 'team' },
    store: { path: 'store-report/', label: 'Дэлгүүрийн цонх', icon: 'store' },
    performance: { path: 'rep-performance/', label: 'Миний гүйцэтгэл', sub: REP, icon: 'perf' },
    legacy: { path: 'rep-route/' }
  };
  var ORDER = ['route', 'team', 'store', 'performance'];
  // remembered module state: only the module's own keys with short plain values (the store report's return rule)
  var KEEP = { route: ['rep', 'tab', 'day', 'rs', 'rq', 'f', 'rec', 'aimag', 'type', 'q', 'sort', 'scope', 't'],
    legacy: ['tab', 'day', 'rs', 'rq', 'f', 'rec', 'aimag', 'type', 'q', 'sort', 'scope'] };
  var ICON = {
    home: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    store: '<path d="M4 10l1.5-5h13L20 10M4 10h16M4 10v9h16v-9M9 19v-5h6v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
    route: '<path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a3 3 0 0 1 3-3h7M18 9v6a3 3 0 0 1-3 3H8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    team: '<path d="M9 4h6v3H9zM9 5.5H6.5v15h11v-15H15M9 13l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
    perf: '<path d="M5 20V12M10 20V6M15 20v-9M20 20V9M3 20h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
  };
  var svg = function (name, cls) { return '<svg class="' + (cls || 'ws-ic') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON[name] + '</svg>'; };

  // ---------- storage (best effort) ----------
  function load(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function save(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode: defaults are used */ } }
  function clean(module, search) {
    var src = new URLSearchParams(String(search || '').replace(/^\?/, '')), out = new URLSearchParams();
    (KEEP[module] || []).forEach(function (k) { var v = src.get(k); if (v && v.length <= 60 && !/[<>:/\\]/.test(v)) out.set(k, v); });
    if (module === 'route' && !/^SR-D\d{2}$/.test(out.get('rep') || '')) out.delete('rep');   // a team demo rep code or nothing
    return out.toString();
  }
  // the task route has its own key; SR-073's route keeps the key it always had (…:route)
  function key(module) { return 'ws:' + REP + ':' + (module === 'route' ? 'task-route' : module === 'legacy' ? 'route' : module); }
  function remember(module, search) { if (KEEP[module]) save(key(module), clean(module, search)); }

  // ---------- URLs and navigation ----------
  function href(module) {
    var m = MOD[module];
    if (!m) return BASE + MOD.home.path;
    if (module === 'home' || module === 'performance') return BASE + m.path + '?rep=' + encodeURIComponent(REP);
    if (module === 'store') return BASE + m.path + '?view=lookup';
    if (module === 'team') return BASE + m.path;
    var q = new URLSearchParams(clean(module, load(key(module))));
    if (module === 'legacy') return BASE + m.path + '?rep=' + encodeURIComponent(REP) + (q.toString() ? '&' + q : '');
    var rep = q.get('rep') || TEAM_REP; q.delete('rep');   // route: always the task demo, for the demo rep picked last (or SR-D02)
    return BASE + m.path + '?demo=team&rep=' + encodeURIComponent(rep) + (q.toString() ? '&' + q : '');
  }
  // a file this page loads at run time, with the package's content version (?v=) when deploy.js lists it; the URL as given
  // otherwise (source tree, or a file outside the workspace)
  function asset(url) {
    var u, h;
    try { u = new URL(url, location.href); } catch (e) { return url; }
    if (u.origin !== location.origin || u.href.indexOf(BASE) !== 0 || u.search) return url;
    h = DEP.v && DEP.v[u.pathname.slice(new URL(BASE).pathname.length)];
    return h ? url + '?v=' + h : url;
  }
  // Telegram's launch data lives in the hash; it stays on internal moves and is never put into a query or sent anywhere
  function launchHash() { return /(^#|&)tgWebApp/.test(location.hash) ? location.hash : ''; }
  function go(url, replace) {
    var u;
    try { u = new URL(url, location.href); } catch (e) { return false; }
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return false;   // internal pages only
    u.hash = '';
    location[replace ? 'replace' : 'assign'](u.href + launchHash());
    return true;
  }
  document.addEventListener('click', function (e) {   // links marked data-ws-nav move inside the same Mini App webview
    var a = e.target.closest && e.target.closest('a[data-ws-nav]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (go(a.href)) e.preventDefault();
  });

  // ---------- «Цэс» menu ----------
  var menus = [];
  function closeMenus(focusBack) {
    var any = false;
    menus.forEach(function (m) {
      if (m.pop.hidden) return;
      any = true; m.pop.hidden = true; m.btn.setAttribute('aria-expanded', 'false');
      if (focusBack) m.btn.focus();
    });
    return any;
  }
  function mount(slot, k) {
    var id = 'ws-pop-' + k;
    slot.classList.add('ws-slot');
    slot.innerHTML = '<button type="button" class="ws-menu-btn" aria-expanded="false" aria-controls="' + id + '">' + svg('home') + '<span>Цэс</span></button>' +
      '<nav class="ws-pop" id="' + id + '" aria-label="Миний ажил" hidden><a class="ws-home" data-m="home">' + svg('home') + '<span>Миний ажил</span></a>' +
      '<ul>' + ORDER.map(function (m) {
        return '<li><a class="ws-item" data-m="' + m + '">' + svg(MOD[m].icon) + '<span class="ws-t"><b>' + MOD[m].label + '</b>' +
          (m === MODULE ? '<small>Одоо нээлттэй</small>' : MOD[m].sub ? '<small class="ws-sub">' + MOD[m].sub + '</small>' : '') + '</span></a></li>';
      }).join('') + '</ul></nav>';
    var btn = slot.querySelector('.ws-menu-btn'), pop = slot.querySelector('.ws-pop');
    pop.querySelectorAll('a[data-m]').forEach(function (a) {
      var m = a.getAttribute('data-m');
      if (m === MODULE) { a.setAttribute('aria-current', 'page'); a.classList.add('is-active'); }
      a.addEventListener('click', function (e) {
        if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); closeMenus(); go(href(m));
      });
    });
    btn.addEventListener('click', function () {
      var open = pop.hidden;
      closeMenus();
      if (!open) return;
      pop.querySelectorAll('a[data-m]').forEach(function (a) { a.href = href(a.getAttribute('data-m')); });   // fresh session state
      pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
      syncBack();
    });
    menus.push({ btn: btn, pop: pop });
  }
  function mountAll() { Array.prototype.forEach.call(document.querySelectorAll('[data-ws-menu]'), mount); }
  document.addEventListener('pointerdown', function (e) {
    if (menus.some(function (m) { return !m.pop.hidden; }) && !(e.target.closest && e.target.closest('.ws-slot'))) { closeMenus(); syncBack(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menus.some(function (m) { return !m.pop.hidden; })) { e.preventDefault(); closeMenus(true); syncBack(); }
  });

  // ---------- Telegram Mini App (only inside a Telegram client) ----------
  var tg = null, hooks = { back: null };
  function tgInit() {
    var w = window.Telegram && window.Telegram.WebApp;
    if (tg || !w || (!w.initData && w.platform === 'unknown')) return tg;
    tg = w;
    var at = function (v) { return !!(w.isVersionAtLeast && w.isVersionAtLeast(v)); };
    try {
      w.ready();
      if (w.expand) w.expand();
      if (at('6.1')) { w.setHeaderColor('#F6F7F9'); w.setBackgroundColor('#F6F7F9'); }   // the product's light design, readable in any chat theme
      if (at('7.7') && w.disableVerticalSwipes) w.disableVerticalSwipes();              // drawer and list scrolling never collapse the app
      if (at('6.1') && w.BackButton) w.BackButton.onClick(onBack);                     // once per page load
    } catch (e) { /* an older client: the page still works */ }
    document.documentElement.classList.add('tg');
    syncBack();
    return tg;
  }
  function onBack() {
    if (closeMenus()) { syncBack(); return; }
    if (hooks.back && hooks.back()) { syncBack(); return; }   // the page took one step (drawer, return to route / code entry)
    if (MODULE !== 'home') go(href('home'));
  }
  // the home page is the top: Back hidden there (the client's own close leaves the app); everywhere else Back leads up
  function syncBack() {
    if (!tg || !tg.BackButton) return;
    if (MODULE === 'home') tg.BackButton.hide(); else tg.BackButton.show();
  }
  function page(opts) { hooks.back = (opts && opts.back) || null; tgInit(); syncBack(); }

  window.WS = { base: BASE, rep: REP, teamRep: TEAM_REP, teamName: TEAM_NAME, deploy: DEP, module: MODULE, href: href, go: go, asset: asset, launchHash: launchHash,
    remember: remember, clean: clean, page: page, tgInit: tgInit, syncBack: syncBack,
    closeMenus: closeMenus, menuOpen: function () { return menus.some(function (m) { return !m.pop.hidden; }); }, isTelegram: function () { return !!tg; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mountAll(); tgInit(); });
  else { mountAll(); tgInit(); }
})();
