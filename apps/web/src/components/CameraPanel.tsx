import { useEffect, useState } from "react";

import type { CameraPanelView } from "../utils/camera";

interface CameraPanelProps {
  view: CameraPanelView;
  size?: "driver" | "pit" | "settings";
}

export function CameraPanel({ view, size = "pit" }: CameraPanelProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [view.streamUrl]);

  const showStream = view.state === "live" && view.streamUrl && !imageFailed;
  const className = `camera-panel camera-panel--${size} camera-panel--${showStream ? "live" : view.state}`;
  const overlayDetail =
    !showStream &&
    view.lastFrameLabel &&
    (view.state === "no_signal" || view.state === "offline" || view.state === "fault")
      ? `Last frame ${view.lastFrameLabel}`
      : view.detail;

  return (
    <div className={className}>
      {showStream ? (
        <img
          className="camera-panel__image"
          src={view.streamUrl ?? undefined}
          alt={view.title}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="camera-panel__placeholder">
          <div className="camera-panel__placeholder-title">
            {imageFailed ? "Stream Interrupted" : view.title}
          </div>
          <div className="camera-panel__placeholder-detail">
            {imageFailed ? "The browser could not render the live MJPEG feed." : view.detail}
          </div>
        </div>
      )}

      <div className="camera-panel__overlay">
        <div className="camera-panel__overlay-top">
          <span className="camera-panel__label">{view.modeLabel}</span>
          <span className="camera-panel__state">{showStream ? "Live" : view.state.replace("_", " ")}</span>
        </div>
        <div className="camera-panel__title">{view.title}</div>
        <div className="camera-panel__detail">{showStream ? view.detail : overlayDetail}</div>
      </div>
    </div>
  );
}
