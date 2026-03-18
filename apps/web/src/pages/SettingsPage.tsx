import { useEffect, useMemo, useState } from "react";

import { DEFAULT_APP_SETTINGS } from "../types/appSettings";
import type { AppSettingsSnapshot, AppSettingsUpdate } from "../types/appSettings";
import type { SourceStatus } from "../types/telemetry";
import { formatTimestamp, titleCase } from "../utils/format";
import {
  buildPressureThresholdInputs,
  buildTemperatureThresholdInputs,
  buildThresholdInputState,
  hasUnsavedSettingsChanges,
  parseThresholdFieldValue,
  type ThresholdFieldName,
  type ThresholdInputState,
  validateThresholdInputs,
} from "../utils/settingsForm";
import { pressureUnitLabel } from "../utils/units";

interface SettingsPageProps {
  settings: AppSettingsSnapshot;
  defaults: AppSettingsUpdate;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onSave: (payload: AppSettingsUpdate) => Promise<void>;
  source?: SourceStatus | null;
  streamStatus: "connecting" | "connected" | "disconnected";
}

type StatusTone = "info" | "ok";

function buildDraft(settings: AppSettingsUpdate): AppSettingsUpdate {
  return {
    thresholds: { ...settings.thresholds },
    display: { ...settings.display },
  };
}

function statusClassName(tone: StatusTone): string {
  return tone === "ok" ? "settings-status settings-status--ok" : "settings-status settings-status--info";
}

export function SettingsPage({
  settings,
  defaults,
  loading,
  saving,
  error,
  onSave,
  source,
  streamStatus,
}: SettingsPageProps) {
  const [draft, setDraft] = useState<AppSettingsUpdate>(() => buildDraft(settings));
  const [thresholdInputs, setThresholdInputs] = useState<ThresholdInputState>(() =>
    buildThresholdInputState(settings.thresholds, settings.display),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(buildDraft(settings));
    setThresholdInputs(buildThresholdInputState(settings.thresholds, settings.display));
  }, [settings]);

  const validation = useMemo(
    () => validateThresholdInputs(thresholdInputs, draft.display),
    [thresholdInputs, draft.display],
  );
  const isDirty = useMemo(
    () => hasUnsavedSettingsChanges(thresholdInputs, draft.display, settings),
    [draft.display, settings, thresholdInputs],
  );
  const canSave = !loading && !saving && isDirty && validation.summary === null;
  const temperatureEditLabel =
    draft.display.temperature_unit === "fahrenheit" ? "deg F" : "deg C";
  const pressureEditLabel = pressureUnitLabel(draft.display.pressure_unit);
  const lastSavedLabel =
    loading && settings.updated_at === DEFAULT_APP_SETTINGS.updated_at
      ? "Loading saved settings..."
      : settings.updated_at === DEFAULT_APP_SETTINGS.updated_at
        ? "Using local defaults"
        : formatTimestamp(settings.updated_at);
  const sourceStatus = source?.connection_state ? titleCase(source.connection_state) : "Unavailable";
  const streamStatusLabel = titleCase(streamStatus);

  const clearTransientMessages = () => {
    setStatusMessage(null);
    setSaveError(null);
  };

  const applyDraft = (nextDraft: AppSettingsUpdate) => {
    setDraft(buildDraft(nextDraft));
    setThresholdInputs(buildThresholdInputState(nextDraft.thresholds, nextDraft.display));
  };

  const updateThresholdInput = (name: ThresholdFieldName, value: string) => {
    clearTransientMessages();
    setThresholdInputs((current) => ({
      ...current,
      [name]: value,
    }));

    const nextValue = parseThresholdFieldValue(name, value, draft.display);
    if (nextValue === null) {
      return;
    }

    setDraft((current) => ({
      ...current,
      thresholds: {
        ...current.thresholds,
        [name]: nextValue,
      },
    }));
  };

  const updateDisplay = <K extends keyof AppSettingsUpdate["display"]>(
    name: K,
    value: AppSettingsUpdate["display"][K],
  ) => {
    clearTransientMessages();
    setDraft((current) => {
      const nextDisplay = {
        ...current.display,
        [name]: value,
      } as AppSettingsUpdate["display"];

      if (name === "temperature_unit") {
        setThresholdInputs((currentInputs) => ({
          ...currentInputs,
          ...buildTemperatureThresholdInputs(current.thresholds, nextDisplay.temperature_unit),
        }));
      }

      if (name === "pressure_unit") {
        setThresholdInputs((currentInputs) => ({
          ...currentInputs,
          ...buildPressureThresholdInputs(current.thresholds, nextDisplay.pressure_unit),
        }));
      }

      return {
        ...current,
        display: nextDisplay,
      };
    });
  };

  const handleCancel = () => {
    applyDraft(settings);
    setStatusTone("info");
    setStatusMessage("Unsaved changes discarded. The form now matches the last saved settings.");
    setSaveError(null);
  };

  const handleResetToDefaults = () => {
    applyDraft(defaults);
    setStatusTone("info");
    setStatusMessage("Configured defaults loaded into the form. Save to apply them.");
    setSaveError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setSaveError(null);

    if (validation.summary !== null) {
      setSaveError(validation.summary ?? "Fix highlighted threshold values before saving.");
      return;
    }

    try {
      await onSave({
        thresholds: draft.thresholds,
        display: draft.display,
      });
      setStatusTone("ok");
      setStatusMessage("Settings saved. New warning limits apply to incoming telemetry immediately.");
    } catch (nextError) {
      setSaveError(
        nextError instanceof Error
          ? nextError.message
          : "Could not save settings. Check backend status and try again.",
      );
    }
  };

  const renderThresholdInput = ({
    field,
    label,
    helper,
    unitLabel,
  }: {
    field: ThresholdFieldName;
    label: string;
    helper: string;
    unitLabel: string;
  }) => {
    const fieldError = validation.fieldErrors[field] ?? null;
    return (
      <label className="settings-field">
        <span className="settings-field__label">{label}</span>
        <span className="settings-field__helper">{helper}</span>
        <div className="settings-field__input-row">
          <input
            type="text"
            inputMode="decimal"
            value={thresholdInputs[field]}
            onChange={(event) => updateThresholdInput(field, event.target.value)}
            aria-invalid={fieldError ? "true" : "false"}
            className={fieldError ? "is-invalid" : ""}
          />
          <span className="settings-field__unit">{unitLabel}</span>
        </div>
        {fieldError ? <span className="settings-field__error">{fieldError}</span> : null}
      </label>
    );
  };

  return (
    <main className="screen screen--settings">
      <header className="screen__header screen__header--pit">
        <div>
          <p className="screen__eyebrow">PitSight</p>
          <h1 className="screen__title">Settings</h1>
        </div>
        <div className="session-summary">
          <span>Last saved {lastSavedLabel}</span>
          <span>Thresholds are edited in {temperatureEditLabel} and {pressureEditLabel}</span>
        </div>
      </header>

      <section className="panel settings-panel">
        <div className="panel__title">Configuration</div>
        <div className="settings-summary">
          <p>Set the in-car display defaults, preferred units, and the thresholds that raise warnings.</p>
          <p>Changing units only changes the local editing view until you explicitly save.</p>
        </div>

        {loading ? <div className="settings-status">Loading settings from backend...</div> : null}
        {saving ? <div className="settings-status">Saving changes to backend...</div> : null}
        {error ? <div className="settings-status settings-status--warning">{error}</div> : null}
        {isDirty ? (
          <div className="settings-status settings-status--info">
            Unsaved changes in progress. Cancel restores the last saved settings. Reset loads configured defaults into the form only.
          </div>
        ) : null}
        {validation.summary ? (
          <div className="settings-status settings-status--warning">
            {validation.summary}
          </div>
        ) : null}
        {saveError ? <div className="settings-status settings-status--warning">{saveError}</div> : null}
        {statusMessage ? <div className={statusClassName(statusTone)}>{statusMessage}</div> : null}

        <form className="settings-form" onSubmit={handleSubmit}>
          <div className="settings-sections">
            <section className="settings-section">
              <div className="settings-section__header">
                <h2 className="settings-section__title">Driver display</h2>
                <p className="settings-section__description">
                  Choose which in-car screen opens by default when the app starts.
                </p>
              </div>

              <div className="settings-grid settings-grid--single">
                <label className="settings-field">
                  <span className="settings-field__label">Default driver mode</span>
                  <span className="settings-field__helper">
                    Normal shows timing and RPM. Lemons stays minimal and hides timing values.
                  </span>
                  <select
                    value={draft.display.default_driver_mode}
                    onChange={(event) =>
                      updateDisplay(
                        "default_driver_mode",
                        event.target.value as AppSettingsUpdate["display"]["default_driver_mode"],
                      )
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="lemons">Lemons</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section__header">
                <h2 className="settings-section__title">Units</h2>
                <p className="settings-section__description">
                  These units drive both on-screen formatting and threshold editing below.
                </p>
              </div>

              <div className="settings-grid">
                <label className="settings-field">
                  <span className="settings-field__label">Speed unit</span>
                  <span className="settings-field__helper">
                    Used for live dashboard speed displays only.
                  </span>
                  <select
                    value={draft.display.speed_unit}
                    onChange={(event) =>
                      updateDisplay(
                        "speed_unit",
                        event.target.value as AppSettingsUpdate["display"]["speed_unit"],
                      )
                    }
                  >
                    <option value="kph">kph</option>
                    <option value="mph">mph</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span className="settings-field__label">Temperature unit</span>
                  <span className="settings-field__helper">
                    Also controls how water and oil temperature thresholds are edited.
                  </span>
                  <select
                    value={draft.display.temperature_unit}
                    onChange={(event) =>
                      updateDisplay(
                        "temperature_unit",
                        event.target.value as AppSettingsUpdate["display"]["temperature_unit"],
                      )
                    }
                  >
                    <option value="celsius">Celsius</option>
                    <option value="fahrenheit">Fahrenheit</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span className="settings-field__label">Pressure unit</span>
                  <span className="settings-field__helper">
                    Also controls how oil pressure thresholds are edited.
                  </span>
                  <select
                    value={draft.display.pressure_unit}
                    onChange={(event) =>
                      updateDisplay(
                        "pressure_unit",
                        event.target.value as AppSettingsUpdate["display"]["pressure_unit"],
                      )
                    }
                  >
                    <option value="bar">bar</option>
                    <option value="psi">psi</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="settings-section settings-section--wide">
              <div className="settings-section__header">
                <h2 className="settings-section__title">Warning thresholds</h2>
                <p className="settings-section__description">
                  Warning thresholds raise caution alerts. Critical thresholds escalate the banner and override the normal driver display.
                </p>
              </div>

              <div className="settings-note">
                Editing units: temperature in {temperatureEditLabel}, pressure in {pressureEditLabel}. Saved internally as C and bar after you click Save.
              </div>

              <div className="settings-grid">
                {renderThresholdInput({
                  field: "oil_pressure_warning_bar",
                  label: "Oil pressure warning",
                  helper: "Trigger when oil pressure drops below this value.",
                  unitLabel: pressureEditLabel,
                })}
                {renderThresholdInput({
                  field: "oil_pressure_critical_bar",
                  label: "Oil pressure critical",
                  helper: "Must stay lower than the warning threshold.",
                  unitLabel: pressureEditLabel,
                })}
                {renderThresholdInput({
                  field: "water_temp_warning_c",
                  label: "Water temp warning",
                  helper: "Trigger when coolant temperature rises above this value.",
                  unitLabel: temperatureEditLabel,
                })}
                {renderThresholdInput({
                  field: "water_temp_critical_c",
                  label: "Water temp critical",
                  helper: "Must stay higher than the warning threshold.",
                  unitLabel: temperatureEditLabel,
                })}
                {renderThresholdInput({
                  field: "oil_temp_warning_c",
                  label: "Oil temp warning",
                  helper: "Trigger when oil temperature rises above this value.",
                  unitLabel: temperatureEditLabel,
                })}
                {renderThresholdInput({
                  field: "oil_temp_critical_c",
                  label: "Oil temp critical",
                  helper: "Must stay higher than the warning threshold.",
                  unitLabel: temperatureEditLabel,
                })}
                {renderThresholdInput({
                  field: "fuel_level_warning_percent",
                  label: "Low fuel warning",
                  helper: "Used only when fuel level telemetry is available.",
                  unitLabel: "%",
                })}
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section__header">
                <h2 className="settings-section__title">System/source</h2>
                <p className="settings-section__description">
                  Read-only source status for the currently connected telemetry provider.
                </p>
              </div>

              <dl className="settings-meta">
                <div className="settings-meta__row">
                  <dt>Provider</dt>
                  <dd>{source?.provider ?? "Unavailable"}</dd>
                </div>
                <div className="settings-meta__row">
                  <dt>Transport</dt>
                  <dd>{source?.transport ?? "Unavailable"}</dd>
                </div>
                <div className="settings-meta__row">
                  <dt>Protocol</dt>
                  <dd>{source?.protocol ?? "Unavailable"}</dd>
                </div>
                <div className="settings-meta__row">
                  <dt>Source connection</dt>
                  <dd>{sourceStatus}</dd>
                </div>
                <div className="settings-meta__row">
                  <dt>WebSocket stream</dt>
                  <dd>{streamStatusLabel}</dd>
                </div>
                <div className="settings-meta__row">
                  <dt>Raw capture</dt>
                  <dd>{source?.raw_capture_enabled ? "Enabled" : "Off"}</dd>
                </div>
              </dl>

              <div className="settings-note">
                Simulator is the active MVP source. OBD2 and Dictator providers remain stubbed for now.
              </div>
            </section>
          </div>

          <div className="settings-actions">
            <button className="settings-button settings-button--secondary" type="button" disabled={!isDirty || saving} onClick={handleCancel}>
              Cancel
            </button>
            <button className="settings-button settings-button--secondary" type="button" disabled={saving} onClick={handleResetToDefaults}>
              Reset To Defaults
            </button>
            <button className="settings-button" type="submit" disabled={!canSave}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
