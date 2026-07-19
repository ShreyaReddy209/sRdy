import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .insights import mood_usage_insight
from .predictor import model_ready, predict
from .schemas import PredictRequest, PredictResponse

app = FastAPI(title="WellSense API", version="1.0.0")

# Extra origins (e.g. a custom domain) can be added without a code change via
# the ALLOWED_ORIGINS env var: a comma-separated list of full origins.
_extra_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_extra_origins,
    # Matches any localhost dev port (Vite picks the next free one) and any
    # Vercel deployment (production + every preview URL, which are all *.vercel.app).
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+|https://[a-zA-Z0-9-]+\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model_ready()}


@app.get("/insights")
def insights():
    return {"mood_usage": mood_usage_insight()}


@app.post("/predict", response_model=PredictResponse)
def predict_endpoint(req: PredictRequest):
    if not model_ready():
        raise HTTPException(
            status_code=503,
            detail="Model not trained. Run: python ml/train_lstm.py",
        )
    try:
        return predict(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
