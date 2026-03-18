import type {
  AppSettingsSnapshot,
  AppSettingsUpdate,
  SyncTestControls,
} from "../../types/appSettings";
import type { SourceStatus } from "../../types/telemetry";
import type { ThresholdFieldErrors, ThresholdFieldName, ThresholdInputState } from "../../utils/settingsForm";

export interface SettingsTabBaseProps {
  settings: AppSettingsSnapshot;
  draft: AppSettingsUpdate;
}

export type ConnectionField = keyof AppSettingsUpdate["device_local"]["connections"];
export type VehicleField = keyof AppSettingsUpdate["device_local"]["vehicle"];
export type DeviceCameraField = keyof AppSettingsUpdate["device_local"]["camera"];
export type DeviceDisplayField = keyof AppSettingsUpdate["device_local"]["display"];
export type SharedDisplayField = keyof AppSettingsUpdate["shared"]["display"];
export type SharedUnitsField = keyof AppSettingsUpdate["shared"]["units"];
export type SharedRootField = keyof Pick<
  AppSettingsUpdate["shared"],
  "telemetry_source_preference" | "camera_mode_preference"
>;
export type WebField = keyof AppSettingsUpdate["web"];

export type ConnectionChangeHandler = (
  field: ConnectionField,
  value: AppSettingsUpdate["device_local"]["connections"][ConnectionField],
) => void;

export type VehicleChangeHandler = (
  field: VehicleField,
  value: AppSettingsUpdate["device_local"]["vehicle"][VehicleField],
) => void;

export type DeviceCameraChangeHandler = (
  field: DeviceCameraField,
  value: AppSettingsUpdate["device_local"]["camera"][DeviceCameraField],
) => void;

export type DeviceDisplayChangeHandler = (
  field: DeviceDisplayField,
  value: AppSettingsUpdate["device_local"]["display"][DeviceDisplayField],
) => void;

export type SharedDisplayChangeHandler = (
  field: SharedDisplayField,
  value: AppSettingsUpdate["shared"]["display"][SharedDisplayField],
) => void;

export type SharedUnitsChangeHandler = (
  field: SharedUnitsField,
  value: AppSettingsUpdate["shared"]["units"][SharedUnitsField],
) => void;

export type SharedRootChangeHandler = (
  field: SharedRootField,
  value: AppSettingsUpdate["shared"][SharedRootField],
) => void;

export type WebChangeHandler = (
  field: WebField,
  value: AppSettingsUpdate["web"][WebField],
) => void;

export type SyncTestControlsChangeHandler = (payload: SyncTestControls) => Promise<void>;
export type ApplyPendingToDeviceHandler = () => Promise<void>;

export interface SettingsConnectionsTabProps extends SettingsTabBaseProps {
  source?: SourceStatus | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  onConnectionChange: ConnectionChangeHandler;
}

export interface SettingsVehicleTabProps extends SettingsTabBaseProps {
  source?: SourceStatus | null;
  streamStatus: "connecting" | "connected" | "disconnected";
  onSharedRootChange: SharedRootChangeHandler;
  onVehicleChange: VehicleChangeHandler;
}

export interface SettingsDisplayTabProps extends SettingsTabBaseProps {
  onSharedDisplayChange: SharedDisplayChangeHandler;
  onDeviceDisplayChange: DeviceDisplayChangeHandler;
}

export interface SettingsThresholdsTabProps extends SettingsTabBaseProps {
  thresholdInputs: ThresholdInputState;
  fieldErrors: ThresholdFieldErrors;
  onThresholdInputChange: (field: ThresholdFieldName, value: string) => void;
}

export interface SettingsUnitsTabProps extends SettingsTabBaseProps {
  onSharedUnitsChange: SharedUnitsChangeHandler;
}

export interface SettingsCameraTabProps extends SettingsTabBaseProps {
  onSharedRootChange: SharedRootChangeHandler;
  onDeviceCameraChange: DeviceCameraChangeHandler;
}

export interface SettingsSystemTabProps extends SettingsTabBaseProps {
  lastSavedLabel: string;
  lastSyncLabel: string;
  saving: boolean;
  onWebChange: WebChangeHandler;
  onUpdateSyncTestControls: SyncTestControlsChangeHandler;
  onApplyPendingToDevice: ApplyPendingToDeviceHandler;
}
