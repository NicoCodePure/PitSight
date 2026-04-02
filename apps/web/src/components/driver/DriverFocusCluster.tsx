import type { FocusClusterView } from "../../utils/lemonsTelemetry";

interface DriverFocusClusterProps {
  focus: FocusClusterView;
}

export function DriverFocusCluster({ focus }: DriverFocusClusterProps) {
  return (
    <section className="driver-focus-cluster">
      <div className="driver-focus-cluster__shell">
        <div className={`driver-focus-segment driver-focus-segment--${focus.gear.state}`}>
          <div className="driver-focus-segment__label">{focus.gear.label}</div>
          <div className="driver-focus-segment__value">{focus.gear.value}</div>
          <div className="driver-focus-segment__detail">{focus.gear.detail}</div>
        </div>

        <div className={`driver-focus-main driver-focus-main--${focus.speed.state}`}>
          <div className="driver-focus-main__label">{focus.speed.label}</div>
          <div className="driver-focus-main__value-row">
            <div className="driver-focus-main__value">{focus.speed.value}</div>
            {focus.speed.unit ? <div className="driver-focus-main__unit">{focus.speed.unit}</div> : null}
          </div>
          <div className="driver-focus-main__detail">{focus.speed.detail}</div>
        </div>

        <div className={`driver-focus-segment driver-focus-segment--${focus.rpm.state}`}>
          <div className="driver-focus-segment__label">{focus.rpm.label}</div>
          <div className="driver-focus-segment__value driver-focus-segment__value--rpm">{focus.rpm.value}</div>
          <div className="driver-focus-segment__detail">
            {focus.rpm.detail}
            {focus.rpm.unit ? ` ${focus.rpm.unit.toUpperCase()}` : ""}
          </div>
        </div>
      </div>
    </section>
  );
}
