import { CameraPanel } from "../CameraPanel";
import { SettingsSectionCard } from "./SettingsSectionCard";
import { SettingsSelectField, SettingsToggleField } from "./SettingsControls";
import type { SettingsCameraTabProps } from "./SettingsTabTypes";
import { buildCameraPanelView } from "../../utils/camera";
import { getScopeBadges } from "../../utils/settingsSync";

export function SettingsCameraTab({
  settings,
  draft,
  camera,
  onSharedRootChange,
  onDeviceCameraChange,
}: SettingsCameraTabProps) {
  const preview = buildCameraPanelView({
    camera,
    deviceOnline: settings.device_state.online,
    requestedMode: settings.effective.shared.camera_mode_preference,
    hardwareSource: settings.effective.device_local.camera.camera_hardware_source,
  });

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
            helper="Master enable for Pi-side capture and streaming."
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
        description="This preview uses the live backend camera path. States stay explicit so disabled, loading, no-signal, unavailable, and offline behavior are easy to validate."
        badges={[
          ...getScopeBadges("device", settings),
          {
            label: preview.title,
            tone:
              preview.state === "live"
                ? "normal"
                : preview.state === "loading" || preview.state === "no_signal"
                  ? "warning"
                  : preview.state === "fault" || preview.state === "offline"
                    ? "critical"
                    : "unavailable",
          },
        ]}
      >
        <div className="settings-camera-preview">
          <CameraPanel view={preview} size="settings" />
        </div>
      </SettingsSectionCard>
    </div>
  );
}
