const fs = require('fs');

// ─── CORREÇÃO 1: sumFixedMonthlyExpenses aceita monthKey histórico ───
let ce = fs.readFileSync('core-engine.js', 'utf8');

const oldFixed = `function sumFixedMonthlyExpenses() {\r\n  const { year, month } = getActiveMonthParts();\r\n  \r\n  return state.recurringFixed\r\n    .filter(rf => {\r\n      if (!rf.frequency || rf.frequency === 'monthly') return true;\r\n      const startMonth = Number(rf.startMonth) || 1;\r\n      if (rf.frequency === 'annual') return month === startMonth;\r\n      if (rf.frequency === 'semi-annual') return month === startMonth || month === (startMonth + 6 > 12 ? startMonth - 6 : startMonth + 6);\r\n      return false;\r\n    })\r\n    .reduce((total, rf) => total + Number(rf.amount || 0), 0);\r\n}`;

// Try both CRLF and LF variants
const oldFixedLF = `function sumFixedMonthlyExpenses() {\n  const { year, month } = getActiveMonthParts();\n  \n  return state.recurringFixed\n    .filter(rf => {\n      if (!rf.frequency || rf.frequency === 'monthly') return true;\n      const startMonth = Number(rf.startMonth) || 1;\n      if (rf.frequency === 'annual') return month === startMonth;\n      if (rf.frequency === 'semi-annual') return month === startMonth || month === (startMonth + 6 > 12 ? startMonth - 6 : startMonth + 6);\n      return false;\n    })\n    .reduce((total, rf) => total + Number(rf.amount || 0), 0);\n}`;

const newFixed = `function sumFixedMonthlyExpenses(overrideMonthKey) {
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
}`;

if (ce.includes('function sumFixedMonthlyExpenses()')) {
  // Find the function and replace it
  const funcStart = ce.indexOf('function sumFixedMonthlyExpenses()');
  const funcEnd = ce.indexOf('\n}', funcStart) + 2;
  ce = ce.slice(0, funcStart) + newFixed + ce.slice(funcEnd);
  fs.writeFileSync('core-engine.js', ce);
  console.log('✅ Correção 1 aplicada: sumFixedMonthlyExpenses agora aceita monthKey histórico');
} else {
  console.log('❌ Função sumFixedMonthlyExpenses não encontrada');
}
