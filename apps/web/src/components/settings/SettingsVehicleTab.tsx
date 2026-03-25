import { SettingsSectionCard } from "./SettingsSectionCard";
import { SettingsSelectField, SettingsTextField } from "./SettingsControls";
import type { SettingsVehicleTabProps } from "./SettingsTabTypes";
import {
  formatProviderPreference,
  formatProviderRuntime,
  formatProviderSelectionBadge,
  formatProviderSelectionState,
  getScopeBadges,
} from "../../utils/settingsSync";
import { titleCase } from "../../utils/format";

export function SettingsVehicleTab({
  settings,
  draft,
  source,
  onSharedRootChange,
  onVehicleChange,
}: SettingsVehicleTabProps) {
  const sourceState = source?.connection_state ? titleCase(source.connection_state) : "Unavailable";
  const providerRuntime = settings.provider_runtime;

  return (
    <div className="settings-tab-panels">
      <SettingsSectionCard
        title="Telemetry Source Preference"
        description="Telemetry provider selection is explicit at backend startup. Save a new preferred source at any time, but a backend or Pi restart is required before the running provider actually changes."
        badges={[
          ...getScopeBadges("shared", settings),
          formatProviderSelectionBadge(providerRuntime),
          {
            label: providerRuntime.restart_required ? "Restart Needed" : "No Restart Needed",
            tone: providerRuntime.restart_required ? "warning" : "normal",
          },
        ]}
      >
        <div className="settings-grid settings-grid--single">
          <SettingsSelectField
            label="Telemetry Source"
            helper="This saves the requested provider for the next backend start. Live provider switching is intentionally not performed in this build."
            value={draft.shared.telemetry_source_preference}
            onChange={(value) => onSharedRootChange("telemetry_source_preference", value as typeof draft.shared.telemetry_source_preference)}
            options={[
              { value: "simulator", label: "Simulator" },
              { value: "obd2", label: "OBD2" },
              { value: "dictator", label: "Dictator" },
            ]}
          />
        </div>

        <dl className="settings-meta">
          <div className="settings-meta__row">
            <dt>Requested Source</dt>
            <dd>{formatProviderPreference(draft.shared.telemetry_source_preference)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Boot Provider</dt>
            <dd>{formatProviderPreference(providerRuntime.boot_provider)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Active Provider</dt>
            <dd>{formatProviderRuntime(settings.device_state.active_source_provider)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Selection State</dt>
            <dd>{formatProviderSelectionState(providerRuntime.selection_state)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Connection</dt>
            <dd>{sourceState}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Restart Required</dt>
            <dd>{providerRuntime.restart_required ? "Yes" : "No"}</dd>
          </div>
        </dl>

        <div className="settings-note">{providerRuntime.detail}</div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Vehicle / ECU Transport"
        description="These hardware and transport settings stay device-owned because the Pi owns the actual interfaces and peripherals."
        badges={getScopeBadges("device", settings)}
      >
        <div className="settings-grid">
          <SettingsTextField
            label="ECU Type"
            helper="Current or intended ECU family label for operator reference."
            value={draft.device_local.vehicle.ecu_type}
            onChange={(value) => onVehicleChange("ecu_type", value)}
          />
          <SettingsSelectField
            label="ECU Transport Method"
            helper="The physical or logical path the Pi should use for ECU telemetry."
            value={draft.device_local.vehicle.ecu_transport_method}
            onChange={(value) => onVehicleChange("ecu_transport_method", value)}
            options={[
              { value: "simulator", label: "Simulator" },
              { value: "obd2_bluetooth", label: "OBD2 Bluetooth" },
              { value: "usb_serial", label: "USB Serial" },
              { value: "dictator_usb", label: "Dictator USB" },
              { value: "dictator_wireless", label: "Dictator Wireless" },
            ]}
          />
          <SettingsTextField
            label="USB / Serial Device"
            helper="Last known serial path or AUTO for auto-detection."
            value={draft.device_local.vehicle.usb_serial_device}
            onChange={(value) => onVehicleChange("usb_serial_device", value)}
          />
          <SettingsSelectField
            label="Dictator Connection"
            helper="Future-ready selector for Dictator transport mode."
            value={draft.device_local.vehicle.dictator_connection_method}
            onChange={(value) => onVehicleChange("dictator_connection_method", value)}
            options={[
              { value: "usb", label: "USB" },
              { value: "wireless", label: "Wireless" },
            ]}
          />
        </div>

        <div className="settings-note">
          Simulator remains the safe development/demo provider. OBD2 and Dictator are configured by startup mode, then report connected, degraded, disconnected, or fault state through live source status. Dictator wireless remains a future slice.
        </div>
      </SettingsSectionCard>
    </div>
  );
}
