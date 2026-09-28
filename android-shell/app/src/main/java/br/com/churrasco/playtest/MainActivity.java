package br.com.churrasco.playtest;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;

/**
 * CHURRASCO! O Mestre da Brasa — real-device playtest shell.
 *
 * The design-verification prototype is a canvas game (see `prototype/src/main.ts`)
 * and the Unity client is not buildable yet (docs/25-AUDITORIA_STATUS_E_BRANCHES.md).
 * This shell is how a tester plays the *current, validated* rules on a phone today,
 * full screen, one-handed, without a browser bar and without a server:
 *
 *  - the whole export (`npm run export:android`) ships inside the APK, so the app
 *    works in airplane mode and never fetches game code from the network;
 *  - assets are served to the WebView through a virtual https origin
 *    (`appassets.androidplatform.net`) instead of `file://`, which is what makes
 *    `fetch()`, AudioContext, localStorage saves and the service worker behave
 *    exactly as they do in the browser the gates run against. A `file://` page
 *    cannot `fetch('/data/levels.json')` at all: Chromium rejects the scheme;
 *  - immersive sticky full screen, portrait lock, screen kept awake, overscroll
 *    glow off (it fires while dragging food to the edge of the grill).
 *
 * This is a test harness for feel, not a release build: no billing, no ads, no
 * analytics upload, no network permission needed for gameplay.
 */
public class MainActivity extends Activity {
    private static final String TAG = "ChurrascoPlaytest";

    /** Virtual origin for the bundled app. Nothing ever resolves this over the network. */
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        // A turn is ~90s of continuous play; the screen must not dim mid-turn.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Punch into the notch (Honor/Punch-Hole devices) instead of letterboxing around it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        // Captured frames can be inspected at chrome://inspect while the app is installed.
        WebView.setWebContentsDebuggingEnabled(true);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0A0705"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER); // no glow when dragging to the grill edge
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);         // never select text or open the action sheet

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                 // localStorage carries the save file
        s.setMediaPlaybackRequiresUserGesture(false); // the game gates audio on its own first tap
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);                           // system font scaling must not reflow a canvas
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(false);          // local assets only; no lookup, no delay
        }

        web.setWebViewClient(new LocalAssets());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d(TAG, m.message() + "  @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });

        setContentView(web);
        web.loadUrl(START_URL);
    }

    /** Serves the APK's own assets for every request to the virtual origin. */
    private class LocalAssets extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri uri = req.getUrl();
            if (uri == null || !HOST.equals(uri.getHost())) return null;
            String path = uri.getPath();
            if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
            try {
                InputStream in = getAssets().open(path.substring(1));
                return new WebResourceResponse(mimeOf(path), null, in);
            } catch (IOException missing) {
                Log.w(TAG, "asset not in the APK: " + path);
                return null;
            }
        }

        /** One page, one origin: anything that would leave it is a bug, not a navigation. */
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri uri = req.getUrl();
            return uri == null || !HOST.equals(uri.getHost());
        }
    }

    private static String mimeOf(String path) {
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".wav")) return "audio/wav";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        String guessed = URLConnection.guessContentTypeFromName(path);
        return guessed != null ? guessed : "application/octet-stream";
    }

    /** Immersive sticky: hide bars, and re-hide them whenever they dare come back. */
    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    protected void onResume() {
        super.onResume();
        immersive();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    /** A middle-of-a-turn back press should not throw the run away. */
    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }
}
