import { SettingsSectionCard } from "./SettingsSectionCard";
import type { SettingsThresholdsTabProps } from "./SettingsTabTypes";
import { THRESHOLD_GROUPS, getThresholdUnitLabel } from "../../utils/settingsForm";
import { getScopeBadges } from "../../utils/settingsSync";

export function SettingsThresholdsTab({
  settings,
  draft,
  thresholdInputs,
  fieldErrors,
  onThresholdInputChange,
}: SettingsThresholdsTabProps) {
  return (
    <div className="settings-tab-panels">
      {THRESHOLD_GROUPS.map((group) => (
        <SettingsSectionCard
          key={group.id}
          title={group.label}
          description={group.description}
          badges={getScopeBadges("shared", settings)}
        >
          <div className="settings-grid settings-grid--triple">
            {group.fields.map((field) => {
              const fieldError = fieldErrors[field.field] ?? null;
              return (
                <label className="settings-field" key={field.field}>
                  <span className="settings-field__label">{field.label}</span>
                  <span className="settings-field__helper">{field.helper}</span>
                  <div className="settings-field__input-row">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={thresholdInputs[field.field]}
                      onChange={(event) => onThresholdInputChange(field.field, event.target.value)}
                      aria-invalid={fieldError ? "true" : "false"}
                      className={fieldError ? "is-invalid" : ""}
                    />
                    <span className="settings-field__unit">
                      {getThresholdUnitLabel(field.field, draft.shared.units)}
                    </span>
                  </div>
                  {fieldError ? <span className="settings-field__error">{fieldError}</span> : null}
                </label>
              );
            })}
          </div>

          <div className="settings-note">
            Live warning behavior follows the effective confirmed thresholds, not just the saved request.
          </div>
        </SettingsSectionCard>
      ))}
    </div>
  );
}
