/**
 * @file useReport.js
 * Loads one report for the selected store and dates, dropping answers to requests that are no longer current.
 */
import { useEffect, useState } from 'react';
import { useSession } from '../session/SessionContext.jsx';

/**
 * @param {(ctx: {vendor: string, store: string, from: string, to: string}) => Promise<{data: any}>} load
 * @param {Array<any>} deps extra values that should trigger a reload (filters)
 * @returns {{ data: any, loading: boolean, error: Error|null }}
 */
export function useReport(load, deps = []) {
  const { selectedStore, from, to } = useSession();
  const vendor = selectedStore?.pos_vendor;
  const store = selectedStore?.store_code;
  const [state, setState] = useState({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!store || !from || !to) return undefined;
    let current = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load({ vendor, store, from, to })
      .then((res) => current && setState({ data: res.data, loading: false, error: null }))
      .catch((error) => current && setState({ data: null, loading: false, error }));
    return () => {
      current = false;
    };
    // load is an inline arrow; what it depends on is listed in deps
  }, [vendor, store, from, to, ...deps]);

  return state;
}

/**
 * Returns `value` once it has stopped changing for `ms` milliseconds (for search boxes).
 */
export function useDebounced(value, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
