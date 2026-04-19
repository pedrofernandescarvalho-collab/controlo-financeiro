
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCGW-F7LpKmwNjQD6DCiR5a_AU0geDZHbk",
  authDomain: "controlo-financeiro-657c2.firebaseapp.com",
  projectId: "controlo-financeiro-657c2",
  storageBucket: "controlo-financeiro-657c2.firebasestorage.app",
  messagingSenderId: "759473604114",
  appId: "1:759473604114:web:2cde3206ae6d7574bc3acb"
};

async function rescue() {
    console.log("=== INICIANDO RESGATE DE DADOS ===");
    try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const docRef = doc(db, "user_data", "main_state");
        
        console.log("A tentar ler documento 'main_state'...");
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const data = snap.data();
            console.log("✅ SUCESSO! DADOS ENCONTRADOS!");
            console.log("Última atualização:", new Date(data.updatedAt).toLocaleString());
            console.log("Número de despesas:", data.state.expenses ? data.state.expenses.length : 0);
            console.log("Número de snapshots:", data.state.snapshots ? data.state.snapshots.length : 0);
            
            // Mostrar os últimos 3 gastos para confirmar se são recentes
            if (data.state.expenses && data.state.expenses.length > 0) {
                console.log("Últimos gastos registados:", data.state.expenses.slice(-3));
            }
        } else {
            console.error("❌ ERRO: O documento na nuvem está vazio ou não existe.");
        }
    } catch (err) {
        console.error("❌ FALHA CRÍTICA NO ACESSO:", err.message);
        if (err.message.includes("permission-denied")) {
            console.warn("DICA: A API do Firestore parece desativada na consola Google Cloud.");
        }
    }
}

rescue();
