"""
API route integration tests using TestClient.
"""

import pytest
from starlette.testclient import TestClient
from app.main import app
from app.database import init_db


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Ensure database schema is created before tests run."""
    init_db()


def test_health_check():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ("ok", "healthy")
        assert "version" in data


def test_purposes_list():
    with TestClient(app) as client:
        response = client.get("/api/purposes")
        assert response.status_code == 200
        data = response.json()
        assert "purposes" in data
        assert len(data["purposes"]) > 0


def test_capabilities():
    with TestClient(app) as client:
        response = client.get("/api/capabilities")
        assert response.status_code == 200
        data = response.json()
        assert "knowledge_base_version" in data
        assert "supported_formats" in data


def test_demo_apps():
    with TestClient(app) as client:
        response = client.get("/api/demo/apps")
        assert response.status_code == 200
        data = response.json()
        assert "apps" in data
        assert len(data["apps"]) >= 8


def test_analyze_report_flow():
    with TestClient(app) as client:
        payload = {
            "app_name": "API Test Torch",
            "package_name": "com.test.torch",
            "purpose": "Calculator / Simple Utility",
            "purpose_source": "user-selected",
            "permissions": ["android.permission.CAMERA", "android.permission.READ_CONTACTS"],
            "version": "1.0.0",
            "target_sdk": "34"
        }
        response = client.post("/api/analyze/report", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["app_name"] == "API Test Torch"
        assert data["score"] > 0
        app_id = data["id"]

        # Verify retrieval
        get_res = client.get(f"/api/apps/{app_id}")
        assert get_res.status_code == 200
        assert get_res.json()["id"] == app_id

        # Verify notes update
        notes_res = client.put(f"/api/apps/{app_id}/notes", json={"notes": "Audited by automated test."})
        assert notes_res.status_code == 200

        # Verify deletion
        del_res = client.delete(f"/api/apps/{app_id}")
        assert del_res.status_code == 200


def test_policies_crud():
    with TestClient(app) as client:
        policy_payload = {
            "name": "Test Zero-Trust Policy",
            "enabled": True,
            "blocked_permissions": ["android.permission.READ_SMS"],
            "allowed_permissions": [],
            "score_threshold": 50,
            "alert_on_special_permissions": True
        }
        create_res = client.post("/api/policies", json=policy_payload)
        assert create_res.status_code == 200
        pol_id = create_res.json()["id"]

        # List
        list_res = client.get("/api/policies")
        assert list_res.status_code == 200

        # Delete
        del_res = client.delete(f"/api/policies/{pol_id}")
        assert del_res.status_code == 200


def test_manifest_upload_flow():
    with TestClient(app) as client:
        xml_content = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.manifesttest">
    <uses-permission android:name="android.permission.INTERNET" />
    <application android:label="Manifest Test App" />
</manifest>"""
        files = {"file": ("AndroidManifest.xml", xml_content.encode("utf-8"), "application/xml")}
        data = {"purpose": "Browser", "purpose_source": "user-selected"}
        res = client.post("/api/analyze/upload", files=files, data=data)
        assert res.status_code == 200
        result = res.json()
        assert result["package_name"] == "com.example.manifesttest"
        assert result["score"] >= 0
        # Clean up
        client.delete(f"/api/apps/{result['id']}")


def test_csv_upload_flow():
    with TestClient(app) as client:
        csv_content = """app_name,package_name,permission,purpose
NaviTest,com.nav.test,android.permission.ACCESS_FINE_LOCATION,Maps / Navigation
NaviTest,com.nav.test,android.permission.INTERNET,Maps / Navigation
"""
        files = {"file": ("report.csv", csv_content.encode("utf-8"), "text/csv")}
        data = {"purpose": "Maps / Navigation", "purpose_source": "user-selected"}
        res = client.post("/api/analyze/upload", files=files, data=data)
        assert res.status_code == 200
        result = res.json()
        assert result["analyzed"] == 1
        app_item = result["results"][0]
        assert app_item["app_name"] == "NaviTest"
        assert "android.permission.ACCESS_FINE_LOCATION" in app_item["permissions"]
        assert "android.permission.INTERNET" in app_item["permissions"]
        client.delete(f"/api/apps/{app_item['id']}")
