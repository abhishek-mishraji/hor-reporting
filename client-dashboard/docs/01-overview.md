# 01 — Overview

## Purpose
Two independent reporting services serve POS numbers:

| Service | Folder | Port | Database | POS |
|---|---|---|---|---|
| verifone-reporting-service | `reporting-service/verifone-reporting-service` | 8094 | `verifone_db` | Verifone Commander (CPJ files) |
| gilbarco-reporting-service | `reporting-service/gilbarco-reporting-service` | 8095 | `gilbarco_db` | Gilbarco Passport (PJR files) |

Both expose the **same URL paths** (`/api/reports/...`). A store belongs to exactly one POS vendor
(`pos_vendor` in auth_db `core.stores`), and only that vendor's service answers for it.

`client-dashboard` is **one** client-facing web app for both. For the selected store it calls the right
service and shows the business figures in plain tables. It hides everything technical (request URLs, raw
JSON, ids, vendor names). The verification checks ([05](05-verification-checks.md)) moved to the admin fetch
console; their code still sits in `src/checks/` until it is ported there.

## In scope
1. Log in with an existing HOR account (auth-service, port 8091).
2. Pick a store (stores of both vendors in one list) and a date range.
3. Screens: Day summary, Items (grouped by department), Departments, Monthly, Fuel, Cash, Suspicious,
   Lottery — see [04-screens.md](04-screens.md).
4. Per-user column choices saved in the browser.
5. Transaction details from Cash and Suspicious rows.
6. CSV download (the services produce CSV with `format=csv`).
7. Not here: Checks, Payments, Daily register, Payment gaps (admin console).

## Out of scope
- Anything the POS databases cannot give: over/short, liquid management, fuel cost or profit, credit card
  fees, lottery online/scratch split, commission. The services do not return these; the dashboard must not
  invent or enter them.
- Writing data. The dashboard only reads (`GET`), except the three auth calls (login, refresh, logout).
- Charts, theming, mobile polish, i18n.
- Calculating any business figure itself. The dashboard only **displays** service values and **compares**
  them. If a check needs a number no endpoint returns, the check is not included.

## Users
Any account with role `PLATFORM_ADMIN`, `HOR_STAFF` or `CLIENT_USER`. A platform admin sees every store;
a store user sees only the stores assigned to them (the services enforce this; the dashboard just shows
what the store list returns).
