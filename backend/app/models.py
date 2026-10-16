"""
Permission Sentinel - Pydantic Models
Request/response schemas and internal data models.
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class PurposeSource(str, Enum):
    USER_SELECTED = "user-selected"
    INFERRED = "inferred"
    PROVIDED = "provided"


class InputSource(str, Enum):
    APK = "apk"
    MANIFEST_XML = "manifest-xml"
    JSON_REPORT = "json-report"
    CSV_REPORT = "csv-report"
    DEMO = "demo"


class RelevanceStatus(str, Enum):
    EXPECTED = "expected"
    CONTEXT_DEPENDENT = "context-dependent"
    UNEXPECTED = "unexpected"
    POLICY_VIOLATION = "policy-violation"
    UNKNOWN = "unknown"


class SeverityTier(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"


class RiskBand(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


# === Request Models ===

class AnalyzeRequest(BaseModel):
    """Request model for analyzing a permission report."""
    app_name: str = Field(..., min_length=1, max_length=200)
    package_name: str = Field(default="", max_length=300)
    purpose: str = Field(..., min_length=1)
    purpose_source: str = Field(default="user-selected")
    permissions: list[str] = Field(default_factory=list)
    description: Optional[str] = Field(default=None)
    version: Optional[str] = Field(default=None)
    target_sdk: Optional[str] = Field(default=None)
    source: Optional[str] = Field(default=None)


class BatchAnalyzeRequest(BaseModel):
    """Request model for batch analysis from JSON/CSV."""
    apps: list[AnalyzeRequest]


class UploadAnalyzeRequest(BaseModel):
    """Metadata for file upload analysis."""
    purpose: str = Field(..., min_length=1)
    purpose_source: str = Field(default="user-selected")


class PolicyCreateRequest(BaseModel):
    """Request model for creating a policy."""
    name: str = Field(..., min_length=1, max_length=200)
    enabled: bool = Field(default=True)
    blocked_permissions: list[str] = Field(default_factory=list)
    allowed_permissions: list[str] = Field(default_factory=list)
    purpose_specific_rules: dict = Field(default_factory=dict)
    alert_on_special_permissions: bool = Field(default=True)
    score_threshold: Optional[int] = Field(default=None, ge=0, le=100)


class PolicyUpdateRequest(BaseModel):
    """Request model for updating a policy."""
    name: Optional[str] = Field(default=None, max_length=200)
    enabled: Optional[bool] = None
    blocked_permissions: Optional[list[str]] = None
    allowed_permissions: Optional[list[str]] = None
    purpose_specific_rules: Optional[dict] = None
    alert_on_special_permissions: Optional[bool] = None
    score_threshold: Optional[int] = Field(default=None, ge=0, le=100)


class UpdateNotesRequest(BaseModel):
    """Request for updating user notes on an analysis."""
    notes: str = Field(default="", max_length=5000)


# === Response Models ===

class PermissionFindingResponse(BaseModel):
    permission: str
    label: str
    status: str
    severity: str
    base_weight: int
    reason: str
    evidence_rule_ids: list[str]
    confidence: str
    recommendation: str
    data_exposed: str
    caveat: str


class CombinationFindingResponse(BaseModel):
    rule_id: str
    matched_permissions: list[str]
    explanation: str
    confidence: str
    recommendation: str
    severity: str


class ScoreBreakdown(BaseModel):
    sensitivity_score: int = 0
    purpose_mismatch_score: int = 0
    combination_score: int = 0
    policy_violation_score: int = 0
    context_amplifier_score: int = 0
    total: int = 0
    details: dict = Field(default_factory=dict)


class AnalysisResponse(BaseModel):
    id: str
    package_name: str
    app_name: str
    version: str
    target_sdk: str
    selected_purpose: str
    purpose_source: str
    input_source: str
    created_at: str
    knowledge_base_version: str
    score: int
    risk_band: str
    score_breakdown: dict
    permissions_raw: list[str]
    permission_findings: list[dict] = Field(default_factory=list)
    combination_findings: list[dict] = Field(default_factory=list)
    status_counts: dict = Field(default_factory=dict)
    user_notes: str = ""
    finding_count: int = 0
    combination_finding_count: int = 0
    metadata_json: dict = Field(default_factory=dict)


class AnalysisSummaryResponse(BaseModel):
    id: str
    package_name: str
    app_name: str
    selected_purpose: str
    purpose_source: str
    input_source: str
    created_at: str
    score: int
    risk_band: str
    finding_count: int = 0
    combination_finding_count: int = 0
    status_counts: dict = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    knowledge_base_version: str
