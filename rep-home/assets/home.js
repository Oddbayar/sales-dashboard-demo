/* «Миний ажил» home: the four windows of the demo. ?rep=<code> must be the demo rep (SR-073); any other code shows a
   not-found state and no links (never another person's pages). The route links carry this session's route state.
   Published package: the build line names the release (../rep-home/assets/deploy.js) and, once per release and session, a
   newer workspace.json reloads this page so a cached home never hides a new deployment. */
(function () {
  'use strict';
  var WS = window.WS, $ = function (id) { return document.getElementById(id); };
  if (!WS) return;   // the shared script failed: the plain relative links still work
  var raw = (new URLSearchParams(location.search).get('rep') || '').trim(), code = raw ? raw.toUpperCase() : WS.rep;
  if (code !== WS.rep) {
    $('links').hidden = true; $('foot').hidden = true; $('scen').hidden = true;
    $('rep-label').textContent = 'Демо ажлын цэс';
    $('state-title').textContent = 'Мэдээлэл олдсонгүй';
    $('state-text').textContent = '«' + (raw.length > 24 ? raw.slice(0, 24) + '…' : raw) + '» кодтой худалдааны төлөөлөгчийн ажлын цэс энэ демод байхгүй. Демо зөвхөн ' + WS.rep + ' кодтой.';
    $('state-link').href = '?rep=' + encodeURIComponent(WS.rep);
    $('state-link').textContent = WS.rep + '-ийн демо цэс';
    $('state').hidden = false;
  }
  var links = function () {
    Array.prototype.forEach.call(document.querySelectorAll('#app a[data-m]'), function (a) { a.href = WS.href(a.getAttribute('data-m')); });
    // «Миний маршрут» reopens the demo rep picked last this session: the card names that rep's code, not С.Сараа's
    var rep = new URL(WS.href('route')).searchParams.get('rep');
    $('route-who').textContent = rep === WS.teamRep ? 'ХТ · ' + WS.teamName + ' · ' + rep : 'ХТ · демо ХТ ' + rep + ' (сүүлд сонгосон)';
  };
  links();
  window.addEventListener('pageshow', links);   // back from a module (bfcache): pick up the newest session state
  var rel = WS.deploy.release;
  if (rel) $('build').textContent = 'Хувилбар ' + rel;
  WS.page({});

  // a cached copy of an older release: reload once from the network (a new query bypasses the HTTP cache; never a loop)
  if (rel && window.fetch) fetch(WS.base + 'workspace.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
    if (!m || !m.release || m.release === rel || !/^[0-9a-f]{6,16}$/.test(m.release)) return;
    var k = 'ws:release:' + m.release;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) { return; }
    var p = new URLSearchParams(location.search); p.set('r', m.release);
    location.replace(location.pathname + '?' + p + location.hash);
  }).catch(function () { /* offline: this copy stays */ });
})();
