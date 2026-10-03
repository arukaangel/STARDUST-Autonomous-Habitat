# STARDUST — Autonomous Self-Healing Habitat Intelligence

STARDUST is a zero-paid-API research prototype for a future lunar/Martian habitat. It combines a connected digital twin, local machine-learning anomaly detection, root-cause tracing, counterfactual recovery simulation, resource constraints, and a cinematic mission-control interface.

> This is an educational/research prototype, not real flight or life-support software.

## Fastest Windows launch

1. Install **Node.js LTS** and **Python 3.11+** if you do not already have them.
2. Double-click **`SETUP_AND_RUN_WINDOWS.bat`** the first time.
3. Wait while it installs free local dependencies.
4. Two terminal windows stay open: `STARDUST CORE` and `STARDUST WEBSITE`.
5. The site opens at **http://localhost:5173**.
6. Later, use **`RUN_STARDUST_WINDOWS.bat`**.

This uses `npm.cmd`, so the common PowerShell `npm.ps1 / ExecutionPolicy` error is avoided.

## Manual launch

Frontend:

```powershell
npm.cmd install
npm.cmd run dev
```

Backend in a second terminal:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Then open `http://localhost:5173`.

## What is actually implemented

### 1. Connected digital twin
The Python core simulates 13 telemetry channels and cross-system consequences across atmosphere, thermal control, power, water and crew-support infrastructure. Failures modify the simulated system state; the dashboard does not simply swap labels.

### 2. Blind unknown-failure test
`GENERATE UNKNOWN EVENT` randomly selects one of six hidden fault families. The simulator keeps the ground truth separate from the diagnosis engine. The engine receives telemetry only. `REVEAL GROUND TRUTH` lets you compare the prediction with the hidden truth afterward.

Hidden scenarios include:
- Cooling Pump B degradation
- CO2 Scrubber B degradation
- Solar Array C partial failure
- Module C micro-meteoroid hull breach
- CO2 Sensor A drift
- Water recycler membrane fouling

The sensor-drift case exists specifically to test whether STARDUST can distinguish a bad sensor from a real life-support event.

### 3. Local ML anomaly detection
On startup the backend generates correlated nominal habitat telemetry and trains a **scikit-learn Isolation Forest**. Live telemetry is standardized and scored against the learned nominal envelope. No Gemini/OpenAI/paid API is needed.

### 4. Root-cause graph
A causal-signature layer compares the direction and magnitude of cross-sensor deviations and builds a probable source + downstream chain. This is intentionally described as a prototype causal/signature graph rather than claiming to be certified causal inference.

### 5. Counterfactual recovery engine
`SIMULATE 225 FUTURES` tests multiple recovery strategies. Each strategy is run across 45 uncertain 24-hour trajectories, and the interface ranks average habitat stability plus a worst-case percentile. The best strategy can be executed back on the live digital twin.

### 6. Resource + survival invention layer
The interface includes oxygen, water, battery, food, filters, coolant, zero replacement pumps, and a Rover-02 auxiliary pump with a conceptual compatibility path. This demonstrates the idea of sacrificing non-critical hardware to protect a critical habitat system when Earth resupply is unavailable.

### 7. Crew and autonomous reconfiguration
Recovery actions can suspend laboratory load, stop rover charging, disable greenhouse lighting, activate backup pump/scrubber, isolate Module C, or compress the occupied habitat volume.

### 8. Free architecture
- React + Vite — interface
- Python + FastAPI — local core/API
- NumPy — simulation
- scikit-learn — anomaly model
- Lucide React — interface icons
- Original SVG/CSS lunar visual — no stock image dependency

**Cost to run locally: $0. No API key is required.**

## Best demo sequence for judges

1. Open Mission Control and point out `PYTHON + ML ONLINE`.
2. Click **Generate Unknown Event**. Explain that ground truth is sealed from the detector.
3. Use ×5 or ×20 time acceleration and watch the anomaly score/deviations emerge.
4. Show the root-cause chain.
5. Click **Reveal Ground Truth** to validate the diagnosis.
6. Click **Simulate 225 Futures**.
7. Compare recovery strategies and execute the recommended plan on the digital twin.
8. Show Resource Inventory and the Rover-02 pump tradeoff concept.

## Important scientific framing

Say: **“STARDUST is a predictive-safety research prototype tested on a simulated digital twin.”**

Do not claim it is connected to NASA, a real lunar base, or validated flight hardware. The innovation is the end-to-end autonomy loop: hidden-event detection → diagnosis → future simulation → constrained recovery → verification.
