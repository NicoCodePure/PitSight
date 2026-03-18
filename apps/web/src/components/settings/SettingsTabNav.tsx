interface SettingsTabItem {
  id: string;
  label: string;
}

interface SettingsTabNavProps {
  tabs: SettingsTabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function SettingsTabNav({ tabs, activeTab, onChange }: SettingsTabNavProps) {
  return (
    <nav className="settings-tab-nav" aria-label="Settings sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`settings-tab-nav__item${tab.id === activeTab ? " is-active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
