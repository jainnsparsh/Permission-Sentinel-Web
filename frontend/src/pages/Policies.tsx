import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Shield, 
  Info, 
  X 
} from 'lucide-react';
import { api } from '../services/api';
import type { Policy } from '../types';

export const Policies: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New policy modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [newPolicyName, setNewPolicyName] = useState<string>('');
  const [blockedInput, setBlockedInput] = useState<string>('android.permission.READ_SMS\nandroid.permission.RECEIVE_SMS');
  const [scoreThreshold, setScoreThreshold] = useState<number>(60);
  const [creating, setCreating] = useState<boolean>(false);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.listPolicies();
      setPolicies((res.policies || []) as Policy[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load security policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleTogglePolicy = async (policy: Policy) => {
    try {
      const updated = !policy.enabled;
      await api.updatePolicy(policy.id, { enabled: updated });
      setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, enabled: updated } : p));
    } catch (err: unknown) {
      alert(`Failed to update policy: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleDeletePolicy = async (id: string) => {
    if (!window.confirm('Delete this security policy?')) return;
    try {
      await api.deletePolicy(id);
      setPolicies(prev => prev.filter(p => p.id !== id));
    } catch (err: unknown) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyName.trim()) {
      alert('Please enter a policy name');
      return;
    }

    const blocked = blockedInput
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    try {
      setCreating(true);
      await api.createPolicy({
        name: newPolicyName.trim(),
        enabled: true,
        blocked_permissions: blocked,
        allowed_permissions: [],
        score_threshold: scoreThreshold,
        alert_on_special_permissions: true,
      });

      setShowModal(false);
      setNewPolicyName('');
      setBlockedInput('');
      fetchPolicies();
    } catch (err: unknown) {
      alert(`Failed to create policy: ${err instanceof Error ? err.message : err}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h2>Security & Compliance Policies</h2>
          <p>Enforce custom organizational guardrails, blocked permissions, and risk thresholds</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Create Policy
        </button>
      </div>

      <div className="notice info" style={{ marginBottom: '24px' }}>
        <Info size={18} />
        <div>
          When enabled, active policies automatically flag violations during analysis. Each policy violation contributes <strong>+15 points</strong> to the app risk score and surfaces prominently on the audit dashboard.
        </div>
      </div>

      {error && (
        <div className="notice error">
          <AlertTriangle size={18} />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" />
          <p>Loading policies...</p>
        </div>
      ) : policies.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Shield />
            <h3>No Security Policies Configured</h3>
            <p style={{ marginBottom: '20px' }}>
              Create an organizational policy to restrict high-risk permissions such as SMS access, location tracking, or microphone access.
            </p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Create First Policy
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {policies.map(policy => {
            const blocked = policy.policy_json?.blocked_permissions || [];
            const threshold = policy.policy_json?.score_threshold;

            return (
              <div key={policy.id} className="card" style={{ transition: 'all 0.2s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 'var(--radius-md)', 
                      background: policy.enabled ? 'rgba(52, 211, 153, 0.12)' : 'rgba(100, 116, 139, 0.12)', 
                      color: policy.enabled ? 'var(--accent-green)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Shield size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {policy.name}
                      </h3>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Created: {policy.created_at ? new Date(policy.created_at).toLocaleDateString() : 'System default'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <label className="toggle" title={policy.enabled ? 'Disable Policy' : 'Enable Policy'}>
                      <input 
                        type="checkbox" 
                        checked={policy.enabled} 
                        onChange={() => handleTogglePolicy(policy)} 
                      />
                      <span className="toggle-slider" />
                    </label>

                    <button 
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDeletePolicy(policy.id)}
                      title="Delete Policy"
                      style={{ color: 'var(--accent-red)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Policy Rules Details */}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {blocked.length > 0 && (
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--accent-red)', marginRight: '8px' }}>
                        Explicitly Blocked Permissions ({blocked.length}):
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                        {blocked.map(p => (
                          <span key={p} className="chip" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                            {p.replace('android.permission.', '')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {threshold && (
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>Max Risk Score Threshold:</span> {threshold}/100
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Policy Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Create Security Policy</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePolicy}>
              <div className="form-group">
                <label className="form-label">Policy Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Strict Enterprise Zero-Trust"
                  value={newPolicyName}
                  onChange={e => setNewPolicyName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Blocked Permissions (One per line)</label>
                <textarea 
                  className="form-textarea" 
                  rows={5}
                  value={blockedInput}
                  onChange={e => setBlockedInput(e.target.value)}
                  placeholder="android.permission.READ_SMS&#10;android.permission.RECORD_AUDIO"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Alert Score Threshold (0-100)</label>
                <input 
                  type="number" 
                  min={0} 
                  max={100}
                  className="form-input" 
                  value={scoreThreshold}
                  onChange={e => setScoreThreshold(Number(e.target.value))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Saving...' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Policies;
