package in.grampanchayat.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
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

    // छपाई संपेपर्यंत WebView जिवंत ठेवण्यासाठी (नाहीतर garbage-collect होऊन रिकामे पान येते)
    private WebView printView;

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
                    final boolean[] started = new boolean[] { false };
                    final WebView wv = new WebView(getActivity());
                    wv.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            if (started[0]) return;
                            started[0] = true;
                            try {
                                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                                PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(name);
                                PrintAttributes.MediaSize size = "Legal".equalsIgnoreCase(pageSize)
                                        ? PrintAttributes.MediaSize.NA_LEGAL
                                        : PrintAttributes.MediaSize.ISO_A4;
                                if (landscape) size = size.asLandscape();
                                PrintAttributes attrs = new PrintAttributes.Builder().setMediaSize(size).build();
                                pm.print(name, adapter, attrs);
                                call.resolve();
                            } catch (Exception e) {
                                call.reject("print failed: " + e.getMessage());
                            }
                        }
                    });
                    printView = wv;
                    wv.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    call.reject("print failed: " + e.getMessage());
                }
            }
        });
    }
}
