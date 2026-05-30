import { registerPlugin } from "@capacitor/core";

/**
 * Custom Capacitor plugin to open OS-level App Settings.
 * Implementation resides in android/app/src/main/java/.../MainActivity.java
 */
export interface AndroidSettingsPlugin {
  openAppSettings(): Promise<void>;
}

export const AndroidSettings = registerPlugin<AndroidSettingsPlugin>("AndroidSettings");
