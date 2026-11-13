import React from 'react';
import { NavLink } from 'react-router-dom';
import horLogo from '../assets/hor-logo.png';
import horBadge from '../assets/hor-badge.png';
import {
  GridIcon,
  TagIcon,
  LayersIcon,
  CalendarIcon,
  FuelIcon,
  CashIcon,
  ShieldAlertIcon,
  TicketIcon,
  LogOutIcon,
} from './Icons.jsx';

const NAV_ITEMS = [
  { path: '/day-summary', label: 'Day summary', icon: <GridIcon size={18} /> },
  { path: '/items', label: 'Items', icon: <TagIcon size={18} /> },
  { path: '/departments', label: 'Departments', icon: <LayersIcon size={18} /> },
  { path: '/monthly', label: 'Monthly', icon: <CalendarIcon size={18} /> },
  { path: '/fuel', label: 'Fuel', icon: <FuelIcon size={18} /> },
  { path: '/cash', label: 'Cash', icon: <CashIcon size={18} /> },
  { path: '/suspicious', label: 'Suspicious', icon: <ShieldAlertIcon size={18} /> },
  { path: '/lottery', label: 'Lottery', icon: <TicketIcon size={18} /> },
];

export function Sidebar({ isCollapsed = false, isMobileOpen = false, onNavigate, onLogout }) {
  return (
    <aside
      className={`app-sidebar ${isCollapsed ? 'app-sidebar--collapsed' : ''} ${
        isMobileOpen ? 'app-sidebar--mobile-open' : ''
      }`.trim()}
      aria-label="Sidebar navigation"
    >
      <div className="app-sidebar__brand">
        <div className="app-sidebar__logo" title="Hands Off Retail">
          <img
            src={isCollapsed ? horBadge : horLogo}
            alt="Hands Off Retail"
            style={{ maxHeight: '32px', width: 'auto', objectFit: 'contain' }}
          />
        </div>
        {!isCollapsed && <p className="app-sidebar__eyebrow">STORE REPORTS</p>}
      </div>

      <nav className="app-sidebar__nav" aria-label="Main reports">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              `app-sidebar__link ${isActive ? 'app-sidebar__link--active' : ''}`.trim()
            }
          >
            <span className="app-sidebar__link-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="app-sidebar__link-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        {onLogout && (
          <button
            type="button"
            className={`app-sidebar__logout-btn ${isCollapsed ? 'app-sidebar__logout-btn--collapsed' : ''}`}
            onClick={onLogout}
            title="Sign out of your session"
          >
            <LogOutIcon size={16} />
            {!isCollapsed && <span>Log out</span>}
          </button>
        )}

        {!isCollapsed && (
          <div className="app-sidebar__footer-text">
            <span className="app-sidebar__footer-brand">Hands Off Retail</span>
            <span className="app-sidebar__footer-meta">Audited POS client portal</span>
          </div>
        )}
      </div>
    </aside>
  );
}
export default Sidebar;
