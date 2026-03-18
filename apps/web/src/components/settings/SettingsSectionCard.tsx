import type { ReactNode } from "react";

import { SettingsStatusPills } from "./SettingsStatusPills";
import type { SettingsStatusBadge } from "../../utils/settingsSync";

interface SettingsSectionCardProps {
  title: string;
  description: string;
  badges?: SettingsStatusBadge[];
  actions?: ReactNode;
  children: ReactNode;
}

export function SettingsSectionCard({
  title,
  description,
  badges = [],
  actions,
  children,
}: SettingsSectionCardProps) {
  return (
    <section className="settings-shell-card">
      <header className="settings-shell-card__header">
        <div className="settings-shell-card__copy">
          <h2 className="settings-shell-card__title">{title}</h2>
          <p className="settings-shell-card__description">{description}</p>
        </div>

        <div className="settings-shell-card__meta">
          {badges.length > 0 ? <SettingsStatusPills badges={badges} /> : null}
          {actions}
        </div>
      </header>

      <div className="settings-shell-card__body">{children}</div>
    </section>
  );
}
