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
| Daily report | `departments` (all classes), `fuel`, `payments`, `cash-movements`, `day-summary` (tax), `daily-lottery`, both with `from` = `to` = the chosen day | all blocks below sit under a **Money In** section heading. one day only (its **Day** picker sets both *From* and *To*; a range is cut to its last day). **Merchandise Sales**: one row per merchandise department in department-number order, name and net sales in dollars; unnamed departments show as "Department #N"; last row **Total Grocery** = sum of the rows (= that day's merchandise net). Lottery and fuel are not included. **Fuel Sold (Gallons)** and **Fuel Sold (Amount)**: one row per grade the POS reported that day ("<Grade> Volume" / "<Grade> Amt Sold", all-caps names shown as "Regular"), every grade shown even at 0, amount = gross `amount` before fuel discounts; totals Total Gas Volume / Total Gas Amt Sold. Verifone 8730 has Regular + Diesel, Gilbarco 800 has Regular, Plus, Super. **Lottery Tickets Sold** + **Lottery/Lotto Reading** (from the same departments call, lottery classes): when every lottery sales department is named scratch-off/instant or online (Gilbarco 800: 5 + 57) the rows are Scratch-off sales and Net online sales, otherwise one Lottery sales row (Verifone 8730: one Lotto dept). Scratch-off cashes = all winnings paid (payout departments, positive; the POS cannot split them), Net online cashes 0.00. Settlement, Adjustment, Online credit, Scratch-off credit, Commission are not in the POS and show 0.00 (user choice for this page). Balance = online sales (or combined sales when not split) − cashes. Ticket counts = |units_sold|. **Money Out** section: Safe Deposits (Total deposits = safe drops; Credit card batch = card payment types: Credit, Debit, Crind CREDIT/DEBIT, Mobile), Credit Card 2 (two "Sales by generic card" rows, 0), Bank Deposits (EBT/Foodstamp = EBT payment types), Cash Purchases (Cash Purchases = store paid-outs; Other Income = pay-ins (G only); Cust account sales = HOUSE payments; Cash Expenses, General Account paid 0), Other Money Received (0), ATM Reading (0; not in POS). Gilbarco 800 on 2026-10-24 gives 4457.00 / 5838.74 / 33.94, matching the paper report. Rows the POS lacks show 0 (user choice). Money In also has a **Sales Tax** block (day `tax`). **Lottery editing** (`daily-lottery`): admin and staff (`can_edit`) get an **Edit** button on "Lottery Tickets Sold" and "Lottery/Lotto Reading" (any day); every row and ticket count can be entered, one Save per table, empty input = POS figure ("Reset to POS"). An entered value shows "edited" and a blue badge with the POS figure; under each table "Last edited by <name>, <time>". A 409 reloads the stored figures and asks to edit again. If the entered figures cannot be loaded, POS figures are shown with a warning and no Edit button. Balance = online sales (combined sales without split) − online cashes − scratch-off cashes + settlement − adjustment − online credit − scratch-off credit − commission. **Sticky totals bar** at the bottom: Total Money In = Total Grocery + Total Gas Amt Sold + lottery sales + settlement + commission + sales tax; Total Money Out = deposits + card batch + EBT + cash purchases + cust account sales + online cashes + scratch-off cashes + adjustment + online credit + scratch-off credit − other income ("+ $" rows subtract). **Over/Short** = Total Money Out − Total Money In (user request 2026-11-17), red when negative, green when positive; Money In is green, Money Out red. Gilbarco 800, 2026-10-24: In 11,486.79, Out 11,263.68, Over/Short −223.11. No inputs |
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
