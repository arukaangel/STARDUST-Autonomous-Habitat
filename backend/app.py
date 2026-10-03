from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from engine import StardustEngine

app = FastAPI(title="STARDUST Core", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
engine = StardustEngine()

class StepRequest(BaseModel):
    minutes: float = 5

class EventRequest(BaseModel):
    forced: Optional[str] = None

class ActionRequest(BaseModel):
    action: str

@app.get("/api/health")
def health():
    return {"ok": True, "core": "STARDUST", "model": "Isolation Forest + digital twin + causal signature graph"}

@app.get("/api/state")
def state():
    return engine.snapshot()

@app.post("/api/reset")
def reset():
    return engine.reset()

@app.post("/api/step")
def step(req: StepRequest):
    return engine.step(req.minutes)

@app.post("/api/unknown-event")
def unknown_event(req: EventRequest):
    return engine.inject_unknown(req.forced)

@app.post("/api/action")
def action(req: ActionRequest):
    return engine.apply_action(req.action)

@app.post("/api/futures")
def futures():
    return engine.simulate_futures()

@app.get("/api/reveal")
def reveal():
    return engine.reveal()
