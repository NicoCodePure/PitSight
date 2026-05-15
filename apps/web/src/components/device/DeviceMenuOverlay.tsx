import { Link } from "react-router-dom";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { AppSettingsSnapshot, AppSettingsUpdate, DashboardMode, ProviderName } from "../../types/appSettings";
import type { SourceStatus } from "../../types/telemetry";
import { titleCase } from "../../utils/format";
import { formatDashboardMode, formatProviderPreference } from "../../utils/settingsSync";

type DevicePanel = "menu" | "settings";

interface DeviceMenuOverlayProps {
  settings: AppSettingsSnapshot;
  loading: boolean;
  saving: boolean;
  error: string | null;
  source: SourceStatus | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  currentPath: string;
  onSave: (payload: AppSettingsUpdate) => Promise<void>;
  initialOpen?: boolean;
  initialPanel?: DevicePanel;
}

function buildSavedUpdate(settings: AppSettingsSnapshot): AppSettingsUpdate {
  return {
    device_local: structuredClone(settings.device_local),
    shared: structuredClone(settings.shared),
    web: structuredClone(settings.web),
  };
}

function getSourceState(source: SourceStatus | null, streamStatus: DeviceMenuOverlayProps["streamStatus"]): string {
  if (source?.connection_state) {
    return titleCase(source.connection_state);
  }

  return streamStatus === "connected" ? "Unavailable" : titleCase(streamStatus);
}

function getSourceTone(source: SourceStatus | null, streamStatus: DeviceMenuOverlayProps["streamStatus"]): string {
  if (source?.connection_state === "connected" && source.connected) {
    return "normal";
  }
  if (source?.connection_state === "degraded" || streamStatus === "connecting") {
    return "advisory";
  }
  if (source?.connection_state === "fault") {
    return "critical";
  }
  return "unavailable";
}

export function hasConnectionRestartNotice(
  settings: AppSettingsSnapshot,
  draft: AppSettingsUpdate,
  savedConnectionChange: boolean,
): boolean {
  return (
    settings.provider_runtime.restart_required ||
    savedConnectionChange ||
    draft.shared.telemetry_source_preference !== settings.shared.telemetry_source_preference ||
    draft.device_local.vehicle.usb_serial_device !== settings.device_local.vehicle.usb_serial_device
  );
}

export function DeviceMenuOverlay({
  settings,
  loading,
  saving,
  error,
  source,
  streamStatus,
  currentPath,
  onSave,
  initialOpen = false,
  initialPanel = "menu",
}: DeviceMenuOverlayProps) {
  const [open, setOpen] = useState(initialOpen);
  const [panel, setPanel] = useState<DevicePanel>(initialPanel);
  const [draft, setDraft] = useState<AppSettingsUpdate>(() => buildSavedUpdate(settings));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [savedConnectionChange, setSavedConnectionChange] = useState(false);
  const settingsSignature = useMemo(
    () => JSON.stringify(buildSavedUpdate(settings)),
    [settings.device_local, settings.shared, settings.web],
  );

  useEffect(() => {
    if (!open || panel === "menu") {
      setDraft(buildSavedUpdate(settings));
    }
  }, [open, panel, settings, settingsSignature]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPanel("menu");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const restartNotice = hasConnectionRestartNotice(settings, draft, savedConnectionChange);
  const sourceTone = getSourceTone(source, streamStatus);
  const sourceState = getSourceState(source, streamStatus);
  const sourceProvider = source?.provider ?? settings.device_state.active_source_provider ?? settings.provider_runtime.active_provider;
  const isDirty = JSON.stringify(draft) !== settingsSignature;

  const updateProvider = (provider: ProviderName) => {
    setSavedMessage(null);
    setSaveError(null);
    setDraft((current) => ({
      ...current,
      shared: {
        ...current.shared,
        telemetry_source_preference: provider,
      },
    }));
  };

  const updateObdPort = (value: string) => {
    setSavedMessage(null);
    setSaveError(null);
    setDraft((current) => ({
      ...current,
      device_local: {
        ...current.device_local,
        vehicle: {
          ...current.device_local.vehicle,
          usb_serial_device: value,
        },
      },
    }));
  };

  const updateDashboardMode = (value: DashboardMode) => {
    setSavedMessage(null);
    setSaveError(null);
    setDraft((current) => ({
      ...current,
      device_local: {
        ...current.device_local,
        display: {
          ...current.device_local.display,
          default_dashboard_mode: value,
        },
      },
    }));
  };

  const updateUnit = <Key extends keyof AppSettingsUpdate["shared"]["units"]>(
    key: Key,
    value: AppSettingsUpdate["shared"]["units"][Key],
  ) => {
    setSavedMessage(null);
    setSaveError(null);
    setDraft((current) => ({
      ...current,
      shared: {
        ...current.shared,
        units: {
          ...current.shared.units,
          [key]: value,
        },
      },
    }));
  };

  const closeMenu = () => {
    setOpen(false);
    setPanel("menu");
  };

  const openSettingsPanel = () => {
    setDraft(buildSavedUpdate(settings));
    setPanel("settings");
    setSavedMessage(null);
    setSaveError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
    setSavedMessage(null);

    const connectionChanged =
      draft.shared.telemetry_source_preference !== settings.shared.telemetry_source_preference ||
      draft.device_local.vehicle.usb_serial_device !== settings.device_local.vehicle.usb_serial_device;

    try {
      await onSave(draft);
      setSavedConnectionChange(connectionChanged);
      setSavedMessage("Settings saved.");
    } catch (nextError) {
      setSaveError(
        nextError instanceof Error
          ? nextError.message
          : "Could not save settings. Check backend status and try again.",
      );
    }
  };

  return (
    <>
      <button
        className="device-menu-trigger"
        type="button"
        aria-label="Open device menu"
        onClick={() => {
          setOpen(true);
          setPanel("menu");
        }}
      >
        <span className="device-menu-trigger__bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="device-menu-trigger__text">Menu</span>
      </button>

      {open ? (
        <div className="device-menu-backdrop" role="presentation">
          <section className="device-menu-panel" role="dialog" aria-modal="true" aria-label="PitSight device menu">
            <header className="device-menu-panel__header">
              <div>
                <p className="device-menu-panel__eyebrow">PitSight Pi</p>
                <h2 className="device-menu-panel__title">
                  {panel === "settings" ? "On-Device Settings" : "Device Menu"}
                </h2>
              </div>
              <button className="device-menu-panel__close" type="button" onClick={closeMenu}>
                Close
              </button>
            </header>

            {panel === "menu" ? (
              <div className="device-menu-panel__body">
                <div className="device-menu-status-grid" aria-label="Connection status">
                  <article className={`driver-status-badge driver-status-badge--${sourceTone}`}>
                    <span className="driver-status-badge__label">Connection</span>
                    <span className="driver-status-badge__value">{sourceState}</span>
                  </article>
                  <article className="driver-status-badge driver-status-badge--normal">
                    <span className="driver-status-badge__label">Provider</span>
                    <span className="driver-status-badge__value">{formatProviderPreference(sourceProvider)}</span>
                  </article>
                </div>

                <nav className="device-menu-actions" aria-label="Device menu navigation">
                  <Link
                    className={`device-menu-action${currentPath === "/driver/lemons" ? " is-current" : ""}`}
                    to="/driver/lemons"
                    onClick={closeMenu}
                  >
                    Driver Lemons
                  </Link>
                  <Link
                    className={`device-menu-action${currentPath === "/driver/normal" ? " is-current" : ""}`}
                    to="/driver/normal"
                    onClick={closeMenu}
                  >
                    Driver Normal
                  </Link>
                  <button className="device-menu-action" type="button" onClick={openSettingsPanel}>
                    Device Setup
                  </button>
                  <Link className="device-menu-action" to="/settings" onClick={closeMenu}>
                    Open Full Settings
                  </Link>
                </nav>

                <button className="device-menu-return" type="button" onClick={closeMenu}>
                  Return To Driver Screen
                </button>
              </div>
            ) : (
              <form className="device-settings-form" onSubmit={handleSubmit}>
                <div className="device-settings-status">
                  <span className={`device-settings-status__dot device-settings-status__dot--${sourceTone}`} />
                  <div>
                    <strong>{sourceState}</strong>
                    <span>
                      Current provider {formatProviderPreference(sourceProvider)} | Boot provider{" "}
                      {formatProviderPreference(settings.provider_runtime.boot_provider)}
                    </span>
                  </div>
                </div>

                {loading ? <div className="settings-status">Loading saved settings...</div> : null}
                {error ? <div className="settings-status settings-status--warning">{error}</div> : null}
                {restartNotice ? (
                  <div className="settings-status settings-status--warning">
                    Restart required for connection changes to take effect.
                  </div>
                ) : null}
                {savedMessage ? <div className="settings-status settings-status--ok">{savedMessage}</div> : null}
                {saveError ? <div className="settings-status settings-status--warning">{saveError}</div> : null}

                <div className="device-settings-grid">
                  <label className="settings-field">
                    <span className="settings-field__label">Telemetry Source</span>
                    <select
                      value={draft.shared.telemetry_source_preference}
                      onChange={(event) => updateProvider(event.target.value as ProviderName)}
                    >
                      <option value="simulator">Simulator</option>
                      <option value="obd2">OBD2</option>
                      <option value="dictator">Dictator advanced</option>
                    </select>
                    <span className="settings-field__helper">Provider changes are saved for the next backend start.</span>
                  </label>

                  <label className="settings-field">
                    <span className="settings-field__label">OBD2 Port</span>
                    <input
                      value={draft.device_local.vehicle.usb_serial_device}
                      placeholder="/dev/ttyUSB0"
                      onChange={(event) => updateObdPort(event.target.value)}
                    />
                    <span className="settings-field__helper">
                      Use ls /dev/ttyUSB* /dev/ttyACM* to find adapters.
                    </span>
                  </label>

                  <label className="settings-field">
                    <span className="settings-field__label">Default Dashboard</span>
                    <select
                      value={draft.device_local.display.default_dashboard_mode}
                      onChange={(event) => updateDashboardMode(event.target.value as DashboardMode)}
                    >
                      <option value="driver_lemons">Driver Lemons</option>
                      <option value="driver_normal">Driver Normal</option>
                      <option value="pit_dashboard">Pit Dashboard</option>
                    </select>
                    <span className="settings-field__helper">
                      Current default: {formatDashboardMode(settings.effective.device_local.display.default_dashboard_mode)}
                    </span>
                  </label>

                  <label className="settings-field">
                    <span className="settings-field__label">Temperature</span>
                    <select
                      value={draft.shared.units.temperature_unit}
                      onChange={(event) => updateUnit("temperature_unit", event.target.value as typeof draft.shared.units.temperature_unit)}
                    >
                      <option value="celsius">Celsius</option>
                      <option value="fahrenheit">Fahrenheit</option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span className="settings-field__label">Pressure</span>
                    <select
                      value={draft.shared.units.pressure_unit}
                      onChange={(event) => updateUnit("pressure_unit", event.target.value as typeof draft.shared.units.pressure_unit)}
                    >
                      <option value="bar">bar</option>
                      <option value="psi">psi</option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span className="settings-field__label">Speed</span>
                    <select
                      value={draft.shared.units.speed_unit}
                      onChange={(event) => updateUnit("speed_unit", event.target.value as typeof draft.shared.units.speed_unit)}
                    >
                      <option value="kph">km/h</option>
                      <option value="mph">mph</option>
                    </select>
                  </label>
                </div>

                <div className="device-menu-panel__footer">
                  <button className="settings-button settings-button--secondary" type="button" onClick={() => setPanel("menu")}>
                    Back
                  </button>
                  <button className="settings-button settings-button--secondary" type="button" onClick={closeMenu}>
                    Return
                  </button>
                  <button className="settings-button" type="submit" disabled={saving || loading || !isDirty}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
