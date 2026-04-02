import type { PitRecentEventView } from "../../utils/pitTelemetry";
import { formatTimestamp } from "../../utils/format";

interface PitEventTimelineProps {
  events: PitRecentEventView[];
}

export function PitEventTimeline({ events }: PitEventTimelineProps) {
  if (events.length === 0) {
    return <div className="pit-event-timeline__empty">No recent alerts or state changes.</div>;
  }

  return (
    <div className="pit-event-timeline">
      {events.map((event) => (
        <article key={event.id} className={`pit-event-card pit-event-card--${event.state}`}>
          <div className="pit-event-card__header">
            <span className="pit-event-card__title">{event.title}</span>
            <span className="pit-event-card__state">{event.state.toUpperCase()}</span>
          </div>
          <div className="pit-event-card__detail">{event.detail}</div>
          <div className="pit-event-card__time">{formatTimestamp(event.timestamp)}</div>
        </article>
      ))}
    </div>
  );
}
