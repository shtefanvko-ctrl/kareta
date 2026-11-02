package kz.kareta.adminassistant;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.SafeBrowsingResponse;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final int PICK_FILE_REQUEST = 4101;
    private static final int BACKGROUND = Color.rgb(11, 23, 34);
    private static final int ACCENT = Color.rgb(36, 199, 178);
    private WebView webView;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private TextView errorMessage;
    private android.webkit.ValueCallback<Uri[]> fileCallback;
    private boolean pageError = false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets b = insets.getInsets(
                    WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                v.setPadding(b.left, b.top, b.right, b.bottom);
                return insets;
            });
        }
        setContentView(root);

        webView = new WebView(this);
        webView.setBackgroundColor(BACKGROUND);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(false);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP);
        root.addView(progress, pp);
        progress.setVisibility(View.GONE);

        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(28), dp(28), dp(28), dp(28));
        errorPanel.setBackgroundColor(BACKGROUND);
        TextView heading = new TextView(this);
        heading.setText("KARETA AI");
        heading.setTextSize(23);
        heading.setTextColor(Color.WHITE);
        heading.setGravity(Gravity.CENTER);
        errorPanel.addView(heading, new LinearLayout.LayoutParams(-1, -2));
        errorMessage = new TextView(this);
        errorMessage.setGravity(Gravity.CENTER);
        errorMessage.setTextColor(Color.rgb(184, 207, 216));
        errorMessage.setTextSize(15);
        LinearLayout.LayoutParams mp = new LinearLayout.LayoutParams(-1, -2);
        mp.setMargins(0, dp(20), 0, dp(18));
        errorPanel.addView(errorMessage, mp);
        Button retry = new Button(this);
        retry.setText("Повторить");
        retry.setAllCaps(false);
        retry.setTextColor(Color.BLACK);
        retry.setBackgroundTintList(android.content.res.ColorStateList.valueOf(ACCENT));
        retry.setOnClickListener(v -> openChat());
        errorPanel.addView(retry, new LinearLayout.LayoutParams(-1, dp(54)));
        Button external = new Button(this);
        external.setText("Открыть в браузере");
        external.setAllCaps(false);
        external.setTextColor(Color.WHITE);
        external.setOnClickListener(v -> externalUrl(Uri.parse(BuildConfig.CHAT_URL)));
        errorPanel.addView(external, new LinearLayout.LayoutParams(-1, dp(52)));
        root.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
        errorPanel.setVisibility(View.GONE);

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (!req.isForMainFrame()) return false;
                Uri uri = req.getUrl();
                if (isAllowedSite(uri)) return false;
                externalUrl(uri);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                pageError = false;
                errorPanel.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError error) {
                if (req.isForMainFrame()) showError("Нет подключения к чату. Проверьте интернет и повторите попытку.");
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse response) {
                if (req.isForMainFrame() && response.getStatusCode() == 403)
                    showError("Сервер вернул HTTP 403. Возможна блокировка Cloudflare. Требуется разрешённый маршрут для приложения; отключать вход и права администратора нельзя.");
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                if (newProgress == 100) progress.setVisibility(View.GONE);
            }
            @Override public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                String[] types = params.getAcceptTypes();
                if (types != null && types.length != 0 && !types[0].isEmpty()) {
                    pick.putExtra(Intent.EXTRA_MIME_TYPES, types);
                }
                try { startActivityForResult(Intent.createChooser(pick, "Прикрепить файл"), PICK_FILE_REQUEST); return true; }
                catch (ActivityNotFoundException ex) { fileCallback.onReceiveValue(null); fileCallback = null; return false; }
            }
        });
        if (state != null) webView.restoreState(state);
        else openChat();
    }

    private static boolean isAllowedSite(Uri uri) {
        if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost();
        return host != null && (host.equalsIgnoreCase("kareta.kz") || host.toLowerCase(java.util.Locale.ROOT).endsWith(".kareta.kz"));
    }
    private void externalUrl(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null || (!scheme.equalsIgnoreCase("https") && !scheme.equalsIgnoreCase("http")
                && !scheme.equalsIgnoreCase("mailto") && !scheme.equalsIgnoreCase("tel")
                && !scheme.equalsIgnoreCase("whatsapp"))) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException ignored) { showError("Для открытия этой ссылки не найдено приложение."); }
    }
    private void openChat() {
        pageError = false;
        errorPanel.setVisibility(View.GONE);
        webView.loadUrl(BuildConfig.CHAT_URL);
    }
    private void showError(String message) {
        pageError = true;
        progress.setVisibility(View.GONE);
        errorMessage.setText(message);
        errorPanel.setVisibility(View.VISIBLE);
        errorPanel.bringToFront();
    }
    private int dp(float value) { return (int)(getResources().getDisplayMetrics().density * value + .5f); }
    @Override protected void onSaveInstanceState(Bundle out) {
        webView.saveState(out);
        super.onSaveInstanceState(out);
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE_REQUEST && fileCallback != null) {
            Uri[] selected = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) selected = new Uri[]{data.getData()};
            fileCallback.onReceiveValue(selected);
            fileCallback = null;
        }
    }
    @Override public void onBackPressed() {
        if (errorPanel.getVisibility() == View.VISIBLE) { openChat(); return; }
        if (webView.canGoBack()) { webView.goBack(); return; }
        super.onBackPressed();
    }
    @Override protected void onPause() { CookieManager.getInstance().flush(); webView.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); webView.onResume(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        ((ViewGroup) webView.getParent()).removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
