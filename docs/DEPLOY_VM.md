# Deploying reporting-service to the VM

Target: the Oracle Ubuntu VM that already runs auth-service (`auth.handsoffretail.com`) and ingestion
(`ingestion.handsoffretail.com`). Reporting is served on **`https://apps.handsoffretail.com`**.

## 1. What runs where

```
Browser ──https──▶ nginx  apps.handsoffretail.com
                    ├── /                 → client-dashboard build (static files, base /)
                    ├── /api/auth/        → auth-service          127.0.0.1:8091  (already running)
                    ├── /svc/verifone/... → verifone-reporting    127.0.0.1:8094  (prefix /svc/verifone stripped)
                    └── /svc/gilbarco/... → gilbarco-reporting    127.0.0.1:8095  (prefix /svc/gilbarco stripped)

verifone-reporting ──▶ verifone_db + auth_db (read)      gilbarco-reporting ──▶ gilbarco_db + auth_db (read)
both               ──▶ http://127.0.0.1:8091/api/auth/.well-known/jwks.json (verify login tokens)
```

| Item | Value |
|---|---|
| Clone on VM | `/opt/hor/store-automation/hor-reporting` (repo `hor-reporting`) |
| verifone-reporting | folder `verifone-reporting-service/`, port **8094**, unit `verifone-reporting` |
| gilbarco-reporting | folder `gilbarco-reporting-service/`, port **8095**, unit `gilbarco-reporting` |
| Dashboard | `client-dashboard/dist`, served at `/` |
| Who can use it | `PLATFORM_ADMIN`, `HOR_STAFF`, `CLIENT_USER` (the dashboard has its own login page) |
| Runs as | `ubuntu` |
| Settings | `.env` in each service folder (git-ignored) |
| DB login | `auth_svc` (same password as auth-service) |
| Health check (no login) | `GET /api/reporting/status` on each service |

These services only **read** data. They create no tables, and the ingestion services own the schemas.
Deploy reporting **after** ingestion has created and filled `verifone_db` / `gilbarco_db`.

## 2. Before you start (on your laptop)

Push first. The VM builds from GitHub.
- **hor-reporting**: `infra/` (nginx and systemd files) and this document.
- **hor-auth**: `web/auth-console/.env.production` now has `VITE_PORTAL_HOME=https://apps.handsoffretail.com/`, so store users who log in on auth-console are allowed back to the dashboard.

## 3. Deploy order

1. verifone-reporting → 2. gilbarco-reporting → 3. client-dashboard → 4. nginx + HTTPS → 5. auth-console rebuild.
Check each backend locally before moving on.

## 4. Steps on the VM

### Step 1: Pre-flight checks
```bash
dig +short apps.handsoffretail.com; curl -s ifconfig.me; echo           # same IP twice
sudo ss -ltnp | grep -E ':(8094|8095)\b' || echo "8094/8095 free"
ls ~/.m2/repository/com/handsoffretail/auth-client/0.1.0/*.jar           # auth-client published (done for ingestion)
systemctl is-active auth-service verifone-ingestion gilbarco-ingestion  # all active
free -h                                                                  # see "Memory" below
```
**Memory:** this adds 2 more Java processes, about 0.5–0.7 GB each, for 5 in total next to your other dashboard.
If `available` is under about 1.5 GB, add swap first (auth guide, "Step 5: swap") or lower `-Xmx512m` to `-Xmx384m` in the unit files.

### Step 2: Clone (needs a 3rd deploy key: one key per repo)
```bash
ssh-keygen -t ed25519 -f ~/.ssh/hor_reporting_deploy -N "" -C "oracle-vm-hor-reporting"
cat ~/.ssh/hor_reporting_deploy.pub
```
GitHub → **hor-reporting → Settings → Deploy keys → Add** (leave write access **unticked**). Then:
```bash
cat >> ~/.ssh/config <<'EOF'
Host github-hor-reporting
    HostName github.com
    User git
    IdentityFile ~/.ssh/hor_reporting_deploy
    IdentitiesOnly yes
EOF
ssh -T github-hor-reporting                                              # "successfully authenticated"
git clone github-hor-reporting:abhishek-mishraji/hor-reporting.git /opt/hor/store-automation/hor-reporting
ls /opt/hor/store-automation/hor-reporting                               # client-dashboard, infra, *-reporting-service
```

### Step 3: verifone-reporting
```bash
nano /opt/hor/store-automation/hor-reporting/verifone-reporting-service/.env
```
```properties
HOR_DB_PASSWORD=<auth_svc password on the VM: same as the other services>
HOR_ALLOWED_ORIGINS=https://apps.handsoffretail.com
```
Everything else has working defaults: host `localhost`, port `5432`, user `auth_svc`, DB names, JWKS URL.
If you paste your laptop `.env`, **replace** its `HOR_ALLOWED_ORIGINS` (it lists localhost ports) and its DB password.
```bash
chmod 600 /opt/hor/store-automation/hor-reporting/verifone-reporting-service/.env
cd /opt/hor/store-automation/hor-reporting/verifone-reporting-service
bash gradlew clean bootJar --no-daemon
sudo cp /opt/hor/store-automation/hor-reporting/infra/systemd/verifone-reporting.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now verifone-reporting
sudo journalctl -u verifone-reporting -f        # wait for "Started ...", then Ctrl+C
curl -s http://127.0.0.1:8094/api/reporting/status; echo                                       # status JSON
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8094/api/reports/stores               # 401
```

### Step 4: gilbarco-reporting
The same as Step 3, with `gilbarco` and port **8095**:
```bash
cp /opt/hor/store-automation/hor-reporting/verifone-reporting-service/.env /opt/hor/store-automation/hor-reporting/gilbarco-reporting-service/.env
chmod 600 /opt/hor/store-automation/hor-reporting/gilbarco-reporting-service/.env
cd /opt/hor/store-automation/hor-reporting/gilbarco-reporting-service
bash gradlew clean bootJar --no-daemon
sudo cp /opt/hor/store-automation/hor-reporting/infra/systemd/gilbarco-reporting.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now gilbarco-reporting
sudo journalctl -u gilbarco-reporting -f        # "Started ...", then Ctrl+C
curl -s http://127.0.0.1:8095/api/reporting/status; echo
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8095/api/reports/stores               # 401
```

### Step 5: client-dashboard
```bash
cd /opt/hor/store-automation/hor-reporting/client-dashboard
npm ci && npm run build
grep -oE 'src="[^"]+"' dist/index.html                                   # src="/assets/index-....js"
sudo chmod o+x /opt/hor /opt/hor/store-automation /opt/hor/store-automation/hor-reporting /opt/hor/store-automation/hor-reporting/client-dashboard
sudo chmod -R o+rX /opt/hor/store-automation/hor-reporting/client-dashboard/dist
sudo -u www-data test -r /opt/hor/store-automation/hor-reporting/client-dashboard/dist/index.html && echo "nginx can read it"
```

### Step 6: nginx + HTTPS
```bash
sudo cp -a /etc/nginx /etc/nginx.backup-$(date +%F-%H%M)
sudo cp /opt/hor/store-automation/hor-reporting/infra/nginx/apps.conf /etc/nginx/sites-available/apps.handsoffretail.com
sudo ln -s /etc/nginx/sites-available/apps.handsoffretail.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d apps.handsoffretail.com                         # choose Redirect if asked
```

### Step 7: auth-console (store-user redirect to apps)
```bash
cd /opt/hor/centralized-auth/hor-auth && git pull
grep VITE_PORTAL_HOME web/auth-console/.env.production                   # https://apps.handsoffretail.com/
cd web/auth-console && npm ci && npm run build
```

### Step 8: Verify end to end
```bash
curl -sI https://apps.handsoffretail.com/ | head -1                                              # 200
curl -s https://apps.handsoffretail.com/ | grep -oE 'src="[^"]+"'                                # /assets/...js
curl -s https://apps.handsoffretail.com/api/auth/.well-known/jwks.json | head -c 40; echo        # {"keys":[
curl -s https://apps.handsoffretail.com/svc/verifone/api/reporting/status; echo                  # status JSON
curl -s https://apps.handsoffretail.com/svc/gilbarco/api/reporting/status; echo                  # status JSON
curl -s -o /dev/null -w "%{http_code}\n" https://apps.handsoffretail.com/svc/verifone/api/reports/stores   # 401
```
In the browser:
1. Open `https://apps.handsoffretail.com` and log in on the dashboard's own login page.
2. Pick a Verifone store and a Gilbarco store, and open a day that ingestion has loaded. The reports should show data.
3. Log in as a `CLIENT_USER`: they should see **only their own** stores.

## 5. Updating later
```bash
cd /opt/hor/store-automation/hor-reporting && git pull
(cd verifone-reporting-service && bash gradlew clean bootJar --no-daemon) && sudo systemctl restart verifone-reporting
(cd gilbarco-reporting-service && bash gradlew clean bootJar --no-daemon) && sudo systemctl restart gilbarco-reporting
(cd client-dashboard && npm ci && npm run build)
```
If auth-client changed in hor-auth, `publishToMavenLocal` again **before** rebuilding.

## 6. Rollback
- **Service:** `git checkout <previous-commit>`, rebuild, restart. Nothing to undo in the DB, because reporting is read-only.
- **nginx:** `sudo rm /etc/nginx/sites-enabled/apps.handsoffretail.com && sudo systemctl reload nginx`.

## 7. Troubleshooting
| Symptom | Cause / fix |
|---|---|
| Build: `Could not find com.handsoffretail:auth-client:0.1.0` | run `publishToMavenLocal` in `hor-auth/libs/auth-client` (as `ubuntu`) |
| Start: `password authentication failed` | `HOR_DB_PASSWORD` must equal the VM auth_svc password |
| Start: relation/schema does not exist | ingestion has not created the vendor schema yet: start the matching ingestion service first |
| `502` on `/svc/...` | that reporting service is down: `systemctl status verifone-reporting` |
| `404` on `/svc/verifone/api/...` from the service | nginx `proxy_pass` must end with `/` so the prefix is stripped |
| `401` in the browser after login | auth `.env` cookie domain must be `handsoffretail.com` |
| `403 CSRF_REJECTED` | `HOR_ALLOWED_ORIGINS=https://apps.handsoffretail.com` in that service's `.env` |
| Blank page | dashboard not built, or nginx cannot read `dist` (Step 5) |
| `nginx -t`: `zero size shared memory zone "hor_auth_login"` | the auth site (which defines the zone) is not enabled |
| Logs | `sudo journalctl -u verifone-reporting -f`, `sudo journalctl -u gilbarco-reporting -f` |
