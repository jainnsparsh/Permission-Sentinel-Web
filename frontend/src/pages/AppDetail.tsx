import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  Trash2, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Save, 
  Search, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';
import type { AppAnalysis, PermissionFinding, CombinationFinding } from '../types';
import { ScoreGauge } from '../components/ScoreGauge';
import { RiskBadge, StatusBadge, SeverityBadge } from '../components/Badges';
import { downloadAnalysisJson, downloadAnalysisPdf } from '../utils/reportExport';

export const AppDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<AppAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedPerms, setExpandedPerms] = useState<Record<string, boolean>>({});

  // Notes state
  const [notes, setNotes] = useState<string>('');
  const [notesSaving, setNotesSaving] = useState<boolean>(false);
  const [notesSavedNotice, setNotesSavedNotice] = useState<boolean>(false);

  // Re-analyze state
  const [reanalyzing, setReanalyzing] = useState<boolean>(false);
  const [newPurpose, setNewPurpose] = useState<string>('');
  const [purposesList, setPurposesList] = useState<string[]>([]);
  const [showReanalyzeModal, setShowReanalyzeModal] = useState<boolean>(false);

  const fetchAppDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getApp(id);
      const appData = res as AppAnalysis;
      setApp(appData);
      setNotes(appData.user_notes || '');
      setNewPurpose(appData.selected_purpose);

      // Auto-expand unexpected and policy violation permissions
      const initialExpanded: Record<string, boolean> = {};
      appData.permission_findings?.forEach(f => {
        if (f.status === 'unexpected' || f.status === 'policy-violation') {
          initialExpanded[f.permission] = true;
        }
      });
      setExpandedPerms(initialExpanded);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load app analysis details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppDetail();
    api.purposes().then(r => setPurposesList(r.purposes || [])).catch(() => {});
  }, [id]);

  const handleSaveNotes = async () => {
    if (!id) return;
    try {
      setNotesSaving(true);
      await api.updateNotes(id, notes);
      setNotesSavedNotice(true);
      setTimeout(() => setNotesSavedNotice(false), 2500);
    } catch (err: unknown) {
      alert(`Failed to save notes: ${err instanceof Error ? err.message : err}`);
    } finally {
      setNotesSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Delete this application audit record?')) return;
    try {
      await api.deleteApp(id);
      navigate('/');
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleReanalyze = async () => {
    if (!app || !newPurpose) return;
    try {
      setReanalyzing(true);
      const res = await api.analyzeReport({
        app_name: app.app_name,
        package_name: app.package_name,
        purpose: newPurpose,
        purpose_source: 'user-override',
        permissions: app.permissions_raw,
        version: app.version,
        target_sdk: app.target_sdk,
      }) as { id: string };

      setShowReanalyzeModal(false);
      navigate(`/app/${res.id}`);
    } catch (err: unknown) {
      alert(`Re-analysis failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setReanalyzing(false);
    }
  };

  const toggleExpand = (perm: string) => {
    setExpandedPerms(prev => ({
      ...prev,
      [perm]: !prev[perm],
    }));
  };

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
        <p>Loading application risk breakdown and explainability report...</p>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="fade-in" style={{ padding: '40px 0' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <div className="notice error">
          <AlertTriangle size={18} />
          <div>{error || 'App analysis record not found'}</div>
        </div>
      </div>
    );
  }

  // Filter permissions
  const filteredFindings = (app.permission_findings || []).filter(finding => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      finding.permission.toLowerCase().includes(q) ||
      finding.label.toLowerCase().includes(q) ||
      finding.reason?.toLowerCase().includes(q);
    
    const matchesStatus = statusFilter === 'all' || finding.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const breakdown = app.score_breakdown || {
    sensitivity_score: 0,
    purpose_mismatch_score: 0,
    combination_score: 0,
    policy_violation_score: 0,
    context_amplifier_score: 0,
    total: app.score,
    details: {
      sensitivity_permissions: [],
      unexpected_permissions: [],
      combination_rules_triggered: [],
      policy_violations: [],
      context_amplifiers: [],
    }
  };

  const unexpectedCount = app.status_counts?.unexpected || 0;
  const contextCount = app.status_counts?.['context-dependent'] || 0;
  const expectedCount = app.status_counts?.expected || 0;
  const policyViolationsCount = app.status_counts?.['policy-violation'] || 0;

  return (
    <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Top Navigation & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setShowReanalyzeModal(true)}
          >
            <RefreshCw size={14} />
            Re-audit with New Purpose
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadAnalysisPdf({ ...app, user_notes: notes })}
            title="Download a readable PDF of this analysis report"
          >
            <Download size={14} /> Download Report (PDF)
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => downloadAnalysisJson({ ...app, user_notes: notes })}
            style={{ border: '1px solid var(--border-subtle)' }}
            title="Download the current analysis data as JSON"
          >
            <Download size={14} /> JSON
          </button>
          <a 
            className="btn btn-ghost btn-sm" 
            href={api.exportAnalysisCsv(app.id)} 
            download={`${app.package_name || 'audit'}_report.csv`}
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <Download size={14} /> CSV
          </a>
          <button 
            className="btn btn-danger btn-sm" 
            onClick={handleDelete}
            title="Delete Analysis"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* App Header Banner */}
      <div className="card" style={{ marginBottom: '24px', background: 'var(--bg-glass)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {app.app_name || 'Application Audit'}
              </h1>
              <RiskBadge band={app.risk_band} />
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '12px' }}>
              {app.package_name || 'com.example.unknown'}
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div>Declared Purpose: <strong style={{ color: 'var(--accent-indigo)' }}>{app.selected_purpose}</strong></div>
              <div>Provenance: <span style={{ textTransform: 'capitalize' }}>{app.purpose_source}</span></div>
              <div>Input Source: <span style={{ textTransform: 'uppercase' }}>{app.input_source}</span></div>
              <div>Target SDK: <strong>{app.target_sdk || 'N/A'}</strong></div>
              <div>Version: <strong>{app.version || '1.0.0'}</strong></div>
              <div>Audited: <strong>{app.created_at ? new Date(app.created_at).toLocaleString() : 'N/A'}</strong></div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>KB Engine Version</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {app.knowledge_base_version || 'v1.0.0'}
            </div>
          </div>
        </div>
      </div>

      {/* Score Overview & Explainable Breakdown Section */}
      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        {/* Left: Score Gauge & Risk Diagnosis */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '32px' }}>
          <div style={{ marginBottom: '16px' }}>
            <ScoreGauge score={app.score} size={150} strokeWidth={14} />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <RiskBadge band={app.risk_band} />
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '360px', marginTop: '8px' }}>
            {app.score >= 60 
              ? `High Risk: ${unexpectedCount} unnecessary high-sensitivity permission(s) and dangerous combination rules detected for a ${app.selected_purpose} app.`
              : app.score >= 30
              ? `Moderate Risk: Permissions require context verification or feature disclosure.`
              : `Low Risk: Requested permissions closely align with expected capabilities for ${app.selected_purpose}.`}
          </p>
        </div>

        {/* Right: Transparent Formula Decomposition */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Zap size={18} style={{ color: 'var(--accent-indigo)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Deterministic Score Decomposition</h3>
          </div>

          {/* Visual Stacked Bar */}
          <div className="breakdown-bar" style={{ height: '10px' }}>
            <div 
              className="breakdown-segment" 
              style={{ width: `${breakdown.sensitivity_score}%`, background: 'var(--accent-blue)' }} 
              title={`Sensitivity: +${breakdown.sensitivity_score}`}
            />
            <div 
              className="breakdown-segment" 
              style={{ width: `${breakdown.purpose_mismatch_score}%`, background: 'var(--accent-red)' }} 
              title={`Purpose Mismatch: +${breakdown.purpose_mismatch_score}`}
            />
            <div 
              className="breakdown-segment" 
              style={{ width: `${breakdown.combination_score}%`, background: 'var(--accent-purple)' }} 
              title={`Combinations: +${breakdown.combination_score}`}
            />
            <div 
              className="breakdown-segment" 
              style={{ width: `${breakdown.policy_violation_score}%`, background: 'var(--accent-pink)' }} 
              title={`Policy Violations: +${breakdown.policy_violation_score}`}
            />
            <div 
              className="breakdown-segment" 
              style={{ width: `${breakdown.context_amplifier_score}%`, background: 'var(--accent-amber)' }} 
              title={`Context Amplifiers: +${breakdown.context_amplifier_score}`}
            />
          </div>

          {/* Breakdown Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-blue)' }} />
                <span>Base Sensitivity (Top 3 weights, cap 60)</span>
              </div>
              <strong style={{ color: 'var(--accent-blue)' }}>+{breakdown.sensitivity_score}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-red)' }} />
                <span>Purpose Mismatch (+12 / unexpected, cap 30)</span>
              </div>
              <strong style={{ color: 'var(--accent-red)' }}>+{breakdown.purpose_mismatch_score}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-purple)' }} />
                <span>Dangerous Combinations (+8 / rule, cap 16)</span>
              </div>
              <strong style={{ color: 'var(--accent-purple)' }}>+{breakdown.combination_score}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-pink)' }} />
                <span>Security Policy Violations (+15 / rule, cap 30)</span>
              </div>
              <strong style={{ color: 'var(--accent-pink)' }}>+{breakdown.policy_violation_score}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-amber)' }} />
                <span>Context Amplifiers (Cap 8)</span>
              </div>
              <strong style={{ color: 'var(--accent-amber)' }}>+{breakdown.context_amplifier_score}</strong>
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingTop: '10px', 
              borderTop: '1px solid var(--border-subtle)', 
              fontWeight: 700, 
              fontSize: '0.95rem' 
            }}>
              <span>Total Audit Score (Clamped 0–100)</span>
              <span style={{ color: 'var(--text-primary)' }}>{app.score} / 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Counters Bar */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card red" style={{ padding: '14px 18px' }}>
          <div>
            <div className="stat-value" style={{ color: 'var(--accent-red)', fontSize: '1.5rem' }}>{unexpectedCount}</div>
            <div className="stat-label">Unexpected (Excessive)</div>
          </div>
        </div>

        <div className="stat-card amber" style={{ padding: '14px 18px' }}>
          <div>
            <div className="stat-value" style={{ color: 'var(--accent-amber)', fontSize: '1.5rem' }}>{contextCount}</div>
            <div className="stat-label">Context-Dependent</div>
          </div>
        </div>

        <div className="stat-card green" style={{ padding: '14px 18px' }}>
          <div>
            <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: '1.5rem' }}>{expectedCount}</div>
            <div className="stat-label">Expected for Purpose</div>
          </div>
        </div>

        <div className="stat-card blue" style={{ padding: '14px 18px' }}>
          <div>
            <div className="stat-value" style={{ color: 'var(--accent-pink)', fontSize: '1.5rem' }}>{policyViolationsCount}</div>
            <div className="stat-label">Policy Violations</div>
          </div>
        </div>
      </div>

      {/* Dangerous Combination Rules Section (if any detected) */}
      {(app.combination_findings || []).length > 0 && (
        <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--accent-purple)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <ShieldAlert size={20} style={{ color: 'var(--accent-purple)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>High-Risk Combination Patterns Detected</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            These permissions may individually appear benign, but in combination they represent severe exfiltration, stalking, or covert recording vectors.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {app.combination_findings.map((comb: CombinationFinding, idx: number) => (
              <div 
                key={idx} 
                style={{ 
                  background: 'var(--bg-secondary)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '16px',
                  border: '1px solid rgba(167, 139, 250, 0.2)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {comb.matched_permissions.map(p => (
                      <span key={p} className="chip" style={{ background: 'rgba(167, 139, 250, 0.15)', color: 'var(--accent-purple)' }}>
                        {p.replace('android.permission.', '')}
                      </span>
                    ))}
                  </div>
                  <SeverityBadge severity={comb.severity as any} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Rule ID: {comb.rule_id}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {comb.explanation}
                </div>
                {comb.recommendation && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-indigo)', background: 'rgba(99, 102, 241, 0.08)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    💡 <strong>Remediation:</strong> {comb.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permission Findings Detail Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Permission Findings Breakdown</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Deterministic mapping of each requested permission against the security knowledge base
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: '200px' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                placeholder="Search permission..."
                className="form-input"
                style={{ paddingLeft: '32px', height: '34px', fontSize: '0.8rem' }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              style={{ height: '34px', padding: '4px 28px 4px 10px', fontSize: '0.8rem' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses ({app.permission_findings?.length || 0})</option>
              <option value="unexpected">Unexpected ({unexpectedCount})</option>
              <option value="context-dependent">Context-Dependent ({contextCount})</option>
              <option value="policy-violation">Policy Violations ({policyViolationsCount})</option>
              <option value="expected">Expected ({expectedCount})</option>
            </select>
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <CheckCircle />
            <h3>No Permissions Match Filters</h3>
            <p>Try clearing your search query or selecting a different status filter.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredFindings.map((finding: PermissionFinding) => {
              const isExpanded = !!expandedPerms[finding.permission];
              const statusClass = finding.status.toLowerCase();

              return (
                <div 
                  key={finding.permission} 
                  className={`finding-card ${statusClass}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleExpand(finding.permission)}
                >
                  {/* Summary Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(finding.permission);
                        }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {finding.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {finding.permission}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Weight: <strong>{finding.base_weight}</strong>
                      </span>
                      <SeverityBadge severity={finding.severity} />
                      <StatusBadge status={finding.status} />
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div 
                      style={{ 
                        marginTop: '14px', 
                        paddingTop: '14px', 
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        fontSize: '0.85rem'
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>Analysis & Rationale:</strong>
                        <div style={{ marginTop: '4px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                          {finding.reason}
                        </div>
                      </div>

                      {finding.data_exposed && (
                        <div>
                          <strong style={{ color: 'var(--accent-amber)' }}>Data at Risk:</strong>
                          <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}>
                            {finding.data_exposed}
                          </div>
                        </div>
                      )}

                      {finding.recommendation && (
                        <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                          <strong style={{ color: 'var(--accent-indigo)' }}>Actionable Remediation:</strong>
                          <div style={{ marginTop: '4px', color: 'var(--text-primary)' }}>
                            {finding.recommendation}
                          </div>
                        </div>
                      )}

                      {finding.caveat && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          ℹ️ Note: {finding.caveat}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '6px' }}>
                        <span>Confidence: <strong>{finding.confidence || 'deterministic'}</strong></span>
                        <span>Evidence Rule IDs: <code>{(finding.evidence_rule_ids || []).join(', ') || 'N/A'}</code></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auditor Notes Section */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Auditor Notes & Manual Review Assessment</h3>
          {notesSavedNotice && (
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 600 }}>
              ✓ Saved successfully
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Record custom security justifications, compliance exceptions, or developer interview observations.
        </p>

        <textarea
          className="form-textarea"
          rows={4}
          placeholder="e.g. Developer confirmed READ_CONTACTS is an optional feature for friend invites; recommended removing from mandatory permissions list..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{ marginBottom: '12px' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={handleSaveNotes}
            disabled={notesSaving}
          >
            <Save size={14} />
            {notesSaving ? 'Saving...' : 'Save Auditor Notes'}
          </button>
        </div>
      </div>

      {/* Re-analyze Modal */}
      {showReanalyzeModal && (
        <div className="modal-overlay" onClick={() => setShowReanalyzeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
              Re-evaluate Under Different Purpose
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              See how the risk score and excessive permission findings change if this app is categorized under a different purpose.
            </p>

            <div className="form-group">
              <label className="form-label">Select Purpose Benchmark</label>
              <select
                className="form-select"
                value={newPurpose}
                onChange={e => setNewPurpose(e.target.value)}
              >
                {purposesList.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button className="btn btn-ghost" onClick={() => setShowReanalyzeModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleReanalyze}
                disabled={reanalyzing}
              >
                {reanalyzing ? 'Evaluating...' : 'Re-run Evaluation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppDetail;
