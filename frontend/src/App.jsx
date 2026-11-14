import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import SendEventModal from './components/SendEventModal';
import DashboardPage from './pages/DashboardPage';
import EventsPage from './pages/EventsPage';
import EndpointsPage from './pages/EndpointsPage';
import DeliveryLogsPage from './pages/DeliveryLogsPage';
import TestBenchPage from './pages/TestBenchPage';
import DocsPage from './pages/DocsPage';
import api from './services/api';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');
  const [loadError, setLoadError] = useState('');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [statsData, recentData, endpointsData] = await Promise.all([
        api.getStats(),
        api.getRecentActivity(10),
        api.getEndpoints(),
      ]);
      setStats(statsData);
      setRecentActivity(recentData);
      setEndpoints(endpointsData);
      setApiStatus('online');
      setLoadError('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setApiStatus('offline');
      setLoadError(
        typeof detail === 'string'
          ? detail
          : (detail?.message || err.message || 'The API could not be reached.')
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSelectEvent = (id) => {
    setSelectedEventId(id);
    setActivePage('events');
  };

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard': return 'Operational Overview';
      case 'events': return 'Webhook Events';
      case 'endpoints': return 'Destination Endpoints';
      case 'deliveries': return 'Delivery Logs';
      case 'testbench': return 'Test Bench & Live Receiver';
      case 'docs': return 'Documentation & Architecture';
      default: return 'HookFlow';
    }
  };

  return (
    <div className="app-container">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <div className="main-viewport">
        <Navbar
          title={getPageTitle()}
          onRefresh={loadData}
          onOpenSendModal={() => setIsSendModalOpen(true)}
          refreshing={refreshing}
          apiStatus={apiStatus}
        />

        <main className="content-area">
          {loadError && (
            <div className="api-error-banner" role="alert">
              <AlertCircle size={16} />
              <span>Cannot load HookFlow data: {loadError}</span>
              <button onClick={loadData} type="button" className="btn btn-secondary btn-sm">
                Try again
              </button>
            </div>
          )}
          {activePage === 'dashboard' && (
            <DashboardPage
              stats={stats}
              recentActivity={recentActivity}
              onSelectEvent={handleSelectEvent}
              onNavigate={(page) => setActivePage(page)}
            />
          )}

          {activePage === 'events' && (
            <EventsPage
              selectedEventId={selectedEventId}
              setSelectedEventId={setSelectedEventId}
              onTriggerToast={addToast}
            />
          )}

          {activePage === 'endpoints' && (
            <EndpointsPage
              endpoints={endpoints}
              onRefreshEndpoints={loadData}
              onTriggerToast={addToast}
            />
          )}

          {activePage === 'deliveries' && (
            <DeliveryLogsPage onSelectEvent={handleSelectEvent} />
          )}

          {activePage === 'testbench' && (
            <TestBenchPage
              endpoints={endpoints}
              onTriggerToast={addToast}
              onOpenSendModal={() => setIsSendModalOpen(true)}
            />
          )}

          {activePage === 'docs' && <DocsPage />}
        </main>
      </div>

      {/* Global Dispatch Webhook Modal */}
      <SendEventModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        onSuccess={(event) => {
          addToast(`Event ${event.event_id} queued for delivery!`, 'success');
          loadData();
        }}
        endpoints={endpoints}
      />

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}
          >
            {toast.type === 'error' ? (
              <AlertCircle size={18} color="#f87171" />
            ) : (
              <CheckCircle2 size={18} color="#34d399" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
