import React from 'react';
import { RefreshCw, Plus } from 'lucide-react';

export default function Navbar({ title, onRefresh, onOpenSendModal, refreshing, apiStatus }) {
  const statusLabel = {
    checking: 'Checking API...',
    online: 'API Connected',
    offline: 'API Unavailable',
  }[apiStatus] || 'API status unknown';

  return (
    <header className="navbar">
      <div className="navbar-title">
        <span>{title}</span>
      </div>

      <div className="navbar-actions">
        <div className={`system-status-indicator status-${apiStatus}`} title="Connection to the HookFlow API">
          <div className="pulse-dot" />
          <span>{statusLabel}</span>
        </div>

        <button 
          onClick={onRefresh} 
          className="btn btn-secondary btn-icon"
          title="Refresh real-time data"
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'spinner' : ''} />
        </button>

        <button 
          onClick={onOpenSendModal} 
          className="btn btn-primary btn-sm"
        >
          <Plus size={16} />
          <span>Send Webhook</span>
        </button>
      </div>
    </header>
  );
}
