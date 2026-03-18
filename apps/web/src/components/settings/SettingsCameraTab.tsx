import { SettingsSectionCard } from "./SettingsSectionCard";
import { SettingsSelectField, SettingsToggleField } from "./SettingsControls";
import type { SettingsCameraTabProps } from "./SettingsTabTypes";
import { getScopeBadges } from "../../utils/settingsSync";

export function SettingsCameraTab({
  settings,
  draft,
  onSharedRootChange,
  onDeviceCameraChange,
}: SettingsCameraTabProps) {
  const previewState = !draft.device_local.camera.camera_enabled
    ? "Camera disabled"
    : !settings.sync.device_online
      ? "Device offline"
      : "Preview placeholder";

  return (
    <div className="settings-tab-panels settings-tab-panels--camera">
      <SettingsSectionCard
        title="Camera Hardware"
        description="Camera hardware selection is device-owned because the Pi owns the actual camera interfaces and capture stack."
        badges={getScopeBadges("device", settings)}
      >
        <div className="settings-grid">
          <SettingsToggleField
            label="Camera Enabled"
            helper="Master enable for in-car capture once camera support lands."
            checked={draft.device_local.camera.camera_enabled}
            onChange={(value) => onDeviceCameraChange("camera_enabled", value)}
          />
          <SettingsSelectField
            label="Camera Hardware Source"
            helper="Physical or logical video input owned by the Pi."
            value={draft.device_local.camera.camera_hardware_source}
            onChange={(value) => onDeviceCameraChange("camera_hardware_source", value as typeof draft.device_local.camera.camera_hardware_source)}
            options={[
              { value: "none", label: "None" },
              { value: "pi_cam", label: "Pi Camera" },
              { value: "usb_cam", label: "USB Camera" },
              { value: "network_stream", label: "Network Stream" },
            ]}
          />
          <SettingsSelectField
            label="Camera Mode Preference"
            helper="Shared viewing preference once video routing is active."
            value={draft.shared.camera_mode_preference}
            onChange={(value) => onSharedRootChange("camera_mode_preference", value as typeof draft.shared.camera_mode_preference)}
            options={[
              { value: "disabled", label: "Disabled" },
              { value: "road", label: "Road Cam" },
              { value: "driver", label: "Driver Cam" },
            ]}
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="Preview / Status"
        description="Video is not implemented yet, but the placeholder state stays explicit so operators can distinguish disabled, offline, and unavailable states."
        badges={[
          ...getScopeBadges("device", settings),
          { label: previewState, tone: draft.device_local.camera.camera_enabled ? "warning" : "unavailable" },
        ]}
      >
        <div className="settings-camera-preview">
          <div className="settings-camera-preview__frame">
            <div className="settings-camera-preview__status">{previewState}</div>
            <div className="settings-camera-preview__detail">
              {draft.device_local.camera.camera_enabled
                ? "Preview/test feed placeholder until the camera pipeline is implemented."
                : "Enable camera support to stage video-related settings."}
            </div>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
