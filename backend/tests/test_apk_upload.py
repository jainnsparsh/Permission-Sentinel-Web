"""Regression: APK upload must work with or without Androguard installed."""
import warnings
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.parsers.apk_parser import _parse_builtin

APK = Path(__file__).parent / "data" / "sample.apk"

def test_builtin_reader_extracts_permissions():
    r = _parse_builtin(str(APK))
    assert r.package_name == "a2dp.Vol"
    assert "android.permission.READ_CONTACTS" in r.permissions
    assert "android.permission.ACCESS_FINE_LOCATION" in r.permissions
    assert len(r.permissions) == 17

def test_apk_upload_endpoint():
    with warnings.catch_warnings(), TestClient(app) as c:
        resp = c.post("/api/analyze/upload",
                      files={"file": ("sample.apk", APK.read_bytes(), "application/vnd.android.package-archive")},
                      data={"purpose": "music_player"})
    assert resp.status_code == 200
    assert resp.json()["input_source"] == "apk"

def test_non_apk_zip_rejected_cleanly():
    with TestClient(app) as c:
        resp = c.post("/api/analyze/upload", files={"file": ("bad.apk", b"PK" + b"x" * 300)}, data={"purpose": "calculator"})
    assert resp.status_code == 422
