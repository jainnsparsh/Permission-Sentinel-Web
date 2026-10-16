import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Plus, 
  Download, 
  Trash2, 
  Eye, 
  Search, 
  Sparkles,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import type { AppAnalysis, RiskBand } from '../types';
import { RiskBadge } from '../components/Badges';

const RISK_COLORS = {
  High: '#c24d43',
  Medium: '#d18a1c',
  Low: '#277d58',
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppAnalysis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBand, setFilterBand] = useState<string>('all');
  const [demoLoading, setDemoLoading] = useState<boolean>(false);

  const fetchApps = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.listApps();
      setApps((res.apps || []) as AppAnalysis[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load applications';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleRunDemo = async () => {
    try {
      setDemoLoading(true);
      await api.analyzeDemoApps();
      await fetchApps();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze demo fixtures';
      alert(`Error loading demo apps: ${msg}`);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this analysis?')) return;
    try {
      await api.deleteApp(id);
      setApps(prev => prev.filter(a => a.id !== id));
    } catch (err: unknown) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : err}`);
    }
  };

  const filteredApps = apps.filter(app => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = 
      app.app_name?.toLowerCase().includes(q) ||
      app.package_name?.toLowerCase().includes(q) ||
      app.selected_purpose?.toLowerCase().includes(q);
    const matchesBand = filterBand === 'all' || app.risk_band === filterBand;
    return matchesQuery && matchesBand;
  });

  // Calculate metrics
  const totalApps = apps.length;
  const highRiskCount = apps.filter(a => a.risk_band === 'High').length;
  const mediumRiskCount = apps.filter(a => a.risk_band === 'Medium').length;
  const lowRiskCount = apps.filter(a => a.risk_band === 'Low').length;
  const avgScore = totalApps > 0 ? Math.round(apps.reduce((acc, a) => acc + (a.score || 0), 0) / totalApps) : 0;
  
  const totalViolations = apps.reduce((acc, a) => {
    return acc + (a.score_breakdown?.details?.policy_violations?.length || 0);
  }, 0);

  // Chart data
  const pieData = [
    { name: 'High Risk', value: highRiskCount, color: RISK_COLORS.High },
    { name: 'Medium Risk', value: mediumRiskCount, color: RISK_COLORS.Medium },
    { name: 'Low Risk', value: lowRiskCount, color: RISK_COLORS.Low },
  ].filter(d => d.value > 0);

  const topScoringApps = [...apps]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(a => ({
      name: a.app_name.length > 14 ? a.app_name.substring(0, 12) + '...' : a.app_name,
      score: a.score,
      band: a.risk_band,
    }));

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h2>Security & Permission Auditor</h2>
          <p>Local-first explainable Android permission risk assessment dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleRunDemo} 
            disabled={demoLoading}
            title="Load 8 built-in sample applications with ground-truth security benchmarks"
          >
            <Sparkles size={16} />
            {demoLoading ? 'Auditing Demo Apps...' : 'Run Demo Benchmarks'}
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate('/analyze')}
          >
            <Plus size={16} />
            Analyze App
          </button>
          {apps.length > 0 && (
            <a 
              className="btn btn-ghost" 
              href={api.exportAppsCsv()} 
              download="permission_audit_report.csv"
              style={{ border: '1px solid var(--border-subtle)' }}
            >
              <Download size={16} />
              Export CSV
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="notice error">
          <AlertTriangle size={18} />
          <div>{error} (Ensure backend server is running on http://localhost:8000)</div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon blue">
            <FolderOpen size={24} />
          </div>
          <div>
            <div className="stat-value">{totalApps}</div>
            <div className="stat-label">Total Audited Apps</div>
          </div>
        </div>

        <div className="stat-card red">
          <div className="stat-icon red">
            <ShieldAlert size={24} />
          </div>
          <div>
            <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{highRiskCount}</div>
            <div className="stat-label">High Risk Anomalies</div>
          </div>
        </div>

        <div className="stat-card amber">
          <div className="stat-icon amber">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>{avgScore}</div>
            <div className="stat-label">Average Risk Score</div>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon green">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{lowRiskCount}</div>
            <div className="stat-label">Compliant / Low Risk</div>
          </div>
        </div>
      </div>

      {/* Visual Charts (Show if apps exist) */}
      {apps.length > 0 && (
        <div className="dashboard-grid">
          {/* Risk Band Distribution */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
              Risk Band Distribution
            </h3>
            {pieData.length > 0 ? (
              <div style={{ height: '220px', display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '40%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: RISK_COLORS.High }} />
                    <span>High Risk: <strong>{highRiskCount}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: RISK_COLORS.Medium }} />
                    <span>Medium Risk: <strong>{mediumRiskCount}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: RISK_COLORS.Low }} />
                    <span>Low Risk: <strong>{lowRiskCount}</strong></span>
                  </div>
                  {totalViolations > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--accent-pink)' }}>
                      ⚠️ {totalViolations} Active Policy Violations
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No data</div>
            )}
          </div>

          {/* Highest Risk Apps Chart */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
              Highest Risk Apps (Scores out of 100)
            </h3>
            <div style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topScoringApps} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <XAxis type="number" domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={11} width={80} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Bar 
                    dataKey="score" 
                    fill="#d78220" 
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Apps Table Section */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Audited Applications</h3>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                placeholder="Search by name, package..."
                className="form-input"
                style={{ paddingLeft: '36px', height: '36px', fontSize: '0.8rem' }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              style={{ height: '36px', padding: '6px 32px 6px 12px', fontSize: '0.8rem', minWidth: '130px' }}
              value={filterBand}
              onChange={e => setFilterBand(e.target.value)}
            >
              <option value="all">All Risk Bands</option>
              <option value="High">High Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
            </select>

            <button 
              className="btn btn-ghost btn-sm" 
              onClick={fetchApps} 
              title="Refresh"
              style={{ border: '1px solid var(--border-subtle)' }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>Loading audited applications...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="empty-state">
            <ShieldAlert />
            <h3>No Analyzed Applications Found</h3>
            <p style={{ marginBottom: '20px' }}>
              {apps.length === 0 
                ? 'Get started by running the built-in demo benchmark apps or upload your own APK, Manifest, or JSON report.'
                : 'No applications match your search filter criteria.'}
            </p>
            {apps.length === 0 && (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={handleRunDemo} disabled={demoLoading}>
                  <Sparkles size={16} />
                  {demoLoading ? 'Running...' : 'Run Demo Benchmarks'}
                </button>
                <button className="btn btn-primary" onClick={() => navigate('/analyze')}>
                  <Plus size={16} />
                  Analyze Your First App
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Purpose</th>
                  <th>Input Type</th>
                  <th>Total Perms</th>
                  <th>Unexpected / Context</th>
                  <th>Score & Band</th>
                  <th>Audited At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map(app => {
                  const unexpected = app.status_counts?.unexpected || 0;
                  const contextDep = app.status_counts?.['context-dependent'] || 0;
                  const dateStr = app.created_at ? new Date(app.created_at).toLocaleDateString() : 'N/A';

                  return (
                    <tr 
                      key={app.id} 
                      onClick={() => navigate(`/app/${app.id}`)}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {app.app_name || 'Unnamed App'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {app.package_name || 'N/A'}
                        </div>
                      </td>
                      <td>
                        <span className="chip">
                          {app.selected_purpose}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        {app.input_source}
                      </td>
                      <td>
                        <strong>{app.permissions_raw?.length || 0}</strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {unexpected > 0 && (
                            <span style={{ color: 'var(--accent-red)', fontSize: '0.75rem', fontWeight: 600 }}>
                              {unexpected} unexpected
                            </span>
                          )}
                          {contextDep > 0 && (
                            <span style={{ color: 'var(--accent-amber)', fontSize: '0.75rem', fontWeight: 600 }}>
                              {contextDep} context
                            </span>
                          )}
                          {unexpected === 0 && contextDep === 0 && (
                            <span style={{ color: 'var(--accent-green)', fontSize: '0.75rem' }}>
                              Clean
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: '28px' }}>
                            {app.score}
                          </span>
                          <RiskBadge band={app.risk_band as RiskBand} size="sm" />
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {dateStr}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/${app.id}`);
                            }}
                            title="View Audit Details"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => handleDeleteApp(app.id, e)}
                            title="Delete Analysis"
                            style={{ color: 'var(--accent-red)' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
