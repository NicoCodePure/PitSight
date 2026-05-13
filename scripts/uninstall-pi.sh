#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_INSTALL_DIR="/opt/pitsight"
readonly DEFAULT_ENV_FILE="/etc/pitsight/pitsight.env"
readonly DEFAULT_DATA_DIR="/var/lib/pitsight"
readonly INSTALL_MARKER_FILENAME=".pitsight-install"
readonly DATA_MARKER_FILENAME=".pitsight-data"

REMOVE_INSTALL_DIR=0
CLEAR_DATA=0

log() {
  printf '[PitSight uninstall] %s\n' "$*"
}

warn() {
  printf '[PitSight uninstall] WARNING: %s\n' "$*" >&2
}

fail() {
  printf '[PitSight uninstall] ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: sudo scripts/uninstall-pi.sh [--remove-install-dir] [--clear-data]

Default behavior:
  - Stops and disables PitSight systemd services.
  - Removes PitSight systemd service files.
  - Removes PitSight Chromium autostart files.
  - Leaves the install directory, env file, database, and user data in place.

Flags:
  --remove-install-dir  Remove PITSIGHT_INSTALL_DIR only when it has a PitSight install marker.
  --clear-data          Remove PitSight data only when it has a PitSight data marker.
  -h, --help            Show this help.
EOF
}

parse_args() {
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --remove-install-dir)
        REMOVE_INSTALL_DIR=1
        ;;
      --clear-data)
        CLEAR_DATA=1
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
    shift
  done
}

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    fail "Run with sudo, for example: sudo scripts/uninstall-pi.sh"
  fi
}

guard_path_for_recursive_remove() {
  local target="$1"
  case "${target}" in
    "" | "/" | "/home" | "/home/"* | "/root" | "/root/"* | "/etc" | "/etc/"* | "/opt" | "/usr" | "/usr/"* | "/var" | "/var/lib")
      fail "Refusing to recursively remove unsafe path: ${target}"
      ;;
  esac
}

resolve_existing_path() {
  local target="$1"
  [[ -e "${target}" ]] || return 1
  realpath -e -- "${target}"
}

guard_install_dir_for_remove() {
  local target="$1"
  local resolved
  if ! resolved="$(resolve_existing_path "${target}")"; then
    return 1
  fi

  guard_path_for_recursive_remove "${resolved}"
  [[ -f "${resolved}/${INSTALL_MARKER_FILENAME}" ]] || fail "Refusing to remove ${resolved}; missing PitSight install marker ${INSTALL_MARKER_FILENAME}."
  printf '%s' "${resolved}"
}

guard_data_dir_for_clear() {
  local target="$1"
  local resolved
  if ! resolved="$(resolve_existing_path "${target}")"; then
    return 1
  fi

  guard_path_for_recursive_remove "${resolved}"
  [[ -f "${resolved}/${DATA_MARKER_FILENAME}" ]] || fail "Refusing to clear ${resolved}; missing PitSight data marker ${DATA_MARKER_FILENAME}."
  printf '%s' "${resolved}"
}

stop_services() {
  local service_name
  for service_name in pitsight-web.service pitsight-api.service; do
    if systemctl list-unit-files "${service_name}" >/dev/null 2>&1; then
      log "Stopping and disabling ${service_name}"
      systemctl stop "${service_name}" >/dev/null 2>&1 || true
      systemctl disable "${service_name}" >/dev/null 2>&1 || true
    fi
  done

  rm -f /etc/systemd/system/pitsight-api.service /etc/systemd/system/pitsight-web.service
  systemctl daemon-reload
}

remove_kiosk_files() {
  local removed=0
  local desktop_file wrapper_file config_dir

  for desktop_file in /home/*/.config/autostart/pitsight-dashboard.desktop /root/.config/autostart/pitsight-dashboard.desktop; do
    [[ -e "${desktop_file}" ]] || continue
    log "Removing ${desktop_file}"
    rm -f "${desktop_file}"
    removed=1
  done

  for wrapper_file in /home/*/.config/pitsight/start-dashboard.sh /root/.config/pitsight/start-dashboard.sh; do
    [[ -e "${wrapper_file}" ]] || continue
    log "Removing ${wrapper_file}"
    rm -f "${wrapper_file}"
    removed=1
  done

  for config_dir in /home/*/.config/pitsight /root/.config/pitsight; do
    [[ -d "${config_dir}" ]] || continue
    rmdir "${config_dir}" >/dev/null 2>&1 || true
  done

  if [[ "${removed}" -eq 0 ]]; then
    log "No PitSight kiosk autostart files found"
  fi
}

remove_optional_paths() {
  PITSIGHT_INSTALL_DIR="${PITSIGHT_INSTALL_DIR:-${DEFAULT_INSTALL_DIR}}"
  PITSIGHT_ENV_FILE="${DEFAULT_ENV_FILE}"
  PITSIGHT_DATA_DIR="${PITSIGHT_DATA_DIR:-${DEFAULT_DATA_DIR}}"

  if [[ "${REMOVE_INSTALL_DIR}" -eq 1 ]]; then
    if [[ "${CLEAR_DATA}" -ne 1 && -e "${PITSIGHT_INSTALL_DIR}/data" ]]; then
      warn "Not removing ${PITSIGHT_INSTALL_DIR} because ${PITSIGHT_INSTALL_DIR}/data exists."
      warn "Rerun with --clear-data only if you intentionally want to delete PitSight data."
    else
      local resolved_install_dir
      if resolved_install_dir="$(guard_install_dir_for_remove "${PITSIGHT_INSTALL_DIR}")"; then
        log "Will remove install directory: ${resolved_install_dir}"
        rm -rf "${resolved_install_dir}"
        log "Removed install directory: ${resolved_install_dir}"
      else
        log "Install directory does not exist, nothing to remove: ${PITSIGHT_INSTALL_DIR}"
      fi
    fi
  else
    log "Left install directory in place: ${PITSIGHT_INSTALL_DIR}"
  fi

  if [[ "${CLEAR_DATA}" -eq 1 ]]; then
    local resolved_data_dir
    if resolved_data_dir="$(guard_data_dir_for_clear "${PITSIGHT_DATA_DIR}")"; then
      log "Will remove data directory: ${resolved_data_dir}"
      rm -rf "${resolved_data_dir}"
      log "Removed data directory: ${resolved_data_dir}"
    else
      log "Data directory does not exist, nothing to remove: ${PITSIGHT_DATA_DIR}"
    fi
  else
    log "Left data directory in place: ${PITSIGHT_DATA_DIR}"
  fi

  log "Left runtime env file in place: ${PITSIGHT_ENV_FILE}"
}

main() {
  parse_args "$@"
  need_root
  stop_services
  remove_kiosk_files
  remove_optional_paths
  log "Rollback complete"
}

main "$@"
