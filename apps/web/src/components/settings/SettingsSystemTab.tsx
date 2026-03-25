import { SettingsSectionCard } from "./SettingsSectionCard";
import { SettingsNumberField, SettingsSelectField, SettingsToggleField } from "./SettingsControls";
import type { SettingsSystemTabProps } from "./SettingsTabTypes";
import {
  formatActiveModeSource,
  formatDashboardMode,
  formatDeviceHealth,
  formatProviderRuntime,
  formatRelativeSyncStatus,
  formatSyncStatusBadge,
  getScopeBadges,
} from "../../utils/settingsSync";
import { formatTimestamp, titleCase } from "../../utils/format";

export function SettingsSystemTab({
  settings,
  draft,
  lastSavedLabel,
  lastSyncLabel,
  saving,
  onWebChange,
  onUpdateSyncTestControls,
  onApplyPendingToDevice,
}: SettingsSystemTabProps) {
  return (
    <div className="settings-tab-panels">
      <SettingsSectionCard
        title="Device Identity"
        description="Last reported device identity and peripheral inventory from the Pi side."
        badges={[
          formatRelativeSyncStatus(settings),
          formatDeviceHealth(settings.device_state.connection_health_summary),
          {
            label: settings.sync.device_online ? "Online" : "Offline",
            tone: settings.sync.device_online ? "normal" : "unavailable",
          },
        ]}
      >
        <dl className="settings-meta">
          <div className="settings-meta__row">
            <dt>Device ID</dt>
            <dd>{settings.device_state.device_id}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Device Label</dt>
            <dd>{settings.device_state.device_label}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Software Version</dt>
            <dd>{settings.device_state.software_version}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Hostname</dt>
            <dd>{settings.device_state.hostname}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Platform</dt>
            <dd>{settings.device_state.platform}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Last Seen</dt>
            <dd>{settings.device_state.last_seen_at ? formatTimestamp(settings.device_state.last_seen_at) : "--"}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Peripherals</dt>
            <dd>{settings.device_state.connected_peripherals.join(", ") || "--"}</dd>
          </div>
        </dl>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Sync State"
        description="Saved server settings, last known device state, and the currently applied dashboard mode are shown separately to avoid hidden duplication."
        badges={[
          formatRelativeSyncStatus(settings),
          formatSyncStatusBadge(settings.sync.shared_sync_state),
          formatSyncStatusBadge(settings.sync.device_local_sync_state),
          {
            label: settings.sync.pending_shared_changes ? "Pending Shared Changes" : "No Pending Shared Changes",
            tone: settings.sync.pending_shared_changes ? "warning" : "normal",
          },
        ]}
      >
        <dl className="settings-meta">
          <div className="settings-meta__row">
            <dt>Overall Sync State</dt>
            <dd>{titleCase(settings.sync.sync_state)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Last Save</dt>
            <dd>{lastSavedLabel}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Last Sync</dt>
            <dd>{lastSyncLabel}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Desired Dashboard</dt>
            <dd>{formatDashboardMode(draft.device_local.display.default_dashboard_mode)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Applied Dashboard</dt>
            <dd>{formatDashboardMode(settings.sync.applied_dashboard_mode)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Current Active Mode</dt>
            <dd>
              {formatDashboardMode(settings.device_state.current_dashboard_mode)} (
              {formatActiveModeSource(settings.device_state.current_dashboard_mode_source)})
            </dd>
          </div>
          <div className="settings-meta__row">
            <dt>Pending Shared Changes</dt>
            <dd>{settings.sync.pending_shared_changes ? "Yes" : "No"}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Pending Device Changes</dt>
            <dd>{settings.sync.pending_device_local_changes ? "Yes" : "No"}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Shared Sync</dt>
            <dd>{titleCase(settings.sync.shared_sync_state)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Device Sync</dt>
            <dd>{titleCase(settings.sync.device_local_sync_state)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Display Mode Sync</dt>
            <dd>{titleCase(settings.sync.display_mode_sync_state)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Connection Health</dt>
            <dd>{titleCase(settings.device_state.connection_health_summary)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Active Source</dt>
            <dd>{formatProviderRuntime(settings.device_state.active_source_provider)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Source Connection</dt>
            <dd>
              {settings.device_state.source_connection_state
                ? titleCase(settings.device_state.source_connection_state)
                : "--"}
            </dd>
          </div>
        </dl>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Flow Testing Controls"
        description="These controls expose deterministic pending, offline, and apply flows for end-to-end validation with the simulator backend."
        badges={[
          { label: "Flow Test", tone: "advisory" },
          formatRelativeSyncStatus(settings),
        ]}
      >
        <div className="settings-grid">
          <SettingsSelectField
            label="Device Sync Link"
            helper="Auto follows live source state. Force offline/online to validate pending and reconnect behavior."
            value={
              settings.sync_test.device_online_override === null
                ? "auto"
                : settings.sync_test.device_online_override
                  ? "online"
                  : "offline"
            }
            onChange={(value) =>
              void onUpdateSyncTestControls({
                ...settings.sync_test,
                device_online_override:
                  value === "auto" ? null : value === "online",
              })
            }
            options={[
              { value: "auto", label: "Auto" },
              { value: "online", label: "Force Online" },
              { value: "offline", label: "Force Offline" },
            ]}
          />
          <SettingsToggleField
            label="Auto-Apply Shared Settings"
            helper="When disabled, shared thresholds and units remain pending until you explicitly apply them."
            checked={settings.sync_test.auto_apply_shared}
            onChange={(value) =>
              void onUpdateSyncTestControls({
                ...settings.sync_test,
                auto_apply_shared: value,
              })
            }
          />
          <SettingsToggleField
            label="Auto-Apply Device Settings"
            helper="When disabled, requested device-local settings stay distinct from confirmed device state."
            checked={settings.sync_test.auto_apply_device_local}
            onChange={(value) =>
              void onUpdateSyncTestControls({
                ...settings.sync_test,
                auto_apply_device_local: value,
              })
            }
          />
        </div>

        <div className="settings-actions">
          <button
            className="settings-button"
            type="button"
            disabled={
              saving ||
              !settings.sync.device_online ||
              (!settings.sync.pending_shared_changes && !settings.sync.pending_device_local_changes)
            }
            onClick={() => void onApplyPendingToDevice()}
          >
            Apply Pending To Device
          </button>
        </div>

        <div className="settings-note">
          Live dashboards use effective confirmed shared settings. Save a change with auto-apply disabled or the device forced offline to verify pending behavior, then reconnect or apply to confirm it.
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Web Operator"
        description="These settings are web-only and do not need device ownership. They shape operator experience around the Pi."
        badges={getScopeBadges("web", settings)}
      >
        <div className="settings-grid">
          <SettingsNumberField
            label="Alert History Limit"
            helper="How many recent events the web UI should prefer when loading history."
            value={draft.web.alert_history_limit}
            onChange={(value) => onWebChange("alert_history_limit", value)}
          />
          <SettingsToggleField
            label="Diagnostics Panel"
            helper="Future-ready operator diagnostics visibility."
            checked={draft.web.diagnostics_panel_enabled}
            onChange={(value) => onWebChange("diagnostics_panel_enabled", value)}
          />
          <SettingsToggleField
            label="Highlight Unsynced Settings"
            helper="Keep sync-state badges visually prominent for operators."
            checked={draft.web.highlight_unsynced_settings}
            onChange={(value) => onWebChange("highlight_unsynced_settings", value)}
          />
        </div>
      </SettingsSectionCard>
    </div>
  );
}
