# Permission Sentinel — 3-Minute Hackathon Demo Script 🎬

## Objective
Deliver a compelling, structured live demo highlighting the business problem, local-first privacy architecture, explainable deterministic scoring, and actionable remediation.

---

### Step 1: The Problem Hook (0:00 - 0:45)
> *"Modern Android applications frequently request permissions far beyond their operational purpose—from flashlight apps extracting contacts, to calculators transmitting precise GPS coordinates. Traditional security scanners are either slow cloud-dependent black boxes that leak proprietary APKs or hallucination-prone LLMs. Today, we introduce **Permission Sentinel**: an explainable, local-first Android permission auditor."*

**Action on Screen:**
1. Open the browser to `http://localhost:5173`.
2. Point out the dark-mode dashboard showing KPI cards: **Total Audited Apps**, **High Risk Anomalies**, and **Average Risk Score**.

---

### Step 2: Instant Benchmarking & Explainable Scoring (0:45 - 1:30)
> *"To prove our deterministic engine against ground truth, we've built in 8 synthetic benchmark applications. Let's trigger our automated benchmark suite with one click."*

**Action on Screen:**
1. Click **"Run Demo Benchmarks"**.
2. Watch the dashboard populate in real time with pie charts, risk distributions, and audited app records.
3. Click into **"ShadyCalc"** (`com.suspicious.shadycalc`).
4. Highlight the **Circular Risk Gauge** showing an alarming **85/100 (High Risk)**.
5. Walk through the **Deterministic Score Decomposition** bar:
   - Base Sensitivity: Top 3 dangerous permissions (SMS, Camera, Location) capped at 60 pts.
   - Purpose Mismatch: +12 pts for each permission unexpected for a Calculator.
   - Combination Findings: High-risk correlation detected between **`READ_SMS`** and **`INTERNET`** (data exfiltration vector).

---

### Step 3: Actionable Remediation & Auditor Nuance (1:30 - 2:15)
> *"Security auditing isn't just about sounding alarms—it's about actionable developer remediation."*

**Action on Screen:**
1. Scroll down to the **Permission Findings Breakdown**.
2. Click on `android.permission.READ_CONTACTS`.
3. Expand to show:
   - **Data at Risk**: Contact names, numbers, email addresses.
   - **Actionable Remediation**: *"Remove permission. If sharing features are required, invoke Android's system share sheet without requesting raw contacts access."*
4. Type an auditor note in the **Auditor Notes** section:
   - *"Developer review confirmed contact access is redundant. Scheduled for removal in v1.1.0."*
5. Click **"Save Auditor Notes"** and observe the confirmation badge.

---

### Step 4: Multi-Modal Ingestion & Zero-Trust Policies (2:15 - 3:00)
> *"Let's test organizational policy enforcement. In the Policies tab, enterprise security teams can enforce zero-trust rules."*

**Action on Screen:**
1. Navigate to the **Policies** tab.
2. Toggle on the enterprise policy that blocks all SMS permissions.
3. Navigate to **Analyze App**.
4. Show the 4 ingestion modes: **File Upload** (APK, XML, JSON, CSV), **Benchmark Presets**, **JSON Paste**, and **Manual Form**.
5. Switch to **Privacy & Methodology** to show:
   - 100% offline local-first guarantee (no cloud dependencies).
   - System health status and active knowledge base version.
6. Export the audit as JSON and CSV reports.

---

### Conclusion Pitch
> *"Permission Sentinel transforms opaque permission audits into transparent, actionable, and compliant security workflows—empowering developers and security teams alike without ever leaking proprietary code."*
