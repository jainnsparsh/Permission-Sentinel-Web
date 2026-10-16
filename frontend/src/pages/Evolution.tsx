import React, { useEffect, useState } from 'react';
import { GitCompare, ArrowRight, AlertCircle, Plus, Minus, TrendingUp, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { RiskBadge, StatusBadge, SeverityBadge } from '../components/Badges';
import type { EvolutionResult } from '../types';

const FALLBACK_PURPOSES = ['Calculator / Simple Utility', 'Maps / Navigation', 'Messaging / Communication', 'Weather', 'Other / Unknown'];
const VERDICT_STYLE: Record<string, { color: string; bg: string }> = {
  more_invasive: { color: 'var(--accent-red)', bg: 'rgba(187,69,72,0.10)' },
  notable_change: { color: 'var(--accent-amber)', bg: 'rgba(166,107,11,0.10)' },
  minor_change: { color: 'var(--accent-amber)', bg: 'rgba(166,107,11,0.08)' },
  less_invasive: { color: 'var(--accent-green)', bg: 'rgba(33,129,89,0.10)' },
  no_change: { color: 'var(--accent-green)', bg: 'rgba(33,129,89,0.08)' },
};
const short = (p: string) => p.split('.').pop() || p;

const FilePick: React.FC<{ label: string; file: File | null; onChange: (f: File | null) => void }> = ({ label, file, onChange }) => (
  <div className="form-group" style={{ flex: 1, minWidth: 240 }}>
    <label className="form-label">{label}</label>
    <input className="form-input" type="file" accept=".apk,.xml" onChange={e => onChange(e.target.files?.[0] || null)} />
    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{file ? file.name : 'APK or AndroidManifest.xml'}</div>
  </div>
);

export const Evolution: React.FC = () => {
  const [purposes, setPurposes] = useState<string[]>(FALLBACK_PURPOSES);
  const [purpose, setPurpose] = useState(FALLBACK_PURPOSES[0]);
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [result, setResult] = useState<EvolutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.purposes().then(r => { if (r.purposes?.length) { setPurposes(r.purposes); setPurpose(r.purposes[0]); } }).catch(() => {});
  }, []);

  const run = async (fn: () => Promise<EvolutionResult>) => {
    setLoading(true); setError('');
    try { setResult(await fn()); } catch (e) { setResult(null); setError(e instanceof Error ? e.message : 'Comparison failed'); }
    finally { setLoading(false); }
  };

  const v = result ? VERDICT_STYLE[result.verdict] : null;
  const delta = result?.score_delta ?? 0;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><GitCompare size={26} /> Permission Evolution</h1>
        <p>Compare two versions of an app and see whether an update made it more invasive.</p>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(187,69,72,0.4)', color: 'var(--accent-red)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <FilePick label="Old version" file={oldFile} onChange={setOldFile} />
          <FilePick label="New version (update)" file={newFile} onChange={setNewFile} />
          <div className="form-group" style={{ flex: 1, minWidth: 240 }}>
            <label className="form-label">App purpose</label>
            <select className="form-select" value={purpose} onChange={e => setPurpose(e.target.value)}>
              {purposes.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn btn-primary" disabled={!oldFile || !newFile || loading}
            onClick={() => run(() => api.compareVersions(oldFile!, newFile!, purpose))}>
            Compare versions <ArrowRight size={16} />
          </button>
          <button className="btn btn-secondary" disabled={loading} onClick={() => run(() => api.compareDemo('calculator'))}>
            <Sparkles size={16} /> Demo: calculator update
          </button>
          <button className="btn btn-secondary" disabled={loading} onClick={() => run(() => api.compareDemo('maps'))}>
            <Sparkles size={16} /> Demo: maps app update
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 12 }}>Files are analysed in memory and are not stored.</p>
      </div>

      {loading && <div className="card">Comparing…</div>}

      {result && v && !loading && (
        <>
          <div className="card" style={{ marginBottom: 24, background: v.bg, borderColor: v.color }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: v.color, fontSize: '1.15rem', fontWeight: 700 }}>
              <TrendingUp size={22} /> {result.verdict_label}
            </div>
            <p style={{ margin: '8px 0' }}>{result.summary}</p>
            {result.flags.length > 0 && <ul style={{ margin: '0 0 8px 18px' }}>{result.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
            <p style={{ margin: 0, fontWeight: 600 }}>{result.recommendation}</p>
          </div>

          {result.warnings.map((w, i) => (
            <div key={i} className="card" style={{ marginBottom: 12, color: 'var(--accent-amber)', display: 'flex', gap: 8 }}><AlertCircle size={18} /> {w}</div>
          ))}

          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[result.old, result.new].map((x, i) => (
              <div className="stat-card" key={i}>
                <div className="stat-label">{i === 0 ? 'Old' : 'New'} version {x.version && `(v${x.version})`}</div>
                <div className="stat-value">{x.score}</div>
                <RiskBadge band={x.risk_band} size="sm" />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>{x.permission_count} permissions</div>
              </div>
            ))}
            <div className="stat-card">
              <div className="stat-label">Risk change</div>
              <div className="stat-value" style={{ color: delta > 0 ? 'var(--accent-red)' : delta < 0 ? 'var(--accent-green)' : undefined }}>{delta > 0 ? '+' : ''}{delta}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{result.old.risk_band} → {result.new.risk_band}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Unchanged</div>
              <div className="stat-value">{result.unchanged_count}</div>
            </div>
          </div>

          {result.added.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ color: 'var(--accent-red)', display: 'flex', gap: 8, alignItems: 'center' }}><Plus size={18} /> Added in the update ({result.added.length})</h3>
              <table className="data-table">
                <thead><tr><th>Permission</th><th>Verdict for this app</th><th>Severity</th><th>Score impact</th><th>Why it matters</th></tr></thead>
                <tbody>{result.added.map(a => (
                  <tr key={a.permission}>
                    <td><strong>{a.label}</strong><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{short(a.permission)}</div></td>
                    <td><StatusBadge status={a.status} /></td>
                    <td><SeverityBadge severity={a.severity} /></td>
                    <td>+{a.score_impact}</td>
                    <td style={{ fontSize: '0.8rem' }}>{a.reason}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}

          {result.escalations.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ color: 'var(--accent-amber)' }}>Access upgraded</h3>
              {result.escalations.map((e, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <code>{short(e.from)}</code> <ArrowRight size={14} style={{ verticalAlign: 'middle' }} /> <code>{short(e.to)}</code>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{e.why}</div>
                </div>))}
            </div>
          )}

          {result.new_combinations.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ color: 'var(--accent-red)' }}>New risky combinations</h3>
              {result.new_combinations.map(c => (
                <div key={c.rule_id} style={{ marginBottom: 10 }}>
                  <strong>{c.rule_id}</strong>: {c.matched_permissions.map(short).join(' + ')}
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{c.explanation}</div>
                </div>))}
            </div>
          )}

          {result.removed.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ color: 'var(--accent-green)', display: 'flex', gap: 8, alignItems: 'center' }}><Minus size={18} /> Removed in the update ({result.removed.length})</h3>
              {result.removed.map(r => <div key={r.permission}>{r.label} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({short(r.permission)})</span></div>)}
            </div>
          )}

          {result.classification_changes.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3>Reclassified</h3>
              {result.classification_changes.map(c => (
                <div key={c.permission}>{short(c.permission)}: {c.from_status} / {c.from_severity} → {c.to_status} / {c.to_severity}</div>))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Evolution;
