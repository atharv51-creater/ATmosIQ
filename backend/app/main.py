"""FastAPI app. Run:  uvicorn app.main:app --reload --port 8000   (docs at /docs)"""
from typing import Optional, Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

from .config import Settings
from .store import DataStore, DataNotReady
from .services import RiskService
from . import notify

cfg = Settings()
store = DataStore(cfg.data_dir)
svc = RiskService(store, cfg.default_weights)

app = FastAPI(title="Environmental Risk Intelligence API", version="1.0.0",
              description="Serves pre-computed risk scores, forecasts, explanations and priorities from the ML pipeline.")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=cfg.cors_origins, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(DataNotReady)
async def data_not_ready(_, exc):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


def check_region(region: str):
    if region.lower() not in cfg.regions:
        raise HTTPException(404, f"Unknown region '{region}'. Available: {list(cfg.regions)}")


def parse_h(h):
    try:
        from .services import parse_horizon
        return parse_horizon(h)
    except ValueError as e:
        raise HTTPException(422, str(e))


def weights_from_query(wh, we, wv):
    if wh is None and we is None and wv is None:
        return None
    d = svc.default_weights
    w = {"hazard": d["hazard"] if wh is None else wh, "exposure": d["exposure"] if we is None else we,
         "vulnerability": d["vulnerability"] if wv is None else wv}
    if sum(w.values()) <= 0:
        raise HTTPException(422, "weights must sum to more than 0")
    return w


class WeightsIn(BaseModel):
    hazard: float = Field(0.5, ge=0)
    exposure: float = Field(0.3, ge=0)
    vulnerability: float = Field(0.2, ge=0)
    horizon: int = Field(0, description="0, 24, 48, 72 (hours) or 0..3 (days)")
    top: int = Field(10, ge=1, le=100)

    @model_validator(mode="after")
    def _nonzero(self):
        if self.hazard + self.exposure + self.vulnerability <= 0:
            raise ValueError("weights must sum to more than 0")
        return self


class NotifyIn(BaseModel):
    channel: Literal["telegram", "email"] = "telegram"
    min_level: Literal["watch", "warning", "critical"] = "warning"
    dry_run: bool = Field(False, description="Return the message text without sending")


@app.get("/health", tags=["meta"])
def health():
    ready = all(store.exists(f"zones_h{d}.geojson") for d in range(4))
    out = {"status": "ok" if ready else "no_data", "synthetic_data": store.is_synthetic, "data_dir": str(cfg.data_dir)}
    if ready:
        out["data_date"] = svc.summary().get("data_date")
    return out


@app.get("/regions", tags=["meta"])
def regions():
    return {"regions": list(cfg.regions)}


@app.get("/summary", tags=["meta"])
def summary(region: str = "pune"):
    check_region(region)
    return svc.summary()


@app.get("/zones", tags=["zones"], summary="GeoJSON of zones with risk scores")
def zones(region: str = "pune", horizon: int = Query(0, description="0, 24, 48 or 72 hours ahead"),
          min_class: Optional[Literal["Low", "Moderate", "High", "Critical"]] = None,
          w_hazard: Optional[float] = Query(None, ge=0), w_exposure: Optional[float] = Query(None, ge=0),
          w_vulnerability: Optional[float] = Query(None, ge=0)):
    check_region(region)
    return svc.zones(parse_h(horizon), weights_from_query(w_hazard, w_exposure, w_vulnerability), min_class)


@app.get("/zones/{zone_id}", tags=["zones"], summary="Zone details: score breakdown, drivers, history")
def zone(zone_id: str):
    d = svc.zone_detail(zone_id)
    if d is None:
        raise HTTPException(404, f"Zone '{zone_id}' not found")
    return d


@app.get("/forecast/{zone_id}", tags=["zones"], summary="PM2.5 history + 3-day forecast and risk")
def forecast(zone_id: str):
    d = svc.forecast(zone_id)
    if d is None:
        raise HTTPException(404, f"Zone '{zone_id}' not found")
    return d


@app.get("/priority-queue", tags=["priority"], summary="Zones ranked by risk x population, with recommended actions")
def priority_queue(region: str = "pune", horizon: Optional[int] = Query(None, description="omit = worst of now..+72h"),
                   limit: Optional[int] = Query(None, ge=1, le=500),
                   risk_class: Optional[Literal["Low", "Moderate", "High", "Critical"]] = None,
                   w_hazard: Optional[float] = Query(None, ge=0), w_exposure: Optional[float] = Query(None, ge=0),
                   w_vulnerability: Optional[float] = Query(None, ge=0)):
    check_region(region)
    return svc.priority_queue(None if horizon is None else parse_h(horizon),
                              weights_from_query(w_hazard, w_exposure, w_vulnerability), limit, risk_class)


@app.get("/wind", tags=["map"], summary="Wind vectors per zone (u/v in m/s) for the map overlay")
def wind(region: str = "pune"):
    check_region(region)
    return svc.wind()


@app.post("/weights", tags=["what-if"], summary="Recompute scores/ranking with custom weights")
def weights(body: WeightsIn):
    try:
        return svc.what_if({"hazard": body.hazard, "exposure": body.exposure, "vulnerability": body.vulnerability},
                           body.horizon, body.top)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/alerts", tags=["alerts"])
def alerts(min_level: Literal["watch", "warning", "critical"] = "watch"):
    return svc.alerts(min_level)


@app.post("/alerts/notify", tags=["alerts"], summary="Push current alerts to Telegram or email")
def alerts_notify(body: NotifyIn):
    items = svc.alerts(body.min_level)
    text = svc.format_alert_text(items)
    if body.dry_run:
        return {"sent": False, "count": len(items), "text": text}
    if not items:
        return {"sent": False, "count": 0, "text": text}
    try:
        if body.channel == "telegram":
            if not (cfg.telegram_token and cfg.telegram_chat):
                raise HTTPException(503, "Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)")
            ok = notify.send_telegram(cfg.telegram_token, cfg.telegram_chat, text)
        else:
            if not (cfg.smtp_host and cfg.email_to and cfg.email_from):
                raise HTTPException(503, "Email not configured (SMTP_HOST / ALERT_EMAIL_FROM / ALERT_EMAIL_TO)")
            ok = notify.send_email(cfg, "Environmental risk alerts", text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Delivery failed: {e}")
    return {"sent": bool(ok), "count": len(items), "channel": body.channel}


@app.get("/model/metrics", tags=["model"], summary="Validation metrics (for the validation slide)")
def model_metrics():
    return svc.metrics()


@app.get("/model/shap", tags=["model"], summary="Global feature importance of the forecast model")
def model_shap():
    return svc.shap_global()
