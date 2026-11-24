/* Kutipat page engine. Injected into the page only when you use Kutipat. It reads the page; it never sends anything anywhere.
   Detection follows the idea of MDR, "Mining Data Records in Web Pages" (Liu, Grossman and Zhai, KDD 2003): data records
   are repeated sibling structures, so the engine groups children by a structural signature and scores the groups. */
(() => {
  if (window.__kutipat) return;
  const NOISE = /^(active|selected|current|hover|focus|odd|even|first|last|is-|js-|ng-|css-|sc-|jsx-|svelte-)|\d{3,}|^[a-z0-9]{6,}$/i;
  const sig = el => el.tagName + "." + [...el.classList].filter(c => !NOISE.test(c)).sort().join(".");
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== "hidden"; };
  const area = el => { const r = el.getBoundingClientRect(); return r.width * r.height; };
  const txt = el => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  const cssPath = el => { const p = []; for (let e = el; e && e.nodeType === 1 && e !== document.body && p.length < 25; e = e.parentElement) { if (e.id && !/\d{3,}/.test(e.id)) { p.unshift("#" + CSS.escape(e.id)); break; } const same = e.parentElement ? [...e.parentElement.children].filter(c => c.tagName === e.tagName) : []; p.unshift(e.tagName.toLowerCase() + (same.length > 1 ? `:nth-of-type(${same.indexOf(e) + 1})` : "")); } return (p[0]?.startsWith("#") ? "" : "body > ") + p.join(" > "); }; // anchored at the top, so it names exactly one element
  const abs = u => { try { return new URL(u, location.href).href; } catch { return u || ""; } };
  const bestSrc = img => { const ss = img.getAttribute("srcset"); if (ss) { const c = ss.split(",").map(s => s.trim().split(/\s+/)).map(([u, w]) => [u, parseFloat(w) || 1]).sort((a, b) => b[1] - a[1])[0]; if (c) return abs(c[0]); } return abs(img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || ""); };
  let cands = [], current = null, overlay = null;

  function detect() {
    const out = [], all = document.body.querySelectorAll("*"); let n = 0;
    for (const t of document.querySelectorAll("table")) {
      const rows = [...t.querySelectorAll(":scope > tbody > tr, :scope > tr")].filter(r => r.cells.length >= 2 && visible(r));
      if (rows.length >= 2) out.push({ kind: "table", container: t, items: rows, score: rows.length * Math.min(area(t), 4e5) * 1.3 });
    }
    for (const el of all) {
      if (++n > 25000) break;
      if (el.children.length < 3 || /^(TABLE|TBODY|THEAD|TFOOT|TR|SELECT|HEAD)$/.test(el.tagName)) continue; // tables are handled above
      const groups = new Map(); for (const c of el.children) { if (/^(SCRIPT|STYLE|TEMPLATE|BR|HR)$/.test(c.tagName)) continue; const s = sig(c); (groups.get(s) || groups.set(s, []).get(s)).push(c); }
      for (const items of groups.values()) {
        if (items.length < 3) continue; const vis = items.filter(visible); if (vis.length < 3) continue;
        const texts = vis.map(i => txt(i).length), avgT = texts.reduce((a, b) => a + b, 0) / vis.length; if (avgT < 3 && !vis.some(i => i.querySelector("img"))) continue;
        const kids = vis.reduce((a, i) => a + i.querySelectorAll("*").length, 0) / vis.length; // richer records score higher
        const areas = vis.map(area).sort((a, b) => a - b), med = areas[areas.length >> 1];
        out.push({ kind: "list", container: el, items: vis, score: vis.length * Math.min(med, 2e5) * Math.min(1 + kids / 4, 4) * Math.min(1 + avgT / 40, 3) });
      }
    }
    // keep the best candidate per container, then drop candidates nested inside a better one with the same rows
    const best = new Map(); out.forEach(c => { const b = best.get(c.container); if (!b || c.score > b.score) best.set(c.container, c); });
    cands = [...best.values()].sort((a, b) => b.score - a.score).filter((c, i, arr) => !arr.slice(0, i).some(b => b.items.length === c.items.length && (b.container.contains(c.container) || c.container.contains(b.container)))).slice(0, 12);
    return cands.map((c, i) => ({ i, kind: c.kind, rows: c.items.length, sample: txt(c.items[0]).slice(0, 80) }));
  }

  // Columns: each item's leaf texts, links and images, keyed by their path inside the item
  function relPath(root, el) { const p = []; for (let e = el; e && e !== root; e = e.parentElement) { const same = [...e.parentElement.children].filter(c => c.tagName === e.tagName); const cls = [...e.classList].find(c => !NOISE.test(c)); p.unshift(e.tagName.toLowerCase() + (cls ? "." + cls : "") + (same.length > 1 ? `[${same.indexOf(e)}]` : "")); } return p.join("/") || "."; }
  function fieldsOf(item) {
    const f = new Map(), add = (k, v, hint) => { if (v && !f.has(k)) f.set(k, { v, hint }); };
    const walk = el => {
      if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|TEMPLATE)$/.test(el.tagName) || !visible(el) && el.tagName !== "IMG") return;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(" ").replace(/\s+/g, " ").trim();
      const p = relPath(item, el); if (own) add(p + "@text", own, [...el.classList].join(" ") || el.tagName);
      if (el.tagName === "A" && el.getAttribute("href") && !/^(javascript:|#)/.test(el.getAttribute("href"))) add(p + "@href", abs(el.getAttribute("href")), "link");
      if (el.tagName === "IMG") { add(p + "@src", bestSrc(el), "image"); add(p + "@alt", (el.alt || "").trim(), "alt"); }
      if (el.tagName === "TIME" && el.getAttribute("datetime")) add(p + "@datetime", el.getAttribute("datetime"), "date");
      for (const c of el.children) walk(c);
    };
    walk(item); return f;
  }
  function extract(i) {
    const c = typeof i === "number" ? cands[i] : i; if (!c) return null; current = c;
    if (c.kind === "table") {
      const t = c.container, head = [...(t.tHead?.rows[0]?.cells || t.querySelector("tr th") ? (t.tHead?.rows[0] || t.querySelector("tr")).cells : [])].map(th => txt(th));
      const rows = c.items.filter(r => ![...r.cells].every(x => x.tagName === "TH")), width = Math.max(...rows.map(r => r.cells.length));
      const cols = []; for (let k = 0; k < width; k++) { cols.push({ key: "c" + k, name: head[k] || `Column ${k + 1}` }); if (rows.some(r => r.cells[k]?.querySelector("a[href]"))) cols.push({ key: "c" + k + "@href", name: (head[k] || `Column ${k + 1}`) + " link" }); }
      const data = rows.map(r => { const o = {}; for (let k = 0; k < width; k++) { const cell = r.cells[k]; o["c" + k] = cell ? txt(cell) : ""; const a = cell?.querySelector("a[href]"); if (a) o["c" + k + "@href"] = abs(a.getAttribute("href")); } return o; });
      return { cols, rows: data, key: { kind: "table", container: cssPath(t) } };
    }
    const per = c.items.map(fieldsOf), count = new Map(), first = new Map(), hint = new Map();
    per.forEach((f, ri) => f.forEach((x, k) => { count.set(k, (count.get(k) || 0) + 1); if (!first.has(k)) { first.set(k, ri * 1000 + first.size); hint.set(k, x.hint); } }));
    const min = Math.max(1, Math.ceil(per.length * 0.2));
    const keys = [...count.keys()].filter(k => count.get(k) >= min).sort((a, b) => first.get(a) - first.get(b)).slice(0, 40);
    const names = new Map(), used = {};
    for (const k of keys) {
      const h = hint.get(k), kind = k.split("@")[1];
      const TAGNAMES = { H1: "Heading", H2: "Heading", H3: "Heading", H4: "Heading", H5: "Heading", H6: "Heading", P: "Text", SPAN: "Text", DIV: "Text", LI: "Item", TIME: "Date", STRONG: "Text", B: "Text", EM: "Text", SMALL: "Note", LABEL: "Label", TD: "Text", A: "Link text", BUTTON: "Button text" };
      let n = kind === "href" ? "Link" : kind === "src" ? "Image" : kind === "alt" ? "Image text" : kind === "datetime" ? "Date" : (String(h).split(/\s+/).map(w => w.replace(/[-_]+/g, " ").replace(/\b(item|card|product|listing|result|col|row|text|wrapper|inner|container|content)\b/gi, "").trim()).find(w => w && /[a-z]/i.test(w) && w.length < 24 && !/^[A-Z0-9]{1,6}$/.test(w)) || TAGNAMES[h] || "Text"); // a bare tag name (such as H2) becomes a plain name
      n = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase(); used[n] = (used[n] || 0) + 1; names.set(k, used[n] > 1 ? `${n} ${used[n]}` : n);
    }
    // name a repeated "Text" column after what it looks like
    return { cols: keys.map(k => ({ key: k, name: names.get(k) })), rows: per.map(f => Object.fromEntries(keys.map(k => [k, f.get(k)?.v || ""]))), key: { kind: "list", container: cssPath(c.container), itemSig: sig(c.items[0]) } };
  }
  // Find the same data again on another page or after more content loads
  function relocate(key) {
    if (!key) return null; const ctr = document.querySelector(key.container);
    if (key.kind === "table" && ctr) return extract({ kind: "table", container: ctr, items: [...ctr.querySelectorAll(":scope > tbody > tr, :scope > tr")].filter(r => r.cells.length >= 2) });
    if (ctr) { const items = [...ctr.children].filter(c => sig(c) === key.itemSig && visible(c)); if (items.length) return extract({ kind: "list", container: ctr, items }); }
    for (const el of document.body.querySelectorAll("*")) { const items = [...el.children].filter(c => sig(c) === key.itemSig && visible(c)); if (items.length >= 2) return extract({ kind: "list", container: el, items }); }
    return null;
  }
  function highlight(i) {
    clear(); const c = cands[i] || current; if (!c) return;
    overlay = document.createElement("div"); overlay.setAttribute("data-kutipat", ""); overlay.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:2147483646";
    document.documentElement.append(overlay);
    c.items.slice(0, 300).forEach((it, k) => { const r = it.getBoundingClientRect(), b = document.createElement("div"); b.style.cssText = `position:absolute;left:${r.left + scrollX}px;top:${r.top + scrollY}px;width:${r.width}px;height:${r.height}px;outline:2px solid #e0412b;background:rgba(224,65,43,.08);border-radius:3px`; overlay.append(b); });
    c.items[0].scrollIntoView({ block: "center", behavior: "smooth" });
  }
  function clear() { overlay?.remove(); overlay = null; }

  // Point and click: choose one item, and Kutipat finds its siblings
  function pick(purpose) {
    return new Promise(res => {
      const box = document.createElement("div"); box.setAttribute("data-kutipat", ""); box.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;outline:3px dashed #2453d6;background:rgba(36,83,214,.1);border-radius:3px;transition:all .05s";
      const tip = document.createElement("div"); tip.setAttribute("data-kutipat", ""); tip.textContent = purpose === "next" ? "Click the Next or Load more button. Esc cancels." : "Click one item in the list you want. Esc cancels."; tip.style.cssText = "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483647;background:#16191d;color:#fff;font:600 14px system-ui;padding:8px 14px;border-radius:999px";
      document.documentElement.append(box, tip); let target = null;
      const move = e => { target = document.elementFromPoint(e.clientX, e.clientY); if (!target || target.closest("[data-kutipat]")) return; const r = target.getBoundingClientRect(); Object.assign(box.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" }); };
      const done = v => { removeEventListener("mousemove", move, true); removeEventListener("click", click, true); removeEventListener("keydown", key, true); box.remove(); tip.remove(); res(v); };
      const click = e => { e.preventDefault(); e.stopPropagation(); if (!target) return done(null);
        if (purpose === "next") { const b = target.closest("a,button,[role=button],input[type=submit],input[type=button]") || target; return done({ selector: cssPath(b), text: txt(b).slice(0, 40) }); }
        for (let a = target, up = 0; a && a !== document.body && up < 8; a = a.parentElement, up++) { const p = a.parentElement; if (!p) break; const items = [...p.children].filter(c => sig(c) === sig(a) && visible(c)); if (items.length >= 2) { cands.unshift({ kind: "list", container: p, items, score: 1 }); return done({ i: 0, rows: items.length }); } }
        done({ error: "Kutipat couldn’t find other items like that one. Try clicking the edge of an item." }); };
      const key = e => { if (e.key === "Escape") { e.preventDefault(); done(null); } };
      addEventListener("mousemove", move, true); addEventListener("click", click, true); addEventListener("keydown", key, true);
    });
  }
  // Pages: find, press or scroll for more
  function findNext() {
    const q = [...document.querySelectorAll('a[rel~="next"], link[rel~="next"]')].find(e => e.tagName === "A" ? visible(e) : true);
    if (q && q.tagName === "A") return { selector: cssPath(q), text: txt(q).slice(0, 40) };
    const cands2 = [...document.querySelectorAll("a,button,[role=button]")].filter(visible).filter(e => /^(next|next page|older|›|»|→|load more|show more|more results)\b/i.test(txt(e) || e.getAttribute("aria-label") || "") || /\bnext\b/i.test(e.getAttribute("aria-label") || ""));
    const b = cands2.find(e => !e.disabled && e.getAttribute("aria-disabled") !== "true"); return b ? { selector: cssPath(b), text: txt(b).slice(0, 40) || b.getAttribute("aria-label") } : null;
  }
  function press(sel) { const b = sel && document.querySelector(sel); if (!b || b.disabled || b.getAttribute("aria-disabled") === "true" || !visible(b)) return false; b.scrollIntoView({ block: "center" }); b.click(); return true; }
  function scrollMore() { const before = document.documentElement.scrollHeight; scrollTo({ top: before, behavior: "instant" }); return before; }

  /* ---------- Saving a page or lesson (academic testing) ----------
     Collects only what this frame has already loaded or references. It does not bypass logins, DRM, encryption or any
     other access control. */
  window.__kutipat = { detect, extract, relocate, highlight, clear, pick, findNext, press, scrollMore, height: () => document.documentElement.scrollHeight, robots: () => location.origin + "/robots.txt", url: () => location.href };
})();
