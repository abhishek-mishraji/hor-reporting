# reporting-service

Reporting for Hands Off Retail stores. This repo holds three apps:

| Folder | What it is | Local address |
|---|---|---|
| `verifone-reporting-service` | Spring Boot API over `verifone_db` | `http://127.0.0.1:8094` |
| `gilbarco-reporting-service` | Spring Boot API over `gilbarco_db` | `http://127.0.0.1:8095` |
| `client-dashboard` | React (Vite) dashboard that calls both APIs | `http://localhost:5183` |

Each app builds and runs on its own. There is no build at the repo root: run commands inside each app's folder.

## What else you need

This repo does not run alone. It depends on two other HOR repos:

- **hor-auth** (`handsoffretail/hor_auth`): the login service on port `8091`, and the `auth-client` Java library that both reporting services compile against.
- **stores-ingestion** (`hor-ingestion`): owns the `verifone_db` and `gilbarco_db` schemas. Its Flyway migrations create every table and view the reporting services read, including the lottery and Money Out edit tables.

Ask the repo owner for access to both, and for a local password for the `auth_svc` database user.

Tools:

- JDK 21 (Temurin)
- Node.js 20 or newer
- PostgreSQL 16 or 17
- Git

Clone all three repos side by side, for example:

```
hor-stores/
  hor-auth/
  stores-ingestion/
  reporting-service/   (this repo)
```

## Setup, step by step

The commands are PowerShell. On macOS or Linux, use `./gradlew` instead of `.\gradlew.bat`.

### 1. Databases

Create the `auth_svc` role and the three databases it owns: `auth_db`, `verifone_db` and `gilbarco_db`. The exact SQL is in:

- `hor-auth/docs/AUTH_SPEC.md` (the role and `auth_db`)
- `stores-ingestion/verifone-ingestion-service/docs/VERIFONE_BUILD_GUIDE.md` (`verifone_db`)
- `stores-ingestion/gilbarco-ingestion-service/docs/GILBARCO_BUILD_GUIDE.md` (`gilbarco_db`)

### 2. hor-auth: publish auth-client, then start the auth service

The reporting services get `com.handsoffretail:auth-client:0.1.0` from your local Maven cache (`~/.m2`). It is not on Maven Central. Without this step the build fails with `Could not find com.handsoffretail:auth-client:0.1.0`.

```powershell
cd hor-auth\libs\auth-client
.\gradlew.bat publishToMavenLocal
```

Then follow `hor-auth/docs/RUNNING_LOCALLY.md` to create `%USERPROFILE%\.hor-stores\secrets.properties` and start the auth service on port `8091`. In that secrets file, allow the dashboard's origin, or login from the dashboard fails with 403:

```properties
hor.auth.allowed-origins=http://localhost:5180,http://localhost:5181,http://localhost:5182,http://localhost:5183
```

### 3. stores-ingestion: create the report schemas

Start `verifone-ingestion-service` and `gilbarco-ingestion-service` once (see the stores-ingestion repo). On startup Flyway migrates `verifone_db` and `gilbarco_db` to the latest version. To have data to look at, ingest store files through those services or restore a database dump from the team.

Pull stores-ingestion's `dev-branch` whenever you pull this repo's `dev-branch`. Reporting features often need a new migration from there.

### 4. Reporting services

Do this in each of `verifone-reporting-service` and `gilbarco-reporting-service`:

```powershell
cd verifone-reporting-service
copy .env.example .env      # then set HOR_DB_PASSWORD in .env
.\gradlew.bat bootRun
```

Each service reads `.env` from the folder it is started in. `.env` is git-ignored: never commit it. The `.env.example` at the repo root is a single combined reference; the services do not read it.

### 5. Dashboard

```powershell
cd client-dashboard
npm install
npm run dev
```

Open **`http://localhost:5183`**. Use `localhost`, not `127.0.0.1`: the login cookies are set for `localhost` only. Vite forwards `/api/auth` to port 8091 and `/svc/verifone` and `/svc/gilbarco` to the two reporting services. More detail is in `client-dashboard/README.md`.

## Tests

```powershell
cd verifone-reporting-service; .\gradlew.bat test      # same for gilbarco-reporting-service
cd client-dashboard; npm test; npm run lint
```

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Could not find com.handsoffretail:auth-client:0.1.0` | Step 2 not done: publish auth-client to Maven local. |
| 403 "Request origin could not be verified" | Dashboard origin `http://localhost:5183` is missing from `HOR_ALLOWED_ORIGINS` in the service's `.env`, or from `hor.auth.allowed-origins` in the auth secrets file. |
| 401 on every call | Not logged in, or the dashboard was opened at `127.0.0.1` instead of `localhost`. |
| Saving lottery or Money Out edits fails | `verifone_db` or `gilbarco_db` is missing the latest migrations: pull stores-ingestion and restart its ingestion services. |
| Service fails at startup on the database | `HOR_DB_PASSWORD` is not set in `.env`, or PostgreSQL is not running. |

## Branches

Work goes `feature/*` -> `local-branch` -> `dev-branch` (shared test line) -> `prod-branch` -> `main`. Clone `dev-branch` for the latest code:

```powershell
git clone -b dev-branch https://github.com/abhishek-mishraji/hor-reporting.git reporting-service
```

Deployment to the VM is described in `docs/DEPLOY_VM.md`.
