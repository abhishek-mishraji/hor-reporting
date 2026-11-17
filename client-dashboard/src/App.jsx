import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './session/SessionContext.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { Layout } from './ui/Layout.jsx';
import { DaySummaryPage } from './pages/DaySummaryPage.jsx';
import { ItemsPage } from './pages/ItemsPage.jsx';
import { DepartmentsPage } from './pages/DepartmentsPage.jsx';
import { MonthlyPage } from './pages/MonthlyPage.jsx';
import { FuelPage } from './pages/FuelPage.jsx';
import { CashPage } from './pages/CashPage.jsx';
import { SuspiciousPage } from './pages/SuspiciousPage.jsx';
import { LotteryPage } from './pages/LotteryPage.jsx';
import { DailyReportPage } from './pages/DailyReportPage.jsx';
import { RefreshIcon } from './ui/Icons.jsx';
import horLogo from './assets/hor-logo.png';

export function App() {
  const { user, loadingUser } = useSession();

  if (loadingUser) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-app)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="loading-logo-badge" style={{ margin: '0 auto 1.25rem' }}>
            <img
              src={horLogo}
              alt="Hands Off Retail"
              style={{ height: '38px', width: 'auto', maxWidth: '180px', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div
              className="status-pill info"
              style={{
                padding: '0.45rem 0.95rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.75rem',
              }}
            >
              <RefreshIcon size={13} className="spin" />
              <span>Verifying session…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/day-summary" replace />} />
        <Route path="/day-summary" element={<DaySummaryPage />} />
        <Route path="/daily-report" element={<DailyReportPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/monthly" element={<MonthlyPage />} />
        <Route path="/fuel" element={<FuelPage />} />
        <Route path="/cash" element={<CashPage />} />
        <Route path="/suspicious" element={<SuspiciousPage />} />
        <Route path="/lottery" element={<LotteryPage />} />
        <Route path="*" element={<Navigate to="/day-summary" replace />} />
      </Route>
    </Routes>
  );
}
export default App;
