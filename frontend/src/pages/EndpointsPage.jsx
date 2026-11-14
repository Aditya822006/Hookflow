import React, { useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import api from '../services/api';
import { 
  Globe, 
  Plus, 
  Trash2, 
  Power, 
  Key, 
  Layers,
  AlertCircle,
  Pencil
} from 'lucide-react';

export default function EndpointsPage({ endpoints, onRefreshEndpoints, onTriggerToast }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [secretToken, setSecretToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);

    // Basic URL check
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }

    setSubmitting(true);
    try {
      const endpointData = {
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || undefined,
        secret_token: secretToken.trim() || undefined,
      };
      if (editingEndpoint) {
        await api.updateEndpoint(editingEndpoint.id, endpointData);
      } else {
        await api.createEndpoint({ ...endpointData, is_active: true });
      }

      await onRefreshEndpoints();
      setIsAddModalOpen(false);
      setEditingEndpoint(null);
      setName('');
      setUrl('');
      setDescription('');
      setSecretToken('');
      if (onTriggerToast) {
        onTriggerToast(
          editingEndpoint ? 'Destination endpoint updated successfully' : 'Destination endpoint registered successfully',
          'success'
        );
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : (detail?.[0]?.msg || err.message);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const openAddModal = () => {
    setEditingEndpoint(null);
    setName('');
    setUrl('');
    setDescription('');
    setSecretToken('');
    setError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (endpoint) => {
    setEditingEndpoint(endpoint);
    setName(endpoint.name);
    setUrl(endpoint.url);
    setDescription(endpoint.description || '');
    setSecretToken('');
    setError(null);
    setIsAddModalOpen(true);
  };

  const handleToggle = async (id, currentStatus) => {
    try {
      await api.toggleEndpoint(id);
      onRefreshEndpoints();
      if (onTriggerToast) {
        onTriggerToast(`Endpoint ${currentStatus ? 'disabled' : 'enabled'} successfully`, 'success');
      }
    } catch (err) {
      if (onTriggerToast) onTriggerToast('Failed to toggle endpoint status', 'error');
    }
  };

  const handleDelete = async (id, epName) => {
    if (!window.confirm(`Are you sure you want to delete endpoint "${epName}"? All its associated delivery events will also be removed.`)) {
      return;
    }
    try {
      await api.deleteEndpoint(id);
      onRefreshEndpoints();
      if (onTriggerToast) onTriggerToast(`Endpoint "${epName}" deleted`, 'success');
    } catch (err) {
      if (onTriggerToast) onTriggerToast('Failed to delete endpoint', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Destination Endpoints</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Register and manage target URLs where HookFlow delivers webhook payloads
          </p>
        </div>

        <button 
          onClick={openAddModal} 
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>Add Destination</span>
        </button>
      </div>

      {/* Endpoints Grid */}
      <div className="endpoint-grid">
        {endpoints.map((ep) => (
          <div key={ep.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                  <Globe size={18} color="#818cf8" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{ep.name}</h3>
                </div>
                <StatusBadge status={ep.is_active} type="active" />
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => openEditModal(ep)}
                  className="btn btn-secondary btn-icon"
                  title="Edit endpoint"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleToggle(ep.id, ep.is_active)}
                  className={`btn btn-secondary btn-icon`}
                  title={ep.is_active ? 'Disable endpoint' : 'Enable endpoint'}
                  style={{ color: ep.is_active ? '#34d399' : '#94a3b8' }}
                >
                  <Power size={15} />
                </button>
                <button
                  onClick={() => handleDelete(ep.id, ep.name)}
                  className="btn btn-danger btn-icon"
                  title="Delete endpoint"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div style={{ 
              background: 'rgba(0, 0, 0, 0.25)', 
              padding: '0.65rem 0.85rem', 
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Target URL
              </div>
              <div className="mono-text" style={{ fontSize: '0.8rem', color: '#e2e8f0', wordBreak: 'break-all', marginTop: '2px' }}>
                {ep.url}
              </div>
            </div>

            {ep.description && (
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                {ep.description}
              </p>
            )}

            <div style={{ 
              marginTop: 'auto', 
              paddingTop: '0.75rem', 
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex', 
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Layers size={13} />
                {ep.total_events || 0} events dispatched
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Key size={13} />
                {ep.has_secret ? 'Custom HMAC secret' : 'Default signing key'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {endpoints.length === 0 && (
        <div className="card empty-state">
          <Globe size={36} color="var(--text-muted)" />
          <p>No destination endpoints registered.</p>
          <button onClick={openAddModal} className="btn btn-primary btn-sm">
            Add Your First Endpoint
          </button>
        </div>
      )}

      {/* Add Endpoint Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingEndpoint ? 'Edit Destination Endpoint' : 'Register Destination Endpoint'}
      >
        <form onSubmit={handleCreate}>
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

          <div className="form-group">
            <label className="form-label">Endpoint Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stripe Webhook Handler, Inventory Service"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Destination URL</label>
            <input
              type="url"
              className="form-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/api/webhooks"
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Must begin with http:// or https://. HookFlow will deliver HTTP POST requests here.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the receiving service"
            />
          </div>

          <div className="form-group">
            <label className="form-label">HMAC Secret Token (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={secretToken}
              onChange={(e) => setSecretToken(e.target.value)}
              placeholder={editingEndpoint ? 'Leave blank to keep the current secret' : 'Use the default or enter a custom secret'}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Used to generate X-HookFlow-Signature (HMAC-SHA256) header for payload authenticity.
            </span>
          </div>

          <div className="modal-footer" style={{ padding: '1rem 0 0 0', borderTop: 'none' }}>
            <button 
              type="button" 
              onClick={() => setIsAddModalOpen(false)} 
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? <span className="spinner" /> : <Plus size={16} />}
              <span>
                {submitting
                  ? editingEndpoint ? 'Saving...' : 'Registering...'
                  : editingEndpoint ? 'Save Changes' : 'Register Endpoint'}
              </span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
