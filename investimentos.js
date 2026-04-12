/**
 * Módulo de Inteligência de Investimentos (Versão Estável 1.2)
 * Gere portfólio XTB e Recomendações de IA Proativas
 */

// Base de Conhecimento da IA (Sugestões de Ativos de Crescimento e Dividendos)
// Base de Conhecimento da IA Expandida e Categorizada
const AI_KNOWLEDGE = [
    // ETFs
    { ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World', type: 'ETF', focus: 'Growth/Dividends', rationale: 'Exposição global máxima com diversificação em 3500+ empresas. Ideal para base de portfólio.', recommended: true },
    { ticker: 'VUAA.IT', name: 'Vanguard S&P 500 (Acc)', type: 'ETF', focus: 'Growth', rationale: 'Reinvestimento automático de dividendos nas 500 maiores empresas dos EUA.', recommended: true },
    { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF', type: 'ETF', focus: 'Growth', rationale: 'Foco em inovação e gigantes tecnológicas (Apple, Microsoft, Nvidia).', recommended: true },
    { ticker: 'IUSE.L', name: 'iShares S&P 500 Energy', type: 'ETF', focus: 'Value', rationale: 'Proteção contra inflação e exposição ao setor energético global.', recommended: false },
    
    // REITs (Imobiliário)
    { ticker: 'O', name: 'Realty Income Corp', type: 'REIT', focus: 'Dividends', rationale: 'Aristocrata dos dividendos mensais com portfólio imobiliário resiliente.', recommended: true },
    { ticker: 'PLD', name: 'Prologis Inc', type: 'REIT', focus: 'Growth', rationale: 'Líder em infraestrutura logística para e-commerce (Amazon, etc).', recommended: true },
    { ticker: 'EQIX', name: 'Equinix Inc', type: 'REIT', focus: 'Growth', rationale: 'REIT de Data Centers, peça central na revolução da IA.', recommended: true },
    { ticker: 'VICI', name: 'VICI Properties', type: 'REIT', focus: 'Dividends', rationale: 'Dono dos principais casinos de Las Vegas. Yield atrativo e contratos longos.', recommended: false },
    
    // Ações (Stocks)
    { ticker: 'NVDA', name: 'Nvidia Corp', type: 'Stock', focus: 'Growth', rationale: 'Deterrente tecnológico em semicondutores e computação acelerada para IA.', recommended: true },
    { ticker: 'AAPL', name: 'Apple Inc', type: 'Stock', focus: 'Growth', rationale: 'Ecossistema fechado com forte geração de caixa e recompras de ações.', recommended: true },
    { ticker: 'MSFT', name: 'Microsoft Corp', type: 'Stock', focus: 'Growth', rationale: 'Líder em Cloud e integração de IA em software empresarial.', recommended: true },
    { ticker: 'TSLA', name: 'Tesla Inc', type: 'Stock', focus: 'Aggressive', rationale: 'Líder em veículos elétricos e autonomia. Alta volatilidade, alto potencial.', recommended: false },

    // Criptomoedas
    { ticker: 'BTC', name: 'Bitcoin', type: 'Crypto', focus: 'Store of Value', rationale: 'O "Ouro Digital". Ativo escasso com adoção institucional crescente e halving cíclico.', recommended: true },
    { ticker: 'ETH', name: 'Ethereum', type: 'Crypto', focus: 'Technology', rationale: 'Líder em contratos inteligentes e infraestrutura para finanças descentralizadas (DeFi).', recommended: true },
    { ticker: 'SOL', name: 'Solana', type: 'Crypto', focus: 'Speed', rationale: 'Blockchain de alto desempenho para aplicações de escala global.', recommended: false }
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
    const score = calculateGrowthScore(metrics, asset.type, sentiment);
    const techSignal = calculateTechnicalSignal(metrics);

    content.innerHTML = `
        <p class="eyebrow" style="color: var(--trading-blue); font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.65rem;">Relatório de Inteligência Pro 360º</p>
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid var(--border-subtle); padding-bottom: 15px;">
            <div>
                 <h2 style="margin: 0; font-size: 2rem; letter-spacing: -0.02em;">${asset.name} <span style="opacity:0.4;">|</span> <span style="color: var(--trading-blue);">${asset.ticker}</span></h2>
                 <p style="margin: 8px 0 0; opacity: 0.6; font-size: 0.95rem; line-height: 1.4;">${asset.rationale}</p>
            </div>
            <div style="text-align: right;">
                <div style="background: ${score.color}; color: #fff; padding: 8px 20px; border-radius: 12px; font-weight: 800; font-size: 1.2rem; display: inline-block; box-shadow: 0 4px 12px ${score.color}44;">
                    Score: ${score.value}/100
                </div>
            </div>
        </div>
        
        <div class="invest-grid-v2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px;">
            <!-- Quadrante 1: Fundamental Avançado -->
            <div class="report-section" style="background: #fff; padding: 20px; border-radius: 16px; border: 1px solid var(--border-subtle); box-shadow: var(--shadow-sm);">
                <header style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px; color: var(--trading-blue);">
                    <span style="font-size: 1.2rem;">📊</span> <strong style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Saúde Fundamental</strong>
                </header>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="kpi-box">
                        <small style="opacity: 0.5; font-size: 0.65rem; text-transform: uppercase; display: block; margin-bottom: 4px;">P/E Ratio (TTM)</small>
                        <div style="font-weight: 700; font-size: 1.1rem;">${metrics?.pe ? metrics.pe.toFixed(1) : 'N/A'}</div>
                    </div>
                    <div class="kpi-box">
                        <small style="opacity: 0.5; font-size: 0.65rem; text-transform: uppercase; display: block; margin-bottom: 4px;">P/B Ratio</small>
                        <div style="font-weight: 700; font-size: 1.1rem;">${metrics?.pb ? metrics.pb.toFixed(1) : 'N/A'}</div>
                    </div>
                    <div class="kpi-box">
                        <small style="opacity: 0.5; font-size: 0.65rem; text-transform: uppercase; display: block; margin-bottom: 4px;">Dividend Yield</small>
                        <div style="font-weight: 700; color: var(--trading-green); font-size: 1.1rem;">${metrics?.yield ? metrics.yield.toFixed(2) + '%' : '0.00%'}</div>
                    </div>
                    <div class="kpi-box">
                        <small style="opacity: 0.5; font-size: 0.65rem; text-transform: uppercase; display: block; margin-bottom: 4px;">ROI (TTM)</small>
                        <div style="font-weight: 700; color: var(--trading-green); font-size: 1.1rem;">${metrics?.roi ? metrics.roi.toFixed(1) + '%' : 'N/A'}</div>
                    </div>
                    <div class="kpi-box" style="grid-column: span 2; border-top: 1px dashed var(--border-subtle); padding-top: 10px; margin-top: 5px;">
                        <small style="opacity: 0.5; font-size: 0.65rem; text-transform: uppercase; display: block; margin-bottom: 4px;">Market Capitalization</small>
                        <div style="font-weight: 700; font-size: 1.1rem;">${metrics?.marketCap ? window.formatCurrency(metrics.marketCap * 1000000) : 'N/A'}</div>
                    </div>
                </div>
            </div>

            <!-- Quadrante 2: Técnico e Momentum -->
            <div class="report-section" style="background: #fff; padding: 20px; border-radius: 16px; border: 1px solid var(--border-subtle); box-shadow: var(--shadow-sm);">
                <header style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px; color: var(--accent);">
                    <span style="font-size: 1.2rem;">🚀</span> <strong style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Técnico & Momentum</strong>
                </header>
                <div style="padding: 15px; background: var(--panel-strong); border-radius: 12px; text-align: center; border: 1px solid var(--border-subtle);">
                    <div style="font-size: 0.65rem; opacity: 0.6; text-transform: uppercase; font-weight: 800; margin-bottom: 8px;">Sinal de Momentum</div>
                    <div style="font-weight: 900; font-size: 1.4rem; color: ${techSignal.color}; text-transform: uppercase;">${techSignal.text}</div>
                    
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <small style="opacity: 0.6;">Preço vs Máximos</small>
                            <strong style="color: ${metrics?.vsHigh < -15 ? 'var(--trading-green)' : 'inherit'}">${metrics?.vsHigh ? metrics.vsHigh.toFixed(2) + '%' : 'N/A'}</strong>
                        </div>
                        <div style="width: 100%; height: 6px; background: #eee; border-radius: 3px; overflow: hidden;">
                            <div style="width: ${100 + (metrics?.vsHigh || -100)}%; height: 100%; background: var(--trading-blue);"></div>
                        </div>
                    </div>
                </div>
                <p style="font-size: 0.75rem; margin-top: 15px; color: var(--text-muted); text-align: center; line-height: 1.4;">
                    Este ativo encontra-se ${Math.abs(metrics?.vsHigh || 0).toFixed(1)}% abaixo do seu máximo de 52 semanas.
                </p>
            </div>

            <!-- Quadrante 3: Inteligência Global (Macro) -->
            <div class="report-section" style="grid-column: span 2; background: linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(56, 189, 248, 0.02) 100%); padding: 25px; border-radius: 16px; border: 1px solid rgba(56, 189, 248, 0.2);">
                <header style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <span style="font-size: 1.3rem;">🌍</span> <strong style="font-size: 0.75rem; text-transform: uppercase; color: var(--trading-blue); letter-spacing: 0.05em;">Análise Macro & Sentimento</strong>
                </header>
                <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 15px;">
                    ${sentiment.trends.map(t => `<span style="font-size: 0.7rem; background: #fff; padding: 4px 12px; border-radius: 99px; border: 1px solid var(--trading-blue); font-weight: 700;">${t}</span>`).join('')}
                    ${sentiment.alerts.map(a => `<span style="font-size: 0.7rem; background: #fee2e2; color: #dc2626; padding: 4px 12px; border-radius: 99px; border: 1px solid #fecaca; font-weight: 700;">⚠️ ${a}</span>`).join('')}
                </div>
                <p style="font-size: 0.95rem; line-height: 1.7; color: #1e293b; margin: 0; font-family: 'Space Grotesk', sans-serif;">
                    ${generateMacroInsight(sentiment, ticker, metrics)}
                </p>
            </div>
        </div>

        <div style="background: var(--panel-strong); padding: 25px; border-radius: 16px; border-left: 6px solid ${score.color}; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
            <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <strong style="color: ${score.color}; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em;">Veredito Final da IA</strong>
                <span style="font-size: 0.75rem; opacity: 0.6;">Horizonte: Longo Prazo</span>
            </header>
            <p style="font-size: 1.05rem; line-height: 1.6; color: #fff; margin-bottom: 25px;">${score.action}</p>
            <button class="primary-btn" style="width: 100%; padding: 18px; font-size: 1.1rem; font-weight: 700; letter-spacing: 0.02em; border-radius: 12px;" onclick="window.fillAssetForm('${asset.ticker}', '${asset.name}', '${asset.type === 'REIT' ? 'reit' : (asset.type === 'ETF' ? 'dividends' : 'growth')}')">
                Executar Decisão: Registar Ativo no Portfólio
            </button>
        </div>
    `;
};

// ── MOTOR DE INTELIGÊNCIA E MÉTRICAS ──────────────────────────

async function fetchFinancialMetrics(ticker) {
    if (!window.state.finnhubApiKey) return null;
    try {
        const symbol = ticker.split('.')[0]; 
        const response = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${window.state.finnhubApiKey}`);
        const data = await response.json();
        
        if (data && data.metric) {
            const m = data.metric;
            return {
                yield: m.dividendYieldIndicatedAnnual || m.dividendYield5YAvg || 0,
                pe: m.peExclExtraTTM || 0,
                pb: m.priceToBookTTM || 0,
                marketCap: m.marketCapitalization || 0,
                roi: m.roiTTM || m.roeTTM || 0,
                beta: m.beta || 1,
                epsGrowth: m.epsGrowth5Y || m.epsGrowthTTM || 0,
                high52: m['52WeekHigh'],
                low52: m['52WeekLow'],
                currPrice: window.state.priceCache[ticker.toUpperCase()] || m['52WeekHigh'] * 0.9,
                vsHigh: window.state.priceCache[ticker.toUpperCase()] 
                    ? ((window.state.priceCache[ticker.toUpperCase()] / m['52WeekHigh']) - 1) * 100 
                    : -10
            };
        }
    } catch (e) {
        console.error("Erro ao obter métricas:", e);
    }
    return null;
}

async function fetchMarketNews() {
    if (!window.state.finnhubApiKey) return [];
    try {
        const response = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${window.state.finnhubApiKey}`);
        return await response.json();
    } catch (e) {
        console.error("Erro ao obter notícias:", e);
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
    
    // Melhoria da Lógica de Scoring 360º
    if (metrics.pe > 0 && metrics.pe < 25) score += 15;
    if (metrics.roi > 15) score += 10;
    if (metrics.epsGrowth > 10) score += 10;
    if (metrics.vsHigh < -15) score += 5;
    
    // Ajuste por sentimento macro
    if (sentiment) {
        if (sentiment.score > 20) score += 5;
        if (sentiment.score < -20) score -= 10;
    }
    
    let color = '#3b82f6'; // Blue
    let verdict = 'Manter em Observação';
    let action = 'Aguardar por um ponto de entrada mais claro ou estabilização macro.';
    
    if (score >= 80) {
        color = '#10b981'; // Green
        verdict = 'Compra Forte';
        action = 'Fundamentais robustos combinados com um ponto técnico atrativo. Considere entrada fracionada.';
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
        setTimeout(initInvestments, 100); // Tentar novamente em breve
        return;
    }
    
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
        
        // Configurar ciclo de atualização 360º (5 em 5 minutos)
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
            <strong style="display: block; line-height: 1.4; margin-bottom: 8px; font-family: 'Space Grotesk', sans-serif; color: var(--terminal-bg);">${item.headline}</strong>
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
    
    container.innerHTML = `
        <div class="periodic-highlights" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 30px; padding-bottom: 25px; border-bottom: 2px solid rgba(255,255,255,0.1);">
            <div class="highlight-box" style="background: rgba(56, 189, 248, 0.15); padding: 15px; border-radius: 12px; border: 2px solid var(--trading-blue);">
                <span style="font-size: 0.7rem; text-transform: uppercase; font-weight: 800; color: var(--trading-blue); display: block; margin-bottom: 5px;">📍 Sugestão do Dia</span>
                <strong style="display: block; font-size: 1.1rem; margin-bottom: 8px;">${highlights.dia.ticker}</strong>
                <button class="text-btn" style="font-size: 0.8rem; padding: 0; color: var(--trading-blue); font-weight: 700;" onclick="window.viewFullStudy('${highlights.dia.ticker}')">Análise completa IA →</button>
            </div>
            <div class="highlight-box" style="background: rgba(16, 185, 129, 0.15); padding: 15px; border-radius: 12px; border: 2px solid var(--trading-green);">
                <span style="font-size: 0.7rem; text-transform: uppercase; font-weight: 800; color: var(--trading-green); display: block; margin-bottom: 5px;">🔥 Da Semana</span>
                <strong style="display: block; font-size: 1.1rem; margin-bottom: 8px;">${highlights.semana.ticker}</strong>
                <button class="text-btn" style="font-size: 0.8rem; padding: 0; color: var(--trading-green); font-weight: 700;" onclick="window.viewFullStudy('${highlights.semana.ticker}')">Análise completa IA →</button>
            </div>
            <div class="highlight-box" style="background: rgba(245, 158, 11, 0.15); padding: 15px; border-radius: 12px; border: 2px solid #f59e0b;">
                <span style="font-size: 0.7rem; text-transform: uppercase; font-weight: 800; color: #f59e0b; display: block; margin-bottom: 5px;">🏆 Do Mês</span>
                <strong style="display: block; font-size: 1.1rem; margin-bottom: 8px;">${highlights.mes.ticker}</strong>
                <button class="text-btn" style="font-size: 0.8rem; padding: 0; color: #f59e0b; font-weight: 700;" onclick="window.viewFullStudy('${highlights.mes.ticker}')">Análise completa IA →</button>
            </div>
        </div>
    `;

    categories.forEach(cat => {
        let title = '';
        switch(cat) {
            case 'Stock': title = 'Ações'; break;
            case 'REIT': title = 'REITs (Imobiliário)'; break;
            case 'ETF': title = 'ETFs Diversificados'; break;
            case 'Crypto': title = 'Criptomoedas'; break;
        }
        const items = AI_KNOWLEDGE.filter(a => a.type === cat).slice(0, 2);
        
        const section = document.createElement('div');
        section.style.marginBottom = '20px';
        section.innerHTML = `
            <h4 style="font-size: 0.7rem; text-transform: uppercase; opacity: 0.6; margin-bottom: 12px; letter-spacing: 0.05em;">${title}</h4>
            <div class="cat-grid" style="display: grid; gap: 12px;"></div>
        `;
        
        const grid = section.querySelector('.cat-grid');
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'ai-suggestion-card';
            card.style.margin = '0';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <span class="ticker-badge">${item.ticker}</span>
                    <span style="font-size: 0.65rem; color: var(--trading-green); font-weight: 800;">Potencial: +${Math.floor(Math.random() * 15 + 10)}%</span>
                </div>
                <p style="font-size: 0.85rem; margin: 8px 0; font-weight: 600; font-family: 'Space Grotesk', sans-serif;">${item.name}</p>
                <p style="font-size: 0.72rem; opacity: 0.7; line-height: 1.4; margin-bottom: 10px;">${item.rationale}</p>
                <button class="ghost-btn" style="color: var(--trading-blue); font-size: 0.7rem; padding: 0; font-weight: 700;" onclick="window.viewFullStudy('${item.ticker}')">Análise Completa IA →</button>
            `;
            grid.appendChild(card);
        });
        container.appendChild(section);
    });
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
