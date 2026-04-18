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

// Navigation Guard: Avisar se houver sincronizaÃ§Ã£o pendente
window.addEventListener('beforeunload', (e) => {
  if (window.isSyncing) {
    // A maioria dos browsers modernos nÃ£o permite mensagens customizadas, 
    // mas isto despoleta o aviso padrÃ£o de "Tens alteraÃ§Ãµes nÃ£o guardadas".
    e.preventDefault();
    e.returnValue = '';
  }
});

window.saveState = saveState;

function getToday() {
  return new Date();
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

function isActiveMonthCurrent() {
  const today = getToday();
  const { year, month } = getActiveMonthParts();
  return year === today.getFullYear() && month === (today.getMonth() + 1);
}

function getActiveMonthParts() {
  const [yearText, monthText] = getActiveMonthKey().split("-");
  return {
    year: Number(yearText),
    month: Number(monthText)
  };
}

function getMonthKey() {
  return getActiveMonthKey();
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value) || 0);
}
