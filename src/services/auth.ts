import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { createDefaultPlayerState } from "./playerState";

export async function registerUser(email: string, password: string, displayName: string) {
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
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function playerDocExists(uid: string) {
  const snap = await getDoc(doc(db, "players", uid));
  return snap.exists();
}
