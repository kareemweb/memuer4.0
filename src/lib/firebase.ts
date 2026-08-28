import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Helper to resolve environment variables in both Vite/React client and process.env environments
const getEnv = (key: string): string | undefined => {
  const meta = import.meta as any;
  if (typeof import.meta !== 'undefined' && meta && meta.env && meta.env[key]) {
    return meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
};

// Retrieve environment variables with secure fallback defaults for the AI Studio preview environment
const apiKey = getEnv('VITE_FIREBASE_API_KEY') || getEnv('FIREBASE_API_KEY') || "AIzaSyD872iKH9U4FgufVY1xlRuDBfX6V5spOQQ";
const authDomain = getEnv('VITE_FIREBASE_AUTH_DOMAIN') || getEnv('FIREBASE_AUTH_DOMAIN') || "gen-lang-client-0695111722.firebaseapp.com";
const projectId = getEnv('VITE_FIREBASE_PROJECT_ID') || getEnv('FIREBASE_PROJECT_ID') || "gen-lang-client-0695111722";
const storageBucket = getEnv('VITE_FIREBASE_STORAGE_BUCKET') || getEnv('FIREBASE_STORAGE_BUCKET') || "gen-lang-client-0695111722.firebasestorage.app";
const messagingSenderId = getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || getEnv('FIREBASE_MESSAGING_SENDER_ID') || "79719209657";
const appId = getEnv('VITE_FIREBASE_APP_ID') || getEnv('FIREBASE_APP_ID') || "1:79719209657:web:181b1fafb45d03a5b45968";

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId
};

const app = initializeApp(firebaseConfig);

// Flag to identify if we are using the internal AI Studio default database
export const isDefaultSandbox = projectId === "gen-lang-client-0695111722";

// Configure Firestore Database ID depending on the active environment
const activeDatabaseId = getEnv('VITE_FIREBASE_DATABASE_ID') || getEnv('FIREBASE_DATABASE_ID') || (isDefaultSandbox ? "ai-studio-97798100-d2b2-42da-8f47-d329ca461af4" : "(default)");

export const db = getFirestore(app, activeDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  WRITE = "WRITE",
  LIST = "LIST",
  GET = "GET"
}

export function handleFirestoreError(error: any, operation: OperationType, path: string) {
  const code = error?.code;
  const message = error?.message || String(error || '');

  if (code === 'resource-exhausted' || message.includes('Quota limit exceeded') || message.includes('Quota exceeded')) {
    console.warn(`[Firestore Quota] Operation: ${operation} on path: [${path}] paused due to environment quota limits.`);
    return error;
  }

  console.error(`Firebase Firestore Error [Operation: ${operation}] on Path [${path}]:`, error);
  return error;
}

export { app };
