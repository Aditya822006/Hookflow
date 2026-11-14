import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../services/api';
import { Send, AlertCircle, Sparkles } from 'lucide-react';

const SAMPLE_TEMPLATES = {
  'order.placed': {
    order_id: 'ORD-9821',
    customer: { id: 'cust_772', name: 'Alex Morgan', email: 'alex@example.com' },
    items: [
      { sku: 'ITEM-ALPHA', quantity: 2, price: 49.99 },
      { sku: 'ITEM-BETA', quantity: 1, price: 19.99 }
    ],
    total_amount: 119.97,
    currency: 'USD'
  },
  'payment.success': {
    payment_id: 'pay_live_8392019',
    amount: 11997,
    currency: 'usd',
    method: 'card',
    status: 'succeeded',
    risk_score: 12
  },
  'user.created': {
    user_id: 'usr_839104',
    email: 'newuser@startup.io',
    plan: 'enterprise_trial',
    registered_at: new Date().toISOString()
  }
};

export default function SendEventModal({ isOpen, onClose, onSuccess, endpoints = [] }) {
  const [eventType, setEventType] = useState('order.placed');
  const [eventId, setEventId] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [payloadStr, setPayloadStr] = useState(JSON.stringify(SAMPLE_TEMPLATES['order.placed'], null, 2));
  const [maxRetries, setMaxRetries] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const activeEndpoints = endpoints.filter((endpoint) => endpoint.is_active);

  useEffect(() => {
    if (!activeEndpoints.some((endpoint) => String(endpoint.id) === String(endpointId))) {
      setEndpointId(String(activeEndpoints[0]?.id || ''));
    }
  }, [activeEndpoints, endpointId]);

  const handleTemplateChange = (type) => {
    setEventType(type);
    if (SAMPLE_TEMPLATES[type]) {
      setPayloadStr(JSON.stringify(SAMPLE_TEMPLATES[type], null, 2));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payloadStr);
    } catch (err) {
      setError('Invalid JSON payload: ' + err.message);
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        event_type: eventType,
        payload: parsedPayload,
        max_retries: Number(maxRetries),
      };
      if (eventId.trim()) {
        submitData.event_id = eventId.trim();
      }
      if (endpointId) {
        submitData.endpoint_id = Number(endpointId);
      }

      const res = await api.submitEvent(submitData);
      onSuccess(res);
      onClose();
      // Reset form
      setEventId('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'object' ? detail.message : (detail || err.message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dispatch New Webhook Event">
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            color: '#f87171',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Event Type</label>
            <input
              type="text"
              className="form-input"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. order.placed"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Custom Event ID (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="Auto-generated if empty"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Quick Template</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {Object.keys(SAMPLE_TEMPLATES).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleTemplateChange(key)}
                className={`btn btn-secondary btn-sm ${eventType === key ? 'active' : ''}`}
                style={{ fontSize: '0.75rem' }}
              >
                <Sparkles size={12} />
                <span>{key}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Destination Endpoint</label>
            <select
              className="form-select"
              value={endpointId}
              onChange={(e) => setEndpointId(e.target.value)}
            >
              {activeEndpoints.map((ep) => (
                <option key={ep.id} value={ep.id} disabled={!ep.is_active}>
                  {ep.name} {ep.is_active ? `(${ep.url})` : '[Disabled]'}
                </option>
              ))}
              {activeEndpoints.length === 0 && (
                <option value="">No active endpoints available</option>
              )}
            </select>
            {activeEndpoints.length === 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Register or enable a destination before submitting an event.
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Max Attempts</label>
            <input
              type="number"
              className="form-input"
              value={maxRetries}
              min="1"
              max="3"
              onChange={(e) => setMaxRetries(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">JSON Payload</label>
          <textarea
            className="form-textarea"
            rows="7"
            value={payloadStr}
            onChange={(e) => setPayloadStr(e.target.value)}
            required
          />
        </div>

        <div className="modal-footer" style={{ padding: '1rem 0 0 0', borderTop: 'none' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary"           disabled={loading || activeEndpoints.length === 0}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : <Send size={16} />}
            <span>{loading ? 'Submitting...' : 'Dispatch Webhook'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
