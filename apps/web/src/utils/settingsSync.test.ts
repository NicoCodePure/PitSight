import { describe, expect, it } from "vitest";

import {
  formatProviderRuntime,
  formatProviderSelectionBadge,
  formatProviderSelectionState,
} from "./settingsSync";

describe("provider runtime settings messaging", () => {
  it("formats active provider names consistently", () => {
    expect(formatProviderRuntime("simulator")).toBe("Simulator");
    expect(formatProviderRuntime("obd2")).toBe("OBD2");
    expect(formatProviderRuntime("dictator")).toBe("Dictator");
    expect(formatProviderRuntime(null)).toBe("Unavailable");
  });

  it("surfaces restart-required selection state clearly", () => {
    expect(formatProviderSelectionState("restart_required")).toBe("Restart Required");
    expect(
      formatProviderSelectionBadge({
        boot_provider: "simulator",
        requested_provider: "obd2",
        active_provider: "simulator",
        selection_state: "restart_required",
        live_switch_supported: false,
        restart_required: true,
        detail:
          "Requested provider is OBD2, but the running backend booted with SIMULATOR.",
      }),
    ).toEqual({
      label: "Restart Required",
      tone: "warning",
    });
  });
});
