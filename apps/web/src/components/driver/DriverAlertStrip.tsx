import type { DriverAlertView } from "../../utils/lemonsTelemetry";

interface DriverAlertStripProps {
  alerts: DriverAlertView[];
  clearTitle?: string;
  clearDetail?: string;
}

export function DriverAlertStrip({
  alerts,
  clearTitle = "STATUS CLEAR",
  clearDetail = "All tracked engine survival metrics are within range.",
}: DriverAlertStripProps) {
  const [primary, ...secondary] = alerts;
  const stripClassName = `driver-alert-strip${secondary.length > 0 ? "" : " driver-alert-strip--single"}${
    primary ? ` driver-alert-strip--${primary.severity}` : " driver-alert-strip--clear"
  }`;

  if (!primary) {
    return (
      <section className={stripClassName} aria-live="polite">
        <div className="driver-alert-strip__primary">
          <div className="driver-alert-strip__meta">
            <span className="driver-alert-strip__severity">CLEAR</span>
            <span className="driver-alert-strip__source">System</span>
          </div>
          <div className="driver-alert-strip__title">{clearTitle}</div>
          <div className="driver-alert-strip__detail">{clearDetail}</div>
        </div>
      </section>
    );
  }

  return (
    <section className={stripClassName} aria-live="assertive">
      <div className="driver-alert-strip__primary">
        <div className="driver-alert-strip__meta">
          <span className="driver-alert-strip__severity">{primary.severity.toUpperCase()}</span>
          <span className="driver-alert-strip__source">{primary.source}</span>
        </div>
        <div className="driver-alert-strip__title">{primary.title}</div>
        <div className="driver-alert-strip__detail">{primary.detail}</div>
      </div>

      {secondary.length > 0 ? (
        <div className="driver-alert-strip__secondary">
          {secondary.slice(0, 1).map((alert) => (
            <article
              key={alert.id}
              className={`driver-alert-chip driver-alert-chip--${alert.severity}`}
            >
              <div className="driver-alert-chip__severity">{alert.severity.toUpperCase()}</div>
              <div className="driver-alert-chip__title">{alert.title}</div>
              <div className="driver-alert-chip__detail">{alert.detail}</div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
