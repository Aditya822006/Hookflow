import React from 'react';
import { 
  LayoutDashboard, 
  Send, 
  Globe, 
  FileText, 
  Terminal, 
  BookOpen,
  Radio
} from 'lucide-react';

export default function Sidebar({ activePage, setActivePage }) {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'events', label: 'Events', icon: Send },
    { id: 'endpoints', label: 'Endpoints', icon: Globe },
    { id: 'deliveries', label: 'Delivery Logs', icon: FileText },
    { id: 'testbench', label: 'Test Bench', icon: Terminal, badge: 'Live' },
    { id: 'docs', label: 'Documentation', icon: BookOpen },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-icon">
          <Radio size={18} />
        </div>
        <div>
          <div className="brand-text">HookFlow</div>
        </div>
        <span className="brand-badge">v1.0</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.65rem',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: 'rgba(6, 182, 212, 0.2)',
                  color: '#22d3ee',
                  border: '1px solid rgba(6, 182, 212, 0.3)'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span>Delivery: At-Least-Once</span>
        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
      </div>
    </aside>
  );
}
