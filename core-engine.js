console.log("[Core] Motor Central v4.1.0 Ativo");
const STORAGE_KEY = "finance-control-app";

function parseFormattedNumber(val) {
  if (typeof val !== "string") return Number(val) || 0;
  const normalized = val.replace(",", ".").trim();
  return Number(normalized) || 0;
}
const REVOLUT_INTEREST_RATE = 0.019;

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == "x" ? r : (r & 0x3 | 0x8);
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
  finnhubApiKey: ""
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

function normalizeMonthKey(key) {
  if (!key || typeof key !== 'string') return key;
  const parts = key.split('-');
  if (parts.length !== 2) return key;
  return `${parts[0]}-${parts[1].padStart(2, '0')}`;
}

function migrateState(parsed) {
  // 1. Normalizar monthKey (ex: 2026-4 -> 2026-04)
  const collections = ['expenses', 'incomes', 'snapshots', 'transfers', 'receivables'];
  collections.forEach(col => {
    if (Array.isArray(parsed[col])) {
      parsed[col].forEach(item => {
        if (item.monthKey) item.monthKey = normalizeMonthKey(item.monthKey);
      });
    }
  });

  if (parsed.analysisMonth) parsed.analysisMonth = normalizeMonthKey(parsed.analysisMonth);

  // 2. MIGRAÇÃ O DE CASH PARA CONTA (Sugestão do Utilizador)
  if (!parsed.accounts) parsed.accounts = [];
  
  // Encontrar os últimos balances registados na base de dados para não começar a ZERO
  const lastStateFromSnaps = {};
  let lastKnownCashTotal = 0;
  
  if (Array.isArray(parsed.snapshots)) {
      const sortedSnaps = parsed.snapshots.slice().sort((a,b) => {
          const keyA = (a.monthKey || "0000-00") + String(a.day || 0).padStart(2, "0");
          const keyB = (b.monthKey || "0000-00") + String(b.day || 0).padStart(2, "0");
          return keyA.localeCompare(keyB);
      });
      
      sortedSnaps.forEach(s => {
          // NormalizaÇÃo da identidade para evitar duplicaÇÃo (Legado vs Moderno)
          const modernAccount = parsed.accounts.find(acc => acc.id === s.accountId || acc.name === s.accountName);
          const key = modernAccount ? modernAccount.id : (s.accountId || s.accountName || "legacy");
          
          lastStateFromSnaps[key] = Number(s.bankBalance) || 0;
          if (s.cashBalance > 0) lastKnownCashTotal = Number(s.cashBalance);
      });
  }

  let cashAccount = parsed.accounts.find(a => a.type === "Dinheiro" || a.name === "Dinheiro Vivo");
  if (!cashAccount && Array.isArray(parsed.accounts)) {
      cashAccount = {
          id: "acc-cash-physical",
          name: "Dinheiro Vivo (Carteira)",
          type: "Dinheiro",
          balance: lastKnownCashTotal
      };
      parsed.accounts.push(cashAccount);
  } else if (cashAccount && cashAccount.balance === 0 && lastKnownCashTotal > 0) {
      cashAccount.balance = lastKnownCashTotal;
  }

  // Inicializar saldos de contas bancárias se estiverem a zero mas existir histórico
  parsed.accounts.forEach(acc => {
      if ((acc.balance === 0 || !acc.balance) && lastStateFromSnaps[acc.id]) {
          acc.balance = lastStateFromSnaps[acc.id];
      }
  });

  // 3. Converter histórico de cashBalance para a conta Dinheiro
  if (cashAccount && Array.isArray(parsed.snapshots)) {
      const newSnapshots = [];
      parsed.snapshots.forEach(s => {
          if (s.cashBalance > 0 && s.accountId !== cashAccount.id) {
              const exists = parsed.snapshots.find(ex => ex.monthKey === s.monthKey && ex.day === s.day && ex.accountId === cashAccount.id);
              if (!exists) {
                  newSnapshots.push({
                      id: `migrated-cash-${s.id}`,
                      monthKey: s.monthKey,
                      day: s.day,
                      date: s.date,
                      accountId: cashAccount.id,
                      accountName: cashAccount.name,
                      bankBalance: s.cashBalance,
                      cashBalance: 0 
                  });
              }
              s.cashBalance = 0; 
          }
      });
      parsed.snapshots.push(...newSnapshots);
  }

  // 4. LIMPEZA DE REGISTOS DUPLICADOS (Pedido do Utilizador)
  if (Array.isArray(parsed.snapshots)) {
      const seen = new Set();
      parsed.snapshots = parsed.snapshots.filter(s => {
          const key = `${s.monthKey}|${s.day}|${s.accountId || ''}|${s.accountName || ''}|${s.bankBalance}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
      });
  }
  
  // DeduplicaÇÃo leve de despesas (mesmo dia/nome/valor/categoria)
  if (Array.isArray(parsed.expenses)) {
      const seen = new Set();
      parsed.expenses = parsed.expenses.filter(e => {
          const key = `${e.monthKey}|${e.day}|${e.name}|${e.amount}|${e.category}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
      });
  }

  return parsed;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return JSON.parse(JSON.stringify(defaultState));
  }

  try {
    let parsed = JSON.parse(raw);
    parsed = migrateState(parsed);

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

// Inicialização imediata do estado para o motor Pro 360
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


function getNetExpenseAmount(expense) {
  if (typeof state === 'undefined' || !state.receivables) return Number(expense.amount || 0);
  const splits = state.receivables
    .filter(r => r.linkedExpenseId === expense.id)
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return Math.max(0, Number(expense.amount || 0) - splits);
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
    .reduce((total, expense) => total + getNetExpenseAmount(expense), 0);

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


function sumFixedMonthlyExpenses(targetMonthKey = null) {
  const currentKey = getMonthKey();
  const keyToUse = targetMonthKey || currentKey;
  const parts = keyToUse.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  
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
    if (rf.frequency === 'quarterly') return total + (amount / 3);
    if (rf.frequency === 'semi-annual') return total + (amount / 6);
    if (rf.frequency === 'annual') return total + (amount / 12);
    return total + amount;
  }, 0);
}

/**
 * Calcula o status das obrigações do mês atual.
 * Compara a provisão teórica com os pagamentos fixos reais já registados.
 */
function calculateObligationsStatus() {
    const monthKey = getMonthKey();
    const totalProvision = getMonthlyProvisionForFixedExpenses();
    
    // Somar o que já foi registado como despesa fixa NESTE mês
    const paidAmount = state.expenses
        .filter(e => getItemMonthKey(e) === monthKey && e.kind === 'fixed')
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
        
    const pendingAmount = Math.max(totalProvision - paidAmount, 0);
    const progressPercent = totalProvision > 0 ? (paidAmount / totalProvision) * 100 : 100;

    return {
        totalProvision,
        paidAmount,
        pendingAmount,
        progressPercent: Math.min(progressPercent, 100)
    };
}

function sumVariableExpenses() {
  const monthKey = getMonthKey();
  
  // Soma total das despesas variáveis do mês
  const totalVariable = state.expenses
    .filter(e => e.kind !== "fixed" && getItemMonthKey(e) === monthKey)
    .reduce((total, expense) => total + getNetExpenseAmount(expense), 0);

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
  
  // Leftover é o que SOBRA no mês real face ao que foi orçamentado e gasto REAL
  // Agora utiliza getRealSpentEfficiency() para detetar despesas não registadas automaticamente.
  const realFlexSpent = getRealSpentEfficiency();
  const leftover = Math.max(salary + extraIncomes - monthlyProvision - realFlexSpent, 0);
  
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
    const keyA = (a.monthKey || "0000-00") + String(a.day || 0).padStart(2, "0");
    const keyB = (b.monthKey || "0000-00") + String(b.day || 0).padStart(2, "0");
    return keyA.localeCompare(keyB);
  });
  
  const accountBalances = {};
  const globalSnapshotDays = {};
  
  allChronological.forEach(s => {
      // NormalizaÇÃo da identidade para evitar duplicaÇÃo (Legado vs Moderno)
      const modernAccount = state.accounts.find(acc => acc.id === s.accountId || acc.name === s.accountName);
      
      // NOVA REGRA: Se não tem ID, e o nome é genérico ("Global", "Legado", etc.), 
      // e já temos contas modernas, ignoramos (é um snapshot consolidado redundante).
      const isGeneric = !s.accountName || s.accountName === "Global" || s.accountName === "Legado" || s.accountName === "Outros";
      if (!s.accountId && state.accounts.length > 0 && isGeneric && !modernAccount) return;

      const identityKey = modernAccount ? modernAccount.id : (s.accountId || s.accountName || "legacy");

      // Atualizar o saldo conhecido desta conta
      accountBalances[identityKey] = { bank: Number(s.bankBalance)||0, cash: Number(s.cashBalance)||0 };
      
      // Se este snapshot pertence ao mês que estamos a analisar, somamos TODOS os saldos conhecidos ATã‰ ESTE MOMENTO
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
              accountName: s.accountName || "Global"
          };
      }
  });
  
  return Object.values(globalSnapshotDays).sort((a,b) => a.day - b.day);
}

function getMonthKey() {
  return getActiveMonthKey();
}

function getDefaultMonthDate(day = null) {
  const { year, month } = getActiveMonthParts();
  const today = getToday();
  const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
  
  let dayToUse = day;
  if (dayToUse === null) {
    dayToUse = isCurrentMonth ? today.getDate() : 1;
  }
  
  const dayValue = `${dayToUse}`.padStart(2, "0");
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

// Removido sumExpensesUntil duplicado para evitar inconsistãªncias

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
    .reduce((total, expense) => total + getNetExpenseAmount(expense), 0);

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
    // Apenas uma conta â€” retornar diretamente
    return firstDaySnaps[0];
  }
  
  // Múltiplas contas no dia 1 â€” consolidar numa entrada virtual
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
  document.querySelector("#snapshotDate").value = getDefaultMonthDate();
  document.querySelector("#snapshotBankBalance").value = "";
  document.querySelector("#snapshotCashBalance").value = "";
}

function clearExpenseEditing() {
  delete expenseForm.dataset.editingId;
  expenseForm.reset();
  document.querySelector("#expenseDate").value = getDefaultMonthDate();
  syncCategoryOptions();
}

function clearIncomeEditing() {
  if (!incomeForm) return;
  delete incomeForm.dataset.editingId;
  incomeForm.reset();
  const incomeDateInput = document.querySelector("#incomeDate");
  if (incomeDateInput) {
    incomeDateInput.value = getDefaultMonthDate();
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
    receivableDateInput.value = getDefaultMonthDate();
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

    if (currentValue) {
      select.value = currentValue;
    }
  });
}

function getCalendarSlices() {
  const { year, month } = getActiveMonthParts();
  const lastDay = new Date(year, month, 0).getDate();
  const sundays = [];
