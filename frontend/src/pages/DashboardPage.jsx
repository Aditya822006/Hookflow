import React from 'react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { 
  Send, 
  Globe, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  Activity,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

export default function DashboardPage({ stats, recentActivity, onSelectEvent, onNavigate }) {
  if (!stats) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p>Loading real-time operational telemetry...</p>
      </div>
    );
  }

  // Calculate maximum total in daily trends for bar scaling
  const maxTrendTotal = Math.max(...(stats.daily_trends || []).map(d => d.total), 5);

  return (
    <div>
      {/* Metric Cards Row */}
      <div className="stats-grid">
        <StatCard
          title="Total Events"
          value={stats.total_events.toLocaleString()}
          icon={Send}
          subtitle={`${stats.pending_count} pending, ${stats.processing_count} in-flight`}
          color="#818cf8"
        />
        <StatCard
          title="Delivered Successfully"
          value={stats.delivered_count.toLocaleString()}
          icon={CheckCircle2}
          subtitle="HTTP 2xx confirmed"
          color="#34d399"
        />
        <StatCard
          title="Failed Deliveries"
          value={stats.failed_count.toLocaleString()}
          icon={XCircle}
          subtitle="Delivery or queue failure"
          color="#f87171"
        />
        <StatCard
          title="Success Rate"
          value={`${stats.success_rate_pct}%`}
          icon={Percent}
          subtitle={`${stats.total_attempts} total attempts made`}
          color="#38bdf8"
        />
        <StatCard
          title="Active Endpoints"
          value={stats.active_endpoints}
          icon={Globe}
          subtitle={`${stats.total_endpoints} destinations registered`}
          color="#a78bfa"
        />
      </div>

      {/* Delivery Activity & Trends Section */}
      <div className="dashboard-sections">
        {/* Daily Delivery Trend */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} color="#818cf8" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>7-Day Delivery Volume</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--status-delivered)' }} />
                Delivered
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--status-failed)' }} />
                Failed
              </span>
            </div>
          </div>

          <div className="trend-chart-container">
            {(stats.daily_trends || []).map((day, idx) => {
              const deliveredPct = (day.delivered / maxTrendTotal) * 100;
              const failedPct = (day.failed / maxTrendTotal) * 100;

              return (
                <div key={idx} className="trend-col">
                  <div className="trend-bar-group">
                    <div 
                      className="trend-bar-delivered" 
                      style={{ height: `${Math.max(deliveredPct, day.delivered > 0 ? 8 : 0)}%` }} 
                      title={`${day.date}: ${day.delivered} delivered`}
                    />
                    <div 
                      className="trend-bar-failed" 
                      style={{ height: `${Math.max(failedPct, day.failed > 0 ? 8 : 0)}%` }} 
                      title={`${day.date}: ${day.failed} failed`}
                    />
                  </div>
                  <span className="trend-label">{day.date}</span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>Auto-retry: Exponential backoff</span>
            <span>Broker: Redis & Celery</span>
          </div>
        </div>

        {/* Status Breakdown & Engine Insights */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Activity size={18} color="#38bdf8" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Delivery Pipeline Status</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Delivered Webhooks</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399', margin: '4px 0' }}>
                {stats.delivered_count}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Acknowledged with HTTP 2xx</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Failed Deliveries</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171', margin: '4px 0' }}>
                {stats.failed_count}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Retry limit reached or task could not be queued</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pending in Queue</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24', margin: '4px 0' }}>
                {stats.pending_count}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Awaiting worker pickup</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>In-Flight Processing</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#60a5fa', margin: '4px 0' }}>
                {stats.processing_count}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actively delivering or backed-off</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Recent Event Deliveries</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Real-time event feed from database</p>
          </div>
          <button 
            onClick={() => onNavigate('events')} 
            className="btn btn-secondary btn-sm"
          >
            <span>View All Events</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {recentActivity && recentActivity.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Event Type</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Submitted At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((ev) => (
                  <tr key={ev.id}>
                    <td className="mono-text" style={{ color: '#818cf8', fontWeight: 500 }}>
                      {ev.event_id}
                    </td>
                    <td>
                      <span style={{ 
                        background: 'rgba(255, 255, 255, 0.05)', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        {ev.event_type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{ev.endpoint_name || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ev.endpoint_url}</div>
                    </td>
                    <td>
                      <StatusBadge status={ev.status} />
                    </td>
                    <td>
                      <span className="mono-text">
                        {ev.attempt_count} / {ev.max_retries}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                    <td>
                      <button 
                        onClick={() => onSelectEvent(ev.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No events submitted yet.</p>
            <span style={{ fontSize: '0.8rem' }}>Click "Send Webhook" in the top bar to dispatch your first event!</span>
          </div>
        )}
      </div>
    </div>
  );
}
