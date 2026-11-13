# Verifone Reporting Service REST API Specification

**Base Path:** `/api/reports`  
**Port:** `8094`  
**Authentication:** Cookie `hor_access` (RS256 JWT issued by `auth-service :8091`).  
**Error Standard:** RFC 9457 Problem Details (`application/problem+json`).

---

## 1. Global Request Parameters & Headers

### Headers
| Header | Type | Description |
|---|---|---|
| `Cookie` | `hor_access=<jwt>` | HTTP-only access token containing user identity and store assignments. |
| `Accept` | `application/json` or `text/csv` | Output format desired. |

### Common Query Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `store` | `string` | No (Yes for detail) | Store code or ID. If omitted, applies to all accessible Verifone stores. |
| `from` | `date` (`YYYY-MM-DD`) | No | Start of business date range (inclusive). Defaults to earliest loaded date. |
| `to` | `date` (`YYYY-MM-DD`) | No | End of business date range (inclusive). Defaults to latest loaded date. |
| `format` | `string` | No | Set to `csv` for UTF-8 CSV download with BOM. Defaults to JSON. |
| `byDay` | `boolean` | No | When `true`, returns daily broken-down records; when `false`, aggregates across range. |

---

## 2. Endpoints Inventory

### 2.1 Store & Scope Endpoints

#### `GET /api/reporting/status`
Returns health check status and service identifier.

#### `GET /api/reports/date-range`
Returns loaded date ranges for all accessible Verifone stores.

#### `GET /api/reports/stores`
Returns user's assigned Verifone stores catalog.

---

### 2.2 Analytics Reports Endpoints

#### `GET /api/reports/day-summary`
Returns daily financial and operational balance summary per store per day, including suspicious activity:
counts (`no_sales`, `void_lines`, `voids`, `refunds`, `refund_voids`) and amounts (`void_line_amount`,
`void_amount`, `total_void_amount`, `refund_amount`). See data-schema-mapping.md §2.1.

#### `GET /api/reports/items-sold`
Item-level sales and movement.
- Query Params: `store`, `from`, `to`, `dept`, `itemType` (`scanned` | `department ring`), `q`, `byDay`, `sort`, `limit`, `format`.

#### `GET /api/reports/departments`
Sales grouped by store department.
- Query Params: `store`, `from`, `to`, `salesClass`, `byDay`, `format`.

#### `GET /api/v1/reports/departments/monthly` & `GET /api/reports/departments/monthly`
Monthly department CSE report with gross, discount, promo, refund, void, and net sales per department and sales class. `totals` is merchandise only; lottery and fuel are in `classTotals` (one entry per sales class).
- Query Params: `store` (required), `month`, `year`, `format`.

#### `GET /api/v1/reports/daily-register` & `GET /api/reports/daily-register`
Daily register breakdown including grocery total, fuel volume, safe drops (cash and check deposits), no-sales, line voids, and refunds.
- Query Params: `store` (required), `date`, `from`, `to`, `format`.

#### `GET /api/reports/fuel`
Fuel dispensed by grade and price level.

#### `GET /api/reports/payments`
Tender payments and refunds.

#### `GET /api/reports/cash-movements`
Register drawer cash movements (safe drops, payouts, loans).

#### `GET /api/reports/suspicious/events`
Audit trail of error corrects, void lines, whole transaction voids, and refunds.

#### `GET /api/reports/suspicious/daily`
Daily aggregated counts and amounts per suspicious event kind.

#### `GET /api/reports/lottery` & `GET /api/reports/lottery-payouts`
Lottery sales and winning ticket payouts reported separately without netting.

#### `GET /api/reports/voids`
Detailed daily voids summary (void lines, void amount, etc.).

---

### 2.3 Ticket Drill-Down Endpoints

#### `GET /api/tickets/{fileId}/{ticketSeq}`
Retrieves complete receipt detail behind any ticket:
- Header (terminal, cashier, timestamp, totals)
- Line items (UPC, quantity, gross, promo, net, dept)
- Tender payments (CASH, CREDIT, etc.)
- Tax breakdown
- Related tickets (e.g. prepay fuel deposit vs completion)

---

## 3. Error Responses (RFC 9457 Problem Details)

All errors return JSON with Content-Type `application/problem+json`:
- `401 Unauthorized`: Missing or invalid authentication token.
- `404 Not Found`: Store not found or belongs to a different POS vendor.
