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
                        runOnUiThread(() -> request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}));
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
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not open settings: " + e.getMessage());
            }
        }
    }
}
