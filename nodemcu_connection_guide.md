# Haldia Roof Garden — NodeMCU & Relay Connection Guide

This guide details the hardware connections, pin mappings, Firebase Realtime Database path specifications, and contains a complete Arduino sketch template to get your NodeMCU ESP8266 connected and communicating with the dashboard.

---

## 1. Hardware Pin Connections

To support the dashboard features, the NodeMCU needs to interface with a **3-Channel Relay Module** (or 4-channel), an **Analog Soil Moisture Sensor**, and a **Flow Sensor** (pulse-based).

### NodeMCU Pin Mapping Table

| NodeMCU GPIO Pin | Connected Component | Pin on Component | Description |
| :--- | :--- | :--- | :--- |
| **GND** | Common ground | **GND** | Connect grounds of all modules together |
| **3V3** | Soil Moisture Sensor | **VCC** (3.3V) | Power supply for capacitive/resistive sensor |
| **VIN** (or **5V**) | Relay Module & Flow Sensor | **VCC** / **JD-VCC** (5V) | Power supply for 5V relays and flow sensor |
| **A0** | Soil Moisture Sensor | **A0** (Analog Out) | Reads soil moisture raw ADC values |
| **D1** (GPIO 5) | Relay Module | **IN1** (Relay A) | Controls Motor A ON/OFF |
| **D2** (GPIO 4) | Relay Module | **IN2** (Relay B) | Controls Motor B ON/OFF |
| **D3** (GPIO 0) | Relay Module | **IN3** (Light Relay) | Controls 220V Garden Light |
| **D5** (GPIO 14) | Water Flow Sensor | **OUT** (Pulse Signal) | Counts water flow pulses (Interrupt Pin) |

```mermaid
graph TD
    subgraph NodeMCU ESP8266
        GND[GND]
        3V3[3V3]
        VIN[VIN / 5V]
        A0[A0]
        D1[D1 / GPIO5]
        D2[D2 / GPIO4]
        D3[D3 / GPIO0]
        D5[D5 / GPIO14]
    end

    subgraph Relays
        IN1[IN1: Motor A]
        IN2[IN2: Motor B]
        IN3[IN3: Garden Light]
        VCC_R[VCC 5V]
        GND_R[GND]
    end

    subgraph Soil Sensor
        VCC_S[VCC 3.3V]
        GND_S[GND]
        AO_S[Analog Out]
    end

    subgraph Flow Sensor
        VCC_F[VCC 5V]
        GND_F[GND]
        OUT_F[Signal Pulse]
    end

    GND --> GND_R
    GND --> GND_S
    GND --> GND_F

    3V3 --> VCC_S
    VIN --> VCC_R
    VIN --> VCC_F

    A0 --> AO_S
    D1 --> IN1
    D2 --> IN2
    D3 --> IN3
    D5 --> OUT_F
```

> [!CAUTION]
> **Relay Isolation (Active Low Trigger)**: Most 5V relay modules are active-low. Make sure the NodeMCU outputs 3.3V or pulls pins LOW appropriately. When using 5V relays, ensure the NodeMCU GPIO pins (3.3V logic) can trigger them. If a relay fails to trigger, you may need a logic level shifter or transistor trigger circuit.

---

## 2. Firebase Database Objects Reference

Here is the exact schema and data types representing the Firebase Database node structure used by the dashboard. Ensure your NodeMCU code reads and writes to these paths.

```json
{
  "light": {
    "status": false             // [Boolean, Read/Write] Controls the light
  },
  "irrigation": {
    "motorA": false,            // [Boolean, Read/Write] Controls Motor A
    "motorB": false,            // [Boolean, Read/Write] Controls Motor B
    "mode": "manual",           // [String, Read/Write] "manual" or "auto"
    "status": "monitoring",     // [String, Write] "monitoring" or "watering"
    "flowRate": 2.5,            // [Float, Write] Liters per minute
    "pumpStartedAt": null,      // [Integer/Null, Read] Epoch milliseconds when pump started
    "runTime": null,            // [Integer/Null, Write] Run time in seconds
    "timerEnd": null            // [Integer/Null, Read] Epoch milliseconds for timer stop
  },
  "sensors": {
    "moisture": 58,             // [Integer, Write] Moisture percentage (0 - 100)
    "raw": 487,                 // [Integer, Write] Raw ADC reading (0 - 1024)
    "updatedAt": 1718012345000  // [Integer, Write] Epoch milliseconds timestamp
  },
  "device": {
    "wifi": {
      "connected": true,        // [Boolean, Write] Connection status
      "ssid": "MyWiFi",         // [String, Write] Network SSID
      "rssi": -65,              // [Integer, Write] Signal strength (dBm)
      "lastSeen": 1749465577500 // [Integer, Write] Heartbeat timestamp
    }
  }
}
```

---

## 3. NodeMCU Arduino Sketch Template

Install the **Firebase-ESP8266** library by *Mobizt* in the Arduino IDE Library Manager before uploading.

```cpp
#include <ESP8266WiFi.h>
#include <FirebaseESP8266.h>

// 1. Network & Firebase Configs
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define FIREBASE_HOST "https://iot1-d1c2d-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "AIzaSyBPGIvoZPg9ZklQKUI47IO8GM52rZ5wBsE" // Firebase Database Secret

// 2. Hardware Pin Definitions
#define PIN_MOTOR_A D1
#define PIN_MOTOR_B D2
#define PIN_LIGHT   D3
#define PIN_FLOW    D5
#define PIN_MOISTURE A0

// 3. Flow Sensor Variables
volatile uint16_t pulseCount = 0;
float flowRateLPM = 0.0;
unsigned long lastFlowMillis = 0;
const float calibrationFactor = 7.5; // Custom calibration factor for flow sensor pulses

// 4. Time and Updates
unsigned long lastSensorUpdate = 0;
unsigned long lastHeartbeat = 0;
unsigned long pumpStartTime = 0;
bool isPumpRunning = false;

// Firebase Classes
FirebaseData fbDataStream;
FirebaseData fbDataWrite;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// Interrupt Service Routine for Flow Sensor
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

void setup() {
  Serial.begin(115200);

  // Configure output pins
  pinMode(PIN_MOTOR_A, OUTPUT);
  pinMode(PIN_MOTOR_B, OUTPUT);
  pinMode(PIN_LIGHT, OUTPUT);
  
  // Set relays to default OFF state (Active-Low relays set HIGH for OFF)
  digitalWrite(PIN_MOTOR_A, HIGH);
  digitalWrite(PIN_MOTOR_B, HIGH);
  digitalWrite(PIN_LIGHT, HIGH);

  // Configure pulse input
  pinMode(PIN_FLOW, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW), pulseCounter, FALLING);

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");

  // Setup Firebase
  fbConfig.database_url = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);

  // Setup RTDB Stream listener to dynamically receive command updates
  if (Firebase.beginStream(fbDataStream, "/")) {
    Serial.println("Firebase stream started.");
  } else {
    Serial.println("Firebase stream failed: " + fbDataStream.errorReason());
  }
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. Process Firebase Stream updates in real-time
  if (Firebase.readStream(fbDataStream)) {
    if (fbDataStream.streamTimeout()) {
      Serial.println("Stream timeout.");
    } else if (fbDataStream.dataType() == "json") {
      // Process database writes received
      processStreamData(fbDataStream.jsonString());
    }
  }

  // 2. Read Soil Moisture (every 5 seconds)
  if (currentMillis - lastSensorUpdate >= 5000) {
    lastSensorUpdate = currentMillis;
    readSensors();
  }

  // 3. Process Flow Sensor and calculate LPM (every 1 second when pump runs)
  if (isPumpRunning && (currentMillis - lastFlowMillis >= 1000)) {
    calculateFlow();
    lastFlowMillis = currentMillis;
  }

  // 4. Send Device Heartbeat / Online logs (every 10 seconds)
  if (currentMillis - lastHeartbeat >= 10000) {
    lastHeartbeat = currentMillis;
    sendHeartbeat();
  }
}

// Read Analog Sensors and update Firebase
void readSensors() {
  int rawADC = analogRead(PIN_MOISTURE);
  // Map raw sensor ADC (e.g. 1023 = fully dry, 300 = fully wet) to 0-100% moisture value
  int percent = map(rawADC, 1023, 300, 0, 100);
  percent = constrain(percent, 0, 100);

  Serial.printf("Soil Moisture Raw: %d, Percentage: %d%%\n", rawADC, percent);

  // Write values to Firebase
  Firebase.setInt(fbDataWrite, "/sensors/raw", rawADC);
  Firebase.setInt(fbDataWrite, "/sensors/moisture", percent);
  Firebase.setDouble(fbDataWrite, "/sensors/updatedAt", getEpochTime());
}

// Calculate water flow metrics
void calculateFlow() {
  // Disable interrupts while reading pulse counts
  noInterrupts();
  uint16_t pulses = pulseCount;
  pulseCount = 0;
  interrupts();

  // Flow rate: liters/min = (pulses / calibrationFactor)
  flowRateLPM = ((float)pulses) / calibrationFactor;
  Serial.printf("Flow Rate: %.2f L/min\n", flowRateLPM);

  Firebase.setFloat(fbDataWrite, "/irrigation/flowRate", flowRateLPM);

  // Calculate elapsed time (runTime) since start
  if (pumpStartTime > 0) {
    unsigned long runTimeSec = (getEpochTime() - pumpStartTime) / 1000;
    Firebase.setInt(fbDataWrite, "/irrigation/runTime", runTimeSec);
  }
}

// Send device status and WiFi telemetry
void sendHeartbeat() {
  bool wifiConnected = (WiFi.status() == WL_CONNECTED);
  long rssi = WiFi.RSSI();
  double timeNow = getEpochTime();

  Firebase.setBool(fbDataWrite, "/device/wifi/connected", wifiConnected);
  Firebase.setString(fbDataWrite, "/device/wifi/ssid", WiFi.SSID());
  Firebase.setInt(fbDataWrite, "/device/wifi/rssi", rssi);
  Firebase.setDouble(fbDataWrite, "/device/wifi/lastSeen", timeNow);
}

// Return timestamp (implement NTP time server sync or fetch from stream)
double getEpochTime() {
  // For simulation, you can fetch epoch via SNTP or Firebase server timestamp
  // ESP8266 configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  return (double)time(nullptr) * 1000.0;
}

// Process Firebase command streams (parse written database fields)
void processStreamData(String json) {
  // Check incoming paths and actuate GPIO pins
  if (json.indexOf("\"/irrigation/motorA\":true") >= 0) {
    digitalWrite(PIN_MOTOR_A, LOW); // Turn Motor A ON (Active Low)
    startPumpTracking();
  } else if (json.indexOf("\"/irrigation/motorA\":false") >= 0) {
    digitalWrite(PIN_MOTOR_A, HIGH); // Turn Motor A OFF
    stopPumpTracking();
  }

  if (json.indexOf("\"/irrigation/motorB\":true") >= 0) {
    digitalWrite(PIN_MOTOR_B, LOW); // Turn Motor B ON
    startPumpTracking();
  } else if (json.indexOf("\"/irrigation/motorB\":false") >= 0) {
    digitalWrite(PIN_MOTOR_B, HIGH); // Turn Motor B OFF
    stopPumpTracking();
  }

  if (json.indexOf("\"/light/status\":true") >= 0) {
    digitalWrite(PIN_LIGHT, LOW); // Turn light ON
  } else if (json.indexOf("\"/light/status\":false") >= 0) {
    digitalWrite(PIN_LIGHT, HIGH); // Turn light OFF
  }
}

void startPumpTracking() {
  if (!isPumpRunning) {
    isPumpRunning = true;
    pumpStartTime = getEpochTime();
    Firebase.setString(fbDataWrite, "/irrigation/status", "watering");
    Firebase.setDouble(fbDataWrite, "/irrigation/pumpStartedAt", pumpStartTime);
  }
}

void stopPumpTracking() {
  // If both motors are now OFF, halt tracking
  if (digitalRead(PIN_MOTOR_A) == HIGH && digitalRead(PIN_MOTOR_B) == HIGH) {
    isPumpRunning = false;
    pumpStartTime = 0;
    flowRateLPM = 0.0;
    Firebase.setString(fbDataWrite, "/irrigation/status", "monitoring");
    Firebase.setFloat(fbDataWrite, "/irrigation/flowRate", 0.0);
  }
}
```
