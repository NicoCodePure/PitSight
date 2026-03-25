import { describe, expect, it } from "vitest";

import { buildCameraPanelView } from "./camera";

describe("buildCameraPanelView", () => {
  it("maps a live camera snapshot into a usable media URL", () => {
    const view = buildCameraPanelView({
      camera: {
        state: "live",
        mode: "road",
        detail: "USB feed live.",
        stream_url: "/api/v1/camera/stream.mjpeg",
        last_frame_at: "2026-03-25T12:00:00Z",
      },
      deviceOnline: true,
      requestedMode: "road",
      hardwareSource: "usb_cam",
    });

    expect(view.state).toBe("live");
    expect(view.title).toBe("Road Cam Live");
    expect(view.streamUrl).toBe("http://localhost:8000/api/v1/camera/stream.mjpeg");
    expect(view.lastFrameLabel).toBeTruthy();
  });

  it("forces an offline state for web-side consumers when the Pi is offline", () => {
    const view = buildCameraPanelView({
      camera: {
        state: "live",
        mode: "driver",
        stream_url: "/api/v1/camera/stream.mjpeg",
      },
      deviceOnline: false,
      requestedMode: "driver",
      hardwareSource: "pi_cam",
    });

    expect(view.state).toBe("offline");
    expect(view.streamUrl).toBeNull();
    expect(view.title).toBe("Pi Offline");
  });

  it("keeps unavailable cameras explicit when no live status exists", () => {
    const view = buildCameraPanelView({
      camera: null,
      requestedMode: "driver",
      hardwareSource: "network_stream",
    });

    expect(view.state).toBe("unavailable");
    expect(view.title).toBe("Driver Cam Unavailable");
    expect(view.detail).toContain("Network stream");
  });
});
