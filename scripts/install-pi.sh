#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_REPO_URL=""
readonly DEFAULT_BRANCH="main"
readonly DEFAULT_INSTALL_DIR="/opt/pitsight"
readonly DEFAULT_ENV_DIR="/etc/pitsight"
readonly DEFAULT_ENV_FILE="/etc/pitsight/pitsight.env"
readonly DEFAULT_DATA_DIR="/var/lib/pitsight"
readonly DEFAULT_SERVICE_USER="pitsight"
readonly INSTALL_MARKER_FILENAME=".pitsight-install"
readonly DATA_MARKER_FILENAME=".pitsight-data"

log() {
  printf '[PitSight install] %s\n' "$*"
}

warn() {
  printf '[PitSight install] WARNING: %s\n' "$*" >&2
}

fail() {
  printf '[PitSight install] ERROR: %s\n' "$*" >&2
  exit 1
}

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    fail "Run this installer with sudo, for example: sudo ./install-pi.sh"
  fi
}

require_command() {
  local command_name="$1"
  command -v "${command_name}" >/dev/null 2>&1 || fail "Required command not found: ${command_name}"
}

shell_quote() {
  local value="$1"
  printf "'%s'" "${value//\'/\'\\\'\'}"
}

sed_escape_replacement() {
  printf '%s' "$1" | sed -e 's/[&|]/\\&/g'
}

env_was_set() {
  [[ "${!1+x}" == "x" ]]
}

quote_env_value() {
  local value="$1"
  printf "'%s'" "${value//\'/\'\\\'\'}"
}

set_env_key() {
  local key="$1"
  local value="$2"
  local force="$3"
  local quoted_value sed_value
  quoted_value="$(quote_env_value "${value}")"
  sed_value="$(sed_escape_replacement "${quoted_value}")"

  if grep -qE "^${key}=" "${PITSIGHT_ENV_FILE}"; then
    if [[ "${force}" == "1" ]]; then
      sed -i "s|^${key}=.*|${key}=${sed_value}|" "${PITSIGHT_ENV_FILE}"
      log "Updated ${key} in ${PITSIGHT_ENV_FILE}"
    else
      log "Preserved existing ${key} in ${PITSIGHT_ENV_FILE}"
    fi
  else
    printf '%s=%s\n' "${key}" "${quoted_value}" >>"${PITSIGHT_ENV_FILE}"
    log "Added ${key} to ${PITSIGHT_ENV_FILE}"
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

  [[ -r "${PITSIGHT_ENV_FILE}" ]] || {
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
  done <"${PITSIGHT_ENV_FILE}"

  if [[ "${found}" -eq 1 ]]; then
    printf '%s' "${value}"
  else
    printf '%s' "${fallback}"
  fi
}

refresh_runtime_values_from_env_file() {
  PITSIGHT_PROVIDER_MODE="$(read_env_value PITSIGHT_PROVIDER_MODE "${PITSIGHT_PROVIDER_MODE_VALUE}")"
  PITSIGHT_API_HOST="$(read_env_value PITSIGHT_API_HOST "${PITSIGHT_API_HOST_VALUE}")"
  PITSIGHT_API_PORT="$(read_env_value PITSIGHT_API_PORT "${PITSIGHT_API_PORT_VALUE}")"
  PITSIGHT_WEB_PORT="$(read_env_value PITSIGHT_WEB_PORT "${PITSIGHT_WEB_PORT_VALUE}")"
  PITSIGHT_DASHBOARD_ROUTE="$(read_env_value PITSIGHT_DASHBOARD_ROUTE "${PITSIGHT_DASHBOARD_ROUTE_VALUE}")"
  PITSIGHT_OBD_PORT="$(read_env_value PITSIGHT_OBD_PORT "${PITSIGHT_OBD_PORT_VALUE}")"
  PITSIGHT_CORS_ORIGINS="$(read_env_value PITSIGHT_CORS_ORIGINS "${PITSIGHT_ALLOWED_ORIGINS_VALUE}")"
}

script_dir() {
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd
}

infer_repo_url_from_script_checkout() {
  local dir repo_root repo_url
  dir="$(script_dir)"
  repo_root="$(git -C "${dir}" rev-parse --show-toplevel 2>/dev/null || true)"
  [[ -n "${repo_root}" ]] || return 1
  repo_url="$(git -C "${repo_root}" remote get-url origin 2>/dev/null || true)"
  [[ -n "${repo_url}" ]] || return 1
  printf '%s' "${repo_url}"
}

infer_branch_from_script_checkout() {
  local dir repo_root branch
  dir="$(script_dir)"
  repo_root="$(git -C "${dir}" rev-parse --show-toplevel 2>/dev/null || true)"
  [[ -n "${repo_root}" ]] || return 1
  branch="$(git -C "${repo_root}" branch --show-current 2>/dev/null || true)"
  [[ -n "${branch}" ]] || return 1
  printf '%s' "${branch}"
}

run_as_service_user() {
  if command -v runuser >/dev/null 2>&1; then
    runuser -u "${PITSIGHT_SERVICE_USER}" -- "$@"
  else
    sudo -H -u "${PITSIGHT_SERVICE_USER}" "$@"
  fi
}

detect_platform() {
  [[ "$(uname -s)" == "Linux" ]] || fail "This installer is intended for Linux/Raspberry Pi OS."

  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    case "${ID:-}:${ID_LIKE:-}" in
      *raspbian* | *debian* | *:debian* | *ubuntu*)
        ;;
      *)
        warn "This does not look like Raspberry Pi OS or Debian. Continuing because apt is available."
        ;;
    esac
  else
    warn "/etc/os-release is missing. Continuing with generic Linux checks."
  fi

  if [[ ! -r /proc/device-tree/model ]] || ! tr -d '\0' </proc/device-tree/model | grep -qi "raspberry pi"; then
    warn "Raspberry Pi hardware was not detected. This is okay for dry runs, but kiosk behavior is only tested on Raspberry Pi OS."
  fi
}

install_apt_packages() {
  require_command apt-get
  log "Installing apt packages"
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates \
    bash \
    curl \
    git \
    nodejs \
    npm \
    python3 \
    python3-pip \
    python3-venv
}

validate_runtime_versions() {
  require_command git
  require_command npm
  require_command node
  require_command python3
  PITSIGHT_NPM_PATH="$(command -v npm)"

  python3 - <<'PY'
import sys
if sys.version_info < (3, 11):
    raise SystemExit("PitSight requires Python 3.11 or newer.")
PY

  local node_major
  node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  if [[ "${node_major}" -lt 18 ]]; then
    fail "PitSight frontend requires Node.js 18 or newer. Install a newer Node.js package, then rerun."
  fi
}

create_service_user() {
  if id "${PITSIGHT_SERVICE_USER}" >/dev/null 2>&1; then
    log "Using existing service user: ${PITSIGHT_SERVICE_USER}"
  else
    log "Creating service user: ${PITSIGHT_SERVICE_USER}"
    useradd --system --create-home --home-dir "/var/lib/${PITSIGHT_SERVICE_USER}" --shell /usr/sbin/nologin "${PITSIGHT_SERVICE_USER}"
  fi

  local group_name
  for group_name in dialout plugdev video; do
    if getent group "${group_name}" >/dev/null 2>&1; then
      usermod -aG "${group_name}" "${PITSIGHT_SERVICE_USER}"
    fi
  done
}

clone_or_update_repo() {
  local install_parent
  install_parent="$(dirname "${PITSIGHT_INSTALL_DIR}")"
  mkdir -p "${install_parent}"

  if [[ -d "${PITSIGHT_INSTALL_DIR}/.git" ]]; then
    local existing_origin current_branch target_branch
    log "Updating existing repo in ${PITSIGHT_INSTALL_DIR}"
    chown -R "${PITSIGHT_SERVICE_USER}:${PITSIGHT_SERVICE_USER}" "${PITSIGHT_INSTALL_DIR}"
    existing_origin="$(run_as_service_user git -C "${PITSIGHT_INSTALL_DIR}" remote get-url origin)"
    current_branch="$(run_as_service_user git -C "${PITSIGHT_INSTALL_DIR}" branch --show-current)"

    if [[ "${PITSIGHT_REPO_URL_FORCE}" -eq 1 ]]; then
      run_as_service_user git -C "${PITSIGHT_INSTALL_DIR}" remote set-url origin "${PITSIGHT_REPO_URL}"
      existing_origin="${PITSIGHT_REPO_URL}"
    else
      PITSIGHT_REPO_URL="${existing_origin}"
      log "Preserved existing Git origin: ${PITSIGHT_REPO_URL}"
    fi

    if [[ "${PITSIGHT_BRANCH_FORCE}" -eq 1 ]]; then
      target_branch="${PITSIGHT_BRANCH}"
    else
      [[ -n "${current_branch}" ]] || fail "Existing checkout is detached. Set PITSIGHT_BRANCH to choose a branch."
      target_branch="${current_branch}"
      PITSIGHT_BRANCH="${target_branch}"
      log "Preserved existing Git branch: ${PITSIGHT_BRANCH}"
    fi

    run_as_service_user git -C "${PITSIGHT_INSTALL_DIR}" fetch origin "${target_branch}"
    run_as_service_user git -C "${PITSIGHT_INSTALL_DIR}" checkout "${target_branch}"
    run_as_service_user git -C "${PITSIGHT_INSTALL_DIR}" pull --ff-only origin "${target_branch}"
    write_install_marker
    return
  fi

  if [[ -e "${PITSIGHT_INSTALL_DIR}" ]] && [[ -n "$(find "${PITSIGHT_INSTALL_DIR}" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    fail "${PITSIGHT_INSTALL_DIR} exists and is not a Git checkout. Move it aside or set PITSIGHT_INSTALL_DIR."
  fi

  if [[ "${PITSIGHT_REPO_URL_FORCE}" -ne 1 ]]; then
    PITSIGHT_REPO_URL="$(infer_repo_url_from_script_checkout || true)"
    if [[ -n "${PITSIGHT_REPO_URL}" ]]; then
      log "Inferred Git origin from local checkout: ${PITSIGHT_REPO_URL}"
    elif [[ -n "${DEFAULT_REPO_URL}" ]]; then
      PITSIGHT_REPO_URL="${DEFAULT_REPO_URL}"
      log "Using default Git origin: ${PITSIGHT_REPO_URL}"
    else
      fail "No existing install was found and no repo URL could be inferred. Set PITSIGHT_REPO_URL, for example: sudo PITSIGHT_REPO_URL=https://github.com/<owner>/<repo>.git ./install-pi.sh"
    fi
  fi

  if [[ "${PITSIGHT_BRANCH_FORCE}" -ne 1 ]]; then
    PITSIGHT_BRANCH="$(infer_branch_from_script_checkout || true)"
    if [[ -n "${PITSIGHT_BRANCH}" ]]; then
      log "Inferred Git branch from local checkout: ${PITSIGHT_BRANCH}"
    else
      PITSIGHT_BRANCH="${DEFAULT_BRANCH}"
      log "Using default Git branch: ${PITSIGHT_BRANCH}"
    fi
  fi

  log "Cloning ${PITSIGHT_REPO_URL} branch ${PITSIGHT_BRANCH} into ${PITSIGHT_INSTALL_DIR}"
  git clone --branch "${PITSIGHT_BRANCH}" "${PITSIGHT_REPO_URL}" "${PITSIGHT_INSTALL_DIR}"
  chown -R "${PITSIGHT_SERVICE_USER}:${PITSIGHT_SERVICE_USER}" "${PITSIGHT_INSTALL_DIR}"
  write_install_marker
}

write_install_marker() {
  local marker_path="${PITSIGHT_INSTALL_DIR}/${INSTALL_MARKER_FILENAME}"
  cat >"${marker_path}" <<EOF
created_by=scripts/install-pi.sh
install_dir=${PITSIGHT_INSTALL_DIR}
env_file=${PITSIGHT_ENV_FILE}
data_dir=${PITSIGHT_DATA_DIR}
EOF
  chown "${PITSIGHT_SERVICE_USER}:${PITSIGHT_SERVICE_USER}" "${marker_path}"
}

prepare_runtime_dirs() {
  log "Preparing runtime directories"
  mkdir -p "${PITSIGHT_ENV_DIR}" "${PITSIGHT_DATA_DIR}" "${PITSIGHT_DATA_DIR}/dictator_raw"
  touch "${PITSIGHT_ENV_FILE}"
  touch "${PITSIGHT_DATA_DIR}/${DATA_MARKER_FILENAME}"
  chmod 0644 "${PITSIGHT_ENV_FILE}"
  chown -R "${PITSIGHT_SERVICE_USER}:${PITSIGHT_SERVICE_USER}" "${PITSIGHT_DATA_DIR}"
}

write_runtime_env() {
  log "Creating/updating ${PITSIGHT_ENV_FILE}"

  set_env_key PITSIGHT_PROVIDER_MODE "${PITSIGHT_PROVIDER_MODE_VALUE}" "${PITSIGHT_PROVIDER_MODE_FORCE}"
  set_env_key PITSIGHT_API_HOST "${PITSIGHT_API_HOST_VALUE}" "${PITSIGHT_API_HOST_FORCE}"
  set_env_key PITSIGHT_API_PORT "${PITSIGHT_API_PORT_VALUE}" "${PITSIGHT_API_PORT_FORCE}"
  set_env_key PITSIGHT_WEB_PORT "${PITSIGHT_WEB_PORT_VALUE}" "${PITSIGHT_WEB_PORT_FORCE}"
  set_env_key PITSIGHT_DASHBOARD_ROUTE "${PITSIGHT_DASHBOARD_ROUTE_VALUE}" "${PITSIGHT_DASHBOARD_ROUTE_FORCE}"
  set_env_key PITSIGHT_OBD_PORT "${PITSIGHT_OBD_PORT_VALUE}" "${PITSIGHT_OBD_PORT_FORCE}"
  set_env_key PITSIGHT_ALLOWED_ORIGINS "${PITSIGHT_ALLOWED_ORIGINS_VALUE}" "${PITSIGHT_ALLOWED_ORIGINS_FORCE}"
  set_env_key PITSIGHT_CORS_ORIGINS "${PITSIGHT_ALLOWED_ORIGINS_VALUE}" "${PITSIGHT_ALLOWED_ORIGINS_FORCE}"
  set_env_key PITSIGHT_DATABASE_PATH "${PITSIGHT_DATA_DIR}/pitsight.db" "0"
  set_env_key PITSIGHT_DICTATOR_RAW_CAPTURE_DIR "${PITSIGHT_DATA_DIR}/dictator_raw" "0"

  refresh_runtime_values_from_env_file
  set_env_key VITE_API_PORT "${PITSIGHT_API_PORT}" "${PITSIGHT_API_PORT_FORCE}"
  refresh_runtime_values_from_env_file
}

install_backend() {
  log "Installing backend Python dependencies"
  local api_dir="${PITSIGHT_INSTALL_DIR}/apps/api"
  run_as_service_user python3 -m venv "${api_dir}/.venv"
  run_as_service_user "${api_dir}/.venv/bin/python" -m pip install --upgrade pip setuptools wheel
  run_as_service_user "${api_dir}/.venv/bin/python" -m pip install -e "${api_dir}[obd2]"
}

install_frontend() {
  log "Installing frontend dependencies and building local dashboard"
  local web_dir="${PITSIGHT_INSTALL_DIR}/apps/web"
  run_as_service_user bash -lc "cd $(shell_quote "${web_dir}") && npm ci"
  run_as_service_user bash -lc "cd $(shell_quote "${web_dir}") && VITE_API_PORT=$(shell_quote "${PITSIGHT_API_PORT}") npm run build"
}

install_systemd_services() {
  log "Installing systemd services"
  local service_template_dir="${PITSIGHT_INSTALL_DIR}/deploy/systemd"
  local escaped_install_dir escaped_user escaped_npm_path
  escaped_install_dir="$(sed_escape_replacement "${PITSIGHT_INSTALL_DIR}")"
  escaped_user="$(sed_escape_replacement "${PITSIGHT_SERVICE_USER}")"
  escaped_npm_path="$(sed_escape_replacement "${PITSIGHT_NPM_PATH}")"

  sed -e "s|__PITSIGHT_INSTALL_DIR__|${escaped_install_dir}|g" \
    -e "s|__PITSIGHT_SERVICE_USER__|${escaped_user}|g" \
    "${service_template_dir}/pitsight-api.service" >/etc/systemd/system/pitsight-api.service

  sed -e "s|__PITSIGHT_INSTALL_DIR__|${escaped_install_dir}|g" \
    -e "s|__PITSIGHT_SERVICE_USER__|${escaped_user}|g" \
    -e "s|__PITSIGHT_NPM_PATH__|${escaped_npm_path}|g" \
    "${service_template_dir}/pitsight-web.service" >/etc/systemd/system/pitsight-web.service

  systemctl daemon-reload
  systemctl enable pitsight-api.service pitsight-web.service
  systemctl restart pitsight-api.service
  systemctl restart pitsight-web.service
}

configure_kiosk() {
  if [[ "${PITSIGHT_CONFIGURE_KIOSK}" != "1" ]]; then
    log "Skipping kiosk configuration because PITSIGHT_CONFIGURE_KIOSK=${PITSIGHT_CONFIGURE_KIOSK}"
    return
  fi

  log "Configuring desktop kiosk autostart if a desktop user is available"
  if ! PITSIGHT_WEB_PORT="${PITSIGHT_WEB_PORT}" \
    PITSIGHT_DASHBOARD_ROUTE="${PITSIGHT_DASHBOARD_ROUTE}" \
    bash "${PITSIGHT_INSTALL_DIR}/scripts/configure-pi-kiosk.sh"; then
    warn "Kiosk configuration did not complete. Services are still installed; see docs/pi-install.md."
  fi
}

print_summary() {
  local dashboard_url="http://localhost:${PITSIGHT_WEB_PORT}${PITSIGHT_DASHBOARD_ROUTE}"
  log "Install complete"
  cat <<EOF

PitSight is installed at:
  ${PITSIGHT_INSTALL_DIR}

Runtime env file:
  ${PITSIGHT_ENV_FILE}

Systemd services:
  pitsight-api.service
  pitsight-web.service

Dashboard URL on the Pi:
  ${dashboard_url}

Useful commands:
  systemctl status pitsight-api.service pitsight-web.service
  journalctl -u pitsight-api.service -f
  journalctl -u pitsight-web.service -f
  curl -fsS http://localhost:${PITSIGHT_API_PORT}/health

To switch to OBD2 later, edit ${PITSIGHT_ENV_FILE}:
  PITSIGHT_PROVIDER_MODE='obd2'
  PITSIGHT_OBD_PORT='/dev/ttyUSB0'

Then restart:
  systemctl restart pitsight-api.service

Reboot the Pi to verify the dashboard opens automatically in the desktop session.
EOF
}

main() {
  need_root

  PITSIGHT_REPO_URL_FORCE=0
  PITSIGHT_BRANCH_FORCE=0
  env_was_set PITSIGHT_REPO_URL && PITSIGHT_REPO_URL_FORCE=1
  env_was_set PITSIGHT_BRANCH && PITSIGHT_BRANCH_FORCE=1

  PITSIGHT_REPO_URL="${PITSIGHT_REPO_URL:-}"
  PITSIGHT_BRANCH="${PITSIGHT_BRANCH:-}"
  if [[ "${PITSIGHT_REPO_URL_FORCE}" -eq 1 && -z "${PITSIGHT_REPO_URL}" ]]; then
    fail "PITSIGHT_REPO_URL was provided but empty."
  fi
  if [[ "${PITSIGHT_BRANCH_FORCE}" -eq 1 && -z "${PITSIGHT_BRANCH}" ]]; then
    fail "PITSIGHT_BRANCH was provided but empty."
  fi
  PITSIGHT_INSTALL_DIR="${PITSIGHT_INSTALL_DIR:-${DEFAULT_INSTALL_DIR}}"
  PITSIGHT_ENV_DIR="${DEFAULT_ENV_DIR}"
  PITSIGHT_ENV_FILE="${DEFAULT_ENV_FILE}"
  PITSIGHT_DATA_DIR="${PITSIGHT_DATA_DIR:-${DEFAULT_DATA_DIR}}"
  PITSIGHT_SERVICE_USER="${PITSIGHT_SERVICE_USER:-${DEFAULT_SERVICE_USER}}"
  PITSIGHT_CONFIGURE_KIOSK="${PITSIGHT_CONFIGURE_KIOSK:-1}"
  PITSIGHT_NPM_PATH=""

  PITSIGHT_PROVIDER_MODE_FORCE=0
  PITSIGHT_API_HOST_FORCE=0
  PITSIGHT_API_PORT_FORCE=0
  PITSIGHT_WEB_PORT_FORCE=0
  PITSIGHT_DASHBOARD_ROUTE_FORCE=0
  PITSIGHT_OBD_PORT_FORCE=0
  PITSIGHT_ALLOWED_ORIGINS_FORCE=0

  env_was_set PITSIGHT_PROVIDER_MODE && PITSIGHT_PROVIDER_MODE_FORCE=1
  env_was_set PITSIGHT_API_HOST && PITSIGHT_API_HOST_FORCE=1
  env_was_set PITSIGHT_API_PORT && PITSIGHT_API_PORT_FORCE=1
  env_was_set PITSIGHT_WEB_PORT && PITSIGHT_WEB_PORT_FORCE=1
  env_was_set PITSIGHT_DASHBOARD_ROUTE && PITSIGHT_DASHBOARD_ROUTE_FORCE=1
  env_was_set PITSIGHT_OBD_PORT && PITSIGHT_OBD_PORT_FORCE=1
  if env_was_set PITSIGHT_ALLOWED_ORIGINS || env_was_set PITSIGHT_CORS_ORIGINS; then
    PITSIGHT_ALLOWED_ORIGINS_FORCE=1
  fi

  PITSIGHT_PROVIDER_MODE_VALUE="${PITSIGHT_PROVIDER_MODE:-simulator}"
  PITSIGHT_API_HOST_VALUE="${PITSIGHT_API_HOST:-0.0.0.0}"
  PITSIGHT_API_PORT_VALUE="${PITSIGHT_API_PORT:-8000}"
  PITSIGHT_WEB_PORT_VALUE="${PITSIGHT_WEB_PORT:-4173}"
  PITSIGHT_DASHBOARD_ROUTE_VALUE="${PITSIGHT_DASHBOARD_ROUTE:-/driver/lemons}"
  PITSIGHT_OBD_PORT_VALUE="${PITSIGHT_OBD_PORT:-}"
  PITSIGHT_ALLOWED_ORIGINS_VALUE="${PITSIGHT_ALLOWED_ORIGINS:-${PITSIGHT_CORS_ORIGINS:-*}}"

  detect_platform
  install_apt_packages
  validate_runtime_versions
  create_service_user
  clone_or_update_repo
  prepare_runtime_dirs
  write_runtime_env
  install_backend
  install_frontend
  install_systemd_services
  configure_kiosk
  print_summary
}

main "$@"
