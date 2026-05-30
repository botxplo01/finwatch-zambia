package com.finwatchzambia.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * FinWatch Zambia - Custom BridgeActivity & AndroidSettings Native Plugin
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register custom plugin to open app details settings
        registerPlugin(AndroidSettingsPlugin.class);

        WebView webView = getBridge().getWebView();
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                final String[] resources = request.getResources();
                for (String resource : resources) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        // CRITICAL: Only auto-grant if the Android OS has already granted the CAMERA permission.
                        // This prevents masking real Android permission denials as "Could not start video source".
                        int hasPermission = androidx.core.content.ContextCompat.checkSelfPermission(
                                MainActivity.this, 
                                android.Manifest.permission.CAMERA
                        );

                        if (hasPermission == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                            runOnUiThread(() -> request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}));
                        } else {
                            // If OS permission is missing, let the WebView handle it normally (usually prompts or fails)
                            runOnUiThread(() -> request.deny());
                        }
                        return;
                    }
                }
                super.onPermissionRequest(request);
            }
        });
    }

    /**
     * Capacitor custom plugin to open the OS Settings for FinWatch.
     * Allows seamless permission recovery deep-linking.
     */
    @CapacitorPlugin(name = "AndroidSettings")
    public static class AndroidSettingsPlugin extends Plugin {
        @PluginMethod
        public void openAppSettings(PluginCall call) {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
                intent.setData(uri);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
                intent.addFlags(Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not open settings: " + e.getMessage());
            }
        }
    }
}
