/**
 * ============================================================
 * SUITE DE TESTES COMPLETA â€” Controlo Financeiro v2
 * Usa escopo isolado para evitar conflitos com const/function do script.js
 * ============================================================
 */
'use strict';
const fs = require('fs');

// â”€â”€ FRAMEWORK DE TESTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let passed = 0, failed = 0;
const results = [];

function assert(desc, cond, expected, actual) {
  if (cond) { passed++; results.push({ status: 'PASS', desc }); }
  else { failed++; results.push({ status: 'FAIL', desc, expected, actual }); }
}
function section(title) { results.push({ status: 'SECTION', desc: title }); }

// â”€â”€ AMBIENTE BASE NODE (PARTILHADO) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BASE_MONTH = '2026-03'; // MÃªs anterior ao atual â€” garante que isActiveMonthCurrent=false nos testes
const BASE_STATE = {
  analysisMonth: BASE_MONTH, salary: 1500, revolutShare: 60, xtbShare: 40, revolutGoal: 'Fundo',
  categories: ['Casa','Alimentacao','Transporte','Lazer'],
  accounts: [
    { id: 'acc-main', name: 'Principal', type: 'Banco', balance: 2000 },
    { id: 'acc-revolut', name: 'Revolut', type: 'Poupanca', balance: 800 },
    { id: 'acc-xtb', name: 'XTB', type: 'Investimento', balance: 1200 },
    { id: 'acc-cash-physical', name: 'Dinheiro Vivo', type: 'Dinheiro', balance: 30 },
  ],
  expenses: [
    { id:'e2', monthKey:BASE_MONTH, name:'Supermercado', amount:150, day:5,  category:'Alimentacao',  kind:'variable', dateLabel:'2026-03-05' },
    { id:'e3', monthKey:BASE_MONTH, name:'Combustivel',  amount:80,  day:10, category:'Transporte',   kind:'variable', dateLabel:'2026-03-10' },
    { id:'e4', monthKey:BASE_MONTH, name:'Restaurante',  amount:45,  day:15, category:'Lazer',        kind:'variable', dateLabel:'2026-03-15' },
  ],
  transfers: [{ id:'t1', monthKey:BASE_MONTH, name:'Transf Revolut', amount:200, day:5, accountName:'Revolut', dateLabel:'2026-03-05' }],
  incomes:   [{ id:'i1', monthKey:BASE_MONTH, name:'Freelance', amount:300, day:3, dateLabel:'2026-03-03' }],
  receivables: [
    { id:'r1', name:'Emprestimo Joao', amount:500, status:'pending',  dateLabel:'2026-03-01' },
    { id:'r2', name:'Emprestimo Maria',amount:200, status:'received', dateLabel:'2026-03-01' },
  ],
  snapshots: [
    // Dia 1 — Multi conta (Bancos + Dinheiro)
    { id:'s1', monthKey:BASE_MONTH, day:1,  accountId:'acc-main',    bankBalance:2000, cashBalance:0, date:'2026-03-01' },
    { id:'s2', monthKey:BASE_MONTH, day:1,  accountId:'acc-revolut', bankBalance:800,  cashBalance:0, date:'2026-03-01' },
    { id:'s1-c', monthKey:BASE_MONTH, day:1, accountId:'acc-cash-physical', bankBalance:50, cashBalance:0, date:'2026-03-01' },
    
    // Dia 15 — snapshot intermédio (Bancos + Dinheiro)
    { id:'s3', monthKey:BASE_MONTH, day:15, accountId:'acc-main',    bankBalance:1100, cashBalance:0, date:'2026-03-15' },
    { id:'s4', monthKey:BASE_MONTH, day:15, accountId:'acc-revolut', bankBalance:1000, cashBalance:0, date:'2026-03-15' },
    { id:'s3-c', monthKey:BASE_MONTH, day:15, accountId:'acc-cash-physical', bankBalance:30, cashBalance:0, date:'2026-03-15' },
    
    // Fevereiro para testar auto-fill (Bancos + Dinheiro)
    { id:'sm1', monthKey:'2026-02', day:28, accountId:'acc-main', bankBalance:1800, cashBalance:0, date:'2026-02-28' },
    { id:'sm1-c', monthKey:'2026-02', day:28, accountId:'acc-cash-physical', bankBalance:40, cashBalance:0, date:'2026-02-28' },
  ],
  recurringFixed: [
    { id:'e1', name:'Renda', amount:600, day:1, frequency:'monthly' }
  ],
};

// â”€â”€ FACTORY: cria um motor de finanÃ§as isolado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createEngine(stateOverrides) {
  const lsData = {};
  const lsState = Object.assign({}, BASE_STATE, stateOverrides || {});
  lsData['finance-control-app'] = JSON.stringify(lsState);

  class DummyEl {
    constructor() { this.id=''; this.innerHTML=''; this.value=''; this.textContent=''; this.className=''; this.dataset={}; this.style={}; this.tagName='DIV'; }
    addEventListener(){}; cloneNode(){ return new DummyEl(); }
    querySelector(){ return new DummyEl(); }; querySelectorAll(){ return []; }
    getAttribute(){ return null; }; insertBefore(){}; remove(){}; appendChild(){}
  }

  const mockDoc = {
    querySelector: (s) => {
      if (s==='#item-template') return { content: { firstElementChild: new DummyEl() } };
      return new DummyEl();
    },
    querySelectorAll: () => [],
    createElement: () => new DummyEl(),
    body: new DummyEl(),
    addEventListener: () => {},
    getElementById: () => null,
  };
  const mockIntl = {
    NumberFormat: class { constructor(){} format(v){ return (Number(v)||0).toFixed(2)+' EUR'; } },
    DateTimeFormat: class {
      constructor(l,o){ this.o=o; }
      format(d){ if(!d||!(d instanceof Date)) return '?'; const [dd,mm,yyyy]=[d.getDate(),d.getMonth()+1,d.getFullYear()].map(String); return this.o&&this.o.month==='long'?`${mm.padStart(2,'0')}/${yyyy}`:`${dd.padStart(2,'0')}/${mm.padStart(2,'0')}/${yyyy}`; }
    }
  };
  const mockWindow = {};
  const mockCrypto = { randomUUID: ()=>`uuid-${Math.random().toString(36).slice(2)}` };

  const scriptCode = fs.readFileSync('script.js', 'utf8');
  const wrapper = new Function(
    'localStorage','document','Intl','window','crypto','confirm','alert',
    `"use strict";\n${scriptCode}\nreturn window;`
  );

  try {
    const win = wrapper(
      { getItem:(k)=>lsData[k]||null, setItem:(k,v)=>{ lsData[k]=v; } },
      mockDoc, mockIntl, mockWindow, mockCrypto, ()=>false, ()=>{}
    );
    return win;
  } catch(e) {
    // render() pode falhar em Node (elementos DOM nÃ£o existem) â€” Ã© esperado
    if (mockWindow.state) return mockWindow;
    throw e;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// INICIALIZAR MOTOR
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let engine;
try {
  engine = createEngine();
} catch(e) {
  // render() provavelmente falhou â€” tentar extrair state de qualquer forma
  // Se o engine ainda nÃ£o tem state, criar um fallback
  console.error('Engine init error (expected if render fails):', e.message);
  process.exit(1);
}

const S = engine.state; // referÃªncia ao state
// FunÃ§Ãµes expostas pelo engine:
const fn = {
  calculateBudget:             () => engine.calculateBudget(),
  getGlobalAccountsTotal:      () => { const b=engine.calculateBudget(); return S.accounts.reduce((t,a)=>t+(Number(a.balance)||0),0); },
  getCycleAnalysis:            () => engine.getCycleAnalysis(),
  calculateSavingsRate:        () => engine.calculateSavingsRate(),
  calculateFinancialRunway:    () => engine.calculateFinancialRunway(),
  calculateEmergencyFund:      (n) => engine.calculateEmergencyFundProgress(n),
  getLeakageStatus:            () => engine.getLeakageStatus(),
  getPrevMonthBalance:         () => engine.getPreviousMonthLastBalance(),
  getSnapshotsForMonth:        () => engine.getCycleAnalysis(), // proxy
  getReconciliationHistory:    () => engine.getReconciliationHistory(),
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TESTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

section('1. CALCULATEBUDGET â€” LÃ³gica de OrÃ§amento Base');
(() => {
  const b = engine.calculateBudget();
  assert('1.1 fixedExpenses = 600',            Math.abs(b.fixedExpenses - 600) < 0.01, 600, b.fixedExpenses);
  assert('1.2 variableExpenses = 275',         Math.abs(b.variableExpenses - 275) < 0.01, 275, b.variableExpenses);
  assert('1.3 transferExpenses = 200',         Math.abs(b.transferExpenses - 200) < 0.01, 200, b.transferExpenses);
  assert('1.4 disposableBudget = 1200 (1500+300-600)', Math.abs(b.disposableMonthlyBudget - 1200) < 0.01, 1200, b.disposableMonthlyBudget);
  assert('1.5 leftover = 725 (1200-275-200)',  Math.abs(b.leftover - 725) < 0.01, 725, b.leftover);
  assert('1.6 revolutAllocation = 435 (60%)', Math.abs(b.revolutAllocation - 435) < 0.01, 435, b.revolutAllocation);
  assert('1.7 xtbAllocation = 290 (40%)',     Math.abs(b.xtbAllocation - 290) < 0.01, 290, b.xtbAllocation);
  assert('1.8 revolutInterest â‰ˆ 8.265',       Math.abs(b.revolutInterest - 8.265) < 0.01, 8.265, b.revolutInterest);
  assert('1.9 dailyBudget = 40 (Abril=30 dias)', Math.abs(b.dailyBudget - 40) < 0.01, 40, b.dailyBudget);
})();

section('2. PATRIMÃ”NIO LÃQUIDO â€” Saldo Total e RecebÃ­veis');
(() => {
  // Conta: acc-main=2000, acc-revolut=800, acc-xtb=1200 = 4000 (saldos static de accounts[].balance)
  // Cash do Ãºltimo snapshot (dia 15): 30 â†’ getGlobalAccountsTotal retorna 4000+30=4030
  // Mas para isto funcionar, o engine tem de ter os account.balance actualizados pelos snapshots
  // Verificar diretamente o que o engine retorna:
  const total = engine.calculateFinancialRunway()?.netWorth || 0;
  assert('2.1 netWorth = 4030 (contas + cash snapshot dia 15)', Math.abs(total - 4030) < 0.01, 4030, total);

  const recPending = S.receivables.filter(r=>r.status!=='received').reduce((s,r)=>s+Number(r.amount),0);
  assert('2.2 Recebíveis pendentes = 500 (separados do netWorth)', Math.abs(recPending - 500) < 0.01, 500, recPending);
})();

section('3. GETCYCLEANALYSIS — Análise de Ciclo Mensal');
(() => {
  const analysis = engine.getCycleAnalysis();
  assert('3.1 hasProgressSnapshot = true',         analysis.hasProgressSnapshot === true, true, analysis.hasProgressSnapshot);
  assert('3.2 snapshotDay = 15',                   analysis.snapshotDay === 15, 15, analysis.snapshotDay);
  assert('3.3 realFlexibleSpentAtSnapshot = 420', Math.abs(analysis.realFlexibleSpentAtSnapshot - 420) < 0.01, 420, analysis.realFlexibleSpentAtSnapshot);
  assert('3.4 recordedFlexibleSpentAtSnapshot = 475', Math.abs(analysis.recordedFlexibleSpentAtSnapshot - 475) < 0.01, 475, analysis.recordedFlexibleSpentAtSnapshot);
  assert('3.5 movementGap = -55 (420-475)', Math.abs(analysis.movementGap - (-55)) < 0.01, -55, analysis.movementGap);
  assert('3.6 actualSpent = 420', Math.abs(analysis.actualSpent - 420) < 0.01, 420, analysis.actualSpent);
})();

section('4. RUNWAY — Autonomia Financeira');
(() => {
  const r = engine.calculateFinancialRunway();
  assert('4.1 runway não é null', r !== null, 'objeto', r);
  if (r) {
    const expected = 4030 / 875;
    assert('4.2 months ≈ 4.606 (4030/875)',  Math.abs(r.months - expected) < 0.01, expected.toFixed(3), r.months.toFixed(3));
    assert('4.3 monthlyCost = 875',           Math.abs(r.monthlyCost - 875) < 0.01, 875, r.monthlyCost);
    assert('4.4 netWorth = 4030',             Math.abs(r.netWorth - 4030) < 0.01, 4030, r.netWorth);
  }
})();

section('5. FUNDO DE EMERGÊNCIA — Meta 6 Meses');
(() => {
  const ef = engine.calculateEmergencyFundProgress(6);
  const expectedMonths = 4030 / 875;
  const expectedPct = Math.min((expectedMonths / 6) * 100, 100);
  assert('5.1 pct ≈ 76.8%', Math.abs(ef.pct - expectedPct) < 0.1, expectedPct.toFixed(1), ef.pct.toFixed(1));
  assert('5.2 ok = false (4.6 < 6)', ef.ok === false, false, ef.ok);
  assert('5.3 target = 6', ef.target === 6, 6, ef.target);
  const ef3 = engine.calculateEmergencyFundProgress(3);
  assert('5.4 Meta 3 meses: ok = true (4.6 > 3)', ef3.ok === true, true, ef3.ok);
})();

section('6. TAXA DE POUPANÇA — Savings Rate');
(() => {
  const rate = engine.calculateSavingsRate();
  // incomeTotal = 1500+300 = 1800; totalSaved = transfers(200)+leftover(725) = 925
  const expected = (925 / 1800) * 100;
  assert('6.1 Taxa ≈ 51.4%', Math.abs(rate - expected) < 0.1, expected.toFixed(1), rate.toFixed(1));
  assert('6.2 Taxa ≤ 100%', rate <= 100, '<= 100', rate);
  // Testar divisão por zero: rendimento 0
  const origSalary = S.salary;
  const origIncomes = S.incomes;
  S.salary = 0; S.incomes = [];
  const rateZero = engine.calculateSavingsRate();
  assert('6.3 Com rendimento 0, taxa = 0', rateZero === 0, 0, rateZero);
  S.salary = origSalary; S.incomes = origIncomes;
})();

section('7. AUDITORIA DE FLUXO — Leakage');
(() => {
  const status = engine.getLeakageStatus();
  assert('7.1 getLeakageStatus retorna objeto', status !== null, 'objeto', status);
  if (status) {
    assert('7.2 type = info (excesso de 55€)', status.type === 'info', 'info', status.type);
    assert('7.3 message inclui "Excesso Registado"', status.message.includes('Excesso Registado'), true, status.message);
  }
  // Sem snapshot intermédio
  const origSnaps = S.snapshots;
  S.snapshots = S.snapshots.filter(s => s.day === 1 && s.monthKey === BASE_MONTH);
  const statusNull = engine.getLeakageStatus();
  S.snapshots = origSnaps;
})();

section('8. AUTO-PREENCHER â€” Saldo do MÃªs Anterior');
(() => {
  const prev = engine.getPreviousMonthLastBalance();
  assert('8.1 Retorna dados de 2026-02', Boolean(prev) && String((prev||{}).monthKey||'').indexOf('2026-02') >= 0, '2026-02', String((prev||{}).monthKey));
  if (prev) {
    assert('8.2 lastDay = 28', prev.day === 28, 28, prev.day);
    assert('8.3 accountTotals[acc-main] = 1800', prev.accountTotals['acc-main'] === 1800, 1800, prev.accountTotals['acc-main']);
    assert('8.4 totalCash = 40', prev.totalCash === 40, 40, prev.totalCash);
  }
  const origSnaps = S.snapshots;
  S.snapshots = S.snapshots.filter(s => s.monthKey === BASE_MONTH);
  const prevEmpty = engine.getPreviousMonthLastBalance();
  assert('8.5 Sem mÃªs anterior, retorna null', prevEmpty === null, null, prevEmpty);
  S.snapshots = origSnaps;
})();

section('9. RECONCILIAÃ‡ÃƒO BANCÃRIA â€” getReconciliationHistory');
(() => {
  const history = engine.getReconciliationHistory();
  assert('9.1 1 intervalo (dia 1 â†’ dia 15)', history.length === 1, 1, history.length);
  if (history.length >= 1) {
    const h = history[0];
    // (2800+50) - (2100+30) = 720
    assert('9.2 totalDifference = 720', Math.abs(h.totalDifference - 720) < 0.01, 720, h.totalDifference);
    assert('9.3 expenseTotal = 275',   Math.abs(h.expenseTotal - 275) < 0.01, 275, h.expenseTotal);
    assert('9.4 transferTotal = 200',  Math.abs(h.transferTotal - 200) < 0.01, 200, h.transferTotal);
    // reconciledTotal = expenses(275)+transfers(200)-incomes(300) = 175
    assert('9.5 reconciledTotal = 175', Math.abs(h.reconciledTotal - 175) < 0.01, 175, h.reconciledTotal);
    // unexplained = 720 - 175 = 545
    assert('9.6 unexplainedDifference = 545', Math.abs(h.unexplainedDifference - 545) < 0.01, 545, h.unexplainedDifference);
  }
})();

section('10. CASOS DE BORDA â€” Robustez');
(() => {
  // 10.1: salary=0, sem snapshot â†’ budget >= 0
  const origSal = S.salary; const origSnaps = S.snapshots;
  S.salary = 0; S.snapshots = [];
  const b = engine.calculateBudget();
  assert('10.1 Budget >= 0 com salary=0 e sem snapshots', b.disposableMonthlyBudget >= 0, '>= 0', b.disposableMonthlyBudget);
  S.salary = origSal; S.snapshots = origSnaps;

  // 10.2: amount=undefined nÃ£o crashe
  const origExp = S.expenses;
  S.expenses = [...origExp, { id:'bad', monthKey:BASE_MONTH, name:'X', amount:undefined, day:5, kind:'variable' }];
  let ok = true;
  try { engine.calculateBudget(); } catch(e) { ok = false; }
  assert('10.2 amount=undefined nÃ£o crashe em calculateBudget', ok, 'sem erro', ok?'ok':'CRASH');
  S.expenses = origExp;

  // 10.3: taxa de poupanÃ§a com transferÃªncias gigantes <= 100
  const origTrans = S.transfers;
  S.transfers = [...origTrans, { id:'th', monthKey:BASE_MONTH, name:'Mega', amount:99999, day:1, dateLabel:'2026-04-01' }];
  const hugRate = engine.calculateSavingsRate();
  assert('10.3 Taxa de poupanÃ§a <= 100% mesmo com transferÃªncias gigantes', hugRate <= 100, '<= 100', hugRate);
  S.transfers = origTrans;

  // 10.4: shares=0 nÃ£o divide por zero
  const origRS = S.revolutShare; const origXS = S.xtbShare;
  S.revolutShare = 0; S.xtbShare = 0;
  const bz = engine.calculateBudget();
  assert('10.4 revolutShare=xtbShare=0: sem divisÃ£o por zero', isFinite(bz.revolutAllocation), true, isFinite(bz.revolutAllocation));
  S.revolutShare = origRS; S.xtbShare = origXS;

  // 10.5: MÃªs sem despesas
  const origExpOrig = S.expenses;
  S.expenses = [];
  const bEmpty = engine.calculateBudget();
  assert('10.5 Sem despesas: variableExpenses = 0', bEmpty.variableExpenses === 0, 0, bEmpty.variableExpenses);
  S.expenses = origExpOrig;
})();

section('11. LÃ“GICA DE ORÃ‡AMENTO â€” Casos Especiais');
(() => {
  // 11.1: Se salÃ¡rio = 0 mas hÃ¡ saldo inicial, usa-o como base
  const eng2 = createEngine({ salary: 0, snapshots: [
    { id:'sx1', monthKey:BASE_MONTH, day:1, accountId:'acc-main', bankBalance:1000, cashBalance:50, date:'2026-04-01' }
  ], accounts: BASE_STATE.accounts });
  const b2 = eng2.calculateBudget();
  assert('11.1 Com salary=0, usa startBalance(1050) como orÃ§amento base', b2.disposableMonthlyBudget > 0, '> 0', b2.disposableMonthlyBudget);
})();

section('12. DESPESAS MULTI-FREQUÊNCIA — Provisionamento');
(() => {
  // 12.1: Despesa anual de 1200€ deve ter peso de 100€
  const eng3 = createEngine({ 
    salary: 2000, 
    incomes: [], // Limpar incomes do BASE_STATE
    recurringFixed: [
        { id:'af1', name:'Seguro Anual', amount: 1200, day: 1, frequency: 'annual', startMonth: 1 }
    ]
  });
  const b3 = eng3.calculateBudget();
  // disposBudget = 2000 - 100(provisão) = 1900
  assert('12.1 Despesa anual de 1200€ provisiona 100€ mensalmente', Math.abs(b3.disposableMonthlyBudget - 1900) < 0.01, 1900, b3.disposableMonthlyBudget);

  // 12.2: Despesa semestral de 600€ deve ter peso de 100€
  const eng4 = createEngine({ 
    salary: 2000, 
    incomes: [], // Limpar incomes do BASE_STATE
    recurringFixed: [
        { id:'sf1', name:'IUC Semestral', amount: 600, day: 1, frequency: 'semi-annual', startMonth: 1 }
    ]
  });
  const b4 = eng4.calculateBudget();
  // disposBudget = 2000 - 100(provisão) = 1900
  assert('12.2 Despesa semestral de 600€ provisiona 100€ mensalmente', Math.abs(b4.disposableMonthlyBudget - 1900) < 0.01, 1900, b4.disposableMonthlyBudget);
})();

// â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
// RELATÃ“RIO FINAL
// â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• â• 
console.log('\n' + 'â• '.repeat(65));
console.log('  RELATÃ“RIO DE AUDITORIA â€” CONTROLO FINANCEIRO');
console.log('â• '.repeat(65));
results.forEach(r => {
  if (r.status === 'SECTION') { console.log('\nâ”€â”€ ' + r.desc + ' ' + 'â”€'.repeat(Math.max(0, 52-r.desc.length))); return; }
  const icon = r.status === 'PASS' ? 'âœ…' : 'â Œ';
  console.log(`${icon} ${r.desc}`);
  if (r.status === 'FAIL') {
    console.log(`     Esperado : ${JSON.stringify(r.expected)}`);
    console.log(`     Obtido   : ${JSON.stringify(r.actual)}`);
  }
});
console.log('\n' + 'â•'.repeat(65));
console.log(` TOTAL: ${passed+failed} testes | âœ… ${passed} PASS | âŒ ${failed} FAIL`);
console.log('â•'.repeat(65) + '\n');
if (failed > 0) console.log('âŒ ANOMALIAS DETETADAS. VER DETALHES ACIMA.\n');
else console.log('âœ… TODOS OS TESTES PASSARAM. MOTOR ÃNTEGRO.\n');
process.exit(failed > 0 ? 1 : 0);



