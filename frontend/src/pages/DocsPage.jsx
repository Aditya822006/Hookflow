import React, { useState } from 'react';
import JsonViewer from '../components/JsonViewer';
import { Shield, Code2, Network } from 'lucide-react';

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState('api');

  const pythonVerifyCode = `import hmac
import hashlib

def verify_hookflow_signature(payload_body: str, signature_header: str, secret_token: str) -> bool:
    """
    Verifies that the webhook request came from HookFlow and was not tampered with.
    """
    expected_sig = "sha256=" + hmac.new(
        key=secret_token.encode('utf-8'),
        msg=payload_body.encode('utf-8'),
        digestmod=hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_sig, signature_header)
`;

  const nodeVerifyCode = `const crypto = require('crypto');

function verifyHookFlowSignature(rawBody, signatureHeader, secretToken) {
  const hmac = crypto.createHmac('sha256', secretToken);
  hmac.update(rawBody);
  const expectedSig = 'sha256=' + hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSig),
    Buffer.from(signatureHeader)
  );
}
`;

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>HookFlow Architecture & API Reference</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Developer documentation, webhook signature verification, and delivery semantics
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { id: 'api', label: 'REST API Endpoints', icon: Code2 },
          { id: 'security', label: 'Webhook Security & HMAC', icon: Shield },
          { id: 'semantics', label: 'At-Least-Once Delivery & Idempotency', icon: Network },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn btn-secondary btn-sm ${isActive ? 'active' : ''}`}
              style={{
                borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-subtle)',
                background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: isActive ? '#818cf8' : 'var(--text-secondary)'
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'api' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              1. Ingest Webhook Event (Producer)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              External systems submit events to HookFlow. Returns HTTP 202 Accepted and queues background delivery.
            </p>
            <div style={{ marginBottom: '0.5rem' }}>
              <span className="mono-text" style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#38bdf8' }}>
                POST /api/v1/events
              </span>
            </div>
            <JsonViewer
              data={{
                event_id: "evt_order_10029",
                event_type: "order.placed",
                payload: {
                  order_id: "ORD-99812",
                  amount: 1450,
                  currency: "USD"
                },
                endpoint_id: 1,
                max_retries: 3
              }}
              maxHeight="160px"
            />
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              2. Register Destination Endpoint
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Register the webhook URL that should receive events.
            </p>
            <div style={{ marginBottom: '0.5rem' }}>
              <span className="mono-text" style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#38bdf8' }}>
                POST /api/v1/endpoints
              </span>
            </div>
            <JsonViewer
              data={{
                name: "Billing Webhook Handler",
                url: "https://example.com/api/webhooks/billing",
                description: "Receives order.placed and payment.success events",
                secret_token: "whsec_custom_secret_key"
              }}
              maxHeight="160px"
            />
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              3. Interactive Swagger UI
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Explore and test all interactive endpoints directly via the backend FastAPI OpenAPI documentation at:
            </p>
            <div style={{ marginTop: '0.5rem' }}>
              <a 
                href="http://localhost:8000/docs" 
                target="_blank" 
                rel="noreferrer"
                className="mono-text"
                style={{ color: '#818cf8', textDecoration: 'underline' }}
              >
                http://localhost:8000/docs
              </a>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              HMAC-SHA256 Payload Signature Verification
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              HookFlow signs every outgoing webhook POST request using HMAC-SHA256. Receiving services must compute the hash of the raw request body with their shared secret token and verify the <code>X-HookFlow-Signature</code> header.
            </p>

            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', marginBottom: '0.5rem' }}>
              Python (FastAPI / Flask) Verification:
            </h4>
            <pre className="code-block" style={{ marginBottom: '1rem' }}>
              <code>{pythonVerifyCode}</code>
            </pre>

            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', marginBottom: '0.5rem' }}>
              Node.js (Express) Verification:
            </h4>
            <pre className="code-block">
              <code>{nodeVerifyCode}</code>
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'semantics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Why At-Least-Once Delivery?
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
              In distributed systems, the network is fundamentally unreliable. If a receiving service processes an event but crashes before sending HTTP 200 OK, or if a network partition drops the acknowledgment packet, HookFlow safely retries delivery.
            </p>

            <div style={{ 
              background: 'rgba(99, 102, 241, 0.08)', 
              border: '1px solid rgba(99, 102, 241, 0.25)', 
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#818cf8', marginBottom: '0.5rem' }}>
                How Idempotency Works:
              </h4>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.825rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li>HookFlow preserves the exact same <code>event_id</code> across all automatic and manual retries.</li>
                <li>Receiving applications should store processed <code>event_id</code>s in a database or Redis cache.</li>
                <li>If an event with an already-processed <code>event_id</code> arrives, the receiver returns HTTP 200 immediately without executing business logic twice.</li>
              </ul>
            </div>

            <div style={{ 
              background: 'rgba(16, 185, 129, 0.08)', 
              border: '1px solid rgba(16, 185, 129, 0.25)', 
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#34d399', marginBottom: '0.5rem' }}>
                Exponential Backoff Retry Strategy:
              </h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                HookFlow uses the formula <code>delay = base * 2^(attempt - 1)</code>. This prevents overwhelming a struggling destination during transient downtime while recovering promptly.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
