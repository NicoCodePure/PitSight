#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_REPO_URL="https://github.com/NicoCodePure/PitSight.git"
readonly DEFAULT_BRANCH="main"
readonly RAW_INSTALLER_URL="https://raw.githubusercontent.com/NicoCodePure/PitSight/main/scripts/install-pi.sh"

TEMP_DIR=""

log() {
  printf '[PitSight bootstrap] %s\n' "$*" >&2
}

fail() {
  printf '[PitSight bootstrap] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  local command_name="$1"
  command -v "${command_name}" >/dev/null 2>&1 || fail "Required command not found: ${command_name}"
}

script_dir() {
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd
}

cleanup() {
  if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
    rm -rf "${TEMP_DIR}"
  fi
}

find_or_fetch_installer() {
  local local_installer="$1/scripts/install-pi.sh"

  if [[ -f "${local_installer}" ]]; then
    log "Using local installer: ${local_installer}"
    printf '%s' "${local_installer}"
    return
  fi

  require_command curl
  require_command mktemp

  TEMP_DIR="$(mktemp -d)"
  local fetched_installer="${TEMP_DIR}/install-pi.sh"

  log "Local scripts/install-pi.sh was not found."
  log "Fetching main installer from ${RAW_INSTALLER_URL}"
  curl -fsSL "${RAW_INSTALLER_URL}" -o "${fetched_installer}"
  chmod 0755 "${fetched_installer}"
  printf '%s' "${fetched_installer}"
}

main() {
  trap cleanup EXIT

  PITSIGHT_REPO_URL="${PITSIGHT_REPO_URL:-${DEFAULT_REPO_URL}}"
  PITSIGHT_BRANCH="${PITSIGHT_BRANCH:-${DEFAULT_BRANCH}}"
  export PITSIGHT_REPO_URL PITSIGHT_BRANCH

  log "Repo URL: ${PITSIGHT_REPO_URL}"
  log "Branch: ${PITSIGHT_BRANCH}"

  local root_dir installer_path
  root_dir="$(script_dir)"
  installer_path="$(find_or_fetch_installer "${root_dir}")"

  log "Starting Raspberry Pi installer"
  bash "${installer_path}" "$@"
}

main "$@"
