import React, { useMemo, useState } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { getItemsSold, getDepartments, getCsvUrl } from '../api/reports.js';
import { ReportTable } from '../ui/ReportTable.jsx';
import { ReportStatus } from '../ui/ReportStatus.jsx';
import { useReport, useDebounced } from '../ui/useReport.js';
import { SearchIcon } from '../ui/Icons.jsx';

const ITEM_LIMIT = 20000;

function deptLabel(number, name) {
  return name ? `${name} (#${number})` : `Department #${number}`;
}

export function ItemsPage() {
  const { selectedStore, from, to } = useSession();
  const vendor = selectedStore?.pos_vendor;
  const store = selectedStore?.store_code;

  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');
  const [itemType, setItemType] = useState('');
  const [byDay, setByDay] = useState(false);
  const [groupByDept, setGroupByDept] = useState(true);
  const q = useDebounced(search.trim());

  // Merchandise departments sold in these dates, for the department filter.
  const depts = useReport((p) =>
    getDepartments(p.vendor, { store: p.store, from: p.from, to: p.to, salesClass: 'merchandise' })
  );
  const deptOptions = useMemo(
    () =>
      (depts.data || [])
        .map((d) => ({ value: String(d.dept_number), label: deptLabel(d.dept_number, d.dept_name) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [depts.data]
  );

  const params = { limit: ITEM_LIMIT };
  if (dept) params.dept = dept;
  if (q) params.q = q;
  if (itemType) params.itemType = itemType;
  if (byDay) params.byDay = true;

  const { data, loading, error } = useReport(
    (p) => getItemsSold(p.vendor, { store: p.store, from: p.from, to: p.to, ...params }),
    [dept, q, itemType, byDay]
  );

  const rows = useMemo(() => data || [], [data]);

  const groups = useMemo(() => {
    if (!groupByDept) return null;
    const byNumber = new Map();
    for (const row of rows) {
      const id = String(row.dept_number);
      if (!byNumber.has(id)) {
        byNumber.set(id, { id, label: deptLabel(row.dept_number, row.dept_name), rows: [] });
      }
      byNumber.get(id).rows.push(row);
    }
    return [...byNumber.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, groupByDept]);

  const truncated = rows.length >= ITEM_LIMIT;

  return (
    <div>
      <div className="filter-bar">
        <div className="control-group">
          <label htmlFor="items-dept" className="control-label">Department</label>
          <select id="items-dept" className="control-select" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {deptOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="items-search" className="control-label">Search</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <SearchIcon size={13} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              id="items-search"
              type="search"
              className="control-input"
              style={{ paddingLeft: '26px' }}
              placeholder="UPC or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="control-group">
          <label htmlFor="items-type" className="control-label">Item type</label>
          <select id="items-type" className="control-select" value={itemType} onChange={(e) => setItemType(e.target.value)}>
            <option value="">All types</option>
            <option value="scanned">Scanned</option>
            <option value="department ring">Department ring</option>
          </select>
        </div>

        <div className="filter-bar__toggles">
          <label className="filter-check">
            <input type="checkbox" checked={groupByDept} onChange={(e) => setGroupByDept(e.target.checked)} />
            <span>Group by department</span>
          </label>
          <label className="filter-check">
            <input type="checkbox" checked={byDay} onChange={(e) => setByDay(e.target.checked)} />
            <span>Show each day</span>
          </label>
        </div>
      </div>

      <ReportStatus loading={loading} error={error} what="items" />
      {!loading && data && (
        <ReportTable
          reportId="items"
          title="Item sales"
          note={
            truncated
              ? `Showing the first ${ITEM_LIMIT.toLocaleString()} items. Pick a department or fewer dates to see the rest.`
              : 'Merchandise only: lottery and fuel are not included.'
          }
          rows={rows}
          groups={groups}
          startCollapsed={!dept && (groups?.length ?? 0) > 1}
          csvUrl={getCsvUrl(vendor, 'items-sold', { store, from, to, ...params })}
        />
      )}
    </div>
  );
}
export default ItemsPage;
