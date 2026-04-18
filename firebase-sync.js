/**
 * Firebase Sync Engine - Controlo Financeiro
 * Arquitetura resiliente baseada em Firestore
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const FIREBASE_COLLECTION = "user_data";
const FIREBASE_DOC_ID = "main_state";

let db, auth, user;

const updateUIStatus = (status, color = "var(--text-main)", className = "") => {
    // 1. Atualizar Painel de Configurações (Se existir)
    const el = document.getElementById('firebaseStatus');
    const panelDot = document.querySelector('#firebaseStatusPanel .status-dot');
    if (el) {
        el.textContent = status;
        el.style.color = color;
    }
    if (panelDot) {
        panelDot.className = `status-dot ${className}`;
    }

    // 2. Atualizar Pílula Global Premium
    let container = document.getElementById('cloudStatusContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cloudStatusContainer';
        container.className = 'cloud-status-container';
        document.body.appendChild(container);
    }

    container.innerHTML = `
        <div class="cloud-pill" title="Estado da Sincronização Firebase">
            <div class="status-dot ${className}"></div>
            <span>Cloud: ${status}</span>
        </div>
    `;
};

async function initFirebase() {
  if (!window.firebaseConfig || window.firebaseConfig.apiKey === "COLA_AQUI") {
    console.warn("[Firebase] Configurações pendentes.");
    updateUIStatus("Configuração Pendente", "#f59e0b", "pending");
    return;
  }

  try {
    const app = initializeApp(window.firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Login Anónimo
    await signInAnonymously(auth);
    
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        user = u;
        console.log("[Firebase] Autenticado:", u.uid);
        updateUIStatus("Ligado e Seguro", "#10b981", "online");
        
        try {
            // Verificação Inicial: Se a nuvem estiver vazia, subir o local
            const docRef = doc(db, FIREBASE_COLLECTION, FIREBASE_DOC_ID);
            const snap = await getDoc(docRef);
            
            if (!snap.exists() && window.state) {
                console.log("[Firebase] Nuvem vazia. A realizar migração inicial...");
                await window.syncToFirebase(window.state);
            }
        } catch (e) {
            console.warn("[Firebase] Falha na leitura inicial (possível API desativa):", e.message);
            if (e.code === "permission-denied") {
                updateUIStatus("API Pendente", "#f59e0b", "pending");
            }
        }
        
        startRealtimeSync();
      }
    });

  } catch (error) {
    console.error("[Firebase] Erro:", error);
    updateUIStatus("Erro na Ligação", "#ef4444", "error");
    if (error.code === "auth/operation-not-allowed") {
        alert("⚠️ Firebase: Deves ativar o 'Anonymous Auth' na consola do Firebase (Autenticação > Sign-in Method).");
    }
  }
}

function startRealtimeSync() {
  const docRef = doc(db, FIREBASE_COLLECTION, FIREBASE_DOC_ID);
  
  onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const cloudData = snap.data();
      const lastLocalSync = localStorage.getItem('last_firebase_sync') || 0;
      
      if (cloudData.updatedAt > lastLocalSync) {
        console.log("[Firebase] Sincronização Cloud -> Local");
        localStorage.setItem('finance-control-app', JSON.stringify(cloudData.state));
        localStorage.setItem('last_firebase_sync', cloudData.updatedAt);
        
        // Se estivermos na dashboard ou noutra página, avisar o motor
        if (window.state) {
            window.state = cloudData.state;
            if (typeof render === 'function') render();
        }
        window.dispatchEvent(new CustomEvent('stateUpdated', { detail: cloudData.state }));
      }
    }
  }, (err) => {
    console.error("[Firebase] Erro no Snapshot:", err.message);
    if (err.code === "permission-denied") {
        updateUIStatus("API Pendente na Consola", "#f59e0b", "pending");
    }
  });
}

window.syncToFirebase = async function(state) {
  if (!db || !user) return;

  try {
    const timestamp = Date.now();
    const docRef = doc(db, FIREBASE_COLLECTION, FIREBASE_DOC_ID);
    
    await setDoc(docRef, {
      state: state,
      updatedAt: timestamp,
      userId: user.uid
    }, { merge: true });

    localStorage.setItem('last_firebase_sync', timestamp);
    console.log("[Firebase] Sincronização Local -> Cloud concluída.");
    
  } catch (error) {
    console.error("[Firebase] Erro ao gravar:", error);
  }
};

document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    
    const hookInterval = setInterval(() => {
        if (typeof window.saveState === 'function' && !window.saveState.__isFirebaseHooked) {
            const originalSave = window.saveState;
            window.saveState = function() {
                originalSave();
                if (window.syncToFirebase && window.state) {
                    window.syncToFirebase(window.state);
                }
            };
            window.saveState.__isFirebaseHooked = true;
            clearInterval(hookInterval);
        }
    }, 500);
});
