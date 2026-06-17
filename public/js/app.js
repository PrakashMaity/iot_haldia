import {
    db, set, onValue,
    lightRef, motorARef, motorBRef, modeRef, statusRef,
    flowRateRef, pumpStartedAtRef, runTimeRef, sensorsRef,
    deviceWifiRef, infoConnectedRef, statsRef, moistureRef,
    timerEndRef
} from "./firebase-config.js";

import {
    initSelectors,
    updateMoistureUI,
    updateRawUI,
    updateLastUpdatedAt,
    updateWifiUI,
    updateCloudUI,
    updateStatsUI,
    updateModeUI,
    updateLightUI,
    updatePumpUI,
    updateSystemStatusUI,
    updateTrendUI,
    updateTimerUI,
    updateTimerCountdown,
    highlightPreset,
    clearPresetSelections
} from "./ui.js";


// App States
const HISTORY_LEN = 24;
const DEFAULT_FLOW_LPM = 2.5;
const moistureHistory = [38, 41, 44, 46, 48, 50, 52, 53, 54, 55, 56, 57, 56, 57, 58, 57, 58, 59, 58, 57, 58, 58, 59, 58];

let lastMoistureValue = null;
let currentPumpState = "off";
let flowRateLpm = DEFAULT_FLOW_LPM;
let currentMode = "manual";
let currentLightStatus = false;
let browserOnline = navigator.onLine;
let firebaseRtdbConnected = false;
let firebasePumpStartedAt = null;
let remoteRunTimeSec = null;

// Timer States
let activeTimerEndVal = null;
let selectedTimerMinutes = null;
let timerCountdownInterval = null;


let statsData = {
    totalRunTimeMinutes: 0,
    totalWaterVolumeLiters: 0,
    lastRunTimestamp: null
};

// Functions
function pushMoistureHistory(value) {
    if (value === null || value === undefined || isNaN(value)) return;
    const pct = Math.max(0, Math.min(100, Number(value)));
    const last = moistureHistory[moistureHistory.length - 1];
    if (last === pct && moistureHistory.length > 0) return;
    moistureHistory.push(pct);
    if (moistureHistory.length > HISTORY_LEN) moistureHistory.shift();
    updateTrendUI(moistureHistory);
}

// When pump stops, calculate run time and commit to Firebase Stats
function commitPumpStatsToCloud() {
    if (!firebasePumpStartedAt) return;
    const runDurationSec = Math.floor((Date.now() - firebasePumpStartedAt) / 1000);
    if (runDurationSec < 1) return; // ignore sub-second runs
    
    const volumeLiters = (flowRateLpm / 60) * runDurationSec;
    const durationMinutes = runDurationSec / 60;
    
    const newStats = {
        totalRunTimeMinutes: (statsData.totalRunTimeMinutes || 0) + durationMinutes,
        totalWaterVolumeLiters: (statsData.totalWaterVolumeLiters || 0) + volumeLiters,
        lastRunTimestamp: Date.now()
    };
    
    set(statsRef, newStats).catch(console.error);
}

// State monitors
let motorAState = false;
let motorBState = false;

async function triggerPumpStop() {
    if (motorAState || motorBState) {
        commitPumpStatsToCloud();
    }
    await set(modeRef, "manual");
    await set(motorARef, false);
    await set(motorBRef, false);
    await set(pumpStartedAtRef, null);
    await set(runTimeRef, null);
    await set(timerEndRef, null);
    firebasePumpStartedAt = null;
    selectedTimerMinutes = null;
}

async function applyTimerMinutes(mins) {
    if (currentPumpState !== "off") {
        const timerEnd = Date.now() + mins * 60 * 1000;
        await set(timerEndRef, timerEnd);
    } else {
        selectedTimerMinutes = mins;
        updateTimerUI(null, false, selectedTimerMinutes);
    }
}

function updatePumpStateFromMotors() {
    let state = "off";
    if (motorAState && motorBState) state = "full";
    else if (motorAState) state = "A";
    else if (motorBState) state = "B";
    
    currentPumpState = state;
    updatePumpUI(state, firebasePumpStartedAt, remoteRunTimeSec, flowRateLpm);
    updateSystemStatusUI(null, state !== "off");

    // If pump is off, ensure active timer is cleared
    if (state === "off") {
        if (activeTimerEndVal !== null) {
            activeTimerEndVal = null;
            set(timerEndRef, null).catch(console.error);
        }
        selectedTimerMinutes = null;
        updateTimerUI(null, false, null);
        if (timerCountdownInterval) {
            clearInterval(timerCountdownInterval);
            timerCountdownInterval = null;
        }
    } else {
        // If pump turned on, sync UI with timerEnd if present
        updateTimerUI(activeTimerEndVal, true, selectedTimerMinutes);
    }
}

// --- Attach Event Listeners ---
function setupEvents() {
    const toggleBtn = document.getElementById("toggleBtn");
    const modeBadge = document.getElementById("modeBadge");
    const btnMotorA = document.getElementById("btnMotorA");
    const btnMotorB = document.getElementById("btnMotorB");
    const btnMotorFull = document.getElementById("btnMotorFull");
    const btnMotorOff = document.getElementById("btnMotorOff");

    if (toggleBtn) {
        toggleBtn.addEventListener("click", async () => {
            await set(lightRef, !currentLightStatus);
        });
    }

    const modeSwitch = document.getElementById("modeSwitch");
    if (modeBadge) {
        modeBadge.addEventListener("click", async () => {
            const nextMode = currentMode === "auto" ? "manual" : "auto";
            await set(modeRef, nextMode);
        });
    }
    if (modeSwitch) {
        modeSwitch.addEventListener("click", async () => {
            const nextMode = currentMode === "auto" ? "manual" : "auto";
            await set(modeRef, nextMode);
        });
    }

    if (btnMotorA) {
        btnMotorA.addEventListener("click", async () => {
            if (!motorAState && !motorBState) {
                const startedAt = Date.now();
                await set(pumpStartedAtRef, startedAt);
                firebasePumpStartedAt = startedAt;
                if (selectedTimerMinutes) {
                    await set(timerEndRef, startedAt + selectedTimerMinutes * 60 * 1000);
                    selectedTimerMinutes = null;
                }
            }
            await set(modeRef, "manual");
            await set(motorARef, true);
            await set(motorBRef, false);
        });
    }

    if (btnMotorB) {
        btnMotorB.addEventListener("click", async () => {
            if (!motorAState && !motorBState) {
                const startedAt = Date.now();
                await set(pumpStartedAtRef, startedAt);
                firebasePumpStartedAt = startedAt;
                if (selectedTimerMinutes) {
                    await set(timerEndRef, startedAt + selectedTimerMinutes * 60 * 1000);
                    selectedTimerMinutes = null;
                }
            }
            await set(modeRef, "manual");
            await set(motorARef, false);
            await set(motorBRef, true);
        });
    }

    if (btnMotorFull) {
        btnMotorFull.addEventListener("click", async () => {
            if (!motorAState && !motorBState) {
                const startedAt = Date.now();
                await set(pumpStartedAtRef, startedAt);
                firebasePumpStartedAt = startedAt;
                if (selectedTimerMinutes) {
                    await set(timerEndRef, startedAt + selectedTimerMinutes * 60 * 1000);
                    selectedTimerMinutes = null;
                }
            }
            await set(modeRef, "manual");
            await set(motorARef, true);
            await set(motorBRef, true);
        });
    }

    if (btnMotorOff) {
        btnMotorOff.addEventListener("click", async () => {
            // Local check: if running, write run time statistics
            if (motorAState || motorBState) {
                commitPumpStatsToCloud();
            }
            await set(modeRef, "manual");
            await set(motorARef, false);
            await set(motorBRef, false);
            await set(pumpStartedAtRef, null);
            await set(runTimeRef, null);
            await set(timerEndRef, null);
            firebasePumpStartedAt = null;
            selectedTimerMinutes = null;
        });
    }

    // Timer Event Listeners
    const timerPresets = document.querySelectorAll(".btn-timer-preset");
    timerPresets.forEach((btn) => {
        btn.addEventListener("click", async () => {
            const minsAttr = btn.getAttribute("data-minutes");
            if (!minsAttr) return; // Custom handled separately
            
            const mins = parseInt(minsAttr, 10);
            if (isNaN(mins)) return;
            
            await applyTimerMinutes(mins);
        });
    });

    const btnCustomTimer = document.getElementById("btnCustomTimer");
    const customTimerForm = document.getElementById("customTimerForm");
    const inputCustomMinutes = document.getElementById("inputCustomMinutes");
    const btnApplyCustomTimer = document.getElementById("btnApplyCustomTimer");

    if (btnCustomTimer && customTimerForm) {
        btnCustomTimer.addEventListener("click", () => {
            const isHidden = customTimerForm.classList.contains("hidden");
            if (isHidden) {
                clearPresetSelections();
                btnCustomTimer.classList.add("selected");
                customTimerForm.classList.remove("hidden");
                if (inputCustomMinutes) inputCustomMinutes.focus();
            } else {
                btnCustomTimer.classList.remove("selected");
                customTimerForm.classList.add("hidden");
            }
        });
    }

    if (btnApplyCustomTimer && inputCustomMinutes) {
        btnApplyCustomTimer.addEventListener("click", async () => {
            const mins = parseInt(inputCustomMinutes.value, 10);
            if (isNaN(mins) || mins <= 0) {
                alert("Please enter a valid number of minutes.");
                return;
            }
            await applyTimerMinutes(mins);
            if (customTimerForm) customTimerForm.classList.add("hidden");
            if (btnCustomTimer) btnCustomTimer.classList.remove("selected");
            inputCustomMinutes.value = "";
        });
        
        inputCustomMinutes.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
                const mins = parseInt(inputCustomMinutes.value, 10);
                if (isNaN(mins) || mins <= 0) {
                    alert("Please enter a valid number of minutes.");
                    return;
                }
                await applyTimerMinutes(mins);
                if (customTimerForm) customTimerForm.classList.add("hidden");
                if (btnCustomTimer) btnCustomTimer.classList.remove("selected");
                inputCustomMinutes.value = "";
            }
        });
    }

    const btnCancelTimer = document.getElementById("btnCancelTimer");
    if (btnCancelTimer) {
        btnCancelTimer.addEventListener("click", async () => {
            selectedTimerMinutes = null;
            activeTimerEndVal = null;
            if (timerCountdownInterval) {
                clearInterval(timerCountdownInterval);
                timerCountdownInterval = null;
            }
            await set(timerEndRef, null);
            updateTimerUI(null, currentPumpState !== "off", null);
        });
    }
}

// --- Initialize App ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Map cached DOM elements
    initSelectors();

    // 2. Load fallback trend chart to start with
    updateTrendUI(moistureHistory);

    // 3. Attach clicks
    setupEvents();

    // 4. Listen to Firebase Updates
    onValue(infoConnectedRef, (snapshot) => {
        firebaseRtdbConnected = snapshot.val() === true;
        updateCloudUI(browserOnline, firebaseRtdbConnected);
    });

    onValue(deviceWifiRef, (snapshot) => {
        const data = snapshot.val();
        if (data && typeof data === "object") {
            updateWifiUI(data);
        }
    });

    onValue(sensorsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data || typeof data !== "object") return;

        let moistureVal = null;
        if (data.moisture !== undefined) moistureVal = data.moisture;
        else if (data.moisturePercent !== undefined) moistureVal = data.moisturePercent;

        if (moistureVal !== null) {
            lastMoistureValue = moistureVal;
            updateMoistureUI(moistureVal, true);
            pushMoistureHistory(moistureVal);
        }

        if (data.raw !== undefined) updateRawUI(data.raw, true);
        else if (data.moistureRaw !== undefined) updateRawUI(data.moistureRaw, true);

        if (data.updatedAt !== undefined) {
            updateLastUpdatedAt(Number(data.updatedAt));
        }
    });

    onValue(moistureRef, (snapshot) => {
        const val = snapshot.val();
        if (val !== null && val !== undefined) {
            lastMoistureValue = val;
            updateMoistureUI(val, true);
            pushMoistureHistory(val);
        }
    });

    onValue(motorARef, (snapshot) => {
        motorAState = snapshot.val() === true;
        updatePumpStateFromMotors();
    });

    onValue(motorBRef, (snapshot) => {
        motorBState = snapshot.val() === true;
        updatePumpStateFromMotors();
    });

    onValue(modeRef, (snapshot) => {
        const val = snapshot.val();
        if (val !== null && val !== undefined) {
            currentMode = val;
            updateModeUI(val);
        }
    });

    onValue(flowRateRef, (snapshot) => {
        const val = snapshot.val();
        if (val !== null && val !== undefined && !isNaN(val)) {
            flowRateLpm = Math.max(0, Number(val));
        } else {
            flowRateLpm = DEFAULT_FLOW_LPM;
        }
        updatePumpUI(currentPumpState, firebasePumpStartedAt, remoteRunTimeSec, flowRateLpm);
    });

    onValue(pumpStartedAtRef, (snapshot) => {
        const val = snapshot.val();
        firebasePumpStartedAt = val ? Number(val) : null;
        updatePumpUI(currentPumpState, firebasePumpStartedAt, remoteRunTimeSec, flowRateLpm);
    });

    onValue(runTimeRef, (snapshot) => {
        const val = snapshot.val();
        remoteRunTimeSec = (val !== null && val !== undefined && !isNaN(val)) ? Math.floor(Number(val)) : null;
        updatePumpUI(currentPumpState, firebasePumpStartedAt, remoteRunTimeSec, flowRateLpm);
    });

    onValue(statusRef, (snapshot) => {
        const val = snapshot.val();
        if (val !== null && val !== undefined) {
            updateSystemStatusUI(val, currentPumpState !== "off");
        }
    });

    onValue(lightRef, (snapshot) => {
        const val = snapshot.val();
        if (val !== null && val !== undefined) {
            currentLightStatus = val === true;
            updateLightUI(currentLightStatus);
        }
    });

    onValue(statsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            statsData = {
                totalRunTimeMinutes: data.totalRunTimeMinutes || 0,
                totalWaterVolumeLiters: data.totalWaterVolumeLiters || 0,
                lastRunTimestamp: data.lastRunTimestamp || null
            };
            updateStatsUI(statsData);
        }
    });

    onValue(timerEndRef, (snapshot) => {
        const val = snapshot.val();
        activeTimerEndVal = val ? Number(val) : null;
        
        // Update the timer UI state
        updateTimerUI(activeTimerEndVal, currentPumpState !== "off", selectedTimerMinutes);
        
        // Handle countdown interval
        if (timerCountdownInterval) {
            clearInterval(timerCountdownInterval);
            timerCountdownInterval = null;
        }
        
        if (activeTimerEndVal && currentPumpState !== "off") {
            timerCountdownInterval = setInterval(() => {
                const remaining = activeTimerEndVal - Date.now();
                if (remaining <= 0) {
                    clearInterval(timerCountdownInterval);
                    timerCountdownInterval = null;
                    triggerPumpStop();
                } else {
                    updateTimerCountdown(remaining);
                }
            }, 1000);
            
            // Run once immediately
            const remaining = activeTimerEndVal - Date.now();
            if (remaining > 0) {
                updateTimerCountdown(remaining);
            }
        }
    });

    // Offline / Online browser listeners
    window.addEventListener("online", () => {
        browserOnline = true;
        updateCloudUI(browserOnline, firebaseRtdbConnected);
    });

    window.addEventListener("offline", () => {
        browserOnline = false;
        updateCloudUI(browserOnline, firebaseRtdbConnected);
    });
});
