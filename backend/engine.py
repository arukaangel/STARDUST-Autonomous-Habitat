"""STARDUST simulation + ML core.

This is a deliberately simplified research prototype, not flight software.
The important distinction from a scripted dashboard is that failures alter a
connected digital twin; the anomaly model only sees telemetry, while the hidden
fault is kept separately for later reveal/verification.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional
import math
import random
import time

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "oxygen_pct", "co2_pct", "pressure_kpa", "temperature_c",
    "battery_pct", "solar_kw", "power_load_kw", "airflow_pct",
    "scrubber_eff_pct", "coolant_pressure_kpa", "pump_current_a",
    "water_pct", "humidity_pct"
]

FAILURES = {
    "cooling_pump": {
        "label": "Cooling Pump B degradation",
        "component": "THERMAL / PUMP B",
        "signature": {"coolant_pressure_kpa": -2.2, "pump_current_a": 3.1, "temperature_c": 2.5, "power_load_kw": 2.2},
    },
    "scrubber": {
        "label": "CO2 Scrubber B degradation",
        "component": "LIFE SUPPORT / SCRUBBER B",
        "signature": {"scrubber_eff_pct": -24, "co2_pct": 0.35, "airflow_pct": -6, "power_load_kw": 1.2},
    },
    "solar": {
        "label": "Solar Array C partial failure",
        "component": "POWER / ARRAY C",
        "signature": {"solar_kw": -19, "battery_pct": -10, "power_load_kw": 0.8},
    },
    "hull_leak": {
        "label": "Module C micro-meteoroid hull breach",
        "component": "HABITAT / MODULE C",
        "signature": {"pressure_kpa": -7.5, "oxygen_pct": -0.65, "humidity_pct": -5},
    },
    "co2_sensor": {
        "label": "CO2 Sensor A drift",
        "component": "SENSORS / CO2-A",
        "signature": {"co2_pct": 0.65},
    },
    "water_recycler": {
        "label": "Water recycler membrane fouling",
        "component": "WATER / RECYCLER A",
        "signature": {"water_pct": -7, "power_load_kw": 1.1, "humidity_pct": 3},
    },
}

CAUSE_GRAPH = {
    "cooling_pump": ["coolant pressure", "thermal control", "power demand", "life-support efficiency"],
    "scrubber": ["scrubber efficiency", "CO2 removal", "cabin CO2", "crew exposure"],
    "solar": ["solar generation", "battery reserve", "power shedding", "life-support margin"],
    "hull_leak": ["module pressure", "oxygen inventory", "bulkhead isolation", "habitable volume"],
    "co2_sensor": ["sensor disagreement", "telemetry confidence", "alarm validation"],
    "water_recycler": ["recovery efficiency", "water reserve", "humidity control", "crew reserve"],
}

@dataclass
class TwinState:
    oxygen_pct: float = 20.82
    co2_pct: float = 0.41
    pressure_kpa: float = 101.2
    temperature_c: float = 21.7
    battery_pct: float = 84.0
    solar_kw: float = 72.0
    power_load_kw: float = 49.0
    airflow_pct: float = 96.0
    scrubber_eff_pct: float = 97.0
    coolant_pressure_kpa: float = 4.8
    pump_current_a: float = 8.2
    water_pct: float = 93.0
    humidity_pct: float = 44.0
    crew: int = 6
    lab_online: bool = True
    greenhouse_online: bool = True
    rover_charging: bool = True
    backup_pump: bool = False
    backup_scrubber: bool = False
    module_c_isolated: bool = False
    habitat_compressed: bool = False
    spare_filters: int = 2
    spare_pumps: int = 0
    coolant_l: float = 31.0
    food_days: float = 27.0
    elapsed_min: float = 0.0


class StardustEngine:
    def __init__(self, seed: int = 184):
        self.rng = random.Random(seed)
        self.np_rng = np.random.default_rng(seed)
        self.scaler = StandardScaler()
        self.model = IsolationForest(n_estimators=220, contamination=0.035, random_state=seed)
        self._fit_nominal_model()
        self.reset()

    def _fit_nominal_model(self):
        rows = []
        for _ in range(4500):
            # Correlated normal-operation telemetry rather than independent random values.
            crew_load = self.np_rng.normal(0, 0.45)
            solar = self.np_rng.normal(72, 3.2)
            temp = self.np_rng.normal(21.7, 0.28) + crew_load * 0.06
            power = self.np_rng.normal(49, 1.8) + crew_load * 0.7
            battery = self.np_rng.normal(84, 2.0) + (solar - power - 23) * 0.12
            row = [
                self.np_rng.normal(20.82, .035),
                self.np_rng.normal(.41, .025) + crew_load * .006,
                self.np_rng.normal(101.2, .22), temp, battery, solar, power,
                self.np_rng.normal(96, .9), self.np_rng.normal(97, 1.1),
                self.np_rng.normal(4.8, .11), self.np_rng.normal(8.2, .28),
                self.np_rng.normal(93, .55), self.np_rng.normal(44, 1.4)
            ]
            rows.append(row)
        X = np.array(rows)
        Xs = self.scaler.fit_transform(X)
        self.model.fit(Xs)
        self.nominal_mean = X.mean(axis=0)
        self.nominal_std = X.std(axis=0) + 1e-6

    def reset(self):
        self.state = TwinState()
        self.hidden_failure: Optional[str] = None
        self.failure_severity = 0.0
        self.history: List[Dict] = []
        self.last_analysis = self.analyze()
        self.event_log = [{"t": 0, "type": "system", "message": "Digital twin initialized. All systems nominal."}]
        return self.snapshot()

    def inject_unknown(self, forced: Optional[str] = None):
        self.hidden_failure = forced if forced in FAILURES else self.rng.choice(list(FAILURES.keys()))
        self.failure_severity = 0.03
        self.event_log.append({"t": round(self.state.elapsed_min,1), "type": "hidden", "message": "Unknown disturbance introduced. Diagnosis engine is blind to ground truth."})
        return {"ok": True, "message": "Unknown event injected. Ground truth remains sealed."}

    def _noise(self, s: float) -> float:
        return self.rng.gauss(0, s)

    def step(self, minutes: float = 5.0, analyze: bool = True):
        s = self.state
        dt = max(0.5, min(minutes, 60.0)) / 5.0
        s.elapsed_min += minutes
        if self.hidden_failure:
            self.failure_severity = min(1.0, self.failure_severity + 0.014 * dt)
        sev = self.failure_severity

        # Baseline interconnected habitat dynamics.
        target_load = 49.0
        if not s.lab_online: target_load -= 7.2
        if not s.greenhouse_online: target_load -= 5.4
        if not s.rover_charging: target_load -= 4.1
        if s.backup_pump: target_load += 1.4
        if s.backup_scrubber: target_load += 1.1
        if s.habitat_compressed: target_load -= 3.2
        s.power_load_kw += (target_load - s.power_load_kw) * 0.18 + self._noise(.12)
        s.solar_kw += (72.0 - s.solar_kw) * 0.08 + self._noise(.22)

        # Failure physics. The detector never reads hidden_failure directly.
        if self.hidden_failure == "cooling_pump":
            if s.backup_pump:
                sev *= .18
            s.coolant_pressure_kpa -= .052 * sev * dt
            s.pump_current_a += .085 * sev * dt
            s.temperature_c += .060 * sev * dt
            s.power_load_kw += .045 * sev * dt
        elif self.hidden_failure == "scrubber":
            if s.backup_scrubber:
                sev *= .14
            s.scrubber_eff_pct -= .36 * sev * dt
            s.airflow_pct -= .08 * sev * dt
            s.co2_pct += .0068 * sev * dt * (0.72 if s.habitat_compressed else 1.0)
            s.power_load_kw += .028 * sev * dt
        elif self.hidden_failure == "solar":
            s.solar_kw -= .48 * sev * dt
        elif self.hidden_failure == "hull_leak":
            if not s.module_c_isolated:
                s.pressure_kpa -= .14 * sev * dt
                s.oxygen_pct -= .008 * sev * dt
            else:
                sev *= .05
        elif self.hidden_failure == "co2_sensor":
            # A sensor fault changes only the observed CO2 channel; correlated systems stay normal.
            s.co2_pct += .010 * sev * dt
        elif self.hidden_failure == "water_recycler":
            s.water_pct -= .052 * sev * dt
            s.humidity_pct += .035 * sev * dt
            s.power_load_kw += .025 * sev * dt

        # Cross-system consequences.
        energy_delta = (s.solar_kw - s.power_load_kw - 20.0) * 0.010 * dt
        s.battery_pct += energy_delta
        thermal_load = max(0.0, s.power_load_kw - 49.0)
        s.temperature_c += thermal_load * .0016 * dt
        if s.temperature_c > 24.5:
            s.scrubber_eff_pct -= (s.temperature_c - 24.5) * .006 * dt
        if s.scrubber_eff_pct < 88 and self.hidden_failure != "co2_sensor":
            s.co2_pct += (88 - s.scrubber_eff_pct) * .00012 * dt
        if s.pressure_kpa < 98:
            s.oxygen_pct -= (98 - s.pressure_kpa) * .00018 * dt

        # Gentle regulation + sensor noise.
        s.oxygen_pct += (20.82 - s.oxygen_pct) * .025 + self._noise(.004)
        if self.hidden_failure != "co2_sensor":
            s.co2_pct += (.41 - s.co2_pct) * .018 + self._noise(.002)
        s.temperature_c += (21.7 - s.temperature_c) * (.025 if not s.backup_pump else .09) + self._noise(.015)
        s.pressure_kpa += (101.2 - s.pressure_kpa) * (.012 if not s.module_c_isolated else .05) + self._noise(.012)
        s.airflow_pct += (96 - s.airflow_pct) * .03 + self._noise(.05)
        s.scrubber_eff_pct += (97 - s.scrubber_eff_pct) * (.018 if not s.backup_scrubber else .08) + self._noise(.04)
        s.coolant_pressure_kpa += (4.8 - s.coolant_pressure_kpa) * (.025 if not s.backup_pump else .10) + self._noise(.008)
        s.pump_current_a += (8.2 - s.pump_current_a) * .025 + self._noise(.018)
        s.humidity_pct += (44 - s.humidity_pct) * .025 + self._noise(.06)

        # Bounds.
        for key, lo, hi in [
            ("oxygen_pct",17,22),("co2_pct",.25,3.5),("pressure_kpa",70,103),
            ("temperature_c",15,38),("battery_pct",0,100),("solar_kw",0,80),
            ("power_load_kw",25,75),("airflow_pct",45,100),("scrubber_eff_pct",35,100),
            ("coolant_pressure_kpa",1.2,5.2),("pump_current_a",5,18),("water_pct",0,100),("humidity_pct",20,75)
        ]:
            setattr(s, key, max(lo, min(hi, getattr(s, key))))

        if analyze:
            self.last_analysis = self.analyze()
        snap = self.snapshot()
        self.history.append(snap)
        self.history = self.history[-120:]
        return snap

    def vector(self, state: Optional[TwinState] = None):
        d = asdict(state or self.state)
        return np.array([d[k] for k in FEATURES], dtype=float)

    def analyze(self):
        x = self.vector()
        xs = self.scaler.transform([x])
        raw = float(self.model.decision_function(xs)[0])
        pred = int(self.model.predict(xs)[0])
        z = np.abs((x - self.nominal_mean) / self.nominal_std)
        deviations = sorted(zip(FEATURES, z.tolist()), key=lambda t: t[1], reverse=True)
        anomaly = max(0.0, min(100.0, 48 - raw * 170 + max(0, deviations[0][1]-2)*6))
        if pred == -1:
            anomaly = max(anomaly, 55)

        candidates = []
        for key, meta in FAILURES.items():
            score = 0.0
            signed = (x - self.nominal_mean) / self.nominal_std
            for feat, effect in meta["signature"].items():
                i = FEATURES.index(feat)
                direction = 1 if effect > 0 else -1
                score += max(0.0, signed[i] * direction) * min(2.5, abs(effect))
            # Sensor fault bonus when CO2 is inconsistent with scrubber/airflow.
            if key == "co2_sensor":
                i_co2, i_eff, i_air = FEATURES.index("co2_pct"), FEATURES.index("scrubber_eff_pct"), FEATURES.index("airflow_pct")
                if signed[i_co2] > 2 and abs(signed[i_eff]) < 1.2 and abs(signed[i_air]) < 1.2:
                    score += 5.5
            candidates.append((key, score))
        candidates.sort(key=lambda x: x[1], reverse=True)
        best_key, best_score = candidates[0]
        second = candidates[1][1]
        confidence = 48 + min(48, max(0, best_score - second) * 7 + best_score * 2.2)
        if anomaly < 32:
            best_key = None
            confidence = 98 - anomaly * .25

        critical_minutes = self._estimate_critical_minutes(best_key)
        return {
            "anomaly_score": round(anomaly, 1),
            "status": "ANOMALY" if anomaly >= 55 else ("WATCH" if anomaly >= 32 else "NOMINAL"),
            "root_cause_key": best_key,
            "root_cause": FAILURES[best_key]["label"] if best_key else "No active anomaly",
            "component": FAILURES[best_key]["component"] if best_key else "—",
            "confidence": round(confidence, 1),
            "critical_in_min": critical_minutes,
            "top_deviations": [{"feature": f, "sigma": round(v,1)} for f,v in deviations[:4]],
            "cause_chain": CAUSE_GRAPH.get(best_key, ["telemetry", "nominal envelope"]),
            "model": "Isolation Forest + causal signature graph",
        }

    def _estimate_critical_minutes(self, cause: Optional[str]):
        if not cause: return None
        base = {"cooling_pump": 390, "scrubber": 340, "solar": 610, "hull_leak": 95, "co2_sensor": None, "water_recycler": 980}.get(cause)
        if base is None: return None
        return max(18, int(base * (1.05 - self.failure_severity * .82)))

    def apply_action(self, action: str):
        s = self.state
        messages = {
            "backup_pump": "Backup Pump A activated; thermal load rerouted.",
            "backup_scrubber": "Backup scrubber activated; airflow rerouted.",
            "suspend_lab": "Laboratory load suspended; 7.2 kW released.",
            "isolate_module_c": "Module C bulkheads closed and ventilation isolated.",
            "compress_habitat": "Crew consolidated into primary modules; habitable volume reduced.",
            "disable_greenhouse": "Greenhouse lighting suspended; 5.4 kW released.",
            "stop_rover_charging": "Rover charging paused; 4.1 kW released.",
        }
        if action == "backup_pump": s.backup_pump = True
        elif action == "backup_scrubber": s.backup_scrubber = True
        elif action == "suspend_lab": s.lab_online = False
        elif action == "isolate_module_c": s.module_c_isolated = True
        elif action == "compress_habitat": s.habitat_compressed = True
        elif action == "disable_greenhouse": s.greenhouse_online = False
        elif action == "stop_rover_charging": s.rover_charging = False
        else: return {"ok": False, "message": "Unknown action"}
        msg = messages[action]
        self.event_log.append({"t": round(s.elapsed_min,1), "type": "action", "message": msg})
        return {"ok": True, "message": msg, "snapshot": self.snapshot()}

    def _stability(self, s: TwinState) -> float:
        penalties = [
            max(0, abs(s.oxygen_pct-20.82)-.25)*18,
            max(0, s.co2_pct-.65)*32,
            max(0, 96-s.pressure_kpa)*2.4,
            max(0, s.temperature_c-24.5)*4.2,
            max(0, 35-s.battery_pct)*1.5,
            max(0, 80-s.airflow_pct)*1.2,
            max(0, 82-s.scrubber_eff_pct)*1.0,
            max(0, 3.5-s.coolant_pressure_kpa)*7,
            max(0, 45-s.water_pct)*.8,
        ]
        return max(0.0, min(100.0, 100 - sum(penalties)))

    def _simulate_strategy(self, actions: List[str], samples: int = 45, hours: int = 24):
        outcomes = []
        original = deepcopy(self)
        for i in range(samples):
            sim = deepcopy(original)
            sim.rng = random.Random(5000 + i * 17 + int(self.state.elapsed_min))
            for a in actions:
                sim.apply_action(a)
            for _ in range(hours * 2):
                sim.step(30, analyze=False)
            outcomes.append(sim._stability(sim.state))
        return float(np.mean(outcomes)), float(np.percentile(outcomes, 10))

    def simulate_futures(self):
        cause = self.last_analysis.get("root_cause_key")
        strategies = {
            "No intervention": [],
            "Suspend laboratory load": ["suspend_lab"],
            "Power conservation": ["suspend_lab", "stop_rover_charging"],
            "Habitat compression": ["compress_habitat", "suspend_lab"],
        }
        if cause == "cooling_pump": strategies["Backup Pump A + lab offline"] = ["backup_pump", "suspend_lab"]
        elif cause == "scrubber": strategies["Backup scrubber + compressed habitat"] = ["backup_scrubber", "compress_habitat"]
        elif cause == "solar": strategies["Emergency load shedding"] = ["suspend_lab", "disable_greenhouse", "stop_rover_charging"]
        elif cause == "hull_leak": strategies["Isolate Module C + compress habitat"] = ["isolate_module_c", "compress_habitat"]
        elif cause == "water_recycler": strategies["Conserve power + compress habitat"] = ["suspend_lab", "compress_habitat"]
        elif cause == "co2_sensor": strategies["Validate sensor; no life-support shutdown"] = []
        else: strategies["Conservative reserve mode"] = ["stop_rover_charging"]

        results = []
        for name, actions in strategies.items():
            mean, p10 = self._simulate_strategy(actions)
            results.append({"strategy": name, "actions": actions, "stability": round(mean,1), "worst_case": round(p10,1)})
        results.sort(key=lambda x: x["stability"], reverse=True)
        total = len(strategies) * 45
        return {"futures_simulated": total, "horizon_hours": 24, "results": results, "recommended": results[0]}

    def reveal(self):
        if not self.hidden_failure:
            return {"truth": None, "correct": None, "message": "No hidden event is active."}
        predicted = self.last_analysis.get("root_cause_key")
        return {
            "truth": FAILURES[self.hidden_failure]["label"],
            "truth_key": self.hidden_failure,
            "predicted": FAILURES[predicted]["label"] if predicted else "No diagnosis yet",
            "correct": predicted == self.hidden_failure,
            "message": "Ground truth unsealed for validation."
        }

    def inventory(self):
        s = self.state
        return [
            {"name":"Oxygen reserve","value":"142 kg","status":"nominal"},
            {"name":"Water reserve","value":f"{round(784*s.water_pct/93)} L","status":"nominal" if s.water_pct>55 else "watch"},
            {"name":"Battery","value":f"{s.battery_pct:.0f}%","status":"nominal" if s.battery_pct>40 else "watch"},
            {"name":"Food","value":f"{s.food_days:.0f} days","status":"nominal"},
            {"name":"Spare filters","value":str(s.spare_filters),"status":"nominal"},
            {"name":"Replacement pumps","value":str(s.spare_pumps),"status":"critical"},
            {"name":"Coolant","value":f"{s.coolant_l:.0f} L","status":"nominal"},
            {"name":"Rover-02 aux pump","value":"83% compatible","status":"opportunity"},
        ]

    def snapshot(self):
        telemetry = {k: round(getattr(self.state, k), 3) for k in FEATURES}
        return {
            "telemetry": telemetry,
            "state": asdict(self.state),
            "analysis": self.last_analysis,
            "inventory": self.inventory(),
            "hidden_event_active": self.hidden_failure is not None,
            "event_log": self.event_log[-8:],
            "timestamp": time.time(),
        }
