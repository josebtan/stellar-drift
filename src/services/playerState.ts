import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

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

export async function loadPlayerState(uid: string): Promise<PlayerState | null> {
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
  await updateDoc(doc(db, "players", uid), { ...state });
}

export async function ensurePlayerDoc(uid: string, displayName: string) {
  const ref = doc(db, "players", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { displayName, ...createDefaultPlayerState() });
  }
}
