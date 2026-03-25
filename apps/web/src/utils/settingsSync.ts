import type {
  ActiveDashboardModeSource,
  AppSettingsSnapshot,
  DashboardMode,
  DeviceConnectionHealth,
  ProviderName,
  ProviderRuntimeSnapshot,
  ProviderSelectionState,
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

const PROVIDER_SELECTION_LABELS: Record<ProviderSelectionState, string> = {
  active: "Active",
  restart_required: "Restart Required",
  invalid: "Invalid",
};

const PROVIDER_SELECTION_TONES: Record<ProviderSelectionState, SettingsBadgeTone> = {
  active: "normal",
  restart_required: "warning",
  invalid: "critical",
};

const DEVICE_HEALTH_LABELS: Record<DeviceConnectionHealth, string> = {
  nominal: "Nominal",
  degraded: "Degraded",
  fault: "Fault",
  offline: "Offline",
};

const DEVICE_HEALTH_TONES: Record<DeviceConnectionHealth, SettingsBadgeTone> = {
  nominal: "normal",
  degraded: "warning",
  fault: "critical",
  offline: "unavailable",
};

const MODE_SOURCE_LABELS: Record<ActiveDashboardModeSource, string> = {
  reported: "Reported",
  applied_default: "Applied Default",
  last_known: "Last Known",
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

export function formatProviderRuntime(provider: ProviderName | null): string {
  return provider ? PROVIDER_LABELS[provider] : "Unavailable";
}

export function formatProviderSelectionState(
  state: ProviderSelectionState,
): string {
  return PROVIDER_SELECTION_LABELS[state];
}

export function formatProviderSelectionBadge(
  providerRuntime: ProviderRuntimeSnapshot,
): SettingsStatusBadge {
  return {
    label: PROVIDER_SELECTION_LABELS[providerRuntime.selection_state],
    tone: PROVIDER_SELECTION_TONES[providerRuntime.selection_state],
  };
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

export function formatDeviceHealth(health: DeviceConnectionHealth): SettingsStatusBadge {
  return {
    label: DEVICE_HEALTH_LABELS[health],
    tone: DEVICE_HEALTH_TONES[health],
  };
}

export function formatActiveModeSource(source: ActiveDashboardModeSource): string {
  return MODE_SOURCE_LABELS[source];
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
