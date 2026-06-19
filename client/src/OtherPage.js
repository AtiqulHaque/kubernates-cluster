import React from 'react';
import { Link } from 'react-router-dom';

export default () => {
  return (
    <div className="page-card">
      <div className="page-header">
        <h1>About FibFlow</h1>
        <p>A multi-container Fibonacci calculator built for Docker & Kubernetes learning.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Frontend</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            React SPA with client-side routing, proxied through nginx / ingress.
          </p>
        </div>
        <div className="stat-card">
          <h3>Backend</h3>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Express API + NestJS reader + Redis worker + Postgres persistence.
          </p>
        </div>
      </div>

      <Link to="/" className="btn-link">← Back to Calculator</Link>
    </div>
  );
};
