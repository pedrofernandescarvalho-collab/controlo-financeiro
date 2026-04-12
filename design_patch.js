const fs = require('fs');

function addSpanAll() {
    ['dashboard.html', 'extrato.html'].forEach(file => {
        if (!fs.existsSync(file)) return;
        let c = fs.readFileSync(file, 'utf8');

        if (file === 'dashboard.html') {
            // Radar
            c = c.replace(
                '<!-- Radar de Saúde Financeira -->\n      <section class="panel config-panel">',
                '<!-- Radar de Saúde Financeira -->\n      <section class="panel config-panel span-all" style="padding: 30px;">'
            );
            // Tabela Analítica
            c = c.replace(
                '<!-- Tabela Analítica Mensal -->\n      <section class="panel config-panel">',
                '<!-- Tabela Analítica Mensal -->\n      <section class="panel config-panel span-all" style="padding: 30px;">'
            );
            // Apanhado Semanal
            c = c.replace(
                '<!-- Apanhado Semanal / Orçamento Dinâmico -->\n      <section class="panel config-panel">',
                '<!-- Apanhado Semanal / Orçamento Dinâmico -->\n      <section class="panel config-panel span-all">'
            );
        } else if (file === 'extrato.html') {
            c = c.replace(
                '<div class="dashboard-col config-panel">',
                '<div class="dashboard-col config-panel span-all" style="padding: 30px;">'
            );
        }

        fs.writeFileSync(file, c);
    });
}

function updateCSS() {
    let c = fs.readFileSync('style.css', 'utf8');

    if (!c.includes('.span-all')) {
        c += '\n\n/* Span Helper */\n.span-all { grid-column: 1 / -1; }';
    }

    // Better Radar Styling
    const oldRadar = `/* ============================================
   RADAR DE SAÚDE FINANCEIRA
   ============================================ */

.radar-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 780px) {
  .radar-grid { grid-template-columns: 1fr; }
}

.radar-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--panel-strong);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}`;
    const newRadar = `/* ============================================
   RADAR DE SAÚDE FINANCEIRA
   ============================================ */

.radar-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@media (max-width: 1100px) {
  .radar-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 780px) {
  .radar-grid { grid-template-columns: 1fr; }
}

.radar-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(248,250,252,0.95));
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 25px rgba(0,0,0,0.02);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
}
.radar-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0,0,0,0.06);
  border-color: var(--primary);
}
.radar-icon {
  font-size: 2rem;
  background: #f8fafc;
  padding: 12px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);
  margin-bottom: 8px;
}
.radar-content { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.radar-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700; }
.radar-value { font-size: 1.6rem; font-weight: 700; color: var(--text-main); line-height: 1.1; }
.radar-hint { font-size: 0.75rem; color: #64748b; line-height: 1.4; opacity: 0.8; }
.radar-badge {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}`;

    if (c.includes(`.radar-card {`)) {
       // Manual replacement to not mess up indices
       let radarStart = c.indexOf('/* ============================================\n   RADAR DE');
       if (radarStart === -1) radarStart = c.indexOf('.radar-grid {');
       
       let cardEnd = c.indexOf('.radar-badge {');
       let endBlock = c.indexOf('}', cardEnd);
       if (radarStart > -1 && cardEnd > -1) {
           c = c.substring(0, radarStart) + newRadar + c.substring(endBlock + 1);
       }
    }

    fs.writeFileSync('style.css', c);
}

function updateTableStyles() {
    let c = fs.readFileSync('style.css', 'utf8');
    
    if(!c.includes('.analytic-table tbody tr:hover')) {
        const tablePremium = `
.analytic-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
  font-size: 0.95rem;
}
.analytic-table th {
  padding: 16px 20px;
  background: #f8fafc;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  border-bottom: 2px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 10;
}
.analytic-table td {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-main);
  transition: var(--transition);
}
.analytic-table tbody tr {
  transition: all 0.2s ease-in-out;
  background: transparent;
}
.analytic-table tbody tr:hover {
  background: rgba(13, 148, 136, 0.03);
  transform: scale(1.002);
}
.table-wrapper {
  width: 100%;
  overflow-x: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: white;
  box-shadow: 0 4px 15px rgba(0,0,0,0.02);
  margin-top: 20px;
}
.table-wrapper::-webkit-scrollbar {
  height: 8px;
}
.table-wrapper::-webkit-scrollbar-track {
  background: #f1f5f9;
}
.table-wrapper::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
`;
        // Remove old table rules
        c = c.replace(/\.analytic-table[\s\S]*?font-size: 0\.8rem; }/g, tablePremium);
        // also replace table-wrapper rule
        c = c.replace(/\.table-wrapper { width: 100%; overflow-x: auto; margin-top: 16px; }/g, '');
        fs.writeFileSync('style.css', c);
    }
}

addSpanAll();
updateCSS();
updateTableStyles();

console.log('Success styling files');
