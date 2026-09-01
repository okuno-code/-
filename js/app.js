(() => {
  "use strict";

  const STORAGE_KEY = "kakeibo.transactions";
  const THEME_KEY = "kakeibo.theme";

  const CATEGORIES = [
    { id: "main_job", label: "本業" },
    { id: "side_job", label: "副業" },
    { id: "food", label: "食費" },
    { id: "rent", label: "家賃" },
    { id: "utility", label: "光熱費" },
    { id: "entertainment", label: "娯楽" },
    { id: "stock", label: "株" },
    { id: "transport", label: "交通費" },
  ];

  const CATEGORY_COLORS = {
    main_job: "#7da7d9",
    side_job: "#a78bdb",
    food: "#e3a76f",
    rent: "#d98c9a",
    utility: "#8fc98a",
    entertainment: "#e6cb6b",
    stock: "#6fb8b2",
    transport: "#c97f63",
  };

  const THEMES = [
    { id: "red", label: "赤" },
    { id: "blue", label: "青" },
    { id: "yellow", label: "黄色" },
    { id: "purple", label: "紫" },
    { id: "white", label: "白" },
    { id: "black", label: "黒" },
    { id: "orange", label: "オレンジ" },
    { id: "pink", label: "ピンク" },
    { id: "brown", label: "茶色" },
  ];

  const THEME_BG = {
    red: "#fbe4e4", blue: "#e3f0fd", yellow: "#fdf6d9", purple: "#f1e3fb",
    white: "#ffffff", black: "#ececed", orange: "#fdebd8", pink: "#fce4ef",
    brown: "#f2e7df",
  };

  const MONTH_NAMES = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

  // ---------- state ----------
  const now = new Date();
  const state = {
    view: "home",
    calYear: now.getFullYear(),
    calMonth: now.getMonth(), // 0-11
    entryType: "expense",
    transactions: loadTransactions(),
  };

  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
  }

  function loadTheme() {
    return localStorage.getItem(THEME_KEY) || "blue";
  }

  function saveTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", THEME_BG[theme] || "#ffffff");
  }

  function formatCurrency(n) {
    const rounded = Math.round(n);
    const sign = rounded < 0 ? "-" : "";
    return sign + "¥" + Math.abs(rounded).toLocaleString("ja-JP");
  }

  function sumByType(list, type) {
    return list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  }

  function categoryLabel(id) {
    const cat = CATEGORIES.find((c) => c.id === id);
    return cat ? cat.label : "その他";
  }

  // ---------- DOM refs ----------
  const headerTitle = document.getElementById("header-title");
  const backBtn = document.getElementById("btn-back");
  const views = {
    home: document.getElementById("view-home"),
    calendar: document.getElementById("view-calendar"),
    report: document.getElementById("view-report"),
    settings: document.getElementById("view-settings"),
  };
  const navCalendarBtn = document.getElementById("nav-calendar");
  const navReportBtn = document.getElementById("nav-report");
  const navSettingsBtn = document.getElementById("nav-settings");

  const homeIncomeEl = document.getElementById("home-income");
  const homeExpenseEl = document.getElementById("home-expense");
  const homeBalanceEl = document.getElementById("home-balance");

  const entryForm = document.getElementById("entry-form");
  const inputAmount = document.getElementById("input-amount");
  const inputCategory = document.getElementById("input-category");
  const typeToggle = document.getElementById("type-toggle");
  const categoryField = document.getElementById("category-field");
  const typeButtons = document.querySelectorAll(".type-btn");

  const selectYear = document.getElementById("select-year");
  const selectMonth = document.getElementById("select-month");
  const breakdownSummary = document.getElementById("breakdown-summary");
  const transactionList = document.getElementById("transaction-list");
  const breakdownEmpty = document.getElementById("breakdown-empty");

  const pieIncomeEl = document.getElementById("pie-income");
  const pieExpenseEl = document.getElementById("pie-expense");
  const legendIncomeEl = document.getElementById("legend-income");
  const legendExpenseEl = document.getElementById("legend-expense");
  const reportTransactionList = document.getElementById("report-transaction-list");
  const reportEmpty = document.getElementById("report-empty");

  const colorGrid = document.getElementById("color-grid");

  const HEADER_TITLES = { home: "", calendar: "カレンダー", report: "レポート", settings: "設定" };

  // ---------- view switching ----------
  function switchView(view) {
    state.view = view;
    Object.entries(views).forEach(([key, el]) => {
      el.classList.toggle("hidden", key !== view);
    });
    backBtn.classList.toggle("hidden", view === "home");
    headerTitle.textContent = HEADER_TITLES[view];
    navCalendarBtn.classList.toggle("active", view === "calendar");
    navReportBtn.classList.toggle("active", view === "report");
    navSettingsBtn.classList.toggle("active", view === "settings");

    if (view === "home") renderHome();
    if (view === "calendar") renderCalendar();
    if (view === "report") renderReport();
    if (view === "settings") renderSettings();
  }

  backBtn.addEventListener("click", () => switchView("home"));
  navCalendarBtn.addEventListener("click", () => switchView("calendar"));
  navReportBtn.addEventListener("click", () => switchView("report"));
  navSettingsBtn.addEventListener("click", () => switchView("settings"));

  function thisMonthTransactions() {
    return state.transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }

  // ---------- home view ----------
  function renderHome() {
    const monthTx = thisMonthTransactions();
    const income = sumByType(monthTx, "income");
    const expense = sumByType(monthTx, "expense");
    const balance = income - expense;

    homeIncomeEl.textContent = formatCurrency(income);
    homeExpenseEl.textContent = formatCurrency(expense);
    homeBalanceEl.textContent = formatCurrency(balance);
  }

  typeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.entryType = btn.dataset.type;
      typeButtons.forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  function populateCategorySelect() {
    inputCategory.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.label;
      inputCategory.appendChild(opt);
    });
  }

  function setEntryFieldsVisible(visible) {
    typeToggle.classList.toggle("hidden", !visible);
    categoryField.classList.toggle("hidden", !visible);
  }

  inputAmount.addEventListener("input", () => {
    setEntryFieldsVisible(inputAmount.value.trim().length > 0);
  });

  entryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number(inputAmount.value);
    if (!amount || amount <= 0) return;

    state.transactions.push({
      id: Date.now(),
      type: state.entryType,
      amount,
      category: inputCategory.value,
      date: new Date().toISOString().slice(0, 10),
    });
    saveTransactions();
    inputAmount.value = "";
    setEntryFieldsVisible(false);
    inputAmount.focus();
    renderHome();
  });

  // ---------- calendar(履歴) view ----------
  function renderCalendar() {
    const years = new Set([now.getFullYear()]);
    state.transactions.forEach((t) => years.add(new Date(t.date).getFullYear()));
    const sortedYears = Array.from(years).sort((a, b) => a - b);

    selectYear.innerHTML = "";
    sortedYears.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y + "年";
      selectYear.appendChild(opt);
    });
    selectYear.value = state.calYear;

    selectMonth.innerHTML = "";
    MONTH_NAMES.forEach((label, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = label;
      selectMonth.appendChild(opt);
    });
    selectMonth.value = state.calMonth;

    const monthTx = state.transactions
      .filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === state.calYear && d.getMonth() === state.calMonth;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

    const income = sumByType(monthTx, "income");
    const expense = sumByType(monthTx, "expense");
    breakdownSummary.innerHTML = `
      <div class="figure"><span class="label">収入</span><span class="value income-amount">${formatCurrency(income)}</span></div>
      <div class="figure"><span class="label">支出</span><span class="value expense-amount">${formatCurrency(expense)}</span></div>
      <div class="figure"><span class="label">収支</span><span class="value ${income - expense >= 0 ? "balance-positive" : "balance-negative"}">${formatCurrency(income - expense)}</span></div>
    `;

    transactionList.innerHTML = "";
    breakdownEmpty.classList.toggle("hidden", monthTx.length > 0);

    monthTx.forEach((t) => {
      const li = document.createElement("li");
      li.className = "transaction-item";
      const d = new Date(t.date);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      li.innerHTML = `
        <span class="tx-icon">${t.type === "income" ? "↑" : "↓"}</span>
        <span class="tx-body">
          <span class="tx-category">${categoryLabel(t.category)}</span><br>
          <span class="tx-date">${dateStr}</span>
        </span>
        <span class="tx-amount ${t.type === "income" ? "income-amount" : "expense-amount"}">${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount)}</span>
        <button class="tx-delete" aria-label="取り消し" data-id="${t.id}">✕</button>
      `;
      transactionList.appendChild(li);
    });
  }

  selectYear.addEventListener("change", () => {
    state.calYear = Number(selectYear.value);
    renderCalendar();
  });
  selectMonth.addEventListener("change", () => {
    state.calMonth = Number(selectMonth.value);
    renderCalendar();
  });

  function handleDeleteClick(e) {
    const btn = e.target.closest(".tx-delete");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) return;
    const label = `${categoryLabel(tx.category)} ${formatCurrency(tx.amount)}`;
    if (confirm(`この記録を取り消しますか？\n${label}`)) {
      state.transactions = state.transactions.filter((t) => t.id !== id);
      saveTransactions();
      if (state.view === "calendar") renderCalendar();
      if (state.view === "report") renderReport();
    }
  }
  transactionList.addEventListener("click", handleDeleteClick);
  reportTransactionList.addEventListener("click", handleDeleteClick);

  // ---------- レポート画面(円グラフ) ----------
  function renderPie(pieEl, legendEl, txList) {
    const totals = {};
    txList.forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
    const total = txList.reduce((s, t) => s + t.amount, 0);

    legendEl.innerHTML = "";
    if (total <= 0) {
      pieEl.style.background = "#ececed";
      legendEl.innerHTML = '<li class="legend-empty">記録なし</li>';
      return;
    }

    let acc = 0;
    const stops = [];
    CATEGORIES.forEach((cat) => {
      const amt = totals[cat.id];
      if (!amt) return;
      const pct = (amt / total) * 100;
      const color = CATEGORY_COLORS[cat.id];
      stops.push(`${color} ${acc}% ${acc + pct}%`);
      acc += pct;

      const li = document.createElement("li");
      li.innerHTML = `
        <span class="legend-dot" style="background:${color}"></span>
        <span class="legend-label">${cat.label}</span>
        <span class="legend-value">${formatCurrency(amt)}</span>
      `;
      legendEl.appendChild(li);
    });
    pieEl.style.background = `conic-gradient(${stops.join(", ")})`;
  }

  function renderReport() {
    const monthTx = thisMonthTransactions().sort(
      (a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id
    );

    renderPie(pieIncomeEl, legendIncomeEl, monthTx.filter((t) => t.type === "income"));
    renderPie(pieExpenseEl, legendExpenseEl, monthTx.filter((t) => t.type === "expense"));

    reportTransactionList.innerHTML = "";
    reportEmpty.classList.toggle("hidden", monthTx.length > 0);

    monthTx.forEach((t) => {
      const li = document.createElement("li");
      li.className = "transaction-item";
      const d = new Date(t.date);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      li.innerHTML = `
        <span class="tx-icon">${t.type === "income" ? "↑" : "↓"}</span>
        <span class="tx-body">
          <span class="tx-category">${categoryLabel(t.category)}</span><br>
          <span class="tx-date">${dateStr}</span>
        </span>
        <span class="tx-amount ${t.type === "income" ? "income-amount" : "expense-amount"}">${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount)}</span>
        <button class="tx-delete" aria-label="取り消し" data-id="${t.id}">✕</button>
      `;
      reportTransactionList.appendChild(li);
    });
  }

  // ---------- settings view ----------
  function renderSettings() {
    colorGrid.innerHTML = "";
    const current = document.documentElement.getAttribute("data-theme");
    THEMES.forEach((theme) => {
      const btn = document.createElement("button");
      btn.className = "color-swatch" + (theme.id === current ? " selected" : "");
      btn.innerHTML = `
        <span class="swatch-check">✓</span>
        <span class="swatch-circle" style="background:${THEME_BG[theme.id]}"></span>
        <span class="swatch-name">${theme.label}</span>
      `;
      btn.addEventListener("click", () => {
        applyTheme(theme.id);
        saveTheme(theme.id);
        renderSettings();
      });
      colorGrid.appendChild(btn);
    });
  }

  // ---------- init ----------
  populateCategorySelect();
  applyTheme(loadTheme());
  switchView("home");
})();
