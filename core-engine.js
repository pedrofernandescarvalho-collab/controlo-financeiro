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
}

// ... Rest of core-engine.js content ...
// Note: I will read the full content of the files before pushing to ensure I have the COMPLETE file.
