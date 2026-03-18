import { useEffect, useState } from "react";

import { fetchAppSettings, fetchDefaultAppSettings, updateAppSettings } from "../api/client";
import type { AppSettingsSnapshot, AppSettingsUpdate } from "../types/appSettings";
import { DEFAULT_APP_SETTINGS, DEFAULT_APP_SETTINGS_UPDATE } from "../types/appSettings";

interface AppSettingsState {
  settings: AppSettingsSnapshot;
  defaults: AppSettingsUpdate;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (payload: AppSettingsUpdate) => Promise<void>;
}

export function useAppSettings(): AppSettingsState {
  const [settings, setSettings] = useState<AppSettingsSnapshot>(DEFAULT_APP_SETTINGS);
  const [defaults, setDefaults] = useState<AppSettingsUpdate>(DEFAULT_APP_SETTINGS_UPDATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [nextSettings, nextDefaults] = await Promise.allSettled([
        fetchAppSettings(),
        fetchDefaultAppSettings(),
      ]);

      if (nextSettings.status === "fulfilled") {
        setSettings(nextSettings.value);
        setError(null);
      } else {
        const message =
          nextSettings.reason instanceof Error
            ? nextSettings.reason.message
            : "Backend unavailable.";
        setError(`${message} Using local defaults until settings can be loaded.`);
      }

      if (nextDefaults.status === "fulfilled") {
        setDefaults(nextDefaults.value);
      }
    } finally {
      setLoading(false);
    }
  };

  const save = async (payload: AppSettingsUpdate) => {
    setSaving(true);
    try {
      const nextSettings = await updateAppSettings(payload);
      setSettings(nextSettings);
      setError(null);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    settings,
    defaults,
    loading,
    saving,
    error,
    refresh,
    save,
  };
}
