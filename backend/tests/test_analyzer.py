"""
Unit tests for the Permission Sentinel analysis engine and scoring formula.
"""

import pytest
from app.engine.analyzer import analyze_app
from app.config import PURPOSE_CATEGORIES


def test_supported_purposes():
    assert len(PURPOSE_CATEGORIES) > 0
    assert "Calculator / Simple Utility" in PURPOSE_CATEGORIES
    assert "Camera / Photo Editor" in PURPOSE_CATEGORIES


def test_camera_photo_expected_permissions():
    """A camera app requesting CAMERA should have low risk and expected status."""
    result = analyze_app(
        app_name="Clean Camera",
        package_name="com.example.cleancamera",
        permissions=["android.permission.CAMERA"],
        purpose="Camera / Photo Editor",
    )
    assert result["score"] < 30
    assert result["risk_band"] == "Low"
    assert any(f["status"] == "expected" for f in result["permission_findings"])


def test_calculator_excessive_permissions():
    """A calculator app requesting Contacts, SMS, Location should score High Risk."""
    result = analyze_app(
        app_name="Suspicious Calculator",
        package_name="com.calc.malicious",
        permissions=[
            "android.permission.INTERNET",
            "android.permission.READ_CONTACTS",
            "android.permission.READ_SMS",
            "android.permission.SEND_SMS",
            "android.permission.ACCESS_FINE_LOCATION",
            "android.permission.RECORD_AUDIO",
            "android.permission.CAMERA"
        ],
        purpose="Calculator / Simple Utility",
    )
    assert result["score"] >= 60
    assert result["risk_band"] == "High"
    unexpected = [f for f in result["permission_findings"] if f["status"] == "unexpected"]
    assert len(unexpected) >= 3
    # Check that combination rules fired
    assert len(result["combination_findings"]) > 0


def test_score_breakdown_transparency():
    """Score breakdown should accurately sum up to total clamped score."""
    result = analyze_app(
        app_name="Super Calc",
        package_name="com.calculator.tracker",
        permissions=[
            "android.permission.READ_SMS",
            "android.permission.ACCESS_FINE_LOCATION",
            "android.permission.INTERNET"
        ],
        purpose="Calculator / Simple Utility",
    )
    bd = result["score_breakdown"]
    assert bd["sensitivity_score"] >= 0
    assert bd["purpose_mismatch_score"] >= 0
    assert bd["total"] == result["score"]
    assert 0 <= result["score"] <= 100


def test_empty_permissions():
    """An app with no permissions should have zero risk."""
    result = analyze_app(
        app_name="Zero Perm Calc",
        package_name="com.zeroperm.calc",
        permissions=[],
        purpose="Calculator / Simple Utility",
    )
    assert result["score"] == 0
    assert result["risk_band"] == "Low"
    assert len(result["permission_findings"]) == 0
