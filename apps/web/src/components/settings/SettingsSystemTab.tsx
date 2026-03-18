import { SettingsSectionCard } from "./SettingsSectionCard";
import { SettingsNumberField, SettingsToggleField } from "./SettingsControls";
import type { SettingsSystemTabProps } from "./SettingsTabTypes";
import { formatDashboardMode, formatRelativeSyncStatus, getScopeBadges } from "../../utils/settingsSync";
import { titleCase } from "../../utils/format";

export function SettingsSystemTab({
  settings,
  draft,
  lastSavedLabel,
  lastSyncLabel,
  onWebChange,
}: SettingsSystemTabProps) {
  return (
    <div className="settings-tab-panels">
      <SettingsSectionCard
        title="Device Identity"
        description="Last reported device identity and peripheral inventory from the Pi side."
        badges={[
          formatRelativeSyncStatus(settings),
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
            <dt>Pending Shared Changes</dt>
            <dd>{settings.sync.pending_shared_changes ? "Yes" : "No"}</dd>
          </div>
        </dl>
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
