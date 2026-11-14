import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function JsonViewer({ data, maxHeight = '300px' }) {
  const [copied, setCopied] = useState(false);
  const formatted = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleCopy}
        className="btn btn-secondary btn-icon"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          fontSize: '0.75rem',
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
        title="Copy JSON"
      >
        {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
      </button>
      <pre className="code-block" style={{ maxHeight }}>
        <code>{formatted}</code>
      </pre>
    </div>
  );
}
