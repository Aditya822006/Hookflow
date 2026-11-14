import React, { useState, useEffect } from 'react';
import api from '../services/api';
import JsonViewer from '../components/JsonViewer';
import { 
  Terminal, 
  Settings2, 
  ShieldCheck, 
  Trash2, 
  RefreshCw, 
  Send,
  Clock
} from 'lucide-react';

export default function TestBenchPage({ endpoints, onTriggerToast, onOpenSendModal }) {
  const [config, setConfig] = useState({
    simulate_failure: false,
    failure_status_code: 500,
    simulated_delay_seconds: 0.0,
    failure_mode: 'fail_first_2'
  });
  const [receivedLogs, setReceivedLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [error, setError] = useState('');

  const fetchReceiverData = async () => {
    try {
      const [cfg, logs] = await Promise.all([
        api.getReceiverConfig(),
        api.getReceiverLogs(50),
      ]);
      setConfig(cfg);
      setReceivedLogs(logs);
      setError('');
      if (logs.length > 0 && !selectedLog) {
        setSelectedLog(logs[0]);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not load receiver data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceiverData();
    // Auto-refresh every 3 seconds for live receiver feel
    const interval = setInterval(fetchReceiverData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleConfigChange = async (updates) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setSavingConfig(true);
    try {
      await api.updateReceiverConfig(newConfig);
      setError('');
      if (onTriggerToast) onTriggerToast('Receiver simulation config updated', 'success');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to update receiver config.');
      await fetchReceiverData();
      if (onTriggerToast) onTriggerToast('Failed to update receiver config', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await api.clearReceiverLogs();
      setReceivedLogs([]);
      setSelectedLog(null);
      setError('');
      if (onTriggerToast) onTriggerToast('Receiver log cleared', 'success');
    } catch (err) {
      if (onTriggerToast) onTriggerToast('Failed to clear logs', 'error');
    }
  };

  return (
    <div>
      {error && <div className="api-error-banner" role="alert">{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={22} color="#06b6d4" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Test Bench & Live Receiver</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Simulate destination responses, test automatic retries, and inspect live webhook headers & payloads
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onOpenSendModal} className="btn btn-primary btn-sm">
            <Send size={14} />
            <span>Send Test Webhook</span>
          </button>
          <button onClick={fetchReceiverData} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      {/* Receiver Simulation Controls */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings2 size={18} color="#06b6d4" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Destination Behavior Simulator</h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Target: <code className="mono-text" style={{ color: '#38bdf8' }}>/api/v1/receiver/webhook</code>
            {savingConfig && ' · Saving...'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
          {/* Toggle Failure Simulation */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Simulate Failures</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Return error codes to trigger retries</div>
            </div>
            <button
              onClick={() => handleConfigChange({ simulate_failure: !config.simulate_failure })}
              className={`btn btn-sm ${config.simulate_failure ? 'btn-danger' : 'btn-secondary'}`}
            >
              {config.simulate_failure ? 'ACTIVE (Failing)' : 'DISABLED (200 OK)'}
            </button>
          </div>

          {/* Failure Mode Selector */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Simulation Mode</label>
            <select
              className="form-select"
              value={config.failure_mode}
              disabled={!config.simulate_failure}
              onChange={(e) => handleConfigChange({ failure_mode: e.target.value })}
            >
              <option value="fail_first_2">Fail First 2 Attempts (Success on 3rd) [Recommended]</option>
              <option value="always">Always Fail (Exhaust all 3 retries)</option>
              <option value="timeout">Simulate Network Timeout (&gt;10s)</option>
            </select>
          </div>

          {/* Status Code Selector */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Simulated Error Code</label>
            <select
              className="form-select"
              value={config.failure_status_code}
              disabled={!config.simulate_failure || config.failure_mode === 'timeout'}
              onChange={(e) => handleConfigChange({ failure_status_code: Number(e.target.value) })}
            >
              <option value={500}>500 Internal Server Error</option>
              <option value={502}>502 Bad Gateway</option>
              <option value={503}>503 Service Unavailable</option>
              <option value={504}>504 Gateway Timeout</option>
              <option value={404}>404 Not Found</option>
            </select>
          </div>

          {/* Latency Simulation */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Simulated Latency: {config.simulated_delay_seconds}s</label>
            <input
              type="range"
              min="0"
              max="3"
              step="0.5"
              value={config.simulated_delay_seconds}
              onChange={(e) => handleConfigChange({ simulated_delay_seconds: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>
        </div>
      </div>

      {/* Live Received Webhooks Split View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem' }}>
        {/* Left: Received List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ 
            padding: '1rem 1.25rem', 
            borderBottom: '1px solid var(--border-subtle)', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Received Webhooks</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-refreshes every 3s</span>
            </div>
            {receivedLogs.length > 0 && (
              <button onClick={handleClearLogs} className="btn btn-secondary btn-sm" style={{ padding: '3px 8px' }}>
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {receivedLogs.length > 0 ? (
              receivedLogs.map((log) => {
                const isSelected = selectedLog?.id === log.id;
                const is2xx = log.response_status >= 200 && log.response_status < 300;
                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    style={{
                      padding: '0.85rem 1.25rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="mono-text" style={{ fontWeight: 600, color: '#818cf8', fontSize: '0.85rem' }}>
                        {log.event_id}
                      </span>
                      <span className="mono-text" style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        color: is2xx ? '#34d399' : '#f87171' 
                      }}>
                        HTTP {log.response_status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span>{log.event_type} • Attempt #{log.attempt_number}</span>
                      <span>{new Date(log.received_at).toLocaleTimeString()}</span>
                    </div>

                    {log.notes && (
                      <div style={{ fontSize: '0.7rem', color: is2xx ? '#34d399' : '#fca5a5', marginTop: '2px' }}>
                        {log.notes}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <Clock size={28} color="var(--text-muted)" />
                <p>Waiting for incoming webhook POST requests...</p>
                <button onClick={onOpenSendModal} className="btn btn-primary btn-sm">
                  Send a Webhook Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Log Inspector */}
        <div className="card">
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Webhook Inspection & Verification</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Inspect HTTP headers, HMAC signature verification, and payload received
            </span>
          </div>

          {selectedLog ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Verification Banner */}
              <div style={{
                background: selectedLog.signature_valid === true ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid ' + (selectedLog.signature_valid === true ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'),
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <ShieldCheck size={20} color={selectedLog.signature_valid ? '#34d399' : '#94a3b8'} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {selectedLog.signature_valid === true 
                      ? 'HMAC-SHA256 Signature Verified' 
                      : selectedLog.signature_valid === false 
                      ? 'Invalid Signature' 
                      : 'Unsigned Webhook'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Payload integrity authenticated via <code className="mono-text">X-HookFlow-Signature</code> header
                  </div>
                </div>
              </div>

              {/* Received Headers */}
              <div>
                <span className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  HTTP Request Headers
                </span>
                <JsonViewer data={selectedLog.headers} maxHeight="160px" />
              </div>

              {/* Received Body */}
              <div>
                <span className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Received Payload Body
                </span>
                <JsonViewer data={selectedLog.payload} maxHeight="180px" />
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Select a received webhook from the left to inspect its headers and payload.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
