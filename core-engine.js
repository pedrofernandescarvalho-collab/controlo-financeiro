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

function hasElement(selector) {
  return Boolean(document.querySelector(selector));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return JSON.parse(JSON.stringify(defaultState));
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...JSON.parse(JSON.stringify(defaultState)),
      ...parsed,
      categories: Array.isArray(parsed.categories) && parsed.categories.length
        ? parsed.categories
        : JSON.parse(JSON.stringify(defaultState.categories)),
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : JSON.parse(JSON.stringify(defaultState.accounts)),
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
      incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
      receivables: Array.isArray(parsed.receivables) ? parsed.receivables : [],
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      recurringFixed: Array.isArray(parsed.recurringFixed) ? parsed.recurringFixed : []
    };
  } catch (e) {
    console.error("Erro ao carregar dados:", e);
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getToday() {
  return new Date();
}

function isActiveMonthCurrent() {
  const today = getToday();
  const { year, month } = getActiveMonthParts();
  return year === today.getFullYear() && month === today.getMonth() + 1;
}

function getActiveMonthKey() {
  if (typeof window !== 'undefined' && window.dashboardMonthKey) {
    return window.dashboardMonthKey;
  }
  if (state.analysisMonth) {
    return state.analysisMonth;
  }

  const today = getToday();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  return `${today.getFullYear()}-${month}`;
}

function getActiveMonthParts() {
  const [yearText, monthText] = getActiveMonthKey().split("-");
  return {
    year: Number(yearText),
    month: Number(monthText)
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value) || 0);
}

function sumExpensesUntil(day) {
  const monthKey = getMonthKey();
  const total = state.expenses
    .filter((expense) =>
      getItemMonthKey(expense) === monthKey &&
      expense.kind !== "fixed" &&
      Number(expense.day) <= day
    )
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);

  const splits = state.receivables
    .filter(r => 
      r.linkedExpenseId && 
      getItemMonthKey(r) === monthKey &&
      Number(r.day || 1) <= day
    )
    .reduce((total, split) => total + Number(split.amount || 0), 0);

  return Math.max(0, total - splits);
}

function sumFixedMonthlyExpenses() {
  const monthKey = getActiveMonthKey();
  const { month } = getActiveMonthParts();
  
  return state.recurringFixed
    .filter(rf => {
      if (rf.endDate && rf.endDate < monthKey) return false;
      if (!rf.frequency || rf.frequency === 'monthly') return true;
      const startMonth = Number(rf.startMonth) || 1;
      if (rf.frequency === 'annual') return month === startMonth;
      if (rf.frequency === 'semi-annual') return month === startMonth || month === (startMonth + 6 > 12 ? startMonth - 6 : startMonth + 6);
      return false;
    })
    .reduce((total, rf) => total + Number(rf.amount || 0), 0);
}

function getMonthlyProvisionForFixedExpenses() {
  const monthKey = getActiveMonthKey();
  return state.recurringFixed
    .filter(rf => {
      if (rf.endDate && rf.endDate < monthKey) return false;
      return true;
    })
    .reduce((total, rf) => {
      const amount = Number(rf.amount || 0);
      if (!rf.frequency || rf.frequency === 'monthly') return total + amount;
      if (rf.frequency === 'semi-annual') return total + (amount / 6);
      if (rf.frequency === 'annual') return total + (amount / 12);
      return total + amount;
    }, 0);
}

function sumVariableExpenses() {
  const monthKey = getMonthKey();
  const totalVariable = state.expenses
    .filter(e => e.kind !== "fixed" && getItemMonthKey(e) === monthKey)
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);

  const totalSplits = state.receivables
    .filter(r => r.linkedExpenseId && getItemMonthKey(r) === monthKey)
    .reduce((total, split) => total + Number(split.amount || 0), 0);

  return Math.max(0, totalVariable - totalSplits);
}

function sumTransfers() {
  return state.transfers
    .filter((transfer) => getItemMonthKey(transfer) === getMonthKey())
    .reduce((total, transfer) => total + Number(transfer.amount || 0), 0);
}

function sumIncomes(excludeReimbursements = false) {
  return state.incomes
    .filter((income) => {
      if (getItemMonthKey(income) !== getMonthKey()) return false;
      if (excludeReimbursements && income.linkedReceivableId) {
        const rec = state.receivables.find(r => r.id === income.linkedReceivableId);
        if (rec && rec.linkedExpenseId) return false;
      }
      return true;
    })
    .reduce((total, income) => total + Number(income.amount || 0), 0);
}

function calculateBudget() {
  const startSnapshot = getStartingSnapshot();
  const startBalance = startSnapshot ? (Number(startSnapshot.bankBalance) + Number(startSnapshot.cashBalance)) : 0;
  const salary = Number(state.salary) || startBalance;
  const monthlyProvision = getMonthlyProvisionForFixedExpenses();
  const fixedExpensesReal = sumFixedMonthlyExpenses();
  const variableExpenses = sumVariableExpenses();
  const transferExpenses = sumTransfers();
  const extraIncomes = sumIncomes(true);
  const disposableMonthlyBudget = Math.max(salary + extraIncomes - monthlyProvision, 0);
  const { daysInCycle } = getCycleWindow();
  const dailyBudget = disposableMonthlyBudget / Math.max(daysInCycle, 1);
  const weeklyBudget = dailyBudget * 7;
  const shareTotal = (Number(state.revolutShare) || 0) + (Number(state.xtbShare) || 0);
  const normalizedRevolutShare = shareTotal > 0 ? (Number(state.revolutShare) || 0) / shareTotal : 0.5;
  const leftover = Math.max(salary + extraIncomes - monthlyProvision - variableExpenses - transferExpenses, 0);
  const revolutAllocation = leftover * normalizedRevolutShare;
  const xtbAllocation = leftover - revolutAllocation;
  const revolutInterest = revolutAllocation * REVOLUT_INTEREST_RATE;

  return {
    fixedExpenses: monthlyProvision,
    fixedExpensesReal,
    variableExpenses,
    transferExpenses,
    disposableMonthlyBudget,
    leftover,
    weeklyBudget,
    dailyBudget,
    revolutAllocation,
    xtbAllocation,
    revolutInterest,
    usingStartBalanceAsBudget: !state.salary && startBalance > 0
  };
}

function getCycleWindow() {
  const { year, month } = getActiveMonthParts();
  const cycleStart = new Date(year, month - 1, 1);
  const nextCycleStart = new Date(year, month, 1);
  const cycleEnd = new Date(nextCycleStart);
  cycleEnd.setDate(0);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysInCycle = Math.floor((nextCycleStart - cycleStart) / millisecondsPerDay);

  return { cycleStart, cycleEnd, nextCycleStart, daysInCycle };
}

function normalizeDay(day) {
  return Math.min(Math.max(Number(day) || 1, 1), getCycleWindow().daysInCycle);
}

function sortSnapshots(items) {
  return items.slice().sort((a, b) => a.day - b.day);
}

function getMonthSnapshotsRaw() {
  return sortSnapshots(state.snapshots).filter((snapshot) => snapshot.monthKey === getMonthKey());
}

function getSnapshotsForMonth() {
  const allChronological = state.snapshots.slice().sort((a,b) => {
    if(a.monthKey === b.monthKey) return (Number(a.day)||0) - (Number(b.day)||0);
    return String(a.monthKey || "").localeCompare(String(b.monthKey || ""));
  });
  
  const accountBalances = {};
  const globalSnapshotDays = {};
  let hasMigrated = false;
  
  allChronological.forEach(s => {
      const id = s.accountId || "legacy";
      if (id !== "legacy") hasMigrated = true;
      if (hasMigrated && accountBalances["legacy"]) {
          delete accountBalances["legacy"];
      }
      accountBalances[id] = { bank: Number(s.bankBalance)||0, cash: Number(s.cashBalance)||0 };
      
      if (s.monthKey === getMonthKey()) {
          let tb = 0; let tc = 0;
          for (let i in accountBalances) {
              tb += accountBalances[i].bank;
              tc += accountBalances[i].cash;
          }
          globalSnapshotDays[s.day] = {
              id: s.id,
              monthKey: s.monthKey,
              day: s.day,
              date: s.date || `---`,
              bankBalance: tb,
              cashBalance: tc,
              accountName: "Registo Multi-Conta Global"
          };
      }
  });
  
  return Object.values(globalSnapshotDays).sort((a,b) => a.day - b.day);
}

function getMonthKey() {
  return getActiveMonthKey();
}

function getDefaultMonthDate(day = 1) {
  const { year, month } = getActiveMonthParts();
  const dayValue = `${day}`.padStart(2, "0");
  return `${year}-${String(month).padStart(2, "0")}-${dayValue}`;
}

function parseDateInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function getMonthKeyFromDateLabel(value) {
  const parsed = parseDateInput(value);
  if (!parsed) return "";
  return `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
}

function getItemMonthKey(item) {
  if (item.monthKey) return item.monthKey;
  return getMonthKeyFromDateLabel(item.dateLabel || item.date || "");
}

function isCurrentMonthDate(value) {
  const parsed = parseDateInput(value);
  if (!parsed) return false;
  const { year, month } = getActiveMonthParts();
  return parsed.year === year && parsed.month === month;
}

function getDayFromDateInput(value) {
  const parsed = parseDateInput(value);
  return parsed ? normalizeDay(parsed.day) : null;
}

function sumFixedExpensesUntil(day) {
  const monthKey = getActiveMonthKey();
  const { month } = getActiveMonthParts();
  return state.recurringFixed
    .filter((rf) => {
      if (rf.endDate && rf.endDate < monthKey) return false;
      const rfDay = Number(rf.day) || 1;
      if (rfDay > day) return false;
      if (!rf.frequency || rf.frequency === 'monthly') return true;
      const startMonth = Number(rf.startMonth) || 1;
      if (rf.frequency === 'annual') return month === startMonth;
      if (rf.frequency === 'semi-annual') return month === startMonth || month === (startMonth + 6 > 12 ? startMonth - 6 : startMonth + 6);
      return false;
    })
    .reduce((total, rf) => total + Number(rf.amount || 0), 0);
}

function sumExpensesBetween(startDay, endDay) {
  const monthKey = getMonthKey();
  const total = state.expenses
    .filter((expense) =>
      getItemMonthKey(expense) === monthKey &&
      Number(expense.day) > startDay &&
      Number(expense.day) <= endDay
    )
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);

  const splits = state.receivables
    .filter(r => 
      r.linkedExpenseId && 
      getItemMonthKey(r) === monthKey &&
      Number(r.day || 1) > startDay &&
      Number(r.day || 1) <= endDay
    )
    .reduce((total, split) => total + Number(split.amount || 0), 0);

  return Math.max(0, total - splits);
}

function sumTransfersBetween(startDay, endDay) {
  return state.transfers
    .filter((transfer) =>
      getItemMonthKey(transfer) === getMonthKey() &&
      Number(transfer.day) > startDay &&
      Number(transfer.day) <= endDay
    )
    .reduce((total, transfer) => total + Number(transfer.amount || 0), 0);
}

function sumIncomesBetween(startDay, endDay, excludeReimbursements = false) {
  return state.incomes
    .filter((income) => {
       if (getItemMonthKey(income) !== getMonthKey()) return false;
       if (Number(income.day) <= startDay || Number(income.day) > endDay) return false;
       if (excludeReimbursements && income.linkedReceivableId) {
          const rec = state.receivables.find(r => r.id === income.linkedReceivableId);
          if (rec && rec.linkedExpenseId) return false;
       }
       return true;
    })
    .reduce((total, income) => total + Number(income.amount || 0), 0);
}

function sumTransfersUntil(day) {
  return state.transfers
    .filter((transfer) => getItemMonthKey(transfer) === getMonthKey() && Number(transfer.day) <= day)
    .reduce((total, transfer) => total + Number(transfer.amount || 0), 0);
}

function sumIncomesUntil(day, excludeReimbursements = false) {
  return state.incomes
    .filter((income) => {
      if (getItemMonthKey(income) !== getMonthKey()) return false;
      if (Number(income.day) > day) return false;
      if (excludeReimbursements && income.linkedReceivableId) {
         const rec = state.receivables.find(r => r.id === income.linkedReceivableId);
         if (rec && rec.linkedExpenseId) return false;
      }
      return true;
    })
    .reduce((total, income) => total + Number(income.amount || 0), 0);
}

function getStartingSnapshot() {
  const monthSnaps = getMonthSnapshotsRaw();
  if (!monthSnaps.length) return null;
  const firstDay = monthSnaps[0].day;
  const firstDaySnaps = monthSnaps.filter(s => s.day === firstDay);
  if (firstDaySnaps.length === 1) return firstDaySnaps[0];
  const totalBank = firstDaySnaps.reduce((sum, s) => sum + (Number(s.bankBalance) || 0), 0);
  const totalCash = firstDaySnaps.reduce((sum, s) => sum + (Number(s.cashBalance) || 0), 0);
  return {
    id: firstDaySnaps[0].id,
    monthKey: firstDaySnaps[0].monthKey,
    day: firstDay,
    bankBalance: totalBank,
    cashBalance: totalCash,
    date: firstDaySnaps[0].date,
    accountName: 'Consolidado Multi-Conta'
  };
}

function getEditingSnapshotId() { return snapshotForm.dataset.editingId || ""; }
function getEditingExpenseId() { return expenseForm.dataset.editingId || ""; }
function getEditingIncomeId() { return incomeForm?.dataset.editingId || ""; }
function getEditingReceivableId() { return receivableForm?.dataset.editingId || ""; }

function clearSnapshotEditing() {
  delete snapshotForm.dataset.editingId;
  snapshotForm.reset();
  syncAccountOptions();
  document.querySelector("#snapshotDate").value = getDefaultMonthDate(Math.min(getToday().getDate(), getCycleWindow().daysInCycle));
  document.querySelector("#snapshotBankBalance").value = "";
  document.querySelector("#snapshotCashBalance").value = "";
}

function clearExpenseEditing() {
  delete expenseForm.dataset.editingId;
  expenseForm.reset();
  document.querySelector("#expenseDate").value = getDefaultMonthDate(Math.min(getToday().getDate(), getCycleWindow().daysInCycle));
  syncCategoryOptions();
}

function clearIncomeEditing() {
  if (!incomeForm) return;
  delete incomeForm.dataset.editingId;
  incomeForm.reset();
  if (document.querySelector("#incomeDate")) {
    document.querySelector("#incomeDate").value = getDefaultMonthDate(Math.min(getToday().getDate(), getCycleWindow().daysInCycle));
  }
}

function clearReceivableEditing() {
  if (!receivableForm) return;
  delete receivableForm.dataset.editingId;
  receivableForm.reset();
  if (document.querySelector("#receivableDate")) {
    document.querySelector("#receivableDate").value = getDefaultMonthDate(Math.min(getToday().getDate(), getCycleWindow().daysInCycle));
  }
  if (document.querySelector("#receivableStatus")) {
    document.querySelector("#receivableStatus").value = "pending";
  }
}

function upsertSnapshot(snapshot) {
  const existingIndexById = snapshot.id ? state.snapshots.findIndex((item) => item.id === snapshot.id) : -1;
  if (existingIndexById >= 0) {
    state.snapshots[existingIndexById] = { ...state.snapshots[existingIndexById], ...snapshot };
    return;
  }
  const existingIndex = state.snapshots.findIndex(
    (item) => item.monthKey === snapshot.monthKey && item.day === snapshot.day && (item.accountId || "") === (snapshot.accountId || "")
  );
  if (existingIndex >= 0) {
    state.snapshots[existingIndex] = { ...state.snapshots[existingIndex], ...snapshot };
    return;
  }
  state.snapshots.push(snapshot);
}

function updateAccountBalance(accountId, balance) {
  const account = state.accounts.find((a) => a.id === accountId);
  if (account) {
    account.balance = Number(balance) || 0;
  }
}

function syncAccountOptions() {
  const selectors = ["#startAccountId", "#snapshotAccountId", "#transferAccountId"];
  const defaultAccountId = getStartingSnapshot()?.accountId || state.accounts[0]?.id || "";
  selectors.forEach((selector) => {
    const select = document.querySelector(selector);
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = "";
    state.accounts.forEach((account) => {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = `${account.name} | ${account.type}`;
      select.appendChild(option);
    });
    const targetValue = state.accounts.some((account) => account.id === currentValue) ? currentValue : defaultAccountId;
    if (targetValue) select.value = targetValue;
  });
}

function getCycleAnalysis(targetDay = null) {
  const { cycleStart, cycleEnd, daysInCycle } = getCycleWindow();
  const snapshots = getSnapshotsForMonth().sort((a, b) => a.day - b.day);
  const startSnapshot = getStartingSnapshot();
  const today = getToday();
  const currentDay = isActiveMonthCurrent() ? today.getDate() : 31;
  const elapsedDays = Math.min(targetDay || currentDay, daysInCycle);
  const snapshotsUntilTarget = snapshots.filter(s => s.day <= elapsedDays);
  const latestSnapshot = snapshotsUntilTarget.length ? snapshotsUntilTarget[snapshotsUntilTarget.length - 1] : null;
  const budget = calculateBudget();
  const allowedSpent = (budget.disposableMonthlyBudget / Math.max(daysInCycle, 1)) * elapsedDays;
  const snapshotDay = latestSnapshot ? Math.min(latestSnapshot.day, elapsedDays) : 1;
  const expensesUntilTarget = sumExpensesUntil(elapsedDays);
  const transfersUntilTarget = sumTransfersUntil(elapsedDays);
  const fixedExpensesPaidUntilSnapshot = sumFixedExpensesUntil(snapshotDay);
  const startTotalBalance = startSnapshot ? Number(startSnapshot.bankBalance) + Number(startSnapshot.cashBalance) : 0;
  const currentTotalBalance = latestSnapshot ? Number(latestSnapshot.bankBalance) + Number(latestSnapshot.cashBalance) : startTotalBalance;
  const hasProgressSnapshot = Boolean(latestSnapshot && startSnapshot && latestSnapshot.day > startSnapshot.day);
  const incomesUntilSnapshot = sumIncomesUntil(snapshotDay, true);
  const grossOutflow = hasProgressSnapshot ? (startTotalBalance - currentTotalBalance) + incomesUntilSnapshot : 0;
  const realFlexibleSpentAtSnapshot = hasProgressSnapshot ? Math.max(grossOutflow - fixedExpensesPaidUntilSnapshot, 0) : 0;
  const actualSpent = hasProgressSnapshot ? realFlexibleSpentAtSnapshot : expensesUntilTarget + transfersUntilTarget;
  const recordedFlexibleSpentAtSnapshot = sumExpensesUntil(snapshotDay) + sumTransfersUntil(snapshotDay);
  const surplus = Math.max(allowedSpent - actualSpent, 0);
  const debt = Math.max(actualSpent - allowedSpent, 0);
  const shareTotal = (Number(state.revolutShare) || 0) + (Number(state.xtbShare) || 0);
  const normalizedRevolutShare = shareTotal > 0 ? (Number(state.revolutShare) || 0) / shareTotal : 0.5;
  const splitNowRevolut = surplus * normalizedRevolutShare;
  const splitNowXtb = surplus - splitNowRevolut;
  const movementGap = hasProgressSnapshot ? realFlexibleSpentAtSnapshot - recordedFlexibleSpentAtSnapshot : 0;

  return {
    today: new Date(cycleStart.getFullYear(), cycleStart.getMonth(), elapsedDays),
    latestDay: elapsedDays,
    actualSpent,
    expensesUntilToday: expensesUntilTarget,
    transfersUntilToday: transfersUntilTarget,
    snapshotDay,
    recordedFlexibleSpentAtSnapshot,
    realFlexibleSpentAtSnapshot,
    hasProgressSnapshot,
    movementGap,
    cycleStart,
    cycleEnd,
    expectedSpentToday: allowedSpent,
    expectedSpentWeek: debt,
    idealRemaining: surplus,
    availableToSplit: debt,
    reportNextWeek: debt,
    splitNowRevolut,
    splitNowXtb,
    latestSnapshot,
    isSunday: snapshotsUntilTarget.some(s => s.day === elapsedDays)
  };
}

function getSundayHistory() {
  const { year, month } = getActiveMonthParts();
  const today = getToday();
  const currentDay = isActiveMonthCurrent() ? today.getDate() : 31;
  const sundays = [];
  for (let d = 1; d <= currentDay; d++) {
    const date = new Date(year, month - 1, d);
    const isSunday = date.getDay() === 0;
    const isLastDay = new Date(year, month, 0).getDate() === d;
    if (isSunday || isLastDay) {
      sundays.push({ day: d, label: isSunday ? `Domingo ${d}` : `Fecho do Mês (${d})`, analysis: getCycleAnalysis(d) });
    }
  }
  return sundays.reverse();
}

function renderSundayHistory() {
  const container = document.querySelector("#sundayHistoryList");
  if (!container) return;
  container.innerHTML = "";
  const history = getSundayHistory();
  if (history.length === 0) {
    container.innerHTML = `<p class="goal-label">Ainda não passaste pelo primeiro domingo do ciclo.</p>`;
    return;
  }
  history.forEach(item => {
    const node = template.content.firstElementChild.cloneNode(true);
    const analysis = item.analysis;
    const isPositive = analysis.idealRemaining > 0;
    node.querySelector(".item-title").textContent = item.label;
    node.querySelector(".item-subtitle").innerHTML = `Alvo: ${formatCurrency(analysis.expectedSpentToday)} | Gasto Real: ${formatCurrency(analysis.actualSpent)} <br><small>${analysis.hasProgressSnapshot ? "Baseado em Saldo Real" : "Baseado em Despesas Escritas"}</small>`;
    const valueEl = node.querySelector(".item-value");
    valueEl.textContent = isPositive ? `+ ${formatCurrency(analysis.idealRemaining)}` : `- ${formatCurrency(analysis.availableToSplit)}`;
    valueEl.style.color = isPositive ? "var(--success)" : "var(--error)";
    node.querySelector(".ghost-btn").remove();
    container.appendChild(node);
  });
}

function syncForms() {
  if (hasElement("#analysisMonthInput")) document.querySelector("#analysisMonthInput").value = getActiveMonthKey();
  if (hasElement("#salary")) document.querySelector("#salary").value = state.salary || 0;
  if (hasElement("#revolutShare")) document.querySelector("#revolutShare").value = state.revolutShare || 0;
  if (hasElement("#xtbShare")) document.querySelector("#xtbShare").value = state.xtbShare || 0;
  if (hasElement("#revolutGoal")) document.querySelector("#revolutGoal").value = state.revolutGoal || "";
  const snapDateInput = document.querySelector("#snapshotDate");
  if (snapDateInput && !snapDateInput.value) snapDateInput.value = getDefaultMonthDate();
  const expenseDateInput = document.querySelector("#expenseDate");
  if (expenseDateInput && !expenseDateInput.value) expenseDateInput.value = getDefaultMonthDate();
  const transferDateInput = document.querySelector("#transferDate");
  if (transferDateInput && !transferDateInput.value) transferDateInput.value = getDefaultMonthDate();
  const incomeDateInput = document.querySelector("#incomeDate");
  if (incomeDateInput && !incomeDateInput.value) incomeDateInput.value = getDefaultMonthDate();
  const startDateInput = document.querySelector("#startDate");
  if (startDateInput && !startDateInput.value) startDateInput.value = getDefaultMonthDate(1);
  const receivableDateInput = document.querySelector("#receivableDate");
  if (receivableDateInput && !receivableDateInput.value) receivableDateInput.value = getDefaultMonthDate();

  const startSnapshot = getStartingSnapshot();
  if (hasElement("#startBankBalance") && hasElement("#startCashBalance")) {
    if (startSnapshot) {
      document.querySelector("#startBankBalance").value = startSnapshot.bankBalance;
      document.querySelector("#startCashBalance").value = startSnapshot.cashBalance;
    } else {
      document.querySelector("#startBankBalance").value = "";
      document.querySelector("#startCashBalance").value = "";
    }
  }

  const defaultDay = Math.min(getToday().getDate(), getCycleWindow().daysInCycle);
  if (snapDateInput && !isCurrentMonthDate(snapDateInput.value)) snapDateInput.value = getDefaultMonthDate(defaultDay);
  if (expenseDateInput && !isCurrentMonthDate(expenseDateInput.value)) expenseDateInput.value = getDefaultMonthDate(defaultDay);
  if (transferDateInput && !isCurrentMonthDate(transferDateInput.value)) transferDateInput.value = getDefaultMonthDate(defaultDay);
  if (incomeDateInput && !isCurrentMonthDate(incomeDateInput.value)) incomeDateInput.value = getDefaultMonthDate(defaultDay);
  if (receivableDateInput && !isCurrentMonthDate(receivableDateInput.value)) receivableDateInput.value = getDefaultMonthDate(defaultDay);

  syncAccountOptions();
  if (hasElement("#expenseCategory")) syncCategoryOptions();
  renderSnapshotFormInputs();
}

function renderSnapshotFormInputs() {
  const container = document.querySelector("#snapshotAccountsInputs");
  if (!container) return;
  container.innerHTML = "";
  if (!state.accounts || state.accounts.length === 0) {
    container.innerHTML = `<p class="goal-label">Ainda nao criaste contas para registar.</p>`;
    return;
  }
  let html = '';
  const allChronological = state.snapshots.slice().sort((a,b) => {
    if(a.monthKey === b.monthKey) return (Number(a.day)||0) - (Number(b.day)||0);
    return String(a.monthKey || "").localeCompare(String(b.monthKey || ""));
  });
  let latestCashTotal = 0;
  if (allChronological.length > 0) {
      const lastSnap = allChronological[allChronological.length - 1];
      const sameDaySnaps = allChronological.filter(s => s.monthKey === lastSnap.monthKey && s.day === lastSnap.day);
      sameDaySnaps.forEach(s => { latestCashTotal += (Number(s.cashBalance) || 0); });
  }
  state.accounts.forEach(acc => {
    html += `<div style="background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.05); color: var(--text-dark);"><strong style="display:block; margin-bottom:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">${acc.name} (${acc.type})</strong><div style="display:flex; flex-direction:column; gap:4px;"><label style="font-size:12px; margin:0;">Saldo Bancario Livre</label><input type="number" step="0.01" class="dyn-bank-input" data-acc-id="${acc.id}" value="${Number(acc.balance)||0}" required></div></div>`;
  });
  html += `<div style="background: rgba(13, 148, 136, 0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(13, 148, 136, 0.3); color: var(--text-dark);"><strong style="display:block; margin-bottom:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">Dinheiro (Em Carteira)</strong><div style="display:flex; flex-direction:column; gap:4px;"><label style="font-size:12px; margin:0;">Dinheiro Fisico Global</label><input type="number" step="0.01" id="dyn-global-cash-input" value="${latestCashTotal}" required></div></div>`;
  container.innerHTML = html;
}

function syncCategoryOptions() {
  const select = document.querySelector("#expenseCategory");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = "";
  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
  if (state.categories.includes(currentValue)) select.value = currentValue;
}

function renderSummary() {
  if (!hasElement("#weeklyBudget")) return;
  const budget = calculateBudget();
  document.querySelector("#weeklyBudget").textContent = formatCurrency(budget.weeklyBudget);
  document.querySelector("#dailyBudget").textContent = formatCurrency(budget.dailyBudget);
  document.querySelector("#leftoverAmount").textContent = formatCurrency(budget.leftover);
  document.querySelector("#revolutAllocation").textContent = formatCurrency(budget.revolutAllocation);
  document.querySelector("#xtbAllocation").textContent = formatCurrency(budget.xtbAllocation);
  document.querySelector("#revolutInterest").textContent = formatCurrency(budget.revolutInterest);
  document.querySelector("#fixedExpenseTotal").textContent = formatCurrency(budget.fixedExpenses);
  document.querySelector("#variableExpenseTotal").textContent = formatCurrency(budget.variableExpenses);
}

function showToast(message) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 3000);
}

function setStatus(id, message) {
  const node = document.querySelector(id);
  if (node) node.textContent = message;
  showToast(message);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
function formatMonth(date) {
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(date);
}

function renderAnalysis() {
  if (!hasElement("#analysisMonth")) return;
  const analysis = getCycleAnalysis();
  const { year, month } = getActiveMonthParts();
  const analysisDate = new Date(year, month - 1, analysis.latestDay);
  const balanceReferenceText = analysis.hasProgressSnapshot ? `Cruzamento com saldos reais usa o registo de ${analysis.latestSnapshot.date || getDefaultMonthDate(analysis.snapshotDay)}.` : "Sem saldos reais comparativos.";
  const gap = Math.abs(analysis.movementGap);
  document.querySelector("#analysisMonth").textContent = formatMonth(analysisDate);
  document.querySelector("#analysisDate").textContent = formatDate(analysisDate);
  document.querySelector("#shouldHaveSpentToday").textContent = formatCurrency(analysis.expectedSpentToday);
  document.querySelector("#currentWeek").textContent = formatCurrency(analysis.actualSpent);
  document.querySelector("#expensesUntilToday").textContent = formatCurrency(analysis.expensesUntilToday);
  document.querySelector("#transfersUntilToday").textContent = formatCurrency(analysis.transfersUntilToday);
  document.querySelector("#expectedSpentToday").textContent = formatCurrency(analysis.expectedSpentWeek);
  document.querySelector("#expectedSpentWeek").textContent = formatCurrency(analysis.reportNextWeek);
  document.querySelector("#idealRemaining").textContent = formatCurrency(analysis.idealRemaining);
  document.querySelector("#availableToSplit").textContent = formatCurrency(analysis.availableToSplit);
  document.querySelector("#splitNowRevolut").textContent = formatCurrency(analysis.splitNowRevolut);
  document.querySelector("#splitNowXtb").textContent = formatCurrency(analysis.splitNowXtb);
  const today = getToday();
  const currentMonthDay = isActiveMonthCurrent() ? today.getDate() : 31;
  let lastSundayDay = 0;
  for (let d = currentMonthDay; d >= 1; d--) { if (new Date(year, month - 1, d).getDay() === 0) { lastSundayDay = d; break; } }
  const sundayAnalysis = lastSundayDay > 0 ? getCycleAnalysis(lastSundayDay) : analysis;
  const sundayText = lastSundayDay > 0 ? `No último domingo (dia ${lastSundayDay}), excedente de ${formatCurrency(sundayAnalysis.idealRemaining)}.` : "Sem domingos de fecho.";
  document.querySelector("#analysisHint").innerHTML = `Ciclo: ${formatDate(analysis.cycleStart)} até ${formatDate(analysis.cycleEnd)}. <br>Gasto permitido hoje (dia ${analysis.latestDay}): ${formatCurrency(analysis.expectedSpentToday)}. ${balanceReferenceText}`;
  document.querySelector("#depositAdvice").innerHTML = `<strong>Sugestão estratégica:</strong> ${sundayText} <br>Fatias: ${formatCurrency(sundayAnalysis.splitNowRevolut)} Revolut | ${formatCurrency(sundayAnalysis.splitNowXtb)} XTB.`;
  document.querySelector("#analysisFormula").textContent = analysis.availableToSplit > 0 ? `Acima do limite em ${formatCurrency(analysis.availableToSplit)}.` : `Abaixo do limite: ${formatCurrency(analysis.idealRemaining)} de excedente.`;
}

function getBankReconciliation() {
  const history = getReconciliationHistory();
  const latestInterval = history.length ? history[history.length - 1] : null;
  const analysis = getCycleAnalysis();
  const currentSnapshot = analysis.latestSnapshot || getStartingSnapshot();
  const currentTotalBalance = currentSnapshot ? Number(currentSnapshot.bankBalance) + Number(currentSnapshot.cashBalance) : 0;
  if (!latestInterval) return { previousBankBalance: 0, currentBankBalance: 0, previousCashBalance: 0, currentCashBalance: 0, totalDifference: 0, expenseTotal: 0, transferTotal: 0, reconciledTotal: 0, unexplainedDifference: 0, hasSnapshots: Boolean(currentSnapshot), currentTotalBalance, netCurrentBalance: currentTotalBalance };
  return { ...latestInterval, currentTotalBalance, netCurrentBalance: currentTotalBalance, hasSnapshots: true };
}

function getReconciliationHistory() {
  const snapshots = getSnapshotsForMonth();
  const history = [];
  for (let index = 1; index < snapshots.length; index += 1) {
    const prev = snapshots[index - 1]; const curr = snapshots[index];
    const prevT = Number(prev.bankBalance) + Number(prev.cashBalance); const currT = Number(curr.bankBalance) + Number(curr.cashBalance);
    const totalDiff = prevT - currT;
    const expT = sumExpensesBetween(prev.day, curr.day); const transT = sumTransfersBetween(prev.day, curr.day);
    const incT = sumIncomesBetween(prev.day, curr.day, false);
    const recoT = expT + transT - incT;
    history.push({ previousDay: prev.day, currentDay: curr.day, totalDifference: totalDiff, expenseTotal: expT, transferTotal: transT, reconciledTotal: recoT, unexplainedDifference: totalDiff - recoT, previousBankBalance: prev.bankBalance, currentBankBalance: curr.bankBalance, previousCashBalance: prev.cashBalance, currentCashBalance: curr.cashBalance });
  }
  return history;
}

function renderBankReconciliation() {
  const bank = getBankReconciliation();
  const startSnapshot = getStartingSnapshot();
  const latestSnapshot = getSnapshotsForMonth().pop() || null;
  if (hasElement("#startOfMonthBalanceDisplay")) {
    document.querySelector("#startOfMonthBalanceDisplay").textContent = startSnapshot ? `${startSnapshot.accountName} | ${formatCurrency(startSnapshot.bankBalance)} banco | ${formatCurrency(startSnapshot.cashBalance)} carteira` : "Sem 01/01";
    document.querySelector("#latestSnapshotDisplay").textContent = latestSnapshot ? `Dia ${latestSnapshot.day} | ${latestSnapshot.accountName}` : "Sem registo";
  }
  if (hasElement("#bankStartBalance")) {
    document.querySelector("#bankStartBalance").textContent = formatCurrency(bank.previousBankBalance);
    document.querySelector("#bankCurrentBalance").textContent = formatCurrency(bank.currentBankBalance);
    document.querySelector("#cashStartBalance").textContent = formatCurrency(bank.previousCashBalance);
    document.querySelector("#cashCurrentBalance").textContent = formatCurrency(bank.currentCashBalance);
    document.querySelector("#bankDifference").textContent = formatCurrency(bank.totalDifference);
    document.querySelector("#bankExpenseTotal").textContent = formatCurrency(bank.expenseTotal);
    document.querySelector("#bankTransferTotal").textContent = formatCurrency(bank.transferTotal);
    document.querySelector("#bankReconciledTotal").textContent = formatCurrency(bank.reconciledTotal);
    document.querySelector("#bankUnexplained").textContent = formatCurrency(bank.unexplainedDifference);
    document.querySelector("#currentTotalBalance").textContent = formatCurrency(bank.currentTotalBalance);
    document.querySelector("#netCurrentBalance").textContent = formatCurrency(bank.netCurrentBalance);
  }
  const status = document.querySelector("#bankStatus");
  if (status) {
    if (!bank.hasSnapshots || !startSnapshot) { status.textContent = "Guarda o ponto de partida (dia 1) para começar a reconciliar."; return; }
    if (Math.abs(bank.unexplainedDifference) <= 0.01) status.textContent = "Contas batem certo!";
    else status.textContent = bank.unexplainedDifference > 0 ? `Faltam justificar ${formatCurrency(bank.unexplainedDifference)}.` : `Excesso de ${formatCurrency(Math.abs(bank.unexplainedDifference))} registado.`;
  }
}

function renderAccounts() {
  const container = document.querySelector("#accountsList");
  if (!container) return;
  container.innerHTML = "";
  if (!state.accounts.length) { container.className = "item-list empty-state"; container.textContent = "Sem contas."; return; }
  container.className = "item-list";
  const snapshots = getMonthSnapshotsRaw();
  const latestByAcc = new Map();
  snapshots.forEach(s => { if(s.accountId) latestByAcc.set(s.accountId, s); });
  state.accounts.forEach(acc => {
    const node = template.content.firstElementChild.cloneNode(true);
    const snap = latestByAcc.get(acc.id);
    node.querySelector(".item-title").textContent = acc.name;
    node.querySelector(".item-subtitle").textContent = snap ? `${acc.type} | Dia ${snap.day}` : acc.type;
    node.querySelector(".item-value").textContent = formatCurrency(snap ? snap.bankBalance : acc.balance);
    node.querySelector(".ghost-btn").addEventListener("click", () => { state.accounts = state.accounts.filter(a => a.id !== acc.id); saveState(); render(); });
    container.appendChild(node);
  });
}

function renderRecurring() {
  const masterContainer = document.querySelector("#recurringList");
  const mContainer = document.querySelector("#fixedExpensesList");
  const { month } = getActiveMonthParts();
  const monthsNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const freqLabels = { monthly: "Mensal", "semi-annual": "Semestral", annual: "Anual" };
  if (masterContainer) {
    masterContainer.innerHTML = "";
    if (!state.recurringFixed.length) { masterContainer.className = "item-list empty-state"; masterContainer.textContent = "Sem despesas fixas."; }
    else {
      masterContainer.className = "item-list";
      state.recurringFixed.forEach(item => {
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector(".item-title").textContent = item.name;
        node.querySelector(".item-subtitle").textContent = `Dia ${item.day} · ${freqLabels[item.frequency] || "Mensal"}`;
        node.querySelector(".item-value").textContent = formatCurrency(item.amount);
        node.querySelector(".ghost-btn").addEventListener("click", () => { state.recurringFixed = state.recurringFixed.filter(rf => rf.id !== item.id); saveState(); render(); });
        masterContainer.appendChild(node);
      });
    }
  }
  if (mContainer) {
    mContainer.innerHTML = "";
    const activeKey = getMonthKey();
    const allFixed = state.recurringFixed.filter(rf => !rf.endDate || rf.endDate >= activeKey);
    if (!allFixed.length) { mContainer.className = "item-list empty-state"; mContainer.textContent = "Sem obrigações."; }
    else {
      mContainer.className = "item-list";
      allFixed.forEach(item => {
        const node = template.content.firstElementChild.cloneNode(true);
        const sm = Number(item.startMonth) || 1;
        const isCurrent = (!item.frequency || item.frequency === 'monthly') || (item.frequency === 'annual' && month === sm) || (item.frequency === 'semi-annual' && (month === sm || month === (sm + 6 > 12 ? sm - 6 : sm + 6)));
        node.querySelector(".item-title").textContent = item.name;
        if (isCurrent) {
          node.querySelector(".item-subtitle").textContent = `Dia ${item.day}${item.endDate ? ` · Fim: ${item.endDate}` : ""}`;
          node.querySelector(".item-value").textContent = formatCurrency(item.amount);
        } else {
          const prov = item.frequency === 'annual' ? item.amount / 12 : item.amount / 6;
          node.querySelector(".item-subtitle").textContent = `Provisão (${freqLabels[item.frequency]})`;
          node.querySelector(".item-value").textContent = formatCurrency(prov);
          node.style.opacity = "0.7";
        }
        node.style.cursor = "pointer";
        node.addEventListener("click", (e) => {
          if (e.target.tagName === "BUTTON") return;
          expenseForm.dataset.editingId = item.id;
          expenseForm.dataset.editingType = "fixed";
          document.querySelector("#expenseName").value = item.name;
          document.querySelector("#expenseAmount").value = item.amount;
          const kEl = document.querySelector("#expenseKind"); kEl.value = "fixed"; kEl.dispatchEvent(new Event("change"));
          const fEl = document.querySelector("#expenseFrequency"); fEl.value = item.frequency || "monthly";
          document.querySelector("#expenseDate").value = `${activeKey}-${String(item.day || 1).padStart(2, '0')}`;
          const eEl = document.querySelector("#expenseEndDate"); if (eEl) eEl.value = item.endDate || "";
          if (document.querySelector("#recurringEditActions")) document.querySelector("#recurringEditActions").style.display = "grid";
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        node.querySelector(".ghost-btn").style.display = "none";
        mContainer.appendChild(node);
      });
    }
  }
}

function renderReceivables() {
  const container = document.querySelector("#receivablesList");
  if (!container) return;
  container.innerHTML = "";
  const receivables = state.receivables.slice().sort((a,b) => (b.dateLabel || "").localeCompare(a.dateLabel || ""));
  if (hasElement("#receivablePendingTotal")) document.querySelector("#receivablePendingTotal").textContent = formatCurrency(receivables.filter(r => r.status !== "received").reduce((s, r) => s + Number(r.amount), 0));
  if (hasElement("#receivableReceivedTotal")) document.querySelector("#receivableReceivedTotal").textContent = formatCurrency(receivables.filter(r => r.status === "received").reduce((s, r) => s + Number(r.amount), 0));
  if (!receivables.length) { container.className = "item-list empty-state"; container.textContent = "Sem registos."; return; }
  container.className = "item-list";
  receivables.forEach(rec => {
    const node = template.content.firstElementChild.cloneNode(true);
    const isR = rec.status === "received";
    node.querySelector(".item-title").textContent = rec.name;
    node.querySelector(".item-subtitle").textContent = `${isR ? "Recebido" : "Pendente"} | ${rec.dateLabel || ""}`;
    node.querySelector(".item-value").textContent = formatCurrency(rec.amount);
    if (isR) node.style.opacity = "0.5";
    const aw = node.querySelector(".item-actions"); const rb = node.querySelector(".ghost-btn");
    if (!isR) {
      const b = document.createElement("button"); b.className = "success-btn"; b.textContent = "✅";
      b.onclick = () => { rec.status = "received"; if(!state.incomes.find(i => i.linkedReceivableId === rec.id)) state.incomes.push({ id: generateUUID(), monthKey: getMonthKey(), name: `Reembolso: ${rec.name}`, amount: rec.amount, day: Math.min(getToday().getDate(), 31), dateLabel: getDefaultMonthDate(), linkedReceivableId: rec.id }); saveState(); render(); };
      aw.insertBefore(b, rb);
    }
    const eb = document.createElement("button"); eb.className = "ghost-btn"; eb.textContent = "Editar";
    eb.onclick = () => { receivableForm.dataset.editingId = rec.id; document.querySelector("#receivableName").value = rec.name; document.querySelector("#receivableAmount").value = rec.amount; document.querySelector("#receivableDate").value = rec.dateLabel || ""; document.querySelector("#receivableStatus").value = rec.status || "pending"; };
    aw.insertBefore(eb, rb);
    rb.onclick = () => { state.receivables = state.receivables.filter(r => r.id !== rec.id); saveState(); render(); };
    container.appendChild(node);
  });
}

function renderExpenses() {
  if (variableContainer) variableContainer.innerHTML = "";
  const activeKeys = getPeriodMonthKeys();
  const items = state.expenses.filter(e => activeKeys.includes(getItemMonthKey(e))).sort((a,b) => (getItemMonthKey(b)+String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a)+String(a.day).padStart(2,'0')));
  if (!items.length) { if(variableContainer) { variableContainer.className = "item-list empty-state"; variableContainer.textContent = "Sem despesas."; } return; }
  items.forEach(exp => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = exp.name;
    node.querySelector(".item-subtitle").textContent = `${exp.category || "Geral"} | Dia ${exp.day}`;
    node.querySelector(".item-value").textContent = formatCurrency(exp.amount);
    node.querySelector(".ghost-btn").onclick = (e) => { e.stopPropagation(); state.expenses = state.expenses.filter(i => i.id !== exp.id); saveState(); render(); };
    node.onclick = (e) => { if (e.target.tagName === "BUTTON") return; expenseForm.dataset.editingId = exp.id; document.querySelector("#expenseName").value = exp.name; document.querySelector("#expenseAmount").value = exp.amount; document.querySelector("#expenseCategory").value = exp.category || ""; document.querySelector("#expenseDate").value = exp.dateLabel || ""; if(document.querySelector("#expenseKind")) document.querySelector("#expenseKind").value = exp.kind || "variable"; };
    if (exp.kind !== "fixed" && variableContainer) { variableContainer.className = "item-list"; variableContainer.appendChild(node); }
  });
}

function getPeriodMonthKeys() {
  const today = getToday();
  const period = (typeof window !== 'undefined' && window.activePeriodFilter) || 'month';
  const keys = new Set();
  if (period === 'all') { [...state.expenses, ...state.incomes, ...state.transfers].forEach(i => keys.add(getItemMonthKey(i))); return [...keys]; }
  const back = period === 'quarter' ? 3 : 1;
  for (let i = 0; i < back; i++) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  keys.add(getMonthKey()); return [...keys];
}

function renderCategories() {
  const container = document.querySelector("#categoryList");
  if (!container) return;
  container.innerHTML = "";
  state.categories.forEach(cat => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = cat;
    node.querySelector(".item-subtitle").textContent = "Categoria";
    node.querySelector(".item-value").textContent = "";
    node.querySelector(".ghost-btn").onclick = () => { if (state.expenses.some(e => e.category === cat)) { setStatus("#categoryStatus", "Em uso!"); return; } state.categories = state.categories.filter(c => c !== cat); saveState(); render(); };
    container.appendChild(node);
  });
}

function renderIncomes() {
  const container = document.querySelector("#incomesList");
  if (!container) return;
  container.innerHTML = "";
  const keys = getPeriodMonthKeys();
  const items = state.incomes.filter(i => keys.includes(getItemMonthKey(i))).sort((a,b) => (getItemMonthKey(b)+String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a)+String(a.day).padStart(2,'0')));
  if (!items.length) { container.className = "item-list empty-state"; container.textContent = "Sem entradas."; return; }
  container.className = "item-list";
  items.forEach(inc => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = inc.name;
    node.querySelector(".item-value").textContent = formatCurrency(inc.amount);
    const aw = node.querySelector(".item-actions"); const rb = node.querySelector(".ghost-btn");
    const eb = document.createElement("button"); eb.className = "ghost-btn"; eb.textContent = "Editar";
    eb.onclick = () => { incomeForm.dataset.editingId = inc.id; document.querySelector("#incomeName").value = inc.name; document.querySelector("#incomeAmount").value = inc.amount; document.querySelector("#incomeDate").value = inc.dateLabel || ""; };
    aw.insertBefore(eb, rb);
    rb.onclick = () => { state.incomes = state.incomes.filter(i => i.id !== inc.id); saveState(); render(); };
    container.appendChild(node);
  });
}

function renderTransfers() {
  const container = document.querySelector("#transfersList");
  if (!container) return;
  container.innerHTML = "";
  const keys = getPeriodMonthKeys();
  const items = state.transfers.filter(t => keys.includes(getItemMonthKey(t))).sort((a,b) => (getItemMonthKey(b)+String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a)+String(a.day).padStart(2,'0')));
  if (!items.length) { container.className = "item-list empty-state"; container.textContent = "Sem transferências."; return; }
  container.className = "item-list";
  items.forEach(t => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = t.name;
    node.querySelector(".item-value").textContent = formatCurrency(t.amount);
    node.querySelector(".ghost-btn").onclick = () => { state.transfers = state.transfers.filter(i => i.id !== t.id); saveState(); render(); };
    container.appendChild(node);
  });
}

function getGlobalAccountsTotal() {
  let total = 0;
  state.accounts.forEach(acc => { total += (Number(acc.balance) || 0); });
  let latestCashTotal = 0;
  const allChronological = state.snapshots.slice().sort((a,b) => {
    if(a.monthKey === b.monthKey) return (Number(a.day)||0) - (Number(b.day)||0);
    return String(a.monthKey || "").localeCompare(String(b.monthKey || ""));
  });
  if (allChronological.length > 0) {
      const lastSnap = allChronological[allChronological.length - 1];
      const sameDaySnaps = allChronological.filter(s => s.monthKey === lastSnap.monthKey && s.day === lastSnap.day);
      sameDaySnaps.forEach(s => { latestCashTotal += (Number(s.cashBalance) || 0); });
  }
  if (state.accounts.length === 0 && allChronological.length > 0) {
      const legacyAccountBalances = {};
      allChronological.forEach(s => {
          const id = s.accountId || "legacy";
          legacyAccountBalances[id] = (Number(s.bankBalance) || 0) + (Number(s.cashBalance) || 0);
      });
      let legacyTotal = 0;
      for (let k in legacyAccountBalances) legacyTotal += legacyAccountBalances[k];
      return legacyTotal;
  }
  return total + latestCashTotal;
}

function renderNetWorth() {
  const el = document.querySelector("#globalNetWorthDisplay");
  if (!el) return;
  const accountsTotal = getGlobalAccountsTotal();
  const receivablesTotal = state.receivables.filter(r => r.status !== "received").reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  el.textContent = formatCurrency(accountsTotal + receivablesTotal);
}

function render() {
  syncForms(); renderNetWorth(); renderBankReconciliation(); renderSundayHistory(); renderSummary(); renderAnalysis();
  renderSnapshots(); renderCategories(); renderAccounts(); renderReceivables(); renderExpenses(); renderRecurring(); renderTransfers(); renderIncomes();
  if (hasElement("#goalLabel")) { const goal = state.revolutGoal?.trim(); document.querySelector("#goalLabel").textContent = goal ? `Reservada para: ${goal}` : "Poupanca ativa"; }
}

function renderSnapshots() {
  const container = document.querySelector("#snapshotList");
  if (!container) return;
  container.innerHTML = "";
  const items = getSnapshotsForMonth().reverse();
  if (!items.length) { container.className = "item-list empty-state"; container.textContent = "Sem registos."; return; }
  container.className = "item-list";
  items.forEach(s => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = `Dia ${s.day}`;
    node.querySelector(".item-subtitle").textContent = `${formatCurrency(s.bankBalance)} banco | ${formatCurrency(s.cashBalance)} carteira`;
    node.querySelector(".item-value").textContent = "";
    node.querySelector(".ghost-btn").onclick = () => { state.snapshots = state.snapshots.filter(ss => !(ss.monthKey === s.monthKey && ss.day === s.day)); saveState(); render(); };
    container.appendChild(node);
  });
}

function renderReconciliationHistory() {}

[settingsForm, startForm, snapshotForm, categoryForm, accountForm, receivableForm, expenseForm, incomeForm, recurringForm].forEach(f => {
  if(!f) return;
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = f.id;
    if (id === "settings-form") {
      state.analysisMonth = document.querySelector("#analysisMonthInput")?.value || getActiveMonthKey();
      state.salary = Number(document.querySelector("#salary").value) || 0;
      state.revolutShare = Number(document.querySelector("#revolutShare").value) || 0;
      state.xtbShare = Number(document.querySelector("#xtbShare").value) || 0;
      state.revolutGoal = document.querySelector("#revolutGoal")?.value.trim() || "";
    } else if (id === "snapshot-form") {
      const snapDate = document.querySelector("#snapshotDate").value;
      const day = getDayFromDateInput(snapDate); const monthKey = getMonthKey();
      const bankInputs = document.querySelectorAll(".dyn-bank-input");
      const globalCashVal = Number(document.querySelector("#dyn-global-cash-input")?.value) || 0;
      state.snapshots = state.snapshots.filter(s => !(s.monthKey === monthKey && s.day === day));
      bankInputs.forEach((inp, i) => {
          const accId = inp.getAttribute("data-acc-id"); const acc = state.accounts.find(a => a.id === accId);
          if(!acc) return;
          state.snapshots.push({ id: generateUUID(), monthKey, day, date: snapDate, accountId: accId, accountName: acc.name, bankBalance: Number(inp.value)||0, cashBalance: i === 0 ? globalCashVal : 0 });
          updateAccountBalance(accId, Number(inp.value)||0);
      });
    } else if (id === "expense-form") {
      const editingId = expenseForm.dataset.editingId; const editingType = expenseForm.dataset.editingType;
      const amount = Number(document.querySelector("#expenseAmount").value) || 0;
      const name = document.querySelector("#expenseName").value.trim();
      const date = document.querySelector("#expenseDate").value; const day = getDayFromDateInput(date) || 1;
      const kind = document.querySelector("#expenseKind")?.value || "variable";
      if (kind === "fixed") {
        const payload = { id: (editingType === "fixed" && editingId) ? editingId : generateUUID(), name, amount, day, frequency: document.querySelector("#expenseFrequency")?.value || "monthly", startMonth: new Date(date).getMonth()+1, endDate: document.querySelector("#expenseEndDate")?.value || "" };
        if (editingType === "fixed" && editingId) { const idx = state.recurringFixed.findIndex(rf => rf.id === editingId); if(idx>=0) state.recurringFixed[idx] = payload; }
        else state.recurringFixed.push(payload);
        expenseForm.reset(); document.querySelector("#recurringEditActions").style.display = "none";
      } else {
        const payload = { id: editingId || generateUUID(), name, amount, day, monthKey: getMonthKey(), dateLabel: date, category: document.querySelector("#expenseCategory").value, kind };
        if (editingId) { const idx = state.expenses.findIndex(e => e.id === editingId); if(idx>=0) state.expenses[idx] = payload; }
        else state.expenses.push(payload);
      }
    } else if (id === "start-form") {
        const d = document.querySelector("#startDate").value;
        const accId = document.querySelector("#startAccountId").value; const acc = state.accounts.find(a => a.id === accId);
        if(!acc || getDayFromDateInput(d) !== 1) return;
        upsertSnapshot({ id: generateUUID(), monthKey: getMonthKey(), day: 1, date: d, accountId: acc.id, accountName: acc.name, bankBalance: Number(document.querySelector("#startBankBalance").value) || 0, cashBalance: Number(document.querySelector("#startCashBalance").value) || 0 });
        updateAccountBalance(acc.id, Number(document.querySelector("#startBankBalance").value) || 0);
    }
    saveState(); render();
  });
});

const kindSelect = document.querySelector("#expenseKind");
if (kindSelect) {
  kindSelect.addEventListener("change", () => {
    const isF = kindSelect.value === "fixed";
    const freqS = document.querySelector("#expenseFrequency"); if (freqS) freqS.style.display = isF ? "block" : "none";
    const endS = document.querySelector("#expenseEndDate"); if (endS) endS.style.display = isF ? "block" : "none";
  });
}

function initDateFields() {
  const t = getToday(); const d = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  ['snapshotDate', 'incomeDate', 'expenseDate', 'transferDate', 'receivableDate'].forEach(id => { const el = document.getElementById(id); if (el && !el.value) el.value = d; });
}

function getPreviousMonthLastBalance() {
  const parts = getActiveMonthParts(); let pY = parts.year, pM = parts.month - 1; if (pM === 0) { pM = 12; pY -= 1; }
  const pK = `${pY}-${String(pM).padStart(2, '0')}`; const snaps = state.snapshots.filter(s => s.monthKey === pK);
  if (!snaps.length) return null;
  const lastD = Math.max(...snaps.map(s => Number(s.day))); const lastS = snaps.filter(s => Number(s.day) === lastD);
  const accT = {}; let totalC = 0; lastS.forEach(s => { accT[s.accountId || 'legacy'] = Number(s.bankBalance)||0; totalC += Number(s.cashBalance)||0; });
  return { accountTotals: accT, totalCash: totalC, monthKey: pK };
}

const state = loadState();
if (typeof window !== 'undefined') {
  window.state = state;
  window.saveState = saveState;
  window.render = render;
  window.formatCurrency = formatCurrency;
  window.getActiveMonthKey = getActiveMonthKey;
  window.getMonthKey = getMonthKey;
  window.getCycleAnalysis = getCycleAnalysis;
  window.calculateBudget = calculateBudget;
  window.sumFixedMonthlyExpenses = sumFixedMonthlyExpenses;
  window.sumVariableExpenses = sumVariableExpenses;
  window.getGlobalAccountsTotal = getGlobalAccountsTotal;
}

if (typeof document !== 'undefined') {
  render();
  initDateFields();
}
