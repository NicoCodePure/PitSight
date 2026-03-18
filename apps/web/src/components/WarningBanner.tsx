import type { DisplayPreferences } from "../types/appSettings";
import type { AlertEvent } from "../types/telemetry";
import { formatAlertValue } from "../utils/format";

interface WarningBannerProps {
  alerts: AlertEvent[];
  idleMessage?: string;
  displayPreferences?: DisplayPreferences;
}

export function WarningBanner({
  alerts,
  idleMessage = "No active alarms",
  displayPreferences,
}: WarningBannerProps) {
  const criticalAlert = alerts.find((alert) => alert.active && alert.severity === "critical");
  const warningAlert = alerts.find((alert) => alert.active && alert.severity === "warning");
  const alert = criticalAlert ?? warningAlert;

  if (!alert) {
    return (
      <div className="warning-banner warning-banner--clear">
        <span className="warning-banner__label">Status</span>
        <span>{idleMessage}</span>
      </div>
    );
  }

  const formattedValue = displayPreferences ? formatAlertValue(alert, displayPreferences) : null;

  return (
    <div className={`warning-banner warning-banner--${alert.severity}`}>
      <span className="warning-banner__label">{alert.severity.toUpperCase()}</span>
      <span>{alert.message}</span>
      {formattedValue ? (
        <span className="warning-banner__value">{formattedValue}</span>
      ) : null}
    </div>
  );
}
