/**
 * @file http.js
 * The ONLY fetch wrapper for client-dashboard.
 * Contract:
 * - credentials: 'same-origin' (cookies are httpOnly, never accessed by JS)
 * - header 'X-HOR-Request': '1' on all calls
 * - Problem-JSON RFC 9457 error parsing -> ApiError{status, code, detail, errors, raw}
 * - Serialized 401 refresh flow using navigator.locks ('hor-refresh') per docs/02 section 3
 */

export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} detail
   * @param {Array<{field: string, message: string}>} [errors]
   * @param {object} [raw]
   * @param {string} [url]
   */
  constructor(status, code, detail, errors = [], raw = null, url = '') {
    super(detail || code || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || (status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'ERROR');
    this.detail = detail || this.message;
    this.errors = Array.isArray(errors) ? errors : [];
    this.raw = raw;
    this.url = url;
  }
}

const CSRF_HEADER = 'X-HOR-Request';
const REFRESH_LOCK_NAME = 'hor-refresh';

let onSessionExpiredHandler = null;

/**
 * Registers a callback when a session definitively expires.
 * @param {() => void} callback
 */
export function setOnSessionExpired(callback) {
  onSessionExpiredHandler = callback;
}

/**
 * Parses response problem JSON or falls back to standard text.
 * @param {Response} res
 * @param {string} url
 * @returns {Promise<ApiError>}
 */
async function parseErrorResponse(res, url) {
  let body = null;
  try {
    const text = await res.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Non-JSON response
  }

  const status = res.status;
  const code = body?.code || (status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'ERROR');
  const detail = body?.detail || body?.title || (status === 404 ? 'Store not found or not accessible' : res.statusText || 'Unknown error');
  const errors = body?.errors || [];

  return new ApiError(status, code, detail, errors, body, url);
}

/**
 * Internal fetch with same-origin credentials and CSRF header.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export async function doFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set(CSRF_HEADER, '1');

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers,
  });
}

/**
 * Handles 401 errors using navigator.locks per docs/02 section 3.
 * @param {() => Promise<Response>} retryOriginalRequest
 * @returns {Promise<Response>}
 */
async function handle401WithLock(retryOriginalRequest) {
  const performRefresh = async () => {
    // 1. Inside the lock, retry the original request first (another tab may have refreshed)
    const probe = await retryOriginalRequest();
    if (probe.status !== 401) {
      return probe;
    }

    // 2. Call POST /api/auth/refresh
    let refreshRes;
    try {
      refreshRes = await doFetch('/api/auth/refresh', { method: 'POST' });
    } catch (err) {
      if (onSessionExpiredHandler) onSessionExpiredHandler();
      throw err;
    }

    if (refreshRes.status === 204 || refreshRes.ok) {
      // 3. Retry original request once
      return retryOriginalRequest();
    }

    if (refreshRes.status === 401) {
      // 4. Session ended -> trigger login
      if (onSessionExpiredHandler) {
        onSessionExpiredHandler();
      }
      throw await parseErrorResponse(refreshRes, '/api/auth/refresh');
    }

    throw await parseErrorResponse(refreshRes, '/api/auth/refresh');
  };

  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request(REFRESH_LOCK_NAME, performRefresh);
  }

  return performRefresh();
}

/**
 * Core request helper that automatically retries 401 when code is TOKEN_EXPIRED or UNAUTHENTICATED.
 * Returns metadata alongside data for screen diagnostics.
 * @param {string} path
 * @param {RequestInit} [options]
 * @param {boolean} [allowAutoRefresh=true]
 * @returns {Promise<{ data: any, status: number, url: string, headers: Headers }>}
 */
export async function requestWithMeta(path, options = {}, allowAutoRefresh = true) {
  const isAuthEndpoint = path.startsWith('/api/auth/login') ||
    path.startsWith('/api/auth/refresh') ||
    path.startsWith('/api/auth/logout');

  const execute = () => doFetch(path, options);

  let res;
  try {
    res = await execute();
  } catch (netErr) {
    throw new ApiError(0, 'NETWORK_ERROR', `Network error connecting to ${path}: ${netErr.message}`, [], null, path);
  }

  if (res.status === 401 && allowAutoRefresh && !isAuthEndpoint) {
    // Inspect if error code qualifies for refresh
    let cloneBody = null;
    try {
      const cloned = res.clone();
      const text = await cloned.text();
      if (text) cloneBody = JSON.parse(text);
    } catch {
      // ignore
    }

    const code = cloneBody?.code;
    // Only refresh on TOKEN_EXPIRED or UNAUTHENTICATED
    if (!code || code === 'TOKEN_EXPIRED' || code === 'UNAUTHENTICATED') {
      res = await handle401WithLock(execute);
    }
  }

  if (!res.ok) {
    throw await parseErrorResponse(res, path);
  }

  if (res.status === 204) {
    return { data: null, status: res.status, url: path, headers: res.headers };
  }

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return {
    data,
    status: res.status,
    url: path,
    headers: res.headers,
  };
}

/**
 * Convenience wrapper returning only the data payload.
 * @param {string} path
 * @param {RequestInit} [options]
 * @param {boolean} [allowAutoRefresh=true]
 * @returns {Promise<any>}
 */
export async function request(path, options = {}, allowAutoRefresh = true) {
  const res = await requestWithMeta(path, options, allowAutoRefresh);
  return res.data;
}
