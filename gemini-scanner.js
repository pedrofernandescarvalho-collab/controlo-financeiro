// ── GEMINI AI WEEKLY SCANNER ─────────────────────────────────────────────────
// Separado para evitar conflitos de encoding. Carregado após pro360.js

const OPPORTUNITIES_CACHE_KEY = 'gemini_weekly_scan';
const OPPORTUNITIES_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias

// Função auxiliar para ler chave Gemini de qualquer fonte disponível
function getGeminiKey() {
    // 1. Tentar window.state primeiro
    if (window.state && window.state.geminiApiKey && window.state.geminiApiKey.length > 10) {
        return window.state.geminiApiKey;
    }
    // 2. Fallback directo ao localStorage (bypassa problemas de sync do state)
    try {
        var stored = localStorage.getItem('finance-control-app');
        if (stored) {
            var parsed = JSON.parse(stored);
            if (parsed.geminiApiKey && parsed.geminiApiKey.length > 10) {
                // Sincronizar com window.state se possível
                if (window.state) window.state.geminiApiKey = parsed.geminiApiKey;
                return parsed.geminiApiKey;
            }
        }
    } catch(e) {}
    return null;
}

async function generateAiOpportunities() {
    var container = document.getElementById('aiDiscoveryList');
    if (!container) {
        console.warn('[Gemini Scanner] aiDiscoveryList não encontrado - a tentar em 500ms');
        setTimeout(function() { generateAiOpportunities(); }, 500);
        return;
    }

    console.log('[Gemini Scanner] A iniciar scanner...');

    // 1. Verificar cache semanal
    try {
        var cached = JSON.parse(localStorage.getItem(OPPORTUNITIES_CACHE_KEY) || 'null');
        if (cached && (Date.now() - cached.timestamp) < OPPORTUNITIES_TTL) {
            console.log('[Gemini Scanner] Usando cache semanal');
            renderOpportunityCards(container, cached.data, false);
            return;
        }
    } catch(e) {}

    // 2. Verificar chave Gemini (lê de window.state OU localStorage directamente)
    var geminiKey = getGeminiKey();
    console.log('[Gemini Scanner] Chave encontrada?', !!geminiKey, '| length:', geminiKey ? geminiKey.length : 0);
    if (!geminiKey) {
        container.innerHTML = buildNoKeyMessage();
        return;
    }

    // 3. Loading state
    container.innerHTML = buildLoadingState();
    console.log('[Gemini Scanner] A chamar Gemini API...');

    // 4. Contexto do utilizador
    var targets   = (window.state && window.state.investmentTargets) || { dividends: 40, growth: 40, crypto: 10, reit: 10 };
    var portfolio = (window.state && window.state.investments) || [];
    var today     = new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    var scanDate  = new Date().toISOString().slice(0, 10);
    var existingList = portfolio.length > 0
        ? portfolio.map(function(i) { return i.ticker + ' (' + i.category + ')'; }).join(', ')
        : 'Nenhum ativo ainda';

    const prompt = 'Es um analista financeiro senior especializado em ETFs globais, acoes de dividendos, REITs e crescimento a longo prazo.\n\n'
        + 'DATA: ' + today + '\n\n'
        + 'PERFIL DO INVESTIDOR:\n'
        + '- Dividendos/Renda: ' + targets.dividends + '%\n'
        + '- Crescimento: ' + targets.growth + '%\n'
        + '- Cripto: ' + targets.crypto + '%\n'
        + '- REITs: ' + targets.reit + '%\n'
        + '- Foco: Crescimento longo prazo + rendimento passivo\n'
        + '- Horizonte: 5+ anos, risco moderado a agressivo\n\n'
        + 'CARTEIRA ACTUAL (NAO repetir estes ativos): ' + existingList + '\n\n'
        + 'TAREFA: Analisa o contexto macro actual e recomenda exatamente 8 ativos diversificados para este perfil.\n'
        + 'Inclui ETFs globais (VWCE, IWDA, VUAA, etc), acoes de dividendos solidos, REITs e 1-2 ativos de crescimento.\n\n'
        + 'Responde APENAS com JSON valido sem markdown:\n'
        + '{"scan_date":"' + scanDate + '","market_context":"resumo macro em 2 frases","macro_risks":"riscos principais","recommendations":['
        + '{"ticker":"TICKER","name":"Nome","type":"ETF|Stock|REIT|Crypto","exchange":"LSE|NYSE|NASDAQ|Euronext|Xetra",'
        + '"focus":"Crescimento|Dividendos|Crescimento+Dividendos|REIT|Cripto","rationale":"razao em 2-3 frases",'
        + '"opportunity":"janela de oportunidade especifica","risk":"risco principal","suggested_weight":12,'
        + '"confidence":82,"priority":"Alta|Media|Baixa","dividend_yield":"3.2%|N/A"}]}';

    // 5. Chamar Gemini (com retry automático em caso de quota excedida)
    var MODELS = [
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash-8b'
    ];

    async function tryModel(modelName, retryCount) {
        retryCount = retryCount || 0;
        var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + geminiKey;
        console.log('[Gemini Scanner] A tentar modelo:', modelName, '(tentativa ' + (retryCount + 1) + ')');

        var res = await fetch(url, {
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
        });

        if (res.status === 429) {
            // Quota excedida — tentar próximo modelo
            console.warn('[Gemini Scanner] Quota excedida em', modelName, '- a tentar próximo modelo...');
            return null; // sinaliza para tentar o próximo
        }

        if (!res.ok) {
            var errData = await res.json().catch(function() { return {}; });
            throw new Error('Gemini API ' + res.status + ': ' + (errData.error && errData.error.message || 'erro desconhecido'));
        }

        return await res.json();
    }

    try {
        var apiResp = null;
        var usedModel = null;

        for (var mi = 0; mi < MODELS.length; mi++) {
            apiResp = await tryModel(MODELS[mi]);
            if (apiResp !== null) {
                usedModel = MODELS[mi];
                break;
            }
        }

        if (!apiResp) {
            // Todos os modelos com quota excedida — mostrar mensagem amigável com retry automático
            container.innerHTML = buildQuotaState();
            setTimeout(function() {
                console.log('[Gemini Scanner] A tentar novamente após 30 segundos...');
                localStorage.removeItem(OPPORTUNITIES_CACHE_KEY);
                generateAiOpportunities();
            }, 30000);
            return;
        }

        console.log('[Gemini Scanner] Resposta recebida via', usedModel, ':', JSON.stringify(apiResp).substring(0, 200));
        var rawText = apiResp && apiResp.candidates && apiResp.candidates[0] &&
                        apiResp.candidates[0].content && apiResp.candidates[0].content.parts &&
                        apiResp.candidates[0].content.parts[0] && apiResp.candidates[0].content.parts[0].text;

        if (!rawText) throw new Error('Resposta vazia do Gemini');

        var parsed = JSON.parse(rawText);
        if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
            throw new Error('Formato invalido');
        }

        console.log('[Gemini Scanner] Sucesso!', parsed.recommendations.length, 'ativos recomendados');
        localStorage.setItem(OPPORTUNITIES_CACHE_KEY, JSON.stringify({ data: parsed, timestamp: Date.now() }));
        renderOpportunityCards(container, parsed, true);

    } catch(err) {
        console.error('[Gemini Scanner]', err);
        container.innerHTML = buildErrorState(err.message);
    }
}

// ── HELPERS DE RENDERING ───────────────────────────────────────────────────────

function buildNoKeyMessage() {
    return '<div style="background:linear-gradient(135deg,rgba(13,148,136,0.05),rgba(124,58,237,0.05));border:2px dashed var(--primary);border-radius:16px;padding:40px;text-align:center;max-width:560px;margin:0 auto;">'
        + '<div style="font-size:3rem;margin-bottom:16px;">🤖</div>'
        + '<h3 style="margin:0 0 10px;">Gemini AI — Activar Scanner Semanal</h3>'
        + '<p style="color:var(--text-muted);font-size:0.9rem;line-height:1.6;margin:0 0 20px;">Com a tua chave Gemini, o sistema faz um <strong>varrimento semanal</strong> do mercado e recomenda os melhores ativos para o teu perfil.</p>'
        + '<a href="configuracao.html" class="primary-btn" style="display:inline-block;padding:12px 28px;font-size:0.9rem;text-decoration:none;">Configurar Gemini API Key →</a>'
        + '<p style="font-size:0.7rem;color:var(--text-muted);margin:12px 0 0;opacity:0.6;">Chave gratuita em aistudio.google.com/apikey</p>'
        + '</div>';
}

function buildLoadingState() {
    return '<div style="background:linear-gradient(135deg,rgba(13,148,136,0.06),rgba(124,58,237,0.04));border:1px solid var(--border-subtle);border-radius:16px;padding:48px;text-align:center;">'
        + '<div style="font-size:3rem;margin-bottom:16px;">🤖</div>'
        + '<h3 style="margin:0 0 10px;font-size:1.2rem;">Gemini AI a varrer o mercado...</h3>'
        + '<p style="color:var(--text-muted);font-size:0.85rem;max-width:400px;margin:0 auto 24px;line-height:1.6;">A analisar ativos globais com base no teu perfil — crescimento e rendimento passivo</p>'
        + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;font-size:0.72rem;color:var(--text-muted);">'
        + '<span>📊 ETFs</span><span>·</span><span>🏠 REITs</span><span>·</span><span>💰 Dividendos</span><span>·</span><span>📈 Crescimento</span>'
        + '</div></div>';
}

function buildErrorState(msg) {
    return '<div style="background:rgba(244,63,94,0.05);border:1px dashed #f43f5e;border-radius:16px;padding:32px;text-align:center;">'
        + '<div style="font-size:2rem;margin-bottom:12px;">⚠️</div>'
        + '<h3 style="color:#f43f5e;margin:0 0 10px;font-size:1rem;">Erro ao contactar Gemini AI</h3>'
        + '<p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 16px;">' + msg + '</p>'
        + '<p style="font-size:0.78rem;color:var(--text-muted);margin:0 0 20px;opacity:0.7;">Verifica a tua chave API em <a href="configuracao.html" style="color:var(--primary);">Configuração</a></p>'
        + '<button onclick="window.forceRefreshOpportunities()" style="background:var(--primary);color:white;border:none;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:700;font-size:0.85rem;">↻ Tentar Novamente</button>'
        + '</div>';
}

function buildQuotaState() {
    return '<div style="background:rgba(245,158,11,0.06);border:1px dashed #f59e0b;border-radius:16px;padding:32px;text-align:center;">'
        + '<div style="font-size:2.5rem;margin-bottom:12px;">⏳</div>'
        + '<h3 style="color:#f59e0b;margin:0 0 10px;font-size:1rem;">Quota temporária atingida</h3>'
        + '<p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 8px;">A tua chave Gemini está ativa mas atingiu o limite de pedidos por minuto.</p>'
        + '<p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 20px;opacity:0.8;">🔄 A tentar novamente automaticamente em <strong>30 segundos</strong>...</p>'
        + '<button onclick="window.forceRefreshOpportunities()" style="background:#f59e0b;color:white;border:none;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:700;font-size:0.85rem;">↻ Tentar Agora</button>'
        + '</div>';
}


function renderOpportunityCards(container, data, isLive) {
    var recs       = data.recommendations || [];
    var scanDate   = data.scan_date || new Date().toLocaleDateString('pt-PT');
    var marketCtx  = data.market_context || '';
    var macroRisks = data.macro_risks || '';

    var typeIcons = { ETF: '🌍', Stock: '📊', REIT: '🏠', Crypto: '🪙' };
    var focusColors = {
        'Crescimento': '#7c3aed',
        'Dividendos': '#0d9488',
        'Crescimento+Dividendos': '#10b981',
        'REIT': '#f59e0b',
        'Cripto': '#f43f5e'
    };
    var priorityConfig = {
        'Alta':  { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        'Media': { color: '#0d9488', bg: 'rgba(13,148,136,0.1)' },
        'Baixa': { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
    };

    // Calcular dias restantes de cache
    var daysLeft = 7;
    try {
        var cached = JSON.parse(localStorage.getItem(OPPORTUNITIES_CACHE_KEY) || 'null');
        if (cached) {
            daysLeft = Math.max(0, Math.ceil((OPPORTUNITIES_TTL - (Date.now() - cached.timestamp)) / 86400000));
        }
    } catch(e) {}

    // Limpar container
    container.innerHTML = '';

    // ── CABEÇALHO ────
    var header = document.createElement('div');
    header.style.cssText = 'background:linear-gradient(135deg,rgba(13,148,136,0.08),rgba(124,58,237,0.05));border:1px solid var(--border-subtle);border-radius:16px;padding:24px;margin-bottom:28px;';

    var badgeColor = isLive ? '#10b981' : '#64748b';
    var badgeBg    = isLive ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.12)';
    var badgeLabel = isLive ? '🤖 GEMINI AI — ANÁLISE NOVA' : '🤖 GEMINI AI — CACHE SEMANAL';

    header.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">'
        + '<div>'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
        + '<span style="font-size:0.65rem;background:' + badgeBg + ';color:' + badgeColor + ';padding:4px 12px;border-radius:99px;font-weight:800;text-transform:uppercase;">' + badgeLabel + '</span>'
        + '<span style="font-size:0.65rem;color:var(--text-muted);font-weight:600;">' + daysLeft + (daysLeft !== 1 ? ' dias' : ' dia') + ' até renovação</span>'
        + '</div>'
        + '<h3 style="margin:0 0 6px;font-family:\'Space Grotesk\',sans-serif;font-size:1.15rem;">Radar Semanal de Oportunidades</h3>'
        + '<p style="margin:0;font-size:0.75rem;color:var(--text-muted);">Análise de ' + scanDate + ' · ' + recs.length + ' ativos recomendados · Não é aconselhamento financeiro</p>'
        + '</div>'
        + '<button onclick="window.forceRefreshOpportunities()" style="flex-shrink:0;background:transparent;border:1px solid var(--border-subtle);padding:8px 16px;border-radius:10px;cursor:pointer;font-size:0.78rem;color:var(--text-muted);font-weight:600;">↻ Nova Análise</button>'
        + '</div>';

    if (marketCtx) {
        header.innerHTML += '<div style="margin-top:16px;padding:14px;background:rgba(255,255,255,0.6);border-radius:10px;border-left:3px solid var(--primary);">'
            + '<p style="margin:0 0 4px;font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--primary);">🌍 Contexto de Mercado</p>'
            + '<p style="margin:0;font-size:0.85rem;color:var(--text-main);line-height:1.55;">' + marketCtx + '</p>'
            + '</div>';
    }
    if (macroRisks) {
        header.innerHTML += '<div style="margin-top:10px;padding:12px;background:rgba(244,63,94,0.05);border-radius:10px;border-left:3px solid #f43f5e;">'
            + '<p style="margin:0 0 4px;font-size:0.7rem;font-weight:700;text-transform:uppercase;color:#f43f5e;">⚠ Riscos Macro</p>'
            + '<p style="margin:0;font-size:0.82rem;color:var(--text-muted);line-height:1.5;">' + macroRisks + '</p>'
            + '</div>';
    }

    container.appendChild(header);

    // ── GRID DE CARDS ────
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;';

    recs.forEach(function(rec) {
        var icon     = typeIcons[rec.type]    || '📈';
        var fColor   = focusColors[rec.focus] || '#0d9488';
        var priCfg   = priorityConfig[rec.priority] || priorityConfig['Media'];
        var confClr  = rec.confidence >= 80 ? '#10b981' : rec.confidence >= 65 ? '#0d9488' : '#94a3b8';
        var hasYield = rec.dividend_yield && rec.dividend_yield !== 'N/A';

        var cat = rec.type === 'REIT' ? 'reit' : rec.type === 'ETF' ? 'dividends' : rec.type === 'Crypto' ? 'crypto' : 'growth';

        var card = document.createElement('article');
        card.style.cssText = 'background:#fff;border-radius:16px;border:1px solid var(--border-subtle);overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;display:flex;flex-direction:column;';
        card.onmouseover = function() { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)'; };
        card.onmouseout  = function() { card.style.transform = 'none'; card.style.boxShadow = ''; };

        // Header do card
        var cardHeader = document.createElement('div');
        cardHeader.style.cssText = 'background:linear-gradient(135deg,' + fColor + '12,' + fColor + '04);padding:18px;border-bottom:1px solid var(--border-subtle);';
        cardHeader.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">'
            + '<div style="display:flex;align-items:center;gap:10px;">'
            + '<span style="font-size:1.6rem;line-height:1;">' + icon + '</span>'
            + '<div>'
            + '<span style="font-family:\'Space Grotesk\',sans-serif;font-weight:800;font-size:1.15rem;color:var(--text-main);">' + rec.ticker + '</span>'
            + (rec.exchange ? '<span style="display:block;font-size:0.65rem;color:var(--text-muted);margin-top:2px;">' + rec.exchange + '</span>' : '')
            + '</div></div>'
            + '<div style="text-align:right;">'
            + '<div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">Confiança IA</div>'
            + '<strong style="font-size:1rem;color:' + confClr + ';">' + rec.confidence + '%</strong>'
            + '</div></div>'
            + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
            + '<span style="font-size:0.65rem;background:' + fColor + '18;color:' + fColor + ';padding:3px 10px;border-radius:99px;font-weight:700;text-transform:uppercase;">' + rec.focus + '</span>'
            + '<span style="font-size:0.65rem;background:' + priCfg.bg + ';color:' + priCfg.color + ';padding:3px 10px;border-radius:99px;font-weight:700;text-transform:uppercase;">Prioridade ' + rec.priority + '</span>'
            + (hasYield ? '<span style="font-size:0.65rem;background:rgba(16,185,129,0.1);color:#10b981;padding:3px 10px;border-radius:99px;font-weight:700;">Yield ' + rec.dividend_yield + '</span>' : '')
            + '</div>';

        // Body do card
        var cardBody = document.createElement('div');
        cardBody.style.cssText = 'padding:18px;flex:1;display:flex;flex-direction:column;gap:10px;';
        cardBody.innerHTML = '<p style="margin:0;font-size:0.95rem;font-weight:700;color:var(--text-main);">' + rec.name + '</p>'
            + '<p style="margin:0;font-size:0.82rem;color:var(--text-muted);line-height:1.55;">' + rec.rationale + '</p>'
            + '<div style="background:rgba(16,185,129,0.07);border-radius:10px;padding:12px;border-left:3px solid #10b981;">'
            + '<p style="margin:0 0 4px;font-size:0.68rem;font-weight:700;text-transform:uppercase;color:#10b981;">⚡ Oportunidade</p>'
            + '<p style="margin:0;font-size:0.8rem;color:var(--text-main);">' + rec.opportunity + '</p>'
            + '</div>'
            + '<div style="background:rgba(244,63,94,0.05);border-radius:10px;padding:10px 12px;border-left:3px solid #f43f5e;">'
            + '<p style="margin:0 0 3px;font-size:0.68rem;font-weight:700;text-transform:uppercase;color:#f43f5e;">⚠ Risco</p>'
            + '<p style="margin:0;font-size:0.78rem;color:var(--text-muted);">' + rec.risk + '</p>'
            + '</div>'
            + (rec.suggested_weight ? '<p style="margin:0;font-size:0.75rem;color:var(--text-muted);">💡 Peso sugerido: <strong>' + rec.suggested_weight + '%</strong></p>' : '');

        // Botões
        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;margin-top:auto;padding-top:6px;';

        var btnStudy = document.createElement('button');
        btnStudy.className = 'primary-btn';
        btnStudy.style.cssText = 'flex:1;padding:11px;font-size:0.8rem;border-radius:10px;';
        btnStudy.textContent = 'Estudo 360º →';
        btnStudy.onclick = function() { window.viewFullStudy(rec.ticker); };

        var btnAdd = document.createElement('button');
        btnAdd.style.cssText = 'padding:11px 14px;font-size:0.8rem;border-radius:10px;background:transparent;border:1px solid var(--border-subtle);cursor:pointer;color:var(--text-muted);font-weight:600;';
        btnAdd.textContent = '+ Registar';
        btnAdd.onmouseover = function() { btnAdd.style.borderColor = 'var(--primary)'; };
        btnAdd.onmouseout  = function() { btnAdd.style.borderColor = 'var(--border-subtle)'; };
        btnAdd.onclick = function() { window.fillAssetForm(rec.ticker, rec.name, cat); };

        btnRow.appendChild(btnStudy);
        btnRow.appendChild(btnAdd);
        cardBody.appendChild(btnRow);

        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        grid.appendChild(card);
    });

    container.appendChild(grid);

    // Rodapé
    var footer = document.createElement('p');
    footer.style.cssText = 'text-align:center;font-size:0.68rem;color:var(--text-muted);margin-top:24px;opacity:0.7;';
    footer.textContent = '🤖 Análise gerada por Gemini AI · Renovação semanal automática · Não substitui aconselhamento financeiro profissional';
    container.appendChild(footer);
}

// ── EXPORTAÇÕES GLOBAIS ────────────────────────────────────────────────────────
window.generateAiOpportunities   = generateAiOpportunities;
window.forceRefreshOpportunities = function() {
    localStorage.removeItem(OPPORTUNITIES_CACHE_KEY);
    generateAiOpportunities();
};
