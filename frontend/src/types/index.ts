// Permission Sentinel - TypeScript Types

export interface PermissionFinding {
  permission: string;
  label: string;
  status: 'expected' | 'context-dependent' | 'unexpected' | 'policy-violation' | 'unknown';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  base_weight: number;
  reason: string;
  evidence_rule_ids: string[];
  confidence: string;
  recommendation: string;
  data_exposed: string;
  caveat: string;
}

export interface CombinationFinding {
  rule_id: string;
  matched_permissions: string[];
  explanation: string;
  confidence: string;
  recommendation: string;
  severity: string;
}

export interface ScoreBreakdown {
  sensitivity_score: number;
  purpose_mismatch_score: number;
  combination_score: number;
  policy_violation_score: number;
  context_amplifier_score: number;
  total: number;
  details: {
    sensitivity_permissions: { permission: string; weight: number }[];
    unexpected_permissions: string[];
    combination_rules_triggered: string[];
    policy_violations: string[];
    context_amplifiers: { reason: string; contribution: number }[];
  };
}

export interface AppAnalysis {
  id: string;
  package_name: string;
  app_name: string;
  version: string;
  target_sdk: string;
  selected_purpose: string;
  purpose_source: string;
  input_source: string;
  created_at: string;
  knowledge_base_version: string;
  score: number;
  risk_band: 'Low' | 'Medium' | 'High';
  score_breakdown: ScoreBreakdown;
  permissions_raw: string[];
  permission_findings: PermissionFinding[];
  combination_findings: CombinationFinding[];
  status_counts: Record<string, number>;
  user_notes: string;
  finding_count: number;
  combination_finding_count: number;
  metadata_json: Record<string, unknown>;
}

export interface Policy {
  id: string;
  name: string;
  enabled: boolean;
  policy_json: {
    blocked_permissions: string[];
    allowed_permissions: string[];
    purpose_specific_rules: Record<string, unknown>;
    alert_on_special_permissions: boolean;
    score_threshold: number | null;
  };
  created_at: string;
  updated_at: string;
}

export interface DemoResult {
  id: string;
  app_name: string;
  score: number;
  risk_band: string;
  finding_count: number;
}

export type RiskBand = 'Low' | 'Medium' | 'High';
export type RelevanceStatus = PermissionFinding['status'];
export type SeverityTier = PermissionFinding['severity'];

export interface EvolutionVersion {
  app_name: string; package_name: string; version: string; target_sdk: string;
  score: number; risk_band: RiskBand; permission_count: number;
}
export interface EvolutionAdded {
  permission: string; label: string; status: RelevanceStatus; severity: SeverityTier;
  reason: string; recommendation: string; data_exposed: string; score_impact: number;
}
export interface EvolutionResult {
  verdict: 'more_invasive' | 'notable_change' | 'minor_change' | 'less_invasive' | 'no_change';
  verdict_label: string; summary: string; flags: string[]; recommendation: string; purpose: string;
  old: EvolutionVersion; new: EvolutionVersion; score_delta: number; band_changed: boolean;
  added: EvolutionAdded[];
  removed: { permission: string; label: string; status: RelevanceStatus; severity: SeverityTier; score_impact: number }[];
  unchanged_count: number;
  escalations: { from: string; to: string; why: string; kind: 'upgraded' | 'replaced' }[];
  classification_changes: { permission: string; from_status: string; to_status: string; from_severity: string; to_severity: string }[];
  new_combinations: CombinationFinding[]; resolved_combinations: CombinationFinding[];
  warnings: string[];
}
