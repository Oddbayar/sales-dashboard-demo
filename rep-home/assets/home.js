/* «Миний ажил» home: the three windows for the demo rep. ?rep=<code> must be the demo rep; any other code shows a
   not-found state and no links (never another person's pages). The route link carries this session's route state. */
(function () {
  'use strict';
  var WS = window.WS, $ = function (id) { return document.getElementById(id); };
  if (!WS) return;   // the shared script failed: the plain relative links still work
  var raw = (new URLSearchParams(location.search).get('rep') || '').trim(), code = raw ? raw.toUpperCase() : WS.rep;
  if (code !== WS.rep) {
    $('links').hidden = true;
    $('rep-label').textContent = 'Худалдааны төлөөлөгч';
    $('state-title').textContent = 'Мэдээлэл олдсонгүй';
    $('state-text').textContent = '«' + (raw.length > 24 ? raw.slice(0, 24) + '…' : raw) + '» кодтой худалдааны төлөөлөгчийн ажлын цэс энэ демод байхгүй. Демо зөвхөн ' + WS.rep + ' кодтой.';
    $('state-link').href = '?rep=' + encodeURIComponent(WS.rep);
    $('state-link').textContent = WS.rep + '-ийн демо цэс';
    $('state').hidden = false;
  }
  var links = function () { Array.prototype.forEach.call(document.querySelectorAll('#links a[data-m]'), function (a) { a.href = WS.href(a.getAttribute('data-m')); }); };
  links();
  window.addEventListener('pageshow', links);   // back from a module (bfcache): pick up the newest session state
  WS.page({});
})();
