import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";

export interface DeviceDiagnostics {
  appVersion: string;
  buildNumber: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
  userIdPrefix: string | null;
}

export function getDeviceDiagnostics(userId?: string | null): DeviceDiagnostics {
  const appVersion =
    Constants.expoConfig?.version ??
    (Constants as { manifest?: { version?: string } }).manifest?.version ??
    "1.0.0";

  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    Constants.nativeBuildVersion ??
    "dev";

  return {
    appVersion,
    buildNumber,
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    deviceModel: Device.modelName ?? Device.deviceName ?? "Unknown",
    userIdPrefix: userId ? userId.slice(0, 8) : null,
  };
}

export function formatDiagnosticsString(d: DeviceDiagnostics): string {
  const parts = [
    `Burd ${d.appVersion} (${d.buildNumber})`,
    `${d.platform} ${d.osVersion}`,
    d.deviceModel,
  ];
  if (d.userIdPrefix) {
    parts.push(`uid:${d.userIdPrefix}`);
  }
  return parts.join(" · ");
}
