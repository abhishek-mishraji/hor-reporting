import React, { useState } from 'react';
import { login } from '../api/auth.js';
import { useSession } from '../session/SessionContext.jsx';
import { ErrorBanner } from '../ui/ErrorBanner.jsx';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';
import { RefreshIcon } from '../ui/Icons.jsx';
import horLogo from '../assets/hor-logo.png';

function loginErrorMessage(err) {
  if (err.status === 401) return 'Wrong email or password.';
  if (err.status === 423) return 'Too many attempts. Your account is locked for a while; please try again later.';
  if (err.status === 403 && err.code === 'ACCOUNT_DISABLED') return 'Your account is disabled. Please contact support.';
  return 'Sign-in is not available right now. Please try again later.';
}

export function LoginPage() {
  const { setUser } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const me = await login(email, password);
      setUser(me);
    } catch (err) {
      setError(new Error(loginErrorMessage(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', zIndex: 10 }}>
        <ThemeToggle />
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-badge">
            <img
              src={horLogo}
              alt="Hands Off Retail"
              style={{ height: '38px', width: 'auto', maxWidth: '200px', objectFit: 'contain' }}
            />
          </div>
          <h2>Sign in</h2>
          <p>HOR Client Reporting Portal</p>
        </div>

        {error && <ErrorBanner error={error} title="Sign-in failed" />}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              className="control-input"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@handsoffretail.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="control-input"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.85rem', padding: '0.65rem', fontSize: '0.875rem' }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshIcon size={14} className="spin" />
                Signing in…
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
          }}
        >
          <span>Audited & verified POS reporting environment</span>
        </div>
      </div>
    </div>
  );
}
export default LoginPage;
