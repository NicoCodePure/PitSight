import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useAppSettings } from "./hooks/useAppSettings";
import { useTelemetryStream } from "./hooks/useTelemetryStream";
import type { DriverMode } from "./types/appSettings";
import { DriverLemonsPage } from "./pages/DriverLemonsPage";
import { DriverNormalPage } from "./pages/DriverNormalPage";
import { PitDashboardPage } from "./pages/PitDashboardPage";
import { SettingsPage } from "./pages/SettingsPage";

function HomeRedirect({
  loading,
  defaultDriverMode,
}: {
  loading: boolean;
  defaultDriverMode: DriverMode;
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

  return <Navigate to={`/driver/${defaultDriverMode}`} replace />;
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
          element={
            <HomeRedirect
              loading={appSettings.loading}
              defaultDriverMode={appSettings.settings.display.default_driver_mode}
            />
          }
        />
        <Route
          path="/driver/normal"
          element={
            <DriverNormalPage
              {...telemetry}
              displayPreferences={appSettings.settings.display}
              thresholds={appSettings.settings.thresholds}
            />
          }
        />
        <Route
          path="/driver/lemons"
          element={
            <DriverLemonsPage
              {...telemetry}
              displayPreferences={appSettings.settings.display}
              thresholds={appSettings.settings.thresholds}
            />
          }
        />
        <Route
          path="/pit"
          element={<PitDashboardPage {...telemetry} displayPreferences={appSettings.settings.display} />}
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
