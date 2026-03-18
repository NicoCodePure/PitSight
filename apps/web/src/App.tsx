import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useAppSettings } from "./hooks/useAppSettings";
import { useTelemetryStream } from "./hooks/useTelemetryStream";
import type { AppSettingsSnapshot, DashboardMode } from "./types/appSettings";
import { DriverLemonsPage } from "./pages/DriverLemonsPage";
import { DriverNormalPage } from "./pages/DriverNormalPage";
import { PitDashboardPage } from "./pages/PitDashboardPage";
import { SettingsPage } from "./pages/SettingsPage";

function getDashboardRoute(settings: AppSettingsSnapshot): string {
  const requestedMode = settings.device_local.display.default_dashboard_mode;
  const appliedMode: DashboardMode =
    requestedMode === "last_used" ? settings.sync.applied_dashboard_mode : requestedMode;

  const effectiveMode: DashboardMode =
    appliedMode === "last_used"
      ? settings.shared.display.preferred_driver_mode === "lemons"
        ? "driver_lemons"
        : "driver_normal"
      : appliedMode;

  switch (effectiveMode) {
    case "driver_lemons":
      return "/driver/lemons";
    case "driver_normal":
      return "/driver/normal";
    case "pit_dashboard":
      return "/pit";
  }
}

function HomeRedirect({
  loading,
  settings,
}: {
  loading: boolean;
  settings: AppSettingsSnapshot;
}) {
  if (loading) {
    return (
      <main className="screen screen--settings">
        <section className="panel settings-panel">
          <div className="panel__title">Loading</div>
          <div className="settings-status">Loading saved display preferences...</div>
        </section>
      </main>
    );
  }

  return <Navigate to={getDashboardRoute(settings)} replace />;
}

export default function App() {
  const location = useLocation();
  const telemetry = useTelemetryStream();
  const appSettings = useAppSettings();
  const showModeNav = !location.pathname.startsWith("/driver/");

  return (
    <div className="app-shell">
      {showModeNav ? (
        <nav className="mode-nav" aria-label="Mode navigation">
          <NavLink to="/driver/normal" className={({ isActive }) => `mode-nav__link${isActive ? " is-active" : ""}`}>
            Driver
          </NavLink>
          <NavLink to="/driver/lemons" className={({ isActive }) => `mode-nav__link${isActive ? " is-active" : ""}`}>
            Lemons
          </NavLink>
          <NavLink to="/pit" className={({ isActive }) => `mode-nav__link${isActive ? " is-active" : ""}`}>
            Pit
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `mode-nav__link${isActive ? " is-active" : ""}`}>
            Settings
          </NavLink>
        </nav>
      ) : null}

      <Routes>
        <Route
          path="/"
          element={<HomeRedirect loading={appSettings.loading} settings={appSettings.settings} />}
        />
        <Route
          path="/driver/normal"
          element={
            <DriverNormalPage
              {...telemetry}
              displayPreferences={appSettings.settings.shared.units}
              thresholds={appSettings.settings.shared.thresholds}
            />
          }
        />
        <Route
          path="/driver/lemons"
          element={
            <DriverLemonsPage
              {...telemetry}
              displayPreferences={appSettings.settings.shared.units}
              thresholds={appSettings.settings.shared.thresholds}
            />
          }
        />
        <Route
          path="/pit"
          element={<PitDashboardPage {...telemetry} settings={appSettings.settings} />}
        />
        <Route
          path="/settings"
          element={
            <SettingsPage
              settings={appSettings.settings}
              defaults={appSettings.defaults}
              loading={appSettings.loading}
              saving={appSettings.saving}
              error={appSettings.error}
              onSave={appSettings.save}
              source={telemetry.snapshot?.source ?? null}
              streamStatus={telemetry.streamStatus}
            />
          }
        />
      </Routes>
    </div>
  );
}
