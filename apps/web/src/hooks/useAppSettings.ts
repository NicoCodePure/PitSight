import { useEffect, useState } from "react";

import { fetchAppSettings, updateAppSettings } from "../api/client";
import type { AppSettingsSnapshot, AppSettingsUpdate } from "../types/appSettings";
import { DEFAULT_APP_SETTINGS } from "../types/appSettings";

interface AppSettingsState {
  settings: AppSettingsSnapshot;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (payload: AppSettingsUpdate) => Promise<void>;
}

export function useAppSettings(): AppSettingsState {
  const [settings, setSettings] = useState<AppSettingsSnapshot>(DEFAULT_APP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const nextSettings = await fetchAppSettings();
      setSettings(nextSettings);
      setError(null);
    } catch {
      setError("Backend unavailable. Using local defaults until settings can be loaded.");
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
    loading,
    saving,
    error,
    refresh,
    save,
  };
}
