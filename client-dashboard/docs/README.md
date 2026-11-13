# client-dashboard — documentation

The client-facing web app for store reports. It shows the business figures the two reporting services
return, in plain tables with the columns each user chooses. It began as a verification tool; the
verification checks now belong to the admin fetch console (documented in 05, code still in `src/checks/`).

| File | What it covers |
|---|---|
| [01-overview.md](01-overview.md) | Purpose, scope, what is in and out |
| [02-architecture-and-auth.md](02-architecture-and-auth.md) | Ports, dev proxy, login, session refresh, choosing the service per store, errors |
| [03-api-reference.md](03-api-reference.md) | Every endpoint of both services: parameters, fields, units, signs, vendor differences |
| [04-screens.md](04-screens.md) | Each screen: which calls it makes and what it shows |
| [05-verification-checks.md](05-verification-checks.md) | The cross-checks (formula, severity, expected result on today's data) |
| [06-known-facts-and-issues.md](06-known-facts-and-issues.md) | Real data findings and service limitations the dashboard must explain, not hide |
| [07-ui-build-prompt.md](07-ui-build-prompt.md) | The prompt to give an AI to build the dashboard |
| [08-ui-design-system.md](08-ui-design-system.md) | Design system, visual hierarchy, tokens, KPI cards, and UI/UX design specifications |

Facts in these documents were read from the service code and checked against the live development
databases on **2026-10-24** (Verifone store `8730_IN-47872` Tiki Hut, Gilbarco store `800_NY-13208` Wolf).
Values in the "expected" columns are a snapshot of that day's data and change when new POS files are loaded.
