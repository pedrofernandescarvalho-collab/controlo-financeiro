const STORAGE_KEY = "finance-control-app";
const REVOLUT_INTEREST_RATE = 0.019;

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const defaultState = {
  analysisMonth: "",
  salary: 0,
  revolutShare: 50,
  xtbShare: 50,
  revolutGoal: "",
  categories: ["Casa", "Transporte", "Alimentacao", "Saude", "Lazer"],
  accounts: [
    { id: generateUUID(), name: "Conta principal", type: "Banco", balance: 0 },
    { id: generateUUID(), name: "Revolut", type: "Poupanca", balance: 0 },
    { id: generateUUID(), name: "XTB", type: "Investimento", balance: 0 }
  ],
  expenses: [],
  transfers: [],
  incomes: [],
  receivables: [],
  snapshots: [],
  recurringFixed: []
};

const settingsForm = document.querySelector("#settings-form");
const startForm = document.querySelector("#start-form");
const snapshotForm = document.querySelector("#snapshot-form");
const categoryForm = document.querySelector("#category-form");
const accountForm = document.querySelector("#account-form");
const receivableForm = document.querySelector("#receivable-form");
const expenseForm = document.querySelector("#expense-form");
const recurringForm = document.querySelector("#recurring-form");
const transferForm = document.querySelector("#transfer-form");
const incomeForm = document.querySelector("#income-form");
const template = document.querySelector("#item-template");

const variableContainer = document.querySelector("#expensesList");
const monthlyContainer = document.querySelector("#fixedExpensesList");

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  console.log("[Engine] Carregando estado do localStorage...", raw ? "Dados encontrados" : "Vazio");
  if (!raw) return JSON.parse(JSON.stringify(defaultState));
  try {
    const parsed = JSON.parse(raw);
    const s = {
      ...JSON.parse(JSON.stringify(defaultState)),
      ...parsed,
      categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : defaultState.categories,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : defaultState.accounts,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
      incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
      receivables: Array.isArray(parsed.receivables) ? parsed.receivables : [],
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      recurringFixed: Array.isArray(parsed.recurringFixed) ? parsed.recurringFixed : []
    };
    return s;
  } catch (e) {
    console.error("[Engine] Erro ao carregar dados:", e);
    return JSON.parse(JSON.stringify(defaultState));
  }
}

// ⚡ INICIALIZAÇÃO GLOBAL DO ESTADO
var state = loadState();
window.state = state;

// ⚡ EXPORTAÇÕES GLOBAIS IMEDIATAS
window.formatCurrency = (value) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
window.getToday = () => new Date();
window.getActiveMonthKey = () => {
    if (typeof window !== 'undefined' && window.dashboardMonthKey) return window.dashboardMonthKey;
    if (window.state && window.state.analysisMonth) return window.state.analysisMonth;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
window.saveState = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.state));
    window.dispatchEvent(new CustomEvent('stateUpdated', { detail: window.state }));
};

function saveState() { window.saveState(); }

function getActiveMonthParts() {
  const [year, month] = getActiveMonthKey().split("-").map(Number);
  return { year, month };
}


function getMonthKey() { return getActiveMonthKey(); }

function getItemMonthKey(item) {
  if (item.monthKey) return item.monthKey;
  if (!item.dateLabel && !item.date) return getMonthKey();
  const dateStr = item.dateLabel || item.date;
  const parts = dateStr.split("-");
  if (parts.length < 2) return getMonthKey();
  return `${parts[0]}-${parts[1].padStart(2, "0")}`;
}

function sumFixedMonthlyExpenses() {
  const monthKey = getMonthKey();
  const { month } = getActiveMonthParts();
  return state.recurringFixed
    .filter(rf => {
      if (rf.endDate && rf.endDate < monthKey) return false;
      if (!rf.frequency || rf.frequency === 'monthly') return true;
      const sm = Number(rf.startMonth) || 1;
      if (rf.frequency === 'annual') return month === sm;
      if (rf.frequency === 'semi-annual') return month === sm || month === (sm + 6 > 12 ? sm - 6 : sm + 6);
      return false;
    })
    .reduce((sum, rf) => sum + Number(rf.amount || 0), 0);
}

function getMonthlyProvisionForFixedExpenses() {
  const monthKey = getMonthKey();
  return state.recurringFixed
    .filter(rf => !rf.endDate || rf.endDate >= monthKey)
    .reduce((sum, rf) => {
      const amt = Number(rf.amount || 0);
      if (!rf.frequency || rf.frequency === 'monthly') return sum + amt;
      if (rf.frequency === 'semi-annual') return sum + (amt / 6);
      if (rf.frequency === 'annual') return sum + (amt / 12);
      return sum + amt;
    }, 0);
}

function sumVariableExpenses() {
  const mk = getMonthKey();
  const totalE = state.expenses.filter(e => e.kind !== "fixed" && getItemMonthKey(e) === mk).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalR = state.receivables.filter(r => r.linkedExpenseId && getItemMonthKey(r) === mk).reduce((s, r) => s + Number(r.amount || 0), 0);
  return Math.max(0, totalE - totalR);
}

function sumTransfers() { return state.transfers.filter(t => getItemMonthKey(t) === getMonthKey()).reduce((s, t) => s + Number(t.amount || 0), 0); }
function sumIncomes(excludeReimbursements = false) {
  return state.incomes.filter(i => {
    if (getItemMonthKey(i) !== getMonthKey()) return false;
    if (excludeReimbursements && i.linkedReceivableId) {
      const rec = state.receivables.find(r => r.id === i.linkedReceivableId);
      if (rec && rec.linkedExpenseId) return false;
    }
    return true;
  }).reduce((s, i) => s + Number(i.amount || 0), 0);
}

// Funções de Suporte para Filtros por Data/Período
function sumFixedExpensesUntil(day) {
  const { month } = getActiveMonthParts();
  const mk = getMonthKey();
  return state.recurringFixed
    .filter(rf => {
      if (rf.endDate && rf.endDate < mk) return false;
      const rfDay = Number(rf.day) || 1;
      if (rfDay > day) return false;
      if (!rf.frequency || rf.frequency === 'monthly') return true;
      const sm = Number(rf.startMonth) || 1;
      if (rf.frequency === 'annual') return month === sm;
      if (rf.frequency === 'semi-annual') return month === sm || month === (sm + 6 > 12 ? sm - 6 : sm + 6);
      return false;
    })
    .reduce((s, rf) => s + Number(rf.amount || 0), 0);
}

function sumExpensesUntil(day) {
  const mk = getMonthKey();
  return state.expenses
    .filter(e => getItemMonthKey(e) === mk && e.kind !== 'fixed' && Number(e.day) <= day)
    .reduce((s, e) => s + getNetExpenseAmount(e), 0);
}

function sumExpensesBetween(start, end) {
  const mk = getMonthKey();
  return state.expenses
    .filter(e => getItemMonthKey(e) === mk && e.kind !== 'fixed' && Number(e.day) > start && Number(e.day) <= end)
    .reduce((s, e) => s + getNetExpenseAmount(e), 0);
}

function sumTransfersBetween(start, end) {
  return state.transfers
    .filter(t => getItemMonthKey(t) === getMonthKey() && Number(t.day) > start && Number(t.day) <= end)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
}

function sumIncomesBetween(start, end, excludeReimbursements = false) {
  return state.incomes
    .filter(i => {
      if (getItemMonthKey(i) !== getMonthKey()) return false;
      if (Number(i.day) <= start || Number(i.day) > end) return false;
      if (excludeReimbursements && i.linkedReceivableId) {
        const rec = state.receivables.find(r => r.id === i.linkedReceivableId);
        if (rec && rec.linkedExpenseId) return false;
      }
      return true;
    })
    .reduce((s, i) => s + Number(i.amount || 0), 0);
}

function calculateBudget() {
  const startSnap = getStartingSnapshot();
  const startBal = startSnap ? (Number(startSnap.bankBalance) + Number(startSnap.cashBalance)) : 0;
  const salary = Number(state.salary) || 0;
  const provision = getMonthlyProvisionForFixedExpenses();
  const variable = sumVariableExpenses();
  const transfer = sumTransfers();
  const incomes = sumIncomes(true);
  const disposable = Math.max(salary + incomes - provision, 0);
  const days = getCycleWindow().daysInCycle;
  const leftover = Math.max(salary + incomes - provision - variable - transfer, 0);
  return {
    fixedExpenses: provision,
    fixedExpensesReal: sumFixedMonthlyExpenses(),
    variableExpenses: variable,
    transferExpenses: transfer,
    disposableMonthlyBudget: disposable,
    leftover,
    weeklyBudget: (disposable / days) * 7 || 0,
    dailyBudget: (disposable / days) || 0,
    revolutAllocation: leftover * 0.5,
    xtbAllocation: leftover * 0.5,
    revolutInterest: leftover * 0.5 * REVOLUT_INTEREST_RATE
  };
}

function getCycleWindow() {
  const { year, month } = getActiveMonthParts();
  const start = new Date(year, month - 1, 1);
  const next = new Date(year, month, 1);
  const days = Math.floor((next - start) / (1000 * 60 * 60 * 24));
  return { cycleStart: start, daysInCycle: days };
}

function getStartingSnapshot() {
  const snaps = state.snapshots.filter(s => s.monthKey === getMonthKey()).sort((a,b) => a.day - b.day);
  if (!snaps.length) return null;
  const day1 = snaps.filter(s => s.day === snaps[0].day);
  return {
    bankBalance: day1.reduce((s, x) => s + (Number(x.bankBalance) || 0), 0),
    cashBalance: day1.reduce((s, x) => s + (Number(x.cashBalance) || 0), 0),
    accountName: "Consolidado"
  };
}

function getPreviousMonthLastBalance() {
  const parts = getActiveMonthParts();
  let prevYear = parts.year;
  let prevMonth = parts.month - 1;
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
  const prevKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const prevSnaps = state.snapshots.filter(s => s.monthKey === prevKey);
  if (!prevSnaps.length) return null;
  const lastDay = Math.max(...prevSnaps.map(s => Number(s.day) || 1));
  const lastSnaps = prevSnaps.filter(s => Number(s.day) === lastDay);
  const accountTotals = {};
  let totalCash = 0;
  lastSnaps.forEach(s => {
    accountTotals[s.accountId || 'legacy'] = Number(s.bankBalance) || 0;
    totalCash += Number(s.cashBalance) || 0;
  });
  return { accountTotals, totalCash, day: lastDay, monthKey: prevKey };
}

function getSnapshotsForMonth() {
  const allS = state.snapshots.slice().sort((a,b) => {
    if(a.monthKey === b.monthKey) return (Number(a.day)||0) - (Number(b.day)||0);
    return String(a.monthKey).localeCompare(String(b.monthKey));
  });
  const accBal = {};
  const daily = {};
  allS.forEach(s => {
    accBal[s.accountId || "legacy"] = { bank: Number(s.bankBalance)||0, cash: Number(s.cashBalance)||0 };
    if (s.monthKey === getMonthKey()) {
      let tb = 0, tc = 0;
      for (let k in accBal) { tb += accBal[k].bank; tc += accBal[k].cash; }
      daily[s.day] = { id: s.id, monthKey: s.monthKey, day: s.day, bankBalance: tb, cashBalance: tc, accountName: "Total" };
    }
  });
  return Object.values(daily).sort((a,b) => a.day - b.day);
}

function getGlobalAccountsTotal() {
  let total = 0;
  state.accounts.forEach(acc => { total += (Number(acc.balance) || 0); });
  const allS = state.snapshots.slice().sort((a,b) => {
    if(a.monthKey === b.monthKey) return (Number(a.day)||0) - (Number(b.day)||0);
    return String(a.monthKey).localeCompare(String(b.monthKey));
  });
  let latestCash = 0;
  if (allS.length) {
    const last = allS[allS.length - 1];
    allS.filter(s => s.monthKey === last.monthKey && s.day === last.day).forEach(s => { latestCash += (Number(s.cashBalance) || 0); });
  }
  if (state.accounts.length === 0 && allS.length) {
    const legacy = {};
    allS.forEach(s => { legacy[s.accountId || "legacy"] = (Number(s.bankBalance)||0) + (Number(s.cashBalance)||0); });
    let lt = 0; for (let k in legacy) lt += legacy[k];
    return lt;
  }
  return total + latestCash;
}

function renderNetWorth() {
  const el = document.querySelector("#globalNetWorthDisplay");
  if (!el) return;
  const accs = getGlobalAccountsTotal();
  const recs = state.receivables.filter(r => r.status !== "received").reduce((s, r) => s + Number(r.amount || 0), 0);
  el.textContent = formatCurrency(accs + recs);
}

function renderExpenses() {
  if (!variableContainer) return;
  variableContainer.innerHTML = "";
  const mk = getMonthKey();
  const items = state.expenses.filter(e => getItemMonthKey(e) === mk && e.kind !== "fixed").sort((a,b) => b.day - a.day);
  if (!items.length) { variableContainer.className = "item-list empty-state"; variableContainer.textContent = "Sem despesas."; return; }
  variableContainer.className = "item-list";
  items.forEach(exp => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = exp.name;
    node.querySelector(".item-subtitle").textContent = `${exp.category || "Geral"} | Dia ${exp.day}`;
    node.querySelector(".item-value").textContent = formatCurrency(exp.amount);
    node.querySelector(".ghost-btn").onclick = (e) => { e.stopPropagation(); state.expenses = state.expenses.filter(i => i.id !== exp.id); saveState(); render(); };
    node.onclick = () => { expenseForm.dataset.editingId = exp.id; document.querySelector("#expenseName").value = exp.name; document.querySelector("#expenseAmount").value = exp.amount; document.querySelector("#expenseCategory").value = exp.category || ""; document.querySelector("#expenseDate").value = exp.dateLabel || exp.date || ""; };
    variableContainer.appendChild(node);
  });
}

function renderRecurring() {
  if (!monthlyContainer) return;
  monthlyContainer.innerHTML = "";
  const mk = getMonthKey();
  const { month } = getActiveMonthParts();
  const items = state.recurringFixed.filter(rf => !rf.endDate || rf.endDate >= mk);
  if (!items.length) { monthlyContainer.className = "item-list empty-state"; monthlyContainer.textContent = "Sem obrigações."; return; }
  monthlyContainer.className = "item-list";
  items.forEach(rf => {
    const node = template.content.firstElementChild.cloneNode(true);
    const sm = Number(rf.startMonth) || 1;
    const isNow = (!rf.frequency || rf.frequency === 'monthly') || (rf.frequency === 'annual' && month === sm) || (rf.frequency === 'semi-annual' && (month === sm || month === (sm + 6 > 12 ? sm - 6 : sm + 6)));
    node.querySelector(".item-title").textContent = rf.name;
    node.querySelector(".item-subtitle").textContent = isNow ? `Dia ${rf.day}` : "Provisão";
    node.querySelector(".item-value").textContent = formatCurrency(isNow ? rf.amount : (rf.frequency === 'annual' ? rf.amount/12 : rf.amount/6));
    node.style.cursor = "pointer";
    node.onclick = () => {
      expenseForm.dataset.editingId = rf.id; expenseForm.dataset.editingType = "fixed";
      document.querySelector("#expenseName").value = rf.name;
      document.querySelector("#expenseAmount").value = rf.amount;
      const k = document.querySelector("#expenseKind"); k.value = "fixed"; k.dispatchEvent(new Event("change"));
      const f = document.querySelector("#expenseFrequency"); if(f) f.value = rf.frequency || "monthly";
      if(document.querySelector("#expenseEndDate")) document.querySelector("#expenseEndDate").value = rf.endDate || "";
    };
    node.querySelector(".ghost-btn").style.display = "none";
    monthlyContainer.appendChild(node);
  });
}

function renderIncomes() {
  const c = document.querySelector("#incomesList"); if (!c) return;
  c.innerHTML = ""; const mk = getMonthKey();
  const items = state.incomes.filter(i => getItemMonthKey(i) === mk).sort((a,b) => b.day - a.day);
  if (!items.length) { c.className = "item-list empty-state"; c.textContent = "Sem entradas."; return; }
  c.className = "item-list";
  items.forEach(inc => {
    const n = template.content.firstElementChild.cloneNode(true);
    n.querySelector(".item-title").textContent = inc.name;
    n.querySelector(".item-value").textContent = formatCurrency(inc.amount);
    n.querySelector(".ghost-btn").onclick = () => { state.incomes = state.incomes.filter(i => i.id !== inc.id); saveState(); render(); };
    c.appendChild(n);
  });
}

function renderReceivables() {
  const c = document.querySelector("#receivablesList"); if (!c) return;
  c.innerHTML = ""; const res = state.receivables.filter(r => r.status !== "received").sort((a,b) => (b.dateLabel||"").localeCompare(a.dateLabel||""));
  if (!res.length) { c.className = "item-list empty-state"; c.textContent = "Sem pendentes."; return; }
  c.className = "item-list";
  res.forEach(r => {
    const n = template.content.firstElementChild.cloneNode(true);
    n.querySelector(".item-title").textContent = r.name;
    n.querySelector(".item-value").textContent = formatCurrency(r.amount);
    const b = document.createElement("button"); b.className = "success-btn"; b.textContent = "✅";
    b.onclick = () => { r.status = "received"; state.incomes.push({ id: generateUUID(), name: `Reembolso: ${r.name}`, amount: r.amount, day: getToday().getDate(), monthKey: getMonthKey(), dateLabel: getToday().toISOString().split('T')[0], linkedReceivableId: r.id }); saveState(); render(); };
    n.querySelector(".item-actions").insertBefore(b, n.querySelector(".ghost-btn"));
    n.querySelector(".ghost-btn").onclick = () => { state.receivables = state.receivables.filter(x => x.id !== r.id); saveState(); render(); };
    c.appendChild(n);
  });
}

function renderSummary() {
  const b = calculateBudget();
  const sets = { "#weeklyBudget": b.weeklyBudget, "#dailyBudget": b.dailyBudget, "#leftoverAmount": b.leftover, "#fixedExpenseTotal": b.fixedExpenses, "#variableExpenseTotal": b.variableExpenses };
  for (let k in sets) { const el = document.querySelector(k); if(el) el.textContent = formatCurrency(sets[k]); }
}

function renderCategorySelects() {
  const selects = document.querySelectorAll("#expenseCategory, #categoryList, #filterCategory");
  selects.forEach(select => {
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">(Selecione Categoria)</option>';
    state.categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
  });
}

function render() {
  renderCategorySelects();
  renderNetWorth(); 
  renderSummary(); 
  renderExpenses(); 
  renderRecurring(); 
  renderIncomes(); 
  renderReceivables();
  renderBankReconciliation();
  renderReconciliationHistory();
  const s = document.querySelector("#snapshotAccountsInputs");
  if (s) {
    s.innerHTML = "";
    state.accounts.forEach(acc => {
      s.innerHTML += `<div class="account-input-group"><label>${acc.name}</label><input type="number" step="0.01" class="dyn-bank-input" data-acc-id="${acc.id}" value="${acc.balance}"></div>`;
    });
  }
}

function initDateFields() {
  const d = getToday().toISOString().split('T')[0];
  ['snapshotDate', 'expenseDate', 'incomeDate', 'receivableDate', 'startDate'].forEach(id => { const el = document.getElementById(id); if(el && !el.value) el.value = d; });
}


if (typeof document !== 'undefined') {
  [settingsForm, startForm, snapshotForm, categoryForm, accountForm, receivableForm, expenseForm, incomeForm, recurringForm].forEach(f => {
    if(!f) return;
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (f.id === "expense-form") {
        const id = expenseForm.dataset.editingId; const kind = document.querySelector("#expenseKind").value;
        const name = document.querySelector("#expenseName").value; const amt = Number(document.querySelector("#expenseAmount").value);
        const date = document.querySelector("#expenseDate").value; const day = Number(date.split('-')[2]) || 1;
        if (kind === "fixed") {
          const rf = { id: id || generateUUID(), name, amount: amt, day, frequency: document.querySelector("#expenseFrequency")?.value || "monthly", startMonth: new Date(date).getMonth() + 1, endDate: document.querySelector("#expenseEndDate")?.value || "" };
          if (id) { const idx = state.recurringFixed.findIndex(x => x.id === id); if(idx>=0) state.recurringFixed[idx] = rf; }
          else state.recurringFixed.push(rf);
        } else {
          const exp = { id: id || generateUUID(), name, amount: amt, day, monthKey: getMonthKey(), dateLabel: date, category: document.querySelector("#expenseCategory")?.value || "Geral" };
          if (id) { const idx = state.expenses.findIndex(x => x.id === id); if(idx>=0) state.expenses[idx] = exp; }
          else state.expenses.push(exp);
        }
      } else if (f.id === "snapshot-form") {
        const date = document.querySelector("#snapshotDate").value; const day = Number(date.split('-')[2]) || 1;
        document.querySelectorAll(".dyn-bank-input").forEach(inp => {
          const accId = inp.dataset.accId; const val = Number(inp.value) || 0;
          state.snapshots = state.snapshots.filter(s => !(s.monthKey === getMonthKey() && s.day === day && s.accountId === accId));
          state.snapshots.push({ id: generateUUID(), monthKey: getMonthKey(), day, date, accountId: accId, bankBalance: val, cashBalance: 0 });
          const acc = state.accounts.find(a => a.id === accId); if(acc) acc.balance = val;
        });
      } else if (f.id === "income-form") {
        state.incomes.push({ id: generateUUID(), name: document.querySelector("#incomeName").value, amount: Number(document.querySelector("#incomeAmount").value), day: Number(document.querySelector("#incomeDate").value.split('-')[2]) || 1, monthKey: getMonthKey(), dateLabel: document.querySelector("#incomeDate").value });
      } else if (f.id === "receivable-form") {
        state.receivables.push({ id: generateUUID(), name: document.querySelector("#receivableName").value, amount: Number(document.querySelector("#receivableAmount").value), status: "pending", dateLabel: document.querySelector("#receivableDate").value });
      }
      saveState(); render(); f.reset(); delete f.dataset.editingId; delete f.dataset.editingType; initDateFields();
    });
  });
  
  const ek = document.querySelector("#expenseKind");
  if (ek) ek.addEventListener("change", () => {
    const isF = ek.value === "fixed";
    document.querySelector("#expenseFrequency").style.display = isF ? "block" : "none";
    document.querySelector("#expenseEndDate").style.display = isF ? "block" : "none";
  });

  render();
  initDateFields();
}


// ════════════════════════════════════════════════════════════
// BI & ANALYTICS ENGINE
// ════════════════════════════════════════════════════════════

function calculateSavingsRate() {
  const b = calculateBudget();
  const incTotal = (Number(state.salary) || 0) + sumIncomes();
  const saved = sumTransfers() + b.leftover;
  if (incTotal <= 0) return 0;
  return Math.min(Math.max((saved / incTotal) * 100, 0), 100);
}

function calculateFinancialRunway() {
  const netWorth = getGlobalAccountsTotal();
  const b = calculateBudget();
  const monthlyCost = b.fixedExpenses + b.variableExpenses;
  if (monthlyCost <= 0) {
    const salaryCost = Number(state.salary) || 0;
    if (salaryCost <= 0) return null;
    return { months: netWorth / salaryCost, monthlyCost: salaryCost, netWorth, basedOn: "Salário" };
  }
  return { months: netWorth / monthlyCost, monthlyCost, netWorth, basedOn: "Gasto Real" };
}

function calculateEmergencyFundProgress(targetMonths = 6) {
  const runway = calculateFinancialRunway();
  if (!runway) return { pct: 0, months: 0, target: targetMonths, ok: false };
  const pct = Math.min((runway.months / targetMonths) * 100, 100);
  return { pct, months: runway.months, target: targetMonths, ok: runway.months >= targetMonths };
}

function getLeakageStatus() {
  const snaps = getSnapshotsForMonth();
  if (snaps.length < 2) return null;
  const last = snaps[snaps.length - 1];
  const hist = getReconciliationHistory();
  const currentInterval = hist.find(h => h.currentDay === last.day);
  if (!currentInterval) return null;
  const gap = currentInterval.unexplainedDifference;
  if (Math.abs(gap) <= 0.01) return { type: 'success', message: 'Contas batem certo.' };
  if (gap > 0) return { type: 'warning', message: `Fuga de Capital: ${formatCurrency(gap)} por registar.` };
  return { type: 'info', message: `Excesso Registado: ${formatCurrency(Math.abs(gap))} a mais.` };
}

function getNetExpenseAmount(expense) {
  if (!expense) return 0;
  const gross = Number(expense.amount) || 0;
  const splits = state.receivables.filter(r => r.linkedExpenseId === expense.id);
  const splitTotal = splits.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return Math.max(0, gross - splitTotal);
}

function getDailySpendingData() {
  const { year, month } = getActiveMonthParts();
  const days = new Date(year, month, 0).getDate();
  const mk = getMonthKey();
  const result = new Array(days).fill(0);
  state.expenses.forEach(e => {
    if (getItemMonthKey(e) !== mk || e.kind === 'fixed') return;
    const d = Math.min(Math.max(Number(e.day) || 1, 1), days) - 1;
    result[d] += getNetExpenseAmount(e);
  });
  return result;
}

function getCalendarSlices() {
  const { year, month } = getActiveMonthParts();
  const days = new Date(year, month, 0).getDate();
  const slices = [];
  let start = 1;
  while (start <= days) {
    let end = start + 6;
    if (end > days) end = days;
    slices.push({ start, end });
    start = end + 1;
  }
  return slices;
}

function getFlexibleSpentInPeriod(start, end) {
  return sumExpensesBetween(start - 1, end) + sumTransfersBetween(start - 1, end);
}

function calculateObligationsStatus() {
  const total = sumFixedMonthlyExpenses();
  const paid = sumFixedExpensesUntil(31);
  return { 
    totalProvision: total, 
    paidAmount: paid, 
    pendingAmount: Math.max(0, total - paid), 
    progressPercent: total > 0 ? (paid / total) * 100 : 0 
  };
}

function getRealSpentEfficiency() {
  return sumVariableExpenses() + sumTransfers();
}

function getReconciliationHistory() {
  const snaps = getSnapshotsForMonth();
  const history = [];
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i-1];
    const curr = snaps[i];
    const prevTotal = prev.bankBalance + prev.cashBalance;
    const currTotal = curr.bankBalance + curr.cashBalance;
    const diff = prevTotal - currTotal;
    const exp = sumExpensesBetween(prev.day, curr.day);
    const trans = sumTransfersBetween(prev.day, curr.day);
    const inc = sumIncomesBetween(prev.day, curr.day, false);
    const reconciled = exp + trans - inc;
    history.push({
      previousDay: prev.day,
      currentDay: curr.day,
      previousBankBalance: prev.bankBalance,
      currentBankBalance: curr.bankBalance,
      previousCashBalance: prev.cashBalance,
      currentCashBalance: curr.cashBalance,
      totalDifference: diff,
      expenseTotal: exp,
      transferTotal: trans,
      reconciledTotal: reconciled,
      unexplainedDifference: diff - reconciled,
      currentTotalBalance: currTotal
    });
  }
  return history;
}

function renderBankReconciliation() {
  const hist = getReconciliationHistory();
  const start = getStartingSnapshot();
  const prev = getPreviousMonthLastBalance();
  const latest = hist.length ? hist[hist.length - 1] : null;
  
  const map = {
    "#bankStartBalance": latest ? latest.previousBankBalance : (start ? start.bankBalance : (prev ? Object.values(prev.accountTotals).reduce((a,b)=>a+b,0) : 0)),
    "#bankCurrentBalance": latest ? latest.currentBankBalance : (start ? start.bankBalance : 0),
    "#cashStartBalance": latest ? latest.previousCashBalance : (start ? start.cashBalance : (prev ? prev.totalCash : 0)),
    "#cashCurrentBalance": latest ? latest.currentCashBalance : (start ? start.cashBalance : 0),
    "#bankDifference": latest ? latest.totalDifference : 0,
    "#bankUnexplained": latest ? latest.unexplainedDifference : 0,
    "#bankExpenseTotal": latest ? latest.expenseTotal : 0,
    "#bankTransferTotal": latest ? latest.transferTotal : 0,
    "#bankReconciledTotal": latest ? latest.reconciledTotal : 0,
    "#currentTotalBalance": latest ? latest.currentTotalBalance : (start ? (start.bankBalance + start.cashBalance) : 0),
    "#netCurrentBalance": latest ? (latest.currentTotalBalance - calculateObligationsStatus().pendingAmount) : 0
  };
  
  for (let id in map) {
    const el = document.querySelector(id);
    if (el) el.textContent = formatCurrency(map[id]);
  }
}

function renderReconciliationHistory() {
  const container = document.querySelector("#reconciliationHistoryList");
  if (!container) return;
  const hist = getReconciliationHistory().slice().reverse();
  if (!hist.length) {
    container.className = "item-list empty-state";
    container.textContent = "Aguardando segunda entrada de saldos...";
    return;
  }
  container.className = "item-list";
  container.innerHTML = "";
  hist.forEach(h => {
    const card = document.createElement("div");
    card.className = "item-card";
    const status = Math.abs(h.unexplainedDifference) < 0.01 ? "✅ OK" : (h.unexplainedDifference > 0 ? "⚠️ Fuga" : "ℹ️ Excesso");
    card.innerHTML = `
      <div>
        <strong class="item-title">Dia ${h.previousDay} → Dia ${h.currentDay}</strong>
        <p class="item-subtitle">Variação Real: ${formatCurrency(h.totalDifference)} | Registado: ${formatCurrency(h.reconciledTotal)}</p>
      </div>
      <div class="item-actions">
        <span class="item-value" style="color: ${h.unexplainedDifference > 0 ? '#ef4444' : (h.unexplainedDifference < 0 ? '#f59e0b' : 'var(--success)')}">${formatCurrency(h.unexplainedDifference)} ${status}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// Global Exports
window.state = state;
// Link local saveState
window.render = render;
window.getMonthKey = getMonthKey;
window.getGlobalAccountsTotal = getGlobalAccountsTotal;
window.calculateBudget = calculateBudget;
window.calculateSavingsRate = calculateSavingsRate;
window.calculateFinancialRunway = calculateFinancialRunway;
window.calculateEmergencyFundProgress = calculateEmergencyFundProgress;
window.getLeakageStatus = getLeakageStatus;
window.getNetExpenseAmount = getNetExpenseAmount;
window.getDailySpendingData = getDailySpendingData;
window.getCalendarSlices = getCalendarSlices;
window.getFlexibleSpentInPeriod = getFlexibleSpentInPeriod;
window.calculateObligationsStatus = calculateObligationsStatus;
window.getRealSpentEfficiency = getRealSpentEfficiency;
window.getReconciliationHistory = getReconciliationHistory;
window.getItemMonthKey = getItemMonthKey;
window.sumIncomes = sumIncomes;
window.sumVariableExpenses = sumVariableExpenses;
window.sumFixedMonthlyExpenses = sumFixedMonthlyExpenses;
window.getActiveMonthParts = getActiveMonthParts;
