import { useEffect, useState } from "react";

import {
  applyPendingSettingsToDevice,
  fetchAppSettings,
  fetchDefaultAppSettings,
  updateAppSettings,
  updateSettingsSyncTestControls,
} from "../api/client";
import type { AppSettingsSnapshot, AppSettingsUpdate, SyncTestControls } from "../types/appSettings";
import { DEFAULT_APP_SETTINGS, DEFAULT_APP_SETTINGS_UPDATE } from "../types/appSettings";

const SETTINGS_REFRESH_INTERVAL_MS = 5000;

interface AppSettingsState {
  settings: AppSettingsSnapshot;
  defaults: AppSettingsUpdate;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (payload: AppSettingsUpdate) => Promise<void>;
  updateSyncTestControls: (payload: SyncTestControls) => Promise<void>;
  applyPendingToDevice: () => Promise<void>;
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

  const updateSyncTestControls = async (payload: SyncTestControls) => {
    setSaving(true);
    try {
      const nextSettings = await updateSettingsSyncTestControls(payload);
      setSettings(nextSettings);
      setError(null);
    } finally {
      setSaving(false);
    }
  };

  const applyPendingToDevice = async () => {
    setSaving(true);
    try {
      const nextSettings = await applyPendingSettingsToDevice();
      setSettings(nextSettings);
      setError(null);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!saving) {
        void refresh();
      }
    }, SETTINGS_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [saving]);

  return {
    settings,
    defaults,
    loading,
    saving,
    error,
    refresh,
    save,
    updateSyncTestControls,
    applyPendingToDevice,
  };
}
