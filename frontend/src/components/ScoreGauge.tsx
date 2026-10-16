import React from 'react';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  size = 140,
  strokeWidth = 12,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  let color = 'var(--accent-green)';
  if (score >= 60) {
    color = 'var(--accent-red)';
  } else if (score >= 30) {
    color = 'var(--accent-amber)';
  }

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.4s ease',
          }}
        />
      </svg>
      <div className="score-ring-value" style={{ color }}>
        {clampedScore}
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', textAlign: 'center', fontWeight: 500 }}>
          / 100
        </span>
      </div>
    </div>
  );
};

export default ScoreGauge;
