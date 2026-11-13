import React, { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { getVerifoneTicket, getGilbarcoEvent } from '../api/reports.js';
import { ErrorBanner } from './ErrorBanner.jsx';
import { ReceiptIcon } from './Icons.jsx';

export function DrilldownModal({
  isOpen,
  onClose,
  fileId,
  ticketSeq,
  vendor,
  storeCode,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isV = String(vendor || '').toUpperCase() === 'VERIFONE';

  useEffect(() => {
    if (!isOpen || !fileId || !storeCode) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    async function fetchDrilldown() {
      try {
        let res;
        if (isV) {
          if (!ticketSeq) {
            throw new Error('This transaction cannot be opened.');
          }
          res = await getVerifoneTicket(fileId, ticketSeq, storeCode);
        } else {
          res = await getGilbarcoEvent(fileId, storeCode);
        }

        if (isMounted) {
          setData(res.data);
        }
      } catch (err) {
        if (isMounted) {
          if (err.status === 404) {
            setError(new Error('This transaction was not found. Press Refresh and try again.'));
          } else {
            setError(err);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDrilldown();
    return () => {
      isMounted = false;
    };
  }, [isOpen, fileId, ticketSeq, vendor, storeCode, isV]);

  if (!isOpen) return null;

  // Separate top-level fields from arrays (lines, payments, taxes, related)
  const scalarFields = {};
  const arrayFields = {
    lines: [],
    payments: [],
    taxes: [],
    related: [],
  };

  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) {
        arrayFields[k] = v;
      } else {
        scalarFields[k] = v;
      }
    }
  }

  const modalTitle = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <ReceiptIcon size={18} style={{ color: 'var(--primary)' }} />
      <span>Transaction details</span>
      {ticketSeq && (
        <span className="badge-counter" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
          #{ticketSeq}
        </span>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="960px">
      {error && <ErrorBanner error={error} />}

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div className="status-pill info" style={{ padding: '0.4rem 1rem', fontSize: '0.8125rem' }}>
            Retrieving transaction receipt…
          </div>
        </div>
      )}

      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Metadata Key-Value Grid */}
          <div className="table-card" style={{ marginBottom: 0 }}>
            <div className="table-header-title">
              <h3>Summary & Register Info</h3>
              <span className="status-pill info">Verified POS Record</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                padding: '1rem',
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              {Object.entries(scalarFields).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    padding: '0.55rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {k.replace(/_/g, ' ')}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      marginTop: '0.2rem',
                      color: 'var(--text-main)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {v !== null && v !== undefined ? String(v) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lines Table */}
          {arrayFields.lines && arrayFields.lines.length > 0 && (
            <div className="table-card" style={{ marginBottom: 0 }}>
              <div className="table-header-title">
                <h3>Line Items ({arrayFields.lines.length})</h3>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(arrayFields.lines[0]).map((col) => (
                        <th key={col} className={col.includes('amount') || col.includes('price') || col.includes('qty') ? 'num-col' : ''}>
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arrayFields.lines.map((row, idx) => (
                      <tr key={idx}>
                        {Object.keys(arrayFields.lines[0]).map((col) => {
                          const val = row[col];
                          const isNum = typeof val === 'number';
                          return (
                            <td key={col} className={isNum ? 'num-col mono' : ''}>
                              {val !== null && val !== undefined ? String(val) : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payments / Tenders Table */}
          {arrayFields.payments && arrayFields.payments.length > 0 && (
            <div className="table-card" style={{ marginBottom: 0 }}>
              <div className="table-header-title">
                <h3>Payments & Tenders ({arrayFields.payments.length})</h3>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(arrayFields.payments[0]).map((col) => (
                        <th key={col} className={col.includes('amount') ? 'num-col' : ''}>
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arrayFields.payments.map((row, idx) => (
                      <tr key={idx}>
                        {Object.keys(arrayFields.payments[0]).map((col) => {
                          const val = row[col];
                          const isNum = typeof val === 'number';
                          return (
                            <td key={col} className={isNum ? 'num-col mono' : ''}>
                              {val !== null && val !== undefined ? String(val) : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Taxes Table */}
          {arrayFields.taxes && arrayFields.taxes.length > 0 && (
            <div className="table-card" style={{ marginBottom: 0 }}>
              <div className="table-header-title">
                <h3>Taxes ({arrayFields.taxes.length})</h3>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(arrayFields.taxes[0]).map((col) => (
                        <th key={col} className={col.includes('amount') ? 'num-col' : ''}>
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arrayFields.taxes.map((row, idx) => (
                      <tr key={idx}>
                        {Object.keys(arrayFields.taxes[0]).map((col) => {
                          const val = row[col];
                          const isNum = typeof val === 'number';
                          return (
                            <td key={col} className={isNum ? 'num-col mono' : ''}>
                              {val !== null && val !== undefined ? String(val) : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Related Tickets / Events */}
          {arrayFields.related && arrayFields.related.length > 0 && (
            <div className="table-card" style={{ marginBottom: 0 }}>
              <div className="table-header-title">
                <h3>Related Transactions ({arrayFields.related.length})</h3>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(arrayFields.related[0]).map((col) => (
                        <th key={col}>{col.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arrayFields.related.map((row, idx) => (
                      <tr key={idx}>
                        {Object.keys(arrayFields.related[0]).map((col) => {
                          const val = row[col];
                          const isNum = typeof val === 'number';
                          return (
                            <td key={col} className={isNum ? 'num-col mono' : ''}>
                              {val !== null && val !== undefined ? String(val) : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
export default DrilldownModal;
