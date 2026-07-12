import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { createDefaultPlayerState } from "./playerState";

function requireFirebase() {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error(
      "Firebase no está configurado. Define las variables VITE_FIREBASE_* (ver .env.example) " +
        "o los secrets del repo para habilitar login/registro."
    );
  }
  return { auth, db };
}

export async function registerUser(email: string, password: string, displayName: string) {
  const { auth, db } = requireFirebase();
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  // Crea el documento de estado inicial del jugador en Firestore
  await setDoc(doc(db, "players", credential.user.uid), {
    displayName,
    createdAt: serverTimestamp(),
    ...createDefaultPlayerState(),
  });

  return credential.user;
}

export async function loginUser(email: string, password: string) {
  const { auth } = requireFirebase();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logoutUser() {
  const { auth } = requireFirebase();
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  if (!isFirebaseConfigured || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function playerDocExists(uid: string) {
  const { db } = requireFirebase();
  const snap = await getDoc(doc(db, "players", uid));
  return snap.exists();
}
