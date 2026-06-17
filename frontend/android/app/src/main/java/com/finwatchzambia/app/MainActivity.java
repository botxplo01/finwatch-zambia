package com.finwatchzambia.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * FinWatch Zambia — Custom BridgeActivity and AndroidSettings native plugin.
 *
 * Responsibilities:
 *   - Bridges WebView camera permission requests to the OS runtime dialog.
 *   - Bridges WebView file input taps to the Android file chooser.
 *   - Exposes the AndroidSettings plugin for OS settings deep-linking.
 */
public class MainActivity extends BridgeActivity {

    private PermissionRequest pendingWebViewPermissionRequest = null;
    private static final int REQUEST_CODE_CAMERA_PERMISSION = 1001;

    private ValueCallback<Uri[]> pendingFileCallback = null;
    private static final int REQUEST_FILE_CHOOSER = 1002;

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

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {

                if (pendingFileCallback != null) {
                    pendingFileCallback.onReceiveValue(null);
                }
                pendingFileCallback = filePathCallback;

                Intent chooserIntent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(chooserIntent, REQUEST_FILE_CHOOSER);
                } catch (Exception e) {
                    pendingFileCallback = null;
                    return false;
                }
                return true;
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (pendingFileCallback == null) {
                return;
            }
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            }
            pendingFileCallback.onReceiveValue(results);
            pendingFileCallback = null;
        }
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
