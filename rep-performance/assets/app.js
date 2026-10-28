/* «Миний гүйцэтгэл» — one rep's monthly plan vs actual in money and packs: the current (cutoff) month, the 12 full months
   before it (a year chart of attainment % or a two-metric list), and a right drawer with the in-month cumulative / daily
   progress. Reads only window.REP_PERFORMANCE_FIXTURE. URL: ?rep=SR-073&month=2026-09 (a demo selector, not authorization). */
(() => {
  'use strict';
  const FX = window.REP_PERFORMANCE_FIXTURE;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const trunc = s => (s.length > 24 ? s.slice(0, 24) + '…' : s);
  const WD = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
  const WD_S = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];

  // ---- numbers: from the exact integers only (never from rounded text); U+2212 minus
  const grp = n => Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const neg = n => (n < 0 ? '−' : '');
  const exact = (n, m) => (n == null ? '—' : `${neg(n)}${grp(n)} ${m.unit}`);
  const brief = (n, m) => (m.short_div > 1 ? `${neg(n)}${(Math.abs(n) / m.short_div).toFixed(1)}` : `${neg(n)}${grp(n)}`);
  const validPlan = p => Number.isFinite(p) && p > 0;
  // % floored to 0.1 so 99.96% never reads as 100.0%; >100% is shown in full
  const pctOf = (a, p) => (a == null || !validPlan(p) ? null : Math.floor((a * 1000) / p) / 10);
  const pctText = x => `${neg(x)}${Math.abs(x).toFixed(1)}%`;

  // ---- dates
  const ymDot = ym => ym.replace('-', '.');
  const monthLong = ym => `${+ym.slice(0, 4)} оны ${+ym.slice(5)}-р сар`;
  const wdOf = (ym, d) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5) - 1, d)).getUTCDay();
  const dayLong = (ym, d) => `${ymDot(ym)}.${String(d).padStart(2, '0')} · ${WD[wdOf(ym, d)]}`;   // one date format: 2026.10.05
  const d2 = d => String(d).padStart(2, '0');
  const span = mo => `${ymDot(mo.ym)}.${d2(mo.first)}–${d2(mo.through)}`;   // a range: 2026.10.01–22

  let rep, months, byYm, metrics, newestFirst = true;
  // page: year-chart metric + chart/list view; drawer (S): its own metric/view, so switching inside it never changes the page
  const P = { metric: null, view: 'chart' };
  const S = { ym: null, metric: null, view: 'cum', day: null };
  const dr = $('dr');
  const metricOf = k => metrics.find(m => m.key === k);
  const defaultDay = mo => mo.through ?? 1;

  function showState(title, text, link) {
    $('app').setAttribute('aria-busy', 'false');
    for (const id of ['head', 'cur', 'hist']) $(id).hidden = true;
    $('state-title').textContent = title;
    $('state-text').textContent = text;
    const a = $('state-link');
    if (link) { a.href = link.href; a.textContent = link.text; a.hidden = false; }
    $('state').hidden = false;
    document.title = `${title} · Миний гүйцэтгэл`;
  }

  function init() {
    if (!FX || !FX.reps || !Array.isArray(FX.metrics)) return showState('Мэдээлэл ачаалагдсангүй', 'Гүйцэтгэлийн өгөгдөл (data/fixture.js) олдсонгүй.');
    const q = new URLSearchParams(location.search);
    const def = Object.keys(FX.reps)[0];
    const raw = (q.get('rep') ?? '').trim();
    const code = raw ? raw.toUpperCase() : def;
    if (!Object.hasOwn(FX.reps, code)) {
      return showState('Мэдээлэл олдсонгүй', `«${trunc(raw)}» кодтой худалдааны төлөөлөгчийн гүйцэтгэл энэ демод байхгүй. Демо зөвхөн ${Object.keys(FX.reps).join(', ')} кодын мэдээлэлтэй.`,
        { href: `?rep=${encodeURIComponent(def)}`, text: `${def}-ийн демо гүйцэтгэл` });
    }
    rep = FX.reps[code];
    months = rep.months;
    byYm = new Map(months.map(m => [m.ym, m]));
    metrics = FX.metrics;
    P.metric = S.metric = metrics[0].key;

    $('rep-label').textContent = `ХТ · ${rep.code}`;
    $('asof').textContent = `${FX.cutoff.replace(/-/g, '.')}-ны байдлаар`;
    $('plan-tag').textContent = FX.plan.label;
    $('plan-note').textContent = FX.plan.note_mn;
    renderCurrent();
    $('m-sel').innerHTML = months.map(mo => `<option value="${mo.ym}">${ymDot(mo.ym)}${mo.current ? ' · явж буй' : ''}</option>`).join('');
    yScale = yearScale(months.filter(m => !m.current));   // shared by the chart and the list bars
    renderList();
    renderYear();
    setHistView('chart');
    $('head').hidden = false;
    $('app').setAttribute('aria-busy', 'false');
    const ys = $('y-scroll');
    ys.scrollLeft = ys.scrollWidth;   // phone: the chart scrolls inside itself; start on the latest months
    fades();

    const mq = q.get('month');
    if (mq != null) {
      if (byYm.has(mq)) openMonth(mq);
      else {
        $('notice').textContent = `«${trunc(mq)}» сар энэ тайланд байхгүй. ${ymDot(months[0].ym)}–${ymDot(months.at(-1).ym)} сарын мэдээлэл бэлэн.`;
        $('notice').hidden = false;
        syncUrl();
      }
    }
  }

  // ---- one metric's facts, used by the current cards and the drawer summary
  function facts(m, mo, card) {
    const a = mo.actual[m.key], p = mo.plan[m.key], x = pctOf(a, p), done = x != null && a >= p;
    // a past month whose data covers only some days (coverage starts/ends inside it): the actual names its days, the plan is the month's
    const part = !mo.current && mo.through != null && (mo.first > 1 || mo.through < mo.days_in_month);
    const rows = [[part ? `Гүйцэтгэл · ${mo.first}–${mo.through}` : 'Гүйцэтгэл', a == null ? 'Мэдээлэлгүй' : exact(a, m)]];
    if (!validPlan(p)) rows.push(['Төлөвлөгөө', 'байхгүй']);
    else {
      rows.push([!part ? 'Төлөвлөгөө' : card ? `Сарын төлөвлөгөө · 1–${mo.days_in_month}` : 'Сарын төлөвлөгөө', exact(p, m)]);
      if (a != null) rows.push(a > p ? ['Давсан', `+${exact(a - p, m)}`] : ['Үлдсэн', exact(p - a, m)]);   // remaining = max(plan − actual, 0)
    }
    const okText = mo.current ? 'Одоогоор биелсэн' : 'Биелсэн';
    const note = a == null ? 'Мэдээлэлгүй' : x == null ? 'Төлөвлөгөө байхгүй' : null;
    const info = card && m.info_mn ? `<details class="rp-info rp-left"><summary aria-label="${esc(m.label)} гэж юу вэ"><svg class="ic" aria-hidden="true"><use href="#i-info"/></svg></summary><div class="rp-pop">${esc(m.info_mn)}</div></details>` : '';
    return `<article class="${card ? 'rp-mcard' : 'rp-dblk'}${done ? ' is-done' : ''}${!card && m.key === S.metric ? ' is-active' : ''}" data-k="${m.key}">
      <div class="rp-mh"><h3>${esc(m.label)}</h3>${info}</div>
      <div class="rp-mmain">
        <p class="rp-pct"><b class="num">${x == null ? '—' : pctText(x)}</b><span>${note ?? (done ? `<span class="rp-ok"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>${okText}</span>` : 'биелэлт')}</span></p>
        <dl class="rp-kv">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="num">${esc(v)}</dd></div>`).join('')}</dl>
      </div>
      ${x == null ? '' : `<span class="rp-track" aria-hidden="true"><i style="width:${clamp(x, 0, 100)}%"></i></span>`}
    </article>`;
  }

  function renderCurrent() {
    const cur = months.find(m => m.current);
    if (!cur) return;
    $('cur-h').textContent = cur.through == null ? `${ymDot(cur.ym)} · мэдээлэлгүй` : span(cur);
    $('cur-span').textContent = `Төлөвлөгөө бүтэн сарынх · ${ymDot(cur.ym)}.01–${cur.days_in_month}`;   // actual 1–22 vs the whole month's plan, said once
    $('cur-open').dataset.ym = cur.ym;
    $('cur-cards').innerHTML = metrics.map(m => facts(m, cur, true)).join('');
    $('cur').hidden = false;
  }

  function cell(m, mo) {
    const a = mo.actual[m.key], p = mo.plan[m.key], x = pctOf(a, p), done = x != null && a >= p;
    const ap = a == null ? 'Мэдээлэлгүй' : x == null ? `${brief(a, m)} ${m.short_unit} · төлөвлөгөөгүй` : `${brief(a, m)} / ${brief(p, m)} ${m.short_unit}`;
    // the bar uses the year chart's scale (0 … top %), not a 100% cap; a tick marks 100%
    const fill = x == null ? '' : `<i style="width:${clamp((ratioOf(mo, m) / yScale.hi) * 100, 0, 100)}%"></i><b class="rp-t100" style="left:${(100 / yScale.hi) * 100}%"></b>`;
    return `<span class="rp-cell${done ? ' is-done' : ''}">
      <span class="rp-cl">${esc(m.short)}</span>
      <b class="rp-cp num">${x == null ? '—' : `${done ? '<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' : ''}${pctText(x)}`}</b>
      <span class="rp-track sm${x == null ? ' is-none' : ''}" aria-hidden="true">${fill}</span>
      <span class="rp-ca num">${esc(ap)}</span>
    </span>`;
  }

  function renderList() {
    const full = months.filter(m => !m.current);
    if (!full.length) return;
    $('hist-h').textContent = `${ymDot(full[0].ym)}–${ymDot(full.at(-1).ym)}`;
    metrics.slice(0, 2).forEach((m, i) => { $(`lh-${i}`).textContent = m.label; });
    const rows = newestFirst ? [...full].reverse() : full;
    $('list').innerHTML = rows.map(mo => `<li><button type="button" class="rp-row${mo.ym === S.ym ? ' is-open' : ''}" data-ym="${mo.ym}"${mo.ym === S.ym ? ' aria-current="true"' : ''}>
      <span class="rp-rm"><b class="num">${ymDot(mo.ym)}</b><span class="sr-only">${monthLong(mo.ym)}</span></span>
      ${metrics.slice(0, 2).map(m => cell(m, mo)).join('')}
      <svg class="ic rp-go" aria-hidden="true"><use href="#i-right"/></svg></button></li>`).join('');
    $('sort-l').textContent = newestFirst ? 'Шинэ нь эхэндээ' : 'Хуучин нь эхэндээ';
    $('sort').setAttribute('aria-label', `Эрэмбэ: ${newestFirst ? 'шинэ сар эхэндээ' : 'хуучин сар эхэндээ'}. Солих`);
    $('hist').hidden = false;
  }

  // ---- year chart: one column per full month, oldest → newest, height = exact actual/plan × 100 (never capped).
  // The % scale is shared by both metrics (all valid ratios + 100 + 0), so switching metric never re-scales the axis.
  const ratioOf = (mo, m) => { const a = mo.actual[m.key], p = mo.plan[m.key]; return a == null || !validPlan(p) ? null : (a / p) * 100; };
  let yScale = null;
  function yearScale(full) {
    const rs = full.flatMap(mo => metrics.map(m => ratioOf(mo, m))).filter(r => r != null);
    const step = nice((Math.max(100, ...rs) - Math.min(0, ...rs)) / 4);
    const lo = Math.floor(Math.min(0, ...rs) / step) * step, hi = Math.ceil(Math.max(100, ...rs) / (step / 2)) * (step / 2);
    const ticks = [];
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { lo, hi, ticks };
  }

  function renderYear() {
    const full = months.filter(m => !m.current), m = metricOf(P.metric);
    if (!full.length) return;
    const { lo, hi, ticks } = yScale ??= yearScale(full);
    const pos = v => ((v - lo) / (hi - lo)) * 100;   // % from the plot bottom
    const z = pos(0);
    const plotPx = $('y-axis').clientHeight || 170;
    const free = v => v === 0 || (v !== 100 && (Math.abs(v - 100) / (hi - lo)) * plotPx >= 16);   // 0 always; others clear of the 100% label
    $('y-axis').innerHTML = ticks.filter(free).map(v => `<span style="bottom:${pos(v)}%">${neg(v)}${Math.abs(v)}%</span>`).join('')
      + `<span class="is-100" style="bottom:${pos(100)}%">100%</span>`;
    $('y-grid').innerHTML = ticks.map(v => `<i class="${v === 0 ? 'z' : ''}" style="bottom:${pos(v)}%"></i>`).join('') + `<i class="p100" style="bottom:${pos(100)}%"></i>`;
    const check = '<svg class="ic rp-ok" aria-hidden="true"><use href="#i-check"/></svg>';
    $('y-cols').setAttribute('aria-label', `12 сарын биелэлт · ${m.label}`);
    $('y-cols').innerHTML = full.map((mo, i) => {
      const a = mo.actual[m.key], p = mo.plan[m.key], r = ratioOf(mo, m), x = pctOf(a, p), done = r != null && a >= p;
      const st = a == null ? 'na' : r == null ? 'noplan' : done ? 'done' : 'under';
      const bar = r == null ? `<span class="rp-nobar"><span>${a == null ? 'Мэдээлэлгүй' : 'Төлөвлөгөөгүй'}</span></span>`
        : r >= 0 ? `<span class="rp-bar" style="bottom:${z}%;height:${pos(r) - z}%">${done ? check : ''}</span>`
          : `<span class="rp-bar neg" style="top:${100 - z}%;height:${z - pos(r)}%"></span>`;
      const aria = `${ymDot(mo.ym)} · ${m.label}: ${r == null ? '' : `${pctText(x)} биелэлт, `}${a == null ? '' : `гүйцэтгэл ${exact(a, m)}`}`
        + `${validPlan(p) ? `, төлөвлөгөө ${exact(p, m)}` : ''} · ${{ na: 'мэдээлэлгүй', noplan: 'төлөвлөгөөгүй', done: 'биелсэн', under: 'биелээгүй' }[st]}. Өдөр тутмын явцыг нээх`;
      const yrStart = i > 0 && mo.ym.slice(0, 4) !== full[i - 1].ym.slice(0, 4);
      return `<li${yrStart ? ' class="yr-start"' : ''}><button type="button" class="rp-col is-${st}${mo.ym === S.ym ? ' is-open' : ''}" data-ym="${mo.ym}" aria-label="${esc(aria)}"${mo.ym === S.ym ? ' aria-current="true"' : ''}>
        <span class="rp-cv num">${r == null ? '—' : `${neg(x)}${Math.abs(x).toFixed(1)}`}</span>
        <span class="rp-cplot">${bar}</span>
        <span class="rp-cm num">${mo.ym.slice(5)}</span></button></li>`;
    }).join('');
    const years = [];
    for (const mo of full) { const y = mo.ym.slice(0, 4); if (years.at(-1)?.y === y) years.at(-1).n++; else years.push({ y, n: 1 }); }
    $('y-years').innerHTML = years.map((g, k) => `<span style="grid-column:span ${g.n}"${k ? ' class="yr-start"' : ''}><b>${g.y}</b></span>`).join('');
    $('y-metric').innerHTML = metrics.map(x => `<button type="button" data-ymetric="${x.key}" aria-pressed="${x.key === P.metric}">${esc(x.label)}</button>`).join('');
    fades();   // new year labels: whole or hidden at the current scroll
  }

  function setHistView(v) {
    P.view = v;
    $('h-chart').hidden = v !== 'chart';
    $('h-list').hidden = v !== 'list';
    $('y-metric').hidden = v !== 'chart';   // the list shows both metrics
    $('sort').hidden = v !== 'list';        // newest/oldest applies to the list only; the chart stays chronological
    $('h-view').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hv === v)));
  }

  // phone: edge fades show there are more months to scroll to; a year label shows whole or not at all (never «…5»)
  function fades() {
    const ys = $('y-scroll'), more = ys.scrollWidth - ys.clientWidth, s = ys.getBoundingClientRect();
    $('yc').classList.toggle('fade-l', more > 2 && ys.scrollLeft > 2);
    $('yc').classList.toggle('fade-r', more > 2 && ys.scrollLeft < more - 2);
    for (const b of $('y-years').querySelectorAll('b')) {
      const r = b.parentElement.getBoundingClientRect();
      b.style.visibility = Math.min(r.right, s.right) - Math.max(r.left, s.left) >= b.offsetWidth ? '' : 'hidden';
    }
    // a value or month label half out of view would read as another number («2.9» of 82.9): shown whole or not at all
    const g = document.createRange();
    for (const t of $('y-cols').querySelectorAll('.rp-cv, .rp-cm')) {
      g.selectNodeContents(t); const r = g.getBoundingClientRect();
      t.style.visibility = r.width && (r.left < s.left || r.right > s.right) ? 'hidden' : '';
    }
  }

  // ---- drawer
  function openMonth(ym) {
    const fresh = !dr.open;
    S.ym = ym;
    // a fresh open starts on the page's chosen metric; later drawer switches stay inside the drawer
    if (fresh) { S.day = defaultDay(byYm.get(ym)); S.metric = P.metric; dr.showModal(); document.documentElement.classList.add('rp-modal'); }
    renderDrawer();   // after showModal, so the chart measures its real width
    markOpen();
    syncUrl();
  }

  function markOpen() {
    document.querySelectorAll('.rp-row, .rp-col').forEach(b => {   // list rows and chart columns; the current month has neither
      const on = b.dataset.ym === S.ym;
      b.classList.toggle('is-open', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }

  function syncUrl() {
    const q = new URLSearchParams();
    q.set('rep', rep.code);
    if (S.ym) q.set('month', S.ym);
    history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`);   // the hash may carry Telegram's launch data
  }

  function renderDrawer() {
    const mo = byYm.get(S.ym), L = mo.days_in_month, i = months.indexOf(mo);
    S.day = clamp(S.day ?? defaultDay(mo), 1, L);   // a 31-day month's 31st becomes the 30th/28th/29th
    $('dr-title').textContent = monthLong(mo.ym);
    $('dr-sub').textContent = mo.current
      ? `Явж буй сар · ${mo.through == null ? 'мэдээлэлгүй' : span(mo)} · төлөвлөгөө бүтэн сарынх (${L} хоног)`
      : `Бүтэн сар · ${L} хоног`;
    const prev = months[i - 1], next = months[i + 1];
    $('m-sel').value = mo.ym;
    $('m-prev').disabled = !prev; $('m-next').disabled = !next;
    $('m-prev').setAttribute('aria-label', prev ? `Өмнөх сар: ${ymDot(prev.ym)}` : 'Өмнөх сар байхгүй');
    $('m-next').setAttribute('aria-label', next ? `Дараагийн сар: ${ymDot(next.ym)}` : 'Дараагийн сар байхгүй');
    $('dsum').innerHTML = metrics.map(m => facts(m, mo, false)).join('');
    $('seg-metric').innerHTML = metrics.map(m => `<button type="button" data-metric="${m.key}" aria-pressed="${m.key === S.metric}">${esc(m.label)}</button>`).join('');
    $('seg-view').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
    metrics.slice(0, 2).forEach((m, k) => { $(`th-${k}`).textContent = `${m.short}, ${m.unit}`; });
    renderDay();
  }

  // chart + readout + day list for the inspected day (cheap enough to redraw on every step)
  function renderDay() {
    const mo = byYm.get(S.ym);
    S.day = clamp(S.day, 1, mo.days_in_month);
    $('dsum').querySelectorAll('.rp-dblk').forEach(b => b.classList.toggle('is-active', b.dataset.k === S.metric));
    renderChart(mo);
    renderReadout(mo);
    renderDays(mo);
    $('d-prev').disabled = S.day <= 1;
    $('d-next').disabled = S.day >= mo.days_in_month;
  }

  const cumOf = vals => { let run = 0; return vals.map(v => (v == null ? null : (run += v))); };
  const nice = x => { const p = 10 ** Math.floor(Math.log10(x)), f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  let geom = null;

  function renderChart(mo) {
    const m = metricOf(S.metric), L = mo.days_in_month, vals = mo.daily[m.key], cum = cumOf(vals), plan = mo.plan[m.key], hasPlan = validPlan(plan);
    const isCum = S.view === 'cum', series = isCum ? cum : vals;
    const ref = !hasPlan ? null : isCum ? d => (plan * d) / L : () => plan / L;   // even calendar-day spread of the monthly plan
    const box = $('chart'), W = Math.max(280, box.clientWidth || 520), H = innerHeight < 560 ? 168 : W < 480 || innerHeight < 700 ? 196 : 228;
    const pad = { l: 46, r: 10, t: 22, b: 26 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b, slot = pw / L;
    geom = { pad, slot, L };
    const X = d => pad.l + (d - 0.5) * slot;
    const nums = series.filter(v => v != null);
    let lo = Math.min(0, ...nums), hi = Math.max(0, ...nums, ...(ref ? [isCum ? plan : plan / L] : []));
    if (hi === lo) hi = lo + 1;
    const step = nice((hi - lo) / 4);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const Y = v => pad.t + ((hi - v) / (hi - lo)) * ph;
    const tick = v => (m.short_div > 1 ? `${neg(v)}${+(Math.abs(v) / m.short_div).toFixed(1)}` : `${neg(v)}${grp(v)}`);
    const o = [`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false">
      <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#F8FAFC"/><line x1="0" y1="0" x2="0" y2="6" stroke="#DDE2EA" stroke-width="2"/></pattern></defs>`];
    for (let v = lo; v <= hi + step / 2; v += step) {
      o.push(`<line class="${Math.abs(v) < step / 1e6 ? 'z' : 'g'}" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="yt" x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end">${tick(Math.abs(v) < step / 1e6 ? 0 : v)}</text>`);
    }
    o.push(`<text class="yu" x="${pad.l - 6}" y="${pad.t - 9}" text-anchor="end">${esc(m.short_unit)}</text>`);
    // days without data (before coverage / after the cutoff): hatched, never drawn as 0
    const gaps = [];
    if (mo.through == null) gaps.push([1, L]);
    else { if (mo.first > 1) gaps.push([1, mo.first - 1]); if (mo.through < L) gaps.push([mo.through + 1, L]); }
    for (const [a, b] of gaps) {
      const x0 = pad.l + (a - 1) * slot, w = (b - a + 1) * slot;
      o.push(`<rect class="na" x="${x0}" y="${pad.t}" width="${w}" height="${ph}"/>`);
      if (w > 76) o.push(`<text class="na-t" x="${x0 + w / 2}" y="${pad.t + 16}" text-anchor="middle">Мэдээлэлгүй</text>`);
    }
    o.push(`<line class="guide" x1="${X(S.day)}" x2="${X(S.day)}" y1="${pad.t}" y2="${pad.t + ph}"/>`);
    if (isCum) {
      if (ref) o.push(`<polyline class="plan" points="${Array.from({ length: L }, (_, k) => `${X(k + 1)},${Y(ref(k + 1))}`).join(' ')}"/>`);
      let seg = [];
      const segs = [];
      cum.forEach((v, k) => { if (v == null) { if (seg.length) segs.push(seg); seg = []; } else seg.push(`${X(k + 1)},${Y(v)}`); });
      if (seg.length) segs.push(seg);
      for (const s of segs) o.push(`<polyline class="act" points="${s.join(' ')}"/>`);
      cum.forEach((v, k) => { if (v != null) o.push(`<circle class="pt${k + 1 === S.day ? ' on' : ''}" cx="${X(k + 1)}" cy="${Y(v)}" r="${k + 1 === S.day ? 5 : 2.5}"/>`); });
    } else {
      const bw = Math.max(2, slot * 0.64), y0 = Y(0);
      if (ref) o.push(`<line class="plan" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(ref())}" y2="${Y(ref())}"/>`);
      vals.forEach((v, k) => {
        if (v == null || v === 0) return;
        const y1 = Y(v);
        o.push(`<rect class="bar${v < 0 ? ' neg' : ''}${k + 1 === S.day ? ' on' : ''}" x="${X(k + 1) - bw / 2}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.max(1, Math.abs(y1 - y0))}" rx="1.5"/>`);
      });
      o.push(`<line class="z" x1="${pad.l}" x2="${W - pad.r}" y1="${y0}" y2="${y0}"/>`);
    }
    const ticks = [...new Set([1, 5, 10, 15, 20, 25, L])].filter(d => d === L || L - d >= 3);
    for (const d of ticks) o.push(`<text class="xt${d === S.day ? ' on' : ''}" x="${X(d)}" y="${H - 7}" text-anchor="middle">${d}</text>`);
    o.push('</svg>');
    box.innerHTML = o.join('');
    const v = vals[S.day - 1];
    box.setAttribute('aria-valuemax', String(L));
    box.setAttribute('aria-valuenow', String(S.day));
    box.setAttribute('aria-valuetext', `${dayLong(mo.ym, S.day)}: ${v == null ? 'мэдээлэлгүй' : exact(v, m)}`);

    const na = gaps.length ? '<span class="lg lg-na"><i></i>Мэдээлэлгүй</span>' : '';
    const planLg = ref ? `<span class="lg lg-plan"><i></i>${isCum ? 'Жигд жишиг' : 'Өдрийн жигд жишиг'}</span>` : '<span class="lg lg-none">Төлөвлөгөө байхгүй — зөвхөн гүйцэтгэл</span>';
    $('legend').innerHTML = isCum
      ? `<span class="lg lg-act"><i></i>Гүйцэтгэл</span>${planLg}${na}`
      : `<span class="lg lg-bar"><i></i>Өдрийн гүйцэтгэл</span>${vals.some(x => x != null && x < 0) ? '<span class="lg lg-neg"><i></i>Буцаалт давсан өдөр (хасах)</span>' : ''}${planLg}${na}`;
    const long = isCum
      ? `Жигд жишиг = сарын төлөвлөгөө × өдөр ÷ ${L}. Батлагдсан өдрийн зорилт, ажлын өдрийн төлөвлөгөө эсвэл сарын эцсийн прогноз биш.`
      : `Өдрийн жигд жишиг = сарын төлөвлөгөө ÷ ${L} календарийн өдөр. Батлагдсан өдрийн зорилт биш.`;
    $('ref-note').innerHTML = !ref ? '' : `<span>${isCum ? 'Жигд жишиг' : 'Өдрийн жигд жишиг'}: календарийн өдрөөр жигд хуваасан жишиг</span>`
      + `<details class="rp-info rp-left"><summary aria-label="Жигд жишгийг хэрхэн тооцсон"><svg class="ic" aria-hidden="true"><use href="#i-info"/></svg></summary><div class="rp-pop">${esc(long)}</div></details>`;
    $('ref-note').hidden = !ref;
  }

  function renderReadout(mo) {
    const m = metricOf(S.metric), d = S.day, v = mo.daily[m.key][d - 1], plan = mo.plan[m.key];
    const items = [];
    if (v == null) items.push(['', mo.through != null && d > mo.through ? `Мэдээлэлгүй · ${FX.cutoff.replace(/-/g, '.')}-ны байдлаар` : 'Мэдээлэлгүй · эх өгөгдлийн хамрах хүрээнээс гадуур']);
    else {
      items.push(['Тухайн өдөр', exact(v, m)]);
      items.push([`${mo.first}–${d} хуримтлагдсан`, exact(cumOf(mo.daily[m.key])[d - 1], m)]);
    }
    if (validPlan(plan)) items.push(S.view === 'cum' ? [`Жигд жишиг 1–${d}`, exact((plan * d) / mo.days_in_month, m)] : ['Өдрийн жигд жишиг', exact(plan / mo.days_in_month, m)]);
    $('readout').innerHTML = `<p class="rp-ro-d">${esc(dayLong(mo.ym, d))}</p><p class="rp-ro-v">${items.map(([k, x]) => (k ? `<span>${esc(k)} <b class="num">${esc(x)}</b></span>` : `<span class="rp-ro-na">${esc(x)}</span>`)).join('')}</p>`;
  }

  function renderDays(mo) {
    const [m0, m1] = metrics, m = metricOf(S.metric), cum = cumOf(mo.daily[m.key]);
    $('th-cum').textContent = `Хуримтлагдсан, ${m.unit}`;
    const td = v => `<td class="num${v === 0 ? ' z0' : v < 0 ? ' ng' : ''}">${neg(v)}${grp(v)}</td>`;
    const out = [];
    if (mo.through == null) out.push(`<tr class="na"><td colspan="4">1–${mo.days_in_month} · Мэдээлэлгүй</td></tr>`);
    else {
      if (mo.first > 1) out.push(`<tr class="na"><td colspan="4">1–${mo.first - 1} · Мэдээлэлгүй</td></tr>`);
      for (let d = mo.first; d <= mo.through; d++) {
        out.push(`<tr${d === S.day ? ' class="on"' : ''}><td>${d}<span class="wd">${WD_S[wdOf(mo.ym, d)]}</span></td>${td(mo.daily[m0.key][d - 1])}${td(mo.daily[m1.key][d - 1])}${td(cum[d - 1])}</tr>`);
      }
      if (mo.through < mo.days_in_month) out.push(`<tr class="na"><td colspan="4">${mo.through + 1}–${mo.days_in_month} · Мэдээлэлгүй (${FX.cutoff.replace(/-/g, '.')}-ны байдлаар)</td></tr>`);
    }
    $('days-b').innerHTML = out.join('');
  }

  const setDay = d => { const L = byYm.get(S.ym).days_in_month, n = clamp(d, 1, L); if (n !== S.day) { S.day = n; renderDay(); } };

  // ---- events
  // an opened ⓘ note stays whole on screen, 12px from the edges (inside an open drawer: from the drawer's edges)
  document.addEventListener('toggle', e => {
    const d = e.target; if (!d.matches?.('details.rp-info') || !d.open) return;
    const pop = d.querySelector('.rp-pop'); pop.style.transform = '';
    const box = d.closest('.rp-sheet-b')?.getBoundingClientRect() || { left: 0, right: innerWidth };
    const lo = Math.max(0, box.left) + 12, hi = Math.min(innerWidth, box.right) - 12, r = pop.getBoundingClientRect();
    const dx = Math.max(r.right > hi ? hi - r.right : 0, lo - r.left);
    if (dx) pop.style.transform = `translateX(${Math.round(dx)}px)`;
  }, true);
  // an open ⓘ note: a tap outside only closes it (never also opens a month or presses a control under it)
  document.addEventListener('click', e => {
    const open = [...document.querySelectorAll('details.rp-info[open]')].filter(x => !x.contains(e.target));
    if (!open.length) return;
    open.forEach(x => { x.open = false; });
    if (!e.target.closest('summary')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('click', e => {
    const row = e.target.closest('.rp-row, .rp-col');   // one tap / click / Enter anywhere on a month opens it
    if (row) return openMonth(row.dataset.ym);
  });
  $('cur-open').addEventListener('click', e => openMonth(e.currentTarget.dataset.ym));
  $('sort').addEventListener('click', () => { newestFirst = !newestFirst; renderList(); });
  $('y-metric').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.ymetric !== P.metric) { P.metric = b.dataset.ymetric; renderYear(); } });
  $('h-view').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setHistView(b.dataset.hv); });
  $('y-scroll').addEventListener('scroll', fades, { passive: true });
  new ResizeObserver(fades).observe($('y-scroll'));
  let axisH = 0;   // plot height changes with the viewport (e.g. rotation): re-pick the readable ticks, keep a focused column focused
  new ResizeObserver(() => {
    const h = $('y-axis').clientHeight;
    if (!h || h === axisH || !months) return;
    const first = !axisH, f = document.activeElement?.closest?.('.rp-col')?.dataset.ym;
    axisH = h;
    if (first) return;
    renderYear();
    if (f) document.querySelector(`#y-cols [data-ym="${f}"]`)?.focus({ preventScroll: true });
  }).observe($('y-axis'));
  $('m-sel').addEventListener('change', e => { if (byYm.has(e.target.value)) openMonth(e.target.value); });
  for (const [id, k] of [['m-prev', -1], ['m-next', 1]]) {
    $(id).addEventListener('click', () => {
      const n = months[months.indexOf(byYm.get(S.ym)) + k];
      if (!n) return;
      openMonth(n.ym);
      if ($(id).disabled) $('m-sel').focus();   // never leave focus on a disabled edge button
    });
  }
  for (const [id, k] of [['d-prev', -1], ['d-next', 1]]) {
    $(id).addEventListener('click', () => { setDay(S.day + k); if ($(id).disabled) $(k < 0 ? 'd-next' : 'd-prev').focus(); });
  }
  $('seg-metric').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { S.metric = b.dataset.metric; renderDrawer(); } });
  $('seg-view').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { S.view = b.dataset.view; renderDrawer(); } });

  const chart = $('chart');
  const dayAt = e => { const r = chart.getBoundingClientRect(); return Math.floor((e.clientX - r.left - geom.pad.l) / geom.slot) + 1; };
  let dragging = false;
  chart.addEventListener('pointerdown', e => { dragging = true; chart.setPointerCapture(e.pointerId); setDay(dayAt(e)); });
  chart.addEventListener('pointermove', e => { if (dragging) setDay(dayAt(e)); });
  for (const t of ['pointerup', 'pointercancel']) chart.addEventListener(t, () => { dragging = false; });
  chart.addEventListener('keydown', e => {
    const L = byYm.get(S.ym).days_in_month;
    const to = { ArrowLeft: S.day - 1, ArrowDown: S.day - 1, ArrowRight: S.day + 1, ArrowUp: S.day + 1, Home: 1, End: L, PageUp: S.day - 7, PageDown: S.day + 7 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    setDay(to);
  });
  new ResizeObserver(() => { if (dr.open) renderChart(byYm.get(S.ym)); }).observe(chart);

  dr.querySelector('[data-close]').addEventListener('click', () => dr.close());
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const info = [...document.querySelectorAll('details.rp-info[open]')];
    if (!info.length) return;
    e.preventDefault(); e.stopPropagation();
    info.forEach(x => { x.open = false; }); info[0].querySelector('summary').focus();
  }, true);
  dr.addEventListener('cancel', e => { if (document.querySelector('details.rp-info[open]')) e.preventDefault(); });
  dr.addEventListener('click', e => {
    if (e.target !== dr) return;
    const r = dr.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dr.close();
  });
  dr.addEventListener('close', () => {
    document.documentElement.classList.remove('rp-modal');
    const ym = S.ym;
    S.ym = null;
    markOpen();
    syncUrl();
    // focus returns to the month last shown in the visible view (chart column or list row; the current month → its button)
    const el = byYm.get(ym)?.current ? $('cur-open') : document.querySelector(`#${P.view === 'chart' ? 'y-cols' : 'list'} [data-ym="${ym}"]`);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); }
  });

  // Telegram Back (one handler, owned by workspace.js): an open info note or the month drawer closes first; otherwise «Миний ажил»
  window.WS?.page({ back: () => {
    const info = document.querySelectorAll('details.rp-info[open]');
    if (info.length) { info.forEach(x => { x.open = false; }); return true; }
    if (dr.open) { dr.close(); return true; }
    return false;
  } });

  window.RepPerf = { state: () => ({ ...S, page: { ...P }, rep: rep?.code ?? null }) };   // read-only hook for the QA script
  init();
})();
