import { SettingsSectionCard } from "./SettingsSectionCard";
import { SettingsSelectField, SettingsTextField, SettingsToggleField } from "./SettingsControls";
import type { SettingsConnectionsTabProps } from "./SettingsTabTypes";
import { getScopeBadges } from "../../utils/settingsSync";
import { titleCase } from "../../utils/format";

export function SettingsConnectionsTab({
  settings,
  draft,
  source,
  streamStatus,
  onConnectionChange,
}: SettingsConnectionsTabProps) {
  const sourceState = source?.connection_state ? titleCase(source.connection_state) : "Unavailable";

  return (
    <div className="settings-tab-panels">
      <SettingsSectionCard
        title="Network Modes"
        description="These are device-owned transport settings. They describe how the Pi is expected to reach telemetry and the web control surface."
        badges={getScopeBadges("device", settings)}
      >
        <div className="settings-grid">
          <SettingsSelectField
            label="Wi-Fi Mode"
            helper="Client joins an existing network. Hotspot keeps the Pi autonomous. Off disables Wi-Fi."
            value={draft.device_local.connections.wifi_mode}
            onChange={(value) => onConnectionChange("wifi_mode", value)}
            options={[
              { value: "client", label: "Client" },
              { value: "hotspot", label: "Hotspot" },
              { value: "off", label: "Off" },
            ]}
          />
          <SettingsTextField
            label="Wi-Fi SSID"
            helper="Last known or intended network name for the Pi."
            value={draft.device_local.connections.wifi_ssid}
            placeholder="PitSight Wi-Fi"
            onChange={(value) => onConnectionChange("wifi_ssid", value)}
          />
          <SettingsToggleField
            label="Ethernet / Direct Link"
            helper="Use a direct wired network path when available."
            checked={draft.device_local.connections.ethernet_direct_enabled}
            onChange={(value) => onConnectionChange("ethernet_direct_enabled", value)}
          />
          <SettingsToggleField
            label="Device Data / Direct Internet"
            helper="Allow device-managed outbound data when supported by the Pi image."
            checked={draft.device_local.connections.direct_data_mode_enabled}
            onChange={(value) => onConnectionChange("direct_data_mode_enabled", value)}
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Bluetooth / OBD Pairing"
        description="Bluetooth state remains device-owned. The web UI can stage or review configuration, but the Pi confirms what is actually paired."
        badges={getScopeBadges("device", settings)}
      >
        <div className="settings-grid">
          <SettingsToggleField
            label="Bluetooth Enabled"
            helper="Required for Bluetooth OBD2 dongles once that integration is active."
            checked={draft.device_local.connections.bluetooth_enabled}
            onChange={(value) => onConnectionChange("bluetooth_enabled", value)}
          />
          <SettingsTextField
            label="OBD Pairing Name"
            helper="Last known dongle or target adapter label."
            value={draft.device_local.connections.bluetooth_obd_pairing_name}
            placeholder="OBDLink MX+"
            onChange={(value) => onConnectionChange("bluetooth_obd_pairing_name", value)}
          />
        </div>

        <dl className="settings-meta">
          <div className="settings-meta__row">
            <dt>Pairing State</dt>
            <dd>{titleCase(draft.device_local.connections.bluetooth_pairing_state)}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Source Link</dt>
            <dd>{sourceState}</dd>
          </div>
          <div className="settings-meta__row">
            <dt>Stream State</dt>
            <dd>{titleCase(streamStatus)}</dd>
          </div>
        </dl>

        <div className="settings-note">
          Live connection testing is future-ready here. The current simulator build exposes status only.
        </div>
      </SettingsSectionCard>
    </div>
  );
}
