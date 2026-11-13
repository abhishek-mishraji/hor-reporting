# 07 — Prompt for the AI that builds the dashboard

> **Superseded (2026-10-24):** this prompt built the original verification tool. The dashboard is now client-facing; see [04-screens.md](04-screens.md) for the current screens.

Copy everything inside the block below.

```text
Build "client-dashboard": a plain web app to verify that every number from two reporting services is
correct. No fancy UI. Correctness and completeness are the only goals.

LOCATION
C:\Users\abhia\OneDrive\HOR-Software\hor-stores\reporting-service\client-dashboard
The specification is in client-dashboard\docs. Read ALL of it before writing code, in this order:
README.md, 01-overview.md, 02-architecture-and-auth.md, 03-api-reference.md, 04-screens.md,
05-verification-checks.md, 06-known-facts-and-issues.md. The docs are the source of truth. If something here
seems to conflict with them, follow the docs and tell me about the conflict.

DO NOT
- change anything outside client-dashboard (no backend, auth-service, database or secrets changes);
- compute any business figure yourself: the app only displays API values and runs the comparisons in
  docs/05;
- invent fields, rename API fields, hide columns, round displayed numbers, or show missing/null as 0;
- store tokens or anything about the session in localStorage/sessionStorage (cookies are httpOnly);
- send an Authorization header (the services ignore it; they read the hor_access cookie);
- add a UI kit, chart library, state library or CSS framework.

STACK
- Vite + React + TypeScript; react-router-dom for screens. Nothing else at runtime.
- Plain CSS in one file: readable tables (sticky header, right-aligned numbers, monospace digits), a
  light/dark variant via prefers-color-scheme, usable at 1280px and at phone width (tables scroll
  horizontally inside their own box).
- Dev server: http://localhost:5183, strictPort true. Open it via localhost, not 127.0.0.1.
- vite.config.ts proxy (docs/02 section 2):
    /api/auth      -> http://127.0.0.1:8091  (no rewrite)
    /svc/verifone  -> http://127.0.0.1:8094  (strip the /svc/verifone prefix)
    /svc/gilbarco  -> http://127.0.0.1:8095  (strip the /svc/gilbarco prefix)
  Do not rewrite or fake the Origin header.

STRUCTURE
src/
  main.tsx, App.tsx              router, session gate, layout (store picker, from/to, nav, user, logout)
  api/http.ts                    the ONLY fetch wrapper: credentials 'same-origin', header X-HOR-Request: 1,
                                 problem-JSON errors -> ApiError{status, code, detail}, the 401 refresh flow
                                 with navigator.locks exactly as docs/02 section 3
  api/auth.ts                    login, me, refresh, logout
  api/reports.ts                 one typed function per endpoint in docs/03, taking (vendor, params) and
                                 building /svc/<vendor>/api/... URLs; csvUrl(...) for download links
  session/                       Me + the merged store list from both date-range calls (docs/02 section 4)
  num.ts                         toCents, toMilli, sums, half-up rounding to 2 decimals (docs/05 section 1)
  checks/definitions.ts          every check of docs/05 (C01..C30, V02, G01, G02, D0..D7, M1..M3, R1..R4,
                                 I1) as data: id, vendor scope, level (FAIL/WARN/INFO), left(), right(),
                                 explanation
  checks/runChecks.ts            makes the calls of docs/05 section 2 once, evaluates every check
  ui/DataTable.tsx               generic table: columns = keys in response order, totals row per docs/04
                                 rule 3, empty-state per rule 7
  ui/RawJson.tsx, ui/ErrorBanner.tsx, ui/RequestInfo.tsx (URL, HTTP status, row count, CSV link)
  pages/  Login, DaySummary, Items, Departments, Monthly, Fuel, Payments, Cash, Suspicious, Lottery,
          DailyRegister, PaymentGaps (Gilbarco only), Checks, and a drill-down modal (docs/04 S1..S14)

BEHAVIOUR
- The app needs a login: show Login when GET /api/auth/me returns 401. After login, call both
  /svc/verifone/api/reports/date-range and /svc/gilbarco/api/reports/date-range in parallel, merge the
  stores, and route each store to its vendor's service by pos_vendor. If one service fails, show its error
  and keep the other.
- Defaults: the first store in the list; from = to = its last_day (latest day only; the pickers allow first_day..last_day). Null dates mean "No POS data
  loaded".
- Every report request sends store, from and to. items-sold and suspicious/events always send limit=20000.
- Vendor-specific controls and screens follow docs/04 (pay_in G only, refund_void V only, Payment gaps G
  only). Get the vendor from pos_vendor only.
- Times are already on the store's local clock for both vendors: show them exactly as returned, with no
  time-zone conversion in the browser (docs/03 conventions).
- A 503 with code DATA_UNAVAILABLE shows an error banner naming the service; an empty list is a real
  "No rows returned" (docs/02 section 6).
- Checks screen: one table with columns id | description | left | right | difference | result |
  explanation. Colour results PASS green, FAIL red, WARN amber, INFO blue, NO DATA grey. Add a filter
  "show only non-PASS". A FAIL never stops the other checks.

ACCEPTANCE (do all of this and report the results)
1. npm install, npm run build and npm run lint (oxlint) pass with no errors.
2. Before running: auth-service must allow the origin http://localhost:5183 (docs/02 section 3).
   Do not edit the secrets file yourself; tell me the exact line to add, and wait for me if login fails
   with CSRF_REJECTED.
3. With auth-service (8091) and both reporting services (8094, 8095) running, log in. The store picker must
   show Tiki Hut 8730_IN-47872 (VERIFONE) and Wolf 800_NY-13208 (GILBARCO).
4. Checks screen, full loaded range of each store: the results must match docs/05 section 7 exactly.
   Tiki Hut: everything PASS except R2 WARN -2.50 and I1 INFO -8.59. Wolf: everything PASS.
   If any other result differs, find out why and report it. Never change a check to make it pass.
5. Every screen loads for both stores without console errors, and its totals row matches the matching
   day-summary figure where docs/05 says they must agree.
6. Unit tests (vitest) for num.ts (cents/thousandths sums, half-up rounding, null handling), for the
   check evaluation with small fixture responses (including one deliberate FAIL, one WARN, NO DATA and
   the truncated 20000-row case), and for http.ts showing a 503 DATA_UNAVAILABLE as an error, not as rows.
7. README.md in client-dashboard: how to run, the auth-service origin step, the ports, and the docs index.

FINAL REPORT
List the files created, the build/lint/test output, the Checks results for both stores (as a table), and
anything in the docs you found unclear or contradictory.
```
