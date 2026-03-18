import { SettingsSectionCard } from "./SettingsSectionCard";
import { SettingsLiveCard, SettingsSelectField, SettingsToggleField } from "./SettingsControls";
import type { SettingsDisplayTabProps } from "./SettingsTabTypes";
import {
  formatDashboardMode,
  formatSyncStatusBadge,
  getScopeBadges,
} from "../../utils/settingsSync";

function dashboardModeRouteHint(mode: string): string {
  switch (mode) {
    case "driver_normal":
      return "/driver/normal";
    case "driver_lemons":
      return "/driver/lemons";
    case "pit_dashboard":
      return "/pit";
    default:
      return "Uses the last confirmed mode once that flow is added.";
  }
}

export function SettingsDisplayTab({
  settings,
  draft,
  onSharedDisplayChange,
  onDeviceDisplayChange,
}: SettingsDisplayTabProps) {
  return (
    <div className="settings-tab-panels">
      <SettingsSectionCard
        title="Default Dashboard Mode"
        description="This controls which dashboard the Pi should show by default. The desired mode is device-applicable, but the Pi must confirm the actually running mode."
        badges={[
          ...getScopeBadges("device", settings),
          formatSyncStatusBadge(settings.sync.display_mode_sync_state),
        ]}
      >
        <div className="settings-grid">
          <SettingsSelectField
            label="Default Dashboard Mode"
            helper="Select the dashboard the Pi should load by default."
            value={draft.device_local.display.default_dashboard_mode}
            onChange={(value) => onDeviceDisplayChange("default_dashboard_mode", value as typeof draft.device_local.display.default_dashboard_mode)}
            options={[
              { value: "driver_lemons", label: "Driver Lemons" },
              { value: "driver_normal", label: "Driver Normal" },
              { value: "pit_dashboard", label: "Pit Dashboard" },
              { value: "last_used", label: "Last Used" },
            ]}
          />
          <SettingsLiveCard
            label="Requested Default"
            value={formatDashboardMode(draft.device_local.display.default_dashboard_mode)}
            detail="Saved web-side request for the Pi default dashboard."
          />
          <SettingsLiveCard
            label="Confirmed Device Default"
            value={formatDashboardMode(settings.effective.device_local.display.default_dashboard_mode)}
            detail="Last device-confirmed default dashboard mode."
          />
          <SettingsLiveCard
            label="Current Active Mode"
            value={formatDashboardMode(settings.sync.applied_dashboard_mode)}
            detail={dashboardModeRouteHint(settings.sync.applied_dashboard_mode)}
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Driver Display Behavior"
        description="These are shared preferences that shape the overall in-car experience once a connected device synchronizes."
        badges={getScopeBadges("shared", settings)}
      >
        <div className="settings-grid">
          <SettingsSelectField
            label="Preferred Driver Theme"
            helper="Shared display preference used when the chosen dashboard supports driver variants."
            value={draft.shared.display.preferred_driver_mode}
            onChange={(value) => onSharedDisplayChange("preferred_driver_mode", value as typeof draft.shared.display.preferred_driver_mode)}
            options={[
              { value: "normal", label: "Driver Normal" },
              { value: "lemons", label: "Driver Lemons" },
            ]}
          />
          <SettingsToggleField
            label="Show Secondary Alerts"
            helper="Allow secondary warning chips in addition to the primary alert strip."
            checked={draft.shared.display.show_secondary_alerts}
            onChange={(value) => onSharedDisplayChange("show_secondary_alerts", value)}
          />
          <SettingsToggleField
            label="Keep Screen Awake"
            helper="Request an always-on driver screen where the Pi build supports it."
            checked={draft.shared.display.keep_screen_awake}
            onChange={(value) => onSharedDisplayChange("keep_screen_awake", value)}
          />
        </div>
      </SettingsSectionCard>
    </div>
  );
}
