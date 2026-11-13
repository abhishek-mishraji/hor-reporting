import React from 'react';

/**
 * Executive KPI summary cards row rendered above dense tables.
 * Gives operators an immediate high-level summary before reviewing row-by-row data.
 *
 * @param {object} props
 * @param {Array<{title: string, value: React.ReactNode, subtitle?: string, badge?: string, accent?: string}>} props.items
 */
export function KpiSummaryGrid({ items = [] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="kpi-grid" role="region" aria-label="Summary KPI Cards">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="kpi-card"
          style={item.accent ? { '--kpi-accent': item.accent } : undefined}
        >
          <div className="kpi-header">
            <span className="kpi-title">{item.title}</span>
            {item.badge && <span className="kpi-badge">{item.badge}</span>}
          </div>
          <div className="kpi-value mono">{item.value}</div>
          {item.subtitle && <div className="kpi-subtitle">{item.subtitle}</div>}
        </div>
      ))}
    </div>
  );
}
export default KpiSummaryGrid;
