import { SettingsSectionCard } from "./SettingsSectionCard";
import { SettingsSelectField } from "./SettingsControls";
import type { SettingsUnitsTabProps } from "./SettingsTabTypes";
import { getScopeBadges } from "../../utils/settingsSync";

export function SettingsUnitsTab({
  settings,
  draft,
  onSharedUnitsChange,
}: SettingsUnitsTabProps) {
  return (
    <div className="settings-tab-panels">
      <SettingsSectionCard
        title="Shared Units"
        description="These formatting preferences apply across the product family when the Pi is connected and synchronized."
        badges={getScopeBadges("shared", settings)}
      >
        <div className="settings-grid">
          <SettingsSelectField
            label="Pressure"
            helper="Affects displayed pressure and pressure-threshold editing."
            value={draft.shared.units.pressure_unit}
            onChange={(value) => onSharedUnitsChange("pressure_unit", value as typeof draft.shared.units.pressure_unit)}
            options={[
              { value: "bar", label: "bar" },
              { value: "psi", label: "psi" },
            ]}
          />
          <SettingsSelectField
            label="Speed"
            helper="Affects vehicle speed formatting."
            value={draft.shared.units.speed_unit}
            onChange={(value) => onSharedUnitsChange("speed_unit", value as typeof draft.shared.units.speed_unit)}
            options={[
              { value: "kph", label: "km/h" },
              { value: "mph", label: "mph" },
            ]}
          />
          <SettingsSelectField
            label="Distance"
            helper="Affects distance and range formatting when that data is available."
            value={draft.shared.units.distance_unit}
            onChange={(value) => onSharedUnitsChange("distance_unit", value as typeof draft.shared.units.distance_unit)}
            options={[
              { value: "km", label: "km" },
              { value: "miles", label: "miles" },
            ]}
          />
          <SettingsSelectField
            label="Temperature"
            helper="Affects temperature display and threshold editing."
            value={draft.shared.units.temperature_unit}
            onChange={(value) => onSharedUnitsChange("temperature_unit", value as typeof draft.shared.units.temperature_unit)}
            options={[
              { value: "celsius", label: "Celsius" },
              { value: "fahrenheit", label: "Fahrenheit" },
            ]}
          />
        </div>

        <div className="settings-note">
          Unit changes immediately update the local editing view. Driver and pit screens only switch once these values move into the effective confirmed shared settings.
        </div>
      </SettingsSectionCard>
    </div>
  );
}
