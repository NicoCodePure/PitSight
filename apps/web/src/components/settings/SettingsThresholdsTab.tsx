import { SettingsSectionCard } from "./SettingsSectionCard";
import type { SettingsThresholdsTabProps } from "./SettingsTabTypes";
import {
  DISPLAY_ONLY_THRESHOLD_GROUPS,
  THRESHOLD_GROUPS,
  getThresholdUnitLabel,
} from "../../utils/settingsForm";
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
          badges={[
            ...getScopeBadges("shared", settings),
            { label: "Backend Alerts", tone: "normal" },
          ]}
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
            These thresholds drive backend alert generation once applied. Driver and pit warning states follow the effective confirmed values, not just the saved request.
          </div>
        </SettingsSectionCard>
      ))}

      <SettingsSectionCard
        title="Stored Future Thresholds"
        description="These thresholds are kept in persisted settings for compatibility and future expansion, but they are not active backend alert sources in this build."
        badges={[
          ...getScopeBadges("shared", settings),
          { label: "Display Only", tone: "advisory" },
        ]}
      >
        <div className="settings-threshold-summary">
          {DISPLAY_ONLY_THRESHOLD_GROUPS.map((group) => (
            <article className="settings-threshold-summary__item" key={group.id}>
              <h3 className="settings-threshold-summary__title">{group.label}</h3>
              <p className="settings-threshold-summary__description">{group.description}</p>
              <p className="settings-threshold-summary__fields">
                {group.fields.map((field) => field.label).join(", ")}
              </p>
            </article>
          ))}
        </div>

        <div className="settings-note">
          Stored future thresholds do not currently generate backend alerts, driver warning banners, or pit alert timeline events. Runtime dashboards now show those metrics as diagnostics only.
        </div>
      </SettingsSectionCard>
    </div>
  );
}
