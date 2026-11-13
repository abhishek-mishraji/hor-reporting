import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, logout as apiLogout } from '../api/auth.js';
import { getDateRanges } from '../api/reports.js';
import { setOnSessionExpired } from '../api/http.js';

const SessionContext = createContext(null);

/** The default dates for a store: its latest loaded business day only (From = To = last_day). */
function latestDay(store) {
  return store?.last_day || '';
}

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [stores, setStores] = useState([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [selectedStoreCode, setSelectedStoreCode] = useState('');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [serviceErrors, setServiceErrors] = useState({
    verifone: null,
    gilbarco: null,
  });

  // On session expiration, clear user
  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
    });
  }, []);

  // Fetch current user on mount
  const checkAuth = useCallback(async () => {
    setLoadingUser(true);
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load stores from both services in parallel when user is logged in
  const loadStores = useCallback(async () => {
    if (!user) {
      setStores([]);
      setSelectedStoreCode('');
      return;
    }

    setLoadingStores(true);
    const errors = { verifone: null, gilbarco: null };

    const [vResult, gResult] = await Promise.allSettled([
      getDateRanges('VERIFONE'),
      getDateRanges('GILBARCO'),
    ]);

    let merged = [];

    if (vResult.status === 'fulfilled' && Array.isArray(vResult.value)) {
      merged = merged.concat(vResult.value);
    } else if (vResult.status === 'rejected') {
      errors.verifone = vResult.reason?.detail || vResult.reason?.message || 'Verifone service unreachable';
    }

    if (gResult.status === 'fulfilled' && Array.isArray(gResult.value)) {
      merged = merged.concat(gResult.value);
    } else if (gResult.status === 'rejected') {
      errors.gilbarco = gResult.reason?.detail || gResult.reason?.message || 'Gilbarco service unreachable';
    }

    setServiceErrors(errors);
    setStores(merged);

    // Set default store and date range if not yet selected
    if (merged.length > 0) {
      setSelectedStoreCode((prev) => {
        const found = merged.find((s) => s.store_code === prev);
        const target = found || merged[0];
        setFrom(latestDay(target));
        setTo(latestDay(target));
        return target.store_code;
      });
    } else {
      setSelectedStoreCode('');
      setFrom('');
      setTo('');
    }

    setLoadingStores(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadStores();
    }
  }, [user, loadStores]);

  const selectedStore = React.useMemo(() => {
    return stores.find((s) => s.store_code === selectedStoreCode) || null;
  }, [stores, selectedStoreCode]);

  // When store selection changes, jump to that store's latest day
  const handleSelectStore = useCallback(
    (code) => {
      setSelectedStoreCode(code);
      const st = stores.find((s) => s.store_code === code);
      setFrom(latestDay(st));
      setTo(latestDay(st));
    },
    [stores]
  );

  const handleLogout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStores([]);
    setSelectedStoreCode('');
    setFrom('');
    setTo('');
  }, []);

  const value = {
    user,
    setUser,
    loadingUser,
    stores,
    loadingStores,
    selectedStore,
    selectedStoreCode,
    setSelectedStoreCode: handleSelectStore,
    from,
    setFrom,
    to,
    setTo,
    serviceErrors,
    reloadStores: loadStores,
    logout: handleLogout,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
