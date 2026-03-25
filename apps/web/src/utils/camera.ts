import { resolveApiMediaUrl } from "../api/client";
import type { CameraMode, CameraHardwareSource } from "../types/appSettings";
import type { CameraMetrics, CameraState, CameraViewMode } from "../types/telemetry";

export type CameraPanelState =
  | "live"
  | "loading"
  | "no_signal"
  | "offline"
  | "disabled"
  | "unavailable"
  | "fault";

export interface CameraPanelView {
  state: CameraPanelState;
  title: string;
  detail: string;
  modeLabel: string;
  streamUrl: string | null;
  lastFrameLabel: string | null;
}

function labelForMode(mode: CameraViewMode | CameraMode | null | undefined): string {
  switch (mode) {
    case "road":
      return "Road Cam";
    case "driver":
      return "Driver Cam";
    default:
      return "Camera";
  }
}

function labelForHardwareSource(source: CameraHardwareSource | null | undefined): string {
  switch (source) {
    case "pi_cam":
      return "Pi camera";
    case "usb_cam":
      return "USB camera";
    case "network_stream":
      return "Network stream";
    default:
      return "Camera";
  }
}

function formatTimestamp(timestamp: string | null | undefined): string | null {
  if (!timestamp) {
    return null;
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function buildCameraPanelView({
  camera,
  deviceOnline,
  requestedMode,
  hardwareSource,
}: {
  camera: CameraMetrics | null | undefined;
  deviceOnline?: boolean;
  requestedMode?: CameraMode | null;
  hardwareSource?: CameraHardwareSource | null;
}): CameraPanelView {
  const effectiveMode = camera?.mode ?? requestedMode ?? "disabled";
  const modeLabel = labelForMode(effectiveMode);
  const sourceLabel = labelForHardwareSource(hardwareSource);
  const lastFrameLabel = formatTimestamp(camera?.last_frame_at);

  if (deviceOnline === false) {
    return {
      state: "offline",
      title: "Pi Offline",
      detail: "The device is not reporting live camera state right now. Last known configuration is saved.",
      modeLabel,
      streamUrl: null,
      lastFrameLabel,
    };
  }

  const state = camera?.state ?? "unavailable";
  const streamUrl = state === "live" ? resolveApiMediaUrl(camera?.stream_url) : null;

  switch (state as CameraState) {
    case "live":
      return {
        state: "live",
        title: `${modeLabel} Live`,
        detail: camera?.detail ?? `${sourceLabel} feed is live.`,
        modeLabel,
        streamUrl,
        lastFrameLabel,
      };
    case "loading":
      return {
        state: "loading",
        title: `${modeLabel} Loading`,
        detail: camera?.detail ?? `Initializing ${sourceLabel.toLowerCase()} pipeline.`,
        modeLabel,
        streamUrl: null,
        lastFrameLabel,
      };
    case "no_signal":
      return {
        state: "no_signal",
        title: "No Signal",
        detail: camera?.detail ?? `${sourceLabel} is present, but no frames are arriving.`,
        modeLabel,
        streamUrl: null,
        lastFrameLabel,
      };
    case "fault":
      return {
        state: "fault",
        title: "Camera Fault",
        detail: camera?.detail ?? "Camera pipeline hit an internal error.",
        modeLabel,
        streamUrl: null,
        lastFrameLabel,
      };
    case "disabled":
      return {
        state: "disabled",
        title: "Camera Disabled",
        detail: camera?.detail ?? "Enable camera capture in the effective device settings.",
        modeLabel,
        streamUrl: null,
        lastFrameLabel,
      };
    case "offline":
      return {
        state: "offline",
        title: "Pi Offline",
        detail: camera?.detail ?? "The device is not reporting a live camera state.",
        modeLabel,
        streamUrl: null,
        lastFrameLabel,
      };
    case "unavailable":
    default:
      return {
        state: "unavailable",
        title: `${modeLabel} Unavailable`,
        detail: camera?.detail ?? `${sourceLabel} is not available on this device.`,
        modeLabel,
        streamUrl: null,
        lastFrameLabel,
      };
  }
}
