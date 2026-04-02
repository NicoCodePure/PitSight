import type { FooterItemView } from "../../utils/lemonsTelemetry";

interface DriverBottomStripProps {
  summary: string;
  items: FooterItemView[];
}

export function DriverBottomStrip({ summary, items }: DriverBottomStripProps) {
  return (
    <footer className="driver-bottom-strip">
      <div className="driver-bottom-strip__summary">
        <span className="driver-bottom-strip__label">Status Summary</span>
        <span className="driver-bottom-strip__value">{summary}</span>
      </div>

      <div className="driver-bottom-strip__items">
        {items.map((item) => (
          <article
            key={item.id}
            className={`driver-footer-item${item.state ? ` driver-footer-item--${item.state}` : ""}`}
          >
            <span className="driver-footer-item__label">{item.label}</span>
            <span className="driver-footer-item__value">{item.value}</span>
          </article>
        ))}
      </div>
    </footer>
  );
}
