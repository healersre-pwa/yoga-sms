import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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