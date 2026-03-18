import type { AlertEvent } from "../types/telemetry";
import { formatTimestamp } from "../utils/format";

interface AlertTimelineProps {
  alerts: AlertEvent[];
}

export function AlertTimeline({ alerts }: AlertTimelineProps) {
  if (alerts.length === 0) {
    return <div className="timeline-empty">No alerts captured yet.</div>;
  }

  return (
    <div className="alert-timeline">
      {alerts.map((alert, index) => (
        <article
          key={`${alert.timestamp ?? "na"}-${alert.code}-${index}`}
          className={`timeline-item timeline-item--${alert.severity}`}
        >
          <div className="timeline-item__title">{alert.message}</div>
          <div className="timeline-item__meta">
            <span>{formatTimestamp(alert.timestamp)}</span>
            <span>{alert.code}</span>
            {alert.value !== undefined && alert.value !== null ? <span>{alert.value}</span> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
