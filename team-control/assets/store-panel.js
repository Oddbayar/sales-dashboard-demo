// «Багийн хяналт» → the team section of the store window. ui/store-report loads it only for a team customer, on the same
// origin as the team page, so every view uses one browser store:
//   ?sv=<customer>[&a=<assignment>]                          supervisor (Claude 30): tasks, replies, review, a one-customer task form
//   ?rep=<demo rep>&cust=<customer>[&a=<assignment>][&at=task] rep demo (Claude 31): «Миний даалгавар» with the one reply form;
//     only this rep's own customer and assignments; no review decisions and no task form (a demo view, not authorization).
// The report above it is the common one the rep sees (unchanged code and numbers). This adds: the customer's identity and
// rep, the way back, the list's three values next to the report and that customer's tasks. Data, rules and the assignment
// markup are core.js (the same as the team page).
window.TeamStorePanel = (() => {
  'use strict';
  const C = window.TeamCore, PR = window.TEAM_CONTROL_PROFILES;
  const { $, esc, dot, icon, STATUS, P, custBy, repName, S, short, badge, replyCell, nf } = C;
  const TEAM = '../team-control/', ROUTE = '../rep-route/';
  const go = url => { if (!window.WS?.go(url)) location.assign(url); };   // same webview, Telegram launch data kept
  for (const href of ['tasks.css', 'store-panel.css']) {   // content-versioned in the published package (workspace deploy.js)
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = window.WS ? window.WS.asset('../team-control/assets/' + href) : '../team-control/assets/' + href; document.head.appendChild(l);
  }
  document.body.insertAdjacentHTML('afterbegin', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i-sv-task" viewBox="0 0 24 24">'
    + '<path d="M9 4h6v3H9zM9 5.5H6.5v15h11v-15H15M9 13l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></symbol></svg>');

  let cust = null, focusAid = '', rejected = false, RFX = null, flash = null, busy = false, tried = false, rep = '', toTask = false;
  const open = new Set(), fresh = new Set(), seen = new Map(), more = new Set();   // more: rows whose «Дэлгэрэнгүй ба түүх» is open

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
      toTask = params.get('at') === 'task';
    } else if (!c || !p) return { fail: ['Харилцагч олдсонгүй', `«${sv}» кодтой харилцагч багийн жагсаалтад алга.`, 'Багийн хяналт руу буцах', `${TEAM}?from=store`] };
    cust = c;
    const asg = a ? S.asg.get(a) : null;
    focusAid = asg && asg.customer === c.code && (!rep || asg.rep === rep) ? a : '';
    rejected = !!a && !focusAid;
    if (focusAid) open.add(focusAid);
    const who = rep ? `?rep=${encodeURIComponent(rep)}&cust=${encodeURIComponent(c.code)}` : `?sv=${encodeURIComponent(c.code)}`;
    return {
      role: rep ? 'rep' : 'supervisor', code: c.code, profile: p.profile, fixture: p.fixture, last: p.last,
      query: who + (focusAid ? '&a=' + encodeURIComponent(focusAid) : ''),
      store: { code: c.code, name: c.name, rep_code: `${repName(c.rep)} · ${c.rep}` },
    };
  }

  const mine = () => [...S.asg.values()].filter(a => a.customer === cust.code && (!rep || a.rep === rep));
  const created = a => C.ms(S.tasks.get(a.task).created_at);
  const money = v => nf.format(Math.round(v)) + ' ₮';

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
    RFX = fx;
    const m = RFX.months.find(x => x.ym === P.month), avg = RFX.averages[P.month], p = PR.customers[cust.code];
    // header: the way back, the shortcut to the task section, and the list's three values read from this report
    const toTeam = $('to-route');
    if (rep) { toTeam.href = routeHref(); toTeam.hidden = false; }   // the report's own «Миний маршрут руу буцах» (data-nav)
    else {
      toTeam.removeAttribute('data-nav');
      toTeam.href = TEAM + '?from=store';
      toTeam.lastChild.textContent = 'Багийн хяналт руу буцах';
      toTeam.hidden = false;
      toTeam.addEventListener('click', back);
    }
    $('as-btn').insertAdjacentHTML('beforebegin', `<button type="button" class="prog-btn sv-go" id="sv-go" aria-controls="sv"><svg class="ic" aria-hidden="true"><use href="#i-sv-task"/></svg>Даалгавар<span class="badge num" id="sv-go-n"></span></button>`);
    document.querySelector('.bar-nav').insertAdjacentHTML('beforeend', `<button type="button" id="sv-go2" aria-controls="sv">Даалгавар</button>`);
    const same = m && m.amount === cust.cur && Math.round(avg.sum / 12) === cust.avg12 && p.last === cust.last;   // guard; the builder --check proves it
    $('head').insertAdjacentHTML('beforeend', `<div class="sv-ctx">`
      + `<p class="sv-kpi num" id="sv-kpi"><span>Энэ сар <b>${money(m.amount)}</b> <small>${dot(m.start).slice(5)}–${m.end.slice(8)}</small></span>`
      + `<span>Сарын дундаж <b>${money(avg.avg)}</b> <small>${dot(avg.months[0])}–${dot(avg.months[11])}</small></span>`
      + `<span>Сүүлийн авалт <b>${p.last ? dot(p.last) : 'Авалтгүй'}</b></span></p>`
      + (same ? '' : `<p class="sv-warn" role="alert">Жагсаалтын тоо энэ тайлантай таарахгүй байна — профайлыг шалгана уу.</p>`)
      + `<div id="sv-focus"></div></div>`);
    $('store-dl').insertAdjacentHTML('beforeend', `<div><dt>Тоон профайл</dt><dd>${esc(p.profile)} · демо (зохиомол харилцагчийн профайл)</dd></div>`);

    const dates = rep
      ? `Дээрх борлуулалт <b class="num">${dot(RFX.cutoff)}</b> хүртэл. Даалгавар өгсөн, таны хариу, Supervisor-ийн шийдвэрийн огноо доор тусдаа. `
        + 'Хариу илгээх нь дэлгүүрт очсон бүртгэл биш; бараа авсан нь даалгавар биелснийг автоматаар батлахгүй.'
      : `Дээрх борлуулалт <b class="num">${dot(RFX.cutoff)}</b> хүртэл. Даалгавар өгсөн, хариу ирсэн, шийдвэр гаргасан огноо бүр доор тусдаа; `
        + `${dot(RFX.cutoff)}-ны тайлан түүнээс хойшх хариуг батлахгүй. Бараа авсан нь байршуулалт эсвэл даалгавар биелснийг автоматаар батлахгүй.`;
    const foot = rep ? `<a class="back-btn" id="sv-back" href="${esc(routeHref())}" data-nav><svg class="ic" aria-hidden="true"><use href="#i-left"/></svg>Миний маршрут руу буцах</a>`
      : `<a class="back-btn" id="sv-back" href="${TEAM}?from=store"><svg class="ic" aria-hidden="true"><use href="#i-left"/></svg>Багийн хяналт руу буцах</a>`;
    // the rep's section starts with the work itself (Claude 32): no second identity line (the header has it); the counts and
    // the date note move under the list
    $('report').insertAdjacentHTML('afterend', `<section class="sv" id="sv" aria-labelledby="sv-h" tabindex="-1">`
      + (rep ? `<div class="sv-h"><h2 id="sv-h">Миний даалгавар</h2></div>`
        : `<div class="sv-h"><div><h2 id="sv-h">Даалгавар ба хариу</h2><p class="sv-sub">${esc(cust.name)} · <span class="num">${esc(cust.code)}</span> · ХТ ${esc(repName(cust.rep))} <span class="num">(${esc(cust.rep)})</span></p></div>`
          + `<p class="sv-rep num" id="sv-rep"></p></div><p class="sv-dates">${dates}</p>`)
      + (rejected ? `<p class="sv-note">Холбоосын ажил энэ харилцагчийнх биш тул харуулаагүй.</p>` : '')
      + `<p class="tc-flash" id="sv-flash" role="status" tabindex="-1" hidden></p>`
      + `<div id="sv-tasks"></div>`
      + (rep ? `<p class="sv-rep num" id="sv-rep"></p><p class="sv-dates">${dates}</p>` : '')
      + (rep ? '' : `<form class="sv-form" id="sv-form" novalidate aria-labelledby="sv-form-h"><h3 id="sv-form-h">Даалгавар өгөх</h3>`
      + `<p class="sv-to">Хэнд: <b>${esc(cust.name)}</b> <span class="num tc-code">${esc(cust.code)}</span> · ХТ ${esc(repName(cust.rep))} — зөвхөн энэ харилцагчид</p>`
      + `<div class="tc-field"><label for="sv-title">Даалгаврын нэр</label><input id="sv-title" name="title" maxlength="80" autocomplete="off" aria-describedby="sv-e-title"><p class="tc-err" id="sv-e-title"></p></div>`
      + `<div class="tc-field"><label for="sv-text">Хийх ажил / хүлээх үр дүн</label><textarea id="sv-text" name="text" rows="3" maxlength="600" aria-describedby="sv-e-text"></textarea><p class="tc-err" id="sv-e-text"></p></div>`
      + `<div class="sv-row"><div class="tc-field"><label for="sv-due">Дуусгах хугацаа</label><input type="date" id="sv-due" name="due" aria-describedby="sv-e-due"><p class="tc-err" id="sv-e-due"></p></div>`
      + `<button type="submit" class="tc-btn tc-primary" id="sv-submit">Даалгавар өгөх</button></div></form>`)
      + `<p class="sv-foot">${foot}</p></section>`);
    if (!rep) $('sv-back').addEventListener('click', back);
    for (const id of ['sv-go', 'sv-go2', 'sv-focus']) $(id).addEventListener('click', e => { if (id !== 'sv-focus' || e.target.closest('[data-sv-to]')) goTask(); });
    $('sv-tasks').addEventListener('click', onTasks);
    if (rep) {
      for (const ev of ['input', 'change']) $('sv-tasks').addEventListener(ev, e => C.onReplyInput(e, rep));
      $('sv-tasks').addEventListener('click', e => { if (e.target.closest('[data-send]') && e.detail > 1) e.preventDefault(); });   // the 2nd click of a double-click never submits
      $('sv-tasks').addEventListener('submit', onReply);
      $('sv-tasks').addEventListener('toggle', e => { const d = e.target.closest?.('details[data-more]'); if (d) { if (d.open) more.add(d.dataset.more); else more.delete(d.dataset.more); } }, true);
    } else {
      $('sv-tasks').addEventListener('input', C.onDraftInput);
      bindForm();
    }
    render();
    C.onChange(render);   // another tab decided, created or replied: show it here too
    if (toTask) {   // from a route/list task link: straight to that work; once the report's fonts are in, once more if nobody scrolled
      let y = -1;
      requestAnimationFrame(() => { goTask(true); y = scrollY; });
      document.fonts?.ready.then(() => { if (y < 0 || Math.abs(scrollY - y) < 2) goTask(true); });
    }
  }
  // to the section (and to the reviewed assignment's reply, when opened from one)
  function goTask(now) {   // now: the landing from a link (an instant jump: a smooth one stops short while the report above settles)
    const t = (focusAid && $('svr-' + focusAid)) || $('sv');
    (t.closest('.sv-a') || t).scrollIntoView({ block: 'start', behavior: now === true || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    t.focus({ preventScroll: true });
  }

  function row(a) {
    const t = S.tasks.get(a.task), id = esc(a.id), on = open.has(a.id), focus = a.id === focusAid;
    return `<li class="sv-a s-${a.status}${rep && a.status === 'todo' ? ' need' : ''}${focus ? ' is-focus' : ''}${fresh.has(a.id) ? ' fresh' : ''}">`
      + (focus && !rep ? `<p class="sv-flag">Хянаж буй ажил · Багийн хяналтаас нээсэн</p>` : '')   // rep: the outlined row is enough
      + (rep   // the rep: the title once, then one small line with the deadline, the status and the reply state
        ? `<button type="button" class="sv-arow sv-rrow" id="svr-${id}" data-aid="${id}" aria-expanded="${on}" aria-controls="svd-${id}">`
          + `<span class="sv-a-t">${esc(t.title)}</span><span class="sv-r2"><span class="num">Хугацаа ${short(t.due)}</span>${badge(a.status)}${replyCell(a, rep)}</span>${icon('down', 'ic tc-chev')}</button>`
        : `<button type="button" class="sv-arow" id="svr-${id}" data-aid="${id}" aria-expanded="${on}" aria-controls="svd-${id}">`
          + `<span class="sv-a-g num"><span class="sv-l">Өгсөн </span>${short(t.created_at)}</span><span class="sv-a-t">${esc(t.title)}</span>`
          + `<span class="sv-a-d num"><span class="sv-l">Хугацаа </span>${short(t.due)}</span><span class="sv-a-s">${badge(a.status)}</span><span class="sv-a-r">${replyCell(a)}</span>${icon('down', 'ic tc-chev')}</button>`)
      + `<div class="sv-det" id="svd-${id}"${on ? '' : ' hidden'}>${on ? C.detail(a, { rep, more: more.has(a.id) }) : ''}</div></li>`;
  }
  // rep view: a reply draft whose assignment changed in another tab (supervisor decision or a reply sent elsewhere) is kept and said so
  function staleDrafts(all) {
    for (const a of all) {
      const was = seen.get(a.id), d = C.replyDrafts.get(C.replyKey(rep, a.id));
      if (was !== undefined && was !== a.rev && d && !C.notices.has(a.id)) {
        C.notices.set(a.id, a.status === 'todo' ? 'Энэ ажил өөр цонхонд шинэчлэгдсэн — одоогийн төлөв, тайлбарыг шалгаад илгээнэ үү. Таны ноорог хадгалагдсан.'
          : `Энэ ажил өөр цонхонд өөрчлөгдсөн — одоо «${STATUS[a.status].t}». Таны илгээгээгүй хариу: «${(d.text || '').trim()}»`);
        open.add(a.id);
      }
      seen.set(a.id, a.rev);
    }
  }
  function render() {
    const id = document.activeElement?.id;
    const all = mine(), active = all.filter(a => a.status === 'todo' || a.status === 'review'), past = all.filter(a => !active.includes(a));
    const f = focusAid && S.asg.get(focusAid);
    if (rep) staleDrafts(all);
    const first = (x, y) => (x.id === focusAid ? -1 : y.id === focusAid ? 1 : 0);
    active.sort((x, y) => first(x, y) || (rep ? C.returned(y) - C.returned(x) : 0) || created(x) - created(y) || x.id.localeCompare(y.id));
    past.sort((x, y) => first(x, y) || created(y) - created(x) || x.id.localeCompare(y.id));
    const head = `<div class="sv-ahead" aria-hidden="true"><span>Өгсөн</span><span>Даалгавар</span><span>Хугацаа</span><span>Төлөв</span><span>${rep ? 'Таны хариу' : 'Хариу'}</span><span></span></div>`;
    const group = (title, list, none) => `<h3 class="sv-gh">${title} <span class="num">${list.length}</span></h3>`
      + (list.length ? (rep ? '' : head) + `<ul class="sv-list">${list.map(row).join('')}</ul>` : `<p class="sv-none">${none}</p>`);
    // rep: only the groups that have work (an empty heading would push the work down on a small tablet)
    const repGroups = [['Хариу өгөх', active.filter(a => a.status === 'todo')], ['Хянуулж байгаа', active.filter(a => a.status === 'review')], ['Шийдвэрлэсэн', past]].filter(g => g[1].length);
    $('sv-tasks').innerHTML = rep
      ? (repGroups.length ? repGroups.map(g => group(g[0], g[1])).join('') : '<p class="sv-none">Энэ харилцагчид таны даалгавар алга.</p>')
      : group('Идэвхтэй ажил', active, 'Идэвхтэй ажил алга.') + group('Өмнөх ажил', past, 'Өмнө нь шийдвэрлэсэн ажил алга.');
    const t = C.tally().rep.get(cust.rep);
    $('sv-rep').innerHTML = rep
      ? `Таны бүх ажил: ${[['todo', 'Хариу өгөх'], ['review', 'Хянуулж байгаа'], ['done', 'Баталгаажсан'], ['failed', 'Биелээгүй']].map(([s, l]) => `${l} <b>${t[s]}</b>`).join(' · ')}`
      : `ХТ ${esc(repName(cust.rep))}-ийн бүх харилцагч: ${C.ORDER.map(s => `${STATUS[s].t} <b>${t[s]}</b>`).join(' · ')}`;
    $('sv-go-n').textContent = active.length; $('sv-go-n').hidden = !active.length;
    $('sv-go').setAttribute('aria-label', `${rep ? 'Миний даалгавар' : 'Даалгавар ба хариу'}: ${active.length} идэвхтэй ажил`);
    const go = !f ? '' : rep ? (f.status === 'todo' ? 'Хариу өгөх' : 'Ажлыг харах') : (f.status === 'review' ? 'Хариу ба шийдвэр' : 'Ажлыг харах');
    $('sv-focus').innerHTML = f ? `<p class="sv-fbar"><span class="sv-fk">${rep ? 'Сонгосон ажил' : 'Хянаж буй ажил'}</span><b>«${esc(S.tasks.get(f.task).title)}»</b>${badge(f.status)}${replyCell(f, rep)}`
      + `<button type="button" class="tc-btn sv-fgo" data-sv-to>${go}${icon('down')}</button></p>` : '';
    $('sv-flash').innerHTML = flash ? `${icon(flash.warn ? 'review' : 'check')}<span>${esc(flash.text)}</span>` : '';
    $('sv-flash').classList.toggle('warn', !!flash?.warn);
    $('sv-flash').hidden = !flash;
    const el = id && $(id);
    if (el && document.activeElement !== el) { el.focus({ preventScroll: true }); if (el.tagName === 'TEXTAREA') el.selectionStart = el.selectionEnd = el.value.length; }
  }

  async function onTasks(e) {
    const r = e.target.closest('.sv-arow');
    if (r) {
      const aid = r.dataset.aid, on = !open.has(aid);
      if (on) open.add(aid); else open.delete(aid);
      r.setAttribute('aria-expanded', on);
      const d = $('svd-' + aid); d.hidden = !on; d.innerHTML = on ? C.detail(S.asg.get(aid), { rep, more: more.has(aid) }) : '';
      return;
    }
    const b = !rep && e.target.closest('[data-act]');   // review decisions exist only in the supervisor view
    if (!b) return;
    const aid = b.dataset.aid, res = await C.review(b);   // the same rules, transaction and rev check as the team page
    if (!res) return;
    flash = { warn: res.warn, text: res.text };
    open.add(aid);
    render();
    $('svr-' + aid).focus({ preventScroll: true });
  }

  // the rep's reply: core.sendReply checks and writes it (rep, customer, «Хийх», the shown rev; in one IndexedDB transaction)
  async function onReply(e) {
    const f = e.target.closest('form.tc-rform');
    if (!f) return;
    e.preventDefault();
    const aid = f.dataset.aid, res = await C.sendReply(f, rep, cust.code);
    if (!res) return;
    flash = { warn: res.warn, text: res.text };
    open.add(aid);
    render();
    $('svr-' + aid)?.focus({ preventScroll: true });
  }

  // one plain-text task for this customer only (the team page's bulk selection is not read or changed)
  function bindForm() {
    const form = $('sv-form'), due = $('sv-due');
    due.min = C.today(); due.max = C.maxDue();
    const values = () => ({ title: form.elements.title.value.trim(), text: form.elements.text.value.trim(), due: due.value });
    const check = clear => {
      const e = clear ? {} : C.taskErrors(values(), due);
      for (const k of ['title', 'text', 'due']) {
        $('sv-e-' + k).textContent = e[k] || '';
        if (e[k]) form.elements[k].setAttribute('aria-invalid', 'true'); else form.elements[k].removeAttribute('aria-invalid');
      }
      return e;
    };
    form.addEventListener('input', () => { if (tried) check(); });
    form.addEventListener('change', () => { if (tried) check(); });
    $('sv-submit').addEventListener('click', e => { if (e.detail > 1) e.preventDefault(); });   // the 2nd click of a double-click never submits
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      tried = true;
      const first = Object.keys(check())[0];
      if (first) { form.elements[first].focus(); return; }
      busy = true; $('sv-submit').disabled = true;
      const { task, as, saved, error } = await C.createTask(values(), [cust]);
      if (saved) { form.reset(); tried = false; check(true); fresh.clear(); fresh.add(as[0].id); }   // a failure keeps what was typed
      flash = saved ? { warn: false, text: `«${task.title}» даалгавар үүслээ · ${cust.name} · Хугацаа ${dot(task.due)} · Төлөв «Хийх»` }
        : { warn: true, text: `${error} Даалгавар үүсээгүй; бичсэн зүйл хэвээр — дахин оролдоно уу.` };
      render();
      busy = false; $('sv-submit').disabled = false;
      $('sv-flash').scrollIntoView({ block: 'start' });   // the confirmation and, right under it, the new row (below the sticky bar)
      $('sv-flash').focus({ preventScroll: true });
    });
  }

  return { resolve, mount };
})();
