# Permission Sentinel 🛡️
> **Intelligent, Explainable Android Application Permission Auditor**  
> *Local-First Security Assessment for Hackathons, Enterprise Zero-Trust, and App Review.*

---

## 🌟 Overview

**Permission Sentinel** is a production-grade, local-first security tool designed to identify excessive and suspicious permissions in Android applications. By comparing an app's declared operational purpose against the permissions requested in its `AndroidManifest.xml`, APK binary, or permission reports, it calculates a **transparent, deterministic risk score (0–100)** and flags dangerous permission combinations and enterprise policy infringements.

### Key Pillars
- 🔒 **100% Local-First & Confidential**: Zero telemetry, zero external cloud dependencies. APK binaries and proprietary manifests never leave your local environment.
- 📐 **Deterministic & Explainable Scoring**: Avoids unpredictable LLM hallucinations. Transparent scoring formulas decompose into Base Sensitivity, Purpose Mismatch, Dangerous Combination Rules, and Policy Violations.
- ⚡ **Multi-Modal Ingestion**: Ingest via APK binary parsing (with Androguard), Manifest XML, JSON reports, CSV exports, or interactive manual form.
- 🎯 **8 Ground-Truth Benchmarks**: Built-in synthetic test fixtures ranging from minimal calculators to covert surveillance utilities.
- 🏢 **Organizational Security Policies**: Define custom zero-trust rules, blocked permissions (e.g. SMS/Call logs), and enterprise risk thresholds.

---

## 🏗️ Architecture

```
permission-sentinel/
├── backend/                       # Python FastAPI Backend
│   ├── app/
│   │   ├── config.py              # Scoring parameters, risk bands, purpose categories
│   │   ├── database.py            # SQLite local persistence layer & migrations
│   │   ├── models.py              # Pydantic validation schemas
│   │   ├── knowledge_base/        # Curated security knowledge base (JSON)
│   │   ├── parsers/               # APK, AndroidManifest.xml, JSON, & CSV parsers
│   │   ├── engine/                # Deterministic analyzer & combination rule engine
│   │   ├── routes/                # FastAPI REST endpoints
│   │   └── demo_data/             # 8 synthetic benchmark applications
│   ├── tests/                     # Automated pytest suite (Analyzer & API integration)
│   └── requirements.txt
│
└── frontend/                      # React + TypeScript + Vite + Tailwind CSS
    ├── src/
    │   ├── components/            # ScoreGauge, Badges (Risk, Status, Severity)
    │   ├── pages/                 # Dashboard, Analyze, AppDetail, Policies, Privacy
    │   ├── services/              # Axios/Fetch typed API client
    │   ├── types/                 # TypeScript data contracts
    │   └── index.css              # Custom dark-mode design system & animations
    ├── vite.config.ts
    └── package.json
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Start the Backend Server

```bash
cd backend

# (Optional) Activate virtual environment
# python -m venv venv && source venv/bin/activate  # Or .\venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt
pip install httpx  # For tests and client

# Launch FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will be live at `http://localhost:8000`. Interactive Swagger documentation is available at `http://localhost:8000/docs`.

### 2. Start the Frontend Application

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📊 Transparent Scoring Methodology

The overall risk score (clamped between 0 and 100) is deterministically computed from 5 components:

$$Risk\ Score = \min(100, Sensitivity + Mismatch + Combinations + Policies + Amplifier)$$

| Component | Weighting | Cap | Description |
| :--- | :--- | :--- | :--- |
| **Sensitivity** | Top 3 permission weights (Critical=35, High=22, Med=10, Low=3) | 60 pts | Captures inherent risk of APIs (SMS, Location, Mic, Camera) |
| **Purpose Mismatch** | +12 points per unexpected permission | 30 pts | Flags permissions unnecessary for the declared purpose |
| **Combinations** | +8 points per triggered correlation rule | 16 pts | Synergistic threats (e.g. Mic + Foreground Service, SMS + Internet) |
| **Policy Violations**| +15 points per configured policy infraction | 30 pts | Flags organizational zero-trust violations |
| **Context Amplifier**| Up to +8 points | 8 pts | Persistent background services combined with sensitive APIs |

### Risk Bands
- 🟢 **Low Risk (0–29)**: Compliant, expected permissions for the declared category.
- 🟡 **Medium Risk (30–59)**: Context-dependent permissions requiring explicit justification.
- 🔴 **High Risk (60–100)**: Excessive permissions, dangerous multi-permission combos, or policy violations.

---

## 🧪 Running Automated Tests & Benchmark Evaluation

### Backend Pytest Suite (11/11 Passing)
```bash
cd backend
python -m pytest tests -v
```

### Ground-Truth Benchmark Evaluation Script (100% Accuracy)
```bash
cd backend
python evaluate.py
```
Outputs accuracy, precision, recall, and score boundaries against the 8 synthetic benchmarks.

### Frontend Build Validation
```bash
cd frontend
npm run build
```

---

## ⚡ One-Click Startup Scripts (Windows)

- `run_backend.bat`: Launches FastAPI dev server on port 8000
- `run_frontend.bat`: Launches Vite React frontend on port 5173
- `run_tests.bat`: Runs pytest automated test suite
- `run_evaluation.bat`: Runs ground-truth benchmark evaluation

---

## 📂 Sample Ingestion Fixtures (`sample_fixtures/`)

To test the drag-and-drop file ingestion in the UI (`/analyze`):
- `shady_calc_manifest.xml`: Malicious calculator AndroidManifest.xml (Scores ~90 High Risk)
- `clean_torch_manifest.xml`: Benign flashlight AndroidManifest.xml (Scores 0 Low Risk)
- `photo_editor_report.json`: JSON permission report with camera & SMS permissions
- `permissions_report.csv`: CSV permission export for navigation tracking

---

## 📋 Evaluation Benchmarks

Permission Sentinel includes 8 synthetic benchmark applications to evaluate detection performance:
1. **SimpleCalc**: Minimal calculator requiring 0 permissions (Ground Truth: Low Risk [0-5 pts], Result: 0 pts ✅).
2. **QuickNotes**: Local note-taking app with file export (Ground Truth: Low Risk [0-29 pts], Result: 8 pts ✅).
3. **NaviMaps**: GPS navigation with background location (Ground Truth: Low Risk [0-29 pts], Result: 0 pts ✅).
4. **ChatConnect**: Messaging app with video/audio calling (Ground Truth: Low Risk [0-29 pts], Result: 0 pts ✅).
5. **FitTrack**: Fitness wearable tracker (Ground Truth: Low Risk [0-29 pts], Result: 0 pts ✅).
6. **SnapEdit Pro**: Photo editor requesting SMS and Contacts (Ground Truth: Medium Risk [30-59 pts], Result: 52 pts ✅).
7. **WeatherNow**: Weather app requesting Audio and SMS (Ground Truth: Medium Risk [30-59 pts], Result: 48 pts ✅).
8. **ShadyCalc**: Calculator requesting SMS, Contacts, Location, Camera, Audio (Ground Truth: High Risk [60-100 pts], Result: 90 pts ✅).

