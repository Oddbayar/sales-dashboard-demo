// «Багийн хяналт» — the one task store and review logic, shared by the team-control page (app.js) and the supervisor
// section of the store window (store-panel.js), so both read and write the same data with the same rules.
// Data: data/fixture.js + this browser's store (IndexedDB «team-control»; every action is one transaction, Claude 32).
// Tasks: one plain-text task source per creation, one assignment per customer with its own rep, status, rev and history.
window.TeamCore = (() => {
  'use strict';
  const FX = window.TEAM_CONTROL_FIXTURE;
  const KEY = 'team-control.v2';                   // the Claude 29–31 localStorage store: imported once into IndexedDB, never written
  const V1 = 'team-control.tasks.v1';              // Claude 28 store: read once for the migration, never written
  const V1_BACKUP = 'team-control.tasks.v1.backup';
  const DRAFTS = 'team-control.drafts';            // unsent review comments: this tab only (sessionStorage), kept across the store window
  const REPLY_DRAFTS = 'team-control.reply-drafts'; // a rep's unsent replies (Claude 31): its own key, "<rep>|<assignment>" → { rep, aid, result, text, rev }
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat('en-US');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dot = iso => iso ? iso.replace(/-/g, '.') : '';
  const pad = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const icon = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  // a UUID v4 from crypto.getRandomValues (crypto.randomUUID needs a secure context, which a plain-http LAN address is not)
  const uid = () => {
    const b = crypto.getRandomValues(new Uint8Array(16)), h = [];
    b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128;
    for (const x of b) h.push(x.toString(16).padStart(2, '0'));
    return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
  };

  // task icons, added to the page's sprite where missing (the store window has its own sprite)
  const SYMBOLS = {
    down: '<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    undo: '<path d="M9 7L5 11l4 4M5 11h9a5 5 0 010 10h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    reply: '<path d="M4 5h16v11H9l-5 4V5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
    todo: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/>',
    review: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v4.5l3 1.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    done: '<circle cx="12" cy="12" r="8.5" fill="currentColor"/><path d="M8 12.3l2.7 2.7L16.2 9.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    failed: '<circle cx="12" cy="12" r="8.5" fill="currentColor"/><path d="M9 9l6 6M15 9l-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    store: '<path d="M4 10l1.5-5h13L20 10M4 10h16M4 10v9h16v-9M9 19v-5h6v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
  };
  const missing = Object.keys(SYMBOLS).filter(k => !$('i-' + k));
  if (missing.length) document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${missing.map(k => `<symbol id="i-${k}" viewBox="0 0 24 24">${SYMBOLS[k]}</symbol>`).join('')}</svg>`);

  const STATUS = { todo: { t: 'Хийх', i: 'todo' }, review: { t: 'Хянуулах', i: 'review' }, done: { t: 'Баталгаажсан', i: 'done' }, failed: { t: 'Биелээгүй', i: 'failed' } };
  const ORDER = ['todo', 'review', 'done', 'failed'];
  const RESULT = { done: 'Гүйцэтгэсэн', not_done: 'Биелүүлээгүй' };
  const NEXT = { assigned: 'todo', reply: 'review', confirm: 'done', rework: 'todo', close_failed: 'failed' };   // status after each event
  const KIND = { assigned: 'Даалгавар өгсөн', confirm: 'Баталгаажуулсан', rework: 'Дахин ажиллуулахаар буцаасан', close_failed: 'Биелээгүйгээр хаасан' };
  const ACT = { confirm: { t: 'Баталгаажуулах', i: 'check' }, rework: { t: 'Дахин ажиллуулах', i: 'undo', needs: true }, close_failed: { t: 'Биелээгүйгээр хаах', i: 'x', needs: true } };

  const P = FX.period;
  const [py, pm] = P.month.split('-').map(Number);
  const monthDays = new Date(py, pm, 0).getDate();
  const cutDay = Number(P.cutoff.slice(8));
  const repBy = new Map(FX.reps.map(r => [r.code, r]));
  const custBy = new Map(FX.customers.map(c => [c.code, c]));
  const prodBy = new Map(FX.products.map(p => [p.sku, p]));
  const repName = code => repBy.get(code)?.name || code;

  // ---------- dates: a legacy date-only value stays date-only (no time is invented) ----------
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const ms = s => isDate(s) ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)).getTime() : Date.parse(s);
  const dayOf = s => isDate(s) ? s : isoOf(new Date(s));
  const when = s => { if (isDate(s)) return dot(s); const d = new Date(s); return `${dot(isoOf(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const short = s => { const d = dayOf(s); return d.slice(0, 4) === String(py) ? d.slice(5).replace('-', '.') : dot(d); };

  // ---------- base data: fixture v1-shape tasks (converted) + fixture v2 examples; read-only ----------
  const validV1 = g => g && typeof g.id === 'string' && (g.type === 'placement' || g.type === 'general') && typeof g.title === 'string'
    && typeof g.created === 'string' && typeof g.due === 'string' && Array.isArray(g.items) && g.items.length
    && g.items.every(i => i && custBy.has(i.customer) && ['todo', 'review', 'done'].includes(i.status));
  // v1 placement/general → one plain-text task; product, target and note become readable text. Kept: ids, statuses,
  // customers, created/due dates, and the original fields under `legacy`. No history is made up.
  function fromLegacy(g, prefix) {
    const id = prefix + g.id;
    const text = g.type === 'placement'
      ? `«${prodBy.get(g.sku)?.name || g.sku}» бүтээгдэхүүнийг харилцагч бүрд хамгийн багадаа ${g.min_qty} ш байршуулна.${g.note ? ' ' + g.note : ''}`
      : g.body || '';
    const legacy = { from: prefix ? 'v1-storage' : 'fixture', id: g.id, type: g.type, ...(g.type === 'placement' ? { sku: g.sku, min_qty: g.min_qty, note: g.note || '' } : {}) };
    return {
      task: { id, title: g.title, text, created_at: g.created, due: g.due, legacy },
      assignments: g.items.map(i => ({ id: `${id}:${i.customer}`, task: id, customer: i.customer, rep: custBy.get(i.customer).rep, status: i.status, rev: 0, legacy: true, history: [] })),
    };
  }
  const base = { tasks: new Map(), asg: new Map() };
  for (const g of FX.tasks.filter(validV1)) { const x = fromLegacy(g, ''); base.tasks.set(x.task.id, x.task); x.assignments.forEach(a => base.asg.set(a.id, a)); }
  for (const t of FX.v2?.tasks || []) base.tasks.set(t.id, t);
  for (const a of FX.v2?.assignments || []) base.asg.set(a.id, a);

  // ---------- store: IndexedDB «team-control» (Claude 32) — the one authoritative task store ----------
  // Object stores: tasks and assignments (keyPath id) and meta ('migrations'). Fixture data is never stored; a stored assignment
  // replaces the fixture one with the same id. Every action is ONE readwrite transaction that reads the latest records, checks
  // status, rev and the rules, and writes: atomic across tabs without Web Locks (also on plain-http LAN, where navigator.locks
  // does not exist). Success is reported only after the transaction has committed; a failed one writes nothing.
  // The first open (the version-1 upgrade, which the browser runs for one tab only) imports localStorage «team-control.v2» once;
  // that key is never written or removed afterwards. Other tabs hear about a commit on a BroadcastChannel and re-read.
  const DB = 'team-control', STORES = ['tasks', 'assignments', 'meta'];
  const empty = () => ({ schema: 2, tasks: {}, assignments: {}, migrations: {} });
  let store = empty(), db = null;
  const storage = { ok: false, reason: 'Хадгалалт нээгдэж байна.' };
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('team-control.store') : null;
  // inside the upgrade transaction (all or nothing): every task/assignment record of the old store, with ids, history, migration marks
  function importLegacy(tx) {
    const rec = { from: KEY, at: new Date().toISOString(), tasks: 0, assignments: 0 };
    let raw = null, old = null;
    try { raw = localStorage.getItem(KEY); } catch { rec.blocked = true; }
    if (raw != null) {
      try { const v = JSON.parse(raw); if (v && v.schema === 2 && v.tasks && v.assignments) old = v; } catch { /* below */ }
      if (!old) { rec.unreadable = true; try { if (localStorage.getItem(KEY + '.unreadable') == null) localStorage.setItem(KEY + '.unreadable', raw); } catch { /* ignore */ } }
    }
    for (const t of Object.values(old?.tasks || {})) if (t && typeof t.id === 'string') { tx.objectStore('tasks').put(t); rec.tasks++; }
    for (const x of Object.values(old?.assignments || {})) if (x && typeof x.id === 'string') { tx.objectStore('assignments').put(x); rec.assignments++; }
    tx.objectStore('meta').put({ ...(old?.migrations || {}), v2_import: rec }, 'migrations');
  }
  function openDb() {
    return new Promise(res => {
      const fail = why => { db = null; storage.ok = false; storage.reason = why; res(false); };
      let o, why = '';
      try { o = indexedDB.open(DB, 1); } catch (e) { fail(`IndexedDB энэ browser-т ажиллахгүй байна (${e?.name || e}).`); return; }
      o.onupgradeneeded = () => {   // a failed import aborts the whole upgrade: no half-made database, the old value is kept for the next try
        try {
          const d = o.result;
          d.createObjectStore('tasks', { keyPath: 'id' }); d.createObjectStore('assignments', { keyPath: 'id' }); d.createObjectStore('meta');
          importLegacy(o.transaction);
        } catch (e) { why = `хуучин өгөгдлийг шилжүүлж чадсангүй: ${e?.name || e}`; o.transaction.abort(); }
      };
      o.onsuccess = () => {
        db = o.result; storage.ok = true; storage.reason = '';
        db.onversionchange = () => { db.close(); db = null; storage.ok = false; storage.reason = 'Хадгалалтыг өөр цонхонд устгаж эсвэл шинэчилж байна.'; banner(); };
        res(true);
      };
      o.onerror = () => fail(`IndexedDB нээгдсэнгүй (${why || o.error?.name || 'алдаа'}).`);
    });
  }
  // the whole store (tens of records), read inside a transaction → done(s)
  function load(tx, done) {
    const s = empty();
    let n = 3;
    const fin = () => { if (--n === 0) done(s); };
    tx.objectStore('tasks').getAll().onsuccess = e => { for (const t of e.target.result) s.tasks[t.id] = t; fin(); };
    tx.objectStore('assignments').getAll().onsuccess = e => { for (const a of e.target.result) s.assignments[a.id] = a; fin(); };
    tx.objectStore('meta').get('migrations').onsuccess = e => { s.migrations = e.target.result || {}; fin(); };
  }
  function readAll() {
    return new Promise(res => {
      let tx, s = null;
      try { tx = db.transaction(STORES, 'readonly'); } catch { res(null); return; }
      load(tx, x => { s = x; });
      tx.oncomplete = () => res(s); tx.onabort = () => res(null);
    });
  }
  // one action = one readwrite transaction: the latest records → fn(s) checks and changes them → the changed records are written.
  // → fn's result (+ saved: true) once committed | { ok: false, saved: false, error } when nothing could be written
  function mutate(fn) {
    return new Promise(res => {
      const failed = error => res({ ok: false, saved: false, error });
      if (!db) { failed(storage.reason || 'IndexedDB ажиллахгүй байна.'); return; }
      let tx, r = {}, s = null, err = '';
      try { tx = db.transaction(STORES, 'readwrite'); } catch (e) { failed(`Хадгалалт эхэлсэнгүй (${e?.name || e}).`); return; }
      load(tx, cur => {
        s = cur;
        const was = m => new Map(Object.values(m).map(x => [x.id, JSON.stringify(x)]));
        const t0 = was(s.tasks), a0 = was(s.assignments), m0 = JSON.stringify(s.migrations);
        try {
          r = fn(s) || {};
          if (r.write === false) return;
          for (const t of Object.values(s.tasks)) if (t0.get(t.id) !== JSON.stringify(t)) tx.objectStore('tasks').put(t);
          for (const a of Object.values(s.assignments)) if (a0.get(a.id) !== JSON.stringify(a)) tx.objectStore('assignments').put(a);
          if (m0 !== JSON.stringify(s.migrations)) tx.objectStore('meta').put(s.migrations, 'migrations');
        } catch (e) { err = `${e?.name || 'Алдаа'}${e?.message ? ': ' + e.message : ''}`; try { tx.abort(); } catch { /* already over */ } }
      });
      tx.oncomplete = () => {
        store = s; rebuild();
        if (r.write !== false) { r.saved = true; bc?.postMessage('changed'); }
        res(r);
      };
      tx.onabort = () => failed(`Хадгалж чадсангүй (${err || tx.error?.name || 'transaction цуцлагдсан'}).`);
    });
  }
  // one-time, versioned import of Claude 28's v1 array: raw copy kept, ids deterministic (V1-<id>), never re-imported
  function migrateV1(s) {
    if (s.migrations.v1) return false;
    let raw = null;
    try { raw = localStorage.getItem(V1); } catch { return false; }
    if (raw == null) return false;
    try { if (localStorage.getItem(V1_BACKUP) == null) localStorage.setItem(V1_BACKUP, raw); } catch { return false; }
    let groups = [];
    try { const v = JSON.parse(raw); if (Array.isArray(v)) groups = v; } catch { /* nothing importable; the backup keeps it */ }
    let n = 0, ok = 0;
    for (const g of groups.filter(validV1)) {
      const x = fromLegacy(g, 'V1-');
      if (s.tasks[x.task.id]) continue;
      s.tasks[x.task.id] = x.task; ok++;
      for (const a of x.assignments) if (!s.assignments[a.id]) { s.assignments[a.id] = a; n++; }
    }
    s.migrations.v1 = { at: new Date().toISOString(), groups: groups.length, imported: ok, assignments: n, backup: V1_BACKUP };
    return true;
  }

  const validTask = t => t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.text === 'string' && typeof t.created_at === 'string' && typeof t.due === 'string';
  const validAsg = a => a && typeof a.id === 'string' && custBy.has(a.customer) && repBy.has(a.rep) && STATUS[a.status] && Number.isInteger(a.rev) && Array.isArray(a.history);
  const S = { tasks: new Map(), asg: new Map() };   // effective state: base ⊕ store (a stored assignment replaces the fixture one with the same id)
  function rebuild() {
    const tasks = new Map(base.tasks), asg = new Map(base.asg);
    for (const t of Object.values(store.tasks)) if (validTask(t)) tasks.set(t.id, t);
    for (const a of Object.values(store.assignments)) if (validAsg(a)) asg.set(a.id, a);
    for (const [id, a] of asg) if (!tasks.has(a.task)) asg.delete(id);
    S.tasks = tasks; S.asg = asg;
  }
  async function reload() { const s = db && await readAll(); if (s) store = s; rebuild(); }
  // another tab committed (BroadcastChannel), this tab came back into view, or a bfcache return: re-read, then fn() re-renders
  const listeners = [];
  const onChange = fn => { listeners.push(fn); };
  const refresh = async () => { await reload(); listeners.forEach(f => f()); };
  bc?.addEventListener('message', refresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  addEventListener('pageshow', e => { if (e.persisted) { drafts.reload(); replyDrafts.reload(); refresh(); } });
  // IndexedDB missing or failing: said on top of the page with a retry; nothing is kept elsewhere as if it were saved
  function banner() {
    let el = $('tc-storage');
    if (storage.ok) { el?.remove(); return; }
    if (!el) { document.body.insertAdjacentHTML('afterbegin', '<div class="tc-storage" id="tc-storage" role="alert"></div>'); el = $('tc-storage'); }
    el.innerHTML = `${icon('failed')}<p><b>Хадгалалт ажиллахгүй байна.</b> ${esc(storage.reason)} Харагдаж буй нь зөвхөн демо fixture; шинэ даалгавар, хариу, шийдвэр хадгалагдахгүй.</p>`
      + '<button type="button" class="tc-btn" id="tc-storage-retry">Дахин оролдох</button>';
    $('tc-storage-retry').onclick = () => location.reload();
  }

  // ---------- unsent text, tab-local: review comments (supervisor) and replies (rep) under separate keys ----------
  function tabDrafts(key) {
    let m = {};
    const load = () => { try { m = JSON.parse(sessionStorage.getItem(key) || '{}') || {}; } catch { m = {}; } };
    const save = () => { try { sessionStorage.setItem(key, JSON.stringify(m)); } catch { /* private mode: memory only */ } };
    load();
    return { get: k => m[k], set: (k, v) => { if (v) m[k] = v; else delete m[k]; save(); }, delete: k => { const had = k in m; delete m[k]; save(); return had; }, reload: load };
  }
  const drafts = tabDrafts(DRAFTS), replyDrafts = tabDrafts(REPLY_DRAFTS);
  const replyKey = (rep, aid) => `${rep}|${aid}`;
  const errs = new Map(), notices = new Map(), busyAct = new Set(), replyErrs = new Map(), busyReply = new Set();

  // ---------- assignment helpers ----------
  // the reply under review: the last reply after the last rework (a returned reply stays in the history only)
  function currentReply(a) {
    for (let i = a.history.length - 1; i >= 0; i--) { const e = a.history[i]; if (e.kind === 'reply') return e; if (e.kind === 'rework') return null; }
    return null;
  }
  const lastDecision = a => [...a.history].reverse().find(e => e.by === 'supervisor' && e.kind !== 'assigned') || null;
  function actionsFor(a) {
    if (a.status !== 'review') return [];
    const r = currentReply(a);
    if (!r) return ['confirm', 'rework', 'close_failed'];       // legacy «Хянуулах»: the reply itself was never recorded
    return r.result === 'not_done' ? ['close_failed', 'rework'] : ['confirm', 'rework'];   // a «not done» reply can never be confirmed
  }
  function decide(aid, rev, kind, comment) {
    return mutate(s => {
      const cur = s.assignments[aid] || base.asg.get(aid);
      if (!cur || cur.rev !== rev || cur.status !== 'review') return { write: false, conflict: 'state' };
      if (!actionsFor(cur).includes(kind) || (ACT[kind].needs && !comment)) return { write: false, conflict: 'rule' };
      const ev = { at: new Date().toISOString(), by: 'supervisor', kind };
      if (comment) ev.comment = comment;
      s.assignments[aid] = { ...cur, status: NEXT[kind], rev: cur.rev + 1, history: [...cur.history, ev] };   // history is only appended
      return { ok: true };
    });
  }
  // a rep's reply (Claude 31): only that assignment's own rep and customer, only from «Хийх», only on the rev the rep was shown.
  // Checked here, under the lock, on the latest store (a demo guard against a stale tab or an edited link, not authorization).
  function reply(aid, rev, rep, customer, result, body) {
    return mutate(s => {
      const cur = s.assignments[aid] || base.asg.get(aid);
      if (!cur || !S.tasks.has(cur.task) || cur.rep !== rep || cur.customer !== customer) return { write: false, conflict: 'owner' };
      if (cur.rev !== rev || cur.status !== 'todo') return { write: false, conflict: 'state' };
      if (!RESULT[result] || !body) return { write: false, conflict: 'rule' };
      const ev = { at: new Date().toISOString(), by: 'rep', kind: 'reply', result };
      ev[result === 'done' ? 'text' : 'reason'] = body;
      s.assignments[aid] = { ...cur, status: NEXT.reply, rev: cur.rev + 1, history: [...cur.history, ev] };   // never «done» by itself
      return { ok: true };
    });
  }
  // one plain-text task for the given customers: one source + one assignment per customer (its own rep, «Хийх»)
  async function createTask(v, customers) {
    const at = new Date().toISOString(), tid = 'T-' + uid();
    const task = { id: tid, title: v.title, text: v.text, created_at: at, due: v.due };
    const as = customers.map(c => ({ id: `${tid}:${c.code}`, task: tid, customer: c.code, rep: c.rep, status: 'todo', rev: 1, history: [{ at, by: 'supervisor', kind: 'assigned' }] }));
    const r = await mutate(s => { s.tasks[tid] = task; for (const a of as) s.assignments[a.id] = a; });
    return { task, as, saved: r.saved === true, error: r.error || '' };   // not saved: the caller keeps the form as typed
  }
  // per-rep status counts (by the assignment's rep) and per-customer active (todo + review) counts
  function tally() {
    const rep = new Map(FX.reps.map(r => [r.code, { todo: 0, review: 0, done: 0, failed: 0 }]));
    const active = new Map();
    for (const a of S.asg.values()) {
      rep.get(a.rep)[a.status]++;
      if (a.status === 'todo' || a.status === 'review') active.set(a.customer, (active.get(a.customer) || 0) + 1);
    }
    return { rep, active };
  }
  // one rep's work per customer (the rep pages): only assignments whose rep is this rep. back = «Хийх» after a send-back.
  const returned = a => a.status === 'todo' && lastDecision(a)?.kind === 'rework';
  const PRIO = a => returned(a) ? 0 : { todo: 1, review: 2, done: 3, failed: 4 }[a.status];
  function repTasks(rep) {
    const by = new Map();
    for (const a of S.asg.values()) {
      if (a.rep !== rep) continue;
      if (!by.has(a.customer)) by.set(a.customer, { list: [], active: 0, todo: 0, back: 0, review: 0, done: 0, failed: 0 });
      const t = by.get(a.customer);
      t.list.push(a); t[a.status]++;
      if (returned(a)) t.back++;
      if (a.status === 'todo' || a.status === 'review') t.active++;
    }
    for (const t of by.values()) t.list.sort((x, y) => PRIO(x) - PRIO(y) || ms(S.tasks.get(x.task).created_at) - ms(S.tasks.get(y.task).created_at) || x.id.localeCompare(y.id));
    return by;
  }
  // the rep's own words for the same states («Хариу өгөх», «Хянуулж байгаа»); the supervisor keeps Хийх / Хянуулах (values unchanged)
  const REP_T = { todo: 'Хариу өгөх', review: 'Хянуулж байгаа' };
  const badge = (s, rep) => `<span class="tc-st s-${s}">${icon(STATUS[s].i)}${(rep && REP_T[s]) || STATUS[s].t}</span>`;

  // ---------- the task form's rules (the same for the team form and the store window's form) ----------
  const today = () => isoOf(new Date());
  const maxDue = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return isoOf(d); };
  function taskErrors(v, dueInput) {
    const e = {};
    if (!v.title) e.title = 'Даалгаврын нэрийг бичнэ үү.';
    if (!v.text) e.text = 'Хийх ажил эсвэл хүлээх үр дүнг бичнэ үү.';
    if (!v.due) e.due = dueInput.validity.badInput ? 'Огноо буруу байна.' : 'Дуусгах хугацааг сонгоно уу.';
    else if (!isDate(v.due) || isNaN(ms(v.due))) e.due = 'Огноо буруу байна.';
    else if (v.due < today()) e.due = 'Өнгөрсөн огноо байна. Өнөөдөр эсвэл түүнээс хойш сонгоно уу.';
    else if (v.due > dueInput.max) e.due = 'Нэг жилээс хол байна.';
    return e;
  }

  // ---------- one assignment: reply cell, opened detail, history (the same markup on both pages) ----------
  // rep: the rep's own wording («Илгээсэн», «Хариу өгөөгүй»); the supervisor's is unchanged
  function replyCell(a, rep) {
    const r = currentReply(a), d = lastDecision(a), got = rep ? 'Илгээсэн' : 'Ирсэн';
    if (a.status === 'review') return `<span class="tc-rp in">${icon('reply')}${r ? `${got} ${short(r.at)}` : `${got} (хуучин)`}</span>`;
    if (a.status === 'todo') return d?.kind === 'rework' ? `<span class="tc-rp back">${icon('undo')}Буцаасан ${short(d.at)}</span>` : `<span class="tc-rp none">${rep ? 'Хариу өгөөгүй' : 'Хариугүй'}</span>`;
    return r ? `<span class="tc-rp">${got} ${short(r.at)}</span>` : `<span class="tc-rp none">Хуучин бүртгэл</span>`;
  }
  // a reply keeps its own text in the history, so a returned reply can still be read after a new one is sent
  const evText = e => e.kind === 'reply' ? `Хариу илгээсэн: ${RESULT[e.result] || '—'}${e.text || e.reason ? ` — ${esc(e.text || e.reason)}` : ''}` : (KIND[e.kind] || e.kind) + (e.comment ? ` — ${esc(e.comment)}` : '');
  function historyHtml(a) {
    const old = a.legacy ? `<li class="tc-hist-old">Өмнөх үйл явдлын огноо хуучин бүртгэлд хадгалагдаагүй (төлөв нь хадгалагдсан).</li>` : '';
    return `<div class="tc-hist"><p class="tc-k">Хяналтын түүх</p><ol>${old}`
      + a.history.map(e => `<li><span class="num">${when(e.at)}</span><span class="tc-who">${e.by === 'rep' ? 'ХТ' : 'Ахлах'}</span><span>${evText(e)}</span></li>`).join('') + `</ol></div>`;
  }
  const replyBlock = (r, who) => `<div class="tc-reply"><p class="tc-k">${who} · <span class="num">${when(r.at)}</span></p>`
    + `<p><span class="tc-res r-${r.result}">${icon(r.result === 'done' ? 'check' : 'x')}${RESULT[r.result]}</span></p>`
    + (r.text ? `<p class="tc-reply-text">${esc(r.text)}</p>` : '') + (r.reason ? `<p class="tc-reason"><b>Шалтгаан:</b> ${esc(r.reason)}</p>` : '') + `</div>`;
  const decisionNote = (a, d) => `<div class="tc-note s-${a.status}">${icon(STATUS[a.status].i)}<div><p class="tc-k">Ахлахын шийдвэр · ${when(d.at)}</p><p><b>${STATUS[a.status].t}</b>${d.comment ? ' — ' + esc(d.comment) : ''}</p></div></div>`;
  // opts.customer: extra html after the customer name (the team page's «Харилцагчийг харах»).
  // opts.rep: the rep's own view (repDetail below): the reply form instead of the review box, never a decision.
  function detail(a, opts = {}) {
    if (opts.rep) return repDetail(a, opts);
    if (opts.tab) return tabDetail(a, opts);
    const t = S.tasks.get(a.task), c = custBy.get(a.customer), r = currentReply(a), d = lastDecision(a), acts = actionsFor(a);
    let side = '';
    if (a.status === 'todo' && d?.kind === 'rework') side += `<div class="tc-note back">${icon('undo')}<div><p class="tc-k">Буцаасан · ${when(d.at)}</p><p>${esc(d.comment || '')}</p></div></div>`;
    if (r) side += replyBlock(r, 'ХТ-ийн хариу');
    else if (a.status === 'todo') side += `<p class="tc-muted">${d?.kind === 'rework' ? 'Шинэ хариу ирээгүй.' : 'ХТ-ээс хариу ирээгүй.'}</p>`;
    else side += `<p class="tc-muted">Хуучин бүртгэл: ХТ-ийн хариуны текст, огноо хадгалагдаагүй.</p>`;
    side += reviewBox(a, acts, d);
    const n = notices.get(a.id);
    return (n ? `<p class="tc-conflict" role="alert">${esc(n)}</p>` : '')
      + `<div class="tc-adet-grid"><div class="tc-adet-task"><p class="tc-k">Даалгавар</p><p class="tc-adet-title">${esc(t.title)}</p><p class="tc-adet-text">${esc(t.text)}</p>`
      + `<dl class="tc-kv"><div><dt>Өгсөн</dt><dd class="num">${when(t.created_at)}</dd></div><div><dt>Дуусгах хугацаа</dt><dd class="num">${dot(t.due)}</dd></div>`
      + `<div><dt>Харилцагч</dt><dd>${esc(c.name)} <span class="num tc-code">${esc(c.code)}</span>${opts.customer || ''}</dd></div><div><dt>ХТ</dt><dd>${esc(repName(a.rep))}</dd></div></dl></div>`
      + `<div class="tc-adet-side">${side}</div></div>` + historyHtml(a);
  }
  // «Багийн хяналт → Даалгавар» only (opts.tab): the full task text → the rep's latest reply → the supervisor's comment and decision.
  // Title, customer and rep are on the row and its section, so they are not repeated; given · due · «Харилцагчийг харах» share one
  // line; the history folds into «Түүх · N» (opts.histOpen). The same review box, rules, drafts and conflict notices as everywhere.
  // Desktop: «Өгсөн даалгавар» | «ХТ-ийн сүүлийн хариу» side by side, «Ахлахын шийдвэр» full width under both; one column
  // on a tablet (CSS). Three boxes of one style, no box inside a box.
  function tabDetail(a, opts) {
    const t = S.tasks.get(a.task), r = currentReply(a), d = lastDecision(a), n = notices.get(a.id), acts = actionsFor(a);
    const box = (cls, h, body) => `<section class="tc-dbox ${cls}"><h4 class="tc-k">${h}</h4>${body}</section>`;
    const task = `<p class="tc-adet-text">${esc(t.text)}</p><p class="tc-dmeta num"><span>Өгсөн ${when(t.created_at)}</span><span>Дуусгах хугацаа ${dot(t.due)}</span></p>${opts.customer || ''}`;
    const reply = r
      ? `<p class="tc-dmeta num"><span class="tc-res r-${r.result}">${icon(r.result === 'done' ? 'check' : 'x')}${RESULT[r.result]}</span><span>${when(r.at)}</span></p>`
        + (r.text ? `<p class="tc-reply-text">${esc(r.text)}</p>` : '') + (r.reason ? `<p class="tc-reason"><b>Биелүүлээгүй шалтгаан:</b> ${esc(r.reason)}</p>` : '')
      : `<p class="tc-muted">${a.status === 'todo' ? (d?.kind === 'rework' ? 'Буцаасны дараа шинэ хариу ирээгүй.' : 'ХТ-ээс хариу ирээгүй.') : 'Хуучин бүртгэл: ХТ-ийн хариуны агуулга, огноо хадгалагдаагүй.'}</p>`;
    let dec;
    if (acts.length) dec = reviewBox(a, acts, d, 'Тайлбар');
    else if (a.status === 'done' || a.status === 'failed') {   // the final decision, compact: status · date, then the comment
      dec = `<p class="tc-dmeta num">${badge(a.status)}<span>${d ? when(d.at) : 'Хуучин бүртгэл: шийдвэрийн огноо, тайлбар хадгалагдаагүй.'}</span></p>` + (d?.comment ? `<p class="tc-dcomment">${esc(d.comment)}</p>` : '');
    } else {   // todo: waiting for the rep (a send-back shows its date and comment)
      dec = d?.kind === 'rework' ? `<p class="tc-dmeta num"><span class="tc-rp back">${icon('undo')}Буцаасан</span><span>${when(d.at)}</span></p>${d.comment ? `<p class="tc-dcomment">${esc(d.comment)}</p>` : ''}` : '';
      dec += `<p class="tc-muted">ХТ-ийн хариуг хүлээж байна; хариу ирэхэд энд шийднэ.</p>`;
    }
    return (n ? `<p class="tc-conflict" role="alert">${esc(n)}</p>` : '')
      + `<div class="tc-tabdet">${box('tc-dtask', 'Өгсөн даалгавар', task)}${box('tc-dreply', 'ХТ-ийн сүүлийн хариу', reply)}${box('tc-ddec', 'Ахлахын шийдвэр', dec)}</div>`
      + `<details class="tc-hist-d" data-hist="${esc(a.id)}"${opts.histOpen ? ' open' : ''}><summary>Түүх · <span class="num">${a.history.length}</span></summary>${historyHtml(a)}</details>`;
  }
  // the supervisor's part: the comment + the allowed decisions (review), or the decision made (done/failed)
  function reviewBox(a, acts, d, label = 'Ахлахын тайлбар') {
    let side = '';
    if (acts.length) {
      const req = acts.filter(k => ACT[k].needs).map(k => `«${ACT[k].t}»`).join(', ');
      const e = errs.get(a.id) || '';
      side += `<div class="tc-review"><label for="cm-${esc(a.id)}">${label} <span class="tc-opt">· ${req}-д заавал</span></label>`
        + `<textarea id="cm-${esc(a.id)}" data-aid="${esc(a.id)}" rows="2" maxlength="300" aria-describedby="ce-${esc(a.id)}"${e ? ' aria-invalid="true"' : ''}>${esc(drafts.get(a.id) || '')}</textarea>`
        + `<p class="tc-err" id="ce-${esc(a.id)}">${esc(e)}</p>`
        + `<div class="tc-actions">${acts.map(k => `<button type="button" class="tc-btn${k === 'confirm' ? ' tc-primary' : ''}" data-act="${k}" data-aid="${esc(a.id)}" data-rev="${a.rev}">${icon(ACT[k].i)}${ACT[k].t}</button>`).join('')}</div>`
        + `<p class="tc-help">ХТ хариулсан нь биелсэн гэсэн үг биш — хариуг шалгаад шийднэ.</p></div>`;
    } else if (a.status === 'done' || a.status === 'failed') {
      side += d ? decisionNote(a, d) : `<p class="tc-muted">Хуучин бүртгэл: шийдвэрийн огноо, тайлбар хадгалагдаагүй.</p>`;
    }
    return side;
  }
  // the rep's view (Claude 32): the task text → the supervisor's latest send-back note → the reply (the form, the sent state or
  // the decision). Given date, customer, rep and the whole history fold into «Дэлгэрэнгүй ба түүх». The title is the row above.
  function repDetail(a, opts) {
    const t = S.tasks.get(a.task), c = custBy.get(a.customer), r = currentReply(a), d = lastDecision(a), n = notices.get(a.id);
    let h = (n ? `<p class="tc-conflict" role="alert">${esc(n)}</p>` : '') + `<p class="tc-adet-text tc-rtext">${esc(t.text)}</p>`;
    if (returned(a)) h += `<div class="tc-note back tc-back">${icon('undo')}<div><p class="tc-k">Буцаасан · ${when(d.at)} · Ахлахын тайлбар</p><p class="tc-back-c">${esc(d.comment || '')}</p></div></div>`;
    if (a.status === 'todo') h += replyForm(a, opts.rep);
    else {
      if (a.status === 'review') h += `<div class="tc-note sent">${icon('review')}<div><p class="tc-sent">Хариу илгээгдсэн · Ахлах хянаж байна</p><p class="tc-help">Шийдвэр гартал дахин илгээх боломжгүй; илгээсэн нь баталгаажсан гэсэн үг биш.</p></div></div>`;
      else h += d ? decisionNote(a, d) : `<p class="tc-muted">Хуучин бүртгэл: шийдвэрийн огноо, тайлбар хадгалагдаагүй.</p>`;
      h += r ? replyBlock(r, 'Таны хариу') : `<p class="tc-muted">Хуучин бүртгэл: хариуны текст, огноо хадгалагдаагүй.</p>`;
    }
    return h + `<details class="tc-more" data-more="${esc(a.id)}"${opts.more ? ' open' : ''}><summary>Дэлгэрэнгүй ба түүх</summary>`
      + `<dl class="tc-kv"><div><dt>Өгсөн</dt><dd class="num">${when(t.created_at)}</dd></div><div><dt>Дуусгах хугацаа</dt><dd class="num">${dot(t.due)}</dd></div>`
      + `<div><dt>Харилцагч</dt><dd>${esc(c.name)} <span class="num tc-code">${esc(c.code)}</span></dd></div><div><dt>ХТ</dt><dd>${esc(repName(a.rep))}</dd></div></dl>`
      + historyHtml(a) + '</details>';
  }
  // typing in a review comment (delegated from either page)
  function onDraftInput(e) {
    const ta = e.target.closest('textarea[data-aid]');
    if (!ta) return;
    drafts.set(ta.dataset.aid, ta.value);
    if (errs.delete(ta.dataset.aid)) { $('ce-' + ta.dataset.aid).textContent = ''; ta.removeAttribute('aria-invalid'); }
  }
  // one review decision from a [data-act] button: the comment rule, then decide() under the lock with the shown rev.
  // → null (nothing sent: busy, or a comment is required and now asked for) | { ok, a, who, text, warn }
  async function review(btn) {
    const aid = btn.dataset.aid, kind = btn.dataset.act, rev = Number(btn.dataset.rev);
    if (busyAct.has(aid)) return null;
    const comment = (drafts.get(aid) || '').trim();
    if (ACT[kind].needs && !comment) {
      errs.set(aid, `«${ACT[kind].t}»-д тайлбар бичнэ үү: юуг засах, яагаад хаах.`);
      $('ce-' + aid).textContent = errs.get(aid);
      $('cm-' + aid).setAttribute('aria-invalid', 'true'); $('cm-' + aid).focus();
      return null;
    }
    busyAct.add(aid);
    btn.closest('.tc-actions').querySelectorAll('[data-act]').forEach(x => { x.disabled = true; });
    const r = await decide(aid, rev, kind, comment);
    busyAct.delete(aid);
    const a = S.asg.get(aid), c = custBy.get(a.customer);
    const who = `${c.name} · ${S.tasks.get(a.task).title}`;
    if (r.ok) {
      drafts.delete(aid); errs.delete(aid); notices.delete(aid);
      return { ok: true, a, who, text: `${who}: ${STATUS[a.status].t}`, warn: false };
    }
    const msg = r.error ? `${r.error} Шийдвэр хадгалагдаагүй; таны тайлбар хэвээр — дахин оролдоно уу.`
      : r.conflict === 'state'
      ? `Энэ ажлыг өөр цонхонд шийдвэрлэсэн байна — одоо «${STATUS[a.status].t}». Таны шийдвэр хадгалагдаагүй.${comment ? ` Таны тайлбар: «${comment}»` : ''}`
      : 'Энэ хариунд тохирохгүй шийдвэр тул хадгалаагүй.';
    notices.set(aid, msg);
    return { ok: false, a, who, text: `${who}: ${msg}`, warn: true };
  }

  // ---------- the rep's one reply form (Claude 31): result done / not_done + a required text or reason ----------
  const REPLY_LABEL = { done: 'Хийсэн ажлын тайлбар', not_done: 'Биелүүлээгүй шалтгаан', '': 'Тайлбар эсвэл шалтгаан' };
  function replyForm(a, rep) {
    const id = esc(a.id), v = replyDrafts.get(replyKey(rep, a.id)) || {}, e = replyErrs.get(a.id) || {}, res = RESULT[v.result] ? v.result : '';
    return `<form class="tc-rform" id="rf-${id}" data-aid="${id}" data-rev="${a.rev}" novalidate aria-label="Хариу өгөх">`
      + `<fieldset class="tc-rres"${e.result ? ' aria-invalid="true"' : ''} aria-describedby="rre-${id}"><legend>Үр дүн</legend>`
      + ['done', 'not_done'].map(k => `<label class="tc-radio"><input type="radio" name="result" value="${k}"${res === k ? ' checked' : ''}><span>${RESULT[k]}</span></label>`).join('')
      + `</fieldset><p class="tc-err" id="rre-${id}">${esc(e.result || '')}</p>`
      + `<div class="tc-field"><label for="rtx-${id}" id="rtl-${id}">${REPLY_LABEL[res]} <span class="tc-opt">· заавал</span></label>`
      + `<textarea id="rtx-${id}" name="text" rows="3" maxlength="600" aria-describedby="rte-${id}"${e.text ? ' aria-invalid="true"' : ''}>${esc(v.text || '')}</textarea>`
      + `<p class="tc-err" id="rte-${id}">${esc(e.text || '')}</p></div>`
      + `<div class="tc-ract"><button type="submit" class="tc-btn tc-primary" data-send>${icon('reply')}<span>Хянуулахаар илгээх</span></button>`
      + `<p class="tc-help">Ахлах хянаж шийднэ.</p></div></form>`;
  }
  const replyValues = f => ({ result: RESULT[f.elements.result.value] ? f.elements.result.value : '', text: f.elements.text.value });
  // typing / choosing in a reply form (delegated): keep the draft for this rep + assignment, relabel the text, clear its error
  function onReplyInput(e, rep) {
    const f = e.target.closest('form.tc-rform');
    if (!f) return;
    const aid = f.dataset.aid, v = replyValues(f);
    replyDrafts.set(replyKey(rep, aid), v.result || v.text.trim() ? { rep, aid, result: v.result, text: v.text, rev: Number(f.dataset.rev) } : null);
    $('rtl-' + aid).firstChild.textContent = REPLY_LABEL[v.result] + ' ';
    const er = replyErrs.get(aid);
    if (!er) return;
    if (e.target.name === 'result') { delete er.result; $('rre-' + aid).textContent = ''; f.querySelector('.tc-rres').removeAttribute('aria-invalid'); }
    if (e.target.name === 'text' && v.text.trim()) { delete er.text; $('rte-' + aid).textContent = ''; e.target.removeAttribute('aria-invalid'); }
  }
  // one submit → validation, then reply() under the lock with the shown rev. A second click / submit while busy sends nothing.
  // → null (nothing sent) | { ok, a, text, warn }
  async function sendReply(f, rep, customer) {
    const aid = f.dataset.aid, rev = Number(f.dataset.rev);
    if (busyReply.has(aid)) return null;
    const v = replyValues(f), body = v.text.trim(), e = {};
    if (!v.result) e.result = 'Үр дүнгээ сонгоно уу: «Гүйцэтгэсэн» эсвэл «Биелүүлээгүй».';
    if (!body) e.text = v.result === 'not_done' ? 'Биелүүлээгүй шалтгаанаа бичнэ үү.' : v.result === 'done' ? 'Хийсэн ажлаа товч бичнэ үү.' : 'Хийсэн ажил эсвэл шалтгаанаа бичнэ үү.';
    if (e.result || e.text) {
      replyErrs.set(aid, e);
      $('rre-' + aid).textContent = e.result || ''; $('rte-' + aid).textContent = e.text || '';
      if (e.result) f.querySelector('.tc-rres').setAttribute('aria-invalid', 'true'); else f.querySelector('.tc-rres').removeAttribute('aria-invalid');
      if (e.text) f.elements.text.setAttribute('aria-invalid', 'true'); else f.elements.text.removeAttribute('aria-invalid');
      (e.result ? f.querySelector('input[name="result"]') : f.elements.text).focus();
      return null;
    }
    busyReply.add(aid);
    const send = f.querySelector('[data-send]');
    send.disabled = true; send.lastChild.textContent = 'Илгээж байна…';   // until the transaction has committed (or failed)
    const r = await reply(aid, rev, rep, customer, v.result, body);
    busyReply.delete(aid);
    const a = S.asg.get(aid), title = a ? S.tasks.get(a.task).title : aid;
    if (r.ok) {
      replyDrafts.delete(replyKey(rep, aid)); replyErrs.delete(aid); notices.delete(aid);
      return { ok: true, a, text: `«${title}»: хариу илгээгдлээ · Ахлах хянаж байна`, warn: false };
    }
    // another rep's / customer's work: not even its title is shown
    if (r.conflict === 'owner') return { ok: false, a: null, text: 'Энэ ажил энэ ХТ, энэ харилцагчийнх биш тул хариу хадгалаагүй.', warn: true };
    const msg = r.error ? `${r.error} Хариу илгээгдээгүй; таны бичсэн текст хэвээр — дахин илгээнэ үү.`
      : r.conflict === 'state' ? `Энэ ажил өөр цонхонд өөрчлөгдсөн байна — одоо «${STATUS[a.status].t}». Таны хариу хадгалагдаагүй.${body ? ` Таны бичсэн: «${body}»` : ''}`
      : 'Хариуны үр дүн эсвэл тайлбар дутуу тул хадгалаагүй.';
    notices.set(aid, msg);
    return { ok: false, a, text: `«${title}»: ${msg}`, warn: true };
  }

  rebuild();   // the fixture at once; the stored records follow when IndexedDB is open (pages render after `ready`)
  const ready = openDb().then(reload).then(() => { banner(); return storage; });
  return {
    ready, storage, DB, FX, KEY, $, nf, esc, dot, pad, isoOf, icon, STATUS, ORDER, P, py, pm, monthDays, cutDay, repBy, custBy, repName,
    isDate, ms, when, short, S, reload, onChange, mutate, migrateV1, drafts, errs, notices,
    currentReply, lastDecision, actionsFor, createTask, tally, badge, today, maxDue, taskErrors, replyCell, detail, onDraftInput, review,
    returned, repTasks, reply, replyDrafts, replyKey, onReplyInput, sendReply,
  };
})();
