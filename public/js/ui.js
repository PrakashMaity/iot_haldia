import { drawSparkline } from "./chart.js";

// State cache for local UI tracking
let lastMoistureValue = null;
let lastPumpState = "off";
let pumpTimerInterval = null;
let activePumpState = "off";
let pumpStartTime = null;
let remoteRunTimeSec = null;
let flowRateLpm = 2.5;
let lastUpdatedAt = null;

// DOM Selectors cached on startup
let DOM = {};

export function initSelectors() {
    DOM = {
        // Status Badges
        systemStatus: document.getElementById("systemStatus"),
        statusBar: document.getElementById("statusBar"),
        modeBadge: document.getElementById("modeBadge"),
        tileModeVal: document.getElementById("tileModeVal"),
        tileMode: document.getElementById("tileMode"),
        connectionStatusBadge: document.getElementById("connectionStatusBadge"),
        wifiStatusBadge: document.getElementById("wifiStatusBadge"),

        // Sensor card
        sensorsCard: document.getElementById("sensorsCard"),
        moistureRing: document.getElementById("moistureRing"),
        moistureValue: document.getElementById("moistureValue"),
        moistureLabel: document.getElementById("moistureLabel"),
        levelFill: document.getElementById("levelFill"),
        tileMoisture: document.getElementById("tileMoisture"),
        tileMoistureVal: document.getElementById("tileMoistureVal"),
        tileRaw: document.getElementById("tileRaw"),
        tileRawVal: document.getElementById("tileRawVal"),
        lastUpdated: document.getElementById("lastUpdated"),

        // Sparkline
        sparklineCanvas: document.getElementById("sparklineCanvas"),
        trendLow: document.getElementById("trendLow"),
        trendNow: document.getElementById("trendNow"),
        trendHigh: document.getElementById("trendHigh"),

        // Pump and stats card
        tilePump: document.getElementById("tilePump"),
        tilePumpVal: document.getElementById("tilePumpVal"),
        pumpIndicator: document.getElementById("pumpIndicator"),
        pumpDot: document.getElementById("pumpDot"),
        pumpStatusText: document.getElementById("pumpStatusText"),
        flowPanel: document.getElementById("flowPanel"),
        pumpRunTime: document.getElementById("pumpRunTime"),
        flowRateVal: document.getElementById("flowRateVal"),
        waterVolume: document.getElementById("waterVolume"),

        // Controls
        btnMotorA: document.getElementById("btnMotorA"),
        btnMotorB: document.getElementById("btnMotorB"),
        btnMotorFull: document.getElementById("btnMotorFull"),
        btnMotorOff: document.getElementById("btnMotorOff"),

        // Light card
        lightCard: document.getElementById("lightCard"),
        lightIndicator: document.getElementById("lightIndicator"),
        lightStatusText: document.getElementById("lightStatusText"),
        lightDot: document.getElementById("lightDot"),
        lightStatusVal: document.getElementById("lightStatusVal"),
        toggleBtn: document.getElementById("toggleBtn"),
        lblLightOff: document.getElementById("lblLightOff"),
        lblLightOn: document.getElementById("lblLightOn"),
        lblModeManual: document.getElementById("lblModeManual"),
        lblModeAuto: document.getElementById("lblModeAuto"),
        modeSwitch: document.getElementById("modeSwitch"),

        // Analytics
        statLastRun: document.getElementById("statLastRun"),
        statTotalTime: document.getElementById("statTotalTime"),
        statTotalVolume: document.getElementById("statTotalVolume"),

        // Timer elements
        timerPresets: document.querySelectorAll(".btn-timer-preset"),
        btnCustomTimer: document.getElementById("btnCustomTimer"),
        customTimerForm: document.getElementById("customTimerForm"),
        inputCustomMinutes: document.getElementById("inputCustomMinutes"),
        btnApplyCustomTimer: document.getElementById("btnApplyCustomTimer"),
        activeTimerPanel: document.getElementById("activeTimerPanel"),
        activeTimerText: document.getElementById("activeTimerText"),
        btnCancelTimer: document.getElementById("btnCancelTimer")
    };
}

// Flash CSS transition helper
function flashTile(el) {
    if (!el) return;
    el.classList.remove("tile-flash");
    void el.offsetWidth; // trigger reflow
    el.classList.add("tile-flash");
}

// Helpers for moisture ranges
export function getMoistureState(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return {
            label: "Awaiting Readings",
            color: "#1A1A1A",
            fillColor: "#D4D2CC",
            cardGlow: "glow-none"
        };
    }
    const pct = Number(value);
    if (pct < 35) {
        return {
            label: "Dry — Needs Irrigation",
            color: "#1A1A1A",
            fillColor: "#1A1A1A",
            cardGlow: "glow-orange"
        };
    } else if (pct <= 70) {
        return {
            label: "Optimal — Moisture Healthy",
            color: "#1A1A1A",
            fillColor: "#1A1A1A",
            cardGlow: "glow-green"
        };
    } else {
        return {
            label: "Wet — Saturated",
            color: "#1A1A1A",
            fillColor: "#1A1A1A",
            cardGlow: "glow-blue"
        };
    }
}

// Format duration into HH:MM:SS
function formatDuration(totalSeconds) {
    const sec = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

// UI Updating functions
export function updateMoistureUI(value, flash = false) {
    const hasValue = value !== null && value !== undefined && !isNaN(value);
    const pct = hasValue ? Math.max(0, Math.min(100, Number(value))) : null;
    const changed = lastMoistureValue !== value;
    lastMoistureValue = value;

    const state = getMoistureState(pct);

    if (DOM.moistureValue) DOM.moistureValue.textContent = hasValue ? pct : "--";
    if (DOM.moistureLabel) {
        DOM.moistureLabel.textContent = state.label;
    }

    if (DOM.moistureRing) {
        const deg = hasValue ? (pct / 100) * 360 : 0;
        DOM.moistureRing.style.setProperty("--ring-color", state.color);
        DOM.moistureRing.style.setProperty("--ring-deg", `${deg}deg`);
        if (changed) {
            DOM.moistureRing.classList.add("scale-pulse");
            setTimeout(() => DOM.moistureRing.classList.remove("scale-pulse"), 400);
        }
    }

    if (DOM.levelFill) {
        DOM.levelFill.style.width = hasValue ? `${pct}%` : "0%";
        DOM.levelFill.style.background = state.fillColor;
    }

    if (DOM.tileMoistureVal) {
        DOM.tileMoistureVal.innerHTML = hasValue
            ? `${pct}<span class="tile-value-unit"> %</span>`
            : `--<span class="tile-value-unit"> %</span>`;
    }

    if (DOM.sensorsCard && activePumpState === "off") {
        DOM.sensorsCard.className = `card ${state.cardGlow}`;
    }

    if (flash && changed && DOM.tileMoisture) flashTile(DOM.tileMoisture);
}

export function updateRawUI(value, flash = false) {
    const hasValue = value !== null && value !== undefined && !isNaN(value);
    if (DOM.tileRawVal) DOM.tileRawVal.textContent = hasValue ? Math.round(Number(value)) : "--";
    if (flash && DOM.tileRaw) flashTile(DOM.tileRaw);
}

export function updateLastUpdatedAt(timestamp) {
    lastUpdatedAt = timestamp;
    updateConnectionDetails();
}

function updateConnectionDetails() {
    if (!DOM.lastUpdated) return;
    if (!lastUpdatedAt) {
        DOM.lastUpdated.textContent = "No Data";
        return;
    }
    const diffSec = Math.floor((Date.now() - lastUpdatedAt) / 1000);
    if (diffSec < 5) {
        DOM.lastUpdated.textContent = "Just Now";
    } else if (diffSec < 60) {
        DOM.lastUpdated.textContent = `${diffSec}s ago`;
    } else {
        const min = Math.floor(diffSec / 60);
        DOM.lastUpdated.textContent = min === 1 ? "1 min ago" : `${min} mins ago`;
    }
}

// Auto update connection details display
setInterval(updateConnectionDetails, 5000);

export function updateWifiUI(wifi) {
    if (!DOM.wifiStatusBadge) return;
    if (wifi && wifi.connected) {
        const rssi = Number(wifi.rssi || -100);
        let strength = "Excellent";
        if (rssi < -80) strength = "Weak";
        else if (rssi < -67) strength = "Good";

        DOM.wifiStatusBadge.innerHTML = `
            <span class="status-dot active"></span>
            <span>WiFi: ${wifi.ssid || "Connected"} · ${strength}</span>
        `;
    } else {
        DOM.wifiStatusBadge.innerHTML = `
            <span class="status-dot"></span>
            <span>WiFi: Disconnected</span>
        `;
    }
}

export function updateCloudUI(online, rtdbConnected) {
    if (!DOM.connectionStatusBadge) return;
    if (online && rtdbConnected) {
        DOM.connectionStatusBadge.innerHTML = `
            <span class="status-dot active"></span>
            <span>Cloud: Connected</span>
        `;
    } else if (online) {
        DOM.connectionStatusBadge.innerHTML = `
            <span class="status-dot warning"></span>
            <span>Cloud: Syncing…</span>
        `;
    } else {
        DOM.connectionStatusBadge.innerHTML = `
            <span class="status-dot"></span>
            <span>Cloud: Offline</span>
        `;
    }
}

export function updateStatsUI(stats) {
    if (!stats) return;
    if (DOM.statLastRun) {
        if (stats.lastRunTimestamp) {
            const date = new Date(stats.lastRunTimestamp);
            DOM.statLastRun.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
        } else {
            DOM.statLastRun.textContent = "Never";
        }
    }
    
    if (DOM.statTotalTime) {
        const totalMin = Math.floor(stats.totalRunTimeMinutes || 0);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        DOM.statTotalTime.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    
    if (DOM.statTotalVolume) {
        DOM.statTotalVolume.textContent = `${Number(stats.totalWaterVolumeLiters || 0).toFixed(1)} L`;
    }
}

// Mode pill rendering
export function updateModeUI(mode) {
    const isAuto = mode === "auto";
    if (DOM.modeBadge) {
        DOM.modeBadge.innerHTML = `
            <span class="status-dot ${isAuto ? 'active' : ''}"></span>
            <span>Mode: ${isAuto ? 'Auto' : 'Manual'}</span>
        `;
        DOM.modeBadge.className = isAuto
            ? "status-badge mode-badge mode-auto"
            : "status-badge mode-badge mode-manual";
    }

    if (DOM.modeSwitch) {
        if (isAuto) {
            DOM.modeSwitch.classList.add("active");
            if (DOM.lblModeManual) DOM.lblModeManual.classList.remove("switch-label-active");
            if (DOM.lblModeAuto) DOM.lblModeAuto.classList.add("switch-label-active");
        } else {
            DOM.modeSwitch.classList.remove("active");
            if (DOM.lblModeManual) DOM.lblModeManual.classList.add("switch-label-active");
            if (DOM.lblModeAuto) DOM.lblModeAuto.classList.remove("switch-label-active");
        }
    }

    if (DOM.tileMode) flashTile(DOM.tileMode);
}

// Light switches rendering
export function updateLightUI(isOn) {
    const active = isOn === true;

    if (active) {
        if (DOM.lightDot) DOM.lightDot.className = "pill-dot pulse-dot";
        if (DOM.lightStatusText) DOM.lightStatusText.textContent = "Light On";
        if (DOM.lightIndicator) DOM.lightIndicator.className = "status-pill pill-active";
        if (DOM.lightStatusVal) {
            DOM.lightStatusVal.textContent = "ON";
            DOM.lightStatusVal.className = "light-status-val is-on";
        }
        if (DOM.toggleBtn) {
            DOM.toggleBtn.classList.add("active");
        }
        if (DOM.lblLightOff) DOM.lblLightOff.classList.remove("switch-label-active");
        if (DOM.lblLightOn) DOM.lblLightOn.classList.add("switch-label-active");
    } else {
        if (DOM.lightDot) DOM.lightDot.className = "pill-dot";
        if (DOM.lightStatusText) DOM.lightStatusText.textContent = "Light Off";
        if (DOM.lightIndicator) DOM.lightIndicator.className = "status-pill";
        if (DOM.lightStatusVal) {
            DOM.lightStatusVal.textContent = "OFF";
            DOM.lightStatusVal.className = "light-status-val";
        }
        if (DOM.toggleBtn) {
            DOM.toggleBtn.classList.remove("active");
        }
        if (DOM.lblLightOff) DOM.lblLightOff.classList.add("switch-label-active");
        if (DOM.lblLightOn) DOM.lblLightOn.classList.remove("switch-label-active");
    }
}

// Live flow metric updates
function updateFlowMetrics() {
    let sec = 0;
    if (remoteRunTimeSec !== null && !isNaN(remoteRunTimeSec)) {
        sec = Math.floor(remoteRunTimeSec);
    } else if (pumpStartTime) {
        sec = Math.floor((Date.now() - pumpStartTime) / 1000);
    }
    const volume = (flowRateLpm / 60) * sec;

    if (DOM.pumpRunTime) DOM.pumpRunTime.textContent = formatDuration(sec);
    if (DOM.flowRateVal) DOM.flowRateVal.textContent = flowRateLpm.toFixed(1);
    if (DOM.waterVolume) DOM.waterVolume.textContent = volume.toFixed(2);
}

// Start local timer
function startPumpTimer(startedAt) {
    if (pumpTimerInterval) clearInterval(pumpTimerInterval);
    pumpStartTime = startedAt || Date.now();
    if (DOM.flowPanel) DOM.flowPanel.classList.add("active");
    updateFlowMetrics();
    pumpTimerInterval = setInterval(updateFlowMetrics, 1000);
}

// Stop local timer
function stopPumpTimer() {
    if (pumpTimerInterval) {
        clearInterval(pumpTimerInterval);
        pumpTimerInterval = null;
    }
    pumpStartTime = null;
    remoteRunTimeSec = null;
    if (DOM.flowPanel) DOM.flowPanel.classList.remove("active");
    if (DOM.pumpRunTime) DOM.pumpRunTime.textContent = "00:00:00";
    if (DOM.waterVolume) DOM.waterVolume.textContent = "0.00";
}

// System status text (Monitoring / Watering)
export function updateSystemStatusUI(status, isPumpRunning) {
    if (!DOM.systemStatus || !DOM.statusBar) return;

    let label = "Standby";
    let dotClass = "status-dot";

    if (isPumpRunning) {
        label = "Watering";
        dotClass = "status-dot active pulse-dot";
    } else if (status === "monitoring") {
        label = "Monitoring";
        dotClass = "status-dot active";
    } else if (status === "idle") {
        label = "Idle";
    } else if (lastMoistureValue !== null && !isNaN(lastMoistureValue) && lastMoistureValue < 35) {
        label = "Dry";
        dotClass = "status-dot warning";
    } else if (lastMoistureValue !== null && !isNaN(lastMoistureValue)) {
        label = "Monitoring";
        dotClass = "status-dot active";
    }

    DOM.systemStatus.textContent = label;

    // Update the status dot in the status bar
    const statusDot = DOM.statusBar.querySelector(".status-dot");
    if (statusDot) statusDot.className = dotClass;
}

// Main pump state UI updates
export function updatePumpUI(state, firebasePumpStartedAt = null, remoteTime = null, remoteFlowRate = null) {
    activePumpState = state || "off";
    const isRunning = activePumpState !== "off";

    // Update variables
    if (remoteFlowRate !== null) flowRateLpm = remoteFlowRate;
    remoteRunTimeSec = remoteTime;

    // Reset button classes
    if (DOM.btnMotorA) DOM.btnMotorA.className = "btn-rocker";
    if (DOM.btnMotorB) DOM.btnMotorB.className = "btn-rocker";
    if (DOM.btnMotorFull) DOM.btnMotorFull.className = "btn-rocker btn-rocker-span-2";
    if (DOM.btnMotorOff) DOM.btnMotorOff.className = "btn-emergency btn-rocker-span-2";

    if (isRunning) {
        let title = "Pump Active";
        let tileTitle = "ON";

        if (activePumpState === "A") {
            if (DOM.btnMotorA) DOM.btnMotorA.classList.add("btn-active");
            title = "Motor A";
            tileTitle = "Motor A";
        } else if (activePumpState === "B") {
            if (DOM.btnMotorB) DOM.btnMotorB.classList.add("btn-active");
            title = "Motor B";
            tileTitle = "Motor B";
        } else if (activePumpState === "full") {
            if (DOM.btnMotorFull) DOM.btnMotorFull.classList.add("btn-active");
            title = "Full Pump";
            tileTitle = "Full Pump";
        }

        if (DOM.pumpDot) DOM.pumpDot.className = "pill-dot pulse-dot";
        if (DOM.pumpStatusText) DOM.pumpStatusText.textContent = title;
        if (DOM.pumpIndicator) DOM.pumpIndicator.className = "status-pill pill-active";
        if (DOM.tilePumpVal) {
            DOM.tilePumpVal.textContent = tileTitle;
            DOM.tilePumpVal.className = "pump-state-value active";
        }

        if (DOM.sensorsCard) {
            DOM.sensorsCard.className = "card glow-pump";
        }
        if (DOM.flowPanel) DOM.flowPanel.classList.add("active");

        if (lastPumpState === "off") {
            const startAt = firebasePumpStartedAt || Date.now();
            startPumpTimer(startAt);
        }
    } else {
        if (DOM.btnMotorOff) DOM.btnMotorOff.classList.add("btn-stop-active");
        if (DOM.pumpDot) DOM.pumpDot.className = "pill-dot";
        if (DOM.pumpStatusText) DOM.pumpStatusText.textContent = "Pump Off";
        if (DOM.pumpIndicator) DOM.pumpIndicator.className = "status-pill";
        if (DOM.tilePumpVal) {
            DOM.tilePumpVal.textContent = "OFF";
            DOM.tilePumpVal.className = "pump-state-value";
        }

        const moistureVal = lastMoistureValue;
        const moistureState = getMoistureState(moistureVal);
        if (DOM.sensorsCard) {
            DOM.sensorsCard.className = `card ${moistureState.cardGlow}`;
        }
        if (DOM.flowPanel) DOM.flowPanel.classList.remove("active");

        if (lastPumpState !== "off") {
            stopPumpTimer();
        }
    }

    lastPumpState = activePumpState;
    if (DOM.tilePump) flashTile(DOM.tilePump);
}

// Trend sparkline updating
export function updateTrendUI(history) {
    if (DOM.sparklineCanvas) {
        drawSparkline(DOM.sparklineCanvas, history);
    }
    
    // Updates High/Low/Now text stats
    const lowEl = DOM.trendLow;
    const nowEl = DOM.trendNow;
    const highEl = DOM.trendHigh;
    if (!lowEl || !nowEl || !highEl) return;

    if (!history || history.length === 0) {
        lowEl.textContent = "--";
        nowEl.textContent = "--";
        highEl.textContent = "--";
        return;
    }

    const low = Math.min(...history);
    const high = Math.max(...history);
    const now = history[history.length - 1];

    lowEl.textContent = `${low}%`;
    nowEl.textContent = `${now}%`;
    highEl.textContent = `${high}%`;
}

// Highlights a timer preset button matching the selected minutes value
export function highlightPreset(minutes) {
    if (!DOM.timerPresets) return;
    DOM.timerPresets.forEach((btn) => {
        const minAttr = btn.getAttribute("data-minutes");
        if (minAttr === String(minutes)) {
            btn.classList.add("selected");
        } else {
            btn.classList.remove("selected");
        }
    });
}

// Clears selected state from all preset buttons
export function clearPresetSelections() {
    if (!DOM.timerPresets) return;
    DOM.timerPresets.forEach((btn) => btn.classList.remove("selected"));
}

// Shows or hides the timer countdown panel and presets
export function updateTimerUI(timerEnd, isPumpRunning, selectedMinutes = null) {
    if (timerEnd && isPumpRunning) {
        if (DOM.activeTimerPanel) DOM.activeTimerPanel.classList.add("active");
        if (DOM.customTimerForm) DOM.customTimerForm.classList.add("hidden");
        clearPresetSelections();
    } else if (selectedMinutes && !isPumpRunning) {
        if (DOM.activeTimerPanel) {
            DOM.activeTimerPanel.classList.add("active");
            if (DOM.activeTimerText) {
                DOM.activeTimerText.textContent = `Timer: ${selectedMinutes}m (starts with pump)`;
            }
        }
        highlightPreset(selectedMinutes);
    } else {
        if (DOM.activeTimerPanel) DOM.activeTimerPanel.classList.remove("active");
        if (DOM.customTimerForm) DOM.customTimerForm.classList.add("hidden");
        clearPresetSelections();
    }
}

// Render the remaining countdown time
export function updateTimerCountdown(remainingMs) {
    if (!DOM.activeTimerText) return;
    const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    DOM.activeTimerText.textContent = `Stopping in: ${timeStr}`;
}

