"""
Permission Sentinel - Demo Data
Eight deterministic sample records for demonstration and testing.
Includes both legitimate and deliberately over-privileged cases.

NOTE: These are synthetic test fixtures, not claims about real apps.
"""


DEMO_APPS = [
    {
        "app_name": "SimpleCalc",
        "package_name": "com.example.simplecalc",
        "purpose": "Calculator / Simple Utility",
        "purpose_source": "provided",
        "description": "A basic calculator with no network or device access needed.",
        "permissions": [],
        "expected_risk_band": "Low",
        "expected_score_range": [0, 5],
        "notes": "No permissions at all. Should score very low risk."
    },
    {
        "app_name": "QuickNotes",
        "package_name": "com.example.quicknotes",
        "purpose": "Notes / Productivity",
        "purpose_source": "provided",
        "description": "A simple note-taking app with local storage.",
        "permissions": [
            "android.permission.INTERNET",
            "android.permission.ACCESS_NETWORK_STATE",
            "android.permission.READ_EXTERNAL_STORAGE",
            "android.permission.WRITE_EXTERNAL_STORAGE"
        ],
        "expected_risk_band": "Low",
        "expected_score_range": [0, 29],
        "notes": "Minimal permissions appropriate for a notes app with cloud sync and file import/export."
    },
    {
        "app_name": "NaviMaps",
        "package_name": "com.example.navimaps",
        "purpose": "Maps / Navigation",
        "purpose_source": "provided",
        "description": "Turn-by-turn navigation app with real-time directions.",
        "permissions": [
            "android.permission.INTERNET",
            "android.permission.ACCESS_FINE_LOCATION",
            "android.permission.ACCESS_COARSE_LOCATION",
            "android.permission.ACCESS_BACKGROUND_LOCATION",
            "android.permission.ACCESS_NETWORK_STATE",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.WAKE_LOCK",
            "android.permission.VIBRATE"
        ],
        "expected_risk_band": "Low",
        "expected_score_range": [0, 29],
        "notes": "All permissions are expected for a full navigation app. Background location is justified for turn-by-turn."
    },
    {
        "app_name": "SnapEdit Pro",
        "package_name": "com.example.snapeditpro",
        "purpose": "Camera / Photo Editor",
        "purpose_source": "provided",
        "description": "Camera app with photo editing and sharing features.",
        "permissions": [
            "android.permission.CAMERA",
            "android.permission.READ_MEDIA_IMAGES",
            "android.permission.READ_MEDIA_VIDEO",
            "android.permission.INTERNET",
            "android.permission.ACCESS_NETWORK_STATE",
            "android.permission.VIBRATE",
            "android.permission.READ_SMS",
            "android.permission.READ_CONTACTS"
        ],
        "expected_risk_band": "Medium",
        "expected_score_range": [30, 59],
        "notes": "Camera and media are expected. READ_SMS and READ_CONTACTS are unexpected for a photo editor."
    },
    {
        "app_name": "ChatConnect",
        "package_name": "com.example.chatconnect",
        "purpose": "Messaging / Communication",
        "purpose_source": "provided",
        "description": "Messaging app with voice/video calling and contact sync.",
        "permissions": [
            "android.permission.INTERNET",
            "android.permission.ACCESS_NETWORK_STATE",
            "android.permission.READ_CONTACTS",
            "android.permission.CAMERA",
            "android.permission.RECORD_AUDIO",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.VIBRATE",
            "android.permission.POST_NOTIFICATIONS",
            "android.permission.RECEIVE_BOOT_COMPLETED",
            "android.permission.WAKE_LOCK"
        ],
        "expected_risk_band": "Low",
        "expected_score_range": [0, 29],
        "notes": "All permissions are expected for a full-featured messaging app with video calling."
    },
    {
        "app_name": "FitTrack",
        "package_name": "com.example.fittrack",
        "purpose": "Fitness / Activity Tracking",
        "purpose_source": "provided",
        "description": "Fitness tracking app with activity recognition and route mapping.",
        "permissions": [
            "android.permission.ACTIVITY_RECOGNITION",
            "android.permission.ACCESS_FINE_LOCATION",
            "android.permission.ACCESS_COARSE_LOCATION",
            "android.permission.ACCESS_BACKGROUND_LOCATION",
            "android.permission.BODY_SENSORS",
            "android.permission.INTERNET",
            "android.permission.ACCESS_NETWORK_STATE",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.POST_NOTIFICATIONS",
            "android.permission.BLUETOOTH_CONNECT"
        ],
        "expected_risk_band": "Low",
        "expected_score_range": [0, 29],
        "notes": "All permissions are expected for a comprehensive fitness tracker with wearable sync."
    },
    {
        "app_name": "WeatherNow",
        "package_name": "com.example.weathernow",
        "purpose": "Weather",
        "purpose_source": "provided",
        "description": "Weather forecast app with location-based forecasts.",
        "permissions": [
            "android.permission.INTERNET",
            "android.permission.ACCESS_COARSE_LOCATION",
            "android.permission.ACCESS_NETWORK_STATE",
            "android.permission.POST_NOTIFICATIONS",
            "android.permission.RECORD_AUDIO",
            "android.permission.SEND_SMS"
        ],
        "expected_risk_band": "Medium",
        "expected_score_range": [30, 59],
        "notes": "Internet and coarse location are expected. RECORD_AUDIO and SEND_SMS are unexpected for a weather app."
    },
    {
        "app_name": "ShadyCalc",
        "package_name": "com.suspicious.shadycalc",
        "purpose": "Calculator / Simple Utility",
        "purpose_source": "provided",
        "description": "A calculator that requests far more permissions than any calculator should need.",
        "permissions": [
            "android.permission.INTERNET",
            "android.permission.READ_CONTACTS",
            "android.permission.READ_SMS",
            "android.permission.SEND_SMS",
            "android.permission.RECORD_AUDIO",
            "android.permission.ACCESS_FINE_LOCATION",
            "android.permission.ACCESS_BACKGROUND_LOCATION",
            "android.permission.READ_EXTERNAL_STORAGE",
            "android.permission.WRITE_EXTERNAL_STORAGE",
            "android.permission.CAMERA",
            "android.permission.READ_CALL_LOG",
            "android.permission.READ_PHONE_STATE",
            "android.permission.MANAGE_EXTERNAL_STORAGE",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.RECEIVE_BOOT_COMPLETED",
            "android.permission.SYSTEM_ALERT_WINDOW",
            "android.permission.REQUEST_INSTALL_PACKAGES"
        ],
        "expected_risk_band": "High",
        "expected_score_range": [60, 100],
        "notes": "Deliberately over-privileged. A calculator should not need contacts, SMS, microphone, location, camera, call logs, overlay, or install permissions."
    }
]


def get_demo_apps() -> list[dict]:
    """Return the demo app fixtures for analysis."""
    return [
        {
            "app_name": app["app_name"],
            "package_name": app["package_name"],
            "purpose": app["purpose"],
            "purpose_source": app["purpose_source"],
            "permissions": app["permissions"],
            "description": app.get("description", ""),
            "version": "1.0.0",
            "target_sdk": "34",
        }
        for app in DEMO_APPS
    ]


def get_ground_truth() -> list[dict]:
    """Return ground truth labels for evaluation."""
    return [
        {
            "app_name": app["app_name"],
            "package_name": app["package_name"],
            "purpose": app["purpose"],
            "expected_risk_band": app["expected_risk_band"],
            "expected_score_range": app["expected_score_range"],
            "notes": app["notes"],
            "permission_count": len(app["permissions"]),
        }
        for app in DEMO_APPS
    ]
