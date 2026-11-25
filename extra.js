/* Kutipat: the selector finder (like SelectorsHub), sitemaps (like Web Scraper) and saving a page’s resources.
   Uses panel.js’s tab(), setMsg(), prog(), save() and csvCell(). Pages are read only after you allow each site. */
(() => { // its own scope, so names here never clash with panel.js
const tool = async (name, ...args) => { const t = await tab(); await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["tools.js"] });
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: (n, a) => Promise.resolve(window.__kutipatTools[n](...a)), args: [name, args] }); return result; };
const rlog = (...a) => window.kutipatLog?.(...a), red = v => window.kutipatRedact ? window.kutipatRedact(v) : v;
const escH = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ensureSite = async () => { const t = await tab(), o = new URL(t.url).origin + "/*"; if (await chrome.permissions.contains({ origins: [o] })) return true; return chrome.permissions.request({ origins: [o] }); };
const guard = async (el, f) => { try { if (!(await ensureSite())) return setMsg(el, "Kutipat needs permission to read this site. Choose Allow to continue.", "warn"); await f(); } catch (e) { setMsg(el, /Cannot access|chrome:\/\//.test(e.message) ? "Chrome doesn’t let extensions read this page." : "Couldn’t do that: " + e.message, "warn"); } };

/* ---------- 1. the selector finder ---------- */
function showSelectors(r, el = $("#selOut"), onUse) {
  if (!r) { el.innerHTML = ""; return; }
  el.innerHTML = `<p class="hint">Picked <code>${escH(r.tag)}</code>: “${escH(r.sample)}”</p><div class="sout">${r.selectors.map((s, i) => `<div><small><b>${escH(s.note)}</b> · matches ${s.count}</small><span class="row"><button class="btn" data-i="${i}" data-a="copy">Copy</button>${s.kind !== "js" ? `<button class="btn" data-i="${i}" data-a="test">Test</button>` : ""}${onUse && s.kind !== "js" ? `<button class="btn" data-i="${i}" data-a="use">Use</button>` : ""}</span><code>${escH(s.expr)}</code></div>`).join("")}</div>`;
  el.onclick = async e => { const b = e.target.closest("[data-a]"); if (!b) return; const s = r.selectors[+b.dataset.i];
    if (b.dataset.a === "copy") { await navigator.clipboard.writeText(s.expr); setMsg($("#selMsg"), "Copied the selector.", "ok"); }
    if (b.dataset.a === "test") { $("#selTest").value = s.expr; $("#selTestB").click(); }
    if (b.dataset.a === "use") onUse(s.expr); };
}
$("#selPick").onclick = () => guard($("#selMsg"), async () => { setMsg($("#selMsg"), "Click an element on the page. Esc cancels."); const r = await tool("pickEl"); setMsg($("#selMsg"), r ? "Picked. Copy or test a selector below." : ""); showSelectors(r); });
$("#selTestB").onclick = () => guard($("#selMsg"), async () => { const x = $("#selTest").value.trim(); if (!x) return; const r = await tool("test", x);
  setMsg($("#selMsg"), r.error || (r.count ? `Matches ${r.count} element${r.count > 1 ? "s" : ""} (${r.visible} visible), outlined in orange: ${r.samples.map(s => `“${s}”`).join(", ")}` : "No matches on this page."), r.error || !r.count ? "warn" : "ok"); });
$("#selTest").onkeydown = e => { if (e.key === "Enter") $("#selTestB").click(); };
$("#selClear").onclick = () => tool("clear").catch(() => {});

/* ---------- 2. sitemaps ---------- */
const TYPES = [["element", "Element (one row each)"], ["text", "Text"], ["link", "Link"], ["image", "Image"], ["attribute", "Attribute"], ["html", "HTML"], ["table", "Table"], ["pagination", "Pagination (next pages)"]];
let MAP = { name: "", start: "", sels: [] }, RESULT = [], stopping = false;
const sid = () => "s" + Math.random().toString(36).slice(2, 7);
function drawSels() {
  const box = $("#mapSels"); if (!MAP.sels.length) { box.innerHTML = `<p class="hint">No selectors yet. Add one, then Pick it on the page.</p>`; return; }
  const parents = s => [["_root", "The page"], ...MAP.sels.filter(x => x.id !== s.id && (x.type === "element" || (x.type === "link" && x.follow))).map(x => [x.id, (x.type === "link" ? "Pages from link: " : "Inside: ") + (x.name || x.id)])];
  box.innerHTML = MAP.sels.map((s, i) => `<div class="sel" data-i="${i}">
    <div class="two"><input data-k="name" value="${escH(s.name)}" placeholder="Column name" aria-label="Selector name"><select data-k="type" aria-label="Type">${TYPES.map(([v, t]) => `<option value="${v}" ${s.type === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
    <select data-k="parent" aria-label="Where it applies">${parents(s).map(([v, t]) => `<option value="${v}" ${s.parent === v ? "selected" : ""}>${escH(t)}</option>`).join("")}</select>
    <div class="row"><input class="grow" data-k="css" value="${escH(s.css)}" placeholder="CSS or XPath" aria-label="Selector"><button class="btn" data-a="pick">Pick</button><button class="btn" data-a="test">Test</button><button class="btn icon" data-a="del" aria-label="Remove ${escH(s.name || "selector")}">✕</button></div>
    <div class="opts"><label><input type="checkbox" data-k="multiple" ${s.multiple ? "checked" : ""}> Many</label>${s.type === "link" ? `<label><input type="checkbox" data-k="follow" ${s.follow ? "checked" : ""}> Follow (open each page)</label>` : ""}${s.type === "attribute" ? `<label>Attribute <input data-k="attr" value="${escH(s.attr || "")}" placeholder="href, data-id…" style="width:110px"></label>` : ""}</div>
    <div class="pick-out"></div></div>`).join("");
}
$("#mapSels").addEventListener("input", e => { const d = e.target.closest(".sel"), k = e.target.dataset.k; if (!d || !k) return; const s = MAP.sels[+d.dataset.i]; s[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; if (k === "type" || k === "follow") { if (s.type === "pagination") s.multiple = true; drawSels(); } saveMap(); });
$("#mapSels").addEventListener("click", e => { const b = e.target.closest("[data-a]"), d = e.target.closest(".sel"); if (!b || !d) return; const i = +d.dataset.i, s = MAP.sels[i];
  if (b.dataset.a === "del") { MAP.sels = MAP.sels.filter(x => x !== s).map(x => x.parent === s.id ? { ...x, parent: s.parent } : x); drawSels(); saveMap(); }
  if (b.dataset.a === "test") guard($("#mapMsg"), async () => { const ctx = ctxCss(s), r = await tool("test", s.css, ctx); setMsg($("#mapMsg"), r.error || `“${s.name || "This selector"}” matches ${r.count}${ctx ? " (inside its parent)" : ""}.`, r.error || !r.count ? "warn" : "ok"); });
  if (b.dataset.a === "pick") guard($("#mapMsg"), async () => { setMsg($("#mapMsg"), "Click the element on the page. Esc cancels."); const ctx = ctxCss(s), r = await tool("pickEl", ctx); setMsg($("#mapMsg"), "");
    if (!r) return; const best = r.selectors.find(x => x.kind === (ctx ? "relative" : s.multiple || s.type === "element" ? "similar" : "css")) || r.selectors[0];
    s.css = best.expr; if (!s.name) s.name = s.type === "element" ? "item" : (r.sample || s.type).slice(0, 24); drawSels(); saveMap();
    showSelectors(r, $(`#mapSels .sel[data-i="${i}"] .pick-out`), expr => { s.css = expr; drawSels(); saveMap(); }); setMsg($("#mapMsg"), `Picked: matches ${best.count}. Other choices are below.`, "ok"); }); });
function ctxCss(s) { const p = MAP.sels.find(x => x.id === s.parent); return p && p.type === "element" ? p.css : null; } // a child of an element is found inside each match
$("#mapAdd").onclick = () => { const last = MAP.sels.filter(x => x.type === "element").pop(); MAP.sels.push({ id: sid(), name: "", type: MAP.sels.length ? "text" : "element", parent: last ? last.id : "_root", css: "", multiple: !MAP.sels.length }); drawSels(); saveMap(); };
$("#mapHere").onclick = async () => { const t = await tab(); $("#mapStart").value = t.url; MAP.start = t.url; saveMap(); };
for (const id of ["#mapName", "#mapStart"]) $(id).oninput = () => { MAP.name = $("#mapName").value; MAP.start = $("#mapStart").value; saveMap(); };
const saveMap = () => chrome.storage.local.set({ sitemap: MAP }).catch(() => {});
chrome.storage.local.get("sitemap").then(({ sitemap }) => { if (sitemap) MAP = sitemap; $("#mapName").value = MAP.name || ""; $("#mapStart").value = MAP.start || ""; drawSels(); });

// start pages: one per line, with Web Scraper-style ranges: [1-5], [01-10] (zero-padded), [0-100:20] (steps)
function starts(text) { const out = []; for (const line of text.split(/\n+/).map(x => x.trim()).filter(Boolean)) { const m = line.match(/\[(\d+)-(\d+)(?::(\d+))?\]/);
    if (!m) { out.push(line); continue; } const [a, b, step] = [+m[1], +m[2], +(m[3] || 1)], pad = m[1].length > 1 && m[1].startsWith("0") ? m[1].length : 0;
    for (let n = a; n <= b && out.length < 1000; n += step) out.push(line.replace(m[0], pad ? String(n).padStart(pad, "0") : String(n))); }
  return out.filter(u => { try { return /^https?:/.test(new URL(u).protocol); } catch { return false; } }); }
const sels = () => MAP.sels.filter(s => s.css && s.css.trim()).map(s => ({ ...s, name: s.name || s.id }));
function table(rows, el) { const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]; el.innerHTML = rows.length ? `<table><thead><tr>${cols.map(c => `<th>${escH(c)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, 12).map(r => `<tr>${cols.map(c => `<td title="${escH(r[c])}">${escH(r[c] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>${rows.length > 12 ? `<p class="hint">Showing 12 of ${rows.length} rows.</p>` : ""}` : ""; return cols; }
$("#mapPreview").onclick = () => guard($("#mapMsg"), async () => { if (!sels().length) return setMsg($("#mapMsg"), "Add a selector with a CSS or XPath first.", "warn");
  const r = await tool("runSitemap", sels(), "_root"), rows = r.rows.map(x => x.fields); table(rows, $("#mapPrev"));
  const f = r.rows.reduce((a, x) => a + x.follow.length, 0); setMsg($("#mapMsg"), rows.length ? `This page gives ${rows.length} row${rows.length > 1 ? "s" : ""}${f ? `, and ${f} link${f > 1 ? "s" : ""} to follow` : ""}${r.next.length ? `, plus ${r.next.length} next page${r.next.length > 1 ? "s" : ""}` : ""}.` : "No rows on this page. Test each selector to check it matches.", rows.length ? "ok" : "warn"); });

/* the crawl: a background tab visits each page in turn, politely, and only on sites you allowed */
async function robotsFor(origin) { try { const t = await (await fetch(origin + "/robots.txt", { credentials: "omit" })).text(); const dis = []; let on = false;
    for (const l of t.split(/\r?\n/)) { const [k, ...v] = l.split(":"), val = v.join(":").trim(); if (/^user-agent$/i.test(k.trim())) on = val === "*"; else if (on && /^disallow$/i.test(k.trim()) && val) dis.push(val); }
    return u => { const p = new URL(u).pathname; return !dis.some(d => p.startsWith(d.replace(/\*.*$/, ""))); }; } catch { return () => true; } }
// load a page and wait until it has finished, by checking the tab's status (events can be missed in background tabs)
async function loadPage(id, url) { await chrome.tabs.update(id, { url }); const until = Date.now() + 30000; await new Promise(r => setTimeout(r, 250));
  while (Date.now() < until) { const t = await chrome.tabs.get(id).catch(() => null); if (!t) throw new Error("the collecting tab was closed"); if (t.status === "complete" && t.url && t.url !== "about:blank") return; if (t.status === "unloaded") await chrome.tabs.reload(id).catch(() => {}); await new Promise(r => setTimeout(r, 250)); } }
$("#mapRun").onclick = async () => {
  const S = sels(), list = starts($("#mapStart").value), msg = $("#mapMsg"); if (!S.length) return setMsg(msg, "Add at least one selector first.", "warn"); if (!list.length) return setMsg(msg, "Add a start page (a full web address).", "warn");
  const origins = [...new Set(list.map(u => new URL(u).origin + "/*"))]; if (!(await chrome.permissions.request({ origins }))) return setMsg(msg, "Kutipat needs permission to read these sites to collect from them.", "warn");
  const max = Math.min(500, Math.max(1, +$("#mapMax").value || 25)), delay = Math.max(1, +$("#mapDelay").value || 2) * 1000, same = $("#mapSame").checked, home = new Set(list.map(u => new URL(u).origin));
  const robots = {}; if ($("#mapRobots").checked) for (const o of home) robots[o] = await robotsFor(o);
  const queue = list.map(url => ({ url, parent: "_root", base: {} })), seen = new Set(), childOf = id => S.some(s => s.parent === id);
  RESULT = []; stopping = false; $("#mapRun").disabled = true; $("#mapStop").disabled = false; prog("#mapProg", 0); let pages = 0, skipped = 0;
  // collect in a separate window, as Web Scraper does: Chrome may hold back loading tabs that are never shown
  const win = await chrome.windows.create({ url: queue[0].url, type: "popup", focused: false, width: 1000, height: 760 }), crawlTab = win.tabs[0];
  chrome.tabs.update(crawlTab.id, { autoDiscardable: false }).catch(() => {});
  try {
    while (queue.length && pages < max && !stopping) {
      const job = queue.shift(), key = job.parent + " " + job.url; if (seen.has(key)) continue; seen.add(key); const o = new URL(job.url).origin;
      if ((same && !home.has(o)) || !(await chrome.permissions.contains({ origins: [o + "/*"] }))) { skipped++; continue; } // other sites aren't visited
      if (robots[o] && !robots[o](job.url)) { skipped++; continue; }
      setMsg(msg, `Page ${pages + 1}: ${job.url}`); await loadPage(crawlTab.id, job.url); await new Promise(r => setTimeout(r, 700));
      await chrome.scripting.executeScript({ target: { tabId: crawlTab.id }, files: ["tools.js"] });
      const [{ result: r }] = await chrome.scripting.executeScript({ target: { tabId: crawlTab.id }, func: (s, p) => window.__kutipatTools.runSitemap(s, p), args: [S, job.parent] }); pages++;
      for (const row of r.rows) { const fields = { ...job.base, ...row.fields }, go = row.follow.filter(f => childOf(f.sel));
        if (go.length) go.forEach(f => queue.push({ url: f.url, parent: f.sel, base: fields })); else RESULT.push({ ...fields, "Page": r.url }); }
      r.next.forEach(url => queue.push({ url, parent: job.parent, base: job.base }));
      prog("#mapProg", pages / Math.min(max, pages + queue.length)); table(RESULT, $("#mapPrev"));
      if (queue.length && !stopping) await new Promise(r => setTimeout(r, delay)); // a polite pause between pages
    }
  } catch (e) { setMsg(msg, "Collecting stopped: " + e.message, "warn"); }
  chrome.windows.remove(win.id).catch(() => {}); rlog("Collected with a sitemap", list.join(" "), { sitemap: MAP.name, rows: RESULT.length, pages, skipped, waitSeconds: delay / 1000, maxPages: max, sameSite: same, robotsTxt: $("#mapRobots").checked });
  $("#mapRun").disabled = false; $("#mapStop").disabled = true; prog("#mapProg");
  const personal = RESULT.some(r => Object.values(r).some(v => /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s()-]{8,}\d/.test(String(v))));
  $("#mapExport").hidden = !RESULT.length; table(RESULT, $("#mapPrev"));
  setMsg(msg, `Collected ${RESULT.length} row${RESULT.length === 1 ? "" : "s"} from ${pages} page${pages === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped: other sites or robots.txt)` : ""}${stopping ? ". Stopped early." : "."}${personal ? " These rows look like they include personal data (emails or phone numbers): under GDPR and PDPA you need a lawful reason to keep them." : ""}`, personal ? "warn" : "ok");
};
$("#mapStop").onclick = () => { stopping = true; setMsg($("#mapMsg"), "Stopping after this page…", "warn"); };
const mapCols = () => [...new Set(RESULT.flatMap(r => Object.keys(r)))], mapFile = ext => `${(MAP.name || "sitemap").replace(/[^\w-]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.${ext}`;
$("#mapCsv").onclick = () => { const c = mapCols(); save(new Blob(["\ufeff" + [c.map(csvCell), ...RESULT.map(r => c.map(k => csvCell(red(r[k]))))].map(r => r.join(",")).join("\r\n")], { type: "text/csv" }), mapFile("csv")); };
$("#mapJson").onclick = () => save(new Blob([JSON.stringify(RESULT.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, red(v)]))), null, 2)], { type: "application/json" }), mapFile("json"));
$("#mapXlsx").onclick = () => { const c = mapCols(), num = v => typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? +v : v; save(XlsxLite.build(c, RESULT.map(r => c.map(k => { const v = num(red(r[k] ?? "")); return typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v; }))), mapFile("xlsx")); };
// sitemaps in Web Scraper’s format, so they move between the two extensions
const WS = { element: "SelectorElement", text: "SelectorText", link: "SelectorLink", image: "SelectorImage", attribute: "SelectorElementAttribute", html: "SelectorHTML", table: "SelectorTable", pagination: "SelectorPagination" };
$("#mapSave").onclick = () => save(new Blob([JSON.stringify({ _id: MAP.name || "sitemap", startUrl: starts(MAP.start || ""), selectors: MAP.sels.map(s => ({ id: s.name || s.id, _kid: s.id, type: WS[s.type], parentSelectors: [s.parent === "_root" ? "_root" : (MAP.sels.find(x => x.id === s.parent)?.name || s.parent)], selector: s.css, multiple: !!s.multiple, ...(s.type === "attribute" ? { extractAttribute: s.attr } : {}), ...(s.type === "link" ? { follow: !!s.follow } : {}) })) }, null, 2)], { type: "application/json" }), `${(MAP.name || "sitemap").replace(/[^\w-]+/g, "-")}.sitemap.json`);
$("#mapLoad").onclick = () => $("#mapIn").click();
$("#mapIn").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { const j = JSON.parse(await f.text()), back = Object.fromEntries(Object.entries(WS).map(([k, v]) => [v, k])), idOf = {};
    const list = (j.selectors || []).map(s => { const id = sid(); idOf[s.id] = id; return { s, id }; });
    MAP = { name: j._id || f.name.replace(/\.(sitemap\.)?json$/i, ""), start: [].concat(j.startUrl || []).join("\n"), sels: list.map(({ s, id }) => { const parents = s.parentSelectors || ["_root"], self = parents.includes(s.id);
      let type = back[s.type] || (/Click|Scroll/.test(s.type) ? "element" : "text"); if (self && type === "link") type = "pagination"; // Web Scraper's pagination is a link that points at itself
      const p = parents.find(x => x !== s.id) || "_root"; return { id, name: s.id, type, parent: p === "_root" ? "_root" : idOf[p] || "_root", css: s.selector || "", multiple: !!s.multiple || type === "pagination", attr: s.extractAttribute || "", follow: type === "link" ? (s.follow ?? list.some(x => (x.s.parentSelectors || []).includes(s.id))) : false }; }) };
    $("#mapName").value = MAP.name; $("#mapStart").value = MAP.start; drawSels(); saveMap(); setMsg($("#mapMsg"), `Imported “${MAP.name}”: ${MAP.sels.length} selectors.${(j.selectors || []).some(s => /Click|Scroll/.test(s.type)) ? " Click and scroll selectors became plain element selectors." : ""}`, "ok"); }
  catch { setMsg($("#mapMsg"), "That file isn’t a sitemap Kutipat can read.", "warn"); } };

/* ---------- 3. the page’s resources ---------- */
let RES = null;
$("#resFind").onclick = () => guard($("#resMsg"), async () => { RES = await tool("resources"); const by = {}; RES.list.forEach(x => (by[x.type] ||= []).push(x));
  $("#resList").innerHTML = RES.list.length ? `<div class="rtypes">${Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([t, l]) => `<label><input type="checkbox" data-t="${t}" ${["scripts", "other"].includes(t) ? "" : "checked"}> ${t[0].toUpperCase() + t.slice(1)} (${l.length})</label>`).join("")}</div>` : "";
  $("#resZip").disabled = !RES.list.length; setMsg($("#resMsg"), RES.list.length ? `Found ${RES.list.length} files. Choose the kinds to save.` : "No files found on this page.", RES.list.length ? "ok" : "warn"); });
// Downloads files into ZIP entries under prefix/<type>/, with an index of where each came from. Shared by "Download as ZIP" and
// "Save everything on this page". Cookies are never sent; at most 400 files and 250 MB.
async function fetchFiles(pick, progSel, msg, prefix = "") {
  const entries = [], index = [["file", "type", "from", "size (bytes)", "status"]], names = new Set(); let total = 0, done = 0, failed = 0;
  for (const x of pick.slice(0, 400)) {
    let name = (() => { try { const u = new URL(x.url); return decodeURIComponent(u.pathname.split("/").pop() || "index") || "file"; } catch { return "file"; } })().replace(/[^\w.\-]+/g, "_").slice(-80);
    if (x.url.startsWith("data:")) name = `inline-${done + 1}.${(x.url.match(/^data:\w+\/([\w+]+)/) || [, "bin"])[1].replace("svg+xml", "svg").replace("jpeg", "jpg")}`;
    for (let n = 2, base = name; names.has(x.type + "/" + name); n++) name = base.replace(/(\.\w+)?$/, `-${n}$1`); names.add(x.type + "/" + name);
    try { const r = await fetch(x.url, { credentials: "omit" }); if (!r.ok) throw new Error(r.status); const b = new Uint8Array(await r.arrayBuffer()); total += b.length;
      if (total > 250 * 1024 * 1024) { index.push([name, x.type, x.url, "", "skipped: 250 MB limit"]); break; } entries.push([`${prefix}${x.type}/${name}`, b]); index.push([`${prefix}${x.type}/${name}`, x.type, x.url, b.length, "saved"]); }
    catch (e) { failed++; index.push([name, x.type, x.url, "", "couldn’t download (" + e.message + ")"]); }
    prog(progSel, ++done / Math.min(pick.length, 400)); setMsg(msg, `Downloading ${done} of ${Math.min(pick.length, 400)} files…`);
  }
  return { entries, index, total, failed };
}
const csvOf = rows => "\ufeff" + rows.map(r => r.map(csvCell).join(",")).join("\r\n");
const originsOf = list => [...new Set(list.filter(x => !x.url.startsWith("data:")).map(x => { try { return new URL(x.url).origin + "/*"; } catch { return null; } }).filter(Boolean))];
$("#resZip").onclick = async () => {
  const types = [...document.querySelectorAll("#resList [data-t]:checked")].map(c => c.dataset.t), pick = RES.list.filter(x => types.includes(x.type)).slice(0, 400), msg = $("#resMsg"); if (!pick.length) return setMsg(msg, "Choose at least one kind of file.", "warn");
  const origins = originsOf(pick);
  if (origins.length && !(await chrome.permissions.request({ origins }))) return setMsg(msg, "Kutipat needs permission for the sites these files come from.", "warn");
  $("#resZip").disabled = true;
  const { entries, index, total, failed } = await fetchFiles(pick, "#resProg", msg);
  entries.push(["resources.csv", csvOf(index)]);
  const host = (() => { try { return new URL(RES.page).hostname; } catch { return "page"; } })(); save(ZipLite(entries), `${host}-resources.zip`);
  rlog("Saved a page's resources", RES.page, { files: entries.length - 1, megabytes: +(total / 1048576).toFixed(2), failed, kinds: types.join(" ") });
  prog("#resProg"); $("#resZip").disabled = false; setMsg(msg, `Saved ${entries.length - 1} file${entries.length === 2 ? "" : "s"} (${(total / 1048576).toFixed(1)} MB)${failed ? `; ${failed} couldn’t be downloaded (listed in resources.csv)` : ""}.`, failed ? "warn" : "ok");
};

/* ---------- 4. everything on this page, in one ZIP ----------
   One button finds every table and list, the links, images and text, and the page's files. A second click downloads, because
   Chrome only lets Kutipat ask for the other sites' files straight after a click, and it can only know which sites once it has looked. */
let ALL = null;
const cellOf = v => { const t = String(v ?? "").trim(); if (/^-?\d{1,15}(\.\d+)?$/.test(t)) return Number(t); return /^[=+\-@]/.test(t) ? "'" + t : t; };
$("#allScan").onclick = () => guard($("#allMsg"), async () => {
  const msg = $("#allMsg"); $("#allZip").hidden = true; $("#allList").textContent = ""; ALL = null;
  setMsg(msg, "Looking at the page…"); prog("#allProg", null);
  try {
    const cands = (await run("detect")) || [], tables = [];
    for (const c of cands) { const d = await run("extract", c.i); if (d && d.rows && d.rows.length) tables.push({ kind: c.kind, cols: d.cols, rows: d.rows }); }
    try { await run("clear"); } catch { /* nothing highlighted */ }
    const page = await tool("pageSummary"), res = await tool("resources");
    const files = res.list.filter(x => x.type !== "scripts");                // code, not content: left out (the resources section can save it)
    const here = (() => { try { return new URL(page.url).origin; } catch { return ""; } })();
    const sites = originsOf(files).filter(o => o !== here + "/*").length;
    ALL = { tables, page, files, host: (() => { try { return new URL(page.url).hostname; } catch { return "page"; } })() };
    const rows = tables.reduce((n, t) => n + t.rows.length, 0), paras = page.text ? page.text.split("\n\n").length : 0;
    const li = (t) => `<li>${t}</li>`;
    $("#allList").innerHTML = `<ul class="alllist">${[
      li(tables.length ? `<b>${tables.length}</b> table${tables.length === 1 ? "" : "s"} and list${tables.length === 1 ? "" : "s"} (${rows} rows), in <code>data.xlsx</code> and as CSV files` : "No tables or lists found"),
      li(`<b>${page.links.length}</b> links, in <code>links.csv</code>`), li(`<b>${page.images.length}</b> images listed, in <code>images.csv</code>`),
      li(`The page’s text (${paras} paragraphs and headings), in <code>page.md</code>`),
      li(`<b>${files.length}</b> files (images, media, styles, fonts)${sites ? `, from this site and ${sites} other${sites === 1 ? "" : "s"}` : ""}, in <code>files/</code>`)].join("")}</ul>`;
    $("#allZip").hidden = false; $("#allZip").focus();
    $("#allScan").textContent = "Look again"; $("#allScan").classList.remove("primary");     // the download is now clearly the next step
    setMsg(msg, sites && $("#allFiles").checked ? `Ready. Chrome will ask once for the ${sites} other site${sites === 1 ? "" : "s"} the files come from.` : "Ready to download.", "ok");
  } finally { prog("#allProg"); }
});
$("#allZip").onclick = async () => {
  if (!ALL) return; const msg = $("#allMsg"), withFiles = $("#allFiles").checked, pick = withFiles ? ALL.files : [];
  const origins = originsOf(pick);
  if (origins.length && !(await chrome.permissions.request({ origins }))) return setMsg(msg, "Kutipat needs permission for the sites the files come from. Untick “Include the page’s files” to save everything else.", "warn");
  $("#allZip").disabled = true;
  try {
    const entries = [], { tables, page } = ALL;
    if (tables.length) {
      const sheets = tables.map((t, k) => ({ name: `${t.kind === "table" ? "Table" : "List"} ${k + 1}`, headers: t.cols.map(c => c.name), rows: t.rows.map(r => t.cols.map(c => cellOf(r[c.key]))) }));
      entries.push(["data.xlsx", new Uint8Array(await XlsxLite.buildMany(sheets).arrayBuffer())]);
      sheets.forEach((sh, k) => entries.push([`tables/${String(k + 1).padStart(2, "0")}-${sh.name.toLowerCase().replace(/\s+/g, "-")}.csv`, csvOf([sh.headers, ...sh.rows])]));
    }
    entries.push(["links.csv", csvOf([["text", "link"], ...page.links.map(l => [l.text, l.url])])]);
    entries.push(["images.csv", csvOf([["image", "alt text", "width", "height"], ...page.images.map(i => [i.src, i.alt, i.width, i.height])])]);
    const title = page.title || ALL.host, body = page.text.replace(new RegExp("^# " + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\n\\n"), "");   // the page's own heading, if it repeats the title
    entries.push(["page.md", `# ${title}\n\n<${page.url}>\n\n${page.description ? page.description + "\n\n" : ""}${body}\n`]);
    let got = { entries: [], index: [], total: 0, failed: 0 };
    if (pick.length) { got = await fetchFiles(pick, "#allProg", msg, "files/"); entries.push(...got.entries, ["files/resources.csv", csvOf(got.index)]); }
    const when = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    entries.push(["about.txt", [`Saved by Kutipat on ${when}`, `From: ${page.url}`, `Title: ${page.title || ""}`, "",
      "In this ZIP:", tables.length ? `  data.xlsx and tables/: ${tables.length} tables and lists, one sheet or file each` : "  (no tables or lists were found)",
      `  links.csv: ${page.links.length} links`, `  images.csv: ${page.images.length} images (addresses and alt text)`, "  page.md: the page's text",
      pick.length ? `  files/: ${got.entries.length} files, with files/resources.csv saying where each came from${got.failed ? ` (${got.failed} couldn't be downloaded)` : ""}` : "  (the page's files were not included)",
      "", "Scripts are left out: they are the page's code, not its content. The Save the page's resources section can save them.",
      "Check that you may reuse what you saved: text, images, fonts and media usually belong to their creators.",
      "Kutipat sends nothing anywhere: this ZIP was made in your browser."].join("\r\n")]);
    save(ZipLite(entries), `${ALL.host}-everything.zip`);
    rlog("Saved everything on a page", page.url, { tables: tables.length, links: page.links.length, images: page.images.length, files: got.entries.length, megabytes: +(got.total / 1048576).toFixed(2), failed: got.failed });
    setMsg(msg, `Saved ${ALL.host}-everything.zip: ${tables.length} tables and lists, ${page.links.length} links, the page’s text${pick.length ? ` and ${got.entries.length} files` : ""}.${got.failed ? ` ${got.failed} file${got.failed === 1 ? "" : "s"} couldn’t be downloaded (listed in files/resources.csv).` : ""}`, got.failed ? "warn" : "ok");
  } finally { prog("#allProg"); $("#allZip").disabled = false; }
};

})();
