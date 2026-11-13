import React from 'react';
import { useTheme } from './ThemeContext.jsx';
import { SunIcon, MoonIcon } from './Icons.jsx';

export function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`theme-switcher ${className}`} role="group" aria-label="Theme selector">
      <button
        type="button"
        className={`btn-theme-opt ${theme === 'light' ? 'active' : ''}`}
        onClick={() => setTheme('light')}
        title="Force Light Theme"
      >
        <SunIcon size={13} />
        <span>Light</span>
      </button>

      <button
        type="button"
        className={`btn-theme-opt ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => setTheme('dark')}
        title="Force Dark Theme"
      >
        <MoonIcon size={13} />
        <span>Dark</span>
      </button>

      <button
        type="button"
        className={`btn-theme-opt ${theme === 'system' ? 'active' : ''}`}
        onClick={() => setTheme('system')}
        title="Automatic (Match System OS Theme)"
      >
        <span>Auto</span>
      </button>
    </div>
  );
}
export default ThemeToggle;
