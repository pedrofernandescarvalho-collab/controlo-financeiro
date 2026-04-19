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
  // Suporte ao navegador de mês do dashboard (window.dashboardMonthKey)
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


function sumFixedMonthlyExpenses() {
  const monthKey = getActiveMonthKey();
  const { month } = getActiveMonthParts();
  
  return state.recurringFixed
    .filter(rf => {
      // Filtrar por Data de Fim
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
      // Filtrar por Data de Fim
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
  const dailyBudget = disposableMonthlyBudget / Math.max(daysInCycle, 1);
  const weeklyBudget = dailyBudget * 7; // Semana de calendário: 7 dias fixos
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

// Removido sumExpensesUntil duplicado para evitar inconsistências

function sumFixedExpensesUntil(day) {
  const monthKey = getActiveMonthKey();
  const { month } = getActiveMonthParts();
  return state.recurringFixed
    .filter((rf) => {
      // Filtrar por Data de Fim
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
    // Apenas uma conta — retornar diretamente
    return firstDaySnaps[0];
  }
  
  // Múltiplas contas no dia 1 — consolidar numa entrada virtual
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
  
  // Encontrar o último snapshot ATÉ ao dia analisado (targetDay ou hoje)
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
}

function renderNetWorth() {
  const el = document.querySelector("#globalNetWorthDisplay");
  if (!el) return;
  const accountsTotal = getGlobalAccountsTotal();
  const receivablesTotal = state.receivables.filter(r => r.status !== "received").reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  el.textContent = formatCurrency(accountsTotal + receivablesTotal);
}

function renderBankReconciliation() {
  const snapshots = getSnapshotsForMonth();
  if (snapshots.length < 1) {
    if (hasElement("#bankStartBalance")) document.querySelector("#bankStartBalance").textContent = "0,00 EUR";
    if (hasElement("#bankCurrentBalance")) document.querySelector("#bankCurrentBalance").textContent = "0,00 EUR";
    if (hasElement("#bankDifference")) document.querySelector("#bankDifference").textContent = "0,00 EUR";
    return;
  }

  const latestSnap = snapshots[snapshots.length - 1];
  const previousSnap = snapshots.length > 1 ? snapshots[snapshots.length - 2] : getStartingSnapshot();

  const prevBank = previousSnap ? Number(previousSnap.bankBalance) : 0;
  const curBank = Number(latestSnap.bankBalance);
  const diffBank = curBank - prevBank;
  
  const prevCash = previousSnap ? Number(previousSnap.cashBalance) : 0;
  const curCash = Number(latestSnap.cashBalance);
  const diffCash = curCash - prevCash;

  if (hasElement("#bankStartBalance")) document.querySelector("#bankStartBalance").textContent = formatCurrency(prevBank);
  if (hasElement("#bankCurrentBalance")) document.querySelector("#bankCurrentBalance").textContent = formatCurrency(curBank);
  if (hasElement("#cashStartBalance")) document.querySelector("#cashStartBalance").textContent = formatCurrency(prevCash);
  if (hasElement("#cashCurrentBalance")) document.querySelector("#cashCurrentBalance").textContent = formatCurrency(curCash);

  const totalDiff = diffBank + diffCash;
  if (hasElement("#bankDifference")) {
    document.querySelector("#bankDifference").textContent = formatCurrency(totalDiff);
  }

  const startDay = previousSnap ? previousSnap.day : 0;
  const endDay = latestSnap.day;
  
  const expenses = sumExpensesBetween(startDay, endDay);
  const transfers = sumTransfersBetween(startDay, endDay);
  const incomes = sumIncomesBetween(startDay, endDay, true);

  const explained =  incomes - (expenses + transfers);
  const unexplained = totalDiff - explained;

  if (hasElement("#bankExpenseTotal")) document.querySelector("#bankExpenseTotal").textContent = formatCurrency(expenses);
  if (hasElement("#bankTransferTotal")) document.querySelector("#bankTransferTotal").textContent = formatCurrency(transfers);
  if (hasElement("#bankReconciledTotal")) document.querySelector("#bankReconciledTotal").textContent = formatCurrency(explained);
  if (hasElement("#bankUnexplained")) {
    const unEl = document.querySelector("#bankUnexplained");
    unEl.textContent = formatCurrency(unexplained);
    unEl.style.color = Math.abs(unexplained) > 0.01 ? "var(--error)" : "var(--success)";
  }
}

function renderReconciliationHistory() {
  const container = document.querySelector("#reconciliationHistoryList");
  if (!container) return;
  container.innerHTML = "";

  const snapshots = getSnapshotsForMonth();
  if (snapshots.length < 1) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda não existem intervalos suficientes para reconciliar.";
    return;
  }

  const intervals = [];
  for (let i = 0; i < snapshots.length; i++) {
    const current = snapshots[i];
    const previous = i > 0 ? snapshots[i-1] : getStartingSnapshot();
    if (!previous) continue;

    const startDay = previous.day;
    const endDay = current.day;
    
    if (startDay === endDay && i > 0) continue;

    const diffBank = Number(current.bankBalance) - Number(previous.bankBalance);
    const diffCash = Number(current.cashBalance) - Number(previous.cashBalance);
    const totalDiff = diffBank + diffCash;

    const expenses = sumExpensesBetween(startDay, endDay);
    const transfers = sumTransfersBetween(startDay, endDay);
    const incomes = sumIncomesBetween(startDay, endDay, true);
    
    const explained = incomes - (expenses + transfers);
    const unexplained = totalDiff - explained;

    intervals.push({
      label: `De dia ${startDay} até ${endDay}`,
      totalDiff,
      explained,
      unexplained,
      expenses,
      transfers,
      incomes
    });
  }

  if (intervals.length === 0) {
    container.className = "item-list empty-state";
    container.textContent = "Aguardando mais registos globais.";
    return;
  }

  container.className = "item-list";
  intervals.reverse().forEach(interval => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = interval.label;
    node.querySelector(".item-subtitle").innerHTML = 
      `Gasto: ${formatCurrency(interval.expenses)} | Transferido: ${formatCurrency(interval.transfers)} <br>` +
      `<small>Diferença real: ${formatCurrency(interval.totalDiff)} | Justificado: ${formatCurrency(interval.explained)}</small>`;
    
    const valEl = node.querySelector(".item-value");
    valEl.textContent = formatCurrency(interval.unexplained);
    valEl.style.color = Math.abs(interval.unexplained) > 1 ? "var(--error)" : "var(--success)";
    
    node.querySelector(".ghost-btn").remove();
    container.appendChild(node);
  });
}

function renderSummary() {
  const budget = calculateBudget();
  const totals = getCycleAnalysis();

  if (hasElement("#weeklyBudget")) document.querySelector("#weeklyBudget").textContent = formatCurrency(budget.weeklyBudget);
  if (hasElement("#dailyBudget")) document.querySelector("#dailyBudget").textContent = formatCurrency(budget.dailyBudget);
  if (hasElement("#leftoverAmount")) document.querySelector("#leftoverAmount").textContent = formatCurrency(budget.leftover);
  if (hasElement("#revolutInterest")) document.querySelector("#revolutInterest").textContent = formatCurrency(budget.revolutInterest);
  
  if (hasElement("#revolutAllocation")) document.querySelector("#revolutAllocation").textContent = formatCurrency(budget.revolutAllocation);
  if (hasElement("#xtbAllocation")) document.querySelector("#xtbAllocation").textContent = formatCurrency(budget.xtbAllocation);
  
  if (hasElement("#fixedExpenseTotal")) document.querySelector("#fixedExpenseTotal").textContent = formatCurrency(budget.fixedExpensesReal);
  if (hasElement("#variableExpenseTotal")) document.querySelector("#variableExpenseTotal").textContent = formatCurrency(budget.variableExpenses);
  
  const startSnapshot = getStartingSnapshot();
  const startTotal = startSnapshot ? (Number(startSnapshot.bankBalance) + Number(startSnapshot.cashBalance)) : 0;
  if (hasElement("#currentTotalBalance")) document.querySelector("#currentTotalBalance").textContent = formatCurrency(startTotal);
  
  const netWorth = getGlobalAccountsTotal();
  if (hasElement("#netCurrentBalance")) document.querySelector("#netCurrentBalance").textContent = formatCurrency(netWorth);
}

function renderAnalysis() {
  const analysis = getCycleAnalysis();
  
  if (hasElement("#analysisMonth")) document.querySelector("#analysisMonth").textContent = getMonthKey();
  if (hasElement("#analysisDate")) document.querySelector("#analysisDate").textContent = `Dia ${analysis.latestDay}`;
  
  if (hasElement("#shouldHaveSpentToday")) document.querySelector("#shouldHaveSpentToday").textContent = formatCurrency(analysis.expectedSpentToday);
  if (hasElement("#currentWeek")) document.querySelector("#currentWeek").textContent = formatCurrency(analysis.actualSpent);
  
  if (hasElement("#expensesUntilToday")) document.querySelector("#expensesUntilToday").textContent = formatCurrency(analysis.expensesUntilToday);
  if (hasElement("#transfersUntilToday")) document.querySelector("#transfersUntilToday").textContent = formatCurrency(analysis.transfersUntilToday);
  
  if (hasElement("#expectedSpentToday")) document.querySelector("#expectedSpentToday").textContent = formatCurrency(analysis.actualSpent - analysis.expectedSpentToday);
  if (hasElement("#expectedSpentWeek")) document.querySelector("#expectedSpentWeek").textContent = formatCurrency(analysis.expectedSpentWeek);
  if (hasElement("#idealRemaining")) document.querySelector("#idealRemaining").textContent = formatCurrency(analysis.idealRemaining);
  if (hasElement("#availableToSplit")) document.querySelector("#availableToSplit").textContent = formatCurrency(analysis.availableToSplit);
  
  if (hasElement("#splitNowRevolut")) document.querySelector("#splitNowRevolut").textContent = formatCurrency(analysis.splitNowRevolut);
  if (hasElement("#splitNowXtb")) document.querySelector("#splitNowXtb").textContent = formatCurrency(analysis.splitNowXtb);

  const expectedEl = document.querySelector("#expectedSpentToday");
  if (expectedEl) {
     const val = analysis.actualSpent - analysis.expectedSpentToday;
     expectedEl.style.color = val > 0 ? "var(--error)" : "var(--success)";
     expectedEl.textContent = (val > 0 ? "+ " : "") + formatCurrency(val);
  }
}

function renderCategories() {
  const selects = ["#expenseCategory"];
  selects.forEach((id) => {
    const select = document.querySelector(id);
    if (!select) return;
    const current = select.value;
    select.innerHTML = "";
    state.categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
    if (current && state.categories.includes(current)) {
      select.value = current;
    }
  });
}

function renderAccounts() {
  const container = document.querySelector("#accountsList");
  if (!container) return;
  container.innerHTML = "";
  
  if (state.accounts.length === 0) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda não existem contas registadas.";
    return;
  }
  
  container.className = "item-list";
  state.accounts.forEach(acc => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = acc.name;
    node.querySelector(".item-subtitle").textContent = acc.type;
    node.querySelector(".item-value").textContent = formatCurrency(acc.balance);
    
    node.querySelector(".ghost-btn").addEventListener("click", () => {
      state.accounts = state.accounts.filter(a => a.id !== acc.id);
      saveState();
      render();
    });
    container.appendChild(node);
  });
}

function renderSnapshots() {
  const container = document.querySelector("#snapshotList");
  if (!container) return;
  container.innerHTML = "";
  const snapshots = getSnapshotsForMonth();

  if (!snapshots.length) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda nao existem registos guardados.";
    return;
  }

  container.className = "item-list";

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
    .sort((a, b) => (getItemMonthKey(b) + String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a) + String(a.day).padStart(2,'0'))); // DESC: mais recente primeiro

  if (!transfers.length) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda nao existem depositos registados.";
    return;
  }

  container.className = "item-list";

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
    .sort((a, b) => (getItemMonthKey(b) + String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a) + String(a.day).padStart(2,'0'))); // DESC: mais recente primeiro

  if (!incomes.length) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda nao existem ganhos extra registados.";
    return;
  }
  container.className = "item-list";

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
      for (let k in legacyAccountBalances) legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += s.bankBalance) + (Number(s.cashBalance) || 0);
      });
      let legacyTotal = 0;
      for (let k in legacyAccountBalances) legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += legacyTotal += lacyTotal += legacyTotal += legacyTotal += latestCashTotal;
  return total;
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

function renderBankReconciliation() {
  const snapshots = getSnapshotsForMonth();
  if (snapshots.length < 1) {
    if (hasElement("#bankStartBalance")) document.querySelector("#bankStartBalance").textContent = "0,00 EUR";
    if (hasElement("#bankCurrentBalance")) document.querySelector("#bankCurrentBalance").textContent = "0,00 EUR";
    if (hasElement("#bankDifference")) document.querySelector("#bankDifference").textContent = "0,00 EUR";
    return;
  }

  const latestSnap = snapshots[snapshots.length - 1];
  const previousSnap = snapshots.length > 1 ? snapshots[snapshots.length - 2] : getStartingSnapshot();

  const prevBank = previousSnap ? Number(previousSnap.bankBalance) : 0;
  const curBank = Number(latestSnap.bankBalance);
  const diffBank = curBank - prevBank;
  
  const prevCash = previousSnap ? Number(previousSnap.cashBalance) : 0;
  const curCash = Number(latestSnap.cashBalance);
  const diffCash = curCash - prevCash;

  if (hasElement("#bankStartBalance")) document.querySelector("#bankStartBalance").textContent = formatCurrency(prevBank);
  if (hasElement("#bankCurrentBalance")) document.querySelector("#bankCurrentBalance").textContent = formatCurrency(curBank);
  if (hasElement("#cashStartBalance")) document.querySelector("#cashStartBalance").textContent = formatCurrency(prevCash);
  if (hasElement("#cashCurrentBalance")) document.querySelector("#cashCurrentBalance").textContent = formatCurrency(curCash);

  const totalDiff = diffBank + diffCash;
  if (hasElement("#bankDifference")) {
    document.querySelector("#bankDifference").textContent = formatCurrency(totalDiff);
  }

  const startDay = previousSnap ? previousSnap.day : 0;
  const endDay = latestSnap.day;
  
  const expenses = sumExpensesBetween(startDay, endDay);
  const transfers = sumTransfersBetween(startDay, endDay);
  const incomes = sumIncomesBetween(startDay, endDay, true);

  const explained =  incomes - (expenses + transfers);
  const unexplained = totalDiff - explained;

  if (hasElement("#bankExpenseTotal")) document.querySelector("#bankExpenseTotal").textContent = formatCurrency(expenses);
  if (hasElement("#bankTransferTotal")) document.querySelector("#bankTransferTotal").textContent = formatCurrency(transfers);
  if (hasElement("#bankReconciledTotal")) document.querySelector("#bankReconciledTotal").textContent = formatCurrency(explained);
  if (hasElement("#bankUnexplained")) {
    const unEl = document.querySelector("#bankUnexplained");
    unEl.textContent = formatCurrency(unexplained);
    unEl.style.color = Math.abs(unexplained) > 0.01 ? "var(--error)" : "var(--success)";
  }
}

function renderReconciliationHistory() {
  const container = document.querySelector("#reconciliationHistoryList");
  if (!container) return;
  container.innerHTML = "";

  const snapshots = getSnapshotsForMonth();
  if (snapshots.length < 1) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda não existem intervalos suficientes para reconciliar.";
    return;
  }

  const intervals = [];
  for (let i = 0; i < snapshots.length; i++) {
    const current = snapshots[i];
    const previous = i > 0 ? snapshots[i-1] : getStartingSnapshot();
    if (!previous) continue;

    const startDay = previous.day;
    const endDay = current.day;
    
    if (startDay === endDay && i > 0) continue;

    const diffBank = Number(current.bankBalance) - Number(previous.bankBalance);
    const diffCash = Number(current.cashBalance) - Number(previous.cashBalance);
    const totalDiff = diffBank + diffCash;

    const expenses = sumExpensesBetween(startDay, endDay);
    const transfers = sumTransfersBetween(startDay, endDay);
    const incomes = sumIncomesBetween(startDay, endDay, true);
    
    const explained = incomes - (expenses + transfers);
    const unexplained = totalDiff - explained;

    intervals.push({
      label: `De dia ${startDay} até ${endDay}`,
      totalDiff,
      explained,
      unexplained,
      expenses,
      transfers,
      incomes
    });
  }

  if (intervals.length === 0) {
    container.className = "item-list empty-state";
    container.textContent = "Aguardando mais registos globais.";
    return;
  }

  container.className = "item-list";
  intervals.reverse().forEach(interval => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = interval.label;
    node.querySelector(".item-subtitle").innerHTML = 
      `Gasto: ${formatCurrency(interval.expenses)} | Transferido: ${formatCurrency(interval.transfers)} <br>` +
      `<small>Diferença real: ${formatCurrency(interval.totalDiff)} | Justificado: ${formatCurrency(interval.explained)}</small>`;
    
    const valEl = node.querySelector(".item-value");
    valEl.textContent = formatCurrency(interval.unexplained);
    valEl.style.color = Math.abs(interval.unexplained) > 1 ? "var(--error)" : "var(--success)";
    
    node.querySelector(".ghost-btn").remove();
    container.appendChild(node);
  });
}

function renderSummary() {
  const budget = calculateBudget();
  const totals = getCycleAnalysis();

  if (hasElement("#weeklyBudget")) document.querySelector("#weeklyBudget").textContent = formatCurrency(budget.weeklyBudget);
  if (hasElement("#dailyBudget")) document.querySelector("#dailyBudget").textContent = formatCurrency(budget.dailyBudget);
  if (hasElement("#leftoverAmount")) document.querySelector("#leftoverAmount").textContent = formatCurrency(budget.leftover);
  if (hasElement("#revolutInterest")) document.querySelector("#revolutInterest").textContent = formatCurrency(budget.revolutInterest);
  
  if (hasElement("#revolutAllocation")) document.querySelector("#revolutAllocation").textContent = formatCurrency(budget.revolutAllocation);
  if (hasElement("#xtbAllocation")) document.querySelector("#xtbAllocation").textContent = formatCurrency(budget.xtbAllocation);
  
  if (hasElement("#fixedExpenseTotal")) document.querySelector("#fixedExpenseTotal").textContent = formatCurrency(budget.fixedExpensesReal);
  if (hasElement("#variableExpenseTotal")) document.querySelector("#variableExpenseTotal").textContent = formatCurrency(budget.variableExpenses);
  
  const startSnapshot = getStartingSnapshot();
  const startTotal = startSnapshot ? (Number(startSnapshot.bankBalance) + Number(startSnapshot.cashBalance)) : 0;
  if (hasElement("#currentTotalBalance")) document.querySelector("#currentTotalBalance").textContent = formatCurrency(startTotal);
  
  const netWorth = getGlobalAccountsTotal();
  if (hasElement("#netCurrentBalance")) document.querySelector("#netCurrentBalance").textContent = formatCurrency(netWorth);
}

function renderAnalysis() {
  const analysis = getCycleAnalysis();
  
  if (hasElement("#analysisMonth")) document.querySelector("#analysisMonth").textContent = getMonthKey();
  if (hasElement("#analysisDate")) document.querySelector("#analysisDate").textContent = `Dia ${analysis.latestDay}`;
  
  if (hasElement("#shouldHaveSpentToday")) document.querySelector("#shouldHaveSpentToday").textContent = formatCurrency(analysis.expectedSpentToday);
  if (hasElement("#currentWeek")) document.querySelector("#currentWeek").textContent = formatCurrency(analysis.actualSpent);
  
  if (hasElement("#expensesUntilToday")) document.querySelector("#expensesUntilToday").textContent = formatCurrency(analysis.expensesUntilToday);
  if (hasElement("#transfersUntilToday")) document.querySelector("#transfersUntilToday").textContent = formatCurrency(analysis.transfersUntilToday);
  
  if (hasElement("#expectedSpentToday")) document.querySelector("#expectedSpentToday").textContent = formatCurrency(analysis.actualSpent - analysis.expectedSpentToday);
  if (hasElement("#expectedSpentWeek")) document.querySelector("#expectedSpentWeek").textContent = formatCurrency(analysis.expectedSpentWeek);
  if (hasElement("#idealRemaining")) document.querySelector("#idealRemaining").textContent = formatCurrency(analysis.idealRemaining);
  if (hasElement("#availableToSplit")) document.querySelector("#availableToSplit").textContent = formatCurrency(analysis.availableToSplit);
  
  if (hasElement("#splitNowRevolut")) document.querySelector("#splitNowRevolut").textContent = formatCurrency(analysis.splitNowRevolut);
  if (hasElement("#splitNowXtb")) document.querySelector("#splitNowXtb").textContent = formatCurrency(analysis.splitNowXtb);

  const expectedEl = document.querySelector("#expectedSpentToday");
  if (expectedEl) {
     const val = analysis.actualSpent - analysis.expectedSpentToday;
     expectedEl.style.color = val > 0 ? "var(--error)" : "var(--success)";
     expectedEl.textContent = (val > 0 ? "+ " : "") + formatCurrency(val);
  }
}

function renderCategories() {
  const selects = ["#expenseCategory"];
  selects.forEach((id) => {
    const select = document.querySelector(id);
    if (!select) return;
    const current = select.value;
    select.innerHTML = "";
    state.categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
    if (current && state.categories.includes(current)) {
      select.value = current;
    }
  });
}

function renderAccounts() {
  const container = document.querySelector("#accountsList");
  if (!container) return;
  container.innerHTML = "";
  
  if (state.accounts.length === 0) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda não existem contas registadas.";
    return;
  }
  
  container.className = "item-list";
  state.accounts.forEach(acc => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = acc.name;
    node.querySelector(".item-subtitle").textContent = acc.type;
    node.querySelector(".item-value").textContent = formatCurrency(acc.balance);
    
    node.querySelector(".ghost-btn").addEventListener("click", () => {
      state.accounts = state.accounts.filter(a => a.id !== acc.id);
      saveState();
      render();
    });
    container.appendChild(node);
  });
}

function renderSnapshots() {
  const container = document.querySelector("#snapshotList");
  if (!container) return;
  container.innerHTML = "";
  const snapshots = getSnapshotsForMonth();

  if (!snapshots.length) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda nao existem registos guardados.";
    return;
  }

  container.className = "item-list";

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
    .sort((a, b) => (getItemMonthKey(b) + String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a) + String(a.day).padStart(2,'0'))); // DESC: mais recente primeiro

  if (!transfers.length) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda nao existem depositos registados.";
    return;
  }

  container.className = "item-list";

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
    .sort((a, b) => (getItemMonthKey(b) + String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a) + String(a.day).padStart(2,'0'))); // DESC: mais recente primeiro

  if (!incomes.length) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda nao existem ganhos extra registados.";
    return;
  }
  container.className = "item-list";

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

function renderBankReconciliation() {
  const snapshots = getSnapshotsForMonth();
  if (snapshots.length < 1) {
    if (hasElement("#bankStartBalance")) document.querySelector("#bankStartBalance").textContent = "0,00 EUR";
    if (hasElement("#bankCurrentBalance")) document.querySelector("#bankCurrentBalance").textContent = "0,00 EUR";
    if (hasElement("#bankDifference")) document.querySelector("#bankDifference").textContent = "0,00 EUR";
    return;
  }

  const latestSnap = snapshots[snapshots.length - 1];
  const previousSnap = snapshots.length > 1 ? snapshots[snapshots.length - 2] : getStartingSnapshot();

  const prevBank = previousSnap ? Number(previousSnap.bankBalance) : 0;
  const curBank = Number(latestSnap.bankBalance);
  const diffBank = curBank - prevBank;
  
  const prevCash = previousSnap ? Number(previousSnap.cashBalance) : 0;
  const curCash = Number(latestSnap.cashBalance);
  const diffCash = curCash - prevCash;

  if (hasElement("#bankStartBalance")) document.querySelector("#bankStartBalance").textContent = formatCurrency(prevBank);
  if (hasElement("#bankCurrentBalance")) document.querySelector("#bankCurrentBalance").textContent = formatCurrency(curBank);
  if (hasElement("#cashStartBalance")) document.querySelector("#cashStartBalance").textContent = formatCurrency(prevCash);
  if (hasElement("#cashCurrentBalance")) document.querySelector("#cashCurrentBalance").textContent = formatCurrency(curCash);

  const totalDiff = diffBank + diffCash;
  if (hasElement("#bankDifference")) {
    document.querySelector("#bankDifference").textContent = formatCurrency(totalDiff);
  }

  const startDay = previousSnap ? previousSnap.day : 0;
  const endDay = latestSnap.day;
  
  const expenses = sumExpensesBetween(startDay, endDay);
  const transfers = sumTransfersBetween(startDay, endDay);
  const incomes = sumIncomesBetween(startDay, endDay, true);

  const explained =  incomes - (expenses + transfers);
  const unexplained = totalDiff - explained;

  if (hasElement("#bankExpenseTotal")) document.querySelector("#bankExpenseTotal").textContent = formatCurrency(expenses);
  if (hasElement("#bankTransferTotal")) document.querySelector("#bankTransferTotal").textContent = formatCurrency(transfers);
  if (hasElement("#bankReconciledTotal")) document.querySelector("#bankReconciledTotal").textContent = formatCurrency(explained);
  if (hasElement("#bankUnexplained")) {
    const unEl = document.querySelector("#bankUnexplained");
    unEl.textContent = formatCurrency(unexplained);
    unEl.style.color = Math.abs(unexplained) > 0.01 ? "var(--error)" : "var(--success)";
  }
}

function renderReconciliationHistory() {
  const container = document.querySelector("#reconciliationHistoryList");
  if (!container) return;
  container.innerHTML = "";

  const snapshots = getSnapshotsForMonth();
  if (snapshots.length < 1) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda não existem intervalos suficientes para reconciliar.";
    return;
  }

  const intervals = [];
  for (let i = 0; i < snapshots.length; i++) {
    const current = snapshots[i];
    const previous = i > 0 ? snapshots[i-1] : getStartingSnapshot();
    if (!previous) continue;

    const startDay = previous.day;
    const endDay = current.day;
    
    if (startDay === endDay && i > 0) continue;

    const diffBank = Number(current.bankBalance) - Number(previous.bankBalance);
    const diffCash = Number(current.cashBalance) - Number(previous.cashBalance);
    const totalDiff = diffBank + diffCash;

    const expenses = sumExpensesBetween(startDay, endDay);
    const transfers = sumTransfersBetween(startDay, endDay);
    const incomes = sumIncomesBetween(startDay, endDay, true);
    
    const explained = incomes - (expenses + transfers);
    const unexplained = totalDiff - explained;

    intervals.push({
      label: `De dia ${startDay} até ${endDay}`,
      totalDiff,
      explained,
      unexplained,
      expenses,
      transfers,
      incomes
    });
  }

  if (intervals.length === 0) {
    container.className = "item-list empty-state";
    container.textContent = "Aguardando mais registos globais.";
    return;
  }

  container.className = "item-list";
  intervals.reverse().forEach(interval => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = interval.label;
    node.querySelector(".item-subtitle").innerHTML = 
      `Gasto: ${formatCurrency(interval.expenses)} | Transferido: ${formatCurrency(interval.transfers)} <br>` +
      `<small>Diferença real: ${formatCurrency(interval.totalDiff)} | Justificado: ${formatCurrency(interval.explained)}</small>`;
    
    const valEl = node.querySelector(".item-value");
    valEl.textContent = formatCurrency(interval.unexplained);
    valEl.style.color = Math.abs(interval.unexplained) > 1 ? "var(--error)" : "var(--success)";
    
    node.querySelector(".ghost-btn").remove();
    container.appendChild(node);
  });
}

function renderSummary() {
  const budget = calculateBudget();
  const totals = getCycleAnalysis();

  if (hasElement("#weeklyBudget")) document.querySelector("#weeklyBudget").textContent = formatCurrency(budget.weeklyBudget);
  if (hasElement("#dailyBudget")) document.querySelector("#dailyBudget").textContent = formatCurrency(budget.dailyBudget);
  if (hasElement("#leftoverAmount")) document.querySelector("#leftoverAmount").textContent = formatCurrency(budget.leftover);
  if (hasElement("#revolutInterest")) document.querySelector("#revolutInterest").textContent = formatCurrency(budget.revolutInterest);
  
  if (hasElement("#revolutAllocation")) document.querySelector("#revolutAllocation").textContent = formatCurrency(budget.revolutAllocation);
  if (hasElement("#xtbAllocation")) document.querySelector("#xtbAllocation").textContent = formatCurrency(budget.xtbAllocation);
  
  if (hasElement("#fixedExpenseTotal")) document.querySelector("#fixedExpenseTotal").textContent = formatCurrency(budget.fixedExpensesReal);
  if (hasElement("#variableExpenseTotal")) document.querySelector("#variableExpenseTotal").textContent = formatCurrency(budget.variableExpenses);
  
  const startSnapshot = getStartingSnapshot();
  const startTotal = startSnapshot ? (Number(startSnapshot.bankBalance) + Number(startSnapshot.cashBalance)) : 0;
  if (hasElement("#currentTotalBalance")) document.querySelector("#currentTotalBalance").textContent = formatCurrency(startTotal);
  
  const netWorth = getGlobalAccountsTotal();
  if (hasElement("#netCurrentBalance")) document.querySelector("#netCurrentBalance").textContent = formatCurrency(netWorth);
}

function renderAnalysis() {
  const analysis = getCycleAnalysis();
  
  if (hasElement("#analysisMonth")) document.querySelector("#analysisMonth").textContent = getMonthKey();
  if (hasElement("#analysisDate")) document.querySelector("#analysisDate").textContent = `Dia ${analysis.latestDay}`;
  
  if (hasElement("#shouldHaveSpentToday")) document.querySelector("#shouldHaveSpentToday").textContent = formatCurrency(analysis.expectedSpentToday);
  if (hasElement("#currentWeek")) document.querySelector("#currentWeek").textContent = formatCurrency(analysis.actualSpent);
  
  if (hasElement("#expensesUntilToday")) document.querySelector("#expensesUntilToday").textContent = formatCurrency(analysis.expensesUntilToday);
  if (hasElement("#transfersUntilToday")) document.querySelector("#transfersUntilToday").textContent = formatCurrency(analysis.transfersUntilToday);
  
  if (hasElement("#expectedSpentToday")) document.querySelector("#expectedSpentToday").textContent = formatCurrency(analysis.actualSpent - analysis.expectedSpentToday);
  if (hasElement("#expectedSpentWeek")) document.querySelector("#expectedSpentWeek").textContent = formatCurrency(analysis.expectedSpentWeek);
  if (hasElement("#idealRemaining")) document.querySelector("#idealRemaining").textContent = formatCurrency(analysis.idealRemaining);
  if (hasElement("#availableToSplit")) document.querySelector("#availableToSplit").textContent = formatCurrency(analysis.availableToSplit);
  
  if (hasElement("#splitNowRevolut")) document.querySelector("#splitNowRevolut").textContent = formatCurrency(analysis.splitNowRevolut);
  if (hasElement("#splitNowXtb")) document.querySelector("#splitNowXtb").textContent = formatCurrency(analysis.splitNowXtb);

  const expectedEl = document.querySelector("#expectedSpentToday");
  if (expectedEl) {
     const val = analysis.actualSpent - analysis.expectedSpentToday;
     expectedEl.style.color = val > 0 ? "var(--error)" : "var(--success)";
     expectedEl.textContent = (val > 0 ? "+ " : "") + formatCurrency(val);
  }
}

function renderCategories() {
  const selects = ["#expenseCategory"];
  selects.forEach((id) => {
    const select = document.querySelector(id);
    if (!select) return;
    const current = select.value;
    select.innerHTML = "";
    state.categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
    if (current && state.categories.includes(current)) {
      select.value = current;
    }
  });
}

function renderAccounts() {
  const container = document.querySelector("#accountsList");
  if (!container) return;
  container.innerHTML = "";
  
  if (state.accounts.length === 0) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda não existem contas registadas.";
    return;
  }
  
  container.className = "item-list";
  state.accounts.forEach(acc => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = acc.name;
    node.querySelector(".item-subtitle").textContent = acc.type;
    node.querySelector(".item-value").textContent = formatCurrency(acc.balance);
    
    node.querySelector(".ghost-btn").addEventListener("click", () => {
      state.accounts = state.accounts.filter(a => a.id !== acc.id);
      saveState();
      render();
    });
    container.appendChild(node);
  });
}

function renderSnapshots() {
  const container = document.querySelector("#snapshotList");
  if (!container) return;
  container.innerHTML = "";
  const snapshots = getSnapshotsForMonth();

  if (!snapshots.length) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda nao existem registos guardados.";
    return;
  }

  container.className = "item-list";

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

function renderRecurring() {
  const masterContainer = document.querySelector("#recurringList");
  const monthlyContainer = document.querySelector("#fixedExpensesList");
  const freqLabels = { monthly: 'Mensal', 'semi-annual': 'Semestral', annual: 'Anual' };
  const { month } = getActiveMonthParts();

  // 1. Renderizar Configuração (configuracao.html)
  if (masterContainer) {
    masterContainer.innerHTML = "";
    if (state.recurringFixed.length === 0) {
      masterContainer.className = "item-list empty-state";
      masterContainer.textContent = "Ainda não existem despesas fixas configuradas.";
    } else {
      masterContainer.className = "item-list";
      state.recurringFixed.forEach((item) => {
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector(".item-title").textContent = item.name;
        node.querySelector(".item-subtitle").textContent = 
           `${freqLabels[item.frequency] || "Mensal"} (Dia ${item.day})${item.endDate ? ` · Termina a ${item.endDate}` : ""}`;
        node.querySelector(".item-value").textContent = formatCurrency(item.amount);
        node.querySelector(".ghost-btn").addEventListener("click", () => {
          state.recurringFixed = state.recurringFixed.filter((i) => i.id !== item.id);
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
    
    // Filtrar apenas despesas válidas para o mês ativo
    const monthKey = getMonthKey();
    const allFixed = state.recurringFixed.filter(item => !item.endDate || item.endDate >= monthKey);
    
    if (allFixed.length === 0) {
      monthlyContainer.className = "item-list empty-state";
      monthlyContainer.textContent = "Não existem despesas fixas configuradas.";
    } else {
      monthlyContainer.className = "item-list";
      allFixed.forEach((item) => {
        const sm = Number(item.startMonth) || 1;
        const isCurrentPayment = (!item.frequency || item.frequency === 'monthly') ||
           (item.frequency === 'annual' && month === sm) ||
           (item.frequency === 'semi-annual' && (month === sm || month === (sm + 6 > 12 ? sm - 6 : sm + 6)));
           
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector(".item-title").textContent = item.name;
        
        if (isCurrentPayment) {
          node.querySelector(".item-subtitle").textContent = `Obrigação Real (Dia ${item.day})${item.endDate ? ` · Termina a ${item.endDate}` : ""}`;
          node.querySelector(".item-value").textContent = formatCurrency(item.amount);
        } else {
          // Provisionamento
          const prov = item.frequency === 'annual' ? item.amount / 12 : item.amount / 6;
          node.querySelector(".item-subtitle").textContent = `Provisão Mensal (${freqLabels[item.frequency] || "Variável"})`;
          node.querySelector(".item-value").textContent = formatCurrency(prov);
          node.style.opacity = "0.7";
          node.style.fontStyle = "italic";
        }

        // Permitir edição ao clicar
        node.style.cursor = "pointer";
        node.addEventListener("click", (e) => {
           if (e.target.tagName === "BUTTON") return;
           
           const expenseForm = document.querySelector("#expense-form");
           if (!expenseForm) return;
           
           expenseForm.dataset.editingId = item.id;
           expenseForm.dataset.editingType = "fixed"; // Identificador especial
           
           document.querySelector("#expenseName").value = item.name;
           document.querySelector("#expenseAmount").value = item.amount;
           const kindEl = document.querySelector("#expenseKind");
           kindEl.value = "fixed";
           kindEl.dispatchEvent(new Event("change"));
           
           const freqEl = document.querySelector("#expenseFrequency");
           freqEl.style.display = "block";
           freqEl.value = item.frequency || "monthly";
           
           // Data de início (aproximada para o mês/dia atual ou original)
           const currentMonth = getMonthKey();
           document.querySelector("#expenseDate").value = `${currentMonth}-${String(item.day || 1).padStart(2, '0')}`;
           
           const endDateEl = document.querySelector("#expenseEndDate");
           if (endDateEl) {
              endDateEl.style.display = "block";
              endDateEl.value = item.endDate || "";
           }
           
           const recurringActions = document.querySelector("#recurringEditActions");
           if (recurringActions) recurringActions.style.display = "grid";

           window.scrollTo({ top: 0, behavior: 'smooth' });
           setStatus("#expenseStatus", `A editar obrigação fixa: ${item.name}`);
        });

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
    .sort((a, b) => (b.dateLabel || "").localeCompare(a.dateLabel || "")); // DESC: mais recente primeiro
  const pendingTotal = receivables
    .filter((item) => item.status !== "received")
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const receivedTotal = receivables
    .filter((item) => item.status === "received")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  if (hasElement("#receivablePendingTotal")) document.querySelector("#receivablePendingTotal").textContent = formatCurrency(pendingTotal);
  if (hasElement("#receivableReceivedTotal")) document.querySelector("#receivableReceivedTotal").textContent = formatCurrency(receivedTotal);

  if (!receivables.length) {
    container.className = "item-list empty-state";
    container.textContent = "Ainda não existem valores em aberto registados.";
    return;
  }

  container.className = "item-list";
  receivables.forEach((receivable) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = receivable.name;
    node.querySelector(".item-subtitle").innerHTML = 
       `${receivable.dateLabel || ""} | <span class="radar-badge ${receivable.status}">${receivable.status === 'received' ? 'Recebido' : 'Pendente'}</span>`;
    node.querySelector(".item-value").textContent = formatCurrency(receivable.amount);

    const actions = node.querySelector(".item-actions");
    const removeBtn = node.querySelector(".ghost-btn");
    
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "ghost-btn";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => {
       receivableForm.dataset.editingId = receivable.id;
       document.querySelector("#receivableName").value = receivable.name;
       document.querySelector("#receivableAmount").value = receivable.amount;
       document.querySelector("#receivableDate").value = receivable.dateLabel;
       document.querySelector("#receivableStatus").value = receivable.status;
       document.querySelector("#receivableStatus").style.display = "block";
       setStatus("#receivableStatusText", `A editar ${receivable.name}.`);
    });
    
    actions.insertBefore(editBtn, removeBtn);
    
    removeBtn.addEventListener("click", () => {
      state.receivables = state.receivables.filter(r => r.id !== receivable.id);
      saveState();
      render();
    });
    
    container.appendChild(node);
  });
}

function renderExpenses() {
  const variableContainer = document.querySelector("#expensesList");
  
  if (variableContainer) variableContainer.innerHTML = "";

  const normalize = k => k.split('-').map(p => p.padStart(2, '0')).join('-');
  const activePeriodKeys = getPeriodMonthKeys().map(normalize);
  const expenses = state.expenses
    .slice()
    .filter((expense) => activePeriodKeys.includes(normalize(getItemMonthKey(expense))))
    .sort((a, b) => (getItemMonthKey(b) + String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a) + String(a.day).padStart(2,'0'))); // DESC: mais recente primeiro

  if (!expenses.length) {
    if (variableContainer) {
        variableContainer.className = "item-list empty-state";
        variableContainer.textContent = "Ainda nao existem despesas variaveis registadas.";
    }
    return;
  }

  expenses.forEach((expense) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").textContent = expense.name;
    node.querySelector(".item-subtitle").innerHTML = 
      `<span class="radar-badge">${expense.category || "Geral"}</span> dia ${expense.day}`;
    node.querySelector(".item-value").textContent = formatCurrency(expense.amount);

    const removeBtn = node.querySelector(".ghost-btn");
    
    // Permitir editar despesa ao clicar
    node.style.cursor = "pointer";
    node.addEventListener("click", (e) => {
       if (e.target.tagName === "BUTTON") return;
       
       expenseForm.dataset.editingId = expense.id;
       document.querySelector("#expenseName").value = expense.name;
       document.querySelector("#expenseAmount").value = expense.amount;
       document.querySelector("#expenseCategory").value = expense.category || "Casa";
       document.querySelector("#expenseKind").value = expense.kind || "variable";
       document.querySelector("#expenseDate").value = expense.dateLabel || getDefaultMonthDate(expense.day);
       
       // Sincronizar campos de repartição se existirem
       if (expense.isSplit && expense.splits) {
          document.querySelector("#expenseSplit").value = "yes";
          window.lastEditSplits = expense.splits; 
          document.querySelector("#splitContainer").style.display = "block";
          renderSplitUI(expense.splits);
       } else {
          document.querySelector("#expenseSplit").value = "no";
          document.querySelector("#splitContainer").style.display = "none";
       }
       
       window.scrollTo({ top: 0, behavior: 'smooth' });
       setStatus("#expenseStatus", `A editar ${expense.name}. Guarda para atualizar.`);
    });

    removeBtn.addEventListener("click", () => {
      state.expenses = state.expenses.filter((item) => item.id !== expense.id);
      
      // Limpar recebíveis/ganhos vinculados se for um split
      if (expense.isSplit) {
          state.receivables = state.receivables.filter(r => r.linkedExpenseId !== expense.id);
          state.incomes = state.incomes.filter(i => i.linkedReceivableId && !state.receivables.find(r => r.id === i.linkedReceivableId));
      }
      
      saveState();
      render();
      setStatus("#expenseStatus", `Despesa removida.`);
    });

    // Distribuir para o contentor correto baseado no tipo
    if (expense.kind !== "fixed" && variableContainer) {
        variableContainer.className = "item-list";
        variableContainer.appendChild(node);
    }
  });
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
       const idx = state.receivables.findIndex(r => r.id === editingId);
       if (idx >= 0) {
          state.receivables[idx] = { ...state.receivables[idx], ...payload };
          setStatus("#receivableStatusText", `Registo atualizado com sucesso.`);
       }
    } else {
       state.receivables.push(payload);
       setStatus("#receivableStatusText", `Novo valor por receber anotado.`);
    }

    clearReceivableEditing();
    if (document.querySelector("#receivableStatus")) document.querySelector("#receivableStatus").style.display = "none";
    saveState();
    render();
  });
}

if (expenseForm) {
  expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const editingId = getEditingExpenseId();
    const editingType = expenseForm.dataset.editingType; // "fixed" ou nada (variável)
    
    // CASO ESPECIAL: Edição de Obrigação Fixa (recurringFixed)
    if (editingType === "fixed" && editingId) {
       const idx = state.recurringFixed.findIndex(item => item.id === editingId);
       if (idx >= 0) {
          state.recurringFixed[idx] = {
             ...state.recurringFixed[idx],
             name: document.querySelector("#expenseName").value.trim(),
             amount: Number(document.querySelector("#expenseAmount").value) || 0,
             frequency: document.querySelector("#expenseFrequency").value,
             endDate: document.querySelector("#expenseEndDate").value || null,
             day: getDayFromDateInput(document.querySelector("#expenseDate").value) || state.recurringFixed[idx].day
          };
          
          delete expenseForm.dataset.editingId;
          delete expenseForm.dataset.editingType;
          expenseForm.reset();
          document.querySelector("#recurringEditActions").style.display = "none";
          document.querySelector("#expenseEndDate").style.display = "none";
          document.querySelector("#expenseFrequency").style.display = "none";
          
          saveState();
          render();
          setStatus("#expenseStatus", "Obrigação fixa atualizada com sucesso.");
          return;
       }
    }

    const name = document.querySelector("#expenseName").value.trim();
    const amount = Number(document.querySelector("#expenseAmount").value) || 0;
    const category = document.querySelector("#expenseCategory").value;
    const kind = document.querySelector("#expenseKind").value; // "variable" ou "fixed"
    const dateLabel = document.querySelector("#expenseDate").value;
    const day = getDayFromDateInput(dateLabel);

    if (!isCurrentMonthDate(dateLabel)) {
      setStatus("#expenseStatus", "A data da despesa tem de ser do mês atual.");
      return;
    }

    const payload = {
      id: editingId || generateUUID(),
      name,
      amount,
      category,
      kind,
      day,
      dateLabel
    };

    if (kind === "fixed" && !editingId) {
      // Criar nova obrigação permanente
      const frequency = document.querySelector("#expenseFrequency").value;
      state.recurringFixed.push({
         id: generateUUID(),
         name,
         amount,
         day,
         frequency,
         startMonth: getActiveMonthParts().month,
         category
      });
      setStatus("#expenseStatus", "Nova despesa fixa (obrigação) configurada.");
    } else {
      // Despesa variável ou edição de amortização mensal
      if (editingId) {
        const index = state.expenses.findIndex((item) => item.id === editingId);
        if (index >= 0) {
          state.expenses[index] = payload;
          setStatus("#expenseStatus", "Despesa atualizada com sucesso.");
          
          // Se for um split, precisamos de remover os antigos e criar novos baseados na nova edição
          if (state.expenses[index].isSplit) {
              state.receivables = state.receivables.filter(r => r.linkedExpenseId !== editingId);
          }
        }
      } else {
        state.expenses.push(payload);
        setStatus("#expenseStatus", "Despesa registada com sucesso.");
      }

      // Lógica de SPLIT (Divisão de despesa)
      const splitType = document.querySelector("#expenseSplit").value;
      if (splitType === "yes") {
          const expenseId = payload.id;
          const splitData = window.lastGeneratedSplits || window.lastEditSplits || [];
          
          payload.isSplit = true;
          payload.splits = splitData;

          splitData.forEach(p => {
             if (p.isMe) return;
             state.receivables.push({
                id: generateUUID(),
                name: `Reembolso ${p.name}: ${name}`,
                amount: p.amount,
                dateLabel: dateLabel,
                day: day,
                monthKey: getMonthKey(),
                status: "pending",
                linkedExpenseId: expenseId
             });
          });
      }
    }

    clearExpenseEditing();
    saveState();
    render();
  });
}

// Botão Eliminar Obrigação Permanente
const deleteRecurringBtn = document.querySelector("#deleteRecurringBtn");
if (deleteRecurringBtn) {
    deleteRecurringBtn.addEventListener("click", () => {
        const editingId = expenseForm.dataset.editingId;
        const editingType = expenseForm.dataset.editingType;
        
        if (editingId && editingType === "fixed") {
            const confirmed = confirm("Tens a certeza que queres eliminar esta obrigação permanente? Ela deixará de ser contabilizada em todos os meses futuros.");
            if (confirmed) {
                state.recurringFixed = state.recurringFixed.filter(item => item.id !== editingId);
                delete expenseForm.dataset.editingId;
                delete expenseForm.dataset.editingType;
                expenseForm.reset();
                document.querySelector("#recurringEditActions").style.display = "none";
                document.querySelector("#expenseEndDate").style.display = "none";
                document.querySelector("#expenseFrequency").style.display = "none";
                
                saveState();
                render();
                setStatus("#expenseStatus", "Obrigação permanente eliminada!");
            }
        }
    });
}

if (recurringForm) {
  recurringForm.addEventListener("submit", (event) => {
    event.preventDefault();

    state.recurringFixed.push({
      id: generateUUID(),
      name: document.querySelector("#recurringName").value.trim(),
      amount: Number(document.querySelector("#recurringAmount").value) || 0,
      day: normalizeDay(document.querySelector("#recurringDay").value),
      frequency: document.querySelector("#recurringFrequency").value,
      startMonth: Number(document.querySelector("#recurringStartMonth")?.value) || (getToday().getMonth() + 1),
      category: "Casa"
    });

    recurringForm.reset();
    saveState();
    render();
    setStatus("#recurringStatus", "Despesa fixa configurada com sucesso.");
  });
}

if (transferForm) {
  transferForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const accountId = document.querySelector("#transferAccountId").value;
    const account = state.accounts.find((item) => item.id === accountId);
    if (!account) return;

    state.transfers.push({
      id: generateUUID(),
      name: document.querySelector("#transferName").value.trim(),
      amount: Number(document.querySelector("#transferAmount").value) || 0,
      day: getDayFromDateInput(document.querySelector("#transferDate").value),
      dateLabel: document.querySelector("#transferDate").value,
      accountId: account.id,
      accountName: account.name
    });

    transferForm.reset();
    saveState();
    render();
    setStatus("#transferStatus", "Depósito registado com sucesso.");
  });
}

if (incomeForm) {
  incomeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const editingId = getEditingIncomeId();
    const payload = {
      id: editingId || generateUUID(),
      name: document.querySelector("#incomeName").value.trim(),
      amount: Number(document.querySelector("#incomeAmount").value) || 0,
      day: getDayFromDateInput(document.querySelector("#incomeDate").value),
      dateLabel: document.querySelector("#incomeDate").value
    };

    if (editingId) {
      const index = state.incomes.findIndex((item) => item.id === editingId);
      if (index >= 0) {
        state.incomes[index] = payload;
        setStatus("#incomeStatus", "Ganho atualizado.");
      }
    } else {
      state.incomes.push(payload);
      setStatus("#incomeStatus", "Ganho registado.");
    }

    clearIncomeEditing();
    saveState();
    render();
  });
}

(function init() {
  window.state = loadState();
  
  if (hasElement("#analysisMonthInput")) {
    document.querySelector("#analysisMonthInput").addEventListener("change", (e) => {
       state.analysisMonth = e.target.value;
       saveState();
       render();
    });
  }

  const kindSelect = document.querySelector("#expenseKind");
  const freqSelect = document.querySelector("#expenseFrequency");
  const endDateInput = document.querySelector("#expenseEndDate");
  
  if (kindSelect) {
    kindSelect.addEventListener("change", () => {
      const isFixed = kindSelect.value === "fixed";
      freqSelect.style.display = isFixed ? "block" : "none";
      if (endDateInput) {
          endDateInput.style.display = isFixed ? "block" : "none";
      }
    });
  }

  // Lógica de Split UI
  const splitSelect = document.querySelector("#expenseSplit");
  const splitContainer = document.querySelector("#splitContainer");
  if (splitSelect && splitContainer) {
      splitSelect.addEventListener("change", () => {
          splitContainer.style.display = splitSelect.value === "yes" ? "block" : "none";
          if (splitSelect.value === "yes") renderSplitUI();
      });
  }

  render();
})();

function setStatus(selector, message) {
  const el = document.querySelector(selector);
  if (el) {
    el.textContent = message;
    el.classList.add("status-animate");
    setTimeout(() => el.classList.remove("status-animate"), 2000);
  }
}

function getPeriodMonthKeys() {
  const filter = window.activePeriodFilter || 'month';
  const current = getActiveMonthKey();
  if (filter === 'month') return [current];
  
  const [y, m] = current.split('-').map(Number);
  if (filter === 'quarter') {
     const keys = [];
     for (let i = 0; i < 3; i++) {
        let ty = y, tm = m - i;
        if (tm <= 0) { tm += 12; ty -= 1; }
        keys.push(`${ty}-${String(tm).padStart(2, '0')}`);
     }
     return keys;
  }
  
  // 'all' handles via separate logic in renderers usually, but here we can return all existing keys
  const allKeys = new Set();
  state.expenses.forEach(e => allKeys.add(getItemMonthKey(e)));
  state.incomes.forEach(i => allKeys.add(getItemMonthKey(i)));
  state.transfers.forEach(t => allKeys.add(getItemMonthKey(t)));
  allKeys.add(current);
  return Array.from(allKeys);
}

// UI de Divisão de Despesas
function renderSplitUI(existingSplits = null) {
    const container = document.querySelector("#splitList");
    if (!container) return;
    container.innerHTML = "";
    
    let people = existingSplits || [
        { name: "Eu", amount: 0, isMe: true },
        { name: "Pessoa 2", amount: 0, isMe: false }
    ];
    
    function update() {
        container.innerHTML = "";
        const total = Number(document.querySelector("#expenseAmount").value) || 0;
        
        people.forEach((p, index) => {
            const row = document.createElement("div");
            row.className = "split-row";
            row.innerHTML = `
                <input type="text" value="${p.name}" class="split-name" ${p.isMe ? 'disabled' : ''}>
                <input type="number" value="${p.amount.toFixed(2)}" class="split-val">
                ${!p.isMe ? '<button type="button" class="del-split">×</button>' : '<span></span>'}
            `;
            
            row.querySelector(".split-name").oninput = (e) => p.name = e.target.value;
            row.querySelector(".split-val").oninput = (e) => p.amount = Number(e.target.value);
            if (!p.isMe) {
                row.querySelector(".del-split").onclick = () => {
                    people.splice(index, 1);
                    update();
                };
            }
            container.appendChild(row);
        });
        window.lastGeneratedSplits = people;
    }

    document.querySelector("#addSplitPerson").onclick = () => {
        people.push({ name: `Pessoa ${people.length + 1}`, amount: 0, isMe: false });
        update();
    };

    document.querySelector("#distributeSplit").onclick = () => {
        const total = Number(document.querySelector("#expenseAmount").value) || 0;
        const perPerson = total / people.length;
        people.forEach(p => p.amount = perPerson);
        update();
    };

    update();
}

function showToast(msg) {
    const toast = document.createElement("div");
    toast.style.cssText = "position:fixed;bottom:20px;right:20px;background:#333;color:#fff;padding:12px 24px;border-radius:8px;z-index:9999;box-shadow:0 10px 20px rgba(0,0,0,0.2);animation:slideIn 0.3s ease-out;";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "slideOut 0.3s ease-in";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
