"""
Permission Sentinel - Analysis Engine
Pure, deterministic analysis module. Same input always produces same output.

This module:
1. Loads the knowledge base
2. Classifies each permission's relevance to the stated purpose
3. Applies combination rules
4. Checks active policies
5. Computes a transparent, documented risk score
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import (
    KNOWLEDGE_BASE_DIR,
    KNOWLEDGE_BASE_VERSION,
    SENSITIVITY_WEIGHTS,
    SENSITIVITY_CAP,
    PURPOSE_MISMATCH_PER_PERMISSION,
    PURPOSE_MISMATCH_CAP,
    COMBINATION_RULE_SCORE,
    COMBINATION_RULE_CAP,
    POLICY_VIOLATION_SCORE,
    POLICY_VIOLATION_CAP,
    CONTEXT_AMPLIFIER_MAX,
    get_risk_band,
    PURPOSE_CATEGORIES,
)


# === Knowledge Base Loading ===

_kb_cache = None


def load_knowledge_base() -> dict:
    """Load and cache the permission knowledge base."""
    global _kb_cache
    if _kb_cache is not None:
        return _kb_cache

    kb_path = KNOWLEDGE_BASE_DIR / "permissions_kb.json"
    with open(kb_path, "r", encoding="utf-8") as f:
        _kb_cache = json.load(f)
    return _kb_cache


def get_permission_info(permission: str) -> Optional[dict]:
    """Look up a permission in the knowledge base."""
    kb = load_knowledge_base()
    return kb.get("permissions", {}).get(permission)


def get_combination_rules() -> list[dict]:
    """Get all combination rules from the knowledge base."""
    kb = load_knowledge_base()
    return kb.get("combination_rules", [])


def infer_purpose(app_name: str, package_name: str) -> Optional[str]:
    """
    Attempt to infer app purpose from name/package keywords.
    Returns a suggested purpose or None. This is NEVER treated as ground truth.
    """
    combined = (app_name + " " + package_name).lower()

    keyword_map = {
        "Calculator / Simple Utility": ["calculator", "calc", "converter", "unit", "flashlight", "torch", "clock", "timer", "stopwatch"],
        "Notes / Productivity": ["notes", "note", "todo", "task", "productivity", "editor", "document", "office"],
        "Maps / Navigation": ["maps", "map", "navigation", "navigate", "gps", "directions", "route"],
        "Messaging / Communication": ["messenger", "message", "chat", "whatsapp", "telegram", "signal", "call", "phone", "sms", "email", "mail"],
        "Camera / Photo Editor": ["camera", "photo", "picture", "image", "gallery", "snap", "lens"],
        "Music / Media Player": ["music", "player", "audio", "spotify", "podcast", "radio", "video", "media", "stream"],
        "Fitness / Activity Tracking": ["fitness", "fit", "exercise", "workout", "health", "step", "run", "track", "activity"],
        "Weather": ["weather", "forecast", "climate", "temperature", "rain"],
        "E-commerce": ["shop", "store", "buy", "market", "amazon", "ebay", "cart", "order", "commerce"],
        "Browser": ["browser", "chrome", "firefox", "safari", "web", "surf"],
        "Finance / Banking": ["bank", "finance", "pay", "money", "wallet", "investment", "stock", "crypto"],
        "Game": ["game", "play", "puzzle", "arcade", "racing", "adventure", "strategy"],
    }

    for purpose, keywords in keyword_map.items():
        for kw in keywords:
            if kw in combined:
                return purpose

    return None


# === Permission Classification ===

def classify_permission(permission: str, purpose: str, active_policies: list[dict]) -> dict:
    """
    Classify a single permission's relevance to the stated purpose.
    
    Returns a finding dict with:
    - status: expected, context-dependent, unexpected, policy-violation, unknown
    - severity: critical, high, medium, low, unknown
    - reason, recommendation, data_exposed, etc.
    """
    info = get_permission_info(permission)

    # Check policy violations first
    policy_violation = check_policy_violation(permission, purpose, active_policies)
    if policy_violation:
        return policy_violation

    if info is None:
        # Unknown permission - not in KB
        return {
            "permission": permission,
            "label": permission.split(".")[-1].replace("_", " ").title() if "." in permission else permission,
            "status": "unknown",
            "severity": "unknown",
            "base_weight": SENSITIVITY_WEIGHTS["unknown"],
            "reason": f"Permission '{permission}' is not in the current knowledge base (v{KNOWLEDGE_BASE_VERSION}). Cannot assess relevance to the selected purpose.",
            "evidence_rule_ids": ["KB-UNKNOWN"],
            "confidence": "low: permission not in knowledge base",
            "recommendation": "Review this permission manually. Check Android documentation for what it grants access to.",
            "data_exposed": "Unknown - permission not recognized",
            "caveat": "This permission may be legitimate but is not yet catalogued in the knowledge base.",
        }

    label = info.get("label", permission)
    sensitivity = info.get("sensitivity", "unknown")
    base_weight = SENSITIVITY_WEIGHTS.get(sensitivity, 0)
    data_exposed = info.get("data_exposed", "")
    family = info.get("family", "unknown")
    explanation = info.get("explanation", "")
    notes = info.get("notes", "")
    safer_alt = info.get("safer_alternative")

    expected_purposes = info.get("expected_purposes", [])
    unexpected_purposes = info.get("unexpected_purposes", [])

    is_unknown_purpose = purpose == "Other / Unknown"

    # Determine status
    if purpose in expected_purposes:
        status = "expected"
        reason = (
            f"'{label}' is commonly expected for '{purpose}' apps. "
            f"{explanation}"
        )
        confidence = "high: knowledge base explicit match"
        recommendation = (
            f"This permission is typical for this app category. "
            f"Still verify it's used for its intended purpose."
        )
        if sensitivity in ("critical", "high"):
            recommendation += f" Note: this permission has {sensitivity} sensitivity even when expected."
        caveat = ""
    elif purpose in unexpected_purposes and not is_unknown_purpose:
        status = "unexpected"
        reason = (
            f"'{label}' is usually not needed for '{purpose}' apps. "
            f"{explanation} {notes}"
        )
        confidence = "high confidence: explicit purpose mismatch in knowledge base"
        recommendation = f"Review whether this permission is necessary. "
        if safer_alt:
            recommendation += f"Consider: {safer_alt}"
        else:
            recommendation += "Consider removing it or using a less privileged alternative."
        caveat = (
            f"The app may legitimately need this permission for an optional or secondary feature "
            f"not captured by the '{purpose}' category."
        )
    elif is_unknown_purpose:
        # Unknown purpose - be cautious, don't claim mismatch
        if sensitivity in ("critical", "high"):
            status = "context-dependent"
            reason = (
                f"'{label}' has {sensitivity} sensitivity. With purpose set to 'Other / Unknown', "
                f"cannot determine if this is expected. {explanation}"
            )
            confidence = "reduced: app purpose is unknown, cannot assess relevance"
            recommendation = (
                f"Select a specific app purpose to get a more accurate assessment. "
                f"Review whether this {sensitivity}-sensitivity permission is necessary."
            )
            caveat = "Purpose-based assessment is unavailable. This finding reflects sensitivity, not a mismatch claim."
        else:
            status = "unknown"
            reason = (
                f"'{label}' cannot be assessed without a specific app purpose. {explanation}"
            )
            confidence = "low: purpose is unknown"
            recommendation = "Select a specific app purpose for better analysis."
            caveat = ""
    else:
        # Not explicitly expected or unexpected for this purpose
        if sensitivity in ("critical", "high"):
            status = "context-dependent"
            reason = (
                f"'{label}' is not commonly associated with '{purpose}' apps but is not explicitly "
                f"flagged as unexpected. Given its {sensitivity} sensitivity, review is recommended. "
                f"{explanation}"
            )
            confidence = "heuristic: sensitive permission without explicit purpose match"
        else:
            status = "context-dependent"
            reason = (
                f"'{label}' may or may not be needed for '{purpose}' apps depending on specific features. "
                f"{explanation}"
            )
            confidence = "heuristic: no explicit match in knowledge base"
        
        recommendation = "Verify this permission is used for a feature the user expects."
        if safer_alt:
            recommendation += f" Consider: {safer_alt}"
        caveat = "This permission may be justified by a specific feature. Confirm with the app's documented functionality."

    evidence_ids = [f"KB-{sensitivity.upper()}-{family.upper()}"]

    return {
        "permission": permission,
        "label": label,
        "status": status,
        "severity": sensitivity,
        "base_weight": base_weight,
        "reason": reason,
        "evidence_rule_ids": evidence_ids,
        "confidence": confidence,
        "recommendation": recommendation,
        "data_exposed": data_exposed,
        "caveat": caveat,
    }


def check_policy_violation(permission: str, purpose: str, active_policies: list[dict]) -> Optional[dict]:
    """Check if a permission violates any active policy."""
    info = get_permission_info(permission)
    label = info.get("label", permission) if info else permission
    sensitivity = info.get("sensitivity", "unknown") if info else "unknown"
    family = info.get("family", "unknown") if info else "unknown"
    data_exposed = info.get("data_exposed", "Unknown") if info else "Unknown"

    for policy in active_policies:
        if not policy.get("enabled", True):
            continue
        
        pj = policy.get("policy_json", {})
        blocked = pj.get("blocked_permissions", [])
        
        # Check blocked permissions
        if permission in blocked:
            return {
                "permission": permission,
                "label": label,
                "status": "policy-violation",
                "severity": sensitivity,
                "base_weight": SENSITIVITY_WEIGHTS.get(sensitivity, 0),
                "reason": (
                    f"'{label}' is explicitly blocked by policy '{policy['name']}'. "
                    f"This permission is not allowed under the active organizational policy."
                ),
                "evidence_rule_ids": [f"POLICY-{policy['id']}-BLOCKED"],
                "confidence": "high confidence: explicit policy violation",
                "recommendation": f"Remove this permission to comply with policy '{policy['name']}'.",
                "data_exposed": data_exposed,
                "caveat": "If this permission is essential, request a policy exception.",
            }

        # Check purpose-specific rules
        purpose_rules = pj.get("purpose_specific_rules", {})
        if purpose in purpose_rules:
            purpose_blocked = purpose_rules[purpose].get("blocked_permissions", [])
            if permission in purpose_blocked:
                return {
                    "permission": permission,
                    "label": label,
                    "status": "policy-violation",
                    "severity": sensitivity,
                    "base_weight": SENSITIVITY_WEIGHTS.get(sensitivity, 0),
                    "reason": (
                        f"'{label}' is blocked for '{purpose}' apps by policy '{policy['name']}'."
                    ),
                    "evidence_rule_ids": [f"POLICY-{policy['id']}-PURPOSE-BLOCKED"],
                    "confidence": "high confidence: purpose-specific policy violation",
                    "recommendation": f"Remove this permission or change the app purpose category.",
                    "data_exposed": data_exposed,
                    "caveat": "",
                }

        # Check alert on special permissions
        if pj.get("alert_on_special_permissions", False) and family == "special":
            return {
                "permission": permission,
                "label": label,
                "status": "policy-violation",
                "severity": sensitivity,
                "base_weight": SENSITIVITY_WEIGHTS.get(sensitivity, 0),
                "reason": (
                    f"'{label}' is a special/high-impact permission flagged by policy '{policy['name']}'. "
                    f"Special permissions require additional review."
                ),
                "evidence_rule_ids": [f"POLICY-{policy['id']}-SPECIAL"],
                "confidence": "high confidence: policy flags all special permissions",
                "recommendation": "Review and justify the need for this special permission.",
                "data_exposed": data_exposed,
                "caveat": "Special permissions may be legitimate but require documented justification.",
            }

    return None


# === Combination Rules Engine ===

def evaluate_combination_rules(permissions: list[str], purpose: str) -> list[dict]:
    """
    Evaluate permission combination rules against the app's permissions.
    Returns list of triggered combination findings.
    """
    rules = get_combination_rules()
    findings = []
    triggered_rule_ids = set()

    perm_set = set(permissions)

    for rule in rules:
        rule_id = rule["rule_id"]
        if rule_id in triggered_rule_ids:
            continue

        # Check exemptions
        exempt_purposes = rule.get("exempt_purposes", [])
        if purpose in exempt_purposes:
            continue

        condition = rule.get("trigger_condition", "")
        trigger_perms = rule.get("trigger_permissions", [])
        matched = []

        if condition == "any_location_and_contacts":
            location_perms = [p for p in perm_set if "LOCATION" in p.upper()]
            contact_perms = [p for p in perm_set if "CONTACTS" in p.upper() or "CONTACT" in p.upper()]
            if location_perms and contact_perms:
                matched = location_perms + contact_perms

        elif condition == "microphone_and_background":
            has_mic = "android.permission.RECORD_AUDIO" in perm_set
            has_bg = (
                "android.permission.FOREGROUND_SERVICE" in perm_set
                or "android.permission.RECEIVE_BOOT_COMPLETED" in perm_set
            )
            if has_mic and has_bg:
                matched = [p for p in perm_set if p in (
                    "android.permission.RECORD_AUDIO",
                    "android.permission.FOREGROUND_SERVICE",
                    "android.permission.RECEIVE_BOOT_COMPLETED",
                )]

        elif condition == "file_access_and_internet":
            has_file = any(p in perm_set for p in (
                "android.permission.READ_EXTERNAL_STORAGE",
                "android.permission.MANAGE_EXTERNAL_STORAGE",
                "android.permission.WRITE_EXTERNAL_STORAGE",
            ))
            has_internet = "android.permission.INTERNET" in perm_set
            if has_file and has_internet:
                matched = [p for p in perm_set if p in (
                    "android.permission.READ_EXTERNAL_STORAGE",
                    "android.permission.WRITE_EXTERNAL_STORAGE",
                    "android.permission.MANAGE_EXTERNAL_STORAGE",
                    "android.permission.INTERNET",
                )]

        elif condition == "sms_and_contacts":
            sms_perms = [p for p in perm_set if "SMS" in p.upper()]
            contact_perms = [p for p in perm_set if "CONTACTS" in p.upper() or "CONTACT" in p.upper()]
            if sms_perms and contact_perms:
                matched = sms_perms + contact_perms

        elif condition == "precise_and_background_location":
            has_fine = "android.permission.ACCESS_FINE_LOCATION" in perm_set
            has_bg_loc = "android.permission.ACCESS_BACKGROUND_LOCATION" in perm_set
            if has_fine and has_bg_loc:
                matched = ["android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_BACKGROUND_LOCATION"]

        elif condition == "camera_and_microphone":
            has_camera = "android.permission.CAMERA" in perm_set
            has_mic = "android.permission.RECORD_AUDIO" in perm_set
            if has_camera and has_mic:
                matched = ["android.permission.CAMERA", "android.permission.RECORD_AUDIO"]

        else:
            # Generic: check if all trigger permissions are present
            present = [p for p in trigger_perms if p in perm_set]
            if len(present) >= 2:
                matched = present

        if matched:
            triggered_rule_ids.add(rule_id)
            findings.append({
                "rule_id": rule_id,
                "matched_permissions": sorted(set(matched)),
                "explanation": rule.get("explanation", ""),
                "confidence": rule.get("confidence", "heuristic"),
                "recommendation": rule.get("recommendation", ""),
                "severity": rule.get("severity", "medium"),
            })

    return findings


# === Score Computation ===

def compute_score(
    permission_findings: list[dict],
    combination_findings: list[dict],
    purpose: str,
) -> tuple[int, dict]:
    """
    Compute the transparent risk score and breakdown.
    
    Returns (score, breakdown_dict).
    
    Score components:
    1. Sensitivity: top-3 permission weights, capped at 60
    2. Purpose mismatch: +12 per unexpected, capped at 30
    3. Combination rules: +8 per triggered rule, capped at 16
    4. Policy violations: +15 per violation, capped at 30
    5. Context amplifier: up to +8 for evidence-backed risk amplification
    """
    breakdown = {
        "sensitivity_score": 0,
        "purpose_mismatch_score": 0,
        "combination_score": 0,
        "policy_violation_score": 0,
        "context_amplifier_score": 0,
        "total": 0,
        "details": {
            "sensitivity_permissions": [],
            "unexpected_permissions": [],
            "combination_rules_triggered": [],
            "policy_violations": [],
            "context_amplifiers": [],
        }
    }

    # 1. Sensitivity: top 3 highest weights from excessive permissions
    # Unexpected/policy-violation permissions carry inherent impact (0.35x base weight)
    # Context-dependent permissions carry reduced impact (0.15x base weight)
    # Expected permissions align with declared app purpose and do not penalize sensitivity
    weights = []
    for f in permission_findings:
        st = f.get("status")
        w = f.get("base_weight", 0)
        if st in ("unexpected", "policy-violation"):
            eff_w = round(w * 0.35)
        elif st == "context-dependent":
            eff_w = round(w * 0.15)
        else:
            eff_w = 0

        if eff_w > 0:
            weights.append((eff_w, f["permission"]))
    
    weights.sort(reverse=True)
    top_3 = weights[:3]
    sensitivity_score = min(sum(w for w, _ in top_3), SENSITIVITY_CAP)
    breakdown["sensitivity_score"] = sensitivity_score
    breakdown["details"]["sensitivity_permissions"] = [
        {"permission": p, "weight": w} for w, p in top_3
    ]

    # 2. Purpose mismatch
    unexpected_count = 0
    unexpected_perms = []
    for f in permission_findings:
        if f["status"] == "unexpected":
            unexpected_count += 1
            unexpected_perms.append(f["permission"])
    
    mismatch_score = min(unexpected_count * PURPOSE_MISMATCH_PER_PERMISSION, PURPOSE_MISMATCH_CAP)
    breakdown["purpose_mismatch_score"] = mismatch_score
    breakdown["details"]["unexpected_permissions"] = unexpected_perms

    # 3. Combination rules
    combo_count = len(combination_findings)
    combo_score = min(combo_count * COMBINATION_RULE_SCORE, COMBINATION_RULE_CAP)
    breakdown["combination_score"] = combo_score
    breakdown["details"]["combination_rules_triggered"] = [
        cf["rule_id"] for cf in combination_findings
    ]

    # 4. Policy violations
    policy_violations = [f for f in permission_findings if f["status"] == "policy-violation"]
    policy_score = min(len(policy_violations) * POLICY_VIOLATION_SCORE, POLICY_VIOLATION_CAP)
    breakdown["policy_violation_score"] = policy_score
    breakdown["details"]["policy_violations"] = [f["permission"] for f in policy_violations]

    # 5. Context amplifier (evidence-based only)
    amplifier_score = 0
    amplifier_details = []

    # Check for background service + sensitive permission
    has_bg = any(
        f["permission"] in (
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.RECEIVE_BOOT_COMPLETED",
        )
        for f in permission_findings
    )
    has_critical_unexpected = any(
        f["status"] == "unexpected" and f["severity"] == "critical"
        for f in permission_findings
    )

    if has_bg and has_critical_unexpected:
        amp = min(8, CONTEXT_AMPLIFIER_MAX)
        amplifier_score += amp
        amplifier_details.append({
            "reason": "Critical unexpected permission combined with background service capability",
            "contribution": amp,
        })

    amplifier_score = min(amplifier_score, CONTEXT_AMPLIFIER_MAX)
    breakdown["context_amplifier_score"] = amplifier_score
    breakdown["details"]["context_amplifiers"] = amplifier_details

    # Total
    total = sensitivity_score + mismatch_score + combo_score + policy_score + amplifier_score
    total = max(0, min(100, total))
    breakdown["total"] = total

    return total, breakdown


# === Main Analysis Function ===

def analyze_app(
    app_name: str,
    package_name: str,
    permissions: list[str],
    purpose: str,
    purpose_source: str = "user-selected",
    input_source: str = "manual",
    version: str = "",
    target_sdk: str = "",
    active_policies: list[dict] = None,
    metadata: dict = None,
) -> dict:
    """
    Run the complete analysis pipeline on an app.
    
    This is a pure, deterministic function. Same inputs = same outputs.
    
    Returns a complete analysis result dict ready for persistence.
    """
    if active_policies is None:
        active_policies = []
    if metadata is None:
        metadata = {}

    # Deduplicate and normalize permissions
    permissions = sorted(set(p.strip() for p in permissions if p.strip()))

    # Classify each permission
    permission_findings = []
    for perm in permissions:
        finding = classify_permission(perm, purpose, active_policies)
        permission_findings.append(finding)

    # Evaluate combination rules
    combination_findings = evaluate_combination_rules(permissions, purpose)

    # Compute score
    score, score_breakdown = compute_score(permission_findings, combination_findings, purpose)
    risk_band = get_risk_band(score)

    # Build analysis result
    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    result = {
        "id": analysis_id,
        "package_name": package_name,
        "app_name": app_name,
        "version": version,
        "target_sdk": target_sdk,
        "selected_purpose": purpose,
        "purpose_source": purpose_source,
        "input_source": input_source,
        "created_at": now,
        "knowledge_base_version": KNOWLEDGE_BASE_VERSION,
        "score": score,
        "risk_band": risk_band,
        "score_breakdown": score_breakdown,
        "permissions": permissions,
        "permission_findings": permission_findings,
        "combination_findings": combination_findings,
        "user_notes": "",
        "metadata": metadata,
    }

    return result
