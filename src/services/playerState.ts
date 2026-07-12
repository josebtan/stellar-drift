import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

export interface PlayerState {
  position: { x: number; y: number };
  resources: { iron: number; ice: number; rareMineral: number };
  lifeSupport: number;
  credits: number;
}

export function createDefaultPlayerState(): PlayerState {
  return {
    position: { x: 400, y: 0 },
    resources: { iron: 0, ice: 0, rareMineral: 0 },
    lifeSupport: 100,
    credits: 0,
  };
}

function requireDb() {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase no está configurado; no se puede leer/guardar el estado del jugador.");
  }
  return db;
}

export async function loadPlayerState(uid: string): Promise<PlayerState | null> {
  const db = requireDb();
  const snap = await getDoc(doc(db, "players", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    position: data.position ?? createDefaultPlayerState().position,
    resources: data.resources ?? createDefaultPlayerState().resources,
    lifeSupport: data.lifeSupport ?? 100,
    credits: data.credits ?? 0,
  };
}

/** Guarda progreso. Se recomienda llamar con throttle (ej. cada 10s) y al salir. */
export async function savePlayerState(uid: string, state: Partial<PlayerState>) {
  const db = requireDb();
  await updateDoc(doc(db, "players", uid), { ...state });
}

export async function ensurePlayerDoc(uid: string, displayName: string) {
  const db = requireDb();
  const ref = doc(db, "players", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { displayName, ...createDefaultPlayerState() });
  }
}
