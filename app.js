'use strict';

/* ================= Дані ================= */
const KEY = 'vesillya-data-v1';
const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const WEEKDAYS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const COLORS = ['#FF5A5F', '#FF9F0A', '#FFD60A', '#4CD27A', '#40C8E0', '#0A84FF', '#5E5CE6', '#BF5AF2', '#FF6FB5', '#D9B77E', '#8E8E93', '#F5F5F7'];
const LISTS = {
  organizers: { title: 'Організатори', one: 'організатора' },
  packages: { title: 'Пакети послуг', one: 'пакет' },
  extrasList: { title: 'Додаткові послуги', one: 'послугу' },
  workers: { title: 'Інші виконавці', one: 'виконавця' },
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function defaults() {
  return {
    version: 2,
    orders: [],
    organizers: [], packages: [], extrasList: [], workers: [],
    peopleCols: [{ id: uid(), name: 'Іра' }, { id: uid(), name: 'Саша' }, { id: uid(), name: 'Оператор 3' }],
    roleCols: [{ id: uid(), name: 'Відбір кадрів' }, { id: uid(), name: 'Монтажер' }],
    statuses: [
      { id: uid(), name: 'Не почато', color: '#8E8E93' },
      { id: uid(), name: 'Відбір', color: '#40C8E0' },
      { id: uid(), name: 'Монтаж', color: '#FF9F0A' },
      { id: uid(), name: 'На погодженні', color: '#BF5AF2' },
      { id: uid(), name: 'Здано', color: '#4CD27A' },
    ],
    products: [{ id: uid(), name: 'Тизер', months: 1 }, { id: uid(), name: 'Фільм', months: 6 }],
    settings: { deadlineMonths: 6, currency: 'USD' },
    lastBackup: null,
  };
}

function normalize(d) {
  const base = defaults();
  if (!d || typeof d !== 'object') return base;
  const v1 = !d.version || d.version < 2;
  const out = { ...base, ...d };
  for (const k of ['orders', 'organizers', 'packages', 'extrasList', 'workers', 'peopleCols', 'roleCols', 'statuses', 'products']) {
    if (!Array.isArray(out[k])) out[k] = base[k];
  }
  out.settings = { ...base.settings, ...(d.settings || {}) };
  if (v1) {
    out.workers = uniq([...(d.operators || []), ...(d.editors || [])]);
    delete out.operators; delete out.editors;
  }
  out.orders = out.orders.filter(o => o && typeof o === 'object').map(o => normOrder(o, out, v1));
  out.version = 2;
  return out;
}
function uniq(a) { return [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y, 'uk')); }

function normOrder(o, data, v1) {
  const r = {
    id: o.id || uid(),
    date: o.date || '',
    couple: o.couple || '',
    location: o.location || '',
    organizer: o.organizer || '',
    pkg: o.pkg || '',
    pkgPrice: num(v1 ? o.total : o.pkgPrice),
    extras: Array.isArray(o.extras) ? o.extras.map(e => ({ name: e.name || '', amount: num(e.amount) })) : [],
    currency: v1 ? 'UAH' : (o.currency === 'UAH' ? 'UAH' : 'USD'),
    prepay: num(o.prepay),
    balancePaid: !!o.balancePaid,
    comment: o.comment || '',
    archived: !!o.archived,
    deadline: o.deadline || '',
    earn: { people: {}, roles: {}, agencyPct: 0 },
    progress: {},
  };
  if (v1) {
    const c = o.calc || {};
    for (const p of (c.operators || [])) {
      if (!p.name && !num(p.amount)) continue;
      let col = data.peopleCols.find(x => x.name.toLowerCase() === String(p.name || '').toLowerCase());
      if (!col) { col = { id: uid(), name: p.name || 'Оператор' }; data.peopleCols.push(col); }
      r.earn.people[col.id] = num(r.earn.people[col.id]) + num(p.amount);
    }
    if (c.editor && (c.editor.name || num(c.editor.amount))) {
      const role = data.roleCols.find(x => x.name === 'Монтажер') || data.roleCols[0];
      if (role) r.earn.roles[role.id] = { who: c.editor.name || '', amount: num(c.editor.amount) };
    }
    r.earn.agencyPct = num(c.agencyPct);
    if (o.statusId) {
      const film = data.products.find(p => p.name === 'Фільм') || data.products[data.products.length - 1];
      if (film) r.progress[film.id] = { statusId: o.statusId, deadline: '' };
    }
  } else {
    const e = o.earn || {};
    if (e.people && typeof e.people === 'object') for (const k in e.people) r.earn.people[k] = num(e.people[k]);
    if (e.roles && typeof e.roles === 'object') for (const k in e.roles) r.earn.roles[k] = { who: (e.roles[k] && e.roles[k].who) || '', amount: num(e.roles[k] && e.roles[k].amount) };
    r.earn.agencyPct = num(e.agencyPct);
    if (o.progress && typeof o.progress === 'object') for (const k in o.progress) r.progress[k] = { statusId: (o.progress[k] && o.progress[k].statusId) || null, deadline: (o.progress[k] && o.progress[k].deadline) || '' };
  }
  return r;
}

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { console.error(e); }
  return defaults();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Не вдалося зберегти дані на пристрої'); console.error(e); }
}
let db = load();
save();

/* ================= Утиліти ================= */
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/[\s $]/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}
const nf = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
function money(n, cur) {
  n = Math.round(num(n) * 100) / 100;
  if (cur === 'UAH') return nf.format(n) + ' грн';
  return (n < 0 ? '−$' : '$') + nf.format(Math.abs(n));
}
function curSign(cur) { return cur === 'UAH' ? 'грн' : '$'; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function parseDate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function todayStr() { return ymd(new Date()); }
function longDate(s) { const d = parseDate(s); return d ? `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}, ${WEEKDAYS[d.getDay()]}` : 'Без дати'; }
function shortDate(s) { const d = parseDate(s); return d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}` : '—'; }
function addMonths(s, n) {
  const d = parseDate(s); if (!d) return '';
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + num(n), 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return ymd(t);
}
function inputVal(v) { return v ? String(v) : ''; }
function sortAsc(a, b) { return (a.date || '9999').localeCompare(b.date || '9999'); }
function addToList(key, name) {
  name = (name || '').trim(); if (!name) return;
  if (!db[key].some(x => x.toLowerCase() === name.toLowerCase())) { db[key].push(name); db[key].sort((a, b) => a.localeCompare(b, 'uk')); }
}
function orderTotal(o) { return num(o.pkgPrice) + o.extras.reduce((s, e) => s + num(e.amount), 0); }
function earnOf(o) {
  const total = orderTotal(o);
  const agency = total * num(o.earn.agencyPct) / 100;
  return { total, agency, net: total - agency };
}
function orderDeadline(o) { return o.deadline || addMonths(o.date, db.settings.deadlineMonths); }
function prodDeadline(o, p) { return (o.progress[p.id] && o.progress[p.id].deadline) || addMonths(o.date, p.months); }
function statusById(id) { return db.statuses.find(s => s.id === id) || null; }
function isDone(statusId) { const last = db.statuses[db.statuses.length - 1]; return !!last && last.id === statusId; }
function prodOverdue(o, p) { const d = prodDeadline(o, p); return !!d && d < todayStr() && !isDone(o.progress[p.id] && o.progress[p.id].statusId); }
function orderOverdue(o) {
  const d = orderDeadline(o);
  const allDone = db.products.length > 0 && db.products.every(p => isDone(o.progress[p.id] && o.progress[p.id].statusId));
  return (!!d && d < todayStr() && !allDone) || db.products.some(p => prodOverdue(o, p));
}
function workerNames() { return uniq([...db.peopleCols.map(c => c.name), ...db.workers]); }
function dayCls(s) { if (!s) return ''; const t = todayStr(); return s === t ? ' today' : s < t ? ' past' : ''; }
function yearOf(o) { return o.date ? +o.date.slice(0, 4) : null; }

const ICON = {
  plus: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" width="18" height="18"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dn: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  pen: '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/* ================= Тости, панелі, діалоги ================= */
let toastTimer;
function toast(msg, action) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { t.classList.remove('show'); action.run(); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 4500 : 2200);
}

function openSheet(html, mount, onDismiss) {
  const layer = document.getElementById('layer');
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  layer.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) { close(); onDismiss && onDismiss(); } });
  if (mount) mount(ov.querySelector('.sheet'), close);
  return close;
}

function confirmDialog({ title, text = '', ok = 'Так', danger = false }) {
  return new Promise(resolve => {
    openSheet(`<h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}
      <div class="stack"><button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button><button class="btn secondary" data-cancel>Скасувати</button></div>`,
      (el, close) => {
        el.querySelector('[data-ok]').onclick = () => { close(); resolve(true); };
        el.querySelector('[data-cancel]').onclick = () => { close(); resolve(false); };
      }, () => resolve(false));
  });
}

function promptDialog({ title, value = '', placeholder = '', ok = 'Зберегти' }) {
  return new Promise(resolve => {
    openSheet(`<h2>${esc(title)}</h2>
      <form class="stack" data-f><input class="input" id="promptInput" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">
      <button class="btn" type="submit">${esc(ok)}</button><button class="btn secondary" type="button" data-cancel>Скасувати</button></form>`,
      (el, close) => {
        const inp = el.querySelector('input'); setTimeout(() => inp.focus(), 50);
        el.querySelector('[data-f]').onsubmit = e => { e.preventDefault(); close(); resolve(inp.value.trim()); };
        el.querySelector('[data-cancel]').onclick = () => { close(); resolve(null); };
      }, () => resolve(null));
  });
}

/* Вибір зі списку або додавання нового */
function openPicker({ title, items, value, onPick, onAdd, placeholder = 'Пошук або нова назва' }) {
  openSheet(`<h2>${esc(title)}</h2>
    <div class="search" style="margin-bottom:10px">${ICON.search}<input id="pickerInput" placeholder="${esc(placeholder)}" autocomplete="off" enterkeyhint="done"></div>
    <div class="scroll" data-list></div>`, (el, close) => {
    const inp = el.querySelector('input');
    const listEl = el.querySelector('[data-list]');
    const draw = () => {
      const all = items();
      const q = inp.value.trim(), ql = q.toLowerCase();
      const shown = all.filter(n => n.toLowerCase().includes(ql));
      const exact = all.some(n => n.toLowerCase() === ql);
      let html = '';
      if (q && !exact) html += `<button class="opt add" data-new>+ Додати «${esc(q)}»</button>`;
      html += shown.map(n => `<button class="opt${n === value ? ' sel' : ''}" data-name="${esc(n)}"><span class="grow">${esc(n)}</span>${n === value ? ICON.check : ''}</button>`).join('');
      if (value) html += `<button class="opt" data-clear><span class="grow muted">Очистити</span></button>`;
      if (!all.length && !q) html = `<p>Список поки порожній. Введіть назву вгорі, щоб додати.</p>` + html;
      listEl.innerHTML = html;
      listEl.querySelectorAll('[data-name]').forEach(b => b.onclick = () => { close(); onPick(b.dataset.name); });
      const nb = listEl.querySelector('[data-new]');
      if (nb) nb.onclick = () => { onAdd && onAdd(q); save(); close(); onPick(q); };
      const cb = listEl.querySelector('[data-clear]');
      if (cb) cb.onclick = () => { close(); onPick(''); };
    };
    inp.addEventListener('input', draw);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const nb = listEl.querySelector('[data-new]'); if (nb) nb.click(); else inp.blur(); } });
    draw();
  });
}
function listPicker(key, title, value, onPick) {
  openPicker({ title, items: () => db[key], value, onPick, onAdd: n => addToList(key, n) });
}
function whoPicker(title, value, onPick) {
  openPicker({ title, items: workerNames, value, onPick, placeholder: 'Пошук або нове ім’я', onAdd: n => { if (!db.peopleCols.some(c => c.name.toLowerCase() === n.toLowerCase())) addToList('workers', n); } });
}

function openColorPicker(current, onPick) {
  openSheet(`<h2>Колір статусу</h2>
    <div class="palette">${COLORS.map(c => `<button data-c="${c}" class="${c.toLowerCase() === (current || '').toLowerCase() ? 'sel' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
    <label class="switch-row" for="customColor"><span>Свій колір</span><input type="color" id="customColor" value="${esc(current || '#8E8E93')}" style="width:52px;height:36px;border:0;background:none;padding:0"></label>`,
    (el, close) => {
      el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { close(); onPick(b.dataset.c); });
      el.querySelector('#customColor').addEventListener('change', e => { close(); onPick(e.target.value); });
    });
}

function openDeadline({ title, value, auto, autoLabel, onSave }) {
  openSheet(`<h2>${esc(title)}</h2>
    <div class="stack">
      <input class="input" type="date" id="dlInput" value="${esc(value || auto)}">
      <button class="btn" data-save>Зберегти дедлайн</button>
      ${auto ? `<button class="btn secondary" data-auto>Автоматично: ${esc(shortDate(auto))} (${esc(autoLabel)})</button>` : ''}
    </div>`, (el, close) => {
    el.querySelector('[data-save]').onclick = () => { const v = el.querySelector('#dlInput').value; close(); onSave(v === auto ? '' : v); };
    const a = el.querySelector('[data-auto]'); if (a) a.onclick = () => { close(); onSave(''); };
  });
}

function openYearPicker(years) {
  openSheet(`<h2>Рік</h2><div class="scroll">${years.map(y => `<button class="opt${y === state.year ? ' sel' : ''}" data-y="${y}"><span class="grow" style="font-weight:700;font-size:20px">${y}</span>${y === state.year ? ICON.check : ''}</button>`).join('')}</div>`,
    (el, close) => el.querySelectorAll('[data-y]').forEach(b => b.onclick = () => { state.year = +b.dataset.y; close(); render(); }));
}
function yearsOf(orders) {
  const ys = new Set(orders.map(yearOf).filter(Boolean));
  ys.add(new Date().getFullYear()); ys.add(state.year);
  return [...ys].sort((a, b) => b - a);
}
function yearButton() { return `<button class="yearbtn" id="yearBtn">${state.year}${ICON.down}</button>`; }

/* ================= Свайп вліво ================= */
function enableSwipe(wrap, onSwipe) {
  const row = wrap.querySelector('.row');
  let x0 = 0, y0 = 0, dx = 0, lock = null;
  row.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; lock = null; row.style.transition = 'none'; }, { passive: true });
  row.addEventListener('touchmove', e => {
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (lock === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    if (lock !== 'x') return;
    e.preventDefault();
    dx = Math.min(0, mx);
    row.style.transform = `translateX(${dx}px)`;
  }, { passive: false });
  const end = () => {
    if (lock !== 'x') return;
    row.dataset.swiped = '1'; setTimeout(() => { delete row.dataset.swiped; }, 350);
    row.style.transition = 'transform .22s ease-out';
    if (dx < -Math.min(110, wrap.offsetWidth * 0.3)) {
      row.style.transform = 'translateX(-100%)';
      setTimeout(onSwipe, 200);
    } else row.style.transform = '';
  };
  row.addEventListener('touchend', end);
  row.addEventListener('touchcancel', end);
}

/* ================= Навігація ================= */
const state = { tab: 'orders', stack: [], year: new Date().getFullYear(), search: '', progressFilter: 'all' };

function push(name, params = {}) { state.stack.push({ name, params }); render(); window.scrollTo(0, 0); }
async function pop() {
  const top = state.stack[state.stack.length - 1];
  if (top && top.dirty) {
    const ok = await confirmDialog({ title: 'Вийти без збереження?', text: 'Зміни не буде збережено.', ok: 'Вийти', danger: true });
    if (!ok) return;
  }
  state.stack.pop(); render();
}

function render() {
  const top = state.stack[state.stack.length - 1];
  const res = top ? screens[top.name](top.params, top) : screens[state.tab]();
  const left = document.getElementById('leftBtn');
  left.className = 'iconbtn';
  if (top) { left.innerHTML = ICON.back; left.setAttribute('aria-label', 'Назад'); left.onclick = pop; }
  else if (state.tab === 'orders') { left.innerHTML = ICON.plus; left.classList.add('plus'); left.setAttribute('aria-label', 'Нове замовлення'); left.onclick = () => push('orderForm', { id: null }); }
  else { left.innerHTML = ''; left.classList.add('invisible'); left.onclick = null; }
  document.getElementById('tabs').hidden = !!top;
  const title = document.getElementById('title');
  title.hidden = !top; title.textContent = res.title || '';
  document.getElementById('settingsBtn').classList.toggle('invisible', !!top);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  const main = document.getElementById('main');
  main.innerHTML = res.html;
  if (res.mount) res.mount(main);
}

const screens = {};

/* ================= ЗАМОВЛЕННЯ ================= */
function orderRow(o) {
  const d = parseDate(o.date);
  const total = orderTotal(o);
  const unpaid = total > 0 && !o.balancePaid && total - num(o.prepay) > 0;
  const l1 = o.organizer || o.couple || 'Без організатора';
  const l2 = o.pkg || (o.organizer && o.couple ? o.couple : '');
  return `<div class="swipe" data-sw="${o.id}">
    <div class="swipe-act">${o.archived ? 'Повернути' : 'В архів'}</div>
    <button class="row" data-open="${o.id}">
      <span class="day${dayCls(o.date)}">${d ? d.getDate() : '—'}</span>
      <span class="rmain"><span class="r1">${esc(l1)}</span>${l2 ? `<span class="r2">${esc(l2)}</span>` : ''}</span>
      <span class="rsum">${total ? money(total, o.currency) : '<span class="dash">—</span>'}${unpaid ? '<span class="pdot" title="Є залишок до оплати"></span>' : ''}</span>
    </button></div>`;
}
function groupByMonth(orders) {
  const groups = new Map();
  for (const o of orders.sort(sortAsc)) {
    const m = parseDate(o.date).getMonth();
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m).push(o);
  }
  return groups;
}
function mountRows(el) {
  el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { if (b.dataset.swiped) return; push('orderForm', { id: b.dataset.open }); });
  el.querySelectorAll('[data-sw]').forEach(w => enableSwipe(w, () => toggleArchive(w.dataset.sw)));
}
function toggleArchive(id) {
  const o = db.orders.find(x => x.id === id); if (!o) return;
  o.archived = !o.archived; save(); render();
  toast(o.archived ? 'Перенесено в архів' : 'Повернуто з архіву', { label: 'Скасувати', run: () => { o.archived = !o.archived; save(); render(); } });
}

function ordersBody() {
  const active = db.orders.filter(o => !o.archived);
  const archivedN = db.orders.length - active.length;
  const q = state.search.trim().toLowerCase();
  let body = '';
  if (q) {
    const found = db.orders.filter(o => [o.couple, o.organizer, o.location, o.pkg].some(v => v.toLowerCase().includes(q))).sort(sortAsc);
    body = found.length
      ? `<div class="box">${found.map(o => orderRow(o)).join('')}</div><div class="note">Пошук іде по всіх роках і по архіву.</div>`
      : `<div class="empty"><b>Нічого не знайдено</b>Шукайте за іменами пари, організатором або локацією.</div>`;
  } else {
    const inYear = active.filter(o => yearOf(o) === state.year);
    const nodate = active.filter(o => !o.date);
    body = yearButton();
    if (!inYear.length) body += `<div class="empty"><b>${active.length ? `У ${state.year} році замовлень немає` : 'Ще немає замовлень'}</b>${active.length ? 'Натисніть на рік, щоб вибрати інший.' : 'Натисніть «+» угорі зліва, щоб додати перше весілля.'}</div>`;
    for (const [m, list] of groupByMonth(inYear)) body += `<div class="month">${MONTHS[m]}</div><div class="box">${list.map(o => orderRow(o)).join('')}</div>`;
    if (nodate.length) body += `<div class="month">Без дати</div><div class="box">${nodate.map(o => orderRow(o)).join('')}</div>`;
    if (inYear.length) body += `<div class="note">Свайпніть замовлення вліво, щоб перенести в архів. Помаранчева крапка означає, що є залишок до оплати.</div>`;
  }
  if (archivedN) body += `<button class="linkbtn" id="toArchive">Архів · ${archivedN}</button>`;
  return body;
}
function mountOrdersBody(el) {
  const yb = el.querySelector('#yearBtn'); if (yb) yb.onclick = () => openYearPicker(yearsOf(db.orders.filter(o => !o.archived)));
  const ar = el.querySelector('#toArchive'); if (ar) ar.onclick = () => push('archive');
  mountRows(el);
}

screens.orders = () => ({
  html: `<div class="stack">
    <div class="search">${ICON.search}<input type="search" id="orderSearch" placeholder="Пошук" value="${esc(state.search)}" autocomplete="off"></div>
    <div class="stack" id="ordersBody">${ordersBody()}</div></div>`,
  mount(el) {
    const s = el.querySelector('#orderSearch');
    s.addEventListener('input', () => { state.search = s.value; const b = el.querySelector('#ordersBody'); b.innerHTML = ordersBody(); mountOrdersBody(b); });
    mountOrdersBody(el);
  },
});

screens.archive = () => {
  const list = db.orders.filter(o => o.archived).sort((a, b) => sortAsc(b, a));
  const byYear = new Map();
  for (const o of list) { const y = yearOf(o) || 'Без дати'; if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(o); }
  return {
    title: 'Архів',
    html: `<div class="stack">
      ${list.length ? [...byYear].map(([y, os]) => `<div class="month" style="font-size:20px;color:var(--fg);font-weight:800">${y}</div><div class="box">${os.map(o => orderRow(o)).join('')}</div>`).join('') : '<div class="empty"><b>Архів порожній</b>Свайпніть замовлення вліво у списку, щоб перенести його сюди.</div>'}
      ${list.length ? '<div class="note">Свайпніть вліво, щоб повернути замовлення до списку. Архівні замовлення враховуються у «Заробітку».</div>' : ''}
    </div>`,
    mount: mountRows,
  };
};

/* ---------- Детальна картка замовлення ---------- */
screens.orderForm = (p, frame) => {
  if (!frame.draft) {
    const src = p.id ? db.orders.find(o => o.id === p.id) : null;
    frame.draft = src ? JSON.parse(JSON.stringify(src)) : normOrder({ currency: db.settings.currency }, db, false);
    if (!src) frame.draft.id = null;
  }
  const d = frame.draft;
  const isNew = !p.id;
  const cs = curSign(d.currency);
  return {
    title: isNew ? 'Нове замовлення' : (d.couple || 'Замовлення'),
    html: `
      <form class="form" id="orderForm" novalidate>
        <div class="field"><label for="fDate">Дата весілля</label><input class="input" type="date" id="fDate" value="${esc(d.date)}"></div>
        <div class="field"><label for="fCouple">Імена пари</label><input class="input" id="fCouple" value="${esc(d.couple)}" placeholder="Олена та Максим" autocomplete="off" autocapitalize="words"></div>
        <div class="field"><label for="fLoc">Локація</label><input class="input" id="fLoc" value="${esc(d.location)}" placeholder="Ресторан, місто" autocomplete="off"></div>
        <div class="field"><span class="label">Організатор</span><button type="button" class="picker" id="fOrg">${d.organizer ? `<span>${esc(d.organizer)}</span>` : '<span class="ph">Вибрати або додати</span>'}${ICON.chev}</button></div>
        <div class="field"><span class="label">Валюта</span>
          <div class="seg" id="fCur"><button type="button" data-c="USD" class="${d.currency === 'USD' ? 'on' : ''}">$ долар</button><button type="button" data-c="UAH" class="${d.currency === 'UAH' ? 'on' : ''}">грн</button></div></div>
        <div class="field"><span class="label">Пакет послуг</span><button type="button" class="picker" id="fPkg">${d.pkg ? `<span>${esc(d.pkg)}</span>` : '<span class="ph">Вибрати або додати</span>'}${ICON.chev}</button></div>
        <div class="field"><label for="fPkgPrice">Вартість пакету</label><div class="money"><input class="input" id="fPkgPrice" inputmode="decimal" value="${inputVal(d.pkgPrice)}" placeholder="0"><span class="cur">${cs}</span></div></div>
        <div class="field"><span class="label">Додаткові послуги</span>
          <div class="stack" style="gap:6px">${d.extras.map((e, i) => `
            <div class="extra">
              <button type="button" class="picker" data-ex-name="${i}">${e.name ? `<span>${esc(e.name)}</span>` : '<span class="ph">Послуга</span>'}</button>
              <div class="money"><input class="input" inputmode="decimal" data-ex-amt="${i}" value="${inputVal(e.amount)}" placeholder="0" aria-label="Сума послуги"><span class="cur">${cs}</span></div>
              <button type="button" class="xbtn" data-ex-del="${i}" aria-label="Прибрати послугу">${ICON.x}</button>
            </div>`).join('')}
            <button type="button" class="btn secondary small" id="addExtra" style="align-self:flex-start">+ Додати послугу</button>
          </div></div>
        <div class="field"><label for="fPrepay">Передоплата</label><div class="money"><input class="input" id="fPrepay" inputmode="decimal" value="${inputVal(d.prepay)}" placeholder="0"><span class="cur">${cs}</span></div></div>
        <div class="calc">
          <div class="kv"><span class="k">Пакет + додаткові послуги</span><span class="v" id="fSumParts"></span></div>
          <div class="kv big"><span class="k">Загальна сума</span><span class="v" id="fTotal"></span></div>
          <div class="kv"><span class="k">Залишок до оплати</span><span class="v" id="fBalance"></span></div>
        </div>
        <label class="switch-row" for="fPaid"><span>Залишок оплачено</span><span class="switch"><input type="checkbox" id="fPaid" ${d.balancePaid ? 'checked' : ''}><span class="track"></span></span></label>
        <div class="field"><label for="fComment">Коментар</label><textarea class="input" id="fComment" placeholder="Побажання, контакти…">${esc(d.comment)}</textarea></div>
        <button class="btn" type="submit">Зберегти</button>
        ${isNew ? '' : `
          <button class="btn secondary" type="button" id="toEarn">Заробіток по цьому весіллю</button>
          <button class="btn secondary" type="button" id="archBtn">${d.archived ? 'Повернути з архіву' : 'Перенести в архів'}</button>
          <button class="btn danger" type="button" id="delOrder">Видалити замовлення</button>`}
      </form>`,
    mount(el) {
      const dirty = () => { frame.dirty = true; };
      const upd = () => {
        const extrasSum = d.extras.reduce((s, e) => s + num(e.amount), 0);
        const total = orderTotal(d);
        el.querySelector('#fSumParts').textContent = `${money(d.pkgPrice, d.currency)} + ${money(extrasSum, d.currency)}`;
        el.querySelector('#fTotal').textContent = money(total, d.currency);
        const b = el.querySelector('#fBalance');
        b.textContent = d.balancePaid ? 'оплачено' : money(total - num(d.prepay), d.currency);
        b.style.color = d.balancePaid ? 'var(--ok)' : '';
      };
      const bind = (id, key, fn = v => v) => el.querySelector(id).addEventListener('input', e => { d[key] = fn(e.target.value); dirty(); upd(); });
      bind('#fDate', 'date'); el.querySelector('#fDate').addEventListener('change', e => { d.date = e.target.value; dirty(); });
      bind('#fCouple', 'couple'); bind('#fLoc', 'location'); bind('#fPkgPrice', 'pkgPrice', num); bind('#fPrepay', 'prepay', num); bind('#fComment', 'comment');
      el.querySelector('#fPaid').addEventListener('change', e => { d.balancePaid = e.target.checked; dirty(); upd(); });
      el.querySelectorAll('#fCur [data-c]').forEach(b => b.onclick = () => { d.currency = b.dataset.c; dirty(); render(); });
      el.querySelector('#fOrg').onclick = () => listPicker('organizers', 'Організатор', d.organizer, v => { d.organizer = v; dirty(); render(); });
      el.querySelector('#fPkg').onclick = () => listPicker('packages', 'Пакет послуг', d.pkg, v => { d.pkg = v; dirty(); render(); });
      el.querySelector('#addExtra').onclick = () => listPicker('extrasList', 'Додаткова послуга', '', v => { d.extras.push({ name: v, amount: 0 }); dirty(); render(); });
      el.querySelectorAll('[data-ex-name]').forEach(b => b.onclick = () => { const i = +b.dataset.exName; listPicker('extrasList', 'Додаткова послуга', d.extras[i].name, v => { d.extras[i].name = v; dirty(); render(); }); });
      el.querySelectorAll('[data-ex-amt]').forEach(inp => inp.addEventListener('input', () => { d.extras[+inp.dataset.exAmt].amount = num(inp.value); dirty(); upd(); }));
      el.querySelectorAll('[data-ex-del]').forEach(b => b.onclick = () => { d.extras.splice(+b.dataset.exDel, 1); dirty(); render(); });
      upd();
      const commit = () => {
        d.couple = d.couple.trim(); d.comment = d.comment.trim(); d.location = d.location.trim();
        if (d.id) { const i = db.orders.findIndex(o => o.id === d.id); if (i >= 0) db.orders[i] = { ...db.orders[i], ...d, earn: db.orders[i].earn, progress: db.orders[i].progress, deadline: db.orders[i].deadline }; }
        else { d.id = uid(); db.orders.push(d); }
        save(); frame.dirty = false;
      };
      el.querySelector('#orderForm').onsubmit = e => {
        e.preventDefault(); commit();
        if (d.date) state.year = +d.date.slice(0, 4);
        state.stack.pop(); render(); toast(isNew ? 'Замовлення додано' : 'Зміни збережено');
      };
      const te = el.querySelector('#toEarn');
      if (te) te.onclick = () => { if (frame.dirty) commit(); push('earnEdit', { id: d.id }); };
      const ab = el.querySelector('#archBtn');
      if (ab) ab.onclick = () => { if (frame.dirty) commit(); state.stack.pop(); toggleArchive(d.id); };
      const del = el.querySelector('#delOrder');
      if (del) del.onclick = async () => {
        const ok = await confirmDialog({ title: 'Видалити замовлення?', text: `${d.couple || 'Замовлення'}, ${longDate(d.date)}. Цю дію не можна скасувати.`, ok: 'Видалити', danger: true });
        if (!ok) return;
        db.orders = db.orders.filter(o => o.id !== p.id); save(); frame.dirty = false; state.stack.pop(); render(); toast('Замовлення видалено');
      };
    },
  };
};

/* ================= ЗАРОБІТОК ================= */
function addCur(map, key, cur, v) {
  if (!map.has(key)) map.set(key, { USD: 0, UAH: 0 });
  map.get(key)[cur] += num(v);
}
function curPair(x) {
  const parts = [];
  if (x.USD) parts.push(money(x.USD, 'USD'));
  if (x.UAH) parts.push(money(x.UAH, 'UAH'));
  return parts.length ? parts.join(' · ') : money(0, db.settings.currency);
}

screens.earnings = () => {
  const orders = db.orders.filter(o => yearOf(o) === state.year).sort(sortAsc);
  const P = db.peopleCols, R = db.roleCols;
  const cell = (v, cur) => num(v) ? money(v, cur) : '<span class="dash">—</span>';
  const rows = orders.map(o => {
    const e = earnOf(o), d = parseDate(o.date);
    return `<tr data-row="${o.id}">
      <td class="sticky"><div class="ed"><span class="dd">${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}</span><span class="cn">${esc(o.couple)}</span></div></td>
      ${P.map(c => `<td>${cell(o.earn.people[c.id], o.currency)}</td>`).join('')}
      ${R.map(r => { const x = o.earn.roles[r.id] || {}; return `<td>${x.who ? `<div class="who">${esc(x.who)}</div>` : ''}${cell(x.amount, o.currency)}</td>`; }).join('')}
      <td>${cell(o.prepay, o.currency)}</td>
      <td>${cell(e.agency, o.currency)}${num(o.earn.agencyPct) ? `<div class="who">${nf.format(o.earn.agencyPct)}%</div>` : ''}</td>
      <td>${cell(e.total, o.currency)}</td>
      <td class="netc">${cell(e.net, o.currency)}</td></tr>`;
  }).join('');
  // Підсумки по валютах
  const foot = ['USD', 'UAH'].filter(c => orders.some(o => o.currency === c)).map(cur => {
    const os = orders.filter(o => o.currency === cur);
    const s = f => os.reduce((a, o) => a + num(f(o)), 0);
    return `<tr><td class="sticky">Разом ${curSign(cur)}</td>
      ${P.map(c => `<td>${money(s(o => o.earn.people[c.id]), cur)}</td>`).join('')}
      ${R.map(r => `<td>${money(s(o => (o.earn.roles[r.id] || {}).amount), cur)}</td>`).join('')}
      <td>${money(s(o => o.prepay), cur)}</td><td>${money(s(o => earnOf(o).agency), cur)}</td><td>${money(s(o => earnOf(o).total), cur)}</td><td class="netc">${money(s(o => earnOf(o).net), cur)}</td></tr>`;
  }).join('');
  // Статистика по людях
  const net = { USD: 0, UAH: 0 };
  const persons = new Map();
  P.forEach(c => persons.set(c.name, { USD: 0, UAH: 0 }));
  for (const o of orders) {
    net[o.currency] += earnOf(o).net;
    P.forEach(c => addCur(persons, c.name, o.currency, o.earn.people[c.id]));
    R.forEach(r => { const x = o.earn.roles[r.id]; if (x && (x.who || num(x.amount))) addCur(persons, x.who || 'Без імені', o.currency, x.amount); });
  }
  const personRows = [...persons].filter(([n, v]) => P.some(c => c.name === n) || v.USD || v.UAH)
    .map(([n, v]) => `<div class="kv"><span class="k">${esc(n)}</span><span class="v">${curPair(v)}</span></div>`).join('');
  return {
    html: `<div class="stack">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">${yearButton()}<button class="btn secondary small" id="cols">Стовпчики</button></div>
      ${orders.length ? `
        <div class="tablewrap"><table class="t">
          <thead><tr><th class="sticky">Дата</th>${P.map(c => `<th>${esc(c.name)}</th>`).join('')}${R.map(r => `<th>${esc(r.name)}</th>`).join('')}<th>Передоплата</th><th>Агентські</th><th>Загальна сума</th><th>Чисті</th></tr></thead>
          <tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>
        <div class="note">Гортайте таблицю вліво-вправо. Натисніть на рядок, щоб внести суми. Чисті = загальна сума мінус агентські.</div>`
      : `<div class="empty"><b>У ${state.year} році замовлень немає</b>Натисніть на рік, щоб вибрати інший.</div>`}
      <div class="section-title">Підсумки за ${state.year}</div>
      <div class="stats">
        <div class="kv big"><span class="k">Чисті</span><span class="v">${curPair(net)}</span></div>
        ${personRows}
      </div>
      <div class="note">До заробітку людини додаються і суми з ролей, де її обрано (наприклад, якщо монтажер — Іра).</div>
    </div>`,
    mount(el) {
      el.querySelector('#yearBtn').onclick = () => openYearPicker(yearsOf(db.orders));
      el.querySelector('#cols').onclick = () => push('columns');
      el.querySelectorAll('[data-row]').forEach(r => r.onclick = () => push('earnEdit', { id: r.dataset.row }));
    },
  };
};

screens.earnEdit = (p, frame) => {
  const order = db.orders.find(o => o.id === p.id);
  if (!order) { state.stack.pop(); return screens[state.tab](); }
  if (!frame.draft) frame.draft = JSON.parse(JSON.stringify(order.earn));
  const e = frame.draft, cur = order.currency, cs = curSign(cur);
  return {
    title: 'Заробіток',
    html: `<form class="form" id="earnForm" novalidate>
      <div class="headcard"><span class="day${dayCls(order.date)}">${parseDate(order.date) ? parseDate(order.date).getDate() : '—'}</span>
        <div style="min-width:0"><div class="t">${esc(order.couple || 'Без імен')}</div><div class="muted" style="font-size:13px">${esc(longDate(order.date))}</div></div></div>
      ${db.peopleCols.map(c => `<div class="field"><label for="pp_${c.id}">${esc(c.name)}</label><div class="money"><input class="input" id="pp_${c.id}" data-pp="${c.id}" inputmode="decimal" value="${inputVal(e.people[c.id])}" placeholder="0"><span class="cur">${cs}</span></div></div>`).join('')}
      ${db.roleCols.map(r => { const x = e.roles[r.id] || { who: '', amount: 0 }; return `<div class="field"><span class="label">${esc(r.name)}</span>
        <div class="two"><button type="button" class="picker" data-who="${r.id}">${x.who ? `<span>${esc(x.who)}</span>` : '<span class="ph">Хто робив</span>'}${ICON.chev}</button>
        <div class="money"><input class="input" data-ra="${r.id}" inputmode="decimal" value="${inputVal(x.amount)}" placeholder="0" aria-label="Сума: ${esc(r.name)}"><span class="cur">${cs}</span></div></div></div>`; }).join('')}
      <div class="field"><label for="agPct">Агентські, %</label><div class="money"><input class="input" id="agPct" inputmode="decimal" value="${inputVal(e.agencyPct)}" placeholder="0"><span class="cur">%</span></div></div>
      <div class="calc">
        <div class="kv"><span class="k">Загальна сума</span><span class="v">${money(orderTotal(order), cur)}</span></div>
        <div class="kv"><span class="k">Передоплата</span><span class="v">${money(order.prepay, cur)}</span></div>
        <div class="kv"><span class="k">Агентські</span><span class="v" id="agAmt"></span></div>
        <div class="kv big"><span class="k">Чисті</span><span class="v" id="netAmt"></span></div>
      </div>
      <div class="note">Загальна сума і передоплата беруться із замовлення.</div>
      <button class="btn" type="submit">Зберегти</button>
    </form>`,
    mount(el) {
      const dirty = () => { frame.dirty = true; };
      const upd = () => { const r = earnOf({ ...order, earn: e }); el.querySelector('#agAmt').textContent = money(r.agency, cur); el.querySelector('#netAmt').textContent = money(r.net, cur); };
      el.querySelectorAll('[data-pp]').forEach(i => i.addEventListener('input', () => { e.people[i.dataset.pp] = num(i.value); dirty(); }));
      el.querySelectorAll('[data-ra]').forEach(i => i.addEventListener('input', () => { const id = i.dataset.ra; e.roles[id] = { who: (e.roles[id] || {}).who || '', amount: num(i.value) }; dirty(); }));
      el.querySelectorAll('[data-who]').forEach(b => b.onclick = () => {
        const id = b.dataset.who, role = db.roleCols.find(r => r.id === id);
        whoPicker(role.name, (e.roles[id] || {}).who, v => { e.roles[id] = { who: v, amount: num((e.roles[id] || {}).amount) }; dirty(); render(); });
      });
      el.querySelector('#agPct').addEventListener('input', ev => { e.agencyPct = num(ev.target.value); dirty(); upd(); });
      upd();
      el.querySelector('#earnForm').onsubmit = ev => { ev.preventDefault(); order.earn = e; save(); frame.dirty = false; state.stack.pop(); render(); toast('Збережено'); };
    },
  };
};

/* ---------- Стовпчики таблиці ---------- */
screens.columns = () => {
  const block = (key, items) => items.map((c, i) => `
    <div class="erow">
      <input class="input" data-cn="${key}|${c.id}" value="${esc(c.name)}" aria-label="Назва стовпчика">
      <button class="mini" data-cu="${key}|${i}" ${i === 0 ? 'disabled' : ''} aria-label="Вище">${ICON.up}</button>
      <button class="mini" data-cd="${key}|${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Нижче">${ICON.dn}</button>
      <button class="mini red" data-cx="${key}|${c.id}" aria-label="Видалити">${ICON.x}</button>
    </div>`).join('');
  return {
    title: 'Стовпчики',
    html: `<div class="stack">
      <div class="section-title">Люди: окремий стовпчик для кожного</div>
      <div class="menu">${block('peopleCols', db.peopleCols) || '<div class="mrow muted">Немає</div>'}</div>
      <button class="btn secondary" data-add="peopleCols">+ Додати людину</button>
      <div class="section-title">Ролі: з вибором, хто робив</div>
      <div class="menu">${block('roleCols', db.roleCols) || '<div class="mrow muted">Немає</div>'}</div>
      <button class="btn secondary" data-add="roleCols">+ Додати роль</button>
      <div class="note">Назву можна змінити прямо в полі. Якщо перейменувати людину, ім’я оновиться і в ролях, де її обрано. Видалений стовпчик зникає з таблиці, але вже внесені суми з нього не враховуються.</div>
    </div>`,
    mount(el) {
      el.querySelectorAll('[data-cn]').forEach(inp => inp.addEventListener('change', () => {
        const [key, id] = inp.dataset.cn.split('|'); const c = db[key].find(x => x.id === id);
        const v = inp.value.trim(); if (!v) { inp.value = c.name; return; }
        if (key === 'peopleCols') db.orders.forEach(o => Object.values(o.earn.roles).forEach(r => { if (r.who === c.name) r.who = v; }));
        c.name = v; save(); toast('Назву змінено');
      }));
      const move = (key, i, d) => { const a = db[key]; [a[i], a[i + d]] = [a[i + d], a[i]]; save(); render(); };
      el.querySelectorAll('[data-cu]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.cu.split('|'); move(k, +i, -1); });
      el.querySelectorAll('[data-cd]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.cd.split('|'); move(k, +i, 1); });
      el.querySelectorAll('[data-cx]').forEach(b => b.onclick = async () => {
        const [k, id] = b.dataset.cx.split('|'); const c = db[k].find(x => x.id === id);
        if (!await confirmDialog({ title: `Видалити стовпчик «${c.name}»?`, ok: 'Видалити', danger: true })) return;
        db[k] = db[k].filter(x => x.id !== id);
        db.orders.forEach(o => { delete o.earn.people[id]; delete o.earn.roles[id]; });
        save(); render();
      });
      el.querySelectorAll('[data-add]').forEach(b => b.onclick = async () => {
        const k = b.dataset.add;
        const v = await promptDialog({ title: k === 'peopleCols' ? 'Нова людина' : 'Нова роль', placeholder: k === 'peopleCols' ? 'Ім’я' : 'Напр. «Кольорокорекція»', ok: 'Додати' });
        if (!v) return; db[k].push({ id: uid(), name: v }); save(); render();
      });
    },
  };
};

/* ================= ПРОГРЕС ================= */
function selStyle(s) { return s ? `border-color:${esc(s.color)};background-color:${esc(s.color)}2e` : ''; }

screens.progress = () => {
  const f = state.progressFilter;
  if (f !== 'all' && f !== 'overdue' && !statusById(f)) state.progressFilter = 'all';
  const active = db.orders.filter(o => !o.archived);
  const match = o => state.progressFilter === 'all' ? true
    : state.progressFilter === 'overdue' ? orderOverdue(o)
    : db.products.some(p => (o.progress[p.id] || {}).statusId === state.progressFilter);
  const inYear = active.filter(o => yearOf(o) === state.year && match(o));
  const overdueN = active.filter(orderOverdue).length;
  const chip = (id, label, color) => `<button class="chip${state.progressFilter === id ? ' on' : ''}" data-f="${id}">${color ? `<span class="dot" style="background:${esc(color)}"></span>` : ''}${esc(label)}</button>`;
  const opts = sel => `<option value="">—</option>` + db.statuses.map(s => `<option value="${s.id}"${s.id === sel ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
  const row = o => {
    const dl = orderDeadline(o);
    return `<tr>
      <td class="sticky"><div class="pd"><span class="day${dayCls(o.date)}">${parseDate(o.date).getDate()}</span>
        <div><div class="names">${esc(o.couple || 'Без імен')}</div>
        <button class="dl${dl && dl < todayStr() && !db.products.every(p => isDone((o.progress[p.id] || {}).statusId)) ? ' over' : ''}${o.deadline ? '' : ' auto'}" data-odl="${o.id}">до ${shortDate(dl)}</button></div></div></td>
      ${db.products.map(p => {
        const st = (o.progress[p.id] || {}).statusId || '';
        const pdl = prodDeadline(o, p);
        return `<td><select class="stsel" data-o="${o.id}" data-p="${p.id}" style="${selStyle(statusById(st))}" aria-label="${esc(p.name)}: статус">${opts(st)}</select>
          <button class="dl${prodOverdue(o, p) ? ' over' : ''}${(o.progress[p.id] || {}).deadline ? '' : ' auto'}" data-pdl="${o.id}|${p.id}">до ${shortDate(pdl)}</button></td>`;
      }).join('')}</tr>`;
  };
  let body = '';
  const groups = groupByMonth(inYear);
  if (!inYear.length) body = `<div class="empty"><b>${state.progressFilter === 'all' ? `У ${state.year} році замовлень немає` : 'Нічого не знайдено'}</b>${state.progressFilter === 'all' ? 'Натисніть на рік, щоб вибрати інший.' : 'Виберіть інший фільтр або рік.'}</div>`;
  for (const [m, list] of groups) {
    body += `<div class="month">${MONTHS[m]}</div>
      <div class="tablewrap"><table class="t p"><thead><tr><th class="sticky">Дата</th>${db.products.map(p => `<th>${esc(p.name)}</th>`).join('')}</tr></thead>
      <tbody>${list.map(row).join('')}</tbody></table></div>`;
  }
  return {
    html: `<div class="stack">
      <div class="chips">${chip('all', 'Усі')}${overdueN ? chip('overdue', `Прострочено · ${overdueN}`, 'var(--danger)') : ''}${db.statuses.map(s => chip(s.id, s.name, s.color)).join('')}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">${yearButton()}
        <div class="btnrow"><button class="btn secondary small" id="toProducts">Продукти</button><button class="btn secondary small" id="toStatuses">Статуси</button></div></div>
      ${body}
      ${inYear.length ? '<div class="note">Статус обирайте прямо в таблиці. Натисніть на дату «до …», щоб змінити дедлайн; «авто» означає, що він порахований від дати весілля. Червоним позначено прострочене (останній статус у списку вважається завершеним).</div>' : ''}
    </div>`,
    mount(el) {
      el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { state.progressFilter = b.dataset.f; render(); });
      el.querySelector('#yearBtn').onclick = () => openYearPicker(yearsOf(active));
      el.querySelector('#toStatuses').onclick = () => push('statuses');
      el.querySelector('#toProducts').onclick = () => push('products');
      el.querySelectorAll('.stsel').forEach(s => s.addEventListener('change', () => {
        const o = db.orders.find(x => x.id === s.dataset.o);
        o.progress[s.dataset.p] = { ...(o.progress[s.dataset.p] || { deadline: '' }), statusId: s.value || null };
        save(); render(); toast('Статус змінено');
      }));
      el.querySelectorAll('[data-odl]').forEach(b => b.onclick = () => {
        const o = db.orders.find(x => x.id === b.dataset.odl);
        openDeadline({ title: `Дедлайн: ${o.couple || 'замовлення'}`, value: o.deadline, auto: addMonths(o.date, db.settings.deadlineMonths), autoLabel: `${db.settings.deadlineMonths} міс. від весілля`, onSave: v => { o.deadline = v; save(); render(); } });
      });
      el.querySelectorAll('[data-pdl]').forEach(b => b.onclick = () => {
        const [oid, pid] = b.dataset.pdl.split('|');
        const o = db.orders.find(x => x.id === oid), p = db.products.find(x => x.id === pid);
        const cur = o.progress[pid] || { statusId: null, deadline: '' };
        openDeadline({ title: `${p.name}: ${o.couple || 'дедлайн'}`, value: cur.deadline, auto: addMonths(o.date, p.months), autoLabel: `${p.months} міс. від весілля`, onSave: v => { o.progress[pid] = { ...cur, deadline: v }; save(); render(); } });
      });
    },
  };
};

screens.statuses = () => ({
  title: 'Статуси',
  html: `<div class="stack">
    <div class="note">Торкніться кольорового квадрата, щоб змінити колір. Назва зберігається одразу. Останній статус у списку вважається завершеним.</div>
    ${db.statuses.length ? `<div class="menu">${db.statuses.map((s, i) => `
      <div class="erow">
        <button class="swatch" data-color="${s.id}" style="background:${esc(s.color)}" aria-label="Колір"></button>
        <input class="input" data-name="${s.id}" value="${esc(s.name)}" aria-label="Назва статусу">
        <button class="mini" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Вище">${ICON.up}</button>
        <button class="mini" data-down="${i}" ${i === db.statuses.length - 1 ? 'disabled' : ''} aria-label="Нижче">${ICON.dn}</button>
        <button class="mini red" data-del="${s.id}" aria-label="Видалити">${ICON.x}</button>
      </div>`).join('')}</div>` : '<div class="empty"><b>Статусів немає</b>Створіть перший статус.</div>'}
    <button class="btn" id="addStatus">+ Новий статус</button>
  </div>`,
  mount(el) {
    el.querySelectorAll('[data-name]').forEach(inp => inp.addEventListener('change', () => {
      const s = statusById(inp.dataset.name), v = inp.value.trim();
      if (!v) { inp.value = s.name; return; } s.name = v; save(); toast('Назву змінено');
    }));
    el.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { const s = statusById(b.dataset.color); openColorPicker(s.color, c => { s.color = c; save(); render(); }); });
    const move = (i, d) => { const a = db.statuses; [a[i], a[i + d]] = [a[i + d], a[i]]; save(); render(); };
    el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => move(+b.dataset.up, -1));
    el.querySelectorAll('[data-down]').forEach(b => b.onclick = () => move(+b.dataset.down, 1));
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const s = statusById(b.dataset.del);
      if (!await confirmDialog({ title: `Видалити статус «${s.name}»?`, text: 'Там, де він стояв, статус стане порожнім.', ok: 'Видалити', danger: true })) return;
      db.statuses = db.statuses.filter(x => x.id !== s.id);
      db.orders.forEach(o => Object.values(o.progress).forEach(pr => { if (pr.statusId === s.id) pr.statusId = null; }));
      save(); render();
    });
    el.querySelector('#addStatus').onclick = async () => {
      const name = await promptDialog({ title: 'Новий статус', placeholder: 'Напр. «Кольорокорекція»', ok: 'Далі: колір' });
      if (!name) return;
      const used = new Set(db.statuses.map(s => s.color));
      const s = { id: uid(), name, color: COLORS.find(c => !used.has(c)) || COLORS[0] };
      db.statuses.push(s); save(); render();
      openColorPicker(s.color, c => { s.color = c; save(); render(); });
    };
  },
});

screens.products = () => ({
  title: 'Продукти на віддачу',
  html: `<div class="stack">
    <div class="note">Кожен продукт стає стовпчиком у «Прогресі». Число — через скільки місяців після весілля стоїть дедлайн за замовчуванням.</div>
    ${db.products.length ? `<div class="menu">${db.products.map((p, i) => `
      <div class="erow">
        <input class="input" data-pn="${p.id}" value="${esc(p.name)}" aria-label="Назва продукту">
        <input class="input months" data-pm="${p.id}" inputmode="numeric" value="${p.months}" aria-label="Місяців до дедлайну">
        <span class="muted" style="font-size:13px">міс.</span>
        <button class="mini" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Лівіше">${ICON.up}</button>
        <button class="mini" data-down="${i}" ${i === db.products.length - 1 ? 'disabled' : ''} aria-label="Правіше">${ICON.dn}</button>
        <button class="mini red" data-del="${p.id}" aria-label="Видалити">${ICON.x}</button>
      </div>`).join('')}</div>` : '<div class="empty"><b>Продуктів немає</b>Додайте, наприклад, «Тизер» і «Фільм».</div>'}
    <button class="btn" id="addProd">+ Додати продукт</button>
    <div class="field" style="margin-top:8px"><label for="dlm">Загальний дедлайн замовлення: місяців після весілля</label>
      <input class="input" id="dlm" inputmode="numeric" value="${db.settings.deadlineMonths}"></div>
  </div>`,
  mount(el) {
    el.querySelectorAll('[data-pn]').forEach(i => i.addEventListener('change', () => { const p = db.products.find(x => x.id === i.dataset.pn); const v = i.value.trim(); if (!v) { i.value = p.name; return; } p.name = v; save(); toast('Збережено'); }));
    el.querySelectorAll('[data-pm]').forEach(i => i.addEventListener('change', () => { const p = db.products.find(x => x.id === i.dataset.pm); p.months = Math.max(0, Math.round(num(i.value))); i.value = p.months; save(); toast('Збережено'); }));
    const move = (i, d) => { const a = db.products; [a[i], a[i + d]] = [a[i + d], a[i]]; save(); render(); };
    el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => move(+b.dataset.up, -1));
    el.querySelectorAll('[data-down]').forEach(b => b.onclick = () => move(+b.dataset.down, 1));
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const p = db.products.find(x => x.id === b.dataset.del);
      if (!await confirmDialog({ title: `Видалити продукт «${p.name}»?`, text: 'Статуси й дедлайни цього продукту зникнуть з усіх замовлень.', ok: 'Видалити', danger: true })) return;
      db.products = db.products.filter(x => x.id !== p.id); db.orders.forEach(o => delete o.progress[p.id]); save(); render();
    });
    el.querySelector('#addProd').onclick = async () => {
      const name = await promptDialog({ title: 'Новий продукт', placeholder: 'Напр. «Рілс» або «Фотокнига»', ok: 'Додати' });
      if (!name) return; db.products.push({ id: uid(), name, months: db.settings.deadlineMonths }); save(); render();
    };
    el.querySelector('#dlm').addEventListener('change', e => { db.settings.deadlineMonths = Math.max(0, Math.round(num(e.target.value))); e.target.value = db.settings.deadlineMonths; save(); toast('Збережено'); });
  },
});

/* ================= НАЛАШТУВАННЯ ================= */
screens.settings = () => ({
  title: 'Налаштування',
  html: `<div class="stack">
    <div class="section-title">Резервна копія</div>
    <div class="note">Дані зберігаються лише на цьому пристрої. Регулярно робіть копію й зберігайте файл у «Файлах» або iCloud. Цей самий файл переносить усі дані на інший пристрій.</div>
    <button class="btn" id="exportBtn">Експорт резервної копії</button>
    <button class="btn secondary" id="importBtn">Імпорт резервної копії</button>
    <input type="file" id="importFile" accept=".json,application/json,text/plain" hidden>
    <div class="note">${db.lastBackup ? `Остання копія: ${esc(longDate(db.lastBackup.slice(0, 10)))}` : 'Резервну копію ще не робили.'}</div>
    <div class="section-title">Валюта нових замовлень</div>
    <div class="seg" id="defCur"><button data-c="USD" class="${db.settings.currency === 'USD' ? 'on' : ''}">$ долар</button><button data-c="UAH" class="${db.settings.currency === 'UAH' ? 'on' : ''}">грн</button></div>
    <div class="section-title">Збережені списки</div>
    <div class="menu">${Object.entries(LISTS).map(([k, v]) => `<button data-list="${k}"><span class="grow">${v.title}</span><span class="cnt">${db[k].length}</span>${ICON.chev}</button>`).join('')}</div>
    <div class="section-title">Таблиці</div>
    <div class="menu">
      <button data-go="columns"><span class="grow">Стовпчики заробітку</span><span class="cnt">${db.peopleCols.length + db.roleCols.length}</span>${ICON.chev}</button>
      <button data-go="statuses"><span class="grow">Статуси роботи</span><span class="cnt">${db.statuses.length}</span>${ICON.chev}</button>
      <button data-go="products"><span class="grow">Продукти на віддачу й дедлайни</span><span class="cnt">${db.products.length}</span>${ICON.chev}</button>
      <button data-go="archive"><span class="grow">Архів</span><span class="cnt">${db.orders.filter(o => o.archived).length}</span>${ICON.chev}</button>
    </div>
    <div class="note" style="margin-top:8px">Замовлень у застосунку: ${db.orders.length}.</div>
  </div>`,
  mount(el) {
    el.querySelectorAll('[data-list]').forEach(b => b.onclick = () => push('listEdit', { key: b.dataset.list }));
    el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => push(b.dataset.go));
    el.querySelectorAll('#defCur [data-c]').forEach(b => b.onclick = () => { db.settings.currency = b.dataset.c; save(); render(); });
    el.querySelector('#exportBtn').onclick = exportBackup;
    const fi = el.querySelector('#importFile');
    el.querySelector('#importBtn').onclick = () => fi.click();
    fi.addEventListener('change', () => { const f = fi.files[0]; fi.value = ''; if (f) importBackup(f); });
  },
});

async function exportBackup() {
  const now = new Date();
  const json = JSON.stringify({ app: 'vesillya-orders', format: 2, exportedAt: now.toISOString(), data: db }, null, 1);
  const name = `vesillya-kopiya-${todayStr()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const done = () => { db.lastBackup = now.toISOString(); save(); render(); toast('Резервну копію створено'); };
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Резервна копія замовлень' }); done(); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; console.warn(e); }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  done();
}

function importBackup(file) {
  const r = new FileReader();
  r.onload = async () => {
    let parsed;
    try { parsed = JSON.parse(r.result); } catch { toast('Це не файл резервної копії'); return; }
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || !Array.isArray(data.orders)) { toast('У файлі немає замовлень. Виберіть файл резервної копії.'); return; }
    const when = parsed.exportedAt ? ` від ${longDate(parsed.exportedAt.slice(0, 10))}` : '';
    if (!await confirmDialog({ title: 'Замінити дані з копії?', text: `У файлі${when}: ${data.orders.length} замовл. Поточні дані на цьому пристрої (${db.orders.length} замовл.) буде замінено.`, ok: 'Замінити', danger: true })) return;
    db = normalize(data); save(); state.stack = [{ name: 'settings', params: {} }]; render(); toast('Дані відновлено');
  };
  r.onerror = () => toast('Не вдалося прочитати файл');
  r.readAsText(file);
}

screens.listEdit = p => {
  const k = p.key, meta = LISTS[k];
  return {
    title: meta.title,
    html: `<div class="stack">
      <form style="display:flex;gap:8px" id="addForm"><input class="input" id="newItem" placeholder="Додати ${meta.one}" autocomplete="off" style="flex:1;min-width:0"><button class="btn small" type="submit" style="flex:none;min-height:46px">Додати</button></form>
      ${db[k].length ? `<div class="menu">${db[k].map((n, i) => `<div class="mrow"><span class="grow">${esc(n)}</span>
          <button class="mini" data-ren="${i}" aria-label="Перейменувати">${ICON.pen}</button><button class="mini red" data-del="${i}" aria-label="Видалити">${ICON.x}</button></div>`).join('')}</div>`
        : `<div class="empty"><b>Список порожній</b>Додайте назву вище або прямо під час заповнення замовлення.</div>`}
      <div class="note">${k === 'workers' ? 'Тут люди, яких можна обрати в ролях (відбір кадрів, монтажер), але без окремого стовпчика. Люди зі стовпчиків доступні для вибору автоматично. ' : ''}Перейменування оновлює назву і в замовленнях. Видалення прибирає лише зі списку.</div>
    </div>`,
    mount(el) {
      el.querySelector('#addForm').onsubmit = e => { e.preventDefault(); const v = el.querySelector('#newItem').value.trim(); if (!v) return; addToList(k, v); save(); render(); toast('Додано'); };
      el.querySelectorAll('[data-ren]').forEach(b => b.onclick = async () => {
        const old = db[k][+b.dataset.ren];
        const v = await promptDialog({ title: 'Перейменувати', value: old });
        if (!v || v === old) return;
        db[k][+b.dataset.ren] = v; db[k] = uniq(db[k]);
        for (const o of db.orders) {
          if (k === 'organizers' && o.organizer === old) o.organizer = v;
          if (k === 'packages' && o.pkg === old) o.pkg = v;
          if (k === 'extrasList') o.extras.forEach(x => { if (x.name === old) x.name = v; });
          if (k === 'workers') Object.values(o.earn.roles).forEach(r => { if (r.who === old) r.who = v; });
        }
        save(); render(); toast('Перейменовано');
      });
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        const n = db[k][+b.dataset.del];
        if (!await confirmDialog({ title: `Видалити «${n}» зі списку?`, ok: 'Видалити', danger: true })) return;
        db[k].splice(+b.dataset.del, 1); save(); render(); toast('Видалено зі списку');
      });
    },
  };
};

/* ================= Старт ================= */
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { state.tab = b.dataset.tab; state.stack = []; render(); window.scrollTo(0, 0); });
document.getElementById('settingsBtn').onclick = () => push('settings');
render();

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
