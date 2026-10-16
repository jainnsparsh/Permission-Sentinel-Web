import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  EyeOff, 
  Cpu, 
  HardDrive, 
  BookOpen, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';
import { api } from '../services/api';

export const Privacy: React.FC = () => {
  const [health, setHealth] = useState<{ status: string; version: string; knowledge_base_version: string } | null>(null);
  const [capabilities, setCapabilities] = useState<{
    apk_parsing: boolean;
    knowledge_base_version: string;
    max_upload_size_mb: number;
    supported_formats: string[];
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.all([
      api.health().catch(() => null),
      api.capabilities().catch(() => null),
    ]).then(([h, c]) => {
      setHealth(h);
      setCapabilities(c);
      setLoading(false);
    });
  }, []);

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px' }}>
      <div className="page-header">
        <h2>Privacy, Architecture & Methodology</h2>
        <p>Local-first privacy model, deterministic scoring formulas, and security knowledge base verification</p>
      </div>

      {/* System Status Banner */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} style={{ color: 'var(--accent-indigo)' }} />
          Local Engine Capabilities & Health
        </h3>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Checking local engine...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Backend Engine Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontWeight: 600, color: (health?.status === 'healthy' || health?.status === 'ok') ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {(health?.status === 'healthy' || health?.status === 'ok') ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {(health?.status === 'healthy' || health?.status === 'ok') ? 'Online & Healthy' : 'Offline'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>APK Binary Parser</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontWeight: 600, color: capabilities?.apk_parsing ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                {capabilities?.apk_parsing ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {capabilities?.apk_parsing ? 'Androguard Active' : 'Fallback / Manifest Only'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Knowledge Base Version</div>
              <div style={{ fontWeight: 600, marginTop: '4px', color: 'var(--accent-indigo)' }}>
                {capabilities?.knowledge_base_version || 'v1.0.0'}
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supported Upload Types</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '4px', color: 'var(--text-primary)' }}>
                {(capabilities?.supported_formats || ['.apk', '.xml', '.json', '.csv']).join(', ')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Local-First Architecture Guarantee */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Lock size={20} style={{ color: 'var(--accent-green)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Zero Data Exfiltration Guarantee</h3>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
          Permission Sentinel was specifically architected for confidential security environments, enterprise auditing, and malware analysis where sensitive proprietary binaries cannot be leaked to cloud APIs.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-green)' }}>
              <HardDrive size={18} />
              100% Local Ingestion
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              All uploaded APKs, manifests, and reports remain strictly inside your local runtime container or host. No files or telemetry are dispatched externally.
            </p>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-indigo)' }}>
              <EyeOff size={18} />
              Deterministic Rule Engine
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Audits are not powered by unpredictable LLM black boxes. Our rules, weights, and combination matrices execute deterministically for consistent, audit-ready compliance.
            </p>
          </div>
        </div>
      </div>

      {/* Transparent Scoring Methodology */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <BookOpen size={20} style={{ color: 'var(--accent-indigo)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Explainable Risk Scoring Formula</h3>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
          Every risk score between 0 and 100 is fully decomposed into distinct verifiable security components:
        </p>

        <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Formula / Weighting</th>
                <th>Cap</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Base Sensitivity</strong></td>
                <td>Sum of top 3 requested permission weights</td>
                <td>Max 60 pts</td>
                <td>Captures inherent potential harm of requested data APIs (SMS, Location, Camera, Audio)</td>
              </tr>
              <tr>
                <td><strong>Purpose Mismatch</strong></td>
                <td>+12 points per unexpected permission</td>
                <td>Max 30 pts</td>
                <td>Penalizes functional over-reach (e.g. flashlight requesting contacts or location)</td>
              </tr>
              <tr>
                <td><strong>Dangerous Combinations</strong></td>
                <td>+8 points per triggered correlation rule</td>
                <td>Max 16 pts</td>
                <td>Flags high-risk multi-permission synergies (e.g., audio recording + network socket)</td>
              </tr>
              <tr>
                <td><strong>Policy Violations</strong></td>
                <td>+15 points per configured violation</td>
                <td>Max 30 pts</td>
                <td>Direct corporate compliance or zero-trust policy infringements</td>
              </tr>
              <tr>
                <td><strong>Context Amplifiers</strong></td>
                <td>Up to +8 points for background services</td>
                <td>Max 8 pts</td>
                <td>Elevates score if app requests persistent foreground/background capabilities</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-indigo)' }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>Risk Bands Definition</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            • <strong style={{ color: 'var(--accent-green)' }}>Low Risk (0–29):</strong> Legitimate permission surface aligned with declared category.<br />
            • <strong style={{ color: 'var(--accent-amber)' }}>Medium Risk (30–59):</strong> Contains context-dependent permissions requiring explicit justification.<br />
            • <strong style={{ color: 'var(--accent-red)' }}>High Risk (60–100):</strong> Significant excessive permissions, high-risk combinations, or policy violations.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
