# reporting-service: Implementation Plan & Architecture Specification (Authoritative)

**Workspace:** `C:\Users\abhia\OneDrive\HOR-Software\hor-stores\reporting-service`  
**Port:** **8094**  
**Package:** `com.handsoffretail.reporting`  
**Date:** 2026-10-23  
**Status:** Architecture Complete · Implementation Ready  

---

## 1. Executive Summary & Purpose

The **reporting-service** is the single, unified **READ-SIDE** microservice for Hands Off Retail (HOR). It provides analytical dashboards, sales reports, tender reconciliations, cash movement audits, suspicious event tracking, and full receipt drill-downs to the `client-portal` (React frontend).

### Core Responsibilities:
1. **Single Backend for Both POS Vendors:** Provides a uniform REST API serving stores powered by either **Verifone** (Commander / Ruby CPJ) or **Gilbarco** (Passport PJR).
2. **Read-Only Operation:** The reporting service never inserts, updates, or deletes POS transaction records. Data is written exclusively by the write-side ingestion services (`verifone-ingestion-service :8092` and `gilbarco-ingestion-service :8093`).
3. **Multi-Tenant Store Access Isolation:** Strictly limits every user to the stores they are explicitly assigned in `auth_db`. A platform admin sees all stores; a client user or HOR staff member sees only their authorized store IDs.
4. **Dynamic Data Routing:** Automatically resolves a store's vendor (`VERIFONE` vs `GILBARCO`) and queries the corresponding database (`verifone_db` or `gilbarco_db`).
5. **Excel-Ready CSV Downloads:** All reports support `format=csv` streaming UTF-8 encoded files with BOM for Excel compatibility.

---

## 2. Key Architectural Decisions (Owner Approved)

| # | Decision | Details |
|---|---|---|
| **D1** | **One Reporting Service for Both POS Vendors** | Rather than separate reporting backends, one Spring Boot service on port **8094** handles both Verifone and Gilbarco stores, exposing a uniform API. |
| **D2** | **Strict Store Authorization (`auth-client` 0.1.0)** | Security is enforced using `auth-client` via `hor_access` cookie. Token claims `all_stores` and `stores` (array of `store_id`) determine access. Any attempt to access an unauthorized store returns **404 Not Found** (`StoreAccess.requireStore`) to prevent store enumeration. |
| **D3** | **Read-Only Multi-DataSource Architecture** | In production, connects via read-only role `reporting_svc`. In development mode, connects using the development credentials (`auth_svc` owning `auth_db`, `verifone_db`, `gilbarco_db`). |
| **D4** | **Query SQL Report Views** | Both `verifone_db` (schema `report.*`) and `gilbarco_db` (`rpt_*` views) have proven, battle-tested SQL views established in `cpj-platform` and `pjr-platform`. The service queries these views directly using Spring `NamedParameterJdbcTemplate` for high performance and zero ORM overhead. |
| **D5** | **Stateless REST & RFC 9457 Errors** | All error responses use `application/problem+json` matching `hor-auth` and `stores-ingestion`. |
| **D6** | **Backend First** | Backend API, security, multi-datasource routing, and automated test coverage are completed before building the `client-portal` React UI. |

---

## 3. High-Level Architecture & Request Flow

```
                                 USERS (Browser)
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                 Platform Admin                   Client User / HOR Staff
                         │                             │
                         └──────────────┬──────────────┘
                                        │ HTTPS
                                        ▼
                                 nginx :443 (Reverse Proxy)
                                        │
                     ┌──────────────────┴──────────────────┐
                     │ /api/reporting/**                   │ /api/auth/**
                     ▼                                     ▼
      ┌───────────────────────────────┐     ┌───────────────────────────────┐
      │  reporting-service (:8094)    │     │      auth-service (:8091)     │
      │  Spring Boot 4.1 / Java 21    │     │  Issues RS256 JWT cookies     │
      │                               │     │  Publishes JWKS keys          │
      │  1. Validate JWT via JWKS ────┼────>│  GET /.well-known/jwks.json   │
      │  2. StoreAccess.requireStore()│     └───────────────────────────────┘
      │  3. Resolve pos_vendor        │
      │  4. Route to DB DataSource    │
      └──────────────┬────────────────┘
                     │
         ┌───────────┼───────────┐
         │ (read)    │ (read)    │ (read)
         ▼           ▼           ▼
   ┌───────────┐┌───────────┐┌───────────┐
   │  auth_db  ││verifone_db││gilbarco_db│
   │core.stores││  report.* ││   rpt_*   │
   └───────────┘└───────────┘└───────────┘
```

See [reporting-architecture.mmd](reporting-architecture.mmd) for the complete Mermaid diagram.

---

## 4. Multi-Tenant Store Access & Security Model

### 4.1 Token Extraction & Claims
The service receives requests authenticated by the `hor_access` HTTP-only cookie.
`auth-client` validates the RS256 signature using `NimbusJwtDecoder` pointed at `http://127.0.0.1:8091/api/auth/.well-known/jwks.json`.

```java
HorPrincipal principal = HorPrincipal.from(jwt);
// principal.accountType() -> "ADMIN" or "STORE_USER"
// principal.id()          -> User ID
// principal.role()        -> "PLATFORM_ADMIN", "HOR_STAFF", or "CLIENT_USER"
// principal.allStores()   -> true for PLATFORM_ADMIN, false for store users
// principal.storeIds()    -> Set<Long> of authorized store_ids
```

### 4.2 Store Access Enforcement Rules
1. **Specific Store Query (`?store=...`):**
   - The store code (or ID) is looked up in the store directory.
   - If store does not exist -> throw `DomainException(CommonErrorCode.NOT_FOUND, "Store not found.")`.
   - `StoreAccess.requireStore(principal, store.storeId())` is called:
     - If `principal.allStores()` is true -> ALLOW.
     - If `principal.storeIds().contains(store.storeId())` -> ALLOW.
     - Otherwise -> throw `DomainException(CommonErrorCode.NOT_FOUND, "Store not found.")` (404 ProblemDetail).
2. **All Stores / Date Range Query (`/api/reports/date-range`):**
   - The store list is filtered at the root:
     ```java
     List<StoreRecord> accessibleStores = storeDirectory.findAll().stream()
         .filter(s -> principal.allStores() || principal.storeIds().contains(s.storeId()))
         .toList();
     ```
   - Only loaded date ranges and stats for accessible stores are returned.

---

## 5. Dual-Vendor Dynamic Routing Engine

Every store in Hands Off Retail is assigned a `pos_vendor`:
- `VERIFONE`: Data is queried from `verifone_db`.
- `GILBARCO`: Data is queried from `gilbarco_db`.

### 5.1 Routing Component Architecture
```
                  [ ReportController ]
                           │
                [ StoreAccessValidator ]
                           │
                 [ ReportRouterService ]
                /                       \
               /                         \
  [ VerifoneReportService ]      [ GilbarcoReportService ]
       (verifone_db)                   (gilbarco_db)
```

### 5.2 Schema Differences Handled by the Services
While both POS models provide identical high-level figures, their underlying database schemas differ:
- **Verifone (`verifone_db`):** Partitioned into `cpj.*` (transaction tables), `master.*` (store replica, items, cashiers, depts), and `report.*` views (`daily_summary`, `items_daily`, `department_daily`, `fuel_daily`, `payments_daily`, `cash_movements`, `suspicious_events`, `lottery_daily`, `loaded_days`).
- **Gilbarco (`gilbarco_db`):** Partitioned into `pjr.*` or views `rpt_*` (`rpt_day_summary`, `rpt_items_sold_daily`, `rpt_department_daily`, `rpt_fuel_daily`, `rpt_payment_daily`, `rpt_cash_movement`, `rpt_suspicious_event`, `rpt_suspicious_daily`, `rpt_lottery_daily`, `rpt_void_daily`, `rpt_payment_gap`).

The respective report services (`VerifoneReportService` and `GilbarcoReportService`) execute the vendor-specific SQL and map the output rows to the unified DTO contract.

See [data-schema-mapping.md](data-schema-mapping.md) for the complete column-by-column mapping.

---

## 6. Service Layout & Package Structure

```
reporting-service/
├── docs/
│   ├── REPORTING_SERVICE_PLAN.md      (This plan)
│   ├── reporting-architecture.mmd     (Mermaid diagram)
│   ├── data-schema-mapping.md         (Verifone vs Gilbarco schema mapping)
│   └── api-specification.md           (REST API specification)
├── .env.example                       (Template for local secrets)
├── build.gradle.kts                   (Gradle Kotlin build)
├── settings.gradle.kts                (Gradle settings)
├── gradle.properties                  (Versions & JVM args)
├── gradlew, gradlew.bat, gradle/wrapper/
└── src/
    ├── main/
    │   ├── java/com/handsoffretail/reporting/
    │   │   ├── ReportingServiceApplication.java
    │   │   ├── common/
    │   │   │   ├── config/ (DataSourceConfig, ReportingProperties, SecurityConfig)
    │   │   │   ├── dto/    (ReportFilterParams, StoreDateRangeDto)
    │   │   │   └── web/    (ApiSupport - CSV serialization with BOM, filters, date cleaning)
    │   │   ├── security/
    │   │   │   ├── StoreSecurityService.java (Interface)
    │   │   │   └── impl/StoreSecurityServiceImpl.java (Implementation with StoreAccess.requireStore)
    │   │   ├── stores/
    │   │   │   ├── model/      (StoreRecord, PosVendor)
    │   │   │   ├── repository/ (StoreRepository interface & JdbcStoreRepository querying auth_db)
    │   │   │   └── service/    (StoreDirectoryService interface & StoreDirectoryServiceImpl)
    │   │   ├── verifone/cpj/   (POS SPECIFIC: Verifone CPJ Closed Period Journal)
    │   │   │   ├── controller/ (VerifoneCpjReportController - /api/reports/verifone/cpj/**)
    │   │   │   ├── service/    (VerifoneCpjReportService interface & VerifoneCpjReportServiceImpl)
    │   │   │   └── repository/ (VerifoneCpjReportRepository interface & JdbcVerifoneCpjReportRepository)
    │   │   ├── gilbarco/pjr/   (POS SPECIFIC: Gilbarco PJR Passport Journal Record)
    │   │   │   ├── controller/ (GilbarcoPjrReportController - /api/reports/gilbarco/pjr/**)
    │   │   │   ├── service/    (GilbarcoPjrReportService interface & GilbarcoPjrReportServiceImpl)
    │   │   │   └── repository/ (GilbarcoPjrReportRepository interface & JdbcGilbarcoPjrReportRepository)
    │   │   └── router/         (UNIFIED VENDOR ROUTING ENGINE)
    │   │       ├── controller/ (UnifiedReportController - /api/reports/**, /api/tickets/**, /api/events/**)
    │   │       └── service/    (ReportRoutingService interface & ReportRoutingServiceImpl)
    │   └── resources/
    │       └── application.properties (Datasources, ports, JWKS, Hikari pools)
    └── test/
        └── java/com/handsoffretail/reporting/
            ├── TestTokens.java (RS256 test key generator for platform admin, staff, and client users)
            ├── common/web/ApiSupportTest.java
            ├── security/StoreSecurityServiceImplTest.java
            ├── stores/StoreDirectoryServiceImplTest.java
            ├── router/ReportRoutingServiceImplTest.java
            ├── router/controller/UnifiedReportControllerTest.java
            ├── verifone/cpj/controller/VerifoneCpjReportControllerTest.java
            └── gilbarco/pjr/controller/GilbarcoPjrReportControllerTest.java
```

---

## 7. Step-by-Step Implementation Strategy

### Phase 1: Build & Project Scaffolding
1. Create `settings.gradle.kts`, `gradle.properties`, and `build.gradle.kts`.
2. Configure Gradle toolchain for Java 21, Spring Boot 4.1.1, and `auth-client` 0.1.0 (from `mavenLocal()`).
3. Setup Gradle wrapper and project folder hierarchy.
4. Verify build runs with `./gradlew.bat compileJava`.

### Phase 2: Configuration & Multi-DataSource Layer
1. Create `.env.example` documenting `HOR_DB_HOST`, `HOR_DB_PORT`, `HOR_DB_USERNAME`, `HOR_DB_PASSWORD`.
2. Implement `ReportingProperties.java` reading properties from environment and `.env`.
3. Implement `DataSourceConfig.java` configuring three distinct `NamedParameterJdbcTemplate` beans:
   - `authJdbcTemplate` -> connects to `auth_db`
   - `verifoneJdbcTemplate` -> connects to `verifone_db` (or local `cpj_analytics`)
   - `gilbarcoJdbcTemplate` -> connects to `gilbarco_db` (or local `pjr_analytics`)
   - Development fallback: if separate DB names are not yet created, points to dev databases with logging.

### Phase 3: Authentication & Store Security
1. Configure `SecurityConfig.java` with `auth-client` auto-configuration:
   - Secure all `/api/reporting/**` and `/api/reports/**` endpoints.
   - Authorize roles `PLATFORM_ADMIN`, `HOR_STAFF`, and `CLIENT_USER`.
   - Permit `/api/reporting/status` or health checks.
2. Implement `StoreSecurityService.java` integrating with `StoreAccess.requireStore`.

### Phase 4: Store Directory & Resolution
1. Implement `StoreRecord` and `StoreDirectoryService`.
2. Read store mappings (`store_id`, `store_code`, `store_name`, `pos_vendor`, `timezone`, `status`) from `auth_db.core.stores` (with fallback to `master.stores`).
3. Cache store records with periodic refresh to ensure zero latency during high report volume.

### Phase 5: Query Engines & Vendor Services
1. Implement `VerifoneReportService` porting proven queries from `cpj-platform`.
2. Implement `GilbarcoReportService` porting proven queries from `pjr-platform`.
3. Implement `ReportRouterService` to dispatch calls seamlessly based on `pos_vendor`.

### Phase 6: REST Controllers & CSV Streaming
1. Port and enhance `ApiSupport.java` with SQL filter builders, date formatting, and UTF-8 CSV serialization with BOM.
2. Implement `ReportController.java` with all 13 core report endpoints.
3. Implement `StoreCatalogController.java` with store lists and multi-vendor loaded date ranges.
4. Implement `TicketController.java` with unified ticket drill-downs.

### Phase 7: Automated Testing & Validation
1. Unit tests for `StoreSecurityService` (verifying 404 on unauthorized store ID).
2. Mocked JWT tests for `ReportRouterService` (verifying routing to Verifone vs Gilbarco).
3. Integration tests verifying JSON and CSV formats.

---

## 8. Development Mode Environment & Setup

In development mode:
- PostgreSQL 17 runs on `localhost:5432`.
- Role `auth_svc` (password in `.env`) has access to `auth_db`, `verifone_db`, `gilbarco_db` (or `cpj_analytics`, `pjr_analytics`).
- `auth-service` runs on port **8091**.
- `reporting-service` runs on port **8094**.
- Settings are loaded automatically via:
  ```properties
  spring.config.import=optional:file:.env[.properties]
  ```

---

## 9. Verification Checklist

- [x] Architecture overview diagram created (`docs/reporting-architecture.mmd`).
- [x] Full data schema mapping created (`docs/data-schema-mapping.md`).
- [x] Complete REST API specification created (`docs/api-specification.md`).
- [x] Authoritative implementation plan created (`docs/REPORTING_SERVICE_PLAN.md`).
- [x] Gradle build file and project scaffolding generated.
- [x] Multi-DataSource configuration and routing implemented.
- [x] Feature-based folder structure separated by POS and file type (`verifone/cpj/` and `gilbarco/pjr/`).
- [x] Layered architecture implemented (Controller -> Service Interface -> Service Impl -> Repository Interface -> Repository Impl).
- [x] 100% constructor injection with private final dependencies.
- [x] Unit and web tests implemented and executed (`./gradlew.bat test` green).
- [x] Production jar generated (`build/libs/reporting-service.jar` verified).
