/**
 * Módulo de Inteligência de Investimentos (Versão Estável 1.2)
 * Gere portfólio XTB e Recomendações de IA Proativas
 */

// Base de Conhecimento da IA Expandida e Categorizada
const AI_KNOWLEDGE = [
    // ETFs
    { ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World', type: 'ETF', focus: 'Growth/Dividends', rationale: 'Exposição global máxima com diversificação em 3500+ empresas. Ideal para base de portfólio. TER de apenas 0.22%.', confidence: 95, recommended: true },
    { ticker: 'VUAA.IT', name: 'Vanguard S&P 500 (Acc)', type: 'ETF', focus: 'Growth', rationale: 'Reinvestimento automático de dividendos nas 500 maiores empresas dos EUA. Performance histórica superior a 10% ao ano.', confidence: 92, recommended: true },
    { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF', type: 'ETF', focus: 'Growth', rationale: 'Foco em inovação e gigantes tecnológicas (Apple, Microsoft, Nvidia). Crescimento acima dos índices tradicionais.', confidence: 88, recommended: true },
    { ticker: 'IUSE.L', name: 'iShares S&P 500 Energy', type: 'ETF', focus: 'Value', rationale: 'Proteção contra inflação e exposição ao setor energético global. Diversificação setorial estratégica.', confidence: 72, recommended: false },
    { ticker: 'XDWD.DE', name: 'Xtrackers MSCI World', type: 'ETF', focus: 'Growth', rationale: 'Alternativa ao VWCE com cobertura de 1600+ empresas nos mercados desenvolvidos. Excelente liquidez.', confidence: 90, recommended: true },
    
    // REITs (Imobiliário)
    { ticker: 'O', name: 'Realty Income Corp', type: 'REIT', focus: 'Dividends', rationale: 'Aristocrata dos dividendos mensais com portfolio imobiliário resiliente de 13.000+ propriedades. Yield de +5%.', confidence: 91, recommended: true },
    { ticker: 'PLD', name: 'Prologis Inc', type: 'REIT', focus: 'Growth', rationale: 'Líder em infraestrutura logística para e-commerce (Amazon, etc). Cresce com o boom do comércio online.', confidence: 87, recommended: true },
    { ticker: 'EQIX', name: 'Equinix Inc', type: 'REIT', focus: 'Growth', rationale: 'REIT de Data Centers, peça central na revolução da IA. Cerca de 250 centros de dados em 33 países.', confidence: 89, recommended: true },
    { ticker: 'VICI', name: 'VICI Properties', type: 'REIT', focus: 'Dividends', rationale: 'Dono dos principais casinos de Las Vegas. Yield atrativo e contratos de 40+ anos de duração.', confidence: 75, recommended: false },
    { ticker: 'WPC', name: 'W. P. Carey Inc', type: 'REIT', focus: 'Dividends', rationale: 'REIT diversificado com propriedades industriais e de escritórios. Yield superior a 6% com crescimento estável.', confidence: 78, recommended: true },
    
    // Ações (Stocks)
    { ticker: 'NVDA', name: 'Nvidia Corp', type: 'Stock', focus: 'Growth', rationale: 'Deterrente tecnológico em semicondutores e computação acelerada para IA. Crescimento de receitas superior a 120% YoY.', confidence: 93, recommended: true },
    { ticker: 'AAPL', name: 'Apple Inc', type: 'Stock', focus: 'Growth', rationale: 'Ecossistema fechado com forte geração de caixa e recompras de ações. Serviços em crescimento acelerlado.', confidence: 90, recommended: true },
    { ticker: 'MSFT', name: 'Microsoft Corp', type: 'Stock', focus: 'Growth', rationale: 'Líder em Cloud e integração de IA em software empresarial. Azure cresce 25%+ trimestralmente.', confidence: 92, recommended: true },
    { ticker: 'TSLA', name: 'Tesla Inc', type: 'Stock', focus: 'Aggressive', rationale: 'Líder em veículos elétricos e autonomia. Alta volatilidade, alto potencial de valorização com robotaxi.', confidence: 68, recommended: false },
    { ticker: 'AMZN', name: 'Amazon.com Inc', type: 'Stock', focus: 'Growth', rationale: 'Dominância em Cloud (AWS) e e-commerce. Margens a expandir com publicidade e Prime crescente.', confidence: 89, recommended: true },
    { ticker: 'V', name: 'Visa Inc', type: 'Stock', focus: 'Quality', rationale: 'Negocio de redes de pagamento com margem líquida de 55%+. Crescimento resistente a ciclos económicos.', confidence: 88, recommended: true },

    // Criptomoedas
    { ticker: 'BTC', name: 'Bitcoin', type: 'Crypto', focus: 'Store of Value', rationale: 'O “Ouro Digital”. Ativo escasso com adoção institucional crescente, ETFs aprovados e halving cíclico.', confidence: 85, recommended: true },
    { ticker: 'ETH', name: 'Ethereum', type: 'Crypto', focus: 'Technology', rationale: 'Líder em contratos inteligentes e infraestrutura para finanças descentralizadas (DeFi). Staking com yield ~4%.', confidence: 80, recommended: true },
    { ticker: 'SOL', name: 'Solana', type: 'Crypto', focus: 'Speed', rationale: 'Blockchain de alto desempenho para aplicações de escala global. Crescimento do ecossistema DeFi e NFTs.', confidence: 72, recommended: false },
    { ticker: 'LINK', name: 'Chainlink', type: 'Crypto', focus: 'Infrastructure', rationale: 'Protocolo oracle líder para ligação de blockchains com dados do mundo real. Infraestrutura crítica do DeFi.', confidence: 74, recommended: true }
];

// Universo Alargado para o Motor de Descoberta (Scanner)
const SCANNER_UNIVERSE = [
    { ticker: 'META', name: 'Meta Platforms Inc', type: 'Stock' },
    { ticker: 'ASML', name: 'ASML Holding', type: 'Stock' },
    { ticker: 'MA', name: 'Mastercard Inc', type: 'Stock' },
    { ticker: 'GOOGL', name: 'Alphabet Inc', type: 'Stock' },
    { ticker: 'AMT', name: 'American Tower', type: 'REIT' },
    { ticker: 'DLR', name: 'Digital Realty Trust', type: 'REIT' },
    { ticker: 'SCHD', name: 'Schwab US Dividend Equity', type: 'ETF' },
    { ticker: 'VOO', name: 'Vanguard S&P 500', type: 'ETF' },
    { ticker: 'ADA', name: 'Cardano', type: 'Crypto' },
    { ticker: 'DOT', name: 'Polkadot', type: 'Crypto' },
    { ticker: 'AVAX', name: 'Avalanche', type: 'Crypto' }
];

// Funções expostas globalmente para os botões do HTML funcionarem
window.openAssetModal = function() {
    const modal = document.getElementById('assetModal');
    if (modal) modal.style.display = 'flex';
};

window.closeAssetModal = function() {
    const modal = document.getElementById('assetModal');
    if (modal) modal.style.display = 'none';
};

window.analyzeTicker = function() {
    const tickerInput = document.getElementById('tickerInput');
    const ticker = tickerInput ? tickerInput.value.trim().toUpperCase() : "";
    if (!ticker) return;
    window.viewFullStudy(ticker);
};

window.closeStudyModal = function() {
    const modal = document.getElementById('studyModal');
    if (modal) modal.style.display = 'none';
};

window.fillAssetForm = function(ticker, name, category) {
    document.getElementById('assetTicker').value = ticker;
    document.getElementById('assetName').value = name;
    document.getElementById('assetCategory').value = category || 'growth';
    window.openAssetModal();
    window.closeStudyModal();
};

window.viewFullStudy = async function(ticker) {
    const asset = AI_KNOWLEDGE.find(a => a.ticker === ticker) || {
        ticker,
        name: 'Análise de Ativo Externo',
        rationale: 'Esta empresa apresenta indicadores que requerem análise técnica e macro. A nossa IA irá processar os fundamentais agora.'
    };

    const modal = document.getElementById('studyModal');
    const content = document.getElementById('studyContent');
    if (!modal || !content) return;

    // Mostrar estado de carregamento
    content.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="sync-icon" style="font-size: 2.5rem; animation: spin 2s linear infinite; display: inline-block; margin-bottom: 20px;">🔄</div>
            <h3 style="font-family: 'Space Grotesk', sans-serif;">IA a processar Análise 360º para ${ticker}...</h3>
            <p style="opacity: 0.7;">A sincronizar indicadores Fundamentais, Técnicos e Macro</p>
        </div>
    `;
    modal.style.display = 'flex';

    // Obter dados em paralelo (métricas + notícias + IA Gemini)
    const [metrics, globalNews] = await Promise.all([
        fetchFinancialMetrics(ticker),
        fetchMarketNews()
    ]);

    const sentiment = analyzeGlobalSentiment(globalNews);
    const newsHeadlines = (globalNews || []).slice(0, 8).map(n => n.headline).filter(Boolean);

    // Chamar Gemini em paralelo (não bloqueia se não houver chave)
    const geminiAnalysis = await callGeminiAnalysis(
        ticker,
        asset.name,
        asset.type || 'Ativo',
        metrics,
        newsHeadlines
    );

    // Score: usa Gemini se disponível, senão usa regras
    const rulesScore = calculateGrowthScore(metrics, asset.type, sentiment);
    const score = geminiAnalysis?.score != null
        ? { value: geminiAnalysis.score, color: geminiAnalysis.score >= 75 ? '#10b981' : geminiAnalysis.score >= 55 ? '#0d9488' : '#f43f5e', verdict: geminiAnalysis.verdict || rulesScore.verdict, action: '' }
        : rulesScore;

    const isETF    = metrics?._type === 'ETF'    || asset.type === 'ETF';
    const isCrypto  = metrics?._type === 'Crypto'  || asset.type === 'Crypto';
    const isStock   = !isETF && !isCrypto;
    const noKey     = metrics?._noKey;

    // Helper: formata valor ou mostra placeholder
    const fmt  = (v, suffix = '', dec = 2) => (v !== null && v !== undefined && v !== 0) ? `${Number(v).toFixed(dec)}${suffix}` : null;
    const fmtP = (v) => fmt(v, '%');
    const na   = (label) => `<span style="opacity:0.4; font-size:0.8rem;">${label}</span>`;
    const kpi  = (label, value, color = '') =>
        `<div class="kpi-box">
            <small style="opacity:0.5;font-size:0.65rem;text-transform:uppercase;display:block;margin-bottom:4px;">${label}</small>
            <div style="font-weight:700;font-size:1.1rem;${color ? 'color:'+color+';' : ''}">${value !== null ? value : na('N/D')}</div>
         </div>`;

    const changeColor = (metrics?.changePercent ?? null) > 0 ? 'var(--trading-green)' : (metrics?.changePercent ?? null) < 0 ? 'var(--trading-red)' : '';
    const changeStr   = (metrics?.changePercent != null) ? `${metrics.changePercent >= 0 ? '+' : ''}${Number(metrics.changePercent).toFixed(2)}%` : null;

    // Quadrante 1 — adaptado por tipo
    let q1Html = '';
    if (isETF) {
        q1Html = `
            ${kpi('Preço Atual', metrics?.currPrice ? `€${metrics.currPrice.toFixed(2)}` : null)}
            ${kpi('Variação (24h)', changeStr, changeColor)}
            ${kpi('Dividend Yield (Est.)', fmtP(metrics?.yield), 'var(--trading-green)')}
            ${kpi('Desv. vs Máx. 52S', fmtP(metrics?.vsHigh), metrics?.vsHigh < -10 ? 'var(--trading-green)' : '')}
            <div class="kpi-box" style="grid-column:span 2;border-top:1px dashed var(--border-subtle);padding-top:10px;margin-top:5px;">
                <small style="opacity:0.5;font-size:0.65rem;text-transform:uppercase;display:block;margin-bottom:4px;">Mínimo 52 Semanas</small>
                <div style="font-weight:700;font-size:1.1rem;">${metrics?.low52 ? `€${metrics.low52.toFixed(2)}` : na('N/D')}</div>
            </div>`;
    } else if (isCrypto) {
        q1Html = `
            ${kpi('Preço Atual', metrics?.currPrice ? `€${metrics.currPrice.toFixed(2)}` : null)}
            ${kpi('Variação (24h)', changeStr, changeColor)}
            ${kpi('Market Cap', metrics?.marketCap ? `€${(metrics.marketCap).toFixed(0)}M` : null)}
            ${kpi('Volume (24h)', metrics?.volume24h ? `€${(metrics.volume24h / 1e6).toFixed(0)}M` : null)}
            <div class="kpi-box" style="grid-column:span 2;border-top:1px dashed var(--border-subtle);padding-top:10px;margin-top:5px;">
                <small style="opacity:0.5;font-size:0.65rem;text-transform:uppercase;display:block;margin-bottom:4px;">Desv. vs ATH Histórico</small>
                <div style="font-weight:700;font-size:1.1rem;color:${metrics?.vsHigh < -40 ? 'var(--trading-green)' : 'var(--text-main)'}">${fmtP(metrics?.vsHigh) || na('N/D')}</div>
            </div>`;
    } else {
        // Stocks / REITs
        q1Html = `
            ${kpi('P/E Ratio (TTM)', fmt(metrics?.pe, '', 1))}
            ${kpi('P/B Ratio', fmt(metrics?.pb, '', 1))}
            ${kpi('Dividend Yield', fmtP(metrics?.yield), 'var(--trading-green)')}
            ${kpi('ROI (TTM)', fmtP(metrics?.roi), 'var(--trading-green)')}
            <div class="kpi-box" style="grid-column:span 2;border-top:1px dashed var(--border-subtle);padding-top:10px;margin-top:5px;">
                <small style="opacity:0.5;font-size:0.65rem;text-transform:uppercase;display:block;margin-bottom:4px;">Market Cap</small>
                <div style="font-weight:700;font-size:1.1rem;">${metrics?.marketCap ? window.formatCurrency(metrics.marketCap * 1e6) : na('N/D')}</div>
            </div>`;
    }

    // Quadrante 2 — Solidez e Performance (adaptado)
    const q2DebtHtml = (!isCrypto && !isETF && metrics?.debtEquity !== null)
        ? `<div class="kpi-box"><small style="display:block;opacity:0.6;font-size:0.65rem;margin-bottom:4px;">Dívida / Capital</small>
           <strong style="font-size:1.1rem;color:${(metrics?.debtEquity || 0) > 100 ? 'var(--trading-red)' : 'var(--trading-green)'}">${fmtP(metrics?.debtEquity) || 'Baixa'}</strong></div>`
        : kpi(isETF ? 'Beta (Risco)' : 'Beta', fmt(metrics?.beta, 'x', 2));
    const q2GrowthHtml = (!isCrypto)
        ? `<div class="kpi-box"><small style="display:block;opacity:0.6;font-size:0.65rem;margin-bottom:4px;">${isETF ? 'Perf. vs Máximos' : 'Crescimento Rec.'}</small>
           <strong style="font-size:1.1rem;color:var(--trading-green)">${isETF ? (fmtP(metrics?.vsHigh) || na('N/D')) : ('+' + (fmtP(metrics?.revenueGrowth) || na('N/D')))}</strong></div>`
        : kpi('Fornecimento', metrics?.circulatingSupply ? `${(metrics.circulatingSupply / 1e6).toFixed(1)}M` : null);

    // Barra de posição vs máximos
    const vsHighVal = metrics?.vsHigh ?? -100;
    const barWidth = Math.min(100, Math.max(0, 100 + vsHighVal));
    const barLabel = isCrypto ? 'Preço vs ATH Histórico' : 'Preço vs Máximos (52 Sems)';

    content.innerHTML = `
        <p class="eyebrow" style="color:var(--trading-blue);font-weight:700;text-transform:uppercase;letter-spacing:.12em;font-size:.65rem;">Relatório de Inteligência Pro 360º</p>
        
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:2px solid var(--border-subtle);padding-bottom:15px;">
            <div>
                <h2 style="margin:0;font-size:2rem;letter-spacing:-0.02em;">${asset.name} <span style="opacity:.4;">|</span> <span style="color:var(--trading-blue);">${asset.ticker}</span></h2>
                ${metrics?.changePercent !== null ? `<span style="display:inline-block;margin-top:6px;padding:3px 10px;border-radius:99px;background:${changeColor || '#e2e8f0'};color:${changeColor ? '#fff' : 'inherit'};font-size:.8rem;font-weight:700;">${changeStr}</span>` : ''}
                <p style="margin:8px 0 0;opacity:.6;font-size:.95rem;line-height:1.4;">${asset.rationale}</p>
            </div>
            <div style="text-align:right;">
                <div style="background:${score.color};color:#fff;padding:8px 20px;border-radius:12px;font-weight:800;font-size:1.2rem;display:inline-block;box-shadow:0 4px 12px ${score.color}44;">
                    Score: ${score.value}/100
                </div>
                <div style="font-size:0.7rem;color:var(--text-muted);margin-top:6px;font-weight:600;">${score.verdict}</div>
            </div>
        </div>

        ${noKey ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;padding:16px;margin-bottom:20px;font-size:0.9rem;">⚠️ <strong>Chave API não configurada.</strong> Vá a <a href="configuracao.html" style="color:var(--trading-blue);font-weight:700;">Configurações</a> e introduza a sua Finnhub API Key para métricas reais.</div>` : ''}
        
        <div class="invest-grid-v2" style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:30px;">
            <div class="report-section" style="background:#fff;padding:20px;border-radius:16px;border:1px solid var(--border-subtle);box-shadow:var(--shadow-sm);">
                <header style="display:flex;align-items:center;gap:10px;margin-bottom:18px;color:var(--trading-blue);">
                    <span style="font-size:1.2rem;">${isETF ? '📈' : isCrypto ? '🪙' : '📊'}</span>
                    <strong style="font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;">${isETF ? 'Performance & Preço' : isCrypto ? 'Dados de Mercado' : 'Saúde Fundamental'}</strong>
                </header>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                    ${q1Html}
                </div>
            </div>

            <div class="report-section" style="background:rgba(255,255,255,0.03);padding:25px;border-radius:16px;border:1px solid var(--border-subtle);">
                <header style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
                    <span style="font-size:1.3rem;">📐</span>
                    <strong style="font-size:.75rem;text-transform:uppercase;color:var(--trading-blue);letter-spacing:.05em;">Solidez e Performance</strong>
                </header>
                <div class="study-grid-kpi">
                    ${q2DebtHtml}
                    ${q2GrowthHtml}
                </div>
                <div style="margin-top:25px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div style="background:rgba(13,148,136,.05);padding:15px;border-radius:12px;border-left:4px solid var(--trading-blue); grid-column:span 2;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                            <small style="opacity:.6;color:var(--text-muted);">${barLabel}</small>
                            <strong style="color:${vsHighVal < -15 ? 'var(--trading-green)' : 'var(--text-main)'}">${fmtP(metrics?.vsHigh) || na('N/D')}</strong>
                        </div>
                        <div style="width:100%;height:6px;background:rgba(0,0,0,.05);border-radius:3px;overflow:hidden;">
                            <div style="width:${barWidth}%;height:100%;background:var(--trading-blue);"></div>
                        </div>
                    </div>
                    <!-- Novos Indicadores Técnicos -->
                    <div style="background:var(--bg-main); padding:10px; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                        <small style="display:block; opacity:0.6; font-size:0.6rem; text-transform:uppercase;">RSI (14d)</small>
                        <strong style="font-size:1.1rem; color:${(metrics?.rsi || 50) < 35 ? 'var(--trading-green)' : (metrics?.rsi || 50) > 70 ? 'var(--trading-red)' : 'var(--text-main)'}">
                            ${metrics?.rsi ? metrics.rsi.toFixed(0) : 'N/D'}
                        </strong>
                    </div>
                    <div style="background:var(--bg-main); padding:10px; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                        <small style="display:block; opacity:0.6; font-size:0.6rem; text-transform:uppercase;">Backtest (1 Ano)</small>
                        <strong style="font-size:1.1rem; color:${(metrics?.return1Y || 0) >= 0 ? 'var(--trading-green)' : 'var(--trading-red)'}">
                            ${metrics?.return1Y ? metrics.return1Y.toFixed(1) + '%' : 'N/D'}
                        </strong>
                    </div>
                </div>
            </div>

            <div class="report-section" style="grid-column:span 2;background:linear-gradient(135deg,rgba(56,189,248,.08) 0%,rgba(56,189,248,.02) 100%);padding:25px;border-radius:16px;border:1px solid rgba(56,189,248,.2);">
                <header style="display:flex;align-items:center;gap:10px;margin-bottom:15px;">
                    <span style="font-size:1.3rem;">🌍</span>
                    <strong style="font-size:.75rem;text-transform:uppercase;color:var(--trading-blue);letter-spacing:.05em;">Análise Macro &amp; Sentimento</strong>
                </header>
                <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:15px;">
                    ${sentiment.trends.map(t => `<span style="font-size:.7rem;background:#fff;padding:4px 12px;border-radius:99px;border:1px solid var(--trading-blue);font-weight:700;">${t}</span>`).join('')}
                    ${sentiment.alerts.map(a => `<span style="font-size:.7rem;background:#fee2e2;color:#dc2626;padding:4px 12px;border-radius:99px;border:1px solid #fecaca;font-weight:700;">⚠️ ${a}</span>`).join('')}
                </div>
                <p style="font-size:.95rem;line-height:1.7;color:#1e293b;margin:0;font-family:'Space Grotesk',sans-serif;">
                    ${generateMacroInsight(sentiment, ticker, metrics)}
                </p>
            </div>
        </div>

        <div style="background:#fff;padding:25px;border-radius:16px;border-left:6px solid ${score.color};border:1px solid var(--border-subtle);box-shadow:var(--shadow-sm);">
            <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <strong style="color:${score.color};font-size:1.1rem;text-transform:uppercase;letter-spacing:.05em;">
                    ${geminiAnalysis ? '🤖 Análise por IA (Gemini)' : 'Veredito Final da IA'}
                </strong>
                <span style="font-size:.75rem;color:var(--text-muted);">
                    ${geminiAnalysis ? `<span style="background:rgba(16,185,129,0.1);color:#10b981;padding:3px 10px;border-radius:99px;font-weight:700;font-size:0.65rem;">GEMINI AI</span>` : 'Horizonte: Longo Prazo'}
                </span>
            </header>
            ${geminiAnalysis
                ? `<div style="font-size:0.95rem;line-height:1.7;color:var(--text-main);margin-bottom:25px;">${formatGeminiResponse(geminiAnalysis.text)}</div>`
                : `<p style="font-size:1.05rem;line-height:1.6;color:var(--text-main);margin-bottom:25px;">${score.action}</p>`
            }
            ${!window.state?.geminiApiKey ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:14px;margin-bottom:20px;font-size:0.85rem;">💡 <strong>Activa a IA real:</strong> Vai a <a href="configuracao.html" style="color:var(--trading-blue);font-weight:700;">Configuração</a> e adiciona a tua <strong>Gemini API Key</strong> (gratuita em aistudio.google.com) para receberes análises geradas por IA com os dados reais deste ativo.</div>` : ''}
            <button class="primary-btn" style="width:100%;padding:18px;font-size:1.1rem;font-weight:700;border-radius:12px;" onclick="window.fillAssetForm('${asset.ticker}', '${asset.name}', '${asset.type === 'REIT' ? 'reit' : (asset.type === 'ETF' ? 'dividends' : 'growth')}')">
                Executar Decisão: Registar Ativo no Portfólio
            </button>
        </div>
    `;
};

// ── MOTOR DE INTELIGÊNCIA E MÉTRICAS ──────────────────────────

// ── GEMINI AI: ANÁLISE REAL ────────────────────────────────────

async function callGeminiAnalysis(ticker, assetName, assetType, metrics, newsHeadlines) {
  const geminiKey = window.state?.geminiApiKey;
  if (!geminiKey) return null;

  // Construir contexto financeiro real para o prompt
  const priceStr    = metrics?.currPrice != null ? `€${Number(metrics.currPrice).toFixed(2)}` : 'indisponível';
  const changeStr   = metrics?.changePercent != null ? `${Number(metrics.changePercent).toFixed(2)}%` : 'N/D';
  const highStr     = metrics?.high52 != null ? `€${Number(metrics.high52).toFixed(2)}` : 'N/D';
  const lowStr      = metrics?.low52  != null ? `€${Number(metrics.low52).toFixed(2)}`  : 'N/D';
  const vsHighStr   = metrics?.vsHigh != null ? `${Number(metrics.vsHigh).toFixed(1)}%`  : 'N/D';
  const peStr       = metrics?.pe     != null ? Number(metrics.pe).toFixed(1)   : 'N/D';
  const yieldStr    = metrics?.yield  != null ? `${Number(metrics.yield).toFixed(2)}%`   : 'N/D';
  const rsiStr      = metrics?.rsi    != null ? Number(metrics.rsi).toFixed(0)   : 'N/D';
  const ret1YStr    = metrics?.return1Y != null ? `${Number(metrics.return1Y).toFixed(1)}%` : 'N/D';
  const marketCapStr = metrics?.marketCap != null ? `${Number(metrics.marketCap).toFixed(0)}M€` : 'N/D';

  const newsContext = (newsHeadlines || []).slice(0, 5).join(' | ') || 'Sem notícias recentes disponíveis.';

  const prompt = `És um analista financeiro especializado em mercados europeus e globais. Analisa o seguinte ativo de forma objetiva e concisa.

ATIVO: ${assetName} (${ticker})
TIPO: ${assetType}

DADOS DE MERCADO REAIS:
- Preço atual: ${priceStr}
- Variação (24h): ${changeStr}
- Máximo 52 semanas: ${highStr}
- Mínimo 52 semanas: ${lowStr}
- Desvio vs máximos: ${vsHighStr}
- P/E Ratio: ${peStr}
- Dividend Yield: ${yieldStr}
- RSI (14d): ${rsiStr}
- Retorno 1 Ano: ${ret1YStr}
- Market Cap: ${marketCapStr}

NOTÍCIAS RECENTES DO MERCADO:
${newsContext}

Fornece uma análise estruturada com:
1. VEREDITO (1 linha): Compra Forte / Acumular / Neutro / Aguardar / Vender
2. SCORE (0-100): Baseado nos dados reais acima
3. RACIONAL (2-3 parágrafos): Por que este ativo, agora, com estes dados. Menciona o RSI, o desvio vs máximos, e qualquer risco ou oportunidade específica.
4. PONTO DE ENTRADA: Nível de preço ou condição técnica para entrada ideal
5. RISCO PRINCIPAL: O maior risco para este ativo no contexto atual

Responde em português europeu. Sê direto e objetivo, sem linguagem genérica.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800,
            topP: 0.8
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn('[Gemini] API error:', response.status, err?.error?.message);
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    // Parsear resposta para extrair score e veredito
    const scoreMatch   = text.match(/SCORE[^:]*:\s*(\d+)/i);
    const verdictMatch = text.match(/VEREDITO[^:]*:\s*([^\n]+)/i);
    const score  = scoreMatch  ? Math.min(100, Math.max(0, parseInt(scoreMatch[1])))  : null;
    const verdict = verdictMatch ? verdictMatch[1].trim() : null;

    return { text, score, verdict, source: 'gemini' };
  } catch (e) {
    console.error('[Gemini] Erro:', e.message);
    return null;
  }
}

// Formatar resposta Gemini para HTML
function formatGeminiResponse(geminiText) {
  if (!geminiText) return '';
  return geminiText
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^(\d+\.\s*[A-ZÁÉÍÓÚ ]+:)/gm, '<br><strong style="color:var(--trading-blue);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;">$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

    // ── GESTÃO DE CACHE (15 MINUTOS) ──
    const CACHE_KEY = `metrics_cache_${ticker}`;
    const CACHE_TTL = 15 * 60 * 1000;
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TTL) {
                console.log(`[Pro 360] Serving ${ticker} from cache.`);
                return data;
            }
        }
    } catch(e) {}

    const apiKey = window.state?.finnhubApiKey;
    const assetInfo = AI_KNOWLEDGE.find(a => a.ticker === ticker);
    const assetType = assetInfo?.type || 'Stock';

    // Para Cripto, usar CoinGecko (grátis, sem chave)
    if (assetType === 'Crypto' || ['BTC','ETH','SOL','LINK','ADA','DOT','AVAX'].includes(ticker)) {
        return fetchCryptoMetrics(ticker);
    }

    if (!apiKey) {
        console.warn(`[Pro 360] Chave API Finnhub em falta.`);
        return { _noKey: true, _type: assetType };
    }

    try {
        // Camada 1: Finnhub (métricas fundamentais + cotação)
        const [metricsRes, quoteRes] = await Promise.all([
            fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${apiKey}`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        const m = metricsRes?.metric || {};
        const q = quoteRes || {};
        const hasMetrics = Object.keys(m).length > 0;
        const hasQuote   = q.c > 0;

        // Camada 2: Se Finnhub não devolveu dados, tentar Yahoo Finance (proxy público)
        let yahooData = null;
        if (!hasMetrics && !hasQuote) {
            console.log(`[Pro 360] Finnhub sem dados para ${ticker}. A tentar Yahoo Finance...`);
            yahooData = await (window.fetchYahooFallback || fetchYahooFallback)(ticker);
        }

        // Preço: Yahoo > Finnhub Quote > Finnhub Metric
        const currPrice = yahooData?.price || (hasQuote ? q.c : null) || (m['52WeekHigh'] ? m['52WeekHigh'] * 0.9 : null);
        const high52    = m['52WeekHigh'] || yahooData?.high52 || (hasQuote ? q.h : null) || null;
        const low52     = m['52WeekLow']  || yahooData?.low52  || (hasQuote ? q.l : null) || null;
        const prevClose = (hasQuote && q.pc > 0) ? q.pc : yahooData?.prevClose || null;
        const vsHigh    = (currPrice && high52) ? ((currPrice / high52) - 1) * 100 : null;
        const changePercent = (currPrice && prevClose) ? ((currPrice - prevClose) / prevClose * 100) : yahooData?.changePercent || null;

        const result = {
            _type: assetType,
            _source: hasMetrics ? 'finnhub' : (yahooData ? 'yahoo' : 'limited'),
            yield:         m.dividendYieldIndicatedAnnual || m.dividendYield5YAvg || null,
            pe:            m.peExclExtraTTM || m.peTTM || null,
            pb:            m.priceToBookTTM || m.pbTTM || null,
            marketCap:     m.marketCapitalization || yahooData?.marketCap || null,
            roi:           m.roiTTM || m.roeTTM || null,
            epsGrowth:     m.epsGrowth5Y || m.epsGrowthTTM || null,
            debtEquity:    m.totalDebtToTotalEquityTTM || null,
            revenueGrowth: m.revenueGrowth5Y || null,
            beta:          m.beta || null,
            currPrice,
            high52,
            low52,
            vsHigh,
            prevClose,
            changePercent,
            name: yahooData?.name || null,
            rsi: yahooData?.rsi || null,
            sma8: yahooData?.sma8 || null,
            return1Y: yahooData?.return1Y || null
        };

        // Guardar em Cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
        return result;
    } catch (e) {
        console.error("[Pro 360] Erro ao obter métricas:", e);
        return { _type: assetType, _source: 'error' };
    }
}

// Camada 2: Yahoo Finance via proxy CORS (sem chave, gratuito)
async function fetchYahooFallback(ticker) {
    // Mapear tickers para formato Yahoo (VUAA.IT → VUAA.MI para Borsa Italiana)
    const YAHOO_MAP = {
        'VUAA.IT': 'VUAA.MI',
        'VWCE.DE': 'VWCE.DE',
        'IUSE.L':  'IUSE.L',
    };
    const yahooTicker = YAHOO_MAP[ticker] || ticker;
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=1y&interval=1d`;

    // Tentar múltiplos proxies CORS em cascata
    const PROXIES = [
        `https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(yahooUrl)}`,
    ];

    for (const url of PROXIES) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            const result = data?.chart?.result?.[0];
            if (!result) continue;

            const meta = result.meta || {};
            const quotes = result.indicators?.quote?.[0] || {};
            const closes = quotes.close?.filter(v => v != null) || [];
            const highs  = quotes.high?.filter(v => v != null) || [];
            const lows   = quotes.low?.filter(v => v != null) || [];

            const price     = meta.regularMarketPrice || closes[closes.length - 1] || null;
            const prevClose = meta.chartPreviousClose || meta.previousClose || (closes.length > 1 ? closes[closes.length - 2] : null);
            const high52    = highs.length ? Math.max(...highs) : null;
            const low52     = lows.length  ? Math.min(...lows)  : null;

            // ── CÁLCULO DE INDICADORES TÉCNICOS (RSI & SMA) ──
            let rsi = null;
            if (closes.length >= 15) {
                let gains = 0, losses = 0;
                for (let i = closes.length - 14; i < closes.length; i++) {
                    const diff = closes[i] - closes[i-1];
                    if (diff >= 0) gains += diff; else losses -= diff;
                }
                const rs = gains / (losses || 1);
                rsi = 100 - (100 / (1 + rs));
            }

            const sma8 = closes.length >= 8 ? closes.slice(-8).reduce((a, b) => a + b, 0) / 8 : null;
            const return1Y = (price && closes[0]) ? ((price / closes[0]) - 1) * 100 : null;

            console.log(`[Pro 360] Yahoo Data OK: ${ticker} | Preço: ${price} | RSI: ${rsi?.toFixed(0)}`);

            return {
                price,
                prevClose,
                high52,
                low52,
                changePercent: (price && prevClose) ? ((price - prevClose) / prevClose * 100) : null,
                marketCap: meta.marketCap || null,
                name: meta.shortName || meta.longName || null,
                rsi,
                sma8,
                return1Y
            };
        } catch (e) {
            console.warn(`[Pro 360] Yahoo fallback falhou para ${ticker}:`, e.message);
        }
    }
    return null;
}


// Busca métricas de Cripto via CoinGecko (grátis, sem chave API)
async function fetchCryptoMetrics(ticker) {
    const COINGECKO_IDS = {
        BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
        LINK: 'chainlink', ADA: 'cardano', DOT: 'polkadot', AVAX: 'avalanche-2'
    };
    const id = COINGECKO_IDS[ticker.toUpperCase()];
    if (!id) return null;
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`);
        if (!res.ok) return null;
        const d = await res.json();
        const md = d.market_data || {};
        const currPrice = md.current_price?.eur || md.current_price?.usd || 0;
        const high52    = md.ath?.eur || md.ath?.usd || null;
        return {
            _type: 'Crypto',
            currPrice,
            high52,
            low52:         md.atl?.eur || md.atl?.usd || null,
            vsHigh:        (currPrice && high52) ? ((currPrice / high52) - 1) * 100 : null,
            changePercent: md.price_change_percentage_24h || null,
            marketCap:     (md.market_cap?.eur || md.market_cap?.usd || 0) / 1e6, // em milhões
            volume24h:     md.total_volume?.eur || md.total_volume?.usd || null,
            circulatingSupply: d.market_data?.circulating_supply || null,
            // Não aplicação a Cripto:
            pe: null, pb: null, roi: null, debtEquity: null, revenueGrowth: null,
        };
    } catch (e) {
        console.error('[Pro 360] Erro CoinGecko:', e);
        return null;
    }
}


async function fetchMarketNews() {
    if (!window.state.finnhubApiKey) return [];
    try {
        const newsContainer = document.getElementById('marketPulseContent');
        if (newsContainer) {
            newsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--trading-blue); font-size:0.8rem;">📡 A varrer mercados globais (Crypto, Forex, Stocks)...</div>';
        }
        console.log("IA Scanner: A varrer mercados globais...");
        // Tentar múltiplas categorias em paralelo para garantir que nada falha
        const categories = ['general', 'crypto', 'forex', 'merger'];
        const results = await Promise.all(
            categories.map(cat => 
                fetch(`https://finnhub.io/api/v1/news?category=${cat}&token=${window.state.finnhubApiKey}`)
                .then(r => r.ok ? r.json() : [])
            )
        );
        const allNews = results.flat().sort((a,b) => b.datetime - a.datetime);
        console.log(`IA Scanner: Detetadas ${allNews.length} movimentações relevantes.`);
        return allNews;
    } catch (e) {
        console.error("Scanner Error:", e);
        return [];
    }
}

function analyzeGlobalSentiment(news) {
    const keywords = {
        positive: ['growth', 'recovery', 'innovation', 'cut', 'stimulus', 'tech', 'record', 'rally', 'surge', 'beat', 'upgrade', 'profit', 'expansion'],
        negative: ['inflation', 'hike', 'tariff', 'conflict', 'war', 'recession', 'crisis', 'risk', 'decline', 'downgrade', 'miss', 'slump', 'drop'],
        macro: ['bce', 'fed', 'juros', 'rates', 'pib', 'gdp', 'oil', 'gold', 'employment']
    };

    let sentiment = { score: 0, alerts: [], trends: [] };
    
    news.slice(0, 15).forEach(item => {
        const text = (item.headline + " " + item.summary).toLowerCase();
        
        keywords.positive.forEach(k => { if (text.includes(k)) sentiment.score += 5; });
        keywords.negative.forEach(k => { if (text.includes(k)) sentiment.score -= 5; });
        
        if (text.includes('taxa') || text.includes('juro')) sentiment.trends.push("Foco em Política Monetária");
        if (text.includes('conflito') || text.includes('guerra')) sentiment.alerts.push("Risco Geopolítico Elevado");
        if (text.includes('ia') || text.includes('inteligência artificial')) sentiment.trends.push("Boom Tecnológico");
    });

    return sentiment;
}

function generateDynamicRationale(asset, metrics) {
    if (!metrics) return asset.rationale;
    
    let text = asset.rationale + " ";
    
    if (metrics.pe > 30) {
        text += `Atualmente o ativo negoceia com um P/E elevado (${metrics.pe.toFixed(1)}), refletindo altas expectativas de crescimento. `;
    } else if (metrics.pe < 15 && metrics.pe > 0) {
        text += `O múltiplo P/E de ${metrics.pe.toFixed(1)} sugere uma potencial subvalorização face à média do mercado. `;
    }
    
    if (metrics.vsHigh < -20) {
        text += `O ativo encontra-se ${Math.abs(metrics.vsHigh).toFixed(0)}% abaixo do seu máximo anual, o que pode representar uma janela de oportunidade estratégica para entrada fracionada. `;
    }
    
    if (metrics.yield > 4) {
        text += `O Dividend Yield de ${metrics.yield.toFixed(2)}% é robusto, oferecendo boa componente de rendimento passivo enquanto aguarda a valorização.`;
    }
    
    return text;
}

function calculateTechnicalSignal(metrics) {
    if (!metrics) return { text: 'Neutro', color: 'var(--text-muted)' };
    
    // Simplificação de sinal baseado em volume/preço relativo
    if (metrics.vsHigh < -30) return { text: 'Sobrevendido (Oportunidade)', color: 'var(--trading-green)' };
    if (metrics.vsHigh > -5) return { text: 'Extendido (Prudência)', color: '#f59e0b' };
    return { text: 'Tendência Saudável', color: 'var(--trading-blue)' };
}

function generateMacroInsight(sentiment, ticker, metrics) {
    let insight = "O cenário global atual mostra ";
    if (sentiment.score > 20) insight += "um otimismo moderado impulsionado por avanços tecnológicos e crescimento. ";
    else if (sentiment.score < -20) insight += "uma aversão ao risco elevada devido a pressões macroeconómicas ou inflação. ";
    else insight += "uma estabilidade cautelosa enquanto o mercado aguarda novos catalisadores. ";

    if (sentiment.trends.includes("Foco em Política Monetária")) {
        insight += "A atenção às taxas de juro pode impactar ativos de crescimento como " + ticker + ". ";
    }
    
    if (metrics?.beta > 1.3) {
        insight += "Sendo um ativo de alto Beta, espera-se maior sensibilidade a estas flutuações globais.";
    }

    return insight;
}

function calculateGrowthScore(metrics, type, sentiment) {
    if (!metrics) return { value: 70, color: '#3b82f6', verdict: 'Análise Standard', action: 'Monitorizar fundamentos' };
    
    let score = 50;
    
    if (type === 'ETF') {
        // Score dinâmico para ETFs — começa em 65 (não 75) para permitir sinalizações de risco
        score = 65;
        if (metrics.vsHigh !== null && metrics.vsHigh < -10) score += 10; // bom ponto de entrada
        else if (metrics.vsHigh !== null && metrics.vsHigh > -3) score -= 5; // próximo dos máximos = prudência
        if (metrics.yield && metrics.yield > 1) score += 5;
        if (metrics.changePercent < -3) score += 5; // correcção recente = oportunidade
        if (metrics.changePercent < -10) score -= 10; // queda forte = risco
    } else if (type === 'Crypto') {
        score = 55;
        if (metrics.vsHigh !== null && metrics.vsHigh < -40) score += 20; // muito abaixo do ATH
        else if (metrics.vsHigh !== null && metrics.vsHigh < -20) score += 10;
        if (metrics.changePercent > 5) score += 5;
        if (metrics.changePercent < -10) score -= 10;
    } else {
        // Stocks / REITs
        if (metrics.pe && metrics.pe > 0 && metrics.pe < 25) score += 15;
        if (metrics.roi && metrics.roi > 15) score += 10;
        if (metrics.epsGrowth && metrics.epsGrowth > 10) score += 10;
        if (metrics.vsHigh !== null && metrics.vsHigh < -15) score += 5;
    }
    
    // Ajuste por sentimento macro
    if (sentiment) {
        if (sentiment.score > 20) score += 5;
        if (sentiment.score < -20) score -= 10;
    }
    
    score = Math.min(100, Math.max(10, score));
    
    let color = '#3b82f6'; // Blue
    let verdict = 'Manter em Observação';
    let action = 'Aguardar por um ponto de entrada mais claro ou estabilização macro.';
    
    if (score >= 80) {
        color = '#10b981'; // Green
        verdict = 'Compra Forte';
        action = 'Fundamentais robustos combinados com um ponto técnico atrativo. Considere entrada fracionada.';
    } else if (score >= 65) {
        color = '#0d9488'; // Teal  
        verdict = 'Acumular';
        action = 'Ativo com boa relação risco/retorno. Adequado para construção de posição gradual.';
    } else if (score < 45) {
        color = '#f43f5e'; // Red
        verdict = 'Risco Elevado';
        action = 'Múltiplos esticados ou sinal técnico de exaustão. Recomenda-se aguardar correção.';
    }
    
    return { value: score, color, verdict, action };
}

window.removeAsset = function(index) {
    if (confirm("Deseja remover este ativo do seu portfólio XTB?")) {
        window.state.investments.splice(index, 1);
        if (typeof saveState === 'function') saveState();
        renderAssets();
        generateAiOpportunities();
    }
};

function initInvestments() {
    console.log("A inicializar Terminal de Investimentos...");
    
    // Garantir que o estado global está pronto
    if (typeof window.state === 'undefined') {
        console.warn("[Pro 360] Estado global (window.state) não detetado. A aguardar motor central...");
        setTimeout(initInvestments, 150); 
        return;
    }
    console.log("[Pro 360] Estado detetado com sucesso. Tickers monitorizados:", window.state.investments?.length || 0);
    
    if (!window.state.accounts) window.state.accounts = [];
    if (!window.state.investments) window.state.investments = [];
    if (!window.state.priceCache) window.state.priceCache = {};

    renderXtbBalance();
    renderAssets();
    generateAiOpportunities();
    updateAllocationTargets();
    
    // Tentar atualizar preços e notícias se houver chave API
    if (window.state.finnhubApiKey) {
        window.refreshAllPrices();
        renderMarketPulse();
        
        // Ativar Depurador de Emergência se algo falhar
        window.onerror = function(msg, url, line) {
            const errDiv = document.createElement('div');
            errDiv.style.cssText = 'background:red; color:white; padding:10px; position:fixed; top:0; left:0; z-index:9999; font-size:10px;';
            errDiv.textContent = `ERRO: ${msg} na linha ${line}`;
            document.body.appendChild(errDiv);
        };
        if (window.investmentSuncInterval) clearInterval(window.investmentSuncInterval);
        window.investmentSuncInterval = setInterval(() => {
            console.log("A executar sincronização 360º...");
            window.refreshAllPrices();
            renderMarketPulse();
        }, 300000); // 300.000ms = 5 minutos
    }
}

async function renderMarketPulse() {
    const container = document.getElementById('marketPulseContent');
    if (!container) return;

    if (!window.state.finnhubApiKey) {
        container.innerHTML = `
            <div style="padding: 20px; background: rgba(244, 63, 94, 0.05); border: 1px dashed var(--trading-red); border-radius: 12px; text-align: center;">
                <p style="font-size: 0.8rem; color: var(--trading-red); margin: 0;"><strong>Chave API em falta.</strong><br>Configure a Finnhub API para ver o Radar em Tempo Real.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div style="text-align: center; padding: 20px; opacity: 0.5; font-size: 0.8rem;">A sincronizar notícias globais...</div>';

    const news = await fetchMarketNews();
    if (news.length === 0) {
        container.innerHTML = '<p style="opacity: 0.5; font-size: 0.85rem; text-align: center;">Sem notícias recentes disponíveis no momento.</p>';
        return;
    }

    container.innerHTML = '';
    news.slice(0, 10).forEach(item => {
        const date = new Date(item.datetime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const card = document.createElement('div');
        card.style.cssText = 'padding: 12px; background: #fff; border-radius: 12px; border: 1px solid var(--border-subtle); font-size: 0.85rem; margin-bottom: 8px; transition: transform 0.2s;';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-size: 0.6rem; color: var(--trading-blue); font-weight: 800; text-transform: uppercase;">${item.source} • ${date}</span>
            </div>
            <strong style="display: block; line-height: 1.4; margin-bottom: 8px; font-family: 'Space Grotesk', sans-serif; color: var(--text-main);">${item.headline}</strong>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <a href="${item.url}" target="_blank" style="font-size: 0.72rem; color: var(--accent); text-decoration: none; font-weight: 700;">Ler Racional →</a>
                <span style="font-size: 10px; opacity: 0.4;">Estudo IA disponível</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// ── MOTOR DE PREÇOS REAL-TIME ────────────────────────────────

window.refreshAllPrices = async function() {
    const icon = document.getElementById('syncStatusIcon');
    const time = document.getElementById('lastSyncTime');
    if (icon) icon.style.color = '#f59e0b'; // Amarelo (loading)
    if (time) time.textContent = 'A atualizar cotações...';

    const investments = window.state.investments || [];
    const tickers = [...new Set(investments.map(i => i.ticker.toUpperCase()))];
    
    for (const ticker of tickers) {
        const asset = investments.find(i => i.ticker.toUpperCase() === ticker);
        if (asset && asset.category === 'crypto') {
            await fetchCoinGeckoPrice(ticker);
        } else {
            await fetchFinnhubPrice(ticker);
        }
    }

    if (icon) icon.style.color = '#10b981'; // Verde (sucesso)
    if (time) time.textContent = 'Atualizado agora: ' + new Date().toLocaleTimeString();
    
    renderAssets();
};

async function fetchFinnhubPrice(ticker) {
    if (!window.state.finnhubApiKey) return;
    try {
        // Finnhub requer símbolos no formato AAPL ou XLON:VWCE. Preservar tickers europeus.
        const symbol = ticker; 
        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${window.state.finnhubApiKey}`);
        const data = await response.json();
        if (data.c) {
            window.state.priceCache[ticker] = data.c;
            if (typeof saveState === 'function') saveState();
        }
    } catch (e) {
        console.error("Erro Finnhub:", ticker, e);
    }
}

async function fetchCoinGeckoPrice(ticker) {
    try {
        const idMap = { 'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana' };
        const id = idMap[ticker] || ticker.toLowerCase();
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=eur`);
        const data = await response.json();
        if (data[id]) {
            window.state.priceCache[ticker] = data[id].eur;
            if (typeof saveState === 'function') saveState();
        }
    } catch (e) {
        console.error("Erro CoinGecko:", ticker, e);
    }
}

function renderXtbBalance() {
    const xtbAcc = (window.state.accounts || []).find(a => a.name === "XTB" || a.type === "Investimento");
    const display = document.getElementById('xtbAccountBalance');
    if (display) {
        display.textContent = xtbAcc ? window.formatCurrency(xtbAcc.balance) : window.formatCurrency(0);
    }
}

function renderAssets() {
    const list = document.getElementById('assetsList');
    if (!list) return;

    const investments = window.state.investments || [];

    if (investments.length === 0) {
        list.innerHTML = '<div class="empty-state">Ainda não tem ativos registados.</div>';
        return;
    }

    list.innerHTML = '';
    let totalInvestedValue = 0;
    const allocationData = { dividends: 0, growth: 0, crypto: 0, reit: 0 };

    investments.forEach((asset, index) => {
        const hasCachedPrice = window.state.priceCache && window.state.priceCache[asset.ticker.toUpperCase()];
        const currentPrice = hasCachedPrice
            ? window.state.priceCache[asset.ticker.toUpperCase()]
            : asset.avgPrice;
        // Indicador visual: preço sem cotação real
        const stalePriceTag = !hasCachedPrice
            ? `<span style="background:#f59e0b; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:8px; font-weight:800;" title="Preço de compra — sem cotação de mercado">🕐 SEM COTAÇÃO</span>`
            : '';
        
        const currentValue = asset.qty * currentPrice;
        totalInvestedValue += currentValue;
        allocationData[asset.category] = (allocationData[asset.category] || 0) + currentValue;

        const profitPct = hasCachedPrice ? (((currentPrice - asset.avgPrice) / asset.avgPrice) * 100) : null;
        const profitClass = (profitPct === null || profitPct >= 0) ? 'value-up' : 'value-down';
        const profitStr = profitPct !== null ? `${profitPct.toFixed(2)}% ${profitPct >= 0 ? '▲' : '▼'}` : '— sem cotação';
        
        // Alerta de Queda de Risco
        const alertBadge = (profitPct !== null && profitPct < -10) ? `<span style="background:var(--trading-red); color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:8px; font-weight:800;">ALERTA DE QUEDA</span>` : '';

        const item = document.createElement('article');
        item.className = 'asset-item';
        
        item.innerHTML = `
            <div style="min-width: 0; flex: 1;">
                <span class="ticker-badge">${asset.ticker}</span>
                <strong style="margin-left: 10px;">${asset.name}</strong> ${alertBadge} ${stalePriceTag}
                <div style="margin-top: 5px; font-size: 0.8rem;">
                  <span class="type-pill">${asset.category}</span>
                  <small style="color: var(--text-muted); margin-left: 8px;">${asset.qty} unids @ ${window.formatCurrency(asset.avgPrice)}</small>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 700;">${window.formatCurrency(currentValue)}</div>
                <small class="${profitClass}">${profitStr}</small>
                <button class="ghost-btn" style="padding: 4px; font-size: 0.7rem; display: block; margin-left: auto; margin-top: 4px; color: var(--error);" onclick="window.removeAsset(${index})">Remover</button>
            </div>
        `;
        list.appendChild(item);
    });

    renderAllocationChart(allocationData, totalInvestedValue);
}

function renderAllocationChart(data, total) {
    const chart = document.getElementById('dynamicAllocationChart');
    const totalDisplay = document.getElementById('totalInvestedSmall');
    if (!chart || !totalDisplay) return;

    totalDisplay.textContent = window.formatCurrency(total);

    if (total === 0) {
        chart.style.background = '#eee';
        return;
    }

    const divP = (data.dividends / total) * 100;
    const growthP = (data.growth / total) * 100;
    const cryptoP = (data.crypto / total) * 100;
    const reitP = (data.reit / total) * 100;

    // Conic gradient: Dividends (Blue) -> Growth (Accent) -> Crypto (Green) -> REIT (Warning)
    let current = 0;
    const colors = [
        `var(--trading-blue) ${current}% ${current + divP}%`,
        `var(--accent) ${current + divP}% ${current + divP + growthP}%`,
        `var(--trading-green) ${current + divP + growthP}% ${current + divP + growthP + cryptoP}%`,
        `var(--warning) ${current + divP + growthP + cryptoP}% 100%`
    ];

    chart.style.background = `conic-gradient(${colors.join(', ')})`;
}

// ── SCANNER SEMANAL DE OPORTUNIDADES (GEMINI AI) ─────────────────────────────

const OPPORTUNITIES_CACHE_KEY = 'gemini_weekly_scan';
const OPPORTUNITIES_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias

async function generateAiOpportunities() {
    const container = document.getElementById('aiDiscoveryList');
    if (!container) return;

    // 1. Verificar cache semanal
    try {
        const cached = JSON.parse(localStorage.getItem(OPPORTUNITIES_CACHE_KEY) || 'null');
        if (cached && (Date.now() - cached.timestamp) < OPPORTUNITIES_CACHE_TTL) {
            renderOpportunityCards(container, cached.data, false);
            return;
        }
    } catch(e) {}

    // 2. Sem chave Gemini → fallback informativo
    const geminiKey = window.state?.geminiApiKey;
    if (!geminiKey) {
        container.innerHTML = `
            <div style="background:linear-gradient(135deg,rgba(13,148,136,0.05),rgba(124,58,237,0.05));border:2px dashed var(--primary);border-radius:16px;padding:40px;text-align:center;max-width:560px;margin:0 auto;">
                <div style="font-size:3rem;margin-bottom:16px;">🤖</div>
                <h3 style="margin:0 0 10px;font-family:'Space Grotesk',sans-serif;">Gemini AI — Activar Scanner</h3>
                <p style="color:var(--text-muted);font-size:0.9rem;line-height:1.6;margin:0 0 20px;">
                    Com a tua chave Gemini, o sistema faz um <strong>varrimento semanal</strong> do mercado e recomenda os melhores ativos para o teu perfil — com foco em crescimento e rendimento passivo.
                </p>
                <a href="configuracao.html" class="primary-btn" style="display:inline-block;padding:12px 28px;font-size:0.9rem;text-decoration:none;">Configurar Gemini API Key →</a>
                <p style="font-size:0.7rem;color:var(--text-muted);margin:12px 0 0;opacity:0.6;">Chave gratuita em aistudio.google.com/apikey</p>
            </div>
        `;
        return;
    }

    // 3. Mostrar estado de carregamento animado
    container.innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(13,148,136,0.06),rgba(124,58,237,0.04));border:1px solid var(--border-subtle);border-radius:16px;padding:48px;text-align:center;">
            <div style="font-size:3rem;margin-bottom:16px;display:inline-block;animation:spin 3s linear infinite;">🤖</div>
            <h3 style="margin:0 0 10px;font-family:'Space Grotesk',sans-serif;font-size:1.2rem;">Gemini AI a varrer o mercado...</h3>
            <p style="color:var(--text-muted);font-size:0.85rem;max-width:400px;margin:0 auto 24px;line-height:1.6;">A analisar milhares de ativos globais com base no teu perfil de investidor — crescimento a longo prazo e rendimento passivo</p>
            <div style="display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;font-size:0.72rem;color:var(--text-muted);">
                <span>📊 ETFs Globais</span><span>·</span>
                <span>🏠 REITs</span><span>·</span>
                <span>💰 Ações de Dividendos</span><span>·</span>
                <span>📈 Crescimento</span>
            </div>
        </div>
    `;

    // 4. Construir contexto do utilizador
    const targets   = window.state.investmentTargets || { dividends: 40, growth: 40, crypto: 10, reit: 10 };
    const portfolio = window.state.investments || [];
    const today     = new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const existingList = portfolio.length > 0
        ? portfolio.map(i => `${i.ticker} (${i.category})`).join(', ')
        : 'Nenhum ativo registado ainda';

    // 5. Prompt Gemini — scanner semanal personalizado
    const prompt = `És um analista financeiro sénior especializado em mercados globais, ETFs, ações de crescimento, REITs e ativos de renda passiva.

DATA ACTUAL: ${today}

PERFIL DO INVESTIDOR:
- Alocação desejada em Dividendos/Renda: ${targets.dividends}%
- Alocação desejada em Crescimento: ${targets.growth}%
- Alocação desejada em Cripto: ${targets.crypto}%
- Alocação desejada em REITs: ${targets.reit}%
- Foco principal: Crescimento de capital a longo prazo + rendimento passivo (dividendos e REITs)
- Horizonte temporal: Longo prazo (5+ anos)
- Perfil de risco: Moderado a agressivo

CARTEIRA ACTUAL (não recomendar estes ativos):
${existingList}

TAREFA — SCANNER SEMANAL:
Analisa o contexto macroeconómico actual e recomenda exatamente 8 ativos diversificados para este perfil de investidor. Considera:
1. ETFs globais de baixo custo (ex: VWCE, IWDA, VUAA)
2. Ações com dividendos sólidos e crescimento do payout
3. REITs com yield atrativo e balanço saudável
4. 1-2 ativos de crescimento com momentum positivo
5. Evitar ativos já na carteira
6. Considerar a diversificação geográfica e sectorial

Responde APENAS com JSON válido (sem markdown, sem texto fora do JSON):
{
  "scan_date": "${new Date().toISOString().slice(0,10)}",
  "market_context": "resumo do contexto macro actual em 2-3 frases concretas",
  "macro_risks": "principais riscos macro para os próximos 3 meses",
  "recommendations": [
    {
      "ticker": "TICKER",
      "name": "Nome Completo",
      "type": "ETF|Stock|REIT|Crypto",
      "exchange": "LSE|NYSE|NASDAQ|Euronext|Xetra",
      "focus": "Crescimento|Dividendos|Crescimento+Dividendos|REIT|Cripto",
      "rationale": "Razão específica e fundamentada com dados actuais em 2-3 frases. Por que AGORA?",
      "opportunity": "Janela de oportunidade específica (ex: correção de 15%, yield em máximos, earnings suprise)",
      "risk": "Risco principal e como mitigá-lo",
      "suggested_weight": 12,
      "confidence": 82,
      "priority": "Alta|Media|Baixa",
      "dividend_yield": "3.2%|N/A"
    }
  ]
}`;

    // 6. Chamar Gemini
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.25,
                        maxOutputTokens: 3000,
                        topP: 0.8,
                        responseMimeType: 'application/json'
                    }
                })
            }
        );

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API ${response.status}: ${errData?.error?.message || 'erro desconhecido'}`);
        }

        const apiResp = await response.json();
        const rawText = apiResp?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('Resposta vazia do Gemini');

        const parsed = JSON.parse(rawText);
        if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
            throw new Error('Formato de resposta inválido');
        }

        // 7. Guardar cache por 7 dias
        localStorage.setItem(OPPORTUNITIES_CACHE_KEY, JSON.stringify({
            data: parsed,
            timestamp: Date.now()
        }));

        renderOpportunityCards(container, parsed, true);

    } catch(err) {
        console.error('[Gemini Scanner] Erro:', err);
        container.innerHTML = `
            <div style="background:rgba(244,63,94,0.05);border:1px dashed #f43f5e;border-radius:16px;padding:32px;text-align:center;">
                <div style="font-size:2rem;margin-bottom:12px;">⚠️</div>
                <h3 style="color:#f43f5e;margin:0 0 10px;font-size:1rem;">Erro ao contactar Gemini AI</h3>
                <p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 16px;">${err.message}</p>
                <p style="font-size:0.78rem;color:var(--text-muted);margin:0 0 20px;opacity:0.7;">Verifica a tua chave API em <a href="configuracao.html" style="color:var(--primary);">Configuração</a></p>
                <button onclick="window.forceRefreshOpportunities()" style="background:var(--primary);color:white;border:none;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:700;font-size:0.85rem;">↻ Tentar Novamente</button>
            </div>
        `;
    }
}

// ── RENDERIZAR CARDS DE OPORTUNIDADES ──────────────────────────────────────────

function renderOpportunityCards(container, data, isLive) {
    const recs          = data.recommendations || [];
    const scanDate      = data.scan_date || new Date().toLocaleDateString('pt-PT');
    const marketCtx     = data.market_context || '';
    const macroRisks    = data.macro_risks || '';

    const typeIcons  = { ETF: '🌍', Stock: '📊', REIT: '🏠', Crypto: '🪙' };
    const focusColor = {
        'Crescimento':              '#7c3aed',
        'Dividendos':               '#0d9488',
        'Crescimento+Dividendos':   '#10b981',
        'REIT':                     '#f59e0b',
        'Cripto':                   '#f43f5e'
    };
    const priorityConfig = {
        'Alta':  { color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
        'Media': { color: '#0d9488', bg: 'rgba(13,148,136,0.1)'  },
        'Baixa': { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
    };

    // Calcular dias até próxima renovação
    let daysLeft = 7;
    try {
        const cached = JSON.parse(localStorage.getItem(OPPORTUNITIES_CACHE_KEY) || 'null');
        if (cached) {
            const elapsed = Date.now() - cached.timestamp;
            daysLeft = Math.max(0, Math.ceil((OPPORTUNITIES_CACHE_TTL - elapsed) / 86400000));
        }
    } catch(e) {}

    // Cabeçalho
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 28px;';
    header.innerHTML = `
        <div style="background:linear-gradient(135deg,rgba(13,148,136,0.08),rgba(124,58,237,0.05));border:1px solid var(--border-subtle);border-radius:16px;padding:24px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
                <div>
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                        <span style="font-size:0.65rem;background:${isLive?'rgba(16,185,129,0.15)':'rgba(100,116,139,0.12)'};color:${isLive?'#10b981':'#64748b'};padding:4px 12px;border-radius:99px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">
                            ${isLive?'🤖 GEMINI AI — ANÁLISE NOVA':'🤖 GEMINI AI — CACHE SEMANAL'}
                        </span>
                        ${daysLeft > 0 ? `<span style="font-size:0.65rem;color:var(--text-muted);font-weight:600;">${daysLeft} dia${daysLeft!==1?'s':''} até renovação</span>` : ''}
                    </div>
                    <h3 style="margin:0 0 6px;font-family:'Space Grotesk',sans-serif;font-size:1.15rem;">Radar Semanal de Oportunidades</h3>
                    <p style="margin:0;font-size:0.75rem;color:var(--text-muted);">Análise de ${scanDate} · ${recs.length} ativos recomendados · Não é aconselhamento financeiro</p>
                </div>
                <button onclick="window.forceRefreshOpportunities()" style="flex-shrink:0;background:transparent;border:1px solid var(--border-subtle);padding:8px 16px;border-radius:10px;cursor:pointer;font-size:0.78rem;color:var(--text-muted);font-weight:600;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'" onmouseout="this.style.borderColor='var(--border-subtle)';this.style.color='var(--text-muted)'">↻ Nova Análise</button>
            </div>
            ${marketCtx ? `
            <div style="margin-top:16px;padding:14px;background:rgba(255,255,255,0.6);border-radius:10px;border-left:3px solid var(--primary);">
                <p style="margin:0 0 6px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--primary);">🌍 Contexto de Mercado</p>
                <p style="margin:0;font-size:0.85rem;color:var(--text-main);line-height:1.55;">${marketCtx}</p>
            </div>` : ''}
            ${macroRisks ? `
            <div style="margin-top:10px;padding:12px;background:rgba(244,63,94,0.05);border-radius:10px;border-left:3px solid #f43f5e;">
                <p style="margin:0 0 4px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#f43f5e;">⚠ Riscos Macro</p>
                <p style="margin:0;font-size:0.82rem;color:var(--text-muted);line-height:1.5;">${macroRisks}</p>
            </div>` : ''}
        </div>
    `;
    container.innerHTML = '';
    container.appendChild(header);

    // Grid de cards
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;';

    recs.forEach(rec => {
        const icon      = typeIcons[rec.type]  || '📈';
        const fColor    = focusColor[rec.focus] || '#0d9488';
        const priCfg    = priorityConfig[rec.priority] || priorityConfig['Media'];
        const confColor = rec.confidence >= 80 ? '#10b981' : rec.confidence >= 65 ? '#0d9488' : '#94a3b8';
        const hasYield  = rec.dividend_yield && rec.dividend_yield !== 'N/A';

        const card = document.createElement('article');
        card.style.cssText = 'background:#fff;border-radius:16px;border:1px solid var(--border-subtle);overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;display:flex;flex-direction:column;';
        card.onmouseover = () => { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)'; };
        card.onmouseout  = () => { card.style.transform = 'none'; card.style.boxShadow = ''; };

        card.innerHTML = `
            <div style="background:linear-gradient(135deg,${fColor}12,${fColor}04);padding:18px;border-bottom:1px solid var(--border-subtle);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:1.6rem;line-height:1;">${icon}</span>
                        <div>
                            <span style="font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:1.15rem;color:var(--text-main);">${rec.ticker}</span>
                            ${rec.exchange ? `<span style="display:block;font-size:0.65rem;color:var(--text-muted);margin-top:2px;">${rec.exchange}</span>` : ''}
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">Confiança IA</div>
                        <strong style="font-size:1rem;color:${confColor};">${rec.confidence}%</strong>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:0.65rem;background:${fColor}18;color:${fColor};padding:3px 10px;border-radius:99px;font-weight:700;text-transform:uppercase;">${rec.focus}</span>
                    <span style="font-size:0.65rem;background:${priCfg.bg};color:${priCfg.color};padding:3px 10px;border-radius:99px;font-weight:700;text-transform:uppercase;">Prioridade ${rec.priority}</span>
                    ${hasYield ? `<span style="font-size:0.65rem;background:rgba(16,185,129,0.1);color:#10b981;padding:3px 10px;border-radius:99px;font-weight:700;">Yield ${rec.dividend_yield}</span>` : ''}
                </div>
            </div>
            <div style="padding:18px;flex:1;display:flex;flex-direction:column;gap:10px;">
                <p style="margin:0;font-size:0.95rem;font-weight:700;color:var(--text-main);">${rec.name}</p>
                <p style="margin:0;font-size:0.82rem;color:var(--text-muted);line-height:1.55;">${rec.rationale}</p>

                <div style="background:rgba(16,185,129,0.07);border-radius:10px;padding:12px;border-left:3px solid #10b981;">
                    <p style="margin:0 0 4px;font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#10b981;">⚡ Oportunidade</p>
                    <p style="margin:0;font-size:0.8rem;color:var(--text-main);">${rec.opportunity}</p>
                </div>

                <div style="background:rgba(244,63,94,0.05);border-radius:10px;padding:10px 12px;border-left:3px solid #f43f5e;">
                    <p style="margin:0 0 3px;font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#f43f5e;">⚠ Risco</p>
                    <p style="margin:0;font-size:0.78rem;color:var(--text-muted);">${rec.risk}</p>
                </div>

                ${rec.suggested_weight ? `<p style="margin:0;font-size:0.75rem;color:var(--text-muted);">💡 Peso sugerido na carteira: <strong>${rec.suggested_weight}%</strong></p>` : ''}

                <div style="display:flex;gap:8px;margin-top:auto;padding-top:6px;">
                    <button class="primary-btn" style="flex:1;padding:11px;font-size:0.8rem;border-radius:10px;" onclick="window.viewFullStudy('${rec.ticker}')">Estudo 360º →</button>
                    <button style="padding:11px 14px;font-size:0.8rem;border-radius:10px;background:transparent;border:1px solid var(--border-subtle);cursor:pointer;color:var(--text-muted);font-weight:600;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border-subtle)'" onclick="window.fillAssetForm('${rec.ticker}','${rec.name}','${rec.type==='REIT'?'reit':rec.type==='ETF'?'dividends':rec.type==='Crypto'?'crypto':'growth'}')">+ Registar</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    container.appendChild(grid);

    // Rodapé
    const footer = document.createElement('p');
    footer.style.cssText = 'text-align:center;font-size:0.68rem;color:var(--text-muted);margin-top:24px;opacity:0.7;';
    footer.textContent = '🤖 Análise gerada por Gemini AI · Renovação semanal automática · Não substitui aconselhamento financeiro profissional';
    container.appendChild(footer);
}

// ── FORÇAR RENOVAÇÃO ──────────────────────────────────────────────────────────
window.forceRefreshOpportunities = function() {
    localStorage.removeItem(OPPORTUNITIES_CACHE_KEY);
    generateAiOpportunities();
};

function updateAllocationTargets() {
    const targets = window.state.investmentTargets;
    if (targets) {
        if (document.getElementById('targetDivDisplay')) document.getElementById('targetDivDisplay').textContent = `${targets.dividends}%`;
        if (document.getElementById('targetCryptoDisplay')) document.getElementById('targetCryptoDisplay').textContent = `${targets.crypto}%`;
        if (document.getElementById('targetGrowthDisplay')) document.getElementById('targetGrowthDisplay').textContent = `${targets.growth}%`;
    }
}

// Lógica de Submissão Segura
document.addEventListener('submit', (e) => {
    if (e.target.id === 'asset-form') {
        e.preventDefault();
        const ticker = document.getElementById('assetTicker').value.toUpperCase();
        const name = document.getElementById('assetName').value;
        const qty = Number(document.getElementById('assetQty').value);
        const avgPrice = Number(document.getElementById('assetAvgPrice').value);
        const category = document.getElementById('assetCategory').value;

        const newAsset = { id: Date.now(), ticker, name, qty, avgPrice, category };
        window.state.investments.push(newAsset);
        
        if (typeof saveState === 'function') saveState();
        renderAssets();
        generateAiOpportunities();
        window.closeAssetModal();
        e.target.reset();
    }
});

// Inicialização com atraso de segurança
window.addEventListener('load', () => {
    setTimeout(initInvestments, 200);
});
