import { SettingsSectionCard } from "./SettingsSectionCard";
import { SettingsSelectField, SettingsTextField } from "./SettingsControls";
import type { SettingsVehicleTabProps } from "./SettingsTabTypes";
import { formatProviderPreference, getScopeBadges } from "../../utils/settingsSync";
import { titleCase } from "../../utils/format";

export function SettingsVehicleTab({
  settings,
  draft,
  source,
  onSharedRootChange,
  onVehicleChange,
}: SettingsVehicleTabProps) {
  const sourceState = source?.connection_state ? titleCase(source.connection_state) : "Unavailable";

  return (
    <div className="settings-tab-panels">
      <SettingsSectionCard
        title="Telemetry Source Preference"
        description="This is a shared preference. When the Pi is connected, the server-side preference wins for supported shared source modes."
        badges={getScopeBadges("shared", settings)}
      >
        <div className="settings-grid settings-grid--single">
          <SettingsSelectField
            label="Telemetry Source"
            helper="Simulator is live now. OBD2 and Dictator remain future-ready wiring targets."
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
            <dt>Preferred Source</dt>
            <dd>{formatProviderPreference(draft.shared.telemetry_source_preference)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Live Provider</dt>
            <dd>{source?.provider ? formatProviderPreference(source.provider) : "Unavailable"}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Connection</dt>
            <dd>{sourceState}</dd>
          </div>
        </dl>
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
          ECU test actions will plug into provider-specific services later. The current MVP stays deterministic with saved intent plus live source status.
        </div>
      </SettingsSectionCard>
    </div>
  );
}
