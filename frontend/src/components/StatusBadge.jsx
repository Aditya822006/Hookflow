import React from 'react';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

export default function StatusBadge({ status, type = 'status' }) {
  if (type === 'active') {
    return status ? (
      <span className="badge badge-active">Active</span>
    ) : (
      <span className="badge badge-inactive">Disabled</span>
    );
  }

  const s = (status || '').toUpperCase();

  switch (s) {
    case 'DELIVERED':
      return (
        <span className="badge badge-delivered">
          <CheckCircle2 size={12} /> Delivered
        </span>
      );
    case 'FAILED':
      return (
        <span className="badge badge-failed">
          <XCircle size={12} /> Failed
        </span>
      );
    case 'PROCESSING':
      return (
        <span className="badge badge-processing">
          <Loader2 size={12} className="spinner" /> Processing
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span className="badge badge-pending">
          <Clock size={12} /> Pending
        </span>
      );
  }
}
