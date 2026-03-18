interface SettingsSelectFieldProps {
  label: string;
  helper: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

interface SettingsTextFieldProps {
  label: string;
  helper: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

interface SettingsNumberFieldProps {
  label: string;
  helper: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
}

interface SettingsToggleFieldProps {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

interface SettingsLiveCardProps {
  label: string;
  value: string;
  detail: string;
}

export function SettingsSelectField({
  label,
  helper,
  value,
  options,
  onChange,
}: SettingsSelectFieldProps) {
  return (
    <label className="settings-field">
      <span className="settings-field__label">{label}</span>
      <span className="settings-field__helper">{helper}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SettingsTextField({
  label,
  helper,
  value,
  placeholder,
  onChange,
}: SettingsTextFieldProps) {
  return (
    <label className="settings-field">
      <span className="settings-field__label">{label}</span>
      <span className="settings-field__helper">{helper}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function SettingsNumberField({
  label,
  helper,
  value,
  min = 0,
  step = 1,
  onChange,
}: SettingsNumberFieldProps) {
  return (
    <label className="settings-field">
      <span className="settings-field__label">{label}</span>
      <span className="settings-field__helper">{helper}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function SettingsToggleField({
  label,
  helper,
  checked,
  onChange,
}: SettingsToggleFieldProps) {
  return (
    <label className="settings-toggle">
      <div>
        <span className="settings-field__label">{label}</span>
        <span className="settings-field__helper">{helper}</span>
      </div>
      <button
        type="button"
        className={`settings-toggle__button${checked ? " is-active" : ""}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="settings-toggle__thumb" />
      </button>
    </label>
  );
}

export function SettingsLiveCard({
  label,
  value,
  detail,
}: SettingsLiveCardProps) {
  return (
    <article className="settings-live-card">
      <span className="settings-live-card__label">{label}</span>
      <strong className="settings-live-card__value">{value}</strong>
      <span className="settings-live-card__detail">{detail}</span>
    </article>
  );
}
