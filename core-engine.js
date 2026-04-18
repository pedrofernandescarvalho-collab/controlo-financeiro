console.log("[Core] Motor Central v4.3.2 Ativo");
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

  // 2. MIGRAÇÃO DE CASH PARA CONTA (Sugestão do Utilizador)
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
var state = loadState();
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

    if (targetValue) {
      select.value = targetValue;
    }
  });
}

function getCalendarSlices() {
  const { year, month } = getActiveMonthParts();
  const lastDay = new Date(year, month, 0).getDate();
  const sundays = [];
  
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() === 0) sundays.push(d);
  }

  const slices = [];
  let start = 1;
  
  // Criar fatias baseadas em TODOS os domingos encontrados
  sundays.forEach(sundayDay => {
    slices.push({ start, end: sundayDay });
    start = sundayDay + 1;
  });
  
  // A última fatia vai do dia seguinte ao último domingo até ao fim do mês (se ainda houver dias)
  if (start <= lastDay) {
    slices.push({ start, end: lastDay });
  }
  return slices;
}

function getCycleAnalysis(targetDay = null) {
  const { cycleStart, cycleEnd, daysInCycle } = getCycleWindow();
  const today = getToday();
  const currentDay = isActiveMonthCurrent() ? today.getDate() : 31;
  const elapsedDays = Math.min(targetDay || currentDay, daysInCycle);
  
  const budget = calculateBudget();
  const allowedSpent = (budget.disposableMonthlyBudget / Math.max(daysInCycle, 1)) * elapsedDays;
  
  const realFlexSpent = getRealSpentEfficiency();
  const actualSpent = (targetDay === null || targetDay === currentDay) ? realFlexSpent : (sumExpensesUntil(targetDay) + sumTransfersUntil(targetDay));

  const surplus = Math.max(allowedSpent - actualSpent, 0);
  
  const shareTotal = (Number(state.revolutShare) || 0) + (Number(state.xtbShare) || 0);
  const normalizedRevolutShare = shareTotal > 0 ? (Number(state.revolutShare) || 0) / shareTotal : 0.5;
  const splitNowRevolut = surplus * normalizedRevolutShare;
  const splitNowXtb = surplus - splitNowRevolut;

  return {
    today: new Date(cycleStart.getFullYear(), cycleStart.getMonth(), elapsedDays),
    latestDay: elapsedDays,
    actualSpent,
    surplus,
    expectedSpentToday: allowedSpent,
    splitNowRevolut,
    splitNowXtb,
    isSunday: new Date(cycleStart.getFullYear(), cycleStart.getMonth(), elapsedDays).getDay() === 0,
    dailyBudget: budget.disposableMonthlyBudget / daysInCycle
  };
}

function getSundayHistory() {
  const { year, month } = getActiveMonthParts();
  const today = getToday();
  const currentDay = isActiveMonthCurrent() ? today.getDate() : 31;
  const milestones = [];
  
  const slices = getCalendarSlices();
  
  slices.forEach((slice, idx) => {
    if (slice.end <= currentDay) {
       milestones.push({
         day: slice.end,
         label: idx === 3 ? `Fecho do Mãªs (${slice.end})` : `Domingo ${slice.end}`,
         analysis: getCycleAnalysis(slice.end)
       });
    }
  });

  return milestones.reverse(); 
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
  if (hasElement("#finnhubApiKey")) {
    document.querySelector("#finnhubApiKey").value = state.finnhubApiKey || "";
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
    startDateInput.value = getDefaultMonthDate();
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
  
  const todayDay = getToday().getDate();

  if (snapDateInput && !isCurrentMonthDate(snapDateInput.value)) {
    snapDateInput.value = getDefaultMonthDate(todayDay);
  }
  if (expenseDateInput && !isCurrentMonthDate(expenseDateInput.value)) {
    expenseDateInput.value = getDefaultMonthDate(todayDay);
  }
  if (transferDateInput && !isCurrentMonthDate(transferDateInput.value)) {
    transferDateInput.value = getDefaultMonthDate(todayDay);
  }
  if (incomeDateInput && !isCurrentMonthDate(incomeDateInput.value)) {
    incomeDateInput.value = getDefaultMonthDate(todayDay);
  }
  if (receivableDateInput && !isCurrentMonthDate(receivableDateInput.value)) {
    receivableDateInput.value = getDefaultMonthDate(todayDay);
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
    // Procurar o ãšLTIMO snapshot registado PARA ESTA CONTA ESPECãFICA no histórico
    const accSnapshots = allChronological.filter(s => s.accountId === acc.id);
    const lastAccSnap = accSnapshots.length > 0 ? accSnapshots[accSnapshots.length - 1] : null;
    const displayBalance = lastAccSnap ? lastAccSnap.bankBalance : acc.balance;

    html += `
      <div style="background: rgba(0,0,0,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.05); color: var(--text-dark);">
         <strong style="display:block; margin-bottom:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">${acc.name} (${acc.type})</strong>
         <div class="field-block">
           <label style="font-size:12px; margin:0;">Saldo Bancário Livre</label>
           <input type="number" step="0.01" class="dyn-bank-input" data-acc-id="${acc.id}" value="${Number(displayBalance)||0}" required>
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
  // ENCONTRAR O ãšLTIMO DOMINGO PARA REFERãŠNCIA DE DEPã“SITOS
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
    const incomeBetweenTotal = sumIncomesBetween(previousSnapshot.day, currentSnapshot.day, false); // Incluir tudo para reconciliaÇÃo
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
    container.classList.add("item-list", "empty-state");
    container.textContent = "Ainda nao existem contas registadas.";
    return;
  }

  container.classList.remove("empty-state");
    container.classList.add("item-list");
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

function toggleFixedPayment(obligation, isPaid) {
  const monthKey = getMonthKey();
  
  if (isPaid) {
    state.expenses.push({
      id: generateUUID(),
      name: obligation.name,
      amount: obligation.amount,
      day: obligation.day || 1,
      monthKey: monthKey,
      dateLabel: getDefaultMonthDate(obligation.day || 1),
      category: "Despesa Fixa",
      kind: "fixed",
      linkedObligationId: obligation.id
    });
    showToast(`Obrigação "${obligation.name}" marcada como paga.`);
  } else {
    const expenseToRemove = state.expenses.find(e => 
      getItemMonthKey(e) === monthKey && 
      e.kind === 'fixed' && 
      (e.linkedObligationId === obligation.id || e.name === obligation.name)
    );
    if (expenseToRemove) {
      state.expenses = state.expenses.filter(e => e.id !== expenseToRemove.id);
      showToast(`Pagamento de "${obligation.name}" removido.`);
    }
  }
  
  saveState();
  render();
}

function renderRecurring() {
  const masterContainer = document.querySelector("#recurringList");
  const monthlyContainer = document.querySelector("#fixedExpensesList");
  
  const { month } = getActiveMonthParts();
  const monthsNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const freqLabels = { monthly: "Mensal", quarterly: "Trimestral", "semi-annual": "Semestral", annual: "Anual" };

  // 1. Renderizar Lista Mestre (ConfiguraÇÃo)
  if (masterContainer) {
    masterContainer.innerHTML = "";
    if (state.recurringFixed.length === 0) {
      masterContainer.classList.add("item-list", "empty-state");
      masterContainer.textContent = "Não há despesas fixas globais configuradas.";
    } else {
      masterContainer.classList.remove("empty-state");
    masterContainer.classList.add("item-list");
      state.recurringFixed.forEach((item) => {
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector(".item-title").textContent = item.name;
        
        let subtitle = `Dia ${item.day} Â· ${freqLabels[item.frequency] || "Mensal"}`;
        if (item.frequency && item.frequency !== 'monthly') {
            subtitle += ` Â· Mãªs ref: ${monthsNames[(item.startMonth || 1) - 1]}`;
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

  // 2. Renderizar Ocorrãªncias Reais (Registos - index.html)
  if (monthlyContainer) {
    const allFixed = state.recurringFixed;
    if (allFixed.length === 0) {
      monthlyContainer.classList.add("item-list", "empty-state");
      monthlyContainer.innerHTML = "<p style='font-size:0.8rem; opacity:0.6;'>Nenhuma obrigaÇÃo configurada.</p>";
    } else {
      monthlyContainer.innerHTML = "";
      monthlyContainer.classList.add("item-list");
      
      let renderedCount = 0;
      allFixed.forEach((item) => {
        const sm = Number(item.startMonth) || 1;
        const currentMonth = Number(month); // Mãªs atual da análise
        
        // Lógica simplificada e robusta para detectar se vence este mês
        const isCurrentPayment = (!item.frequency || item.frequency === 'monthly') ||
           (item.frequency === 'quarterly' && (currentMonth - sm + 12) % 3 === 0) ||
           (item.frequency === 'annual' && currentMonth === sm) ||
           (item.frequency === 'semi-annual' && (currentMonth - sm + 12) % 6 === 0);
           
        const node = template.content.firstElementChild.cloneNode(true);
        node.querySelector(".item-title").textContent = item.name;
        
        if (isCurrentPayment) {
          renderedCount++;
          node.querySelector(".item-subtitle").textContent = `Vence Dia ${item.day}`;
          node.querySelector(".item-value").textContent = formatCurrency(item.amount);
          
          const isPaid = state.expenses.some(e => 
            getItemMonthKey(e) === getMonthKey() && 
            e.kind === 'fixed' && 
            (e.linkedObligationId === item.id || e.name === item.name)
          );
          
          const actionContainer = node.querySelector(".item-actions");
          if (actionContainer) {
              actionContainer.innerHTML = `
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: ${isPaid ? 'var(--success)' : 'var(--text-muted)'};">
                   <span style="font-size: 0.6rem; font-weight:800; letter-spacing:0.05em;">${isPaid ? 'PAGO' : 'PAGAR'}</span>
                   <input type="checkbox" class="payment-check" ${isPaid ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary);">
                </label>
              `;
              const check = actionContainer.querySelector(".payment-check");
              check.addEventListener("change", () => toggleFixedPayment(item, check.checked));
          }
        } else {
          // Provisionamento
          const divisors = { quarterly: 3, "semi-annual": 6, annual: 12 };
          const div = divisors[item.frequency] || 1;
          const prov = item.amount / div;
          node.querySelector(".item-subtitle").textContent = `Provisão (${freqLabels[item.frequency] || "Variável"})`;
          node.querySelector(".item-value").textContent = formatCurrency(prov);
          const actionContainer = node.querySelector(".item-actions");
          if (actionContainer) actionContainer.innerHTML = `<span style="font-size: 0.6rem; opacity: 0.4; font-weight:600;">DILUãDO</span>`;
          node.style.opacity = "0.6";
        }

        const ghostBtn = node.querySelector(".ghost-btn");
        if (ghostBtn) ghostBtn.style.display = "none";
        monthlyContainer.appendChild(node);
      });

      if (renderedCount === 0) {
          // Se todas forem diluídas e nenhuma vencer este mês
          const msg = document.createElement("p");
          msg.style.cssText = "font-size: 0.75rem; opacity: 0.5; padding: 10px; text-align: center;";
          msg.textContent = "Nenhuma conta vence este mês.";
          monthlyContainer.prepend(msg);
      }
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
    container.classList.add("item-list", "empty-state");
    container.textContent = "Ainda nao existem valores em aberto registados.";
    return;
  }

  container.classList.remove("empty-state");
    container.classList.add("item-list");

  receivables.forEach((receivable) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const isReceived = receivable.status === "received";
    
    if (isReceived) {
      node.classList.add("received");
      node.querySelector(".item-title").innerHTML = receivable.name + ` <span class="badge badge-success">Liquidada âœ…</span>`;
    } else {
      node.querySelector(".item-title").textContent = receivable.name;
    }

    node.querySelector(".item-subtitle").textContent =
      `${isReceived ? "Liquidada" : "Pendente"} | ${receivable.dateLabel || "Sem data"}`;
    node.querySelector(".item-value").textContent = formatCurrency(receivable.amount);

    const actionWrap = node.querySelector(".item-actions");
    const removeButton = node.querySelector(".ghost-btn");
    
    // Botão Recebido (AÇÃo rápida)
    if (!isReceived) {
      const receiveBtn = document.createElement("button");
      receiveBtn.type = "button";
      receiveBtn.className = "success-btn";
      receiveBtn.textContent = "Recebido âœ…";
      receiveBtn.title = "Marcar como recebido e injetar no orçamento";
      receiveBtn.addEventListener("click", () => {
        receivable.status = "received";
        
        // InjeÇÃo Automática de Rendimento (AnulaÇÃo de Despesa)
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
      // Limpar injeÇÃo se for removido? Geralmente sim se for erro de registo
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
  const variableContainer = document.querySelector("#expensesList");
  
  if (variableContainer) variableContainer.innerHTML = "";

  const normalize = k => k.split('-').map(p => p.padStart(2, '0')).join('-');
  const activePeriodKeys = getPeriodMonthKeys().map(normalize);

  const allMonthExpenses = state.expenses
    .filter((expense) => activePeriodKeys.includes(normalize(getItemMonthKey(expense))))
    .sort((a, b) => (getItemMonthKey(a) + String(a.day).padStart(2,'0')).localeCompare(getItemMonthKey(b) + String(b.day).padStart(2,'0')));

  if (allMonthExpenses.length === 0) {
    if (variableContainer) {
      variableContainer.classList.add("item-list", "empty-state");
      variableContainer.textContent = "Ainda não existem despesas registadas para este mês.";
    }
    return;
  }

  allMonthExpenses.forEach((expense) => {
    const isShared = state.receivables.some(r => r.linkedExpenseId === expense.id);
    const badge = isShared ? ` <span class="badge badge-shared">Partilhada</span>` : '';
    
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-title").innerHTML = expense.name + badge;
    node.querySelector(".item-subtitle").textContent = `${expense.category || "Geral"} | Dia ${expense.day}`;
    node.querySelector(".item-value").textContent = formatCurrency(getNetExpenseAmount(expense));

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
    if (expense.kind !== "fixed" && variableContainer) {
        variableContainer.classList.remove("empty-state");
        variableContainer.appendChild(node);
    }
  });
}

if (settingsForm) {
  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const salary = Number(document.querySelector("#salary")?.value) || 0;
    const rev    = Number(document.querySelector("#revolutShare")?.value) || 0;
    const xtb    = Number(document.querySelector("#xtbShare")?.value) || 0;

    state.salary        = salary;
    state.revolutShare  = rev;
    state.xtbShare      = xtb;
    saveState();
    setStatus("#settingsStatus", "Definições guardadas.");
  });
}

// ── Listener dedicado para a Chave API (formulário #api-settings-form) ──
const apiSettingsForm = document.querySelector("#api-settings-form");
if (apiSettingsForm) {
  apiSettingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const apiKey = (document.querySelector("#finnhubApiKey")?.value || "").trim();
    if (!apiKey) { alert("⚠️ Introduza uma chave API válida."); return; }
    state.finnhubApiKey = apiKey;
    if (typeof window !== 'undefined') window.state = state;
    saveState();
    const btn = apiSettingsForm.querySelector("button[type='submit'], button");
    if (btn) { btn.textContent = "✅ Chave Guardada!"; btn.disabled = true; }
    setTimeout(() => {
      const ref = document.referrer;
      window.location.href = (ref && ref.includes('pro360')) ? ref : 'pro360.html';
    }, 800);
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
    
    // Auditoria Ponto 4: ReintegraÇÃo Lógica Automática de Empréstimos
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
  // Listener para mostrar/esconder frequãªncia e ajustar layout
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
      showToast(`Divisão de ${part}€ aplicada a ${personCount} pessoas.`);
    };
  }
}

  if (expenseForm) { expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const expenseDate = document.querySelector("#expenseDate").value;
    const kind = "variable"; 
    const name = document.querySelector("#expenseName").value.trim();
    const amount = parseFormattedNumber(document.querySelector("#expenseAmount").value);
    
    // Capturar múltiplas partilhas
    const isSplit = splitSelect?.value === "yes";
    const splits = [];
    let splitTotalSum = 0;

    if (isSplit) {
      const rows = splitList.querySelectorAll(".split-row");
      rows.forEach(row => {
        const pName = row.querySelector(".split-name").value.trim();
        const pAmount = parseFormattedNumber(row.querySelector(".split-amount").value);
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
        setStatus("#expenseStatus", `ERRO: A soma das partilhas (${splitTotalSum.toFixed(2)}€) é maior que o total (${amount.toFixed(2)}€)!`);
        return;
      }
    }

    const isFutureAllowed = kind === "fixed" && (frequency === "annual" || frequency === "semi-annual");
    if (!isFutureAllowed && !isCurrentMonthDate(expenseDate)) {
      setStatus("#expenseStatus", "A despesa tem de estar dentro do mês atual ou ser uma obrigaÇÃo futura (Anual/Semestral).");
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
    if (expenseForm) expenseForm.removeAttribute('data-editing-id');
  });
}


if (incomeForm) {
  incomeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const incomeDate = document.querySelector("#incomeDate").value;
    const editingId = incomeForm.dataset.editingId;
    const name = document.querySelector("#incomeName").value.trim();
    const amount = parseFormattedNumber(document.querySelector("#incomeAmount").value);
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
    const amount = parseFormattedNumber(document.querySelector("#recurringAmount").value);
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

function exportData() {
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

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.expenses || !imported.accounts) throw new Error("Formato inválido");
      
      if (confirm("Isto irá substituir os teus dados atuais e recarregar a página. Continuar?")) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
        location.reload();
      }
    } catch (err) {
      alert("Erro ao importar backup: Ficheiro inválido ou corrompido.");
    }
  };
  reader.readAsText(file);
}

// Configuração de botões de Soberania
document.addEventListener('click', (e) => {
    if (e.target.id === 'exportBackupBtn') exportData();
    if (e.target.id === 'importBackupBtn') {
        const input = document.getElementById('importFile');
        if (input) input.click();
    }
});

document.addEventListener('change', (e) => {
    if (e.target.id === 'importFile') importData(e);
});

// â”€â”€ Auto-Preencher Saldo Inicial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Definido como funÇÃo normal â€” chamado após o state ser inicializado
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


function getFlexibleSpentInPeriod(startDay, endDay, targetMonthKey = null) {
  const monthKey = targetMonthKey || getMonthKey();
  
  // Somar despesas variáveis e transferãªncias no período
  const expenses = state.expenses
    .filter(e => getItemMonthKey(e) === monthKey && e.day >= startDay && e.day <= endDay && e.kind !== 'fixed')
    .reduce((s, e) => s + getNetExpenseAmount(e), 0);
    
  const transfers = state.transfers
    .filter(t => getItemMonthKey(t) === monthKey && t.day >= startDay && t.day <= endDay)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
    
  return expenses + transfers;
}

function getDailySpendingData(targetMonthKey = null) {
  const monthKey = targetMonthKey || getMonthKey();
  const parts = monthKey.split('-');
  const daysInMonth = new Date(Number(parts[0]), Number(parts[1]), 0).getDate();
  const spending = new Array(daysInMonth).fill(0);
  
  state.expenses
    .filter(e => getItemMonthKey(e) === monthKey && e.kind !== 'fixed')
    .forEach(e => {
       const d = Number(e.day) || 1;
       if (d <= daysInMonth) spending[d-1] += getNetExpenseAmount(e);
    });
    
  state.transfers
    .filter(t => getItemMonthKey(t) === monthKey)
    .forEach(t => {
       const d = Number(t.day) || 1;
       if (d <= daysInMonth) spending[d-1] += Number(t.amount || 0);
    });
    
  return spending;
}

// --- SOBERANIA BANCãRIA: O VALOR GASTO REAL ---
// Determina o gasto flexível real (Variável + Transf) com base na variaÇÃo do saldo (Dia 1 vs Hoje)
function getRealSpentEfficiency(targetDay = null) {
  const startSnapshot = getStartingSnapshot();
  const snapshots = getSnapshotsForMonth().slice().sort((a,b) => a.day - b.day);
  const today = getToday();
  const currentDay = isActiveMonthCurrent() ? today.getDate() : 31;
  const elapsedDays = Math.min(targetDay || currentDay, 31);
  
  const snapshotsUntilTarget = snapshots.filter(s => s.day <= elapsedDays);
  const latestSnapshot = snapshotsUntilTarget.length ? snapshotsUntilTarget[snapshotsUntilTarget.length - 1] : null;

  // Se não houver snapshots, fallback para o que está registado
  if (!startSnapshot || !latestSnapshot || latestSnapshot.day <= startSnapshot.day) {
      return sumVariableExpenses() + sumTransfers();
  }

  // CãLCULO MESTRE: (Saldo 1 + Ganhos) - Saldo Atual = Dinheiro que SUCUMBIU/SAIU
  const startBal = Number(startSnapshot.bankBalance || 0) + Number(startSnapshot.cashBalance || 0);
  const currentBal = Number(latestSnapshot.bankBalance || 0) + Number(latestSnapshot.cashBalance || 0);
  const incomesUntilSnap = sumIncomesUntil(latestSnapshot.day, true);
  
  const grossOutflow = (startBal - currentBal) + incomesUntilSnap;
  
  // Subtrair as despesas fixas reais pagas até ao momento do snapshot
  const fixedPaidUntilSnap = sumFixedExpensesUntil(latestSnapshot.day);
  
  // O que resta é o que foi gasto de forma flexível (Variáveis + Transferãªncias + Eventuais Esquecimentos)
  const realFlexibleSpent = Math.max(grossOutflow - fixedPaidUntilSnap, 0);
  
  // Segurança: se o registado for MAIOR (ex: pagou mas ainda não caiu no banco), usamos o registado.
  const recordedFlexibleSpent = sumExpensesUntil(latestSnapshot.day) + sumTransfersUntil(latestSnapshot.day);
  
  return Math.max(realFlexibleSpent, recordedFlexibleSpent);
}

// KPI: Taxa de Poupança (Savings Rate)
function calculateSavingsRate() {
  const budget = calculateBudget();
  
  // RENDIMENTO FRESCO: Apenas o que ganhou este mês (Salário + Extras Reais), 
  // excluindo a "TransiÇÃo Excedente" de meses passados para não inflacionar o denominador.
  const salary = Number(state.salary) || 0;
  const extraIncomesFresh = state.incomes
    .filter(i => getItemMonthKey(i) === getMonthKey() && !i.name.includes("TransiÇÃo Excedente"))
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    
  const incomeTotalFresh = salary + extraIncomesFresh;
  if (incomeTotalFresh <= 0) return 0;
  
  // ECONOMIA REAL = Rendimento Fresco - Gasto Real (VariaÇÃo de Saldo + Fixas provisionadas)
  const realFlexSpent = getRealSpentEfficiency();
  const fixedProvision = budget.fixedExpenses || 0;
  
  const totalConsumption = realFlexSpent + fixedProvision;
  const savingsAmount = Math.max(incomeTotalFresh - totalConsumption, 0);

  return Math.min((savingsAmount / incomeTotalFresh) * 100, 100);
}

// KPI: Autonomia Financeira (Financial Runway)
function calculateFinancialRunway() {
  const netWorth = getGlobalAccountsTotal();
  const budget = calculateBudget();
  
  const salary = Number(state.salary) || 0;
  const realFlexSpent = getRealSpentEfficiency();
  const currentTotalCost = (budget.fixedExpenses || 0) + realFlexSpent;
  
  const estimatedMonthlyCost = Math.max(currentTotalCost, salary);
  if (estimatedMonthlyCost <= 0) return null;

  return { 
    months: netWorth / estimatedMonthlyCost, 
    monthlyCost: estimatedMonthlyCost, 
    netWorth,
    basedOn: estimatedMonthlyCost === salary ? "Salário (Baseline)" : "Gasto Real Bancário"
  };
}

// KPI: Fundo de Emergãªncia (meta configurável, default 6 meses)
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
  
  // Agrupar por dia para encontrar o último dia do mês que tem registos
  const days = prevSnaps.map(s => Number(s.day));
  const lastDay = Math.max(...days);
  const lastSnaps = prevSnaps.filter(s => Number(s.day) === lastDay);
  
  // Totais por conta e isolamento de Cash
  const accountTotals = {};
  let totalCash = 0;

  lastSnaps.forEach(s => {
    // NormalizaÇÃo da identidade (Legado vs Moderno)
    const modernAccount = state.accounts.find(acc => acc.id === s.accountId || acc.name === s.accountName);
    const id = modernAccount ? modernAccount.id : (s.accountId || s.accountName || 'legacy');
    
    const val = Number(s.bankBalance) || 0;
    
    // Identificar se esta conta é do tipo "Dinheiro" para preencher o campo de cash no auto-fill
    const acc = modernAccount || state.accounts.find(a => a.id === id);
    if (acc && acc.type === "Dinheiro") {
        totalCash += val;
    } else {
        accountTotals[id] = val;
    }
  });
  
  return { accountTotals, totalCash, day: lastDay, monthKey: prevKey };
}

// A inicialização do estado foi movida para o topo para garantir disponibilidade imediata.

function renderGlobalExtract() {
  const container = document.querySelector("#extractTableBody");
  if (!container) return;

  const filter = window.activeExtractFilter || 'all';
  
  // Unificar dados
  const timeline = [];
  
  state.incomes.forEach(i => timeline.push({ ...i, type: 'income', typeLabel: 'Entrada' }));
  state.expenses.forEach(e => timeline.push({ ...e, type: e.kind === 'fixed' ? 'fixed' : 'variable', typeLabel: e.kind === 'fixed' ? 'Fixa' : 'Variável' }));
  state.transfers.forEach(t => timeline.push({ ...t, type: 'transfer', typeLabel: 'Transferãªncia' }));

  // Ordenar cronologicamente ASC para cálculo do saldo
  timeline.sort((a, b) => {
    const keyA = (getItemMonthKey(a) || "0000-00") + String(a.day || 0).padStart(2, "0");
    const keyB = (getItemMonthKey(b) || "0000-00") + String(b.day || 0).padStart(2, "0");
    return keyA.localeCompare(keyB);
  });

  // Cálculo de saldo acumulado (VariaÇÃo líquida acumulada)
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
  if (typeof state === 'undefined' || !state || !Array.isArray(state.accounts)) return 0;
  return state.accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
}
if (typeof window !== 'undefined') {
  window.getGlobalAccountsTotal = getGlobalAccountsTotal;
}





if (typeof render === 'function' && typeof document !== 'undefined' && document.querySelector) {
  try {
     render();
     initAutofillBanner();
  } catch (e) {
     console.error("[Core] Falha crítica na renderização inicial:", e);
  }
}

function toggleFixedPayment(obligation, isChecked) {
    const monthKey = getMonthKey();
    
    if (isChecked) {
        // Registar Pagamento
        const newExpense = {
            id: generateUUID(),
            name: obligation.name,
            amount: obligation.amount,
            day: obligation.day,
            dateLabel: getDefaultMonthDate(obligation.day),
            category: "Obrigações Fixas",
            kind: "fixed",
            linkedObligationId: obligation.id
        };
        state.expenses.push(newExpense);
    } else {
        // Remover Pagamento
        state.expenses = state.expenses.filter(e => {
            const isMatch = e.kind === 'fixed' && 
                           getItemMonthKey(e) === monthKey && 
                           (e.linkedObligationId === obligation.id || e.name === obligation.name);
            return !isMatch;
        });
    }
    
    saveState();
    render();
}


