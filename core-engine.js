/* core-engine.js - Motor de Cálculo e Gestão de Estado Financeiro */
// Versão Otimizada com Auditoria de Precisão Financeira

// --- CONSTANTES E CONFIGURAÇÃO ---
const STORAGE_KEY = "finance-control-app";
const DEFAULT_CATEGORY = "Geral";

// --- ESTADO DA APLICAÇÃO ---
const defaultState = {
  salary: 0,
  revolutShare: 0,
  xtbShare: 0,
  accounts: [], // { id, name, type, balance }
  expenses: [], // { id, name, amount, day, monthKey, category, kind: 'fixed'|'variable' }
  incomes: [],  // { id, name, amount, day, monthKey }
  transfers: [], // { id, name, amount, day, monthKey }
  snapshots: [], // { id, monthKey, day, date, accountId, accountName, bankBalance, cashBalance }
  categories: ["Alimentação", "Casa", "Lazer", "Transporte", "Saúde", "Educação", "Assinaturas"],
  receivables: [], // { id, name, amount, status: 'pending'|'received', linkedExpenseId }
  recurringFixed: [], // { id, name, amount, day, frequency: 'monthly'|'annual'|'semi-annual', startMonth }
  investments: [], // { id, ticker, qty, avgPrice, type }
  priceCache: {},
  finnhubApiKey: ""
};

let state = loadState();

// Identificar se estamos no browser para expor o estado global
if (typeof window !== 'undefined') {
    window.state = state;
}

// --- UTILITÁRIOS DE PERSISTÊNCIA ---
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { ...defaultState };
  try {
    const parsed = JSON.parse(saved);
    return { ...defaultState, ...parsed };
  } catch (e) {
    console.error("Erro ao carregar estado:", e);
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Notificar outros componentes da mudança
  window.dispatchEvent(new CustomEvent('stateUpdated', { detail: state }));
}

// --- UTILITÁRIOS DE DATA E MOEDA ---
function getToday() { return new Date(); }

function getMonthKey(date = getToday()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getActiveMonthParts() {
    // Se houver um filtro de mês ativo na UI (dashboard), usamos esse
    const activeKey = (typeof window !== 'undefined' && window.dashboardMonthKey) || getMonthKey();
    const [year, month] = activeKey.split('-').map(Number);
    return { year, month, key: activeKey };
}

function getDayFromDateInput(val) {
  if (!val) return 1;
  return new Date(val).getDate();
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function getItemMonthKey(item) {
    if (item.monthKey) return item.monthKey;
    if (item.dateLabel) return item.dateLabel.substring(0, 7);
    return getMonthKey();
}

// --- MOTOR DE CÁLCULO ---

/**
 * CÁLCULO DE ORÇAMENTO DISPONÍVEL (MÉTRICA "RESERVA E INVESTIMENTO")
 * Baseia-se no rendimento líquido esperado e deduz as obrigações fixas.
 */
function calculateBudget() {
    const { key: monthKey } = getActiveMonthParts();
    
    const salary = Number(state.salary) || 0;
    const extraIncomes = state.incomes
        .filter(i => getItemMonthKey(i) === monthKey)
        .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    
    const totalIncome = salary + extraIncomes;
    
    // Obrigações Fixas (Provisionadas)
    const fixedExpenses = sumFixedMonthlyExpenses(monthKey);
    
    // Despesas Variáveis Registadas
    const variableExpenses = state.expenses
        .filter(e => getItemMonthKey(e) === monthKey && e.kind !== 'fixed')
        .reduce((sum, e) => sum + getNetExpenseAmount(e), 0);
        
    // Transferências
    const transferExpenses = state.transfers
        .filter(t => getItemMonthKey(t) === monthKey)
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const disposableMonthlyBudget = Math.max(totalIncome - fixedExpenses, 0);
    const leftover = totalIncome - (fixedExpenses + variableExpenses + transferExpenses);
    
    const daysInMonth = new Date(getActiveMonthParts().year, getActiveMonthParts().month, 0).getDate();
    const dailyBudget = disposableMonthlyBudget / daysInMonth;

    return {
        income: totalIncome,
        fixedExpenses,
        variableExpenses,
        transferExpenses,
        disposableMonthlyBudget,
        leftover,
        dailyBudget,
        revolutAllocation: disposableMonthlyBudget * (state.revolutShare / 100),
        xtbAllocation: disposableMonthlyBudget * (state.xtbShare / 100)
    };
}

/**
 * SOMA DE OBRIGAÇÕES FIXAS
 * Considera obrigações mensais, anuais (1/12) e semestrais (1/6).
 */
function sumFixedMonthlyExpenses(monthKey = null) {
  const mk = monthKey || getMonthKey();
  
  // 1. Obrigações Ativas (Registadas como fixas no formulário de despesas)
  const registeredFixed = state.expenses
    .filter(e => getItemMonthKey(e) === mk && e.kind === 'fixed')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    
  // 2. Obrigações Recorrentes Provisionadas (Sistema de Radar)
  const provisionedFixed = state.recurringFixed.reduce((sum, item) => {
      const frequency = item.frequency || 'monthly';
      const amount = Number(item.amount) || 0;
      
      if (frequency === 'monthly') return sum + amount;
      if (frequency === 'annual') return sum + (amount / 12);
      if (frequency === 'semi-annual') return sum + (amount / 6);
      return sum;
  }, 0);

  // Se já registámos o gasto fixo, ele "consome" a provisão para não duplicar no radar
  // Mas para o cálculo de orçamento, retornamos a provisão teórica total.
  return Math.max(registeredFixed, provisionedFixed);
}

/**
 * VALOR LÍQUIDO DE DESPESA
 * Subtrai o que está por receber (divisão de gastos) para mostrar o custo real.
 */
function getNetExpenseAmount(expense) {
    if (!expense) return 0;
    const baseAmount = Number(expense.amount) || 0;
    
    // Procurar recebíveis associados a esta despesa (partilha de conta)
    const linkedReceivablesTotal = state.receivables
        .filter(r => r.linkedExpenseId === expense.id)
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        
    return Math.max(baseAmount - linkedReceivablesTotal, 0);
}

function calculateObligationsStatus(monthKey = null) {
    const mk = monthKey || getMonthKey();
    const currentMonth = Number(mk.split("-")[1]);
    
    const stats = {
        totalProvision: 0,
        paidAmount: 0,
        pendingAmount: 0,
        progressPercent: 0
    };

    state.recurringFixed.forEach(item => {
        const amount = Number(item.amount) || 0;
        const sm = Number(item.startMonth) || 1;
        
        let isDueThisMonth = false;
        if (item.frequency === 'monthly') isDueThisMonth = true;
        else if (item.frequency === 'annual' && currentMonth === sm) isDueThisMonth = true;
        else if (item.frequency === 'semi-annual' && (currentMonth === sm || currentMonth === (sm + 6 > 12 ? sm - 6 : sm + 6))) isDueThisMonth = true;

        if (isDueThisMonth) {
            stats.totalProvision += amount;
            // Verificar se existe despesa paga associada
            const paid = state.expenses.find(e => e.kind === 'fixed' && getItemMonthKey(e) === mk && (e.linkedObligationId === item.id || e.name === item.name));
            if (paid) stats.paidAmount += Number(paid.amount);
        } else {
            // Provisionamento apenas (para o budget)
            const div = item.frequency === 'annual' ? 12 : 6;
            stats.totalProvision += (amount / div);
        }
    });

    stats.pendingAmount = Math.max(stats.totalProvision - stats.paidAmount, 0);
    stats.progressPercent = stats.totalProvision > 0 ? (stats.paidAmount / stats.totalProvision) * 100 : 0;
    
    return stats;
}

// --- GESTÃO DE UI E RENDERIZAÇÃO ---

function render() {
  if (typeof syncForms === 'function') syncForms();
  
  renderNetWorth();
  
  // Renderizadores de Listas (Existentes no core ou backup)
  if (typeof renderSummary === 'function') renderSummary();
  if (typeof renderAnalysis === 'function') renderAnalysis();
  if (typeof renderSnapshots === 'function') renderSnapshots();
  if (typeof renderCategories === 'function') renderCategories();
  if (typeof renderAccounts === 'function') renderAccounts();
  if (typeof renderReceivables === 'function') renderReceivables();
  if (typeof renderExpenses === 'function') renderExpenses();
  if (typeof renderTransfers === 'function') renderTransfers();
  if (typeof renderIncomes === 'function') renderIncomes();
  
  // Compatibilidade com Dashboard (KPIs em charts.js disparados por evento ou observador)
  window.dispatchEvent(new CustomEvent('stateUpdated', { detail: state }));
}

function renderNetWorth() {
  const el = document.querySelector(\"#globalNetWorthDisplay\");
  const cockpitEl = document.querySelector(\"#cockpitNetWorth\");
  if (!el && !cockpitEl) return;
  
  const totalWealth = getGlobalAccountsTotal();
  const receivablesTotal = state.receivables
    .filter(r => r.status !== \"received\")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
  const globalTotal = totalWealth + receivablesTotal;
  const formatted = formatCurrency(globalTotal);
  
  if (el) el.textContent = formatted;
  if (cockpitEl) cockpitEl.textContent = formatted;
}

function getGlobalAccountsTotal() {
  if (typeof state === 'undefined' || !state) return 0;
  
  // 1. Bancos e Poupanças (Contas explícitas)
  let total = Array.isArray(state.accounts) ? state.accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0) : 0;
  
  // 2. Dinheiro em Mão (Último snapshot registado)
  const snapshots = getSnapshotsForMonth();
  if (snapshots.length > 0) {
      const latestSnap = snapshots.sort((a,b) => b.day - a.day)[0];
      total += (Number(latestSnap.cashBalance) || 0);
  }

  // 3. Investimentos (Ativos no Pro 360)
  if (Array.isArray(state.investments)) {
      state.investments.forEach(asset => {
          const price = (state.priceCache && state.priceCache[asset.ticker.toUpperCase()]) || asset.avgPrice;
          total += (Number(asset.qty) || 0) * (Number(price) || 0);
      });
  }
  
  return total;
}

// --- FUNÇÕES DE APOIO ---

function updateAccountBalance(accountId, newBalance) {
    const acc = state.accounts.find(a => a.id === accountId);
    if (acc) {
        acc.balance = newBalance;
        saveState();
    }
}

function isCurrentMonthDate(dateStr) {
    if (!dateStr) return false;
    return dateStr.substring(0, 7) === getMonthKey();
}

function isActiveMonthCurrent() {
    const { key } = getActiveMonthParts();
    return key === getMonthKey();
}

function getSnapshotsForMonth(monthKey = null) {
    const mk = monthKey || getActiveMonthParts().key;
    return (state.snapshots || []).filter(s => s.monthKey === mk);
}

function getStartingSnapshot() {
    const snapshots = getSnapshotsForMonth();
    if (!snapshots.length) return null;
    return snapshots.sort((a,b) => a.day - b.day)[0];
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getDefaultMonthDate(day = null) {
    const { year, month } = getActiveMonthParts();
    const d = day || (isActiveMonthCurrent() ? getToday().getDate() : 1);
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseFormattedNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Replace comma with dot for calculation and remove currency symbols
    return Number(val.replace(/[€\s]/g, '').replace(',', '.'));
}

function setStatus(selector, message, duration = 3000) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.textContent = message;
    el.style.opacity = '1';
    setTimeout(() => { if (el) el.style.opacity = '0'; }, duration);
}

function showToast(message) {
    const toast = document.createElement(\"div\");
    toast.className = \"toast-notification\";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add(\"active\"), 100);
    setTimeout(() => {
        toast.classList.remove(\"active\");
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- INICIALIZAÇÃO ---

document.addEventListener('DOMContentLoaded', () => {
    // Garantir que temos categorias se o estado for novo
    if (state.categories.length === 0) state.categories = defaultState.categories;
    
    render();
    
    // Configurar o filtro de período se estiver no dashboard
    const periodSelect = document.querySelector(\"#periodFilter\");
    if (periodSelect) {
        periodSelect.addEventListener(\"change\", () => {
            window.activePeriodFilter = periodSelect.value;
            render();
        });
    }
});

// Tornar funções globais para serem chamadas por outros scripts (ex: script.js Legado)
Object.assign(window, {
    calculateBudget,
    sumFixedMonthlyExpenses,
    getNetExpenseAmount,
    calculateObligationsStatus,
    getGlobalAccountsTotal,
    render,
    saveState,
    state,
    formatCurrency,
    getMonthKey,
    getActiveMonthParts,
    getItemMonthKey,
    getDayFromDateInput,
    updateAccountBalance,
    isCurrentMonthDate,
    isActiveMonthCurrent,
    getSnapshotsForMonth,
    getStartingSnapshot,
    generateUUID,
    getDefaultMonthDate,
    parseFormattedNumber,
    setStatus,
    showToast,
    calculateSavingsRate,
    calculateTotalIncome,
    getRealSpentEfficiency,
    calculateFinancialRunway,
    calculateEmergencyFundProgress,
    getLeakageStatus,
    getCalendarSlices,
    getFlexibleSpentInPeriod,
    getDailySpendingData
});

// Funções de Cálculo Adicionais para o Dashboard

function calculateTotalIncome(monthKey = null) {
  const mk = monthKey || getMonthKey();
  const salary = Number(state.salary) || 0;
  const extraIncomes = state.incomes
    .filter(i => getItemMonthKey(i) === mk && !i.name.includes(\"Transição Excedente\"))
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
  return salary + extraIncomes;
}

function calculateSavingsRate() {
  const budget = calculateBudget();
  const incomeTotalFresh = calculateTotalIncome();
  
  if (incomeTotalFresh <= 0) return 0;
  
  const realFlexSpent = getRealSpentEfficiency();
  const fixedProvision = budget.fixedExpenses || 0;
  
  const totalConsumption = realFlexSpent + fixedProvision;
  const savingsAmount = Math.max(incomeTotalFresh - totalConsumption, 0);

  return Math.min((savingsAmount / incomeTotalFresh) * 100, 100);
}

function getRealSpentEfficiency(targetDay = null) {
  const startSnapshot = getStartingSnapshot();
  const snapshots = getSnapshotsForMonth().slice().sort((a,b) => a.day - b.day);
  const today = getToday();
  const currentDay = isActiveMonthCurrent() ? today.getDate() : 31;
  const elapsedDays = Math.min(targetDay || currentDay, 31);
  
  const snapshotsUntilTarget = snapshots.filter(s => s.day <= elapsedDays);
  const latestSnapshot = snapshotsUntilTarget.length ? snapshotsUntilTarget[snapshotsUntilTarget.length - 1] : null;

  if (!startSnapshot || !latestSnapshot || latestSnapshot.day <= startSnapshot.day) {
      return sumVariableExpenses(null, elapsedDays) + sumTransfers(null, elapsedDays);
  }

  const startBal = Number(startSnapshot.bankBalance || 0) + Number(startSnapshot.cashBalance || 0);
  const currentBal = Number(latestSnapshot.bankBalance || 0) + Number(latestSnapshot.cashBalance || 0);
  
  // Incomes until the day of the latest snapshot
  const incomesUntilSnap = state.incomes
    .filter(i => getItemMonthKey(i) === getActiveMonthParts().key && i.day <= latestSnapshot.day)
    .reduce((sum, i) => sum + Number(i.amount || 0), 0) + (Number(state.salary) || 0);
  
  const grossOutflow = (startBal - currentBal) + incomesUntilSnap;
  
  const fixedPaidUntilSnap = state.expenses
    .filter(e => getItemMonthKey(e) === getActiveMonthParts().key && e.day <= latestSnapshot.day && e.kind === 'fixed')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  
  const realFlexibleSpent = Math.max(grossOutflow - fixedPaidUntilSnap, 0);
  const recordedFlexibleSpent = sumVariableExpenses(null, latestSnapshot.day) + sumTransfers(null, latestSnapshot.day);
  
  return Math.max(realFlexibleSpent, recordedFlexibleSpent);
}

function sumVariableExpenses(monthKey = null, untilDay = 31) {
    const mk = monthKey || getActiveMonthParts().key;
    return state.expenses
        .filter(e => getItemMonthKey(e) === mk && e.day <= untilDay && e.kind !== 'fixed')
        .reduce((sum, e) => sum + getNetExpenseAmount(e), 0);
}

function sumTransfers(monthKey = null, untilDay = 31) {
    const mk = monthKey || getActiveMonthParts().key;
    return state.transfers
        .filter(t => getItemMonthKey(t) === mk && t.day <= untilDay)
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

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
    basedOn: estimatedMonthlyCost === salary ? \"Salário (Baseline)\" : \"Gasto Real Bancário\"
  };
}

function calculateEmergencyFundProgress(targetMonths = 6) {
  const runway = calculateFinancialRunway();
  if (!runway) return { pct: 0, months: 0, target: targetMonths, ok: false };
  const pct = Math.min((runway.months / targetMonths) * 100, 100);
  return { pct, months: runway.months, target: targetMonths, ok: runway.months >= targetMonths };
}

function getLeakageStatus() {
  const snapshots = getSnapshotsForMonth();
  if (snapshots.length < 2) return null;
  
  const sorted = snapshots.sort((a,b) => a.day - b.day);
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  
  const startBal = Number(start.bankBalance || 0) + Number(start.cashBalance || 0);
  const endBal = Number(end.bankBalance || 0) + Number(end.cashBalance || 0);
  
  const incomes = state.incomes
    .filter(i => getItemMonthKey(i) === start.monthKey && i.day > start.day && i.day <= end.day)
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    
  const expenses = state.expenses
    .filter(e => getItemMonthKey(e) === start.monthKey && e.day > start.day && e.day <= end.day)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const transfers = state.transfers
      .filter(t => getItemMonthKey(t) === start.monthKey && t.day > start.day && t.day <= end.day)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  
  const expectedEndBal = startBal + incomes - expenses - transfers;
  const gap = endBal - expectedEndBal;
  const absGap = Math.abs(gap);
  
  if (absGap <= 1) return { type: 'success', message: 'Contas batem certo.' };
  if (gap < 0) return { type: 'warning', message: `Fuga de Capital: ${formatCurrency(absGap)} por registar.` };
  return { type: 'info', message: `Excesso Registado: ${formatCurrency(absGap)} a mais face ao saldo.` };
}

function getCalendarSlices() {
    const { year, month } = getActiveMonthParts();
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Fatias semanais: 1-7, 8-14, 15-21, 22-fim
    return [
        { start: 1, end: 7 },
        { start: 8, end: 14 },
        { start: 15, end: 21 },
        { start: 22, end: daysInMonth }
    ];
}

function getFlexibleSpentInPeriod(startDay, endDay, targetMonthKey = null) {
  const monthKey = targetMonthKey || getActiveMonthParts().key;
  
  const expenses = state.expenses
    .filter(e => getItemMonthKey(e) === monthKey && e.day >= startDay && e.day <= endDay && e.kind !== 'fixed')
    .reduce((s, e) => s + getNetExpenseAmount(e), 0);
    
  const transfers = state.transfers
    .filter(t => getItemMonthKey(t) === monthKey && t.day >= startDay && t.day <= endDay)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
    
  return expenses + transfers;
}

function getDailySpendingData(targetMonthKey = null) {
  const monthKey = targetMonthKey || getActiveMonthParts().key;
  const { year, month } = getActiveMonthParts();
  const daysInMonth = new Date(year, month, 0).getDate();
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

// System rendering functions

function renderSummary() {
    const budget = calculateBudget();
    
    const incomeEl = document.querySelector(\"#summaryIncome\");
    const fixedEl = document.querySelector(\"#summaryFixed\");
    const variableEl = document.querySelector(\"#summaryVariable\");
    const leftoverEl = document.querySelector(\"#summaryLeftover\");
    
    if (incomeEl) incomeEl.textContent = formatCurrency(budget.income);
    if (fixedEl) fixedEl.textContent = formatCurrency(budget.fixedExpenses);
    if (variableEl) variableEl.textContent = formatCurrency(budget.variableExpenses);
    if (leftoverEl) {
        leftoverEl.textContent = formatCurrency(budget.leftover);
        leftoverEl.className = `value ${budget.leftover >= 0 ? \"positive\" : \"negative\"}`;
    }
}

function renderAnalysis() {
    const efficiency = calculateSavingsRate();
    const runway = calculateFinancialRunway();
    const emergency = calculateEmergencyFundProgress();
    
    const efficiencyEl = document.querySelector(\"#analysisEfficiency\");
    const runwayEl = document.querySelector(\"#analysisRunway\");
    const emergencyEl = document.querySelector(\"#emergencyFundBar\");
    const emergencyText = document.querySelector(\"#emergencyFundText\");
    
    if (efficiencyEl) {
        efficiencyEl.textContent = `${efficiency.toFixed(1)}%`;
        efficiencyEl.className = `value ${efficiency >= 20 ? \"positive\" : (efficiency > 0 ? \"neutral\" : \"negative\")}`;
    }
    
    if (runwayEl) {
        if (runway && runway.months !== null) {
            runwayEl.textContent = runway.months === Infinity ? \"∞ Meses\" : `${runway.months.toFixed(1)} Meses`;
        } else {
            runwayEl.textContent = \"N/D\";
        }
    }

    if (emergencyEl && emergency) {
        emergencyEl.style.width = `${emergency.pct}%`;
        if (emergencyText) {
            emergencyText.textContent = `${emergency.months.toFixed(1)} de ${emergency.target} meses (Meta)`;
        }
    }
}

function renderExpenses() {
  const container = document.querySelector(\"#expensesList\");
  if (!container) return;
  container.innerHTML = \"\";

  const { key: activeKey } = getActiveMonthParts();
  const expenses = state.expenses
    .filter(e => getItemMonthKey(e) === activeKey)
    .sort((a, b) => a.day - b.day);

  if (expenses.length === 0) {
    container.innerHTML = `<div class=\"empty-state\">Sem despesas este mês.</div>`;
    return;
  }

  const tpl = document.querySelector(\"#item-template\");
  expenses.forEach(expense => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector(\".item-title\").textContent = expense.name;
    node.querySelector(\".item-subtitle\").textContent = `${expense.category} | Dia ${expense.day}`;
    node.querySelector(\".item-value\").textContent = formatCurrency(getNetExpenseAmount(expense));
    
    node.querySelector(\".ghost-btn\").addEventListener(\"click\", () => {
      if(confirm(`Remover despesa \"${expense.name}\"?`)) {
        state.expenses = state.expenses.filter(e => e.id !== expense.id);
        saveState();
        render();
      }
    });

    container.appendChild(node);
  });
}

function renderIncomes() {
  const container = document.querySelector(\"#incomesList\");
  if (!container) return;
  container.innerHTML = \"\";

  const { key: activeKey } = getActiveMonthParts();
  const incomes = state.incomes
    .filter(i => getItemMonthKey(i) === activeKey)
    .sort((a, b) => a.day - b.day);

  if (incomes.length === 0 && Number(state.salary) <= 0) {
    container.innerHTML = `<div class=\"empty-state\">Sem ganhos este mês.</div>`;
    return;
  }

  const tpl = document.querySelector(\"#item-template\");
  
  // Show Salary if it exists
  if (Number(state.salary) > 0) {
      const sNode = tpl.content.firstElementChild.cloneNode(true);
      sNode.querySelector(\".item-title\").textContent = \"Salário Base\";
      sNode.querySelector(\".item-subtitle\").textContent = \"Recorrente\";
      sNode.querySelector(\".item-value\").textContent = formatCurrency(state.salary);
      sNode.querySelector(\".ghost-btn\").style.display = 'none';
      container.appendChild(sNode);
  }

  incomes.forEach(income => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector(\".item-title\").textContent = income.name;
    node.querySelector(\".item-subtitle\").textContent = `Dia ${income.day}`;
    node.querySelector(\".item-value\").textContent = formatCurrency(income.amount);
    
    node.querySelector(\".ghost-btn\").addEventListener(\"click\", () => {
      if(confirm(`Remover ganho \"${income.name}\"?`)) {
        state.incomes = state.incomes.filter(i => i.id !== income.id);
        saveState();
        render();
      }
    });

    container.appendChild(node);
  });
}

function renderReceivables() {
  const container = document.querySelector(\"#receivablesList\");
  if (!container) return;
  container.innerHTML = \"\";

  const receivables = state.receivables.filter(r => r.status === 'pending');

  if (receivables.length === 0) {
    container.innerHTML = `<div class=\"empty-state\">Tudo liquidado!</div>`;
    return;
  }

  const tpl = document.querySelector(\"#item-template\");
  receivables.forEach(r => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector(\".item-title\").textContent = r.name;
    node.querySelector(\".item-subtitle\").textContent = \"Pendente\";
    node.querySelector(\".item-value\").textContent = formatCurrency(r.amount);
    
    const btn = node.querySelector(\".ghost-btn\");
    btn.textContent = \"Receber\";
    btn.addEventListener(\"click\", () => {
      r.status = 'received';
      saveState();
      render();
      showToast(`Recebido: ${r.name}`);
    });

    container.appendChild(node);
  });
}

function renderAccounts() {
    const container = document.querySelector(\"#accountsList\");
    if (!container) return;
    container.innerHTML = \"\";

    if (!state.accounts.length) {
        container.innerHTML = '<div class=\"empty-state\">Nenhuma conta configurada.</div>';
        return;
    }

    const tpl = document.querySelector(\"#item-template\");
    state.accounts.forEach(acc => {
        const node = tpl.content.firstElementChild.cloneNode(true);
        node.querySelector(\".item-title\").textContent = acc.name;
        node.querySelector(\".item-subtitle\").textContent = acc.type;
        node.querySelector(\".item-value\").textContent = formatCurrency(acc.balance);
        
        node.querySelector(\".ghost-btn\").addEventListener(\"click\", () => {
            if(confirm(`Remover conta \"${acc.name}\"?`)) {
                state.accounts = state.accounts.filter(a => a.id !== acc.id);
                saveState();
                render();
            }
        });
        container.appendChild(node);
    });
}
