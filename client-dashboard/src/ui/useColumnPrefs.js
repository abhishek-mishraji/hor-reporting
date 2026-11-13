/**
 * @file useColumnPrefs.js
 * Which columns the client chose to see, per user and per report, kept in this browser.
 * Only the user's changes from the defaults are stored, so new default columns still show up.
 */
import { useCallback, useState } from 'react';
import { useSession } from '../session/SessionContext.jsx';
import { columnPrefsVersion, upgradeColumnPrefs } from '../reportColumns.js';

function storageKey(userId, reportId, version = columnPrefsVersion(reportId)) {
  return `hor.cols.v${version}.${userId || 'anon'}.${reportId}`;
}

function read(key) {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

/**
 * Reads the saved choices. When a report's defaults changed (reportColumns.js COLUMN_DEFAULT_CHANGES),
 * choices saved under the previous version are carried over once, keeping the old defaults for that user.
 */
function load(userId, reportId) {
  try {
    const key = storageKey(userId, reportId);
    const current = read(key);
    if (current) return current;
    const version = columnPrefsVersion(reportId);
    if (version < 2) return {};
    const legacyKey = storageKey(userId, reportId, version - 1);
    const legacy = read(legacyKey);
    if (!legacy) return {};
    const upgraded = upgradeColumnPrefs(reportId, legacy);
    save(key, upgraded);
    window.localStorage.removeItem(legacyKey);
    return upgraded;
  } catch {
    return {};
  }
}

function save(key, overrides) {
  try {
    if (Object.keys(overrides).length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(overrides));
  } catch {
    // storage blocked (private window etc.): the choice still applies until the page reloads
  }
}

/**
 * @param {string} reportId
 * @returns {{ isVisible: (col: {key: string, show: boolean}) => boolean,
 *             toggle: (col: {key: string, show: boolean}) => void,
 *             reset: () => void,
 *             customized: boolean }}
 */
export function useColumnPrefs(reportId) {
  const { user } = useSession();
  const key = storageKey(user?.id, reportId);
  const [state, setState] = useState(() => ({ key, overrides: load(user?.id, reportId) }));

  // A different user or report: re-read during render instead of in an effect, so no stale flash.
  let overrides = state.overrides;
  if (state.key !== key) {
    overrides = load(user?.id, reportId);
    setState({ key, overrides });
  }

  const isVisible = useCallback(
    (col) => (col.key in overrides ? overrides[col.key] : col.show),
    [overrides]
  );

  const toggle = useCallback(
    (col) => {
      const next = { ...overrides };
      const visible = col.key in next ? next[col.key] : col.show;
      if (!visible === col.show) delete next[col.key];
      else next[col.key] = !visible;
      save(key, next);
      setState({ key, overrides: next });
    },
    [key, overrides]
  );

  const reset = useCallback(() => {
    save(key, {});
    setState({ key, overrides: {} });
  }, [key]);

  return { isVisible, toggle, reset, customized: Object.keys(overrides).length > 0 };
}
