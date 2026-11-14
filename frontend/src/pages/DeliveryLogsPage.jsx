import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  RefreshCw
} from 'lucide-react';

export default function DeliveryLogsPage({ onSelectEvent }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [successFilter, setSuccessFilter] = useState('');

  const fetchLogs = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = {};
      if (successFilter !== '') params.success = successFilter === 'true';
      if (search.trim()) params.search = search.trim();
      const data = await api.getDeliveryLogs(params);
      setLogs(data);
      setError('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : (detail?.message || err.message || 'Could not load delivery logs.'));
    } finally {
      setLoading(false);
    }
  }, [successFilter, search]);

  useEffect(() => {
    fetchLogs(true);
    const interval = setInterval(() => fetchLogs(), 6000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Delivery Audit Trail</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Complete historical log of every HTTP dispatch attempt, response code, and latency
          </p>
        </div>

        <button onClick={() => fetchLogs(true)} className="btn btn-secondary btn-sm" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search */}
      {error && <div className="api-error-banner" role="alert">{error}</div>}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by Event ID, Endpoint, or Error..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Filter size={16} color="var(--text-muted)" />
          {[
            { label: 'All Attempts', value: '' },
            { label: 'Successful (2xx)', value: 'true' },
            { label: 'Failed Attempts', value: 'false' },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setSuccessFilter(item.value)}
              className={`btn btn-secondary btn-sm ${successFilter === item.value ? 'active' : ''}`}
              style={{
                borderColor: successFilter === item.value ? 'var(--accent-primary)' : 'var(--border-subtle)',
                background: successFilter === item.value ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: successFilter === item.value ? '#818cf8' : 'var(--text-secondary)'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
            <p>Loading delivery attempts...</p>
          </div>
        ) : logs.length > 0 ? (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Attempt</th>
                  <th>Event ID</th>
                  <th>Event Type</th>
                  <th>Destination</th>
                  <th>HTTP Code</th>
                  <th>Latency</th>
                  <th>Timestamp</th>
                  <th>Error / Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      {log.success ? (
                        <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Success
                        </span>
                      ) : (
                        <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                          <XCircle size={14} /> Failed
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="mono-text" style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        #{log.attempt_number}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => onSelectEvent(log.event_db_id)}
                        className="mono-text"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#818cf8',
                          cursor: 'pointer',
                          fontWeight: 500,
                          padding: 0,
                          textAlign: 'left'
                        }}
                        title="Inspect Event"
                      >
                        {log.event_id_str}
                      </button>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem' }}>{log.event_type}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.8rem' }}>{log.endpoint_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{log.endpoint_url}</div>
                    </td>
                    <td>
                      <span 
                        className="mono-text" 
                        style={{ 
                          fontWeight: 600,
                          color: log.success ? '#34d399' : '#f87171'
                        }}
                      >
                        {log.response_status ? `HTTP ${log.response_status}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {log.execution_time_ms ? `${log.execution_time_ms} ms` : '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(log.attempted_at).toLocaleTimeString()}
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      {log.error_message ? (
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#fca5a5', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap' 
                        }} title={log.error_message}>
                          {log.error_message}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No delivery logs found matching the filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
