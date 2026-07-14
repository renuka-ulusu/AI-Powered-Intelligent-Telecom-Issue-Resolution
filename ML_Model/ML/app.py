from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from predict import predict_issue

# ==========================================================
# FASTAPI INITIALIZATION
# ==========================================================

app = FastAPI(
    title="Telecom AI Assistant API",
    version="1.0",
    description="Predicts Root Cause, Severity and Escalation for Telecom Issues"
)

# ==========================================================
# ENABLE CORS
# ==========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Change this to your React URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================================
# INPUT SCHEMA
# ==========================================================

class TelecomRequest(BaseModel):

    SIM_Provider: str
    City_Type: str
    Network_Type: str
    Customer_Issue: str
    Signal_Strength: str
    Tower_Load: str
    Weather: str
    Previous_Complaints: int


# ==========================================================
# HOME ENDPOINT
# ==========================================================

@app.get("/")
def home():

    return {
        "Project": "Telecom AI Dashboard",
        "Status": "Running",
        "Version": "1.0"
    }


# ==========================================================
# HEALTH CHECK
# ==========================================================

@app.get("/health")
def health():

    return {
        "status": "Healthy"
    }


# ==========================================================
# PREDICTION ENDPOINT
# ==========================================================

@app.post("/predict")
def predict(data: TelecomRequest):

    result = predict_issue(data.dict())

    return result