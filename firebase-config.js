// Configuração do Firebase
// Podes obter estes valores na consola do Firebase (Project Settings > Web App)
const firebaseConfig = {
  apiKey: "AIzaSyCGW-F7LpKmwNjQD6DCiR5a_AU0geDZHbk",
  authDomain: "controlo-financeiro-657c2.firebaseapp.com",
  projectId: "controlo-financeiro-657c2",
  storageBucket: "controlo-financeiro-657c2.firebasestorage.app",
  messagingSenderId: "759473604114",
  appId: "1:759473604114:web:2cde3206ae6d7574bc3acb",
  measurementId: "G-CY18SFBYG0"
};

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.firebaseConfig = firebaseConfig;
}
