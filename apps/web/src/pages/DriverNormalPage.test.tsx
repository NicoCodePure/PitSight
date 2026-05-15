import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_APP_SETTINGS } from "../types/appSettings";
import { DriverNormalPage } from "./DriverNormalPage";

describe("DriverNormalPage", () => {
  it("keeps driver telemetry visible without rendering a camera panel", () => {
    const html = renderToStaticMarkup(
      <DriverNormalPage
        snapshot={null}
        alerts={[]}
        session={null}
        streamStatus="disconnected"
        displayPreferences={DEFAULT_APP_SETTINGS.shared.units}
        thresholds={DEFAULT_APP_SETTINGS.shared.thresholds}
      />,
    );

    expect(html).toContain("Driver Normal");
    expect(html).toContain("Engine Health");
    expect(html).toContain("Support Telemetry");
    expect(html).toContain("Timing &amp; Performance");
    expect(html).not.toContain("Camera");
    expect(html).not.toContain("camera-panel");
  });
});
