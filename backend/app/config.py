"""
Permission Sentinel - Configuration Module
Stores scoring weights, thresholds, risk bands, and app settings.
All values are configurable and documented.
"""

import os
from pathlib import Path

# === Paths ===
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "app" / "data"
KNOWLEDGE_BASE_DIR = BASE_DIR / "app" / "knowledge_base"
DEMO_DATA_DIR = BASE_DIR / "app" / "demo_data"
UPLOAD_DIR = BASE_DIR / "uploads"
DB_PATH = BASE_DIR / "permission_sentinel.db"

# Ensure directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# === Upload Settings ===
MAX_UPLOAD_SIZE_MB = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "100"))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {".apk", ".xml", ".json", ".csv"}
DELETE_APK_AFTER_PARSE = os.environ.get("DELETE_APK_AFTER_PARSE", "true").lower() == "true"

# === Knowledge Base ===
KNOWLEDGE_BASE_VERSION = "1.0.0"

# === Scoring Weights ===
# Sensitivity tier weights (used for top-3 sensitive permissions)
SENSITIVITY_WEIGHTS = {
    "critical": 35,
    "high": 22,
    "medium": 10,
    "low": 3,
    "unknown": 0,
}

# Scoring caps
SENSITIVITY_CAP = 60
PURPOSE_MISMATCH_PER_PERMISSION = 12
PURPOSE_MISMATCH_CAP = 30
COMBINATION_RULE_SCORE = 8
COMBINATION_RULE_CAP = 16
POLICY_VIOLATION_SCORE = 15
POLICY_VIOLATION_CAP = 30
CONTEXT_AMPLIFIER_MAX = 8

# === Risk Bands ===
RISK_BAND_THRESHOLDS = {
    "Low": (0, 29),
    "Medium": (30, 59),
    "High": (60, 100),
}

def get_risk_band(score: int) -> str:
    """Return risk band label for a given score."""
    for band, (low, high) in RISK_BAND_THRESHOLDS.items():
        if low <= score <= high:
            return band
    return "High"  # Fallback for scores above 100 (shouldn't happen with clamping)

# === Purpose Categories ===
PURPOSE_CATEGORIES = [
    "Calculator / Simple Utility",
    "Notes / Productivity",
    "Maps / Navigation",
    "Messaging / Communication",
    "Camera / Photo Editor",
    "Music / Media Player",
    "Fitness / Activity Tracking",
    "Weather",
    "E-commerce",
    "Browser",
    "Finance / Banking",
    "Game",
    "Other / Unknown",
]

# === CORS ===
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]
