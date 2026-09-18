import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAc9fjZXQeVPoDNTc-GlIjCPRPpJk1dUBY",
  authDomain: "rana-pay.firebaseapp.com",
  projectId: "rana-pay",
  storageBucket: "rana-pay.firebasestorage.app",
  messagingSenderId: "43228062741",
  appId: "1:43228062741:web:a759beba20ad5b527e1a1c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);