import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_APP_SETTINGS } from "../../types/appSettings";
import type { AppSettingsSnapshot, AppSettingsUpdate } from "../../types/appSettings";
import type { SourceStatus } from "../../types/telemetry";
import { DeviceMenuOverlay, hasConnectionRestartNotice } from "./DeviceMenuOverlay";

const disconnectedObd2Source: SourceStatus = {
  provider: "obd2",
  transport: "ELM327",
  protocol: "OBD2",
  connection_state: "disconnected",
  connected: false,
  raw_capture_enabled: false,
  details: null,
};

function buildSettings(overrides?: Partial<AppSettingsSnapshot>): AppSettingsSnapshot {
  return {
    ...structuredClone(DEFAULT_APP_SETTINGS),
    ...overrides,
  };
}

function buildDraft(settings: AppSettingsSnapshot): AppSettingsUpdate {
  return {
    device_local: structuredClone(settings.device_local),
    shared: structuredClone(settings.shared),
    web: structuredClone(settings.web),
  };
}

function renderMenu({
  settings = buildSettings(),
  source = null,
  initialOpen = false,
  initialPanel = "menu",
}: {
  settings?: AppSettingsSnapshot;
  source?: SourceStatus | null;
  initialOpen?: boolean;
  initialPanel?: "menu" | "settings";
} = {}): string {
  return renderToStaticMarkup(
    <StaticRouter location="/driver/lemons">
      <DeviceMenuOverlay
        settings={settings}
        loading={false}
        saving={false}
        error={null}
        source={source}
        streamStatus={source?.connected ? "connected" : "disconnected"}
        currentPath="/driver/lemons"
        onSave={async () => undefined}
        initialOpen={initialOpen}
        initialPanel={initialPanel}
      />
    </StaticRouter>,
  );
}

describe("DeviceMenuOverlay", () => {
  it("renders a compact menu button for driver screens", () => {
    const html = renderMenu();

    expect(html).toContain('aria-label="Open device menu"');
    expect(html).toContain("Menu");
  });

  it("renders driver navigation and full settings links when opened", () => {
    const html = renderMenu({ initialOpen: true });

    expect(html).toContain('href="/driver/lemons"');
    expect(html).toContain("Driver Lemons");
    expect(html).toContain('href="/driver/normal"');
    expect(html).toContain("Driver Normal");
    expect(html).toContain('href="/settings"');
    expect(html).toContain("Open Full Settings");
    expect(html).toContain("Device Setup");
    expect(html).toContain("Return To Driver Screen");
  });

  it("renders disconnected source status and on-device settings", () => {
    const settings = buildSettings({
      provider_runtime: {
        ...DEFAULT_APP_SETTINGS.provider_runtime,
        boot_provider: "simulator",
        requested_provider: "obd2",
        active_provider: "obd2",
        selection_state: "restart_required",
        restart_required: true,
      },
    });
    const html = renderMenu({
      settings,
      source: disconnectedObd2Source,
      initialOpen: true,
      initialPanel: "settings",
    });

    expect(html).toContain("Disconnected");
    expect(html).toContain("Current provider OBD2");
    expect(html).toContain("Restart required for connection changes to take effect.");
    expect(html).toContain("Telemetry Source");
    expect(html).toContain("OBD2 Port");
    expect(html).toContain("/dev/ttyUSB0");
    expect(html).toContain("Default Dashboard");
    expect(html).toContain("Temperature");
    expect(html).toContain("Pressure");
    expect(html).toContain("Speed");
  });

  it("flags restart notice for staged provider or OBD2 port changes", () => {
    const settings = buildSettings();
    const providerDraft = buildDraft(settings);
    providerDraft.shared.telemetry_source_preference = "obd2";

    const portDraft = buildDraft(settings);
    portDraft.device_local.vehicle.usb_serial_device = "/dev/ttyUSB0";

    expect(hasConnectionRestartNotice(settings, providerDraft, false)).toBe(true);
    expect(hasConnectionRestartNotice(settings, portDraft, false)).toBe(true);
    expect(hasConnectionRestartNotice(settings, buildDraft(settings), false)).toBe(false);
  });
});
