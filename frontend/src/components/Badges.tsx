import React from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import type { RiskBand, RelevanceStatus, SeverityTier } from '../types';

export const RiskBadge: React.FC<{ band: RiskBand; size?: 'sm' | 'md' }> = ({ band, size = 'md' }) => {
  const normalized = (band || 'Low').toLowerCase();
  return (
    <span className={`risk-badge ${normalized}`} style={size === 'sm' ? { padding: '2px 8px', fontSize: '0.68rem' } : undefined}>
      {normalized === 'high' && <ShieldAlert size={14} />}
      {normalized === 'medium' && <AlertTriangle size={14} />}
      {normalized === 'low' && <ShieldCheck size={14} />}
      {band} Risk
    </span>
  );
};

export const StatusBadge: React.FC<{ status: RelevanceStatus }> = ({ status }) => {
  const s = (status || 'unknown').toLowerCase();
  let label: string = status;
  let icon = <HelpCircle size={12} />;

  if (s === 'expected') {
    label = 'Expected';
    icon = <CheckCircle size={12} />;
  } else if (s === 'context-dependent') {
    label = 'Context-Dependent';
    icon = <AlertTriangle size={12} />;
  } else if (s === 'unexpected') {
    label = 'Unexpected';
    icon = <AlertCircle size={12} />;
  } else if (s === 'policy-violation') {
    label = 'Policy Violation';
    icon = <ShieldAlert size={12} />;
  }

  return (
    <span className={`status-badge ${s}`}>
      {icon}
      {label}
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: SeverityTier }> = ({ severity }) => {
  const s = (severity || 'low').toLowerCase();
  return (
    <span className={`severity-badge ${s}`}>
      {severity || 'low'}
    </span>
  );
};
