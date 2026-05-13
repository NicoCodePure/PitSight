#!/usr/bin/env bash
set -euo pipefail

readonly ENV_FILE="/etc/pitsight/pitsight.env"
readonly AUTOSTART_FILENAME="pitsight-dashboard.desktop"
readonly WRAPPER_FILENAME="start-dashboard.sh"

log() {
  printf '[PitSight kiosk] %s\n' "$*"
}

warn() {
  printf '[PitSight kiosk] WARNING: %s\n' "$*" >&2
}

fail() {
  printf '[PitSight kiosk] ERROR: %s\n' "$*" >&2
  exit 1
}

detect_user() {
  if [[ -n "${PITSIGHT_KIOSK_USER:-}" ]]; then
    printf '%s\n' "${PITSIGHT_KIOSK_USER}"
    return
  fi

  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    printf '%s\n' "${SUDO_USER}"
    return
  fi

  if id pi >/dev/null 2>&1; then
    printf '%s\n' "pi"
    return
  fi

  if [[ "${EUID}" -ne 0 ]]; then
    id -un
    return
  fi

  if command -v getent >/dev/null 2>&1; then
    local uid1000_user
    uid1000_user="$(getent passwd 1000 | cut -d: -f1 || true)"
    if [[ -n "${uid1000_user}" ]]; then
      printf '%s\n' "${uid1000_user}"
      return
    fi
  fi

  return 1
}

user_home() {
  local user_name="$1"
  if command -v getent >/dev/null 2>&1; then
    getent passwd "${user_name}" | cut -d: -f6
  else
    eval "printf '%s\n' ~${user_name}"
  fi
}

trim_value() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

read_env_value() {
  local key="$1"
  local fallback="$2"
  local line raw value=""
  local found=0

  [[ -r "${ENV_FILE}" ]] || {
    printf '%s' "${fallback}"
    return
  }

  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" =~ ^[[:space:]]*${key}[[:space:]]*= ]] || continue

    raw="${line#*=}"
    raw="$(trim_value "${raw}")"

    if [[ "${raw}" == \'*\' && "${raw}" == *\' && "${#raw}" -ge 2 ]]; then
      raw="${raw:1:${#raw}-2}"
    elif [[ "${raw}" == \"*\" && "${raw}" == *\" && "${#raw}" -ge 2 ]]; then
      raw="${raw:1:${#raw}-2}"
    else
      raw="${raw%%#*}"
      raw="$(trim_value "${raw}")"
    fi

    value="${raw}"
    found=1
  done <"${ENV_FILE}"

  if [[ "${found}" -eq 1 ]]; then
    printf '%s' "${value}"
  else
    printf '%s' "${fallback}"
  fi
}

main() {
  [[ "$(uname -s)" == "Linux" ]] || fail "Kiosk setup is intended for Linux/Raspberry Pi OS."

  local dashboard_route="${PITSIGHT_DASHBOARD_ROUTE:-$(read_env_value PITSIGHT_DASHBOARD_ROUTE "/driver/lemons")}"
  local web_port="${PITSIGHT_WEB_PORT:-$(read_env_value PITSIGHT_WEB_PORT "4173")}"
  local dashboard_url="${PITSIGHT_KIOSK_URL:-$(read_env_value PITSIGHT_KIOSK_URL "http://localhost:${web_port}${dashboard_route}")}"
  local kiosk_user
  if ! kiosk_user="$(detect_user)"; then
    warn "No desktop user could be detected. Skipping Chromium autostart configuration."
    exit 0
  fi

  local home_dir
  home_dir="$(user_home "${kiosk_user}")"
  [[ -n "${home_dir}" && -d "${home_dir}" ]] || fail "Home directory not found for user ${kiosk_user}."

  local config_root="${home_dir}/.config"
  local autostart_dir="${home_dir}/.config/autostart"
  local pitsight_config_dir="${home_dir}/.config/pitsight"
  local cache_dir="${home_dir}/.cache/pitsight"
  local wrapper_path="${pitsight_config_dir}/${WRAPPER_FILENAME}"
  local desktop_path="${autostart_dir}/${AUTOSTART_FILENAME}"
  local config_root_existed=0 autostart_dir_existed=0

  [[ -d "${config_root}" ]] && config_root_existed=1
  [[ -d "${autostart_dir}" ]] && autostart_dir_existed=1

  mkdir -p "${autostart_dir}" "${pitsight_config_dir}" "${cache_dir}"

  cat >"${wrapper_path}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/etc/pitsight/pitsight.env"

trim_value() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

read_env_value() {
  local key="$1"
  local fallback="$2"
  local line raw value=""
  local found=0

  [[ -r "${ENV_FILE}" ]] || {
    printf '%s' "${fallback}"
    return
  }

  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" =~ ^[[:space:]]*${key}[[:space:]]*= ]] || continue

    raw="${line#*=}"
    raw="$(trim_value "${raw}")"

    if [[ "${raw}" == \'*\' && "${raw}" == *\' && "${#raw}" -ge 2 ]]; then
      raw="${raw:1:${#raw}-2}"
    elif [[ "${raw}" == \"*\" && "${raw}" == *\" && "${#raw}" -ge 2 ]]; then
      raw="${raw:1:${#raw}-2}"
    else
      raw="${raw%%#*}"
      raw="$(trim_value "${raw}")"
    fi

    value="${raw}"
    found=1
  done <"${ENV_FILE}"

  if [[ "${found}" -eq 1 ]]; then
    printf '%s' "${value}"
  else
    printf '%s' "${fallback}"
  fi
}

WEB_PORT="${PITSIGHT_WEB_PORT:-$(read_env_value PITSIGHT_WEB_PORT "4173")}"
DASHBOARD_ROUTE="${PITSIGHT_DASHBOARD_ROUTE:-$(read_env_value PITSIGHT_DASHBOARD_ROUTE "/driver/lemons")}"
KIOSK_URL="${PITSIGHT_KIOSK_URL:-$(read_env_value PITSIGHT_KIOSK_URL "http://localhost:${WEB_PORT}${DASHBOARD_ROUTE}")}"
KIOSK_DELAY_SECONDS="${PITSIGHT_KIOSK_DELAY_SECONDS:-10}"
LOG_FILE="${HOME}/.cache/pitsight/kiosk.log"

mkdir -p "$(dirname "${LOG_FILE}")"
sleep "${KIOSK_DELAY_SECONDS}"

BROWSER=""
for candidate in chromium-browser chromium google-chrome; do
  if command -v "${candidate}" >/dev/null 2>&1; then
    BROWSER="${candidate}"
    break
  fi
done

if [[ -z "${BROWSER}" ]]; then
  printf 'Chromium is not installed. Install chromium-browser or chromium to enable PitSight kiosk mode.\n' >>"${LOG_FILE}"
  exit 0
fi

exec "${BROWSER}" \
  --kiosk \
  --start-fullscreen \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  "${KIOSK_URL}"
EOF

  chmod 0755 "${wrapper_path}"

  cat >"${desktop_path}" <<EOF
[Desktop Entry]
Type=Application
Name=PitSight Dashboard
Comment=Open the PitSight dashboard at desktop login
Exec=${wrapper_path}
Terminal=false
X-GNOME-Autostart-enabled=true
EOF

  [[ "${config_root_existed}" -eq 0 ]] && chown "${kiosk_user}:" "${config_root}"
  [[ "${autostart_dir_existed}" -eq 0 ]] && chown "${kiosk_user}:" "${autostart_dir}"
  chown "${kiosk_user}:" "${desktop_path}" "${wrapper_path}" "${pitsight_config_dir}" "${cache_dir}"

  if ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
    warn "Chromium is not installed. The autostart entry was created, but it will log a message until Chromium is installed."
    warn "On Raspberry Pi OS Desktop, install it with: sudo apt-get install chromium-browser"
  fi

  log "Configured Chromium autostart for user ${kiosk_user}"
  log "Dashboard URL: ${dashboard_url}"
  log "Autostart file: ${desktop_path}"
}

main "$@"
