# 02 — Architecture, authentication and routing

## 1. Processes and ports (development)

| Process | Address | Notes |
|---|---|---|
| auth-service | `http://127.0.0.1:8091` | login, refresh, logout, `/me`, JWKS |
| verifone-reporting-service | `http://127.0.0.1:8094` | binds 127.0.0.1 only |
| gilbarco-reporting-service | `http://127.0.0.1:8095` | binds 127.0.0.1 only |
| **client-dashboard (Vite dev server)** | **`http://localhost:5183`** | `strictPort: true` |

Ports already taken and therefore not usable for the dashboard: 5173, 5174 (CPJ/PJR prototypes),
5180–5182 (auth-console and other HOR UIs), 8080, 8081 (prototype backends), 8091–8095.

Open the dashboard as **`http://localhost:5183`**, not `127.0.0.1`. The login cookies are host-only cookies
for `localhost`, and the allowed-origin list uses `localhost`.

## 2. Same-origin dev proxy (required)
The reporting services have **no CORS** and read the login token **only from a cookie**, so the browser must
call everything on the dashboard's own origin. The Vite dev server proxies:

| Browser path | Forwarded to | Path rewrite |
|---|---|---|
| `/api/auth/*` | `http://127.0.0.1:8091` | none (`/api/auth/login` stays `/api/auth/login`) |
| `/svc/verifone/*` | `http://127.0.0.1:8094` | remove the `/svc/verifone` prefix |
| `/svc/gilbarco/*` | `http://127.0.0.1:8095` | remove the `/svc/gilbarco` prefix |

Example: `GET /svc/gilbarco/api/reports/day-summary?store=800_NY-13208` reaches
`http://127.0.0.1:8095/api/reports/day-summary?store=800_NY-13208`.

Two prefixes are needed because both services use identical paths.

## 3. Authentication (cookie session from auth-service)
- auth-service sets two **httpOnly** cookies: `hor_access` (JWT, Path `/`, 15 minutes) and `hor_refresh`
  (Path `/api/auth`, 12 hours, sliding). JavaScript can never read them and must never try. Nothing is stored
  in `localStorage`.
- The reporting services read **only** the `hor_access` cookie. An `Authorization: Bearer` header is
  ignored.
- Every `fetch` uses `credentials: 'same-origin'`.
- Every `POST` (login, refresh, logout) sends the header `X-HOR-Request: 1`. Without it the call fails with
  `403 CSRF_REJECTED`. `GET` calls do not need it (sending it on every request is harmless and allowed).

### Auth calls
| Call | Request | Success | Errors (problem JSON `code`) |
|---|---|---|---|
| Login | `POST /api/auth/login`, JSON `{"email","password"}` | `200` + `Me` JSON + both cookies | `401 BAD_CREDENTIALS`, `403 ACCOUNT_DISABLED`, `423 ACCOUNT_LOCKED` (has `lockedUntil`) |
| Who am I | `GET /api/auth/me` | `200 Me` | `401` when not logged in |
| Refresh | `POST /api/auth/refresh`, no body | `204` + new cookies | `401 SESSION_ENDED` |
| Logout | `POST /api/auth/logout`, no body | `204`, cookies cleared | — |

`Me` = `{accountType, id, email, fullName, role, allStores, stores:[{storeId, storeCode, storeName, storeRole}],
passwordChangedAt, lastLoginAt}`.

### One-time setup: allow the dashboard origin in auth-service (required)
auth-service checks the `Origin` header of every `POST`. Its allowed list today is
`http://localhost:5180,http://localhost:5181,http://localhost:5182`, so login and refresh from
`http://localhost:5183` would be rejected with `403 CSRF_REJECTED`. The Vite proxy does not change the
`Origin` header, and it must not be made to fake one.

Add the dashboard origin in the auth-service secrets file, which overrides `application.properties`
(`%USERPROFILE%\.hor-stores\secrets.properties`):

```
hor.auth.allowed-origins=http://localhost:5180,http://localhost:5181,http://localhost:5182,http://localhost:5183
```

Then restart auth-service. The reporting services need no change: their origin check applies only to
`POST/PUT/PATCH/DELETE`, and the dashboard only sends `GET` to them.

Fallback without that change: log in on auth-console (`http://localhost:5180/login`). The cookies are
shared across ports on `localhost`, so the dashboard's `GET` calls work until the 15-minute access token
expires. After that, refresh from the dashboard fails, and you must log in on auth-console again.

### 401 handling (one shared fetch wrapper)
For any `401` whose problem `code` is `TOKEN_EXPIRED` or `UNAUTHENTICATED`:
1. take the browser lock `navigator.locks.request('hor-refresh', ...)` so tabs never refresh at the same time;
2. inside the lock, retry the original request once (another tab may already have refreshed);
3. if it is still 401, call `POST /api/auth/refresh`; on `204`, retry the original request once;
4. if refresh returns 401, show the login screen.

A `401` with any other code, and every `403`, are shown as errors, not retried.

## 4. Choosing the service for a store
1. After login, call **both** `GET /svc/verifone/api/reports/date-range` and
   `GET /svc/gilbarco/api/reports/date-range`, in parallel.
2. Each returns only **its own vendor's** stores that the user may see:
   `[{store_id, store_code, store_name, pos_vendor, first_day, last_day, files}]`.
3. Merge the two lists into one store picker. Show `store_name`, `store_code` and `pos_vendor`.
4. For the selected store, use the prefix `/svc/verifone` when `pos_vendor` is `VERIFONE`, and
   `/svc/gilbarco` when it is `GILBARCO`. Never send a store to the other vendor's service: it answers
   `404 "Store not found."`
5. If one service is down, show its error banner and keep working with the other one's stores.
6. Default date range = the store's latest loaded day only: From = To = `last_day` (on login, on *Refresh*
   and when another store is picked). The pickers still allow any day from `first_day` to `last_day`.
   If they are `null`, the store has no loaded
   POS data: show "No POS data loaded for this store" and disable the report screens.

`files` means different things: on Verifone it counts CPJ files (one per day close), on Gilbarco it counts
PJR files (one per transaction). Show it, but don't compare it across vendors.

## 5. Common request rules
- Always send `store=<store_code>`. Without `store`, the services combine **all** accessible stores of that
  vendor, which the dashboard must not rely on.
- `from` and `to` are ISO dates (`YYYY-MM-DD`), inclusive, on `business_date`. Both are optional on the
  server; the dashboard always sends both.
- `format=csv` returns the same rows as CSV (`Content-Disposition: attachment`). Use it for download links
  only. Checks always use JSON.
- Booleans in query strings are `true` / `false`.

## 6. Errors
| Status | Meaning | Dashboard behaviour |
|---|---|---|
| 400 | bad parameter (e.g. a date that isn't a date) | show the message |
| 401 | not logged in / expired | refresh flow (§3) |
| 403 | the account's role may not read reports (code `FORBIDDEN`), or a `POST` without `X-HOR-Request` / with a foreign `Origin` (code `CSRF_REJECTED`) | show the message |
| 404 | `"Store not found."`: unknown store code, a store not assigned to the user, or a store of the other vendor (the three cases are deliberately the same answer) | show "Store not found or not accessible" |
| 503 | code `DATA_UNAVAILABLE`: the service could not read its database (`auth_db`, `verifone_db` or `gilbarco_db`) | show "Report data could not be read (service name)". Not retried automatically; the user presses Reload |
| other 5xx / network | service down or unexpected error (code `INTERNAL_ERROR`) | show an error banner naming the service |

An empty list (`[]`) really means "no rows for this store and range": database failures always answer 503,
never an empty list. Show `[]` as "No rows returned", never as "zero sales".
