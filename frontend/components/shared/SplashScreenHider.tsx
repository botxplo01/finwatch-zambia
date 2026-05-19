"use client";

import { useEffect } from "react";
import { SplashScreen } from "@capacitor/splash-screen";

export function SplashScreenHider() {
  useEffect(() => {
    // Hide the splash screen once the app is mounted and ready
    const hideSplash = async () => {
      try {
        await SplashScreen.hide({
          fadeOutDuration: 500,
        });
      } catch (e) {
        // Not running in a native environment (e.g. browser)
      }
    };

    hideSplash();
  }, []);

  return null;
}
