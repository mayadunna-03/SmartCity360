/* SmartCity360 – baseline UI with mock data. Replace the mock logic with API calls later. */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = b => b > 1e6 ? (b / 1e6).toFixed(2) + ' MB' : b > 1e3 ? (b / 1e3).toFixed(1) + ' KB' : b + ' B';
const now = () => new Date().toLocaleTimeString();

/* ---------- Navigation ---------- */
function route() {
  const id = (location.hash || '#home').slice(1);
  const target = document.getElementById(id) && document.getElementById(id).classList.contains('view') ? id : 'home';
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === target));
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + target));
}
window.addEventListener('hashchange', route);

/* ---------- A: Decorator ---------- */
const aLog = [];
$('#a-send').onclick = () => {
  const payload = $('#a-payload').value;
  const steps = [['Meter (raw)', payload]];
  let data = payload;
  if ($('#a-auth').checked) { data = 'TOKEN-7F3A|' + data; steps.push(['Authentication', data]); }
  if ($('#a-comp').checked) { data = 'gz:' + data.replace(/(.)\1+/g, (m, c) => c + m.length); steps.push(['Compression', data]); }
  if ($('#a-enc').checked) { data = btoa(unescape(encodeURIComponent(data)).split('').reverse().join('')); steps.push(['Encryption', data]); }
  $('#a-steps tbody').innerHTML = steps.map(s => `<tr><td>${s[0]}</td><td>${esc(s[1])}</td><td>${s[1].length}</td></tr>`).join('');
  const layers = steps.slice(1).map(s => s[0]).join(' → ') || 'none';
  aLog.unshift(`${now()} · ${esc($('#a-meter').value)} · layers: ${layers} · ${data.length} bytes`);
  $('#a-log').innerHTML = aLog.slice(0, 6).map(l => `<li>${l}</li>`).join('');
};

/* ---------- B: Composite ---------- */
const leaf = (n, kwh) => ({ n, t: 'building', kwh, on: true });
const zone = (n, t, c) => ({ n, t, c, on: true, open: t !== 'street' });
const city = zone('Colombo', 'city', [
  zone('District Central', 'district', [
    zone('Galle Road', 'street', [leaf('Building 12', 120), leaf('Building 14', 95), leaf('Building 18', 210)]),
    zone('Fort Street', 'street', [leaf('Building 3', 150), leaf('Building 7', 80)]),
  ]),
  zone('District Harbour', 'district', [
    zone('Port Lane', 'street', [leaf('Warehouse A', 400), leaf('Warehouse B', 360)]),
  ]),
]);
let bSel = city;
const usage = n => n.c ? n.c.reduce((s, x) => s + usage(x), 0) : n.kwh;                       // same call for leaf and composite
const count = (n, f) => n.c ? n.c.reduce((s, x) => s + count(x, f), 0) : (f(n) ? 1 : 0);
const setPower = (n, v) => { n.on = v; (n.c || []).forEach(x => setPower(x, v)); };
function bRender() {
  const li = n => `<li><span class="t" data-t="${esc(n.n)}">${n.c ? (n.open ? '▾' : '▸') : '•'}</span><span class="n ${n === bSel ? 'sel' : ''} ${n.on ? '' : 'off'}" data-n="${esc(n.n)}">${esc(n.n)}</span>`
    + (n.c && n.open ? `<ul>${n.c.map(li).join('')}</ul>` : '') + '</li>';
  $('#b-tree').innerHTML = `<ul>${li(city)}</ul>`;
  $('#b-sel').textContent = bSel.n; $('#b-type').textContent = bSel.t;
}
const find = (n, name) => n.n === name ? n : (n.c || []).map(x => find(x, name)).find(Boolean);
$('#b-tree').onclick = e => {
  const t = e.target.dataset;
  if (t.n) bSel = find(city, t.n); else if (t.t) { const n = find(city, t.t); n.open = !n.open; }
  bRender();
};
$('#b-off').onclick = () => { setPower(bSel, false); bRender(); $('#b-result').innerHTML = `<span class="bad">Power shut down</span> for <b>${esc(bSel.n)}</b> (${count(bSel, x => true)} building(s) affected).`; };
$('#b-on').onclick = () => { setPower(bSel, true); bRender(); $('#b-result').innerHTML = `<span class="ok">Power restored</span> for <b>${esc(bSel.n)}</b>.`; };
$('#b-rep').onclick = () => {
  const total = count(bSel, () => true), off = count(bSel, x => !x.on);
  $('#b-result').innerHTML = `<b>${esc(bSel.n)}</b>: ${usage(bSel)} kWh across ${total} building(s); ${total - off} powered, ${off} off.`;
};

/* ---------- C: Chain of Responsibility ---------- */
const complaints = [];
const SEV = ['', 'Low', 'Medium', 'High', 'Critical'];
function handlers() {
  return [{ name: 'Local staff', max: 1 }, ...($('#c-sup').checked ? [{ name: 'Supervisor', max: 2 }] : []), { name: 'City manager', max: 4 }];
}
function cRender() {
  $('#c-table tbody').innerHTML = complaints.map(c => `<tr data-id="${c.id}" class="${c.id === cSel ? 'sel' : ''}"><td>${c.id}</td><td>${esc(c.cat)}</td><td>${SEV[c.sev]}</td><td>${c.by}</td></tr>`).join('');
}
let cSel = null;
$('#c-submit').onclick = () => {
  const c = { id: complaints.length + 1, cat: $('#c-cat').value, sev: +$('#c-sev').value, desc: $('#c-desc').value, trace: [], by: '' };
  for (const h of handlers()) {                                          // walk the chain
    if (c.sev <= h.max) { c.trace.push(`${now()} · ${h.name} resolved`); c.by = h.name; break; }
    c.trace.push(`${now()} · ${h.name} escalated`);
  }
  complaints.unshift(c); cSel = c.id; cRender(); cTrace(c);
};
function cTrace(c) { $('#c-sel').textContent = '(#' + c.id + ')'; $('#c-trace').innerHTML = c.trace.map(t => `<li>${t}</li>`).join(''); }
$('#c-table').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (!tr) return; cSel = +tr.dataset.id; cTrace(complaints.find(c => c.id === cSel)); cRender(); };

/* ---------- D: Flyweight ---------- */
const TYPES = [
  { key: 'LED60-STD', model: 'LumaLED 60', watts: 60, profile: 'Dusk-Dawn', w: .6 },
  { key: 'LED100-HWY', model: 'LumaLED 100', watts: 100, profile: 'Highway', w: .25 },
  { key: 'LED40-PARK', model: 'LumaLED 40', watts: 40, profile: 'Park-Dim', w: .15 },
];
const factory = new Map();                                              // flyweight cache
const getType = key => { if (!factory.has(key)) factory.set(key, { ...TYPES.find(t => t.key === key), used: 0 }); return factory.get(key); };
$('#d-gen').onclick = () => {
  const n = Math.max(1, Math.min(200000, +$('#d-n').value || 1));
  factory.clear(); const lights = [];
  for (let i = 1; i <= n; i++) {
    const r = Math.random(); const key = r < .6 ? TYPES[0].key : r < .85 ? TYPES[1].key : TYPES[2].key;
    const t = getType(key); t.used++;
    if (i <= 10) lights.push({ id: 'SL-' + String(i).padStart(5, '0'), lat: (6.90 + Math.random() * .1).toFixed(5), lng: (79.84 + Math.random() * .1).toFixed(5), key });
  }
  const without = n * 1064, withFw = n * 48 + factory.size * 1000;
  $('#d-stats').innerHTML = `<div>Lights<b>${n.toLocaleString()}</b></div><div>Shared type objects<b>${factory.size}</b></div>
    <div>Memory without Flyweight<b>${fmt(without)}</b></div><div>Memory with Flyweight<b>${fmt(withFw)}</b></div>
    <div style="grid-column:span 2">Estimated saving<b>${(100 - withFw / without * 100).toFixed(1)}%</b></div>`;
  $('#d-types tbody').innerHTML = [...factory.values()].map(t => `<tr><td>${t.key}</td><td>${t.model}</td><td>${t.watts}</td><td>${t.profile}</td><td>${t.used.toLocaleString()}</td></tr>`).join('');
  $('#d-lights tbody').innerHTML = lights.map(l => `<tr><td>${l.id}</td><td>${l.lat}</td><td>${l.lng}</td><td>${l.key}</td></tr>`).join('');
};

/* ---------- E: Interpreter ---------- */
const RULES = {
  'Night noise limit': 'noise_level > 70 AND hour > 22',
  'Overnight parking': 'parked_minutes > 60 AND (hour > 22 OR hour < 6)',
  'Quiet hour check': 'NOT (noise_level < 50) AND hour == 23',
};
$('#e-saved').innerHTML = Object.keys(RULES).map(k => `<option>${k}</option>`).join('');
$('#e-saved').onchange = () => $('#e-rule').value = RULES[$('#e-saved').value];
$('#e-rule').value = RULES['Night noise limit'];

function parse(src) {                                                   // client: builds the expression tree
  const tk = src.match(/\(|\)|==|>|<|[A-Za-z_]+|\d+/g) || []; let p = 0;
  const peek = () => (tk[p] || '').toUpperCase(), next = () => tk[p++];
  const VARS = ['noise_level', 'hour', 'parked_minutes'];
  const operand = () => {
    const t = next(); if (t === undefined) throw Error('Unexpected end of rule');
    if (/^\d+$/.test(t)) return { t: 'NUM', v: +t };
    if (!VARS.includes(t)) throw Error('Unknown variable: ' + t);
    return { t: 'VAR', name: t };
  };
  const atom = () => {
    if (peek() === '(') { next(); const e = or(); if (next() !== ')') throw Error('Missing )'); return e; }
    const l = operand(), op = next();
    if (!['>', '<', '=='].includes(op)) throw Error('Expected > < or == near ' + (op || 'end'));
    return { t: 'CMP', op, l, r: operand() };
  };
  const not = () => { if (peek() === 'NOT') { next(); return { t: 'NOT', e: not() }; } return atom(); };
  const and = () => { let l = not(); while (peek() === 'AND') { next(); l = { t: 'AND', l, r: not() }; } return l; };
  const or = () => { let l = and(); while (peek() === 'OR') { next(); l = { t: 'OR', l, r: and() }; } return l; };
  const tree = or(); if (p < tk.length) throw Error('Unexpected: ' + tk[p]); return tree;
}
function interpret(n, ctx) {                                            // each node interprets itself
  switch (n.t) {
    case 'NUM': return n.v;
    case 'VAR': return ctx[n.name];
    case 'CMP': { const a = interpret(n.l, ctx), b = interpret(n.r, ctx); return n.op === '>' ? a > b : n.op === '<' ? a < b : a === b; }
    case 'AND': return interpret(n.l, ctx) && interpret(n.r, ctx);
    case 'OR': return interpret(n.l, ctx) || interpret(n.r, ctx);
    case 'NOT': return !interpret(n.e, ctx);
  }
}
const show = (n, d = 0) => '  '.repeat(d) + (n.t === 'NUM' ? n.v : n.t === 'VAR' ? n.name : n.t === 'CMP' ? 'CMP ' + n.op : n.t) + '\n'
  + [n.l, n.r, n.e].filter(Boolean).map(x => show(x, d + 1)).join('');
$('#e-run').onclick = () => {
  const ctx = { noise_level: +$('#e-noise').value, hour: +$('#e-hour').value, parked_minutes: +$('#e-park').value };
  try {
    const tree = parse($('#e-rule').value), ok = interpret(tree, ctx);
    $('#e-result').innerHTML = ok ? '<span class="bad">Rule matched – violation triggered</span>' : '<span class="ok">Rule not matched – no violation</span>';
    $('#e-tree').textContent = show(tree);
  } catch (err) { $('#e-result').innerHTML = `<span class="bad">Rule error:</span> ${esc(err.message)}`; $('#e-tree').textContent = ''; }
};

/* ---------- init ---------- */
bRender(); cRender(); route();
$('#a-send').click(); $('#d-gen').click(); $('#e-run').click();
