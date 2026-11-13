import React from 'react';
import { ErrorBanner } from './ErrorBanner.jsx';

/**
 * Modern Loading skeleton and error banner shown above and in place of pending reports.
 * Eliminates Cumulative Layout Shift (CLS) via animated shimmer placeholders.
 */
export function ReportStatus({ loading, error, what = 'report' }) {
  return (
    <>
      {error && <ErrorBanner error={error} />}
      {loading && (
        <div className="table-card" aria-busy="true" aria-label={`Loading ${what}`}>
          <div className="table-header-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="skeleton-shimmer" style={{ width: '140px', height: '20px', borderRadius: '4px' }} />
              <span className="status-pill info">Loading {what}…</span>
            </div>
            <div className="skeleton-shimmer" style={{ width: '90px', height: '28px', borderRadius: '6px' }} />
          </div>
          <div className="table-skeleton-wrap">
            <div className="skeleton-shimmer table-skeleton-row" style={{ height: '36px', opacity: 0.9 }} />
            <div className="skeleton-shimmer table-skeleton-row" style={{ opacity: 0.7 }} />
            <div className="skeleton-shimmer table-skeleton-row" style={{ opacity: 0.6 }} />
            <div className="skeleton-shimmer table-skeleton-row" style={{ opacity: 0.5 }} />
            <div className="skeleton-shimmer table-skeleton-row" style={{ opacity: 0.4 }} />
            <div className="skeleton-shimmer table-skeleton-row" style={{ opacity: 0.3 }} />
          </div>
        </div>
      )}
    </>
  );
}
export default ReportStatus;
