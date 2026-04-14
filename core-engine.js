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

function normalizeMonthKey(key) {
  if (!key || typeof key !== 'string') return key;
  const parts = key.split('-');
  if (parts.length !== 2) return key;
  return `${parts[0]}-${parts[1].padStart(2, '0')}`;
}

function migrateState(parsed) {
  console.log("[Core] A migrar estado importado...");
  const collections = ['expenses', 'incomes', 'snapshots', 'transfers', 'receivables'];
  collections.forEach(col => {
    if (Array.isArray(parsed[col])) {
      parsed[col].forEach(item => {
        if (item.monthKey) item.monthKey = normalizeMonthKey(item.monthKey);
      });
    } else {
        parsed[col] = [];
    }
  });

  if (parsed.analysisMonth) parsed.analysisMonth = normalizeMonthKey(parsed.analysisMonth);
  if (!parsed.accounts) parsed.accounts = [...defaultState.accounts];
  if (!parsed.categories) parsed.categories = [...defaultState.categories];

  // Identificar Cash Legacy
  const lastKnownCashTotal = Array.isArray(parsed.snapshots) 
    ? parsed.snapshots.reduce((max, s) => Math.max(max, Number(s.cashBalance) || 0), 0)
    : 0;

  let cashAccount = parsed.accounts.find(a => a.type === "Dinheiro" || a.name === "Dinheiro Vivo");
  if (!cashAccount) {
      cashAccount = {
          id: "acc-cash-physical",
          name: "Dinheiro Vivo (Carteira)",
          type: "Dinheiro",
          balance: lastKnownCashTotal
      };
      parsed.accounts.push(cashAccount);
  }

  console.log("[Core] Migração concluída com sucesso.");
  return parsed;
}

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

  console.log("[Import] Ficheiro selecionado:", file.name);
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      if (!content) throw new Error("Ficheiro vazio");
      
      let imported = JSON.parse(content);
      console.log("[Import] JSON parsed com sucesso.");

      // Validação mínima e Migração automática
      imported = migrateState(imported);

      if (confirm("Isto irá substituir os teus dados atuais e recarregar a página. Continuar?")) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
        console.log("[Import] Dados guardados no localStorage.");
        location.reload();
      }
    } catch (err) {
      console.error("[Import] Erro detalhado:", err);
      alert("Erro ao importar backup: " + err.message);
    } finally {
        // Limpar o input para permitir re-importar o mesmo ficheiro
        event.target.value = "";
    }
  };
  reader.onerror = () => alert("Erro ao ler o ficheiro.");
  reader.readAsText(file);
}

// Configuração de botões de Soberania (Delegado para garantir que funciona em qualquer momento)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    if (btn.id === 'exportBackupBtn') exportState();
    if (btn.id === 'importBackupBtn') {
        const input = document.getElementById('importFile');
        if (input) input.click();
    }
});

document.addEventListener('change', (e) => {
    if (e.target.id === 'importFile') importState(e);
});
