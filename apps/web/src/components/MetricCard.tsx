import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  accent?: "default" | "warning" | "critical";
  caption?: ReactNode;
}

export function MetricCard({
  label,
  value,
  unit,
  accent = "default",
  caption,
}: MetricCardProps) {
  return (
    <section className={`metric-card metric-card--${accent}`}>
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value-row">
        <span className="metric-card__value">{value}</span>
        {unit ? <span className="metric-card__unit">{unit}</span> : null}
      </div>
      {caption ? <div className="metric-card__caption">{caption}</div> : null}
    </section>
  );
}

