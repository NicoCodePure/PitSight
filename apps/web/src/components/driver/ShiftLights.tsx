import type { TelemetryVisualState } from "../../utils/lemonsTelemetry";

interface ShiftLightsProps {
  activeCount: number;
  state: TelemetryVisualState;
}

const LIGHT_COUNT = 10;

export function ShiftLights({ activeCount, state }: ShiftLightsProps) {
  return (
    <div className={`shift-lights shift-lights--${state}`} aria-label="Shift lights">
      {Array.from({ length: LIGHT_COUNT }, (_, index) => {
        const lightIndex = index + 1;
        const zone =
          lightIndex <= 4 ? "calm" : lightIndex <= 7 ? "warning" : "critical";
        const isActive = lightIndex <= activeCount;

        return (
          <span
            key={lightIndex}
            className={`shift-lights__lamp shift-lights__lamp--${zone}${
              isActive ? " is-active" : ""
            }`}
          />
        );
      })}
    </div>
  );
}
