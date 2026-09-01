(() => {
  "use strict";

  const STORAGE_KEY = "kakeibo.transactions";
  const THEME_KEY = "kakeibo.theme";

  const CATEGORIES = {
    expense: [
      { id: "food", label: "食費", icon: "🍚" },
      { id: "daily", label: "日用品", icon: "🧻" },
      { id: "transport", label: "交通", icon: "🚃" },
      { id: "housing", label: "住居", icon: "🏠" },
      { id: "utility", label: "光熱費", icon: "💡" },
      { id: "communication", label: "通信", icon: "📱" },
      { id: "entertainment", label: "娯楽", icon: "🎮" },
      { id: "medical", label: "医療", icon: "🏥" },
      { id: "clothing", label: "衣服", icon: "👕" },
      { id: "other_expense", label: "その他", icon: "📦" },
    ],
    income: [
      { id: "salary", label: "給与", icon: "💼" },
      { id: "bonus", label: "ボーナス", icon: "🎁" },
      { id: "side_job", label: "副業", icon: "💻" },
      { id: "allowance", label: "お小遣い", icon: "👛" },
      { id: "other_income", label: "その他", icon: "📥" },
    ],
  };

  const THEMES = [
    { id: "red", label: "赤" },
    { id: "blue", label: "青" },
    { id: "yellow", label: "黄色" },
    { id: "lightblue", label: "水色" },
    { id: "pink", label: "ピンク" },
    { id: "white", label: "白" },
    { id: "black", label: "黒" },
    { id: "silver", label: "シルバー" },
    { id: "orange", label: "オレンジ" },
    { id: "purple", label: "紫" },
    { id: "green", label: "緑" },
  ];

  const THEME_BG = {
    red: "#fde8e8", blue: "#e3f0fd", yellow: "#fdf6db", lightblue: "#e0f7fa",
    pink: "#fce4ec", white: "#ffffff", black: "#ececed", silver: "#f1f2f4",
    orange: "#fdebd8", purple: "#f1e3fb", green: "#e3f6e8",
  };

  const MONTH_NAMES = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

  // ---------- state ----------
  const now = new Date();
  const state = {
    view: "home",
    homeYear: now.getFullYear(),
    bdYear: now.getFullYear(),
    bdMonth: now.getMonth(), // 0-11
    bdFilter: "all",
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

  function categoryInfo(type, categoryId) {
    const list = CATEGORIES[type] || [];
    return list.find((c) => c.id === categoryId) || list[list.length - 1];
  }

  // ---------- DOM refs ----------
  const headerTitle = document.getElementById("header-title");
  const views = {
    home: document.getElementById("view-home"),
    breakdown: document.getElementById("view-breakdown"),
    settings: document.getElementById("view-settings"),
  };
  const navButtons = document.querySelectorAll(".nav-btn");
  const fab = document.getElementById("fab-add");

  const yearLabel = document.getElementById("year-label");
  const monthList = document.getElementById("month-list");
  const homeIncomeEl = document.getElementById("home-income");
  const homeExpenseEl = document.getElementById("home-expense");
  const homeBalanceEl = document.getElementById("home-balance");

  const monthLabel = document.getElementById("month-label");
  const breakdownSummary = document.getElementById("breakdown-summary");
  const transactionList = document.getElementById("transaction-list");
  const breakdownEmpty = document.getElementById("breakdown-empty");

  const colorGrid = document.getElementById("color-grid");

  const modal = document.getElementById("modal-add");
  const addForm = document.getElementById("add-form");
  const inputAmount = document.getElementById("input-amount");
  const inputCategory = document.getElementById("input-category");
  const inputDate = document.getElementById("input-date");
  const inputMemo = document.getElementById("input-memo");
  let modalType = "expense";

  const HEADER_TITLES = { home: "ホーム", breakdown: "内訳", settings: "設定" };

  // ---------- view switching ----------
  function switchView(view) {
    state.view = view;
    Object.entries(views).forEach(([key, el]) => {
      el.classList.toggle("hidden", key !== view);
    });
    navButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    headerTitle.textContent = HEADER_TITLES[view];
    fab.classList.toggle("hidden", view === "settings");

    if (view === "home") renderHome();
    if (view === "breakdown") renderBreakdown();
    if (view === "settings") renderSettings();
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  // ---------- home view ----------
  function renderHome() {
    yearLabel.textContent = state.homeYear + "年";

    const yearTx = state.transactions.filter(
      (t) => new Date(t.date).getFullYear() === state.homeYear
    );
    const income = yearTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = yearTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    homeIncomeEl.textContent = formatCurrency(income);
    homeExpenseEl.textContent = formatCurrency(expense);
    homeBalanceEl.textContent = formatCurrency(balance);
    homeBalanceEl.className = "summary-amount " + (balance >= 0 ? "balance-positive" : "balance-negative");

    monthList.innerHTML = "";
    for (let m = 0; m < 12; m++) {
      const monthTx = yearTx.filter((t) => new Date(t.date).getMonth() === m);
      const mIncome = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const mExpense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

      const btn = document.createElement("button");
      btn.className = "month-item" + (monthTx.length === 0 ? " empty" : "");
      btn.innerHTML = `
        <span class="month-name">${MONTH_NAMES[m]}</span>
        <span class="month-figures">
          <span class="income-amount">${formatCurrency(mIncome)}</span>
          <span class="expense-amount">${formatCurrency(mExpense)}</span>
        </span>
      `;
      btn.addEventListener("click", () => {
        state.bdYear = state.homeYear;
        state.bdMonth = m;
        switchView("breakdown");
      });
      monthList.appendChild(btn);
    }
  }

  document.getElementById("year-prev").addEventListener("click", () => {
    state.homeYear -= 1;
    renderHome();
  });
  document.getElementById("year-next").addEventListener("click", () => {
    if (state.homeYear < now.getFullYear()) {
      state.homeYear += 1;
      renderHome();
    }
  });

  // ---------- breakdown view ----------
  function renderBreakdown() {
    monthLabel.textContent = `${state.bdYear}年 ${MONTH_NAMES[state.bdMonth]}`;

    document.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.filter === state.bdFilter);
    });

    let monthTx = state.transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === state.bdYear && d.getMonth() === state.bdMonth;
    });

    const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    breakdownSummary.innerHTML = `
      <div class="figure"><span class="label">収入</span><span class="value income-amount">${formatCurrency(income)}</span></div>
      <div class="figure"><span class="label">支出</span><span class="value expense-amount">${formatCurrency(expense)}</span></div>
      <div class="figure"><span class="label">収支</span><span class="value ${income - expense >= 0 ? "balance-positive" : "balance-negative"}">${formatCurrency(income - expense)}</span></div>
    `;

    if (state.bdFilter !== "all") {
      monthTx = monthTx.filter((t) => t.type === state.bdFilter);
    }
    monthTx.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

    transactionList.innerHTML = "";
    breakdownEmpty.classList.toggle("hidden", monthTx.length > 0);

    monthTx.forEach((t) => {
      const cat = categoryInfo(t.type, t.category);
      const li = document.createElement("li");
      li.className = "transaction-item";
      const d = new Date(t.date);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      li.innerHTML = `
        <span class="tx-icon">${cat.icon}</span>
        <span class="tx-body">
          <span class="tx-category">${cat.label}</span><br>
          <span class="tx-date">${dateStr}</span>${t.memo ? ` <span class="tx-memo">・${escapeHtml(t.memo)}</span>` : ""}
        </span>
        <span class="tx-amount ${t.type === "income" ? "income-amount" : "expense-amount"}">${t.type === "income" ? "+" : "-"}${formatCurrency(t.amount)}</span>
        <button class="tx-delete" aria-label="取り消し" data-id="${t.id}">✕</button>
      `;
      transactionList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  document.getElementById("month-prev").addEventListener("click", () => {
    state.bdMonth -= 1;
    if (state.bdMonth < 0) { state.bdMonth = 11; state.bdYear -= 1; }
    renderBreakdown();
  });
  document.getElementById("month-next").addEventListener("click", () => {
    state.bdMonth += 1;
    if (state.bdMonth > 11) { state.bdMonth = 0; state.bdYear += 1; }
    renderBreakdown();
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.bdFilter = chip.dataset.filter;
      renderBreakdown();
    });
  });

  transactionList.addEventListener("click", (e) => {
    const btn = e.target.closest(".tx-delete");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) return;
    const label = `${categoryInfo(tx.type, tx.category).label} ${formatCurrency(tx.amount)}`;
    if (confirm(`この記録を取り消しますか？\n${label}`)) {
      state.transactions = state.transactions.filter((t) => t.id !== id);
      saveTransactions();
      renderBreakdown();
    }
  });

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

  // ---------- add modal ----------
  function populateCategories() {
    inputCategory.innerHTML = "";
    CATEGORIES[modalType].forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.label}`;
      inputCategory.appendChild(opt);
    });
  }

  function openModal() {
    modalType = "expense";
    document.querySelectorAll(".type-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.type === modalType)
    );
    populateCategories();
    inputAmount.value = "";
    inputMemo.value = "";
    inputDate.value = new Date().toISOString().slice(0, 10);
    modal.classList.remove("hidden");
    setTimeout(() => inputAmount.focus(), 50);
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  fab.addEventListener("click", openModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      modalType = btn.dataset.type;
      document.querySelectorAll(".type-btn").forEach((b) => b.classList.toggle("active", b === btn));
      populateCategories();
    });
  });

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number(inputAmount.value);
    if (!amount || amount <= 0) return;

    state.transactions.push({
      id: Date.now(),
      type: modalType,
      amount,
      category: inputCategory.value,
      date: inputDate.value,
      memo: inputMemo.value.trim(),
    });
    saveTransactions();
    closeModal();

    if (state.view === "home") renderHome();
    if (state.view === "breakdown") renderBreakdown();
  });

  // ---------- init ----------
  applyTheme(loadTheme());
  switchView("home");
})();
