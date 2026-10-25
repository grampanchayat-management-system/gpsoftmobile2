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
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * HTML ला Android च्या प्रिंट डायलॉगमध्ये पाठवतो (तिथून "Save as PDF" किंवा Wi-Fi प्रिंटर).
 * JS मधून:  Capacitor.registerPlugin('GPPrint').printHtml({html, name, landscape, pageSize})
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
                    final WebView wv = new WebView(getActivity());

                    // काही फोनवर स्क्रीनला न जोडलेला WebView लोड/रेंडर होत नाही — म्हणून १x१ पिक्सेलचा लपवलेला जोडतो
                    ViewGroup root = (ViewGroup) getActivity().findViewById(android.R.id.content);
                    root.addView(wv, new ViewGroup.LayoutParams(1, 1));
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
                                PrintAttributes attrs = new PrintAttributes.Builder().setMediaSize(size).build();
                                pm.print(name, adapter, attrs);
                                call.resolve();
                            } catch (Exception e) {
                                Log.e(TAG, "print failed", e);
                                call.reject("print failed: " + e.getMessage());
                            }
                        }
                    };

                    wv.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            startPrint.run();
                        }
                    });
                    printView = wv;
                    // onPageFinished कधी आलाच नाही तरी प्रिंट सुरू व्हावे म्हणून ३ सेकंदांचा पर्यायी मार्ग
                    new Handler(Looper.getMainLooper()).postDelayed(startPrint, 3000);
                    wv.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    Log.e(TAG, "print setup failed", e);
                    call.reject("print failed: " + e.getMessage());
                }
            }
        });
    }
}
