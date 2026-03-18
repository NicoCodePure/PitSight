import type { HealthState, SourceStatus } from "../types/telemetry";

interface StatusStripProps {
  source?: SourceStatus | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  healthState?: HealthState | null;
  sessionId?: string | null;
}

export function StatusStrip({
  source,
  streamStatus,
  healthState,
  sessionId,
}: StatusStripProps) {
  const sourceLabel = source ? `${source.provider} ${source.connected ? "active" : "inactive"}` : "source offline";

  return (
    <div className="status-strip">
      <span className={`status-pill status-pill--${streamStatus}`}>Stream {streamStatus}</span>
      <span className={`status-pill status-pill--${source?.connection_state ?? "disconnected"}`}>
        {sourceLabel}
      </span>
      <span className={`status-pill status-pill--${healthState ?? "nominal"}`}>
        Health {healthState ?? "nominal"}
      </span>
      <span className="status-pill status-pill--neutral">
        Session {sessionId ? sessionId.slice(0, 18) : "--"}
      </span>
    </div>
  );
}
