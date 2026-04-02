import type { TimingMetricView } from "../../utils/lemonsTelemetry";

interface TimingMetricCardProps {
  metric: TimingMetricView;
}

export function TimingMetricCard({ metric }: TimingMetricCardProps) {
  return (
    <section
      className={`driver-timing-card driver-timing-card--${metric.emphasis} driver-timing-card--${metric.state}`}
    >
      <div className="driver-timing-card__header">
        <div className="driver-timing-card__label">{metric.label}</div>
        {metric.state !== "normal" ? (
          <div className="driver-timing-card__state">{metric.state.toUpperCase()}</div>
        ) : null}
      </div>

      <div className="driver-timing-card__value">{metric.value}</div>
      <div className="driver-timing-card__detail">{metric.detail}</div>
    </section>
  );
}
