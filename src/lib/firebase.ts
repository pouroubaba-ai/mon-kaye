import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
  getDocsFromCache,
  getDocsFromServer,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  writeBatch,
} from 'firebase/firestore'

import type { Movement, Person } from '@/data/mockData'

// Projet Firebase « kaye-8e8ca ». Ces identifiants ne sont pas secrets : ce qui protège les données,
// ce sont les règles de sécurité (fichier firestore.rules) : chaque commerçant ne lit que son espace.
const firebaseConfig = {
  apiKey: 'AIzaSyCn7rQZHPubD8gAE9BxUzZXSDAx_bd9Xb8',
  authDomain: 'kaye-8e8ca.firebaseapp.com',
  projectId: 'kaye-8e8ca',
  storageBucket: 'kaye-8e8ca.firebasestorage.app',
  messagingSenderId: '857556638387',
  appId: '1:857556638387:web:a765660b9bee2599522ec6',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
auth.languageCode = 'fr'

// Les données restent sur le téléphone (marche sans internet) et partent en ligne dès que la connexion revient.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
})

// ——— Connexion ———
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches
async function withProvider(provider: GoogleAuthProvider | OAuthProvider) {
  // App installée sur le téléphone : la fenêtre surgissante marche mal, on passe par une redirection
  if (isStandalone()) return signInWithRedirect(auth, provider)
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/popup-blocked') return signInWithRedirect(auth, provider)
    throw e
  }
}
export const signInGoogle = () => withProvider(new GoogleAuthProvider())
export const signInApple = () => {
  const p = new OAuthProvider('apple.com')
  p.addScope('email')
  p.addScope('name')
  p.setCustomParameters({ locale: 'fr' })
  return withProvider(p)
}
export const signInEmail = (email: string, pwd: string) => signInWithEmailAndPassword(auth, email.trim(), pwd)
export const signUpEmail = (email: string, pwd: string) => createUserWithEmailAndPassword(auth, email.trim(), pwd)
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim())
export const logOut = () => signOut(auth)

// Messages d'erreur en mots simples
export function authError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(code))
    return 'E-mail ou mot de passe incorrect.'
  if (code === 'auth/email-already-in-use') return 'Cet e-mail a déjà un compte : connectez-vous.'
  if (code === 'auth/invalid-email') return "Cet e-mail n'est pas valide."
  if (code === 'auth/weak-password') return 'Mot de passe trop court (au moins 6 caractères).'
  if (code === 'auth/network-request-failed') return "Pas de connexion internet. Réessayez quand le réseau revient."
  if (code === 'auth/too-many-requests') return 'Trop d’essais. Attendez un moment puis réessayez.'
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found')
    return "Cette façon de se connecter n'est pas encore activée."
  if (code === 'auth/unauthorized-domain') return "Cette adresse n'est pas encore autorisée dans Firebase (Authentication › Paramètres › Domaines autorisés)."
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return ''
  return 'Une erreur est survenue. Réessayez.'
}

// ——— Données ———
// shops/{uid}                 la boutique : son nom
// shops/{uid}/persons/{id}    personnes et employés
// shops/{uid}/movements/{id}  toutes les opérations
// shops/{uid}/meta/months     état des mois (arrêté, annulé)
export type ShopDoc = { name: string; createdAt?: string }
export type CloudData = {
  shop: ShopDoc
  persons: Person[]
  movements: Movement[]
  monthStates: Record<string, 'arrete' | 'annule'>
}

// source « cache » : seulement ce qui est gardé sur le téléphone (instantané, sans réseau) ;
// « server » : seulement la version en ligne ; par défaut : en ligne si possible, sinon le téléphone.
export async function loadShop(uid: string, source: 'cache' | 'server' | 'default' = 'default'): Promise<CloudData | null> {
  const one = source === 'cache' ? getDocFromCache : source === 'server' ? getDocFromServer : getDoc
  const many = source === 'cache' ? getDocsFromCache : source === 'server' ? getDocsFromServer : getDocs
  let shopSnap
  try {
    shopSnap = await one(doc(db, 'shops', uid))
  } catch (e) {
    if (source === 'cache') return null // rien sur le téléphone
    throw e
  }
  if (!shopSnap.exists()) return null
  const monthsRef = doc(db, 'shops', uid, 'meta', 'months')
  const [ps, ms, months] = await Promise.all([
    many(collection(db, 'shops', uid, 'persons')),
    many(collection(db, 'shops', uid, 'movements')),
    one(monthsRef).catch(() => null),
  ])
  return {
    shop: shopSnap.data() as ShopDoc,
    persons: ps.docs.map(d => d.data() as Person),
    movements: ms.docs.map(d => d.data() as Movement),
    monthStates: (months?.data()?.states ?? {}) as CloudData['monthStates'],
  }
}

export async function createShop(uid: string, name: string) {
  await setDoc(doc(db, 'shops', uid), { name, createdAt: new Date().toISOString() })
}

// Enregistre seulement ce qui a changé depuis la dernière fois (par petits paquets, sans bloquer l'écran).
export function makePersister(uid: string, start: CloudData) {
  const key = (x: unknown) => JSON.stringify(x)
  const last = {
    shop: key(start.shop),
    months: key(start.monthStates),
    persons: new Map(start.persons.map(p => [p.id, key(p)])),
    movements: new Map(start.movements.map(m => [m.id, key(m)])),
  }
  let timer: number | undefined
  let pending: CloudData | null = null
  let touched = false // un changement a été fait sur ce téléphone depuis le chargement

  const flush = async () => {
    const snap = pending
    pending = null
    if (!snap) return
    type Op = { kind: 'set'; path: string[]; data: object } | { kind: 'delete'; path: string[] }
    const ops: Op[] = []
    if (key(snap.shop) !== last.shop) {
      ops.push({ kind: 'set', path: ['shops', uid], data: snap.shop })
      last.shop = key(snap.shop)
    }
    if (key(snap.monthStates) !== last.months) {
      ops.push({ kind: 'set', path: ['shops', uid, 'meta', 'months'], data: { states: snap.monthStates } })
      last.months = key(snap.monthStates)
    }
    for (const p of snap.persons) {
      const k = key(p)
      if (last.persons.get(p.id) !== k) {
        ops.push({ kind: 'set', path: ['shops', uid, 'persons', p.id], data: p })
        last.persons.set(p.id, k)
      }
    }
    for (const m of snap.movements) {
      const k = key(m)
      if (last.movements.get(m.id) !== k) {
        ops.push({ kind: 'set', path: ['shops', uid, 'movements', m.id], data: m })
        last.movements.set(m.id, k)
      }
    }
    // Ce qui a été supprimé dans l'app est effacé en ligne aussi
    const personIds = new Set(snap.persons.map(p => p.id))
    for (const id of [...last.persons.keys()])
      if (!personIds.has(id)) {
        ops.push({ kind: 'delete', path: ['shops', uid, 'persons', id] })
        last.persons.delete(id)
      }
    const movementIds = new Set(snap.movements.map(m => m.id))
    for (const id of [...last.movements.keys()])
      if (!movementIds.has(id)) {
        ops.push({ kind: 'delete', path: ['shops', uid, 'movements', id] })
        last.movements.delete(id)
      }
    if (ops.length > 0) touched = true
    // Firestore : 500 écritures au plus par paquet
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(db)
      for (const op of ops.slice(i, i + 450)) {
        const [first, ...rest] = op.path
        if (op.kind === 'delete') batch.delete(doc(db, first, ...rest))
        else batch.set(doc(db, first, ...rest), op.data)
      }
      batch.commit().catch(err => console.error('[Kayé] Enregistrement en ligne', err))
    }
  }

  // L'app se ferme ou passe en arrière-plan : on enregistre tout de suite
  const now = () => {
    window.clearTimeout(timer)
    void flush()
  }
  window.addEventListener('pagehide', now)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && now())

  const persist = (snap: CloudData) => {
    pending = snap
    window.clearTimeout(timer)
    timer = window.setTimeout(flush, 400)
  }
  persist.touched = () => touched || pending !== null
  return persist
}

export type { User }
