/* Firebase initialization.
 * Web API keys are public by design — they identify the project, not authenticate it.
 * Security is enforced via Firestore rules (see firestore.rules) and authorized domains. */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAnalytics, isSupported as analyticsSupported } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-xrK4lZBQBy4c5LxcJRi0V7WfL2Xh4Vs",
  authDomain: "product-usage-37f1d.firebaseapp.com",
  projectId: "product-usage-37f1d",
  storageBucket: "product-usage-37f1d.firebasestorage.app",
  messagingSenderId: "327601737901",
  appId: "1:327601737901:web:85546275fcb285e63d3624",
  measurementId: "G-VNNQR1M3S1"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics is best-effort — fails silently if blocked (e.g. adblocker, some dev envs)
export let analytics = null;
analyticsSupported()
  .then(ok => { if (ok) { try { analytics = getAnalytics(app); } catch {} } })
  .catch(() => {});
