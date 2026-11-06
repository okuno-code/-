(() => {
  "use strict";

  const DATA_URL = "data/market.json";
  const REFRESH_MS = 5 * 60 * 1000;

  const $ = (id) => document.getElementById(id);
  const state = { data: null, range: "intraday", tag: "すべて", query: "" };

  // ---------- 書式 ----------
  const fmt = (v, digits = 2) =>
    v == null || isNaN(v)
      ? "--"
      : Number(v).toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const signed = (v, digits = 2) => (v == null ? "--" : (v > 0 ? "+" : v < 0 ? "−" : "±") + fmt(Math.abs(v), digits));

  const dirClass = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");
  const arrow = (v) => (v > 0 ? "▲" : v < 0 ? "▼" : "");

  const jstParts = (date) => {
    const p = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
      weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(date);
    return Object.fromEntries(p.map((x) => [x.type, x.value]));
  };

  const fmtTime = (unix) => { const p = jstParts(new Date(unix * 1000)); return `${p.hour}:${p.minute}`; };
  const fmtDay = (unix) => { const p = jstParts(new Date(unix * 1000)); return `${p.month}/${p.day}`; };

  const relTime = (iso) => {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff >= 0 && diff < 60) return "たった今";
    if (diff >= 0 && diff < 3600) return `${Math.floor(diff / 60)}分前`;
    if (diff >= 0 && diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
    const p = jstParts(new Date(iso));
    return `${p.month}/${p.day} ${p.hour}:${p.minute}`;
  };

  const isMarketOpen = () => {
    const p = jstParts(new Date());
    if (p.weekday === "土" || p.weekday === "日") return false;
    const m = Number(p.hour) * 60 + Number(p.minute);
    return (m >= 540 && m < 690) || (m >= 750 && m < 930); // 9:00-11:30, 12:30-15:30
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- データ取得 ----------
  async function load() {
    const btn = $("reload");
    btn.classList.add("spin");
    try {
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      state.data = await res.json();
      render();
    } catch (e) {
      showNotice("データを読み込めませんでした。時間をおいて再読み込みしてください。");
    } finally {
      btn.classList.remove("spin");
    }
  }

  function showNotice(msg) {
    const n = $("notice");
    n.textContent = msg;
    n.hidden = !msg;
  }

  // ---------- 描画 ----------
  function render() {
    const d = state.data;
    const p = jstParts(new Date());
    $("today").textContent = `${p.year}年${p.month}月${p.day}日（${p.weekday}）`;

    showNotice(d.sample
      ? "サンプルデータを表示しています。GitHub Actions のワークフロー実行後に実データへ切り替わります。"
      : "");

    const upd = d.updatedAt ? jstParts(new Date(d.updatedAt)) : null;
    $("updated").textContent = upd ? `最終更新: ${upd.month}/${upd.day} ${upd.hour}:${upd.minute}` : "最終更新: --";

    const nikkei = d.indices.find((i) => i.id === "nikkei") || d.indices[0];
    renderHero(nikkei);
    renderSubs(d.indices.filter((i) => i !== nikkei));
    renderChips();
    renderNews();
  }

  function renderHero(ix) {
    if (!ix) return;
    $("hero-name").textContent = ix.name;
    $("hero-price").textContent = fmt(ix.price, ix.digits);
    $("hero-unit").textContent = ix.unit;
    const ch = $("hero-change");
    ch.className = `change num ${dirClass(ix.change)}`;
    ch.textContent = `${arrow(ix.change)} ${signed(ix.change, ix.digits)}（${signed(ix.changePercent)}%）`;
    $("st-open").textContent = fmt(ix.open, ix.digits);
    $("st-high").textContent = fmt(ix.high, ix.digits);
    $("st-low").textContent = fmt(ix.low, ix.digits);
    $("st-prev").textContent = fmt(ix.previousClose, ix.digits);

    const ms = $("market-state");
    const open = isMarketOpen();
    ms.textContent = open ? "取引中" : "取引時間外";
    ms.classList.toggle("open", open);

    renderChart(ix);
  }

  function renderSubs(list) {
    $("subs").innerHTML = list.map((ix) => `
      <div class="card sub">
        <div class="name">${esc(ix.name)}</div>
        <div class="price num">${fmt(ix.price, ix.digits)}<span class="unit">${esc(ix.unit)}</span></div>
        <div class="chg num ${dirClass(ix.change)}">${arrow(ix.change)} ${signed(ix.change, ix.digits)}（${signed(ix.changePercent)}%）</div>
      </div>`).join("");
  }

  // ---------- チャート（SVG） ----------
  function chartSeries(ix) {
    if (state.range === "intraday") return ix.intraday || [];
    const daily = ix.daily || [];
    if (state.range === "1mo") {
      const from = Date.now() / 1000 - 31 * 86400;
      return daily.filter(([t]) => t >= from);
    }
    return daily;
  }

  function renderChart(ix) {
    const el = $("chart");
    const pts = chartSeries(ix);
    const W = el.clientWidth || 600;
    const H = el.clientHeight || 220;
    const pad = { l: 8, r: 58, t: 10, b: 22 };

    if (pts.length < 2) {
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><text class="empty" x="${W / 2}" y="${H / 2}" text-anchor="middle">チャートデータがありません</text></svg>`;
      return;
    }

    const isIntra = state.range === "intraday";
    const base = isIntra ? ix.previousClose : pts[0][1];
    const vals = pts.map((p) => p[1]).concat(base != null ? [base] : []);
    let min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    min -= span * 0.08; max += span * 0.08;

    const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
    const x = (t) => pad.l + ((t - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);

    const last = pts[pts.length - 1][1];
    const dir = last >= (base ?? last) ? "up" : "down";
    const color = `var(--${dir})`;

    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
    const area = `${line}L${x(t1).toFixed(1)},${H - pad.b}L${x(t0).toFixed(1)},${H - pad.b}Z`;

    // 横グリッド（4本）
    let grid = "";
    for (let i = 0; i <= 3; i++) {
      const v = min + ((max - min) * i) / 3;
      const yy = y(v).toFixed(1);
      grid += `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}"/>`;
      grid += `<text class="axis" x="${W - pad.r + 6}" y="${yy}" dy="4">${fmt(v, 0)}</text>`;
    }
    // 時間軸ラベル（4つ）
    let xl = "";
    for (let i = 0; i < 4; i++) {
      const p = pts[Math.round(((pts.length - 1) * i) / 3)];
      const anchor = i === 0 ? "start" : i === 3 ? "end" : "middle";
      xl += `<text class="axis" x="${x(p[0]).toFixed(1)}" y="${H - 4}" text-anchor="${anchor}">${isIntra ? fmtTime(p[0]) : fmtDay(p[0])}</text>`;
    }
    const prevLine = isIntra && base != null
      ? `<line class="prev" x1="${pad.l}" x2="${W - pad.r}" y1="${y(base).toFixed(1)}" y2="${y(base).toFixed(1)}"/>`
      : "";

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ix.name)}のチャート">
        <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="${color}" stop-opacity="0.25"/>
          <stop offset="1" stop-color="${color}" stop-opacity="0"/>
        </linearGradient></defs>
        ${grid}${prevLine}
        <path d="${area}" fill="url(#g)"/>
        <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
        ${xl}
        <line class="cursor" id="cur" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
        <circle id="dot" r="4" fill="${color}" visibility="hidden"/>
      </svg>
      <div class="tooltip" id="tip" hidden></div>`;

    // ホバー/タップで値を表示
    const svg = el.querySelector("svg");
    const cur = el.querySelector("#cur"), dot = el.querySelector("#dot"), tip = el.querySelector("#tip");
    const move = (clientX) => {
      const r = svg.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      let best = pts[0], bd = Infinity;
      for (const p of pts) { const d = Math.abs(x(p[0]) - px); if (d < bd) { bd = d; best = p; } }
      const cx = x(best[0]), cy = y(best[1]);
      cur.setAttribute("x1", cx); cur.setAttribute("x2", cx); cur.setAttribute("visibility", "visible");
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.textContent = `${isIntra ? fmtTime(best[0]) : fmtDay(best[0])}  ${fmt(best[1], ix.digits)}`;
      tip.style.left = `${Math.min(Math.max((cx / W) * r.width, 50), r.width - 50)}px`;
    };
    const hide = () => { cur.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.hidden = true; };
    svg.addEventListener("pointermove", (e) => move(e.clientX));
    svg.addEventListener("pointerdown", (e) => move(e.clientX));
    svg.addEventListener("pointerleave", hide);
  }

  // ---------- ニュース ----------
  function renderChips() {
    const tags = ["すべて", ...new Set(state.data.news.map((n) => n.tag).filter(Boolean))];
    if (!tags.includes(state.tag)) state.tag = "すべて";
    $("chips").innerHTML = tags.map((t) =>
      `<button class="chip${t === state.tag ? " active" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("");
  }

  function renderNews() {
    const q = state.query.trim().toLowerCase();
    const list = state.data.news.filter((n) =>
      (state.tag === "すべて" || n.tag === state.tag) &&
      (!q || n.title.toLowerCase().includes(q) || (n.source || "").toLowerCase().includes(q)));

    $("news-count").textContent = `${list.length}件`;
    $("news-list").innerHTML = list.length
      ? list.map((n) => `
        <li><a href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">
          <div class="title">${esc(n.title)}</div>
          <div class="meta">
            ${n.tag ? `<span class="tag">${esc(n.tag)}</span>` : ""}
            <span>${esc(n.source)}</span>
            <time datetime="${esc(n.published)}">${relTime(n.published)}</time>
          </div>
        </a></li>`).join("")
      : `<li class="news-empty">該当するニュースはありません</li>`;
  }

  // ---------- イベント ----------
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t === tab);
      t.setAttribute("aria-selected", t === tab);
    });
    state.range = tab.dataset.range;
    if (state.data) renderHero(state.data.indices.find((i) => i.id === "nikkei") || state.data.indices[0]);
  }));

  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    state.tag = b.dataset.tag;
    renderChips();
    renderNews();
  });

  $("news-filter").addEventListener("input", (e) => { state.query = e.target.value; if (state.data) renderNews(); });
  $("reload").addEventListener("click", load);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => state.data && renderHero(state.data.indices.find((i) => i.id === "nikkei") || state.data.indices[0]), 150);
  });

  load();
  setInterval(load, REFRESH_MS);
})();
