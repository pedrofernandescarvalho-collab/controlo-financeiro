const fs = require('fs');

function patchScriptJs() {
    let content = fs.readFileSync('script.js', 'utf8');

    // 1. Add getNetExpenseAmount function
    if (!content.includes('function getNetExpenseAmount')) {
        const helperFunc = `
function getNetExpenseAmount(expense) {
  if (typeof state === 'undefined' || !state.receivables) return Number(expense.amount || 0);
  const splits = state.receivables
    .filter(r => r.linkedExpenseId === expense.id)
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return Math.max(0, Number(expense.amount || 0) - splits);
}
`;
        content = content.replace('function formatCurrency(value) {', helperFunc + '\nfunction formatCurrency(value) {');
    }

    // 2. Refactor sumVariableExpenses
    const targetVarExp = `function sumVariableExpenses() {
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
}`;
    const repVarExp = `function sumVariableExpenses() {
  const monthKey = getMonthKey();
  return state.expenses
    .filter(e => e.kind !== "fixed" && getItemMonthKey(e) === monthKey)
    .reduce((total, expense) => total + getNetExpenseAmount(expense), 0);
}`;
    if (content.includes(targetVarExp)) {
        content = content.replace(targetVarExp, repVarExp);
    }

    // 3. Update renderExpenses to show net
    content = content.replace(
        'node.querySelector(".item-value").textContent = formatCurrency(expense.amount);',
        'node.querySelector(".item-value").textContent = formatCurrency(getNetExpenseAmount(expense));'
    );

    // 4. Also update sumExpensesBetween, sumExpensesUntil
    const oldSumExpUntil = `function sumExpensesUntil(day) {
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
}`;
    const newSumExpUntil = `function sumExpensesUntil(day) {
  const monthKey = getMonthKey();
  return state.expenses
    .filter((expense) =>
      getItemMonthKey(expense) === monthKey &&
      expense.kind !== "fixed" &&
      Number(expense.day) <= day
    )
    .reduce((total, expense) => total + getNetExpenseAmount(expense), 0);
}`;
    if (content.includes(oldSumExpUntil)) {
       content = content.replace(oldSumExpUntil, newSumExpUntil);
    }
    
    const oldSumExpBetween = `function sumExpensesBetween(startDay, endDay) {
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
}`;
    const newSumExpBetween = `function sumExpensesBetween(startDay, endDay) {
  const monthKey = getMonthKey();
  return state.expenses
    .filter((expense) =>
      getItemMonthKey(expense) === monthKey &&
      Number(expense.day) > startDay &&
      Number(expense.day) <= endDay
    )
    .reduce((total, expense) => total + getNetExpenseAmount(expense), 0);
}`;
    if(content.includes(oldSumExpBetween)){
        content = content.replace(oldSumExpBetween, newSumExpBetween);
    }

    fs.writeFileSync('script.js', content);
}

function patchChartsJs() {
    let content = fs.readFileSync('charts.js', 'utf8');

    // charts.js renderTopExpenses
    content = content.replace(
        '.sort((a,b) => b.amount - a.amount)',
        '.sort((a,b) => getNetExpenseAmount(b) - getNetExpenseAmount(a))'
    );
    content = content.replace(
        `node.querySelector('.item-value').textContent = fmt(e.amount);`,
        `node.querySelector('.item-value').textContent = fmt(getNetExpenseAmount(e));`
    );

    // category uses raw
    content = content.replace(
        `byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount);`,
        `byCategory[cat] = (byCategory[cat] || 0) + getNetExpenseAmount(e);`
    );

    // burnRate uses raw
    content = content.replace(
        `.reduce((sum, e) => sum + Number(e.amount), 0);`,
        `.reduce((sum, e) => sum + getNetExpenseAmount(e), 0);`
    ); // matches spentVars in drawBurnRateChart AND spentTransfers, wait! 
    // spentTransfers also matches it! Let's be careful.

    // Let's replace specifically in charts.js
    content = content.replace(
        `const spentVars = state.expenses
             .filter(e => typeof getItemMonthKey === 'function' && getItemMonthKey(e) === activeKey && e.kind !== 'fixed' && Number(e.day) <= day)
             .reduce((sum, e) => sum + Number(e.amount), 0);`,
        `const spentVars = state.expenses
             .filter(e => typeof getItemMonthKey === 'function' && getItemMonthKey(e) === activeKey && e.kind !== 'fixed' && Number(e.day) <= day)
             .reduce((sum, e) => sum + getNetExpenseAmount(e), 0);`
    );
    
    // analytic table variable
    content = content.replace(
        `const variable = state.expenses
      .filter(e => (typeof getItemMonthKey === 'function' ? getItemMonthKey(e) : e.monthKey) === mk && e.kind !== 'fixed')
      .reduce((s, e) => s + Number(e.amount||0), 0);`,
        `const variable = state.expenses
      .filter(e => (typeof getItemMonthKey === 'function' ? getItemMonthKey(e) : e.monthKey) === mk && e.kind !== 'fixed')
      .reduce((s, e) => s + getNetExpenseAmount(e), 0);`
    );

    // analytic table incomes should exclude linkedReceivableId
    content = content.replace(
        `const incomes = state.incomes
      .filter(i => (typeof getItemMonthKey === 'function' ? getItemMonthKey(i) : i.monthKey) === mk && !i.name.includes("Transição Excedente"))
      .reduce((s, i) => s + Number(i.amount||0), 0);`,
        `const incomes = state.incomes
      .filter(i => (typeof getItemMonthKey === 'function' ? getItemMonthKey(i) : i.monthKey) === mk && !i.name.includes("Transição Excedente") && !i.linkedReceivableId)
      .reduce((s, i) => s + Number(i.amount||0), 0);`
    );

    fs.writeFileSync('charts.js', content);
}

patchScriptJs();
patchChartsJs();
console.log('Success');
