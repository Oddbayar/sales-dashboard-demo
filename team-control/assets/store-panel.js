// «Багийн хяналт» → the team part of the store window. ui/store-report loads it only for a team customer, on the same
// origin as the team page, so every view uses one browser store:
//   ?sv=<customer>[&a=<assignment>]                          supervisor (Claude 30): tasks, replies, review, a one-customer task form
//   ?rep=<demo rep>&cust=<customer>[&a=<assignment>][&at=task] rep demo (Claude 31): «Миний даалгавар» with the one reply form;
//     only this rep's own customer and assignments; no review decisions and no task form (a demo view, not authorization).
// The report is the common one the rep sees (unchanged code and numbers). Claude 40: all the task work lives in the report's own
// drawer — «Даалгавар» (header and sticky bar) opens a list view (Идэвхтэй | Өмнөх, the supervisor's «+ Даалгавар өгөх»), a row
// opens one task inside it, «← Даалгаврууд» goes back; a link with an assignment opens that task straight away. The drawer's shell,
// close, focus, scroll, Esc and Telegram Back are the report's; data, rules, drafts and the task markup are core.js.
window.TeamStorePanel = (() => {
  'use strict';
  const C = window.TeamCore, PR = window.TEAM_CONTROL_PROFILES;
  const { $, esc, dot, icon, STATUS, P, custBy, repName, S, short, badge, replyCell } = C;
  const TEAM = '../team-control/', ROUTE = '../rep-route/';
  const DECIDED = 'team-control.decided';   // this window's decisions, said once by the team page on the way back (app.js)
  const go = url => { if (!window.WS?.go(url)) location.assign(url); };   // same webview, Telegram launch data kept
  for (const href of ['tasks.css', 'store-panel.css']) {   // content-versioned in the published package (workspace deploy.js)
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = window.WS ? window.WS.asset('../team-control/assets/' + href) : '../team-control/assets/' + href; document.head.appendChild(l);
  }
  document.body.insertAdjacentHTML('afterbegin', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i-sv-task" viewBox="0 0 24 24">'
    + '<path d="M9 4h6v3H9zM9 5.5H6.5v15h11v-15H15M9 13l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></symbol></svg>');

  let cust = null, focusAid = '', rejected = false, RFX = null, SR = null, flash = null, busy = false, tried = false, rep = '';
  const fresh = new Set(), seen = new Map(), more = new Set(), hist = new Set();   // more / hist: an open «Дэлгэрэнгүй ба түүх» / «Түүх · N»
  // the list's group, the supervisor's new-task form (open, typed values, errors): kept while the drawer shows other views
  const ui = { grp: 'active', form: false, draft: { title: '', text: '', due: '' }, errs: {} };

  // URL → { identity, report data profile } | { fail: [title, text, link text, href] }. Another customer's assignment is never
  // shown; in the rep view an unknown rep, an unknown customer or another rep's customer opens nothing (no fallback).
  function resolve(params) {
    const sv = params.get('sv'), a = params.get('a');
    rep = sv === null ? (params.get('rep') || '').trim() : '';
    const code = sv !== null ? sv : params.get('cust') || '', c = custBy.get(code), p = PR?.customers?.[code];
    if (sv === null) {
      const home = C.repBy.has(rep) ? `${ROUTE}?demo=team&rep=${encodeURIComponent(rep)}` : `${ROUTE}?demo=team`;
      if (!C.repBy.has(rep)) return { fail: ['Демо ХТ олдсонгүй', `«${rep}» кодтой демо ХТ алга. Өөр ХТ-ийн мэдээлэл харуулахгүй.`, 'Демо ХТ сонгох', home] };
      if (!c || !p || c.rep !== rep) return { fail: ['Харилцагч олдсонгүй', `«${code}» кодтой харилцагч ${repName(rep)}-ийн жагсаалтад алга.`, 'Миний маршрут руу буцах', home] };
    } else if (!c || !p) return { fail: ['Харилцагч олдсонгүй', `«${sv}» кодтой харилцагч багийн жагсаалтад алга.`, 'Багийн хяналт руу буцах', `${TEAM}?from=store`] };
    cust = c;
    const asg = a ? S.asg.get(a) : null;
    focusAid = asg && asg.customer === c.code && (!rep || asg.rep === rep) ? a : '';
    rejected = !!a && !focusAid;
    const who = rep ? `?rep=${encodeURIComponent(rep)}&cust=${encodeURIComponent(c.code)}` : `?sv=${encodeURIComponent(c.code)}`;
    return {
      role: rep ? 'rep' : 'supervisor', code: c.code, profile: p.profile, fixture: p.fixture, last: p.last,
      query: who + (focusAid ? '&a=' + encodeURIComponent(focusAid) : ''),
      store: { code: c.code, name: c.name, rep_code: `${repName(c.rep)} · ${c.rep}` },
    };
  }

  const mine = () => [...S.asg.values()].filter(a => a.customer === cust.code && (!rep || a.rep === rep));
  const isActive = a => a.status === 'todo' || a.status === 'review';
  const created = a => C.ms(S.tasks.get(a.task).created_at);

  // back: the team page entry this window was opened from (browser Back does the same); otherwise open it fresh with ?from=store
  function back(e) {
    e.preventDefault();
    let ref = null;
    try { ref = document.referrer ? new URL(document.referrer) : null; } catch { /* none */ }
    // the team page's folder on this site (also under a sub-path such as /sales-dashboard-demo/)
    if (ref && ref.origin === location.origin && ref.pathname.startsWith(new URL(TEAM, location.href).pathname) && history.length > 1) history.back();
    else go(TEAM + '?from=store');
  }

  // the rep's way back: «Миний маршрут» with the state it was opened from (?ret=, kept by the store report), always for this rep
  function routeHref() {
    const u = new URL($('to-route').hidden ? ROUTE : $('to-route').getAttribute('href'), location.href);
    u.searchParams.set('demo', 'team'); u.searchParams.set('rep', rep);
    return ROUTE + u.search;
  }

  function mount(fx) {
    RFX = fx; SR = window.StoreReport;
    const m = RFX.months.find(x => x.ym === P.month), avg = RFX.averages[P.month], p = PR.customers[cust.code];
    const toTeam = $('to-route');
    if (rep) { toTeam.href = routeHref(); toTeam.hidden = false; }   // the report's own «Миний маршрут руу буцах» (data-nav)
    else {
      try { sessionStorage.removeItem(DECIDED); } catch { /* private mode */ }   // a new visit: an earlier visit's decisions are not this one's
      toTeam.removeAttribute('data-nav');
      toTeam.href = TEAM + '?from=store';
      toTeam.lastChild.textContent = 'Багийн хяналт руу буцах';
      toTeam.hidden = false;
      toTeam.addEventListener('click', back);
    }
    // «Даалгавар» in the header and in the sticky bar: the one drawer; the badge = this customer's active work (never disabled)
    const trig = (id, cls) => `<button type="button" class="prog-btn sv-go${cls}" id="${id}" aria-haspopup="dialog"><svg class="ic" aria-hidden="true"><use href="#i-sv-task"/></svg><span class="l">Даалгавар</span><span class="badge num" id="${id}-n"></span></button>`;
    $('as-btn').insertAdjacentHTML('beforebegin', trig('sv-go', ''));
    $('bar-as').insertAdjacentHTML('beforebegin', trig('sv-go2', ' bar-sv'));
    for (const id of ['sv-go', 'sv-go2']) $(id).addEventListener('click', e => openList(e.currentTarget));
    // the list's values come from this report (a guard; the builder --check proves it); the header shows no money of its own
    const same = m && m.amount === cust.cur && Math.round(avg.sum / 12) === cust.avg12 && p.last === cust.last;
    if (!same) $('head').insertAdjacentHTML('afterend', `<p class="sv-warn" role="alert">Жагсаалтын тоо энэ тайлантай таарахгүй байна — профайлыг шалгана уу.</p>`);
    $('store-dl').insertAdjacentHTML('beforeend', `<div><dt>Сүүлийн авалт</dt><dd class="num">${p.last ? dot(p.last) : 'Авалтгүй'}</dd></div>`
      + `<div><dt>ХТ</dt><dd>${esc(repName(cust.rep))} · ${esc(cust.rep)}</dd></div><div><dt>Тоон профайл</dt><dd>${esc(p.profile)} · демо (зохиомол харилцагчийн профайл)</dd></div>`);

    SR.view('sv-tasks', listView, 'Даалгаврууд');
    SR.view('sv-task', taskView);
    const body = $('dr-body');
    body.addEventListener('click', onClick);
    for (const ev of ['input', 'change']) body.addEventListener(ev, onInput);
    body.addEventListener('submit', onSubmit);
    body.addEventListener('toggle', e => {   // an open «Дэлгэрэнгүй ба түүх» / «Түүх · N» stays open through re-renders
      const d = e.target; if (!d.matches?.('details[data-more], details[data-hist]')) return;
      const set = d.dataset.more ? more : hist, id = d.dataset.more || d.dataset.hist;
      if (d.open) set.add(id); else set.delete(id);
    }, true);
    render();
    C.onChange(render);   // another tab decided, created or replied: the badge and an open drawer show it
    if (focusAid) { openList($('sv-go')); SR.push({ type: 'sv-task', key: focusAid }, null); }   // a link with an assignment: that task
    else if (rejected) openList($('sv-go'));
  }
  const ours = () => { const v = SR.current(); return v && (v.type === 'sv-tasks' || v.type === 'sv-task') ? v : null; };
  function openList(from) { flash = null; SR.open({ type: 'sv-tasks' }, from); }

  // ---------- the drawer's two views ----------
  const kind = '<svg class="ic" aria-hidden="true"><use href="#i-sv-task"/></svg>';
  const said = (res, aid) => ({ warn: res.warn, text: res.text, aid, rev: S.asg.get(aid)?.rev });
  const flashHtml = () => flash ? `<p class="tc-flash${flash.warn ? ' warn' : ''}" role="status">${icon(flash.warn ? 'review' : 'check')}<span>${esc(flash.text)}</span></p>` : '';
  function rowHtml(a) {
    const t = S.tasks.get(a.task), id = esc(a.id);
    return `<li class="sv-a s-${a.status}${rep && a.status === 'todo' ? ' need' : ''}${fresh.has(a.id) ? ' fresh' : ''}">`
      + (rep   // the rep: the title once, then one small line with the deadline, the status and the reply state
        ? `<button type="button" class="sv-arow sv-rrow" data-sv-open="${id}"><span class="sv-a-t">${esc(t.title)}</span>`
          + `<span class="sv-r2"><span class="num">Хугацаа ${short(t.due)}</span>${badge(a.status, rep)}${replyCell(a, rep)}</span>${icon('right', 'ic tc-chev')}</button>`
        : `<button type="button" class="sv-arow" data-sv-open="${id}"><span class="sv-a-t">${esc(t.title)}</span>`
          + `<span class="sv-a-g num"><span class="sv-l">Өгсөн </span>${short(t.created_at)}</span><span class="sv-a-d num"><span class="sv-l">Хугацаа </span>${short(t.due)}</span>`
          + `<span class="sv-a-s">${badge(a.status)}</span><span class="sv-a-r">${replyCell(a)}</span>${icon('right', 'ic tc-chev')}</button>`) + `</li>`;
  }
  function formHtml() {   // the one-customer task form (supervisor), from its kept draft
    const d = ui.draft, e = ui.errs, err = k => `<p class="tc-err" id="sv-e-${k}">${esc(e[k] || '')}</p>`, inv = k => e[k] ? ' aria-invalid="true"' : '';
    return `<form class="sv-form" id="sv-form" novalidate aria-labelledby="sv-form-h"><h3 id="sv-form-h">Даалгавар өгөх</h3>`
      + `<p class="sv-to">Хэнд: <b>${esc(cust.name)}</b> <span class="num tc-code">${esc(cust.code)}</span> · ХТ ${esc(repName(cust.rep))} — зөвхөн энэ харилцагчид</p>`
      + `<div class="tc-field"><label for="sv-title">Даалгаврын нэр</label><input id="sv-title" name="title" maxlength="80" autocomplete="off" value="${esc(d.title)}" aria-describedby="sv-e-title"${inv('title')}>${err('title')}</div>`
      + `<div class="tc-field"><label for="sv-text">Хийх ажил / хүлээх үр дүн</label><textarea id="sv-text" name="text" rows="3" maxlength="600" aria-describedby="sv-e-text"${inv('text')}>${esc(d.text)}</textarea>${err('text')}</div>`
      + `<div class="sv-row"><div class="tc-field"><label for="sv-due">Дуусгах хугацаа</label><input type="date" id="sv-due" name="due" value="${esc(d.due)}" min="${C.today()}" max="${C.maxDue()}" aria-describedby="sv-e-due"${inv('due')}>${err('due')}</div>`
      + `<button type="submit" class="tc-btn tc-primary" id="sv-submit"${busy ? ' disabled' : ''}>Даалгавар өгөх</button></div></form>`;
  }
  function listView() {
    const all = mine(), active = all.filter(isActive), past = all.filter(a => !isActive(a));
    active.sort((x, y) => (rep ? C.returned(y) - C.returned(x) : 0) || created(x) - created(y) || x.id.localeCompare(y.id));
    past.sort((x, y) => created(y) - created(x) || x.id.localeCompare(y.id));
    const list = ui.grp === 'past' ? past : active;
    const seg = [['active', 'Идэвхтэй', active], ['past', 'Өмнөх', past]].map(([k, l, xs]) =>
      `<button type="button" class="sv-segb" data-sv-grp="${k}" aria-pressed="${ui.grp === k}">${l} <span class="num">${xs.length}</span></button>`).join('');
    const none = ui.grp === 'past' ? 'Өмнө нь шийдвэрлэсэн ажил алга.' : rep ? 'Энэ харилцагчид таны идэвхтэй ажил алга.' : 'Идэвхтэй ажил алга.';
    return { kind: 'Даалгавар', icon: kind, title: cust.name, sub: rep ? cust.code : `${cust.code} · ХТ ${repName(cust.rep)}`,
      html: (rejected ? `<p class="sv-note">Холбоосын ажил энэ харилцагчийнх биш тул харуулаагүй.</p>` : '') + flashHtml()
        + `<div class="sv-top"><div class="sv-seg ws-seg" role="group" aria-label="Ажил">${seg}</div>`
        + (rep ? '' : `<button type="button" class="tc-btn sv-new" data-sv-new aria-expanded="${ui.form}" aria-controls="sv-form">+ Даалгавар өгөх</button>`) + `</div>`
        + (!rep && ui.form ? formHtml() : '')
        + (list.length ? `<ul class="sv-list">${list.map(rowHtml).join('')}</ul>` : `<p class="sv-none">${none}</p>`)
        + `<p class="sv-dates">Тайлангийн борлуулалт <b class="num">${dot(RFX.cutoff)}</b> хүртэл; даалгавар, хариу, шийдвэрийн огноо тус бүрдээ. Бараа авсан нь даалгавар биелснийг автоматаар батлахгүй.</p>` };
  }
  function taskView(v) {   // supervisor: the task tab's detail (task → latest reply → comment + decision → folded history); rep: its own reply view
    const a = S.asg.get(v.key);
    if (!a || a.customer !== cust.code || (rep && a.rep !== rep)) return { kind: 'Даалгавар', icon: kind, title: 'Ажил олдсонгүй', sub: cust.name, html: '<p class="sv-none">Энэ ажил энэ харилцагчийнх биш.</p>' };
    return { kind: 'Даалгавар', icon: kind, title: S.tasks.get(a.task).title, sub: `${cust.name} · ${cust.code}`,
      html: flashHtml() + `<p class="sv-dstate">${badge(a.status, rep)}${replyCell(a, rep)}</p>`
        + (rep ? C.detail(a, { rep, more: more.has(a.id) }) : C.detail(a, { tab: true, histOpen: hist.has(a.id) })) };
  }

  // ---------- events (delegated on the drawer body; only for these two views) ----------
  function onClick(e) {
    if (!ours()) return;
    const grp = e.target.closest('[data-sv-grp]'), op = e.target.closest('[data-sv-open]');
    if (grp) { ui.grp = grp.dataset.svGrp; flash = null; SR.refresh(); $('dr-body').querySelector(`[data-sv-grp="${ui.grp}"]`).focus(); return; }
    if (op) { flash = null; SR.push({ type: 'sv-task', key: op.dataset.svOpen }, op); return; }
    if (e.target.closest('[data-sv-new]')) { ui.form = !ui.form; SR.refresh(); (ui.form ? $('sv-title') : $('dr-body').querySelector('[data-sv-new]')).focus(); return; }
    if (e.target.closest('[data-send]') && e.detail > 1) { e.preventDefault(); return; }   // the 2nd click of a double-click never submits
    if (e.target.closest('#sv-submit') && e.detail > 1) { e.preventDefault(); return; }
    const b = !rep && e.target.closest('[data-act]');   // review decisions exist only in the supervisor view
    if (b) decide(b);
  }
  async function decide(b) {   // the same rules, transaction and rev check as the team page (core.review)
    const res = await C.review(b);
    if (!res) return;
    flash = said(res, b.dataset.aid);
    if (res.ok) try { const d = JSON.parse(sessionStorage.getItem(DECIDED) || '[]'); d.push({ aid: b.dataset.aid, text: res.text }); sessionStorage.setItem(DECIDED, JSON.stringify(d)); } catch { /* private mode: not said on return */ }
    render();
    $('dr').querySelector('[data-close]').focus({ preventScroll: true });
  }
  function onInput(e) {
    if (!ours()) return;
    const f = e.target.closest('#sv-form');
    if (f) { ui.draft[e.target.name] = e.target.value; if (tried) showErrs(check()); return; }
    if (rep) C.onReplyInput(e, rep); else if (e.type === 'input') C.onDraftInput(e);
  }
  const values = () => ({ title: ui.draft.title.trim(), text: ui.draft.text.trim(), due: ui.draft.due });
  const check = () => C.taskErrors(values(), $('sv-due'));
  function showErrs(errs) {   // in place: the typed values and the caret are never re-rendered
    ui.errs = errs;
    for (const k of ['title', 'text', 'due']) {
      $('sv-e-' + k).textContent = errs[k] || '';
      if (errs[k]) $('sv-' + k).setAttribute('aria-invalid', 'true'); else $('sv-' + k).removeAttribute('aria-invalid');
    }
  }
  async function onSubmit(e) {
    if (!ours()) return;
    e.preventDefault();
    const f = e.target;
    if (f.id === 'sv-form') {   // one plain-text task for this customer only (the team page's bulk selection is not read or changed)
      if (busy) return;
      tried = true;
      const errs = check(), first = Object.keys(errs)[0];
      showErrs(errs);
      if (first) { $('sv-' + first).focus(); return; }
      busy = true; $('sv-submit').disabled = true;
      const { task, as, saved, error } = await C.createTask(values(), [cust]);
      busy = false;
      if (saved) { ui.draft = { title: '', text: '', due: '' }; ui.errs = {}; ui.form = false; tried = false; ui.grp = 'active'; fresh.clear(); fresh.add(as[0].id); }   // a failure keeps what was typed
      flash = saved ? { warn: false, text: `«${task.title}» даалгавар үүслээ · Хугацаа ${dot(task.due)} · Төлөв «Хийх»` }
        : { warn: true, text: `${error} Даалгавар үүсээгүй; бичсэн зүйл хэвээр — дахин оролдоно уу.` };
      render();
      $('dr-body').scrollTop = 0;
      return;
    }
    if (rep && f.matches('form.tc-rform')) {   // the rep's reply: core.sendReply checks and writes it (one IndexedDB transaction)
      const res = await C.sendReply(f, rep, cust.code);
      if (!res) return;
      flash = said(res, f.dataset.aid);
      render();
    }
  }

  // rep view: a reply draft whose assignment changed in another tab (supervisor decision or a reply sent elsewhere) is kept and said so
  function staleDrafts(all) {
    for (const a of all) {
      const was = seen.get(a.id), d = C.replyDrafts.get(C.replyKey(rep, a.id));
      if (was !== undefined && was !== a.rev && d && !C.notices.has(a.id)) {
        C.notices.set(a.id, a.status === 'todo' ? 'Энэ ажил өөр цонхонд шинэчлэгдсэн — одоогийн төлөв, тайлбарыг шалгаад илгээнэ үү. Таны ноорог хадгалагдсан.'
          : `Энэ ажил өөр цонхонд өөрчлөгдсөн — одоо «${STATUS[a.status].t}». Таны илгээгээгүй хариу: «${(d.text || '').trim()}»`);
      }
      seen.set(a.id, a.rev);
    }
  }
  // the badges, and an open drawer view of ours (focus and caret come back to the same field)
  function render() {
    const all = mine(), n = all.filter(isActive).length, id = document.activeElement?.id;
    if (rep) staleDrafts(all);
    if (flash && !flash.warn && flash.aid && S.asg.get(flash.aid)?.rev !== flash.rev) flash = null;   // stale «… хянаж байна» never outlives the state
    for (const k of ['sv-go', 'sv-go2']) {
      $(k + '-n').textContent = n; $(k + '-n').hidden = !n;
      $(k).setAttribute('aria-label', `${rep ? 'Миний даалгавар' : 'Даалгавар'}: ${n} идэвхтэй ажил`);
    }
    if (!ours()) return;
    SR.refresh();
    const el = id && $(id);
    if (el && document.activeElement !== el && $('dr-body').contains(el)) { el.focus({ preventScroll: true }); if (el.tagName === 'TEXTAREA' || el.type === 'text') el.selectionStart = el.selectionEnd = el.value.length; }
  }

  return { resolve, mount };
})();
