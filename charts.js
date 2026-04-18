// charts.js - Business Intelligence Core
// Desenhado para injetar analítica visual interativamente
const _chartInstances = {};

function _destroyChart(id) {
  if (_chartInstances[id]) {
    _chartInstances[id].destroy();
    delete _chartInstances[id];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Chart.defaults.color = '#64748b';
  Chart.defaults.font.family = "'Space Grotesk', sans-serif";
  Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.05)';
  
  try {
    // KPI: Taxa de Poupança
    if (typeof calculateSavingsRate === 'function') {
      const rate = calculateSavingsRate();
      const el = document.getElementById('savingsRateDisplay');
      if (el) el.textContent = rate.toFixed(1) + '%';
      
      const detailEl = document.getElementById('savingsRateDetail');
      if (detailEl) {
        const income = typeof sumIncomes === 'function' ? sumIncomes() : 0;
        const spent = typeof getRealSpentEfficiency === 'function' ? getRealSpentEfficiency() : (typeof sumVariableExpenses === 'function' ? sumVariableExpenses() : 0) + (typeof calculateBudget === 'function' && calculateBudget() ? calculateBudget().fixedExpenses || 0 : 0);
        const saved = Math.max(income - spent, 0);
        detailEl.innerHTML = `Poupado: ${formatCurrency(saved)} <br> (Ganho: ${formatCurrency(income)} | Gasto: ${formatCurrency(spent)})`;
      }
    }

    renderRadar();
    renderTopExpenses();
    drawCategoryChart();
    drawBurnRateChart();
    drawNetWorthChart();
    _renderGlobalAnalyticTable();
    renderWeeklyApanhado();
    drawDailyPerformanceChart();
    renderObligationsReserves();

  } catch (e) {
    console.error('Dashboard error:', e);
  }
});

// Sincronização automática quando o motor central atualiza o estado
window.addEventListener('stateUpdated', () => {
    try {
        if (typeof calculateSavingsRate === 'function') {
            const rate = calculateSavingsRate();
            const el = document.getElementById('savingsRateDisplay');
            if (el) el.textContent = rate.toFixed(1) + '%';
        }
        renderRadar();
        renderTopExpenses();
        drawCategoryChart();
        drawBurnRateChart();
        drawNetWorthChart();
        _renderGlobalAnalyticTable();
        // Recarregar outras visualizações se necessário
    } catch (e) {
        console.warn('Erro ao atualizar gráficos via evento:', e);
    }
});

// ════════════════════════════════════════════════════════════
// RADAR DE SAÚDE FINANCEIRA
// ════════════════════════════════════════════════════════════
function renderRadar() {
  _renderRunway();
  _renderEmergencyFund();
  _renderBudgetVelocity();
  _renderLeakageAlert();
}

function _setBadge(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'radar-badge badge-' + type;
}

function _setProgressBar(barId, pct, dangerThreshold, warningThreshold) {
  const el = document.getElementById(barId);
  if (!el) return;
  const clamped = Math.min(Math.max(pct, 0), 100);
  el.style.width = clamped + '%';
  el.className = 'progress-bar-fill';
  if (clamped >= dangerThreshold) el.classList.add('danger');
  else if (clamped >= warningThreshold) el.classList.add('warning');
}

function _renderRunway() {
  const display = document.getElementById('runwayDisplay');
  const hint = document.getElementById('runwayHint');
  if (!display || typeof calculateFinancialRunway !== 'function') return;

  const runway = calculateFinancialRunway();
  if (!runway) {
    display.textContent = 'Sem dados suficientes';
    if (hint) hint.textContent = 'Regista despesas e o teu salário para calcular a autonomia.';
    return;
  }

  const months = runway.months;
  const fmt = typeof formatCurrency === 'function' ? formatCurrency : v => v.toFixed(2) + '€';

  if (months >= 12) {
    display.textContent = months.toFixed(1) + ' meses 🟢';
    _setBadge('runwayBadge', 'Excelente', 'success');
  } else if (months >= 6) {
    display.textContent = months.toFixed(1) + ' meses 🟡';
    _setBadge('runwayBadge', 'Seguro', 'warning');
  } else if (months >= 3) {
    display.textContent = months.toFixed(1) + ' meses 🟠';
    _setBadge('runwayBadge', 'Risco Médio', 'warning');
  } else {
    display.textContent = months.toFixed(1) + ' meses 🔴';
    _setBadge('runwayBadge', 'Risco Alto', 'danger');
  }

  if (hint) {
    const baselineText = runway.basedOn === "Salário (Estilo de Vida)" ? "Estimativa por Salário" : "Gasto Real do Mês";
    hint.innerHTML = `Liquidez: ${fmt(runway.netWorth)} | Custo Médio: ${fmt(runway.monthlyCost)} <br><small style="opacity:0.7">${baselineText}</small>`;
  }
}

function _renderEmergencyFund() {
  const display = document.getElementById('emergencyFundDisplay');
  const hint = document.getElementById('emergencyFundHint');
  if (!display || typeof calculateEmergencyFundProgress !== 'function') return;

  const ef = calculateEmergencyFundProgress(6);
  const fmt = typeof formatCurrency === 'function' ? formatCurrency : v => v.toFixed(2) + '€';

  display.textContent = ef.months.toFixed(1) + ' / 6 meses';
  _setProgressBar('emergencyFundBar', ef.pct, 101, 101); // barra sempre verde até 100%

  // cor baseada no progresso
  const bar = document.getElementById('emergencyFundBar');
  if (bar) {
    bar.className = 'progress-bar-fill';
    if (ef.pct < 33) bar.classList.add('danger');
    else if (ef.pct < 66) bar.classList.add('warning');
  }

  if (hint) {
    if (ef.ok) {
      hint.textContent = '✅ Fundo de emergência completo! Considera aumentar a meta para 12 meses.';
    } else {
      const remaining = Math.max(6 - ef.months, 0);
      hint.textContent = `Faltam ${remaining.toFixed(1)} meses de cobertura — ${ef.pct.toFixed(0)}% da meta atingida.`;
    }
  }
}

function _renderBudgetVelocity() {
  const display = document.getElementById('budgetVelocityDisplay');
  const hint = document.getElementById('velocityHint');
  if (!display) return;

  const budget = typeof calculateBudget === 'function' ? calculateBudget() : null;
  if (!budget || budget.disposableMonthlyBudget <= 0) {
    display.textContent = 'Sem orçamento definido';
    return;
  }

  // SOBERANIA BANCÁRIA: O gasto real é o que saiu do banco, não apenas o registado.
  const realSpent = typeof getRealSpentEfficiency === 'function' ? getRealSpentEfficiency() : (budget.variableExpenses + budget.transferExpenses);
  const total = budget.disposableMonthlyBudget;
  const pct = Math.min((realSpent / total) * 100, 100);

  display.textContent = pct.toFixed(1) + '% utilizado';
  _setProgressBar('budgetVelocityBar', pct, 90, 70);

  const fmt = typeof formatCurrency === 'function' ? formatCurrency : v => v.toFixed(2) + '€';
  if (hint) {
    const remaining = Math.max(total - realSpent, 0);
    const xtb = budget.xtbAllocation || 0;
    const rev = budget.revolutAllocation || 0;
    
    hint.innerHTML = `Gasto Real: ${fmt(realSpent)} de ${fmt(total)} <br><strong>Disponível p/ Investir:</strong> ${fmt(remaining)} (XTB: ${fmt(xtb)} | Rev: ${fmt(rev)})`;
  }
}

function _renderLeakageAlert() {
  const display = document.getElementById('leakageDisplay');
  const hint = document.getElementById('leakageHint');
  if (!display || typeof getLeakageStatus !== 'function') return;

  const status = getLeakageStatus();
  if (!status) {
    display.textContent = 'Sem snapshot de progresso';
    if (hint) hint.textContent = 'Regista um snapshot intermédio para ativar a auditoria de fluxo.';
    _setBadge('leakageBadge', 'Inativo', 'warning');
    return;
  }

  display.textContent = status.message;
  if (hint) hint.textContent = 'Comparação entre variação real do saldo bancário e despesas registadas.';

  const badgeMap = { success: ['OK', 'success'], warning: ['Fuga', 'danger'], info: ['Excesso', 'warning'] };
  const [text, type] = badgeMap[status.type] || ['—', ''];
  _setBadge('leakageBadge', text, type);
}

// ════════════════════════════════════════════════════════════
// GRÁFICOS
// ════════════════════════════════════════════════════════════

function renderTopExpenses() {
  const container = document.getElementById('topExpensesList');
  if (!container || !state) return;
  
  // Usar dashboardMonthKey se disponível (navegador de mês), senão mês atual
  const activeKey = (typeof window !== 'undefined' && window.dashboardMonthKey)
    ? window.dashboardMonthKey
    : (typeof getMonthKey === 'function' ? getMonthKey() : '');

  const expenses = state.expenses
     .slice()
     .filter(e => typeof getItemMonthKey === 'function' ? getItemMonthKey(e) === activeKey : true)
     .filter(e => e.kind !== 'fixed')
     .sort((a,b) => getNetExpenseAmount(b) - getNetExpenseAmount(a))
     .slice(0, 5);

  if (!expenses.length) {
    container.className = 'item-list empty-state';
    container.textContent = 'Não existem despesas variáveis neste ciclo até ao momento.';
    return;
  }
  
  container.className = 'item-list';
  container.innerHTML = '';
  const tpl = document.getElementById('item-template');
  const fmt = typeof formatCurrency === 'function' ? formatCurrency : v => v.toFixed(2) + '€';
  
  expenses.forEach(e => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.item-title').textContent = e.name;
    node.querySelector('.item-subtitle').textContent = `${e.category || '—'} · Dia ${e.day || '?'}`;
    node.querySelector('.item-value').textContent = fmt(getNetExpenseAmount(e));
    node.querySelector('.ghost-btn').style.display = 'none';
    container.appendChild(node);
  });
}


function drawCategoryChart() {
  const ctx = document.getElementById('categoryDistributionChart');
  if (!ctx || !state) return;
  
  _destroyChart('categoryDistributionChart');

  // Usar dashboardMonthKey se disponível
  const activeKey = (typeof window !== 'undefined' && window.dashboardMonthKey)
    ? window.dashboardMonthKey
    : (typeof getMonthKey === 'function' ? getMonthKey() : '');

  const expenses = state.expenses.filter(e =>
    typeof getItemMonthKey === 'function' ? getItemMonthKey(e) === activeKey : true
  );
  
  if (!expenses.length) return;
  
  const byCategory = {};
  expenses.forEach(e => {
    const cat = e.category || 'Outros';
    byCategory[cat] = (byCategory[cat] || 0) + getNetExpenseAmount(e);
  });
  
  const labels = Object.keys(byCategory);
  const data = Object.values(byCategory);
  const palette = ['#0d9488','#7c3aed','#f59e0b','#ef4444','#3b82f6','#10b981','#6366f1','#ec4899','#84cc16','#06b6d4'];
  const colors = labels.map((_, i) => palette[i % palette.length]);
  
  _chartInstances['categoryDistributionChart'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#0f172a', padding: 16, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed;
              const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
              const pct = total > 0 ? ((val/total)*100).toFixed(1) : 0;
              const fmt = typeof formatCurrency === 'function' ? formatCurrency : v => v.toFixed(2) + '€';
              return ` ${fmt(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}


function drawBurnRateChart() {
  const ctx = document.getElementById('weeklyBurnChart');
  if (!ctx || !state) return;
  
  const history = typeof getReconciliationHistory === 'function' ? getReconciliationHistory() : [];
  const budget = typeof calculateBudget === 'function' ? calculateBudget() : { dailyBudget: 0 };
  const dailyBudget = budget.dailyBudget;
  
  if (!history.length) return;
  
  const labels = [];
  const spendData = [];
  const budgetData = [];
  let cumulativeSpend = 0;
  
  history.forEach(entry => {
    labels.push(`Dia ${entry.currentDay}`);
    cumulativeSpend += (entry.expenseTotal + entry.transferTotal);
    spendData.push(cumulativeSpend);
    const elapsedDays = entry.currentDay - 1;
    const allowedToSpend = elapsedDays * dailyBudget;
    budgetData.push(allowedToSpend);
  });
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          type: 'bar', label: 'Burn Rate (Gasto Real)', data: spendData,
          backgroundColor: 'rgba(244, 63, 94, 0.7)', borderRadius: 4, barPercentage: 0.5, order: 2
        },
        {
          type: 'line', label: 'Orçamento Linear (Meta)', data: budgetData,
          borderColor: '#0284c7', borderWidth: 2, borderDash: [5, 5],
          tension: 0, pointBackgroundColor: '#0284c7', fill: false, order: 1
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: '#0f172a' } } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => '€' + v } },
        x: { grid: { display: false } }
      }
    }
  });
}

function drawNetWorthChart() {
  const ctx = document.getElementById('longTermNetWorthChart');
  if (!ctx || !state) return;
  
  const snapshots = state.snapshots.slice().sort((a,b) => {
    if (a.monthKey === b.monthKey) return (Number(a.day)||0) - (Number(b.day)||0);
    return String(a.monthKey||'').localeCompare(String(b.monthKey||''));
  });
  
  if (!snapshots.length) return;
  
  const monthData = {};
  const accountBalances = {};
  
  snapshots.forEach(s => {
    const id = s.accountId || 'legacy';
    accountBalances[id] = (Number(s.bankBalance)||0) + (Number(s.cashBalance)||0);
    let total = 0;
    for (let i in accountBalances) total += (Number(accountBalances[i])||0);
    monthData[s.monthKey] = total;
  });
  
  // Adicionar recebíveis em aberto ao total de cada mês (riqueza alargada)
  const receivablesTotal = state.receivables
    .filter(r => r.status !== 'received')
    .reduce((sum, r) => sum + (Number(r.amount)||0), 0);

  const labels = Object.keys(monthData);
  const liquidityData = Object.values(monthData);
  const wealthData = liquidityData.map(v => v + receivablesTotal);
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Liquidez Patrimonial',
          data: liquidityData,
          borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,0.1)',
          fill: true, tension: 0.4, pointRadius: 6,
          pointBackgroundColor: '#0d9488', pointBorderColor: '#fff'
        },
        {
          label: 'Riqueza Total (+ Recebíveis)',
          data: wealthData,
          borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.05)',
          fill: false, tension: 0.4, pointRadius: 4, borderDash: [4, 4],
          pointBackgroundColor: '#7c3aed', pointBorderColor: '#fff'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: '#0f172a' } } },
      scales: {
        y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => '€' + v } },
        x: { grid: { display: false } }
      }
    }
  });
}

// Alias (compatibilidade)
function drawCategoryDistributionChart() {}

function _renderGlobalAnalyticTable() {
  const tbody = document.getElementById('globalAnalyticTable');
  if (!tbody || !state) return;

  const months = new Set();
  [...state.expenses, ...state.incomes, ...state.transfers].forEach(item => {
    const mk = typeof getItemMonthKey === 'function' ? getItemMonthKey(item) : item.monthKey;
    if (mk) months.add(mk);
  });

  if (!months.size) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;font-style:italic;color:var(--text-muted);">Sem dados históricos ainda.</td></tr>';
    return;
  }

  const sortedMonths = [...months].sort().reverse(); // Mais recente primeiro
  const fmt = typeof formatCurrency === 'function' ? formatCurrency : v => v.toFixed(2) + '€';
  const salary = Number(state.salary) || 0;

  tbody.innerHTML = sortedMonths.map(mk => {
    // Filtro de ganhos: excluir transição excedente para não inflacionar o histórico
    const incomes = state.incomes
      .filter(i => (typeof getItemMonthKey === 'function' ? getItemMonthKey(i) : i.monthKey) === mk && !i.name.includes("Transição Excedente") && !i.linkedReceivableId)
      .reduce((s, i) => s + Number(i.amount||0), 0);
    
    // Custo fixo agora usa a lógica provisionada do motor central
    const fixed = typeof sumFixedMonthlyExpenses === 'function' ? sumFixedMonthlyExpenses(mk) : 0;
    
    const variable = state.expenses
      .filter(e => (typeof getItemMonthKey === 'function' ? getItemMonthKey(e) : e.monthKey) === mk && e.kind !== 'fixed')
      .reduce((s, e) => s + getNetExpenseAmount(e), 0);
    
    const transfers = state.transfers
      .filter(t => (typeof getItemMonthKey === 'function' ? getItemMonthKey(t) : t.monthKey) === mk)
      .reduce((s, t) => s + Number(t.amount||0), 0);

    const totalIn = salary + incomes;
    const totalOut = fixed + variable + transfers;
    const monthBalance = totalIn - totalOut;
    const balanceClass = monthBalance >= 0 ? 'style="color: var(--success, #10b981); font-weight: 700;"' : 'style="color: #ef4444; font-weight: 700;"';

    return `<tr>
      <td><strong>${mk}</strong></td>
      <td class="text-right">${fmt(incomes)}</td>
      <td class="text-right">${fmt(fixed)}</td>
      <td class="text-right">${fmt(variable)}</td>
      <td class="text-right">${fmt(transfers)}</td>
      <td class="text-right" ${balanceClass}>${monthBalance >= 0 ? '+' : ''}${fmt(monthBalance)}</td>
    </tr>`;
  }).join('');
}

function renderWeeklyApanhado() {
    const dailyDisp = document.getElementById("dailyBudgetDisplay");
    const weeklyDisp = document.getElementById("weeklySliceBudgetDisplay");
    const surplusDisp = document.getElementById("sliceSurplusDisplay");
    const listDisp = document.getElementById("weeklySlicesList");

    if (!dailyDisp || !state) return;

    const budget = calculateBudget();
    const slices = typeof getCalendarSlices === 'function' ? getCalendarSlices() : [];
    const { year, month } = getActiveMonthParts();
    const currentDay = isActiveMonthCurrent() ? getToday().getDate() : 31;
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const dailyBudget = budget.disposableMonthlyBudget / daysInMonth;
    dailyDisp.textContent = formatCurrency(dailyBudget);

    let currentSlice = slices.find(s => currentDay >= s.start && currentDay <= s.end) || slices[slices.length - 1];
    if (!currentSlice) currentSlice = { start: 1, end: daysInMonth };
    const totalSliceBudget = dailyBudget * (currentSlice.end - currentSlice.start + 1);

    weeklyDisp.textContent = formatCurrency(totalSliceBudget);

    // Calcular gasto real na fatia atual (Isolado)
    const sliceSpent = typeof getFlexibleSpentInPeriod === 'function' 
        ? getFlexibleSpentInPeriod(currentSlice.start, currentSlice.end)
        : 0;
    
    const sliceSurplus = Math.max(totalSliceBudget - sliceSpent, 0);
    
    surplusDisp.textContent = formatCurrency(sliceSurplus);

    // Detalhe matemático explícito (Pedido pelo Utilizador)
    const mathEl = document.getElementById("weeklySliceMath");
    if (mathEl) {
        mathEl.textContent = `${formatCurrency(totalSliceBudget)} - ${formatCurrency(sliceSpent)} = ${formatCurrency(sliceSurplus)}`;
    }

    // Renderizar a lista de fatias
    if (listDisp) {
        listDisp.innerHTML = "";
        listDisp.className = "item-list";
        
        slices.forEach((slice, idx) => {
            const isPast = slice.end < currentDay;
            const isCurrent = currentDay >= slice.start && currentDay <= slice.end;
            const sliceDays = slice.end - slice.start + 1;
            const sliceBudget = dailyBudget * sliceDays;
            
            const card = document.createElement("div");
            card.className = "item-card";
            if (isCurrent) card.style.borderColor = "var(--primary)";
            if (isPast) card.style.opacity = "0.7";

            // Cálculo do gasto e excedente específico desta fatia
            const sBudget = dailyBudget * sliceDays;
            const sSpent = typeof getFlexibleSpentInPeriod === 'function' ? getFlexibleSpentInPeriod(slice.start, slice.end) : 0;
            const sSurplus = sBudget - sSpent;
            const sMath = `${formatCurrency(sBudget)} - ${formatCurrency(sSpent)} = ${formatCurrency(sSurplus)}`;
            
            const surplusClass = sSurplus >= 0 ? 'color: var(--success, #10b981);' : 'color: #ef4444;';

            card.innerHTML = `
                <div>
                    <strong class="item-title">Fatia ${idx + 1}: Dia ${slice.start} ao ${slice.end}</strong>
                    <p class="item-subtitle" style="margin-bottom: 2px;">${isCurrent ? '⚡ Fatia em curso' : (isPast ? '✅ Concluída' : '⏳ Agendada')}</p>
                    <p style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${sMath}</p>
                </div>
                <div class="item-actions">
                    <span class="item-value" style="${surplusClass} font-weight: 700;">${formatCurrency(sSurplus)}</span>
                </div>
            `;
            listDisp.appendChild(card);
        });
    }
}

function drawDailyPerformanceChart() {
  const ctx = document.getElementById('dailyPerformanceChart');
  if (!ctx || !state) return;

  _destroyChart('dailyPerformance');

  const spendingData = typeof getDailySpendingData === 'function' ? getDailySpendingData() : [];
  const labels = spendingData.map((_, i) => i + 1);
  const budget = calculateBudget();
  const daysInMonth = spendingData.length;
  const dailyBudget = budget.disposableMonthlyBudget / daysInMonth;
  
  const budgetLine = new Array(daysInMonth).fill(dailyBudget);

  _chartInstances['dailyPerformance'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Gasto Real (Dia)',
          data: spendingData,
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#7c3aed'
        },
        {
          label: 'Meta Diária (Ideal)',
          data: budgetLine,
          borderColor: '#10b981',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { display: false },
          ticks: { callback: v => formatCurrency(v) }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderObligationsReserves() {
    const pendingDisp = document.getElementById("obligationsPendingDisplay");
    const detailEl = document.getElementById("obligationsDetail");
    if (!pendingDisp || typeof calculateObligationsStatus !== 'function') return;

    const stats = calculateObligationsStatus();

    // Valor principal: O que ainda falta pagar (Reserva necessária)
    pendingDisp.textContent = formatCurrency(stats.pendingAmount);

    if (detailEl) {
        detailEl.innerHTML = `
            Fixo Pago: ${formatCurrency(stats.paidAmount)} <br>
            Total Mês: ${formatCurrency(stats.totalProvision)}
            <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 8px;">
                <div style="height: 100%; width: ${stats.progressPercent}%; background: var(--success); border-radius: 2px;"></div>
            </div>
        `;
    }
}
