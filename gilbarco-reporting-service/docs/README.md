# Gilbarco Reporting Service

The `gilbarco-reporting-service` provides dedicated reporting and analytics APIs for Gilbarco Passport stores (reading `gilbarco_db` and `auth_db`). It was split from the original shared `reporting-service` into an independent Spring Boot service.

## Service Details
- **Port:** `8095`
- **Application Name:** `gilbarco-reporting-service`
- **POS Vendor:** `GILBARCO` (Passport Journal Record - PJR)
- **Database Pools:** `auth_db` (store metadata & auth directory), `gilbarco_db` (PJR analytics views & event tables)
- **Base Package:** `com.handsoffretail.reporting.gilbarco`

## Environment Variables (.env)
```properties
HOR_DB_HOST=localhost
HOR_DB_PORT=5432
HOR_DB_USERNAME=auth_svc
HOR_DB_PASSWORD=
HOR_GILBARCO_DB_NAME=gilbarco_db
HOR_AUTH_DB_NAME=auth_db
HOR_AUTH_JWKS_URI=http://127.0.0.1:8091/api/auth/.well-known/jwks.json
HOR_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
```

## How to Run & Test
- Run tests:
  ```powershell
  .\gradlew.bat test
  ```
- Run the service locally:
  ```powershell
  .\gradlew.bat bootRun
  ```
- Build the JAR:
  ```powershell
  .\gradlew.bat bootJar
  ```
  Produces `build/libs/gilbarco-reporting-service.jar`.

## Key Endpoints
- `GET /api/reporting/status`
- `GET /api/reports/stores` (GILBARCO stores only)
- `GET /api/reports/date-range` (GILBARCO stores only)
- `GET /api/reports/day-summary`
- `GET /api/reports/items-sold`
- `GET /api/reports/departments`
- `GET /api/v1/reports/departments/monthly` and `GET /api/reports/departments/monthly`
- `GET /api/v1/reports/daily-register` and `GET /api/reports/daily-register`
- `GET /api/reports/fuel`
- `GET /api/reports/payments`
- `GET /api/reports/cash-movements`
- `GET /api/reports/suspicious/events`
- `GET /api/reports/suspicious/daily`
- `GET /api/reports/lottery`
- `GET /api/reports/lottery-payouts`
- `GET /api/reports/voids`
- `GET /api/reports/payment-gaps`
- `GET /api/events/{fileId}`
