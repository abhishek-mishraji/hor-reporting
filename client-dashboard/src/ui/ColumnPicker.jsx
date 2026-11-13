import React, { useEffect, useRef, useState, useMemo } from 'react';
import { SearchIcon } from './Icons.jsx';

/**
 * Modern "Columns" dropdown with a checklist of available catalog columns.
 * Supports quick-filtering when reports offer many columns.
 */
export function ColumnPicker({ columns, isVisible, toggle, reset, customized }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return undefined;
    }
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const shown = columns.filter(isVisible).length;

  const filteredColumns = useMemo(() => {
    if (!query.trim()) return columns;
    const q = query.toLowerCase();
    return columns.filter((col) => col.label.toLowerCase().includes(q));
  }, [columns, query]);

  if (columns.length === 0) return null;

  return (
    <div className="column-picker" ref={ref}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Customize visible columns"
      >
        <span>Columns</span>
        <span className="badge-counter" style={{ marginLeft: '2px' }}>
          {shown}/{columns.length}
        </span>
        <span style={{ fontSize: '0.65rem', marginLeft: '2px' }}>▾</span>
      </button>

      {open && (
        <div className="column-picker-menu" role="menu">
          {columns.length > 6 && (
            <div style={{ position: 'relative', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
              <SearchIcon
                size={12}
                style={{
                  position: 'absolute',
                  left: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                className="control-input"
                style={{
                  width: '100%',
                  paddingLeft: '1.65rem',
                  paddingTop: '0.25rem',
                  paddingBottom: '0.25rem',
                  fontSize: '0.75rem',
                }}
                placeholder="Filter columns..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filteredColumns.map((col) => {
              const checked = isVisible(col);
              // keep at least one column on screen
              const locked = checked && shown === 1;
              return (
                <label key={col.key} className="column-picker-item">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggle(col)}
                  />
                  <span>{col.label}</span>
                </label>
              );
            })}
            {filteredColumns.length === 0 && (
              <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                No columns match &quot;{query}&quot;
              </div>
            )}
          </div>

          <div className="column-picker-footer">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={reset}
              disabled={!customized}
              title="Restore standard column setup"
            >
              Reset to default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default ColumnPicker;
