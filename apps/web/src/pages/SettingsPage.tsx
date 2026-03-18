import { useEffect, useState } from "react";

import type { AppSettingsSnapshot, AppSettingsUpdate } from "../types/appSettings";
import { formatTimestamp } from "../utils/format";

interface SettingsPageProps {
  settings: AppSettingsSnapshot;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onSave: (payload: AppSettingsUpdate) => Promise<void>;
}

export function SettingsPage({
  settings,
  loading,
  saving,
  error,
  onSave,
}: SettingsPageProps) {
  const [draft, setDraft] = useState<AppSettingsUpdate>({
    thresholds: settings.thresholds,
    display: settings.display,
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDraft({
      thresholds: settings.thresholds,
      display: settings.display,
    });
  }, [settings]);

  const updateThreshold = (name: keyof AppSettingsUpdate["thresholds"], value: string) => {
    setDraft((current) => ({
      ...current,
      thresholds: {
        ...current.thresholds,
        [name]: Number(value),
      },
    }));
  };

  const updateDisplay = (name: keyof AppSettingsUpdate["display"], value: string) => {
    setDraft((current) => ({
      ...current,
      display: {
        ...current.display,
        [name]: value,
      },
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveMessage(null);
    setSaveError(null);
    try {
      await onSave(draft);
      setSaveMessage("Settings saved.");
    } catch {
      setSaveError("Could not save settings. Check backend status and try again.");
    }
  };

  return (
    <main className="screen screen--settings">
      <header className="screen__header screen__header--pit">
        <div>
          <p className="screen__eyebrow">PitSight</p>
          <h1 className="screen__title">Settings</h1>
        </div>
        <div className="session-summary">
          <span>Last saved {formatTimestamp(settings.updated_at)}</span>
          <span>Thresholds use canonical C and bar units</span>
        </div>
      </header>

      <section className="panel settings-panel">
        <div className="panel__title">Configuration</div>
        {loading ? <div className="settings-status">Loading settings...</div> : null}
        {error ? <div className="settings-status settings-status--warning">{error}</div> : null}
        {saveError ? <div className="settings-status settings-status--warning">{saveError}</div> : null}
        {saveMessage ? <div className="settings-status settings-status--ok">{saveMessage}</div> : null}

        <form className="settings-form" onSubmit={handleSubmit}>
          <section className="settings-group">
            <h2 className="settings-group__title">Alert Thresholds</h2>

            <label className="settings-field">
              <span>Oil pressure warning (bar)</span>
              <input
                type="number"
                step="0.1"
                value={draft.thresholds.oil_pressure_warning_bar}
                onChange={(event) => updateThreshold("oil_pressure_warning_bar", event.target.value)}
              />
            </label>

            <label className="settings-field">
              <span>Oil pressure critical (bar)</span>
              <input
                type="number"
                step="0.1"
                value={draft.thresholds.oil_pressure_critical_bar}
                onChange={(event) => updateThreshold("oil_pressure_critical_bar", event.target.value)}
              />
            </label>

            <label className="settings-field">
              <span>Water temp warning (C)</span>
              <input
                type="number"
                step="1"
                value={draft.thresholds.water_temp_warning_c}
                onChange={(event) => updateThreshold("water_temp_warning_c", event.target.value)}
              />
            </label>

            <label className="settings-field">
              <span>Water temp critical (C)</span>
              <input
                type="number"
                step="1"
                value={draft.thresholds.water_temp_critical_c}
                onChange={(event) => updateThreshold("water_temp_critical_c", event.target.value)}
              />
            </label>

            <label className="settings-field">
              <span>Oil temp warning (C)</span>
              <input
                type="number"
                step="1"
                value={draft.thresholds.oil_temp_warning_c}
                onChange={(event) => updateThreshold("oil_temp_warning_c", event.target.value)}
              />
            </label>

            <label className="settings-field">
              <span>Oil temp critical (C)</span>
              <input
                type="number"
                step="1"
                value={draft.thresholds.oil_temp_critical_c}
                onChange={(event) => updateThreshold("oil_temp_critical_c", event.target.value)}
              />
            </label>

            <label className="settings-field">
              <span>Low fuel warning (%)</span>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={draft.thresholds.fuel_level_warning_percent}
                onChange={(event) => updateThreshold("fuel_level_warning_percent", event.target.value)}
              />
            </label>
          </section>

          <section className="settings-group">
            <h2 className="settings-group__title">Display Preferences</h2>

            <label className="settings-field">
              <span>Speed unit</span>
              <select
                value={draft.display.speed_unit}
                onChange={(event) => updateDisplay("speed_unit", event.target.value)}
              >
                <option value="kph">kph</option>
                <option value="mph">mph</option>
              </select>
            </label>

            <label className="settings-field">
              <span>Temperature unit</span>
              <select
                value={draft.display.temperature_unit}
                onChange={(event) => updateDisplay("temperature_unit", event.target.value)}
              >
                <option value="celsius">Celsius</option>
                <option value="fahrenheit">Fahrenheit</option>
              </select>
            </label>

            <label className="settings-field">
              <span>Pressure unit</span>
              <select
                value={draft.display.pressure_unit}
                onChange={(event) => updateDisplay("pressure_unit", event.target.value)}
              >
                <option value="bar">bar</option>
                <option value="psi">psi</option>
              </select>
            </label>

            <label className="settings-field">
              <span>Default driver mode</span>
              <select
                value={draft.display.default_driver_mode}
                onChange={(event) => updateDisplay("default_driver_mode", event.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="lemons">Lemons</option>
              </select>
            </label>
          </section>

          <div className="settings-actions">
            <button className="settings-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
