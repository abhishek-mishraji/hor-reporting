/**
 * @file ReportTable.jsx
 * Client report table: only catalog columns (reportColumns.js) the user chose, formatted values,
 * optional collapsible groups with subtotals, and a totals row.
 */
import React, { useMemo, useState } from 'react';
import { availableColumns } from '../reportColumns.js';
import { formatCell, NUMERIC_TYPES, SUMMABLE_TYPES } from '../format.js';
import { sumCents, sumMilli } from '../num.js';
import { toCsv, downloadCsv } from '../csv.js';
import { useColumnPrefs } from './useColumnPrefs.js';
import { ColumnPicker } from './ColumnPicker.jsx';
import { DownloadIcon } from './Icons.jsx';

/** Sums a column exactly (integer cents for money, thousandths otherwise). */
function sumColumn(rows, col) {
  if (col.type === 'money') return sumCents(rows, col.key) / 100;
  return sumMilli(rows, col.key) / 1000;
}

function TotalsRow({ rows, columns, label, className }) {
  const labelIdx = columns.findIndex((c) => !SUMMABLE_TYPES.has(c.type));
  return (
    <tr className={className}>
      {columns.map((col, idx) => {
        if (SUMMABLE_TYPES.has(col.type)) {
          return (
            <td key={col.key} className="num-col mono">
              {formatCell(sumColumn(rows, col), col.type)}
            </td>
          );
        }
        return (
          <td key={col.key} className={idx === labelIdx ? 'totals-label' : ''}>
            {idx === labelIdx ? label : ''}
          </td>
        );
      })}
    </tr>
  );
}

const hasTransaction = (row) => Boolean(row.file_id);

function BodyRows({ rows, columns, onRowClick, isRowClickable = hasTransaction, rowTitle = 'Click to inspect transaction' }) {
  return rows.map((row, rIdx) => {
    const clickable = Boolean(onRowClick && isRowClickable(row));
    return (
      <tr
        key={rIdx}
        className={clickable ? 'clickable' : ''}
        onClick={clickable ? () => onRowClick(row) : undefined}
        title={clickable ? rowTitle : undefined}
      >
        {columns.map((col) => (
          <td key={col.key} className={NUMERIC_TYPES.has(col.type) ? 'num-col mono' : ''}>
            {formatCell(row[col.key], col.type, col.labels)}
          </td>
        ))}
      </tr>
    );
  });
}

/**
 * @param {object} props
 * @param {string} props.reportId key in REPORT_COLUMNS; also the saved-preferences key
 * @param {string} props.title
 * @param {Array<object>} [props.rows] flat rows (when not grouped)
 * @param {Array<{id: string, label: string, rows: Array<object>}>} [props.groups] grouped rows
 * @param {boolean} [props.showTotal] grand total row at the bottom (default true)
 * @param {boolean} [props.startCollapsed] groups start closed
 * @param {string} [props.csvUrl]
 * @param {string} [props.csvFileName] no server CSV: export the rows shown, visible columns only, under this name
 * @param {(row: object) => void} [props.onRowClick] rows with a file_id open a transaction
 * @param {(row: object) => boolean} [props.isRowClickable] which rows take onRowClick (default: rows with a file_id)
 * @param {string} [props.rowTitle] hover text of a clickable row
 * @param {React.ReactNode} [props.note] short line under the title
 */
export function ReportTable({
  reportId,
  title,
  rows,
  groups,
  showTotal = true,
  startCollapsed = false,
  csvUrl,
  csvFileName,
  onRowClick,
  isRowClickable,
  rowTitle,
  note,
  emptyMessage = 'Nothing to show for these dates.',
}) {
  const allRows = useMemo(
    () => (groups ? groups.flatMap((g) => g.rows) : rows || []),
    [groups, rows]
  );
  const available = useMemo(() => availableColumns(reportId, allRows), [reportId, allRows]);
  const prefs = useColumnPrefs(reportId);
  const columns = available.filter(prefs.isVisible);

  // ids of groups whose open/closed state differs from startCollapsed
  const [flipped, setFlipped] = useState(() => new Set());
  const isOpen = (id) => (flipped.has(id) ? startCollapsed : !startCollapsed);
  const toggleGroup = (id) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setAll = (open) => setFlipped(open === !startCollapsed ? new Set() : new Set(groups.map((g) => g.id)));

  const header = (
    <div className="table-header-title">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h3>{title}</h3>
          {allRows.length > 0 && (
            <span className="badge-counter" title={`${allRows.length} total rows`}>
              {allRows.length} {allRows.length === 1 ? 'row' : 'rows'}
            </span>
          )}
        </div>
        {note && <div className="table-note">{note}</div>}
      </div>
      <div className="table-actions">
        {groups && groups.length > 1 && (
          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll(true)}>
              Expand all
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll(false)}>
              Collapse all
            </button>
          </div>
        )}
        <ColumnPicker columns={available} {...prefs} />
        {csvUrl && allRows.length > 0 && (
          <a href={csvUrl} download className="btn btn-secondary btn-sm" title="Download report as CSV (Excel compatible)">
            <DownloadIcon size={14} />
            <span>Export CSV</span>
          </a>
        )}
        {!csvUrl && csvFileName && allRows.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            title="Download the rows shown as CSV (Excel compatible)"
            onClick={() => downloadCsv(toCsv(columns, allRows), csvFileName)}
          >
            <DownloadIcon size={14} />
            <span>Export CSV</span>
          </button>
        )}
      </div>
    </div>
  );

  if (allRows.length === 0) {
    return (
      <div className="table-card">
        {header}
        <div className="empty-state">
          <div className="empty-state-title">{emptyMessage}</div>
          <div className="empty-state-desc">
            Try adjusting your date range or filter selection in the toolbar above.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="table-card">
      {header}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={NUMERIC_TYPES.has(col.type) ? 'num-col' : ''}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {groups ? (
            groups.map((g) => {
              const open = isOpen(g.id);
              return (
                <tbody key={g.id} className="group-body">
                  <tr className="group-row" onClick={() => toggleGroup(g.id)}>
                    <td colSpan={columns.length}>
                      <button type="button" className="group-toggle" aria-expanded={open}>
                        <span className="group-caret" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
                          ▸
                        </span>
                        <span>{g.label}</span>
                        <span className="group-count">
                          {g.rows.length} {g.rows.length === 1 ? 'row' : 'rows'}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {open && <BodyRows rows={g.rows} columns={columns} {...{ onRowClick, isRowClickable, rowTitle }} />}
                  <TotalsRow rows={g.rows} columns={columns} label={`${g.label} total`} className="subtotal-row" />
                </tbody>
              );
            })
          ) : (
            <tbody>
              <BodyRows rows={allRows} columns={columns} {...{ onRowClick, isRowClickable, rowTitle }} />
            </tbody>
          )}

          {showTotal && (
            <tfoot>
              <TotalsRow rows={allRows} columns={columns} label="Grand Total" />
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
export default ReportTable;
