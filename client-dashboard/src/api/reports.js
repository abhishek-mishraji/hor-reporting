/**
 * @file reports.js
 * Endpoints for Verifone & Gilbarco reporting services per docs/03.
 * Routes each store through /svc/verifone or /svc/gilbarco based on pos_vendor.
 */
import { request, requestWithMeta } from './http.js';

/**
 * Returns the service prefix for a given POS vendor.
 * @param {'VERIFONE'|'GILBARCO'|string} vendor
 * @returns {string} '/svc/verifone' or '/svc/gilbarco'
 */
export function getServicePrefix(vendor) {
  return String(vendor || '').toUpperCase() === 'GILBARCO'
    ? '/svc/gilbarco'
    : '/svc/verifone';
}

/**
 * Converts a parameter object into a URL search string.
 * @param {Record<string, any>} params
 * @returns {string}
 */
export function toQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const s = searchParams.toString();
  return s ? `?${s}` : '';
}

/**
 * Constructs a CSV export URL for any report endpoint.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {string} endpoint
 * @param {Record<string, any>} params
 * @returns {string}
 */
export function getCsvUrl(vendor, endpoint, params = {}) {
  const prefix = getServicePrefix(vendor);
  const q = toQueryString({ ...params, format: 'csv' });
  return `${prefix}/api/reports/${endpoint}${q}`;
}

/**
 * Public service health status check (no auth required).
 * @param {'VERIFONE'|'GILBARCO'} vendor
 */
export async function getReportingStatus(vendor) {
  const prefix = getServicePrefix(vendor);
  return request(`${prefix}/api/reporting/status`);
}

/**
 * Stores endpoint.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 */
export async function getStores(vendor) {
  const prefix = getServicePrefix(vendor);
  return request(`${prefix}/api/reports/stores`);
}

/**
 * Date range endpoint returning accessible stores with min/max dates and file counts.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 */
export async function getDateRanges(vendor) {
  const prefix = getServicePrefix(vendor);
  return request(`${prefix}/api/reports/date-range`);
}

/**
 * Day Summary endpoint.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, from: string, to: string }} params
 */
export async function getDaySummary(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/day-summary${toQueryString(params)}`;
  return requestWithMeta(url);
}

/**
 * Items Sold endpoint (always capped at 20000).
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, from: string, to: string, dept?: string, itemType?: string, q?: string, byDay?: boolean, sort?: string, limit?: number }} params
 */
export async function getItemsSold(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/items-sold${toQueryString({
    limit: 20000,
    ...params,
  })}`;
  return requestWithMeta(url);
}

/**
 * Departments endpoint.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, from: string, to: string, salesClass?: string, byDay?: boolean }} params
 */
export async function getDepartments(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/departments${toQueryString(params)}`;
  return requestWithMeta(url);
}

/**
 * Monthly Department report.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, month: number, year: number }} params
 */
export async function getMonthlyDepartments(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/departments/monthly${toQueryString(params)}`;
  return requestWithMeta(url);
}

/**
 * Fuel report.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, from: string, to: string, byDay?: boolean, byPriceLevel?: boolean }} params
 */
export async function getFuel(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/fuel${toQueryString(params)}`;
  return requestWithMeta(url);
}

/**
 * Payments report (money taken per payment type).
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, from: string, to: string, byDay?: boolean }} params
 */
export async function getPayments(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/payments${toQueryString(params)}`;
  return requestWithMeta(url);
}

/**
 * Lottery figures entered by admin / staff for one store-day (Daily report).
 * Answer: { store_code, business_date, can_edit, version, values: {field: number}, updated_by_name, updated_at }.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, date: string }} params
 */
export async function getLotteryEntry(vendor, params) {
  const prefix = getServicePrefix(vendor);
  return requestWithMeta(`${prefix}/api/reports/daily-lottery${toQueryString(params)}`);
}

/**
 * Saves lottery figures (admin / staff only). `values`: field -> number, or null to go back to the POS figure.
 * 409 VERSION_CONFLICT when someone saved the same day after `version` was loaded.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, date: string }} params
 * @param {{ version: number, values: Record<string, number|null> }} body
 */
export async function saveLotteryEntry(vendor, params, body) {
  const prefix = getServicePrefix(vendor);
  return requestWithMeta(`${prefix}/api/reports/daily-lottery${toQueryString(params)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Cash movements report.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, from: string, to: string, kind?: string }} params
 */
export async function getCashMovements(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/cash-movements${toQueryString(params)}`;
  return requestWithMeta(url);
}

/**
 * Suspicious daily summary report.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, from: string, to: string }} params
 */
export async function getSuspiciousDaily(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/suspicious/daily${toQueryString(params)}`;
  return requestWithMeta(url);
}

/**
 * Voids daily summary report.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, from: string, to: string }} params
 */
export async function getVoids(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/voids${toQueryString(params)}`;
  return requestWithMeta(url);
}

/**
 * Suspicious events report (up to limit 20000).
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, from: string, to: string, kind?: string, register?: string, limit?: number }} params
 */
export async function getSuspiciousEvents(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/suspicious/events${toQueryString({
    limit: 20000,
    ...params,
  })}`;
  return requestWithMeta(url);
}

/**
 * Lottery report.
 * @param {'VERIFONE'|'GILBARCO'} vendor
 * @param {{ store: string, from: string, to: string }} params
 */
export async function getLottery(vendor, params) {
  const prefix = getServicePrefix(vendor);
  const url = `${prefix}/api/reports/lottery${toQueryString(params)}`;
  return requestWithMeta(url);
}

/**
 * Verifone drill-down for a ticket.
 * GET /api/tickets/{file_id}/{ticket_seq}?store
 * @param {string|number} fileId
 * @param {string|number} ticketSeq
 * @param {string} store
 */
export async function getVerifoneTicket(fileId, ticketSeq, store) {
  const url = `/svc/verifone/api/tickets/${encodeURIComponent(fileId)}/${encodeURIComponent(ticketSeq)}${toQueryString({ store })}`;
  return requestWithMeta(url);
}

/**
 * Gilbarco drill-down for an event.
 * GET /api/events/{file_id}?store
 * @param {string|number} fileId
 * @param {string} store
 */
export async function getGilbarcoEvent(fileId, store) {
  const url = `/svc/gilbarco/api/events/${encodeURIComponent(fileId)}${toQueryString({ store })}`;
  return requestWithMeta(url);
}
