/**
 * Google Drive Sync Engine for Finance Control App
 * Handles OAuth2 and File Sync (Upload/Download)
 * Optimized for Premium Auto-Sync
 */

const GOOGLE_CONFIG = {
    CLIENT_ID: '669838785095-da1roi94v5hlr13sd2hi8jldhcp2h5rt.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
};

let tokenClient;
let gapiInited = false;
let gisInited = false;
let driveAccessToken = localStorage.getItem('google_drive_token') || null;
if (driveAccessToken === 'null' || driveAccessToken === 'undefined') driveAccessToken = null;

const _safeToast = (msg, type = 'info') => {
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        console.log("TOAST:", msg);
        alert(msg);
    }
};

function initializeGoogleDrive() {
    console.log("A iniciar Google Drive Engine...");
    const script1 = document.createElement('script');
    script1.src = "https://apis.google.com/js/api.js";
    script1.onload = gapiLoaded;
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = "https://accounts.google.com/gsi/client";
    script2.onload = gisLoaded;
    document.body.appendChild(script2);
}

function gapiLoaded() {
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                discoveryDocs: GOOGLE_CONFIG.DISCOVERY_DOCS,
            });
            gapiInited = true;
            if (driveAccessToken) {
                gapi.client.setToken({ access_token: driveAccessToken });
                autoCheckCloudDraft();
            }
            checkSyncStatus();
        } catch (e) {
            console.error("Erro ao inicializar GAPI:", e);
        }
    });
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.CLIENT_ID,
        scope: GOOGLE_CONFIG.SCOPES,
        callback: (response) => {
            if (response.error !== undefined) {
                console.error("Erro no login Google:", response);
                return;
            }
            driveAccessToken = response.access_token;
            gapi.client.setToken({ access_token: driveAccessToken });
            localStorage.setItem('google_drive_token', driveAccessToken);
            _safeToast("Ligado ao Google Drive!");
            checkSyncStatus();
            // Desativado: restauro silencioso no login causava perda de dados
            // if (window.restoreDataFromDrive) window.restoreDataFromDrive(true);
        },
    });
    gisInited = true;
    checkSyncStatus();
}

window.handleGoogleLogin = function() {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        _safeToast("Erro: Google GIS não inicializado.", "error");
    }
};

window.handleGoogleLogout = function() {
    driveAccessToken = null;
    localStorage.removeItem('google_drive_token');
    _safeToast("Google Drive desligado.");
    checkSyncStatus();
};

function checkSyncStatus() {
    const statusEl = document.getElementById('googleDriveStatus');
    const loginBtn = document.getElementById('googleLoginBtn');
    const logoutBtn = document.getElementById('googleLogoutBtn');
    const syncGroup = document.getElementById('syncButtonsGroup');
    const indicators = document.querySelectorAll('.cloud-sync-indicator');

    if (driveAccessToken) {
        if (statusEl) {
            const lastSync = localStorage.getItem('last_cloud_sync') || 'Nunca';
            statusEl.innerHTML = `Drive <strong style="color:var(--primary)">Ligado</strong><br><small style="opacity:0.7">Último backup: ${lastSync}</small>`;
        }
        if (loginBtn) loginBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "block";
        if (syncGroup) syncGroup.style.display = "flex";
        indicators.forEach(ind => { ind.style.color = "var(--primary)"; ind.title = "Sincronização Ativa"; });
    } else {
        if (statusEl) { statusEl.textContent = "Drive Desligado"; statusEl.style.color = "var(--text-muted)"; }
        if (loginBtn) loginBtn.style.display = "block";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (syncGroup) syncGroup.style.display = "none";
        indicators.forEach(ind => { ind.style.color = "var(--text-muted)"; ind.title = "Cloud Desligada"; });
    }
}

window.syncDataToDrive = async function(showFeedback = false) {
    if (!driveAccessToken || !gapiInited) {
        if (showFeedback) _safeToast("Google Drive não ligado ou a inicializar...", "error");
        return;
    }
    try {
        const localData = localStorage.getItem('finance-control-app');
        if (!localData) return;
        const response = await gapi.client.drive.files.list({
            q: "name = 'controlo_financeiro_v2.json' and trashed = false",
            fields: 'files(id, name, modifiedTime)',
            spaces: 'drive'
        });
        const files = response.result.files;
        const fileContent = localData;
        const fileId = files.length > 0 ? files[0].id : null;
        if (fileId) { await updateFileContent(fileId, fileContent); } else { await createNewFile(fileContent); }
        const now = new Date().toLocaleString('pt-PT');
        localStorage.setItem('last_cloud_sync', now);
        checkSyncStatus();
        if (showFeedback) _safeToast("Sincronização concluída com sucesso!");
    } catch (err) {
        console.error("Erro na sincronização:", err);
        const isAuthError = err.status === 401 || err.status === 403 || (err.result && err.result.error && (err.result.error.code === 401 || err.result.error.code === 403));
        if (isAuthError) {
            window.handleGoogleLogout();
            if (showFeedback) _safeToast("Sessão Google expirada. Ligue-se novamente.", "error");
        } else {
            if (showFeedback) _safeToast("Erro ao sincronizar: " + (err.message || JSON.stringify(err)), "error");
        }
    }
};

async function createNewFile(content) {
    const metadata = { name: 'controlo_financeiro_v2.json', mimeType: 'application/json' };
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    const multipartRequestBody = delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) + delimiter + 'Content-Type: application/json\r\n\r\n' + content + close_delim;
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + driveAccessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
        body: multipartRequestBody
    });
    if (!res.ok) throw new Error("Falha ao criar ficheiro: " + res.status);
}

async function updateFileContent(fileId, content) {
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + driveAccessToken, 'Content-Type': 'application/json' },
        body: content
    });
    if (!res.ok) { const errBody = await res.text(); throw new Error(`HTTP ${res.status}: ${errBody}`); }
}

window.restoreDataFromDrive = async function(silent = false) {
    if (!driveAccessToken || !gapiInited) return;
    if (!silent && !confirm("Isto irá substituir TODOS os dados locais pelos da Cloud. Continuar?")) return;
    try {
        const response = await gapi.client.drive.files.list({ q: "name = 'controlo_financeiro_v2.json' and trashed = false", fields: 'files(id, name)', spaces: 'drive' });
        const files = response.result.files;
        if (files.length === 0) { if (!silent) _safeToast("Ficheiro não encontrado no Drive.", "error"); return; }
        const fileId = files[0].id;
        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { 'Authorization': 'Bearer ' + driveAccessToken } });
        if (!fileRes.ok) throw new Error("Falha ao baixar ficheiro.");
        const driveData = await fileRes.json();
        if (driveData && typeof driveData === 'object') {
            localStorage.setItem('finance-control-app', JSON.stringify(driveData));
            const now = new Date().toLocaleString('pt-PT');
            localStorage.setItem('last_cloud_sync', now);
            if (!silent) { _safeToast("Dados restaurados! A recarregar..."); setTimeout(() => location.reload(), 1500); } else { location.reload(); }
        }
    } catch (err) {
        console.error("Erro no restauro:", err);
        const isAuthError = err.status === 401 || err.status === 403 || (err.result && err.result.error && (err.result.error.code === 401 || err.result.error.code === 403));
        if (isAuthError) window.handleGoogleLogout();
    }
};

async function autoCheckCloudDraft() {
    if (!driveAccessToken || !gapiInited) return;
    try {
        const response = await gapi.client.drive.files.list({ q: "name = 'controlo_financeiro_v2.json' and trashed = false", fields: 'files(id, name, modifiedTime)', spaces: 'drive' });
        const files = response.result.files;
        if (files.length > 0) {
            const cloudFile = files[0];
            const cloudDate = new Date(cloudFile.modifiedTime);
            const lastSyncStr = localStorage.getItem('last_cloud_sync_raw');
            const localDate = lastSyncStr ? new Date(lastSyncStr) : new Date(0);
            if (cloudDate > localDate && lastSyncStr) { if (confirm("Detetámos uma versão mais recente dos seus dados no Google Drive. Deseja restaurar agora?")) { await window.restoreDataFromDrive(true); } }
            localStorage.setItem('last_cloud_sync_raw', cloudFile.modifiedTime);
        }
    } catch (e) { console.warn("Verificação automática de cloud falhou:", e); }
}

// Inicialização e Ciclo de Vida
document.addEventListener('DOMContentLoaded', () => {
    initializeGoogleDrive();
    
    // Aplicar Hook de Auto-Sincronização ao motor central
    const applyHook = () => {
        if (typeof window.saveState === 'function' && !window.saveState.__isHooked) {
            const originalSaveState = window.saveState;
            window.saveState = function() {
                originalSaveState(); 
                if (localStorage.getItem('google_drive_token') && typeof window.syncDataToDrive === 'function') {
                    clearTimeout(window.syncDebounceTimer);
                    window.syncDebounceTimer = setTimeout(() => { window.syncDataToDrive(false); }, 3000);
                }
            };
            window.saveState.__isHooked = true;
            console.log("[DRIVE] Auto-Sync Hook activo.");
        }
    };

    // Desativado o Hook de Auto-Sincronização para evitar sobreposições acidentais durante a migração para Firebase
    // applyHook();
    // setTimeout(applyHook, 1000);
    // setTimeout(applyHook, 3000);
});

// Polling para ligar botões da barra de navegação que aparecem em múltiplas páginas
function attachNavSyncButton() {
    const navBtn = document.getElementById('syncNowBtnNav');
    if (navBtn && !navBtn._attached) {
        navBtn.onclick = async (e) => {
            e.preventDefault();
            if (typeof window.syncDataToDrive === 'function') { 
                await window.syncDataToDrive(true); 
            } else { 
                alert('Motor de sincronização a inicializar...'); 
            }
        };
        navBtn._attached = true;
    }
}
setInterval(attachNavSyncButton, 2000);
attachNavSyncButton();
