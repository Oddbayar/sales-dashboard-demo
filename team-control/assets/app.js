// «Багийн хяналт» — supervisor scaffold. Every figure is computed here from data/fixture.js + this browser's store; the store,
// the review rules and the task markup live in core.js (shared with the store window's supervisor section).
// One <dialog> drawer: pick → form → done. A customer's name (drawer) or «Дэлгүүр» (task row) opens the common store window
// in this tab; the way back restores tab, filters, open rows, selection, drafts and scroll (sessionStorage, this tab only).
(() => {
  'use strict';
  const C = window.TeamCore;
  const { FX, $, nf, esc, dot, pad, icon, STATUS, ORDER, P, py, pm, monthDays, cutDay, custBy, repName, ms, short, S, drafts, tally, badge, replyCell } = C;
  const BANDS = { lt1: v => v < 1e6, '1to3': v => v >= 1e6 && v < 3e6, '3to5': v => v >= 3e6 && v < 5e6, ge5: v => v >= 5e6 };
  const STORE = '../store-report/';               // the common store window, same origin (same storage), same tab
  const RETURN = 'team-control.return';           // where the supervisor was when a store was opened (sessionStorage)
  const DECIDED = 'team-control.decided';         // decisions made in that store window, said once on the way back (store-panel.js)
  const FROM_STORE = new URLSearchParams(location.search).get('from') === 'store';   // read before setTab() rewrites the URL
  const storeHref = (code, aid) => `${STORE}?sv=${encodeURIComponent(code)}${aid ? '&a=' + encodeURIComponent(aid) : ''}`;

  const repMoney = code => FX.customers.reduce((s, c) => c.rep === code ? s + c.cur : s, 0);

  // ---------- formatting of plan vs actual ----------
  const money = v => (v / 1e6).toFixed(1);
  // floored to 0.1 (99.96 → 99.9), from the exact integers; no plan / no data never becomes 0%
  const pct = (a, p) => Math.floor(a * 1000 / p) / 10;
  function metric(a, p, fmt, unit) {
    if (a == null) return `<span class="tc-na">Мэдээлэлгүй</span>`;
    if (!(p > 0)) return `<div class="tc-mt"><b class="tc-pct">—</b><span class="num tc-ap">${fmt(a)} ${unit}</span></div><p class="tc-np">Төлөвлөгөө байхгүй</p>`;
    const v = pct(a, p), met = a >= p;
    return `<div class="tc-mt"><b class="tc-pct num">${v.toFixed(1)}%${met ? icon('check', 'ic tc-met') + '<span class="sr-only"> биелсэн</span>' : ''}</b>`
      + `<span class="num tc-ap">${fmt(a)} / ${fmt(p)} ${unit}</span></div>`
      + `<div class="tc-prog${met ? ' met' : ''}" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`;
  }

  // ---------- month (Claude 37): the fixture's month + the full months of the sample file (data/history-demo.js) ----------
  const H = window.TEAM_CONTROL_HISTORY || {};
  const MONTHS = [...new Set([P.month, ...Object.keys(H.money || {})])].sort();
  let mon = P.month;
  const mAdd = (m, k) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const mName = m => `${Number(m.slice(5))}-р сар`;   // spoken (aria); on screen a compact month is MM under its year range
  const mRange = (a, b) => a.slice(0, 4) === b.slice(0, 4) ? `${dot(a)}–${b.slice(5)}` : `${dot(a)}–${dot(b)}`;
  const span = m => m === P.month ? `${dot(m)}.01–${pad(cutDay)}` : `${dot(m)}.01–${new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate()} · бүтэн сар`;
  // a rep's money in a month: the fixture (its own month) or the sample file; nothing there → null («Мэдээлэлгүй», never 0)
  const repMon = (r, m) => { const x = H.money?.[m]?.[r.code]; return m === P.month ? { a: repMoney(r.code), p: r.plan?.amount } : { a: x ? x[0] : null, p: x ? x[1] : null }; };
  // a past month's % for the «Өмнөх 3 сар» line: sample money (actual ÷ plan) or the sample %; none → null («—»)
  const histPct = (code, m) => { const x = H.money?.[m]?.[code]; return x ? pct(x[0], x[1]) : H.pct?.[m]?.[code] ?? null; };
  // the month a done/failed task was finally decided: its stored decision event (local date); no dated event → null (no month)
  const decMonth = a => { const e = (a.status === 'done' || a.status === 'failed') && C.lastDecision(a); return e ? (C.isDate(e.at) ? e.at : C.isoOf(new Date(e.at))).slice(0, 7) : null; };

  // ---------- main page ----------
  function renderMain() {
    const { rep } = tally();
    const rows = FX.reps.map(r => ({ r, ...repMon(r, mon), t: rep.get(r.code), n: FX.customers.filter(c => c.rep === r.code).length }));
    // open work = today's open work (whatever month it came from); done/failed = finally decided in the chosen month
    const dec = new Map(FX.reps.map(r => [r.code, { done: 0, failed: 0 }]));
    let undated = 0;
    for (const a of S.asg.values()) { const m = decMonth(a); if (m === mon) dec.get(a.rep)[a.status]++; else if (!m && (a.status === 'done' || a.status === 'failed')) undated++; }
    // team: Σ actual ÷ Σ plan over the reps with a plan and data (never the average of the reps' %)
    const w = rows.filter(x => x.p > 0 && x.a != null), tm = { a: w.reduce((s, x) => s + x.a, 0), p: w.reduce((s, x) => s + x.p, 0), n: w.length };
    const review = rows.reduce((s, x) => s + x.t.review, 0);
    const cover = t => t.n < rows.length ? `<small>${t.n}/${rows.length} ХТ-ээр тооцов; бусад нь төлөвлөгөө эсвэл мэдээлэлгүй</small>` : '';
    // two cards on one line: the team's money in the chosen month and today's review count (the card opens those tasks)
    $('sum').innerHTML =
      `<section class="tc-card tc-sum-m"><h2 class="tc-card-l">Мөнгөн биелэлт · <span class="num">${span(mon)}</span></h2>${tm.n ? metric(tm.a, tm.p, money, 'сая ₮') : '<span class="tc-na">Мэдээлэлгүй</span>'}${cover(tm)}</section>`
      + `<button type="button" class="tc-card tc-sum-r" id="sum-review" data-goto="review" aria-label="Одоо хянуулах ${review} ажлыг харах"${review ? '' : ' disabled'}>`
      + `<span class="tc-card-l">Одоо хянуулах</span><span class="tc-sum-rn"><b class="tc-pct num">${review}</b>${icon('right')}</span></button>`;
    // «Өмнөх 3 сар»: the three full months before the chosen one; 100%+ green with a small ✓
    const hRange = mRange(mAdd(mon, -3), mAdd(mon, -1));
    const hist = r => `<ol class="tc-h3" data-l="Өмнөх 3 сар · ${hRange}">${[-3, -2, -1].map(k => {
      const m = mAdd(mon, k), v = histPct(r.code, m);
      return `<li><span aria-label="${mName(m)}">${m.slice(5)}</span>${v == null ? '<b class="num">—</b>' : `<b class="num${v >= 100 ? ' ok' : ''}">${v.toFixed(1)}%${v >= 100 ? '<span class="sr-only"> биелсэн</span>' : ''}</b>`}</li>`;
    }).join('')}</ol>`;
    const nCell = (r, s, n) => { const d = s === 'done' || s === 'failed';
      return `<td class="tc-n num">${n ? `<button type="button" class="tc-nbtn" id="n-${r.code}-${s}" data-goto="${s}" data-rep="${r.code}"${d ? ` data-dm="${mon}"` : ''} aria-label="${esc(r.name)}: ${d ? `${mName(mon)}д ` : 'одоо '}${STATUS[s].t.toLowerCase()} ${n} — ажлуудыг харах">${n}</button>`
        : '<span class="zero">0</span>'}</td>`; };
    $('reps').innerHTML = rows.map(({ r, a, p, t, n }) => `<tr data-rep="${esc(r.code)}">`
      + `<th scope="row"><button type="button" class="tc-rep" id="rep-${r.code}" aria-label="${esc(r.name)} ${esc(r.code)}: ${n} харилцагч нээх"><span><b>${esc(r.name)}</b><small class="num">${esc(r.code)} · ${n} харилцагч</small></span>${icon('right')}</button></th>`
      + `<td class="tc-m">${metric(a, p, money, 'сая ₮')}</td><td class="tc-hc">${hist(r)}</td>`
      + ['todo', 'review'].map(s => nCell(r, s, t[s])).join('') + ['done', 'failed'].map(s => nCell(r, s, dec.get(r.code)[s])).join('') + `</tr>`).join('');
    $('tab-review').textContent = `Хянуулах ${review}`;
    $('tab-review').classList.toggle('zero', !review);
    $('mon-sel').value = mon;
    const mi = MONTHS.indexOf(mon); $('mon-prev').disabled = mi <= 0; $('mon-next').disabled = mi >= MONTHS.length - 1;   // no data that way
    $('th-dec').textContent = `${dot(mon)}-д шийдвэрлэсэн`;
    $('th-hist').innerHTML = `Өмнөх 3 сар<br><span class="num">${hRange}</span>`;
    // narrow screens fold the table head away: one line keeps the two scopes of the counts
    $('scope-l').textContent = `Хийх, Хянуулах — одоо нээлттэй · Баталгаажсан, Биелээгүй — ${dot(mon)}-д шийдвэрлэсэн`;
    $('perf-note').textContent = `Гүйцэтгэл: ${span(mon)}; төлөвлөгөө бүтэн сарынх. Багийн хувь = нийт гүйцэтгэл ÷ нийт төлөвлөгөө (ХТ-ийн хувиудын дундаж биш). `
      + `${MONTHS.filter(m => m !== P.month).map(dot).join(', ')}-ийн гүйцэтгэл, төлөвлөгөө болон «Өмнөх 3 сар»-ын түүх нь жишиг өгөгдөл: тогтоосон утга, борлуулалтаас тооцоогүй. `
      + `Хийх / Хянуулах = одоо нээлттэй бүх ажил, өмнөх сараас шилжсэн ч. Баталгаажсан / Биелээгүй = сонгосон сард эцэслэн шийдсэн ажил, шийдвэрийн огноогоор. `
      + (undated ? `Шийдвэрийн огноогүй хуучин ${undated} ажлыг аль ч сард тоолоогүй. ` : '')
      + `Тоон дээр дарж яг тэр ажлуудыг нээнэ. Төлөвлөгөө ба тоонууд демо.`;
  }
  // one compact select (newest first): the fixture's month + the sample file's full months
  $('mon-sel').innerHTML = [...MONTHS].reverse().map(m => `<option value="${m}">${dot(m)}</option>`).join('');
  $('mon-sel').addEventListener('change', e => { if (MONTHS.includes(e.target.value)) { mon = e.target.value; renderMain(); } });
  // ‹ › step to the neighbouring month through the select's own change
  for (const [id, k] of [['mon-prev', -1], ['mon-next', 1]]) $(id).addEventListener('click', () => { const m = MONTHS[MONTHS.indexOf(mon) + k]; if (m) { $('mon-sel').value = m; $('mon-sel').dispatchEvent(new Event('change')); } });
  // ⓘ (a manual popover): a tap outside only closes it — never also opens the row under it; Esc closes it too
  const info = $('tc-info'), infoOpen = () => { try { return info.matches(':popover-open'); } catch { return false; } };
  document.addEventListener('click', e => { if (infoOpen() && !e.target.closest('#tc-info, .tc-info')) { info.hidePopover(); e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && infoOpen()) { info.hidePopover(); document.querySelector('.tc-info').focus(); } });

  // ---------- tasks tab: one section per rep ----------
  // per: the period of finally decided work ('' = all time, also the undated old records); open work is always today's.
  // opened: the rep sections the supervisor opened (all closed on a fresh page; kept through filters, live updates and the store)
  const tv = { rep: '', status: '', per: P.month, q: '', dir: 'asc', opened: new Set(), open: new Set(), hist: new Set(), fresh: new Set() };
  let flash = null;   // { warn, text }: the last review outcome, shown above the list
  $('t-rep').innerHTML = `<option value="">Бүх ХТ</option>` + FX.reps.map(r => `<option value="${esc(r.code)}">${esc(r.name)} · ${esc(r.code)}</option>`).join('');

  // the opened row: shared detail + the way into that customer's store window (with this assignment as context)
  // (the task-tab variant: task → latest reply → comment and decision; dates + «Харилцагчийг харах» on one line; history folded)
  const detail = a => C.detail(a, { tab: true, histOpen: tv.hist.has(a.id),
    customer: `<a class="tc-btn tc-go-btn" id="ag-${esc(a.id)}" href="${esc(storeHref(a.customer, a.id))}" data-store="${esc(a.customer)}" data-aid="${esc(a.id)}">${icon('store')}Харилцагчийг харах</a>` });
  function rowHtml(a) {
    const t = S.tasks.get(a.task), c = custBy.get(a.customer), open = tv.open.has(a.id), id = esc(a.id);
    return `<li class="tc-a s-${a.status}${tv.fresh.has(a.id) ? ' fresh' : ''}"><div class="tc-arow-w">`
      + `<button type="button" class="tc-arow" id="ar-${id}" data-aid="${id}" aria-expanded="${open}" aria-controls="ad-${id}">`
      + `<span class="tc-a-g num"><span class="tc-l">Өгсөн </span>${short(t.created_at)}</span>`
      + `<span class="tc-a-c"><b>${esc(c.name)}</b><small class="num">${esc(c.code)}</small></span>`
      + `<span class="tc-a-t">${esc(t.title)}</span>`
      + `<span class="tc-a-d num"><span class="tc-l">Хугацаа </span>${short(t.due)}</span>`
      + `<span class="tc-a-s">${badge(a.status)}</span><span class="tc-a-r">${replyCell(a)}</span>${icon('down', 'ic tc-chev')}</button>`
      + `<a class="tc-a-go" id="as-${id}" href="${esc(storeHref(a.customer, a.id))}" data-store="${esc(a.customer)}" data-aid="${id}" aria-label="${esc(c.name)}: харилцагчийг харах">${icon('store')}<span>Дэлгүүр</span></a></div>`
      + `<div class="tc-adet" id="ad-${id}"${open ? '' : ' hidden'}>${open ? detail(a) : ''}</div></li>`;
  }
  const taskFilters = () => !!(tv.rep || tv.status || tv.q.trim());
  // open work (Хийх, Хянуулах) = today's, whatever month it came from; decided work = decided in the period (by its stored decision)
  const inPer = a => a.status === 'todo' || a.status === 'review' || !tv.per || decMonth(a) === tv.per;
  const perName = () => tv.per ? dot(tv.per) : 'бүх хугацаа';
  function renderTasks() {
    const q = tv.q.trim().toLowerCase(), all = [...S.asg.values()];
    const inRep = a => !tv.rep || a.rep === tv.rep;
    const inQ = a => { if (!q) return true; const t = S.tasks.get(a.task), c = custBy.get(a.customer); return t.title.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q); };
    const match = a => inPer(a) && (!tv.status || a.status === tv.status) && inQ(a);
    const dir = tv.dir === 'asc' ? 1 : -1;
    // real date/time of «өгсөн»; ties: task id, then customer code (stable in both directions)
    const cmp = (x, y) => dir * (ms(S.tasks.get(x.task).created_at) - ms(S.tasks.get(y.task).created_at)) || x.task.localeCompare(y.task) || x.customer.localeCompare(y.customer);
    $('t-rep').value = tv.rep;
    // status counts follow the rep, the search and the period — never the chosen status itself
    $('t-status').innerHTML = [['', 'Бүгд'], ...ORDER.map(s => [s, STATUS[s].t])].map(([s, l]) =>
      `<button type="button" class="tc-segb${s ? ' k-' + s : ''}" id="ts-${s || 'all'}" data-st="${s}" aria-pressed="${tv.status === s}">${s ? icon(STATUS[s].i) : ''}${l} <span class="num">${all.filter(a => inRep(a) && inPer(a) && inQ(a) && (!s || a.status === s)).length}</span></button>`).join('');
    $('t-per').value = tv.per;
    const pi = MONTHS.indexOf(tv.per); $('t-prev').disabled = pi <= 0; $('t-next').disabled = pi < 0 || pi >= MONTHS.length - 1;
    $('t-dir').innerHTML = `${icon(tv.dir === 'asc' ? 'arrow-up' : 'arrow-down')}Өгсөн огноо: ${tv.dir === 'asc' ? 'хуучнаас шинэ' : 'шинээс хуучин'}`;
    const filt = !!(tv.status || q);
    const head = `<div class="tc-ahead" aria-hidden="true"><span>Өгсөн</span><span>Харилцагч</span><span>Даалгавар</span><span>Хугацаа</span><span>Төлөв</span><span>Хариу</span><span></span></div>`;
    let shown = 0, total = 0;
    const html = (tv.rep ? FX.reps.filter(r => r.code === tv.rep) : FX.reps).map(r => {
      // a closed section still shows its name, its work in the period and each status count (Хянуулах amber, Баталгаажсан green…)
      const mine = all.filter(a => a.rep === r.code && inPer(a)), rows = mine.filter(match).sort(cmp), open = tv.opened.has(r.code);
      shown += rows.length; total += mine.length;
      return `<section class="tc-rsec" data-rep="${esc(r.code)}"><h3><button type="button" class="tc-rsec-h" id="rh-${esc(r.code)}" aria-expanded="${open}" aria-controls="rb-${esc(r.code)}">`
        + `${icon('down', 'ic tc-chev')}<span class="tc-rsec-n"><b>${esc(r.name)}</b><small class="num">${esc(r.code)} · ${mine.length} ажил</small></span>`
        + `<span class="tc-rsec-c">${['review', 'todo', 'done', 'failed'].map(s => { const n = mine.filter(a => a.status === s).length; return `<span class="tc-cnt k-${s}${n ? '' : ' zero'}">${STATUS[s].t} <b class="num">${n}</b></span>`; }).join('')}</span>`
        + (filt ? `<span class="tc-rsec-f num">${rows.length} тохирсон</span>` : '') + `</button></h3>`
        + `<div class="tc-rsec-b" id="rb-${esc(r.code)}"${open ? '' : ' hidden'}>`
        + (rows.length ? head + `<ul class="tc-alist">${rows.map(rowHtml).join('')}</ul>` : `<p class="tc-rsec-none">${filt ? 'Энэ шүүлтэд тохирох ажил алга.' : 'Даалгавар өгөөгүй.'}</p>`)
        + `</div></section>`;
    }).join('');
    const none = filt && shown === 0;
    $('t-sections').innerHTML = none ? '' : html;
    $('t-empty').hidden = !none;
    const parts = [tv.rep && repName(tv.rep), tv.status && STATUS[tv.status].t, q && `«${tv.q.trim()}»`].filter(Boolean);
    // the scope in plain view (tablet and desktop): open = today, decided = the chosen period
    $('t-res').innerHTML = `<b class="num">${filt ? `${shown} / ${total}` : total} ажил</b><span class="tc-scope num">Нээлттэй — одоо · Шийдвэрлэсэн — ${perName()}</span>`
      + (parts.length ? `<span class="tc-active">Шүүлт: ${parts.map(esc).join(' · ')}</span>` : '');
    $('t-clear').hidden = !taskFilters();
    $('t-flash').innerHTML = flash ? `${icon(flash.warn ? 'review' : 'check')}<span>${esc(flash.text)}</span>` : '';
    $('t-flash').classList.toggle('warn', !!flash?.warn);
    $('t-flash').hidden = !flash;
    $('tasks-note').textContent = `Тоо бүр харилцагч тус бүрийн даалгавар. «Хянуулах» = ХТ хариу илгээсэн, таны шийдвэр хүлээж буй; хариу ирсэн нь биелсэн гэсэн үг биш. `
      + `«Биелээгүй» = биелээгүй гэж хаасан. Хариу нь демо ХТ-ийн «Миний маршрут»-аас ирнэ, эсвэл демогийн жишээ. «Дэлгүүр» нь тухайн харилцагчийн дэлгүүрийн цонхыг энэ таб дотор нээнэ.`;
  }

  function renderAll() {
    const id = document.activeElement?.id;
    renderMain(); renderTasks();
    if (dr.open && view === 'pick') renderList();
    const el = id && $(id);
    if (el && document.activeElement !== el) {     // re-render replaced the focused element: put focus back on its twin
      el.focus({ preventScroll: true });
      if (el.tagName === 'TEXTAREA') el.selectionStart = el.selectionEnd = el.value.length;
    }
  }

  // navigation into the tasks tab with a filter (home summary / a rep's count)
  // the sections holding that work open (others stay as they were); a decided count brings its month as the period
  function gotoTasks(status, rep, dm = '') {
    Object.assign(tv, { status, rep, q: '' });
    if (dm) tv.per = dm;
    tv.fresh.clear(); flash = null;
    openMatches();
    if (rep) tv.opened.add(rep);
    $('t-q').value = '';
    setTab('tasks'); renderTasks();
    window.scrollTo(0, 0);
    $('t-res').focus({ preventScroll: true });
  }
  // an explicit ХТ / status choice opens the sections that hold its work (other sections stay as the user left them)
  const openMatches = () => { for (const a of S.asg.values()) if ((!tv.rep || a.rep === tv.rep) && a.status === tv.status && inPer(a)) tv.opened.add(a.rep); };
  // why a decided row is no longer listed (said next to the outcome)
  const whyGone = a => tv.status && a.status !== tv.status ? `«${STATUS[tv.status].t}» шүүлтэд тохирохгүй болсон тул жагсаалтаас гарсан`
    : !inPer(a) ? `шийдвэрлэсэн хугацаа ${perName()} биш тул жагсаалтаас гарсан` : 'одоогийн шүүлтэд харагдахгүй болсон';
  // a row lands just under the sticky block; the result line above the list comes into view with it when both fit on the screen
  function reveal(el) {
    const st = $('t-stick'), top = st.getBoundingClientRect().height + (parseFloat(getComputedStyle(st).top) || 0) + 8, f = $('t-flash');
    let y = el.getBoundingClientRect().top + scrollY - top;
    if (!f.hidden && f !== el) { const fy = f.getBoundingClientRect().top + scrollY - top; if (el.getBoundingClientRect().bottom + scrollY - fy <= innerHeight - top) y = Math.min(y, fy); }
    window.scrollTo(0, y);
  }
  const refilter = () => { flash = null; renderTasks(); };
  $('t-rep').addEventListener('change', e => { tv.rep = e.target.value; if (tv.rep) tv.opened.add(tv.rep); refilter(); });
  $('t-status').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (b) { tv.status = b.dataset.st; if (tv.status) openMatches(); refilter(); $(b.id).focus(); } });
  // ‹ [period ▾] ›: «Бүх хугацаа» + the page's months; the arrows step between months (none from «Бүх хугацаа»)
  $('t-per').innerHTML = `<option value="">Бүх хугацаа</option>` + [...MONTHS].reverse().map(m => `<option value="${m}">${dot(m)}</option>`).join('');
  $('t-per').addEventListener('change', e => { tv.per = e.target.value === '' || MONTHS.includes(e.target.value) ? e.target.value : P.month; refilter(); });
  for (const [id, k] of [['t-prev', -1], ['t-next', 1]]) $(id).addEventListener('click', () => { const m = MONTHS[MONTHS.indexOf(tv.per) + k]; if (m) { $('t-per').value = m; $('t-per').dispatchEvent(new Event('change')); } });
  // a row's history (folded by default) keeps its open state through re-renders
  $('t-sections').addEventListener('toggle', e => { const d = e.target; if (d.matches?.('details[data-hist]')) { if (d.open) tv.hist.add(d.dataset.hist); else tv.hist.delete(d.dataset.hist); } }, true);
  $('t-q').addEventListener('input', e => { tv.q = e.target.value; refilter(); });
  $('t-dir').addEventListener('click', () => { tv.dir = tv.dir === 'asc' ? 'desc' : 'asc'; refilter(); });
  const clearTasks = () => { Object.assign(tv, { rep: '', status: '', q: '' }); $('t-q').value = ''; refilter(); $('t-res').focus(); };
  $('t-clear').addEventListener('click', clearTasks);
  $('t-empty-clear').addEventListener('click', clearTasks);

  $('t-sections').addEventListener('click', e => {
    const h = e.target.closest('.tc-rsec-h');
    if (h) {
      const code = h.closest('.tc-rsec').dataset.rep, open = h.getAttribute('aria-expanded') !== 'true';
      if (open) tv.opened.add(code); else tv.opened.delete(code);
      h.setAttribute('aria-expanded', open); $('rb-' + code).hidden = !open;
      return;
    }
    const row = e.target.closest('.tc-arow');
    if (row) {
      const aid = row.dataset.aid, open = !tv.open.has(aid);
      if (open) tv.open.add(aid); else tv.open.delete(aid);
      row.setAttribute('aria-expanded', open);
      const det = $('ad-' + aid); det.hidden = !open; det.innerHTML = open ? detail(S.asg.get(aid)) : '';
      return;
    }
    const b = e.target.closest('[data-act]');
    if (b) act(b);
  });
  $('t-sections').addEventListener('input', C.onDraftInput);

  async function act(btn) {
    const aid = btn.dataset.aid, r = await C.review(btn);
    if (!r) return;
    flash = { warn: r.warn, text: r.text };     // also up top: the row may have left the current filter
    if (!r.ok) tv.open.add(aid);
    renderAll();
    const row = $('ar-' + aid);
    if (!row) { flash.text += ' — ' + whyGone(S.asg.get(aid)); renderTasks(); }
    if (!row) reveal($('t-flash'));
    (row || $('t-flash')).focus({ preventScroll: true });
  }

  // another tab, or the store window of this tab (after a bfcache return), changed the store: show it (filters, open rows, drafts and scroll stay)
  C.onChange(renderAll);
  C.onChange(sayDecided);
  // decisions made in the store window: which work, its status now and why a row left the list — said once, then forgotten
  function sayDecided() {
    let d = [];
    try { d = JSON.parse(sessionStorage.getItem(DECIDED) || '[]'); sessionStorage.removeItem(DECIDED); } catch { /* private mode: nothing to say */ }
    d = Array.isArray(d) ? d.filter(x => x && S.asg.has(x.aid) && typeof x.text === 'string') : [];
    if (!d.length) return;
    flash = { warn: false, text: d.map(x => x.text + ($('ar-' + x.aid) ? '' : ' — ' + whyGone(S.asg.get(x.aid)))).join(' · ') };
    renderTasks();
    if ($('p-tasks').hidden || dr.open) return;
    if (d.some(x => !$('ar-' + x.aid))) reveal($('t-flash'));   // a row left the list: the line that says why comes into view
    $('t-flash').focus({ preventScroll: true });
  }

  // ---------- tabs (#tasks survives reload) ----------
  // Inside Telegram the hash is the launch data: it stays untouched and the tab survives in this tab's sessionStorage instead
  const LAUNCH = () => window.WS?.launchHash() || '', TAB = 'team-control.tab';
  const LOW = matchMedia('(max-height: 560px)');   // a low landscape tablet: the tabs and the period scroll away, the filters stay
  function setTab(t, focus) {
    const tr = document.querySelector('.tc-tabrow'), fo = tr.contains(document.activeElement) ? document.activeElement : null;
    if (t === 'tasks') $('t-stick')[LOW.matches ? 'before' : 'prepend'](tr); else $('p-perf').before(tr);
    if (fo) fo.focus({ preventScroll: true });
    for (const b of document.querySelectorAll('[data-tab]')) {
      const on = b.dataset.tab === t;
      b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
      $(b.getAttribute('aria-controls')).hidden = !on;
      $(b.dataset.tab === 'perf' ? 'mon' : 't-per-w').hidden = !on;   // the month belongs to «Гүйцэтгэл»
      if (on && focus) b.focus();
    }
    if (LAUNCH()) { history.replaceState(null, '', location.pathname + LAUNCH()); try { sessionStorage.setItem(TAB, t); } catch { /* private mode */ } }
    else history.replaceState(null, '', t === 'tasks' ? '#tasks' : location.pathname);
  }
  const startTab = () => { if (location.hash === '#tasks') return 'tasks'; try { return LAUNCH() && sessionStorage.getItem(TAB) === 'tasks' ? 'tasks' : 'perf'; } catch { return 'perf'; } };
  LOW.addEventListener('change', () => { if ($('tab-tasks').getAttribute('aria-selected') === 'true') setTab('tasks'); });
  // the tab's «Хянуулах N» is a count only: a tap anywhere on the tab opens it as it was («Одоо хянуулах» filters)
  document.querySelector('.tc-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab);
  });
  document.querySelector('.tc-tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    setTab(document.querySelector('[data-tab][aria-selected="true"]').dataset.tab === 'perf' ? 'tasks' : 'perf', true);
  });
  $('p-perf').addEventListener('click', e => {
    const go = e.target.closest('[data-goto]');
    if (go) { gotoTasks(go.dataset.goto, go.dataset.rep || '', go.dataset.dm || ''); return; }   // a task count never opens the customer drawer
    const tr = e.target.closest('tr[data-rep]');
    if (tr) openPicker(tr.dataset.rep, tr.querySelector('.tc-rep'));
  });
  $('open-all').addEventListener('click', e => { window.WS?.closeMenus(); openPicker('', e.currentTarget); });

  // ---------- drawer ----------
  const dr = $('dr');
  const sel = new Set();          // selected customer codes; kept across filters, sorting, rep switch, close and the store window; cleared on create / «Сонголт цэвэрлэх»
  const pick = {};
  const fresh = rep => ({ rep, q: '', band: '', sort: { key: 'cur', dir: 'desc' }, noBuy: false, noTask: false });
  let view = 'pick', opener = null;

  // the value headers sort; the first click on a column is «ихээс / шинээс», the next flips it
  const SORTS = {
    cur: { v: c => c.cur, by: 'Энэ сарын дүнгээр', desc: 'ихээс бага', asc: 'багаас их' },
    avg: { v: c => c.avg12, by: 'Сарын дунджаар', desc: 'ихээс бага', asc: 'багаас их' },
    last: { v: c => c.last ? ms(c.last) : null, by: 'Сүүлийн авалтаар', desc: 'шинээс хуучин', asc: 'хуучнаас шинэ' },
  };
  function cmpCust(a, b) {
    const S_ = SORTS[pick.sort.key], x = S_.v(a), y = S_.v(b);
    if (x == null || y == null) return (x == null) - (y == null) || a.code.localeCompare(b.code);   // no value: last in both directions
    return (pick.sort.dir === 'asc' ? x - y : y - x) || a.code.localeCompare(b.code);
  }
  for (const b of document.querySelectorAll('.tc-sort-l')) b.insertAdjacentHTML('beforeend', icon('updown', 'ic tc-sort-i'));

  $('f-rep').innerHTML = `<option value="">ХТ: бүх баг</option>`
    + FX.reps.map(r => `<option value="${esc(r.code)}">ХТ: ${esc(r.name)} · ${esc(r.code)}</option>`).join('');

  // st: a saved picker state (the way back from a store window), otherwise a fresh view of that rep's customers
  function openPicker(rep, from, st) {
    Object.assign(pick, fresh(rep), st);
    $('f-rep').value = pick.rep; $('f-q').value = pick.q; $('f-band').value = pick.band;
    $('sort-say').textContent = '';
    show('pick');
    renderList();
    opener = from;
    document.documentElement.classList.add('tc-modal');
    dr.showModal();
    $('list-box').scrollTop = st?.top || 0;
    if (!st) $('dr-title').focus();
  }
  function closeDrawer() {
    if (!dr.open) return;
    document.documentElement.classList.remove('tc-modal');
    dr.close();
  }
  dr.addEventListener('close', () => {
    document.documentElement.classList.remove('tc-modal');
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  });
  // Esc: one step back from the form, otherwise close
  dr.addEventListener('cancel', e => { if (view === 'form') { e.preventDefault(); back(); } });
  dr.addEventListener('click', e => {
    if (e.target === dr || e.target.closest('[data-close]')) closeDrawer();
    else if (e.target.closest('[data-back]')) back();
  });
  function show(v) {
    view = v;
    $('v-pick').hidden = v !== 'pick'; $('v-form').hidden = v !== 'form'; $('v-done').hidden = v !== 'done';
  }
  function back() { show('pick'); renderList(); $('to-form').focus(); }

  function visible() {
    const q = pick.q.trim().toLowerCase(), { active } = tally();
    const rows = FX.customers.filter(c => (!pick.rep || c.rep === pick.rep)
      && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      && (!pick.noBuy || c.cur <= 0)
      && (!pick.noTask || !active.get(c.code))
      && (!pick.band || BANDS[pick.band](c.cur)));
    return { rows: rows.sort(cmpCust), active };
  }
  const filtered = () => !!(pick.q.trim() || pick.band || pick.noBuy || pick.noTask);

  // a row: the checkbox (and the row's empty space) selects; the name and «›» open the store window — two separate actions
  function renderList() {
    const { rows, active } = visible();
    const scope = pick.rep ? FX.customers.filter(c => c.rep === pick.rep).length : FX.customers.length;
    const all = !pick.rep;
    $('dr-title').textContent = all ? 'Багийн харилцагчид' : `${repName(pick.rep)} · Харилцагчид`;
    $('pick-sub').textContent = all ? `${FX.reps.length} ХТ · ${scope} харилцагч` : `${pick.rep} · ${scope} харилцагч`;
    $('v-pick').classList.toggle('all', all);
    $('f-nobuy').setAttribute('aria-pressed', pick.noBuy); $('f-notask').setAttribute('aria-pressed', pick.noTask);
    $('res-n').textContent = rows.length === scope ? `${scope} харилцагч` : `${rows.length} / ${scope} харилцагч`;
    $('f-clear').hidden = !filtered();
    for (const b of document.querySelectorAll('.tc-sort')) {
      const k = b.dataset.sort, s = SORTS[k], on = pick.sort.key === k;
      b.classList.toggle('on', on);
      b.querySelector('.tc-sort-i use').setAttribute('href', on ? (pick.sort.dir === 'asc' ? '#i-arrow-up' : '#i-arrow-down') : '#i-updown');
      b.setAttribute('aria-label', on ? `${s.by} эрэмбэлсэн: ${s[pick.sort.dir]}. Дарж эсрэгээр эрэмбэлэх.` : `${s.by} эрэмбэлэх`);
    }
    $('list').innerHTML = rows.map(c => {
      const a = active.get(c.code) || 0, on = sel.has(c.code), code = esc(c.code), href = esc(storeHref(c.code));
      return `<li class="tc-row${on ? ' on' : ''}"><label class="tc-pick"><input type="checkbox" id="cb-${code}" value="${code}"${on ? ' checked' : ''} aria-label="Сонгох: ${esc(c.name)} ${code}"></label>`
        + `<a class="tc-c-name" id="cn-${code}" href="${href}" data-store="${code}"><b>${esc(c.name)}</b><small class="num">${code}<span class="tc-c-rep2"> · ${esc(repName(c.rep))}</span></small></a>`
        + `<span class="tc-col-rep">${esc(repName(c.rep))}</span>`
        + `<span class="r num" data-l="Энэ сар">${c.cur == null ? '—' : nf.format(c.cur)}</span>`
        + `<span class="r num" data-l="Сарын дундаж">${c.avg12 == null ? '—' : nf.format(c.avg12)}</span>`
        + `<span class="r num${c.last ? '' : ' muted'}" data-l="Сүүлийн авалт">${c.last ? dot(c.last) : 'Авалтгүй'}</span>`
        + `<span class="r num${a ? '' : ' muted'}" data-l="Идэвхтэй даалгавар">${a}</span>`
        + `<a class="tc-c-go" href="${href}" data-store="${code}" tabindex="-1" title="Дэлгэрэнгүй" aria-label="${esc(c.name)}: дэлгэрэнгүй">${icon('right')}</a></li>`;
    }).join('');
    $('empty').hidden = rows.length > 0;
    $('lhead').hidden = rows.length === 0;
    if (!rows.length) $('empty-t').textContent = pick.q.trim() ? `«${pick.q.trim()}» хайлт болон шүүлтэд тохирох харилцагч алга.` : 'Энэ шүүлтэд тохирох харилцагч алга.';
    $('empty-clear').hidden = !filtered();
    $('list-note').hidden = rows.length === 0;
    $('list-note').textContent = `Энэ сар = ${dot(P.month)}.01–${pad(cutDay)}-ны цэвэр татан авалт (дутуу сар). Сарын дундаж = ${dot(P.avg12[0])}–${dot(P.avg12[1])}-ийн 12 бүтэн сарын дүн ÷ 12. `
      + `Сүүлийн авалт = ${dot(P.cutoff)} хүртэлх сүүлийн авалт; авалтгүй нь аль ч эрэмбэд хамгийн сүүлд. Идэвхтэй = «Хийх» эсвэл «Хянуулах» төлөвтэй. `
      + `Харилцагчийн нэр эсвэл «›» нь дэлгүүрийн цонхыг нээнэ (сонголт өөрчлөгдөхгүй); буцахад энэ жагсаалт хэвээр.`;
    renderBar(rows);
  }
  function renderBar(rows = visible().rows) {
    const shown = new Set(rows.map(c => c.code));
    const hidden = [...sel].filter(c => !shown.has(c)).length, todo = rows.filter(c => !sel.has(c.code)).length;
    $('bar').hidden = sel.size === 0;
    $('bar-n').textContent = `${sel.size} харилцагч сонгосон`;
    $('bar-hid').textContent = hidden ? ` · ${hidden} нь одоогийн жагсаалтад харагдахгүй` : '';
    $('sel-visible').textContent = `Харагдаж буй ${rows.length} харилцагчийг сонгох`;
    $('sel-visible').disabled = todo === 0;
    $('sel-visible').hidden = rows.length === 0;
  }

  $('lhead').addEventListener('click', e => {
    const b = e.target.closest('.tc-sort');
    if (!b) return;
    const k = b.dataset.sort;
    pick.sort = pick.sort.key === k ? { key: k, dir: pick.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'desc' };
    renderList();
    $('sort-say').textContent = `Эрэмбэ: ${SORTS[k].by.toLowerCase()} ${SORTS[k][pick.sort.dir]}`;
  });
  $('list').addEventListener('change', e => {
    const cb = e.target;
    if (cb.checked) sel.add(cb.value); else sel.delete(cb.value);
    cb.closest('.tc-row').classList.toggle('on', cb.checked);
    renderBar();
  });
  // the row's empty space and numbers select too (as before); the links and the checkbox handle themselves
  $('list').addEventListener('click', e => {
    if (e.target.closest('a, label, input')) return;
    const cb = e.target.closest('.tc-row')?.querySelector('input');
    if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  $('sel-visible').addEventListener('click', () => { visible().rows.forEach(c => sel.add(c.code)); renderList(); $('to-form').focus(); });
  $('sel-clear').addEventListener('click', () => { sel.clear(); renderList(); $('sel-visible').focus(); });
  $('f-rep').addEventListener('change', e => { pick.rep = e.target.value; renderList(); });
  $('f-q').addEventListener('input', e => { pick.q = e.target.value; renderList(); });
  $('f-band').addEventListener('change', e => { pick.band = e.target.value; renderList(); });
  $('f-nobuy').addEventListener('click', () => { pick.noBuy = !pick.noBuy; renderList(); });
  $('f-notask').addEventListener('click', () => { pick.noTask = !pick.noTask; renderList(); });
  // clears search + filters; the chosen ХТ is the drawer's scope and stays, and so does the sort
  const clearFilters = () => { Object.assign(pick, fresh(pick.rep), { sort: pick.sort }); $('f-q').value = ''; $('f-band').value = ''; renderList(); $('f-q').focus(); };
  $('f-clear').addEventListener('click', clearFilters);
  $('empty-clear').addEventListener('click', clearFilters);

  // ---------- form: one plain-text task ----------
  const form = $('v-form');
  let tried = false, busy = false, lastCreated = [], createdSay = '';
  const selected = () => [...sel].map(c => custBy.get(c)).filter(Boolean);
  const repSplit = cs => { const m = new Map(); cs.forEach(c => m.set(c.rep, (m.get(c.rep) || 0) + 1)); return m; };

  $('to-form').addEventListener('click', () => {
    if (!sel.size) return;
    const cs = selected(), split = repSplit(cs);
    $('form-sub').textContent = `${cs.length} харилцагч · ${split.size} ХТ`;
    $('scope-n').textContent = `${cs.length} харилцагч · ${split.size} ХТ`;
    $('scope-reps').textContent = [...split].map(([r, n]) => `${repName(r)} ${n}`).join(' · ');
    $('scope-list').innerHTML = cs.sort((a, b) => a.rep.localeCompare(b.rep) || a.name.localeCompare(b.name))
      .map(c => `<li><b>${esc(c.name)}</b> <span class="num tc-code">${esc(c.code)}</span><span>${esc(repName(c.rep))}</span></li>`).join('');
    $('scope').open = false;
    $('i-due').min = C.today(); $('i-due').max = C.maxDue();
    show('form');
    preview(); if (tried) check();
    form.querySelector('.tc-sheet-b').scrollTop = 0;
    $('form-title').focus();
  });
  form.addEventListener('input', () => { preview(); if (tried) check(); });
  form.addEventListener('change', () => { preview(); if (tried) check(); });

  function values() {
    const f = form.elements;
    return { title: f.title.value.trim(), text: f.text.value.trim(), due: f.due.value };
  }
  // shows {field: message} next to each field
  function check(clear) {
    const e = clear ? {} : C.taskErrors(values(), $('i-due'));
    for (const k of ['title', 'text', 'due']) {
      const input = form.elements[k];
      $('e-' + k).textContent = e[k] || '';
      if (e[k]) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
    return e;
  }
  function preview() {
    const v = values(), n = selected().length;
    $('pv-main').textContent = `«${v.title || '…'}» — ${n === 1 ? '1 харилцагчид' : `${n} харилцагч тус бүрд`} нэг ижил текстээр. Хугацаа: ${v.due ? dot(v.due) : '…'}.`;
    $('pv-meta').textContent = `${n} тусдаа гүйцэтгэл үүснэ: харилцагч бүр өөрийн ХТ, төлөв, хариу, хяналтын түүхтэй. Эхний төлөв «Хийх».`;
    $('submit').textContent = `Даалгавар үүсгэх · ${n} харилцагч`;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy || !sel.size) return;
    tried = true;
    const err = check();
    const first = Object.keys(err)[0];
    if (first) { form.elements[first].focus(); return; }
    busy = true; $('submit').disabled = true;
    const cs = selected(), { task, as, saved, error } = await C.createTask(values(), cs);
    $('e-save').textContent = saved ? '' : `${error} Даалгавар үүсээгүй; бичсэн зүйл хэвээр — дахин оролдоно уу.`;
    if (!saved) { busy = false; $('submit').disabled = false; $('submit').focus(); return; }   // nothing was committed: form + selection stay
    lastCreated = as.map(a => a.id);
    createdSay = `${as.length} шинэ даалгавар үүслээ · «${task.title}» · ${repSplit(cs).size} ХТ · Төлөв «Хийх»`;
    sel.clear();
    form.reset(); tried = false; check(true);
    renderAll();
    $('done-n').textContent = `${cs.length} харилцагчид даалгавар үүслээ · ${repSplit(cs).size} ХТ`;
    $('done-g').textContent = `«${task.title}» · Хугацаа ${dot(task.due)} · Төлөв «Хийх»`;
    show('done');
    $('done-title').focus();
    busy = false; $('submit').disabled = false;
  });

  // the second click of a double-click on «Даалгавар үүсгэх» lands on this button (same spot): ignore multi-clicks.
  // The new work's rep sections open (only these), the result is said above them and the first new row comes into view.
  $('done-go').addEventListener('click', e => {
    if (e.detail > 1) return;
    opener = null;
    closeDrawer();
    gotoTasks('', '');
    tv.fresh = new Set(lastCreated);
    for (const id of lastCreated) { const a = S.asg.get(id); if (a) tv.opened.add(a.rep); }
    flash = { warn: false, text: createdSay };
    renderTasks();
    const first = document.querySelector('.tc-a.fresh .tc-arow');
    if (first) { reveal(first); first.focus({ preventScroll: true }); }
  });

  // ---------- the store window and the way back (this tab only) ----------
  // Leaving for a store: remember tab, task filters/sort, collapsed sections, open rows, the picker (filters, sort,
  // scroll), the selection, the unsent bulk form and the page scroll. Review drafts are already in sessionStorage.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-store]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // a new tab needs no way back
    const snap = {
      v: 1, tab: $('tab-tasks').getAttribute('aria-selected') === 'true' ? 'tasks' : 'perf',
      mon, tv: { rep: tv.rep, status: tv.status, per: tv.per, q: tv.q, dir: tv.dir, opened: [...tv.opened], open: [...tv.open], hist: [...tv.hist] },
      picker: dr.open && view === 'pick' ? { rep: pick.rep, q: pick.q, band: pick.band, sort: pick.sort, noBuy: pick.noBuy, noTask: pick.noTask, top: $('list-box').scrollTop, opener: opener?.id || '' } : null,
      sel: [...sel], form: { title: form.elements.title.value, text: form.elements.text.value, due: form.elements.due.value },
      y: window.scrollY, focus: a.id,
    };
    try { sessionStorage.setItem(RETURN, JSON.stringify(snap)); } catch { /* private mode: the page opens fresh on return */ }
    if (window.WS?.go(a.getAttribute('href'))) e.preventDefault();   // same webview, Telegram launch data kept
  });
  // Telegram Back (one handler, owned by workspace.js): the drawer's form → its list → closed; otherwise «Миний ажил»
  window.WS?.page({ back: () => { if (!dr.open) return false; if (view === 'form') back(); else closeDrawer(); return true; } });
  // Coming back (browser Back, or the store window's «Багийн хяналт руу буцах» → ?from=store): put everything back.
  function restore() {
    if (performance.getEntriesByType?.('navigation')[0]?.type !== 'back_forward' && !FROM_STORE) return;
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem(RETURN) || 'null'); } catch { /* unreadable: open fresh */ }
    if (!s || s.v !== 1) return;
    const str = (v, ok) => typeof v === 'string' && ok(v) ? v : '';
    const rep = v => FX.reps.some(r => r.code === v);
    history.scrollRestoration = 'manual';
    Object.assign(tv, { rep: str(s.tv?.rep, rep), status: str(s.tv?.status, v => !!STATUS[v]), per: s.tv?.per === '' ? '' : MONTHS.includes(s.tv?.per) ? s.tv.per : P.month, q: str(s.tv?.q, v => v.length <= 40), dir: s.tv?.dir === 'desc' ? 'desc' : 'asc' });
    if (MONTHS.includes(s.mon) && s.mon !== mon) { mon = s.mon; renderMain(); }
    tv.opened = new Set((s.tv?.opened || []).filter(rep));
    tv.hist = new Set((s.tv?.hist || []).filter(id => S.asg.has(id)));
    tv.open = new Set((s.tv?.open || []).filter(id => S.asg.has(id)));
    $('t-q').value = tv.q;
    (s.sel || []).filter(c => custBy.has(c)).forEach(c => sel.add(c));
    for (const k of ['title', 'text', 'due']) if (typeof s.form?.[k] === 'string') form.elements[k].value = s.form[k];
    setTab(s.tab === 'tasks' ? 'tasks' : 'perf');
    renderTasks();
    window.scrollTo(0, Number(s.y) || 0);
    const p = s.picker;
    if (p) {
      const key = SORTS[p.sort?.key] ? p.sort.key : 'cur';
      openPicker(str(p.rep, rep), $(str(p.opener, v => /^(rep-SR-[\w-]+|open-all)$/.test(v))) || null, {
        q: str(p.q, v => v.length <= 40), band: str(p.band, v => !!BANDS[v]), sort: { key, dir: p.sort?.dir === 'asc' ? 'asc' : 'desc' },
        noBuy: p.noBuy === true, noTask: p.noTask === true, top: Number(p.top) || 0,
      });
    }
    const f = typeof s.focus === 'string' && $(s.focus);
    if (f) { f.focus({ preventScroll: true }); if (!p) f.scrollIntoView({ block: 'nearest' }); }
  }

  // ---------- boot: after the store is open (IndexedDB is asynchronous), so counts, rows and the way back use stored records ----------
  $('who').textContent = `${FX.supervisor.name} · ${FX.supervisor.team}`;
  $('asof').textContent = `${py} оны ${pm}-р сар · ${dot(P.cutoff)}-ны байдлаар`;   // in the header's ⓘ
  C.ready.then(() => {
    // «Харилцагч сонгох» lives in «Цэс» (workspace.js mounts it on DOMContentLoaded, before the store opens); no shared menu → the header
    const menuPop = document.querySelector('[data-ws-menu] .ws-pop');
    if (menuPop) menuPop.append($('menu-act'));
    $('menu-act').hidden = false;
    renderMain(); renderTasks();
    setTab(startTab());
    restore();
    sayDecided();
    if (C.storage.ok) C.mutate(s => ({ write: C.migrateV1(s) })).then(renderAll);
  });
})();
