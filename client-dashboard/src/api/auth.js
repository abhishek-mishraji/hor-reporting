/**
 * @file auth.js
 * Authentication endpoints matching docs/02 section 3.
 */
import { request, doFetch } from './http.js';

/**
 * Logs in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} Me object
 */
export async function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);
}

/**
 * Fetches the currently authenticated user session.
 * @returns {Promise<object>} Me object
 */
export async function getMe() {
  return request('/api/auth/me');
}

/**
 * Explicitly triggers session refresh.
 * @returns {Promise<void>}
 */
export async function refresh() {
  await doFetch('/api/auth/refresh', { method: 'POST' });
}

/**
 * Logs out the current user, clearing session cookies.
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    await doFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore network errors during logout
  }
}
