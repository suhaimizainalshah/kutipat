/* Kutipat page tools, injected into the page you choose:
   1. A selector finder and tester (like SelectorsHub): CSS, XPath and JS paths, with match counts and highlights.
   2. Sitemap extraction (like Web Scraper): a tree of selectors turned into rows, with links to follow and pagination.
   3. A list of the page’s resources (images, media, styles, scripts, fonts, documents) for saving.
   It only reads the page: it never changes, submits or logs in to anything. */
(() => {
if (window.__kutipatTools) return;
const MARK = "data-kutipat-mark", vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const txt = e => (e.innerText ?? e.textContent ?? "").replace(/\s+/g, " ").trim();
const stable = c => c && !/\d{3,}|^(is|has)-|active|hover|focus|selected|open|ng-|css-|sc-|jsx-/i.test(c) && c.length < 40;
const cssEsc = s => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, "\\$&"));

/* ---------- finding elements with CSS or XPath ---------- */
const isX = s => /^\s*(\/|\.\/|\(|\.\.)/.test(s);
function all(expr, ctx = document) {
  if (!expr) return []; try {
    if (isX(expr)) { const r = document.evaluate(expr, ctx, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null), out = []; for (let i = 0; i < r.snapshotLength; i++) { const n = r.snapshotItem(i); out.push(n.nodeType === 1 ? n : n.parentElement); } return out.filter(Boolean); }
    return [...ctx.querySelectorAll(expr)];
  } catch { return null; } // an invalid selector
}
/* ---------- building selectors for an element ---------- */
function seg(e, withNth) { let s = e.tagName.toLowerCase(); if (e.id && /^[A-Za-z][\w-]{0,40}$/.test(e.id) && !/\d{3,}/.test(e.id)) return "#" + cssEsc(e.id);
  const cls = [...e.classList].filter(stable).slice(0, 2); if (cls.length) s += cls.map(c => "." + cssEsc(c)).join("");
  if (withNth && e.parentElement) { const same = [...e.parentElement.children].filter(c => c.tagName === e.tagName); if (same.length > 1) s += `:nth-of-type(${same.indexOf(e) + 1})`; } return s; }
function uniqueCss(e, root = document) { const parts = []; for (let a = e; a && a !== root && a.nodeType === 1 && a !== document.documentElement; a = a.parentElement) { parts.unshift(seg(a, true)); const sel = parts.join(" > "); if (parts[0].startsWith("#") || all(sel, root)?.length === 1) return sel; } return parts.join(" > "); }
function similarCss(e, root = document) { // the same path without positions, so it matches items like this one
  const parts = []; for (let a = e; a && a !== root && a.nodeType === 1 && a !== document.body && parts.length < 6; a = a.parentElement) { parts.unshift(seg(a, false)); if (parts[0].startsWith("#")) break; }
  let sel = parts.join(" "); while (parts.length > 2 && (all(parts.slice(1).join(" "), root)?.length || 0) === (all(sel, root)?.length || 0)) { parts.shift(); sel = parts.join(" "); } return sel; }
function absXPath(e) { const p = []; for (let a = e; a && a.nodeType === 1; a = a.parentElement) { const same = a.parentElement ? [...a.parentElement.children].filter(c => c.tagName === a.tagName) : [a]; p.unshift(a.tagName.toLowerCase() + (same.length > 1 ? `[${same.indexOf(a) + 1}]` : "")); } return "/" + p.join("/"); }
function relXPath(e) { for (let a = e, steps = []; a && a.nodeType === 1; a = a.parentElement) {
    const t = a.tagName.toLowerCase(); if (a.id && !/\d{3,}/.test(a.id)) return `//${t}[@id='${a.id}']` + (steps.length ? "/" + steps.join("/") : "");
    for (const at of ["data-testid", "data-test", "name", "aria-label", "title"]) { const v = a.getAttribute(at); if (v && v.length < 60 && !v.includes("'")) { const x = `//${t}[@${at}='${v}']` + (steps.length ? "/" + steps.join("/") : ""); if (all(x)?.length === 1) return x; } }
    const cls = [...a.classList].find(stable); if (cls) { const x = `//${t}[contains(concat(' ',normalize-space(@class),' '),' ${cls} ')]` + (steps.length ? "/" + steps.join("/") : ""), n = all(x)?.length;
      if (n === 1) return x; if (a !== e && n > 1) { const idx = all(`//${t}[contains(concat(' ',normalize-space(@class),' '),' ${cls} ')]`).indexOf(a) + 1; if (idx) return `(//${t}[contains(concat(' ',normalize-space(@class),' '),' ${cls} ')])[${idx}]` + (steps.length ? "/" + steps.join("/") : ""); } }
    const same = a.parentElement ? [...a.parentElement.children].filter(c => c.tagName === a.tagName) : [a]; steps.unshift(t + (same.length > 1 ? `[${same.indexOf(a) + 1}]` : "")); }
  return absXPath(e); }
function textXPath(e) { const t = txt(e); if (!t || t.length > 50 || t.includes("'")) return null; return `//${e.tagName.toLowerCase()}[normalize-space()='${t}']`; }
function jsPath(e) { return `document.querySelector(${JSON.stringify(uniqueCss(e))})`; }
function selectorsFor(e, ctxSel) {
  const ctx = ctxSel ? e.closest(ctxSel) || null : null, out = [];
  const add = (kind, expr, note) => { if (!expr) return; const n = all(expr, kind === "relative" && ctx ? ctx : document); out.push({ kind, expr, count: n ? n.length : 0, note }); };
  if (ctx) { add("relative", similarCss(e, ctx), "Inside each matching item"); }
  add("css", uniqueCss(e), "Unique CSS"); add("similar", similarCss(e), "All items like this one"); add("xpath", relXPath(e), "Relative XPath");
  add("text", textXPath(e), "XPath by its text"); add("absolute", absXPath(e), "Absolute XPath"); out.push({ kind: "js", expr: jsPath(e), count: 1, note: "JS path" });
  return { sample: txt(e).slice(0, 80) || e.getAttribute("src") || e.getAttribute("href") || e.tagName.toLowerCase(), tag: e.tagName.toLowerCase(), selectors: out };
}
/* ---------- highlighting and picking ---------- */
function clear() { document.querySelectorAll(`[${MARK}]`).forEach(e => { e.style.outline = e.dataset.kutOutline || ""; e.style.outlineOffset = ""; e.removeAttribute(MARK); delete e.dataset.kutOutline; }); }
function mark(list, colour = "#d9480f") { clear(); (list || []).slice(0, 500).forEach(e => { e.setAttribute(MARK, ""); e.dataset.kutOutline = e.style.outline; e.style.outline = `3px solid ${colour}`; e.style.outlineOffset = "1px"; }); }
function test(expr, ctxSel) { const roots = ctxSel ? all(ctxSel) || [] : [document]; let found = []; for (const r of roots) { const n = all(expr, r); if (n === null) return { error: "That isn’t a valid CSS or XPath selector." }; found.push(...n); }
  found = [...new Set(found)]; mark(found); found[0]?.scrollIntoView({ block: "center", behavior: "smooth" }); return { count: found.length, visible: found.filter(vis).length, samples: found.slice(0, 5).map(e => txt(e).slice(0, 60) || e.tagName.toLowerCase()) }; }
function pickEl(ctxSel) { return new Promise(res => {
  const box = document.createElement("div"), tip = document.createElement("div"); for (const x of [box, tip]) x.setAttribute("data-kutipat", "");
  box.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;outline:3px dashed #d9480f;background:rgba(217,72,15,.1);border-radius:3px";
  tip.textContent = "Click an element to get its selectors. Esc cancels."; tip.style.cssText = "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483647;background:#16181d;color:#fff;font:600 14px system-ui;padding:8px 14px;border-radius:999px";
  document.documentElement.append(box, tip); let target = null;
  const move = e => { const t = document.elementFromPoint(e.clientX, e.clientY); if (!t || t.closest("[data-kutipat]")) return; target = t; const r = t.getBoundingClientRect(); Object.assign(box.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" }); };
  const done = v => { removeEventListener("mousemove", move, true); removeEventListener("click", click, true); removeEventListener("keydown", key, true); box.remove(); tip.remove(); res(v); };
  const click = e => { e.preventDefault(); e.stopPropagation(); done(target ? selectorsFor(target, ctxSel) : null); };
  const key = e => { if (e.key === "Escape") { e.preventDefault(); done(null); } };
  addEventListener("mousemove", move, true); addEventListener("click", click, true); addEventListener("keydown", key, true); }); }

/* ---------- sitemaps: a tree of selectors becomes rows ----------
   Selector types: text, link, image, attribute, html, table, element (a group: each match becomes a row) and pagination.
   A link with "follow" is opened by the crawler, and the selectors whose parent is that link run on the new page. */
const abs = u => { try { return new URL(u, location.href).href; } catch { return ""; } };
function value(s, e) {
  if (s.type === "link") return { text: txt(e), url: abs(e.getAttribute("href") || "") };
  if (s.type === "image") return abs(e.currentSrc || e.getAttribute("src") || e.getAttribute("data-src") || "");
  if (s.type === "attribute") return e.getAttribute(s.attr || "href") ?? ""; if (s.type === "html") return e.innerHTML.trim(); return txt(e);
}
function evalCtx(ctx, parentId, sels) {
  const kids = sels.filter(s => (s.parent || "_root") === parentId && s.type !== "pagination"), base = {}, follow = [], groups = [];
  for (const s of kids) { const found = all(s.css, ctx) || [], list = s.multiple ? found : found.slice(0, 1);
    if (s.type === "element") { groups.push(list.map(el => evalCtx(el, s.id, sels)).flat()); continue; }
    if (s.type === "table") { const t = list[0]; if (!t) continue; const rows = [...t.querySelectorAll("tr")], head = [...(rows.find(r => r.querySelector("th")) || rows[0] || { children: [] }).children].map((c, i) => txt(c) || `Column ${i + 1}`);
      groups.push(rows.filter(r => !r.querySelector("th")).map(r => ({ fields: Object.fromEntries([...r.children].map((c, i) => [`${s.name}: ${head[i] || "Column " + (i + 1)}`, txt(c)])), follow: [] }))); continue; }
    const vals = list.map(e => value(s, e));
    if (s.type === "link") { base[s.name] = vals.map(v => v.text).join(" | "); base[s.name + " (link)"] = vals.map(v => v.url).join(" | "); if (s.follow) vals.forEach(v => v.url && follow.push({ sel: s.id, url: v.url })); }
    else base[s.name] = vals.join(" | ");
  }
  let rows = [{ fields: base, follow }]; // each element group multiplies the rows, as in Web Scraper
  for (const g of groups) if (g.length) rows = rows.flatMap(r => g.map(x => ({ fields: { ...r.fields, ...x.fields }, follow: [...r.follow, ...x.follow] })));
  return rows;
}
function runSitemap(sels, parentId = "_root") {
  const rows = evalCtx(document, parentId, sels).filter(r => Object.values(r.fields).some(v => v !== "") || r.follow.length);
  const next = sels.filter(s => s.type === "pagination" && (s.parent || "_root") === parentId).flatMap(s => (all(s.css) || []).map(e => abs(e.getAttribute("href") || ""))).filter(Boolean);
  return { rows, next: [...new Set(next)], url: location.href, title: document.title };
}

/* ---------- the page’s resources ---------- */
function resources() {
  const out = new Map(), add = (u, type, how) => { if (!u) return; const a = u.startsWith("data:") ? u : abs(u); if (!a || /^(javascript|about|blob):/.test(a)) return; if (!out.has(a)) out.set(a, { url: a, type, how }); };
  const kind = u => /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)(\?|#|$)/i.test(u) ? "images" : /\.(mp4|webm|mov|m4v|ogv|mp3|m4a|wav|ogg|aac|flac)(\?|#|$)/i.test(u) ? "media" : /\.(css)(\?|#|$)/i.test(u) ? "styles" : /\.(m?js)(\?|#|$)/i.test(u) ? "scripts" : /\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(u) ? "fonts" : /\.(pdf|docx?|xlsx?|pptx?|csv|zip|txt|json)(\?|#|$)/i.test(u) ? "documents" : null;
  document.querySelectorAll("img").forEach(i => { add(i.currentSrc || i.src, "images", "img"); (i.srcset || "").split(",").forEach(s => add(s.trim().split(/\s+/)[0], "images", "srcset")); });
  document.querySelectorAll("picture source[srcset]").forEach(s => s.srcset.split(",").forEach(x => add(x.trim().split(/\s+/)[0], "images", "picture")));
  document.querySelectorAll("video,audio").forEach(m => { add(m.currentSrc || m.src, "media", m.tagName.toLowerCase()); if (m.poster) add(m.poster, "images", "poster"); m.querySelectorAll("source,track").forEach(s => add(s.src, s.tagName === "TRACK" ? "documents" : "media", "source")); });
  document.querySelectorAll("link[href]").forEach(l => { const r = (l.rel || "").toLowerCase(); add(l.href, /stylesheet/.test(r) ? "styles" : /icon/.test(r) ? "images" : kind(l.href) || (/preload/.test(r) ? (l.as === "font" ? "fonts" : l.as === "script" ? "scripts" : l.as === "style" ? "styles" : "other") : null), "link"); });
  document.querySelectorAll("script[src]").forEach(s => add(s.src, "scripts", "script"));
  document.querySelectorAll("a[href]").forEach(a => { const k = kind(a.href); if (k === "documents" || k === "media") add(a.href, k, "link"); });
  let n = 0; for (const el of document.querySelectorAll("body *")) { if (++n > 4000) break; const bg = getComputedStyle(el).backgroundImage; if (bg && bg !== "none") for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) add(m[1], "images", "css background"); }
  for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; } for (const r of rules) if (r.type === CSSRule.FONT_FACE_RULE) for (const m of r.cssText.matchAll(/url\(["']?([^"')]+)["']?\)/g)) add(new URL(m[1], sh.href || location.href).href, "fonts", "@font-face"); }
  for (const p of performance.getEntriesByType("resource")) { if (/^(fetch|xmlhttprequest|beacon)$/.test(p.initiatorType)) continue; // data calls are left out
    const k = kind(p.name) || { img: "images", css: "styles", script: "scripts", video: "media", audio: "media", link: "other" }[p.initiatorType]; if (k) add(p.name, k, "loaded"); }
  return { page: location.href, title: document.title, list: [...out.values()] };
}
// Everything readable on the page, for "Save everything on this page": links, images, and the text as simple Markdown.
function pageSummary() {
  const seen = new Set(), links = [];
  document.querySelectorAll("a[href]").forEach(a => { const url = abs(a.getAttribute("href")); if (!url || /^(javascript|mailto|tel):/i.test(url)) return;
    const text = txt(a).slice(0, 300), k = url + "\n" + text; if (seen.has(k)) return; seen.add(k); links.push({ text, url }); });
  const images = [...document.images].map(i => ({ src: i.currentSrc || i.src, alt: (i.alt || "").trim(), width: i.naturalWidth || "", height: i.naturalHeight || "" }))
    .filter(x => x.src && !x.src.startsWith("data:"));
  const shown = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return (r.width || r.height) && cs.visibility !== "hidden" && cs.display !== "none"; };
  const lines = []; let last = "";
  document.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption,dt,dd").forEach(e => {
    if (e.closest("nav,footer,script,style,noscript,[aria-hidden=true]") || !shown(e)) return;
    if (e.tagName === "P" && e.closest("li,blockquote")) return;                    // counted with its list item or quotation
    const t = e.tagName === "PRE" ? e.innerText.trim() : txt(e); if (!t || t === last) return; last = t;
    const tag = e.tagName; lines.push(/^H[1-6]$/.test(tag) ? "#".repeat(+tag[1]) + " " + t : tag === "LI" ? "- " + t : tag === "BLOCKQUOTE" ? "> " + t : tag === "PRE" ? "```\n" + t + "\n```" : t);
  });
  const desc = document.querySelector('meta[name="description"]')?.content || "";
  return { title: document.title, url: location.href, description: desc, links, images, text: lines.join("\n\n") };
}
window.__kutipatTools = { pickEl, test, clear, selectorsFor, runSitemap, resources, all, pageSummary };
})();
