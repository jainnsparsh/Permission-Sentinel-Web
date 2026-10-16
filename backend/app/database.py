"""
Permission Sentinel - Database Module
SQLite setup with tables for analyses, findings, policies, and combination findings.
"""

import sqlite3
import json
from pathlib import Path
from app.config import DB_PATH


def get_db():
    """Get a database connection with row factory."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize database schema."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS app_analyses (
            id TEXT PRIMARY KEY,
            package_name TEXT,
            app_name TEXT,
            version TEXT,
            target_sdk TEXT,
            selected_purpose TEXT NOT NULL,
            purpose_source TEXT NOT NULL DEFAULT 'user-selected',
            input_source TEXT NOT NULL,
            created_at TEXT NOT NULL,
            knowledge_base_version TEXT NOT NULL,
            score INTEGER NOT NULL DEFAULT 0,
            risk_band TEXT NOT NULL DEFAULT 'Low',
            score_breakdown TEXT NOT NULL DEFAULT '{}',
            permissions_raw TEXT NOT NULL DEFAULT '[]',
            user_notes TEXT DEFAULT '',
            metadata_json TEXT DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS permission_findings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id TEXT NOT NULL,
            permission TEXT NOT NULL,
            label TEXT NOT NULL,
            status TEXT NOT NULL,
            severity TEXT NOT NULL,
            base_weight INTEGER NOT NULL DEFAULT 0,
            reason TEXT NOT NULL,
            evidence_rule_ids TEXT NOT NULL DEFAULT '[]',
            confidence TEXT NOT NULL DEFAULT 'heuristic',
            recommendation TEXT NOT NULL DEFAULT '',
            data_exposed TEXT DEFAULT '',
            caveat TEXT DEFAULT '',
            FOREIGN KEY (analysis_id) REFERENCES app_analyses(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS combination_findings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            matched_permissions TEXT NOT NULL DEFAULT '[]',
            explanation TEXT NOT NULL,
            confidence TEXT NOT NULL DEFAULT 'heuristic',
            recommendation TEXT NOT NULL DEFAULT '',
            severity TEXT NOT NULL DEFAULT 'medium',
            FOREIGN KEY (analysis_id) REFERENCES app_analyses(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS policies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            policy_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_findings_analysis ON permission_findings(analysis_id);
        CREATE INDEX IF NOT EXISTS idx_combo_analysis ON combination_findings(analysis_id);
        CREATE INDEX IF NOT EXISTS idx_analyses_score ON app_analyses(score);
    """)

    conn.commit()
    conn.close()


def save_analysis(analysis: dict):
    """Save a complete analysis result to the database."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT OR REPLACE INTO app_analyses 
        (id, package_name, app_name, version, target_sdk, selected_purpose, 
         purpose_source, input_source, created_at, knowledge_base_version,
         score, risk_band, score_breakdown, permissions_raw, user_notes, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        analysis["id"],
        analysis.get("package_name", ""),
        analysis.get("app_name", "Unknown App"),
        analysis.get("version", ""),
        analysis.get("target_sdk", ""),
        analysis["selected_purpose"],
        analysis.get("purpose_source", "user-selected"),
        analysis["input_source"],
        analysis["created_at"],
        analysis["knowledge_base_version"],
        analysis["score"],
        analysis["risk_band"],
        json.dumps(analysis.get("score_breakdown", {})),
        json.dumps(analysis.get("permissions", [])),
        analysis.get("user_notes", ""),
        json.dumps(analysis.get("metadata", {})),
    ))

    # Save permission findings
    for finding in analysis.get("permission_findings", []):
        cursor.execute("""
            INSERT INTO permission_findings 
            (analysis_id, permission, label, status, severity, base_weight,
             reason, evidence_rule_ids, confidence, recommendation, data_exposed, caveat)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            analysis["id"],
            finding["permission"],
            finding.get("label", finding["permission"]),
            finding["status"],
            finding["severity"],
            finding.get("base_weight", 0),
            finding["reason"],
            json.dumps(finding.get("evidence_rule_ids", [])),
            finding.get("confidence", "heuristic"),
            finding.get("recommendation", ""),
            finding.get("data_exposed", ""),
            finding.get("caveat", ""),
        ))

    # Save combination findings
    for combo in analysis.get("combination_findings", []):
        cursor.execute("""
            INSERT INTO combination_findings
            (analysis_id, rule_id, matched_permissions, explanation, confidence, recommendation, severity)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            analysis["id"],
            combo["rule_id"],
            json.dumps(combo["matched_permissions"]),
            combo["explanation"],
            combo.get("confidence", "heuristic"),
            combo.get("recommendation", ""),
            combo.get("severity", "medium"),
        ))

    conn.commit()
    conn.close()


def get_all_analyses():
    """Retrieve all analyses as list of dicts."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM app_analyses ORDER BY created_at DESC")
    rows = cursor.fetchall()
    result = []
    for row in rows:
        d = dict(row)
        d["score_breakdown"] = json.loads(d["score_breakdown"])
        d["permissions_raw"] = json.loads(d["permissions_raw"])
        d["metadata_json"] = json.loads(d.get("metadata_json", "{}"))
        # Count findings
        cursor.execute("SELECT COUNT(*) as cnt FROM permission_findings WHERE analysis_id = ?", (d["id"],))
        d["finding_count"] = cursor.fetchone()["cnt"]
        cursor.execute("SELECT COUNT(*) as cnt FROM combination_findings WHERE analysis_id = ?", (d["id"],))
        d["combination_finding_count"] = cursor.fetchone()["cnt"]
        # Count by status
        cursor.execute("""
            SELECT status, COUNT(*) as cnt FROM permission_findings 
            WHERE analysis_id = ? GROUP BY status
        """, (d["id"],))
        d["status_counts"] = {r["status"]: r["cnt"] for r in cursor.fetchall()}
        result.append(d)
    conn.close()
    return result


def get_analysis_detail(analysis_id: str):
    """Retrieve a single analysis with all findings."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM app_analyses WHERE id = ?", (analysis_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    d = dict(row)
    d["score_breakdown"] = json.loads(d["score_breakdown"])
    d["permissions_raw"] = json.loads(d["permissions_raw"])
    d["metadata_json"] = json.loads(d.get("metadata_json", "{}"))

    cursor.execute("SELECT * FROM permission_findings WHERE analysis_id = ? ORDER BY base_weight DESC", (analysis_id,))
    d["permission_findings"] = []
    for r in cursor.fetchall():
        f = dict(r)
        f["evidence_rule_ids"] = json.loads(f["evidence_rule_ids"])
        d["permission_findings"].append(f)

    cursor.execute("SELECT * FROM combination_findings WHERE analysis_id = ?", (analysis_id,))
    d["combination_findings"] = []
    for r in cursor.fetchall():
        f = dict(r)
        f["matched_permissions"] = json.loads(f["matched_permissions"])
        d["combination_findings"].append(f)

    # Status counts
    cursor.execute("""
        SELECT status, COUNT(*) as cnt FROM permission_findings 
        WHERE analysis_id = ? GROUP BY status
    """, (analysis_id,))
    d["status_counts"] = {r["status"]: r["cnt"] for r in cursor.fetchall()}

    conn.close()
    return d


def delete_analysis(analysis_id: str) -> bool:
    """Delete an analysis and its findings."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM app_analyses WHERE id = ?", (analysis_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def delete_all_analyses():
    """Delete all analyses."""
    conn = get_db()
    conn.execute("DELETE FROM permission_findings")
    conn.execute("DELETE FROM combination_findings")
    conn.execute("DELETE FROM app_analyses")
    conn.commit()
    conn.close()


def update_user_notes(analysis_id: str, notes: str) -> bool:
    """Update user notes for an analysis."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE app_analyses SET user_notes = ? WHERE id = ?", (notes, analysis_id))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


# === Policy CRUD ===

def get_all_policies():
    """Retrieve all policies."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM policies ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    result = []
    for row in rows:
        d = dict(row)
        d["policy_json"] = json.loads(d["policy_json"])
        d["enabled"] = bool(d["enabled"])
        result.append(d)
    conn.close()
    return result


def get_policy(policy_id: str):
    """Retrieve a single policy."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM policies WHERE id = ?", (policy_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["policy_json"] = json.loads(d["policy_json"])
    d["enabled"] = bool(d["enabled"])
    return d


def save_policy(policy: dict):
    """Save or update a policy."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO policies (id, name, enabled, policy_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        policy["id"],
        policy["name"],
        1 if policy.get("enabled", True) else 0,
        json.dumps(policy.get("policy_json", {})),
        policy.get("created_at", policy["updated_at"]),
        policy["updated_at"],
    ))
    conn.commit()
    conn.close()


def delete_policy(policy_id: str) -> bool:
    """Delete a policy."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM policies WHERE id = ?", (policy_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted
