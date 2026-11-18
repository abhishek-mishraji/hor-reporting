# reporting-service: Architecture & System Overview

**Service Port:** `8094`  
**Protocol:** HTTPS / JSON & UTF-8 CSV  
**Authentication:** RS256 JWT cookie (`hor_access`) validated via JWKS from `auth-service :8091`  
**Target Clients:** `client-portal` (React) & Platform Admin reporting

---

## 1. System Placement & Boundaries

The `reporting-service` sits exclusively on the **READ SIDE** of the Hands Off Retail platform:

```
[ Browsers: Platform Admin / Store Client / HOR Staff ]
                         │
                         ▼
        [ nginx :443 Reverse Proxy (Oracle Cloud VM) ]
                         │
        ┌────────────────┼────────────────────────┐
        │ /api/auth/     │ /api/ingestion/**      │ /api/reporting/
        ▼                ▼                        ▼
[ auth-service :8091 ]  [ verifone-ingestion :8092 ]  [ reporting-service :8094 ]
[ auth_db ]             [ gilbarco-ingestion :8093 ]            │ (read-only)
                        [ verifone_db / gilbarco_db ] ──────────┘
```

- **Write Side (Ingestion):** POS zips are fetched from AWS S3 (`hor-stores-data`) and parsed into `verifone_db` and `gilbarco_db`.
- **Read Side (Reporting):** `reporting-service` executes analytical read queries against `verifone_db` and `gilbarco_db` and provides reports for assigned stores.

---

## 2. Core Architecture Components

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#f6f8fa", "primaryTextColor": "#1f2328", "primaryBorderColor": "#8c959f", "secondaryColor": "#f6f8fa", "tertiaryColor": "#ffffff", "lineColor": "#57606a", "textColor": "#1f2328", "clusterBkg": "#fafbfc", "clusterBorder": "#d0d7de", "titleColor": "#1f2328", "edgeLabelBackground": "#ffffff", "nodeTextColor": "#1f2328"}}}%%
flowchart TB
    subgraph CLIENT["Client Tier"]
        CP["client-portal (React)<br/>Day Dashboard, Items, Departments,<br/>Fuel, Payments, Cash, Suspicious, Receipts"]
    end

    subgraph REPORTING_SERVICE["reporting-service :8094 (Spring Boot 4.1 / Java 21)"]
        direction TB

        subgraph AUTH_LAYER["Security & Context Layer"]
            AUTH_FILTER["AuthCookieTokenResolver<br/>Reads 'hor_access' cookie"]
            JWKS_VAL["NimbusJwtDecoder<br/>Validates RS256 with JWKS from :8091"]
            PRINCIPAL["HorPrincipal<br/>role, allStores, storeIds"]
        end

        subgraph GUARD_LAYER["Store Access Guard Layer"]
            STORE_RES["StoreDirectoryService<br/>Resolves store_id / store_code"]
            STORE_GUARD["StoreAccess.requireStore()<br/>Enforces store ID assignment<br/>Throws 404 DomainException if unauthorized"]
        end

        subgraph ROUTING_LAYER["Dual-Vendor Routing Layer"]
            ROUTER["ReportRouterService<br/>Checks store.pos_vendor"]
            V_SVC["VerifoneReportService<br/>Queries report.* views in verifone_db"]
            G_SVC["GilbarcoReportService<br/>Queries rpt_* views in gilbarco_db"]
        end

        subgraph DATA_LAYER["Multi-DataSource Hikari Pools"]
            V_POOL[("verifoneDataSource<br/>(verifone_db - read only)")]
            G_POOL[("gilbarcoDataSource<br/>(gilbarco_db - read only)")]
            A_POOL[("authDataSource<br/>(auth_db - core.stores)")]
        end
    end

    subgraph POSTGRES["PostgreSQL 16/17 Cluster"]
        V_DB[("verifone_db")]
        G_DB[("gilbarco_db")]
        A_DB[("auth_db")]
    end

    CP -->|"HTTPS Request + hor_access Cookie"| AUTH_FILTER
    AUTH_FILTER --> JWKS_VAL --> PRINCIPAL
    PRINCIPAL --> STORE_GUARD
    STORE_RES --> STORE_GUARD
    STORE_RES -.-> A_POOL
    A_POOL --> A_DB

    STORE_GUARD --> ROUTER
    ROUTER -->|"pos_vendor = VERIFONE"| V_SVC
    ROUTER -->|"pos_vendor = GILBARCO"| G_SVC

    V_SVC --> V_POOL --> V_DB
    G_SVC --> G_POOL --> G_DB

    V_SVC -->|"Unified DTO / CSV"| CP
    G_SVC -->|"Unified DTO / CSV"| CP
```

---

## 3. Multi-Tenancy & Store Access Isolation Rules

Security is built on three strict rules:
1. **Zero Trust Store Isolation:** A user only ever sees data from stores they are assigned in `auth_db.core.store_user_stores`.
2. **Opaque 404 on Unauthorized Access:** If a user requests a store they are not assigned, the service returns `404 Not Found` (`StoreAccess.requireStore`) rather than `403 Forbidden` so that existence of other clients' stores is never leaked.
3. **Platform Admin Super-Access:** When `principal.allStores()` is `true` (`PLATFORM_ADMIN`), the user has access across all stores in the platform.

---

## 4. Key Endpoints Summary

| Endpoint | Method | What it Returns |
|---|---|---|
| `/api/reports/date-range` | GET | List of accessible stores with their first and last business days and file counts |
| `/api/reports/day-summary` | GET | Daily executive summary: customers, item sales, fuel, lottery, tax, payments, cash movements, voids, counter ties |
| `/api/reports/items-sold` | GET | Scanned items and department rings: UPC, description, dept, units, gross, promotions, net |
| `/api/reports/departments` | GET | Sales by department and salesClass (`merchandise`, `lottery_sale`, `lottery_payout`, `fuel`) |
| `/api/reports/fuel` | GET | Fuel by grade: volume, dollar amount, sales count, loyalty discounts, average $/gallon |
| `/api/reports/payments` | GET | Tender reconciliation: CASH, CREDIT, DEBIT, EBT with sales vs refunds |
| `/api/reports/cash-movements`| GET | Register cash events: safe drops, paid-outs, safe loans with timestamps and register ID |
| `/api/reports/suspicious/events` | GET | Loss prevention audit log: no-sales, void lines, whole transaction voids, refunds |
| `/api/reports/suspicious/daily` | GET | Daily aggregate counts and amounts per suspicious event kind |
| `/api/reports/lottery` | GET | Lottery sales and lottery payouts side by side (un-netted) |
| `/api/reports/lottery-payouts` | GET | Lottery winning ticket payouts |
| `/api/reports/voids` | GET | Daily breakdown of void lines, voided units, transactions with voids, and whole voids |
| `/api/reports/payment-gaps` | GET | Transactions whose collected payments differ from line items + tax |
| `/api/tickets/{fileId}/{seq}` / `/api/events/{fileId}` | GET | Complete transaction drill-down: header, items, payments, taxes, related prepay/completion events |

All reports support `format=csv` which immediately streams UTF-8 CSV with BOM for Excel compatibility.

---

## 5. Related Documentation Links

- [Complete Implementation Plan](REPORTING_SERVICE_PLAN.md)
- [REST API Specification](api-specification.md)
- [Verifone vs Gilbarco Data Schema Mapping](data-schema-mapping.md)
- [Mermaid Architecture Diagram](reporting-architecture.mmd)
