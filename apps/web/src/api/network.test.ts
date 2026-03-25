import { describe, expect, it } from "vitest";

import {
  buildApiUrl,
  resolveApiBaseUrl,
  resolveApiMediaUrl,
  resolveTelemetryWebSocketUrl,
} from "./network";

describe("frontend network resolution", () => {
  it("defaults to localhost dev behavior when no runtime config is provided", () => {
    expect(resolveApiBaseUrl()).toBe("http://localhost:8000");
    expect(buildApiUrl("/api/v1/telemetry/latest")).toBe(
      "http://localhost:8000/api/v1/telemetry/latest",
    );
    expect(resolveTelemetryWebSocketUrl()).toBe("ws://localhost:8000/ws/telemetry");
  });

  it("derives LAN-safe API and WebSocket URLs from the current browser host", () => {
    const config = {
      apiPort: "8000",
      location: {
        protocol: "http:",
        hostname: "192.168.3.104",
      },
    };

    expect(resolveApiBaseUrl(config)).toBe("http://192.168.3.104:8000");
    expect(resolveTelemetryWebSocketUrl("/ws/telemetry", config)).toBe(
      "ws://192.168.3.104:8000/ws/telemetry",
    );
    expect(resolveApiMediaUrl("/api/v1/camera/stream.mjpeg", config)).toBe(
      "http://192.168.3.104:8000/api/v1/camera/stream.mjpeg",
    );
  });

  it("uses an explicit configured API base URL when provided", () => {
    const config = {
      explicitApiBaseUrl: "https://pit.example.com/pitsight-api/",
    };

    expect(resolveApiBaseUrl(config)).toBe("https://pit.example.com/pitsight-api");
    expect(buildApiUrl("/api/v1/settings", config)).toBe(
      "https://pit.example.com/pitsight-api/api/v1/settings",
    );
    expect(resolveTelemetryWebSocketUrl("/ws/telemetry", config)).toBe(
      "wss://pit.example.com/pitsight-api/ws/telemetry",
    );
  });

  it("supports a configured deployment port without an explicit API base URL", () => {
    const config = {
      apiPort: "9000",
      location: {
        protocol: "https:",
        hostname: "pit-pi.local",
      },
    };

    expect(resolveApiBaseUrl(config)).toBe("https://pit-pi.local:9000");
    expect(resolveTelemetryWebSocketUrl("/ws/telemetry", config)).toBe(
      "wss://pit-pi.local:9000/ws/telemetry",
    );
  });
});
