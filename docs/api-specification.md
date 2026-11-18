# Reporting Service REST API Specification

**Base Path:** `/api/reporting` (or `/api/reports` when called directly or through reverse proxy)  
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
Every reporting endpoint supports:
| Parameter | Type | Required | Description |
|---|---|---|---|
| `store` | `string` | No (Yes for detail) | Store code (e.g. `8730_IN-47872`) or store ID. If omitted, applies to all accessible stores. |
| `from` | `date` (`YYYY-MM-DD`) | No | Start of business date range (inclusive). Defaults to earliest loaded date. |
| `to` | `date` (`YYYY-MM-DD`) | No | End of business date range (inclusive). Defaults to latest loaded date. |
| `format` | `string` | No | Set to `csv` for UTF-8 CSV download with BOM (opens in Excel). Defaults to JSON. |
| `byDay` | `boolean` | No | When `true`, returns daily broken-down records; when `false` (default), aggregates across the range. |

---

## 2. Endpoints Inventory

### 2.1 Store & Scope Endpoints

#### `GET /api/reports/date-range`
Returns the loaded date ranges for all stores the current user has permission to view.
- **Access:** Any authenticated user.
- **Response `200 OK` (JSON):**
```json
[
  {
    "store_code": "8730_IN-47872",
    "store_name": "Tiki Hut",
    "pos_vendor": "VERIFONE",
    "first_day": "2026-09-01",
    "last_day": "2026-09-30",
    "files": 30
  },
  {
    "store_code": "800_NY-13208",
    "store_name": "Wolf Quick Stop",
    "pos_vendor": "GILBARCO",
    "first_day": "2026-09-22",
    "last_day": "2026-09-30",
    "files": 8420
  }
]
```

#### `GET /api/reports/stores`
Returns user's assigned store catalog with POS metadata.
- **Response `200 OK` (JSON):**
```json
[
  {
    "store_id": 1,
    "store_code": "8730_IN-47872",
    "store_name": "Tiki Hut",
    "pos_vendor": "VERIFONE",
    "timezone": "America/Indiana/Indianapolis",
    "status": "ACTIVE"
  }
]
```

---

### 2.2 Analytics Reports Endpoints

#### `GET /api/reports/day-summary`
Returns daily financial and operational balance summary per store per day.
- **Query Params:** `store`, `from`, `to`, `format`
- **Response `200 OK` (JSON array of daily summaries):**
```json
[
  {
    "store_code": "8730_IN-47872",
    "business_date": "2026-09-25",
    "customers": 642,
    "total_sales_with_tax": 9542.80,
    "total_sales_before_tax": 9120.40,
    "tax": 422.40,
    "grocery_total": 4820.10,
    "fuel_sales": 3950.30,
    "fuel_volume": 1250.40,
    "lottery_sales": 720.00,
    "lottery_payouts": 350.00,
    "promotions": 142.50,
    "payments_net": 9542.80,
    "counter_ties": true,
    "safe_drops": 4,
    "cash_deposit": 4500.00,
    "check_deposit": 0.00,
    "payout_amount": 50.00,
    "no_sale_count": 8,
    "line_void_count": 12,
    "line_void_amount": 45.20,
    "void_count": 2,
    "void_amount": 32.10,
    "refund_count": 3,
    "refund_amount": 28.50,
    "period_opened": "2026-09-25T05:00:00",
    "period_closed": "2026-09-25T23:30:00"
  }
]
```

#### `GET /api/reports/items-sold`
Item-level sales and movement.
- **Query Params:** `store`, `from`, `to`, `dept`, `itemType` (`scanned` | `department ring`), `q` (UPC or text query), `byDay` (`true` | `false`), `sort`, `limit` (max 20,000), `format`.
- **Response `200 OK` (JSON):**
```json
[
  {
    "store_code": "8730_IN-47872",
    "item_type": "scanned",
    "upc": "01820000016",
    "description": "Bud Light 12pk Can",
    "dept_number": 4,
    "dept_name": "Beer",
    "sales_class": "merchandise",
    "units_sold": 24,
    "gross_sales": 359.76,
    "promotions": 24.00,
    "net_sales": 335.76,
    "tickets": 18,
    "days": 7
  }
]
```

#### `GET /api/reports/departments`
Sales grouped by store department.
- **Query Params:** `store`, `from`, `to`, `salesClass` (`merchandise` | `lottery_sale` | `lottery_payout` | `fuel`), `byDay`, `format`.
- **Response `200 OK` (JSON):**
```json
[
  {
    "store_code": "8730_IN-47872",
    "dept_number": 1,
    "dept_name": "Grocery",
    "sales_class": "merchandise",
    "units_sold": 412,
    "gross_sales": 1850.20,
    "promotions": 45.00,
    "net_sales": 1805.20,
    "fuel_gallons": 0.0,
    "lines": 398
  }
]
```

#### `GET /api/reports/fuel`
Fuel dispensed by grade and price level.
- **Query Params:** `store`, `from`, `to`, `byDay`, `byPriceLevel` (`true` | `false`), `format`.
- **Response `200 OK` (JSON):**
```json
[
  {
    "store_code": "8730_IN-47872",
    "fuel_grade": "Regular",
    "fuel_price_level": "CASH",
    "gallons": 1050.20,
    "amount": 3350.14,
    "fuel_sales": 84,
    "ppg_discount": 52.50,
    "avg_price": 3.190
  }
]
```

#### `GET /api/reports/payments`
Tender payments and refunds.
- **Query Params:** `store`, `from`, `to`, `byDay`, `format`.
- **Response `200 OK` (JSON):**
```json
[
  {
    "store_code": "8730_IN-47872",
    "payment_type": "CREDIT",
    "payments": 420,
    "sales_amount": 6250.40,
    "refunds": 2,
    "refunded_amount": 25.00,
    "net_amount": 6225.40
  }
]
```

#### `GET /api/reports/cash-movements`
Register drawer cash movements (safe drops, payouts, loans).
- **Query Params:** `store`, `from`, `to`, `kind` (`safe_drop` | `payout` | `safe_loan`), `format`.
- **Response `200 OK` (JSON):**
```json
[
  {
    "store_code": "8730_IN-47872",
    "business_date": "2026-09-25",
    "kind": "safe_drop",
    "occurred_at": "2026-09-25T14:00:00",
    "register": 1,
    "ticket_number": 421,
    "amount": 1000.00,
    "reference": "DROP #1",
    "paid_with": "CASH"
  }
]
```

#### `GET /api/reports/suspicious/events`
Audit trail of error corrects, void lines, whole transaction voids, and refunds.
- **Query Params:** `store`, `from`, `to`, `kind` (`no_sale` | `void_line` | `void` | `refund` | `refund_void`), `register`, `limit`, `format`.
- **Response `200 OK` (JSON):**
```json
[
  {
    "store_code": "8730_IN-47872",
    "business_date": "2026-09-25",
    "kind": "void_line",
    "occurred_at": "2026-09-25T11:20:15",
    "register": 2,
    "ticket_number": 884,
    "amount": 14.99,
    "item": "Bud Light 12pk Can",
    "duration_sec": null
  }
]
```

#### `GET /api/reports/suspicious/daily`
Daily aggregated counts and amounts per suspicious event kind.
- **Query Params:** `store`, `from`, `to`, `format`.

#### `GET /api/reports/lottery` & `/api/reports/lottery-payouts`
Lottery sales and winning ticket payouts reported separately without netting.
- **Query Params:** `store`, `from`, `to`, `format`.

#### `GET /api/reports/voids`
Detailed daily voids summary (void lines, units voided, void transactions, total voids).
- **Query Params:** `store`, `from`, `to`, `format`.

#### `GET /api/reports/payment-gaps`
Transactions whose collected payments differ from lines + tax.
- **Query Params:** `store`, `from`, `to`, `format`.

---

### 2.3 Receipt / Ticket Drill-Down Endpoints

#### `GET /api/tickets/{fileId}/{ticketSeq}` (Verifone)
#### `GET /api/events/{fileId}` (Gilbarco)
#### `GET /api/reports/receipt?store={store}&fileId={fileId}&seq={seq}` (Unified)
Retrieves the complete receipt detail behind any figure:
- Header (terminal, cashier, timestamp, totals)
- Line items (UPC, quantity, gross, promo, net, dept)
- Tender payments (CASH, CREDIT, etc.)
- Tax breakdown
- Related tickets (e.g. prepay fuel deposit vs completion)

---

## 3. Error Responses (RFC 9457 Problem Details)

All errors return JSON with Content-Type `application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Store not found.",
  "instance": "/api/reports/day-summary"
}
```

### Common Error Codes
- `401 Unauthorized`: Missing or expired `hor_access` cookie.
- `404 Not Found`: Store does not exist OR current user has no permission for this store (`StoreAccess.requireStore`).
- `400 Bad Request`: Invalid date format or parameter validation error.
- `500 Internal Server Error`: Database connection error or query execution failure.
