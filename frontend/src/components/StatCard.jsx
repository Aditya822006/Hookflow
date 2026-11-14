import React from 'react';

export default function StatCard({ title, value, icon: Icon, subtitle, color = '#6366f1' }) {
  return (
    <div className="card stat-card">
      <div className="stat-header">
        <span>{title}</span>
        <div className="stat-icon" style={{ color }}>
          <Icon size={18} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-footer">{subtitle}</div>}
    </div>
  );
}
