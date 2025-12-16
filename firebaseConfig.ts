
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 您提供的 Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyCXEXVv1ndYULRxjR6ZOfy3t19RgLUvvfU",
  authDomain: "yoga-pwa-158e2.firebaseapp.com",
  projectId: "yoga-pwa-158e2",
  storageBucket: "yoga-pwa-158e2.firebasestorage.app",
  messagingSenderId: "411698774220",
  appId: "1:411698774220:web:4a7e9760e6a1d39504c269",
  measurementId: "G-2LSMZXCKTE"
};

// Initialize Firebase
// Use existing app if already initialized (prevents errors in strict mode or HMR)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence failed: Not supported');
    }
});
