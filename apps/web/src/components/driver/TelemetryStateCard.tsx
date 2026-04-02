import type { TelemetryCardView } from "../../utils/lemonsTelemetry";

interface TelemetryStateCardProps {
  metric: TelemetryCardView;
}

export function TelemetryStateCard({ metric }: TelemetryStateCardProps) {
  return (
    <section className={`telemetry-state-card telemetry-state-card--${metric.state}`}>
      <div className="telemetry-state-card__header">
        <div className="telemetry-state-card__label">{metric.label}</div>
        <div className="telemetry-state-card__state">{metric.state.toUpperCase()}</div>
      </div>

      <div className="telemetry-state-card__value-row">
        <span className="telemetry-state-card__value">{metric.value}</span>
        {metric.unit ? <span className="telemetry-state-card__unit">{metric.unit}</span> : null}
      </div>

      <div className="telemetry-state-card__detail">{metric.detail}</div>
    </section>
  );
}
