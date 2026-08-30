import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC3MZftClhjM23xShmKgYW5xWKV9AQR7po",
  authDomain: "forgeai-51cbb.firebaseapp.com",
  projectId: "forgeai-51cbb",
  storageBucket: "forgeai-51cbb.firebasestorage.app",
  messagingSenderId: "432419975754",
  appId: "1:432419975754:web:fd076240822dbf497decb3",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
