import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../session/SessionContext.jsx';
import { StoreIcon, CalendarIcon } from './Icons.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { Sidebar } from './Sidebar.jsx';

const MOBILE_QUERY = '(max-width: 980px)';

export function Layout() {
  const {
    user,
    stores,
    loadingStores,
    selectedStore,
    selectedStoreCode,
    setSelectedStoreCode,
    from,
    setFrom,
    to,
    setTo,
    serviceErrors,
    logout,
  } = useSession();

  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [reloadKey] = useState(0);

  const hasNoDataLoaded = !selectedStore?.first_day && !selectedStore?.last_day;
  const someStoresMissing = Boolean(serviceErrors.verifone || serviceErrors.gilbarco);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  // Lock body scrolling when mobile drawer is open
  useEffect(() => {
    if (isMobileNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileNavOpen]);

  // One toggle: mobile opens drawer, desktop collapses sidebar rail
  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches) {
      setIsMobileNavOpen((cur) => !cur);
    } else {
      setIsCollapsed((cur) => !cur);
    }
  };

  const closeMobileNav = () => setIsMobileNavOpen(false);


  const userInitial = user?.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : 'U';

  return (
    <div className={`app-shell ${isCollapsed ? 'app-shell--collapsed' : ''}`.trim()}>
      <Sidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileNavOpen}
        onNavigate={closeMobileNav}
        onLogout={logout}
      />

      {isMobileNavOpen && (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Close navigation drawer"
          onClick={closeMobileNav}
        />
      )}

      <div className="app-shell__content">
        <header className="app-topbar">
          <div className="app-topbar__identity">
            <button
              type="button"
              className={`app-topbar__menu-btn ${isMobileNavOpen ? 'is-open' : ''}`.trim()}
              onClick={handleToggleSidebar}
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileNavOpen}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span />
              <span />
              <span />
            </button>

            <div>
              <p className="app-topbar__welcome">
                Store Reports
              </p>
              <h3 className="app-topbar__title">
                {selectedStore?.store_name || 'All Locations'}
              </h3>
            </div>
          </div>

          <div className="controls-bar">
            <div className="control-group" title="Select store">
              <StoreIcon size={14} style={{ color: 'var(--text-muted)', marginLeft: '4px' }} />
              <label htmlFor="store-select" className="control-label">Store</label>
              <select
                id="store-select"
                className="control-select"
                value={selectedStoreCode}
                onChange={(e) => setSelectedStoreCode(e.target.value)}
                disabled={loadingStores || stores.length === 0}
              >
                {stores.length === 0 && <option value="">No stores available</option>}
                {stores.map((s) => (
                  <option key={s.store_code} value={s.store_code}>
                    {s.store_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-group" title="Start date">
              <CalendarIcon size={14} style={{ color: 'var(--text-muted)', marginLeft: '4px' }} />
              <label htmlFor="from-date" className="control-label">From</label>
              <input
                id="from-date"
                type="date"
                className="control-input mono"
                value={from}
                min={selectedStore?.first_day || undefined}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                disabled={hasNoDataLoaded}
              />
            </div>

            <div className="control-group" title="End date">
              <CalendarIcon size={14} style={{ color: 'var(--text-muted)', marginLeft: '4px' }} />
              <label htmlFor="to-date" className="control-label">To</label>
              <input
                id="to-date"
                type="date"
                className="control-input mono"
                value={to}
                min={from || undefined}
                max={selectedStore?.last_day || undefined}
                onChange={(e) => setTo(e.target.value)}
                disabled={hasNoDataLoaded}
              />
            </div>
          </div>

          <div className="app-topbar__actions">
            <ThemeToggle />
            {user && (
              <div className="app-topbar__user" title={user.email}>
                <div className="app-topbar__avatar">
                  {userInitial}
                </div>
                <div className="app-topbar__role">
                  <span>{user.fullName || user.email?.split('@')[0]}</span>
                  <small>{user.role || user.email}</small>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="app-shell__main">
          {someStoresMissing && (
            <div className="notice-banner" role="status">
              Some stores could not be loaded right now. Press Refresh to try again.
            </div>
          )}

          {hasNoDataLoaded && selectedStore && (
            <div className="table-card">
              <div className="empty-state">
                <div className="empty-state-title">No sales data yet for {selectedStore.store_name}</div>
                <div className="empty-state-desc">Reports will appear here once the store&apos;s first day is received.</div>
              </div>
            </div>
          )}

          {!hasNoDataLoaded && <Outlet key={reloadKey} />}
        </main>
      </div>
    </div>
  );
}
export default Layout;
