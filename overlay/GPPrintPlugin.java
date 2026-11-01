package in.grampanchayat.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * HTML ला Android च्या प्रिंट डायलॉगमध्ये पाठवतो (तिथून "Save as PDF" किंवा Wi-Fi प्रिंटर).
 * JS मधून:  Capacitor.registerPlugin('GPPrint').printHtml({html, name, landscape, pageSize})
 *
 * छपाईच्या HTML मध्ये एक स्क्रिप्ट असते (platform-web.js मधून जोडलेली) जी दाखला एका पानात बसवते, नोंदवहीची पाने
 * तळापर्यंत भरते आणि शेवटी window.__gpReady = true करते. म्हणून WebView मध्ये JavaScript चालू ठेवला आहे आणि
 * प्रिंट सुरू करण्याआधी तो __gpReady होईपर्यंत थांबतो.
 */
@CapacitorPlugin(name = "GPPrint")
public class GPPrintPlugin extends Plugin {

    private static final String TAG = "GPPrint";

    // छपाई संपेपर्यंत WebView जिवंत (आणि स्क्रीनला जोडलेला) ठेवतो; पुढच्या प्रिंटला आधीचा काढतो
    private WebView printView;

    private void cleanup() {
        if (printView != null) {
            try {
                ViewGroup parent = (ViewGroup) printView.getParent();
                if (parent != null) parent.removeView(printView);
                printView.destroy();
            } catch (Exception ignored) { }
            printView = null;
        }
    }

    @PluginMethod
    public void printHtml(final PluginCall call) {
        final String html = call.getString("html", "");
        String n = call.getString("name", "document");
        final String name = (n == null || n.trim().isEmpty()) ? "document" : n;
        final boolean landscape = Boolean.TRUE.equals(call.getBoolean("landscape", false));
        final String pageSize = call.getString("pageSize", "A4");

        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    cleanup();
                    final boolean[] started = new boolean[] { false };
                    final int[] tries = new int[] { 0 };
                    final Handler handler = new Handler(Looper.getMainLooper());
                    final WebView wv = new WebView(getActivity());
                    WebSettings ws = wv.getSettings();
                    ws.setJavaScriptEnabled(true);          // आपलीच HTML आहे — fit/fill स्क्रिप्ट चालवण्यासाठी
                    ws.setDomStorageEnabled(false);

                    // A4 च्या रुंदीचा (CSS ~800px) लपवलेला WebView — पानाच्या मापाशी जुळणारी मांडणी मिळण्यासाठी
                    float density = getActivity().getResources().getDisplayMetrics().density;
                    ViewGroup root = (ViewGroup) getActivity().findViewById(android.R.id.content);
                    root.addView(wv, new ViewGroup.LayoutParams((int) (800 * density), (int) (1200 * density)));
                    wv.setVisibility(View.INVISIBLE);

                    final Runnable startPrint = new Runnable() {
                        @Override
                        public void run() {
                            if (started[0]) return;
                            started[0] = true;
                            try {
                                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                                PrintDocumentAdapter adapter = wv.createPrintDocumentAdapter(name);
                                PrintAttributes.MediaSize size = "Legal".equalsIgnoreCase(pageSize)
                                        ? PrintAttributes.MediaSize.NA_LEGAL
                                        : PrintAttributes.MediaSize.ISO_A4;
                                if (landscape) size = size.asLandscape();
                                // मार्जिन HTML मधल्या @page ने ठरतात (संगणकाइतकेच कमी) — म्हणून सिस्टीमचे मार्जिन शून्य
                                PrintAttributes attrs = new PrintAttributes.Builder()
                                        .setMediaSize(size)
                                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                        .build();
                                pm.print(name, adapter, attrs);
                                call.resolve();
                            } catch (Exception e) {
                                Log.e(TAG, "print failed", e);
                                call.reject("print failed: " + e.getMessage());
                            }
                        }
                    };

                    // fit/fill स्क्रिप्ट संपली का ते वारंवार विचारतो (जास्तीत जास्त ~६ सेकंद)
                    final Runnable[] poll = new Runnable[1];
                    poll[0] = new Runnable() {
                        @Override
                        public void run() {
                            if (started[0]) return;
                            wv.evaluateJavascript("(window.__gpReady===true)", new ValueCallback<String>() {
                                @Override
                                public void onReceiveValue(String value) {
                                    if ("true".equals(value) || tries[0]++ > 30) startPrint.run();
                                    else handler.postDelayed(poll[0], 200);
                                }
                            });
                        }
                    };

                    wv.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            handler.postDelayed(poll[0], 150);
                        }
                    });
                    printView = wv;
                    // काहीच झाले नाही तरी प्रिंट सुरू व्हावे म्हणून शेवटचा पर्यायी मार्ग
                    handler.postDelayed(startPrint, 10000);
                    wv.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    Log.e(TAG, "print setup failed", e);
                    call.reject("print failed: " + e.getMessage());
                }
            }
        });
    }
}
