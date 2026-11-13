# 06 — Known facts and issues

The dashboard must **show** these, with the wording below, and never hide or "fix" a number to make a
check pass.

## Real data findings (the numbers are right; the store data really is like this)
| ID | Store | Finding | Where it shows |
|---|---|---|---|
| F1 | Tiki Hut (V) | On 2026-10-15, ticket 9019989 totals 32.63 but was paid CASH 31.00 with change −0.87 (net 30.13). Payments taken are 2.50 below sales that day. | R2 WARN −2.50 |
| F2 | Tiki Hut (V) | On 2026-10-15, one "FVP PREMIER ATF QT" (8.59) was scanned into department 9998 "MANUAL FUEL DEPT", a fuel-type department. It counts in day `fuel_sales` but is not pumped fuel. | I1 INFO −8.59 |
| F3 | Wolf (G) | 2026-10-09 has PJR files but no counted sales, so most day-summary fields are empty for that day. | DAY row with empty cells; R1/R2 skip the day; its daily-register checks compare 0 = 0 and pass |

## Vendor differences (same field name, different meaning)
| ID | Field | Verifone | Gilbarco |
|---|---|---|---|
| D-1 | `void_lines` (day, voids, daily-register `lineVoid`) | voided lines | transactions with at least one voided line |
| D-2 | suspicious `void_line` amount | negative line value | positive regular price × quantity; empty for a department ring |
| D-3 | `void_amount` (voids) and suspicious `void` amount | before tax | with tax |
| D-4 | `fuel_sales` (day) | every line of a fuel-type department | fuel lines only |
| D-5 | `promotions` | mix-and-match promotions | promotions + discounts (gross − net) |
| D-6 | `safe_loan` | safe loan tickets | register opened with starting cash |
| D-7 | `files` (date-range, day) | CPJ day-close files | PJR files, one per transaction |
| D-8 | extra kinds | `refund_void` | `pay_in` (cash), `void_line_in_prepay_deposit`, `void_line_in_voided_transaction` (suspicious; never in the day counts) |

Never add or compare these fields across the two vendors.

## Service limitations
| ID | Issue | Effect on the dashboard |
|---|---|---|
| K1 | **Fixed 2026-10-24.** Verifone times used to come out in the reporting server's time zone. The Verifone report views (verifone-ingestion-service V3) now give every time on the store's clock (`master.stores.timezone`), the same way Gilbarco PJR times are stored, so JSON times no longer depend on the server. Checked: the voided ticket 1026211 reads `2026-09-08T11:05:22` under JVM zones Asia/Kolkata, UTC and America/Los_Angeles. | Show times as returned. No check uses times. |
| K2 | **Fixed 2026-10-24.** A failed database query used to return `[]`. Both services now answer `503` with code `DATA_UNAVAILABLE` and log the cause; this includes the store lookup in auth_db, which used to look like `404 Store not found`. | `[]` is a real "no rows"; 503 shows the error banner (02 §6). |
| K3 | Gilbarco has no cash / check deposit split: Passport safe drops carry no tender lines. | `cashDeposit` / `checkDeposit` absent for Gilbarco (D7 PASS when absent). Show "not recorded by this POS". |
| K4 | Over/short, liquid management, fuel cost and profit, card fees and lottery commission are not in the POS data. The lottery scratch-off / online split exists only where the register has separate lottery departments (Wolf: 57 LOTTO ONLINE, and dept 5 = scratch-off, which has no name in the POS files because scratch tickets are only scanned, so it counts as merchandise until a platform admin names it). Tiki Hut has one Lotto department. | No such fields, screens or checks; the Lottery tab shows one section per lottery department. |
| K5 | `items-sold` defaults to 500 rows and `suspicious/events` to 5000; both are capped at 20000. | Always send `limit=20000` and WARN when exactly 20000 rows come back. |
| K6 | Without `store`, a report combines all stores of that vendor. | Always send `store`. |
| K7 | A POS file loaded again can get new ids (Verifone REPLACE re-creates the rows). | Drill-down may answer 404; reload the list. |
| K8 | Verifone has no payment-gaps endpoint. | Screen S12 and check R3 are Gilbarco-only; Verifone uses R2 per day. |
| K9 | auth-service accepts login/refresh only from allowed origins (5180–5182 today). | Add `http://localhost:5183` once (see 02 §3) or log in through auth-console. |
