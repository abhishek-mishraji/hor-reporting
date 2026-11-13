# Verifone Reporting Service

The `verifone-reporting-service` provides dedicated reporting and analytics APIs for Verifone POS stores (reading `verifone_db` and `auth_db`). It was split from the original shared `reporting-service` into an independent Spring Boot service.

## Service Details
- **Port:** `8094`
- **Application Name:** `verifone-reporting-service`
- **POS Vendor:** `VERIFONE` (Commander / Ruby Closed Period Journal - CPJ)
- **Database Pools:** `auth_db` (store metadata & auth directory), `verifone_db` (CPJ analytics views & files)
- **Base Package:** `com.handsoffretail.reporting.verifone`

## Environment Variables (.env)
```properties
HOR_DB_HOST=localhost
HOR_DB_PORT=5432
HOR_DB_USERNAME=auth_svc
HOR_DB_PASSWORD=
HOR_VERIFONE_DB_NAME=verifone_db
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
  Produces `build/libs/verifone-reporting-service.jar`.

## Key Endpoints
- `GET /api/reporting/status`
- `GET /api/reports/stores` (VERIFONE stores only)
- `GET /api/reports/date-range` (VERIFONE stores only)
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
- `GET /api/tickets/{fileId}/{ticketSeq}`
