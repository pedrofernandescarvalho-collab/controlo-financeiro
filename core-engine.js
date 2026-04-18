const STORAGE_KEY = "finance-control-app";
const REVOLUT_INTEREST_RATE = 0.019;

// NUCLEAR RESET: Force refresh service workers (v4.5.1)
if ('serviceWorker' in navigator && !localStorage.getItem('sw_reset_v451')) {
    navigator.serviceWorker.getRegistrations().then(regs => {
        for(let reg of regs) reg.unregister();
        localStorage.setItem('sw_reset_v451', 'true');
        window.location.reload(true);
    });
}


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
  recurringFixed: [],
  investments: [],
  priceCache: {},
  finnhubApiKey: "",
  investmentTargets: { dividends: 40, growth: 40, crypto: 10, reit: 10 }
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
      recurringFixed: Array.isArray(parsed.recurringFixed) ? parsed.recurringFixed : [],
      investments: Array.isArray(parsed.investments) ? parsed.investments : [],
      priceCache: (parsed.priceCache && typeof parsed.priceCache === 'object') ? parsed.priceCache : {},
      finnhubApiKey: parsed.finnhubApiKey || "",
      investmentTargets: parsed.investmentTargets || { dividends: 40, growth: 40, crypto: 10, reit: 10 }
    };
  } catch (e) {
    console.error("Erro ao carregar dados:", e);
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  state.updatedAt = Date.now();
  window.isSyncing = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Notificar outros componentes (ex: Firebase Sync, Charts)
  window.dispatchEvent(new CustomEvent("stateUpdated", { detail: state }));
}

// Navigation Guard: Avisar se houver sincronização pendente
window.addEventListener('beforeunload', (e) => {
  if (window.isSyncing) {
    // A maioria dos browsers modernos não permite mensagens customizadas, 
    // mas isto despoleta o aviso padrão de "Tens alterações não guardadas".
    e.preventDefault();
    e.returnValue = '';
  }
});

window.saveState = saveState;

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
  
  // Total bruto de despesas variáveis até ao dia
  const total = state.expenses
    .filter((expense) =>
      getItemMonthKey(expense) === monthKey &&
      expense.kind !== "fixed" &&
      Number(expense.day) <= day
    )
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);

  // Somar todos os recebíveis vinculados a despesas deste mês até ao dia (splits)
  const splits = state.receivables
    .filter(r => 
      r.linkedExpenseId && 
      getItemMonthKey(r) === monthKey &&
      Number(r.day || 1) <= day
    )
    .reduce((total, split) => total + Number(split.amount || 0), 0);

  return Math.max(0, total - splits);
}


function sumFixedMonthlyExpenses(overrideMonthKey) {
  // Aceita monthKey explícito (ex: "2026-02") para cálculos históricos
  let month;
  if (overrideMonthKey && typeof overrideMonthKey === 'string' && overrideMonthKey.includes('-')) {
    month = Number(overrideMonthKey.split('-')[1]);
  } else {
    month = getActiveMonthParts().month;
  }
  return state.recurringFixed
    .filter(rf => {
      if (!rf.frequency || rf.frequency === 'monthly') return true;
      const startMonth = Number(rf.startMonth) || 1;
      if (rf.frequency === 'annual') return month === startMonth;
      if (rf.frequency === 'semi-annual') return month === startMonth || month === (startMonth + 6 > 12 ? startMonth - 6 : startMonth + 6);
      return false;
    })
    .reduce((total, rf) => total + Number(rf.amount || 0), 0);
}

function getMonthlyProvisionForFixedExpenses() {
  return state.recurringFixed.reduce((total, rf) => {
    const amount = Number(rf.amount || 0);
    if (!rf.frequency || rf.frequency === 'monthly') return total + amount;
    if (rf.frequency === 'semi-annual') return total + (amount / 6);
    if (rf.frequency === 'annual') return total + (amount / 12);
    return total + amount;
  }, 0);
}

function sumVariableExpenses() {
  const monthKey = getMonthKey();
  
  // Soma total das despesas variáveis do mês
  const totalVariable = state.expenses
    .filter(e => e.kind !== "fixed" && getItemMonthKey(e) === monthKey)
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);

  // Somar todos os recebíveis vinculados a despesas deste mês
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
        // Verificar se este ganho é um reembolso de despesa partilhada
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
  
  // Provisionamento: peso médio mensal de todas as despesas (mensal + semestral/6 + anual/12)
  const monthlyProvision = getMonthlyProvisionForFixedExpenses();
  
  // Despesas reais do mês (para análise de leftover corrente)
  const fixedExpensesReal = sumFixedMonthlyExpenses();
  const variableExpenses = sumVariableExpenses();
  const transferExpenses = sumTransfers();
  const extraIncomes = sumIncomes(true); // Excluir reembolsos para o orçamento
  
  // Orçamento base usa o provisionamento para que o disponível diário não varie conforme o mês
  const disposableMonthlyBudget = Math.max(salary + extraIncomes - monthlyProvision, 0);
  const { daysInCycle } = getCycleWindow();
  const weeksInCycle = Math.max(Math.ceil(daysInCycle / 7), 1);
  const weeklyBudget = disposableMonthlyBudget / weeksInCycle;
  const dailyBudget = disposableMonthlyBudget / Math.max(daysInCycle, 1);
  const shareTotal = (Number(state.revolutShare) || 0) + (Number(state.xtbShare) || 0);
  const normalizedRevolutShare = shareTotal > 0 ? (Number(state.revolutShare) || 0) / shareTotal : 0.5;
  
  // Leftover é o que SOBRA no mês real face ao que foi orçamentado e gasto
  // Note: usamos monthlyProvision para o cálculo de leftover de poupança (objetivo de segurança)
  const leftover = Math.max(salary + extraIncomes - monthlyProvision - variableExpenses - transferExpenses, 0);
  
  const revolutAllocation = leftover * normalizedRevolutShare;
  const xtbAllocation = leftover - revolutAllocation;
  const revolutInterest = revolutAllocation * REVOLUT_INTEREST_RATE;

  return {
    fixedExpenses: monthlyProvision, // peso orçamental
    fixedExpensesReal,               // pagamento real do mês
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

  return {
    cycleStart,
    cycleEnd,
    nextCycleStart,
    daysInCycle
  };
}

function getToday() {
  return new Date();
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
  if (item.monthKey) {
    return item.monthKey;
  }

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
  const { month } = getActiveMonthParts();
  return state.recurringFixed
    .filter((rf) => {
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
    .filter((transfer) =>
      getItemMonthKey(transfer) === getMonthKey() &&
      Number(transfer.day) <= day
    )
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
  
  // O primeiro snapshot por dia é o "ponto de partida"
  // Como o getMonthSnapshotsRaw devolve dados RAW (por conta), 
  // precisamos de consolidar o dia mínimo para obter o saldo total de início
  const firstDay = monthSnaps[0].day; // já ordenado por sortSnapshots
  const firstDaySnaps = monthSnaps.filter(s => s.day === firstDay);
  
  if (firstDaySnaps.length === 1) {
    // Apenas uma conta -  retornar diretamente
    return firstDaySnaps[0];
  }
  
  // Múltiplas contas no dia 1 -  consolidar numa entrada virtual
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

function getEditingSnapshotId() {
  return snapshotForm.dataset.editingId || "";
}

function getEditingExpenseId() {
  return expenseForm.dataset.editingId || "";
}

function getEditingIncomeId() {
  return incomeForm?.dataset.editingId || "";
}

function getEditingReceivableId() {
  return receivableForm?.dataset.editingId || "";
}

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
  const incomeDateInput = document.querySelector("#incomeDate");
  if (incomeDateInput) {
    incomeDateInput.value = getDefaultMonthDate(Math.min(getToday().getDate(), getCycleWindow().daysInCycle));
  }
}

function clearReceivableEditing() {
  if (!receivableForm) {
    return;
  }

  delete receivableForm.dataset.editingId;
  receivableForm.reset();
  const receivableDateInput = document.querySelector("#receivableDate");
  if (receivableDateInput) {
    receivableDateInput.value = getDefaultMonthDate(Math.min(getToday().getDate(), getCycleWindow().daysInCycle));
  }
  const receivableStatusInput = document.querySelector("#receivableStatus");
  if (receivableStatusInput) {
    receivableStatusInput.value = "pending";
  }
}

function upsertSnapshot(snapshot) {
  const existingIndexById = snapshot.id
    ? state.snapshots.findIndex((item) => item.id === snapshot.id)
    : -1;

  if (existingIndexById >= 0) {
    state.snapshots[existingIndexById] = { ...state.snapshots[existingIndexById], ...snapshot };
    return;
  }

  const existingIndex = state.snapshots.findIndex(
    (item) => item.monthKey === snapshot.monthKey &&
      item.day === snapshot.day &&
      (item.accountId || "") === (snapshot.accountId || "")
  );

  if (existingIndex >= 0) {
    state.snapshots[existingIndex] = { ...state.snapshots[existingIndex], ...snapshot };
    return;
  }

  state.snapshots.push(snapshot);
}

function updateAccountBalance(accountId, balance) {
  const accountIndex = state.accounts.findIndex((account) => account.id === accountId);
  if (accountIndex < 0) {
    return;
  }

  state.accounts[accountIndex] = {
    ...state.accounts[accountIndex],
    balance: Number(balance) || 0
  };
}

function syncAccountOptions() {
  const selectors = ["#startAccountId", "#snapshotAccountId", "#transferAccountId"];
  const defaultAccountId = getStartingSnapshot()?.accountId || state.accounts[0]?.id || "";

  selectors.forEach((selector) => {
    const select = document.querySelector(selector);
    if (!select) {
      return;
    }

    const currentValue = select.value;
    select.innerHTML = "";

    state.accounts.forEach((account) => {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = `${account.name} | ${account.type}`;
      select.appendChild(option);
    });

    const targetValue = state.accounts.some((account) => account.id === currentValue)
      ? currentValue
      : defaultAccountId;

    if (targetValue) {
      select.value = targetValue;
    }
  });
}

function getCycleAnalysis(targetDay = null) {
  const { cycleStart, cycleEnd, daysInCycle } = getCycleWindow();
  const snapshots = getSnapshotsForMonth().slice().sort((a, b) => a.day - b.day);
  const startSnapshot = getStartingSnapshot();
  
  const today = getToday();
  const currentDay = isActiveMonthCurrent() ? today.getDate() : 31;
  const elapsedDays = Math.min(targetDay || currentDay, daysInCycle);
  
  // Encontrar o último snapshot AT-@ o dia analisado (targetDay ou hoje)
  const snapshotsUntilTarget = snapshots.filter(s => s.day <= elapsedDays);
  const latestSnapshot = snapshotsUntilTarget.length
    ? snapshotsUntilTarget[snapshotsUntilTarget.length - 1]
    : null;

  const budget = calculateBudget();
  const allowedSpent = (budget.disposableMonthlyBudget / Math.max(daysInCycle, 1)) * elapsedDays;
  
  const snapshotDay = latestSnapshot ? Math.min(latestSnapshot.day, elapsedDays) : 1;
  const expensesUntilTarget = sumExpensesUntil(elapsedDays);
  const transfersUntilTarget = sumTransfersUntil(elapsedDays);
  const fixedExpensesPaidUntilSnapshot = sumFixedExpensesUntil(snapshotDay);
  
  const startTotalBalance = startSnapshot
    ? Number(startSnapshot.bankBalance) + Number(startSnapshot.cashBalance)
    : 0;
  const currentTotalBalance = latestSnapshot
    ? Number(latestSnapshot.bankBalance) + Number(latestSnapshot.cashBalance)
    : startTotalBalance;
  
  const hasProgressSnapshot = Boolean(latestSnapshot && startSnapshot && latestSnapshot.day > startSnapshot.day);
  const incomesUntilSnapshot = sumIncomesUntil(snapshotDay, true);

  const grossOutflow = hasProgressSnapshot
    ? (startTotalBalance - currentTotalBalance) + incomesUntilSnapshot
    : 0;

  const realFlexibleSpentAtSnapshot = hasProgressSnapshot
    ? Math.max(grossOutflow - fixedExpensesPaidUntilSnapshot, 0)
    : 0;
    
  const actualSpent = hasProgressSnapshot
    ? realFlexibleSpentAtSnapshot
    : expensesUntilTarget + transfersUntilTarget;

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
    expectedSpentWeek: debt, // dívida atual
    idealRemaining: surplus, // excedente atual
    availableToSplit: debt,
    reportNextWeek: debt,
    splitNowRevolut,
    splitNowXtb,
    latestSnapshot,
    isSunday: snapshotsUntilTarget.some(s => s.day === elapsedDays) // Marcador se houve snapshot no dia alvo
  };
}

function getSundayHistory() {
  const { year, month } = getActiveMonthParts();
  const today = getToday();
  const currentDay = isActiveMonthCurrent() ? today.getDate() : 31;
  const sundays = [];
  
  // Percorrer os dias do ciclo até hoje
  for (let d = 1; d <= currentDay; d++) {
    const date = new Date(year, month - 1, d);
    const isSunday = date.getDay() === 0;
    const isLastDay = new Date(year, month, 0).getDate() === d;
    
    if (isSunday || isLastDay) {
      sundays.push({
        day: d,
        label: isSunday ? `Domingo ${d}` : `Fecho do Mês (${d})`,
        analysis: getCycleAnalysis(d)
      });
    }
  }
  return sundays.reverse(); // Mais recente primeiro
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
    node.querySelector(".item-subtitle").innerHTML = 
      `Alvo: ${formatCurrency(analysis.expectedSpentToday)} | ` +
      `Gasto Real: ${formatCurrency(analysis.actualSpent)} <br>` +
      `<small>${analysis.hasProgressSnapshot ? "Baseado em Saldo Real" : "Baseado em Despesas Escritas"}</small>`;
    
    const valueEl = node.querySelector(".item-value");
    valueEl.textContent = isPositive ? `+ ${formatCurrency(analysis.idealRemaining)}` : `- ${formatCurrency(analysis.availableToSplit)}`;
    valueEl.style.color = isPositive ? "var(--success)" : "var(--error)";
    
    node.querySelector(".ghost-btn").remove(); // Não apagamos histórico individual aqui
    container.appendChild(node);
  });
}

function syncForms() {
  if (hasElement("#analysisMonthInput")) {
    document.querySelector("#analysisMonthInput").value = getActiveMonthKey();
  }
  if (hasElement("#salary")) {
    document.querySelector("#salary").value = state.salary || 0;
  }
  if (hasElement("#revolutShare")) {
    document.querySelector("#revolutShare").value = state.revolutShare || 0;
  }
  if (hasElement("#xtbShare")) {
    document.querySelector("#xtbShare").value = state.xtbShare || 0;
  }
  if (hasElement("#revolutGoal")) {
    document.querySelector("#revolutGoal").value = state.revolutGoal || "";
  }
  
  const snapDateInput = document.querySelector("#snapshotDate");
  if (snapDateInput && !snapDateInput.value) {
    snapDateInput.value = getDefaultMonthDate();
  }
  
  const expenseDateInput = document.querySelector("#expenseDate");
  if (expenseDateInput && !expenseDateInput.value) {
    expenseDateInput.value = getDefaultMonthDate();
  }

  const transferDateInput = document.querySelector("#transferDate");
  if (transferDateInput && !transferDateInput.value) {
    transferDateInput.value = getDefaultMonthDate();
  }

  const incomeDateInput = document.querySelector("#incomeDate");
  if (incomeDateInput && !incomeDateInput.value) {
    incomeDateInput.value = getDefaultMonthDate();
  }

  const startDateInput = document.querySelector("#startDate");
  if (startDateInput && !startDateInput.value) {
    startDateInput.value = getDefaultMonthDate(1);
  }

  const receivableDateInput = document.querySelector("#receivableDate");
  if (receivableDateInput && !receivableDateInput.value) {
    receivableDateInput.value = getDefaultMonthDate();
  }

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

  if (snapDateInput && !isCurrentMonthDate(snapDateInput.value)) {
    snapDateInput.value = getDefaultMonthDate(defaultDay);
  }
  if (expenseDateInput && !isCurrentMonthDate(expenseDateInput.value)) {
    expenseDateInput.value = getDefaultMonthDate(defaultDay);
  }
  if (transferDateInput && !isCurrentMonthDate(transferDateInput.value)) {
    transferDateInput.value = getDefaultMonthDate(defaultDay);
  }
  if (incomeDateInput && !isCurrentMonthDate(incomeDateInput.value)) {
    incomeDateInput.value = getDefaultMonthDate(defaultDay);
  }
  if (receivableDateInput && !isCurrentMonthDate(receivableDateInput.value)) {
    receivableDateInput.value = getDefaultMonthDate(defaultDay);
  }

  syncAccountOptions();
  if (hasElement("#expenseCategory")) {
    syncCategoryOptions();
  }
  
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
  // Extract the most recently known cash
  const allChronological = state.snapshots.slice().sort((a,b) => {
    if(a.monthKey === b.monthKey) return (Number(a.day)||0) - (Number(b.day)||0);
    return String(a.monthKey || "").localeCompare(String(b.monthKey || ""));
  });
  
  let latestCashTotal = 0;
  if (allChronological.length > 0) {
      const lastSnap = allChronological[allChronological.length - 1];
      const sameDaySnaps = allChronological.filter(s => s.monthKey === lastSnap.monthKey && s.day === lastSnap.day);
      sameDaySnaps.forEach(s => {
         latestCashTotal += (Number(s.cashBalance) || 0);
      });
  }

  // Bank fields
  state.accounts.forEach(acc => {
    html += `
      <div style="background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.05); color: var(--text-dark);">
         <strong style="display:block; margin-bottom:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">${acc.name} (${acc.type})</strong>
         <div style="display:flex; flex-direction:column; gap:4px;">
           <label style="font-size:12px; margin:0;">Saldo Bancario Livre</label>
           <input type="number" step="0.01" class="dyn-bank-input" data-acc-id="${acc.id}" value="${Number(acc.balance)||0}" required>
         </div>
      </div>
    `;
  });
  
  // Dedicated Wallet Field
  html += `
      <div style="background: rgba(13, 148, 136, 0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(13, 148, 136, 0.3); color: var(--text-dark);">
         <strong style="display:block; margin-bottom:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">Dinheiro (Em Carteira)</strong>
         <div style="display:flex; flex-direction:column; gap:4px;">
           <label style="font-size:12px; margin:0;">Dinheiro Fisico Global</label>
           <input type="number" step="0.01" id="dyn-global-cash-input" value="${latestCashTotal}" required>
         </div>
      </div>
  `;
  container.innerHTML = html;
}

function syncCategoryOptions() {
  const select = document.querySelector("#expenseCategory");
  if (!select) {
    return;
  }
  const currentValue = select.value;
  select.innerHTML = "";

  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  if (state.categories.includes(currentValue)) {
    select.value = currentValue;
  }
}

function renderSummary() {
  if (!hasElement("#weeklyBudget")) {
    return;
  }
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
  if (node) {
    node.textContent = message;
  }
  showToast(message);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function renderAnalysis() {
  if (!hasElement("#analysisMonth")) {
    return;
  }
  const analysis = getCycleAnalysis();
  const { year, month } = getActiveMonthParts();
  const analysisDate = new Date(year, month - 1, analysis.latestDay);
  const balanceReferenceText = analysis.hasProgressSnapshot
    ? `O cruzamento com saldos reais esta a usar o registo de ${analysis.latestSnapshot.date || getDefaultMonthDate(analysis.snapshotDay)}.`
    : "Ainda so existe o ponto de partida, por isso o cruzamento com saldos reais ainda nao esta disponivel.";
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
  // ENCONTRAR O -aLTIMO DOMINGO PARA REFER-`NCIA DE DEP- SITOS
  const today = getToday();
  const currentMonthDay = isActiveMonthCurrent() ? today.getDate() : 31;
  let lastSundayDay = 0;
  for (let d = currentMonthDay; d >= 1; d--) {
    if (new Date(year, month - 1, d).getDay() === 0) {
      lastSundayDay = d;
      break;
    }
  }

  const sundayAnalysis = lastSundayDay > 0 ? getCycleAnalysis(lastSundayDay) : analysis;
  const sundayText = lastSundayDay > 0 
    ? `Baseado no último domingo (dia ${lastSundayDay}), tinhas um excedente de ${formatCurrency(sundayAnalysis.idealRemaining)}.`
    : "Ainda não houve um domingo de fecho neste ciclo.";

  document.querySelector("#analysisHint").innerHTML =
    `Ciclo atual: ${formatDate(analysis.cycleStart)} até ${formatDate(analysis.cycleEnd)}. <br>` +
    `Gasto permitido hoje (dia ${analysis.latestDay}): ${formatCurrency(analysis.expectedSpentToday)}. ${balanceReferenceText}`;
  
  document.querySelector("#depositAdvice").innerHTML =
    `<strong>Sugestão estratégica:</strong> ${sundayText} <br>` +
    `Podes dividir ${formatCurrency(sundayAnalysis.idealRemaining)}: ` +
    `${formatCurrency(sundayAnalysis.splitNowRevolut)} para Revolut e ` +
    `${formatCurrency(sundayAnalysis.splitNowXtb)} para XTB.`;
  document.querySelector("#analysisFormula").textContent =
    analysis.availableToSplit > 0
      ? `Estás acima do permitido em ${formatCurrency(analysis.availableToSplit)}. Este valor fica a reportar para a proxima semana.`
      : `Estás abaixo do permitido e tens ${formatCurrency(analysis.idealRemaining)} de excedente acumulado.`;

  if (!analysis.hasProgressSnapshot) {
    document.querySelector("#analysisFormula").textContent +=
      " Guarda um novo registo de saldo para confirmar estes valores contra as contas reais.";
    return;
  }

  if (gap <= 0.01) {
    document.querySelector("#analysisFormula").textContent +=
      ` Os movimentos registados batem certo com a variacao do saldo ate ao dia ${analysis.snapshotDay}.`;
    return;
  }

  if (analysis.movementGap > 0) {
    document.querySelector("#analysisFormula").textContent +=
      ` Falta registar ${formatCurrency(gap)} em despesas ou depositos para bater certo com o saldo real ate ao dia ${analysis.snapshotDay}.`;
    return;
  }

  document.querySelector("#analysisFormula").textContent +=
    ` Tens ${formatCurrency(gap)} registados a mais face ao saldo real ate ao dia ${analysis.snapshotDay}.`;
}

function getBankReconciliation() {
  const history = getReconciliationHistory();
  const latestInterval = history.length ? history[history.length - 1] : null;
  const analysis = getCycleAnalysis();
  const currentSnapshot = analysis.latestSnapshot || getStartingSnapshot();
  const currentTotalBalance = currentSnapshot
    ? Number(currentSnapshot.bankBalance) + Number(currentSnapshot.cashBalance)
    : 0;

  if (!latestInterval) {
    const fallbackSnap = currentSnapshot || getStartingSnapshot();
    return {
      previousBankBalance: fallbackSnap ? fallbackSnap.bankBalance : 0,
      currentBankBalance: fallbackSnap ? fallbackSnap.bankBalance : 0,
      previousCashBalance: fallbackSnap ? fallbackSnap.cashBalance : 0,
      currentCashBalance: fallbackSnap ? fallbackSnap.cashBalance : 0,
      totalDifference: 0,
      expenseTotal: 0,
      transferTotal: 0,
      reconciledTotal: 0,
      unexplainedDifference: 0,
      hasSnapshots: Boolean(fallbackSnap),
      currentTotalBalance,
      netCurrentBalance: currentTotalBalance
    };
  }

  return {
    previousBankBalance: latestInterval.previousBankBalance,
    currentBankBalance: latestInterval.currentBankBalance,
    previousCashBalance: latestInterval.previousCashBalance,
    currentCashBalance: latestInterval.currentCashBalance,
    totalDifference: latestInterval.totalDifference,
    expenseTotal: latestInterval.expenseTotal,
    transferTotal: latestInterval.transferTotal,
    reconciledTotal: latestInterval.reconciledTotal,
    unexplainedDifference: latestInterval.unexplainedDifference,
    currentTotalBalance,
    netCurrentBalance: currentTotalBalance,
    hasSnapshots: true,
    previousDay: latestInterval.previousDay,
    currentDay: latestInterval.currentDay
  };
}

function getReconciliationHistory() {
  const snapshots = getSnapshotsForMonth();
  const history = [];

  for (let index = 1; index < snapshots.length; index += 1) {
    const previousSnapshot = snapshots[index - 1];
    const currentSnapshot = snapshots[index];
    const previousTotal = Number(previousSnapshot.bankBalance) + Number(previousSnapshot.cashBalance);
    const currentTotal = Number(currentSnapshot.bankBalance) + Number(currentSnapshot.cashBalance);
    const totalDifference = previousTotal - currentTotal;
    const expenseTotal = sumExpensesBetween(previousSnapshot.day, currentSnapshot.day);
    const transferTotal = sumTransfersBetween(previousSnapshot.day, currentSnapshot.day);
    const incomeBetweenTotal = sumIncomesBetween(previousSnapshot.day, currentSnapshot.day, false); // Incluir tudo para reconciliação
    const reconciledTotal = expenseTotal + transferTotal - incomeBetweenTotal;
    const unexplainedDifference = totalDifference - reconciledTotal;

    history.push({
      previousDay: previousSnapshot.day,
      currentDay: currentSnapshot.day,
      previousBankBalance: previousSnapshot.bankBalance,
      currentBankBalance: currentSnapshot.bankBalance,
      previousCashBalance: previousSnapshot.cashBalance,
      currentCashBalance: currentSnapshot.cashBalance,
      totalDifference,
      expenseTotal,
      transferTotal,
      reconciledTotal,
      unexplainedDifference
    });
  }

  return history;
}

function renderBankReconciliation() {
  const bank = getBankReconciliation();
  const startSnapshot = getStartingSnapshot();
  const snapshots = getSnapshotsForMonth();
  const latestSnapshot = snapshots.length ? snapshots[snapshots.length - 1] : null;

  if (hasElement("#startOfMonthBalanceDisplay")) {
    document.querySelector("#startOfMonthBalanceDisplay").textContent = startSnapshot
      ? `${startSnapshot.accountName || "Conta sem nome"} | ${formatCurrency(startSnapshot.bankBalance)} banco | ${formatCurrency(startSnapshot.cashBalance)} carteira`
      : "Falta guardar 01/04";
    document.querySelector("#latestSnapshotDisplay").textContent = latestSnapshot
      ? `Dia ${latestSnapshot.day} | ${latestSnapshot.accountName || "Conta sem nome"}`
      : "Sem registo";
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

  const tolerance = 0.01;
  const status = document.querySelector("#bankStatus");

  if (status) {
    if (!bank.hasSnapshots || !startSnapshot) {
      status.textContent =
        "Primeiro guarda o ponto de partida de 01/04. Depois, cada nova analise compara a entrada anterior com a atual.";
      return;
    }

    if (Math.abs(bank.unexplainedDifference) <= tolerance) {
      status.textContent =
        `Os valores batem certo entre o dia ${bank.previousDay} e o dia ${bank.currentDay}.`;
      return;
    }

    if (bank.unexplainedDifference > 0) {
      status.textContent =
        `Faltam justificar ${formatCurrency(bank.unexplainedDifference)} entre a ultima entrada e a entrada atual.`;
      return;
    }

    status.textContent =
      `Tens ${formatCurrency(Math.abs(bank.unexplainedDifference))} registados a mais entre despesas e depositos.`;
  }
}

function renderAccounts() {
  const container = document.querySelector("#accountsList");
  if (!container) {
    return;
  }
  container.innerHTML = "";

  if (!state.accounts.length) {
    container.className = "item-list item-list-container empty-state";
    container.textContent = "Ainda nao existem contas registadas.";
    return;
  }

  container.className = "item-list item-list-container";
  const snapshots = getMonthSnapshotsRaw();
  const latestSnapshotByAccount = new Map();

  snapshots.forEach((snapshot) => {
    if (!snapshot.accountId) {
      return;
    }
    latestSnapshotByAccount.set(snapshot.accountId, snapshot);
  });

  state.accounts.forEach((account) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const latestSnapshot = latestSnapshotByAccount.get(account.id);
    const value = latestSnapshot ? latestSnapshot.bankBalance : account.balance;
    node.querySelector(".item-title").textContent = account.name;
    node.querySelector(".item-subtitle").textContent = latestSnapshot
      ? `${account.type} | Atualizado pelo registo do dia ${latestSnapshot.day}`
      : `${account.type} | Saldo atual`;
    node.querySelector(".item-value").textContent = formatCurrency(value);
    node.querySelector(".ghost-btn").addEventListener("click", () => {
      state.accounts = state.accounts.filter((item) => item.id !== account.id);
      saveState();
      render();
    });
    container.appendChild(node);
  });
}

function renderRecurring() {
  const masterContainer = document.querySelector("#recurringList");
  const monthlyContainer = document.querySelector("#fixedExpensesList");
  
  const { month } = getActiveMonthParts();
  const monthsNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const freqLabels = { monthly: "Mensal", "semi-annual": "Semestral", annual: "Anual" };

  // 1. Renderizar Lista Mestre (Configuração)
  if (masterContainer) {
    masterContainer.innerHTML = "";
    if (state.recurringFixed.length === 0) {
      masterContainer.className = "item-list item-list-container empty-state";
      masterContainer.textContent = "Não há despesas fixas globais configuradas.";
    } else {
      masterContainer.className = "item-list item-list-container";
      state.recurringFixed.forEach((item) => {
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector(".item-title").textContent = item.name;
        
        let subtitle = `Dia ${item.day} · ${freqLabels[item.frequency] || "Mensal"}`;
        if (item.frequency && item.frequency !== 'monthly') {
            subtitle += ` · Mês ref: ${monthsNames[(item.startMonth || 1) - 1]}`;
        }
        
        node.querySelector(".item-subtitle").textContent = subtitle;
        node.querySelector(".item-value").textContent = formatCurrency(item.amount);
        node.querySelector(".ghost-btn").addEventListener("click", () => {
          state.recurringFixed = state.recurringFixed.filter((e) => e.id !== item.id);
          saveState();
          render();
        });
        masterContainer.appendChild(node);
      });
    }
  }

  // 2. Renderizar Ocorrências Reais (Registos - index.html)
  if (monthlyContainer) {
    monthlyContainer.innerHTML = "";
    
    const allFixed = state.recurringFixed;
    if (allFixed.length === 0) {
      monthlyContainer.className = "item-list item-list-container empty-state";
      monthlyContainer.textContent = "Não existem despesas fixas configuradas.";
    } else {
      monthlyContainer.className = "item-list item-list-container";
      allFixed.forEach((item) => {
        const sm = Number(item.startMonth) || 1;
        const isCurrentPayment = (!item.frequency || item.frequency === 'monthly') ||
           (item.frequency === 'annual' && month === sm) ||
           (item.frequency === 'semi-annual' && (month === sm || month === (sm + 6 > 12 ? sm - 6 : sm + 6)));
           
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector(".item-title").textContent = item.name;
        
        if (isCurrentPayment) {
          node.querySelector(".item-subtitle").textContent = `Obrigação Real (Dia ${item.day})`;
          node.querySelector(".item-value").textContent = formatCurrency(item.amount);
        } else {
          // Provisionamento
          const prov = item.frequency === 'annual' ? item.amount / 12 : item.amount / 6;
          node.querySelector(".item-subtitle").textContent = `Provisão Mensal (${freqLabels[item.frequency] || "Variável"})`;
          node.querySelector(".item-value").textContent = formatCurrency(prov);
          node.style.opacity = "0.7";
          node.style.fontStyle = "italic";
        }

        node.querySelector(".ghost-btn").style.display = "none";
        monthlyContainer.appendChild(node);
      });
    }
  }
}

function renderReceivables() {
  const container = document.querySelector("#receivablesList");
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const receivables = state.receivables
    .slice()
    .sort((a, b) => (a.dateLabel || "").localeCompare(b.dateLabel || ""));
  const pendingTotal = receivables
    .filter((item) => item.status !== "received")
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const receivedTotal = receivables
    .filter((item) => item.status === "received")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  if (hasElement("#receivablePendingTotal")) {
    document.querySelector("#receivablePendingTotal").textContent = formatCurrency(pendingTotal);
  }
  if (hasElement("#receivableReceivedTotal")) {
    document.querySelector("#receivableReceivedTotal").textContent = formatCurrency(receivedTotal);
  }

  if (!receivables.length) {
    container.className = "item-list item-list-container empty-state";
    container.textContent = "Ainda nao existem valores em aberto registados.";
    return;
  }

  container.className = "item-list item-list-container";

  receivables.forEach((receivable) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const isReceived = receivable.status === "received";
    const statusLabel = isReceived ? "Recebido" : "Por receber";
    
    node.querySelector(".item-title").textContent = receivable.name;
    node.querySelector(".item-subtitle").textContent =
      `${statusLabel} | ${receivable.dateLabel || "Sem data"}`;
    node.querySelector(".item-value").textContent = formatCurrency(receivable.amount);
    
    if (isReceived) {
      node.style.opacity = "0.6";
      node.querySelector(".item-title").style.textDecoration = "line-through";
    }

    const actionWrap = node.querySelector(".item-actions");
    const removeButton = node.querySelector(".ghost-btn");
    
    // Botão Recebido (Ação rápida)
    if (!isReceived) {
      const receiveBtn = document.createElement("button");
      receiveBtn.type = "button";
      receiveBtn.className = "success-btn";
      receiveBtn.textContent = "Recebido -S&";
      receiveBtn.title = "Marcar como recebido e injetar no orçamento";
      receiveBtn.addEventListener("click", () => {
        receivable.status = "received";
        
        // Injeção Automática de Rendimento (Anulação de Despesa)
        const hasIncome = state.incomes.find(i => i.linkedReceivableId === receivable.id);
        if (!hasIncome) {
           const injection = {
               id: generateUUID(), 
               monthKey: getMonthKey(),
               name: `Reembolso: ${receivable.name}`,
               amount: receivable.amount,
               day: Math.min(getToday().getDate(), getCycleWindow().daysInCycle),
               dateLabel: getDefaultMonthDate(Math.min(getToday().getDate(), getCycleWindow().daysInCycle)),
               linkedReceivableId: receivable.id
           };
           state.incomes.push(injection);
           showToast("Reembolso registado como rendimento extra! O teu orçamento foi atualizado.");
        }
        
        saveState();
        render();
      });
      actionWrap.insertBefore(receiveBtn, removeButton);
    }

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "ghost-btn";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => {
      receivableForm.dataset.editingId = receivable.id;
      document.querySelector("#receivableName").value = receivable.name;
      document.querySelector("#receivableAmount").value = receivable.amount;
      document.querySelector("#receivableDate").value = receivable.dateLabel || getDefaultMonthDate();
      document.querySelector("#receivableStatus").value = receivable.status || "pending";
      setStatus("#receivableStatusText", `A editar o valor em aberto de ${receivable.name}.`);
    });
    actionWrap.insertBefore(editButton, removeButton);
    
    removeButton.addEventListener("click", () => {
      state.receivables = state.receivables.filter((item) => item.id !== receivable.id);
      // Limpar injeção se for removido? Geralmente sim se for erro de registo
      state.incomes = state.incomes.filter(i => i.linkedReceivableId !== receivable.id);
      saveState();
      render();
      setStatus("#receivableStatusText", `Registo de ${receivable.name} removido.`);
    });
    container.appendChild(node);
  });
}

// Retorna um filtro de mês de acordo com o período ativo na UI
function getPeriodMonthKeys() {
  const today = getToday();
  const period = (typeof window !== 'undefined' && window.activePeriodFilter) || 'month';
  const keys = new Set();

  if (period === 'all') {
    // Devolver todos os monthKeys únicos nos dados
    [...state.expenses, ...state.incomes, ...state.transfers].forEach(item => {
      const mk = getItemMonthKey(item);
      if (mk) keys.add(mk);
    });
    return [...keys];
  }

  const monthsBack = period === 'quarter' ? 3 : 1;
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  keys.add(getMonthKey());
  return [...keys];
}

function renderExpenses() {
  const fixedContainer = document.querySelector("#fixedExpensesList");
  const variableContainer = document.querySelector("#expensesList");
  
  if (fixedContainer) fixedContainer.innerHTML = "";
  if (variableContainer) variableContainer.innerHTML = "";

  const normalize = k => k.split('-').map(p => p.padStart(2, '0')).join('-');
  const activePeriodKeys = getPeriodMonthKeys().map(normalize);

  const allMonthExpenses = state.expenses
    .filter((expense) => activePeriodKeys.includes(normalize(getItemMonthKey(expense))))
    .sort((a, b) => (getItemMonthKey(b) + String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a) + String(a.day).padStart(2,'0')));

  if (allMonthExpenses.length === 0) {
    if (variableContainer) {
      variableContainer.className = "item-list item-list-container empty-state";
      variableContainer.textContent = "Ainda não existem despesas registadas para este mês.";
    }
    return;
  }

  allMonthExpenses.forEach((expense) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = expense.name;
    node.querySelector(".item-subtitle").textContent = `${expense.category || "Geral"} | Dia ${expense.day}`;
    node.querySelector(".item-value").textContent = formatCurrency(expense.amount);

    node.querySelector(".ghost-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      state.expenses = state.expenses.filter((item) => item.id !== expense.id);
      saveState();
      render();
    });

    node.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") return;
      expenseForm.dataset.editingId = expense.id;
      document.querySelector("#expenseName").value = expense.name;
      document.querySelector("#expenseAmount").value = expense.amount;
      document.querySelector("#expenseCategory").value = expense.category || "";
      document.querySelector("#expenseDate").value = expense.dateLabel || getDefaultMonthDate(expense.day);
      if (document.querySelector("#expenseKind")) {
          document.querySelector("#expenseKind").value = expense.kind || "variable";
      }
      setStatus("#expenseStatus", `A editar ${expense.name}.`);
    });

    // Distribuir para o contentor correto baseado no tipo
    if (expense.kind === "fixed" && fixedContainer) {
        fixedContainer.className = "item-list item-list-container";
        fixedContainer.appendChild(node);
    } else if (variableContainer) {
        variableContainer.className = "item-list item-list-container";
        variableContainer.appendChild(node);
    }
  });
}



function renderCategories() {
  const container = document.querySelector("#categoryList");
  if (!container) {
    return;
  }
  container.innerHTML = "";

  if (!state.categories.length) {
    container.className = "item-list item-list-container empty-state";
    container.textContent = "Ainda nao existem categorias registadas.";
    return;
  }

  container.className = "item-list item-list-container";

  state.categories.forEach((category) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = category;
    node.querySelector(".item-subtitle").textContent = "Categoria disponivel para despesas";
    node.querySelector(".item-value").textContent = "";
    node.querySelector(".ghost-btn").textContent = "Remover";
    node.querySelector(".ghost-btn").addEventListener("click", () => {
      const isUsed = state.expenses.some((expense) => expense.category === category);
      if (isUsed) {
        setStatus("#categoryStatus", "Nao podes remover uma categoria que ja esta a ser usada em despesas.");
        return;
      }

      state.categories = state.categories.filter((item) => item !== category);
      saveState();
      render();
      setStatus("#categoryStatus", `Categoria ${category} removida.`);
    });
    container.appendChild(node);
  });
}

function renderReconciliationHistory() {
  const container = document.querySelector("#reconciliationHistoryList");
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const history = getReconciliationHistory();

  if (!history.length) {
    container.className = "item-list item-list-container empty-state";
    container.textContent = "Ainda nao existem intervalos suficientes para reconciliar.";
    return;
  }

  container.className = "item-list item-list-container";

  history.forEach((entry) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = `Do dia ${entry.previousDay} ao dia ${entry.currentDay}`;
    node.querySelector(".item-subtitle").textContent =
      `Despesas ${formatCurrency(entry.expenseTotal)} | Depositos ${formatCurrency(entry.transferTotal)} | Dif. ${formatCurrency(entry.totalDifference)}`;
    node.querySelector(".item-value").textContent = formatCurrency(entry.unexplainedDifference);
    node.querySelector(".ghost-btn").remove();
    container.appendChild(node);
  });
}

function renderSnapshots() {
  const container = document.querySelector("#snapshotList");
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const snapshots = getSnapshotsForMonth();

  if (!snapshots.length) {
    container.className = "item-list item-list-container empty-state";
    container.textContent = "Ainda nao existem registos guardados.";
    return;
  }

  container.className = "item-list item-list-container";

  snapshots.forEach((snapshot) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = `Fotografia Global dia ${snapshot.day}`;
    node.querySelector(".item-subtitle").textContent =
      `Todas as contas somadas | Banco ${formatCurrency(snapshot.bankBalance)} | Carteira ${formatCurrency(snapshot.cashBalance)}`;
    node.querySelector(".item-value").textContent = "";
    
    // Add Remove Button
    const btn = node.querySelector(".ghost-btn");
    if(btn) {
      btn.textContent = "Apagar Fotografia";
      btn.addEventListener("click", () => {
         state.snapshots = state.snapshots.filter(s => !(s.monthKey === snapshot.monthKey && s.day === snapshot.day));
         saveState();
         render();
         setStatus("#bankStatus", `Registo Global do dia ${snapshot.day} foi eliminado! O algoritmo foi revertido.`);
      });
    }

    container.appendChild(node);
  });
}

function renderTransfers() {
  const container = document.querySelector("#transfersList");
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const normalize = k => k.split('-').map(p => p.padStart(2, '0')).join('-');
  const activePeriodKeys = getPeriodMonthKeys().map(normalize);
  const transfers = state.transfers
    .slice()
    .filter((transfer) => activePeriodKeys.includes(normalize(getItemMonthKey(transfer))))
    .sort((a, b) => (getItemMonthKey(b) + String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a) + String(a.day).padStart(2,'0')));

  if (!transfers.length) {
    container.className = "item-list item-list-container empty-state";
    container.textContent = "Ainda nao existem depositos registados.";
    return;
  }

  container.className = "item-list item-list-container";

  transfers.forEach((transfer) => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.querySelector(".item-title").textContent = transfer.name;
      node.querySelector(".item-subtitle").textContent =
        `${transfer.accountName || "Conta sem nome"} | Depositado em ${transfer.dateLabel || `dia ${transfer.day}`}`;
      node.querySelector(".item-value").textContent = formatCurrency(transfer.amount);
      node.querySelector(".ghost-btn").addEventListener("click", () => {
        state.transfers = state.transfers.filter((item) => item.id !== transfer.id);
        saveState();
        render();
      });
      container.appendChild(node);
    });
}

function renderIncomes() {
  const container = document.querySelector("#incomesList");
  if (!container) return;
  container.innerHTML = "";
  const normalize = k => k.split('-').map(p => p.padStart(2, '0')).join('-');
  const activePeriodKeys = getPeriodMonthKeys().map(normalize);
  const incomes = state.incomes
    .slice()
    .filter((income) => activePeriodKeys.includes(normalize(getItemMonthKey(income))))
    .sort((a, b) => (getItemMonthKey(b) + String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a) + String(a.day).padStart(2,'0')));

  if (!incomes.length) {
    container.className = "item-list item-list-container empty-state";
    container.textContent = "Ainda nao existem ganhos extra registados.";
    return;
  }
  container.className = "item-list item-list-container";

  incomes.forEach((income) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = income.name;
    node.querySelector(".item-subtitle").textContent = `Ganho registado em ${income.dateLabel || `dia ${income.day}`}`;
    node.querySelector(".item-value").textContent = formatCurrency(income.amount);
    
    const actionWrap = node.querySelector(".item-actions");
    const removeButton = node.querySelector(".ghost-btn");
    
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "ghost-btn";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => {
      incomeForm.dataset.editingId = income.id;
      document.querySelector("#incomeName").value = income.name;
      document.querySelector("#incomeAmount").value = income.amount;
      document.querySelector("#incomeDate").value = income.dateLabel || getDefaultMonthDate(income.day);
      setStatus("#incomeStatus", `A editar o ganho ${income.name}. Guarda para atualizar.`);
    });
    
    actionWrap.insertBefore(editButton, removeButton);
    removeButton.addEventListener("click", () => {
      state.incomes = state.incomes.filter((item) => item.id !== income.id);
      saveState();
      render();
      setStatus("#incomeStatus", `Ganho ${income.name} removido com sucesso.`);
    });
    container.appendChild(node);
  });
}

function renderGoalHint() {
  if (!hasElement("#goalLabel")) {
    return;
  }
  const goal = state.revolutGoal?.trim();
  const goalLabel = document.querySelector("#goalLabel");
  goalLabel.textContent = goal
    ? `Conta Revolut reservada para: ${goal}.`
    : "Conta Revolut pronta para o teu objetivo de poupanca.";
}

function getGlobalAccountsTotal() {
  let total = 0;
  
  // Sum current modern accounts
  state.accounts.forEach(acc => {
     total += (Number(acc.balance) || 0);
  });
  
  // Isolate current physical cash
  let latestCashTotal = 0;
  const allChronological = state.snapshots.slice().sort((a,b) => {
    if(a.monthKey === b.monthKey) return (Number(a.day)||0) - (Number(b.day)||0);
    return String(a.monthKey || "").localeCompare(String(b.monthKey || ""));
  });
  
  if (allChronological.length > 0) {
      const lastSnap = allChronological[allChronological.length - 1];
      const sameDaySnaps = allChronological.filter(s => s.monthKey === lastSnap.monthKey && s.day === lastSnap.day);
      sameDaySnaps.forEach(s => {
         latestCashTotal += (Number(s.cashBalance) || 0);
      });
  }
  
  // If the user has zero modern accounts but has legacy history, fall back to legacy sum to not break the UI before migration
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

function updateAccountBalance(accountId, newBalance) {
  const account = state.accounts.find(a => a.id === accountId);
  if (account) {
    account.balance = newBalance;
  }
}

function renderNetWorth() {
  const el = document.querySelector("#globalNetWorthDisplay");
  if (!el) return;
  const accountsTotal = getGlobalAccountsTotal();
  const receivablesTotal = state.receivables.filter(r => r.status !== "received").reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  el.textContent = formatCurrency(accountsTotal + receivablesTotal);
}

function render() {
  syncForms();
  renderNetWorth();
  renderBankReconciliation();
  renderReconciliationHistory();
  renderSundayHistory();
  renderSummary();
  renderAnalysis();
  renderSnapshots();
  renderCategories();
  renderAccounts();
  renderReceivables();
  renderExpenses();
  renderRecurring();
  renderTransfers();
  renderIncomes();
  renderGoalHint();
}

if (settingsForm) {
  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const monthInput = document.querySelector("#analysisMonthInput");
    if (monthInput) {
      state.analysisMonth = monthInput.value || getActiveMonthKey();
    }
    
    state.salary = Number(document.querySelector("#salary").value) || 0;
    state.revolutShare = Number(document.querySelector("#revolutShare").value) || 0;
    state.xtbShare = Number(document.querySelector("#xtbShare").value) || 0;
    state.revolutGoal = document.querySelector("#revolutGoal").value.trim();

    saveState();
    render();
    setStatus("#settingsStatus", "Rendimento fixo e metas guardadas com sucesso.");
  });
}

if (startForm) {
  startForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const startDate = document.querySelector("#startDate").value;
    const accountId = document.querySelector("#startAccountId").value;
    const account = state.accounts.find((item) => item.id === accountId);
    if (!isCurrentMonthDate(startDate) || getDayFromDateInput(startDate) !== 1) {
      setStatus("#bankStatus", "O ponto de partida tem de ser o dia 1 do mes atual.");
      return;
    }
    if (!account) {
      setStatus("#bankStatus", "Escolhe a conta que vais analisar neste mes.");
      return;
    }

    upsertSnapshot({
      id: generateUUID(),
      monthKey: getMonthKey(),
      day: 1,
      date: startDate,
      accountId: account.id,
      accountName: account.name,
      bankBalance: Number(document.querySelector("#startBankBalance").value) || 0,
      cashBalance: Number(document.querySelector("#startCashBalance").value) || 0
    });
    updateAccountBalance(account.id, Number(document.querySelector("#startBankBalance").value) || 0);

    // Auditoria Ponto 3: Verificar e transitar excedente do mês anterior automaticamente!
    const activeKeyParts = getActiveMonthParts();
    let oldYear = activeKeyParts.year;
    let oldMonth = activeKeyParts.month - 1;
    if (oldMonth === 0) { oldMonth = 12; oldYear -= 1; }
    const oldMonthKey = `${oldYear}-${String(oldMonth).padStart(2, "0")}`;
    
    const oldSnapshots = state.snapshots.filter(s => s.monthKey === oldMonthKey);
    if (oldSnapshots.length > 0) {
        const oldStart = oldSnapshots.find(s => s.day === 1);
        const oldLast = oldSnapshots.slice().sort((a,b) => b.day - a.day)[0];
        
        if (oldStart && oldLast && oldLast.day > 1) {
             const oldBudgetSalary = Number(state.salary) || 0;
             const oldFixed = state.recurringFixed.reduce((sum, exp) => sum + Number(exp.amount), 0);
             const oldIncomes = state.incomes.filter(i => getItemMonthKey(i) === oldMonthKey).reduce((sum, i) => sum + Number(i.amount), 0);
             const oldTransfers = state.transfers.filter(t => getItemMonthKey(t) === oldMonthKey && t.day <= oldLast.day).reduce((sum, t) => sum + Number(t.amount), 0);
             
             const oldTotalBudget = Math.max(oldBudgetSalary + oldIncomes - oldFixed, 0);
             
             const stBank = Number(oldStart.bankBalance) + Number(oldStart.cashBalance);
             const endBank = Number(oldLast.bankBalance) + Number(oldLast.cashBalance);
             
             const grossOutflow = Math.max((stBank - endBank) + oldIncomes, 0);
             const oldFixedUpToLast = state.recurringFixed.filter(f => f.day <= oldLast.day).reduce((sum, f) => sum + Number(f.amount), 0);
             const realSpent = Math.max(grossOutflow - oldFixedUpToLast - oldTransfers, 0);
             
             const oldSurplusToRoll = Math.max(oldTotalBudget - realSpent - oldTransfers, 0);
             
             if (oldSurplusToRoll > 0) {
                 const hasRolloverAlready = state.incomes.find(i => getItemMonthKey(i) === getMonthKey() && i.name.includes("Excedente"));
                 if (!hasRolloverAlready) {
                     state.incomes.push({
                         id: generateUUID(), monthKey: getMonthKey(),
                         name: `Transição Excedente: ${oldMonthKey}`,
                         amount: oldSurplusToRoll,
                         day: 1, dateLabel: startDate
                     });
                     showToast(`Atenção: O excedente esquecido de ${formatCurrency(oldSurplusToRoll)} do mês transato foi transferido como bónus!`);
                 }
             }
        }
    }

    saveState();
    render();
    setStatus("#bankStatus", "Saldo inicial do mes guardado com sucesso.");
  });
}

if (snapshotForm) {
  snapshotForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const snapshotDate = document.querySelector("#snapshotDate").value;
    if (!isCurrentMonthDate(snapshotDate)) {
      setStatus("#bankStatus", "A analise tem de usar uma data do mes atual.");
      return;
    }

    const day = getDayFromDateInput(snapshotDate);
    const monthKey = getMonthKey();
    
    const bankInputs = document.querySelectorAll(".dyn-bank-input");
    const globalCashInput = document.querySelector("#dyn-global-cash-input");
    const globalCashVal = globalCashInput ? (Number(globalCashInput.value) || 0) : 0;
    
    // PURGE all ghosts to prevent duplication and inflation!
    state.snapshots = state.snapshots.filter(s => !(s.monthKey === monthKey && s.day === day));
    
    bankInputs.forEach((bInput, i) => {
        const accId = bInput.getAttribute("data-acc-id");
        const account = state.accounts.find(a => a.id === accId);
        if(!account) return;
        
        const bankVal = Number(bInput.value) || 0;
        const cashVal = i === 0 ? globalCashVal : 0;
        
        const newSnap = {
           id: generateUUID(), monthKey, day, date: snapshotDate,
           accountId: accId, accountName: account.name,
           bankBalance: bankVal, cashBalance: cashVal
        };
        
        state.snapshots.push(newSnap);
        updateAccountBalance(accId, bankVal);
    });

    saveState();
    render();
    setStatus("#bankStatus", `Registo Global do dia ${day} arquivado com sucesso.`);
    setStatus("#snapshotStatus", `Registo do dia ${day} salvo.`);
  });
}

if (categoryForm) {
  categoryForm.addEventListener("submit", (event) => {
    event.preventDefault();

  const categoryName = document.querySelector("#categoryName").value.trim();
  if (!categoryName) {
    setStatus("#categoryStatus", "Escreve um nome para a categoria.");
    return;
  }

  const exists = state.categories.some((category) => category.toLowerCase() === categoryName.toLowerCase());
  if (exists) {
    setStatus("#categoryStatus", "Essa categoria ja existe.");
    return;
  }

  state.categories.push(categoryName);
  state.categories.sort((a, b) => a.localeCompare(b, "pt-PT"));

  categoryForm.reset();
  saveState();
  render();
  document.querySelector("#expenseCategory").value = categoryName;
    setStatus("#categoryStatus", `Categoria ${categoryName} adicionada com sucesso.`);
  });
}

if (accountForm) {
  accountForm.addEventListener("submit", (event) => {
    event.preventDefault();

  state.accounts.push({
    id: generateUUID(),
    name: document.querySelector("#accountName").value.trim(),
    type: document.querySelector("#accountType").value.trim(),
    balance: Number(document.querySelector("#accountBalance").value) || 0
  });

  accountForm.reset();
  saveState();
  render();
    setStatus("#accountStatus", "Conta adicionada com sucesso.");
  });
}

if (receivableForm) {
  receivableForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const editingId = getEditingReceivableId();
    const payload = {
      id: editingId || generateUUID(),
      name: document.querySelector("#receivableName").value.trim(),
      amount: Number(document.querySelector("#receivableAmount").value) || 0,
      dateLabel: document.querySelector("#receivableDate").value,
      status: document.querySelector("#receivableStatus").value
    };

    if (editingId) {
      const index = state.receivables.findIndex((item) => item.id === editingId);
      if (index >= 0) {
        state.receivables[index] = { ...state.receivables[index], ...payload };
      }
    } else {
      state.receivables.push(payload);
    }
    
    // Auditoria Ponto 4: Reintegração Lógica Automática de Empréstimos
    if (payload.status === "received") {
       const hasIncome = state.incomes.find(i => i.linkedReceivableId === payload.id);
       if (!hasIncome) {
           const injection = {
               id: generateUUID(), monthKey: getMonthKey(),
               name: `Retorno de Empréstimo: ${payload.name}`,
               amount: payload.amount,
               day: Math.min(getToday().getDate(), getCycleWindow().daysInCycle),
               dateLabel: getDefaultMonthDate(Math.min(getToday().getDate(), getCycleWindow().daysInCycle)),
               linkedReceivableId: payload.id
           };
           state.incomes.push(injection);
           showToast("Ganho extra injetado na matemática orçamental graças ao encerramento deste valor por receber!");
       }
    } else {
       state.incomes = state.incomes.filter(i => i.linkedReceivableId !== payload.id);
    }

    clearReceivableEditing();
    saveState();
    render();
    setStatus(
      "#receivableStatusText",
      editingId
        ? "Valor em aberto atualizado com sucesso."
        : "Valor em aberto registado com sucesso."
    );
  });
}

if (expenseForm) {
  // Listener para mostrar/esconder frequência e ajustar layout
  const kindSelect = document.querySelector("#expenseKind");
  const freqSelect = document.querySelector("#expenseFrequency");
  
  if (kindSelect && freqSelect) {
    kindSelect.addEventListener("change", () => {
      const isFixed = kindSelect.value === "fixed";
      freqSelect.style.display = isFixed ? "block" : "none";
      expenseForm.className = isFixed ? "inline-form inline-form-5" : "inline-form inline-form-4";
    });
    
    freqSelect.addEventListener("change", () => {
      const freq = freqSelect.value;
      const dateInput = document.querySelector("#expenseDate");
      if (!dateInput || !dateInput.value) return;
      const currentVal = new Date(dateInput.value);
      if (isNaN(currentVal.getTime())) return;
      
      if (freq === "annual") {
        currentVal.setFullYear(currentVal.getFullYear() + 1);
        dateInput.value = currentVal.toISOString().split('T')[0];
        showToast("Data ajustada para o próximo ano conforme periodicidade anual.");
      } else if (freq === "semi-annual") {
        currentVal.setMonth(currentVal.getMonth() + 6);
        dateInput.value = currentVal.toISOString().split('T')[0];
        showToast("Data ajustada para daqui a 6 meses.");
      }
    });
  }

  // Lógica de Partilha Multinível
  const splitSelect = document.querySelector("#expenseSplit");
  const splitContainer = document.querySelector("#splitContainer");
  const splitList = document.querySelector("#splitList");
  const addSplitBtn = document.querySelector("#addSplitPerson");
  const distSplitBtn = document.querySelector("#distributeSplit");
  const splitIncludeMe = document.querySelector("#splitIncludeMe");

  function createSplitRow() {
    const row = document.createElement("div");
    row.className = "split-row";
    row.innerHTML = `
      <input type="text" class="split-name" placeholder="Quem deve?">
      <input type="number" class="split-amount" min="0" step="0.01" placeholder="Quanto?">
      <span class="remove-split">&times;</span>
    `;
    row.querySelector(".remove-split").onclick = () => row.remove();
    return row;
  }

  if (splitSelect && splitContainer) {
    splitSelect.addEventListener("change", () => {
      const isSplit = splitSelect.value === "yes";
      splitContainer.style.display = isSplit ? "block" : "none";
      if (isSplit && splitList.children.length === 0) {
        splitList.appendChild(createSplitRow());
      }
    });

    addSplitBtn.onclick = () => splitList.appendChild(createSplitRow());

    distSplitBtn.onclick = () => {
      const totalAmount = Number(document.querySelector("#expenseAmount").value) || 0;
      const rows = splitList.querySelectorAll(".split-row");
      const personCount = rows.length;
      if (personCount === 0 || totalAmount <= 0) return;

      const includeMe = splitIncludeMe?.checked;
      const divisor = includeMe ? personCount + 1 : personCount;
      const part = (totalAmount / divisor).toFixed(2);

      rows.forEach(row => {
        row.querySelector(".split-amount").value = part;
      });
      showToast(`Divisão de ${part}- - aplicada a ${personCount} pessoas.`);
    };
  }

  expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const expenseDate = document.querySelector("#expenseDate").value;
    const kind = document.querySelector("#expenseKind")?.value || "variable";
    const frequency = document.querySelector("#expenseFrequency")?.value || "monthly";
    const name = document.querySelector("#expenseName").value.trim();
    const amount = Number(document.querySelector("#expenseAmount").value) || 0;
    
    // Capturar múltiplas partilhas
    const isSplit = splitSelect?.value === "yes";
    const splits = [];
    let splitTotalSum = 0;

    if (isSplit) {
      const rows = splitList.querySelectorAll(".split-row");
      rows.forEach(row => {
        const pName = row.querySelector(".split-name").value.trim();
        const pAmount = Number(row.querySelector(".split-amount").value) || 0;
        if (pName && pAmount > 0) {
          splits.push({ name: pName, amount: pAmount });
          splitTotalSum += pAmount;
        }
      });

      if (splits.length === 0) {
        setStatus("#expenseStatus", "Adiciona pelo menos uma pessoa para dividir.");
        return;
      }
      if (splitTotalSum > amount) {
        setStatus("#expenseStatus", `ERRO: A soma das partilhas (${splitTotalSum.toFixed(2)}- -) é maior que o total (${amount.toFixed(2)}- -)!`);
        return;
      }
    }

    const isFutureAllowed = kind === "fixed" && (frequency === "annual" || frequency === "semi-annual");
    if (!isFutureAllowed && !isCurrentMonthDate(expenseDate)) {
      setStatus("#expenseStatus", "A despesa tem de estar dentro do mês atual ou ser uma obrigação futura (Anual/Semestral).");
      return;
    }

    const editingId = getEditingExpenseId();
    const day = getDayFromDateInput(expenseDate) || 1;
    const dateObj = new Date(expenseDate);
    const startMonth = dateObj.getMonth() + 1;

    if (kind === "fixed") {
      state.recurringFixed.push({
        id: generateUUID(), name, amount, day, frequency, startMonth
      });
      setStatus("#expenseStatus", `Obrigação "${name}" (${frequency}) integrada.`);
      expenseForm.reset();
      if (freqSelect) freqSelect.style.display = "none";
      if (splitContainer) splitContainer.style.display = "none";
      if (splitList) splitList.innerHTML = "";
    } else {
      const expensePayload = {
        id: editingId || generateUUID(),
        name, amount, day, monthKey: getMonthKey(),
        dateLabel: expenseDate,
        category: document.querySelector("#expenseCategory").value,
        kind
      };

      if (editingId) {
        const idx = state.expenses.findIndex((e) => e.id === editingId);
        if (idx >= 0) state.expenses[idx] = expensePayload;
      } else {
        state.expenses.push(expensePayload);
      }
      
      // Criar múltiplos recebíveis se houver partilha
      if (isSplit && !editingId) {
          splits.forEach(s => {
              state.receivables.push({
                  id: generateUUID(),
                  name: `Reembolso: ${name} (${s.name})`,
                  amount: s.amount,
                  dateLabel: expenseDate,
                  status: "pending",
                  linkedExpenseId: expensePayload.id
              });
          });
          showToast(`Despesa guardada e ${splits.length} dívidas registadas!`);
      }

      expenseForm.reset();
      if (splitContainer) splitContainer.style.display = "none";
      if (splitList) splitList.innerHTML = "";
      setStatus("#expenseStatus", editingId ? "Despesa atualizada." : "Despesa registada.");
    }
    
    saveState();
    render();
    if (expenseForm) expenseForm.removeAttribute("data-editing-id");
  });
}

if (incomeForm) {
  incomeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const incomeDate = document.querySelector("#incomeDate").value;
    const editingId = incomeForm.dataset.editingId;
    const name = document.querySelector("#incomeName").value.trim();
    const amount = Number(document.querySelector("#incomeAmount").value) || 0;
    const day = getDayFromDateInput(incomeDate) || 1;

    const payload = {
      id: editingId || generateUUID(),
      name,
      amount,
      day,
      monthKey: getMonthKey(),
      dateLabel: incomeDate
    };

    if (editingId) {
      const idx = state.incomes.findIndex((i) => i.id === editingId);
      if (idx >= 0) state.incomes[idx] = payload;
    } else {
      state.incomes.push(payload);
    }

    incomeForm.reset();
    delete incomeForm.dataset.editingId;
    saveState();
    render();
    setStatus("#incomeStatus", editingId ? "Ganho atualizado." : "Ganho registado.");
  });
}

if (recurringForm) {
  recurringForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = document.querySelector("#recurringName").value.trim();
    const amount = Number(document.querySelector("#recurringAmount").value) || 0;
    const day = Number(document.querySelector("#recurringDay").value) || 1;
    const frequency = document.querySelector("#recurringFrequency")?.value || "monthly";
    const startMonth = Number(document.querySelector("#recurringStartMonth")?.value) || 1;

    state.recurringFixed.push({
      id: generateUUID(),
      name,
      amount,
      day,
      frequency,
      startMonth
    });

    recurringForm.reset();
    saveState();
    render();
    setStatus("#recurringStatus", `Obrigação "${name}" (${frequency}) integrada no fluxo orçamental.`);
  });
}

// ==========================================
// CONSULTORIA FINANCEIRA: SOBERANIA E KPIs
// ==========================================

function exportState() {
  const dataStr = JSON.stringify(state, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  const stamp = new Date().toISOString().split('T')[0];
  link.download = `backup-financeiro-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Backup exportado com sucesso!");
}

function importState(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      // Validação flexível: deve ter pelo menos accounts ou expenses
      if (!imported.expenses && !imported.accounts) throw new Error("Ficheiro JSON não parece ser um backup válido deste sistema.");
      
      if (confirm("Tens a certeza? Isto irá substituir todos os teus dados atuais e recarregar a página com o backup escolhido.")) {
        // 1. Guardar os novos dados
        localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
        
        // 2. Marcar como a versão mais recente para o Firebase não a sobrepor
        // Definimos o last_firebase_sync para AGORA, assim a Cloud (que é antiga) não ganha
        localStorage.setItem('last_firebase_sync', Date.now());
        
        // 3. Recarregar
        location.reload();
      }
    } catch (err) {
      alert("Erro ao importar backup: " + err.message);
    }
  };
  reader.readAsText(file);
}

// Configuração de botões de Soberania
document.addEventListener('click', (e) => {
    if (e.target.id === 'exportBackupBtn') exportState();
    if (e.target.id === 'importBackupBtn') {
        const input = document.getElementById('importFile');
        if (input) input.click();
    }
});

document.addEventListener('change', (e) => {
    if (e.target.id === 'importFile') importState(e);
});

// - -- - Auto-Preencher Saldo Inicial - -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -
// Definido como função normal -  chamado após o state ser inicializado
function initAutofillBanner() {
  if (typeof document === 'undefined') return;
  const banner = document.getElementById('autofillBanner');
  const btn = document.getElementById('autofillBtn');
  const desc = document.getElementById('autofillDesc');
  if (!banner || !btn || typeof banner.tagName === 'undefined') return;

  const prev = typeof getPreviousMonthLastBalance === 'function'
    ? getPreviousMonthLastBalance()
    : null;

  const hasCurrentStart = getStartingSnapshot && getStartingSnapshot();
  if (prev && !hasCurrentStart) {
    banner.style.display = 'flex';
    const fmt = typeof formatCurrency === 'function' ? formatCurrency : v => v.toFixed(2) + 'EUR';
    const totalBank = Object.values(prev.accountTotals).reduce((s, v) => s + v, 0);
    if (desc) {
      desc.textContent = `Saldo final de ${prev.monthKey}: ${fmt(totalBank)} banco + ${fmt(prev.totalCash)} carteira. Usar como ponto de partida?`;
    }
    btn.addEventListener('click', () => {
      const accountIds = Object.keys(prev.accountTotals);
      const firstAccId = accountIds[0];
      const bankVal = prev.accountTotals[firstAccId] || 0;
      const bankInput = document.getElementById('startBankBalance');
      const cashInput = document.getElementById('startCashBalance');
      const accSelect = document.getElementById('startAccountId');
      const dateInput = document.getElementById('startDate');
      if (bankInput) bankInput.value = bankVal;
      if (cashInput) cashInput.value = prev.totalCash || 0;
      if (accSelect && firstAccId) accSelect.value = firstAccId;
      if (dateInput) dateInput.value = getDefaultMonthDate(1);
      banner.style.display = 'none';
      showToast('Campos pre-preenchidos com o saldo de ' + prev.monthKey + '. Confirma e guarda!');
    });
  }
}


// KPI: Taxa de Poupança (Savings Rate)
function calculateSavingsRate() {
  const budget = calculateBudget();
  const incomeTotal = (Number(state.salary) || 0) + sumIncomes();
  const totalSaved = sumTransfers() + budget.leftover;
  if (incomeTotal <= 0) return 0;
  return Math.min(Math.max((totalSaved / incomeTotal) * 100, 0), 100);
}

// KPI: Autonomia Financeira (Financial Runway)
// Calcula quantos meses consegues sobreviver sem rendimento com o teu património atual
function calculateFinancialRunway() {
  const netWorth = getGlobalAccountsTotal();
  const budget = calculateBudget();
  // Custo mensal real = fixas + média de variáveis (se não houver variáveis usa só fixas)
  const monthlyFixed = budget.fixedExpenses;
  const monthlyVariable = budget.variableExpenses;
  const monthlyCost = monthlyFixed + monthlyVariable;

  if (monthlyCost <= 0) {
    // Sem despesas registadas, usar salário como proxy do custo de vida
    const salaryCost = Number(state.salary) || 0;
    if (salaryCost <= 0) return null; // impossível calcular
    return { months: netWorth / salaryCost, monthlyCost: salaryCost, netWorth };
  }

  return { months: netWorth / monthlyCost, monthlyCost, netWorth };
}

// KPI: Fundo de Emergência (meta configurável, default 6 meses)
function calculateEmergencyFundProgress(targetMonths = 6) {
  const runway = calculateFinancialRunway();
  if (!runway) return { pct: 0, months: 0, target: targetMonths, ok: false };
  const pct = Math.min((runway.months / targetMonths) * 100, 100);
  return { pct, months: runway.months, target: targetMonths, ok: runway.months >= targetMonths };
}

// Alerta de Fuga de Capital (Leakage)
function getLeakageStatus() {
  const analysis = getCycleAnalysis();
  if (!analysis.hasProgressSnapshot) return null;
  const gap = analysis.movementGap;
  const absGap = Math.abs(gap);
  if (absGap <= 0.01) return { type: 'success', message: 'Contas batem certo.' };
  if (gap > 0) return { type: 'warning', message: `Fuga de Capital: ${formatCurrency(absGap)} por registar.` };
  return { type: 'info', message: `Excesso Registado: ${formatCurrency(absGap)} a mais face ao saldo.` };
}

// Auto-preenchimento do Saldo Inicial: vai buscar o último saldo do mês anterior
function getPreviousMonthLastBalance() {
  const parts = getActiveMonthParts();
  let prevYear = parts.year;
  let prevMonth = parts.month - 1;
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
  const prevKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  
  const prevSnaps = state.snapshots.filter(s => s.monthKey === prevKey);
  if (!prevSnaps.length) return null;
  
  // Agrupados por dia (multi-conta)
  const byDay = {};
  prevSnaps.forEach(s => {
    if (!byDay[s.day]) byDay[s.day] = [];
    byDay[s.day].push(s);
  });
  const lastDay = Math.max(...Object.keys(byDay).map(Number));
  const lastSnaps = byDay[lastDay];
  
  // Totais por conta
  const accountTotals = {};
  let totalCash = 0;
  lastSnaps.forEach(s => {
    accountTotals[s.accountId || 'legacy'] = Number(s.bankBalance) || 0;
    totalCash += Number(s.cashBalance) || 0;
  });
  
  return { accountTotals, totalCash, day: lastDay, monthKey: prevKey };
}

// -"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"-
// INICIALIZA-!ÒO GLOBAL E ARRANQUE DA APLICA-!ÒO
// -"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"--"-

function renderGlobalExtract() {
  const container = document.querySelector("#extractTableBody");
  if (!container) return;

  const filter = window.activeExtractFilter || 'all';
  
  // Unificar dados
  const timeline = [];
  
  state.incomes.forEach(i => timeline.push({ ...i, type: 'income', typeLabel: 'Entrada' }));
  state.expenses.forEach(e => timeline.push({ ...e, type: e.kind === 'fixed' ? 'fixed' : 'variable', typeLabel: e.kind === 'fixed' ? 'Fixa' : 'Variável' }));
  state.transfers.forEach(t => timeline.push({ ...t, type: 'transfer', typeLabel: 'Transferência' }));

  // Ordenar cronologicamente ASC para cálculo do saldo
  timeline.sort((a, b) => {
    const keyA = (getItemMonthKey(a) || "0000-00") + String(a.day || 0).padStart(2, "0");
    const keyB = (getItemMonthKey(b) || "0000-00") + String(b.day || 0).padStart(2, "0");
    return keyA.localeCompare(keyB);
  });

  // Cálculo de saldo acumulado (Variação líquida acumulada)
  let runningBalance = 0;
  const processed = timeline.map(item => {
    const amount = Number(item.amount) || 0;
    if (item.type === 'income') runningBalance += amount;
    else runningBalance -= amount;
    return { ...item, runningBalance };
  });

  // Re-ordenar para mostrar mais RECENTES primeiro
  processed.reverse();

  // Filtrar
  const filtered = processed.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'income') return r.type === 'income';
    if (filter === 'variable') return (r.type === 'variable' || r.type === 'fixed');
    if (filter === 'transfer') return r.type === 'transfer';
    return true;
  });

  container.innerHTML = "";
  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted); font-style: italic;">Nenhum registo encontrado para este filtro.</td></tr>`;
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement("tr");
    const amountClass = item.type === 'income' ? 'badge-income' : (item.type === 'transfer' ? 'badge-transfer' : 'badge-expense');
    const amountPrefix = item.type === 'income' ? '+' : '-';
    
    tr.innerHTML = `
      <td>${getItemMonthKey(item)}-${String(item.day).padStart(2, "0")}</td>
      <td><strong>${item.name}</strong></td>
      <td><span class="radar-badge">${item.category || "Geral"}</span></td>
      <td><span class="${amountClass}">${item.typeLabel}</span></td>
      <td class="text-right ${amountClass}">${amountPrefix}${formatCurrency(item.amount)}</td>
      <td class="text-right"><strong>${formatCurrency(item.runningBalance)}</strong></td>
    `;
    container.appendChild(tr);
  });
}

function getGlobalAccountsTotal() {
  let total = 0;
  state.accounts.forEach(acc => {
     total += (Number(acc.balance) || 0);
  });
  
  let latestCashTotal = 0;
  const allChronological = state.snapshots.slice().sort((a,b) => {
    if(a.monthKey === b.monthKey) return (Number(a.day)||0) - (Number(b.day)||0);
    return String(a.monthKey || "").localeCompare(String(b.monthKey || ""));
  });
  
  if (allChronological.length > 0) {
      const lastSnap = allChronological[allChronological.length - 1];
      const sameDaySnaps = allChronological.filter(s => s.monthKey === lastSnap.monthKey && s.day === lastSnap.day);
      sameDaySnaps.forEach(s => {
         latestCashTotal += (Number(s.cashBalance) || 0);
      });
  }
  
  return total + latestCashTotal;
}

const state = loadState();

if (typeof window !== 'undefined') {
  window.state = state;
  window.getMonthKey = getMonthKey;
  window.calculateSavingsRate = calculateSavingsRate;
  window.calculateFinancialRunway = calculateFinancialRunway;
  window.calculateEmergencyFundProgress = calculateEmergencyFundProgress;
  window.getLeakageStatus = getLeakageStatus;
  window.getPreviousMonthLastBalance = getPreviousMonthLastBalance;
  window.formatCurrency = formatCurrency;
  window.getItemMonthKey = getItemMonthKey;
  window.getCycleAnalysis = getCycleAnalysis;
  window.calculateBudget = calculateBudget;
  window.getReconciliationHistory = getReconciliationHistory;
  window.renderGlobalExtract = renderGlobalExtract;
  window.renderNetWorth = renderNetWorth;
  window.importState = importState;
  window.exportState = exportState;
}

if (typeof render === 'function' && typeof document !== 'undefined' && document.querySelector) {
  render();
  initAutofillBanner();
}

function getCalendarSlices() {
  const { year, month } = getActiveMonthParts();
  const daysInMonth = new Date(year, month, 0).getDate();
  const slices = [];
  let currentStart = 1;
  while (currentStart <= daysInMonth) {
    let currentEnd = currentStart + 6;
    if (currentEnd > daysInMonth) { currentEnd = daysInMonth; }
    slices.push({ start: currentStart, end: currentEnd });
    currentStart = currentEnd + 1;
  }
  return slices;
}

// Valor líquido de uma despesa (subtraindo splits/recebíveis associados)
function getNetExpenseAmount(expense) {
  if (!expense) return 0;
  const gross = Number(expense.amount) || 0;
  if (!expense.id) return gross;
  const linkedSplits = state.receivables.filter(r => r.linkedExpenseId === expense.id);
  const splitTotal = linkedSplits.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  return Math.max(0, gross - splitTotal);
}

// Gasto diário (despesas variáveis) para cada dia do mês ativo
function getDailySpendingData() {
  const { year, month } = getActiveMonthParts();
  const daysInMonth = new Date(year, month, 0).getDate();
  const mk = getMonthKey();
  const result = new Array(daysInMonth).fill(0);
  state.expenses.forEach(e => {
    if (getItemMonthKey(e) !== mk || e.kind === 'fixed') return;
    const day = Math.min(Math.max(Number(e.day) || 1, 1), daysInMonth) - 1;
    result[day] += getNetExpenseAmount(e);
  });
  return result;
}

// Gasto flexível (variável + transferências) entre dois dias do mês ativo
function getFlexibleSpentInPeriod(startDay, endDay) {
  return sumExpensesBetween(startDay - 1, endDay) + sumTransfersBetween(startDay - 1, endDay);
}

// Cálculo do estado de obrigações fixas do mês
function calculateObligationsStatus() {
  const totalDueThisMonth = sumFixedMonthlyExpenses();
  const paidAmount = sumFixedExpensesUntil(31);
  const pendingAmount = Math.max(0, totalDueThisMonth - paidAmount);
  const progressPercent = totalDueThisMonth > 0 ? Math.min((paidAmount / totalDueThisMonth) * 100, 100) : 0;
  return { totalProvision: totalDueThisMonth, paidAmount, pendingAmount, progressPercent };
}

// Total gasto de forma real (variáveis + transferências) no mês ativo
function getRealSpentEfficiency() {
  return sumVariableExpenses() + sumTransfers();
}
