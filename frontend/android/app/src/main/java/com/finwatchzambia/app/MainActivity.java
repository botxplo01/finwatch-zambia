package com.finwatchzambia.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * FinWatch Zambia - Custom BridgeActivity & AndroidSettings Native Plugin
 *
 * Handles WebView camera permission bridging: when the WebView requests
 * VIDEO_CAPTURE and the OS permission has not been granted yet, this
 * activity triggers the OS runtime permission dialog and resolves the
 * pending WebView PermissionRequest based on the user's response.
 */
public class MainActivity extends BridgeActivity {

    private PermissionRequest pendingWebViewPermissionRequest = null;
    private static final int REQUEST_CODE_CAMERA_PERMISSION = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        registerPlugin(AndroidSettingsPlugin.class);

        WebView webView = getBridge().getWebView();
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                final String[] resources = request.getResources();
                for (String resource : resources) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        int permissionStatus = androidx.core.content.ContextCompat.checkSelfPermission(
                                MainActivity.this,
                                android.Manifest.permission.CAMERA
                        );

                        if (permissionStatus == PackageManager.PERMISSION_GRANTED) {
                            runOnUiThread(() -> request.grant(
                                new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}
                            ));
                        } else {
                            pendingWebViewPermissionRequest = request;
                            ActivityCompat.requestPermissions(
                                    MainActivity.this,
                                    new String[]{android.Manifest.permission.CAMERA},
                                    REQUEST_CODE_CAMERA_PERMISSION
                            );
                        }
                        return;
                    }
                }
                super.onPermissionRequest(request);
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults) {

        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == REQUEST_CODE_CAMERA_PERMISSION) {
            if (pendingWebViewPermissionRequest != null) {
                final PermissionRequest requestToResolve = pendingWebViewPermissionRequest;
                pendingWebViewPermissionRequest = null;

                if (grantResults.length > 0
                        && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    runOnUiThread(() -> requestToResolve.grant(
                        new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}
                    ));
                } else {
                    runOnUiThread(() -> requestToResolve.deny());
                }
            }
        }
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

