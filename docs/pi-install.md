# Raspberry Pi Local Install

This is the local Raspberry Pi install path for PitSight. It installs the API and web dashboard on the Pi, enables systemd services, and configures a desktop autostart entry that opens the driver dashboard in Chromium when the Pi logs into the desktop session.

This does not create a cloud deployment, native Android app, PWA, provider hot-switching, or manufacturer-specific OBD PID support.

## Assumptions

- Raspberry Pi OS Desktop or Raspberry Pi OS Lite with a desktop added later.
- Python 3.11 or newer.
- Node.js 18 or newer from the OS package source or your own Node install.
- Network access to GitHub and npm/PyPI during install.
- A display is required only for Chromium kiosk mode. Headless installs still run the API and web services.

For OBD2 testing later, use an ELM327-compatible adapter. USB adapters usually appear as `/dev/ttyUSB0` or `/dev/ttyACM0`.

## GitHub Install Flow

Use the safer download-inspect-run flow during early testing:

```bash
curl -fsSL https://raw.githubusercontent.com/NicoCodePure/PitSight/main/scripts/install-pi.sh -o install-pi.sh
less install-pi.sh
chmod +x install-pi.sh
sudo PITSIGHT_REPO_URL=https://github.com/NicoCodePure/PitSight.git PITSIGHT_BRANCH=main ./install-pi.sh
```

For a fork, private repo, or non-default branch:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/<branch>/scripts/install-pi.sh -o install-pi.sh
less install-pi.sh
chmod +x install-pi.sh
sudo PITSIGHT_REPO_URL=https://github.com/<owner>/<repo>.git PITSIGHT_BRANCH=<branch> ./install-pi.sh
```

When the installer is run from a local Git checkout, it can infer the repo URL and current branch from that checkout. When the installer is downloaded as a standalone raw script, pass `PITSIGHT_REPO_URL` explicitly so fork and private repo users do not accidentally install from the wrong remote.

For a private GitHub repo, configure a non-interactive read credential on the Pi first, then set `PITSIGHT_REPO_URL` to a URL that `git clone` can fetch. Prefer a deploy key or fine-grained read-only token. If you put a token directly in an HTTPS URL, Git may persist it in the checkout's remote config, so use a short-lived or rotated credential.

Do not use `curl | bash` as the primary install method yet.

## Local Repo Install Flow

From a checked-out repo on the Pi:

```bash
sudo bash scripts/install-pi.sh
```

Useful overrides:

```bash
sudo \
  PITSIGHT_INSTALL_DIR=/opt/pitsight \
  PITSIGHT_PROVIDER_MODE=simulator \
  PITSIGHT_DASHBOARD_ROUTE=/driver/lemons \
  PITSIGHT_API_PORT=8000 \
  PITSIGHT_WEB_PORT=4173 \
  bash scripts/install-pi.sh
```

For a headless Pi or a server-only install, skip desktop autostart setup:

```bash
sudo PITSIGHT_CONFIGURE_KIOSK=0 bash scripts/install-pi.sh
```

On a multi-user Pi, choose the desktop user for Chromium autostart explicitly:

```bash
sudo PITSIGHT_KIOSK_USER=pi bash scripts/install-pi.sh
```

## What Gets Installed

- Repo checkout: `/opt/pitsight` by default.
- Runtime env file: `/etc/pitsight/pitsight.env`.
- Runtime data directory: `/var/lib/pitsight`.
- Install marker: `/opt/pitsight/.pitsight-install`.
- Data marker: `/var/lib/pitsight/.pitsight-data`.
- Backend service: `pitsight-api.service`.
- Frontend service: `pitsight-web.service`.
- Desktop autostart file: `~/.config/autostart/pitsight-dashboard.desktop` for the detected desktop user.
- Kiosk wrapper: `~/.config/pitsight/start-dashboard.sh`.

The installer creates a non-root service user named `pitsight` and adds it to `dialout`, `plugdev`, and `video` when those groups exist.

The runtime env file path is fixed at `/etc/pitsight/pitsight.env` so the installer and systemd services read the same file.

## Default Runtime

Defaults:

```bash
PITSIGHT_PROVIDER_MODE=simulator
PITSIGHT_API_HOST=0.0.0.0
PITSIGHT_API_PORT=8000
PITSIGHT_WEB_PORT=4173
PITSIGHT_DASHBOARD_ROUTE=/driver/lemons
PITSIGHT_CORS_ORIGINS=*
PITSIGHT_DATABASE_PATH=/var/lib/pitsight/pitsight.db
```

The Pi dashboard URL is:

```text
http://localhost:4173/driver/lemons
```

The frontend derives the API and WebSocket host from the browser's current host and uses `VITE_API_PORT` at build time. The installer builds the dashboard with `VITE_API_PORT` set from `PITSIGHT_API_PORT`. If you change `PITSIGHT_API_PORT` later, rerun the installer or rebuild `apps/web` with the new `VITE_API_PORT`, then restart `pitsight-web.service`.

The installer preserves existing values in `/etc/pitsight/pitsight.env` unless you pass an override environment variable when rerunning it.

## Service Commands

Check status:

```bash
systemctl status pitsight-api.service
systemctl status pitsight-web.service
```

Restart:

```bash
sudo systemctl restart pitsight-api.service
sudo systemctl restart pitsight-web.service
```

Stop/start:

```bash
sudo systemctl stop pitsight-api.service pitsight-web.service
sudo systemctl start pitsight-api.service pitsight-web.service
```

Logs:

```bash
journalctl -u pitsight-api.service -f
journalctl -u pitsight-web.service -f
```

## Validation Commands

API health:

```bash
curl -fsS http://localhost:8000/health
```

Confirm provider mode from health:

```bash
curl -fsS http://localhost:8000/health | python3 -m json.tool
```

Validate simulator mode before switching to OBD2. Confirm the API is healthy, the frontend loads, and telemetry updates in the dashboard while `PITSIGHT_PROVIDER_MODE='simulator'`.

Frontend local URL:

```bash
curl -I http://localhost:4173/driver/lemons
```

Open manually on the Pi:

```bash
chromium-browser --kiosk http://localhost:4173/driver/lemons
```

If the browser command is named `chromium`:

```bash
chromium --kiosk http://localhost:4173/driver/lemons
```

Find the Pi IP address:

```bash
hostname -I
ip addr show
```

Open from another device on the same network:

```text
http://<pi-ip-address>:4173/driver/lemons
```

## Change Dashboard Route

Edit:

```bash
sudo nano /etc/pitsight/pitsight.env
```

Set one of:

```bash
PITSIGHT_DASHBOARD_ROUTE='/driver/lemons'
PITSIGHT_DASHBOARD_ROUTE='/driver/normal'
PITSIGHT_DASHBOARD_ROUTE='/pit'
PITSIGHT_DASHBOARD_ROUTE='/settings'
```

Restart the web service and reboot or log out/in for Chromium autostart to use the new route:

```bash
sudo systemctl restart pitsight-web.service
sudo reboot
```

## Switch From Simulator To OBD2

Switch only after simulator mode has been validated on the Pi.

Edit:

```bash
sudo nano /etc/pitsight/pitsight.env
```

Set:

```bash
PITSIGHT_PROVIDER_MODE='obd2'
PITSIGHT_OBD_PORT='/dev/ttyUSB0'
```

If auto-detection is enough, leave `PITSIGHT_OBD_PORT=''`.

Restart the API:

```bash
sudo systemctl restart pitsight-api.service
```

Check health:

```bash
curl -fsS http://localhost:8000/health | python3 -m json.tool
```

The current app does not hot-switch providers through settings. Provider changes require restarting the backend service or rebooting the Pi.

## Find The OBD2 Adapter Port

Plug in the adapter, then run:

```bash
ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
dmesg | tail -n 80
```

For USB details:

```bash
lsusb
udevadm info -q property -n /dev/ttyUSB0
```

If you get permission errors, check group ownership:

```bash
ls -l /dev/ttyUSB0
id pitsight
```

The installer adds the `pitsight` service user to `dialout` when that group exists. If group membership changed while services were running, restart the service:

```bash
sudo systemctl restart pitsight-api.service
```

## Unavailable Via Connection Method

`Unavailable via connection method` means the active telemetry connection did not supply that value in the current session. It is not a fake zero and it is not automatically a fault.

Examples:

- Standard OBD2 may provide RPM, speed, coolant temperature, voltage, throttle, intake temperature, fuel level, or fuel pressure.
- Some vehicles may not expose oil pressure, oil temperature, or gear through standard OBD2.
- If a future provider or future OBD2 implementation supplies a value, the UI can display it normally.

Real available values still produce threshold warnings. Missing values from the connection method do not create low-oil-pressure or missing-sensor alarms.

## Troubleshooting

API not starting:

```bash
systemctl status pitsight-api.service
journalctl -u pitsight-api.service -n 120 --no-pager
cat /etc/pitsight/pitsight.env
```

Frontend not loading:

```bash
systemctl status pitsight-web.service
journalctl -u pitsight-web.service -n 120 --no-pager
ls -la /opt/pitsight/apps/web/dist
```

WebSocket disconnected:

```bash
curl -fsS http://localhost:8000/health | python3 -m json.tool
grep PITSIGHT_API_PORT /etc/pitsight/pitsight.env
grep PITSIGHT_CORS_ORIGINS /etc/pitsight/pitsight.env
```

Chromium/kiosk not opening:

```bash
ls -la ~/.config/autostart/
cat ~/.config/autostart/pitsight-dashboard.desktop
cat ~/.cache/pitsight/kiosk.log
command -v chromium-browser || command -v chromium
```

If Chromium is missing on Raspberry Pi OS Desktop:

```bash
sudo apt-get update
sudo apt-get install chromium-browser
```

OBD2 adapter not found:

```bash
ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
dmesg | tail -n 80
grep PITSIGHT_OBD_PORT /etc/pitsight/pitsight.env
journalctl -u pitsight-api.service -n 120 --no-pager
```

CORS/API connection issues from another device:

```bash
hostname -I
grep PITSIGHT_CORS_ORIGINS /etc/pitsight/pitsight.env
curl -fsS http://<pi-ip-address>:8000/health
```

The installer defaults `PITSIGHT_CORS_ORIGINS='*'` for local/LAN testing. You can restrict it later to a comma-separated list such as:

```bash
PITSIGHT_CORS_ORIGINS='http://localhost:4173,http://127.0.0.1:4173,http://192.168.1.50:4173'
```

## Uninstall / Rollback

Stop services, remove systemd units, and remove PitSight kiosk autostart files while keeping install files, env, and data:

```bash
sudo bash /opt/pitsight/scripts/uninstall-pi.sh
```

Remove the install directory only when it will not delete data:

```bash
sudo bash /opt/pitsight/scripts/uninstall-pi.sh --remove-install-dir
```

The install directory is removed only if it contains the installer-created `.pitsight-install` marker. Broad paths such as `/`, `/home`, `/home/*`, `/root`, `/etc`, `/opt`, `/usr`, `/var`, and `/var/lib` are refused even if passed through environment overrides.

Remove data intentionally:

```bash
sudo bash /opt/pitsight/scripts/uninstall-pi.sh --clear-data
```

Data is removed only if the data directory contains the installer-created `.pitsight-data` marker. Use `--clear-data` only when you are sure you no longer need the SQLite database or captured data. Older installs that predate these markers should be rerun through the installer before using the recursive uninstall flags, or cleaned up manually.
