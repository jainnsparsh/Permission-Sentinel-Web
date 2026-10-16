import io, zipfile, warnings
from fastapi.testclient import TestClient
from app.main import app
from app.engine.evolution import compare_versions, DEMOS

A = "android.permission."
def v(perms, ver="1"): return dict(app_name="App", package_name="com.x.app", version=ver, target_sdk="33", permissions=perms)

def test_calculator_update_is_more_invasive():
    d = DEMOS["calculator"]; r = compare_versions(d["old"], d["new"], d["purpose"])
    assert r["verdict"] == "more_invasive" and r["score_delta"] > 0
    assert {a["permission"] for a in r["added"]} >= {A+"READ_CONTACTS", A+"RECORD_AUDIO", A+"ACCESS_FINE_LOCATION"}
    assert r["new_combinations"], "location+contacts style combination should trigger"
    assert all(a["score_impact"] >= 0 for a in r["added"])

def test_removal_is_less_invasive():
    d = DEMOS["calculator"]; r = compare_versions(d["new"], d["old"], d["purpose"])
    assert r["verdict"] == "less_invasive" and r["score_delta"] < 0 and not r["added"] and r["removed"]

def test_identical_versions_no_change():
    r = compare_versions(v([A+"INTERNET"]), v([A+"INTERNET"], "2"), "Weather")
    assert r["verdict"] == "no_change" and r["score_delta"] == 0

def test_location_escalation_detected():
    d = DEMOS["maps"]; r = compare_versions(d["old"], d["new"], d["purpose"])
    kinds = {(e["from"], e["to"], e["kind"]) for e in r["escalations"]}
    assert (A+"ACCESS_COARSE_LOCATION", A+"ACCESS_BACKGROUND_LOCATION", "replaced") in kinds
    assert r["verdict"] == "more_invasive", "justified-but-sensitive escalation must still be flagged"
    assert r["score_delta"] == 0 or r["flags"]

def test_new_sensitive_but_expected_permission_is_notable():
    r = compare_versions(v([A+"INTERNET"]), v([A+"INTERNET", A+"ACCESS_FINE_LOCATION"], "2"), "Maps / Navigation")
    assert r["verdict"] == "notable_change"

def test_package_mismatch_warns():
    b = v([A+"INTERNET"]); b["package_name"] = "com.other"
    assert compare_versions(v([A+"INTERNET"]), b, "Weather")["warnings"]

def _apk(perms):
    xml = '<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.x.app">' + \
          "".join(f'<uses-permission android:name="{A}{p}"/>' for p in perms) + "<application/></manifest>"
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z: z.writestr("AndroidManifest.xml", xml)
    return b.getvalue()

def test_compare_endpoint_with_apks():
    with warnings.catch_warnings(), TestClient(app) as c:
        r = c.post("/api/compare", data={"purpose": "Calculator / Simple Utility"},
                   files={"old_file": ("v1.apk", _apk(["VIBRATE"])), "new_file": ("v2.apk", _apk(["VIBRATE", "READ_CONTACTS"]))})
    assert r.status_code == 200 and r.json()["verdict"] == "more_invasive"

def test_compare_endpoint_rejects_bad_type_and_demo():
    with TestClient(app) as c:
        r = c.post("/api/compare", data={"purpose": "Weather"}, files={"old_file": ("a.txt", b"x"), "new_file": ("b.apk", _apk([]))})
        assert r.status_code == 400
        assert c.get("/api/compare/demo?scenario=maps").status_code == 200
        assert c.get("/api/compare/demo?scenario=nope").status_code == 404
