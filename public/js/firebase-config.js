import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBPGIvoZPg9ZklQKUI47IO8GM52rZ5wBsE",
    authDomain: "iot1-d1c2d.firebaseapp.com",
    databaseURL: "https://iot1-d1c2d-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "iot1-d1c2d",
    storageBucket: "iot1-d1c2d.firebasestorage.app",
    messagingSenderId: "750705682881",
    appId: "1:750705682881:web:872b851f1990e9c9f72740"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Export Firebase methods
export { db, ref, set, onValue };

// Export database references
export const lightRef = ref(db, "light/status");
export const motorARef = ref(db, "irrigation/motorA");
export const motorBRef = ref(db, "irrigation/motorB");
export const modeRef = ref(db, "irrigation/mode");
export const statusRef = ref(db, "irrigation/status");
export const flowRateRef = ref(db, "irrigation/flowRate");
export const pumpStartedAtRef = ref(db, "irrigation/pumpStartedAt");
export const runTimeRef = ref(db, "irrigation/runTime");
export const sensorsRef = ref(db, "sensors");
export const deviceWifiRef = ref(db, "device/wifi");
export const infoConnectedRef = ref(db, ".info/connected");
export const statsRef = ref(db, "irrigation/stats");
export const moistureRef = ref(db, "irrigation/moisture");
export const timerEndRef = ref(db, "irrigation/timerEnd");

