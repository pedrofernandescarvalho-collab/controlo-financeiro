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
    .sort((a, b) => {
       const keyA = (getItemMonthKey(a) || "0000-00") + String(a.day || 0).padStart(2, "0");
       const keyB = (getItemMonthKey(b) || "0000-00") + String(b.day || 0).padStart(2, "0");
       return keyA.localeCompare(keyB);
    });

  if (allMonthExpenses.length === 0) {
    if (variableContainer) {
      variableContainer.innerHTML = `<div class="empty-state">Ainda não existem despesas registadas para este período.</div>`;
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
      if(confirm(`Eliminar despesa "${expense.name}"?`)) {
          state.expenses = state.expenses.filter((item) => item.id !== expense.id);
          saveState();
          render();
      }
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

    if (expense.kind !== "fixed" && variableContainer) {
        variableContainer.appendChild(node);
    }
  });

  // Chamar renderização de obrigações fixas se o contentor existir
  renderFixedObligations();
}

function renderFixedObligations() {
  const container = document.querySelector("#fixedExpensesList");
  if (!container) return;
  container.innerHTML = "";
  
  const monthKey = getMonthKey();
  const freqLabels = { monthly: "Mensal", annual: "Anual", "semi-annual": "Semestral" };

  // 1. Obrigações Ativas (state.recurringFixed)
  state.recurringFixed.forEach(item => {
      const month = Number(getMonthKey().split("-")[1]);
      const sm = Number(item.startMonth) || 1;
      
      const isCurrentPayment = item.frequency === 'monthly' ||
        (item.frequency === 'annual' && month === sm) ||
        (item.frequency === 'semi-annual' && (month === sm || month === (sm + 6 > 12 ? sm - 6 : sm + 6)));

      const paid = state.expenses.find(e => e.kind === 'fixed' && getItemMonthKey(e) === monthKey && (e.linkedObligationId === item.id || e.name === item.name));

      const node = template.content.firstElementChild.cloneNode(true);
      node.querySelector(".item-title").textContent = item.name;
      
      if (isCurrentPayment) {
          node.querySelector(".item-subtitle").textContent = `${freqLabels[item.frequency] || "Fixa"} | Vence dia ${item.day}`;
          node.querySelector(".item-value").textContent = formatCurrency(item.amount);
          
          if (paid) {
              node.classList.add("paid");
              node.querySelector(".item-title").innerHTML += ` <span class="badge badge-success">Paga ✅</span>`;
              node.style.opacity = "0.7";
          }
      } else {
          // Provisionamento para análise
          const div = item.frequency === 'annual' ? 12 : 6;
          const prov = item.amount / div;
          node.querySelector(".item-subtitle").textContent = `Provisão (${freqLabels[item.frequency]})`;
          node.querySelector(".item-value").textContent = formatCurrency(prov);
          node.style.opacity = "0.5";
          node.style.fontStyle = "italic";
      }

      // Handler para eliminar a obrigação recorrente
      node.querySelector(".ghost-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          if(confirm(`Eliminar obrigação recorrente "${item.name}"?`)) {
              state.recurringFixed = state.recurringFixed.filter(f => f.id !== item.id);
              saveState();
              render();
          }
      });

      container.appendChild(node);
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

// Configuração de botões de Soberania (Export / Import)
document.addEventListener('click', (e) => {
    if (e.target.id === 'exportBackupBtn') exportData();
    if (e.target.id === 'importBackupBtn') {
        const input = document.getElementById('importFile');
        if (input) input.click();
    }
});

// Listener vital para o processamento do ficheiro selecionado
document.addEventListener('change', (e) => {
    if (e.target.id === 'importFile') {
        importData(e);
    }
});

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
    const fmt = formatCurrency;
    const totalBank = Object.values(prev.accountTotals).reduce((s, v) => s + v, 0);
    if (desc) {
      desc.textContent = `Saldo final de ${prev.monthKey}: ${fmt(totalBank)} banco + ${fmt(prev.totalCash)} carteira. Usar como ponto de partida?`;
    }
    btn.onclick = () => {
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

function calculateTotalIncome(monthKey = null) {
  const mk = monthKey || getMonthKey();
  const salary = Number(state.salary) || 0;
  const extraIncomes = state.incomes
    .filter(i => getItemMonthKey(i) === mk && !i.name.includes("Transição Excedente"))
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
  return salary + extraIncomes;
}

// KPI: Taxa de Poupança (Savings Rate)
function calculateSavingsRate() {
  const budget = calculateBudget();
  const incomeTotalFresh = calculateTotalIncome();
  
  if (incomeTotalFresh <= 0) return 0;
  
  // ECONOMIA REAL = Rendimento Fresco - Gasto Real (Variação de Saldo + Fixas provisionadas)
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

function getGlobalAccountsTotal() {
  if (typeof state === 'undefined' || !state) return 0;
  
  // 1. Bancos e Poupanças (Contas explícitas)
  let total = Array.isArray(state.accounts) ? state.accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0) : 0;
  
  // 2. Dinheiro em Mão (Último snapshot registado)
  const snapshots = getSnapshotsForMonth();
  if (snapshots.length > 0) {
      const latestSnap = snapshots.sort((a,b) => b.day - a.day)[0];
      // Apenas adicionamos se não estiver já refletido num saldo de conta (geralmente cash é id 'cash')
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

function renderNetWorth() {
  const el = document.querySelector("#globalNetWorthDisplay");
  const cockpitEl = document.querySelector("#cockpitNetWorth");
  if (!el && !cockpitEl) return;
  
  const totalWealth = getGlobalAccountsTotal();
  const receivablesTotal = state.receivables
    .filter(r => r.status !== "received")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
  const globalTotal = totalWealth + receivablesTotal;
  const formatted = formatCurrency(globalTotal);
  
  if (el) el.textContent = formatted;
  if (cockpitEl) cockpitEl.textContent = formatted;
}

function render() {
  if (typeof syncForms === 'function') syncForms();
  
  renderNetWorth();
  
  // Renderizadores de Listas (Existentes no core ou backup)
function renderSummary() {
    const budget = calculateBudget();
    
    const incomeEl = document.querySelector("#summaryIncome");
    const fixedEl = document.querySelector("#summaryFixed");
    const variableEl = document.querySelector("#summaryVariable");
    const leftoverEl = document.querySelector("#summaryLeftover");
    
    if (incomeEl) incomeEl.textContent = formatCurrency(budget.income);
    if (fixedEl) fixedEl.textContent = formatCurrency(budget.fixedExpenses);
    if (variableEl) variableEl.textContent = formatCurrency(budget.variableExpenses);
    if (leftoverEl) {
        leftoverEl.textContent = formatCurrency(budget.leftover);
        leftoverEl.className = `value ${budget.leftover >= 0 ? "positive" : "negative"}`;
    }

    // Auditoria: Mostrar aviso se houver discrepância (Leakage)
    renderLeakageWarning();
}

function renderLeakageWarning() {
    const container = document.querySelector("#leakageAlertContainer");
    if (!container) return;
    
    const status = getLeakageStatus();
    if (!status || status.type === 'success') {
        container.style.display = "none";
        return;
    }
    
    container.style.display = "flex";
    container.className = `alert-box alert-${status.type}`;
    container.innerHTML = `<strong>Atenção:</strong> ${status.message}`;
}

function renderAnalysis() {
    const budget = calculateBudget();
    const efficiency = calculateSavingsRate();
    const runway = calculateFinancialRunway();
    const emergency = calculateEmergencyFundProgress();
    
    const efficiencyEl = document.querySelector("#analysisEfficiency");
    const runwayEl = document.querySelector("#analysisRunway");
    const emergencyEl = document.querySelector("#emergencyFundBar");
    const emergencyText = document.querySelector("#emergencyFundText");
    
    if (efficiencyEl) {
        efficiencyEl.textContent = `${efficiency.toFixed(1)}%`;
        efficiencyEl.className = `value ${efficiency >= 20 ? "positive" : (efficiency > 0 ? "neutral" : "negative")}`;
    }
    
    if (runwayEl) {
        if (runway && runway.months !== null) {
            runwayEl.textContent = runway.months === Infinity ? "∞ Meses" : `${runway.months.toFixed(1)} Meses`;
            runwayEl.title = `Baseado em: ${runway.basedOn}`;
        } else {
            runwayEl.textContent = "N/D";
        }
    }

    if (emergencyEl && emergency) {
        emergencyEl.style.width = `${emergency.pct}%`;
        emergencyEl.className = `progress-bar ${emergency.ok ? "bg-success" : "bg-warning"}`;
        if (emergencyText) {
            emergencyText.textContent = `${emergency.months.toFixed(1)} de ${emergency.target} meses (Meta)`;
        }
    }
}
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
if (typeof window !== 'undefined') {
  window.getGlobalAccountsTotal = getGlobalAccountsTotal;
}

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
