"""
Permission Evolution Intelligence.

Compares two versions of the same app and explains how it became more (or less)
invasive: permissions added/removed, access-level escalations (e.g. coarse -> fine
location), newly triggered risky combinations, and the change in risk score.

Pure and deterministic: both versions are scored by the same engine (analyze_app),
so the comparison is always apples-to-apples.
"""
from app.engine.analyzer import analyze_app

A = "android.permission."
BAND_RANK = {"Low": 0, "Medium": 1, "High": 2}

# (older, broader-access permission) -> why gaining it matters
ESCALATIONS = [
    (A + "ACCESS_COARSE_LOCATION", A + "ACCESS_FINE_LOCATION", "Location precision upgraded from approximate (~city block) to exact GPS."),
    (A + "ACCESS_FINE_LOCATION", A + "ACCESS_BACKGROUND_LOCATION", "Location access extended from 'while using the app' to continuous background tracking."),
    (A + "ACCESS_COARSE_LOCATION", A + "ACCESS_BACKGROUND_LOCATION", "Location access extended from 'while using the app' to continuous background tracking."),
    (A + "READ_EXTERNAL_STORAGE", A + "WRITE_EXTERNAL_STORAGE", "Storage access upgraded from read-only to read and modify."),
    (A + "READ_EXTERNAL_STORAGE", A + "MANAGE_EXTERNAL_STORAGE", "Storage access upgraded to full access to all files on the device."),
    (A + "WRITE_EXTERNAL_STORAGE", A + "MANAGE_EXTERNAL_STORAGE", "Storage access upgraded to full access to all files on the device."),
    (A + "READ_CONTACTS", A + "WRITE_CONTACTS", "Contacts access upgraded from read-only to read and modify."),
    (A + "READ_CALL_LOG", A + "WRITE_CALL_LOG", "Call-log access upgraded from read-only to read and modify."),
    (A + "READ_SMS", A + "SEND_SMS", "SMS access extended from reading messages to sending them (premium-SMS fraud risk)."),
    (A + "RECEIVE_SMS", A + "READ_SMS", "SMS access extended from receiving to reading the full message history."),
    (A + "READ_PHONE_STATE", A + "READ_PHONE_NUMBERS", "Phone access extended to include the user's phone number."),
]


def _fmap(a: dict) -> dict:
    return {f["permission"]: f for f in a["permission_findings"]}


def _contribution(analysis: dict, perm: str, purpose: str, policies: list) -> float:
    """Score points this permission contributes: score(all) - score(all without it)."""
    rest = [p for p in analysis["permissions"] if p != perm]
    without = analyze_app("x", "x", rest, purpose, active_policies=policies)["score"]
    return round(analysis["score"] - without, 1)


def _summary_of(a: dict) -> dict:
    return {
        "app_name": a["app_name"], "package_name": a["package_name"], "version": a["version"],
        "target_sdk": a["target_sdk"], "score": a["score"], "risk_band": a["risk_band"],
        "permission_count": len(a["permissions"]),
    }


def compare_versions(old_in: dict, new_in: dict, purpose: str, policies: list | None = None) -> dict:
    """
    old_in / new_in: dicts with app_name, package_name, version, target_sdk, permissions.
    Returns a JSON-serialisable evolution report.
    """
    policies = policies or []
    old = analyze_app(old_in.get("app_name") or old_in.get("package_name") or "Old version", old_in.get("package_name", ""),
                      old_in["permissions"], purpose, input_source="evolution-old", version=old_in.get("version", ""),
                      target_sdk=old_in.get("target_sdk", ""), active_policies=policies)
    new = analyze_app(new_in.get("app_name") or new_in.get("package_name") or "New version", new_in.get("package_name", ""),
                      new_in["permissions"], purpose, input_source="evolution-new", version=new_in.get("version", ""),
                      target_sdk=new_in.get("target_sdk", ""), active_policies=policies)

    op, np_ = set(old["permissions"]), set(new["permissions"])
    of, nf = _fmap(old), _fmap(new)

    added = []
    for p in sorted(np_ - op):
        f = nf[p]
        added.append({"permission": p, "label": f["label"], "status": f["status"], "severity": f["severity"],
                      "reason": f["reason"], "recommendation": f["recommendation"], "data_exposed": f["data_exposed"],
                      "score_impact": _contribution(new, p, purpose, policies)})
    added.sort(key=lambda x: -x["score_impact"])

    removed = []
    for p in sorted(op - np_):
        f = of[p]
        removed.append({"permission": p, "label": f["label"], "status": f["status"], "severity": f["severity"],
                        "score_impact": -_contribution(old, p, purpose, policies)})

    # "Changed": access-level escalations, plus classification changes on kept permissions
    escalations = []
    for frm, to, why in ESCALATIONS:
        if to in np_ and to not in op and frm in op:
            escalations.append({"from": frm, "to": to, "why": why,
                                "kind": "upgraded" if frm in np_ else "replaced"})
    changed = [{"permission": p, "from_status": of[p]["status"], "to_status": nf[p]["status"],
                "from_severity": of[p]["severity"], "to_severity": nf[p]["severity"]}
               for p in sorted(op & np_)
               if (of[p]["status"], of[p]["severity"]) != (nf[p]["status"], nf[p]["severity"])]

    oc = {c["rule_id"]: c for c in old["combination_findings"]}
    nc = {c["rule_id"]: c for c in new["combination_findings"]}
    new_combos = [nc[r] for r in nc if r not in oc]
    gone_combos = [oc[r] for r in oc if r not in nc]

    delta = round(new["score"] - old["score"], 1)
    band_up = BAND_RANK.get(new["risk_band"], 0) > BAND_RANK.get(old["risk_band"], 0)
    band_down = BAND_RANK.get(new["risk_band"], 0) < BAND_RANK.get(old["risk_band"], 0)
    bad_added = [a for a in added if a["status"] in ("unexpected", "policy-violation")]

    HI = ("critical", "high")
    sens_escal = [e for e in escalations if nf[e["to"]]["severity"] in HI]
    sens_added = [a for a in added if a["severity"] in HI and a["status"] not in ("unexpected", "policy-violation")]
    flags = []
    if sens_escal: flags.append(f"{len(sens_escal)} permission(s) escalated to critical/high-sensitivity access (may be justified by the app's purpose, but the app can now see more)")
    if bad_added: flags.append(f"{len(bad_added)} new permission(s) have no clear justification for this app's purpose")
    if new_combos: flags.append(f"{len(new_combos)} new risky permission combination(s) triggered")
    if escalations and not sens_escal: flags.append(f"{len(escalations)} existing permission(s) were upgraded to broader access")
    if any(a["status"] == "policy-violation" for a in added): flags.append("an added permission violates organisation policy")

    if delta >= 15 or band_up or new_combos or bad_added or sens_escal:
        verdict, label = "more_invasive", "More invasive after update"
    elif delta <= -10 or band_down:
        verdict, label = "less_invasive", "Less invasive after update"
    elif sens_added:
        verdict, label = "notable_change", "New sensitive access (justified for this app's purpose)"
        flags.append(f"{len(sens_added)} new critical/high-sensitivity permission(s), expected for this purpose but worth a look")
    elif added or removed or escalations or changed:
        verdict, label = "minor_change", "Minor permission changes"
    else:
        verdict, label = "no_change", "No permission changes"

    parts = [f"{len(added)} permission(s) added, {len(removed)} removed, {len(op & np_)} unchanged."]
    parts.append(f"Risk score {old['score']} -> {new['score']} ({'+' if delta >= 0 else ''}{delta}); "
                 f"{old['risk_band']} -> {new['risk_band']}.")
    recommendation = {
        "more_invasive": "Do not update blindly. Review each added or upgraded permission below, confirm the developer's reason, and deny or restrict anything not needed for the app's core function.",
        "less_invasive": "This update reduces the app's access. It is safe to prefer this version.",
        "notable_change": "The added access fits what this kind of app does, but it is sensitive. Prefer 'only while using the app' and approximate location where the app allows it.",
        "minor_change": "Low-impact change. Skim the added permissions and update if they match what you expect.",
        "no_change": "The permission set is identical, so this update does not change the app's access.",
    }[verdict]

    warnings = []
    if old.get("package_name") and new.get("package_name") and old["package_name"] != new["package_name"]:
        warnings.append(f"Package names differ ({old['package_name']} vs {new['package_name']}). These may not be versions of the same app.")
    if old.get("version") and old["version"] == new.get("version"):
        warnings.append("Both files report the same version name; check you selected the old and new builds.")

    return {
        "verdict": verdict, "verdict_label": label, "summary": " ".join(parts), "flags": flags,
        "recommendation": recommendation, "purpose": purpose,
        "old": _summary_of(old), "new": _summary_of(new),
        "score_delta": delta, "band_changed": old["risk_band"] != new["risk_band"],
        "added": added, "removed": removed, "unchanged_count": len(op & np_),
        "escalations": escalations, "classification_changes": changed,
        "new_combinations": new_combos, "resolved_combinations": gone_combos,
        "warnings": warnings,
    }


# --- Demo scenarios (no files needed) ---
DEMOS = {
    "calculator": dict(
        purpose="Calculator / Simple Utility",
        old=dict(app_name="QuickCalc", package_name="com.demo.quickcalc", version="1.0", target_sdk="33",
                 permissions=[A + "VIBRATE"]),
        new=dict(app_name="QuickCalc", package_name="com.demo.quickcalc", version="2.0", target_sdk="34",
                 permissions=[A + "VIBRATE", A + "INTERNET", A + "ACCESS_FINE_LOCATION", A + "READ_CONTACTS", A + "RECORD_AUDIO"]),
    ),
    "maps": dict(
        purpose="Maps / Navigation",
        old=dict(app_name="TrailGo", package_name="com.demo.trailgo", version="3.1", target_sdk="33",
                 permissions=[A + "INTERNET", A + "ACCESS_COARSE_LOCATION"]),
        new=dict(app_name="TrailGo", package_name="com.demo.trailgo", version="3.2", target_sdk="34",
                 permissions=[A + "INTERNET", A + "ACCESS_FINE_LOCATION", A + "ACCESS_BACKGROUND_LOCATION"]),
    ),
}
