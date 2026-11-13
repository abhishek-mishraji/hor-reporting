# HOR Stores — Client Reporting Dashboard

A modern, high-performance, responsive React verification portal designed to inspect, compare, and verify every number returned by the two independent Hands Off Retail reporting services:
- **Verifone Reporting Service** (Verifone Commander CPJ day-close files, port `8094`)
- **Gilbarco Reporting Service** (Gilbarco Passport PJR transaction files, port `8095`)

This dashboard serves as the central verification workbench, executing the exact mathematical cross-checks specified in `docs/05-verification-checks.md` across both POS vendors to guarantee accounting integrity before the client customer portal is released.

---

## 1. System Architecture & Ports

| Service | Port / Address | Description |
|---|---|---|
| **client-dashboard** | **`http://localhost:5183`** | Vite React dev server (`strictPort: true`) |
| **auth-service** | `http://127.0.0.1:8091` | Authentication, JWT sessions, `/api/auth/me`, `/api/auth/refresh` |
| **verifone-reporting-service** | `http://127.0.0.1:8094` | Verifone Commander report engine (`verifone_db`) |
| **gilbarco-reporting-service** | `http://127.0.0.1:8095` | Gilbarco Passport report engine (`gilbarco_db`) |
| **auth-console** | `http://localhost:5180` | HOR Auth management console (fallback login) |

> **Important**: Always access the dashboard via **`http://localhost:5183`** (not `127.0.0.1`). Cookies (`hor_access`, `hor_refresh`) are host-only cookies set for `localhost`.

---

## 2. One-Time Setup: Auth-Service Origin Allowance

The `auth-service` validates the HTTP `Origin` header on every state-changing `POST` request (login, refresh, logout).
To allow direct login from the dashboard at `http://localhost:5183`:

1. Open the auth-service secrets file:
   ```text
   %USERPROFILE%\.hor-stores\secrets.properties
   ```
2. Add or update the allowed origins line:
   ```properties
   hor.auth.allowed-origins=http://localhost:5180,http://localhost:5181,http://localhost:5182,http://localhost:5183
   ```
3. Restart `auth-service`.

### Fallback Login (Without Secrets Edit)
If `secrets.properties` cannot be edited immediately:
1. Open the Auth Console at **`http://localhost:5180/login`**.
2. Sign in with platform administrator credentials.
3. Because cookies are scoped to `localhost`, open **`http://localhost:5183/`**. Your session will automatically authenticate and load stores.

---

## 3. Running Locally & Scripts

In this folder (`reporting-service/client-dashboard`):

```bash
# Install dependencies
npm install

# Start Vite dev server on http://localhost:5183 (strict port)
npm run dev

# Run Oxlint (deny warnings)
npm run lint

# Run Vitest unit test suite (arithmetic & checks evaluation)
npm test

# Production build
npm run build
```

---

## 4. Documentation Index

The technical specifications and architectural contracts are documented in the [`docs/`](./docs) directory:

- [**01 — Overview**](./docs/01-overview.md): Scope, user personas, purpose, and POS vendor boundaries.
- [**02 — Architecture, Auth & Routing**](./docs/02-architecture-and-auth.md): Vite reverse proxy mappings, session cookies, `navigator.locks` 401 refresh mechanism.
- [**03 — API Reference**](./docs/03-api-reference.md): Every endpoint specification, query parameters, signs, units, and vendor differences.
- [**04 — Screens Specification**](./docs/04-screens.md): Layout frame, table formatting rules, and drill-down contracts (S1–S14).
- [**05 — Verification Checks**](./docs/05-verification-checks.md): Mathematical cross-check definitions (C01–C30, V02, G01, G02, D0–D7, M1–M3, R1–R4, I1), expected results, and tolerances.
- [**06 — Known Facts & Issues**](./docs/06-known-facts-and-issues.md): Verified real data findings, POS limitations, and time zone behavior.
- [**07 — UI Build Prompt**](./docs/07-ui-build-prompt.md): Prompt specification, acceptance requirements, and verification criteria.
- [**08 — UI Design System**](./docs/08-ui-design-system.md): Production design system, typography tokens, surface ladders, KPI cards, and UI guidelines.

---

## 5. Verification Results Snapshot

Evaluated against the live databases on the full loaded data ranges:
- **Tiki Hut `8730_IN-47872` (Verifone Commander)**: 2026-09-08 .. 2026-10-15 (3 business days)
- **Wolf `800_NY-13208` (Gilbarco Passport)**: 2026-10-09 .. 2026-10-15 (2 business days)

| Store | Total Checks | Results Breakdown | Notes |
|---|---|---|---|
| **Tiki Hut** | 35 | **32 PASS**, **1 WARN**, **1 INFO**, **1 FAIL** | `R2 WARN -2.50` (ticket 9019989 tender underpayment); `I1 INFO -8.59` (ATF fluid in manual fuel dept); `D0-D7 FAIL` due to backend 503 on `daily-register`. All 32 other checks tie 100%. |
| **Wolf** | 35 | **34 PASS**, **1 FAIL** | `R3 PASS` (0 gaps, 0 rows); `R2 PASS` (12108.02 == 12108.02); `D0-D7 FAIL` due to backend 503 on `daily-register`. All 34 other checks tie 100%. |

> **Backend Service Note on `daily-register`**: The `daily-register` endpoint returns `503 DATA_UNAVAILABLE` on both reporting services because `JdbcVerifoneCpjReportRepository` (line 319) and `JdbcGilbarcoPjrReportRepository` (line 325) include an ambiguous `business_date` column in the outer `WHERE` clause join. Once resolved in the reporting services, `D0-D7` automatically turns `PASS`.
