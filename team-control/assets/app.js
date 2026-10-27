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

  // ---------- main page ----------
  function renderMain() {
    const { rep } = tally();
    const rows = FX.reps.map(r => ({ r, m: repMoney(r.code), k: r.packs_actual, t: rep.get(r.code), n: FX.customers.filter(c => c.rep === r.code).length }));
    // team totals: sum over reps that have a plan for that metric (the note says when that is not all five)
    const team = (val, plan) => {
      const w = rows.filter(x => plan(x.r) > 0 && val(x) != null);
      return { a: w.reduce((s, x) => s + val(x), 0), p: w.reduce((s, x) => s + plan(x.r), 0), n: w.length };
    };
    const tm = team(x => x.m, r => r.plan?.amount), tk = team(x => x.k, r => r.plan?.packs);
    const review = rows.reduce((s, x) => s + x.t.review, 0);
    const cover = t => t.n < rows.length ? `<small>${t.n}/${rows.length} ХТ-ээр тооцов; бусад нь төлөвлөгөө эсвэл мэдээлэлгүй</small>` : '';
    $('sum').innerHTML =
      `<div><dt>Багийн мөнгөн гүйцэтгэл</dt><dd>${tm.n ? metric(tm.a, tm.p, money, 'сая ₮') : '<span class="tc-na">Төлөвлөгөө байхгүй</span>'}${cover(tm)}</dd></div>`
      + `<div><dt>Биет хэмжээ · Савлагаа (ш)</dt><dd>${tk.n ? metric(tk.a, tk.p, v => nf.format(v), 'ш') : '<span class="tc-na">Төлөвлөгөө байхгүй</span>'}${cover(tk)}</dd></div>`
      + `<div class="tc-sum-t"><dt>Хянуулах даалгавар</dt><dd><b class="tc-pct num">${review}</b><span class="tc-ap">хариу ирсэн, шийдвэр хүлээж буй</span>`
      + `<button type="button" class="tc-btn tc-sum-go" id="sum-review" data-goto="review" aria-label="Хянуулах ${review} ажлыг харах"${review ? '' : ' disabled'}>Ажлуудыг харах${icon('right')}</button></dd></div>`;
    const nCell = (r, s, n) => `<td class="tc-n num">${n
      ? `<button type="button" class="tc-nbtn" id="n-${r.code}-${s}" data-goto="${s}" data-rep="${r.code}" aria-label="${esc(r.name)}: ${STATUS[s].t} ${n} — ажлуудыг харах">${n}</button>`
      : '<span class="zero">0</span>'}</td>`;
    $('reps').innerHTML = rows.map(({ r, m, k, t, n }) => `<tr data-rep="${esc(r.code)}">`
      + `<th scope="row"><button type="button" class="tc-rep" id="rep-${r.code}" aria-label="${esc(r.name)} ${esc(r.code)}: ${n} харилцагч нээх"><span><b>${esc(r.name)}</b><small class="num">${esc(r.code)} · ${n} харилцагч</small></span>${icon('right')}</button></th>`
      + `<td>${metric(m, r.plan?.amount, money, 'сая ₮')}</td><td>${metric(k, r.plan?.packs, v => nf.format(v), 'ш')}</td>`
      + ORDER.map(s => nCell(r, s, t[s])).join('') + `</tr>`).join('');
    $('tab-review').textContent = review ? `${review} хянуулах` : '';
    $('tab-review').hidden = !review;
    $('perf-note').textContent = `Гүйцэтгэл: ${dot(P.month)}.01–${pad(cutDay)} (${monthDays} хоногийн ${cutDay}). Төлөвлөгөө: бүтэн сарынх (1–${monthDays}). `
      + `Савлагаа (ш) = борлуулсан савлагааны ширхэг; литр, кг биш. Даалгаврын тоо = харилцагч тус бүрийн даалгавар; тоон дээр дарж тэр ажлуудыг нээнэ. Төлөвлөгөө ба тоонууд демо.`;
  }

  // ---------- tasks tab: one section per rep ----------
  const tv = { rep: '', status: '', q: '', dir: 'asc', closed: new Set(), open: new Set(), fresh: new Set() };
  let flash = null;   // { warn, text }: the last review outcome, shown above the list
  $('t-rep').innerHTML = `<option value="">Бүх ХТ</option>` + FX.reps.map(r => `<option value="${esc(r.code)}">${esc(r.name)} · ${esc(r.code)}</option>`).join('');

  // the opened row: shared detail + the way into that customer's store window (with this assignment as context)
  const detail = a => C.detail(a, { customer: `<a class="tc-link tc-go" id="ag-${esc(a.id)}" href="${esc(storeHref(a.customer, a.id))}" data-store="${esc(a.customer)}" data-aid="${esc(a.id)}">Харилцагчийг харах${icon('right')}</a>` });
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
  function renderTasks() {
    const q = tv.q.trim().toLowerCase(), all = [...S.asg.values()];
    const inRep = a => !tv.rep || a.rep === tv.rep;
    const match = a => {
      if (tv.status && a.status !== tv.status) return false;
      if (!q) return true;
      const t = S.tasks.get(a.task), c = custBy.get(a.customer);
      return t.title.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
    };
    const dir = tv.dir === 'asc' ? 1 : -1;
    // real date/time of «өгсөн»; ties: task id, then customer code (stable in both directions)
    const cmp = (x, y) => dir * (ms(S.tasks.get(x.task).created_at) - ms(S.tasks.get(y.task).created_at)) || x.task.localeCompare(y.task) || x.customer.localeCompare(y.customer);
    $('t-rep').value = tv.rep;
    $('t-status').innerHTML = [['', 'Бүгд'], ...ORDER.map(s => [s, STATUS[s].t])].map(([s, l]) =>
      `<button type="button" class="tc-segb" id="ts-${s || 'all'}" data-st="${s}" aria-pressed="${tv.status === s}">${s ? icon(STATUS[s].i) : ''}${l} <span class="num">${all.filter(a => inRep(a) && (!s || a.status === s)).length}</span></button>`).join('');
    $('t-dir').innerHTML = `${icon(tv.dir === 'asc' ? 'arrow-up' : 'arrow-down')}Өгсөн огноо: ${tv.dir === 'asc' ? 'хуучнаас шинэ' : 'шинээс хуучин'}`;
    const filt = !!(tv.status || q);
    const head = `<div class="tc-ahead" aria-hidden="true"><span>Өгсөн</span><span>Харилцагч</span><span>Даалгавар</span><span>Хугацаа</span><span>Төлөв</span><span>Хариу</span><span></span></div>`;
    let shown = 0, total = 0;
    const html = (tv.rep ? FX.reps.filter(r => r.code === tv.rep) : FX.reps).map(r => {
      const mine = all.filter(a => a.rep === r.code), rows = mine.filter(match).sort(cmp), open = !tv.closed.has(r.code);
      shown += rows.length; total += mine.length;
      return `<section class="tc-rsec" data-rep="${esc(r.code)}"><h3><button type="button" class="tc-rsec-h" id="rh-${esc(r.code)}" aria-expanded="${open}" aria-controls="rb-${esc(r.code)}">`
        + `${icon('down', 'ic tc-chev')}<span class="tc-rsec-n"><b>${esc(r.name)}</b><small class="num">${esc(r.code)} · ${mine.length} ажил</small></span>`
        + `<span class="tc-rsec-c">${ORDER.map(s => { const n = mine.filter(a => a.status === s).length; return `<span class="tc-cnt${n ? '' : ' zero'}">${STATUS[s].t} <b class="num">${n}</b></span>`; }).join('<span aria-hidden="true">·</span>')}</span>`
        + (filt ? `<span class="tc-rsec-f num">${rows.length} тохирсон</span>` : '') + `</button></h3>`
        + `<div class="tc-rsec-b" id="rb-${esc(r.code)}"${open ? '' : ' hidden'}>`
        + (rows.length ? head + `<ul class="tc-alist">${rows.map(rowHtml).join('')}</ul>` : `<p class="tc-rsec-none">${filt ? 'Энэ шүүлтэд тохирох ажил алга.' : 'Даалгавар өгөөгүй.'}</p>`)
        + `</div></section>`;
    }).join('');
    const none = filt && shown === 0;
    $('t-sections').innerHTML = none ? '' : html;
    $('t-empty').hidden = !none;
    const parts = [tv.rep && repName(tv.rep), tv.status && STATUS[tv.status].t, q && `«${tv.q.trim()}»`].filter(Boolean);
    $('t-res').innerHTML = `<b class="num">${filt ? `${shown} / ${total}` : total} ажил</b>`
      + (parts.length ? ` · <span class="tc-active">Шүүлт: ${parts.map(esc).join(' · ')}</span>` : ` · ${FX.reps.length} ХТ`);
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
  function gotoTasks(status, rep) {
    Object.assign(tv, { status, rep, q: '' });
    tv.closed.clear(); tv.fresh.clear(); flash = null;
    $('t-q').value = '';
    setTab('tasks'); renderTasks();
    window.scrollTo(0, 0);
    $('t-res').focus({ preventScroll: true });
  }
  const refilter = () => { flash = null; renderTasks(); };
  $('t-rep').addEventListener('change', e => { tv.rep = e.target.value; tv.closed.delete(tv.rep); refilter(); });
  $('t-status').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (b) { tv.status = b.dataset.st; refilter(); $(b.id).focus(); } });
  $('t-q').addEventListener('input', e => { tv.q = e.target.value; refilter(); });
  $('t-dir').addEventListener('click', () => { tv.dir = tv.dir === 'asc' ? 'desc' : 'asc'; refilter(); });
  const clearTasks = () => { Object.assign(tv, { rep: '', status: '', q: '' }); $('t-q').value = ''; refilter(); $('t-res').focus(); };
  $('t-clear').addEventListener('click', clearTasks);
  $('t-empty-clear').addEventListener('click', clearTasks);

  $('t-sections').addEventListener('click', e => {
    const h = e.target.closest('.tc-rsec-h');
    if (h) {
      const code = h.closest('.tc-rsec').dataset.rep, open = h.getAttribute('aria-expanded') !== 'true';
      if (open) tv.closed.delete(code); else tv.closed.add(code);
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
    if (!row) { flash.text += ' — одоогийн шүүлтэд харагдахгүй болсон'; renderTasks(); }
    (row || $('t-flash')).focus({ preventScroll: !!row });
  }

  // another tab, or the store window of this tab (after a bfcache return), changed the store: show it (filters, open rows, drafts and scroll stay)
  C.onChange(renderAll);

  // ---------- tabs (#tasks survives reload) ----------
  // Inside Telegram the hash is the launch data: it stays untouched and the tab survives in this tab's sessionStorage instead
  const LAUNCH = () => window.WS?.launchHash() || '', TAB = 'team-control.tab';
  function setTab(t, focus) {
    for (const b of document.querySelectorAll('[data-tab]')) {
      const on = b.dataset.tab === t;
      b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
      $(b.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) b.focus();
    }
    if (LAUNCH()) { history.replaceState(null, '', location.pathname + LAUNCH()); try { sessionStorage.setItem(TAB, t); } catch { /* private mode */ } }
    else history.replaceState(null, '', t === 'tasks' ? '#tasks' : location.pathname);
  }
  const startTab = () => { if (location.hash === '#tasks') return 'tasks'; try { return LAUNCH() && sessionStorage.getItem(TAB) === 'tasks' ? 'tasks' : 'perf'; } catch { return 'perf'; } };
  document.querySelector('.tc-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  document.querySelector('.tc-tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    setTab(document.querySelector('[data-tab][aria-selected="true"]').dataset.tab === 'perf' ? 'tasks' : 'perf', true);
  });
  $('p-perf').addEventListener('click', e => {
    const go = e.target.closest('[data-goto]');
    if (go) { gotoTasks(go.dataset.goto, go.dataset.rep || ''); return; }   // a task count never opens the customer drawer
    const tr = e.target.closest('tr[data-rep]');
    if (tr) openPicker(tr.dataset.rep, tr.querySelector('.tc-rep'));
  });
  $('open-all').addEventListener('click', e => openPicker('', e.currentTarget));

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
  let tried = false, busy = false, lastCreated = [];
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
    sel.clear();
    form.reset(); tried = false; check(true);
    renderAll();
    $('done-n').textContent = `${cs.length} харилцагчид даалгавар үүслээ · ${repSplit(cs).size} ХТ`;
    $('done-g').textContent = `«${task.title}» · Хугацаа ${dot(task.due)} · Төлөв «Хийх»`;
    show('done');
    $('done-title').focus();
    busy = false; $('submit').disabled = false;
  });

  // the second click of a double-click on «Даалгавар үүсгэх» lands on this button (same spot): ignore multi-clicks
  $('done-go').addEventListener('click', e => {
    if (e.detail > 1) return;
    opener = null;
    closeDrawer();
    gotoTasks('', '');
    tv.fresh = new Set(lastCreated);
    renderTasks();
    const first = document.querySelector('.tc-a.fresh .tc-arow');
    if (first) { first.scrollIntoView({ block: 'center' }); first.focus({ preventScroll: true }); }
  });

  // ---------- the store window and the way back (this tab only) ----------
  // Leaving for a store: remember tab, task filters/sort, collapsed sections, open rows, the picker (filters, sort,
  // scroll), the selection, the unsent bulk form and the page scroll. Review drafts are already in sessionStorage.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-store]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // a new tab needs no way back
    const snap = {
      v: 1, tab: $('tab-tasks').getAttribute('aria-selected') === 'true' ? 'tasks' : 'perf',
      tv: { rep: tv.rep, status: tv.status, q: tv.q, dir: tv.dir, closed: [...tv.closed], open: [...tv.open] },
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
    Object.assign(tv, { rep: str(s.tv?.rep, rep), status: str(s.tv?.status, v => !!STATUS[v]), q: str(s.tv?.q, v => v.length <= 40), dir: s.tv?.dir === 'desc' ? 'desc' : 'asc' });
    tv.closed = new Set((s.tv?.closed || []).filter(rep));
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
  $('who').textContent = `Supervisor · ${FX.supervisor.name} · ${FX.supervisor.team}`;
  $('asof').textContent = `${py} оны ${pm}-р сар · ${dot(P.cutoff)}-ны байдлаар`;
  C.ready.then(() => {
    renderMain(); renderTasks();
    setTab(startTab());
    restore();
    if (C.storage.ok) C.mutate(s => ({ write: C.migrateV1(s) })).then(renderAll);
  });
})();
