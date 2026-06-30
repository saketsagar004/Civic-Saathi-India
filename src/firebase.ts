/// <reference types="vite/client" />
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

import config from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || config.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || config.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || config.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || config.appId || ''
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your-api-key' &&
  firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
  !firebaseConfig.apiKey.includes('YOUR_')
);

export const app: FirebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : {} as FirebaseApp;
export const auth: Auth = hasFirebaseConfig ? getAuth(app) : {} as Auth;
export const db: Firestore = hasFirebaseConfig ? getFirestore(app) : {} as Firestore;
export const storage: FirebaseStorage = hasFirebaseConfig ? getStorage(app) : {} as FirebaseStorage;

