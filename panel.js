/* Kutipat side panel. Talks only to the tab you are scraping, through chrome.scripting. No network requests except a
   site's own robots.txt when you crawl it (after you allow access to that one site). Nothing is sent anywhere else. */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const known = {}; // tab id → last address Kutipat could see
const st = { tabId: null, cands: [], ci: 0, cols: [], rows: [], key: null, mode: "next", btn: null, crawling: false, host: "" };
const kindOf = t => /^(Done|Saved|Copied|Collected|Picked|Rebuilt|Extracted|Saved setup applied|Renamed)/.test(t) ? "ok" : /(No |Couldn’t|doesn’t|isn’t|Chrome doesn’t|needs permission|Without|missing|stopped|Stopping|To follow)/.test(t) ? "warn" : "";
const setMsg = (el, t, kind) => { el.textContent = t || ""; el.className = "msg" + ((kind ?? kindOf(t || "")) ? " " + (kind ?? kindOf(t)) : ""); };
const status = (t, kind) => setMsg($("#status"), t, kind);
// progress bar: a fraction from 0 to 1, null for "working", or undefined to hide it
const prog = (sel, f) => { const el = $(sel); if (f === undefined) { el.hidden = true; return; } el.hidden = false; el.classList.toggle("indef", f === null); el.firstElementChild.style.width = f === null ? "" : `${Math.round(Math.min(1, f) * 100)}%`; };
async function tab() {
  if (st.tabId) { try { const t = await chrome.tabs.get(st.tabId); if (t.url) { known[t.id] = t.url; try { st.host = new URL(t.url).host; $("#host").textContent = st.host; } catch {} } return t; } catch {} }
  const q = new URLSearchParams(location.search).get("tab"); const t = q ? await chrome.tabs.get(+q) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  st.tabId = t.id; if (t.url) known[t.id] = t.url; try { st.host = new URL(t.url).host; } catch { st.host = ""; } $("#host").textContent = st.host || "this site"; return t;
}
async function run(fn, ...args) {
  const t = await tab();
  await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["engine.js"] });
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: (name, a) => Promise.resolve(window.__kutipat[name](...a)), args: [fn, args] });
  return result;
}
const canRead = async t => { try { return await chrome.permissions.contains({ origins: [new URL(t.url).origin + "/*"] }); } catch { return false; } };


/* ---------- When Kutipat can't read a page ----------
   Chrome blocks extensions on its own pages, the Web Store and PDFs. On ordinary sites, the usual reason is that
   Kutipat's one-time access (granted when you click its toolbar button) ended because the page changed or you switched
   tabs. Then Kutipat asks for access to that one site, which lasts, and retries what you were doing. */
const RESTRICTED = /^(chrome|edge|brave|opera|vivaldi|about|chrome-extension|devtools|view-source|file):|^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com|microsoftedge\.microsoft\.com\/addons)|\.pdf(\?|#|$)/i;
let pendingRetry = null;
chrome.runtime.onMessage.addListener(m => {
  if (m?.type !== "kutipat-activated") return;
  known[m.tabId] = m.url;
  if (m.tabId === st.tabId && !$("#sitePerm").hidden && pendingRetry) { $("#sitePerm").hidden = true; status("Access granted. Continuing…", ""); const r = pendingRetry; pendingRetry = null; setTimeout(r, 150); }
});
async function rememberedUrl(id) { if (known[id]) return known[id]; try { const k = "seen:" + id, v = (await chrome.storage.session.get(k))[k]; if (v) known[id] = v; return v || ""; } catch { return ""; } }
async function explainAccess(e, retry) {
  pendingRetry = retry || null;
  const t = await tab().catch(() => null), msg = String(e?.message || e), url = t?.url || (t ? await rememberedUrl(t.id) : "");
  $("#sitePerm").hidden = true; $("#allowSite").hidden = false;
  // Chrome's own pages, extension stores and similar: no extension may read them
  if (/chrome:\/\/|edge:\/\/|about:|chrome-extension:\/\/|extensions gallery|cannot be scripted|webstore|devtools/i.test(msg) || (url && RESTRICTED.test(url))) return status("Chrome doesn’t let extensions read this kind of page, such as Chrome’s own pages, extension stores and PDFs. Open a normal website.", "warn");
  // an ordinary site where Kutipat's access has ended (Chrome then hides the address too)
  if (/must request permission|Cannot access contents/i.test(msg)) {
    if (url && /^https?:/.test(url)) {
      const u = new URL(url); $("#sitePermInfo").textContent = `Kutipat’s access to ${u.host} ended, because the page changed or you switched tabs. Allow it on this site so it keeps working.`;
      $("#allowSite").textContent = `Allow on ${u.host}`;
      $("#allowSite").onclick = async () => { const ok = await chrome.permissions.request({ origins: [u.origin + "/*"] }).catch(() => false); if (!ok) return status(`Kutipat can’t read ${u.host} without permission. You can also click Kutipat’s toolbar button while on the page.`, "warn"); $("#sitePerm").hidden = true; status(`Allowed on ${u.host}.`, "ok"); retry?.(); };
    } else {
      $("#sitePermInfo").textContent = "Kutipat’s access to this page ended, because the page changed, redirected or you switched tabs. Click Kutipat’s button in the toolbar while on this page, and Kutipat will carry on automatically."; $("#allowSite").hidden = true;
    }
    $("#sitePerm").hidden = false; status(""); if (!$("#allowSite").hidden) $("#allowSite").focus(); return;
  }
  status("Couldn’t read this page. Reload it and try again.", "warn");
}

/* ---------- finding data ---------- */
async function find() {
  status("Looking for tables and lists…");
  try { st.cands = await run("detect"); } catch (e) { return explainAccess(e, find); }
  $("#sitePerm").hidden = true;
  if (!st.cands.length) { status("No repeated data found. Try Pick by clicking."); return; }
  st.ci = 0; await show(0);
}
async function show(i) {
  st.ci = (i + st.cands.length) % st.cands.length; let d; try { d = await run("extract", st.ci); await run("highlight", st.ci); } catch (e) { return explainAccess(e, () => show(i)); }
  load(d); $("#candRow").hidden = st.cands.length < 2; $("#candInfo").textContent = `Table ${st.ci + 1} of ${st.cands.length} · ${st.cands[st.ci].rows} rows`;
  status(st.cands.length > 1 ? "Not the right data? Try another, or Pick by clicking." : "");
  const nb = await run("findNext"); setBtn(nb);
}
function load(d, append = false) {
  if (!d) return;
  if (!append) { const prev = Object.fromEntries(st.cols.map(c => [c.key, c])); st.cols = d.cols.map(c => ({ ...c, name: prev[c.key]?.name || c.name, on: prev[c.key]?.on ?? true })); st.rows = d.rows; st.key = d.key; }
  else { d.cols.forEach(c => { if (!st.cols.some(x => x.key === c.key)) st.cols.push({ ...c, on: true }); }); st.rows.push(...d.rows); }
  ["#sData", "#sPages", "#sExport"].forEach(s => $(s).hidden = false); $("#empty").hidden = true; render();
}

/* ---------- the table ---------- */
// price: only currency symbols or codes may sit around the number, so "Post 1" is not a price
const TYPES = { url: /^https?:\/\//i, email: /^[\w.%+-]+@[\w-]+(\.[\w-]+)+$/, price: /^(?:[$€£¥₹]|RM|S\$|Rp|USD|SGD|MYR|IDR|EUR|GBP|AUD|INR)?\s?-?\d[\d,.\s]*\s?(?:[$€£¥₹]|USD|SGD|MYR|IDR|EUR|GBP|%|k|K|m|M)?$/, date: /^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}|\d{1,2} [A-Za-z]{3,9} \d{4})/ };
function typeOf(c) { const vals = st.rows.map(r => r[c.key]).filter(Boolean).slice(0, 50); if (!vals.length) return "empty"; for (const [k, re] of Object.entries(TYPES)) if (vals.filter(v => re.test(String(v).trim())).length >= vals.length * 0.8) return /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(vals[0]) || /@src$/.test(c.key) ? "image" : k === "price" && !/[$€£¥₹]|RM|S\$|Rp|USD|SGD|MYR|IDR/i.test(vals.join("")) ? "number" : k; return "text"; }
const toNum = v => { const s = String(v).replace(/[^\d.,-]/g, ""); if (!s) return v; const norm = /,\d{2}$/.test(s) && !/\.\d{2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, ""); const n = parseFloat(norm); return isFinite(n) ? n : v; };
function output() {
  const cols = st.cols.filter(c => c.on), clean = $("#clean").checked, types = Object.fromEntries(cols.map(c => [c.key, typeOf(c)]));
  let rows = st.rows.map(r => cols.map(c => { const v = (r[c.key] ?? "").toString().trim(); return clean && (types[c.key] === "price" || types[c.key] === "number") && v ? toNum(v) : v; }));
  if ($("#dedupe").checked) { const seen = new Set(); rows = rows.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }); }
  return { cols, rows, types };
}
function render() {
  const { cols, rows, types } = output(), all = st.cols; const e = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  $("#count").textContent = `${rows.length} row${rows.length === 1 ? "" : "s"}, ${cols.length} column${cols.length === 1 ? "" : "s"}`;
  const tAll = Object.fromEntries(all.map(c => [c.key, types[c.key] || typeOf(c)]));
  const TL = { url: "Link", image: "Image", price: "Price", number: "Number", date: "Date", email: "Email", text: "Text", empty: "Empty" };
  $("#grid").innerHTML = `<thead><tr>${all.map((c, i) => `<th class="${c.on ? "" : "off"}"><div class="colhead"><div class="ctl"><label class="mini" title="${c.on ? "Leave this column out" : "Include this column"}"><input type="checkbox" data-on="${i}" ${c.on ? "checked" : ""} aria-label="Include ${e(c.name)}"><span></span></label><span contenteditable="true" spellcheck="false" data-name="${i}" aria-label="Column name">${e(c.name)}</span></div><span class="type t" data-type="${tAll[c.key]}" title="${TL[tAll[c.key]] || tAll[c.key]}"><svg aria-hidden="true"><use href="#t-${tAll[c.key]}"/></svg>${(TL[tAll[c.key]] || tAll[c.key]) === c.name ? `<span class="sr">${TL[tAll[c.key]] || tAll[c.key]}</span>` : TL[tAll[c.key]] || tAll[c.key]}</span></div></th>`).join("")}</tr></thead><tbody>${st.rows.slice(0, 60).map(r => `<tr>${all.map(c => `<td class="${c.on ? "" : "off"}" title="${e(r[c.key])}">${e(r[c.key])}</td>`).join("")}</tr>`).join("")}</tbody>`;
  // personal data warning
  const sample = rows.slice(0, 300).flat().join(" "), em = (sample.match(/[\w.%+-]+@[\w-]+\.[\w.-]+/g) || []).length, ph = (sample.match(/(\+\d{1,3}[\s-]?)?\b\d{3,4}[\s-]?\d{3,4}[\s-]?\d{0,4}\b/g) || []).filter(x => x.replace(/\D/g, "").length >= 8).length;
  const pii = $("#pii"); pii.hidden = !(em || ph > 2); pii.textContent = `This data seems to include personal details (${[em && `${em} email address${em > 1 ? "es" : ""}`, ph > 2 && "phone numbers"].filter(Boolean).join(" and ")}). Data protection laws such as GDPR or the PDPA may apply to collecting and using it: only keep what you need, for a lawful purpose.`;
}
$("#grid").addEventListener("change", e => { const i = e.target.dataset.on; if (i != null) { st.cols[+i].on = e.target.checked; render(); saveRecipe(); } });
$("#grid").addEventListener("input", e => { const i = e.target.dataset.name; if (i != null) { st.cols[+i].name = e.target.textContent.trim() || st.cols[+i].name; saveRecipe(); const { cols } = output(); $("#count").textContent = `${output().rows.length} rows, ${cols.length} columns`; } });
$("#grid").addEventListener("keydown", e => { if (e.target.dataset.name != null && e.key === "Enter") { e.preventDefault(); e.target.blur(); } });
["#dedupe", "#clean"].forEach(s => $(s).onchange = render);

/* ---------- more pages ---------- */
function setBtn(b) { st.btn = b; $("#btnInfo").textContent = st.mode === "scroll" ? "Kutipat scrolls to the bottom to load more." : b ? `Button: “${b.text || "found"}”` : "No button found yet."; $("#btnRow").hidden = false; $("#markBtn").hidden = st.mode === "scroll"; }
$$("[data-mode]").forEach(b => b.onclick = () => { st.mode = b.dataset.mode; $$("[data-mode]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); setBtn(st.btn); saveRecipe(); });
$("#markBtn").onclick = async function mark() { status("Click the button on the page…"); let r; try { r = await run("pick", "next"); } catch (e) { return explainAccess(e, mark); } status(""); if (r?.selector) { st.btnMarked = true; setBtn(r); saveRecipe(); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitForPage(tabId, ms = 15000) { return new Promise(res => { let done = false; const t = setTimeout(() => { if (!done) { done = true; chrome.tabs.onUpdated.removeListener(l); res(false); } }, ms); const l = (id, info) => { if (id === tabId && info.status === "complete" && !done) { done = true; clearTimeout(t); chrome.tabs.onUpdated.removeListener(l); res(true); } }; chrome.tabs.onUpdated.addListener(l); }); }
async function robotsCheck(t) {
  try { const u = new URL(t.url), r = await fetch(u.origin + "/robots.txt", { credentials: "omit" }); if (!r.ok) return; const lines = (await r.text()).split(/\r?\n/); let applies = false, dis = [];
    for (const l of lines) { const [k, ...v] = l.split(":"), val = v.join(":").trim(); if (/^user-agent$/i.test(k.trim())) applies = val === "*"; else if (applies && /^disallow$/i.test(k.trim()) && val) dis.push(val); }
    const hit = dis.find(d => u.pathname.startsWith(d.replace(/\*.*$/, ""))); const n = $("#robots"); n.hidden = !hit; if (hit) n.textContent = `This site’s robots.txt asks automated tools not to visit “${hit}”. Respect it unless you have permission.`; return !!hit;
  } catch {}
}
$("#crawl").onclick = async () => {
  const t = await tab(), origin = new URL(t.url).origin;
  // pages that load a new address need permission for this one site; nothing else is ever requested
  if (st.mode === "next" && !(await canRead(t))) { const ok = await chrome.permissions.request({ origins: [origin + "/*"] }).catch(() => false); if (!ok) return status(`To follow Next on new pages, allow Kutipat to read ${new URL(t.url).host}. Only this site is affected.`); }
  if (await canRead(t)) await robotsCheck(t);
  if (st.mode !== "scroll" && !st.btn) return status("Point to the button first.");
  st.endedNaturally = false; st.crawling = true; $("#crawl").hidden = true; $("#stop").hidden = false; prog("#progress", 0);
  const max = Math.min(500, +$("#maxPages").value || 10), wait = Math.max(1, +$("#delay").value || 2) * 1000; let page = 1, stale = 0;
  while (st.crawling && page < max) {
    const before = st.rows.length, firstBefore = JSON.stringify(st.rows[st.rows.length - 1] || {});
    if (st.mode === "scroll") { const h = await run("scrollMore"); await sleep(wait + Math.random() * 500); const h2 = await run("height"); if (h2 <= h) { if (++stale >= 2) break; } else stale = 0; }
    else {
      const navigated = waitForPage(t.id, 15000), ok = await run("press", st.btn.selector).catch(() => false);
      if (!ok) { st.endedNaturally = true; break; } // the button is gone or disabled: the last page was reached
      if (st.mode === "next") { const loaded = await Promise.race([navigated, sleep(4000).then(() => null)]); if (loaded === null) await sleep(wait); else await sleep(wait / 2 + Math.random() * 500); } else await sleep(wait + Math.random() * 500);
    }
    let d = null; try { d = await run("relocate", st.key); } catch {}
    if (!d) { status("Couldn’t find the data on the next page."); break; }
    if (st.mode === "next") load(d, true); // a new page: add its rows
    else { st.rows = []; load(d, true); } // the same page grew: it now holds every row so far
    if (st.mode === "next" && JSON.stringify(st.rows[st.rows.length - 1] || {}) === firstBefore) { status("The next page showed the same rows, so Kutipat stopped."); break; }
    page++;
    // keep a button you pointed to yourself; otherwise find Next again, as it can move between pages
    if (st.mode === "next" && !st.btnMarked) { const nb = await run("findNext").catch(() => null); if (nb) st.btn = nb; }
    status(`Collected ${output().rows.length} rows from ${page} page${page > 1 ? "s" : ""}…`, ""); prog("#progress", st.mode === "next" ? page / max : null);
    if (st.mode !== "next" && st.rows.length <= before) { if (++stale >= 2) { status("No new rows appeared, so Kutipat stopped."); break; } } else stale = 0;
  }
  st.crawling = false; $("#crawl").hidden = false; $("#stop").hidden = true; prog("#progress"); render(); if (st.endedNaturally || !/stopped|Couldn’t|Stopping/.test($("#status").textContent)) status(`Done: ${output().rows.length} rows from ${page} page${page > 1 ? "s" : ""}${st.endedNaturally ? ", up to the last page" : ""}.`, "ok");
};
$("#stop").onclick = () => { st.crawling = false; status("Stopping after this page…"); };

/* ---------- export ---------- */
const fname = ext => `${(st.host || "data").replace(/[^\w.-]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.${ext}`;
function save(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const csvCell = v => { const s = String(v ?? ""); const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s; return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; }; // formula-injection safe
$("#csv").onclick = () => { const { cols, rows } = output(); save(new Blob(["\ufeff" + [cols.map(c => csvCell(c.name)), ...rows.map(r => r.map(csvCell))].map(r => r.join(",")).join("\r\n")], { type: "text/csv" }), fname("csv")); };
$("#json").onclick = () => { const { cols, rows } = output(); save(new Blob([JSON.stringify(rows.map(r => Object.fromEntries(cols.map((c, i) => [c.name, r[i]]))), null, 2)], { type: "application/json" }), fname("json")); };
$("#xlsx").onclick = () => { const { cols, rows } = output(); save(XlsxLite.build(cols.map(c => c.name), rows.map(r => r.map(v => typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v)), st.host || "Data"), fname("xlsx")); };
$("#copy").onclick = async () => { const { cols, rows } = output(); const tsv = [cols.map(c => c.name), ...rows].map(r => r.map(v => String(v ?? "").replace(/[\t\n\r]+/g, " ")).join("\t")).join("\n"); await navigator.clipboard.writeText(tsv); status("Copied. Paste into Google Sheets or Excel."); };

/* ---------- saved setups (on this device only) ---------- */
async function saveRecipe() { if (!$("#remember").checked || !st.host || !st.key) return; const { recipes = {} } = await chrome.storage.local.get("recipes"); recipes[st.host] = { key: st.key, cols: st.cols.map(({ key, name, on }) => ({ key, name, on })), mode: st.mode, btn: st.btn, saved: Date.now() }; await chrome.storage.local.set({ recipes }); }
$("#remember").onchange = async () => { if (!$("#remember").checked) { const { recipes = {} } = await chrome.storage.local.get("recipes"); delete recipes[st.host]; await chrome.storage.local.set({ recipes }); status("This site’s saved setup was removed."); } else saveRecipe(); };
async function offerRecipe() {
  await tab(); const { recipes = {} } = await chrome.storage.local.get("recipes"), r = recipes[st.host]; if (!r) return;
  const n = $("#saved"); n.hidden = false; n.innerHTML = `Saved setup for ${st.host}. <button class="btn" id="useSaved">Use it</button>`;
  $("#useSaved").onclick = async function useIt() { let d; try { d = await run("relocate", r.key); } catch (e) { return explainAccess(e, useIt); } if (!d) return status("The saved setup doesn’t match this page. Use Find data instead."); st.cols = r.cols.map(c => ({ ...c })); load(d); st.mode = r.mode; $$("[data-mode]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.mode === r.mode))); setBtn(r.btn); n.hidden = true; status("Saved setup applied."); };
}
$("#find").onclick = find; $("#prev").onclick = () => show(st.ci - 1); $("#next").onclick = () => show(st.ci + 1);
$("#pick").onclick = async function pickIt() { status("Click one item on the page…"); let r; try { r = await run("pick", "items"); } catch (e) { return explainAccess(e, pickIt); } if (!r) return status(""); if (r.error) return status(r.error); st.cands = await run("detect").catch(() => []); const d = await run("extract", 0); load(d); status(`Picked: ${r.rows} items.`); setBtn(await run("findNext")); };
chrome.tabs.onActivated.addListener(async ({ tabId }) => { if (st.crawling || new URLSearchParams(location.search).get("tab")) return; try { if ((await chrome.tabs.get(tabId)).url?.startsWith(chrome.runtime.getURL(""))) return; } catch {} st.tabId = tabId; st.cols = []; st.rows = []; ["#sData", "#sPages", "#sExport", "#candRow"].forEach(s => $(s).hidden = true); $("#empty").hidden = false; status(""); tab().then(offerRecipe); });
offerRecipe();

/* ---------- Saving a page or lesson (academic testing) ----------
   Everything comes from what the browser already has access to: the tab's pages and the files they load. Cookies are
   sent as your browser would send them, so content behind your own login can be saved, but no access control is
   bypassed. Chrome requires each permission request to come straight from a click, so frames from other sites get
   their own Allow button. */
let pendingSave = null;
const originOf = u => { try { return new URL(u).origin; } catch { return ""; } };
const has = async o => { try { return await chrome.permissions.contains({ origins: [o + "/*"] }); } catch { return false; } };

