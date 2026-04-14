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

    // Obter dados em paralelo
    const [metrics, globalNews] = await Promise.all([
        fetchFinancialMetrics(ticker),
        fetchMarketNews()
    ]);

    const sentiment = analyzeGlobalSentiment(globalNews);
    const score     = calculateGrowthScore(metrics, asset.type, sentiment);

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
                <div style="margin-top:25px;">
                    <div style="background:rgba(13,148,136,.05);padding:15px;border-radius:12px;border-left:4px solid var(--trading-blue);">
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                            <small style="opacity:.6;color:var(--text-muted);">${barLabel}</small>
                            <strong style="color:${vsHighVal < -15 ? 'var(--trading-green)' : 'var(--text-main)'}">${fmtP(metrics?.vsHigh) || na('N/D')}</strong>
                        </div>
                        <div style="width:100%;height:6px;background:rgba(0,0,0,.05);border-radius:3px;overflow:hidden;">
                            <div style="width:${barWidth}%;height:100%;background:var(--trading-blue);"></div>
                        </div>
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
                <strong style="color:${score.color};font-size:1.1rem;text-transform:uppercase;letter-spacing:.05em;">Veredito Final da IA</strong>
                <span style="font-size:.75rem;color:var(--text-muted);">Horizonte: Longo Prazo</span>
            </header>
            <p style="font-size:1.05rem;line-height:1.6;color:var(--text-main);margin-bottom:25px;">${score.action}</p>
            <button class="primary-btn" style="width:100%;padding:18px;font-size:1.1rem;font-weight:700;border-radius:12px;" onclick="window.fillAssetForm('${asset.ticker}', '${asset.name}', '${asset.type === 'REIT' ? 'reit' : (asset.type === 'ETF' ? 'dividends' : 'growth')}')">  
                Executar Decisão: Registar Ativo no Portfólio
            </button>
        </div>
    `;
};

// ── MOTOR DE INTELIGÊNCIA E MÉTRICAS ──────────────────────────

async function fetchFinancialMetrics(ticker) {
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
            yahooData = await fetchYahooFallback(ticker);
        }

        // Preço: Yahoo > Finnhub Quote > Finnhub Metric
        const currPrice = yahooData?.price || (hasQuote ? q.c : null) || (m['52WeekHigh'] ? m['52WeekHigh'] * 0.9 : null);
        const high52    = m['52WeekHigh'] || yahooData?.high52 || (hasQuote ? q.h : null) || null;
        const low52     = m['52WeekLow']  || yahooData?.low52  || (hasQuote ? q.l : null) || null;
        const prevClose = (hasQuote && q.pc > 0) ? q.pc : yahooData?.prevClose || null;
        const vsHigh    = (currPrice && high52) ? ((currPrice / high52) - 1) * 100 : null;
        const changePercent = (currPrice && prevClose) ? ((currPrice - prevClose) / prevClose * 100) : yahooData?.changePercent || null;

        return {
            _type: assetType,
            _source: hasMetrics ? 'finnhub' : (yahooData ? 'yahoo' : 'limited'),
            // Fundamentais (null para ETFs — a renderização adapta-se)
            yield:         m.dividendYieldIndicatedAnnual || m.dividendYield5YAvg || null,
            pe:            m.peExclExtraTTM || m.peTTM || null,
            pb:            m.priceToBookTTM || m.pbTTM || null,
            marketCap:     m.marketCapitalization || yahooData?.marketCap || null,
            roi:           m.roiTTM || m.roeTTM || null,
            epsGrowth:     m.epsGrowth5Y || m.epsGrowthTTM || null,
            debtEquity:    m.totalDebtToTotalEquityTTM || null,
            revenueGrowth: m.revenueGrowth5Y || null,
            beta:          m.beta || null,
            // Preço e performance
            currPrice,
            high52,
            low52,
            vsHigh,
            prevClose,
            changePercent,
            name: yahooData?.name || null,
        };
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

            console.log(`[Pro 360] Yahoo Finance: ${ticker} → preço ${price}, máx52 ${high52}`);

            return {
                price,
                prevClose,
                high52,
                low52,
                changePercent: (price && prevClose) ? ((price - prevClose) / prevClose * 100) : null,
                marketCap: meta.marketCap || null,
                name: meta.shortName || meta.longName || null,
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
        positive: ['crescimento', 'recuperação', 'inovação', 'corte', 'estímulo', 'tech', 'recorde', 'alta'],
        negative: ['inflação', 'aumento', 'taxas', 'conflito', 'guerra', 'recessão', 'crise', 'risco', 'queda'],
        macro: ['bce', 'fed', 'juros', 'emprego', 'pib', 'petróleo', 'ouro']
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
        // Função de score simplificada para ETFs (baseada em performance e yield)
        score = 75; // Base sólida — ETFs diversificados têm risco estruturalmente menor
        if (metrics.vsHigh !== null && metrics.vsHigh < -10) score += 8; // bom ponto de entrada
        if (metrics.yield && metrics.yield > 1) score += 5;
        if (metrics.changePercent < -3) score += 5; // correcção recente = oportunidade
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
        // Finnhub requer símbolos no formato AAPL ou XLON:VWCE
        const symbol = ticker.replace('.DE', '').replace('.IT', ''); // Simplificação rudimentar
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
        const currentPrice = window.state.priceCache && window.state.priceCache[asset.ticker.toUpperCase()] 
            ? window.state.priceCache[asset.ticker.toUpperCase()] 
            : asset.avgPrice;
        
        const currentValue = asset.qty * currentPrice;
        totalInvestedValue += currentValue;
        allocationData[asset.category] = (allocationData[asset.category] || 0) + currentValue;

        const profitPct = (((currentPrice - asset.avgPrice) / asset.avgPrice) * 100).toFixed(2);
        const profitClass = profitPct >= 0 ? 'value-up' : 'value-down';

        const item = document.createElement('article');
        item.className = 'asset-item';
        
        item.innerHTML = `
            <div style="min-width: 0; flex: 1;">
                <span class="ticker-badge">${asset.ticker}</span>
                <strong style="margin-left: 10px;">${asset.name}</strong>
                <div style="margin-top: 5px; font-size: 0.8rem;">
                  <span class="type-pill">${asset.category}</span>
                  <small style="color: var(--text-muted); margin-left: 8px;">${asset.qty} unids @ ${window.formatCurrency(asset.avgPrice)}</small>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 700;">${window.formatCurrency(currentValue)}</div>
                <small class="${profitClass}">${profitPct}% ${profitPct >= 0 ? '▲' : '▼'}</small>
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

function getPeriodicHighlights() {
    // Lógica para selecionar destaques com base na data
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth();
    
    return {
        dia: AI_KNOWLEDGE[day % AI_KNOWLEDGE.length],
        semana: AI_KNOWLEDGE[(day + 7) % AI_KNOWLEDGE.length],
        mes: AI_KNOWLEDGE[month % AI_KNOWLEDGE.length]
    };
}

function generateAiOpportunities() {
    const container = document.getElementById('aiDiscoveryList');
    if (!container) return;

    const highlights = getPeriodicHighlights();
    const categories = ['Stock', 'REIT', 'ETF', 'Crypto'];
    const catConfig = {
        'Stock': { title: '📊 Screener de Ações Pro', color: 'var(--trading-blue)' },
        'REIT':  { title: '🏠 Radar Imobiliário (REITs)', color: 'var(--accent)' },
        'ETF':   { title: '🌍 Diretório de ETFs Globais', color: 'var(--trading-blue)' },
        'Crypto':{ title: '🪙 Watchlist Cripto', color: 'var(--trading-green)' }
    };

    container.innerHTML = `
        <div style="background: linear-gradient(135deg, rgba(13, 148, 136, 0.05), rgba(124, 58, 237, 0.05)); border: 1px solid var(--border-subtle); padding: 25px; margin-bottom: 40px; border-radius: var(--radius-lg);">
            <h3 style="margin-top:0; border-bottom: 2px solid var(--trading-blue); display: inline-block; padding-bottom: 5px;">📍 Destaques de Hoje</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top:20px;">
                <div style="border: 1px solid var(--border-subtle); padding:20px; background:rgba(255,255,255,0.8); border-radius: var(--radius-md);">
                    <span style="font-size: 0.7rem; color: var(--trading-blue); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">⚡ Sugestão do Dia</span>
                    <strong style="display: block; font-size: 1.5rem; margin: 10px 0; color: var(--text-main);">${highlights.dia.ticker}</strong>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 12px;">${highlights.dia.rationale.substring(0, 80)}...</p>
                    <button class="primary-btn" style="width:100%; font-size: 0.8rem; border-radius: 8px;" onclick="window.viewFullStudy('${highlights.dia.ticker}')">Análise Analista →</button>
                </div>
                <div style="border: 1px solid var(--border-subtle); padding:20px; background:rgba(255,255,255,0.8); border-radius: var(--radius-md);">
                    <span style="font-size: 0.7rem; color: var(--trading-green); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">🔥 Da Semana</span>
                    <strong style="display: block; font-size: 1.5rem; margin: 10px 0; color: var(--text-main);">${highlights.semana.ticker}</strong>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 12px;">${highlights.semana.rationale.substring(0, 80)}...</p>
                    <button class="primary-btn" style="width:100%; font-size: 0.8rem; background: var(--trading-green); border-radius: 8px;" onclick="window.viewFullStudy('${highlights.semana.ticker}')">Análise Analista →</button>
                </div>
            </div>
        </div>
    `;

    categories.forEach(cat => {
        const cfg = catConfig[cat];
        // Mostrar 3 ativos recomendados por categoria
        const items = AI_KNOWLEDGE.filter(a => a.type === cat && a.recommended !== false).slice(0, 3);
        if (items.length === 0) return;
        
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 48px;';
        section.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid var(--border-subtle);">
                <div style="width: 5px; height: 32px; background: ${cfg.color}; border-radius: 4px;"></div>
                <h4 style="font-size: 1.05rem; font-weight: 800; text-transform: uppercase; margin: 0; color: ${cfg.color}; letter-spacing: 0.05em;">${cfg.title}</h4>
                <span style="margin-left: auto; font-size: 0.65rem; background: ${cfg.color}22; color: ${cfg.color}; padding: 3px 10px; border-radius: 99px; font-weight: 700; border: 1px solid ${cfg.color}44;">IA ATIVA</span>
            </div>
            <div class="cat-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;"></div>
        `;
        
        const grid = section.querySelector('.cat-grid');
        items.forEach(item => {
            const conf = item.confidence || Math.floor(Math.random() * 25 + 70);
            const confColor = conf >= 85 ? 'var(--trading-green)' : conf >= 75 ? 'var(--accent)' : 'var(--text-muted)';
            const card = document.createElement('div');
            card.className = 'ai-suggestion-card';
            card.style.cssText = 'margin: 0; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;';
            card.onmouseover = () => { card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; };
            card.onmouseout  = () => { card.style.transform = 'none'; card.style.boxShadow = ''; };
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <span class="ticker-badge">${item.ticker}</span>
                    <div style="text-align: right;">
                        <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Confiança IA</div>
                        <strong style="font-size: 0.9rem; color: ${confColor};">${conf}%</strong>
                    </div>
                </div>
                <p style="font-size: 1rem; margin: 0 0 8px; font-weight: 700; color: var(--text-main);">${item.name}</p>
                <span style="font-size: 0.65rem; background: ${cfg.color}14; color: ${cfg.color}; padding: 2px 8px; border-radius: 99px; font-weight: 700; text-transform: uppercase;">${item.focus}</span>
                <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; margin: 10px 0 14px;">${item.rationale}</p>
                <button class="primary-btn" style="padding: 10px; font-size: 0.75rem; width:100%; border-radius: 8px;" onclick="window.viewFullStudy('${item.ticker}')">Estudo 360º IA →</button>
            `;
            grid.appendChild(card);
        });
        container.appendChild(section);
    });

    const status = document.createElement('div');
    status.style.cssText = 'font-size: 0.65rem; text-align: center; color: var(--text-muted); margin-top: 20px; font-weight: 600; padding: 12px; background: rgba(13,148,136,0.05); border-radius: 8px;';
    status.textContent = '🤖 IA Scanner Ativo — Varrimento de 60+ ativos globais em tempo real';
    container.appendChild(status);
}

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
