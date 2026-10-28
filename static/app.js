const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
let items = [];
let templates = {};
let leadDefaults = {};
let view = "meeting";
let calMonth = startOfMonth(today());
let editing = null;
let filters = { type: "", owner: "", q: "", showDone: false };

function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function daysUntil(s) { return Math.round((parse(s) - today()) / 86400000); }
function fmt(s, opts = { month: "short", day: "numeric" }) { return parse(s).toLocaleDateString(undefined, opts); }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function cls(type) { return type.replace(/\s+/g, "-"); }
function uid() { return Math.random().toString(36).slice(2, 10); }

function info(it) {
  const list = it.checklist || [];
  const doneCount = list.filter(c => c.done).length;
  const total = list.length;
  const done = total > 0 && doneCount === total;
  const days = daysUntil(it.date);
  const gmIdx = list.findIndex(c => c.gm);
  const gmPending = gmIdx >= 0 && !list[gmIdx].done && list.slice(0, gmIdx).every(c => c.done);
  const startBy = iso(addDays(parse(it.date), -(Number(it.leadDays) || 0)));
  const shouldStart = !done && doneCount === 0 && days > 7 && daysUntil(startBy) <= 0;
  const next = list.find(c => !c.done);
  let status = "Not started", tone = "";
  if (done) { status = "Done"; tone = "green"; }
  else if (days < 0) { status = "Overdue"; tone = "red"; }
  else if (gmPending) { status = "Needs Owner/GM sign-off"; tone = "purple"; }
  else if (doneCount > 0) { status = "In progress"; tone = "amber"; }
  return { doneCount, total, done, days, gmPending, startBy, shouldStart, next, status, tone, pct: total ? Math.round(doneCount / total * 100) : 0 };
}

function when(days) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${-days} days ago`;
  return `in ${days} days`;
}

function card(it, why = "") {
  const i = info(it);
  return `<div class="card t-${cls(it.type)}" data-id="${it.id}">
    <div class="t">${esc(it.title)}</div>
    <div class="m">${esc(it.type)} · ${fmt(it.date)} (${when(i.days)})${it.owner ? " · " + esc(it.owner) : ""}</div>
    ${why ? `<div class="why">${why}</div>` : ""}
    <div class="bar"><i style="width:${i.pct}%"></i></div>
    <div class="m">${i.doneCount}/${i.total} steps · <span class="pill ${i.tone}">${i.status}</span></div>
  </div>`;
}

function section(title, color, list, whyFn, emptyText) {
  return `<div class="section"><h3><span class="dot" style="background:${color}"></span>${title} <span class="pill">${list.length}</span></h3>
    ${list.length ? `<div class="cards">${list.map(it => card(it, whyFn ? whyFn(it) : "")).join("")}</div>` : `<div class="empty">${emptyText}</div>`}</div>`;
}

function byDate(a, b) { return a.date.localeCompare(b.date); }

function launchGaps() {
  const gaps = [];
  const start = startOfMonth(today());
  for (let k = 1; k <= 6; k++) {
    const m = new Date(start.getFullYear(), start.getMonth() + k, 1);
    const has = items.some(it => it.type === "Launch" && parse(it.date).getFullYear() === m.getFullYear() && parse(it.date).getMonth() === m.getMonth());
    if (!has) gaps.push(`${MONTHS[m.getMonth()]} ${m.getFullYear()}`);
  }
  return gaps;
}

function renderMeeting() {
  const open = items.filter(it => !info(it).done).sort(byDate);
  const overdue = open.filter(it => info(it).days < 0);
  const week = open.filter(it => { const d = info(it).days; return d >= 0 && d <= 7; });
  const gm = open.filter(it => info(it).gmPending && info(it).days >= 0);
  const start = open.filter(it => info(it).shouldStart);
  const month = open.filter(it => { const d = info(it).days; return d > 7 && d <= 30 && !info(it).shouldStart && !info(it).gmPending; });
  const gaps = launchGaps();
  const nextStep = it => { const i = info(it); return i.next ? `Next step: <b>${esc(i.next.text)}</b>` : ""; };
  return `
    <h2>This week's meeting</h2>
    <p class="sub">What needs attention right now. Click any card to open its checklist.</p>
    <div class="summary">
      <div class="stat red"><b>${overdue.length}</b><span>Overdue</span></div>
      <div class="stat amber"><b>${week.length}</b><span>Due in the next 7 days</span></div>
      <div class="stat purple"><b>${gm.length}</b><span>Waiting on Owner/GM</span></div>
      <div class="stat blue"><b>${start.length}</b><span>Should be started</span></div>
    </div>
    ${section("Overdue", "var(--red)", overdue, nextStep, "Nothing overdue.")}
    ${section("Due in the next 7 days", "var(--amber)", week, nextStep, "Nothing due this week.")}
    ${section("Waiting on Owner/GM sign-off", "var(--purple)", gm, () => "Everything before sign-off is done", "Nothing waiting on sign-off.")}
    ${section("Should be started by now", "var(--accent)", start, it => `Start-by date was ${fmt(info(it).startBy)}, but no steps are checked yet`, "Everything that should be underway has started.")}
    ${section("Coming up in the next 30 days", "#888", month, nextStep, "Nothing else in the next 30 days.")}
    <div class="section"><h3><span class="dot" style="background:var(--amber)"></span>Planning check: next 6 months</h3>
      ${gaps.length ? `<div class="gaps">No campaign launch is on the calendar yet for:<ul>${gaps.map(g => `<li>${g}</li>`).join("")}</ul></div>` : `<div class="empty">Every month in the next 6 has at least one launch.</div>`}
    </div>`;
}

function renderCalendar() {
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const first = new Date(y, m, 1);
  const gridStart = addDays(first, -first.getDay());
  const t = iso(today());
  let cells = DOW.map(d => `<div class="dow">${d}</div>`).join("");
  for (let k = 0; k < 42; k++) {
    const d = addDays(gridStart, k);
    const key = iso(d);
    const dayItems = items.filter(it => it.date === key);
    cells += `<div class="day ${d.getMonth() !== m ? "other" : ""} ${key === t ? "today" : ""}" data-date="${key}">
      <span class="n">${d.getDate()}</span>
      ${dayItems.map(it => `<span class="chip ${cls(it.type)} ${info(it).done ? "done" : ""}" data-id="${it.id}" title="${esc(it.title)}">${esc(it.title)}</span>`).join("")}
    </div>`;
    if (k >= 34 && addDays(gridStart, k + 1).getMonth() !== m && (k + 1) % 7 === 0) break;
  }
  return `<div class="cal-head">
      <h2>${MONTHS[m]} ${y}</h2>
      <button data-cal="-1">‹ Prev</button><button data-cal="0">Today</button><button data-cal="1">Next ›</button>
    </div>
    <div class="cal">${cells}</div>
    <div class="legend">
      <span><span class="dot" style="background:var(--launch)"></span> Launch</span>
      <span><span class="dot" style="background:var(--shoot)"></span> Shoot</span>
      <span><span class="dot" style="background:var(--idea)"></span> Content idea</span>
      <span><span class="dot" style="background:var(--other)"></span> Other</span>
      <span>Click a day to add an item there.</span>
    </div>`;
}

function renderPlan() {
  const start = startOfMonth(today());
  let cols = "";
  for (let k = 0; k <= 6; k++) {
    const mDate = new Date(start.getFullYear(), start.getMonth() + k, 1);
    const inMonth = items.filter(it => { const d = parse(it.date); return d.getFullYear() === mDate.getFullYear() && d.getMonth() === mDate.getMonth(); }).sort(byDate);
    const hasLaunch = inMonth.some(it => it.type === "Launch");
    cols += `<div class="col"><h4>${MONTHS[mDate.getMonth()]} <span>${mDate.getFullYear()}</span></h4>
      ${hasLaunch ? "" : `<div class="nolaunch">No launch planned</div>`}
      ${inMonth.map(it => card(it)).join("") || `<div class="m" style="color:var(--muted);font-size:13px">Nothing scheduled</div>`}
    </div>`;
  }
  return `<h2>6-month plan</h2>
    <p class="sub">This month plus the next 6, so seasonal campaigns get planned early.</p>
    <div class="plan">${cols}</div>`;
}

function renderList() {
  const owners = [...new Set(items.map(it => it.owner).filter(Boolean))].sort();
  const q = filters.q.toLowerCase();
  const rows = items.filter(it =>
    (!filters.type || it.type === filters.type) &&
    (!filters.owner || it.owner === filters.owner) &&
    (filters.showDone || !info(it).done) &&
    (!q || (it.title + " " + (it.notes || "") + " " + (it.channel || "")).toLowerCase().includes(q))
  ).sort(byDate);
  return `<h2>All items</h2>
    <div class="filters">
      <input id="fq" placeholder="Search…" value="${esc(filters.q)}">
      <select id="ftype"><option value="">All types</option>${["Launch", "Shoot", "Content Idea", "Other"].map(t => `<option ${filters.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <select id="fowner"><option value="">All owners</option>${owners.map(o => `<option ${filters.owner === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>
      <label style="display:flex;align-items:center;gap:6px;margin:0;font-weight:500"><input type="checkbox" id="fdone" style="width:auto;margin:0" ${filters.showDone ? "checked" : ""}> Show completed</label>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Title</th><th class="hide-sm">Type</th><th>Owner</th><th class="hide-sm">Progress</th><th>Status</th></tr></thead>
      <tbody>${rows.map(it => { const i = info(it); return `<tr class="click" data-id="${it.id}">
        <td>${fmt(it.date, { month: "short", day: "numeric", year: "2-digit" })}</td><td><b>${esc(it.title)}</b>${it.channel ? `<div class="m" style="color:var(--muted);font-size:12px">${esc(it.channel)}</div>` : ""}</td>
        <td class="hide-sm">${esc(it.type)}</td><td>${esc(it.owner) || "—"}</td><td class="hide-sm">${i.doneCount}/${i.total}</td><td><span class="pill ${i.tone}">${i.status}</span></td></tr>`; }).join("") || `<tr><td colspan="6" style="color:var(--muted)">No items match.</td></tr>`}</tbody>
    </table></div>`;
}

function render() {
  const el = document.getElementById("view");
  el.innerHTML = { meeting: renderMeeting, calendar: renderCalendar, plan: renderPlan, list: renderList }[view]();
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.getElementById("owners").innerHTML = [...new Set(items.map(it => it.owner).filter(Boolean))].map(o => `<option value="${esc(o)}">`).join("");
}

async function load() {
  const res = await fetch("/api/items");
  items = await res.json();
  render();
}

function newChecklist(type) {
  return (templates[type] || []).map(text => ({ id: uid(), text, done: false, gm: text.includes("Owner/GM") }));
}

function openEditor(it) {
  editing = JSON.parse(JSON.stringify(it));
  const f = document.getElementById("editForm");
  f.title.value = editing.title || "";
  f.type.value = editing.type || "Launch";
  f.date.value = editing.date || iso(today());
  f.owner.value = editing.owner || "";
  f.channel.value = editing.channel || "";
  f.leadDays.value = editing.leadDays ?? leadDefaults[f.type.value] ?? 30;
  f.notes.value = editing.notes || "";
  document.getElementById("edTitle").textContent = editing.id ? "Edit item" : "New item";
  document.getElementById("deleteBtn").style.display = editing.id ? "" : "none";
  renderChecklist();
  document.getElementById("editor").showModal();
}

function renderChecklist() {
  const ul = document.getElementById("edChecklist");
  const list = editing.checklist || [];
  ul.innerHTML = list.map((c, idx) => `<li class="${c.gm ? "gm" : ""} ${c.done ? "done" : ""}">
    <input type="checkbox" data-idx="${idx}" ${c.done ? "checked" : ""}>
    <span class="txt">${esc(c.text)}${c.gm ? ' <span class="pill purple">Sign-off</span>' : ""}</span>
    ${c.done && c.doneAt ? `<span class="when">${fmt(c.doneAt)}</span>` : ""}
    <button type="button" data-up="${idx}" title="Move up">↑</button>
    <button type="button" data-rm="${idx}" title="Remove">✕</button>
  </li>`).join("") || `<li style="color:var(--muted)">No steps yet.</li>`;
  const done = list.filter(c => c.done).length;
  document.getElementById("edProgress").textContent = list.length ? `${done} of ${list.length} done` : "";
}

function readForm() {
  const f = document.getElementById("editForm");
  Object.assign(editing, {
    title: f.title.value.trim(), type: f.type.value, date: f.date.value, owner: f.owner.value.trim(),
    channel: f.channel.value.trim(), leadDays: Number(f.leadDays.value) || 0, notes: f.notes.value,
  });
}

async function save() {
  readForm();
  if (!editing.title || !editing.date) return;
  const url = editing.id ? `/api/items/${editing.id}` : "/api/items";
  await fetch(url, { method: editing.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
  document.getElementById("editor").close();
  editing = null;
  await load();
}

document.addEventListener("click", e => {
  const tab = e.target.closest("#tabs button");
  if (tab) { view = tab.dataset.view; render(); return; }
  const calBtn = e.target.closest("[data-cal]");
  if (calBtn) {
    const n = Number(calBtn.dataset.cal);
    calMonth = n === 0 ? startOfMonth(today()) : new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1);
    render(); return;
  }
  const target = e.target.closest("#view [data-id]");
  if (target) { const it = items.find(x => x.id === target.dataset.id); if (it) openEditor(it); return; }
  const day = e.target.closest(".day[data-date]");
  if (day) { openEditor({ type: "Launch", date: day.dataset.date, checklist: newChecklist("Launch"), leadDays: leadDefaults.Launch }); }
});

document.getElementById("view").addEventListener("input", e => {
  if (e.target.id === "fq") { filters.q = e.target.value; const pos = e.target.selectionStart; render(); const q = document.getElementById("fq"); q.focus(); q.setSelectionRange(pos, pos); }
});
document.getElementById("view").addEventListener("change", e => {
  if (e.target.id === "ftype") filters.type = e.target.value;
  else if (e.target.id === "fowner") filters.owner = e.target.value;
  else if (e.target.id === "fdone") filters.showDone = e.target.checked;
  else return;
  render();
});

document.getElementById("addBtn").onclick = () => openEditor({ type: "Launch", date: iso(today()), checklist: newChecklist("Launch"), leadDays: leadDefaults.Launch });
document.getElementById("closeBtn").onclick = document.getElementById("cancelBtn").onclick = () => { document.getElementById("editor").close(); editing = null; };
document.getElementById("editForm").onsubmit = e => { e.preventDefault(); save(); };
document.getElementById("deleteBtn").onclick = async () => {
  if (!confirm(`Delete "${editing.title}"?`)) return;
  await fetch(`/api/items/${editing.id}`, { method: "DELETE" });
  document.getElementById("editor").close();
  editing = null;
  await load();
};
document.getElementById("editForm").type.onchange = e => {
  const t = e.target.value;
  const untouched = !(editing.checklist || []).some(c => c.done);
  if (untouched && (!editing.id || confirm("Swap in the standard checklist for " + t + "?"))) {
    editing.checklist = newChecklist(t);
    document.getElementById("editForm").leadDays.value = leadDefaults[t];
    renderChecklist();
  }
};
document.getElementById("edChecklist").addEventListener("click", e => {
  const list = editing.checklist;
  if (e.target.dataset.rm !== undefined) { list.splice(Number(e.target.dataset.rm), 1); renderChecklist(); }
  else if (e.target.dataset.up !== undefined) { const i = Number(e.target.dataset.up); if (i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]]; renderChecklist(); }
});
document.getElementById("edChecklist").addEventListener("change", e => {
  const idx = e.target.dataset.idx;
  if (idx === undefined) return;
  const c = editing.checklist[Number(idx)];
  c.done = e.target.checked;
  c.doneAt = c.done ? iso(today()) : null;
  renderChecklist();
});
function addStep() {
  const input = document.getElementById("newStep");
  const text = input.value.trim();
  if (!text) return;
  editing.checklist = editing.checklist || [];
  editing.checklist.push({ id: uid(), text, done: false, gm: /owner|gm|sign.?off/i.test(text) });
  input.value = "";
  renderChecklist();
}
document.getElementById("addStep").onclick = addStep;
document.getElementById("newStep").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addStep(); } });

document.getElementById("today").textContent = today().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

(async () => {
  const t = await (await fetch("/api/templates")).json();
  templates = t.templates; leadDefaults = t.leadDays;
  await load();
  setInterval(() => { if (!document.getElementById("editor").open) load(); }, 20000);
})();
