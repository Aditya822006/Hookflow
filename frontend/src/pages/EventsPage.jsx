import React, { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../components/StatusBadge';
import JsonViewer from '../components/JsonViewer';
import Modal from '../components/Modal';
import api from '../services/api';
import { 
  Search, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  Filter
} from 'lucide-react';

export default function EventsPage({ selectedEventId, setSelectedEventId, onTriggerToast }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventDetail, setEventDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchEvents = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const data = await api.getEvents(params);
      setEvents(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  const loadEventDetail = useCallback(async (id, backgroundRefresh = false) => {
    if (!backgroundRefresh) setLoadingDetail(true);
    try {
      const data = await api.getEvent(id);
      setEventDetail(data);
    } catch (err) {
      if (!backgroundRefresh) {
        if (onTriggerToast) onTriggerToast('Failed to load event details', 'error');
      }
    } finally {
      if (!backgroundRefresh) setLoadingDetail(false);
    }
  }, [onTriggerToast]);

  useEffect(() => {
    fetchEvents(true);
    const interval = setInterval(() => fetchEvents(), 6000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  useEffect(() => {
    if (!selectedEventId) return undefined;
    loadEventDetail(selectedEventId);
    const interval = setInterval(
      () => loadEventDetail(selectedEventId, true),
      3000
    );
    return () => clearInterval(interval);
  }, [selectedEventId, loadEventDetail]);

  const handleManualRetry = async () => {
    if (!eventDetail) return;
    setRetrying(true);
    try {
      const updated = await api.retryEvent(eventDetail.id);
      setEventDetail(updated);
      fetchEvents();
      if (onTriggerToast) onTriggerToast(`Manual retry queued for event ${updated.event_id}`, 'success');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : (detail?.message || err.message);
      if (onTriggerToast) onTriggerToast(message, 'error');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div>
      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by Event ID, Type, or Destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Filter size={16} color="var(--text-muted)" />
          {['', 'DELIVERED', 'FAILED', 'PENDING', 'PROCESSING'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`btn btn-secondary btn-sm ${statusFilter === st ? 'active' : ''}`}
              style={{
                borderColor: statusFilter === st ? 'var(--accent-primary)' : 'var(--border-subtle)',
                background: statusFilter === st ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: statusFilter === st ? '#818cf8' : 'var(--text-secondary)'
              }}
            >
              {st || 'All Statuses'}
            </button>
          ))}
        </div>
      </div>

      {/* Events Table */}
      {error && <div className="api-error-banner" role="alert">{error}</div>}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
            <p>Loading events...</p>
          </div>
        ) : events.length > 0 ? (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Event Type</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Created At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
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
                        onClick={() => {
                          setSelectedEventId(ev.id);
                          loadEventDetail(ev.id);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>Details</span>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No events found matching your filter criteria.</p>
          </div>
        )}
      </div>

      {/* Event Details Inspection Modal */}
      <Modal
        isOpen={!!selectedEventId}
        onClose={() => {
          setSelectedEventId(null);
          setEventDetail(null);
        }}
        title={`Event Inspection: ${eventDetail?.event_id || 'Loading...'}`}
        maxWidth="750px"
      >
        {loadingDetail || !eventDetail ? (
          <div className="empty-state">
            <div className="spinner" />
            <p>Loading event payload and delivery history...</p>
          </div>
        ) : (
          <div>
            {/* Header Summary */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingBottom: '1rem',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '1.25rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <StatusBadge status={eventDetail.status} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{eventDetail.event_type}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Created {new Date(eventDetail.created_at).toLocaleString()} • Target: {eventDetail.endpoint_url}
                </div>
              </div>

              {/* Manual Retry Trigger */}
              <button
                onClick={handleManualRetry}
                className="btn btn-primary btn-sm"
                disabled={retrying || eventDetail.status !== 'FAILED'}
                title={eventDetail.status === 'FAILED' ? 'Start a new delivery cycle' : 'Only failed events can be retried'}
              >
                <RotateCw size={14} className={retrying ? 'spinner' : ''} />
                <span>{retrying ? 'Queueing...' : 'Manual Retry'}</span>
              </button>
            </div>

            {/* Payload Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Event Payload (JSON)
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Immutable event state
                </span>
              </div>
              <JsonViewer data={eventDetail.payload} maxHeight="220px" />
            </div>

            {/* Delivery Attempts Audit Trail */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Delivery Attempt Timeline ({eventDetail.attempts.length})
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  At-Least-Once Delivery Semantics
                </span>
              </div>

              {eventDetail.attempts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {eventDetail.attempts.map((attempt) => (
                    <div 
                      key={attempt.id} 
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '0.85rem 1rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            Attempt #{attempt.attempt_number}
                          </span>
                          {attempt.success ? (
                            <span style={{ color: '#34d399', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={13} /> Succeeded
                            </span>
                          ) : (
                            <span style={{ color: '#f87171', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <XCircle size={13} /> Failed
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {attempt.execution_time_ms && (
                            <span>{attempt.execution_time_ms} ms</span>
                          )}
                          <span>{new Date(attempt.attempted_at).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Status Code: <strong style={{ color: attempt.success ? '#34d399' : '#f87171' }}>
                          {attempt.response_status ? `HTTP ${attempt.response_status}` : 'No response / Network error'}
                        </strong>
                      </div>

                      {attempt.error_message && (
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#fca5a5', 
                          background: 'rgba(239, 68, 68, 0.1)', 
                          padding: '0.35rem 0.6rem',
                          borderRadius: '4px',
                          marginTop: '0.4rem',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {attempt.error_message}
                        </div>
                      )}

                      {attempt.response_body && (
                        <div style={{ marginTop: '0.4rem' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Response Body Preview:</div>
                          <pre style={{ 
                            fontSize: '0.75rem', 
                            background: '#040711', 
                            padding: '0.4rem 0.6rem', 
                            borderRadius: '4px',
                            maxHeight: '100px',
                            overflowY: 'auto'
                          }}>
                            {attempt.response_body}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Awaiting initial delivery attempt by Celery worker...
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
