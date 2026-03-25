import { useEffect, useMemo, useState } from "react";

import { SettingsCameraTab } from "../components/settings/SettingsCameraTab";
import { SettingsConnectionsTab } from "../components/settings/SettingsConnectionsTab";
import { SettingsDisplayTab } from "../components/settings/SettingsDisplayTab";
import { SettingsSystemTab } from "../components/settings/SettingsSystemTab";
import { SettingsTabNav } from "../components/settings/SettingsTabNav";
import { SettingsThresholdsTab } from "../components/settings/SettingsThresholdsTab";
import { SettingsUnitsTab } from "../components/settings/SettingsUnitsTab";
import { SettingsVehicleTab } from "../components/settings/SettingsVehicleTab";
import { DEFAULT_APP_SETTINGS } from "../types/appSettings";
import type { AppSettingsSnapshot, AppSettingsUpdate } from "../types/appSettings";
import type { CameraMetrics, SourceStatus } from "../types/telemetry";
import { formatTimestamp, titleCase } from "../utils/format";
import {
  buildThresholdInputState,
  hasUnsavedThresholdChanges,
  parseThresholdFieldValue,
  validateThresholdInputs,
  type ThresholdFieldName,
  type ThresholdInputState,
} from "../utils/settingsForm";
import { formatProviderPreference, formatRelativeSyncStatus } from "../utils/settingsSync";

interface SettingsPageProps {
  settings: AppSettingsSnapshot;
  defaults: AppSettingsUpdate;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onSave: (payload: AppSettingsUpdate) => Promise<void>;
  onUpdateSyncTestControls: (payload: AppSettingsSnapshot["sync_test"]) => Promise<void>;
  onApplyPendingToDevice: () => Promise<void>;
  source?: SourceStatus | null;
  camera?: CameraMetrics | null;
  streamStatus: "connecting" | "connected" | "disconnected";
}

type SettingsTabId =
  | "connections"
  | "vehicle"
  | "display"
  | "thresholds"
  | "units"
  | "camera"
  | "sync";

type StatusTone = "info" | "ok";

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: "connections", label: "Device Connections" },
  { id: "vehicle", label: "Vehicle / ECU" },
  { id: "display", label: "Display Mode" },
  { id: "thresholds", label: "Warning Thresholds" },
  { id: "units", label: "Units" },
  { id: "camera", label: "Camera" },
  { id: "sync", label: "System / Sync" },
];

function buildDraft(settings: AppSettingsUpdate): AppSettingsUpdate {
  return structuredClone(settings);
}

function buildSavedUpdate(settings: AppSettingsSnapshot): AppSettingsUpdate {
  return {
    device_local: structuredClone(settings.device_local),
    shared: structuredClone(settings.shared),
    web: structuredClone(settings.web),
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
  onUpdateSyncTestControls,
  onApplyPendingToDevice,
  source,
  camera,
  streamStatus,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("connections");
  const [draft, setDraft] = useState<AppSettingsUpdate>(() => buildSavedUpdate(settings));
  const [thresholdInputs, setThresholdInputs] = useState<ThresholdInputState>(() =>
    buildThresholdInputState(settings.shared.thresholds, settings.shared.units),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedUpdateSignature = useMemo(
    () => JSON.stringify(buildSavedUpdate(settings)),
    [settings.device_local, settings.shared, settings.web],
  );

  useEffect(() => {
    setDraft(buildSavedUpdate(settings));
    setThresholdInputs(buildThresholdInputState(settings.shared.thresholds, settings.shared.units));
  }, [savedUpdateSignature]);

  const thresholdValidation = useMemo(
    () => validateThresholdInputs(thresholdInputs, draft.shared.units),
    [draft.shared.units, thresholdInputs],
  );
  const isDirty = useMemo(() => {
    const savedUpdate = buildSavedUpdate(settings);
    return (
      JSON.stringify(draft) !== JSON.stringify(savedUpdate) ||
      hasUnsavedThresholdChanges(thresholdInputs, draft.shared.units, settings)
    );
  }, [draft, settings, thresholdInputs]);
  const canSave = !loading && !saving && isDirty && thresholdValidation.summary === null;

  const clearTransientMessages = () => {
    setStatusMessage(null);
    setSaveError(null);
  };

  const applyDraft = (nextDraft: AppSettingsUpdate) => {
    const cloned = buildDraft(nextDraft);
    setDraft(cloned);
    setThresholdInputs(buildThresholdInputState(cloned.shared.thresholds, cloned.shared.units));
  };

  const updateThresholdInput = (field: ThresholdFieldName, value: string) => {
    clearTransientMessages();
    setThresholdInputs((current) => ({
      ...current,
      [field]: value,
    }));

    const parsed = parseThresholdFieldValue(field, value, draft.shared.units);
    if (parsed === null) {
      return;
    }

    setDraft((current) => ({
      ...current,
      shared: {
        ...current.shared,
        thresholds: {
          ...current.shared.thresholds,
          [field]: parsed,
        },
      },
    }));
  };

  const updateSharedUnits = (
    field: keyof AppSettingsUpdate["shared"]["units"],
    value: AppSettingsUpdate["shared"]["units"][keyof AppSettingsUpdate["shared"]["units"]],
  ) => {
    clearTransientMessages();
    setDraft((current) => {
      const nextUnits = {
        ...current.shared.units,
        [field]: value,
      };
      setThresholdInputs(buildThresholdInputState(current.shared.thresholds, nextUnits));
      return {
        ...current,
        shared: {
          ...current.shared,
          units: nextUnits,
        },
      };
    });
  };

  const updateSharedDisplay = (
    field: keyof AppSettingsUpdate["shared"]["display"],
    value: AppSettingsUpdate["shared"]["display"][keyof AppSettingsUpdate["shared"]["display"]],
  ) => {
    clearTransientMessages();
    setDraft((current) => ({
      ...current,
      shared: {
        ...current.shared,
        display: {
          ...current.shared.display,
          [field]: value,
        },
      },
    }));
  };

  const updateConnections = (
    field: keyof AppSettingsUpdate["device_local"]["connections"],
    value: AppSettingsUpdate["device_local"]["connections"][keyof AppSettingsUpdate["device_local"]["connections"]],
  ) => {
    clearTransientMessages();
    setDraft((current) => ({
      ...current,
      device_local: {
        ...current.device_local,
        connections: {
          ...current.device_local.connections,
          [field]: value,
        },
      },
    }));
  };

  const updateVehicle = (
    field: keyof AppSettingsUpdate["device_local"]["vehicle"],
    value: AppSettingsUpdate["device_local"]["vehicle"][keyof AppSettingsUpdate["device_local"]["vehicle"]],
  ) => {
    clearTransientMessages();
    setDraft((current) => ({
      ...current,
      device_local: {
        ...current.device_local,
        vehicle: {
          ...current.device_local.vehicle,
          [field]: value,
        },
      },
    }));
  };

  const updateDeviceCamera = (
    field: keyof AppSettingsUpdate["device_local"]["camera"],
    value: AppSettingsUpdate["device_local"]["camera"][keyof AppSettingsUpdate["device_local"]["camera"]],
  ) => {
    clearTransientMessages();
    setDraft((current) => ({
      ...current,
      device_local: {
        ...current.device_local,
        camera: {
          ...current.device_local.camera,
          [field]: value,
        },
      },
    }));
  };

  const updateDeviceDisplay = (
    field: keyof AppSettingsUpdate["device_local"]["display"],
    value: AppSettingsUpdate["device_local"]["display"][keyof AppSettingsUpdate["device_local"]["display"]],
  ) => {
    clearTransientMessages();
    setDraft((current) => ({
      ...current,
      device_local: {
        ...current.device_local,
        display: {
          ...current.device_local.display,
          [field]: value,
        },
      },
    }));
  };

  const updateSharedRoot = (
    field: keyof Pick<AppSettingsUpdate["shared"], "telemetry_source_preference" | "camera_mode_preference">,
    value: AppSettingsUpdate["shared"][keyof Pick<AppSettingsUpdate["shared"], "telemetry_source_preference" | "camera_mode_preference">],
  ) => {
    clearTransientMessages();
    setDraft((current) => ({
      ...current,
      shared: {
        ...current.shared,
        [field]: value,
      },
    }));
  };

  const updateWeb = (
    field: keyof AppSettingsUpdate["web"],
    value: AppSettingsUpdate["web"][keyof AppSettingsUpdate["web"]],
  ) => {
    clearTransientMessages();
    setDraft((current) => ({
      ...current,
      web: {
        ...current.web,
        [field]: value,
      },
    }));
  };

  const handleCancel = () => {
    applyDraft(buildSavedUpdate(settings));
    setStatusTone("info");
    setStatusMessage("Unsaved changes discarded. The editor now matches the last confirmed state.");
    setSaveError(null);
  };

  const handleResetToDefaults = () => {
    applyDraft(defaults);
    setStatusTone("info");
    setStatusMessage("Configured defaults loaded into the form. Save to push them live.");
    setSaveError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setSaveError(null);

    if (thresholdValidation.summary !== null) {
      setSaveError(thresholdValidation.summary);
      return;
    }

    try {
      await onSave(draft);
      setStatusTone("ok");
      setStatusMessage(
        "Settings saved. Live-applied settings update immediately when supported; provider changes require a backend or Pi restart.",
      );
    } catch (nextError) {
      setSaveError(
        nextError instanceof Error
          ? nextError.message
          : "Could not save settings. Check backend status and try again.",
      );
    }
  };

  const lastSavedLabel =
    settings.updated_at === DEFAULT_APP_SETTINGS.updated_at && loading
      ? "Loading saved settings..."
      : settings.updated_at === DEFAULT_APP_SETTINGS.updated_at
        ? "Using local defaults"
        : formatTimestamp(settings.updated_at);
  const lastSyncLabel = settings.sync.last_sync_at ? formatTimestamp(settings.sync.last_sync_at) : "--";

  const renderActiveTab = () => {
    switch (activeTab) {
      case "connections":
        return (
          <SettingsConnectionsTab
            settings={settings}
            draft={draft}
            source={source}
            streamStatus={streamStatus}
            onConnectionChange={updateConnections}
          />
        );
      case "vehicle":
        return (
          <SettingsVehicleTab
            settings={settings}
            draft={draft}
            source={source}
            streamStatus={streamStatus}
            onSharedRootChange={updateSharedRoot}
            onVehicleChange={updateVehicle}
          />
        );
      case "display":
        return (
          <SettingsDisplayTab
            settings={settings}
            draft={draft}
            onSharedDisplayChange={updateSharedDisplay}
            onDeviceDisplayChange={updateDeviceDisplay}
          />
        );
      case "thresholds":
        return (
          <SettingsThresholdsTab
            settings={settings}
            draft={draft}
            thresholdInputs={thresholdInputs}
            fieldErrors={thresholdValidation.fieldErrors}
            onThresholdInputChange={updateThresholdInput}
          />
        );
      case "units":
        return <SettingsUnitsTab settings={settings} draft={draft} onSharedUnitsChange={updateSharedUnits} />;
      case "camera":
        return (
          <SettingsCameraTab
            settings={settings}
            draft={draft}
            camera={camera}
            onSharedRootChange={updateSharedRoot}
            onDeviceCameraChange={updateDeviceCamera}
          />
        );
      case "sync":
        return (
          <SettingsSystemTab
            settings={settings}
            draft={draft}
            lastSavedLabel={lastSavedLabel}
            lastSyncLabel={lastSyncLabel}
            saving={saving}
            onWebChange={updateWeb}
            onUpdateSyncTestControls={onUpdateSyncTestControls}
            onApplyPendingToDevice={onApplyPendingToDevice}
          />
        );
    }
  };

  return (
    <main className="screen screen--settings screen--driver-theme screen--settings-theme">
      <header className="screen__header screen__header--pit">
        <div>
          <p className="screen__eyebrow">PitSight</p>
          <h1 className="screen__title screen__title--lemons">Settings &amp; Sync</h1>
        </div>
        <div className="session-summary">
          <span>Last saved {lastSavedLabel}</span>
          <span>Last sync {lastSyncLabel}</span>
        </div>
      </header>

      <section className="settings-overview">
        <div className="settings-overview__copy">
          <p className="settings-overview__eyebrow">Hybrid Settings Model</p>
          <h2 className="settings-overview__title">
            Device-local, shared, and web-only settings with explicit sync awareness.
          </h2>
          <p className="settings-overview__body">
            The Pi can run independently when offline. Requested settings, effective device settings, and sync-test controls are exposed separately so pending and applied state can be validated end to end.
          </p>
        </div>

        <div className="driver-status-badges">
          <article className={`driver-status-badge driver-status-badge--${settings.sync.device_online ? "normal" : "unavailable"}`}>
            <span className="driver-status-badge__label">Device</span>
            <span className="driver-status-badge__value">{settings.sync.device_online ? "ONLINE" : "OFFLINE"}</span>
          </article>
          <article className={`driver-status-badge driver-status-badge--${formatRelativeSyncStatus(settings).tone}`}>
            <span className="driver-status-badge__label">Sync</span>
            <span className="driver-status-badge__value">{formatRelativeSyncStatus(settings).label.toUpperCase()}</span>
          </article>
          <article className={`driver-status-badge driver-status-badge--${streamStatus === "connected" ? "normal" : streamStatus === "connecting" ? "advisory" : "critical"}`}>
            <span className="driver-status-badge__label">Stream</span>
            <span className="driver-status-badge__value">{titleCase(streamStatus)}</span>
          </article>
          <article className={`driver-status-badge driver-status-badge--${source?.connected ? "normal" : "unavailable"}`}>
            <span className="driver-status-badge__label">Source</span>
            <span className="driver-status-badge__value">
              {source?.provider ? formatProviderPreference(source.provider).toUpperCase() : "UNAVAILABLE"}
            </span>
          </article>
        </div>
      </section>

      {loading ? <div className="settings-status">Loading settings from backend...</div> : null}
      {saving ? <div className="settings-status">Saving settings and waiting for updated sync state...</div> : null}
      {error ? <div className="settings-status settings-status--warning">{error}</div> : null}
      {settings.provider_runtime.restart_required ? (
        <div className="settings-status settings-status--warning">
          {settings.provider_runtime.detail}
        </div>
      ) : null}
      {isDirty ? (
        <div className="settings-status settings-status--info">
          Unsaved changes are staged locally. Save to persist requested state. Driver and pit screens only react to effective confirmed settings.
        </div>
      ) : null}
      {thresholdValidation.summary ? (
        <div className="settings-status settings-status--warning">{thresholdValidation.summary}</div>
      ) : null}
      {saveError ? <div className="settings-status settings-status--warning">{saveError}</div> : null}
      {statusMessage ? <div className={statusClassName(statusTone)}>{statusMessage}</div> : null}

      <form className="settings-form settings-form--workspace" onSubmit={handleSubmit}>
        <section className="settings-workspace">
          <SettingsTabNav
            tabs={SETTINGS_TABS}
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as SettingsTabId)}
          />
          <div className="settings-workspace__body">{renderActiveTab()}</div>
        </section>

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
    </main>
  );
}
