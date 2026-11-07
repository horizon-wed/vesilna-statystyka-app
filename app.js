'use strict';

/* ================= Дані ================= */
const KEY = 'vesillya-data-v1';
const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
const WEEKDAYS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const COLORS = ['#E5484D', '#F76B15', '#FFB224', '#46A758', '#12A594', '#0090FF', '#3E63DD', '#8E4EC6', '#D6409F', '#AD7F58', '#8D8D8D', '#3B3540'];
const LISTS = {
  organizers: { title: 'Організатори', one: 'організатора' },
  packages: { title: 'Пакети послуг', one: 'пакет' },
  operators: { title: 'Оператори', one: 'оператора' },
  editors: { title: 'Монтажери', one: 'монтажера' },
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function defaults() {
  return {
    version: 1,
    orders: [],
    organizers: [], packages: [], operators: [], editors: [],
    statuses: [
      { id: uid(), name: 'Очікує зйомки', color: '#8D8D8D' },
      { id: uid(), name: 'Відзнято', color: '#0090FF' },
      { id: uid(), name: 'У монтажі', color: '#FFB224' },
      { id: uid(), name: 'На погодженні', color: '#8E4EC6' },
      { id: uid(), name: 'Здано', color: '#46A758' },
    ],
    lastBackup: null,
  };
}

function normalize(d) {
  const base = defaults();
  if (!d || typeof d !== 'object') return base;
  const out = { ...base, ...d };
  for (const k of ['orders', 'organizers', 'packages', 'operators', 'editors', 'statuses']) {
    if (!Array.isArray(out[k])) out[k] = base[k];
  }
  out.orders = out.orders.filter(o => o && typeof o === 'object').map(o => ({
    id: o.id || uid(),
    date: o.date || '',
    couple: o.couple || '',
    organizer: o.organizer || '',
    pkg: o.pkg || '',
    total: num(o.total),
    prepay: num(o.prepay),
    balancePaid: !!o.balancePaid,
    comment: o.comment || '',
    statusId: o.statusId || null,
    calc: normCalc(o.calc),
  }));
  return out;
}
function normCalc(c) {
  c = c && typeof c === 'object' ? c : {};
  return {
    operators: Array.isArray(c.operators) ? c.operators.map(p => ({ name: p.name || '', amount: num(p.amount) })) : [],
    editor: { name: (c.editor && c.editor.name) || '', amount: num(c.editor && c.editor.amount) },
    agencyPct: num(c.agencyPct),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.error(e); }
  return defaults();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Не вдалося зберегти дані на пристрої'); console.error(e); }
}

let db = load();

/* ================= Утиліти ================= */
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/[\s ]/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}
const nf = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
function money(n) { return nf.format(Math.round(num(n) * 100) / 100) + ' грн'; }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function longDate(s) {
  const d = parseDate(s);
  if (!d) return 'Без дати';
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}, ${WEEKDAYS[d.getDay()]}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateBox(s) {
  const d = parseDate(s);
  if (!d) return `<div class="datebox"><div class="d">—</div><div class="m">дата</div></div>`;
  const past = s < todayStr();
  return `<div class="datebox${past ? ' past' : ''}"><div class="d">${d.getDate()}</div><div class="m">${MONTHS_SHORT[d.getMonth()]}</div><div class="y">${d.getFullYear()}</div></div>`;
}
function inputVal(v) { return v ? String(v) : ''; }
function sortAsc(a, b) { return (a.date || '9999').localeCompare(b.date || '9999'); }
function addToList(key, name) {
  name = (name || '').trim();
  if (!name) return;
  if (!db[key].some(x => x.toLowerCase() === name.toLowerCase())) {
    db[key].push(name);
    db[key].sort((a, b) => a.localeCompare(b, 'uk'));
  }
}
function calcOf(o) {
  const c = o.calc || normCalc();
  const total = num(o.total);
  const agency = total * num(c.agencyPct) / 100;
  const net = total - agency;
  const team = c.operators.reduce((s, p) => s + num(p.amount), 0) + num(c.editor.amount);
  return { total, agency, net, team, rest: net - team };
}
function calcFilled(o) {
  const c = o.calc;
  return c && (c.operators.length > 0 || c.editor.name || num(c.editor.amount) > 0 || num(c.agencyPct) > 0);
}
function statusById(id) { return db.statuses.find(s => s.id === id) || null; }

const ICON = {
  chev: '<svg class="chev" viewBox="0 0 24 24" width="20" height="20"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pen: '<svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/* ================= Тости, панелі, діалоги ================= */
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function openSheet(html, mount) {
  const layer = document.getElementById('layer');
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  layer.appendChild(ov);
  const close = () => { ov.remove(); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  if (mount) mount(ov.querySelector('.sheet'), close);
  return close;
}

function confirmDialog({ title, text = '', ok = 'Так', danger = false }) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const close = openSheet(`
      <h2>${esc(title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}
      <div class="stack">
        <button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button>
        <button class="btn ghost" data-cancel>Скасувати</button>
      </div>`, (el, cl) => {
      el.querySelector('[data-ok]').onclick = () => { finish(true); cl(); };
      el.querySelector('[data-cancel]').onclick = () => { finish(false); cl(); };
    });
    // закриття тапом по фону
    const ov = document.getElementById('layer').lastElementChild;
    ov.addEventListener('click', e => { if (e.target === ov) finish(false); });
    void close;
  });
}

function promptDialog({ title, value = '', placeholder = '', ok = 'Зберегти' }) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    openSheet(`
      <h2>${esc(title)}</h2>
      <form class="stack" data-f>
        <input class="input" id="promptInput" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">
        <button class="btn" type="submit">${esc(ok)}</button>
        <button class="btn ghost" type="button" data-cancel>Скасувати</button>
      </form>`, (el, cl) => {
      const inp = el.querySelector('input');
      setTimeout(() => inp.focus(), 50);
      el.querySelector('[data-f]').onsubmit = e => { e.preventDefault(); finish(inp.value.trim()); cl(); };
      el.querySelector('[data-cancel]').onclick = () => { finish(null); cl(); };
    });
    const ov = document.getElementById('layer').lastElementChild;
    ov.addEventListener('click', e => { if (e.target === ov) finish(null); });
  });
}

/* Вибір зі списку або додавання нового */
function openPicker({ title, listKey, value, onPick, placeholder = 'Пошук або нове ім’я' }) {
  openSheet(`
    <h2>${esc(title)}</h2>
    <div class="search" style="margin-bottom:10px">${ICON.search}<input id="pickerInput" placeholder="${esc(placeholder)}" autocomplete="off" enterkeyhint="done"></div>
    <div class="scroll" data-list></div>`, (el, close) => {
    const inp = el.querySelector('input');
    const listEl = el.querySelector('[data-list]');
    const draw = () => {
      const q = inp.value.trim();
      const ql = q.toLowerCase();
      const items = db[listKey].filter(n => n.toLowerCase().includes(ql));
      const exact = db[listKey].some(n => n.toLowerCase() === ql);
      let html = '';
      if (q && !exact) html += `<button class="opt add" data-new>+ Додати «${esc(q)}»</button>`;
      html += items.map(n => `<button class="opt${n === value ? ' sel' : ''}" data-name="${esc(n)}"><span class="grow">${esc(n)}</span>${n === value ? ICON.check : ''}</button>`).join('');
      if (value) html += `<button class="opt" data-clear><span class="grow muted">Очистити вибір</span></button>`;
      if (!db[listKey].length && !q) html = `<p>Список поки порожній. Введіть назву вгорі, щоб додати.</p>` + html;
      listEl.innerHTML = html;
      listEl.querySelectorAll('[data-name]').forEach(b => b.onclick = () => { onPick(b.dataset.name); close(); });
      const nb = listEl.querySelector('[data-new]');
      if (nb) nb.onclick = () => { addToList(listKey, q); save(); onPick(q); close(); toast('Додано до списку'); };
      const cb = listEl.querySelector('[data-clear]');
      if (cb) cb.onclick = () => { onPick(''); close(); };
    };
    inp.addEventListener('input', draw);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const nb = listEl.querySelector('[data-new]'); if (nb) nb.click(); else inp.blur(); }
    });
    draw();
  });
}

function openStatusPicker(order, after) {
  openSheet(`
    <h2>Статус: ${esc(order.couple || 'замовлення')}</h2>
    <div class="scroll">
      ${db.statuses.map(s => `<button class="opt${s.id === order.statusId ? ' sel' : ''}" data-id="${s.id}"><span class="dot" style="background:${esc(s.color)};width:16px;height:16px"></span><span class="grow">${esc(s.name)}</span>${s.id === order.statusId ? ICON.check : ''}</button>`).join('')}
      ${db.statuses.length ? '' : '<p>Статусів ще немає. Створіть їх у розділі «Налаштувати статуси».</p>'}
      <button class="opt" data-none><span class="grow muted">Без статусу</span></button>
    </div>`, (el, close) => {
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
      order.statusId = b.dataset.id; save(); close(); after && after();
    });
    el.querySelector('[data-none]').onclick = () => { order.statusId = null; save(); close(); after && after(); };
  });
}

function openColorPicker(current, onPick) {
  openSheet(`
    <h2>Колір статусу</h2>
    <div class="palette">${COLORS.map(c => `<button data-c="${c}" class="${c.toLowerCase() === (current || '').toLowerCase() ? 'sel' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
    <label class="switch-row" for="customColor"><span>Свій колір</span><input type="color" id="customColor" value="${esc(current || '#8D8D8D')}" style="width:56px;height:40px;border:0;background:none;padding:0"></label>
    `, (el, close) => {
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { onPick(b.dataset.c); close(); });
    el.querySelector('#customColor').addEventListener('change', e => { onPick(e.target.value); close(); });
  });
}

/* ================= Навігація ================= */
const state = {
  tab: 'orders',
  stack: [],          // відкриті екрани поверх вкладок
  search: '',
  progressFilter: 'all',
  period: { mode: 'month', y: new Date().getFullYear(), m: new Date().getMonth() },
};

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
  const screen = top ? screens[top.name] : screens[state.tab];
  const main = document.getElementById('main');
  const res = screen(top ? top.params : {}, top);
  document.getElementById('title').textContent = res.title;
  document.getElementById('backBtn').hidden = !top;
  document.getElementById('settingsBtn').hidden = !!top;
  document.getElementById('tabbar').hidden = !!top;
  document.body.classList.toggle('no-tabbar', !!top);
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  main.innerHTML = res.html;
  if (res.mount) res.mount(main);
}

/* ================= Екрани ================= */
const screens = {};

/* ---------- Вкладка «Замовлення» ---------- */
screens.orders = () => ({
  title: 'Замовлення',
  html: `
    <div class="stack">
      <button class="btn" id="newOrder">+ Нове замовлення</button>
      <div class="search">${ICON.search}<input type="search" id="orderSearch" placeholder="Пошук за іменами" value="${esc(state.search)}" autocomplete="off"></div>
      <div id="ordersList"></div>
    </div>`,
  mount(el) {
    el.querySelector('#newOrder').onclick = () => push('orderForm', { id: null });
    const s = el.querySelector('#orderSearch');
    s.addEventListener('input', () => { state.search = s.value; drawOrders(); });
    drawOrders();
  },
});

function orderRow(o) {
  const balance = num(o.total) - num(o.prepay);
  let badge = '';
  if (num(o.total) > 0) {
    badge = o.balancePaid || balance <= 0
      ? `<span class="badge ok">Оплачено повністю</span>`
      : `<span class="badge warn">Залишок ${money(balance)}</span>`;
  }
  const meta = [o.organizer, o.pkg].filter(Boolean).map(esc).join(' · ');
  return `<button class="item" data-open="${o.id}">
    ${dateBox(o.date)}
    <div class="body">
      <div class="name">${esc(o.couple || 'Без імен')}</div>
      ${meta ? `<div class="meta">${meta}</div>` : ''}
      <div class="badges">${num(o.total) > 0 ? `<span class="badge num">${money(o.total)}</span>` : ''}${badge}</div>
    </div>${ICON.chev}</button>`;
}

function drawOrders() {
  const box = document.getElementById('ordersList');
  if (!box) return;
  const q = state.search.trim().toLowerCase();
  const list = db.orders.filter(o => !q || o.couple.toLowerCase().includes(q));
  if (!db.orders.length) {
    box.innerHTML = `<div class="empty"><b>Ще немає замовлень</b>Натисніть «+ Нове замовлення», щоб додати перше весілля.</div>`;
    return;
  }
  if (!list.length) { box.innerHTML = `<div class="empty"><b>Нічого не знайдено</b>Спробуйте інше ім’я.</div>`; return; }
  const today = todayStr();
  const upcoming = list.filter(o => o.date && o.date >= today).sort(sortAsc);
  const past = list.filter(o => o.date && o.date < today).sort((a, b) => sortAsc(b, a));
  const nodate = list.filter(o => !o.date);
  let html = '';
  if (upcoming.length) html += `<div class="section-title">Найближчі весілля · ${upcoming.length}</div><div class="list">${upcoming.map(orderRow).join('')}</div>`;
  if (nodate.length) html += `<div class="section-title">Без дати</div><div class="list">${nodate.map(orderRow).join('')}</div>`;
  if (past.length) html += `<div class="section-title">Минулі · ${past.length}</div><div class="list">${past.map(orderRow).join('')}</div>`;
  box.innerHTML = html;
  box.querySelectorAll('[data-open]').forEach(b => b.onclick = () => push('orderForm', { id: b.dataset.open }));
}

/* ---------- Форма замовлення ---------- */
screens.orderForm = (p, frame) => {
  if (!frame.draft) {
    const src = p.id ? db.orders.find(o => o.id === p.id) : null;
    frame.draft = src ? JSON.parse(JSON.stringify(src)) : {
      id: null, date: '', couple: '', organizer: '', pkg: '', total: 0, prepay: 0,
      balancePaid: false, comment: '', statusId: db.statuses[0] ? db.statuses[0].id : null, calc: normCalc(),
    };
  }
  const d = frame.draft;
  const isNew = !p.id;
  return {
    title: isNew ? 'Нове замовлення' : 'Замовлення',
    html: `
      <form class="form" id="orderForm" novalidate>
        <div class="field">
          <label for="fDate">Дата весілля</label>
          <input class="input" type="date" id="fDate" value="${esc(d.date)}">
          <div class="err" id="errDate" hidden>Вкажіть дату весілля</div>
        </div>
        <div class="field">
          <label for="fCouple">Імена молодят</label>
          <input class="input" id="fCouple" value="${esc(d.couple)}" placeholder="Напр. Олена та Максим" autocomplete="off" autocapitalize="words">
          <div class="err" id="errCouple" hidden>Вкажіть імена молодят</div>
        </div>
        <div class="field">
          <span class="label">Організатор</span>
          <button type="button" class="picker" id="fOrg">${d.organizer ? `<span>${esc(d.organizer)}</span>` : '<span class="ph">Вибрати або додати</span>'}${ICON.chev}</button>
        </div>
        <div class="field">
          <span class="label">Пакет послуг</span>
          <button type="button" class="picker" id="fPkg">${d.pkg ? `<span>${esc(d.pkg)}</span>` : '<span class="ph">Вибрати або додати</span>'}${ICON.chev}</button>
        </div>
        <div class="two">
          <div class="field">
            <label for="fTotal">Загальна вартість</label>
            <div class="money"><input class="input" id="fTotal" inputmode="decimal" value="${inputVal(d.total)}" placeholder="0"><span class="cur">грн</span></div>
          </div>
          <div class="field">
            <label for="fPrepay">Передоплата</label>
            <div class="money"><input class="input" id="fPrepay" inputmode="decimal" value="${inputVal(d.prepay)}" placeholder="0"><span class="cur">грн</span></div>
          </div>
        </div>
        <div class="calc-box">
          <div class="kv big"><span class="k">Залишок до оплати</span><span class="v" id="fBalance"></span></div>
        </div>
        <label class="switch-row" for="fPaid">
          <span>Залишок оплачено</span>
          <span class="switch"><input type="checkbox" id="fPaid" ${d.balancePaid ? 'checked' : ''}><span class="track"></span></span>
        </label>
        <div class="field">
          <label for="fComment">Коментар (необов’язково)</label>
          <textarea class="input" id="fComment" placeholder="Локація, побажання, контакти…">${esc(d.comment)}</textarea>
        </div>
        <button class="btn" type="submit">Зберегти</button>
        ${isNew ? '' : `
          <button class="btn secondary" type="button" id="toCalc">Розрахунок заробітку</button>
          <button class="btn danger" type="button" id="delOrder">Видалити замовлення</button>`}
      </form>`,
    mount(el) {
      const dirty = () => { frame.dirty = true; };
      const bal = () => {
        const b = num(d.total) - num(d.prepay);
        el.querySelector('#fBalance').textContent = d.balancePaid ? 'оплачено' : money(b);
        el.querySelector('#fBalance').style.color = d.balancePaid ? 'var(--ok)' : '';
      };
      const bind = (id, key, fn = v => v) => el.querySelector(id).addEventListener('input', e => { d[key] = fn(e.target.value); dirty(); bal(); });
      bind('#fDate', 'date');
      el.querySelector('#fDate').addEventListener('change', e => { d.date = e.target.value; dirty(); });
      bind('#fCouple', 'couple');
      bind('#fTotal', 'total', num);
      bind('#fPrepay', 'prepay', num);
      bind('#fComment', 'comment');
      el.querySelector('#fPaid').addEventListener('change', e => { d.balancePaid = e.target.checked; dirty(); bal(); });
      el.querySelector('#fOrg').onclick = () => openPicker({ title: 'Організатор', listKey: 'organizers', value: d.organizer, placeholder: 'Пошук або новий організатор', onPick: v => { d.organizer = v; dirty(); render(); } });
      el.querySelector('#fPkg').onclick = () => openPicker({ title: 'Пакет послуг', listKey: 'packages', value: d.pkg, placeholder: 'Пошук або новий пакет', onPick: v => { d.pkg = v; dirty(); render(); } });
      bal();
      el.querySelector('#orderForm').onsubmit = e => {
        e.preventDefault();
        let bad = false;
        el.querySelector('#errDate').hidden = !!d.date; if (!d.date) bad = true;
        el.querySelector('#fDate').classList.toggle('invalid', !d.date);
        const okCouple = d.couple.trim().length > 0;
        el.querySelector('#errCouple').hidden = okCouple; if (!okCouple) bad = true;
        el.querySelector('#fCouple').classList.toggle('invalid', !okCouple);
        if (bad) { toast('Заповніть дату та імена'); return; }
        d.couple = d.couple.trim();
        d.comment = d.comment.trim();
        if (d.id) {
          const i = db.orders.findIndex(o => o.id === d.id);
          if (i >= 0) db.orders[i] = { ...db.orders[i], ...d, calc: db.orders[i].calc };
        } else {
          d.id = uid();
          db.orders.push(d);
        }
        save();
        frame.dirty = false;
        state.stack.pop();
        render();
        toast(isNew ? 'Замовлення додано' : 'Зміни збережено');
      };
      const tc = el.querySelector('#toCalc');
      if (tc) tc.onclick = async () => {
        if (frame.dirty) {
          const ok = await confirmDialog({ title: 'Є незбережені зміни', text: 'Спершу збережіть замовлення або продовжіть без збереження.', ok: 'Продовжити без збереження' });
          if (!ok) return;
          frame.dirty = false; state.stack.pop();
        }
        push('calc', { id: p.id });
      };
      const del = el.querySelector('#delOrder');
      if (del) del.onclick = async () => {
        const ok = await confirmDialog({ title: 'Видалити замовлення?', text: `${d.couple || 'Замовлення'}, ${longDate(d.date)}. Цю дію не можна скасувати.`, ok: 'Видалити', danger: true });
        if (!ok) return;
        db.orders = db.orders.filter(o => o.id !== p.id);
        save(); frame.dirty = false; state.stack.pop(); render(); toast('Замовлення видалено');
      };
    },
  };
};

/* ---------- Вкладка «Заробіток» ---------- */
function inPeriod(o) {
  const d = parseDate(o.date);
  if (!d) return false;
  const p = state.period;
  return d.getFullYear() === p.y && (p.mode === 'year' || d.getMonth() === p.m);
}
function periodLabel() {
  const p = state.period;
  return p.mode === 'year' ? `${p.y} рік` : `${MONTHS[p.m]} ${p.y}`;
}
function shiftPeriod(dir) {
  const p = state.period;
  if (p.mode === 'year') p.y += dir;
  else { p.m += dir; if (p.m < 0) { p.m = 11; p.y--; } if (p.m > 11) { p.m = 0; p.y++; } }
  render();
}

screens.earnings = () => {
  const orders = db.orders.filter(inPeriod).sort(sortAsc);
  const ops = new Map(), eds = new Map();
  let sumTotal = 0, sumAgency = 0, sumNet = 0;
  for (const o of orders) {
    const c = calcOf(o);
    sumTotal += c.total; sumAgency += c.agency; sumNet += c.net;
    for (const p of o.calc.operators) {
      const n = p.name.trim() || 'Без імені';
      ops.set(n, (ops.get(n) || 0) + num(p.amount));
    }
    if (o.calc.editor.name || num(o.calc.editor.amount)) {
      const n = o.calc.editor.name.trim() || 'Без імені';
      eds.set(n, (eds.get(n) || 0) + num(o.calc.editor.amount));
    }
  }
  const rows = m => [...m.entries()].sort((a, b) => b[1] - a[1])
    .map(([n, v]) => `<div class="kv"><span class="k">${esc(n)}</span><span class="v">${money(v)}</span></div>`).join('');
  const p = state.period;
  return {
    title: 'Заробіток',
    html: `
      <div class="stack">
        <div class="seg" role="tablist">
          <button data-mode="month" class="${p.mode === 'month' ? 'on' : ''}">Місяць</button>
          <button data-mode="year" class="${p.mode === 'year' ? 'on' : ''}">Рік</button>
        </div>
        <div class="period">
          <button class="roundbtn" id="prevP" aria-label="Попередній період">${ICON.left}</button>
          <div class="lbl">${periodLabel()}</div>
          <button class="roundbtn" id="nextP" aria-label="Наступний період">${ICON.right}</button>
        </div>
        <div class="hero">
          <div class="k">Загальна сума за період без агентських</div>
          <div class="v">${money(sumNet)}</div>
          <div class="sub"><span>Замовлень: ${orders.length}</span><span>Сума замовлень: ${money(sumTotal)}</span><span>Агентські: ${money(sumAgency)}</span></div>
        </div>
        <div class="section-title">Оператори</div>
        ${ops.size ? `<div class="totals">${rows(ops)}</div>` : `<div class="note">За цей період немає даних про операторів.</div>`}
        <div class="section-title">Монтажери</div>
        ${eds.size ? `<div class="totals">${rows(eds)}</div>` : `<div class="note">За цей період немає даних про монтажерів.</div>`}
        <div class="section-title">Розрахунки замовлень · ${orders.length}</div>
        ${orders.length ? `<div class="list">${orders.map(o => {
          const c = calcOf(o);
          return `<button class="item" data-calc="${o.id}">${dateBox(o.date)}
            <div class="body"><div class="name">${esc(o.couple || 'Без імен')}</div>
            <div class="meta">Без агентських: <span class="num">${money(c.net)}</span></div>
            <div class="badges">${calcFilled(o) ? '<span class="badge ok">Розрахунок заповнено</span>' : '<span class="badge warn">Розрахунок не заповнено</span>'}</div></div>${ICON.chev}</button>`;
        }).join('')}</div>` : `<div class="empty"><b>Немає весіль у цьому періоді</b>Перемкніть місяць або рік стрілками вгорі.</div>`}
      </div>`,
    mount(el) {
      el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { state.period.mode = b.dataset.mode; render(); });
      el.querySelector('#prevP').onclick = () => shiftPeriod(-1);
      el.querySelector('#nextP').onclick = () => shiftPeriod(1);
      el.querySelectorAll('[data-calc]').forEach(b => b.onclick = () => push('calc', { id: b.dataset.calc }));
    },
  };
};

/* ---------- Розрахунок для замовлення ---------- */
screens.calc = (p, frame) => {
  const order = db.orders.find(o => o.id === p.id);
  if (!order) { state.stack.pop(); return screens[state.tab]({}); }
  if (!frame.draft) frame.draft = JSON.parse(JSON.stringify(order.calc || normCalc()));
  const c = frame.draft;
  const personRow = (pr, i) => `
    <div class="person">
      <button type="button" class="picker" data-op-name="${i}">${pr.name ? `<span>${esc(pr.name)}</span>` : '<span class="ph">Ім’я</span>'}</button>
      <div class="money"><input class="input" inputmode="decimal" data-op-amt="${i}" value="${inputVal(pr.amount)}" placeholder="0" aria-label="Заробіток оператора"><span class="cur">грн</span></div>
      <button type="button" class="xbtn" data-op-del="${i}" aria-label="Прибрати оператора">${ICON.x}</button>
    </div>`;
  return {
    title: 'Розрахунок',
    html: `
      <form class="form" id="calcForm" novalidate>
        <div class="card" style="display:flex;gap:14px;align-items:center">${dateBox(order.date)}
          <div style="min-width:0"><div style="font-weight:650;overflow-wrap:anywhere">${esc(order.couple)}</div><div class="muted small">${esc(longDate(order.date))}</div></div></div>

        <div class="section-title">Оператори</div>
        <div class="stack" id="opsBox">${c.operators.map(personRow).join('') || '<div class="note">Операторів ще не додано.</div>'}</div>
        <button type="button" class="btn secondary" id="addOp">+ Додати оператора</button>

        <div class="section-title">Монтажер</div>
        <div class="person" style="grid-template-columns:1fr 120px">
          <button type="button" class="picker" id="edName">${c.editor.name ? `<span>${esc(c.editor.name)}</span>` : '<span class="ph">Ім’я</span>'}</button>
          <div class="money"><input class="input" inputmode="decimal" id="edAmt" value="${inputVal(c.editor.amount)}" placeholder="0" aria-label="Заробіток монтажера"><span class="cur">грн</span></div>
        </div>

        <div class="section-title">Суми</div>
        <div class="calc-box">
          <div class="kv"><span class="k">Загальна сума замовлення</span><span class="v">${money(order.total)}</span></div>
          <div class="kv"><span class="k">Передоплата</span><span class="v">${money(order.prepay)}</span></div>
        </div>
        <div class="field">
          <label for="agPct">Агентський відсоток</label>
          <div class="pct"><input class="input" id="agPct" inputmode="decimal" value="${inputVal(c.agencyPct)}" placeholder="0"><span class="cur">%</span></div>
        </div>
        <div class="calc-box">
          <div class="kv"><span class="k">Агентська сума</span><span class="v" id="agAmt"></span></div>
          <div class="kv big"><span class="k">Сума без агентських</span><span class="v" id="netAmt"></span></div>
          <div class="kv"><span class="k">Виплати операторам і монтажеру</span><span class="v" id="teamAmt"></span></div>
          <div class="kv"><span class="k">Залишається після виплат</span><span class="v" id="restAmt"></span></div>
        </div>
        <div class="note">Загальна сума і передоплата беруться із замовлення. Щоб їх змінити, відредагуйте замовлення.</div>
        <button class="btn" type="submit">Зберегти розрахунок</button>
        <button class="btn ghost" type="button" id="editOrder">Відкрити замовлення</button>
      </form>`,
    mount(el) {
      const dirty = () => { frame.dirty = true; };
      const upd = () => {
        const r = calcOf({ ...order, calc: c });
        el.querySelector('#agAmt').textContent = money(r.agency);
        el.querySelector('#netAmt').textContent = money(r.net);
        el.querySelector('#teamAmt').textContent = money(r.team);
        el.querySelector('#restAmt').textContent = money(r.rest);
      };
      el.querySelector('#addOp').onclick = () => {
        openPicker({ title: 'Оператор', listKey: 'operators', value: '', placeholder: 'Пошук або новий оператор', onPick: v => { c.operators.push({ name: v, amount: 0 }); dirty(); render(); } });
      };
      el.querySelectorAll('[data-op-name]').forEach(b => b.onclick = () => {
        const i = +b.dataset.opName;
        openPicker({ title: 'Оператор', listKey: 'operators', value: c.operators[i].name, placeholder: 'Пошук або новий оператор', onPick: v => { c.operators[i].name = v; dirty(); render(); } });
      });
      el.querySelectorAll('[data-op-amt]').forEach(inp => inp.addEventListener('input', () => { c.operators[+inp.dataset.opAmt].amount = num(inp.value); dirty(); upd(); }));
      el.querySelectorAll('[data-op-del]').forEach(b => b.onclick = () => { c.operators.splice(+b.dataset.opDel, 1); dirty(); render(); });
      el.querySelector('#edName').onclick = () => openPicker({ title: 'Монтажер', listKey: 'editors', value: c.editor.name, placeholder: 'Пошук або новий монтажер', onPick: v => { c.editor.name = v; dirty(); render(); } });
      el.querySelector('#edAmt').addEventListener('input', e => { c.editor.amount = num(e.target.value); dirty(); upd(); });
      el.querySelector('#agPct').addEventListener('input', e => { c.agencyPct = num(e.target.value); dirty(); upd(); });
      upd();
      el.querySelector('#calcForm').onsubmit = e => {
        e.preventDefault();
        order.calc = normCalc(c);
        save(); frame.dirty = false; state.stack.pop(); render(); toast('Розрахунок збережено');
      };
      el.querySelector('#editOrder').onclick = async () => {
        if (frame.dirty) {
          const ok = await confirmDialog({ title: 'Є незбережені зміни', text: 'Зберегти розрахунок перед переходом?', ok: 'Зберегти й перейти' });
          if (!ok) return;
          order.calc = normCalc(c); save(); frame.dirty = false;
        }
        state.stack.pop();
        const prev = state.stack[state.stack.length - 1];
        if (prev && prev.name === 'orderForm' && prev.params.id === order.id) { prev.draft = null; prev.dirty = false; render(); }
        else push('orderForm', { id: order.id });
      };
    },
  };
};

/* ---------- Вкладка «Прогрес» ---------- */
screens.progress = () => {
  const f = state.progressFilter;
  if (f !== 'all' && f !== 'none' && !statusById(f)) state.progressFilter = 'all';
  const list = db.orders.filter(o => {
    if (state.progressFilter === 'all') return true;
    if (state.progressFilter === 'none') return !statusById(o.statusId);
    return o.statusId === state.progressFilter;
  }).sort(sortAsc);
  const count = id => db.orders.filter(o => id === 'none' ? !statusById(o.statusId) : o.statusId === id).length;
  const chip = (id, label, color) => `<button class="chip${state.progressFilter === id ? ' on' : ''}" data-f="${id}">${color ? `<span class="dot" style="background:${esc(color)}"></span>` : ''}${esc(label)}<span class="muted num">${id === 'all' ? db.orders.length : count(id)}</span></button>`;
  return {
    title: 'Прогрес',
    html: `
      <div class="stack">
        <div class="chips">
          ${chip('all', 'Усі')}
          ${db.statuses.map(s => chip(s.id, s.name, s.color)).join('')}
          ${count('none') ? chip('none', 'Без статусу') : ''}
        </div>
        <button class="btn ghost small" id="editStatuses" style="align-self:flex-start">Налаштувати статуси</button>
        ${list.length ? `<div class="list">${list.map(o => {
          const s = statusById(o.statusId);
          const style = s ? `background:${esc(s.color)}22;border-color:${esc(s.color)}` : 'background:var(--surface-2);border-color:var(--line)';
          return `<div class="prog">${dateBox(o.date)}<div class="body">
            <div class="name" style="font-weight:650;overflow-wrap:anywhere">${esc(o.couple || 'Без імен')}</div>
            ${o.pkg ? `<div class="meta muted small">${esc(o.pkg)}</div>` : ''}
            <button class="status-btn" data-st="${o.id}" style="${style}"><span class="dot" style="background:${s ? esc(s.color) : 'var(--muted)'}"></span>${esc(s ? s.name : 'Вибрати статус')}</button>
          </div></div>`;
        }).join('')}</div>` : `<div class="empty"><b>${db.orders.length ? 'Немає замовлень з цим статусом' : 'Ще немає замовлень'}</b>${db.orders.length ? 'Виберіть інший фільтр.' : 'Додайте замовлення на вкладці «Замовлення».'}</div>`}
      </div>`,
    mount(el) {
      el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { state.progressFilter = b.dataset.f; render(); });
      el.querySelector('#editStatuses').onclick = () => push('statuses');
      el.querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
        const o = db.orders.find(x => x.id === b.dataset.st);
        openStatusPicker(o, () => { render(); toast('Статус змінено'); });
      });
    },
  };
};

/* ---------- Статуси ---------- */
screens.statuses = () => ({
  title: 'Статуси',
  html: `
    <div class="stack">
      <div class="note">Торкніться кольорового квадрата, щоб змінити колір. Назва зберігається одразу. Стрілками змінюйте порядок.</div>
      ${db.statuses.length ? `<div class="menu">${db.statuses.map((s, i) => `
        <div class="status-edit">
          <button class="swatch" data-color="${s.id}" style="background:${esc(s.color)}" aria-label="Колір"></button>
          <input class="input" data-name="${s.id}" value="${esc(s.name)}" aria-label="Назва статусу">
          <button class="mini" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Вище">${ICON.up}</button>
          <button class="mini" data-down="${i}" ${i === db.statuses.length - 1 ? 'disabled' : ''} aria-label="Нижче">${ICON.down}</button>
          <button class="mini red" data-del="${s.id}" aria-label="Видалити">${ICON.x}</button>
        </div>`).join('')}</div>` : '<div class="empty"><b>Статусів немає</b>Створіть перший статус.</div>'}
      <button class="btn" id="addStatus">+ Новий статус</button>
    </div>`,
  mount(el) {
    el.querySelectorAll('[data-name]').forEach(inp => inp.addEventListener('change', () => {
      const s = statusById(inp.dataset.name);
      const v = inp.value.trim();
      if (!v) { inp.value = s.name; toast('Назва не може бути порожньою'); return; }
      s.name = v; save(); toast('Назву змінено');
    }));
    el.querySelectorAll('[data-color]').forEach(b => b.onclick = () => {
      const s = statusById(b.dataset.color);
      openColorPicker(s.color, c => { s.color = c; save(); render(); });
    });
    const move = (i, d) => { const a = db.statuses; [a[i], a[i + d]] = [a[i + d], a[i]]; save(); render(); };
    el.querySelectorAll('[data-up]').forEach(b => b.onclick = () => move(+b.dataset.up, -1));
    el.querySelectorAll('[data-down]').forEach(b => b.onclick = () => move(+b.dataset.down, 1));
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const s = statusById(b.dataset.del);
      const n = db.orders.filter(o => o.statusId === s.id).length;
      const ok = await confirmDialog({ title: `Видалити статус «${s.name}»?`, text: n ? `${n} замовл. з цим статусом стануть «без статусу».` : '', ok: 'Видалити', danger: true });
      if (!ok) return;
      db.statuses = db.statuses.filter(x => x.id !== s.id);
      db.orders.forEach(o => { if (o.statusId === s.id) o.statusId = null; });
      save(); render(); toast('Статус видалено');
    });
    el.querySelector('#addStatus').onclick = async () => {
      const name = await promptDialog({ title: 'Новий статус', placeholder: 'Напр. «Кольорокорекція»', ok: 'Далі: вибрати колір' });
      if (!name) return;
      const used = new Set(db.statuses.map(s => s.color));
      const s = { id: uid(), name, color: COLORS.find(c => !used.has(c)) || COLORS[0] };
      db.statuses.push(s); save(); render();
      openColorPicker(s.color, c => { s.color = c; save(); render(); });
    };
  },
});

/* ---------- Налаштування ---------- */
screens.settings = () => ({
  title: 'Налаштування',
  html: `
    <div class="stack">
      <div class="section-title">Резервна копія</div>
      <div class="note">Дані зберігаються лише на цьому пристрої. Регулярно робіть резервну копію і зберігайте файл у «Файлах», iCloud або надсилайте собі. Цей самий файл переносить усі дані на інший пристрій.</div>
      <button class="btn" id="exportBtn">Експорт резервної копії</button>
      <button class="btn secondary" id="importBtn">Імпорт резервної копії</button>
      <input type="file" id="importFile" accept=".json,application/json,text/plain" hidden>
      <div class="note">${db.lastBackup ? `Остання копія: ${esc(longDate(db.lastBackup.slice(0, 10)))}` : 'Резервну копію ще не робили.'}</div>

      <div class="section-title">Збережені списки</div>
      <div class="menu">
        ${Object.entries(LISTS).map(([k, v]) => `<button data-list="${k}"><span class="grow">${v.title}</span><span class="cnt">${db[k].length}</span>${ICON.chev}</button>`).join('')}
      </div>
      <div class="section-title">Прогрес</div>
      <div class="menu"><button id="toStatuses"><span class="grow">Статуси роботи</span><span class="cnt">${db.statuses.length}</span>${ICON.chev}</button></div>
      <div class="note" style="margin-top:12px">Замовлень у застосунку: ${db.orders.length}.</div>
    </div>`,
  mount(el) {
    el.querySelectorAll('[data-list]').forEach(b => b.onclick = () => push('listEdit', { key: b.dataset.list }));
    el.querySelector('#toStatuses').onclick = () => push('statuses');
    el.querySelector('#exportBtn').onclick = exportBackup;
    const fi = el.querySelector('#importFile');
    el.querySelector('#importBtn').onclick = () => fi.click();
    fi.addEventListener('change', () => { const f = fi.files[0]; fi.value = ''; if (f) importBackup(f); });
  },
});

async function exportBackup() {
  const now = new Date();
  const payload = { app: 'vesillya-orders', format: 1, exportedAt: now.toISOString(), data: db };
  const json = JSON.stringify(payload, null, 1);
  const name = `vesillya-kopiya-${todayStr()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const markDone = () => { db.lastBackup = now.toISOString(); save(); render(); toast('Резервну копію створено'); };
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Резервна копія замовлень' });
      markDone();
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    console.warn(e);
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  markDone();
}

function importBackup(file) {
  const r = new FileReader();
  r.onload = async () => {
    let parsed;
    try { parsed = JSON.parse(r.result); } catch { toast('Це не файл резервної копії'); return; }
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || !Array.isArray(data.orders)) { toast('У файлі немає замовлень. Виберіть файл резервної копії.'); return; }
    const when = parsed.exportedAt ? ` від ${longDate(parsed.exportedAt.slice(0, 10))}` : '';
    const ok = await confirmDialog({
      title: 'Замінити дані з копії?',
      text: `У файлі${when}: ${data.orders.length} замовл. Поточні дані на цьому пристрої (${db.orders.length} замовл.) буде замінено.`,
      ok: 'Замінити', danger: true,
    });
    if (!ok) return;
    db = normalize(data);
    save(); state.stack = [{ name: 'settings', params: {} }]; render();
    toast('Дані відновлено');
  };
  r.onerror = () => toast('Не вдалося прочитати файл');
  r.readAsText(file);
}

/* ---------- Редагування списків ---------- */
screens.listEdit = p => {
  const k = p.key, meta = LISTS[k];
  return {
    title: meta.title,
    html: `
      <div class="stack">
        <form class="row-btns" id="addForm" style="align-items:stretch">
          <input class="input" id="newItem" placeholder="Додати ${meta.one}" autocomplete="off" style="flex:1">
          <button class="btn small" type="submit" style="flex:none">Додати</button>
        </form>
        ${db[k].length ? `<div class="menu">${db[k].map((n, i) => `
          <div class="mrow"><span class="grow">${esc(n)}</span>
            <button class="mini" data-ren="${i}" aria-label="Перейменувати">${ICON.pen}</button>
            <button class="mini red" data-del="${i}" aria-label="Видалити">${ICON.x}</button></div>`).join('')}</div>`
          : `<div class="empty"><b>Список порожній</b>Додайте назву вище або прямо під час заповнення замовлення.</div>`}
        <div class="note">Перейменування оновлює назву і в усіх замовленнях. Видалення прибирає лише зі списку, вже збережені замовлення не змінюються.</div>
      </div>`,
    mount(el) {
      el.querySelector('#addForm').onsubmit = e => {
        e.preventDefault();
        const v = el.querySelector('#newItem').value.trim();
        if (!v) return;
        addToList(k, v); save(); render(); toast('Додано');
      };
      el.querySelectorAll('[data-ren]').forEach(b => b.onclick = async () => {
        const old = db[k][+b.dataset.ren];
        const v = await promptDialog({ title: 'Перейменувати', value: old });
        if (!v || v === old) return;
        db[k][+b.dataset.ren] = v;
        db[k] = [...new Set(db[k])].sort((a, c) => a.localeCompare(c, 'uk'));
        for (const o of db.orders) {
          if (k === 'organizers' && o.organizer === old) o.organizer = v;
          if (k === 'packages' && o.pkg === old) o.pkg = v;
          if (k === 'operators') o.calc.operators.forEach(pr => { if (pr.name === old) pr.name = v; });
          if (k === 'editors' && o.calc.editor.name === old) o.calc.editor.name = v;
        }
        save(); render(); toast('Перейменовано');
      });
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        const n = db[k][+b.dataset.del];
        const ok = await confirmDialog({ title: `Видалити «${n}» зі списку?`, ok: 'Видалити', danger: true });
        if (!ok) return;
        db[k].splice(+b.dataset.del, 1); save(); render(); toast('Видалено зі списку');
      });
    },
  };
};

/* ================= Старт ================= */
document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => {
  state.tab = b.dataset.tab; state.stack = []; render(); window.scrollTo(0, 0);
});
document.getElementById('backBtn').onclick = pop;
document.getElementById('settingsBtn').onclick = () => push('settings');
render();

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
