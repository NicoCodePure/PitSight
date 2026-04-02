import type { SettingsStatusBadge } from "../../utils/settingsSync";

interface SettingsStatusPillsProps {
  badges: SettingsStatusBadge[];
}

export function SettingsStatusPills({ badges }: SettingsStatusPillsProps) {
  return (
    <div className="settings-status-pills">
      {badges.map((badge) => (
        <span key={`${badge.label}-${badge.tone}`} className={`settings-pill settings-pill--${badge.tone}`}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}
