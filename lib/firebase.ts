import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { JournalEntry, InteractionRecord, UserProfile, UserRole, SystemAuditLog, WeeklyDigestConfig } from './types';

// Admin access must be provisioned through Firestore/custom claims, never a public client variable.
export const BOOTSTRAP_ADMIN_EMAIL: string = '';

// Effective Firebase client configuration supporting environment variable overrides for custom domains
const effectiveFirebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseConfig.appId,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  firestoreDatabaseId: process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
};

// Initialize Firebase safely
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(effectiveFirebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Configure Firestore with databaseId if defined in config
export const db: Firestore = effectiveFirebaseConfig.firestoreDatabaseId
  ? getFirestore(app, effectiveFirebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

/**
 * Strict Undefined Stripping utility for zero-crash database payload hygiene.
 * Firestore will reject documents containing `undefined` values.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date) && !(data instanceof Timestamp)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value !== undefined) {
        sanitized[key] = sanitizeForFirestore(value);
      }
    }
    return sanitized as T;
  }
  return data;
}

/**
 * Sign in with Google Popup and establish User Profile & Role in Firestore
 */
export async function signInWithGoogle(): Promise<{ user: User; profile: UserProfile }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Determine admin role bootstrapping
    const isBootstrapAdmin = !!(BOOTSTRAP_ADMIN_EMAIL && user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase());

    // Sync user profile to Firestore
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    const nowIso = new Date().toISOString();
    let profile: UserProfile;

    if (!userSnap.exists()) {
      profile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Anonymous Explorer',
        photoURL: user.photoURL,
        role: isBootstrapAdmin ? 'admin' : 'user',
        createdAt: nowIso,
        lastLoginAt: nowIso,
        totalEntries: 0,
      };
      await setDoc(userRef, sanitizeForFirestore(profile));
      await createAuditLog({
        actorId: user.uid,
        actorEmail: user.email || 'unknown',
        action: 'USER_REGISTERED',
        details: `New account registered with role: ${profile.role}`,
        category: 'auth',
      });
    } else {
      const existingData = userSnap.data() as UserProfile;
      const effectiveRole: UserRole = isBootstrapAdmin ? 'admin' : (existingData.role || 'user');
      profile = {
        ...existingData,
        displayName: user.displayName || existingData.displayName || 'Anonymous Explorer',
        photoURL: user.photoURL || existingData.photoURL,
        role: effectiveRole,
        lastLoginAt: nowIso,
      };
      await setDoc(userRef, sanitizeForFirestore(profile), { merge: true });
      await createAuditLog({
        actorId: user.uid,
        actorEmail: user.email || 'unknown',
        action: 'USER_LOGIN',
        details: `Signed in as ${profile.role}`,
        category: 'auth',
      });
    }

    return { user, profile };
  } catch (error) {
    console.error('Firebase Auth Error:', error);
    throw error;
  }
}

/**
 * Fetch a User's Profile by UID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;
    const data = userSnap.data() as UserProfile;

    // Check bootstrap admin override if configured
    if (BOOTSTRAP_ADMIN_EMAIL && data.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      data.role = 'admin';
    }
    return data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Update user role (Admins only)
 */
export async function updateUserRole(adminUser: User, targetUid: string, newRole: UserRole): Promise<void> {
  const targetRef = doc(db, 'users', targetUid);
  await setDoc(targetRef, { role: newRole }, { merge: true });

  await createAuditLog({
    actorId: adminUser.uid,
    actorEmail: adminUser.email || 'admin',
    action: 'ROLE_UPDATED',
    details: `Updated role of user ${targetUid} to ${newRole}`,
    category: 'rbac',
  });
}

/**
 * Sign out helper
 */
export async function logOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Save or update a Journal Entry under /users/{userId}/entries/{entryId}
 */
export async function saveJournalEntry(userId: string, entry: JournalEntry): Promise<void> {
  if (!userId || !entry.id) {
    throw new Error('Missing userId or entryId for Firestore write');
  }
  const entryRef = doc(db, 'users', userId, 'entries', entry.id);
  const sanitized = sanitizeForFirestore({
    ...entry,
    userId,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(entryRef, sanitized, { merge: true });

  // Update updatedAt timestamp without full collection scans for maximum scalability
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { lastActiveAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    // Non-blocking telemetry
  }
}

/**
 * Save an isolated interaction log under /users/{userId}/interactions/{interactionId}
 */
export async function logInteraction(userId: string, interaction: InteractionRecord): Promise<void> {
  if (!userId || !interaction.id) {
    throw new Error('Missing userId or interactionId for Firestore write');
  }
  const interactionRef = doc(db, 'users', userId, 'interactions', interaction.id);
  const sanitized = sanitizeForFirestore({
    ...interaction,
    userId,
  });
  await setDoc(interactionRef, sanitized);
}

/**
 * Fetch a User's Weekly Digest Settings
 */
export async function getUserDigestSettings(userId: string): Promise<WeeklyDigestConfig> {
  const defaultSettings: WeeklyDigestConfig = {
    enabled: true,
    deliveryDay: 'sunday',
    channels: {
      email: true,
      discord: false,
      slack: false,
      appOnly: false,
    },
  };
  if (!userId) return defaultSettings;
  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'weekly_digest');
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      return { ...defaultSettings, ...(snap.data() as Partial<WeeklyDigestConfig>) };
    }
  } catch (err) {
    console.warn('Could not read user digest settings, returning default:', err);
  }
  return defaultSettings;
}

/**
 * Save a User's Weekly Digest Settings
 */
export async function saveUserDigestSettings(userId: string, settings: Partial<WeeklyDigestConfig>): Promise<void> {
  if (!userId) return;
  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'weekly_digest');
    await setDoc(settingsRef, sanitizeForFirestore(settings), { merge: true });
  } catch (err) {
    console.error('Error saving digest settings:', err);
    throw err;
  }
}


/**
 * Fetch all journal entries for a user ordered by updatedAt desc
 */
export async function getUserJournalEntries(userId: string): Promise<JournalEntry[]> {
  if (!userId) return [];
  try {
    const entriesRef = collection(db, 'users', userId, 'entries');
    const q = query(entriesRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);

    const entries: JournalEntry[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      entries.push({
        id: docSnap.id,
        userId: data.userId || userId,
        title: data.title || 'Untitled Reflection',
        category: data.category || 'General Reflection',
        mood: data.mood,
        priority: data.priority || 'normal',
        location: data.location,
        notificationStatus: data.notificationStatus,
        turns: data.turns || [],
        summary: data.summary,
        keyInsights: data.keyInsights,
        actionItems: data.actionItems,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        isArchived: !!data.isArchived,
      });
    });
    return entries;
  } catch (err) {
    console.error('Error fetching journal entries:', err);
    throw err;
  }
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) return;
  const entryRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(entryRef);
}

/**
 * Create an audit log record
 */
export async function createAuditLog(log: Omit<SystemAuditLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logRef = doc(db, 'audit_logs', id);
    const fullLog: SystemAuditLog = {
      id,
      timestamp: new Date().toISOString(),
      ...log,
    };
    await setDoc(logRef, sanitizeForFirestore(fullLog));
  } catch (e) {
    console.warn('Audit log write skipped:', e);
  }
}

/**
 * Fetch all system audit logs (Admin only)
 */
export async function getAuditLogs(maxCount = 50): Promise<SystemAuditLog[]> {
  try {
    const logsRef = collection(db, 'audit_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const logs: SystemAuditLog[] = [];
    snapshot.forEach((docSnap) => {
      logs.push(docSnap.data() as SystemAuditLog);
    });
    return logs.slice(0, maxCount);
  } catch (e) {
    console.error('Error fetching audit logs:', e);
    return [];
  }
}

/**
 * Fetch all users for Admin Dashboard
 */
export async function getAllUsersForAdmin(): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const users: UserProfile[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as UserProfile;
      if (data.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
        data.role = 'admin';
      }
      users.push(data);
    });
    return users;
  } catch (e) {
    console.error('Error fetching all users for admin:', e);
    return [];
  }
}
