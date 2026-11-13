# 04 — Screens

The dashboard is for **store clients**. It shows business numbers only: no request URLs, HTTP statuses,
raw JSON, file counts, ids or vendor names. Verification checks, payments, the daily register and payment
gaps are not here; they belong to the admin fetch console.

```
HOR  Store Reports   [ Store name ▾ ] [ From ] [ To ] [ ⟳ Refresh ]         user · theme · Log out
------------------------------------------------------------------------------------------------------
Day summary | Items | Departments | Monthly | Fuel | Cash | Suspicious | Lottery
------------------------------------------------------------------------------------------------------
[ KPI 1: Merchandise Net ] [ KPI 2: Fuel Volume ] [ KPI 3: Lottery Net ] [ KPI 4: Customers ]
------------------------------------------------------------------------------------------------------
<filter toolbar: search, dropdowns, switches>
<Title / context note>                   [Expand all] [Collapse all] [Columns (n/m) ▾] [Download CSV]
<table with sticky headers, monospaced digits, subtotals per section, and grand total row>
```

> **Design Specifications**: Full design tokens, surface ladders, typography scale, and component guidelines are specified in [**08 — UI Design System**](08-ui-design-system.md).


## Rules for every table
1. **Columns come from [`src/reportColumns.js`](../src/reportColumns.js).** A field the API returns that is
   not listed there is never shown (ids, `store_code`, `file_id`, `files`, tie checks, duplicate fields).
2. Each listed column is either **on by default** (`show: true`) or **optional** (`show: false`). The
   *Columns* menu lists only columns the server actually returned for this store's POS, so Verifone and
   Gilbarco stores can offer slightly different lists.
3. The user's choices are saved **in this browser** (`localStorage`, key `hor.cols.v<n>.<userId>.<report>`),
   storing only the differences from the defaults. *Reset to default* clears them. If storage is blocked the
   defaults are used. `<n>` is 1 unless the report's defaults changed (`COLUMN_DEFAULT_CHANGES` in
   `reportColumns.js`; Day summary is v2): a choice saved under the old version is carried over once, with
   the old defaults kept for that user, so their table looks the same. Users with nothing saved get the new
   defaults.
4. Values are formatted by column type ([`src/format.js`](../src/format.js)): money `$1,438.52`, gallons with
   3 decimals, dates `Oct 24, 2026`, times `1:45 PM` (store-local, never converted). `null` shows blank,
   never `0`.
5. Money, gallon and count columns add up in subtotal and total rows (integer cents / thousandths). Prices,
   durations and "days sold" never add up.
6. **Lottery and fuel are never part of merchandise.** Departments and Monthly show them in their own
   sections (Merchandise · Lottery sales · Lottery payouts · Fuel) with a subtotal each and no grand total
   mixing them.
7. Errors show a plain message ("This report could not be loaded…"), never codes or server text.

## Screens
| Screen | Calls (all with `store`, `from`, `to` unless noted) | What the client sees |
|---|---|---|
| Login | `POST /api/auth/login` | email + password (no pre-filled values); plain messages for wrong password, locked, disabled |
| Day summary | `day-summary` | one row per day; default columns: date, customers, merchandise sales, lottery sales/payouts, fuel sales/gallons, tax, total with tax, no sales, line voids, transaction voids, total void amount, refunds, refund amount. Optional: line void amount, transaction void amount, refunded money and refund voids (Verifone only; never offered on Gilbarco). The note says transaction void amount is before tax (Verifone) / with tax (Gilbarco), refund amount = value of refunded items, refunded money = cash handed back (Verifone) |
| Items | `items-sold` (`limit=20000`); department list from `departments?salesClass=merchandise` | **grouped by department** (collapsible, subtotal per department) — toggle off for a flat list; filters: department (by name), search (UPC/description, debounced), item type, show each day. Merchandise only |
| Departments | `departments` | sections per sales class; option: show each day |
| Monthly | `departments/monthly?store&month&year` | month + year pickers (default: month of *To*); sections per `salesClass`; note shows `totals.netSalesTotal` = merchandise net sales |
| Fuel | `fuel` | options: show each day, split by price level |
| Cash | `cash-movements` | filter by type; click a row → transaction |
| Suspicious | `suspicious/daily`, `voids`, `suspicious/events` (`limit=20000`, called twice: once for voided items with no filters, once for every event) | four sections: **by-day summary**; **voids by day** (click a day → voided items of that day, with a clear-date chip); **voided items** (void kinds only, one row per voided line on Verifone / per transaction with voided items on Gilbarco; void type filter All / Line voids / Transaction voids; summary line "N line voids · $X \| M transaction voids · $Y"; amounts positive; CSV built in the browser; click → transaction; see 03 *Voided items*); **every event** (type + register filters; click → transaction) |
| Lottery | `departments?byDay=true` (lottery classes only), `lottery` | **Lottery by game**: one collapsible section per lottery department with a subtotal, sales departments first, payouts negative (Wolf: 5 LOTTO SCRATCH OFF, 57 LOTTO ONLINE, 6 LOTTO PAID OUT; Tiki Hut has one Lotto + one Lotto Payout department, so no split). **Lottery by day**: all games together, sales and payouts both positive |
| Transaction | V: `tickets/{file_id}/{ticket_seq}?store`, G: `events/{file_id}?store` | modal titled "Transaction details" |

The selected store's `pos_vendor` decides vendor-only filter values (`pay_in` only for Gilbarco, `refund_void`
only for Verifone); the vendor name itself is not shown.

*Refresh* reloads the store list and remounts the current screen so it fetches again.
