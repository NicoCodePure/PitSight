import type {
  AppSettingsSnapshot,
  DashboardMode,
  ProviderName,
  SyncState,
} from "../types/appSettings";

export type SettingsOwnershipScope = "device" | "shared" | "web";
export type SettingsBadgeTone = "normal" | "advisory" | "warning" | "critical" | "unavailable";

export interface SettingsStatusBadge {
  label: string;
  tone: SettingsBadgeTone;
}

const DASHBOARD_MODE_LABELS: Record<DashboardMode, string> = {
  driver_normal: "Driver Normal",
  driver_lemons: "Driver Lemons",
  pit_dashboard: "Pit Dashboard",
  last_used: "Last Used",
};

const PROVIDER_LABELS: Record<ProviderName, string> = {
  simulator: "Simulator",
  obd2: "OBD2",
  dictator: "Dictator",
};

const SYNC_LABELS: Record<SyncState, string> = {
  synced: "Synced",
  pending_sync: "Pending Sync",
  device_offline: "Device Offline",
  local_device_setting: "Local Device Setting",
  awaiting_apply_confirmation: "Awaiting Apply Confirmation",
};

const SYNC_TONES: Record<SyncState, SettingsBadgeTone> = {
  synced: "normal",
  pending_sync: "warning",
  device_offline: "unavailable",
  local_device_setting: "advisory",
  awaiting_apply_confirmation: "warning",
};

export function formatDashboardMode(mode: DashboardMode): string {
  return DASHBOARD_MODE_LABELS[mode];
}

export function formatProviderPreference(provider: ProviderName): string {
  return PROVIDER_LABELS[provider];
}

export function formatSyncState(syncState: SyncState): string {
  return SYNC_LABELS[syncState];
}

export function formatRelativeSyncStatus(settings: AppSettingsSnapshot): SettingsStatusBadge {
  return {
    label: formatSyncState(settings.sync.sync_state),
    tone: SYNC_TONES[settings.sync.sync_state],
  };
}

export function formatSyncStatusBadge(syncState: SyncState): SettingsStatusBadge {
  return {
    label: formatSyncState(syncState),
    tone: SYNC_TONES[syncState],
  };
}

export function getScopeBadges(
  scope: SettingsOwnershipScope,
  settings: AppSettingsSnapshot,
): SettingsStatusBadge[] {
  if (scope === "web") {
    return [
      { label: "Web Only", tone: "advisory" },
      { label: "Immediate", tone: "normal" },
    ];
  }

  if (scope === "shared") {
    return [
      { label: "Shared", tone: "normal" },
      formatSyncStatusBadge(settings.sync.shared_sync_state),
    ];
  }

  return [
    { label: "Local Device", tone: "advisory" },
    formatSyncStatusBadge(settings.sync.device_local_sync_state),
  ];
}
