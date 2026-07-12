import { initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Las credenciales viven en variables de entorno (ver .env.example).
// Nunca commitear un .env real con claves de un proyecto de producción.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** true si hay al menos apiKey y projectId configurados (lo mínimo para inicializar) */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

// getAuth()/getFirestore() lanzan una excepción SINCRÓNICA si la config es
// inválida (ej. apiKey vacío). Como este módulo se evalúa apenas se importa
// main.ts, un throw acá tumba toda la app antes de pintar nada (pantalla
// negra). Por eso lo envolvemos: si Firebase no está configurado, auth/db
// quedan en null y el resto de la app debe chequear isFirebaseConfigured
// antes de usarlos.
export let auth: Auth | null = null;
export let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    const firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
  } catch (err) {
    console.error("Error inicializando Firebase:", err);
  }
} else {
  console.warn(
    "Firebase no está configurado (faltan variables VITE_FIREBASE_*). " +
      "El login/registro no funcionará hasta configurar .env o los secrets del repo."
  );
}

