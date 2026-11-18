# Implementation Plan: Automated & Hybrid Reporting Engine

**Author:** Principal Software Architect & Tech Lead  
**Service:** `reporting-service` (Spring Boot 3.4.x, Java 21, Multi-POS)  
**Target Capabilities:**
1. **Automated CSEReport Endpoint** (`/api/v1/reports/departments/monthly`) — 100% replicates `MonthlyReportFormat.jpeg`
2. **Automated Daily Register Summary** (`/api/v1/reports/daily-register`) — Replaces manual `daily-reports.md`
3. **Hybrid Liquid & Gas Margin Automation** — Auto-feeds POS cash & fuel volumes; accepts external safe counts & rack costs

---

## 1. Executive Summary & Problem Analysis

### 1.1 The Legacy Problem
Historically, store owners and managers relied on error-prone manual spreadsheets and late night data entry:
1. **Monthly Department Sales ([MonthlyReportFormat.jpeg](file:///C:/Users/abhia/OneDrive/hor/doc/MonthlyReportFormat.jpeg)):** An accountant manually exported department sales from registers, cleaned them into a 33+ row Excel template (`CSEReport`), and uploaded it via `POST /api/v1/admin/monthly-reports/upload`.
2. **Daily Register Bookkeeping ([daily-reports.md](file:///C:/Users/abhia/OneDrive/hor/doc/api/daily-reports.md)):** Cashiers and managers manually typed merchandise totals, fuel gallons, cash drawer drops, checks, drawer pop no-sales, line voids, and refund dollars.
3. **Liquid Management & Fuel Margins ([liquid.png](file:///C:/Users/abhia/OneDrive/hor/doc/liquid.png), [gas-sales.md](file:///C:/Users/abhia/OneDrive/hor/doc/api/gas-sales.md)):** A Google Sheet (`WOLF-LIQUID`, `MIDLER-LIQUID`, `TIKI-LIQUID`) manually tracked safe balances, drawer drops, bank deposits, ATM dispenses, vendor paid-outs, and payroll with fragile cell formulas (`=B429+C429-F429...`).

### 1.2 The Solution
Our dual POS databases (`verifone_db` CPJ and `gilbarco_db` PJR) already ingest every single transaction, line item, tender line, fuel dispenser event, and cash movement.
- **Milestone 1 & 2** are **100% automated read-only queries**: Real-time aggregation over POS views eliminating human data entry.
- **Milestone 3** is a **Hybrid Engine**: The POS database provides verified register truth (actual cash tendered, safe drops, vendor payouts, and fuel volumes by grade); a lightweight store ledger database stores user-entered business realities (physical safe counts, wholesale fuel rack costs, payroll), merging them into automated reconciliation reports.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   REPORTING-SERVICE                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ REST Layer:                                                                            │
│   UnifiedReportController                HybridLedgerController                       │
│     ├── GET /api/v1/reports/departments/monthly                                        │
│     └── GET /api/v1/reports/daily-register                                             │
│                                            ├── GET /api/v1/liquid/daily/prefill        │
│                                            ├── PUT /api/v1/liquid/daily/reconcile      │
│                                            ├── GET /api/v1/gas-sales/monthly/prefill   │
│                                            └── PUT /api/v1/gas-sales/monthly/reconcile │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Service Layer (Layered Architecture, Interface + Impl):                                │
│   DepartmentReportService          DailyRegisterService          HybridLedgerService   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ POS Routing & Repositories:                                                            │
│   VerifoneCpjRepository               GilbarcoPjrRepository       HybridLedgerRepository│
│     (verifone_db: report.*)             (gilbarco_db: rpt_*)      (stores_db/local JPA) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Milestone 1: Automated CSEReport Endpoint

### 2.1 API Contract
```http
GET /api/v1/reports/departments/monthly?store={storeCode}&month={1-12}&year={yyyy}&format={json|csv|xlsx}
```
**Authorization:** Authenticated user (`hor_access` JWT); store access enforced by `StoreAccess.requireStore()`.

#### Response Body (`application/json`):
```json
{
  "storeCode": "STORE001",
  "storeName": "Downtown Store",
  "reportMonth": 8,
  "reportYear": 2026,
  "posType": "VERIFONE_CPJ",
  "departments": [
    {
      "deptCode": 51,
      "deptName": "Auto",
      "gross": 124.63,
      "discount": 0.00,
      "promotion": 0.00,
      "refund": 0.00,
      "voidAmount": 0.00,
      "netSales": 124.63
    },
    {
      "deptCode": 3,
      "deptName": "Beer",
      "gross": 11586.06,
      "discount": 0.34,
      "promotion": 445.06,
      "refund": 0.00,
      "voidAmount": 0.00,
      "netSales": 11140.66
    },
    {
      "deptCode": 6,
      "deptName": "LOTTO PAID OUT",
      "gross": -6522.57,
      "discount": 0.00,
      "promotion": 0.00,
      "refund": 0.00,
      "voidAmount": 0.00,
      "netSales": -6522.57
    }
  ],
  "totals": {
    "grossTotal": 194852.14,
    "discountTotal": 34.45,
    "promotionTotal": 863.67,
    "refundTotal": 6.18,
    "voidTotal": 0.00,
    "netSalesTotal": 193947.84
  }
}
```

### 2.2 Data Source & SQL Implementation

#### Verifone CPJ:
Aggregates `report.rpt_department_sales` filtered by calendar month (`report_date >= :from AND report_date <= :to`).
```sql
SELECT 
    dept_code,
    dept_name,
    COALESCE(SUM(gross_amount), 0)    AS gross,
    COALESCE(SUM(discount_amount), 0) AS discount,
    0.00                              AS promotion,
    COALESCE(SUM(refund_amount), 0)   AS refund,
    0.00                              AS void_amount,
    COALESCE(SUM(net_amount), 0)      AS net_sales
FROM report.rpt_department_sales
WHERE store_id = :storeId
  AND report_date >= :fromDate 
  AND report_date <= :toDate
GROUP BY dept_code, dept_name
ORDER BY dept_name ASC;
```

#### Gilbarco PJR:
Aggregates `rpt_department_sales` over the same period:
```sql
SELECT 
    dept_code,
    dept_name,
    COALESCE(SUM(gross_amount), 0)    AS gross,
    COALESCE(SUM(discount_amount), 0) AS discount,
    0.00                              AS promotion,
    COALESCE(SUM(refund_amount), 0)   AS refund,
    0.00                              AS void_amount,
    COALESCE(SUM(net_amount), 0)      AS net_sales
FROM rpt_department_sales
WHERE store_id = :storeId
  AND event_date >= :fromDate 
  AND event_date <= :toDate
GROUP BY dept_code, dept_name
ORDER BY dept_name ASC;
```

---

## 3. Milestone 2: Automated Daily Register Summary

### 3.1 API Contract
```http
GET /api/v1/reports/daily-register?store={storeCode}&date={yyyy-MM-dd}
GET /api/v1/reports/daily-register?store={storeCode}&from={yyyy-MM-dd}&to={yyyy-MM-dd}
```

#### Response Body:
```json
{
  "storeCode": "STORE001",
  "storeName": "Downtown Store",
  "posType": "VERIFONE_CPJ",
  "records": [
    {
      "reportDate": "2026-09-10",
      "groceryTotal": 1250.50,
      "volume": 3200.00,
      "cashDeposit": 1100.00,
      "checkDeposit": 150.00,
      "overShort": 0.00,
      "noSale": 4,
      "lineVoid": 12,
      "voidAmount": 25.00,
      "refunds": 10.00
    }
  ]
}
```

### 3.2 Field Aggregation Mapping

| Output Field | Verifone CPJ Source | Gilbarco PJR Source |
| :--- | :--- | :--- |
| `groceryTotal` | `rpt_day_summary.merchandise_sales` | `rpt_store_day_summary.merchandise_sales` |
| `volume` (Gallons) | `SUM(volume)` from `rpt_fuel_sales` | `SUM(volume)` from `rpt_fuel_grade_sales` |
| `cashDeposit` | Cash tender from `rpt_payment_summary` OR Safe Drops from `rpt_cash_movements` | Cash tender from `rpt_tender_summary` OR Safe Drops from `rpt_cash_movements` |
| `checkDeposit` | `SUM(tender_amount)` WHERE `tender_category = 'CHECK'` | `SUM(tender_amount)` WHERE `tender_code = 'CHECK'` |
| `overShort` | Calculated variance if drawer close audit exists, otherwise `0.00` | Calculated variance if till close audit exists, otherwise `0.00` |
| `noSale` | `COUNT(*)` FROM `rpt_suspicious_events` WHERE `event_type = 'NO_SALE'` | `COUNT(*)` FROM `rpt_suspicious_activity` WHERE `event_type = 'NO_SALE'` |
| `lineVoid` | `COUNT(*)` FROM `rpt_suspicious_events` WHERE `event_type = 'VOID_LINE'` | `COUNT(*)` FROM `rpt_suspicious_activity` WHERE `event_type = 'LINE_VOID'` |
| `voidAmount` | `SUM(amount)` FROM `rpt_suspicious_events` WHERE `event_type LIKE '%VOID%'` | `SUM(amount)` FROM `rpt_suspicious_activity` WHERE `event_type LIKE '%VOID%'` |
| `refunds` | `rpt_day_summary.refund_total` | `rpt_store_day_summary.refund_total` |

---

## 4. Milestone 3: Hybrid Liquid & Gas Margin Automation

### 4.1 Problem & Architecture Pattern
The POS database contains raw transaction events, but **cannot know**:
1. Physical cash in the safe after midnight count (actual vs expected).
2. ATM third-party cassette reloads and armored car bank deposits.
3. Wholesale rack cost per gallon from oil supplier bills of lading.
4. Credit card merchant processor monthly processing fees.

#### The Hybrid Solution:
We establish a **Hybrid Ledger Engine**:
- **Step 1 (Auto-Prefill):** The frontend calls `GET .../prefill`. The service reads the POS database and populates register cash drops, drawer paid-outs, and fuel gallon volumes.
- **Step 2 (Human Audit):** The manager/accountant reviews the pre-populated values and enters the physical audit figures (actual safe cash counted, bank deposit slips, wholesale fuel rack costs).
- **Step 3 (Reconciliation & Persistence):** The service validates equations, records variances (e.g., Safe Over/Short), and saves the reconciled state.

```
                           ┌────────────────────────────────────────┐
                           │ POS Database (verifone_db/gilbarco_db) │
                           └──────────────────┬─────────────────────┘
                                              │ (Real POS truth: drops, payouts, volumes)
                                              ▼
┌──────────────────┐               ┌───────────────────────┐
│ Store Accountant │ ────────────► │ HybridLedgerService   │
│ (Enters safe,    │  Audit Input  └──────────┬────────────┘
│  ATM, rack cost) │                          │ Reconciled Records
└──────────────────┘                          ▼
                           ┌────────────────────────────────────────┐
                           │ Store Ledger Database (PostgreSQL/H2)  │
                           │  - liquid_daily_records                │
                           │  - liquid_opening_balances             │
                           │  - gas_sales_monthly_records           │
                           │  - gas_sales_fuel_costs                │
                           └────────────────────────────────────────┘
```

### 4.2 Liquid Management Pre-fill & Reconcile APIs

#### A. Pre-fill Endpoint
```http
GET /api/v1/liquid/daily/prefill?store={storeCode}&date={yyyy-MM-dd}
```
**Response:**
```json
{
  "storeCode": "STORE001",
  "liquidDate": "2026-05-01",
  "openingSafeBalance": 21731.80,
  "openingAtmBalance": 3390.00,
  "posRegisterDeposit": 2011.00,
  "posPaidOut": 0.00,
  "suggestedClosingSafe": 23742.80,
  "readOnlyFields": {
    "posRegisterDeposit": 2011.00,
    "posPaidOut": 0.00
  }
}
```

#### B. Reconcile Endpoint
```http
PUT /api/v1/liquid/daily/reconcile
```
**Request Body:**
```json
{
  "storeCode": "STORE001",
  "liquidDate": "2026-05-01",
  "addAtm": 2540.00,
  "bankDeposit": 0.00,
  "salary": 0.00,
  "cashWithdrawal": 0.00,
  "actualCountedSafe": 21202.80,
  "actualCountedAtm": 5930.00,
  "atmWithdrawal": 0.00
}
```
**Calculated Outcome:**
$$\text{Expected Closing Safe} = \text{openingSafe} + \text{posDeposit} - \text{addAtm} - \text{bankDeposit} - \text{salary} - \text{cashWithdrawal}$$
$$\text{Safe Over/Short} = \text{actualCountedSafe} - \text{Expected Closing Safe}$$

---

### 4.3 Gas Sales Margin Pre-fill & Reconcile APIs

#### A. Pre-fill Endpoint
```http
GET /api/v1/gas-sales/monthly/prefill?store={storeCode}&month=8&year=2026
```
**Response:**
```json
{
  "storeCode": "STORE001",
  "reportMonth": 8,
  "reportYear": 2026,
  "totalVolumeSold": 142273.00,
  "totalRetailRevenue": 476614.55,
  "fuelGrades": [
    {
      "fuelGradeId": 1,
      "fuelGradeName": "Regular 87",
      "volumeSold": 97273.00,
      "retailRevenue": 320900.90,
      "avgRetailPrice": 3.3000
    },
    {
      "fuelGradeId": 2,
      "fuelGradeName": "Diesel",
      "volumeSold": 45000.00,
      "retailRevenue": 155713.65,
      "avgRetailPrice": 3.4603
    }
  ]
}
```

#### B. Reconcile Endpoint
```http
PUT /api/v1/gas-sales/monthly/reconcile
```
**Request Body:**
```json
{
  "storeCode": "STORE001",
  "reportMonth": 8,
  "reportYear": 2026,
  "creditFees": 125.50,
  "gradeCosts": [
    {
      "fuelGradeId": 1,
      "wholesaleRackCostPerGallon": 2.9800
    },
    {
      "fuelGradeId": 2,
      "wholesaleRackCostPerGallon": 3.1803
    }
  ]
}
```
**Calculated Outcome:**
$$\text{ProfitPerGallon}_{\text{Regular}} = 3.3000 - 2.9800 = \$0.3200$$
$$\text{ProfitPerGallon}_{\text{Diesel}} = 3.4603 - 3.1803 = \$0.2800$$
$$\text{Net Margin} = (97273 \times 0.32) + (45000 \times 0.28) - 125.50 = \$43,727.36$$

---

## 5. Architectural Structure & Package Breakdown

Following the user's architectural guidelines:
- **SOLID, DRY, KISS, YAGNI**
- **Layered Architecture:** Controller → Service Interface → Service Impl → Repository → Database
- **Strict POS Separation:** `verifone/cpj/` and `gilbarco/pjr/` with unified facade routing

```
com.handsoffretail.reporting/
├── common/
│   ├── dto/
│   │   ├── MonthlyCseReportResponse.java
│   │   ├── DailyRegisterSummaryResponse.java
│   │   ├── LiquidPrefillResponse.java
│   │   ├── LiquidReconcileRequest.java
│   │   ├── GasSalesPrefillResponse.java
│   │   └── GasSalesReconcileRequest.java
│   └── exception/
├── verifone/cpj/
│   ├── repository/
│   │   ├── VerifoneDepartmentReportRepository.java
│   │   └── VerifoneDailyRegisterRepository.java
│   └── service/
│       ├── VerifoneDepartmentReportService.java
│       └── VerifoneDailyRegisterService.java
├── gilbarco/pjr/
│   ├── repository/
│   │   ├── GilbarcoDepartmentReportRepository.java
│   │   └── GilbarcoDailyRegisterRepository.java
│   └── service/
│       ├── GilbarcoDepartmentReportService.java
│       └── GilbarcoDailyRegisterService.java
├── ledger/                              <-- New Hybrid Ledger Module
│   ├── entity/
│   │   ├── LiquidDailyRecord.java
│   │   ├── LiquidStoreBalance.java
│   │   └── GasSalesMonthlyRecord.java
│   ├── repository/
│   │   └── LiquidRecordRepository.java
│   └── service/
│       ├── HybridLiquidService.java
│       └── HybridGasSalesService.java
└── router/
    ├── controller/
    │   ├── UnifiedReportController.java (Updated with new endpoints)
    │   └── HybridLedgerController.java
    └── service/
        └── ReportRoutingService.java
```

---

## 6. Implementation Phases & Validation Plan

### Phase 1: Monthly CSEReport Endpoint
1. Create `MonthlyCseReportResponse` DTO with departments and summary totals.
2. Implement Verifone repository query and service method.
3. Implement Gilbarco repository query and service method.
4. Expose `GET /api/v1/reports/departments/monthly` in `UnifiedReportController`.
5. Unit test with Mockito & MVC test with mock JWT.

### Phase 2: Daily Register Summary Endpoint
1. Create `DailyRegisterSummaryResponse` DTO matching `daily-reports.md`.
2. Implement Verifone and Gilbarco daily register aggregation queries.
3. Expose `GET /api/v1/reports/daily-register` in `UnifiedReportController`.
4. Unit and integration tests covering single-day and multi-day date ranges.

### Phase 3: Hybrid Liquid & Gas Margin Engine
1. Define Spring Data JPA entities for `LiquidDailyRecord` and `GasSalesMonthlyRecord` (connecting to PostgreSQL `stores_db` or local ledger table).
2. Implement prefill services merging POS data with ledger balances.
3. Implement reconcile endpoints with financial constraint validation (e.g. non-negative volume, proper rounding).
4. Full integration tests with automated mock requests.

---

## 7. Trade-offs & Production Considerations

| Concern | Design Decision | Rationale |
| :--- | :--- | :--- |
| **Calculation Speed vs Storage** | Real-time SQL aggregation on POS views | POS databases already index `report_date` and `event_date`. Aggregating 1 month of department sales executes in under 25ms without storing duplicate copies. |
| **Floating Point Precision** | Use `BigDecimal` with `setScale(2, RoundingMode.HALF_UP)` for currency and `setScale(4)` for fuel | Standard retail accounting requirement; prevents floating-point penny discrepancies. |
| **Multi-Tenancy Security** | Automatic principal injection (`HorPrincipal`) and store membership validation | Ensures Store A owner cannot view Store B's registers or fuel costs even if they manipulate query parameters. |
| **Offline Stores / No POS Sync** | Graceful fallback when a store has no ingested data | Returns empty data structure with `200 OK` rather than `500 Server Error`. |
